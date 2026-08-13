import { timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http'

import { WebSocket, WebSocketServer } from 'ws'

import {
  PLAYER_CHARACTER_INPUT_ACCELERATION,
  PLAYER_CHARACTER_MOVEMENT_LANE_CAP,
  PLAYER_CHARACTER_MOVEMENT_RETENTION,
  PLAYER_CHARACTER_MOVEMENT_THRESHOLD_SQUARED,
  PLAYER_CHARACTER_RADIUS,
  type PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import {
  GAME_FIXED_TICK_SECONDS,
  GAME_TICK_RATE,
  addPlayerCharacter,
  createGameSimulation,
  enterBoneyardWorld,
  removePlayerCharacter,
  stepGameSimulationTick,
  type GameSimulationState,
  type PlayerId,
} from '../core-server/game-simulation.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import {
  createBoneyardCatalog,
  materializeBoneyard,
  type BoneyardCatalog,
} from './boneyard-catalog.ts'
import {
  EMPTY_CONTENT_MANIFEST_SHA256,
  GAME_PROTOCOL_VERSION,
  PLAYER_CHARACTER_KERNEL_VERSION,
  GameProtocolError,
  decodeClientGameMessage,
  encodeGameMessage,
  type GameContentManifest,
  type ServerDisconnectMessage,
} from '../protocol/game-protocol.ts'
import { createGameSnapshot } from './game-snapshot.ts'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

export type GameHostAuthentication =
  | { kind: 'shared'; credential: string }
  | { kind: 'reserved-host'; guestCredential: string; hostCredential: string }

type GameHostRole = 'guest' | 'host' | 'shared'

export interface GameHostOptions {
  allowedOrigins?: readonly string[]
  authentication: GameHostAuthentication
  boneyards?: BoneyardCatalog
  content?: GameContentManifest
  host?: string
  maxPlayers?: number
  port?: number
  snapshotRate?: number
  trustedProxy?: boolean
}

export interface GameHostAddress {
  host: string
  port: number
  url: string
}

export interface GameHost {
  address: GameHostAddress
  close(): Promise<void>
  hostPlayerId(): string | null
  playerCount(): number
  loadedBoneyard(): LoadedBoneyard | null
  state(): GameSimulationState
}

interface HostClient {
  acknowledgedSequence: number
  activeInput: PlayerCharacterInput
  lastReceivedSequence: number
  playerId: PlayerId
  queuedInputs: Map<number, QueuedClientInput>
  socket: WebSocket
}

interface QueuedClientInput {
  input: PlayerCharacterInput
  sequence: number
  targetTick: number
}

export async function startGameHost(options: GameHostOptions): Promise<GameHost> {
  validateAuthentication(options.authentication)
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? 0
  const maxPlayers = options.maxPlayers ?? 16
  const snapshotRate = options.snapshotRate ?? 20
  const boneyards = options.boneyards ?? createBoneyardCatalog()
  if (!LOOPBACK_HOSTS.has(host) && !options.trustedProxy) {
    throw new Error('Non-loopback game hosts may only run behind an explicitly trusted secure proxy')
  }
  if (!LOOPBACK_HOSTS.has(host) && !options.allowedOrigins?.length) {
    throw new Error('Non-loopback game hosts require a nonempty allowedOrigins policy')
  }
  if (!Number.isInteger(maxPlayers) || maxPlayers < 1) {
    throw new Error('maxPlayers must be positive')
  }
  if (!(snapshotRate > 0 && snapshotRate <= GAME_TICK_RATE)) {
    throw new Error(`snapshotRate must be within 1..${GAME_TICK_RATE}`)
  }

  let state = createGameSimulation({})
  let nextPlayerId = 1
  let hostPlayerId: PlayerId | null = null
  let reservedHostClaimed = false
  let loadedBoneyard: LoadedBoneyard | null = null
  let closed = false
  let ticking = false
  let nextTickAt = performance.now() + GAME_FIXED_TICK_SECONDS * 1000
  const clients = new Map<WebSocket, HostClient>()
  const pending = new Set<WebSocket>()
  const server = createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({
        status: 'ok',
        tick: state.tick,
        players: clients.size,
        scene: state.world.kind,
      }))
      return
    }
    response.writeHead(404)
    response.end()
  })
  const websocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: 64 * 1024,
  })

  server.on('upgrade', (request, socket, head) => {
    if (!isAllowedUpgrade(request, host, options.allowedOrigins ?? [])) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    if (request.url !== '/game') {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      websocketServer.emit('connection', websocket, request)
    })
  })

  websocketServer.on('connection', (socket) => {
    pending.add(socket)
    const helloDeadline = setTimeout(() => {
      if (pending.has(socket)) disconnect(socket, 'authentication-failed', 'Handshake timed out.')
    }, 5000)
    helloDeadline.unref()

    socket.on('message', (data, binary) => {
      if (binary) {
        disconnect(
          socket,
          'invalid-message',
          `Protocol ${GAME_PROTOCOL_VERSION} accepts text messages only.`,
        )
        return
      }
      let message
      try {
        message = decodeClientGameMessage(data.toString())
      } catch (error) {
        disconnect(
          socket,
          'invalid-message',
          error instanceof GameProtocolError ? error.message : 'Malformed message.',
        )
        return
      }

      const client = clients.get(socket)
      if (!client) {
        if (message.type !== 'client-hello') {
          disconnect(socket, 'authentication-failed', 'The first message must authenticate.')
          return
        }
        if (message.protocolVersion !== GAME_PROTOCOL_VERSION) {
          disconnect(
            socket,
            'protocol-mismatch',
            `Protocol ${GAME_PROTOCOL_VERSION} is required.`,
          )
          return
        }
        const role = authenticate(message.credential, options.authentication)
        if (!role) {
          disconnect(socket, 'authentication-failed', 'The session credential is invalid.')
          return
        }
        if (role === 'host' && reservedHostClaimed) {
          disconnect(socket, 'authentication-failed', 'The host credential has already been claimed.')
          return
        }
        if (clients.size >= maxPlayers) {
          disconnect(socket, 'server-full', 'The session is full.')
          return
        }
        if (role === 'guest' && !reservedHostClaimed && clients.size >= maxPlayers - 1) {
          disconnect(socket, 'server-full', 'The session is reserving its final seat for the host.')
          return
        }
        clearTimeout(helloDeadline)
        pending.delete(socket)
        const playerId = `player-${nextPlayerId}`
        nextPlayerId += 1
        state = addPlayerCharacter(state, playerId, message.character)
        if (role === 'host') {
          reservedHostClaimed = true
          hostPlayerId = playerId
        } else if (role === 'shared') {
          hostPlayerId ??= playerId
        } else if (reservedHostClaimed) {
          hostPlayerId ??= playerId
        }
        clients.set(socket, {
          acknowledgedSequence: 0,
          activeInput: { movement: { x: 0, y: 0 } },
          lastReceivedSequence: 0,
          playerId,
          queuedInputs: new Map(),
          socket,
        })
        socket.send(encodeGameMessage({
          type: 'server-welcome',
          protocolVersion: GAME_PROTOCOL_VERSION,
          playerId,
          resumeToken: `reserved-${playerId}`,
          serverTickRate: GAME_TICK_RATE,
          snapshotRate,
          kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
          kernelParameters: {
            fixedTickSeconds: GAME_FIXED_TICK_SECONDS,
            movementAcceleration: PLAYER_CHARACTER_INPUT_ACCELERATION,
            movementLaneCap: PLAYER_CHARACTER_MOVEMENT_LANE_CAP,
            movementRetention: PLAYER_CHARACTER_MOVEMENT_RETENTION,
            movementThresholdSquared: PLAYER_CHARACTER_MOVEMENT_THRESHOLD_SQUARED,
            playerRadius: PLAYER_CHARACTER_RADIUS,
          },
          content: options.content ?? {
            manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256,
            mods: [],
          },
          boneyards: boneyards.choices,
          snapshot: createGameSnapshot(state, hostPlayerId),
        }))
        if (loadedBoneyard) {
          socket.send(encodeGameMessage({
            type: 'server-boneyard-loaded',
            boneyard: loadedBoneyard,
          }))
        }
        return
      }

      if (message.type === 'client-input') {
        if (message.sequence <= client.lastReceivedSequence) return
        if (message.targetTick > state.tick + GAME_TICK_RATE * 2) {
          disconnect(socket, 'invalid-message', 'Input targets too far ahead of the server tick.')
          return
        }
        client.lastReceivedSequence = message.sequence
        const targetTick = Math.max(state.tick + 1, message.targetTick)
        const queued = client.queuedInputs.get(targetTick)
        if (!queued || message.sequence > queued.sequence) {
          client.queuedInputs.set(targetTick, {
            input: message.input,
            sequence: message.sequence,
            targetTick,
          })
        }
        return
      }
      if (message.type === 'client-start-match') {
        if (client.playerId !== hostPlayerId || loadedBoneyard) return
        const selected = materializeBoneyard(boneyards, message.boneyardId)
        if (!selected) {
          disconnect(socket, 'invalid-message', 'The selected Boneyard is unavailable.')
          return
        }
        loadedBoneyard = selected
        state = enterBoneyardWorld(state, selected)
        broadcast({ type: 'server-boneyard-loaded', boneyard: selected })
        broadcastSnapshot()
        return
      }
      if (message.type === 'client-disconnect') socket.close(1000, 'client disconnect')
      else disconnect(socket, 'invalid-message', 'The client has already joined.')
    })

    const release = () => {
      clearTimeout(helloDeadline)
      pending.delete(socket)
      const client = clients.get(socket)
      if (!client) return
      clients.delete(socket)
      state = removePlayerCharacter(state, client.playerId)
      if (client.playerId === hostPlayerId) {
        hostPlayerId = clients.values().next().value?.playerId ?? null
        broadcastSnapshot()
      }
    }
    socket.once('close', release)
    socket.once('error', release)
  })

  const ticksPerSnapshot = Math.max(1, Math.round(GAME_TICK_RATE / snapshotRate))
  const timer = setInterval(() => {
    if (closed || ticking) return
    ticking = true
    try {
      const now = performance.now()
      let steps = 0
      while (now >= nextTickAt && steps < 25) {
        const inputs: Record<PlayerId, PlayerCharacterInput> = {}
        const nextTick = state.tick + 1
        for (const client of clients.values()) {
          applyQueuedInput(client, nextTick)
          inputs[client.playerId] = client.activeInput
        }
        state = stepGameSimulationTick(state, inputs)
        nextTickAt += GAME_FIXED_TICK_SECONDS * 1000
        steps += 1
        if (state.tick % ticksPerSnapshot === 0) broadcastSnapshot()
      }
      if (steps === 25 && now >= nextTickAt) {
        nextTickAt = now + GAME_FIXED_TICK_SECONDS * 1000
      }
    } finally {
      ticking = false
    }
  }, 2)

  function broadcastSnapshot(): void {
    const snapshot = createGameSnapshot(state, hostPlayerId)
    for (const client of clients.values()) {
      if (client.socket.readyState !== WebSocket.OPEN) continue
      client.socket.send(encodeGameMessage({
        type: 'server-snapshot',
        acknowledgedInputSequence: client.acknowledgedSequence,
        snapshot,
      }))
    }
  }

  function broadcast(message: Parameters<typeof encodeGameMessage>[0]): void {
    const encoded = encodeGameMessage(message)
    for (const client of clients.values()) {
      if (client.socket.readyState === WebSocket.OPEN) client.socket.send(encoded)
    }
  }

  function disconnect(
    socket: WebSocket,
    code: ServerDisconnectMessage['code'],
    reason: string,
  ): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(encodeGameMessage({ type: 'server-disconnect', code, reason }))
    }
    socket.close(1008, reason.slice(0, 123))
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.off('error', reject)
      resolve()
    })
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Game host did not bind a TCP address')
  }

  return {
    address: {
      host,
      port: address.port,
      url: `ws://${formatHost(host)}:${address.port}/game`,
    },
    async close() {
      if (closed) return
      closed = true
      clearInterval(timer)
      for (const socket of [...pending, ...clients.keys()]) {
        socket.close(1001, 'server shutdown')
      }
      websocketServer.close()
      await closeHttpServer(server)
    },
    hostPlayerId: () => hostPlayerId,
    playerCount: () => clients.size,
    loadedBoneyard: () => loadedBoneyard,
    state: () => state,
  }
}

function authenticate(
  credential: string,
  authentication: GameHostAuthentication,
): GameHostRole | null {
  if (authentication.kind === 'shared') {
    return credentialsEqual(credential, authentication.credential) ? 'shared' : null
  }
  if (credentialsEqual(credential, authentication.hostCredential)) return 'host'
  return credentialsEqual(credential, authentication.guestCredential) ? 'guest' : null
}

function validateAuthentication(authentication: GameHostAuthentication): void {
  if (authentication.kind === 'shared') {
    if (!authentication.credential) throw new Error('Game host requires a shared credential')
    return
  }
  if (!authentication.hostCredential || !authentication.guestCredential) {
    throw new Error('Game host requires host and guest credentials')
  }
  if (credentialsEqual(authentication.hostCredential, authentication.guestCredential)) {
    throw new Error('Game host host and guest credentials must differ')
  }
}

function applyQueuedInput(client: HostClient, nextTick: number): void {
  let selected: QueuedClientInput | undefined
  for (const [targetTick, input] of client.queuedInputs) {
    if (targetTick > nextTick) continue
    client.queuedInputs.delete(targetTick)
    if (input.sequence <= client.acknowledgedSequence) continue
    if (
      !selected
      || input.targetTick > selected.targetTick
      || (input.targetTick === selected.targetTick && input.sequence > selected.sequence)
    ) selected = input
  }
  if (!selected) return
  client.activeInput = selected.input
  client.acknowledgedSequence = Math.max(client.acknowledgedSequence, selected.sequence)
}

function isAllowedUpgrade(
  request: IncomingMessage,
  configuredHost: string,
  allowedOrigins: readonly string[],
): boolean {
  const hostHeader = request.headers.host
  if (!hostHeader) return false
  const hostname = hostHeader.startsWith('[')
    ? hostHeader.slice(1, hostHeader.indexOf(']'))
    : hostHeader.split(':', 1)[0]
  if (LOOPBACK_HOSTS.has(configuredHost) && !LOOPBACK_HOSTS.has(hostname)) return false
  const origin = request.headers.origin
  if (origin === undefined || origin === 'null') return true
  return allowedOrigins.includes(origin)
}

function credentialsEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length
    && timingSafeEqual(actualBytes, expectedBytes)
}

function formatHost(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
}

function closeHttpServer(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
}

import { timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http'
import type { Duplex } from 'node:stream'

import { WebSocket, WebSocketServer } from 'ws'

import {
  PLAYER_CHARACTER_INPUT_ACCELERATION,
  PLAYER_CHARACTER_MOVEMENT_LANE_CAP,
  PLAYER_CHARACTER_MOVEMENT_RETENTION,
  PLAYER_CHARACTER_MOVEMENT_THRESHOLD_SQUARED,
  PLAYER_CHARACTER_RADIUS,
  createIdlePlayerCharacterInput,
  type PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import {
  GAME_FIXED_TICK_SECONDS,
  GAME_TICK_RATE,
  addPlayerCharacter,
  applyGameSimulationHubAction,
  confirmGameSimulationLoadout,
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerProgression,
  grantGameSimulationPlayerExperience,
  removePlayerCharacter,
  rerollGameSimulationPlayerSkill,
  saveGameSimulationPlayerSkill,
  selectGameSimulationPlayerSkill,
  stepGameSimulationTick,
  type GameSimulationState,
  type PlayerId,
} from '../core-server/game-simulation.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { BONEYARD_GAME_OVER_EXIT_FADE_TICKS } from '../core-kernels/game-run.ts'
import {
  createBoneyardCatalog,
  materializeBoneyard,
  type BoneyardCatalog,
} from './boneyard-catalog.ts'
import {
  EMPTY_CONTENT_MANIFEST_SHA256,
  GAME_HOST_ENDED_SESSION_CLOSE_CODE,
  GAME_PROTOCOL_VERSION,
  PLAYER_CHARACTER_KERNEL_VERSION,
  GameProtocolError,
  decodeClientGameMessage,
  encodeGameMessage,
  type GameContentManifest,
  type GameplayPauseState,
  type ServerDisconnectMessage,
} from '../protocol/game-protocol.ts'
import { createGameSnapshot } from './game-snapshot.ts'
import {
  createGameSnapshotFrame,
  createReplicatedEntityBaseline,
  type ReplicatedEntityBaseline,
} from '../protocol/entity-replication.ts'
import {
  monitorWebSocketHeartbeat,
  resolveGameHeartbeatInterval,
} from './websocket-heartbeat.ts'
import { GAME_WEBSOCKET_COMPRESSION } from './websocket-compression.ts'
import {
  gameServerErrorDetails,
  logGameServerEvent,
  type GameServerLogSink,
} from './game-server-logger.ts'
import {
  applyWebLuaCommands,
  createWebLuaFrameState,
  deriveWebLuaEvents,
  type WebLuaDerivedEvent,
} from './lua/web-lua-game-api.ts'
import { WebLuaRuntime } from './lua/web-lua-runtime.ts'
import { WEB_LUA_MAX_PENDING_EXECUTIONS } from './lua/web-lua-contract.ts'

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
  createBoneyardSeedBytes?: () => Buffer
  createSimulation?: () => GameSimulationState
  host?: string
  heartbeatIntervalMs?: number
  initialPlayerExperience?: number
  log?: GameServerLogSink
  logContext?: Readonly<Record<string, unknown>>
  luaWasmPath?: string
  maxPlayers?: number
  onPlayerCountChanged?: (playerCount: number) => void
  port?: number
  resetWhenEmpty?: boolean
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
  close(reason?: GameHostCloseReason): Promise<void>
  hostPlayerId(): string | null
  playerCount(): number
  loadedBoneyard(): LoadedBoneyard | null
  state(): GameSimulationState
}

export type GameHostCloseReason = 'host-ended-session' | 'server-shutdown'

interface HostClient {
  acknowledgedSequence: number
  acknowledgedSnapshotSequence: number
  activeInput: PlayerCharacterInput
  connectedAtMs: number
  displayName: string
  forceReplicationKeyframe: boolean
  lastReceivedSequence: number
  lastSentSnapshotSequence: number
  playerId: PlayerId
  queuedInputs: Map<number, QueuedClientInput>
  pendingLuaRequestIds: Set<number>
  sentReplicationBaselines: Map<number, ReplicatedEntityBaseline>
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
  const resetWhenEmpty = options.resetWhenEmpty ?? false
  const snapshotRate = options.snapshotRate ?? 20
  const heartbeatIntervalMs = resolveGameHeartbeatInterval(options.heartbeatIntervalMs)
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
  if (!(snapshotRate >= 1 && snapshotRate <= GAME_TICK_RATE)) {
    throw new Error(`snapshotRate must be within 1..${GAME_TICK_RATE}`)
  }

  let state = createInitialSimulation(options.createSimulation)
  let gameplayPause: GameplayPauseState | null = null
  let nextPlayerId = 1
  let hostPlayerId: PlayerId | null = null
  let reservedHostClaimed = false
  let loadedBoneyard: LoadedBoneyard | null = null
  let nextSnapshotSequence = 1
  let nextLuaRunSeed: number | null = null
  let luaRuntime: WebLuaRuntime | null = null
  let luaRuntimeInitialization: Promise<WebLuaRuntime> | null = null
  let luaRuntimeGeneration = 0
  let closed = false
  let ticking = false
  let lastTickLagWarningAt = Number.NEGATIVE_INFINITY
  let nextTickAt = performance.now() + GAME_FIXED_TICK_SECONDS * 1000
  const clients = new Map<WebSocket, HostClient>()
  const pendingLuaEvents: WebLuaDerivedEvent[] = []
  const pending = new Set<WebSocket>()
  const disconnectCauses = new WeakMap<WebSocket, { reason: string; source: string }>()
  const logDetails = (details: Readonly<Record<string, unknown>> = {}) => ({
    ...options.logContext,
    ...details,
  })
  const server = createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({
        status: 'ok',
        tick: state.tick,
        players: clients.size,
        lua: luaRuntime?.metrics ?? null,
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
    perMessageDeflate: GAME_WEBSOCKET_COMPRESSION,
  })

  server.on('clientError', (error, socket) => {
    logGameServerEvent(
      options.log,
      'game-host',
      'warning',
      'http.client_error',
      'The game host received an invalid HTTP connection.',
      logDetails({ remoteAddress: socketRemoteAddress(socket), ...gameServerErrorDetails(error) }),
    )
    if (!socket.destroyed) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
  })
  websocketServer.on('error', (error) => {
    logGameServerEvent(
      options.log,
      'game-host',
      'error',
      'websocket.server_error',
      'The game host WebSocket server reported an error.',
      logDetails(gameServerErrorDetails(error)),
    )
  })

  server.on('upgrade', (request, socket, head) => {
    if (!isAllowedUpgrade(request, host, options.allowedOrigins ?? [])) {
      logGameServerEvent(
        options.log,
        'game-host',
        'warning',
        'connection.upgrade_rejected',
        'A game connection was rejected because its browser origin is not allowed.',
        logDetails({
          origin: request.headers.origin ?? 'none',
          path: request.url ?? 'none',
          remoteAddress: socketRemoteAddress(socket),
        }),
      )
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    if (request.url !== '/game') {
      logGameServerEvent(
        options.log,
        'game-host',
        'warning',
        'connection.upgrade_rejected',
        'A game connection requested an unknown WebSocket path.',
        logDetails({ path: request.url ?? 'none', remoteAddress: socketRemoteAddress(socket) }),
      )
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      websocketServer.emit('connection', websocket, request)
    })
  })

  websocketServer.on('connection', (socket, request) => {
    pending.add(socket)
    let released = false
    const stopHeartbeat = monitorWebSocketHeartbeat(socket, heartbeatIntervalMs, {
      onTimeout: () => {
        disconnectCauses.set(socket, {
          reason: 'connection timed out',
          source: 'heartbeat-timeout',
        })
        const client = clients.get(socket)
        logGameServerEvent(
          options.log,
          'game-host',
          'warning',
          'connection.heartbeat_timeout',
          'The game host stopped receiving transport heartbeat responses from a player.',
          logDetails({
            playerId: client?.playerId ?? 'pending',
            remoteAddress: request.socket.remoteAddress ?? 'unknown',
          }),
        )
      },
      timeoutReason: 'connection timed out',
    })
    logGameServerEvent(
      options.log,
      'game-host',
      'debug',
      'connection.opened',
      'A WebSocket connection reached the game host.',
      logDetails({ remoteAddress: request.socket.remoteAddress ?? 'unknown' }),
    )
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
        if (options.initialPlayerExperience) {
          state = grantGameSimulationPlayerExperience(
            state,
            playerId,
            options.initialPlayerExperience,
          )
        }
        if (role === 'host') {
          reservedHostClaimed = true
          hostPlayerId = playerId
        } else if (role === 'shared') {
          hostPlayerId ??= playerId
        } else if (reservedHostClaimed) {
          hostPlayerId ??= playerId
        }
        const welcomeSnapshot = createGameSnapshot(state, hostPlayerId)
        const snapshotSequence = nextSnapshotSequence
        nextSnapshotSequence += 1
        const welcomeBaseline = createReplicatedEntityBaseline(welcomeSnapshot)
        clients.set(socket, {
          acknowledgedSequence: 0,
          acknowledgedSnapshotSequence: snapshotSequence,
          activeInput: createIdlePlayerCharacterInput(),
          connectedAtMs: Date.now(),
          displayName: message.character.displayName,
          forceReplicationKeyframe: false,
          lastReceivedSequence: 0,
          lastSentSnapshotSequence: snapshotSequence,
          playerId,
          pendingLuaRequestIds: new Set(),
          queuedInputs: new Map(),
          sentReplicationBaselines: new Map([[snapshotSequence, welcomeBaseline]]),
          socket,
        })
        logGameServerEvent(
          options.log,
          'game-host',
          'info',
          'player.connected',
          'A player authenticated with the game host.',
          logDetails({
            displayName: message.character.displayName,
            playerId,
            playerCount: clients.size,
            role,
          }),
        )
        options.onPlayerCountChanged?.(clients.size)
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
          gameplayPause,
          snapshot: welcomeSnapshot,
          snapshotSequence,
        }))
        if (loadedBoneyard) {
          socket.send(encodeGameMessage({
            type: 'server-boneyard-loaded',
            boneyard: loadedBoneyard,
          }))
        }
        if (gameplayPause) broadcastSnapshot()
        return
      }

      if (message.type === 'client-gameplay-pause') {
        if (message.paused) {
          if (
            gameplayPause
            || state.levelUpBarrier !== null
            || (state.run.phase !== 'hub' && state.run.phase !== 'active')
          ) return
          gameplayPause = {
            ownerDisplayName: client.displayName,
            ownerPlayerId: client.playerId,
          }
          stopAllClientInputs()
          resetNextTickDeadline()
          broadcastGameplayPause()
          logGameServerEvent(
            options.log,
            'game-host',
            'info',
            'gameplay.paused',
            'A player paused the authoritative gameplay world.',
            logDetails({
              displayName: client.displayName,
              playerId: client.playerId,
              serverTick: state.tick,
            }),
          )
          return
        }
        if (gameplayPause?.ownerPlayerId !== client.playerId) return
        releaseGameplayPause('owner-resumed')
        return
      }

      if (message.type === 'client-input') {
        if (message.sequence <= client.lastReceivedSequence) return
        if (
          gameplayPause !== null
          || state.levelUpBarrier !== null
          || getPlayerProgression(state, client.playerId).pendingOffer
        ) {
          client.lastReceivedSequence = message.sequence
          client.acknowledgedSequence = message.sequence
          client.activeInput = createIdlePlayerCharacterInput()
          client.queuedInputs.clear()
          broadcastSnapshot()
          return
        }
        if (message.targetTick > state.tick + GAME_TICK_RATE * 2) {
          disconnect(socket, 'invalid-message', 'Input targets too far ahead of the server tick.')
          return
        }
        const pendingTail = newestQueuedInput(client.queuedInputs)
        const castTransition = !sameCast(
          pendingTail?.input ?? client.activeInput,
          message.input,
        )
        const targetTick = Math.max(
          state.tick + 1,
          message.targetTick,
          pendingTail
            ? pendingTail.targetTick + Number(castTransition)
            : state.tick + 1,
        )
        if (targetTick > state.tick + GAME_TICK_RATE * 2) {
          disconnect(socket, 'invalid-message', 'Input queue extends too far ahead of the server tick.')
          return
        }
        client.lastReceivedSequence = message.sequence
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
      if (message.type === 'client-select-skill') {
        const barrierBefore = state.levelUpBarrier
        const selected = selectGameSimulationPlayerSkill(state, client.playerId, message)
        if (!selected) {
          disconnect(socket, 'invalid-message', 'The skill choice is stale or not in this offer.')
          return
        }
        state = selected
        client.activeInput = createIdlePlayerCharacterInput()
        client.queuedInputs.clear()
        if (barrierBefore !== null && state.levelUpBarrier === null) stopAllClientInputs()
        broadcastSnapshot()
        return
      }
      if (message.type === 'client-level-up-action') {
        const barrierBefore = state.levelUpBarrier
        const applied = message.action === 'reroll'
          ? rerollGameSimulationPlayerSkill(state, client.playerId, message.offerSequence)
          : saveGameSimulationPlayerSkill(state, client.playerId, message.offerSequence)
        if (!applied) {
          disconnect(socket, 'invalid-message', 'The level-up action is stale or unavailable.')
          return
        }
        state = applied
        client.activeInput = createIdlePlayerCharacterInput()
        client.queuedInputs.clear()
        if (barrierBefore !== null && state.levelUpBarrier === null) stopAllClientInputs()
        broadcastSnapshot()
        return
      }
      if (message.type === 'client-hub-action') {
        if (gameplayPause !== null) return
        const applied = applyGameSimulationHubAction(state, client.playerId, message.action)
        state = applied.state
        client.activeInput = createIdlePlayerCharacterInput()
        client.queuedInputs.clear()
        broadcastSnapshot()
        return
      }
      if (message.type === 'client-lua-execute') {
        const sendLuaResult = (
          result: Readonly<{
            error: string | null
            ok: boolean
            output: readonly string[]
            values: readonly import('../protocol/game-protocol.ts').LuaConsoleValue[]
          }>,
        ) => {
          if (socket.readyState !== WebSocket.OPEN) return
          socket.send(encodeGameMessage({
            type: 'server-lua-result',
            requestId: message.requestId,
            ...result,
          }))
        }
        if (client.playerId !== hostPlayerId) {
          sendLuaResult({
            error: 'Only the current session host may execute authoritative Lua.',
            ok: false,
            output: [],
            values: [],
          })
          return
        }
        if (gameplayPause !== null) {
          sendLuaResult({
            error: 'Lua execution is unavailable while gameplay is paused.',
            ok: false,
            output: [],
            values: [],
          })
          return
        }
        if (client.pendingLuaRequestIds.has(message.requestId)) {
          disconnect(socket, 'invalid-message', 'Lua request ID is already pending.')
          return
        }
        if (client.pendingLuaRequestIds.size >= WEB_LUA_MAX_PENDING_EXECUTIONS) {
          sendLuaResult({
            error: 'Too many Lua executions are pending.',
            ok: false,
            output: [],
            values: [],
          })
          return
        }
        client.pendingLuaRequestIds.add(message.requestId)
        const completeRequest = (result: Parameters<typeof sendLuaResult>[0]) => {
          client.pendingLuaRequestIds.delete(message.requestId)
          sendLuaResult(result)
        }
        void ensureLuaRuntime().then((runtime) => {
          if (closed || !clients.has(socket)) {
            completeRequest({
              error: 'The game session closed before Lua initialized.',
              ok: false,
              output: [],
              values: [],
            })
            return
          }
          if (!runtime.enqueueExecution({
            code: message.code,
            playerId: client.playerId,
            respond: completeRequest,
          })) {
            completeRequest({
              error: 'The Lua execution queue is full or the code is invalid.',
              ok: false,
              output: [],
              values: [],
            })
          }
        }).catch((error: unknown) => {
          completeRequest({
            error: error instanceof Error ? error.message : 'Lua initialization failed.',
            ok: false,
            output: [],
            values: [],
          })
        })
        return
      }
      if (message.type === 'client-ping') {
        socket.send(encodeGameMessage({ type: 'server-pong', nonce: message.nonce }))
        return
      }
      if (message.type === 'client-snapshot-ack') {
        if (message.sequence > client.lastSentSnapshotSequence) {
          disconnect(socket, 'invalid-message', 'Snapshot acknowledgement is ahead of the server.')
          return
        }
        if (message.requireKeyframe) client.forceReplicationKeyframe = true
        if (message.sequence <= client.acknowledgedSnapshotSequence) return
        if (!client.sentReplicationBaselines.has(message.sequence)) {
          client.forceReplicationKeyframe = true
          logGameServerEvent(
            options.log,
            'game-host',
            'warning',
            'replication.baseline_missing',
            'A player acknowledged a replication baseline the host no longer has.',
            logDetails({
              acknowledgedSequence: message.sequence,
              playerId: client.playerId,
              lastSentSequence: client.lastSentSnapshotSequence,
            }),
          )
          return
        }
        client.acknowledgedSnapshotSequence = message.sequence
        pruneReplicationBaselines(client)
        return
      }
      if (message.type === 'client-start-match') {
        if (
          client.playerId !== hostPlayerId
          || loadedBoneyard
          || gameplayPause !== null
          || state.levelUpBarrier !== null
          || state.run.phase !== 'hub'
        ) return
        const selected = materializeBoneyard(
          boneyards,
          message.boneyardId,
          consumeBoneyardSeed(),
        )
        if (!selected) {
          disconnect(socket, 'invalid-message', 'The selected Boneyard is unavailable.')
          return
        }
        loadedBoneyard = selected
        const previousState = state
        state = enterBoneyardWorld(state, selected)
        if (luaRuntime !== null) {
          pendingLuaEvents.push(...deriveWebLuaEvents(
            previousState,
            state,
            (name) => luaRuntime!.wantsEvent(name),
          ))
        }
        broadcast({ type: 'server-boneyard-loaded', boneyard: selected })
        broadcastSnapshot()
        return
      }
      if (message.type === 'client-confirm-loadout') {
        if (client.playerId !== hostPlayerId) return
        const confirmed = confirmGameSimulationLoadout(state)
        if (!confirmed) return
        state = confirmed
        broadcastSnapshot()
        return
      }
      if (message.type === 'client-disconnect') {
        disconnectCauses.set(socket, {
          reason: 'client requested disconnect',
          source: 'client-request',
        })
        socket.close(1000, 'client disconnect')
      }
      else disconnect(socket, 'invalid-message', 'The client has already joined.')
    })

    const release = (
      closeCode: number | null,
      closeReason: string,
      socketError?: Error,
    ) => {
      if (released) return
      released = true
      clearTimeout(helloDeadline)
      stopHeartbeat()
      pending.delete(socket)
      const client = clients.get(socket)
      const planned = disconnectCauses.get(socket)
      if (!client) {
        logGameServerEvent(
          options.log,
          'game-host',
          closeCode === 1000 ? 'info' : 'warning',
          'connection.closed_before_authentication',
          'A game connection closed before a player authenticated.',
          logDetails({
            closeCode,
            closeReason,
            disconnectSource: planned?.source ?? disconnectSource(closeCode),
            ...(socketError ? gameServerErrorDetails(socketError) : {}),
          }),
        )
        return
      }
      clients.delete(socket)
      const releasedGameplayPause = gameplayPause?.ownerPlayerId === client.playerId
      state = removePlayerCharacter(state, client.playerId)
      if (clients.size === 0) {
        hostPlayerId = null
        resetLuaRuntime()
        if (resetWhenEmpty) {
          state = createInitialSimulation(options.createSimulation)
          nextPlayerId = 1
          reservedHostClaimed = false
          loadedBoneyard = null
          nextSnapshotSequence = 1
          gameplayPause = null
          resetNextTickDeadline()
        }
      } else if (client.playerId === hostPlayerId) {
        hostPlayerId = clients.values().next().value?.playerId ?? null
      }
      options.onPlayerCountChanged?.(clients.size)
      const source = planned?.source ?? disconnectSource(closeCode)
      logGameServerEvent(
        options.log,
        'game-host',
        source === 'client-request' || (source === 'client-close' && closeCode === 1000)
          ? 'info'
          : 'warning',
        'player.disconnected',
        'A player disconnected from the game host.',
        logDetails({
          closeCode,
          closeReason,
          disconnectReason: planned?.reason || closeReason || 'no reason received',
          disconnectSource: source,
          displayName: client.displayName,
          durationMs: Math.max(0, Date.now() - client.connectedAtMs),
          lastInputSequence: client.lastReceivedSequence,
          playerCount: clients.size,
          playerId: client.playerId,
          serverTick: state.tick,
          ...(socketError ? gameServerErrorDetails(socketError) : {}),
        }),
      )
      if (releasedGameplayPause) releaseGameplayPause('owner-disconnected')
      else broadcastSnapshot()
    }
    socket.once('close', (code, reason) => release(code, reason.toString()))
    socket.once('error', (error) => release(null, '', error))
  })

  const ticksPerSnapshot = Math.max(1, Math.round(GAME_TICK_RATE / snapshotRate))
  const timer = setInterval(() => {
    if (closed || ticking) return
    if (resetWhenEmpty && clients.size === 0) {
      resetNextTickDeadline()
      return
    }
    if (gameplayPause !== null) {
      resetNextTickDeadline()
      return
    }
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
        const previousTick = state.tick
        const previousBarrierId = state.levelUpBarrier?.barrierId ?? null
        const previousRunPhase = state.run.phase
        const previousGameOverExitTicks = state.run.gameOverExitTicks
        const stateBeforeLua = state
        let enemySpawnIntents = [] as import('../core-kernels/boneyard-wave-director.ts').BoneyardEnemySpawnIntent[]
        if (luaRuntime !== null) {
          luaRuntime.beginTick(nextTick)
          const applied = applyWebLuaCommands(state, luaRuntime.drainCommands())
          state = applied.state
          enemySpawnIntents = [...applied.enemySpawnIntents]
          if (applied.nextRunSeed !== null) nextLuaRunSeed = applied.nextRunSeed
        }
        state = stepGameSimulationTick(state, inputs, { enemySpawnIntents })
        if (luaRuntime !== null) {
          const events = [
            ...pendingLuaEvents.splice(0),
            ...deriveWebLuaEvents(
              stateBeforeLua,
              state,
              (name) => luaRuntime!.wantsEvent(name),
            ),
          ]
          for (const event of events) {
            luaRuntime.dispatch(event.name, event.payload)
          }
        }
        const barrierId = state.levelUpBarrier?.barrierId ?? null
        const reachedGameOverBlack = state.run.phase === 'game-over'
          && state.run.gameOverExitTicks === BONEYARD_GAME_OVER_EXIT_FADE_TICKS
          && previousGameOverExitTicks !== BONEYARD_GAME_OVER_EXIT_FADE_TICKS
        const enteredGameOver = previousRunPhase === 'active'
          && state.run.phase === 'game-over'
        const completedGameOver = previousRunPhase === 'game-over'
          && state.run.phase === 'loadout'
        if (completedGameOver) loadedBoneyard = null
        if (enteredGameOver || completedGameOver) stopAllClientInputs()
        if (previousBarrierId === null && barrierId !== null) stopAllClientInputs()
        nextTickAt += GAME_FIXED_TICK_SECONDS * 1000
        steps += 1
        if (
          previousBarrierId !== barrierId
          || enteredGameOver
          || reachedGameOverBlack
          || completedGameOver
          || (state.tick !== previousTick && state.tick % ticksPerSnapshot === 0)
        ) broadcastSnapshot()
      }
      if (steps === 25 && now >= nextTickAt) {
        if (now - lastTickLagWarningAt >= 10_000) {
          lastTickLagWarningAt = now
          logGameServerEvent(
            options.log,
            'game-host',
            'warning',
            'simulation.tick_lag',
            'The authoritative simulation fell behind and dropped accumulated wall-clock time.',
            logDetails({
              behindMs: Math.max(0, Math.round(now - nextTickAt)),
              playerCount: clients.size,
              serverTick: state.tick,
            }),
          )
        }
        nextTickAt = now + GAME_FIXED_TICK_SECONDS * 1000
      }
    } catch (error) {
      logGameServerEvent(
        options.log,
        'game-host',
        'error',
        'simulation.tick_failed',
        'The authoritative simulation tick failed.',
        logDetails({ playerCount: clients.size, serverTick: state.tick, ...gameServerErrorDetails(error) }),
      )
      for (const socket of clients.keys()) {
        disconnectCauses.set(socket, {
          reason: 'authoritative simulation failure',
          source: 'server-error',
        })
        socket.close(1011, 'server error')
      }
      throw error
    } finally {
      ticking = false
    }
  }, 2)

  function broadcastSnapshot(): void {
    const snapshot = createGameSnapshot(state, hostPlayerId)
    const snapshotSequence = nextSnapshotSequence
    nextSnapshotSequence += 1
    const currentBaseline = createReplicatedEntityBaseline(snapshot)
    const periodicKeyframe = snapshotSequence % Math.max(1, snapshotRate * 5) === 0
    for (const client of clients.values()) {
      if (client.socket.readyState !== WebSocket.OPEN) continue
      const acknowledgedBaseline = client.sentReplicationBaselines.get(
        client.acknowledgedSnapshotSequence,
      )
      const forceKeyframe = periodicKeyframe
        || client.forceReplicationKeyframe
        || !acknowledgedBaseline
      client.socket.send(encodeGameMessage({
        type: 'server-snapshot',
        acknowledgedInputSequence: client.acknowledgedSequence,
        frame: createGameSnapshotFrame(
          snapshot,
          client.acknowledgedSnapshotSequence,
          acknowledgedBaseline,
          forceKeyframe,
        ),
        sequence: snapshotSequence,
      }))
      client.forceReplicationKeyframe = false
      client.lastSentSnapshotSequence = snapshotSequence
      client.sentReplicationBaselines.set(snapshotSequence, currentBaseline)
      pruneReplicationBaselines(client)
    }
  }

  function stopAllClientInputs(): void {
    for (const client of clients.values()) {
      client.activeInput = createIdlePlayerCharacterInput()
      client.queuedInputs.clear()
    }
  }

  function resetNextTickDeadline(): void {
    nextTickAt = performance.now() + GAME_FIXED_TICK_SECONDS * 1000
  }

  function broadcastGameplayPause(): void {
    broadcast({ type: 'server-gameplay-pause', pause: gameplayPause })
  }

  function releaseGameplayPause(source: 'owner-disconnected' | 'owner-resumed'): void {
    if (!gameplayPause) return
    const released = gameplayPause
    gameplayPause = null
    stopAllClientInputs()
    resetNextTickDeadline()
    broadcastGameplayPause()
    broadcastSnapshot()
    logGameServerEvent(
      options.log,
      'game-host',
      'info',
      'gameplay.resumed',
      'The authoritative gameplay world resumed.',
      logDetails({
        displayName: released.ownerDisplayName,
        playerId: released.ownerPlayerId,
        serverTick: state.tick,
        source,
      }),
    )
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
    disconnectCauses.set(socket, {
      reason,
      source: `server-${code}`,
    })
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
  logGameServerEvent(
    options.log,
    'game-host',
    'info',
    'host.listening',
    'The authoritative game host is listening.',
    logDetails({ host, port: address.port, snapshotRate }),
  )

  return {
    address: {
      host,
      port: address.port,
      url: `ws://${formatHost(host)}:${address.port}/game`,
    },
    async close(reason: GameHostCloseReason = 'server-shutdown') {
      if (closed) return
      closed = true
      clearInterval(timer)
      resetLuaRuntime()
      const closeCode = reason === 'host-ended-session'
        ? GAME_HOST_ENDED_SESSION_CLOSE_CODE
        : 1012
      const closeReason = reason === 'host-ended-session'
        ? 'host ended session'
        : 'server shutdown'
      for (const socket of [...pending, ...clients.keys()]) {
        disconnectCauses.set(socket, {
          reason: closeReason,
          source: reason,
        })
        socket.close(closeCode, closeReason)
      }
      websocketServer.close()
      await closeHttpServer(server)
      logGameServerEvent(
        options.log,
        'game-host',
        'info',
        'host.closed',
        'The authoritative game host stopped.',
        logDetails({ reason }),
      )
    },
    hostPlayerId: () => hostPlayerId,
    playerCount: () => clients.size,
    loadedBoneyard: () => loadedBoneyard,
    state: () => state,
  }

  async function ensureLuaRuntime(): Promise<WebLuaRuntime> {
    if (luaRuntime !== null) return luaRuntime
    if (!options.luaWasmPath) throw new Error('Lua runtime is not configured for this game host.')
    if (luaRuntimeInitialization !== null) return luaRuntimeInitialization
    const generation = luaRuntimeGeneration
    let initialization: Promise<WebLuaRuntime>
    initialization = WebLuaRuntime.create({
      bindings: {
        getAuthorityPlayerId: () => hostPlayerId,
        getFrame: () => createWebLuaFrameState(state, hostPlayerId, loadedBoneyard),
      },
      log: (level, event, detail) => logGameServerEvent(
        options.log,
        'game-host',
        level,
        event,
        detail,
        logDetails({ playerCount: clients.size, serverTick: state.tick }),
      ),
      wasmPath: options.luaWasmPath,
    }).then((runtime) => {
      if (closed || generation !== luaRuntimeGeneration) {
        runtime.close()
        throw new Error('Lua runtime initialization was superseded.')
      }
      luaRuntime = runtime
      if (luaRuntimeInitialization === initialization) luaRuntimeInitialization = null
      logGameServerEvent(
        options.log,
        'game-host',
        'info',
        'lua.initialized',
        'The authoritative web Lua runtime initialized.',
        logDetails({ ...runtime.metrics, playerCount: clients.size, serverTick: state.tick }),
      )
      return runtime
    }, (error) => {
      if (luaRuntimeInitialization === initialization) luaRuntimeInitialization = null
      throw error
    })
    luaRuntimeInitialization = initialization
    return initialization
  }

  function resetLuaRuntime(): void {
    luaRuntimeGeneration += 1
    luaRuntime?.close()
    luaRuntime = null
    pendingLuaEvents.length = 0
    const initializing = luaRuntimeInitialization
    luaRuntimeInitialization = null
    if (initializing) void initializing.then((runtime) => runtime.close(), () => {})
    nextLuaRunSeed = null
  }

  function consumeBoneyardSeed(): Buffer | undefined {
    if (nextLuaRunSeed === null) return options.createBoneyardSeedBytes?.()
    const bytes = Buffer.alloc(16)
    bytes.writeUInt32BE(nextLuaRunSeed)
    nextLuaRunSeed = null
    return bytes
  }
}

function disconnectSource(closeCode: number | null): string {
  if (closeCode === 1000) return 'client-close'
  if (closeCode === 1001) return 'peer-going-away'
  if (closeCode === 1006 || closeCode === null) return 'transport-lost'
  return 'transport-close'
}

function socketRemoteAddress(socket: Duplex): string {
  if ('remoteAddress' in socket && typeof socket.remoteAddress === 'string') {
    return socket.remoteAddress
  }
  return 'unknown'
}

function createInitialSimulation(
  factory: (() => GameSimulationState) | undefined,
): GameSimulationState {
  const state = factory?.() ?? createGameSimulation({})
  if (state.world.kind !== 'hub') {
    throw new Error('Game hosts must start in the Hub')
  }
  if (state.playerEntities.entityIds.length !== 0) {
    throw new Error('Game hosts must start without player characters')
  }
  if (Object.keys(state.world.participants).length !== 0) {
    throw new Error('Game hosts must start without Hub participants')
  }
  return state
}

function pruneReplicationBaselines(client: HostClient): void {
  for (const sequence of client.sentReplicationBaselines.keys()) {
    if (sequence < client.acknowledgedSnapshotSequence) {
      client.sentReplicationBaselines.delete(sequence)
    }
  }
  while (client.sentReplicationBaselines.size > 64) {
    const sequence = [...client.sentReplicationBaselines.keys()].find(
      (candidate) => candidate !== client.acknowledgedSnapshotSequence,
    )
    if (sequence === undefined) break
    client.sentReplicationBaselines.delete(sequence)
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

function newestQueuedInput(
  queuedInputs: ReadonlyMap<number, QueuedClientInput>,
): QueuedClientInput | undefined {
  let newest: QueuedClientInput | undefined
  for (const input of queuedInputs.values()) {
    if (
      !newest
      || input.targetTick > newest.targetTick
      || (input.targetTick === newest.targetTick && input.sequence > newest.sequence)
    ) newest = input
  }
  return newest
}

function sameCast(first: PlayerCharacterInput, second: PlayerCharacterInput): boolean {
  return first.cast.primary === second.cast.primary
    && first.cast.secondary === second.cast.secondary
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

import {
  HUB_INPUT_ACCELERATION,
  HUB_MOVEMENT_LANE_CAP,
  HUB_MOVEMENT_RETENTION,
  HUB_MOVEMENT_TICK_SECONDS,
  HUB_PLAYER_RADIUS,
  type HubPoint,
} from '../core-kernels/hub-math.ts'
import { predictHubPlayerTick } from '../core-kernels/hub-player.ts'
import {
  GAME_PROTOCOL_VERSION,
  HUB_KERNEL_VERSION,
  GameProtocolError,
  decodeServerGameMessage,
  encodeGameMessage,
  type HubSnapshot,
  type ServerWelcomeMessage,
} from '../protocol/game-protocol.ts'
import type { GameTransport } from './game-transport.ts'

export interface GameClientSessionOptions {
  credential: string
  displayName?: string
  onFatal?: (error: Error) => void
  resumeToken?: string
  transport: GameTransport
}

export interface GameClientSession {
  readonly playerId: string
  readonly resumeToken: string
  destroy(): void
  getSnapshot(): HubSnapshot
  onSnapshot(listener: (snapshot: HubSnapshot) => void): () => void
  sendInput(input: HubPoint): void
}

export type GameSessionConnector = (
  options: GameClientSessionOptions,
) => Promise<GameClientSession>

export function connectGameClientSession(
  options: GameClientSessionOptions,
): Promise<GameClientSession> {
  return new Promise((resolve, reject) => {
    let settled = false
    let destroyed = false
    let welcome: ServerWelcomeMessage | undefined
    let snapshot: HubSnapshot | undefined
    let sequence = 0
    let predictionEnabled = false
    let fatalReported = false
    const snapshotListeners = new Set<(snapshot: HubSnapshot) => void>()
    let pendingInputs: Array<{ input: HubPoint; sequence: number; targetTick: number }> = []
    const handshakeDeadline = globalThis.setTimeout(() => {
      fail(new Error('The game server handshake timed out.'))
    }, 5000)
    const removeMessage = options.transport.onMessage((payload) => {
      let message
      try {
        message = decodeServerGameMessage(payload)
      } catch (error) {
        fail(error instanceof GameProtocolError ? error : new Error('Invalid server message'))
        return
      }
      if (message.type === 'server-disconnect') {
        fail(new Error(message.reason))
        return
      }
      if (message.type === 'server-welcome') {
        if (settled || message.protocolVersion !== GAME_PROTOCOL_VERSION) {
          fail(new Error('The server selected an incompatible protocol.'))
          return
        }
        welcome = message
        snapshot = message.snapshot
        if (!snapshot.players[message.playerId]) {
          fail(new Error('The server welcome snapshot does not contain the assigned player.'))
          return
        }
        predictionEnabled = supportsLocalPrediction(message)
        settled = true
        globalThis.clearTimeout(handshakeDeadline)
        resolve(session)
        return
      }
      if (!welcome || !snapshot) {
        fail(new Error('The server sent a snapshot before welcoming the client.'))
        return
      }
      pendingInputs = pendingInputs.filter(
        (entry) => entry.sequence > message.acknowledgedInputSequence,
      )
      snapshot = predictionEnabled
        ? predictLocalPlayer(message.snapshot, welcome.playerId, pendingInputs)
        : message.snapshot
      for (const listener of snapshotListeners) listener(snapshot)
    })
    const removeClose = options.transport.onClose((reason) => {
      if (!destroyed) fail(new Error(reason))
    })

    const session: GameClientSession = {
      get playerId() {
        if (!welcome) throw new Error('game session has not been welcomed')
        return welcome.playerId
      },
      get resumeToken() {
        if (!welcome) throw new Error('game session has not been welcomed')
        return welcome.resumeToken
      },
      destroy() {
        if (destroyed) return
        destroyed = true
        globalThis.clearTimeout(handshakeDeadline)
        removeClose()
        removeMessage()
        if (options.transport.readyState === 'open') {
          options.transport.send(encodeGameMessage({ type: 'client-disconnect' }))
        }
        options.transport.close(1000, 'session destroyed')
        snapshotListeners.clear()
      },
      getSnapshot() {
        if (!snapshot) throw new Error('game session has no snapshot')
        return snapshot
      },
      onSnapshot(listener) {
        snapshotListeners.add(listener)
        return () => snapshotListeners.delete(listener)
      },
      sendInput(nextInput) {
        if (!welcome || !snapshot || destroyed) return
        if (!Number.isFinite(nextInput.x) || !Number.isFinite(nextInput.y)) {
          throw new Error('game input must contain finite coordinates')
        }
        const length = Math.hypot(nextInput.x, nextInput.y)
        const input = length > 1
          ? { x: nextInput.x / length, y: nextInput.y / length }
          : { ...nextInput }
        sequence += 1
        const targetTick = snapshot.tick + 1
        const pendingAtTick = pendingInputs.findIndex((entry) => entry.targetTick === targetTick)
        const pending = { input, sequence, targetTick }
        if (pendingAtTick < 0) pendingInputs.push(pending)
        else pendingInputs[pendingAtTick] = pending
        options.transport.send(encodeGameMessage({
          type: 'client-input',
          input,
          sequence,
          targetTick,
        }))
      },
    }

    options.transport.send(encodeGameMessage({
      type: 'client-hello',
      protocolVersion: GAME_PROTOCOL_VERSION,
      credential: options.credential,
      ...(options.displayName ? { displayName: options.displayName } : {}),
      ...(options.resumeToken ? { resumeToken: options.resumeToken } : {}),
    }))

    function fail(error: Error): void {
      if (!settled) {
        settled = true
        destroyed = true
        globalThis.clearTimeout(handshakeDeadline)
        removeClose()
        removeMessage()
        options.transport.close(1008, error.message.slice(0, 123))
        reject(error)
        return
      }
      if (destroyed || fatalReported) return
      fatalReported = true
      destroyed = true
      globalThis.clearTimeout(handshakeDeadline)
      removeClose()
      removeMessage()
      options.transport.close(1008, error.message.slice(0, 123))
      snapshotListeners.clear()
      options.onFatal?.(error)
    }
  })
}

function predictLocalPlayer(
  source: HubSnapshot,
  playerId: string,
  inputs: readonly { input: HubPoint; sequence: number; targetTick: number }[],
): HubSnapshot {
  const authoritative = source.players[playerId]
  if (!authoritative || inputs.length === 0) return source
  let player = authoritative
  let collisionRngState = source.collisionRngState
  for (const pending of inputs) {
    const predicted = predictHubPlayerTick(
      player,
      pending.input,
      HUB_PLAYER_RADIUS,
      collisionRngState,
    )
    player = predicted.player
    collisionRngState = predicted.collisionRngState
  }
  return {
    ...source,
    collisionRngState,
    players: { ...source.players, [playerId]: player },
  }
}

function supportsLocalPrediction(welcome: ServerWelcomeMessage): boolean {
  const parameters = welcome.kernelParameters
  return welcome.kernelVersion === HUB_KERNEL_VERSION
    && parameters.fixedTickSeconds === HUB_MOVEMENT_TICK_SECONDS
    && parameters.movementAcceleration === HUB_INPUT_ACCELERATION
    && parameters.movementLaneCap === HUB_MOVEMENT_LANE_CAP
    && parameters.movementRetention === HUB_MOVEMENT_RETENTION
    && parameters.playerRadius === HUB_PLAYER_RADIUS
}

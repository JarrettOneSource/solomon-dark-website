import {
  PLAYER_CHARACTER_INPUT_ACCELERATION,
  PLAYER_CHARACTER_MOVEMENT_LANE_CAP,
  PLAYER_CHARACTER_MOVEMENT_RETENTION,
  PLAYER_CHARACTER_MOVEMENT_THRESHOLD_SQUARED,
  PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
  PLAYER_CHARACTER_RADIUS,
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import {
  GAME_PROTOCOL_VERSION,
  PLAYER_CHARACTER_KERNEL_VERSION,
  GameProtocolError,
  decodeServerGameMessage,
  encodeGameMessage,
  type BoneyardChoice,
  type GameSnapshot,
  type LoadedBoneyard,
  type ServerWelcomeMessage,
} from '../protocol/game-protocol.ts'
import type { GameTransport } from './game-transport.ts'
import {
  createHubPresentationTimeline,
  isHubGameSnapshot,
  type HubPresentationFrame,
  type HubPresentationTimeline,
} from './hub-presentation-timeline.ts'
import { predictPlayerCharacterInHub } from './hub-prediction.ts'

export interface GameClientSessionOptions {
  character: PlayerCharacterConfig
  credential: string
  now?: () => number
  onFatal?: (error: Error) => void
  resumeToken?: string
  transport: GameTransport
}

export interface GameClientSession {
  readonly boneyards: readonly BoneyardChoice[]
  readonly isHost: boolean
  readonly playerId: string
  readonly resumeToken: string
  destroy(): void
  getBoneyard(): LoadedBoneyard | null
  getSnapshot(): GameSnapshot
  onBoneyard(listener: (boneyard: LoadedBoneyard) => void): () => void
  onSnapshot(listener: (snapshot: GameSnapshot) => void): () => void
  samplePresentation(nowMs?: number): HubPresentationFrame
  sendInput(input: PlayerCharacterInput): void
  startMatch(boneyardId: string): void
}

export type GameSessionConnector = (
  options: GameClientSessionOptions,
) => Promise<GameClientSession>

interface PendingInput {
  input: PlayerCharacterInput
  sequence: number
  targetTick: number
}

const STOPPED_INPUT: PlayerCharacterInput = { movement: { x: 0, y: 0 } }

export function connectGameClientSession(
  options: GameClientSessionOptions,
): Promise<GameClientSession> {
  return new Promise((resolve, reject) => {
    let settled = false
    let destroyed = false
    let welcome: ServerWelcomeMessage | undefined
    let snapshot: GameSnapshot | undefined
    let presentationTimeline: HubPresentationTimeline | undefined
    let loadedBoneyard: LoadedBoneyard | null = null
    let lastSnapshotReceivedAtMs = 0
    let sequence = 0
    let predictionEnabled = false
    let fatalReported = false
    let currentInput = copyInput(STOPPED_INPUT)
    let sentInput = copyInput(STOPPED_INPUT)
    const now = options.now ?? (() => performance.now())
    const snapshotListeners = new Set<(snapshot: GameSnapshot) => void>()
    const boneyardListeners = new Set<(boneyard: LoadedBoneyard) => void>()
    let pendingInputs: PendingInput[] = []
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
        lastSnapshotReceivedAtMs = now()
        if (isHubGameSnapshot(snapshot)) {
          presentationTimeline = createPresentationTimeline(
            snapshot,
            lastSnapshotReceivedAtMs,
            message,
          )
        }
        settled = true
        globalThis.clearTimeout(handshakeDeadline)
        resolve(session)
        return
      }
      if (!welcome || !snapshot) {
        fail(new Error('The server sent game state before welcoming the client.'))
        return
      }
      if (message.type === 'server-boneyard-loaded') {
        loadedBoneyard = message.boneyard
        for (const listener of boneyardListeners) listener(message.boneyard)
        return
      }
      pendingInputs = pendingInputs.filter(
        (entry) => entry.sequence > message.acknowledgedInputSequence,
      )
      const previousWorldKind = snapshot.world.kind
      snapshot = predictionEnabled && message.snapshot.world.kind === 'hub'
        ? predictLocalPlayer(message.snapshot, welcome.playerId, pendingInputs)
        : message.snapshot
      lastSnapshotReceivedAtMs = now()
      if (isHubGameSnapshot(snapshot)) {
        if (!presentationTimeline || previousWorldKind !== 'hub') {
          presentationTimeline = createPresentationTimeline(
            snapshot,
            lastSnapshotReceivedAtMs,
            welcome,
          )
        } else {
          presentationTimeline.push(snapshot, lastSnapshotReceivedAtMs)
        }
      }
      for (const listener of snapshotListeners) listener(snapshot)
    })
    const removeClose = options.transport.onClose((reason) => {
      if (!destroyed) fail(new Error(reason))
    })

    const session: GameClientSession = {
      get boneyards() {
        if (!welcome) throw new Error('game session has not been welcomed')
        return welcome.boneyards
      },
      get isHost() {
        return !!welcome && snapshot?.hostPlayerId === welcome.playerId
      },
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
        boneyardListeners.clear()
      },
      getBoneyard() {
        return loadedBoneyard
      },
      getSnapshot() {
        if (!snapshot) throw new Error('game session has no snapshot')
        return snapshot
      },
      onSnapshot(listener) {
        snapshotListeners.add(listener)
        return () => snapshotListeners.delete(listener)
      },
      onBoneyard(listener) {
        boneyardListeners.add(listener)
        return () => boneyardListeners.delete(listener)
      },
      samplePresentation(requestedNow = now()) {
        if (!welcome || !snapshot || !presentationTimeline) {
          throw new Error('game session has no Hub presentation timeline')
        }
        const frame = presentationTimeline.sample(requestedNow)
        if (!predictionEnabled || !isHubGameSnapshot(snapshot)) return frame
        const sourcePlayer = snapshot.players[welcome.playerId]
        if (!sourcePlayer) return frame
        const maximumTicks = Math.max(
          1,
          Math.ceil(welcome.serverTickRate / welcome.snapshotRate),
        )
        const elapsedTicks = Math.min(
          maximumTicks,
          Math.max(0, Math.floor(
            (requestedNow - lastSnapshotReceivedAtMs) * welcome.serverTickRate / 1000,
          )),
        )
        let player = sourcePlayer
        let collisionRngState = snapshot.world.collisionRngState
        for (let tick = 0; tick < elapsedTicks; tick += 1) {
          const predicted = predictPlayerCharacterInHub(
            player,
            currentInput,
            collisionRngState,
          )
          player = predicted.player
          collisionRngState = predicted.collisionRngState
        }
        return {
          ...frame,
          players: { ...frame.players, [welcome.playerId]: player },
          world: { ...frame.world, collisionRngState },
        }
      },
      sendInput(nextInput) {
        if (!welcome || !snapshot || destroyed) return
        const movement = nextInput.movement
        if (!Number.isFinite(movement.x) || !Number.isFinite(movement.y)) {
          throw new Error('game input must contain finite movement coordinates')
        }
        const length = Math.hypot(movement.x, movement.y)
        const input: PlayerCharacterInput = {
          movement: length > 1
            ? { x: movement.x / length, y: movement.y / length }
            : { ...movement },
        }
        currentInput = input
        if (sameInput(input, sentInput)) return
        sentInput = copyInput(input)
        sequence += 1
        const targetTick = snapshot.tick + 1
        const pendingAtTick = pendingInputs.findIndex(
          (entry) => entry.targetTick === targetTick,
        )
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
      startMatch(boneyardId) {
        if (!welcome || destroyed) return
        if (!welcome.boneyards.some((choice) => choice.id === boneyardId)) {
          throw new Error(`Unknown Boneyard: ${boneyardId}`)
        }
        options.transport.send(encodeGameMessage({
          type: 'client-start-match',
          boneyardId,
        }))
      },
    }

    options.transport.send(encodeGameMessage({
      type: 'client-hello',
      protocolVersion: GAME_PROTOCOL_VERSION,
      credential: options.credential,
      character: options.character,
      ...(options.resumeToken ? { resumeToken: options.resumeToken } : {}),
    }))

    function createPresentationTimeline(
      hubSnapshot: Parameters<typeof createHubPresentationTimeline>[0]['initialSnapshot'],
      receivedAtMs: number,
      server: ServerWelcomeMessage,
    ): HubPresentationTimeline {
      return createHubPresentationTimeline({
        initialReceivedAtMs: receivedAtMs,
        initialSnapshot: hubSnapshot,
        localPlayerId: server.playerId,
        serverTickRate: server.serverTickRate,
        snapshotRate: server.snapshotRate,
      })
    }

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
      boneyardListeners.clear()
      options.onFatal?.(error)
    }
  })
}

function predictLocalPlayer(
  source: GameSnapshot,
  playerId: string,
  inputs: readonly PendingInput[],
): GameSnapshot {
  const authoritative = source.players[playerId]
  if (!authoritative || inputs.length === 0) return source
  switch (source.world.kind) {
    case 'hub': {
      let player = authoritative
      let collisionRngState = source.world.collisionRngState
      for (const pending of inputs) {
        const predicted = predictPlayerCharacterInHub(
          player,
          pending.input,
          collisionRngState,
        )
        player = predicted.player
        collisionRngState = predicted.collisionRngState
      }
      return {
        ...source,
        players: { ...source.players, [playerId]: player },
        world: { ...source.world, collisionRngState },
      }
    }
    case 'boneyard': return source
  }
}

function supportsLocalPrediction(welcome: ServerWelcomeMessage): boolean {
  const parameters = welcome.kernelParameters
  return welcome.kernelVersion === PLAYER_CHARACTER_KERNEL_VERSION
    && parameters.fixedTickSeconds === PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS
    && parameters.movementAcceleration === PLAYER_CHARACTER_INPUT_ACCELERATION
    && parameters.movementLaneCap === PLAYER_CHARACTER_MOVEMENT_LANE_CAP
    && parameters.movementRetention === PLAYER_CHARACTER_MOVEMENT_RETENTION
    && parameters.movementThresholdSquared === PLAYER_CHARACTER_MOVEMENT_THRESHOLD_SQUARED
    && parameters.playerRadius === PLAYER_CHARACTER_RADIUS
}

function copyInput(input: PlayerCharacterInput): PlayerCharacterInput {
  return { movement: { ...input.movement } }
}

function sameInput(first: PlayerCharacterInput, second: PlayerCharacterInput): boolean {
  return first.movement.x === second.movement.x
    && first.movement.y === second.movement.y
}

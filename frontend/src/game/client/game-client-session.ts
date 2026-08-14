import {
  PLAYER_CHARACTER_INPUT_ACCELERATION,
  PLAYER_CHARACTER_MOVEMENT_LANE_CAP,
  PLAYER_CHARACTER_MOVEMENT_RETENTION,
  PLAYER_CHARACTER_MOVEMENT_THRESHOLD_SQUARED,
  PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
  PLAYER_CHARACTER_RADIUS,
  createIdlePlayerCharacterInput,
  playerPrimaryCastOwnsFacing,
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
  type BoneyardEnemyEventSnapshot,
  type GameSnapshot,
  type LoadedBoneyard,
  type ServerWelcomeMessage,
} from '../protocol/game-protocol.ts'
import type { HubParticipantState } from '../core-kernels/hub-regions.ts'
import type { ProtocolPlayerState } from '../protocol/game-state.ts'
import type { GameTransport } from './game-transport.ts'
import {
  createBoneyardPresentationTimeline,
  isBoneyardGameSnapshot,
  type BoneyardPresentationFrame,
  type BoneyardPresentationTimeline,
} from './boneyard-presentation-timeline.ts'
import {
  createHubPresentationTimeline,
  isHubGameSnapshot,
  type HubPresentationFrame,
  type HubPresentationTimeline,
} from './hub-presentation-timeline.ts'
import { predictPlayerCharacterInHub } from './hub-prediction.ts'
import {
  EntityReplicationGapError,
  EntityReplicationReconstructor,
} from '../protocol/entity-replication.ts'

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
  acknowledgeGameOver(runId: string, eventId: number): void
  confirmLoadout(): void
  destroy(): void
  getBoneyard(): LoadedBoneyard | null
  getPingMs(): number | null
  getSnapshot(): GameSnapshot
  onBoneyard(listener: (boneyard: LoadedBoneyard) => void): () => void
  onEnemyEvent(listener: (event: BoneyardEnemyEventSnapshot) => void): () => void
  onPing(listener: (pingMs: number) => void): () => void
  onSnapshot(listener: (snapshot: GameSnapshot) => void): () => void
  sampleBoneyardPresentation(nowMs?: number): BoneyardPresentationFrame
  samplePresentation(nowMs?: number): HubPresentationFrame
  selectSkill(choiceIndex: number, offerSequence: number, skillId: number): void
  sendInput(input: PlayerCharacterInput): void
  startMatch(boneyardId: string): void
}

export type GameSessionConnector = (
  options: GameClientSessionOptions,
) => Promise<GameClientSession>

interface PendingInput {
  sequence: number
  targetTick: number
}

interface LocalHubPresentationState {
  collisionRngState: number
  correction: { x: number; y: number }
  correctionDurationMs: number
  correctionStartedAtMs: number
  lastAdvancedAtMs: number
  participant: HubParticipantState
  player: ProtocolPlayerState
  predictedTicks: number
  remainderMs: number
}

const STOPPED_INPUT = createIdlePlayerCharacterInput()
const PING_INTERVAL_MS = 2_000
const PING_TIMEOUT_MS = 10_000

export function connectGameClientSession(
  options: GameClientSessionOptions,
): Promise<GameClientSession> {
  return new Promise((resolve, reject) => {
    let settled = false
    let destroyed = false
    let welcome: ServerWelcomeMessage | undefined
    let snapshot: GameSnapshot | undefined
    let presentationTimeline: HubPresentationTimeline | undefined
    let boneyardPresentationTimeline: BoneyardPresentationTimeline | undefined
    let loadedBoneyard: LoadedBoneyard | null = null
    let lastSnapshotReceivedAtMs = 0
    let lastSnapshotSequence = 0
    let latestPingMs: number | null = null
    let nextPingNonce = 1
    let pingTimer: ReturnType<typeof globalThis.setInterval> | undefined
    let sequence = 0
    let predictionEnabled = false
    let fatalReported = false
    let localHubPresentation: LocalHubPresentationState | undefined
    let currentInput = copyInput(STOPPED_INPUT)
    let sentInput = copyInput(STOPPED_INPUT)
    let enemyEventCursor: { eventId: number; runId: string } | null = null
    const now = options.now ?? (() => performance.now())
    const snapshotListeners = new Set<(snapshot: GameSnapshot) => void>()
    const boneyardListeners = new Set<(boneyard: LoadedBoneyard) => void>()
    const enemyEventListeners = new Set<(event: BoneyardEnemyEventSnapshot) => void>()
    const pingListeners = new Set<(pingMs: number) => void>()
    const pendingPings = new Map<number, number>()
    const entityReplication = new EntityReplicationReconstructor()
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
        enemyEventCursor = initialEnemyEventCursor(snapshot)
        lastSnapshotSequence = message.snapshotSequence
        entityReplication.reset(snapshot, lastSnapshotSequence)
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
          resetLocalHubPresentation(snapshot, lastSnapshotReceivedAtMs)
        } else if (isBoneyardGameSnapshot(snapshot)) {
          boneyardPresentationTimeline = createBoneyardTimeline(
            snapshot,
            lastSnapshotReceivedAtMs,
            message,
          )
        }
        settled = true
        globalThis.clearTimeout(handshakeDeadline)
        sendPing()
        pingTimer = globalThis.setInterval(sendPing, PING_INTERVAL_MS)
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
      if (message.type === 'server-pong') {
        const sentAtMs = pendingPings.get(message.nonce)
        if (sentAtMs === undefined) return
        pendingPings.delete(message.nonce)
        latestPingMs = Math.max(0, Math.round(now() - sentAtMs))
        for (const listener of pingListeners) listener(latestPingMs)
        return
      }
      if (message.sequence <= lastSnapshotSequence) return
      let reconstructedSnapshot: GameSnapshot
      try {
        reconstructedSnapshot = entityReplication.apply(message.frame, message.sequence)
      } catch (error) {
        if (!(error instanceof EntityReplicationGapError)) {
          fail(error instanceof Error ? error : new Error('Entity replication failed'))
          return
        }
        options.transport.send(encodeGameMessage({
          type: 'client-snapshot-ack',
          requireKeyframe: true,
          sequence: lastSnapshotSequence,
        }))
        return
      }
      lastSnapshotSequence = message.sequence
      options.transport.send(encodeGameMessage({
        type: 'client-snapshot-ack',
        requireKeyframe: false,
        sequence: lastSnapshotSequence,
      }))
      pendingInputs = pendingInputs.filter(
        (entry) => entry.sequence > message.acknowledgedInputSequence,
      )
      const previousWorldKind = snapshot.world.kind
      const receivedAtMs = now()
      if (isHubGameSnapshot(reconstructedSnapshot)) {
        reconcileLocalHubPresentation(
          reconstructedSnapshot,
          receivedAtMs,
          previousWorldKind === 'hub',
        )
      } else {
        localHubPresentation = undefined
      }
      snapshot = reconstructedSnapshot
      lastSnapshotReceivedAtMs = receivedAtMs
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
      } else if (isBoneyardGameSnapshot(snapshot)) {
        if (
          !boneyardPresentationTimeline
          || previousWorldKind !== 'boneyard'
          || boneyardPresentationTimeline.latest().world.runId !== snapshot.world.runId
        ) {
          boneyardPresentationTimeline = createBoneyardTimeline(
            snapshot,
            lastSnapshotReceivedAtMs,
            welcome,
          )
        } else {
          boneyardPresentationTimeline.push(snapshot, lastSnapshotReceivedAtMs)
        }
      }
      publishEnemyEvents(snapshot)
      for (const listener of snapshotListeners) listener(snapshot)
    })
    const removeClose = options.transport.onClose((reason) => {
      if (!destroyed) fail(new Error(reason))
    })

    const session: GameClientSession = {
      acknowledgeGameOver(runId, eventId) {
        if (!welcome || !snapshot || destroyed || !session.isHost) return
        if (
          snapshot.run.phase !== 'game-over'
          || snapshot.run.runId !== runId
          || snapshot.run.gameOverEventId !== eventId
        ) return
        options.transport.send(encodeGameMessage({
          type: 'client-acknowledge-game-over',
          eventId,
          runId,
        }))
      },
      confirmLoadout() {
        if (!welcome || !snapshot || destroyed || !session.isHost) return
        if (snapshot.run.phase !== 'loadout') return
        options.transport.send(encodeGameMessage({ type: 'client-confirm-loadout' }))
      },
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
        stopPing()
        removeClose()
        removeMessage()
        if (options.transport.readyState === 'open') {
          options.transport.send(encodeGameMessage({ type: 'client-disconnect' }))
        }
        options.transport.close(1000, 'session destroyed')
        snapshotListeners.clear()
        boneyardListeners.clear()
        enemyEventListeners.clear()
        pingListeners.clear()
      },
      getBoneyard() {
        return loadedBoneyard
      },
      getPingMs() {
        return latestPingMs
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
      onEnemyEvent(listener) {
        enemyEventListeners.add(listener)
        return () => enemyEventListeners.delete(listener)
      },
      onPing(listener) {
        pingListeners.add(listener)
        return () => pingListeners.delete(listener)
      },
      sampleBoneyardPresentation(requestedNow = now()) {
        if (!boneyardPresentationTimeline) {
          throw new Error('game session has no Boneyard presentation timeline')
        }
        return boneyardPresentationTimeline.sample(requestedNow)
      },
      samplePresentation(requestedNow = now()) {
        if (!welcome || !snapshot || !presentationTimeline) {
          throw new Error('game session has no Hub presentation timeline')
        }
        const frame = presentationTimeline.sample(requestedNow)
        if (!predictionEnabled || !isHubGameSnapshot(snapshot)) return frame
        advanceLocalHubPresentation(requestedNow)
        if (!localHubPresentation) return frame
        const player = displayedLocalPlayer(localHubPresentation, requestedNow)
        return {
          ...frame,
          players: { ...frame.players, [welcome.playerId]: player },
          world: {
            ...frame.world,
            collisionRngState: localHubPresentation.collisionRngState,
          },
        }
      },
      sendInput(nextInput) {
        if (!welcome || !snapshot || destroyed) return
        const offered = snapshot.players[welcome.playerId]?.progression.pendingOffer
        const lifeState = snapshot.players[welcome.playerId]?.progression.lifeState
        const requestedInput = offered || lifeState !== 'alive' || snapshot.run.phase === 'game-over'
          ? STOPPED_INPUT
          : nextInput
        const movement = requestedInput.movement
        if (!Number.isFinite(movement.x) || !Number.isFinite(movement.y)) {
          throw new Error('game input must contain finite movement coordinates')
        }
        const length = Math.hypot(movement.x, movement.y)
        if (
          requestedInput.aim
          && (!Number.isFinite(requestedInput.aim.x) || !Number.isFinite(requestedInput.aim.y))
        ) throw new Error('game input must contain finite aim coordinates')
        if (
          typeof requestedInput.cast.primary !== 'boolean'
          || typeof requestedInput.cast.secondary !== 'boolean'
        ) throw new Error('game input must contain primary and secondary cast levels')
        const input: PlayerCharacterInput = {
          aim: requestedInput.aim ? { ...requestedInput.aim } : null,
          cast: { ...requestedInput.cast },
          movement: length > 1
            ? { x: movement.x / length, y: movement.y / length }
            : { ...movement },
        }
        if (!sameInput(input, currentInput)) advanceLocalHubPresentation(now())
        currentInput = input
        if (sameInput(input, sentInput)) return
        const castTransition = !sameCast(input, sentInput)
        sentInput = copyInput(input)
        sequence += 1
        const pendingTail = pendingInputs.reduce<PendingInput | undefined>((latest, entry) => (
          !latest
          || entry.targetTick > latest.targetTick
          || (entry.targetTick === latest.targetTick && entry.sequence > latest.sequence)
            ? entry
            : latest
        ), undefined)
        const targetTick = Math.max(
          snapshot.tick + 1,
          pendingTail
            ? pendingTail.targetTick + Number(castTransition)
            : snapshot.tick + 1,
        )
        const pendingAtTick = pendingInputs.findIndex(
          (entry) => entry.targetTick === targetTick,
        )
        const pending = { sequence, targetTick }
        if (pendingAtTick < 0) pendingInputs.push(pending)
        else pendingInputs[pendingAtTick] = pending
        options.transport.send(encodeGameMessage({
          type: 'client-input',
          input,
          sequence,
          targetTick,
        }))
      },
      selectSkill(choiceIndex, offerSequence, skillId) {
        if (!welcome || !snapshot || destroyed) return
        const offer = snapshot.players[welcome.playerId]?.progression.pendingOffer
        const option = offer?.options[choiceIndex]
        if (
          !offer
          || offer.sequence !== offerSequence
          || option?.skillId !== skillId
        ) throw new Error('The selected skill is not in the current offer.')
        session.sendInput(STOPPED_INPUT)
        options.transport.send(encodeGameMessage({
          type: 'client-select-skill',
          choiceIndex,
          offerSequence,
          skillId,
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

    function sendPing(): void {
      if (!welcome || destroyed || options.transport.readyState !== 'open') return
      const sentAtMs = now()
      for (const [nonce, pendingAtMs] of pendingPings) {
        if (sentAtMs - pendingAtMs >= PING_TIMEOUT_MS) pendingPings.delete(nonce)
      }
      const nonce = nextPingNonce
      nextPingNonce = nextPingNonce === 0x7fffffff ? 1 : nextPingNonce + 1
      pendingPings.set(nonce, sentAtMs)
      options.transport.send(encodeGameMessage({ type: 'client-ping', nonce }))
    }

    function stopPing(): void {
      if (pingTimer !== undefined) globalThis.clearInterval(pingTimer)
      pingTimer = undefined
      pendingPings.clear()
    }

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

    function createBoneyardTimeline(
      boneyardSnapshot: Parameters<typeof createBoneyardPresentationTimeline>[0]['initialSnapshot'],
      receivedAtMs: number,
      server: ServerWelcomeMessage,
    ): BoneyardPresentationTimeline {
      return createBoneyardPresentationTimeline({
        initialReceivedAtMs: receivedAtMs,
        initialSnapshot: boneyardSnapshot,
        serverTickRate: server.serverTickRate,
        snapshotRate: server.snapshotRate,
      })
    }

    function publishEnemyEvents(nextSnapshot: GameSnapshot): void {
      if (!isBoneyardGameSnapshot(nextSnapshot)) {
        enemyEventCursor = null
        return
      }
      if (enemyEventCursor?.runId !== nextSnapshot.world.runId) {
        enemyEventCursor = { eventId: 0, runId: nextSnapshot.world.runId }
      }
      for (const event of nextSnapshot.world.enemyEvents) {
        if (event.eventId <= enemyEventCursor.eventId) continue
        enemyEventCursor = { eventId: event.eventId, runId: event.runId }
        for (const listener of enemyEventListeners) listener(event)
      }
    }

    function resetLocalHubPresentation(
      hubSnapshot: Parameters<typeof createHubPresentationTimeline>[0]['initialSnapshot'],
      receivedAtMs: number,
    ): void {
      if (!predictionEnabled || !welcome) {
        localHubPresentation = undefined
        return
      }
      const player = hubSnapshot.players[welcome.playerId]
      const participant = hubSnapshot.world.participants[welcome.playerId]
      if (!player || !participant) {
        localHubPresentation = undefined
        return
      }
      localHubPresentation = {
        collisionRngState: hubSnapshot.world.collisionRngState,
        correction: { x: 0, y: 0 },
        correctionDurationMs: 1000 / welcome.snapshotRate,
        correctionStartedAtMs: receivedAtMs,
        lastAdvancedAtMs: receivedAtMs,
        participant: copyParticipant(participant),
        player: copyPlayer(player),
        predictedTicks: 0,
        remainderMs: 0,
      }
    }

    function reconcileLocalHubPresentation(
      hubSnapshot: Parameters<typeof createHubPresentationTimeline>[0]['initialSnapshot'],
      receivedAtMs: number,
      previousWasHub: boolean,
    ): void {
      if (!predictionEnabled || !welcome) {
        localHubPresentation = undefined
        return
      }
      const authoritative = hubSnapshot.players[welcome.playerId]
      const participant = hubSnapshot.world.participants[welcome.playerId]
      const previous = localHubPresentation
      if (!authoritative || !participant || !previous || !previousWasHub) {
        resetLocalHubPresentation(hubSnapshot, receivedAtMs)
        return
      }
      advanceLocalHubPresentation(receivedAtMs)
      if (previous.participant.region !== participant.region) {
        resetLocalHubPresentation(hubSnapshot, receivedAtMs)
        return
      }
      const displayed = displayedLocalPlayer(previous, receivedAtMs)
      localHubPresentation = {
        collisionRngState: hubSnapshot.world.collisionRngState,
        correction: {
          x: displayed.position.x - authoritative.position.x,
          y: displayed.position.y - authoritative.position.y,
        },
        correctionDurationMs: 1000 / welcome.snapshotRate,
        correctionStartedAtMs: receivedAtMs,
        lastAdvancedAtMs: receivedAtMs,
        participant: copyParticipant(participant),
        player: {
          ...copyPlayer(authoritative),
          gaitDegrees: previous.player.gaitDegrees,
          headingIndex: playerPrimaryCastOwnsFacing(authoritative.primaryCast)
            ? authoritative.headingIndex
            : previous.player.headingIndex,
          velocity: { ...previous.player.velocity },
          walkCyclePrimary: previous.player.walkCyclePrimary,
        },
        predictedTicks: 0,
        remainderMs: previous.remainderMs,
      }
    }

    function advanceLocalHubPresentation(requestedNow: number): void {
      if (!welcome || !localHubPresentation) return
      const state = localHubPresentation
      const elapsedMs = Math.max(0, requestedNow - state.lastAdvancedAtMs)
      state.lastAdvancedAtMs = Math.max(state.lastAdvancedAtMs, requestedNow)
      state.remainderMs += elapsedMs
      const tickMs = 1000 / welcome.serverTickRate
      const maximumTicks = Math.max(
        1,
        Math.ceil(welcome.serverTickRate / welcome.snapshotRate),
      )
      while (
        state.remainderMs >= tickMs
        && state.predictedTicks < maximumTicks
      ) {
        const predicted = predictPlayerCharacterInHub(
          state.player,
          currentInput,
          state.collisionRngState,
          state.participant,
        )
        state.player = {
          ...predicted.player,
          config: { ...state.player.config },
          progression: state.player.progression,
        }
        state.collisionRngState = predicted.collisionRngState
        state.predictedTicks += 1
        state.remainderMs -= tickMs
      }
      if (state.predictedTicks === maximumTicks) state.remainderMs = 0
    }

    function fail(error: Error): void {
      if (!settled) {
        settled = true
        destroyed = true
        globalThis.clearTimeout(handshakeDeadline)
        stopPing()
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
      stopPing()
      removeClose()
      removeMessage()
      options.transport.close(1008, error.message.slice(0, 123))
      snapshotListeners.clear()
      boneyardListeners.clear()
      enemyEventListeners.clear()
      pingListeners.clear()
      options.onFatal?.(error)
    }
  })
}

function initialEnemyEventCursor(
  snapshot: GameSnapshot,
): { eventId: number; runId: string } | null {
  if (!isBoneyardGameSnapshot(snapshot)) return null
  return {
    eventId: snapshot.world.enemyEvents.at(-1)?.eventId ?? 0,
    runId: snapshot.world.runId,
  }
}

function displayedLocalPlayer(
  state: LocalHubPresentationState,
  requestedNow: number,
): ProtocolPlayerState {
  const elapsedMs = Math.max(0, requestedNow - state.correctionStartedAtMs)
  const remaining = Math.max(0, 1 - elapsedMs / state.correctionDurationMs)
  return {
    ...copyPlayer(state.player),
    position: {
      x: state.player.position.x + state.correction.x * remaining,
      y: state.player.position.y + state.correction.y * remaining,
    },
  }
}

function copyPlayer(player: ProtocolPlayerState): ProtocolPlayerState {
  return {
    ...player,
    config: { ...player.config },
    position: { ...player.position },
    progression: {
      ...player.progression,
      learnedSkills: player.progression.learnedSkills.map((entry) => [...entry]),
      pendingOffer: player.progression.pendingOffer
        ? {
            ...player.progression.pendingOffer,
            options: player.progression.pendingOffer.options.map((option) => ({ ...option })),
          }
        : null,
    },
    velocity: { ...player.velocity },
  }
}

function copyParticipant(participant: HubParticipantState): HubParticipantState {
  return {
    region: participant.region,
    transition: participant.transition
      ? {
          ...participant.transition,
          scriptedTarget: { ...participant.transition.scriptedTarget },
        }
      : null,
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
  return {
    aim: input.aim ? { ...input.aim } : null,
    cast: { ...input.cast },
    movement: { ...input.movement },
  }
}

function sameInput(first: PlayerCharacterInput, second: PlayerCharacterInput): boolean {
  return sameCast(first, second)
    && first.aim?.x === second.aim?.x
    && first.aim?.y === second.aim?.y
    && first.movement.x === second.movement.x
    && first.movement.y === second.movement.y
}

function sameCast(first: PlayerCharacterInput, second: PlayerCharacterInput): boolean {
  return first.cast.primary === second.cast.primary
    && first.cast.secondary === second.cast.secondary
}

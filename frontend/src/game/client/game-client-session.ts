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
  MAX_LUA_CONSOLE_CODE_LENGTH,
  PLAYER_CHARACTER_KERNEL_VERSION,
  GameProtocolError,
  decodeServerGameMessage,
  encodeGameMessage,
  normalizeGameChatText,
  type BoneyardChoice,
  type BoneyardEnemyEventSnapshot,
  type GameChatChannel,
  type GameChatMessage,
  type GameChatRejection,
  type GameSnapshot,
  type GameSessionKind,
  type GameplayPauseSource,
  type GameplayPauseState,
  type HubPlayerActivity,
  type LoadedBoneyard,
  type LuaConsoleObject,
  type ModAction,
  type ModContentProjection,
  type PartyAction,
  type PartyActionRejection,
  type ServerLuaResultMessage,
  type ServerDeploymentRestartMessage,
  type ServerWelcomeMessage,
  type GameModAsset,
} from '../protocol/game-protocol.ts'
import type { ModConsumableCatalogEntry } from '../core-kernels/hub-economy.ts'
import type { GameSaveCheckpoint, GameSaveIntent } from '../save/game-save-contract.ts'
import type {
  ProtocolHubParticipantState,
  ProtocolPlayerState,
} from '../protocol/game-state.ts'
import type { HubInventoryAction } from '../core-kernels/hub-economy.ts'
import type {
  LocalPartyState,
  PartyVisibility,
  PlayerSocialProfile,
} from '../protocol/party-state.ts'
import { nativeSkillCategory } from '../core-kernels/player-progression.ts'
import type { NativeTutorialSurfaceAction } from '../core-kernels/native-tutorial.ts'
import type { GameTransport } from './game-transport.ts'
import {
  GameConnectionFailure,
  failureFromServerDisconnect,
  failureFromTransportClose,
} from './game-connection-failure.ts'
import type { GameClientDiagnostics } from './game-diagnostics.ts'
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
import { appendGameChatMessage } from '../game-chat.ts'

export interface GameClientSessionOptions {
  allowModMismatch?: boolean
  character: PlayerCharacterConfig
  cheatsEnabled?: boolean
  credential: string
  diagnostics?: GameClientDiagnostics
  now?: () => number
  onFatal?: (failure: GameConnectionFailure) => void
  onDeploymentRestart?: (request: GameDeploymentRestartRequest) => Promise<void>
  profile: PlayerSocialProfile
  resumeToken?: string
  saveDocument?: string
  saveIntent?: GameSaveIntent
  transport: GameTransport
}

export interface GameDeploymentRestartRequest {
  readonly checkpoint: GameSaveCheckpoint | null
  readonly targetRevision: string
}

export interface GameClientSession {
  readonly boneyards: readonly BoneyardChoice[]
  readonly developerAccess: boolean
  readonly isHost: boolean
  readonly modAssets: readonly GameModAsset[]
  readonly playerId: string
  readonly resumeToken: string
  readonly sessionKind: GameSessionKind
  acceptPartyJoinRequest(requestId: string): void
  bindSkillQuickbar(skillId: number, slot: number): void
  castModSpell(contentId: string, target: Readonly<{ x: number; y: number }>): void
  sendModAction(action: ModAction, target: string, args?: LuaConsoleObject): void
  confirmLoadout(
    element: PlayerCharacterConfig['element'],
    discipline: PlayerCharacterConfig['discipline'],
  ): void
  continueGameOver(runId: string, eventId: number): void
  destroy(): void
  denyPartyInvitation(invitationId: string): void
  denyPartyJoinRequest(requestId: string): void
  executeLua(code: string): Promise<GameLuaExecutionResult>
  acceptPartyInvitation(invitationId: string): void
  getBoneyard(): LoadedBoneyard | null
  getChatMessages(): readonly GameChatMessage[]
  getGameplayPause(): GameplayPauseState | null
  getModCatalog(): readonly ModConsumableCatalogEntry[]
  getModContent(): ModContentProjection | null
  getModRuntime(): LuaConsoleObject | null
  getPingMs(): number | null
  getPartyState(): LocalPartyState | null
  getSaveCheckpoint(): GameSaveCheckpoint | null
  getSnapshot(): GameSnapshot
  onBoneyard(listener: (boneyard: LoadedBoneyard) => void): () => void
  onChatMessage(listener: (message: GameChatMessage) => void): () => void
  onChatRejected(listener: (rejection: GameChatRejection) => void): () => void
  onGameplayPause(listener: (pause: GameplayPauseState | null) => void): () => void
  onLeaderboardReceipt(listener: (receipt: string) => void): () => void
  onModCatalog(listener: (catalog: readonly ModConsumableCatalogEntry[]) => void): () => void
  onModContent(listener: (projection: ModContentProjection) => void): () => void
  onModRuntime(listener: (projection: LuaConsoleObject) => void): () => void
  onEnemyEvent(listener: (event: BoneyardEnemyEventSnapshot) => void): () => void
  onPing(listener: (pingMs: number) => void): () => void
  onPartyState(listener: (state: LocalPartyState) => void): () => void
  onPartyAction(listener: (result: GamePartyActionResult) => void): () => void
  onSaveCheckpoint(listener: (checkpoint: GameSaveCheckpoint) => void): () => void
  onSnapshot(listener: (snapshot: GameSnapshot) => void): () => void
  sampleBoneyardPresentation(nowMs?: number): BoneyardPresentationFrame
  samplePresentation(nowMs?: number): HubPresentationFrame
  rerollSkill(offerSequence: number): void
  requestGameplayPause(source: GameplayPauseSource | null): void
  saveBeforeLeave(): Promise<GameSaveCheckpoint>
  saveSkill(offerSequence: number): void
  selectConcentration(skillId: number): void
  selectConcentrationSlot(skillId: number, slot: 0 | 1): void
  selectPrimarySkill(skillId: number): void
  selectSkill(choiceIndex: number, offerSequence: number, skillId: number): void
  sendChatMessage(channel: GameChatChannel, text: string, targetPlayerId?: string): void
  sendHubAction(action: HubInventoryAction): void
  sendInput(input: PlayerCharacterInput): void
  sendTutorialAction(action: NativeTutorialSurfaceAction): void
  setCheatsEnabled(enabled: boolean): void
  setHubActivity(activity: HubPlayerActivity | null): void
  inviteToParty(playerId: string): void
  kickPartyPlayer(playerId: string): void
  leaveParty(): void
  rotatePartyCode(): void
  setPartyVisibility(visibility: PartyVisibility): void
  startMatch(boneyardId: string): void
  startTutorial(): void
}

export interface GamePartyActionResult {
  readonly action: PartyAction
  readonly ok: boolean
  readonly reason: PartyActionRejection | null
}

export type GameLuaExecutionResult = Omit<
  ServerLuaResultMessage,
  'requestId' | 'type'
>

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
  participant: ProtocolHubParticipantState
  player: ProtocolPlayerState
  predictedTicks: number
  remainderMs: number
}

const STOPPED_INPUT = createIdlePlayerCharacterInput()
const PING_INTERVAL_MS = 2_000
const PING_TIMEOUT_MS = 10_000
const LUA_EXECUTION_TIMEOUT_MS = 10_000
const MAX_PENDING_LUA_EXECUTIONS = 8
const luaTextEncoder = new TextEncoder()
let nextGameSaveStreamId = 1

interface PendingLuaExecution {
  reject: (error: Error) => void
  resolve: (result: GameLuaExecutionResult) => void
  timeout: ReturnType<typeof globalThis.setTimeout>
}

interface PendingLeaveSave {
  readonly promise: Promise<GameSaveCheckpoint>
  readonly reject: (error: Error) => void
  readonly requestId: number
  readonly resolve: (checkpoint: GameSaveCheckpoint) => void
}

export function connectGameClientSession(
  options: GameClientSessionOptions,
): Promise<GameClientSession> {
  const saveStreamId = nextGameSaveStreamId
  nextGameSaveStreamId += 1
  return new Promise((resolve, reject) => {
    let settled = false
    let destroyed = false
    let deploymentRestarting = false
    let welcome: ServerWelcomeMessage | undefined
    let snapshot: GameSnapshot | undefined
    let presentationTimeline: HubPresentationTimeline | undefined
    let boneyardPresentationTimeline: BoneyardPresentationTimeline | undefined
    let loadedBoneyard: LoadedBoneyard | null = null
    let gameplayPause: GameplayPauseState | null = null
    let requestedHubActivity: HubPlayerActivity | null = null
    let modCatalog: readonly ModConsumableCatalogEntry[] = []
    let modContent: ModContentProjection | null = null
    let modRuntime: LuaConsoleObject | null = null
    let lastSnapshotReceivedAtMs = 0
    let lastSnapshotSequence = 0
    let latestPingMs: number | null = null
    let partyState: LocalPartyState | null = null
    let latestSaveCheckpoint: GameSaveCheckpoint | null = null
    let lastHighPingLoggedAtMs = Number.NEGATIVE_INFINITY
    let nextPingNonce = 1
    let nextLuaRequestId = 1
    let nextModRequestId = 1
    let nextLeaveSaveRequestId = 1
    let pingTimer: ReturnType<typeof globalThis.setInterval> | undefined
    let sequence = 0
    let predictionEnabled = false
    let fatalReported = false
    let localHubPresentation: LocalHubPresentationState | undefined
    let currentInput = copyInput(STOPPED_INPUT)
    let sentInput = copyInput(STOPPED_INPUT)
    let chatMessages: GameChatMessage[] = []
    let lastChatSequence = 0
    let enemyEventCursor: { eventId: number; runId: string } | null = null
    const now = options.now ?? (() => performance.now())
    const snapshotListeners = new Set<(snapshot: GameSnapshot) => void>()
    const boneyardListeners = new Set<(boneyard: LoadedBoneyard) => void>()
    const chatMessageListeners = new Set<(message: GameChatMessage) => void>()
    const chatRejectionListeners = new Set<(rejection: GameChatRejection) => void>()
    const gameplayPauseListeners = new Set<(pause: GameplayPauseState | null) => void>()
    const leaderboardReceiptListeners = new Set<(receipt: string) => void>()
    const modCatalogListeners = new Set<(
      catalog: readonly ModConsumableCatalogEntry[],
    ) => void>()
    const modContentListeners = new Set<(projection: ModContentProjection) => void>()
    const modRuntimeListeners = new Set<(projection: LuaConsoleObject) => void>()
    const enemyEventListeners = new Set<(event: BoneyardEnemyEventSnapshot) => void>()
    const pingListeners = new Set<(pingMs: number) => void>()
    const partyStateListeners = new Set<(state: LocalPartyState) => void>()
    const partyActionListeners = new Set<(result: GamePartyActionResult) => void>()
    const saveCheckpointListeners = new Set<(checkpoint: GameSaveCheckpoint) => void>()
    const pendingPings = new Map<number, number>()
    const pendingLuaExecutions = new Map<number, PendingLuaExecution>()
    let pendingLeaveSave: PendingLeaveSave | null = null
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
        fail(failureFromServerDisconnect(message.code, message.reason))
        return
      }
      if (message.type === 'server-welcome') {
        if (settled || message.observer === true || message.protocolVersion !== GAME_PROTOCOL_VERSION) {
          fail(new Error('The server selected an incompatible protocol.'))
          return
        }
        welcome = message
        snapshot = message.snapshot
        gameplayPause = message.gameplayPause
        requestedHubActivity = snapshot.world.kind === 'hub'
          ? snapshot.world.participants[message.playerId]?.activity ?? null
          : null
        modCatalog = message.modCatalog
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
      if (message.type === 'server-mod-catalog') {
        modCatalog = message.items
        for (const listener of modCatalogListeners) listener(modCatalog)
        return
      }
      if (message.type === 'server-mod-content') {
        if (modContent && message.revision < modContent.revision) return
        modContent = {
          content: message.content,
          manifestSha256: message.manifestSha256,
          powerups: message.powerups,
          revision: message.revision,
          statuses: message.statuses,
        }
        for (const listener of modContentListeners) listener(modContent)
        return
      }
      if (message.type === 'server-mod-runtime') {
        modRuntime = message.projection
        for (const listener of modRuntimeListeners) listener(modRuntime)
        return
      }
      if (message.type === 'server-save-checkpoint') {
        if (message.sequence <= (latestSaveCheckpoint?.sequence ?? 0)) return
        latestSaveCheckpoint = {
          document: message.save,
          reason: message.reason,
          sequence: message.sequence,
          streamId: saveStreamId,
        }
        for (const listener of saveCheckpointListeners) listener(latestSaveCheckpoint)
        return
      }
      if (message.type === 'server-save-before-leave') {
        const pending = pendingLeaveSave
        if (!pending || pending.requestId !== message.requestId) {
          fail(new Error('The game server sent an unexpected leave-save response.'))
          return
        }
        if (message.checkpointSequence === 0) {
          pendingLeaveSave = null
          pending.reject(new Error('The game server could not create a final save.'))
          return
        }
        if (latestSaveCheckpoint?.sequence !== message.checkpointSequence) {
          fail(new Error('The leave response did not include its final save checkpoint.'))
          return
        }
        pendingLeaveSave = null
        pending.resolve(latestSaveCheckpoint)
        return
      }
      if (message.type === 'server-deployment-restart') {
        beginDeploymentRestart(message)
        return
      }
      if (message.type === 'server-leaderboard-receipt') {
        for (const listener of leaderboardReceiptListeners) listener(message.receipt)
        return
      }
      if (message.type === 'server-gameplay-pause') {
        gameplayPause = message.pause
        currentInput = copyInput(STOPPED_INPUT)
        sentInput = copyInput(STOPPED_INPUT)
        pendingInputs = []
        if (isHubGameSnapshot(snapshot)) resetLocalHubPresentation(snapshot, now())
        for (const listener of gameplayPauseListeners) listener(gameplayPause)
        return
      }
      if (message.type === 'server-party-state') {
        partyState = message.state
        for (const listener of partyStateListeners) listener(partyState)
        return
      }
      if (message.type === 'server-party-action') {
        const result = { action: message.action, ok: message.ok, reason: message.reason }
        for (const listener of partyActionListeners) listener(result)
        return
      }
      if (message.type === 'server-chat') {
        if (message.sequence <= lastChatSequence) return
        lastChatSequence = message.sequence
        const chatMessage: GameChatMessage = {
          channel: message.channel,
          ...(message.recipient ? { recipient: message.recipient } : {}),
          sender: message.sender,
          sequence: message.sequence,
          text: message.text,
        }
        chatMessages = [...appendGameChatMessage(chatMessages, chatMessage)]
        for (const listener of chatMessageListeners) listener(chatMessage)
        return
      }
      if (message.type === 'server-chat-rejected') {
        const rejection: GameChatRejection = {
          channel: message.channel,
          reason: message.reason,
          retryAfterMs: message.retryAfterMs,
        }
        for (const listener of chatRejectionListeners) listener(rejection)
        return
      }
      if (message.type === 'server-pong') {
        const sentAtMs = pendingPings.get(message.nonce)
        if (sentAtMs === undefined) return
        pendingPings.delete(message.nonce)
        latestPingMs = Math.max(0, Math.round(now() - sentAtMs))
        if (
          latestPingMs >= 1_000
          && now() - lastHighPingLoggedAtMs >= 30_000
        ) {
          lastHighPingLoggedAtMs = now()
          options.diagnostics?.warning(
            'network.high_latency',
            'The game server reply took at least one second.',
            `pingMs=${latestPingMs}`,
          )
        }
        for (const listener of pingListeners) listener(latestPingMs)
        return
      }
      if (message.type === 'server-lua-result') {
        const pending = pendingLuaExecutions.get(message.requestId)
        if (!pending) return
        pendingLuaExecutions.delete(message.requestId)
        globalThis.clearTimeout(pending.timeout)
        pending.resolve({
          error: message.error,
          ok: message.ok,
          output: message.output,
          values: message.values,
        })
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
        options.diagnostics?.warning(
          'replication.gap',
          'A game-state update was missed; the client requested a complete replacement.',
          `receivedSequence=${message.sequence}; lastSequence=${lastSnapshotSequence}`,
        )
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
      if (reconstructedSnapshot.levelUpBarrier !== null) {
        currentInput = copyInput(STOPPED_INPUT)
        sentInput = copyInput(STOPPED_INPUT)
        pendingInputs = []
      }
      const previousWorldKind = snapshot.world.kind
      const presentationWasHeld = gameplayPause !== null
        || snapshot.levelUpBarrier !== null
      const receivedAtMs = now()
      if (isHubGameSnapshot(reconstructedSnapshot)) {
        if (presentationWasHeld || reconstructedSnapshot.levelUpBarrier !== null) {
          resetLocalHubPresentation(reconstructedSnapshot, receivedAtMs)
        } else {
          reconcileLocalHubPresentation(
            reconstructedSnapshot,
            receivedAtMs,
            previousWorldKind === 'hub',
          )
        }
      } else {
        localHubPresentation = undefined
      }
      snapshot = reconstructedSnapshot
      if (previousWorldKind !== snapshot.world.kind) {
        requestedHubActivity = snapshot.world.kind === 'hub'
          ? snapshot.world.participants[welcome.playerId]?.activity ?? null
          : null
      }
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
    const removeClose = options.transport.onClose((event) => {
      if (deploymentRestarting) {
        finishDeploymentRestart()
        return
      }
      if (!destroyed) fail(failureFromTransportClose(event))
    })

    const session: GameClientSession = {
      acceptPartyJoinRequest(requestId) {
        if (!welcome || destroyed) return
        options.transport.send(encodeGameMessage({
          type: 'client-party-request-accept',
          requestId,
        }))
      },
      acceptPartyInvitation(invitationId) {
        if (!welcome || destroyed) return
        options.transport.send(encodeGameMessage({
          type: 'client-party-accept',
          invitationId,
        }))
      },
      bindSkillQuickbar(skillId, slot) {
        if (!welcome || !snapshot || destroyed) return
        const progression = snapshot.players[welcome.playerId]?.progression
        const category = nativeSkillCategory(skillId)
        if (
          !Number.isInteger(slot)
          || slot < 0
          || slot > 7
          || (category !== 1 && category !== 2)
          || (progression?.learnedSkills.find(([id]) => id === skillId)?.[1] ?? 0) < 1
        ) throw new Error('The quickbar skill is unavailable.')
        session.sendInput(STOPPED_INPUT)
        options.transport.send(encodeGameMessage({
          type: 'client-skill-quickbar-bind',
          skillId,
          slot,
        }))
      },
      castModSpell(contentId, target) {
        if (!welcome || destroyed) return
        const requestId = nextModRequestId
        nextModRequestId += 1
        options.transport.send(encodeGameMessage({
          type: 'client-mod-cast',
          contentId,
          requestId,
          targetX: target.x,
          targetY: target.y,
        }))
      },
      sendModAction(action, target, args = {}) {
        if (!welcome || destroyed) return
        const requestId = nextModRequestId
        nextModRequestId += 1
        options.transport.send(encodeGameMessage({
          type: 'client-mod-action',
          action,
          arguments: args,
          requestId,
          target,
        }))
      },
      confirmLoadout(element, discipline) {
        if (!welcome || !snapshot || destroyed) return
        if (snapshot.run.phase !== 'loadout') return
        if (snapshot.run.loadoutReadyPlayerIds.includes(welcome.playerId)) return
        options.transport.send(encodeGameMessage({
          type: 'client-confirm-loadout',
          discipline,
          element,
        }))
      },
      continueGameOver(runId, eventId) {
        if (!welcome || !snapshot || destroyed) return
        if (
          snapshot.run.phase !== 'game-over'
          || snapshot.run.runId !== runId
          || snapshot.run.gameOverEventId !== eventId
          || snapshot.run.gameOverExitTicks !== null
        ) return
        options.transport.send(encodeGameMessage({
          type: 'client-continue-game-over',
          eventId,
          runId,
        }))
      },
      get boneyards() {
        if (!welcome) throw new Error('game session has not been welcomed')
        return welcome.boneyards
      },
      get developerAccess() {
        return welcome?.developerAccess === true
      },
      get isHost() {
        return !!welcome && snapshot?.hostPlayerId === welcome.playerId
      },
      get modAssets() {
        if (!welcome) throw new Error('game session has not been welcomed')
        return welcome.modAssets
      },
      get playerId() {
        if (!welcome) throw new Error('game session has not been welcomed')
        return welcome.playerId
      },
      get resumeToken() {
        if (!welcome) throw new Error('game session has not been welcomed')
        return welcome.resumeToken
      },
      get sessionKind() {
        if (!welcome) throw new Error('game session has not been welcomed')
        return welcome.sessionKind
      },
      destroy() {
        if (destroyed) return
        destroyed = true
        globalThis.clearTimeout(handshakeDeadline)
        stopPing()
        removeClose()
        removeMessage()
        if (options.transport.readyState === 'open') {
          options.diagnostics?.info(
            'connection.client_disconnect',
            'The game client requested a normal disconnect.',
          )
          options.transport.send(encodeGameMessage({ type: 'client-disconnect' }))
        }
        options.transport.close(1000, 'session destroyed')
        rejectPendingLeaveSave(new Error('The game session was destroyed.'))
        rejectPendingLuaExecutions(new Error('The game session was destroyed.'))
        snapshotListeners.clear()
        boneyardListeners.clear()
        chatMessageListeners.clear()
        chatRejectionListeners.clear()
        chatMessages = []
        gameplayPauseListeners.clear()
        leaderboardReceiptListeners.clear()
        modCatalogListeners.clear()
        modContentListeners.clear()
        modRuntimeListeners.clear()
        enemyEventListeners.clear()
        pingListeners.clear()
        partyActionListeners.clear()
        partyStateListeners.clear()
        saveCheckpointListeners.clear()
      },
      denyPartyInvitation(invitationId) {
        if (!welcome || destroyed) return
        options.transport.send(encodeGameMessage({
          type: 'client-party-deny',
          invitationId,
        }))
      },
      denyPartyJoinRequest(requestId) {
        if (!welcome || destroyed) return
        options.transport.send(encodeGameMessage({
          type: 'client-party-request-deny',
          requestId,
        }))
      },
      executeLua(code) {
        if (!welcome || !snapshot || destroyed) {
          return Promise.reject(new Error('The game session is not connected.'))
        }
        if (!session.developerAccess && !session.isHost) {
          return Promise.reject(new Error('Only the session host may execute Lua.'))
        }
        if (gameplayPause !== null) {
          return Promise.reject(new Error('Lua execution is unavailable while gameplay is paused.'))
        }
        if (typeof code !== 'string' || code.length === 0) {
          return Promise.reject(new Error('Lua code must not be empty.'))
        }
        if (
          code.length > MAX_LUA_CONSOLE_CODE_LENGTH
          || luaTextEncoder.encode(JSON.stringify(code)).byteLength
            > MAX_LUA_CONSOLE_CODE_LENGTH
        ) {
          return Promise.reject(new Error('Lua code exceeds the console limit.'))
        }
        if (pendingLuaExecutions.size >= MAX_PENDING_LUA_EXECUTIONS) {
          return Promise.reject(new Error('Too many Lua executions are pending.'))
        }
        const requestId = nextAvailableLuaRequestId(nextLuaRequestId, pendingLuaExecutions)
        nextLuaRequestId = requestId === 0x7fff_ffff ? 1 : requestId + 1
        return new Promise<GameLuaExecutionResult>((resolveExecution, rejectExecution) => {
          const timeout = globalThis.setTimeout(() => {
            pendingLuaExecutions.delete(requestId)
            rejectExecution(new Error('Lua execution timed out.'))
          }, LUA_EXECUTION_TIMEOUT_MS)
          pendingLuaExecutions.set(requestId, {
            reject: rejectExecution,
            resolve: resolveExecution,
            timeout,
          })
          options.transport.send(encodeGameMessage({
            type: 'client-lua-execute',
            code,
            requestId,
          }))
        })
      },
      getBoneyard() {
        return loadedBoneyard
      },
      getChatMessages() {
        return chatMessages
      },
      getGameplayPause() {
        return gameplayPause
      },
      getModCatalog() {
        return modCatalog
      },
      getModContent() {
        return modContent
      },
      getModRuntime() {
        return modRuntime
      },
      getPingMs() {
        return latestPingMs
      },
      getPartyState() {
        return partyState
      },
      getSaveCheckpoint() {
        return latestSaveCheckpoint
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
      onChatMessage(listener) {
        chatMessageListeners.add(listener)
        return () => chatMessageListeners.delete(listener)
      },
      onChatRejected(listener) {
        chatRejectionListeners.add(listener)
        return () => chatRejectionListeners.delete(listener)
      },
      onGameplayPause(listener) {
        gameplayPauseListeners.add(listener)
        return () => gameplayPauseListeners.delete(listener)
      },
      onLeaderboardReceipt(listener) {
        leaderboardReceiptListeners.add(listener)
        return () => leaderboardReceiptListeners.delete(listener)
      },
      onModCatalog(listener) {
        modCatalogListeners.add(listener)
        return () => modCatalogListeners.delete(listener)
      },
      onModContent(listener) {
        modContentListeners.add(listener)
        return () => modContentListeners.delete(listener)
      },
      onModRuntime(listener) {
        modRuntimeListeners.add(listener)
        return () => modRuntimeListeners.delete(listener)
      },
      onEnemyEvent(listener) {
        enemyEventListeners.add(listener)
        return () => enemyEventListeners.delete(listener)
      },
      onPing(listener) {
        pingListeners.add(listener)
        return () => pingListeners.delete(listener)
      },
      onPartyState(listener) {
        partyStateListeners.add(listener)
        return () => partyStateListeners.delete(listener)
      },
      onPartyAction(listener) {
        partyActionListeners.add(listener)
        return () => partyActionListeners.delete(listener)
      },
      onSaveCheckpoint(listener) {
        saveCheckpointListeners.add(listener)
        return () => saveCheckpointListeners.delete(listener)
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
        if (
          !predictionEnabled
          || !isHubGameSnapshot(snapshot)
          || snapshot.levelUpBarrier !== null
          || gameplayPause !== null
        ) return frame
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
        const requestedInput = gameplayPause !== null
          || snapshot.levelUpBarrier !== null
          || offered
          || lifeState !== 'alive'
          || snapshot.run.phase === 'game-over'
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
          || (
            requestedInput.cast.quickbar !== null
            && (
              !Number.isInteger(requestedInput.cast.quickbar)
              || requestedInput.cast.quickbar < 0
              || requestedInput.cast.quickbar > 7
            )
          )
        ) throw new Error('game input must contain a primary level and native skill quickbar slot')
        if (!Number.isFinite(requestedInput.viewportWidth) || requestedInput.viewportWidth < 1) {
          throw new Error('game input must contain a positive finite viewport width')
        }
        const input: PlayerCharacterInput = {
          aim: requestedInput.aim ? { ...requestedInput.aim } : null,
          cast: { ...requestedInput.cast },
          movement: length > 1
            ? { x: movement.x / length, y: movement.y / length }
            : { ...movement },
          viewportWidth: requestedInput.viewportWidth,
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
      setCheatsEnabled(enabled) {
        if (!welcome || destroyed) return
        options.transport.send(encodeGameMessage({
          type: 'client-cheat-mode',
          enabled,
        }))
      },
      setHubActivity(activity) {
        if (
          !welcome
          || !snapshot
          || destroyed
          || snapshot.world.kind !== 'hub'
          || requestedHubActivity === activity
        ) return
        requestedHubActivity = activity
        options.transport.send(encodeGameMessage({
          type: 'client-hub-activity',
          activity,
        }))
      },
      requestGameplayPause(source) {
        if (!welcome || !snapshot || destroyed) return
        if (source !== null) {
          if (snapshot.world.kind === 'hub') return
          if (
            snapshot.levelUpBarrier !== null
            || (snapshot.run.phase !== 'hub' && snapshot.run.phase !== 'active')
          ) return
          if (
            gameplayPause !== null
            && (
              gameplayPause.ownerPlayerId !== welcome.playerId
              || gameplayPause.source === source
            )
          ) return
        } else if (gameplayPause?.ownerPlayerId !== welcome.playerId) return
        options.transport.send(encodeGameMessage(source === null
          ? { type: 'client-gameplay-pause', paused: false }
          : { type: 'client-gameplay-pause', paused: true, source }))
      },
      saveBeforeLeave() {
        if (!welcome || !snapshot || destroyed || deploymentRestarting) {
          return Promise.reject(new Error('The game session is not available to save.'))
        }
        if (pendingLeaveSave) return pendingLeaveSave.promise
        currentInput = copyInput(STOPPED_INPUT)
        sentInput = copyInput(STOPPED_INPUT)
        pendingInputs = []
        const requestId = nextLeaveSaveRequestId
        nextLeaveSaveRequestId = requestId === 0x7fff_ffff ? 1 : requestId + 1
        let resolveSave!: (checkpoint: GameSaveCheckpoint) => void
        let rejectSave!: (error: Error) => void
        const promise = new Promise<GameSaveCheckpoint>((resolve, reject) => {
          resolveSave = resolve
          rejectSave = reject
        })
        pendingLeaveSave = {
          promise,
          reject: rejectSave,
          requestId,
          resolve: resolveSave,
        }
        options.transport.send(encodeGameMessage({
          type: 'client-save-before-leave',
          requestId,
        }))
        return promise
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
      rerollSkill(offerSequence) {
        if (!welcome || !snapshot || destroyed) return
        const progression = snapshot.players[welcome.playerId]?.progression
        if (
          !progression?.sorcerorsCharmAvailable
          || progression.pendingOffer?.sequence !== offerSequence
        ) throw new Error('Roll Again is not available for the current skill offer.')
        session.sendInput(STOPPED_INPUT)
        options.transport.send(encodeGameMessage({
          type: 'client-level-up-action',
          action: 'reroll',
          offerSequence,
        }))
      },
      saveSkill(offerSequence) {
        if (!welcome || !snapshot || destroyed) return
        const progression = snapshot.players[welcome.playerId]?.progression
        if (
          !progression?.sorcerorsCharmAvailable
          || progression.pendingOffer?.sequence !== offerSequence
        ) throw new Error('Save Skill is not available for the current skill offer.')
        session.sendInput(STOPPED_INPUT)
        options.transport.send(encodeGameMessage({
          type: 'client-level-up-action',
          action: 'save',
          offerSequence,
        }))
      },
      selectConcentration(skillId) {
        if (!welcome || !snapshot || destroyed) return
        const progression = snapshot.players[welcome.playerId]?.progression
        if (
          !progression
          || nativeSkillCategory(skillId) !== 3
          || progression.mindChugTicksRemaining !== 0
          || (progression.learnedSkills.find(([id]) => id === skillId)?.[1] ?? 0) < 1
        ) throw new Error('The concentration is unavailable.')
        session.sendInput(STOPPED_INPUT)
        options.transport.send(encodeGameMessage({
          type: 'client-select-concentration',
          skillId,
        }))
      },
      selectConcentrationSlot(skillId, slot) {
        if (!welcome || !snapshot || destroyed) return
        const progression = snapshot.players[welcome.playerId]?.progression
        if (
          !progression
          || nativeSkillCategory(skillId) !== 3
          || progression.mindChugTicksRemaining !== 0
          || (slot === 1 && !progression.splitMind)
          || progression.concentrationSkillIds[slot === 0 ? 1 : 0] === skillId
          || (progression.learnedSkills.find(([id]) => id === skillId)?.[1] ?? 0) < 1
        ) throw new Error('The concentration is unavailable.')
        session.sendInput(STOPPED_INPUT)
        options.transport.send(encodeGameMessage({
          type: 'client-select-concentration-slot',
          skillId,
          slot,
        }))
      },
      selectPrimarySkill(skillId) {
        if (!welcome || !snapshot || destroyed) return
        const progression = snapshot.players[welcome.playerId]?.progression
        if (
          nativeSkillCategory(skillId) !== 1
          || (progression?.learnedSkills.find(([id]) => id === skillId)?.[1] ?? 0) < 1
          || (skillId === 52 && progression?.weldBuildId === null)
        ) throw new Error('The primary skill is unavailable.')
        session.sendInput(STOPPED_INPUT)
        options.transport.send(encodeGameMessage({
          type: 'client-select-primary-skill',
          skillId,
        }))
      },
      sendChatMessage(channel, text, targetPlayerId) {
        if (!welcome || destroyed) return
        if ((channel === 'whisper') !== (targetPlayerId !== undefined)) {
          throw new Error('Whispers require a target wizard.')
        }
        options.transport.send(encodeGameMessage({
          type: 'client-chat',
          channel,
          ...(targetPlayerId === undefined ? {} : { targetPlayerId }),
          text: normalizeGameChatText(text),
        }))
      },
      sendHubAction(action) {
        if (!welcome || !snapshot || destroyed) return
        session.sendInput(STOPPED_INPUT)
        options.transport.send(encodeGameMessage({
          type: 'client-hub-action',
          action,
        }))
      },
      inviteToParty(playerId) {
        if (!welcome || destroyed || playerId === welcome.playerId) return
        options.transport.send(encodeGameMessage({
          type: 'client-party-invite',
          targetPlayerId: playerId,
        }))
      },
      kickPartyPlayer(playerId) {
        if (!welcome || destroyed || playerId === welcome.playerId) return
        options.transport.send(encodeGameMessage({
          type: 'client-party-kick',
          targetPlayerId: playerId,
        }))
      },
      leaveParty() {
        if (!welcome || destroyed) return
        options.transport.send(encodeGameMessage({ type: 'client-party-leave' }))
      },
      rotatePartyCode() {
        if (!welcome || destroyed) return
        options.transport.send(encodeGameMessage({ type: 'client-party-rotate-code' }))
      },
      setPartyVisibility(visibility) {
        if (!welcome || destroyed) return
        options.transport.send(encodeGameMessage({
          type: 'client-party-settings',
          visibility,
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
      startTutorial() {
        if (!welcome || destroyed) return
        options.transport.send(encodeGameMessage({ type: 'client-start-tutorial' }))
      },
      sendTutorialAction(action) {
        if (!welcome || destroyed) return
        options.transport.send(encodeGameMessage({
          type: 'client-tutorial-action',
          action,
        }))
      },
    }

    options.transport.send(encodeGameMessage({
      type: 'client-hello',
      ...(options.allowModMismatch ? { allowModMismatch: true } : {}),
      cheatsEnabled: options.cheatsEnabled === true,
      protocolVersion: GAME_PROTOCOL_VERSION,
      credential: options.credential,
      character: options.character,
      profile: options.profile,
      ...(options.resumeToken ? { resumeToken: options.resumeToken } : {}),
      ...(options.saveDocument
        ? { save: options.saveDocument, saveIntent: options.saveIntent ?? 'resume' }
        : {}),
    }))

    function sendPing(): void {
      if (!welcome || destroyed || options.transport.readyState !== 'open') return
      const sentAtMs = now()
      let expiredPings = 0
      let oldestExpiredAgeMs = 0
      for (const [nonce, pendingAtMs] of pendingPings) {
        const ageMs = sentAtMs - pendingAtMs
        if (ageMs < PING_TIMEOUT_MS) continue
        pendingPings.delete(nonce)
        expiredPings += 1
        oldestExpiredAgeMs = Math.max(oldestExpiredAgeMs, ageMs)
      }
      if (expiredPings > 0) {
        options.diagnostics?.warning(
          'network.ping_timeout',
          'The game server did not answer one or more client pings within ten seconds.',
          `expiredPings=${expiredPings}; oldestAgeMs=${Math.round(oldestExpiredAgeMs)}`,
        )
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

    function rejectPendingLuaExecutions(error: Error): void {
      for (const pending of pendingLuaExecutions.values()) {
        globalThis.clearTimeout(pending.timeout)
        pending.reject(error)
      }
      pendingLuaExecutions.clear()
    }

    function rejectPendingLeaveSave(error: Error): void {
      const pending = pendingLeaveSave
      pendingLeaveSave = null
      pending?.reject(error)
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
          state.player.movementScale,
          state.participant,
        )
        state.player = {
          ...predicted.player,
          config: { ...state.player.config },
          economy: state.player.economy,
          lighting: state.player.lighting,
          movementScale: state.player.movementScale,
          progression: state.player.progression,
        }
        state.collisionRngState = predicted.collisionRngState
        state.predictedTicks += 1
        state.remainderMs -= tickMs
      }
      if (state.predictedTicks === maximumTicks) state.remainderMs = 0
    }

    function fail(error: unknown): void {
      const failure = GameConnectionFailure.from(error)
      if (!settled) {
        settled = true
        destroyed = true
        globalThis.clearTimeout(handshakeDeadline)
        stopPing()
        rejectPendingLeaveSave(failure)
        rejectPendingLuaExecutions(failure)
        removeClose()
        removeMessage()
        options.diagnostics?.error(
          'connection.failed',
          failure.message,
          diagnosticFailureDetail(failure),
        )
        options.transport.close(4008, failure.message.slice(0, 123))
        reject(failure)
        return
      }
      if (destroyed || fatalReported) return
      fatalReported = true
      destroyed = true
      globalThis.clearTimeout(handshakeDeadline)
      stopPing()
      rejectPendingLeaveSave(failure)
      rejectPendingLuaExecutions(failure)
      removeClose()
      removeMessage()
      options.diagnostics?.error(
        'connection.failed',
        failure.message,
        diagnosticFailureDetail(failure),
      )
      options.transport.close(4008, failure.message.slice(0, 123))
      snapshotListeners.clear()
      boneyardListeners.clear()
      gameplayPauseListeners.clear()
      enemyEventListeners.clear()
      pingListeners.clear()
      options.onFatal?.(failure)
    }

    function beginDeploymentRestart(message: ServerDeploymentRestartMessage): void {
      if (deploymentRestarting || destroyed) return
      const checkpoint = message.checkpointSequence === 0
        ? null
        : latestSaveCheckpoint
      if (
        message.checkpointSequence !== 0
        && checkpoint?.sequence !== message.checkpointSequence
      ) {
        fail(new Error('The deployment restart did not include its final save checkpoint.'))
        return
      }
      deploymentRestarting = true
      rejectPendingLeaveSave(new Error('The game is restarting for an update.'))
      currentInput = copyInput(STOPPED_INPUT)
      sentInput = copyInput(STOPPED_INPUT)
      pendingInputs = []
      options.diagnostics?.info(
        'deployment.restart_requested',
        'The game server requested a saved restart for an update.',
        `targetRevision=${message.targetRevision}; checkpointSequence=${message.checkpointSequence}`,
      )
      const persist = options.onDeploymentRestart
      if (!persist) {
        options.diagnostics?.warning(
          'deployment.save_unavailable',
          'This game shell has no deployment save owner, so it cannot acknowledge the update.',
        )
        return
      }
      void persist({ checkpoint, targetRevision: message.targetRevision }).then(() => {
        if (destroyed || options.transport.readyState !== 'open') return
        options.transport.send(encodeGameMessage({
          type: 'client-deployment-ready',
          checkpointSequence: message.checkpointSequence,
          targetRevision: message.targetRevision,
        }))
        options.diagnostics?.info(
          'deployment.save_ready',
          'The final game checkpoint is saved and ready for the update.',
          `targetRevision=${message.targetRevision}; checkpointSequence=${message.checkpointSequence}`,
        )
      }).catch((error: unknown) => {
        options.diagnostics?.error(
          'deployment.save_failed',
          'The final game checkpoint could not be saved before the update.',
          error instanceof Error ? error.message : 'Game save failed.',
        )
      })
    }

    function finishDeploymentRestart(): void {
      if (destroyed) return
      destroyed = true
      globalThis.clearTimeout(handshakeDeadline)
      stopPing()
      rejectPendingLeaveSave(new Error('The game is restarting for an update.'))
      rejectPendingLuaExecutions(new Error('The game is restarting for an update.'))
      removeClose()
      removeMessage()
      snapshotListeners.clear()
      boneyardListeners.clear()
      chatMessageListeners.clear()
      chatRejectionListeners.clear()
      chatMessages = []
      gameplayPauseListeners.clear()
      leaderboardReceiptListeners.clear()
      modCatalogListeners.clear()
      modContentListeners.clear()
      modRuntimeListeners.clear()
      enemyEventListeners.clear()
      pingListeners.clear()
      partyStateListeners.clear()
      saveCheckpointListeners.clear()
      options.diagnostics?.info(
        'deployment.transport_closed',
        'The game connection closed for the announced update.',
      )
    }
  })
}

function nextAvailableLuaRequestId(
  start: number,
  pending: ReadonlyMap<number, PendingLuaExecution>,
): number {
  let requestId = start
  while (pending.has(requestId)) {
    requestId = requestId === 0x7fff_ffff ? 1 : requestId + 1
    if (requestId === start) throw new Error('Lua request ID space is exhausted.')
  }
  return requestId
}

function diagnosticFailureDetail(failure: GameConnectionFailure): string | null {
  if (failure.technicalDetail) return failure.technicalDetail
  return failure.stack && failure.stack !== `${failure.name}: ${failure.message}`
    ? failure.stack
    : null
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
    lighting: { ...player.lighting },
    position: { ...player.position },
    progression: {
      ...player.progression,
      hagathaRuntime: { ...player.progression.hagathaRuntime },
      learnedSkills: player.progression.learnedSkills.map((entry) => [...entry]),
      skillQuickbar: [...player.progression.skillQuickbar],
      weldComponentRanks: player.progression.weldComponentRanks === null
        ? null
        : [...player.progression.weldComponentRanks],
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

function copyParticipant(
  participant: ProtocolHubParticipantState,
): ProtocolHubParticipantState {
  return {
    activity: participant.activity,
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
    viewportWidth: input.viewportWidth,
  }
}

function sameInput(first: PlayerCharacterInput, second: PlayerCharacterInput): boolean {
  return sameCast(first, second)
    && first.aim?.x === second.aim?.x
    && first.aim?.y === second.aim?.y
    && first.movement.x === second.movement.x
    && first.movement.y === second.movement.y
    && first.viewportWidth === second.viewportWidth
}

function sameCast(first: PlayerCharacterInput, second: PlayerCharacterInput): boolean {
  return first.cast.primary === second.cast.primary
    && first.cast.quickbar === second.cast.quickbar
}

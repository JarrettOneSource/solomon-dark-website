import { randomBytes, timingSafeEqual } from 'node:crypto'
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
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import type {
  HubMemorialPlayerProfile,
  HubMemorialState,
} from '../core-kernels/hub-memorial.ts'
import {
  GAME_FIXED_TICK_SECONDS,
  GAME_TICK_RATE,
  addPlayerCharacter,
  applyGameSimulationHubAction,
  applyGameSimulationTutorialAction,
  armGameSimulationCollegeIntro,
  bindGameSimulationPlayerSkillQuickbar,
  confirmGameSimulationLoadout,
  completedGameSimulationCollegeIntroPlayerIds,
  continueGameSimulationOver,
  createGameSimulation,
  declineGameSimulationTutorial,
  detachGameSimulationPlayer,
  enterBoneyardWorld,
  getPlayerCharacter,
  getPlayerEconomy,
  getPlayerProgression,
  grantGameSimulationPlayerExperience,
  projectDetachedGameSimulationPlayer,
  reconcileGameSimulationPlayerModPackages,
  rejoinGameSimulationPlayer,
  removePlayerCharacter,
  returnGameSimulationToHub,
  rerollDetachedGameSimulationPlayerSkill,
  rerollGameSimulationPlayerSkill,
  saveDetachedGameSimulationPlayerSkill,
  saveGameSimulationPlayerSkill,
  selectGameSimulationPlayerConcentration,
  selectGameSimulationPlayerConcentrationSlot,
  selectGameSimulationPlayerPrimarySkill,
  selectDetachedGameSimulationPlayerSkill,
  selectGameSimulationPlayerSkill,
  stepGameSimulationTick,
  synchronizeDetachedGameSimulationPlayer,
  type GameSimulationState,
  type DetachedGameSimulationPlayer,
  type PlayerId,
} from '../core-server/game-simulation.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { gameOverExitDurationTicks } from '../core-kernels/game-run.ts'
import { NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS } from '../core-kernels/native-tutorial.ts'
import type {
  HubInventoryAction,
  ModConsumableCatalogEntry,
} from '../core-kernels/hub-economy.ts'
import {
  createBoneyardCatalog,
  materializeBoneyard,
  materializeStockTutorial,
  type BoneyardCatalog,
} from './boneyard-catalog.ts'
import {
  EMPTY_CONTENT_MANIFEST_SHA256,
  GAME_HOST_ENDED_SESSION_CLOSE_CODE,
  GAMEPLAY_RESUME_GRACE_DURATION_MS,
  GAME_SESSION_REPLACED_CLOSE_CODE,
  GAME_WEBSOCKET_MAX_PAYLOAD_BYTES,
  PARTY_ACTION_REJECTIONS,
  GAME_PROTOCOL_VERSION,
  PLAYER_CHARACTER_KERNEL_VERSION,
  GameProtocolError,
  decodeClientGameMessage,
  encodeGameMessage,
  gameChatActivityText,
  type GameContentManifest,
  type GameChatActivity,
  type GameChatChannel,
  type GameOnlinePreferences,
  type GamePlayerCardProfile,
  type GameSessionKind,
  type GameplayPauseState,
  type GameplayResumeGraceReason,
  type GameplayResumeGraceState,
  type HubPlayerActivity,
  type LuaConsoleObject,
  type PartyAction,
  type PartyActionRejection as ProtocolPartyActionRejection,
  type PartyJoinRequester,
  type PartyPlayerProfile,
  type PlayerSocialProfile,
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
  deriveGameActivityEvents,
  projectGameActivity,
} from './game-activity-events.ts'
import type { RuntimeEventSink } from './runtime-event-publisher.ts'
import {
  applyWebLuaCommands,
  createWebLuaFrameState,
  deriveWebLuaEvents,
  type WebLuaDerivedEvent,
} from './lua/web-lua-game-api.ts'
import { WebLuaRuntime } from './lua/web-lua-runtime.ts'
import {
  WEB_LUA_MAX_PENDING_EXECUTIONS,
} from './lua/web-lua-contract.ts'
import {
  ML_BOT_CHARACTER,
  MlBotHostController,
  type MlBotHostIntent,
  type MlBotPolicyInference,
} from './ml-bot-host-controller.ts'
import {
  createGameProfileSaveDocument,
  createGameSaveDocument,
  hydrateGameSaveProfile,
  retireGameSaveWizard,
  restoreGameSaveDocument,
  restoreGameSaveProfile,
  type RestoredGameSaveProfile,
} from '../save/game-save-document.ts'
import { completedHallOfFameEntry } from '../hall-of-fame-entry.ts'
import { createGameLeaderboardReceipt } from './game-leaderboard-receipt.ts'
import {
  parseGameSaveDocument,
  type GameSaveIntegrity,
} from '../save/game-save-contract.ts'
import type { NativeGameSaveSource } from '../save/portable-game-profile.ts'
import {
  createPartySystem,
  decidePartyJoinRequest,
  joinPartyPlayer,
  partyByJoinCode,
  partyByListingId,
  partyForPlayer,
  projectPartyState,
  registerPartyPlayer,
  removePartyPlayer as removePrivatePartyPlayer,
  requestPartyJoin,
  rotatePartyJoinCode,
  setPartyVisibility,
  restorePartyMembership,
  type PartyIdentity,
  type PartySystemState,
} from './party-system.ts'
import {
  projectHostPresence,
  type HostPresenceEntry,
} from './host-presence.ts'
import {
  projectPublicPartyDirectory,
  type PublicPartyDirectoryEntry,
} from './public-party-directory.ts'
import {
  acceptSharedPartyInvitation,
  addSharedHubPlayer,
  confirmSharedPartyLoadout,
  continueSharedPartyGameOver,
  createSharedGameWorlds,
  denySharedPartyInvitation,
  detachSharedGamePlayer,
  inviteSharedPartyPlayer,
  joinSharedPartyPlayer,
  kickSharedPartyPlayer,
  leaveSharedParty,
  removeSharedGamePlayer,
  rejoinSharedPartyRunPlayer,
  replaceSharedGameStateForPlayer,
  restoreSharedGamePlayer,
  sharedGameStateForPlayer,
  sharedLoadedBoneyardForPlayer,
  sharedPartySaveStateForPlayer,
  startSharedPartyRun,
  stepSharedGameWorlds,
  type SharedPartyRun,
  type SharedGameWorldsState,
} from './shared-game-worlds.ts'
import type {
  MaterializedWebSessionContent,
  WebSessionContentSummary,
} from './web-mod-content.ts'
import {
  prepareModHost,
  type PreparedModHost,
} from './prepared-mod-host.ts'
import type { PreparedModSaveState } from './prepared-mod-save.ts'
import {
  createPartyRecoveryClaim,
  decodePartyRecoveryClaim,
  verifyPartyRecoveryClaim,
  type PartyRecoveryClaim,
  type PartyRecoveryRosterMember,
} from './party-recovery-claim.ts'
import type { PartyRosterPlayer } from '../protocol/party-state.ts'
import { gameplayResumeGraceReasonForPauseSource } from '../gameplay-resume-grace.ts'
import type {
  GameSocialBroker,
  GameSocialChatDelivery,
  GameSocialConnection,
} from './game-social-broker.ts'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
export const GAME_SAVE_AUTOSAVE_INTERVAL_TICKS = GAME_TICK_RATE * 30
const DEFAULT_DEPLOYMENT_SAVE_TIMEOUT_MS = 30_000
const GAME_CHAT_RATE_LIMIT = 5
const GAME_CHAT_RATE_WINDOW_MS = 5_000
const PARTY_JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type GameHostAuthentication =
  | { kind: 'shared'; credential: string; leaderboardUserId?: number | null }
  | {
      kind: 'tickets'
      claim: (credential: string) => GameHostAdmission | null
    }

export interface GameHostAdmission {
  readonly content: MaterializedWebSessionContent
  readonly developerAccess?: boolean
  readonly leaderboardUserId: number | null
  readonly partyId?: string
  readonly partyRecoverySeed?: boolean
  readonly partyRejoinToken?: string
  readonly reservationId?: string
  readonly observer?: GameHostObserverAdmission
}

export interface GameHostObserverAdmission {
  readonly runId: string
  readonly userId: number
  readonly username: string
}

type GameHostRole = 'shared'

interface AuthenticatedGameHostRole {
  readonly content: MaterializedWebSessionContent | null
  readonly developerAccess: boolean
  readonly leaderboardUserId: number | null
  readonly partyId: string | null
  readonly partyRecoverySeed: boolean
  readonly partyRejoinToken: string | null
  readonly reservationId: string | null
  readonly observer: GameHostObserverAdmission | null
  readonly role: GameHostRole
}

interface PartyModRuntimeScope {
  readonly content: MaterializedWebSessionContent
  readonly pendingEvents: WebLuaDerivedEvent[]
  readonly runtime: PreparedModHost
}

export interface GameHostOptions {
  allowedOrigins?: readonly string[]
  authentication: GameHostAuthentication
  boneyards?: BoneyardCatalog
  content?: GameContentManifest
  contentSummary?: WebSessionContentSummary
  createBoneyardSeedBytes?: () => Buffer
  createSimulation?: () => GameSimulationState
  host?: string
  heartbeatIntervalMs?: number
  initialMemorial?: HubMemorialState
  initialPlayerExperience?: number
  leaderboardReceiptSecret?: string
  log?: GameServerLogSink
  logContext?: Readonly<Record<string, unknown>>
  luaWasmPath?: string
  maxPlayers?: number
  mlBotPolicy?: MlBotPolicyInference
  modAssets?: readonly import('../protocol/game-protocol.ts').GameModAsset[]
  modContent?: MaterializedWebSessionContent
  onPlayerCountChanged?: (playerCount: number) => void
  onMemorialStateChanged?: (state: HubMemorialState) => void
  onPartyRecoveryEnded?: (
    recoveryId: string,
    disposition: 'suspended' | 'terminal',
  ) => void
  partyRecoveryRevision?: string
  partyRecoverySecret?: string
  port?: number
  resetWhenEmpty?: boolean
  runtimeEvents?: RuntimeEventSink
  sessionKind?: GameSessionKind
  sharedHub?: boolean
  snapshotRate?: number
  socialBroker?: GameSocialBroker
  socialHostId?: string
  trustedProxy?: boolean
}

export interface GameHostAddress {
  host: string
  port: number
  url: string
}

export interface GameHost {
  address: GameHostAddress
  botCount(): number
  botPlayerIds(): readonly string[]
  botTelemetry(): readonly GameHostMlBotTelemetry[]
  capacityParticipantCount(): number
  close(reason?: GameHostCloseReason): Promise<void>
  hubPlayerCount(): number
  humanPlayerCount(): number
  hostPlayerId(): string | null
  loadedBoneyard(): LoadedBoneyard | null
  observationTargets(): readonly GameHostObservationTarget[]
  modCatalog(): readonly ModConsumableCatalogEntry[]
  cancelPartyReservation(reservationId: string): void
  createPartyJoinRequest(input: GameHostPartyJoinRequestInput): GameHostPartyJoinRequestResult
  partyCount(): number
  partyRejoinTarget(token: string): GameHostPartyRejoinTarget | null
  partyJoinRequestStatus(token: string): GameHostPartyJoinRequestStatus | null
  partyTargetByCode(joinCode: string): GameHostPartyTarget | null
  partyTargetByListingId(listingId: string): GameHostPartyTarget | null
  playerState(playerId: string): GameSimulationState | null
  presence(): readonly HostPresenceEntry[]
  publicParties(): readonly PublicPartyDirectoryEntry[]
  restartForDeployment(
    targetRevision: string,
    timeoutMs?: number,
  ): Promise<GameHostDeploymentRestartResult>
  reservePartyJoin(partyId: string, reservationId: string, expiresAt: number): ProtocolPartyActionRejection | null
  reservePartyRejoin(token: string, reservationId: string, expiresAt: number): GameHostPartyRejoinRejection | null
  state(): GameSimulationState
  runCount(): number
}

export interface GameHostMlBotTelemetry {
  readonly decisions: number
  readonly gold: number
  readonly items: number
  readonly kills: number
  readonly lifeState: string
  readonly playerId: string
  readonly potionsUsed: number
  readonly skillPicks: number
  readonly tick: number
  readonly waveReached: number
  readonly wavesCompleted: number
}

export interface GameHostDeploymentRestartResult {
  readonly players: number
  readonly savedPlayers: number
  readonly unacknowledgedPlayers: number
}

export interface GameHostPartyTarget {
  readonly cheatsEnabled: boolean
  readonly content: WebSessionContentSummary
  readonly id: string
  readonly leader: string
  readonly memberCount: number
  readonly status: 'hub' | 'playing'
  readonly visibility: 'invite-only' | 'private' | 'public'
}

export type GameHostPartyRejoinRejection =
  | 'already-reserved'
  | 'player-connected'
  | 'run-unavailable'

export interface GameHostPartyRejoinTarget {
  readonly content: MaterializedWebSessionContent
  readonly developerAccess: boolean
  readonly globalScoreEligible: boolean
  readonly leaderboardUserId: number | null
  readonly localOnly: boolean
  readonly partyId: string
  readonly playerId: string
  readonly profile: PlayerSocialProfile
  readonly runId: string
  readonly status: 'connected' | 'detached' | 'reserved' | 'staging'
}

export interface GameHostObservationTarget {
  readonly boneyardName: string
  readonly partyLeader: string
  readonly playerCount: number
  readonly players: readonly string[]
  readonly runId: string
  readonly visibility: 'invite-only' | 'private' | 'public'
  readonly waveNumber: number
}

export interface GameHostPartyJoinRequestInput {
  readonly expiresAt: number
  readonly id: string
  readonly listingId: string
  readonly requester: PartyJoinRequester
  readonly token: string
}

export type GameHostPartyJoinRequestResult =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly reason: ProtocolPartyActionRejection }

export interface GameHostPartyJoinRequestStatus {
  readonly partyId: string
  readonly status: 'accepted' | 'denied' | 'pending'
}

export type GameHostCloseReason = 'host-ended-session' | 'server-shutdown'

type SharedGameplayPauseScope = { readonly partyId: string }

interface HostGameplayResumeGrace {
  readonly readyPlayerIds: Set<PlayerId>
  readonly reason: GameplayResumeGraceReason
  readonly requiredPlayerIds: Set<PlayerId>
  readonly sequence: number
  readonly waitingPlayerIds: Set<PlayerId>
  deadlineMs: number | null
}

interface HostClient {
  acknowledgedSequence: number
  acknowledgedSnapshotSequence: number
  activeInput: PlayerCharacterInput
  chatSentAtMs: number[]
  cheatsEnabled: boolean
  connectedAtMs: number
  content: MaterializedWebSessionContent | null
  developerAccess: boolean
  displayName: string
  profile: PlayerSocialProfile
  globalScoreEligible: boolean
  hubActivity: HubPlayerActivity | null
  localOnly: boolean
  nativeSource: NativeGameSaveSource | null
  onlinePreferences: GameOnlinePreferences
  lastReceivedSequence: number
  lastModRequestId: number
  lastSentSnapshotSequence: number
  leaderboardUserId: number | null
  partyRejoinSlot: PartyRejoinSlot | null
  playerId: PlayerId
  queuedInputs: Map<number, QueuedClientInput>
  pendingLuaRequestIds: Set<number>
  replicationRecovery: ReplicationRecoveryState | null
  resumeToken: string
  socialConnection: GameSocialConnection | null
  playerReference: string
  sentReplicationBaselines: Map<number, ReplicatedEntityBaseline>
  socket: WebSocket
  tutorialEligible: boolean
}

interface HostObserver {
  acknowledgedSnapshotSequence: number
  connectedAtMs: number
  lastSentSnapshotSequence: number
  readonly observerId: string
  readonly requestedByUserId: number
  readonly requestedByUsername: string
  replicationRecovery: ReplicationRecoveryState | null
  readonly runId: string
  sentReplicationBaselines: Map<number, ReplicatedEntityBaseline>
  readonly socket: WebSocket
  readonly viewPlayerId: string
}

interface ReplicationPeer {
  acknowledgedSnapshotSequence: number
  lastSentSnapshotSequence: number
  replicationRecovery: ReplicationRecoveryState | null
  sentReplicationBaselines: Map<number, ReplicatedEntityBaseline>
}

interface ReplicationRecoveryState {
  readonly cause: 'baseline-missing' | 'client-request'
  readonly firstAcknowledgedSequence: number
  keyframeSequence: number | null
  lastStaleAcknowledgedSequence: number
  readonly requestedAtMs: number
  staleAcknowledgementCount: number
}

type ReplicationAcknowledgementResult =
  | { readonly kind: 'accepted' | 'ahead' | 'ignored' }
  | {
      readonly cause: ReplicationRecoveryState['cause']
      readonly kind: 'recovery-pending'
      readonly started: boolean
    }
  | {
      readonly kind: 'recovered'
      readonly recovery: ReplicationRecoveryState
    }

interface ObservationWorld {
  readonly authorityPlayerId: string | null
  readonly loadedBoneyard: LoadedBoneyard
  readonly state: GameSimulationState
  readonly viewPlayerId: string
}

interface HostBot {
  activeInput: PlayerCharacterInput
  readonly character: PlayerCharacterConfig
  readonly controller: MlBotHostController
  readonly displayName: string
  decisions: number
  kills: number
  lastCompletedWaves: number
  lastKills: number
  lastRunId: string | null
  readonly playerId: PlayerId
  readonly profile: PlayerSocialProfile
  potionsUsed: number
  readonly queuedIntents: MlBotHostIntent[]
  skillPicks: number
  waveReached: number
  wavesCompleted: number
}

interface PendingBotInvitation {
  readonly acceptAtMs: number
  readonly invitationId: string
  readonly playerId: PlayerId
}

interface PendingBotSummon {
  readonly character: PlayerCharacterConfig
  readonly playerId: PlayerId
}

interface ExternalPartyJoinRequest {
  readonly expiresAt: number
  readonly id: string
  readonly partyId: string
  readonly requester: PartyJoinRequester
  status: 'accepted' | 'denied' | 'pending'
  readonly token: string
}

interface PartyJoinReservation {
  readonly expiresAt: number
  readonly partyId: string
}

interface PartyRejoinSlot {
  connected: boolean
  readonly content: MaterializedWebSessionContent
  readonly developerAccess: boolean
  detachedState: DetachedGameSimulationPlayer | null
  readonly globalScoreEligible: boolean
  readonly leaderboardUserId: number | null
  readonly localOnly: boolean
  readonly partyId: string
  partyIdentity: PartyIdentity | null
  readonly playerId: string
  profile: PlayerSocialProfile
  readonly recoveryId: string
  reservation: Readonly<{ expiresAt: number; id: string }> | null
  readonly runId: string
  token: string | null
}

interface PartyRecoveryLineage {
  readonly content: MaterializedWebSessionContent
  readonly partyLeaderPlayerId: string
  readonly partyId: string
  readonly partyMemberCount: number
  readonly partyRoster: readonly PartyRecoveryRosterMember[]
  readonly partyVisibility: PartyRecoveryClaim['partyVisibility']
  readonly recoveryId: string
  readonly runId: string
}

interface QueuedClientInput {
  input: PlayerCharacterInput
  sequence: number
  targetTick: number
}

interface DeploymentRestartState {
  readonly acknowledged: Set<WebSocket>
  readonly checkpointSequences: Map<WebSocket, number>
  readonly pending: Set<WebSocket>
  readonly ready: Promise<void>
  readonly resolveReady: () => void
  readonly targetRevision: string
}

export async function startGameHost(options: GameHostOptions): Promise<GameHost> {
  validateAuthentication(options.authentication)
  if (options.leaderboardReceiptSecret !== undefined
    && Buffer.byteLength(options.leaderboardReceiptSecret, 'utf8') < 32) {
    throw new Error('Game host leaderboard receipt secret must contain at least 32 bytes')
  }
  const partyRecoverySecret = options.partyRecoverySecret
    ?? randomBytes(32).toString('base64url')
  if (Buffer.byteLength(partyRecoverySecret, 'utf8') < 32) {
    throw new Error('Game host party recovery secret must contain at least 32 bytes')
  }
  const partyRecoveryRevision = options.partyRecoveryRevision?.trim().toLowerCase() ?? null
  if (partyRecoveryRevision !== null && !/^[0-9a-f]{40}$/.test(partyRecoveryRevision)) {
    throw new Error('Game host party recovery revision must be a full Git commit ID')
  }
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? 0
  const maxPlayers = options.maxPlayers ?? 16
  const resetWhenEmpty = options.resetWhenEmpty ?? false
  const snapshotRate = options.snapshotRate ?? 20
  const heartbeatIntervalMs = resolveGameHeartbeatInterval(options.heartbeatIntervalMs)
  const boneyards = options.boneyards ?? createBoneyardCatalog()
  const content = options.content ?? {
    manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256,
    mods: [],
  }
  const contentSummary = options.contentSummary ?? {
    manifestSha256: content.manifestSha256,
    mods: content.mods.map(mod => ({
      assets: (options.modAssets ?? []).filter(asset => (
        asset.modId.toLowerCase() === mod.id.toLowerCase()
      )),
      contentSha256: mod.contentSha256,
      graphSha256: null,
      id: mod.id,
      name: mod.id,
      slug: mod.id,
      version: mod.version,
    })),
  }
  const sharedHub = options.sharedHub ?? false
  const sessionKind = options.sessionKind ?? (sharedHub ? 'global-hub' : 'standalone')
  const socialHostId = options.socialHostId
    ?? `game-host-${randomBytes(18).toString('base64url')}`
  if (sharedHub !== (sessionKind === 'global-hub')) {
    throw new Error('shared Hub ownership and session kind disagree')
  }
  if (!sharedHub && (
    options.initialMemorial !== undefined
    || options.onMemorialStateChanged !== undefined
  )) {
    throw new Error('Memorial persistence belongs only to the shared Hub')
  }
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

  let sharedWorlds: SharedGameWorldsState | null = sharedHub
    ? createSharedGameWorlds(
        randomBytes(4).readUInt32LE(),
        options.createSimulation === undefined
          ? undefined
          : createInitialSimulation(options.createSimulation),
        options.initialMemorial,
      )
    : null
  let privateParties: PartySystemState | null = sessionKind === 'private-college'
    ? createPartySystem()
    : null
  let state = sharedWorlds?.hub ?? createInitialSimulation(options.createSimulation)
  let gameplayPause: GameplayPauseState | null = null
  const sharedGameplayPauses = new Map<string, GameplayPauseState>()
  let gameplayResumeGrace: HostGameplayResumeGrace | null = null
  const sharedGameplayResumeGraces = new Map<string, HostGameplayResumeGrace>()
  let nextGameplayResumeGraceSequence = 1
  let nextPlayerId = 1
  let hostPlayerId: PlayerId | null = null
  let privateCollegeCheatsEnabled = false
  let privateCollegeCheatPolicyInitialized = false
  let loadedBoneyard: LoadedBoneyard | null = null
  let nextChatSequence = 1
  const socialChatSequences = new Map<number, number>()
  let nextSnapshotSequence = 1
  const saveDocuments = new Map<string, string>()
  const saveSequences = new Map<string, number>()
  let nextLuaRunSeed: number | null = null
  let luaRuntime: WebLuaRuntime | null = null
  let luaRuntimeInitialization: Promise<WebLuaRuntime> | null = null
  let luaRuntimeGeneration = 0
  let luaRuntimeOwnerPlayerId: PlayerId | null = null
  let privateModHost: PreparedModHost | null = null
  const playerContents = new Map<PlayerId, MaterializedWebSessionContent>()
  const pendingRestoredModState = new Map<PlayerId, PreparedModSaveState>()
  const partyModRuntimeInitializations = new Map<string, Promise<PartyModRuntimeScope>>()
  const partyModRuntimes = new Map<string, PartyModRuntimeScope>()
  const boneyardRendererReadiness = new Map<string, {
    ready: Set<PlayerId>
    required: Set<PlayerId>
  }>()
  const startingPartyIds = new Set<string>()
  let closed = false
  let deploymentRestart: DeploymentRestartState | null = null
  let ticking = false
  let lastTickLagWarningAt = Number.NEGATIVE_INFINITY
  let nextTickAt = performance.now() + GAME_FIXED_TICK_SECONDS * 1000
  const clients = new Map<WebSocket, HostClient>()
  const playerReferences = new Map<PlayerId, string>()
  const collegeIntroReadyPlayerIds = new Set<PlayerId>()
  const observers = new Map<WebSocket, HostObserver>()
  const bots = new Map<PlayerId, HostBot>()
  const failedBots = new Map<PlayerId, Error>()
  const pendingBotInvitations: PendingBotInvitation[] = []
  const pendingBotSummons: PendingBotSummon[] = []
  let nextBotOrdinal = 1
  const externalPartyJoinRequests = new Map<string, ExternalPartyJoinRequest>()
  const partyJoinReservations = new Map<string, PartyJoinReservation>()
  const partyRejoinSlots = new Map<string, PartyRejoinSlot>()
  const partyRecoveryLineages = new Map<string, PartyRecoveryLineage>()
  const pendingLuaEvents: WebLuaDerivedEvent[] = []
  const leaderboardIneligibleRunIds = new Set<string>()
  const issuedLeaderboardReceipts = new Set<string>()
  const pending = new Set<WebSocket>()
  const pendingPartyRejoins = new WeakMap<WebSocket, PartyRejoinSlot>()
  const supersededClients = new WeakSet<WebSocket>()
  const disconnectCauses = new WeakMap<WebSocket, { reason: string; source: string }>()
  const logDetails = (details: Readonly<Record<string, unknown>> = {}) => ({
    ...options.logContext,
    ...details,
  })
  const emitRuntimeEvent = (
    event: string,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) => options.runtimeEvents?.({
    component: 'game-host',
    details: logDetails(details),
    event,
    message,
    occurredAtUtc: new Date().toISOString(),
  })
  const server = createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({
        status: 'ok',
        tick: state.tick,
        bots: bots.size,
        humanPlayers: clients.size,
        players: capacityParticipantCount(),
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
    maxPayload: GAME_WEBSOCKET_MAX_PAYLOAD_BYTES,
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

      const observer = observers.get(socket)
      if (observer) {
        if (message.type === 'client-ping') {
          socket.send(encodeGameMessage({ type: 'server-pong', nonce: message.nonce }))
          return
        }
        if (message.type === 'client-snapshot-ack') {
          const result = acknowledgeReplicationSnapshot(
            observer,
            message.sequence,
            message.requireKeyframe,
          )
          if (result.kind === 'ahead') {
            disconnect(socket, 'invalid-message', 'Snapshot acknowledgement is ahead of the server.')
            return
          }
          if (
            result.kind === 'recovery-pending'
            && result.started
            && result.cause === 'baseline-missing'
          ) {
            logReplicationBaselineMissing(
              options.log,
              logDetails,
              observer,
              'observer',
              message.sequence,
              { observerId: observer.observerId },
            )
          }
          if (result.kind === 'recovered') {
            logReplicationBaselineRecovered(
              options.log,
              logDetails,
              observer,
              'observer',
              result.recovery,
              { observerId: observer.observerId },
            )
          }
          return
        }
        if (message.type === 'client-disconnect') {
          disconnectCauses.set(socket, {
            reason: 'observer requested disconnect',
            source: 'observer-request',
          })
          socket.close(1000, 'observer disconnect')
          return
        }
        disconnect(socket, 'invalid-message', 'Observer connections are read-only.')
        return
      }

      const client = clients.get(socket)
      if (!client) {
        if (deploymentRestart) {
          disconnectCauses.set(socket, {
            reason: 'game updating',
            source: 'deployment-restart',
          })
          socket.close(1012, 'game updating')
          return
        }
        if (message.type === 'client-observer-hello') {
          if (message.protocolVersion !== GAME_PROTOCOL_VERSION) {
            disconnect(
              socket,
              'protocol-mismatch',
              `Protocol ${GAME_PROTOCOL_VERSION} is required.`,
            )
            return
          }
          const authenticated = authenticate(message.credential, options.authentication)
          const observerAdmission = authenticated?.observer ?? null
          if (!authenticated?.developerAccess || !observerAdmission) {
            disconnect(socket, 'authentication-failed', 'The observer credential is invalid.')
            return
          }
          const observed = observationWorld(observerAdmission.runId)
          if (!observed) {
            disconnect(socket, 'authentication-failed', 'The observed match has ended.')
            return
          }
          if (observers.size >= 8) {
            disconnect(socket, 'server-full', 'The observer capacity is full.')
            return
          }
          clearTimeout(helloDeadline)
          pending.delete(socket)
          const welcomeSnapshot = createGameSnapshot(
            observed.state,
            observed.authorityPlayerId,
            {},
          )
          const snapshotSequence = nextSnapshotSequence
          nextSnapshotSequence += 1
          const welcomeBaseline = createReplicatedEntityBaseline(welcomeSnapshot)
          const joinedObserver: HostObserver = {
            acknowledgedSnapshotSequence: snapshotSequence,
            connectedAtMs: Date.now(),
            lastSentSnapshotSequence: snapshotSequence,
            observerId: `observer-${randomBytes(12).toString('base64url')}`,
            requestedByUserId: observerAdmission.userId,
            requestedByUsername: observerAdmission.username,
            replicationRecovery: null,
            runId: observerAdmission.runId,
            sentReplicationBaselines: new Map([[snapshotSequence, welcomeBaseline]]),
            socket,
            viewPlayerId: observed.viewPlayerId,
          }
          observers.set(socket, joinedObserver)
          socket.send(encodeGameMessage({
            type: 'server-welcome',
            cheatsEnabled: sessionKind === 'private-college' && privateCollegeCheatsEnabled,
            developerAccess: false,
            observer: true,
            protocolVersion: GAME_PROTOCOL_VERSION,
            playerId: observed.viewPlayerId,
            resumeToken: joinedObserver.observerId,
            serverTickRate: GAME_TICK_RATE,
            snapshotRate,
            sessionKind,
            kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
            kernelParameters: {
              fixedTickSeconds: GAME_FIXED_TICK_SECONDS,
              movementAcceleration: PLAYER_CHARACTER_INPUT_ACCELERATION,
              movementLaneCap: PLAYER_CHARACTER_MOVEMENT_LANE_CAP,
              movementRetention: PLAYER_CHARACTER_MOVEMENT_RETENTION,
              movementThresholdSquared: PLAYER_CHARACTER_MOVEMENT_THRESHOLD_SQUARED,
              playerRadius: PLAYER_CHARACTER_RADIUS,
            },
            content: authenticated.content?.manifest ?? content,
            modAssets: authenticated.content?.assets ?? options.modAssets ?? [],
            modCatalog: sharedHub ? [] : privateModHost?.content.consumables() ?? [],
            boneyards: [observed.loadedBoneyard.choice],
            gameplayPause: gameplayPauseForPlayer(observed.viewPlayerId),
            gameplayResumeGrace: gameplayResumeGraceForPlayer(observed.viewPlayerId),
            snapshot: welcomeSnapshot,
            snapshotSequence,
          }))
          sendPreparedModProjection(
            socket,
            modRuntimeScopeForPlayer(observed.viewPlayerId)?.runtime ?? privateModHost,
          )
          sendPreparedModRuntime(
            socket,
            modRuntimeScopeForPlayer(observed.viewPlayerId)?.runtime ?? privateModHost,
            observed.viewPlayerId,
          )
          socket.send(encodeGameMessage({
            type: 'server-boneyard-loaded',
            boneyard: observed.loadedBoneyard,
          }))
          const details = {
            boneyardName: observed.loadedBoneyard.choice.name,
            observerId: joinedObserver.observerId,
            observerUserId: joinedObserver.requestedByUserId,
            observerUsername: joinedObserver.requestedByUsername,
            runId: joinedObserver.runId,
          }
          logGameServerEvent(
            options.log,
            'game-host',
            'info',
            'observer.connected',
            'A developer observer connected to an active match.',
            logDetails(details),
          )
          emitRuntimeEvent(
            'observer.connected',
            'A developer observer connected to an active match.',
            details,
          )
          return
        }
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
        const authenticated = authenticate(message.credential, options.authentication)
        if (!authenticated) {
          disconnect(socket, 'authentication-failed', 'The session credential is invalid.')
          return
        }
        if (authenticated.observer !== null) {
          disconnect(socket, 'authentication-failed', 'Observer credentials require observer mode.')
          return
        }
        if (sharedHub && authenticated.content === null) {
          disconnect(socket, 'authentication-failed', 'The shared Hub ticket has no content manifest.')
          return
        }
        if (sharedHub && (authenticated.content?.manifest.mods.length ?? 0) > 0) {
          disconnect(socket, 'authentication-failed', 'Mods require a private College.')
          return
        }
        if (sharedHub && message.cheatsEnabled && !authenticated.developerAccess) {
          disconnect(socket, 'authentication-failed', 'Cheats require a private College.')
          return
        }
        if (
          message.declineTutorial
          && (message.beginCollegeIntro || message.save !== undefined || message.resumeToken !== undefined)
        ) {
          disconnect(
            socket,
            'invalid-message',
            'Tutorial decline requires a fresh admission without the College introduction.',
          )
          return
        }
        if (authenticated.partyId !== null && authenticated.partyRejoinToken !== null) {
          disconnect(socket, 'authentication-failed', 'The party admission is ambiguous.')
          return
        }
        if (authenticated.partyRecoverySeed && authenticated.partyRejoinToken === null) {
          disconnect(socket, 'authentication-failed', 'The party recovery seed is missing.')
          return
        }
        if (
          authenticated.partyId !== null
          && !validPartyReservation(
            authenticated.partyId,
            authenticated.reservationId,
          )
        ) {
          disconnect(socket, 'authentication-failed', 'That party admission has expired.')
          return
        }
        let partyRecoveryClaim = authenticated.partyRejoinToken === null
          ? null
          : decodePartyRecoveryClaim(partyRecoverySecret, authenticated.partyRejoinToken)
        if (authenticated.partyRejoinToken !== null && partyRecoveryClaim === null) {
          disconnect(socket, 'authentication-failed', 'That party recovery claim is invalid.')
          return
        }
        const partyRejoinSlot = authenticated.partyRecoverySeed
          ? null
          : authenticated.partyRejoinToken === null
          ? null
          : validPartyRejoinReservation(
              authenticated.partyRejoinToken,
              authenticated.reservationId,
            )
        if (
          authenticated.partyRejoinToken !== null
          && !authenticated.partyRecoverySeed
          && partyRejoinSlot === null
        ) {
          disconnect(socket, 'authentication-failed', 'That active-party rejoin has expired.')
          return
        }
        if (partyRejoinSlot !== null) pendingPartyRejoins.set(socket, partyRejoinSlot)
        if (
          (partyRejoinSlot === null ? participantCount() + detachedPartyRejoinCount() : participantCount())
          >= maxPlayers
        ) {
          disconnect(socket, 'server-full', 'The session is full.')
          return
        }
        clearTimeout(helloDeadline)
        pending.delete(socket)
        let playerId: PlayerId | null = null
        let replacedClient: HostClient | null = null
        let rejoinedParty = false
        let stagedPartyRejoin: PartyRejoinSlot | null = null
        let saveIntegrity: GameSaveIntegrity | null = null
        let savedProfile: RestoredGameSaveProfile | null = null
        let nativeSource: NativeGameSaveSource | null = null
        let retainedSaveModIds: readonly string[] | null = null
        const playerPartyIdentity = createPartyIdentity()
        const importingProfileIntoPrivateParty = (
          !sharedHub
          && partyRejoinSlot === null
          && authenticated.partyId !== null
          && message.saveIntent === 'new-game'
          && state.world.kind === 'hub'
        )
        if (
          partyRejoinSlot !== null
          && (message.save === undefined || message.saveIntent !== 'resume')
        ) {
          disconnect(socket, 'invalid-message', 'Active-party rejoin requires the saved wizard.')
          return
        }
        if (message.save !== undefined) {
          if (message.saveIntent === undefined) {
            disconnect(socket, 'invalid-message', 'The game save intent is missing.')
            return
          }
          if (
            !sharedHub && partyRejoinSlot === null && !importingProfileIntoPrivateParty && (
              clients.size !== 0
              || state.world.kind !== 'hub'
              || state.playerEntities.identities.length !== 0
            )
          ) {
            disconnect(socket, 'invalid-message', 'A save may load only on a fresh host owner.')
            return
          }
          try {
            const parsedSave = parseGameSaveDocument(message.save)
            const profileDocument = message.saveIntent === 'new-game'
              && parsedSave.continuation !== null
              ? retireGameSaveWizard(message.save)
              : message.save
            savedProfile = restoreGameSaveProfile(profileDocument)
          } catch (error) {
            disconnect(
              socket,
              'invalid-message',
              error instanceof Error ? error.message : 'The game save is invalid.',
            )
            return
          }
          saveIntegrity = savedProfile.integrity
          nativeSource = savedProfile.nativeSource
          if (partyRecoveryClaim !== null) {
            const verified = verifyPartyRecoveryClaim(
              partyRecoverySecret,
              authenticated.partyRejoinToken!,
              message.save,
            )
            const activeManifestSha256 = authenticated.content?.manifest.manifestSha256
              ?? content.manifestSha256
            if (
              verified === null
              || verified.playerId !== partyRecoveryClaim.playerId
              || verified.recoveryId !== partyRecoveryClaim.recoveryId
              || verified.runId !== partyRecoveryClaim.runId
              || verified.contentManifestSha256 !== activeManifestSha256
              || verified.leaderboardUserId !== authenticated.leaderboardUserId
              || verified.sessionKind !== sessionKind
              || verified.integrity !== savedProfile.integrity
              || (authenticated.partyRecoverySeed && verified.targetRevision === null)
            ) {
              disconnect(socket, 'invalid-message', 'The saved party recovery claim is invalid.')
              return
            }
            partyRecoveryClaim = verified
          }
          if (sharedHub && savedProfile.integrity === 'local-only') {
            disconnect(socket, 'invalid-message', 'Local-only saves require a private College.')
            return
          }
          const activeManifest = authenticated.content?.manifest ?? content
          const modMismatch = !sameContentMods(savedProfile.mods, activeManifest.mods)
          const savedMods = savedProfile.mods
          retainedSaveModIds = activeManifest.mods
            .filter(active => savedMods.some(saved => sameContentMod(saved, active)))
            .map(mod => mod.id)
          if (modMismatch && (partyRecoveryClaim !== null || !message.allowModMismatch)) {
            disconnect(
              socket,
              'invalid-message',
              'The saved mod list does not match this session. Confirm the mismatch before loading it.',
            )
            return
          }
          if (message.saveIntent === 'resume') {
            let restored
            try {
              restored = restoreGameSaveDocument(message.save)
            } catch (error) {
              disconnect(
                socket,
                'invalid-message',
                error instanceof Error ? error.message : 'The game save is invalid.',
              )
              return
            }
            const restoredCharacter = restored.state.playerEntities.configs[0]
            if (!restoredCharacter || !sameCharacter(restoredCharacter, message.character)) {
              disconnect(
                socket,
                'invalid-message',
                'The game save character does not match the resume request.',
              )
              return
            }
            playerId = restored.playerId
            let restoredState = reconcileGameSimulationPlayerModPackages(
              restored.state,
              playerId,
              retainedSaveModIds,
            )
            let restoredBoneyard = restored.loadedBoneyard
            if (partyRejoinSlot !== null) {
              if (
                playerId !== partyRejoinSlot.playerId
                || !credentialsEqual(
                  savedProfile.continuation?.summary.partyRejoinToken ?? '',
                  authenticated.partyRejoinToken ?? '',
                )
                || restoredBoneyard?.runId !== partyRejoinSlot.runId
                || restoredState.world.kind !== 'boneyard'
                || restoredState.world.runId !== partyRejoinSlot.runId
              ) {
                disconnect(
                  socket,
                  'invalid-message',
                  'The saved wizard does not match this active-party rejoin.',
                )
                return
              }
              if (partyRejoinSlot.detachedState === null) {
                partyRejoinSlot.detachedState = detachGameSimulationPlayer(
                  restoredState,
                  playerId,
                )
                partyRejoinSlot.profile = message.profile
              }
              const detachedCharacter = partyRejoinSlot.detachedState.playerEntities.configs[0]
              if (
                partyRejoinSlot.detachedState.playerEntities.configs.length !== 1
                || !detachedCharacter
                || !sameCharacter(detachedCharacter, message.character)
              ) {
                disconnect(
                  socket,
                  'invalid-message',
                  'The saved wizard does not match this active-party rejoin.',
                )
                return
              }
              partyRejoinSlot.partyIdentity = playerPartyIdentity
              const activeRejoinState = activeRunForPartyRejoin(partyRejoinSlot)
              if (!activeRejoinState) {
                disconnect(socket, 'invalid-message', 'The active party no longer exists.')
                return
              }
              replacePartyRejoinRunState(
                partyRejoinSlot,
                synchronizePartyRejoinMilestones(
                  partyRejoinSlot.partyId,
                  activeRejoinState,
                ),
              )
              if (partyRejoinSlot.detachedState.playerEntities.progressions[0]?.pendingOffer) {
                partyRejoinSlot.connected = true
                partyRejoinSlot.reservation = null
                stagedPartyRejoin = partyRejoinSlot
              } else {
                const rejection = materializePartyRejoinSlot(
                  partyRejoinSlot,
                  authenticated.reservationId,
                )
                if (rejection !== null) {
                  disconnect(socket, 'invalid-message', rejection)
                  return
                }
                consumePartyRejoinSlot(partyRejoinSlot)
              }
              rejoinedParty = true
              pendingPartyRejoins.delete(socket)
            }
            if (
              !rejoinedParty
              &&
              modMismatch
              && restoredBoneyard?.choice.source === 'mod'
              && restoredBoneyard.choice.modId !== undefined
              && !activeManifest.mods.some(mod => (
                mod.id.toLowerCase() === restoredBoneyard!.choice.modId!.toLowerCase()
                && restored.mods.some(saved => sameContentMod(saved, mod))
              ))
            ) {
              restoredState = returnGameSimulationToHub(restoredState)
              restoredBoneyard = null
            }
            if (sharedWorlds && !rejoinedParty) {
              const liveState = sharedGameStateForPlayer(sharedWorlds, playerId)
              if (liveState) {
                const liveClient = [...clients.values()].find(
                  candidate => candidate.playerId === playerId,
                )
                if (
                  !liveClient
                  || message.resumeToken === undefined
                  || !credentialsEqual(message.resumeToken, liveClient.resumeToken)
                ) {
                  disconnect(
                    socket,
                    'invalid-message',
                    'This wizard is already active in another browser.',
                  )
                  return
                }
                const liveCharacter = liveState.playerEntities.configs[0]
                if (!liveCharacter || !sameCharacter(liveCharacter, message.character)) {
                  disconnect(
                    socket,
                    'invalid-message',
                    'The active wizard does not match the resume request.',
                  )
                  return
                }
                replacedClient = liveClient
                state = sharedWorlds.hub
              } else {
                try {
                  sharedWorlds = restoreSharedGamePlayer(
                    sharedWorlds,
                    restoredState,
                    restoredBoneyard,
                    playerId,
                    playerPartyIdentity,
                  )
                  state = sharedWorlds.hub
                } catch (error) {
                  disconnect(
                    socket,
                    'invalid-message',
                    error instanceof Error
                      ? error.message
                      : 'The game save cannot enter the shared Hub.',
                  )
                  return
                }
              }
            } else if (!rejoinedParty) {
              state = restoredState
              loadedBoneyard = restoredBoneyard
              nextPlayerId = Math.max(nextPlayerId, nextPlayerNumber(playerId) + 1)
            }
          }
        }
        if (message.save === undefined || message.saveIntent === 'new-game') {
          playerId = sharedWorlds
            ? `player-${randomBytes(12).toString('base64url')}`
            : `player-${nextPlayerId}`
          if (sharedWorlds) {
            sharedWorlds = addSharedHubPlayer(
              sharedWorlds,
              playerId,
              message.character,
              playerPartyIdentity,
            )
            state = sharedWorlds.hub
          } else {
            nextPlayerId += 1
            state = addPlayerCharacter(state, playerId, message.character)
          }
          if (savedProfile) {
            const hydrated = hydrateGameSaveProfile(
              stateForPlayer(playerId),
              playerId,
              savedProfile,
            )
            replaceStateForPlayer(
              playerId,
              retainedSaveModIds === null
                ? hydrated
                : reconcileGameSimulationPlayerModPackages(
                    hydrated,
                    playerId,
                    retainedSaveModIds,
                  ),
            )
          }
          if (options.initialPlayerExperience) {
            const activeState = stateForPlayer(playerId)
            const experienced = grantGameSimulationPlayerExperience(
              activeState,
              playerId,
              options.initialPlayerExperience,
            )
            replaceStateForPlayer(playerId, experienced)
          }
        }
        if (playerId === null) {
          disconnect(socket, 'invalid-message', 'The game save intent is invalid.')
          return
        }
        if (!rejoinedParty && message.declineTutorial) {
          replaceStateForPlayer(
            playerId,
            declineGameSimulationTutorial(stateForPlayer(playerId), playerId),
          )
        }
        if (
          !rejoinedParty
          && (message.beginCollegeIntro || savedProfile?.economy.collegeIntroPending)
        ) {
          collegeIntroReadyPlayerIds.delete(playerId)
          replaceStateForPlayer(
            playerId,
            armGameSimulationCollegeIntro(stateForPlayer(playerId), playerId),
          )
        }
        if (
          savedProfile
          && !rejoinedParty
          && !importingProfileIntoPrivateParty
          && Object.keys(savedProfile.modState).length > 0
        ) {
          const activeMods = authenticated.content?.manifest.mods ?? content.mods
          if (sameContentMods(savedProfile.mods, activeMods)) {
            if (sharedHub) pendingRestoredModState.set(playerId, savedProfile.modState)
            else privateModHost?.restoreSaveState(savedProfile.modState)
          }
        }
        if (!sharedHub && loadedBoneyard) {
          privateModHost?.activateBoneyard(
            webLuaBoneyardContentId(playerId, loadedBoneyard),
            true,
          )
        }
        if (sharedHub) {
          if (!authenticated.content) throw new Error('validated shared Hub content is absent')
          playerContents.set(playerId, authenticated.content)
          if (authenticated.partyId !== null && sharedWorlds) {
            const joined = joinSharedPartyPlayer(
              sharedWorlds,
              playerId,
              authenticated.partyId,
              availablePartyMembers(authenticated.partyId, authenticated.reservationId),
            )
            if (!joined.accepted) {
              sharedWorlds = removeSharedGamePlayer(sharedWorlds, playerId)
              state = sharedWorlds.hub
              playerContents.delete(playerId)
              disconnect(socket, 'invalid-message', partyRejectionMessage(joined.reason))
              return
            }
            sharedWorlds = joined.state
            state = sharedWorlds.hub
            consumePartyReservation(authenticated.reservationId)
          }
          const restoredBoneyard = loadedBoneyardForPlayer(playerId)
          const restoredParty = sharedWorlds
            ? partyForPlayer(sharedWorlds.parties, playerId)
            : null
          if (restoredBoneyard && restoredParty) {
            startingPartyIds.add(restoredParty.id)
            void ensurePartyModRuntimes(
              restoredParty.id,
              authenticated.content,
              stateForPlayer(playerId),
            ).then((scope) => {
              const current = loadedBoneyardForPlayer(playerId)
              scope.runtime.activateBoneyard(current
                ? webLuaBoneyardContentId(playerId, current)
                : null, true)
            }).catch((error) => {
              logGameServerEvent(
                options.log,
                'game-host',
                'error',
                'mods.restore_initialization_failed',
                'The restored party mod set could not initialize.',
                logDetails({ partyId: restoredParty.id, ...gameServerErrorDetails(error) }),
              )
              disconnect(
                socket,
                'invalid-message',
                error instanceof Error ? error.message : 'The saved mods could not initialize.',
              )
            }).finally(() => startingPartyIds.delete(restoredParty.id))
          }
        }
        if (!sharedHub) {
          hostPlayerId ??= playerId
        }
        if (privateParties && !rejoinedParty) {
          const destination = privateParties.parties[0] ?? null
          privateParties = registerPartyPlayer(
            privateParties,
            playerId,
            playerPartyIdentity,
          )
          if (destination) {
            const joined = joinPartyPlayer(
              privateParties,
              playerId,
              destination.id,
              availablePartyMembers(destination.id, authenticated.reservationId),
            )
            if (!joined.accepted) {
              privateParties = removePrivatePartyPlayer(privateParties, playerId)
              state = removePlayerCharacter(state, playerId)
              disconnect(socket, 'invalid-message', partyRejectionMessage(joined.reason))
              return
            }
            privateParties = joined.state
          }
          consumePartyReservation(authenticated.reservationId)
        }
        if (authenticated.partyRecoverySeed) {
          const claimantParty = activePartySystem()
            ? partyForPlayer(activePartySystem()!, playerId)
            : null
          const recoveredState = sharedWorlds
            ? sharedGameStateForPlayer(sharedWorlds, playerId)
            : state
          if (
            partyRecoveryClaim === null
            || authenticated.content === null
            || claimantParty === null
            || recoveredState === null
            || recoveredState.world.kind !== 'boneyard'
            || recoveredState.world.runId !== partyRecoveryClaim.runId
          ) {
            if (sharedWorlds) {
              sharedWorlds = removeSharedGamePlayer(sharedWorlds, playerId)
              state = sharedWorlds.hub
              playerContents.delete(playerId)
            } else {
              state = removePlayerCharacter(state, playerId)
              if (privateParties) {
                privateParties = removePrivatePartyPlayer(privateParties, playerId)
              }
            }
            disconnect(socket, 'invalid-message', 'The party recovery seed could not restore its run.')
            return
          }
          const recoveredParties = restorePartyMembership(
            activePartySystem()!,
            playerId,
            partyRecoveryClaim.partyRoster.map(({ playerId: memberPlayerId }) => memberPlayerId),
            partyRecoveryClaim.partyLeaderPlayerId,
            partyRecoveryClaim.partyVisibility,
          )
          if (sharedWorlds) {
            sharedWorlds = { ...sharedWorlds, parties: recoveredParties }
            state = sharedWorlds.hub
          } else {
            privateParties = recoveredParties
            hostPlayerId = partyRecoveryClaim.partyLeaderPlayerId
          }
          registerPartyRecoveryLineage(
            partyRecoveryClaim,
            claimantParty.id,
            authenticated.content,
          )
        }
        const playerState = stagedPartyRejoin
          ? partyRejoinStagingState(stagedPartyRejoin)
          : stateForPlayer(playerId)
        const ordinaryWelcomeSnapshot = createGameSnapshot(
          playerState,
          stagedPartyRejoin
            ? activePartySystem()?.parties.find(({ id }) => (
                id === stagedPartyRejoin.partyId
              ))?.leaderPlayerId ?? null
            : authorityForPlayer(playerId),
          hubActivitiesForSnapshot(playerState),
        )
        const welcomeSnapshot = stagedPartyRejoin
          ? { ...ordinaryWelcomeSnapshot, materializingPlayerIds: [playerId] }
          : ordinaryWelcomeSnapshot
        const snapshotSequence = nextSnapshotSequence
        nextSnapshotSequence += 1
        const welcomeBaseline = createReplicatedEntityBaseline(welcomeSnapshot)
        const resumeToken = randomBytes(32).toString('base64url')
        if (replacedClient) {
          clients.delete(replacedClient.socket)
          supersededClients.add(replacedClient.socket)
          disconnectCauses.set(replacedClient.socket, {
            reason: 'wizard resumed in another browser',
            source: 'resume-takeover',
          })
          replacedClient.socket.close(
            GAME_SESSION_REPLACED_CLOSE_CODE,
            'wizard resumed in another browser',
          )
        }
        const requestedCheatsEnabled = message.cheatsEnabled && !authenticated.developerAccess
        if (sessionKind === 'private-college' && !privateCollegeCheatPolicyInitialized) {
          privateCollegeCheatsEnabled = requestedCheatsEnabled
          privateCollegeCheatPolicyInitialized = true
        }
        const clientCheatsEnabled = sessionKind === 'private-college'
          ? privateCollegeCheatsEnabled
          : requestedCheatsEnabled
        const playerReference = replacedClient?.playerReference
          ?? playerReferences.get(playerId)
          ?? createPlayerReference()
        const joinedClient: HostClient = {
          acknowledgedSequence: 0,
          acknowledgedSnapshotSequence: snapshotSequence,
          activeInput: createIdlePlayerCharacterInput(),
          chatSentAtMs: [],
          cheatsEnabled: clientCheatsEnabled,
          connectedAtMs: Date.now(),
          content: authenticated.content,
          developerAccess: authenticated.developerAccess,
          displayName: message.character.displayName,
          profile: partyRejoinSlot?.profile ?? message.profile,
          // Browser-held documents are editable, including documents read back
          // from the account cloud slot. Only a save-free admission can begin a
          // globally ranked lineage; the document's own integrity claim is not
          // evidence of server provenance.
          globalScoreEligible: partyRejoinSlot?.globalScoreEligible
            ?? partyRecoveryClaim?.globalScoreEligible
            ?? (
              sessionKind !== 'private-college'
              && message.save === undefined
              && !clientCheatsEnabled
              && (authenticated.content?.manifest.mods.length ?? content.mods.length) === 0
            ),
          hubActivity: null,
          localOnly: partyRejoinSlot?.localOnly
            ?? (partyRecoveryClaim ? partyRecoveryClaim.integrity === 'local-only' : undefined)
            ?? (
              sessionKind !== 'global-hub'
              || clientCheatsEnabled
              || saveIntegrity === 'local-only'
              || (authenticated.content?.manifest.mods.length ?? content.mods.length) > 0
            ),
          nativeSource,
          onlinePreferences: { ...message.onlinePreferences },
          lastReceivedSequence: 0,
          lastModRequestId: 0,
          lastSentSnapshotSequence: snapshotSequence,
          leaderboardUserId: partyRejoinSlot?.leaderboardUserId
            ?? partyRecoveryClaim?.leaderboardUserId
            ?? authenticated.leaderboardUserId,
          partyRejoinSlot: stagedPartyRejoin,
          playerId,
          pendingLuaRequestIds: new Set(),
          queuedInputs: new Map(),
          replicationRecovery: null,
          resumeToken,
          socialConnection: null,
          playerReference,
          sentReplicationBaselines: new Map([[snapshotSequence, welcomeBaseline]]),
          socket,
          tutorialEligible: message.save === undefined
            && !clientCheatsEnabled
            && (authenticated.content?.manifest.mods.length ?? content.mods.length) === 0,
        }
        clients.set(socket, joinedClient)
        playerReferences.set(playerId, playerReference)
        if (options.socialBroker) {
          joinedClient.socialConnection = options.socialBroker.register({
            hostId: socialHostId,
            localPlayerId: playerId,
            canReceiveCollegeInvitation: () => (
              clients.get(socket) === joinedClient
              && !joinedClient.partyRejoinSlot
              && stateForPlayer(playerId).world.kind === 'hub'
            ),
            deliverChat: message => deliverSocialChat(joinedClient, message),
            deliverCollegeInvitations: invitations => {
              if (joinedClient.socket.readyState !== WebSocket.OPEN) return
              joinedClient.socket.send(encodeGameMessage({
                type: 'server-college-invitations',
                invitations,
              }))
            },
            profile: () => playerCardProfile(joinedClient),
          }, joinedClient.onlinePreferences, playerReference)
        }
        if (!joinedClient.globalScoreEligible && !stagedPartyRejoin) taintActiveRun(joinedClient)
        const connectedParty = activePartySystem()
          ? partyForPlayer(activePartySystem()!, playerId)
          : null
        const connectedState = stateForClient(joinedClient)
        const resumeGraceReason: Extract<
          GameplayResumeGraceReason,
          'game-rejoined' | 'game-restarted'
        > | null =
          connectedState.world.kind === 'boneyard'
          && connectedState.run.phase === 'active'
            ? message.saveIntent === 'resume'
              ? rejoinedParty || replacedClient !== null
                ? 'game-rejoined'
                : 'game-restarted'
              : 'game-rejoined'
            : null
        const beganResumeGrace = resumeGraceReason !== null
          && beginRunLoadingResumeGrace(
            playerId,
            resumeGraceReason,
            stagedPartyRejoin?.partyId ?? connectedParty?.id ?? null,
            false,
          )
        if (!stagedPartyRejoin) {
          armPartyRejoinSlotsForState(
            connectedParty?.id ?? null,
            stateForPlayer(playerId),
          )
        }
        const connectedDetails = {
          accountUsername: joinedClient.profile.accountUsername,
          discipline: message.character.discipline,
          displayName: message.character.displayName,
          element: message.character.element,
          partyId: connectedParty?.id ?? null,
          partyMemberCount: connectedParty?.memberPlayerIds.length ?? null,
          playerId,
          playerCount: clients.size,
          rejoinedParty,
          replacedConnection: replacedClient !== null,
          role: authenticated.role,
        }
        logGameServerEvent(
          options.log,
          'game-host',
          'info',
          'player.connected',
          'A player authenticated with the game host.',
          logDetails(connectedDetails),
        )
        emitRuntimeEvent(
          'player.connected',
          'A player authenticated with the game host.',
          connectedDetails,
        )
        options.onPlayerCountChanged?.(clients.size)
        socket.send(encodeGameMessage({
          type: 'server-welcome',
          cheatsEnabled: joinedClient.cheatsEnabled,
          developerAccess: joinedClient.developerAccess,
          protocolVersion: GAME_PROTOCOL_VERSION,
          playerId,
          resumeToken,
          serverTickRate: GAME_TICK_RATE,
          snapshotRate,
          sessionKind,
          kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
          kernelParameters: {
            fixedTickSeconds: GAME_FIXED_TICK_SECONDS,
            movementAcceleration: PLAYER_CHARACTER_INPUT_ACCELERATION,
            movementLaneCap: PLAYER_CHARACTER_MOVEMENT_LANE_CAP,
            movementRetention: PLAYER_CHARACTER_MOVEMENT_RETENTION,
            movementThresholdSquared: PLAYER_CHARACTER_MOVEMENT_THRESHOLD_SQUARED,
            playerRadius: PLAYER_CHARACTER_RADIUS,
          },
          content: authenticated.content?.manifest ?? content,
          modAssets: authenticated.content?.assets ?? options.modAssets ?? [],
          modCatalog: sharedHub ? [] : privateModHost?.content.consumables() ?? [],
          boneyards: boneyardCatalogForPlayer(playerId).choices,
          gameplayPause: stagedPartyRejoin
            ? gameplayPauseForPartyRejoin(stagedPartyRejoin)
            : gameplayPauseForPlayer(playerId),
          gameplayResumeGrace: stagedPartyRejoin
            ? gameplayResumeGraceForPartyRejoin(stagedPartyRejoin)
            : gameplayResumeGraceForPlayer(playerId),
          snapshot: welcomeSnapshot,
          snapshotSequence,
        }))
        joinedClient.socialConnection?.activate()
        sendPreparedModProjection(
          socket,
          (stagedPartyRejoin
            ? partyModRuntimes.get(stagedPartyRejoin.partyId)
            : modRuntimeScopeForPlayer(playerId))?.runtime ?? privateModHost,
        )
        sendPreparedModRuntime(
          socket,
          (stagedPartyRejoin
            ? partyModRuntimes.get(stagedPartyRejoin.partyId)
            : modRuntimeScopeForPlayer(playerId))?.runtime ?? privateModHost,
          playerId,
        )
        const playerBoneyard = stagedPartyRejoin
          ? loadedBoneyardForPartyRejoin(stagedPartyRejoin)
          : loadedBoneyardForPlayer(playerId)
        if (playerBoneyard) {
          socket.send(encodeGameMessage({
            type: 'server-boneyard-loaded',
            boneyard: playerBoneyard,
          }))
        }
        if (replacedClient === null && connectedState.world.kind === 'hub') {
          publishPlayerActivity(joinedClient, 'entered-college')
        }
        if (sharedWorlds || privateParties) broadcastPartyState()
        if (beganResumeGrace) {
          broadcastGameplayResumeGrace(
            playerId,
            stagedPartyRejoin
              ? sharedGameplayPauseScopeForParty(stagedPartyRejoin.partyId)
              : undefined,
          )
        }
        publishSaveCheckpoint('connected')
        const connectedPause = stagedPartyRejoin
          ? gameplayPauseForPartyRejoin(stagedPartyRejoin)
          : gameplayPauseForPlayer(playerId)
        const connectedGrace = stagedPartyRejoin
          ? gameplayResumeGraceForPartyRejoin(stagedPartyRejoin)
          : gameplayResumeGraceForPlayer(playerId)
        if (connectedPause || connectedGrace) broadcastSnapshot()
        return
      }

      if (message.type === 'client-deployment-ready') {
        const restart = deploymentRestart
        const checkpointSequence = restart?.checkpointSequences.get(socket)
        if (
          !restart
          || message.targetRevision !== restart.targetRevision
          || message.checkpointSequence !== checkpointSequence
        ) {
          disconnect(socket, 'invalid-message', 'The deployment acknowledgement is not current.')
          return
        }
        if (restart.pending.delete(socket)) {
          restart.acknowledged.add(socket)
          if (restart.pending.size === 0) restart.resolveReady()
        }
        return
      }
      if (deploymentRestart) {
        if (message.type === 'client-ping') {
          socket.send(encodeGameMessage({ type: 'server-pong', nonce: message.nonce }))
        } else if (message.type === 'client-disconnect') {
          disconnectCauses.set(socket, {
            reason: 'client disconnected while saving for update',
            source: 'deployment-restart',
          })
          socket.close(1000, 'client disconnect')
        }
        return
      }

      if (message.type === 'client-ready-boneyard') {
        const activeState = stateForPlayer(client.playerId)
        if (
          activeState.world.kind === 'boneyard'
          && activeState.run.runId === message.runId
        ) {
          markBoneyardRendererReady(client.playerId, message.runId)
        }
        return
      }

      if (
        client.partyRejoinSlot
        && message.type !== 'client-select-skill'
        && message.type !== 'client-level-up-action'
        && message.type !== 'client-online-preferences'
        && message.type !== 'client-snapshot-ack'
        && message.type !== 'client-ping'
        && message.type !== 'client-resume-grace-ready'
        && message.type !== 'client-save-before-leave'
        && message.type !== 'client-disconnect'
      ) return

      if (message.type === 'client-hub-activity') {
        const activeState = stateForPlayer(client.playerId)
        if (
          activeState.world.kind !== 'hub'
          || client.hubActivity === message.activity
        ) return
        client.hubActivity = message.activity
        client.activeInput = createIdlePlayerCharacterInput()
        client.queuedInputs.clear()
        broadcastSnapshot()
        return
      }

      if (message.type === 'client-online-preferences') {
        client.onlinePreferences = { ...message.onlinePreferences }
        client.socialConnection?.setOnlinePreferences(client.onlinePreferences)
        return
      }

      if (message.type === 'client-resume-grace-ready') {
        acknowledgeResumeGraceReady(client, message.sequence)
        return
      }

      if (
        gameplayResumeGraceForClient(client) !== null
        && message.type !== 'client-chat'
        && message.type !== 'client-disconnect'
        && message.type !== 'client-input'
        && message.type !== 'client-level-up-action'
        && message.type !== 'client-ping'
        && message.type !== 'client-gameplay-pause'
        && message.type !== 'client-save-before-leave'
        && message.type !== 'client-select-skill'
        && message.type !== 'client-snapshot-ack'
      ) return

      if (message.type === 'client-gameplay-pause') {
        const activeState = stateForPlayer(client.playerId)
        if (activeState.world.kind === 'hub') return
        const activePause = gameplayPauseForPlayer(client.playerId)
        if (message.paused) {
          if (gameplayResumeGraceForPlayer(client.playerId) !== null) return
          if (activePause?.ownerPlayerId === client.playerId) {
            if (activePause.source === message.source) return
            setGameplayPauseForPlayer(client.playerId, {
              ...activePause,
              source: message.source,
            })
            broadcastGameplayPause(client.playerId)
            return
          }
          if (
            activePause
            || activeState.levelUpBarrier !== null
            || (activeState.run.phase !== 'hub' && activeState.run.phase !== 'active')
          ) return
          setGameplayPauseForPlayer(client.playerId, {
            ownerDisplayName: client.displayName,
            ownerPlayerId: client.playerId,
            source: message.source,
          })
          stopWorldClientInputs(client.playerId)
          if (!sharedWorlds) resetNextTickDeadline()
          publishSaveCheckpoint('pause')
          broadcastGameplayPause(client.playerId)
          logGameServerEvent(
            options.log,
            'game-host',
            'info',
            'gameplay.paused',
            'A player paused the authoritative gameplay world.',
            logDetails({
              displayName: client.displayName,
              playerId: client.playerId,
              serverTick: activeState.tick,
              source: message.source,
            }),
          )
          return
        }
        if (activePause?.ownerPlayerId !== client.playerId) return
        releaseGameplayPause('owner-resumed', client.playerId)
        return
      }

      if (message.type === 'client-input') {
        if (message.sequence <= client.lastReceivedSequence) return
        const activeState = stateForPlayer(client.playerId)
        if (
          gameplayPauseForPlayer(client.playerId) !== null
          || gameplayResumeGraceForClient(client) !== null
          || (activeState.world.kind === 'hub' && client.hubActivity !== null)
          || activeState.levelUpBarrier !== null
          || getPlayerProgression(activeState, client.playerId).pendingOffer
        ) {
          client.lastReceivedSequence = message.sequence
          client.acknowledgedSequence = message.sequence
          client.activeInput = createIdlePlayerCharacterInput()
          client.queuedInputs.clear()
          broadcastSnapshot()
          return
        }
        if (message.targetTick > activeState.tick + GAME_TICK_RATE * 2) {
          disconnect(socket, 'invalid-message', 'Input targets too far ahead of the server tick.')
          return
        }
        const pendingTail = newestQueuedInput(client.queuedInputs)
        const castTransition = !sameCast(
          pendingTail?.input ?? client.activeInput,
          message.input,
        )
        const targetTick = Math.max(
          activeState.tick + 1,
          message.targetTick,
          pendingTail
            ? pendingTail.targetTick + Number(castTransition)
            : activeState.tick + 1,
        )
        if (targetTick > activeState.tick + GAME_TICK_RATE * 2) {
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
        if (client.partyRejoinSlot) {
          const slot = client.partyRejoinSlot
          const activeState = activeRunForPartyRejoin(slot)
          const selected = activeState && slot.detachedState
            ? selectDetachedGameSimulationPlayerSkill(activeState, slot.detachedState, message)
            : null
          if (!selected) {
            disconnect(socket, 'invalid-message', 'The skill choice is stale or not in this offer.')
            return
          }
          replacePartyRejoinRunState(slot, selected.state)
          slot.detachedState = selected.detached
          if (!slot.detachedState.playerEntities.progressions[0]?.pendingOffer) {
            const rejection = materializePartyRejoinSlot(slot, null)
            if (rejection !== null) {
              disconnect(socket, 'invalid-message', rejection)
              return
            }
            consumePartyRejoinSlot(slot)
            client.partyRejoinSlot = null
            armPartyRejoinSlotsForState(slot.partyId, stateForPlayer(client.playerId))
            if (sharedWorlds || privateParties) broadcastPartyState()
            maybeStartGameplayResumeGrace(client.playerId)
          }
          client.activeInput = createIdlePlayerCharacterInput()
          client.queuedInputs.clear()
          broadcastSnapshot()
          publishSaveCheckpoint('skill-selected')
          return
        }
        const activeState = stateForPlayer(client.playerId)
        const barrierBefore = activeState.levelUpBarrier
        const selected = selectGameSimulationPlayerSkill(activeState, client.playerId, message)
        if (!selected) {
          disconnect(socket, 'invalid-message', 'The skill choice is stale or not in this offer.')
          return
        }
        replaceStateForPlayer(client.playerId, selected)
        client.activeInput = createIdlePlayerCharacterInput()
        client.queuedInputs.clear()
        if (barrierBefore !== null && selected.levelUpBarrier === null) {
          stopWorldClientInputs(client.playerId)
          beginMultiplayerResumeGrace(client.playerId, 'skill-picker-closed')
        }
        broadcastSnapshot()
        publishSaveCheckpoint('skill-selected')
        return
      }
      if (message.type === 'client-skill-quickbar-bind') {
        const activePause = gameplayPauseForPlayer(client.playerId)
        if (
          activePause !== null
          && (
            activePause.ownerPlayerId !== client.playerId
            || (
              activePause.source !== 'skill-book'
              && (activePause.source !== 'inventory' || message.skillId !== null)
            )
          )
        ) return
        const activeState = stateForPlayer(client.playerId)
        const bound = bindGameSimulationPlayerSkillQuickbar(
          activeState,
          client.playerId,
          message.skillId,
          message.slot,
        )
        if (!bound) {
          disconnect(socket, 'invalid-message', 'The quickbar skill is unavailable.')
          return
        }
        replaceStateForPlayer(client.playerId, bound)
        client.activeInput = createIdlePlayerCharacterInput()
        client.queuedInputs.clear()
        broadcastSnapshot()
        publishSaveCheckpoint('skill-quickbar-bound')
        return
      }
      if (message.type === 'client-select-primary-skill') {
        const activePause = gameplayPauseForPlayer(client.playerId)
        if (
          activePause !== null
          && (
            activePause.ownerPlayerId !== client.playerId
            || (
              activePause.source !== 'skill-book'
              && activePause.source !== 'skill-selector'
            )
          )
        ) return
        const activeState = stateForPlayer(client.playerId)
        const selected = selectGameSimulationPlayerPrimarySkill(
          activeState,
          client.playerId,
          message.skillId,
        )
        if (!selected) {
          disconnect(socket, 'invalid-message', 'The primary skill is unavailable.')
          return
        }
        replaceStateForPlayer(client.playerId, selected)
        client.activeInput = createIdlePlayerCharacterInput()
        client.queuedInputs.clear()
        broadcastSnapshot()
        publishSaveCheckpoint('primary-skill-selected')
        return
      }
      if (message.type === 'client-select-concentration') {
        const activePause = gameplayPauseForPlayer(client.playerId)
        if (
          activePause !== null
          && (
            activePause.ownerPlayerId !== client.playerId
            || activePause.source !== 'skill-book'
          )
        ) return
        const activeState = stateForPlayer(client.playerId)
        const selected = selectGameSimulationPlayerConcentration(
          activeState,
          client.playerId,
          message.skillId,
        )
        if (!selected) {
          disconnect(socket, 'invalid-message', 'The concentration is unavailable.')
          return
        }
        replaceStateForPlayer(client.playerId, selected)
        client.activeInput = createIdlePlayerCharacterInput()
        client.queuedInputs.clear()
        broadcastSnapshot()
        publishSaveCheckpoint('concentration-selected')
        return
      }
      if (message.type === 'client-select-concentration-slot') {
        const activePause = gameplayPauseForPlayer(client.playerId)
        if (
          activePause !== null
          && (
            activePause.ownerPlayerId !== client.playerId
            || activePause.source !== 'skill-selector'
          )
        ) return
        const activeState = stateForPlayer(client.playerId)
        const selected = selectGameSimulationPlayerConcentrationSlot(
          activeState,
          client.playerId,
          message.skillId,
          message.slot,
        )
        if (!selected) {
          disconnect(socket, 'invalid-message', 'The concentration is unavailable.')
          return
        }
        replaceStateForPlayer(client.playerId, selected)
        client.activeInput = createIdlePlayerCharacterInput()
        client.queuedInputs.clear()
        broadcastSnapshot()
        publishSaveCheckpoint('concentration-selected')
        return
      }
      if (message.type === 'client-mod-cast') {
        if (message.requestId <= client.lastModRequestId) return
        client.lastModRequestId = message.requestId
        const modHost = modRuntimeScopeForPlayer(client.playerId)?.runtime ?? privateModHost
        if (!modHost) return
        try {
          const result = modHost.cast({
            contentId: message.contentId,
            context: { target_x: message.targetX, target_y: message.targetY },
            playerId: client.playerId,
            requestId: message.requestId,
          })
          if (result.accepted) {
            broadcastPreparedModProjection(client.playerId, modHost)
            broadcastSnapshot()
          }
        } catch (error) {
          logGameServerEvent(
            options.log,
            'game-host',
            'warning',
            'mods.cast_rejected',
            error instanceof Error ? error.message : 'The mod spell cast was rejected.',
            logDetails({ contentId: message.contentId, playerId: client.playerId }),
          )
        }
        return
      }
      if (message.type === 'client-mod-action') {
        if (message.requestId <= client.lastModRequestId) return
        client.lastModRequestId = message.requestId
        const modHost = modRuntimeScopeForPlayer(client.playerId)?.runtime ?? privateModHost
        if (!modHost) return
        try {
          let closedSkillBarrier = false
          if (message.action === 'skill-choose') {
            const definition = modHost.content.skill(message.target)
            const activeState = stateForPlayer(client.playerId)
            const level = getPlayerProgression(activeState, client.playerId).level
            if (!definition || level < definition.minimumLevel) throw new Error('mod skill is not eligible')
            const modOfferSequence = message.arguments.mod_offer_sequence
            const nativeOfferSequence = message.arguments.native_offer_sequence
            if (!Number.isSafeInteger(modOfferSequence) || !Number.isSafeInteger(nativeOfferSequence)) {
              throw new Error('mod skill offer is invalid')
            }
            modHost.chooseSkill(
              client.playerId,
              message.target,
              Number(modOfferSequence),
              Number(nativeOfferSequence),
            )
            closedSkillBarrier = activeState.levelUpBarrier !== null
              && stateForPlayer(client.playerId).levelUpBarrier === null
          } else if (message.action === 'ui-action') {
            const action = message.arguments.action
            const args = message.arguments.arguments
            if (typeof action !== 'string' || !args || typeof args !== 'object' || Array.isArray(args)) {
              throw new Error('mod UI action is invalid')
            }
            modHost.uiAction({
              action,
              arguments: args as LuaConsoleObject,
              contentId: message.target,
              playerId: client.playerId,
              requestId: message.requestId,
            })
          } else if (message.action === 'quickbar-bind') {
            const slot = message.arguments.slot
            if (!Number.isSafeInteger(slot)) throw new Error('mod quickbar slot is invalid')
            modHost.bindModQuickbar(
              client.playerId,
              Number(slot),
              message.arguments.clear === true ? null : message.target,
            )
          } else if (message.action === 'shop-buy') {
            const row = message.arguments.row
            if (!Number.isSafeInteger(row) || Number(row) < 0) throw new Error('mod shop row is invalid')
            modHost.purchaseShop(client.playerId, message.target, Number(row))
          } else if (message.action === 'reforge') {
            const itemId = message.arguments.item_id
            const service = message.arguments.service
            if (!Number.isSafeInteger(itemId) || !Number.isSafeInteger(service)) {
              throw new Error('mod reforge request is invalid')
            }
            modHost.reforgeShop(client.playerId, message.target, Number(service), Number(itemId))
          } else if (message.action === 'portal-enter') {
            const activeState = stateForPlayer(client.playerId)
            const loaded = loadedBoneyardForPlayer(client.playerId)
            const player = getPlayerCharacter(activeState, client.playerId)
            const monument = loaded?.scene.objects.find(object => {
              const x = object.pos.x - player.position.x
              const y = object.pos.y - player.position.y
              return object.typeId === 2009 && x * x + y * y < 100 * 100
            })
            if (!monument || activeState.world.kind !== 'boneyard') {
              throw new Error('no Boneyard monument is in interaction range')
            }
            modHost.enterPortal({
              actorKind: 'monument',
              confirmedByLeader: authorityForPlayer(client.playerId) === client.playerId,
              ownerId: activeState.run.runId ?? client.playerId,
              playerId: client.playerId,
              portalId: message.target,
              scene: 'stock.boneyard',
            })
            stopWorldClientInputs(client.playerId)
          } else if (message.action === 'scene-room') {
            const activeState = stateForPlayer(client.playerId)
            if (authorityForPlayer(client.playerId) !== client.playerId) {
              throw new Error('only the party leader can change rooms')
            }
            const room = message.arguments.room
            if (!Number.isSafeInteger(room)) throw new Error('mod scene room is invalid')
            modHost.selectSceneRoom(
              activeState.run.runId ?? client.playerId,
              Number(room),
            )
          } else if (message.action === 'scene-return') {
            const activeState = stateForPlayer(client.playerId)
            if (authorityForPlayer(client.playerId) !== client.playerId) {
              throw new Error('only the party leader can return the party')
            }
            modHost.returnScene(activeState.run.runId ?? client.playerId)
          }
          if (closedSkillBarrier) {
            stopWorldClientInputs(client.playerId)
            beginMultiplayerResumeGrace(client.playerId, 'skill-picker-closed')
          }
          broadcastPreparedModProjection(client.playerId, modHost)
          broadcastSnapshot()
          publishSaveCheckpoint('mod-action')
        } catch (error) {
          logGameServerEvent(
            options.log,
            'game-host',
            'warning',
            'mods.action_rejected',
            error instanceof Error ? error.message : 'The mod action was rejected.',
            logDetails({ action: message.action, playerId: client.playerId }),
          )
        }
        return
      }
      if (message.type === 'client-level-up-action') {
        if (client.partyRejoinSlot) {
          const slot = client.partyRejoinSlot
          const activeState = activeRunForPartyRejoin(slot)
          const applied = activeState && slot.detachedState
            ? message.action === 'reroll'
              ? rerollDetachedGameSimulationPlayerSkill(
                  activeState,
                  slot.detachedState,
                  message.offerSequence,
                )
              : saveDetachedGameSimulationPlayerSkill(
                  activeState,
                  slot.detachedState,
                  message.offerSequence,
                )
            : null
          if (!applied) {
            disconnect(socket, 'invalid-message', 'The level-up action is stale or unavailable.')
            return
          }
          replacePartyRejoinRunState(slot, applied.state)
          slot.detachedState = applied.detached
          if (!slot.detachedState.playerEntities.progressions[0]?.pendingOffer) {
            const rejection = materializePartyRejoinSlot(slot, null)
            if (rejection !== null) {
              disconnect(socket, 'invalid-message', rejection)
              return
            }
            consumePartyRejoinSlot(slot)
            client.partyRejoinSlot = null
            armPartyRejoinSlotsForState(slot.partyId, stateForPlayer(client.playerId))
            if (sharedWorlds || privateParties) broadcastPartyState()
            maybeStartGameplayResumeGrace(client.playerId)
          }
          client.activeInput = createIdlePlayerCharacterInput()
          client.queuedInputs.clear()
          broadcastSnapshot()
          publishSaveCheckpoint('level-up-action')
          return
        }
        const activeState = stateForPlayer(client.playerId)
        const barrierBefore = activeState.levelUpBarrier
        const applied = message.action === 'reroll'
          ? rerollGameSimulationPlayerSkill(activeState, client.playerId, message.offerSequence)
          : saveGameSimulationPlayerSkill(activeState, client.playerId, message.offerSequence)
        if (!applied) {
          disconnect(socket, 'invalid-message', 'The level-up action is stale or unavailable.')
          return
        }
        replaceStateForPlayer(client.playerId, applied)
        client.activeInput = createIdlePlayerCharacterInput()
        client.queuedInputs.clear()
        if (barrierBefore !== null && applied.levelUpBarrier === null) {
          stopWorldClientInputs(client.playerId)
          beginMultiplayerResumeGrace(client.playerId, 'skill-picker-closed')
        }
        broadcastSnapshot()
        publishSaveCheckpoint('level-up-action')
        return
      }
      if (message.type === 'client-hub-action') {
        const activePause = gameplayPauseForPlayer(client.playerId)
        if (
          activePause !== null
          && !pauseAllowsInventoryAction(activePause, client.playerId, message.action)
        ) return
        const modScope = modRuntimeScopeForPlayer(client.playerId)
        const modHost = modScope?.runtime ?? privateModHost
        const stateBeforeAction = stateForPlayer(client.playerId)
        const applied = applyGameSimulationHubAction(
          stateBeforeAction,
          client.playerId,
          message.action,
          modHost?.extensions,
        )
        replaceStateForPlayer(client.playerId, applied.state)
        let accepted = applied.accepted
        if (applied.modConsumption && modHost) {
          try {
            const result = modHost.consume(applied.modConsumption)
            if (!result.accepted) {
              replaceStateForPlayer(client.playerId, stateBeforeAction)
              accepted = false
            } else {
              broadcastPreparedModProjection(client.playerId, modHost)
            }
          } catch (error) {
            replaceStateForPlayer(client.playerId, stateBeforeAction)
            throw error
          }
        }
        client.activeInput = createIdlePlayerCharacterInput()
        client.queuedInputs.clear()
        broadcastSnapshot()
        if (accepted) publishSaveCheckpoint('hub-action')
        return
      }
      if (message.type === 'client-player-card-request') {
        const profile = localPlayerCardByReference(message.playerReference)
          ?? client.socialConnection?.resolvePlayerCard(message.playerReference)
          ?? null
        socket.send(encodeGameMessage({
          type: 'server-player-card',
          profile,
          requestId: message.requestId,
        }))
        return
      }
      if (message.type === 'client-college-invitation-dismiss') {
        client.socialConnection?.dismissCollegeInvitation(message.invitationId)
        return
      }
      if (message.type === 'client-college-invite') {
        const parties = activePartySystem()
        const party = parties ? partyForPlayer(parties, client.playerId) : null
        let reason: ProtocolPartyActionRejection | null = null
        if (sessionKind !== 'private-college' || !party) reason = 'party-missing'
        else if (party.leaderPlayerId !== client.playerId) reason = 'not-leader'
        else if (stateForPlayer(client.playerId).world.kind !== 'hub') reason = 'not-in-hub'
        else {
          const localTarget = localClientByReference(message.playerReference)
          if (message.playerReference === client.playerReference) reason = 'self-invite'
          else if (localTarget && party.memberPlayerIds.includes(localTarget.playerId)) {
            reason = 'same-party'
          } else if (
            party.memberPlayerIds.length
            + reservationsForParty(party.id)
            + detachedPartyRejoinsForParty(party.id, null) >= maxPlayers
          ) {
            reason = 'party-full'
          } else {
            reason = client.socialConnection
              ? client.socialConnection.inviteToCollege(
                  message.playerReference,
                  party.id,
                  party.joinCode,
                )
              : 'player-missing'
          }
        }
        sendPartyAction(
          client,
          'invite-college',
          { accepted: reason === null, reason },
        )
        return
      }
      if (message.type === 'client-chat') {
        const whisperTarget = message.channel === 'whisper'
          ? localClientByReference(message.targetPlayerReference!)
          : null
        if (whisperTarget?.playerId === client.playerId) {
          socket.send(encodeGameMessage({
            type: 'server-chat-rejected',
            channel: message.channel,
            reason: 'target-unavailable',
            retryAfterMs: 0,
          }))
          return
        }
        if (
          message.channel === 'global'
          && client.socialConnection
          && !client.onlinePreferences.globalChat
        ) {
          socket.send(encodeGameMessage({
            type: 'server-chat-rejected',
            channel: message.channel,
            reason: 'channel-unavailable',
            retryAfterMs: 0,
          }))
          return
        }
        if (
          message.channel === 'whisper'
          && !whisperTarget
          && !client.socialConnection
        ) {
          socket.send(encodeGameMessage({
            type: 'server-chat-rejected',
            channel: message.channel,
            reason: 'target-unavailable',
            retryAfterMs: 0,
          }))
          return
        }
        const recipients = whisperTarget
          ? [whisperTarget, client]
          : message.channel === 'global' && client.socialConnection
            ? []
            : chatRecipients(client, message.channel)
        if (recipients === null) {
          socket.send(encodeGameMessage({
            type: 'server-chat-rejected',
            channel: message.channel,
            reason: 'channel-unavailable',
            retryAfterMs: 0,
          }))
          return
        }
        const nowMs = Date.now()
        const retryAfterMs = chatRateRetryAfter(client, nowMs)
        if (retryAfterMs > 0) {
          socket.send(encodeGameMessage({
            type: 'server-chat-rejected',
            channel: message.channel,
            reason: 'rate-limited',
            retryAfterMs,
          }))
          return
        }
        if (message.channel === 'global' && client.socialConnection) {
          if (!client.socialConnection.publishGlobal(message.text)) {
            socket.send(encodeGameMessage({
              type: 'server-chat-rejected',
              channel: message.channel,
              reason: 'channel-unavailable',
              retryAfterMs: 0,
            }))
          }
          return
        }
        if (message.channel === 'whisper' && !whisperTarget) {
          if (!client.socialConnection!.publishWhisper(
            message.targetPlayerReference!,
            message.text,
          )) {
            socket.send(encodeGameMessage({
              type: 'server-chat-rejected',
              channel: message.channel,
              reason: 'target-unavailable',
              retryAfterMs: 0,
            }))
          }
          return
        }
        const encoded = encodeGameMessage({
          type: 'server-chat',
          channel: message.channel,
          ...(whisperTarget
            ? {
                recipient: {
                  displayName: whisperTarget.displayName,
                  playerId: whisperTarget.playerId,
                  playerReference: whisperTarget.playerReference,
                },
              }
            : {}),
          sender: {
            displayName: client.displayName,
            playerId: client.playerId,
            playerReference: client.playerReference,
          },
          sequence: nextChatSequence,
          text: message.text,
        })
        nextChatSequence += 1
        for (const recipient of recipients) {
          if (recipient.socket.readyState === WebSocket.OPEN) recipient.socket.send(encoded)
        }
        const senderState = stateForPlayer(client.playerId)
        for (const observer of observers.values()) {
          if (
            observer.socket.readyState === WebSocket.OPEN
            && observationWorld(observer.runId)?.state === senderState
          ) observer.socket.send(encoded)
        }
        return
      }
      if (message.type === 'client-party-invite') {
        if (!sharedWorlds) {
          sendPartyAction(client, 'invite', rejectedPartyAction('same-party'))
          return
        }
        const result = inviteSharedPartyPlayer(
          sharedWorlds,
          client.playerId,
          message.targetPlayerId,
          maxPlayers,
        )
        if (result.accepted) {
          sharedWorlds = result.state
          state = sharedWorlds.hub
          const invitation = sharedWorlds.parties.invitations.find(candidate => (
            candidate.inviterPlayerId === client.playerId
            && candidate.invitedPlayerId === message.targetPlayerId
          ))
          if (invitation && bots.has(message.targetPlayerId)) {
            pendingBotInvitations.push({
              acceptAtMs: performance.now() + 3_000,
              invitationId: invitation.id,
              playerId: message.targetPlayerId,
            })
          }
          if (invitation) {
            logPartyActivity(
              'party.invitation_sent',
              'A player invited someone to a party.',
              invitation.partyId,
              {
                invitationId: invitation.id,
                invited: activityPlayer(message.targetPlayerId),
                inviter: activityPlayer(client.playerId),
              },
            )
          }
          broadcastPartyState()
        }
        sendPartyAction(client, 'invite', result)
        return
      }
      if (message.type === 'client-party-accept') {
        if (!sharedWorlds) {
          sendPartyAction(client, 'accept-invitation', rejectedPartyAction('invitation-missing'))
          return
        }
        const sourcePartyId = partyForPlayer(sharedWorlds.parties, client.playerId)?.id ?? null
        const invitation = sharedWorlds.parties.invitations.find(
          candidate => candidate.id === message.invitationId,
        )
        const destinationPartyId = invitation?.partyId ?? null
        const result = acceptSharedPartyInvitation(
          sharedWorlds,
          client.playerId,
          message.invitationId,
          maxPlayers,
        )
        if (result.accepted) {
          if (sourcePartyId) closePartyModRuntimes(sourcePartyId)
          if (destinationPartyId) closePartyModRuntimes(destinationPartyId)
          sharedWorlds = result.state
          state = sharedWorlds.hub
          if (invitation) {
            logPartyActivity(
              'party.invitation_accepted',
              'A player accepted a party invitation.',
              invitation.partyId,
              {
                invitationId: invitation.id,
                invited: activityPlayer(client.playerId),
                inviter: activityPlayer(invitation.inviterPlayerId),
              },
            )
          }
          broadcastPartyState()
          broadcastSnapshot()
        }
        sendPartyAction(client, 'accept-invitation', result)
        return
      }
      if (message.type === 'client-party-deny') {
        if (!sharedWorlds) {
          sendPartyAction(client, 'deny-invitation', rejectedPartyAction('invitation-missing'))
          return
        }
        const invitation = sharedWorlds.parties.invitations.find(
          candidate => candidate.id === message.invitationId,
        )
        const result = denySharedPartyInvitation(
          sharedWorlds,
          client.playerId,
          message.invitationId,
        )
        if (result.accepted) {
          sharedWorlds = result.state
          state = sharedWorlds.hub
          if (invitation) {
            logPartyActivity(
              'party.invitation_denied',
              'A player denied a party invitation.',
              invitation.partyId,
              {
                invitationId: invitation.id,
                invited: activityPlayer(client.playerId),
                inviter: activityPlayer(invitation.inviterPlayerId),
              },
            )
          }
          broadcastPartyState()
        }
        sendPartyAction(client, 'deny-invitation', result)
        return
      }
      if (message.type === 'client-party-settings') {
        const parties = activePartySystem()
        const party = parties ? partyForPlayer(parties, client.playerId) : null
        const result = parties
          ? setPartyVisibility(parties, client.playerId, message.visibility)
          : rejectedPartyAction('party-missing')
        if (result.accepted) {
          replacePartySystem(result.state)
          logPartyActivity(
            'party.visibility_changed',
            'A party leader changed party visibility.',
            party?.id ?? null,
            {
              actor: activityPlayer(client.playerId),
              previousVisibility: party?.visibility ?? null,
              visibility: message.visibility,
            },
          )
        }
        sendPartyAction(client, 'settings', result)
        return
      }
      if (message.type === 'client-party-rotate-code') {
        const parties = activePartySystem()
        const party = parties ? partyForPlayer(parties, client.playerId) : null
        const result = parties
          ? rotatePartyJoinCode(parties, client.playerId, createPartyJoinCode())
          : rejectedPartyAction('party-missing')
        if (result.accepted) {
          if (party) client.socialConnection?.revokeCollegeInvitations(party.id)
          replacePartySystem(result.state)
          logPartyActivity(
            'party.join_code_rotated',
            'A party leader rotated the private Party ID.',
            party?.id ?? null,
            { actor: activityPlayer(client.playerId) },
          )
        }
        sendPartyAction(client, 'rotate-code', result)
        return
      }
      if (
        message.type === 'client-party-request-accept'
        || message.type === 'client-party-request-deny'
      ) {
        const parties = activePartySystem()
        const request = [...externalPartyJoinRequests.values()].find(candidate => (
          candidate.id === message.requestId && candidate.status === 'pending'
        ))
        const result = parties
          ? decidePartyJoinRequest(parties, client.playerId, message.requestId)
          : rejectedPartyAction('party-missing')
        if (result.accepted) {
          replacePartySystem(result.state)
          if (request) {
            request.status = message.type === 'client-party-request-accept' ? 'accepted' : 'denied'
          }
          logPartyActivity(
            message.type === 'client-party-request-accept'
              ? 'party.join_request_accepted'
              : 'party.join_request_denied',
            message.type === 'client-party-request-accept'
              ? 'A party leader accepted a join request.'
              : 'A party leader denied a join request.',
            request?.partyId ?? partyForPlayer(result.state, client.playerId)?.id ?? null,
            {
              actor: activityPlayer(client.playerId),
              requestId: message.requestId,
              requester: request?.requester ?? null,
            },
          )
        }
        sendPartyAction(
          client,
          message.type === 'client-party-request-accept' ? 'request-accept' : 'request-deny',
          result,
        )
        return
      }
      if (message.type === 'client-party-leave') {
        if (!sharedWorlds) {
          sendPartyAction(client, 'leave', { accepted: true, reason: null })
          disconnect(socket, 'invalid-message', 'You left the private College.')
          return
        }
        const sourcePartyId = partyForPlayer(sharedWorlds.parties, client.playerId)?.id ?? null
        const result = leaveSharedParty(sharedWorlds, client.playerId, createPartyIdentity())
        if (result.accepted) {
          if (sourcePartyId) closePartyModRuntimes(sourcePartyId)
          sharedWorlds = result.state
          state = sharedWorlds.hub
          logPartyActivity(
            'party.member_left',
            'A player left a party.',
            sourcePartyId,
            { player: activityPlayer(client.playerId) },
          )
          broadcastPartyState()
          broadcastSnapshot()
        }
        sendPartyAction(client, 'leave', result)
        return
      }
      if (message.type === 'client-party-kick') {
        if (!sharedWorlds) {
          const parties = activePartySystem()
          const party = parties ? partyForPlayer(parties, client.playerId) : null
          const target = [...clients.values()].find(candidate => (
            candidate.playerId === message.targetPlayerId
          ))
          const accepted = Boolean(
            party
            && party.leaderPlayerId === client.playerId
            && party.memberPlayerIds.includes(message.targetPlayerId)
            && message.targetPlayerId !== client.playerId
            && target,
          )
          sendPartyAction(
            client,
            'kick',
            accepted
              ? { accepted: true, reason: null }
              : rejectedPartyAction(party?.leaderPlayerId === client.playerId ? 'player-missing' : 'not-leader'),
          )
          if (accepted) {
            logPartyActivity(
              'party.member_kicked',
              'A party leader removed a player.',
              party!.id,
              {
                actor: activityPlayer(client.playerId),
                removedPlayer: activityPlayer(message.targetPlayerId),
              },
            )
            disconnect(target!.socket, 'invalid-message', 'The College leader removed you.')
          }
          return
        }
        const sourcePartyId = partyForPlayer(sharedWorlds.parties, client.playerId)?.id ?? null
        const result = kickSharedPartyPlayer(
          sharedWorlds,
          client.playerId,
          message.targetPlayerId,
          createPartyIdentity(),
        )
        if (result.accepted) {
          sharedWorlds = result.state
          state = sharedWorlds.hub
          logPartyActivity(
            'party.member_kicked',
            'A party leader removed a player.',
            sourcePartyId,
            {
              actor: activityPlayer(client.playerId),
              removedPlayer: activityPlayer(message.targetPlayerId),
            },
          )
          broadcastPartyState()
          broadcastSnapshot()
        }
        sendPartyAction(client, 'kick', result)
        return
      }
      if (message.type === 'client-cheat-mode') {
        if (sessionKind === 'private-college' && !client.developerAccess) {
          if (client.playerId !== authorityForPlayer(client.playerId)) {
            socket.send(encodeGameMessage({
              type: 'server-cheat-mode',
              enabled: privateCollegeCheatsEnabled,
            }))
            return
          }
          privateCollegeCheatsEnabled = message.enabled
          for (const participant of clients.values()) {
            participant.cheatsEnabled = privateCollegeCheatsEnabled
            if (privateCollegeCheatsEnabled) {
              participant.tutorialEligible = false
              participant.globalScoreEligible = false
              participant.localOnly = true
              taintActiveRun(participant)
            }
          }
          broadcast({
            type: 'server-cheat-mode',
            enabled: privateCollegeCheatsEnabled,
          })
          return
        }
        if (message.enabled) {
          if (sharedHub && !client.developerAccess) {
            disconnect(socket, 'invalid-message', 'Cheats require a private College.')
            return
          }
          if (client.developerAccess) return
          client.tutorialEligible = false
          client.globalScoreEligible = false
          client.localOnly = true
          taintActiveRun(client)
        }
        client.cheatsEnabled = message.enabled && !client.developerAccess
        socket.send(encodeGameMessage({
          type: 'server-cheat-mode',
          enabled: client.cheatsEnabled,
        }))
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
        if (sharedHub && !client.developerAccess) {
          sendLuaResult({
            error: 'Authoritative Lua is unavailable on the shared Hub host.',
            ok: false,
            output: [],
            values: [],
          })
          return
        }
        if (!client.developerAccess && client.playerId !== authorityForPlayer(client.playerId)) {
          sendLuaResult({
            error: 'Only the current session host may execute authoritative Lua.',
            ok: false,
            output: [],
            values: [],
          })
          return
        }
        if (gameplayPauseForPlayer(client.playerId) !== null) {
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
        if (!client.developerAccess) {
          client.tutorialEligible = false
          client.globalScoreEligible = false
          client.localOnly = true
          taintActiveRun(client)
        }
        const completeRequest = (result: Parameters<typeof sendLuaResult>[0]) => {
          client.pendingLuaRequestIds.delete(message.requestId)
          sendLuaResult(result)
        }
        void ensureLuaRuntime(client.playerId).then((runtime) => {
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
        const result = acknowledgeReplicationSnapshot(
          client,
          message.sequence,
          message.requireKeyframe,
        )
        if (result.kind === 'ahead') {
          disconnect(socket, 'invalid-message', 'Snapshot acknowledgement is ahead of the server.')
          return
        }
        if (
          result.kind === 'recovery-pending'
          && result.started
          && result.cause === 'baseline-missing'
        ) {
          logReplicationBaselineMissing(
            options.log,
            logDetails,
            client,
            'player',
            message.sequence,
            { playerId: client.playerId },
          )
        }
        if (result.kind === 'recovered') {
          logReplicationBaselineRecovered(
            options.log,
            logDetails,
            client,
            'player',
            result.recovery,
            { playerId: client.playerId },
          )
        }
        return
      }
      if (message.type === 'client-start-match') {
        const activeState = stateForPlayer(client.playerId)
        if (
          client.playerId !== authorityForPlayer(client.playerId)
          || loadedBoneyardForPlayer(client.playerId)
          || gameplayPauseForPlayer(client.playerId) !== null
          || activeState.levelUpBarrier !== null
          || activeState.run.phase !== 'hub'
          || activeState.world.kind !== 'hub'
          || activeState.world.participants[client.playerId]?.transition !== null
        ) return
        const selected = materializeBoneyard(
          boneyardCatalogForPlayer(client.playerId),
          message.boneyardId,
          consumeBoneyardSeed(),
        )
        if (!selected) {
          disconnect(socket, 'invalid-message', 'The selected Boneyard is unavailable.')
          return
        }
        if (sharedWorlds) {
          void beginSharedPartyRun(client.playerId, selected, socket)
          return
        }
        for (const connected of clients.values()) connected.hubActivity = null
        const privatePartyId = privateParties?.parties[0]?.id ?? null
        if (privatePartyId) client.socialConnection?.revokeCollegeInvitations(privatePartyId)
        loadedBoneyard = selected
        const previousState = state
        state = enterBoneyardWorld(state, selected)
        for (const connected of clients.values()) {
          connected.socialConnection?.refreshCollegeInvitationAvailability()
        }
        if (selected.choice.id !== 'stock-tutorial') {
          publishPlayerActivity(client, 'searching-solomon')
        }
        const beganLoadingGrace = beginRunLoadingResumeGrace(
          client.playerId,
          'game-started',
          null,
          false,
        )
        privateModHost?.activateBoneyard(webLuaBoneyardContentId(client.playerId, selected))
        if (privateModHost) armBoneyardRendererReadiness(state)
        armPartyRejoinSlotsForState(privatePartyId, state)
        logGameActivity(previousState, state, selected, null)
        taintIneligibleClientRuns()
        if (privateModHost || activePrivateLuaRuntimes().length > 0) {
          pendingLuaEvents.push(...deriveWebLuaEvents(
            previousState,
            state,
            name => privateModHost !== null
              || activePrivateLuaRuntimes().some(runtime => runtime.wantsEvent(name)),
          ))
        }
        broadcast({ type: 'server-boneyard-loaded', boneyard: selected })
        if (privateParties) broadcastPartyState()
        broadcastSnapshot()
        if (beganLoadingGrace) broadcastGameplayResumeGrace()
        publishSaveCheckpoint('boneyard-entry')
        return
      }
      if (message.type === 'client-ready-college-intro') {
        const activeState = stateForPlayer(client.playerId)
        if (
          activeState.world.kind === 'hub'
          && activeState.world.participants[client.playerId]?.collegeIntro !== null
          && getPlayerEconomy(activeState, client.playerId).collegeIntroPending
        ) {
          collegeIntroReadyPlayerIds.add(client.playerId)
        }
        return
      }
      if (message.type === 'client-start-tutorial') {
        const activeState = stateForPlayer(client.playerId)
        if (
          client.playerId !== authorityForPlayer(client.playerId)
          || loadedBoneyardForPlayer(client.playerId)
          || gameplayPauseForPlayer(client.playerId) !== null
          || activeState.levelUpBarrier !== null
          || activeState.run.phase !== 'hub'
        ) return
        if (!getPlayerEconomy(activeState, client.playerId).tutorialPending) {
          disconnect(
            socket,
            'invalid-message',
            'The stock Tutorial is available only to a fresh profile.',
          )
          return
        }
        if (sharedWorlds) {
          const party = partyForPlayer(sharedWorlds.parties, client.playerId)
          const content = party ? contentForParty(party.id) : null
          if (
            !party
            || party.memberPlayerIds.length !== 1
            || content?.manifest.mods.length !== 0
            || !client.globalScoreEligible
          ) {
            disconnect(
              socket,
              'invalid-message',
              'The stock Tutorial requires a solo vanilla party.',
            )
            return
          }
        } else if (content.mods.length !== 0 || !client.tutorialEligible) {
          disconnect(
            socket,
            'invalid-message',
            'The stock Tutorial requires a vanilla session with cheats disabled.',
          )
          return
        }
        const selected = materializeStockTutorial(consumeBoneyardSeed())
        leaderboardIneligibleRunIds.add(selected.runId)
        if (sharedWorlds) {
          void beginSharedPartyRun(client.playerId, selected, socket)
          return
        }
        loadedBoneyard = selected
        state = enterBoneyardWorld(state, selected)
        const privatePartyId = privateParties?.parties[0]?.id ?? null
        if (privatePartyId) client.socialConnection?.revokeCollegeInvitations(privatePartyId)
        for (const connected of clients.values()) {
          connected.socialConnection?.refreshCollegeInvitationAvailability()
        }
        const beganLoadingGrace = beginRunLoadingResumeGrace(
          client.playerId,
          'game-started',
          null,
          false,
        )
        armPartyRejoinSlotsForState(privatePartyId, state)
        stopAllClientInputs()
        broadcast({ type: 'server-boneyard-loaded', boneyard: selected })
        if (privateParties) broadcastPartyState()
        broadcastSnapshot()
        if (beganLoadingGrace) broadcastGameplayResumeGrace()
        publishSaveCheckpoint('tutorial-entry')
        return
      }
      if (message.type === 'client-tutorial-action') {
        const activeState = stateForPlayer(client.playerId)
        const next = applyGameSimulationTutorialAction(
          activeState,
          client.playerId,
          message.action,
        )
        if (next === null || next === activeState) return
        replaceStateForPlayer(client.playerId, next)
        stopWorldClientInputs(client.playerId)
        broadcastSnapshot()
        publishSaveCheckpoint('tutorial-action')
        return
      }
      if (message.type === 'client-continue-game-over') {
        if (sharedWorlds) {
          const continued = continueSharedPartyGameOver(
            sharedWorlds,
            client.playerId,
            message.runId,
            message.eventId,
          )
          if (!continued.accepted) return
          sharedWorlds = continued.state
          state = sharedWorlds.hub
          stopWorldClientInputs(client.playerId)
          broadcastSnapshot()
          return
        }
        const continued = continueGameSimulationOver(state, message.runId, message.eventId)
        if (!continued) return
        state = continued
        stopAllClientInputs()
        broadcastSnapshot()
        return
      }
      if (message.type === 'client-confirm-loadout') {
        if (sharedWorlds) {
          const confirmed = confirmSharedPartyLoadout(sharedWorlds, client.playerId, message)
          if (!confirmed.accepted) return
          client.displayName = message.displayName
          sharedGameplayPauses.delete(partyForPlayer(sharedWorlds.parties, client.playerId)?.id ?? '')
          sharedWorlds = confirmed.state
          state = sharedWorlds.hub
          stopWorldClientInputs(client.playerId)
          broadcastPartyState()
          broadcastSnapshot()
          if (sharedGameStateForPlayer(sharedWorlds, client.playerId)?.run.phase === 'hub') {
            publishSaveCheckpoint('loadout-confirmed')
          }
          return
        }
        const confirmed = confirmGameSimulationLoadout(state, client.playerId, message)
        if (!confirmed) return
        client.displayName = message.displayName
        state = confirmed
        if (privateParties) broadcastPartyState()
        broadcastSnapshot()
        if (state.run.phase === 'hub') publishSaveCheckpoint('loadout-confirmed')
        return
      }
      if (message.type === 'client-save-before-leave') {
        client.activeInput = createIdlePlayerCharacterInput()
        client.queuedInputs.clear()
        const checkpointSequence = publishSaveCheckpointForClient(
          client,
          'explicit-leave',
          true,
          true,
        )
        socket.send(encodeGameMessage({
          type: 'server-save-before-leave',
          checkpointSequence,
          requestId: message.requestId,
        }))
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
      const pendingPartyRejoin = pendingPartyRejoins.get(socket)
      if (pendingPartyRejoin) {
        pendingPartyRejoins.delete(socket)
        if (partyRejoinSlots.get(partyRecoverySlotKey(
          pendingPartyRejoin.recoveryId,
          pendingPartyRejoin.playerId,
        )) === pendingPartyRejoin) {
          pendingPartyRejoin.reservation = null
        }
      }
      const planned = disconnectCauses.get(socket)
      const observer = observers.get(socket)
      if (supersededClients.delete(socket)) return
      if (observer) {
        observers.delete(socket)
        const details = {
          closeCode,
          closeReason,
          disconnectReason: planned?.reason || closeReason || 'no reason received',
          disconnectSource: planned?.source ?? disconnectSource(closeCode),
          durationMs: Math.max(0, Date.now() - observer.connectedAtMs),
          observerId: observer.observerId,
          observerUserId: observer.requestedByUserId,
          observerUsername: observer.requestedByUsername,
          runId: observer.runId,
          ...(socketError ? gameServerErrorDetails(socketError) : {}),
        }
        logGameServerEvent(
          options.log,
          'game-host',
          closeCode === 1000 ? 'info' : 'warning',
          'observer.disconnected',
          'A developer observer disconnected from an active match.',
          logDetails(details),
        )
        emitRuntimeEvent(
          'observer.disconnected',
          'A developer observer disconnected from an active match.',
          details,
        )
        return
      }
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
      publishPlayerActivity(client, 'left-game')
      client.socialConnection?.close()
      clients.delete(socket)
      collegeIntroReadyPlayerIds.delete(client.playerId)
      const activeDeploymentRestart = deploymentRestart
      if (activeDeploymentRestart?.pending.delete(socket)) {
        if (activeDeploymentRestart.pending.size === 0) {
          activeDeploymentRestart.resolveReady()
        }
      }
      const disconnectedState = stateForClient(client)
      const disconnectedRunId = disconnectedState.world.kind === 'boneyard'
        ? disconnectedState.run.runId
        : null
      const disconnectedPartyId = client.partyRejoinSlot?.partyId ?? (
        activePartySystem()
          ? partyForPlayer(activePartySystem()!, client.playerId)?.id ?? null
          : null
      )
      const disconnectedPauseScope = client.partyRejoinSlot
        ? sharedGameplayPauseScopeForParty(client.partyRejoinSlot.partyId)
        : sharedWorlds ? sharedGameplayPauseScope(client.playerId) : null
      const releasedGameplayPause = gameplayPauseForPlayer(client.playerId)?.ownerPlayerId
        === client.playerId
      const retainedPartyMembership = detachPartyRejoinClient(
        client,
        disconnectedState,
        disconnectedPartyId,
      )
      if (retainedPartyMembership) {
        beginPartyRejoinWaitIfNeeded(
          client.playerId,
          disconnectedState,
          disconnectedPartyId,
        )
      }
      saveDocuments.delete(client.playerId)
      saveSequences.delete(client.playerId)
      if (sharedWorlds) {
        sharedWorlds = retainedPartyMembership
          ? detachSharedGamePlayer(sharedWorlds, client.playerId)
          : removeSharedGamePlayer(sharedWorlds, client.playerId)
        state = sharedWorlds.hub
        playerContents.delete(client.playerId)
        pendingRestoredModState.delete(client.playerId)
      } else {
        state = removePlayerCharacter(state, client.playerId)
        if (privateParties && !retainedPartyMembership) {
          privateParties = removePrivatePartyPlayer(privateParties, client.playerId)
        }
      }
      if (client.playerId === luaRuntimeOwnerPlayerId) resetLuaRuntime()
      if (clients.size === 0) removeAllBots('last human player disconnected')
      const retiredPrivateRunId = retireEmptyPrivateCollegeRun()
      if (clients.size === 0) {
        hostPlayerId = null
        resetLuaRuntime()
        if (resetWhenEmpty && !sharedHub) {
          state = createInitialSimulation(options.createSimulation)
          nextPlayerId = 1
          loadedBoneyard = null
          nextChatSequence = 1
          socialChatSequences.clear()
          nextSnapshotSequence = 1
          saveDocuments.clear()
          saveSequences.clear()
          playerReferences.clear()
          privateCollegeCheatsEnabled = false
          privateCollegeCheatPolicyInitialized = false
          if (privateParties) privateParties = createPartySystem()
          gameplayPause = null
          gameplayResumeGrace = null
          partyRejoinSlots.clear()
          partyRecoveryLineages.clear()
          resetNextTickDeadline()
        }
      } else if (client.playerId === hostPlayerId && !retainedPartyMembership) {
        hostPlayerId = clients.values().next().value?.playerId ?? null
      }
      removeGameplayResumeGraceParticipant(
        client.playerId,
        disconnectedPauseScope,
      )
      const retiredSharedRun = sharedWorlds !== null
        && disconnectedPartyId !== null
        && disconnectedRunId !== null
        && !sharedWorlds.runs.some(run => run.loadedBoneyard.runId === disconnectedRunId)
      const suspendedRunId = retiredSharedRun ? disconnectedRunId : retiredPrivateRunId
      if (suspendedRunId !== null) {
        retirePartyRecoveryLineagesForRun(suspendedRunId, 'suspended')
      }
      prunePartyRejoinSlots()
      pruneLeaderboardRunState()
      if (retiredSharedRun) {
        startingPartyIds.delete(disconnectedPartyId)
        closePartyModRuntimes(disconnectedPartyId)
        recordEmptyRunRetirement(disconnectedRunId, disconnectedPartyId)
      } else if (retiredPrivateRunId !== null) {
        recordEmptyRunRetirement(retiredPrivateRunId, disconnectedPartyId)
      }
      options.onPlayerCountChanged?.(clients.size)
      const source = planned?.source ?? disconnectSource(closeCode)
      const disconnectedDetails = {
        closeCode,
        closeReason,
        disconnectReason: planned?.reason || closeReason || 'no reason received',
        disconnectSource: source,
        displayName: client.displayName,
        durationMs: Math.max(0, Date.now() - client.connectedAtMs),
        lastInputSequence: client.lastReceivedSequence,
        playerCount: clients.size,
        playerId: client.playerId,
        serverTick: disconnectedState.tick,
        ...(socketError ? gameServerErrorDetails(socketError) : {}),
      }
      logGameServerEvent(
        options.log,
        'game-host',
        source === 'client-request' || (source === 'client-close' && closeCode === 1000)
          ? 'info'
          : 'warning',
        'player.disconnected',
        'A player disconnected from the game host.',
        logDetails(disconnectedDetails),
      )
      emitRuntimeEvent(
        'player.disconnected',
        'A player disconnected from the game host.',
        disconnectedDetails,
      )
      if (releasedGameplayPause) {
        releaseGameplayPause('owner-disconnected', client.playerId, disconnectedPauseScope)
      } else broadcastSnapshot()
      if (sharedWorlds || privateParties) broadcastPartyState()
      if (clients.size > 0 && !deploymentRestart) {
        publishSaveCheckpoint('participant-disconnected')
      }
    }
    socket.once('close', (code, reason) => release(code, reason.toString()))
    socket.once('error', (error) => release(null, '', error))
  })

  const ticksPerSnapshot = Math.max(1, Math.round(GAME_TICK_RATE / snapshotRate))
  const timer = setInterval(() => {
    if (closed || ticking) return
    const now = performance.now()
    expireGameplayResumeGraces(now)
    if (deploymentRestart) {
      resetNextTickDeadline()
      return
    }
    if (resetWhenEmpty && clients.size === 0) {
      resetNextTickDeadline()
      return
    }
    if (
      !sharedWorlds
      && (gameplayPause !== null || gameplayResumeGrace !== null)
    ) {
      resetNextTickDeadline()
      return
    }
    if (
      !sharedWorlds
      && privateModHost
      && state.run.runId
      && !boneyardRenderersReady(state.run.runId)
    ) {
      resetNextTickDeadline()
      return
    }
    if (!sharedWorlds && state.run.runId && privateModHost?.activeScene(state.run.runId)) {
      resetNextTickDeadline()
      return
    }
    ticking = true
    try {
      let steps = 0
      while (now >= nextTickAt && steps < 25) {
        processFailedBots()
        processPendingBotSummons()
        processPendingBotInvitations(now)
        stepBotControllers()
        drainBotIntents()
        taintIneligibleClientRuns()
        if (sharedWorlds) {
          const inputs: Record<PlayerId, PlayerCharacterInput> = {}
          for (const client of clients.values()) {
            if (client.partyRejoinSlot) continue
            const activeState = stateForPlayer(client.playerId)
            applyQueuedInput(client, activeState.tick + 1)
            inputs[client.playerId] = client.activeInput
          }
          for (const bot of bots.values()) inputs[bot.playerId] = bot.activeInput
          const enemySpawnIntents = new Map<
            string,
            import('../core-kernels/boneyard-wave-director.ts').BoneyardEnemySpawnIntent[]
          >()
          let developerStateBeforeLua: GameSimulationState | null = null
          let developerPartyId: string | null = null
          if (luaRuntime && luaRuntimeOwnerPlayerId) {
            const ownerState = sharedGameStateForPlayer(sharedWorlds, luaRuntimeOwnerPlayerId)
            if (ownerState) {
              developerStateBeforeLua = ownerState
              developerPartyId = partyForPlayer(
                sharedWorlds.parties,
                luaRuntimeOwnerPlayerId,
              )?.id ?? null
              luaRuntime.beginTick(ownerState.tick + 1)
              const applied = applyWebLuaCommands(ownerState, luaRuntime.drainCommands())
              replaceStateForPlayer(luaRuntimeOwnerPlayerId, applied.state)
              if (applied.nextRunSeed !== null) nextLuaRunSeed = applied.nextRunSeed
              if (developerPartyId && applied.enemySpawnIntents.length > 0) {
                enemySpawnIntents.set(developerPartyId, [...applied.enemySpawnIntents])
              }
            }
          }
          const statesBeforeMods = new Map(
            sharedWorlds.runs.map(run => [run.partyId, run.state]),
          )
          const rendererWaitingPartyIds = new Set(sharedWorlds.runs.flatMap(run => (
            partyModRuntimes.has(run.partyId)
            && run.state.run.runId
            && !boneyardRenderersReady(run.state.run.runId)
              ? [run.partyId]
              : []
          )))
          for (const [partyId, scope] of partyModRuntimes) {
            const run: SharedPartyRun | undefined = sharedWorlds.runs.find(
              candidate => candidate.partyId === partyId,
            )
            if (!run) continue
            if (rendererWaitingPartyIds.has(partyId)) continue
            if (run.state.run.runId && scope.runtime.activeScene(run.state.run.runId)) continue
            if (scope.runtime.tick(run.state.tick + 1)) {
              const viewer = run.state.playerEntities.identities[0]?.playerId
              if (viewer) broadcastPreparedModProjection(viewer, scope.runtime)
            }
            enemySpawnIntents.set(partyId, [
              ...(enemySpawnIntents.get(partyId) ?? []),
              ...scope.runtime.drainEnemySpawns(),
            ])
          }
          const previous = sharedWorlds
          const modScenePartyIds = [...partyModRuntimes].filter(([partyId, scope]) => {
            const run = sharedWorlds?.runs.find(candidate => candidate.partyId === partyId)
            return Boolean(run?.state.run.runId && scope.runtime.activeScene(run.state.run.runId))
          }).map(([partyId]) => partyId)
          sharedWorlds = stepSharedGameWorlds(
            sharedWorlds,
            inputs,
            new Set([
              ...sharedGameplayPauses.keys(),
              ...sharedGameplayResumeGraces.keys(),
              ...startingPartyIds,
              ...modScenePartyIds,
              ...rendererWaitingPartyIds,
            ]),
            enemySpawnIntents,
            new Map([...partyModRuntimes].map(([partyId, scope]) => [
              partyId,
              scope.runtime.extensions,
            ])),
            collegeIntroReadyPlayerIds,
            memorialPlayerProfiles(),
            memorialEligiblePlayerIds(),
            options.onMemorialStateChanged,
          )
          state = sharedWorlds.hub
          sampleMlBotTelemetry()
          if (luaRuntime && luaRuntimeOwnerPlayerId && developerStateBeforeLua) {
            const developerStateAfterLua = sharedGameStateForPlayer(
              sharedWorlds,
              luaRuntimeOwnerPlayerId,
            )
            if (developerStateAfterLua) {
              const events = deriveWebLuaEvents(
                developerStateBeforeLua,
                developerStateAfterLua,
                name => luaRuntime!.wantsEvent(name),
              )
              for (const event of events) luaRuntime.dispatch(event.name, event.payload)
            }
          }
          let lifecycleBoundary = false
          const completedCollegeIntros = completedGameSimulationCollegeIntroPlayerIds(
            previous.hub,
            sharedWorlds.hub,
          )
          for (const playerId of completedCollegeIntros) {
            collegeIntroReadyPlayerIds.delete(playerId)
            const client = [...clients.values()].find((candidate) => (
              candidate.playerId === playerId
            ))
            if (client) publishSaveCheckpointForClient(client, 'college-intro-complete')
          }
          if (completedCollegeIntros.length > 0) lifecycleBoundary = true
          for (const steppedRun of [...sharedWorlds.runs]) {
            let run = steppedRun
            const before = previous.runs.find(({ partyId }) => partyId === run.partyId)
            if (!before) continue
            const scope = partyModRuntimes.get(run.partyId)
            if (scope) {
              const projectionRevision = scope.runtime.projectionRevision()
              const events = [
                ...scope.pendingEvents.splice(0),
                ...deriveWebLuaEvents(
                  statesBeforeMods.get(run.partyId) ?? before.state,
                  run.state,
                ),
              ]
              scope.runtime.step(
                events,
                run.state.tick,
                run.state.run.runId ?? run.partyId,
              )
              run = sharedWorlds.runs.find(candidate => candidate.partyId === run.partyId) ?? run
              if (scope.runtime.projectionRevision() !== projectionRevision) {
                const viewer = run.state.playerEntities.identities[0]?.playerId
                if (viewer) broadcastPreparedModProjection(viewer, scope.runtime)
              }
            }
            const synchronizedRejoins = synchronizePartyRejoinMilestones(
              run.partyId,
              run.state,
            )
            if (synchronizedRejoins !== run.state) {
              run = { ...run, state: synchronizedRejoins }
              sharedWorlds = {
                ...sharedWorlds,
                runs: sharedWorlds.runs.map(candidate => (
                  candidate.partyId === run.partyId ? run : candidate
                )),
              }
              lifecycleBoundary = true
            }
            logGameActivity(before.state, run.state, run.loadedBoneyard, run.partyId)
            const enteredGameOver = before.state.run.phase === 'active'
              && run.state.run.phase === 'game-over'
            const completedGameOver = before.state.run.phase === 'game-over'
              && run.state.run.phase === 'loadout'
            const previousBarrierId = before.state.levelUpBarrier?.barrierId ?? null
            const barrierId = run.state.levelUpBarrier?.barrierId ?? null
            publishLeaderboardReceipts(before.state, run.state)
            const tutorialBoundary = tutorialSaveBoundaryKey(before.state)
              !== tutorialSaveBoundaryKey(run.state)
            if (tutorialBoundary) {
              publishSharedPartyCheckpoint(run.partyId, 'tutorial-boundary')
              lifecycleBoundary = true
            }
            if (enteredGameOver) publishSharedProfileCheckpoint(run.partyId)
            if (enteredGameOver || completedGameOver || previousBarrierId !== barrierId) {
              stopPartyInputs(run.partyId)
              lifecycleBoundary = true
            }
          }
          nextTickAt += GAME_FIXED_TICK_SECONDS * 1000
          steps += 1
          if (
            lifecycleBoundary
            || (
              state.tick !== previous.hub.tick
              && state.tick % ticksPerSnapshot === 0
            )
          ) broadcastSnapshot()
          if (
            state.tick !== previous.hub.tick
            && state.tick % GAME_SAVE_AUTOSAVE_INTERVAL_TICKS === 0
          ) {
            publishSaveCheckpoint('periodic')
          }
          continue
        }
        const inputs: Record<PlayerId, PlayerCharacterInput> = {}
        const nextTick = state.tick + 1
        for (const client of clients.values()) {
          if (client.partyRejoinSlot) continue
          applyQueuedInput(client, nextTick)
          inputs[client.playerId] = client.activeInput
        }
        for (const bot of bots.values()) inputs[bot.playerId] = bot.activeInput
        const previousTick = state.tick
        const previousState = state
        const previousBarrierId = state.levelUpBarrier?.barrierId ?? null
        const previousRunPhase = state.run.phase
        const previousGameOverExitTicks = state.run.gameOverExitTicks
        const stateBeforeLua = state
        let enemySpawnIntents = [] as import('../core-kernels/boneyard-wave-director.ts').BoneyardEnemySpawnIntent[]
        const runtimes = activePrivateLuaRuntimes()
        if (privateModHost?.tick(nextTick)) {
          const viewer = state.playerEntities.identities[0]?.playerId
          if (viewer) broadcastPreparedModProjection(viewer, privateModHost)
        }
        enemySpawnIntents.push(...privateModHost?.drainEnemySpawns() ?? [])
        for (const runtime of runtimes) {
          runtime.beginTick(nextTick)
          const applied = applyWebLuaCommands(state, runtime.drainCommands())
          state = applied.state
          enemySpawnIntents.push(...applied.enemySpawnIntents)
          if (applied.nextRunSeed !== null) nextLuaRunSeed = applied.nextRunSeed
        }
        state = stepGameSimulationTick(state, inputs, {
          collegeIntroReadyPlayerIds,
          enemySpawnIntents,
          extensions: privateModHost?.extensions,
        })
        const pendingEvents = pendingLuaEvents.splice(0)
        if (privateModHost) {
          const projectionRevision = privateModHost.projectionRevision()
          privateModHost.step([
            ...pendingEvents,
            ...deriveWebLuaEvents(stateBeforeLua, state),
          ], state.tick, state.run.runId ?? 'private-session')
          if (privateModHost.projectionRevision() !== projectionRevision) {
            const viewer = state.playerEntities.identities[0]?.playerId
            if (viewer) broadcastPreparedModProjection(viewer, privateModHost)
          }
        }
        state = synchronizePartyRejoinMilestones(
          privateParties?.parties[0]?.id ?? null,
          state,
        )
        const completedCollegeIntros = completedGameSimulationCollegeIntroPlayerIds(
          previousState,
          state,
        )
        for (const playerId of completedCollegeIntros) {
          collegeIntroReadyPlayerIds.delete(playerId)
          const client = [...clients.values()].find((candidate) => (
            candidate.playerId === playerId
          ))
          if (client) publishSaveCheckpointForClient(client, 'college-intro-complete')
        }
        if (runtimes.length > 0) {
          const events = [
            ...pendingEvents,
            ...deriveWebLuaEvents(
              stateBeforeLua,
              state,
              name => runtimes.some(runtime => runtime.wantsEvent(name)),
            ),
          ]
          for (const event of events) for (const runtime of runtimes) {
            runtime.dispatch(event.name, event.payload)
          }
        }
        logGameActivity(stateBeforeLua, state, loadedBoneyard, null)
        publishLeaderboardReceipts(stateBeforeLua, state)
        const barrierId = state.levelUpBarrier?.barrierId ?? null
        const reachedGameOverBlack = state.run.phase === 'game-over'
          && state.run.gameOverExitTicks !== null
          && state.run.gameOverExitTicks === gameOverExitDurationTicks(
            state.run.gameOverExitKind,
          )
          && previousGameOverExitTicks !== state.run.gameOverExitTicks
        const enteredGameOver = previousRunPhase === 'active'
          && state.run.phase === 'game-over'
        const completedGameOver = previousRunPhase === 'game-over'
          && state.world.kind === 'hub'
          && (state.run.phase === 'loadout' || state.run.phase === 'hub')
        const tutorialBoundary = tutorialSaveBoundaryKey(stateBeforeLua)
          !== tutorialSaveBoundaryKey(state)
        if (completedGameOver) loadedBoneyard = null
        if (tutorialBoundary) publishSaveCheckpoint('tutorial-boundary')
        if (enteredGameOver) publishProfileCheckpoint()
        if (enteredGameOver || completedGameOver) stopAllClientInputs()
        if (previousBarrierId === null && barrierId !== null) stopAllClientInputs()
        nextTickAt += GAME_FIXED_TICK_SECONDS * 1000
        steps += 1
        if (
          previousBarrierId !== barrierId
          || completedCollegeIntros.length > 0
          || tutorialBoundary
          || enteredGameOver
          || reachedGameOverBlack
          || completedGameOver
          || (state.tick !== previousTick && state.tick % ticksPerSnapshot === 0)
        ) broadcastSnapshot()
        if (
          state.tick !== previousTick
          && state.tick % GAME_SAVE_AUTOSAVE_INTERVAL_TICKS === 0
        ) publishSaveCheckpoint('periodic')
      }
      pruneLeaderboardRunState()
      prunePartyRejoinSlots()
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
  const partyAccessTimer = setInterval(() => {
    if (!closed && prunePartyAccess()) broadcastPartyState()
  }, 1_000)
  partyAccessTimer.unref()

  function publishSaveCheckpoint(source: string): void {
    for (const client of clients.values()) {
      publishSaveCheckpointForClient(client, source)
    }
  }

  function publishProfileCheckpoint(): void {
    for (const client of clients.values()) {
      publishSaveCheckpointForClient(client, 'game-over', true, true)
    }
  }

  function publishSharedProfileCheckpoint(partyId: string): void {
    if (!sharedWorlds) return
    const party = sharedWorlds.parties.parties.find(({ id }) => id === partyId)
    if (!party) return
    const memberIds = new Set(party.memberPlayerIds)
    for (const client of clients.values()) {
      if (memberIds.has(client.playerId)) {
        publishSaveCheckpointForClient(client, 'game-over', true, true)
      }
    }
  }

  function publishSharedPartyCheckpoint(partyId: string, source: string): void {
    if (!sharedWorlds) return
    const party = sharedWorlds.parties.parties.find(({ id }) => id === partyId)
    if (!party) return
    const memberIds = new Set(party.memberPlayerIds)
    for (const client of clients.values()) {
      if (memberIds.has(client.playerId)) publishSaveCheckpointForClient(client, source)
    }
  }

  function publishSaveCheckpointForClient(
    client: HostClient,
    source: string,
    force = false,
    includeTerminalProfile = false,
    targetRevision: string | null = partyRecoveryRevision,
  ): number {
    if (client.socket.readyState !== WebSocket.OPEN) return 0
    if (client.partyRejoinSlot && activeRunForPartyRejoin(client.partyRejoinSlot) === null) {
      return 0
    }
    const saveState = client.partyRejoinSlot
      ? partyRejoinStagingState(client.partyRejoinSlot)
      : sharedWorlds
        ? sharedPartySaveStateForPlayer(sharedWorlds, client.playerId)
        : state
    if (!saveState) return 0
    const terminal = saveState.run.phase === 'game-over' || saveState.run.phase === 'loadout'
    if (terminal && !includeTerminalProfile) return 0
    let document: string
    try {
      const party = client.partyRejoinSlot
        ? activePartySystem()?.parties.find(({ id }) => id === client.partyRejoinSlot!.partyId)
          ?? null
        : sharedWorlds ? partyForPlayer(sharedWorlds.parties, client.playerId) : null
      const sharedContent = sharedWorlds
        ? saveState.world.kind === 'boneyard' && party
          ? contentForParty(party.id)
          : playerContents.get(client.playerId) ?? null
        : null
      if (sharedWorlds && !sharedContent) {
        throw new Error('connected player has no save content manifest')
      }
      const scope = party && saveState.world.kind === 'boneyard'
        ? partyModRuntimes.get(party.id)
        : null
      const integrity: GameSaveIntegrity = client.localOnly ? 'local-only' : 'global-clean'
      const documentOptions = {
        integrity,
        mods: sharedContent?.manifest.mods ?? content.mods,
        modState: preparedModSaveState(scope?.runtime ?? privateModHost),
        nativeSource: client.nativeSource,
        partyRejoinToken: null,
        playerId: client.playerId,
        state: saveState,
      }
      const unsignedDocument = terminal
        ? createGameProfileSaveDocument(documentOptions)
        : createGameSaveDocument({
            ...documentOptions,
            loadedBoneyard: client.partyRejoinSlot
              ? loadedBoneyardForPartyRejoin(client.partyRejoinSlot)
              : loadedBoneyardForPlayer(client.playerId),
          })
      const slot = terminal ? null : partyRejoinSlotForClient(client)
      const lineage = slot ? partyRecoveryLineages.get(slot.recoveryId) ?? null : null
      if (slot && lineage) {
        const party = activePartySystem()?.parties.find(({ id }) => id === lineage.partyId)
        if (!party) throw new Error('party recovery lineage lost its membership')
        const token = createPartyRecoveryClaim(partyRecoverySecret, {
          contentManifestSha256: lineage.content.manifest.manifestSha256,
          globalScoreEligible: client.globalScoreEligible,
          integrity,
          leaderboardUserId: client.leaderboardUserId,
          partyMemberCount: lineage.partyMemberCount,
          partyLeaderPlayerId: party.leaderPlayerId,
          partyRoster: recoveryRosterForParty(party.id),
          partyVisibility: party.visibility,
          playerId: client.playerId,
          recoveryId: lineage.recoveryId,
          runId: lineage.runId,
          sessionKind,
          targetRevision,
        }, unsignedDocument)
        slot.token = token
        document = createGameSaveDocument({
          ...documentOptions,
          loadedBoneyard: client.partyRejoinSlot
            ? loadedBoneyardForPartyRejoin(client.partyRejoinSlot)
            : loadedBoneyardForPlayer(client.playerId),
          partyRejoinToken: token,
        })
      } else {
        document = unsignedDocument
      }
    } catch (error) {
      logGameServerEvent(
        options.log,
        'game-host',
        'error',
        'save.checkpoint_failed',
        'An authoritative player state could not produce a save checkpoint.',
        logDetails({
          playerId: client.playerId,
          source,
          ...gameServerErrorDetails(error),
        }),
      )
      return 0
    }
    const previousSequence = saveSequences.get(client.playerId) ?? 0
    if (!force && saveDocuments.get(client.playerId) === document) {
      return previousSequence
    }
    const sequence = previousSequence + 1
    saveSequences.set(client.playerId, sequence)
    saveDocuments.set(client.playerId, document)
    client.socket.send(encodeGameMessage({
      type: 'server-save-checkpoint',
      save: document,
      reason: terminal ? 'game-over' : 'progress',
      sequence,
    }))
    return sequence
  }

  function broadcastSnapshot(): void {
    const defaultSnapshot = sharedWorlds ? null : createGameSnapshot(
      state,
      hostPlayerId,
      hubActivitiesForSnapshot(state),
    )
    const snapshotSequence = nextSnapshotSequence
    nextSnapshotSequence += 1
    const periodicKeyframe = snapshotSequence % Math.max(1, snapshotRate * 5) === 0
    for (const client of clients.values()) {
      if (client.socket.readyState !== WebSocket.OPEN) continue
      if (client.partyRejoinSlot && activeRunForPartyRejoin(client.partyRejoinSlot) === null) {
        disconnectCauses.set(client.socket, {
          reason: 'active party run ended during catch-up',
          source: 'party-rejoin-ended',
        })
        client.socket.close(1000, 'active party run ended')
        continue
      }
      if (
        client.replicationRecovery
        && client.replicationRecovery.keyframeSequence !== null
      ) continue
      const snapshot = client.partyRejoinSlot
        ? {
            ...createGameSnapshot(
              partyRejoinStagingState(client.partyRejoinSlot),
              activePartySystem()?.parties.find(({ id }) => (
                id === client.partyRejoinSlot!.partyId
              ))?.leaderPlayerId ?? null,
            ),
            materializingPlayerIds: [client.playerId],
          }
        : defaultSnapshot ?? createGameSnapshot(
            stateForPlayer(client.playerId),
            authorityForPlayer(client.playerId),
            hubActivitiesForSnapshot(stateForPlayer(client.playerId)),
          )
      const currentBaseline = createReplicatedEntityBaseline(snapshot)
      const acknowledgedBaseline = client.sentReplicationBaselines.get(
        client.acknowledgedSnapshotSequence,
      )
      const recoveryKeyframe = client.replicationRecovery !== null
      const forceKeyframe = periodicKeyframe
        || recoveryKeyframe
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
      sendPreparedModRuntime(
        client.socket,
        modRuntimeScopeForPlayer(client.playerId)?.runtime ?? privateModHost,
        client.playerId,
      )
      client.lastSentSnapshotSequence = snapshotSequence
      client.sentReplicationBaselines.set(snapshotSequence, currentBaseline)
      if (recoveryKeyframe && client.replicationRecovery) {
        client.replicationRecovery.keyframeSequence = snapshotSequence
      }
      pruneReplicationBaselines(client)
    }
    for (const observer of observers.values()) {
      if (observer.socket.readyState !== WebSocket.OPEN) continue
      if (
        observer.replicationRecovery
        && observer.replicationRecovery.keyframeSequence !== null
      ) continue
      const observed = observationWorld(observer.runId)
      if (!observed) {
        disconnectCauses.set(observer.socket, {
          reason: 'observed match ended',
          source: 'observer-target-ended',
        })
        observer.socket.close(1000, 'observed match ended')
        continue
      }
      const snapshot = createGameSnapshot(observed.state, observed.authorityPlayerId, {})
      const currentBaseline = createReplicatedEntityBaseline(snapshot)
      const acknowledgedBaseline = observer.sentReplicationBaselines.get(
        observer.acknowledgedSnapshotSequence,
      )
      const recoveryKeyframe = observer.replicationRecovery !== null
      const forceKeyframe = periodicKeyframe
        || recoveryKeyframe
        || !acknowledgedBaseline
      observer.socket.send(encodeGameMessage({
        type: 'server-snapshot',
        acknowledgedInputSequence: 0,
        frame: createGameSnapshotFrame(
          snapshot,
          observer.acknowledgedSnapshotSequence,
          acknowledgedBaseline,
          forceKeyframe,
        ),
        sequence: snapshotSequence,
      }))
      sendPreparedModRuntime(
        observer.socket,
        modRuntimeScopeForPlayer(observer.viewPlayerId)?.runtime ?? privateModHost,
        observer.viewPlayerId,
      )
      observer.lastSentSnapshotSequence = snapshotSequence
      observer.sentReplicationBaselines.set(snapshotSequence, currentBaseline)
      if (recoveryKeyframe && observer.replicationRecovery) {
        observer.replicationRecovery.keyframeSequence = snapshotSequence
      }
      pruneReplicationBaselines(observer)
    }
  }

  function hubActivitiesForSnapshot(
    activeState: GameSimulationState,
  ): Readonly<Record<string, HubPlayerActivity | null>> {
    if (activeState.world.kind !== 'hub') return {}
    const participantIds = new Set(Object.keys(activeState.world.participants))
    return Object.fromEntries([...clients.values()].flatMap(client => (
      participantIds.has(client.playerId)
        ? [[client.playerId, client.hubActivity] as const]
        : []
    )))
  }

  function stateForPlayer(playerId: string): GameSimulationState {
    if (!sharedWorlds) return state
    const playerState = sharedGameStateForPlayer(sharedWorlds, playerId)
    if (!playerState) throw new Error(`connected player ${playerId} has no shared world`)
    return playerState
  }

  function replaceStateForPlayer(playerId: string, nextState: GameSimulationState): void {
    if (!sharedWorlds) {
      state = nextState
      return
    }
    sharedWorlds = replaceSharedGameStateForPlayer(sharedWorlds, playerId, nextState)
    state = sharedWorlds.hub
  }

  function authorityForPlayer(playerId: string): string | null {
    return sharedWorlds
      ? partyForPlayer(sharedWorlds.parties, playerId)?.leaderPlayerId ?? null
      : hostPlayerId
  }

  function loadedBoneyardForPlayer(playerId: string): LoadedBoneyard | null {
    return sharedWorlds
      ? sharedLoadedBoneyardForPlayer(sharedWorlds, playerId)
      : loadedBoneyard
  }

  function stateForClient(client: HostClient): GameSimulationState {
    if (!client.partyRejoinSlot) return stateForPlayer(client.playerId)
    return activeRunForPartyRejoin(client.partyRejoinSlot) && client.partyRejoinSlot.detachedState
      ? partyRejoinStagingState(client.partyRejoinSlot)
      : sharedWorlds?.hub ?? state
  }

  function partyRejoinStagingState(slot: PartyRejoinSlot): GameSimulationState {
    const active = activeRunForPartyRejoin(slot)
    if (!active || !slot.detachedState) {
      throw new Error('party rejoin staging lost its active run or detached actor')
    }
    return projectDetachedGameSimulationPlayer(active, slot.detachedState)
  }

  function replacePartyRejoinRunState(
    slot: PartyRejoinSlot,
    nextState: GameSimulationState,
  ): void {
    if (!sharedWorlds) {
      state = nextState
      return
    }
    sharedWorlds = {
      ...sharedWorlds,
      runs: sharedWorlds.runs.map(run => run.partyId === slot.partyId
        ? { ...run, state: nextState }
        : run),
    }
    state = sharedWorlds.hub
  }

  function loadedBoneyardForPartyRejoin(slot: PartyRejoinSlot): LoadedBoneyard | null {
    return sharedWorlds
      ? sharedWorlds.runs.find(run => (
          run.partyId === slot.partyId && run.loadedBoneyard.runId === slot.runId
        ))?.loadedBoneyard ?? null
      : loadedBoneyard?.runId === slot.runId ? loadedBoneyard : null
  }

  function gameplayPauseForPartyRejoin(slot: PartyRejoinSlot): GameplayPauseState | null {
    return sharedWorlds
      ? sharedGameplayPauses.get(slot.partyId) ?? null
      : gameplayPause
  }

  function partyRejoinSlotForClient(client: HostClient): PartyRejoinSlot | null {
    if (client.partyRejoinSlot) return client.partyRejoinSlot
    const activeState = sharedWorlds
      ? sharedGameStateForPlayer(sharedWorlds, client.playerId)
      : state.playerEntities.identities.some(({ playerId }) => playerId === client.playerId)
        ? state
        : null
    if (!activeState || activeState.world.kind !== 'boneyard' || !activeState.run.runId) return null
    const partyId = activePartySystem()
      ? partyForPlayer(activePartySystem()!, client.playerId)?.id ?? null
      : null
    if (!partyId) return null
    const lineage = [...partyRecoveryLineages.values()].find(candidate => (
      candidate.partyId === partyId && candidate.runId === activeState.run.runId
    ))
    return lineage
      ? partyRejoinSlots.get(partyRecoverySlotKey(lineage.recoveryId, client.playerId)) ?? null
      : null
  }

  function materializePartyRejoinSlot(
    slot: PartyRejoinSlot,
    reservationId: string | null,
  ): string | null {
    if (!slot.detachedState || !slot.partyIdentity) {
      return 'The active-party rejoin is missing its detached wizard.'
    }
    if (sharedWorlds) {
      const rejoined = rejoinSharedPartyRunPlayer(
        sharedWorlds,
        slot.detachedState,
        slot.playerId,
        slot.partyId,
        slot.partyIdentity,
        availablePartyMembers(slot.partyId, reservationId, slot.playerId),
        null,
      )
      if (!rejoined.accepted) return partyRejectionMessage(rejoined.reason)
      sharedWorlds = rejoined.state
      state = sharedWorlds.hub
      return null
    }
    const destination = privateParties?.parties.find(({ id }) => id === slot.partyId) ?? null
    if (!privateParties || !destination) return 'The active party no longer exists.'
    const existingParty = partyForPlayer(privateParties, slot.playerId)
    if (existingParty && existingParty.id !== destination.id) {
      return 'The returning wizard belongs to another party.'
    }
    try {
      state = rejoinGameSimulationPlayer(
        state,
        slot.detachedState,
        slot.playerId,
        null,
      )
    } catch (error) {
      return error instanceof Error ? error.message : 'The active run cannot be rejoined.'
    }
    if (!existingParty) {
      const registered = registerPartyPlayer(privateParties, slot.playerId, slot.partyIdentity)
      const joined = joinPartyPlayer(
        registered,
        slot.playerId,
        destination.id,
        availablePartyMembers(destination.id, reservationId, slot.playerId),
      )
      if (!joined.accepted) {
        state = removePlayerCharacter(state, slot.playerId)
        return partyRejectionMessage(joined.reason)
      }
      privateParties = joined.state
    }
    return null
  }

  function logGameActivity(
    previous: GameSimulationState,
    current: GameSimulationState,
    loaded: LoadedBoneyard | null,
    partyId: string | null,
  ): void {
    for (const activity of deriveGameActivityEvents(
      projectGameActivity(previous),
      projectGameActivity(current),
    )) {
      emitRuntimeEvent(
        activity.event,
        activity.message,
        {
          boneyardId: loaded?.choice.id ?? null,
          boneyardName: loaded?.choice.name ?? null,
          boneyardSource: loaded?.choice.source ?? null,
          partyId,
          ...activity.details,
        },
      )
    }
  }

  function activityPlayer(playerId: string): Readonly<Record<string, unknown>> {
    const participant = [...clients.values(), ...bots.values()].find(candidate => (
      candidate.playerId === playerId
    ))
    return {
      accountUsername: participant?.profile.accountUsername ?? null,
      displayName: participant?.displayName ?? playerId,
      playerId,
    }
  }

  function memorialPlayerProfiles(): ReadonlyMap<PlayerId, HubMemorialPlayerProfile> {
    return new Map([
      ...[...partyRejoinSlots.values()].map(({ playerId, profile }) => [
        playerId,
        { accountUsername: profile.accountUsername },
      ] as const),
      ...[...clients.values()].map(({ playerId, profile }) => [
        playerId,
        { accountUsername: profile.accountUsername },
      ] as const),
      ...[...bots.values()].map(({ playerId, profile }) => [
        playerId,
        { accountUsername: profile.accountUsername },
      ] as const),
    ])
  }

  function memorialEligiblePlayerIds(): ReadonlySet<PlayerId> {
    return new Set([
      ...[...clients.values()]
        .filter(client => client.onlinePreferences.submitRuns)
        .map(client => client.playerId),
      ...bots.keys(),
    ])
  }

  function activityParty(partyId: string | null): Readonly<Record<string, unknown>> {
    const party = partyId
      ? activePartySystem()?.parties.find(candidate => candidate.id === partyId) ?? null
      : null
    return {
      partyId,
      partyLeader: party ? activityPlayer(party.leaderPlayerId) : null,
      partyMemberCount: party?.memberPlayerIds.length ?? null,
      partyMembers: party?.memberPlayerIds.map(activityPlayer) ?? [],
      partyVisibility: party?.visibility ?? null,
    }
  }

  function logPartyActivity(
    event: string,
    message: string,
    partyId: string | null,
    details: Readonly<Record<string, unknown>> = {},
  ): void {
    emitRuntimeEvent(
      event,
      message,
      { ...activityParty(partyId), ...details },
    )
  }

  function partyRosterStateForPlayer(
    partyId: string,
    playerId: string,
  ): PartyRosterPlayer {
    const connected = [...clients.values()].some(client => client.playerId === playerId)
      || bots.has(playerId)
    const liveState = sharedWorlds
      ? sharedGameStateForPlayer(sharedWorlds, playerId)
      : state.playerEntities.identities.some(identity => identity.playerId === playerId)
        ? state
        : null
    if (liveState) {
      const character = getPlayerCharacter(liveState, playerId)
      const progression = getPlayerProgression(liveState, playerId)
      return {
        connected,
        currentHealth: progression.currentHealth,
        displayName: character.config.displayName,
        element: character.config.element,
        lifeState: progression.lifeState,
        maximumHealth: progression.maximumHealth,
        playerId,
      }
    }
    const slot = [...partyRejoinSlots.values()].find(candidate => (
      candidate.partyId === partyId
      && candidate.playerId === playerId
      && candidate.detachedState !== null
    ))
    const detachedConfig = slot?.detachedState?.playerEntities.configs[0]
    const detachedProgression = slot?.detachedState?.playerEntities.progressions[0]
    if (detachedConfig && detachedProgression) {
      return {
        connected,
        currentHealth: detachedProgression.currentHealth,
        displayName: detachedConfig.displayName,
        element: detachedConfig.element,
        lifeState: detachedProgression.lifeState,
        maximumHealth: detachedProgression.maximumHealth,
        playerId,
      }
    }
    const retained = [...partyRecoveryLineages.values()]
      .find(lineage => lineage.partyId === partyId)
      ?.partyRoster.find(member => member.playerId === playerId)
    if (!retained) throw new Error(`party roster has no authoritative state for ${playerId}`)
    return { ...retained, connected }
  }

  function partyRosterForParty(partyId: string): readonly PartyRosterPlayer[] {
    const party = activePartySystem()?.parties.find(candidate => candidate.id === partyId)
    if (!party) throw new Error(`party roster has no membership ${partyId}`)
    return party.memberPlayerIds.map(playerId => partyRosterStateForPlayer(partyId, playerId))
  }

  function recoveryRosterForParty(partyId: string): readonly PartyRecoveryRosterMember[] {
    return partyRosterForParty(partyId).map(({
      currentHealth,
      displayName,
      element,
      lifeState,
      maximumHealth,
      playerId,
    }) => ({
      currentHealth,
      displayName,
      element,
      lifeState,
      maximumHealth,
      playerId,
    }))
  }

  function sameRecoveryRosterMembership(
    first: readonly PartyRecoveryRosterMember[],
    second: readonly PartyRecoveryRosterMember[],
  ): boolean {
    return first.length === second.length && first.every((member, index) => {
      const candidate = second[index]
      return candidate?.playerId === member.playerId
        && candidate.displayName === member.displayName
        && candidate.element === member.element
    })
  }

  function broadcastPartyState(): void {
    prunePartyAccess()
    const parties = activePartySystem()
    if (!parties) return
    const profiles = new Map<string, PartyPlayerProfile>(
      [...clients.values(), ...bots.values()].map(({ displayName, playerId, profile }) => [
        playerId,
        { ...profile, displayName, playerId },
      ]),
    )
    const roster = new Map<string, PartyRosterPlayer>()
    for (const party of parties.parties) {
      for (const row of partyRosterForParty(party.id)) {
        roster.set(row.playerId, row)
        if (!profiles.has(row.playerId)) {
          const slot = [...partyRejoinSlots.values()].find(candidate => (
            candidate.partyId === party.id && candidate.playerId === row.playerId
          ))
          profiles.set(row.playerId, {
            ...(slot?.profile ?? {
              accountUsername: null,
              highestWave: null,
              totalPlaytimeMs: null,
            }),
            displayName: row.displayName,
            playerId: row.playerId,
          })
        }
      }
    }
    const hubPlayerIds = new Set(sharedWorlds
      ? sharedWorlds.hub.playerEntities.identities.map(({ playerId }) => playerId)
      : [...clients.values()].filter(client => !client.partyRejoinSlot)
          .map(({ playerId }) => playerId))
    for (const client of clients.values()) {
      if (
        client.socket.readyState !== WebSocket.OPEN
        || partyForPlayer(parties, client.playerId) === null
      ) continue
      client.socket.send(encodeGameMessage({
        type: 'server-party-state',
        state: projectPartyState(
          parties,
          client.playerId,
          profiles,
          hubPlayerIds,
          roster,
        ),
      }))
    }
  }

  function activePartySystem(): PartySystemState | null {
    return sharedWorlds?.parties ?? privateParties
  }

  function replacePartySystem(parties: PartySystemState): void {
    if (sharedWorlds) {
      sharedWorlds = { ...sharedWorlds, parties }
      state = sharedWorlds.hub
    } else if (privateParties) {
      privateParties = parties
    }
    broadcastPartyState()
  }

  function createPartyIdentity(): PartyIdentity {
    return {
      id: `party-${randomBytes(18).toString('base64url')}`,
      joinCode: createPartyJoinCode(),
      listingId: `listing-${randomBytes(18).toString('base64url')}`,
    }
  }

  function createPartyJoinCode(): string {
    const bytes = randomBytes(8)
    let code = ''
    for (let index = 0; index < 8; index += 1) {
      code += PARTY_JOIN_CODE_ALPHABET[bytes[index]! % PARTY_JOIN_CODE_ALPHABET.length]
    }
    return `${code.slice(0, 4)}-${code.slice(4)}`
  }

  function createPlayerReference(): string {
    return `player-ref-${randomBytes(24).toString('base64url')}`
  }

  function armPartyRejoinSlotsForState(
    partyId: string | null,
    activeState: GameSimulationState,
  ): void {
    if (
      partyId === null
      || activeState.world.kind !== 'boneyard'
      || activeState.world.tutorial !== null
      || activeState.run.phase !== 'active'
      || activeState.run.runId === null
    ) return
    const party = activePartySystem()?.parties.find(candidate => candidate.id === partyId)
    if (!party) return
    const memberIds = new Set(activeState.playerEntities.identities.map(({ playerId }) => playerId))
    let lineage = [...partyRecoveryLineages.values()].find(candidate => (
      candidate.partyId === partyId && candidate.runId === activeState.run.runId
    ))
    if (!lineage) {
      const content = [...clients.values()].find(client => memberIds.has(client.playerId))?.content
      if (!content) return
      lineage = {
        content,
        partyLeaderPlayerId: party.leaderPlayerId,
        partyId,
        partyMemberCount: party.memberPlayerIds.length,
        partyRoster: recoveryRosterForParty(partyId),
        partyVisibility: party.visibility,
        recoveryId: randomBytes(32).toString('base64url'),
        runId: activeState.run.runId,
      }
      partyRecoveryLineages.set(lineage.recoveryId, lineage)
    }
    for (const client of clients.values()) {
      if (!memberIds.has(client.playerId) || client.content === null) continue
      const key = partyRecoverySlotKey(lineage.recoveryId, client.playerId)
      const previous = partyRejoinSlots.get(key)
      if (previous) {
        previous.connected = true
        previous.detachedState = null
        previous.reservation = null
        continue
      }
      partyRejoinSlots.set(key, {
        connected: true,
        content: client.content,
        developerAccess: client.developerAccess,
        detachedState: null,
        globalScoreEligible: client.globalScoreEligible,
        leaderboardUserId: client.leaderboardUserId,
        localOnly: client.localOnly,
        partyId,
        partyIdentity: null,
        playerId: client.playerId,
        profile: client.profile,
        recoveryId: lineage.recoveryId,
        reservation: null,
        runId: activeState.run.runId,
        token: null,
      })
    }
  }

  function registerPartyRecoveryLineage(
    claim: PartyRecoveryClaim,
    partyId: string,
    content: MaterializedWebSessionContent,
  ): void {
    partyRecoveryLineages.set(claim.recoveryId, {
      content,
      partyLeaderPlayerId: claim.partyLeaderPlayerId,
      partyId,
      partyMemberCount: claim.partyMemberCount,
      partyRoster: claim.partyRoster,
      partyVisibility: claim.partyVisibility,
      recoveryId: claim.recoveryId,
      runId: claim.runId,
    })
  }

  function detachPartyRejoinClient(
    client: HostClient,
    activeState: GameSimulationState,
    partyId: string | null,
  ): boolean {
    const staged = client.partyRejoinSlot
    if (staged) {
      staged.connected = false
      staged.reservation = null
      return activeRunForPartyRejoin(staged) !== null
    }
    const lineage = [...partyRecoveryLineages.values()].find(candidate => (
      candidate.partyId === partyId && candidate.runId === activeState.run.runId
    ))
    const slot = lineage
      ? partyRejoinSlots.get(partyRecoverySlotKey(lineage.recoveryId, client.playerId))
      : null
    if (
      !slot
      || partyId === null
      || slot.partyId !== partyId
      || activeState.world.kind !== 'boneyard'
      || activeState.run.phase !== 'active'
      || activeState.run.runId !== slot.runId
    ) {
      return false
    }
    slot.connected = false
    slot.detachedState = detachGameSimulationPlayer(activeState, client.playerId)
    slot.reservation = null
    return true
  }

  function synchronizePartyRejoinMilestones(
    partyId: string | null,
    activeState: GameSimulationState,
  ): GameSimulationState {
    if (
      partyId === null
      || activeState.run.phase !== 'active'
      || activeState.run.runId === null
    ) return activeState
    const sourcePlayerId = activeState.playerEntities.identities[0]?.playerId
    if (!sourcePlayerId) return activeState
    const milestoneProgression = getPlayerProgression(activeState, sourcePlayerId)
    let synchronizedState = activeState
    const slots = [...partyRejoinSlots.values()].filter(slot => (
      slot.partyId === partyId
      && slot.runId === activeState.run.runId
      && slot.detachedState !== null
    )).sort((first, second) => first.playerId.localeCompare(second.playerId))
    for (const slot of slots) {
      const detachedProgression = slot.detachedState!.playerEntities.progressions[0]!
      if (milestoneProgression.level <= detachedProgression.level) continue
      const synchronized = synchronizeDetachedGameSimulationPlayer(
        synchronizedState,
        slot.detachedState!,
        {
          crossedLevels: Object.freeze(Array.from(
            { length: milestoneProgression.level - detachedProgression.level },
            (_, index) => detachedProgression.level + index + 1,
          )),
          experience: milestoneProgression.experience,
          level: milestoneProgression.level,
        },
      )
      synchronizedState = synchronized.state
      slot.detachedState = synchronized.detached
    }
    return synchronizedState
  }

  function partyRejoinTarget(token: string): GameHostPartyRejoinTarget | null {
    prunePartyRejoinSlots()
    const claim = decodePartyRecoveryClaim(partyRecoverySecret, token)
    if (!claim) return null
    const lineage = activePartyRecoveryLineage(claim)
    if (!lineage) return null
    const slot = partyRejoinSlots.get(partyRecoverySlotKey(claim.recoveryId, claim.playerId))
    const staged = slot && [...clients.values()].some(client => client.partyRejoinSlot === slot)
    const connected = sharedGameStateForRecoveryPlayer(claim.playerId, lineage) !== null
    return {
      content: lineage.content,
      developerAccess: slot?.developerAccess ?? false,
      globalScoreEligible: slot?.globalScoreEligible ?? claim.globalScoreEligible,
      leaderboardUserId: slot?.leaderboardUserId ?? claim.leaderboardUserId,
      localOnly: slot?.localOnly ?? claim.integrity === 'local-only',
      partyId: lineage.partyId,
      playerId: claim.playerId,
      profile: slot?.profile ?? {
        accountUsername: null,
        highestWave: null,
        totalPlaytimeMs: null,
      },
      runId: lineage.runId,
      status: staged
        ? 'staging'
        : connected || slot?.connected
          ? 'connected'
          : slot?.reservation === null || slot === undefined ? 'detached' : 'reserved',
    }
  }

  function reservePartyRejoin(
    token: string,
    reservationId: string,
    expiresAt: number,
  ): GameHostPartyRejoinRejection | null {
    prunePartyRejoinSlots()
    const claim = decodePartyRecoveryClaim(partyRecoverySecret, token)
    if (!claim) return 'run-unavailable'
    const lineage = activePartyRecoveryLineage(claim)
    if (!lineage) return 'run-unavailable'
    const key = partyRecoverySlotKey(claim.recoveryId, claim.playerId)
    let slot = partyRejoinSlots.get(key)
    if (sharedGameStateForRecoveryPlayer(claim.playerId, lineage) !== null || slot?.connected) {
      return 'player-connected'
    }
    if (!slot) {
      slot = {
        connected: false,
        content: lineage.content,
        developerAccess: false,
        detachedState: null,
        globalScoreEligible: claim.globalScoreEligible,
        leaderboardUserId: claim.leaderboardUserId,
        localOnly: claim.integrity === 'local-only',
        partyId: lineage.partyId,
        partyIdentity: null,
        playerId: claim.playerId,
        profile: {
          accountUsername: null,
          highestWave: null,
          totalPlaytimeMs: null,
        },
        recoveryId: claim.recoveryId,
        reservation: null,
        runId: claim.runId,
        token,
      }
      partyRejoinSlots.set(key, slot)
    }
    if (!slot) return 'run-unavailable'
    const reservedSlot = slot
    if (reservedSlot.reservation !== null) return 'already-reserved'
    reservedSlot.token = token
    reservedSlot.reservation = { expiresAt, id: reservationId }
    return null
  }

  function validPartyRejoinReservation(
    token: string,
    reservationId: string | null,
  ): PartyRejoinSlot | null {
    prunePartyRejoinSlots()
    if (reservationId === null) return null
    const claim = decodePartyRecoveryClaim(partyRecoverySecret, token)
    if (!claim) return null
    const slot = partyRejoinSlots.get(partyRecoverySlotKey(claim.recoveryId, claim.playerId))
    return slot?.reservation?.id === reservationId
      && slot.reservation.expiresAt > performance.now()
      && !slot.connected
      && activeRunForPartyRejoin(slot) !== null
      ? slot
      : null
  }

  function consumePartyRejoinSlot(slot: PartyRejoinSlot): void {
    slot.connected = true
    slot.detachedState = null
    slot.reservation = null
  }

  function cancelPartyRejoinReservation(reservationId: string): void {
    for (const slot of partyRejoinSlots.values()) {
      if (slot.reservation?.id === reservationId) slot.reservation = null
    }
  }

  function activeRunForPartyRejoin(slot: PartyRejoinSlot): GameSimulationState | null {
    if (sharedWorlds) {
      return sharedWorlds.runs.find(run => (
        run.partyId === slot.partyId
        && run.loadedBoneyard.runId === slot.runId
        && run.state.run.phase === 'active'
      ))?.state ?? null
    }
    return state.world.kind === 'boneyard'
      && state.run.phase === 'active'
      && state.run.runId === slot.runId
      ? state
      : null
  }

  function activePartyRecoveryLineage(
    claim: PartyRecoveryClaim,
  ): PartyRecoveryLineage | null {
    const lineage = partyRecoveryLineages.get(claim.recoveryId)
    if (
      !lineage
      || lineage.runId !== claim.runId
      || lineage.partyMemberCount !== claim.partyMemberCount
      || lineage.partyLeaderPlayerId !== claim.partyLeaderPlayerId
      || lineage.partyVisibility !== claim.partyVisibility
      || !sameRecoveryRosterMembership(lineage.partyRoster, claim.partyRoster)
      || lineage.content.manifest.manifestSha256 !== claim.contentManifestSha256
      || sessionKind !== claim.sessionKind
    ) return null
    const probe = partyRejoinSlots.get(partyRecoverySlotKey(claim.recoveryId, claim.playerId))
    const active = probe
      ? activeRunForPartyRejoin(probe)
      : sharedWorlds
        ? sharedWorlds.runs.find(run => (
            run.partyId === lineage.partyId
            && run.loadedBoneyard.runId === lineage.runId
            && run.state.run.phase === 'active'
          ))?.state ?? null
        : state.world.kind === 'boneyard'
          && state.run.phase === 'active'
          && state.run.runId === lineage.runId
          ? state
          : null
    return active ? lineage : null
  }

  function sharedGameStateForRecoveryPlayer(
    playerId: PlayerId,
    lineage: PartyRecoveryLineage,
  ): GameSimulationState | null {
    const active = sharedWorlds
      ? sharedGameStateForPlayer(sharedWorlds, playerId)
      : state.playerEntities.identities.some(({ playerId: id }) => id === playerId) ? state : null
    return active?.run.runId === lineage.runId ? active : null
  }

  function retireEmptyPrivateCollegeRun(): string | null {
    if (
      sessionKind !== 'private-college'
      || state.world.kind !== 'boneyard'
      || state.playerEntities.identities.length !== 0
    ) return null
    const runId = state.world.runId
    state = returnGameSimulationToHub(state)
    loadedBoneyard = null
    privateModHost?.close()
    privateModHost = null
    pendingLuaEvents.length = 0
    return runId
  }

  function recordEmptyRunRetirement(runId: string, partyId: string | null): void {
    const details = { partyId, runId }
    logGameServerEvent(
      options.log,
      'game-host',
      'info',
      'run.retired_empty',
      'An active Boneyard retired after its final authoritative actor left.',
      logDetails(details),
    )
  }

  function prunePartyRejoinSlots(now = performance.now()): void {
    for (const [recoveryId, lineage] of [...partyRecoveryLineages]) {
      const claimProbe: PartyRecoveryClaim = {
        contentManifestSha256: lineage.content.manifest.manifestSha256,
        globalScoreEligible: false,
        integrity: sessionKind === 'global-hub' ? 'global-clean' : 'local-only',
        leaderboardUserId: null,
        partyLeaderPlayerId: lineage.partyLeaderPlayerId,
        partyMemberCount: lineage.partyMemberCount,
        partyRoster: lineage.partyRoster,
        partyVisibility: lineage.partyVisibility,
        playerId: '__probe__',
        recoveryId,
        runId: lineage.runId,
        sessionKind,
        targetRevision: null,
      }
      if (activePartyRecoveryLineage(claimProbe)) continue
      retirePartyRecoveryLineage(lineage, 'terminal')
    }
    for (const [key, slot] of [...partyRejoinSlots]) {
      if (activeRunForPartyRejoin(slot) === null) {
        partyRejoinSlots.delete(key)
        continue
      }
      if (slot.reservation !== null && slot.reservation.expiresAt <= now) {
        slot.reservation = null
      }
    }
  }

  function retirePartyRecoveryLineagesForRun(
    runId: string,
    disposition: 'suspended' | 'terminal',
  ): void {
    for (const lineage of [...partyRecoveryLineages.values()]) {
      if (lineage.runId === runId) retirePartyRecoveryLineage(lineage, disposition)
    }
  }

  function retirePartyRecoveryLineage(
    lineage: PartyRecoveryLineage,
    disposition: 'suspended' | 'terminal',
  ): void {
    retireDisconnectedRecoveryMembers(lineage)
    partyRecoveryLineages.delete(lineage.recoveryId)
    for (const [key, slot] of [...partyRejoinSlots]) {
      if (slot.recoveryId === lineage.recoveryId) partyRejoinSlots.delete(key)
    }
    options.onPartyRecoveryEnded?.(lineage.recoveryId, disposition)
  }

  function retireDisconnectedRecoveryMembers(lineage: PartyRecoveryLineage): void {
    let parties = activePartySystem()
    if (!parties) return
    const connected = new Set([
      ...[...clients.values()].flatMap(client => (
        client.partyRejoinSlot === null ? [client.playerId] : []
      )),
      ...bots.keys(),
    ])
    for (const member of lineage.partyRoster) {
      if (!connected.has(member.playerId)) {
        parties = removePrivatePartyPlayer(parties, member.playerId)
      }
    }
    if (sharedWorlds) {
      sharedWorlds = { ...sharedWorlds, parties }
      state = sharedWorlds.hub
    } else if (privateParties) {
      privateParties = parties
    }
  }

  function detachedPartyRejoinCount(): number {
    prunePartyRejoinSlots()
    const detached = new Set<string>()
    const connected = new Set([
      ...[...clients.values()].map(client => client.playerId),
      ...bots.keys(),
    ])
    for (const lineage of partyRecoveryLineages.values()) {
      for (const member of lineage.partyRoster) {
        if (!connected.has(member.playerId)) detached.add(member.playerId)
      }
    }
    for (const slot of partyRejoinSlots.values()) {
      if (!connected.has(slot.playerId)) detached.add(slot.playerId)
    }
    return detached.size
  }

  function partyRecoverySlotKey(recoveryId: string, playerId: PlayerId): string {
    return `${recoveryId}\0${playerId}`
  }

  function partyTarget(partyId: string): GameHostPartyTarget | null {
    prunePartyAccess()
    const parties = activePartySystem()
    const party = parties?.parties.find(candidate => candidate.id === partyId)
    if (!party) return null
    const leader = [...clients.values()].find(client => client.playerId === party.leaderPlayerId)
    if (!leader) return null
    const partyContent = sharedWorlds
      ? playerContents.get(party.leaderPlayerId)?.summary
      : contentSummary
    if (!partyContent) return null
    const playing = sharedWorlds
      ? sharedWorlds.runs.some(run => run.partyId === party.id)
      : state.world.kind === 'boneyard'
    return {
      cheatsEnabled: sessionKind === 'private-college' && privateCollegeCheatsEnabled,
      content: partyContent,
      id: party.id,
      leader: leader.displayName,
      memberCount: party.memberPlayerIds.length,
      status: playing ? 'playing' : 'hub',
      visibility: party.visibility,
    }
  }

  function observationTargets(): readonly GameHostObservationTarget[] {
    if (sharedWorlds) {
      return sharedWorlds.runs.flatMap((run) => {
        if (run.state.world.kind !== 'boneyard') return []
        const party = sharedWorlds!.parties.parties.find(candidate => (
          candidate.id === run.partyId
        ))
        if (!party) return []
        return [observationTarget(
          run.state,
          run.loadedBoneyard,
          party.leaderPlayerId,
          party.visibility,
        )]
      })
    }
    if (state.world.kind !== 'boneyard' || loadedBoneyard === null) return []
    const party = privateParties?.parties[0] ?? null
    const leaderPlayerId = party?.leaderPlayerId ?? hostPlayerId
    if (!leaderPlayerId) return []
    return [observationTarget(
      state,
      loadedBoneyard,
      leaderPlayerId,
      party?.visibility ?? 'private',
    )]
  }

  function publicParties(): readonly PublicPartyDirectoryEntry[] {
    const parties = activePartySystem()
    if (!parties) return []
    const runs = sharedWorlds
      ? sharedWorlds.runs.map(run => ({
          boneyardName: run.loadedBoneyard.choice.name,
          partyId: run.partyId,
        }))
      : state.world.kind === 'boneyard' && loadedBoneyard && privateParties?.parties[0]
        ? [{
            boneyardName: loadedBoneyard.choice.name,
            partyId: privateParties.parties[0].id,
          }]
        : []
    return projectPublicPartyDirectory({
      memberships: parties.parties,
      runs,
    }, new Map(
      [...clients.values(), ...bots.values()].map(
        ({ displayName, playerId }) => [playerId, displayName],
      ),
    ), maxPlayers, {
      cheatsEnabled: sessionKind === 'private-college' && privateCollegeCheatsEnabled,
      modCount: sessionKind === 'private-college' ? contentSummary.mods.length : 0,
      sessionKind: sessionKind === 'private-college' ? 'private-college' : 'global-hub',
    })
  }

  function observationWorld(runId: string): ObservationWorld | null {
    if (sharedWorlds) {
      const run = sharedWorlds.runs.find(candidate => candidate.loadedBoneyard.runId === runId)
      if (!run || run.state.world.kind !== 'boneyard') return null
      const party = sharedWorlds.parties.parties.find(candidate => candidate.id === run.partyId)
      const playerIds = run.state.playerEntities.identities.map(identity => identity.playerId)
      const viewPlayerId = party && playerIds.includes(party.leaderPlayerId)
        ? party.leaderPlayerId
        : playerIds[0]
      if (!viewPlayerId) return null
      return {
        authorityPlayerId: party?.leaderPlayerId ?? viewPlayerId,
        loadedBoneyard: run.loadedBoneyard,
        state: run.state,
        viewPlayerId,
      }
    }
    if (
      state.world.kind !== 'boneyard'
      || loadedBoneyard?.runId !== runId
    ) return null
    const playerIds = state.playerEntities.identities.map(identity => identity.playerId)
    const viewPlayerId = hostPlayerId && playerIds.includes(hostPlayerId)
      ? hostPlayerId
      : playerIds[0]
    if (!viewPlayerId) return null
    return {
      authorityPlayerId: hostPlayerId ?? viewPlayerId,
      loadedBoneyard,
      state,
      viewPlayerId,
    }
  }

  function observationTarget(
    activeState: GameSimulationState,
    loaded: LoadedBoneyard,
    leaderPlayerId: string,
    visibility: GameHostObservationTarget['visibility'],
  ): GameHostObservationTarget {
    const playerIds = activeState.playerEntities.identities.map(identity => identity.playerId)
    const displayName = (playerId: string) => (
      [...clients.values(), ...bots.values()].find(candidate => candidate.playerId === playerId)
        ?.displayName
      ?? [...partyRecoveryLineages.values()]
        .flatMap(lineage => lineage.partyRoster)
        .find(member => member.playerId === playerId)?.displayName
      ?? (playerIds.includes(playerId)
        ? getPlayerCharacter(activeState, playerId).config.displayName
        : playerId)
    )
    return {
      boneyardName: loaded.choice.name,
      partyLeader: displayName(leaderPlayerId),
      playerCount: playerIds.length,
      players: playerIds.map(displayName),
      runId: loaded.runId,
      visibility,
      waveNumber: activeState.world.kind === 'boneyard'
        ? activeState.world.waves?.waveOrdinal ?? 0
        : 0,
    }
  }

  function targetByCode(joinCode: string): GameHostPartyTarget | null {
    const party = activePartySystem() && partyByJoinCode(activePartySystem()!, joinCode)
    return party ? partyTarget(party.id) : null
  }

  function targetByListingId(listingId: string): GameHostPartyTarget | null {
    const parties = activePartySystem()
    const party = parties && partyByListingId(parties, listingId)
    return party && party.visibility !== 'private' ? partyTarget(party.id) : null
  }

  function createExternalPartyJoinRequest(
    input: GameHostPartyJoinRequestInput,
  ): GameHostPartyJoinRequestResult {
    prunePartyAccess()
    const parties = activePartySystem()
    const party = parties && partyByListingId(parties, input.listingId)
    if (!parties || !party) return { accepted: false, reason: 'party-missing' }
    if (party.visibility !== 'invite-only') {
      return { accepted: false, reason: 'party-private' }
    }
    const result = requestPartyJoin(parties, party.id, {
      id: input.id,
      requester: input.requester,
    }, availablePartyMembers(party.id, null))
    if (!result.accepted) {
      return { accepted: false, reason: protocolPartyRejection(result.reason) }
    }
    externalPartyJoinRequests.set(input.token, {
      expiresAt: input.expiresAt,
      id: input.id,
      partyId: party.id,
      requester: input.requester,
      status: 'pending',
      token: input.token,
    })
    replacePartySystem(result.state)
    logPartyActivity(
      'party.join_requested',
      'Someone requested to join a party.',
      party.id,
      {
        requestId: input.id,
        requester: input.requester,
      },
    )
    return { accepted: true }
  }

  function reserveExternalPartyJoin(
    partyId: string,
    reservationId: string,
    expiresAt: number,
  ): ProtocolPartyActionRejection | null {
    prunePartyAccess()
    const target = partyTarget(partyId)
    if (!target) return 'party-missing'
    if (target.status !== 'hub') return 'not-in-hub'
    if (
      target.memberCount
      + reservationsForParty(partyId)
      + detachedPartyRejoinsForParty(partyId, null) >= maxPlayers
    ) return 'party-full'
    partyJoinReservations.set(reservationId, { expiresAt, partyId })
    return null
  }

  function validPartyReservation(partyId: string, reservationId: string | null): boolean {
    prunePartyAccess()
    if (!reservationId) return false
    const reservation = partyJoinReservations.get(reservationId)
    return reservation?.partyId === partyId && reservation.expiresAt > performance.now()
  }

  function availablePartyMembers(
    partyId: string,
    activeReservationId: string | null,
    activeRejoinPlayerId: string | null = null,
  ): number {
    prunePartyAccess()
    const otherReservations = [...partyJoinReservations].filter(([id, reservation]) => (
      id !== activeReservationId && reservation.partyId === partyId
    )).length
    return Math.max(
      1,
      maxPlayers
        - otherReservations
        - detachedPartyRejoinsForParty(partyId, activeRejoinPlayerId),
    )
  }

  function reservationsForParty(partyId: string): number {
    return [...partyJoinReservations.values()].filter(reservation => (
      reservation.partyId === partyId
    )).length
  }

  function detachedPartyRejoinsForParty(
    partyId: string,
    excludedPlayerId: string | null,
  ): number {
    prunePartyRejoinSlots()
    const connected = new Set([
      ...[...clients.values()].map(client => client.playerId),
      ...bots.keys(),
    ])
    const detached = new Set<string>()
    for (const slot of partyRejoinSlots.values()) {
      if (
        slot.partyId === partyId
        && slot.playerId !== excludedPlayerId
        && !connected.has(slot.playerId)
      ) detached.add(slot.playerId)
    }
    const lineage = [...partyRecoveryLineages.values()].find(candidate => (
      candidate.partyId === partyId
    ))
    if (lineage) {
      for (const member of lineage.partyRoster) {
        if (
          member.playerId !== excludedPlayerId
          && !connected.has(member.playerId)
        ) detached.add(member.playerId)
      }
    }
    return detached.size
  }

  function consumePartyReservation(reservationId: string | null): void {
    if (!reservationId) return
    partyJoinReservations.delete(reservationId)
    cancelPartyRejoinReservation(reservationId)
  }

  function prunePartyAccess(now = performance.now()): boolean {
    for (const [reservationId, reservation] of partyJoinReservations) {
      if (reservation.expiresAt <= now) partyJoinReservations.delete(reservationId)
    }
    const parties = activePartySystem()
    if (!parties) return false
    const livePartyIds = new Set(parties.parties.map(({ id }) => id))
    const expiredRequestIds = new Set<string>()
    for (const [token, request] of externalPartyJoinRequests) {
      if (request.expiresAt <= now || !livePartyIds.has(request.partyId)) {
        expiredRequestIds.add(request.id)
        externalPartyJoinRequests.delete(token)
      }
    }
    if (expiredRequestIds.size === 0) return false
    const joinRequests = parties.joinRequests.filter(({ id }) => !expiredRequestIds.has(id))
    if (joinRequests.length === parties.joinRequests.length) return false
    if (sharedWorlds) {
      sharedWorlds = {
        ...sharedWorlds,
        parties: { ...parties, joinRequests, revision: parties.revision + 1 },
      }
      state = sharedWorlds.hub
    } else if (privateParties) {
      privateParties = { ...parties, joinRequests, revision: parties.revision + 1 }
    }
    return true
  }

  function sendPartyAction(
    client: HostClient,
    action: PartyAction,
    result: Readonly<{ accepted: boolean; reason: string | null }>,
  ): void {
    if (client.socket.readyState !== WebSocket.OPEN) return
    client.socket.send(encodeGameMessage({
      type: 'server-party-action',
      action,
      ok: result.accepted,
      reason: result.accepted ? null : protocolPartyRejection(result.reason),
    }))
  }

  function rejectedPartyAction(reason: ProtocolPartyActionRejection) {
    return {
      accepted: false,
      reason,
      state: activePartySystem() ?? createPartySystem(),
    }
  }

  function protocolPartyRejection(reason: string | null): ProtocolPartyActionRejection {
    return (PARTY_ACTION_REJECTIONS as readonly string[]).includes(reason ?? '')
      ? reason as ProtocolPartyActionRejection
      : 'party-missing'
  }

  function partyRejectionMessage(reason: string | null): string {
    return reason === 'party-full'
      ? 'That party is full.'
      : reason === 'not-in-hub'
        ? 'That party is already in a Boneyard.'
        : reason === 'party-private'
          ? 'That party is private.'
          : 'That party is no longer available.'
  }

  function broadcastToPlayerWorld(
    playerId: string,
    message: Parameters<typeof encodeGameMessage>[0],
  ): void {
    const playerState = stateForPlayer(playerId)
    for (const client of clients.values()) {
      if (
        !client.partyRejoinSlot
        &&
        client.socket.readyState === WebSocket.OPEN
        && stateForPlayer(client.playerId) === playerState
      ) client.socket.send(encodeGameMessage(message))
    }
  }

  function localClientByReference(reference: string): HostClient | null {
    return [...clients.values()].find(candidate => (
      !candidate.partyRejoinSlot
      && candidate.socket.readyState === WebSocket.OPEN
      && (
        candidate.playerReference === reference
        || candidate.playerId === reference
      )
    )) ?? null
  }

  function localPlayerCardByReference(reference: string): GamePlayerCardProfile | null {
    const target = localClientByReference(reference)
    return target ? playerCardProfile(target) : null
  }

  function playerCardProfile(client: HostClient): GamePlayerCardProfile | null {
    if (!clients.has(client.socket) || client.partyRejoinSlot) return null
    const activeState = stateForPlayer(client.playerId)
    const player = getPlayerCharacter(activeState, client.playerId)
    return {
      accountUsername: client.profile.accountUsername,
      activity: activeState.world.kind,
      discipline: player.config.discipline,
      displayName: client.displayName,
      element: player.config.element,
      gold: getPlayerEconomy(activeState, client.playerId).gold,
      highestWave: client.profile.highestWave,
      playerReference: client.playerReference,
      sessionKind,
      totalPlaytimeMs: client.profile.totalPlaytimeMs,
    }
  }

  function deliverSocialChat(
    recipient: HostClient,
    message: GameSocialChatDelivery,
  ): void {
    if (
      clients.get(recipient.socket) !== recipient
      || recipient.partyRejoinSlot
      || recipient.socket.readyState !== WebSocket.OPEN
    ) return
    let sequence = socialChatSequences.get(message.deliveryId)
    if (sequence === undefined) {
      sequence = nextChatSequence
      nextChatSequence += 1
      socialChatSequences.set(message.deliveryId, sequence)
      if (socialChatSequences.size > 256) {
        socialChatSequences.delete(socialChatSequences.keys().next().value!)
      }
    }
    recipient.socket.send(encodeGameMessage({
      type: 'server-chat',
      ...(message.activity === undefined ? {} : { activity: message.activity }),
      channel: message.channel,
      ...(message.recipient === undefined ? {} : { recipient: message.recipient }),
      sender: message.sender,
      sequence,
      text: message.text,
    }))
  }

  function chatRecipients(
    sender: HostClient,
    channel: GameChatChannel,
  ): readonly HostClient[] | null {
    const senderState = stateForPlayer(sender.playerId)
    if (channel === 'global') {
      if (
        !sharedWorlds
        || sessionKind !== 'global-hub'
        || !sender.onlinePreferences.globalChat
      ) return null
      return [...clients.values()].filter(client => (
        !client.partyRejoinSlot
        && client.onlinePreferences.globalChat
        && client.socket.readyState === WebSocket.OPEN
      ))
    }
    if (channel === 'boneyard') {
      if (senderState.world.kind !== 'boneyard') return null
      return [...clients.values()].filter(client => (
        !client.partyRejoinSlot
        && client.socket.readyState === WebSocket.OPEN
        && stateForPlayer(client.playerId) === senderState
      ))
    }
    if (senderState.world.kind !== 'hub') return null
    if (!sharedWorlds) {
      return [...clients.values()].filter(client => (
        !client.partyRejoinSlot && stateForPlayer(client.playerId) === senderState
      ))
    }
    const party = partyForPlayer(sharedWorlds.parties, sender.playerId)
    if (!party) return null
    const memberPlayerIds = new Set(party.memberPlayerIds)
    return [...clients.values()].filter(client => (
      !client.partyRejoinSlot
      && client.socket.readyState === WebSocket.OPEN
      && memberPlayerIds.has(client.playerId)
    ))
  }

  function publishPlayerActivity(sender: HostClient, activity: GameChatActivity): void {
    if (sender.socialConnection) {
      sender.socialConnection.publishActivity(activity)
      return
    }
    if (
      !sharedWorlds
      || sessionKind !== 'global-hub'
      || !sender.onlinePreferences.activityMessages
    ) return
    const encoded = encodeGameMessage({
      type: 'server-chat',
      activity,
      channel: 'global',
      sender: {
        displayName: sender.displayName,
        playerId: sender.playerId,
        playerReference: sender.playerReference,
      },
      sequence: nextChatSequence,
      text: gameChatActivityText(activity, sender.displayName),
    })
    nextChatSequence += 1
    for (const recipient of clients.values()) {
      if (
        recipient.playerId === sender.playerId
        || recipient.partyRejoinSlot
        || !recipient.onlinePreferences.activityMessages
        || !recipient.onlinePreferences.globalChat
        || recipient.socket.readyState !== WebSocket.OPEN
      ) continue
      recipient.socket.send(encoded)
    }
  }

  function chatRateRetryAfter(client: HostClient, nowMs: number): number {
    const cutoffMs = nowMs - GAME_CHAT_RATE_WINDOW_MS
    while (client.chatSentAtMs[0] !== undefined && client.chatSentAtMs[0] <= cutoffMs) {
      client.chatSentAtMs.shift()
    }
    if (client.chatSentAtMs.length >= GAME_CHAT_RATE_LIMIT) {
      return Math.max(1, client.chatSentAtMs[0]! + GAME_CHAT_RATE_WINDOW_MS - nowMs)
    }
    client.chatSentAtMs.push(nowMs)
    return 0
  }

  function queueMlBotSummon(
    summonerPlayerId: PlayerId,
    config: Pick<PlayerCharacterConfig, 'discipline' | 'element'>,
  ) {
    if (!sharedWorlds || sessionKind !== 'global-hub') {
      throw new Error('sd.bots.summon requires the shared Hub')
    }
    if (!options.mlBotPolicy) throw new Error('The ML bot policy is unavailable')
    const summoner = [...clients.values()].find(client => client.playerId === summonerPlayerId)
    if (!summoner?.developerAccess) throw new Error('sd.bots.summon requires developer access')
    if (stateForPlayer(summonerPlayerId).world.kind !== 'hub') {
      throw new Error('sd.bots.summon may only be called in the Hub')
    }
    if (participantCount() + pendingBotSummons.length >= maxPlayers) {
      throw new Error('The shared Hub is full')
    }
    const ordinal = nextBotOrdinal
    nextBotOrdinal += 1
    const playerId = `bot-${randomBytes(12).toString('base64url')}`
    const character = Object.freeze({
      ...ML_BOT_CHARACTER,
      ...config,
      displayName: `${ML_BOT_CHARACTER.displayName} ${ordinal}`,
    })
    pendingBotSummons.push({ character, playerId })
    return {
      display_name: character.displayName,
      player_id: playerId,
    }
  }

  function processPendingBotSummons(): void {
    if (!sharedWorlds || !options.mlBotPolicy || pendingBotSummons.length === 0) return
    for (const pending of pendingBotSummons.splice(0)) {
      if (participantCount() >= maxPlayers || bots.has(pending.playerId)) continue
      const queuedIntents: MlBotHostIntent[] = []
      const controller = new MlBotHostController({
        context: () => mlBotContext(pending.playerId),
        dispatch: intent => {
          const bot = bots.get(pending.playerId)
          if (bot && bot.queuedIntents.length < 8) bot.queuedIntents.push(intent)
        },
        fail: error => failedBots.set(pending.playerId, error),
      }, pending.character, options.mlBotPolicy, pending.playerId)
      const bot: HostBot = {
        activeInput: createIdlePlayerCharacterInput(),
        character: pending.character,
        controller,
        displayName: pending.character.displayName,
        decisions: 0,
        kills: 0,
        lastCompletedWaves: 0,
        lastKills: 0,
        lastRunId: null,
        playerId: pending.playerId,
        profile: {
          accountUsername: null,
          highestWave: null,
          totalPlaytimeMs: null,
        },
        potionsUsed: 0,
        queuedIntents,
        skillPicks: 0,
        waveReached: 0,
        wavesCompleted: 0,
      }
      bots.set(bot.playerId, bot)
      sharedWorlds = addSharedHubPlayer(
        sharedWorlds,
        bot.playerId,
        bot.character,
        createPartyIdentity(),
      )
      state = sharedWorlds.hub
      logGameServerEvent(
        options.log,
        'game-host',
        'info',
        'ml_bot.summoned',
        'A developer summoned an ML policy bot in the shared Hub.',
        logDetails({
          botCount: bots.size,
          displayName: bot.displayName,
          playerId: bot.playerId,
        }),
      )
    }
    broadcastPartyState()
    broadcastSnapshot()
  }

  function processPendingBotInvitations(nowMs: number): void {
    if (!sharedWorlds || pendingBotInvitations.length === 0) return
    let changed = false
    for (let index = pendingBotInvitations.length - 1; index >= 0; index -= 1) {
      const pending = pendingBotInvitations[index]!
      if (pending.acceptAtMs > nowMs) continue
      pendingBotInvitations.splice(index, 1)
      if (!bots.has(pending.playerId)) continue
      const invitation = sharedWorlds.parties.invitations.find(
        candidate => candidate.id === pending.invitationId,
      )
      if (!invitation || invitation.invitedPlayerId !== pending.playerId) continue
      const sourcePartyId = partyForPlayer(sharedWorlds.parties, pending.playerId)?.id ?? null
      const result = acceptSharedPartyInvitation(
        sharedWorlds,
        pending.playerId,
        pending.invitationId,
        maxPlayers,
      )
      if (!result.accepted) continue
      if (sourcePartyId) closePartyModRuntimes(sourcePartyId)
      closePartyModRuntimes(invitation.partyId)
      sharedWorlds = result.state
      state = sharedWorlds.hub
      changed = true
      logGameServerEvent(
        options.log,
        'game-host',
        'info',
        'ml_bot.party_invitation_accepted',
        'An ML policy bot accepted a party invitation after the developer delay.',
        logDetails({ invitationId: invitation.id, playerId: pending.playerId }),
      )
    }
    if (changed) {
      broadcastPartyState()
      broadcastSnapshot()
    }
  }

  function stepBotControllers(): void {
    for (const bot of bots.values()) {
      try {
        const active = sharedWorlds
          ? sharedGameStateForPlayer(sharedWorlds, bot.playerId)
          : null
        if (!active || active.world.kind === 'hub' || active.run.phase !== 'active') {
          bot.activeInput = createIdlePlayerCharacterInput()
        }
        bot.controller.tick()
      } catch (error) {
        failedBots.set(
          bot.playerId,
          error instanceof Error ? error : new Error(String(error)),
        )
      }
    }
  }

  function drainBotIntents(): void {
    if (!sharedWorlds) return
    let lifecycleChanged = false
    for (const bot of bots.values()) {
      for (const intent of bot.queuedIntents.splice(0)) {
        const active = sharedGameStateForPlayer(sharedWorlds, bot.playerId)
        if (!active) continue
        if (intent.kind === 'input' || intent.kind === 'scripted-input') {
          if (intent.kind === 'input') bot.decisions += 1
          bot.activeInput = active.world.kind === 'boneyard' && active.run.phase === 'active'
            ? intent.input
            : createIdlePlayerCharacterInput()
          continue
        }
        bot.activeInput = createIdlePlayerCharacterInput()
        if (intent.kind === 'hub-action') {
          const applied = applyGameSimulationHubAction(active, bot.playerId, intent.action)
          bot.decisions += 1
          if (applied.accepted) {
            bot.potionsUsed += 1
            replaceStateForPlayer(bot.playerId, applied.state)
          }
          continue
        }
        if (intent.kind === 'select-skill') {
          const barrierBefore = active.levelUpBarrier
          const selected = selectGameSimulationPlayerSkill(active, bot.playerId, intent)
          if (selected) {
            bot.skillPicks += 1
            replaceStateForPlayer(bot.playerId, selected)
            if (barrierBefore !== null && selected.levelUpBarrier === null) {
              stopWorldClientInputs(bot.playerId)
              beginMultiplayerResumeGrace(bot.playerId, 'skill-picker-closed')
            }
            lifecycleChanged = true
          }
          continue
        }
        const confirmed = confirmSharedPartyLoadout(
          sharedWorlds,
          bot.playerId,
          intent.character,
        )
        if (confirmed.accepted) {
          sharedWorlds = confirmed.state
          state = sharedWorlds.hub
          lifecycleChanged = true
        }
      }
    }
    if (lifecycleChanged) {
      broadcastPartyState()
      broadcastSnapshot()
    }
  }

  function mlBotContext(playerId: PlayerId) {
    if (!sharedWorlds || !bots.has(playerId)) return null
    const activeState = sharedGameStateForPlayer(sharedWorlds, playerId)
    if (!activeState) return null
    const humanPlayers = [...clients.values()].filter(client => (
      sharedGameStateForPlayer(sharedWorlds!, client.playerId) === activeState
    ))
    const botPlayers = [...bots.values()].filter(bot => (
      sharedGameStateForPlayer(sharedWorlds!, bot.playerId) === activeState
    ))
    return {
      activeInputs: Object.fromEntries([
        ...humanPlayers.map(client => [client.playerId, client.activeInput] as const),
        ...botPlayers.map(bot => [bot.playerId, bot.activeInput] as const),
      ]),
      controllers: Object.fromEntries([
        ...humanPlayers.map(client => [client.playerId, 'human'] as const),
        ...botPlayers.map(bot => [bot.playerId, 'bot'] as const),
      ]),
      state: activeState,
    }
  }

  function processFailedBots(): void {
    for (const [playerId, error] of failedBots) {
      failedBots.delete(playerId)
      logGameServerEvent(
        options.log,
        'game-host',
        'error',
        'ml_bot.controller_failed',
        'An ML policy bot controller failed and was removed.',
        logDetails({ playerId, ...gameServerErrorDetails(error) }),
      )
      removeBot(playerId)
    }
  }

  function removeBot(playerId: PlayerId, broadcastChanges = true): void {
    const bot = bots.get(playerId)
    if (!bot) return
    bots.delete(playerId)
    failedBots.delete(playerId)
    for (let index = pendingBotInvitations.length - 1; index >= 0; index -= 1) {
      if (pendingBotInvitations[index]!.playerId === playerId) {
        pendingBotInvitations.splice(index, 1)
      }
    }
    if (sharedWorlds) {
      const partyId = partyForPlayer(sharedWorlds.parties, playerId)?.id ?? null
      sharedWorlds = removeSharedGamePlayer(sharedWorlds, playerId)
      state = sharedWorlds.hub
      if (partyId && !sharedWorlds.parties.parties.some(party => party.id === partyId)) {
        closePartyModRuntimes(partyId)
      }
    }
    if (broadcastChanges) {
      broadcastPartyState()
      broadcastSnapshot()
    }
  }

  function removeAllBots(reason: string): void {
    if (bots.size === 0 && pendingBotSummons.length === 0) return
    pendingBotSummons.length = 0
    pendingBotInvitations.length = 0
    for (const playerId of [...bots.keys()]) removeBot(playerId, false)
    logGameServerEvent(
      options.log,
      'game-host',
      'info',
      'ml_bot.cleared',
      'All ML policy bots were removed.',
      logDetails({ reason }),
    )
    broadcastPartyState()
    broadcastSnapshot()
  }

  function mlBotTelemetry(bot: HostBot): GameHostMlBotTelemetry {
    const active = sharedWorlds
      ? sharedGameStateForPlayer(sharedWorlds, bot.playerId)
      : null
    if (!active) {
      return {
        decisions: bot.decisions,
        gold: 0,
        items: 0,
        kills: bot.kills,
        lifeState: 'absent',
        playerId: bot.playerId,
        potionsUsed: bot.potionsUsed,
        skillPicks: bot.skillPicks,
        tick: 0,
        waveReached: bot.waveReached,
        wavesCompleted: bot.wavesCompleted,
      }
    }
    const economy = getPlayerEconomy(active, bot.playerId)
    const progression = getPlayerProgression(active, bot.playerId)
    const world = active.world.kind === 'boneyard' ? active.world : null
    const waveReached = world?.waves?.waveOrdinal ?? 0
    return {
      decisions: bot.decisions,
      gold: economy.gold,
      items: economy.backpack.reduce((total, item) => total + item.quantity, 0),
      kills: bot.kills,
      lifeState: progression.lifeState,
      playerId: bot.playerId,
      potionsUsed: bot.potionsUsed,
      skillPicks: bot.skillPicks,
      tick: active.tick,
      waveReached: Math.max(bot.waveReached, waveReached),
      wavesCompleted: bot.wavesCompleted,
    }
  }

  function sampleMlBotTelemetry(): void {
    if (!sharedWorlds) return
    for (const bot of bots.values()) {
      const active = sharedGameStateForPlayer(sharedWorlds, bot.playerId)
      if (!active || active.world.kind !== 'boneyard') continue
      if (bot.lastRunId !== active.world.runId) {
        bot.lastCompletedWaves = 0
        bot.lastKills = 0
        bot.lastRunId = active.world.runId
      }
      const kills = active.world.hallOfFameRuns[bot.playerId]?.monstersKilled ?? 0
      bot.kills += Math.max(0, kills - bot.lastKills)
      bot.lastKills = kills
      const waveReached = active.world.waves?.waveOrdinal ?? 0
      const completedWaves = Math.max(
        0,
        waveReached - Number(active.world.waves?.phase !== 'interwave'),
      )
      bot.wavesCompleted += Math.max(0, completedWaves - bot.lastCompletedWaves)
      bot.lastCompletedWaves = completedWaves
      bot.waveReached = Math.max(bot.waveReached, waveReached)
    }
  }

  function participantCount(): number {
    return clients.size + bots.size
  }

  function capacityParticipantCount(): number {
    return participantCount() + detachedPartyRejoinCount()
  }

  function stopAllClientInputs(): void {
    for (const client of clients.values()) {
      client.activeInput = createIdlePlayerCharacterInput()
      client.queuedInputs.clear()
    }
    for (const bot of bots.values()) {
      bot.activeInput = createIdlePlayerCharacterInput()
      bot.queuedIntents.length = 0
    }
  }

  async function restartForDeployment(
    requestedRevision: string,
    timeoutMs = DEFAULT_DEPLOYMENT_SAVE_TIMEOUT_MS,
  ): Promise<GameHostDeploymentRestartResult> {
    const targetRevision = requestedRevision.trim().toLowerCase()
    if (!/^[0-9a-f]{40}$/.test(targetRevision)) {
      throw new Error('deployment target must be a full Git revision')
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error('deployment save timeout must be positive')
    }
    if (closed) throw new Error('game host is closed')
    if (deploymentRestart) throw new Error('game host is already restarting for deployment')

    stopAllClientInputs()
    resetNextTickDeadline()
    const connected = [...clients.values()]
      .filter(client => client.socket.readyState === WebSocket.OPEN)
      .map(client => client.socket)
    let resolveReady!: () => void
    const ready = new Promise<void>((resolve) => { resolveReady = resolve })
    const restart: DeploymentRestartState = {
      acknowledged: new Set(),
      checkpointSequences: new Map(),
      pending: new Set(connected),
      ready,
      resolveReady,
      targetRevision,
    }
    deploymentRestart = restart
    for (const socket of connected) {
      const client = clients.get(socket)
      if (!client) {
        restart.pending.delete(socket)
        continue
      }
      const checkpointSequence = publishSaveCheckpointForClient(
        client,
        'deployment-restart',
        true,
        true,
        targetRevision,
      )
      restart.checkpointSequences.set(socket, checkpointSequence)
      socket.send(encodeGameMessage({
        type: 'server-deployment-restart',
        checkpointSequence,
        targetRevision,
      }))
    }
    if (restart.pending.size === 0) restart.resolveReady()
    logGameServerEvent(
      options.log,
      'game-host',
      'info',
      'deployment.checkpoint_requested',
      'Every connected player was asked to save before the game update.',
      logDetails({ players: connected.length, targetRevision }),
    )

    let timeout: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
      restart.ready,
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, timeoutMs)
        timeout.unref()
      }),
    ])
    if (timeout) clearTimeout(timeout)
    const savedPlayers = restart.acknowledged.size
    const unacknowledgedPlayers = connected.length - savedPlayers
    const socketClosures = connected.map(waitForDeploymentSocketClose)
    for (const socket of connected) {
      if (socket.readyState !== WebSocket.OPEN && socket.readyState !== WebSocket.CONNECTING) {
        continue
      }
      disconnectCauses.set(socket, {
        reason: 'game updating',
        source: 'deployment-restart',
      })
      socket.close(1012, 'game updating')
    }
    await Promise.all(socketClosures)
    if (deploymentRestart === restart) deploymentRestart = null
    resetNextTickDeadline()
    logGameServerEvent(
      options.log,
      'game-host',
      unacknowledgedPlayers === 0 ? 'info' : 'warning',
      'deployment.players_disconnected',
      'Connected players were disconnected for the game update.',
      logDetails({
        players: connected.length,
        savedPlayers,
        targetRevision,
        unacknowledgedPlayers,
      }),
    )
    return {
      players: connected.length,
      savedPlayers,
      unacknowledgedPlayers,
    }
  }

  function waitForDeploymentSocketClose(socket: WebSocket): Promise<void> {
    if (socket.readyState === WebSocket.CLOSED) return Promise.resolve()
    return new Promise((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        clearTimeout(forceClose)
        socket.off('close', finish)
        resolve()
      }
      const forceClose = setTimeout(() => {
        if (socket.readyState !== WebSocket.CLOSED) socket.terminate()
        finish()
      }, 1_000)
      forceClose.unref()
      socket.once('close', finish)
    })
  }

  function stopWorldClientInputs(playerId: string): void {
    if (!sharedWorlds) {
      stopAllClientInputs()
      return
    }
    const playerState = stateForPlayer(playerId)
    for (const client of clients.values()) {
      if (client.partyRejoinSlot) continue
      if (stateForPlayer(client.playerId) !== playerState) continue
      client.activeInput = createIdlePlayerCharacterInput()
      client.queuedInputs.clear()
    }
    for (const bot of bots.values()) {
      if (stateForPlayer(bot.playerId) !== playerState) continue
      bot.activeInput = createIdlePlayerCharacterInput()
      bot.queuedIntents.length = 0
    }
  }

  function stopPartyInputs(partyId: string): void {
    if (!sharedWorlds) return
    const party = sharedWorlds.parties.parties.find(({ id }) => id === partyId)
    if (!party) return
    for (const client of clients.values()) {
      if (!party.memberPlayerIds.includes(client.playerId)) continue
      client.activeInput = createIdlePlayerCharacterInput()
      client.queuedInputs.clear()
    }
    for (const bot of bots.values()) {
      if (!party.memberPlayerIds.includes(bot.playerId)) continue
      bot.activeInput = createIdlePlayerCharacterInput()
      bot.queuedIntents.length = 0
    }
  }

  function resetNextTickDeadline(): void {
    nextTickAt = performance.now() + GAME_FIXED_TICK_SECONDS * 1000
  }

  function armBoneyardRendererReadiness(active: GameSimulationState): void {
    if (active.world.kind !== 'boneyard' || !active.run.runId) return
    const connected = new Set([...clients.values()].flatMap(client => (
      client.partyRejoinSlot ? [] : [client.playerId]
    )))
    const required = new Set(active.playerEntities.identities.flatMap(({ playerId }) => (
      connected.has(playerId) ? [playerId] : []
    )))
    if (required.size === 0) return
    boneyardRendererReadiness.set(active.run.runId, {
      ready: new Set(),
      required,
    })
  }

  function markBoneyardRendererReady(playerId: PlayerId, runId: string): void {
    const readiness = boneyardRendererReadiness.get(runId)
    if (readiness?.required.has(playerId)) readiness.ready.add(playerId)
  }

  function boneyardRenderersReady(runId: string): boolean {
    const readiness = boneyardRendererReadiness.get(runId)
    if (!readiness) return true
    const connected = new Set([...clients.values()].flatMap(client => (
      client.partyRejoinSlot ? [] : [client.playerId]
    )))
    const ready = [...readiness.required].every(playerId => (
      !connected.has(playerId) || readiness.ready.has(playerId)
    ))
    if (ready) boneyardRendererReadiness.delete(runId)
    return ready
  }

  function gameplayPauseForPlayer(playerId: string): GameplayPauseState | null {
    if (!sharedWorlds) return gameplayPause
    const scope = sharedGameplayPauseScope(playerId)
    return scope ? sharedGameplayPauses.get(scope.partyId) ?? null : null
  }

  function sharedGameplayPauseScope(playerId: string): SharedGameplayPauseScope | null {
    if (!sharedWorlds) return null
    const playerState = sharedGameStateForPlayer(sharedWorlds, playerId)
    if (!playerState || playerState.world.kind === 'hub') return null
    const partyId = partyForPlayer(sharedWorlds.parties, playerId)?.id
    return partyId ? { partyId } : null
  }

  function sharedGameplayPauseScopeForParty(partyId: string): SharedGameplayPauseScope | null {
    return sharedWorlds?.runs.some(run => run.partyId === partyId) ? { partyId } : null
  }

  function gameplayResumeGraceForClient(
    client: HostClient,
  ): GameplayResumeGraceState | null {
    return client.partyRejoinSlot
      ? gameplayResumeGraceForPartyRejoin(client.partyRejoinSlot)
      : gameplayResumeGraceForPlayer(client.playerId)
  }

  function gameplayResumeGraceForPartyRejoin(
    slot: PartyRejoinSlot,
  ): GameplayResumeGraceState | null {
    const grace = sharedWorlds
      ? sharedGameplayResumeGraces.get(slot.partyId) ?? null
      : gameplayResumeGrace
    return projectGameplayResumeGrace(grace)
  }

  function gameplayResumeGraceForPlayer(
    playerId: string,
  ): GameplayResumeGraceState | null {
    const scope = sharedWorlds ? sharedGameplayPauseScope(playerId) : null
    const grace = sharedWorlds && scope
      ? sharedGameplayResumeGraces.get(scope.partyId) ?? null
      : sharedWorlds ? null : gameplayResumeGrace
    return projectGameplayResumeGrace(grace)
  }

  function projectGameplayResumeGrace(
    grace: HostGameplayResumeGrace | null,
    now = performance.now(),
  ): GameplayResumeGraceState | null {
    if (!grace) return null
    return {
      reason: grace.reason,
      remainingMs: grace.deadlineMs === null
        ? null
        : Math.min(
            GAMEPLAY_RESUME_GRACE_DURATION_MS,
            Math.max(1, Math.ceil(grace.deadlineMs - now)),
          ),
      sequence: grace.sequence,
    }
  }

  function nextResumeGraceSequence(): number {
    const sequence = nextGameplayResumeGraceSequence
    nextGameplayResumeGraceSequence = sequence === 0x7fff_ffff ? 1 : sequence + 1
    return sequence
  }

  function beginRunLoadingResumeGrace(
    playerId: PlayerId,
    reason: Extract<
      GameplayResumeGraceReason,
      'game-rejoined' | 'game-restarted' | 'game-started' | 'party-rejoin-wait'
    >,
    partyId: string | null,
    announce = true,
    requiredPlayerIds: readonly PlayerId[] = [],
  ): boolean {
    const scope = sharedWorlds
      ? partyId
        ? sharedGameplayPauseScopeForParty(partyId)
        : sharedGameplayPauseScope(playerId)
      : null
    const activeState = sharedWorlds
      ? scope
        ? sharedWorlds.runs.find(run => run.partyId === scope.partyId)?.state ?? null
        : null
      : state
    if (
      !activeState
      || activeState.world.kind !== 'boneyard'
      || activeState.run.phase !== 'active'
    ) return false

    const existing = sharedWorlds
      ? sharedGameplayResumeGraces.get(scope!.partyId) ?? null
      : gameplayResumeGrace
    const pendingExisting = existing?.deadlineMs === null ? existing : null
    const waitingPlayerIds = new Set(pendingExisting?.waitingPlayerIds ?? [])
    for (const connectedPlayerId of connectedMaterializedHumanPlayerIds(activeState)) {
      waitingPlayerIds.add(connectedPlayerId)
    }
    waitingPlayerIds.add(playerId)
    const required = new Set(pendingExisting?.requiredPlayerIds ?? [])
    for (const requiredPlayerId of requiredPlayerIds) {
      required.add(requiredPlayerId)
      waitingPlayerIds.add(requiredPlayerId)
    }
    const grace: HostGameplayResumeGrace = {
      deadlineMs: null,
      readyPlayerIds: new Set(),
      reason: pendingExisting?.reason === 'party-rejoin-wait'
        ? pendingExisting.reason
        : reason,
      requiredPlayerIds: required,
      sequence: nextResumeGraceSequence(),
      waitingPlayerIds,
    }
    setGameplayResumeGrace(scope, grace)
    stopResumeGraceInputs(scope)
    if (!sharedWorlds) resetNextTickDeadline()
    if (announce) broadcastGameplayResumeGrace(playerId, scope)
    return true
  }

  function beginMultiplayerResumeGrace(
    playerId: PlayerId,
    reason: GameplayResumeGraceReason,
  ): boolean {
    const activeState = stateForPlayer(playerId)
    const scope = sharedWorlds ? sharedGameplayPauseScope(playerId) : null
    const existing = gameplayResumeGraceRecord(scope)
    if (existing) {
      maybeStartGameplayResumeGrace(playerId, scope)
      return false
    }
    if (
      activeState.world.kind !== 'boneyard'
      || activeState.run.phase !== 'active'
      || connectedMaterializedHumanCount(activeState) < 2
    ) return false
    const waitsForPickerClose = reason === 'skill-picker-closed'
      && [...clients.values()].some(client => (
        client.playerId === playerId && client.partyRejoinSlot === null
      ))
    const grace: HostGameplayResumeGrace = {
      deadlineMs: waitsForPickerClose
        ? null
        : performance.now() + GAMEPLAY_RESUME_GRACE_DURATION_MS,
      readyPlayerIds: new Set(),
      reason,
      requiredPlayerIds: new Set(),
      sequence: nextResumeGraceSequence(),
      waitingPlayerIds: new Set(waitsForPickerClose ? [playerId] : []),
    }
    setGameplayResumeGrace(scope, grace)
    stopResumeGraceInputs(scope)
    if (!sharedWorlds) resetNextTickDeadline()
    broadcastGameplayResumeGrace(playerId, scope)
    if (!waitsForPickerClose) logGameplayResumeGrace('started', grace, scope)
    return true
  }

  function connectedMaterializedHumanCount(activeState: GameSimulationState): number {
    return connectedMaterializedHumanPlayerIds(activeState).length
  }

  function beginPartyRejoinWaitIfNeeded(
    disconnectedPlayerId: PlayerId,
    activeState: GameSimulationState,
    partyId: string | null,
  ): boolean {
    if (
      partyId === null
      || activeState.world.kind !== 'boneyard'
      || activeState.run.phase !== 'active'
    ) return false
    const disconnectedLifeState = getPlayerProgression(
      activeState,
      disconnectedPlayerId,
    ).lifeState
    const disconnectedWasLiving = disconnectedLifeState === 'alive'
      || disconnectedLifeState === 'lethal-pending'
    const remainingPlayerIds = activeState.playerEntities.identities
      .map(({ playerId }) => playerId)
      .filter(playerId => playerId !== disconnectedPlayerId)
    const remainingPlayerLifeStates = remainingPlayerIds.map(playerId => (
      getPlayerProgression(activeState, playerId).lifeState
    ))
    const hasRemainingLivingActor = remainingPlayerLifeStates.some(lifeState => {
      return lifeState === 'alive' || lifeState === 'lethal-pending'
    })
    const connectedHumanIds = new Set(connectedMaterializedHumanPlayerIds(activeState))
    const hasConnectedRemainingHuman = remainingPlayerIds.some(playerId => (
      connectedHumanIds.has(playerId)
    ))
    return disconnectedWasLiving
      && !hasRemainingLivingActor
      && hasConnectedRemainingHuman
      && beginRunLoadingResumeGrace(
        disconnectedPlayerId,
        'party-rejoin-wait',
        partyId,
        true,
        [disconnectedPlayerId],
      )
  }

  function connectedMaterializedHumanPlayerIds(
    activeState: GameSimulationState,
  ): PlayerId[] {
    if (activeState.world.kind !== 'boneyard') return []
    const materializedPlayerIds = new Set(
      activeState.playerEntities.identities.map(({ playerId }) => playerId),
    )
    return [...clients.values()].flatMap(client => {
      if (client.partyRejoinSlot) return []
      return materializedPlayerIds.has(client.playerId)
        ? [client.playerId]
        : []
    })
  }

  function acknowledgeResumeGraceReady(client: HostClient, sequence: number): void {
    const scope = sharedWorlds
      ? client.partyRejoinSlot
        ? sharedGameplayPauseScopeForParty(client.partyRejoinSlot.partyId)
        : sharedGameplayPauseScope(client.playerId)
      : null
    const grace = gameplayResumeGraceRecord(scope)
    if (
      !grace
      || grace.sequence !== sequence
      || !grace.waitingPlayerIds.has(client.playerId)
    ) return
    grace.readyPlayerIds.add(client.playerId)
    maybeStartGameplayResumeGrace(client.playerId, scope)
  }

  function maybeStartGameplayResumeGrace(
    playerId: PlayerId,
    knownScope?: SharedGameplayPauseScope | null,
  ): boolean {
    const scope = sharedWorlds
      ? knownScope ?? sharedGameplayPauseScope(playerId)
      : null
    const grace = gameplayResumeGraceRecord(scope)
    if (!grace || grace.deadlineMs !== null) return false
    const activeState = sharedWorlds
      ? scope
        ? sharedWorlds.runs.find(run => run.partyId === scope.partyId)?.state ?? null
        : null
      : state
    if (
      !activeState
      || activeState.world.kind !== 'boneyard'
      || activeState.run.phase !== 'active'
      || activeState.levelUpBarrier !== null
      || gameplayPauseRecord(scope) !== null
      || [...grace.waitingPlayerIds].some(waitingPlayerId => (
        !grace.readyPlayerIds.has(waitingPlayerId)
        || !activeState.playerEntities.identities.some(
          identity => identity.playerId === waitingPlayerId,
        )
      ))
    ) return false
    grace.deadlineMs = performance.now() + GAMEPLAY_RESUME_GRACE_DURATION_MS
    stopResumeGraceInputs(scope)
    if (!sharedWorlds) resetNextTickDeadline()
    broadcastGameplayResumeGrace(playerId, scope)
    logGameplayResumeGrace('started', grace, scope)
    return true
  }

  function removeGameplayResumeGraceParticipant(
    playerId: PlayerId,
    knownScope: SharedGameplayPauseScope | null,
  ): void {
    const scope = sharedWorlds ? knownScope : null
    const grace = gameplayResumeGraceRecord(scope)
    if (!grace || grace.deadlineMs !== null) return
    if (grace.requiredPlayerIds.has(playerId)) {
      grace.readyPlayerIds.delete(playerId)
      return
    }
    const removed = grace.waitingPlayerIds.delete(playerId)
    grace.readyPlayerIds.delete(playerId)
    if (!removed) return
    if (grace.waitingPlayerIds.size === 0) {
      setGameplayResumeGrace(scope, null)
      broadcastGameplayResumeGrace(playerId, scope)
      if (!sharedWorlds) resetNextTickDeadline()
      return
    }
    const remainingPlayerId = grace.waitingPlayerIds.values().next().value
    if (remainingPlayerId) maybeStartGameplayResumeGrace(remainingPlayerId, scope)
  }

  function expireGameplayResumeGraces(now: number): void {
    let changed = false
    if (!sharedWorlds) {
      if (gameplayResumeGrace !== null) {
        const deadlineExpired = gameplayResumeGrace.deadlineMs !== null
          && now >= gameplayResumeGrace.deadlineMs
        const retired = state.world.kind !== 'boneyard' || state.run.phase !== 'active'
        if (!deadlineExpired && !retired) return
        const completed = gameplayResumeGrace
        gameplayResumeGrace = null
        stopAllClientInputs()
        resetNextTickDeadline()
        broadcastGameplayResumeGrace()
        if (deadlineExpired && !retired) {
          logGameplayResumeGrace('completed', completed, null)
        }
        changed = deadlineExpired
      }
    } else {
      for (const [partyId, grace] of sharedGameplayResumeGraces) {
        const run = sharedWorlds.runs.find(candidate => candidate.partyId === partyId)
        const expired = grace.deadlineMs !== null && now >= grace.deadlineMs
        const retired = !run
          || run.state.world.kind !== 'boneyard'
          || run.state.run.phase !== 'active'
        if (!expired && !retired) continue
        sharedGameplayResumeGraces.delete(partyId)
        stopPartyInputs(partyId)
        broadcastGameplayResumeGrace(undefined, { partyId })
        if (expired && !retired) {
          logGameplayResumeGrace('completed', grace, { partyId })
          changed = true
        }
      }
    }
    if (changed) broadcastSnapshot()
  }

  function gameplayPauseRecord(
    scope: SharedGameplayPauseScope | null,
  ): GameplayPauseState | null {
    return sharedWorlds
      ? scope
        ? sharedGameplayPauses.get(scope.partyId) ?? null
        : null
      : gameplayPause
  }

  function gameplayResumeGraceRecord(
    scope: SharedGameplayPauseScope | null,
  ): HostGameplayResumeGrace | null {
    return sharedWorlds
      ? scope
        ? sharedGameplayResumeGraces.get(scope.partyId) ?? null
        : null
      : gameplayResumeGrace
  }

  function setGameplayResumeGrace(
    scope: SharedGameplayPauseScope | null,
    grace: HostGameplayResumeGrace | null,
  ): void {
    if (!sharedWorlds) {
      gameplayResumeGrace = grace
      return
    }
    if (!scope) return
    if (grace) sharedGameplayResumeGraces.set(scope.partyId, grace)
    else sharedGameplayResumeGraces.delete(scope.partyId)
  }

  function stopResumeGraceInputs(scope: SharedGameplayPauseScope | null): void {
    if (sharedWorlds && scope) stopPartyInputs(scope.partyId)
    else if (!sharedWorlds) stopAllClientInputs()
  }

  function broadcastGameplayResumeGrace(
    playerId?: string,
    knownScope?: SharedGameplayPauseScope | null,
  ): void {
    if (!sharedWorlds) {
      broadcast({
        type: 'server-gameplay-resume-grace',
        grace: projectGameplayResumeGrace(gameplayResumeGrace),
      })
      return
    }
    const scope = knownScope ?? (playerId ? sharedGameplayPauseScope(playerId) : null)
    if (!scope) return
    const grace = projectGameplayResumeGrace(
      sharedGameplayResumeGraces.get(scope.partyId) ?? null,
    )
    const party = sharedWorlds.parties.parties.find(({ id }) => id === scope.partyId)
    for (const client of clients.values()) {
      if (
        client.socket.readyState === WebSocket.OPEN
        && party?.memberPlayerIds.includes(client.playerId)
      ) client.socket.send(encodeGameMessage({
        type: 'server-gameplay-resume-grace',
        grace,
      }))
    }
  }

  function logGameplayResumeGrace(
    phase: 'completed' | 'started',
    grace: HostGameplayResumeGrace,
    scope: SharedGameplayPauseScope | null,
  ): void {
    logGameServerEvent(
      options.log,
      'game-host',
      'info',
      `gameplay.resume_grace_${phase}`,
      phase === 'started'
        ? 'The authoritative resume grace countdown started.'
        : 'The authoritative resume grace countdown completed.',
      logDetails({
        partyId: scope?.partyId ?? null,
        reason: grace.reason,
        sequence: grace.sequence,
      }),
    )
    if (phase === 'completed') {
      logGameServerEvent(
        options.log,
        'game-host',
        'info',
        'gameplay.resumed',
        'The authoritative gameplay world resumed after its grace countdown.',
        logDetails({
          partyId: scope?.partyId ?? null,
          reason: grace.reason,
          sequence: grace.sequence,
        }),
      )
    }
  }

  function setGameplayPauseForPlayer(
    playerId: string,
    pause: GameplayPauseState,
  ): void {
    if (!sharedWorlds) {
      gameplayPause = pause
      return
    }
    const scope = sharedGameplayPauseScope(playerId)
    if (scope) sharedGameplayPauses.set(scope.partyId, pause)
  }

  function broadcastGameplayPause(
    playerId?: string,
    knownScope?: SharedGameplayPauseScope | null,
  ): void {
    if (!sharedWorlds) {
      broadcast({ type: 'server-gameplay-pause', pause: gameplayPause })
      return
    }
    const scope = knownScope ?? (playerId ? sharedGameplayPauseScope(playerId) : null)
    if (!scope) return
    const pause = sharedGameplayPauses.get(scope.partyId) ?? null
    const party = sharedWorlds.parties.parties.find(({ id }) => id === scope.partyId)
    for (const client of clients.values()) {
      if (
        client.socket.readyState === WebSocket.OPEN
        && party?.memberPlayerIds.includes(client.playerId)
      ) client.socket.send(encodeGameMessage({ type: 'server-gameplay-pause', pause }))
    }
  }

  function releaseGameplayPause(
    source: 'owner-disconnected' | 'owner-resumed',
    playerId?: string,
    knownScope?: SharedGameplayPauseScope | null,
  ): void {
    const scope = sharedWorlds
      ? knownScope ?? (playerId ? sharedGameplayPauseScope(playerId) : null)
      : null
    const released = sharedWorlds
      ? scope
        ? sharedGameplayPauses.get(scope.partyId) ?? null
        : null
      : gameplayPause
    if (!released) return
    if (sharedWorlds && scope) {
      sharedGameplayPauses.delete(scope.partyId)
      stopPartyInputs(scope.partyId)
    } else {
      gameplayPause = null
      stopAllClientInputs()
      resetNextTickDeadline()
    }
    broadcastGameplayPause(playerId, scope)
    if (source === 'owner-resumed') {
      beginMultiplayerResumeGrace(
        released.ownerPlayerId,
        gameplayResumeGraceReasonForPauseSource(released.source),
      )
    } else {
      maybeStartGameplayResumeGrace(released.ownerPlayerId, scope)
    }
    broadcastSnapshot()
    const heldByGrace = gameplayResumeGraceRecord(scope) !== null
    logGameServerEvent(
      options.log,
      'game-host',
      'info',
      heldByGrace ? 'gameplay.pause_released' : 'gameplay.resumed',
      heldByGrace
        ? 'The gameplay pause owner released into authoritative resume grace.'
        : 'The authoritative gameplay world resumed.',
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

  function taintActiveRun(client: HostClient): void {
    if (client.partyRejoinSlot) return
    const activeState = stateForPlayer(client.playerId)
    if (activeState.world.kind === 'boneyard') {
      leaderboardIneligibleRunIds.add(activeState.world.runId)
    }
  }

  function taintIneligibleClientRuns(): void {
    for (const client of clients.values()) {
      if (!client.globalScoreEligible) taintActiveRun(client)
    }
  }

  function publishLeaderboardReceipts(
    previous: GameSimulationState,
    completed: GameSimulationState,
  ): void {
    if (
      !options.leaderboardReceiptSecret
      || previous.world.kind !== 'boneyard'
      || completed.world.kind !== 'boneyard'
      || previous.world.runId !== completed.world.runId
      || leaderboardIneligibleRunIds.has(completed.world.runId)
    ) return
    for (const client of clients.values()) {
      const userId = client.leaderboardUserId
      const previousRun = previous.world.hallOfFameRuns[client.playerId]
      const completedRun = completed.world.hallOfFameRuns[client.playerId]
      if (
        userId === null
        || !client.onlinePreferences.submitRuns
        || !previousRun
        || !completedRun
        || previousRun.elapsedTicks !== null
        || completedRun.elapsedTicks === null
        || client.socket.readyState !== WebSocket.OPEN
      ) continue
      const receiptKey = `${completed.world.runId}\0${client.playerId}`
      if (issuedLeaderboardReceipts.has(receiptKey)) continue
      const entry = completedHallOfFameEntry(
        createGameSnapshot(completed, authorityForPlayer(client.playerId)),
        client.playerId,
        null,
        new Date().toISOString(),
      )
      if (!entry) continue
      const receipt = createGameLeaderboardReceipt(
        options.leaderboardReceiptSecret,
        userId,
        entry,
      )
      issuedLeaderboardReceipts.add(receiptKey)
      client.socket.send(encodeGameMessage({
        type: 'server-leaderboard-receipt',
        receipt,
      }))
    }
  }

  function pruneLeaderboardRunState(): void {
    const activeRunIds = new Set(sharedWorlds
      ? sharedWorlds.runs.map(run => run.state.world.kind === 'boneyard'
        ? run.state.world.runId
        : null).filter((runId): runId is string => runId !== null)
      : state.world.kind === 'boneyard' ? [state.world.runId] : [])
    for (const runId of leaderboardIneligibleRunIds) {
      if (!activeRunIds.has(runId)) leaderboardIneligibleRunIds.delete(runId)
    }
    for (const key of issuedLeaderboardReceipts) {
      if (!activeRunIds.has(key.slice(0, key.indexOf('\0')))) {
        issuedLeaderboardReceipts.delete(key)
      }
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

  function boneyardCatalogForPlayer(playerId: PlayerId): BoneyardCatalog {
    if (!sharedHub) return boneyards
    const playerContent = playerContents.get(playerId)
    return createBoneyardCatalog([
      ...boneyards.modEntries.values(),
      ...(playerContent?.boneyards ?? []),
    ])
  }

  function webLuaBoneyardContentId(
    playerId: PlayerId,
    selected: LoadedBoneyard,
  ): string | null {
    return boneyardCatalogForPlayer(playerId).modEntries
      .get(selected.choice.id)?.webLuaContentId ?? null
  }

  function contentForParty(partyId: string): MaterializedWebSessionContent | null {
    if (!sharedWorlds) return null
    const party = sharedWorlds.parties.parties.find(candidate => candidate.id === partyId)
    if (!party) return null
    const lineage = [...partyRecoveryLineages.values()].find(candidate => (
      candidate.partyId === partyId
    ))
    const leaderContent = lineage?.content ?? playerContents.get(party.leaderPlayerId)
    if (!leaderContent) return null
    return party.memberPlayerIds.every(playerId => {
      if (bots.has(playerId)) return leaderContent.manifest.mods.length === 0
      const memberContent = playerContents.get(playerId)
        ?? [...partyRejoinSlots.values()].find(slot => (
          slot.partyId === partyId && slot.playerId === playerId
        ))?.content
        ?? (lineage?.partyRoster.some(member => member.playerId === playerId)
          ? lineage.content
          : undefined)
      return memberContent !== undefined
        && sameContentMods(memberContent.manifest.mods, leaderContent.manifest.mods)
    }) ? leaderContent : null
  }

  function modRuntimeScopeForPlayer(playerId: PlayerId): PartyModRuntimeScope | null {
    if (!sharedWorlds) return null
    const run = sharedWorlds.runs.find(candidate => (
      candidate.state.playerEntities.identities.some(identity => identity.playerId === playerId)
    ))
    return run ? partyModRuntimes.get(run.partyId) ?? null : null
  }

  function sendPreparedModProjection(
    socket: WebSocket,
    host: PreparedModHost | null,
  ): void {
    if (!host || socket.readyState !== WebSocket.OPEN) return
    socket.send(encodeGameMessage({ type: 'server-mod-content', ...host.project() }))
  }

  function sendPreparedModRuntime(
    socket: WebSocket,
    host: PreparedModHost | null,
    viewerId: PlayerId,
  ): void {
    if (!host || socket.readyState !== WebSocket.OPEN) return
    socket.send(encodeGameMessage({ type: 'server-mod-runtime', ...host.runtimeProjection(viewerId) }))
  }

  function broadcastPreparedModProjection(
    playerId: PlayerId,
    host: PreparedModHost,
  ): void {
    const message = { type: 'server-mod-content' as const, ...host.project() }
    if (sharedWorlds) broadcastToPlayerWorld(playerId, message)
    else broadcast(message)
  }

  async function beginSharedPartyRun(
    leaderPlayerId: PlayerId,
    selected: LoadedBoneyard,
    socket: WebSocket,
  ): Promise<void> {
    if (!sharedWorlds) return
    const party = partyForPlayer(sharedWorlds.parties, leaderPlayerId)
    if (!party || startingPartyIds.has(party.id)) return
    const partyContent = contentForParty(party.id)
    if (!partyContent) {
      disconnect(
        socket,
        'invalid-message',
        'Every party member must enable the same mods before the party can launch.',
      )
      return
    }
    const initialState = sharedPartySaveStateForPlayer(sharedWorlds, leaderPlayerId)
    if (!initialState) return
    startingPartyIds.add(party.id)
    try {
      const scope = await ensurePartyModRuntimes(
        party.id,
        partyContent,
        initialState,
      )
      if (!sharedWorlds || closed || !clients.has(socket)) return
      const latestParty = partyForPlayer(sharedWorlds.parties, leaderPlayerId)
      if (!latestParty || latestParty.id !== party.id || !contentForParty(party.id)) return
      const before = sharedPartySaveStateForPlayer(sharedWorlds, leaderPlayerId)
      const started = startSharedPartyRun(sharedWorlds, leaderPlayerId, selected)
      if (!started.accepted || !before) return
      const departingPlayerIds = new Set(latestParty.memberPlayerIds)
      for (const connected of clients.values()) {
        if (departingPlayerIds.has(connected.playerId)) connected.hubActivity = null
      }
      sharedWorlds = started.state
      state = sharedWorlds.hub
      for (const connected of clients.values()) {
        if (departingPlayerIds.has(connected.playerId)) {
          connected.socialConnection?.refreshCollegeInvitationAvailability()
        }
      }
      const leader = clients.get(socket)
      if (leader && selected.choice.id !== 'stock-tutorial') {
        publishPlayerActivity(leader, 'searching-solomon')
      }
      const run = sharedWorlds.runs.find(candidate => candidate.partyId === party.id)!
      const beganLoadingGrace = beginRunLoadingResumeGrace(
        leaderPlayerId,
        'game-started',
        party.id,
        false,
      )
      scope.runtime.activateBoneyard(webLuaBoneyardContentId(leaderPlayerId, selected))
      if (scope.content.modSources.length > 0) armBoneyardRendererReadiness(run.state)
      armPartyRejoinSlotsForState(party.id, run.state)
      logGameActivity(before, run.state, selected, party.id)
      scope.pendingEvents.push(...deriveWebLuaEvents(
        before,
        run.state,
      ))
      taintIneligibleClientRuns()
      stopWorldClientInputs(leaderPlayerId)
      broadcastToPlayerWorld(leaderPlayerId, {
        type: 'server-mod-catalog',
        items: scope.runtime.content.consumables(),
      })
      broadcastPreparedModProjection(leaderPlayerId, scope.runtime)
      broadcastToPlayerWorld(leaderPlayerId, {
        type: 'server-boneyard-loaded',
        boneyard: selected,
      })
      broadcastPartyState()
      broadcastSnapshot()
      if (beganLoadingGrace) {
        broadcastGameplayResumeGrace(
          leaderPlayerId,
          sharedGameplayPauseScopeForParty(party.id),
        )
      }
      publishSaveCheckpoint('boneyard-entry')
    } catch (error) {
      logGameServerEvent(
        options.log,
        'game-host',
        'error',
        'mods.party_initialization_failed',
        'The party mod set could not initialize.',
        logDetails({ partyId: party.id, ...gameServerErrorDetails(error) }),
      )
      disconnect(
        socket,
        'invalid-message',
        error instanceof Error ? error.message : 'The active mods could not initialize.',
      )
    } finally {
      startingPartyIds.delete(party.id)
    }
  }

  async function ensurePartyModRuntimes(
    partyId: string,
    partyContent: MaterializedWebSessionContent,
    initialState: GameSimulationState,
  ): Promise<PartyModRuntimeScope> {
    const existing = partyModRuntimes.get(partyId)
    if (
      existing
      && sameContentMods(existing.content.manifest.mods, partyContent.manifest.mods)
    ) return existing
    if (existing) closePartyModRuntimes(partyId)
    const initializing = partyModRuntimeInitializations.get(partyId)
    if (initializing) return initializing
    const promise = (async () => {
      if (partyContent.modSources.length > 0 && !options.luaWasmPath) {
        throw new Error('Lua runtime is not configured for this game host.')
      }
      let stagedState = initialState
      let runtime: PreparedModHost | null = null
      try {
        runtime = await prepareModHost({
          content: partyContent,
          log: message => logGameServerEvent(
            options.log,
            'game-host',
            'warning',
            'mods.rule_failed',
            message,
            logDetails({ partyId }),
          ),
          state: {
            read: () => sharedWorlds?.runs.find(candidate => candidate.partyId === partyId)?.state
              ?? stagedState,
            write: candidate => {
              const run = sharedWorlds?.runs.find(entry => entry.partyId === partyId)
              if (!sharedWorlds || !run) {
                stagedState = candidate
                return
              }
              sharedWorlds = {
                ...sharedWorlds,
                runs: sharedWorlds.runs.map(entry => entry.partyId === partyId
                  ? { ...entry, state: candidate }
                  : entry),
              }
            },
          },
          wasmPath: options.luaWasmPath ?? '',
        })
        const activeParty = sharedWorlds?.parties.parties.find(party => party.id === partyId)
        const saved = activeParty?.memberPlayerIds
          .map(playerId => pendingRestoredModState.get(playerId))
          .find((state): state is PreparedModSaveState => state !== undefined)
        if (saved) {
          runtime.restoreSaveState(saved)
          for (const playerId of activeParty!.memberPlayerIds) pendingRestoredModState.delete(playerId)
        }
        const scope: PartyModRuntimeScope = {
          content: partyContent,
          pendingEvents: [],
          runtime,
        }
        partyModRuntimes.set(partyId, scope)
        return scope
      } catch (error) {
        runtime?.close()
        throw error
      } finally {
        partyModRuntimeInitializations.delete(partyId)
      }
    })()
    partyModRuntimeInitializations.set(partyId, promise)
    return promise
  }

  async function initializePrivateModHost(): Promise<void> {
    if (!options.modContent?.modSources.length) return
    if (!options.luaWasmPath) throw new Error('Lua runtime is not configured for this game host.')
    privateModHost = await prepareModHost({
      content: options.modContent,
      log: message => logGameServerEvent(
        options.log,
        'game-host',
        'warning',
        'mods.rule_failed',
        message,
        logDetails(),
      ),
      state: {
        read: () => state,
        write: candidate => { state = candidate },
      },
      wasmPath: options.luaWasmPath,
    })
  }

  function closePartyModRuntimes(partyId: string): void {
    const scope = partyModRuntimes.get(partyId)
    partyModRuntimes.delete(partyId)
    scope?.runtime.close()
    const initialization = partyModRuntimeInitializations.get(partyId)
    partyModRuntimeInitializations.delete(partyId)
    if (initialization) void initialization.then((created) => {
      if (partyModRuntimes.get(partyId) === created) partyModRuntimes.delete(partyId)
      created.runtime.close()
    }, () => {})
  }

  function activePrivateLuaRuntimes(): readonly WebLuaRuntime[] {
    return luaRuntime === null ? [] : [luaRuntime]
  }

  function preparedModSaveState(
    host: PreparedModHost | null,
  ): import('./prepared-mod-save.ts').PreparedModSaveState {
    return host?.saveState() ?? Object.freeze({})
  }

  await initializePrivateModHost()
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
    botCount: () => bots.size,
    botPlayerIds: () => [...bots.keys()],
    botTelemetry: () => [...bots.values()].map(bot => mlBotTelemetry(bot)),
    async close(reason: GameHostCloseReason = 'server-shutdown') {
      if (closed) return
      closed = true
      clearInterval(timer)
      deploymentRestart?.resolveReady()
      clearInterval(partyAccessTimer)
      removeAllBots('game host closed')
      resetLuaRuntime()
      privateModHost?.close()
      privateModHost = null
      boneyardRendererReadiness.clear()
      for (const partyId of [...partyModRuntimes.keys()]) closePartyModRuntimes(partyId)
      const socialOwner = clients.values().next().value as HostClient | undefined
      for (const party of activePartySystem()?.parties ?? []) {
        socialOwner?.socialConnection?.revokeCollegeInvitations(party.id)
      }
      const closeCode = reason === 'host-ended-session'
        ? GAME_HOST_ENDED_SESSION_CLOSE_CODE
        : 1012
      const closeReason = reason === 'host-ended-session'
        ? 'host ended session'
        : 'server shutdown'
      for (const socket of [...pending, ...clients.keys(), ...observers.keys()]) {
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
    hubPlayerCount: () => sharedWorlds?.hub.playerEntities.identities.length
      ?? Number(state.world.kind === 'hub') * clients.size,
    humanPlayerCount: () => clients.size,
    capacityParticipantCount,
    loadedBoneyard: () => loadedBoneyard,
    modCatalog: () => privateModHost?.content.consumables() ?? [],
    observationTargets,
    cancelPartyReservation(reservationId) {
      partyJoinReservations.delete(reservationId)
      cancelPartyRejoinReservation(reservationId)
    },
    createPartyJoinRequest: createExternalPartyJoinRequest,
    partyCount: () => activePartySystem()?.parties.length ?? 0,
    partyRejoinTarget,
    partyJoinRequestStatus(token) {
      prunePartyAccess()
      const request = externalPartyJoinRequests.get(token)
      if (
        request?.status === 'pending'
        && !activePartySystem()?.joinRequests.some(({ id }) => id === request.id)
      ) request.status = 'denied'
      return request ? { partyId: request.partyId, status: request.status } : null
    },
    partyTargetByCode: targetByCode,
    partyTargetByListingId: targetByListingId,
    playerState: playerId => sharedWorlds
      ? sharedGameStateForPlayer(sharedWorlds, playerId)
      : state.playerEntities.identities.some(identity => identity.playerId === playerId)
        ? state
        : null,
    presence: () => projectHostPresence(
      [
        ...[...clients.values()].filter(client => !client.partyRejoinSlot).map(client => ({
          accountUsername: client.profile.accountUsername,
          bot: false,
          developer: client.developerAccess,
          displayName: client.displayName,
          playerId: client.playerId,
        })),
        ...[...bots.values()].map(bot => ({
          accountUsername: bot.profile.accountUsername,
          bot: true,
          developer: false,
          displayName: bot.displayName,
          playerId: bot.playerId,
        })),
      ],
      sharedWorlds
        ? {
            hubPlayerIds: sharedWorlds.hub.playerEntities.identities.map(
              identity => identity.playerId,
            ),
            runs: sharedWorlds.runs.map(run => ({
              boneyardName: run.loadedBoneyard.choice.name,
              playerIds: run.state.playerEntities.identities.map(identity => identity.playerId),
              waveNumber: run.state.world.kind === 'boneyard'
                ? run.state.world.waves?.waveOrdinal ?? 0
                : 0,
            })),
          }
        : state.world.kind === 'boneyard' && loadedBoneyard !== null
          ? {
              hubPlayerIds: [],
              runs: [{
                boneyardName: loadedBoneyard.choice.name,
                playerIds: state.playerEntities.identities.map(identity => identity.playerId),
                waveNumber: state.world.waves?.waveOrdinal ?? 0,
              }],
            }
          : {
              hubPlayerIds: state.playerEntities.identities.map(identity => identity.playerId),
              runs: [],
            },
      activePartySystem()?.parties ?? [],
    ),
    publicParties,
    restartForDeployment,
    reservePartyJoin: reserveExternalPartyJoin,
    reservePartyRejoin,
    state: () => state,
    runCount: () => sharedWorlds?.runs.length ?? Number(state.world.kind === 'boneyard'),
  }

  async function ensureLuaRuntime(playerId: PlayerId): Promise<WebLuaRuntime> {
    if (luaRuntime !== null) {
      if (luaRuntimeOwnerPlayerId !== playerId) {
        throw new Error('Another developer connection owns the active Lua console.')
      }
      return luaRuntime
    }
    if (!options.luaWasmPath) throw new Error('Lua runtime is not configured for this game host.')
    if (luaRuntimeInitialization !== null) {
      if (luaRuntimeOwnerPlayerId !== playerId) {
        throw new Error('Another developer connection is initializing the Lua console.')
      }
      return luaRuntimeInitialization
    }
    const owner = [...clients.values()].find(client => client.playerId === playerId)
    if (!owner) throw new Error('The Lua console owner is no longer connected.')
    luaRuntimeOwnerPlayerId = playerId
    const generation = luaRuntimeGeneration
    let initialization: Promise<WebLuaRuntime>
    initialization = WebLuaRuntime.create({
      bindings: {
        getAuthorityPlayerId: () => {
          const active = [...clients.values()].find(client => client.playerId === playerId)
          if (!active) return null
          return active.developerAccess ? playerId : hostPlayerId
        },
        getFrame: () => createWebLuaFrameState(
          stateForPlayer(playerId),
          playerId,
          loadedBoneyardForPlayer(playerId),
        ),
      },
      ...(owner.developerAccess ? {
        developer: { summonBot: config => queueMlBotSummon(playerId, config) },
      } : {}),
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
      if (luaRuntimeOwnerPlayerId === playerId) luaRuntimeOwnerPlayerId = null
      throw error
    })
    luaRuntimeInitialization = initialization
    return initialization
  }

  function resetLuaRuntime(): void {
    luaRuntimeGeneration += 1
    luaRuntime?.close()
    luaRuntime = null
    luaRuntimeOwnerPlayerId = null
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
  const seed = randomBytes(4).readUInt32LE()
  const state = factory?.() ?? createGameSimulation({}, {
    gameRngSeed: seed,
    hubTraderAnimationSeed: seed,
  })
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

function acknowledgeReplicationSnapshot(
  peer: ReplicationPeer,
  sequence: number,
  requireKeyframe: boolean,
): ReplicationAcknowledgementResult {
  if (sequence > peer.lastSentSnapshotSequence) return { kind: 'ahead' }
  const recovery = peer.replicationRecovery
  if (recovery) {
    if (
      recovery.keyframeSequence !== null
      && sequence === recovery.keyframeSequence
      && !requireKeyframe
    ) {
      if (!peer.sentReplicationBaselines.has(sequence)) {
        throw new Error('Replication recovery keyframe baseline was not retained')
      }
      peer.acknowledgedSnapshotSequence = sequence
      peer.replicationRecovery = null
      pruneReplicationBaselines(peer)
      return { kind: 'recovered', recovery }
    }
    recovery.lastStaleAcknowledgedSequence = sequence
    recovery.staleAcknowledgementCount += 1
    if (
      requireKeyframe
      && recovery.keyframeSequence !== null
      && sequence >= recovery.keyframeSequence
    ) {
      recovery.keyframeSequence = null
    }
    return { cause: recovery.cause, kind: 'recovery-pending', started: false }
  }
  if (requireKeyframe) {
    peer.replicationRecovery = createReplicationRecovery('client-request', sequence)
    return { cause: 'client-request', kind: 'recovery-pending', started: true }
  }
  if (sequence <= peer.acknowledgedSnapshotSequence) return { kind: 'ignored' }
  if (!peer.sentReplicationBaselines.has(sequence)) {
    peer.replicationRecovery = createReplicationRecovery('baseline-missing', sequence)
    return { cause: 'baseline-missing', kind: 'recovery-pending', started: true }
  }
  peer.acknowledgedSnapshotSequence = sequence
  pruneReplicationBaselines(peer)
  return { kind: 'accepted' }
}

function createReplicationRecovery(
  cause: ReplicationRecoveryState['cause'],
  sequence: number,
): ReplicationRecoveryState {
  return {
    cause,
    firstAcknowledgedSequence: sequence,
    keyframeSequence: null,
    lastStaleAcknowledgedSequence: sequence,
    requestedAtMs: performance.now(),
    staleAcknowledgementCount: 0,
  }
}

function logReplicationBaselineMissing(
  log: GameServerLogSink | undefined,
  logDetails: (details?: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>,
  peer: ReplicationPeer,
  connectionRole: 'observer' | 'player',
  acknowledgedSequence: number,
  identity: Readonly<Record<string, unknown>>,
): void {
  logGameServerEvent(
    log,
    'game-host',
    'warning',
    'replication.baseline_missing',
    'A replication peer acknowledged a baseline the host no longer has.',
    logDetails({
      acknowledgedSequence,
      connectionRole,
      ...identity,
      lastSentSequence: peer.lastSentSnapshotSequence,
    }),
  )
}

function logReplicationBaselineRecovered(
  log: GameServerLogSink | undefined,
  logDetails: (details?: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>,
  peer: ReplicationPeer,
  connectionRole: 'observer' | 'player',
  recovery: ReplicationRecoveryState,
  identity: Readonly<Record<string, unknown>>,
): void {
  logGameServerEvent(
    log,
    'game-host',
    'info',
    'replication.baseline_recovered',
    'A replication peer acknowledged its recovery keyframe.',
    logDetails({
      cause: recovery.cause,
      connectionRole,
      firstAcknowledgedSequence: recovery.firstAcknowledgedSequence,
      ...identity,
      lastSentSequence: peer.lastSentSnapshotSequence,
      lastStaleAcknowledgedSequence: recovery.lastStaleAcknowledgedSequence,
      recoveryDurationMs: Math.max(0, Math.round(performance.now() - recovery.requestedAtMs)),
      recoveryKeyframeSequence: recovery.keyframeSequence,
      staleAcknowledgementCount: recovery.staleAcknowledgementCount,
    }),
  )
}

function pruneReplicationBaselines(client: ReplicationPeer): void {
  for (const sequence of client.sentReplicationBaselines.keys()) {
    if (sequence < client.acknowledgedSnapshotSequence) {
      client.sentReplicationBaselines.delete(sequence)
    }
  }
  while (client.sentReplicationBaselines.size > 64) {
    const sequence = [...client.sentReplicationBaselines.keys()].find(
      (candidate) => (
        candidate !== client.acknowledgedSnapshotSequence
        && candidate !== client.replicationRecovery?.keyframeSequence
      ),
    )
    if (sequence === undefined) break
    client.sentReplicationBaselines.delete(sequence)
  }
}

function authenticate(
  credential: string,
  authentication: GameHostAuthentication,
): AuthenticatedGameHostRole | null {
  if (authentication.kind === 'shared') {
    return credentialsEqual(credential, authentication.credential)
      ? {
          content: null,
          developerAccess: false,
          leaderboardUserId: authentication.leaderboardUserId ?? null,
          partyId: null,
          partyRecoverySeed: false,
          partyRejoinToken: null,
          reservationId: null,
          observer: null,
          role: 'shared',
        }
      : null
  }
  if (authentication.kind === 'tickets') {
    const claimed = authentication.claim(credential)
    return claimed
      && validLeaderboardUserId(claimed.leaderboardUserId)
      && validObserverAdmission(claimed.observer)
      && (claimed.partyRecoverySeed === undefined || typeof claimed.partyRecoverySeed === 'boolean')
      && validPartyRejoinToken(claimed.partyRejoinToken)
      ? {
      content: claimed.content,
      developerAccess: claimed.developerAccess === true,
      leaderboardUserId: claimed.leaderboardUserId,
      partyId: claimed.partyId ?? null,
      partyRecoverySeed: claimed.partyRecoverySeed === true,
      partyRejoinToken: claimed.partyRejoinToken ?? null,
      reservationId: claimed.reservationId ?? null,
      observer: claimed.observer ?? null,
      role: 'shared',
    } : null
  }
  return null
}

function validPartyRejoinToken(value: string | undefined): boolean {
  return value === undefined
    || /^[A-Za-z0-9_-]{43}$/.test(value)
    || (
      value.length <= 8_192
      && /^sdrpr[12]\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)
    )
}

function validObserverAdmission(value: GameHostObserverAdmission | undefined): boolean {
  return value === undefined || (
    value.runId.length >= 1
    && value.runId.length <= 128
    && Number.isSafeInteger(value.userId)
    && value.userId >= 1
    && value.userId <= 0x7fff_ffff
    && value.username.length >= 1
    && value.username.length <= 64
  )
}

function validateAuthentication(authentication: GameHostAuthentication): void {
  if (authentication.kind === 'shared') {
    if (!authentication.credential) throw new Error('Game host requires a shared credential')
    if (!validLeaderboardUserId(authentication.leaderboardUserId ?? null)) {
      throw new Error('Game host leaderboard user id is invalid')
    }
    return
  }
  if (authentication.kind === 'tickets') {
    if (typeof authentication.claim !== 'function') {
      throw new Error('Game host requires a ticket claim function')
    }
    return
  }
}

function validLeaderboardUserId(value: number | null): boolean {
  return value === null || (
    Number.isSafeInteger(value)
    && value >= 1
    && value <= 0x7fff_ffff
  )
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
    && first.cast.quickbar === second.cast.quickbar
}

function pauseAllowsInventoryAction(
  pause: GameplayPauseState,
  playerId: string,
  action: HubInventoryAction,
): boolean {
  return pause.ownerPlayerId === playerId
    && pause.source === 'inventory'
    && (
      action.type === 'consume'
      || action.type === 'bind-belt-item'
      || action.type === 'dye'
      || action.type === 'equip'
      || action.type === 'move-inventory-item'
      || action.type === 'read-skill-book'
      || action.type === 'unequip'
      || action.type === 'unforge'
  )
}

function tutorialSaveBoundaryKey(state: GameSimulationState): string | null {
  if (state.world.kind !== 'boneyard' || state.world.tutorial === null) return null
  const tutorial = state.world.tutorial
  return [
    tutorial.active,
    tutorial.cameraLockTriggered,
    tutorial.cameraLockTicksRemaining === 0,
    tutorial.cameraLockAgeTicks === NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
    tutorial.introActive,
    tutorial.inventoryOpened,
    tutorial.inventorySeen,
    tutorial.itemDropArmed,
    tutorial.narration.current?.eventId ?? 0,
    tutorial.narration.pending.join(','),
    tutorial.skillsOpened,
    tutorial.skillsSeen,
    tutorial.stage,
    tutorial.survivalEnabled,
    tutorial.waveOrdinal,
    tutorial.waveSpawnCursor,
    state.secondaryAbilities.actors
      .filter(actor => actor.kind === 'fire-patch' && actor.skillId === 73 && actor.id <= 2)
      .map(actor => actor.id)
      .join(','),
  ].join('|')
}

function sameCharacter(first: PlayerCharacterConfig, second: PlayerCharacterConfig): boolean {
  return first.discipline === second.discipline
    && first.displayName === second.displayName
    && first.element === second.element
}

function sameContentMod(
  first: import('../protocol/game-protocol.ts').GameContentIdentity,
  second: import('../protocol/game-protocol.ts').GameContentIdentity,
): boolean {
  return first.id.toLowerCase() === second.id.toLowerCase()
    && first.version === second.version
    && first.contentSha256.toLowerCase() === second.contentSha256.toLowerCase()
}

function sameContentMods(
  first: readonly import('../protocol/game-protocol.ts').GameContentIdentity[],
  second: readonly import('../protocol/game-protocol.ts').GameContentIdentity[],
): boolean {
  return first.length === second.length
    && first.every(mod => second.some(candidate => sameContentMod(mod, candidate)))
}

function nextPlayerNumber(playerId: string): number {
  const match = /^player-(\d+)$/.exec(playerId)
  if (!match) return 0
  const value = Number(match[1])
  return Number.isSafeInteger(value) && value > 0 ? value : 0
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

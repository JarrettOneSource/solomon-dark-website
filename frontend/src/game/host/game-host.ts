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
import {
  GAME_FIXED_TICK_SECONDS,
  GAME_TICK_RATE,
  addPlayerCharacter,
  applyGameSimulationHubAction,
  bindGameSimulationPlayerSkillQuickbar,
  confirmGameSimulationLoadout,
  continueGameSimulationOver,
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerEconomy,
  getPlayerProgression,
  grantGameSimulationPlayerExperience,
  removePlayerCharacter,
  returnGameSimulationToHub,
  rerollGameSimulationPlayerSkill,
  saveGameSimulationPlayerSkill,
  selectGameSimulationPlayerConcentration,
  selectGameSimulationPlayerPrimarySkill,
  selectGameSimulationPlayerSkill,
  stepGameSimulationTick,
  type GameSimulationState,
  type PlayerId,
} from '../core-server/game-simulation.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { gameOverExitDurationTicks } from '../core-kernels/game-run.ts'
import type {
  HubInventoryAction,
  ModConsumableCatalogEntry,
} from '../core-kernels/hub-economy.ts'
import {
  createBoneyardCatalog,
  materializeBoneyard,
  type BoneyardCatalog,
} from './boneyard-catalog.ts'
import {
  EMPTY_CONTENT_MANIFEST_SHA256,
  GAME_HOST_ENDED_SESSION_CLOSE_CODE,
  PARTY_ACTION_REJECTIONS,
  GAME_PROTOCOL_VERSION,
  PLAYER_CHARACTER_KERNEL_VERSION,
  GameProtocolError,
  decodeClientGameMessage,
  encodeGameMessage,
  type GameContentManifest,
  type GameChatChannel,
  type GameSessionKind,
  type GameplayPauseState,
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
  applyWebLuaCommands,
  createWebLuaFrameState,
  deriveWebLuaEvents,
  type WebLuaDerivedEvent,
} from './lua/web-lua-game-api.ts'
import { WebLuaRuntime } from './lua/web-lua-runtime.ts'
import {
  WEB_LUA_MAX_PENDING_EXECUTIONS,
  type WebLuaModSource,
} from './lua/web-lua-contract.ts'
import {
  ML_BOT_CHARACTER,
  MlBotHostController,
  type MlBotHostIntent,
  type MlBotPolicyInference,
} from './ml-bot-host-controller.ts'
import {
  createGameSaveDocument,
  restoreGameSaveDocument,
} from '../save/game-save-document.ts'
import { completedHallOfFameEntry } from '../hall-of-fame-entry.ts'
import { createGameLeaderboardReceipt } from './game-leaderboard-receipt.ts'
import { MAX_WEB_GAME_SAVE_BYTES, type GameSaveIntegrity } from '../save/game-save-contract.ts'
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
  type PartyIdentity,
  type PartySystemState,
} from './party-system.ts'
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
  inviteSharedPartyPlayer,
  joinSharedPartyPlayer,
  kickSharedPartyPlayer,
  leaveSharedParty,
  removeSharedGamePlayer,
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
import { WebLuaContentRegistry } from './lua/web-lua-content-registry.ts'
import {
  createWebLuaGameExtensions,
  dispatchWebLuaConsumption,
} from './lua/web-lua-game-extensions.ts'

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
  readonly reservationId?: string
}

type GameHostRole = 'shared'

interface AuthenticatedGameHostRole {
  readonly content: MaterializedWebSessionContent | null
  readonly developerAccess: boolean
  readonly leaderboardUserId: number | null
  readonly partyId: string | null
  readonly reservationId: string | null
  readonly role: GameHostRole
}

interface PartyModRuntimeScope {
  readonly content: MaterializedWebSessionContent
  readonly contentRegistry: WebLuaContentRegistry
  readonly extensions: import('../core-server/game-simulation.ts').GameSimulationExtensions
  readonly pendingEvents: WebLuaDerivedEvent[]
  readonly runtimes: WebLuaRuntime[]
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
  initialPlayerExperience?: number
  leaderboardReceiptSecret?: string
  log?: GameServerLogSink
  logContext?: Readonly<Record<string, unknown>>
  luaWasmPath?: string
  maxPlayers?: number
  mlBotPolicy?: MlBotPolicyInference
  modAssets?: readonly import('../protocol/game-protocol.ts').GameModAsset[]
  mods?: readonly WebLuaModSource[]
  onPlayerCountChanged?: (playerCount: number) => void
  port?: number
  resetWhenEmpty?: boolean
  sessionKind?: GameSessionKind
  sharedHub?: boolean
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
  botCount(): number
  botPlayerIds(): readonly string[]
  botTelemetry(): readonly GameHostMlBotTelemetry[]
  close(reason?: GameHostCloseReason): Promise<void>
  hubPlayerCount(): number
  humanPlayerCount(): number
  hostPlayerId(): string | null
  playerCount(): number
  loadedBoneyard(): LoadedBoneyard | null
  modCatalog(): readonly ModConsumableCatalogEntry[]
  cancelPartyReservation(reservationId: string): void
  createPartyJoinRequest(input: GameHostPartyJoinRequestInput): GameHostPartyJoinRequestResult
  partyCount(): number
  partyJoinRequestStatus(token: string): GameHostPartyJoinRequestStatus | null
  partyTargetByCode(joinCode: string): GameHostPartyTarget | null
  partyTargetByListingId(listingId: string): GameHostPartyTarget | null
  playerState(playerId: string): GameSimulationState | null
  publicParties(): readonly PublicPartyDirectoryEntry[]
  restartForDeployment(
    targetRevision: string,
    timeoutMs?: number,
  ): Promise<GameHostDeploymentRestartResult>
  reservePartyJoin(partyId: string, reservationId: string, expiresAt: number): ProtocolPartyActionRejection | null
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
  readonly content: WebSessionContentSummary
  readonly id: string
  readonly leader: string
  readonly memberCount: number
  readonly status: 'hub' | 'playing'
  readonly visibility: 'invite-only' | 'private' | 'public'
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

type SharedGameplayPauseScope =
  | { readonly kind: 'hub' }
  | { readonly kind: 'party'; readonly partyId: string }

interface HostClient {
  acknowledgedSequence: number
  acknowledgedSnapshotSequence: number
  activeInput: PlayerCharacterInput
  chatSentAtMs: number[]
  connectedAtMs: number
  developerAccess: boolean
  displayName: string
  profile: PlayerSocialProfile
  forceReplicationKeyframe: boolean
  globalScoreEligible: boolean
  localOnly: boolean
  lastReceivedSequence: number
  lastSentSnapshotSequence: number
  leaderboardUserId: number | null
  playerId: PlayerId
  queuedInputs: Map<number, QueuedClientInput>
  pendingLuaRequestIds: Set<number>
  sentReplicationBaselines: Map<number, ReplicatedEntityBaseline>
  socket: WebSocket
}

interface HostBot {
  activeInput: PlayerCharacterInput
  readonly character: PlayerCharacterConfig
  readonly controller: MlBotHostController
  readonly displayName: string
  decisions: number
  readonly playerId: PlayerId
  readonly profile: PlayerSocialProfile
  potionsUsed: number
  readonly queuedIntents: MlBotHostIntent[]
  skillPicks: number
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
      id: mod.id,
      name: mod.id,
      slug: mod.id,
      version: mod.version,
    })),
  }
  const sharedHub = options.sharedHub ?? false
  const sessionKind = options.sessionKind ?? (sharedHub ? 'global-hub' : 'standalone')
  if (sharedHub !== (sessionKind === 'global-hub')) {
    throw new Error('shared Hub ownership and session kind disagree')
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

  let sharedWorlds: SharedGameWorldsState | null = sharedHub ? createSharedGameWorlds() : null
  let privateParties: PartySystemState | null = sessionKind === 'private-college'
    ? createPartySystem()
    : null
  let state = sharedWorlds?.hub ?? createInitialSimulation(options.createSimulation)
  let gameplayPause: GameplayPauseState | null = null
  let sharedHubGameplayPause: GameplayPauseState | null = null
  const sharedGameplayPauses = new Map<string, GameplayPauseState>()
  let nextPlayerId = 1
  let hostPlayerId: PlayerId | null = null
  let loadedBoneyard: LoadedBoneyard | null = null
  let nextChatSequence = 1
  let nextSnapshotSequence = 1
  const saveDocuments = new Map<string, string>()
  const saveSequences = new Map<string, number>()
  let nextLuaRunSeed: number | null = null
  let luaRuntime: WebLuaRuntime | null = null
  let luaRuntimeInitialization: Promise<WebLuaRuntime> | null = null
  let luaRuntimeGeneration = 0
  let luaRuntimeOwnerPlayerId: PlayerId | null = null
  const privateModLuaRuntimes: WebLuaRuntime[] = []
  const privateModContentRegistry = new WebLuaContentRegistry()
  let privateModExtensions: import('../core-server/game-simulation.ts').GameSimulationExtensions | undefined
  const playerContents = new Map<PlayerId, MaterializedWebSessionContent>()
  const pendingRestoredModState = new Map<
    PlayerId,
    Readonly<Record<string, Readonly<Record<string, import('../protocol/game-protocol.ts').LuaConsoleValue>>>>
  >()
  const partyModRuntimeInitializations = new Map<string, Promise<PartyModRuntimeScope>>()
  const partyModRuntimes = new Map<string, PartyModRuntimeScope>()
  const startingPartyIds = new Set<string>()
  let closed = false
  let deploymentRestart: DeploymentRestartState | null = null
  let ticking = false
  let lastTickLagWarningAt = Number.NEGATIVE_INFINITY
  let nextTickAt = performance.now() + GAME_FIXED_TICK_SECONDS * 1000
  const clients = new Map<WebSocket, HostClient>()
  const bots = new Map<PlayerId, HostBot>()
  const failedBots = new Map<PlayerId, Error>()
  const pendingBotInvitations: PendingBotInvitation[] = []
  const pendingBotSummons: PendingBotSummon[] = []
  let nextBotOrdinal = 1
  const externalPartyJoinRequests = new Map<string, ExternalPartyJoinRequest>()
  const partyJoinReservations = new Map<string, PartyJoinReservation>()
  const pendingLuaEvents: WebLuaDerivedEvent[] = []
  const cheatTaintedRunIds = new Set<string>()
  const issuedLeaderboardReceipts = new Set<string>()
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
        bots: bots.size,
        humanPlayers: clients.size,
        players: participantCount(),
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
    maxPayload: MAX_WEB_GAME_SAVE_BYTES * 2 + 64 * 1024,
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
        if (deploymentRestart) {
          disconnectCauses.set(socket, {
            reason: 'game updating',
            source: 'deployment-restart',
          })
          socket.close(1012, 'game updating')
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
          authenticated.partyId !== null
          && !validPartyReservation(
            authenticated.partyId,
            authenticated.reservationId,
          )
        ) {
          disconnect(socket, 'authentication-failed', 'That party admission has expired.')
          return
        }
        if (participantCount() >= maxPlayers) {
          disconnect(socket, 'server-full', 'The session is full.')
          return
        }
        clearTimeout(helloDeadline)
        pending.delete(socket)
        let playerId: PlayerId
        let saveIntegrity: GameSaveIntegrity | null = null
        const playerPartyIdentity = createPartyIdentity()
        if (message.save !== undefined) {
          if (
            !sharedHub && (
              clients.size !== 0
              || state.world.kind !== 'hub'
              || state.playerEntities.identities.length !== 0
            )
          ) {
            disconnect(socket, 'invalid-message', 'A save may resume only on a fresh host owner.')
            return
          }
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
          saveIntegrity = restored.integrity
          if (sharedHub && restored.integrity === 'local-only') {
            disconnect(socket, 'invalid-message', 'Local-only saves require a private College.')
            return
          }
          const activeManifest = authenticated.content?.manifest ?? content
          const modMismatch = !sameContentMods(restored.mods, activeManifest.mods)
          if (modMismatch && !message.allowModMismatch) {
            disconnect(
              socket,
              'invalid-message',
              'The saved mod list does not match this session. Confirm the mismatch before resuming.',
            )
            return
          }
          const restoredCharacter = restored.state.playerEntities.configs[0]
          if (!restoredCharacter || !sameCharacter(restoredCharacter, message.character)) {
            disconnect(socket, 'invalid-message', 'The game save character does not match the resume request.')
            return
          }
          playerId = restored.playerId
          let restoredState = restored.state
          let restoredBoneyard = restored.loadedBoneyard
          if (
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
          if (sharedWorlds) {
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
                error instanceof Error ? error.message : 'The game save cannot enter the shared Hub.',
              )
              return
            }
          } else {
            state = restoredState
            loadedBoneyard = restoredBoneyard
            nextPlayerId = Math.max(nextPlayerId, nextPlayerNumber(playerId) + 1)
          }
          if (sharedHub) pendingRestoredModState.set(playerId, restored.modState)
          else restoreMatchingModState(
            privateModLuaRuntimes,
            restored.mods,
            restored.modState,
            content.mods,
          )
        } else {
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
              restoredParty.leaderPlayerId,
              authenticated.content,
              stateForPlayer(playerId),
              restoredBoneyard,
            ).catch((error) => {
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
        if (privateParties) {
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
        const playerState = stateForPlayer(playerId)
        const welcomeSnapshot = createGameSnapshot(playerState, authorityForPlayer(playerId))
        const snapshotSequence = nextSnapshotSequence
        nextSnapshotSequence += 1
        const welcomeBaseline = createReplicatedEntityBaseline(welcomeSnapshot)
        const clientCheatsEnabled = message.cheatsEnabled && !authenticated.developerAccess
        const joinedClient: HostClient = {
          acknowledgedSequence: 0,
          acknowledgedSnapshotSequence: snapshotSequence,
          activeInput: createIdlePlayerCharacterInput(),
          chatSentAtMs: [],
          connectedAtMs: Date.now(),
          developerAccess: authenticated.developerAccess,
          displayName: message.character.displayName,
          profile: message.profile,
          forceReplicationKeyframe: false,
          globalScoreEligible: sessionKind !== 'private-college'
            && message.save === undefined
            && !clientCheatsEnabled
            && (authenticated.content?.manifest.mods.length ?? content.mods.length) === 0,
          localOnly: sessionKind !== 'global-hub'
            || clientCheatsEnabled
            || saveIntegrity === 'local-only'
            || (authenticated.content?.manifest.mods.length ?? content.mods.length) > 0,
          lastReceivedSequence: 0,
          lastSentSnapshotSequence: snapshotSequence,
          leaderboardUserId: authenticated.leaderboardUserId,
          playerId,
          pendingLuaRequestIds: new Set(),
          queuedInputs: new Map(),
          sentReplicationBaselines: new Map([[snapshotSequence, welcomeBaseline]]),
          socket,
        }
        clients.set(socket, joinedClient)
        if (!joinedClient.globalScoreEligible) taintActiveRun(joinedClient)
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
            role: authenticated.role,
          }),
        )
        options.onPlayerCountChanged?.(clients.size)
        socket.send(encodeGameMessage({
          type: 'server-welcome',
          developerAccess: joinedClient.developerAccess,
          protocolVersion: GAME_PROTOCOL_VERSION,
          playerId,
          resumeToken: `reserved-${playerId}`,
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
          modCatalog: sharedHub ? [] : privateModContentRegistry.catalog(),
          boneyards: boneyardCatalogForPlayer(playerId).choices,
          gameplayPause: gameplayPauseForPlayer(playerId),
          snapshot: welcomeSnapshot,
          snapshotSequence,
        }))
        const playerBoneyard = loadedBoneyardForPlayer(playerId)
        if (playerBoneyard) {
          socket.send(encodeGameMessage({
            type: 'server-boneyard-loaded',
            boneyard: playerBoneyard,
          }))
        }
        if (sharedWorlds || privateParties) broadcastPartyState()
        publishSaveCheckpoint('connected')
        if (gameplayPauseForPlayer(playerId)) broadcastSnapshot()
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

      if (message.type === 'client-gameplay-pause') {
        const activeState = stateForPlayer(client.playerId)
        const activePause = gameplayPauseForPlayer(client.playerId)
        if (message.paused) {
          if (message.source === 'pause-menu' && activeState.world.kind === 'hub') return
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
            || activePause.source !== 'skill-book'
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
              && activePause.source !== 'pause-menu'
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
            || (
              activePause.source !== 'skill-book'
              && activePause.source !== 'pause-menu'
            )
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
      if (message.type === 'client-level-up-action') {
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
        const applied = applyGameSimulationHubAction(
          stateForPlayer(client.playerId),
          client.playerId,
          message.action,
          modScope?.extensions ?? privateModExtensions,
        )
        replaceStateForPlayer(client.playerId, applied.state)
        if (applied.modConsumption) {
          if (modScope) {
            dispatchWebLuaConsumption(
              modScope.contentRegistry,
              modScope.runtimes,
              applied.modConsumption,
            )
          } else if (privateModExtensions) {
            dispatchWebLuaConsumption(
              privateModContentRegistry,
              privateModLuaRuntimes,
              applied.modConsumption,
            )
          }
        }
        client.activeInput = createIdlePlayerCharacterInput()
        client.queuedInputs.clear()
        broadcastSnapshot()
        if (applied.accepted) publishSaveCheckpoint('hub-action')
        return
      }
      if (message.type === 'client-chat') {
        const whisperTarget = message.channel === 'whisper'
          ? [...clients.values()].find(candidate => (
              candidate.playerId === message.targetPlayerId
              && candidate.playerId !== client.playerId
              && candidate.socket.readyState === WebSocket.OPEN
            )) ?? null
          : null
        if (message.channel === 'whisper' && !whisperTarget) {
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
          : chatRecipients(client, message.channel)
        if (!recipients) {
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
        const encoded = encodeGameMessage({
          type: 'server-chat',
          channel: message.channel,
          ...(whisperTarget
            ? {
                recipient: {
                  displayName: whisperTarget.displayName,
                  playerId: whisperTarget.playerId,
                },
              }
            : {}),
          sender: {
            displayName: client.displayName,
            playerId: client.playerId,
          },
          sequence: nextChatSequence,
          text: message.text,
        })
        nextChatSequence += 1
        for (const recipient of recipients) {
          if (recipient.socket.readyState === WebSocket.OPEN) recipient.socket.send(encoded)
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
        const result = denySharedPartyInvitation(
          sharedWorlds,
          client.playerId,
          message.invitationId,
        )
        if (result.accepted) {
          sharedWorlds = result.state
          state = sharedWorlds.hub
          broadcastPartyState()
        }
        sendPartyAction(client, 'deny-invitation', result)
        return
      }
      if (message.type === 'client-party-settings') {
        if (privateParties && message.visibility !== 'private') {
          sendPartyAction(client, 'settings', rejectedPartyAction('party-private'))
          return
        }
        const parties = activePartySystem()
        const result = parties
          ? setPartyVisibility(parties, client.playerId, message.visibility)
          : rejectedPartyAction('party-missing')
        if (result.accepted) replacePartySystem(result.state)
        sendPartyAction(client, 'settings', result)
        return
      }
      if (message.type === 'client-party-rotate-code') {
        const parties = activePartySystem()
        const result = parties
          ? rotatePartyJoinCode(parties, client.playerId, createPartyJoinCode())
          : rejectedPartyAction('party-missing')
        if (result.accepted) replacePartySystem(result.state)
        sendPartyAction(client, 'rotate-code', result)
        return
      }
      if (
        message.type === 'client-party-request-accept'
        || message.type === 'client-party-request-deny'
      ) {
        const parties = activePartySystem()
        const result = parties
          ? decidePartyJoinRequest(parties, client.playerId, message.requestId)
          : rejectedPartyAction('party-missing')
        if (result.accepted) {
          replacePartySystem(result.state)
          const request = [...externalPartyJoinRequests.values()].find(candidate => (
            candidate.id === message.requestId && candidate.status === 'pending'
          ))
          if (request) {
            request.status = message.type === 'client-party-request-accept' ? 'accepted' : 'denied'
          }
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
          if (accepted) disconnect(target!.socket, 'invalid-message', 'The College leader removed you.')
          return
        }
        const result = kickSharedPartyPlayer(
          sharedWorlds,
          client.playerId,
          message.targetPlayerId,
          createPartyIdentity(),
        )
        if (result.accepted) {
          sharedWorlds = result.state
          state = sharedWorlds.hub
          broadcastPartyState()
          broadcastSnapshot()
        }
        sendPartyAction(client, 'kick', result)
        return
      }
      if (message.type === 'client-cheat-mode') {
        if (message.enabled) {
          if (sharedHub && !client.developerAccess) {
            disconnect(socket, 'invalid-message', 'Cheats require a private College.')
            return
          }
          if (client.developerAccess) return
          client.globalScoreEligible = false
          client.localOnly = true
          taintActiveRun(client)
        }
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
        client.globalScoreEligible = false
        client.localOnly = true
        taintActiveRun(client)
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
        const activeState = stateForPlayer(client.playerId)
        if (
          client.playerId !== authorityForPlayer(client.playerId)
          || loadedBoneyardForPlayer(client.playerId)
          || gameplayPauseForPlayer(client.playerId) !== null
          || activeState.levelUpBarrier !== null
          || activeState.run.phase !== 'hub'
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
        loadedBoneyard = selected
        const previousState = state
        state = enterBoneyardWorld(state, selected)
        taintIneligibleClientRuns()
        if (activePrivateLuaRuntimes().length > 0) {
          pendingLuaEvents.push(...deriveWebLuaEvents(
            previousState,
            state,
            name => activePrivateLuaRuntimes().some(runtime => runtime.wantsEvent(name)),
          ))
        }
        broadcast({ type: 'server-boneyard-loaded', boneyard: selected })
        if (privateParties) broadcastPartyState()
        broadcastSnapshot()
        publishSaveCheckpoint('boneyard-entry')
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
      const activeDeploymentRestart = deploymentRestart
      if (activeDeploymentRestart?.pending.delete(socket)) {
        if (activeDeploymentRestart.pending.size === 0) {
          activeDeploymentRestart.resolveReady()
        }
      }
      const disconnectedState = stateForPlayer(client.playerId)
      const disconnectedPartyId = activePartySystem()
        ? partyForPlayer(activePartySystem()!, client.playerId)?.id ?? null
        : null
      const disconnectedPauseScope = sharedWorlds
        ? sharedGameplayPauseScope(client.playerId)
        : null
      const releasedGameplayPause = gameplayPauseForPlayer(client.playerId)?.ownerPlayerId
        === client.playerId
      saveDocuments.delete(client.playerId)
      saveSequences.delete(client.playerId)
      if (sharedWorlds) {
        sharedWorlds = removeSharedGamePlayer(sharedWorlds, client.playerId)
        state = sharedWorlds.hub
        playerContents.delete(client.playerId)
        pendingRestoredModState.delete(client.playerId)
        if (
          disconnectedPartyId
          && !sharedWorlds.parties.parties.some(party => party.id === disconnectedPartyId)
        ) closePartyModRuntimes(disconnectedPartyId)
      } else {
        state = removePlayerCharacter(state, client.playerId)
        if (privateParties) {
          privateParties = removePrivatePartyPlayer(privateParties, client.playerId)
        }
      }
      if (client.playerId === luaRuntimeOwnerPlayerId) resetLuaRuntime()
      if (clients.size === 0) removeAllBots('last human player disconnected')
      if (clients.size === 0) {
        hostPlayerId = null
        resetLuaRuntime()
        if (resetWhenEmpty && !sharedHub) {
          state = createInitialSimulation(options.createSimulation)
          nextPlayerId = 1
          loadedBoneyard = null
          nextChatSequence = 1
          nextSnapshotSequence = 1
          saveDocuments.clear()
          saveSequences.clear()
          if (privateParties) privateParties = createPartySystem()
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
          serverTick: disconnectedState.tick,
          ...(socketError ? gameServerErrorDetails(socketError) : {}),
        }),
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
    if (deploymentRestart) {
      resetNextTickDeadline()
      return
    }
    if (resetWhenEmpty && clients.size === 0) {
      resetNextTickDeadline()
      return
    }
    if (!sharedWorlds && gameplayPause !== null) {
      resetNextTickDeadline()
      return
    }
    ticking = true
    try {
      const now = performance.now()
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
          const statesBeforeLua = new Map(
            sharedWorlds.runs.map(run => [run.partyId, run.state]),
          )
          for (const [partyId, scope] of partyModRuntimes) {
            const run: SharedPartyRun | undefined = sharedWorlds.runs.find(
              candidate => candidate.partyId === partyId,
            )
            if (!run) continue
            let runState: GameSimulationState = run.state
            const intents: import('../core-kernels/boneyard-wave-director.ts').BoneyardEnemySpawnIntent[] = []
            for (const runtime of scope.runtimes) {
              runtime.beginTick(runState.tick + 1)
              const applied = applyWebLuaCommands(runState, runtime.drainCommands())
              runState = applied.state
              intents.push(...applied.enemySpawnIntents)
            }
            sharedWorlds = {
              ...sharedWorlds,
              runs: sharedWorlds.runs.map((candidate): SharedPartyRun => (
                candidate.partyId === partyId ? { ...candidate, state: runState } : candidate
              )),
            }
            enemySpawnIntents.set(partyId, [
              ...(enemySpawnIntents.get(partyId) ?? []),
              ...intents,
            ])
          }
          const previous = sharedWorlds
          sharedWorlds = stepSharedGameWorlds(
            sharedWorlds,
            inputs,
            new Set([...sharedGameplayPauses.keys(), ...startingPartyIds]),
            enemySpawnIntents,
            sharedHubGameplayPause !== null,
            new Map([...partyModRuntimes].map(([partyId, scope]) => [
              partyId,
              scope.extensions,
            ])),
          )
          state = sharedWorlds.hub
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
          for (const run of sharedWorlds.runs) {
            const before = previous.runs.find(({ partyId }) => partyId === run.partyId)
            if (!before) continue
            const enteredGameOver = before.state.run.phase === 'active'
              && run.state.run.phase === 'game-over'
            const completedGameOver = before.state.run.phase === 'game-over'
              && run.state.run.phase === 'loadout'
            const previousBarrierId = before.state.levelUpBarrier?.barrierId ?? null
            const barrierId = run.state.levelUpBarrier?.barrierId ?? null
            const scope = partyModRuntimes.get(run.partyId)
            if (scope) {
              const events = [
                ...scope.pendingEvents.splice(0),
                ...deriveWebLuaEvents(
                  statesBeforeLua.get(run.partyId) ?? before.state,
                  run.state,
                  name => scope.runtimes.some(runtime => runtime.wantsEvent(name)),
                ),
              ]
              for (const event of events) {
                for (const runtime of scope.runtimes) runtime.dispatch(event.name, event.payload)
              }
            }
            publishLeaderboardReceipts(before.state, run.state)
            if (enteredGameOver) publishSharedSaveClear(run.partyId)
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
          applyQueuedInput(client, nextTick)
          inputs[client.playerId] = client.activeInput
        }
        for (const bot of bots.values()) inputs[bot.playerId] = bot.activeInput
        const previousTick = state.tick
        const previousBarrierId = state.levelUpBarrier?.barrierId ?? null
        const previousRunPhase = state.run.phase
        const previousGameOverExitTicks = state.run.gameOverExitTicks
        const stateBeforeLua = state
        let enemySpawnIntents = [] as import('../core-kernels/boneyard-wave-director.ts').BoneyardEnemySpawnIntent[]
        const runtimes = activePrivateLuaRuntimes()
        for (const runtime of runtimes) {
          runtime.beginTick(nextTick)
          const applied = applyWebLuaCommands(state, runtime.drainCommands())
          state = applied.state
          enemySpawnIntents.push(...applied.enemySpawnIntents)
          if (applied.nextRunSeed !== null) nextLuaRunSeed = applied.nextRunSeed
        }
        state = stepGameSimulationTick(state, inputs, {
          enemySpawnIntents,
          extensions: privateModExtensions,
        })
        publishLeaderboardReceipts(stateBeforeLua, state)
        if (runtimes.length > 0) {
          const events = [
            ...pendingLuaEvents.splice(0),
            ...deriveWebLuaEvents(
              stateBeforeLua,
              state,
              name => runtimes.some(runtime => runtime.wantsEvent(name)),
            ),
          ]
          for (const event of events) {
            for (const runtime of runtimes) runtime.dispatch(event.name, event.payload)
          }
        }
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
          && state.run.phase === 'loadout'
        if (enteredGameOver) publishSaveClear()
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
        if (
          state.tick !== previousTick
          && state.tick % GAME_SAVE_AUTOSAVE_INTERVAL_TICKS === 0
        ) publishSaveCheckpoint('periodic')
      }
      pruneLeaderboardRunState()
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

  function publishSaveClear(): void {
    for (const client of clients.values()) publishSaveClearForClient(client)
  }

  function publishSharedSaveClear(partyId: string): void {
    if (!sharedWorlds) return
    const party = sharedWorlds.parties.parties.find(({ id }) => id === partyId)
    if (!party) return
    const memberIds = new Set(party.memberPlayerIds)
    for (const client of clients.values()) {
      if (memberIds.has(client.playerId)) publishSaveClearForClient(client)
    }
  }

  function publishSaveCheckpointForClient(
    client: HostClient,
    source: string,
    force = false,
    clearTerminal = false,
  ): number {
    if (client.socket.readyState !== WebSocket.OPEN) return 0
    const saveState = sharedWorlds
      ? sharedPartySaveStateForPlayer(sharedWorlds, client.playerId)
      : state
    if (!saveState) return 0
    if (saveState.run.phase === 'game-over' || saveState.run.phase === 'loadout') {
      return clearTerminal ? publishSaveClearForClient(client) : 0
    }
    let document: string
    try {
      const party = sharedWorlds
        ? partyForPlayer(sharedWorlds.parties, client.playerId)
        : null
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
      document = createGameSaveDocument({
        integrity: client.localOnly ? 'local-only' : 'global-clean',
        loadedBoneyard: loadedBoneyardForPlayer(client.playerId),
        mods: sharedContent?.manifest.mods ?? content.mods,
        modState: Object.fromEntries(
          (scope?.runtimes ?? privateModLuaRuntimes)
            .map(runtime => [runtime.mod.id, runtime.snapshotState()]),
        ),
        playerId: client.playerId,
        state: saveState,
      })
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
      reason: 'progress',
      sequence,
    }))
    return sequence
  }

  function publishSaveClearForClient(client: HostClient): number {
    if (client.socket.readyState !== WebSocket.OPEN) return 0
    const sequence = (saveSequences.get(client.playerId) ?? 0) + 1
    saveSequences.set(client.playerId, sequence)
    saveDocuments.delete(client.playerId)
    client.socket.send(encodeGameMessage({
      type: 'server-save-checkpoint',
      save: null,
      reason: 'game-over',
      sequence,
    }))
    return sequence
  }

  function broadcastSnapshot(): void {
    const defaultSnapshot = sharedWorlds ? null : createGameSnapshot(state, hostPlayerId)
    const snapshotSequence = nextSnapshotSequence
    nextSnapshotSequence += 1
    const periodicKeyframe = snapshotSequence % Math.max(1, snapshotRate * 5) === 0
    for (const client of clients.values()) {
      if (client.socket.readyState !== WebSocket.OPEN) continue
      const snapshot = defaultSnapshot ?? createGameSnapshot(
        stateForPlayer(client.playerId),
        authorityForPlayer(client.playerId),
      )
      const currentBaseline = createReplicatedEntityBaseline(snapshot)
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
    const hubPlayerIds = new Set(sharedWorlds
      ? sharedWorlds.hub.playerEntities.identities.map(({ playerId }) => playerId)
      : [...clients.values()].map(({ playerId }) => playerId))
    for (const client of clients.values()) {
      if (client.socket.readyState !== WebSocket.OPEN) continue
      client.socket.send(encodeGameMessage({
        type: 'server-party-state',
        state: projectPartyState(
          parties,
          client.playerId,
          profiles,
          hubPlayerIds,
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
      content: partyContent,
      id: party.id,
      leader: leader.displayName,
      memberCount: party.memberPlayerIds.length,
      status: playing ? 'playing' : 'hub',
      visibility: party.visibility,
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
    if (target.memberCount + reservationsForParty(partyId) >= maxPlayers) return 'party-full'
    partyJoinReservations.set(reservationId, { expiresAt, partyId })
    return null
  }

  function validPartyReservation(partyId: string, reservationId: string | null): boolean {
    prunePartyAccess()
    if (!reservationId) return false
    const reservation = partyJoinReservations.get(reservationId)
    return reservation?.partyId === partyId && reservation.expiresAt > performance.now()
  }

  function availablePartyMembers(partyId: string, activeReservationId: string | null): number {
    prunePartyAccess()
    const otherReservations = [...partyJoinReservations].filter(([id, reservation]) => (
      id !== activeReservationId && reservation.partyId === partyId
    )).length
    return Math.max(1, maxPlayers - otherReservations)
  }

  function reservationsForParty(partyId: string): number {
    return [...partyJoinReservations.values()].filter(reservation => (
      reservation.partyId === partyId
    )).length
  }

  function consumePartyReservation(reservationId: string | null): void {
    if (reservationId) partyJoinReservations.delete(reservationId)
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
        client.socket.readyState === WebSocket.OPEN
        && stateForPlayer(client.playerId) === playerState
      ) client.socket.send(encodeGameMessage(message))
    }
  }

  function chatRecipients(
    sender: HostClient,
    channel: GameChatChannel,
  ): readonly HostClient[] | null {
    if (channel === 'global') {
      if (!sharedWorlds || stateForPlayer(sender.playerId).world.kind !== 'hub') return null
      return [...clients.values()].filter(client => (
        stateForPlayer(client.playerId).world.kind === 'hub'
      ))
    }
    if (!sharedWorlds) {
      const senderState = stateForPlayer(sender.playerId)
      return [...clients.values()].filter(client => (
        stateForPlayer(client.playerId) === senderState
      ))
    }
    const party = partyForPlayer(sharedWorlds.parties, sender.playerId)
    if (!party) return null
    const memberPlayerIds = new Set(party.memberPlayerIds)
    return [...clients.values()].filter(client => memberPlayerIds.has(client.playerId))
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

  function queueMlBotSummon(summonerPlayerId: PlayerId) {
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
        playerId: pending.playerId,
        profile: {
          accountUsername: null,
          highestWave: null,
          totalPlaytimeMs: null,
        },
        potionsUsed: 0,
        queuedIntents,
        skillPicks: 0,
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
        if (intent.kind === 'input') {
          bot.decisions += 1
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
          const selected = selectGameSimulationPlayerSkill(active, bot.playerId, intent)
          if (selected) {
            bot.skillPicks += 1
            replaceStateForPlayer(bot.playerId, selected)
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
        kills: 0,
        lifeState: 'absent',
        playerId: bot.playerId,
        potionsUsed: bot.potionsUsed,
        skillPicks: bot.skillPicks,
        tick: 0,
        waveReached: 0,
        wavesCompleted: 0,
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
      kills: world?.hallOfFameRuns[bot.playerId]?.monstersKilled ?? 0,
      lifeState: progression.lifeState,
      playerId: bot.playerId,
      potionsUsed: bot.potionsUsed,
      skillPicks: bot.skillPicks,
      tick: active.tick,
      waveReached,
      wavesCompleted: Math.max(
        0,
        waveReached - Number(world?.waves?.phase !== 'interwave'),
      ),
    }
  }

  function participantCount(): number {
    return clients.size + bots.size
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

  function stopSharedHubInputs(): void {
    if (!sharedWorlds) return
    for (const client of clients.values()) {
      if (stateForPlayer(client.playerId).world.kind !== 'hub') continue
      client.activeInput = createIdlePlayerCharacterInput()
      client.queuedInputs.clear()
    }
    for (const bot of bots.values()) {
      if (stateForPlayer(bot.playerId).world.kind !== 'hub') continue
      bot.activeInput = createIdlePlayerCharacterInput()
      bot.queuedIntents.length = 0
    }
  }

  function resetNextTickDeadline(): void {
    nextTickAt = performance.now() + GAME_FIXED_TICK_SECONDS * 1000
  }

  function gameplayPauseForPlayer(playerId: string): GameplayPauseState | null {
    if (!sharedWorlds) return gameplayPause
    const scope = sharedGameplayPauseScope(playerId)
    if (scope?.kind === 'hub') return sharedHubGameplayPause
    return scope ? sharedGameplayPauses.get(scope.partyId) ?? null : null
  }

  function sharedGameplayPauseScope(playerId: string): SharedGameplayPauseScope | null {
    if (!sharedWorlds) return null
    const playerState = sharedGameStateForPlayer(sharedWorlds, playerId)
    if (!playerState) return null
    if (playerState.world.kind === 'hub') return { kind: 'hub' }
    const partyId = partyForPlayer(sharedWorlds.parties, playerId)?.id
    return partyId ? { kind: 'party', partyId } : null
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
    if (scope?.kind === 'hub') sharedHubGameplayPause = pause
    else if (scope) sharedGameplayPauses.set(scope.partyId, pause)
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
    const pause = scope.kind === 'hub'
      ? sharedHubGameplayPause
      : sharedGameplayPauses.get(scope.partyId) ?? null
    const party = scope.kind === 'party'
      ? sharedWorlds.parties.parties.find(({ id }) => id === scope.partyId)
      : null
    for (const client of clients.values()) {
      if (
        client.socket.readyState === WebSocket.OPEN
        && (scope.kind === 'hub'
          ? stateForPlayer(client.playerId).world.kind === 'hub'
          : party?.memberPlayerIds.includes(client.playerId))
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
      ? scope?.kind === 'hub'
        ? sharedHubGameplayPause
        : scope
          ? sharedGameplayPauses.get(scope.partyId) ?? null
          : null
      : gameplayPause
    if (!released) return
    if (sharedWorlds && scope?.kind === 'hub') {
      sharedHubGameplayPause = null
      stopSharedHubInputs()
    } else if (sharedWorlds && scope?.kind === 'party') {
      sharedGameplayPauses.delete(scope.partyId)
      stopPartyInputs(scope.partyId)
    } else {
      gameplayPause = null
      stopAllClientInputs()
      resetNextTickDeadline()
    }
    broadcastGameplayPause(playerId, scope)
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

  function taintActiveRun(client: HostClient): void {
    const activeState = stateForPlayer(client.playerId)
    if (activeState.world.kind === 'boneyard') {
      cheatTaintedRunIds.add(activeState.world.runId)
    }
  }

  function taintIneligibleClientRuns(): void {
    for (const client of clients.values()) {
      if (!client.globalScoreEligible) taintActiveRun(client)
    }
    if (!sharedWorlds || bots.size === 0) return
    for (const run of sharedWorlds.runs) {
      const party = sharedWorlds.parties.parties.find(candidate => candidate.id === run.partyId)
      if (
        run.state.world.kind === 'boneyard'
        && party?.memberPlayerIds.some(playerId => bots.has(playerId))
      ) cheatTaintedRunIds.add(run.state.world.runId)
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
      || cheatTaintedRunIds.has(completed.world.runId)
    ) return
    for (const client of clients.values()) {
      const userId = client.leaderboardUserId
      const previousRun = previous.world.hallOfFameRuns[client.playerId]
      const completedRun = completed.world.hallOfFameRuns[client.playerId]
      if (
        userId === null
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
    for (const runId of cheatTaintedRunIds) {
      if (!activeRunIds.has(runId)) cheatTaintedRunIds.delete(runId)
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

  function contentForParty(partyId: string): MaterializedWebSessionContent | null {
    if (!sharedWorlds) return null
    const party = sharedWorlds.parties.parties.find(candidate => candidate.id === partyId)
    if (!party) return null
    const leaderContent = playerContents.get(party.leaderPlayerId)
    if (!leaderContent) return null
    return party.memberPlayerIds.every(playerId => {
      if (bots.has(playerId)) return leaderContent.manifest.mods.length === 0
      const memberContent = playerContents.get(playerId)
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
        leaderPlayerId,
        partyContent,
        initialState,
        selected,
      )
      if (!sharedWorlds || closed || !clients.has(socket)) return
      const latestParty = partyForPlayer(sharedWorlds.parties, leaderPlayerId)
      if (!latestParty || latestParty.id !== party.id || !contentForParty(party.id)) return
      const before = sharedPartySaveStateForPlayer(sharedWorlds, leaderPlayerId)
      const started = startSharedPartyRun(sharedWorlds, leaderPlayerId, selected)
      if (!started.accepted || !before) return
      sharedWorlds = started.state
      state = sharedWorlds.hub
      const run = sharedWorlds.runs.find(candidate => candidate.partyId === party.id)!
      scope.pendingEvents.push(...deriveWebLuaEvents(
        before,
        run.state,
        name => scope.runtimes.some(runtime => runtime.wantsEvent(name)),
      ))
      taintIneligibleClientRuns()
      stopWorldClientInputs(leaderPlayerId)
      broadcastToPlayerWorld(leaderPlayerId, {
        type: 'server-mod-catalog',
        items: scope.contentRegistry.catalog(),
      })
      broadcastToPlayerWorld(leaderPlayerId, {
        type: 'server-boneyard-loaded',
        boneyard: selected,
      })
      broadcastPartyState()
      broadcastSnapshot()
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
    leaderPlayerId: PlayerId,
    partyContent: MaterializedWebSessionContent,
    initialState: GameSimulationState,
    loaded: LoadedBoneyard | null,
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
      const runtimes: WebLuaRuntime[] = []
      const contentRegistry = new WebLuaContentRegistry()
      try {
        for (const source of partyContent.modSources) {
          const runtime = await createModLuaRuntime(source, () => {
            const run = sharedWorlds?.runs.find(candidate => candidate.partyId === partyId)
            const activeParty = sharedWorlds?.parties.parties.find(candidate => candidate.id === partyId)
            return {
              authorityPlayerId: activeParty?.leaderPlayerId ?? leaderPlayerId,
              loadedBoneyard: run?.loadedBoneyard ?? loaded,
              state: run?.state ?? initialState,
            }
          }, contentRegistry)
          runtimes.push(runtime)
          runtime.runEntrypoint(source.entryScript)
        }
        const scope: PartyModRuntimeScope = {
          content: partyContent,
          contentRegistry,
          extensions: createWebLuaGameExtensions(contentRegistry, runtimes),
          pendingEvents: [],
          runtimes,
        }
        const savedState = pendingRestoredModState.get(leaderPlayerId)
        if (savedState) {
          restoreMatchingModState(
            runtimes,
            partyContent.manifest.mods,
            savedState,
            partyContent.manifest.mods,
          )
          pendingRestoredModState.delete(leaderPlayerId)
        }
        partyModRuntimes.set(partyId, scope)
        return scope
      } catch (error) {
        for (const runtime of runtimes) runtime.close()
        contentRegistry.close()
        throw error
      } finally {
        partyModRuntimeInitializations.delete(partyId)
      }
    })()
    partyModRuntimeInitializations.set(partyId, promise)
    return promise
  }

  async function createModLuaRuntime(
    source: WebLuaModSource,
    resolveState: () => {
      authorityPlayerId: PlayerId | null
      loadedBoneyard: LoadedBoneyard | null
      state: GameSimulationState
    },
    contentRegistry: WebLuaContentRegistry,
  ): Promise<WebLuaRuntime> {
    if (!options.luaWasmPath) throw new Error('Lua runtime is not configured for this game host.')
    return WebLuaRuntime.create({
      bindings: {
        getAuthorityPlayerId: () => resolveState().authorityPlayerId,
        getFrame: () => {
          const active = resolveState()
          return createWebLuaFrameState(active.state, active.authorityPlayerId, active.loadedBoneyard)
        },
      },
      contentRegistry,
      log: (level, event, detail) => logGameServerEvent(
        options.log,
        'game-host',
        level,
        event,
        detail,
        logDetails({ modId: source.identity.id }),
      ),
      mod: source.identity,
      modSource: source,
      wasmPath: options.luaWasmPath,
    })
  }

  async function initializePrivateModLuaRuntimes(): Promise<void> {
    if (!options.mods?.length) return
    try {
      for (const source of options.mods) {
        const runtime = await createModLuaRuntime(source, () => ({
          authorityPlayerId: hostPlayerId,
          loadedBoneyard,
          state,
        }), privateModContentRegistry)
        privateModLuaRuntimes.push(runtime)
        runtime.runEntrypoint(source.entryScript)
      }
      privateModExtensions = createWebLuaGameExtensions(
        privateModContentRegistry,
        privateModLuaRuntimes,
      )
    } catch (error) {
      for (const runtime of privateModLuaRuntimes.splice(0)) runtime.close()
      privateModContentRegistry.close()
      privateModExtensions = undefined
      throw error
    }
  }

  function closePartyModRuntimes(partyId: string): void {
    const scope = partyModRuntimes.get(partyId)
    partyModRuntimes.delete(partyId)
    if (scope) {
      for (const runtime of scope.runtimes) runtime.close()
      scope.contentRegistry.close()
    }
    const initialization = partyModRuntimeInitializations.get(partyId)
    partyModRuntimeInitializations.delete(partyId)
    if (initialization) void initialization.then((created) => {
      if (partyModRuntimes.get(partyId) === created) partyModRuntimes.delete(partyId)
      for (const runtime of created.runtimes) runtime.close()
      created.contentRegistry.close()
    }, () => {})
  }

  function restoreMatchingModState(
    runtimes: readonly WebLuaRuntime[],
    savedMods: readonly import('../protocol/game-protocol.ts').GameContentIdentity[],
    savedState: Readonly<Record<string, Readonly<Record<string, import('../protocol/game-protocol.ts').LuaConsoleValue>>>>,
    activeMods: readonly import('../protocol/game-protocol.ts').GameContentIdentity[],
  ): void {
    for (const runtime of runtimes) {
      const active = activeMods.find(mod => mod.id.toLowerCase() === runtime.mod.id.toLowerCase())
      const saved = savedMods.find(mod => mod.id.toLowerCase() === runtime.mod.id.toLowerCase())
      if (!active || !saved || !sameContentMod(saved, active)) continue
      const stateEntry = Object.entries(savedState).find(
        ([id]) => id.toLowerCase() === runtime.mod.id.toLowerCase(),
      )?.[1]
      if (stateEntry) runtime.restoreState(stateEntry)
    }
  }

  function activePrivateLuaRuntimes(): readonly WebLuaRuntime[] {
    return luaRuntime === null ? privateModLuaRuntimes : [...privateModLuaRuntimes, luaRuntime]
  }

  await initializePrivateModLuaRuntimes()
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
      for (const runtime of privateModLuaRuntimes.splice(0)) runtime.close()
      privateModContentRegistry.close()
      for (const partyId of [...partyModRuntimes.keys()]) closePartyModRuntimes(partyId)
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
    hubPlayerCount: () => sharedWorlds?.hub.playerEntities.identities.length
      ?? Number(state.world.kind === 'hub') * clients.size,
    humanPlayerCount: () => clients.size,
    playerCount: participantCount,
    loadedBoneyard: () => loadedBoneyard,
    modCatalog: () => privateModContentRegistry.catalog(),
    cancelPartyReservation(reservationId) {
      partyJoinReservations.delete(reservationId)
    },
    createPartyJoinRequest: createExternalPartyJoinRequest,
    partyCount: () => activePartySystem()?.parties.length ?? 0,
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
    publicParties: () => sharedWorlds
      ? projectPublicPartyDirectory({
          memberships: sharedWorlds.parties.parties,
          runs: sharedWorlds.runs.map(run => ({
            boneyardName: run.loadedBoneyard.choice.name,
            partyId: run.partyId,
          })),
        }, new Map(
          [...clients.values(), ...bots.values()].map(
            ({ displayName, playerId }) => [playerId, displayName],
          ),
        ), maxPlayers)
      : [],
    restartForDeployment,
    reservePartyJoin: reserveExternalPartyJoin,
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
        developer: { summonBot: () => queueMlBotSummon(playerId) },
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
): AuthenticatedGameHostRole | null {
  if (authentication.kind === 'shared') {
    return credentialsEqual(credential, authentication.credential)
      ? {
          content: null,
          developerAccess: false,
          leaderboardUserId: authentication.leaderboardUserId ?? null,
          partyId: null,
          reservationId: null,
          role: 'shared',
        }
      : null
  }
  if (authentication.kind === 'tickets') {
    const claimed = authentication.claim(credential)
    return claimed && validLeaderboardUserId(claimed.leaderboardUserId) ? {
      content: claimed.content,
      developerAccess: claimed.developerAccess === true,
      leaderboardUserId: claimed.leaderboardUserId,
      partyId: claimed.partyId ?? null,
      reservationId: claimed.reservationId ?? null,
      role: 'shared',
    } : null
  }
  return null
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
      || action.type === 'equip'
      || action.type === 'unequip'
      || action.type === 'unforge'
    )
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

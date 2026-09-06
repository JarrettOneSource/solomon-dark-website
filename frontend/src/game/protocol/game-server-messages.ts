import type { BoneyardChoice, LoadedBoneyard } from '../core-kernels/boneyard.ts'
import type { ModConsumableCatalogEntry } from '../core-kernels/hub-economy.ts'
import type { LuaConsoleObject, LuaConsoleValue } from './codecs/lua.ts'
import type {
  GameChatMessage,
  GameChatRejection,
  GameCollegeInvitation,
  GamePlayerCardProfile,
} from './game-chat.ts'
import type { GameModAsset, ModContentProjection } from './game-mod-contract.ts'
import type {
  GameContentManifest,
  GameSessionKind,
  GameplayPauseState,
  GameplayResumeGraceState,
  PlayerCharacterKernelParameters,
} from './game-protocol-contract.ts'
import type { GameSnapshot, GameSnapshotFrame } from './game-state.ts'
import type { LocalPartyState } from './party-state.ts'

export interface ServerWelcomeMessage {
  type: 'server-welcome'
  cheatsEnabled: boolean
  developerAccess: boolean
  protocolVersion: number
  playerId: string
  resumeToken: string
  serverTickRate: number
  snapshotRate: number
  sessionKind: GameSessionKind
  kernelParameters: PlayerCharacterKernelParameters
  content: GameContentManifest
  modAssets: readonly GameModAsset[]
  modCatalog: readonly ModConsumableCatalogEntry[]
  boneyards: readonly BoneyardChoice[]
  gameplayPause: GameplayPauseState | null
  gameplayResumeGrace: GameplayResumeGraceState | null
  observer?: boolean
  snapshot: GameSnapshot
  snapshotSequence: number
}

export interface ServerModCatalogMessage {
  type: 'server-mod-catalog'
  items: readonly ModConsumableCatalogEntry[]
}

export interface ServerModContentMessage extends ModContentProjection {
  readonly type: 'server-mod-content'
}

export interface ServerModRuntimeMessage {
  readonly projection: LuaConsoleObject
  readonly revision: number
  readonly type: 'server-mod-runtime'
}

export interface ServerSnapshotMessage {
  type: 'server-snapshot'
  acknowledgedInputSequence: number
  frame: GameSnapshotFrame
  sequence: number
}

export interface ServerBoneyardLoadedMessage {
  type: 'server-boneyard-loaded'
  boneyard: LoadedBoneyard
}

export interface ServerSaveCheckpointMessage {
  type: 'server-save-checkpoint'
  save: string
  reason: 'game-over' | 'progress'
  sequence: number
}

export interface ServerSaveBeforeLeaveMessage {
  type: 'server-save-before-leave'
  checkpointSequence: number
  requestId: number
}

export interface ServerDeploymentRestartMessage {
  type: 'server-deployment-restart'
  checkpointSequence: number
  targetRevision: string
}

export interface ServerLeaderboardReceiptMessage {
  type: 'server-leaderboard-receipt'
  receipt: string
}

export interface ServerPongMessage {
  type: 'server-pong'
  nonce: number
}

export interface ServerGameplayPauseMessage {
  type: 'server-gameplay-pause'
  pause: GameplayPauseState | null
}

export interface ServerGameplayResumeGraceMessage {
  readonly grace: GameplayResumeGraceState | null
  readonly type: 'server-gameplay-resume-grace'
}

export interface ServerPartyStateMessage {
  type: 'server-party-state'
  state: LocalPartyState
}

export const PARTY_ACTIONS = [
  'accept-invitation',
  'deny-invitation',
  'invite',
  'invite-college',
  'kick',
  'leave',
  'request-accept',
  'request-deny',
  'rotate-code',
  'settings',
] as const

export type PartyAction = typeof PARTY_ACTIONS[number]

export const PARTY_ACTION_REJECTIONS = [
  'already-in-party',
  'already-invited',
  'already-requested',
  'invitation-missing',
  'not-in-hub',
  'not-leader',
  'not-recipient',
  'party-full',
  'party-missing',
  'party-private',
  'player-missing',
  'request-missing',
  'same-party',
  'self-invite',
  'self-kick',
] as const

export type PartyActionRejection = typeof PARTY_ACTION_REJECTIONS[number]

export interface ServerPartyActionMessage {
  type: 'server-party-action'
  action: PartyAction
  ok: boolean
  reason: PartyActionRejection | null
}

export interface ServerChatMessage extends GameChatMessage {
  type: 'server-chat'
}

export interface ServerChatRejectedMessage extends GameChatRejection {
  type: 'server-chat-rejected'
}

export interface ServerPlayerCardMessage {
  readonly profile: GamePlayerCardProfile | null
  readonly requestId: number
  readonly type: 'server-player-card'
}

export interface ServerCollegeInvitationsMessage {
  readonly invitations: readonly GameCollegeInvitation[]
  readonly type: 'server-college-invitations'
}

export interface ServerCheatModeMessage {
  readonly enabled: boolean
  readonly type: 'server-cheat-mode'
}

export interface ServerLuaResultMessage {
  type: 'server-lua-result'
  error: string | null
  ok: boolean
  output: readonly string[]
  requestId: number
  values: readonly LuaConsoleValue[]
}

export type GameDisconnectCode =
  | 'authentication-failed'
  | 'invalid-message'
  | 'protocol-mismatch'
  | 'server-full'

export interface ServerDisconnectMessage {
  type: 'server-disconnect'
  code: GameDisconnectCode
  reason: string
}

export type ServerGameMessage =
  | ServerChatMessage
  | ServerChatRejectedMessage
  | ServerCheatModeMessage
  | ServerCollegeInvitationsMessage
  | ServerDeploymentRestartMessage
  | ServerGameplayPauseMessage
  | ServerGameplayResumeGraceMessage
  | ServerWelcomeMessage
  | ServerSnapshotMessage
  | ServerBoneyardLoadedMessage
  | ServerSaveBeforeLeaveMessage
  | ServerSaveCheckpointMessage
  | ServerLeaderboardReceiptMessage
  | ServerLuaResultMessage
  | ServerModCatalogMessage
  | ServerModContentMessage
  | ServerModRuntimeMessage
  | ServerPartyStateMessage
  | ServerPartyActionMessage
  | ServerPlayerCardMessage
  | ServerPongMessage
  | ServerDisconnectMessage

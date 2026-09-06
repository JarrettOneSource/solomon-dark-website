import type { HubInventoryAction } from '../core-kernels/hub-economy.ts'
import type { NativeTutorialSurfaceAction } from '../core-kernels/native-tutorial.ts'
import type {
  PlayerCharacterConfig,
  PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import type { GameSaveIntent } from '../save/game-save-contract.ts'
import type { LuaConsoleObject } from './codecs/lua.ts'
import type { GameChatChannel, GameOnlinePreferences } from './game-chat.ts'
import type { GameplayPauseSource } from './game-protocol-contract.ts'
import type { HubPlayerActivity } from './game-state.ts'
import type { PartyVisibility, PlayerSocialProfile } from './party-state.ts'

export interface ClientHelloMessage {
  allowModMismatch?: boolean
  beginCollegeIntro?: boolean
  cheatsEnabled: boolean
  declineTutorial?: boolean
  onlinePreferences: GameOnlinePreferences
  type: 'client-hello'
  protocolVersion: number
  credential: string
  character: PlayerCharacterConfig
  profile: PlayerSocialProfile
  resumeToken?: string
  save?: string
  saveIntent?: GameSaveIntent
}

export interface ClientObserverHelloMessage {
  readonly credential: string
  readonly protocolVersion: number
  readonly type: 'client-observer-hello'
}

export interface ClientInputMessage {
  type: 'client-input'
  input: PlayerCharacterInput
  sequence: number
  targetTick: number
}

export interface ClientSelectSkillMessage {
  type: 'client-select-skill'
  choiceIndex: number
  offerSequence: number
  skillId: number
}

export interface ClientSkillQuickbarBindMessage {
  type: 'client-skill-quickbar-bind'
  skillId: number | null
  slot: number
}

export interface ClientSelectPrimarySkillMessage {
  type: 'client-select-primary-skill'
  skillId: number
}

export interface ClientSelectConcentrationMessage {
  type: 'client-select-concentration'
  skillId: number
}

export interface ClientSelectConcentrationSlotMessage {
  type: 'client-select-concentration-slot'
  skillId: number
  slot: 0 | 1
}

export interface ClientLevelUpActionMessage {
  type: 'client-level-up-action'
  action: 'reroll' | 'save'
  offerSequence: number
}

export interface ClientHubActionMessage {
  type: 'client-hub-action'
  action: HubInventoryAction
}

export interface ClientHubActivityMessage {
  type: 'client-hub-activity'
  activity: HubPlayerActivity | null
}

export interface ClientOnlinePreferencesMessage {
  readonly onlinePreferences: GameOnlinePreferences
  readonly type: 'client-online-preferences'
}

export interface ClientChatMessage {
  type: 'client-chat'
  channel: GameChatChannel
  /** Required exactly when the channel is whisper: the server-issued live target reference. */
  targetPlayerReference?: string
  text: string
}

export interface ClientPlayerCardRequestMessage {
  readonly playerReference: string
  readonly requestId: number
  readonly type: 'client-player-card-request'
}

export interface ClientCollegeInviteMessage {
  readonly playerReference: string
  readonly type: 'client-college-invite'
}

export interface ClientCollegeInvitationDismissMessage {
  readonly invitationId: string
  readonly type: 'client-college-invitation-dismiss'
}

export interface ClientPartyInviteMessage {
  type: 'client-party-invite'
  targetPlayerId: string
}

export interface ClientPartyAcceptMessage {
  type: 'client-party-accept'
  invitationId: string
}

export interface ClientPartyDenyMessage {
  type: 'client-party-deny'
  invitationId: string
}

export interface ClientPartySettingsMessage {
  type: 'client-party-settings'
  visibility: PartyVisibility
}

export interface ClientPartyRotateCodeMessage {
  type: 'client-party-rotate-code'
}

export interface ClientPartyRequestAcceptMessage {
  type: 'client-party-request-accept'
  requestId: string
}

export interface ClientPartyRequestDenyMessage {
  type: 'client-party-request-deny'
  requestId: string
}

export interface ClientPartyLeaveMessage {
  type: 'client-party-leave'
}

export interface ClientPartyKickMessage {
  type: 'client-party-kick'
  targetPlayerId: string
}

export interface ClientPingMessage {
  type: 'client-ping'
  nonce: number
}

export interface ClientSnapshotAckMessage {
  type: 'client-snapshot-ack'
  requireKeyframe: boolean
  sequence: number
}

export interface ClientDisconnectMessage {
  type: 'client-disconnect'
}

export interface ClientSaveBeforeLeaveMessage {
  type: 'client-save-before-leave'
  requestId: number
}

export interface ClientDeploymentReadyMessage {
  type: 'client-deployment-ready'
  checkpointSequence: number
  targetRevision: string
}

export interface ClientStartMatchMessage {
  type: 'client-start-match'
  boneyardId: string
}

export interface ClientStartTutorialMessage {
  type: 'client-start-tutorial'
}

export interface ClientReadyCollegeIntroMessage {
  type: 'client-ready-college-intro'
}

export interface ClientReadyBoneyardMessage {
  readonly runId: string
  readonly type: 'client-ready-boneyard'
}

export interface ClientTutorialActionMessage {
  action: NativeTutorialSurfaceAction
  type: 'client-tutorial-action'
}

export interface ClientContinueGameOverMessage {
  type: 'client-continue-game-over'
  eventId: number
  runId: string
}

export interface ClientConfirmLoadoutMessage {
  type: 'client-confirm-loadout'
  discipline: PlayerCharacterConfig['discipline']
  displayName: string
  element: PlayerCharacterConfig['element']
}

export type ClientGameplayPauseMessage =
  | { type: 'client-gameplay-pause'; paused: false }
  | { type: 'client-gameplay-pause'; paused: true; source: GameplayPauseSource }

export interface ClientResumeGraceReadyMessage {
  readonly sequence: number
  readonly type: 'client-resume-grace-ready'
}

export interface ClientCheatModeMessage {
  type: 'client-cheat-mode'
  enabled: boolean
}

export interface ClientLuaExecuteMessage {
  type: 'client-lua-execute'
  code: string
  requestId: number
}

export interface ClientModCastMessage {
  readonly contentId: string
  readonly requestId: number
  readonly targetX: number
  readonly targetY: number
  readonly type: 'client-mod-cast'
}

export const MOD_ACTIONS = [
  'portal-enter',
  'quickbar-bind',
  'reforge',
  'scene-room',
  'scene-return',
  'shop-buy',
  'skill-choose',
  'ui-action',
] as const

export type ModAction = typeof MOD_ACTIONS[number]

export interface ClientModActionMessage {
  readonly action: ModAction
  readonly arguments: LuaConsoleObject
  readonly requestId: number
  readonly target: string
  readonly type: 'client-mod-action'
}

export type ClientGameMessage =
  | ClientChatMessage
  | ClientCheatModeMessage
  | ClientCollegeInvitationDismissMessage
  | ClientCollegeInviteMessage
  | ClientConfirmLoadoutMessage
  | ClientContinueGameOverMessage
  | ClientDeploymentReadyMessage
  | ClientGameplayPauseMessage
  | ClientHelloMessage
  | ClientHubActivityMessage
  | ClientHubActionMessage
  | ClientInputMessage
  | ClientLevelUpActionMessage
  | ClientLuaExecuteMessage
  | ClientModCastMessage
  | ClientModActionMessage
  | ClientOnlinePreferencesMessage
  | ClientObserverHelloMessage
  | ClientPlayerCardRequestMessage
  | ClientPartyAcceptMessage
  | ClientPartyDenyMessage
  | ClientPartyInviteMessage
  | ClientPartyKickMessage
  | ClientPartyLeaveMessage
  | ClientPartyRequestAcceptMessage
  | ClientPartyRequestDenyMessage
  | ClientPartyRotateCodeMessage
  | ClientPartySettingsMessage
  | ClientSelectConcentrationMessage
  | ClientSelectConcentrationSlotMessage
  | ClientSelectPrimarySkillMessage
  | ClientSelectSkillMessage
  | ClientSkillQuickbarBindMessage
  | ClientPingMessage
  | ClientReadyBoneyardMessage
  | ClientReadyCollegeIntroMessage
  | ClientResumeGraceReadyMessage
  | ClientSaveBeforeLeaveMessage
  | ClientSnapshotAckMessage
  | ClientStartMatchMessage
  | ClientStartTutorialMessage
  | ClientTutorialActionMessage
  | ClientDisconnectMessage

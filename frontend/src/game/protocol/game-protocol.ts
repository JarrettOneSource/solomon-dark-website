import {
  isWizardDiscipline,
  isWizardElement,
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import {
  BONEYARD_SOLOMON_DIG_CUES,
  BONEYARD_SOLOMON_PHASES,
  BONEYARD_SOLOMON_VOICE_CUES,
  type BoneyardSolomonDigCue,
  type BoneyardSolomonPhase,
  type BoneyardSolomonVoiceCue,
} from '../core-kernels/boneyard-encounter.ts'
import {
  BONEYARD_ARENA_ENTRANCE_EXTENSION,
  BONEYARD_ARENA_NORTH_TARGET_INSET,
  BONEYARD_ARENA_SEAL_TICKS,
  BONEYARD_ARENA_TRANSITION_PHASES,
  type BoneyardArenaTransitionState,
} from '../core-kernels/boneyard-arena-transition.ts'
import {
  BONEYARD_WAVE_DIRECTOR_PHASES,
  BONEYARD_WAVE_ENEMY_TYPES,
  type BoneyardWaveDirectorPhase,
} from '../core-kernels/boneyard-wave-director.ts'
import {
  isHubRegionId,
  isHubTransitionEdge,
  type HubRegionId,
} from '../core-kernels/hub-regions.ts'
import type {
  NativeCollegeIntroState,
  NativeCollegeIntroPhase,
} from '../core-kernels/native-college-intro.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import {
  NATIVE_LIGHT_MANAGER_LANES,
  type NativeLightManagerLane,
  type NativeLightProviderRegistration,
} from '../core-kernels/native-light-provider-order.ts'
import type { NativeRngState } from '../core-kernels/native-rng.ts'
import type { NativeEnemyPathState } from '../core-kernels/native-enemy-pathfinding.ts'
import type { NativeEnemyWorldFeedbackKernelState } from '../core-kernels/native-enemy-world-feedback.ts'
import { NATIVE_HALL_OF_FAME_SCORE } from '../core-kernels/hall-of-fame-score.ts'
import {
  HUB_MEMORIAL_FIRST_EXTERNAL_PORTRAIT_ID,
  HUB_MEMORIAL_INITIAL_MARKERS,
  HUB_MEMORIAL_INITIAL_SLOT_AGES,
  HUB_MEMORIAL_LAST_EXTERNAL_PORTRAIT_ID,
  HUB_MEMORIAL_SLOT_COUNT,
  type HubMemorialState,
} from '../core-kernels/hub-memorial.ts'
import type { PlayerLivingEquipmentAppearance } from '../core-kernels/player-equipment-appearance.ts'
import { ETHER_PRIMARY_INITIAL_TURN } from '../core-kernels/primary-spell-targeting.ts'
import { NATIVE_ETHER_BLAST_PARTICLE_LIFETIME_TICKS } from '../core-kernels/native-ether-blast.ts'
import { earthImpactLifetimeTicks } from '../core-kernels/primary-spell-earth.ts'
import {
  WATER_FROST_MAXIMUM_SPEED,
  WATER_FROST_MAX_PARTICLES_PER_TICK,
  WATER_FROST_MINIMUM_SPEED,
  waterFrostJetKind,
  waterFrostJetLifetimeTicks,
} from '../core-kernels/primary-spell-water.ts'
import {
  PRIMARY_SPELL_EARTH_INITIAL_CHARGE,
  PRIMARY_SPELL_AIR_LIFETIME_TICKS,
  PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS,
  PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS,
  primaryCastActionEndTick,
  type PrimarySpellEarthBoulderBitState,
  type PrimarySpellEarthProjectileState,
  type PrimarySpellProjectilePhase,
  type PrimarySpellProjectileState,
  type PrimarySpellSimulationState,
  type PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  NATIVE_HAIL_INITIAL_LIFE,
} from '../core-kernels/air-water-spell-actors.ts'
import {
  NATIVE_FIRE_EXPLOSION_LIFETIME_TICKS,
  NATIVE_FIRE_IMPACT_LIFETIME_TICKS,
  nativeFireParticleLifetimeTicks,
  nativeFireParticleVariant,
} from '../core-kernels/primary-spell-fire-native.ts'
import {
  NATIVE_GOOD_IMP_CONTACT_VISIBLE_TICKS,
  type NativeFireSpentEmber,
} from '../core-kernels/primary-spell-fire-effects.ts'
import {
  NATIVE_WELD_CHANNEL_VISIBLE_TICKS,
  NATIVE_WELD_ETHEREAL_BOULDER_HELD_SCALE_CEILING,
  NATIVE_WELD_HAIL_RELEASE_FADE_LIFETIME_TICKS,
  NATIVE_WELD_HAIL_ROCK_FADE_LIFETIME_TICKS,
  NATIVE_WELD_HAILSTONES_SCALE_CEILING,
  NATIVE_WELD_IMPACT_VISIBLE_TICKS,
  NATIVE_WELD_METEOR_IMPACT_TICKS,
  NATIVE_WELD_METEOR_PULSE_TICKS,
  NATIVE_WELD_PERSISTENT_INITIAL_SCALE,
  type NativeWeldBoulderDebrisActorState,
  type NativeWeldChannelActorState,
  type NativeWeldEtherealBoulderState,
  type NativeWeldHailstoneRockState,
  type NativeWeldHailRockFadeActorState,
  type NativeWeldHailstonesState,
  type NativeWeldBlizzardChainFrostState,
  type NativeWeldFrostFadeActorState,
  type NativeWeldGroundSparkFadeActorState,
  type NativeWeldImpactActorState,
  type NativeWeldMeteorActorState,
  type NativeWeldMeteorFlashActorState,
  type NativeWeldMeteorFieldState,
  type NativeWeldProjectileState,
  type NativeWeldWorldActor,
} from '../core-kernels/native-weld-primary-runtime.ts'
import {
  NATIVE_BOULDER_DEBRIS_MAX_LIFETIME_TICKS,
  type NativeWeldBoulderDebrisParticleState,
} from '../core-kernels/native-weld-boulder-debris.ts'
import type { NativeWeldSteamActorState } from '../core-kernels/native-weld-steam.ts'
import {
  NATIVE_WELD_HAIL_FLASH_ALPHA_STEP,
  NATIVE_WELD_HAIL_LINE_ALPHA_STEP,
  type NativeWeldHailFlashState,
  type NativeWeldHailKnockbackState,
  type NativeWeldHailLineState,
  type NativeWeldHailTerrainBouncerState,
  type NativeWeldHailTerrainParticleState,
} from '../core-kernels/native-weld-hail-contact.ts'
import {
  NATIVE_WELD_FLAME_LASH_FADE_ALPHA_STEP,
  type NativeWeldFlameLashFadeState,
} from '../core-kernels/native-weld-flame-lash.ts'
import type { NativeWeldBlizzardGlowState } from '../core-kernels/native-weld-blizzard.ts'
import type { NativeWeldBuildId } from '../core-kernels/native-weld-primary-profile.ts'
import type {
  NativeWeldMeteorDebrisSeed,
  NativeWeldMeteorMarkerState,
} from '../core-kernels/native-weld-meteor.ts'
import {
  NATIVE_STAFF_MELEE_ACCELERATION,
  NATIVE_STAFF_MELEE_BASE_PROGRESS,
  NATIVE_STAFF_CONTACT_EVENT_TICKS,
  NATIVE_STAFF_PIKE_BREAK_LIFETIME_TICKS,
  isNativePlayerStaffTransient,
  type NativePlayerStaffTransient,
  type NativeStaffProcSound,
} from '../core-kernels/native-player-staff-action.ts'
import {
  GAME_OVER_AUTOMATIC_ACCEPT_TICK,
  GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
  GAME_OVER_EXIT_KINDS,
  GAME_OVER_INPUT_ACCEPT_TICK,
  GAME_OVER_INPUT_EXIT_FADE_TICKS,
  GAME_RUN_PHASES,
  type GameOverExitKind,
  type GameRunLifecycleState,
  type GameRunPhase,
} from '../core-kernels/game-run.ts'
import { PLAYER_LIFE_STATES, type PlayerLifeState } from '../core-kernels/player-combat.ts'
import {
  DOWSING_EQUIPMENT_RECIPES,
  EQUIPMENT_SLOTS,
  EQUIPMENT_TYPES,
  HAGATHA_PERKS,
  HUB_ITEM_KINDS,
  HUB_SACK_CHILD_REPLICATION_LIMIT,
  HUB_SACK_REPLICATION_DEPTH_LIMIT,
  nativeHagathaOutcomeStateIsValid,
  MAX_NATIVE_DYE_SELECTIONS,
  modItemInventoryIdentityIsValid,
  modWearableContentIsValid,
  NATIVE_LOOT_BACKPACK_REPLICATION_LIMIT,
  NATIVE_UNFORGE_OUTCOME_KINDS,
  type DowsingOffer,
  type EquipmentSlot,
  type EquipmentType,
  type HagathaOffer,
  type HubInventoryAction,
  type HubInventoryItem,
  type HubItemKind,
  type HubShopItem,
  type ModConsumableContent,
  type ModConsumableCatalogEntry,
  type ModEquipmentAffix,
  type ModItemContent,
  type ModSpriteFrame,
  type ModWearableContent,
  type NativeUnforgeOutcome,
} from '../core-kernels/hub-economy.ts'
import {
  NATIVE_BELT_ITEM_TYPE_IDS,
  nativeInventoryItemCanBindToBelt,
  type PlayerBeltComponent,
} from '../core-kernels/native-belt.ts'
import {
  NATIVE_PLAYER_MAX_LIGHT_OVERLAY,
  playerLightDriveActive,
} from '../core-kernels/player-lighting.ts'
import { BONEYARD_ENEMY_FLAGS } from '../core-kernels/boneyard-enemy-config.ts'
import {
  NATIVE_TUTORIAL_AMULET_IDENTITY,
  NATIVE_TUTORIAL_CAMERA_CLEANUP_TICKS,
  NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
  NATIVE_TUTORIAL_CUES,
  NATIVE_TUTORIAL_CUE_DEFINITIONS,
  NATIVE_TUTORIAL_STAGES,
  NATIVE_TUTORIAL_SURFACE_ACTIONS,
  type NativeTutorialCue,
  type NativeTutorialState,
  type NativeTutorialSurfaceAction,
} from '../core-kernels/native-tutorial.ts'
import {
  NATIVE_MINDBLAST_BURST_LIFETIME_TICKS,
  NATIVE_MINDBLAST_SHOCKWAVE_GROWTH,
  NATIVE_MINDBLAST_SHOCKWAVE_LIFETIME_TICKS,
  NATIVE_SECONDARY_ACTOR_KINDS,
  NATIVE_SECONDARY_AUDIO_CUES,
  NATIVE_SECONDARY_EVENT_KINDS,
  NATIVE_SECONDARY_GLOBAL_COOLDOWN_TICKS,
  NATIVE_SECONDARY_MOVEMENT_MODIFIER_KINDS,
  nativeSecondaryLightDisposition,
  type NativeSecondaryActorKind,
  type NativeSecondaryAudioCue,
  type NativeSecondaryEventKind,
  type NativeSecondaryActorState,
  type NativeSecondaryEventState,
  type NativeSecondaryGolemState,
  type NativeSecondaryMovementModifierKind,
  type NativeSecondaryPlayerState,
  type NativeSecondaryScreenFlashState,
  type NativeSecondaryTargetEffectState,
} from '../core-kernels/native-secondary-abilities.ts'
import {
  NATIVE_SECONDARY_ABILITY_IDS,
  type NativeSecondaryAbilityId,
} from '../core-kernels/native-secondary-ability-contract.ts'
import {
  NATIVE_DAMAGE_X4_POTION_TICKS,
  isNativeBeltSkill,
  nativeSkillCategory,
  SPELL_WELDING_SKILL_ID,
} from '../core-kernels/player-progression.ts'
import {
  BOUNDED_ENEMY_COLD_SLOW_TICKS,
  NATIVE_WRAITH_DAZZLE_TICKS,
} from '../core-kernels/boneyard-enemy-modifiers.ts'
import { NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES } from '../core-kernels/boneyard-mage-lightning.ts'
import type {
  BoneyardBounds,
  BoneyardChoice,
  BoneyardFence,
  BoneyardGateLeafSnapshot,
  BoneyardObject,
  BoneyardPoint,
  BoneyardRoad,
  BoneyardScene,
  BoneyardSprite,
  BoneyardTerrain,
  LoadedBoneyard,
} from '../core-kernels/boneyard.ts'
import type {
  BoneyardEnemyEventSnapshot,
  BoneyardEnemyDeathEffectSnapshot,
  GameSnapshot,
  GameSnapshotFrame,
  BoneyardEnemyAction,
  BoneyardEnemyAnimationSnapshot,
  BoneyardEnemyCoffinState,
  BoneyardEnemyEffectSnapshot,
  BoneyardEnemyProjectileKind,
  BoneyardEnemyProjectileEffectSnapshot,
  BoneyardEnemyProjectilePayload,
  BoneyardEnemyProjectileSnapshot,
  BoneyardEnemySnapshot,
  BoneyardMageLightningPulseFrame,
  BoneyardMageLightningPulseSnapshot,
  BoneyardMaggotSnapshot,
  BoneyardGoodieSnapshot,
  BoneyardLootEventSnapshot,
  BoneyardLootSnapshot,
  BoneyardSolomonSnapshot,
  BoneyardWaveSnapshot,
  HubPlayerActivity,
  HubWorldSnapshot,
  ProtocolHubParticipantState,
  ProtocolHubSkorchaState,
  ProtocolAmbientState,
  ProtocolPlayerProgression,
  ProtocolPlayerEconomy,
  ProtocolPlayerState,
  ProtocolPlayerSnapshotFrame,
  ProtocolModEffect,
  ProtocolStudentState,
  NativeHallOfFameRunSnapshot,
  NativeSecondarySnapshotState as ProtocolNativeSecondarySnapshotState,
} from './game-state.ts'
import {
  boneyardMageLightningPulseFrameIsValid,
  materializeBoneyardMageLightningPulse,
} from './boneyard-mage-lightning-replication.ts'
import {
  BONEYARD_ENEMY_EFFECT_ROLES,
  BONEYARD_ENEMY_ACTION_SOUNDS,
  BONEYARD_ENEMY_DAMAGE_SOUNDS,
  BONEYARD_ENEMY_DEATH_EFFECT_KINDS,
  BONEYARD_ENEMY_DEATH_EFFECT_PRESENTATION_OWNERS,
  BONEYARD_ENEMY_DEATH_SOUNDS,
  BONEYARD_ENEMY_EVENT_TYPES,
  BONEYARD_ENEMY_PROJECTILE_PAYLOADS,
  BONEYARD_ENEMY_PROJECTILE_EFFECT_ALPHA_MAXIMUMS,
  BONEYARD_ENEMY_PROJECTILE_EFFECT_KINDS,
  BONEYARD_ENEMY_TERMINAL_OUTPUTS,
  BONEYARD_PLAYER_DAMAGE_SOUNDS,
  BONEYARD_MAGGOT_LAUNCH_TRAJECTORIES,
  BONEYARD_MAGGOT_STATES,
  BONEYARD_LOOT_EVENT_TYPES,
  BONEYARD_LOOT_KINDS,
  BONEYARD_LOOT_SOUNDS,
  BONEYARD_LOOT_SOURCES,
  HUB_PLAYER_ACTIVITIES,
} from './game-state.ts'
import { REPLICATED_ENTITY_TYPE_REGISTRY } from './entity-replication.ts'
import type {
  ReplicatedEntityDescriptor,
  ReplicatedEntityFrame,
  ReplicatedEntityKey,
  ReplicatedEntitySample,
} from './replicated-entity-types.ts'
import {
  PARTY_VISIBILITIES,
  type PartyJoinRequester,
  type LocalPartyState,
  type PartyPlayerProfile,
  type PartyRosterPlayer,
  type PartyVisibility,
  type PlayerSocialProfile,
} from './party-state.ts'
import {
  GAME_CHAT_ACTIVITIES,
  GAME_CHAT_MAX_TEXT_CODE_UNITS,
  gameChatActivityText,
  normalizeGameChatText,
  type GameChatChannel,
  type GameChatMessage,
  type GameCollegeInvitation,
  type GamePlayerCardProfile,
  type GameChatRejection,
  type GameChatRejectionReason,
  type GameChatSender,
  type GameOnlinePreferences,
} from './game-chat.ts'
import {
  MAX_WEB_GAME_SAVE_BYTES,
  type GameSaveIntent,
} from '../save/game-save-contract.ts'

export type {
  BoneyardEnemyEventSnapshot,
  GameSnapshot,
  HubPlayerActivity,
  ProtocolHubParticipantState,
} from './game-state.ts'
export type {
  BoneyardChoice,
  BoneyardScene,
  LoadedBoneyard,
} from '../core-kernels/boneyard.ts'
export type {
  GameChatChannel,
  GameChatActivity,
  GameChatMessage,
  GameCollegeInvitation,
  GamePlayerCardProfile,
  GameChatRejection,
  GameChatRejectionReason,
  GameChatSender,
  GameOnlinePreferences,
} from './game-chat.ts'
export type {
  LocalPartyState,
  PartyJoinRequester,
  PartyPlayerProfile,
  PartyVisibility,
  PlayerSocialProfile,
} from './party-state.ts'
export {
  DEFAULT_GAME_ONLINE_PREFERENCES,
  GAME_CHAT_ACTIVITIES,
  GAME_CHAT_MAX_TEXT_BYTES,
  GAME_CHAT_MAX_TEXT_CODE_UNITS,
  gameChatActivityText,
  normalizeGameChatText,
} from './game-chat.ts'

export const GAME_PROTOCOL_VERSION = 100
export const GAME_WEBSOCKET_MAX_PAYLOAD_BYTES = MAX_WEB_GAME_SAVE_BYTES * 2 + 64 * 1024
export const GAME_PROTOCOL_NAME = `solomon-dark/${GAME_PROTOCOL_VERSION}`
export const MAX_GAME_LEADERBOARD_RECEIPT_BYTES = 4_096
export const GAME_CONNECTION_TIMEOUT_CLOSE_CODE = 4000
export const GAME_HOST_ENDED_SESSION_CLOSE_CODE = 4001
export const GAME_SESSION_REPLACED_CLOSE_CODE = 4002
export const PLAYER_CHARACTER_KERNEL_VERSION = 'player-character-kernel-5'
export const EMPTY_CONTENT_MANIFEST_SHA256 = '0'.repeat(64)

const MAX_CONTENT_MODS = 256
const MAX_BONEYARD_CHOICES = 256
const MAX_BONEYARD_OBJECTS = 8192
const MAX_BONEYARD_SPRITES = 16384
const MAX_BONEYARD_STRUCTURES = 8192
const MAX_BONEYARD_ENEMIES = 512
const MAX_BONEYARD_ENEMY_EVENTS = 512
const MAX_BONEYARD_ENEMY_DEATH_EFFECTS = 8_192
const MAX_BONEYARD_ENEMY_PROJECTILES = 2_048
const MAX_BONEYARD_ENEMY_PROJECTILE_EFFECTS = 8_192
const MAX_BONEYARD_MAGE_LIGHTNING_PULSES = MAX_BONEYARD_ENEMIES
  * NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES
const MAX_BONEYARD_MAGGOTS = 2_048
const MAX_BONEYARD_LOOT = 2_047
const MAX_BONEYARD_GOODIES = 256
const MAX_BONEYARD_LOOT_EVENTS = 512
const MAX_BONEYARD_ENEMY_FLAGS = 64
const MAX_BONEYARD_ENEMY_EFFECTS = 1
const MAX_BONEYARD_DIG_EVENTS = 8
const MAX_BONEYARD_VOICE_EVENTS = 8
const MAX_FOUNTAIN_PARTICLES = 512
const MAX_PLAYERS = 64
const MAX_STUDENT_PROPS = 8
const MAX_STUDENTS = 256
const MAX_REPLICATED_ENTITIES = 8192
const MAX_REPLICATED_COMPONENTS = 72
const MAX_PRIMARY_SPELL_PROJECTILES = 4096
const MAX_PRIMARY_SPELL_TRANSIENTS = 16384
const MAX_PRIMARY_SPELL_HIT_TARGETS = 1024
const MAX_SECONDARY_ACTORS = 32_768
const MAX_SECONDARY_EVENTS = 512
const MAX_SECONDARY_TARGET_EFFECTS = 8_192
export const MAX_LUA_CONSOLE_CODE_LENGTH = 48 * 1_024
export const MAX_LUA_CONSOLE_OUTPUT_LINES = 64
export const MAX_LUA_CONSOLE_OUTPUT_LINE_LENGTH = 4_096
export const MAX_LUA_CONSOLE_OUTPUT_BYTES = 16 * 1_024
export const MAX_LUA_CONSOLE_RETURN_VALUES = 16
export const MAX_LUA_CONSOLE_RETURN_BYTES = 24 * 1_024
export const MAX_LUA_CONSOLE_VALUE_DEPTH = 16
export const MAX_LUA_CONSOLE_VALUE_NODES = 2_048
export const MAX_LUA_CONSOLE_VALUE_FIELDS = 128
export const MAX_LUA_CONSOLE_VALUE_STRING_LENGTH = 16_384
export const MAX_GAME_COLLEGE_INVITATIONS = 8

const luaTextEncoder = new TextEncoder()

const BONEYARD_ENEMY_PROJECTILE_NATIVE_TYPES = {
  arrow: 0x7da,
  'demon-bomb': 0x7f7,
  firebolt: 0x7eb,
  'guided-missile': 0x7ec,
  'poison-pool': 0x806,
} as const satisfies Readonly<Record<BoneyardEnemyProjectileKind, number>>

const BONEYARD_ENEMY_ANIMATION_STATES = ['idle', 'locomotion', 'action', 'death'] as const
const BONEYARD_ENEMY_ACTIONS = [
  'skeleton-claw-a',
  'skeleton-claw-b',
  'skeleton-weapon',
  'skeleton-pike',
  'archer-shot',
  'mage-cast-short',
  'mage-cast-long',
  'zombie-beat',
  'wraith-drain',
  'demon-bomb',
] as const satisfies readonly BoneyardEnemyAction[]
const BONEYARD_ENEMY_COFFIN_STATES = [
  'hidden',
  'closed',
  'opening',
  'transition-delay',
  'open',
] as const satisfies readonly BoneyardEnemyCoffinState[]

export interface GameContentIdentity {
  id: string
  version: string
  contentSha256: string
}

export interface GameContentManifest {
  manifestSha256: string
  mods: readonly GameContentIdentity[]
}

export interface PlayerCharacterKernelParameters {
  fixedTickSeconds: number
  movementAcceleration: number
  movementLaneCap: number
  movementRetention: number
  movementThresholdSquared: number
  playerRadius: number
}

export type GameplayPauseSource = 'inventory' | 'pause-menu' | 'skill-book' | 'skill-selector'

export interface GameplayPauseState {
  ownerDisplayName: string
  ownerPlayerId: string
  source: GameplayPauseSource
}

export const GAMEPLAY_RESUME_GRACE_DURATION_MS = 2_000
export const GAMEPLAY_RESUME_GRACE_REASONS = [
  'game-rejoined',
  'game-restarted',
  'game-started',
  'inventory-closed',
  'pause-menu-closed',
  'skill-book-closed',
  'skill-picker-closed',
  'skill-selector-closed',
  'party-rejoin-wait',
] as const
export type GameplayResumeGraceReason = typeof GAMEPLAY_RESUME_GRACE_REASONS[number]

export interface GameplayResumeGraceState {
  readonly reason: GameplayResumeGraceReason
  readonly remainingMs: number | null
  readonly sequence: number
}

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

export const MOD_ACTIONS = ['portal-enter', 'reforge', 'scene-return', 'shop-buy', 'skill-choose'] as const
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
  | ClientReadyCollegeIntroMessage
  | ClientResumeGraceReadyMessage
  | ClientSaveBeforeLeaveMessage
  | ClientSnapshotAckMessage
  | ClientStartMatchMessage
  | ClientStartTutorialMessage
  | ClientTutorialActionMessage
  | ClientDisconnectMessage

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
  kernelVersion: string
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

export interface GameModAsset {
  byteLength: number
  contentType: string
  kind: string
  modId: string
  path: string
  sha256: string
}

export type GameSessionKind = 'global-hub' | 'private-college' | 'standalone'

export interface ServerModCatalogMessage {
  type: 'server-mod-catalog'
  items: readonly ModConsumableCatalogEntry[]
}

export const MOD_CONTENT_KINDS = [
  'affix',
  'affix-pool',
  'boneyard',
  'enemy',
  'item',
  'potion',
  'powerup',
  'room',
  'scene',
  'scene-extension',
  'shop',
  'skill',
  'spell',
  'status',
  'ui',
] as const
export type ModContentKind = typeof MOD_CONTENT_KINDS[number]

export interface ModContentProjectionEntry {
  readonly art: readonly Readonly<{
    path: string
    slot: string
  }>[]
  readonly contentId: string
  readonly contentKind: ModContentKind
  readonly description: string
  readonly key: string
  readonly modId: string
  readonly name: string
  readonly presentation: string | null
}

export interface ModStatusProjectionEntry {
  readonly contentId: string
  readonly expiresTick: number
  readonly instanceId: number
  readonly startedTick: number
  readonly targetId: string
}

export interface ModPowerupProjectionEntry {
  readonly contentId: string
  readonly id: number
  readonly spawnedTick: number
  readonly x: number
  readonly y: number
}

export interface ModContentProjection {
  readonly content: readonly ModContentProjectionEntry[]
  readonly manifestSha256: string
  readonly powerups: readonly ModPowerupProjectionEntry[]
  readonly revision: number
  readonly statuses: readonly ModStatusProjectionEntry[]
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

export interface LuaConsoleArray extends ReadonlyArray<LuaConsoleValue> {}

export interface LuaConsoleObject {
  readonly [key: string]: LuaConsoleValue
}

export type LuaConsoleValue =
  | null
  | boolean
  | number
  | string
  | LuaConsoleArray
  | LuaConsoleObject

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

export function encodeGameMessage(message: ClientGameMessage | ServerGameMessage): string {
  return JSON.stringify(message)
}

export function decodeClientGameMessage(payload: string): ClientGameMessage {
  const value = parseObject(payload)
  if (value.type === 'client-observer-hello') {
    onlyKeys(value, 'message', ['type', 'credential', 'protocolVersion'])
    return {
      type: 'client-observer-hello',
      credential: limitedString(value.credential, 'credential', 512),
      protocolVersion: integer(value.protocolVersion, 'protocolVersion'),
    }
  }
  if (value.type === 'client-hello') {
    onlyKeys(value, 'message', [
      'type',
      'allowModMismatch',
      'beginCollegeIntro',
      'cheatsEnabled',
      'declineTutorial',
      'onlinePreferences',
      'protocolVersion',
      'credential',
      'character',
      'profile',
      'resumeToken',
      'save',
      'saveIntent',
    ])
    if ((value.save === undefined) !== (value.saveIntent === undefined)) {
      throw new GameProtocolError('save and saveIntent must be supplied together')
    }
    return {
      type: 'client-hello',
      cheatsEnabled: boolean(value.cheatsEnabled, 'cheatsEnabled'),
      onlinePreferences: gameOnlinePreferences(value.onlinePreferences, 'onlinePreferences'),
      protocolVersion: integer(value.protocolVersion, 'protocolVersion'),
      credential: limitedString(value.credential, 'credential', 512),
      character: playerCharacterConfig(value.character, 'character'),
      profile: playerSocialProfile(value.profile, 'profile'),
      ...(value.beginCollegeIntro === undefined
        ? {}
        : { beginCollegeIntro: boolean(value.beginCollegeIntro, 'beginCollegeIntro') }),
      ...(value.declineTutorial === undefined
        ? {}
        : { declineTutorial: boolean(value.declineTutorial, 'declineTutorial') }),
      ...(value.allowModMismatch === undefined
        ? {}
        : { allowModMismatch: boolean(value.allowModMismatch, 'allowModMismatch') }),
      ...(value.resumeToken === undefined
        ? {}
        : { resumeToken: limitedString(value.resumeToken, 'resumeToken', 512) }),
      ...(value.save === undefined
        ? {}
        : {
            save: byteLimitedString(
              value.save,
              'save',
              MAX_WEB_GAME_SAVE_BYTES,
            ),
            saveIntent: memberString(
              value.saveIntent,
              'saveIntent',
              ['new-game', 'resume'] as const,
            ),
          }),
    }
  }
  if (value.type === 'client-input') {
    onlyKeys(value, 'message', ['type', 'input', 'sequence', 'targetTick'])
    return {
      type: 'client-input',
      input: playerCharacterInput(value.input, 'input'),
      sequence: nonnegativeInteger(value.sequence, 'sequence'),
      targetTick: nonnegativeInteger(value.targetTick, 'targetTick'),
    }
  }
  if (value.type === 'client-hub-action') {
    onlyKeys(value, 'message', ['type', 'action'])
    return { type: 'client-hub-action', action: hubInventoryAction(value.action) }
  }
  if (value.type === 'client-hub-activity') {
    onlyKeys(value, 'message', ['type', 'activity'])
    return {
      type: 'client-hub-activity',
      activity: value.activity === null
        ? null
        : hubPlayerActivity(value.activity, 'activity'),
    }
  }
  if (value.type === 'client-online-preferences') {
    onlyKeys(value, 'message', ['type', 'onlinePreferences'])
    return {
      type: 'client-online-preferences',
      onlinePreferences: gameOnlinePreferences(value.onlinePreferences, 'onlinePreferences'),
    }
  }
  if (value.type === 'client-chat') {
    onlyKeys(value, 'message', ['type', 'channel', 'targetPlayerReference', 'text'])
    const channel = gameChatChannel(value.channel, 'channel')
    if ((channel === 'whisper') !== (value.targetPlayerReference !== undefined)) {
      throw new GameProtocolError(
        'targetPlayerReference is required exactly when the channel is whisper',
      )
    }
    return {
      type: 'client-chat',
      channel,
      ...(value.targetPlayerReference === undefined
        ? {}
        : {
            targetPlayerReference: playerTarget(
              value.targetPlayerReference,
              'targetPlayerReference',
            ),
          }),
      text: gameChatText(value.text, 'text'),
    }
  }
  if (value.type === 'client-player-card-request') {
    onlyKeys(value, 'message', ['type', 'playerReference', 'requestId'])
    return {
      type: 'client-player-card-request',
      playerReference: playerReference(value.playerReference, 'playerReference'),
      requestId: luaRequestId(value.requestId),
    }
  }
  if (value.type === 'client-college-invite') {
    onlyKeys(value, 'message', ['type', 'playerReference'])
    return {
      type: 'client-college-invite',
      playerReference: playerReference(value.playerReference, 'playerReference'),
    }
  }
  if (value.type === 'client-college-invitation-dismiss') {
    onlyKeys(value, 'message', ['type', 'invitationId'])
    return {
      type: 'client-college-invitation-dismiss',
      invitationId: partyIdentifier(value.invitationId, 'invitationId'),
    }
  }
  if (value.type === 'client-party-invite') {
    onlyKeys(value, 'message', ['type', 'targetPlayerId'])
    return {
      type: 'client-party-invite',
      targetPlayerId: validatedPlayerId(value.targetPlayerId, 'targetPlayerId'),
    }
  }
  if (value.type === 'client-party-accept') {
    onlyKeys(value, 'message', ['type', 'invitationId'])
    return {
      type: 'client-party-accept',
      invitationId: partyIdentifier(value.invitationId, 'invitationId'),
    }
  }
  if (value.type === 'client-party-deny') {
    onlyKeys(value, 'message', ['type', 'invitationId'])
    return {
      type: 'client-party-deny',
      invitationId: partyIdentifier(value.invitationId, 'invitationId'),
    }
  }
  if (value.type === 'client-party-settings') {
    onlyKeys(value, 'message', ['type', 'visibility'])
    return {
      type: 'client-party-settings',
      visibility: partyVisibility(value.visibility, 'visibility'),
    }
  }
  if (value.type === 'client-party-rotate-code') {
    onlyKeys(value, 'message', ['type'])
    return { type: 'client-party-rotate-code' }
  }
  if (value.type === 'client-party-request-accept') {
    onlyKeys(value, 'message', ['type', 'requestId'])
    return {
      type: 'client-party-request-accept',
      requestId: partyIdentifier(value.requestId, 'requestId'),
    }
  }
  if (value.type === 'client-party-request-deny') {
    onlyKeys(value, 'message', ['type', 'requestId'])
    return {
      type: 'client-party-request-deny',
      requestId: partyIdentifier(value.requestId, 'requestId'),
    }
  }
  if (value.type === 'client-party-leave') {
    onlyKeys(value, 'message', ['type'])
    return { type: 'client-party-leave' }
  }
  if (value.type === 'client-party-kick') {
    onlyKeys(value, 'message', ['type', 'targetPlayerId'])
    return {
      type: 'client-party-kick',
      targetPlayerId: validatedPlayerId(value.targetPlayerId, 'targetPlayerId'),
    }
  }
  if (value.type === 'client-select-skill') {
    onlyKeys(value, 'message', ['type', 'choiceIndex', 'offerSequence', 'skillId'])
    const choiceIndex = nonnegativeInteger(value.choiceIndex, 'choiceIndex')
    const skillId = nonnegativeInteger(value.skillId, 'skillId')
    if (choiceIndex > 3) throw new GameProtocolError('choiceIndex is out of range')
    if (skillId < 8 || skillId > 79) throw new GameProtocolError('skillId is out of range')
    return {
      type: 'client-select-skill',
      choiceIndex,
      offerSequence: nonnegativeInteger(value.offerSequence, 'offerSequence'),
      skillId,
    }
  }
  if (value.type === 'client-skill-quickbar-bind') {
    onlyKeys(value, 'message', ['type', 'skillId', 'slot'])
    const skillId = value.skillId === null
      ? null
      : nonnegativeInteger(value.skillId, 'skillId')
    const slot = nonnegativeInteger(value.slot, 'slot')
    if (skillId !== null && !isNativeBeltSkill(skillId)) {
      throw new GameProtocolError('skillId is not a native quickbar skill')
    }
    if (slot > 7) throw new GameProtocolError('slot is out of range')
    return { type: 'client-skill-quickbar-bind', skillId, slot }
  }
  if (value.type === 'client-select-primary-skill') {
    onlyKeys(value, 'message', ['type', 'skillId'])
    const skillId = nonnegativeInteger(value.skillId, 'skillId')
    if (nativeSkillCategory(skillId) !== 1) {
      throw new GameProtocolError('skillId is not a native primary attack')
    }
    return { type: 'client-select-primary-skill', skillId }
  }
  if (value.type === 'client-select-concentration') {
    onlyKeys(value, 'message', ['type', 'skillId'])
    const skillId = nonnegativeInteger(value.skillId, 'skillId')
    if (nativeSkillCategory(skillId) !== 3) {
      throw new GameProtocolError('skillId is not a native concentration')
    }
    return { type: 'client-select-concentration', skillId }
  }
  if (value.type === 'client-select-concentration-slot') {
    onlyKeys(value, 'message', ['type', 'skillId', 'slot'])
    const skillId = nonnegativeInteger(value.skillId, 'skillId')
    const slot = nonnegativeInteger(value.slot, 'slot')
    if (nativeSkillCategory(skillId) !== 3) {
      throw new GameProtocolError('skillId is not a native concentration')
    }
    if (slot > 1) throw new GameProtocolError('concentration slot is out of range')
    return { type: 'client-select-concentration-slot', skillId, slot: slot as 0 | 1 }
  }
  if (value.type === 'client-level-up-action') {
    onlyKeys(value, 'message', ['type', 'action', 'offerSequence'])
    const action = limitedString(value.action, 'action', 16)
    if (action !== 'reroll' && action !== 'save') {
      throw new GameProtocolError('level-up action is not supported')
    }
    return {
      type: 'client-level-up-action',
      action,
      offerSequence: nonnegativeInteger(value.offerSequence, 'offerSequence'),
    }
  }
  if (value.type === 'client-ping') {
    onlyKeys(value, 'message', ['type', 'nonce'])
    return { type: 'client-ping', nonce: pingNonce(value.nonce) }
  }
  if (value.type === 'client-snapshot-ack') {
    onlyKeys(value, 'message', ['type', 'requireKeyframe', 'sequence'])
    return {
      type: 'client-snapshot-ack',
      requireKeyframe: boolean(value.requireKeyframe, 'requireKeyframe'),
      sequence: nonnegativeInteger(value.sequence, 'sequence'),
    }
  }
  if (value.type === 'client-start-match') {
    onlyKeys(value, 'message', ['type', 'boneyardId'])
    return {
      type: 'client-start-match',
      boneyardId: limitedString(value.boneyardId, 'boneyardId', 256),
    }
  }
  if (value.type === 'client-start-tutorial') {
    onlyKeys(value, 'message', ['type'])
    return { type: 'client-start-tutorial' }
  }
  if (value.type === 'client-ready-college-intro') {
    onlyKeys(value, 'message', ['type'])
    return { type: 'client-ready-college-intro' }
  }
  if (value.type === 'client-resume-grace-ready') {
    onlyKeys(value, 'message', ['type', 'sequence'])
    return {
      type: 'client-resume-grace-ready',
      sequence: positiveInteger(value.sequence, 'sequence'),
    }
  }
  if (value.type === 'client-tutorial-action') {
    onlyKeys(value, 'message', ['type', 'action'])
    return {
      type: 'client-tutorial-action',
      action: memberString(
        value.action,
        'action',
        NATIVE_TUTORIAL_SURFACE_ACTIONS,
      ),
    }
  }
  if (value.type === 'client-continue-game-over') {
    onlyKeys(value, 'message', ['type', 'eventId', 'runId'])
    return {
      type: 'client-continue-game-over',
      eventId: positiveInteger(value.eventId, 'eventId'),
      runId: limitedString(value.runId, 'runId', 128),
    }
  }
  if (value.type === 'client-confirm-loadout') {
    onlyKeys(value, 'message', ['type', 'discipline', 'displayName', 'element'])
    const discipline = limitedString(value.discipline, 'discipline', 32)
    const element = limitedString(value.element, 'element', 32)
    if (!isWizardDiscipline(discipline)) {
      throw new GameProtocolError('discipline is not supported')
    }
    if (!isWizardElement(element)) {
      throw new GameProtocolError('element is not supported')
    }
    return {
      type: 'client-confirm-loadout',
      discipline,
      displayName: limitedString(value.displayName, 'displayName', 64),
      element,
    }
  }
  if (value.type === 'client-gameplay-pause') {
    const paused = boolean(value.paused, 'paused')
    if (!paused) {
      onlyKeys(value, 'message', ['type', 'paused'])
      return { type: 'client-gameplay-pause', paused }
    }
    onlyKeys(value, 'message', ['type', 'paused', 'source'])
    return { type: 'client-gameplay-pause', paused, source: gameplayPauseSource(value.source) }
  }
  if (value.type === 'client-cheat-mode') {
    onlyKeys(value, 'message', ['type', 'enabled'])
    return {
      type: 'client-cheat-mode',
      enabled: boolean(value.enabled, 'enabled'),
    }
  }
  if (value.type === 'client-lua-execute') {
    onlyKeys(value, 'message', ['type', 'code', 'requestId'])
    const code = limitedString(value.code, 'code', MAX_LUA_CONSOLE_CODE_LENGTH)
    if (encodedByteLength(code) > MAX_LUA_CONSOLE_CODE_LENGTH) {
      throw new GameProtocolError(`code may contain at most ${MAX_LUA_CONSOLE_CODE_LENGTH} bytes`)
    }
    return {
      type: 'client-lua-execute',
      code,
      requestId: luaRequestId(value.requestId),
    }
  }
  if (value.type === 'client-mod-cast') {
    onlyKeys(value, 'message', ['type', 'contentId', 'requestId', 'targetX', 'targetY'])
    const contentId = limitedString(value.contentId, 'contentId', 19)
    if (!/^[1-9][0-9]{0,18}$/.test(contentId)) throw new GameProtocolError('contentId is invalid')
    return {
      type: 'client-mod-cast',
      contentId,
      requestId: luaRequestId(value.requestId),
      targetX: finite(value.targetX, 'targetX'),
      targetY: finite(value.targetY, 'targetY'),
    }
  }
  if (value.type === 'client-mod-action') {
    onlyKeys(value, 'message', ['type', 'action', 'arguments', 'requestId', 'target'])
    const action = limitedString(value.action, 'action', 32)
    const args = luaConsoleValue(value.arguments, 'arguments', { nodes: 0 }, 0)
    if (!(MOD_ACTIONS as readonly string[]).includes(action) || !args ||
        typeof args !== 'object' || Array.isArray(args)) {
      throw new GameProtocolError('mod action is invalid')
    }
    return {
      type: 'client-mod-action',
      action: action as ModAction,
      arguments: args as LuaConsoleObject,
      requestId: luaRequestId(value.requestId),
      target: limitedString(value.target, 'target', 256),
    }
  }
  if (value.type === 'client-disconnect') {
    onlyKeys(value, 'message', ['type'])
    return { type: 'client-disconnect' }
  }
  if (value.type === 'client-save-before-leave') {
    onlyKeys(value, 'message', ['type', 'requestId'])
    return {
      type: 'client-save-before-leave',
      requestId: luaRequestId(value.requestId),
    }
  }
  if (value.type === 'client-deployment-ready') {
    onlyKeys(value, 'message', ['type', 'checkpointSequence', 'targetRevision'])
    return {
      type: 'client-deployment-ready',
      checkpointSequence: nonnegativeInteger(
        value.checkpointSequence,
        'checkpointSequence',
      ),
      targetRevision: gitRevision(value.targetRevision, 'targetRevision'),
    }
  }
  throw new GameProtocolError('unknown client message type')
}

export function decodeServerGameMessage(payload: string): ServerGameMessage {
  const value = parseObject(payload)
  if (value.type === 'server-welcome') {
    onlyKeys(value, 'message', [
      'type',
      'cheatsEnabled',
      'developerAccess',
      'protocolVersion',
      'playerId',
      'resumeToken',
      'serverTickRate',
      'snapshotRate',
      'sessionKind',
      'kernelVersion',
      'kernelParameters',
      'content',
      'modAssets',
      'modCatalog',
      'boneyards',
      'gameplayPause',
      'gameplayResumeGrace',
      'observer',
      'snapshot',
      'snapshotSequence',
    ])
    const snapshot = gameSnapshot(value.snapshot)
    const gameplayPause = value.gameplayPause === null
      ? null
      : gameplayPauseState(value.gameplayPause, 'gameplayPause')
    const gameplayResumeGrace = value.gameplayResumeGrace === null
      ? null
      : gameplayResumeGraceState(value.gameplayResumeGrace, 'gameplayResumeGrace')
    if (gameplayPause && !snapshot.players[gameplayPause.ownerPlayerId]) {
      throw new GameProtocolError('gameplayPause owner is absent from the welcome snapshot')
    }
    return {
      type: 'server-welcome',
      cheatsEnabled: boolean(value.cheatsEnabled, 'cheatsEnabled'),
      developerAccess: boolean(value.developerAccess, 'developerAccess'),
      protocolVersion: integer(value.protocolVersion, 'protocolVersion'),
      playerId: validatedPlayerId(value.playerId, 'playerId'),
      resumeToken: limitedString(value.resumeToken, 'resumeToken', 512),
      serverTickRate: positiveFinite(value.serverTickRate, 'serverTickRate'),
      snapshotRate: positiveFinite(value.snapshotRate, 'snapshotRate'),
      sessionKind: gameSessionKind(value.sessionKind),
      kernelVersion: limitedString(value.kernelVersion, 'kernelVersion', 128),
      kernelParameters: playerCharacterKernelParameters(value.kernelParameters),
      content: contentManifest(value.content),
      modAssets: gameModAssets(value.modAssets),
      modCatalog: modConsumableCatalog(value.modCatalog, 'modCatalog'),
      boneyards: boneyardChoices(value.boneyards),
      gameplayPause,
      gameplayResumeGrace,
      ...(value.observer === undefined
        ? {}
        : { observer: boolean(value.observer, 'observer') }),
      snapshot,
      snapshotSequence: nonnegativeInteger(value.snapshotSequence, 'snapshotSequence'),
    }
  }
  if (value.type === 'server-mod-catalog') {
    onlyKeys(value, 'message', ['type', 'items'])
    return {
      type: 'server-mod-catalog',
      items: modConsumableCatalog(value.items, 'items'),
    }
  }
  if (value.type === 'server-mod-content') {
    onlyKeys(value, 'message', [
      'type', 'content', 'manifestSha256', 'powerups', 'revision', 'statuses',
    ])
    return { type: 'server-mod-content', ...modContentProjection(value) }
  }
  if (value.type === 'server-mod-runtime') {
    onlyKeys(value, 'message', ['type', 'projection', 'revision'])
    const projection = luaConsoleValue(value.projection, 'projection', { nodes: 0 }, 0)
    if (!projection || typeof projection !== 'object' || Array.isArray(projection)) {
      throw new GameProtocolError('mod runtime projection is invalid')
    }
    return {
      type: 'server-mod-runtime',
      projection: projection as LuaConsoleObject,
      revision: nonnegativeInteger(value.revision, 'revision'),
    }
  }
  if (value.type === 'server-snapshot') {
    onlyKeys(value, 'message', [
      'type',
      'acknowledgedInputSequence',
      'frame',
      'sequence',
    ])
    return {
      type: 'server-snapshot',
      acknowledgedInputSequence: nonnegativeInteger(
        value.acknowledgedInputSequence,
        'acknowledgedInputSequence',
      ),
      frame: gameSnapshotFrame(value.frame),
      sequence: nonnegativeInteger(value.sequence, 'sequence'),
    }
  }
  if (value.type === 'server-boneyard-loaded') {
    onlyKeys(value, 'message', ['type', 'boneyard'])
    return {
      type: 'server-boneyard-loaded',
      boneyard: loadedBoneyard(value.boneyard),
    }
  }
  if (value.type === 'server-save-checkpoint') {
    onlyKeys(value, 'message', ['type', 'save', 'reason', 'sequence'])
    const reason = memberString(
      value.reason,
      'reason',
      ['game-over', 'progress'] as const,
    )
    const save = byteLimitedString(value.save, 'save', MAX_WEB_GAME_SAVE_BYTES)
    return {
      type: 'server-save-checkpoint',
      save,
      reason,
      sequence: positiveInteger(value.sequence, 'sequence'),
    }
  }
  if (value.type === 'server-save-before-leave') {
    onlyKeys(value, 'message', ['type', 'checkpointSequence', 'requestId'])
    return {
      type: 'server-save-before-leave',
      checkpointSequence: nonnegativeInteger(
        value.checkpointSequence,
        'checkpointSequence',
      ),
      requestId: luaRequestId(value.requestId),
    }
  }
  if (value.type === 'server-deployment-restart') {
    onlyKeys(value, 'message', ['type', 'checkpointSequence', 'targetRevision'])
    return {
      type: 'server-deployment-restart',
      checkpointSequence: nonnegativeInteger(
        value.checkpointSequence,
        'checkpointSequence',
      ),
      targetRevision: gitRevision(value.targetRevision, 'targetRevision'),
    }
  }
  if (value.type === 'server-leaderboard-receipt') {
    onlyKeys(value, 'message', ['type', 'receipt'])
    return {
      type: 'server-leaderboard-receipt',
      receipt: byteLimitedString(
        value.receipt,
        'receipt',
        MAX_GAME_LEADERBOARD_RECEIPT_BYTES,
      ),
    }
  }
  if (value.type === 'server-pong') {
    onlyKeys(value, 'message', ['type', 'nonce'])
    return { type: 'server-pong', nonce: pingNonce(value.nonce) }
  }
  if (value.type === 'server-gameplay-pause') {
    onlyKeys(value, 'message', ['type', 'pause'])
    return {
      type: 'server-gameplay-pause',
      pause: value.pause === null ? null : gameplayPauseState(value.pause, 'pause'),
    }
  }
  if (value.type === 'server-gameplay-resume-grace') {
    onlyKeys(value, 'message', ['type', 'grace'])
    return {
      type: 'server-gameplay-resume-grace',
      grace: value.grace === null
        ? null
        : gameplayResumeGraceState(value.grace, 'grace'),
    }
  }
  if (value.type === 'server-party-state') {
    onlyKeys(value, 'message', ['type', 'state'])
    return { type: 'server-party-state', state: localPartyState(value.state) }
  }
  if (value.type === 'server-party-action') {
    onlyKeys(value, 'message', ['type', 'action', 'ok', 'reason'])
    const ok = boolean(value.ok, 'ok')
    const reason = value.reason === null
      ? null
      : memberString(value.reason, 'reason', PARTY_ACTION_REJECTIONS)
    if (ok !== (reason === null)) {
      throw new GameProtocolError('party action ok and reason fields are inconsistent')
    }
    return {
      type: 'server-party-action',
      action: memberString(value.action, 'action', PARTY_ACTIONS),
      ok,
      reason,
    }
  }
  if (value.type === 'server-cheat-mode') {
    onlyKeys(value, 'message', ['type', 'enabled'])
    return {
      type: 'server-cheat-mode',
      enabled: boolean(value.enabled, 'enabled'),
    }
  }
  if (value.type === 'server-player-card') {
    onlyKeys(value, 'message', ['type', 'profile', 'requestId'])
    return {
      type: 'server-player-card',
      profile: value.profile === null
        ? null
        : gamePlayerCardProfile(value.profile, 'profile'),
      requestId: luaRequestId(value.requestId),
    }
  }
  if (value.type === 'server-college-invitations') {
    onlyKeys(value, 'message', ['type', 'invitations'])
    return {
      type: 'server-college-invitations',
      invitations: gameCollegeInvitations(value.invitations),
    }
  }
  if (value.type === 'server-chat') {
    onlyKeys(value, 'message', [
      'type', 'activity', 'channel', 'recipient', 'sender', 'sequence', 'text',
    ])
    const channel = gameChatChannel(value.channel, 'channel')
    if ((channel === 'whisper') !== (value.recipient !== undefined)) {
      throw new GameProtocolError(
        'recipient is required exactly when the channel is whisper',
      )
    }
    const sender = gameChatSender(value.sender, 'sender')
    const activity = value.activity === undefined
      ? undefined
      : memberString(value.activity, 'activity', GAME_CHAT_ACTIVITIES)
    if (activity !== undefined && channel !== 'global') {
      throw new GameProtocolError('activity messages require the global channel')
    }
    const text = activity === undefined
      ? gameChatText(value.text, 'text')
      : limitedString(value.text, 'text', GAME_CHAT_MAX_TEXT_CODE_UNITS)
    if (activity !== undefined && text !== gameChatActivityText(activity, sender.displayName)) {
      throw new GameProtocolError('activity text does not match its host-authored event')
    }
    return {
      type: 'server-chat',
      ...(activity === undefined ? {} : { activity }),
      channel,
      ...(value.recipient === undefined
        ? {}
        : { recipient: gameChatSender(value.recipient, 'recipient') }),
      sender,
      sequence: positiveInteger(value.sequence, 'sequence'),
      text,
    }
  }
  if (value.type === 'server-chat-rejected') {
    onlyKeys(value, 'message', ['type', 'channel', 'reason', 'retryAfterMs'])
    return {
      type: 'server-chat-rejected',
      channel: gameChatChannel(value.channel, 'channel'),
      reason: gameChatRejectionReason(value.reason),
      retryAfterMs: integerWithin(value.retryAfterMs, 'retryAfterMs', 0, 60_000),
    }
  }
  if (value.type === 'server-lua-result') {
    onlyKeys(value, 'message', [
      'type',
      'error',
      'ok',
      'output',
      'requestId',
      'values',
    ])
    const budget = { nodes: 0 }
    const ok = boolean(value.ok, 'ok')
    const error = value.error === null
      ? null
      : byteLimitedString(value.error, 'error', MAX_LUA_CONSOLE_OUTPUT_LINE_LENGTH)
    if (ok !== (error === null)) {
      throw new GameProtocolError('Lua result ok and error fields are inconsistent')
    }
    const output = limitedArray(
      value.output,
      'output',
      MAX_LUA_CONSOLE_OUTPUT_LINES,
    ).map((line, index) => boundedString(
      line,
      `output[${index}]`,
      MAX_LUA_CONSOLE_OUTPUT_LINE_LENGTH,
    ))
    if (encodedByteLength(output) > MAX_LUA_CONSOLE_OUTPUT_BYTES) {
      throw new GameProtocolError('Lua result output exceeds its byte limit')
    }
    const values = limitedArray(
      value.values,
      'values',
      MAX_LUA_CONSOLE_RETURN_VALUES,
    ).map((entry, index) => luaConsoleValue(
      entry,
      `values[${index}]`,
      budget,
      0,
    ))
    if (encodedByteLength(values) > MAX_LUA_CONSOLE_RETURN_BYTES) {
      throw new GameProtocolError('Lua result values exceed their byte limit')
    }
    return {
      type: 'server-lua-result',
      error,
      ok,
      output,
      requestId: luaRequestId(value.requestId),
      values,
    }
  }
  if (value.type === 'server-disconnect') {
    onlyKeys(value, 'message', ['type', 'code', 'reason'])
    const code = limitedString(value.code, 'code', 64)
    if (![
      'authentication-failed',
      'invalid-message',
      'protocol-mismatch',
      'server-full',
    ].includes(code)) throw new GameProtocolError('invalid disconnect code')
    return {
      type: 'server-disconnect',
      code: code as GameDisconnectCode,
      reason: limitedString(value.reason, 'reason', 512),
    }
  }
  throw new GameProtocolError('unknown server message type')
}

export class GameProtocolError extends Error {
  override name = 'GameProtocolError'
}

function luaConsoleValue(
  value: unknown,
  field: string,
  budget: { nodes: number },
  depth: number,
): LuaConsoleValue {
  budget.nodes += 1
  if (budget.nodes > MAX_LUA_CONSOLE_VALUE_NODES) {
    throw new GameProtocolError(`${field} exceeds the Lua value node limit`)
  }
  if (depth > MAX_LUA_CONSOLE_VALUE_DEPTH) {
    throw new GameProtocolError(`${field} exceeds the Lua value depth limit`)
  }
  if (value === null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return finite(value, field)
  if (typeof value === 'string') {
    return boundedString(value, field, MAX_LUA_CONSOLE_VALUE_STRING_LENGTH)
  }
  if (Array.isArray(value)) {
    return limitedArray(value, field, MAX_LUA_CONSOLE_VALUE_FIELDS).map(
      (entry, index) => luaConsoleValue(entry, `${field}[${index}]`, budget, depth + 1),
    )
  }
  const source = record(value, field)
  const entries = Object.entries(source)
  if (entries.length > MAX_LUA_CONSOLE_VALUE_FIELDS) {
    throw new GameProtocolError(`${field} has too many Lua value fields`)
  }
  return Object.fromEntries(entries.map(([key, entry]) => [
    byteLimitedString(key, `${field} key`, 128),
    luaConsoleValue(entry, `${field}.${key}`, budget, depth + 1),
  ]))
}

function parseObject(payload: string): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(payload)
  } catch {
    throw new GameProtocolError('message is not valid JSON')
  }
  return record(value, 'message')
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GameProtocolError(`${field} must be an object`)
  }
  return value as Record<string, unknown>
}

function onlyKeys(
  value: Record<string, unknown>,
  field: string,
  allowed: readonly string[],
): void {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key))
  if (unexpected) throw new GameProtocolError(`${field}.${unexpected} is not allowed`)
}

function array(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new GameProtocolError(`${field} must be an array`)
  return value
}

function limitedArray(value: unknown, field: string, maximum: number): readonly unknown[] {
  const result = array(value, field)
  if (result.length > maximum) {
    throw new GameProtocolError(`${field} may contain at most ${maximum} entries`)
  }
  return result
}

function finite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new GameProtocolError(`${field} must be finite`)
  }
  return value
}

function positiveFinite(value: unknown, field: string): number {
  const result = finite(value, field)
  if (result <= 0) throw new GameProtocolError(`${field} must be positive`)
  return result
}

function nonnegativeFinite(value: unknown, field: string): number {
  const result = finite(value, field)
  if (result < 0) throw new GameProtocolError(`${field} must be nonnegative`)
  return result
}

function unitInterval(value: unknown, field: string): number {
  const result = finite(value, field)
  if (result < 0 || result > 1) {
    throw new GameProtocolError(`${field} must be between zero and one`)
  }
  return result
}

function integer(value: unknown, field: string): number {
  const result = finite(value, field)
  if (!Number.isInteger(result)) throw new GameProtocolError(`${field} must be an integer`)
  return result
}

function integerWithin(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  const result = integer(value, field)
  if (result < minimum || result > maximum) {
    throw new GameProtocolError(`${field} must be within [${minimum},${maximum}]`)
  }
  return result
}

function nonnegativeInteger(value: unknown, field: string): number {
  const result = integer(value, field)
  if (result < 0) throw new GameProtocolError(`${field} must be nonnegative`)
  return result
}

function positiveInteger(value: unknown, field: string): number {
  const result = integer(value, field)
  if (result < 1) throw new GameProtocolError(`${field} must be positive`)
  return result
}

function boundedInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  const result = integer(value, field)
  if (result < minimum || result > maximum) {
    throw new GameProtocolError(`${field} is outside [${minimum},${maximum}]`)
  }
  return result
}

function pingNonce(value: unknown): number {
  const result = positiveInteger(value, 'nonce')
  if (result > 0x7fffffff) throw new GameProtocolError('nonce is out of range')
  return result
}

function luaRequestId(value: unknown): number {
  const result = positiveInteger(value, 'requestId')
  if (result > 0x7fffffff) throw new GameProtocolError('requestId is out of range')
  return result
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new GameProtocolError(`${field} must be boolean`)
  return value
}

function skillQuickbarSlot(value: unknown, field: string): number | null {
  if (value === null) return null
  const slot = integer(value, field)
  if (slot < 0 || slot > 7) {
    throw new GameProtocolError(`${field} must be null or an integer from 0 through 7`)
  }
  return slot
}

function limitedString(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new GameProtocolError(
      `${field} must be a nonempty string of at most ${maximum} characters`,
    )
  }
  return value
}

function boundedString(value: unknown, field: string, maximumBytes: number): string {
  if (typeof value !== 'string' || luaTextEncoder.encode(value).byteLength > maximumBytes) {
    throw new GameProtocolError(`${field} must be a string of at most ${maximumBytes} bytes`)
  }
  return value
}

function byteLimitedString(value: unknown, field: string, maximumBytes: number): string {
  const result = limitedString(value, field, maximumBytes)
  if (luaTextEncoder.encode(result).byteLength > maximumBytes) {
    throw new GameProtocolError(`${field} may contain at most ${maximumBytes} bytes`)
  }
  return result
}

function encodedByteLength(value: unknown): number {
  return luaTextEncoder.encode(JSON.stringify(value)).byteLength
}

function memberString<const T extends readonly string[]>(
  value: unknown,
  field: string,
  members: T,
): T[number] {
  const result = limitedString(value, field, 64)
  if (!(members as readonly string[]).includes(result)) {
    throw new GameProtocolError(`${field} is not supported`)
  }
  return result as T[number]
}

function validatedPlayerId(value: unknown, field: string): string {
  const result = limitedString(value, field, 128)
  if (Object.hasOwn(Object.prototype, result)) {
    throw new GameProtocolError(`${field} is reserved`)
  }
  return result
}

function playerReference(value: unknown, field: string): string {
  const result = limitedString(value, field, 43)
  if (!/^player-ref-[A-Za-z0-9_-]{32}$/.test(result)) {
    throw new GameProtocolError(`${field} is not a server-issued player reference`)
  }
  return result
}

function playerTarget(value: unknown, field: string): string {
  const result = validatedPlayerId(value, field)
  if (result.startsWith('player-ref-') && !isPlayerReference(result)) {
    throw new GameProtocolError(`${field} contains an invalid player reference`)
  }
  return result
}

function isPlayerReference(value: string): boolean {
  return /^player-ref-[A-Za-z0-9_-]{32}$/.test(value)
}

function partyIdentifier(value: unknown, field: string): string {
  const result = limitedString(value, field, 64)
  if (!/^[A-Za-z0-9_-]+$/.test(result)) {
    throw new GameProtocolError(`${field} must contain only identifier characters`)
  }
  return result
}

function partyJoinCode(value: unknown, field: string): string {
  const result = limitedString(value, field, 9)
  if (!/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(result)) {
    throw new GameProtocolError(`${field} must be a formatted Party ID`)
  }
  return result
}

function partyVisibility(value: unknown, field: string): PartyVisibility {
  return memberString(value, field, PARTY_VISIBILITIES)
}

function gameSessionKind(value: unknown): GameSessionKind {
  return memberString(
    value,
    'sessionKind',
    ['global-hub', 'private-college', 'standalone'] as const,
  )
}

function partyPlayerProfile(value: unknown, field: string): PartyPlayerProfile {
  const source = record(value, field)
  onlyKeys(source, field, [
    'accountUsername',
    'displayName',
    'highestWave',
    'playerId',
    'totalPlaytimeMs',
  ])
  return {
    ...playerSocialProfile(
      {
        accountUsername: source.accountUsername,
        highestWave: source.highestWave,
        totalPlaytimeMs: source.totalPlaytimeMs,
      },
      field,
    ),
    displayName: limitedString(source.displayName, `${field}.displayName`, 64),
    playerId: validatedPlayerId(source.playerId, `${field}.playerId`),
  }
}

function partyRosterPlayer(value: unknown, field: string): PartyRosterPlayer {
  const source = record(value, field)
  onlyKeys(source, field, [
    'connected',
    'currentHealth',
    'displayName',
    'element',
    'lifeState',
    'maximumHealth',
    'playerId',
  ])
  const element = limitedString(source.element, `${field}.element`, 32)
  if (!isWizardElement(element)) {
    throw new GameProtocolError(`${field}.element is not supported`)
  }
  const lifeState = limitedString(source.lifeState, `${field}.lifeState`, 32)
  if (!(PLAYER_LIFE_STATES as readonly string[]).includes(lifeState)) {
    throw new GameProtocolError(`${field}.lifeState is not supported`)
  }
  return {
    connected: boolean(source.connected, `${field}.connected`),
    currentHealth: finite(source.currentHealth, `${field}.currentHealth`),
    displayName: limitedString(source.displayName, `${field}.displayName`, 64),
    element,
    lifeState: lifeState as PlayerLifeState,
    maximumHealth: positiveFinite(source.maximumHealth, `${field}.maximumHealth`),
    playerId: validatedPlayerId(source.playerId, `${field}.playerId`),
  }
}

function playerSocialProfile(value: unknown, field: string): PlayerSocialProfile {
  const source = record(value, field)
  onlyKeys(source, field, ['accountUsername', 'highestWave', 'totalPlaytimeMs'])
  return {
    accountUsername: source.accountUsername === null
      ? null
      : limitedString(source.accountUsername, `${field}.accountUsername`, 64),
    highestWave: source.highestWave === null
      ? null
      : integerWithin(source.highestWave, `${field}.highestWave`, 1, 1_000_000),
    totalPlaytimeMs: source.totalPlaytimeMs === null
      ? null
      : integerWithin(source.totalPlaytimeMs, `${field}.totalPlaytimeMs`, 0, 10_000_000_000_000),
  }
}

function gameChatChannel(value: unknown, field: string): GameChatChannel {
  return memberString(value, field, ['boneyard', 'global', 'party', 'whisper'] as const)
}

function gameOnlinePreferences(value: unknown, field: string): GameOnlinePreferences {
  const source = record(value, field)
  onlyKeys(source, field, ['activityMessages', 'globalChat', 'submitRuns'])
  const globalChat = boolean(source.globalChat, `${field}.globalChat`)
  const activityMessages = boolean(source.activityMessages, `${field}.activityMessages`)
  if (activityMessages && !globalChat) {
    throw new GameProtocolError(`${field}.activityMessages requires globalChat`)
  }
  return {
    activityMessages,
    globalChat,
    submitRuns: boolean(source.submitRuns, `${field}.submitRuns`),
  }
}

function gameChatText(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new GameProtocolError(`${field} must be a string`)
  let result: string
  try {
    result = normalizeGameChatText(value)
  } catch (error) {
    throw new GameProtocolError(error instanceof Error ? error.message : `${field} is invalid`)
  }
  if (result !== value) {
    throw new GameProtocolError(`${field} must not begin or end with whitespace`)
  }
  return result
}

function gameChatSender(value: unknown, field: string): GameChatSender {
  const source = record(value, field)
  onlyKeys(source, field, ['displayName', 'playerId', 'playerReference'])
  return {
    displayName: limitedString(source.displayName, `${field}.displayName`, 64),
    playerId: validatedPlayerId(source.playerId, `${field}.playerId`),
    playerReference: playerReference(
      source.playerReference,
      `${field}.playerReference`,
    ),
  }
}

function gamePlayerCardProfile(value: unknown, field: string): GamePlayerCardProfile {
  const source = record(value, field)
  onlyKeys(source, field, [
    'accountUsername',
    'activity',
    'discipline',
    'displayName',
    'element',
    'gold',
    'highestWave',
    'playerReference',
    'sessionKind',
    'totalPlaytimeMs',
  ])
  const discipline = limitedString(source.discipline, `${field}.discipline`, 32)
  if (!isWizardDiscipline(discipline)) {
    throw new GameProtocolError(`${field}.discipline is not supported`)
  }
  const element = limitedString(source.element, `${field}.element`, 32)
  if (!isWizardElement(element)) {
    throw new GameProtocolError(`${field}.element is not supported`)
  }
  return {
    accountUsername: source.accountUsername === null
      ? null
      : limitedString(source.accountUsername, `${field}.accountUsername`, 64),
    activity: memberString(
      source.activity,
      `${field}.activity`,
      ['boneyard', 'hub'] as const,
    ),
    discipline,
    displayName: limitedString(source.displayName, `${field}.displayName`, 64),
    element,
    gold: nonnegativeInteger(source.gold, `${field}.gold`),
    highestWave: source.highestWave === null
      ? null
      : integerWithin(source.highestWave, `${field}.highestWave`, 1, 1_000_000),
    playerReference: playerReference(
      source.playerReference,
      `${field}.playerReference`,
    ),
    sessionKind: memberString(
      source.sessionKind,
      `${field}.sessionKind`,
      ['global-hub', 'private-college', 'standalone'] as const,
    ),
    totalPlaytimeMs: source.totalPlaytimeMs === null
      ? null
      : integerWithin(
          source.totalPlaytimeMs,
          `${field}.totalPlaytimeMs`,
          0,
          10_000_000_000_000,
        ),
  }
}

function gameCollegeInvitations(value: unknown): readonly GameCollegeInvitation[] {
  const invitations = limitedArray(
    value,
    'invitations',
    MAX_GAME_COLLEGE_INVITATIONS,
  ).map((entry, index) => gameCollegeInvitation(entry, `invitations[${index}]`))
  if (new Set(invitations.map(({ id }) => id)).size !== invitations.length) {
    throw new GameProtocolError('invitations contains a duplicate id')
  }
  return invitations
}

function gameCollegeInvitation(value: unknown, field: string): GameCollegeInvitation {
  const source = record(value, field)
  onlyKeys(source, field, ['expiresAtUnixMs', 'id', 'inviter', 'joinCode'])
  return {
    expiresAtUnixMs: integerWithin(
      source.expiresAtUnixMs,
      `${field}.expiresAtUnixMs`,
      1,
      10_000_000_000_000,
    ),
    id: partyIdentifier(source.id, `${field}.id`),
    inviter: gameChatSender(source.inviter, `${field}.inviter`),
    joinCode: partyJoinCode(source.joinCode, `${field}.joinCode`),
  }
}

function gameChatRejectionReason(value: unknown): GameChatRejectionReason {
  return memberString(
    value,
    'reason',
    ['channel-unavailable', 'rate-limited', 'target-unavailable'] as const,
  )
}

function localPartyState(value: unknown): LocalPartyState {
  const source = record(value, 'state')
  onlyKeys(source, 'state', [
    'hubPlayers', 'invitations', 'joinRequests', 'party', 'partyRoster', 'revision',
  ])
  const hubPlayers = limitedArray(source.hubPlayers, 'state.hubPlayers', 64)
    .map((entry, index) => partyPlayerProfile(entry, `state.hubPlayers[${index}]`))
  const hubPlayerIds = new Set(hubPlayers.map(({ playerId }) => playerId))
  if (hubPlayerIds.size !== hubPlayers.length) {
    throw new GameProtocolError('state.hubPlayers contains a duplicate player id')
  }
  const party = record(source.party, 'state.party')
  onlyKeys(party, 'state.party', [
    'id',
    'joinCode',
    'leaderPlayerId',
    'listingId',
    'memberPlayerIds',
    'visibility',
  ])
  const memberPlayerIds = limitedArray(
    party.memberPlayerIds,
    'state.party.memberPlayerIds',
    64,
  ).map((entry, index) => validatedPlayerId(
    entry,
    `state.party.memberPlayerIds[${index}]`,
  ))
  if (memberPlayerIds.length === 0) {
    throw new GameProtocolError('state.party.memberPlayerIds must not be empty')
  }
  if (new Set(memberPlayerIds).size !== memberPlayerIds.length) {
    throw new GameProtocolError('state.party.memberPlayerIds contains a duplicate player id')
  }
  const leaderPlayerId = validatedPlayerId(
    party.leaderPlayerId,
    'state.party.leaderPlayerId',
  )
  if (!memberPlayerIds.includes(leaderPlayerId)) {
    throw new GameProtocolError('state.party leader is not a party member')
  }
  const partyRoster = limitedArray(source.partyRoster, 'state.partyRoster', 64)
    .map((entry, index) => partyRosterPlayer(entry, `state.partyRoster[${index}]`))
  const partyRosterIds = partyRoster.map(({ playerId }) => playerId)
  if (new Set(partyRosterIds).size !== partyRosterIds.length) {
    throw new GameProtocolError('state.partyRoster contains a duplicate player id')
  }
  if (
    partyRosterIds.length !== memberPlayerIds.length
    || partyRosterIds.some((id, index) => id !== memberPlayerIds[index])
  ) throw new GameProtocolError('state.partyRoster must match party member order')
  const invitations = limitedArray(source.invitations, 'state.invitations', 64)
    .map((entry, index) => {
      const field = `state.invitations[${index}]`
      const invitation = record(entry, field)
      onlyKeys(invitation, field, ['id', 'inviter', 'partyId'])
      const inviter = partyPlayerProfile(invitation.inviter, `${field}.inviter`)
      if (!hubPlayerIds.has(inviter.playerId)) {
        throw new GameProtocolError(`${field}.inviter is not a Hub player`)
      }
      return {
        id: partyIdentifier(invitation.id, `${field}.id`),
        inviter,
        partyId: partyIdentifier(invitation.partyId, `${field}.partyId`),
      }
    })
  if (new Set(invitations.map(({ id }) => id)).size !== invitations.length) {
    throw new GameProtocolError('state.invitations contains a duplicate invitation id')
  }
  const joinRequests = limitedArray(source.joinRequests, 'state.joinRequests', 16)
    .map((entry, index) => {
      const field = `state.joinRequests[${index}]`
      const request = record(entry, field)
      onlyKeys(request, field, ['id', 'requester'])
      const requesterSource = record(request.requester, `${field}.requester`)
      onlyKeys(requesterSource, `${field}.requester`, [
        'accountUsername',
        'displayName',
        'requesterId',
      ])
      const requester: PartyJoinRequester = {
        accountUsername: requesterSource.accountUsername === null
          ? null
          : limitedString(
              requesterSource.accountUsername,
              `${field}.requester.accountUsername`,
              64,
            ),
        displayName: limitedString(
          requesterSource.displayName,
          `${field}.requester.displayName`,
          64,
        ),
        requesterId: partyIdentifier(
          requesterSource.requesterId,
          `${field}.requester.requesterId`,
        ),
      }
      return {
        id: partyIdentifier(request.id, `${field}.id`),
        requester,
      }
    })
  if (new Set(joinRequests.map(({ id }) => id)).size !== joinRequests.length) {
    throw new GameProtocolError('state.joinRequests contains a duplicate request id')
  }
  return {
    hubPlayers,
    invitations,
    joinRequests,
    party: {
      id: partyIdentifier(party.id, 'state.party.id'),
      joinCode: partyJoinCode(party.joinCode, 'state.party.joinCode'),
      leaderPlayerId,
      listingId: partyIdentifier(party.listingId, 'state.party.listingId'),
      memberPlayerIds,
      visibility: partyVisibility(party.visibility, 'state.party.visibility'),
    },
    partyRoster,
    revision: nonnegativeInteger(source.revision, 'state.revision'),
  }
}

function sha256(value: unknown, field: string): string {
  const result = limitedString(value, field, 64).toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(result)) {
    throw new GameProtocolError(`${field} must be SHA-256 hex`)
  }
  return result
}

function gitRevision(value: unknown, field: string): string {
  const result = limitedString(value, field, 40).toLowerCase()
  if (!/^[0-9a-f]{40}$/.test(result)) {
    throw new GameProtocolError(`${field} must be a full Git revision`)
  }
  return result
}

function playerCharacterInput(value: unknown, field: string): PlayerCharacterInput {
  const source = record(value, field)
  onlyKeys(source, field, ['aim', 'cast', 'movement', 'viewportHeight', 'viewportWidth'])
  const cast = record(source.cast, `${field}.cast`)
  onlyKeys(cast, `${field}.cast`, ['primary', 'quickbar'])
  const viewportHeight = finite(source.viewportHeight, `${field}.viewportHeight`)
  const viewportWidth = finite(source.viewportWidth, `${field}.viewportWidth`)
  if (
    viewportHeight < 1 || viewportHeight > 32_768
    || viewportWidth < 1 || viewportWidth > 32_768
  ) {
    throw new GameProtocolError(`${field}.viewportHeight/viewportWidth is outside range`)
  }
  return {
    aim: source.aim === null ? null : vector(source.aim, `${field}.aim`),
    cast: {
      primary: boolean(cast.primary, `${field}.cast.primary`),
      quickbar: skillQuickbarSlot(cast.quickbar, `${field}.cast.quickbar`),
    },
    movement: unitVector(source.movement, `${field}.movement`),
    viewportHeight,
    viewportWidth,
  }
}

function unitVector(value: unknown, field: string): Vector2 {
  const result = vector(value, field)
  if (Math.hypot(result.x, result.y) > 1.001) {
    throw new GameProtocolError(`${field} magnitude exceeds one`)
  }
  return result
}

function vector(value: unknown, field: string): Vector2 {
  const source = record(value, field)
  onlyKeys(source, field, ['x', 'y'])
  return {
    x: finite(source.x, `${field}.x`),
    y: finite(source.y, `${field}.y`),
  }
}

function nativeLightProviderRegistration(
  value: unknown,
  field: string,
  expectedLane: NativeLightManagerLane,
): NativeLightProviderRegistration {
  const source = record(value, field)
  onlyKeys(source, field, ['managerLane', 'registrationOrdinal'])
  const managerLane = limitedString(source.managerLane, `${field}.managerLane`, 16)
  if (!(NATIVE_LIGHT_MANAGER_LANES as readonly string[]).includes(managerLane)) {
    throw new GameProtocolError(`${field}.managerLane is not supported`)
  }
  if (managerLane !== expectedLane) {
    throw new GameProtocolError(`${field}.managerLane must be ${expectedLane}`)
  }
  return {
    managerLane: managerLane as NativeLightManagerLane,
    registrationOrdinal: nonnegativeInteger(
      source.registrationOrdinal,
      `${field}.registrationOrdinal`,
    ),
  }
}

function absentNativeLightProviderRegistration(value: unknown, field: string): null {
  if (value !== null) throw new GameProtocolError(`${field} must be null`)
  return null
}

function absentNativeActorLight(source: Record<string, unknown>, field: string): null {
  return absentNativeLightProviderRegistration(
    source.lightRegistration,
    `${field}.lightRegistration`,
  )
}

function nullableNativeLightProviderRegistration(
  value: unknown,
  field: string,
  expectedLane: NativeLightManagerLane,
): NativeLightProviderRegistration | null {
  return value === null
    ? null
    : nativeLightProviderRegistration(value, field, expectedLane)
}

function playerCharacterConfig(value: unknown, field: string): PlayerCharacterConfig {
  const source = record(value, field)
  onlyKeys(source, field, ['discipline', 'displayName', 'element'])
  const discipline = limitedString(source.discipline, `${field}.discipline`, 32)
  if (!isWizardDiscipline(discipline)) {
    throw new GameProtocolError(`${field}.discipline is not supported`)
  }
  const element = limitedString(source.element, `${field}.element`, 32)
  if (!isWizardElement(element)) {
    throw new GameProtocolError(`${field}.element is not supported`)
  }
  return {
    discipline,
    displayName: limitedString(source.displayName, `${field}.displayName`, 64),
    element,
  }
}

function gameplayPauseState(value: unknown, field: string): GameplayPauseState {
  const source = record(value, field)
  onlyKeys(source, field, ['ownerDisplayName', 'ownerPlayerId', 'source'])
  return {
    ownerDisplayName: limitedString(source.ownerDisplayName, `${field}.ownerDisplayName`, 64),
    ownerPlayerId: validatedPlayerId(source.ownerPlayerId, `${field}.ownerPlayerId`),
    source: gameplayPauseSource(source.source),
  }
}

function gameplayResumeGraceState(
  value: unknown,
  field: string,
): GameplayResumeGraceState {
  const source = record(value, field)
  onlyKeys(source, field, ['reason', 'remainingMs', 'sequence'])
  const remainingMs = source.remainingMs === null
    ? null
    : positiveInteger(source.remainingMs, `${field}.remainingMs`)
  if (remainingMs !== null && remainingMs > GAMEPLAY_RESUME_GRACE_DURATION_MS) {
    throw new GameProtocolError(
      `${field}.remainingMs exceeds the resume grace duration`,
    )
  }
  return {
    reason: memberString(
      source.reason,
      `${field}.reason`,
      GAMEPLAY_RESUME_GRACE_REASONS,
    ),
    remainingMs,
    sequence: positiveInteger(source.sequence, `${field}.sequence`),
  }
}

function gameplayPauseSource(value: unknown): GameplayPauseSource {
  if (
    value === 'inventory'
    || value === 'pause-menu'
    || value === 'skill-book'
    || value === 'skill-selector'
  ) return value
  throw new GameProtocolError('gameplay pause source is not supported')
}

function hubInventoryAction(value: unknown): HubInventoryAction {
  const source = record(value, 'action')
  const type = limitedString(source.type, 'action.type', 64)
  if (type === 'acknowledge-college-intro-dialogue') {
    onlyKeys(source, 'action', ['type'])
    return { type }
  }
  if (type === 'acknowledge-npc-hint') {
    onlyKeys(source, 'action', ['type', 'interactionId'])
    const interactionId = limitedString(source.interactionId, 'action.interactionId', 32)
    if (
      interactionId !== 'annalist'
      && interactionId !== 'fomentius'
      && interactionId !== 'luthacus'
    ) throw new GameProtocolError('action.interactionId has no native profile hint')
    return { type, interactionId }
  }
  if (type === 'buy-dowsing') {
    onlyKeys(source, 'action', ['type', 'offerId'])
    return { type, offerId: positiveInteger(source.offerId, 'action.offerId') }
  }
  if (type === 'buy-fomentius') {
    onlyKeys(source, 'action', ['type', 'itemId'])
    return { type, itemId: positiveInteger(source.itemId, 'action.itemId') }
  }
  if (type === 'buy-hagatha') {
    onlyKeys(source, 'action', ['type', 'selector'])
    const selector = integer(source.selector, 'action.selector')
    if (selector < -1 || selector > 27 || selector === 8) {
      throw new GameProtocolError('action.selector is unavailable')
    }
    return { type, selector }
  }
  if (type === 'buy-teacher-spell') {
    onlyKeys(source, 'action', ['type', 'skillId'])
    return { type, skillId: integerWithin(source.skillId, 'action.skillId', 72, 79) }
  }
  if (type === 'activate-belt-slot') {
    onlyKeys(source, 'action', ['type', 'slot'])
    return { type, slot: integerWithin(source.slot, 'action.slot', 0, 7) }
  }
  if (type === 'bind-belt-item') {
    onlyKeys(source, 'action', ['type', 'itemId', 'slot'])
    return {
      type,
      itemId: positiveInteger(source.itemId, 'action.itemId'),
      slot: integerWithin(source.slot, 'action.slot', 0, 7),
    }
  }
  if (type === 'read-librarian-book') {
    onlyKeys(source, 'action', ['type', 'bookId'])
    return { type, bookId: integerWithin(source.bookId, 'action.bookId', 0, 25) }
  }
  if (type === 'select-boast') {
    onlyKeys(source, 'action', ['type', 'boastId'])
    return { type, boastId: integerWithin(source.boastId, 'action.boastId', 0, 4) }
  }
  if (type === 'close-dowsing' || type === 'dowse' || type === 'interact-goodie') {
    onlyKeys(source, 'action', ['type'])
    return { type }
  }
  if (type === 'consume' || type === 'read-skill-book') {
    onlyKeys(source, 'action', ['type', 'itemId'])
    return { type, itemId: positiveInteger(source.itemId, 'action.itemId') }
  }
  if (type === 'dye') {
    onlyKeys(source, 'action', ['type', 'dyeItemId', 'layer', 'swatchRows', 'targetItemId'])
    const layer = limitedString(source.layer, 'action.layer', 16)
    if (layer !== 'cloth' && layer !== 'trim') {
      throw new GameProtocolError('action.layer is not supported')
    }
    const swatchRows = limitedArray(
      source.swatchRows,
      'action.swatchRows',
      MAX_NATIVE_DYE_SELECTIONS,
    ).map((row, index) => integerWithin(row, `action.swatchRows[${index}]`, 0, 17))
    if (swatchRows.length === 0) {
      throw new GameProtocolError('action.swatchRows must not be empty')
    }
    return {
      type,
      dyeItemId: positiveInteger(source.dyeItemId, 'action.dyeItemId'),
      layer,
      swatchRows,
      targetItemId: positiveInteger(source.targetItemId, 'action.targetItemId'),
    }
  }
  if (type === 'unforge') {
    onlyKeys(source, 'action', ['type', 'itemId'])
    return { type, itemId: positiveInteger(source.itemId, 'action.itemId') }
  }
  if (type === 'equip') {
    onlyKeys(source, 'action', ['type', 'itemId', 'slot'])
    return {
      type,
      itemId: positiveInteger(source.itemId, 'action.itemId'),
      slot: equipmentSlot(source.slot, 'action.slot'),
    }
  }
  if (type === 'move-inventory-item') {
    onlyKeys(source, 'action', ['type', 'destinationSackId', 'itemId'])
    return {
      type,
      destinationSackId: source.destinationSackId === null
        ? null
        : positiveInteger(source.destinationSackId, 'action.destinationSackId'),
      itemId: positiveInteger(source.itemId, 'action.itemId'),
    }
  }
  if (type === 'transfer') {
    onlyKeys(source, 'action', ['type', 'direction', 'gesture', 'itemId'])
    const direction = limitedString(source.direction, 'action.direction', 32)
    if (direction !== 'to-backpack' && direction !== 'to-storage') {
      throw new GameProtocolError('action.direction is not supported')
    }
    const gesture = limitedString(source.gesture, 'action.gesture', 32)
    if (gesture !== 'double-activation' && gesture !== 'drag') {
      throw new GameProtocolError('action.gesture is not supported')
    }
    if (direction === 'to-storage' && gesture !== 'drag') {
      throw new GameProtocolError('action.gesture must be drag for a to-storage transfer')
    }
    return {
      type,
      direction,
      gesture,
      itemId: positiveInteger(source.itemId, 'action.itemId'),
    }
  }
  if (type === 'unequip') {
    onlyKeys(source, 'action', ['type', 'slot'])
    return { type, slot: equipmentSlot(source.slot, 'action.slot') }
  }
  throw new GameProtocolError('unknown hub inventory action')
}

function equipmentSlot(value: unknown, field: string): EquipmentSlot {
  const slot = limitedString(value, field, 16)
  if (!(EQUIPMENT_SLOTS as readonly string[]).includes(slot)) {
    throw new GameProtocolError(`${field} is not supported`)
  }
  return slot as EquipmentSlot
}

function playerState(value: unknown, field: string): ProtocolPlayerState {
  const player = playerSnapshotFrame(value, field)
  if (!player.economy) throw new GameProtocolError(`${field}.economy is required`)
  return { ...player, economy: player.economy }
}

function playerSnapshotFrame(value: unknown, field: string): ProtocolPlayerSnapshotFrame {
  const source = record(value, field)
  onlyKeys(source, field, [
    'belt',
    'config',
    'economy',
    'footstepTick',
    'gaitDegrees',
    'headingIndex',
    'lighting',
    'movementScale',
    'position',
    'primaryCast',
    'progression',
    'velocity',
    'walkCyclePrimary',
  ])
  const config = playerCharacterConfig(source.config, `${field}.config`)
  const economy = source.economy === undefined
    ? undefined
    : playerEconomy(source.economy, `${field}.economy`)
  const progression = playerProgression(source.progression, `${field}.progression`)
  const belt = playerBelt(source.belt, `${field}.belt`, progression, economy)
  const primaryCast = playerPrimaryCastState(
    source.primaryCast,
    `${field}.primaryCast`,
    config.element,
    progression.selectedPrimarySkillId,
    progression.weldBuildId,
  )
  const lighting = playerLighting(source.lighting, `${field}.lighting`)
  if (lighting.driveActive !== playerLightDriveActive(primaryCast, progression.lifeState)) {
    throw new GameProtocolError(`${field}.lighting.driveActive is inconsistent with player state`)
  }
  return {
    belt,
    config,
    ...(economy ? { economy } : {}),
    footstepTick: nonnegativeInteger(source.footstepTick, `${field}.footstepTick`),
    gaitDegrees: finite(source.gaitDegrees, `${field}.gaitDegrees`),
    headingIndex: integer(source.headingIndex, `${field}.headingIndex`),
    lighting,
    movementScale: nonnegativeFinite(source.movementScale, `${field}.movementScale`),
    position: vector(source.position, `${field}.position`),
    primaryCast,
    progression,
    velocity: vector(source.velocity, `${field}.velocity`),
    walkCyclePrimary: finite(source.walkCyclePrimary, `${field}.walkCyclePrimary`),
  }
}

function playerBelt(
  value: unknown,
  field: string,
  progression: ProtocolPlayerProgression,
  economy: ProtocolPlayerEconomy | undefined,
): PlayerBeltComponent {
  const entries = limitedArray(value, field, 8).map((value, index) => {
    if (value === null) return null
    const entryField = `${field}[${index}]`
    const source = record(value, entryField)
    const kind = limitedString(source.kind, `${entryField}.kind`, 32)
    if (kind === 'skill') {
      onlyKeys(source, entryField, ['kind', 'skillId'])
      const skillId = nonnegativeInteger(source.skillId, `${entryField}.skillId`)
      if (!isNativeBeltSkill(skillId)) {
        throw new GameProtocolError(`${entryField}.skillId is not belt-eligible`)
      }
      const permanentRank = progression.learnedSkills.find(([id]) => id === skillId)?.[1] ?? 0
      if (permanentRank < 1) throw new GameProtocolError(`${entryField}.skillId is not learned`)
      return Object.freeze({ kind, skillId })
    }
    if (kind === 'health-potion' || kind === 'mana-potion') {
      onlyKeys(source, entryField, ['kind'])
      return Object.freeze({ kind })
    }
    if (kind === 'item') {
      onlyKeys(source, entryField, ['itemId', 'kind', 'nativeTypeId'])
      const itemId = positiveInteger(source.itemId, `${entryField}.itemId`)
      const nativeTypeId = nonnegativeInteger(source.nativeTypeId, `${entryField}.nativeTypeId`)
      if (!(NATIVE_BELT_ITEM_TYPE_IDS as readonly number[]).includes(nativeTypeId)) {
        throw new GameProtocolError(`${entryField}.nativeTypeId is not belt-eligible`)
      }
      if (economy) {
        const owned = [
          ...economy.backpack.flatMap(flattenInventoryItem),
          ...equippedItems(economy.equipment),
        ].find((item) => item.id === itemId)
        if (!owned || owned.nativeTypeId !== nativeTypeId
          || !nativeInventoryItemCanBindToBelt(owned)) {
          throw new GameProtocolError(`${entryField} does not identify an owned belt item`)
        }
      }
      return Object.freeze({ itemId, kind, nativeTypeId })
    }
    throw new GameProtocolError(`${entryField}.kind is not supported`)
  })
  if (entries.length !== 8) throw new GameProtocolError(`${field} must contain exactly eight slots`)
  return Object.freeze(entries) as PlayerBeltComponent
}

function playerEconomy(value: unknown, field: string): ProtocolPlayerEconomy {
  const source = record(value, field)
  onlyKeys(source, field, [
    'actionFeedback',
    'backpack',
    'charmCapacity',
    'collegeIntroPending',
    'dowsingFee',
    'dowsingOffers',
    'equipment',
    'fomentiusStock',
    'gold',
    'hagathaOffers',
    'npc',
    'ownedPerkSelectors',
    'revision',
    'storage',
    'tonicPurchases',
    'tutorialPending',
    'unforgeBonuses',
  ])
  const backpack = inventoryItems(
    source.backpack,
    `${field}.backpack`,
    NATIVE_LOOT_BACKPACK_REPLICATION_LIMIT,
  )
  const storage = inventoryItems(source.storage, `${field}.storage`, 28)
  const equipment = playerEquipment(source.equipment, `${field}.equipment`)
  const fomentiusStock = limitedArray(
    source.fomentiusStock,
    `${field}.fomentiusStock`,
    24,
  ).map((item, index) => shopItem(item, `${field}.fomentiusStock[${index}]`))
  const allItemIds = [
    ...backpack,
    ...storage,
    ...fomentiusStock,
    ...equippedItems(equipment),
  ].flatMap(flattenInventoryItem).map(({ id }) => id)
  if (new Set(allItemIds).size !== allItemIds.length) {
    throw new GameProtocolError(`${field} contains a duplicate item id`)
  }
  const dowsingOffers = limitedArray(
    source.dowsingOffers,
    `${field}.dowsingOffers`,
    4,
  ).map((offer, index) => dowsingOffer(offer, `${field}.dowsingOffers[${index}]`))
  if (
    new Set(dowsingOffers.map(({ id }) => id)).size !== dowsingOffers.length
    || new Set(dowsingOffers.map(({ recipeIndex }) => recipeIndex)).size
      !== dowsingOffers.length
  ) throw new GameProtocolError(`${field}.dowsingOffers contains a duplicate`)
  const hagathaOffers = limitedArray(
    source.hagathaOffers,
    `${field}.hagathaOffers`,
    29,
  ).map((offer, index) => hagathaOffer(offer, `${field}.hagathaOffers[${index}]`))
  if (new Set(hagathaOffers.map(({ selector }) => selector)).size !== hagathaOffers.length) {
    throw new GameProtocolError(`${field}.hagathaOffers contains a duplicate selector`)
  }
  const ownedPerkSelectors = hagathaOutcomeArray(
    source.ownedPerkSelectors,
    `${field}.ownedPerkSelectors`,
  )
  const charmCapacity = integer(source.charmCapacity, `${field}.charmCapacity`)
  if (charmCapacity !== 3 && charmCapacity !== 6 && charmCapacity !== 9) {
    throw new GameProtocolError(`${field}.charmCapacity is invalid`)
  }
  const tonicPurchases = nonnegativeInteger(
    source.tonicPurchases,
    `${field}.tonicPurchases`,
  )
  if (!nativeHagathaOutcomeStateIsValid(
    ownedPerkSelectors,
    tonicPurchases,
    charmCapacity,
  )) {
    throw new GameProtocolError(`${field}.Hagatha outcomes do not match Tonic capacity`)
  }
  return {
    actionFeedback: source.actionFeedback === null
      ? null
      : hubActionFeedback(source.actionFeedback, `${field}.actionFeedback`),
    backpack,
    charmCapacity,
    collegeIntroPending: boolean(
      source.collegeIntroPending,
      `${field}.collegeIntroPending`,
    ),
    dowsingFee: boundedInteger(source.dowsingFee, `${field}.dowsingFee`, 500, 950),
    dowsingOffers,
    equipment,
    fomentiusStock,
    gold: boundedInteger(source.gold, `${field}.gold`, 0, 10_000_000),
    hagathaOffers,
    npc: nativeHubNpcState(source.npc, `${field}.npc`),
    ownedPerkSelectors,
    revision: nonnegativeInteger(source.revision, `${field}.revision`),
    storage,
    tonicPurchases,
    tutorialPending: boolean(source.tutorialPending, `${field}.tutorialPending`),
    unforgeBonuses: nativeUnforgeBonuses(source.unforgeBonuses, `${field}.unforgeBonuses`),
  }
}

function nativeHubNpcState(
  value: unknown,
  field: string,
): ProtocolPlayerEconomy['npc'] {
  const source = record(value, field)
  onlyKeys(source, field, ['boast', 'helpFlags', 'librarianLaceRead'])
  const rawBoast = record(source.boast, `${field}.boast`)
  onlyKeys(rawBoast, `${field}.boast`, [
    'failed',
    'failureSequence',
    'selected',
    'succeeded',
  ])
  const selected = (rawBoast.selected === null
    ? null
    : integerWithin(rawBoast.selected, `${field}.boast.selected`, 0, 4)) as 0 | 1 | 2 | 3 | 4 | null
  const failed = boolean(rawBoast.failed, `${field}.boast.failed`)
  const succeeded = boolean(rawBoast.succeeded, `${field}.boast.succeeded`)
  const failureSequence = nonnegativeInteger(
    rawBoast.failureSequence,
    `${field}.boast.failureSequence`,
  )
  const helpFlags = limitedArray(source.helpFlags, `${field}.helpFlags`, 10)
    .map((value, index) => boolean(value, `${field}.helpFlags[${index}]`))
  if (
    failureSequence > 1
    || failed !== (failureSequence === 1)
    || failed && succeeded
    || selected === 3 && failed
    || selected === null && (failed || succeeded)
    || helpFlags.length !== 10
  ) throw new GameProtocolError(`${field}.boast state is inconsistent`)
  return {
    boast: { failed, failureSequence, selected, succeeded },
    helpFlags,
    librarianLaceRead: boolean(source.librarianLaceRead, `${field}.librarianLaceRead`),
  }
}

function nativeUnforgeBonuses(
  value: unknown,
  field: string,
): ProtocolPlayerEconomy['unforgeBonuses'] {
  const source = record(value, field)
  onlyKeys(source, field, [
    'experience',
    'manaCostReduction',
    'maximumHealth',
    'maximumMana',
    'offensiveDamage',
    'recipeAttemptCount',
  ])
  return {
    experience: nonnegativeFinite(source.experience, `${field}.experience`),
    manaCostReduction: nonnegativeInteger(
      source.manaCostReduction,
      `${field}.manaCostReduction`,
    ),
    maximumHealth: nonnegativeInteger(source.maximumHealth, `${field}.maximumHealth`),
    maximumMana: nonnegativeInteger(source.maximumMana, `${field}.maximumMana`),
    offensiveDamage: nonnegativeInteger(source.offensiveDamage, `${field}.offensiveDamage`),
    recipeAttemptCount: nonnegativeInteger(
      source.recipeAttemptCount,
      `${field}.recipeAttemptCount`,
    ),
  }
}

function hubActionFeedback(
  value: unknown,
  field: string,
): NonNullable<ProtocolPlayerEconomy['actionFeedback']> {
  const source = record(value, field)
  onlyKeys(source, field, [
    'accepted',
    'action',
    'dowsingPitch',
    'reason',
    'sequence',
    'transferDirection',
    'transferGesture',
    'unforgeOutcome',
  ])
  const action = limitedString(source.action, `${field}.action`, 32)
  if (![
    'activate-belt-slot',
    'bind-belt-item',
    'buy-dowsing',
    'buy-fomentius',
    'buy-hagatha',
    'buy-teacher-spell',
    'close-dowsing',
    'consume',
    'dye',
    'dowse',
    'equip',
    'interact-goodie',
    'move-inventory-item',
    'read-librarian-book',
    'read-skill-book',
    'select-boast',
    'transfer',
    'unforge',
    'unequip',
  ].includes(action)) throw new GameProtocolError(`${field}.action is not supported`)
  const reason = source.reason === null
    ? null
    : limitedString(source.reason, `${field}.reason`, 32)
  if (reason !== null && ![
    'capacity-full',
    'ineligible-item',
    'insufficient-gold',
    'invalid-inventory',
    'invalid-offer',
    'invalid-slot',
    'invalid-target',
    'item-not-found',
    'offers-active',
    'perk-capacity-full',
    'required-clothing',
    'slot-empty',
    'slot-locked',
  ].includes(reason)) throw new GameProtocolError(`${field}.reason is not supported`)
  const transferDirection = source.transferDirection === null
    ? null
    : limitedString(source.transferDirection, `${field}.transferDirection`, 32)
  const transferGesture = source.transferGesture === null
    ? null
    : limitedString(source.transferGesture, `${field}.transferGesture`, 32)
  if (transferDirection !== null
    && transferDirection !== 'to-backpack' && transferDirection !== 'to-storage') {
    throw new GameProtocolError(`${field}.transferDirection is not supported`)
  }
  if (transferGesture !== null
    && transferGesture !== 'double-activation' && transferGesture !== 'drag') {
    throw new GameProtocolError(`${field}.transferGesture is not supported`)
  }
  if ((action === 'transfer') !== (transferDirection !== null && transferGesture !== null)) {
    throw new GameProtocolError(`${field} transfer metadata does not match action`)
  }
  const accepted = boolean(source.accepted, `${field}.accepted`)
  if (accepted !== (reason === null)) {
    throw new GameProtocolError(`${field}.accepted does not match reason`)
  }
  if (transferDirection === 'to-storage' && transferGesture !== 'drag') {
    throw new GameProtocolError(`${field}.transferGesture must be drag for to-storage`)
  }
  const dowsingPitch = source.dowsingPitch === null
    ? null
    : finite(source.dowsingPitch, `${field}.dowsingPitch`)
  const ownsDowsingPitch = accepted && (action === 'dowse' || action === 'buy-dowsing')
  if (ownsDowsingPitch !== (dowsingPitch !== null)
    || (dowsingPitch !== null && (dowsingPitch < 0.8 || dowsingPitch > 1.1))) {
    throw new GameProtocolError(`${field}.dowsingPitch does not match action`)
  }
  const unforgeOutcome = source.unforgeOutcome === null
    ? null
    : nativeUnforgeOutcome(source.unforgeOutcome, `${field}.unforgeOutcome`)
  if ((accepted && action === 'unforge') !== (unforgeOutcome !== null)) {
    throw new GameProtocolError(`${field}.unforgeOutcome does not match action`)
  }
  return {
    accepted,
    action: action as NonNullable<ProtocolPlayerEconomy['actionFeedback']>['action'],
    dowsingPitch,
    reason: reason as NonNullable<ProtocolPlayerEconomy['actionFeedback']>['reason'],
    sequence: positiveInteger(source.sequence, `${field}.sequence`),
    transferDirection: transferDirection as NonNullable<ProtocolPlayerEconomy['actionFeedback']>['transferDirection'],
    transferGesture: transferGesture as NonNullable<ProtocolPlayerEconomy['actionFeedback']>['transferGesture'],
    unforgeOutcome,
  }
}

function nativeUnforgeOutcome(value: unknown, field: string): NativeUnforgeOutcome {
  const source = record(value, field)
  onlyKeys(source, field, ['amount', 'itemName', 'kind'])
  const kind = limitedString(source.kind, `${field}.kind`, 32)
  if (!(NATIVE_UNFORGE_OUTCOME_KINDS as readonly string[]).includes(kind)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const amount = source.amount === null
    ? null
    : positiveInteger(source.amount, `${field}.amount`)
  const nullAmount = kind === 'fizzle' || kind === 'full-rejuvenation'
  if (nullAmount !== (amount === null)) {
    throw new GameProtocolError(`${field}.amount does not match kind`)
  }
  if (kind === 'mind-dredge' && amount !== 1) {
    throw new GameProtocolError(`${field}.amount does not match Mind Dredge`)
  }
  return {
    amount,
    itemName: limitedString(source.itemName, `${field}.itemName`, 128),
    kind: kind as NativeUnforgeOutcome['kind'],
  }
}

function inventoryItems(
  value: unknown,
  field: string,
  maximum: number,
): readonly HubInventoryItem[] {
  return limitedArray(value, field, maximum).map((item, index) => (
    inventoryItem(item, `${field}[${index}]`)
  ))
}

function flattenInventoryItem(item: HubInventoryItem): readonly HubInventoryItem[] {
  return [item, ...(item.contents ?? []).flatMap(flattenInventoryItem)]
}

function inventoryItem(
  value: unknown,
  field: string,
  extraKeys: readonly string[] = [],
  depth = 0,
): HubInventoryItem {
  const source = record(value, field)
  onlyKeys(source, field, [
    'contents',
    'equipmentType',
    'generatedLevel',
    'iconRecords',
    'iconTints',
    'id',
    'itemContentId',
    'kind',
    'modContent',
    'modAffixes',
    'modItemContent',
    'name',
    'nativeSubtype',
    'nativeSelector',
    'nativeEffects',
    'nativeTypeId',
    'quantity',
    'rarity',
    'recipeIndex',
    ...extraKeys,
  ])
  const kind = limitedString(source.kind, `${field}.kind`, 32)
  if (!(HUB_ITEM_KINDS as readonly string[]).includes(kind)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const equipmentType = source.equipmentType === null
    ? null
    : limitedString(source.equipmentType, `${field}.equipmentType`, 16)
  if (
    equipmentType !== null
    && !(EQUIPMENT_TYPES as readonly string[]).includes(equipmentType)
  ) throw new GameProtocolError(`${field}.equipmentType is not supported`)
  const recipeIndex = source.recipeIndex === null
    ? null
    : boundedInteger(
        source.recipeIndex,
        `${field}.recipeIndex`,
        0,
        DOWSING_EQUIPMENT_RECIPES.length - 1,
      )
  const rarity = source.rarity === null
    ? null
    : limitedString(source.rarity, `${field}.rarity`, 8)
  if (rarity !== null && rarity !== 'Epic' && rarity !== 'Rare') {
    throw new GameProtocolError(`${field}.rarity is not supported`)
  }
  const nativeSubtype = source.nativeSubtype === null
    ? null
    : boundedInteger(source.nativeSubtype, `${field}.nativeSubtype`, 0, 261)
  const modContent = source.modContent === undefined
    ? undefined
    : modConsumableContent(source.modContent, `${field}.modContent`)
  const modItemContent = source.modItemContent === undefined
    ? undefined
    : modItemContentValue(source.modItemContent, `${field}.modItemContent`)
  const modAffixes = source.modAffixes === undefined
    ? undefined
    : limitedArray(source.modAffixes, `${field}.modAffixes`, 8).map((value, index): ModEquipmentAffix => {
        const affixField = `${field}.modAffixes[${index}]`
        const affix = record(value, affixField)
        onlyKeys(affix, affixField, ['contentId', 'modId', 'modifiers', 'name'])
        const contentId = limitedString(affix.contentId, `${affixField}.contentId`, 19)
        if (!/^[1-9][0-9]{0,18}$/.test(contentId)) throw new GameProtocolError(`${affixField} is invalid`)
        return {
          contentId,
          modId: limitedString(affix.modId, `${affixField}.modId`, 128),
          modifiers: limitedArray(affix.modifiers, `${affixField}.modifiers`, 64).map((value, modifierIndex) => {
            const modifierField = `${affixField}.modifiers[${modifierIndex}]`
            const modifier = record(value, modifierField)
            onlyKeys(modifier, modifierField, ['key', 'operation', 'value'])
            const operation = limitedString(modifier.operation, `${modifierField}.operation`, 16)
            if (operation !== 'add' && operation !== 'multiply' && operation !== 'set') {
              throw new GameProtocolError(`${modifierField}.operation is invalid`)
            }
            return {
              key: limitedString(modifier.key, `${modifierField}.key`, 128),
              operation,
              value: finite(modifier.value, `${modifierField}.value`),
            }
          }),
          name: limitedString(affix.name, `${affixField}.name`, 128),
        }
      })
  if (modAffixes && new Set(modAffixes.map(affix => affix.contentId)).size !== modAffixes.length) {
    throw new GameProtocolError(`${field}.modAffixes contains duplicates`)
  }
  const iconRecords = limitedArray(source.iconRecords, `${field}.iconRecords`, 2)
    .map((recordIndex, index) => boundedInteger(
      recordIndex,
      `${field}.iconRecords[${index}]`,
      0,
      83,
    ))
  if (iconRecords.length < 1 && modContent === undefined && modItemContent === undefined) {
    throw new GameProtocolError(`${field}.iconRecords is empty`)
  }
  const name = limitedString(source.name, `${field}.name`, 128)
  const nativeTypeId = boundedInteger(source.nativeTypeId, `${field}.nativeTypeId`, 7001, 7013)
  const quantity = boundedInteger(source.quantity, `${field}.quantity`, 1, 9_999)
  const generatedLevel = source.generatedLevel === undefined
    ? undefined
    : boundedInteger(source.generatedLevel, `${field}.generatedLevel`, 0, 100)
  const nativeSelector = source.nativeSelector === undefined
    ? undefined
    : boundedInteger(source.nativeSelector, `${field}.nativeSelector`, 0, 255)
  const iconTints = source.iconTints === undefined
    ? undefined
    : (() => {
        const values = array(source.iconTints, `${field}.iconTints`)
        if (values.length !== 2) {
          throw new GameProtocolError(`${field}.iconTints must contain two values`)
        }
        return values.map((value, index) => value === null
          ? null
          : integerWithin(value, `${field}.iconTints[${index}]`, 0, 0xffffff)) as [
            number | null,
            number | null,
          ]
      })()
  const nativeEffects = source.nativeEffects === undefined
    ? undefined
    : limitedArray(source.nativeEffects, `${field}.nativeEffects`, 2).map((value, index) => {
        const effectField = `${field}.nativeEffects[${index}]`
        const effect = record(value, effectField)
        onlyKeys(effect, effectField, ['kind', 'magnitude', 'operator', 'target'])
        return {
          kind: boundedInteger(effect.kind, `${effectField}.kind`, 0, 38),
          magnitude: finite(effect.magnitude, `${effectField}.magnitude`),
          operator: integerWithin(effect.operator, `${effectField}.operator`, 0, 2) as 0 | 1 | 2,
          target: boundedInteger(effect.target, `${effectField}.target`, 0, 82),
        }
      })
  if (depth > HUB_SACK_REPLICATION_DEPTH_LIMIT) {
    throw new GameProtocolError(`${field} exceeds the bounded native Sack depth`)
  }
  const contents = source.contents === undefined
    ? undefined
    : limitedArray(
        source.contents,
        `${field}.contents`,
        HUB_SACK_CHILD_REPLICATION_LIMIT,
      ).map((item, index) => (
        inventoryItem(item, `${field}.contents[${index}]`, [], depth + 1)
      ))
  if (kind !== 'equipment') {
    if (
      equipmentType !== null
      || recipeIndex !== null
      || rarity !== null
      || generatedLevel !== undefined
      || nativeEffects !== undefined
      || iconTints !== undefined
      || modAffixes !== undefined
      || (nativeSelector !== undefined && nativeSelector !== nativeSubtype)
    ) {
      throw new GameProtocolError(`${field} equipment identity is inconsistent`)
    }
  } else if (equipmentType === null) {
    throw new GameProtocolError(`${field} equipment identity is inconsistent`)
  } else if (recipeIndex === null && modItemContent?.wearable === undefined) {
    const authored = generatedLevel === undefined
      && nativeSelector !== undefined
    if (authored) {
      if (
        rarity !== null
        || nativeSubtype !== null
        || quantity !== 1
        || equipmentType !== NATIVE_TUTORIAL_AMULET_IDENTITY.equipmentType
        || name !== NATIVE_TUTORIAL_AMULET_IDENTITY.name
        || nativeTypeId !== NATIVE_TUTORIAL_AMULET_IDENTITY.nativeTypeId
        || nativeSelector !== NATIVE_TUTORIAL_AMULET_IDENTITY.nativeSelector
        || iconRecords.length !== NATIVE_TUTORIAL_AMULET_IDENTITY.iconRecords.length
        || iconRecords.some((record, index) => (
          record !== NATIVE_TUTORIAL_AMULET_IDENTITY.iconRecords[index]
        ))
        || iconTints === undefined
        || iconTints.some((tint, index) => (
          tint !== NATIVE_TUTORIAL_AMULET_IDENTITY.iconTints[index]
        ))
        || nativeEffects === undefined
        || nativeEffects.length !== NATIVE_TUTORIAL_AMULET_IDENTITY.nativeEffects.length
        || nativeEffects.some((effect, index) => {
          const expected = NATIVE_TUTORIAL_AMULET_IDENTITY.nativeEffects[index]
          return expected === undefined
            || effect.kind !== expected.kind
            || effect.magnitude !== expected.magnitude
            || effect.operator !== expected.operator
            || effect.target !== expected.target
        })
      ) throw new GameProtocolError(`${field} authored equipment identity is inconsistent`)
    } else {
      const starter = generatedLevel === undefined
        && nativeSelector === undefined
        && nativeEffects === undefined
      if (starter && (
        rarity !== null
        || nativeSubtype !== null
        || quantity !== 1
        || !isStarterEquipmentIdentity(equipmentType as EquipmentType, name, nativeTypeId, iconRecords)
      )) throw new GameProtocolError(`${field} starter equipment identity is inconsistent`)
      if (!starter && (
        rarity !== null
        || nativeSubtype !== null
        || quantity !== 1
        || generatedLevel === undefined
        || nativeSelector === undefined
        || nativeEffects === undefined
        || nativeEffects.length < 1
        || ((equipmentType === 'hat' || equipmentType === 'robe')
          ? iconTints === undefined || iconTints.some((tint) => tint === null)
          : iconTints !== undefined)
        || !isGeneratedEquipmentIdentity(
          equipmentType as EquipmentType,
          nativeTypeId,
          nativeSelector,
          iconRecords,
        )
      )) throw new GameProtocolError(`${field} generated equipment identity is inconsistent`)
    }
  } else if (recipeIndex !== null) {
    const recipe = DOWSING_EQUIPMENT_RECIPES[recipeIndex]!
    const selector = nativeEquipmentSelector(recipe.type, recipe.iconRecords)
    if (
      rarity === null
      || generatedLevel !== undefined
      || nativeEffects !== undefined
      || name !== recipe.name
      || equipmentType !== recipe.type
      || nativeTypeId !== recipe.nativeTypeId
      || rarity !== recipe.rarity
      || iconRecords.length !== recipe.iconRecords.length
      || iconRecords.some((record, index) => record !== recipe.iconRecords[index])
      || (nativeSelector !== undefined && nativeSelector !== selector)
      || (iconTints !== undefined && (
        recipe.type === 'hat' || recipe.type === 'robe'
          ? iconTints.some((tint) => tint === null)
          : iconTints.some((tint, index) => tint !== recipe.iconTints[index])
      ))
    ) throw new GameProtocolError(`${field} named equipment identity is inconsistent`)
  }
  if (kind === 'mod-potion') {
    if (
      modContent === undefined
      || nativeTypeId !== 7001
      || nativeSubtype === null
      || nativeSubtype < 6
      || iconRecords.length !== 0
    ) throw new GameProtocolError(`${field} mod potion identity is inconsistent`)
  } else if (modContent !== undefined) {
    throw new GameProtocolError(`${field}.modContent requires kind mod-potion`)
  }
  if (
    contents !== undefined
    && (kind !== 'sack' || nativeTypeId !== 7008 || nativeSubtype !== 0)
  ) throw new GameProtocolError(`${field}.contents requires an Item_Sack`)
  const item: HubInventoryItem = {
    ...(contents === undefined ? {} : { contents }),
    equipmentType: equipmentType as EquipmentType | null,
    ...(generatedLevel === undefined ? {} : { generatedLevel }),
    iconRecords,
    ...(iconTints === undefined ? {} : { iconTints }),
    id: positiveInteger(source.id, `${field}.id`),
    kind: kind as HubItemKind,
    ...(modContent === undefined ? {} : { modContent }),
    ...(modAffixes === undefined ? {} : { modAffixes }),
    ...(modItemContent === undefined ? {} : { modItemContent }),
    name,
    nativeSubtype,
    ...(nativeSelector === undefined ? {} : { nativeSelector }),
    ...(nativeEffects === undefined ? {} : { nativeEffects }),
    nativeTypeId,
    quantity,
    rarity,
    recipeIndex,
  }
  if (!modItemInventoryIdentityIsValid(item)) {
    throw new GameProtocolError(`${field} invalid mod item`)
  }
  return item
}

function modConsumableContent(value: unknown, field: string): ModConsumableContent {
  const source = record(value, field)
  onlyKeys(source, field, [
    'consumeVfx', 'contentId', 'description', 'durationMs', 'icon', 'key', 'modId',
  ])
  const identity = modContentIdentity(source, field)
  const consumeVfx = source.consumeVfx === null
    ? null
    : (() => {
        const vfx = record(source.consumeVfx, `${field}.consumeVfx`)
        onlyKeys(vfx, `${field}.consumeVfx`, ['color', 'kind'])
        if (vfx.kind !== 'spell_glow') {
          throw new GameProtocolError(`${field}.consumeVfx.kind is unsupported`)
        }
        const values = array(vfx.color, `${field}.consumeVfx.color`)
        if (values.length !== 4) {
          throw new GameProtocolError(`${field}.consumeVfx.color must contain RGBA`)
        }
        const color = values.map((component, index) => {
          const number = finite(component, `${field}.consumeVfx.color[${index}]`)
          if (number < 0 || number > 1) {
            throw new GameProtocolError(`${field}.consumeVfx.color[${index}] must be within 0..1`)
          }
          return number
        }) as [number, number, number, number]
        return { color, kind: 'spell_glow' as const }
      })()
  return {
    consumeVfx,
    ...identity,
    durationMs: boundedInteger(source.durationMs, `${field}.durationMs`, 0, 86_400_000),
  }
}

function modItemContentValue(value: unknown, field: string): ModItemContent {
  const source = record(value, field)
  onlyKeys(source, field, [
    'contentId', 'description', 'icon', 'iconTrimImagePath', 'key', 'modId', 'stackMaximum', 'wearable',
  ])
  const iconTrimImagePath = source.iconTrimImagePath === undefined
    ? undefined
    : limitedString(source.iconTrimImagePath, field, 240)
  const wearable = source.wearable === undefined
    ? undefined
    : modWearableContent(source.wearable, field)
  const stackMaximum = boundedInteger(source.stackMaximum, `${field}.stackMaximum`, 1, 9_999)
  if ((iconTrimImagePath !== undefined && !wearable) || (wearable && (
    stackMaximum !== 1 || !modWearableContentIsValid(wearable, iconTrimImagePath)
  ))) {
    throw new GameProtocolError(`${field} invalid mod item`)
  }
  return {
    ...modContentIdentity(source, field),
    ...(iconTrimImagePath === undefined ? {} : { iconTrimImagePath }),
    stackMaximum,
    ...(wearable === undefined ? {} : { wearable }),
  }
}

function modContentIdentity(
  source: Record<string, unknown>,
  field: string,
): Omit<ModItemContent, 'stackMaximum'> {
  const contentId = limitedString(source.contentId, `${field}.contentId`, 19)
  if (!/^[1-9][0-9]{0,18}$/.test(contentId)) {
    throw new GameProtocolError(`${field}.contentId is invalid`)
  }
  const modId = limitedString(source.modId, `${field}.modId`, 128)
  const key = limitedString(source.key, `${field}.key`, 128)
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(modId) ||
      !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(key)) {
    throw new GameProtocolError(`${field} has a noncanonical content key`)
  }
  const iconSource = record(source.icon, `${field}.icon`)
  onlyKeys(iconSource, `${field}.icon`, ['atlasId', 'frame', 'frameIndex', 'imagePath'])
  const atlasId = limitedString(iconSource.atlasId, `${field}.icon.atlasId`, 257)
  const imagePath = limitedString(iconSource.imagePath, `${field}.icon.imagePath`, 240)
  if (!atlasId.startsWith(`${modId}:`) || !/^(?:art|sprites)\/.+\.png$/.test(imagePath)) {
    throw new GameProtocolError(`${field}.icon is outside its mod asset ownership`)
  }
  return {
    contentId,
    description: boundedString(source.description, `${field}.description`, 1_024),
    icon: {
      atlasId,
      frame: modSpriteFrame(iconSource.frame, `${field}.icon.frame`),
      frameIndex: boundedInteger(iconSource.frameIndex, `${field}.icon.frameIndex`, 0, 4_095),
      imagePath,
    },
    key,
    modId,
  }
}

function modWearableContent(
  value: unknown,
  field: string,
): NonNullable<ModItemContent['wearable']> {
  const source = record(value, field)
  onlyKeys(source, field, [
    'deathShape', 'dyeable', 'slot', 'wornImagePath', 'wornTrimImagePath',
  ])
  const wornTrimImagePath = source.wornTrimImagePath === undefined
    ? undefined
    : limitedString(source.wornTrimImagePath, field, 240)
  return {
    deathShape: boundedInteger(source.deathShape, field, 0, 5),
    dyeable: boolean(source.dyeable, field),
    slot: limitedString(source.slot, field, 8) as ModWearableContent['slot'],
    wornImagePath: limitedString(source.wornImagePath, field, 240),
    ...(wornTrimImagePath === undefined ? {} : { wornTrimImagePath }),
  }
}

function modSpriteFrame(value: unknown, field: string): ModSpriteFrame {
  const source = record(value, field)
  onlyKeys(source, field, [
    'centerOffsetX', 'centerOffsetY', 'contentHeight', 'contentWidth', 'height',
    'logicalHeight', 'logicalWidth', 'width', 'x', 'y',
  ])
  const frame = {
    centerOffsetX: finite(source.centerOffsetX, `${field}.centerOffsetX`),
    centerOffsetY: finite(source.centerOffsetY, `${field}.centerOffsetY`),
    contentHeight: positiveFinite(source.contentHeight, `${field}.contentHeight`),
    contentWidth: positiveFinite(source.contentWidth, `${field}.contentWidth`),
    height: positiveFinite(source.height, `${field}.height`),
    logicalHeight: positiveInteger(source.logicalHeight, `${field}.logicalHeight`),
    logicalWidth: positiveInteger(source.logicalWidth, `${field}.logicalWidth`),
    width: positiveFinite(source.width, `${field}.width`),
    x: finite(source.x, `${field}.x`),
    y: finite(source.y, `${field}.y`),
  }
  if (Object.values(frame).some(component => Math.abs(component) > 16_384) ||
      frame.x < 0 || frame.y < 0) {
    throw new GameProtocolError(`${field} exceeds mod sprite geometry bounds`)
  }
  return frame
}

function isGeneratedEquipmentIdentity(
  equipmentType: EquipmentType,
  nativeTypeId: number,
  selector: number,
  iconRecords: readonly number[],
): boolean {
  const expectedType = {
    amulet: 7003,
    hat: 7005,
    ring: 7002,
    robe: 7006,
    staff: 7004,
    wand: 7011,
  }[equipmentType]
  const expectedRecords = equipmentType === 'hat'
    ? [34 + selector, 38 + selector]
    : equipmentType === 'robe'
      ? [64 + selector, 67 + selector]
      : equipmentType === 'staff'
        ? [72 + selector]
        : equipmentType === 'wand'
          ? [78 + selector]
          : equipmentType === 'ring'
            ? [52 + selector]
            : [30 + Math.floor(selector / 6), 18 + selector]
  return nativeTypeId === expectedType
    && iconRecords.length === expectedRecords.length
    && iconRecords.every((record, index) => record === expectedRecords[index])
}

function nativeEquipmentSelector(
  equipmentType: EquipmentType,
  iconRecords: readonly number[],
): number {
  if (equipmentType === 'hat') return iconRecords[0]! - 34
  if (equipmentType === 'robe') return iconRecords[0]! - 64
  if (equipmentType === 'staff') return iconRecords[0]! - 72
  if (equipmentType === 'wand') return iconRecords[0]! - 78
  if (equipmentType === 'ring') return iconRecords[0]! - 52
  return iconRecords[1]! - 18
}

function isStarterEquipmentIdentity(
  equipmentType: EquipmentType,
  name: string,
  nativeTypeId: number,
  iconRecords: readonly number[],
): boolean {
  const expected = equipmentType === 'hat'
    ? ['Hat', 7005, [34, 38]] as const
    : equipmentType === 'robe'
      ? ['Robe', 7006, [64, 67]] as const
      : equipmentType === 'staff'
        ? ['Staff', 7004, [72]] as const
        : null
  return expected !== null
    && name === expected[0]
    && nativeTypeId === expected[1]
    && iconRecords.length === expected[2].length
    && iconRecords.every((record, index) => record === expected[2][index])
}

function shopItem(value: unknown, field: string): HubShopItem {
  const source = record(value, field)
  return {
    ...inventoryItem(source, field, ['price']),
    price: boundedInteger(source.price, `${field}.price`, 1, 100_000),
  }
}

function playerEquipment(value: unknown, field: string): ProtocolPlayerEconomy['equipment'] {
  const source = record(value, field)
  onlyKeys(source, field, ['amulet', 'hat', 'rings', 'robe', 'weapon'])
  const nullableItem = (item: unknown, itemField: string) => item === null
    ? null
    : inventoryItem(item, itemField)
  const rings = array(source.rings, `${field}.rings`)
  if (rings.length !== 3) throw new GameProtocolError(`${field}.rings must contain three slots`)
  const equipment = {
    amulet: nullableItem(source.amulet, `${field}.amulet`),
    hat: nullableItem(source.hat, `${field}.hat`),
    rings: rings.map((item, index) => nullableItem(item, `${field}.rings[${index}]`)) as [
      HubInventoryItem | null,
      HubInventoryItem | null,
      HubInventoryItem | null,
    ],
    robe: nullableItem(source.robe, `${field}.robe`),
    weapon: nullableItem(source.weapon, `${field}.weapon`),
  }
  for (const [slot, item] of [
    ['amulet', equipment.amulet],
    ['hat', equipment.hat],
    ['ring-0', equipment.rings[0]],
    ['ring-1', equipment.rings[1]],
    ['ring-2', equipment.rings[2]],
    ['robe', equipment.robe],
    ['weapon', equipment.weapon],
  ] as const) {
    if (item && !equipmentSlotAccepts(slot, item.equipmentType)) {
      throw new GameProtocolError(`${field}.${slot} contains the wrong equipment type`)
    }
  }
  return equipment
}

function equipmentSlotAccepts(slot: EquipmentSlot, type: EquipmentType | null): boolean {
  if (slot === 'weapon') return type === 'staff' || type === 'wand'
  if (slot.startsWith('ring-')) return type === 'ring'
  return slot === type
}

function equippedItems(
  equipment: ProtocolPlayerEconomy['equipment'],
): readonly HubInventoryItem[] {
  return [
    equipment.amulet,
    equipment.hat,
    ...equipment.rings,
    equipment.robe,
    equipment.weapon,
  ].filter((item): item is HubInventoryItem => item !== null)
}

function dowsingOffer(value: unknown, field: string): DowsingOffer {
  const source = record(value, field)
  onlyKeys(source, field, ['id', 'price', 'recipeIndex'])
  const price = boundedInteger(source.price, `${field}.price`, 5_000, 5_700)
  if (price % 50 !== 0) throw new GameProtocolError(`${field}.price is not a 50-gold step`)
  return {
    id: positiveInteger(source.id, `${field}.id`),
    price,
    recipeIndex: boundedInteger(
      source.recipeIndex,
      `${field}.recipeIndex`,
      0,
      DOWSING_EQUIPMENT_RECIPES.length - 1,
    ),
  }
}

function hagathaOffer(value: unknown, field: string): HagathaOffer {
  const source = record(value, field)
  onlyKeys(source, field, [
    'basePrice',
    'behaviorFamily',
    'description',
    'members',
    'name',
    'price',
    'selector',
  ])
  const selector = integer(source.selector, `${field}.selector`)
  if (selector < -1 || selector >= HAGATHA_PERKS.length || selector === 8) {
    throw new GameProtocolError(`${field}.selector is unavailable`)
  }
  const members = selectorArray(source.members, `${field}.members`)
  if (members.length < 1 || (selector >= 0 && (members.length !== 1 || members[0] !== selector))) {
    throw new GameProtocolError(`${field}.members does not match selector`)
  }
  return {
    basePrice: positiveInteger(source.basePrice, `${field}.basePrice`),
    behaviorFamily: limitedString(source.behaviorFamily, `${field}.behaviorFamily`, 64),
    description: limitedString(source.description, `${field}.description`, 512),
    members,
    name: limitedString(source.name, `${field}.name`, 64),
    price: positiveInteger(source.price, `${field}.price`),
    selector,
  }
}

function selectorArray(value: unknown, field: string): readonly number[] {
  const selectors = limitedArray(value, field, 28).map((selector, index) => (
    boundedInteger(selector, `${field}[${index}]`, 0, 27)
  ))
  if (selectors.some((selector, index) => (
    selector === 8 || (index > 0 && selector <= selectors[index - 1]!)
  ))) throw new GameProtocolError(`${field} must be sorted, unique, and available`)
  return selectors
}

function hagathaOutcomeArray(value: unknown, field: string): readonly number[] {
  const selectors = limitedArray(value, field, 11).map((selector, index) => (
    boundedInteger(selector, `${field}[${index}]`, 0, 27)
  ))
  const ordinary = selectors.filter(selector => selector !== 27)
  if (
    selectors.includes(8)
    || new Set(ordinary).size !== ordinary.length
    || selectors.filter(selector => selector === 27).length > 2
  ) throw new GameProtocolError(`${field} is not a native Hagatha outcome list`)
  return selectors
}

function playerLighting(
  value: unknown,
  field: string,
): ProtocolPlayerState['lighting'] {
  const source = record(value, field)
  onlyKeys(source, field, [
    'driveActive',
    'lightRegistration',
    'overlayEffectPhase',
  ])
  const overlayEffectPhase = finite(source.overlayEffectPhase, `${field}.overlayEffectPhase`)
  if (overlayEffectPhase < 0 || overlayEffectPhase > NATIVE_PLAYER_MAX_LIGHT_OVERLAY) {
    throw new GameProtocolError(`${field}.overlayEffectPhase is outside the native domain`)
  }
  return {
    driveActive: boolean(source.driveActive, `${field}.driveActive`),
    lightRegistration: nativeLightProviderRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    overlayEffectPhase,
  }
}

function playerPrimaryCastState(
  value: unknown,
  field: string,
  element: PlayerCharacterConfig['element'],
  selectedPrimarySkillId: number,
  weldBuildId: number | null,
): ProtocolPlayerState['primaryCast'] {
  const activeWeldBuildId = selectedPrimarySkillId === 52 ? weldBuildId : null
  const source = record(value, field)
  onlyKeys(source, field, [
    'actionTick',
    'aimDirection',
    'castSequence',
    'channelActive',
    'emissionSequence',
    'etherBlastCharge',
    'etherBlastChargeCueSequence',
    'fizzleSequence',
    'held',
    'lastWeldPlaybackRate',
    'lastWeldSoundVariant',
    'oneShotAttackPoseHeld',
    'selectedPrimaryAgeTicks',
    'selectedPrimaryId',
    'targetId',
    'underpowered',
    'weaponPulse',
  ])
  const actionTick = finite(source.actionTick, `${field}.actionTick`)
  const channelActive = boolean(source.channelActive, `${field}.channelActive`)
  const castElement = primaryCastClockElement(selectedPrimarySkillId, element)
  if (channelActive && (actionTick < 0 || actionTick > 1)) {
    throw new GameProtocolError(`${field}.actionTick is outside the Staff Constant program`)
  }
  if (!channelActive && (actionTick < -1 || actionTick >= primaryCastActionEndTick(castElement))) {
    throw new GameProtocolError(`${field}.actionTick is outside the Staff Cast 1 program`)
  }
  const targetId = source.targetId === null
    ? null
    : limitedString(source.targetId, `${field}.targetId`, 256)
  if (selectedPrimarySkillId !== 24 && activeWeldBuildId !== 1003 && targetId !== null) {
    throw new GameProtocolError(`${field}.targetId is only valid for Air`)
  }
  const lastWeldSoundVariant = source.lastWeldSoundVariant === null
    ? null
    : nonnegativeInteger(
        source.lastWeldSoundVariant,
        `${field}.lastWeldSoundVariant`,
      )
  const weldSoundVariantCount = activeWeldBuildId === 1002
    ? 2
    : activeWeldBuildId === 1009
      ? 3
      : 0
  if ((weldSoundVariantCount === 0 && lastWeldSoundVariant !== null)
    || (lastWeldSoundVariant !== null && lastWeldSoundVariant >= weldSoundVariantCount)) {
    throw new GameProtocolError(`${field}.lastWeldSoundVariant does not match the active build`)
  }
  const lastWeldPlaybackRate = source.lastWeldPlaybackRate === null
    ? null
    : positiveFinite(source.lastWeldPlaybackRate, `${field}.lastWeldPlaybackRate`)
  const weldOneShot = activeWeldBuildId === 1000
    || activeWeldBuildId === 1001
    || activeWeldBuildId === 1002
    || activeWeldBuildId === 1009
  const weldRandomizedStart = activeWeldBuildId === 1006 || activeWeldBuildId === 1008
  if ((!weldOneShot && !weldRandomizedStart && lastWeldPlaybackRate !== null)
    || (lastWeldPlaybackRate !== null
      && (lastWeldPlaybackRate < 0.5 || lastWeldPlaybackRate > 1.5))) {
    throw new GameProtocolError(`${field}.lastWeldPlaybackRate does not match the active build`)
  }
  const selectedPrimaryId = boundedInteger(
    source.selectedPrimaryId,
    `${field}.selectedPrimaryId`,
    -1,
    1009,
  )
  const expectedPrimaryId = activeWeldBuildId ?? selectedPrimarySkillId
  if (selectedPrimaryId !== -1 && selectedPrimaryId !== expectedPrimaryId) {
    throw new GameProtocolError(`${field}.selectedPrimaryId does not match progression`)
  }
  const held = boolean(source.held, `${field}.held`)
  const emissionSequence = nonnegativeInteger(
    source.emissionSequence,
    `${field}.emissionSequence`,
  )
  const oneShotAttackPoseHeld = boolean(
    source.oneShotAttackPoseHeld,
    `${field}.oneShotAttackPoseHeld`,
  )
  const selectedOneShot = selectedPrimaryId === 8
    || selectedPrimaryId === 16
    || selectedPrimaryId === 1000
    || selectedPrimaryId === 1001
    || selectedPrimaryId === 1002
    || selectedPrimaryId === 1009
  if (oneShotAttackPoseHeld && (
    !selectedOneShot
    || channelActive
    || emissionSequence === 0
    || (!held && actionTick < 0)
  )) {
    throw new GameProtocolError(`${field}.oneShotAttackPoseHeld is outside a one-shot burst`)
  }
  const etherBlastCharge = nonnegativeFinite(
    source.etherBlastCharge,
    `${field}.etherBlastCharge`,
  )
  if (etherBlastCharge > 6) {
    throw new GameProtocolError(`${field}.etherBlastCharge exceeds the native maximum`)
  }
  const weaponPulse = nonnegativeFinite(source.weaponPulse, `${field}.weaponPulse`)
  if (weaponPulse > 0.45) {
    throw new GameProtocolError(`${field}.weaponPulse exceeds the native maximum`)
  }
  return {
    actionTick,
    aimDirection: unitVector(source.aimDirection, `${field}.aimDirection`),
    castSequence: nonnegativeInteger(source.castSequence, `${field}.castSequence`),
    channelActive,
    emissionSequence,
    etherBlastCharge,
    etherBlastChargeCueSequence: nonnegativeInteger(
      source.etherBlastChargeCueSequence,
      `${field}.etherBlastChargeCueSequence`,
    ),
    fizzleSequence: nonnegativeInteger(
      source.fizzleSequence,
      `${field}.fizzleSequence`,
    ),
    held,
    lastWeldPlaybackRate,
    lastWeldSoundVariant,
    oneShotAttackPoseHeld,
    selectedPrimaryAgeTicks: nonnegativeInteger(
      source.selectedPrimaryAgeTicks,
      `${field}.selectedPrimaryAgeTicks`,
    ),
    selectedPrimaryId,
    targetId,
    underpowered: boolean(source.underpowered, `${field}.underpowered`),
    weaponPulse,
  }
}

function primaryCastClockElement(
  skillId: number,
  fallback: PlayerCharacterConfig['element'],
): PlayerCharacterConfig['element'] {
  if (skillId === SPELL_WELDING_SKILL_ID) return 'fire'
  if (skillId === 8) return 'ether'
  if (skillId === 16) return 'fire'
  if (skillId === 24) return 'air'
  if (skillId === 32) return 'water'
  if (skillId === 40) return 'earth'
  return fallback
}

function playerProgression(value: unknown, field: string): ProtocolPlayerProgression {
  const source = record(value, field)
  onlyKeys(source, field, [
    'advancedUnlocks',
    'weldBuildId',
    'weldComponentRanks',
    'coldSlowTicksRemaining',
    'concentrationSkillIds',
    'currentHealth',
    'currentMana',
    'damageX4TicksRemaining',
    'deferredSkillChoices',
    'dazzleTicksRemaining',
    'deathEpoch',
    'deathTick',
    'experience',
    'hagathaRuntime',
    'learnedSkills',
    'learnedSkillOrder',
    'level',
    'lifeState',
    'lastDamageTick',
    'maximumHealth',
    'maximumMana',
    'mindChugTicksRemaining',
    'nextThreshold',
    'pendingOffer',
    'poisonDamagePerTick',
    'poisonTicksRemaining',
    'previousThreshold',
    'revision',
    'selectedPrimarySkillId',
    'sorcerorsCharmAvailable',
    'splitMind',
  ])
  const advancedUnlocks = limitedArray(
    source.advancedUnlocks,
    `${field}.advancedUnlocks`,
    8,
  ).map((entry, index) => boolean(entry, `${field}.advancedUnlocks[${index}]`))
  if (advancedUnlocks.length !== 8) {
    throw new GameProtocolError(`${field}.advancedUnlocks must contain eight flags`)
  }
  const maximumHealth = positiveFinite(source.maximumHealth, `${field}.maximumHealth`)
  const maximumMana = positiveFinite(source.maximumMana, `${field}.maximumMana`)
  const currentHealth = finite(source.currentHealth, `${field}.currentHealth`)
  const currentMana = finite(source.currentMana, `${field}.currentMana`)
  const poisonDamagePerTick = finite(
    source.poisonDamagePerTick,
    `${field}.poisonDamagePerTick`,
  )
  if (currentHealth < 0 || currentHealth > maximumHealth) {
    throw new GameProtocolError(`${field}.currentHealth is out of range`)
  }
  if (currentMana < 0 || currentMana > maximumMana) {
    throw new GameProtocolError(`${field}.currentMana is out of range`)
  }
  if (poisonDamagePerTick < 0) {
    throw new GameProtocolError(`${field}.poisonDamagePerTick is out of range`)
  }
  const coldSlowTicksRemaining = nonnegativeInteger(
    source.coldSlowTicksRemaining,
    `${field}.coldSlowTicksRemaining`,
  )
  if (coldSlowTicksRemaining > BOUNDED_ENEMY_COLD_SLOW_TICKS) {
    throw new GameProtocolError(`${field}.coldSlowTicksRemaining is out of range`)
  }
  const dazzleTicksRemaining = nonnegativeInteger(
    source.dazzleTicksRemaining,
    `${field}.dazzleTicksRemaining`,
  )
  if (dazzleTicksRemaining > NATIVE_WRAITH_DAZZLE_TICKS) {
    throw new GameProtocolError(`${field}.dazzleTicksRemaining is out of range`)
  }
  const damageX4TicksRemaining = nonnegativeInteger(
    source.damageX4TicksRemaining,
    `${field}.damageX4TicksRemaining`,
  )
  if (damageX4TicksRemaining > NATIVE_DAMAGE_X4_POTION_TICKS) {
    throw new GameProtocolError(`${field}.damageX4TicksRemaining is out of range`)
  }
  const level = positiveInteger(source.level, `${field}.level`)
  if (level > 75) throw new GameProtocolError(`${field}.level is out of range`)
  const experience = nonnegativeFinite(source.experience, `${field}.experience`)
  if (experience > 10_000_000) {
    throw new GameProtocolError(`${field}.experience is out of range`)
  }
  const rawHagathaRuntime = record(source.hagathaRuntime, `${field}.hagathaRuntime`)
  onlyKeys(rawHagathaRuntime, `${field}.hagathaRuntime`, [
    'cheatDeathCharges',
    'reverieActive',
    'serendipityActive',
  ])
  const cheatDeathCharges = nonnegativeInteger(
    rawHagathaRuntime.cheatDeathCharges,
    `${field}.hagathaRuntime.cheatDeathCharges`,
  )
  if (cheatDeathCharges > 1) {
    throw new GameProtocolError(`${field}.hagathaRuntime.cheatDeathCharges is out of range`)
  }
  const hagathaRuntime = {
    cheatDeathCharges,
    reverieActive: boolean(
      rawHagathaRuntime.reverieActive,
      `${field}.hagathaRuntime.reverieActive`,
    ),
    serendipityActive: boolean(
      rawHagathaRuntime.serendipityActive,
      `${field}.hagathaRuntime.serendipityActive`,
    ),
  }
  const learnedSkills = limitedArray(
    source.learnedSkills,
    `${field}.learnedSkills`,
    83,
  ).map((entry, index) => {
    const raw = array(entry, `${field}.learnedSkills[${index}]`)
    if (raw.length !== 3) {
      throw new GameProtocolError(`${field}.learnedSkills[${index}] must have three fields`)
    }
    const skillId = nonnegativeInteger(raw[0], `${field}.learnedSkills[${index}][0]`)
    const permanentRank = nonnegativeInteger(raw[1], `${field}.learnedSkills[${index}][1]`)
    const effectiveRank = nonnegativeInteger(raw[2], `${field}.learnedSkills[${index}][2]`)
    if (skillId > 82 || permanentRank > 255 || effectiveRank > 255) {
      throw new GameProtocolError(`${field}.learnedSkills[${index}] is out of range`)
    }
    return [skillId, permanentRank, effectiveRank] as const
  })
  if (learnedSkills.some((entry, index) => index > 0 && entry[0] <= learnedSkills[index - 1]![0])) {
    throw new GameProtocolError(`${field}.learnedSkills must be unique and sorted`)
  }
  const learnedPermanentIds = learnedSkills
    .filter(([skillId, permanentRank]) => skillId >= 8 && skillId <= 79 && permanentRank > 0)
    .map(([skillId]) => skillId)
  const learnedSkillOrder = limitedArray(
    source.learnedSkillOrder,
    `${field}.learnedSkillOrder`,
    72,
  ).map((entry, index) => {
    const skillId = nonnegativeInteger(entry, `${field}.learnedSkillOrder[${index}]`)
    if (skillId < 8 || skillId > 79) {
      throw new GameProtocolError(`${field}.learnedSkillOrder[${index}] is out of range`)
    }
    return skillId
  })
  if (
    new Set(learnedSkillOrder).size !== learnedSkillOrder.length
    || learnedSkillOrder.length !== learnedPermanentIds.length
    || learnedPermanentIds.some((skillId) => !learnedSkillOrder.includes(skillId))
  ) throw new GameProtocolError(`${field}.learnedSkillOrder must contain every learned public skill`)
  const concentrationSkillIds = limitedArray(
    source.concentrationSkillIds,
    `${field}.concentrationSkillIds`,
    2,
  ).map((entry, index) => {
    if (entry === null) return null
    const skillId = nonnegativeInteger(entry, `${field}.concentrationSkillIds[${index}]`)
    if (
      nativeSkillCategory(skillId) !== 3
      || (learnedSkills.find(([id]) => id === skillId)?.[2] ?? 0) < 1
    ) throw new GameProtocolError(`${field}.concentrationSkillIds[${index}] is not eligible`)
    return skillId
  })
  if (concentrationSkillIds.length !== 2) {
    throw new GameProtocolError(`${field}.concentrationSkillIds must contain two slots`)
  }
  if (
    concentrationSkillIds[0] !== null
    && concentrationSkillIds[0] === concentrationSkillIds[1]
  ) throw new GameProtocolError(`${field}.concentrationSkillIds must be unique`)
  const splitMind = boolean(source.splitMind, `${field}.splitMind`)
  if (!splitMind && concentrationSkillIds[1] !== null) {
    throw new GameProtocolError(`${field}.concentrationSkillIds B requires Split Mind`)
  }
  const weldBuildId = source.weldBuildId === null
    ? null
    : integer(source.weldBuildId, `${field}.weldBuildId`)
  if (weldBuildId !== null && (weldBuildId < 1000 || weldBuildId > 1009)) {
    throw new GameProtocolError(`${field}.weldBuildId is out of range`)
  }
  const spellWeldingRank = learnedSkills.find(([skillId]) => skillId === 52)?.[1] ?? 0
  if ((weldBuildId === null) !== (spellWeldingRank === 0)) {
    throw new GameProtocolError(`${field}.weldBuildId does not match Spell Welding`)
  }
  const weldComponentRanks = source.weldComponentRanks === null
    ? null
    : limitedArray(source.weldComponentRanks, `${field}.weldComponentRanks`, 6)
      .map((entry, index) => {
        const rank = nonnegativeInteger(entry, `${field}.weldComponentRanks[${index}]`)
        if (rank > 255) {
          throw new GameProtocolError(`${field}.weldComponentRanks[${index}] is out of range`)
        }
        return rank
      })
  if (
    (weldBuildId === null) !== (weldComponentRanks === null)
    || (weldComponentRanks !== null && weldComponentRanks.length !== 6)
  ) throw new GameProtocolError(`${field}.weldComponentRanks does not match Spell Welding`)
  const selectedPrimarySkillId = nonnegativeInteger(
    source.selectedPrimarySkillId,
    `${field}.selectedPrimarySkillId`,
  )
  if (
    nativeSkillCategory(selectedPrimarySkillId) !== 1
    || (learnedSkills.find(([id]) => id === selectedPrimarySkillId)?.[2] ?? 0) < 1
    || (selectedPrimarySkillId === 52 && weldBuildId === null)
  ) {
    throw new GameProtocolError(`${field}.selectedPrimarySkillId is not a learned primary`)
  }
  const lifeState = limitedString(source.lifeState, `${field}.lifeState`, 32)
  if (!(PLAYER_LIFE_STATES as readonly string[]).includes(lifeState)) {
    throw new GameProtocolError(`${field}.lifeState is not supported`)
  }
  return {
    advancedUnlocks,
    coldSlowTicksRemaining,
    concentrationSkillIds: concentrationSkillIds as [number | null, number | null],
    currentHealth,
    currentMana,
    damageX4TicksRemaining,
    deferredSkillChoices: nonnegativeInteger(
      source.deferredSkillChoices,
      `${field}.deferredSkillChoices`,
    ),
    dazzleTicksRemaining,
    deathEpoch: nonnegativeInteger(source.deathEpoch, `${field}.deathEpoch`),
    deathTick: nonnegativeInteger(source.deathTick, `${field}.deathTick`),
    experience,
    hagathaRuntime,
    learnedSkills,
    learnedSkillOrder,
    level,
    lifeState: lifeState as PlayerLifeState,
    lastDamageTick: source.lastDamageTick === null
      ? null
      : nonnegativeInteger(source.lastDamageTick, `${field}.lastDamageTick`),
    maximumHealth,
    maximumMana,
    mindChugTicksRemaining: nonnegativeInteger(
      source.mindChugTicksRemaining,
      `${field}.mindChugTicksRemaining`,
    ),
    nextThreshold: nonnegativeInteger(source.nextThreshold, `${field}.nextThreshold`),
    pendingOffer: source.pendingOffer === null
      ? null
      : playerSkillOffer(source.pendingOffer, `${field}.pendingOffer`, level),
    poisonDamagePerTick,
    poisonTicksRemaining: nonnegativeInteger(
      source.poisonTicksRemaining,
      `${field}.poisonTicksRemaining`,
    ),
    previousThreshold: nonnegativeInteger(
      source.previousThreshold,
      `${field}.previousThreshold`,
    ),
    revision: nonnegativeInteger(source.revision, `${field}.revision`),
    selectedPrimarySkillId,
    sorcerorsCharmAvailable: boolean(
      source.sorcerorsCharmAvailable,
      `${field}.sorcerorsCharmAvailable`,
    ),
    splitMind,
    weldBuildId,
    weldComponentRanks: weldComponentRanks as [number, number, number, number, number, number] | null,
  }
}

function playerSkillOffer(value: unknown, field: string, playerLevel: number) {
  const source = record(value, field)
  onlyKeys(source, field, ['automaticChoiceIndex', 'level', 'options', 'sequence'])
  const level = positiveInteger(source.level, `${field}.level`)
  if (level > playerLevel) throw new GameProtocolError(`${field}.level is ahead of the player`)
  const options = limitedArray(source.options, `${field}.options`, 4)
  if (options.length !== 3 && options.length !== 4) {
    throw new GameProtocolError(`${field}.options must contain three or four choices`)
  }
  const automaticChoiceIndex = source.automaticChoiceIndex === undefined
    ? undefined
    : integerWithin(
        source.automaticChoiceIndex,
        `${field}.automaticChoiceIndex`,
        0,
        options.length - 1,
      )
  return {
    ...(automaticChoiceIndex === undefined ? {} : { automaticChoiceIndex }),
    level,
    options: options.map((option, index) => {
      const optionField = `${field}.options[${index}]`
      const row = record(option, optionField)
      onlyKeys(row, optionField, ['insight', 'skillId', 'targetRank', 'weldBuildId'])
      const skillId = nonnegativeInteger(row.skillId, `${optionField}.skillId`)
      if (skillId < 8 || skillId > 79) {
        throw new GameProtocolError(`${optionField}.skillId is out of range`)
      }
      const targetRank = positiveInteger(row.targetRank, `${optionField}.targetRank`)
      if (targetRank > 255) {
        throw new GameProtocolError(`${optionField}.targetRank is out of range`)
      }
      const weldBuildId = row.weldBuildId === undefined
        ? undefined
        : integer(row.weldBuildId, `${optionField}.weldBuildId`)
      const insight = row.insight === undefined ? undefined : row.insight
      if (insight !== undefined && insight !== true) {
        throw new GameProtocolError(`${optionField}.insight must be true`)
      }
      if (skillId === 52) {
        if (targetRank !== 1 || weldBuildId === undefined || row.insight !== undefined) {
          throw new GameProtocolError(`${optionField} is not a valid Spell Welding choice`)
        }
        if (weldBuildId < 1000 || weldBuildId > 1009) {
          throw new GameProtocolError(`${optionField}.weldBuildId is out of range`)
        }
      } else if (weldBuildId !== undefined) {
        throw new GameProtocolError(`${optionField}.weldBuildId requires Spell Welding`)
      }
      return {
        ...(insight === undefined ? {} : { insight: true as const }),
        skillId,
        targetRank,
        ...(weldBuildId === undefined ? {} : { weldBuildId }),
      }
    }),
    sequence: nonnegativeInteger(source.sequence, `${field}.sequence`),
  }
}

function optionalFinite(value: unknown, field: string): number | undefined {
  return value === undefined ? undefined : finite(value, field)
}

function optionalInteger(value: unknown, field: string): number | undefined {
  return value === undefined ? undefined : integer(value, field)
}

function boneyardPoint(value: unknown, field: string): BoneyardPoint {
  return vector(value, field)
}

function boneyardBounds(value: unknown, field: string): BoneyardBounds {
  const source = record(value, field)
  onlyKeys(source, field, ['h', 'w', 'x', 'y'])
  return {
    h: positiveFinite(source.h, `${field}.h`),
    w: positiveFinite(source.w, `${field}.w`),
    x: finite(source.x, `${field}.x`),
    y: finite(source.y, `${field}.y`),
  }
}

function boneyardArenaTransition(
  value: unknown,
  field: string,
): BoneyardArenaTransitionState | null {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'blendFactor',
    'cameraBounds',
    'combatBounds',
    'entrySide',
    'fullBounds',
    'phase',
    'sealTicksRemaining',
  ])
  const blendFactor = finite(source.blendFactor, `${field}.blendFactor`)
  if (blendFactor < 0 || blendFactor > 1) {
    throw new GameProtocolError(`${field}.blendFactor must be within [0,1]`)
  }
  const phase = limitedString(source.phase, `${field}.phase`, 16)
  if (!(BONEYARD_ARENA_TRANSITION_PHASES as readonly string[]).includes(phase)) {
    throw new GameProtocolError(`${field}.phase is not supported`)
  }
  const entrySide = limitedString(source.entrySide, `${field}.entrySide`, 8)
  if (entrySide !== 'north' && entrySide !== 'south') {
    throw new GameProtocolError(`${field}.entrySide is not supported`)
  }
  const sealTicksRemaining = nonnegativeInteger(
    source.sealTicksRemaining,
    `${field}.sealTicksRemaining`,
  )
  if (sealTicksRemaining > BONEYARD_ARENA_SEAL_TICKS) {
    throw new GameProtocolError(
      `${field}.sealTicksRemaining may not exceed ${BONEYARD_ARENA_SEAL_TICKS}`,
    )
  }
  const cameraBounds = boneyardBounds(source.cameraBounds, `${field}.cameraBounds`)
  const combatBounds = boneyardBounds(source.combatBounds, `${field}.combatBounds`)
  const fullBounds = boneyardBounds(source.fullBounds, `${field}.fullBounds`)
  const expectedCombatY = Math.fround(fullBounds.y + (
    entrySide === 'north' ? BONEYARD_ARENA_NORTH_TARGET_INSET : 0
  ))
  if (
    combatBounds.x !== fullBounds.x
    || combatBounds.y !== expectedCombatY
    || combatBounds.w !== fullBounds.w
    || combatBounds.h !== Math.fround(
      fullBounds.h - BONEYARD_ARENA_ENTRANCE_EXTENSION,
    )
  ) {
    throw new GameProtocolError(`${field}.combatBounds do not match the entry side`)
  }
  if (
    phase === 'open'
      ? sealTicksRemaining !== 0 || blendFactor !== 0
      : phase === 'locking'
        ? sealTicksRemaining === 0 || blendFactor === 0
        : sealTicksRemaining !== 0 || blendFactor === 0
  ) {
    throw new GameProtocolError(`${field} phase fields are inconsistent`)
  }
  if (
    cameraBounds.x < fullBounds.x
    || cameraBounds.y < fullBounds.y
    || cameraBounds.x + cameraBounds.w > fullBounds.x + fullBounds.w
    || cameraBounds.y + cameraBounds.h > fullBounds.y + fullBounds.h
  ) {
    throw new GameProtocolError(`${field}.cameraBounds must remain within fullBounds`)
  }
  return {
    blendFactor,
    cameraBounds,
    combatBounds,
    entrySide,
    fullBounds,
    phase: phase as BoneyardArenaTransitionState['phase'],
    sealTicksRemaining,
  }
}

function boneyardChoice(value: unknown, field: string): BoneyardChoice {
  const source = record(value, field)
  onlyKeys(source, field, ['id', 'name', 'source', 'modId', 'modName'])
  const kind = limitedString(source.source, `${field}.source`, 16)
  if (kind !== 'default' && kind !== 'mod') {
    throw new GameProtocolError(`${field}.source must be default or mod`)
  }
  return {
    id: limitedString(source.id, `${field}.id`, 256),
    name: limitedString(source.name, `${field}.name`, 256),
    source: kind,
    ...(source.modId === undefined
      ? {}
      : { modId: limitedString(source.modId, `${field}.modId`, 128) }),
    ...(source.modName === undefined
      ? {}
      : { modName: limitedString(source.modName, `${field}.modName`, 256) }),
  }
}

function boneyardChoices(value: unknown): readonly BoneyardChoice[] {
  const choices = limitedArray(value, 'boneyards', MAX_BONEYARD_CHOICES).map((choice, index) => (
    boneyardChoice(choice, `boneyards[${index}]`)
  ))
  if (choices.length === 0) throw new GameProtocolError('boneyards must not be empty')
  return choices
}

function boneyardObject(value: unknown, field: string): BoneyardObject {
  const source = record(value, field)
  onlyKeys(source, field, [
    'eid',
    'typeId',
    'pos',
    'variant',
    'rot',
    'scale',
    'sortBias',
    'atlasEntry',
    'secondaryAtlasEntry',
    'secondaryVariant',
    'secondaryVisible',
    'overlayAtlasEntry',
    'overlayVariant',
    'atlasEntries',
  ])
  return {
    eid: limitedString(source.eid, `${field}.eid`, 128),
    typeId: integer(source.typeId, `${field}.typeId`),
    pos: boneyardPoint(source.pos, `${field}.pos`),
    ...optionalNumberField(source, field, 'variant', optionalInteger),
    ...optionalNumberField(source, field, 'rot', optionalFinite),
    ...optionalNumberField(source, field, 'scale', optionalFinite),
    ...optionalNumberField(source, field, 'sortBias', optionalFinite),
    ...optionalNumberField(source, field, 'atlasEntry', optionalInteger),
    ...optionalNumberField(source, field, 'secondaryAtlasEntry', optionalInteger),
    ...optionalNumberField(source, field, 'secondaryVariant', optionalInteger),
    ...(source.secondaryVisible === undefined
      ? {}
      : { secondaryVisible: boolean(source.secondaryVisible, `${field}.secondaryVisible`) }),
    ...optionalNumberField(source, field, 'overlayAtlasEntry', optionalInteger),
    ...optionalNumberField(source, field, 'overlayVariant', optionalInteger),
    ...(source.atlasEntries === undefined
      ? {}
      : {
          atlasEntries: limitedArray(source.atlasEntries, `${field}.atlasEntries`, 32)
            .map((entry, index) => integer(entry, `${field}.atlasEntries[${index}]`)),
        }),
  }
}

function boneyardSprite(value: unknown, field: string): BoneyardSprite {
  const source = record(value, field)
  onlyKeys(source, field, [
    'eid', 'atlasEntry', 'deadHawgEntry', 'pos', 's0', 's1', 's2', 'flags',
  ])
  return {
    eid: limitedString(source.eid, `${field}.eid`, 128),
    atlasEntry: integer(source.atlasEntry, `${field}.atlasEntry`),
    ...optionalNumberField(source, field, 'deadHawgEntry', optionalInteger),
    pos: boneyardPoint(source.pos, `${field}.pos`),
    s0: finite(source.s0, `${field}.s0`),
    s1: finite(source.s1, `${field}.s1`),
    s2: finite(source.s2, `${field}.s2`),
    flags: integer(source.flags, `${field}.flags`),
  }
}

function boneyardLine(
  value: unknown,
  field: string,
  kind: 'road' | 'fence',
): BoneyardRoad | BoneyardFence {
  const source = record(value, field)
  onlyKeys(source, field, kind === 'fence'
    ? [
        'eid', 'typeId', 'points', 'style', 'segmentCode',
        'startPostVariant', 'endPostVariant',
      ]
    : [
        'eid', 'typeId', 'points', 'style', 'startWidthScale', 'endWidthScale',
        'quad', 'linkMask',
      ])
  const common = {
    eid: limitedString(source.eid, `${field}.eid`, 128),
    typeId: integer(source.typeId, `${field}.typeId`),
    points: limitedArray(source.points, `${field}.points`, 256)
      .map((entry, index) => boneyardPoint(entry, `${field}.points[${index}]`)),
    ...optionalNumberField(source, field, 'style', optionalInteger),
  }
  if (common.points.length < 2) throw new GameProtocolError(`${field}.points needs two points`)
  if (kind === 'fence') {
    return {
      ...common,
      ...optionalNumberField(source, field, 'segmentCode', optionalInteger),
      ...optionalNumberField(source, field, 'startPostVariant', optionalInteger),
      ...optionalNumberField(source, field, 'endPostVariant', optionalInteger),
    }
  }
  return {
    ...common,
    linkMask: integerWithin(source.linkMask, `${field}.linkMask`, 0, 3) as BoneyardRoad['linkMask'],
    ...optionalNumberField(source, field, 'startWidthScale', optionalFinite),
    ...optionalNumberField(source, field, 'endWidthScale', optionalFinite),
    ...(source.quad === undefined
      ? {}
      : {
          quad: limitedArray(source.quad, `${field}.quad`, 4)
            .map((entry, index) => boneyardPoint(entry, `${field}.quad[${index}]`)),
        }),
  }
}

function boneyardTerrain(value: unknown, field: string): BoneyardTerrain {
  const source = record(value, field)
  onlyKeys(source, field, ['eid', 'pos', 'points', 'style', 'entry'])
  return {
    eid: limitedString(source.eid, `${field}.eid`, 128),
    pos: boneyardPoint(source.pos, `${field}.pos`),
    ...(source.points === undefined
      ? {}
      : {
          points: limitedArray(source.points, `${field}.points`, 256)
            .map((entry, index) => boneyardPoint(entry, `${field}.points[${index}]`)),
        }),
    ...optionalNumberField(source, field, 'style', optionalInteger),
    ...optionalNumberField(source, field, 'entry', optionalInteger),
  }
}

function optionalNumberField(
  source: Record<string, unknown>,
  field: string,
  key: string,
  decode: (value: unknown, field: string) => number | undefined,
): Record<string, number> {
  const value = decode(source[key], `${field}.${key}`)
  return value === undefined ? {} : { [key]: value }
}

function boneyardScene(value: unknown): BoneyardScene {
  const source = record(value, 'boneyard.scene')
  onlyKeys(source, 'boneyard.scene', [
    'name', 'environmentMode', 'bounds', 'spawn', 'objects', 'sprites', 'roads',
    'fences', 'terrain', 'solomonDig',
  ])
  const boundsSource = record(source.bounds, 'boneyard.scene.bounds')
  const spawnSource = record(source.spawn, 'boneyard.scene.spawn')
  onlyKeys(boundsSource, 'boneyard.scene.bounds', ['x', 'y', 'w', 'h'])
  onlyKeys(spawnSource, 'boneyard.scene.spawn', ['x', 'y', 'facingDeg'])
  const bounds: BoneyardBounds = {
    x: finite(boundsSource.x, 'boneyard.scene.bounds.x'),
    y: finite(boundsSource.y, 'boneyard.scene.bounds.y'),
    w: positiveFinite(boundsSource.w, 'boneyard.scene.bounds.w'),
    h: positiveFinite(boundsSource.h, 'boneyard.scene.bounds.h'),
  }
  return {
    name: limitedString(source.name, 'boneyard.scene.name', 256),
    environmentMode: byte(source.environmentMode, 'boneyard.scene.environmentMode'),
    bounds,
    spawn: {
      x: finite(spawnSource.x, 'boneyard.scene.spawn.x'),
      y: finite(spawnSource.y, 'boneyard.scene.spawn.y'),
      facingDeg: finite(spawnSource.facingDeg, 'boneyard.scene.spawn.facingDeg'),
    },
    objects: limitedArray(source.objects, 'boneyard.scene.objects', MAX_BONEYARD_OBJECTS)
      .map((entry, index) => boneyardObject(entry, `boneyard.scene.objects[${index}]`)),
    sprites: limitedArray(source.sprites, 'boneyard.scene.sprites', MAX_BONEYARD_SPRITES)
      .map((entry, index) => boneyardSprite(entry, `boneyard.scene.sprites[${index}]`)),
    roads: limitedArray(source.roads, 'boneyard.scene.roads', MAX_BONEYARD_STRUCTURES)
      .map((entry, index) => boneyardLine(entry, `boneyard.scene.roads[${index}]`, 'road') as BoneyardRoad),
    fences: limitedArray(source.fences, 'boneyard.scene.fences', MAX_BONEYARD_STRUCTURES)
      .map((entry, index) => boneyardLine(entry, `boneyard.scene.fences[${index}]`, 'fence') as BoneyardFence),
    terrain: limitedArray(source.terrain, 'boneyard.scene.terrain', MAX_BONEYARD_STRUCTURES)
      .map((entry, index) => boneyardTerrain(entry, `boneyard.scene.terrain[${index}]`)),
    solomonDig: source.solomonDig === null
      ? null
      : solomonDigState(source.solomonDig),
  }
}

function byte(value: unknown, field: string): number {
  const result = nonnegativeInteger(value, field)
  if (result > 255) throw new GameProtocolError(`${field} must be a byte`)
  return result
}

function solomonDigState(value: unknown): NonNullable<BoneyardScene['solomonDig']> {
  const field = 'boneyard.scene.solomonDig'
  const source = record(value, field)
  onlyKeys(source, field, [
    'gravePosition', 'lanternPosition', 'position', 'frameProgram', 'ticksPerFrame',
  ])
  const frameProgram = limitedArray(
    source.frameProgram,
    `${field}.frameProgram`,
    256,
  ).map((frame, index) => {
    const decoded = nonnegativeInteger(frame, `${field}.frameProgram[${index}]`)
    if (decoded > 17) throw new GameProtocolError('Solomon Dig frame exceeds record bank')
    return decoded
  })
  if (frameProgram.length === 0) throw new GameProtocolError('Solomon Dig frame program is empty')
  return {
    gravePosition: boneyardPoint(source.gravePosition, `${field}.gravePosition`),
    lanternPosition: boneyardPoint(source.lanternPosition, `${field}.lanternPosition`),
    position: boneyardPoint(source.position, `${field}.position`),
    frameProgram,
    ticksPerFrame: positiveInteger(source.ticksPerFrame, `${field}.ticksPerFrame`),
  }
}

function loadedBoneyard(value: unknown): LoadedBoneyard {
  const source = record(value, 'boneyard')
  onlyKeys(source, 'boneyard', [
    'choice', 'runId', 'seed', 'sourceSha256', 'geometrySha256', 'scene',
  ])
  return {
    choice: boneyardChoice(source.choice, 'boneyard.choice'),
    runId: limitedString(source.runId, 'boneyard.runId', 128),
    seed: limitedString(source.seed, 'boneyard.seed', 128),
    sourceSha256: sha256(source.sourceSha256, 'boneyard.sourceSha256'),
    geometrySha256: sha256(source.geometrySha256, 'boneyard.geometrySha256'),
    scene: boneyardScene(source.scene),
  }
}

function studentState(value: unknown, field: string): ProtocolStudentState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'framePhase',
    'gaitDegrees',
    'heading',
    'headingIndex',
    'id',
    'position',
    'props',
    'reading',
    'scale',
  ])
  const props = limitedArray(
    source.props,
    `${field}.props`,
    MAX_STUDENT_PROPS,
  ).map((entry, index) => {
    const prop = record(entry, `${field}.props[${index}]`)
    return {
      angle: finite(prop.angle, `${field}.props[${index}].angle`),
      paletteIndex: nonnegativeInteger(
        prop.paletteIndex,
        `${field}.props[${index}].paletteIndex`,
      ),
      radius: finite(prop.radius, `${field}.props[${index}].radius`),
    }
  })
  return {
    framePhase: finite(source.framePhase, `${field}.framePhase`),
    gaitDegrees: finite(source.gaitDegrees, `${field}.gaitDegrees`),
    heading: finite(source.heading, `${field}.heading`),
    headingIndex: integer(source.headingIndex, `${field}.headingIndex`),
    id: nonnegativeInteger(source.id, `${field}.id`),
    position: vector(source.position, `${field}.position`),
    props,
    reading: boolean(source.reading, `${field}.reading`),
    scale: positiveFinite(source.scale, `${field}.scale`),
  }
}

function ambientState(value: unknown, field: string): ProtocolAmbientState {
  const source = record(value, field)
  return {
    fountainParticles: limitedArray(
      source.fountainParticles,
      `${field}.fountainParticles`,
      MAX_FOUNTAIN_PARTICLES,
    ).map((entry, index) => {
      const particle = record(entry, `${field}.fountainParticles[${index}]`)
      return {
        id: nonnegativeInteger(particle.id, `${field}.fountainParticles[${index}].id`),
        remaining: finite(
          particle.remaining,
          `${field}.fountainParticles[${index}].remaining`,
        ),
        scale: positiveFinite(
          particle.scale,
          `${field}.fountainParticles[${index}].scale`,
        ),
      }
    }),
    nextFountainParticleId: nonnegativeInteger(
      source.nextFountainParticleId,
      `${field}.nextFountainParticleId`,
    ),
    rngState: nonnegativeInteger(source.rngState, `${field}.rngState`),
    sealCorePhase: finite(source.sealCorePhase, `${field}.sealCorePhase`),
    sealGlyphPhase: finite(source.sealGlyphPhase, `${field}.sealGlyphPhase`),
    statuePhaseDegrees: finite(source.statuePhaseDegrees, `${field}.statuePhaseDegrees`),
  }
}

function hubWorldSnapshot(value: unknown, field: string): HubWorldSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'ambient',
    'collisionRngState',
    'kind',
    'memorial',
    'participants',
    'skorcha',
    'students',
    'traderAnimationSeed',
  ])
  if (source.kind !== 'hub') throw new GameProtocolError(`${field}.kind is not supported`)
  const rawParticipants = record(source.participants, `${field}.participants`)
  if (Object.keys(rawParticipants).length > MAX_PLAYERS) {
    throw new GameProtocolError(
      `${field}.participants may contain at most ${MAX_PLAYERS} entries`,
    )
  }
  const participants: Record<string, ProtocolHubParticipantState> = {}
  for (const [rawPlayerId, state] of Object.entries(rawParticipants)) {
    const playerId = validatedPlayerId(rawPlayerId, `${field} participant id`)
    participants[playerId] = hubParticipantState(
      state,
      `${field}.participants.${playerId}`,
    )
  }
  return {
    ambient: ambientState(source.ambient, `${field}.ambient`),
    collisionRngState: nonnegativeInteger(
      source.collisionRngState,
      `${field}.collisionRngState`,
    ),
    kind: 'hub',
    memorial: decodeHubMemorialState(source.memorial, `${field}.memorial`),
    participants,
    skorcha: hubSkorchaState(source.skorcha, `${field}.skorcha`),
    students: limitedArray(source.students, `${field}.students`, MAX_STUDENTS).map(
      (student, index) => studentState(student, `${field}.students[${index}]`),
    ),
    traderAnimationSeed: nonnegativeInteger(
      source.traderAnimationSeed,
      `${field}.traderAnimationSeed`,
    ),
  }
}

export function decodeHubMemorialState(
  value: unknown,
  field = 'memorial',
): HubMemorialState {
  const source = record(value, field)
  onlyKeys(source, field, ['nextAge', 'nextPortraitId', 'slots'])
  const nextAge = positiveInteger(source.nextAge, `${field}.nextAge`)
  const nextPortraitId = integerWithin(
    source.nextPortraitId,
    `${field}.nextPortraitId`,
    HUB_MEMORIAL_FIRST_EXTERNAL_PORTRAIT_ID,
    HUB_MEMORIAL_LAST_EXTERNAL_PORTRAIT_ID,
  )
  const rawSlots = array(source.slots, `${field}.slots`)
  if (rawSlots.length !== HUB_MEMORIAL_SLOT_COUNT) {
    throw new GameProtocolError(`${field}.slots must contain ten Painting slots`)
  }
  const identities = new Set<string>()
  const portraitIds = new Set<number>()
  const ages = new Set<number>()
  const slots = rawSlots.map((value, index) => {
    const slotField = `${field}.slots[${index}]`
    const slot = record(value, slotField)
    onlyKeys(slot, slotField, ['age', 'marker', 'portrait', 'portraitId'])
    const age = nonnegativeInteger(slot.age, `${slotField}.age`)
    if (ages.has(age)) throw new GameProtocolError(`${field}.slots duplicates age ${age}`)
    ages.add(age)
    const marker = boolean(slot.marker, `${slotField}.marker`)
    const portraitId = nonnegativeInteger(slot.portraitId, `${slotField}.portraitId`)
    if (slot.portrait === null) {
      if (
        portraitId !== index
        || age !== HUB_MEMORIAL_INITIAL_SLOT_AGES[index]
        || marker !== HUB_MEMORIAL_INITIAL_MARKERS[index]
      ) throw new GameProtocolError(`${slotField} does not match its stock resident`)
      return { age, marker, portrait: null, portraitId }
    }
    if (
      portraitId < HUB_MEMORIAL_FIRST_EXTERNAL_PORTRAIT_ID
      || portraitId > HUB_MEMORIAL_LAST_EXTERNAL_PORTRAIT_ID
      || portraitIds.has(portraitId)
    ) throw new GameProtocolError(`${slotField}.portraitId is not a unique external id`)
    portraitIds.add(portraitId)
    const portraitField = `${slotField}.portrait`
    const portrait = record(slot.portrait, portraitField)
    onlyKeys(portrait, portraitField, [
      'accountUsername',
      'awesomeness',
      'awesomestKill',
      'capturedAtTick',
      'config',
      'elapsedTicks',
      'equipment',
      'headingIndex',
      'level',
      'monstersKilled',
      'playerId',
      'portraitScale',
      'runId',
      'wave',
    ])
    const playerId = validatedPlayerId(portrait.playerId, `${portraitField}.playerId`)
    const runId = limitedString(portrait.runId, `${portraitField}.runId`, 128)
    const identity = `${runId}\0${playerId}`
    if (identities.has(identity)) {
      throw new GameProtocolError(`${field}.slots duplicates a completed run participant`)
    }
    identities.add(identity)
    const portraitScale = positiveFinite(
      portrait.portraitScale,
      `${portraitField}.portraitScale`,
    )
    if (
      portraitScale < NATIVE_HALL_OF_FAME_SCORE.portraitScaleBase
      || portraitScale > 1
    ) throw new GameProtocolError(`${portraitField}.portraitScale is outside its native range`)
    return {
      age,
      marker,
      portrait: {
        accountUsername: portrait.accountUsername === null
          ? null
          : limitedString(portrait.accountUsername, `${portraitField}.accountUsername`, 64),
        awesomeness: integerWithin(
          portrait.awesomeness,
          `${portraitField}.awesomeness`,
          0,
          2_000_000_000,
        ),
        awesomestKill: portrait.awesomestKill === null
          ? null
          : limitedString(portrait.awesomestKill, `${portraitField}.awesomestKill`, 64),
        capturedAtTick: nonnegativeInteger(
          portrait.capturedAtTick,
          `${portraitField}.capturedAtTick`,
        ),
        config: playerCharacterConfig(portrait.config, `${portraitField}.config`),
        elapsedTicks: integerWithin(
          portrait.elapsedTicks,
          `${portraitField}.elapsedTicks`,
          0,
          60_480_000,
        ),
        equipment: hubMemorialEquipmentAppearance(
          portrait.equipment,
          `${portraitField}.equipment`,
        ),
        headingIndex: integerWithin(
          portrait.headingIndex,
          `${portraitField}.headingIndex`,
          0,
          23,
        ),
        level: integerWithin(portrait.level, `${portraitField}.level`, 1, 10_000),
        monstersKilled: integerWithin(
          portrait.monstersKilled,
          `${portraitField}.monstersKilled`,
          0,
          2_000_000_000,
        ),
        playerId,
        portraitScale,
        runId,
        wave: integerWithin(portrait.wave, `${portraitField}.wave`, 0, 1_000_000),
      },
      portraitId,
    }
  })
  const completionCount = nextAge - 1001
  if (completionCount < 0) throw new GameProtocolError(`${field}.nextAge precedes stock defaults`)
  const dynamicSlots = slots.filter(({ portrait }) => portrait !== null)
  if (dynamicSlots.length !== Math.min(completionCount, HUB_MEMORIAL_SLOT_COUNT)) {
    throw new GameProtocolError(`${field}.slots do not match the portrait age counter`)
  }
  const expectedAges = Array.from(
    { length: dynamicSlots.length },
    (_, index) => nextAge - dynamicSlots.length + index,
  )
  const dynamicAges = dynamicSlots.map(({ age }) => age).sort((left, right) => left - right)
  if (dynamicAges.some((age, index) => age !== expectedAges[index])) {
    throw new GameProtocolError(`${field}.slots do not retain the newest FIFO ages`)
  }
  const expectedPortraitId = HUB_MEMORIAL_FIRST_EXTERNAL_PORTRAIT_ID
    + completionCount % HUB_MEMORIAL_SLOT_COUNT
  if (nextPortraitId !== expectedPortraitId) {
    throw new GameProtocolError(`${field}.nextPortraitId does not match the ten-id ring`)
  }
  return { nextAge, nextPortraitId, slots }
}

function hubMemorialEquipmentAppearance(
  value: unknown,
  field: string,
): PlayerLivingEquipmentAppearance {
  const source = record(value, field)
  onlyKeys(source, field, ['hat', 'robe', 'weapon'])
  return {
    hat: source.hat === null ? null : hubMemorialTintedSelector(source.hat, `${field}.hat`, 3),
    robe: source.robe === null ? null : hubMemorialTintedSelector(source.robe, `${field}.robe`, 2),
    weapon: source.weapon === null
      ? null
      : (() => {
          const weapon = record(source.weapon, `${field}.weapon`)
          onlyKeys(weapon, `${field}.weapon`, ['kind', 'selector'])
          const kind = limitedString(weapon.kind, `${field}.weapon.kind`, 8)
          if (kind !== 'staff' && kind !== 'wand') {
            throw new GameProtocolError(`${field}.weapon.kind is not supported`)
          }
          return {
            kind,
            selector: integerWithin(
              weapon.selector,
              `${field}.weapon.selector`,
              0,
              5,
            ),
          }
        })(),
  }
}

function hubMemorialTintedSelector(
  value: unknown,
  field: string,
  maximumSelector: number,
) {
  const source = record(value, field)
  onlyKeys(source, field, ['primaryTint', 'secondaryTint', 'selector'])
  return {
    primaryTint: integerWithin(source.primaryTint, `${field}.primaryTint`, 0, 0xffffff),
    secondaryTint: integerWithin(source.secondaryTint, `${field}.secondaryTint`, 0, 0xffffff),
    selector: integerWithin(source.selector, `${field}.selector`, 0, maximumSelector),
  }
}

function playerLevelUpBarrier(
  value: unknown,
  field: string,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
  run: GameRunLifecycleState,
): NonNullable<GameSnapshot['levelUpBarrier']> {
  const source = record(value, field)
  onlyKeys(source, field, [
    'barrierId',
    'milestoneExperience',
    'milestoneLevel',
    'participantIds',
    'pendingPlayerIds',
    'runId',
    'sourcePlayerId',
  ])
  const participantIds = validatedBarrierPlayerIds(
    source.participantIds,
    `${field}.participantIds`,
    players,
  )
  if (participantIds.length === 0) {
    throw new GameProtocolError(`${field}.participantIds must not be empty`)
  }
  const pendingPlayerIds = validatedBarrierPlayerIds(
    source.pendingPlayerIds,
    `${field}.pendingPlayerIds`,
    players,
  )
  if (pendingPlayerIds.length === 0) {
    throw new GameProtocolError(`${field}.pendingPlayerIds must not be empty`)
  }
  if (pendingPlayerIds.some((playerId) => !participantIds.includes(playerId))) {
    throw new GameProtocolError(`${field}.pendingPlayerIds must belong to the cohort`)
  }
  for (const playerId of pendingPlayerIds) {
    if (players[playerId]?.progression.pendingOffer === null) {
      throw new GameProtocolError(`${field} pending player has no skill offer`)
    }
  }
  const sourcePlayerId = validatedPlayerId(source.sourcePlayerId, `${field}.sourcePlayerId`)
  if (!participantIds.includes(sourcePlayerId)) {
    throw new GameProtocolError(`${field}.sourcePlayerId must belong to the cohort`)
  }
  const runId = source.runId === null
    ? null
    : limitedString(source.runId, `${field}.runId`, 256)
  const expectedRunId = run.phase === 'active' ? run.runId : null
  if (runId !== expectedRunId) {
    throw new GameProtocolError(`${field}.runId does not match the active run`)
  }
  const milestoneExperience = nonnegativeFinite(
    source.milestoneExperience,
    `${field}.milestoneExperience`,
  )
  if (milestoneExperience > 10_000_000) {
    throw new GameProtocolError(`${field}.milestoneExperience is out of range`)
  }
  const milestoneLevel = positiveInteger(source.milestoneLevel, `${field}.milestoneLevel`)
  if (milestoneLevel > 75) {
    throw new GameProtocolError(`${field}.milestoneLevel is out of range`)
  }
  return {
    barrierId: positiveInteger(source.barrierId, `${field}.barrierId`),
    milestoneExperience,
    milestoneLevel,
    participantIds,
    pendingPlayerIds,
    runId,
    sourcePlayerId,
  }
}

function validatedBarrierPlayerIds(
  value: unknown,
  field: string,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
): readonly string[] {
  const playerIds = limitedArray(value, field, MAX_PLAYERS).map((entry, index) => (
    validatedPlayerId(entry, `${field}[${index}]`)
  ))
  if (playerIds.some((playerId, index) => (
    !players[playerId] || (index > 0 && playerId <= playerIds[index - 1]!)
  ))) {
    throw new GameProtocolError(`${field} must be sorted, unique, and present in players`)
  }
  return playerIds
}

function validatedMaterializingPlayerIds(
  value: unknown,
  field: string,
  players: Readonly<Record<string, unknown>>,
): readonly string[] {
  const playerIds = limitedArray(value, field, MAX_PLAYERS).map((entry, index) => (
    validatedPlayerId(entry, `${field}[${index}]`)
  ))
  if (playerIds.some((playerId, index) => (
    !players[playerId] || (index > 0 && playerId <= playerIds[index - 1]!)
  ))) {
    throw new GameProtocolError(`${field} must be sorted, unique, and present in players`)
  }
  return playerIds
}

function gameSnapshot(value: unknown): GameSnapshot {
  const source = record(value, 'snapshot')
  onlyKeys(source, 'snapshot', [
    'hostPlayerId', 'levelUpBarrier', 'materializingPlayerIds', 'modEffects', 'players',
    'primarySpells', 'run', 'secondaryAbilities', 'tick', 'world',
  ])
  const rawPlayers = record(source.players, 'snapshot.players')
  if (Object.keys(rawPlayers).length > MAX_PLAYERS) {
    throw new GameProtocolError(`snapshot.players may contain at most ${MAX_PLAYERS} entries`)
  }
  const players: Record<string, ProtocolPlayerState> = {}
  for (const [rawPlayerId, state] of Object.entries(rawPlayers)) {
    const playerId = validatedPlayerId(rawPlayerId, 'snapshot player id')
    players[playerId] = playerState(
      state,
      `snapshot.players.${playerId}`,
    )
  }
  const hostPlayerId = source.hostPlayerId === null
    ? null
    : validatedPlayerId(source.hostPlayerId, 'snapshot.hostPlayerId')
  const tick = nonnegativeInteger(source.tick, 'snapshot.tick')
  const modEffects = protocolModEffects(source.modEffects, 'snapshot.modEffects', players, tick)
  const world = gameWorldSnapshot(source.world, 'snapshot.world', tick)
  const run = gameRunLifecycle(source.run, 'snapshot.run')
  const levelUpBarrier = source.levelUpBarrier === null
    ? null
    : playerLevelUpBarrier(source.levelUpBarrier, 'snapshot.levelUpBarrier', players, run)
  const materializingPlayerIds = validatedMaterializingPlayerIds(
    source.materializingPlayerIds,
    'snapshot.materializingPlayerIds',
    players,
  )
  validateGameRunWorld(run, world, 'snapshot')
  validateHallOfFameArchivePhase(run, world, 'snapshot')
  const primarySpells = primarySpellState(source.primarySpells, 'snapshot.primarySpells')
  validatePrimarySpellOwners(primarySpells, players, 'snapshot.primarySpells')
  const secondaryAbilities = nativeSecondaryState(
    source.secondaryAbilities,
    'snapshot.secondaryAbilities',
    players,
  )
  if (world.kind === 'hub') {
    const participantIds = Object.keys(world.participants).sort()
    const playerIds = Object.keys(players).sort()
    if (
      participantIds.length !== playerIds.length
      || participantIds.some((id, index) => id !== playerIds[index])
    ) {
      throw new GameProtocolError(
        'snapshot.world.participants must match snapshot.players exactly',
      )
    }
  } else {
    validateHallOfFameRunOwners(world.hallOfFameRuns, players, 'snapshot')
  }
  return {
    hostPlayerId,
    levelUpBarrier,
    materializingPlayerIds,
    modEffects,
    players,
    primarySpells,
    secondaryAbilities,
    run,
    tick,
    world,
  }
}

function gameSnapshotFrame(value: unknown): GameSnapshotFrame {
  const source = record(value, 'frame')
  onlyKeys(source, 'frame', [
    'hostPlayerId', 'levelUpBarrier', 'materializingPlayerIds', 'modEffects', 'players',
    'primarySpells', 'run', 'secondaryAbilities', 'tick', 'world',
  ])
  const rawPlayers = record(source.players, 'frame.players')
  if (Object.keys(rawPlayers).length > MAX_PLAYERS) {
    throw new GameProtocolError(`frame.players may contain at most ${MAX_PLAYERS} entries`)
  }
  const players: Record<string, ProtocolPlayerSnapshotFrame> = {}
  for (const [rawPlayerId, state] of Object.entries(rawPlayers)) {
    const playerId = validatedPlayerId(rawPlayerId, 'frame player id')
    players[playerId] = playerSnapshotFrame(state, `frame.players.${playerId}`)
  }
  const hostPlayerId = source.hostPlayerId === null
    ? null
    : validatedPlayerId(source.hostPlayerId, 'frame.hostPlayerId')
  const tick = nonnegativeInteger(source.tick, 'frame.tick')
  const modEffects = protocolModEffects(source.modEffects, 'frame.modEffects', players, tick)
  const world = gameWorldSnapshotFrame(source.world, 'frame.world', tick)
  const run = gameRunLifecycle(source.run, 'frame.run')
  const levelUpBarrier = source.levelUpBarrier === null
    ? null
    : playerLevelUpBarrier(source.levelUpBarrier, 'frame.levelUpBarrier', players, run)
  const materializingPlayerIds = validatedMaterializingPlayerIds(
    source.materializingPlayerIds,
    'frame.materializingPlayerIds',
    players,
  )
  validateGameRunWorld(run, world, 'frame')
  validateHallOfFameArchivePhase(run, world, 'frame')
  const primarySpells = primarySpellState(source.primarySpells, 'frame.primarySpells')
  validatePrimarySpellOwners(primarySpells, players, 'frame.primarySpells')
  const secondaryAbilities = nativeSecondaryState(
    source.secondaryAbilities,
    'frame.secondaryAbilities',
    players,
  )
  if (world.kind === 'hub') {
    validateParticipantOwnership(world.participants, players, 'frame')
  } else {
    validateHallOfFameRunOwners(world.hallOfFameRuns, players, 'frame')
  }
  return {
    hostPlayerId,
    levelUpBarrier,
    materializingPlayerIds,
    modEffects,
    players,
    primarySpells,
    secondaryAbilities,
    run,
    tick,
    world,
  }
}

function protocolModEffects(
  value: unknown,
  field: string,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
  tick: number,
): readonly ProtocolModEffect[] {
  return limitedArray(value, field, 256).map((value, index) => {
    const effectField = `${field}[${index}]`
    const source = record(value, effectField)
    onlyKeys(source, effectField, [
      'color', 'contentId', 'expiresTick', 'playerId', 'startedTick', 'useId',
    ])
    const contentId = limitedString(source.contentId, `${effectField}.contentId`, 19)
    if (!/^[1-9][0-9]{0,18}$/.test(contentId)) {
      throw new GameProtocolError(`${effectField}.contentId is invalid`)
    }
    const playerId = validatedPlayerId(source.playerId, `${effectField}.playerId`)
    if (!players[playerId]) throw new GameProtocolError(`${effectField}.playerId is not present`)
    const startedTick = nonnegativeInteger(source.startedTick, `${effectField}.startedTick`)
    const expiresTick = positiveInteger(source.expiresTick, `${effectField}.expiresTick`)
    if (startedTick > tick || expiresTick <= tick || expiresTick <= startedTick) {
      throw new GameProtocolError(`${effectField} has an invalid active interval`)
    }
    const rawColor = array(source.color, `${effectField}.color`)
    if (rawColor.length !== 4) throw new GameProtocolError(`${effectField}.color must contain RGBA`)
    const color = rawColor.map((component, colorIndex) => {
      const value = finite(component, `${effectField}.color[${colorIndex}]`)
      if (value < 0 || value > 1) {
        throw new GameProtocolError(`${effectField}.color[${colorIndex}] must be within 0..1`)
      }
      return value
    }) as [number, number, number, number]
    return {
      color,
      contentId,
      expiresTick,
      playerId,
      startedTick,
      useId: positiveInteger(source.useId, `${effectField}.useId`),
    }
  })
}

function gameRunLifecycle(value: unknown, field: string): GameRunLifecycleState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'eligiblePlayerIds',
    'gameOverEventId',
    'gameOverExitKind',
    'gameOverExitTicks',
    'gameOverTicks',
    'lastCompletedRunId',
    'loadoutReadyPlayerIds',
    'nextGameOverEventId',
    'phase',
    'runId',
  ])
  const phase = limitedString(source.phase, `${field}.phase`, 32)
  if (!(GAME_RUN_PHASES as readonly string[]).includes(phase)) {
    throw new GameProtocolError(`${field}.phase is not supported`)
  }
  const eligiblePlayerIds = limitedArray(
    source.eligiblePlayerIds,
    `${field}.eligiblePlayerIds`,
    MAX_PLAYERS,
  ).map((playerId, index) => validatedPlayerId(
    playerId,
    `${field}.eligiblePlayerIds[${index}]`,
  ))
  if (eligiblePlayerIds.some((playerId, index) => (
    index > 0 && playerId <= eligiblePlayerIds[index - 1]!
  ))) throw new GameProtocolError(`${field}.eligiblePlayerIds must be unique and sorted`)
  const loadoutReadyPlayerIds = limitedArray(
    source.loadoutReadyPlayerIds,
    `${field}.loadoutReadyPlayerIds`,
    MAX_PLAYERS,
  ).map((playerId, index) => validatedPlayerId(
    playerId,
    `${field}.loadoutReadyPlayerIds[${index}]`,
  ))
  if (loadoutReadyPlayerIds.some((playerId, index) => (
    index > 0 && playerId <= loadoutReadyPlayerIds[index - 1]!
  ))) throw new GameProtocolError(`${field}.loadoutReadyPlayerIds must be unique and sorted`)
  if (loadoutReadyPlayerIds.some((playerId) => !eligiblePlayerIds.includes(playerId))) {
    throw new GameProtocolError(`${field}.loadoutReadyPlayerIds must be eligible`)
  }
  const runId = source.runId === null
    ? null
    : limitedString(source.runId, `${field}.runId`, 128)
  const lastCompletedRunId = source.lastCompletedRunId === null
    ? null
    : limitedString(source.lastCompletedRunId, `${field}.lastCompletedRunId`, 128)
  const gameOverEventId = nonnegativeInteger(
    source.gameOverEventId,
    `${field}.gameOverEventId`,
  )
  const nextGameOverEventId = positiveInteger(
    source.nextGameOverEventId,
    `${field}.nextGameOverEventId`,
  )
  if (gameOverEventId >= nextGameOverEventId) {
    throw new GameProtocolError(`${field}.gameOverEventId is not allocated`)
  }
  if ((phase === 'active' || phase === 'game-over') !== (runId !== null)) {
    throw new GameProtocolError(`${field}.runId does not match phase`)
  }
  if ((phase === 'hub' || phase === 'active') && gameOverEventId !== 0) {
    throw new GameProtocolError(`${field}.gameOverEventId requires a completed run`)
  }
  const gameOverTicks = nonnegativeInteger(source.gameOverTicks, `${field}.gameOverTicks`)
  const gameOverExitKind = source.gameOverExitKind === null
    ? null
    : limitedString(source.gameOverExitKind, `${field}.gameOverExitKind`, 32)
  if (
    gameOverExitKind !== null
    && !(GAME_OVER_EXIT_KINDS as readonly string[]).includes(gameOverExitKind)
  ) throw new GameProtocolError(`${field}.gameOverExitKind is not supported`)
  const gameOverExitTicks = source.gameOverExitTicks === null
    ? null
    : nonnegativeInteger(source.gameOverExitTicks, `${field}.gameOverExitTicks`)
  if (phase !== 'game-over' && (gameOverExitTicks !== null || gameOverExitKind !== null)) {
    throw new GameProtocolError(`${field}.Game Over exit requires Game Over`)
  }
  if ((gameOverExitTicks === null) !== (gameOverExitKind === null)) {
    throw new GameProtocolError(`${field}.gameOverExitKind does not match exit ticks`)
  }
  const maximumExitTicks = gameOverExitKind === 'input'
    ? GAME_OVER_INPUT_EXIT_FADE_TICKS
    : GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS
  if (gameOverExitTicks !== null && gameOverExitTicks > maximumExitTicks) {
    throw new GameProtocolError(`${field}.gameOverExitTicks exceeds its native fade`)
  }
  if (
    phase === 'game-over'
    && gameOverExitTicks === null
    && gameOverTicks >= GAME_OVER_AUTOMATIC_ACCEPT_TICK
  ) throw new GameProtocolError(`${field}.gameOverExitTicks misses the native automatic fade`)
  if (gameOverExitTicks !== null && gameOverExitTicks < 1) {
    throw new GameProtocolError(`${field}.gameOverExitTicks must begin at one`)
  }
  if (
    gameOverExitKind === 'automatic'
    && gameOverExitTicks !== null
    && gameOverTicks !== GAME_OVER_AUTOMATIC_ACCEPT_TICK + gameOverExitTicks - 1
  ) throw new GameProtocolError(`${field}.automatic Game Over exit is out of step`)
  if (
    gameOverExitKind === 'input'
    && gameOverExitTicks !== null
    && gameOverTicks < GAME_OVER_INPUT_ACCEPT_TICK + gameOverExitTicks - 1
  ) throw new GameProtocolError(`${field}.input Game Over exit precedes its gate`)
  if (phase !== 'loadout' && loadoutReadyPlayerIds.length > 0) {
    throw new GameProtocolError(`${field}.loadoutReadyPlayerIds require loadout`)
  }
  if (phase === 'loadout' && eligiblePlayerIds.length === 0) {
    throw new GameProtocolError(`${field}.loadout requires eligible players`)
  }
  return {
    eligiblePlayerIds,
    gameOverEventId,
    gameOverExitKind: gameOverExitKind as GameOverExitKind | null,
    gameOverExitTicks,
    gameOverTicks,
    lastCompletedRunId,
    loadoutReadyPlayerIds,
    nextGameOverEventId,
    phase: phase as GameRunPhase,
    runId,
  }
}

function validateGameRunWorld(
  run: GameRunLifecycleState,
  world: GameSnapshot['world'] | GameSnapshotFrame['world'],
  field: string,
): void {
  if (run.phase === 'active' || run.phase === 'game-over') {
    if (world.kind !== 'boneyard' || world.runId !== run.runId) {
      throw new GameProtocolError(`${field}.run does not match its Boneyard world`)
    }
  } else if (world.kind !== 'hub') {
    throw new GameProtocolError(`${field}.run requires a Hub world outside a run`)
  }
}

function nativeSecondaryState(
  value: unknown,
  field: string,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
): ProtocolNativeSecondarySnapshotState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'actors', 'events', 'nextActorId', 'nextEventId', 'players', 'targetEffects',
  ])
  const actors = limitedArray(source.actors, `${field}.actors`, MAX_SECONDARY_ACTORS)
    .map((actor, index) => nativeSecondaryActor(actor, `${field}.actors[${index}]`, players))
  uniqueAscendingIds(actors, `${field}.actors`)
  const events = limitedArray(source.events, `${field}.events`, MAX_SECONDARY_EVENTS)
    .map((event, index) => nativeSecondaryEvent(event, `${field}.events[${index}]`))
  uniqueAscendingIds(events, `${field}.events`)
  const rawPlayerStates = record(source.players, `${field}.players`)
  if (Object.keys(rawPlayerStates).length > MAX_PLAYERS) {
    throw new GameProtocolError(`${field}.players may contain at most ${MAX_PLAYERS} entries`)
  }
  const playerStates: Record<string, NativeSecondaryPlayerState> = {}
  for (const [rawPlayerId, state] of Object.entries(rawPlayerStates)) {
    const playerId = validatedPlayerId(rawPlayerId, `${field} player id`)
    if (!players[playerId]) {
      throw new GameProtocolError(`${field}.players.${playerId} has no player snapshot`)
    }
    playerStates[playerId] = nativeSecondaryPlayer(state, `${field}.players.${playerId}`)
  }
  const targetEffects = limitedArray(
    source.targetEffects,
    `${field}.targetEffects`,
    MAX_SECONDARY_TARGET_EFFECTS,
  ).map((effect, index) => nativeSecondaryTargetEffectState(
    effect,
    `${field}.targetEffects[${index}]`,
  ))
  const effectKeys = new Set<string>()
  for (const effect of targetEffects) {
    const key = `${effect.worldKey}\u0000${effect.targetId}`
    if (effectKeys.has(key)) {
      throw new GameProtocolError(`${field}.targetEffects must have unique world/target keys`)
    }
    effectKeys.add(key)
    const frostBurnActive = effect.frostBurnTicks > 0
    if (frostBurnActive !== (
      effect.frostBurnDamagePerTick > 0
      && effect.frostBurnOwnerId !== null
      && effect.frostBurnSkillId !== null
      && effect.frostBurnSourceActorId !== null
    )) {
      throw new GameProtocolError(`${field}.targetEffects FrostBurn ownership is inconsistent`)
    }
    if (effect.frostBurnOwnerId !== null && !players[effect.frostBurnOwnerId]) {
      throw new GameProtocolError(`${field}.targetEffects FrostBurn owner has no player snapshot`)
    }
  }
  const nextActorId = positiveInteger(source.nextActorId, `${field}.nextActorId`)
  const nextEventId = positiveInteger(source.nextEventId, `${field}.nextEventId`)
  if (actors.some(({ id }) => id >= nextActorId)) {
    throw new GameProtocolError(`${field}.nextActorId is not ahead of live actors`)
  }
  if (events.some(({ eventId }) => eventId >= nextEventId)) {
    throw new GameProtocolError(`${field}.nextEventId is not ahead of retained events`)
  }
  return {
    actors,
    events,
    nextActorId,
    nextEventId,
    players: playerStates,
    targetEffects,
  }
}

function nativeSecondaryActor(
  value: unknown,
  field: string,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
): NativeSecondaryActorState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'ageTicks', 'alpha', 'damage', 'enhanced', 'endpoint', 'frame', 'freezeTicks',
    'golem', 'hitTargetIds', 'id', 'kind', 'lifetimeTicks', 'lightRegistration',
    'midpoint', 'miscLightAppendOrdinal', 'ownerId', 'phase', 'position', 'presentationRng',
    'quantity', 'radius', 'rank', 'rotationRadians', 'scale', 'skillId',
    'slowFactor', 'targetId', 'variant', 'velocity', 'worldKey',
  ])
  const kind = memberString(
    source.kind,
    `${field}.kind`,
    NATIVE_SECONDARY_ACTOR_KINDS,
  ) as NativeSecondaryActorKind
  const ownerId = validatedPlayerId(source.ownerId, `${field}.ownerId`)
  if (!players[ownerId]) throw new GameProtocolError(`${field}.ownerId has no player snapshot`)
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  const lifetimeTicks = positiveInteger(source.lifetimeTicks, `${field}.lifetimeTicks`)
  if (ageTicks >= lifetimeTicks) {
    throw new GameProtocolError(`${field}.ageTicks is outside the live lifetime`)
  }
  const hitTargetIds = limitedArray(
    source.hitTargetIds,
    `${field}.hitTargetIds`,
    MAX_PRIMARY_SPELL_HIT_TARGETS,
  ).map((targetId, index) => nonnegativeInteger(
    targetId,
    `${field}.hitTargetIds[${index}]`,
  ))
  const duplicateHitTargetIds = new Set(hitTargetIds).size !== hitTargetIds.length
  const unsortedHitTargetIds = hitTargetIds.some((id, index) => (
    index > 0 && id < hitTargetIds[index - 1]!
  ))
  if (duplicateHitTargetIds || (kind !== 'earthquake' && unsortedHitTargetIds)) {
    throw new GameProtocolError(
      `${field}.hitTargetIds must be unique; only Earthquake preserves pointer-list order`,
    )
  }
  const targetId = source.targetId === null
    ? null
    : nonnegativeInteger(source.targetId, `${field}.targetId`)
  const golem = source.golem === null
    ? null
    : nativeSecondaryGolemState(source.golem, `${field}.golem`)
  if ((kind === 'golem') !== (golem !== null)) {
    throw new GameProtocolError(`${field}.golem must exist exactly for Golem actors`)
  }
  const variant = nonnegativeInteger(source.variant, `${field}.variant`)
  const presentationRng = source.presentationRng === null
    ? null
    : nativeRngState(source.presentationRng, `${field}.presentationRng`)
  const skillId = source.skillId === null
    ? null
    : source.skillId === 14 && (
        kind === 'ether-burn' || kind === 'ether-burn-flare'
      )
      ? 14
    : source.skillId === 22 && (kind === 'fire-burn' || kind === 'fire-burn-flame')
      ? 22
      : source.skillId === 53 && (
          kind === 'flash-response-fade' || kind === 'flash-response-grow'
        )
        ? 53
      : nativeSecondarySkillId(source.skillId, `${field}.skillId`)
  const mindblast = kind === 'mindblast-burst' || kind === 'mindblast-shockwave'
  if (mindblast !== (skillId === null)) {
    throw new GameProtocolError(`${field}.skillId must be null exactly for Mindblast actors`)
  }
  if (mindblast && variant > 4) {
    throw new GameProtocolError(`${field}.variant is not a native Wizard element`)
  }
  if (kind === 'mindblast-burst') {
    if (
      lifetimeTicks !== NATIVE_MINDBLAST_BURST_LIFETIME_TICKS
      || presentationRng === null
      || (
        source.scale !== 9
        && !(source.scale === 15 && source.rank === 10_000)
      )
    ) {
      throw new GameProtocolError(`${field} violates the native Mindblast burst contract`)
    }
  }
  if (kind === 'mindblast-shockwave') {
    if (
      lifetimeTicks !== NATIVE_MINDBLAST_SHOCKWAVE_LIFETIME_TICKS
      || presentationRng !== null
      || source.quantity !== NATIVE_MINDBLAST_SHOCKWAVE_GROWTH
    ) {
      throw new GameProtocolError(`${field} violates the native Mindblast Shockwave contract`)
    }
  }
  const lightDisposition = nativeSecondaryLightDisposition({ kind, variant })
  const lightRegistration = lightDisposition === 'none'
    ? absentNativeActorLight(source, field)
    : nativeLightProviderRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        lightDisposition === 'transient-provider' ? 'transient' : 'actor',
      )
  let miscLightAppendOrdinal: number | null = null
  if (lightDisposition === 'misc') {
    miscLightAppendOrdinal = nonnegativeInteger(
      source.miscLightAppendOrdinal,
      `${field}.miscLightAppendOrdinal`,
    )
  } else if (source.miscLightAppendOrdinal !== null) {
    throw new GameProtocolError(`${field}.miscLightAppendOrdinal must be null`)
  }
  return {
    ageTicks,
    alpha: nonnegativeFinite(source.alpha, `${field}.alpha`),
    damage: nonnegativeFinite(source.damage, `${field}.damage`),
    enhanced: boolean(source.enhanced, `${field}.enhanced`),
    endpoint: vector(source.endpoint, `${field}.endpoint`),
    frame: nonnegativeFinite(source.frame, `${field}.frame`),
    freezeTicks: nonnegativeInteger(source.freezeTicks, `${field}.freezeTicks`),
    golem,
    hitTargetIds,
    id: positiveInteger(source.id, `${field}.id`),
    kind,
    lifetimeTicks,
    lightRegistration,
    midpoint: vector(source.midpoint, `${field}.midpoint`),
    miscLightAppendOrdinal,
    ownerId,
    phase: finite(source.phase, `${field}.phase`),
    position: vector(source.position, `${field}.position`),
    presentationRng,
    quantity: finite(source.quantity, `${field}.quantity`),
    radius: nonnegativeFinite(source.radius, `${field}.radius`),
    rank: positiveInteger(source.rank, `${field}.rank`),
    rotationRadians: finite(source.rotationRadians, `${field}.rotationRadians`),
    scale: nonnegativeFinite(source.scale, `${field}.scale`),
    skillId,
    slowFactor: finite(source.slowFactor, `${field}.slowFactor`),
    targetId,
    variant,
    velocity: vector(source.velocity, `${field}.velocity`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }

}

function nativeRngState(value: unknown, field: string): NativeRngState {
  const source = record(value, field)
  onlyKeys(source, field, ['indexA', 'indexB', 'words'])
  const words = limitedArray(source.words, `${field}.words`, 55).map((word, index) => (
    boundedInteger(word, `${field}.words[${index}]`, 0, 0x3fffffff)
  ))
  if (words.length !== 55) {
    throw new GameProtocolError(`${field}.words must contain 55 entries`)
  }
  return {
    indexA: boundedInteger(source.indexA, `${field}.indexA`, 0, 54),
    indexB: boundedInteger(source.indexB, `${field}.indexB`, 0, 54),
    words,
  }
}

function nativeEnemyPathState(value: unknown, field: string): NativeEnemyPathState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'baseTurnRate', 'flankAngleDeg', 'flankRadius', 'flankTicksRemaining',
    'reorientationTicksRemaining', 'routePreviousVector',
    'routeRefreshTicksRemaining', 'routeTicksRemaining',
    'routeWaypointIndex', 'routeWaypoints', 'speedFactor',
    'stalledMovementTicks', 'turnFactor', 'wanderHeadingDeg',
  ])
  const routeWaypoints = source.routeWaypoints === null
    ? null
    : limitedArray(source.routeWaypoints, `${field}.routeWaypoints`, 2).map(
        (waypoint, index) => vector(waypoint, `${field}.routeWaypoints[${index}]`),
      )
  if (routeWaypoints !== null && routeWaypoints.length !== 2) {
    throw new GameProtocolError(`${field}.routeWaypoints must contain two entries`)
  }
  return {
    baseTurnRate: positiveFinite(source.baseTurnRate, `${field}.baseTurnRate`),
    flankAngleDeg: finite(source.flankAngleDeg, `${field}.flankAngleDeg`),
    flankRadius: nonnegativeFinite(source.flankRadius, `${field}.flankRadius`),
    flankTicksRemaining: nonnegativeInteger(
      source.flankTicksRemaining,
      `${field}.flankTicksRemaining`,
    ),
    reorientationTicksRemaining: nonnegativeInteger(
      source.reorientationTicksRemaining,
      `${field}.reorientationTicksRemaining`,
    ),
    routePreviousVector: source.routePreviousVector === null
      ? null
      : vector(source.routePreviousVector, `${field}.routePreviousVector`),
    routeRefreshTicksRemaining: nonnegativeInteger(
      source.routeRefreshTicksRemaining,
      `${field}.routeRefreshTicksRemaining`,
    ),
    routeTicksRemaining: nonnegativeInteger(
      source.routeTicksRemaining,
      `${field}.routeTicksRemaining`,
    ),
    routeWaypointIndex: boundedInteger(
      source.routeWaypointIndex,
      `${field}.routeWaypointIndex`,
      0,
      1,
    ) as 0 | 1,
    routeWaypoints: routeWaypoints === null
      ? null
      : [routeWaypoints[0]!, routeWaypoints[1]!],
    speedFactor: positiveFinite(source.speedFactor, `${field}.speedFactor`),
    stalledMovementTicks: nonnegativeInteger(
      source.stalledMovementTicks,
      `${field}.stalledMovementTicks`,
    ),
    turnFactor: positiveFinite(source.turnFactor, `${field}.turnFactor`),
    wanderHeadingDeg: finite(source.wanderHeadingDeg, `${field}.wanderHeadingDeg`),
  }
}

function nativeSecondaryGolemState(
  value: unknown,
  field: string,
): NativeSecondaryGolemState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'actionDurationTicks', 'actionHeadingOffsetDegrees', 'actionTick',
    'currentHealth', 'damageMaximum', 'gaitTick', 'iron',
    'leftConnectorOffset', 'leftFoot', 'leftFootBob', 'leftFootNext',
    'leftFootPrevious', 'leftFootProgress', 'leftFootRotationDegrees',
    'leftLimbMode', 'maximumHealth', 'orbitDirection', 'orbitHeadingRadians',
    'phase', 'poseVariant', 'provokeRollBound', 'reflectFactor',
    'rightConnectorOffset', 'rightFoot', 'rightFootBob', 'rightFootNext',
    'rightFootPrevious', 'rightFootProgress', 'rightFootRotationDegrees',
    'rightLimbMode', 'targetPollTicksRemaining',
  ])
  const phase = memberString(
    source.phase,
    `${field}.phase`,
    ['active', 'assembly', 'attack', 'provoke'] as const,
  )
  const actionDurationTicks = boundedInteger(
    source.actionDurationTicks,
    `${field}.actionDurationTicks`,
    0,
    151,
  )
  const actionTick = nonnegativeInteger(source.actionTick, `${field}.actionTick`)
  if (actionTick > actionDurationTicks) {
    throw new GameProtocolError(`${field}.actionTick exceeds its duration`)
  }
  const maximumHealth = positiveFinite(source.maximumHealth, `${field}.maximumHealth`)
  const currentHealth = positiveFinite(source.currentHealth, `${field}.currentHealth`)
  if (currentHealth > maximumHealth) {
    throw new GameProtocolError(`${field}.currentHealth exceeds maximumHealth`)
  }
  const orbitDirection = finite(source.orbitDirection, `${field}.orbitDirection`)
  if (orbitDirection < -1 || orbitDirection > 1) {
    throw new GameProtocolError(`${field}.orbitDirection must be within [-1,1]`)
  }
  const orbitHeadingRadians = source.orbitHeadingRadians === null
    ? null
    : finite(source.orbitHeadingRadians, `${field}.orbitHeadingRadians`)
  return {
    actionHeadingOffsetDegrees: finite(
      source.actionHeadingOffsetDegrees,
      `${field}.actionHeadingOffsetDegrees`,
    ),
    actionDurationTicks,
    actionTick,
    currentHealth,
    damageMaximum: nonnegativeFinite(source.damageMaximum, `${field}.damageMaximum`),
    gaitTick: nonnegativeInteger(source.gaitTick, `${field}.gaitTick`),
    iron: boolean(source.iron, `${field}.iron`),
    leftConnectorOffset: vector(source.leftConnectorOffset, `${field}.leftConnectorOffset`),
    leftFoot: vector(source.leftFoot, `${field}.leftFoot`),
    leftFootBob: vector(source.leftFootBob, `${field}.leftFootBob`),
    leftFootNext: vector(source.leftFootNext, `${field}.leftFootNext`),
    leftFootPrevious: vector(source.leftFootPrevious, `${field}.leftFootPrevious`),
    leftFootProgress: unitInterval(source.leftFootProgress, `${field}.leftFootProgress`),
    leftFootRotationDegrees: finite(
      source.leftFootRotationDegrees,
      `${field}.leftFootRotationDegrees`,
    ),
    leftLimbMode: boundedInteger(source.leftLimbMode, `${field}.leftLimbMode`, 0, 3),
    maximumHealth,
    orbitDirection,
    orbitHeadingRadians,
    phase,
    poseVariant: boundedInteger(source.poseVariant, `${field}.poseVariant`, 0, 1) as 0 | 1,
    provokeRollBound: boundedInteger(source.provokeRollBound, `${field}.provokeRollBound`, 0, 1_200),
    reflectFactor: unitInterval(source.reflectFactor, `${field}.reflectFactor`),
    rightConnectorOffset: vector(source.rightConnectorOffset, `${field}.rightConnectorOffset`),
    rightFoot: vector(source.rightFoot, `${field}.rightFoot`),
    rightFootBob: vector(source.rightFootBob, `${field}.rightFootBob`),
    rightFootNext: vector(source.rightFootNext, `${field}.rightFootNext`),
    rightFootPrevious: vector(source.rightFootPrevious, `${field}.rightFootPrevious`),
    rightFootProgress: unitInterval(source.rightFootProgress, `${field}.rightFootProgress`),
    rightFootRotationDegrees: finite(
      source.rightFootRotationDegrees,
      `${field}.rightFootRotationDegrees`,
    ),
    rightLimbMode: boundedInteger(source.rightLimbMode, `${field}.rightLimbMode`, 0, 3),
    targetPollTicksRemaining: boundedInteger(
      source.targetPollTicksRemaining,
      `${field}.targetPollTicksRemaining`,
      0,
      50,
    ),
  }
}

function nativeSecondaryEvent(
  value: unknown,
  field: string,
): NativeSecondaryEventState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'actorId', 'cameraDisplacement', 'cameraMagnitude', 'cue', 'eventId', 'kind',
    'ownerId', 'pitch', 'position', 'screenFlash', 'skillId', 'tick', 'worldKey',
  ])
  const cue = source.cue === null
    ? null
    : memberString(
        source.cue,
        `${field}.cue`,
        NATIVE_SECONDARY_AUDIO_CUES,
      ) as NativeSecondaryAudioCue
  const kind = memberString(
    source.kind,
    `${field}.kind`,
    NATIVE_SECONDARY_EVENT_KINDS,
  ) as NativeSecondaryEventKind
  const screenFlash = source.screenFlash === null
    ? null
    : nativeSecondaryScreenFlash(source.screenFlash, `${field}.screenFlash`)
  const skillId = source.skillId === null
    ? null
    : source.skillId === 22
      ? 22
      : source.skillId === 53
        ? 53
      : nativeSecondarySkillId(source.skillId, `${field}.skillId`)
  if (skillId === 53 && (
    cue !== 'flash-spell' || kind !== 'impact' || screenFlash === null
  )) {
    throw new GameProtocolError(`${field} skill 53 is reserved for Flash response feedback`)
  }
  if (skillId === null && (cue !== null || kind !== 'impact' || screenFlash === null)) {
    throw new GameProtocolError(`${field} null skillId is reserved for player-effect feedback`)
  }
  return {
    actorId: source.actorId === null
      ? null
      : positiveInteger(source.actorId, `${field}.actorId`),
    cameraDisplacement: source.cameraDisplacement === null
      ? null
      : vector(source.cameraDisplacement, `${field}.cameraDisplacement`),
    cameraMagnitude: nonnegativeFinite(source.cameraMagnitude, `${field}.cameraMagnitude`),
    cue,
    eventId: positiveInteger(source.eventId, `${field}.eventId`),
    kind,
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    pitch: positiveFinite(source.pitch, `${field}.pitch`),
    position: vector(source.position, `${field}.position`),
    screenFlash,
    skillId,
    tick: nonnegativeInteger(source.tick, `${field}.tick`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
}

function nativeSecondaryScreenFlash(
  value: unknown,
  field: string,
): NativeSecondaryScreenFlashState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'alpha', 'blue', 'decayPerTick', 'green', 'pointAttenuated', 'red',
  ])
  const decayPerTick = positiveFinite(source.decayPerTick, `${field}.decayPerTick`)
  if (decayPerTick > 1) {
    throw new GameProtocolError(`${field}.decayPerTick must be between zero and one`)
  }
  return {
    alpha: unitInterval(source.alpha, `${field}.alpha`),
    blue: unitInterval(source.blue, `${field}.blue`),
    decayPerTick,
    green: unitInterval(source.green, `${field}.green`),
    pointAttenuated: boolean(source.pointAttenuated, `${field}.pointAttenuated`),
    red: unitInterval(source.red, `${field}.red`),
  }
}

function nativeSecondaryPlayer(value: unknown, field: string): NativeSecondaryPlayerState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'castSequence', 'castSpinTicksRemaining', 'cooldownTicksBySkill', 'firewalker',
    'cooldownMaximumTicksBySkill',
    'fizzleSequence', 'globalCooldownTicks', 'heldSlot', 'lastSkillId', 'magicShieldAbsorb',
    'magicShieldExplosionDamage',
    'magicShieldMaximum', 'magicShieldPulseTicks', 'mindstar', 'planeOrbHeld',
    'planewalkerTicksRemaining', 'regenerate', 'reservedMana',
    'staffCastTicksRemaining', 'stoneskinTicksRemaining',
  ])
  const cooldownMaximumTicksBySkill = limitedArray(
    source.cooldownMaximumTicksBySkill,
    `${field}.cooldownMaximumTicksBySkill`,
    83,
  ).map((ticks, index) => nonnegativeInteger(
    ticks,
    `${field}.cooldownMaximumTicksBySkill[${index}]`,
  ))
  if (cooldownMaximumTicksBySkill.length !== 83) {
    throw new GameProtocolError(`${field}.cooldownMaximumTicksBySkill must contain 83 rows`)
  }
  const cooldownTicksBySkill = limitedArray(
    source.cooldownTicksBySkill,
    `${field}.cooldownTicksBySkill`,
    83,
  ).map((ticks, index) => nonnegativeFinite(
    ticks,
    `${field}.cooldownTicksBySkill[${index}]`,
  ))
  if (cooldownTicksBySkill.length !== 83) {
    throw new GameProtocolError(`${field}.cooldownTicksBySkill must contain 83 rows`)
  }
  if (cooldownTicksBySkill.some((ticks, index) => (
    ticks > cooldownMaximumTicksBySkill[index]!
  ))) {
    throw new GameProtocolError(`${field}.cooldownTicksBySkill exceeds a capacity`)
  }
  const globalCooldownTicks = nonnegativeInteger(
    source.globalCooldownTicks,
    `${field}.globalCooldownTicks`,
  )
  if (globalCooldownTicks > NATIVE_SECONDARY_GLOBAL_COOLDOWN_TICKS) {
    throw new GameProtocolError(`${field}.globalCooldownTicks exceeds its native capacity`)
  }
  const heldSlot = source.heldSlot === null
    ? null
    : nonnegativeInteger(source.heldSlot, `${field}.heldSlot`)
  if (heldSlot !== null && heldSlot >= 8) {
    throw new GameProtocolError(`${field}.heldSlot is outside the skill quickbar`)
  }
  const lastSkillId = source.lastSkillId === null
    ? null
    : nativeSecondarySkillId(source.lastSkillId, `${field}.lastSkillId`)
  const magicShieldAbsorb = nonnegativeFinite(
    source.magicShieldAbsorb,
    `${field}.magicShieldAbsorb`,
  )
  const magicShieldMaximum = nonnegativeFinite(
    source.magicShieldMaximum,
    `${field}.magicShieldMaximum`,
  )
  if (magicShieldAbsorb > magicShieldMaximum) {
    throw new GameProtocolError(`${field}.magicShieldAbsorb exceeds its maximum`)
  }
  return {
    castSequence: nonnegativeInteger(source.castSequence, `${field}.castSequence`),
    castSpinTicksRemaining: nonnegativeInteger(
      source.castSpinTicksRemaining,
      `${field}.castSpinTicksRemaining`,
    ),
    cooldownMaximumTicksBySkill,
    cooldownTicksBySkill,
    firewalker: boolean(source.firewalker, `${field}.firewalker`),
    fizzleSequence: nonnegativeInteger(source.fizzleSequence, `${field}.fizzleSequence`),
    globalCooldownTicks,
    heldSlot,
    lastSkillId,
    magicShieldAbsorb,
    magicShieldExplosionDamage: nonnegativeFinite(
      source.magicShieldExplosionDamage,
      `${field}.magicShieldExplosionDamage`,
    ),
    magicShieldMaximum,
    magicShieldPulseTicks: nonnegativeInteger(
      source.magicShieldPulseTicks,
      `${field}.magicShieldPulseTicks`,
    ),
    mindstar: boolean(source.mindstar, `${field}.mindstar`),
    planeOrbHeld: boolean(source.planeOrbHeld, `${field}.planeOrbHeld`),
    planewalkerTicksRemaining: nonnegativeInteger(
      source.planewalkerTicksRemaining,
      `${field}.planewalkerTicksRemaining`,
    ),
    regenerate: boolean(source.regenerate, `${field}.regenerate`),
    reservedMana: nonnegativeFinite(source.reservedMana, `${field}.reservedMana`),
    staffCastTicksRemaining: nonnegativeInteger(
      source.staffCastTicksRemaining,
      `${field}.staffCastTicksRemaining`,
    ),
    stoneskinTicksRemaining: nonnegativeInteger(
      source.stoneskinTicksRemaining,
      `${field}.stoneskinTicksRemaining`,
    ),
  }
}

function nativeSecondaryTargetEffectState(
  value: unknown,
  field: string,
): NativeSecondaryTargetEffectState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'circleSlowFactor', 'circleSlowTicks',
    'coldSlowFactor', 'coldSlowMaterial', 'coldSlowTicks', 'dazzleMaximumTicks',
    'dazzleTicks', 'disruptedTicks', 'electricBurn', 'fleeTicks', 'frostBurnDamagePerTick',
    'frostBurnOwnerId', 'frostBurnSkillId', 'frostBurnSourceActorId', 'frostBurnTicks',
    'frozenTicks', 'frozenTimeScale', 'movementModifierOrder', 'prismaticTicks',
    'stunFactor', 'stunTicks',
    'steamed', 'targetId', 'timeScale', 'weakenFactor', 'worldKey',
  ])
  const dazzleMaximumTicks = nonnegativeInteger(
    source.dazzleMaximumTicks,
    `${field}.dazzleMaximumTicks`,
  )
  const dazzleTicks = nonnegativeInteger(source.dazzleTicks, `${field}.dazzleTicks`)
  if (dazzleTicks > dazzleMaximumTicks) {
    throw new GameProtocolError(`${field}.dazzleTicks exceeds its maximum`)
  }
  const frostBurnSkillId = source.frostBurnSkillId === null
    ? null
    : nonnegativeInteger(source.frostBurnSkillId, `${field}.frostBurnSkillId`)
  if (frostBurnSkillId !== null && frostBurnSkillId !== 35 && frostBurnSkillId !== 76) {
    throw new GameProtocolError(`${field}.frostBurnSkillId must be 35 or 76`)
  }
  const circleSlowFactor = unitInterval(source.circleSlowFactor, `${field}.circleSlowFactor`)
  const circleSlowTicks = nonnegativeInteger(source.circleSlowTicks, `${field}.circleSlowTicks`)
  const coldSlowFactor = unitInterval(source.coldSlowFactor, `${field}.coldSlowFactor`)
  const coldSlowTicks = nonnegativeInteger(source.coldSlowTicks, `${field}.coldSlowTicks`)
  const frozenTicks = nonnegativeInteger(source.frozenTicks, `${field}.frozenTicks`)
  const frozenTimeScale = unitInterval(source.frozenTimeScale, `${field}.frozenTimeScale`)
  const stunFactor = unitInterval(source.stunFactor, `${field}.stunFactor`)
  const stunTicks = nonnegativeInteger(source.stunTicks, `${field}.stunTicks`)
  const timeScale = unitInterval(source.timeScale, `${field}.timeScale`)
  const movementModifierOrder = limitedArray(
    source.movementModifierOrder,
    `${field}.movementModifierOrder`,
    NATIVE_SECONDARY_MOVEMENT_MODIFIER_KINDS.length,
  ).map((kind, index) => memberString(
    kind,
    `${field}.movementModifierOrder[${index}]`,
    NATIVE_SECONDARY_MOVEMENT_MODIFIER_KINDS,
  ) as NativeSecondaryMovementModifierKind)
  if (new Set(movementModifierOrder).size !== movementModifierOrder.length) {
    throw new GameProtocolError(`${field}.movementModifierOrder contains duplicates`)
  }
  const expectedMovementModifiers = [
    coldSlowTicks > 0 ? 'cold-slow' : null,
    circleSlowTicks > 0 ? 'circle-slow' : null,
    frozenTicks > 0 ? 'frozen' : null,
    stunTicks > 0 ? 'stun' : null,
    dazzleTicks > 0 ? 'dazzle' : null,
  ].filter((kind): kind is NativeSecondaryMovementModifierKind => kind !== null)
  const movementModifierSet = new Set(movementModifierOrder)
  if (
    movementModifierOrder.length !== expectedMovementModifiers.length
    || expectedMovementModifiers.some((kind) => !movementModifierSet.has(kind))
  ) throw new GameProtocolError(`${field}.movementModifierOrder does not match active clocks`)
  const dazzleFactor = dazzleTicks <= 0 || dazzleMaximumTicks <= 0
    ? 1
    : Math.max(1 / dazzleMaximumTicks, 1 - dazzleTicks / dazzleMaximumTicks)
  const factors: Readonly<Record<NativeSecondaryMovementModifierKind, number>> = {
    'circle-slow': circleSlowFactor,
    'cold-slow': coldSlowFactor,
    dazzle: dazzleFactor,
    frozen: frozenTimeScale,
    stun: stunFactor,
  }
  const expectedTimeScale = movementModifierOrder.reduce(
    (scale, kind) => Math.fround(scale * factors[kind]),
    Math.fround(1),
  )
  if (timeScale !== expectedTimeScale) {
    throw new GameProtocolError(`${field}.timeScale does not match modifier order`)
  }
  return {
    circleSlowFactor,
    circleSlowTicks,
    coldSlowFactor,
    coldSlowMaterial: boolean(source.coldSlowMaterial, `${field}.coldSlowMaterial`),
    coldSlowTicks,
    dazzleMaximumTicks,
    dazzleTicks,
    disruptedTicks: nonnegativeInteger(source.disruptedTicks, `${field}.disruptedTicks`),
    electricBurn: nativeSecondaryElectricBurnEffect(source.electricBurn, `${field}.electricBurn`),
    fleeTicks: nonnegativeInteger(source.fleeTicks, `${field}.fleeTicks`),
    frostBurnDamagePerTick: nonnegativeFinite(
      source.frostBurnDamagePerTick,
      `${field}.frostBurnDamagePerTick`,
    ),
    frostBurnOwnerId: source.frostBurnOwnerId === null
      ? null
      : validatedPlayerId(source.frostBurnOwnerId, `${field}.frostBurnOwnerId`),
    frostBurnSkillId: frostBurnSkillId as 35 | 76 | null,
    frostBurnSourceActorId: source.frostBurnSourceActorId === null
      ? null
      : positiveInteger(source.frostBurnSourceActorId, `${field}.frostBurnSourceActorId`),
    frostBurnTicks: nonnegativeInteger(source.frostBurnTicks, `${field}.frostBurnTicks`),
    frozenTicks,
    frozenTimeScale,
    movementModifierOrder,
    prismaticTicks: nonnegativeInteger(source.prismaticTicks, `${field}.prismaticTicks`),
    stunFactor,
    stunTicks,
    steamed: nativeSecondarySteamedEffect(source.steamed, `${field}.steamed`),
    targetId: nonnegativeInteger(source.targetId, `${field}.targetId`),
    timeScale,
    weakenFactor: unitInterval(source.weakenFactor, `${field}.weakenFactor`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
}

function nativeSecondaryElectricBurnEffect(
  value: unknown,
  field: string,
): NativeSecondaryTargetEffectState['electricBurn'] {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'arcCount', 'damagePerTick', 'ownerId', 'sourceActorId', 'stunFactor', 'ticks',
  ])
  return {
    arcCount: nonnegativeInteger(source.arcCount, `${field}.arcCount`),
    damagePerTick: nonnegativeFinite(source.damagePerTick, `${field}.damagePerTick`),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    sourceActorId: positiveInteger(source.sourceActorId, `${field}.sourceActorId`),
    stunFactor: unitInterval(source.stunFactor, `${field}.stunFactor`),
    ticks: positiveInteger(source.ticks, `${field}.ticks`),
  }
}

function nativeSecondarySteamedEffect(
  value: unknown,
  field: string,
): NativeSecondaryTargetEffectState['steamed'] {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'damagePerTick', 'emberDamage', 'emberFragments', 'explodeDamage', 'explodeRadius',
    'ownerId', 'sourceActorId', 'ticks',
  ])
  return {
    damagePerTick: nonnegativeFinite(source.damagePerTick, `${field}.damagePerTick`),
    emberDamage: nonnegativeFinite(source.emberDamage, `${field}.emberDamage`),
    emberFragments: nonnegativeInteger(source.emberFragments, `${field}.emberFragments`),
    explodeDamage: nonnegativeFinite(source.explodeDamage, `${field}.explodeDamage`),
    explodeRadius: nonnegativeFinite(source.explodeRadius, `${field}.explodeRadius`),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    sourceActorId: positiveInteger(source.sourceActorId, `${field}.sourceActorId`),
    ticks: positiveInteger(source.ticks, `${field}.ticks`),
  }
}

function nativeSecondarySkillId(value: unknown, field: string): NativeSecondaryAbilityId {
  const skillId = nonnegativeInteger(value, field)
  if (!(NATIVE_SECONDARY_ABILITY_IDS as readonly number[]).includes(skillId)) {
    throw new GameProtocolError(`${field} is not a native secondary ability`)
  }
  return skillId as NativeSecondaryAbilityId
}

function uniqueAscendingIds(
  values: readonly Readonly<{ id?: number; eventId?: number }>[],
  field: string,
): void {
  let previous = 0
  for (const value of values) {
    const id = value.id ?? value.eventId
    if (id === undefined || id <= previous) {
      throw new GameProtocolError(`${field} IDs must be unique and sorted`)
    }
    previous = id
  }
}

function primarySpellState(value: unknown, field: string): PrimarySpellSimulationState {
  const source = record(value, field)
  onlyKeys(source, field, ['nextId', 'projectiles', 'transients'])
  const nextId = positiveInteger(source.nextId, `${field}.nextId`)
  const projectiles = limitedArray(
    source.projectiles,
    `${field}.projectiles`,
    MAX_PRIMARY_SPELL_PROJECTILES,
  ).map((spell, index) => primarySpellProjectile(
    spell,
    `${field}.projectiles[${index}]`,
  ))
  const transients = limitedArray(
    source.transients,
    `${field}.transients`,
    MAX_PRIMARY_SPELL_TRANSIENTS,
  ).map((effect, index) => primarySpellTransient(
    effect,
    `${field}.transients[${index}]`,
  ))
  const ids = new Set<number>()
  for (const spell of [...projectiles, ...transients]) {
    if (ids.has(spell.id)) throw new GameProtocolError(`${field} contains duplicate id ${spell.id}`)
    if (spell.id >= nextId) throw new GameProtocolError(`${field} id ${spell.id} is not allocated`)
    ids.add(spell.id)
  }
  return { nextId, projectiles, transients }
}

function primarySpellProjectile(value: unknown, field: string): PrimarySpellProjectileState {
  const source = record(value, field)
  if (source.kind === 'weld') return primarySpellWeldProjectile(source, field)
  if (source.kind !== 'earth' && source.kind !== 'ether' && source.kind !== 'fire') {
    throw new GameProtocolError(`${field}.kind is not a projectile primary`)
  }
  onlyKeys(source, field, [
    'ageTicks', 'charge', 'damage', 'direction', 'flightTicks', 'id', 'kind',
    'lightRegistration', 'ownerId', 'phase', 'position', 'velocity', 'worldKey',
    ...(source.kind === 'earth' ? [
      'assemblyCharge', 'hitTargetIds', 'maximumCharge', 'orientation',
      'remainingDamage', 'shellCharge', 'toughness',
    ] : []),
    ...(source.kind === 'ether' ? [
      'damageRetention', 'headingDegrees', 'piercesRemaining', 'reacquiresTarget',
      'speed', 'targetId', 'turnAccumulator', 'turnInput', 'underpowered',
      'visualScale',
    ] : []),
    ...(source.kind === 'fire' ? [
      'burnDamage', 'emberDamage', 'emberFragments', 'explodeDamage',
      'explodeRadius', 'privateSeed', 'spentEmber', 'underpowered',
    ] : []),
  ])
  if (source.phase !== 'flight' && source.phase !== 'held') {
    throw new GameProtocolError(`${field}.phase is not supported`)
  }
  const phase: PrimarySpellProjectilePhase = source.phase
  if (phase === 'held' && source.kind !== 'earth') {
    throw new GameProtocolError(`${field} only permits held Earth actors`)
  }
  const charge = finite(source.charge, `${field}.charge`)
  if (charge < 0 || (source.kind !== 'earth' && charge > 1)) {
    throw new GameProtocolError(
      `${field}.charge must be non-negative${source.kind === 'earth' ? '' : ' and at most one'}`,
    )
  }
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  const flightTicks = nonnegativeInteger(source.flightTicks, `${field}.flightTicks`)
  if (phase === 'held' && flightTicks !== 0) {
    throw new GameProtocolError(`${field}.flightTicks must be zero while held`)
  }
  if (phase === 'flight' && (flightTicks < 1 || flightTicks > ageTicks)) {
    throw new GameProtocolError(`${field}.flightTicks is outside the actor age`)
  }
  const damage = nonnegativeFinite(source.damage, `${field}.damage`)
  if (source.kind !== 'earth' && damage <= 0) {
    throw new GameProtocolError(`${field}.damage must be positive in flight`)
  }
  const projectile = {
    ageTicks,
    charge,
    damage,
    direction: unitVector(source.direction, `${field}.direction`),
    flightTicks,
    id: positiveInteger(source.id, `${field}.id`),
    lightRegistration: nativeLightProviderRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    phase,
    position: vector(source.position, `${field}.position`),
    velocity: vector(source.velocity, `${field}.velocity`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
  if (source.kind === 'earth') {
    const maximumCharge = positiveFinite(source.maximumCharge, `${field}.maximumCharge`)
    if ((phase === 'held' && maximumCharge < 1) || charge > maximumCharge) {
      throw new GameProtocolError(`${field}.charge exceeds its native Earth maximum`)
    }
    const remainingDamage = nonnegativeFinite(
      source.remainingDamage,
      `${field}.remainingDamage`,
    )
    const toughness = positiveFinite(source.toughness, `${field}.toughness`)
    const assemblyCharge = finite(source.assemblyCharge, `${field}.assemblyCharge`)
    const shellCharge = positiveFinite(source.shellCharge, `${field}.shellCharge`)
    if (
      assemblyCharge < PRIMARY_SPELL_EARTH_INITIAL_CHARGE
      || assemblyCharge > maximumCharge
      || (phase === 'held' && (
        assemblyCharge > charge
        || Math.floor(30 * assemblyCharge) !== Math.floor(30 * charge)
        || shellCharge !== assemblyCharge
      ))
    ) {
      throw new GameProtocolError(
        `${field}.assemblyCharge is outside the current native rebuild bucket`,
      )
    }
    if (shellCharge > maximumCharge) {
      throw new GameProtocolError(`${field}.shellCharge exceeds the released charge ceiling`)
    }
    if (!Array.isArray(source.orientation) || source.orientation.length !== 9) {
      throw new GameProtocolError(`${field}.orientation must contain nine float32 values`)
    }
    const orientation = source.orientation.map((value, index) => {
      const component = finite(value, `${field}.orientation[${index}]`)
      if (component !== Math.fround(component)) {
        throw new GameProtocolError(`${field}.orientation[${index}] must be float32`)
      }
      return component
    }) as unknown as PrimarySpellEarthProjectileState['orientation']
    const hitTargetIds = limitedArray(
      source.hitTargetIds,
      `${field}.hitTargetIds`,
      MAX_PRIMARY_SPELL_HIT_TARGETS,
    ).map((targetId, index) => limitedString(
      targetId,
      `${field}.hitTargetIds[${index}]`,
      256,
    ))
    if (new Set(hitTargetIds).size !== hitTargetIds.length) {
      throw new GameProtocolError(`${field}.hitTargetIds contains a duplicate target`)
    }
    return {
      ...projectile,
      assemblyCharge,
      hitTargetIds,
      kind: 'earth',
      maximumCharge,
      orientation,
      remainingDamage,
      shellCharge,
      toughness,
    } satisfies PrimarySpellEarthProjectileState
  }
  if (source.kind === 'ether') {
    const damageRetention = finite(source.damageRetention, `${field}.damageRetention`)
    if (damageRetention < 0 || damageRetention > 1) {
      throw new GameProtocolError(`${field}.damageRetention is outside [0,1]`)
    }
    const headingDegrees = finite(source.headingDegrees, `${field}.headingDegrees`)
    if (headingDegrees < 0 || headingDegrees >= 360) {
      throw new GameProtocolError(`${field}.headingDegrees is outside [0,360)`)
    }
    const turnAccumulator = finite(source.turnAccumulator, `${field}.turnAccumulator`)
    if (turnAccumulator < ETHER_PRIMARY_INITIAL_TURN || turnAccumulator > 10) {
      throw new GameProtocolError(
        `${field}.turnAccumulator is outside [${ETHER_PRIMARY_INITIAL_TURN},10]`,
      )
    }
    const speed = positiveFinite(source.speed, `${field}.speed`)
    const turnInput = positiveFinite(source.turnInput, `${field}.turnInput`)
    const visualScale = positiveFinite(source.visualScale, `${field}.visualScale`)
    if (speed > 100 || turnInput > 100 || visualScale > 1) {
      throw new GameProtocolError(`${field} exceeds the native Ether payload range`)
    }
    return {
      ...projectile,
      damageRetention,
      headingDegrees,
      kind: 'ether',
      piercesRemaining: nonnegativeInteger(
        source.piercesRemaining,
        `${field}.piercesRemaining`,
      ),
      reacquiresTarget: boolean(source.reacquiresTarget, `${field}.reacquiresTarget`),
      speed,
      targetId: source.targetId === null
        ? null
        : limitedString(source.targetId, `${field}.targetId`, 256),
      turnInput,
      turnAccumulator,
      underpowered: boolean(source.underpowered, `${field}.underpowered`),
      visualScale,
    }
  }
  const emberFragments = nonnegativeInteger(
    source.emberFragments,
    `${field}.emberFragments`,
  )
  if (emberFragments > 100) {
    throw new GameProtocolError(`${field}.emberFragments exceeds the native payload range`)
  }
  const privateSeed = nonnegativeInteger(source.privateSeed, `${field}.privateSeed`)
  if (privateSeed > 1_000_000) {
    throw new GameProtocolError(`${field}.privateSeed exceeds the native seed range`)
  }
  return {
    ...projectile,
    burnDamage: nonnegativeFinite(source.burnDamage, `${field}.burnDamage`),
    emberDamage: nonnegativeFinite(source.emberDamage, `${field}.emberDamage`),
    emberFragments,
    explodeDamage: nonnegativeFinite(source.explodeDamage, `${field}.explodeDamage`),
    explodeRadius: nonnegativeFinite(source.explodeRadius, `${field}.explodeRadius`),
    kind: 'fire',
    privateSeed,
    spentEmber: primarySpellFireSpentEmber(source.spentEmber, `${field}.spentEmber`),
    underpowered: boolean(source.underpowered, `${field}.underpowered`),
  }
}

const NATIVE_WELD_VECTOR_LENGTHS: Readonly<Record<NativeWeldBuildId, number>> = {
  1000: 9,
  1001: 7,
  1002: 7,
  1003: 8,
  1004: 7,
  1005: 8,
  1006: 6,
  1007: 9,
  1008: 6,
  1009: 6,
}

function primarySpellWeldProjectile(
  source: Record<string, unknown>,
  field: string,
): NativeWeldProjectileState {
  onlyKeys(source, field, [
    'ageTicks', 'ballLightningAcceleration', 'basePresentationPhaseDegrees',
    'buildId', 'castPlaybackRate', 'castSoundVariant', 'charge',
    'contactsRemaining', 'damage', 'direction', 'flightTicks', 'frostPulseAspect',
    'frostPresentationLanes', 'frostTurnDegrees', 'groundSparkNativeAgeTicks',
    'groundSparkTurnTicksRemaining', 'headingDegrees', 'hitTargetIds', 'id', 'kind',
    'lightRegistration', 'ownerId', 'phase', 'position', 'presentationSeed',
    'projectileIndex', 'reacquiresTarget', 'secondaryPresentationPhaseDegrees', 'speed', 'targetId',
    'turnAccumulator', 'turnInput', 'underpowered', 'vector', 'velocity', 'worldKey',
  ])
  const buildId = weldBuildId(source.buildId, `${field}.buildId`)
  if (buildId !== 1000 && buildId !== 1001 && buildId !== 1002 && buildId !== 1009) {
    throw new GameProtocolError(`${field}.buildId is not a welded one-shot build`)
  }
  if (source.charge !== 1 || source.phase !== 'flight') {
    throw new GameProtocolError(`${field} is not a released welded projectile`)
  }
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  const flightTicks = nonnegativeInteger(source.flightTicks, `${field}.flightTicks`)
  if (flightTicks > ageTicks) {
    throw new GameProtocolError(`${field}.flightTicks exceeds the actor age`)
  }
  const headingDegrees = finite(source.headingDegrees, `${field}.headingDegrees`)
  if (headingDegrees < 0 || headingDegrees >= 360) {
    throw new GameProtocolError(`${field}.headingDegrees is outside [0,360)`)
  }
  const presentationSeed = source.presentationSeed === null
    ? null
    : nonnegativeInteger(source.presentationSeed, `${field}.presentationSeed`)
  if ((buildId !== 1000 && buildId !== 1009 && presentationSeed !== null)
    || ((buildId === 1000 || buildId === 1009) && presentationSeed === null)
    || (buildId === 1000 && presentationSeed !== null && presentationSeed >= 100_000)
    || (buildId === 1009 && presentationSeed !== null && presentationSeed > 0xffff_ffff)) {
    throw new GameProtocolError(`${field}.presentationSeed does not match its welded build`)
  }
  const basePresentationPhaseDegrees = source.basePresentationPhaseDegrees === null
    ? null
    : finite(source.basePresentationPhaseDegrees, `${field}.basePresentationPhaseDegrees`)
  if ((buildId === 1009 && basePresentationPhaseDegrees !== null)
    || (buildId !== 1009 && (basePresentationPhaseDegrees === null
      || basePresentationPhaseDegrees < 0))) {
    throw new GameProtocolError(
      `${field}.basePresentationPhaseDegrees does not match its welded build`,
    )
  }
  const secondaryPresentationPhaseDegrees = source.secondaryPresentationPhaseDegrees === null
    ? null
    : finite(
        source.secondaryPresentationPhaseDegrees,
        `${field}.secondaryPresentationPhaseDegrees`,
      )
  if ((buildId !== 1001 && secondaryPresentationPhaseDegrees !== null)
    || (buildId === 1001 && (secondaryPresentationPhaseDegrees === null
      || secondaryPresentationPhaseDegrees < 0
      || secondaryPresentationPhaseDegrees > 360))) {
    throw new GameProtocolError(
      `${field}.secondaryPresentationPhaseDegrees does not match its welded build`,
    )
  }
  const castSoundVariant = source.castSoundVariant === null
    ? null
    : nonnegativeInteger(source.castSoundVariant, `${field}.castSoundVariant`)
  const soundVariantCount = buildId === 1002 ? 2 : buildId === 1009 ? 3 : 0
  if ((soundVariantCount === 0 && castSoundVariant !== null)
    || (soundVariantCount > 0
      && (castSoundVariant === null || castSoundVariant >= soundVariantCount))) {
    throw new GameProtocolError(`${field}.castSoundVariant does not match its welded build`)
  }
  const castPlaybackRate = positiveFinite(
    source.castPlaybackRate,
    `${field}.castPlaybackRate`,
  )
  if (castPlaybackRate < 0.5 || castPlaybackRate > 1.5) {
    throw new GameProtocolError(`${field}.castPlaybackRate is outside the native lane`)
  }
  const ballLightningAcceleration = source.ballLightningAcceleration === null
    ? null
    : nonnegativeFinite(
        source.ballLightningAcceleration,
        `${field}.ballLightningAcceleration`,
      )
  if ((buildId !== 1002 && ballLightningAcceleration !== null)
    || (buildId === 1002 && (ballLightningAcceleration === null
      || ballLightningAcceleration > 2))) {
    throw new GameProtocolError(`${field}.ballLightningAcceleration does not match its build`)
  }
  const frostPulseAspect = source.frostPulseAspect === null
    ? null
    : finite(source.frostPulseAspect, `${field}.frostPulseAspect`)
  if ((buildId !== 1001 && frostPulseAspect !== null)
    || (buildId === 1001 && (frostPulseAspect === null
      || frostPulseAspect < 0.5 || frostPulseAspect > 0.75))) {
    throw new GameProtocolError(`${field}.frostPulseAspect does not match its build`)
  }
  const frostPresentationLanes = source.frostPresentationLanes === null
    ? null
    : limitedArray(source.frostPresentationLanes, `${field}.frostPresentationLanes`, 2)
      .map((value, index) => {
        const lane = record(value, `${field}.frostPresentationLanes[${index}]`)
        onlyKeys(lane, `${field}.frostPresentationLanes[${index}]`, [
          'aspect', 'rotationDegrees', 'scale',
        ])
        const aspect = nonnegativeFinite(
          lane.aspect,
          `${field}.frostPresentationLanes[${index}].aspect`,
        )
        const rotationDegrees = nonnegativeFinite(
          lane.rotationDegrees,
          `${field}.frostPresentationLanes[${index}].rotationDegrees`,
        )
        const scale = nonnegativeFinite(
          lane.scale,
          `${field}.frostPresentationLanes[${index}].scale`,
        )
        if (aspect > 0.75 || rotationDegrees > 45 || scale > 1.25) {
          throw new GameProtocolError(
            `${field}.frostPresentationLanes[${index}] exceeds the native lane`,
          )
        }
        return { aspect, rotationDegrees, scale }
      })
  if ((buildId === 1001) !== (frostPresentationLanes?.length === 2)) {
    throw new GameProtocolError(`${field}.frostPresentationLanes does not match its build`)
  }
  const frostTurnDegrees = source.frostTurnDegrees === null
    ? null
    : finite(source.frostTurnDegrees, `${field}.frostTurnDegrees`)
  if ((buildId !== 1001 && frostTurnDegrees !== null)
    || (buildId === 1001 && (frostTurnDegrees === null
      || frostTurnDegrees < -35 || frostTurnDegrees > 35))) {
    throw new GameProtocolError(`${field}.frostTurnDegrees does not match its build`)
  }
  const groundSparkNativeAgeTicks = source.groundSparkNativeAgeTicks === null
    ? null
    : nonnegativeInteger(
        source.groundSparkNativeAgeTicks,
        `${field}.groundSparkNativeAgeTicks`,
      )
  const groundSparkTurnTicksRemaining = source.groundSparkTurnTicksRemaining === null
    ? null
    : nonnegativeInteger(
        source.groundSparkTurnTicksRemaining,
        `${field}.groundSparkTurnTicksRemaining`,
      )
  if ((buildId !== 1009
    && (groundSparkNativeAgeTicks !== null || groundSparkTurnTicksRemaining !== null))
    || (buildId === 1009 && (groundSparkNativeAgeTicks === null
      || groundSparkTurnTicksRemaining === null || groundSparkTurnTicksRemaining > 20))) {
    throw new GameProtocolError(`${field} GroundSpark private motion state is malformed`)
  }
  const targetId = source.targetId === null
    ? null
    : limitedString(source.targetId, `${field}.targetId`, 256)
  if (buildId === 1009 && targetId !== null) {
    throw new GameProtocolError(`${field}.targetId is invalid for Crawling Shock`)
  }
  const turnAccumulator = finite(source.turnAccumulator, `${field}.turnAccumulator`)
  if (turnAccumulator < ETHER_PRIMARY_INITIAL_TURN || turnAccumulator > 10) {
    throw new GameProtocolError(`${field}.turnAccumulator is outside the native homing lane`)
  }
  const turnInput = nonnegativeFinite(source.turnInput, `${field}.turnInput`)
  if ((buildId === 1009) !== (turnInput === 0)) {
    throw new GameProtocolError(`${field}.turnInput does not match its welded build`)
  }
  return {
    ageTicks,
    ballLightningAcceleration,
    basePresentationPhaseDegrees,
    buildId,
    castPlaybackRate,
    castSoundVariant,
    charge: 1,
    contactsRemaining: positiveInteger(
      source.contactsRemaining,
      `${field}.contactsRemaining`,
    ),
    damage: positiveFinite(source.damage, `${field}.damage`),
    direction: unitVector(source.direction, `${field}.direction`),
    flightTicks,
    frostPulseAspect,
    frostPresentationLanes: frostPresentationLanes as
      NativeWeldProjectileState['frostPresentationLanes'],
    frostTurnDegrees,
    groundSparkNativeAgeTicks,
    groundSparkTurnTicksRemaining,
    headingDegrees,
    hitTargetIds: uniqueWeldTargetIds(source.hitTargetIds, `${field}.hitTargetIds`),
    id: positiveInteger(source.id, `${field}.id`),
    kind: 'weld',
    lightRegistration: nativeLightProviderRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    phase: 'flight',
    position: vector(source.position, `${field}.position`),
    presentationSeed,
    projectileIndex: nonnegativeInteger(source.projectileIndex, `${field}.projectileIndex`),
    reacquiresTarget: boolean(source.reacquiresTarget, `${field}.reacquiresTarget`),
    secondaryPresentationPhaseDegrees,
    speed: positiveFinite(source.speed, `${field}.speed`),
    targetId,
    turnAccumulator,
    turnInput,
    underpowered: boolean(source.underpowered, `${field}.underpowered`),
    vector: weldVector(source.vector, buildId, `${field}.vector`),
    velocity: vector(source.velocity, `${field}.velocity`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
}

function weldBuildId(value: unknown, field: string): NativeWeldBuildId {
  const buildId = integer(value, field)
  if (buildId < 1000 || buildId > 1009) {
    throw new GameProtocolError(`${field} is not a native welded build`)
  }
  return buildId as NativeWeldBuildId
}

function weldVector(
  value: unknown,
  buildId: NativeWeldBuildId,
  field: string,
): readonly number[] {
  const expected = NATIVE_WELD_VECTOR_LENGTHS[buildId]
  const source = limitedArray(value, field, 9)
  if (source.length !== expected) {
    throw new GameProtocolError(`${field} must contain ${expected} native values`)
  }
  return source.map((component, index) => finite(component, `${field}[${index}]`))
}

function uniqueWeldTargetIds(value: unknown, field: string): readonly string[] {
  const ids = limitedArray(value, field, MAX_PRIMARY_SPELL_HIT_TARGETS).map(
    (targetId, index) => limitedString(targetId, `${field}[${index}]`, 256),
  )
  if (new Set(ids).size !== ids.length) {
    throw new GameProtocolError(`${field} contains a duplicate target`)
  }
  return ids
}

function requireWeldHailBuild(buildId: NativeWeldBuildId, field: string): void {
  if (buildId !== 1008) throw new GameProtocolError(`${field}.buildId is not Hailstones`)
}

function primarySpellWeldActor(
  source: Record<string, unknown>,
  field: string,
): NativeWeldWorldActor {
  const buildId = weldBuildId(source.buildId, `${field}.buildId`)
  const commonKeys = [
    'ageTicks', 'birthTick', 'buildId', 'direction', 'id', 'kind',
    'lightRegistration', 'origin', 'ownerId', 'vector', 'worldKey',
  ]
  const common = {
    ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
    birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
    buildId,
    direction: unitVector(source.direction, `${field}.direction`),
    id: positiveInteger(source.id, `${field}.id`),
    origin: vector(source.origin, `${field}.origin`),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    vector: weldVector(source.vector, buildId, `${field}.vector`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }

  if (source.kind === 'weld-meteor-marker') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'colorGreen', 'growthFactor', 'rotationDegrees', 'scale',
    ])
    if (buildId !== 1007) throw new GameProtocolError(`${field}.buildId is not Meteor Swarm`)
    const alpha = positiveFinite(source.alpha, `${field}.alpha`)
    if (alpha > 0.5) throw new GameProtocolError(`${field}.alpha exceeds native marker range`)
    const colorGreen = unitInterval(source.colorGreen, `${field}.colorGreen`)
    if (colorGreen > 0.5) {
      throw new GameProtocolError(`${field}.colorGreen exceeds native marker range`)
    }
    const growthFactor = finite(source.growthFactor, `${field}.growthFactor`)
    if (growthFactor !== Math.fround(0.99) && growthFactor !== Math.fround(1.015)) {
      throw new GameProtocolError(`${field}.growthFactor is not a native marker branch`)
    }
    const rotationDegrees = finite(source.rotationDegrees, `${field}.rotationDegrees`)
    if (rotationDegrees < 0 || rotationDegrees > 360) {
      throw new GameProtocolError(`${field}.rotationDegrees is outside [0,360]`)
    }
    return {
      ...common,
      alpha,
      buildId: 1007,
      colorGreen,
      growthFactor,
      kind: 'weld-meteor-marker',
      lightRegistration: absentNativeActorLight(source, field),
      rotationDegrees,
      scale: positiveFinite(source.scale, `${field}.scale`),
    } satisfies NativeWeldMeteorMarkerState
  }

  if (source.kind === 'weld-channel') {
    onlyKeys(source, field, [
      ...commonKeys, 'endpoint', 'midpoint', 'targetId', 'underpowered', 'variant',
    ])
    if (buildId !== 1003 && buildId !== 1004) {
      throw new GameProtocolError(`${field}.buildId is not a welded channel build`)
    }
    if (common.ageTicks >= NATIVE_WELD_CHANNEL_VISIBLE_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the welded channel lifetime`)
    }
    const variant = nonnegativeInteger(source.variant, `${field}.variant`)
    if (variant > 3) throw new GameProtocolError(`${field}.variant exceeds the native family`)
    const endpoint = source.endpoint === null
      ? null
      : vector(source.endpoint, `${field}.endpoint`)
    const midpoint = source.midpoint === null
      ? null
      : vector(source.midpoint, `${field}.midpoint`)
    if ((endpoint === null) !== (midpoint === null)) {
      throw new GameProtocolError(`${field}.endpoint and midpoint must be present together`)
    }
    return {
      ...common,
      buildId,
      endpoint,
      kind: 'weld-channel',
      lightRegistration: absentNativeActorLight(source, field),
      midpoint,
      targetId: source.targetId === null
        ? null
        : limitedString(source.targetId, `${field}.targetId`, 256),
      underpowered: boolean(source.underpowered, `${field}.underpowered`),
      variant,
    } satisfies NativeWeldChannelActorState
  }

  if (source.kind === 'weld-impact') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'boulderTerminalCharge', 'impactSoundPitch',
      'impactSoundVariant', 'position', 'presentationRotationDegrees',
      'presentationScale',
    ])
    if (buildId === 1003 || buildId === 1004 || buildId === 1005) {
      throw new GameProtocolError(`${field}.buildId cannot create a welded impact actor`)
    }
    if (common.ageTicks >= NATIVE_WELD_IMPACT_VISIBLE_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the welded impact lifetime`)
    }
    const alpha = nonnegativeFinite(source.alpha, `${field}.alpha`)
    const boulderTerminalCharge = source.boulderTerminalCharge === null
      ? null
      : positiveFinite(source.boulderTerminalCharge, `${field}.boulderTerminalCharge`)
    const impactSoundPitch = source.impactSoundPitch === null
      ? null
      : positiveFinite(source.impactSoundPitch, `${field}.impactSoundPitch`)
    const impactSoundVariant = source.impactSoundVariant === null
      ? null
      : nonnegativeInteger(source.impactSoundVariant, `${field}.impactSoundVariant`)
    const presentationRotationDegrees = source.presentationRotationDegrees === null
      ? null
      : finite(source.presentationRotationDegrees, `${field}.presentationRotationDegrees`)
    const presentationScale = nonnegativeFinite(
      source.presentationScale,
      `${field}.presentationScale`,
    )
    const ownsStandardFade = buildId === 1001 || buildId === 1002 || buildId === 1009
    if ((buildId === 1006 && (alpha > 2 || presentationScale !== 2))
      || (ownsStandardFade && (alpha > 2 || presentationScale !== Math.fround(1.5)))
      || (!ownsStandardFade && buildId !== 1006 && (alpha !== 0 || presentationScale !== 0))) {
      throw new GameProtocolError(`${field} fade state does not match its build`)
    }
    if ((buildId === 1006) !== (boulderTerminalCharge !== null)) {
      throw new GameProtocolError(`${field}.boulderTerminalCharge does not match its build`)
    }
    if ((buildId === 1001 && (impactSoundPitch !== Math.fround(1.5)
      || impactSoundVariant !== null || presentationRotationDegrees !== null))
      || (buildId === 1002 && (impactSoundPitch !== Math.fround(1.5)
        || impactSoundVariant !== 0 || presentationRotationDegrees === null))
      || (buildId === 1009 && (impactSoundPitch === null
        || impactSoundPitch < 1 || impactSoundPitch > Math.fround(1.1)
        || impactSoundVariant === null || impactSoundVariant > 2
        || presentationRotationDegrees === null))
      || ((buildId !== 1001 && buildId !== 1002 && buildId !== 1009)
        && (impactSoundPitch !== null || impactSoundVariant !== null
          || presentationRotationDegrees !== null))) {
      throw new GameProtocolError(`${field} impact presentation does not match its build`)
    }
    if (presentationRotationDegrees !== null
      && (presentationRotationDegrees < 0 || presentationRotationDegrees > 360)) {
      throw new GameProtocolError(`${field}.presentationRotationDegrees is outside [0,360]`)
    }
    return {
      ...common,
      alpha,
      boulderTerminalCharge,
      buildId,
      impactSoundPitch,
      impactSoundVariant,
      kind: 'weld-impact',
      lightRegistration: buildId === 1006
        ? nativeLightProviderRegistration(
            source.lightRegistration,
            `${field}.lightRegistration`,
            'transient',
          )
        : absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      presentationRotationDegrees,
      presentationScale,
    } satisfies NativeWeldImpactActorState
  }

  if (source.kind === 'weld-boulder-debris') {
    onlyKeys(source, field, [...commonKeys, 'debris', 'position'])
    if (buildId !== 1006 && buildId !== 1007) {
      throw new GameProtocolError(`${field}.buildId is not a Boulder carrier`)
    }
    if (common.ageTicks >= NATIVE_BOULDER_DEBRIS_MAX_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the BoulderBit lifetime`)
    }
    const debris = nativeWeldBoulderDebris(source.debris, `${field}.debris`)
    return {
      ...common,
      buildId,
      debris,
      kind: 'weld-boulder-debris',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
    } satisfies NativeWeldBoulderDebrisActorState
  }

  if (source.kind === 'weld-blizzard-glow') {
    onlyKeys(source, field, [
      ...commonKeys, 'rotationDegrees', 'scale', 'variant',
    ])
    const variant = source.variant
    if (
      buildId !== 1004
      || common.ageTicks !== 0
      || (variant !== 3 && variant !== 24)
    ) {
      throw new GameProtocolError(`${field}.BlizzardGlow`)
    }
    const scale = positiveFinite(source.scale, `${field}.scale`)
    if (scale < 1 || scale > 1.5) {
      throw new GameProtocolError(`${field}.scale`)
    }
    const rotationDegrees = finite(source.rotationDegrees, `${field}.rotationDegrees`)
    if (rotationDegrees < 0 || rotationDegrees > 360) {
      throw new GameProtocolError(`${field}.rotationDegrees`)
    }
    return {
      ...common,
      buildId: 1004,
      kind: 'weld-blizzard-glow',
      lightRegistration: absentNativeActorLight(source, field),
      rotationDegrees,
      scale,
      variant: variant as 3 | 24,
    } satisfies NativeWeldBlizzardGlowState
  }

  if (source.kind === 'weld-blizzard-chain-frost') {
    onlyKeys(source, field, commonKeys)
    if (buildId !== 1004 || common.ageTicks >= 33) {
      throw new GameProtocolError(`${field}.chainFrost`)
    }
    return {
      ...common,
      buildId: 1004,
      kind: 'weld-blizzard-chain-frost',
      lightRegistration: absentNativeActorLight(source, field),
    } satisfies NativeWeldBlizzardChainFrostState
  }

  if (source.kind === 'weld-flame-lash-fade') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'alphaStep', 'baseScale', 'colorGreen', 'position',
      'record', 'rotationDegrees', 'variant', 'wrapperScalar',
    ])
    if (buildId !== 1003) throw new GameProtocolError(`${field}.buildId is not Flame Lash`)
    const alpha = positiveFinite(source.alpha, `${field}.alpha`)
    const alphaStep = positiveFinite(source.alphaStep, `${field}.alphaStep`)
    if (alpha > 1 || alphaStep !== NATIVE_WELD_FLAME_LASH_FADE_ALPHA_STEP
      || common.ageTicks >= 6) {
      throw new GameProtocolError(`${field} exceeds the Flame Lash fade clock`)
    }
    const variant = source.variant
    if (variant !== 'endpoint' && variant !== 'chain') {
      throw new GameProtocolError(`${field}.variant is not a Flame Lash fade branch`)
    }
    const baseScale = positiveFinite(source.baseScale, `${field}.baseScale`)
    if ((variant === 'endpoint' && (baseScale < 0.5 || baseScale > 1))
      || (variant === 'chain' && (
        baseScale < Math.fround(0.05)
        || baseScale > Math.fround(0.1)
      ))) {
      throw new GameProtocolError(`${field}.baseScale exceeds its Flame Lash branch`)
    }
    const colorGreen = unitInterval(source.colorGreen, `${field}.colorGreen`)
    if ((variant === 'chain' && colorGreen !== Math.fround(0.75))
      || (variant === 'endpoint' && (colorGreen < 0.5 || colorGreen > 1))) {
      throw new GameProtocolError(`${field}.colorGreen exceeds its Flame Lash branch`)
    }
    const wrapperScalar = positiveFinite(source.wrapperScalar, `${field}.wrapperScalar`)
    if (wrapperScalar < 0.75 || wrapperScalar > 1.5) {
      throw new GameProtocolError(`${field}.wrapperScalar exceeds the native range`)
    }
    if (source.record !== 35) throw new GameProtocolError(`${field}.record is not BadGuys 35`)
    return {
      ...common,
      alpha,
      alphaStep,
      baseScale,
      buildId: 1003,
      colorGreen,
      kind: 'weld-flame-lash-fade',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      record: 35,
      rotationDegrees: finite(source.rotationDegrees, `${field}.rotationDegrees`),
      variant,
      wrapperScalar,
    } satisfies NativeWeldFlameLashFadeState
  }

  if (source.kind === 'weld-hail-line') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'alphaStep', 'end', 'endAlpha', 'start', 'width',
    ])
    requireWeldHailBuild(buildId, field)
    const alphaStep = positiveFinite(source.alphaStep, `${field}.alphaStep`)
    if (alphaStep !== NATIVE_WELD_HAIL_LINE_ALPHA_STEP || common.ageTicks >= 14) {
      throw new GameProtocolError(`${field} does not match the native Hail line lifetime`)
    }
    const endAlpha = positiveFinite(source.endAlpha, `${field}.endAlpha`)
    if (endAlpha < 0.25 || endAlpha > 0.5) {
      throw new GameProtocolError(`${field}.endAlpha exceeds the native line range`)
    }
    const width = positiveFinite(source.width, `${field}.width`)
    if (width !== 6) throw new GameProtocolError(`${field}.width is not native`)
    return {
      ...common,
      alpha: positiveFinite(source.alpha, `${field}.alpha`),
      alphaStep,
      buildId: 1008,
      end: vector(source.end, `${field}.end`),
      endAlpha,
      kind: 'weld-hail-line',
      lightRegistration: absentNativeActorLight(source, field),
      start: vector(source.start, `${field}.start`),
      width,
    } satisfies NativeWeldHailLineState
  }

  if (source.kind === 'weld-hail-flash') {
    onlyKeys(source, field, [...commonKeys, 'alpha', 'alphaStep', 'position', 'record'])
    requireWeldHailBuild(buildId, field)
    const alphaStep = positiveFinite(source.alphaStep, `${field}.alphaStep`)
    if (alphaStep !== NATIVE_WELD_HAIL_FLASH_ALPHA_STEP || common.ageTicks >= 10) {
      throw new GameProtocolError(`${field} does not match the native Hail flash lifetime`)
    }
    if (source.record !== 15) throw new GameProtocolError(`${field}.record is not BadGuys 15`)
    return {
      ...common,
      alpha: positiveFinite(source.alpha, `${field}.alpha`),
      alphaStep,
      buildId: 1008,
      kind: 'weld-hail-flash',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      record: 15,
    } satisfies NativeWeldHailFlashState
  }

  if (source.kind === 'weld-hail-knockback') {
    onlyKeys(source, field, [...commonKeys, 'delta', 'remainingTicks', 'targetId'])
    requireWeldHailBuild(buildId, field)
    const remainingTicks = positiveInteger(source.remainingTicks, `${field}.remainingTicks`)
    if (remainingTicks > 20) {
      throw new GameProtocolError(`${field}.remainingTicks exceeds native Hail push`)
    }
    return {
      ...common,
      buildId: 1008,
      delta: unitVector(source.delta, `${field}.delta`),
      kind: 'weld-hail-knockback',
      lightRegistration: absentNativeActorLight(source, field),
      remainingTicks,
      targetId: limitedString(source.targetId, `${field}.targetId`, 256),
    } satisfies NativeWeldHailKnockbackState
  }

  if (source.kind === 'weld-hail-terrain-particle') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'alphaStep', 'position', 'record', 'rotationDegrees',
      'scale', 'tint', 'velocity', 'velocityFactor',
    ])
    requireWeldHailBuild(buildId, field)
    const alphaStep = positiveFinite(source.alphaStep, `${field}.alphaStep`)
    const velocityFactor = positiveFinite(source.velocityFactor, `${field}.velocityFactor`)
    if (alphaStep !== Math.fround(0.125) || velocityFactor !== Math.fround(0.92)
      || common.ageTicks >= 8) {
      throw new GameProtocolError(`${field} does not match native Hail terrain motion`)
    }
    if (source.record !== 45) throw new GameProtocolError(`${field}.record is not BadGuys 45`)
    return {
      ...common,
      alpha: positiveFinite(source.alpha, `${field}.alpha`),
      alphaStep,
      buildId: 1008,
      kind: 'weld-hail-terrain-particle',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      record: 45,
      rotationDegrees: finite(source.rotationDegrees, `${field}.rotationDegrees`),
      scale: positiveFinite(source.scale, `${field}.scale`),
      tint: nonnegativeInteger(source.tint, `${field}.tint`),
      velocity: vector(source.velocity, `${field}.velocity`),
      velocityFactor,
    } satisfies NativeWeldHailTerrainParticleState
  }

  if (source.kind === 'weld-hail-terrain-bouncer') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'bounceVelocity', 'enhancedShadow', 'height',
      'position', 'record', 'rotationDegrees', 'rotationStepDegrees', 'scale',
      'velocity', 'verticalVelocity',
    ])
    requireWeldHailBuild(buildId, field)
    if (common.ageTicks >= 500 || source.record !== 32) {
      throw new GameProtocolError(`${field} exceeds the native Hail bouncer contract`)
    }
    return {
      ...common,
      alpha: positiveFinite(source.alpha, `${field}.alpha`),
      bounceVelocity: finite(source.bounceVelocity, `${field}.bounceVelocity`),
      buildId: 1008,
      enhancedShadow: boolean(source.enhancedShadow, `${field}.enhancedShadow`),
      height: finite(source.height, `${field}.height`),
      kind: 'weld-hail-terrain-bouncer',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      record: 32,
      rotationDegrees: finite(source.rotationDegrees, `${field}.rotationDegrees`),
      rotationStepDegrees: finite(
        source.rotationStepDegrees,
        `${field}.rotationStepDegrees`,
      ),
      scale: positiveFinite(source.scale, `${field}.scale`),
      velocity: vector(source.velocity, `${field}.velocity`),
      verticalVelocity: finite(source.verticalVelocity, `${field}.verticalVelocity`),
    } satisfies NativeWeldHailTerrainBouncerState
  }

  if (source.kind === 'weld-hail-rock-fade') {
    onlyKeys(source, field, [...commonKeys, 'position', 'rotationDegrees'])
    if (buildId !== 1008) throw new GameProtocolError(`${field}.buildId is not Hailstones`)
    if (common.ageTicks >= NATIVE_WELD_HAIL_ROCK_FADE_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Hail rock-fade lifetime`)
    }
    const rotationDegrees = finite(source.rotationDegrees, `${field}.rotationDegrees`)
    if (rotationDegrees < 0 || rotationDegrees > 20) {
      throw new GameProtocolError(`${field}.rotationDegrees exceeds the native range`)
    }
    return {
      ...common,
      buildId: 1008,
      kind: 'weld-hail-rock-fade',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      rotationDegrees,
    } satisfies NativeWeldHailRockFadeActorState
  }

  if (source.kind === 'weld-frost-fade') {
    onlyKeys(source, field, [...commonKeys, 'scale'])
    const blizzard = buildId === 1004
    if (!blizzard && buildId !== 1008) throw new GameProtocolError(`${field}.buildId`)
    const scale = positiveFinite(source.scale, `${field}.scale`)
    if (
      common.ageTicks >= (blizzard ? 3 : NATIVE_WELD_HAIL_RELEASE_FADE_LIFETIME_TICKS)
      || scale < (blizzard ? 1 : 3.75)
      || scale > (blizzard ? 1.5 : 7.5)
    ) {
      throw new GameProtocolError(`${field} Frost-fade range`)
    }
    return {
      ...common,
      buildId,
      kind: 'weld-frost-fade',
      lightRegistration: absentNativeActorLight(source, field),
      scale,
    } satisfies NativeWeldFrostFadeActorState
  }

  if (source.kind === 'weld-ground-spark-fade') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'alphaStep', 'position', 'record',
      'rotationDegrees', 'scale',
    ])
    if (buildId !== 1009) {
      throw new GameProtocolError(`${field}.buildId is not Crawling Shock`)
    }
    if (common.ageTicks >= 20) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the GroundSpark fade lifetime`)
    }
    const alpha = positiveFinite(source.alpha, `${field}.alpha`)
    if (alpha > 1.75) throw new GameProtocolError(`${field}.alpha exceeds the native range`)
    const alphaStep = positiveFinite(source.alphaStep, `${field}.alphaStep`)
    if (alphaStep !== Math.fround(0.05) && alphaStep !== Math.fround(0.1)) {
      throw new GameProtocolError(`${field}.alphaStep is not a native GroundSpark branch`)
    }
    const nativeRecord = positiveInteger(source.record, `${field}.record`)
    if (nativeRecord !== 71 && (
      nativeRecord < 1836 || nativeRecord > 1839
    )) throw new GameProtocolError(`${field}.record is not GroundSpark art`)
    const rotationDegrees = finite(source.rotationDegrees, `${field}.rotationDegrees`)
    if (rotationDegrees < 0 || rotationDegrees > 360) {
      throw new GameProtocolError(`${field}.rotationDegrees is outside [0,360]`)
    }
    const scale = positiveFinite(source.scale, `${field}.scale`)
    if (scale < Math.fround(0.25) || scale > 1) {
      throw new GameProtocolError(`${field}.scale exceeds the native GroundSpark range`)
    }
    return {
      ...common,
      alpha,
      alphaStep,
      buildId: 1009,
      kind: 'weld-ground-spark-fade',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      record: nativeRecord as NativeWeldGroundSparkFadeActorState['record'],
      rotationDegrees,
      scale,
    } satisfies NativeWeldGroundSparkFadeActorState
  }

  if (source.kind === 'weld-steam') {
    onlyKeys(source, field, [
      ...commonKeys, 'alphaMultiplier', 'blue', 'colorRise', 'life', 'lifeLoss',
      'contactDamage', 'contactDue', 'contactEnabled', 'contactTicksRemaining',
      'phase', 'position', 'remainingDistance', 'rotationDegrees', 'scale', 'stretch',
      'terminalPosition', 'tintFade', 'variant', 'velocity',
    ])
    if (buildId !== 1005) throw new GameProtocolError(`${field}.buildId is not Steam Jet`)
    if (common.ageTicks >= 512) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Steam particle lifetime`)
    }
    const variant = source.variant
    if (variant !== 'normal' && variant !== 'over') {
      throw new GameProtocolError(`${field}.variant is not a Steam particle branch`)
    }
    const colorRise = positiveFinite(source.colorRise, `${field}.colorRise`)
    if ((variant === 'normal' && colorRise !== Math.fround(0.15))
      || (variant === 'over' && colorRise !== Math.fround(0.075))) {
      throw new GameProtocolError(`${field}.colorRise does not match its Steam branch`)
    }
    const life = positiveFinite(source.life, `${field}.life`)
    const lifeLoss = positiveFinite(source.lifeLoss, `${field}.lifeLoss`)
    if (life > 1.15 || lifeLoss < 0.005 || lifeLoss > 0.055) {
      throw new GameProtocolError(`${field} Steam life state exceeds the native range`)
    }
    const blue = finite(source.blue, `${field}.blue`)
    if (blue > 0.75 || blue < -64) {
      throw new GameProtocolError(`${field}.blue exceeds the native secondary-color lane`)
    }
    const rotationDegrees = finite(source.rotationDegrees, `${field}.rotationDegrees`)
    if (rotationDegrees < 0 || rotationDegrees >= 360) {
      throw new GameProtocolError(`${field}.rotationDegrees is outside [0,360)`)
    }
    const contactEnabled = boolean(source.contactEnabled, `${field}.contactEnabled`)
    const contactDue = boolean(source.contactDue, `${field}.contactDue`)
    const contactTicksRemaining = nonnegativeInteger(
      source.contactTicksRemaining,
      `${field}.contactTicksRemaining`,
    )
    if (contactTicksRemaining > 10 || (!contactEnabled && contactDue)) {
      throw new GameProtocolError(`${field} Steam contact clock is malformed`)
    }
    const alphaMultiplier = positiveFinite(
      source.alphaMultiplier,
      `${field}.alphaMultiplier`,
    )
    if (alphaMultiplier !== 1 && alphaMultiplier !== Math.fround(0.25)) {
      throw new GameProtocolError(`${field}.alphaMultiplier is not a native power branch`)
    }
    return {
      ...common,
      alphaMultiplier,
      blue,
      buildId: 1005,
      colorRise,
      contactDamage: positiveFinite(source.contactDamage, `${field}.contactDamage`),
      contactDue,
      contactEnabled,
      contactTicksRemaining,
      kind: 'weld-steam',
      life,
      lifeLoss,
      lightRegistration: absentNativeActorLight(source, field),
      phase: nonnegativeFinite(source.phase, `${field}.phase`),
      position: vector(source.position, `${field}.position`),
      remainingDistance: nonnegativeFinite(
        source.remainingDistance,
        `${field}.remainingDistance`,
      ),
      rotationDegrees,
      scale: positiveFinite(source.scale, `${field}.scale`),
      stretch: positiveFinite(source.stretch, `${field}.stretch`),
      terminalPosition: vector(source.terminalPosition, `${field}.terminalPosition`),
      tintFade: nonnegativeFinite(source.tintFade, `${field}.tintFade`),
      variant,
      velocity: vector(source.velocity, `${field}.velocity`),
    } satisfies NativeWeldSteamActorState
  }

  if (source.kind === 'weld-meteor-flash') {
    onlyKeys(source, field, [
      ...commonKeys, 'alpha', 'alphaStep', 'position', 'record', 'scale',
    ])
    if (buildId !== 1007) throw new GameProtocolError(`${field}.buildId is not Meteor Swarm`)
    const alpha = positiveFinite(source.alpha, `${field}.alpha`)
    const alphaStep = positiveFinite(source.alphaStep, `${field}.alphaStep`)
    if (alpha > 2 || alphaStep !== Math.fround(0.1) || common.ageTicks >= 20) {
      throw new GameProtocolError(`${field} does not match the native Meteor flash lifetime`)
    }
    if (source.record !== 15 || source.scale !== 6) {
      throw new GameProtocolError(`${field} does not use the native Meteor flash art`)
    }
    return {
      ...common,
      alpha,
      alphaStep,
      buildId: 1007,
      kind: 'weld-meteor-flash',
      lightRegistration: absentNativeActorLight(source, field),
      position: vector(source.position, `${field}.position`),
      record: 15,
      scale: 6,
    } satisfies NativeWeldMeteorFlashActorState
  }

  if (source.kind === 'weld-meteor') {
    onlyKeys(source, field, [
      ...commonKeys, 'bodyScale', 'cameraDisplacement', 'damage', 'debris',
      'fallHeadingDegrees', 'fallHeight', 'fallStep', 'impactAgeTicks', 'impactDue',
      'impactRadiusScalar',
      'impactRotationDegrees', 'impactSoundPitch', 'impactThrowFirePitch',
      'impactTicksRemaining',
      'phase', 'position', 'privateSeed', 'pulseDue', 'pulseSequence',
      'pulseTicksRemaining', 'underpowered',
    ])
    if (buildId !== 1007) throw new GameProtocolError(`${field}.buildId is not Meteor Swarm`)
    if (source.phase !== 'fall' && source.phase !== 'impact') {
      throw new GameProtocolError(`${field}.phase is not a welded Meteor phase`)
    }
    const bodyScale = positiveFinite(source.bodyScale, `${field}.bodyScale`)
    if (bodyScale < 0.75 || bodyScale > 1) {
      throw new GameProtocolError(`${field}.bodyScale is outside the native constructor lane`)
    }
    const fallStep = positiveFinite(source.fallStep, `${field}.fallStep`)
    const fallHeight = finite(source.fallHeight, `${field}.fallHeight`)
    if ((source.phase === 'fall' && (fallHeight <= 0 || fallHeight > 6.25))
      || (source.phase === 'impact' && (fallHeight > 0 || fallHeight <= -fallStep))) {
      throw new GameProtocolError(`${field}.fallHeight does not match the Meteor phase`)
    }
    const underpowered = boolean(source.underpowered, `${field}.underpowered`)
    const privateSeed = nonnegativeInteger(source.privateSeed, `${field}.privateSeed`)
    if ((underpowered && privateSeed !== 0)
      || (!underpowered && privateSeed >= 10_000_000)) {
      throw new GameProtocolError(`${field}.privateSeed exceeds the native draw bound`)
    }
    const impactTicksRemaining = positiveInteger(
      source.impactTicksRemaining,
      `${field}.impactTicksRemaining`,
    )
    const maximumImpactTicks = underpowered
      ? NATIVE_WELD_METEOR_IMPACT_TICKS
      : Math.round(NATIVE_WELD_METEOR_IMPACT_TICKS + common.vector[4]! * 50)
    if (impactTicksRemaining > maximumImpactTicks) {
      throw new GameProtocolError(`${field}.impactTicksRemaining exceeds its native clock`)
    }
    const pulseTicksRemaining = positiveInteger(
      source.pulseTicksRemaining,
      `${field}.pulseTicksRemaining`,
    )
    if (pulseTicksRemaining > NATIVE_WELD_METEOR_PULSE_TICKS) {
      throw new GameProtocolError(`${field}.pulseTicksRemaining exceeds its native clock`)
    }
    const cameraDisplacement = source.cameraDisplacement === null
      ? null
      : vector(source.cameraDisplacement, `${field}.cameraDisplacement`)
    const impactAgeTicks = nonnegativeInteger(source.impactAgeTicks, `${field}.impactAgeTicks`)
    const impactRadiusScalar = finite(
      source.impactRadiusScalar,
      `${field}.impactRadiusScalar`,
    )
    if (impactRadiusScalar <= 0 || impactRadiusScalar > 1.5
      || (source.phase === 'fall' && impactRadiusScalar !== 1)
      || (source.phase === 'impact' && (
        impactRadiusScalar < bodyScale
        || impactRadiusScalar > Math.fround(bodyScale + 0.5)
      ))) {
      throw new GameProtocolError(`${field}.impactRadiusScalar is outside the native lane`)
    }
    const impactRotationDegrees = finite(
      source.impactRotationDegrees,
      `${field}.impactRotationDegrees`,
    )
    if (impactRotationDegrees < 0 || impactRotationDegrees > 360) {
      throw new GameProtocolError(`${field}.impactRotationDegrees is outside [0,360]`)
    }
    const impactSoundPitch = source.impactSoundPitch === null
      ? null
      : positiveFinite(source.impactSoundPitch, `${field}.impactSoundPitch`)
    if (
      impactSoundPitch !== null
      && (impactSoundPitch < 0.8 || impactSoundPitch > Math.fround(1.2))
    ) {
      throw new GameProtocolError(`${field}.impactSoundPitch is outside the native lane`)
    }
    const impactThrowFirePitch = source.impactThrowFirePitch === null
      ? null
      : positiveFinite(source.impactThrowFirePitch, `${field}.impactThrowFirePitch`)
    if (impactThrowFirePitch !== null && impactThrowFirePitch !== Math.fround(0.8)) {
      throw new GameProtocolError(`${field}.impactThrowFirePitch is not native`)
    }
    const debris = limitedArray(source.debris, `${field}.debris`, 5).map((value, index) => (
      nativeWeldMeteorDebris(value, `${field}.debris[${index}]`, index)
    ))
    if ((source.phase === 'fall' && (debris.length !== 0
      || cameraDisplacement !== null || impactAgeTicks !== 0
      || impactRadiusScalar !== 1 || impactRotationDegrees !== 0
      || impactSoundPitch !== null || impactThrowFirePitch !== null))
      || (source.phase === 'impact' && (debris.length !== 0
        || cameraDisplacement === null))
      || ((impactSoundPitch !== null) !== (source.phase === 'impact'))
      || ((impactThrowFirePitch !== null) !== (
        source.phase === 'impact'
        && !underpowered
      ))) {
      throw new GameProtocolError(`${field} Meteor phase-owned presentation state is malformed`)
    }
    const fallHeadingDegrees = finite(
      source.fallHeadingDegrees,
      `${field}.fallHeadingDegrees`,
    )
    if (fallHeadingDegrees < -50 || fallHeadingDegrees > 50) {
      throw new GameProtocolError(`${field}.fallHeadingDegrees is outside the native lane`)
    }
    return {
      ...common,
      bodyScale,
      buildId: 1007,
      cameraDisplacement,
      damage: positiveFinite(source.damage, `${field}.damage`),
      debris,
      fallHeadingDegrees,
      fallHeight,
      fallStep,
      impactAgeTicks,
      impactDue: boolean(source.impactDue, `${field}.impactDue`),
      impactRadiusScalar,
      impactRotationDegrees,
      impactSoundPitch,
      impactThrowFirePitch,
      impactTicksRemaining,
      kind: 'weld-meteor',
      lightRegistration: nativeLightProviderRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'actor',
      ),
      phase: source.phase,
      position: vector(source.position, `${field}.position`),
      privateSeed,
      pulseDue: boolean(source.pulseDue, `${field}.pulseDue`),
      pulseSequence: nonnegativeInteger(source.pulseSequence, `${field}.pulseSequence`),
      pulseTicksRemaining,
      underpowered,
    } satisfies NativeWeldMeteorActorState
  }

  if (source.kind !== 'weld-persistent') {
    throw new GameProtocolError(`${field}.kind is not a welded actor`)
  }
  if (buildId !== 1006 && buildId !== 1007 && buildId !== 1008) {
    throw new GameProtocolError(`${field}.buildId is not a welded persistent build`)
  }
  const pulseSequence = nonnegativeInteger(source.pulseSequence, `${field}.pulseSequence`)
  if (buildId === 1007) {
    onlyKeys(source, field, [...commonKeys, 'phase', 'pulseSequence'])
    if (source.phase !== 'held') {
      throw new GameProtocolError(`${field}.phase is not the Meteor Swarm channel phase`)
    }
    return {
      ...common,
      buildId: 1007,
      kind: 'weld-persistent',
      lightRegistration: absentNativeActorLight(source, field),
      phase: 'held',
      pulseSequence,
    } satisfies NativeWeldMeteorFieldState
  }
  if (buildId === 1006) {
    return primarySpellWeldEtherealBoulder(source, field, commonKeys, common, pulseSequence)
  }
  return primarySpellWeldHailstones(source, field, commonKeys, common, pulseSequence)
}

function primarySpellWeldEtherealBoulder(
  source: Record<string, unknown>,
  field: string,
  commonKeys: readonly string[],
  common: Readonly<{
    ageTicks: number
    birthTick: number
    buildId: NativeWeldBuildId
    direction: Vector2
    id: number
    origin: Vector2
    ownerId: string
    vector: readonly number[]
    worldKey: string
  }>,
  pulseSequence: number,
): NativeWeldEtherealBoulderState {
  onlyKeys(source, field, [
    ...commonKeys, 'assemblyScale', 'damage', 'flightTicks', 'hitTargetIds',
    'lifetimeTicksRemaining', 'maximumScale', 'orientation', 'phase',
    'pulseSequence', 'quantity', 'remainingDamage', 'scale', 'speedFactor',
    'shellScale', 'toughness', 'velocity',
  ])
  if (source.phase !== 'held' && source.phase !== 'flight') {
    throw new GameProtocolError(`${field}.phase is not an Ethereal Boulder phase`)
  }
  const maximumScale = positiveFinite(source.maximumScale, `${field}.maximumScale`)
  if (source.phase === 'held'
    && maximumScale !== NATIVE_WELD_ETHEREAL_BOULDER_HELD_SCALE_CEILING) {
    throw new GameProtocolError(`${field}.maximumScale is not the native cap`)
  }
  const scale = positiveFinite(source.scale, `${field}.scale`)
  if (scale > maximumScale) {
    throw new GameProtocolError(`${field}.scale is outside the native growth lane`)
  }
  const quantity = nonnegativeInteger(source.quantity, `${field}.quantity`)
  if ((source.phase === 'held' && (quantity < 1 || quantity > 4))
    || (source.phase === 'flight' && quantity !== 0)) {
    throw new GameProtocolError(`${field}.quantity does not match the boulder phase`)
  }
  const assemblyScale = positiveFinite(source.assemblyScale, `${field}.assemblyScale`)
  const shellScale = positiveFinite(source.shellScale, `${field}.shellScale`)
  if (assemblyScale < NATIVE_WELD_PERSISTENT_INITIAL_SCALE
    || assemblyScale > maximumScale
    || (source.phase === 'held' && (
      assemblyScale > scale
      || Math.floor(30 * assemblyScale) !== Math.floor(30 * scale)
      || shellScale !== assemblyScale
    ))) {
    throw new GameProtocolError(`${field}.assemblyScale is outside its native rebuild bucket`)
  }
  if (shellScale > maximumScale) {
    throw new GameProtocolError(`${field}.shellScale exceeds the released scale ceiling`)
  }
  const flightTicks = nonnegativeInteger(source.flightTicks, `${field}.flightTicks`)
  if ((source.phase === 'held' && flightTicks !== 0)
    || (source.phase === 'flight' && flightTicks > common.ageTicks)) {
    throw new GameProtocolError(`${field}.flightTicks does not match the boulder phase`)
  }
  if (!Array.isArray(source.orientation) || source.orientation.length !== 9) {
    throw new GameProtocolError(`${field}.orientation must contain nine float32 values`)
  }
  const orientation = source.orientation.map((value, index) => {
    const component = finite(value, `${field}.orientation[${index}]`)
    if (component !== Math.fround(component)) {
      throw new GameProtocolError(`${field}.orientation[${index}] must be float32`)
    }
    return component
  }) as unknown as NativeWeldEtherealBoulderState['orientation']
  return {
    ...common,
    assemblyScale,
    buildId: 1006,
    damage: nonnegativeFinite(source.damage, `${field}.damage`),
    flightTicks,
    hitTargetIds: uniqueWeldTargetIds(source.hitTargetIds, `${field}.hitTargetIds`),
    kind: 'weld-persistent',
    lightRegistration: nativeLightProviderRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    lifetimeTicksRemaining: positiveInteger(
      source.lifetimeTicksRemaining,
      `${field}.lifetimeTicksRemaining`,
    ),
    maximumScale,
    orientation,
    phase: source.phase,
    pulseSequence,
    quantity,
    remainingDamage: positiveFinite(source.remainingDamage, `${field}.remainingDamage`),
    scale,
    shellScale,
    speedFactor: positiveFinite(source.speedFactor, `${field}.speedFactor`),
    toughness: nonnegativeFinite(source.toughness, `${field}.toughness`),
    velocity: vector(source.velocity, `${field}.velocity`),
  }
}

function nativeWeldMeteorDebris(
  value: unknown,
  field: string,
  expectedIndex: number,
  minimumScale = Math.fround(0.45),
  maximumScale = Math.fround(0.75),
): NativeWeldMeteorDebrisSeed {
  const source = record(value, field)
  onlyKeys(source, field, [
    'alpha', 'colorGreen', 'height', 'index', 'position', 'record',
    'rotationDegrees', 'rotationStepDegrees', 'scale', 'velocity',
    'verticalVelocity',
  ])
  if (source.alpha !== 2 || source.index !== expectedIndex) {
    throw new GameProtocolError(`${field} does not match its native debris slot`)
  }
  const colorGreen = unitInterval(source.colorGreen, `${field}.colorGreen`)
  if (colorGreen > 0.5) {
    throw new GameProtocolError(`${field}.colorGreen exceeds the native range`)
  }
  const nativeRecord = positiveInteger(source.record, `${field}.record`)
  if (nativeRecord !== 2008 && nativeRecord !== 2009 && nativeRecord !== 2010) {
    throw new GameProtocolError(`${field}.record is not native Meteor debris`)
  }
  const scale = positiveFinite(source.scale, `${field}.scale`)
  if (scale < minimumScale || scale > maximumScale) {
    throw new GameProtocolError(`${field}.scale is outside the native range`)
  }
  return {
    alpha: 2,
    colorGreen,
    height: finite(source.height, `${field}.height`),
    index: expectedIndex,
    position: vector(source.position, `${field}.position`),
    record: nativeRecord,
    rotationDegrees: finite(source.rotationDegrees, `${field}.rotationDegrees`),
    rotationStepDegrees: positiveFinite(
      source.rotationStepDegrees,
      `${field}.rotationStepDegrees`,
    ),
    scale,
    velocity: vector(source.velocity, `${field}.velocity`),
    verticalVelocity: finite(source.verticalVelocity, `${field}.verticalVelocity`),
  }
}

function nativeWeldBoulderDebris(
  value: unknown,
  field: string,
): NativeWeldBoulderDebrisParticleState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'alpha', 'bounceVelocity', 'colorGreen', 'enhancedShadow', 'height', 'index',
    'position', 'record', 'rotationDegrees', 'rotationStepDegrees', 'scale',
    'velocity', 'verticalVelocity',
  ])
  const alpha = positiveFinite(source.alpha, `${field}.alpha`)
  const enhancedShadow = boolean(source.enhancedShadow, `${field}.enhancedShadow`)
  if (alpha > (enhancedShadow ? 10 : 2)) {
    throw new GameProtocolError(`${field}.alpha exceeds native debris life`)
  }
  const nativeRecord = positiveInteger(source.record, `${field}.record`)
  if (nativeRecord !== 2008 && nativeRecord !== 2009 && nativeRecord !== 2010) {
    throw new GameProtocolError(`${field}.record is not native BoulderBit art`)
  }
  const scale = positiveFinite(source.scale, `${field}.scale`)
  if (scale > 0.75) throw new GameProtocolError(`${field}.scale exceeds native debris size`)
  return {
    alpha,
    bounceVelocity: finite(source.bounceVelocity, `${field}.bounceVelocity`),
    colorGreen: unitInterval(source.colorGreen, `${field}.colorGreen`),
    enhancedShadow,
    height: finite(source.height, `${field}.height`),
    index: nonnegativeInteger(source.index, `${field}.index`),
    position: vector(source.position, `${field}.position`),
    record: nativeRecord,
    rotationDegrees: finite(source.rotationDegrees, `${field}.rotationDegrees`),
    rotationStepDegrees: nonnegativeFinite(
      source.rotationStepDegrees,
      `${field}.rotationStepDegrees`,
    ),
    scale,
    velocity: vector(source.velocity, `${field}.velocity`),
    verticalVelocity: finite(source.verticalVelocity, `${field}.verticalVelocity`),
  }
}

function primarySpellWeldHailstones(
  source: Record<string, unknown>,
  field: string,
  commonKeys: readonly string[],
  common: Readonly<{
    ageTicks: number
    birthTick: number
    buildId: NativeWeldBuildId
    direction: Vector2
    id: number
    origin: Vector2
    ownerId: string
    vector: readonly number[]
    worldKey: string
  }>,
  pulseSequence: number,
): NativeWeldHailstonesState {
  onlyKeys(source, field, [
    ...commonKeys, 'collisionRadius', 'damage', 'maximumScale', 'phase', 'pulseSequence',
    'pushback', 'releaseAgeTicks', 'releaseFadeScale', 'rocks', 'scale',
    'toughness', 'widen',
  ])
  if (source.phase !== 'held' && source.phase !== 'flight') {
    throw new GameProtocolError(`${field}.phase is not a Hailstones phase`)
  }
  const phase = source.phase
  const maximumScale = positiveFinite(source.maximumScale, `${field}.maximumScale`)
  if (maximumScale !== NATIVE_WELD_HAILSTONES_SCALE_CEILING) {
    throw new GameProtocolError(`${field}.maximumScale is not the native cap`)
  }
  const scale = positiveFinite(source.scale, `${field}.scale`)
  if (scale < NATIVE_WELD_PERSISTENT_INITIAL_SCALE || scale > maximumScale) {
    throw new GameProtocolError(`${field}.scale is outside the native growth lane`)
  }
  const releaseFadeScale = source.releaseFadeScale === null
    ? null
    : positiveFinite(source.releaseFadeScale, `${field}.releaseFadeScale`)
  if ((phase === 'held' && releaseFadeScale !== null)
    || (phase === 'flight' && (releaseFadeScale === null
      || releaseFadeScale < 0.75 || releaseFadeScale >= 1.5))) {
    throw new GameProtocolError(`${field}.releaseFadeScale does not match the hail phase`)
  }
  const releaseAgeTicks = source.releaseAgeTicks === null
    ? null
    : nonnegativeInteger(source.releaseAgeTicks, `${field}.releaseAgeTicks`)
  if ((phase === 'held') !== (releaseAgeTicks === null)) {
    throw new GameProtocolError(`${field}.releaseAgeTicks does not match the hail phase`)
  }
  const rocks = limitedArray(source.rocks, `${field}.rocks`, 4096).map((rock, index) => (
    primarySpellWeldHailstone(rock, `${field}.rocks[${index}]`, phase)
  ))
  if (new Set(rocks.map(({ rockId }) => rockId)).size !== rocks.length) {
    throw new GameProtocolError(`${field}.rocks contains a duplicate native identity`)
  }
  const collisionRadius = positiveFinite(source.collisionRadius, `${field}.collisionRadius`)
  if (collisionRadius < 40 || (phase === 'held' && collisionRadius !== 40)) {
    throw new GameProtocolError(`${field}.collisionRadius does not match the Hail phase`)
  }
  return {
    ...common,
    buildId: 1008,
    collisionRadius,
    damage: positiveFinite(source.damage, `${field}.damage`),
    kind: 'weld-persistent',
    lightRegistration: nativeLightProviderRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    maximumScale,
    phase,
    pulseSequence,
    pushback: nonnegativeFinite(source.pushback, `${field}.pushback`),
    releaseAgeTicks,
    releaseFadeScale,
    rocks,
    scale,
    toughness: nonnegativeFinite(source.toughness, `${field}.toughness`),
    widen: nonnegativeFinite(source.widen, `${field}.widen`),
  }
}

function primarySpellWeldHailstone(
  value: unknown,
  field: string,
  actorPhase: 'flight' | 'held',
): NativeWeldHailstoneRockState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'damageRemaining', 'decay', 'localPosition', 'phase', 'releaseOffset',
    'rockId', 'spriteRecord', 'visualScale',
  ])
  const decay = positiveFinite(source.decay, `${field}.decay`)
  const phase = unitInterval(source.phase, `${field}.phase`)
  if (decay > 1) throw new GameProtocolError(`${field}.decay exceeds one`)
  const local = record(source.localPosition, `${field}.localPosition`)
  onlyKeys(local, `${field}.localPosition`, ['x', 'y', 'z'])
  const releaseOffset = source.releaseOffset === null
    ? null
    : vector(source.releaseOffset, `${field}.releaseOffset`)
  if ((actorPhase === 'held') !== (releaseOffset === null)) {
    throw new GameProtocolError(`${field}.releaseOffset does not match the hail phase`)
  }
  const spriteRecord = positiveInteger(source.spriteRecord, `${field}.spriteRecord`)
  if (spriteRecord !== 168 && spriteRecord !== 169 && spriteRecord !== 170) {
    throw new GameProtocolError(`${field}.spriteRecord is not a native hail rock`)
  }
  const visualScale = positiveFinite(source.visualScale, `${field}.visualScale`)
  if (visualScale >= 0.25) {
    throw new GameProtocolError(`${field}.visualScale exceeds the native draw range`)
  }
  return {
    damageRemaining: nonnegativeFinite(source.damageRemaining, `${field}.damageRemaining`),
    decay,
    localPosition: {
      x: finite(local.x, `${field}.localPosition.x`),
      y: finite(local.y, `${field}.localPosition.y`),
      z: finite(local.z, `${field}.localPosition.z`),
    },
    phase,
    rockId: nonnegativeInteger(source.rockId, `${field}.rockId`),
    releaseOffset,
    spriteRecord,
    visualScale,
  }
}

function primarySpellFireSpentEmber(
  value: unknown,
  field: string,
): NativeFireSpentEmber {
  const source = record(value, field)
  if (source.kind === 'none') {
    onlyKeys(source, field, ['kind'])
    return { kind: 'none' }
  }
  if (source.kind === 'immolate') {
    onlyKeys(source, field, ['damage', 'kind'])
    return {
      damage: positiveFinite(source.damage, `${field}.damage`),
      kind: 'immolate',
    }
  }
  if (source.kind === 'imp') {
    onlyKeys(source, field, ['damage', 'kind', 'lifetimeTicks'])
    return {
      damage: positiveFinite(source.damage, `${field}.damage`),
      kind: 'imp',
      lifetimeTicks: positiveInteger(source.lifetimeTicks, `${field}.lifetimeTicks`),
    }
  }
  throw new GameProtocolError(`${field}.kind is not a spent-Ember effect`)
}

function primarySpellTransient(value: unknown, field: string): PrimarySpellTransientState {
  const source = record(value, field)
  if (source.kind === 'earth-boulder-bit') {
    onlyKeys(source, field, [
      'ageTicks', 'birthTick', 'debris', 'id', 'kind', 'lightRegistration',
      'origin', 'ownerId', 'position', 'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= NATIVE_BOULDER_DEBRIS_MAX_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the BoulderBit lifetime`)
    }
    return {
      ageTicks,
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      debris: nativeWeldBoulderDebris(source.debris, `${field}.debris`),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'earth-boulder-bit',
      lightRegistration: absentNativeActorLight(source, field),
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      position: vector(source.position, `${field}.position`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    } satisfies PrimarySpellEarthBoulderBitState
  }
  if (source.kind === 'weld-boulder-debris'
    || source.kind === 'weld-blizzard-chain-frost'
    || source.kind === 'weld-blizzard-glow'
    || source.kind === 'weld-channel'
    || source.kind === 'weld-frost-fade'
    || source.kind === 'weld-flame-lash-fade'
    || source.kind === 'weld-ground-spark-fade'
    || source.kind === 'weld-hail-flash'
    || source.kind === 'weld-hail-knockback'
    || source.kind === 'weld-hail-line'
    || source.kind === 'weld-hail-rock-fade'
    || source.kind === 'weld-hail-terrain-bouncer'
    || source.kind === 'weld-hail-terrain-particle'
    || source.kind === 'weld-impact'
    || source.kind === 'weld-meteor'
    || source.kind === 'weld-meteor-flash'
    || source.kind === 'weld-meteor-marker'
    || source.kind === 'weld-persistent'
    || source.kind === 'weld-steam') {
    return primarySpellWeldActor(source, field)
  }
  if (isNativePlayerStaffTransient(source as { kind: string })) {
    return nativePlayerStaffTransient(source, field)
  }
  if (source.kind === 'air-hurricane') {
    onlyKeys(source, field, [
      'ageTicks', 'birthTick', 'charge', 'contactCharge', 'damageMaximum',
      'damageMinimum', 'enhancedEffects', 'id', 'kind', 'lanes', 'ownerId',
      'phaseDegrees', 'position', 'worldKey',
    ])
    const charge = finite(source.charge, `${field}.charge`)
    if (charge <= 0 || charge > 1) {
      throw new GameProtocolError(`${field}.charge must be within (0,1]`)
    }
    const contactCharge = finite(source.contactCharge, `${field}.contactCharge`)
    if (contactCharge < 0 || contactCharge > charge) {
      throw new GameProtocolError(`${field}.contactCharge must be within [0,charge]`)
    }
    const damageMinimum = finite(source.damageMinimum, `${field}.damageMinimum`)
    const damageMaximum = finite(source.damageMaximum, `${field}.damageMaximum`)
    if (damageMinimum < 0 || damageMaximum < damageMinimum) {
      throw new GameProtocolError(`${field} has an invalid Hurricane damage range`)
    }
    const lanes = array(source.lanes, `${field}.lanes`)
    if (lanes.length !== 8) {
      throw new GameProtocolError(`${field}.lanes must contain eight native lanes`)
    }
    return {
      ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      charge,
      contactCharge,
      damageMaximum,
      damageMinimum,
      enhancedEffects: boolean(source.enhancedEffects, `${field}.enhancedEffects`),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'air-hurricane',
      lanes: lanes.map((value, index) => {
        const laneField = `${field}.lanes[${index}]`
        const lane = record(value, laneField)
        onlyKeys(lane, laneField, [
          'angleDegrees', 'angularVelocityDegrees', 'radius', 'verticalOffset',
        ])
        const radius = positiveFinite(lane.radius, `${laneField}.radius`)
        return {
          angleDegrees: finite(lane.angleDegrees, `${laneField}.angleDegrees`),
          angularVelocityDegrees: positiveFinite(
            lane.angularVelocityDegrees,
            `${laneField}.angularVelocityDegrees`,
          ),
          radius,
          verticalOffset: finite(lane.verticalOffset, `${laneField}.verticalOffset`),
        }
      }),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      phaseDegrees: finite(source.phaseDegrees, `${field}.phaseDegrees`),
      position: vector(source.position, `${field}.position`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'water-aura') {
    onlyKeys(source, field, [
      'ageTicks', 'alphaDecay', 'birthTick', 'durationTicks', 'id',
      'initialRotationDegrees', 'kind', 'origin', 'ownerId',
      'rotationStepDegrees', 'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    const alphaDecay = positiveFinite(source.alphaDecay, `${field}.alphaDecay`)
    const durationTicks = positiveInteger(source.durationTicks, `${field}.durationTicks`)
    if (ageTicks >= durationTicks) {
      throw new GameProtocolError(`${field}.ageTicks exceeds its native lifetime`)
    }
    return {
      ageTicks,
      alphaDecay,
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      durationTicks,
      id: positiveInteger(source.id, `${field}.id`),
      initialRotationDegrees: finite(
        source.initialRotationDegrees,
        `${field}.initialRotationDegrees`,
      ),
      kind: 'water-aura',
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      rotationStepDegrees: finite(
        source.rotationStepDegrees,
        `${field}.rotationStepDegrees`,
      ),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'water-hail') {
    onlyKeys(source, field, [
      'ageTicks', 'birthTick', 'bounceProgress', 'bounceSoundIndex',
      'bounceSoundPitch', 'bounceSoundSequence', 'height', 'horizontalVelocity',
      'id', 'kind', 'life', 'ownerId', 'position', 'rotationDegrees',
      'rotationStepDegrees', 'savedBounceVelocity', 'scale', 'verticalVelocity',
      'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= 134) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the native Hail lifecycle`)
    }
    const bounceProgress = finite(source.bounceProgress, `${field}.bounceProgress`)
    if (bounceProgress < 0 || bounceProgress > 1) {
      throw new GameProtocolError(`${field}.bounceProgress must be within [0,1]`)
    }
    const bounceSoundSequence = nonnegativeInteger(
      source.bounceSoundSequence,
      `${field}.bounceSoundSequence`,
    )
    const bounceSoundIndex = source.bounceSoundIndex === null
      ? null
      : nonnegativeInteger(source.bounceSoundIndex, `${field}.bounceSoundIndex`)
    if (bounceSoundIndex !== null && bounceSoundIndex > 3) {
      throw new GameProtocolError(`${field}.bounceSoundIndex must be within [0,3]`)
    }
    const bounceSoundPitch = source.bounceSoundPitch === null
      ? null
      : finite(source.bounceSoundPitch, `${field}.bounceSoundPitch`)
    if (bounceSoundPitch !== null && (bounceSoundPitch < 1 || bounceSoundPitch > 1.2)) {
      throw new GameProtocolError(`${field}.bounceSoundPitch must be within [1,1.2]`)
    }
    if ((bounceSoundSequence === 0) !== (bounceSoundIndex === null)) {
      throw new GameProtocolError(`${field}.bounce sound payload is inconsistent`)
    }
    if ((bounceSoundIndex === null) !== (bounceSoundPitch === null)) {
      throw new GameProtocolError(`${field}.bounce sound fields must both be null or present`)
    }
    const height = finite(source.height, `${field}.height`)
    if (height < -20 || height > 0) {
      throw new GameProtocolError(`${field}.height is outside the native Bouncer range`)
    }
    const life = finite(source.life, `${field}.life`)
    if (life <= 0 || life > NATIVE_HAIL_INITIAL_LIFE) {
      throw new GameProtocolError(`${field}.life is outside the native Hail lifecycle`)
    }
    const rotationDegrees = finite(source.rotationDegrees, `${field}.rotationDegrees`)
    const rotationStepDegrees = finite(
      source.rotationStepDegrees,
      `${field}.rotationStepDegrees`,
    )
    if (rotationStepDegrees < 0 || rotationStepDegrees > 11) {
      throw new GameProtocolError(`${field}.rotationStepDegrees is outside [0,11]`)
    }
    const savedBounceVelocity = finite(
      source.savedBounceVelocity,
      `${field}.savedBounceVelocity`,
    )
    if (savedBounceVelocity < -5 || savedBounceVelocity > 0) {
      throw new GameProtocolError(`${field}.savedBounceVelocity is outside [-5,0]`)
    }
    const scale = finite(source.scale, `${field}.scale`)
    if (scale < 1 || scale > 2) {
      throw new GameProtocolError(`${field}.scale is outside [1,2]`)
    }
    const verticalVelocity = finite(source.verticalVelocity, `${field}.verticalVelocity`)
    if (verticalVelocity < -5 || verticalVelocity > 20) {
      throw new GameProtocolError(`${field}.verticalVelocity is outside the Bouncer range`)
    }
    return {
      ageTicks,
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      bounceProgress,
      bounceSoundIndex,
      bounceSoundPitch,
      bounceSoundSequence,
      height,
      horizontalVelocity: vector(source.horizontalVelocity, `${field}.horizontalVelocity`),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'water-hail',
      life,
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      position: vector(source.position, `${field}.position`),
      rotationDegrees,
      rotationStepDegrees,
      savedBounceVelocity,
      scale,
      verticalVelocity,
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'earth-called-rock') {
    onlyKeys(source, field, [
      'ageTicks', 'fallVelocity', 'falling', 'height', 'id', 'kind',
      'lateralMagnitude', 'lightRegistration', 'ownerId', 'parentId', 'position', 'rotation',
      'rotationStep', 'scale', 'speed', 'targetHeight', 'variant', 'worldKey',
    ])
    const fallVelocity = finite(source.fallVelocity, `${field}.fallVelocity`)
    if (fallVelocity < 0) throw new GameProtocolError(`${field}.fallVelocity is negative`)
    const lateralMagnitude = finite(source.lateralMagnitude, `${field}.lateralMagnitude`)
    if (lateralMagnitude < 0 || lateralMagnitude > 4) {
      throw new GameProtocolError(`${field}.lateralMagnitude is outside [0,4]`)
    }
    const rotationStep = finite(source.rotationStep, `${field}.rotationStep`)
    if (rotationStep < -30 || rotationStep > 30) {
      throw new GameProtocolError(`${field}.rotationStep is outside [-30,30]`)
    }
    const scale = finite(source.scale, `${field}.scale`)
    if (scale < 0 || scale > 0.75 * 0.75) {
      throw new GameProtocolError(`${field}.scale exceeds the native called-rock range`)
    }
    const speed = finite(source.speed, `${field}.speed`)
    if (speed < 0 || speed > 5) {
      throw new GameProtocolError(`${field}.speed is outside [0,5]`)
    }
    const variant = nonnegativeInteger(source.variant, `${field}.variant`)
    if (variant > 2) throw new GameProtocolError(`${field}.variant exceeds the lit-rock bank`)
    const falling = boolean(source.falling, `${field}.falling`)
    if (!falling && fallVelocity !== 0) {
      throw new GameProtocolError(`${field}.fallVelocity must be zero before release`)
    }
    const id = positiveInteger(source.id, `${field}.id`)
    const parentId = positiveInteger(source.parentId, `${field}.parentId`)
    if (parentId >= id) {
      throw new GameProtocolError(`${field}.parentId must precede the called-rock identity`)
    }
    return {
      ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
      fallVelocity,
      falling,
      height: finite(source.height, `${field}.height`),
      id,
      kind: 'earth-called-rock',
      lateralMagnitude,
      lightRegistration: absentNativeActorLight(source, field),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      parentId,
      position: vector(source.position, `${field}.position`),
      rotation: finite(source.rotation, `${field}.rotation`),
      rotationStep,
      scale,
      speed,
      targetHeight: finite(source.targetHeight, `${field}.targetHeight`),
      variant,
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'earth-impact') {
    onlyKeys(source, field, [
      'ageTicks', 'birthTick', 'charge', 'id', 'kind', 'origin', 'ownerId',
      'lightRegistration', 'lifetimeTicks', 'worldKey',
    ])
    const charge = finite(source.charge, `${field}.charge`)
    if (charge < 0 || charge > 1) {
      throw new GameProtocolError(`${field}.charge must be within [0,1]`)
    }
    const birthTick = nonnegativeInteger(source.birthTick, `${field}.birthTick`)
    const id = positiveInteger(source.id, `${field}.id`)
    const lifetimeTicks = positiveInteger(source.lifetimeTicks, `${field}.lifetimeTicks`)
    const expectedLifetime = earthImpactLifetimeTicks({ birthTick, charge, id })
    if (lifetimeTicks !== expectedLifetime) {
      throw new GameProtocolError(`${field}.lifetimeTicks does not match the native recurrence`)
    }
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= lifetimeTicks) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the impact lifetime`)
    }
    return {
      ageTicks,
      birthTick,
      charge,
      id,
      kind: 'earth-impact',
      lightRegistration: absentNativeActorLight(source, field),
      lifetimeTicks,
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'ether-impact') {
    onlyKeys(source, field, [
      'ageTicks', 'birthTick', 'id', 'kind', 'lightRegistration', 'origin',
      'ownerId', 'visualScale',
      'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Ether impact lifetime`)
    }
    const visualScale = positiveFinite(source.visualScale, `${field}.visualScale`)
    if (visualScale > 1) {
      throw new GameProtocolError(`${field}.visualScale exceeds one`)
    }
    return {
      ageTicks,
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'ether-impact',
      lightRegistration: nativeLightProviderRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'transient',
      ),
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      visualScale,
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'ether-blast') {
    onlyKeys(source, field, [
      'ageTicks', 'birthTick', 'charges', 'id', 'kind', 'origin', 'ownerId',
      'presentationRng', 'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= NATIVE_ETHER_BLAST_PARTICLE_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Ether Blast lifetime`)
    }
    return {
      ageTicks,
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      charges: boundedInteger(source.charges, `${field}.charges`, 1, 6),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'ether-blast',
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      presentationRng: nativeRngState(
        source.presentationRng,
        `${field}.presentationRng`,
      ),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'fire-ember') {
    onlyKeys(source, field, [
      'ageTicks', 'burnDamage', 'contactCadence', 'contactDue', 'damage', 'height',
      'horizontalVelocity', 'id', 'kind', 'life', 'lightRegistration', 'ownerId',
      'phase', 'position',
      'spentEmber', 'verticalVelocity', 'worldKey',
    ])
    const phase = finite(source.phase, `${field}.phase`)
    if (phase < 0 || phase >= 4) {
      throw new GameProtocolError(`${field}.phase is outside [0,4)`)
    }
    const contactCadence = nonnegativeInteger(
      source.contactCadence,
      `${field}.contactCadence`,
    )
    if (contactCadence > 3) {
      throw new GameProtocolError(`${field}.contactCadence exceeds the native range`)
    }
    const life = positiveFinite(source.life, `${field}.life`)
    if (life > 3) {
      throw new GameProtocolError(`${field}.life is outside the live Ember interval`)
    }
    const height = finite(source.height, `${field}.height`)
    if (height > 0) throw new GameProtocolError(`${field}.height must not exceed the ground`)
    return {
      ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
      burnDamage: nonnegativeFinite(source.burnDamage, `${field}.burnDamage`),
      contactCadence,
      contactDue: boolean(source.contactDue, `${field}.contactDue`),
      damage: nonnegativeFinite(source.damage, `${field}.damage`),
      height,
      horizontalVelocity: vector(source.horizontalVelocity, `${field}.horizontalVelocity`),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'fire-ember',
      life,
      lightRegistration: nativeLightProviderRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'actor',
      ),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      phase,
      position: vector(source.position, `${field}.position`),
      spentEmber: primarySpellFireSpentEmber(source.spentEmber, `${field}.spentEmber`),
      verticalVelocity: finite(source.verticalVelocity, `${field}.verticalVelocity`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'fire-explosion') {
    onlyKeys(source, field, [
      'ageTicks', 'burnDamage', 'damage', 'footprintDimension', 'id', 'kind',
      'lightRegistration', 'origin', 'ownerId', 'soundPitch', 'visualScale', 'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= NATIVE_FIRE_EXPLOSION_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Fire explosion lifetime`)
    }
    const soundPitch = positiveFinite(source.soundPitch, `${field}.soundPitch`)
    if (soundPitch < 0.9 || soundPitch > 1.1) {
      throw new GameProtocolError(`${field}.soundPitch is outside the native range`)
    }
    return {
      ageTicks,
      burnDamage: nonnegativeFinite(source.burnDamage, `${field}.burnDamage`),
      damage: positiveFinite(source.damage, `${field}.damage`),
      footprintDimension: positiveFinite(
        source.footprintDimension,
        `${field}.footprintDimension`,
      ),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'fire-explosion',
      lightRegistration: nativeLightProviderRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'transient',
      ),
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      soundPitch,
      visualScale: positiveFinite(source.visualScale, `${field}.visualScale`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'fire-good-imp') {
    onlyKeys(source, field, [
      'ageTicks', 'bodyRotationDeg', 'bodyScale', 'bodyVariant',
      'bounceSoundIndex', 'bounceSoundPitch', 'bounceSoundSequence', 'burnDamage',
      'collisionRadius', 'contactAgeTicks', 'contactOrigin', 'contactScale',
      'contactSoundIndex', 'contactSoundPitch', 'contactSoundSequence', 'damage',
      'effectAlpha', 'effectPhase', 'flightSpeed', 'headingDegrees',
      'id', 'kind', 'lightGlow', 'lightRegistration', 'nextTargetRefreshTick',
      'ownerId', 'path', 'position', 'remainingTicks', 'targetId',
      'verticalOffset', 'verticalVelocity', 'worldKey',
    ])
    const bodyVariant = nonnegativeInteger(source.bodyVariant, `${field}.bodyVariant`)
    if (bodyVariant >= 4) {
      throw new GameProtocolError(`${field}.bodyVariant is outside the native pose banks`)
    }
    const bounceSoundIndex = nonnegativeInteger(
      source.bounceSoundIndex,
      `${field}.bounceSoundIndex`,
    )
    if (bounceSoundIndex >= 8) {
      throw new GameProtocolError(`${field}.bounceSoundIndex exceeds the Imp sound bank`)
    }
    const bounceSoundPitch = positiveFinite(
      source.bounceSoundPitch,
      `${field}.bounceSoundPitch`,
    )
    if (bounceSoundPitch < 1 || bounceSoundPitch > Math.fround(1.1)) {
      throw new GameProtocolError(`${field}.bounceSoundPitch is outside the native range`)
    }
    const contactSoundIndex = nonnegativeInteger(
      source.contactSoundIndex,
      `${field}.contactSoundIndex`,
    )
    if (contactSoundIndex >= 3) {
      throw new GameProtocolError(`${field}.contactSoundIndex exceeds the Bite sound bank`)
    }
    const contactSoundPitch = positiveFinite(
      source.contactSoundPitch,
      `${field}.contactSoundPitch`,
    )
    if (contactSoundPitch < 1 || contactSoundPitch > 1.25) {
      throw new GameProtocolError(`${field}.contactSoundPitch is outside the native range`)
    }
    const effectAlpha = nonnegativeFinite(source.effectAlpha, `${field}.effectAlpha`)
    if (effectAlpha > 1) {
      throw new GameProtocolError(`${field}.effectAlpha exceeds one`)
    }
    const effectPhase = nonnegativeFinite(source.effectPhase, `${field}.effectPhase`)
    if (effectPhase >= 10) {
      throw new GameProtocolError(`${field}.effectPhase exceeds the native frame bank`)
    }
    const lightGlow = nonnegativeFinite(source.lightGlow, `${field}.lightGlow`)
    if (lightGlow > 1) {
      throw new GameProtocolError(`${field}.lightGlow exceeds one`)
    }
    const contactAgeTicks = source.contactAgeTicks === null
      ? null
      : nonnegativeInteger(source.contactAgeTicks, `${field}.contactAgeTicks`)
    if (contactAgeTicks !== null && contactAgeTicks >= NATIVE_GOOD_IMP_CONTACT_VISIBLE_TICKS) {
      throw new GameProtocolError(`${field}.contactAgeTicks exceeds the native contact lifetime`)
    }
    const contactOrigin = source.contactOrigin === null
      ? null
      : vector(source.contactOrigin, `${field}.contactOrigin`)
    if ((contactAgeTicks === null) !== (contactOrigin === null)) {
      throw new GameProtocolError(`${field} contact age and origin must be present together`)
    }
    return {
      ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
      bodyRotationDeg: finite(source.bodyRotationDeg, `${field}.bodyRotationDeg`),
      bodyScale: positiveFinite(source.bodyScale, `${field}.bodyScale`),
      bodyVariant,
      bounceSoundIndex,
      bounceSoundPitch,
      bounceSoundSequence: nonnegativeInteger(
        source.bounceSoundSequence,
        `${field}.bounceSoundSequence`,
      ),
      burnDamage: nonnegativeFinite(source.burnDamage, `${field}.burnDamage`),
      collisionRadius: nonnegativeFinite(source.collisionRadius, `${field}.collisionRadius`),
      contactAgeTicks,
      contactOrigin,
      contactScale: positiveFinite(source.contactScale, `${field}.contactScale`),
      contactSoundIndex,
      contactSoundPitch,
      contactSoundSequence: nonnegativeInteger(
        source.contactSoundSequence,
        `${field}.contactSoundSequence`,
      ),
      damage: positiveFinite(source.damage, `${field}.damage`),
      effectAlpha,
      effectPhase,
      flightSpeed: positiveFinite(source.flightSpeed, `${field}.flightSpeed`),
      headingDegrees: finite(source.headingDegrees, `${field}.headingDegrees`),
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'fire-good-imp',
      lightGlow,
      lightRegistration: nativeLightProviderRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'actor',
      ),
      nextTargetRefreshTick: nonnegativeInteger(
        source.nextTargetRefreshTick,
        `${field}.nextTargetRefreshTick`,
      ),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      path: nativeEnemyPathState(source.path, `${field}.path`),
      position: vector(source.position, `${field}.position`),
      remainingTicks: positiveInteger(source.remainingTicks, `${field}.remainingTicks`),
      targetId: source.targetId === null
        ? null
        : limitedString(source.targetId, `${field}.targetId`, 256),
      verticalOffset: finite(source.verticalOffset, `${field}.verticalOffset`),
      verticalVelocity: finite(source.verticalVelocity, `${field}.verticalVelocity`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'fire-patch') {
    onlyKeys(source, field, [
      'ageTicks', 'atlasPhase', 'atlasPhaseStep', 'burnDamage', 'damage',
      'drawAlpha', 'fadeAlpha', 'id', 'kind', 'life', 'nativeType', 'ownerId',
      'position', 'scale', 'shapeSample',
      'supplementalContact', 'velocity', 'velocityMultiplier', 'worldKey',
    ])
    if (
      source.nativeType !== 'fire'
      && source.nativeType !== 'goodguy'
      && source.nativeType !== 'moving'
    ) {
      throw new GameProtocolError(`${field}.nativeType is not a Fire patch type`)
    }
    const fadeAlpha = finite(source.fadeAlpha, `${field}.fadeAlpha`)
    if (fadeAlpha < 0 || fadeAlpha > 1) {
      throw new GameProtocolError(`${field}.fadeAlpha is outside [0,1]`)
    }
    const atlasPhase = finite(source.atlasPhase, `${field}.atlasPhase`)
    if (atlasPhase < 0 || atlasPhase >= 32) {
      throw new GameProtocolError(`${field}.atlasPhase is outside [0,32)`)
    }
    const shapeSample = finite(source.shapeSample, `${field}.shapeSample`)
    if (shapeSample < 0 || shapeSample > 1) {
      throw new GameProtocolError(`${field}.shapeSample is outside [0,1]`)
    }
    return {
      ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
      atlasPhase,
      atlasPhaseStep: nonnegativeFinite(
        source.atlasPhaseStep,
        `${field}.atlasPhaseStep`,
      ),
      burnDamage: nonnegativeFinite(source.burnDamage, `${field}.burnDamage`),
      damage: nonnegativeFinite(source.damage, `${field}.damage`),
      drawAlpha: nonnegativeFinite(source.drawAlpha, `${field}.drawAlpha`),
      fadeAlpha,
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'fire-patch',
      life: positiveFinite(source.life, `${field}.life`),
      nativeType: source.nativeType,
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      position: vector(source.position, `${field}.position`),
      scale: positiveFinite(source.scale, `${field}.scale`),
      shapeSample,
      supplementalContact: boolean(
        source.supplementalContact,
        `${field}.supplementalContact`,
      ),
      velocity: vector(source.velocity, `${field}.velocity`),
      velocityMultiplier: vector(
        source.velocityMultiplier,
        `${field}.velocityMultiplier`,
      ),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'fire-impact') {
    onlyKeys(source, field, [
      'ageTicks', 'id', 'kind', 'lightRegistration', 'origin', 'ownerId', 'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= NATIVE_FIRE_IMPACT_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Fire impact lifetime`)
    }
    return {
      ageTicks,
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'fire-impact',
      lightRegistration: nativeLightProviderRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'transient',
      ),
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  if (source.kind === 'ether-pierce-streak') {
    onlyKeys(source, field, [
      'ageTicks', 'headingDegrees', 'id', 'kind', 'origin', 'ownerId',
      'visualScale', 'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= 10) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Ether streak lifetime`)
    }
    const headingDegrees = finite(source.headingDegrees, `${field}.headingDegrees`)
    if (headingDegrees < 0 || headingDegrees >= 360) {
      throw new GameProtocolError(`${field}.headingDegrees is outside [0,360)`)
    }
    const visualScale = positiveFinite(source.visualScale, `${field}.visualScale`)
    if (visualScale > 1) {
      throw new GameProtocolError(`${field}.visualScale exceeds one`)
    }
    return {
      ageTicks,
      headingDegrees,
      id: positiveInteger(source.id, `${field}.id`),
      kind: 'ether-pierce-streak',
      origin: vector(source.origin, `${field}.origin`),
      ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
      visualScale,
      worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
    }
  }
  const transientKeys = [
    'ageTicks', 'direction', 'id', 'kind', 'lightRegistration', 'origin', 'ownerId', 'variant',
    'worldKey',
  ]
  onlyKeys(
    source,
    field,
    source.kind === 'water'
      ? [...transientKeys, 'obstructionDistance', 'obstructionPoint', 'speed', 'underpowered']
      : source.kind === 'air'
        ? [
            ...transientKeys,
            'birthTick',
            'endpoint',
            'hurricaneCharge',
            'midpoint',
            'targetId',
            'underpowered',
          ]
      : transientKeys,
  )
  if (source.kind !== 'air' && source.kind !== 'fire' && source.kind !== 'water') {
    throw new GameProtocolError(`${field}.kind is not a transient primary`)
  }
  const id = positiveInteger(source.id, `${field}.id`)
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  const variant = nonnegativeInteger(source.variant, `${field}.variant`)
  if (source.kind !== 'water' && variant > 3) {
    throw new GameProtocolError(`${field}.variant exceeds the native family`)
  }
  if (source.kind === 'fire') {
    if (variant !== nativeFireParticleVariant(id)) {
      throw new GameProtocolError(`${field}.variant does not match its Fire particle id`)
    }
    if (ageTicks >= nativeFireParticleLifetimeTicks(id)) {
      throw new GameProtocolError(`${field}.ageTicks exceeds its Fire particle lifetime`)
    }
  }
  const common = {
    ageTicks,
    direction: unitVector(source.direction, `${field}.direction`),
    id,
    origin: vector(source.origin, `${field}.origin`),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    variant,
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
  if (source.kind === 'water') {
    const underpowered = boolean(source.underpowered, `${field}.underpowered`)
    if (variant >= WATER_FROST_MAX_PARTICLES_PER_TICK) {
      throw new GameProtocolError(`${field}.variant exceeds the Frost emission ordinal`)
    }
    if (underpowered && variant !== 0) {
      throw new GameProtocolError(`${field}.variant exceeds the weak Frost emission ordinal`)
    }
    if (ageTicks < 1 || ageTicks >= waterFrostJetLifetimeTicks(id)) {
      throw new GameProtocolError(`${field}.ageTicks is outside its visible Frost lifetime`)
    }
    const obstructionPoint = source.obstructionPoint === null
      ? null
      : vector(source.obstructionPoint, `${field}.obstructionPoint`)
    const obstructionDistance = source.obstructionDistance === null
      ? null
      : nonnegativeFinite(source.obstructionDistance, `${field}.obstructionDistance`)
    if ((obstructionPoint === null) !== (obstructionDistance === null)) {
      throw new GameProtocolError(
        `${field}.obstructionPoint and obstructionDistance must be present together`,
      )
    }
    if (waterFrostJetKind(id, underpowered) === 'over' && obstructionPoint !== null) {
      throw new GameProtocolError(`${field} Over particles cannot own obstruction state`)
    }
    const speed = positiveFinite(source.speed, `${field}.speed`)
    if (speed < WATER_FROST_MINIMUM_SPEED || speed > WATER_FROST_MAXIMUM_SPEED) {
      throw new GameProtocolError(`${field}.speed is outside the authored Frost range`)
    }
    return {
      ...common,
      kind: 'water',
      lightRegistration: absentNativeActorLight(source, field),
      obstructionDistance,
      obstructionPoint,
      speed,
      underpowered,
    }
  }
  if (source.kind === 'air') {
    const underpowered = boolean(source.underpowered, `${field}.underpowered`)
    const lifetimeTicks = underpowered
      ? PRIMARY_SPELL_AIR_UNDERPOWERED_LIFETIME_TICKS
      : PRIMARY_SPELL_AIR_LIFETIME_TICKS
    if (ageTicks >= lifetimeTicks) {
      throw new GameProtocolError(`${field}.ageTicks exceeds the Air contact lifetime`)
    }
    const hurricaneCharge = finite(source.hurricaneCharge, `${field}.hurricaneCharge`)
    if (hurricaneCharge < 0 || hurricaneCharge > 1) {
      throw new GameProtocolError(`${field}.hurricaneCharge must be within [0,1]`)
    }
    return {
      ...common,
      birthTick: nonnegativeInteger(source.birthTick, `${field}.birthTick`),
      endpoint: vector(source.endpoint, `${field}.endpoint`),
      hurricaneCharge,
      kind: 'air',
      lightRegistration: nativeLightProviderRegistration(
        source.lightRegistration,
        `${field}.lightRegistration`,
        'transient',
      ),
      midpoint: vector(source.midpoint, `${field}.midpoint`),
      targetId: source.targetId === null
        ? null
        : limitedString(source.targetId, `${field}.targetId`, 256),
      underpowered,
    }
  }
  return {
    ...common,
    kind: source.kind,
    lightRegistration: absentNativeActorLight(source, field),
  }
}

function nativePlayerStaffTransient(
  source: Record<string, unknown>,
  field: string,
): NativePlayerStaffTransient {
  const kind = source.kind as NativePlayerStaffTransient['kind']
  const common = {
    ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
    id: positiveInteger(source.id, `${field}.id`),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
  if (kind === 'player-staff-melee' || kind === 'player-staff-spin') {
    const sharedKeys = [
      'ageTicks', 'contactSequence', 'headingDegrees', 'id', 'kind', 'origin',
      'outcome', 'ownerId', 'swooshPitch', 'worldKey',
    ]
    onlyKeys(source, field, kind === 'player-staff-melee'
      ? [...sharedKeys, 'actionTimingFactor', 'baseProgressPerTick', 'lane', 'progress']
      : [...sharedKeys, 'countdown', 'turnSign'])
    const headingDegrees = staffHeading(source.headingDegrees, `${field}.headingDegrees`)
    const outcome = staffOutcome(source.outcome, `${field}.outcome`)
    const contactSequence = nonnegativeInteger(
      source.contactSequence,
      `${field}.contactSequence`,
    )
    if (contactSequence > 1) {
      throw new GameProtocolError(`${field}.contactSequence exceeds the Staff marker`)
    }
    const swooshPitch = staffPitch(source.swooshPitch, `${field}.swooshPitch`)
    const actionCommon = {
      ...common,
      contactSequence,
      headingDegrees,
      origin: vector(source.origin, `${field}.origin`),
      outcome,
      swooshPitch,
    }
    if (kind === 'player-staff-spin') {
      if (outcome !== 'whirl') throw new GameProtocolError(`${field}.outcome must be Whirl`)
      const countdown = positiveFinite(source.countdown, `${field}.countdown`)
      if (countdown > 360 || countdown % 20 !== 0) {
        throw new GameProtocolError(`${field}.countdown is outside the StaffSpin program`)
      }
      const turnSign = finite(source.turnSign, `${field}.turnSign`)
      if (turnSign !== -1 && turnSign !== 1) {
        throw new GameProtocolError(`${field}.turnSign must be -1 or 1`)
      }
      if (
        swooshPitch !== 1
        || contactSequence !== 0
        || common.ageTicks > 17
        || countdown !== 360 - common.ageTicks * 20
      ) throw new GameProtocolError(`${field} does not match the live StaffSpin program`)
      return { ...actionCommon, countdown, kind, turnSign }
    }
    if (outcome === 'whirl') throw new GameProtocolError(`${field}.outcome cannot be Whirl`)
    const lane = source.lane
    if (lane !== 'primary' && lane !== 'secondary') {
      throw new GameProtocolError(`${field}.lane is not a Staff melee bank`)
    }
    const actionTimingFactor = positiveFinite(
      source.actionTimingFactor,
      `${field}.actionTimingFactor`,
    )
    const baseProgressPerTick = positiveFinite(
      source.baseProgressPerTick,
      `${field}.baseProgressPerTick`,
    )
    const progress = nonnegativeFinite(source.progress, `${field}.progress`)
    const expectedSwooshPitch = Math.fround(
      (baseProgressPerTick - NATIVE_STAFF_MELEE_BASE_PROGRESS) + 1,
    )
    if (
      progress > 8
      || baseProgressPerTick < Math.fround(NATIVE_STAFF_MELEE_BASE_PROGRESS)
      || baseProgressPerTick > Math.fround(
        Math.fround(NATIVE_STAFF_MELEE_BASE_PROGRESS + Math.fround(0.05))
          * NATIVE_STAFF_MELEE_ACCELERATION,
      )
      || (actionTimingFactor !== 1 && actionTimingFactor !== 1.75)
      || swooshPitch !== expectedSwooshPitch
    ) {
      throw new GameProtocolError(`${field} is outside the StaffMelee program`)
    }
    return {
      ...actionCommon,
      actionTimingFactor,
      baseProgressPerTick,
      kind,
      lane,
      progress,
    }
  }
  if (kind === 'player-staff-contact') {
    onlyKeys(source, field, [
      'ageTicks', 'id', 'impactSoundPitches', 'kind', 'origin', 'outcome',
      'ownerId', 'pikeBreakSoundIndexes', 'procSound', 'procSoundPitches',
      'swooshPitch', 'targetIds', 'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= NATIVE_STAFF_CONTACT_EVENT_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds contact retention`)
    }
    const outcome = staffOutcome(source.outcome, `${field}.outcome`)
    const procSound = source.procSound === null
      ? null
      : memberString(
          source.procSound,
          `${field}.procSound`,
          ['critical-hit', 'disable-enemy', 'knockback', 'spin-attack'] as const,
        ) as NativeStaffProcSound
    const procSoundPitches = limitedArray(
      source.procSoundPitches,
      `${field}.procSoundPitches`,
      3,
    ).map((pitch, index) => staffPitch(
      pitch,
      `${field}.procSoundPitches[${index}]`,
    ))
    const impactSoundPitches = limitedArray(
      source.impactSoundPitches,
      `${field}.impactSoundPitches`,
      MAX_PRIMARY_SPELL_HIT_TARGETS,
    ).map((pitch, index) => {
      const decoded = staffPitch(pitch, `${field}.impactSoundPitches[${index}]`)
      if (decoded < Math.fround(0.9) || decoded > Math.fround(1.1)) {
        throw new GameProtocolError(`${field}.impactSoundPitches[${index}] is outside StaffHitWood`)
      }
      return decoded
    })
    const pikeBreakSoundIndexes = limitedArray(
      source.pikeBreakSoundIndexes,
      `${field}.pikeBreakSoundIndexes`,
      MAX_PRIMARY_SPELL_HIT_TARGETS,
    ).map((value, index) => {
      const decoded = nonnegativeInteger(value, `${field}.pikeBreakSoundIndexes[${index}]`)
      if (decoded >= impactSoundPitches.length) {
        throw new GameProtocolError(`${field}.pikeBreakSoundIndexes[${index}] has no impact`)
      }
      return decoded
    })
    if (new Set(pikeBreakSoundIndexes).size !== pikeBreakSoundIndexes.length) {
      throw new GameProtocolError(`${field}.pikeBreakSoundIndexes contains a duplicate`)
    }
    const expectedSound: Readonly<Record<typeof outcome, NativeStaffProcSound | null>> = {
      'critical-hit': 'critical-hit',
      'disabling-hit': 'disable-enemy',
      knockback: 'knockback',
      normal: null,
      whirl: 'spin-attack',
    }
    const expectedPitchCount = outcome === 'normal' ? 0 : outcome === 'whirl' ? 3 : 1
    const pitchesMatch = outcome === 'normal'
      ? procSoundPitches.length === 0
      : outcome === 'disabling-hit'
        ? procSoundPitches.length === 1 && procSoundPitches[0] === 1
        : outcome === 'whirl'
          ? procSoundPitches.length === 3
            && procSoundPitches[0] === 1
            && procSoundPitches[1] === Math.fround(0.9)
            && procSoundPitches[2] === Math.fround(1.1)
          : procSoundPitches.length === 1
            && procSoundPitches[0]! >= Math.fround(0.9)
            && procSoundPitches[0]! <= Math.fround(1.1)
    const swooshPitch = staffPitch(source.swooshPitch, `${field}.swooshPitch`)
    if (
      procSound !== expectedSound[outcome]
      || procSoundPitches.length !== expectedPitchCount
      || !pitchesMatch
      || swooshPitch < 1
      || swooshPitch > Math.fround((
        Math.fround(
          Math.fround(NATIVE_STAFF_MELEE_BASE_PROGRESS + Math.fround(0.05))
            * NATIVE_STAFF_MELEE_ACCELERATION,
        ) - NATIVE_STAFF_MELEE_BASE_PROGRESS
      ) + 1)
    ) {
      throw new GameProtocolError(`${field} proc sound does not match its outcome`)
    }
    return {
      ...common,
      ageTicks,
      impactSoundPitches,
      kind,
      origin: vector(source.origin, `${field}.origin`),
      outcome,
      procSound,
      procSoundPitches,
      pikeBreakSoundIndexes,
      swooshPitch,
      targetIds: staffTargetIds(source.targetIds, `${field}.targetIds`),
    }
  }
  if (kind === 'player-staff-contact-knockback') {
    onlyKeys(source, field, [
      'ageTicks', 'delta', 'id', 'kind', 'ownerId', 'remainingTicks',
      'targetId', 'worldKey',
    ])
    const delta = vector(source.delta, `${field}.delta`)
    const magnitude = Math.hypot(delta.x, delta.y)
    if (magnitude !== 0 && Math.abs(magnitude - 6) > 1e-5) {
      throw new GameProtocolError(`${field}.delta is not the native contact Knockback step`)
    }
    const remainingTicks = positiveInteger(source.remainingTicks, `${field}.remainingTicks`)
    if (remainingTicks > 5 || common.ageTicks + remainingTicks !== 5) {
      throw new GameProtocolError(`${field} is outside the five-tick contact Knockback`)
    }
    return {
      ...common,
      delta,
      kind,
      remainingTicks,
      targetId: staffTargetId(source.targetId, `${field}.targetId`),
    }
  }
  if (kind === 'player-staff-pike-break') {
    onlyKeys(source, field, [
      'ageTicks', 'headingDegrees', 'id', 'kind', 'ownerId', 'position',
      'presentationRng', 'targetId', 'worldKey',
    ])
    if (common.ageTicks >= NATIVE_STAFF_PIKE_BREAK_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks outlived native Pike-break debris`)
    }
    return {
      ...common,
      headingDegrees: staffHeading(source.headingDegrees, `${field}.headingDegrees`),
      kind,
      position: vector(source.position, `${field}.position`),
      presentationRng: nativeRngState(source.presentationRng, `${field}.presentationRng`),
      targetId: staffTargetId(source.targetId, `${field}.targetId`),
    }
  }
  if (kind === 'player-staff-knockback') {
    onlyKeys(source, field, [
      'ageTicks', 'arcDegrees', 'id', 'kind', 'origin', 'ownerId',
      'remainingDistance', 'targetIds', 'worldKey',
    ])
    const arcDegrees = finite(source.arcDegrees, `${field}.arcDegrees`)
    if (arcDegrees !== 60 && arcDegrees !== 80 && arcDegrees !== 365) {
      throw new GameProtocolError(`${field}.arcDegrees is not a native Staff arc`)
    }
    const remainingDistance = positiveFinite(
      source.remainingDistance,
      `${field}.remainingDistance`,
    )
    if (remainingDistance > 150 || remainingDistance % 10 !== 0) {
      throw new GameProtocolError(`${field}.remainingDistance is outside Knockback`)
    }
    return {
      ...common,
      arcDegrees,
      kind,
      origin: vector(source.origin, `${field}.origin`),
      remainingDistance,
      targetIds: staffTargetIds(source.targetIds, `${field}.targetIds`),
    }
  }
  if (kind === 'player-staff-smoke') {
    onlyKeys(source, field, [
      'ageTicks', 'alpha', 'alphaLoss', 'angularVelocityDegrees', 'entry', 'id',
      'kind', 'ownerId', 'position', 'rotationDegrees', 'scale', 'worldKey',
    ])
    if (source.entry !== 15 || source.scale !== 8 || source.alphaLoss !== Math.fround(0.05)) {
      throw new GameProtocolError(`${field} does not match native SmokePuff constants`)
    }
    const alpha = positiveFinite(source.alpha, `${field}.alpha`)
    const angularVelocityDegrees = finite(
      source.angularVelocityDegrees,
      `${field}.angularVelocityDegrees`,
    )
    if (
      angularVelocityDegrees < Math.fround(2 / 3)
      || angularVelocityDegrees > Math.fround(4 / 3)
      || alpha !== staffFadeAlpha(1, Math.fround(0.05), common.ageTicks)
    ) throw new GameProtocolError(`${field} does not match native SmokePuff recurrence`)
    return {
      ...common,
      alpha,
      alphaLoss: Math.fround(0.05),
      angularVelocityDegrees,
      entry: 15,
      kind,
      position: vector(source.position, `${field}.position`),
      rotationDegrees: staffHeading(source.rotationDegrees, `${field}.rotationDegrees`),
      scale: 8,
    }
  }
  if (kind === 'player-staff-move-fade') {
    onlyKeys(source, field, [
      'ageTicks', 'alpha', 'alphaLoss', 'entry', 'id', 'kind', 'ownerId',
      'position', 'rotationDegrees', 'scale', 'tint', 'velocity',
      'velocityFactor', 'worldKey',
    ])
    const entry = source.entry
    if (entry !== 40 && entry !== 45) {
      throw new GameProtocolError(`${field}.entry is not a Staff MoveFade record`)
    }
    const tint = nonnegativeInteger(source.tint, `${field}.tint`)
    const alpha = positiveFinite(source.alpha, `${field}.alpha`)
    const alphaLoss = positiveFinite(source.alphaLoss, `${field}.alphaLoss`)
    const scale = positiveFinite(source.scale, `${field}.scale`)
    const velocityFactor = nonnegativeFinite(
      source.velocityFactor,
      `${field}.velocityFactor`,
    )
    if (
      !staffElementTint(tint)
      || (entry === 40 && (
        alphaLoss !== Math.fround(0.25)
        || scale !== 4
        || velocityFactor !== 1
        || alpha !== staffFadeAlpha(2, Math.fround(0.25), common.ageTicks)
      ))
      || (entry === 45 && (
        alphaLoss !== Math.fround(0.05)
        || scale < Math.fround(0.25)
        || scale > 1
        || velocityFactor !== Math.fround(0.92)
        || alpha !== staffFadeAlpha(Math.fround(1.5), Math.fround(0.05), common.ageTicks)
      ))
    ) throw new GameProtocolError(`${field} does not match native Staff MoveFade`)
    return {
      ...common,
      alpha,
      alphaLoss,
      entry,
      kind,
      position: vector(source.position, `${field}.position`),
      rotationDegrees: finite(source.rotationDegrees, `${field}.rotationDegrees`),
      scale,
      tint,
      velocity: vector(source.velocity, `${field}.velocity`),
      velocityFactor,
    }
  }
  onlyKeys(source, field, [
    'ageTicks', 'alpha', 'alphaLoss', 'entry', 'id', 'kind', 'ownerId',
    'position', 'rotationDegrees', 'scale', 'tint', 'worldKey',
  ])
  if (source.entry !== 88 || source.scale !== 3) {
    throw new GameProtocolError(`${field} does not match native Whirl fade constants`)
  }
  const tint = nonnegativeInteger(source.tint, `${field}.tint`)
  const alpha = positiveFinite(source.alpha, `${field}.alpha`)
  if (
    !staffElementTint(tint)
    || source.alphaLoss !== Math.fround(0.1)
    || alpha !== staffFadeAlpha(Math.fround(1.25), Math.fround(0.1), common.ageTicks)
  ) throw new GameProtocolError(`${field} does not match native Whirl fade recurrence`)
  return {
    ...common,
    alpha,
    alphaLoss: Math.fround(0.1),
    entry: 88,
    kind: 'player-staff-perspective-fade',
    position: vector(source.position, `${field}.position`),
    rotationDegrees: staffHeading(source.rotationDegrees, `${field}.rotationDegrees`),
    scale: 3,
    tint,
  }
}

function staffOutcome(value: unknown, field: string) {
  return memberString(value, field, [
    'normal', 'knockback', 'disabling-hit', 'critical-hit', 'whirl',
  ] as const)
}

function staffHeading(value: unknown, field: string): number {
  const heading = finite(value, field)
  if (heading < 0 || heading >= 360) {
    throw new GameProtocolError(`${field} must be within [0,360)`)
  }
  return heading
}

function staffPitch(value: unknown, field: string): number {
  const pitch = nonnegativeFinite(value, field)
  if (pitch > 2) throw new GameProtocolError(`${field} must be within [0,2]`)
  return pitch
}

function staffTargetIds(value: unknown, field: string): readonly string[] {
  const targetIds = limitedArray(value, field, MAX_PRIMARY_SPELL_HIT_TARGETS).map(
    (targetId, index) => limitedString(targetId, `${field}[${index}]`, 256),
  )
  if (targetIds.some((targetId) => !/^enemy:[1-9]\d*$/.test(targetId))) {
    throw new GameProtocolError(`${field} contains a non-enemy Staff target`)
  }
  if (new Set(targetIds).size !== targetIds.length) {
    throw new GameProtocolError(`${field} contains a duplicate target`)
  }
  return targetIds
}

function staffTargetId(value: unknown, field: string): string {
  const targetId = limitedString(value, field, 256)
  if (!/^enemy:[1-9]\d*$/.test(targetId)) {
    throw new GameProtocolError(`${field} is not an enemy Staff target`)
  }
  return targetId
}

function staffFadeAlpha(initial: number, loss: number, ageTicks: number): number {
  let alpha = Math.fround(initial)
  for (let tick = 0; tick < ageTicks; tick += 1) {
    alpha = Math.fround(alpha - loss)
  }
  return alpha
}

function staffElementTint(tint: number): boolean {
  return tint === 0xa0c3c3
    || tint === 0x90b390
    || tint === 0x886688
    || tint === 0x998077
    || tint === 0x5e6e81
}

function validatePrimarySpellOwners(
  spells: PrimarySpellSimulationState,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
  field: string,
): void {
  for (const spell of [...spells.projectiles, ...spells.transients]) {
    if (!players[spell.ownerId]) {
      throw new GameProtocolError(`${field} owner ${spell.ownerId} is not present`)
    }
  }
}

function hubParticipantState(value: unknown, field: string): ProtocolHubParticipantState {
  const source = record(value, field)
  onlyKeys(source, field, ['activity', 'collegeIntro', 'region', 'transition'])
  const activity = source.activity === null
    ? null
    : hubPlayerActivity(source.activity, `${field}.activity`)
  const region = hubRegionId(source.region, `${field}.region`)
  const collegeIntro = source.collegeIntro === null
    ? null
    : hubCollegeIntroState(source.collegeIntro, `${field}.collegeIntro`, region)
  if (source.transition === null) return { activity, collegeIntro, region, transition: null }
  const transition = record(source.transition, `${field}.transition`)
  onlyKeys(transition, `${field}.transition`, [
    'alpha',
    'destination',
    'phase',
    'scriptedSpeed',
    'scriptedTarget',
    'sourceRegion',
  ])
  const alpha = finite(transition.alpha, `${field}.transition.alpha`)
  if (alpha < 0 || alpha > 1) {
    throw new GameProtocolError(`${field}.transition.alpha must be within [0,1]`)
  }
  if (
    transition.phase !== 'college-intro'
    && transition.phase !== 'college-loadout'
    && transition.phase !== 'outgoing'
    && transition.phase !== 'incoming'
  ) {
    throw new GameProtocolError(`${field}.transition.phase is not supported`)
  }
  const destination = hubRegionId(
    transition.destination,
    `${field}.transition.destination`,
  )
  const sourceRegion = hubRegionId(
    transition.sourceRegion,
    `${field}.transition.sourceRegion`,
  )
  if (
    ((transition.phase === 'college-intro' || transition.phase === 'outgoing')
      && region !== sourceRegion)
    || ((transition.phase === 'college-loadout' || transition.phase === 'incoming')
      && region !== destination)
    || !isHubTransitionEdge(sourceRegion, destination)
  ) {
    throw new GameProtocolError(`${field}.transition is inconsistent with its region`)
  }
  return {
    activity,
    collegeIntro,
    region,
    transition: {
      alpha,
      destination,
      phase: transition.phase,
      scriptedSpeed: positiveFinite(
        transition.scriptedSpeed,
        `${field}.transition.scriptedSpeed`,
      ),
      scriptedTarget: vector(
        transition.scriptedTarget,
        `${field}.transition.scriptedTarget`,
      ),
      sourceRegion,
    },
  }
}

function hubCollegeIntroState(
  value: unknown,
  field: string,
  region: HubRegionId,
): NativeCollegeIntroState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'contactCounter',
    'coverAlpha',
    'dialogueSequence',
    'officeSpeed',
    'pathCursor',
    'phase',
    'titleCursor',
  ])
  if (
    source.phase !== 'courtyard-walk'
    && source.phase !== 'office-walk'
    && source.phase !== 'arch-dialogue'
  ) throw new GameProtocolError(`${field}.phase is not supported`)
  if (
    (source.phase === 'courtyard-walk' && region !== 'courtyard')
    || (source.phase !== 'courtyard-walk' && region !== 'office')
  ) throw new GameProtocolError(`${field}.phase is inconsistent with its region`)
  const pathCursor = nonnegativeFinite(source.pathCursor, `${field}.pathCursor`)
  const maximumPathCursor = source.phase === 'courtyard-walk' ? 9 : 6
  if (pathCursor > maximumPathCursor) {
    throw new GameProtocolError(`${field}.pathCursor exceeds its authored spline`)
  }
  const titleCursor = nonnegativeFinite(source.titleCursor, `${field}.titleCursor`)
  if (titleCursor > 5) throw new GameProtocolError(`${field}.titleCursor exceeds its spline`)
  const coverAlpha = nonnegativeFinite(source.coverAlpha, `${field}.coverAlpha`)
  if (coverAlpha > 1) throw new GameProtocolError(`${field}.coverAlpha exceeds one`)
  const officeSpeed = positiveFinite(source.officeSpeed, `${field}.officeSpeed`)
  if (officeSpeed < 0.5 || officeSpeed > 1) {
    throw new GameProtocolError(`${field}.officeSpeed is outside the native lane`)
  }
  const contactCounter = nonnegativeInteger(source.contactCounter, `${field}.contactCounter`)
  if (contactCounter > 10 || contactCounter % 2 !== 0) {
    throw new GameProtocolError(`${field}.contactCounter is outside the native lane`)
  }
  return {
    contactCounter,
    coverAlpha,
    dialogueSequence: nonnegativeInteger(
      source.dialogueSequence,
      `${field}.dialogueSequence`,
    ),
    officeSpeed,
    pathCursor,
    phase: source.phase as NativeCollegeIntroPhase,
    titleCursor,
  }
}

function hubPlayerActivity(value: unknown, field: string): HubPlayerActivity {
  return memberString(value, field, HUB_PLAYER_ACTIVITIES) as HubPlayerActivity
}

function hubRegionId(value: unknown, field: string): HubRegionId {
  const result = limitedString(value, field, 32)
  if (!isHubRegionId(result)) {
    throw new GameProtocolError(`${field} is not supported`)
  }
  return result
}

function nativeHallOfFameRunSnapshots(
  value: unknown,
  field: string,
  snapshotTick: number,
): Readonly<Record<string, NativeHallOfFameRunSnapshot>> {
  const source = record(value, field)
  if (Object.keys(source).length > MAX_PLAYERS) {
    throw new GameProtocolError(`${field} may contain at most ${MAX_PLAYERS} entries`)
  }
  const runs: Record<string, NativeHallOfFameRunSnapshot> = {}
  for (const [rawPlayerId, value] of Object.entries(source)) {
    const playerId = validatedPlayerId(rawPlayerId, `${field} player id`)
    const runField = `${field}.${playerId}`
    const run = record(value, runField)
    onlyKeys(run, runField, [
      'awesomeness',
      'awesomestKill',
      'elapsedTicks',
      'monstersKilled',
      'portraitHeadingIndex',
      'portraitScale',
    ])
    const elapsedTicks = run.elapsedTicks === null
      ? null
      : boundedInteger(run.elapsedTicks, `${runField}.elapsedTicks`, 0, 60_480_000)
    if (elapsedTicks !== null && elapsedTicks > snapshotTick) {
      throw new GameProtocolError(`${runField}.elapsedTicks exceeds its snapshot tick`)
    }
    const awesomestKill = run.awesomestKill === null
      ? null
      : limitedString(run.awesomestKill, `${runField}.awesomestKill`, 64)
    if (awesomestKill === '') {
      throw new GameProtocolError(`${runField}.awesomestKill must not be empty`)
    }
    const portraitHeadingIndex = run.portraitHeadingIndex === null
      ? null
      : boundedInteger(
          run.portraitHeadingIndex,
          `${runField}.portraitHeadingIndex`,
          0,
          23,
        )
    const portraitScale = run.portraitScale === null
      ? null
      : positiveFinite(run.portraitScale, `${runField}.portraitScale`)
    if (portraitScale !== null && (
      portraitScale < NATIVE_HALL_OF_FAME_SCORE.portraitScaleBase
      || portraitScale > 1
    )) throw new GameProtocolError(`${runField}.portraitScale is outside its native range`)
    runs[playerId] = {
      awesomeness: boundedInteger(
        run.awesomeness,
        `${runField}.awesomeness`,
        0,
        2_000_000_000,
      ),
      awesomestKill,
      elapsedTicks,
      monstersKilled: boundedInteger(
        run.monstersKilled,
        `${runField}.monstersKilled`,
        0,
        2_000_000_000,
      ),
      portraitHeadingIndex,
      portraitScale,
    }
  }
  return runs
}

function nativeEnemyWorldFeedbackState(
  value: unknown,
  field: string,
): NativeEnemyWorldFeedbackKernelState {
  const source = record(value, field)
  onlyKeys(source, field, ['accumulator', 'magnitude'])
  const accumulator = nonnegativeFinite(source.accumulator, `${field}.accumulator`)
  const magnitude = nonnegativeFinite(source.magnitude, `${field}.magnitude`)
  if (accumulator > 3.5 || magnitude > 0.2) {
    throw new GameProtocolError(`${field} exceeds the native enemy-feedback bounds`)
  }
  return { accumulator, magnitude }
}

function validateHallOfFameRunOwners(
  runs: Readonly<Record<string, NativeHallOfFameRunSnapshot>>,
  players: Readonly<Record<string, unknown>>,
  field: string,
): void {
  const runPlayerIds = Object.keys(runs).sort()
  const playerIds = Object.keys(players).sort()
  if (
    runPlayerIds.length !== playerIds.length
    || runPlayerIds.some((playerId, index) => playerId !== playerIds[index])
  ) {
    throw new GameProtocolError(
      `${field}.world.hallOfFameRuns must match ${field}.players exactly`,
    )
  }
}

function validateHallOfFameArchivePhase(
  run: GameRunLifecycleState,
  world: GameSnapshot['world'] | GameSnapshotFrame['world'],
  field: string,
): void {
  if (world.kind !== 'boneyard') return
  const archived = run.phase === 'game-over'
    && run.gameOverTicks >= NATIVE_HALL_OF_FAME_SCORE.archiveDeathTick
  if (Object.values(world.hallOfFameRuns).some(
    ({ elapsedTicks, portraitHeadingIndex, portraitScale }) => (
      (elapsedTicks !== null) !== archived
      || (portraitHeadingIndex !== null) !== archived
      || (portraitScale !== null) !== archived
    ),
  )) {
    throw new GameProtocolError(
      `${field}.world Hall archive timing does not match ${field}.run`,
    )
  }
}

function gameWorldSnapshot(
  value: unknown,
  field: string,
  snapshotTick: number,
): GameSnapshot['world'] {
  const source = record(value, field)
  if (source.kind === 'hub') return hubWorldSnapshot(source, field)
  if (source.kind === 'boneyard') {
    onlyKeys(source, field, [
      'arenaTransition',
      'deathEffects',
      'encounter',
      'enemies',
      'enemyEvents',
      'enemyWorldFeedback',
      'enemyProjectileEffects',
      'enemyProjectiles',
      'gateLeaves',
      'goodies',
      'hallOfFameRuns',
      'kind',
      'lanternLightRegistration',
      'loot',
      'lootEvents',
      'mageLightningPulses',
      'maggots',
      'runId',
      'tutorial',
      'waves',
    ])
    const encounter = boneyardSolomonSnapshot(
      source.encounter,
      `${field}.encounter`,
      snapshotTick,
    )
    const waves = boneyardWaveSnapshot(source.waves, `${field}.waves`)
    const tutorial = nativeTutorialState(source.tutorial, `${field}.tutorial`)
    const arenaTransition = boneyardArenaTransition(
      source.arenaTransition,
      `${field}.arenaTransition`,
    )
    if (tutorial === null && (
      (encounter === null) !== (waves === null)
      || (encounter === null) !== (arenaTransition === null)
    )) {
      throw new GameProtocolError(
        `${field}.arenaTransition, ${field}.encounter, and ${field}.waves must share ownership`,
      )
    }
    if (
      tutorial !== null
      && (encounter === null || waves !== null || arenaTransition !== null)
    ) throw new GameProtocolError(`${field}.tutorial owns Solomon without retail waves/entrance`)
    const runId = limitedString(source.runId, `${field}.runId`, 128)
    const hallOfFameRuns = nativeHallOfFameRunSnapshots(
      source.hallOfFameRuns,
      `${field}.hallOfFameRuns`,
      snapshotTick,
    )
    const enemyWorldFeedback = nativeEnemyWorldFeedbackState(
      source.enemyWorldFeedback,
      `${field}.enemyWorldFeedback`,
    )
    const enemyEvents = boneyardEnemyEvents(
      source.enemyEvents,
      `${field}.enemyEvents`,
      runId,
      snapshotTick,
    )
    const lootEvents = boneyardLootEvents(
      source.lootEvents,
      `${field}.lootEvents`,
      runId,
      snapshotTick,
    )
    const mageLightningPulses = boneyardMageLightningPulses(
      source.mageLightningPulses,
      `${field}.mageLightningPulses`,
      snapshotTick,
    )
    const enemyIds = new Set<number>()
    const enemies = limitedArray(
      source.enemies,
      `${field}.enemies`,
      MAX_BONEYARD_ENEMIES,
    ).map((enemy, index) => {
      const decoded = boneyardEnemySnapshot(enemy, `${field}.enemies[${index}]`)
      if (enemyIds.has(decoded.id)) {
        throw new GameProtocolError(`${field}.enemies duplicates id ${decoded.id}`)
      }
      enemyIds.add(decoded.id)
      return decoded
    })
    const deathEffectIds = new Set<number>()
    const deathEffects = limitedArray(
      source.deathEffects,
      `${field}.deathEffects`,
      MAX_BONEYARD_ENEMY_DEATH_EFFECTS,
    ).map((effect, index) => {
      const decoded = boneyardEnemyDeathEffectSnapshot(
        effect,
        `${field}.deathEffects[${index}]`,
      )
      if (deathEffectIds.has(decoded.id)) {
        throw new GameProtocolError(`${field}.deathEffects duplicates id ${decoded.id}`)
      }
      deathEffectIds.add(decoded.id)
      return decoded
    })
    const projectileIds = new Set<number>()
    const enemyProjectiles = limitedArray(
      source.enemyProjectiles,
      `${field}.enemyProjectiles`,
      MAX_BONEYARD_ENEMY_PROJECTILES,
    ).map((projectile, index) => {
      const decoded = boneyardEnemyProjectileSnapshot(
        projectile,
        `${field}.enemyProjectiles[${index}]`,
      )
      if (projectileIds.has(decoded.id)) {
        throw new GameProtocolError(`${field}.enemyProjectiles duplicates id ${decoded.id}`)
      }
      projectileIds.add(decoded.id)
      return decoded
    })
    const projectileEffectIds = new Set<number>()
    const enemyProjectileEffects = limitedArray(
      source.enemyProjectileEffects,
      `${field}.enemyProjectileEffects`,
      MAX_BONEYARD_ENEMY_PROJECTILE_EFFECTS,
    ).map((effect, index) => {
      const decoded = boneyardEnemyProjectileEffectSnapshot(
        effect,
        `${field}.enemyProjectileEffects[${index}]`,
      )
      if (projectileEffectIds.has(decoded.id)) {
        throw new GameProtocolError(
          `${field}.enemyProjectileEffects duplicates id ${decoded.id}`,
        )
      }
      projectileEffectIds.add(decoded.id)
      return decoded
    })
    const maggotIds = new Set<number>()
    const maggots = limitedArray(
      source.maggots,
      `${field}.maggots`,
      MAX_BONEYARD_MAGGOTS,
    ).map((maggot, index) => {
      const decoded = boneyardMaggotSnapshot(maggot, `${field}.maggots[${index}]`)
      if (maggotIds.has(decoded.id)) {
        throw new GameProtocolError(`${field}.maggots duplicates id ${decoded.id}`)
      }
      maggotIds.add(decoded.id)
      return decoded
    })
    const lootIds = new Set<number>()
    const loot = limitedArray(source.loot, `${field}.loot`, MAX_BONEYARD_LOOT)
      .map((entry, index) => {
        const decoded = boneyardLootSnapshot(entry, `${field}.loot[${index}]`)
        if (lootIds.has(decoded.id)) {
          throw new GameProtocolError(`${field}.loot duplicates id ${decoded.id}`)
        }
        lootIds.add(decoded.id)
        return decoded
      })
    const goodieIds = new Set<number>()
    const goodies = limitedArray(
      source.goodies,
      `${field}.goodies`,
      MAX_BONEYARD_GOODIES,
    ).map((entry, index) => {
      const decoded = boneyardGoodieSnapshot(entry, `${field}.goodies[${index}]`)
      if (goodieIds.has(decoded.id)) {
        throw new GameProtocolError(`${field}.goodies duplicates id ${decoded.id}`)
      }
      goodieIds.add(decoded.id)
      return decoded
    })
    return {
      arenaTransition,
      deathEffects,
      encounter,
      enemies,
      enemyEvents,
      enemyWorldFeedback,
      enemyProjectileEffects,
      enemyProjectiles,
      gateLeaves: limitedArray(
        source.gateLeaves,
        `${field}.gateLeaves`,
        MAX_BONEYARD_STRUCTURES * 2,
      ).map((leaf, index) => boneyardGateLeafSnapshot(
        leaf,
        `${field}.gateLeaves[${index}]`,
      )),
      goodies,
      hallOfFameRuns,
      kind: 'boneyard',
      lanternLightRegistration: nullableNativeLightProviderRegistration(
        source.lanternLightRegistration,
        `${field}.lanternLightRegistration`,
        'actor',
      ),
      mageLightningPulses,
      maggots,
      loot,
      lootEvents,
      runId,
      tutorial,
      waves,
    }
  }
  throw new GameProtocolError(`${field}.kind is not supported`)
}

function boneyardLootSnapshot(value: unknown, field: string): BoneyardLootSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'activationDelayTicks',
    'ageTicks',
    'alpha',
    'amount',
    'animationPhase',
    'bonusKind',
    'bounceHeight',
    'framePhase',
    'id',
    'itemContentId',
    'itemNativeSubtype',
    'itemNativeTypeId',
    'kind',
    'nativeTypeId',
    'orbKind',
    'orbValue',
    'position',
    'rotationDeg',
    'scatterActive',
    'scatterProgress',
    'scatterSeed',
    'source',
    'spawnTick',
    'tier',
  ])
  const kind = limitedString(source.kind, `${field}.kind`, 16)
  if (!(BONEYARD_LOOT_KINDS as readonly string[]).includes(kind)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const expectedNativeType = { bonus: 2038, gold: 2012, orb: 2011, sack: 2013 }[kind]
  const nativeTypeId = positiveInteger(source.nativeTypeId, `${field}.nativeTypeId`)
  if (nativeTypeId !== expectedNativeType) {
    throw new GameProtocolError(`${field}.nativeTypeId does not match kind`)
  }
  const lootSource = limitedString(source.source, `${field}.source`, 16)
  if (!(BONEYARD_LOOT_SOURCES as readonly string[]).includes(lootSource)) {
    throw new GameProtocolError(`${field}.source is not supported`)
  }
  const orbKind = source.orbKind === null
    ? null
    : limitedString(source.orbKind, `${field}.orbKind`, 8)
  if ((kind === 'orb') !== (orbKind === 'health' || orbKind === 'mana')) {
    throw new GameProtocolError(`${field}.orbKind does not match kind`)
  }
  const bonusKind = source.bonusKind === null
    ? null
    : integerWithin(source.bonusKind, `${field}.bonusKind`, 0, 2) as 0 | 1 | 2
  if ((kind === 'bonus') !== (bonusKind !== null)) {
    throw new GameProtocolError(`${field}.bonusKind does not match kind`)
  }
  const itemNativeTypeId = source.itemNativeTypeId === null
    ? null
    : boundedInteger(source.itemNativeTypeId, `${field}.itemNativeTypeId`, 7001, 7013)
  const itemNativeSubtype = source.itemNativeSubtype === null
    ? null
    : boundedInteger(source.itemNativeSubtype, `${field}.itemNativeSubtype`, 0, 261)
  const itemContentId = source.itemContentId === null
    ? null
    : limitedString(source.itemContentId, `${field}.itemContentId`, 19)
  if (itemContentId !== null && !/^[1-9][0-9]{0,18}$/.test(itemContentId)) {
    throw new GameProtocolError(`${field}.itemContentId is invalid`)
  }
  if ((kind === 'sack') !== (itemNativeTypeId !== null)) {
    throw new GameProtocolError(`${field}.item identity does not match kind`)
  }
  if (
    kind === 'sack'
    && !validBoneyardSackItemIdentity(itemNativeTypeId!, itemNativeSubtype, itemContentId)
  ) throw new GameProtocolError(`${field}.item identity is not a native Sack payload`)
  const alpha = finite(source.alpha, `${field}.alpha`)
  const orbValue = nonnegativeFinite(source.orbValue, `${field}.orbValue`)
  if (alpha < 0 || alpha > 1 || orbValue > 1) {
    throw new GameProtocolError(`${field} alpha/value is outside [0,1]`)
  }
  const activationDelayTicks = integer(
    source.activationDelayTicks,
    `${field}.activationDelayTicks`,
  )
  const amount = nonnegativeInteger(source.amount, `${field}.amount`)
  const animationPhase = finite(source.animationPhase, `${field}.animationPhase`)
  const bounceHeight = finite(source.bounceHeight, `${field}.bounceHeight`)
  const framePhase = nonnegativeFinite(source.framePhase, `${field}.framePhase`)
  const rotationDeg = finite(source.rotationDeg, `${field}.rotationDeg`)
  const scatterActive = boolean(source.scatterActive, `${field}.scatterActive`)
  const scatterProgress = nonnegativeFinite(
    source.scatterProgress,
    `${field}.scatterProgress`,
  )
  const scatterSeed = nonnegativeInteger(source.scatterSeed, `${field}.scatterSeed`)
  const tier = integerWithin(source.tier, `${field}.tier`, 0, 3)
  if (!validBoneyardLootDynamicIdentity({
    activationDelayTicks,
    alpha,
    amount,
    animationPhase,
    bounceHeight,
    framePhase,
    kind: kind as BoneyardLootSnapshot['kind'],
    orbValue,
    rotationDeg,
    scatterActive,
    scatterProgress,
    scatterSeed,
    tier,
  })) throw new GameProtocolError(`${field} dynamic fields do not match kind`)
  return {
    activationDelayTicks,
    ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
    alpha,
    amount,
    animationPhase,
    bonusKind,
    bounceHeight,
    framePhase,
    id: boundedInteger(source.id, `${field}.id`, 1, 2_047),
    itemContentId,
    itemNativeSubtype,
    itemNativeTypeId,
    kind: kind as BoneyardLootSnapshot['kind'],
    nativeTypeId: nativeTypeId as BoneyardLootSnapshot['nativeTypeId'],
    orbKind: orbKind as BoneyardLootSnapshot['orbKind'],
    orbValue,
    position: boneyardPoint(source.position, `${field}.position`),
    rotationDeg,
    scatterActive,
    scatterProgress,
    scatterSeed,
    source: lootSource as BoneyardLootSnapshot['source'],
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
    tier,
  }
}

function validBoneyardSackItemIdentity(
  nativeTypeId: number,
  nativeSubtype: number | null,
  contentId: string | null,
): boolean {
  if (nativeTypeId === 7001) return nativeSubtype !== null && (
    nativeSubtype <= 5 ? contentId === null : contentId !== null
  )
  if (nativeTypeId === 7013) return nativeSubtype === null && contentId !== null
  if (contentId !== null) return false
  if (nativeTypeId === 7012) return nativeSubtype !== null && nativeSubtype <= 3
  if (nativeTypeId === 7008) return nativeSubtype === 0
  return [7002, 7003, 7004, 7005, 7006, 7011].includes(nativeTypeId)
    && nativeSubtype === null
}

function validBoneyardLootDynamicIdentity(
  loot: Pick<
    BoneyardLootSnapshot,
    | 'activationDelayTicks'
    | 'alpha'
    | 'amount'
    | 'animationPhase'
    | 'bounceHeight'
    | 'framePhase'
    | 'kind'
    | 'orbValue'
    | 'rotationDeg'
    | 'scatterActive'
    | 'scatterProgress'
    | 'scatterSeed'
    | 'tier'
  >,
): boolean {
  if (loot.kind === 'gold') {
    const tier = loot.amount < 3 ? 0 : loot.amount < 5 ? 1 : loot.amount < 8 ? 2 : 3
    return loot.amount > 0
      && loot.alpha === 0
      && loot.bounceHeight === 0
      && loot.framePhase === 0
      && loot.orbValue === 0
      && loot.scatterProgress <= 8.5
      && loot.scatterSeed <= 99_999
      && loot.tier === tier
  }
  if (
    loot.amount !== 0
    || loot.scatterActive
    || loot.scatterProgress !== 0
    || loot.scatterSeed !== 0
    || loot.tier !== 0
  ) return false
  if (loot.kind === 'sack') {
    return loot.alpha === 0
      && loot.animationPhase === 0
      && loot.bounceHeight <= 0
      && loot.framePhase === 0
      && loot.orbValue === 0
      && loot.rotationDeg === 0
  }
  if (loot.activationDelayTicks !== 0 || loot.bounceHeight !== 0) return false
  if (loot.kind === 'orb') {
    return loot.framePhase === 0 && loot.rotationDeg === 0
  }
  return loot.alpha > 0 && loot.framePhase <= 18 && loot.orbValue === 0
}

function boneyardGoodieSnapshot(value: unknown, field: string): BoneyardGoodieSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'active', 'exhausted', 'id', 'phase', 'position', 'subtype', 'timer',
  ])
  const phase = integerWithin(source.phase, `${field}.phase`, 0, 2) as 0 | 1 | 2
  const timer = nonnegativeInteger(source.timer, `${field}.timer`)
  if (timer > 250) throw new GameProtocolError(`${field}.timer exceeds 250`)
  return {
    active: boolean(source.active, `${field}.active`),
    exhausted: boolean(source.exhausted, `${field}.exhausted`),
    id: positiveInteger(source.id, `${field}.id`),
    phase,
    position: boneyardPoint(source.position, `${field}.position`),
    subtype: nonnegativeInteger(source.subtype, `${field}.subtype`),
    timer,
  }
}

function boneyardLootEvents(
  value: unknown,
  field: string,
  runId: string,
  snapshotTick: number,
): BoneyardLootEventSnapshot[] {
  let priorEventId = 0
  let priorTick = -1
  return limitedArray(value, field, MAX_BONEYARD_LOOT_EVENTS).map((entry, index) => {
    const eventField = `${field}[${index}]`
    const source = record(entry, eventField)
    const type = limitedString(source.type, `${eventField}.type`, 32)
    if (!(BONEYARD_LOOT_EVENT_TYPES as readonly string[]).includes(type)) {
      throw new GameProtocolError(`${eventField}.type is not supported`)
    }
    const payloadKeys = type === 'goodie-phase'
      ? ['goodieId', 'phase']
      : type === 'goodie-key-needed'
        ? ['goodieId', 'playerId', 'text']
      : type === 'loot-drop-sound'
        ? ['playbackRate', 'sound']
        : ['playbackRate', 'playerId', 'sound', 'text']
    onlyKeys(source, eventField, [
      'actorId', 'eventId', 'position', 'runId', 'tick', 'type', ...payloadKeys,
    ])
    if (limitedString(source.runId, `${eventField}.runId`, 128) !== runId) {
      throw new GameProtocolError(`${eventField}.runId does not match its world`)
    }
    const eventId = positiveInteger(source.eventId, `${eventField}.eventId`)
    const tick = nonnegativeInteger(source.tick, `${eventField}.tick`)
    if (eventId <= priorEventId || tick < priorTick || tick > snapshotTick) {
      throw new GameProtocolError(`${eventField} is outside monotonic event order`)
    }
    priorEventId = eventId
    priorTick = tick
    const base = {
      actorId: positiveInteger(source.actorId, `${eventField}.actorId`),
      eventId,
      position: boneyardPoint(source.position, `${eventField}.position`),
      runId,
      tick,
      type: type as BoneyardLootEventSnapshot['type'],
    }
    if (type === 'goodie-phase') return {
      ...base,
      goodieId: positiveInteger(source.goodieId, `${eventField}.goodieId`),
      phase: integerWithin(source.phase, `${eventField}.phase`, 0, 2) as 0 | 1 | 2,
    }
    if (type === 'goodie-key-needed') {
      const text = limitedString(source.text, `${eventField}.text`, 128)
      if (text !== 'I need a key!') {
        throw new GameProtocolError(`${eventField}.text is not the native key prompt`)
      }
      return {
        ...base,
        goodieId: positiveInteger(source.goodieId, `${eventField}.goodieId`),
        playerId: validatedPlayerId(source.playerId, `${eventField}.playerId`),
        text,
      }
    }
    const sound = source.sound === undefined
      ? undefined
      : limitedString(source.sound, `${eventField}.sound`, 32)
    if (sound !== undefined && !(BONEYARD_LOOT_SOUNDS as readonly string[]).includes(sound)) {
      throw new GameProtocolError(`${eventField}.sound is not supported`)
    }
    const playbackRate = source.playbackRate === undefined
      ? undefined
      : finite(source.playbackRate, `${eventField}.playbackRate`)
    if (
      (sound === undefined) !== (playbackRate === undefined)
      || (playbackRate !== undefined && (playbackRate < 0.9 || playbackRate > 1.1))
    ) throw new GameProtocolError(`${eventField}.playbackRate does not match sound`)
    if (type === 'loot-drop-sound') {
      if (sound === undefined) throw new GameProtocolError(`${eventField}.sound is required`)
      return {
        ...base,
        playbackRate: playbackRate!,
        sound: sound as BoneyardLootEventSnapshot['sound'],
      }
    }
    return {
      ...base,
      playerId: validatedPlayerId(source.playerId, `${eventField}.playerId`),
      ...(playbackRate === undefined ? {} : { playbackRate }),
      ...(sound === undefined ? {} : { sound: sound as BoneyardLootEventSnapshot['sound'] }),
      ...(source.text === undefined
        ? {}
        : { text: limitedString(source.text, `${eventField}.text`, 128) }),
    }
  })
}

function boneyardEnemyDeathEffectSnapshot(
  value: unknown,
  field: string,
): BoneyardEnemyDeathEffectSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'ageTicks',
    'alpha',
    'atlas',
    'blendMode',
    'entry',
    'height',
    'id',
    'kind',
    'ownerActorId',
    'presentationOwner',
    'position',
    'rotationRadians',
    'scale',
    'shadow',
    'spawnTick',
    'tint',
  ])
  const alpha = finite(source.alpha, `${field}.alpha`)
  const atlas = limitedString(source.atlas, `${field}.atlas`, 32)
  if (atlas !== 'BadGuys' && atlas !== 'DeadHawg' && atlas !== 'Demon') {
    throw new GameProtocolError(`${field}.atlas is not supported`)
  }
  const blendMode = limitedString(source.blendMode, `${field}.blendMode`, 16)
  if (blendMode !== 'add' && blendMode !== 'normal') {
    throw new GameProtocolError(`${field}.blendMode is not supported`)
  }
  const kind = limitedString(source.kind, `${field}.kind`, 32)
  if (!(BONEYARD_ENEMY_DEATH_EFFECT_KINDS as readonly string[]).includes(kind)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const presentationOwner = limitedString(
    source.presentationOwner,
    `${field}.presentationOwner`,
    32,
  )
  if (!(
    BONEYARD_ENEMY_DEATH_EFFECT_PRESENTATION_OWNERS as readonly string[]
  ).includes(presentationOwner)) {
    throw new GameProtocolError(`${field}.presentationOwner is not supported`)
  }
  const entry = nonnegativeInteger(source.entry, `${field}.entry`)
  const maximumAlpha = atlas === 'BadGuys'
    && blendMode === 'add'
    && entry === 69
    && kind === 'fade'
    ? 1.25
    : 1
  if (alpha < 0 || alpha > maximumAlpha) {
    throw new GameProtocolError(`${field}.alpha must be within [0,${maximumAlpha}]`)
  }
  const tint = nonnegativeInteger(source.tint, `${field}.tint`)
  if (tint > 0xffffff) {
    throw new GameProtocolError(`${field}.tint must be a 24-bit RGB value`)
  }
  return {
    ageTicks: nonnegativeFinite(source.ageTicks, `${field}.ageTicks`),
    alpha,
    atlas,
    blendMode,
    entry,
    height: finite(source.height, `${field}.height`),
    id: positiveInteger(source.id, `${field}.id`),
    kind: kind as BoneyardEnemyDeathEffectSnapshot['kind'],
    ownerActorId: positiveInteger(source.ownerActorId, `${field}.ownerActorId`),
    presentationOwner:
      presentationOwner as BoneyardEnemyDeathEffectSnapshot['presentationOwner'],
    position: boneyardPoint(source.position, `${field}.position`),
    rotationRadians: finite(source.rotationRadians, `${field}.rotationRadians`),
    scale: positiveFinite(source.scale, `${field}.scale`),
    shadow: boolean(source.shadow, `${field}.shadow`),
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
    tint,
  }
}

function boneyardSolomonSnapshot(
  value: unknown,
  field: string,
  snapshotTick: number,
): BoneyardSolomonSnapshot | null {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'acceleration',
    'digBodyOffsetY',
    'digEvents',
    'digFrame',
    'escapeSpeed',
    'headingDeg',
    'lifetimeTicksRemaining',
    'mouthPose',
    'mouthPoseTicksRemaining',
    'motion',
    'phase',
    'phaseTicksRemaining',
    'position',
    'runEventId',
    'targetPlayerId',
    'transitionOffsetY',
    'turnRate',
    'voiceEvents',
    'voiceTicksRemaining',
    'walkCycle',
  ])
  const phase = limitedString(source.phase, `${field}.phase`, 32)
  if (!(BONEYARD_SOLOMON_PHASES as readonly string[]).includes(phase)) {
    throw new GameProtocolError(`${field}.phase is not supported`)
  }
  const headingDeg = finite(source.headingDeg, `${field}.headingDeg`)
  if (headingDeg < 0 || headingDeg > 360) {
    throw new GameProtocolError(`${field}.headingDeg must be within [0,360]`)
  }
  const mouthPose = nonnegativeInteger(source.mouthPose, `${field}.mouthPose`)
  if (mouthPose >= 3) {
    throw new GameProtocolError(`${field}.mouthPose must be within [0,3)`)
  }
  const digFrame = nonnegativeInteger(source.digFrame, `${field}.digFrame`)
  if (digFrame >= 18) {
    throw new GameProtocolError(`${field}.digFrame must be within [0,18)`)
  }
  const digBodyOffsetY = finite(source.digBodyOffsetY, `${field}.digBodyOffsetY`)
  if (digBodyOffsetY < -0.001 || digBodyOffsetY > 10) {
    throw new GameProtocolError(`${field}.digBodyOffsetY must be within [-0.001,10]`)
  }
  let previousDigEventId = 0
  let previousDigEventTick = 0
  const digEvents = limitedArray(
    source.digEvents,
    `${field}.digEvents`,
    MAX_BONEYARD_DIG_EVENTS,
  ).map((event, index) => {
    const eventField = `${field}.digEvents[${index}]`
    const item = record(event, eventField)
    onlyKeys(item, eventField, ['cue', 'id', 'tick'])
    const cue = limitedString(item.cue, `${eventField}.cue`, 64)
    if (!(BONEYARD_SOLOMON_DIG_CUES as readonly string[]).includes(cue)) {
      throw new GameProtocolError(`${eventField}.cue is not supported`)
    }
    const id = positiveInteger(item.id, `${eventField}.id`)
    const tick = nonnegativeInteger(item.tick, `${eventField}.tick`)
    if (id <= previousDigEventId || tick < previousDigEventTick || tick > snapshotTick) {
      throw new GameProtocolError(`${field}.digEvents must increase within snapshot tick`)
    }
    previousDigEventId = id
    previousDigEventTick = tick
    return { cue: cue as BoneyardSolomonDigCue, id, tick }
  })
  const transitionOffsetY = nonnegativeFinite(
    source.transitionOffsetY,
    `${field}.transitionOffsetY`,
  )
  if (transitionOffsetY > 15) {
    throw new GameProtocolError(`${field}.transitionOffsetY must be within [0,15]`)
  }
  const turnRate = nonnegativeFinite(source.turnRate, `${field}.turnRate`)
  if (turnRate > 10) {
    throw new GameProtocolError(`${field}.turnRate must be within [0,10]`)
  }
  const walkCycle = nonnegativeFinite(source.walkCycle, `${field}.walkCycle`)
  if (walkCycle > 6) {
    throw new GameProtocolError(`${field}.walkCycle must be within [0,6]`)
  }
  let previousVoiceEventId = 0
  const voiceEvents = limitedArray(
    source.voiceEvents,
    `${field}.voiceEvents`,
    MAX_BONEYARD_VOICE_EVENTS,
  ).map((event, index) => {
    const eventField = `${field}.voiceEvents[${index}]`
    const item = record(event, eventField)
    onlyKeys(item, eventField, ['cue', 'id'])
    const cue = limitedString(item.cue, `${eventField}.cue`, 64)
    if (!(BONEYARD_SOLOMON_VOICE_CUES as readonly string[]).includes(cue)) {
      throw new GameProtocolError(`${eventField}.cue is not supported`)
    }
    const id = positiveInteger(item.id, `${eventField}.id`)
    if (id <= previousVoiceEventId) {
      throw new GameProtocolError(`${field}.voiceEvents ids must increase`)
    }
    previousVoiceEventId = id
    return { cue: cue as BoneyardSolomonVoiceCue, id }
  })
  return {
    acceleration: finite(source.acceleration, `${field}.acceleration`),
    digBodyOffsetY,
    digEvents,
    digFrame,
    escapeSpeed: nonnegativeFinite(source.escapeSpeed, `${field}.escapeSpeed`),
    headingDeg,
    lifetimeTicksRemaining: nonnegativeInteger(
      source.lifetimeTicksRemaining,
      `${field}.lifetimeTicksRemaining`,
    ),
    mouthPose,
    mouthPoseTicksRemaining: nonnegativeInteger(
      source.mouthPoseTicksRemaining,
      `${field}.mouthPoseTicksRemaining`,
    ),
    motion: finite(source.motion, `${field}.motion`),
    phase: phase as BoneyardSolomonPhase,
    phaseTicksRemaining: nonnegativeInteger(
      source.phaseTicksRemaining,
      `${field}.phaseTicksRemaining`,
    ),
    position: boneyardPoint(source.position, `${field}.position`),
    runEventId: nonnegativeInteger(source.runEventId, `${field}.runEventId`),
    targetPlayerId: source.targetPlayerId === null
      ? null
      : validatedPlayerId(source.targetPlayerId, `${field}.targetPlayerId`),
    transitionOffsetY,
    turnRate,
    voiceEvents,
    voiceTicksRemaining: nonnegativeInteger(
      source.voiceTicksRemaining,
      `${field}.voiceTicksRemaining`,
    ),
    walkCycle,
  }
}

function boneyardWaveSnapshot(
  value: unknown,
  field: string,
): BoneyardWaveSnapshot | null {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'interwaveDelayTicks',
    'pendingSpawnBudget',
    'phase',
    'scheduleIndex',
    'spawnDelayTicks',
    'waveEventId',
    'waveOrdinal',
  ])
  const phase = limitedString(source.phase, `${field}.phase`, 32)
  if (!(BONEYARD_WAVE_DIRECTOR_PHASES as readonly string[]).includes(phase)) {
    throw new GameProtocolError(`${field}.phase is not supported`)
  }
  return {
    interwaveDelayTicks: nonnegativeInteger(
      source.interwaveDelayTicks,
      `${field}.interwaveDelayTicks`,
    ),
    pendingSpawnBudget: nonnegativeInteger(
      source.pendingSpawnBudget,
      `${field}.pendingSpawnBudget`,
    ),
    phase: phase as BoneyardWaveDirectorPhase,
    scheduleIndex: nonnegativeInteger(source.scheduleIndex, `${field}.scheduleIndex`),
    spawnDelayTicks: nonnegativeInteger(
      source.spawnDelayTicks,
      `${field}.spawnDelayTicks`,
    ),
    waveEventId: nonnegativeInteger(source.waveEventId, `${field}.waveEventId`),
    waveOrdinal: nonnegativeInteger(source.waveOrdinal, `${field}.waveOrdinal`),
  }
}

function nativeTutorialState(value: unknown, field: string): NativeTutorialState | null {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'active',
    'cameraLockAgeTicks',
    'cameraLockTriggered',
    'cameraLockTicksRemaining',
    'damageProtection',
    'dialogueArmed',
    'introActive',
    'introBlend',
    'introDelayTicksRemaining',
    'introFade',
    'introMovementTicksRemaining',
    'inventoryOpened',
    'inventorySeen',
    'itemDropArmed',
    'movementAnchor',
    'movementInstructionAcknowledged',
    'narration',
    'nextSpawnIntentId',
    'primaryCastSequenceAtStart',
    'rngState',
    'selectedSkillHudAcknowledged',
    'skillsOpened',
    'skillsSeen',
    'solomonDialogueQueued',
    'solomonRetreatQueued',
    'stage',
    'stageTicks',
    'survivalEnabled',
    'survivalIntervalCursor',
    'survivalLastCheckedTicks',
    'waveOrdinal',
    'waveSpawnCursor',
    'waveTicks',
  ])
  const stage = boundedInteger(source.stage, `${field}.stage`, 0, 19)
  if (!(NATIVE_TUTORIAL_STAGES as readonly number[]).includes(stage)) {
    throw new GameProtocolError(`${field}.stage is not supported`)
  }
  const active = boolean(source.active, `${field}.active`)
  if (!active && stage !== 19) {
    throw new GameProtocolError(`${field}.active may clear only at stage 19`)
  }
  const narrationSource = record(source.narration, `${field}.narration`)
  onlyKeys(narrationSource, `${field}.narration`, [
    'current',
    'nextEventId',
    'pending',
    'ticksRemaining',
  ])
  const nextEventId = positiveInteger(
    narrationSource.nextEventId,
    `${field}.narration.nextEventId`,
  )
  const pending = limitedArray(
    narrationSource.pending,
    `${field}.narration.pending`,
    64,
  ).map((cue, index) => tutorialCue(cue, `${field}.narration.pending[${index}]`))
  const current = narrationSource.current === null
    ? null
    : (() => {
        const currentField = `${field}.narration.current`
        const event = record(narrationSource.current, currentField)
        onlyKeys(event, currentField, ['cue', 'eventId', 'speaker', 'text'])
        const cueName = tutorialCue(event.cue, `${currentField}.cue`)
        const definition = NATIVE_TUTORIAL_CUE_DEFINITIONS[cueName]
        const eventId = positiveInteger(event.eventId, `${currentField}.eventId`)
        if (eventId >= nextEventId) {
          throw new GameProtocolError(`${currentField}.eventId must precede nextEventId`)
        }
        const speaker = memberString(
          event.speaker,
          `${currentField}.speaker`,
          ['sirmin', 'solomon'] as const,
        )
        const text = limitedString(event.text, `${currentField}.text`, 512)
        if (speaker !== definition.speaker || text !== definition.text) {
          throw new GameProtocolError(`${currentField} disagrees with its authored cue`)
        }
        return { cue: cueName, eventId, speaker, text }
      })()
  const ticksRemaining = boundedInteger(
    narrationSource.ticksRemaining,
    `${field}.narration.ticksRemaining`,
    0,
    100_000,
  )
  if ((current === null) !== (ticksRemaining === 0)) {
    throw new GameProtocolError(`${field}.narration current/ticks are inconsistent`)
  }
  if (
    current !== null
    && ticksRemaining > NATIVE_TUTORIAL_CUE_DEFINITIONS[current.cue].durationTicks
  ) throw new GameProtocolError(`${field}.narration ticks exceed the authored cue`)
  const intervalTicks = limitedArray(
    source.survivalLastCheckedTicks,
    `${field}.survivalLastCheckedTicks`,
    3,
  )
  if (intervalTicks.length !== 3) {
    throw new GameProtocolError(`${field}.survivalLastCheckedTicks needs three clocks`)
  }
  const introActive = boolean(source.introActive, `${field}.introActive`)
  const introBlend = unitInterval(source.introBlend, `${field}.introBlend`)
  const introDelayTicksRemaining = boundedInteger(
    source.introDelayTicksRemaining,
    `${field}.introDelayTicksRemaining`,
    0,
    25,
  )
  const introFade = unitInterval(source.introFade, `${field}.introFade`)
  if (!introActive && (
    introDelayTicksRemaining !== 0
    || introBlend !== 1
    || introFade !== 0
  )) throw new GameProtocolError(`${field} has an inconsistent completed intro`)
  if (introDelayTicksRemaining > 0 && (introBlend !== 0 || introFade !== 1)) {
    throw new GameProtocolError(`${field} has an inconsistent held intro`)
  }
  if (introBlend < 1 && introFade !== 1) {
    throw new GameProtocolError(`${field} fades before the intro blend completes`)
  }
  const cameraLockAgeTicks = boundedInteger(
    source.cameraLockAgeTicks,
    `${field}.cameraLockAgeTicks`,
    0,
    NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
  )
  const cameraLockTriggered = boolean(
    source.cameraLockTriggered,
    `${field}.cameraLockTriggered`,
  )
  const cameraLockTicksRemaining = boundedInteger(
    source.cameraLockTicksRemaining,
    `${field}.cameraLockTicksRemaining`,
    0,
    NATIVE_TUTORIAL_CAMERA_CLEANUP_TICKS,
  )
  if (!cameraLockTriggered && (cameraLockAgeTicks !== 0 || cameraLockTicksRemaining !== 0)) {
    throw new GameProtocolError(`${field} has camera-lock state before its trigger`)
  }
  if (
    cameraLockTriggered
    && cameraLockTicksRemaining !== Math.max(
      0,
      NATIVE_TUTORIAL_CAMERA_CLEANUP_TICKS - cameraLockAgeTicks,
    )
  ) throw new GameProtocolError(`${field} has inconsistent camera-lock clocks`)
  return {
    active,
    cameraLockAgeTicks,
    cameraLockTriggered,
    cameraLockTicksRemaining,
    damageProtection: boolean(source.damageProtection, `${field}.damageProtection`),
    dialogueArmed: boolean(source.dialogueArmed, `${field}.dialogueArmed`),
    introActive,
    introBlend,
    introDelayTicksRemaining,
    introFade,
    introMovementTicksRemaining: boundedInteger(
      source.introMovementTicksRemaining,
      `${field}.introMovementTicksRemaining`,
      0,
      250,
    ),
    inventoryOpened: boolean(source.inventoryOpened, `${field}.inventoryOpened`),
    inventorySeen: boolean(source.inventorySeen, `${field}.inventorySeen`),
    itemDropArmed: boolean(source.itemDropArmed, `${field}.itemDropArmed`),
    movementAnchor: boneyardPoint(source.movementAnchor, `${field}.movementAnchor`),
    movementInstructionAcknowledged: boolean(
      source.movementInstructionAcknowledged,
      `${field}.movementInstructionAcknowledged`,
    ),
    narration: { current, nextEventId, pending, ticksRemaining },
    nextSpawnIntentId: positiveInteger(source.nextSpawnIntentId, `${field}.nextSpawnIntentId`),
    primaryCastSequenceAtStart: nonnegativeInteger(
      source.primaryCastSequenceAtStart,
      `${field}.primaryCastSequenceAtStart`,
    ),
    rngState: nativeRngState(source.rngState, `${field}.rngState`),
    selectedSkillHudAcknowledged: boolean(
      source.selectedSkillHudAcknowledged,
      `${field}.selectedSkillHudAcknowledged`,
    ),
    skillsOpened: boolean(source.skillsOpened, `${field}.skillsOpened`),
    skillsSeen: boolean(source.skillsSeen, `${field}.skillsSeen`),
    solomonDialogueQueued: boolean(
      source.solomonDialogueQueued,
      `${field}.solomonDialogueQueued`,
    ),
    solomonRetreatQueued: boolean(
      source.solomonRetreatQueued,
      `${field}.solomonRetreatQueued`,
    ),
    stage: stage as NativeTutorialState['stage'],
    stageTicks: nonnegativeInteger(source.stageTicks, `${field}.stageTicks`),
    survivalEnabled: boolean(source.survivalEnabled, `${field}.survivalEnabled`),
    survivalIntervalCursor: boundedInteger(
      source.survivalIntervalCursor,
      `${field}.survivalIntervalCursor`,
      0,
      2,
    ) as 0 | 1 | 2,
    survivalLastCheckedTicks: intervalTicks.map((tick, index) => nonnegativeInteger(
      tick,
      `${field}.survivalLastCheckedTicks[${index}]`,
    )) as [number, number, number],
    waveOrdinal: boundedInteger(source.waveOrdinal, `${field}.waveOrdinal`, 0, 6),
    waveSpawnCursor: nonnegativeInteger(source.waveSpawnCursor, `${field}.waveSpawnCursor`),
    waveTicks: nonnegativeInteger(source.waveTicks, `${field}.waveTicks`),
  }
}

function tutorialCue(value: unknown, field: string): NativeTutorialCue {
  return memberString(value, field, NATIVE_TUTORIAL_CUES)
}

function boneyardEnemyEvents(
  value: unknown,
  field: string,
  runId: string,
  snapshotTick: number,
): BoneyardEnemyEventSnapshot[] {
  let previousEventId = 0
  let previousTick = -1
  return limitedArray(value, field, MAX_BONEYARD_ENEMY_EVENTS).map((event, index) => {
    const eventField = `${field}[${index}]`
    const source = record(event, eventField)
    const rawType = limitedString(source.type, `${eventField}.type`, 64)
    if (!(BONEYARD_ENEMY_EVENT_TYPES as readonly string[]).includes(rawType)) {
      throw new GameProtocolError(`${eventField}.type is not supported`)
    }
    const type = rawType as BoneyardEnemyEventSnapshot['type']
    const payloadKeys = (() => {
      switch (type) {
        case 'attack-marker': return ['deflectPitch', 'targetPlayerId']
        case 'enemy-spawned':
        case 'reward': return ['targetPlayerId']
        case 'coffin-maggot-release': return ['count']
        case 'enemy-death':
        case 'enemy-retired': return []
        case 'enemy-action-sound':
        case 'enemy-damage-sound':
        case 'enemy-death-sound': return [
          'gainScale',
          'pitch',
          'sound',
          'sourcePosition',
        ]
        case 'player-damage-sound': return [
          'gainScale',
          'pitch',
          'sound',
          'sourcePosition',
          'targetPlayerId',
        ]
        case 'enemy-terminal-output': return ['count', 'output']
        case 'projectile-impact': return [
          'deflectPitch',
          'projectileId',
          'targetPlayerId',
        ]
        case 'projectile-retired':
        case 'projectile-spawned': return ['projectileId', 'targetPlayerId']
      }
    })()
    onlyKeys(source, eventField, [
      'actorId',
      'eventId',
      'runId',
      'tick',
      'type',
      ...payloadKeys,
    ])
    const eventRunId = limitedString(source.runId, `${eventField}.runId`, 128)
    if (eventRunId !== runId) {
      throw new GameProtocolError(`${eventField}.runId does not match its Boneyard world`)
    }
    const eventId = positiveInteger(source.eventId, `${eventField}.eventId`)
    if (eventId <= previousEventId) {
      throw new GameProtocolError(`${field} eventIds must increase`)
    }
    const tick = nonnegativeInteger(source.tick, `${eventField}.tick`)
    if (tick < previousTick) {
      throw new GameProtocolError(`${field} ticks must not decrease`)
    }
    if (tick > snapshotTick) {
      throw new GameProtocolError(`${eventField}.tick exceeds its snapshot tick`)
    }
    previousEventId = eventId
    previousTick = tick
    const base = {
      actorId: positiveInteger(source.actorId, `${eventField}.actorId`),
      eventId,
      runId,
      tick,
      type,
    }
    switch (type) {
      case 'attack-marker': {
        const targetPlayerId = nullablePlayerId(
          source.targetPlayerId,
          `${eventField}.targetPlayerId`,
        )
        const deflect = deflectPitchPayload(source.deflectPitch, eventField)
        if (deflect.deflectPitch !== undefined && targetPlayerId === null) {
          throw new GameProtocolError(`${eventField}.deflectPitch requires a targetPlayerId`)
        }
        return { ...base, ...deflect, targetPlayerId }
      }
      case 'enemy-spawned':
      case 'reward': return {
        ...base,
        targetPlayerId: nullablePlayerId(source.targetPlayerId, `${eventField}.targetPlayerId`),
      }
      case 'coffin-maggot-release': return {
        ...base,
        count: nonnegativeInteger(source.count, `${eventField}.count`),
      }
      case 'enemy-death':
      case 'enemy-retired': return base
      case 'enemy-action-sound':
      case 'enemy-damage-sound':
      case 'enemy-death-sound':
      case 'player-damage-sound': {
        const sound = limitedString(source.sound, `${eventField}.sound`, 64)
        const supportedSounds = type === 'enemy-action-sound'
          ? BONEYARD_ENEMY_ACTION_SOUNDS
          : type === 'enemy-damage-sound'
            ? BONEYARD_ENEMY_DAMAGE_SOUNDS
            : type === 'enemy-death-sound'
              ? BONEYARD_ENEMY_DEATH_SOUNDS
              : BONEYARD_PLAYER_DAMAGE_SOUNDS
        if (!(supportedSounds as readonly string[]).includes(sound)) {
          throw new GameProtocolError(`${eventField}.sound is not supported`)
        }
        const pitch = positiveFinite(source.pitch, `${eventField}.pitch`)
        if (pitch > 2) {
          throw new GameProtocolError(`${eventField}.pitch must be within (0,2]`)
        }
        const gainScale = nonnegativeFinite(
          source.gainScale,
          `${eventField}.gainScale`,
        )
        if (gainScale > 1) {
          throw new GameProtocolError(`${eventField}.gainScale must be within [0,1]`)
        }
        return {
          ...base,
          gainScale,
          pitch,
          sound: sound as BoneyardEnemyEventSnapshot['sound'],
          sourcePosition: vector(source.sourcePosition, `${eventField}.sourcePosition`),
          ...(type === 'player-damage-sound'
            ? {
                targetPlayerId: nullablePlayerId(
                  source.targetPlayerId,
                  `${eventField}.targetPlayerId`,
                ),
              }
            : {}),
        }
      }
      case 'enemy-terminal-output': {
        const output = limitedString(source.output, `${eventField}.output`, 64)
        if (!(BONEYARD_ENEMY_TERMINAL_OUTPUTS as readonly string[]).includes(output)) {
          throw new GameProtocolError(`${eventField}.output is not supported`)
        }
        return {
          ...base,
          output: output as BoneyardEnemyEventSnapshot['output'],
          ...(source.count === undefined
            ? {}
            : { count: nonnegativeInteger(source.count, `${eventField}.count`) }),
        }
      }
      case 'projectile-impact': {
        const targetPlayerId = nullablePlayerId(
          source.targetPlayerId,
          `${eventField}.targetPlayerId`,
        )
        const deflect = deflectPitchPayload(source.deflectPitch, eventField)
        if (deflect.deflectPitch !== undefined && targetPlayerId === null) {
          throw new GameProtocolError(`${eventField}.deflectPitch requires a targetPlayerId`)
        }
        return {
          ...base,
          ...deflect,
          projectileId: positiveInteger(source.projectileId, `${eventField}.projectileId`),
          targetPlayerId,
        }
      }
      case 'projectile-retired':
      case 'projectile-spawned': return {
        ...base,
        projectileId: positiveInteger(source.projectileId, `${eventField}.projectileId`),
        targetPlayerId: nullablePlayerId(source.targetPlayerId, `${eventField}.targetPlayerId`),
      }
    }
  })
}

function deflectPitchPayload(
  value: unknown,
  field: string,
): Readonly<{ deflectPitch?: number }> {
  if (value === undefined) return {}
  const deflectPitch = nonnegativeFinite(value, `${field}.deflectPitch`)
  if (deflectPitch > 2) {
    throw new GameProtocolError(`${field}.deflectPitch must be within [0,2]`)
  }
  return { deflectPitch }
}

function boneyardMageLightningPulses(
  value: unknown,
  field: string,
  snapshotTick: number,
): BoneyardMageLightningPulseSnapshot[] {
  const pulses = limitedArray(
    value,
    field,
    MAX_BONEYARD_MAGE_LIGHTNING_PULSES,
  ).map((pulse, index): BoneyardMageLightningPulseSnapshot => {
    const pulseField = `${field}[${index}]`
    const source = record(pulse, pulseField)
    onlyKeys(source, pulseField, [
      'contact',
      'endpoint',
      'id',
      'midpoint',
      'ownerActorId',
      'seed',
      'source',
      'tick',
    ])
    const contactField = `${pulseField}.contact`
    const contactSource = record(source.contact, contactField)
    const kind = limitedString(contactSource.kind, `${contactField}.kind`, 32)
    const contact = (() => {
      if (kind === 'world') {
        onlyKeys(contactSource, contactField, ['kind', 'position'])
        return {
          kind: 'world' as const,
          position: vector(contactSource.position, `${contactField}.position`),
        }
      }
      if (kind === 'target-attached') {
        onlyKeys(contactSource, contactField, ['kind', 'localOffset', 'targetPlayerId'])
        return {
          kind: 'target-attached' as const,
          localOffset: vector(contactSource.localOffset, `${contactField}.localOffset`),
          targetPlayerId: validatedPlayerId(
            contactSource.targetPlayerId,
            `${contactField}.targetPlayerId`,
          ),
        }
      }
      throw new GameProtocolError(`${contactField}.kind is not supported`)
    })()
    const seed = nonnegativeInteger(source.seed, `${pulseField}.seed`)
    if (seed > 0xffff_ffff) {
      throw new GameProtocolError(`${pulseField}.seed must be an unsigned 32-bit integer`)
    }
    return {
      contact,
      endpoint: vector(source.endpoint, `${pulseField}.endpoint`),
      id: positiveInteger(source.id, `${pulseField}.id`),
      midpoint: vector(source.midpoint, `${pulseField}.midpoint`),
      ownerActorId: positiveInteger(source.ownerActorId, `${pulseField}.ownerActorId`),
      seed,
      source: vector(source.source, `${pulseField}.source`),
      tick: nonnegativeInteger(source.tick, `${pulseField}.tick`),
    }
  })
  validateBoneyardMageLightningPulseSequence(pulses, field, snapshotTick)
  return pulses
}

function validateBoneyardMageLightningPulseSequence(
  pulses: readonly BoneyardMageLightningPulseSnapshot[],
  field: string,
  snapshotTick: number,
): void {
  let previousId = 0
  let previousTick = -1
  pulses.forEach((pulse, index) => {
    const pulseField = `${field}[${index}]`
    if (pulse.id <= previousId) {
      throw new GameProtocolError(`${field} ids must increase`)
    }
    if (pulse.tick < previousTick) {
      throw new GameProtocolError(`${field} ticks must not decrease`)
    }
    if (pulse.tick > snapshotTick) {
      throw new GameProtocolError(`${pulseField}.tick exceeds its snapshot tick`)
    }
    if (snapshotTick - pulse.tick >= NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES) {
      throw new GameProtocolError(`${pulseField} exceeds the live pulse age limit`)
    }
    previousId = pulse.id
    previousTick = pulse.tick
  })
}

function boneyardMageLightningPulseFrames(
  value: unknown,
  field: string,
  snapshotTick: number,
): BoneyardMageLightningPulseFrame[] {
  const frames = limitedArray(
    value,
    field,
    MAX_BONEYARD_MAGE_LIGHTNING_PULSES,
  ).map((frame, index) => {
    if (!boneyardMageLightningPulseFrameIsValid(frame)) {
      throw new GameProtocolError(`${field}[${index}] is not a valid compact pulse`)
    }
    return [...frame] as BoneyardMageLightningPulseFrame
  })
  validateBoneyardMageLightningPulseSequence(
    frames.map(materializeBoneyardMageLightningPulse),
    field,
    snapshotTick,
  )
  return frames
}

function nullablePlayerId(value: unknown, field: string): string | null {
  return value === null ? null : validatedPlayerId(value, field)
}

function boneyardEnemySnapshot(value: unknown, field: string): BoneyardEnemySnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'animation',
    'armored',
    'currentHealth',
    'enemyToken',
    'flags',
    'headingDeg',
    'id',
    'lightRegistration',
    'lighting',
    'mageCloak',
    'maximumHealth',
    'nativeTypeId',
    'position',
    'shieldHealth',
    'shieldMaximumHealth',
    'spawnTick',
  ])
  const enemyToken = limitedString(source.enemyToken, `${field}.enemyToken`, 32)
  const expectedTypeId = BONEYARD_WAVE_ENEMY_TYPES[
    enemyToken as keyof typeof BONEYARD_WAVE_ENEMY_TYPES
  ]
  if (expectedTypeId === undefined) {
    throw new GameProtocolError(`${field}.enemyToken is not supported`)
  }
  const nativeTypeId = positiveInteger(source.nativeTypeId, `${field}.nativeTypeId`)
  if (nativeTypeId !== expectedTypeId) {
    throw new GameProtocolError(`${field}.nativeTypeId does not match enemyToken`)
  }
  const flags = limitedArray(
    source.flags,
    `${field}.flags`,
    MAX_BONEYARD_ENEMY_FLAGS,
  ).map((flag, index) => {
    const decoded = limitedString(flag, `${field}.flags[${index}]`, 64)
    if (!(BONEYARD_ENEMY_FLAGS as readonly string[]).includes(decoded)) {
      throw new GameProtocolError(`${field}.flags[${index}] is not supported`)
    }
    return decoded
  })
  if (new Set(flags).size !== flags.length) {
    throw new GameProtocolError(`${field}.flags must be unique`)
  }
  const headingDeg = finite(source.headingDeg, `${field}.headingDeg`)
  if (headingDeg < 0 || headingDeg >= 360) {
    throw new GameProtocolError(`${field}.headingDeg must be within [0,360)`)
  }
  const maximumHealth = positiveFinite(source.maximumHealth, `${field}.maximumHealth`)
  const currentHealth = finite(source.currentHealth, `${field}.currentHealth`)
  if (currentHealth > maximumHealth) {
    throw new GameProtocolError(`${field}.currentHealth exceeds maximumHealth`)
  }
  const shieldHealth = nonnegativeFinite(source.shieldHealth, `${field}.shieldHealth`)
  const shieldMaximumHealth = nonnegativeFinite(
    source.shieldMaximumHealth,
    `${field}.shieldMaximumHealth`,
  )
  if (shieldHealth > shieldMaximumHealth) {
    throw new GameProtocolError(`${field}.shieldHealth exceeds shieldMaximumHealth`)
  }
  const armored = boolean(source.armored, `${field}.armored`)
  if (armored && enemyToken !== 'SKELETON') {
    throw new GameProtocolError(`${field}.armored is only valid for SKELETON`)
  }
  const mageCloak = boolean(source.mageCloak, `${field}.mageCloak`)
  if (mageCloak && enemyToken !== 'SKELETONMAGE') {
    throw new GameProtocolError(`${field}.mageCloak is only valid for SKELETONMAGE`)
  }
  const animation = boneyardEnemyAnimation(source.animation, `${field}.animation`)
  if (
    animation.headFacingOffset !== 0
    && (
      animation.state !== 'action'
      || (enemyToken !== 'SKELETON' && enemyToken !== 'SKELETONMAGE')
    )
  ) {
    throw new GameProtocolError(
      `${field}.animation.headFacingOffset requires an active Skeleton or Mage action`,
    )
  }
  return {
    animation,
    armored,
    currentHealth,
    enemyToken: enemyToken as BoneyardEnemySnapshot['enemyToken'],
    flags,
    headingDeg,
    id: positiveInteger(source.id, `${field}.id`),
    lightRegistration: nativeLightProviderRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    lighting: boneyardEnemyLighting(source.lighting, `${field}.lighting`),
    mageCloak,
    maximumHealth,
    nativeTypeId,
    position: boneyardPoint(source.position, `${field}.position`),
    shieldHealth,
    shieldMaximumHealth,
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
  }
}

function boneyardEnemyLighting(
  value: unknown,
  field: string,
): BoneyardEnemySnapshot['lighting'] {
  const source = record(value, field)
  onlyKeys(source, field, ['charge', 'glow', 'providerCopies'])
  const charge = finite(source.charge, `${field}.charge`)
  const glow = finite(source.glow, `${field}.glow`)
  if (charge < 0 || charge > 1) {
    throw new GameProtocolError(`${field}.charge must be within [0,1]`)
  }
  if (glow < 0 || glow > 1) {
    throw new GameProtocolError(`${field}.glow must be within [0,1]`)
  }
  const providerCopies = nonnegativeInteger(
    source.providerCopies,
    `${field}.providerCopies`,
  )
  if (providerCopies > 2) {
    throw new GameProtocolError(`${field}.providerCopies must be within [0,2]`)
  }
  return { charge, glow, providerCopies: providerCopies as 0 | 1 | 2 }
}

function boneyardEnemyProjectileSnapshot(
  value: unknown,
  field: string,
): BoneyardEnemyProjectileSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'ageTicks',
    'contactRadius',
    'headingDeg',
    'homing',
    'id',
    'kind',
    'lightRegistration',
    'lifetimeTicks',
    'nativeTypeId',
    'ownerActorId',
    'payload',
    'position',
    'speed',
    'spawnTick',
    'verticalOffset',
    'visualPhaseDeg',
    'visualScale',
  ])
  const kind = limitedString(source.kind, `${field}.kind`, 32)
  if (!(kind in BONEYARD_ENEMY_PROJECTILE_NATIVE_TYPES)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const nativeTypeId = positiveInteger(source.nativeTypeId, `${field}.nativeTypeId`)
  if (
    nativeTypeId
    !== BONEYARD_ENEMY_PROJECTILE_NATIVE_TYPES[kind as BoneyardEnemyProjectileKind]
  ) {
    throw new GameProtocolError(`${field}.nativeTypeId does not match kind`)
  }
  const headingDeg = finite(source.headingDeg, `${field}.headingDeg`)
  if (headingDeg < 0 || headingDeg >= 360) {
    throw new GameProtocolError(`${field}.headingDeg must be within [0,360)`)
  }
  const lifetimeTicks = positiveInteger(source.lifetimeTicks, `${field}.lifetimeTicks`)
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  if (kind !== 'demon-bomb' && kind !== 'arrow' && ageTicks > lifetimeTicks) {
    throw new GameProtocolError(`${field}.ageTicks exceeds lifetimeTicks`)
  }
  const speed = finite(source.speed, `${field}.speed`)
  if (speed < 0 || speed > 10) {
    throw new GameProtocolError(`${field}.speed is outside [0,10]`)
  }
  const verticalOffset = finite(source.verticalOffset, `${field}.verticalOffset`)
  if (verticalOffset > 0) {
    throw new GameProtocolError(`${field}.verticalOffset must be non-positive`)
  }
  const visualPhaseDeg = finite(source.visualPhaseDeg, `${field}.visualPhaseDeg`)
  if (visualPhaseDeg < 0 || visualPhaseDeg >= 720) {
    throw new GameProtocolError(`${field}.visualPhaseDeg must be within [0,720)`)
  }
  const payload = limitedString(source.payload, `${field}.payload`, 16)
  if (!(BONEYARD_ENEMY_PROJECTILE_PAYLOADS as readonly string[]).includes(payload)) {
    throw new GameProtocolError(`${field}.payload is not supported`)
  }
  if (!projectilePayloadMatchesKind(
    kind as BoneyardEnemyProjectileKind,
    payload as BoneyardEnemyProjectilePayload,
  )) {
    throw new GameProtocolError(`${field}.payload does not match kind`)
  }
  return {
    ageTicks,
    contactRadius: positiveFinite(source.contactRadius, `${field}.contactRadius`),
    headingDeg,
    homing: boolean(source.homing, `${field}.homing`),
    id: positiveInteger(source.id, `${field}.id`),
    kind: kind as BoneyardEnemyProjectileKind,
    lightRegistration: boneyardEnemyProjectileLightRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      kind as BoneyardEnemyProjectileKind,
      payload as BoneyardEnemyProjectilePayload,
    ),
    lifetimeTicks,
    nativeTypeId: nativeTypeId as BoneyardEnemyProjectileSnapshot['nativeTypeId'],
    ownerActorId: positiveInteger(source.ownerActorId, `${field}.ownerActorId`),
    payload: payload as BoneyardEnemyProjectilePayload,
    position: boneyardPoint(source.position, `${field}.position`),
    speed,
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
    verticalOffset,
    visualPhaseDeg,
    visualScale: positiveFinite(source.visualScale, `${field}.visualScale`),
  }
}

function boneyardEnemyProjectileEffectSnapshot(
  value: unknown,
  field: string,
): BoneyardEnemyProjectileEffectSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'ageTicks',
    'alpha',
    'atlas',
    'blendMode',
    'entry',
    'id',
    'kind',
    'lightRegistration',
    'lifetimeTicks',
    'ownerActorId',
    'ownerProjectileId',
    'phaseOriginTicks',
    'position',
    'rotationRadians',
    'scale',
    'spawnTick',
    'tint',
  ])
  const kind = limitedString(source.kind, `${field}.kind`, 32)
  if (!(BONEYARD_ENEMY_PROJECTILE_EFFECT_KINDS as readonly string[]).includes(kind)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const atlas = limitedString(source.atlas, `${field}.atlas`, 16)
  if (atlas !== 'BadGuys' && atlas !== 'DeadHawg') {
    throw new GameProtocolError(`${field}.atlas is not supported`)
  }
  const blendMode = limitedString(source.blendMode, `${field}.blendMode`, 16)
  if (blendMode !== 'add' && blendMode !== 'normal') {
    throw new GameProtocolError(`${field}.blendMode is not supported`)
  }
  const lifetimeTicks = positiveInteger(source.lifetimeTicks, `${field}.lifetimeTicks`)
  const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
  if (ageTicks >= lifetimeTicks) {
    throw new GameProtocolError(`${field}.ageTicks must precede lifetimeTicks`)
  }
  const alpha = finite(source.alpha, `${field}.alpha`)
  const maximumAlpha = BONEYARD_ENEMY_PROJECTILE_EFFECT_ALPHA_MAXIMUMS[
    kind as BoneyardEnemyProjectileEffectSnapshot['kind']
  ]
  if (alpha < 0 || alpha > maximumAlpha) {
    throw new GameProtocolError(`${field}.alpha must be within [0,${maximumAlpha}]`)
  }
  return {
    ageTicks,
    alpha,
    atlas,
    blendMode,
    entry: nonnegativeInteger(source.entry, `${field}.entry`),
    id: positiveInteger(source.id, `${field}.id`),
    kind: kind as BoneyardEnemyProjectileEffectSnapshot['kind'],
    lightRegistration: kind === 'fire-burst-glow'
      ? nativeLightProviderRegistration(
          source.lightRegistration,
          `${field}.lightRegistration`,
          'transient',
        )
      : absentNativeActorLight(source, field),
    lifetimeTicks,
    ownerActorId: positiveInteger(source.ownerActorId, `${field}.ownerActorId`),
    ownerProjectileId: positiveInteger(
      source.ownerProjectileId,
      `${field}.ownerProjectileId`,
    ),
    phaseOriginTicks: nonnegativeInteger(
      source.phaseOriginTicks,
      `${field}.phaseOriginTicks`,
    ),
    position: boneyardPoint(source.position, `${field}.position`),
    rotationRadians: finite(source.rotationRadians, `${field}.rotationRadians`),
    scale: nonnegativeFinite(source.scale, `${field}.scale`),
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
    tint: integerWithin(source.tint, `${field}.tint`, 0, 0xffffff),
  }
}

function projectilePayloadMatchesKind(
  kind: BoneyardEnemyProjectileKind,
  payload: BoneyardEnemyProjectilePayload,
): boolean {
  switch (kind) {
    case 'arrow': return payload === 'normal' || payload === 'fire' || payload === 'poison'
    case 'firebolt': return payload === 'fire'
    case 'guided-missile': return payload === 'cold' || payload === 'poison'
    case 'demon-bomb': return payload === 'none'
    case 'poison-pool': return payload === 'poison'
  }
}

function boneyardEnemyProjectileLightRegistration(
  value: unknown,
  field: string,
  kind: BoneyardEnemyProjectileKind,
  payload: BoneyardEnemyProjectilePayload,
): NativeLightProviderRegistration | null {
  if (kind === 'guided-missile' || kind === 'demon-bomb') {
    return nativeLightProviderRegistration(value, field, 'actor')
  }
  if (kind === 'firebolt' || (kind === 'arrow' && payload === 'fire')) {
    return nativeLightProviderRegistration(value, field, 'transient')
  }
  return absentNativeLightProviderRegistration(value, field)
}

function boneyardMaggotSnapshot(value: unknown, field: string): BoneyardMaggotSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'alpha',
    'currentHealth',
    'deathEpoch',
    'deathTick',
    'emergencePhase',
    'emergenceTick',
    'emergenceOrientation',
    'headingDeg',
    'hitFlash',
    'id',
    'launchTrajectory',
    'lightRegistration',
    'maximumHealth',
    'ownerCoffinActorId',
    'pose',
    'position',
    'spawnTick',
    'state',
    'verticalOffset',
  ])
  const state = limitedString(source.state, `${field}.state`, 16)
  if (!(BONEYARD_MAGGOT_STATES as readonly string[]).includes(state)) {
    throw new GameProtocolError(`${field}.state is not supported`)
  }
  const launchTrajectory = limitedString(
    source.launchTrajectory,
    `${field}.launchTrajectory`,
    16,
  )
  if (!(BONEYARD_MAGGOT_LAUNCH_TRAJECTORIES as readonly string[]).includes(launchTrajectory)) {
    throw new GameProtocolError(`${field}.launchTrajectory is not supported`)
  }
  const emergenceTick = nonnegativeInteger(source.emergenceTick, `${field}.emergenceTick`)
  const emergencePhase = nonnegativeFinite(source.emergencePhase, `${field}.emergencePhase`)
  if (emergencePhase >= 5) {
    throw new GameProtocolError(`${field}.emergencePhase is out of range`)
  }
  const alpha = finite(source.alpha, `${field}.alpha`)
  if (alpha < 0 || alpha > 1) {
    throw new GameProtocolError(`${field}.alpha must be within [0,1]`)
  }
  const hitFlash = finite(source.hitFlash, `${field}.hitFlash`)
  if (hitFlash < 0 || hitFlash > 1) {
    throw new GameProtocolError(`${field}.hitFlash must be within [0,1]`)
  }
  const headingDeg = finite(source.headingDeg, `${field}.headingDeg`)
  if (headingDeg < 0 || headingDeg >= 360) {
    throw new GameProtocolError(`${field}.headingDeg must be within [0,360)`)
  }
  const maximumHealth = positiveFinite(source.maximumHealth, `${field}.maximumHealth`)
  const currentHealth = finite(source.currentHealth, `${field}.currentHealth`)
  if (currentHealth > maximumHealth) {
    throw new GameProtocolError(`${field}.currentHealth exceeds maximumHealth`)
  }
  const verticalOffset = finite(source.verticalOffset, `${field}.verticalOffset`)
  if (verticalOffset > 0) {
    throw new GameProtocolError(`${field}.verticalOffset must be non-positive`)
  }
  return {
    alpha,
    currentHealth,
    deathEpoch: nonnegativeInteger(source.deathEpoch, `${field}.deathEpoch`),
    deathTick: nonnegativeInteger(source.deathTick, `${field}.deathTick`),
    emergencePhase,
    emergenceTick,
    emergenceOrientation: integerWithin(
      source.emergenceOrientation,
      `${field}.emergenceOrientation`,
      0,
      9,
    ),
    headingDeg,
    hitFlash,
    id: positiveInteger(source.id, `${field}.id`),
    launchTrajectory: launchTrajectory as BoneyardMaggotSnapshot['launchTrajectory'],
    lightRegistration: nativeLightProviderRegistration(
      source.lightRegistration,
      `${field}.lightRegistration`,
      'actor',
    ),
    maximumHealth,
    ownerCoffinActorId: positiveInteger(
      source.ownerCoffinActorId,
      `${field}.ownerCoffinActorId`,
    ),
    pose: nonnegativeFinite(source.pose, `${field}.pose`),
    position: boneyardPoint(source.position, `${field}.position`),
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
    state: state as BoneyardMaggotSnapshot['state'],
    verticalOffset,
  }
}

function boneyardEnemyAnimation(
  value: unknown,
  field: string,
): BoneyardEnemyAnimationSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'action',
    'actionProgress',
    'alpha',
    'bodyPose',
    'coffinPose',
    'coffinRotationRadians',
    'coffinScaleX',
    'coffinSecondaryPose',
    'coffinState',
    'deathEpoch',
    'deathTick',
    'demonFrontJointRotationRadians',
    'demonFrontLimbRotationRadians',
    'demonRearJointRotationRadians',
    'demonRearLimbRotationRadians',
    'effects',
    'gaitPose',
    'headFacingOffset',
    'hitFlash',
    'impBodyRotationRadians',
    'impEffectAlpha',
    'impEffectFrame',
    'maggots',
    'state',
    'verticalOffset',
    'zombieAngularOffsetDeg',
    'zombieAttackSide',
    'zombieBodyRotationRadians',
    'zombieBodyType',
    'zombieFrontArmPose',
    'zombieFrontArmRotationRadians',
    'zombieHeadType',
    'zombieHeadRotationRadians',
    'zombieRearArmPose',
    'zombieRearArmRotationRadians',
  ])
  const state = limitedString(source.state, `${field}.state`, 32)
  if (!(BONEYARD_ENEMY_ANIMATION_STATES as readonly string[]).includes(state)) {
    throw new GameProtocolError(`${field}.state is not supported`)
  }
  const action = source.action === null
    ? null
    : limitedString(source.action, `${field}.action`, 64)
  if (action !== null && !(BONEYARD_ENEMY_ACTIONS as readonly string[]).includes(action)) {
    throw new GameProtocolError(`${field}.action is not supported`)
  }
  if ((state === 'action') !== (action !== null)) {
    throw new GameProtocolError(`${field}.action does not match animation state`)
  }
  const coffinState = limitedString(source.coffinState, `${field}.coffinState`, 32)
  if (!(BONEYARD_ENEMY_COFFIN_STATES as readonly string[]).includes(coffinState)) {
    throw new GameProtocolError(`${field}.coffinState is not supported`)
  }
  const coffinScaleX = integerWithin(source.coffinScaleX, `${field}.coffinScaleX`, -1, 1)
  if (coffinScaleX === 0) {
    throw new GameProtocolError(`${field}.coffinScaleX must be -1 or 1`)
  }
  const alpha = finite(source.alpha, `${field}.alpha`)
  const hitFlash = finite(source.hitFlash, `${field}.hitFlash`)
  const impEffectAlpha = finite(source.impEffectAlpha, `${field}.impEffectAlpha`)
  if (
    alpha < 0 || alpha > 1
    || hitFlash < 0 || hitFlash > 1
    || impEffectAlpha < 0 || impEffectAlpha > 1
  ) {
    throw new GameProtocolError(`${field} alpha channels must be within [0,1]`)
  }
  const effects = limitedArray(
    source.effects,
    `${field}.effects`,
    MAX_BONEYARD_ENEMY_EFFECTS,
  ).map((effect, index) => boneyardEnemyEffect(
    effect,
    `${field}.effects[${index}]`,
  ))
  if (new Set(effects.map((effect) => effect.id)).size !== effects.length) {
    throw new GameProtocolError(`${field}.effects must have unique ids`)
  }
  if (new Set(effects.map((effect) => effect.role)).size !== effects.length) {
    throw new GameProtocolError(`${field}.effects must have unique roles`)
  }
  if (limitedArray(source.maggots, `${field}.maggots`, 0).length !== 0) {
    throw new GameProtocolError(
      `${field}.maggots must be empty in protocol ${GAME_PROTOCOL_VERSION}`,
    )
  }
  return {
    action: action as BoneyardEnemyAction | null,
    actionProgress: nonnegativeFinite(source.actionProgress, `${field}.actionProgress`),
    alpha,
    bodyPose: nonnegativeFinite(source.bodyPose, `${field}.bodyPose`),
    coffinPose: nonnegativeFinite(source.coffinPose, `${field}.coffinPose`),
    coffinRotationRadians: finite(
      source.coffinRotationRadians,
      `${field}.coffinRotationRadians`,
    ),
    coffinScaleX: coffinScaleX as -1 | 1,
    coffinSecondaryPose: source.coffinSecondaryPose === null
      ? null
      : nonnegativeFinite(source.coffinSecondaryPose, `${field}.coffinSecondaryPose`),
    coffinState: coffinState as BoneyardEnemyCoffinState,
    deathEpoch: nonnegativeInteger(source.deathEpoch, `${field}.deathEpoch`),
    deathTick: nonnegativeInteger(source.deathTick, `${field}.deathTick`),
    demonFrontJointRotationRadians: finite(
      source.demonFrontJointRotationRadians,
      `${field}.demonFrontJointRotationRadians`,
    ),
    demonFrontLimbRotationRadians: finite(
      source.demonFrontLimbRotationRadians,
      `${field}.demonFrontLimbRotationRadians`,
    ),
    demonRearJointRotationRadians: finite(
      source.demonRearJointRotationRadians,
      `${field}.demonRearJointRotationRadians`,
    ),
    demonRearLimbRotationRadians: finite(
      source.demonRearLimbRotationRadians,
      `${field}.demonRearLimbRotationRadians`,
    ),
    effects,
    gaitPose: nonnegativeFinite(source.gaitPose, `${field}.gaitPose`),
    headFacingOffset: integerWithin(
      source.headFacingOffset,
      `${field}.headFacingOffset`,
      -1,
      1,
    ) as BoneyardEnemyAnimationSnapshot['headFacingOffset'],
    hitFlash,
    impBodyRotationRadians: finite(
      source.impBodyRotationRadians,
      `${field}.impBodyRotationRadians`,
    ),
    impEffectAlpha,
    impEffectFrame: integer(source.impEffectFrame, `${field}.impEffectFrame`),
    maggots: [],
    state: state as BoneyardEnemyAnimationSnapshot['state'],
    verticalOffset: finite(source.verticalOffset, `${field}.verticalOffset`),
    zombieAngularOffsetDeg: finite(
      source.zombieAngularOffsetDeg,
      `${field}.zombieAngularOffsetDeg`,
    ),
    zombieAttackSide: integerWithin(
      source.zombieAttackSide,
      `${field}.zombieAttackSide`,
      0,
      1,
    ) as 0 | 1,
    zombieBodyRotationRadians: finite(
      source.zombieBodyRotationRadians,
      `${field}.zombieBodyRotationRadians`,
    ),
    zombieBodyType: integerWithin(
      source.zombieBodyType,
      `${field}.zombieBodyType`,
      -1,
      3,
    ),
    zombieFrontArmPose: nonnegativeFinite(
      source.zombieFrontArmPose,
      `${field}.zombieFrontArmPose`,
    ),
    zombieFrontArmRotationRadians: finite(
      source.zombieFrontArmRotationRadians,
      `${field}.zombieFrontArmRotationRadians`,
    ),
    zombieHeadType: integerWithin(
      source.zombieHeadType,
      `${field}.zombieHeadType`,
      -1,
      3,
    ),
    zombieHeadRotationRadians: finite(
      source.zombieHeadRotationRadians,
      `${field}.zombieHeadRotationRadians`,
    ),
    zombieRearArmPose: nonnegativeFinite(
      source.zombieRearArmPose,
      `${field}.zombieRearArmPose`,
    ),
    zombieRearArmRotationRadians: finite(
      source.zombieRearArmRotationRadians,
      `${field}.zombieRearArmRotationRadians`,
    ),
  }
}

function boneyardEnemyEffect(
  value: unknown,
  field: string,
): BoneyardEnemyEffectSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'alpha',
    'atlas',
    'blendMode',
    'entry',
    'id',
    'offset',
    'role',
    'rotationRadians',
    'scale',
  ])
  const role = limitedString(source.role, `${field}.role`, 32)
  if (!(BONEYARD_ENEMY_EFFECT_ROLES as readonly string[]).includes(role)) {
    throw new GameProtocolError(`${field}.role is not supported`)
  }
  const atlas = limitedString(source.atlas, `${field}.atlas`, 16)
  const blendMode = limitedString(source.blendMode, `${field}.blendMode`, 16)
  if (atlas !== 'BadGuys' && atlas !== 'DeadHawg') {
    throw new GameProtocolError(`${field}.atlas is not supported`)
  }
  if (blendMode !== 'add' && blendMode !== 'normal') {
    throw new GameProtocolError(`${field}.blendMode is not supported`)
  }
  const entry = nonnegativeInteger(source.entry, `${field}.entry`)
  if (atlas !== 'BadGuys' || blendMode !== 'add' || entry !== 49) {
    throw new GameProtocolError(`${field} fields do not match role`)
  }
  const alpha = finite(source.alpha, `${field}.alpha`)
  const maximumAlpha = 1.25
  if (alpha < 0 || alpha > maximumAlpha) {
    throw new GameProtocolError(`${field}.alpha must be within [0,${maximumAlpha}]`)
  }
  return {
    alpha,
    atlas,
    blendMode,
    entry,
    id: positiveInteger(source.id, `${field}.id`),
    offset: boneyardPoint(source.offset, `${field}.offset`),
    role: role as BoneyardEnemyEffectSnapshot['role'],
    rotationRadians: finite(source.rotationRadians, `${field}.rotationRadians`),
    scale: positiveFinite(source.scale, `${field}.scale`),
  }
}

function gameWorldSnapshotFrame(
  value: unknown,
  field: string,
  snapshotTick: number,
): GameSnapshotFrame['world'] {
  const source = record(value, field)
  if (source.kind === 'boneyard') {
    onlyKeys(source, field, [
      'arenaTransition',
      'encounter',
      'entities',
      'enemyEvents',
      'enemyWorldFeedback',
      'gateLeaves',
      'hallOfFameRuns',
      'kind',
      'lanternLightRegistration',
      'lootEvents',
      'mageLightningPulses',
      'runId',
      'tutorial',
      'waves',
    ])
    const encounter = boneyardSolomonSnapshot(
      source.encounter,
      `${field}.encounter`,
      snapshotTick,
    )
    const waves = boneyardWaveSnapshot(source.waves, `${field}.waves`)
    const tutorial = nativeTutorialState(source.tutorial, `${field}.tutorial`)
    const arenaTransition = boneyardArenaTransition(
      source.arenaTransition,
      `${field}.arenaTransition`,
    )
    if (tutorial === null && (
      (encounter === null) !== (waves === null)
      || (encounter === null) !== (arenaTransition === null)
    )) {
      throw new GameProtocolError(
        `${field}.arenaTransition, ${field}.encounter, and ${field}.waves must share ownership`,
      )
    }
    if (
      tutorial !== null
      && (encounter === null || waves !== null || arenaTransition !== null)
    ) throw new GameProtocolError(`${field}.tutorial owns Solomon without retail waves/entrance`)
    const runId = limitedString(source.runId, `${field}.runId`, 128)
    return {
      arenaTransition,
      encounter,
      entities: replicatedEntityFrame(source.entities, `${field}.entities`),
      enemyEvents: boneyardEnemyEvents(
        source.enemyEvents,
        `${field}.enemyEvents`,
        runId,
        snapshotTick,
      ),
      enemyWorldFeedback: nativeEnemyWorldFeedbackState(
        source.enemyWorldFeedback,
        `${field}.enemyWorldFeedback`,
      ),
      gateLeaves: limitedArray(
        source.gateLeaves,
        `${field}.gateLeaves`,
        MAX_BONEYARD_STRUCTURES * 2,
      ).map((leaf, index) => boneyardGateLeafSnapshot(
        leaf,
        `${field}.gateLeaves[${index}]`,
      )),
      hallOfFameRuns: nativeHallOfFameRunSnapshots(
        source.hallOfFameRuns,
        `${field}.hallOfFameRuns`,
        snapshotTick,
      ),
      kind: 'boneyard',
      lanternLightRegistration: nullableNativeLightProviderRegistration(
        source.lanternLightRegistration,
        `${field}.lanternLightRegistration`,
        'actor',
      ),
      lootEvents: boneyardLootEvents(
        source.lootEvents,
        `${field}.lootEvents`,
        runId,
        snapshotTick,
      ),
      mageLightningPulses: boneyardMageLightningPulseFrames(
        source.mageLightningPulses,
        `${field}.mageLightningPulses`,
        snapshotTick,
      ),
      runId,
      tutorial,
      waves,
    }
  }
  if (source.kind !== 'hub') throw new GameProtocolError(`${field}.kind is not supported`)
  onlyKeys(source, field, [
    'ambient',
    'collisionRngState',
    'entities',
    'kind',
    'memorial',
    'participants',
    'skorcha',
    'traderAnimationSeed',
  ])
  const rawParticipants = record(source.participants, `${field}.participants`)
  if (Object.keys(rawParticipants).length > MAX_PLAYERS) {
    throw new GameProtocolError(
      `${field}.participants may contain at most ${MAX_PLAYERS} entries`,
    )
  }
  const participants: Record<string, ProtocolHubParticipantState> = {}
  for (const [rawPlayerId, state] of Object.entries(rawParticipants)) {
    const playerId = validatedPlayerId(rawPlayerId, `${field} participant id`)
    participants[playerId] = hubParticipantState(
      state,
      `${field}.participants.${playerId}`,
    )
  }
  return {
    ambient: ambientState(source.ambient, `${field}.ambient`),
    collisionRngState: nonnegativeInteger(
      source.collisionRngState,
      `${field}.collisionRngState`,
    ),
    entities: replicatedEntityFrame(source.entities, `${field}.entities`),
    kind: 'hub',
    memorial: decodeHubMemorialState(source.memorial, `${field}.memorial`),
    participants,
    skorcha: hubSkorchaState(source.skorcha, `${field}.skorcha`),
    traderAnimationSeed: nonnegativeInteger(
      source.traderAnimationSeed,
      `${field}.traderAnimationSeed`,
    ),
  }
}

function hubSkorchaState(value: unknown, field: string): ProtocolHubSkorchaState | null {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'dismissalIndex',
    'gesture',
    'gestureTicksRemaining',
    'hatFrame',
    'position',
    'variant',
  ])
  return {
    dismissalIndex: integerWithin(source.dismissalIndex, `${field}.dismissalIndex`, 0, 2) as 0 | 1 | 2,
    gesture: integerWithin(source.gesture, `${field}.gesture`, 0, 2) as 0 | 1 | 2,
    gestureTicksRemaining: integerWithin(
      source.gestureTicksRemaining,
      `${field}.gestureTicksRemaining`,
      1,
      29,
    ),
    hatFrame: integerWithin(source.hatFrame, `${field}.hatFrame`, 0, 4) as 0 | 1 | 2 | 3 | 4,
    position: vector(source.position, `${field}.position`),
    variant: integerWithin(source.variant, `${field}.variant`, 0, 2) as 0 | 1 | 2,
  }
}

function replicatedEntityFrame(value: unknown, field: string): ReplicatedEntityFrame {
  const source = record(value, field)
  onlyKeys(source, field, [
    'baselineSequence',
    'keyframe',
    'retired',
    'samples',
    'spawned',
  ])
  const keyframe = boolean(source.keyframe, `${field}.keyframe`)
  const baselineSequence = nonnegativeInteger(
    source.baselineSequence,
    `${field}.baselineSequence`,
  )
  if (keyframe && baselineSequence !== 0) {
    throw new GameProtocolError(`${field}.baselineSequence must be zero for a keyframe`)
  }
  return {
    baselineSequence,
    keyframe,
    retired: uniqueEntityEntries(
      source.retired,
      `${field}.retired`,
      'key',
    ) as unknown as readonly ReplicatedEntityKey[],
    samples: uniqueEntityEntries(
      source.samples,
      `${field}.samples`,
      'sample',
    ) as unknown as readonly ReplicatedEntitySample[],
    spawned: uniqueEntityEntries(
      source.spawned,
      `${field}.spawned`,
      'descriptor',
    ) as unknown as readonly ReplicatedEntityDescriptor[],
  }
}

function uniqueEntityEntries(
  value: unknown,
  field: string,
  kind: 'descriptor' | 'key' | 'sample',
): readonly number[][] {
  const entries = limitedArray(value, field, MAX_REPLICATED_ENTITIES)
  const result: number[][] = []
  const keys = new Set<string>()
  for (let index = 0; index < entries.length; index += 1) {
    const entryField = `${field}[${index}]`
    const raw = limitedArray(entries[index], entryField, MAX_REPLICATED_COMPONENTS)
    if (raw.length < 2 || (kind === 'key' && raw.length !== 2)) {
      throw new GameProtocolError(`${entryField} has an invalid component count`)
    }
    const typeId = nonnegativeInteger(raw[0], `${entryField}[0]`)
    const entityId = nonnegativeInteger(raw[1], `${entryField}[1]`)
    const registration = REPLICATED_ENTITY_TYPE_REGISTRY.get(typeId)
    if (!registration) {
      throw new GameProtocolError(`${entryField} uses an unknown entity type`)
    }
    const key = `${typeId}:${entityId}`
    if (keys.has(key)) throw new GameProtocolError(`${entryField} duplicates ${key}`)
    keys.add(key)
    const decoded: [number, number, ...number[]] = [
      typeId,
      entityId,
      ...raw.slice(2).map((component, componentIndex) => finite(
        component,
        `${entryField}[${componentIndex + 2}]`,
      )),
    ]
    if (
      (kind === 'descriptor' && !registration.descriptorIsValid(decoded))
      || (kind === 'sample' && !registration.sampleIsValid(decoded))
    ) throw new GameProtocolError(`${entryField} has an invalid registered ${kind} shape`)
    result.push(decoded)
  }
  return result
}

function validateParticipantOwnership(
  participants: Readonly<Record<string, ProtocolHubParticipantState>>,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
  field: string,
): void {
  const participantIds = Object.keys(participants).sort()
  const playerIds = Object.keys(players).sort()
  if (
    participantIds.length !== playerIds.length
    || participantIds.some((id, index) => id !== playerIds[index])
  ) {
    throw new GameProtocolError(
      `${field}.world.participants must match ${field}.players exactly`,
    )
  }
}

function boneyardGateLeafSnapshot(
  value: unknown,
  field: string,
): BoneyardGateLeafSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, ['fenceEid', 'hinge', 'id', 'side', 'tip'])
  const side = nonnegativeInteger(source.side, `${field}.side`)
  if (side !== 0 && side !== 1) {
    throw new GameProtocolError(`${field}.side must be 0 or 1`)
  }
  return {
    fenceEid: limitedString(source.fenceEid, `${field}.fenceEid`, 128),
    hinge: boneyardPoint(source.hinge, `${field}.hinge`),
    id: limitedString(source.id, `${field}.id`, 256),
    side,
    tip: boneyardPoint(source.tip, `${field}.tip`),
  }
}

function playerCharacterKernelParameters(
  value: unknown,
): PlayerCharacterKernelParameters {
  const source = record(value, 'kernelParameters')
  onlyKeys(source, 'kernelParameters', [
    'fixedTickSeconds',
    'movementAcceleration',
    'movementLaneCap',
    'movementRetention',
    'movementThresholdSquared',
    'playerRadius',
  ])
  return {
    fixedTickSeconds: positiveFinite(
      source.fixedTickSeconds,
      'kernelParameters.fixedTickSeconds',
    ),
    movementAcceleration: positiveFinite(
      source.movementAcceleration,
      'kernelParameters.movementAcceleration',
    ),
    movementLaneCap: positiveFinite(
      source.movementLaneCap,
      'kernelParameters.movementLaneCap',
    ),
    movementRetention: positiveFinite(
      source.movementRetention,
      'kernelParameters.movementRetention',
    ),
    movementThresholdSquared: positiveFinite(
      source.movementThresholdSquared,
      'kernelParameters.movementThresholdSquared',
    ),
    playerRadius: positiveFinite(
      source.playerRadius,
      'kernelParameters.playerRadius',
    ),
  }
}

function contentManifest(value: unknown): GameContentManifest {
  const source = record(value, 'content')
  return {
    manifestSha256: sha256(source.manifestSha256, 'content.manifestSha256'),
    mods: limitedArray(source.mods, 'content.mods', MAX_CONTENT_MODS).map(
      (entry, index) => {
        const mod = record(entry, `content.mods[${index}]`)
        return {
          id: limitedString(mod.id, `content.mods[${index}].id`, 128),
          version: limitedString(mod.version, `content.mods[${index}].version`, 64),
          contentSha256: sha256(
            mod.contentSha256,
            `content.mods[${index}].contentSha256`,
          ),
        }
      },
    ),
  }
}

function gameModAssets(value: unknown): readonly GameModAsset[] {
  const seen = new Set<string>()
  return limitedArray(value, 'modAssets', 8_192).map((value, index) => {
    const field = `modAssets[${index}]`
    const source = record(value, field)
    onlyKeys(source, field, ['byteLength', 'contentType', 'kind', 'modId', 'path', 'sha256'])
    const contentType = limitedString(source.contentType, `${field}.contentType`, 128)
    const kind = limitedString(source.kind, `${field}.kind`, 64)
    const modId = limitedString(source.modId, `${field}.modId`, 128)
    const path = limitedString(source.path, `${field}.path`, 240)
    const byteLength = integerWithin(
      source.byteLength,
      `${field}.byteLength`,
      1,
      16 * 1024 * 1024,
    )
    const key = `${modId.toLowerCase()}\0${path.toLowerCase()}`
    if (
      !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(modId)
      || !/^(?:sprites|art|audio|levels|scenes)\/.+\.(?:boneyard|bundle|json|mp3|ogg|png|wav)$/.test(path)
      || seen.has(key)
    ) throw new GameProtocolError(`${field} is not a bounded unique typed asset`)
    seen.add(key)
    return {
      byteLength,
      contentType,
      kind,
      modId,
      path,
      sha256: sha256(source.sha256, `${field}.sha256`),
    }
  })
}

function modContentProjection(value: Record<string, unknown>): ModContentProjection {
  const contentIds = new Set<string>()
  const contentKinds = new Map<string, ModContentKind>()
  const content = limitedArray(value.content, 'content', 4_096).map((value, index) => {
    const field = `content[${index}]`
    const source = record(value, field)
    onlyKeys(source, field, [
      'art', 'contentId', 'contentKind', 'description', 'key', 'modId', 'name', 'presentation',
    ])
    const contentId = limitedString(source.contentId, `${field}.contentId`, 19)
    const contentKind = limitedString(source.contentKind, `${field}.contentKind`, 32)
    const modId = limitedString(source.modId, `${field}.modId`, 128)
    const key = limitedString(source.key, `${field}.key`, 128)
    if (
      !/^[1-9][0-9]{0,18}$/.test(contentId)
      || !(MOD_CONTENT_KINDS as readonly string[]).includes(contentKind)
      || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(modId)
      || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(key)
      || contentIds.has(contentId)
    ) throw new GameProtocolError(`${field} is invalid`)
    contentIds.add(contentId)
    contentKinds.set(contentId, contentKind as ModContentKind)
    const slots = new Set<string>()
    const art = limitedArray(source.art, `${field}.art`, 32).map((value, artIndex) => {
      const artField = `${field}.art[${artIndex}]`
      const art = record(value, artField)
      onlyKeys(art, artField, ['path', 'slot'])
      const slot = limitedString(art.slot, `${artField}.slot`, 64)
      const path = limitedString(art.path, `${artField}.path`, 240)
      if (slots.has(slot) || !/^(?:art|audio|levels|scenes|sprites)\/.+/.test(path)) {
        throw new GameProtocolError(`${artField} is invalid`)
      }
      slots.add(slot)
      return {
        path,
        slot,
      }
    })
    return {
      art,
      contentId,
      contentKind: contentKind as ModContentKind,
      description: boundedString(source.description, `${field}.description`, 1_024),
      key,
      modId,
      name: limitedString(source.name, `${field}.name`, 128),
      presentation: source.presentation === null
        ? null
        : limitedString(source.presentation, `${field}.presentation`, 64),
    }
  })
  const instanceIds = new Set<number>()
  const powerups = limitedArray(value.powerups, 'powerups', 1_024).map((value, index) => {
    const field = `powerups[${index}]`
    const source = record(value, field)
    onlyKeys(source, field, ['contentId', 'id', 'spawnedTick', 'x', 'y'])
    const contentId = limitedString(source.contentId, `${field}.contentId`, 19)
    const id = positiveInteger(source.id, `${field}.id`)
    if (contentKinds.get(contentId) !== 'powerup' || instanceIds.has(id)) {
      throw new GameProtocolError(`${field} is invalid`)
    }
    instanceIds.add(id)
    return {
      contentId,
      id,
      spawnedTick: nonnegativeInteger(source.spawnedTick, `${field}.spawnedTick`),
      x: finite(source.x, `${field}.x`),
      y: finite(source.y, `${field}.y`),
    }
  })
  instanceIds.clear()
  const statuses = limitedArray(value.statuses, 'statuses', 4_096).map((value, index) => {
    const field = `statuses[${index}]`
    const source = record(value, field)
    onlyKeys(source, field, [
      'contentId', 'expiresTick', 'instanceId', 'startedTick', 'targetId',
    ])
    const contentId = limitedString(source.contentId, `${field}.contentId`, 19)
    const instanceId = positiveInteger(source.instanceId, `${field}.instanceId`)
    const startedTick = nonnegativeInteger(source.startedTick, `${field}.startedTick`)
    const expiresTick = positiveInteger(source.expiresTick, `${field}.expiresTick`)
    if (!contentIds.has(contentId) || instanceIds.has(instanceId) || expiresTick <= startedTick) {
      throw new GameProtocolError(`${field} is invalid`)
    }
    instanceIds.add(instanceId)
    return {
      contentId,
      expiresTick,
      instanceId,
      startedTick,
      targetId: validatedPlayerId(source.targetId, `${field}.targetId`),
    }
  })
  return {
    content,
    manifestSha256: sha256(value.manifestSha256, 'manifestSha256'),
    powerups,
    revision: nonnegativeInteger(value.revision, 'revision'),
    statuses,
  }
}

function modConsumableCatalog(
  value: unknown,
  field: string,
): readonly ModConsumableCatalogEntry[] {
  const ids = new Set<string>()
  return limitedArray(value, field, 256).map((value, index) => {
    const itemField = `${field}[${index}]`
    const source = record(value, itemField)
    onlyKeys(source, itemField, ['content', 'name', 'nativeSubtype'])
    const content = modConsumableContent(source.content, `${itemField}.content`)
    if (ids.has(content.contentId)) {
      throw new GameProtocolError(`${field} duplicates content id ${content.contentId}`)
    }
    ids.add(content.contentId)
    return {
      content,
      name: limitedString(source.name, `${itemField}.name`, 128),
      nativeSubtype: boundedInteger(
        source.nativeSubtype,
        `${itemField}.nativeSubtype`,
        6,
        261,
      ),
    }
  })
}

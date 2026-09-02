import type {
  BoneyardGateLeafSnapshot,
} from '../core-kernels/boneyard.ts'
import type { BoneyardArenaTransitionState } from '../core-kernels/boneyard-arena-transition.ts'
import type {
  BoneyardSolomonDigEvent,
  BoneyardSolomonPhase,
  BoneyardSolomonVoiceEvent,
} from '../core-kernels/boneyard-encounter.ts'
import type {
  BoneyardWaveDirectorPhase,
  NativeSlumpgutPhase,
} from '../core-kernels/boneyard-wave-director.ts'
import type {
  PlayerCharacterConfig,
  PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import type { PlayerLifeState } from '../core-kernels/player-combat.ts'
import type {
  DowsingOffer,
  HagathaOffer,
  HubActionFeedback,
  HubEquipmentState,
  HubInventoryItem,
  HubShopItem,
  NativeUnforgeBonuses,
} from '../core-kernels/hub-economy.ts'
import type {
  HubParticipantState,
} from '../core-kernels/hub-regions.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type {
  PrimarySpellProjectileState,
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import type { NativeWorldManagerRegistration } from '../core-kernels/native-world-manager-order.ts'
import type { NativeSecondarySimulationState } from '../core-kernels/native-secondary-abilities.ts'
import type { NativeEnemyWorldFeedbackKernelState } from '../core-kernels/native-enemy-world-feedback.ts'
import type { GameRunLifecycleState } from '../core-kernels/game-run.ts'
import type {
  NativeWeldComponentRanks,
  PlayerLevelUpBarrierState,
} from '../core-kernels/player-progression.ts'
import type { NativeHagathaRuntimeState } from '../core-kernels/native-hagatha-effects.ts'
import type { PlayerBeltComponent } from '../core-kernels/native-belt.ts'
import type { NativeSkeletonHeadFacingOffset } from '../core-kernels/boneyard-skeleton-family-animation.ts'
import type { PrimarySpellWaterHailFrameRows } from './primary-spell-hail-frame.ts'
import type { ReplicatedEntityFrame } from './replicated-entity-types.ts'
import type { NativeTutorialState } from '../core-kernels/native-tutorial.ts'
import type { NativeHubNpcState } from '../core-kernels/native-hub-npc.ts'
import type { HubMemorialState } from '../core-kernels/hub-memorial.ts'

export interface ProtocolFountainParticleState {
  id: number
  remaining: number
  scale: number
}

export interface ProtocolAmbientState {
  fountainParticles: readonly ProtocolFountainParticleState[]
  nextFountainParticleId: number
  rngState: number
  sealCorePhase: number
  sealGlyphPhase: number
  statuePhaseDegrees: number
  teacherTick: number
  teacherWorldRelease: {
    painterRegistrations: readonly NativeWorldManagerRegistration[]
    releaseIndex: number
  } | null
}

export interface ProtocolPlayerState extends PlayerCharacterState {
  belt: PlayerBeltComponent
  config: PlayerCharacterConfig
  economy: ProtocolPlayerEconomy
  lighting: ProtocolPlayerLighting
  movementScale: number
  progression: ProtocolPlayerProgression
}

export type ProtocolPlayerSnapshotFrame = Omit<ProtocolPlayerState, 'economy'> & {
  economy?: ProtocolPlayerEconomy
}

export interface ProtocolPlayerEconomy {
  actionFeedback: HubActionFeedback | null
  backpack: readonly HubInventoryItem[]
  charmCapacity: number
  collegeIntroPending: boolean
  dowsingFee: number
  dowsingOffers: readonly DowsingOffer[]
  equipment: HubEquipmentState
  fomentiusStock: readonly HubShopItem[]
  gold: number
  hagathaOffers: readonly HagathaOffer[]
  npc: NativeHubNpcState
  ownedPerkSelectors: readonly number[]
  revision: number
  storage: readonly HubInventoryItem[]
  tonicPurchases: number
  tutorialPending: boolean
  unforgeBonuses: NativeUnforgeBonuses
}

export interface ProtocolPlayerLighting {
  deathWeaponPainterRegistration: NativeWorldManagerRegistration | null
  driveActive: boolean
  lightRegistration: NativeWorldManagerRegistration
  overlayEffectPhase: number
}

export interface ProtocolPlayerSkillOfferOption {
  insight?: true
  skillId: number
  targetRank: number
  weldBuildId?: number
}

export interface ProtocolPlayerSkillOffer {
  automaticChoiceIndex?: number
  level: number
  options: readonly ProtocolPlayerSkillOfferOption[]
  sequence: number
}

export interface ProtocolPlayerInventoryStats {
  castSpeedPercent: number
  magicResistancePercent: number
  manaRecoveryPerSecond: number
  painResistancePercent: number
  poisonResistancePercent: number
  primarySpell: ProtocolPlayerPrimarySpellStats
  walkSpeedPercent: number
}

export interface ProtocolPlayerPrimarySpellStats {
  damageMaximum: number
  damageMinimum: number
  manaCost: number
}

export interface ProtocolPlayerProgression {
  advancedUnlocks: readonly boolean[]
  coldSlowTicksRemaining: number
  concentrationSkillIds: readonly [number | null, number | null]
  currentHealth: number
  currentMana: number
  damageX4TicksRemaining: number
  deferredSkillChoices: number
  deathEpoch: number
  deathTick: number
  dazzleTicksRemaining: number
  experience: number
  hagathaRuntime: NativeHagathaRuntimeState
  inventoryStats: ProtocolPlayerInventoryStats
  learnedSkills: readonly (readonly [number, number, number])[]
  learnedSkillOrder: readonly number[]
  level: number
  maximumHealth: number
  maximumMana: number
  mindChugTicksRemaining: number
  lifeState: PlayerLifeState
  lastDamageTick: number | null
  nextThreshold: number
  pendingOffer: ProtocolPlayerSkillOffer | null
  poisonDamagePerTick: number
  poisonTicksRemaining: number
  previousThreshold: number
  revision: number
  secondaryManaCosts: readonly (readonly [number, number])[]
  selectedPrimarySkillId: number
  sorcerorsCharmAvailable: boolean
  splitMind: boolean
  weldBuildId: number | null
  weldComponentRanks: NativeWeldComponentRanks | null
}

export type NativeSecondarySnapshotState = Omit<
  NativeSecondarySimulationState,
  'firewalkerGeometrySequence' | 'rng'
>

export interface ProtocolStudentProp {
  angle: number
  paletteIndex: number
  radius: number
}

export interface ProtocolStudentState {
  framePhase: number
  gaitDegrees: number
  heading: number
  headingIndex: number
  id: number
  painterRegistration: NativeWorldManagerRegistration
  position: Vector2
  props: readonly ProtocolStudentProp[]
  reading: boolean
  scale: number
}

export interface ProtocolHubSkorchaState {
  dismissalIndex: 0 | 1 | 2
  gesture: 0 | 1 | 2
  gestureTicksRemaining: number
  hatFrame: 0 | 1 | 2 | 3 | 4
  position: Vector2
  variant: 0 | 1 | 2
}

export const HUB_PLAYER_ACTIVITIES = ['paused', 'occupied'] as const
export type HubPlayerActivity = typeof HUB_PLAYER_ACTIVITIES[number]

/**
 * Ephemeral Website multiplayer presence projected beside the native Hub
 * participant state. It is deliberately absent from the simulation and save
 * shapes owned by HubParticipantState.
 */
export interface ProtocolHubParticipantState extends HubParticipantState {
  activity: HubPlayerActivity | null
}

export interface HubWorldSnapshot {
  ambient: ProtocolAmbientState
  collisionRngState: number
  kind: 'hub'
  memorial: HubMemorialState
  participants: Readonly<Record<string, ProtocolHubParticipantState>>
  skorcha: ProtocolHubSkorchaState | null
  students: readonly ProtocolStudentState[]
  traderAnimationSeed: number
}

export interface BoneyardWorldSnapshot {
  arenaTransition: BoneyardArenaTransitionState | null
  deathEffects: readonly BoneyardEnemyDeathEffectSnapshot[]
  encounter: BoneyardSolomonSnapshot | null
  enemies: readonly BoneyardEnemySnapshot[]
  enemyEvents: readonly BoneyardEnemyEventSnapshot[]
  enemyWorldFeedback: NativeEnemyWorldFeedbackKernelState
  enemyProjectileEffects: readonly BoneyardEnemyProjectileEffectSnapshot[]
  enemyProjectiles: readonly BoneyardEnemyProjectileSnapshot[]
  mageLightningPulses: readonly BoneyardMageLightningPulseSnapshot[]
  maggots: readonly BoneyardMaggotSnapshot[]
  gateLeaves: readonly BoneyardGateLeafSnapshot[]
  goodies: readonly BoneyardGoodieSnapshot[]
  hallOfFameRuns: Readonly<Record<string, NativeHallOfFameRunSnapshot>>
  kind: 'boneyard'
  lanternLightRegistration: NativeWorldManagerRegistration | null
  loot: readonly BoneyardLootSnapshot[]
  lootEvents: readonly BoneyardLootEventSnapshot[]
  runId: string
  solomonPainterRegistration: NativeWorldManagerRegistration | null
  tutorial: NativeTutorialState | null
  waves: BoneyardWaveSnapshot | null
}

export interface NativeHallOfFameRunSnapshot {
  awesomeness: number
  awesomestKill: string | null
  elapsedTicks: number | null
  monstersKilled: number
  portraitHeadingIndex: number | null
  portraitScale: number | null
}

export const BONEYARD_LOOT_KINDS = ['bonus', 'gold', 'orb', 'sack'] as const
export const BONEYARD_LOOT_SOURCES = ['enemy', 'goodie', 'script'] as const
export const BONEYARD_LOOT_SOUNDS = [
  'drop-bag-1',
  'drop-bag-2',
  'drop-coins',
  'drop-potion',
  'goto-orb',
  'pickup-bag',
  'pickup-coin',
] as const
export const BONEYARD_LOOT_EVENT_TYPES = [
  'goodie-key-needed',
  'goodie-phase',
  'loot-drop-sound',
  'loot-pickup',
] as const

export interface BoneyardLootSnapshot {
  activationDelayTicks: number
  ageTicks: number
  alpha: number
  amount: number
  animationPhase: number
  bonusKind: 0 | 1 | 2 | null
  bounceHeight: number
  framePhase: number
  id: number
  itemContentId: string | null
  itemNativeSubtype: number | null
  itemNativeTypeId: number | null
  kind: typeof BONEYARD_LOOT_KINDS[number]
  nativeTypeId: 2011 | 2012 | 2013 | 2038
  orbKind: 'health' | 'mana' | null
  orbValue: number
  painterRegistration: NativeWorldManagerRegistration
  position: Vector2
  rotationDeg: number
  scatterActive: boolean
  scatterProgress: number
  scatterSeed: number
  source: typeof BONEYARD_LOOT_SOURCES[number]
  spawnTick: number
  tier: number
}

export interface BoneyardGoodieSnapshot {
  active: boolean
  exhausted: boolean
  id: number
  phase: 0 | 1 | 2
  position: Vector2
  sceneryRegistrationOrdinal: number
  subtype: number
  timer: number
}

export interface BoneyardLootEventSnapshot {
  actorId: number
  eventId: number
  goodieId?: number
  phase?: 0 | 1 | 2
  playbackRate?: number
  playerId?: string
  position: Vector2
  runId: string
  sound?: typeof BONEYARD_LOOT_SOUNDS[number]
  text?: string
  tick: number
  type: typeof BONEYARD_LOOT_EVENT_TYPES[number]
}

export const BONEYARD_ENEMY_DEATH_EFFECT_KINDS = [
  'banish',
  'bouncer',
  'smoky-bouncer',
  'fade',
  'fade-additive',
  'fade-perspective',
  'fade-perspective-clipped',
  'fade-scale',
  'fire-array',
  'late-splat',
  'move-fade',
  'sprite-array',
  'unbind',
] as const

export const BONEYARD_ENEMY_DEATH_EFFECT_PRESENTATION_OWNERS = [
  'direct-post-world',
  'pre-world-queue',
  'world-sorted',
] as const

export interface BoneyardEnemyDeathEffectSnapshot {
  ageTicks: number
  alpha: number
  atlas: 'BadGuys' | 'DeadHawg' | 'Demon'
  blendMode: 'add' | 'normal'
  entry: number
  height: number
  id: number
  kind: typeof BONEYARD_ENEMY_DEATH_EFFECT_KINDS[number]
  ownerActorId: number
  painterRegistration: NativeWorldManagerRegistration | null
  presentationOwner: typeof BONEYARD_ENEMY_DEATH_EFFECT_PRESENTATION_OWNERS[number]
  position: Vector2
  rotationRadians: number
  scale: number
  shadow: boolean
  spawnTick: number
  tint: number
}

export type BoneyardMageLightningContactSnapshot =
  | {
      kind: 'target-attached'
      localOffset: Vector2
      targetPlayerId: string
    }
  | {
      kind: 'world'
      position: Vector2
    }

export interface BoneyardMageLightningPulseSnapshot {
  contact: BoneyardMageLightningContactSnapshot
  endpoint: Vector2
  id: number
  midpoint: Vector2
  ownerActorId: number
  painterRegistrations: readonly NativeWorldManagerRegistration[]
  seed: number
  source: Vector2
  tick: number
}

export type BoneyardMageLightningPulseFrame = readonly [
  id: number,
  ownerActorId: number,
  tick: number,
  seed: number,
  sourceX: number,
  sourceY: number,
  midpointX: number,
  midpointY: number,
  endpointX: number,
  endpointY: number,
  contactKind: 0 | 1,
  contactX: number,
  contactY: number,
  targetPlayerId: string | null,
  bodyRegistrationOrdinal: number,
  sourceRegistrationOrdinal: number,
  contactRegistrationOrdinal: number,
]

export const BONEYARD_ENEMY_EVENT_TYPES = [
  'attack-marker',
  'coffin-maggot-release',
  'enemy-action-sound',
  'enemy-damage-sound',
  'player-damage-sound',
  'enemy-death',
  'enemy-death-sound',
  'enemy-retired',
  'enemy-spawned',
  'enemy-terminal-output',
  'projectile-impact',
  'projectile-retired',
  'projectile-spawned',
  'reward',
] as const

export const BONEYARD_ENEMY_ACTION_SOUNDS = [
  'bite-1',
  'bite-2',
  'bite-3',
  'imp-vocal-1',
  'imp-vocal-2',
  'imp-vocal-3',
  'imp-vocal-4',
  'imp-vocal-5',
  'imp-vocal-6',
  'imp-vocal-7',
  'imp-vocal-8',
  'fireball-hit',
  'portal-open',
  'shoot-arrow',
] as const

export const BONEYARD_ENEMY_DAMAGE_SOUNDS = [
  'bone-crack',
  'hit-shield',
  'pop-shield',
  'portal-hurt',
  'zombie-ouch',
] as const

export const BONEYARD_ENEMY_DEATH_SOUNDS = [
  'banshee-die',
  'coffin-break',
  'demon-die',
  'firey-death',
  'flash',
  'imp-split',
  'maggot-squeak-1',
  'maggot-squeak-2',
  'maggot-squish-1',
  'maggot-squish-2',
  'maggot-squish-3',
  'portal-die',
  'skeleton-die',
  'zombie-die',
  'zombie-die-groan',
  'zombie-poison-splat',
] as const

export const BONEYARD_PLAYER_DAMAGE_SOUNDS = [
  'wizard-ouch-1',
  'wizard-ouch-2',
  'wizard-ouch-3',
] as const

export const BONEYARD_ENEMY_SOUNDS = [
  ...BONEYARD_ENEMY_ACTION_SOUNDS,
  ...BONEYARD_ENEMY_DAMAGE_SOUNDS,
  ...BONEYARD_ENEMY_DEATH_SOUNDS,
] as const

export const BONEYARD_COMBAT_SOUNDS = [
  ...BONEYARD_ENEMY_SOUNDS,
  ...BONEYARD_PLAYER_DAMAGE_SOUNDS,
] as const

export const BONEYARD_ENEMY_TERMINAL_OUTPUTS = [
  'archer-shatter',
  'coffin-break',
  'demon-split',
  'imp-split',
  'mage-shatter',
  'portal-break',
  'skeleton-shatter',
  'wraith-fragments',
  'zombie-collapse',
] as const

export type BoneyardEnemyEventType = typeof BONEYARD_ENEMY_EVENT_TYPES[number]
export type BoneyardEnemyActionSound = typeof BONEYARD_ENEMY_ACTION_SOUNDS[number]
export type BoneyardEnemyDamageSound = typeof BONEYARD_ENEMY_DAMAGE_SOUNDS[number]
export type BoneyardEnemyDeathSound = typeof BONEYARD_ENEMY_DEATH_SOUNDS[number]
export type BoneyardPlayerDamageSound = typeof BONEYARD_PLAYER_DAMAGE_SOUNDS[number]
export type BoneyardCombatSound = typeof BONEYARD_COMBAT_SOUNDS[number]
export type BoneyardEnemyTerminalOutput = typeof BONEYARD_ENEMY_TERMINAL_OUTPUTS[number]

export interface BoneyardEnemyEventSnapshot {
  actorId: number
  count?: number
  deflectPitch?: number
  eventId: number
  gainScale?: number
  output?: BoneyardEnemyTerminalOutput
  painterRegistration?: NativeWorldManagerRegistration
  pitch?: number
  projectileId?: number
  runId: string
  sound?: BoneyardCombatSound
  sourcePosition?: Vector2
  targetPlayerId?: string | null
  tick: number
  type: BoneyardEnemyEventType
}

export type BoneyardEnemyProjectileKind =
  | 'arrow'
  | 'demon-bomb'
  | 'firebolt'
  | 'guided-missile'
  | 'poison-pool'

export const BONEYARD_ENEMY_PROJECTILE_PAYLOADS = [
  'cold',
  'fire',
  'none',
  'normal',
  'poison',
] as const

export type BoneyardEnemyProjectilePayload =
  typeof BONEYARD_ENEMY_PROJECTILE_PAYLOADS[number]

export interface BoneyardEnemyProjectileSnapshot {
  ageTicks: number
  contactRadius: number
  headingDeg: number
  homing: boolean
  id: number
  kind: BoneyardEnemyProjectileKind
  lightRegistration: NativeWorldManagerRegistration | null
  lifetimeTicks: number
  nativeTypeId: 0x7da | 0x7eb | 0x7ec | 0x7f7 | 0x806
  ownerActorId: number
  painterRegistration: NativeWorldManagerRegistration
  payload: BoneyardEnemyProjectilePayload
  position: Vector2
  speed: number
  spawnTick: number
  verticalOffset: number
  visualPhaseDeg: number
  visualScale: number
}

export const BONEYARD_ENEMY_PROJECTILE_EFFECT_KINDS = [
  'arrow-tumble',
  'demon-fire',
  'fire-burst-frame',
  'fire-burst-glow',
  'firebolt-trail',
  'guided-impact-aura-one',
  'guided-impact-aura-two',
  'guided-impact-main',
  'poison-pool-fade-inner',
  'poison-pool-fade-outer',
] as const

export type BoneyardEnemyProjectileEffectKind =
  typeof BONEYARD_ENEMY_PROJECTILE_EFFECT_KINDS[number]

export const BONEYARD_ENEMY_PROJECTILE_EFFECT_ALPHA_MAXIMUMS: Readonly<
  Record<BoneyardEnemyProjectileEffectKind, number>
> = Object.freeze({
  'arrow-tumble': 6,
  'demon-fire': 1,
  'fire-burst-frame': 1,
  'fire-burst-glow': 0.5,
  'firebolt-trail': 1,
  'guided-impact-aura-one': 2,
  'guided-impact-aura-two': 2,
  'guided-impact-main': 2,
  'poison-pool-fade-inner': 1,
  'poison-pool-fade-outer': 0.5,
})

export interface BoneyardEnemyProjectileEffectSnapshot {
  ageTicks: number
  alpha: number
  atlas: 'BadGuys' | 'DeadHawg'
  blendMode: 'add' | 'normal'
  entry: number
  id: number
  kind: BoneyardEnemyProjectileEffectKind
  lightRegistration: NativeWorldManagerRegistration | null
  lifetimeTicks: number
  ownerActorId: number
  ownerProjectileId: number
  painterRegistration: NativeWorldManagerRegistration
  phaseOriginTicks: number
  position: Vector2
  rotationRadians: number
  scale: number
  spawnTick: number
  tint: number
}

export const BONEYARD_MAGGOT_LAUNCH_TRAJECTORIES = ['edge', 'lid'] as const
export const BONEYARD_MAGGOT_STATES = ['bite', 'crawl', 'death', 'emerging'] as const

export interface BoneyardMaggotSnapshot {
  alpha: number
  currentHealth: number
  deathEpoch: number
  deathTick: number
  emergencePhase: number
  headingDeg: number
  hitFlash: number
  id: number
  emergenceTick: number
  emergenceOrientation: number
  launchTrajectory: typeof BONEYARD_MAGGOT_LAUNCH_TRAJECTORIES[number]
  lightRegistration: NativeWorldManagerRegistration
  maximumHealth: number
  ownerCoffinActorId: number
  pose: number
  position: Vector2
  spawnTick: number
  state: typeof BONEYARD_MAGGOT_STATES[number]
  verticalOffset: number
  visualScale: number
}

export type BoneyardEnemyAnimationState = 'idle' | 'locomotion' | 'action' | 'death'
export type BoneyardEnemyAction =
  | 'skeleton-claw-a'
  | 'skeleton-claw-b'
  | 'skeleton-weapon'
  | 'skeleton-pike'
  | 'archer-shot'
  | 'mage-cast-short'
  | 'mage-cast-long'
  | 'zombie-beat'
  | 'wraith-drain'
  | 'demon-bomb'
export type BoneyardEnemyCoffinState =
  | 'hidden'
  | 'closed'
  | 'opening'
  | 'transition-delay'
  | 'open'

export interface BoneyardEnemyAnimationSnapshot {
  action: BoneyardEnemyAction | null
  actionProgress: number
  alpha: number
  bodyPose: number
  coffinPose: number
  coffinRotationRadians: number
  coffinScaleX: -1 | 1
  coffinSecondaryPose: number | null
  coffinState: BoneyardEnemyCoffinState
  deathEpoch: number
  deathTick: number
  demonFrontExtremityOffset: Vector2
  demonFrontRotationRadians: number
  demonRearExtremityOffset: Vector2
  demonRearRotationRadians: number
  effects: readonly BoneyardEnemyEffectSnapshot[]
  gaitPose: number
  headFacingOffset: NativeSkeletonHeadFacingOffset
  hitFlash: number
  impBodyRotationRadians: number
  impEffectAlpha: number
  impEffectFrame: number
  maggots: readonly []
  state: BoneyardEnemyAnimationState
  stridePhaseDeg: number
  verticalOffset: number
  zombieAngularOffsetDeg: number
  zombieAttackSide: 0 | 1
  zombieBodyRotationRadians: number
  zombieBodyType: number
  zombieFrontArmPose: number
  zombieFrontArmRotationRadians: number
  zombieHeadType: number
  zombieHeadRotationRadians: number
  zombieRearArmPose: number
  zombieRearArmRotationRadians: number
}

export const BONEYARD_ENEMY_EFFECT_ROLES = [
  'magic-shield',
] as const

export type BoneyardEnemyEffectRole = typeof BONEYARD_ENEMY_EFFECT_ROLES[number]

export interface BoneyardEnemyEffectSnapshot {
  alpha: number
  atlas: 'BadGuys' | 'DeadHawg'
  blendMode: 'add' | 'normal'
  entry: number
  id: number
  offset: Vector2
  role: BoneyardEnemyEffectRole
  rotationRadians: number
  scale: number
}

export interface BoneyardEnemyLightingSnapshot {
  charge: number
  glow: number
  providerCopies: 0 | 1 | 2
}

export interface BoneyardEnemySnapshot {
  animation: BoneyardEnemyAnimationSnapshot
  armored: boolean
  currentHealth: number
  enemyToken: 'SKELETON' | 'SKELETONARCHER' | 'SKELETONMAGE' | 'IMP' | 'ZOMBIE' | 'WRAITH' | 'DEMON' | 'COFFIN' | 'PORTAL'
  flags: readonly string[]
  headingDeg: number
  id: number
  lightRegistration: NativeWorldManagerRegistration
  lighting: BoneyardEnemyLightingSnapshot
  mageCloak: boolean
  maximumHealth: number
  nativeTypeId: number
  position: Vector2
  scale: number
  shieldHealth: number
  shieldMaximumHealth: number
  spawnTick: number
}

export interface BoneyardSolomonSnapshot {
  acceleration: number
  digBodyOffsetY: number
  digEvents: readonly BoneyardSolomonDigEvent[]
  digFrame: number
  escapeSpeed: number
  headingDeg: number
  lifetimeTicksRemaining: number
  mouthPose: number
  mouthPoseTicksRemaining: number
  motion: number
  phase: BoneyardSolomonPhase
  phaseTicksRemaining: number
  position: Vector2
  runEventId: number
  targetPlayerId: string | null
  transitionOffsetY: number
  turnRate: number
  voiceEvents: readonly BoneyardSolomonVoiceEvent[]
  voiceTicksRemaining: number
  walkCycle: number
}

export interface BoneyardWaveSnapshot {
  interwaveDelayTicks: number
  pendingSpawnBudget: number
  phase: BoneyardWaveDirectorPhase
  scheduleIndex: number
  slumpgutPhase: NativeSlumpgutPhase
  slumpgutTicksRemaining: number
  spawnDelayTicks: number
  waveEventId: number
  waveOrdinal: number
}

export type GameWorldSnapshot = HubWorldSnapshot | BoneyardWorldSnapshot

export interface HubWorldSnapshotFrame {
  ambient: ProtocolAmbientState
  collisionRngState: number
  entities: ReplicatedEntityFrame
  kind: 'hub'
  memorial: HubMemorialState
  participants: Readonly<Record<string, ProtocolHubParticipantState>>
  skorcha: ProtocolHubSkorchaState | null
  traderAnimationSeed: number
}

export interface BoneyardWorldSnapshotFrame {
  arenaTransition: BoneyardArenaTransitionState | null
  encounter: BoneyardSolomonSnapshot | null
  entities: ReplicatedEntityFrame
  enemyEvents: readonly BoneyardEnemyEventSnapshot[]
  enemyWorldFeedback: NativeEnemyWorldFeedbackKernelState
  gateLeaves: readonly BoneyardGateLeafSnapshot[]
  hallOfFameRuns: Readonly<Record<string, NativeHallOfFameRunSnapshot>>
  kind: 'boneyard'
  lanternLightRegistration: NativeWorldManagerRegistration | null
  lootEvents: readonly BoneyardLootEventSnapshot[]
  mageLightningPulses: readonly BoneyardMageLightningPulseFrame[]
  runId: string
  solomonPainterRegistration: NativeWorldManagerRegistration | null
  tutorial: NativeTutorialState | null
  waves: BoneyardWaveSnapshot | null
}

export type GameWorldSnapshotFrame = HubWorldSnapshotFrame | BoneyardWorldSnapshotFrame

export type PrimarySpellNonHailTransientState = Exclude<
  PrimarySpellTransientState,
  { kind: 'water-hail' }
>

export interface PrimarySpellWaterHailFrameTable {
  ownerIds: readonly string[]
  rows: PrimarySpellWaterHailFrameRows
  worldKeys: readonly string[]
}

export interface PrimarySpellSimulationFrameState {
  hail: PrimarySpellWaterHailFrameTable
  nextId: number
  projectiles: readonly PrimarySpellProjectileState[]
  transients: readonly PrimarySpellNonHailTransientState[]
}

export interface GameSnapshot {
  hostPlayerId: string | null
  levelUpBarrier: PlayerLevelUpBarrierState | null
  materializingPlayerIds: readonly string[]
  modEffects: readonly ProtocolModEffect[]
  players: Readonly<Record<string, ProtocolPlayerState>>
  primarySpells: PrimarySpellSimulationState
  secondaryAbilities: NativeSecondarySnapshotState
  run: GameRunLifecycleState
  tick: number
  world: GameWorldSnapshot
}

export type GameClientSnapshot = Omit<GameSnapshot, 'primarySpells'> & {
  primarySpells: PrimarySpellSimulationFrameState
}

export interface GameSnapshotFrame {
  hostPlayerId: string | null
  levelUpBarrier: PlayerLevelUpBarrierState | null
  materializingPlayerIds: readonly string[]
  modEffects: readonly ProtocolModEffect[]
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>
  primarySpells: PrimarySpellSimulationFrameState
  secondaryAbilities: NativeSecondarySnapshotState
  run: GameRunLifecycleState
  tick: number
  world: GameWorldSnapshotFrame
}

export interface ProtocolModEffect {
  color: readonly [number, number, number, number]
  contentId: string
  expiresTick: number
  playerId: string
  startedTick: number
  useId: number
}

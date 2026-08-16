import type {
  BoneyardGateLeafSnapshot,
} from '../core-kernels/boneyard.ts'
import type {
  BoneyardSolomonPhase,
  BoneyardSolomonVoiceEvent,
} from '../core-kernels/boneyard-encounter.ts'
import type {
  BoneyardWaveDirectorPhase,
} from '../core-kernels/boneyard-wave-director.ts'
import type {
  PlayerCharacterConfig,
  PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import type { PlayerLifeState } from '../core-kernels/player-combat.ts'
import type {
  DowsingOffer,
  HagathaOffer,
  HubEquipmentState,
  HubInventoryItem,
  HubShopItem,
} from '../core-kernels/hub-economy.ts'
import type {
  HubParticipantState,
} from '../core-kernels/hub-regions.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type { PrimarySpellSimulationState } from '../core-kernels/primary-spells.ts'
import type { NativeLightProviderRegistration } from '../core-kernels/native-light-provider-order.ts'
import type { GameRunLifecycleState } from '../core-kernels/game-run.ts'
import type { PlayerLevelUpBarrierState } from '../core-kernels/player-progression.ts'
import type { ReplicatedEntityFrame } from './replicated-entity-types.ts'

export interface ProtocolFountainParticleState {
  id: number
  remaining: number
  scale: number
}

export interface ProtocolAmbientState {
  fountainParticles: readonly ProtocolFountainParticleState[]
  markerPhaseDegrees: number
  nextFountainParticleId: number
  rngState: number
  sealCorePhase: number
  sealGlyphPhase: number
  statuePhaseDegrees: number
}

export interface ProtocolPlayerState extends PlayerCharacterState {
  config: PlayerCharacterConfig
  economy: ProtocolPlayerEconomy
  lighting: ProtocolPlayerLighting
  progression: ProtocolPlayerProgression
}

export type ProtocolPlayerSnapshotFrame = Omit<ProtocolPlayerState, 'economy'> & {
  economy?: ProtocolPlayerEconomy
}

export interface ProtocolPlayerEconomy {
  backpack: readonly HubInventoryItem[]
  charmCapacity: number
  dowsingFee: number
  dowsingOffers: readonly DowsingOffer[]
  equipment: HubEquipmentState
  fomentiusStock: readonly HubShopItem[]
  gold: number
  hagathaOffers: readonly HagathaOffer[]
  ownedPerkSelectors: readonly number[]
  revision: number
  storage: readonly HubInventoryItem[]
  tonicPurchases: number
}

export interface ProtocolPlayerLighting {
  driveActive: boolean
  lightRegistration: NativeLightProviderRegistration
  overlayEffectPhase: number
}

export interface ProtocolPlayerSkillOfferOption {
  skillId: number
  targetRank: number
  weldBuildId?: number
}

export interface ProtocolPlayerSkillOffer {
  level: number
  options: readonly ProtocolPlayerSkillOfferOption[]
  sequence: number
}

export interface ProtocolPlayerProgression {
  activeWeldBuildId: number | null
  coldSlowTicksRemaining: number
  currentHealth: number
  currentMana: number
  deferredSkillChoices: number
  deathEpoch: number
  deathTick: number
  dazzleTicksRemaining: number
  experience: number
  learnedSkills: readonly (readonly [number, number, number])[]
  level: number
  maximumHealth: number
  maximumMana: number
  lifeState: PlayerLifeState
  nextThreshold: number
  pendingOffer: ProtocolPlayerSkillOffer | null
  poisonDamagePerTick: number
  poisonTicksRemaining: number
  previousThreshold: number
  revision: number
  sorcerorsCharmAvailable: boolean
}

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
  position: Vector2
  props: readonly ProtocolStudentProp[]
  reading: boolean
  scale: number
}

export interface HubWorldSnapshot {
  ambient: ProtocolAmbientState
  collisionRngState: number
  kind: 'hub'
  participants: Readonly<Record<string, HubParticipantState>>
  students: readonly ProtocolStudentState[]
  traderAnimationSeed: number
}

export interface BoneyardWorldSnapshot {
  deathEffects: readonly BoneyardEnemyDeathEffectSnapshot[]
  encounter: BoneyardSolomonSnapshot | null
  enemies: readonly BoneyardEnemySnapshot[]
  enemyEvents: readonly BoneyardEnemyEventSnapshot[]
  enemyProjectileEffects: readonly BoneyardEnemyProjectileEffectSnapshot[]
  enemyProjectiles: readonly BoneyardEnemyProjectileSnapshot[]
  mageLightningPulses: readonly BoneyardMageLightningPulseSnapshot[]
  maggots: readonly BoneyardMaggotSnapshot[]
  gateLeaves: readonly BoneyardGateLeafSnapshot[]
  kind: 'boneyard'
  lanternLightRegistration: NativeLightProviderRegistration | null
  runId: string
  waves: BoneyardWaveSnapshot | null
}

export const BONEYARD_ENEMY_DEATH_EFFECT_KINDS = [
  'banish',
  'bouncer',
  'fade',
  'move-fade',
  'sprite-array',
  'unbind',
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
]

export const BONEYARD_ENEMY_EVENT_TYPES = [
  'attack-marker',
  'coffin-maggot-release',
  'enemy-damage-sound',
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

export const BONEYARD_ENEMY_DAMAGE_SOUNDS = [
  'bone-crack',
  'hit-shield',
  'pop-shield',
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
  'skeleton-die',
  'zombie-die',
  'zombie-die-groan',
  'zombie-poison-splat',
] as const

export const BONEYARD_ENEMY_SOUNDS = [
  ...BONEYARD_ENEMY_DAMAGE_SOUNDS,
  ...BONEYARD_ENEMY_DEATH_SOUNDS,
] as const

export const BONEYARD_ENEMY_TERMINAL_OUTPUTS = [
  'archer-shatter',
  'coffin-break',
  'demon-split',
  'imp-split',
  'mage-shatter',
  'skeleton-shatter',
  'wraith-fragments',
  'zombie-collapse',
] as const

export type BoneyardEnemyEventType = typeof BONEYARD_ENEMY_EVENT_TYPES[number]
export type BoneyardEnemyDamageSound = typeof BONEYARD_ENEMY_DAMAGE_SOUNDS[number]
export type BoneyardEnemyDeathSound = typeof BONEYARD_ENEMY_DEATH_SOUNDS[number]
export type BoneyardEnemySound = typeof BONEYARD_ENEMY_SOUNDS[number]
export type BoneyardEnemyTerminalOutput = typeof BONEYARD_ENEMY_TERMINAL_OUTPUTS[number]

export interface BoneyardEnemyEventSnapshot {
  actorId: number
  count?: number
  eventId: number
  gainScale?: number
  output?: BoneyardEnemyTerminalOutput
  pitch?: number
  projectileId?: number
  runId: string
  sound?: BoneyardEnemySound
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
  lightRegistration: NativeLightProviderRegistration | null
  lifetimeTicks: number
  nativeTypeId: 0x7da | 0x7eb | 0x7ec | 0x7f7 | 0x806
  ownerActorId: number
  payload: BoneyardEnemyProjectilePayload
  position: Vector2
  speed: number
  spawnTick: number
  verticalOffset: number
  visualPhaseDeg: number
  visualScale: number
}

export const BONEYARD_ENEMY_PROJECTILE_EFFECT_KINDS = [
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

export interface BoneyardEnemyProjectileEffectSnapshot {
  ageTicks: number
  alpha: number
  atlas: 'BadGuys' | 'DeadHawg'
  blendMode: 'add' | 'normal'
  entry: number
  id: number
  kind: typeof BONEYARD_ENEMY_PROJECTILE_EFFECT_KINDS[number]
  lifetimeTicks: number
  ownerActorId: number
  ownerProjectileId: number
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
  headingDeg: number
  hitFlash: number
  id: number
  emergenceTick: number
  emergenceOrientation: number
  launchTrajectory: typeof BONEYARD_MAGGOT_LAUNCH_TRAJECTORIES[number]
  maximumHealth: number
  ownerCoffinActorId: number
  pose: number
  position: Vector2
  spawnTick: number
  state: typeof BONEYARD_MAGGOT_STATES[number]
  verticalOffset: number
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
  | 'imp-contact'
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
  coffinSecondaryPose: number | null
  coffinState: BoneyardEnemyCoffinState
  deathEpoch: number
  deathTick: number
  demonFrontJointRotationRadians: number
  demonFrontLimbRotationRadians: number
  demonRearJointRotationRadians: number
  demonRearLimbRotationRadians: number
  effects: readonly BoneyardEnemyEffectSnapshot[]
  gaitPose: number
  hitFlash: number
  impBodyRotationRadians: number
  impEffectAlpha: number
  impEffectFrame: number
  maggots: readonly []
  state: BoneyardEnemyAnimationState
  verticalOffset: number
  zombieAngularOffsetDeg: number
  zombieAttackSide: 0 | 1
  zombieBodyRotationRadians: number
  zombieBodyType: number
  zombieFlyblownSide: number
  zombieFrontArmPose: number
  zombieFrontArmRotationRadians: number
  zombieHeadType: number
  zombieHeadRotationRadians: number
  zombieRearArmPose: number
  zombieRearArmRotationRadians: number
}

export const BONEYARD_ENEMY_EFFECT_ROLES = [
  'burning-fire',
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
  enemyToken: 'SKELETON' | 'SKELETONARCHER' | 'SKELETONMAGE' | 'IMP' | 'ZOMBIE' | 'WRAITH' | 'DEMON' | 'COFFIN'
  flags: readonly string[]
  headingDeg: number
  id: number
  lightRegistration: NativeLightProviderRegistration | null
  lighting: BoneyardEnemyLightingSnapshot
  maximumHealth: number
  nativeTypeId: number
  position: Vector2
  shieldHealth: number
  shieldMaximumHealth: number
  spawnTick: number
}

export interface BoneyardSolomonSnapshot {
  acceleration: number
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
  participants: Readonly<Record<string, HubParticipantState>>
  traderAnimationSeed: number
}

export interface BoneyardWorldSnapshotFrame {
  encounter: BoneyardSolomonSnapshot | null
  entities: ReplicatedEntityFrame
  enemyEvents: readonly BoneyardEnemyEventSnapshot[]
  gateLeaves: readonly BoneyardGateLeafSnapshot[]
  kind: 'boneyard'
  lanternLightRegistration: NativeLightProviderRegistration | null
  mageLightningPulses: readonly BoneyardMageLightningPulseFrame[]
  runId: string
  waves: BoneyardWaveSnapshot | null
}

export type GameWorldSnapshotFrame = HubWorldSnapshotFrame | BoneyardWorldSnapshotFrame

export interface GameSnapshot {
  hostPlayerId: string | null
  levelUpBarrier: PlayerLevelUpBarrierState | null
  players: Readonly<Record<string, ProtocolPlayerState>>
  primarySpells: PrimarySpellSimulationState
  run: GameRunLifecycleState
  tick: number
  world: GameWorldSnapshot
}

export interface GameSnapshotFrame {
  hostPlayerId: string | null
  levelUpBarrier: PlayerLevelUpBarrierState | null
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>
  primarySpells: PrimarySpellSimulationState
  run: GameRunLifecycleState
  tick: number
  world: GameWorldSnapshotFrame
}

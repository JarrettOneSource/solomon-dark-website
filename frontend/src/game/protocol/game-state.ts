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
  HubParticipantState,
} from '../core-kernels/hub-regions.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type { PrimarySpellSimulationState } from '../core-kernels/primary-spells.ts'
import type { GameRunLifecycleState } from '../core-kernels/game-run.ts'
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
  progression: ProtocolPlayerProgression
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
}

export interface BoneyardWorldSnapshot {
  encounter: BoneyardSolomonSnapshot | null
  enemies: readonly BoneyardEnemySnapshot[]
  enemyEvents: readonly BoneyardEnemyEventSnapshot[]
  enemyProjectiles: readonly BoneyardEnemyProjectileSnapshot[]
  maggots: readonly BoneyardMaggotSnapshot[]
  gateLeaves: readonly BoneyardGateLeafSnapshot[]
  kind: 'boneyard'
  runId: string
  waves: BoneyardWaveSnapshot | null
}

export const BONEYARD_ENEMY_EVENT_TYPES = [
  'attack-marker',
  'coffin-maggot-release',
  'enemy-death',
  'enemy-retired',
  'enemy-spawned',
  'enemy-terminal-output',
  'mage-lightning',
  'projectile-impact',
  'projectile-retired',
  'projectile-spawned',
  'reward',
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
export type BoneyardEnemyTerminalOutput = typeof BONEYARD_ENEMY_TERMINAL_OUTPUTS[number]

export interface BoneyardEnemyEventSnapshot {
  actorId: number
  count?: number
  eventId: number
  output?: BoneyardEnemyTerminalOutput
  projectileId?: number
  runId: string
  sourcePosition?: Vector2
  targetPosition?: Vector2
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
  lifetimeTicks: number
  nativeTypeId: 0x7da | 0x7eb | 0x7ec | 0x7f7 | 0x806
  ownerActorId: number
  payload: BoneyardEnemyProjectilePayload
  position: Vector2
  spawnTick: number
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
  | 'zombie-swipe'
  | 'wraith-drain'
  | 'demon-claw'
  | 'demon-bomb'
  | 'coffin-open'
  | 'maggot-bite'
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
  impEffectFrame: number
  maggots: readonly []
  state: BoneyardEnemyAnimationState
  verticalOffset: number
  zombieAngularOffsetDeg: number
  zombieFrontArmPose: number
  zombieFrontArmRotationRadians: number
  zombieRearArmPose: number
  zombieRearArmRotationRadians: number
}

export const BONEYARD_ENEMY_EFFECT_ROLES = [
  'burning-fire',
  'mage-lightning-source',
  'mage-lightning-target',
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

export interface BoneyardEnemySnapshot {
  animation: BoneyardEnemyAnimationSnapshot
  armored: boolean
  currentHealth: number
  enemyToken: 'SKELETON' | 'SKELETONARCHER' | 'SKELETONMAGE' | 'IMP' | 'ZOMBIE' | 'WRAITH' | 'DEMON' | 'COFFIN'
  flags: readonly string[]
  headingDeg: number
  id: number
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
}

export interface BoneyardWorldSnapshotFrame {
  encounter: BoneyardSolomonSnapshot | null
  entities: ReplicatedEntityFrame
  enemyEvents: readonly BoneyardEnemyEventSnapshot[]
  gateLeaves: readonly BoneyardGateLeafSnapshot[]
  kind: 'boneyard'
  runId: string
  waves: BoneyardWaveSnapshot | null
}

export type GameWorldSnapshotFrame = HubWorldSnapshotFrame | BoneyardWorldSnapshotFrame

export interface GameSnapshot {
  hostPlayerId: string | null
  players: Readonly<Record<string, ProtocolPlayerState>>
  primarySpells: PrimarySpellSimulationState
  run: GameRunLifecycleState
  tick: number
  world: GameWorldSnapshot
}

export interface GameSnapshotFrame {
  hostPlayerId: string | null
  players: Readonly<Record<string, ProtocolPlayerState>>
  primarySpells: PrimarySpellSimulationState
  run: GameRunLifecycleState
  tick: number
  world: GameWorldSnapshotFrame
}

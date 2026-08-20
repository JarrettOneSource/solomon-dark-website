import { actorHeadingFromVector } from '../core-kernels/actor-heading.ts'
import { NATIVE_ACTOR_SEPARATION_EPSILON } from '../core-kernels/actor-physics.ts'
import {
  createNativeImpFlightState,
  stepNativeImpFlight,
} from '../core-kernels/boneyard-imp-flight.ts'
import { NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM } from '../core-kernels/boneyard-zombie-beat.ts'
import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import type { NativeSecondaryTargetEffectState } from '../core-kernels/native-secondary-abilities.ts'
import type { NativeEnemyWorldFeedbackOutput } from '../core-kernels/native-enemy-world-feedback.ts'
import {
  createNativeRng,
  drawNativeInteger,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'
import type { BoneyardWaveEnemyToken } from '../core-kernels/boneyard-wave-schema.ts'
import {
  evaluateBoneyardEnemyConfig,
  type BoneyardEnemyArenaScalars,
  type BoneyardSkeletonWeapon,
  type EvaluatedBoneyardEnemyConfig,
} from '../core-kernels/boneyard-enemy-config.ts'
import {
  BOUNDED_ARCHER_RANGE_BANDS,
  BOUNDED_ENEMY_COLD_SLOW_TICKS,
  BOUNDED_ENEMY_POISON_DURATION_SECONDS,
  BOUNDED_MAGE_ALLY_SHIELD_RANGE,
  BOUNDED_MAGE_RANGE_BANDS,
  NATIVE_WRAITH_DAZZLE_TICKS,
  boundedArcherAimHeading,
  boundedMageShieldIntervalTicks,
  projectilePayloadForArrow,
  type BoneyardEnemyProjectilePayload,
} from '../core-kernels/boneyard-enemy-modifiers.ts'
import {
  NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES,
  NATIVE_MAGE_CAST_BODY_POSES,
  nativeMageBodyPose,
  nativeMageLightningDurationTicks,
  nativeMageLightningSource,
} from '../core-kernels/boneyard-mage-lightning.ts'
import {
  NATIVE_ARCHER_SHOT_BODY_POSES,
  NATIVE_SKELETON_CLAW_BODY_POSES,
  NATIVE_SKELETON_HEAD_FACING_OFFSETS,
  NATIVE_SKELETON_HEAD_TURN_ROLL_COUNT,
  NATIVE_SKELETON_HEAD_TURN_ROLL_WINNER,
  NATIVE_SKELETON_PIKE_BODY_POSES,
  NATIVE_SKELETON_WEAPON_BODY_POSES,
  nativeSkeletonFamilyBodyPose,
  type NativeSkeletonHeadFacingOffset,
} from '../core-kernels/boneyard-skeleton-family-animation.ts'
import {
  BONEYARD_WAVE_ENEMY_TYPES,
  type BoneyardEnemySpawnIntent,
} from '../core-kernels/boneyard-wave-director.ts'
import {
  nextBoneyardWaveRandom,
  randomBoneyardWaveInteger,
  seedBoneyardWaveRng,
} from '../core-kernels/boneyard-wave-timeline.ts'
import {
  createNativeLightProviderOrder,
  type NativeLightManagerLane,
  type NativeLightProviderRegistration,
  type RegisterNativeLightProvider,
} from '../core-kernels/native-light-provider-order.ts'

export type BoneyardEnemyActorId = number
export type BoneyardEnemyDeathEffectId = number
export type BoneyardEnemyProjectileId = number
export type BoneyardEnemyProjectileEffectId = number
export type BoneyardEnemyEventId = number
export type BoneyardMageLightningPulseId = number

export const NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS = 2
export const NATIVE_ENEMY_TARGET_REFRESH_TICKS = 25
export const NATIVE_ENEMY_MISSING_TARGET_REFRESH_TICKS = 3
export const NATIVE_ENEMY_HIT_LATCH_TICKS = 20
/** Named web presentation bound until family gait distance is closed natively. */
export const BOUNDED_ENEMY_GAIT_DISTANCE_PER_POSE = 2

const NATIVE_IMP_SPLIT_HEADING_OFFSETS = Object.freeze([-90, 90] as const)
export const NATIVE_IMP_SPLIT_CHILD_COUNT = NATIVE_IMP_SPLIT_HEADING_OFFSETS.length
export const NATIVE_IMP_SPLIT_LIVE_GUARD_MAXIMUM = 68
export const NATIVE_IMP_CONSTRUCTION_MAXIMUM = 70

export const NATIVE_SKELETON_ACTION_PROGRAMS = Object.freeze({
  claw: Object.freeze({ markerProgress: 4, progressPerTick: 0.125, strictEnd: 7 }),
  pike: Object.freeze({ markerProgress: 2, progressPerTick: 0.125, strictEnd: 12 }),
  weapon: Object.freeze({ markerProgress: 9, progressPerTick: 0.25, strictEnd: 24 }),
})

export const NATIVE_SKELETON_CLAW_MARKERS = Object.freeze([4, 8] as const)
export const NATIVE_SKELETON_WEAPON_MARKERS = Object.freeze([9, 20] as const)

export const NATIVE_ARCHER_ACTION_PROGRAM = Object.freeze({
  markerProgress: 13,
  progressPerTick: 0.0843750015,
  strictEnd: 16,
})

export const NATIVE_MAGE_ACTION_PROGRAMS = Object.freeze({
  long: Object.freeze({ markerProgress: 31, progressPerTick: 0.253125012, strictEnd: 47 }),
  short: Object.freeze({ markerProgress: 25, progressPerTick: 0.253125012, strictEnd: 41 }),
})

export const NATIVE_DEMON_BOMB_ACTION_PROGRAM = Object.freeze({
  markerProgress: 4,
  progressPerTick: 0.09375,
  strictEnd: 8,
})

/** Named deterministic web programs for families whose exact action clocks remain open. */
export const BOUNDED_ENEMY_ACTION_PROGRAMS = Object.freeze({
  impContact: Object.freeze({ cooldownTicks: 18, markerTick: 6, strictEndTick: 11 }),
  wraithDrain: Object.freeze({ cooldownTicks: 50, markerTick: 4, strictEndTick: 9 }),
})

/** Mod_Knockback magnitude is runtime-authored and remains open in the retail binary. */
export const BOUNDED_ZOMBIE_KNOCKBACK_DISTANCE = 10

/** Named center-distance bounds; native family attack reach remains unresolved. */
export const BOUNDED_ENEMY_ATTACK_REACH = Object.freeze({
  COFFIN: 0,
  DEMON: 180,
  IMP: 28,
  SKELETON: 36,
  SKELETONARCHER: 240,
  SKELETONMAGE: 220,
  WRAITH: 52,
  ZOMBIE: 48,
})

export const BOUNDED_ENEMY_DEATH_PROGRAM_TICKS = Object.freeze({
  COFFIN: 31,
  DEMON: 49,
  IMP: 19,
  SKELETON: 24,
  SKELETONARCHER: 24,
  SKELETONMAGE: 24,
  WRAITH: 36,
  ZOMBIE: 36,
})

/**
 * Contact geometry and the Arrow/Firebolt travel speeds remain named web
 * bounds. The recovered native lifetime and ownership clocks are exact.
 */
export const BOUNDED_ENEMY_PROJECTILE_PROGRAMS = Object.freeze({
  arrow: Object.freeze({ contactRadius: 8, homing: false, lifetimeTicks: 300, speed: 5 }),
  'demon-bomb': Object.freeze({ contactRadius: 35, homing: false, lifetimeTicks: 100, speed: 2 }),
  firebolt: Object.freeze({ contactRadius: 10, homing: false, lifetimeTicks: 400, speed: 4.5 }),
  'guided-missile': Object.freeze({ contactRadius: 12, homing: true, lifetimeTicks: 400, speed: 3 }),
  'poison-pool': Object.freeze({ contactRadius: 35, homing: false, lifetimeTicks: 3000, speed: 0 }),
})

export const NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS = Object.freeze({
  arrowInitialHeight: -25,
  demonBombBounceMultiplier: 0.85,
  demonBombDampingPerTick: 0.995,
  demonBombFireTicks: 500,
  demonBombGravityPerTick: 0.1,
  demonBombInitialBounceVelocity: -3,
  demonBombInitialHeight: -35,
  demonBombSettledCountdownMinimum: 100,
  demonBombSettledCountdownRandomCount: 101,
  demonBombSettledDampingPerTick: 0.98,
  demonBombSpeedMinimum: 2,
  demonBombSpeedRange: 1,
  fireBurstTicks: 16,
  fireboltTrailCadenceTicks: 2,
  guidedImpactAlphaLossPerTick: 0.1,
  guidedMinimumSpeedBase: 0.75,
  guidedMinimumSpeedRange: 0.45,
  guidedSpeedLossPerTick: 0.075,
  poisonPoolInitialScale: 1,
  poisonPoolAlphaLossPerTick: 0.005,
  poisonPoolGrowthPerTick: 0.025,
  poisonPoolMaximumScale: 1.6,
})

/** Retail Coffin opening calls its Maggot helper exactly three times. */
export const NATIVE_COFFIN_OPENING_MAGGOT_EMISSIONS = 3

/** Named web bounds until retail Coffin replenishment timing is closed. */
export const BOUNDED_COFFIN_MAGGOT_PROGRAM = Object.freeze({
  replenishmentEmissionCount: 1,
  replenishmentIntervalTicks: 50,
})

/** Named web bounds until retail Maggot launch and crawl kinematics are closed. */
export const BOUNDED_MAGGOT_PROGRAM = Object.freeze({
  attackDelayAfterEmergenceTicks: 10,
  attackReach: 18,
  bitePresentationTicks: 6,
  collisionRadius: 8,
  deathTicks: 12,
  emergenceTicks: 24,
  gaitDistancePerPose: 2,
  launchHeadingStepDeg: 137.5,
  launchTrajectories: Object.freeze({
    edge: Object.freeze({ horizontalStep: 1.75, originDistance: 12, verticalHeight: 12 }),
    lid: Object.freeze({ horizontalStep: 1.25, originDistance: 8, verticalHeight: 20 }),
  }),
  movementStep: 0.5,
  poisonDurationTicks: 10,
})

const NATIVE_WRAITH_RETREAT_MINIMUM_TICKS = 200
const NATIVE_WRAITH_RETREAT_RANDOM_COUNT = 601
const NATIVE_COFFIN_HIDDEN_SHORT_TICKS = 180
const NATIVE_COFFIN_HIDDEN_LONG_TICKS = 360
const NATIVE_COFFIN_RISE_TICKS = 10
const NATIVE_COFFIN_HOLD_MINIMUM_TICKS = 150
const NATIVE_COFFIN_HOLD_RANDOM_COUNT = 150
const NATIVE_COFFIN_OPEN_TICKS = 60
const NATIVE_ENEMY_BURN_GLOW_PER_TICK = 0.05
const NATIVE_ENEMY_CHARGE_PER_TICK = 0.02
const NATIVE_IMP_GLOW_PER_TICK = 0.01

interface ActionClock {
  readonly actionProgress: number
  readonly markerEmitted: boolean
}

export interface BoneyardSkeletonBrain extends ActionClock {
  readonly action: 'claw' | 'pike' | 'weapon'
  readonly contactTargetPlayerId: string | null
  readonly family: 'skeleton'
  readonly phase: 'approach' | 'attack' | 'death'
}

export interface BoneyardArcherBrain extends ActionClock {
  readonly aimRngState: number
  readonly family: 'archer'
  readonly phase: 'range-control' | 'attack' | 'death'
}

export interface BoneyardMageBrain extends ActionClock {
  readonly castProgram: 'long' | 'short'
  readonly castRoll: number
  readonly family: 'mage'
  readonly lightningTargetPlayerId: string | null
  readonly lightningTargetPosition: Readonly<BoneyardPoint> | null
  readonly lightningTicksRemaining: number
  readonly phase: 'range-control' | 'cast' | 'death'
  readonly shieldTicksRemaining: number
}

export interface BoneyardImpBrain {
  readonly actionTick: number
  readonly bodyRotationDeg: number
  readonly bodyVariant: number
  readonly contactTargetPlayerId: string | null
  readonly cooldownTicks: number
  readonly effectAlpha: number
  readonly effectPhase: number
  readonly family: 'imp'
  readonly markerEmitted: boolean
  readonly phase: 'flight' | 'contact' | 'cooldown' | 'death'
  readonly verticalOffset: number
  readonly verticalVelocity: number
  readonly visualRngState: number
}

export interface BoneyardZombieBrain {
  readonly actionProgress: number
  readonly actionRate: number
  readonly actionSwing: number
  readonly angularOffsetDeg: number
  readonly attackSide: 0 | 1
  readonly bodyPhaseDeg: number
  readonly bodyType: number
  readonly contactTargetPlayerId: string | null
  readonly family: 'zombie'
  readonly flyblownSide: 0 | 1
  readonly frontArmBaseRotationDeg: number
  readonly headBaseRotationDeg: number
  readonly headPhaseDeg: number
  readonly headType: number
  readonly impactStateTicksRemaining: number
  readonly markerEmitted: boolean
  readonly phase: 'approach' | 'swipe' | 'knockback' | 'death'
  readonly phaseTicksRemaining: number
  readonly rearArmBaseRotationDeg: number
  readonly verticalOffset: number
  readonly verticalVelocity: number
  readonly visualRngState: number
}

export interface BoneyardWraithBrain {
  readonly actionTick: number
  readonly contactTargetPlayerId: string | null
  readonly family: 'wraith'
  readonly markerEmitted: boolean
  readonly phase: 'approach' | 'orbit' | 'drain' | 'cooldown' | 'death'
  readonly phaseTicksRemaining: number
}

export interface BoneyardDemonBrain {
  readonly actionProgress: number
  readonly family: 'demon'
  readonly markerEmitted: boolean
  readonly phase: 'approach' | 'bomb' | 'death'
}

export interface BoneyardCoffinBrain {
  readonly family: 'coffin'
  readonly maggotsReleased: boolean
  readonly nextMaggotReplenishmentTick: number
  readonly phase: 'hidden' | 'rising' | 'holding' | 'opening' | 'open' | 'death'
  readonly phaseTick: number
  readonly phaseTicksRemaining: number
}

export type BoneyardEnemyBrain =
  | BoneyardArcherBrain
  | BoneyardCoffinBrain
  | BoneyardDemonBrain
  | BoneyardImpBrain
  | BoneyardMageBrain
  | BoneyardSkeletonBrain
  | BoneyardWraithBrain
  | BoneyardZombieBrain

export interface BoneyardEnemyLightingState {
  readonly charge: number
  readonly glow: number
  readonly providerCopies: 0 | 1 | 2
}

export interface BoneyardEnemyActor {
  readonly bodyPose: number
  readonly brain: BoneyardEnemyBrain
  readonly config: EvaluatedBoneyardEnemyConfig
  readonly currentHealth: number
  readonly deathEpoch: number | null
  readonly deathStartedTick: number | null
  readonly deathTick: number
  readonly gaitPose: number
  readonly headFacingOffset: NativeSkeletonHeadFacingOffset
  readonly headingDeg: number
  readonly id: BoneyardEnemyActorId
  readonly lastDamagedByPlayerId: string | null
  readonly lastDamageTick: number | null
  readonly lastMovementTick: number | null
  readonly lifeState: 'alive' | 'dying'
  readonly lightRegistration: NativeLightProviderRegistration
  readonly lighting: Readonly<BoneyardEnemyLightingState>
  readonly lootSeed: number
  readonly nextMovementTick: number
  readonly nextTargetRefreshTick: number
  readonly position: Readonly<BoneyardPoint>
  readonly rewardGranted: boolean
  readonly shieldHealth: number
  readonly shieldMaximumHealth: number
  readonly shieldPulse: number
  readonly shieldSoundCooldownTicks: number
  readonly sourceSpawnIntentId: number
  readonly spawnTick: number
  readonly targetPlayerId: string | null
  readonly terminalEmitted: boolean
  readonly waveOrdinal: number
}

export function nativeEnemyHitOverlay(
  lastDamageTick: number | null,
  tick: number,
): number {
  if (lastDamageTick === null) return 0
  return Math.max(
    0,
    1 - Math.max(0, tick - lastDamageTick) / NATIVE_ENEMY_HIT_LATCH_TICKS,
  )
}

export type BoneyardEnemyProjectileKind =
  | 'arrow'
  | 'demon-bomb'
  | 'firebolt'
  | 'guided-missile'
  | 'poison-pool'

export interface BoneyardEnemyProjectile {
  readonly ageTicks: number
  readonly bounceVelocity: number
  readonly coldSlowTicks: number
  readonly contactRadius: number
  readonly damage: number
  readonly headingDeg: number
  readonly hitPlayerIds: readonly string[]
  readonly homing: boolean
  readonly id: BoneyardEnemyProjectileId
  readonly kind: BoneyardEnemyProjectileKind
  readonly lastStepTick: number
  readonly lightRegistration: NativeLightProviderRegistration | null
  readonly lifetimeTicks: number
  readonly minimumSpeed: number
  readonly nativeTypeId: 0x7da | 0x7eb | 0x7ec | 0x7f7 | 0x806
  readonly ownerActorId: BoneyardEnemyActorId
  readonly payload: BoneyardEnemyProjectilePayload
  readonly poisonDamage: number
  readonly poisonDuration: number
  readonly position: Readonly<BoneyardPoint>
  readonly speed: number
  readonly settledTicksRemaining: number
  readonly spawnTick: number
  readonly targetPlayerId: string | null
  readonly verticalOffset: number
  readonly verticalVelocity: number
  readonly visualPhaseDeg: number
  readonly visualScale: number
}

export type BoneyardEnemyProjectileEffectKind =
  | 'demon-fire'
  | 'fire-burst-frame'
  | 'fire-burst-glow'
  | 'firebolt-trail'
  | 'guided-impact-aura-one'
  | 'guided-impact-aura-two'
  | 'guided-impact-main'
  | 'poison-pool-fade-inner'
  | 'poison-pool-fade-outer'

export interface BoneyardEnemyProjectileEffect {
  readonly ageTicks: number
  readonly alpha: number
  readonly alphaLossPerTick: number
  readonly angularVelocityDeg: number
  readonly atlas: 'BadGuys' | 'DeadHawg'
  readonly blendMode: 'add' | 'normal'
  readonly entry: number
  readonly id: BoneyardEnemyProjectileEffectId
  readonly kind: BoneyardEnemyProjectileEffectKind
  readonly lastStepTick: number
  readonly lifetimeTicks: number
  readonly ownerActorId: BoneyardEnemyActorId
  readonly ownerProjectileId: BoneyardEnemyProjectileId
  readonly phaseOriginTicks: number
  readonly position: Readonly<BoneyardPoint>
  readonly rotationDeg: number
  readonly scale: number
  readonly spawnTick: number
  readonly tint: number
  readonly velocity: Readonly<BoneyardPoint>
}

export interface BoneyardMaggotActor {
  readonly collisionRadius: number
  readonly currentHealth: number
  readonly deathOffsets: readonly Readonly<BoneyardPoint>[]
  readonly damage: number
  readonly deathEpoch: number | null
  readonly deathStartedTick: number | null
  readonly deathTick: number
  readonly gaitPose: number
  readonly headingDeg: number
  readonly id: BoneyardEnemyActorId
  readonly emergenceTick: number
  readonly launchTrajectory: 'edge' | 'lid'
  readonly launchVelocity: Readonly<BoneyardPoint>
  readonly lastAttackTick: number | null
  readonly lastDamagedByPlayerId: string | null
  readonly lastDamageTick: number | null
  readonly lastMovementTick: number | null
  readonly lifeState: 'alive' | 'dying'
  readonly lightRegistration: NativeLightProviderRegistration
  readonly maximumHealth: number
  readonly nextAttackTick: number
  readonly nextMovementTick: number
  readonly ownerCoffinActorId: BoneyardEnemyActorId
  readonly poisonDamage: number
  readonly poisonDuration: number
  readonly position: Readonly<BoneyardPoint>
  readonly movementPhase: 'crawl' | 'emerging'
  readonly spawnTick: number
  readonly targetPlayerId: string | null
  readonly terminalEmitted: boolean
}

export type BoneyardEnemyDeathEffectKind =
  | 'banish'
  | 'bouncer'
  | 'fade'
  | 'fire-array'
  | 'move-fade'
  | 'sprite-array'
  | 'unbind'

export interface BoneyardEnemyDeathEffect {
  readonly ageTicks: number
  readonly alpha: number
  readonly alphaLossPerTick: number
  readonly angularVelocityDeg: number
  readonly atlas: 'BadGuys' | 'DeadHawg' | 'Demon'
  readonly blendMode: 'add' | 'normal'
  readonly bounceVelocity: number
  readonly entry: number
  readonly firstEntry: number
  readonly frameCount: number
  readonly frameTicks: number
  readonly height: number
  readonly id: BoneyardEnemyDeathEffectId
  readonly kind: BoneyardEnemyDeathEffectKind
  readonly lastStepTick: number
  readonly lifetimeTicks: number
  readonly ownerActorId: BoneyardEnemyActorId
  readonly opacityTimer: number
  readonly position: Readonly<BoneyardPoint>
  readonly role: string
  readonly rotationDeg: number
  readonly scale: number
  readonly shadow: boolean
  readonly spawnTick: number
  readonly tint: number
  readonly verticalVelocity: number
  readonly velocity: Readonly<BoneyardPoint>
}

export interface BoneyardMageLightningWorldContact {
  readonly kind: 'world'
  readonly position: Readonly<BoneyardPoint>
}

export interface BoneyardMageLightningTargetContact {
  readonly kind: 'target-attached'
  readonly localOffset: Readonly<BoneyardPoint>
  readonly targetPlayerId: string
}

export interface BoneyardMageLightningPulse {
  readonly contact: BoneyardMageLightningTargetContact | BoneyardMageLightningWorldContact
  readonly endpoint: Readonly<BoneyardPoint>
  readonly id: BoneyardMageLightningPulseId
  readonly midpoint: Readonly<BoneyardPoint>
  readonly ownerActorId: BoneyardEnemyActorId
  readonly seed: number
  readonly source: Readonly<BoneyardPoint>
  readonly tick: number
}

export type BoneyardEnemyTerminalOutput = NativeEnemyWorldFeedbackOutput

export type BoneyardEnemyDeathSound =
  | 'banshee-die'
  | 'coffin-break'
  | 'demon-die'
  | 'firey-death'
  | 'flash'
  | 'imp-split'
  | 'maggot-squeak-1'
  | 'maggot-squeak-2'
  | 'maggot-squish-1'
  | 'maggot-squish-2'
  | 'maggot-squish-3'
  | 'skeleton-die'
  | 'zombie-die'
  | 'zombie-die-groan'
  | 'zombie-poison-splat'

export type BoneyardEnemyDamageSound =
  | 'bone-crack'
  | 'hit-shield'
  | 'pop-shield'
  | 'zombie-ouch'

export type BoneyardPlayerDamageSound =
  | 'wizard-ouch-1'
  | 'wizard-ouch-2'
  | 'wizard-ouch-3'

export type BoneyardCombatSound =
  | BoneyardEnemyDamageSound
  | BoneyardEnemyDeathSound
  | BoneyardPlayerDamageSound

export type BoneyardEnemySemanticEventType =
  | 'attack-marker'
  | 'coffin-maggot-release'
  | 'enemy-death'
  | 'enemy-death-sound'
  | 'enemy-damage-sound'
  | 'player-damage-sound'
  | 'enemy-retired'
  | 'enemy-spawned'
  | 'enemy-terminal-output'
  | 'projectile-impact'
  | 'projectile-retired'
  | 'projectile-spawned'
  | 'reward'

export interface BoneyardEnemySemanticEvent {
  readonly actorId: BoneyardEnemyActorId
  readonly count?: number
  readonly deflectPitch?: number
  readonly eventId: BoneyardEnemyEventId
  readonly gainScale?: number
  readonly output?: BoneyardEnemyTerminalOutput
  readonly pitch?: number
  readonly projectileId?: BoneyardEnemyProjectileId
  readonly sound?: BoneyardCombatSound
  readonly sourcePosition?: Readonly<BoneyardPoint>
  readonly targetPlayerId?: string | null
  readonly tick: number
  readonly type: BoneyardEnemySemanticEventType
}

export interface BoneyardEnemyPlayerDamage {
  readonly actorId: BoneyardEnemyActorId
  readonly amount: number
  readonly coldSlowTicks: number
  readonly dazzleTicks: number
  readonly deflectable: boolean
  readonly damageKind: 'magic' | 'physical'
  readonly eventId: BoneyardEnemyEventId
  readonly poisonDamage: number
  readonly poisonDuration: number
  readonly playerId: string
}

export interface BoneyardEnemyPlayerKnockback {
  readonly actorId: BoneyardEnemyActorId
  readonly delta: Readonly<BoneyardPoint>
  readonly eventId: BoneyardEnemyEventId
  readonly playerId: string
}

export interface BoneyardEnemyReward {
  readonly actorId: BoneyardEnemyActorId
  readonly eventId: BoneyardEnemyEventId
  readonly experience: number
  readonly lootSource: BoneyardEnemyLootSource
  readonly playerId: string | null
}

export interface BoneyardEnemyLootSource {
  readonly actorSeed: number
  readonly enemyToken: EvaluatedBoneyardEnemyConfig['enemyToken']
  readonly participantSlot: 0
  readonly position: Readonly<BoneyardPoint>
}

export interface BoneyardEnemyRetirement {
  readonly actorId: BoneyardEnemyActorId
  readonly eventId: BoneyardEnemyEventId
}

export interface BoneyardEnemyStore {
  readonly actors: readonly BoneyardEnemyActor[]
  readonly deathEffects: readonly BoneyardEnemyDeathEffect[]
  readonly headFacingRngState: NativeRngState
  readonly lastStepTick: number
  readonly mageLightningPulses: readonly BoneyardMageLightningPulse[]
  readonly maggots: readonly BoneyardMaggotActor[]
  readonly nextActorId: BoneyardEnemyActorId
  readonly nextDeathEpoch: number
  readonly nextDeathEffectId: BoneyardEnemyDeathEffectId
  readonly nextEventId: BoneyardEnemyEventId
  readonly nextMageLightningPulseId: BoneyardMageLightningPulseId
  readonly nextProjectileId: BoneyardEnemyProjectileId
  readonly nextProjectileEffectId: BoneyardEnemyProjectileEffectId
  readonly nextSyntheticSpawnIntentId: number
  readonly projectiles: readonly BoneyardEnemyProjectile[]
  readonly projectileEffects: readonly BoneyardEnemyProjectileEffect[]
  readonly rngState: number
}

export interface BoneyardPlayerDamageSoundRequest {
  readonly actorId: BoneyardEnemyActorId
  readonly currentHealth: number
  readonly playerId: string
  readonly position: Readonly<BoneyardPoint>
  readonly tick: number
}

export interface BoneyardPlayerDamageSoundResult {
  readonly delayTicks: number
  readonly event: BoneyardEnemySemanticEvent
  readonly store: BoneyardEnemyStore
}

export interface BoneyardEnemyTargetCandidate {
  readonly alive: boolean
  readonly collisionRadius: number
  readonly connected: boolean
  readonly eligible: boolean
  readonly position: Readonly<BoneyardPoint>
  readonly velocityPerTick: Readonly<BoneyardPoint>
}

export type BoneyardEnemyTargets = Readonly<Record<string, BoneyardEnemyTargetCandidate>>

export interface BoneyardEnemyMovementRequest {
  readonly actorId: BoneyardEnemyActorId
  readonly delta: Readonly<BoneyardPoint>
  readonly position: Readonly<BoneyardPoint>
  readonly purpose: 'movement' | 'spawn-placement'
  readonly radius: number
  readonly requestedPosition: Readonly<BoneyardPoint>
}

export type ResolveBoneyardEnemyMovement = (
  request: BoneyardEnemyMovementRequest,
) => Readonly<BoneyardPoint>

export interface BoneyardEnemyProjectileWorldContactRequest {
  readonly end: Readonly<BoneyardPoint>
  readonly projectileId: BoneyardEnemyProjectileId
  readonly radius: number
  readonly start: Readonly<BoneyardPoint>
}

export type FirstBoneyardEnemyProjectileWorldContact = (
  request: BoneyardEnemyProjectileWorldContactRequest,
) => number | null

export interface BoneyardEnemySpellSegmentRequest {
  readonly end: Readonly<BoneyardPoint>
  readonly start: Readonly<BoneyardPoint>
}

export type ClipBoneyardEnemySpellSegment = (
  request: BoneyardEnemySpellSegmentRequest,
) => Readonly<BoneyardPoint>

export interface BoneyardEnemyLethalObserver {
  readonly onReward: (
    request: Readonly<{
      enemy: EvaluatedBoneyardEnemyConfig
      playerId: string | null
    }>,
  ) => void
}

export interface BoneyardEnemyRetirementObserver {
  readonly onTerminalOutput: (
    output: BoneyardEnemyTerminalOutput,
    outputCount: number | undefined,
  ) => void
}

export interface BoneyardEnemyStoreStepContext {
  readonly abilityEffects?: Readonly<Record<number, NativeSecondaryTargetEffectState>>
  readonly arenaScalars?: Partial<BoneyardEnemyArenaScalars>
  readonly clipSpellSegment?: ClipBoneyardEnemySpellSegment
  readonly firstProjectileWorldContact: FirstBoneyardEnemyProjectileWorldContact
  readonly players: BoneyardEnemyTargets
  readonly registerLightProvider?: RegisterNativeLightProvider
  readonly registerProjectileLightProvider?: RegisterNativeLightProvider
  readonly retirementObserver?: BoneyardEnemyRetirementObserver
  readonly rollLootSeed?: () => number
  readonly resolveMovement: ResolveBoneyardEnemyMovement
  readonly resolveSpawnIntents: (
    liveEnemyCount: number,
  ) => readonly BoneyardEnemySpawnIntent[]
  readonly tick: number
}

export interface BoneyardEnemyStoreStepResult {
  readonly events: readonly BoneyardEnemySemanticEvent[]
  readonly playerDamage: readonly BoneyardEnemyPlayerDamage[]
  readonly playerKnockbacks: readonly BoneyardEnemyPlayerKnockback[]
  readonly retired: readonly BoneyardEnemyRetirement[]
  readonly rewards: readonly BoneyardEnemyReward[]
  readonly spawnedActorIds: readonly BoneyardEnemyActorId[]
  readonly store: BoneyardEnemyStore
}

export interface DamageBoneyardEnemyRequest {
  readonly actorId: BoneyardEnemyActorId
  readonly amount: number
  readonly lethalObserver?: BoneyardEnemyLethalObserver
  readonly sourcePlayerId: string | null
  readonly tick: number
}

export interface DamageBoneyardEnemyResult {
  readonly accepted: boolean
  readonly events: readonly BoneyardEnemySemanticEvent[]
  readonly killed: boolean
  readonly store: BoneyardEnemyStore
}

interface DamagePresentationWork {
  deathEffects: BoneyardEnemyDeathEffect[]
  events: BoneyardEnemySemanticEvent[]
  nextDeathEffectId: number
  nextEventId: number
  rngState: number
}

interface WorkingStep {
  actors: BoneyardEnemyActor[]
  deathEffects: BoneyardEnemyDeathEffect[]
  events: BoneyardEnemySemanticEvent[]
  headFacingRngState: NativeRngState
  impActorCount: number
  mageLightningPulses: BoneyardMageLightningPulse[]
  maggots: BoneyardMaggotActor[]
  nextActorId: number
  nextDeathEpoch: number
  nextDeathEffectId: number
  nextEventId: number
  nextMageLightningPulseId: number
  nextProjectileId: number
  nextProjectileEffectId: number
  nextSyntheticSpawnIntentId: number
  playerDamage: BoneyardEnemyPlayerDamage[]
  playerKnockbacks: BoneyardEnemyPlayerKnockback[]
  projectiles: BoneyardEnemyProjectile[]
  projectileEffects: BoneyardEnemyProjectileEffect[]
  registerLightProvider: RegisterNativeLightProvider
  registerProjectileLightProvider: RegisterNativeLightProvider
  retired: BoneyardEnemyRetirement[]
  rewards: BoneyardEnemyReward[]
  rngState: number
  spawnedActorIds: number[]
}

interface ActionProgram {
  markerProgress: number
  progressPerTick: number
  strictEnd: number
}

interface DeathEffectOwner {
  readonly id: BoneyardEnemyActorId
  readonly position: Readonly<BoneyardPoint>
}

export function createBoneyardEnemyStore(seed: string): BoneyardEnemyStore {
  return {
    actors: [],
    deathEffects: [],
    headFacingRngState: createNativeRng(
      seedBoneyardWaveRng(`${seed}:skeleton-head-facing`),
    ),
    lastStepTick: -1,
    mageLightningPulses: [],
    maggots: [],
    nextActorId: 1,
    nextDeathEpoch: 1,
    nextDeathEffectId: 1,
    nextEventId: 1,
    nextMageLightningPulseId: 1,
    nextProjectileId: 1,
    nextProjectileEffectId: 1,
    nextSyntheticSpawnIntentId: 1,
    projectiles: [],
    projectileEffects: [],
    rngState: seedBoneyardWaveRng(`${seed}:enemy-actors`),
  }
}

export function emitBoneyardPlayerDamageSound(
  source: BoneyardEnemyStore,
  request: BoneyardPlayerDamageSoundRequest,
): BoneyardPlayerDamageSoundResult {
  const cue = randomBoneyardWaveInteger(source.rngState, 3)
  const delay = randomBoneyardWaveInteger(cue.state, 41)
  const sound = `wizard-ouch-${cue.value + 1}` as BoneyardPlayerDamageSound
  const event = Object.freeze({
    actorId: request.actorId,
    eventId: source.nextEventId,
    gainScale: wizardOuchGain(request.currentHealth),
    pitch: 1,
    sound,
    sourcePosition: Object.freeze({ ...request.position }),
    targetPlayerId: request.playerId,
    tick: request.tick,
    type: 'player-damage-sound' as const,
  })
  return {
    delayTicks: 20 + delay.value,
    event,
    store: {
      ...source,
      nextEventId: source.nextEventId + 1,
      rngState: delay.state,
    },
  }
}

export function nativeWizardOuchCooldownReady(
  tick: number,
  deadlineTick: number,
): boolean {
  return tick > deadlineTick
}

function wizardOuchGain(currentHealth: number): number {
  const healthScalar = Math.min(1, Math.max(0, (currentHealth - 25) / 20))
  return 0.25 + 0.75 * (1 - healthScalar)
}

function standaloneEnemyLightProviderOrderState(source: BoneyardEnemyStore) {
  const nextRegistrationOrdinal = { actor: 0, transient: 0 }
  for (const registration of [
    ...source.actors.map(({ lightRegistration }) => lightRegistration),
    ...source.maggots.map(({ lightRegistration }) => lightRegistration),
    ...source.projectiles.map(({ lightRegistration }) => lightRegistration),
  ]) {
    if (registration === null) continue
    nextRegistrationOrdinal[registration.managerLane] = Math.max(
      nextRegistrationOrdinal[registration.managerLane],
      registration.registrationOrdinal + 1,
    )
  }
  return { nextRegistrationOrdinal }
}

function enemyProjectileLightManagerLane(
  kind: BoneyardEnemyProjectileKind,
  payload: BoneyardEnemyProjectilePayload,
): NativeLightManagerLane | null {
  switch (kind) {
    case 'arrow': return payload === 'fire' ? 'transient' : null
    case 'firebolt': return 'transient'
    case 'demon-bomb':
    case 'guided-missile': return 'actor'
    case 'poison-pool': return null
  }
}

/** Includes every actor throughout its terminal presentation interval. */
export function boneyardEnemyLiveCount(source: BoneyardEnemyStore): number {
  return source.actors.length + source.maggots.length
}

export function damageBoneyardEnemy(
  source: BoneyardEnemyStore,
  request: DamageBoneyardEnemyRequest,
): DamageBoneyardEnemyResult {
  validateTick(request.tick)
  if (request.tick < source.lastStepTick) {
    throw new RangeError('enemy damage tick must not precede the store clock')
  }
  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    throw new RangeError('enemy damage must be finite and positive')
  }
  const index = source.actors.findIndex((actor) => actor.id === request.actorId)
  const actor = source.actors[index]
  if (!actor) return damageBoneyardMaggot(source, request)
  if (actor.lifeState !== 'alive') {
    return { accepted: false, events: [], killed: false, store: source }
  }

  const work: DamagePresentationWork = {
    deathEffects: [...source.deathEffects],
    events: [],
    nextDeathEffectId: source.nextDeathEffectId,
    nextEventId: source.nextEventId,
    rngState: source.rngState,
  }
  if (actor.shieldHealth > 0) {
    let shieldPulse = actor.shieldPulse
    let shieldSoundCooldownTicks = actor.shieldSoundCooldownTicks
    if (shieldSoundCooldownTicks <= 0) {
      emitDamageSound(
        work,
        actor,
        request.tick,
        'hit-shield',
        0.8 + drawDamageUnit(work) * 0.05,
      )
      shieldPulse = 2
      shieldSoundCooldownTicks = 10
    }
    const shieldHealth = Math.max(0, actor.shieldHealth - request.amount)
    const broke = shieldHealth === 0
    const nextActor: BoneyardEnemyActor = {
      ...actor,
      shieldHealth,
      shieldMaximumHealth: broke ? 0 : actor.shieldMaximumHealth,
      shieldPulse,
      shieldSoundCooldownTicks,
    }
    if (broke) {
      emitDamageSound(work, actor, request.tick, 'pop-shield', 0.8)
      spawnShieldBreakParticles(work, actor, request.tick)
    }
    const actors = [...source.actors]
    actors[index] = nextActor
    return finishDamage(source, actors, work, false)
  }

  const hurtSound = enemyHurtSound(actor)
  if (
    hurtSound !== null
    && (
      actor.lastDamageTick === null
      || request.tick - actor.lastDamageTick >= NATIVE_ENEMY_HIT_LATCH_TICKS
    )
  ) {
    emitDamageSound(
      work,
      actor,
      request.tick,
      hurtSound,
      0.9 + drawDamageUnit(work) * 0.2,
    )
  }

  const currentHealth = actor.currentHealth - request.amount
  const killed = currentHealth <= 0
  const nextActor: BoneyardEnemyActor = killed
    ? {
        ...actor,
        brain: deathBrain(actor.brain),
        currentHealth,
        deathEpoch: source.nextDeathEpoch,
        deathStartedTick: request.tick,
        deathTick: 0,
        lastDamagedByPlayerId: request.sourcePlayerId,
        lastDamageTick: request.tick,
        lifeState: 'dying',
        lighting: actor.config.enemyToken === 'SKELETONARCHER'
          ? {
              ...actor.lighting,
              charge: 0,
              providerCopies: 0,
            }
          : actor.lighting,
        shieldHealth: 0,
        shieldMaximumHealth: 0,
        shieldPulse: 0,
        shieldSoundCooldownTicks: 0,
      }
    : {
        ...actor,
        currentHealth,
        lastDamagedByPlayerId: request.sourcePlayerId,
        lastDamageTick: request.tick,
      }
  const actors = [...source.actors]
  actors[index] = nextActor
  if (killed) {
    request.lethalObserver?.onReward({
      enemy: actor.config,
      playerId: request.sourcePlayerId,
    })
  }
  return finishDamage(source, actors, work, killed)
}

function damageBoneyardMaggot(
  source: BoneyardEnemyStore,
  request: DamageBoneyardEnemyRequest,
): DamageBoneyardEnemyResult {
  const index = source.maggots.findIndex((maggot) => maggot.id === request.actorId)
  const maggot = source.maggots[index]
  if (!maggot || maggot.lifeState !== 'alive') {
    return { accepted: false, events: [], killed: false, store: source }
  }
  const currentHealth = maggot.currentHealth - request.amount
  const killed = currentHealth <= 0
  const nextMaggot: BoneyardMaggotActor = {
    ...maggot,
    currentHealth,
    deathEpoch: killed ? source.nextDeathEpoch : maggot.deathEpoch,
    deathStartedTick: killed ? request.tick : maggot.deathStartedTick,
    lastDamagedByPlayerId: request.sourcePlayerId,
    lastDamageTick: request.tick,
    lifeState: killed ? 'dying' : 'alive',
  }
  const maggots = [...source.maggots]
  maggots[index] = nextMaggot
  return {
    accepted: true,
    events: [],
    killed,
    store: {
      ...source,
      maggots,
      nextDeathEpoch: source.nextDeathEpoch + (killed ? 1 : 0),
    },
  }
}

function finishDamage(
  source: BoneyardEnemyStore,
  actors: readonly BoneyardEnemyActor[],
  work: DamagePresentationWork,
  killed: boolean,
): DamageBoneyardEnemyResult {
  return {
    accepted: true,
    events: Object.freeze(work.events),
    killed,
    store: {
      ...source,
      actors,
      deathEffects: work.deathEffects,
      nextDeathEpoch: source.nextDeathEpoch + (killed ? 1 : 0),
      nextDeathEffectId: work.nextDeathEffectId,
      nextEventId: work.nextEventId,
      rngState: work.rngState,
    },
  }
}

function enemyHurtSound(
  actor: BoneyardEnemyActor,
): BoneyardEnemyDamageSound | null {
  switch (actor.config.enemyToken) {
    case 'SKELETON':
    case 'SKELETONARCHER':
    case 'SKELETONMAGE':
      return 'bone-crack'
    case 'ZOMBIE':
      return 'zombie-ouch'
    case 'COFFIN':
    case 'DEMON':
    case 'IMP':
    case 'WRAITH':
      return null
  }
}

function emitDamageSound(
  work: DamagePresentationWork,
  actor: DeathEffectOwner,
  tick: number,
  sound: BoneyardEnemyDamageSound,
  pitch: number,
): void {
  work.events.push(Object.freeze({
    actorId: actor.id,
    eventId: work.nextEventId,
    gainScale: 1,
    pitch,
    sound,
    sourcePosition: Object.freeze({ ...actor.position }),
    tick,
    type: 'enemy-damage-sound',
  }))
  work.nextEventId += 1
}

function spawnShieldBreakParticles(
  work: DamagePresentationWork,
  actor: DeathEffectOwner,
  tick: number,
): void {
  for (let index = 0; index < 20; index += 1) {
    const rotationDeg = drawDamageUnit(work) * 360
    const alpha = 0.5 + drawDamageUnit(work) * 0.75
    const scale = 1.5 + drawDamageUnit(work) * 0.25
    work.deathEffects.push(Object.freeze({
      ageTicks: 0,
      alpha,
      alphaLossPerTick: 0.05,
      angularVelocityDeg: 0,
      atlas: 'BadGuys',
      blendMode: 'add',
      bounceVelocity: 0,
      entry: 69,
      firstEntry: 69,
      frameCount: 1,
      frameTicks: 1,
      height: 0,
      id: work.nextDeathEffectId,
      kind: 'fade',
      lastStepTick: tick,
      lifetimeTicks: Math.ceil(alpha / 0.05),
      opacityTimer: alpha,
      ownerActorId: actor.id,
      position: Object.freeze({ x: actor.position.x, y: actor.position.y - 30 }),
      role: 'shield-break-particle',
      rotationDeg,
      scale,
      shadow: false,
      spawnTick: tick,
      tint: 0xffffff,
      verticalVelocity: 0,
      velocity: Object.freeze({ x: 0, y: 0 }),
    }))
    work.nextDeathEffectId += 1
  }
}

function drawDamageUnit(work: DamagePresentationWork): number {
  const draw = nextBoneyardWaveRandom(work.rngState)
  work.rngState = draw.state
  return draw.value
}

export function stepBoneyardEnemyStore(
  source: BoneyardEnemyStore,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyStoreStepResult {
  validateTick(context.tick)
  if (context.tick <= source.lastStepTick) {
    throw new RangeError('enemy store ticks must advance monotonically')
  }
  const standaloneLightProviderOrder = createNativeLightProviderOrder(
    standaloneEnemyLightProviderOrderState(source),
  )
  const work: WorkingStep = {
    actors: [],
    deathEffects: [],
    events: [],
    headFacingRngState: source.headFacingRngState,
    impActorCount: source.actors.filter(({ config }) => config.enemyToken === 'IMP').length,
    mageLightningPulses: source.mageLightningPulses.filter((pulse) => (
      context.tick - pulse.tick < NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES
    )),
    maggots: [...source.maggots],
    nextActorId: source.nextActorId,
    nextDeathEpoch: source.nextDeathEpoch,
    nextDeathEffectId: source.nextDeathEffectId,
    nextEventId: source.nextEventId,
    nextMageLightningPulseId: source.nextMageLightningPulseId,
    nextProjectileId: source.nextProjectileId,
    nextProjectileEffectId: source.nextProjectileEffectId,
    nextSyntheticSpawnIntentId: source.nextSyntheticSpawnIntentId,
    playerDamage: [],
    playerKnockbacks: [],
    projectiles: [...source.projectiles],
    projectileEffects: [],
    registerLightProvider: context.registerLightProvider
      ?? standaloneLightProviderOrder.register,
    registerProjectileLightProvider: context.registerProjectileLightProvider
      ?? context.registerLightProvider
      ?? standaloneLightProviderOrder.register,
    retired: [],
    rewards: [],
    rngState: source.rngState,
    spawnedActorIds: [],
  }
  stepDeathEffects(work, source.deathEffects, context.tick)
  stepProjectileEffects(work, source.projectileEffects, context.tick)
  for (const actor of source.actors) {
    const timedActor = stepDamagePresentationTimers(
      actor,
      context.tick - source.lastStepTick,
    )
    const stepped = timedActor.lifeState === 'dying'
      ? stepDyingActor(work, timedActor, context)
      : stepLivingActor(work, timedActor, context)
    if (stepped) {
      work.actors.push(stepped)
    } else if (timedActor.config.enemyToken === 'IMP') {
      work.impActorCount -= 1
    }
  }
  stepMageShields(work, context)
  stepMaggots(work, context)
  stepProjectiles(work, context)
  const spawnIntents = context.resolveSpawnIntents(
    work.actors.length + work.maggots.length,
  )
  work.actors.push(...materializeSpawnIntents(work, context, spawnIntents))
  return {
    events: Object.freeze(work.events),
    playerDamage: Object.freeze(work.playerDamage),
    playerKnockbacks: Object.freeze(work.playerKnockbacks),
    retired: Object.freeze(work.retired),
    rewards: Object.freeze(work.rewards),
    spawnedActorIds: Object.freeze(work.spawnedActorIds),
    store: {
      actors: work.actors,
      deathEffects: work.deathEffects,
      headFacingRngState: work.headFacingRngState,
      lastStepTick: context.tick,
      mageLightningPulses: work.mageLightningPulses,
      maggots: work.maggots,
      nextActorId: work.nextActorId,
      nextDeathEpoch: work.nextDeathEpoch,
      nextDeathEffectId: work.nextDeathEffectId,
      nextEventId: work.nextEventId,
      nextMageLightningPulseId: work.nextMageLightningPulseId,
      nextProjectileId: work.nextProjectileId,
      nextProjectileEffectId: work.nextProjectileEffectId,
      nextSyntheticSpawnIntentId: work.nextSyntheticSpawnIntentId,
      projectiles: work.projectiles,
      projectileEffects: work.projectileEffects,
      rngState: work.rngState,
    },
  }
}

function materializeSpawnIntents(
  work: WorkingStep,
  context: BoneyardEnemyStoreStepContext,
  spawnIntents: readonly BoneyardEnemySpawnIntent[],
  impSplitDepthOverride: number | null = null,
): BoneyardEnemyActor[] {
  const actors: BoneyardEnemyActor[] = []
  for (const intent of spawnIntents) {
    const baseSpeed = nextBoneyardWaveRandom(work.rngState)
    const radius = nextBoneyardWaveRandom(baseSpeed.state)
    const armor = nextBoneyardWaveRandom(radius.state)
    const split = nextBoneyardWaveRandom(armor.state)
    const splitMany = intent.flags.includes('FLAG_SPLITMANY')
      ? nextBoneyardWaveRandom(split.state)
      : null
    work.rngState = splitMany?.state ?? split.state
    const evaluatedConfig = evaluateBoneyardEnemyConfig(intent.enemyToken, {
      arenaScalars: context.arenaScalars,
      flags: intent.flags,
      mageCloak: intent.mageCloak,
      random: {
        baseSpeedUnit: baseSpeed.value,
        collisionRadiusUnit: radius.value,
        randomArmor: armor.value >= 0.5,
        splitManyGateUnit: split.value,
        splitManyUnit: splitMany?.value ?? 0,
        splitUnit: split.value >= 0.5 ? 1 : 0,
      },
      waveOrdinal: intent.waveOrdinal,
    })
    const config = impSplitDepthOverride === null
      ? evaluatedConfig
      : withImpSplitDepth(evaluatedConfig, impSplitDepthOverride)
    if (
      config.enemyToken === 'IMP'
      && work.impActorCount >= NATIVE_IMP_CONSTRUCTION_MAXIMUM
    ) continue
    const position = context.resolveMovement({
      actorId: work.nextActorId,
      delta: { x: 0, y: 0 },
      position: intent.position,
      purpose: 'spawn-placement',
      radius: config.collisionRadius,
      requestedPosition: intent.position,
    })
    validatePoint(position, 'resolved enemy spawn position')
    const targetPlayerId = nearestEligibleTarget(position, context.players)
    const brain = createBrain(work, config)
    const bodyPose = config.enemyToken === 'SKELETONMAGE'
      ? drawInteger(work, 2)
      : 0
    const actor: BoneyardEnemyActor = {
      bodyPose,
      brain,
      config,
      currentHealth: config.maximumHealth,
      deathEpoch: null,
      deathStartedTick: null,
      deathTick: 0,
      gaitPose: 0,
      headFacingOffset: 0,
      headingDeg: targetHeading(position, targetPlayerId, context.players),
      id: work.nextActorId,
      lastDamagedByPlayerId: null,
      lastDamageTick: null,
      lastMovementTick: null,
      lifeState: 'alive',
      lightRegistration: work.registerLightProvider('actor'),
      lighting: Object.freeze({ charge: 0, glow: 0, providerCopies: 0 }),
      lootSeed: nextLootSeed(work, context),
      nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
      nextTargetRefreshTick: context.tick + (
        targetPlayerId === null
          ? NATIVE_ENEMY_MISSING_TARGET_REFRESH_TICKS
          : NATIVE_ENEMY_TARGET_REFRESH_TICKS
      ),
      position: Object.freeze({ ...position }),
      rewardGranted: false,
      shieldHealth: 0,
      shieldMaximumHealth: 0,
      shieldPulse: 0,
      shieldSoundCooldownTicks: 0,
      sourceSpawnIntentId: intent.id,
      spawnTick: intent.spawnTick,
      targetPlayerId,
      terminalEmitted: false,
      waveOrdinal: intent.waveOrdinal,
    }
    work.nextActorId += 1
    if (config.enemyToken === 'IMP') work.impActorCount += 1
    work.spawnedActorIds.push(actor.id)
    emitEvent(work, context.tick, 'enemy-spawned', actor.id, {
      targetPlayerId,
    })
    actors.push(actor)
  }
  return actors
}

function withImpSplitDepth(
  config: EvaluatedBoneyardEnemyConfig,
  splitDepth: number,
): EvaluatedBoneyardEnemyConfig {
  if (config.enemyToken !== 'IMP') {
    throw new Error('only child Imps can inherit reduced split state')
  }
  if (!Number.isSafeInteger(splitDepth) || splitDepth < 0) {
    throw new RangeError('inherited Imp split depth must be a non-negative safe integer')
  }
  return Object.freeze({
    ...config,
    family: Object.freeze({ ...config.family, splitDepth }),
  })
}

function createBrain(
  work: WorkingStep,
  config: EvaluatedBoneyardEnemyConfig,
): BoneyardEnemyBrain {
  switch (config.enemyToken) {
    case 'SKELETON': return {
      action: skeletonAction(config.family.weapon),
      actionProgress: 0,
      contactTargetPlayerId: null,
      family: 'skeleton',
      markerEmitted: false,
      phase: 'approach',
    }
    case 'SKELETONARCHER': {
      const seed = nextBoneyardWaveRandom(work.rngState)
      work.rngState = seed.state
      return {
        actionProgress: 0,
        aimRngState: seed.state,
        family: 'archer',
        markerEmitted: false,
        phase: 'range-control',
      }
    }
    case 'SKELETONMAGE': return {
      actionProgress: 0,
      castProgram: 'short',
      castRoll: 0,
      family: 'mage',
      lightningTargetPlayerId: null,
      lightningTargetPosition: null,
      lightningTicksRemaining: 0,
      markerEmitted: false,
      phase: 'range-control',
      shieldTicksRemaining: config.family.shieldInterval > 0
        ? boundedMageShieldIntervalTicks(config.family.shieldInterval)
        : 0,
    }
    case 'IMP': {
      const flight = createNativeImpFlightState(() => drawUnit(work))
      return {
        actionTick: 0,
        ...flight,
        contactTargetPlayerId: null,
        cooldownTicks: 0,
        family: 'imp',
        markerEmitted: false,
        phase: 'flight',
        visualRngState: work.rngState,
      }
    }
    case 'ZOMBIE': {
      const bodyPhaseDeg = drawUnit(work) * 360
      const headBaseRotationDeg = signedUnit(drawUnit(work)) * 65
      const headPhaseDeg = drawUnit(work) * 360
      drawInteger(work, 2) // Native +0x220 idle-turn timer seed.
      const rearArmBaseRotationDeg = drawUnit(work) * 20
      const frontArmBaseRotationDeg = drawUnit(work) * 20
      const attackSide = drawInteger(work, 2) as 0 | 1
      const bodyType = drawInteger(work, 3)
      const headRoll = drawInteger(work, 4)
      const headType = headRoll === 3 ? drawInteger(work, 2) + 1 : 0
      return {
        actionProgress: 0,
        actionRate: 0,
        actionSwing: 0,
        angularOffsetDeg: 0,
        attackSide,
        bodyPhaseDeg,
        bodyType,
        contactTargetPlayerId: null,
        family: 'zombie',
        flyblownSide: drawInteger(work, 2) as 0 | 1,
        frontArmBaseRotationDeg,
        headBaseRotationDeg,
        headPhaseDeg,
        headType,
        impactStateTicksRemaining: 0,
        markerEmitted: false,
        phase: 'approach',
        phaseTicksRemaining: 0,
        rearArmBaseRotationDeg,
        verticalOffset: 0,
        verticalVelocity: 0,
        visualRngState: work.rngState,
      }
    }
    case 'WRAITH': return {
      actionTick: 0,
      contactTargetPlayerId: null,
      family: 'wraith',
      markerEmitted: false,
      phase: 'approach',
      phaseTicksRemaining: 0,
    }
    case 'DEMON': return {
      actionProgress: 0,
      family: 'demon',
      markerEmitted: false,
      phase: 'approach',
    }
    case 'COFFIN': {
      const hidden = randomBoneyardWaveInteger(work.rngState, 2)
      work.rngState = hidden.state
      return {
        family: 'coffin',
        maggotsReleased: false,
        nextMaggotReplenishmentTick: 0,
        phase: 'hidden',
        phaseTick: 0,
        phaseTicksRemaining: hidden.value === 0
          ? NATIVE_COFFIN_HIDDEN_SHORT_TICKS
          : NATIVE_COFFIN_HIDDEN_LONG_TICKS,
      }
    }
  }
}

function stepMageShields(
  work: WorkingStep,
  context: BoneyardEnemyStoreStepContext,
): void {
  for (let index = 0; index < work.actors.length; index += 1) {
    const source = work.actors[index]!
    const effect = context.abilityEffects?.[source.id]
    if (
      source.lifeState !== 'alive'
      || (effect?.disruptedTicks ?? 0) > 0
      || source.brain.family !== 'mage'
      || source.config.enemyToken !== 'SKELETONMAGE'
      || source.config.family.shieldInterval <= 0
    ) continue
    const remaining = Math.max(0, source.brain.shieldTicksRemaining - 1)
    if (remaining > 0) {
      work.actors[index] = {
        ...source,
        brain: { ...source.brain, shieldTicksRemaining: remaining },
      }
      continue
    }

    let mage = source
    if (source.config.family.selfShield && source.config.family.selfShieldHealth > 0) {
      mage = withRefreshedShield(mage, source.config.family.selfShieldHealth)
    }
    mage = {
      ...mage,
      brain: {
        ...(mage.brain as BoneyardMageBrain),
        shieldTicksRemaining: boundedMageShieldIntervalTicks(
          source.config.family.shieldInterval,
        ),
      },
    }
    work.actors[index] = mage

    if (!source.config.family.otherShield || source.config.family.otherShieldHealth <= 0) continue
    const allyIndex = nearestShieldAllyIndex(work.actors, source, index)
    if (allyIndex >= 0) {
      work.actors[allyIndex] = withRefreshedShield(
        work.actors[allyIndex]!,
        source.config.family.otherShieldHealth,
      )
    }
  }
}

function nearestShieldAllyIndex(
  actors: readonly BoneyardEnemyActor[],
  source: BoneyardEnemyActor,
  sourceIndex: number,
): number {
  let selectedIndex = -1
  let selectedDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < actors.length; index += 1) {
    if (index === sourceIndex) continue
    const actor = actors[index]!
    if (actor.lifeState !== 'alive') continue
    if (!canReceiveNativeMageAllyShield(actor)) continue
    const distance = Math.hypot(
      actor.position.x - source.position.x,
      actor.position.y - source.position.y,
    )
    if (distance > BOUNDED_MAGE_ALLY_SHIELD_RANGE) continue
    if (
      distance < selectedDistance
      || (
        distance === selectedDistance
        && (selectedIndex < 0 || actor.id < actors[selectedIndex]!.id)
      )
    ) {
      selectedDistance = distance
      selectedIndex = index
    }
  }
  return selectedIndex
}

function canReceiveNativeMageAllyShield(actor: BoneyardEnemyActor): boolean {
  switch (actor.config.enemyToken) {
    case 'SKELETON':
    case 'SKELETONARCHER':
    case 'ZOMBIE':
      return true
    case 'SKELETONMAGE':
    case 'IMP':
    case 'WRAITH':
    case 'DEMON':
    case 'COFFIN':
      return false
  }
}

function withRefreshedShield(
  actor: BoneyardEnemyActor,
  strength: number,
): BoneyardEnemyActor {
  const shieldHealth = Math.max(actor.shieldHealth, strength)
  return {
    ...actor,
    shieldHealth,
    shieldMaximumHealth: Math.max(actor.shieldMaximumHealth, shieldHealth),
    shieldPulse: 3,
  }
}

function stepDamagePresentationTimers(
  actor: BoneyardEnemyActor,
  elapsedTicks: number,
): BoneyardEnemyActor {
  if (elapsedTicks <= 0) return actor
  const shieldPulse = Math.max(0, actor.shieldPulse - elapsedTicks * 0.05)
  const shieldSoundCooldownTicks = Math.max(
    0,
    actor.shieldSoundCooldownTicks - elapsedTicks,
  )
  return shieldPulse === actor.shieldPulse
    && shieldSoundCooldownTicks === actor.shieldSoundCooldownTicks
    ? actor
    : { ...actor, shieldPulse, shieldSoundCooldownTicks }
}

function stepLivingActor(
  work: WorkingStep,
  source: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const effect = context.abilityEffects?.[source.id]
  const affected = effect === undefined
    ? source
    : withNativeSecondaryEffect(source, effect)
  const targeted = refreshTarget(affected, context)
  const actor = targeted.brain.family === 'coffin'
    ? targeted
    : faceTarget(targeted, context.players)
  if ((effect?.disruptedTicks ?? 0) > 0) {
    const interrupted = clearSkeletonFamilyHeadFacing(
      interruptNativeSecondaryAction(actor),
    )
    const lit = stepEnemyLighting(interrupted)
    return lit.brain.family === 'mage'
      ? applyMageProviderGateAfterAction(lit)
      : lit
  }
  if (effect?.timeScale === 0) {
    const lit = stepEnemyLighting(actor)
    return lit.brain.family === 'mage'
      ? applyMageProviderGateAfterAction(lit)
      : lit
  }
  if ((effect?.fleeTicks ?? 0) > 0 && actor.brain.family !== 'coffin') {
    const interrupted = clearSkeletonFamilyHeadFacing(
      interruptNativeSecondaryAction(actor),
    )
    const fled = moveTowardTarget(
      interrupted,
      interrupted.brain,
      context,
      -1,
    )
    return stepEnemyLighting(fled)
  }
  const articulated = rollSkeletonFamilyHeadFacing(work, actor)
  if (articulated.brain.family === 'mage') {
    const enrolled = stepEnemyLighting(articulated)
    return applyMageProviderGateAfterAction(
      finalizeSkeletonFamilyHeadFacing(
        articulated,
        stepMage(work, enrolled, articulated.brain, context),
      ),
    )
  }
  const stepped = (() => {
    switch (articulated.brain.family) {
      case 'skeleton': return stepSkeleton(work, articulated, articulated.brain, context)
      case 'archer': return stepArcher(work, articulated, articulated.brain, context)
      case 'imp': return advanceImpVisual(
        articulated,
        stepImp(work, articulated, articulated.brain, context),
      )
      case 'zombie': return advanceZombieVisual(
        articulated,
        stepZombie(work, articulated, articulated.brain, context),
      )
      case 'wraith': return stepWraith(work, articulated, articulated.brain, context)
      case 'demon': return stepDemon(work, articulated, articulated.brain, context)
      case 'coffin': return stepCoffin(work, articulated, articulated.brain, context)
    }
  })()
  return stepEnemyLighting(finalizeSkeletonFamilyHeadFacing(articulated, stepped))
}

function rollSkeletonFamilyHeadFacing(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
): BoneyardEnemyActor {
  if (
    (actor.brain.family !== 'skeleton' && actor.brain.family !== 'mage')
    || actor.targetPlayerId === null
  ) return actor
  const gate = drawNativeInteger(
    work.headFacingRngState,
    NATIVE_SKELETON_HEAD_TURN_ROLL_COUNT,
  )
  work.headFacingRngState = gate.state
  if (gate.value !== NATIVE_SKELETON_HEAD_TURN_ROLL_WINNER) return actor
  const offset = drawNativeInteger(
    work.headFacingRngState,
    NATIVE_SKELETON_HEAD_FACING_OFFSETS.length,
  )
  work.headFacingRngState = offset.state
  const headFacingOffset = NATIVE_SKELETON_HEAD_FACING_OFFSETS[
    offset.value
  ]!
  return headFacingOffset === actor.headFacingOffset
    ? actor
    : { ...actor, headFacingOffset }
}

function finalizeSkeletonFamilyHeadFacing(
  source: BoneyardEnemyActor,
  stepped: BoneyardEnemyActor,
): BoneyardEnemyActor {
  if (
    stepped.brain.family === 'skeleton'
    && stepped.brain.phase === 'attack'
  ) return stepped
  if (
    source.brain.family === 'mage'
    && source.brain.phase === 'cast'
    && stepped.brain.family === 'mage'
    && stepped.brain.phase === 'cast'
  ) return stepped
  return clearSkeletonFamilyHeadFacing(stepped)
}

function clearSkeletonFamilyHeadFacing(
  actor: BoneyardEnemyActor,
): BoneyardEnemyActor {
  return actor.headFacingOffset === 0
    ? actor
    : { ...actor, headFacingOffset: 0 }
}

function stepEnemyLighting(actor: BoneyardEnemyActor): BoneyardEnemyActor {
  const prior = actor.lighting
  const active = actor.config.scale !== 0
  switch (actor.config.enemyToken) {
    case 'SKELETON': {
      const burning = active && actor.config.burning
      return withEnemyLighting(actor, {
        ...prior,
        glow: burning
          ? Math.min(1, prior.glow + NATIVE_ENEMY_BURN_GLOW_PER_TICK)
          : prior.glow,
        providerCopies: burning ? 1 : 0,
      })
    }
    case 'SKELETONARCHER': {
      if (!active) return withEnemyLighting(actor, { ...prior, providerCopies: 0 })
      const burning = actor.config.burning
      return withEnemyLighting(actor, {
        charge: Math.min(1, prior.charge + NATIVE_ENEMY_CHARGE_PER_TICK),
        glow: burning
          ? Math.min(1, prior.glow + NATIVE_ENEMY_BURN_GLOW_PER_TICK)
          : prior.glow,
        providerCopies: (
          Number(actor.config.family.arrowType === 'fire') + Number(burning)
        ) as 0 | 1 | 2,
      })
    }
    case 'SKELETONMAGE': {
      if (!active) return withEnemyLighting(actor, { ...prior, providerCopies: 0 })
      const burning = actor.config.burning
      const once = burning
        ? Math.min(1, prior.glow + NATIVE_ENEMY_BURN_GLOW_PER_TICK)
        : prior.glow
      const glow = burning
        ? Math.min(1, once + NATIVE_ENEMY_BURN_GLOW_PER_TICK)
        : once
      const charge = magePoseIsFour(actor)
        ? prior.charge
        : Math.min(1, prior.charge + NATIVE_ENEMY_CHARGE_PER_TICK)
      return withEnemyLighting(actor, {
        charge,
        glow,
        providerCopies: burning ? 2 : charge > 0 ? 1 : 0,
      })
    }
    case 'IMP': {
      const glow = Math.min(1, prior.glow + NATIVE_IMP_GLOW_PER_TICK)
      return withEnemyLighting(actor, {
        charge: prior.charge,
        glow,
        providerCopies: active ? 1 : 0,
      })
    }
    case 'WRAITH': {
      const burning = actor.config.burning
      return withEnemyLighting(actor, {
        ...prior,
        glow: burning
          ? Math.min(1, prior.glow + NATIVE_ENEMY_BURN_GLOW_PER_TICK)
          : prior.glow,
        providerCopies: burning ? 1 : 0,
      })
    }
    case 'DEMON':
      return withEnemyLighting(actor, { ...prior, providerCopies: 1 })
    case 'COFFIN':
      return withEnemyLighting(actor, {
        ...prior,
        providerCopies: actor.brain.family === 'coffin'
          && actor.brain.phase !== 'hidden'
          ? 1
          : 0,
      })
    case 'ZOMBIE':
      return withEnemyLighting(actor, { ...prior, providerCopies: 0 })
  }
}

function withEnemyLighting(
  actor: BoneyardEnemyActor,
  lighting: BoneyardEnemyLightingState,
): BoneyardEnemyActor {
  return { ...actor, lighting }
}

function applyMageProviderGateAfterAction(
  actor: BoneyardEnemyActor,
): BoneyardEnemyActor {
  if (actor.config.burning || actor.lighting.charge > 0) return actor
  return withEnemyLighting(actor, { ...actor.lighting, providerCopies: 0 })
}

function magePoseIsFour(actor: BoneyardEnemyActor): boolean {
  return actor.brain.family === 'mage' && Math.floor(actor.bodyPose) === 4
}

function stepSkeleton(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardSkeletonBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) return resetSkeleton(actor, brain)
  if (brain.phase === 'attack') {
    if (brain.action === 'claw') {
      return stepSkeletonClawAction(work, actor, brain, context)
    }
    if (brain.action === 'weapon') {
      return stepSkeletonWeaponAction(work, actor, brain, context)
    }
    const program = NATIVE_SKELETON_ACTION_PROGRAMS[brain.action]
    return stepProgressAction(
      work,
      actor,
      brain,
      program,
      NATIVE_SKELETON_PIKE_BODY_POSES,
      context.tick,
      brain.contactTargetPlayerId,
      (eventId) => {
        directContactPlayerDamage(
          work,
          actor,
          brain.contactTargetPlayerId,
          context.players,
          BOUNDED_ENEMY_ATTACK_REACH.SKELETON,
          eventId,
        )
      },
    )
  }
  if (targetWithinAttackReach(
    actor,
    context.players,
    BOUNDED_ENEMY_ATTACK_REACH.SKELETON,
  )) {
    const bodyPose = brain.action === 'claw'
      ? NATIVE_SKELETON_CLAW_BODY_POSES[
          actor.config.enemyToken === 'SKELETON' && actor.config.family.armor
            ? 'armored'
            : 'unarmored'
        ][0]!
      : brain.action === 'weapon'
        ? NATIVE_SKELETON_WEAPON_BODY_POSES[0]!
        : NATIVE_SKELETON_PIKE_BODY_POSES[0]!
    return {
      ...actor,
      bodyPose,
      brain: {
        ...brain,
        actionProgress: 0,
        contactTargetPlayerId: actor.targetPlayerId,
        markerEmitted: false,
        phase: 'attack',
      },
      lootSeed: nextLootSeed(work, context),
    }
  }
  return moveTowardTarget(actor, brain, context, 1)
}

function stepSkeletonWeaponAction(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardSkeletonBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const program = NATIVE_SKELETON_ACTION_PROGRAMS.weapon
  const previousProgress = brain.actionProgress
  const actionProgress = previousProgress
    + program.progressPerTick * actor.config.attackSpeed
  let markerEmitted = brain.markerEmitted
  for (const marker of NATIVE_SKELETON_WEAPON_MARKERS) {
    if (previousProgress >= marker || actionProgress < marker) continue
    const eventId = attackMarker(
      work,
      actor,
      context.tick,
      brain.contactTargetPlayerId,
    )
    directContactPlayerDamage(
      work,
      actor,
      brain.contactTargetPlayerId,
      context.players,
      BOUNDED_ENEMY_ATTACK_REACH.SKELETON,
      eventId,
    )
    markerEmitted = true
  }
  if (actionProgress > program.strictEnd) {
    return {
      ...actor,
      bodyPose: NATIVE_SKELETON_WEAPON_BODY_POSES[0]!,
      brain: {
        ...brain,
        actionProgress: 0,
        contactTargetPlayerId: null,
        markerEmitted: false,
        phase: 'approach',
      },
    }
  }
  return {
    ...actor,
    bodyPose: nativeSkeletonFamilyBodyPose(
      NATIVE_SKELETON_WEAPON_BODY_POSES,
      actionProgress,
    ),
    brain: { ...brain, actionProgress, markerEmitted },
  }
}

function stepSkeletonClawAction(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardSkeletonBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const program = NATIVE_SKELETON_ACTION_PROGRAMS.claw
  const previousProgress = brain.actionProgress
  const rawProgress = previousProgress
    + program.progressPerTick * actor.config.attackSpeed
  const completed = rawProgress > program.strictEnd
  const wrappedProgress = completed
    ? rawProgress - (program.strictEnd + 1)
    : rawProgress
  let markerEmitted = brain.markerEmitted
  for (const marker of NATIVE_SKELETON_CLAW_MARKERS) {
    if (!inclusiveCircularMarkerCrossed(
      previousProgress,
      wrappedProgress,
      marker,
      completed,
    )) continue
    const eventId = attackMarker(
      work,
      actor,
      context.tick,
      brain.contactTargetPlayerId,
    )
    directContactPlayerDamage(
      work,
      actor,
      brain.contactTargetPlayerId,
      context.players,
      BOUNDED_ENEMY_ATTACK_REACH.SKELETON,
      eventId,
    )
    markerEmitted = true
  }
  if (completed) {
    const bodyPoses = actor.config.enemyToken === 'SKELETON'
      && actor.config.family.armor
      ? NATIVE_SKELETON_CLAW_BODY_POSES.armored
      : NATIVE_SKELETON_CLAW_BODY_POSES.unarmored
    return {
      ...actor,
      bodyPose: bodyPoses[0]!,
      brain: {
        ...brain,
        actionProgress: 0,
        contactTargetPlayerId: null,
        markerEmitted: false,
        phase: 'approach',
      },
    }
  }
  const bodyPoses = actor.config.enemyToken === 'SKELETON'
    && actor.config.family.armor
    ? NATIVE_SKELETON_CLAW_BODY_POSES.armored
    : NATIVE_SKELETON_CLAW_BODY_POSES.unarmored
  return {
    ...actor,
    bodyPose: nativeSkeletonFamilyBodyPose(bodyPoses, rawProgress),
    brain: { ...brain, actionProgress: rawProgress, markerEmitted },
  }
}

function inclusiveCircularMarkerCrossed(
  previousProgress: number,
  currentProgress: number,
  marker: number,
  wrapped: boolean,
): boolean {
  return wrapped
    ? marker >= previousProgress || marker <= currentProgress
    : previousProgress <= marker && marker <= currentProgress
}

function stepArcher(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardArcherBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) return resetArcher(actor, brain)
  if (brain.phase === 'attack') {
    let aimRngState = brain.aimRngState
    const stepped = stepProgressAction(
      work,
      actor,
      brain,
      NATIVE_ARCHER_ACTION_PROGRAM,
      NATIVE_ARCHER_SHOT_BODY_POSES,
      context.tick,
      actor.targetPlayerId,
      () => {
        aimRngState = emitArcherVolley(work, actor, brain.aimRngState, context)
      },
    )
    return stepped.brain.family === 'archer' && aimRngState !== brain.aimRngState
      ? { ...stepped, brain: { ...stepped.brain, aimRngState } }
      : stepped
  }
  const distance = targetDistance(actor, context.players)
  const range = actor.config.enemyToken === 'SKELETONARCHER'
    ? BOUNDED_ARCHER_RANGE_BANDS[actor.config.family.rangeMode]
    : BOUNDED_ARCHER_RANGE_BANDS[0]
  if (distance >= range.minimum && distance <= range.maximum) {
    return {
      ...actor,
      bodyPose: NATIVE_ARCHER_SHOT_BODY_POSES[0]!,
      brain: { ...brain, actionProgress: 0, markerEmitted: false, phase: 'attack' },
      lootSeed: nextLootSeed(work, context),
    }
  }
  return moveTowardTarget(actor, brain, context, distance < range.minimum ? -1 : 1)
}

function stepMage(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardMageBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const lightningDispatches: MageLightningDispatch[] = []
  let stepped: BoneyardEnemyActor
  if (actor.targetPlayerId === null) {
    stepped = resetMage(actor, brain)
  } else if (brain.phase === 'cast') {
    const base = NATIVE_MAGE_ACTION_PROGRAMS[brain.castProgram]
    let spellDispatched = false
    stepped = stepProgressAction(
      work,
      actor,
      brain,
      { ...base, progressPerTick: base.progressPerTick * (1 + brain.castRoll) },
      NATIVE_MAGE_CAST_BODY_POSES[brain.castProgram],
      context.tick,
      actor.targetPlayerId,
      (eventId) => {
        spellDispatched = true
        const dispatch = emitMageAttack(work, actor, context, eventId)
        if (dispatch !== null) lightningDispatches.push(dispatch)
      },
    )
    if (spellDispatched && actor.config.enemyToken === 'SKELETONMAGE') stepped = {
      ...stepped,
      lighting: {
        ...stepped.lighting,
        charge: actor.config.family.element === 'lightning' ? 1 : 0,
      },
    }
  } else {
    const distance = targetDistance(actor, context.players)
    const range = actor.config.enemyToken === 'SKELETONMAGE'
      ? BOUNDED_MAGE_RANGE_BANDS[actor.config.family.rangeMode]
      : BOUNDED_MAGE_RANGE_BANDS[0]
    if (distance >= range.minimum && distance <= range.maximum) {
      const program = nextBoneyardWaveRandom(work.rngState)
      const roll = nextBoneyardWaveRandom(program.state)
      work.rngState = roll.state
      // Mage action scheduling and cast scheduling are separate native writers;
      // the second value is the death-time seed retained by the actor.
      nextLootSeed(work, context)
      const lootSeed = nextLootSeed(work, context)
      stepped = {
        ...actor,
        bodyPose: NATIVE_MAGE_CAST_BODY_POSES[
          program.value < 0.5 ? 'short' : 'long'
        ][0]!,
        brain: {
          ...brain,
          actionProgress: 0,
          castProgram: program.value < 0.5 ? 'short' : 'long',
          castRoll: roll.value,
          markerEmitted: false,
          phase: 'cast',
        },
        lootSeed,
      }
    } else {
      stepped = moveTowardTarget(
        actor,
        brain,
        context,
        distance < range.minimum ? -1 : 1,
      )
    }
  }
  const dispatchedLightning = lightningDispatches[0]
  if (dispatchedLightning !== undefined) {
    const steppedBrain = stepped.brain
    if (steppedBrain.family !== 'mage') throw new Error('Mage dispatch changed brain family')
    stepped = {
      ...stepped,
      brain: {
        ...steppedBrain,
        lightningTargetPlayerId: dispatchedLightning.targetPlayerId,
        lightningTargetPosition: dispatchedLightning.targetPosition,
        lightningTicksRemaining: nativeMageLightningDurationTicks(actor.config.attackSpeed),
      },
    }
  }
  return stepMageLightningPulse(work, stepped, context)
}

function stepImp(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardImpBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) return resetImp(actor, brain)
  if (brain.phase === 'cooldown') {
    const remaining = Math.max(0, brain.cooldownTicks - 1)
    return {
      ...actor,
      brain: remaining === 0
        ? {
            ...brain,
            actionTick: 0,
            contactTargetPlayerId: null,
            cooldownTicks: 0,
            markerEmitted: false,
            phase: 'flight',
          }
        : { ...brain, cooldownTicks: remaining },
    }
  }
  if (brain.phase === 'contact') {
    const nextTick = brain.actionTick + actor.config.attackSpeed
    let markerEmitted = brain.markerEmitted
    if (!markerEmitted && nextTick >= BOUNDED_ENEMY_ACTION_PROGRAMS.impContact.markerTick) {
      const eventId = attackMarker(work, actor, context.tick, brain.contactTargetPlayerId)
      directContactPlayerDamage(
        work,
        actor,
        brain.contactTargetPlayerId,
        context.players,
        BOUNDED_ENEMY_ATTACK_REACH.IMP,
        eventId,
      )
      markerEmitted = true
    }
    if (nextTick > BOUNDED_ENEMY_ACTION_PROGRAMS.impContact.strictEndTick) {
      return {
        ...actor,
        brain: {
          ...brain,
          actionTick: 0,
          contactTargetPlayerId: null,
          cooldownTicks: BOUNDED_ENEMY_ACTION_PROGRAMS.impContact.cooldownTicks,
          markerEmitted: false,
          phase: 'cooldown',
        },
      }
    }
    return { ...actor, brain: { ...brain, actionTick: nextTick, markerEmitted } }
  }
  if (targetWithinAttackReach(actor, context.players, BOUNDED_ENEMY_ATTACK_REACH.IMP)) {
    return {
      ...actor,
      brain: {
        ...brain,
        actionTick: 0,
        contactTargetPlayerId: actor.targetPlayerId,
        markerEmitted: false,
        phase: 'contact',
      },
    }
  }
  return moveTowardTarget(actor, brain, context, 1)
}

function stepZombie(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardZombieBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) return resetZombie(actor, brain)
  if (brain.phase === 'knockback') {
    const remaining = Math.max(0, brain.phaseTicksRemaining - 1)
    return {
      ...actor,
      brain: remaining === 0
        ? {
            ...brain,
            actionProgress: 0,
            actionRate: 0,
            contactTargetPlayerId: null,
            impactStateTicksRemaining: 0,
            markerEmitted: false,
            phase: 'approach',
            phaseTicksRemaining: 0,
          }
        : { ...brain, phaseTicksRemaining: remaining },
    }
  }
  if (brain.phase === 'swipe') {
    const previousProgress = brain.actionProgress
    const impactStateTicksRemaining = Math.max(
      0,
      brain.impactStateTicksRemaining - 1,
    )
    const nextProgress = previousProgress
      + brain.actionRate * (brain.impactStateTicksRemaining === 0 ? 2 : 1)
    let markerEmitted = brain.markerEmitted
    let nextImpactStateTicksRemaining = impactStateTicksRemaining
    if (
      !markerEmitted
      && previousProgress < NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.markerProgress
      && nextProgress >= NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.markerProgress
    ) {
      const eventId = attackMarker(work, actor, context.tick, brain.contactTargetPlayerId)
      directContactPlayerDamage(
        work,
        actor,
        brain.contactTargetPlayerId,
        context.players,
        BOUNDED_ENEMY_ATTACK_REACH.ZOMBIE,
        eventId,
      )
      markerEmitted = true
      nextImpactStateTicksRemaining = NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.impactStateTicks
    }
    if (nextProgress >= NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.completionProgress) {
      return {
        ...actor,
        brain: {
          ...brain,
          actionProgress: 0,
          actionRate: 0,
          contactTargetPlayerId: null,
          impactStateTicksRemaining: nextImpactStateTicksRemaining,
          markerEmitted: false,
          phase: 'knockback',
          phaseTicksRemaining: nextImpactStateTicksRemaining,
        },
      }
    }
    return {
      ...actor,
      gaitPose: previousProgress < NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.locomotionEndProgress
        ? positiveModulo(actor.gaitPose - 0.025, 8)
        : actor.gaitPose,
      brain: {
        ...brain,
        actionProgress: nextProgress,
        impactStateTicksRemaining: nextImpactStateTicksRemaining,
        markerEmitted,
      },
    }
  }
  if (targetWithinAttackReach(actor, context.players, BOUNDED_ENEMY_ATTACK_REACH.ZOMBIE)) {
    const attackRate = (
      NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.minimumRate
      + drawUnit(work) * NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.randomRateRange
    ) * actor.config.attackSpeed
    return {
      ...actor,
      brain: {
        ...brain,
        actionProgress: 0,
        actionRate: attackRate,
        attackSide: brain.attackSide === 0 ? 1 : 0,
        contactTargetPlayerId: actor.targetPlayerId,
        impactStateTicksRemaining: 0,
        markerEmitted: false,
        phase: 'swipe',
      },
    }
  }
  return moveTowardTarget(actor, brain, context, 1)
}

function stepWraith(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardWraithBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) return resetWraith(actor, brain)
  if (brain.phase === 'cooldown') {
    const remaining = Math.max(0, brain.phaseTicksRemaining - 1)
    return {
      ...actor,
      brain: remaining === 0
        ? {
            ...brain,
            actionTick: 0,
            contactTargetPlayerId: null,
            markerEmitted: false,
            phase: 'approach',
            phaseTicksRemaining: 0,
          }
        : { ...brain, phaseTicksRemaining: remaining },
    }
  }
  if (brain.phase === 'orbit') {
    const moved = moveTowardTarget(actor, brain, context, 0, 1)
    const movedBrain = moved.brain as BoneyardWraithBrain
    const remaining = Math.max(0, brain.phaseTicksRemaining - 1)
    return {
      ...moved,
      brain: remaining === 0
        ? { ...movedBrain, actionTick: 0, markerEmitted: false, phase: 'drain', phaseTicksRemaining: 0 }
        : { ...movedBrain, phaseTicksRemaining: remaining },
    }
  }
  if (brain.phase === 'drain') {
    const nextTick = brain.actionTick + actor.config.attackSpeed
    let markerEmitted = brain.markerEmitted
    if (!markerEmitted && nextTick >= BOUNDED_ENEMY_ACTION_PROGRAMS.wraithDrain.markerTick) {
      const eventId = attackMarker(work, actor, context.tick, brain.contactTargetPlayerId)
      directContactPlayerDamage(
        work,
        actor,
        brain.contactTargetPlayerId,
        context.players,
        BOUNDED_ENEMY_ATTACK_REACH.WRAITH,
        eventId,
      )
      markerEmitted = true
    }
    if (nextTick > BOUNDED_ENEMY_ACTION_PROGRAMS.wraithDrain.strictEndTick) {
      return {
        ...actor,
        brain: {
          ...brain,
          actionTick: 0,
          contactTargetPlayerId: null,
          markerEmitted: false,
          phase: 'cooldown',
          phaseTicksRemaining: BOUNDED_ENEMY_ACTION_PROGRAMS.wraithDrain.cooldownTicks,
        },
      }
    }
    return { ...actor, brain: { ...brain, actionTick: nextTick, markerEmitted } }
  }
  if (targetWithinAttackReach(actor, context.players, BOUNDED_ENEMY_ATTACK_REACH.WRAITH)) {
    const retreat = randomBoneyardWaveInteger(work.rngState, NATIVE_WRAITH_RETREAT_RANDOM_COUNT)
    work.rngState = retreat.state
    return {
      ...actor,
      brain: {
        ...brain,
        contactTargetPlayerId: actor.targetPlayerId,
        phase: 'orbit',
        phaseTicksRemaining: NATIVE_WRAITH_RETREAT_MINIMUM_TICKS + retreat.value,
      },
    }
  }
  return moveTowardTarget(actor, brain, context, 1)
}

function stepDemon(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardDemonBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) return resetDemon(actor, brain)
  if (brain.phase === 'bomb') {
    const previousProgress = brain.actionProgress
    const nextProgress = previousProgress
      + NATIVE_DEMON_BOMB_ACTION_PROGRAM.progressPerTick * actor.config.attackSpeed
    let markerEmitted = brain.markerEmitted
    if (
      !markerEmitted
      && previousProgress < NATIVE_DEMON_BOMB_ACTION_PROGRAM.markerProgress
      && nextProgress >= NATIVE_DEMON_BOMB_ACTION_PROGRAM.markerProgress
    ) {
      attackMarker(work, actor, context.tick)
      spawnProjectile(work, actor, context.tick, 'demon-bomb', actor.config.primaryDamage ?? 0)
      markerEmitted = true
    }
    if (nextProgress > NATIVE_DEMON_BOMB_ACTION_PROGRAM.strictEnd) {
      return {
        ...actor,
        brain: {
          ...brain,
          actionProgress: 0,
          markerEmitted: false,
          phase: 'approach',
        },
      }
    }
    return { ...actor, brain: { ...brain, actionProgress: nextProgress, markerEmitted } }
  }
  if (targetWithinAttackReach(actor, context.players, BOUNDED_ENEMY_ATTACK_REACH.DEMON)) {
    return {
      ...actor,
      brain: { ...brain, actionProgress: 0, markerEmitted: false, phase: 'bomb' },
    }
  }
  return moveTowardTarget(actor, brain, context, 1)
}

function advanceImpVisual(
  source: BoneyardEnemyActor,
  stepped: BoneyardEnemyActor,
): BoneyardEnemyActor {
  if (source.brain.family !== 'imp' || stepped.brain.family !== 'imp') return stepped
  let visualRngState = source.brain.visualRngState
  const random = (): number => {
    const draw = nextBoneyardWaveRandom(visualRngState)
    visualRngState = draw.state
    return draw.value
  }
  const horizontalVelocity = source.targetPlayerId === null
    ? 0
    : 0.25
      * source.config.chaseSpeed
      * source.config.baseSpeed
      * source.config.scale
  const flight = stepNativeImpFlight(source.brain, horizontalVelocity, random)
  return {
    ...stepped,
    brain: {
      ...stepped.brain,
      ...flight.state,
      visualRngState,
    },
  }
}

function advanceZombieVisual(
  source: BoneyardEnemyActor,
  stepped: BoneyardEnemyActor,
): BoneyardEnemyActor {
  if (source.brain.family !== 'zombie' || stepped.brain.family !== 'zombie') return stepped
  const sourceBrain = source.brain
  let visualRngState = sourceBrain.visualRngState
  const random = (): number => {
    const draw = nextBoneyardWaveRandom(visualRngState)
    visualRngState = draw.state
    return draw.value
  }
  const randomInteger = (count: number): number => Math.min(
    count - 1,
    Math.floor(random() * count),
  )
  let bodyPhaseDeg = sourceBrain.bodyPhaseDeg
  let headPhaseDeg = sourceBrain.headPhaseDeg
  let headBaseRotationDeg = sourceBrain.headBaseRotationDeg
  let rearArmBaseRotationDeg = sourceBrain.rearArmBaseRotationDeg
  let frontArmBaseRotationDeg = sourceBrain.frontArmBaseRotationDeg
  let actionSwing = sourceBrain.actionSwing
  let verticalOffset = sourceBrain.verticalOffset
  let verticalVelocity = sourceBrain.verticalVelocity

  if (sourceBrain.phase !== 'swipe') {
    bodyPhaseDeg += random()
    headPhaseDeg += random() * 0.75
    if (randomInteger(100) === 5) {
      if (randomInteger(2) === 1) {
        rearArmBaseRotationDeg = random() * 45
      } else {
        frontArmBaseRotationDeg = random() * 45
      }
      if (randomInteger(15) === 3) {
        headBaseRotationDeg = signedUnit(random()) * 65
      }
      if (source.config.flags.includes('FLAG_ROTTEN')) {
        rearArmBaseRotationDeg /= 3
        frontArmBaseRotationDeg /= 3
        headBaseRotationDeg *= 0.5
      }
    }
  } else {
    const progressIncrement = sourceBrain.actionRate
      * (sourceBrain.impactStateTicksRemaining === 0 ? 2 : 1)
    const nextProgress = sourceBrain.actionProgress + progressIncrement
    actionSwing += sourceBrain.actionRate
      * (sourceBrain.impactStateTicksRemaining === 0 ? 0.5 : 0.25)
    if (sourceBrain.actionProgress < 50 && nextProgress >= 50) {
      verticalOffset = -0.1
      verticalVelocity = -(3 + random() * 0.5)
    }
    if (
      sourceBrain.actionProgress < NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.markerProgress
      && nextProgress >= NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.markerProgress
    ) {
      bodyPhaseDeg = 0
      actionSwing = 0
      verticalOffset = -0.1
      verticalVelocity = -(1 + random() * 0.5)
    }
  }

  if (sourceBrain.phase !== 'swipe' && stepped.brain.phase === 'swipe') {
    actionSwing = 0
  }
  if (verticalOffset < 0) {
    verticalOffset += verticalVelocity
    verticalVelocity += 0.4
    if (verticalOffset > 0) verticalOffset = 0
  }
  return {
    ...stepped,
    brain: {
      ...stepped.brain,
      actionSwing,
      angularOffsetDeg: sourceBrain.angularOffsetDeg * 0.95,
      bodyPhaseDeg,
      frontArmBaseRotationDeg,
      headBaseRotationDeg,
      headPhaseDeg,
      rearArmBaseRotationDeg,
      verticalOffset,
      verticalVelocity,
      visualRngState,
    },
  }
}

function stepCoffin(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardCoffinBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const tick = context.tick
  if (brain.phase === 'open') {
    const family = actor.config.enemyToken === 'COFFIN' ? actor.config.family : null
    if (
      family === null
      || tick < brain.nextMaggotReplenishmentTick
      || ownedLiveMaggotCount(work.maggots, actor.id) >= family.maximumMaggots
    ) return actor
    const count = spawnCoffinMaggots(
      work,
      actor,
      context,
      BOUNDED_COFFIN_MAGGOT_PROGRAM.replenishmentEmissionCount,
    )
    if (count > 0) {
      emitEvent(work, tick, 'coffin-maggot-release', actor.id, { count })
    }
    return {
      ...actor,
      brain: {
        ...brain,
        nextMaggotReplenishmentTick: tick
          + BOUNDED_COFFIN_MAGGOT_PROGRAM.replenishmentIntervalTicks,
      },
    }
  }
  const remaining = Math.max(0, brain.phaseTicksRemaining - 1)
  if (remaining > 0) {
    return {
      ...actor,
      brain: { ...brain, phaseTick: brain.phaseTick + 1, phaseTicksRemaining: remaining },
    }
  }
  switch (brain.phase) {
    case 'hidden': return {
      ...actor,
      brain: {
        ...brain,
        phase: 'rising',
        phaseTick: 0,
        phaseTicksRemaining: NATIVE_COFFIN_RISE_TICKS,
      },
    }
    case 'rising': {
      const hold = randomBoneyardWaveInteger(work.rngState, NATIVE_COFFIN_HOLD_RANDOM_COUNT)
      work.rngState = hold.state
      return {
        ...actor,
        brain: {
          ...brain,
          phase: 'holding',
          phaseTick: 0,
          phaseTicksRemaining: NATIVE_COFFIN_HOLD_MINIMUM_TICKS + hold.value,
        },
      }
    }
    case 'holding': return {
      ...actor,
      brain: {
        ...brain,
        phase: 'opening',
        phaseTick: 0,
        phaseTicksRemaining: NATIVE_COFFIN_OPEN_TICKS,
      },
    }
    case 'opening': {
      const count = spawnCoffinMaggots(
        work,
        actor,
        context,
        NATIVE_COFFIN_OPENING_MAGGOT_EMISSIONS,
      )
      emitEvent(work, tick, 'coffin-maggot-release', actor.id, {
        count,
      })
      return {
        ...actor,
        brain: {
          ...brain,
          maggotsReleased: true,
          nextMaggotReplenishmentTick: tick
            + BOUNDED_COFFIN_MAGGOT_PROGRAM.replenishmentIntervalTicks,
          phase: 'open',
          phaseTick: NATIVE_COFFIN_OPEN_TICKS,
          phaseTicksRemaining: 0,
        },
      }
    }
    case 'death': return actor
  }
}

function spawnCoffinMaggots(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
  requestedCount: number,
): number {
  if (actor.config.enemyToken !== 'COFFIN') return 0
  const family = actor.config.family
  const available = Math.max(
    0,
    family.maximumMaggots - ownedLiveMaggotCount(work.maggots, actor.id),
  )
  const count = Math.min(requestedCount, available)
  for (let index = 0; index < count; index += 1) {
    const launchTrajectory: BoneyardMaggotActor['launchTrajectory'] = (
      work.nextActorId % 2 === 0 ? 'lid' : 'edge'
    )
    const trajectory = BOUNDED_MAGGOT_PROGRAM.launchTrajectories[launchTrajectory]
    const headingDeg = positiveModulo(
      actor.headingDeg
        + (work.nextActorId - actor.id) * BOUNDED_MAGGOT_PROGRAM.launchHeadingStepDeg,
      360,
    )
    const headingRadians = headingDeg * Math.PI / 180
    const unitX = Math.sin(headingRadians)
    const unitY = -Math.cos(headingRadians)
    const position = Object.freeze({
      x: actor.position.x + unitX * trajectory.originDistance,
      y: actor.position.y + unitY * trajectory.originDistance,
    })
    const targetPlayerId = nearestEligibleTarget(position, context.players)
    work.maggots.push(Object.freeze({
      collisionRadius: BOUNDED_MAGGOT_PROGRAM.collisionRadius,
      currentHealth: family.maggotHealth,
      deathOffsets: nativeMaggotDeathOffsets(work),
      damage: family.maggotDamage,
      deathEpoch: null,
      deathStartedTick: null,
      deathTick: 0,
      emergenceTick: 0,
      gaitPose: 0,
      headingDeg,
      id: work.nextActorId,
      launchTrajectory,
      launchVelocity: Object.freeze({
        x: unitX * trajectory.horizontalStep,
        y: unitY * trajectory.horizontalStep,
      }),
      lastAttackTick: null,
      lastDamagedByPlayerId: null,
      lastDamageTick: null,
      lastMovementTick: null,
      lifeState: 'alive',
      lightRegistration: work.registerLightProvider('actor'),
      maximumHealth: family.maggotHealth,
      movementPhase: 'emerging',
      nextAttackTick: context.tick
        + BOUNDED_MAGGOT_PROGRAM.emergenceTicks
        + BOUNDED_MAGGOT_PROGRAM.attackDelayAfterEmergenceTicks,
      nextMovementTick: context.tick + 1,
      ownerCoffinActorId: actor.id,
      poisonDamage: family.maggotPoisonDamage,
      poisonDuration: family.maggotPoisonDamage > 0
        ? BOUNDED_MAGGOT_PROGRAM.poisonDurationTicks
        : 0,
      position,
      spawnTick: context.tick,
      targetPlayerId,
      terminalEmitted: false,
    }))
    work.spawnedActorIds.push(work.nextActorId)
    emitEvent(work, context.tick, 'enemy-spawned', work.nextActorId, {
      targetPlayerId,
    })
    work.nextActorId += 1
  }
  return count
}

function ownedLiveMaggotCount(
  maggots: readonly BoneyardMaggotActor[],
  ownerCoffinActorId: BoneyardEnemyActorId,
): number {
  return maggots.filter((maggot) => (
    maggot.ownerCoffinActorId === ownerCoffinActorId
    && maggot.lifeState === 'alive'
  )).length
}

function nativeMaggotDeathOffsets(
  work: WorkingStep,
): readonly Readonly<BoneyardPoint>[] {
  const count = drawInteger(work, 3)
  return Object.freeze(Array.from({ length: count }, () => {
    const radius = drawUnit(work) * 30
    const direction = radialVector(drawUnit(work) * 360, radius)
    return Object.freeze(direction)
  }))
}

function stepMaggots(
  work: WorkingStep,
  context: BoneyardEnemyStoreStepContext,
): void {
  const retained: BoneyardMaggotActor[] = []
  for (const source of work.maggots) {
    const effect = context.abilityEffects?.[source.id]
    if (!hasLiveCoffinOwner(work.actors, source.ownerCoffinActorId)) {
      retireMaggot(work, source, context.tick)
      continue
    }
    if (source.lifeState === 'dying') {
      const deathStartedTick = source.deathStartedTick ?? context.tick
      const deathTick = Math.max(0, context.tick - deathStartedTick)
      if (
        source.lastAttackTick !== null
        && deathTick < BOUNDED_MAGGOT_PROGRAM.bitePresentationTicks
      ) {
        retained.push({ ...source, deathTick })
        continue
      }
      emitEvent(work, context.tick, 'enemy-death', source.id)
      emitMaggotDeathSounds(work, source, context.tick)
      spawnMaggotDeathEffects(work, source, context.tick)
      const eventId = emitEvent(work, context.tick, 'enemy-retired', source.id)
      work.retired.push(Object.freeze({ actorId: source.id, eventId }))
      continue
    }

    if ((effect?.disruptedTicks ?? 0) > 0 || effect?.timeScale === 0) {
      retained.push(source)
      continue
    }

    if (source.movementPhase === 'emerging') {
      retained.push(stepEmergingMaggot(source, context))
      continue
    }

    const targetPlayerId = nearestEligibleTarget(source.position, context.players)
    if (targetPlayerId === null) {
      retained.push({ ...source, targetPlayerId: null })
      continue
    }
    const target = context.players[targetPlayerId]
    if (!target) throw new Error(`Maggot target ${targetPlayerId} disappeared during one tick`)
    const distance = Math.hypot(
      target.position.x - source.position.x,
      target.position.y - source.position.y,
    )
    const fleeing = (effect?.fleeTicks ?? 0) > 0
    if (!fleeing && distance <= Math.max(
      BOUNDED_MAGGOT_PROGRAM.attackReach,
      source.collisionRadius + target.collisionRadius,
    )) {
      if (context.tick >= source.nextAttackTick) {
        const eventId = emitEvent(work, context.tick, 'attack-marker', source.id, {
          targetPlayerId,
        })
        work.playerDamage.push(Object.freeze({
          actorId: source.id,
          amount: source.damage * (effect?.weakenFactor ?? 1),
          coldSlowTicks: 0,
          dazzleTicks: 0,
          deflectable: true,
          damageKind: 'physical',
          eventId,
          playerId: targetPlayerId,
          poisonDamage: source.poisonDamage,
          poisonDuration: source.poisonDuration,
        }))
        work.nextDeathEpoch += 1
        retained.push({
          ...source,
          deathEpoch: work.nextDeathEpoch - 1,
          deathStartedTick: context.tick,
          deathTick: 0,
          headingDeg: targetHeading(source.position, targetPlayerId, context.players),
          lastAttackTick: context.tick,
          lifeState: 'dying',
          targetPlayerId,
          terminalEmitted: false,
        })
      } else {
        retained.push({ ...source, targetPlayerId })
      }
      continue
    }
    if (context.tick < source.nextMovementTick) {
      retained.push({ ...source, targetPlayerId })
      continue
    }
    const direction = fleeing ? -1 : 1
    const unitX = direction * (target.position.x - source.position.x) / distance
    const unitY = direction * (target.position.y - source.position.y) / distance
    const speedScale = nativeSecondaryActorSpeedScale(effect)
    const delta = Object.freeze({
      x: unitX * BOUNDED_MAGGOT_PROGRAM.movementStep * speedScale,
      y: unitY * BOUNDED_MAGGOT_PROGRAM.movementStep * speedScale,
    })
    const requestedPosition = Object.freeze({
      x: source.position.x + delta.x,
      y: source.position.y + delta.y,
    })
    const position = context.resolveMovement({
      actorId: source.id,
      delta,
      position: source.position,
      purpose: 'movement',
      radius: source.collisionRadius,
      requestedPosition,
    })
    validatePoint(position, 'resolved Maggot position')
    const traveled = Math.hypot(
      position.x - source.position.x,
      position.y - source.position.y,
    )
    retained.push({
      ...source,
      gaitPose: traveled === 0
        ? source.gaitPose
        : positiveModulo(
            source.gaitPose + traveled / BOUNDED_MAGGOT_PROGRAM.gaitDistancePerPose,
            2,
          ),
      headingDeg: actorHeadingFromVector(unitX, unitY),
      lastMovementTick: traveled === 0 ? source.lastMovementTick : context.tick,
      nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
      position: Object.freeze({ ...position }),
      targetPlayerId,
    })
  }
  work.maggots = retained
}

function spawnMaggotDeathEffects(
  work: WorkingStep,
  maggot: BoneyardMaggotActor,
  tick: number,
): void {
  const positions = [
    maggot.position,
    ...maggot.deathOffsets.map((offset) => ({
      x: maggot.position.x + offset.x,
      y: maggot.position.y + offset.y,
    })),
  ]
  for (const position of positions) {
    const owner: DeathEffectOwner = { id: maggot.id, position }
    spawnRadialBouncer(
      work,
      owner,
      tick,
      2013 + drawInteger(work, 50),
      'maggot-fragment',
    )
    spawnSimpleDeathEffect(work, owner, tick, {
      alpha: 1,
      alphaLossPerTick: 1 / BOUNDED_MAGGOT_PROGRAM.deathTicks,
      atlas: 'DeadHawg',
      blendMode: 'normal',
      entry: 28,
      kind: 'fade',
      lifetimeTicks: BOUNDED_MAGGOT_PROGRAM.deathTicks,
      role: 'maggot-perspective-fade',
      rotationDeg: drawUnit(work) * 360,
      scale: 0.75 + drawUnit(work) * 0.5,
      tint: 0x828c6b,
    })
  }
}

function emitMaggotDeathSounds(
  work: WorkingStep,
  maggot: BoneyardMaggotActor,
  tick: number,
): void {
  const squishPitch = 1 + drawUnit(work) * 0.2
  const squish = [
    'maggot-squish-1',
    'maggot-squish-2',
    'maggot-squish-3',
  ] as const
  emitEnemyDeathSound(
    work,
    tick,
    maggot,
    squish[drawInteger(work, squish.length)]!,
    squishPitch,
  )

  const squeakPitch = 1 + drawUnit(work) * 0.2
  const squeakGainScale = 0.25 + drawUnit(work) * 0.25
  const squeak = ['maggot-squeak-1', 'maggot-squeak-2'] as const
  emitEnemyDeathSound(
    work,
    tick,
    maggot,
    squeak[drawInteger(work, squeak.length)]!,
    squeakPitch,
    squeakGainScale,
  )
}

function hasLiveCoffinOwner(
  actors: readonly BoneyardEnemyActor[],
  ownerCoffinActorId: BoneyardEnemyActorId,
): boolean {
  return actors.some((actor) => (
    actor.id === ownerCoffinActorId
    && actor.lifeState === 'alive'
    && actor.config.enemyToken === 'COFFIN'
  ))
}

function retireMaggot(
  work: WorkingStep,
  maggot: BoneyardMaggotActor,
  tick: number,
): void {
  const eventId = emitEvent(work, tick, 'enemy-retired', maggot.id)
  work.retired.push(Object.freeze({ actorId: maggot.id, eventId }))
}

function stepEmergingMaggot(
  source: BoneyardMaggotActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardMaggotActor {
  const emergenceTick = Math.min(
    BOUNDED_MAGGOT_PROGRAM.emergenceTicks,
    Math.max(source.emergenceTick, context.tick - source.spawnTick),
  )
  const elapsedTicks = emergenceTick - source.emergenceTick
  if (elapsedTicks === 0) return source
  const delta = Object.freeze({
    x: source.launchVelocity.x * elapsedTicks,
    y: source.launchVelocity.y * elapsedTicks,
  })
  const requestedPosition = Object.freeze({
    x: source.position.x + delta.x,
    y: source.position.y + delta.y,
  })
  const position = context.resolveMovement({
    actorId: source.id,
    delta,
    position: source.position,
    purpose: 'movement',
    radius: source.collisionRadius,
    requestedPosition,
  })
  validatePoint(position, 'resolved emerging Maggot position')
  const traveled = Math.hypot(
    position.x - source.position.x,
    position.y - source.position.y,
  )
  const movementPhase = emergenceTick >= BOUNDED_MAGGOT_PROGRAM.emergenceTicks
    ? 'crawl' as const
    : 'emerging' as const
  return {
    ...source,
    emergenceTick,
    lastMovementTick: traveled === 0 ? source.lastMovementTick : context.tick,
    movementPhase,
    nextMovementTick: context.tick + (
      movementPhase === 'crawl' ? NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS : 1
    ),
    position: Object.freeze({ ...position }),
  }
}

function stepProgressAction<B extends BoneyardSkeletonBrain | BoneyardArcherBrain | BoneyardMageBrain>(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: B,
  program: ActionProgram,
  bodyPoses: readonly number[],
  tick: number,
  markerTargetPlayerId: string | null,
  onMarker: (eventId: number) => void,
): BoneyardEnemyActor {
  const actionProgress = brain.actionProgress
    + program.progressPerTick * actor.config.attackSpeed
  let markerEmitted = brain.markerEmitted
  if (!markerEmitted && actionProgress >= program.markerProgress) {
    const eventId = attackMarker(work, actor, tick, markerTargetPlayerId)
    onMarker(eventId)
    markerEmitted = true
  }
  if (actionProgress > program.strictEnd) {
    const completedBrain = brain.family === 'skeleton'
      ? {
          ...brain,
          actionProgress: 0,
          contactTargetPlayerId: null,
          markerEmitted: false,
          phase: 'approach' as const,
        }
      : { ...brain, actionProgress: 0, markerEmitted: false, phase: 'range-control' as const }
    return {
      ...actor,
      brain: completedBrain,
    }
  }
  return {
    ...actor,
    bodyPose: nativeSkeletonFamilyBodyPose(bodyPoses, actionProgress),
    brain: { ...brain, actionProgress, markerEmitted },
  }
}

function moveTowardTarget<B extends BoneyardEnemyBrain>(
  actor: BoneyardEnemyActor,
  brain: B,
  context: BoneyardEnemyStoreStepContext,
  radialDirection: -1 | 0 | 1,
  tangentDirection: -1 | 0 | 1 = 0,
): BoneyardEnemyActor {
  if (context.tick < actor.nextMovementTick || actor.targetPlayerId === null) return actor
  const target = context.players[actor.targetPlayerId]
  if (!target) return actor
  const dx = target.position.x - actor.position.x
  const dy = target.position.y - actor.position.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return { ...actor, nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS }
  const unitX = dx / length
  const unitY = dy / length
  const directionX = unitX * radialDirection + -unitY * tangentDirection
  const directionY = unitY * radialDirection + unitX * tangentDirection
  const step = 0.25
    * actor.config.chaseSpeed
    * actor.config.baseSpeed
    * actor.config.scale
    * NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS
  const delta = Object.freeze({ x: directionX * step, y: directionY * step })
  const requestedPosition = Object.freeze({
    x: actor.position.x + delta.x,
    y: actor.position.y + delta.y,
  })
  const position = context.resolveMovement({
    actorId: actor.id,
    delta,
    position: actor.position,
    purpose: 'movement',
    radius: actor.config.collisionRadius,
    requestedPosition,
  })
  validatePoint(position, 'resolved enemy position')
  const traveled = Math.hypot(
    position.x - actor.position.x,
    position.y - actor.position.y,
  )
  return {
    ...actor,
    brain,
    gaitPose: traveled === 0
      ? actor.gaitPose
      : positiveModulo(
          actor.gaitPose + traveled / BOUNDED_ENEMY_GAIT_DISTANCE_PER_POSE,
          8,
        ),
    headingDeg: actorHeadingFromVector(directionX, directionY),
    lastMovementTick: traveled === 0 ? actor.lastMovementTick : context.tick,
    nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    position: Object.freeze({ ...position }),
  }
}

function withNativeSecondaryEffect(
  actor: BoneyardEnemyActor,
  effect: NativeSecondaryTargetEffectState,
): BoneyardEnemyActor {
  const speedScale = nativeSecondaryActorSpeedScale(effect)
  const weakenFactor = effect.weakenFactor
  if (speedScale === 1 && weakenFactor === 1) return actor
  return {
    ...actor,
    config: {
      ...actor.config,
      attackSpeed: actor.config.attackSpeed * speedScale,
      baseSpeed: actor.config.baseSpeed * speedScale,
      extraDamage: actor.config.extraDamage * weakenFactor,
      primaryDamage: actor.config.primaryDamage === null
        ? null
        : actor.config.primaryDamage * weakenFactor,
      secondaryDamage: actor.config.secondaryDamage * weakenFactor,
      tertiaryDamage: actor.config.tertiaryDamage * weakenFactor,
    },
  }
}

export function nativeSecondaryActorSpeedScale(
  effect: NativeSecondaryTargetEffectState | undefined,
): number {
  if (effect === undefined) return 1
  const dazzleScale = effect.dazzleTicks <= 0 || effect.dazzleMaximumTicks <= 0
    ? 1
    : Math.max(
        1 / effect.dazzleMaximumTicks,
        1 - effect.dazzleTicks / effect.dazzleMaximumTicks,
      )
  return Math.min(effect.timeScale, dazzleScale)
}

function interruptNativeSecondaryAction(
  actor: BoneyardEnemyActor,
): BoneyardEnemyActor {
  switch (actor.brain.family) {
    case 'skeleton': return resetSkeleton(actor, actor.brain)
    case 'archer': return resetArcher(actor, actor.brain)
    case 'mage': return resetMage(actor, actor.brain)
    case 'imp': return resetImp(actor, actor.brain)
    case 'zombie': return resetZombie(actor, actor.brain)
    case 'wraith': return resetWraith(actor, actor.brain)
    case 'demon': return resetDemon(actor, actor.brain)
    case 'coffin': return actor
  }
}

function positiveModulo(value: number, period: number): number {
  return ((value % period) + period) % period
}

function refreshTarget(
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const current = actor.targetPlayerId === null
    ? undefined
    : context.players[actor.targetPlayerId]
  if (current && targetEligible(current) && context.tick < actor.nextTargetRefreshTick) {
    return actor
  }
  const targetPlayerId = nearestEligibleTarget(actor.position, context.players)
  return {
    ...actor,
    nextTargetRefreshTick: context.tick + (
      targetPlayerId === null
        ? NATIVE_ENEMY_MISSING_TARGET_REFRESH_TICKS
        : NATIVE_ENEMY_TARGET_REFRESH_TICKS
    ),
    targetPlayerId,
  }
}

function nearestEligibleTarget(
  position: Readonly<BoneyardPoint>,
  players: BoneyardEnemyTargets,
): string | null {
  let selected: string | null = null
  let selectedDistance = Number.POSITIVE_INFINITY
  for (const [playerId, player] of Object.entries(players)) {
    validatePoint(player.position, `enemy target ${playerId}`)
    validatePoint(player.velocityPerTick, `enemy target ${playerId} velocity`)
    if (!Number.isFinite(player.collisionRadius) || player.collisionRadius < 0) {
      throw new RangeError(`enemy target ${playerId} collision radius must be non-negative`)
    }
    if (!targetEligible(player)) continue
    const dx = player.position.x - position.x
    const dy = player.position.y - position.y
    const distance = dx * dx + dy * dy
    if (
      distance < selectedDistance
      || (distance === selectedDistance && (selected === null || playerId < selected))
    ) {
      selected = playerId
      selectedDistance = distance
    }
  }
  return selected
}

function targetEligible(target: BoneyardEnemyTargetCandidate): boolean {
  return target.alive && target.connected && target.eligible
}

function targetDistance(
  actor: BoneyardEnemyActor,
  players: BoneyardEnemyTargets,
): number {
  if (actor.targetPlayerId === null) return Number.POSITIVE_INFINITY
  const target = players[actor.targetPlayerId]
  if (!target) return Number.POSITIVE_INFINITY
  return Math.hypot(
    target.position.x - actor.position.x,
    target.position.y - actor.position.y,
  )
}

function targetWithinAttackReach(
  actor: BoneyardEnemyActor,
  players: BoneyardEnemyTargets,
  centerReach: number,
): boolean {
  return targetPlayerWithinAttackReach(
    actor,
    actor.targetPlayerId,
    players,
    centerReach,
  )
}

function targetPlayerWithinAttackReach(
  actor: BoneyardEnemyActor,
  targetPlayerId: string | null,
  players: BoneyardEnemyTargets,
  centerReach: number,
): boolean {
  if (targetPlayerId === null) return false
  const target = players[targetPlayerId]
  if (!target || !targetEligible(target)) return false
  return Math.hypot(
    target.position.x - actor.position.x,
    target.position.y - actor.position.y,
  ) <= Math.max(
    centerReach,
    actor.config.collisionRadius
      + target.collisionRadius
      + NATIVE_ACTOR_SEPARATION_EPSILON,
  )
}

function faceTarget(
  actor: BoneyardEnemyActor,
  players: BoneyardEnemyTargets,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) return actor
  const target = players[actor.targetPlayerId]
  if (!target) return actor
  const dx = target.position.x - actor.position.x
  const dy = target.position.y - actor.position.y
  return dx === 0 && dy === 0
    ? actor
    : { ...actor, headingDeg: actorHeadingFromVector(dx, dy) }
}

function targetHeading(
  position: Readonly<BoneyardPoint>,
  targetPlayerId: string | null,
  players: BoneyardEnemyTargets,
): number {
  const target = targetPlayerId === null ? undefined : players[targetPlayerId]
  return target
    ? actorHeadingFromVector(
        target.position.x - position.x,
        target.position.y - position.y,
      )
    : 0
}

function attackMarker(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
  targetPlayerId: string | null = actor.targetPlayerId,
): number {
  return emitEvent(work, tick, 'attack-marker', actor.id, {
    targetPlayerId,
  })
}

function directPlayerDamage(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  targetPlayerId: string | null,
  eventId: number,
): void {
  if (targetPlayerId === null || actor.config.primaryDamage === null) return
  const zombie = actor.config.enemyToken === 'ZOMBIE' ? actor.config.family : null
  work.playerDamage.push(Object.freeze({
    actorId: actor.id,
    amount: actor.config.primaryDamage,
    coldSlowTicks: 0,
    dazzleTicks: actor.config.enemyToken === 'WRAITH'
      ? NATIVE_WRAITH_DAZZLE_TICKS
      : 0,
    deflectable: true,
    damageKind: actor.config.enemyToken === 'SKELETONMAGE'
      || actor.config.enemyToken === 'WRAITH'
      ? 'magic'
      : 'physical',
    eventId,
    playerId: targetPlayerId,
    poisonDamage: zombie?.poisonPunchDamage ?? 0,
    poisonDuration: zombie?.poisonDuration ?? 0,
  }))
}

function emitArcherVolley(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  sourceRngState: number,
  context: BoneyardEnemyStoreStepContext,
): number {
  if (actor.config.enemyToken !== 'SKELETONARCHER' || actor.targetPlayerId === null) {
    return sourceRngState
  }
  const target = context.players[actor.targetPlayerId]
  if (!target || !targetEligible(target)) return sourceRngState
  const totalArrows = 1 + actor.config.family.extraArrows
  let rngState = sourceRngState
  for (let arrowIndex = 0; arrowIndex < totalArrows; arrowIndex += 1) {
    const random = nextBoneyardWaveRandom(rngState)
    rngState = random.state
    const headingDeg = boundedArcherAimHeading({
      accuracyMode: actor.config.family.accuracyMode,
      arrowIndex,
      arrowType: actor.config.family.arrowType,
      origin: actor.position,
      projectileSpeed: BOUNDED_ENEMY_PROJECTILE_PROGRAMS.arrow.speed,
      randomUnit: random.value,
      targetPosition: target.position,
      targetVelocityPerTick: target.velocityPerTick,
      totalArrows,
    })
    const poison = actor.config.family.arrowType === 'poison'
    spawnProjectile(
      work,
      actor,
      context.tick,
      'arrow',
      actor.config.primaryDamage ?? 0,
      {
        headingDeg,
        payload: projectilePayloadForArrow(actor.config.family.arrowType),
        poisonDamage: poison ? actor.config.secondaryDamage : 0,
        poisonDuration: poison ? BOUNDED_ENEMY_POISON_DURATION_SECONDS : 0,
        secondaryDamage: actor.config.family.arrowType === 'fire'
          ? actor.config.secondaryDamage
          : 0,
      },
    )
  }
  return rngState
}

function directContactPlayerDamage(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  targetPlayerId: string | null,
  players: BoneyardEnemyTargets,
  centerReach: number,
  eventId: number,
): void {
  if (!targetPlayerWithinAttackReach(actor, targetPlayerId, players, centerReach)) return
  directPlayerDamage(work, actor, targetPlayerId, eventId)
  if (actor.config.enemyToken === 'ZOMBIE' && targetPlayerId !== null) {
    const target = players[targetPlayerId]
    if (!target) return
    const dx = target.position.x - actor.position.x
    const dy = target.position.y - actor.position.y
    const distance = Math.hypot(dx, dy)
    const headingRadians = actor.headingDeg * Math.PI / 180
    const unitX = distance === 0 ? Math.sin(headingRadians) : dx / distance
    const unitY = distance === 0 ? -Math.cos(headingRadians) : dy / distance
    work.playerKnockbacks.push(Object.freeze({
      actorId: actor.id,
      delta: Object.freeze({
        x: unitX * BOUNDED_ZOMBIE_KNOCKBACK_DISTANCE,
        y: unitY * BOUNDED_ZOMBIE_KNOCKBACK_DISTANCE,
      }),
      eventId,
      playerId: targetPlayerId,
    }))
  }
}

interface MageLightningDispatch {
  readonly targetPlayerId: string
  readonly targetPosition: Readonly<BoneyardPoint>
}

function emitMageAttack(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
  eventId: number,
): MageLightningDispatch | null {
  if (actor.config.enemyToken !== 'SKELETONMAGE') return null
  switch (actor.config.family.element) {
    case 'fire':
      spawnProjectile(
        work,
        actor,
        context.tick,
        'firebolt',
        actor.config.primaryDamage ?? 0,
        { payload: 'fire' },
      )
      return null
    case 'frost':
      spawnProjectile(
        work,
        actor,
        context.tick,
        'guided-missile',
        actor.config.primaryDamage ?? 0,
        { coldSlowTicks: BOUNDED_ENEMY_COLD_SLOW_TICKS, payload: 'cold' },
      )
      return null
    case 'poison':
      spawnProjectile(
        work,
        actor,
        context.tick,
        'guided-missile',
        actor.config.primaryDamage ?? 0,
        {
          payload: 'poison',
          poisonDamage: actor.config.primaryDamage ?? 0,
          poisonDuration: BOUNDED_ENEMY_POISON_DURATION_SECONDS,
        },
      )
      return null
    case 'lightning': {
      const targetPlayerId = actor.targetPlayerId
      if (targetPlayerId === null) return null
      const target = context.players[targetPlayerId]
      if (!target || !targetEligible(target)) return null
      directPlayerDamage(work, actor, targetPlayerId, eventId)
      return Object.freeze({
        targetPlayerId,
        targetPosition: Object.freeze({ ...target.position }),
      })
    }
  }
}

function stepMageLightningPulse(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const brain = actor.brain
  if (brain.family !== 'mage' || brain.lightningTicksRemaining <= 0) return actor
  const targetPlayerId = brain.lightningTargetPlayerId
  const target = targetPlayerId === null ? undefined : context.players[targetPlayerId]
  const attachedTarget = target && targetEligible(target) ? target : null
  const targetPosition = attachedTarget?.position ?? brain.lightningTargetPosition
  if (targetPosition === null) {
    throw new Error('active Mage lightning is missing its preserved target position')
  }
  const pose = nativeMageBodyPose({
    actionProgress: brain.actionProgress,
    bodyPose: actor.bodyPose,
    castProgram: brain.castProgram,
    phase: brain.phase,
  })
  const source = nativeMageLightningSource(actor.position, pose, actor.headingDeg)
  if (!context.clipSpellSegment) {
    throw new Error('Mage lightning requires the exact spell-segment clip seam')
  }
  const clipped = context.clipSpellSegment({ end: targetPosition, start: source })
  validatePoint(clipped, 'clipped Mage lightning endpoint')
  const clearTarget = attachedTarget !== null
    && clipped.x === targetPosition.x
    && clipped.y === targetPosition.y
  const endpointBase = clearTarget ? targetPosition : clipped
  const endpointOffset = randomRadialDisplacement(work, 10)
  const contactOffset = randomRadialDisplacement(work, 15)
  const seed = work.rngState >>> 0
  const pulse: BoneyardMageLightningPulse = Object.freeze({
    contact: clearTarget
      ? Object.freeze({
          kind: 'target-attached' as const,
          localOffset: Object.freeze({ ...contactOffset }),
          targetPlayerId: targetPlayerId!,
        })
      : Object.freeze({
          kind: 'world' as const,
          position: Object.freeze({
            x: clipped.x + contactOffset.x,
            y: clipped.y + contactOffset.y,
          }),
        }),
    endpoint: Object.freeze({
      x: endpointBase.x + endpointOffset.x,
      y: endpointBase.y + endpointOffset.y,
    }),
    id: work.nextMageLightningPulseId,
    midpoint: Object.freeze({
      x: (actor.position.x + targetPosition.x) * 0.5,
      y: (actor.position.y + targetPosition.y) * 0.5,
    }),
    ownerActorId: actor.id,
    seed,
    source: Object.freeze({ ...source }),
    tick: context.tick,
  })
  work.mageLightningPulses.push(pulse)
  work.nextMageLightningPulseId += 1
  const lightningTicksRemaining = brain.lightningTicksRemaining - 1
  return {
    ...actor,
    brain: {
      ...brain,
      lightningTargetPlayerId: lightningTicksRemaining === 0 ? null : targetPlayerId,
      lightningTargetPosition: lightningTicksRemaining === 0
        ? null
        : Object.freeze({ ...targetPosition }),
      lightningTicksRemaining,
    },
  }
}

interface SpawnEnemyProjectileOptions {
  readonly coldSlowTicks?: number
  readonly headingDeg?: number
  readonly payload?: BoneyardEnemyProjectilePayload
  readonly poisonDamage?: number
  readonly poisonDuration?: number
  readonly secondaryDamage?: number
}

function spawnProjectile(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
  kind: BoneyardEnemyProjectileKind,
  damage: number,
  options: SpawnEnemyProjectileOptions = {},
): BoneyardEnemyProjectile {
  const program = BOUNDED_ENEMY_PROJECTILE_PROGRAMS[kind]
  const zombie = actor.config.enemyToken === 'ZOMBIE' ? actor.config.family : null
  const payload = options.payload ?? (kind === 'poison-pool' ? 'poison' : 'none')
  const lightManagerLane = enemyProjectileLightManagerLane(kind, payload)
  const settledTicksRemaining = kind === 'demon-bomb'
    ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombSettledCountdownMinimum
      + drawInteger(
          work,
          NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombSettledCountdownRandomCount,
        )
    : 0
  const minimumSpeed = kind === 'guided-missile'
    ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.guidedMinimumSpeedBase
      + drawUnit(work) * NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.guidedMinimumSpeedRange
    : 0
  const visualScale = kind === 'guided-missile'
    ? 0.9 + drawUnit(work) * 0.2
    : kind === 'poison-pool'
      ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.poisonPoolInitialScale
      : 1
  const speed = kind === 'demon-bomb'
    ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombSpeedMinimum
      + drawUnit(work) * NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombSpeedRange
    : program.speed
  const projectile: BoneyardEnemyProjectile = Object.freeze({
    ageTicks: 0,
    bounceVelocity: kind === 'demon-bomb'
      ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombInitialBounceVelocity
      : 0,
    coldSlowTicks: options.coldSlowTicks ?? 0,
    contactRadius: program.contactRadius,
    damage: kind === 'poison-pool' ? 0 : damage + (options.secondaryDamage ?? 0),
    headingDeg: options.headingDeg ?? actor.headingDeg,
    hitPlayerIds: Object.freeze([]),
    homing: program.homing,
    id: work.nextProjectileId,
    kind,
    lastStepTick: tick,
    lightRegistration: lightManagerLane === null
      ? null
      : work.registerProjectileLightProvider(lightManagerLane),
    lifetimeTicks: kind === 'demon-bomb' ? settledTicksRemaining : program.lifetimeTicks,
    minimumSpeed,
    nativeTypeId: projectileNativeTypeId(kind),
    ownerActorId: actor.id,
    payload,
    poisonDamage: kind === 'poison-pool' ? damage : (options.poisonDamage ?? 0),
    poisonDuration: kind === 'poison-pool'
      ? (zombie?.poisonDuration ?? 0)
      : (options.poisonDuration ?? 0),
    position: Object.freeze({ ...actor.position }),
    speed,
    settledTicksRemaining,
    spawnTick: tick,
    targetPlayerId: actor.targetPlayerId,
    verticalOffset: kind === 'demon-bomb'
      ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombInitialHeight
      : kind === 'arrow'
        ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.arrowInitialHeight
        : 0,
    verticalVelocity: 0,
    visualPhaseDeg: 0,
    visualScale,
  })
  work.nextProjectileId += 1
  work.projectiles.push(projectile)
  emitEvent(work, tick, 'projectile-spawned', actor.id, {
    projectileId: projectile.id,
    targetPlayerId: actor.targetPlayerId,
  })
  return projectile
}

interface SpawnProjectileEffectOptions {
  readonly alpha?: number
  readonly alphaLossPerTick?: number
  readonly angularVelocityDeg?: number
  readonly atlas?: BoneyardEnemyProjectileEffect['atlas']
  readonly blendMode?: BoneyardEnemyProjectileEffect['blendMode']
  readonly entry: number
  readonly lifetimeTicks: number
  readonly phaseOriginTicks?: number
  readonly rotationDeg?: number
  readonly scale?: number
  readonly tint?: number
  readonly velocity?: Readonly<BoneyardPoint>
}

function spawnProjectileEffect(
  work: WorkingStep,
  projectile: BoneyardEnemyProjectile,
  tick: number,
  position: Readonly<BoneyardPoint>,
  kind: BoneyardEnemyProjectileEffectKind,
  options: SpawnProjectileEffectOptions,
): void {
  work.projectileEffects.push(Object.freeze({
    ageTicks: 0,
    alpha: options.alpha ?? 1,
    alphaLossPerTick: options.alphaLossPerTick ?? 0,
    angularVelocityDeg: options.angularVelocityDeg ?? 0,
    atlas: options.atlas ?? 'BadGuys',
    blendMode: options.blendMode ?? 'normal',
    entry: options.entry,
    id: work.nextProjectileEffectId,
    kind,
    lastStepTick: tick,
    lifetimeTicks: options.lifetimeTicks,
    ownerActorId: projectile.ownerActorId,
    ownerProjectileId: projectile.id,
    phaseOriginTicks: options.phaseOriginTicks ?? projectile.ageTicks,
    position: Object.freeze({ ...position }),
    rotationDeg: options.rotationDeg ?? 0,
    scale: options.scale ?? 1,
    spawnTick: tick,
    tint: options.tint ?? 0xffffff,
    velocity: Object.freeze({ ...(options.velocity ?? { x: 0, y: 0 }) }),
  }))
  work.nextProjectileEffectId += 1
}

function stepProjectileEffects(
  work: WorkingStep,
  sourceEffects: readonly BoneyardEnemyProjectileEffect[],
  tick: number,
): void {
  for (const source of sourceEffects) {
    const elapsedTicks = tick - source.lastStepTick
    if (elapsedTicks <= 0) {
      work.projectileEffects.push(source)
      continue
    }
    const ageTicks = source.ageTicks + elapsedTicks
    if (ageTicks >= source.lifetimeTicks) continue
    let alpha = source.alpha - source.alphaLossPerTick * elapsedTicks
    let entry = source.entry
    const rotationDeg = source.rotationDeg + source.angularVelocityDeg * elapsedTicks
    switch (source.kind) {
      case 'firebolt-trail':
        break
      case 'fire-burst-glow':
        break
      case 'fire-burst-frame':
        entry = 251 + Math.min(3, Math.floor(ageTicks / 4))
        break
      case 'guided-impact-aura-one':
      case 'guided-impact-aura-two':
      case 'guided-impact-main':
        break
      case 'demon-fire':
        entry = 46 + positiveModulo(
          Math.floor(source.phaseOriginTicks + ageTicks * 0.25),
          32,
        )
        break
      case 'poison-pool-fade-inner': {
        const fade = Math.max(
          0,
          1 - ageTicks * NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.poisonPoolAlphaLossPerTick,
        )
        alpha = (Math.sin(
          (source.phaseOriginTicks + ageTicks) * Math.PI / 180,
        ) * 0.25 + 0.75) * fade
        break
      }
      case 'poison-pool-fade-outer': {
        alpha = 0.5 * Math.max(
          0,
          1 - ageTicks * NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.poisonPoolAlphaLossPerTick,
        )
        break
      }
    }
    if (alpha <= 0) continue
    work.projectileEffects.push(Object.freeze({
      ...source,
      ageTicks,
      alpha,
      entry,
      lastStepTick: tick,
      position: Object.freeze({
        x: source.position.x + source.velocity.x * elapsedTicks,
        y: source.position.y + source.velocity.y * elapsedTicks,
      }),
      rotationDeg,
    }))
  }
}

function spawnProjectileTrails(
  work: WorkingStep,
  projectile: BoneyardEnemyProjectile,
  end: Readonly<BoneyardPoint>,
  movementTicks: number,
  maximumProgress: number,
): void {
  if (movementTicks <= 0 || projectile.kind !== 'firebolt') return
  for (let offset = 1; offset <= movementTicks; offset += 1) {
    const progress = offset / movementTicks
    if (progress > maximumProgress) break
    const tick = projectile.lastStepTick + offset
    if (tick % NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.fireboltTrailCadenceTicks !== 0) {
      continue
    }
    const position = Object.freeze({
      x: projectile.position.x + (end.x - projectile.position.x) * progress,
      y: projectile.position.y + (end.y - projectile.position.y) * progress,
    })
    const jitterHeading = drawUnit(work) * Math.PI * 2
    const jitterMagnitude = drawUnit(work) * 5
    const alphaLossPerTick = 0.15 + drawUnit(work) * 0.05
    spawnProjectileEffect(work, projectile, tick, {
      x: position.x + Math.sin(jitterHeading) * jitterMagnitude,
      y: position.y - 15 - Math.cos(jitterHeading) * jitterMagnitude,
    }, 'firebolt-trail', {
      alphaLossPerTick,
      entry: 255 + (projectile.ageTicks + offset) % 12,
      lifetimeTicks: 8,
      phaseOriginTicks: projectile.ageTicks + offset,
      rotationDeg: projectile.headingDeg + 180,
      scale: 0.75 + drawUnit(work) * 0.25,
    })
  }
}

function spawnFireBurst(
  work: WorkingStep,
  projectile: BoneyardEnemyProjectile,
  tick: number,
  position: Readonly<BoneyardPoint>,
  baseScale: number,
): void {
  const scale = baseScale + (drawUnit(work) * 2 - 1) * 0.1
  const rotationDeg = drawUnit(work) * 360
  const angularDirection = drawUnit(work) < 0.5 ? -1 : 1
  const angularVelocityDeg = angularDirection * (0.5 + drawUnit(work))
  const burstPosition = Object.freeze({ x: position.x, y: position.y - 1 })
  spawnProjectileEffect(work, projectile, tick, burstPosition, 'fire-burst-glow', {
    alpha: 0.5,
    alphaLossPerTick: 0.5 / NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.fireBurstTicks,
    entry: 110,
    lifetimeTicks: NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.fireBurstTicks,
    scale: scale * 5,
    tint: 0xff8000,
    velocity: { x: 0, y: -1 },
  })
  spawnProjectileEffect(work, projectile, tick, burstPosition, 'fire-burst-frame', {
    angularVelocityDeg,
    blendMode: 'add',
    entry: 251,
    lifetimeTicks: NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.fireBurstTicks,
    rotationDeg,
    scale,
    tint: 0xffffbf,
    velocity: { x: 0, y: -1 },
  })
}

function spawnDemonFireHandoff(
  work: WorkingStep,
  projectile: BoneyardEnemyProjectile,
  tick: number,
  position: Readonly<BoneyardPoint>,
): void {
  const firstPhase = drawInteger(work, 32)
  spawnProjectileEffect(work, projectile, tick, {
    x: position.x,
    y: position.y - 10,
  }, 'demon-fire', {
    atlas: 'DeadHawg',
    blendMode: 'add',
    entry: 46 + firstPhase,
    lifetimeTicks: NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombFireTicks,
    phaseOriginTicks: firstPhase,
  })
  const side = drawUnit(work) < 0.5 ? -1 : 1
  const secondPhase = drawInteger(work, 32)
  spawnProjectileEffect(work, projectile, tick, {
    x: position.x + side * (10 + drawUnit(work) * 10),
    y: position.y + 5,
  }, 'demon-fire', {
    atlas: 'DeadHawg',
    blendMode: 'add',
    entry: 46 + secondPhase,
    lifetimeTicks: NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombFireTicks,
    phaseOriginTicks: secondPhase,
  })
}

function spawnProjectileImpactEffects(
  work: WorkingStep,
  projectile: BoneyardEnemyProjectile,
  tick: number,
  position: Readonly<BoneyardPoint>,
): void {
  switch (projectile.kind) {
    case 'arrow':
      if (projectile.payload === 'fire') spawnFireBurst(work, projectile, tick, position, 0.5)
      return
    case 'firebolt':
      spawnFireBurst(work, projectile, tick, position, 0.75)
      return
    case 'guided-missile': {
      const mainEntry = projectile.payload === 'cold' ? 110 : 111
      const auraTint = projectile.payload === 'cold' ? 0x4080ff : 0x40ff40
      const phaseDeg = drawUnit(work) * 360
      for (let index = 0; index < 2; index += 1) {
        spawnProjectileEffect(work, projectile, tick, position, 'guided-impact-main', {
          alpha: 2,
          alphaLossPerTick:
            NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.guidedImpactAlphaLossPerTick,
          blendMode: 'add',
          entry: mainEntry,
          lifetimeTicks: 20,
          rotationDeg: phaseDeg,
          scale: 2,
        })
      }
      for (const [kind, entry] of [
        ['guided-impact-aura-one', 111],
        ['guided-impact-aura-two', 112],
      ] as const) {
        spawnProjectileEffect(work, projectile, tick, position, kind, {
          alpha: 2,
          alphaLossPerTick:
            NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.guidedImpactAlphaLossPerTick,
          blendMode: 'add',
          entry,
          lifetimeTicks: 20,
          rotationDeg: phaseDeg,
          scale: 2,
          tint: auraTint,
        })
      }
      return
    }
    case 'demon-bomb':
      spawnDemonFireHandoff(work, projectile, tick, position)
      return
    case 'poison-pool': return
  }
}

function spawnPoisonPoolFade(
  work: WorkingStep,
  projectile: BoneyardEnemyProjectile,
  tick: number,
): void {
  const innerAlpha = (
    Math.sin(projectile.ageTicks * Math.PI / 180) * 0.25 + 0.75
  )
  spawnProjectileEffect(
    work,
    projectile,
    tick,
    projectile.position,
    'poison-pool-fade-outer',
    {
      alpha: 0.5,
      atlas: 'DeadHawg',
      entry: 0,
      lifetimeTicks: 200,
      phaseOriginTicks: projectile.ageTicks,
      scale: 1.6,
    },
  )
  spawnProjectileEffect(
    work,
    projectile,
    tick,
    projectile.position,
    'poison-pool-fade-inner',
    {
      alpha: innerAlpha,
      atlas: 'DeadHawg',
      entry: 0,
      lifetimeTicks: 200,
      phaseOriginTicks: projectile.ageTicks,
      scale: 1.2,
    },
  )
}

function stepDemonBomb(
  work: WorkingStep,
  source: BoneyardEnemyProjectile,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyProjectile | null {
  let projectile = source
  for (let tick = source.lastStepTick + 1; tick <= context.tick; tick += 1) {
    const direction = projectileDirection(projectile, projectile.targetPlayerId, context.players)
    const requestedPosition = Object.freeze({
      x: projectile.position.x + direction.x * projectile.speed,
      y: projectile.position.y + direction.y * projectile.speed,
    })
    const worldContact = context.firstProjectileWorldContact({
      end: requestedPosition,
      projectileId: projectile.id,
      radius: projectile.contactRadius,
      start: projectile.position,
    })
    if (
      worldContact !== null
      && (!Number.isFinite(worldContact) || worldContact < 0 || worldContact > 1)
    ) {
      throw new RangeError('enemy projectile world contact must be null or within [0, 1]')
    }
    const actorContact = firstProjectileContact(
      projectile.position,
      requestedPosition,
      projectile.contactRadius,
      context.players,
      new Set(),
    )
    const settled = worldContact !== null || actorContact !== null
    const position = worldContact === null
      ? requestedPosition
      : Object.freeze({
          x: projectile.position.x
            + (requestedPosition.x - projectile.position.x) * worldContact,
          y: projectile.position.y
            + (requestedPosition.y - projectile.position.y) * worldContact,
        })
    let speed = settled
      ? 0
      : projectile.speed
        * NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombDampingPerTick
    let verticalOffset = projectile.verticalOffset + projectile.verticalVelocity
    let verticalVelocity = projectile.verticalVelocity
      + NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombGravityPerTick
    let bounceVelocity = projectile.bounceVelocity
    if (verticalOffset > 0) {
      verticalOffset = 0
      bounceVelocity *= NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombBounceMultiplier
      verticalVelocity = bounceVelocity
      if (verticalVelocity > -0.1) verticalVelocity = 0
    }
    if (bounceVelocity > -1) {
      speed *= NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombSettledDampingPerTick
    }
    const settledTicksRemaining = projectile.settledTicksRemaining - (speed < 1 ? 1 : 0)
    const ageTicks = projectile.ageTicks + 1
    projectile = Object.freeze({
      ...projectile,
      ageTicks,
      bounceVelocity,
      lastStepTick: tick,
      position,
      settledTicksRemaining,
      speed,
      verticalOffset,
      verticalVelocity,
    })
    if (settledTicksRemaining > 0) continue

    spawnDemonFireHandoff(work, projectile, tick, position)
    const eventId = emitEvent(work, tick, 'projectile-impact', projectile.ownerActorId, {
      projectileId: projectile.id,
      targetPlayerId: null,
    })
    for (const [playerId, player] of Object.entries(context.players)) {
      if (!targetEligible(player)) continue
      if (Math.hypot(
        player.position.x - position.x,
        player.position.y - position.y,
      ) > projectile.contactRadius + player.collisionRadius) continue
      work.playerDamage.push(Object.freeze({
        actorId: projectile.ownerActorId,
        amount: projectile.damage,
        coldSlowTicks: 0,
        dazzleTicks: 0,
        deflectable: true,
        damageKind: 'magic',
        eventId,
        playerId,
        poisonDamage: 0,
        poisonDuration: 0,
      }))
    }
    emitEvent(work, tick, 'projectile-retired', projectile.ownerActorId, {
      projectileId: projectile.id,
      targetPlayerId: null,
    })
    return null
  }
  return projectile
}

function guidedMotion(
  projectile: BoneyardEnemyProjectile,
  ticks: number,
): Readonly<{ distance: number; phaseDeg: number; speed: number }> {
  let distance = 0
  let phaseDeg = projectile.visualPhaseDeg
  let speed = projectile.speed
  for (let index = 0; index < ticks; index += 1) {
    distance += speed
    phaseDeg += speed * 6
    speed = Math.max(
      projectile.minimumSpeed,
      speed - NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.guidedSpeedLossPerTick,
    )
  }
  return { distance, phaseDeg, speed }
}

function stepProjectiles(
  work: WorkingStep,
  context: BoneyardEnemyStoreStepContext,
): void {
  const retained: BoneyardEnemyProjectile[] = []
  for (const source of work.projectiles) {
    if (source.lastStepTick >= context.tick) {
      retained.push(source)
      continue
    }
    if (source.kind === 'demon-bomb') {
      const projectile = stepDemonBomb(work, source, context)
      if (projectile) retained.push(projectile)
      continue
    }
    const elapsedTicks = context.tick - source.lastStepTick
    const movementTicks = Math.min(
      elapsedTicks,
      Math.max(0, source.lifetimeTicks - source.ageTicks),
    )
    const ageTicks = source.ageTicks + movementTicks
    const priorTarget = source.targetPlayerId === null
      ? undefined
      : context.players[source.targetPlayerId]
    const targetPlayerId = source.homing
      ? priorTarget && targetEligible(priorTarget)
        ? source.targetPlayerId
        : nearestEligibleTarget(source.position, context.players)
      : source.targetPlayerId
    const direction = projectileDirection(source, targetPlayerId, context.players)
    const motion = source.kind === 'guided-missile'
      ? guidedMotion(source, movementTicks)
      : {
          distance: source.speed * movementTicks,
          phaseDeg: source.visualPhaseDeg,
          speed: source.speed,
        }
    const visualScale = source.kind === 'poison-pool'
      ? Math.min(
          NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.poisonPoolMaximumScale,
          source.visualScale
            + movementTicks * NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.poisonPoolGrowthPerTick,
        )
      : source.visualScale
    const requestedPosition = Object.freeze({
      x: source.position.x + direction.x * motion.distance,
      y: source.position.y + direction.y * motion.distance,
    })
    const contact = firstProjectileContact(
      source.position,
      requestedPosition,
      source.contactRadius,
      context.players,
      new Set(source.hitPlayerIds),
    )
    const worldContact = source.kind === 'poison-pool'
      ? null
      : context.firstProjectileWorldContact({
          end: requestedPosition,
          projectileId: source.id,
          radius: source.contactRadius,
          start: source.position,
        })
    if (
      worldContact !== null
      && (!Number.isFinite(worldContact) || worldContact < 0 || worldContact > 1)
    ) {
      throw new RangeError('enemy projectile world contact must be null or within [0, 1]')
    }
    const terminalProgress = Math.min(
      worldContact ?? 1,
      contact?.progress ?? 1,
    )
    spawnProjectileTrails(
      work,
      source,
      requestedPosition,
      movementTicks,
      terminalProgress,
    )
    if (
      worldContact !== null
      && (contact === null || worldContact <= contact.progress)
    ) {
      const impactPosition = Object.freeze({
        x: source.position.x
          + (requestedPosition.x - source.position.x) * worldContact,
        y: source.position.y
          + (requestedPosition.y - source.position.y) * worldContact,
      })
      spawnProjectileImpactEffects(work, source, context.tick, impactPosition)
      emitEvent(work, context.tick, 'projectile-impact', source.ownerActorId, {
        projectileId: source.id,
        targetPlayerId: null,
      })
      emitEvent(work, context.tick, 'projectile-retired', source.ownerActorId, {
        projectileId: source.id,
        targetPlayerId: null,
      })
      continue
    }
    if (contact !== null) {
      const impactPosition = Object.freeze({
        x: source.position.x
          + (requestedPosition.x - source.position.x) * contact.progress,
        y: source.position.y
          + (requestedPosition.y - source.position.y) * contact.progress,
      })
      spawnProjectileImpactEffects(work, source, context.tick, impactPosition)
      const eventId = emitEvent(work, context.tick, 'projectile-impact', source.ownerActorId, {
        projectileId: source.id,
        targetPlayerId: contact.playerId,
      })
      work.playerDamage.push(Object.freeze({
        actorId: source.ownerActorId,
        amount: source.damage,
        coldSlowTicks: source.coldSlowTicks,
        dazzleTicks: 0,
        deflectable: source.kind !== 'poison-pool',
        damageKind: source.kind === 'arrow' ? 'physical' : 'magic',
        eventId,
        playerId: contact.playerId,
        poisonDamage: source.poisonDamage,
        poisonDuration: source.poisonDuration,
      }))
      if (source.kind !== 'poison-pool') {
        emitEvent(work, context.tick, 'projectile-retired', source.ownerActorId, {
          projectileId: source.id,
          targetPlayerId: contact.playerId,
        })
        continue
      }
      const hitPlayerIds = Object.freeze([...source.hitPlayerIds, contact.playerId].sort())
      if (ageTicks < source.lifetimeTicks) {
        retained.push(Object.freeze({
          ...source,
          ageTicks,
          headingDeg: direction.headingDeg,
          hitPlayerIds,
          lastStepTick: context.tick,
          position: requestedPosition,
          speed: motion.speed,
          targetPlayerId,
          visualPhaseDeg: motion.phaseDeg,
          visualScale,
        }))
        continue
      }
    }
    if (ageTicks >= source.lifetimeTicks) {
      if (source.kind === 'poison-pool') {
        spawnPoisonPoolFade(work, {
          ...source,
          ageTicks,
          position: requestedPosition,
          visualScale,
        }, context.tick)
      }
      emitEvent(work, context.tick, 'projectile-retired', source.ownerActorId, {
        projectileId: source.id,
        targetPlayerId,
      })
      continue
    }
    retained.push(Object.freeze({
      ...source,
      ageTicks,
      headingDeg: direction.headingDeg,
      lastStepTick: context.tick,
      position: requestedPosition,
      speed: motion.speed,
      targetPlayerId,
      visualPhaseDeg: motion.phaseDeg,
      visualScale,
    }))
  }
  work.projectiles = retained
}

function projectileDirection(
  projectile: BoneyardEnemyProjectile,
  targetPlayerId: string | null,
  players: BoneyardEnemyTargets,
): Readonly<BoneyardPoint> & { readonly headingDeg: number } {
  const target = targetPlayerId === null ? undefined : players[targetPlayerId]
  if (projectile.homing && target && targetEligible(target)) {
    const dx = target.position.x - projectile.position.x
    const dy = target.position.y - projectile.position.y
    const length = Math.hypot(dx, dy)
    if (length > 0) {
      return {
        headingDeg: actorHeadingFromVector(dx, dy),
        x: dx / length,
        y: dy / length,
      }
    }
  }
  const radians = projectile.headingDeg * Math.PI / 180
  return {
    headingDeg: projectile.headingDeg,
    x: Math.sin(radians),
    y: -Math.cos(radians),
  }
}

function firstProjectileContact(
  start: Readonly<BoneyardPoint>,
  end: Readonly<BoneyardPoint>,
  radius: number,
  players: BoneyardEnemyTargets,
  excludedPlayerIds: ReadonlySet<string>,
): { playerId: string; progress: number } | null {
  let selected: { playerId: string; progress: number } | null = null
  for (const [playerId, player] of Object.entries(players)) {
    if (!targetEligible(player) || excludedPlayerIds.has(playerId)) continue
    const progress = segmentCircleEntry(
      start,
      end,
      player.position,
      radius + player.collisionRadius,
    )
    if (progress === null) continue
    if (
      selected === null
      || progress < selected.progress
      || (progress === selected.progress && playerId < selected.playerId)
    ) selected = { playerId, progress }
  }
  return selected
}

function segmentCircleEntry(
  start: Readonly<BoneyardPoint>,
  end: Readonly<BoneyardPoint>,
  center: Readonly<BoneyardPoint>,
  radius: number,
): number | null {
  const segmentX = end.x - start.x
  const segmentY = end.y - start.y
  const offsetX = start.x - center.x
  const offsetY = start.y - center.y
  const radiusSquared = radius * radius
  const offsetSquared = offsetX * offsetX + offsetY * offsetY
  if (offsetSquared <= radiusSquared) return 0

  const segmentSquared = segmentX * segmentX + segmentY * segmentY
  if (segmentSquared === 0) return null

  const linear = 2 * (offsetX * segmentX + offsetY * segmentY)
  const discriminant = linear * linear
    - 4 * segmentSquared * (offsetSquared - radiusSquared)
  if (discriminant < 0) return null

  const root = Math.sqrt(discriminant)
  const first = (-linear - root) / (2 * segmentSquared)
  const second = (-linear + root) / (2 * segmentSquared)
  if (first >= 0 && first <= 1) return first
  if (second >= 0 && second <= 1) return second
  return null
}

function projectileNativeTypeId(
  kind: BoneyardEnemyProjectileKind,
): BoneyardEnemyProjectile['nativeTypeId'] {
  switch (kind) {
    case 'arrow': return 0x7da
    case 'firebolt': return 0x7eb
    case 'guided-missile': return 0x7ec
    case 'demon-bomb': return 0x7f7
    case 'poison-pool': return 0x806
  }
}

function stepDyingActor(
  work: WorkingStep,
  source: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor | null {
  const tick = context.tick
  emitEvent(work, tick, 'enemy-death', source.id)
  const output = terminalOutput(source.config.enemyToken)
  const outputCount = terminalOutputCount(work, source)
  emitEvent(work, tick, 'enemy-terminal-output', source.id, {
    count: outputCount,
    output,
  })
  context.retirementObserver?.onTerminalOutput(output, outputCount)
  emitEnemyDeathSounds(work, source, tick, outputCount)
  spawnEnemyDeathEffects(work, source, tick)
  spawnTerminalChildren(work, source, context)
  if (
    source.config.enemyToken === 'ZOMBIE'
    && source.config.family.rotten
    && source.config.family.poisonPoolDamage > 0
  ) {
    spawnProjectile(
      work,
      source,
      tick,
      'poison-pool',
      source.config.family.poisonPoolDamage,
    )
  }
  const rewardEventId = emitEvent(work, tick, 'reward', source.id, {
    targetPlayerId: source.lastDamagedByPlayerId,
  })
  work.rewards.push(Object.freeze({
    actorId: source.id,
    eventId: rewardEventId,
    experience: source.config.experience,
    lootSource: Object.freeze({
      actorSeed: source.lootSeed,
      enemyToken: source.config.enemyToken,
      participantSlot: 0 as const,
      position: Object.freeze({ ...source.position }),
    }),
    playerId: source.lastDamagedByPlayerId,
  }))
  const eventId = emitEvent(work, tick, 'enemy-retired', source.id)
  work.retired.push(Object.freeze({ actorId: source.id, eventId }))
  return null
}

function stepDeathEffects(
  work: WorkingStep,
  source: readonly BoneyardEnemyDeathEffect[],
  tick: number,
): void {
  for (const original of source) {
    let effect: BoneyardEnemyDeathEffect | null = original
    for (let stepTick = original.lastStepTick + 1; stepTick <= tick; stepTick += 1) {
      const next = stepDeathEffect(work, effect, stepTick)
      if (next === null) {
        effect = null
        break
      }
      effect = next
    }
    if (effect) work.deathEffects.push(effect)
  }
}

function stepDeathEffect(
  work: WorkingStep,
  source: BoneyardEnemyDeathEffect,
  tick: number,
): BoneyardEnemyDeathEffect | null {
  if (tick <= source.spawnTick) {
    return { ...source, ageTicks: 0, lastStepTick: tick }
  }
  const ageTicks = Math.max(0, tick - source.spawnTick)
  if (ageTicks >= source.lifetimeTicks) return null

  if (source.kind === 'bouncer') {
    if (source.height < 0 && tick % 3 === 0) {
      return { ...source, ageTicks, lastStepTick: tick }
    }
    let position = {
      x: source.position.x + source.velocity.x,
      y: source.position.y + source.velocity.y,
    }
    let velocity = { ...source.velocity }
    let height = source.height + source.verticalVelocity
    let verticalVelocity = source.verticalVelocity + 0.4
    let bounceVelocity = source.bounceVelocity
    let angularVelocityDeg = source.angularVelocityDeg
    let rotationDeg = source.rotationDeg + angularVelocityDeg
    const opacityTimer = source.opacityTimer - source.alphaLossPerTick
    if (height >= 0) {
      height = 0
      bounceVelocity *= 0.65
      verticalVelocity = bounceVelocity
      if (drawUnit(work) < 0.5) {
        velocity = { x: velocity.x * 0.65, y: velocity.y * 0.65 }
      }
      if (verticalVelocity > -0.75) {
        verticalVelocity = 0
        angularVelocityDeg = 0
        velocity = { x: 0, y: 0 }
        position = { ...position }
      }
    }
    if (opacityTimer <= 0) return null
    return Object.freeze({
      ...source,
      ageTicks,
      alpha: Math.min(1, opacityTimer),
      angularVelocityDeg,
      bounceVelocity,
      height,
      lastStepTick: tick,
      opacityTimer,
      position: Object.freeze(position),
      rotationDeg,
      verticalVelocity,
      velocity: Object.freeze(velocity),
    })
  }

  const opacityTimer = source.opacityTimer - source.alphaLossPerTick
  if (opacityTimer <= 0) return null
  const position = source.kind === 'move-fade'
    || (source.kind === 'sprite-array'
      && (source.velocity.x !== 0 || source.velocity.y !== 0))
    ? {
        x: source.position.x + source.velocity.x,
        y: source.position.y + source.velocity.y,
      }
    : source.position
  const frame = Math.min(
    source.frameCount - 1,
    Math.floor(ageTicks / source.frameTicks),
  )
  const entry = source.kind === 'sprite-array'
    ? source.firstEntry + frame
    : source.kind === 'fire-array'
      ? 46 + positiveModulo(source.firstEntry - 46 + frame, 32)
      : source.entry
  return Object.freeze({
    ...source,
    ageTicks,
    alpha: opacityTimer,
    entry,
    lastStepTick: tick,
    opacityTimer,
    position: Object.freeze({ ...position }),
    rotationDeg: source.rotationDeg + source.angularVelocityDeg,
    scale: source.kind === 'banish' ? source.scale * 1.025 : source.scale,
  })
}

function spawnEnemyDeathEffects(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
): void {
  switch (actor.config.enemyToken) {
    case 'SKELETON':
    case 'SKELETONARCHER':
    case 'SKELETONMAGE':
      spawnSkeletonShatter(work, actor, tick)
      return
    case 'IMP':
      spawnUnbind(work, actor, tick)
      spawnSimpleDeathEffect(work, actor, tick, {
        alpha: 1,
        alphaLossPerTick: 1 / 24,
        atlas: 'BadGuys',
        blendMode: 'add',
        entry: 15,
        kind: 'banish',
        lifetimeTicks: 24,
        role: 'imp-banish',
        scale: 1.25,
      })
      spawnSpriteArray(work, actor, tick, 'imp-sprite-array', 401, 19, 1)
      return
    case 'ZOMBIE':
      for (const entry of [2088, 2089, 2091, 2093, 2293, 2297]) {
        spawnRadialBouncer(work, actor, tick, entry, 'zombie-fragment')
      }
      spawnUnbind(work, actor, tick)
      spawnSimpleDeathEffect(work, actor, tick, {
        alpha: 1,
        alphaLossPerTick: 1 / 36,
        atlas: 'DeadHawg',
        blendMode: 'normal',
        entry: 30,
        kind: 'move-fade',
        lifetimeTicks: 36,
        role: 'zombie-clipped-fade',
        scale: 1,
      })
      return
    case 'WRAITH':
      for (const entry of SKELETON_BASE_FRAGMENT_ENTRIES) {
        spawnRadialBouncer(work, actor, tick, entry, 'wraith-smoky-fragment')
      }
      spawnRadialBouncer(work, actor, tick, 1819 + drawInteger(work, 4), 'wraith-skull')
      spawnUnbind(work, actor, tick)
      for (let index = 0; index < 12; index += 1) {
        const angle = index * 30
        const velocity = radialVector(angle, 1.25)
        spawnSimpleDeathEffect(work, actor, tick, {
          alpha: 0.75,
          alphaLossPerTick: 0.025,
          atlas: 'BadGuys',
          blendMode: 'add',
          entry: 10 + index % 2,
          kind: 'move-fade',
          lifetimeTicks: 30,
          role: 'wraith-dissolve-ray',
          scale: 1 + drawUnit(work) * 0.25,
          velocity,
        })
      }
      spawnSimpleDeathEffect(work, actor, tick, {
        alpha: 1,
        alphaLossPerTick: 1 / 36,
        atlas: 'BadGuys',
        blendMode: 'add',
        entry: 21,
        kind: 'fade',
        lifetimeTicks: 36,
        role: 'wraith-dissolve-core',
        scale: 1.5,
      })
      for (let index = 0; index < 12; index += 1) {
        spawnRadialBouncer(work, actor, tick, 27, 'wraith-dissolve-bouncer')
      }
      return
    case 'DEMON':
      spawnSimpleDeathEffect(work, actor, tick, {
        alpha: 1,
        alphaLossPerTick: 1 / 49,
        atlas: 'BadGuys',
        blendMode: 'add',
        entry: 15,
        kind: 'banish',
        lifetimeTicks: 49,
        role: 'demon-banish',
        scale: 2,
      })
      spawnSpriteArray(work, actor, tick, 'demon-sprite-array', 401, 19, 2)
      spawnSpriteArray(work, actor, tick, 'demon-death-body', 55, 7, 7, {
        atlas: 'Demon',
        blendMode: 'normal',
      })
      for (const delay of [0, 20, 40, 60, 80]) {
        const phase = drawInteger(work, 32)
        const displacement = randomRadialDisplacement(work, (100 - delay) / 20)
        spawnSpriteArray(
          work,
          actor,
          tick,
          `demon-death-fire:${delay}`,
          46 + phase,
          32,
          4,
          {
            atlas: 'DeadHawg',
            blendMode: 'add',
            kind: 'fire-array',
            position: {
              x: actor.position.x + displacement.x,
              y: actor.position.y + displacement.y - 20,
            },
            spawnDelayTicks: delay,
          },
        )
      }
      const burstScale = 0.9 + drawUnit(work) * 0.2
      spawnSimpleDeathEffect(work, actor, tick, {
        alpha: 0.5,
        alphaLossPerTick: 0.5 / NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.fireBurstTicks,
        atlas: 'BadGuys',
        blendMode: 'normal',
        entry: 110,
        kind: 'fade',
        lifetimeTicks: NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.fireBurstTicks,
        position: { x: actor.position.x, y: actor.position.y - 1 },
        role: 'demon-death-fire-burst-glow',
        scale: burstScale * 5,
        spawnDelayTicks: 95,
        tint: 0xff8000,
        velocity: { x: 0, y: -1 },
      })
      spawnSpriteArray(work, actor, tick, 'demon-death-fire-burst-frame', 251, 4, 4, {
        alphaLossPerTick: 0,
        blendMode: 'add',
        lifetimeTicks: NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.fireBurstTicks,
        position: { x: actor.position.x, y: actor.position.y - 1 },
        scale: burstScale,
        spawnDelayTicks: 95,
        tint: 0xffffbf,
        velocity: { x: 0, y: -1 },
      })
      return
    case 'COFFIN': {
      for (const entry of SKELETON_BASE_FRAGMENT_ENTRIES) {
        spawnRadialBouncer(work, actor, tick, entry, 'coffin-bone')
      }
      spawnRadialBouncer(work, actor, tick, 1819 + drawInteger(work, 4), 'coffin-skull')
      const mainCount = 40 + drawInteger(work, 11)
      for (let index = 0; index < mainCount; index += 1) {
        spawnRadialBouncer(
          work,
          actor,
          tick,
          2013 + drawInteger(work, 50),
          'coffin-main-fragment',
        )
      }
      const extraCount = 12 + drawInteger(work, 5)
      for (let index = 0; index < extraCount; index += 1) {
        const fragment = COFFIN_EXTRA_FRAGMENT_RECORDS[
          drawInteger(work, COFFIN_EXTRA_FRAGMENT_RECORDS.length)
        ]!
        spawnRadialBouncer(
          work,
          actor,
          tick,
          fragment.entry,
          'coffin-extra-fragment',
          1,
          fragment.atlas,
        )
      }
      spawnUnbind(work, actor, tick)
    }
  }
}

const SKELETON_BASE_FRAGMENT_ENTRIES = Object.freeze([
  113, 113, 113, 115, 118, 121, 120, 119, 116,
  121, 120, 119, 116, 117, 117, 117, 117, 117,
] as const)

const COFFIN_EXTRA_FRAGMENT_RECORDS = Object.freeze([
  ...Array.from({ length: 31 }, (_, index) => ({
    atlas: 'DeadHawg' as const,
    entry: 114 + index,
  })),
  ...Array.from({ length: 3 }, (_, index) => ({
    atlas: 'BadGuys' as const,
    entry: 2067 + index,
  })),
])

function emitEnemyDeathSounds(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
  outputCount: number | undefined,
): void {
  switch (actor.config.enemyToken) {
    case 'SKELETON':
    case 'SKELETONARCHER':
    case 'SKELETONMAGE':
      emitEnemyDeathSound(work, tick, actor, 'skeleton-die', 0.8 + drawUnit(work) * 0.2)
      return
    case 'IMP':
      if (outputCount === NATIVE_IMP_SPLIT_CHILD_COUNT) {
        emitEnemyDeathSound(work, tick, actor, 'imp-split', 0.9 + drawUnit(work) * 0.2)
      } else {
        emitEnemyDeathSound(work, tick, actor, 'firey-death', 0.8 + drawUnit(work) * 0.2)
      }
      return
    case 'ZOMBIE':
      if (actor.config.family.rotten) {
        for (let index = 0; index < 3; index += 1) {
          emitEnemyDeathSound(
            work,
            tick,
            actor,
            'zombie-poison-splat',
            0.9 + drawUnit(work) * 0.15,
          )
        }
      }
      emitEnemyDeathSound(work, tick, actor, 'zombie-die', 0.8 + drawUnit(work) * 0.2)
      emitEnemyDeathSound(
        work,
        tick,
        actor,
        'zombie-die-groan',
        0.8 + drawUnit(work) * 0.2,
      )
      return
    case 'WRAITH':
      emitEnemyDeathSound(work, tick, actor, 'flash', 1)
      emitEnemyDeathSound(work, tick, actor, 'banshee-die', 0.9 + drawUnit(work) * 0.2)
      emitEnemyDeathSound(work, tick, actor, 'banshee-die', 0.9 + drawUnit(work) * 0.2)
      emitEnemyDeathSound(work, tick, actor, 'banshee-die', 0.8 + drawUnit(work) * 0.4)
      return
    case 'DEMON':
      emitEnemyDeathSound(work, tick, actor, 'flash', 1)
      emitEnemyDeathSound(work, tick, actor, 'demon-die', 1)
      emitEnemyDeathSound(work, tick, actor, 'firey-death', 0.8 + drawUnit(work) * 0.2)
      return
    case 'COFFIN':
      emitEnemyDeathSound(work, tick, actor, 'coffin-break', 1 + drawUnit(work) * 0.1)
  }
}

function emitEnemyDeathSound(
  work: WorkingStep,
  tick: number,
  actor: DeathEffectOwner,
  sound: BoneyardEnemyDeathSound,
  pitch: number,
  gainScale = 1,
): void {
  emitEvent(work, tick, 'enemy-death-sound', actor.id, {
    gainScale,
    pitch,
    sound,
    sourcePosition: { ...actor.position },
  })
}

function spawnSkeletonShatter(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
): void {
  const entries = [...SKELETON_BASE_FRAGMENT_ENTRIES]
  for (let index = entries.length - 1; index > 0; index -= 1) {
    const swap = drawInteger(work, index + 1)
    ;[entries[index], entries[swap]] = [entries[swap]!, entries[index]!]
  }
  let angleDeg = drawUnit(work) * 360
  for (const entry of entries) {
    spawnSkeletonFragmentBouncer(
      work,
      actor,
      tick,
      entry,
      'skeleton-bone',
      angleDeg,
      1.2,
    )
    angleDeg += 72 + (drawUnit(work) * 20 - 10)
  }
  spawnSkeletonEquipmentEffects(work, actor, tick)
  spawnRadialBouncer(
    work,
    actor,
    tick,
    1819 + drawInteger(work, 4),
    'skeleton-skull',
    2,
  )
  spawnUnbind(work, actor, tick)
}

function spawnSkeletonEquipmentEffects(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
): void {
  if (
    actor.config.enemyToken === 'SKELETON'
    || actor.config.enemyToken === 'SKELETONARCHER'
    || actor.config.enemyToken === 'SKELETONMAGE'
  ) {
    const headgear = actor.config.family.headgear
    if (headgear === 1 || headgear === 2) {
      const firstEntry = headgear === 1 ? 92 : 94
      spawnSkeletonFragmentBouncer(
        work,
        actor,
        tick,
        firstEntry + drawInteger(work, 2),
        'skeleton-headgear-fragment',
        drawUnit(work) * 360,
        1.2,
      )
    }
  }
  if (actor.config.enemyToken !== 'SKELETON') return

  const weaponEntry = skeletonWeaponDeathEntry(actor.config.family.weapon)
  if (weaponEntry !== null) {
    spawnSkeletonFragmentBouncer(
      work,
      actor,
      tick,
      weaponEntry,
      'skeleton-weapon-fragment',
      drawUnit(work) * 360,
    )
  } else if (actor.config.family.weapon === 'pike') {
    spawnSimpleDeathEffect(work, actor, tick, {
      alpha: 1,
      alphaLossPerTick: 1 / 25,
      atlas: 'BadGuys',
      blendMode: 'add',
      entry: 15,
      kind: 'fade',
      lifetimeTicks: 25,
      role: 'skeleton-pike-flash',
      scale: 3,
    })
    for (let index = 0; index < 7; index += 1) {
      spawnSkeletonFragmentBouncer(
        work,
        actor,
        tick,
        55,
        'skeleton-pike-fragment',
        drawUnit(work) * 360,
        1,
        1.5,
      )
    }
  }

  if (!actor.config.family.armor) return
  for (const firstEntry of [100, 102, 104, 106, 108]) {
    spawnSkeletonFragmentBouncer(
      work,
      actor,
      tick,
      firstEntry + drawInteger(work, 2),
      'skeleton-armor-fragment',
      drawUnit(work) * 360,
    )
  }
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha: 1,
    alphaLossPerTick: 1 / 25,
    atlas: 'BadGuys',
    blendMode: 'add',
    entry: 15,
    kind: 'fade',
    lifetimeTicks: 25,
    position: { x: actor.position.x, y: actor.position.y - 35 },
    role: 'skeleton-armor-flash',
    scale: 3,
  })
}

function skeletonWeaponDeathEntry(weapon: BoneyardSkeletonWeapon): number | null {
  switch (weapon) {
    case 'axe':
      return 2066
    case 'flail':
      return 2065
    case 'mace':
      return 2064
    case 'sword':
      return 2063
    case 'claw':
    case 'pike':
      return null
  }
}

function spawnSkeletonFragmentBouncer(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
  entry: number,
  role: string,
  angleDeg: number,
  scale = 1,
  opacityTimer = 10,
): void {
  const velocity = radialVector(angleDeg, 1)
  velocity.x *= 1.5
  const distance = 15 + drawInteger(work, 11)
  spawnBouncer(work, actor, tick, entry, role, {
    opacityTimer,
    position: {
      x: actor.position.x + velocity.x * (distance + 2),
      y: actor.position.y + velocity.y * distance,
    },
    scale,
    velocity,
  })
}

function spawnRadialBouncer(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
  entry: number,
  role: string,
  speed = 1,
  atlas: BoneyardEnemyDeathEffect['atlas'] = 'BadGuys',
): void {
  spawnBouncer(work, actor, tick, entry, role, {
    atlas,
    velocity: radialVector(drawUnit(work) * 360, speed),
  })
}

function spawnBouncer(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
  entry: number,
  role: string,
  options: {
    atlas?: BoneyardEnemyDeathEffect['atlas']
    opacityTimer?: number
    position?: Readonly<BoneyardPoint>
    scale?: number
    velocity?: Readonly<BoneyardPoint>
  } = {},
): void {
  const verticalVelocity = -(drawInteger(work, 4) + 2)
  const opacityTimer = options.opacityTimer ?? 10
  const effect: BoneyardEnemyDeathEffect = Object.freeze({
    ageTicks: 0,
    alpha: 1,
    alphaLossPerTick: 0.015,
    angularVelocityDeg: drawUnit(work) * 10 + 1,
    atlas: options.atlas ?? 'BadGuys',
    blendMode: 'normal',
    bounceVelocity: verticalVelocity,
    entry,
    firstEntry: entry,
    frameCount: 1,
    frameTicks: 1,
    height: -drawInteger(work, 21),
    id: work.nextDeathEffectId,
    kind: 'bouncer',
    lastStepTick: tick,
    lifetimeTicks: 1_000,
    opacityTimer,
    ownerActorId: actor.id,
    position: Object.freeze({ ...(options.position ?? actor.position) }),
    role,
    rotationDeg: drawUnit(work) * 360,
    scale: options.scale ?? 1,
    shadow: true,
    spawnTick: tick,
    tint: 0xffffff,
    verticalVelocity,
    velocity: Object.freeze({ ...(options.velocity ?? { x: 0, y: 0 }) }),
  })
  work.nextDeathEffectId += 1
  work.deathEffects.push(effect)
}

function spawnUnbind(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
): void {
  const { alpha, alphaLossPerTick } = primaryOnlyUnbindClock(actor.config.enemyToken)
  const clockwise = drawUnit(work) >= 0.5
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha,
    alphaLossPerTick,
    angularVelocityDeg: clockwise
      ? 5 + drawUnit(work) * 2.5
      : -(2.5 + drawUnit(work) * 2.5),
    atlas: 'BadGuys',
    blendMode: 'add',
    entry: 86,
    kind: 'unbind',
    lifetimeTicks: Math.ceil(alpha / alphaLossPerTick),
    position: { x: actor.position.x, y: actor.position.y - 15 },
    role: 'death-unbind-star',
    rotationDeg: drawUnit(work) * 360,
    scale: 1,
  })
}

function primaryOnlyUnbindClock(
  enemyToken: BoneyardWaveEnemyToken,
): Readonly<{ alpha: number; alphaLossPerTick: number }> {
  switch (enemyToken) {
    case 'SKELETON':
    case 'SKELETONARCHER':
    case 'SKELETONMAGE':
      return { alpha: 0.75, alphaLossPerTick: 0.0225 }
    case 'IMP':
    case 'WRAITH':
      return { alpha: 1, alphaLossPerTick: 0.025 }
    case 'ZOMBIE':
      return { alpha: 0.75, alphaLossPerTick: 0.05 }
    case 'COFFIN':
      return { alpha: 0.75, alphaLossPerTick: 0.045 }
    case 'DEMON':
      throw new Error('Demon death does not create Anim_Unbind')
  }
}

function spawnSpriteArray(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
  role: string,
  firstEntry: number,
  frameCount: number,
  frameTicks: number,
  options: Readonly<{
    alphaLossPerTick?: number
    atlas?: BoneyardEnemyDeathEffect['atlas']
    blendMode?: BoneyardEnemyDeathEffect['blendMode']
    kind?: 'fire-array' | 'sprite-array'
    lifetimeTicks?: number
    position?: Readonly<BoneyardPoint>
    scale?: number
    spawnDelayTicks?: number
    tint?: number
    velocity?: Readonly<BoneyardPoint>
  }> = {},
): void {
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha: 1,
    alphaLossPerTick: options.alphaLossPerTick
      ?? (options.kind === 'fire-array' ? 0 : 1 / (frameCount * frameTicks)),
    atlas: options.atlas ?? 'BadGuys',
    blendMode: options.blendMode ?? 'add',
    entry: firstEntry,
    firstEntry,
    frameCount,
    frameTicks,
    kind: options.kind ?? 'sprite-array',
    lifetimeTicks: options.lifetimeTicks
      ?? (options.kind === 'fire-array'
        ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombFireTicks
        : frameCount * frameTicks),
    position: options.position,
    role,
    scale: options.scale ?? 1,
    spawnDelayTicks: options.spawnDelayTicks,
    tint: options.tint,
    velocity: options.velocity,
  })
}

function spawnSimpleDeathEffect(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
  options: {
    alpha: number
    alphaLossPerTick: number
    angularVelocityDeg?: number
    atlas: BoneyardEnemyDeathEffect['atlas']
    blendMode: BoneyardEnemyDeathEffect['blendMode']
    entry: number
    firstEntry?: number
    frameCount?: number
    frameTicks?: number
    kind: Exclude<BoneyardEnemyDeathEffectKind, 'bouncer'>
    lifetimeTicks: number
    position?: Readonly<BoneyardPoint>
    role: string
    rotationDeg?: number
    scale: number
    spawnDelayTicks?: number
    tint?: number
    velocity?: Readonly<BoneyardPoint>
  },
): void {
  work.deathEffects.push(Object.freeze({
    ageTicks: 0,
    alpha: options.alpha,
    alphaLossPerTick: options.alphaLossPerTick,
    angularVelocityDeg: options.angularVelocityDeg ?? 0,
    atlas: options.atlas,
    blendMode: options.blendMode,
    bounceVelocity: 0,
    entry: options.entry,
    firstEntry: options.firstEntry ?? options.entry,
    frameCount: options.frameCount ?? 1,
    frameTicks: options.frameTicks ?? 1,
    height: 0,
    id: work.nextDeathEffectId,
    kind: options.kind,
    lastStepTick: tick,
    lifetimeTicks: options.lifetimeTicks,
    opacityTimer: options.alpha,
    ownerActorId: actor.id,
    position: Object.freeze({ ...(options.position ?? actor.position) }),
    role: options.role,
    rotationDeg: options.rotationDeg ?? 0,
    scale: options.scale,
    shadow: false,
    spawnTick: tick + (options.spawnDelayTicks ?? 0),
    tint: options.tint ?? 0xffffff,
    verticalVelocity: 0,
    velocity: Object.freeze({ ...(options.velocity ?? { x: 0, y: 0 }) }),
  }))
  work.nextDeathEffectId += 1
}

function radialVector(angleDeg: number, magnitude: number): { x: number; y: number } {
  const radians = angleDeg * Math.PI / 180
  return { x: Math.sin(radians) * magnitude, y: -Math.cos(radians) * magnitude }
}

function randomRadialDisplacement(
  work: WorkingStep,
  maximumRadius: number,
): Readonly<BoneyardPoint> {
  const radius = drawUnit(work) * maximumRadius
  return radialVector(drawUnit(work) * 360, radius)
}

function drawUnit(work: WorkingStep): number {
  const draw = nextBoneyardWaveRandom(work.rngState)
  work.rngState = draw.state
  return draw.value
}

function drawInteger(work: WorkingStep, count: number): number {
  const draw = randomBoneyardWaveInteger(work.rngState, count)
  work.rngState = draw.state
  return draw.value
}

function nextLootSeed(
  work: WorkingStep,
  context: BoneyardEnemyStoreStepContext,
): number {
  const seed = context.rollLootSeed?.()
  if (seed !== undefined) {
    if (!Number.isSafeInteger(seed) || seed < 0 || seed >= 10_000_000) {
      throw new RangeError('native loot seed writer returned an invalid seed')
    }
    return seed
  }
  const draw = randomBoneyardWaveInteger(work.rngState, 10_000_000)
  work.rngState = draw.state
  return draw.value
}

function signedUnit(value: number): number {
  return value * 2 - 1
}

function spawnTerminalChildren(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): void {
  if (actor.config.enemyToken === 'IMP') {
    const splitDepth = actor.config.family.splitDepth
    if (splitDepth === 0) return
    if (work.impActorCount > NATIVE_IMP_SPLIT_LIVE_GUARD_MAXIMUM) return
    const spawnIntents = NATIVE_IMP_SPLIT_HEADING_OFFSETS.map((): BoneyardEnemySpawnIntent => {
      const intent: BoneyardEnemySpawnIntent = {
        enemyToken: 'IMP',
        flags: [],
        id: work.nextSyntheticSpawnIntentId,
        locationPolicy: 'anywhere',
        nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.IMP,
        position: { ...actor.position },
        spawnTick: context.tick,
        waveOrdinal: actor.waveOrdinal,
      }
      work.nextSyntheticSpawnIntentId += 1
      return intent
    })
    const children = materializeSpawnIntents(
      work,
      context,
      spawnIntents,
      splitDepth - 1,
    ).map((child, index) => ({
      ...child,
      headingDeg: (
        (actor.headingDeg + NATIVE_IMP_SPLIT_HEADING_OFFSETS[index]!) % 360 + 360
      ) % 360,
    }))
    work.actors.push(...children)
    return
  }
  if (actor.config.enemyToken !== 'DEMON') return
  const count = actor.config.family.splitCount
  if (count === 0) return
  const radius = Math.max(10, actor.config.collisionRadius)
  const spawnIntents = Array.from({ length: count }, (_, index): BoneyardEnemySpawnIntent => {
    const angle = index / count * Math.PI * 2
    const intent: BoneyardEnemySpawnIntent = {
      enemyToken: 'IMP',
      flags: [],
      id: work.nextSyntheticSpawnIntentId,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.IMP,
      position: {
        x: actor.position.x + Math.cos(angle) * radius,
        y: actor.position.y + Math.sin(angle) * radius,
      },
      spawnTick: context.tick,
      waveOrdinal: actor.waveOrdinal,
    }
    work.nextSyntheticSpawnIntentId += 1
    return intent
  })
  work.actors.push(...materializeSpawnIntents(
    work,
    context,
    spawnIntents,
    0,
  ))
}

function terminalOutput(token: EvaluatedBoneyardEnemyConfig['enemyToken']): BoneyardEnemyTerminalOutput {
  switch (token) {
    case 'SKELETON': return 'skeleton-shatter'
    case 'SKELETONARCHER': return 'archer-shatter'
    case 'SKELETONMAGE': return 'mage-shatter'
    case 'IMP': return 'imp-split'
    case 'ZOMBIE': return 'zombie-collapse'
    case 'WRAITH': return 'wraith-fragments'
    case 'DEMON': return 'demon-split'
    case 'COFFIN': return 'coffin-break'
  }
}

function terminalOutputCount(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
): number | undefined {
  if (actor.config.enemyToken === 'IMP') {
    return actor.config.family.splitDepth > 0
      && work.impActorCount <= NATIVE_IMP_SPLIT_LIVE_GUARD_MAXIMUM
      ? NATIVE_IMP_SPLIT_CHILD_COUNT
      : 0
  }
  if (actor.config.enemyToken === 'DEMON') {
    return Math.min(
      actor.config.family.splitCount,
      Math.max(0, NATIVE_IMP_CONSTRUCTION_MAXIMUM - work.impActorCount),
    )
  }
  return undefined
}

function emitEvent(
  work: WorkingStep,
  tick: number,
  type: BoneyardEnemySemanticEventType,
  actorId: BoneyardEnemyActorId,
  patch: Omit<Partial<BoneyardEnemySemanticEvent>, 'actorId' | 'eventId' | 'tick' | 'type'> = {},
): number {
  const eventId = work.nextEventId
  work.nextEventId += 1
  work.events.push(Object.freeze({ actorId, eventId, tick, type, ...patch }))
  return eventId
}

function deathBrain(brain: BoneyardEnemyBrain): BoneyardEnemyBrain {
  return brain.family === 'mage'
    ? {
        ...brain,
        lightningTargetPlayerId: null,
        lightningTargetPosition: null,
        lightningTicksRemaining: 0,
        phase: 'death',
      }
    : { ...brain, phase: 'death' } as BoneyardEnemyBrain
}

function skeletonAction(weapon: BoneyardSkeletonWeapon): 'claw' | 'pike' | 'weapon' {
  if (weapon === 'claw') return 'claw'
  if (weapon === 'pike') return 'pike'
  return 'weapon'
}

function resetSkeleton(
  actor: BoneyardEnemyActor,
  brain: BoneyardSkeletonBrain,
): BoneyardEnemyActor {
  return brain.phase === 'approach' ? actor : {
    ...actor,
    brain: {
      ...brain,
      actionProgress: 0,
      contactTargetPlayerId: null,
      markerEmitted: false,
      phase: 'approach',
    },
  }
}

function resetArcher(
  actor: BoneyardEnemyActor,
  brain: BoneyardArcherBrain,
): BoneyardEnemyActor {
  return brain.phase === 'range-control' ? actor : {
    ...actor,
    brain: { ...brain, actionProgress: 0, markerEmitted: false, phase: 'range-control' },
  }
}

function resetMage(actor: BoneyardEnemyActor, brain: BoneyardMageBrain): BoneyardEnemyActor {
  return brain.phase === 'range-control' ? actor : {
    ...actor,
    brain: { ...brain, actionProgress: 0, markerEmitted: false, phase: 'range-control' },
  }
}

function resetImp(actor: BoneyardEnemyActor, brain: BoneyardImpBrain): BoneyardEnemyActor {
  return brain.phase === 'flight' ? actor : {
    ...actor,
    brain: {
      ...brain,
      actionTick: 0,
      contactTargetPlayerId: null,
      cooldownTicks: 0,
      markerEmitted: false,
      phase: 'flight',
    },
  }
}

function resetZombie(
  actor: BoneyardEnemyActor,
  brain: BoneyardZombieBrain,
): BoneyardEnemyActor {
  return brain.phase === 'approach' ? actor : {
    ...actor,
    brain: {
      ...brain,
      actionProgress: 0,
      actionRate: 0,
      contactTargetPlayerId: null,
      impactStateTicksRemaining: 0,
      markerEmitted: false,
      phase: 'approach',
      phaseTicksRemaining: 0,
    },
  }
}

function resetWraith(
  actor: BoneyardEnemyActor,
  brain: BoneyardWraithBrain,
): BoneyardEnemyActor {
  return brain.phase === 'approach' ? actor : {
    ...actor,
    brain: {
      ...brain,
      actionTick: 0,
      contactTargetPlayerId: null,
      markerEmitted: false,
      phase: 'approach',
      phaseTicksRemaining: 0,
    },
  }
}

function resetDemon(actor: BoneyardEnemyActor, brain: BoneyardDemonBrain): BoneyardEnemyActor {
  return brain.phase === 'approach' ? actor : {
    ...actor,
    brain: {
      ...brain,
      actionProgress: 0,
      markerEmitted: false,
      phase: 'approach',
    },
  }
}

function validateTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError('enemy store tick must be a non-negative safe integer')
  }
}

function validatePoint(point: Readonly<BoneyardPoint>, label: string): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError(`${label} must contain finite coordinates`)
  }
}

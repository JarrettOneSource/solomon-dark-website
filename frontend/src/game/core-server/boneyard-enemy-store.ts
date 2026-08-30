import { actorHeadingFromVector } from '../core-kernels/actor-heading.ts'
import { NATIVE_ACTOR_SEPARATION_EPSILON } from '../core-kernels/actor-physics.ts'
import {
  createNativeImpFlightState,
  stepNativeImpFlight,
  type NativeImpFlightState,
} from '../core-kernels/boneyard-imp-flight.ts'
import { NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM } from '../core-kernels/boneyard-zombie-beat.ts'
import type { BoneyardPoint } from '../core-kernels/boneyard.ts'
import type { NativeSecondaryTargetEffectState } from '../core-kernels/native-secondary-abilities.ts'
import { nativePrimaryCellCoordinate } from '../core-kernels/primary-spell-targeting.ts'
import type { NativeEnemyWorldFeedbackOutput } from '../core-kernels/native-enemy-world-feedback.ts'
import {
  buildNativeEnemySteering,
  clearNativeEnemyRoute,
  createNativeEnemyPathState,
  nativeEnemySteeringGoal,
  nativeEnemyTargetRefreshTicks,
  resolveNativeEnemyPathGoal,
  stepNativeEnemyPathRecovery,
  stepNativeEnemyReorientation,
  type NativeEnemyPathState,
} from '../core-kernels/native-enemy-pathfinding.ts'
import { NATIVE_HURRICANE_DEFAULT_MOVEMENT_STEP } from '../core-kernels/native-hurricane.ts'
import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  drawNativeSign,
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
  BOUNDED_ENEMY_COLD_SLOW_TICKS,
  BOUNDED_ENEMY_POISON_DURATION_SECONDS,
  BOUNDED_MAGE_ALLY_SHIELD_RANGE,
  NATIVE_WRAITH_DAZZLE_TICKS,
  boundedMageShieldIntervalTicks,
  projectilePayloadForArrow,
  type BoneyardEnemyProjectilePayload,
} from '../core-kernels/boneyard-enemy-modifiers.ts'
import {
  NATIVE_ARCHER_PRIVATE_SEED_BOUND,
  buildNativeArcherVolley,
  constructNativeRangedAttackRange,
  restoreNativeRangeEasyAfterVolley,
} from '../core-kernels/native-enemy-targeting.ts'
import {
  NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES,
  NATIVE_MAGE_CAST_BODY_POSES,
  nativeMageBodyPose,
  nativeMageLightningDurationTicks,
  nativeMageLightningSource,
} from '../core-kernels/boneyard-mage-lightning.ts'
import {
  NATIVE_ARCHER_SHOT_BODY_POSES,
  NATIVE_BADGUY_GAIT_PHASE_DIVISOR,
  NATIVE_BADGUY_GAIT_PHASE_PERIOD,
  NATIVE_SKELETON_CLAW_BODY_POSES,
  NATIVE_SKELETON_BODY_GAIT_PHASE_DIVISOR,
  NATIVE_SKELETON_BODY_GAIT_PHASE_PERIOD,
  NATIVE_SKELETON_HEAD_FACING_OFFSETS,
  NATIVE_SKELETON_HEAD_TURN_ROLL_COUNT,
  NATIVE_SKELETON_HEAD_TURN_ROLL_WINNER,
  NATIVE_SKELETON_PIKE_BODY_POSES,
  NATIVE_SKELETON_WEAPON_BODY_POSES,
  advanceNativeEnemyLocomotionPhase,
  advanceNativeEnemyStridePhase,
  nativeSkeletonBodyGaitPose,
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
  NATIVE_BADGUY_NAVIGATION_CLEARANCE,
  NATIVE_DEMON_NAVIGATION_CLEARANCE,
} from './boneyard-enemy-navigation.ts'
import {
  stepBoneyardTransientEffects,
  stepBornBoneyardBouncer,
} from './boneyard-transient-effects.ts'
import {
  createNativeWorldManagerOrder,
  type NativeWorldManagerLane,
  type NativeWorldManagerRegistration,
  type RegisterNativeWorldPainter,
} from '../core-kernels/native-world-manager-order.ts'

export type BoneyardEnemyActorId = number
export type BoneyardEnemyDeathEffectId = number
export type BoneyardEnemyProjectileId = number
export type BoneyardEnemyProjectileEffectId = number
export type BoneyardEnemyEventId = number
export type BoneyardMageLightningPulseId = number

export const NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS = 2
export const NATIVE_ENEMY_HIT_LATCH_TICKS = 20

const NATIVE_IMP_SPLIT_HEADING_OFFSETS = Object.freeze([-90, 90] as const)
export const NATIVE_IMP_SPLIT_CHILD_COUNT = NATIVE_IMP_SPLIT_HEADING_OFFSETS.length
export const NATIVE_IMP_SPLIT_LIVE_GUARD_MAXIMUM = 68
export const NATIVE_IMP_CONSTRUCTION_MAXIMUM = 70
export const NATIVE_IMP_CONTACT_BASE_RADIUS = 45
export const NATIVE_IMP_CONTACT_RADIUS_SCALE = 1.25
export const NATIVE_DEMON_RAW_FIRE_BURST_PHASE_PER_TICK = 0.25 * 0.75
export const NATIVE_DEMON_RAW_FIRE_BURST_TICKS = Math.ceil(
  4 / NATIVE_DEMON_RAW_FIRE_BURST_PHASE_PER_TICK,
)

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
  wraithDrain: Object.freeze({ cooldownTicks: 50, markerTick: 4, strictEndTick: 9 }),
})

/** Mod_Knockback magnitude is runtime-authored and remains open in the retail binary. */
export const BOUNDED_ZOMBIE_KNOCKBACK_DISTANCE = 10

/** Named center-distance bounds; native family attack reach remains unresolved. */
export const BOUNDED_ENEMY_ATTACK_REACH = Object.freeze({
  COFFIN: 0,
  DEMON: 180,
  SKELETON: 36,
  SKELETONARCHER: 240,
  SKELETONMAGE: 220,
  WRAITH: 52,
  ZOMBIE: 48,
})

/**
 * Contact geometry and the non-Arrow travel programs remain named web bounds.
 * Archer supplies every Arrow speed and orientation countdown from its exact
 * native birth draw; Arrow retirement is owned by its separate opacity lane.
 */
export const BOUNDED_ENEMY_PROJECTILE_PROGRAMS = Object.freeze({
  arrow: Object.freeze({ contactRadius: 8, homing: false }),
  'demon-bomb': Object.freeze({ contactRadius: 35, homing: false, lifetimeTicks: 100, speed: 2 }),
  firebolt: Object.freeze({ contactRadius: 10, homing: false, lifetimeTicks: 400, speed: 4.5 }),
  'guided-missile': Object.freeze({ contactRadius: 12, homing: true, lifetimeTicks: 400, speed: 3 }),
  'poison-pool': Object.freeze({ contactRadius: 35, homing: false, lifetimeTicks: 3000, speed: 0 }),
})

export const NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS = Object.freeze({
  arrowAirborneHeightBoundary: -3,
  arrowHeightPerTick: 0.75,
  arrowInitialHeight: -25,
  arrowInitialOpacity: 5,
  arrowOpacityLossPerTick: 0.05,
  arrowPlanarDampingPerTick: 0.9900000095367432,
  arrowPitchFactor: 0.5,
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

/** Retail Maggot constants recovered from 0x0047E0F0/0x0048B2A0. */
export const NATIVE_MAGGOT_PROGRAM = Object.freeze({
  attackDelayAfterEmergenceTicks: 10,
  attackReach: 18,
  bitePresentationTicks: 6,
  collisionRadius: 8,
  deathTicks: 12,
  gaitDistancePerPose: 2,
  gravityPerTick: 0.075,
  launchSegments: Object.freeze({
    edge: Object.freeze({
      end: Object.freeze({ x: 15.5, y: -29.5 }),
      headingMaximumDeg: 200,
      headingMinimumDeg: 140,
      start: Object.freeze({ x: 5.5, y: 8.5 }),
    }),
    lid: Object.freeze({
      end: Object.freeze({ x: 5.5, y: -41.5 }),
      headingMaximumDeg: 330,
      headingMinimumDeg: 270,
      start: Object.freeze({ x: -9.5, y: -4.5 }),
    }),
  }),
  maximumInactiveChildren: 30,
  movementStep: 0.5,
  poisonDurationTicks: 10,
})

const NATIVE_WRAITH_RETREAT_MINIMUM_TICKS = 200
const NATIVE_WRAITH_RETREAT_RANDOM_COUNT = 601
const NATIVE_COFFIN_HIDDEN_SHORT_TICKS = 180
const NATIVE_COFFIN_HIDDEN_LONG_TICKS = 360
const NATIVE_COFFIN_RISE_TICKS = 11
const NATIVE_COFFIN_HOLD_MINIMUM_TICKS = 150
const NATIVE_COFFIN_HOLD_RANDOM_COUNT = 150
const NATIVE_COFFIN_OPEN_TICKS = 46
const NATIVE_COFFIN_MAGGOT_CHARGE_PER_TICK = Math.fround(0.025)
const NATIVE_COFFIN_MAGGOT_CHARGE_MAXIMUM = 10
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
  readonly aimSeed: number
  readonly attackRange: number
  readonly family: 'archer'
  readonly phase: 'range-control' | 'attack' | 'death'
  readonly rangeEasyPending: boolean
}

export interface BoneyardMageBrain extends ActionClock {
  readonly attackRange: number
  readonly castProgram: 'long' | 'short'
  readonly castRoll: number
  readonly family: 'mage'
  readonly lightningTargetPlayerId: string | null
  readonly lightningTargetPosition: Readonly<BoneyardPoint> | null
  readonly lightningTicksRemaining: number
  readonly phase: 'range-control' | 'cast' | 'death'
  readonly rangeEasyPending: boolean
  readonly shieldTicksRemaining: number
}

export interface BoneyardImpBrain extends NativeImpFlightState {
  readonly escapeHeadingDeg: number | null
  readonly family: 'imp'
  readonly phase: 'flight' | 'death'
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
  readonly launchRotationDeg: number
  readonly launchScale: -1 | 1
  readonly maggotCharge: number
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
  readonly blizzardPushAccumulator: number
  readonly blizzardPushLastTick: number | null
  readonly bodyGaitPhase: number
  readonly bodyPose: number
  readonly brain: BoneyardEnemyBrain
  readonly config: EvaluatedBoneyardEnemyConfig
  readonly currentHealth: number
  readonly deathEpoch: number | null
  readonly deathPresentationStarted: boolean
  readonly deathStartedTick: number | null
  readonly deathTick: number
  readonly gaitPose: number
  readonly headFacingOffset: NativeSkeletonHeadFacingOffset
  readonly headingDeg: number
  readonly hurricaneContactCooldown: number
  readonly id: BoneyardEnemyActorId
  readonly lastDamagedByPlayerId: string | null
  readonly lastDamageTick: number | null
  readonly lastMovementTick: number | null
  readonly lifeState: 'alive' | 'dying'
  readonly lightRegistration: NativeWorldManagerRegistration
  readonly lighting: Readonly<BoneyardEnemyLightingState>
  readonly lootSeed: number
  readonly nextMovementTick: number
  readonly nextTargetRefreshTick: number
  readonly nativeCellBindingOrder: number
  readonly nativeRegistrationOrder: number
  readonly path: NativeEnemyPathState
  readonly position: Readonly<BoneyardPoint>
  readonly rewardGranted: boolean
  readonly restBodyPose: number
  readonly shieldHealth: number
  readonly shieldMaximumHealth: number
  readonly shieldPulse: number
  readonly shieldSoundCooldownTicks: number
  readonly sourceSpawnIntentId: number
  readonly spawnTick: number
  readonly staffActionFactor: number
  readonly staffMovementFactor: number
  readonly stridePhaseDeg: number
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
  readonly chillTumbleAccumulator: number
  readonly coldSlowTicks: number
  readonly contactRadius: number
  readonly damage: number
  readonly headingDeg: number
  readonly hitPlayerIds: readonly string[]
  readonly homing: boolean
  readonly id: BoneyardEnemyProjectileId
  readonly kind: BoneyardEnemyProjectileKind
  readonly lastStepTick: number
  readonly lightRegistration: NativeWorldManagerRegistration | null
  readonly lifetimeTicks: number
  readonly minimumSpeed: number
  readonly nativeTypeId: 0x7da | 0x7eb | 0x7ec | 0x7f7 | 0x806
  readonly nativeCellBindingOrder: number
  readonly nativeRegistrationOrder: number
  readonly ownerActorId: BoneyardEnemyActorId
  readonly painterRegistration: NativeWorldManagerRegistration
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
  | 'arrow-tumble'
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
  readonly lightRegistration: NativeWorldManagerRegistration | null
  readonly lifetimeTicks: number
  readonly ownerActorId: BoneyardEnemyActorId
  readonly ownerProjectileId: BoneyardEnemyProjectileId
  readonly painterRegistration: NativeWorldManagerRegistration
  readonly phaseOriginTicks: number
  readonly position: Readonly<BoneyardPoint>
  readonly rotationDeg: number
  readonly scale: number
  readonly spawnTick: number
  readonly tint: number
  readonly velocity: Readonly<BoneyardPoint>
}

export interface BoneyardMaggotActor {
  readonly blizzardPushAccumulator: number
  readonly blizzardPushLastTick: number | null
  readonly combatActive: boolean
  readonly collisionRadius: number
  readonly currentHealth: number
  readonly deathOffsets: readonly Readonly<BoneyardPoint>[]
  readonly damage: number
  readonly deathEpoch: number | null
  readonly deathStartedTick: number | null
  readonly deathTick: number
  readonly gaitPose: number
  readonly headingDeg: number
  readonly hurricaneContactCooldown: number
  readonly id: BoneyardEnemyActorId
  readonly emergenceTick: number
  readonly emergencePhase: number
  readonly launchTrajectory: 'edge' | 'lid'
  readonly launchVelocity: Readonly<BoneyardPoint>
  readonly landingBounceVelocity: number
  readonly lastAttackTick: number | null
  readonly lastDamagedByPlayerId: string | null
  readonly lastDamageTick: number | null
  readonly lastMovementTick: number | null
  readonly lifeState: 'alive' | 'dying'
  readonly lightRegistration: NativeWorldManagerRegistration
  readonly maximumHealth: number
  readonly nextAttackTick: number
  readonly nextMovementTick: number
  readonly nextTargetRefreshTick: number
  readonly nativeCellBindingOrder: number
  readonly nativeRegistrationOrder: number
  readonly ownerCoffinActorId: BoneyardEnemyActorId
  readonly path: NativeEnemyPathState
  readonly poisonDamage: number
  readonly poisonDuration: number
  readonly position: Readonly<BoneyardPoint>
  readonly movementPhase: 'crawl' | 'emerging'
  readonly spawnTick: number
  readonly staffActionFactor: number
  readonly staffMovementFactor: number
  readonly targetPlayerId: string | null
  readonly terminalEmitted: boolean
  readonly verticalOffset: number
  readonly verticalVelocity: number
  readonly visualScale: number
}

export type BoneyardEnemyDeathEffectKind =
  | 'banish'
  | 'bouncer'
  | 'smoky-bouncer'
  | 'fade'
  | 'fade-additive'
  | 'fade-perspective'
  | 'fade-perspective-clipped'
  | 'fade-scale'
  | 'fire-array'
  | 'late-splat'
  | 'move-fade'
  | 'sprite-array'
  | 'unbind'

export interface BoneyardEnemyDeathEffect {
  readonly ageTicks: number
  readonly alpha: number
  readonly alphaMultiplier: number
  readonly alphaLossPerTick: number
  readonly angularVelocityDeg: number
  readonly atlas: 'BadGuys' | 'DeadHawg' | 'Demon'
  readonly blendMode: 'add' | 'normal'
  readonly bounceRetention: number
  readonly bounceVelocity: number
  readonly entry: number
  readonly firstEntry: number
  readonly frameCount: number
  readonly framePhase: number
  readonly frameVelocity: number
  readonly frameVelocityDamping: number
  readonly frameTicks: number
  readonly height: number
  readonly id: BoneyardEnemyDeathEffectId
  readonly kind: BoneyardEnemyDeathEffectKind
  readonly lastStepTick: number
  readonly lifetimeTicks: number
  readonly ownerActorId: BoneyardEnemyActorId
  readonly opacityTimer: number
  readonly painterRegistration: NativeWorldManagerRegistration | null
  readonly presentationOwner: 'direct-post-world' | 'pre-world-queue' | 'world-sorted'
  readonly position: Readonly<BoneyardPoint>
  readonly role: string
  readonly rotationDeg: number
  readonly scale: number
  readonly scaleMultiplier: number
  readonly shadow: boolean
  readonly spawnTick: number
  readonly tint: number
  readonly verticalVelocity: number
  readonly velocity: Readonly<BoneyardPoint>
  readonly velocityDamping: number
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
  readonly painterRegistrations: readonly NativeWorldManagerRegistration[]
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

export type BoneyardEnemyActionSound =
  | 'bite-1'
  | 'bite-2'
  | 'bite-3'
  | 'imp-vocal-1'
  | 'imp-vocal-2'
  | 'imp-vocal-3'
  | 'imp-vocal-4'
  | 'imp-vocal-5'
  | 'imp-vocal-6'
  | 'imp-vocal-7'
  | 'imp-vocal-8'
  | 'shoot-arrow'

const NATIVE_IMP_VOCAL_SOUNDS = Object.freeze([
  'imp-vocal-1',
  'imp-vocal-2',
  'imp-vocal-3',
  'imp-vocal-4',
  'imp-vocal-5',
  'imp-vocal-6',
  'imp-vocal-7',
  'imp-vocal-8',
] as const)

const NATIVE_IMP_BITE_SOUNDS = Object.freeze([
  'bite-1',
  'bite-2',
  'bite-3',
] as const)

export type BoneyardCombatSound =
  | BoneyardEnemyActionSound
  | BoneyardEnemyDamageSound
  | BoneyardEnemyDeathSound
  | BoneyardPlayerDamageSound

export type BoneyardEnemySemanticEventType =
  | 'attack-marker'
  | 'coffin-maggot-release'
  | 'enemy-action-sound'
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
  readonly painterRegistration?: NativeWorldManagerRegistration
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
  readonly onDeathProgram: EvaluatedBoneyardEnemyConfig['onDeathProgram']
  readonly policies?: EvaluatedBoneyardEnemyConfig['lootPolicies']
  readonly participantSlot: 0
  readonly position: Readonly<BoneyardPoint>
  readonly recipeUid?: number
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
  readonly locomotionRngState: NativeRngState
  readonly mageLightningPulses: readonly BoneyardMageLightningPulse[]
  readonly maggots: readonly BoneyardMaggotActor[]
  readonly nextActorId: BoneyardEnemyActorId
  readonly nextDeathEpoch: number
  readonly nextDeathEffectId: BoneyardEnemyDeathEffectId
  readonly nextEventId: BoneyardEnemyEventId
  readonly nextMageLightningPulseId: BoneyardMageLightningPulseId
  readonly nextNativeCellBindingOrder: number
  readonly nextNativeRegistrationOrder: number
  readonly nextProjectileId: BoneyardEnemyProjectileId
  readonly nextProjectileEffectId: BoneyardEnemyProjectileEffectId
  readonly nextSyntheticSpawnIntentId: number
  readonly projectiles: readonly BoneyardEnemyProjectile[]
  readonly projectileEffects: readonly BoneyardEnemyProjectileEffect[]
  readonly rngState: number
  readonly steeringRngState: NativeRngState
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
  readonly headingDeg?: number
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

export interface BoneyardEnemyNavigationPathRequest {
  readonly actorId: BoneyardEnemyActorId
  readonly bodyRadius: number
  readonly end: Readonly<BoneyardPoint>
  readonly navigationClearance: number
  readonly radius: number
  readonly start: Readonly<BoneyardPoint>
}

export interface BoneyardEnemyNavigation {
  readonly findRoute: (
    request: BoneyardEnemyNavigationPathRequest,
  ) => readonly Readonly<BoneyardPoint>[] | null
  readonly isPathClear: (
    request: BoneyardEnemyNavigationPathRequest,
  ) => boolean
}

export type ResolveBoneyardEnemyMovement = (
  request: BoneyardEnemyMovementRequest,
) => Readonly<BoneyardPoint>

export interface BoneyardEnemySpawnPlacementRequest {
  readonly actorId: BoneyardEnemyActorId
  readonly position: Readonly<BoneyardPoint>
  readonly positionPolicy: BoneyardEnemySpawnIntent['positionPolicy']
  readonly radius: number
  readonly rngState: NativeRngState
}

export interface BoneyardEnemySpawnPlacementResult {
  readonly position: Readonly<BoneyardPoint>
  readonly rngState: NativeRngState
}

export type ResolveBoneyardEnemySpawnPlacement = (
  request: BoneyardEnemySpawnPlacementRequest,
) => BoneyardEnemySpawnPlacementResult

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
  readonly attributionObserver?: BoneyardEnemyAttributionObserver
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
  readonly navigation?: BoneyardEnemyNavigation
  readonly paused?: boolean
  readonly players: BoneyardEnemyTargets
  readonly registerWorldPainter?: RegisterNativeWorldPainter
  readonly registerProjectileWorldPainter?: RegisterNativeWorldPainter
  readonly retirementObserver?: BoneyardEnemyRetirementObserver
  readonly rollLootSeed?: () => number
  readonly resolveMovement: ResolveBoneyardEnemyMovement
  readonly resolveSpawnPlacement?: ResolveBoneyardEnemySpawnPlacement
  readonly resolveSpawnIntents: (
    liveEnemyCount: number,
    liveZombieCount: number,
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
  readonly attributionObserver?: BoneyardEnemyAttributionObserver
  readonly lethalObserver?: BoneyardEnemyLethalObserver
  readonly sourcePlayerId: string | null
  readonly registerWorldPainter?: RegisterNativeWorldPainter
  readonly suppressHurtSound?: boolean
  readonly tick: number
}

export interface DamageBoneyardEnemyResult {
  readonly accepted: boolean
  readonly events: readonly BoneyardEnemySemanticEvent[]
  readonly healthDamage: number
  readonly killed: boolean
  readonly store: BoneyardEnemyStore
}

export interface BoneyardEnemyAttributionObserver {
  readonly onEnemyHealthDamage: (event: Readonly<{
    actorId: number
    amount: number
    maximumHealth: number
    playerId: string
  }>) => void
  readonly onEnemyKillExperience: (event: Readonly<{
    actorId: number
    amount: number
    enemyToken: string
    playerId: string
  }>) => void
  readonly onLootPickup?: (event: Readonly<{
    amount: number
    bonusKind: number | null
    itemKind: string | null
    itemName: string | null
    itemQuantity: number | null
    kind: 'bonus' | 'gold' | 'orb' | 'sack'
    orbKind: 'health' | 'mana' | null
    playerId: string
  }>) => void
}

interface DamagePresentationWork {
  deathEffects: BoneyardEnemyDeathEffect[]
  events: BoneyardEnemySemanticEvent[]
  nextDeathEffectId: number
  nextEventId: number
  registerWorldPainter: RegisterNativeWorldPainter
  rngState: number
}

export interface PositionBoneyardEnemyResult {
  readonly accepted: boolean
  readonly store: BoneyardEnemyStore
}

export interface TumbleBoneyardArrowResult {
  readonly events: readonly BoneyardEnemySemanticEvent[]
  readonly rng: NativeRngState
  readonly store: BoneyardEnemyStore
  readonly tumbled: boolean
}

interface WorkingStep {
  actors: BoneyardEnemyActor[]
  deathEffects: BoneyardEnemyDeathEffect[]
  events: BoneyardEnemySemanticEvent[]
  headFacingRngState: NativeRngState
  impActorCount: number
  locomotionRngState: NativeRngState
  mageLightningPulses: BoneyardMageLightningPulse[]
  maggots: BoneyardMaggotActor[]
  nextActorId: number
  nextDeathEpoch: number
  nextDeathEffectId: number
  nextEventId: number
  nextMageLightningPulseId: number
  nextNativeCellBindingOrder: number
  nextNativeRegistrationOrder: number
  nextProjectileId: number
  nextProjectileEffectId: number
  nextSyntheticSpawnIntentId: number
  playerDamage: BoneyardEnemyPlayerDamage[]
  playerKnockbacks: BoneyardEnemyPlayerKnockback[]
  pathStatusFactors: Map<BoneyardEnemyActorId, number>
  projectiles: BoneyardEnemyProjectile[]
  projectileEffects: BoneyardEnemyProjectileEffect[]
  registerWorldPainter: RegisterNativeWorldPainter
  registerProjectileWorldPainter: RegisterNativeWorldPainter
  retired: BoneyardEnemyRetirement[]
  rewards: BoneyardEnemyReward[]
  rngState: number
  steeringRngState: NativeRngState
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

export function createBoneyardEnemyStore(
  seed: string,
  nativeRegistrationBase = 0,
): BoneyardEnemyStore {
  if (!Number.isSafeInteger(nativeRegistrationBase) || nativeRegistrationBase < 0) {
    throw new RangeError('native enemy registration base must be a non-negative safe integer')
  }
  return {
    actors: [],
    deathEffects: [],
    headFacingRngState: createNativeRng(
      seedBoneyardWaveRng(`${seed}:skeleton-head-facing`),
    ),
    lastStepTick: -1,
    locomotionRngState: createNativeRng(
      seedBoneyardWaveRng(`${seed}:enemy-locomotion`),
    ),
    mageLightningPulses: [],
    maggots: [],
    nextActorId: 1,
    nextDeathEpoch: 1,
    nextDeathEffectId: 1,
    nextEventId: 1,
    nextMageLightningPulseId: 1,
    nextNativeCellBindingOrder: nativeRegistrationBase,
    nextNativeRegistrationOrder: nativeRegistrationBase,
    nextProjectileId: 1,
    nextProjectileEffectId: 1,
    nextSyntheticSpawnIntentId: 1,
    projectiles: [],
    projectileEffects: [],
    rngState: seedBoneyardWaveRng(`${seed}:enemy-actors`),
    steeringRngState: createNativeRng(
      seedBoneyardWaveRng(`${seed}:enemy-steering`),
    ),
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

function standaloneEnemyWorldManagerOrderState(source: BoneyardEnemyStore) {
  const nextRegistrationOrdinal = { actor: 0, transient: 0 }
  for (const registration of [
    ...source.actors.map(({ lightRegistration }) => lightRegistration),
    ...source.maggots.map(({ lightRegistration }) => lightRegistration),
    ...source.projectiles.map(({ lightRegistration }) => lightRegistration),
    ...source.projectiles.map(({ painterRegistration }) => painterRegistration),
    ...source.projectileEffects.map(({ lightRegistration }) => lightRegistration),
    ...source.projectileEffects.map(({ painterRegistration }) => painterRegistration),
    ...source.deathEffects.map(({ painterRegistration }) => painterRegistration),
    ...source.mageLightningPulses.flatMap(({ painterRegistrations }) => painterRegistrations),
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
): NativeWorldManagerLane | null {
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
  return source.actors.length
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
    return { accepted: false, events: [], healthDamage: 0, killed: false, store: source }
  }

  const work: DamagePresentationWork = {
    deathEffects: [...source.deathEffects],
    events: [],
    nextDeathEffectId: source.nextDeathEffectId,
    nextEventId: source.nextEventId,
    registerWorldPainter: request.registerWorldPainter
      ?? createNativeWorldManagerOrder(standaloneEnemyWorldManagerOrderState(source)).register,
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
    return finishDamage(source, actors, work, false, 0)
  }

  const hurtSound = enemyHurtSound(actor)
  if (
    hurtSound !== null
    && request.suppressHurtSound !== true
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
  const healthDamage = Math.min(Math.max(actor.currentHealth, 0), request.amount)
  const killed = currentHealth <= 0
  const nextActor: BoneyardEnemyActor = killed
    ? {
        ...actor,
        brain: deathBrain(actor.brain),
        currentHealth,
        deathEpoch: source.nextDeathEpoch,
        deathStartedTick: request.tick,
        deathTick: 0,
        headFacingOffset: 0,
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
  notifyAttributedHealthDamage(request, actor.id, actor.config.maximumHealth, healthDamage)
  return finishDamage(source, actors, work, killed, healthDamage)
}

export function applyBoneyardStaffDisable(
  source: BoneyardEnemyStore,
  actorId: BoneyardEnemyActorId,
): BoneyardEnemyStore {
  const actorIndex = source.actors.findIndex(({ id }) => id === actorId)
  if (actorIndex >= 0) {
    const actor = source.actors[actorIndex]!
    if (actor.lifeState !== 'alive') return source
    const actors = [...source.actors]
    actors[actorIndex] = {
      ...actor,
      staffActionFactor: Math.fround(actor.staffActionFactor * 0.5),
      staffMovementFactor: Math.fround(actor.staffMovementFactor * 0.75),
    }
    return { ...source, actors }
  }
  const maggotIndex = source.maggots.findIndex(({ id }) => id === actorId)
  if (maggotIndex < 0) return source
  const maggot = source.maggots[maggotIndex]!
  if (maggot.lifeState !== 'alive') return source
  const maggots = [...source.maggots]
  maggots[maggotIndex] = {
    ...maggot,
    staffActionFactor: Math.fround(maggot.staffActionFactor * 0.5),
    staffMovementFactor: Math.fround(maggot.staffMovementFactor * 0.75),
  }
  return { ...source, maggots }
}

export function applyBoneyardStaffHeadingPerturbation(
  source: BoneyardEnemyStore,
  actorId: BoneyardEnemyActorId,
  deltaDegrees: number,
): BoneyardEnemyStore {
  if (!Number.isFinite(deltaDegrees)) {
    throw new RangeError('staff heading perturbation must be finite')
  }
  const actorIndex = source.actors.findIndex(({ id }) => id === actorId)
  if (actorIndex >= 0) {
    const actor = source.actors[actorIndex]!
    if (actor.lifeState !== 'alive') return source
    const actors = [...source.actors]
    actors[actorIndex] = {
      ...actor,
      headingDeg: positiveModulo(actor.headingDeg + deltaDegrees, 360),
    }
    return { ...source, actors }
  }
  const maggotIndex = source.maggots.findIndex(({ id }) => id === actorId)
  if (maggotIndex < 0) return source
  const maggot = source.maggots[maggotIndex]!
  if (maggot.lifeState !== 'alive') return source
  const maggots = [...source.maggots]
  maggots[maggotIndex] = {
    ...maggot,
    headingDeg: positiveModulo(maggot.headingDeg + deltaDegrees, 360),
  }
  return { ...source, maggots }
}

export function applyBoneyardStaffImpactVerticalVelocity(
  source: BoneyardEnemyStore,
  actorId: BoneyardEnemyActorId,
  verticalVelocity: number,
): BoneyardEnemyStore {
  if (!Number.isFinite(verticalVelocity)) {
    throw new RangeError('staff impact vertical velocity must be finite')
  }
  const actorIndex = source.actors.findIndex(({ id }) => id === actorId)
  if (actorIndex < 0) return source
  const actor = source.actors[actorIndex]!
  if (actor.lifeState !== 'alive' || actor.brain.family !== 'imp') return source
  const actors = [...source.actors]
  actors[actorIndex] = {
    ...actor,
    brain: { ...actor.brain, verticalVelocity: Math.fround(verticalVelocity) },
  }
  return { ...source, actors }
}

export function breakBoneyardSkeletonPike(
  source: BoneyardEnemyStore,
  actorId: BoneyardEnemyActorId,
): Readonly<{ broke: boolean; store: BoneyardEnemyStore }> {
  const actorIndex = source.actors.findIndex(({ id }) => id === actorId)
  if (actorIndex < 0) return { broke: false, store: source }
  const actor = source.actors[actorIndex]!
  if (
    actor.lifeState !== 'alive'
    || actor.brain.family !== 'skeleton'
    || !actor.config.flags.some((flag) => flag === 'FLAG_PIKE')
  ) return { broke: false, store: source }
  const weaponFlags = new Set([
    'FLAG_SWORD', 'FLAG_MACE', 'FLAG_FLAIL', 'FLAG_AXE', 'FLAG_PIKE',
  ])
  const actors = [...source.actors]
  actors[actorIndex] = {
    ...actor,
    bodyPose: 0,
    brain: {
      ...actor.brain,
      action: 'claw',
      actionProgress: 0,
      contactTargetPlayerId: null,
      markerEmitted: false,
      phase: 'approach',
    },
    config: {
      ...actor.config,
      flags: Object.freeze(actor.config.flags.filter((flag) => !weaponFlags.has(flag))),
    },
  }
  return { broke: true, store: { ...source, actors } }
}

/**
 * Commits a collision-resolved spell impulse to the target-owned enemy row.
 * The spell system owns the impulse formula; the active world owns collision
 * resolution and passes only the accepted final root position here.
 */
export function positionBoneyardEnemy(
  source: BoneyardEnemyStore,
  actorId: BoneyardEnemyActorId,
  position: Readonly<BoneyardPoint>,
): PositionBoneyardEnemyResult {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    throw new RangeError('enemy spell-impulse position must be finite')
  }
  const actorIndex = source.actors.findIndex((actor) => actor.id === actorId)
  const actor = source.actors[actorIndex]
  if (actor) {
    if (actor.lifeState !== 'alive') return { accepted: false, store: source }
    const actors = [...source.actors]
    const rebound = nativePrimaryCellChanged(actor.position, position)
    actors[actorIndex] = {
      ...actor,
      nativeCellBindingOrder: rebound
        ? source.nextNativeCellBindingOrder
        : actor.nativeCellBindingOrder,
      position: Object.freeze({ ...position }),
    }
    return {
      accepted: true,
      store: {
        ...source,
        actors,
        nextNativeCellBindingOrder: source.nextNativeCellBindingOrder + Number(rebound),
      },
    }
  }
  const maggotIndex = source.maggots.findIndex((maggot) => maggot.id === actorId)
  const maggot = source.maggots[maggotIndex]
  if (!maggot || maggot.lifeState !== 'alive' || !maggot.combatActive) {
    return { accepted: false, store: source }
  }
  const maggots = [...source.maggots]
  const rebound = nativePrimaryCellChanged(maggot.position, position)
  maggots[maggotIndex] = {
    ...maggot,
    nativeCellBindingOrder: rebound
      ? source.nextNativeCellBindingOrder
      : maggot.nativeCellBindingOrder,
    position: Object.freeze({ ...position }),
  }
  return {
    accepted: true,
    store: {
      ...source,
      maggots,
      nextNativeCellBindingOrder: source.nextNativeCellBindingOrder + Number(rebound),
    },
  }
}

/** Raw Badguy +0x1DA Hurricane contact clock, shared by every source. */
export function setBoneyardEnemyHurricaneContactCooldown(
  source: BoneyardEnemyStore,
  actorId: BoneyardEnemyActorId,
  cooldown: number,
): BoneyardEnemyStore {
  if (!Number.isSafeInteger(cooldown) || cooldown < 0 || cooldown > 0xffff) {
    throw new RangeError('enemy Hurricane cooldown must be an unsigned short')
  }
  const actorIndex = source.actors.findIndex((actor) => actor.id === actorId)
  if (actorIndex >= 0) {
    const actors = [...source.actors]
    actors[actorIndex] = { ...actors[actorIndex]!, hurricaneContactCooldown: cooldown }
    return { ...source, actors }
  }
  const maggotIndex = source.maggots.findIndex((maggot) => maggot.id === actorId)
  if (maggotIndex < 0) return source
  const maggots = [...source.maggots]
  maggots[maggotIndex] = { ...maggots[maggotIndex]!, hurricaneContactCooldown: cooldown }
  return { ...source, maggots }
}

export function setBoneyardEnemyBlizzardPushState(
  source: BoneyardEnemyStore,
  actorId: BoneyardEnemyActorId,
  accumulator: number,
  lastTick: number,
): BoneyardEnemyStore {
  if (!Number.isFinite(accumulator) || accumulator < 0) {
    throw new RangeError('enemy Blizzard push accumulator must be finite and non-negative')
  }
  if (!Number.isSafeInteger(lastTick) || lastTick < 0) {
    throw new RangeError('enemy Blizzard push tick must be a non-negative safe integer')
  }
  const actorIndex = source.actors.findIndex((actor) => actor.id === actorId)
  if (actorIndex >= 0) {
    const actors = [...source.actors]
    actors[actorIndex] = {
      ...actors[actorIndex]!,
      blizzardPushAccumulator: accumulator,
      blizzardPushLastTick: lastTick,
    }
    return { ...source, actors }
  }
  const maggotIndex = source.maggots.findIndex((maggot) => maggot.id === actorId)
  if (maggotIndex < 0) return source
  const maggots = [...source.maggots]
  maggots[maggotIndex] = {
    ...maggots[maggotIndex]!,
    blizzardPushAccumulator: accumulator,
    blizzardPushLastTick: lastTick,
  }
  return { ...source, maggots }
}

export function setBoneyardArrowChillTumbleAccumulator(
  source: BoneyardEnemyStore,
  projectileId: BoneyardEnemyProjectileId,
  accumulator: number,
): BoneyardEnemyStore {
  if (!Number.isFinite(accumulator) || accumulator < 0 || accumulator > 1) {
    throw new RangeError('Arrow Chill accumulator must be finite and within [0,1]')
  }
  const projectileIndex = source.projectiles.findIndex(({ id }) => id === projectileId)
  const projectile = source.projectiles[projectileIndex]
  if (!projectile || projectile.kind !== 'arrow') return source
  const projectiles = [...source.projectiles]
  projectiles[projectileIndex] = { ...projectile, chillTumbleAccumulator: accumulator }
  return { ...source, projectiles }
}

/**
 * Arrow::vslot+0x64 removes the projectile once Chill Wind crosses its tumble
 * threshold, then transfers record 2 into one world-owned Anim_SpinAway.
 * The two Float calls plus the signed-direction word stay on combat RNG.
 */
export function tumbleBoneyardArrow(
  source: BoneyardEnemyStore,
  projectileId: BoneyardEnemyProjectileId,
  direction: Readonly<BoneyardPoint>,
  tick: number,
  sourceRng: NativeRngState,
  registerWorldPainter?: RegisterNativeWorldPainter,
): TumbleBoneyardArrowResult {
  validateTick(tick)
  if (tick < source.lastStepTick) {
    throw new RangeError('arrow tumble tick must not precede the store clock')
  }
  if (!Number.isFinite(direction.x) || !Number.isFinite(direction.y)) {
    throw new RangeError('arrow tumble direction must be finite')
  }
  const length = Math.hypot(direction.x, direction.y)
  if (!(length > 0)) {
    throw new RangeError('arrow tumble direction must be nonzero')
  }
  const index = source.projectiles.findIndex(({ id }) => id === projectileId)
  const projectile = source.projectiles[index]
  if (!projectile || projectile.kind !== 'arrow') {
    return { events: [], rng: sourceRng, store: source, tumbled: false }
  }

  const rotation = drawNativeFloat(sourceRng, 360)
  const angularMagnitude = drawNativeFloat(rotation.state, 1)
  const angularVelocity = drawNativeSign(
    angularMagnitude.state,
    Math.fround(1 + angularMagnitude.value),
  )
  const projectiles = [...source.projectiles]
  projectiles.splice(index, 1)
  const effect: BoneyardEnemyProjectileEffect = Object.freeze({
    ageTicks: 0,
    alpha: Math.fround(6),
    alphaLossPerTick: Math.fround(0.1),
    angularVelocityDeg: angularVelocity.value,
    atlas: 'BadGuys',
    blendMode: 'normal',
    entry: 2,
    id: source.nextProjectileEffectId,
    kind: 'arrow-tumble',
    lastStepTick: tick,
    lightRegistration: null,
    lifetimeTicks: 60,
    ownerActorId: projectile.ownerActorId,
    ownerProjectileId: projectile.id,
    painterRegistration: (
      registerWorldPainter
      ?? createNativeWorldManagerOrder(standaloneEnemyWorldManagerOrderState(source)).register
    )('actor'),
    phaseOriginTicks: projectile.ageTicks,
    position: Object.freeze({ ...projectile.position }),
    rotationDeg: rotation.value,
    scale: 1,
    spawnTick: tick,
    tint: 0xffffff,
    velocity: Object.freeze({
      x: Math.fround(direction.x / length),
      y: Math.fround(direction.y / length),
    }),
  })
  const event: BoneyardEnemySemanticEvent = Object.freeze({
    actorId: projectile.ownerActorId,
    eventId: source.nextEventId,
    projectileId: projectile.id,
    targetPlayerId: null,
    tick,
    type: 'projectile-retired',
  })
  return {
    events: Object.freeze([event]),
    rng: angularVelocity.state,
    store: {
      ...source,
      nextEventId: source.nextEventId + 1,
      nextProjectileEffectId: source.nextProjectileEffectId + 1,
      projectileEffects: Object.freeze([...source.projectileEffects, effect]),
      projectiles: Object.freeze(projectiles),
    },
    tumbled: true,
  }
}

function damageBoneyardMaggot(
  source: BoneyardEnemyStore,
  request: DamageBoneyardEnemyRequest,
): DamageBoneyardEnemyResult {
  const index = source.maggots.findIndex((maggot) => maggot.id === request.actorId)
  const maggot = source.maggots[index]
  if (!maggot || maggot.lifeState !== 'alive' || !maggot.combatActive) {
    return { accepted: false, events: [], healthDamage: 0, killed: false, store: source }
  }
  const currentHealth = maggot.currentHealth - request.amount
  const healthDamage = Math.min(Math.max(maggot.currentHealth, 0), request.amount)
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
  notifyAttributedHealthDamage(request, maggot.id, maggot.maximumHealth, healthDamage)
  return {
    accepted: true,
    events: [],
    healthDamage,
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
  healthDamage: number,
): DamageBoneyardEnemyResult {
  return {
    accepted: true,
    events: Object.freeze(work.events),
    healthDamage,
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

function notifyAttributedHealthDamage(
  request: DamageBoneyardEnemyRequest,
  actorId: number,
  maximumHealth: number,
  amount: number,
): void {
  if (request.sourcePlayerId === null || amount <= 0) return
  const observer = request.attributionObserver ?? request.lethalObserver?.attributionObserver
  observer?.onEnemyHealthDamage({
    actorId,
    amount,
    maximumHealth,
    playerId: request.sourcePlayerId,
  })
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
      alphaMultiplier: 1,
      alphaLossPerTick: 0.05,
      angularVelocityDeg: 0,
      atlas: 'BadGuys',
      blendMode: 'add',
      bounceRetention: 0,
      bounceVelocity: 0,
      entry: 69,
      firstEntry: 69,
      frameCount: 1,
      framePhase: 0,
      frameVelocity: 0,
      frameVelocityDamping: 1,
      frameTicks: 1,
      height: 0,
      id: work.nextDeathEffectId,
      kind: 'fade',
      lastStepTick: tick,
      lifetimeTicks: Math.ceil(alpha / 0.05),
      opacityTimer: alpha,
      ownerActorId: actor.id,
      painterRegistration: work.registerWorldPainter('actor'),
      presentationOwner: 'world-sorted',
      position: Object.freeze({ x: actor.position.x, y: actor.position.y - 30 }),
      role: 'shield-break-particle',
      rotationDeg,
      scale,
      scaleMultiplier: 1,
      shadow: false,
      spawnTick: tick,
      tint: 0xffffff,
      verticalVelocity: 0,
      velocity: Object.freeze({ x: 0, y: 0 }),
      velocityDamping: 1,
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
  if (context.paused) return stepPausedBoneyardEnemyStore(source, context)
  const standaloneWorldManagerOrder = createNativeWorldManagerOrder(
    standaloneEnemyWorldManagerOrderState(source),
  )
  const work: WorkingStep = {
    actors: [],
    deathEffects: [],
    events: [],
    headFacingRngState: source.headFacingRngState,
    impActorCount: source.actors.filter(({ config }) => config.enemyToken === 'IMP').length,
    locomotionRngState: source.locomotionRngState,
    mageLightningPulses: source.mageLightningPulses.filter((pulse) => (
      context.tick - pulse.tick < NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES
    )),
    maggots: [...source.maggots],
    nextActorId: source.nextActorId,
    nextDeathEpoch: source.nextDeathEpoch,
    nextDeathEffectId: source.nextDeathEffectId,
    nextEventId: source.nextEventId,
    nextMageLightningPulseId: source.nextMageLightningPulseId,
    nextNativeCellBindingOrder: source.nextNativeCellBindingOrder,
    nextNativeRegistrationOrder: source.nextNativeRegistrationOrder,
    nextProjectileId: source.nextProjectileId,
    nextProjectileEffectId: source.nextProjectileEffectId,
    nextSyntheticSpawnIntentId: source.nextSyntheticSpawnIntentId,
    playerDamage: [],
    playerKnockbacks: [],
    pathStatusFactors: new Map(),
    projectiles: [...source.projectiles],
    projectileEffects: [],
    registerWorldPainter: context.registerWorldPainter
      ?? standaloneWorldManagerOrder.register,
    registerProjectileWorldPainter: context.registerProjectileWorldPainter
      ?? context.registerWorldPainter
      ?? standaloneWorldManagerOrder.register,
    retired: [],
    rewards: [],
    rngState: source.rngState,
    steeringRngState: source.steeringRngState,
    spawnedActorIds: [],
  }
  const transients = stepBoneyardTransientEffects(
    source.deathEffects,
    source.projectileEffects,
    context.tick,
    () => drawUnit(work),
    work.nextDeathEffectId,
    work.registerWorldPainter,
    NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS,
  )
  work.deathEffects = transients.deathEffects
  work.nextDeathEffectId = transients.nextDeathEffectId
  work.projectileEffects = transients.projectileEffects
  for (const actor of source.actors) {
    const timedActor = stepDamagePresentationTimers(
      actor,
      context.tick - source.lastStepTick,
    )
    const stepped = timedActor.lifeState === 'dying'
      ? stepDyingActor(work, timedActor, context)
      : stepLivingActor(work, timedActor, context)
    if (stepped) {
      const rebound = withNativeCellRebindOrder(work, actor, stepped)
      // Native 0x00625680 rebuilds status scalars from 1.0 every tick. The
      // affected config is a current-tick view, never the next authored row.
      work.actors.push(rebound.config === timedActor.config
        ? rebound
        : { ...rebound, config: timedActor.config })
    } else if (timedActor.config.enemyToken === 'IMP') {
      work.impActorCount -= 1
    }
  }
  stepMageShields(work, context)
  const maggotsBeforeStep = new Map(work.maggots.map((maggot) => [maggot.id, maggot]))
  stepMaggots(work, context, context.tick - source.lastStepTick)
  work.maggots = work.maggots.map((maggot) => {
    const before = maggotsBeforeStep.get(maggot.id)
    return before ? withNativeCellRebindOrder(work, before, maggot) : maggot
  })
  const projectilesBeforeStep = new Map(work.projectiles.map((projectile) => [
    projectile.id,
    projectile,
  ]))
  stepProjectiles(work, context)
  work.projectiles = work.projectiles.map((projectile) => {
    const before = projectilesBeforeStep.get(projectile.id)
    return before ? withNativeCellRebindOrder(work, before, projectile) : projectile
  })
  const spawnIntents = context.resolveSpawnIntents(
    work.actors.length,
    liveZombieCount(work.actors),
  )
  work.actors.push(...materializeSpawnIntents(work, context, spawnIntents))
  return finishBoneyardEnemyStoreStep(work, context.tick)
}

function stepPausedBoneyardEnemyStore(
  source: BoneyardEnemyStore,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyStoreStepResult {
  const standaloneWorldManagerOrder = createNativeWorldManagerOrder(
    standaloneEnemyWorldManagerOrderState(source),
  )
  const work: WorkingStep = {
    actors: [...source.actors],
    deathEffects: [...source.deathEffects],
    events: [],
    headFacingRngState: source.headFacingRngState,
    impActorCount: source.actors.filter(({ config }) => config.enemyToken === 'IMP').length,
    locomotionRngState: source.locomotionRngState,
    mageLightningPulses: [...source.mageLightningPulses],
    maggots: [...source.maggots],
    nextActorId: source.nextActorId,
    nextDeathEpoch: source.nextDeathEpoch,
    nextDeathEffectId: source.nextDeathEffectId,
    nextEventId: source.nextEventId,
    nextMageLightningPulseId: source.nextMageLightningPulseId,
    nextNativeCellBindingOrder: source.nextNativeCellBindingOrder,
    nextNativeRegistrationOrder: source.nextNativeRegistrationOrder,
    nextProjectileId: source.nextProjectileId,
    nextProjectileEffectId: source.nextProjectileEffectId,
    nextSyntheticSpawnIntentId: source.nextSyntheticSpawnIntentId,
    pathStatusFactors: new Map(),
    playerDamage: [],
    playerKnockbacks: [],
    projectiles: [...source.projectiles],
    projectileEffects: [...source.projectileEffects],
    registerWorldPainter: context.registerWorldPainter
      ?? standaloneWorldManagerOrder.register,
    registerProjectileWorldPainter: context.registerProjectileWorldPainter
      ?? context.registerWorldPainter
      ?? standaloneWorldManagerOrder.register,
    retired: [],
    rewards: [],
    rngState: source.rngState,
    steeringRngState: source.steeringRngState,
    spawnedActorIds: [],
  }
  const spawnIntents = context.resolveSpawnIntents(
    work.actors.length,
    liveZombieCount(work.actors),
  )
  work.actors.push(...materializeSpawnIntents(work, context, spawnIntents))
  work.events = []
  return finishBoneyardEnemyStoreStep(work, context.tick)
}

function finishBoneyardEnemyStoreStep(
  work: WorkingStep,
  tick: number,
): BoneyardEnemyStoreStepResult {
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
      lastStepTick: tick,
      locomotionRngState: work.locomotionRngState,
      mageLightningPulses: work.mageLightningPulses,
      maggots: work.maggots,
      nextActorId: work.nextActorId,
      nextDeathEpoch: work.nextDeathEpoch,
      nextDeathEffectId: work.nextDeathEffectId,
      nextEventId: work.nextEventId,
      nextMageLightningPulseId: work.nextMageLightningPulseId,
      nextNativeCellBindingOrder: work.nextNativeCellBindingOrder,
      nextNativeRegistrationOrder: work.nextNativeRegistrationOrder,
      nextProjectileId: work.nextProjectileId,
      nextProjectileEffectId: work.nextProjectileEffectId,
      nextSyntheticSpawnIntentId: work.nextSyntheticSpawnIntentId,
      projectiles: work.projectiles,
      projectileEffects: work.projectileEffects,
      rngState: work.rngState,
      steeringRngState: work.steeringRngState,
    },
  }
}

function liveZombieCount(actors: readonly BoneyardEnemyActor[]): number {
  return actors.filter(({ config }) => config.enemyToken === 'ZOMBIE').length
}

function materializeSpawnIntents(
  work: WorkingStep,
  context: BoneyardEnemyStoreStepContext,
  spawnIntents: readonly BoneyardEnemySpawnIntent[],
  impSplitDepthOverride: number | null = null,
): BoneyardEnemyActor[] {
  const actors: BoneyardEnemyActor[] = []
  const placementGroups = new Map<number, Readonly<BoneyardPoint>>()
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
      authoredRecipe: intent.authoredRecipe,
      flags: intent.flags,
      flanking: intent.flanking,
      mageCloak: intent.mageCloak,
      pathfindingMode: intent.pathfindingMode,
      random: {
        baseSpeedUnit: baseSpeed.value,
        collisionRadiusUnit: radius.value,
        randomArmor: armor.value >= 0.5,
        splitManyGateUnit: split.value,
        splitManyUnit: splitMany?.value ?? 0,
        splitUnit: split.value >= 0.5 ? 1 : 0,
      },
      waveOrdinal: intent.waveOrdinal,
      zombieBodyType: intent.zombieBodyType,
    })
    const config = impSplitDepthOverride === null
      ? evaluatedConfig
      : withImpSplitDepth(evaluatedConfig, impSplitDepthOverride)
    if (
      config.enemyToken === 'IMP'
      && work.impActorCount >= NATIVE_IMP_CONSTRUCTION_MAXIMUM
    ) continue
    const placementGroupId = intent.placementGroupId
    if (
      placementGroupId !== undefined
      && (!Number.isSafeInteger(placementGroupId) || placementGroupId < 1)
    ) throw new RangeError('enemy placement group id must be a positive safe integer')
    const cachedPosition = placementGroupId === undefined
      ? undefined
      : placementGroups.get(placementGroupId)
    let position: Readonly<BoneyardPoint>
    if (cachedPosition) {
      position = cachedPosition
    } else {
      const placement = context.resolveSpawnPlacement?.({
        actorId: work.nextActorId,
        position: intent.position,
        positionPolicy: intent.positionPolicy ?? 'direct',
        radius: config.collisionRadius,
        rngState: work.steeringRngState,
      })
      if (placement) work.steeringRngState = placement.rngState
      position = placement?.position ?? context.resolveMovement({
        actorId: work.nextActorId,
        delta: { x: 0, y: 0 },
        position: intent.position,
        purpose: 'spawn-placement',
        radius: config.collisionRadius,
        requestedPosition: intent.position,
      })
      if (placementGroupId !== undefined) {
        placementGroups.set(placementGroupId, Object.freeze({ ...position }))
      }
    }
    validatePoint(position, 'resolved enemy spawn position')
    const targetPlayerId = nearestEligibleTarget(position, context.players)
    const stridePhaseDeg = config.enemyToken === 'ZOMBIE'
      ? drawLocomotionStridePhase(work)
      : 0
    const gaitPose = drawLocomotionPhase(work)
    const bodyGaitPhase = drawLocomotionPhase(work)
    const path = createNativeEnemyPathState(work.steeringRngState)
    work.steeringRngState = path.rngState
    const brain = createBrain(work, config)
    const restBodyPose = config.enemyToken === 'SKELETONMAGE'
      ? drawLocomotionInteger(work, 2)
      : 0
    const hurricaneContactCooldown = drawInteger(work, 100)
    const actor: BoneyardEnemyActor = {
      blizzardPushAccumulator: 0,
      blizzardPushLastTick: null,
      bodyGaitPhase,
      bodyPose: restBodyPose,
      brain,
      config,
      currentHealth: config.maximumHealth,
      deathEpoch: null,
      deathPresentationStarted: false,
      deathStartedTick: null,
      deathTick: 0,
      gaitPose,
      headFacingOffset: 0,
      headingDeg: targetHeading(position, targetPlayerId, context.players),
      hurricaneContactCooldown,
      id: work.nextActorId,
      lastDamagedByPlayerId: null,
      lastDamageTick: null,
      lastMovementTick: null,
      lifeState: 'alive',
      lightRegistration: work.registerWorldPainter('actor'),
      lighting: Object.freeze({ charge: 0, glow: 0, providerCopies: 0 }),
      lootSeed: nextLootSeed(work, context),
      nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
      nextTargetRefreshTick: context.tick
        + nativeEnemyTargetRefreshTicks(config.pathfindingMode),
      nativeCellBindingOrder: work.nextNativeCellBindingOrder,
      nativeRegistrationOrder: work.nextNativeRegistrationOrder,
      path: path.state,
      position: Object.freeze({ ...position }),
      rewardGranted: false,
      restBodyPose,
      shieldHealth: 0,
      shieldMaximumHealth: 0,
      shieldPulse: 0,
      shieldSoundCooldownTicks: 0,
      sourceSpawnIntentId: intent.id,
      spawnTick: intent.spawnTick,
      staffActionFactor: 1,
      staffMovementFactor: 1,
      stridePhaseDeg,
      targetPlayerId,
      terminalEmitted: false,
      waveOrdinal: intent.waveOrdinal,
    }
    work.nextNativeCellBindingOrder += 1
    work.nextNativeRegistrationOrder += 1
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
      const range = constructNativeRangedAttackRange(
        'archer',
        config.family.rangeMode,
        work.steeringRngState,
      )
      work.steeringRngState = range.rngState
      return {
        actionProgress: 0,
        aimSeed: 0,
        attackRange: range.range,
        family: 'archer',
        markerEmitted: false,
        phase: 'range-control',
        rangeEasyPending: range.rangeEasyPending,
      }
    }
    case 'SKELETONMAGE': {
      const inheritedArcherRange = constructNativeRangedAttackRange(
        'archer',
        0,
        work.steeringRngState,
      )
      const range = constructNativeRangedAttackRange(
        'mage',
        config.family.rangeMode,
        inheritedArcherRange.rngState,
      )
      work.steeringRngState = range.rngState
      return {
        actionProgress: 0,
        attackRange: range.range,
        castProgram: 'short',
        castRoll: 0,
        family: 'mage',
        lightningTargetPlayerId: null,
        lightningTargetPosition: null,
        lightningTicksRemaining: 0,
        markerEmitted: false,
        phase: 'range-control',
        rangeEasyPending: range.rangeEasyPending,
        shieldTicksRemaining: config.family.shieldInterval > 0
          ? boundedMageShieldIntervalTicks(config.family.shieldInterval)
          : 0,
      }
    }
    case 'IMP': {
      const flight = createNativeImpFlightState(
        () => drawUnit(work),
        config.baseSpeed,
      )
      return {
        ...flight,
        escapeHeadingDeg: null,
        family: 'imp',
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
      const configuredBodyType = config.family.bodyType === 3 ? 3 : bodyType
      const configuredHeadType = config.family.bodyType === 3 ? 3 : headType
      return {
        actionProgress: 0,
        actionRate: 0,
        actionSwing: 0,
        angularOffsetDeg: 0,
        attackSide,
        bodyPhaseDeg,
        bodyType: configuredBodyType,
        contactTargetPlayerId: null,
        family: 'zombie',
        frontArmBaseRotationDeg,
        headBaseRotationDeg,
        headPhaseDeg,
        headType: configuredHeadType,
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
      const initialGate = randomBoneyardWaveInteger(work.rngState, 50)
      work.rngState = initialGate.state
      const launchScale = drawUnit(work) < 0.5 ? -1 : 1
      const launchRotationDeg = signedUnit(drawUnit(work)) * 15
      return {
        family: 'coffin',
        launchRotationDeg,
        launchScale,
        maggotCharge: 0,
        phase: 'hidden',
        phaseTick: 0,
        phaseTicksRemaining: hidden.value === 0
          ? NATIVE_COFFIN_HIDDEN_SHORT_TICKS + initialGate.value
          : NATIVE_COFFIN_HIDDEN_LONG_TICKS + initialGate.value,
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
  const hurricaneContactCooldown = Math.max(
    0,
    actor.hurricaneContactCooldown
      - elapsedTicks * NATIVE_HURRICANE_DEFAULT_MOVEMENT_STEP,
  )
  const shieldPulse = Math.max(0, actor.shieldPulse - elapsedTicks * 0.05)
  const shieldSoundCooldownTicks = Math.max(
    0,
    actor.shieldSoundCooldownTicks - elapsedTicks,
  )
  return shieldPulse === actor.shieldPulse
    && shieldSoundCooldownTicks === actor.shieldSoundCooldownTicks
    && hurricaneContactCooldown === actor.hurricaneContactCooldown
    ? actor
    : { ...actor, hurricaneContactCooldown, shieldPulse, shieldSoundCooldownTicks }
}

function stepLivingActor(
  work: WorkingStep,
  source: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const effect = context.abilityEffects?.[source.id]
  work.pathStatusFactors.set(
    source.id,
    source.staffMovementFactor * nativeSecondaryActorSpeedScale(effect),
  )
  const affected = effect === undefined
    ? source
    : withNativeSecondaryTickScalars(source, effect)
  const actor = refreshTarget(affected, context)
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
  if (
    actor.path.reorientationTicksRemaining > 0
    && actor.brain.family !== 'coffin'
  ) {
    const reoriented = reorientEnemyTowardTarget(actor, context.players)
    const lit = stepEnemyLighting(reoriented)
    return lit.brain.family === 'mage'
      ? applyMageProviderGateAfterAction(lit)
      : lit
  }
  if ((effect?.fleeTicks ?? 0) > 0 && actor.brain.family !== 'coffin') {
    const interrupted = clearSkeletonFamilyHeadFacing(
      interruptNativeSecondaryAction(actor),
    )
    const fled = moveTowardTarget(
      work,
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
      case 'imp': return stepImp(work, articulated, articulated.brain, context)
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
  if (actor.targetPlayerId === null) {
    const reset = resetSkeleton(actor, brain)
    return moveTowardTarget(work, reset, reset.brain, context, 1)
  }
  if (brain.phase === 'attack') {
    const tracked = trackEnemyActionHeading(actor, context.players)
    if (brain.action === 'claw') {
      return stepSkeletonClawAction(work, tracked, brain, context)
    }
    if (brain.action === 'weapon') {
      return stepSkeletonWeaponAction(work, tracked, brain, context)
    }
    const program = NATIVE_SKELETON_ACTION_PROGRAMS[brain.action]
    return stepProgressAction(
      work,
      tracked,
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
  return moveTowardTarget(work, actor, brain, context, 1)
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
    + program.progressPerTick * staffAttackSpeed(actor)
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
    + program.progressPerTick * staffAttackSpeed(actor)
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
  if (actor.targetPlayerId === null) {
    const reset = resetArcher(actor, brain)
    return moveTowardTarget(work, reset, reset.brain, context, 1)
  }
  if (brain.phase === 'attack') {
    const tracked = trackEnemyActionHeading(actor, context.players)
    let attackRange = brain.attackRange
    let rangeEasyPending = brain.rangeEasyPending
    const stepped = stepProgressAction(
      work,
      tracked,
      brain,
      NATIVE_ARCHER_ACTION_PROGRAM,
      NATIVE_ARCHER_SHOT_BODY_POSES,
      context.tick,
      actor.targetPlayerId,
      () => {
        const restored = restoreNativeRangeEasyAfterVolley(
          attackRange,
          rangeEasyPending,
        )
        attackRange = restored.range
        rangeEasyPending = restored.pending
        emitArcherVolley(work, tracked, brain.aimSeed, context)
      },
    )
    if (stepped.brain.family !== 'archer') throw new Error('Archer action changed brain family')
    return {
      ...stepped,
      brain: { ...stepped.brain, attackRange, rangeEasyPending },
    }
  }
  const distance = targetDistance(actor, context.players)
  if (
    distance < brain.attackRange
    && enemyTargetLineOfSightIsClear(actor, context)
  ) {
    const aimSeed = drawNativeInteger(
      work.steeringRngState,
      NATIVE_ARCHER_PRIVATE_SEED_BOUND,
    )
    work.steeringRngState = aimSeed.state
    return {
      ...actor,
      bodyPose: NATIVE_ARCHER_SHOT_BODY_POSES[0]!,
      brain: {
        ...brain,
        actionProgress: 0,
        aimSeed: aimSeed.value,
        markerEmitted: false,
        phase: 'attack',
      },
      lootSeed: aimSeed.value,
    }
  }
  return moveTowardTarget(work, actor, brain, context, 1)
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
    const reset = resetMage(actor, brain)
    stepped = moveTowardTarget(work, reset, reset.brain, context, 1)
  } else if (brain.phase === 'cast') {
    const tracked = trackEnemyActionHeading(actor, context.players)
    const base = NATIVE_MAGE_ACTION_PROGRAMS[brain.castProgram]
    let attackRange = brain.attackRange
    let rangeEasyPending = brain.rangeEasyPending
    let spellDispatched = false
    stepped = stepProgressAction(
      work,
      tracked,
      brain,
      { ...base, progressPerTick: base.progressPerTick * (1 + brain.castRoll) },
      NATIVE_MAGE_CAST_BODY_POSES[brain.castProgram],
      context.tick,
      actor.targetPlayerId,
      (eventId) => {
        spellDispatched = true
        const restored = restoreNativeRangeEasyAfterVolley(
          attackRange,
          rangeEasyPending,
        )
        attackRange = restored.range
        rangeEasyPending = restored.pending
        const dispatch = emitMageAttack(work, tracked, context, eventId)
        if (dispatch !== null) lightningDispatches.push(dispatch)
      },
    )
    if (stepped.brain.family !== 'mage') throw new Error('Mage cast changed brain family')
    stepped = {
      ...stepped,
      brain: { ...stepped.brain, attackRange, rangeEasyPending },
    }
    if (spellDispatched && actor.config.enemyToken === 'SKELETONMAGE') stepped = {
      ...stepped,
      lighting: {
        ...stepped.lighting,
        charge: actor.config.family.element === 'lightning' ? 1 : 0,
      },
    }
  } else {
    const distance = targetDistance(actor, context.players)
    if (
      distance < brain.attackRange
      && enemyTargetLineOfSightIsClear(actor, context)
    ) {
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
      stepped = moveTowardTarget(work, actor, brain, context, 1)
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
        lightningTicksRemaining: nativeMageLightningDurationTicks(staffAttackSpeed(actor)),
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
  if (brain.phase === 'death') return actor
  const moved = moveImp(actor, brain, work, context)
  let visualRngState = brain.visualRngState
  const random = (): number => {
    const draw = nextBoneyardWaveRandom(visualRngState)
    visualRngState = draw.state
    return draw.value
  }
  const flight = stepNativeImpFlight(brain, random)
  let stepped: BoneyardEnemyActor = {
    ...moved,
    brain: {
      ...brain,
      ...flight.state,
      visualRngState,
    },
  }
  if (!flight.bounced) return stepped

  const vocal = randomIntegerFromUnit(random, 8)
  emitEnemyActionSound(
    work,
    context.tick,
    stepped,
    NATIVE_IMP_VOCAL_SOUNDS[vocal]!,
    1 + random() * 0.1,
  )
  // Landing vslot +0x98 record-15 scale and green-channel draws occur before
  // the contact-distance branch. Clients key the cosmetic recipe from the
  // replay-safe vocal event identity while authority retains native draw order.
  random()
  random()
  const targetPlayerId = stepped.targetPlayerId
  const target = targetPlayerId === null ? undefined : context.players[targetPlayerId]
  if (
    targetPlayerId === null
    || !target
    || !targetEligible(target)
    || !targetPlayerWithinAttackReach(
      stepped,
      targetPlayerId,
      context.players,
      (target.collisionRadius + NATIVE_IMP_CONTACT_BASE_RADIUS)
        * NATIVE_IMP_CONTACT_RADIUS_SCALE,
    )
  ) {
    const steppedBrain = stepped.brain
    if (steppedBrain.family !== 'imp') throw new Error('Imp flight changed brain family')
    return {
      ...stepped,
      brain: { ...steppedBrain, visualRngState },
    }
  }

  const bite = randomIntegerFromUnit(random, 3)
  emitEnemyActionSound(
    work,
    context.tick,
    stepped,
    NATIVE_IMP_BITE_SOUNDS[bite]!,
    1 + random() * 0.25,
  )

  const eventId = attackMarker(work, stepped, context.tick, targetPlayerId)
  // Raw FireBurst constructor rotation/magnitude/sign and caller scale.
  random()
  random()
  random()
  random()
  const escapeHeadingDeg = positiveModulo(stepped.headingDeg + 180 + random() * 45, 360)
  const steppedBrain = stepped.brain
  if (steppedBrain.family !== 'imp') throw new Error('Imp contact changed brain family')
  stepped = {
    ...stepped,
    headingDeg: escapeHeadingDeg,
    brain: {
      ...steppedBrain,
      escapeHeadingDeg,
      visualRngState,
    },
  }
  directContactPlayerDamage(
    work,
    stepped,
    targetPlayerId,
    context.players,
    (target.collisionRadius + NATIVE_IMP_CONTACT_BASE_RADIUS)
      * NATIVE_IMP_CONTACT_RADIUS_SCALE,
    eventId,
  )
  return stepped
}

function moveImp(
  actor: BoneyardEnemyActor,
  brain: BoneyardImpBrain,
  work: WorkingStep,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (context.tick < actor.nextMovementTick) return actor
  const statusFactor = work.pathStatusFactors.get(actor.id) ?? 1
  const movementScalar = Math.fround(
    actor.config.chaseSpeed
      * brain.horizontalSpeed
      * actor.staffMovementFactor
      * actor.config.scale
      * actor.path.speedFactor
      * statusFactor,
  )
  const movementPerTick = 0.25 * movementScalar
  const target = actor.targetPlayerId === null
    ? null
    : context.players[actor.targetPlayerId] ?? null
  let path = actor.path
  let headingDeg = actor.headingDeg
  let delta: Readonly<BoneyardPoint>
  if (brain.escapeHeadingDeg !== null) {
    headingDeg = brain.escapeHeadingDeg
    const radians = headingDeg * Math.PI / 180
    delta = Object.freeze({
      x: Math.sin(radians) * movementPerTick * NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
      y: -Math.cos(radians) * movementPerTick * NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    })
  } else {
    const targetVelocity = target?.velocityPerTick ?? { x: 0, y: 0 }
    const targetHeadingDeg = Math.hypot(targetVelocity.x, targetVelocity.y) === 0
      ? target?.headingDeg ?? 0
      : actorHeadingFromVector(targetVelocity.x, targetVelocity.y)
    const steeringRequest = {
      actorHeadingDeg: actor.headingDeg,
      actorPosition: actor.position,
      cadenceTicks: NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
      movementPerTick,
      radialDirection: 1 as const,
      statusFactor,
      tangentDirection: 0 as const,
      targetHeadingDeg,
      targetPosition: target?.position ?? null,
    }
    const rawGoal = nativeEnemySteeringGoal(path, steeringRequest)
    let goalPosition: Readonly<BoneyardPoint> = rawGoal
    if (context.navigation) {
      const navigationClearance = enemyNavigationClearance(actor)
      const routed = resolveNativeEnemyPathGoal(path, {
        actorPosition: actor.position,
        bodyRadius: actor.config.collisionRadius,
        cadenceTicks: NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
        directPathClear: (start, end) => context.navigation!.isPathClear({
          actorId: actor.id,
          bodyRadius: actor.config.collisionRadius,
          end,
          navigationClearance,
          radius: 0,
          start,
        }),
        findRoute: (start, end, clearance, bodyRadius) => (
          context.navigation!.findRoute({
            actorId: actor.id,
            bodyRadius,
            end,
            navigationClearance: clearance,
            radius: clearance,
            start,
          })
        ),
        navigationClearance,
        rawGoal,
        targetPosition: target?.position ?? null,
        targetRefreshTicks: nativeEnemyTargetRefreshTicks(actor.config.pathfindingMode),
      })
      path = routed.state
      headingDeg = routed.turnAround
        ? positiveModulo(headingDeg + 180, 360)
        : headingDeg
      goalPosition = routed.goal
    }
    const steering = buildNativeEnemySteering(path, {
      ...steeringRequest,
      actorHeadingDeg: headingDeg,
      goalPosition,
    })
    delta = steering.delta
    headingDeg = steering.headingDeg
    path = steering.state
  }
  const distance = Math.hypot(delta.x, delta.y)
  const position = context.resolveMovement({
    actorId: actor.id,
    delta,
    position: actor.position,
    purpose: 'movement',
    radius: actor.config.collisionRadius,
    requestedPosition: {
      x: actor.position.x + delta.x,
      y: actor.position.y + delta.y,
    },
  })
  validatePoint(position, 'resolved Imp position')
  const traveled = Math.hypot(
    position.x - actor.position.x,
    position.y - actor.position.y,
  )
  const recovery = stepNativeEnemyPathRecovery(
    path,
    work.steeringRngState,
    {
      flankingEnabled: actor.config.flanking,
      requestedDistance: distance,
      statusFactor,
      tick: context.tick,
      traveledDistance: traveled,
    },
  )
  work.steeringRngState = recovery.rngState
  return {
    ...actor,
    brain,
    headingDeg,
    lastMovementTick: traveled === 0 ? actor.lastMovementTick : context.tick,
    nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    path: recovery.state,
    position: Object.freeze({ ...position }),
  }
}

function stepZombie(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardZombieBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) {
    const reset = resetZombie(actor, brain)
    return moveTowardTarget(work, reset, reset.brain, context, 1)
  }
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
    const tracked = trackEnemyActionHeading(actor, context.players)
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
      const eventId = attackMarker(work, tracked, context.tick, brain.contactTargetPlayerId)
      directContactPlayerDamage(
        work,
        tracked,
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
        ...tracked,
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
      ...tracked,
      gaitPose: previousProgress < NATIVE_ZOMBIE_BEAT_ACTION_PROGRAM.locomotionEndProgress
        ? positiveModulo(tracked.gaitPose - 0.025, 8)
        : tracked.gaitPose,
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
    ) * staffAttackSpeed(actor)
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
  return moveTowardTarget(work, actor, brain, context, 1)
}

function stepWraith(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardWraithBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) {
    const reset = resetWraith(actor, brain)
    return moveTowardTarget(work, reset, reset.brain, context, 1)
  }
  if (brain.phase === 'cooldown') {
    const moved = moveTowardTarget(work, actor, brain, context, 1)
    const movedBrain = moved.brain
    if (movedBrain.family !== 'wraith') throw new Error('Wraith chase changed brain family')
    const remaining = Math.max(0, brain.phaseTicksRemaining - 1)
    return {
      ...moved,
      brain: remaining === 0
        ? {
            ...movedBrain,
            actionTick: 0,
            contactTargetPlayerId: null,
            markerEmitted: false,
            phase: 'approach',
            phaseTicksRemaining: 0,
          }
        : { ...movedBrain, phaseTicksRemaining: remaining },
    }
  }
  if (brain.phase === 'orbit') {
    const moved = moveTowardTarget(work, actor, brain, context, 0, 1)
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
    const moved = moveTowardTarget(work, actor, brain, context, 1)
    const movedBrain = moved.brain
    if (movedBrain.family !== 'wraith') throw new Error('Wraith drain changed brain family')
    const nextTick = brain.actionTick + staffAttackSpeed(actor)
    let markerEmitted = brain.markerEmitted
    if (!markerEmitted && nextTick >= BOUNDED_ENEMY_ACTION_PROGRAMS.wraithDrain.markerTick) {
      const eventId = attackMarker(work, moved, context.tick, brain.contactTargetPlayerId)
      directContactPlayerDamage(
        work,
        moved,
        brain.contactTargetPlayerId,
        context.players,
        BOUNDED_ENEMY_ATTACK_REACH.WRAITH,
        eventId,
      )
      markerEmitted = true
    }
    if (nextTick > BOUNDED_ENEMY_ACTION_PROGRAMS.wraithDrain.strictEndTick) {
      return {
        ...moved,
        brain: {
          ...movedBrain,
          actionTick: 0,
          contactTargetPlayerId: null,
          markerEmitted: false,
          phase: 'cooldown',
          phaseTicksRemaining: BOUNDED_ENEMY_ACTION_PROGRAMS.wraithDrain.cooldownTicks,
        },
      }
    }
    return {
      ...moved,
      brain: { ...movedBrain, actionTick: nextTick, markerEmitted },
    }
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
  return moveTowardTarget(work, actor, brain, context, 1)
}

function stepDemon(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardDemonBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) {
    const reset = resetDemon(actor, brain)
    return moveTowardTarget(work, reset, reset.brain, context, 1)
  }
  if (brain.phase === 'bomb') {
    const previousProgress = brain.actionProgress
    const nextProgress = previousProgress
      + NATIVE_DEMON_BOMB_ACTION_PROGRAM.progressPerTick * staffAttackSpeed(actor)
    let markerEmitted = brain.markerEmitted
    if (
      !markerEmitted
      && previousProgress < NATIVE_DEMON_BOMB_ACTION_PROGRAM.markerProgress
      && nextProgress >= NATIVE_DEMON_BOMB_ACTION_PROGRAM.markerProgress
    ) {
      attackMarker(work, actor, context.tick)
      // Raw Anim_FireBurst constructor: rotation, angular magnitude, sign.
      drawUnit(work)
      drawUnit(work)
      drawInteger(work, 2)
      spawnProjectile(
        work,
        actor,
        context.tick,
        'demon-bomb',
        actor.config.primaryDamage ?? 0,
      )
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
  return moveTowardTarget(work, actor, brain, context, 1)
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
    bodyPhaseDeg += random() * 1.5
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
      if (sourceBrain.bodyType === 3) {
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
    const speed = Math.fround(actor.config.baseSpeed * actor.staffMovementFactor)
    if (!(speed > 0)) return actor
    const ratio = Math.fround(brain.maggotCharge / speed)
    const count = ratio < 1
      ? 3
      : drawUnit(work) * ratio < 1 ? 1 : 0
    spawnCoffinMaggots(work, actor, context, count)
    if (count > 0) {
      emitEvent(work, tick, 'coffin-maggot-release', actor.id, { count })
    }
    return {
      ...actor,
      brain: {
        ...brain,
        maggotCharge: Math.min(
          NATIVE_COFFIN_MAGGOT_CHARGE_MAXIMUM,
          Math.fround(brain.maggotCharge + NATIVE_COFFIN_MAGGOT_CHARGE_PER_TICK),
        ),
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
          maggotCharge: 0,
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
  if (actor.config.enemyToken !== 'COFFIN' || actor.brain.family !== 'coffin') return 0
  const family = actor.config.family
  const brain = actor.brain
  const count = requestedCount
  for (let index = 0; index < count; index += 1) {
    const launchTrajectory: BoneyardMaggotActor['launchTrajectory'] = drawInteger(work, 2) === 0
      ? 'edge'
      : 'lid'
    const segment = NATIVE_MAGGOT_PROGRAM.launchSegments[launchTrajectory]
    const segmentStart = transformCoffinLaunchPoint(segment.start, brain)
    const segmentEnd = transformCoffinLaunchPoint(segment.end, brain)
    const interpolation = drawUnit(work)
    const localX = segmentStart.x + (segmentEnd.x - segmentStart.x) * interpolation
    const localY = segmentStart.y + (segmentEnd.y - segmentStart.y) * interpolation
    const sourceHeadingDeg = segment.headingMinimumDeg
      + drawUnit(work) * (segment.headingMaximumDeg - segment.headingMinimumDeg)
    const headingDeg = positiveModulo(
      brain.launchScale < 0 ? 360 - sourceHeadingDeg : sourceHeadingDeg,
      360,
    )
    const visualScale = 1 + drawUnit(work) * 0.25
    const launchVelocity = radialVector(headingDeg, 1)
    const emergencePhase = drawUnit(work) * 5
    const landingBounceVelocity = Math.fround(-drawUnit(work) * 0.5)
    const verticalOffset = Math.fround(localY - segmentStart.y - drawUnit(work) * 8)
    const position = Object.freeze({
      x: actor.position.x + localX,
      y: actor.position.y + segmentStart.y - drawUnit(work) * 8,
    })
    const hurricaneContactCooldown = drawInteger(work, 100)
    const path = createNativeEnemyPathState(work.steeringRngState)
    work.steeringRngState = path.rngState
    work.maggots.push(Object.freeze({
      blizzardPushAccumulator: 0,
      blizzardPushLastTick: null,
      collisionRadius: NATIVE_MAGGOT_PROGRAM.collisionRadius,
      combatActive: false,
      currentHealth: family.maggotHealth,
      deathOffsets: nativeMaggotDeathOffsets(work),
      damage: family.maggotDamage,
      deathEpoch: null,
      deathStartedTick: null,
      deathTick: 0,
      emergencePhase,
      emergenceTick: 0,
      gaitPose: 0,
      headingDeg,
      hurricaneContactCooldown,
      id: work.nextActorId,
      launchTrajectory,
      launchVelocity: Object.freeze(launchVelocity),
      landingBounceVelocity,
      lastAttackTick: null,
      lastDamagedByPlayerId: null,
      lastDamageTick: null,
      lastMovementTick: null,
      lifeState: 'alive',
      lightRegistration: work.registerWorldPainter('actor'),
      maximumHealth: family.maggotHealth,
      movementPhase: 'emerging',
      nextAttackTick: context.tick + NATIVE_MAGGOT_PROGRAM.attackDelayAfterEmergenceTicks,
      nextMovementTick: context.tick + 1,
      nextTargetRefreshTick: context.tick + nativeEnemyTargetRefreshTicks(1),
      nativeCellBindingOrder: work.nextNativeCellBindingOrder,
      nativeRegistrationOrder: work.nextNativeRegistrationOrder,
      ownerCoffinActorId: actor.id,
      path: path.state,
      poisonDamage: family.maggotPoisonDamage,
      poisonDuration: family.maggotPoisonDamage > 0
        ? NATIVE_MAGGOT_PROGRAM.poisonDurationTicks
        : 0,
      position,
      spawnTick: context.tick,
      staffActionFactor: 1,
      staffMovementFactor: 1,
      targetPlayerId: null,
      terminalEmitted: false,
      verticalOffset,
      verticalVelocity: 0,
      visualScale,
    }))
    work.nextNativeCellBindingOrder += 1
    work.nextNativeRegistrationOrder += 1
    work.spawnedActorIds.push(work.nextActorId)
    emitEvent(work, context.tick, 'enemy-spawned', work.nextActorId, {
      targetPlayerId: null,
    })
    work.nextActorId += 1
  }
  return count
}

function transformCoffinLaunchPoint(
  point: Readonly<BoneyardPoint>,
  brain: BoneyardCoffinBrain,
): Readonly<BoneyardPoint> {
  const radians = brain.launchRotationDeg * Math.PI / 180
  const x = point.x * brain.launchScale
  return {
    x: x * Math.cos(radians) - point.y * Math.sin(radians),
    y: x * Math.sin(radians) + point.y * Math.cos(radians),
  }
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

interface NativeMaggotAdmissionCount {
  active: number
  inactive: number
}

function nativeMaggotAdmissionCounts(
  maggots: readonly BoneyardMaggotActor[],
): Map<BoneyardEnemyActorId, NativeMaggotAdmissionCount> {
  const counts = new Map<BoneyardEnemyActorId, NativeMaggotAdmissionCount>()
  for (const maggot of maggots) {
    if (maggot.lifeState !== 'alive' || maggot.movementPhase !== 'crawl') continue
    const count = counts.get(maggot.ownerCoffinActorId) ?? { active: 0, inactive: 0 }
    if (maggot.combatActive) count.active += 1
    else count.inactive += 1
    counts.set(maggot.ownerCoffinActorId, count)
  }
  return counts
}

function admitNativeMaggot(
  work: WorkingStep,
  source: BoneyardMaggotActor,
  context: BoneyardEnemyStoreStepContext,
  admissionCounts: Map<BoneyardEnemyActorId, NativeMaggotAdmissionCount>,
): BoneyardMaggotActor | null {
  const owner = work.actors.find((actor) => (
    actor.id === source.ownerCoffinActorId
    && actor.lifeState === 'alive'
    && actor.config.enemyToken === 'COFFIN'
  ))
  if (!owner || owner.config.enemyToken !== 'COFFIN') {
    retireMaggot(work, source, context.tick)
    return null
  }
  const counts = admissionCounts.get(owner.id) ?? { active: 0, inactive: 0 }
  counts.inactive += 1
  if (
    counts.active < owner.config.family.maximumMaggots
    && drawInteger(work, 5) === 3
  ) {
    counts.inactive -= 1
    counts.active += 1
    admissionCounts.set(owner.id, counts)
    return {
      ...source,
      combatActive: true,
      nextAttackTick: context.tick + NATIVE_MAGGOT_PROGRAM.attackDelayAfterEmergenceTicks,
      targetPlayerId: nearestEligibleTarget(source.position, context.players),
    }
  }
  if (counts.inactive > NATIVE_MAGGOT_PROGRAM.maximumInactiveChildren) {
    counts.inactive -= 1
    admissionCounts.set(owner.id, counts)
    retireMaggot(work, source, context.tick)
    return null
  }
  admissionCounts.set(owner.id, counts)
  return { ...source, combatActive: false, targetPlayerId: null }
}

function stepMaggots(
  work: WorkingStep,
  context: BoneyardEnemyStoreStepContext,
  elapsedTicks: number,
): void {
  const retained: BoneyardMaggotActor[] = []
  const admissionCounts = nativeMaggotAdmissionCounts(work.maggots)
  for (const stored of work.maggots) {
    let source = stored.hurricaneContactCooldown <= 0
      ? stored
      : {
          ...stored,
          hurricaneContactCooldown: Math.max(
            0,
            stored.hurricaneContactCooldown
              - elapsedTicks * NATIVE_HURRICANE_DEFAULT_MOVEMENT_STEP,
          ),
        }
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
        && deathTick < NATIVE_MAGGOT_PROGRAM.bitePresentationTicks
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
      const emerged = stepEmergingMaggot(source, context)
      if (emerged.movementPhase === 'emerging') {
        retained.push(emerged)
        continue
      }
      const admitted = admitNativeMaggot(
        work,
        emerged,
        context,
        admissionCounts,
      )
      if (admitted === null) continue
      source = admitted
    }

    if (!source.combatActive) {
      retained.push(source.targetPlayerId === null
        ? source
        : { ...source, targetPlayerId: null })
      continue
    }

    const targetSelection = refreshMaggotTarget(source, context)
    if (targetSelection.targetPlayerId !== source.targetPlayerId) {
      source = { ...source, path: clearNativeEnemyRoute(source.path) }
    }
    const targetPlayerId = targetSelection.targetPlayerId
    const target = targetPlayerId === null ? null : context.players[targetPlayerId] ?? null
    if (source.path.reorientationTicksRemaining > 0) {
      const reoriented = stepNativeEnemyReorientation(
        source.path,
        source.headingDeg,
        source.position,
        target?.position ?? null,
      )
      retained.push({
        ...source,
        ...targetSelection,
        headingDeg: reoriented.headingDeg,
        path: reoriented.state,
      })
      continue
    }
    const distance = target === null
      ? Number.POSITIVE_INFINITY
      : Math.hypot(
          target.position.x - source.position.x,
          target.position.y - source.position.y,
        )
    const fleeing = (effect?.fleeTicks ?? 0) > 0
    if (target !== null && targetPlayerId !== null && !fleeing && distance <= Math.max(
      NATIVE_MAGGOT_PROGRAM.attackReach,
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
        const counts = admissionCounts.get(source.ownerCoffinActorId)
        if (counts) counts.active = Math.max(0, counts.active - 1)
        retained.push({
          ...source,
          deathEpoch: work.nextDeathEpoch - 1,
          deathStartedTick: context.tick,
          deathTick: 0,
          headingDeg: targetHeading(source.position, targetPlayerId, context.players),
          lastAttackTick: context.tick,
          lifeState: 'dying',
          nextTargetRefreshTick: targetSelection.nextTargetRefreshTick,
          targetPlayerId,
          terminalEmitted: false,
        })
      } else {
        retained.push({ ...source, ...targetSelection })
      }
      continue
    }
    if (context.tick < source.nextMovementTick) {
      retained.push({ ...source, ...targetSelection })
      continue
    }
    const direction = fleeing ? -1 : 1
    const speedScale = nativeSecondaryActorSpeedScale(effect)
    const targetVelocity = target?.velocityPerTick ?? { x: 0, y: 0 }
    const targetHeadingDeg = Math.hypot(targetVelocity.x, targetVelocity.y) === 0
      ? target?.headingDeg ?? 0
      : actorHeadingFromVector(targetVelocity.x, targetVelocity.y)
    const steeringRequest = {
      actorHeadingDeg: source.headingDeg,
      actorPosition: source.position,
      cadenceTicks: NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
      movementPerTick: NATIVE_MAGGOT_PROGRAM.movementStep
        / NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS
        * speedScale
        * source.staffMovementFactor
        * source.path.speedFactor,
      radialDirection: direction,
      statusFactor: speedScale,
      tangentDirection: 0,
      targetHeadingDeg,
      targetPosition: target?.position ?? null,
    } as const
    let path = source.path
    let actorHeadingDeg = source.headingDeg
    let goalPosition = nativeEnemySteeringGoal(path, steeringRequest)
    if (!fleeing && context.navigation) {
      const routed = resolveNativeEnemyPathGoal(path, {
        actorPosition: source.position,
        bodyRadius: source.collisionRadius,
        cadenceTicks: NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
        directPathClear: (start, end) => context.navigation!.isPathClear({
          actorId: source.id,
          bodyRadius: source.collisionRadius,
          end,
          navigationClearance: NATIVE_BADGUY_NAVIGATION_CLEARANCE,
          radius: 0,
          start,
        }),
        findRoute: (start, end, clearance, bodyRadius) => (
          context.navigation!.findRoute({
            actorId: source.id,
            bodyRadius,
            end,
            navigationClearance: clearance,
            radius: clearance,
            start,
          })
        ),
        navigationClearance: NATIVE_BADGUY_NAVIGATION_CLEARANCE,
        rawGoal: goalPosition,
        targetPosition: target?.position ?? null,
        targetRefreshTicks: nativeEnemyTargetRefreshTicks(1),
      })
      path = routed.state
      actorHeadingDeg = routed.turnAround
        ? positiveModulo(actorHeadingDeg + 180, 360)
        : actorHeadingDeg
      goalPosition = routed.goal
    }
    const steering = buildNativeEnemySteering(path, {
      ...steeringRequest,
      actorHeadingDeg,
      goalPosition,
    })
    const delta = steering.delta
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
    const recovery = stepNativeEnemyPathRecovery(
      steering.state,
      work.steeringRngState,
      {
        flankingEnabled: true,
        requestedDistance: Math.hypot(delta.x, delta.y),
        statusFactor: source.staffMovementFactor * speedScale,
        tick: context.tick,
        traveledDistance: traveled,
      },
    )
    work.steeringRngState = recovery.rngState
    retained.push({
      ...source,
      gaitPose: traveled === 0
        ? source.gaitPose
        : positiveModulo(
            source.gaitPose + traveled / NATIVE_MAGGOT_PROGRAM.gaitDistancePerPose,
            2,
          ),
      headingDeg: steering.headingDeg,
      lastMovementTick: traveled === 0 ? source.lastMovementTick : context.tick,
      nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
      nextTargetRefreshTick: targetSelection.nextTargetRefreshTick,
      path: recovery.state,
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
  const rootOwner: DeathEffectOwner = { id: maggot.id, position: positions[0]! }
  spawnMaggotFragmentBouncer(work, rootOwner, tick, 1, 'maggot-fragment:root')
  spawnMaggotPerspectiveFade(work, rootOwner, tick, 'maggot-perspective-fade:root')
  for (let index = 1; index < positions.length; index += 1) {
    const owner: DeathEffectOwner = { id: maggot.id, position: positions[index]! }
    spawnMaggotPerspectiveFade(
      work,
      owner,
      tick,
      `maggot-perspective-fade:${index}`,
    )
    spawnMaggotFragmentBouncer(
      work,
      owner,
      tick,
      1,
      `maggot-fragment:${index}`,
    )
  }
}

function spawnMaggotFragmentBouncer(
  work: WorkingStep,
  owner: DeathEffectOwner,
  tick: number,
  speedScale: number,
  role: string,
): void {
  spawnBouncer(
    work,
    owner,
    tick,
    () => 2013 + drawInteger(work, 50),
    role,
    () => {
      const speed = (0.5 + drawUnit(work) * 0.5) * speedScale
      const direction = radialVector(drawUnit(work) * 360, speed)
      const velocity = { x: direction.x * 1.5, y: direction.y }
      const distance = 15 + drawUnit(work) * 10
      return {
        position: {
          x: owner.position.x + velocity.x * (distance + 2),
          y: owner.position.y + velocity.y * distance,
        },
        velocity,
      }
    },
  )
}

function spawnMaggotPerspectiveFade(
  work: WorkingStep,
  owner: DeathEffectOwner,
  tick: number,
  role: string,
): void {
  const rotationDeg = drawUnit(work) * 360
  const scale = 0.65 + drawUnit(work) * 0.35
  const alphaMultiplier = 0.25 + drawUnit(work) * 0.25
  const opacityTimer = 2.5
  spawnSimpleDeathEffect(work, owner, tick, {
    alpha: alphaMultiplier,
    alphaLossPerTick: 0.01,
    alphaMultiplier,
    atlas: 'DeadHawg',
    blendMode: 'normal',
    entry: 28,
    kind: 'fade-perspective',
    lifetimeTicks: 250,
    opacityTimer,
    role,
    rotationDeg,
    scale,
    tint: 0x828c6b,
  })
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
  const requestedTicks = Math.max(0, context.tick - source.spawnTick - source.emergenceTick)
  if (requestedTicks === 0) return source
  let elapsedTicks = 0
  let verticalOffset = source.verticalOffset
  let verticalVelocity = source.verticalVelocity
  let emergencePhase = source.emergencePhase
  let launchVelocity = source.launchVelocity
  let landingBounceVelocity = source.landingBounceVelocity
  let settled = false
  const delta = { x: 0, y: 0 }
  while (elapsedTicks < requestedTicks) {
    delta.x += launchVelocity.x
    delta.y += launchVelocity.y
    verticalOffset = Math.fround(verticalOffset + verticalVelocity)
    verticalVelocity = Math.fround(
      verticalVelocity + NATIVE_MAGGOT_PROGRAM.gravityPerTick,
    )
    emergencePhase = Math.fround(emergencePhase + 0.25)
    if (emergencePhase >= 5) emergencePhase = Math.fround(emergencePhase - 5)
    elapsedTicks += 1
    if (verticalOffset <= 0) continue
    verticalVelocity = landingBounceVelocity
    launchVelocity = Object.freeze({
      x: Math.fround(launchVelocity.x * 0.5),
      y: Math.fround(launchVelocity.y * 0.5),
    })
    landingBounceVelocity = Math.fround(landingBounceVelocity * 0.5)
    if (landingBounceVelocity > -0.25) {
      settled = true
      verticalOffset = 0
      break
    }
  }
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
  const movementPhase = settled
    ? 'crawl' as const
    : 'emerging' as const
  return {
    ...source,
    emergencePhase,
    emergenceTick: source.emergenceTick + elapsedTicks,
    landingBounceVelocity,
    lastMovementTick: traveled === 0 ? source.lastMovementTick : context.tick,
    launchVelocity,
    movementPhase,
    nextMovementTick: context.tick + (
      movementPhase === 'crawl' ? NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS : 1
    ),
    position: Object.freeze({ ...position }),
    verticalOffset,
    verticalVelocity,
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
    + program.progressPerTick * staffAttackSpeed(actor)
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
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: B,
  context: BoneyardEnemyStoreStepContext,
  radialDirection: -1 | 0 | 1,
  tangentDirection: -1 | 0 | 1 = 0,
): BoneyardEnemyActor {
  if (context.tick < actor.nextMovementTick) return actor
  if (
    skeletonFamilyMovementPausedByHit(actor)
    && nativeEnemyHitOverlay(actor.lastDamageTick, context.tick) > 0
  ) {
    return {
      ...actor,
      nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    }
  }
  const target = actor.targetPlayerId === null
    ? null
    : context.players[actor.targetPlayerId] ?? null
  const targetVelocity = target?.velocityPerTick ?? { x: 0, y: 0 }
  const targetHeadingDeg = Math.hypot(targetVelocity.x, targetVelocity.y) === 0
    ? target?.headingDeg ?? 0
    : actorHeadingFromVector(targetVelocity.x, targetVelocity.y)
  const movementScalar = Math.fround(
    actor.config.chaseSpeed
      * staffMovementSpeed(actor)
      * actor.config.scale
      * actor.path.speedFactor,
  )
  const steeringRequest = {
    actorHeadingDeg: actor.headingDeg,
    actorPosition: actor.position,
    cadenceTicks: NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    movementPerTick: 0.25 * movementScalar,
    radialDirection,
    statusFactor: work.pathStatusFactors.get(actor.id) ?? 1,
    tangentDirection,
    targetHeadingDeg,
    targetPosition: target?.position ?? null,
  } as const
  const usesTargetRoute = radialDirection === 1 && tangentDirection === 0
  let path = usesTargetRoute
    ? actor.path
    : clearNativeEnemyRoute(actor.path)
  const rawGoal = nativeEnemySteeringGoal(path, steeringRequest)
  let actorHeadingDeg = actor.headingDeg
  let goalPosition: Readonly<BoneyardPoint> = rawGoal
  if (context.navigation) {
    const navigationClearance = enemyNavigationClearance(actor)
    const routed = resolveNativeEnemyPathGoal(path, {
      actorPosition: actor.position,
      bodyRadius: actor.config.collisionRadius,
      cadenceTicks: NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
      directPathClear: (start, end) => context.navigation!.isPathClear({
        actorId: actor.id,
        bodyRadius: actor.config.collisionRadius,
        end,
        navigationClearance,
        radius: 0,
        start,
      }),
      findRoute: (start, end, clearance, bodyRadius) => (
        context.navigation!.findRoute({
          actorId: actor.id,
          bodyRadius,
          end,
          navigationClearance: clearance,
          radius: clearance,
          start,
        })
      ),
      navigationClearance,
      rawGoal,
      targetPosition: usesTargetRoute
        ? target?.position ?? null
        : null,
      targetRefreshTicks: nativeEnemyTargetRefreshTicks(actor.config.pathfindingMode),
    })
    path = routed.state
    actorHeadingDeg = routed.turnAround
      ? positiveModulo(actorHeadingDeg + 180, 360)
      : actorHeadingDeg
    goalPosition = routed.goal
  }
  const steering = buildNativeEnemySteering(path, {
    ...steeringRequest,
    actorHeadingDeg,
    goalPosition,
  })
  const delta = steering.delta
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
  const gaitPose = advanceNativeEnemyLocomotionPhase(
    actor.gaitPose,
    movementScalar,
    NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    NATIVE_BADGUY_GAIT_PHASE_DIVISOR,
    NATIVE_BADGUY_GAIT_PHASE_PERIOD,
  )
  const bodyGaitPhase = advanceNativeEnemyLocomotionPhase(
    actor.bodyGaitPhase,
    movementScalar,
    NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    NATIVE_SKELETON_BODY_GAIT_PHASE_DIVISOR,
    NATIVE_SKELETON_BODY_GAIT_PHASE_PERIOD,
  )
  const recovery = stepNativeEnemyPathRecovery(
    steering.state,
    work.steeringRngState,
    {
      flankingEnabled: actor.config.flanking,
      requestedDistance: Math.hypot(delta.x, delta.y),
      statusFactor: work.pathStatusFactors.get(actor.id) ?? 1,
      tick: context.tick,
      traveledDistance: traveled,
    },
  )
  work.steeringRngState = recovery.rngState
  return {
    ...actor,
    bodyGaitPhase,
    bodyPose: skeletonFamilyLocomotionBodyPose(actor, bodyGaitPhase),
    brain,
    gaitPose,
    headingDeg: steering.headingDeg,
    lastMovementTick: traveled === 0 ? actor.lastMovementTick : context.tick,
    nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    path: recovery.state,
    position: Object.freeze({ ...position }),
    stridePhaseDeg: advanceNativeEnemyStridePhase(
      actor.stridePhaseDeg,
      movementScalar,
      NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    ),
  }
}

function skeletonFamilyLocomotionBodyPose(
  actor: BoneyardEnemyActor,
  bodyGaitPhase: number,
): number {
  switch (actor.config.enemyToken) {
    case 'SKELETON': return actor.config.family.weapon === 'claw'
      && !actor.config.family.armor
      ? nativeSkeletonBodyGaitPose(bodyGaitPhase)
      : 0
    case 'SKELETONARCHER': return nativeSkeletonBodyGaitPose(bodyGaitPhase)
    case 'SKELETONMAGE': return actor.restBodyPose
    default: return actor.bodyPose
  }
}

function skeletonFamilyMovementPausedByHit(actor: BoneyardEnemyActor): boolean {
  return actor.config.enemyToken === 'SKELETON'
    || actor.config.enemyToken === 'SKELETONARCHER'
    || actor.config.enemyToken === 'SKELETONMAGE'
}

function withNativeSecondaryTickScalars(
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
  return effect?.timeScale ?? 1
}

function staffAttackSpeed(actor: BoneyardEnemyActor): number {
  return actor.config.attackSpeed * actor.staffActionFactor
}

function staffMovementSpeed(actor: BoneyardEnemyActor): number {
  return actor.config.baseSpeed * actor.staffMovementFactor
}

function interruptNativeSecondaryAction(
  actor: BoneyardEnemyActor,
): BoneyardEnemyActor {
  switch (actor.brain.family) {
    case 'skeleton': return resetSkeleton(actor, actor.brain)
    case 'archer': return resetArcher(actor, actor.brain)
    case 'mage': return resetMage(actor, actor.brain)
    case 'imp': return actor
    case 'zombie': return resetZombie(actor, actor.brain)
    case 'wraith': return resetWraith(actor, actor.brain)
    case 'demon': return resetDemon(actor, actor.brain)
    case 'coffin': return actor
  }
}

function positiveModulo(value: number, period: number): number {
  return ((value % period) + period) % period
}

interface NativeCellBoundActor {
  readonly nativeCellBindingOrder: number
  readonly position: Readonly<BoneyardPoint>
}

function withNativeCellRebindOrder<T extends NativeCellBoundActor>(
  work: WorkingStep,
  before: NativeCellBoundActor,
  after: T,
): T {
  if (!nativePrimaryCellChanged(before.position, after.position)) return after
  const rebound = {
    ...after,
    nativeCellBindingOrder: work.nextNativeCellBindingOrder,
  }
  work.nextNativeCellBindingOrder += 1
  return rebound
}

function nativePrimaryCellChanged(
  before: Readonly<BoneyardPoint>,
  after: Readonly<BoneyardPoint>,
): boolean {
  return nativePrimaryCellCoordinate(before.x) !== nativePrimaryCellCoordinate(after.x)
    || nativePrimaryCellCoordinate(before.y) !== nativePrimaryCellCoordinate(after.y)
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
  const path = targetPlayerId === actor.targetPlayerId
    ? actor.path
    : clearNativeEnemyRoute(actor.path)
  return {
    ...actor,
    nextTargetRefreshTick: context.tick
      + nativeEnemyTargetRefreshTicks(actor.config.pathfindingMode),
    path,
    targetPlayerId,
  }
}

function refreshMaggotTarget(
  source: BoneyardMaggotActor,
  context: BoneyardEnemyStoreStepContext,
): Readonly<Pick<BoneyardMaggotActor, 'nextTargetRefreshTick' | 'targetPlayerId'>> {
  const current = source.targetPlayerId === null
    ? undefined
    : context.players[source.targetPlayerId]
  if (current && targetEligible(current) && context.tick < source.nextTargetRefreshTick) {
    return {
      nextTargetRefreshTick: source.nextTargetRefreshTick,
      targetPlayerId: source.targetPlayerId,
    }
  }
  return {
    nextTargetRefreshTick: context.tick + nativeEnemyTargetRefreshTicks(1),
    targetPlayerId: nearestEligibleTarget(source.position, context.players),
  }
}

function reorientEnemyTowardTarget(
  source: BoneyardEnemyActor,
  players: BoneyardEnemyTargets,
): BoneyardEnemyActor {
  const target = source.targetPlayerId === null
    ? null
    : players[source.targetPlayerId] ?? null
  const reoriented = stepNativeEnemyReorientation(
    source.path,
    source.headingDeg,
    source.position,
    target?.position ?? null,
  )
  return {
    ...source,
    headingDeg: reoriented.headingDeg,
    path: reoriented.state,
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
    if (distance < selectedDistance) {
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

function trackEnemyActionHeading(
  source: BoneyardEnemyActor,
  players: BoneyardEnemyTargets,
): BoneyardEnemyActor {
  if (source.targetPlayerId === null) return source
  const target = players[source.targetPlayerId]
  if (!target || !targetEligible(target)) return source
  return {
    ...source,
    headingDeg: targetHeading(source.position, source.targetPlayerId, players),
  }
}

function enemyTargetLineOfSightIsClear(
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): boolean {
  if (actor.targetPlayerId === null) return false
  const target = context.players[actor.targetPlayerId]
  if (!target || !targetEligible(target)) return false
  return context.navigation?.isPathClear({
    actorId: actor.id,
    bodyRadius: actor.config.collisionRadius,
    end: target.position,
    navigationClearance: enemyNavigationClearance(actor),
    radius: 0,
    start: actor.position,
  }) ?? true
}

function enemyNavigationClearance(actor: BoneyardEnemyActor): number {
  return actor.config.enemyToken === 'DEMON'
    ? NATIVE_DEMON_NAVIGATION_CLEARANCE
    : NATIVE_BADGUY_NAVIGATION_CLEARANCE
}

function attackMarker(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
  targetPlayerId: string | null = actor.targetPlayerId,
): number {
  return emitEvent(work, tick, 'attack-marker', actor.id, {
    ...(actor.config.enemyToken === 'IMP'
      ? { painterRegistration: work.registerWorldPainter('transient') }
      : {}),
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
  privateSeed: number,
  context: BoneyardEnemyStoreStepContext,
): void {
  if (actor.config.enemyToken !== 'SKELETONARCHER' || actor.targetPlayerId === null) {
    return
  }
  const target = context.players[actor.targetPlayerId]
  if (!target || !targetEligible(target)) return
  const volley = buildNativeArcherVolley({
    accuracyMode: actor.config.family.accuracyMode,
    arrowType: actor.config.family.arrowType,
    extraArrows: actor.config.family.extraArrows,
    multiArrowMode: actor.config.family.multiArrowMode,
    origin: actor.position,
    privateSeed,
    targetPosition: target.position,
    targetVelocityPerTick: target.velocityPerTick,
  }, work.steeringRngState)
  work.steeringRngState = volley.sharedRngState
  emitEnemyActionSound(
    work,
    context.tick,
    actor,
    'shoot-arrow',
    volley.shotPitch,
  )
  for (const arrow of volley.arrows) {
    const poison = arrow.arrowType === 'poison'
    spawnProjectile(
      work,
      actor,
      context.tick,
      'arrow',
      actor.config.primaryDamage ?? 0,
      {
        headingDeg: arrow.headingDeg,
        lifetimeTicks: arrow.lifetimeTicks,
        minimumSpeed: arrow.speed,
        payload: projectilePayloadForArrow(arrow.arrowType),
        poisonDamage: poison ? actor.config.secondaryDamage : 0,
        poisonDuration: poison ? BOUNDED_ENEMY_POISON_DURATION_SECONDS : 0,
        position: arrow.position,
        secondaryDamage: arrow.arrowType === 'fire'
          ? actor.config.secondaryDamage
          : 0,
        speed: arrow.speed,
        visualPhaseDeg: arrow.visualHeadingDeg,
      },
    )
  }
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
    painterRegistrations: Object.freeze([
      work.registerWorldPainter('actor'),
      work.registerWorldPainter('actor'),
      ...(clearTarget ? [] : [work.registerWorldPainter('actor')]),
    ]),
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
  readonly lifetimeTicks?: number
  readonly minimumSpeed?: number
  readonly payload?: BoneyardEnemyProjectilePayload
  readonly poisonDamage?: number
  readonly poisonDuration?: number
  readonly position?: Readonly<BoneyardPoint>
  readonly secondaryDamage?: number
  readonly speed?: number
  readonly visualPhaseDeg?: number
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
  const painterManagerLane = enemyProjectileLightManagerLane(kind, payload)
  const constructedSettledTicksRemaining = kind === 'demon-bomb'
    ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombSettledCountdownMinimum
      + drawInteger(
          work,
          NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombSettledCountdownRandomCount,
        )
    : 0
  const minimumSpeed = options.minimumSpeed ?? (
    kind === 'guided-missile'
      ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.guidedMinimumSpeedBase
        + drawUnit(work) * NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.guidedMinimumSpeedRange
      : 0
  )
  const visualScale = kind === 'arrow'
    ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.arrowInitialOpacity
    : kind === 'guided-missile'
      ? 0.9 + drawUnit(work) * 0.2
      : kind === 'poison-pool'
        ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.poisonPoolInitialScale
        : 1
  const boundedSpeed = 'speed' in program ? program.speed : undefined
  const speed = options.speed ?? (
    kind === 'demon-bomb'
      ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombSpeedMinimum
        + drawUnit(work) * NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombSpeedRange
      : boundedSpeed
  )
  if (speed === undefined) throw new Error('Arrow birth requires native speed')
  const boundedLifetime = 'lifetimeTicks' in program
    ? program.lifetimeTicks
    : undefined
  const lifetimeTicks = options.lifetimeTicks ?? (
    kind === 'demon-bomb' ? constructedSettledTicksRemaining : boundedLifetime
  )
  if (lifetimeTicks === undefined) throw new Error('Arrow birth requires native lifetime')
  const headingDeg = options.headingDeg ?? actor.headingDeg
  const projectile: BoneyardEnemyProjectile = Object.freeze({
    ageTicks: 0,
    bounceVelocity: kind === 'demon-bomb'
      ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombInitialBounceVelocity
      : 0,
    chillTumbleAccumulator: 0,
    coldSlowTicks: options.coldSlowTicks ?? 0,
    contactRadius: program.contactRadius,
    damage: kind === 'poison-pool' ? 0 : damage + (options.secondaryDamage ?? 0),
    headingDeg,
    hitPlayerIds: Object.freeze([]),
    homing: program.homing,
    id: work.nextProjectileId,
    kind,
    lastStepTick: tick,
    lightRegistration: painterManagerLane === null
      ? null
      : work.registerProjectileWorldPainter(painterManagerLane),
    lifetimeTicks,
    minimumSpeed,
    nativeTypeId: projectileNativeTypeId(kind),
    nativeCellBindingOrder: work.nextNativeCellBindingOrder,
    nativeRegistrationOrder: work.nextNativeRegistrationOrder,
    ownerActorId: actor.id,
    painterRegistration: work.registerProjectileWorldPainter('actor'),
    payload,
    poisonDamage: kind === 'poison-pool' ? damage : (options.poisonDamage ?? 0),
    poisonDuration: kind === 'poison-pool'
      ? (zombie?.poisonDuration ?? 0)
      : (options.poisonDuration ?? 0),
    position: Object.freeze({ ...(options.position ?? actor.position) }),
    speed,
    settledTicksRemaining: kind === 'arrow'
      ? lifetimeTicks
      : constructedSettledTicksRemaining,
    spawnTick: tick,
    targetPlayerId: actor.targetPlayerId,
    verticalOffset: kind === 'demon-bomb'
      ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombInitialHeight
      : kind === 'arrow'
        ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.arrowInitialHeight
        : 0,
    verticalVelocity: 0,
    visualPhaseDeg: options.visualPhaseDeg ?? (kind === 'arrow' ? headingDeg : 0),
    visualScale,
  })
  work.nextNativeCellBindingOrder += 1
  work.nextNativeRegistrationOrder += 1
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
  readonly lightRegistration?: NativeWorldManagerRegistration
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
    lightRegistration: options.lightRegistration ?? null,
    lifetimeTicks: options.lifetimeTicks,
    ownerActorId: projectile.ownerActorId,
    ownerProjectileId: projectile.id,
    painterRegistration: options.lightRegistration
      ?? work.registerProjectileWorldPainter(
        kind.startsWith('fire-burst-') ? 'transient' : 'actor',
      ),
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
  scaleDomain: 'fire-arrow' | 'firebolt',
): void {
  const rotationDeg = drawUnit(work) * 360
  const angularMagnitude = 0.5 + drawUnit(work)
  const angularDirection = drawInteger(work, 2) === 0 ? -1 : 1
  const angularVelocityDeg = angularDirection * angularMagnitude
  const scaleMagnitude = drawUnit(work) * 0.1
  const scale = scaleDomain === 'fire-arrow'
    ? 0.5 + scaleMagnitude
    : 0.75 + (drawInteger(work, 2) === 0 ? -scaleMagnitude : scaleMagnitude)
  const burstPosition = Object.freeze({ x: position.x, y: position.y - 10 })
  const lightRegistration = work.registerProjectileWorldPainter('transient')
  spawnProjectileEffect(work, projectile, tick, burstPosition, 'fire-burst-glow', {
    alpha: 0.5,
    alphaLossPerTick: 0.5 / NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.fireBurstTicks,
    entry: 110,
    lightRegistration,
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
      if (projectile.payload === 'fire') {
        spawnFireBurst(work, projectile, tick, position, 'fire-arrow')
      }
      return
    case 'firebolt':
      spawnFireBurst(work, projectile, tick, position, 'firebolt')
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

function stepArrow(
  work: WorkingStep,
  source: BoneyardEnemyProjectile,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyProjectile | null {
  let projectile = source
  for (let tick = source.lastStepTick + 1; tick <= context.tick; tick += 1) {
    const radians = projectile.headingDeg * Math.PI / 180
    const direction = Object.freeze({
      x: Math.sin(radians),
      y: -Math.cos(radians),
    })
    const requestedPosition = Object.freeze({
      x: projectile.position.x + direction.x * projectile.speed,
      y: projectile.position.y + direction.y * projectile.speed,
    })
    const contact = firstProjectileContact(
      projectile.position,
      requestedPosition,
      projectile.contactRadius,
      context.players,
      new Set(projectile.hitPlayerIds),
    )
    const worldContact = context.firstProjectileWorldContact({
      end: requestedPosition,
      projectileId: projectile.id,
      radius: projectile.contactRadius,
      start: projectile.position,
    })
    if (
      worldContact !== null
      && (!Number.isFinite(worldContact) || worldContact < 0 || worldContact > 1)
    ) throw new RangeError('enemy projectile world contact must be null or within [0, 1]')

    if (worldContact !== null && (contact === null || worldContact <= contact.progress)) {
      const position = Object.freeze({
        x: projectile.position.x
          + (requestedPosition.x - projectile.position.x) * worldContact,
        y: projectile.position.y
          + (requestedPosition.y - projectile.position.y) * worldContact,
      })
      spawnProjectileImpactEffects(work, projectile, tick, position)
      emitEvent(work, tick, 'projectile-impact', projectile.ownerActorId, {
        projectileId: projectile.id,
        targetPlayerId: null,
      })
      emitEvent(work, tick, 'projectile-retired', projectile.ownerActorId, {
        projectileId: projectile.id,
        targetPlayerId: null,
      })
      return null
    }
    if (contact !== null) {
      const position = Object.freeze({
        x: projectile.position.x
          + (requestedPosition.x - projectile.position.x) * contact.progress,
        y: projectile.position.y
          + (requestedPosition.y - projectile.position.y) * contact.progress,
      })
      spawnProjectileImpactEffects(work, projectile, tick, position)
      const eventId = emitEvent(work, tick, 'projectile-impact', projectile.ownerActorId, {
        projectileId: projectile.id,
        targetPlayerId: contact.playerId,
      })
      work.playerDamage.push(Object.freeze({
        actorId: projectile.ownerActorId,
        amount: projectile.damage,
        coldSlowTicks: projectile.coldSlowTicks,
        dazzleTicks: 0,
        deflectable: true,
        damageKind: 'physical',
        eventId,
        playerId: contact.playerId,
        poisonDamage: projectile.poisonDamage,
        poisonDuration: projectile.poisonDuration,
      }))
      emitEvent(work, tick, 'projectile-retired', projectile.ownerActorId, {
        projectileId: projectile.id,
        targetPlayerId: contact.playerId,
      })
      return null
    }

    const ageTicks = projectile.ageTicks + 1
    let speed = projectile.speed
    const settledTicksRemaining = Math.max(0, projectile.settledTicksRemaining - 1)
    let verticalOffset = projectile.verticalOffset
    let visualPhaseDeg = projectile.visualPhaseDeg
    let visualScale = projectile.visualScale
    if (verticalOffset >= NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.arrowAirborneHeightBoundary) {
      speed = 0
      verticalOffset = 0
      visualScale = Math.fround(
        visualScale - NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.arrowOpacityLossPerTick,
      )
    } else {
      verticalOffset = Math.fround(
        verticalOffset + NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.arrowHeightPerTick,
      )
      speed = Math.fround(
        speed * NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.arrowPlanarDampingPerTick,
      )
      if (settledTicksRemaining === 0) {
        visualPhaseDeg = projectile.headingDeg
      } else {
        const launchSpeed = projectile.minimumSpeed
        const verticalTerm = (
          NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.arrowInitialHeight / verticalOffset
        ) * launchSpeed * NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.arrowPitchFactor
        visualPhaseDeg = Math.fround(actorHeadingFromVector(
          direction.x * launchSpeed,
          direction.y * launchSpeed + verticalTerm,
        ))
      }
    }
    projectile = Object.freeze({
      ...projectile,
      ageTicks,
      lastStepTick: tick,
      position: requestedPosition,
      settledTicksRemaining,
      speed,
      verticalOffset,
      visualPhaseDeg,
      visualScale,
    })
    if (visualScale > 0) continue
    emitEvent(work, tick, 'projectile-retired', projectile.ownerActorId, {
      projectileId: projectile.id,
      targetPlayerId: projectile.targetPlayerId,
    })
    return null
  }
  return projectile
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
    if (source.kind === 'arrow') {
      const projectile = stepArrow(work, source, context)
      if (projectile) retained.push(projectile)
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
        damageKind: 'magic',
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
  stored: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor | null {
  const tick = context.tick
  let source = stored
  if (source.config.enemyToken === 'DEMON') {
    const deathStartedTick = source.deathStartedTick ?? tick
    const deathTick = Math.max(0, tick - deathStartedTick)
    if (!source.deathPresentationStarted) {
      spawnDemonDeathFires(work, source, deathStartedTick)
      source = { ...source, deathPresentationStarted: true }
    }
    if (source.deathTick < 95 && deathTick >= 95) {
      emitEnemyDeathSound(work, tick, source, 'flash', 1)
      emitEnemyDeathSound(work, tick, source, 'demon-die', 1)
      spawnDemonDeathFireBurst(work, source, tick)
    }
    source = { ...source, deathTick }
    if (deathTick < 100) return source
  }
  emitEvent(work, tick, 'enemy-death', source.id)
  const output = terminalOutput(source.config.enemyToken)
  const outputCount = terminalOutputCount(work, source)
  emitEvent(work, tick, 'enemy-terminal-output', source.id, {
    count: outputCount,
    output,
  })
  context.retirementObserver?.onTerminalOutput(output, outputCount)
  emitEnemyDeathSounds(work, source, tick, outputCount)
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
  spawnEnemyDeathEffects(work, source, tick, outputCount)
  spawnTerminalChildren(work, source, context)
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
      onDeathProgram: source.config.onDeathProgram,
      ...(source.config.recipeUid === null ? {} : {
        policies: source.config.lootPolicies,
        recipeUid: source.config.recipeUid,
      }),
      participantSlot: 0 as const,
      position: Object.freeze({ ...source.position }),
    }),
    playerId: source.lastDamagedByPlayerId,
  }))
  const eventId = emitEvent(work, tick, 'enemy-retired', source.id)
  work.retired.push(Object.freeze({ actorId: source.id, eventId }))
  return null
}

function spawnEnemyDeathEffects(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
  outputCount: number | undefined,
): void {
  switch (actor.config.enemyToken) {
    case 'SKELETON':
    case 'SKELETONARCHER':
    case 'SKELETONMAGE':
      spawnSkeletonShatter(work, actor, tick)
      return
    case 'IMP':
      spawnUnbind(work, actor, tick)
      {
        const scale = outputCount === NATIVE_IMP_SPLIT_CHILD_COUNT ? 0.25 : 1
        spawnSimpleDeathEffect(work, actor, tick, {
          alpha: 1,
          alphaLossPerTick: 0.02 / scale,
          atlas: 'BadGuys',
          blendMode: 'add',
          entry: 15,
          kind: 'banish',
          lifetimeTicks: Math.ceil(2 / (0.02 / scale)),
          opacityTimer: 2,
          role: 'imp-banish',
          scale,
        })
        spawnSpriteArray(work, actor, tick, 'imp-sprite-array', 401, 19, 1, {
          frameVelocity: 0.5 / scale,
          frameVelocityDamping: 0.98,
          presentationOwner: 'pre-world-queue',
          scale: 2 * scale,
        })
      }
      return
    case 'ZOMBIE':
      spawnZombieTerminalEffects(work, actor, tick)
      return
    case 'WRAITH':
      spawnWraithTerminalEffects(work, actor, tick)
      return
    case 'DEMON':
      spawnSimpleDeathEffect(work, actor, tick, {
        alpha: 1,
        alphaLossPerTick: 0.01,
        atlas: 'BadGuys',
        blendMode: 'add',
        entry: 15,
        kind: 'banish',
        lifetimeTicks: 200,
        opacityTimer: 2,
        role: 'demon-banish',
        scale: 2,
      })
      spawnSpriteArray(work, actor, tick, 'demon-sprite-array', 401, 19, 1, {
        frameVelocity: 0.25,
        frameVelocityDamping: 0.995,
        presentationOwner: 'pre-world-queue',
        scale: 4,
      })
      return
    case 'COFFIN': {
      spawnCoffinTerminalEffects(work, actor, tick)
    }
  }
}

const ZOMBIE_BASE_FRAGMENT_ENTRIES = Object.freeze([
  2094, 2089, 2092, 2090, 2091,
] as const)
const ZOMBIE_ENHANCED_FRAGMENT_ENTRIES = Object.freeze([
  2090, 2091, 2090, 2091, 2094,
] as const)
const ZOMBIE_FLYBLOWN_FRAGMENT_ENTRIES = Object.freeze([
  2090, 2091, 2090, 2091, 2094,
  2090, 2091, 2090, 2091, 2094,
] as const)

function spawnZombieTerminalEffects(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
): void {
  if (actor.config.enemyToken !== 'ZOMBIE') {
    throw new Error('Zombie terminal effects require a Zombie actor')
  }
  if (actor.config.family.rotten) {
    const splatCount = 6 + drawInteger(work, 5)
    for (let index = 0; index < splatCount; index += 1) {
      spawnZombieLateSplat(work, actor, tick, index)
    }
  }

  const entries = [
    ...ZOMBIE_BASE_FRAGMENT_ENTRIES,
    ...ZOMBIE_ENHANCED_FRAGMENT_ENTRIES,
    ...(actor.config.family.rotten ? ZOMBIE_FLYBLOWN_FRAGMENT_ENTRIES : []),
    2093,
    2093,
  ]
  for (let index = entries.length - 1; index > 0; index -= 1) {
    const swap = drawInteger(work, index + 1)
    ;[entries[index], entries[swap]] = [entries[swap]!, entries[index]!]
  }
  let angleDeg = drawUnit(work) * 360
  const flyblownScale = actor.config.family.rotten ? 2 : 1
  for (const entry of entries) {
    spawnBouncer(work, actor, tick, entry, 'zombie-fragment', () => {
      const direction = radialVector(angleDeg, 1)
      const velocity = {
        x: direction.x * 1.5 * 0.75 * flyblownScale,
        y: direction.y * 0.75 * flyblownScale,
      }
      const distance = 5 + drawUnit(work) * 10
      return {
        position: {
          x: actor.position.x + velocity.x * (distance + 2),
          y: actor.position.y + velocity.y * distance,
        },
        velocity,
      }
    })
    angleDeg += 72 + (drawUnit(work) * 20 - 10)
  }

  spawnBouncer(
    work,
    actor,
    tick,
    () => 2365 + drawInteger(work, 144),
    'zombie-gait-fragment',
    {
      bounceRetention: 0.5,
      velocity: radialVector(angleDeg, 2),
    },
  )
  spawnUnbind(work, actor, tick)
  const opacityTimer = 10
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha: 0.6,
    alphaLossPerTick: 0.01,
    alphaMultiplier: 0.6,
    atlas: 'DeadHawg',
    blendMode: 'normal',
    entry: 30,
    kind: 'fade-perspective-clipped',
    lifetimeTicks: 1_000,
    opacityTimer,
    role: 'zombie-clipped-fade',
    rotationDeg: drawUnit(work) * 360,
    scale: (1 + drawUnit(work) * 0.25) * 1.5,
  })
}

function spawnZombieLateSplat(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
  index: number,
): void {
  const delayTicks = 25 + drawInteger(work, 76)
  const opacityTimer = 3 + drawUnit(work) * 3
  const rotationDeg = drawUnit(work) * 360
  const scale = 0.75 + drawUnit(work) * 0.75
  const distance = 75 + drawUnit(work) * 75
  const offset = radialVector(drawUnit(work) * 360, distance)
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha: Math.min(1, opacityTimer * 0.25),
    alphaLossPerTick: 0.01,
    atlas: 'DeadHawg',
    blendMode: 'normal',
    entry: 31,
    kind: 'late-splat',
    lifetimeTicks: Math.ceil(opacityTimer / 0.01),
    opacityTimer,
    position: {
      x: actor.position.x + offset.x,
      y: actor.position.y + offset.y,
    },
    presentationOwner: 'pre-world-queue',
    role: `zombie-late-splat:${index}`,
    rotationDeg,
    scale,
    spawnDelayTicks: delayTicks,
  })
}

function spawnWraithTerminalEffects(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
): void {
  spawnWraithDissolve(work, actor, tick)

  const entries = [...SKELETON_BASE_FRAGMENT_ENTRIES]
  for (let index = entries.length - 1; index > 0; index -= 1) {
    const swap = drawInteger(work, index + 1)
    ;[entries[index], entries[swap]] = [entries[swap]!, entries[index]!]
  }
  let angleDeg = actor.headingDeg
  for (const entry of entries) {
    spawnBouncer(work, actor, tick, entry, 'wraith-smoky-fragment', () => {
      const direction = radialVector(angleDeg + signedUnit(drawUnit(work)) * 45, 1)
      const velocity = { x: direction.x * 1.5, y: direction.y }
      const distance = 15 + drawUnit(work) * 30
      return {
        kind: 'smoky-bouncer',
        position: {
          x: actor.position.x + velocity.x * (distance + 2),
          y: actor.position.y + velocity.y * distance,
        },
        velocity,
      }
    })
    angleDeg += 72 + signedUnit(drawUnit(work)) * 10
  }

  spawnBouncer(
    work,
    actor,
    tick,
    () => 1819 + drawInteger(work, 4),
    'wraith-skull',
    () => ({
      bounceRetention: 0.7,
      height: -(10 + drawUnit(work) * 10),
      kind: 'smoky-bouncer',
      velocity: radialVector(
        actor.headingDeg + signedUnit(drawUnit(work)) * 10,
        5,
      ),
    }),
  )
  spawnUnbind(work, actor, tick)
}

function spawnWraithDissolve(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
): void {
  let angleDeg = drawUnit(work) * 360
  for (let index = 0; index < 12; index += 1) {
    const entry = drawInteger(work, 2) === 0 ? 11 : 10
    const speed = 2 + drawUnit(work) * 2
    const velocity = radialVector(
      angleDeg + signedUnit(drawUnit(work)) * 10,
      speed,
    )
    spawnSimpleDeathEffect(work, actor, tick, {
      alpha: 1,
      alphaLossPerTick: 0.025,
      atlas: 'BadGuys',
      blendMode: 'normal',
      entry,
      kind: 'move-fade',
      lifetimeTicks: 40,
      position: {
        x: actor.position.x + velocity.x * 10,
        y: actor.position.y + velocity.y * 10,
      },
      role: `wraith-dissolve-ray:${index}`,
      rotationDeg: angleDeg,
      scale: 1.5 + drawUnit(work) * 0.5,
      velocity,
      velocityDamping: 0.8,
    })
    angleDeg += 30
  }
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha: 1,
    alphaLossPerTick: 0.1,
    atlas: 'BadGuys',
    blendMode: 'add',
    entry: 20,
    kind: 'fade-scale',
    lifetimeTicks: 20,
    opacityTimer: 2,
    position: { x: actor.position.x + 1, y: actor.position.y - 15 },
    role: 'wraith-dissolve-core',
    scale: 1,
    scaleMultiplier: 1.02,
  })
  for (let index = 0; index < 12; index += 1) {
    spawnBouncer(work, actor, tick, 27, `wraith-dissolve-bouncer:${index}`, () => {
      const direction = radialVector(angleDeg, 1)
      const velocity = { x: direction.x * 1.5, y: direction.y }
      const distance = 15 + drawUnit(work) * 10
      return {
        opacityTimer: 1.5,
        position: {
          x: actor.position.x + velocity.x * (distance + 2),
          y: actor.position.y + velocity.y * distance,
        },
        velocity,
      }
    })
    angleDeg += 30 + signedUnit(drawUnit(work)) * 10
  }
}

function spawnCoffinTerminalEffects(
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
    spawnBouncer(work, actor, tick, entry, 'coffin-bone', () => {
      const direction = radialVector(angleDeg, 1)
      const velocity = { x: direction.x * 1.5, y: direction.y }
      const distance = 15 + drawUnit(work) * 10
      return {
        position: {
          x: actor.position.x + velocity.x * (distance + 2),
          y: actor.position.y + velocity.y * distance,
        },
        velocity,
      }
    })
    angleDeg += 72 + signedUnit(drawUnit(work)) * 10
  }

  const mainCount = 40 + drawInteger(work, 11)
  for (let index = 0; index < mainCount; index += 1) {
    spawnBouncer(
      work,
      actor,
      tick,
      () => 2013 + drawInteger(work, 50),
      `coffin-main-fragment:${index}`,
      () => {
        const speed = 0.5 + drawUnit(work) * 0.5
        const direction = radialVector(angleDeg, speed)
        const velocity = { x: direction.x * 1.5, y: direction.y }
        const distance = 15 + drawUnit(work) * 10
        return {
          bounceVelocityScale: 2,
          position: {
            x: actor.position.x + velocity.x * (distance + 2),
            y: actor.position.y + velocity.y * distance,
          },
          velocity,
        }
      },
    )
    angleDeg += 72 + signedUnit(drawUnit(work)) * 10
  }

  const extraCount = 12 + drawInteger(work, 4)
  for (let index = 0; index < extraCount; index += 1) {
    let fragment: typeof COFFIN_EXTRA_FRAGMENT_RECORDS[number]
    spawnBouncer(
      work,
      actor,
      tick,
      () => {
        fragment = COFFIN_EXTRA_FRAGMENT_RECORDS[
          drawInteger(work, COFFIN_EXTRA_FRAGMENT_RECORDS.length)
        ]!
        return fragment.entry
      },
      `coffin-extra-fragment:${index}`,
      () => {
        const speed = 1 + drawUnit(work)
        const direction = radialVector(angleDeg, speed)
        const velocity = { x: direction.x * 1.5, y: direction.y }
        const distance = 15 + drawUnit(work) * 10
        return {
          atlas: fragment.atlas,
          bounceVelocityScale: 2,
          position: {
            x: actor.position.x + velocity.x * (distance + 2),
            y: actor.position.y + velocity.y * distance,
          },
          velocity,
        }
      },
    )
    angleDeg += 72 + signedUnit(drawUnit(work)) * 10
  }

  spawnBouncer(
    work,
    actor,
    tick,
    () => 1819 + drawInteger(work, 4),
    'coffin-skull',
    { velocity: radialVector(angleDeg, 2) },
  )
  spawnUnbind(work, actor, tick)
}

function spawnDemonDeathFires(
  work: WorkingStep,
  actor: DeathEffectOwner,
  deathStartedTick: number,
): void {
  for (const delay of [0, 20, 40, 60, 80]) {
    const phase = drawInteger(work, 32)
    const displacement = randomRadialDisplacement(work, (100 - delay) / 20)
    spawnSpriteArray(
      work,
      actor,
      deathStartedTick,
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
}

function spawnDemonDeathFireBurst(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
): void {
  const rotationDeg = drawUnit(work) * 360
  const angularMagnitude = 0.5 + drawUnit(work)
  const angularVelocityDeg = (drawInteger(work, 2) === 0 ? -1 : 1)
    * angularMagnitude
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha: 0.5,
    alphaLossPerTick: 0.5 * NATIVE_DEMON_RAW_FIRE_BURST_PHASE_PER_TICK / 4,
    atlas: 'BadGuys',
    blendMode: 'normal',
    entry: 110,
    kind: 'fade',
    lifetimeTicks: NATIVE_DEMON_RAW_FIRE_BURST_TICKS,
    position: { x: actor.position.x, y: actor.position.y - 20 },
    presentationOwner: 'direct-post-world',
    role: 'demon-death-fire-burst-glow',
    scale: 10,
    tint: 0xff8000,
    velocity: { x: 0, y: -1 },
  })
  spawnSpriteArray(
    work,
    actor,
    tick,
    'demon-death-fire-burst-frame',
    251,
    4,
    1 / NATIVE_DEMON_RAW_FIRE_BURST_PHASE_PER_TICK,
    {
      angularVelocityDeg,
      blendMode: 'add',
      lifetimeTicks: NATIVE_DEMON_RAW_FIRE_BURST_TICKS,
      position: { x: actor.position.x, y: actor.position.y - 20 },
      presentationOwner: 'direct-post-world',
      rotationDeg,
      scale: 2,
      tint: 0xffffbf,
      velocity: { x: 0, y: -1 },
    },
  )
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

function emitEnemyActionSound(
  work: WorkingStep,
  tick: number,
  actor: DeathEffectOwner,
  sound: BoneyardEnemyActionSound,
  pitch: number,
): void {
  emitEvent(work, tick, 'enemy-action-sound', actor.id, {
    gainScale: 1,
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
    () => 1819 + drawInteger(work, 4),
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
        () => firstEntry + drawInteger(work, 2),
        'skeleton-headgear-fragment',
        () => drawUnit(work) * 360,
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
      () => drawUnit(work) * 360,
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
        () => drawUnit(work) * 360,
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
      () => firstEntry + drawInteger(work, 2),
      'skeleton-armor-fragment',
      () => drawUnit(work) * 360,
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
  entry: number | (() => number),
  role: string,
  angleDeg: number | (() => number),
  scale = 1,
  opacityTimer = 10,
): void {
  spawnBouncer(work, actor, tick, entry, role, () => {
    const velocity = radialVector(
      typeof angleDeg === 'function' ? angleDeg() : angleDeg,
      1,
    )
    velocity.x *= 1.5
    const distance = 15 + drawInteger(work, 11)
    return {
      opacityTimer,
      position: {
        x: actor.position.x + velocity.x * (distance + 2),
        y: actor.position.y + velocity.y * distance,
      },
      scale,
      velocity,
    }
  })
}

function spawnRadialBouncer(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
  entry: number | (() => number),
  role: string,
  speed = 1,
  atlas: BoneyardEnemyDeathEffect['atlas'] = 'BadGuys',
): void {
  spawnBouncer(work, actor, tick, entry, role, () => ({
    atlas,
    velocity: radialVector(drawUnit(work) * 360, speed),
  }))
}

type BouncerOptions = {
  atlas?: BoneyardEnemyDeathEffect['atlas']
  bounceRetention?: number
  bounceVelocityScale?: number
  kind?: 'bouncer' | 'smoky-bouncer'
  opacityTimer?: number
  position?: Readonly<BoneyardPoint>
  height?: number
  scale?: number
  velocity?: Readonly<BoneyardPoint>
}

function spawnBouncer(
  work: WorkingStep,
  actor: DeathEffectOwner,
  tick: number,
  entry: number | (() => number),
  role: string,
  options: BouncerOptions | (() => BouncerOptions) = {},
): void {
  const constructorVerticalVelocity = -(drawUnit(work) * 3 + 2)
  const constructorHeight = -drawUnit(work) * 20
  const rotationDeg = drawUnit(work) * 360
  const angularVelocityDeg = drawUnit(work) * 10 + 1
  const resolvedEntry = typeof entry === 'function' ? entry() : entry
  const resolvedOptions = typeof options === 'function' ? options() : options
  const verticalVelocity = constructorVerticalVelocity
    * (resolvedOptions.bounceVelocityScale ?? 1)
  const opacityTimer = resolvedOptions.opacityTimer ?? 10
  const effect: BoneyardEnemyDeathEffect = Object.freeze({
    ageTicks: 0,
    alpha: 1,
    alphaMultiplier: 1,
    alphaLossPerTick: 0.015,
    angularVelocityDeg,
    atlas: resolvedOptions.atlas ?? 'BadGuys',
    blendMode: 'normal',
    bounceRetention: resolvedOptions.bounceRetention ?? 0.65,
    bounceVelocity: verticalVelocity,
    entry: resolvedEntry,
    firstEntry: resolvedEntry,
    frameCount: 1,
    framePhase: 0,
    frameVelocity: 0,
    frameVelocityDamping: 1,
    frameTicks: 1,
    height: resolvedOptions.height ?? constructorHeight,
    id: work.nextDeathEffectId,
    kind: resolvedOptions.kind ?? 'bouncer',
    lastStepTick: tick,
    lifetimeTicks: 1_000,
    opacityTimer,
    ownerActorId: actor.id,
    painterRegistration: work.registerWorldPainter('actor'),
    presentationOwner: 'world-sorted',
    position: Object.freeze({ ...(resolvedOptions.position ?? actor.position) }),
    role,
    rotationDeg,
    scale: resolvedOptions.scale ?? 1,
    scaleMultiplier: 1,
    shadow: true,
    spawnTick: tick,
    tint: 0xffffff,
    verticalVelocity,
    velocity: Object.freeze({ ...(resolvedOptions.velocity ?? { x: 0, y: 0 }) }),
    velocityDamping: 1,
  })
  work.nextDeathEffectId += 1
  const stepped = stepBornBoneyardBouncer(
    effect,
    tick,
    () => drawUnit(work),
    work.nextDeathEffectId,
    work.registerWorldPainter,
  )
  work.nextDeathEffectId = stepped.nextDeathEffectId
  work.deathEffects.push(...stepped.effects)
}

function spawnUnbind(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  tick: number,
): void {
  const { alpha, alphaLossPerTick } = primaryOnlyUnbindClock(actor.config.enemyToken)
  const rotationDeg = drawUnit(work) * 360
  const angularOffsetDeg = drawUnit(work) * 2.5
  const clockwise = drawUnit(work) >= 0.5
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha,
    alphaLossPerTick,
    angularVelocityDeg: clockwise
      ? 5 + angularOffsetDeg
      : -5 + angularOffsetDeg,
    atlas: 'BadGuys',
    blendMode: 'normal',
    entry: 86,
    kind: 'unbind',
    lifetimeTicks: Math.ceil(alpha / alphaLossPerTick),
    position: { x: actor.position.x + 1, y: actor.position.y - 15 },
    presentationOwner: 'direct-post-world',
    role: 'death-unbind-star',
    rotationDeg,
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
    angularVelocityDeg?: number
    atlas?: BoneyardEnemyDeathEffect['atlas']
    blendMode?: BoneyardEnemyDeathEffect['blendMode']
    frameVelocity?: number
    frameVelocityDamping?: number
    kind?: 'fire-array' | 'sprite-array'
    lifetimeTicks?: number
    position?: Readonly<BoneyardPoint>
    presentationOwner?: BoneyardEnemyDeathEffect['presentationOwner']
    rotationDeg?: number
    scale?: number
    spawnDelayTicks?: number
    tint?: number
    velocity?: Readonly<BoneyardPoint>
  }> = {},
): void {
  spawnSimpleDeathEffect(work, actor, tick, {
    alpha: 1,
    alphaLossPerTick: options.alphaLossPerTick ?? 0,
    angularVelocityDeg: options.angularVelocityDeg ?? 0,
    atlas: options.atlas ?? 'BadGuys',
    blendMode: options.blendMode ?? 'add',
    entry: firstEntry,
    firstEntry,
    frameCount,
    frameVelocity: options.frameVelocity ?? 1 / frameTicks,
    frameVelocityDamping: options.frameVelocityDamping ?? 1,
    frameTicks,
    kind: options.kind ?? 'sprite-array',
    lifetimeTicks: options.lifetimeTicks
      ?? (options.kind === 'fire-array'
        ? NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS.demonBombFireTicks
        : 1_000),
    position: options.position,
    presentationOwner: options.presentationOwner,
    role,
    rotationDeg: options.rotationDeg ?? 0,
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
    alphaMultiplier?: number
    alphaLossPerTick: number
    angularVelocityDeg?: number
    atlas: BoneyardEnemyDeathEffect['atlas']
    blendMode: BoneyardEnemyDeathEffect['blendMode']
    entry: number
    firstEntry?: number
    frameCount?: number
    framePhase?: number
    frameVelocity?: number
    frameVelocityDamping?: number
    frameTicks?: number
    kind: Exclude<BoneyardEnemyDeathEffectKind, 'bouncer' | 'smoky-bouncer'>
    lifetimeTicks: number
    opacityTimer?: number
    position?: Readonly<BoneyardPoint>
    presentationOwner?: BoneyardEnemyDeathEffect['presentationOwner']
    role: string
    rotationDeg?: number
    scale: number
    scaleMultiplier?: number
    spawnDelayTicks?: number
    tint?: number
    velocity?: Readonly<BoneyardPoint>
    velocityDamping?: number
  },
): void {
  const presentationOwner = options.presentationOwner ?? 'world-sorted'
  work.deathEffects.push(Object.freeze({
    ageTicks: 0,
    alpha: options.alpha,
    alphaMultiplier: options.alphaMultiplier ?? 1,
    alphaLossPerTick: options.alphaLossPerTick,
    angularVelocityDeg: options.angularVelocityDeg ?? 0,
    atlas: options.atlas,
    blendMode: options.blendMode,
    bounceRetention: 0,
    bounceVelocity: 0,
    entry: options.entry,
    firstEntry: options.firstEntry ?? options.entry,
    frameCount: options.frameCount ?? 1,
    framePhase: options.framePhase ?? 0,
    frameVelocity: options.frameVelocity ?? 0,
    frameVelocityDamping: options.frameVelocityDamping ?? 1,
    frameTicks: options.frameTicks ?? 1,
    height: 0,
    id: work.nextDeathEffectId,
    kind: options.kind,
    lastStepTick: tick,
    lifetimeTicks: options.lifetimeTicks,
    opacityTimer: options.opacityTimer ?? options.alpha,
    ownerActorId: actor.id,
    painterRegistration: presentationOwner === 'world-sorted'
      ? work.registerWorldPainter('actor')
      : null,
    presentationOwner,
    position: Object.freeze({ ...(options.position ?? actor.position) }),
    role: options.role,
    rotationDeg: options.rotationDeg ?? 0,
    scale: options.scale,
    scaleMultiplier: options.scaleMultiplier ?? 1,
    shadow: false,
    spawnTick: tick + (options.spawnDelayTicks ?? 0),
    tint: options.tint ?? 0xffffff,
    verticalVelocity: 0,
    velocity: Object.freeze({ ...(options.velocity ?? { x: 0, y: 0 }) }),
    velocityDamping: options.velocityDamping ?? 1,
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

function randomIntegerFromUnit(random: () => number, count: number): number {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new RangeError('random integer count must be a positive safe integer')
  }
  return Math.min(count - 1, Math.floor(random() * count))
}

function drawLocomotionPhase(work: WorkingStep): number {
  const draw = drawNativeFloat(work.locomotionRngState, 4)
  work.locomotionRngState = draw.state
  return draw.value
}

function drawLocomotionStridePhase(work: WorkingStep): number {
  const draw = drawNativeFloat(work.locomotionRngState, 360)
  work.locomotionRngState = draw.state
  return draw.value
}

function drawLocomotionInteger(work: WorkingStep, count: number): number {
  const draw = drawNativeInteger(work.locomotionRngState, count)
  work.locomotionRngState = draw.state
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
  work.events.push(Object.freeze({
    actorId,
    eventId,
    tick,
    type,
    ...patch,
  }))
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

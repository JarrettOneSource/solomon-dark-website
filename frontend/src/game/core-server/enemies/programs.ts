import { NATIVE_ARROW_ENHANCED_OPACITY } from '../../core-kernels/native-enemy-targeting.ts'
import { NATIVE_POISON_POOL_LIFETIME_TICKS } from '../../core-kernels/native-poison-pool.ts'

export const NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS = 2

export const NATIVE_ENEMY_HIT_LATCH_TICKS = 20

export const NATIVE_IMP_SPLIT_HEADING_OFFSETS = Object.freeze([-90, 90] as const)

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

/** Mod_Knockback magnitude is runtime-authored and remains open in the retail binary. */
export const BOUNDED_ZOMBIE_KNOCKBACK_DISTANCE = 10

/** Named center-distance bounds; native family attack reach remains unresolved. */
export const BOUNDED_ENEMY_ATTACK_REACH = Object.freeze({
  COFFIN: 0,
  DEMON: 180,
  PORTAL: 0,
  SKELETON: 36,
  SKELETONARCHER: 240,
  SKELETONMAGE: 220,
  ZOMBIE: 48,
})

/**
 * Contact geometry and the non-Arrow travel programs remain named web bounds.
 * Archer supplies every Arrow speed and orientation countdown from its exact
 * native birth draw; Arrow retirement is owned by its separate opacity lane.
 */
export const BOUNDED_ENEMY_PROJECTILE_PROGRAMS = Object.freeze({
  arrow: Object.freeze({ contactRadius: 20, homing: false }),
  'demon-bomb': Object.freeze({ contactRadius: 35, homing: false, lifetimeTicks: 100, speed: 2 }),
  firebolt: Object.freeze({ contactRadius: 30, homing: false, lifetimeTicks: 400, speed: 4 }),
  'guided-missile': Object.freeze({ contactRadius: 2, homing: true, lifetimeTicks: 1300, speed: 3 }),
  'poison-pool': Object.freeze({ contactRadius: 70, homing: false, lifetimeTicks: NATIVE_POISON_POOL_LIFETIME_TICKS, speed: 0 }),
})

export const NATIVE_ENEMY_PROJECTILE_VFX_PROGRAMS = Object.freeze({
  arrowAirborneHeightBoundary: -3,
  arrowHeightPerTick: 0.75,
  arrowInitialHeight: -25,
  arrowInitialOpacity: NATIVE_ARROW_ENHANCED_OPACITY,
  arrowOpacityLossPerTick: 0.05000000074505806,
  arrowPlanarDampingPerTick: 0.9900000095367432,
  arrowPitchFactor: 0.25,
  demonBombBounceMultiplier: 0.8500000238418579,
  demonBombDampingPerTick: 0.9950000047683716,
  demonBombFireTicks: 500,
  demonBombGravityPerTick: 0.10000000149011612,
  demonBombInitialBounceVelocity: -3,
  demonBombInitialHeight: -35,
  demonBombSettledCountdownMinimum: 100,
  demonBombSettledCountdownRandomCount: 101,
  demonBombSettledDampingPerTick: 0.9800000190734863,
  demonBombSpeedMinimum: 2,
  demonBombSpeedRange: 1,
  fireBurstTicks: 16,
  fireboltTrailCadenceTicks: 2,
  guidedImpactAlphaLossPerTick: 0.1,
  guidedMinimumSpeedBase: 0.75,
  guidedMinimumSpeedRange: 0.44999998807907104,
  guidedSpeedLossPerTick: 0.07500000298023224,
  poisonPoolInitialScale: 1,
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

export const NATIVE_COFFIN_HIDDEN_SHORT_TICKS = 180

export const NATIVE_COFFIN_HIDDEN_LONG_TICKS = 360

export const NATIVE_COFFIN_RISE_TICKS = 11

export const NATIVE_COFFIN_HOLD_MINIMUM_TICKS = 150

export const NATIVE_COFFIN_HOLD_RANDOM_COUNT = 150

export const NATIVE_COFFIN_OPEN_TICKS = 46

export const NATIVE_COFFIN_MAGGOT_CHARGE_PER_TICK = Math.fround(0.025)

export const NATIVE_COFFIN_MAGGOT_CHARGE_MAXIMUM = 10

export const NATIVE_ENEMY_BURN_GLOW_PER_TICK = 0.05

export const NATIVE_ENEMY_CHARGE_PER_TICK = 0.02

export const NATIVE_IMP_GLOW_PER_TICK = 0.01

import { actorHeadingFromVector } from './actor-heading.ts'
import type { BoneyardArrowType } from './boneyard-enemy-config.ts'
import type { Vector2 } from './vector.ts'

export interface BoundedEnemyRangeBand {
  readonly maximum: number
  readonly minimum: number
}

/**
 * The native config modes are recovered, while their closed distance formula is
 * still open. These named web bands keep every mode distinct and bounded.
 */
export const BOUNDED_ARCHER_RANGE_BANDS: Readonly<Record<0 | 1 | 2 | 3, BoundedEnemyRangeBand>> =
  Object.freeze({
    0: Object.freeze({ maximum: 240, minimum: 120 }),
    1: Object.freeze({ maximum: 180, minimum: 80 }),
    2: Object.freeze({ maximum: 320, minimum: 180 }),
    3: Object.freeze({ maximum: 320, minimum: 100 }),
  })

/** Named web bands for the recovered Mage range-mode lane. */
export const BOUNDED_MAGE_RANGE_BANDS: Readonly<Record<0 | 1 | 2 | 3, BoundedEnemyRangeBand>> =
  Object.freeze({
    0: Object.freeze({ maximum: 220, minimum: 100 }),
    1: Object.freeze({ maximum: 165, minimum: 70 }),
    2: Object.freeze({ maximum: 300, minimum: 150 }),
    3: Object.freeze({ maximum: 300, minimum: 80 }),
  })

/** Retail does not populate extraArrows; custom configs remain explicitly bounded. */
export const BOUNDED_ARCHER_MAXIMUM_EXTRA_ARROWS = 8
/** Native scatter/random angular distributions remain open. */
export const BOUNDED_ARCHER_SCATTER_HALF_ANGLE_DEG = 12
export const BOUNDED_ARCHER_RANDOM_HALF_ANGLE_DEG = 25
export const BOUNDED_ARCHER_EXTRA_ARROW_STEP_DEG = 4
/** Prevents leading aim from projecting arbitrarily far into the future. */
export const BOUNDED_ARCHER_LEADING_MAXIMUM_TICKS = 60

/** Exact status clocks remain open; the native payload/effect ownership is recovered. */
export const BOUNDED_ENEMY_COLD_SLOW_TICKS = 300
export const BOUNDED_ENEMY_COLD_MOVEMENT_SCALE = 0.5
/** Wraith writes Mod_Dazzle duration +0x14 = 0x32 at 0x00486C30. */
export const NATIVE_WRAITH_DAZZLE_TICKS = 50
export const BOUNDED_ENEMY_POISON_DURATION_SECONDS = 3

/** Native shield interval units remain open; config values are converted here. */
export const BOUNDED_MAGE_SHIELD_INTERVAL_TICKS_PER_CONFIG_UNIT = 100
export const BOUNDED_MAGE_ALLY_SHIELD_RANGE = 240

/** Exact lightning persistence is open; recovered fork records remain actor-coupled. */
export const BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS = 4

/**
 * Mod_Dazzle tick 0x00623490 multiplies actor +0x120 by progress after
 * advancing progress by 1/duration. The first affected movement tick is 1/50.
 */
export function nativeDazzleMovementScale(ticksRemaining: number): number {
  if (!Number.isSafeInteger(ticksRemaining) || ticksRemaining < 0) {
    throw new RangeError('Dazzle remaining ticks must be a non-negative safe integer')
  }
  if (ticksRemaining === 0) return 1
  return Math.min(1, Math.max(
    1 / NATIVE_WRAITH_DAZZLE_TICKS,
    (NATIVE_WRAITH_DAZZLE_TICKS - ticksRemaining + 1) / NATIVE_WRAITH_DAZZLE_TICKS,
  ))
}

export type BoneyardEnemyProjectilePayload =
  | 'cold'
  | 'fire'
  | 'none'
  | 'normal'
  | 'poison'

export interface BoundedArcherAimRequest {
  readonly accuracyMode: 0 | 1 | 2 | 3
  readonly arrowIndex: number
  readonly arrowType: BoneyardArrowType
  readonly origin: Readonly<Vector2>
  readonly projectileSpeed: number
  readonly randomUnit: number
  readonly targetPosition: Readonly<Vector2>
  /** Authoritative target displacement per simulation tick. */
  readonly targetVelocityPerTick: Readonly<Vector2>
  readonly totalArrows: number
}

export function boundedArcherAimHeading(request: BoundedArcherAimRequest): number {
  validateAimRequest(request)
  const target = request.accuracyMode === 1
    ? boundedLeadingTarget(request)
    : request.targetPosition
  const base = actorHeadingFromVector(
    target.x - request.origin.x,
    target.y - request.origin.y,
  )
  const formationOffset = (
    request.arrowIndex - (request.totalArrows - 1) / 2
  ) * BOUNDED_ARCHER_EXTRA_ARROW_STEP_DEG
  const accuracyOffset = request.accuracyMode === 2
    ? (request.randomUnit * 2 - 1) * BOUNDED_ARCHER_SCATTER_HALF_ANGLE_DEG
    : request.accuracyMode === 3
      ? (request.randomUnit * 2 - 1) * BOUNDED_ARCHER_RANDOM_HALF_ANGLE_DEG
      : 0
  return positiveDegrees(base + formationOffset + accuracyOffset)
}

export function projectilePayloadForArrow(type: BoneyardArrowType): BoneyardEnemyProjectilePayload {
  return type
}

export function boundedMageShieldIntervalTicks(configInterval: number): number {
  if (!Number.isFinite(configInterval) || configInterval < 0) {
    throw new RangeError('Mage shield interval must be finite and non-negative')
  }
  return Math.max(1, Math.round(
    configInterval * BOUNDED_MAGE_SHIELD_INTERVAL_TICKS_PER_CONFIG_UNIT,
  ))
}

function boundedLeadingTarget(request: BoundedArcherAimRequest): Readonly<Vector2> {
  const relativeX = request.targetPosition.x - request.origin.x
  const relativeY = request.targetPosition.y - request.origin.y
  const velocityX = request.targetVelocityPerTick.x
  const velocityY = request.targetVelocityPerTick.y
  const speedSquared = request.projectileSpeed * request.projectileSpeed
  const a = velocityX * velocityX + velocityY * velocityY - speedSquared
  const b = 2 * (relativeX * velocityX + relativeY * velocityY)
  const c = relativeX * relativeX + relativeY * relativeY
  const discriminant = b * b - 4 * a * c
  let interceptTicks = Number.POSITIVE_INFINITY
  if (Math.abs(a) < 1e-9) {
    if (Math.abs(b) >= 1e-9) interceptTicks = -c / b
  } else if (discriminant >= 0) {
    const root = Math.sqrt(discriminant)
    const first = (-b - root) / (2 * a)
    const second = (-b + root) / (2 * a)
    interceptTicks = [first, second]
      .filter((value) => value >= 0)
      .sort((left, right) => left - right)[0] ?? Number.POSITIVE_INFINITY
  }
  const boundedTicks = Number.isFinite(interceptTicks)
    ? Math.min(BOUNDED_ARCHER_LEADING_MAXIMUM_TICKS, interceptTicks)
    : 0
  return {
    x: request.targetPosition.x + velocityX * boundedTicks,
    y: request.targetPosition.y + velocityY * boundedTicks,
  }
}

function validateAimRequest(request: BoundedArcherAimRequest): void {
  if (
    !Number.isSafeInteger(request.arrowIndex)
    || !Number.isSafeInteger(request.totalArrows)
    || request.totalArrows < 1
    || request.totalArrows > BOUNDED_ARCHER_MAXIMUM_EXTRA_ARROWS + 1
    || request.arrowIndex < 0
    || request.arrowIndex >= request.totalArrows
  ) throw new RangeError('Archer arrow index/count is outside the bounded program')
  if (!Number.isFinite(request.projectileSpeed) || request.projectileSpeed <= 0) {
    throw new RangeError('Archer projectile speed must be finite and positive')
  }
  if (!Number.isFinite(request.randomUnit) || request.randomUnit < 0 || request.randomUnit > 1) {
    throw new RangeError('Archer aim random unit must be within 0..1')
  }
  for (const [label, point] of [
    ['origin', request.origin],
    ['target position', request.targetPosition],
    ['target velocity', request.targetVelocityPerTick],
  ] as const) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new RangeError(`Archer ${label} must be finite`)
    }
  }
}

function positiveDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}

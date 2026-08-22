export const NATIVE_EARTH_BOULDER_TRAVERSAL_POOL_THRESHOLD = 0.001

export interface NativeEarthBoulderContactInput {
  readonly releaseBaseDamage: number
  readonly releaseCharge: number
  readonly remainingPool: number
  readonly targetHealth: number
  readonly toughness: number
}

export interface NativeEarthBoulderContactResult {
  readonly charge: number
  readonly continueTraversal: boolean
  readonly damage: number
  readonly depleted: boolean
  readonly remainingPool: number
}

export function advanceNativeEarthBoulderCharge(
  charge: number,
  growthFactor: number,
  maximumCharge: number,
  castSpeed = 1,
): number {
  requireNonnegativeFinite(charge, 'Boulder charge')
  requireNonnegativeFinite(growthFactor, 'Boulder growth factor')
  requireNonnegativeFinite(maximumCharge, 'Boulder maximum charge')
  requireNonnegativeFinite(castSpeed, 'Boulder cast speed')
  const growth = Math.fround(Math.fround(0.5 * castSpeed) * growthFactor)
  const increment = Math.fround(growth * 0.0025)
  return Math.min(maximumCharge, Math.fround(charge + increment))
}

export function nativeEarthBoulderReleasedDamage(
  baseDamage: number,
  charge: number,
  releaseFactor: 0.5 | 1 = 1,
): number {
  requireNonnegativeFinite(baseDamage, 'Boulder base damage')
  requireNonnegativeFinite(charge, 'Boulder charge')
  const releaseBase = baseDamage * releaseFactor
  const baseCharge = Math.fround(releaseBase * charge)
  const quadratic = Math.fround(baseCharge * charge)
  return Math.max(0.25, Math.min(quadratic, releaseBase * 1.25))
}

export function consumeNativeEarthBoulderContact(
  input: NativeEarthBoulderContactInput,
): NativeEarthBoulderContactResult {
  requireNonnegativeFinite(input.releaseBaseDamage, 'Boulder release base damage')
  requireNonnegativeFinite(input.releaseCharge, 'Boulder release charge')
  requireNonnegativeFinite(input.remainingPool, 'Boulder remaining damage pool')
  requireNonnegativeFinite(input.targetHealth, 'Boulder target health')
  if (!Number.isFinite(input.toughness) || input.toughness <= 0) {
    throw new RangeError('Boulder toughness must be finite and positive')
  }
  const damage = Math.fround(Math.min(input.targetHealth, input.remainingPool))
  const consumed = Math.fround(input.remainingPool < input.targetHealth
    ? damage
    : damage / (2 * input.toughness))
  const remainingPool = Math.max(0, Math.fround(input.remainingPool - consumed))
  const charge = Math.fround(Math.min(
    input.releaseCharge,
    input.releaseCharge * (
      1 - (1 - remainingPool / input.releaseBaseDamage) * 0.35
    ),
  ))
  return Object.freeze({
    charge,
    continueTraversal: remainingPool > NATIVE_EARTH_BOULDER_TRAVERSAL_POOL_THRESHOLD,
    damage,
    depleted: remainingPool <= 0,
    remainingPool,
  })
}

export function nativePercentRollSucceeds(
  chancePercent: number,
  drawPercent: number,
): boolean {
  if (!Number.isFinite(chancePercent) || chancePercent < 0 || chancePercent > 100) {
    throw new RangeError('native chance must be between zero and one hundred')
  }
  if (!Number.isFinite(drawPercent) || drawPercent < 0 || drawPercent > 100) {
    throw new RangeError('native percent draw must be between zero and one hundred')
  }
  return drawPercent < chancePercent
}

export function nativeEarthBoulderRockHitPitch(charge: number): number {
  requireNonnegativeFinite(charge, 'Boulder terminal charge')
  if (charge === 0) throw new RangeError('Boulder terminal charge must be positive')
  return Math.fround(1 + 0.05 / charge)
}

export function nativeEarthBoulderStoneBreakPitch(charge: number): number {
  requireNonnegativeFinite(charge, 'Boulder terminal charge')
  return Math.fround(1 - charge * 0.5)
}

function requireNonnegativeFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${field} must be finite and non-negative`)
  }
}

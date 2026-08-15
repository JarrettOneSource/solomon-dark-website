export interface NativeEarthBoulderContactResult {
  readonly damage: number
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
  remainingPool: number,
  targetHealth: number,
  toughness: number,
): NativeEarthBoulderContactResult {
  requireNonnegativeFinite(remainingPool, 'Boulder remaining damage pool')
  requireNonnegativeFinite(targetHealth, 'Boulder target health')
  if (!Number.isFinite(toughness) || toughness <= 0) {
    throw new RangeError('Boulder toughness must be finite and positive')
  }
  const damage = Math.min(targetHealth, remainingPool)
  const consumed = remainingPool < targetHealth
    ? damage
    : damage / (2 * toughness)
  const remaining = remainingPool - consumed
  return Object.freeze({
    damage,
    remainingPool: remaining < 0.001 ? 0 : remaining,
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

function requireNonnegativeFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${field} must be finite and non-negative`)
  }
}

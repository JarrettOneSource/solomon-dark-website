import type { BoneyardArrowType } from './boneyard-enemy-config.ts'

/** Retail does not populate extraArrows; custom configs remain explicitly bounded. */
export const BOUNDED_ARCHER_MAXIMUM_EXTRA_ARROWS = 8

/** Exact status clocks remain open; the native payload/effect ownership is recovered. */
export const BOUNDED_ENEMY_COLD_SLOW_TICKS = 300
export const BOUNDED_ENEMY_COLD_MOVEMENT_SCALE = 0.5
/** Wraith writes Mod_Dazzle duration +0x14 = 0x32 at 0x00486C30. */
export const NATIVE_WRAITH_DAZZLE_TICKS = 50
export const BOUNDED_ENEMY_POISON_DURATION_SECONDS = 3

/** Native shield interval units remain open; config values are converted here. */
export const BOUNDED_MAGE_SHIELD_INTERVAL_TICKS_PER_CONFIG_UNIT = 100
export const BOUNDED_MAGE_ALLY_SHIELD_RANGE = 240

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

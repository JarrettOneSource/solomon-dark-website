import { drawNativeFloatRange, drawNativeInteger, type NativeRngState } from './native-rng.ts'

/** Crow contact checks health and the remaining shield after the damage receiver returns. */
export function nativeCrowBlindness(
  currentHealth: number,
  remainingShield: number,
  chancePercent: number,
  rng: NativeRngState,
): { durationTicks: number; rng: NativeRngState } {
  if (currentHealth <= 10 || remainingShield > 0) return { durationTicks: 0, rng }
  const chance = drawNativeInteger(rng, 100)
  if (chance.value >= chancePercent) return { durationTicks: 0, rng: chance.state }
  const duration = drawNativeFloatRange(chance.state, 1, 2.5)
  return { durationTicks: Math.fround(Math.fround(duration.value + 1) * 100), rng: duration.state }
}

/** Arena_Render: black cover fades during the final second; the stamp fades to the fourth power. */
export function nativeCrowBlindnessOpacity(ticksRemaining: number): { cover: number; stamp: number } {
  const cover = Math.min(1, Math.max(0, Math.fround(ticksRemaining / 100)))
  return { cover, stamp: Math.fround(cover ** 4) }
}

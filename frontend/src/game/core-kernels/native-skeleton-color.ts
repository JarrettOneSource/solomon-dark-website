import { nativeDesaturateColor } from './native-color.ts'
import { stableInclusiveUnit } from './native-enemy-presentation-random.ts'

export function nativeSkeletonBurningTint(green: number): number {
  const color = nativeDesaturateColor([1, Math.fround(green), 0, 1], .5)
  return packRgb(color[0], color[1], color[2])
}

export function nativeSkeletonBaseTint(
  seed: Readonly<{ id: number; spawnTick: number }>,
  burning: boolean,
  charge: number,
  epoch: number,
  includeFire = true,
): number {
  if (!includeFire && charge > 0) return 0xffffff
  if (burning) return nativeSkeletonBurningTint(!includeFire
    ? .25 + stableInclusiveUnit(seed, 73, epoch) * .75
    : stableInclusiveUnit(seed, 72, epoch) * .5)
  const neutral = 1 - stableInclusiveUnit(seed, 71) * .15
  return packRgb(neutral, neutral, 1)
}

function packRgb(red: number, green: number, blue: number): number {
  const channel = (value: number) => Math.trunc(Math.min(1, Math.max(0, value)) * 255)
  return (channel(red) << 16) | (channel(green) << 8) | channel(blue)
}

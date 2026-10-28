import type { BoneyardPoint } from './boneyard.ts'

export const NATIVE_POISON_POOL_DAMAGE_TICKS = 3000
export const NATIVE_POISON_POOL_MAXIMUM_SCALE = Math.fround(1.6)
export const NATIVE_POISON_POOL_GROWTH = Math.fround(0.025)

const fadeAlphas = [1]
while (fadeAlphas[fadeAlphas.length - 1]! > 0) {
  fadeAlphas.push(Math.max(0, Math.fround(
    fadeAlphas[fadeAlphas.length - 1]! - Math.fround(0.005),
  )))
}

export const NATIVE_POISON_POOL_LIFETIME_TICKS = NATIVE_POISON_POOL_DAMAGE_TICKS + fadeAlphas.length - 2

export function nativePoisonPoolAlpha(ageTicks: number): number {
  return fadeAlphas[Math.min(
    fadeAlphas.length - 1,
    Math.max(0, ageTicks - NATIVE_POISON_POOL_DAMAGE_TICKS + 1),
  )]!
}

export function nativePoisonPoolContact(origin: Readonly<BoneyardPoint>, target: Readonly<BoneyardPoint>): boolean {
  const x = Math.fround(target.x - origin.x)
  const y = Math.fround(Math.fround(target.y - origin.y) / Math.fround(0.8))
  return Math.fround(x * x + y * y) < 4900
}

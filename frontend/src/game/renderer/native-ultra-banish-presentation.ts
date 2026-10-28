import type { NativeBossSpell } from '../core-kernels/native-boss-spell.ts'
import { createNativeRng, drawNativeFloat } from '../core-kernels/native-rng.ts'
import { layer } from './native-enemy-layers.ts'

export interface NativeBanishGradient {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number
  readonly startColor: number; readonly endColor: number; readonly startAlpha: number; readonly endAlpha: number
}

export function nativeUltraBanishPlan(spell: Extract<NativeBossSpell, { kind: 'ultra-banish' }>,
  tick: number, viewHeight: number) {
  let rng = createNativeRng(spell.id + Math.trunc(tick))
  const random = (maximum: number) => {
    const draw = drawNativeFloat(rng, maximum)
    rng = draw.state
    return draw.value
  }
  const progress = spell.alpha - random(Math.fround(.2))
  const scale = 5 + random(4)
  const offsetY = -50 * scale
  const upper = viewHeight * .5 * scale
  const lower = 50 * scale
  const gradients: NativeBanishGradient[] = []
  for (const value of [progress, ...(spell.flashAlpha > 0 ? [spell.flashAlpha] : [])]) {
    for (const [halfWidth, extent, color, alpha] of [
      [10 * scale, upper, 0x80ff00, Math.min(1, value * .5)],
      [5 * value * scale, upper, 0xbfff00, Math.min(1, value * .5)],
      [2 * value * scale, upper * .75, 0xffffff, Math.min(1, value * .75)],
    ]) {
      if (halfWidth! <= 0) continue
      gradients.push({ x: -halfWidth!, y: offsetY - extent!, width: halfWidth! * 2, height: extent!,
        startColor: 0, startAlpha: 1, endColor: color!, endAlpha: alpha! },
      { x: -halfWidth!, y: offsetY, width: halfWidth! * 2, height: lower,
        startColor: color!, startAlpha: alpha!, endColor: 0, endAlpha: 1 })
    }
  }
  const coreScale = (5 + random(1)) * progress * 2
  const tint = Math.round(Math.max(0, Math.min(1, progress * .75)) * 255) << 16 | 0x00ff00
  return { gradients, layers: [0, 1].map(index => layer('BadGuys', 15, `ultra-banish-core-${index}`,
    { alpha: Math.max(0, Math.min(1, progress)), blendMode: 'add', scale: Math.max(0, coreScale), tint })) }
}

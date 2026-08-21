import type { ProtocolModEffect } from '../protocol/game-state.ts'

export const MOD_CONSUMABLE_TEXTURE_SIZE = 128
const BASE_RADIUS = 42
const RADIUS_PULSE = 3
const PULSE_TICKS = 120

export interface ModConsumableEffectPlan {
  readonly alpha: number
  readonly flashAlphas: readonly [number, number, number, number]
  readonly flashRotations: readonly [number, number, number, number]
  readonly flashScales: readonly [number, number, number, number]
  readonly flashVisible: boolean
  readonly radius: number
  readonly tint: number
}

export function modConsumableEffectPlan(
  effect: ProtocolModEffect,
  tick: number,
): ModConsumableEffectPlan {
  const tint = colorTint(effect.color)
  const phase = (tick - effect.startedTick) / PULSE_TICKS * Math.PI * 2
  const random = effectRandom(effect.useId)
  const sourceScale = 1 + random[0] * 0.5
  const angle = random[1] * Math.PI * 2
  const pulse = (Math.abs(Math.sin(angle * 15)) * 0.15 + 3.5) * sourceScale
  return {
    alpha: effect.color[3] * 0.8,
    flashAlphas: [
      effect.color[3] * (random[3] * 0.25 + 0.2),
      effect.color[3] * 0.5,
      effect.color[3] * 0.5,
      effect.color[3] * 0.25,
    ],
    flashRotations: [angle, angle + Math.PI / 2, angle + Math.PI, angle + Math.PI * 1.5],
    flashScales: [pulse, pulse * 0.75, pulse * 0.5, pulse * (random[2] * 0.2 + 0.2)],
    flashVisible: tick === effect.startedTick,
    radius: BASE_RADIUS + RADIUS_PULSE * Math.sin(phase),
    tint,
  }
}

export function modConsumableRingAlpha(x: number, y: number): number {
  const center = (MOD_CONSUMABLE_TEXTURE_SIZE - 1) * 0.5
  const distance = Math.hypot(x - center, y - center)
  const outer = Math.max(0, Math.min(1, 1 - Math.abs(distance - 47) / 11))
  const inner = Math.max(0, Math.min(1, 1 - distance / 54)) * 0.28
  return Math.max(0, Math.min(1, outer + inner))
}

export function modConsumableEffectId(
  effect: Pick<ProtocolModEffect, 'playerId' | 'useId'>,
): string {
  return `mod-effect:${effect.playerId}:${effect.useId}`
}

function colorTint(color: readonly [number, number, number, number]): number {
  return Math.round(color[0] * 255) << 16
    | Math.round(color[1] * 255) << 8
    | Math.round(color[2] * 255)
}

function effectRandom(useId: number): readonly [number, number, number, number] {
  let state = useId >>> 0
  const next = (): number => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x1_0000_0000
  }
  return [next(), next(), next(), next()]
}

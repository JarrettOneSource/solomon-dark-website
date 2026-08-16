import type { DynamicPainterLayer } from '../boneyard-painter-order.ts'
import type { BoneyardEnemyProjectileEffectSnapshot } from '../protocol/game-state.ts'

export interface NativeEnemyProjectileEffectPlan {
  readonly alpha: number
  readonly atlas: BoneyardEnemyProjectileEffectSnapshot['atlas']
  readonly blendMode: BoneyardEnemyProjectileEffectSnapshot['blendMode']
  readonly entry: number
  readonly position: Readonly<{ x: number; y: number }>
  readonly rotationRadians: number
  readonly scale: number
  readonly tint: number
}

export function nativeEnemyProjectileEffectPlan(
  effect: BoneyardEnemyProjectileEffectSnapshot,
): NativeEnemyProjectileEffectPlan {
  const guided = guidedImpactPresentation(effect)
  return Object.freeze({
    alpha: guided?.alpha ?? effect.alpha,
    atlas: effect.atlas,
    blendMode: effect.blendMode,
    entry: effect.entry,
    position: Object.freeze({ ...effect.position }),
    rotationRadians: guided?.rotationRadians ?? effect.rotationRadians,
    scale: guided?.scale ?? effect.scale,
    tint: effect.tint,
  })
}

function guidedImpactPresentation(
  effect: BoneyardEnemyProjectileEffectSnapshot,
): Readonly<{ alpha: number; rotationRadians: number; scale: number }> | null {
  if (!effect.kind.startsWith('guided-impact-')) return null
  const phaseDeg = effect.rotationRadians * 180 / Math.PI
  const tick = effect.spawnTick + effect.ageTicks
  if (effect.kind === 'guided-impact-main') {
    return {
      alpha: effect.alpha * (0.5 + deterministicUnit(effect.id, tick) * 0.5),
      rotationRadians: 0,
      scale: 1.1 + Math.abs(sinDegrees(phaseDeg * 15)) * 0.15 * effect.scale,
    }
  }
  const frequency = effect.kind === 'guided-impact-aura-one' ? 3 : 6
  return {
    alpha: effect.alpha * Math.abs(sinDegrees(phaseDeg * frequency)) * 0.55,
    rotationRadians: phaseDeg * 0.5 * Math.PI / 180,
    scale: (1 + deterministicUnit(effect.id, tick) * 0.3) * effect.scale,
  }
}

function sinDegrees(value: number): number {
  return Math.sin(value * Math.PI / 180)
}

function deterministicUnit(id: number, tick: number): number {
  let value = (
    (id >>> 0)
    ^ Math.imul((tick + 1) >>> 0, 0x9e3779b1)
  ) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value = (value ^ (value >>> 15)) >>> 0
  return value / 0x1_0000_0000
}

export function nativeEnemyProjectileEffectPainterLayer(
  effect: BoneyardEnemyProjectileEffectSnapshot,
  sourceOrder: number,
): DynamicPainterLayer {
  return {
    id: `enemy-projectile-effect:${effect.id}`,
    queueFamily: 'ordinary-dynamic',
    sortBias: 0,
    sourceOrder,
    worldY: effect.position.y,
  }
}

import type { DynamicPainterLayer } from '../boneyard-painter-order.ts'
import type { BoneyardEnemyDeathEffectSnapshot } from '../protocol/game-state.ts'

export interface NativeEnemyDeathEffectLayer {
  readonly alpha: number
  readonly atlas: BoneyardEnemyDeathEffectSnapshot['atlas']
  readonly blendMode: BoneyardEnemyDeathEffectSnapshot['blendMode']
  readonly entry: number
  readonly offset: Readonly<{ x: number; y: number }>
  readonly rotationRadians: number
  readonly scale: Readonly<{ x: number; y: number }>
  readonly tint: number
}

export interface NativeEnemyDeathEffectPlan {
  readonly effect: NativeEnemyDeathEffectLayer
  readonly position: Readonly<{ x: number; y: number }>
  readonly shadow: NativeEnemyDeathEffectLayer | null
}

export function nativeEnemyDeathEffectPlan(
  effect: BoneyardEnemyDeathEffectSnapshot,
): NativeEnemyDeathEffectPlan {
  const perspective = effect.kind === 'fade-perspective'
    || effect.kind === 'fade-perspective-clipped'
    || effect.kind === 'late-splat'
  const main: NativeEnemyDeathEffectLayer = Object.freeze({
    alpha: effect.alpha,
    atlas: effect.atlas,
    blendMode: effect.blendMode,
    entry: effect.entry,
    offset: Object.freeze({ x: 0, y: effect.height }),
    rotationRadians: effect.rotationRadians,
    scale: Object.freeze({
      x: effect.scale,
      y: perspective ? effect.scale * 0.75 : effect.scale,
    }),
    tint: effect.tint,
  })
  return Object.freeze({
    effect: main,
    position: Object.freeze({ ...effect.position }),
    shadow: effect.shadow
      ? Object.freeze({
          alpha: effect.alpha,
          atlas: effect.atlas,
          blendMode: 'normal' as const,
          entry: effect.entry,
          offset: Object.freeze({ x: 0, y: 2 }),
          rotationRadians: effect.rotationRadians,
          scale: Object.freeze({ x: effect.scale, y: effect.scale * 0.75 }),
          tint: 0x000000,
        })
      : null,
  })
}

export function nativeEnemyDeathEffectPainterLayer(
  effect: BoneyardEnemyDeathEffectSnapshot,
): DynamicPainterLayer {
  if (nativeEnemyDeathEffectPainterLane(effect) !== 'world-sorted') {
    throw new Error('direct death effect cannot enter the world-sorted painter')
  }
  if (effect.painterRegistration === null) {
    throw new Error('world-sorted death effect lost its painter registration')
  }
  return {
    id: `enemy-death-effect:${effect.id}`,
    queueFamily: 'ordinary-dynamic',
    registration: effect.painterRegistration,
    sortBias: 0,
    worldY: effect.position.y,
  }
}

export function nativeEnemyDeathEffectPainterLane(
  effect: BoneyardEnemyDeathEffectSnapshot,
): 'post-world-queue' | 'pre-world-queue' | 'world-sorted' {
  if (effect.presentationOwner === 'direct-post-world') return 'post-world-queue'
  if (effect.presentationOwner === 'pre-world-queue') return 'pre-world-queue'
  return 'world-sorted'
}

export function nativeEnemyDeathEffectBypassesWorldTint(
  _effect: BoneyardEnemyDeathEffectSnapshot,
): boolean {
  return true
}

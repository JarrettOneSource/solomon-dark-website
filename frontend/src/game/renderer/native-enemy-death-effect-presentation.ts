import type { DynamicPainterLayer } from '../boneyard-painter-order.ts'
import type { BoneyardBounds } from '../core-kernels/boneyard.ts'
import type { BoneyardEnemyDeathEffectSnapshot } from '../protocol/game-state.ts'
import { boneyardTransformedArtBounds } from './boneyard-off-camera-cleanup.ts'

export interface NativeEnemyDeathEffectArtRecord {
  readonly anchorX: number
  readonly anchorY: number
  readonly height: number
  readonly width: number
}

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

export interface NativeEnemyDeathEffectViewResourcePlan {
  readonly banishGraphics: boolean
  readonly banishSprites: number
  readonly childCount: number
  readonly effectSprite: boolean
  readonly shadowSprite: boolean
}

const BANISH_VIEW_RESOURCES: NativeEnemyDeathEffectViewResourcePlan = Object.freeze({
  banishGraphics: true,
  banishSprites: 4,
  childCount: 5,
  effectSprite: false,
  shadowSprite: false,
})
const SHADOWED_SPRITE_VIEW_RESOURCES: NativeEnemyDeathEffectViewResourcePlan = Object.freeze({
  banishGraphics: false,
  banishSprites: 0,
  childCount: 2,
  effectSprite: true,
  shadowSprite: true,
})
const UNSHADOWED_SPRITE_VIEW_RESOURCES: NativeEnemyDeathEffectViewResourcePlan = Object.freeze({
  banishGraphics: false,
  banishSprites: 0,
  childCount: 1,
  effectSprite: true,
  shadowSprite: false,
})

export function nativeEnemyDeathEffectViewResourcePlan(
  effect: Pick<BoneyardEnemyDeathEffectSnapshot, 'kind' | 'shadow'>,
): NativeEnemyDeathEffectViewResourcePlan {
  if (effect.kind === 'banish') return BANISH_VIEW_RESOURCES
  return effect.shadow ? SHADOWED_SPRITE_VIEW_RESOURCES : UNSHADOWED_SPRITE_VIEW_RESOURCES
}

export function nativeEnemyDeathEffectVisualBounds(
  effect: BoneyardEnemyDeathEffectSnapshot,
  resolveArt: (
    atlas: BoneyardEnemyDeathEffectSnapshot['atlas'],
    entry: number,
  ) => NativeEnemyDeathEffectArtRecord,
): BoneyardBounds {
  if (effect.kind === 'banish') return nativeBanishVisualBounds(effect, resolveArt)
  const perspective = effect.kind === 'fade-perspective'
    || effect.kind === 'fade-perspective-clipped'
    || effect.kind === 'late-splat'
  const art = resolveArt(effect.atlas, effect.entry)
  const bounds = [boneyardTransformedArtBounds(
    { x: effect.position.x, y: effect.position.y + effect.height },
    { anchorX: art.anchorX, anchorY: art.anchorY, h: art.height, w: art.width },
    effect.rotationRadians * 180 / Math.PI,
    effect.scale,
    effect.kind === 'move-fade-perspective'
      ? Math.fround(effect.scale * Math.fround(0.8))
      : perspective ? effect.scale * 0.75 : effect.scale,
  )]
  if (effect.shadow) {
    bounds.push(boneyardTransformedArtBounds(
      { x: effect.position.x, y: effect.position.y + 2 },
      { anchorX: art.anchorX, anchorY: art.anchorY, h: art.height, w: art.width },
      effect.rotationRadians * 180 / Math.PI,
      effect.scale,
      effect.scale * 0.75,
    ))
  }
  return unionBounds(bounds)
}

function nativeBanishVisualBounds(
  effect: BoneyardEnemyDeathEffectSnapshot,
  resolveArt: (
    atlas: BoneyardEnemyDeathEffectSnapshot['atlas'],
    entry: number,
  ) => NativeEnemyDeathEffectArtRecord,
): BoneyardBounds {
  const scale = effect.scale
  const progress = Math.max(0, 2 - effect.ageTicks * (0.02 / scale))
  const lowerExtent = 50 * scale
  const upperExtent = 450 * scale
  const core = resolveArt('BadGuys', 15)
  const upper = resolveArt('BadGuys', 333 + positiveModulo(
    Math.floor((effect.spawnTick + effect.ageTicks) / 4),
    4,
  ))
  return unionBounds([
    {
      h: upperExtent + lowerExtent,
      w: 20 * scale,
      x: effect.position.x - 10 * scale,
      y: effect.position.y - upperExtent,
    },
    boneyardTransformedArtBounds(
      effect.position,
      { anchorX: core.anchorX, anchorY: core.anchorY, h: core.height, w: core.width },
      0,
      2 * progress * scale,
      2 * progress * scale,
    ),
    boneyardTransformedArtBounds(
      { x: effect.position.x + 1, y: effect.position.y - 40 * scale },
      { anchorX: upper.anchorX, anchorY: upper.anchorY, h: upper.height, w: upper.width },
      0,
      2 * scale,
      3 * scale,
    ),
  ])
}

function unionBounds(bounds: readonly BoneyardBounds[]): BoneyardBounds {
  let minimumX = Number.POSITIVE_INFINITY
  let minimumY = Number.POSITIVE_INFINITY
  let maximumX = Number.NEGATIVE_INFINITY
  let maximumY = Number.NEGATIVE_INFINITY
  for (const bound of bounds) {
    minimumX = Math.min(minimumX, bound.x)
    minimumY = Math.min(minimumY, bound.y)
    maximumX = Math.max(maximumX, bound.x + bound.w)
    maximumY = Math.max(maximumY, bound.y + bound.h)
  }
  return {
    h: maximumY - minimumY,
    w: maximumX - minimumX,
    x: minimumX,
    y: minimumY,
  }
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
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
      y: effect.kind === 'move-fade-perspective'
      ? Math.fround(effect.scale * Math.fround(0.8))
      : perspective ? effect.scale * 0.75 : effect.scale,
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

import type { DynamicPainterLayer } from '../boneyard-painter-order.ts'
import { nativeFirePresentationRandom } from '../core-kernels/primary-spell-fire-native.ts'
import type { BoneyardEnemyProjectileEffectSnapshot } from '../protocol/game-state.ts'
import {
  nativeEnemyProjectileLayer,
  type NativeEnemyProjectileLayer,
} from './native-enemy-projectile-presentation.ts'
import {
  nativeFireExplosionPlan,
  nativeFireGroundGlowPlan,
  nativeFirePatchTransform,
  type NativeFireGroundGlowPlan,
} from './primary-spell-fire-native.ts'

export interface NativeEnemyProjectileEffectPlan {
  readonly groundGlow: NativeFireGroundGlowPlan | null
  readonly layers: readonly NativeEnemyProjectileLayer[]
  readonly position: Readonly<{ x: number; y: number }>
}

export function nativeEnemyProjectileEffectPlan(
  effect: BoneyardEnemyProjectileEffectSnapshot,
  pointGain = 1,
): NativeEnemyProjectileEffectPlan {
  const base = { groundGlow: null, position: effect.position }
  if (effect.kind.startsWith('demon-explosion-')) {
    const explosion = nativeFireExplosionPlan({
      ageTicks: effect.ageTicks, id: effect.id, origin: effect.position,
      presentation: 'fire', visualScale: effect.scale,
    }, pointGain)
    return { ...base, layers: explosion.draws
      .filter(draw => draw.role === effect.kind.slice('demon-'.length))
      .map(draw => nativeEnemyProjectileLayer(draw.atlas, draw.entry, draw.role, {
        alpha: draw.alpha, blendMode: draw.blend, offset: draw.offset,
        rotationRadians: draw.rotation, scale: draw.scale, tint: draw.tint,
      })) }
  }
  if (effect.kind === 'guided-impact') return { ...base, layers: guidedImpactLayers(effect) }
  if (effect.kind === 'fire-burst') return { ...base, layers: [
    nativeEnemyProjectileLayer('BadGuys', 110, 'fire-burst-glow', {
      alpha: effect.alpha, scale: effect.scale * 5, tint: 0xff8000,
    }),
    nativeEnemyProjectileLayer('BadGuys', effect.entry, 'fire-burst-frame', {
      blendMode: 'add', rotationRadians: effect.rotationRadians,
      scale: effect.scale, tint: 0xffffbf,
    }),
  ] }
  const sprite = nativeEnemyProjectileLayer(effect.atlas, effect.entry, effect.kind, {
    alpha: effect.alpha, blendMode: effect.blendMode,
    rotationRadians: effect.rotationRadians, scale: effect.scale, tint: effect.tint,
  })
  if (effect.kind !== 'demon-fire') return { ...base, layers: [sprite] }
  const transform = nativeFirePatchTransform({
    position: effect.position, scale: effect.scale,
    fadeAlpha: effect.fireFadeAlpha, horizontalSign: effect.fireHorizontalSign,
  })
  return {
    groundGlow: nativeFireGroundGlowPlan({
      id: effect.id, life: effect.alpha, position: effect.position, scale: effect.scale,
    }, effect.spawnTick + effect.ageTicks),
    layers: [{ ...sprite, scale: transform.scaleX, scaleY: transform.scaleY }],
    position: transform.position,
  }
}

function guidedImpactLayers(effect: BoneyardEnemyProjectileEffectSnapshot): readonly NativeEnemyProjectileLayer[] {
  const phaseDeg = effect.rotationRadians * 180 / Math.PI
  const tick = effect.spawnTick + effect.ageTicks
  const main = nativeEnemyProjectileLayer('BadGuys', effect.entry, 'guided-impact-main', {
    alpha: effect.alpha * (0.5 + nativeFirePresentationRandom(effect.id, tick, 40, 0.5)),
    blendMode: 'add',
    scale: Math.fround(1.1 + Math.abs(sinDegrees(phaseDeg * 15)) * 0.15 * effect.scale),
  })
  return [main, { ...main }, ...[1, 2].map(index => nativeEnemyProjectileLayer(
    'BadGuys', 110 + index, `guided-impact-aura-${index}`, {
      alpha: effect.alpha * Math.abs(sinDegrees(phaseDeg * index * 3)) * 0.55,
      blendMode: 'add', rotationRadians: effect.rotationRadians * 0.5,
      scale: Math.fround((1 + nativeFirePresentationRandom(effect.id, tick, 40 + index, 0.3)) * effect.scale),
      tint: effect.tint,
    },
  ))]
}

function sinDegrees(value: number): number { return Math.sin(value * Math.PI / 180) }

export function nativeEnemyProjectileEffectPainterLayer(
  effect: BoneyardEnemyProjectileEffectSnapshot,
): DynamicPainterLayer | null {
  if (effect.kind === 'demon-explosion-core' || effect.kind === 'demon-explosion-array' || effect.kind === 'poison-bubble') return null
  const wrapped = effect.kind === 'fire-burst' || effect.kind === 'guided-impact'
    || effect.kind === 'demon-explosion-lit-array'
  return {
    id: `enemy-projectile-effect:${effect.id}`,
    queueFamily: wrapped ? 'zanim' : 'ordinary-dynamic',
    registration: effect.painterRegistration,
    sortBias: effect.kind === 'fire-burst' ? 50 : effect.kind === 'guided-impact' ? 100 : 0,
    worldY: effect.position.y,
  }
}

export function nativeEnemyProjectileEffectBypassesWorldTint(effect: BoneyardEnemyProjectileEffectSnapshot): boolean {
  return effect.kind === 'fire-burst' || effect.kind === 'guided-impact' || effect.kind.startsWith('demon-')
}

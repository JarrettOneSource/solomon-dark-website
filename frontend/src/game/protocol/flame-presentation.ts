import type { NativeFlameChannelBirth, NativeFlameFadeBirth } from '../core-kernels/native-weld-flame-state.ts'
import { nativeFlameFadeAlpha } from '../core-kernels/native-weld-flame-state.ts'
import type { NativeWorldManagerRegistration } from '../core-kernels/native-world-manager-order.ts'
import type { PrimarySpellTransientState } from '../core-kernels/primary-spells.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type { FlamePresentationBirth, FlamePresentationHistoryFrame } from './flame-presentation-history.ts'

export type FlamePresentationRecipe = Readonly<{
  kind: 'ribbon'
  birth: NativeFlameChannelBirth
  enhancedEffects: boolean
  weak: boolean
  painterRegistration: NativeWorldManagerRegistration
}> | Readonly<{
  kind: 'fade'
  birth: NativeFlameFadeBirth
  position: Vector2
  alphaStep: number
  baseScale: number
  wrapperScalar: number
  variant: 'source' | 'endpoint' | 'chain'
  painterRegistration: NativeWorldManagerRegistration
}>

export type FlamePresentationFrame = FlamePresentationHistoryFrame<FlamePresentationRecipe>
export type RetainedFlamePresentationBirth = FlamePresentationBirth<FlamePresentationRecipe>

export function flamePresentationBirth(actor: PrimarySpellTransientState): RetainedFlamePresentationBirth | null {
  if (actor.kind !== 'weld-channel' && actor.kind !== 'weld-flame-lash-fade') return null
  if (actor.buildId !== 1003 || actor.flameVisual?.kind !== 'native-birth-v1') return null
  const painterRegistration = actor.painterRegistrations?.[0]
  if (!painterRegistration) throw new Error('Flame presentation lost its native painter root')
  if (actor.kind === 'weld-channel') return {
    id: actor.id, kind: 'ribbon', ownerId: actor.ownerId, worldKey: actor.worldKey,
    birthTick: actor.birthTick, endTickExclusive: actor.birthTick + 1,
    recipe: { kind: 'ribbon', birth: actor.flameVisual, enhancedEffects: actor.enhancedEffects,
      weak: actor.underpowered, painterRegistration },
  }
  const birth = actor.flameVisual as NativeFlameFadeBirth
  let lifetime = 0
  while (nativeFlameFadeAlpha(birth.birthAlpha, actor.alphaStep, lifetime) > 0) lifetime += 1
  return {
    id: actor.id, kind: 'fade', ownerId: actor.ownerId, worldKey: actor.worldKey,
    birthTick: actor.birthTick, endTickExclusive: actor.birthTick + lifetime,
    recipe: { kind: 'fade', birth, position: actor.position, alphaStep: actor.alphaStep,
      baseScale: actor.baseScale, wrapperScalar: actor.wrapperScalar, variant: actor.variant,
      painterRegistration },
  }
}

/** Presentation-only actor projection. Never inserted into a save, host state or ML input. */
export function materializeFlamePresentation(birth: RetainedFlamePresentationBirth, tick: number): PrimarySpellTransientState | null {
  const ageTicks = Math.floor(tick) - birth.birthTick
  if (ageTicks < 0 || tick >= birth.endTickExclusive) return null
  const recipe = birth.recipe
  const common = { ageTicks, birthTick: birth.birthTick, buildId: 1003 as const,
    direction: { x: 0, y: -1 }, id: birth.id, ownerId: birth.ownerId,
    vector: [0, 0, 0, 0, 0, 0, 0, 0], worldKey: birth.worldKey,
    painterRegistrations: [recipe.painterRegistration] }
  if (recipe.kind === 'ribbon') return { ...common, kind: 'weld-channel',
    origin: recipe.birth.start, midpoint: recipe.birth.control, endpoint: recipe.birth.end,
    flameVisual: recipe.birth, enhancedEffects: recipe.enhancedEffects, underpowered: recipe.weak,
    lightRegistration: null, targetId: null, variant: birth.id % 4 }
  return { ...common, kind: 'weld-flame-lash-fade', origin: recipe.position,
    position: recipe.position, flameVisual: recipe.birth,
    alpha: nativeFlameFadeAlpha(recipe.birth.birthAlpha, recipe.alphaStep, ageTicks),
    alphaStep: recipe.alphaStep, baseScale: recipe.baseScale, wrapperScalar: recipe.wrapperScalar,
    variant: recipe.variant, record: 35, colorGreen: recipe.variant === 'source' ? 1 : .75,
    rotationDegrees: 0, lightRegistration: recipe.variant === 'source' ? null : recipe.painterRegistration }
}

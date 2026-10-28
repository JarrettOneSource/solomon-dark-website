import { drawNativeFloat, type NativeRngState } from './native-rng.ts'
import { nativeFlameFadeAlpha, nativeFlameFadeWrapperIntensity, type NativeFlameFadeVisual } from './native-weld-flame-state.ts'
import { createNativeWorldManagerOrder, type NativeWorldManagerRegistration, type NativeWorldPainterOwner, type RegisterNativeWorldPainter } from './native-world-manager-order.ts'
import type { NativeBoneyardLightSource } from './native-boneyard-light-model.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_WELD_FLAME_LASH_FADE_ALPHA_STEP = Math.fround(0.2)
export const NATIVE_WELD_FLAME_LASH_COARSE_FADE_ALPHA_STEP = Math.fround(0.4)
export const NATIVE_WELD_FLAME_LASH_FADE_RECORD = 35

export interface NativeWeldFlameLashFadeState extends NativeWorldPainterOwner {
  readonly ageTicks: number
  readonly alpha: number
  readonly alphaStep: number
  readonly baseScale: number
  readonly birthTick: number
  readonly buildId: 1003
  readonly colorGreen: number
  readonly direction: Vector2
  readonly flameVisual: NativeFlameFadeVisual
  readonly id: number
  readonly kind: 'weld-flame-lash-fade'
  readonly lightRegistration: NativeWorldManagerRegistration | null
  readonly origin: Vector2
  readonly ownerId: string
  readonly position: Vector2
  readonly record: 35
  readonly rotationDegrees: number
  readonly variant: 'chain' | 'endpoint' | 'source'
  readonly vector: readonly number[]
  readonly wrapperScalar: number
  readonly worldKey: string
}

export function createNativeWeldFlameLashFade(input: {
  readonly alpha?: .5 | 1
  readonly enhancedEffects?: boolean
  readonly direction: Vector2
  readonly id: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly registerWorldPainter?: RegisterNativeWorldPainter
  readonly rng: NativeRngState
  readonly tick: number
  readonly variant: NativeWeldFlameLashFadeState['variant']
  readonly vector: readonly number[]
  readonly worldKey: string
}): Readonly<{ actor: NativeWeldFlameLashFadeState; rng: NativeRngState }> {
  // Shared native words are constructor rotations, then branch payload order.
  const overwrittenRotation = drawNativeFloat(input.rng, 360)
  const rotation = drawNativeFloat(overwrittenRotation.state, 360)
  let rng = rotation.state
  let colorGreen = input.variant === 'source' ? 1 : Math.fround(.75)
  if (input.variant === 'endpoint') {
    const color = drawNativeFloat(rng, Math.fround(.5)); rng = color.state
    colorGreen = Math.fround(1 - color.value)
  }
  const radius = drawNativeFloat(rng, input.variant === 'source' ? 15 : 10)
  const heading = drawNativeFloat(radius.state, 360)
  const scale = drawNativeFloat(heading.state, Math.fround(.5))
  rng = scale.state
  let wrapperScalar = 1
  if (input.variant !== 'source') {
    const wrapper = drawNativeFloat(rng, Math.fround(.75)); rng = wrapper.state
    wrapperScalar = Math.fround(.75 + wrapper.value)
  }
  const birthAlpha = input.variant === 'source' ? .5 : input.alpha ?? 1
  const alphaStep = Math.fround(input.enhancedEffects === false ? .4 : input.variant === 'source' ? .1 : .2)
  const radial = directionFromHeading(heading.value)
  const register = input.registerWorldPainter ?? createNativeWorldManagerOrder({
    nextRegistrationOrdinal: { actor: input.id, transient: input.id },
  }).register
  const registration = register('transient')
  const actor: NativeWeldFlameLashFadeState = Object.freeze({
    ageTicks: 0, alpha: nativeFlameFadeAlpha(birthAlpha, alphaStep, 0), alphaStep,
    baseScale: Math.fround((input.variant === 'source' ? .75 : .5) + scale.value),
    birthTick: input.tick, buildId: 1003, colorGreen,
    direction: Object.freeze({ ...input.direction }),
    flameVisual: Object.freeze({ kind: 'native-birth-v1', birthAlpha }),
    id: input.id, kind: 'weld-flame-lash-fade',
    lightRegistration: input.variant === 'source' ? null : registration,
    origin: Object.freeze({ ...input.origin }), ownerId: input.ownerId,
    painterRegistrations: Object.freeze([registration]),
    position: Object.freeze({
      x: Math.fround(input.origin.x + Math.fround(radial.x * radius.value)),
      y: Math.fround(input.origin.y + Math.fround(radial.y * radius.value)),
    }),
    record: 35, rotationDegrees: Math.fround(rotation.value + 1), variant: input.variant,
    vector: Object.freeze([...input.vector]), wrapperScalar, worldKey: input.worldKey,
  })
  return Object.freeze({ actor, rng })
}

export function stepNativeWeldFlameLashFade(actor: NativeWeldFlameLashFadeState): NativeWeldFlameLashFadeState | null {
  const alpha = Math.fround(actor.alpha - actor.alphaStep)
  if (alpha <= 0) return null
  return Object.freeze({ ...actor, ageTicks: actor.ageTicks + 1, alpha,
    rotationDegrees: Math.fround(actor.rotationDegrees + 1) })
}

export function nativeFlameLashFadeLight(actor: NativeWeldFlameLashFadeState): NativeBoneyardLightSource | null {
  if (actor.flameVisual.kind !== 'native-birth-v1' || actor.variant === 'source' || actor.alpha <= 0) return null
  return {
    castsDirectionalShadow: false,
    intensity: nativeFlameFadeWrapperIntensity(actor.flameVisual.birthAlpha, actor.ageTicks),
    position: actor.position,
    radius: Math.fround(actor.flameVisual.birthAlpha * actor.wrapperScalar),
  }
}

function directionFromHeading(degrees: number): Vector2 {
  // Existing recovered Math+4 constant, not host Math.PI or fround(Math.PI).
  const radians = Math.fround(degrees * 3.141592502593994 / 180)
  return Object.freeze({ x: Math.fround(Math.sin(radians)), y: Math.fround(-Math.cos(radians)) })
}

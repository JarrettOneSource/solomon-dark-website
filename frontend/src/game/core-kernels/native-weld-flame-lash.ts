import {
  drawNativeFloat,
  type NativeRngState,
} from './native-rng.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_WELD_FLAME_LASH_FADE_ALPHA_STEP = Math.fround(0.2)
export const NATIVE_WELD_FLAME_LASH_FADE_RECORD = 35

export interface NativeWeldFlameLashFadeState {
  readonly ageTicks: number
  readonly alpha: number
  readonly alphaStep: number
  readonly baseScale: number
  readonly birthTick: number
  readonly buildId: 1003
  readonly colorGreen: number
  readonly direction: Vector2
  readonly id: number
  readonly kind: 'weld-flame-lash-fade'
  readonly lightRegistration: null
  readonly origin: Vector2
  readonly ownerId: string
  readonly position: Vector2
  readonly record: 35
  readonly rotationDegrees: number
  readonly variant: 'chain' | 'endpoint'
  readonly vector: readonly number[]
  readonly wrapperScalar: number
  readonly worldKey: string
}

export function createNativeWeldFlameLashFade(input: {
  readonly alpha?: number
  readonly direction: Vector2
  readonly id: number
  readonly origin: Vector2
  readonly ownerId: string
  readonly rng: NativeRngState
  readonly tick: number
  readonly variant: NativeWeldFlameLashFadeState['variant']
  readonly vector: readonly number[]
  readonly worldKey: string
}): Readonly<{
  actor: NativeWeldFlameLashFadeState
  rng: NativeRngState
}> {
  const overwrittenRotation = drawNativeFloat(input.rng, 360)
  const rotation = drawNativeFloat(overwrittenRotation.state, 360)
  let rng = rotation.state
  let colorGreen = Math.fround(0.75)
  if (input.variant === 'endpoint') {
    const color = drawNativeFloat(rng, Math.fround(0.5))
    rng = color.state
    colorGreen = Math.fround(1 - color.value)
  }
  const offset = drawNativeFloat(rng, 10); rng = offset.state
  const scale = drawNativeFloat(rng, Math.fround(0.5)); rng = scale.state
  const wrapper = drawNativeFloat(rng, Math.fround(0.75)); rng = wrapper.state
  const radial = directionFromHeading(offset.value)
  const baseScale = Math.fround(
    Math.fround(scale.value + 0.5) * (input.variant === 'chain' ? 0.1 : 1),
  )
  return Object.freeze({
    actor: Object.freeze({
      ageTicks: 0,
      alpha: input.alpha ?? 1,
      alphaStep: NATIVE_WELD_FLAME_LASH_FADE_ALPHA_STEP,
      baseScale,
      birthTick: input.tick,
      buildId: 1003,
      colorGreen,
      direction: Object.freeze({ ...input.direction }),
      id: input.id,
      kind: 'weld-flame-lash-fade',
      lightRegistration: null,
      origin: Object.freeze({ ...input.origin }),
      ownerId: input.ownerId,
      position: Object.freeze({
        x: Math.fround(input.origin.x + radial.x * offset.value),
        y: Math.fround(input.origin.y + radial.y * offset.value),
      }),
      record: NATIVE_WELD_FLAME_LASH_FADE_RECORD,
      rotationDegrees: rotation.value,
      variant: input.variant,
      vector: Object.freeze([...input.vector]),
      wrapperScalar: Math.fround(wrapper.value + 0.75),
      worldKey: input.worldKey,
    }),
    rng,
  })
}

export function stepNativeWeldFlameLashFade(
  actor: NativeWeldFlameLashFadeState,
): NativeWeldFlameLashFadeState | null {
  const alpha = Math.fround(actor.alpha - actor.alphaStep)
  if (alpha <= 0) return null
  return Object.freeze({
    ...actor,
    ageTicks: actor.ageTicks + 1,
    alpha,
    rotationDegrees: Math.fround(actor.rotationDegrees + 1),
  })
}

function directionFromHeading(degrees: number): Vector2 {
  const radians = degrees * Math.PI / 180
  return Object.freeze({
    x: Math.fround(Math.sin(radians)),
    y: Math.fround(-Math.cos(radians)),
  })
}

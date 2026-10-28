import type { NativeWorldManagerRegistration } from './native-world-manager-order.ts'
import type { Vector2 } from './vector.ts'

/** Old actors retain their gameplay/ML row, but no missing birth sample is guessed. */
export interface NativeFlameLegacySuppressed {
  readonly kind: 'legacy-suppressed'
}

export const NATIVE_FLAME_LEGACY_SUPPRESSED: NativeFlameLegacySuppressed = Object.freeze({
  kind: 'legacy-suppressed',
})

export interface NativeFlameChannelBirth {
  readonly kind: 'native-birth-v1'
  readonly role: 'main' | 'chain'
  readonly cameraDisplacement: Vector2 | null
  readonly start: Vector2
  readonly control: Vector2
  readonly end: Vector2
  readonly offset: Vector2
  readonly width: number
  readonly ribbon: Readonly<{ kind: 'short'; widthFactor: number }>
    | Readonly<{ kind: 'long'; phaseDegrees: number }>
  readonly path: Readonly<{
    intensity: number
    radiusFactors: readonly number[]
    creatorRegistration: NativeWorldManagerRegistration
    miscAppendOrdinal: number
  }>
}

export type NativeFlameChannelVisual = NativeFlameLegacySuppressed | NativeFlameChannelBirth

export interface NativeFlameFadeBirth {
  readonly kind: 'native-birth-v1'
  readonly birthAlpha: .5 | 1
}

export type NativeFlameFadeVisual = NativeFlameLegacySuppressed | NativeFlameFadeBirth

export interface NativeFlameCameraProposal {
  readonly id: number
  readonly birthTick: number
  readonly worldKey: string
  readonly displacement: Readonly<Vector2>
}

/** Native children already receive update one before a birth-tick snapshot. */
export function nativeFlameFadeAlpha(birthAlpha: number, alphaStep: number, ageTicks: number): number {
  let alpha = birthAlpha
  for (let update = 0; update <= ageTicks; update += 1) alpha = Math.fround(alpha - alphaStep)
  return alpha
}

export function nativeFlameFadeWrapperIntensity(birthAlpha: number, ageTicks: number): number {
  let intensity = birthAlpha
  for (let update = 0; update <= ageTicks; update += 1) intensity = Math.fround(intensity + Math.fround(-.05))
  return intensity
}

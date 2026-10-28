import {
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import type { NativeWeldProjectileState } from './native-weld-primary-runtime.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_WELD_GROUND_SPARK_FADE_RECORDS = [71, 1836, 1837, 1838, 1839] as const

export interface NativeWeldGroundSparkFadeSeed {
  readonly alpha: number
  readonly alphaStep: number
  readonly position: Vector2
  readonly record: typeof NATIVE_WELD_GROUND_SPARK_FADE_RECORDS[number]
  readonly rotationDegrees: number
  readonly scale: number
}

export function createNativeWeldGroundSparkFadeProgram(input: {
  readonly projectile: NativeWeldProjectileState
  readonly rng: NativeRngState
}): {
  readonly fades: readonly NativeWeldGroundSparkFadeSeed[]
  readonly rng: NativeRngState
} {
  if (input.projectile.buildId !== 1009) {
    return { fades: Object.freeze([]), rng: input.rng }
  }
  let rng = input.rng
  const phase = Math.abs(Math.sin(
    input.projectile.groundSparkNativeAgeTicks! * 12 * Math.PI / 180,
  ))
  const rotation = drawNativeFloat(rng, 360); rng = rotation.state
  const scale = drawNativeFloat(rng, Math.fround(0.1), true); rng = scale.state
  const weakFactor = input.projectile.underpowered ? Math.fround(0.5) : 1
  const fades: NativeWeldGroundSparkFadeSeed[] = [Object.freeze({
    alpha: Math.fround(Math.fround(0.75) * weakFactor),
    alphaStep: Math.fround(Math.fround(0.1) * weakFactor),
    position: Object.freeze({
      x: input.projectile.position.x,
      y: Math.fround(input.projectile.position.y - phase * 15),
    }),
    record: 71,
    rotationDegrees: rotation.value,
    scale: Math.fround(scale.value + Math.fround(0.35)),
  })]

  let forkDue = phase < Math.fround(0.1)
  if (!forkDue) {
    const gate = drawNativeInteger(rng, 6)
    rng = gate.state
    forkDue = gate.value === 1
  }
  if (forkDue) {
    const record = drawNativeInteger(rng, 4); rng = record.state
    const forkRotation = drawNativeFloat(rng, 360); rng = forkRotation.state
    const alpha = drawNativeFloat(rng, Math.fround(0.25)); rng = alpha.state
    const lowPhase = phase < Math.fround(0.1)
    const baseAlpha = lowPhase
      ? Math.fround(Math.fround(1 + alpha.value) * 0.5)
      : Math.fround(Math.fround(1 + alpha.value) + 0.5)
    fades.push(Object.freeze({
      alpha: Math.fround(baseAlpha * weakFactor),
      alphaStep: Math.fround(0.1),
      position: Object.freeze({
        x: input.projectile.position.x,
        y: Math.fround(input.projectile.position.y - phase * 20),
      }),
      record: (1836 + record.value) as 1836 | 1837 | 1838 | 1839,
      rotationDegrees: forkRotation.value,
      scale: lowPhase ? Math.fround(0.75) : 1,
    }))
  }
  return { fades: Object.freeze(fades), rng }
}

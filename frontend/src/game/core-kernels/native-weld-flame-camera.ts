import { drawNativeFloat, type NativeRngState } from './native-rng.ts'
import type { Vector2 } from './vector.ts'

/** 0x540A2C/0x540A49: normal-only Float(4), then unsigned UnitVector. */
export function drawNativeFlameCameraDisplacement(rng: NativeRngState, underpowered: boolean) {
  if (underpowered) return { displacement: null, rng }
  const magnitude = drawNativeFloat(rng, 4)
  const angle = drawNativeFloat(magnitude.state, 360)
  const radians = Math.fround(angle.value * 3.141592502593994 / 180)
  return { displacement: Object.freeze({
    x: Math.fround(magnitude.value * Math.fround(Math.sin(radians))),
    y: Math.fround(magnitude.value * -Math.fround(Math.cos(radians))),
  }), rng: angle.state }
}

/** Region 0x448590 stores each squared length before its strict comparison. */
export function nativeCameraMagnitudeSquared(value: Readonly<Vector2>): number {
  return Math.fround(value.x * value.x + value.y * value.y)
}

/** 0x63F1D6: same-pass decay; equality at the stored .25 cutoff survives. */
export function decayNativeRegionCameraDisplacement(value: Readonly<Vector2>, updates: number): Vector2 {
  let x = Math.fround(value.x), y = Math.fround(value.y)
  for (let update = 0; update < updates; update += 1) {
    x = Math.fround(x * .75); y = Math.fround(y * .75)
    if (nativeCameraMagnitudeSquared({ x, y }) < .25) return { x: 0, y: 0 }
  }
  return { x, y }
}

// Inclusive magnitude4 reaches cutoff on update8. Birth already owns update1.
export const NATIVE_FLAME_CAMERA_MAX_PRESENTATION_TICKS = 7

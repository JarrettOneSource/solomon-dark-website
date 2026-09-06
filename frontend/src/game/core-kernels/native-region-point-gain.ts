import type { Vector2 } from './vector.ts'

/** Arena vslot +0x104 (0x004622D0), with distinct early-return and death behavior. */
export function nativeRegionHitPointGain(position: Vector2, cameraCenter: Vector2,
  visibleWorldWidth: number, localPlayerAlternate: boolean): number {
  if (!(visibleWorldWidth > 0)) return 0
  const width = Math.fround(visibleWorldWidth)
  const distance = Math.fround(Math.hypot(Math.fround(position.x - cameraCenter.x), Math.fround(position.y - cameraCenter.y)))
  const inner = Math.fround(width * Math.fround(.1))
  const outer = Math.fround(width * .5)
  if (distance < inner) return 1
  if (distance > outer) return 0
  const gain = Math.fround(1 - Math.fround(Math.fround(distance - inner) / Math.fround(outer - inner)))
  return localPlayerAlternate ? Math.fround(gain * Math.fround(.1)) : gain
}

export function nativeRegionPointGain(
  position: Vector2,
  cameraCenter: Vector2,
  visibleWorldWidth: number,
  localPlayerAlternate: boolean,
): number {
  if (!(visibleWorldWidth > 0)) return 0
  const width = Math.fround(visibleWorldWidth)
  const distance = Math.fround(Math.hypot(
    Math.fround(position.x - cameraCenter.x),
    Math.fround(position.y - cameraCenter.y),
  ))
  const fullGainDistance = Math.fround(width * Math.fround(0.25))
  const zeroGainDistance = Math.fround(width * Math.fround(1.1))
  const gain = distance <= fullGainDistance
    ? 1
    : distance >= zeroGainDistance
      ? 0
      : Math.fround(
          Math.fround(zeroGainDistance - distance)
          / Math.fround(zeroGainDistance - fullGainDistance),
        )
  return localPlayerAlternate
    ? Math.fround(gain * Math.fround(0.1))
    : gain
}

export interface NativeRegionCameraShake {
  readonly attenuation: 'fixed' | 'point' | 'hit' | 'hit-squared'
  readonly displacement: Vector2
}

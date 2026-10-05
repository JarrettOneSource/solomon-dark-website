import { drawNativeUnitVector, type NativeRngState } from './native-rng.ts'

export function stepNativeExpandingWave(
  source: Readonly<{ radius: number; growth: number; scalar: number; life: number; fadeThreshold: number }>,
  rng: NativeRngState,
) {
  const radius = Math.fround(source.radius + source.growth)
  const vector = drawNativeUnitVector(rng)
  const displacement = {
    x: Math.fround(Math.fround(vector.value.x * 3) * source.scalar),
    y: Math.fround(Math.fround(vector.value.y * 3) * source.scalar),
  }
  const life = Math.fround(source.life - Math.fround(.01))
  return { radius, displacement, life, retain: life > 0, rng: vector.state,
    scalar: life < source.fadeThreshold ? Math.fround(source.scalar * Math.fround(.9)) : source.scalar }
}

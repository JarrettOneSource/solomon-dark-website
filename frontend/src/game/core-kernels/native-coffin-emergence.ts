import { drawNativeFloat, drawNativeInteger, type NativeRngState } from './native-rng.ts'
import type { NativeBoulderDebrisMotion } from './native-weld-boulder-debris.ts'

export interface NativeCoffinEmergenceParticle extends NativeBoulderDebrisMotion {
  readonly record: 1834 | 1835
  readonly scale: number
  readonly enhancedShadow: boolean
}

/** Coffin activation 0x0049A670, its twenty BoulderBits and BadGuys+0x4A18.
 * Native art-builder 0x004E3535 assigns exactly records 1834 and 1835. */
export function createNativeCoffinEmergence(source: NativeRngState,
  position: Readonly<{ x: number; y: number }>, scale: number, radius: number, enhanced: boolean): {
  particles: readonly NativeCoffinEmergenceParticle[]; rng: NativeRngState
} {
  if (!(scale > 0) || !Number.isFinite(scale) || !(radius > 0) || !Number.isFinite(radius)) {
    throw new RangeError('Coffin emergence requires its live native scale and radius')
  }
  let rng = source
  const float = (maximum: number, signed = false) => {
    const next = drawNativeFloat(rng, maximum, signed); rng = next.state; return next.value
  }
  let heading = float(360)
  const particles: NativeCoffinEmergenceParticle[] = []
  for (let i = 0; i < 20; i++) {
    const bounce = Math.fround(-(float(3) + 2))
    float(20)
    const rotationDegrees = float(360)
    const rotationStepDegrees = Math.fround(1 + float(10))
    const record = drawNativeInteger(rng, 2); rng = record.state
    const radians = heading * Math.PI / 180
    let velocity = { x: Math.fround(Math.sin(radians)), y: Math.fround(-Math.cos(radians) * Math.fround(.8)) }
    const verticalVelocity = Math.fround(Math.fround(Math.fround(Math.min(scale, 1) * float(1.5) + .75) * bounce) * .5)
    const height = Math.fround(-float(Math.fround(Math.min(scale, 1) * 50)))
    const distance = float(radius)
    const root = { x: Math.fround(position.x + Math.fround(velocity.x * distance)),
      y: Math.fround(position.y + Math.fround(velocity.y * distance)) }
    const size = Math.fround(Math.fround(.75 + float(.5)) * Math.fround(.8))
    const speed = Math.fround(1.5 + float(Math.fround(scale * 2)))
    velocity = { x: Math.fround(Math.fround(velocity.x * speed) * .75),
      y: Math.fround(Math.fround(velocity.y * speed) * .75) }
    particles.push({ alpha: enhanced ? 10 : 2, bounceVelocity: verticalVelocity,
      enhancedShadow: enhanced, height, position: root, record: record.value === 0 ? 1834 : 1835,
      rotationDegrees, rotationStepDegrees, scale: size, velocity, verticalVelocity })
    heading = Math.fround(heading + 18 + float(6, true))
  }
  return { particles, rng }
}

import { drawNativeFloat, drawNativeInteger, type NativeRngState } from './native-rng.ts'
import { createNativeWeldBoulderDebrisParticle, type NativeWeldBoulderDebrisParticleState } from './native-weld-boulder-debris.ts'

/** Golem 0x0061607A..0x00616487. Each of the four assembly milestones
 * creates 24 independently owned BoulderBits, not a new gameplay projectile. */
export function createNativeGolemAssemblyDebris(source: NativeRngState, scale: number, enhanced: boolean): {
  particles: readonly NativeWeldBoulderDebrisParticleState[]; rng: NativeRngState
} {
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('Golem scale must be positive')
  let rng = source
  const random = (maximum: number, signed = false) => {
    const draw = drawNativeFloat(rng, maximum, signed); rng = draw.state; return draw.value
  }
  const particles: NativeWeldBoulderDebrisParticleState[] = []
  for (let heading = 0; heading < 360; heading += 15) {
    const angle = Math.fround(heading + random(5, true)) * Math.PI / 180
    const bounceVelocity = Math.fround(-(random(3) + 2))
    random(20) // Constructor height is overwritten below.
    const rotationDegrees = random(360)
    const rotationStepDegrees = Math.fround(1 + random(10))
    const record = drawNativeInteger(rng, 3); rng = record.state
    const distance = random(25)
    const position = { x: Math.fround(Math.sin(angle) * distance), y: Math.fround(-Math.cos(angle) * distance) }
    // The native second heading conversion intentionally uses the radius
    // register, not the prior angular sample.
    const radians = distance * Math.PI / 180
    let velocity = { x: Math.fround(Math.sin(radians)), y: Math.fround(-Math.cos(radians) * Math.fround(.8)) }
    const verticalVelocity = Math.fround(bounceVelocity * Math.fround(
      Math.fround(Math.min(scale, 1) * random(1.5) + .75) * .5))
    const height = Math.fround(-random(Math.fround(Math.min(scale, 1) * 50)))
    const lead = random(30)
    position.x = Math.fround(position.x + Math.fround(velocity.x * lead))
    position.y = Math.fround(position.y + Math.fround(velocity.y * lead))
    let size = Math.fround(.45)
    const probe = Math.fround(Math.fround(.5 + random(.75)) * scale)
    if (probe >= size) size = Math.fround(Math.fround(.5 + random(.75)) * scale)
    size = Math.min(Math.fround(.75), size)
    size = Math.fround(size * Math.fround(.30000001192092896 + random(.34999996423721313)))
    const speed = Math.fround(1 + random(Math.fround(scale * .5)))
    velocity = { x: Math.fround(velocity.x * speed), y: Math.fround(velocity.y * speed) }
    particles.push({ ...createNativeWeldBoulderDebrisParticle({ alpha: 2, colorGreen: 1,
      height, index: particles.length, position, record: [2008, 2009, 2010][record.value] as 2008 | 2009 | 2010,
      rotationDegrees, rotationStepDegrees, scale: size, velocity, verticalVelocity,
    }, enhanced), bounceVelocity })
  }
  return { particles, rng }
}

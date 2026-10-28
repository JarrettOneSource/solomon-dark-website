import { drawNativeFloat, drawNativeUnitVector, type NativeRngState } from './native-rng.ts'
import { NATIVE_SPARKLE_TIMER, stepNativeSparkle, type NativeSparkleState } from './native-sparkle.ts'
import type { Vector2 } from './vector.ts'
import type { RegisterNativeWorldPainter } from './native-world-manager-order.ts'

export interface NativePlayerRescueProtection {
  readonly fraction: number
  readonly nextParticleId: number
  readonly particles: readonly NativeSparkleState[]
}

export function createNativePlayerRescueProtection(): NativePlayerRescueProtection {
  return { fraction: 0, nextParticleId: 1, particles: [] }
}

export function nativeRescueDamage(amount: number, protection: NativePlayerRescueProtection): number {
  return protection.fraction > 0 ? Math.fround(amount * (1 - protection.fraction)) : amount
}

export function stepNativePlayerRescueProtection(
  source: NativePlayerRescueProtection,
  context: Readonly<{ position: Vector2; register: RegisterNativeWorldPainter; worldKey: string }>,
  sourceRng: NativeRngState,
): Readonly<{ protection: NativePlayerRescueProtection; rng: NativeRngState }> {
  if (source.fraction <= 0 && source.particles.length === 0) {
    return { protection: source, rng: sourceRng }
  }
  const particles: NativeSparkleState[] = []
  for (const particle of source.particles) {
    const stepped = stepNativeSparkle(particle)
    if (stepped !== null) particles.push(stepped)
  }
  if (source.fraction <= 0) return { protection: { ...source, particles }, rng: sourceRng }
  // Retail subtracts this qword before its float store, including the final zero-alpha birth.
  const fraction = Math.max(0, Math.fround(source.fraction - 0.0024999999441206455))
  const radius = drawNativeFloat(sourceRng, 60)
  const vector = drawNativeUnitVector(radius.state)
  const angle = drawNativeFloat(vector.state, 360)
  const decay = drawNativeFloat(angle.state, 2)
  const position = context.position
  particles.push({
    alpha: fraction,
    decay: Math.fround(3 + decay.value),
    id: source.nextParticleId,
    position: {
      x: Math.fround(position.x + Math.fround(radius.value * vector.value.x)),
      y: Math.fround(Math.fround(position.y - 35) + Math.fround(radius.value * vector.value.y)),
    },
    painterRegistration: context.register('transient'),
    rotationDegrees: angle.value,
    timer: NATIVE_SPARKLE_TIMER,
    worldKey: context.worldKey,
  })
  return { protection: { fraction, nextParticleId: source.nextParticleId + 1, particles }, rng: decay.state }
}

export function copyNativePlayerRescueProtection(source: NativePlayerRescueProtection): NativePlayerRescueProtection {
  return { ...source, particles: source.particles.map(particle => ({ ...particle,
    painterRegistration: particle.painterRegistration === null ? null : { ...particle.painterRegistration },
    position: { ...particle.position } })) }
}

import { createNativeCoffinEmergence } from '../../core-kernels/native-coffin-emergence.ts'
import { stepNativeBoulderDebrisMotion } from '../../core-kernels/native-weld-boulder-debris.ts'
import type { BoneyardEnemyActor, BoneyardEnemyDeathEffect, WorkingStep } from './model.ts'

/** Twenty separately retained native particles, no gameplay actor admission. */
export function spawnCoffinEmergence(work: WorkingStep, actor: BoneyardEnemyActor, tick: number): void {
  const created = createNativeCoffinEmergence(work.steeringRngState, actor.position,
    actor.config.scale, actor.config.collisionRadius, work.enhancedEffects)
  work.steeringRngState = created.rng
  for (const child of created.particles) work.deathEffects.push({
    ageTicks: 0, alpha: 1, alphaMultiplier: 1, alphaLossPerTick: Math.fround(.025),
    angularVelocityDeg: child.rotationStepDegrees, atlas: 'BadGuys', blendMode: 'normal',
    bounceRetention: Math.fround(.3), bounceVelocity: child.bounceVelocity,
    entry: child.record, firstEntry: child.record, frameCount: 1, framePhase: 0,
    frameVelocity: 0, frameVelocityDamping: 1, frameTicks: 1, height: child.height,
    id: work.nextDeathEffectId++, kind: 'boulder-bit', lastStepTick: tick,
    lifetimeTicks: work.enhancedEffects ? 400 : 80, opacityTimer: child.alpha,
    ownerActorId: actor.id, painterRegistration: work.registerWorldPainter('transient'),
    presentationOwner: 'world-sorted', position: child.position, role: 'coffin-emergence-rock',
    rotationDeg: child.rotationDegrees, scale: child.scale, scaleY: child.scale, scaleMultiplier: 1,
    shadow: child.enhancedShadow, spawnTick: tick, tint: 0xffffff,
    verticalVelocity: child.verticalVelocity, velocity: child.velocity, velocityDamping: 1,
  })
}

export function stepCoffinEmergence(work: WorkingStep, source: BoneyardEnemyDeathEffect,
  tick: number): BoneyardEnemyDeathEffect | null {
  const result = stepNativeBoulderDebrisMotion({ alpha: source.opacityTimer,
    bounceVelocity: source.bounceVelocity, height: source.height, position: source.position,
    rotationDegrees: source.rotationDeg, rotationStepDegrees: source.angularVelocityDeg,
    velocity: source.velocity, verticalVelocity: source.verticalVelocity }, tick, work.steeringRngState)
  work.steeringRngState = result.rng
  const particle = result.particle
  return particle === null ? null : { ...source, ageTicks: tick - source.spawnTick, lastStepTick: tick,
    alpha: Math.min(1, particle.alpha), opacityTimer: particle.alpha,
    bounceVelocity: particle.bounceVelocity, height: particle.height, position: particle.position,
    rotationDeg: particle.rotationDegrees, angularVelocityDeg: particle.rotationStepDegrees,
    velocity: particle.velocity, verticalVelocity: particle.verticalVelocity }
}

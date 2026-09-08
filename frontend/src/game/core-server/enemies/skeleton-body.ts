import { actorHeadingFromVector } from '../../core-kernels/actor-heading.ts'
import { createNativeFirePatch } from '../../core-kernels/primary-spell-fire-effects.ts'
import type { BoneyardEnemyActor, BoneyardEnemyStoreStepContext, WorkingStep } from './model.ts'
import { createProjectileEffect } from './projectile-effects.ts'
import { drawEnemyFloat, drawEnemyInteger, drawEnemySign } from './random.ts'

export function spawnBurningSkeletonFire(work: WorkingStep, actor: BoneyardEnemyActor, tick: number): void {
  if (actor.lifeState !== 'alive' || !actor.config.burning
    || actor.config.baseSpeed * actor.staffMovementFactor === 0
    || (actor.brain.family !== 'skeleton' && actor.brain.family !== 'archer' && actor.brain.family !== 'mage')) return
  const copies = actor.brain.family === 'mage' ? 2 : 1
  for (let copy = 0; copy < copies; copy += 1) {
    if (drawEnemyInteger(work, 5) !== 3) continue
    const atlasPhase = drawEnemyFloat(work, 32)
    const horizontalSign = drawEnemySign(work, 1) < 0 ? -1 : 1
    const scale = Math.fround(.6000000238418579 + drawEnemyFloat(work, .3999999761581421))
    const life = Math.fround(.35)
    const position = { x: Math.fround(actor.position.x), y: Math.fround(actor.position.y) }
    const base = createProjectileEffect(work, { id: actor.id, ownerActorId: actor.id, ageTicks: 0 },
      tick, position, 'demon-fire', { alpha: life, atlas: 'DeadHawg', blendMode: 'add',
        entry: 46, lifetimeTicks: 36, scale })
    const fire = createNativeFirePatch({ id: base.id, burnDamage: 0, damage: actor.config.primaryDamage ?? 0,
      life, nativeType: 'fire', ownerId: `enemy:${actor.id}`, painterRegistration: base.painterRegistration,
      position, scale, worldKey: 'enemy-store' }, atlasPhase, horizontalSign)
    work.projectileEffects.push({ ...base, fire })
  }
}

export function detachSkeletonPike(actor: BoneyardEnemyActor): BoneyardEnemyActor {
  if (actor.brain.family !== 'skeleton' || actor.brain.pike === null) return actor
  return {
    ...actor,
    bodyPose: 0,
    headFacingOffset: 0,
    brain: { ...actor.brain, pike: null, actionProgress: 0,
      contactTargetPlayerId: null, markerEmitted: false, phase: 'approach' },
  }
}

export function stepLatchedSkeleton(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const brain = actor.brain
  if (brain.family !== 'skeleton' || brain.pike === null) return actor
  const pike = brain.pike
  const target = context.players[pike.playerId]
  const effect = context.abilityEffects?.[actor.id]
  if (!target?.alive || !target.connected || !target.eligible || target.summoned
    || actor.targetPlayerId === null || (effect?.dazzleTicks ?? 0) > 0
    || (effect?.disruptedTicks ?? 0) > 0) return detachSkeletonPike(actor)
  const dx = Math.fround(target.position.x - actor.position.x)
  const dy = Math.fround(target.position.y - actor.position.y)
  const distance = Math.fround(Math.hypot(dx, dy))
  actor = { ...actor, headingDeg: actorHeadingFromVector(dx, dy) }
  if (distance >= Math.fround(pike.distance * 1.5)) return detachSkeletonPike(actor)
  // 0x00484B90 writes the retained target root without a collision query.
  const factor = distance === 0 ? 0 : Math.fround(pike.distance / distance)
  const position = distance === pike.distance ? target.position : {
    x: Math.fround(actor.position.x + Math.fround(dx * factor)),
    y: Math.fround(actor.position.y + Math.fround(dy * factor)),
  }
  work.playerTargets[pike.playerId] = { ...target, position }
  work.playerPositions[pike.playerId] = position
  return { ...actor, brain: { ...brain, pike: { ...pike, position } } }
}

export function stepSkeletonRecoil(actor: BoneyardEnemyActor): BoneyardEnemyActor {
  const brain = actor.brain
  if (actor.config.baseSpeed * actor.staffMovementFactor === 0) return actor
  if ((brain.family !== 'skeleton' && brain.family !== 'archer' && brain.family !== 'mage')
    || (brain.verticalOffset === 0 && brain.verticalVelocity === 0)) return actor
  const offset = Math.fround(brain.verticalOffset + brain.verticalVelocity)
  return {
    ...actor,
    brain: {
      ...brain,
      verticalOffset: offset > 0 ? 0 : offset,
      verticalVelocity: offset > 0 ? 0 : Math.fround(brain.verticalVelocity + .3499999940395355),
    },
  }
}

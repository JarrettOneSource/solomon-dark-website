import { BONEYARD_WAVE_ENEMY_TYPES } from '../../core-kernels/boneyard-wave-director.ts'
import { NATIVE_PORTAL_ACTOR_PROGRAM, stepNativePortalState } from '../../core-kernels/native-survival-portal.ts'
import { emitEnemyActionSound } from './events.ts'
import type { BoneyardEnemyActor, BoneyardEnemyStoreStepContext, BoneyardPortalBrain, WorkingStep } from './model.ts'
import { drawUnit } from './random.ts'

export function stepPortal(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardPortalBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  // Portal::Tick settles its placement body before capturing +0x218/+0x21C.
  if (brain.ageTicks < NATIVE_PORTAL_ACTOR_PROGRAM.materializationTicks) {
    actor = { ...actor, position: context.resolveMovement({
      actorId: actor.id, delta: { x: 0, y: 0 }, position: actor.position,
      purpose: 'movement', radius: NATIVE_PORTAL_ACTOR_PROGRAM.placementCollisionRadius,
      requestedPosition: actor.position,
    }) }
  }
  const stepped = stepNativePortalState(
    brain,
    actor.config.enemyToken === 'PORTAL' ? actor.config.family.frequency : 0,
    () => drawUnit(work),
  )
  const anchorPosition = stepped.opened ? Object.freeze({ ...actor.position }) : brain.anchorPosition
  if (stepped.opened) {
    emitEnemyActionSound(work, context.tick, actor, 'portal-open', 1, 0.5)
  }
  if (stepped.ejection !== null) {
    emitEnemyActionSound(work, context.tick, actor, 'fireball-hit', 1)
    work.pendingSpawnIntents.push(Object.freeze({
      enemyToken: 'IMP',
      flags: Object.freeze([]),
      id: work.nextSyntheticSpawnIntentId,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.IMP,
      portalEjection: Object.freeze({
        childHeadingDeg: stepped.ejection.childHeadingDeg,
        inheritedPrimaryDamage: actor.config.primaryDamage ?? 0,
        parentHeadingDeg: actor.headingDeg,
        parentPosition: Object.freeze({ ...actor.position }),
        verticalVelocity: stepped.ejection.verticalVelocity,
      }),
      position: Object.freeze({ ...actor.position }),
      positionPolicy: 'direct',
      spawnTick: context.tick,
      waveOrdinal: actor.waveOrdinal,
    }))
    work.nextSyntheticSpawnIntentId += 1
  }
  return {
    ...actor,
    // External MoveByDelta impulses do not replace the native settled root.
    position: anchorPosition ?? actor.position,
    bodyPose: stepped.state.bodyPhase,
    brain: {
      ...stepped.state,
      anchorPosition,
      family: 'portal',
      hurtTicksRemaining: Math.max(0, brain.hurtTicksRemaining - 1),
      phase: 'active',
    },
    gaitPose: stepped.state.auraPhase,
    stridePhaseDeg: stepped.state.fixedScale,
  }
}

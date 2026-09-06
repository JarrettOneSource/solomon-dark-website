import { emitEnemyActionSound } from './events.ts'
import {
  NATIVE_DEMON_ROOT_SNAP_DISTANCE,
  nativeDemonArticulationRoot,
  nativeDemonBombLaunchPosition,
  stepNativeDemonArticulation,
} from '../../core-kernels/boneyard-demon-articulation.ts'
import { attackMarker } from './combat.ts'
import type {
  BoneyardDemonBrain,
  BoneyardEnemyActor,
  BoneyardEnemyStoreStepContext,
  WorkingStep,
} from './model.ts'
import { moveTowardTarget, staffAttackSpeed } from './movement.ts'
import { BOUNDED_ENEMY_ATTACK_REACH, NATIVE_DEMON_BOMB_ACTION_PROGRAM } from './programs.ts'
import { spawnProjectile } from './projectile-emission.ts'
import { drawEnemyFloat, drawEnemySign } from './random.ts'
import { targetWithinAttackReach } from './targeting.ts'

export function stepDemon(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardDemonBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.targetPlayerId === null) {
    const reset = resetDemon(actor, brain)
    return advanceDemonArticulation(
      moveTowardTarget(work, reset, reset.brain, context, 1),
      context.tick,
    )
  }
  if (brain.phase === 'bomb') {
    const previousProgress = brain.actionProgress
    const nextProgress = previousProgress
      + NATIVE_DEMON_BOMB_ACTION_PROGRAM.progressPerTick * staffAttackSpeed(actor)
    let markerEmitted = brain.markerEmitted
    if (
      !markerEmitted
      && previousProgress < NATIVE_DEMON_BOMB_ACTION_PROGRAM.markerProgress
      && nextProgress >= NATIVE_DEMON_BOMB_ACTION_PROGRAM.markerProgress
    ) {
      attackMarker(work, actor, context.tick)
      emitEnemyActionSound(work, context.tick, actor, 'spit-fire', Math.fround(1 + drawEnemyFloat(work, 0.1, true)))
      // Raw Anim_FireBurst constructor: rotation, angular magnitude, sign.
      drawEnemyFloat(work, 360)
      drawEnemySign(work, Math.fround(0.5 + drawEnemyFloat(work, 1)))
      spawnProjectile(
        work,
        actor,
        context.tick,
        'demon-bomb',
        actor.config.primaryDamage ?? 0,
        { position: nativeDemonBombLaunchPosition(brain.articulation, actor.headingDeg) },
      )
      markerEmitted = true
    }
    if (nextProgress > NATIVE_DEMON_BOMB_ACTION_PROGRAM.strictEnd) {
      return {
        ...actor,
        brain: {
          ...brain,
          actionProgress: 0,
          markerEmitted: false,
          phase: 'approach',
        },
      }
    }
    return { ...actor, brain: { ...brain, actionProgress: nextProgress, markerEmitted } }
  }
  if (targetWithinAttackReach(actor, context.players, BOUNDED_ENEMY_ATTACK_REACH.DEMON)) {
    return {
      ...actor,
      brain: { ...brain, actionProgress: 0, markerEmitted: false, phase: 'bomb' },
    }
  }
  return advanceDemonArticulation(
    moveTowardTarget(work, actor, brain, context, 1),
    context.tick,
  )
}

function advanceDemonArticulation(
  actor: BoneyardEnemyActor,
  tick: number,
): BoneyardEnemyActor {
  if (
    actor.brain.family !== 'demon'
    || actor.brain.phase !== 'approach'
    || actor.config.scale <= 0
  ) return actor
  return {
    ...actor,
    brain: {
      ...actor.brain,
      articulation: stepNativeDemonArticulation(actor.brain.articulation, {
        active: true,
        actorId: actor.id,
        headingDeg: actor.headingDeg,
        position: actor.position,
        scale: actor.config.scale,
        spawnTick: actor.spawnTick,
        tick,
      }),
    },
  }
}

export function snapDemonRootToExtremities(actor: BoneyardEnemyActor): BoneyardEnemyActor {
  if (actor.brain.family !== 'demon') return actor
  const root = nativeDemonArticulationRoot(actor.brain.articulation)
  const deltaX = root.x - actor.position.x
  const deltaY = root.y - actor.position.y
  return deltaX * deltaX + deltaY * deltaY <= NATIVE_DEMON_ROOT_SNAP_DISTANCE ** 2
    ? actor
    : { ...actor, position: root }
}

export function resetDemon(actor: BoneyardEnemyActor, brain: BoneyardDemonBrain): BoneyardEnemyActor {
  return brain.phase === 'approach' ? actor : {
    ...actor,
    brain: {
      ...brain,
      actionProgress: 0,
      markerEmitted: false,
      phase: 'approach',
    },
  }
}

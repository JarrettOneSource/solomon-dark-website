import { actorHeadingFromVector } from '../../core-kernels/actor-heading.ts'
import { prepareNativeDemonSkullTick, stepNativeDemonSkullController } from '../../core-kernels/native-demon-skull.ts'
import { beginDemonSkullAction, stepDemonSkullActions } from './demon-skull-actions.ts'
import { emitEnemyActionSound, emitEvent } from './events.ts'
import type {
  BoneyardDemonSkullActor,BoneyardDemonSkullBrain,BoneyardEnemyActor,
  BoneyardEnemyStoreStepContext,WorkingStep
} from './model.ts'
import { interruptNativeSecondaryAction, moveTowardTarget } from './movement.ts'
import { randomEnemyOffset as randomOffset } from './random.ts'
import { reorientEnemyTowardTarget, targetEligible } from './targeting.ts'

export function stepDemonSkull(work: WorkingStep, source: BoneyardEnemyActor, sourceBrain: BoneyardDemonSkullBrain,
  context: BoneyardEnemyStoreStepContext, authoredAttackSpeed: number): BoneyardEnemyActor {
  if (source.config.enemyToken !== 'DEMONSKULL') throw new Error('DemonSkull brain requires DemonSkull config')
  const admitted = context.nativeVisibility?.(source.position).admitted ?? true
  let actor: BoneyardDemonSkullActor = { ...source, config: source.config,
    brain: { ...sourceBrain, ...prepareNativeDemonSkullTick(sourceBrain, admitted) } }
  const effect = context.abilityEffects?.[actor.id]
  const disrupted = (effect?.disruptedTicks ?? 0) > 0
  const fleeing = (effect?.fleeTicks ?? 0) > 0
  const active = (effect?.timeScale ?? 1) >= 9.999999747378752e-05
  if (disrupted || fleeing) {
    const interrupted = interruptNativeSecondaryAction(actor)
    if (interrupted.brain.family !== 'demon-skull') throw new Error('DemonSkull interruption lost its owner')
    actor = { ...actor, brain: interrupted.brain }
  }
  if (active && !disrupted) {
    if (actor.brain.actions.length > 0) actor = stepDemonSkullActions(work, actor, context)
    else {
      const moved = actor.path.reorientationTicksRemaining > 0 ? reorientEnemyTowardTarget(actor, context.players)
        : moveTowardTarget(work, actor, actor.brain, context, fleeing ? -1 : 1)
      actor = { ...actor, ...moved, config: actor.config, brain: actor.brain }
      const target = actor.targetPlayerId === null ? null : context.players[actor.targetPlayerId]
      if (!actor.brain.screamActive && !fleeing && actor.path.reorientationTicksRemaining === 0 && target && targetEligible(target)
        && (target.position.x - actor.position.x) ** 2 + (target.position.y - actor.position.y) ** 2 < 120 ** 2
        && clearLine(context, actor, target.position)) {
        actor = { ...actor, headingDeg: actorHeadingFromVector(target.position.x - actor.position.x,
          target.position.y - actor.position.y) }
        actor = beginDemonSkullAction(work, actor, 'bite', context, authoredAttackSpeed)
      }
    }
  }
  const recoil = actor.brain.recoil
  if (recoil.x ** 2 + recoil.y ** 2 > 1) {
    const position = context.resolveMovement({ actorId: actor.id, position: actor.position,
      delta: recoil, radius: actor.config.collisionRadius, purpose: 'movement',
      requestedPosition: { x: actor.position.x + recoil.x, y: actor.position.y + recoil.y } })
    actor = { ...actor, position, brain: { ...actor.brain,
      recoil: { x: Math.fround(recoil.x * .5), y: Math.fround(recoil.y * .5) } } }
  } else actor = { ...actor, brain: { ...actor.brain, recoil: { x: 0, y: 0 } } }
  const target = actor.targetPlayerId === null ? null : context.players[actor.targetPlayerId]
  const liveTarget = target && targetEligible(target) ? target : null
  const result = stepNativeDemonSkullController(actor.brain, work.steeringRngState, {
    alternatePlayer: false, hasAction: actor.brain.actions.length > 0, headingDeg: actor.headingDeg,
    healthRatio: actor.currentHealth / actor.config.maximumHealth,
    lineOfSight: liveTarget !== null && clearLine(context, actor, liveTarget.position),
    movementScale: actor.config.scale,
    screamPlaying: work.demonSkullEncounter.screamStreamTicksRemaining > 0,
    targetDistanceSquared: liveTarget === null ? null : (liveTarget.position.x - actor.position.x) ** 2
      + (liveTarget.position.y - actor.position.y) ** 2,
  })
  work.steeringRngState = result.rng
  actor = { ...actor, brain: { ...actor.brain, ...result.state },
    lootSeed: result.incrementAttackSeed ? (actor.lootSeed + 1) >>> 0 : actor.lootSeed }
  if (result.beginAction !== null) actor = beginDemonSkullAction(work, actor, result.beginAction, context, authoredAttackSpeed)
  if (result.landing) emitEnemyActionSound(work, context.tick, actor, 'jaw', 1)
  if (result.screamShake) emitEvent(work, context.tick, 'enemy-camera-shake', actor.id, {
    sourcePosition: actor.position, cameraShake: { attenuation: 'hit', displacement: randomOffset(work, 8) } })
  return { ...actor, bodyPose: actor.brain.bodyPose,
    brain: { ...actor.brain, phase: actor.brain.actions.length === 0 ? 'range-control' : 'cast' } }
}

function clearLine(context: BoneyardEnemyStoreStepContext, actor: BoneyardDemonSkullActor,
  end: Readonly<{ x: number; y: number }>): boolean {
  return !context.projectileWorldBlocked({ kind: 'line', nativeExclusionMask: 0x380,
    start: actor.position, end, radius: 0, projectileId: actor.id })
}

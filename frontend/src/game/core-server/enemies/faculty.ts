import {
  actorHeadingFromVector,
} from '../../core-kernels/actor-heading.ts'
import {
  advanceNativeFacultyOrbit,
  stepNativeFaculty,
} from '../../core-kernels/native-faculty.ts'
import {
  spawnFacultySpell,
} from './boss-spells.ts'
import {
  emitEnemyActionSound,
  emitEvent,
} from './events.ts'
import {
  spawnFacultySmoke,
} from './faculty-death.ts'
import {
  type BoneyardEnemyActor,
  type BoneyardEnemyStoreStepContext,
  type BoneyardFacultyBrain,
  type WorkingStep,
} from './model.ts'
import {
  interruptNativeSecondaryAction,
  moveTowardTarget,
  staffAttackSpeed,
} from './movement.ts'
import { drawEnemyFloat } from './random.ts'
import {
  reorientEnemyTowardTarget,
  targetEligible,
} from './targeting.ts'

export function stepFaculty(work: WorkingStep, source: BoneyardEnemyActor, brain: BoneyardFacultyBrain,
  context: BoneyardEnemyStoreStepContext): BoneyardEnemyActor {
  if (source.config.enemyToken !== 'DIREFACULTY') throw new Error('Faculty brain requires Faculty config')
  const orbit = advanceNativeFacultyOrbit(source.path, brain.orbitSign, work.steeringRngState)
  work.steeringRngState = orbit.rng
  const effect = context.abilityEffects?.[source.id]
  const disrupted = (effect?.disruptedTicks ?? 0) > 0
  const fleeing = (effect?.fleeTicks ?? 0) > 0
  const frozen = staffAttackSpeed(source) < 9.999999747378752e-05
  const reorienting = source.path.reorientationTicksRemaining > 0
  let moved = { ...source, path: orbit.path }
  if (disrupted || fleeing) moved = interruptNativeSecondaryAction(moved)
  if (moved.brain.family !== 'faculty') throw new Error('Faculty action lost its owner')
  const activeBrain = moved.brain
  if (!disrupted && !frozen) {
    if (reorienting) moved = reorientEnemyTowardTarget(moved, context.players)
    else if (fleeing) moved = moveTowardTarget(work, moved, activeBrain, context, -1)
    else if (activeBrain.action === null) moved = moveTowardTarget(work, moved, activeBrain, context, 1)
  }
  const advanceAction = !disrupted && !frozen && !fleeing && !reorienting
  const target = source.targetPlayerId === null ? null : context.players[source.targetPlayerId]
  const liveTarget = target && targetEligible(target) ? target : null
  const dx = liveTarget === null ? 0 : liveTarget.position.x - moved.position.x
  const dy = liveTarget === null ? 0 : liveTarget.position.y - moved.position.y
  let actor = moved
  const clipped = liveTarget === null ? null : context.clipSpellSegment?.({
    start: actor.position, end: liveTarget.position,
  }) ?? liveTarget.position
  const result = stepNativeFaculty(activeBrain, work.steeringRngState, source.config.family.primary, {
    advanceAction,
    actorTimeScale: staffAttackSpeed(source),
    lineOfSight: liveTarget !== null && clipped !== null
      && Math.hypot(clipped.x - liveTarget.position.x, clipped.y - liveTarget.position.y) < .0001,
    targetDistanceSquared: liveTarget === null ? null : dx * dx + dy * dy,
    tick: context.tick,
  })
  work.steeringRngState = result.rng
  if (advanceAction && activeBrain.action?.kind === 'lightning' && liveTarget !== null) {
    actor = { ...actor, headingDeg: result.state.headingLocked ? source.headingDeg
      : actorHeadingFromVector(dx + liveTarget.velocityPerTick.x * 65, dy + liveTarget.velocityPerTick.y * 65 - 25) }
  }
  spawnFacultySmoke(work, actor, context.tick, 'living')
  const cameraAngle = drawEnemyFloat(work, 360) * Math.PI / 180
  emitEvent(work, context.tick, 'enemy-camera-shake', actor.id, {
    sourcePosition: actor.position, cameraShake: { attenuation: 'hit-squared',
      displacement: { x: Math.fround(Math.sin(cameraAngle)), y: Math.fround(-Math.cos(cameraAngle)) } },
  })
  if (result.marker && activeBrain.action?.kind === 'lightning') {
    emitEnemyActionSound(work, context.tick, actor, 'lightning-start', .5)
    emitEnemyActionSound(work, context.tick, actor, 'lightning-start', .75)
    emitEnemyActionSound(work, context.tick, actor, 'flame-lash-start', 1)
    emitEvent(work, context.tick, 'enemy-screen-flash', actor.id, { sourcePosition: actor.position,
      screenFlash: { red: 0, green: 0, blue: 0, alpha: 1, decayPerTick: .025, pointAttenuated: true } })
  }
  if (result.dispatch !== null) spawnFacultySpell(work, { ...actor, bodyPose: result.state.bodyPose,
    brain: { ...activeBrain, ...result.state,
      bodyHeadingDeg: result.state.headingLocked || liveTarget === null ? actor.headingDeg : actorHeadingFromVector(dx, dy) },
  }, result.dispatch, context)
  return { ...actor, bodyPose: result.state.bodyPose, brain: {
    ...activeBrain, ...result.state,
    bodyHeadingDeg: result.state.headingLocked || liveTarget === null ? actor.headingDeg : actorHeadingFromVector(dx, dy),
    phase: result.state.action === null ? 'range-control' : 'cast',
  } }
}

import {
  actorHeadingFromVector,
} from '../../core-kernels/actor-heading.ts'
import {
  BONEYARD_WAVE_ENEMY_TYPES,
} from '../../core-kernels/boneyard-wave-schema.ts'
import {
  stepNativeCrow,
} from '../../core-kernels/native-crow.ts'
import {
  detachNativeHeartmongerCrows,
  stepNativeHeartmonger,
} from '../../core-kernels/native-heartmonger.ts'
import {
  drawNativeFloat,
  drawNativeFloatRange,
  drawNativeInteger,
  drawNativeSign,
} from '../../core-kernels/native-rng.ts'
import {
  attackMarker,
  directPlayerDamage,
} from './combat.ts'
import {
  emitEnemyActionSound,
  emitEvent,
} from './events.ts'
import {
  type BoneyardEnemyActor,
  type BoneyardEnemyStoreStepContext,
  type BoneyardHeartmongerBrain,
  type WorkingStep,
} from './model.ts'
import {
  moveTowardTarget,
  staffMovementSpeed,
} from './movement.ts'
import {
  reorientEnemyTowardTarget,
  targetEligible,
} from './targeting.ts'

export function stepHeartmonger(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardHeartmongerBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (actor.config.enemyToken !== 'HEARTMONGER') throw new Error('Heartmonger brain requires Heartmonger config')
  const visibility = context.nativeVisibility?.(actor.position) ?? { admitted: true, intensity: 1 }
  const step = stepNativeHeartmonger(brain, work.steeringRngState, actor.config.family.summonMode, {
    admitted: visibility.admitted,
    isVisible: context.projectedPointVisible ?? (() => true),
    lightIntensity: visibility.intensity,
    position: actor.position,
    targets: Object.entries(context.players).filter(([, target]) => targetEligible(target))
      .map(([id, target]) => ({ id, position: target.position })),
  })
  work.steeringRngState = step.rng
  for (const sound of step.sounds) {
    emitEnemyActionSound(work, context.tick, { id: actor.id, position: sound.position }, sound.sound, sound.pitch)
  }
  for (const targetId of step.struckTargetIds) {
    emitEvent(work, context.tick, 'enemy-screen-flash', actor.id, {
      sourcePosition: actor.position, screenFlash: { alpha: 1, red: 0, green: 0, blue: 0,
        decayPerTick: Math.fround(.1), pointAttenuated: false },
    })
    directPlayerDamage(work, actor, targetId, attackMarker(work, actor, context.tick, targetId))
  }
  for (const summon of step.summons) {
    for (let index = 0; index < summon.count; index += 1) {
      work.pendingSpawnIntents.push({
        enemyToken: summon.enemyToken,
        flags: summon.flags,
        id: work.nextSyntheticSpawnIntentId++,
        locationPolicy: 'anywhere',
        nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[summon.enemyToken],
        position: actor.position,
        positionPolicy: 'dark',
        spawnTick: context.tick,
        waveOrdinal: actor.waveOrdinal,
      })
    }
  }
  let path = { ...actor.path, flankTicksRemaining: 100 }
  if ((context.tick - actor.spawnTick - 1) % 1000 === 0) {
    const target = actor.targetPlayerId === null ? null : context.players[actor.targetPlayerId]
    let angle: number
    if (target) {
      const side = drawNativeInteger(work.steeringRngState, 2)
      work.steeringRngState = side.state
      const sign = side.value === 1 ? -1 : 1
      angle = actorHeadingFromVector((target.position.y - actor.position.y) * sign,
        -(target.position.x - actor.position.x) * sign)
    } else {
      const magnitude = drawNativeFloatRange(work.steeringRngState, 45, 135)
      const direction = drawNativeSign(magnitude.state, magnitude.value)
      work.steeringRngState = direction.state
      angle = direction.value
    }
    const radius = drawNativeFloatRange(work.steeringRngState, 150, 250)
    work.steeringRngState = radius.state
    path = { ...path, flankAngleDeg: angle, flankRadius: radius.value }
  }
  const effect = context.abilityEffects?.[actor.id]
  let moved = { ...actor, path }
  if (actor.lifeState === 'alive' && (effect?.timeScale ?? 1) >= 9.999999747378752e-05 && (effect?.disruptedTicks ?? 0) === 0) {
    moved = actor.path.reorientationTicksRemaining > 0 ? reorientEnemyTowardTarget(moved, context.players)
      : moveTowardTarget(work, moved, brain, context, (effect?.fleeTicks ?? 0) > 0 ? -1 : 1)
  }
  const distance = Math.hypot(moved.position.x - actor.position.x, moved.position.y - actor.position.y)
  const movementScale = actor.config.chaseSpeed * staffMovementSpeed(actor)
  const phaseStep = movementScale === 0 ? 0 : Math.fround(distance / movementScale * .25)
  let legPhase = Math.fround(brain.legPhase + phaseStep)
  if (legPhase >= 10) legPhase = Math.fround(legPhase - 10)
  const torsoStep = Math.fround(phaseStep * .8500000238418579 * .25)
  const variation = drawNativeFloat(work.steeringRngState, Math.fround(torsoStep * .25), true)
  work.steeringRngState = variation.state
  let torsoPhase = Math.fround(Math.fround(brain.torsoPhase + torsoStep) + variation.value)
  if (torsoPhase >= 3) {
    const sound = drawNativeInteger(work.steeringRngState, 2)
    work.steeringRngState = sound.state
    emitEnemyActionSound(work, context.tick, moved, sound.value === 0 ? 'chain-clank-1' : 'chain-clank-2', 1)
    torsoPhase = Math.fround(torsoPhase - 3)
  }
  return {
    ...moved,
    bodyPose: Math.trunc(torsoPhase),
    brain: { ...brain, ...step.state, legPhase, torsoPhase, crows: step.state.crows.map((crow) => ({
      ...crow, lightIntensity: crow.position === null ? 0 : context.nativeVisibility?.(crow.position).intensity ?? 1,
    })) },
  }
}

export function detachHeartmongerCrows(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): void {
  if (actor.brain.family !== 'heartmonger') return
  const detached = detachNativeHeartmongerCrows(actor.brain, work.steeringRngState,
    actor.position, work.nextDeathEffectId++)
  work.steeringRngState = detached.rng
  for (const flight of detached.crows) {
    work.detachedCrows.push({ flight, ownerActorId: actor.id,
      spawnTick: context.tick })
  }
  emitEnemyActionSound(work, context.tick, actor, 'wings', 1)
}

export function stepDetachedCrows(work: WorkingStep, context: BoneyardEnemyStoreStepContext): void {
  work.detachedCrows = work.detachedCrows.flatMap((source) => {
    const step = stepNativeCrow(source.flight, work.steeringRngState, null, false, [],
      context.projectedPointVisible ?? (() => true))
    work.steeringRngState = step.rng
    return step.crow === null ? [] : [{ ...source, flight: { ...step.crow,
      lightIntensity: context.nativeVisibility?.(step.crow.position!).intensity ?? 1,
    } }]
  })
}

export function spawnHeartmongerDeparture(work: WorkingStep, actor: BoneyardEnemyActor, tick: number): void {
  emitEnemyActionSound(work, tick, actor, 'chain-clank-1', 1)
  emitEnemyActionSound(work, tick, actor, 'chain-clank-2', 1)
  emitEvent(work, tick, 'enemy-stream', actor.id, { stream: 'heart-break', sourcePosition: actor.position })
  const common = { ageTicks: 0, damage: 0, ownerActorId: actor.id, position: actor.position, spawnTick: tick }
  work.bossSpells.push({ ...common, id: work.nextProjectileId++, painterRegistration: work.registerWorldPainter('transient'),
    kind: 'heartmonger-flicker', phaseDeg: 0 })
  const bob = drawNativeFloat(work.steeringRngState, 360)
  work.steeringRngState = bob.state
  work.bossSpells.push({ ...common, id: work.nextProjectileId++, painterRegistration: work.registerWorldPainter('transient'),
    kind: 'heartmonger-soul', bobPhaseDeg: bob.value, lifePhaseDeg: 0 })
}

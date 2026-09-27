import { clearNativeEnemyRoute, nativeEnemyMovementClock, stepNativeEnemyPathRecovery } from '../../core-kernels/native-enemy-pathfinding.ts'
import {
  NATIVE_WRAITH_FLYBY_TICKS,
  nativeWraithContactContains,
  nativeWraithDegradedMovement,
  nativeWraithMovement,
  resetNativeWraithFlightAfterContact,
  stepNativeWraithFlightClock,
} from '../../core-kernels/native-wraith-flight.ts'
import { attackMarker, directPlayerDamage } from './combat.ts'
import { spawnSimpleDeathEffect } from './death-effects.ts'
import type { BoneyardEnemyActor, BoneyardEnemyStoreStepContext, BoneyardWraithBrain, WorkingStep } from './model.ts'
import { routeNativeEnemyGoal } from './movement.ts'
import { drawEnemyFloat, drawEnemyInteger, drawInteger, drawUnit, radialVector } from './random.ts'
import { reorientEnemyTowardTarget, targetEligible } from './targeting.ts'

export function spawnWraithWisp(work: WorkingStep, actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext): void {
  if (actor.lifeState !== 'alive' || actor.brain.family !== 'wraith'
    || context.nativeVisibility?.(actor.position).admitted === false) return
  const roll = drawEnemyInteger(work, 4)
  if (roll !== 1 && actor.brain.contactCooldownTicks <= 0) return
  const offset = radialVector(actor.headingDeg, 30)
  spawnSimpleDeathEffect(work, actor, context.tick, {
    alpha: Math.fround(.25 + drawEnemyFloat(work, .20000000298023224)),
    alphaLossPerTick: Math.fround(.10000000149011612 * .15000000596046448),
    atlas: 'BadGuys', blendMode: 'add', entry: 21, kind: 'fade-additive',
    lifetimeTicks: 32, position: { x: Math.fround(actor.position.x - offset.x),
      y: Math.fround(actor.position.y - 15 - offset.y) },
    presentationOwner: 'pre-world-queue', role: 'wraith-soul-wisp',
    rotationDeg: actor.headingDeg, scale: 1,
  })
}

export function stepWraith(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardWraithBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const admitted = context.nativeVisibility?.(actor.position).admitted ?? true
  const clockedBrain: BoneyardWraithBrain = {
    ...stepNativeWraithFlightClock(brain, admitted),
    family: 'wraith',
    phase: 'flight',
  }
  const moved = moveWraith(work, { ...actor, brain: clockedBrain }, clockedBrain, context, admitted)
  const target = moved.targetPlayerId === null
    ? null
    : context.players[moved.targetPlayerId] ?? null
  if (
    target === null
    || !targetEligible(target)
    || !nativeWraithContactContains(moved.position, target.position)
  ) return moved

  if (clockedBrain.contactCooldownTicks === 0) {
    drawUnit(work) // Native contact sound pitch Float(.25).
    const eventId = attackMarker(work, moved, context.tick, moved.targetPlayerId)
    directPlayerDamage(work, moved, moved.targetPlayerId, eventId)
    drawUnit(work) // Native contact effect phase Float(1).
  }
  const flybyTickOffset = drawInteger(work, NATIVE_WRAITH_FLYBY_TICKS.randomCount)
  const turnGainUnit = drawUnit(work)
  return {
    ...moved,
    brain: {
      ...resetNativeWraithFlightAfterContact(
        clockedBrain,
        flybyTickOffset,
        turnGainUnit,
      ),
      family: 'wraith',
      phase: 'flight',
    },
  }
}

function moveWraith(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardWraithBrain,
  context: BoneyardEnemyStoreStepContext,
  admitted: boolean,
): BoneyardEnemyActor {
  const statusFactor = work.pathStatusFactors.get(actor.id) ?? 1
  if (statusFactor <= Math.fround(0.0001)) return actor
  const view = context.nativeMovementView
  const visible = view === undefined || view.cameras.some(camera => (
    actor.position.x + 100 >= camera.x && actor.position.x - 100 <= camera.x + camera.w
    && actor.position.y + 100 >= camera.y && actor.position.y - 100 <= camera.y + camera.h
  ))
  const clock = nativeEnemyMovementClock(actor.id, context.tick, visible, admitted, view?.enhancedEffects ?? true)
  if (!clock.due || (context.abilityEffects?.[actor.id]?.disruptedTicks ?? 0) > 0) return actor
  if (actor.path.reorientationTicksRemaining > 0) return reorientEnemyTowardTarget(actor, context.players)
  const target = actor.targetPlayerId === null
    ? null
    : context.players[actor.targetPlayerId] ?? null
  const targetPosition = target && targetEligible(target) ? target.position : null
  const request = {
    actorId: actor.id,
    actorHeadingDeg: actor.headingDeg,
    actorPosition: actor.position,
    pathSpeedFactor: actor.path.speedFactor,
    pathTurnFactor: actor.path.turnFactor,
    cadenceTicks: clock.cadence,
    state: brain,
    statusFactor,
    targetPosition,
  }
  let path = clearNativeEnemyRoute(actor.path)
  let movement
  if (clock.full) {
    movement = nativeWraithMovement(request)
  } else {
    const wander = radialVector(actor.id * 225,
      actor.path.speedFactor * brain.currentSpeed * statusFactor * clock.cadence * .25)
    const rawGoal = targetPosition ?? { x: actor.position.x + wander.x, y: actor.position.y + wander.y }
    const routed = routeNativeEnemyGoal(actor, rawGoal, targetPosition, context, clock.cadence)
    path = routed.actor.path
    movement = nativeWraithDegradedMovement({ ...request, goalPosition: routed.goal,
      actorHeadingDeg: actor.headingDeg + (routed.turnAround ? 180 : 0) })
  }
  const requestedPosition = Object.freeze({
    x: Math.fround(actor.position.x + movement.delta.x),
    y: Math.fround(actor.position.y + movement.delta.y),
  })
  const traveled = Math.hypot(movement.delta.x, movement.delta.y)
  const pathAfterSubsteps = path.flankTicksRemaining > 0
    ? Object.freeze({
        ...path,
        flankTicksRemaining: Math.max(
          0,
          path.flankTicksRemaining - clock.cadence,
        ),
      })
    : path
  const recovery = stepNativeEnemyPathRecovery(
    pathAfterSubsteps,
    work.steeringRngState,
    {
      flankingEnabled: actor.config.flanking,
      requestedDistance: Math.hypot(movement.delta.x, movement.delta.y),
      statusFactor,
      tick: context.tick,
      traveledDistance: traveled,
    },
  )
  work.steeringRngState = recovery.rngState
  return {
    ...actor,
    brain,
    headingDeg: movement.headingDeg,
    lastMovementTick: traveled === 0 ? actor.lastMovementTick : context.tick,
    nextMovementTick: context.tick + clock.cadence,
    path: recovery.state,
    position: requestedPosition,
  }
}

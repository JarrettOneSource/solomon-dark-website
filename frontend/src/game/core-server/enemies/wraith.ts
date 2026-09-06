import {
  clearNativeEnemyRoute,
  stepNativeEnemyPathRecovery,
} from '../../core-kernels/native-enemy-pathfinding.ts'
import {
  NATIVE_WRAITH_FLYBY_TICKS,
  nativeWraithContactContains,
  nativeWraithMovement,
  resetNativeWraithFlightAfterContact,
  stepNativeWraithFlightClock,
} from '../../core-kernels/native-wraith-flight.ts'
import { attackMarker, directPlayerDamage } from './combat.ts'
import type {
  BoneyardEnemyActor,
  BoneyardEnemyStoreStepContext,
  BoneyardWraithBrain,
  WorkingStep,
} from './model.ts'
import { NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS } from './programs.ts'
import { drawInteger, drawUnit } from './random.ts'
import { targetEligible } from './targeting.ts'

export function stepWraith(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardWraithBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const clockedBrain: BoneyardWraithBrain = {
    ...stepNativeWraithFlightClock(brain),
    family: 'wraith',
    phase: 'flight',
  }
  const moved = moveWraith(work, { ...actor, brain: clockedBrain }, clockedBrain, context)
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
): BoneyardEnemyActor {
  if (context.tick < actor.nextMovementTick) return actor
  const statusFactor = work.pathStatusFactors.get(actor.id) ?? 1
  const target = actor.targetPlayerId === null
    ? null
    : context.players[actor.targetPlayerId] ?? null
  const movement = nativeWraithMovement({
    actorAgeTicks: Math.max(0, context.tick - actor.spawnTick),
    actorHeadingDeg: actor.headingDeg,
    actorPosition: actor.position,
    pathSpeedFactor: actor.path.speedFactor,
    pathTurnFactor: actor.path.turnFactor,
    state: brain,
    statusFactor,
    targetPosition: target && targetEligible(target) ? target.position : null,
  })
  const requestedPosition = Object.freeze({
    x: actor.position.x + movement.delta.x,
    y: actor.position.y + movement.delta.y,
  })
  const traveled = Math.hypot(movement.delta.x, movement.delta.y)
  const pathWithoutRoute = clearNativeEnemyRoute(actor.path)
  const pathAfterSubsteps = pathWithoutRoute.flankTicksRemaining > 0
    ? Object.freeze({
        ...pathWithoutRoute,
        flankTicksRemaining: Math.max(
          0,
          pathWithoutRoute.flankTicksRemaining - NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
        ),
      })
    : pathWithoutRoute
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
    nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    path: recovery.state,
    position: requestedPosition,
  }
}

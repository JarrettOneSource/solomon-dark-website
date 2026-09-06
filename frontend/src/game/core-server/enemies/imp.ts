import { actorHeadingFromVector } from '../../core-kernels/actor-heading.ts'
import { stepNativeImpFlight } from '../../core-kernels/boneyard-imp-flight.ts'
import { nextBoneyardWaveRandom } from '../../core-kernels/boneyard-wave-timeline.ts'
import type { BoneyardPoint } from '../../core-kernels/boneyard.ts'
import {
  buildNativeEnemySteering,
  nativeEnemySteeringGoal,
  nativeEnemyTargetRefreshTicks,
  resolveNativeEnemyPathGoal,
  stepNativeEnemyPathRecovery,
} from '../../core-kernels/native-enemy-pathfinding.ts'
import { attackMarker, directContactPlayerDamage } from './combat.ts'
import { NATIVE_IMP_BITE_SOUNDS, NATIVE_IMP_VOCAL_SOUNDS, emitEnemyActionSound } from './events.ts'
import { validatePoint } from './model.ts'
import type { BoneyardEnemyActor, BoneyardEnemyStoreStepContext, BoneyardImpBrain, WorkingStep } from './model.ts'
import { positiveModulo } from './movement.ts'
import {
  NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
  NATIVE_IMP_CONTACT_BASE_RADIUS,
  NATIVE_IMP_CONTACT_RADIUS_SCALE,
} from './programs.ts'
import { randomIntegerFromUnit } from './random.ts'
import { enemyNavigationClearance, targetEligible, targetPlayerWithinAttackReach } from './targeting.ts'

export function stepImp(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: BoneyardImpBrain,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (brain.phase === 'death') return actor
  const moved = moveImp(actor, brain, work, context)
  const movedBrain = moved.brain
  if (movedBrain.family !== 'imp') throw new Error('Imp movement changed brain family')
  let visualRngState = brain.visualRngState
  const random = (): number => {
    const draw = nextBoneyardWaveRandom(visualRngState)
    visualRngState = draw.state
    return draw.value
  }
  const flight = stepNativeImpFlight(movedBrain, random)
  let stepped: BoneyardEnemyActor = {
    ...moved,
    brain: {
      ...movedBrain,
      ...flight.state,
      visualRngState,
    },
  }
  if (!flight.bounced) return stepped

  const vocal = randomIntegerFromUnit(random, 8)
  emitEnemyActionSound(
    work,
    context.tick,
    stepped,
    NATIVE_IMP_VOCAL_SOUNDS[vocal]!,
    1 + random() * 0.1,
  )
  // Landing vslot +0x98 record-15 scale and green-channel draws occur before
  // the contact-distance branch. Clients key the cosmetic recipe from the
  // replay-safe vocal event identity while authority retains native draw order.
  random()
  random()
  const targetPlayerId = stepped.targetPlayerId
  const target = targetPlayerId === null ? undefined : context.players[targetPlayerId]
  if (
    targetPlayerId === null
    || !target
    || !targetEligible(target)
    || !targetPlayerWithinAttackReach(
      stepped,
      targetPlayerId,
      context.players,
      (target.collisionRadius + NATIVE_IMP_CONTACT_BASE_RADIUS)
        * NATIVE_IMP_CONTACT_RADIUS_SCALE,
    )
  ) {
    const steppedBrain = stepped.brain
    if (steppedBrain.family !== 'imp') throw new Error('Imp flight changed brain family')
    return {
      ...stepped,
      brain: { ...steppedBrain, visualRngState },
    }
  }

  const bite = randomIntegerFromUnit(random, 3)
  emitEnemyActionSound(
    work,
    context.tick,
    stepped,
    NATIVE_IMP_BITE_SOUNDS[bite]!,
    1 + random() * 0.25,
  )

  const eventId = attackMarker(work, stepped, context.tick, targetPlayerId)
  // Raw FireBurst constructor rotation/magnitude/sign and caller scale.
  random()
  random()
  random()
  random()
  const escapeHeadingDeg = positiveModulo(stepped.headingDeg + 180 + random() * 45, 360)
  const steppedBrain = stepped.brain
  if (steppedBrain.family !== 'imp') throw new Error('Imp contact changed brain family')
  stepped = {
    ...stepped,
    headingDeg: escapeHeadingDeg,
    brain: {
      ...steppedBrain,
      escapeHeadingDeg,
      visualRngState,
    },
  }
  directContactPlayerDamage(
    work,
    stepped,
    targetPlayerId,
    context.players,
    (target.collisionRadius + NATIVE_IMP_CONTACT_BASE_RADIUS)
      * NATIVE_IMP_CONTACT_RADIUS_SCALE,
    eventId,
  )
  return stepped
}

function moveImp(
  actor: BoneyardEnemyActor,
  brain: BoneyardImpBrain,
  work: WorkingStep,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  if (context.tick < actor.nextMovementTick) return actor
  const statusFactor = work.pathStatusFactors.get(actor.id) ?? 1
  const movementScalar = Math.fround(
    actor.config.chaseSpeed
      * brain.horizontalSpeed
      * actor.staffMovementFactor
      * actor.config.scale
      * actor.path.speedFactor
      * statusFactor,
  )
  const movementPerTick = 0.25 * movementScalar
  const target = actor.targetPlayerId === null
    ? null
    : context.players[actor.targetPlayerId] ?? null
  let path = actor.path
  let headingDeg = actor.headingDeg
  let delta: Readonly<BoneyardPoint>
  if (brain.escapeHeadingDeg !== null) {
    headingDeg = brain.escapeHeadingDeg
    const radians = headingDeg * Math.PI / 180
    delta = Object.freeze({
      x: Math.sin(radians) * movementPerTick * NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
      y: -Math.cos(radians) * movementPerTick * NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    })
  } else {
    const targetVelocity = target?.velocityPerTick ?? { x: 0, y: 0 }
    const targetHeadingDeg = Math.hypot(targetVelocity.x, targetVelocity.y) === 0
      ? target?.headingDeg ?? 0
      : actorHeadingFromVector(targetVelocity.x, targetVelocity.y)
    const steeringRequest = {
      actorHeadingDeg: actor.headingDeg,
      actorPosition: actor.position,
      cadenceTicks: NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
      movementPerTick,
      radialDirection: 1 as const,
      statusFactor,
      tangentDirection: 0 as const,
      targetHeadingDeg,
      targetPosition: target?.position ?? null,
    }
    const rawGoal = nativeEnemySteeringGoal(path, steeringRequest)
    let goalPosition: Readonly<BoneyardPoint> = rawGoal
    if (context.navigation) {
      const navigationClearance = enemyNavigationClearance(actor)
      const routed = resolveNativeEnemyPathGoal(path, {
        actorPosition: actor.position,
        bodyRadius: actor.config.collisionRadius,
        cadenceTicks: NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
        directPathClear: (start, end) => context.navigation!.isPathClear({
          actorId: actor.id,
          bodyRadius: actor.config.collisionRadius,
          end,
          navigationClearance,
          radius: 0,
          start,
        }),
        findRoute: (start, end, clearance, bodyRadius) => (
          context.navigation!.findRoute({
            actorId: actor.id,
            bodyRadius,
            end,
            navigationClearance: clearance,
            radius: clearance,
            start,
          })
        ),
        navigationClearance,
        rawGoal,
        targetPosition: target?.position ?? null,
        targetRefreshTicks: nativeEnemyTargetRefreshTicks(actor.config.pathfindingMode),
      })
      path = routed.state
      headingDeg = routed.turnAround
        ? positiveModulo(headingDeg + 180, 360)
        : headingDeg
      goalPosition = routed.goal
    }
    const steering = buildNativeEnemySteering(path, {
      ...steeringRequest,
      actorHeadingDeg: headingDeg,
      goalPosition,
    })
    delta = steering.delta
    headingDeg = steering.headingDeg
    path = steering.state
  }
  const distance = Math.hypot(delta.x, delta.y)
  const requestedPosition = {
    x: actor.position.x + delta.x,
    y: actor.position.y + delta.y,
  }
  const position = context.resolveMovement({
    actorId: actor.id,
    delta,
    position: actor.position,
    purpose: 'movement',
    radius: actor.config.collisionRadius,
    requestedPosition,
  })
  validatePoint(position, 'resolved Imp position')
  const traveled = Math.hypot(
    position.x - actor.position.x,
    position.y - actor.position.y,
  )
  const recovery = stepNativeEnemyPathRecovery(
    path,
    work.steeringRngState,
    {
      flankingEnabled: actor.config.flanking,
      requestedDistance: distance,
      statusFactor,
      tick: context.tick,
      traveledDistance: traveled,
    },
  )
  work.steeringRngState = recovery.rngState
  return {
    ...actor,
    brain: brain.escapeHeadingDeg !== null
      && (position.x !== requestedPosition.x || position.y !== requestedPosition.y)
      ? { ...brain, escapeHeadingDeg: null }
      : brain,
    headingDeg,
    lastMovementTick: traveled === 0 ? actor.lastMovementTick : context.tick,
    nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    path: recovery.state,
    position: Object.freeze({ ...position }),
  }
}

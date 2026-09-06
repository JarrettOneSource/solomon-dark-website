import { actorHeadingFromVector } from '../../core-kernels/actor-heading.ts'
import {
  NATIVE_BADGUY_GAIT_PHASE_DIVISOR,
  NATIVE_BADGUY_GAIT_PHASE_PERIOD,
  NATIVE_SKELETON_BODY_GAIT_PHASE_DIVISOR,
  NATIVE_SKELETON_BODY_GAIT_PHASE_PERIOD,
  advanceNativeEnemyLocomotionPhase,
  advanceNativeEnemyStridePhase,
  nativeSkeletonBodyGaitPose,
} from '../../core-kernels/boneyard-skeleton-family-animation.ts'
import type { BoneyardPoint } from '../../core-kernels/boneyard.ts'
import {
  buildNativeEnemySteering,
  clearNativeEnemyRoute,
  nativeEnemySteeringGoal,
  nativeEnemyTargetRefreshTicks,
  resolveNativeEnemyPathGoal,
  stepNativeEnemyPathRecovery,
} from '../../core-kernels/native-enemy-pathfinding.ts'
import type { NativeSecondaryTargetEffectState } from '../../core-kernels/native-secondary-abilities.ts'
import { resetDemon } from './demon.ts'
import { nativeEnemyHitOverlay, validatePoint } from './model.ts'
import type { BoneyardEnemyActor, BoneyardEnemyBrain, BoneyardEnemyStoreStepContext, WorkingStep } from './model.ts'
import { NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS } from './programs.ts'
import { resetArcher, resetMage, resetSkeleton } from './skeleton-family.ts'
import { enemyNavigationClearance } from './targeting.ts'
import { resetZombie } from './zombie.ts'

export function moveTowardTarget<B extends BoneyardEnemyBrain>(
  work: WorkingStep,
  actor: BoneyardEnemyActor,
  brain: B,
  context: BoneyardEnemyStoreStepContext,
  radialDirection: -1 | 0 | 1,
  tangentDirection: -1 | 0 | 1 = 0,
): BoneyardEnemyActor {
  if (context.tick < actor.nextMovementTick) return actor
  if (
    skeletonFamilyMovementPausedByHit(actor)
    && nativeEnemyHitOverlay(actor.lastDamageTick, context.tick) > 0
  ) {
    return {
      ...actor,
      nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    }
  }
  const target = actor.targetPlayerId === null
    ? null
    : context.players[actor.targetPlayerId] ?? null
  const targetVelocity = target?.velocityPerTick ?? { x: 0, y: 0 }
  const targetHeadingDeg = Math.hypot(targetVelocity.x, targetVelocity.y) === 0
    ? target?.headingDeg ?? 0
    : actorHeadingFromVector(targetVelocity.x, targetVelocity.y)
  const movementScalar = Math.fround(
    actor.config.chaseSpeed
      * staffMovementSpeed(actor)
      * actor.config.scale
      * actor.path.speedFactor,
  )
  const steeringRequest = {
    actorHeadingDeg: actor.headingDeg,
    actorPosition: actor.position,
    cadenceTicks: NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    movementPerTick: 0.25 * movementScalar,
    radialDirection,
    statusFactor: work.pathStatusFactors.get(actor.id) ?? 1,
    tangentDirection,
    targetHeadingDeg,
    targetPosition: target?.position ?? null,
  } as const
  const usesTargetRoute = radialDirection === 1 && tangentDirection === 0
  let path = usesTargetRoute
    ? actor.path
    : clearNativeEnemyRoute(actor.path)
  const rawGoal = nativeEnemySteeringGoal(path, steeringRequest)
  let actorHeadingDeg = actor.headingDeg
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
      targetPosition: usesTargetRoute
        ? target?.position ?? null
        : null,
      targetRefreshTicks: nativeEnemyTargetRefreshTicks(actor.config.pathfindingMode),
    })
    path = routed.state
    actorHeadingDeg = routed.turnAround
      ? positiveModulo(actorHeadingDeg + 180, 360)
      : actorHeadingDeg
    goalPosition = routed.goal
  }
  const steering = buildNativeEnemySteering(path, {
    ...steeringRequest,
    actorHeadingDeg,
    goalPosition,
  })
  const delta = steering.delta
  const requestedPosition = Object.freeze({
    x: actor.position.x + delta.x,
    y: actor.position.y + delta.y,
  })
  const position = context.resolveMovement({
    actorId: actor.id,
    delta,
    position: actor.position,
    purpose: 'movement',
    radius: actor.config.collisionRadius,
    requestedPosition,
  })
  validatePoint(position, 'resolved enemy position')
  const traveled = Math.hypot(
    position.x - actor.position.x,
    position.y - actor.position.y,
  )
  const gaitPose = advanceNativeEnemyLocomotionPhase(
    actor.gaitPose,
    movementScalar,
    NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    NATIVE_BADGUY_GAIT_PHASE_DIVISOR,
    NATIVE_BADGUY_GAIT_PHASE_PERIOD,
  )
  const bodyGaitPhase = advanceNativeEnemyLocomotionPhase(
    actor.bodyGaitPhase,
    movementScalar,
    NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    NATIVE_SKELETON_BODY_GAIT_PHASE_DIVISOR,
    NATIVE_SKELETON_BODY_GAIT_PHASE_PERIOD,
  )
  const recovery = stepNativeEnemyPathRecovery(
    steering.state,
    work.steeringRngState,
    {
      flankingEnabled: actor.config.flanking,
      requestedDistance: Math.hypot(delta.x, delta.y),
      statusFactor: work.pathStatusFactors.get(actor.id) ?? 1,
      tick: context.tick,
      traveledDistance: traveled,
    },
  )
  work.steeringRngState = recovery.rngState
  return {
    ...actor,
    bodyGaitPhase,
    bodyPose: skeletonFamilyLocomotionBodyPose(actor, bodyGaitPhase),
    brain,
    gaitPose,
    headingDeg: steering.headingDeg,
    lastMovementTick: traveled === 0 ? actor.lastMovementTick : context.tick,
    nextMovementTick: context.tick + NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    path: recovery.state,
    position: Object.freeze({ ...position }),
    stridePhaseDeg: advanceNativeEnemyStridePhase(
      actor.stridePhaseDeg,
      movementScalar,
      NATIVE_ENEMY_MOVEMENT_CADENCE_TICKS,
    ),
  }
}

function skeletonFamilyLocomotionBodyPose(
  actor: BoneyardEnemyActor,
  bodyGaitPhase: number,
): number {
  switch (actor.config.enemyToken) {
    case 'SKELETON': return actor.config.family.weapon === 'claw'
      && !actor.config.family.armor
      ? nativeSkeletonBodyGaitPose(bodyGaitPhase)
      : 0
    case 'SKELETONARCHER': return nativeSkeletonBodyGaitPose(bodyGaitPhase)
    case 'SKELETONMAGE': return actor.restBodyPose
    default: return actor.bodyPose
  }
}

function skeletonFamilyMovementPausedByHit(actor: BoneyardEnemyActor): boolean {
  return actor.config.enemyToken === 'SKELETON'
    || actor.config.enemyToken === 'SKELETONARCHER'
    || actor.config.enemyToken === 'SKELETONMAGE'
}

export function withNativeSecondaryTickScalars(
  actor: BoneyardEnemyActor,
  effect: NativeSecondaryTargetEffectState,
): BoneyardEnemyActor {
  const speedScale = nativeSecondaryActorSpeedScale(effect)
  const weakenFactor = effect.weakenFactor
  if (speedScale === 1 && weakenFactor === 1) return actor
  return {
    ...actor,
    config: {
      ...actor.config,
      attackSpeed: actor.config.attackSpeed * speedScale,
      baseSpeed: actor.config.baseSpeed * speedScale,
      extraDamage: actor.config.extraDamage * weakenFactor,
      primaryDamage: actor.config.primaryDamage === null
        ? null
        : actor.config.primaryDamage * weakenFactor,
      secondaryDamage: actor.config.secondaryDamage * weakenFactor,
      tertiaryDamage: actor.config.tertiaryDamage * weakenFactor,
    },
  }
}

export function nativeSecondaryActorSpeedScale(
  effect: NativeSecondaryTargetEffectState | undefined,
): number {
  return effect?.timeScale ?? 1
}

export function staffAttackSpeed(actor: BoneyardEnemyActor): number {
  return actor.config.attackSpeed * actor.staffActionFactor
}

function staffMovementSpeed(actor: BoneyardEnemyActor): number {
  return actor.config.baseSpeed * actor.staffMovementFactor
}

export function interruptNativeSecondaryAction(
  actor: BoneyardEnemyActor,
): BoneyardEnemyActor {
  switch (actor.brain.family) {
    case 'skeleton': return resetSkeleton(actor, actor.brain)
    case 'archer': return resetArcher(actor, actor.brain)
    case 'mage': return resetMage(actor, actor.brain)
    case 'imp': return actor
    case 'portal': return actor
    case 'zombie': return resetZombie(actor, actor.brain)
    case 'wraith': return actor
    case 'demon': return resetDemon(actor, actor.brain)
    case 'coffin': return actor
    case 'spider': return actor
    case 'cocoon': return actor
  }
}

export function positiveModulo(value: number, period: number): number {
  return ((value % period) + period) % period
}

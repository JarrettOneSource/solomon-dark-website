import { actorHeadingFromVector } from '../../core-kernels/actor-heading.ts'
import { NATIVE_ACTOR_SEPARATION_EPSILON } from '../../core-kernels/actor-physics.ts'
import type { BoneyardPoint } from '../../core-kernels/boneyard.ts'
import {
  clearNativeEnemyRoute,
  nativeEnemyTargetRefreshTicks,
  stepNativeEnemyReorientation,
} from '../../core-kernels/native-enemy-pathfinding.ts'
import {
  NATIVE_BADGUY_NAVIGATION_CLEARANCE,
  NATIVE_DEMON_NAVIGATION_CLEARANCE,
} from '../boneyard-enemy-navigation.ts'
import {
  type BoneyardEnemyActor,
  type BoneyardEnemyStoreStepContext,
  type BoneyardEnemyTargetCandidate,
  type BoneyardEnemyTargets,
  type BoneyardMaggotActor,
  validatePoint,
} from './model.ts'

export function refreshTarget(
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): BoneyardEnemyActor {
  const current = actor.targetPlayerId === null
    ? undefined
    : context.players[actor.targetPlayerId]
  if (current && targetEligible(current) && context.tick < actor.nextTargetRefreshTick) {
    return actor
  }
  const targetPlayerId = nearestEligibleTarget(actor.position, context.players)
  const path = targetPlayerId === actor.targetPlayerId
    ? actor.path
    : clearNativeEnemyRoute(actor.path)
  return {
    ...actor,
    nextTargetRefreshTick: context.tick
      + nativeEnemyTargetRefreshTicks(actor.config.pathfindingMode),
    path,
    targetPlayerId,
  }
}

export function refreshMaggotTarget(
  source: BoneyardMaggotActor,
  context: BoneyardEnemyStoreStepContext,
): Readonly<Pick<BoneyardMaggotActor, 'nextTargetRefreshTick' | 'targetPlayerId'>> {
  const current = source.targetPlayerId === null
    ? undefined
    : context.players[source.targetPlayerId]
  if (current && targetEligible(current) && context.tick < source.nextTargetRefreshTick) {
    return {
      nextTargetRefreshTick: source.nextTargetRefreshTick,
      targetPlayerId: source.targetPlayerId,
    }
  }
  return {
    nextTargetRefreshTick: context.tick + nativeEnemyTargetRefreshTicks(1),
    targetPlayerId: nearestEligibleTarget(source.position, context.players),
  }
}

export function reorientEnemyTowardTarget(
  source: BoneyardEnemyActor,
  players: BoneyardEnemyTargets,
): BoneyardEnemyActor {
  const target = source.targetPlayerId === null
    ? null
    : players[source.targetPlayerId] ?? null
  const reoriented = stepNativeEnemyReorientation(
    source.path,
    source.headingDeg,
    source.position,
    target?.position ?? null,
  )
  return {
    ...source,
    headingDeg: reoriented.headingDeg,
    path: reoriented.state,
  }
}

export function nearestEligibleTarget(
  position: Readonly<BoneyardPoint>,
  players: BoneyardEnemyTargets,
): string | null {
  let selected: string | null = null
  let selectedDistance = Number.POSITIVE_INFINITY
  for (const [playerId, player] of Object.entries(players)) {
    validatePoint(player.position, `enemy target ${playerId}`)
    validatePoint(player.velocityPerTick, `enemy target ${playerId} velocity`)
    if (!Number.isFinite(player.collisionRadius) || player.collisionRadius < 0) {
      throw new RangeError(`enemy target ${playerId} collision radius must be non-negative`)
    }
    if (!targetEligible(player)) continue
    const dx = player.position.x - position.x
    const dy = player.position.y - position.y
    const distance = dx * dx + dy * dy
    if (distance < selectedDistance) {
      selected = playerId
      selectedDistance = distance
    }
  }
  return selected
}

export function targetEligible(target: BoneyardEnemyTargetCandidate): boolean {
  return target.alive && target.connected && target.eligible
}

export function targetDistance(
  actor: BoneyardEnemyActor,
  players: BoneyardEnemyTargets,
): number {
  if (actor.targetPlayerId === null) return Number.POSITIVE_INFINITY
  const target = players[actor.targetPlayerId]
  if (!target) return Number.POSITIVE_INFINITY
  return Math.hypot(
    target.position.x - actor.position.x,
    target.position.y - actor.position.y,
  )
}

export function targetWithinAttackReach(
  actor: BoneyardEnemyActor,
  players: BoneyardEnemyTargets,
  centerReach: number,
): boolean {
  return targetPlayerWithinAttackReach(
    actor,
    actor.targetPlayerId,
    players,
    centerReach,
  )
}

export function targetPlayerWithinAttackReach(
  actor: BoneyardEnemyActor,
  targetPlayerId: string | null,
  players: BoneyardEnemyTargets,
  centerReach: number,
): boolean {
  if (targetPlayerId === null) return false
  const target = players[targetPlayerId]
  if (!target || !targetEligible(target)) return false
  return Math.hypot(
    target.position.x - actor.position.x,
    target.position.y - actor.position.y,
  ) <= Math.max(
    centerReach,
    actor.config.collisionRadius
      + target.collisionRadius
      + NATIVE_ACTOR_SEPARATION_EPSILON,
  )
}

export function targetHeading(
  position: Readonly<BoneyardPoint>,
  targetPlayerId: string | null,
  players: BoneyardEnemyTargets,
): number {
  const target = targetPlayerId === null ? undefined : players[targetPlayerId]
  return target
    ? actorHeadingFromVector(
        target.position.x - position.x,
        target.position.y - position.y,
      )
    : 0
}

export function trackEnemyActionHeading(
  source: BoneyardEnemyActor,
  players: BoneyardEnemyTargets,
): BoneyardEnemyActor {
  if (source.targetPlayerId === null) return source
  const target = players[source.targetPlayerId]
  if (!target || !targetEligible(target)) return source
  return {
    ...source,
    headingDeg: targetHeading(source.position, source.targetPlayerId, players),
  }
}

export function enemyTargetLineOfSightIsClear(
  actor: BoneyardEnemyActor,
  context: BoneyardEnemyStoreStepContext,
): boolean {
  if (actor.targetPlayerId === null) return false
  const target = context.players[actor.targetPlayerId]
  if (!target || !targetEligible(target)) return false
  return context.navigation?.isPathClear({
    actorId: actor.id,
    bodyRadius: actor.config.collisionRadius,
    end: target.position,
    navigationClearance: enemyNavigationClearance(actor),
    radius: 0,
    start: actor.position,
  }) ?? true
}

export function enemyNavigationClearance(actor: BoneyardEnemyActor): number {
  return actor.config.enemyToken === 'DEMON'
    ? NATIVE_DEMON_NAVIGATION_CLEARANCE
    : NATIVE_BADGUY_NAVIGATION_CLEARANCE
}

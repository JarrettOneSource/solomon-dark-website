import { PLAYER_CHARACTER_RADIUS } from '../../core-kernels/player-character.ts'
import { firstNativePrimaryPointContact } from '../../core-kernels/primary-spell-targeting.ts'
import type { Vector2 } from '../../core-kernels/vector.ts'
import { positionBoneyardEnemy } from '../boneyard-enemy-store.ts'
import { setBoneyardEnemyBlizzardPushState } from '../enemies/damage.ts'
import type { BoneyardEnemyStore } from '../enemies/model.ts'
import type { ResolveBoneyardSpellEnemyMovement } from './model.ts'
import type { BoneyardSpellTarget } from './targets.ts'
import {
  boneyardSpellTargetById,
  normalizedDifference,
  primaryTargetRows,
  squaredDistance,
  targetBodyRadius,
} from './targets.ts'

export function nativeWaterPushTargetFactor(actorFlags: number): number {
  return (actorFlags & 0x40) !== 0 ? Math.fround(0.10000000149011612) : 1
}

const NATIVE_CHILL_BASE_REACH_OFFSET = 25

const NATIVE_CHILL_OUTER_RADIUS_FACTOR = 0.75

const NATIVE_CHILL_INNER_RADIUS_FACTOR = 0.5

const NATIVE_CHILL_IMPULSE_FACTOR = 2.5

const NATIVE_CHILL_FORWARD_BLOCKER_OFFSET = Math.fround(PLAYER_CHARACTER_RADIUS + 0.5)

const NATIVE_CHILL_FORWARD_BLOCKER_RADIUS = Math.fround(PLAYER_CHARACTER_RADIUS / 3)

const NATIVE_BLIZZARD_PUSH_FORWARD_OFFSET = 30

const NATIVE_BLIZZARD_PUSH_QUERY_RADIUS = 25 / 3

const NATIVE_BLIZZARD_PUSH_ACCUMULATOR_GAIN = 0.10000000149011612

const NATIVE_BLIZZARD_PUSH_ACCUMULATOR_FACTOR = 5

const NATIVE_BLIZZARD_PUSH_ACCUMULATOR_MAXIMUM = 2

const NATIVE_BLIZZARD_PUSH_GAP_TICKS = 3

export function applyWaterPushback(
  source: BoneyardEnemyStore,
  actor: BoneyardSpellTarget,
  origin: Readonly<Vector2>,
  pushback: number,
  reach: number,
  targetPushFactor: number,
  resolveMovement: ResolveBoneyardSpellEnemyMovement,
): BoneyardEnemyStore {
  const distanceSquared = Math.fround(squaredDistance(origin, actor.position))
  const baseRadius = Math.fround(reach - NATIVE_CHILL_BASE_REACH_OFFSET)
  const outerSquared = Math.fround(
    Math.fround(baseRadius * baseRadius) * NATIVE_CHILL_OUTER_RADIUS_FACTOR,
  )
  if (distanceSquared >= outerSquared) return source
  const innerSquared = Math.fround(NATIVE_CHILL_INNER_RADIUS_FACTOR * outerSquared)
  const attenuation = distanceSquared <= innerSquared
    ? 1
    : Math.fround((outerSquared - distanceSquared) / (outerSquared - innerSquared))
  const distance = Math.fround(Math.sqrt(distanceSquared))
  if (distance === 0) return source
  const magnitude = Math.fround(
    Math.fround(Math.fround(pushback * targetPushFactor) * NATIVE_CHILL_IMPULSE_FACTOR)
      * attenuation,
  )
  const direction = {
    x: Math.fround((actor.position.x - origin.x) / distance),
    y: Math.fround((actor.position.y - origin.y) / distance),
  }
  const requested = {
    x: Math.fround(actor.position.x + Math.fround(direction.x * magnitude)),
    y: Math.fround(actor.position.y + Math.fround(direction.y * magnitude)),
  }
  const resolved = resolveMovement(
    actor.id,
    actor.position,
    requested,
    targetBodyRadius(actor),
  )
  return positionBoneyardEnemy(source, actor.id, resolved).store
}

export function frostJetPushBlocked(
  source: BoneyardEnemyStore,
  actor: BoneyardSpellTarget,
  origin: Readonly<Vector2>,
): boolean {
  const distanceSquared = Math.fround(squaredDistance(origin, actor.position))
  if (distanceSquared <= 0) return false
  const distance = Math.fround(Math.sqrt(distanceSquared))
  const direction = {
    x: Math.fround((actor.position.x - origin.x) / distance),
    y: Math.fround((actor.position.y - origin.y) / distance),
  }
  const probe = {
    x: Math.fround(
      actor.position.x + Math.fround(direction.x * NATIVE_CHILL_FORWARD_BLOCKER_OFFSET),
    ),
    y: Math.fround(
      actor.position.y + Math.fround(direction.y * NATIVE_CHILL_FORWARD_BLOCKER_OFFSET),
    ),
  }
  return firstNativePrimaryPointContact({
    actorMask: 0x2,
    position: probe,
    queryRadius: NATIVE_CHILL_FORWARD_BLOCKER_RADIUS,
    targets: primaryTargetRows(source)
      .map(({ target }) => target)
      .filter(({ id }) => id !== `enemy:${actor.id}`),
  }) !== null
}

export function applyBlizzardPushback(
  source: BoneyardEnemyStore,
  actorId: number,
  actorFlags: number,
  origin: Readonly<Vector2>,
  pushback: number,
  tick: number,
  resolveMovement: ResolveBoneyardSpellEnemyMovement,
): BoneyardEnemyStore {
  const actor = boneyardSpellTargetById(source, actorId)
  if (!actor || pushback <= 0) return source
  const direction = normalizedDifference(origin, actor.position)
  const probe = {
    x: Math.fround(actor.position.x + direction.x * NATIVE_BLIZZARD_PUSH_FORWARD_OFFSET),
    y: Math.fround(actor.position.y + direction.y * NATIVE_BLIZZARD_PUSH_FORWARD_OFFSET),
  }
  const blocked = firstNativePrimaryPointContact({
    actorMask: 0x2,
    position: probe,
    queryRadius: NATIVE_BLIZZARD_PUSH_QUERY_RADIUS,
    targets: primaryTargetRows(source)
      .map(({ target }) => target)
      .filter(({ id }) => id !== `enemy:${actorId}`),
  }) !== null
  if (blocked) return source

  const recent = actor.blizzardPushLastTick !== null
    && tick - actor.blizzardPushLastTick <= NATIVE_BLIZZARD_PUSH_GAP_TICKS
  const gain = Math.fround(pushback * NATIVE_BLIZZARD_PUSH_ACCUMULATOR_GAIN)
  const cap = Math.min(
    NATIVE_BLIZZARD_PUSH_ACCUMULATOR_MAXIMUM,
    Math.fround(pushback * NATIVE_BLIZZARD_PUSH_ACCUMULATOR_FACTOR),
  )
  const accumulator = recent
    ? Math.fround(Math.min(cap, Math.fround(actor.blizzardPushAccumulator + gain)))
    : 0
  let enemies = setBoneyardEnemyBlizzardPushState(source, actorId, accumulator, tick)
  if (accumulator === 0) return enemies

  const effectivePushback = (actorFlags & 0x40) !== 0
    ? Math.fround(pushback * 0.05000000074505806)
    : pushback
  const magnitude = Math.fround(Math.fround(effectivePushback * 2.5) * accumulator)
  const requested = {
    x: Math.fround(actor.position.x + direction.x * magnitude),
    y: Math.fround(actor.position.y + direction.y * magnitude),
  }
  const resolved = resolveMovement(
    actor.id,
    actor.position,
    requested,
    targetBodyRadius(actor),
  )
  enemies = positionBoneyardEnemy(enemies, actor.id, resolved).store
  return enemies
}

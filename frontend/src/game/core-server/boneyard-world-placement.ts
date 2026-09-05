import {
  actorHeadingFromVector,
  actorHeadingIndex,
} from '../core-kernels/actor-heading.ts'
import {
  resolveActorMotion,
  type ActorPhysicsBody,
} from '../core-kernels/actor-physics.ts'
import type {
  BoneyardBounds,
  BoneyardPoint,
} from '../core-kernels/boneyard.ts'
import {
  nativeSolomonEscapePathTarget,
  nativeSolomonEscapeTarget,
  NATIVE_SOLOMON_COLLISION_RADIUS,
  NATIVE_SOLOMON_ESCAPE_PATH_MARGIN,
  NATIVE_SOLOMON_ESCAPE_ROUTE_ARRIVAL_DISTANCE_SQUARED,
  NATIVE_SOLOMON_NAVIGATION_CLEARANCE,
  type BoneyardSolomonEncounterState,
} from '../core-kernels/boneyard-encounter.ts'
import {
  PLAYER_CHARACTER_PHYSICS,
  createPlayerCharacter,
  type PlayerCharacterConfig,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import {
  NATIVE_LANTERN_LIGHT_BASE_INTENSITY,
  NATIVE_LANTERN_LIGHT_RADIUS,
  NATIVE_PLAYER_LIGHT_OFFSET,
  NATIVE_PLAYER_LIGHT_RADIUS,
  type NativeBoneyardRadialLight,
} from '../core-kernels/native-boneyard-lighting.ts'
import type { NativeSecondaryKnockbackContact } from '../core-kernels/native-secondary-abilities.ts'
import { type NativeLootPlacement } from '../core-kernels/native-loot.ts'
import {
  boneyardBodyCollisionSourceIds,
  canPlaceBoneyardBody,
  firstBoneyardLineObstruction,
  firstBoneyardPathBlockProgress,
  resolveBoneyardMovement,
  withBoneyardGateCollision,
  type BoneyardCollisionWorld,
} from './boneyard-collision.ts'
import {
  boneyardEnemyActorFlags,
  boneyardEnemyCollisionRadius,
  type BoneyardEnemyPlayerKnockback,
  type BoneyardEnemyStore,
} from './boneyard-enemy-store.ts'
import { findBoneyardEnemyRoute } from './boneyard-enemy-navigation.ts'

import type { BoneyardPlayerCombatStatus, BoneyardWorldState } from './boneyard-world.ts'

export function spawnPlayerCharacterInBoneyard(
  config: PlayerCharacterConfig,
  world: BoneyardWorldState,
): PlayerCharacterState {
  return {
    ...createPlayerCharacter(config, { x: world.spawn.x, y: world.spawn.y }),
    headingIndex: actorHeadingIndex(world.spawn.facingDeg),
  }
}

export function placePlayersInBoneyard(
  players: Readonly<Record<string, PlayerCharacterState>>,
  world: BoneyardWorldState,
): Readonly<Record<string, PlayerCharacterState>> {
  return Object.fromEntries(Object.entries(players).map(([playerId, player]) => [
    playerId,
    spawnPlayerCharacterInBoneyard(player.config, world),
  ]))
}

export function prepareSolomonEscapeNavigation(
  source: BoneyardSolomonEncounterState,
  bounds: Readonly<BoneyardBounds>,
  collision: BoneyardCollisionWorld,
  navigationCollision: BoneyardCollisionWorld,
): BoneyardSolomonEncounterState {
  const escapeTarget = source.escapeTarget ?? nativeSolomonEscapeTarget(
    source.position,
    source.headingDeg,
    bounds,
  )
  const escapeCollisionSourceIds = source.escapeTarget === null
    ? boneyardBodyCollisionSourceIds(
        source.position,
        collision,
        NATIVE_SOLOMON_COLLISION_RADIUS,
      )
    : source.escapeCollisionSourceIds
  const pathTarget = nativeSolomonEscapePathTarget(
    source.position,
    escapeTarget,
    bounds,
  )
  const traversalBounds = solomonEscapeTraversalBounds(bounds)
  const ignoredSourceIds = new Set(escapeCollisionSourceIds)
  const directPathBlockProgress = firstBoneyardPathBlockProgress(
    source.position,
    pathTarget,
    traversalBounds,
    collision,
    NATIVE_SOLOMON_COLLISION_RADIUS,
    ignoredSourceIds,
  )
  const route = directPathBlockProgress === null
    ? null
    : findBoneyardEnemyRoute({
        bodyRadius: NATIVE_SOLOMON_COLLISION_RADIUS,
        bounds: traversalBounds,
        clearance: NATIVE_SOLOMON_NAVIGATION_CLEARANCE,
        end: pathTarget,
        ignoredSourceIds,
        start: source.position,
        world: navigationCollision,
      })
  const goal = solomonEscapeRouteGoal(
    source.position,
    pathTarget,
    route,
    traversalBounds,
    collision,
    ignoredSourceIds,
  )
  return {
    ...source,
    escapeCollisionSourceIds,
    escapeTarget,
    headingDeg: actorHeadingFromVector(
      goal.x - source.position.x,
      goal.y - source.position.y,
    ),
  }
}

export function resolveSolomonEscapeMovement(
  source: BoneyardSolomonEncounterState,
  next: BoneyardSolomonEncounterState,
  bounds: Readonly<BoneyardBounds>,
  collision: BoneyardCollisionWorld,
): BoneyardSolomonEncounterState {
  const ignoredSourceIds = source.escapeCollisionSourceIds.length === 0
    ? undefined
    : new Set(source.escapeCollisionSourceIds)
  const pathTarget = source.escapeTarget === null
    ? null
    : nativeSolomonEscapePathTarget(source.position, source.escapeTarget, bounds)
  const pathTargetReached = pathTarget !== null
    && squaredDistance(source.position, pathTarget)
      <= NATIVE_SOLOMON_ESCAPE_ROUTE_ARRIVAL_DISTANCE_SQUARED
  const position = pathTargetReached
    ? source.position
    : resolveBoneyardMovement(
        source.position,
        next.position,
        solomonEscapeTraversalBounds(bounds),
        collision,
        NATIVE_SOLOMON_COLLISION_RADIUS,
        ignoredSourceIds,
      )
  if (next.phase === 'gone') return { ...next, position }
  const activeCollisionSourceIds = new Set(boneyardBodyCollisionSourceIds(
    position,
    collision,
    NATIVE_SOLOMON_COLLISION_RADIUS,
  ))
  const escapeCollisionSourceIds = source.escapeCollisionSourceIds.filter((sourceId) => (
    activeCollisionSourceIds.has(sourceId)
  ))
  return {
    ...next,
    escapeCollisionSourceIds,
    position,
  }
}

function solomonEscapeRouteGoal(
  position: Readonly<BoneyardPoint>,
  pathTarget: Readonly<BoneyardPoint>,
  route: readonly Readonly<BoneyardPoint>[] | null,
  bounds: Readonly<BoneyardBounds>,
  collision: BoneyardCollisionWorld,
  ignoredSourceIds: ReadonlySet<string>,
): Readonly<BoneyardPoint> {
  if (route === null || route.length < 2) return pathTarget
  let goal = route[1]!
  for (let index = 2; index < route.length; index += 1) {
    const candidate = route[index]!
    if (firstBoneyardLineObstruction(
      position,
      candidate,
      bounds,
      collision,
      undefined,
      0,
      ignoredSourceIds,
    ) !== null) break
    goal = candidate
  }
  return goal
}

export function solomonEscapeTraversalBounds(
  bounds: Readonly<BoneyardBounds>,
): BoneyardBounds {
  // The shared resolver insets by body radius; compensate so Solomon's center
  // can reach the native state-4 rectangle expanded by 50.
  const padding = NATIVE_SOLOMON_ESCAPE_PATH_MARGIN + NATIVE_SOLOMON_COLLISION_RADIUS
  return {
    h: bounds.h + padding * 2,
    w: bounds.w + padding * 2,
    x: bounds.x - padding,
    y: bounds.y - padding,
  }
}

function squaredDistance(
  left: Readonly<BoneyardPoint>,
  right: Readonly<BoneyardPoint>,
): number {
  const dx = right.x - left.x
  const dy = right.y - left.y
  return dx * dx + dy * dy
}

function pointInsideBounds(
  point: Readonly<BoneyardPoint>,
  bounds: Readonly<BoneyardBounds>,
): boolean {
  return point.x >= bounds.x
    && point.y >= bounds.y
    && point.x <= bounds.x + bounds.w
    && point.y <= bounds.y + bounds.h
}

export function boneyardSpawnLightSources(
  world: BoneyardWorldState,
  players: Readonly<Record<string, PlayerCharacterState>>,
  enemies: BoneyardEnemyStore,
): readonly NativeBoneyardRadialLight[] {
  const sources: NativeBoneyardRadialLight[] = []
  for (const player of Object.values(players)) {
    const heading = player.headingIndex * 15 * Math.PI / 180
    sources.push({
      intensity: 1,
      position: {
        x: player.position.x + Math.sin(heading) * NATIVE_PLAYER_LIGHT_OFFSET,
        y: player.position.y - Math.cos(heading) * NATIVE_PLAYER_LIGHT_OFFSET,
      },
      radius: NATIVE_PLAYER_LIGHT_RADIUS,
    })
  }
  if (world.lanternPosition !== null) {
    sources.push({
      intensity: NATIVE_LANTERN_LIGHT_BASE_INTENSITY,
      position: world.lanternPosition,
      radius: NATIVE_LANTERN_LIGHT_RADIUS,
    })
  }
  for (const actor of enemies.actors) {
    if (actor.lighting.providerCopies === 0) continue
    const radius = (() => {
      switch (actor.config.enemyToken) {
        case 'IMP': return 0.35
        case 'PORTAL': return actor.brain.family === 'portal' ? actor.brain.alpha : 0
        case 'DEMON': return 1.75
        case 'COFFIN': return 0.65
        case 'SKELETON':
        case 'SKELETONARCHER':
        case 'SKELETONMAGE':
        case 'WRAITH': return 0.5
        case 'ZOMBIE': return 0
      }
    })()
    if (radius > 0) {
      sources.push({ intensity: 1, position: actor.position, radius })
    }
  }
  return sources
}

export function createNativeLootPlacement(
  bounds: BoneyardBounds,
  collision: BoneyardCollisionWorld,
): NativeLootPlacement {
  return {
    canPlace: (position, radius) => canPlaceBoneyardBody(position, bounds, collision, radius),
  }
}

export function nearbyNativeMaskTwoCount(
  enemies: BoneyardEnemyStore,
  excludedActorId: number,
  position: Readonly<BoneyardPoint>,
): number {
  const radiusSquared = 250 * 250
  const within = (candidate: Readonly<BoneyardPoint>) => {
    const dx = candidate.x - position.x
    const dy = candidate.y - position.y
    return dx * dx + dy * dy < radiusSquared
  }
  return enemies.actors.filter((actor) => (
    actor.id !== excludedActorId
    && within(actor.position)
  )).length + enemies.maggots.filter((actor) => (
    actor.id !== excludedActorId
    && within(actor.position)
  )).length
}

export function applyBoneyardPlayerKnockbacks(
  players: Readonly<Record<string, PlayerCharacterState>>,
  enemies: BoneyardEnemyStore,
  knockbacks: readonly BoneyardEnemyPlayerKnockback[],
  playerCombat: Readonly<Record<string, BoneyardPlayerCombatStatus>>,
  bounds: BoneyardBounds,
  collision: BoneyardCollisionWorld,
): Readonly<{
  enemies: BoneyardEnemyStore
  players: Readonly<Record<string, PlayerCharacterState>>
}> {
  if (knockbacks.length === 0) return { enemies, players }
  let bodies = boneyardCombatBodies(players, enemies, playerCombat)
  for (const knockback of knockbacks) {
    const moverId = `player-${knockback.playerId}`
    if (!bodies.has(moverId)) continue
    const resolved = resolveActorMotion(
      [...bodies.values()].map((body) => ({
        ...body,
        delta: body.id === moverId ? { ...knockback.delta } : { x: 0, y: 0 },
        driven: body.id === moverId,
      })),
      {
        canPlace: (_bodyId, position, radius) => canPlaceBoneyardBody(
          position,
          bounds,
          collision,
          radius,
        ),
        move: (_bodyId, position, delta, radius) => resolveBoneyardMovement(
          position,
          { x: position.x + delta.x, y: position.y + delta.y },
          bounds,
          collision,
          radius,
        ),
      },
      () => true,
    )
    bodies = new Map(resolved.map((body) => [body.id, body]))
  }

  const positions = new Map(
    [...bodies.values()].map((body) => [body.id, body.position]),
  )
  return {
    enemies: commitBoneyardEnemyCollisionPositions(enemies, positions),
    players: Object.fromEntries(Object.entries(players).map(([playerId, player]) => {
      const position = positions.get(`player-${playerId}`)
      return [
        playerId,
        position === undefined
          ? player
          : { ...player, position: { ...position } },
      ]
    })),
  }
}

export function applyBoneyardSecondaryEnemyKnockbacks(
  world: BoneyardWorldState,
  players: Readonly<Record<string, PlayerCharacterState>>,
  knockbacks: readonly NativeSecondaryKnockbackContact[],
  playerCombat: Readonly<Record<string, BoneyardPlayerCombatStatus>>,
): BoneyardWorldState {
  if (knockbacks.length === 0) return world
  const collision = withBoneyardGateCollision(world.collision, world.gateLeaves)
  let bodies = boneyardCombatBodies(players, world.enemies, playerCombat)
  for (const knockback of knockbacks) {
    const moverId = `enemy-${knockback.targetId}`
    if (!bodies.has(moverId)) continue
    const resolved = resolveActorMotion(
      [...bodies.values()].map((body) => ({
        ...body,
        delta: body.id === moverId ? { ...knockback.delta } : { x: 0, y: 0 },
        driven: body.id === moverId,
      })),
      {
        canPlace: (_bodyId, position, radius) => canPlaceBoneyardBody(
          position,
          world.bounds,
          collision,
          radius,
        ),
        move: (_bodyId, position, delta, radius) => resolveBoneyardMovement(
          position,
          { x: position.x + delta.x, y: position.y + delta.y },
          world.bounds,
          collision,
          radius,
        ),
      },
      () => true,
    )
    bodies = new Map(resolved.map((body) => [body.id, body]))
  }
  return {
    ...world,
    enemies: commitBoneyardEnemyCollisionPositions(
      world.enemies,
      new Map([...bodies.values()].map((body) => [body.id, body.position])),
    ),
  }
}

export function boneyardCombatBodies(
  players: Readonly<Record<string, PlayerCharacterState>>,
  enemies: BoneyardEnemyStore,
  playerCombat: Readonly<Record<string, BoneyardPlayerCombatStatus>>,
): Map<string, ActorPhysicsBody> {
  return new Map([
    ...Object.entries(players)
      .filter(([playerId]) => playerCombat[playerId]?.collisionEnabled ?? true)
      .map(([playerId, player]): [string, ActorPhysicsBody] => [
        `player-${playerId}`,
        {
          ...PLAYER_CHARACTER_PHYSICS,
          delta: { x: 0, y: 0 },
          driven: false,
          id: `player-${playerId}`,
          position: { ...player.position },
        },
      ]),
    ...boneyardEnemyBodies(enemies).map((body): [string, ActorPhysicsBody] => [
      body.id,
      body,
    ]),
  ])
}

export function boneyardEnemyBodies(
  enemies: BoneyardEnemyStore,
): ActorPhysicsBody[] {
  return [
    ...enemies.actors
      .filter((actor) => boneyardEnemyActorFlags(actor) !== 0)
      .map((actor) => {
        const id = `enemy-${actor.id}`
        return enemyCollisionBody(id, actor.position, boneyardEnemyCollisionRadius(actor))
      }),
    ...enemies.maggots
      .filter((maggot) => maggot.lifeState === 'alive')
      .map((maggot) => {
        const id = `enemy-${maggot.id}`
        return enemyCollisionBody(id, maggot.position, maggot.collisionRadius)
      }),
  ]
}

export function commitBoneyardEnemyCollisionPositions(
  enemies: BoneyardEnemyStore,
  resolvedPositions: ReadonlyMap<string, Readonly<BoneyardPoint>>,
): BoneyardEnemyStore {
  return {
    ...enemies,
    actors: enemies.actors.map((actor) => {
      const position = resolvedPositions.get(`enemy-${actor.id}`)
      return position === undefined
        ? actor
        : { ...actor, position: Object.freeze({ ...position }) }
    }),
    maggots: enemies.maggots.map((maggot) => {
      const position = resolvedPositions.get(`enemy-${maggot.id}`)
      return position === undefined
        ? maggot
        : { ...maggot, position: Object.freeze({ ...position }) }
    }),
  }
}

/**
 * `filter` for the per-tick scenery cleanup that hands back the source array
 * when every row survives, so the sealed arena stops re-allocating three
 * scenery lists per tick and downstream identity caches can hit.
 */
export function retainInsideBounds<Row extends { readonly position: Readonly<BoneyardPoint> }>(
  rows: readonly Row[],
  bounds: Readonly<BoneyardBounds>,
): readonly Row[] {
  let index = 0
  while (index < rows.length && pointInsideBounds(rows[index]!.position, bounds)) index += 1
  if (index === rows.length) return rows
  const retained = rows.slice(0, index)
  for (index += 1; index < rows.length; index += 1) {
    const row = rows[index]!
    if (pointInsideBounds(row.position, bounds)) retained.push(row)
  }
  return retained
}

export function enemyCollisionBody(
  id: string,
  position: Readonly<BoneyardPoint>,
  radius: number,
): ActorPhysicsBody {
  return {
    delta: { x: 0, y: 0 },
    driven: false,
    id,
    position: { ...position },
    pushEnabled: false,
    pushResistance: 0,
    pushStrength: 0,
    radius,
  }
}

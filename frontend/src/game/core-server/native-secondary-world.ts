import type {
  NativeSecondaryDampenCandidates,
  NativeSecondaryDamageContact,
  NativeSecondaryHeadingPerturbation,
  NativeSecondaryPositionResult,
  NativeSecondaryTarget,
  NativeSecondaryTickResult,
} from '../core-kernels/native-secondary-abilities.ts'
import type { BoneyardBounds } from '../core-kernels/boneyard.ts'
import {
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import {
  damageBoneyardEnemy,
  type BoneyardEnemySemanticEvent,
  type BoneyardEnemyStore,
} from './boneyard-enemy-store.ts'
import {
  canPlaceBoneyardBody,
  type BoneyardCollisionWorld,
} from './boneyard-collision.ts'

const NATIVE_TELEPORT_GRID_STEP = 100
const NATIVE_TELEPORT_GRID_INSET = 100
const NATIVE_TELEPORT_SCORE_CAP = 0x10_0000
const NATIVE_TELEPORT_COLLISION_RADIUS = 40
const NATIVE_TELEPORT_RING_DISTANCE_FACTOR = 0.800000011920929
const NATIVE_RUNTIME_PI = Math.fround(Math.PI)

export interface BoneyardNativeTeleportBody {
  readonly position: Vector2
  readonly radius: number
}

export interface BoneyardNativeTeleportWorld {
  readonly bodies: readonly BoneyardNativeTeleportBody[]
  readonly bounds: BoneyardBounds
  readonly collision: BoneyardCollisionWorld
}

export interface BoneyardSecondaryCombatResult {
  readonly enemies: BoneyardEnemyStore
  readonly events: readonly BoneyardEnemySemanticEvent[]
}

export function resolveBoneyardNativeTeleport(
  sourceRng: NativeRngState,
  world: BoneyardNativeTeleportWorld,
): NativeSecondaryPositionResult {
  let rng = sourceRng
  const candidates: { position: Vector2; score: number }[] = []
  const maximumX = Math.fround(
    world.bounds.x + world.bounds.w - NATIVE_TELEPORT_GRID_INSET,
  )
  const maximumY = Math.fround(
    world.bounds.y + world.bounds.h - NATIVE_TELEPORT_GRID_INSET,
  )

  for (
    let y = Math.fround(world.bounds.y + NATIVE_TELEPORT_GRID_INSET);
    y < maximumY;
    y = Math.fround(y + NATIVE_TELEPORT_GRID_STEP)
  ) {
    for (
      let x = Math.fround(world.bounds.x + NATIVE_TELEPORT_GRID_INSET);
      x < maximumX;
      x = Math.fround(x + NATIVE_TELEPORT_GRID_STEP)
    ) {
      let score = 0
      for (const body of world.bodies) {
        const dx = x - body.position.x
        const dy = y - body.position.y
        score = Math.max(score, Math.trunc(dx * dx + dy * dy))
      }
      candidates.push({
        position: { x, y },
        score: Math.min(score, NATIVE_TELEPORT_SCORE_CAP),
      })
    }
  }

  for (let index = 0; index < candidates.length; index += 1) {
    const selected = drawNativeInteger(rng, candidates.length)
    rng = selected.state
    ;[candidates[index], candidates[selected.value]] = [
      candidates[selected.value]!, candidates[index]!,
    ]
  }

  let selectedPosition: Vector2 | null = null
  let bestScore = 0
  for (const candidate of candidates) {
    if (candidate.score <= bestScore) continue
    bestScore = candidate.score
    selectedPosition = candidate.position
  }
  if (selectedPosition === null) {
    const y = drawNativeFloat(rng, world.bounds.h)
    const x = drawNativeFloat(y.state, world.bounds.w)
    rng = x.state
    selectedPosition = {
      x: Math.fround(world.bounds.x + x.value),
      y: Math.fround(world.bounds.y + y.value),
    }
  }

  return resolveNativeCollisionAdjustedPosition(
    rng,
    selectedPosition,
    NATIVE_TELEPORT_COLLISION_RADIUS,
    (position) => canPlaceNativeTeleportBody(position, world),
  )
}

export function resolveNativeCollisionAdjustedPosition(
  sourceRng: NativeRngState,
  requestedPosition: Vector2,
  bodyRadius: number,
  canPlace: (position: Vector2) => boolean,
): NativeSecondaryPositionResult {
  if (!(Number.isFinite(bodyRadius) && bodyRadius > 0)) {
    throw new RangeError('native collision-adjustment radius must be finite and positive')
  }
  if (canPlace(requestedPosition)) {
    return { position: requestedPosition, rng: sourceRng }
  }

  let rng = sourceRng
  let searchRadius = Math.fround(bodyRadius)
  let expansionMultiplier = Math.fround(1)
  for (;;) {
    const sampleCount = roundToNearestEven(
      NATIVE_RUNTIME_PI * (searchRadius + bodyRadius) / searchRadius,
    )
    const headingStep = Math.fround(360 / sampleCount)
    const phase = drawNativeFloat(rng, 360)
    rng = phase.state
    const verticalRadius = Math.fround(
      searchRadius * NATIVE_TELEPORT_RING_DISTANCE_FACTOR,
    )
    let headingOffset = Math.fround(0)
    while (headingOffset < 360) {
      const heading = Math.fround(phase.value + headingOffset)
      const radians = heading * Math.PI / 180
      const candidate = {
        x: Math.fround(
          requestedPosition.x + Math.fround(
            Math.fround(Math.sin(radians)) * searchRadius,
          ),
        ),
        y: Math.fround(
          requestedPosition.y + Math.fround(
            -Math.fround(Math.cos(radians)) * verticalRadius,
          ),
        ),
      }
      if (canPlace(candidate)) return { position: candidate, rng }
      headingOffset = Math.fround(headingOffset + headingStep)
    }

    searchRadius = Math.fround(
      searchRadius + expansionMultiplier * bodyRadius,
    )
    const expansion = drawNativeFloat(rng, 1)
    rng = expansion.state
    expansionMultiplier = Math.fround(
      expansionMultiplier * (1 + expansion.value),
    )
  }
}

export function boneyardNativeSecondaryTargets(
  enemies: BoneyardEnemyStore,
  center: Vector2,
  radius: number,
): readonly NativeSecondaryTarget[] {
  if (!Number.isFinite(radius) || radius < 0) {
    throw new RangeError('secondary target radius must be finite and non-negative')
  }
  return [...enemies.actors, ...enemies.maggots]
    .filter((actor) => {
      if (actor.lifeState !== 'alive') return false
      if ('config' in actor && actor.config.enemyToken === 'COFFIN') return false
      const bodyRadius = 'config' in actor ? actor.config.collisionRadius : actor.collisionRadius
      return Math.hypot(actor.position.x - center.x, actor.position.y - center.y)
        <= radius + bodyRadius
    })
    .sort((a, b) => a.id - b.id)
    .map((actor) => Object.freeze({
      family: 'config' in actor ? actor.config.enemyToken : 'MAGGOT',
      id: actor.id,
      nativeFlags: 0x2,
      position: Object.freeze({ ...actor.position }),
      radius: 'config' in actor ? actor.config.collisionRadius : actor.collisionRadius,
      scale: 'config' in actor ? actor.config.scale : 1,
      shieldHealth: 'config' in actor ? actor.shieldHealth : 0,
    }))
}

export function boneyardNativeSecondaryTarget(
  enemies: BoneyardEnemyStore,
  targetId: number,
): NativeSecondaryTarget | null {
  const actor = [...enemies.actors, ...enemies.maggots].find(({ id }) => id === targetId)
  if (!actor || actor.lifeState !== 'alive') return null
  if ('config' in actor && actor.config.enemyToken === 'COFFIN') return null
  return Object.freeze({
    family: 'config' in actor ? actor.config.enemyToken : 'MAGGOT',
    id: actor.id,
    nativeFlags: 0x2,
    position: Object.freeze({ ...actor.position }),
    radius: 'config' in actor ? actor.config.collisionRadius : actor.collisionRadius,
    scale: 'config' in actor ? actor.config.scale : 1,
    shieldHealth: 'config' in actor ? actor.shieldHealth : 0,
  })
}

export function boneyardNativeSecondaryDampenCandidates(
  enemies: BoneyardEnemyStore,
  origin: Vector2,
  radius = 400,
): NativeSecondaryDampenCandidates {
  const inside = (position: Vector2) => (
    Math.abs(position.x - origin.x) <= radius
    && Math.abs(position.y - origin.y) <= radius
  )
  const actors = enemies.actors.filter((actor) => (
    actor.lifeState === 'alive' && inside(actor.position)
  ))
  return Object.freeze({
    casterTargetIds: Object.freeze(actors
      .filter(({ config }) => config.enemyToken === 'SKELETONMAGE')
      .map(({ id }) => id)
      .sort((a, b) => a - b)),
    projectileIds: Object.freeze(enemies.projectiles
      .filter(({ position }) => inside(position))
      .map(({ id }) => id)
      .sort((a, b) => a - b)),
    shieldTargetIds: Object.freeze(actors
      .filter(({ shieldHealth }) => shieldHealth > 0)
      .map(({ id }) => id)
      .sort((a, b) => a - b)),
  })
}

export function resolveBoneyardNativeSecondaryCombat(
  source: BoneyardEnemyStore,
  result: Pick<
    NativeSecondaryTickResult,
    'damage' | 'dispelledShieldTargetIds' | 'headingPerturbations' | 'removedProjectileIds'
  >,
  tick: number,
): BoneyardSecondaryCombatResult {
  const removedProjectileIds = new Set(result.removedProjectileIds)
  let enemies = removedProjectileIds.size === 0
    ? source
    : {
        ...source,
        projectiles: source.projectiles.filter(({ id }) => !removedProjectileIds.has(id)),
      }
  const events: BoneyardEnemySemanticEvent[] = []

  for (const targetId of result.dispelledShieldTargetIds) {
    const actor = enemies.actors.find(({ id }) => id === targetId)
    if (!actor || actor.shieldHealth <= 0) continue
    const damaged = damageBoneyardEnemy(enemies, {
      actorId: actor.id,
      amount: actor.shieldHealth,
      sourcePlayerId: null,
      tick,
    })
    enemies = damaged.store
    events.push(...damaged.events)
  }

  for (const contact of result.damage) {
    const damaged = applyContact(enemies, contact, tick)
    enemies = damaged.enemies
    events.push(...damaged.events)
  }
  enemies = applyEarthquakeHeadingPerturbations(enemies, result.headingPerturbations)
  return { enemies, events: Object.freeze(events) }
}

function applyEarthquakeHeadingPerturbations(
  source: BoneyardEnemyStore,
  perturbations: readonly NativeSecondaryHeadingPerturbation[],
): BoneyardEnemyStore {
  if (perturbations.length === 0) return source
  let actors = source.actors
  let maggots = source.maggots
  for (const perturbation of perturbations) {
    const actorIndex = actors.findIndex(({ id }) => id === perturbation.targetId)
    if (actorIndex >= 0) {
      const next = [...actors]
      const actor = next[actorIndex]!
      next[actorIndex] = {
        ...actor,
        headingDeg: normalizeDegrees(actor.headingDeg + perturbation.deltaDegrees),
      }
      actors = Object.freeze(next)
      continue
    }
    const maggotIndex = maggots.findIndex(({ id }) => id === perturbation.targetId)
    if (maggotIndex < 0) continue
    const next = [...maggots]
    const maggot = next[maggotIndex]!
    next[maggotIndex] = {
      ...maggot,
      headingDeg: normalizeDegrees(maggot.headingDeg + perturbation.deltaDegrees),
    }
    maggots = Object.freeze(next)
  }
  return actors === source.actors && maggots === source.maggots
    ? source
    : { ...source, actors, maggots }
}

function normalizeDegrees(value: number): number {
  return Math.fround(((value % 360) + 360) % 360)
}

function roundToNearestEven(value: number): number {
  const integer = Math.floor(value)
  const fraction = value - integer
  if (fraction < 0.5) return integer
  if (fraction > 0.5) return integer + 1
  return integer % 2 === 0 ? integer : integer + 1
}

function applyContact(
  source: BoneyardEnemyStore,
  contact: NativeSecondaryDamageContact,
  tick: number,
): BoneyardSecondaryCombatResult {
  const damaged = damageBoneyardEnemy(source, {
    actorId: contact.targetId,
    amount: contact.amount,
    sourcePlayerId: contact.ownerId,
    tick,
  })
  return { enemies: damaged.store, events: damaged.events }
}

function canPlaceNativeTeleportBody(
  position: Vector2,
  world: BoneyardNativeTeleportWorld,
): boolean {
  if (!canPlaceBoneyardBody(
    position,
    world.bounds,
    world.collision,
    NATIVE_TELEPORT_COLLISION_RADIUS,
  )) return false
  return world.bodies.every((body) => {
    const minimumDistance = NATIVE_TELEPORT_COLLISION_RADIUS + body.radius
    const dx = position.x - body.position.x
    const dy = position.y - body.position.y
    return dx * dx + dy * dy >= minimumDistance * minimumDistance
  })
}

import type { BoneyardBounds } from '../core-kernels/boneyard.ts'
import type { NativeRngState } from '../core-kernels/native-rng.ts'
import { drawNativeFloat, drawNativeInteger } from '../core-kernels/native-rng.ts'
import { nativeEtherDrainCapturesFamily } from '../core-kernels/native-ether-drain.ts'
import type { NativeSecondaryDamageContact, NativeSecondaryDampenCandidates, NativeSecondaryDampenProjectileCandidate, NativeSecondaryTargetHeadingChange, NativeSecondaryPositionResult, NativeSecondaryTarget, NativeSecondaryTickResult } from '../core-kernels/native-secondary-abilities.ts'
import type { RegisterNativeWorldPainter } from '../core-kernels/native-world-manager-order.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type { BoneyardCollisionWorld } from './boneyard-collision.ts'
import type { BoneyardWorldState } from './boneyard-world-state.ts'
import { canPlaceBoneyardBody } from './boneyard-collision.ts'
import { damageBoneyardEnemy } from './enemies/damage.ts'
import { dampenBoneyardCasters } from './enemies/dampen.ts'
import type { BoneyardEnemyActor, BoneyardEnemyLethalObserver, BoneyardEnemySemanticEvent, BoneyardEnemyStore, BoneyardMaggotActor } from './enemies/model.ts'
import { boneyardEnemyActorFlags, boneyardEnemyCollisionRadius } from './enemies/model.ts'
const NATIVE_TELEPORT_GRID_STEP = 100
const NATIVE_TELEPORT_GRID_INSET = 100
const NATIVE_TELEPORT_SCORE_CAP = 0x10_0000
const NATIVE_TELEPORT_COLLISION_RADIUS = 40
const NATIVE_TELEPORT_RING_DISTANCE_FACTOR = 0.800000011920929
const NATIVE_RUNTIME_PI = Math.fround(Math.PI)

export function createNativeSecondaryTargetMembership(
  world: Pick<BoneyardWorldState, 'kind' | 'runId' | 'enemies'> | { readonly kind: 'hub' },
): (worldKey: string, targetId: number) => boolean {
  if (world.kind !== 'boneyard') return () => false
  const worldKey = `boneyard:${world.runId}`
  // Actor destruction, not health, flags or emergence, ends owned modifiers.
  const targetIds = new Set(world.enemies.actors.map(({ id }) => id))
  for (const { id } of world.enemies.maggots) targetIds.add(id)
  return (targetWorldKey, targetId) => targetWorldKey === worldKey && targetIds.has(targetId)
}

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
  readonly captures: readonly Readonly<{ actor: BoneyardEnemyActor | null; fieldIndex: number }>[]
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
      if (
        'config' in actor
        && (boneyardEnemyActorFlags(actor) & 0x2) === 0
      ) return false
      if (!('config' in actor) && !actor.combatActive) return false
      const bodyRadius = 'config' in actor ? boneyardEnemyCollisionRadius(actor) : actor.collisionRadius
      return Math.hypot(actor.position.x - center.x, actor.position.y - center.y)
        <= radius + bodyRadius
    })
    .sort((a, b) => a.id - b.id)
    .map((actor) => Object.freeze({
      family: 'config' in actor ? actor.config.enemyToken : 'MAGGOT',
      id: actor.id,
      registrationOrder: actor.nativeRegistrationOrder,
      lightRegistration: actor.lightRegistration,
      nativeFlags: 0x2,
      position: Object.freeze({ ...actor.position }),
      radius: 'config' in actor ? boneyardEnemyCollisionRadius(actor) : actor.collisionRadius,
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
  if (
    'config' in actor
    && (boneyardEnemyActorFlags(actor) & 0x2) === 0
  ) return null
  if (!('config' in actor) && !actor.combatActive) return null
  return Object.freeze({
    family: 'config' in actor ? actor.config.enemyToken : 'MAGGOT',
    id: actor.id,
    registrationOrder: actor.nativeRegistrationOrder,
    lightRegistration: actor.lightRegistration,
    nativeFlags: 0x2,
    position: Object.freeze({ ...actor.position }),
    radius: 'config' in actor ? boneyardEnemyCollisionRadius(actor) : actor.collisionRadius,
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
  const projectiles: NativeSecondaryDampenProjectileCandidate[] = enemies.projectiles
    .filter((projectile) => (
      inside(projectile.position)
      && (
        (
          projectile.nativeTypeId === 0x7eb
          && projectile.kind === 'firebolt'
          && projectile.payload === 'fire'
        )
        || (
          projectile.nativeTypeId === 0x7ec
          && projectile.kind === 'guided-missile'
          && (projectile.payload === 'cold' || projectile.payload === 'poison')
        )
      )
    ))
    .toSorted((first, second) => (
      first.nativeRegistrationOrder - second.nativeRegistrationOrder
      || first.id - second.id
    ))
    .map((projectile) => Object.freeze({
      id: projectile.id,
      kind: projectile.nativeTypeId === 0x7eb ? 'firebolt' : 'guided-missile',
      payload: projectile.nativeTypeId === 0x7eb
        ? 'fire'
        : projectile.payload === 'poison'
          ? 'poison'
          : 'cold',
      position: Object.freeze({ ...projectile.position }),
    }))
  for (const spell of enemies.bossSpells) {
    if (!inside(spell.position) || (spell.kind !== 'skull-missile' && spell.kind !== 'dark-fireball')) continue
    projectiles.push({ id: spell.id, kind: spell.kind, payload: 'dark', position: { ...spell.position } })
  }
  return Object.freeze({
    casterTargetIds: Object.freeze(actors
      .filter(({ config }) => config.enemyToken === 'SKELETONMAGE' || config.enemyToken === 'DIREFACULTY')
      .map(({ id }) => id)
      .sort((a, b) => a - b)),
    projectiles: Object.freeze(projectiles),
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
    'damage' | 'dampenedCasterTargetIds' | 'dispelledShieldTargetIds' | 'targetHeadingChanges' | 'removedProjectileIds'
  >,
  tick: number,
  lethalObserver?: BoneyardEnemyLethalObserver,
  damageMultiplier: (targetId: number, ownerId: string) => number = () => 1,
  registerWorldPainter?: RegisterNativeWorldPainter,
  etherDrainFields: readonly Vector2[] = [],
  enhancedEffects = true,
): BoneyardSecondaryCombatResult {
  const removedProjectileIds = new Set(result.removedProjectileIds)
  let enemies = removedProjectileIds.size === 0
    ? source
    : {
        ...source,
        projectiles: source.projectiles.filter(({ id }) => !removedProjectileIds.has(id)),
        bossSpells: source.bossSpells.filter(({ id }) => !removedProjectileIds.has(id)),
      }
  const events: BoneyardEnemySemanticEvent[] = []
  const captures: Array<Readonly<{ actor: BoneyardEnemyActor | null; fieldIndex: number }>> = []
  enemies = dampenBoneyardCasters(enemies, result.dampenedCasterTargetIds, tick, registerWorldPainter)

  for (const targetId of result.dispelledShieldTargetIds) {
    const actor = enemies.actors.find(({ id }) => id === targetId)
    if (!actor || actor.shieldHealth <= 0) continue
    const damaged = damageBoneyardEnemy(enemies, {
      enhancedEffects,
      actorId: actor.id,
      amount: actor.shieldHealth,
      lethalObserver,
      registerWorldPainter,
      sourcePlayerId: null,
      tick,
    })
    enemies = damaged.store
    events.push(...damaged.events)
  }

  for (const contact of result.damage) {
    const damaged = applyContact(
      enemies,
      contact,
      tick,
      lethalObserver,
      damageMultiplier(contact.targetId, contact.ownerId),
      registerWorldPainter,
      etherDrainFields,
      enhancedEffects,
    )
    enemies = damaged.enemies
    events.push(...damaged.events)
    captures.push(...damaged.captures)
  }
  enemies = applySecondaryTargetHeadings(enemies, result.targetHeadingChanges)
  return { captures: Object.freeze(captures), enemies, events: Object.freeze(events) }
}

function applySecondaryTargetHeadings(
  source: BoneyardEnemyStore,
  changes: readonly NativeSecondaryTargetHeadingChange[],
): BoneyardEnemyStore {
  if (changes.length === 0) return source
  // Heading commands preserve ordering; copy each store lane once per batch.
  let actors: BoneyardEnemyActor[] | null = null
  let maggots: BoneyardMaggotActor[] | null = null
  for (const change of changes) {
    const actorIndex = source.actors.findIndex(({ id }) => id === change.targetId)
    if (actorIndex >= 0) {
      actors ??= [...source.actors]
      const actor = actors[actorIndex]!
      actors[actorIndex] = {
        ...actor,
        path: change.mode === 'absolute'
          ? { ...actor.path, wanderHeadingDeg: normalizeDegrees(change.degrees) } : actor.path,
        headingDeg: normalizeDegrees(change.mode === 'absolute'
          ? change.degrees : actor.headingDeg + change.degrees),
      }
      continue
    }
    const maggotIndex = source.maggots.findIndex(({ id }) => id === change.targetId)
    if (maggotIndex < 0) continue
    maggots ??= [...source.maggots]
    const maggot = maggots[maggotIndex]!
    maggots[maggotIndex] = {
      ...maggot,
      headingDeg: normalizeDegrees(change.mode === 'absolute'
        ? change.degrees : maggot.headingDeg + change.degrees),
    }
  }
  return actors === null && maggots === null ? source : {
    ...source,
    actors: actors === null ? source.actors : Object.freeze(actors),
    maggots: maggots === null ? source.maggots : Object.freeze(maggots),
  }
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
  lethalObserver?: BoneyardEnemyLethalObserver,
  damageMultiplier = 1,
  registerWorldPainter?: RegisterNativeWorldPainter,
  etherDrainFields: readonly Vector2[] = [],
  enhancedEffects = true,
): BoneyardSecondaryCombatResult {
  if (!Number.isFinite(damageMultiplier) || damageMultiplier < 0) {
    throw new RangeError('secondary damage multiplier must be finite and non-negative')
  }
  const amount = contact.amount * damageMultiplier
  // Rescue/Knockback still own their separate movement, Dazzle and heading work.
  // Their legal zero debit must not enter the strictly-positive health sink.
  if (amount === 0 && Number.isFinite(contact.amount) && contact.amount >= 0) {
    return { captures: [], enemies: source, events: [] }
  }
  const actor = source.actors.find(({ id }) => id === contact.targetId)
  const target = contact.etherDrain === true && nativeEtherDrainCapturesFamily(actor?.config.enemyToken ?? 'MAGGOT')
    ? actor ?? source.maggots.find(({ id }) => id === contact.targetId) : undefined
  const fieldIndex = target === undefined ? -1 : etherDrainFields.findIndex((field) => {
    const dx = field.x - target.position.x
    const dy = field.y - target.position.y
    return dx * dx + dy * dy < 1600
  })
  const damaged = damageBoneyardEnemy(source, {
    enhancedEffects,
    actorId: contact.targetId,
    etherDrainCapture: fieldIndex >= 0,
    hitStrength: contact.hitStrength,
    suppressHitReaction: contact.suppressHitReaction,
    magic: contact.kind !== 'physical',
    amount,
    hasMagicDamage: contact.kind !== 'physical',
    lethalObserver,
    registerWorldPainter,
    sourcePlayerId: contact.ownerId,
    suppressHurtSound: contact.suppressHurtSound,
    tick,
  })
  return { captures: damaged.killed && fieldIndex >= 0 ? [{ actor: actor ?? null, fieldIndex }] : [],
    enemies: damaged.store, events: damaged.events }
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

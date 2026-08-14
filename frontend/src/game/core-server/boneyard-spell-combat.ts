import {
  PRIMARY_SPELL_AIR_REACH,
  PRIMARY_SPELL_ETHER_COLLISION_RADIUS,
  PRIMARY_SPELL_FIRE_COLLISION_RADIUS,
  PRIMARY_SPELL_WATER_REACH,
  type PrimarySpellChannelEmission,
  type PrimarySpellProjectileKind,
  type PrimarySpellProjectileState,
  type PrimarySpellSimulationState,
} from '../core-kernels/primary-spells.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import {
  damageBoneyardEnemy,
  type BoneyardEnemyActor,
  type BoneyardEnemyStore,
  type BoneyardMaggotActor,
} from './boneyard-enemy-store.ts'

export type BoneyardSpellHitKind = PrimarySpellProjectileKind | 'air' | 'water'

export interface BoneyardSpellHit {
  readonly actorId: number
  readonly amount: number
  readonly killed: boolean
  readonly ownerId: string
  readonly spellId: number
  readonly spellKind: BoneyardSpellHitKind
  readonly tick: number
}

export interface BoneyardSpellCombatResult {
  readonly enemies: BoneyardEnemyStore
  readonly hits: readonly BoneyardSpellHit[]
  readonly spells: PrimarySpellSimulationState
}

export type BoneyardSpellWorldContact = (
  start: Readonly<Vector2>,
  end: Readonly<Vector2>,
  radius: number,
) => number | null

const CHANNEL_DAMAGE_PER_TICK = 0.025
const CONTACT_TIE_EPSILON = 1e-9

/**
 * Resolves the spell-contact portion of one authoritative Boneyard tick.
 * Projectile state has already advanced, so its previous position is recovered
 * from the current position and velocity for swept contact.
 */
export function resolveBoneyardSpellCombat(
  sourceEnemies: BoneyardEnemyStore,
  sourceSpells: PrimarySpellSimulationState,
  channelEmissions: readonly PrimarySpellChannelEmission[],
  tick: number,
  worldKey: string,
  firstWorldContact: BoneyardSpellWorldContact | null = null,
): BoneyardSpellCombatResult {
  validateTick(tick)
  let enemies = sourceEnemies
  const consumedProjectileIds = new Set<number>()
  const hits: BoneyardSpellHit[] = []

  for (const projectile of [...sourceSpells.projectiles].sort(bySpellId)) {
    if (projectile.phase !== 'flight' || projectile.worldKey !== worldKey) continue
    const start = previousProjectilePosition(projectile)
    const contact = firstProjectileContact(enemyTargets(enemies), projectile)
    const worldContact = firstWorldContact?.(
      start,
      projectile.position,
      projectileCollisionRadius(projectile),
    ) ?? null
    if (
      worldContact !== null
      && (contact === null || worldContact <= contact.pathProgress)
    ) {
      consumedProjectileIds.add(projectile.id)
      continue
    }
    if (!contact) continue

    const amount = projectileDamage(projectile)
    const damaged = damageBoneyardEnemy(enemies, {
      actorId: contact.actor.id,
      amount,
      sourcePlayerId: projectile.ownerId,
      tick,
    })
    if (!damaged.accepted) continue

    enemies = damaged.store
    consumedProjectileIds.add(projectile.id)
    hits.push({
      actorId: contact.actor.id,
      amount,
      killed: damaged.killed,
      ownerId: projectile.ownerId,
      spellId: projectile.id,
      spellKind: projectile.kind,
      tick,
    })
  }

  for (const emission of [...channelEmissions].sort(bySpellId)) {
    if (emission.worldKey !== worldKey) continue

    for (const contact of rayContacts(
      enemyTargets(enemies),
      emission,
      firstWorldContact,
    )) {
      const damaged = damageBoneyardEnemy(enemies, {
        actorId: contact.actor.id,
        amount: CHANNEL_DAMAGE_PER_TICK,
        sourcePlayerId: emission.ownerId,
        tick,
      })
      if (!damaged.accepted) continue

      enemies = damaged.store
      hits.push({
        actorId: contact.actor.id,
        amount: CHANNEL_DAMAGE_PER_TICK,
        killed: damaged.killed,
        ownerId: emission.ownerId,
        spellId: emission.id,
        spellKind: emission.kind,
        tick,
      })
    }
  }

  const spells = consumedProjectileIds.size === 0
    ? sourceSpells
    : {
        ...sourceSpells,
        projectiles: sourceSpells.projectiles.filter((projectile) => (
          !consumedProjectileIds.has(projectile.id)
        )),
      }

  return {
    enemies,
    hits: Object.freeze(hits),
    spells,
  }
}

interface ActorContact {
  readonly actor: BoneyardSpellTarget
  readonly pathProgress: number
}

type BoneyardSpellTarget = BoneyardEnemyActor | BoneyardMaggotActor

function firstProjectileContact(
  actors: readonly BoneyardSpellTarget[],
  projectile: PrimarySpellProjectileState,
): ActorContact | null {
  const start = previousProjectilePosition(projectile)
  const end = projectile.position
  let first: ActorContact | null = null

  for (const actor of actors) {
    if (actor.lifeState !== 'alive') continue
    const pathProgress = segmentCircleEntry(
      start,
      end,
      actor.position,
      targetRadius(actor) + projectileCollisionRadius(projectile),
    )
    if (pathProgress === null) continue
    const candidate = { actor, pathProgress }
    if (first === null || contactPrecedes(candidate, first)) first = candidate
  }

  return first
}

function previousProjectilePosition(projectile: PrimarySpellProjectileState): Vector2 {
  return {
    x: projectile.position.x - projectile.velocity.x,
    y: projectile.position.y - projectile.velocity.y,
  }
}

function projectileCollisionRadius(projectile: PrimarySpellProjectileState): number {
  switch (projectile.kind) {
    case 'earth': return 0
    case 'ether': return PRIMARY_SPELL_ETHER_COLLISION_RADIUS
    case 'fire': return PRIMARY_SPELL_FIRE_COLLISION_RADIUS
  }
}

function rayContacts(
  actors: readonly BoneyardSpellTarget[],
  emission: PrimarySpellChannelEmission,
  firstWorldContact: BoneyardSpellWorldContact | null,
): readonly ActorContact[] {
  const directionLength = Math.hypot(emission.direction.x, emission.direction.y)
  const reach = emission.kind === 'air'
    ? PRIMARY_SPELL_AIR_REACH
    : PRIMARY_SPELL_WATER_REACH
  const end = directionLength > 0
    ? {
        x: emission.origin.x + emission.direction.x / directionLength * reach,
        y: emission.origin.y + emission.direction.y / directionLength * reach,
      }
    : emission.origin
  const worldContact = firstWorldContact?.(emission.origin, end, 0) ?? null
  const contacts: ActorContact[] = []

  for (const actor of actors) {
    if (actor.lifeState !== 'alive') continue
    const pathProgress = segmentCircleEntry(
      emission.origin,
      end,
      actor.position,
      targetRadius(actor),
    )
    if (
      pathProgress !== null
      && (worldContact === null || pathProgress < worldContact)
    ) {
      contacts.push({ actor, pathProgress })
    }
  }

  return contacts.sort((left, right) => (
    contactPrecedes(left, right) ? -1 : contactPrecedes(right, left) ? 1 : 0
  ))
}

function segmentCircleEntry(
  start: Readonly<Vector2>,
  end: Readonly<Vector2>,
  center: Readonly<Vector2>,
  radius: number,
): number | null {
  const segmentX = end.x - start.x
  const segmentY = end.y - start.y
  const offsetX = start.x - center.x
  const offsetY = start.y - center.y
  const radiusSquared = radius * radius
  const offsetSquared = offsetX * offsetX + offsetY * offsetY
  if (offsetSquared <= radiusSquared) return 0

  const segmentSquared = segmentX * segmentX + segmentY * segmentY
  if (segmentSquared === 0) return null

  const linear = 2 * (offsetX * segmentX + offsetY * segmentY)
  const discriminant = linear * linear
    - 4 * segmentSquared * (offsetSquared - radiusSquared)
  if (discriminant < 0) return null

  const root = Math.sqrt(discriminant)
  const first = (-linear - root) / (2 * segmentSquared)
  const second = (-linear + root) / (2 * segmentSquared)
  if (first >= 0 && first <= 1) return first
  if (second >= 0 && second <= 1) return second
  return null
}

function contactPrecedes(left: ActorContact, right: ActorContact): boolean {
  const progressDifference = left.pathProgress - right.pathProgress
  return Math.abs(progressDifference) <= CONTACT_TIE_EPSILON
    ? left.actor.id < right.actor.id
    : progressDifference < 0
}

function enemyTargets(store: BoneyardEnemyStore): readonly BoneyardSpellTarget[] {
  return [...store.actors, ...store.maggots]
}

function targetRadius(target: BoneyardSpellTarget): number {
  return 'config' in target ? target.config.collisionRadius : target.collisionRadius
}

function projectileDamage(projectile: PrimarySpellProjectileState): number {
  switch (projectile.kind) {
    case 'earth': return 10 * projectile.charge
    case 'ether': return 1 + (projectile.id & 1)
    case 'fire': return 4
  }
}

function bySpellId(
  left: Readonly<{ id: number }>,
  right: Readonly<{ id: number }>,
): number {
  return left.id - right.id
}

function validateTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError('Boneyard spell-combat tick must be a non-negative safe integer')
  }
}

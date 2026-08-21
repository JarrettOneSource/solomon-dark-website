import {
  createPrimarySpellContactImpact,
  PRIMARY_SPELL_EARTH_COLLISION_RADIUS_SCALE,
  PRIMARY_SPELL_ETHER_COLLISION_RADIUS,
  PRIMARY_SPELL_FIRE_COLLISION_RADIUS,
  PRIMARY_SPELL_WATER_REACH,
  type PrimarySpellAirTransientState,
  type PrimarySpellChannelEmission,
  type PrimarySpellProjectileKind,
  type PrimarySpellProjectileState,
  type PrimarySpellSimulationState,
  type PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  firstNativePrimaryPointContact,
  nativePrimaryConeTargets,
  nativePrimaryRootTargets,
  type PrimarySpellTarget,
} from '../core-kernels/primary-spell-targeting.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type { RegisterNativeLightProvider } from '../core-kernels/native-light-provider-order.ts'
import {
  damageBoneyardEnemy,
  type BoneyardEnemyActor,
  type BoneyardEnemyLethalObserver,
  type BoneyardEnemySemanticEvent,
  type BoneyardEnemyStore,
  type BoneyardMaggotActor,
} from './boneyard-enemy-store.ts'

export type BoneyardSpellHitKind = PrimarySpellProjectileKind | 'air' | 'water'
export const WATER_PRIMARY_ACTOR_MASK = 0x1082
export const WATER_PRIMARY_UNDERPOWERED_ACTOR_MASK = 0x2

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
  readonly events: readonly BoneyardEnemySemanticEvent[]
  readonly hits: readonly BoneyardSpellHit[]
  readonly spells: PrimarySpellSimulationState
}

export type BoneyardSpellWorldContact = (
  start: Readonly<Vector2>,
  end: Readonly<Vector2>,
  radius: number,
) => number | null

export type BoneyardSpellDamageMultiplier = (
  actorId: number,
  spellKind: BoneyardSpellHitKind,
) => number

/**
 * Resolves the spell-contact portion of one authoritative Boneyard tick.
 * Projectile state has already advanced. Fire and Ether therefore use the
 * retail post-move single-cell point query, while Earth keeps its projectile
 * and records every root contacted by its charge-scaled gather exactly once.
 */
export function resolveBoneyardSpellCombat(
  sourceEnemies: BoneyardEnemyStore,
  sourceSpells: PrimarySpellSimulationState,
  channelEmissions: readonly PrimarySpellChannelEmission[],
  tick: number,
  worldKey: string,
  firstWorldContact: BoneyardSpellWorldContact | null = null,
  registerLightProvider?: RegisterNativeLightProvider,
  damageMultiplier: BoneyardSpellDamageMultiplier = () => 1,
  fireballSceneryTargets: readonly PrimarySpellTarget[] = [],
  lethalObserver?: BoneyardEnemyLethalObserver,
): BoneyardSpellCombatResult {
  validateTick(tick)
  let enemies = sourceEnemies
  const consumedProjectileIds = new Set<number>()
  const updatedProjectiles = new Map<number, PrimarySpellProjectileState>()
  const hits: BoneyardSpellHit[] = []
  const events: BoneyardEnemySemanticEvent[] = []
  const impactTransients: PrimarySpellTransientState[] = []
  let nextSpellId = sourceSpells.nextId

  const publishContactImpact = (
    projectile: PrimarySpellProjectileState,
    origin: Readonly<Vector2>,
  ): void => {
    const impact = createPrimarySpellContactImpact(
      nextSpellId,
      projectile,
      origin,
      tick,
      registerLightProvider,
    )
    if (!impact) return
    impactTransients.push(impact)
    nextSpellId += 1
  }

  for (const projectile of [...sourceSpells.projectiles].sort(bySpellId)) {
    if (projectile.phase !== 'flight' || projectile.worldKey !== worldKey) continue
    const enemyRows = primaryTargetRows(
      enemies,
      projectile.kind === 'fire'
        ? nextRegistrationOrder(fireballSceneryTargets)
        : 0,
    )
    const rows = projectile.kind === 'fire'
      ? [
          ...fireballSceneryTargets.map((target) => ({ actor: null, target })),
          ...enemyRows,
        ]
      : enemyRows
    if (projectile.kind === 'earth') {
      const priorTargets = new Set(projectile.hitTargetIds)
      const contacts = nativePrimaryRootTargets(
        projectile.position,
        projectile.charge * PRIMARY_SPELL_EARTH_COLLISION_RADIUS_SCALE,
        0x6,
        rows.map(({ target }) => target),
      ).filter(({ id }) => !priorTargets.has(id))
      if (contacts.length === 0) continue

      const hitTargetIds = [...projectile.hitTargetIds]
      for (const target of contacts) {
        hitTargetIds.push(target.id)
        const actor = rows.find(({ target: candidate }) => candidate.id === target.id)?.actor
        if (!actor) continue
        const amount = projectileDamage(projectile)
          * validatedDamageMultiplier(damageMultiplier(actor.id, projectile.kind))
        const damaged = damageBoneyardEnemy(enemies, {
          actorId: actor.id,
          amount,
          lethalObserver,
          sourcePlayerId: projectile.ownerId,
          tick,
        })
        if (!damaged.accepted) continue
        enemies = damaged.store
        events.push(...damaged.events)
        hits.push(spellHit(projectile, actor.id, amount, damaged.killed, tick))
      }
      updatedProjectiles.set(projectile.id, { ...projectile, hitTargetIds })
      continue
    }

    const target = firstNativePrimaryPointContact({
      actorMask: 0x6,
      position: projectile.position,
      queryRadius: projectile.kind === 'fire'
        ? PRIMARY_SPELL_FIRE_COLLISION_RADIUS
        : PRIMARY_SPELL_ETHER_COLLISION_RADIUS,
      targets: rows.map(({ target }) => target),
    })
    if (!target) continue
    const actor = rows.find(({ target: candidate }) => candidate.id === target.id)?.actor
    if (!actor) {
      consumedProjectileIds.add(projectile.id)
      publishContactImpact(projectile, projectile.position)
      continue
    }

    const amount = projectileDamage(projectile)
      * validatedDamageMultiplier(damageMultiplier(actor.id, projectile.kind))
    const damaged = damageBoneyardEnemy(enemies, {
      actorId: actor.id,
      amount,
      lethalObserver,
      sourcePlayerId: projectile.ownerId,
      tick,
    })
    if (!damaged.accepted) continue

    enemies = damaged.store
    events.push(...damaged.events)
    consumedProjectileIds.add(projectile.id)
    publishContactImpact(projectile, projectile.position)
    hits.push(spellHit(projectile, actor.id, amount, damaged.killed, tick))
  }

  for (const emission of [...channelEmissions].sort(bySpellId)) {
    if (emission.worldKey !== worldKey) continue

    const rows = primaryTargetRows(enemies)
    const contacts = emission.kind === 'air'
      ? selectedAirTargets(rows, sourceSpells, emission)
      : nativePrimaryConeTargets({
          actorMask: emission.underpowered
            ? WATER_PRIMARY_UNDERPOWERED_ACTOR_MASK
            : WATER_PRIMARY_ACTOR_MASK,
          aimDirection: emission.direction,
          halfAngleDegrees: 15,
          hasLineOfSight: (target) => (
            firstWorldContact?.(emission.queryOrigin, target.position, 0) ?? null
          ) === null,
          origin: emission.queryOrigin,
          reach: PRIMARY_SPELL_WATER_REACH,
          targets: rows.map(({ target }) => target),
        })
    for (const target of contacts) {
      const actor = rows.find(({ target: candidate }) => candidate.id === target.id)?.actor
      if (!actor) continue
      const amount = emission.damage
        * validatedDamageMultiplier(damageMultiplier(actor.id, emission.kind))
      const damaged = damageBoneyardEnemy(enemies, {
        actorId: actor.id,
        amount,
        lethalObserver,
        sourcePlayerId: emission.ownerId,
        tick,
      })
      if (!damaged.accepted) continue

      enemies = damaged.store
      events.push(...damaged.events)
      hits.push({
        actorId: actor.id,
        amount,
        killed: damaged.killed,
        ownerId: emission.ownerId,
        spellId: emission.id,
        spellKind: emission.kind,
        tick,
      })
    }
  }

  const spells = consumedProjectileIds.size === 0
    && updatedProjectiles.size === 0
    && impactTransients.length === 0
    ? sourceSpells
    : {
        ...sourceSpells,
        nextId: nextSpellId,
        projectiles: sourceSpells.projectiles
          .filter((projectile) => !consumedProjectileIds.has(projectile.id))
          .map((projectile) => updatedProjectiles.get(projectile.id) ?? projectile),
        transients: impactTransients.length === 0
          ? sourceSpells.transients
          : [...sourceSpells.transients, ...impactTransients],
      }

  return {
    enemies,
    events: Object.freeze(events),
    hits: Object.freeze(hits),
    spells,
  }
}

type BoneyardSpellTarget = BoneyardEnemyActor | BoneyardMaggotActor

interface PrimaryTargetRow {
  readonly actor: BoneyardSpellTarget | null
  readonly target: PrimarySpellTarget
}

function selectedAirTargets(
  rows: readonly PrimaryTargetRow[],
  spells: PrimarySpellSimulationState,
  emission: PrimarySpellChannelEmission,
): readonly PrimarySpellTarget[] {
  const transient = spells.transients.find((effect): effect is PrimarySpellAirTransientState => (
    effect.kind === 'air'
    && effect.id === emission.id
    && effect.ownerId === emission.ownerId
    && effect.worldKey === emission.worldKey
  ))
  if (!transient?.targetId) return []
  const row = rows.find(({ target }) => target.id === transient.targetId)
  return row?.target.active && !row.target.pendingRemove ? [row.target] : []
}

function primaryTargetRows(
  store: BoneyardEnemyStore,
  registrationOrderBase = 0,
): readonly PrimaryTargetRow[] {
  return [...store.actors, ...store.maggots].map((actor, registrationOrder) => ({
    actor,
    target: {
      active: actor.lifeState === 'alive',
      actorFlags: 'config' in actor && actor.config.enemyToken === 'COFFIN' ? 0 : 0x2,
      attachment: { x: 0, y: 0 },
      bodyRadius: 'config' in actor ? actor.config.collisionRadius : actor.collisionRadius,
      id: `enemy:${actor.id}`,
      kind: 'enemy',
      nativePriority: 0,
      pendingRemove: false,
      position: { ...actor.position },
      registrationOrder: registrationOrderBase + registrationOrder,
    },
  }))
}

function nextRegistrationOrder(targets: readonly PrimarySpellTarget[]): number {
  return targets.reduce(
    (next, target) => Math.max(next, target.registrationOrder + 1),
    0,
  )
}

function projectileDamage(projectile: PrimarySpellProjectileState): number {
  return projectile.damage
}

function spellHit(
  projectile: PrimarySpellProjectileState,
  actorId: number,
  amount: number,
  killed: boolean,
  tick: number,
): BoneyardSpellHit {
  return {
    actorId,
    amount,
    killed,
    ownerId: projectile.ownerId,
    spellId: projectile.id,
    spellKind: projectile.kind,
    tick,
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

function validatedDamageMultiplier(multiplier: number): number {
  if (!Number.isFinite(multiplier) || multiplier < 0) {
    throw new RangeError('Boneyard spell damage multiplier must be finite and non-negative')
  }
  return multiplier
}

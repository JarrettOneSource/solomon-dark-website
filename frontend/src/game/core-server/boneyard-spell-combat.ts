import {
  createPrimarySpellContactImpact,
  createPrimarySpellFireDetonation,
  PRIMARY_SPELL_EARTH_COLLISION_RADIUS_SCALE,
  PRIMARY_SPELL_ETHER_COLLISION_RADIUS,
  PRIMARY_SPELL_FIRE_COLLISION_RADIUS,
  PRIMARY_SPELL_WATER_REACH,
  type PrimarySpellAirTransientState,
  type PrimarySpellChannelEmission,
  type PrimarySpellFireEmberState,
  type PrimarySpellFireExplosionState,
  type PrimarySpellProjectileKind,
  type PrimarySpellProjectileState,
  type PrimarySpellSimulationState,
  type PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  nativeFireDirectDamage,
  type NativeFireActorContact,
} from '../core-kernels/primary-spell-fire-effects.ts'
import {
  firstNativePrimaryPointContact,
  nativePrimaryConeTargets,
  nativePrimaryRootTargets,
  selectEtherPrimaryTarget,
  type PrimarySpellTarget,
} from '../core-kernels/primary-spell-targeting.ts'
import { consumeNativeEarthBoulderContact } from '../core-kernels/native-earth-boulder.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type { RegisterNativeLightProvider } from '../core-kernels/native-light-provider-order.ts'
import { createNativeRng, type NativeRngState } from '../core-kernels/native-rng.ts'
import {
  damageBoneyardEnemy,
  type BoneyardEnemyActor,
  type BoneyardEnemyLethalObserver,
  type BoneyardEnemySemanticEvent,
  type BoneyardEnemyStore,
  type BoneyardMaggotActor,
} from './boneyard-enemy-store.ts'

export type BoneyardSpellHitKind =
  | PrimarySpellProjectileKind
  | 'air'
  | 'fire-ember'
  | 'fire-explosion'
  | 'fire-good-imp'
  | 'fire-patch'
  | 'water'
export const WATER_PRIMARY_ACTOR_MASK = 0x1082
export const WATER_PRIMARY_UNDERPOWERED_ACTOR_MASK = 0x2

export interface BoneyardSpellBurnContact {
  readonly damage: number
  readonly ownerId: string
  readonly targetId: number
}

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
  readonly burns: readonly BoneyardSpellBurnContact[]
  readonly enemies: BoneyardEnemyStore
  readonly events: readonly BoneyardEnemySemanticEvent[]
  readonly hits: readonly BoneyardSpellHit[]
  readonly rng: NativeRngState
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
  sourceRng: NativeRngState = createNativeRng(0),
  firstWorldContact: BoneyardSpellWorldContact | null = null,
  registerLightProvider?: RegisterNativeLightProvider,
  damageMultiplier: BoneyardSpellDamageMultiplier = () => 1,
  fireballSceneryTargets: readonly PrimarySpellTarget[] = [],
  lethalObserver?: BoneyardEnemyLethalObserver,
  fireActorContacts: readonly NativeFireActorContact[] = [],
): BoneyardSpellCombatResult {
  validateTick(tick)
  let enemies = sourceEnemies
  const consumedProjectileIds = new Set<number>()
  const consumedTransientIds = new Set<number>()
  const updatedProjectiles = new Map<number, PrimarySpellProjectileState>()
  const hits: BoneyardSpellHit[] = []
  const burns: BoneyardSpellBurnContact[] = []
  const events: BoneyardEnemySemanticEvent[] = []
  const impactTransients: PrimarySpellTransientState[] = []
  let nextSpellId = sourceSpells.nextId
  let rng = sourceRng
  const queueBurn = (targetId: number, ownerId: string, damage: number): void => {
    if (damage <= 0) return
    burns.push(Object.freeze({ damage, ownerId, targetId }))
  }

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
      let remainingDamage = projectile.remainingDamage
      for (const target of contacts) {
        if (remainingDamage < 0.001) break
        hitTargetIds.push(target.id)
        const actor = rows.find(({ target: candidate }) => candidate.id === target.id)?.actor
        if (!actor) continue
        const contact = consumeNativeEarthBoulderContact(
          remainingDamage,
          Math.max(0, actor.currentHealth),
          projectile.toughness,
        )
        const amount = contact.damage
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
        remainingDamage = contact.remainingPool
        hits.push(spellHit(projectile, actor.id, amount, damaged.killed, tick))
      }
      if (remainingDamage < 0.001) {
        consumedProjectileIds.add(projectile.id)
        publishContactImpact(projectile, projectile.position)
      } else {
        updatedProjectiles.set(projectile.id, {
          ...projectile,
          hitTargetIds,
          remainingDamage,
        })
      }
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

    if (projectile.kind === 'fire') {
      queueBurn(
        actor.id,
        projectile.ownerId,
        projectile.burnDamage,
      )
      const amount = nativeFireDirectDamage(projectile.damage, projectile.explodeDamage)
      const damaged = damageBoneyardEnemy(enemies, {
        actorId: actor.id,
        amount,
        sourcePlayerId: projectile.ownerId,
        tick,
      })
      if (!damaged.accepted) continue
      enemies = damaged.store
      events.push(...damaged.events)
      hits.push(spellHit(projectile, actor.id, amount, damaged.killed, tick))
      consumedProjectileIds.add(projectile.id)
      const detonation = createPrimarySpellFireDetonation(
        nextSpellId,
        projectile,
        projectile.position,
        rng,
        registerLightProvider,
      )
      rng = detonation.rng
      impactTransients.push(...detonation.transients)
      nextSpellId = detonation.nextId
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
    hits.push(spellHit(projectile, actor.id, amount, damaged.killed, tick))
    if (projectile.kind === 'ether' && projectile.piercesRemaining > 0) {
      const continuation = continuePiercingEtherProjectile(
        projectile,
        target,
        rows.map(({ target: rowTarget }) => rowTarget),
      )
      updatedProjectiles.set(projectile.id, continuation.projectile)
      for (const origin of continuation.streakOrigins) {
        impactTransients.push({
          ageTicks: 0,
          headingDegrees: projectile.headingDegrees,
          id: nextSpellId,
          kind: 'ether-pierce-streak',
          origin,
          ownerId: projectile.ownerId,
          visualScale: continuation.projectile.visualScale,
          worldKey: projectile.worldKey,
        })
        nextSpellId += 1
      }
      continue
    }
    consumedProjectileIds.add(projectile.id)
    publishContactImpact(projectile, projectile.position)
  }

  for (const effect of [...sourceSpells.transients].sort(bySpellId)) {
    if (effect.worldKey !== worldKey) continue
    if (effect.kind === 'fire-ember') {
      const rows = primaryTargetRows(enemies)
      const target = firstNativePrimaryPointContact({
        actorMask: 0x2,
        position: effect.position,
        queryRadius: 7,
        targets: rows.map(({ target: rowTarget }) => rowTarget),
      })
      if (!target) continue
      const actor = rows.find(({ target: candidate }) => candidate.id === target.id)?.actor
      if (!actor) continue
      queueBurn(actor.id, effect.ownerId, effect.burnDamage)
      const damaged = damageBoneyardEnemy(enemies, {
        actorId: actor.id,
        amount: effect.damage,
        sourcePlayerId: effect.ownerId,
        tick,
      })
      if (!damaged.accepted) continue
      enemies = damaged.store
      events.push(...damaged.events)
      hits.push(transientSpellHit(effect, actor.id, effect.damage, damaged.killed, tick))
      consumedTransientIds.add(effect.id)
      impactTransients.push({
        ageTicks: 0,
        id: nextSpellId,
        kind: 'fire-impact',
        lightRegistration: registerLightProvider?.('transient') ?? {
          managerLane: 'transient',
          registrationOrdinal: nextSpellId,
        },
        origin: { ...effect.position },
        ownerId: effect.ownerId,
        worldKey: effect.worldKey,
      })
      nextSpellId += 1
    }
  }

  const explosions = [...sourceSpells.transients, ...impactTransients]
    .filter((effect): effect is PrimarySpellFireExplosionState => (
      effect.kind === 'fire-explosion' && effect.ageTicks === 0
    ))
    .sort(bySpellId)
  for (const effect of explosions) {
    if (effect.worldKey !== worldKey) continue
    const rows = nativeFireExplosionTargets(primaryTargetRows(enemies), effect)
    for (const { actor } of rows) {
      queueBurn(actor.id, effect.ownerId, effect.burnDamage)
      const damaged = damageBoneyardEnemy(enemies, {
        actorId: actor.id,
        amount: effect.damage,
        sourcePlayerId: effect.ownerId,
        tick,
      })
      if (!damaged.accepted) continue
      enemies = damaged.store
      events.push(...damaged.events)
      hits.push(transientSpellHit(effect, actor.id, effect.damage, damaged.killed, tick))
    }
  }

  for (const contact of [...fireActorContacts].sort((left, right) => (
    left.spellId - right.spellId
  ))) {
    if (contact.worldKey !== worldKey) continue
    const rows = primaryTargetRows(enemies)
    const contacted = contact.kind === 'fire-good-imp'
      ? rows.filter(({ target }) => target.id === contact.targetId)
      : rows.filter(({ target }) => (
          target.active
          && !target.pendingRemove
          && (target.actorFlags & 0x2) !== 0
          && Math.abs(target.position.x - contact.position.x)
            < contact.footprintDimension * 0.5
          && Math.abs(target.position.y - contact.position.y)
            < contact.footprintDimension * 0.5
        ))
    for (const { actor } of contacted) {
      if (contact.kind === 'fire-patch') {
        queueBurn(
          actor.id,
          contact.ownerId,
          contact.burnDamage,
        )
      }
      const amount = contact.amount
        * validatedDamageMultiplier(damageMultiplier(actor.id, contact.kind))
      const damaged = damageBoneyardEnemy(enemies, {
        actorId: actor.id,
        amount,
        sourcePlayerId: contact.ownerId,
        tick,
      })
      if (!damaged.accepted) continue
      enemies = damaged.store
      events.push(...damaged.events)
      hits.push({
        actorId: actor.id,
        amount,
        killed: damaged.killed,
        ownerId: contact.ownerId,
        spellId: contact.spellId,
        spellKind: contact.kind,
        tick,
      })
    }
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
    && consumedTransientIds.size === 0
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
          ? sourceSpells.transients.filter((effect) => !consumedTransientIds.has(effect.id))
          : [
              ...sourceSpells.transients.filter((effect) => !consumedTransientIds.has(effect.id)),
              ...impactTransients,
            ],
      }

  return {
    burns: Object.freeze(burns),
    enemies,
    events: Object.freeze(events),
    hits: Object.freeze(hits),
    rng,
    spells,
  }
}

function continuePiercingEtherProjectile(
  projectile: Extract<PrimarySpellProjectileState, { kind: 'ether' }>,
  contacted: PrimarySpellTarget,
  targets: readonly PrimarySpellTarget[],
): {
  projectile: Extract<PrimarySpellProjectileState, { kind: 'ether' }>
  streakOrigins: readonly Vector2[]
} {
  const position = { ...projectile.position }
  const streakOrigins: Vector2[] = []
  while (true) {
    position.x = Math.fround(position.x + projectile.direction.x * 5)
    position.y = Math.fround(position.y + projectile.direction.y * 5)
    streakOrigins.push({ ...position })
    const radius = PRIMARY_SPELL_ETHER_COLLISION_RADIUS + contacted.bodyRadius
    const dx = contacted.position.x - position.x
    const dy = contacted.position.y - position.y
    if (dx * dx + dy * dy >= radius * radius) break
  }
  const target = selectEtherPrimaryTarget({
    aimDirection: projectile.direction,
    origin: position,
    targets: targets.filter(({ id }) => id !== contacted.id),
  })
  return {
    projectile: {
      ...projectile,
      damage: projectile.damage * projectile.damageRetention,
      piercesRemaining: projectile.piercesRemaining - 1,
      position,
      targetId: target?.id ?? null,
      visualScale: projectile.visualScale * projectile.damageRetention,
    },
    streakOrigins,
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

function nativeFireExplosionTargets(
  rows: readonly PrimaryTargetRow[],
  explosion: PrimarySpellFireExplosionState,
): readonly PrimaryTargetRow[] {
  return rows.filter(({ target }) => (
    target.active
    && !target.pendingRemove
    && (target.actorFlags & 0x2) !== 0
    && Math.abs(target.position.x - explosion.origin.x) < explosion.footprintDimension * 0.5
    && Math.abs(target.position.y - explosion.origin.y) < explosion.footprintDimension * 0.5
  ))
}

function transientSpellHit(
  effect: PrimarySpellFireEmberState | PrimarySpellFireExplosionState,
  actorId: number,
  amount: number,
  killed: boolean,
  tick: number,
): BoneyardSpellHit {
  return {
    actorId,
    amount,
    killed,
    ownerId: effect.ownerId,
    spellId: effect.id,
    spellKind: effect.kind,
    tick,
  }
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

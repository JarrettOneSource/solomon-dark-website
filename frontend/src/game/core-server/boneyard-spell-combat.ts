import {
  createPrimarySpellContactImpact,
  createPrimarySpellFireDetonation,
  PRIMARY_SPELL_EARTH_COLLISION_RADIUS_SCALE,
  PRIMARY_SPELL_ETHER_COLLISION_RADIUS,
  PRIMARY_SPELL_FIRE_COLLISION_RADIUS,
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
  createNativeWaterAuraActor,
  createNativeWaterHailActor,
  drawNativeDisintegratePercentile,
  drawNativeSpellDamage,
  stepNativeWaterHailActor,
} from '../core-kernels/air-water-spell-actors.ts'
import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'
import { waterFrostJetPlan } from '../core-kernels/primary-spell-water.ts'
import {
  airPrimaryBoltGeometry,
  firstNativePrimaryPointContact,
  nativePrimaryConeTargets,
  nativePrimaryRootTargets,
  nativePrimaryTargetEligible,
  primarySpellTargetPoint,
  selectEtherPrimaryTarget,
  type PrimarySpellTarget,
} from '../core-kernels/primary-spell-targeting.ts'
import { consumeNativeEarthBoulderContact } from '../core-kernels/native-earth-boulder.ts'
import type { NativeSecondaryTargetEffectPatch } from '../core-kernels/native-secondary-abilities.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type { RegisterNativeLightProvider } from '../core-kernels/native-light-provider-order.ts'
import {
  damageBoneyardEnemy,
  positionBoneyardEnemy,
  type BoneyardEnemyActor,
  type BoneyardEnemyLethalObserver,
  type BoneyardEnemySemanticEvent,
  type BoneyardEnemyStore,
  type BoneyardMaggotActor,
} from './boneyard-enemy-store.ts'

export type BoneyardSpellHitKind =
  | PrimarySpellProjectileKind
  | 'air'
  | 'air-storm'
  | 'fire-ember'
  | 'fire-explosion'
  | 'fire-good-imp'
  | 'fire-patch'
  | 'water'
  | 'water-hail'
export const WATER_PRIMARY_ACTOR_MASK = 0x1082
export const WATER_PRIMARY_UNDERPOWERED_ACTOR_MASK = 0x2

export interface BoneyardSpellBurnContact {
  readonly damage: number
  readonly ownerId: string
  readonly targetId: number
}

export interface BoneyardSpellTargetEffectContact {
  readonly patch: NativeSecondaryTargetEffectPatch
  readonly targetId: number
  readonly worldKey: string
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
  readonly targetEffects: readonly BoneyardSpellTargetEffectContact[]
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

export type ResolveBoneyardSpellEnemyMovement = (
  actorId: number,
  start: Readonly<Vector2>,
  requested: Readonly<Vector2>,
  radius: number,
) => Readonly<Vector2>

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
  resolveEnemyMovement: ResolveBoneyardSpellEnemyMovement = (_actorId, _start, requested) => (
    requested
  ),
): BoneyardSpellCombatResult {
  validateTick(tick)
  let enemies = sourceEnemies
  let rng = sourceRng
  const consumedProjectileIds = new Set<number>()
  const consumedTransientIds = new Set<number>()
  const updatedProjectiles = new Map<number, PrimarySpellProjectileState>()
  const hits: BoneyardSpellHit[] = []
  const burns: BoneyardSpellBurnContact[] = []
  const events: BoneyardEnemySemanticEvent[] = []
  const targetEffects: BoneyardSpellTargetEffectContact[] = []
  const impactTransients: PrimarySpellTransientState[] = []
  const ownedTransients: PrimarySpellTransientState[] = []
  let nextSpellId = sourceSpells.nextId
  const queueBurn = (targetId: number, ownerId: string, damage: number): void => {
    if (damage <= 0) return
    burns.push(Object.freeze({ damage, ownerId, targetId }))
  }
  const queueTargetEffect = (
    targetId: number,
    patch: NativeSecondaryTargetEffectPatch,
  ): void => {
    targetEffects.push(Object.freeze({ patch: Object.freeze({ ...patch }), targetId, worldKey }))
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

  for (const contact of [...fireActorContacts].sort(byFireActorContactId)) {
    if (contact.worldKey !== worldKey) continue
    const rows = primaryTargetRows(enemies)
    const contacted = contact.kind === 'fire-good-imp'
      ? rows.filter(({ target }) => target.id === contact.targetId)
      : rows.filter(({ target }) => (
          target.active
          && !target.pendingRemove
          && (target.actorFlags & 0x2) !== 0
          && squaredDistance(target.position, contact.position) < contact.radius ** 2
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
    if (emission.kind === 'air') {
      if (emission.primarySkill.kind !== 'air') {
        throw new Error('Air channel emission does not own an Air skill payload')
      }
      const rows = primaryTargetRows(enemies)
      const first = selectedAirTargets(rows, sourceSpells, emission)[0]
      if (!first) continue
      const contactedIds = new Set<string>()
      let target: PrimarySpellTarget | null = first
      let damage = emission.damage
      let previousPoint = emission.origin
      for (let hop = 0; target && hop <= emission.primarySkill.arcCount; hop += 1) {
        const row = primaryTargetRows(enemies).find(({ target: candidate }) => (
          candidate.id === target!.id
        ))
        if (!row || !nativePrimaryTargetEligible(row.target, 0x2)) break
        contactedIds.add(row.target.id)

        const stun = airStunModifier(emission)
        if (stun) queueTargetEffect(row.actor.id, stun)
        let disintegrate = false
        if (
          !emission.underpowered
          && emission.primarySkill.disintegrateChance > 0
          && (row.target.actorFlags & 0x2) !== 0
          && tick % 40 === row.target.registrationOrder % 40
        ) {
          const draw = drawNativeDisintegratePercentile(
            rng,
            emission.primarySkill.disintegrateChance,
          )
          rng = draw.rng
          disintegrate = draw.success
        }
        // Lightning consumes this visual scalar after the optional execute
        // roll even though the web renderer receives semantic bolt geometry.
        const contactScalar = drawNativeFloat(rng, Math.fround(0.5))
        rng = contactScalar.state
        const electricDamage = damage * validatedDamageMultiplier(
          damageMultiplier(row.actor.id, 'air'),
        )
        const contact = applyDamageWithDisintegrate(
          enemies,
          row.actor.id,
          electricDamage,
          emission.ownerId,
          tick,
          disintegrate,
        )
        enemies = contact.enemies
        events.push(...contact.events)
        if (contact.accepted) {
          hits.push({
            actorId: row.actor.id,
            amount: contact.amount,
            killed: contact.killed,
            ownerId: emission.ownerId,
            spellId: emission.id,
            spellKind: 'air',
            tick,
          })
        }

        const currentPoint = primarySpellTargetPoint(row.target)
        if (hop > 0) {
          const direction = normalizedDifference(previousPoint, currentPoint)
          const geometry = airPrimaryBoltGeometry(previousPoint, direction, currentPoint)
          ownedTransients.push({
            ageTicks: 0,
            birthTick: tick,
            direction,
            endpoint: geometry.endpoint,
            hurricaneCharge: 0,
            id: nextSpellId,
            kind: 'air',
            lightRegistration: registerLightProvider?.('transient') ?? {
              managerLane: 'transient',
              registrationOrdinal: nextSpellId,
            },
            midpoint: geometry.midpoint,
            origin: geometry.source,
            ownerId: emission.ownerId,
            targetId: row.target.id,
            underpowered: emission.underpowered,
            variant: nextSpellId % 4,
            worldKey,
          })
          nextSpellId += 1
        }
        previousPoint = currentPoint
        damage = Math.fround(damage * NATIVE_LIGHTNING_CHAIN_DAMAGE_FACTOR)
        target = emission.underpowered || hop >= emission.primarySkill.arcCount
          ? null
          : nearestUnusedAirChainTarget(
          primaryTargetRows(enemies).map(({ target: candidate }) => candidate),
          row.target.position,
          contactedIds,
          )
      }
      continue
    }

    if (emission.primarySkill.kind !== 'water') {
      throw new Error('Water channel emission does not own a Water skill payload')
    }
    const profile = emission.primarySkill
    if (!emission.underpowered && profile.hailThreshold > 0) {
      for (const frost of waterEmissionTransients(sourceSpells, emission)) {
        const visualGate = drawNativeInteger(rng, 250)
        rng = visualGate.state
        if (visualGate.value >= profile.hailThreshold) continue
        const plan = waterFrostJetPlan(frost)
        const hail = createNativeWaterHailActor(
          nextSpellId,
          emission.ownerId,
          worldKey,
          tick,
          plan.position,
          frost.direction,
          rng,
        )
        rng = hail.rng
        ownedTransients.push(hail.actor)
        nextSpellId += 1
      }
    }
    if (!emission.underpowered && profile.auraRadius > 0) {
      for (const row of nativePrimaryRootTargetRows(
        enemies,
        emission.queryOrigin,
        profile.auraRadius,
        0x2,
      )) {
        queueTargetEffect(row.actor.id, {
          coldSlowFactor: profile.auraMovementFactor,
          coldSlowTicks: profile.coldDurationTicks,
        })
      }
      if (tick % 6 === 0) {
        const aura = createNativeWaterAuraActor(
          nextSpellId,
          emission.ownerId,
          worldKey,
          tick,
          emission.queryOrigin,
          profile.auraRadius,
          rng,
        )
        rng = aura.rng
        ownedTransients.push(aura.actor)
        nextSpellId += 1
      }
    }

    const rows = primaryTargetRows(enemies)
    const contacts = nativePrimaryConeTargets({
      actorMask: emission.underpowered
        ? WATER_PRIMARY_UNDERPOWERED_ACTOR_MASK
        : WATER_PRIMARY_ACTOR_MASK,
      aimDirection: emission.direction,
      halfAngleDegrees: emission.underpowered ? 15 : profile.halfAngleDegrees,
      hasLineOfSight: (target) => (
        firstWorldContact?.(emission.queryOrigin, target.position, 0) ?? null
      ) === null,
      origin: emission.queryOrigin,
      reach: emission.underpowered ? 205 : profile.reach,
      targets: rows.map(({ target }) => target),
    })
    for (const target of contacts) {
      const row = primaryTargetRows(enemies).find(({ target: candidate }) => (
        candidate.id === target.id
      ))
      if (!row) continue
      queueTargetEffect(row.actor.id, {
        coldSlowFactor: emission.underpowered ? 0.75 : profile.coldMovementFactor,
        coldSlowTicks: emission.underpowered ? 25 : profile.coldDurationTicks,
      })
      if (!emission.underpowered && profile.pushbackPercent > 0) {
        enemies = applyWaterPushback(
          enemies,
          row.actor,
          emission.queryOrigin,
          profile.pushbackPercent,
          profile.reach,
          resolveEnemyMovement,
        )
      }
      const amount = emission.damage * validatedDamageMultiplier(
        damageMultiplier(row.actor.id, 'water'),
      )
      const damaged = damageBoneyardEnemy(enemies, {
        actorId: row.actor.id,
        amount,
        lethalObserver,
        sourcePlayerId: emission.ownerId,
        tick,
      })
      if (!damaged.accepted) continue
      enemies = damaged.store
      events.push(...damaged.events)
      hits.push({
        actorId: row.actor.id,
        amount,
        killed: damaged.killed,
        ownerId: emission.ownerId,
        spellId: emission.id,
        spellKind: 'water',
        tick,
      })

      if (emission.underpowered || profile.hailThreshold <= 0) continue
      const hail = drawNativeInteger(rng, 3_000)
      rng = hail.state
      if (hail.value >= profile.hailThreshold) continue
      const hailDamage = drawNativeSpellDamage(
        rng,
        profile.hailDamageMinimum,
        profile.hailDamageMaximum,
      )
      rng = hailDamage.rng
      const hailContact = damageBoneyardEnemy(enemies, {
        actorId: row.actor.id,
        amount: hailDamage.value,
        sourcePlayerId: emission.ownerId,
        tick,
      })
      if (!hailContact.accepted) continue
      enemies = hailContact.store
      events.push(...hailContact.events)
      hits.push({
        actorId: row.actor.id,
        amount: hailDamage.value,
        killed: hailContact.killed,
        ownerId: emission.ownerId,
        spellId: emission.id,
        spellKind: 'water-hail',
        tick,
      })
    }
  }

  const steppedTransients: PrimarySpellTransientState[] = []
  for (const effect of sourceSpells.transients) {
    if (effect.worldKey !== worldKey) {
      steppedTransients.push(effect)
      continue
    }
    if (effect.kind === 'water-hail') {
      if (effect.birthTick === tick) {
        steppedTransients.push(effect)
        continue
      }
      const stepped = stepNativeWaterHailActor(effect, rng)
      rng = stepped.rng
      if (stepped.actor) steppedTransients.push(stepped.actor)
      continue
    }
    steppedTransients.push(effect)
  }

  const spells = consumedProjectileIds.size === 0
    && consumedTransientIds.size === 0
    && updatedProjectiles.size === 0
    && impactTransients.length === 0
    && ownedTransients.length === 0
    && steppedTransients.length === sourceSpells.transients.length
    && steppedTransients.every((effect, index) => effect === sourceSpells.transients[index])
    ? sourceSpells
    : {
        ...sourceSpells,
        nextId: nextSpellId,
        projectiles: sourceSpells.projectiles
          .filter((projectile) => !consumedProjectileIds.has(projectile.id))
          .map((projectile) => updatedProjectiles.get(projectile.id) ?? projectile),
        transients: [
          ...steppedTransients
            .filter((effect) => !consumedTransientIds.has(effect.id)),
          ...impactTransients,
          ...ownedTransients,
        ],
      }

  return {
    burns: Object.freeze(burns),
    enemies,
    events: Object.freeze(events),
    hits: Object.freeze(hits),
    rng,
    spells,
    targetEffects: Object.freeze(targetEffects),
  }
}

function waterEmissionTransients(
  spells: PrimarySpellSimulationState,
  emission: PrimarySpellChannelEmission,
): readonly Extract<PrimarySpellTransientState, { kind: 'water' }>[] {
  return spells.transients.filter((effect): effect is Extract<
    PrimarySpellTransientState,
    { kind: 'water' }
  > => (
    effect.kind === 'water'
    && effect.ownerId === emission.ownerId
    && effect.worldKey === emission.worldKey
    && effect.id >= emission.id
    && effect.id < emission.id + 2
  )).sort(bySpellId)
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

const NATIVE_LIGHTNING_CHAIN_RADIUS = 200
const NATIVE_LIGHTNING_CHAIN_DAMAGE_FACTOR = Math.fround(0.600000024)
const NATIVE_LIGHTNING_STUN_TICKS = 25
const NATIVE_CHILL_BASE_REACH_OFFSET = 25
const NATIVE_CHILL_OUTER_RADIUS_FACTOR = 0.75
const NATIVE_CHILL_INNER_RADIUS_FACTOR = 0.5
const NATIVE_CHILL_IMPULSE_FACTOR = 2.5

function nearestUnusedAirChainTarget(
  targets: readonly PrimarySpellTarget[],
  origin: Readonly<Vector2>,
  contactedIds: ReadonlySet<string>,
): PrimarySpellTarget | null {
  let selected: PrimarySpellTarget | null = null
  let selectedDistanceSquared = Number.POSITIVE_INFINITY
  for (const target of nativePrimaryRootTargets(
    { ...origin },
    NATIVE_LIGHTNING_CHAIN_RADIUS,
    0x2,
    targets,
  )) {
    if (contactedIds.has(target.id)) continue
    const distanceSquared = squaredDistance(origin, target.position)
    if (distanceSquared < selectedDistanceSquared) {
      selected = target
      selectedDistanceSquared = distanceSquared
    }
  }
  return selected
}

function airStunModifier(
  emission: PrimarySpellChannelEmission,
): NativeSecondaryTargetEffectPatch | null {
  if (
    emission.underpowered
    ||
    emission.primarySkill.kind !== 'air'
    || emission.primarySkill.stunMovementFactor >= 1
  ) return null
  return {
    stunFactor: emission.primarySkill.stunMovementFactor,
    stunTicks: NATIVE_LIGHTNING_STUN_TICKS,
  }
}

function applyDamageWithDisintegrate(
  source: BoneyardEnemyStore,
  actorId: number,
  amount: number,
  ownerId: string,
  tick: number,
  disintegrate: boolean,
): {
  readonly accepted: boolean
  readonly amount: number
  readonly enemies: BoneyardEnemyStore
  readonly events: readonly BoneyardEnemySemanticEvent[]
  readonly killed: boolean
} {
  const ordinary = damageBoneyardEnemy(source, {
    actorId,
    amount,
    sourcePlayerId: ownerId,
    tick,
  })
  if (!ordinary.accepted || ordinary.killed || !disintegrate) {
    return {
      accepted: ordinary.accepted,
      amount,
      enemies: ordinary.store,
      events: ordinary.events,
      killed: ordinary.killed,
    }
  }
  const target = boneyardSpellTargetById(ordinary.store, actorId)
  if (!target || target.currentHealth >= targetMaximumHealth(target) * 0.2) {
    return {
      accepted: true,
      amount,
      enemies: ordinary.store,
      events: ordinary.events,
      killed: false,
    }
  }
  const executeAmount = target.currentHealth
  if (executeAmount <= 0) {
    return {
      accepted: true,
      amount,
      enemies: ordinary.store,
      events: ordinary.events,
      killed: false,
    }
  }
  const executed = damageBoneyardEnemy(ordinary.store, {
    actorId,
    amount: executeAmount,
    sourcePlayerId: ownerId,
    tick,
  })
  return {
    accepted: true,
    amount: amount + (executed.accepted ? executeAmount : 0),
    enemies: executed.store,
    events: executed.accepted
      ? Object.freeze([...ordinary.events, ...executed.events])
      : ordinary.events,
    killed: executed.accepted && executed.killed,
  }
}

function applyWaterPushback(
  source: BoneyardEnemyStore,
  actor: BoneyardSpellTarget,
  origin: Readonly<Vector2>,
  pushback: number,
  reach: number,
  resolveMovement: ResolveBoneyardSpellEnemyMovement,
): BoneyardEnemyStore {
  const distanceSquared = squaredDistance(origin, actor.position)
  const baseRadius = reach - NATIVE_CHILL_BASE_REACH_OFFSET
  const outerSquared = NATIVE_CHILL_OUTER_RADIUS_FACTOR * baseRadius * baseRadius
  if (distanceSquared >= outerSquared) return source
  const innerSquared = NATIVE_CHILL_INNER_RADIUS_FACTOR * outerSquared
  const attenuation = distanceSquared <= innerSquared
    ? 1
    : (outerSquared - distanceSquared) / (outerSquared - innerSquared)
  const distance = Math.sqrt(distanceSquared)
  if (distance === 0) return source
  const magnitude = pushback * NATIVE_CHILL_IMPULSE_FACTOR * attenuation
  const requested = {
    x: actor.position.x + (actor.position.x - origin.x) / distance * magnitude,
    y: actor.position.y + (actor.position.y - origin.y) / distance * magnitude,
  }
  const resolved = resolveMovement(
    actor.id,
    actor.position,
    requested,
    targetBodyRadius(actor),
  )
  return positionBoneyardEnemy(source, actor.id, resolved).store
}

function nativePrimaryRootTargetRows(
  store: BoneyardEnemyStore,
  origin: Readonly<Vector2>,
  reach: number,
  actorMask: number,
): readonly PrimaryTargetRow[] {
  const rows = primaryTargetRows(store)
  const targets = new Set(nativePrimaryRootTargets(
    { ...origin },
    reach,
    actorMask,
    rows.map(({ target }) => target),
  ).map(({ id }) => id))
  return rows.filter(({ target }) => targets.has(target.id))
}

function boneyardSpellTargetById(
  store: BoneyardEnemyStore,
  actorId: number,
): BoneyardSpellTarget | null {
  return store.actors.find(({ id }) => id === actorId)
    ?? store.maggots.find(({ id }) => id === actorId)
    ?? null
}

function targetMaximumHealth(target: BoneyardSpellTarget): number {
  return 'config' in target ? target.config.maximumHealth : target.maximumHealth
}

function targetBodyRadius(target: BoneyardSpellTarget): number {
  return 'config' in target ? target.config.collisionRadius : target.collisionRadius
}

function normalizedDifference(
  origin: Readonly<Vector2>,
  target: Readonly<Vector2>,
): Vector2 {
  const x = target.x - origin.x
  const y = target.y - origin.y
  const length = Math.hypot(x, y)
  return length === 0 ? { x: 0, y: -1 } : { x: x / length, y: y / length }
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

function byFireActorContactId(
  left: NativeFireActorContact,
  right: NativeFireActorContact,
): number {
  return left.spellId - right.spellId
}

function squaredDistance(
  left: Readonly<Vector2>,
  right: Readonly<Vector2>,
): number {
  const deltaX = left.x - right.x
  const deltaY = left.y - right.y
  return deltaX * deltaX + deltaY * deltaY
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

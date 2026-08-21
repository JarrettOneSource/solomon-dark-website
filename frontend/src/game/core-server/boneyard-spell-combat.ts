import {
  createPrimarySpellContactImpact,
  createPrimarySpellFireDetonation,
  createPrimarySpellWeldFireDetonation,
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
import {
  drawNativeHurricaneDamage,
  nativeHurricaneMovementDue,
  nativeHurricaneOrbitForce,
  NATIVE_HURRICANE_CONTACT_COOLDOWN,
} from '../core-kernels/native-hurricane.ts'
import { waterFrostJetPlan } from '../core-kernels/primary-spell-water.ts'
import {
  nativeEtherBlastDamage,
  NATIVE_ETHER_BLAST_CONTACT_RADIUS,
} from '../core-kernels/native-ether-blast.ts'
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
import type {
  NativeSecondarySteamedPulse,
  NativeSecondaryTargetEffectPatch,
} from '../core-kernels/native-secondary-abilities.ts'
import {
  createNativeWeldBoulderDebrisActor,
  nativeWeldHailstoneDrawOffset,
  nativeWeldHailstoneFlightContactSubsteps,
  retainNativeWeldHailstoneDamage,
  retainNativeWeldPersistentActorContacts,
} from '../core-kernels/native-weld-primary-runtime.ts'
import { createNativeWeldBoulderContactDebrisProgram } from '../core-kernels/native-weld-boulder-debris.ts'
import {
  createNativeWeldHailContactPresentation,
  createNativeWeldHailKnockback,
  NATIVE_WELD_HAIL_COLD_SLOW_FACTOR,
  NATIVE_WELD_HAIL_COLD_SLOW_TICKS,
  NATIVE_WELD_HAIL_FLIGHT_SUBSTEPS,
  NATIVE_WELD_HAIL_TARGET_RADIUS_FACTOR,
} from '../core-kernels/native-weld-hail-contact.ts'
import { createNativeWeldFlameLashFade } from '../core-kernels/native-weld-flame-lash.ts'
import {
  nativeWeldMeteorDirectRadius,
  nativeWeldMeteorPulseRadius,
} from '../core-kernels/native-weld-meteor.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import type { RegisterNativeLightProvider } from '../core-kernels/native-light-provider-order.ts'
import {
  damageBoneyardEnemy,
  positionBoneyardEnemy,
  setBoneyardEnemyHurricaneContactCooldown,
  tumbleBoneyardArrow,
  type BoneyardEnemyActor,
  type BoneyardEnemyLethalObserver,
  type BoneyardEnemyProjectile,
  type BoneyardEnemySemanticEvent,
  type BoneyardEnemyStore,
  type BoneyardMaggotActor,
} from './boneyard-enemy-store.ts'

export type BoneyardSpellHitKind =
  | PrimarySpellProjectileKind
  | 'air'
  | 'air-hurricane'
  | 'air-storm'
  | 'ether-blast'
  | 'fire-ember'
  | 'fire-explosion'
  | 'fire-good-imp'
  | 'fire-patch'
  | 'water'
  | 'water-hail'
export const WATER_PRIMARY_ACTOR_MASK = 0x1082
export const WATER_PRIMARY_UNDERPOWERED_ACTOR_MASK = 0x2
export const NATIVE_CHILL_ARROW_TUMBLE_FACTOR = Math.fround(0.3199999928474426)

export interface BoneyardSpellBurnContact {
  readonly damage: number
  readonly ownerId: string
  readonly targetId: number
}

export interface BoneyardSpellEtherBurnContact {
  readonly ownerId: string
  readonly targetId: number
}

export interface BoneyardSpellTargetEffectContact {
  readonly patch: NativeSecondaryTargetEffectPatch
  readonly targetId: number
  readonly worldKey: string
}

const NATIVE_WELD_MISSILE_COLLISION_RADIUS = PRIMARY_SPELL_ETHER_COLLISION_RADIUS
const NATIVE_WELD_GROUND_SPARK_COLLISION_RADIUS = 15
const NATIVE_WELD_FROST_SLOW_TICKS = 150
const NATIVE_WELD_FROST_SLOW_FACTOR = 0.5
const NATIVE_WELD_FROST_RADIUS_BASE = 120
const NATIVE_WELD_FROST_RADIUS_GROWTH = 1.024999976158142
const NATIVE_WELD_FROST_RADIUS_GROWTH_STEPS = 15
const NATIVE_WELD_BALL_LIGHTNING_BURN_TICKS = 100
const NATIVE_WELD_GROUND_SPARK_BURN_TICKS = 50
const NATIVE_WELD_CHANNEL_MODIFIER_TICKS = 25
const NATIVE_WELD_STEAMED_TICKS = 10

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
  readonly etherBurns: readonly BoneyardSpellEtherBurnContact[]
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
  steamedPulses: readonly NativeSecondarySteamedPulse[] = [],
): BoneyardSpellCombatResult {
  validateTick(tick)
  let enemies = sourceEnemies
  let rng = sourceRng
  const consumedProjectileIds = new Set<number>()
  const consumedTransientIds = new Set<number>()
  const updatedProjectiles = new Map<number, PrimarySpellProjectileState>()
  const updatedTransients = new Map<number, PrimarySpellTransientState>()
  const hits: BoneyardSpellHit[] = []
  const burns: BoneyardSpellBurnContact[] = []
  const etherBurns: BoneyardSpellEtherBurnContact[] = []
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

  const hurricanes = sourceSpells.transients.filter((effect): effect is Extract<
    PrimarySpellTransientState,
    { kind: 'air-hurricane' }
  > => (
    effect.kind === 'air-hurricane'
    && effect.worldKey === worldKey
    && effect.contactCharge > 0
  )).sort(bySpellId)
  if (hurricanes.length > 0) {
    for (const row of primaryTargetRows(enemies)) {
      if (!row.target.active || !nativeHurricaneMovementDue(row.actor.id, tick)) continue
      let deltaX = Math.fround(0)
      let deltaY = Math.fround(0)
      let contact: typeof hurricanes[number] | null = null
      for (const hurricane of hurricanes) {
        const force = nativeHurricaneOrbitForce(
          hurricane.position,
          row.target.position,
          hurricane.contactCharge,
        )
        if (force === null) continue
        deltaX = Math.fround(deltaX + force.x)
        deltaY = Math.fround(deltaY + force.y)
        if (contact === null && row.actor.hurricaneContactCooldown < 1) {
          contact = hurricane
        }
      }
      if (deltaX !== 0 || deltaY !== 0) {
        const requested = {
          x: Math.fround(row.target.position.x + deltaX),
          y: Math.fround(row.target.position.y + deltaY),
        }
        const resolved = resolveEnemyMovement(
          row.actor.id,
          row.target.position,
          requested,
          row.target.bodyRadius,
        )
        enemies = positionBoneyardEnemy(enemies, row.actor.id, resolved).store
      }
      if (contact === null) continue
      const damage = drawNativeHurricaneDamage(
        rng,
        contact.contactCharge,
        contact.damageMinimum,
        contact.damageMaximum,
      )
      rng = damage.rng
      const amount = Math.fround(
        damage.damage * validatedDamageMultiplier(damageMultiplier(row.actor.id, 'air')),
      )
      if (amount > 0) {
        const damaged = damageBoneyardEnemy(enemies, {
          actorId: row.actor.id,
          amount,
          sourcePlayerId: contact.ownerId,
          suppressHurtSound: damage.suppressHitSound,
          tick,
        })
        if (damaged.accepted) {
          enemies = damaged.store
          events.push(...damaged.events)
          hits.push(Object.freeze({
            actorId: row.actor.id,
            amount,
            killed: damaged.killed,
            ownerId: contact.ownerId,
            spellId: contact.id,
            spellKind: 'air-hurricane',
            tick,
          }))
        }
      }
      enemies = setBoneyardEnemyHurricaneContactCooldown(
        enemies,
        row.actor.id,
        NATIVE_HURRICANE_CONTACT_COOLDOWN,
      )
    }

    for (const effect of sourceSpells.transients) {
      if (
        effect.kind !== 'fire-good-imp'
        || effect.worldKey !== worldKey
        || !nativeHurricaneMovementDue(effect.id, tick)
      ) continue
      let deltaX = Math.fround(0)
      let deltaY = Math.fround(0)
      for (const hurricane of hurricanes) {
        const force = nativeHurricaneOrbitForce(
          hurricane.position,
          effect.position,
          hurricane.contactCharge,
        )
        if (force === null) continue
        deltaX = Math.fround(deltaX + force.x)
        deltaY = Math.fround(deltaY + force.y)
      }
      if (deltaX === 0 && deltaY === 0) continue
      const requested = {
        x: Math.fround(effect.position.x + deltaX),
        y: Math.fround(effect.position.y + deltaY),
      }
      const position = resolveEnemyMovement(
        effect.id,
        effect.position,
        requested,
        effect.collisionRadius,
      )
      updatedTransients.set(effect.id, Object.freeze({
        ...effect,
        position: Object.freeze({ ...position }),
      }))
    }
  }

  for (const effect of [...sourceSpells.transients].sort(bySpellId)) {
    if (
      effect.kind !== 'ether-blast'
      || effect.birthTick !== tick
      || effect.worldKey !== worldKey
    ) continue
    for (const row of nativePrimaryRootTargetRows(
      enemies,
      effect.origin,
      NATIVE_ETHER_BLAST_CONTACT_RADIUS,
      0x2,
    )) {
      const amount = nativeEtherBlastDamage(effect.charges, row.actor.currentHealth)
      const contact = damageBoneyardEnemy(enemies, {
        actorId: row.actor.id,
        amount,
        sourcePlayerId: effect.ownerId,
        tick,
      })
      if (!contact.accepted) continue
      enemies = contact.store
      events.push(...contact.events)
      hits.push(Object.freeze({
        actorId: row.actor.id,
        amount,
        killed: contact.killed,
        ownerId: effect.ownerId,
        spellId: effect.id,
        spellKind: 'ether-blast',
        tick,
      }))
      etherBurns.push(Object.freeze({
        ownerId: effect.ownerId,
        targetId: row.actor.id,
      }))
    }
  }

  const activeKnockbackTargetIds = new Set(sourceSpells.transients.flatMap((effect) => {
    if (effect.worldKey !== worldKey) return []
    if (effect.kind === 'weld-hail-knockback') return [effect.targetId]
    if (effect.kind === 'player-staff-contact-knockback') return [effect.targetId]
    return []
  }))
  for (const effect of sourceSpells.transients) {
    if (effect.kind !== 'weld-hail-knockback' || effect.worldKey !== worldKey) continue
    const actorId = parseEnemyTargetId(effect.targetId)
    const row = actorId === null
      ? undefined
      : primaryTargetRows(enemies).find(({ actor }) => actor.id === actorId)
    if (!row) {
      consumedTransientIds.add(effect.id)
      activeKnockbackTargetIds.delete(effect.targetId)
      continue
    }
    const requested = {
      x: Math.fround(row.target.position.x + effect.delta.x),
      y: Math.fround(row.target.position.y + effect.delta.y),
    }
    const resolved = resolveEnemyMovement(
      row.actor.id,
      row.target.position,
      requested,
      row.target.bodyRadius,
    )
    enemies = positionBoneyardEnemy(enemies, row.actor.id, resolved).store
    const remainingTicks = effect.remainingTicks - 1
    if (remainingTicks <= 0) {
      consumedTransientIds.add(effect.id)
      activeKnockbackTargetIds.delete(effect.targetId)
    } else {
      updatedTransients.set(effect.id, Object.freeze({
        ...effect,
        ageTicks: effect.ageTicks + 1,
        remainingTicks,
      }))
    }
  }
  for (const effect of sourceSpells.transients) {
    if (effect.kind !== 'weld-steam' || effect.worldKey !== worldKey
      || !effect.contactEnabled || !effect.contactDue) continue
    const center = {
      x: effect.position.x,
      y: Math.fround(effect.position.y + 15),
    }
    const radius = Math.fround(effect.scale * 50)
    for (const row of nativePrimaryRootTargetRows(enemies, center, radius, 0x2)) {
      queueTargetEffect(row.actor.id, {
        steamed: Object.freeze({
          damagePerTick: Math.fround(Math.min(effect.life, 1) * effect.contactDamage),
          emberDamage: effect.vector[6]!,
          emberFragments: Math.max(0, Math.round(effect.vector[7]!)),
          explodeDamage: effect.vector[4]!,
          explodeRadius: effect.vector[5]!,
          ownerId: effect.ownerId,
          sourceActorId: effect.id,
          ticks: NATIVE_WELD_STEAMED_TICKS,
        }),
      })
    }
  }

  for (const pulse of steamedPulses) {
    if (pulse.worldKey !== worldKey) continue
    const privateSeed = drawNativeInteger(rng, 1_000_000)
    rng = privateSeed.state
    const detonation = createPrimarySpellWeldFireDetonation(
      nextSpellId,
      {
        buildId: 1005,
        direction: { x: 0, y: -1 },
        ownerId: pulse.sourcePlayerId,
        position: { ...pulse.position },
        vector: [
          0,
          0,
          0,
          0,
          pulse.explodeDamage,
          pulse.explodeRadius,
          pulse.emberDamage,
          pulse.emberFragments,
        ],
        worldKey,
      },
      pulse.position,
      tick,
      rng,
      privateSeed.value,
      false,
    )
    rng = detonation.rng
    impactTransients.push(...detonation.transients)
    nextSpellId = detonation.nextId
  }

  const publishContactImpact = (
    projectile: PrimarySpellProjectileState,
    origin: Readonly<Vector2>,
  ): void => {
    const impactProgram = createPrimarySpellContactImpact(
      nextSpellId,
      projectile,
      origin,
      tick,
      rng,
      registerLightProvider,
    )
    rng = impactProgram.rng
    const impact = impactProgram.impact
    if (!impact) return
    impactTransients.push(impact)
    nextSpellId += 1
  }

  const publishBoulderContactDebris = (effect: Readonly<{
    buildId: 1006
    direction: Vector2
    origin: Vector2
    ownerId: string
    scale: number
    vector: readonly number[]
    worldKey: string
  }>): void => {
    const program = createNativeWeldBoulderContactDebrisProgram({
      rng,
      scale: effect.scale,
    })
    rng = program.rng
    impactTransients.push(createNativeWeldBoulderDebrisActor({
      buildId: effect.buildId,
      debris: program.debris[0]!,
      direction: effect.direction,
      id: nextSpellId,
      origin: effect.origin,
      ownerId: effect.ownerId,
      tick,
      vector: effect.vector,
      worldKey: effect.worldKey,
    }))
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
          ...fireballSceneryTargets.map((target) => ({
            actor: null,
            kind: 'scenery' as const,
            target,
          })),
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

    if (projectile.kind === 'weld') {
      const target = firstNativePrimaryPointContact({
        actorMask: 0x2,
        position: projectile.position,
        queryRadius: projectile.buildId === 1009
          ? NATIVE_WELD_GROUND_SPARK_COLLISION_RADIUS
          : NATIVE_WELD_MISSILE_COLLISION_RADIUS,
        targets: rows.map(({ target }) => target),
      })
      if (!target) continue
      const actor = rows.find(({ target: candidate }) => candidate.id === target.id)?.actor
      if (!actor) continue

      if (projectile.buildId === 1001 && projectile.vector[5]! > 0) {
        queueTargetEffect(actor.id, {
          coldSlowFactor: NATIVE_WELD_FROST_SLOW_FACTOR,
          coldSlowMaterial: true,
          coldSlowTicks: NATIVE_WELD_FROST_SLOW_TICKS,
          timeScale: NATIVE_WELD_FROST_SLOW_FACTOR,
        })
      }
      if (projectile.buildId === 1002 || projectile.buildId === 1009) {
        const burnTicks = projectile.buildId === 1002
          ? NATIVE_WELD_BALL_LIGHTNING_BURN_TICKS
          : NATIVE_WELD_GROUND_SPARK_BURN_TICKS
        const movementFactor = projectile.buildId === 1002
          ? projectile.vector[6]!
          : projectile.vector[3]!
        queueTargetEffect(actor.id, {
          electricBurn: Object.freeze({
            arcCount: Math.max(0, Math.round(
              projectile.buildId === 1002 ? projectile.vector[5]! : projectile.vector[2]!,
            )),
            damagePerTick: projectile.damage / burnTicks,
            ownerId: projectile.ownerId,
            sourceActorId: projectile.id,
            stunFactor: movementFactor,
            ticks: burnTicks,
          }),
        })
      }

      const electric = projectile.buildId === 1002 || projectile.buildId === 1009
      const amount = electric
        ? projectile.damage * validatedDamageMultiplier(damageMultiplier(actor.id, 'air'))
        : projectile.damage
      const damaged = damageBoneyardEnemy(enemies, {
        lethalObserver,
        actorId: actor.id,
        amount,
        sourcePlayerId: projectile.ownerId,
        tick,
      })
      if (!damaged.accepted) continue
      enemies = damaged.store
      events.push(...damaged.events)
      hits.push(spellHit(projectile, actor.id, amount, damaged.killed, tick))

      if (projectile.buildId === 1001 && projectile.vector[5]! > 0) {
        const radialDamage = projectile.damage / 20
        const radialRows = nativePrimaryRootTargetRows(
          enemies,
          projectile.position,
          nativeWeldFrostRadialRadius(projectile.vector[5]!),
          0x2,
        )
        for (const row of radialRows) {
          if (row.actor.id !== actor.id) {
            queueTargetEffect(row.actor.id, {
              coldSlowFactor: NATIVE_WELD_FROST_SLOW_FACTOR,
              coldSlowMaterial: true,
              coldSlowTicks: NATIVE_WELD_FROST_SLOW_TICKS,
              timeScale: NATIVE_WELD_FROST_SLOW_FACTOR,
            })
          }
          const radial = damageBoneyardEnemy(enemies, {
            lethalObserver,
            actorId: row.actor.id,
            amount: radialDamage,
            sourcePlayerId: projectile.ownerId,
            tick,
          })
          if (!radial.accepted) continue
          enemies = radial.store
          events.push(...radial.events)
          hits.push(spellHit(projectile, row.actor.id, radialDamage, radial.killed, tick))
        }
      }

      if (projectile.buildId === 1009 && projectile.contactsRemaining > 1) {
        updatedProjectiles.set(projectile.id, {
          ...projectile,
          contactsRemaining: projectile.contactsRemaining - 1,
        })
        publishContactImpact(projectile, projectile.position)
        continue
      }
      consumedProjectileIds.add(projectile.id)
      if (projectile.buildId === 1000) {
        const detonation = createPrimarySpellWeldFireDetonation(
          nextSpellId,
          projectile,
          projectile.position,
          tick,
          rng,
          projectile.presentationSeed ?? 0,
        )
        rng = detonation.rng
        impactTransients.push(...detonation.transients)
        nextSpellId = detonation.nextId
      } else {
        publishContactImpact(projectile, projectile.position)
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
        lethalObserver,
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
    if (
      effect.kind !== 'weld-persistent'
      || effect.phase !== 'flight'
      || effect.worldKey !== worldKey
    ) continue
    const rows = primaryTargetRows(enemies)
    if (effect.buildId === 1006) {
      const priorTargets = new Set(effect.hitTargetIds)
      const contacts = nativePrimaryRootTargets(
        effect.origin,
        effect.scale * PRIMARY_SPELL_EARTH_COLLISION_RADIUS_SCALE,
        0x6,
        rows.map(({ target }) => target),
      ).filter(({ id }) => !priorTargets.has(id))
      if (contacts.length === 0) continue
      const hitTargetIds = [...effect.hitTargetIds]
      let remainingDamage = effect.remainingDamage
      for (const target of contacts) {
        if (remainingDamage < 0.001) break
        hitTargetIds.push(target.id)
        const actor = rows.find(({ target: candidate }) => candidate.id === target.id)?.actor
        if (!actor) continue
        const contact = consumeNativeEarthBoulderContact(
          remainingDamage,
          Math.max(0, actor.currentHealth),
          effect.toughness,
        )
        const damaged = damageBoneyardEnemy(enemies, {
          lethalObserver,
          actorId: actor.id,
          amount: contact.damage,
          sourcePlayerId: effect.ownerId,
          tick,
        })
        if (!damaged.accepted) continue
        enemies = damaged.store
        events.push(...damaged.events)
        publishBoulderContactDebris(effect)
        remainingDamage = contact.remainingPool
        hits.push({
          actorId: actor.id,
          amount: contact.damage,
          killed: damaged.killed,
          ownerId: effect.ownerId,
          spellId: effect.id,
          spellKind: 'weld',
          tick,
        })
      }
      const retained = retainNativeWeldPersistentActorContacts(
        effect,
        hitTargetIds,
        remainingDamage,
      )
      if (retained) {
        updatedTransients.set(effect.id, retained)
      } else {
        consumedTransientIds.add(effect.id)
        impactTransients.push({
          ageTicks: 0,
          alpha: 0,
          birthTick: tick,
          buildId: 1006,
          direction: { ...effect.direction },
          id: nextSpellId,
          impactSoundPitch: null,
          impactSoundVariant: null,
          kind: 'weld-impact',
          lightRegistration: null,
          origin: { ...effect.origin },
          ownerId: effect.ownerId,
          position: { ...effect.origin },
          presentationRotationDegrees: null,
          presentationScale: 0,
          vector: [...effect.vector],
          worldKey: effect.worldKey,
        })
        nextSpellId += 1
      }
      continue
    }
    if (effect.buildId !== 1008) continue
    if (effect.releaseAgeTicks === 0) continue
    const damageByRockId = new Map(effect.rocks.map((rock) => [
      rock.rockId,
      rock.damageRemaining,
    ]))
    for (const [substepIndex, substep] of nativeWeldHailstoneFlightContactSubsteps(
      effect,
    ).entries()) {
      const remainingSubsteps = NATIVE_WELD_HAIL_FLIGHT_SUBSTEPS - substepIndex - 1
      let queryRadius = effect.collisionRadius
      for (let remaining = 0; remaining < remainingSubsteps; remaining += 1) {
        queryRadius = Math.fround(queryRadius - effect.widen)
      }
      const currentRows = primaryTargetRows(enemies)
      const targets = nativePrimaryRootTargets(
        substep.origin,
        queryRadius,
        0x2,
        currentRows.map(({ target }) => target),
      )
      for (const target of targets) {
        const currentRow = primaryTargetRows(enemies).find(({ target: candidate }) => (
          candidate.id === target.id
        ))
        if (!currentRow) continue
        for (const rock of effect.rocks) {
          const currentActor = primaryTargetRows(enemies).find(({ target: candidate }) => (
            candidate.id === target.id
          ))?.actor
          if (!currentActor) break
          const releaseOffset = substep.releaseOffsets[rock.rockId]
          const remainingDamage = damageByRockId.get(rock.rockId) ?? 0
          if (!releaseOffset || remainingDamage < 0.001) continue
          const point = {
            x: Math.fround(substep.origin.x + releaseOffset.x),
            y: Math.fround(substep.origin.y + releaseOffset.y),
          }
          const dx = point.x - currentRow.target.position.x
          const dy = point.y - currentRow.target.position.y
          const radius = Math.fround(
            currentRow.target.bodyRadius * NATIVE_WELD_HAIL_TARGET_RADIUS_FACTOR,
          )
          if (dx * dx + dy * dy >= radius * radius) continue

          queueTargetEffect(currentActor.id, {
            coldSlowFactor: NATIVE_WELD_HAIL_COLD_SLOW_FACTOR,
            coldSlowMaterial: true,
            coldSlowTicks: NATIVE_WELD_HAIL_COLD_SLOW_TICKS,
            timeScale: NATIVE_WELD_HAIL_COLD_SLOW_FACTOR,
          })
          const targetKey = `enemy:${currentActor.id}`
          if (!activeKnockbackTargetIds.has(targetKey)) {
            const knockback = createNativeWeldHailKnockback({
              actor: effect,
              id: nextSpellId,
              targetId: targetKey,
              tick,
            })
            if (knockback) {
              impactTransients.push(knockback)
              activeKnockbackTargetIds.add(targetKey)
              nextSpellId += 1
            }
          }

          const targetHealth = Math.max(0, currentActor.currentHealth)
          const amount = Math.min(targetHealth, remainingDamage)
          const consumed = remainingDamage < targetHealth
            ? amount
            : amount / effect.toughness
          const damaged = damageBoneyardEnemy(enemies, {
            lethalObserver,
            actorId: currentActor.id,
            amount,
            sourcePlayerId: effect.ownerId,
            tick,
          })
          if (!damaged.accepted) continue
          enemies = damaged.store
          events.push(...damaged.events)
          const nextDamage = Math.max(0, remainingDamage - consumed)
          damageByRockId.set(rock.rockId, nextDamage)
          hits.push({
            actorId: currentActor.id,
            amount,
            killed: damaged.killed,
            ownerId: effect.ownerId,
            spellId: effect.id,
            spellKind: 'weld',
            tick,
          })
          if (nextDamage < 0.001) {
            const drawOffset = nativeWeldHailstoneDrawOffset(rock)
            const presentation = createNativeWeldHailContactPresentation({
              actor: effect,
              end: point,
              firstId: nextSpellId,
              rng,
              start: {
                x: Math.fround(substep.origin.x + drawOffset.x),
                y: Math.fround(substep.origin.y + drawOffset.y),
              },
              tick,
            })
            rng = presentation.rng
            impactTransients.push(...presentation.actors)
            nextSpellId += presentation.actors.length
          }
          if (damaged.killed) break
        }
      }
    }
    const retained = retainNativeWeldHailstoneDamage(
      effect,
      effect.rocks.map((rock) => damageByRockId.get(rock.rockId) ?? 0),
    )
    if (retained) updatedTransients.set(effect.id, retained)
    else consumedTransientIds.add(effect.id)
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
        lethalObserver,
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

  for (const effect of [...sourceSpells.transients].sort(bySpellId)) {
    if (effect.kind !== 'weld-meteor' || effect.worldKey !== worldKey) continue
    const pulse = effect.impactDue
      ? Object.freeze({ amount: effect.damage * 0.5, radius: nativeWeldMeteorDirectRadius() })
      : effect.pulseDue
        ? Object.freeze({
            amount: effect.damage / 20,
            radius: nativeWeldMeteorPulseRadius(effect.impactRadiusScalar),
          })
        : null
    if (pulse) {
      for (const row of nativePrimaryRootTargetRows(
        enemies,
        effect.position,
        pulse.radius,
        0x2,
      )) {
        const damaged = damageBoneyardEnemy(enemies, {
          lethalObserver,
          actorId: row.actor.id,
          amount: pulse.amount,
          sourcePlayerId: effect.ownerId,
          tick,
        })
        if (!damaged.accepted) continue
        enemies = damaged.store
        events.push(...damaged.events)
        hits.push({
          actorId: row.actor.id,
          amount: pulse.amount,
          killed: damaged.killed,
          ownerId: effect.ownerId,
          spellId: effect.id,
          spellKind: 'weld',
          tick,
        })
      }
    }
    if (!effect.impactDue) continue
    const detonation = createPrimarySpellWeldFireDetonation(
      nextSpellId,
      effect,
      effect.position,
      tick,
      rng,
      effect.privateSeed,
      false,
    )
    rng = detonation.rng
    impactTransients.push(...detonation.transients)
    nextSpellId = detonation.nextId
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
        lethalObserver,
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
        lethalObserver,
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
          lethalObserver,
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

    if (emission.kind === 'weld') {
      if (emission.primarySkill.kind !== 'weld') {
        throw new Error('Weld channel emission does not own a Weld skill payload')
      }
      const profile = emission.primarySkill
      switch (profile.buildId) {
        case 1003: {
          const first = selectedWeldTarget(primaryTargetRows(enemies), sourceSpells, emission)
          if (!first) break
          const contactedIds = new Set<string>()
          let target: PrimarySpellTarget | null = first
          let damage = emission.damage
          let previousPoint = emission.origin
          for (let hop = 0; target && hop <= profile.vector.values[2]!; hop += 1) {
            const row = primaryTargetRows(enemies).find(({ target: candidate }) => (
              candidate.id === target!.id
            ))
            if (!row || !nativePrimaryTargetEligible(row.target, 0x2)) break
            contactedIds.add(row.target.id)
            const stunFactor = profile.vector.values[3]!
            if (stunFactor < 1) {
              queueTargetEffect(row.actor.id, {
                stunFactor,
                stunTicks: NATIVE_WELD_CHANNEL_MODIFIER_TICKS,
              })
            }
            const amount = damage * validatedDamageMultiplier(
              damageMultiplier(row.actor.id, 'air'),
            )
            const damaged = damageBoneyardEnemy(enemies, {
              lethalObserver,
              actorId: row.actor.id,
              amount,
              sourcePlayerId: emission.ownerId,
              tick,
            })
            if (damaged.accepted) {
              enemies = damaged.store
              events.push(...damaged.events)
              hits.push(channelSpellHit(emission, row.actor.id, amount, damaged.killed, tick))
              const point = primarySpellTargetPoint(row.target)
              const fadeDirection = normalizedDifference(previousPoint, point)
              const fade = createNativeWeldFlameLashFade({
                direction: fadeDirection,
                id: nextSpellId,
                origin: point,
                ownerId: emission.ownerId,
                rng,
                tick,
                variant: 'chain',
                vector: profile.vector.values,
                worldKey,
              })
              rng = fade.rng
              ownedTransients.push(fade.actor)
              nextSpellId += 1
              const privateSeed = drawNativeInteger(rng, 1_000_000)
              rng = privateSeed.state
              const detonation = createPrimarySpellWeldFireDetonation(
                nextSpellId,
                {
                  buildId: 1003,
                  direction: normalizedDifference(previousPoint, point),
                  ownerId: emission.ownerId,
                  position: point,
                  vector: profile.vector.values,
                  worldKey,
                },
                point,
                tick,
                rng,
                privateSeed.value,
                false,
              )
              rng = detonation.rng
              ownedTransients.push(...detonation.transients)
              nextSpellId = detonation.nextId
            }
            const currentPoint = primarySpellTargetPoint(row.target)
            if (hop > 0) {
              const direction = normalizedDifference(previousPoint, currentPoint)
              const geometry = airPrimaryBoltGeometry(
                previousPoint,
                direction,
                currentPoint,
              )
              ownedTransients.push({
                ageTicks: 0,
                birthTick: tick,
                buildId: 1003,
                direction,
                endpoint: geometry.endpoint,
                id: nextSpellId,
                kind: 'weld-channel',
                lightRegistration: null,
                midpoint: geometry.midpoint,
                origin: { ...previousPoint },
                ownerId: emission.ownerId,
                targetId: row.target.id,
                underpowered: emission.underpowered,
                variant: nextSpellId % 4,
                vector: Object.freeze([...profile.vector.values]),
                worldKey,
              })
              nextSpellId += 1
            }
            previousPoint = currentPoint
            damage = Math.fround(damage * NATIVE_LIGHTNING_CHAIN_DAMAGE_FACTOR)
            target = nearestUnusedAirChainTarget(
              primaryTargetRows(enemies).map(({ target: candidate }) => candidate),
              row.target.position,
              contactedIds,
            )
          }
          break
        }
        case 1004: {
          const widen = profile.vector.values[6]! * 250
          const roots = nativePrimaryConeTargets({
            actorMask: 0x1082,
            aimDirection: emission.direction,
            halfAngleDegrees: 15 + widen,
            hasLineOfSight: (target) => (
              firstWorldContact?.(emission.queryOrigin, target.position, 0) ?? null
            ) === null,
            origin: emission.queryOrigin,
            reach: 205 + 4 * widen,
            targets: primaryTargetRows(enemies).map(({ target }) => target),
          })
          const contactedIds = new Set<string>()
          for (const root of roots) {
            let target: PrimarySpellTarget | null = root
            let damage = emission.damage
            let previousPoint = emission.origin
            for (let hop = 0; target && hop <= profile.vector.values[2]!; hop += 1) {
              if (contactedIds.has(target.id)) break
              const row = primaryTargetRows(enemies).find(({ target: candidate }) => (
                candidate.id === target!.id
              ))
              if (!row || !nativePrimaryTargetEligible(row.target, 0x2)) break
              contactedIds.add(row.target.id)
              queueTargetEffect(row.actor.id, {
                coldSlowFactor: NATIVE_WELD_FROST_SLOW_FACTOR,
                coldSlowMaterial: true,
                coldSlowTicks: NATIVE_WELD_CHANNEL_MODIFIER_TICKS,
                timeScale: NATIVE_WELD_FROST_SLOW_FACTOR,
              })
              const stunFactor = profile.vector.values[3]!
              if (stunFactor < 1) {
                queueTargetEffect(row.actor.id, {
                  stunFactor,
                  stunTicks: NATIVE_WELD_CHANNEL_MODIFIER_TICKS,
                })
              }
              if (profile.vector.values[5]! > 0) {
                enemies = applyWaterPushback(
                  enemies,
                  row.actor,
                  emission.queryOrigin,
                  profile.vector.values[5]!,
                  205 + 4 * widen,
                  resolveEnemyMovement,
                )
              }
              const amount = damage * validatedDamageMultiplier(
                damageMultiplier(row.actor.id, 'air'),
              )
              const damaged = damageBoneyardEnemy(enemies, {
                lethalObserver,
                actorId: row.actor.id,
                amount,
                sourcePlayerId: emission.ownerId,
                tick,
              })
              if (damaged.accepted) {
                enemies = damaged.store
                events.push(...damaged.events)
                hits.push(channelSpellHit(emission, row.actor.id, amount, damaged.killed, tick))
              }
              const currentPoint = primarySpellTargetPoint(row.target)
              if (hop > 0) {
                const direction = normalizedDifference(previousPoint, currentPoint)
                const geometry = airPrimaryBoltGeometry(
                  previousPoint,
                  direction,
                  currentPoint,
                )
                ownedTransients.push({
                  ageTicks: 0,
                  birthTick: tick,
                  buildId: 1004,
                  direction,
                  endpoint: geometry.endpoint,
                  id: nextSpellId,
                  kind: 'weld-channel',
                  lightRegistration: null,
                  midpoint: geometry.midpoint,
                  origin: { ...previousPoint },
                  ownerId: emission.ownerId,
                  targetId: row.target.id,
                  underpowered: emission.underpowered,
                  variant: nextSpellId % 4,
                  vector: Object.freeze([...profile.vector.values]),
                  worldKey,
                })
                nextSpellId += 1
              }
              previousPoint = currentPoint
              damage = Math.fround(damage * NATIVE_LIGHTNING_CHAIN_DAMAGE_FACTOR)
              target = nearestUnusedAirChainTarget(
                primaryTargetRows(enemies).map(({ target: candidate }) => candidate),
                row.target.position,
                contactedIds,
              )
            }
          }
          break
        }
        case 1005: {
          const widen = emission.underpowered ? 0 : profile.vector.values[2]!
          const pushback = emission.underpowered ? 0 : profile.vector.values[3]!
          if (pushback <= 0) break
          const contacts = nativePrimaryConeTargets({
            actorMask: 0x1082,
            aimDirection: emission.direction,
            halfAngleDegrees: 15 + widen,
            hasLineOfSight: (target) => (
              firstWorldContact?.(emission.queryOrigin, target.position, 0) ?? null
            ) === null,
            origin: emission.queryOrigin,
            reach: 205 + 4 * widen,
            targets: primaryTargetRows(enemies).map(({ target }) => target),
          })
          for (const target of contacts) {
            const row = primaryTargetRows(enemies).find(({ target: candidate }) => (
              candidate.id === target.id
            ))
            if (!row) continue
            enemies = applyWaterPushback(
              enemies,
              row.actor,
              emission.queryOrigin,
              pushback,
              205 + 4 * widen,
              resolveEnemyMovement,
            )
          }
          break
        }
        default:
          throw new Error(`weld channel build ${profile.buildId} is not supported`)
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

    const rows = primaryWaterTargetRows(enemies)
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
      const row = rows.find(({ target: candidate }) => (
        candidate.id === target.id
      ))
      if (!row) continue
      if (row.kind === 'arrow') {
        const tumbleGain = Math.fround(
          profile.pushbackPercent * NATIVE_CHILL_ARROW_TUMBLE_FACTOR,
        )
        if (tumbleGain < 1) continue
        const tumbled = tumbleBoneyardArrow(
          enemies,
          row.projectile.id,
          emission.direction,
          tick,
          rng,
        )
        enemies = tumbled.store
        rng = tumbled.rng
        events.push(...tumbled.events)
        continue
      }
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
        lethalObserver,
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
    steppedTransients.push(updatedTransients.get(effect.id) ?? effect)
  }

  const spells = consumedProjectileIds.size === 0
    && consumedTransientIds.size === 0
    && updatedProjectiles.size === 0
    && updatedTransients.size === 0
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
    etherBurns: Object.freeze(etherBurns),
    events: Object.freeze(events),
    hits: Object.freeze(hits),
    rng,
    spells,
    targetEffects: Object.freeze(targetEffects),
  }
}

export function nativeWeldFrostRadialRadius(pushScalar: number): number {
  if (!Number.isFinite(pushScalar) || pushScalar < 0) {
    throw new RangeError('Frost Missile push scalar must be finite and non-negative')
  }
  let radius = Math.fround(pushScalar * NATIVE_WELD_FROST_RADIUS_BASE)
  for (let step = 0; step < NATIVE_WELD_FROST_RADIUS_GROWTH_STEPS; step += 1) {
    radius = Math.fround(radius * NATIVE_WELD_FROST_RADIUS_GROWTH)
  }
  return radius
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
  readonly actor: BoneyardSpellTarget
  readonly kind: 'enemy'
  readonly target: PrimarySpellTarget
}

interface PrimaryProjectileTargetRow {
  readonly kind: 'arrow'
  readonly projectile: BoneyardEnemyProjectile
  readonly target: PrimarySpellTarget
}

type PrimaryWaterTargetRow = PrimaryTargetRow | PrimaryProjectileTargetRow

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
  lethalObserver: BoneyardEnemyLethalObserver | undefined,
): {
  readonly accepted: boolean
  readonly amount: number
  readonly enemies: BoneyardEnemyStore
  readonly events: readonly BoneyardEnemySemanticEvent[]
  readonly killed: boolean
} {
  const ordinary = damageBoneyardEnemy(source, {
    lethalObserver,
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
    lethalObserver,
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

function parseEnemyTargetId(targetId: string): number | null {
  if (!targetId.startsWith('enemy:')) return null
  const value = Number(targetId.slice('enemy:'.length))
  return Number.isSafeInteger(value) && value > 0 ? value : null
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

function selectedWeldTarget(
  rows: readonly PrimaryTargetRow[],
  spells: PrimarySpellSimulationState,
  emission: PrimarySpellChannelEmission,
): PrimarySpellTarget | null {
  const transient = spells.transients.find((effect) => (
    effect.kind === 'weld-channel'
    && effect.id === emission.id
    && effect.ownerId === emission.ownerId
    && effect.worldKey === emission.worldKey
    && effect.buildId === 1003
  ))
  if (transient?.kind !== 'weld-channel' || transient.targetId === null) return null
  const row = rows.find(({ target }) => target.id === transient.targetId)
  return row?.target.active && !row.target.pendingRemove ? row.target : null
}

function primaryTargetRows(
  store: BoneyardEnemyStore,
  registrationOrderBase = 0,
): readonly PrimaryTargetRow[] {
  return [...store.actors, ...store.maggots].map((actor, registrationOrder) => ({
    actor,
    kind: 'enemy',
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

function primaryWaterTargetRows(
  store: BoneyardEnemyStore,
): readonly PrimaryWaterTargetRow[] {
  const enemies = primaryTargetRows(store)
  const arrows = store.projectiles
    .filter((projectile) => projectile.kind === 'arrow')
    .map((projectile, index): PrimaryProjectileTargetRow => ({
      kind: 'arrow',
      projectile,
      target: {
        active: projectile.ageTicks < projectile.lifetimeTicks,
        actorFlags: 0x80,
        attachment: { x: 0, y: 0 },
        bodyRadius: projectile.contactRadius,
        id: `projectile:${projectile.id}`,
        kind: 'projectile',
        nativePriority: 0,
        pendingRemove: false,
        position: { ...projectile.position },
        registrationOrder: enemies.length + index,
      },
    }))
  return [...enemies, ...arrows]
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

function channelSpellHit(
  emission: PrimarySpellChannelEmission,
  actorId: number,
  amount: number,
  killed: boolean,
  tick: number,
): BoneyardSpellHit {
  return {
    actorId,
    amount,
    killed,
    ownerId: emission.ownerId,
    spellId: emission.id,
    spellKind: 'weld',
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

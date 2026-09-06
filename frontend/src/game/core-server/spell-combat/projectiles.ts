import { consumeNativeEarthBoulderContact } from '../../core-kernels/native-earth-boulder.ts'
import { isMagicMissileDerivedWeldBuild } from '../../core-kernels/native-weld-primary-runtime.ts'
import { nativeFireDirectDamage } from '../../core-kernels/primary-spell-fire-effects.ts'
import {
  type PrimarySpellTarget,
  firstNativeFireballPointContact,
  firstNativePrimaryPointContact,
  nativePrimaryRootTargets,
  selectEtherPrimaryTargetAtPoint,
} from '../../core-kernels/primary-spell-targeting.ts'
import {
  PRIMARY_SPELL_EARTH_COLLISION_RADIUS_SCALE,
  PRIMARY_SPELL_ETHER_COLLISION_RADIUS,
  PRIMARY_SPELL_FIRE_COLLISION_RADIUS,
  type PrimarySpellProjectileState,
  createPrimarySpellFireDetonation,
  createPrimarySpellWeldFireDetonation,
} from '../../core-kernels/primary-spells.ts'
import type { Vector2 } from '../../core-kernels/vector.ts'
import { damageBoneyardEnemy } from '../enemies/damage.ts'
import { spellHit, validatedDamageMultiplier } from './damage.ts'
import { NATIVE_WELD_FROST_SLOW_FACTOR } from './model.ts'
import { bySpellId, nativePrimaryRootTargetRows, primaryTargetRows } from './targets.ts'
import { BoneyardSpellCombatWork } from './work.ts'

const NATIVE_WELD_MISSILE_COLLISION_RADIUS = PRIMARY_SPELL_ETHER_COLLISION_RADIUS

const NATIVE_WELD_GROUND_SPARK_COLLISION_RADIUS = 15

const NATIVE_WELD_FROST_SLOW_TICKS = 150

const NATIVE_WELD_FROST_RADIUS_BASE = 120

const NATIVE_WELD_FROST_RADIUS_GROWTH = 1.024999976158142

const NATIVE_WELD_FROST_RADIUS_GROWTH_STEPS = 15

const NATIVE_WELD_BALL_LIGHTNING_BURN_TICKS = 100

const NATIVE_WELD_GROUND_SPARK_BURN_TICKS = 50

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
  let target = selectEtherPrimaryTargetAtPoint({
    excludedTargetId: contacted.id,
    origin: position,
    targets,
  })
  target ??= selectEtherPrimaryTargetAtPoint({ origin: position, targets })
  return {
    projectile: {
      ...projectile,
      damage: projectile.damage * projectile.damageRetention,
      piercesRemaining: projectile.piercesRemaining - 1,
      position,
      reacquiresTarget: target === null ? false : projectile.reacquiresTarget,
      targetId: target?.id ?? null,
      visualScale: projectile.visualScale * projectile.damageRetention,
    },
    streakOrigins,
  }
}

function primaryProjectileOwnsSceneryContact(
  projectile: PrimarySpellProjectileState,
): boolean {
  return projectile.kind === 'fire'
    || projectile.kind === 'ether'
    || (projectile.kind === 'weld' && isMagicMissileDerivedWeldBuild(projectile.buildId))
}

function nativeMagicMissileActorMask(
  projectile: Extract<PrimarySpellProjectileState, { kind: 'ether' | 'weld' }>,
): 0x2 | 0x6 {
  return projectile.ageTicks >= 200 || projectile.targetId === null ? 0x6 : 0x2
}

function projectileDamage(projectile: PrimarySpellProjectileState): number {
  return projectile.damage
}

export function resolveProjectileContacts(work: BoneyardSpellCombatWork): void {
  for (const projectile of [...work.sourceSpells.projectiles].sort(bySpellId)) {
    if (projectile.phase !== 'flight' || projectile.worldKey !== work.worldKey) continue
    const enemyRows = primaryTargetRows(work.enemies)
    const rows = primaryProjectileOwnsSceneryContact(projectile)
      ? [
          ...work.primarySceneryTargets.map((target) => ({
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
      let contactCharge = projectile.charge
      let continueTraversal = true
      for (const target of contacts) {
        if (!continueTraversal) break
        const actor = rows.find(({ target: candidate }) => candidate.id === target.id)?.actor
        if (!actor) continue
        const contact = consumeNativeEarthBoulderContact({
          releaseBaseDamage: projectile.damage,
          releaseCharge: projectile.maximumCharge,
          remainingPool: remainingDamage,
          targetHealth: Math.max(0, actor.currentHealth),
          toughness: projectile.toughness,
        })
        const amount = contact.damage
          * validatedDamageMultiplier(
            work.damageMultiplier(actor.id, projectile.kind, projectile.ownerId),
          )
        const damaged = damageBoneyardEnemy(work.enemies, {
          magic: true,
          actorId: actor.id,
          amount,
          lethalObserver: work.lethalObserver,
          sourcePlayerId: projectile.ownerId,
          registerWorldPainter: work.registerWorldPainter,
          tick: work.tick,
        })
        if (!damaged.accepted) continue
        hitTargetIds.push(target.id)
        work.enemies = damaged.store
        work.events.push(...damaged.events)
        contactCharge = contact.charge
        continueTraversal = contact.continueTraversal
        work.publishEarthBoulderContactDebris(projectile, contact.charge)
        remainingDamage = contact.remainingPool
        work.hits.push(spellHit(projectile, actor.id, amount, damaged.killed, work.tick))
      }
      if (remainingDamage <= 0) {
        work.consumedProjectileIds.add(projectile.id)
        work.publishContactImpact(projectile, projectile.position)
      } else {
        work.updatedProjectiles.set(projectile.id, {
          ...projectile,
          charge: contactCharge,
          hitTargetIds,
          remainingDamage,
          shellCharge: contactCharge,
        })
      }
      continue
    }

    if (projectile.kind === 'weld') {
      const target = firstNativePrimaryPointContact({
        actorMask: isMagicMissileDerivedWeldBuild(projectile.buildId)
          ? nativeMagicMissileActorMask(projectile)
          : 0x2,
        position: projectile.position,
        queryRadius: projectile.buildId === 1009
          ? NATIVE_WELD_GROUND_SPARK_COLLISION_RADIUS
          : NATIVE_WELD_MISSILE_COLLISION_RADIUS,
        targets: rows.map(({ target }) => target),
      })
      if (!target) continue
      const actor = rows.find(({ target: candidate }) => candidate.id === target.id)?.actor
      if (!actor) {
        work.consumedProjectileIds.add(projectile.id)
        if (projectile.buildId === 1000) {
          const detonation = createPrimarySpellWeldFireDetonation(
            work.nextSpellId,
            projectile,
            projectile.position,
            work.tick,
            work.rng,
            projectile.presentationSeed ?? 0,
            true,
            work.registerWorldPainter,
          )
          work.rng = detonation.rng
          work.pendingFireActorContacts.push(...detonation.contacts)
          work.impactTransients.push(...work.enrollCombatActors(detonation.transients))
          work.nextSpellId = detonation.nextId
        } else {
          work.publishContactImpact(projectile, projectile.position)
        }
        continue
      }

      if (projectile.buildId === 1001 && projectile.vector[5]! > 0) {
        work.queueTargetEffect(actor.id, {
          coldSlowFactor: NATIVE_WELD_FROST_SLOW_FACTOR,
          coldSlowMaterial: true,
          coldSlowTicks: NATIVE_WELD_FROST_SLOW_TICKS,
        })
      }
      if (projectile.buildId === 1002 || projectile.buildId === 1009) {
        const burnTicks = projectile.buildId === 1002
          ? NATIVE_WELD_BALL_LIGHTNING_BURN_TICKS
          : NATIVE_WELD_GROUND_SPARK_BURN_TICKS
        const movementFactor = projectile.buildId === 1002
          ? projectile.vector[6]!
          : projectile.vector[3]!
        work.queueTargetEffect(actor.id, {
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
        ? projectile.damage * validatedDamageMultiplier(
            work.damageMultiplier(actor.id, 'air', projectile.ownerId),
          )
        : projectile.damage
      const damaged = damageBoneyardEnemy(work.enemies, {
        magic: true,
        lethalObserver: work.lethalObserver,
        actorId: actor.id,
        amount,
        sourcePlayerId: projectile.ownerId,
        registerWorldPainter: work.registerWorldPainter,
        tick: work.tick,
      })
      if (!damaged.accepted) continue
      work.enemies = damaged.store
      work.events.push(...damaged.events)
      work.hits.push(spellHit(projectile, actor.id, amount, damaged.killed, work.tick))

      if (projectile.buildId === 1001 && projectile.vector[5]! > 0) {
        const radialDamage = projectile.damage / 20
        const radialRows = nativePrimaryRootTargetRows(
          work.enemies,
          projectile.position,
          nativeWeldFrostRadialRadius(projectile.vector[5]!),
          0x2,
        )
        for (const row of radialRows) {
          if (row.actor.id !== actor.id) {
            work.queueTargetEffect(row.actor.id, {
              coldSlowFactor: NATIVE_WELD_FROST_SLOW_FACTOR,
              coldSlowMaterial: true,
              coldSlowTicks: NATIVE_WELD_FROST_SLOW_TICKS,
            })
          }
          const radial = damageBoneyardEnemy(work.enemies, {
            magic: true,
            lethalObserver: work.lethalObserver,
            actorId: row.actor.id,
            amount: radialDamage,
            sourcePlayerId: projectile.ownerId,
            registerWorldPainter: work.registerWorldPainter,
            tick: work.tick,
          })
          if (!radial.accepted) continue
          work.enemies = radial.store
          work.events.push(...radial.events)
          work.hits.push(spellHit(projectile, row.actor.id, radialDamage, radial.killed, work.tick))
        }
      }

      if (projectile.buildId === 1009 && projectile.contactsRemaining > 1) {
        work.updatedProjectiles.set(projectile.id, {
          ...projectile,
          contactsRemaining: projectile.contactsRemaining - 1,
        })
        work.publishContactImpact(projectile, projectile.position)
        continue
      }
      work.consumedProjectileIds.add(projectile.id)
      if (projectile.buildId === 1000) {
        const detonation = createPrimarySpellWeldFireDetonation(
          work.nextSpellId,
          projectile,
          projectile.position,
          work.tick,
          work.rng,
          projectile.presentationSeed ?? 0,
          true,
          work.registerWorldPainter,
        )
        work.rng = detonation.rng
        work.pendingFireActorContacts.push(...detonation.contacts)
        work.impactTransients.push(...work.enrollCombatActors(detonation.transients))
        work.nextSpellId = detonation.nextId
      } else {
        work.publishContactImpact(projectile, projectile.position)
      }
      continue
    }

    const targets = rows.map(({ target }) => target)
    const target = projectile.kind === 'fire'
      ? firstNativeFireballPointContact({
          actorMask: 0x6,
          direction: projectile.direction,
          hostileCorridorLength: work.fireballHostileCorridorLength(projectile.ownerId),
          position: projectile.position,
          queryRadius: PRIMARY_SPELL_FIRE_COLLISION_RADIUS,
          targets,
        })
      : firstNativePrimaryPointContact({
          actorMask: nativeMagicMissileActorMask(projectile),
          position: projectile.position,
          queryRadius: PRIMARY_SPELL_ETHER_COLLISION_RADIUS,
          targets,
        })
    if (!target) continue
    const actor = rows.find(({ target: candidate }) => candidate.id === target.id)?.actor
    if (!actor) {
      work.consumedProjectileIds.add(projectile.id)
      work.publishContactImpact(projectile, projectile.position)
      continue
    }

    if (projectile.kind === 'fire') {
      const amount = nativeFireDirectDamage(projectile.damage, projectile.explodeDamage)
      if (amount > 0) {
        const damaged = damageBoneyardEnemy(work.enemies, {
          magic: true,
          lethalObserver: work.lethalObserver,
          actorId: actor.id,
          amount,
          sourcePlayerId: projectile.ownerId,
          registerWorldPainter: work.registerWorldPainter,
          tick: work.tick,
        })
        if (!damaged.accepted) continue
        work.queueBurn(
          actor.id,
          projectile.ownerId,
          projectile.burnDamage,
        )
        work.enemies = damaged.store
        work.events.push(...damaged.events)
        work.hits.push(spellHit(projectile, actor.id, amount, damaged.killed, work.tick))
      }
      work.consumedProjectileIds.add(projectile.id)
      const detonation = createPrimarySpellFireDetonation(
        work.nextSpellId,
        projectile,
        projectile.position,
        work.rng,
        work.registerWorldPainter,
      )
      work.rng = detonation.rng
      work.pendingFireActorContacts.push(...detonation.contacts)
      work.impactTransients.push(...work.enrollCombatActors(detonation.transients))
      work.nextSpellId = detonation.nextId
      continue
    }

    const amount = projectileDamage(projectile)
      * validatedDamageMultiplier(
        work.damageMultiplier(actor.id, projectile.kind, projectile.ownerId),
      )
    const damaged = damageBoneyardEnemy(work.enemies, {
      magic: true,
      actorId: actor.id,
      amount,
      lethalObserver: work.lethalObserver,
      sourcePlayerId: projectile.ownerId,
      registerWorldPainter: work.registerWorldPainter,
      tick: work.tick,
    })
    if (!damaged.accepted) continue

    work.enemies = damaged.store
    work.events.push(...damaged.events)
    work.hits.push(spellHit(projectile, actor.id, amount, damaged.killed, work.tick))
    if (projectile.kind === 'ether' && projectile.piercesRemaining > 0) {
      const continuation = continuePiercingEtherProjectile(
        projectile,
        target,
        rows.map(({ target: rowTarget }) => rowTarget),
      )
      work.updatedProjectiles.set(projectile.id, continuation.projectile)
      for (const origin of continuation.streakOrigins) {
        work.impactTransients.push(work.enrollCombatActor({
          ageTicks: 0,
          headingDegrees: projectile.headingDegrees,
          id: work.nextSpellId,
          kind: 'ether-pierce-streak',
          origin,
          ownerId: projectile.ownerId,
          painterRegistrations: Object.freeze([
            work.registerCombatPainter('transient'),
          ]),
          visualScale: continuation.projectile.visualScale,
          worldKey: projectile.worldKey,
        }))
        work.nextSpellId += 1
      }
      continue
    }
    work.consumedProjectileIds.add(projectile.id)
    work.publishContactImpact(projectile, projectile.position)
  }
}

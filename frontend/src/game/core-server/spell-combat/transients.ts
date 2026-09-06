import { consumeNativeEarthBoulderContact } from '../../core-kernels/native-earth-boulder.ts'
import {
  NATIVE_WELD_HAIL_COLD_SLOW_FACTOR,
  NATIVE_WELD_HAIL_COLD_SLOW_TICKS,
  NATIVE_WELD_HAIL_FLIGHT_SUBSTEPS,
  NATIVE_WELD_HAIL_TARGET_RADIUS_FACTOR,
  createNativeWeldHailContactPresentation,
  createNativeWeldHailKnockback,
} from '../../core-kernels/native-weld-hail-contact.ts'
import {
  nativeWeldMeteorDirectRadius,
  nativeWeldMeteorPulseRadius,
} from '../../core-kernels/native-weld-meteor.ts'
import {
  nativeWeldHailstoneDrawOffset,
  nativeWeldHailstoneFlightContactSubsteps,
  retainNativeWeldHailstoneDamage,
  retainNativeWeldPersistentActorContacts,
} from '../../core-kernels/native-weld-primary-runtime.ts'
import {
  firstNativePrimaryPointContact,
  nativePrimaryRootTargets,
} from '../../core-kernels/primary-spell-targeting.ts'
import {
  PRIMARY_SPELL_EARTH_COLLISION_RADIUS_SCALE,
  createPrimarySpellWeldBoulderTerminal,
  createPrimarySpellWeldFireDetonation,
} from '../../core-kernels/primary-spells.ts'
import { damageBoneyardEnemy } from '../enemies/damage.ts'
import { transientSpellHit } from './damage.ts'
import { bySpellId, nativePrimaryRootTargetRows, primaryTargetRows } from './targets.ts'
import { BoneyardSpellCombatWork } from './work.ts'

export function resolvePersistentContacts(work: BoneyardSpellCombatWork): void {
  for (const effect of [...work.sourceSpells.transients].sort(bySpellId)) {
    if (
      effect.kind !== 'weld-persistent'
      || effect.phase !== 'flight'
      || effect.worldKey !== work.worldKey
    ) continue
    const rows = primaryTargetRows(work.enemies)
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
      let contactScale = effect.scale
      let continueTraversal = true
      for (const target of contacts) {
        if (!continueTraversal) break
        const actor = rows.find(({ target: candidate }) => candidate.id === target.id)?.actor
        if (!actor) continue
        const contact = consumeNativeEarthBoulderContact({
          releaseBaseDamage: effect.damage,
          releaseCharge: effect.maximumScale,
          remainingPool: remainingDamage,
          targetHealth: Math.max(0, actor.currentHealth),
          toughness: effect.toughness,
        })
        const damaged = damageBoneyardEnemy(work.enemies, {
          magic: true,
          lethalObserver: work.lethalObserver,
          actorId: actor.id,
          amount: contact.damage,
          sourcePlayerId: effect.ownerId,
          registerWorldPainter: work.registerWorldPainter,
          tick: work.tick,
        })
        if (!damaged.accepted) continue
        hitTargetIds.push(target.id)
        work.enemies = damaged.store
        work.events.push(...damaged.events)
        contactScale = contact.charge
        continueTraversal = contact.continueTraversal
        work.publishWeldBoulderContactDebris({ ...effect, scale: contact.charge })
        remainingDamage = contact.remainingPool
        work.hits.push({
          actorId: actor.id,
          amount: contact.damage,
          killed: damaged.killed,
          ownerId: effect.ownerId,
          spellId: effect.id,
          spellKind: 'weld',
          tick: work.tick,
        })
      }
      const retained = retainNativeWeldPersistentActorContacts(
        effect,
        hitTargetIds,
        remainingDamage,
        contactScale,
      )
      if (retained) {
        work.updatedTransients.set(effect.id, retained)
      } else {
        work.consumedTransientIds.add(effect.id)
        const terminal = createPrimarySpellWeldBoulderTerminal(
          work.nextSpellId,
          effect,
          work.tick,
          work.rng,
          work.registerWorldPainter,
        )
        work.impactTransients.push(...work.enrollCombatActors(terminal.transients))
        work.nextSpellId = terminal.nextId
        work.rng = terminal.rng
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
      const currentRows = primaryTargetRows(work.enemies)
      const targets = nativePrimaryRootTargets(
        substep.origin,
        queryRadius,
        0x2,
        currentRows.map(({ target }) => target),
      )
      for (const target of targets) {
        const currentRow = primaryTargetRows(work.enemies).find(({ target: candidate }) => (
          candidate.id === target.id
        ))
        if (!currentRow) continue
        for (const rock of effect.rocks) {
          const currentActor = primaryTargetRows(work.enemies).find(({ target: candidate }) => (
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

          work.queueTargetEffect(currentActor.id, {
            coldSlowFactor: NATIVE_WELD_HAIL_COLD_SLOW_FACTOR,
            coldSlowMaterial: true,
            coldSlowTicks: NATIVE_WELD_HAIL_COLD_SLOW_TICKS,
          })
          const targetKey = `enemy:${currentActor.id}`
          if (!work.activeKnockbackTargetIds.has(targetKey)) {
            const knockback = createNativeWeldHailKnockback({
              actor: effect,
              id: work.nextSpellId,
              targetId: targetKey,
              tick: work.tick,
            })
            if (knockback) {
              work.impactTransients.push(work.enrollCombatActor(knockback))
              work.activeKnockbackTargetIds.add(targetKey)
              work.nextSpellId += 1
            }
          }

          const targetHealth = Math.max(0, currentActor.currentHealth)
          const amount = Math.min(targetHealth, remainingDamage)
          const consumed = remainingDamage < targetHealth
            ? amount
            : amount / effect.toughness
          const damaged = damageBoneyardEnemy(work.enemies, {
            magic: true,
            lethalObserver: work.lethalObserver,
            actorId: currentActor.id,
            amount,
            sourcePlayerId: effect.ownerId,
            registerWorldPainter: work.registerWorldPainter,
            tick: work.tick,
          })
          if (!damaged.accepted) continue
          work.enemies = damaged.store
          work.events.push(...damaged.events)
          const nextDamage = Math.max(0, remainingDamage - consumed)
          damageByRockId.set(rock.rockId, nextDamage)
          work.hits.push({
            actorId: currentActor.id,
            amount,
            killed: damaged.killed,
            ownerId: effect.ownerId,
            spellId: effect.id,
            spellKind: 'weld',
            tick: work.tick,
          })
          if (nextDamage < 0.001) {
            const drawOffset = nativeWeldHailstoneDrawOffset(rock)
            const presentation = createNativeWeldHailContactPresentation({
              actor: effect,
              end: point,
              firstId: work.nextSpellId,
              rng: work.rng,
              start: {
                x: Math.fround(substep.origin.x + drawOffset.x),
                y: Math.fround(substep.origin.y + drawOffset.y),
              },
              tick: work.tick,
            })
            work.rng = presentation.rng
            work.impactTransients.push(...work.enrollCombatActors(presentation.actors))
            work.nextSpellId += presentation.actors.length
          }
          if (damaged.killed) break
        }
      }
    }
    const retained = retainNativeWeldHailstoneDamage(
      effect,
      effect.rocks.map((rock) => damageByRockId.get(rock.rockId) ?? 0),
    )
    if (retained) work.updatedTransients.set(effect.id, retained)
    else work.consumedTransientIds.add(effect.id)
  }
}

export function resolveDelayedContacts(work: BoneyardSpellCombatWork): void {
  for (const effect of [...work.sourceSpells.transients].sort(bySpellId)) {
    if (effect.worldKey !== work.worldKey) continue
    if (effect.kind === 'fire-ember') {
      if (!effect.contactDue) continue
      const rows = primaryTargetRows(work.enemies)
      const target = firstNativePrimaryPointContact({
        actorMask: 0x2,
        position: effect.position,
        queryRadius: 7,
        targets: rows.map(({ target: rowTarget }) => rowTarget),
      })
      if (!target) continue
      const actor = rows.find(({ target: candidate }) => candidate.id === target.id)?.actor
      if (!actor) continue
      work.queueBurn(actor.id, effect.ownerId, effect.burnDamage)
      const damaged = damageBoneyardEnemy(work.enemies, {
        magic: true,
        lethalObserver: work.lethalObserver,
        actorId: actor.id,
        amount: effect.damage,
        sourcePlayerId: effect.ownerId,
        registerWorldPainter: work.registerWorldPainter,
        tick: work.tick,
      })
      if (!damaged.accepted) continue
      work.enemies = damaged.store
      work.events.push(...damaged.events)
      work.hits.push(transientSpellHit(effect, actor.id, effect.damage, damaged.killed, work.tick))
      work.consumedTransientIds.add(effect.id)
      work.impactTransients.push(work.enrollCombatActor({
        ageTicks: 0,
        id: work.nextSpellId,
        kind: 'fire-impact',
        lightRegistration: work.registerCombatPainter('transient'),
        origin: { ...effect.position },
        ownerId: effect.ownerId,
        worldKey: effect.worldKey,
      }))
      work.nextSpellId += 1
    }
  }

  for (const effect of [...work.sourceSpells.transients].sort(bySpellId)) {
    if (effect.kind !== 'weld-meteor' || effect.worldKey !== work.worldKey) continue
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
        work.enemies,
        effect.position,
        pulse.radius,
        0x2,
      )) {
        const damaged = damageBoneyardEnemy(work.enemies, {
          magic: true,
          lethalObserver: work.lethalObserver,
          actorId: row.actor.id,
          amount: pulse.amount,
          sourcePlayerId: effect.ownerId,
          registerWorldPainter: work.registerWorldPainter,
          tick: work.tick,
        })
        if (!damaged.accepted) continue
        work.enemies = damaged.store
        work.events.push(...damaged.events)
        work.hits.push({
          actorId: row.actor.id,
          amount: pulse.amount,
          killed: damaged.killed,
          ownerId: effect.ownerId,
          spellId: effect.id,
          spellKind: 'weld',
          tick: work.tick,
        })
      }
    }
    if (!effect.impactDue) continue
    const detonation = createPrimarySpellWeldFireDetonation(
      work.nextSpellId,
      effect,
      effect.position,
      work.tick,
      work.rng,
      effect.privateSeed,
      false,
      work.registerWorldPainter,
    )
    work.rng = detonation.rng
    work.pendingFireActorContacts.push(...detonation.contacts)
    work.impactTransients.push(...work.enrollCombatActors(detonation.transients))
    work.nextSpellId = detonation.nextId
  }
}

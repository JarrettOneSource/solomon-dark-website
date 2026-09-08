import { NATIVE_ETHER_BLAST_CONTACT_RADIUS, nativeEtherBlastDamage } from '../../core-kernels/native-ether-blast.ts'
import {
  NATIVE_HURRICANE_CONTACT_COOLDOWN,
  drawNativeHurricaneDamage,
  nativeHurricaneMovementDue,
  nativeHurricaneOrbitForce,
} from '../../core-kernels/native-hurricane.ts'
import { drawNativeInteger } from '../../core-kernels/native-rng.ts'
import type { PrimarySpellTransientState } from '../../core-kernels/primary-spells.ts'
import { createPrimarySpellWeldSteamDetonation } from '../../core-kernels/primary-spells.ts'
import { positionBoneyardEnemy } from '../boneyard-enemy-store.ts'
import { damageBoneyardEnemy, releaseBoneyardSkeletonPike, setBoneyardEnemyHurricaneContactCooldown } from '../enemies/damage.ts'
import { validatedDamageMultiplier } from './damage.ts'
import { bySpellId, nativePrimaryRootTargetRows, parseEnemyTargetId, primaryTargetRows } from './targets.ts'
import { BoneyardSpellCombatWork } from './work.ts'

const NATIVE_WELD_STEAMED_TICKS = 10

export function resolveHurricaneContacts(work: BoneyardSpellCombatWork): void {
  const hurricanes = work.sourceSpells.transients.filter((effect): effect is Extract<
    PrimarySpellTransientState,
    { kind: 'air-hurricane' }
  > => (
    effect.kind === 'air-hurricane'
    && effect.worldKey === work.worldKey
    && effect.contactCharge > 0
  )).sort(bySpellId)
  if (hurricanes.length > 0) {
    for (const row of primaryTargetRows(work.enemies)) {
      if (!row.target.active || !nativeHurricaneMovementDue(row.actor.id, work.tick)) continue
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
        const resolved = work.resolveEnemyMovement(
          row.actor.id,
          row.target.position,
          requested,
          row.target.bodyRadius,
        )
        work.enemies = positionBoneyardEnemy(work.enemies, row.actor.id, resolved).store
      }
      if (contact === null) continue
      const damage = drawNativeHurricaneDamage(
        work.rng,
        contact.contactCharge,
        contact.damageMinimum,
        contact.damageMaximum,
      )
      work.rng = damage.rng
      const amount = Math.fround(
        damage.damage * validatedDamageMultiplier(
          work.damageMultiplier(row.actor.id, 'air', contact.ownerId),
        ),
      )
      if (amount > 0) {
        const damaged = damageBoneyardEnemy(work.enemies, {
          hasMagicDamage: true,
          magic: true,
          actorId: row.actor.id,
          amount,
          lethalObserver: work.lethalObserver,
          sourcePlayerId: contact.ownerId,
          registerWorldPainter: work.registerWorldPainter,
          suppressHurtSound: damage.suppressHitSound,
          tick: work.tick,
        })
        if (damaged.accepted) {
          work.enemies = damaged.store
          work.events.push(...damaged.events)
          work.hits.push(Object.freeze({
            actorId: row.actor.id,
            amount,
            killed: damaged.killed,
            ownerId: contact.ownerId,
            spellId: contact.id,
            spellKind: 'air-hurricane',
            tick: work.tick,
          }))
        }
      }
      work.enemies = setBoneyardEnemyHurricaneContactCooldown(
        work.enemies,
        row.actor.id,
        NATIVE_HURRICANE_CONTACT_COOLDOWN,
      )
    }

    for (const effect of work.sourceSpells.transients) {
      if (
        effect.kind !== 'fire-good-imp'
        || effect.worldKey !== work.worldKey
        || !nativeHurricaneMovementDue(effect.id, work.tick)
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
      const position = work.resolveEnemyMovement(
        effect.id,
        effect.position,
        requested,
        effect.collisionRadius,
      )
      work.updatedTransients.set(effect.id, Object.freeze({
        ...effect,
        position: Object.freeze({ ...position }),
      }))
    }
  }
}

export function resolveTransientForces(work: BoneyardSpellCombatWork): void {
  for (const effect of [...work.sourceSpells.transients].sort(bySpellId)) {
    if (
      effect.kind !== 'ether-blast'
      || effect.birthTick !== work.tick
      || effect.worldKey !== work.worldKey
    ) continue
    for (const row of nativePrimaryRootTargetRows(
      work.enemies,
      effect.origin,
      NATIVE_ETHER_BLAST_CONTACT_RADIUS,
      0x2,
    )) {
      const amount = nativeEtherBlastDamage(effect.charges, row.actor.currentHealth)
      const contact = damageBoneyardEnemy(work.enemies, {
        hasMagicDamage: true,
        magic: true,
        actorId: row.actor.id,
        amount,
        lethalObserver: work.lethalObserver,
        sourcePlayerId: effect.ownerId,
        registerWorldPainter: work.registerWorldPainter,
        tick: work.tick,
      })
      if (!contact.accepted) continue
      work.enemies = contact.store
      work.events.push(...contact.events)
      work.hits.push(Object.freeze({
        actorId: row.actor.id,
        amount,
        killed: contact.killed,
        ownerId: effect.ownerId,
        spellId: effect.id,
        spellKind: 'ether-blast',
        tick: work.tick,
      }))
      work.etherBurns.push(Object.freeze({
        ownerId: effect.ownerId,
        targetId: row.actor.id,
      }))
    }
  }


  for (const effect of work.sourceSpells.transients) {
    if (effect.kind !== 'weld-hail-knockback' || effect.worldKey !== work.worldKey) continue
    const actorId = parseEnemyTargetId(effect.targetId)
    const row = actorId === null
      ? undefined
      : primaryTargetRows(work.enemies).find(({ actor }) => actor.id === actorId)
    if (!row) {
      work.consumedTransientIds.add(effect.id)
      work.activeKnockbackTargetIds.delete(effect.targetId)
      continue
    }
    work.enemies = releaseBoneyardSkeletonPike(work.enemies, row.actor.id)
    const requested = {
      x: Math.fround(row.target.position.x + effect.delta.x),
      y: Math.fround(row.target.position.y + effect.delta.y),
    }
    const resolved = work.resolveEnemyMovement(
      row.actor.id,
      row.target.position,
      requested,
      row.target.bodyRadius,
    )
    work.enemies = positionBoneyardEnemy(work.enemies, row.actor.id, resolved).store
    const remainingTicks = effect.remainingTicks - 1
    if (remainingTicks <= 0) {
      work.consumedTransientIds.add(effect.id)
      work.activeKnockbackTargetIds.delete(effect.targetId)
    } else {
      work.updatedTransients.set(effect.id, Object.freeze({
        ...effect,
        ageTicks: effect.ageTicks + 1,
        remainingTicks,
      }))
    }
  }
  for (const effect of work.sourceSpells.transients) {
    if (effect.kind !== 'weld-steam' || effect.worldKey !== work.worldKey
      || !effect.contactEnabled || !effect.contactDue) continue
    const center = {
      x: effect.position.x,
      y: Math.fround(effect.position.y + 15),
    }
    const radius = Math.fround(effect.scale * 50)
    for (const row of nativePrimaryRootTargetRows(work.enemies, center, radius, 0x2)) {
      work.queueTargetEffect(row.actor.id, {
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

  for (const pulse of work.steamedPulses) {
    if (pulse.worldKey !== work.worldKey || pulse.explodeRadius <= 0) continue
    const privateSeed = drawNativeInteger(work.rng, 1_000_000)
    work.rng = privateSeed.state
    const detonation = createPrimarySpellWeldSteamDetonation(
      work.nextSpellId,
      {
        emberDamage: pulse.emberDamage,
        emberFragments: pulse.emberFragments,
        explodeDamage: pulse.explodeDamage,
        explodeRadius: pulse.explodeRadius,
        ownerId: pulse.sourcePlayerId,
        position: { ...pulse.position },
        worldKey: work.worldKey,
      },
      work.tick,
      work.rng,
      privateSeed.value,
      work.registerWorldPainter,
    )
    work.rng = detonation.rng
    work.impactTransients.push(...work.enrollCombatActors(detonation.transients))
    work.nextSpellId = detonation.nextId
  }
}

import type { NativeFireActorContact } from '../../core-kernels/primary-spell-fire-effects.ts'
import type { PrimarySpellFireExplosionState } from '../../core-kernels/primary-spells.ts'
import { damageBoneyardEnemy } from '../enemies/damage.ts'
import { transientSpellHit, validatedDamageMultiplier } from './damage.ts'
import { type PrimaryTargetRow, bySpellId, primaryTargetRows, squaredDistance } from './targets.ts'
import { BoneyardSpellCombatWork } from './work.ts'

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

function byFireActorContactId(
  left: NativeFireActorContact,
  right: NativeFireActorContact,
): number {
  return left.spellId - right.spellId
}

export function resolveFireContacts(work: BoneyardSpellCombatWork): void {
  const explosions = [...work.sourceSpells.transients, ...work.impactTransients]
    .filter((effect): effect is PrimarySpellFireExplosionState => (
      effect.kind === 'fire-explosion' && effect.ageTicks === 0
    ))
    .sort(bySpellId)
  for (const effect of explosions) {
    if (effect.worldKey !== work.worldKey) continue
    const rows = nativeFireExplosionTargets(primaryTargetRows(work.enemies), effect)
    for (const { actor } of rows) {
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
    }
  }

  for (const contact of work.pendingFireActorContacts.sort(byFireActorContactId)) {
    if (contact.worldKey !== work.worldKey) continue
    if (contact.kind === 'fire-ember' && work.consumedTransientIds.has(contact.spellId)) continue
    const rows = primaryTargetRows(work.enemies)
    const contacted = contact.kind === 'fire-good-imp'
      ? rows.filter(({ target }) => target.id === contact.targetId)
      : rows.filter(({ target }) => (
          target.active
          && !target.pendingRemove
          && (target.actorFlags & 0x2) !== 0
          && squaredDistance(target.position, contact.position) < contact.radius ** 2
        )).slice(0, contact.kind === 'fire-ember' ? 1 : undefined)
    for (const { actor } of contacted) {
      if (contact.kind === 'fire-patch' || contact.kind === 'fire-ember') {
        work.queueBurn(
          actor.id,
          contact.ownerId,
          contact.burnDamage,
        )
      }
      const amount = contact.amount
        * validatedDamageMultiplier(
          work.damageMultiplier(actor.id, contact.kind, contact.ownerId),
        )
      const damaged = damageBoneyardEnemy(work.enemies, {
        magic: true,
        lethalObserver: work.lethalObserver,
        actorId: actor.id,
        amount,
        sourcePlayerId: contact.ownerId,
        registerWorldPainter: work.registerWorldPainter,
        tick: work.tick,
      })
      if (!damaged.accepted) continue
      work.enemies = damaged.store
      work.events.push(...damaged.events)
      work.hits.push({
        actorId: actor.id,
        amount,
        killed: damaged.killed,
        ownerId: contact.ownerId,
        spellId: contact.spellId,
        spellKind: contact.kind,
        tick: work.tick,
      })
      if (contact.kind === 'fire-ember') {
        work.consumedTransientIds.add(contact.spellId)
        work.impactTransients.push(work.enrollCombatActor({
          ageTicks: 0,
          id: work.nextSpellId,
          kind: 'fire-impact',
          lightRegistration: work.registerCombatPainter('transient'),
          origin: { ...contact.position },
          ownerId: contact.ownerId,
          worldKey: contact.worldKey,
        }))
        work.nextSpellId += 1
        break
      }
    }
  }
}

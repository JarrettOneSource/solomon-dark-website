import type { NativeFireActorContact } from '../../core-kernels/primary-spell-fire-effects.ts'
import { drawNativeFloat } from '../../core-kernels/native-rng.ts'
import { nativePrimaryRectangleTargets, nativePrimaryRootTargets } from '../../core-kernels/primary-spell-targeting.ts'
import type { PrimarySpellFireExplosionState } from '../../core-kernels/primary-spells.ts'
import { damageBoneyardEnemy } from '../enemies/damage.ts'
import { transientSpellHit, validatedDamageMultiplier } from './damage.ts'
import { type PrimaryTargetRow, bySpellId, primaryTargetRows, squaredDistance } from './targets.ts'
import { BoneyardSpellCombatWork } from './work.ts'

function nativeFireExplosionTargets(
  rows: readonly PrimaryTargetRow[],
  explosion: PrimarySpellFireExplosionState,
): readonly PrimaryTargetRow[] {
  const targets = rows.map(row => row.target)
  const radius = Math.fround(Math.fround(explosion.visualScale * 110) * 0.5)
  const ordered = explosion.presentation === 'steam'
    ? nativePrimaryRectangleTargets({
        actorMask: 0x2, origin: explosion.origin, width: radius, height: radius, targets,
      }).filter(target => squaredDistance(target.position, explosion.origin) < radius ** 2 + target.bodyRadius ** 2)
    : nativePrimaryRootTargets(explosion.origin, radius, 0x2, targets)
  const byId = new Map(rows.map(row => [row.target.id, row]))
  return ordered.map(target => byId.get(target.id)!)
}

/** 0x642BF0/0x643CA0 store one half in each damage lane, not a half total. */
export function resolveFireExplosion(work: BoneyardSpellCombatWork, effect: PrimarySpellFireExplosionState): void {
  if (effect.worldKey !== work.worldKey) return
  for (const { actor } of nativeFireExplosionTargets(primaryTargetRows(work.enemies), effect)) {
    work.queueBurn(actor.id, effect.ownerId, effect.burnDamage)
    const amount = Math.fround(effect.damage + effect.damage)
    if (amount <= 0) continue
    const damaged = damageBoneyardEnemy(work.enemies, {
      enhancedEffects: work.enhancedEffects,
      hasMagicDamage: true,
      // Reset context flags are zero even though the magic damage lane is nonzero.
      magic: false,
      lethalObserver: work.lethalObserver,
      actorId: actor.id, amount, sourcePlayerId: effect.ownerId,
      registerWorldPainter: work.registerWorldPainter, tick: work.tick,
    })
    if (!damaged.accepted) continue
    work.enemies = damaged.store
    work.events.push(...damaged.events)
    work.hits.push(transientSpellHit(effect, actor.id, amount, damaged.killed, work.tick))
  }
}

export function resolveFireContacts(work: BoneyardSpellCombatWork): void {
  const explosions = [...work.sourceSpells.transients, ...work.impactTransients]
    .filter((effect): effect is PrimarySpellFireExplosionState => (
      effect.kind === 'fire-explosion' && effect.ageTicks === 0
    )).sort(bySpellId)
  for (const effect of explosions) resolveFireExplosion(work, effect)
  resolveFireActorContacts(work, work.pendingFireActorContacts)
}

/** A constructor may submit only its newborn Ember contact here, never replay a full pass. */
export function resolveFireActorContacts(
  work: BoneyardSpellCombatWork,
  contacts: readonly NativeFireActorContact[],
): void {
  for (const contact of [...contacts].sort((a, b) => a.spellId - b.spellId)) {
    if (contact.worldKey !== work.worldKey) continue
    if (contact.kind === 'fire-ember' && work.consumedTransientIds.has(contact.spellId)) continue
    const rows = primaryTargetRows(work.enemies)
    const orderedEmbers = contact.kind === 'fire-ember'
      ? nativePrimaryRootTargets(contact.position, contact.radius, 0x2, rows.map(row => row.target))
      : []
    const contacted = contact.kind === 'fire-good-imp'
      ? rows.filter(({ target }) => target.id === contact.targetId)
      : contact.kind === 'fire-ember'
        ? orderedEmbers.slice(0, 1).map(target => rows.find(row => row.target.id === target.id)!)
        : rows.filter(({ target }) => (
            target.active && !target.pendingRemove && (target.actorFlags & 0x2) !== 0
            && squaredDistance(target.position, contact.position) < contact.radius ** 2
          ))
    for (const { actor } of contacted) {
      if (contact.kind === 'fire-patch' || contact.kind === 'fire-ember') {
        work.queueBurn(actor.id, contact.ownerId, contact.burnDamage)
      }
      const amount = contact.amount * validatedDamageMultiplier(
        work.damageMultiplier(actor.id, contact.kind, contact.ownerId),
      )
      if (amount <= 0) continue
      let hitStrength: number | undefined
      if (contact.kind === 'fire-patch') {
        const response = drawNativeFloat(work.rng, 0.5)
        work.rng = response.state
        hitStrength = Math.fround(0.25 + response.value)
      }
      const damaged = damageBoneyardEnemy(work.enemies, {
        enhancedEffects: work.enhancedEffects, hitStrength,
        suppressHitReaction: contact.kind === 'fire-patch',
        hasMagicDamage: true, magic: true, lethalObserver: work.lethalObserver,
        actorId: actor.id, amount, sourcePlayerId: contact.ownerId,
        registerWorldPainter: work.registerWorldPainter, tick: work.tick,
      })
      if (!damaged.accepted) continue
      work.enemies = damaged.store
      work.events.push(...damaged.events)
      work.hits.push({
        actorId: actor.id, amount, killed: damaged.killed, ownerId: contact.ownerId,
        spellId: contact.spellId, spellKind: contact.kind, tick: work.tick,
      })
      if (contact.kind === 'fire-ember') {
        work.consumedTransientIds.add(contact.spellId)
        work.impactTransients.push(work.enrollCombatActor({
          ageTicks: 0, id: work.nextSpellId, kind: 'fire-impact',
          lightRegistration: work.registerCombatPainter('transient'),
          origin: { ...contact.position }, ownerId: contact.ownerId, worldKey: contact.worldKey,
        }))
        work.nextSpellId += 1
        break
      }
    }
  }
}

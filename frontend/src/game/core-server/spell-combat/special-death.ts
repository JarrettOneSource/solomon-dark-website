import type { NativeRngState } from '../../core-kernels/native-rng.ts'
import type { NativeSpellSpecialDeathPayload } from '../../core-kernels/native-special-death-payload.ts'
import { createNativeWeldSteamDetonation } from '../../core-kernels/native-weld-steam.ts'
import type { NativeWorldManagerRegistration, RegisterNativeWorldPainter } from '../../core-kernels/native-world-manager-order.ts'
import { createNativeFireDetonation } from '../../core-kernels/primary-spell-fire-effects.ts'
import type { PrimarySpellFireExplosionState } from '../../core-kernels/primary-spells.ts'
import type { BoneyardEnemyLethalObserver, BoneyardEnemyStore } from '../enemies/model.ts'
import { resolveFireActorContacts, resolveFireExplosion } from './fire.ts'
import type { BoneyardSpellCombatResult, BoneyardSpellDamageMultiplier } from './model.ts'
import type { BoneyardSpellTarget } from './targets.ts'
import { BoneyardSpellCombatWork, finishSpellCombat } from './work.ts'

/** Caller owns receiver admission. Only this newborn's contacts run here. */
export function resolveBoneyardSpecialDeathPayload(input: Readonly<{
  payload: NativeSpellSpecialDeathPayload
  victim: BoneyardSpellTarget
  sourceEnemies: BoneyardEnemyStore
  nextSpellId: number
  rng: NativeRngState
  ownerId: string
  tick: number
  worldKey: string
  enhancedEffects: boolean
  registerWorldPainter?: RegisterNativeWorldPainter
  lethalObserver?: BoneyardEnemyLethalObserver
  damageMultiplier?: BoneyardSpellDamageMultiplier
}>): BoneyardSpellCombatResult {
  const work = new BoneyardSpellCombatWork({
    sourceEnemies: input.sourceEnemies,
    sourceSpells: { nextId: input.nextSpellId, projectiles: [], transients: [] },
    channelEmissions: [], tick: input.tick, worldKey: input.worldKey, sourceRng: input.rng,
    enhancedEffects: input.enhancedEffects, lightAt: null, firstWorldContact: null,
    registerWorldPainter: input.registerWorldPainter, lethalObserver: input.lethalObserver,
    damageMultiplier: input.damageMultiplier ?? (() => 1), primarySceneryTargets: [],
    fireActorContacts: [], resolveEnemyMovement: (_id, _start, requested) => requested,
    fireballHostileCorridorLength: () => 1_600,
  })
  // Cocoon release/removal is not the native +0x88 dispatch, even if killed.
  if ('brain' in input.victim && input.victim.brain.family === 'cocoon') return finishSpellCombat(work)
  const origin = input.victim.position
  const payload = input.payload
  if (payload.kind === 'fire') {
    if (payload.explodeDamage <= 0) return finishSpellCombat(work)
    const explosionId = work.nextSpellId
    const firstEmberId = explosionId + (payload.explodeRadius > 0 ? 1 : 0)
    // Reserve IDs while callbacks publish impacts during each Ember pre-tick.
    work.nextSpellId = firstEmberId + payload.emberFragments
    const registrations = new Map<number, NativeWorldManagerRegistration>()
    const detonation = createNativeFireDetonation(firstEmberId, {
      ...payload, burnDamage: 0, spentEmber: { kind: 'none' },
    }, origin, input.ownerId, input.worldKey, work.rng, {
      beforeEmbers: (explosion, soundPitch) => {
        if (explosion === null) return
        const actor: PrimarySpellFireExplosionState = work.enrollCombatActor({
          ...explosion, ageTicks: 0, id: explosionId, kind: 'fire-explosion',
          lightRegistration: work.registerCombatPainter('transient'), soundPitch,
        })
        work.ownedTransients.push(actor)
        resolveFireExplosion(work, actor)
      },
      registerEmber: ember => { registrations.set(ember.id, work.registerCombatPainter('actor')) },
      resolveEmberContact: contact => {
        resolveFireActorContacts(work, [contact])
        return work.consumedTransientIds.has(contact.spellId)
      },
    })
    work.rng = detonation.rng
    for (const ember of detonation.embers) {
      const lightRegistration = registrations.get(ember.id)
      if (!lightRegistration) throw new Error('Special-death Ember lost its constructor registration')
      work.ownedTransients.push(work.enrollCombatActor({ ...ember, kind: 'fire-ember', lightRegistration }))
    }
  } else {
    if (payload.explodeRadius <= 0) return finishSpellCombat(work)
    const explosionId = work.nextSpellId
    const detonation = createNativeWeldSteamDetonation({
      explodeDamage: payload.explodeDamage, explodeRadius: payload.explodeRadius,
      firstFragmentId: explosionId + 1, fragmentCount: payload.emberFragments,
      fragmentDamage: payload.emberDamage, origin, ownerId: input.ownerId,
      privateSeed: payload.privateSeed, rng: work.rng, tick: input.tick, worldKey: input.worldKey,
      beforeFragments: explosion => {
        const actor: PrimarySpellFireExplosionState = work.enrollCombatActor({
          ...explosion, ageTicks: 0, id: explosionId, kind: 'fire-explosion',
          lightRegistration: work.registerCombatPainter('transient'),
        })
        work.ownedTransients.push(actor)
        resolveFireExplosion(work, actor)
      },
    })
    work.rng = detonation.rng
    work.nextSpellId = detonation.nextId
    work.ownedTransients.push(...work.enrollCombatActors(detonation.fragments))
  }
  return finishSpellCombat(work)
}

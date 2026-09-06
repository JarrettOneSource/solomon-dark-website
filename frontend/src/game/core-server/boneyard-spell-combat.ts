import type {
  BoneyardSpellCombatResult,
  BoneyardSpellDamageMultiplier,
  BoneyardSpellLightSampler,
  BoneyardSpellWorldContact,
  ResolveBoneyardSpellEnemyMovement,
} from './spell-combat/model.ts'
import type { NativeRngState } from '../core-kernels/native-rng.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import type { NativeSecondarySteamedPulse } from '../core-kernels/native-secondary-abilities.ts'
import type { RegisterNativeWorldPainter } from '../core-kernels/native-world-manager-order.ts'
import type { NativeFireActorContact } from '../core-kernels/primary-spell-fire-effects.ts'
import type { PrimarySpellTarget } from '../core-kernels/primary-spell-targeting.ts'
import type { PrimarySpellChannelEmission, PrimarySpellSimulationState } from '../core-kernels/primary-spells.ts'
import type { BoneyardEnemyLethalObserver, BoneyardEnemyStore } from './enemies/model.ts'
import { resolveChannelContacts } from './spell-combat/channels.ts'
import { resolveFireContacts } from './spell-combat/fire.ts'
import { resolveHurricaneContacts, resolveTransientForces } from './spell-combat/forces.ts'
import { resolveProjectileContacts } from './spell-combat/projectiles.ts'
import { resolveDelayedContacts, resolvePersistentContacts } from './spell-combat/transients.ts'
import { BoneyardSpellCombatWork, finishSpellCombat } from './spell-combat/work.ts'

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
  registerWorldPainter?: RegisterNativeWorldPainter,
  damageMultiplier: BoneyardSpellDamageMultiplier = () => 1,
  primarySceneryTargets: readonly PrimarySpellTarget[] = [],
  lethalObserver?: BoneyardEnemyLethalObserver,
  fireActorContacts: readonly NativeFireActorContact[] = [],
  resolveEnemyMovement: ResolveBoneyardSpellEnemyMovement = (_actorId, _start, requested) => (
    requested
  ),
  steamedPulses: readonly NativeSecondarySteamedPulse[] = [],
  fireballHostileCorridorLength: (ownerId: string) => number = () => 1_600,
  lightAt: BoneyardSpellLightSampler | null = null,
): BoneyardSpellCombatResult {
  validateTick(tick)
  const work = new BoneyardSpellCombatWork({
    lightAt, sourceEnemies, sourceSpells, channelEmissions, tick, worldKey, sourceRng, firstWorldContact, registerWorldPainter, damageMultiplier, primarySceneryTargets, lethalObserver, fireActorContacts, resolveEnemyMovement, steamedPulses, fireballHostileCorridorLength,
  })
  resolveHurricaneContacts(work)
  resolveTransientForces(work)
  resolveProjectileContacts(work)
  resolvePersistentContacts(work)
  resolveDelayedContacts(work)
  resolveFireContacts(work)
  resolveChannelContacts(work)
  return finishSpellCombat(work)
}

function validateTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError('Boneyard spell-combat tick must be a non-negative safe integer')
  }
}

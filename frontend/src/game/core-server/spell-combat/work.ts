import type { BoneyardSpellLightSampler } from './model.ts'
import type { NativeRngState } from '../../core-kernels/native-rng.ts'
import type {
  NativeSecondarySteamedPulse,
  NativeSecondaryTargetEffectPatch,
} from '../../core-kernels/native-secondary-abilities.ts'
import {
  createNativeWeldBoulderContactDebrisProgram,
} from '../../core-kernels/native-weld-boulder-debris.ts'
import { createNativeWeldBoulderDebrisActor } from '../../core-kernels/native-weld-primary-runtime.ts'
import {
  type RegisterNativeWorldPainter,
  createNativeWorldManagerOrder,
  registerNativeWorldPainterRoots,
} from '../../core-kernels/native-world-manager-order.ts'
import type { NativeFireActorContact } from '../../core-kernels/primary-spell-fire-effects.ts'
import type { PrimarySpellTarget } from '../../core-kernels/primary-spell-targeting.ts'
import {
  type PrimarySpellChannelEmission,
  type PrimarySpellProjectileState,
  type PrimarySpellSimulationState,
  type PrimarySpellTransientState,
  createPrimarySpellContactImpact,
  createPrimarySpellEarthBoulderBit,
  nativePrimaryPainterRegistrationContract,
} from '../../core-kernels/primary-spells.ts'
import type { Vector2 } from '../../core-kernels/vector.ts'
import type {
  BoneyardEnemyLethalObserver,
  BoneyardEnemySemanticEvent,
  BoneyardEnemyStore,
} from '../enemies/model.ts'
import type {
  BoneyardSpellBurnContact,
  BoneyardSpellCombatOptions,
  BoneyardSpellCombatResult,
  BoneyardSpellDamageMultiplier,
  BoneyardSpellEtherBurnContact,
  BoneyardSpellHit,
  BoneyardSpellTargetEffectContact,
  BoneyardSpellWorldContact,
  ResolveBoneyardSpellEnemyMovement,
} from './model.ts'

function assertCombatPainterMembership(
  actors: readonly PrimarySpellTransientState[],
): void {
  for (const actor of actors) {
    const contract = nativePrimaryPainterRegistrationContract(actor)
    const registrations = actor.painterRegistrations
    if (
      registrations === undefined
      || registrations.length !== contract.count
      || registrations.some(({ managerLane }) => managerLane !== contract.managerLane)
    ) {
      throw new Error(
        `Boneyard combat-born ${actor.kind}:${actor.id} lost native painter-manager membership`,
      )
    }
  }
}

export class BoneyardSpellCombatWork {
  readonly lightAt: BoneyardSpellLightSampler | null
  readonly activeKnockbackTargetIds: Set<string>
  readonly sourceSpells: PrimarySpellSimulationState
  readonly channelEmissions: readonly PrimarySpellChannelEmission[]
  readonly tick: number
  readonly worldKey: string
  readonly firstWorldContact: BoneyardSpellWorldContact | null
  readonly registerWorldPainter?: RegisterNativeWorldPainter
  readonly damageMultiplier: BoneyardSpellDamageMultiplier
  readonly primarySceneryTargets: readonly PrimarySpellTarget[]
  readonly lethalObserver?: BoneyardEnemyLethalObserver
  readonly resolveEnemyMovement: ResolveBoneyardSpellEnemyMovement
  readonly steamedPulses: readonly NativeSecondarySteamedPulse[]
  readonly fireballHostileCorridorLength: (ownerId: string) => number
  enemies: BoneyardEnemyStore
  rng: NativeRngState
  readonly consumedProjectileIds: Set<number>
  readonly consumedTransientIds: Set<number>
  readonly updatedProjectiles: Map<number, PrimarySpellProjectileState>
  readonly updatedTransients: Map<number, PrimarySpellTransientState>
  readonly hits: BoneyardSpellHit[]
  readonly burns: BoneyardSpellBurnContact[]
  readonly etherBurns: BoneyardSpellEtherBurnContact[]
  readonly events: BoneyardEnemySemanticEvent[]
  readonly targetEffects: BoneyardSpellTargetEffectContact[]
  readonly impactTransients: PrimarySpellTransientState[]
  readonly ownedTransients: PrimarySpellTransientState[]
  readonly pendingFireActorContacts: NativeFireActorContact[]
  nextSpellId: number
  readonly registerCombatPainter: RegisterNativeWorldPainter
  constructor(options: BoneyardSpellCombatOptions) {
    this.lightAt = options.lightAt
    this.sourceSpells = options.sourceSpells
    this.channelEmissions = options.channelEmissions
    this.tick = options.tick
    this.worldKey = options.worldKey
    this.firstWorldContact = options.firstWorldContact
    this.registerWorldPainter = options.registerWorldPainter
    this.damageMultiplier = options.damageMultiplier
    this.primarySceneryTargets = options.primarySceneryTargets
    this.lethalObserver = options.lethalObserver
    this.resolveEnemyMovement = options.resolveEnemyMovement
    this.steamedPulses = options.steamedPulses
    this.fireballHostileCorridorLength = options.fireballHostileCorridorLength
    this.enemies = options.sourceEnemies
    this.rng = options.sourceRng
    this.consumedProjectileIds = new Set<number>()
    this.consumedTransientIds = new Set<number>()
    this.updatedProjectiles = new Map<number, PrimarySpellProjectileState>()
    this.updatedTransients = new Map<number, PrimarySpellTransientState>()
    this.hits = []
    this.burns = []
    this.etherBurns = []
    this.events = []
    this.targetEffects = []
    this.impactTransients = []
    this.ownedTransients = []
    this.pendingFireActorContacts = [...options.fireActorContacts]
    this.nextSpellId = this.sourceSpells.nextId
    this.registerCombatPainter = this.registerWorldPainter ?? createNativeWorldManagerOrder({
    nextRegistrationOrdinal: { actor: this.nextSpellId, transient: this.nextSpellId },
  }).register
  this.activeKnockbackTargetIds = new Set(this.sourceSpells.transients.flatMap((effect) => {
    if (effect.worldKey !== this.worldKey) return []
    if (effect.kind === 'weld-hail-knockback') return [effect.targetId]
    if (effect.kind === 'player-staff-contact-knockback') return [effect.targetId]
    return []
  }))
  }

  readonly enrollCombatActor = <T extends PrimarySpellTransientState>(actor: T): T => {
    const contract = nativePrimaryPainterRegistrationContract(actor)
    const existing = actor.painterRegistrations
    if (existing !== undefined) {
      if (
        existing.length !== contract.count
        || existing.some(({ managerLane }) => managerLane !== contract.managerLane)
      ) throw new Error(`${actor.kind} changed native painter-manager membership`)
      return actor
    }
    const lightRegistration = 'lightRegistration' in actor ? actor.lightRegistration : null
    const painterRegistrations = contract.count === 1
      && lightRegistration?.managerLane === contract.managerLane
      ? Object.freeze([lightRegistration])
      : registerNativeWorldPainterRoots(
          this.registerCombatPainter,
          contract.managerLane,
          contract.count,
        )
    const enrolled: T = { ...actor, painterRegistrations }
    Object.freeze(enrolled)
    return enrolled
  }

  readonly enrollCombatActors = <T extends PrimarySpellTransientState>(
    actors: readonly T[],
  ): T[] => actors.map(this.enrollCombatActor)

  readonly queueBurn = (targetId: number, ownerId: string, damage: number): void => {
    if (damage <= 0) return
    this.burns.push(Object.freeze({ damage, ownerId, targetId }))
  }

  readonly queueTargetEffect = (
    targetId: number,
    patch: NativeSecondaryTargetEffectPatch,
  ): void => {
    this.targetEffects.push(Object.freeze({ patch: Object.freeze({ ...patch }), targetId, worldKey: this.worldKey }))
  }

  readonly publishContactImpact = (
    projectile: PrimarySpellProjectileState,
    origin: Readonly<Vector2>,
  ): void => {
    const impactProgram = createPrimarySpellContactImpact(
      this.nextSpellId,
      projectile,
      origin,
      this.tick,
      this.rng,
      this.registerWorldPainter,
    )
    this.rng = impactProgram.rng
    const impact = impactProgram.impact
    if (!impact) return
    this.impactTransients.push(this.enrollCombatActor(impact))
    this.nextSpellId += 1
  }

  readonly publishEarthBoulderContactDebris = (
    projectile: Extract<PrimarySpellProjectileState, { kind: 'earth' }>,
    charge: number,
  ): void => {
    const program = createNativeWeldBoulderContactDebrisProgram({ rng: this.rng, scale: charge })
    this.rng = program.rng
    const id = this.nextSpellId
    this.nextSpellId += 1
    if (!Number.isFinite(charge)) return
    this.impactTransients.push(this.enrollCombatActor(createPrimarySpellEarthBoulderBit({
      debris: program.debris[0]!,
      enhancedEffects: true,
      id,
      origin: projectile.position,
      ownerId: projectile.ownerId,
      registerWorldPainter: this.registerCombatPainter,
      tick: this.tick,
      worldKey: projectile.worldKey,
    })))
  }

  readonly publishWeldBoulderContactDebris = (effect: Readonly<{
    buildId: 1006
    direction: Vector2
    origin: Vector2
    ownerId: string
    scale: number
    vector: readonly number[]
    worldKey: string
  }>): void => {
    const program = createNativeWeldBoulderContactDebrisProgram({
      rng: this.rng,
      scale: effect.scale,
    })
    this.rng = program.rng
    const id = this.nextSpellId
    this.nextSpellId += 1
    if (!Number.isFinite(effect.scale)) return
    this.impactTransients.push(this.enrollCombatActor(createNativeWeldBoulderDebrisActor({
      buildId: effect.buildId,
      debris: program.debris[0]!,
      direction: effect.direction,
      id,
      origin: effect.origin,
      ownerId: effect.ownerId,
      tick: this.tick,
      vector: effect.vector,
      worldKey: effect.worldKey,
    })))
  }
}

export function finishSpellCombat(work: BoneyardSpellCombatWork): BoneyardSpellCombatResult {
  const steppedTransients: PrimarySpellTransientState[] = []
  for (const effect of work.sourceSpells.transients) {
    if (effect.worldKey !== work.worldKey) {
      steppedTransients.push(effect)
      continue
    }
    steppedTransients.push(work.updatedTransients.get(effect.id) ?? effect)
  }

  assertCombatPainterMembership([...work.impactTransients, ...work.ownedTransients])

  const spells = work.consumedProjectileIds.size === 0
    && work.consumedTransientIds.size === 0
    && work.updatedProjectiles.size === 0
    && work.updatedTransients.size === 0
    && work.impactTransients.length === 0
    && work.ownedTransients.length === 0
    && steppedTransients.length === work.sourceSpells.transients.length
    && steppedTransients.every((effect, index) => effect === work.sourceSpells.transients[index])
    ? work.sourceSpells
    : {
        ...work.sourceSpells,
        nextId: work.nextSpellId,
        projectiles: work.sourceSpells.projectiles
          .filter((projectile) => !work.consumedProjectileIds.has(projectile.id))
          .map((projectile) => work.updatedProjectiles.get(projectile.id) ?? projectile),
        transients: [
          ...steppedTransients
            .filter((effect) => !work.consumedTransientIds.has(effect.id)),
          ...work.impactTransients.filter((effect) => !work.consumedTransientIds.has(effect.id)),
          ...work.ownedTransients.filter((effect) => !work.consumedTransientIds.has(effect.id)),
        ],
      }

  return {
    burns: Object.freeze(work.burns),
    enemies: work.enemies,
    etherBurns: Object.freeze(work.etherBurns),
    events: Object.freeze(work.events),
    hits: Object.freeze(work.hits),
    rng: work.rng,
    spells,
    targetEffects: Object.freeze(work.targetEffects),
  }
}

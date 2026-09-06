import type {
  NativeSecondaryTargetEffectPatch,
} from '../../core-kernels/native-secondary-abilities.ts'
import type { RegisterNativeWorldPainter } from '../../core-kernels/native-world-manager-order.ts'
import type {
  PrimarySpellChannelEmission,
  PrimarySpellFireEmberState,
  PrimarySpellFireExplosionState,
  PrimarySpellProjectileState,
} from '../../core-kernels/primary-spells.ts'
import { damageBoneyardEnemy } from '../enemies/damage.ts'
import type {
  BoneyardEnemyLethalObserver,
  BoneyardEnemySemanticEvent,
  BoneyardEnemyStore,
} from '../enemies/model.ts'
import type { BoneyardSpellHit } from './model.ts'
import { type BoneyardSpellTarget, boneyardSpellTargetById } from './targets.ts'

const NATIVE_LIGHTNING_STUN_TICKS = 25

export function airStunModifier(
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

export function applyDamageWithDisintegrate(
  source: BoneyardEnemyStore,
  actorId: number,
  amount: number,
  ownerId: string,
  tick: number,
  disintegrate: boolean,
  registerWorldPainter: RegisterNativeWorldPainter | undefined,
  lethalObserver: BoneyardEnemyLethalObserver | undefined,
): {
  readonly accepted: boolean
  readonly amount: number
  readonly enemies: BoneyardEnemyStore
  readonly events: readonly BoneyardEnemySemanticEvent[]
  readonly killed: boolean
} {
  const ordinary = damageBoneyardEnemy(source, {
    hasMagicDamage: true,
    magic: true,
    lethalObserver,
    actorId,
    amount,
    sourcePlayerId: ownerId,
    registerWorldPainter,
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
    hasMagicDamage: true,
    magic: true,
    lethalObserver,
    actorId,
    amount: executeAmount,
    sourcePlayerId: ownerId,
    registerWorldPainter,
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

function targetMaximumHealth(target: BoneyardSpellTarget): number {
  return 'config' in target ? target.config.maximumHealth : target.maximumHealth
}

export function transientSpellHit(
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

export function channelSpellHit(
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

export function spellHit(
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

export function validatedDamageMultiplier(multiplier: number): number {
  if (!Number.isFinite(multiplier) || multiplier < 0) {
    throw new RangeError('Boneyard spell damage multiplier must be finite and non-negative')
  }
  return multiplier
}

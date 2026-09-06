import type { NativeRngState } from '../../core-kernels/native-rng.ts'
import type {
  NativeSecondarySteamedPulse,
  NativeSecondaryTargetEffectPatch,
} from '../../core-kernels/native-secondary-abilities.ts'
import type { RegisterNativeWorldPainter } from '../../core-kernels/native-world-manager-order.ts'
import type { NativeFireActorContact } from '../../core-kernels/primary-spell-fire-effects.ts'
import type { PrimarySpellTarget } from '../../core-kernels/primary-spell-targeting.ts'
import type {
  PrimarySpellChannelEmission,
  PrimarySpellProjectileKind,
  PrimarySpellSimulationState,
} from '../../core-kernels/primary-spells.ts'
import type { Vector2 } from '../../core-kernels/vector.ts'
import type {
  BoneyardEnemyLethalObserver,
  BoneyardEnemySemanticEvent,
  BoneyardEnemyStore,
} from '../enemies/model.ts'

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

export const NATIVE_WELD_FROST_SLOW_FACTOR = 0.5

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
  ownerId: string,
) => number

export type ResolveBoneyardSpellEnemyMovement = (
  actorId: number,
  start: Readonly<Vector2>,
  requested: Readonly<Vector2>,
  radius: number,
) => Readonly<Vector2>

export type BoneyardSpellLightSampler = (position: Readonly<Vector2>) => number

export interface BoneyardSpellCombatOptions {
  readonly lightAt: BoneyardSpellLightSampler | null
  readonly sourceEnemies: BoneyardEnemyStore
  readonly sourceSpells: PrimarySpellSimulationState
  readonly channelEmissions: readonly PrimarySpellChannelEmission[]
  readonly tick: number
  readonly worldKey: string
  readonly sourceRng: NativeRngState
  readonly firstWorldContact: BoneyardSpellWorldContact | null
  readonly registerWorldPainter?: RegisterNativeWorldPainter
  readonly damageMultiplier: BoneyardSpellDamageMultiplier
  readonly primarySceneryTargets: readonly PrimarySpellTarget[]
  readonly lethalObserver?: BoneyardEnemyLethalObserver
  readonly fireActorContacts: readonly NativeFireActorContact[]
  readonly resolveEnemyMovement: ResolveBoneyardSpellEnemyMovement
  readonly steamedPulses: readonly NativeSecondarySteamedPulse[]
  readonly fireballHostileCorridorLength: (ownerId: string) => number
}

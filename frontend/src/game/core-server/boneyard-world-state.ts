import type { BoneyardArenaTransitionState } from '../core-kernels/boneyard-arena-transition.ts'
import type { BoneyardSolomonEncounterState } from '../core-kernels/boneyard-encounter.ts'
import type { BoneyardGateLeafState } from '../core-kernels/boneyard-gate.ts'
import type { BoneyardWaveDirectorState } from '../core-kernels/boneyard-wave-director.ts'
import type { BoneyardBounds, BoneyardPoint } from '../core-kernels/boneyard.ts'
import type { NativeHallOfFameRunState } from '../core-kernels/hall-of-fame-score.ts'
import type { HubEconomyState } from '../core-kernels/hub-economy.ts'
import type {
  NativeEnemyWorldFeedbackKernelState,
} from '../core-kernels/native-enemy-world-feedback.ts'
import type { NativeLootModifiers } from '../core-kernels/native-loot.ts'
import type { NativeSecondarySceneryTarget } from '../core-kernels/native-secondary-abilities.ts'
import type { NativeTutorialState } from '../core-kernels/native-tutorial.ts'
import type { NativeWorldManagerRegistration } from '../core-kernels/native-world-manager-order.ts'
import type { PlayerCharacterState } from '../core-kernels/player-character.ts'
import type { PrimarySpellTarget } from '../core-kernels/primary-spell-targeting.ts'
import type { BoneyardCollisionWorld } from './boneyard-collision.ts'
import type {
  BoneyardLootEvent,
  BoneyardLootPickup,
  BoneyardLootStore,
} from './boneyard-loot-store.ts'
import type {
  BoneyardEnemyPlayerDamage,
  BoneyardEnemyReward,
  BoneyardEnemySemanticEvent,
  BoneyardEnemyStore,
} from './enemies/model.ts'

export interface BoneyardPlayerCombatStatus {
  readonly alive: boolean
  readonly collisionEnabled: boolean
  readonly eligible: boolean
  readonly movementScale: number
  readonly inventoryHasHealthPotion?: boolean
  readonly level?: number
  readonly lootModifiers?: NativeLootModifiers
  readonly ownedRecipeIndexes?: readonly number[]
  readonly advancedUnlocks?: readonly boolean[]
}

export interface BoneyardSummonTarget {
  readonly collisionRadius: number
  readonly id: string
  readonly position: Readonly<BoneyardPoint>
}

export interface BoneyardWorldState {
  arenaTransition: BoneyardArenaTransitionState | null
  bounds: BoneyardBounds
  collision: BoneyardCollisionWorld
  earthquakeSceneryTargets: readonly NativeSecondarySceneryTarget[]
  primarySceneryTargets: readonly PrimarySpellTarget[]
  encounter: BoneyardSolomonEncounterState | null
  enemies: BoneyardEnemyStore
  enemyWorldFeedback: NativeEnemyWorldFeedbackKernelState
  enemyEvents: readonly BoneyardEnemySemanticEvent[]
  gateLeaves: readonly BoneyardGateLeafState[]
  kind: 'boneyard'
  lanternLightRegistration: NativeWorldManagerRegistration | null
  lanternPosition: Readonly<BoneyardPoint> | null
  hallOfFameRuns: Readonly<Record<string, NativeHallOfFameRunState>>
  loot: BoneyardLootStore
  lootEvents: readonly BoneyardLootEvent[]
  playerOuchDeadlineTick: number
  runId: string
  scenerySpellTargets: readonly PrimarySpellTarget[]
  solomonPainterRegistration: NativeWorldManagerRegistration | null
  spawn: { x: number; y: number; facingDeg: number }
  tutorial: NativeTutorialState | null
  tutorialProfileEconomy: HubEconomyState | null
  waves: BoneyardWaveDirectorState | null
}

export interface BoneyardWorldTickResult {
  enemyEvents: readonly BoneyardEnemySemanticEvent[]
  lootEvents: readonly BoneyardLootEvent[]
  lootPickups: readonly BoneyardLootPickup[]
  movementContactsByPlayerId: Readonly<
    Record<string, readonly BoneyardPlayerMovementContact[]>
  >
  movementEpochActiveByPlayerId: Readonly<Record<string, boolean>>
  playerDamage: readonly BoneyardEnemyPlayerDamage[]
  players: Readonly<Record<string, PlayerCharacterState>>
  rewards: readonly BoneyardEnemyReward[]
  world: BoneyardWorldState
}

export interface BoneyardPlayerMovementContact {
  readonly bodyId: string
  readonly staffHostile: boolean
}

export interface BoneyardWorldNavigationPreparation {
  readonly bounds: Readonly<BoneyardBounds>
  readonly clearance: number
}

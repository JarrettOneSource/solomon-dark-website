import {
  PLAYER_CHARACTER_RADIUS,
  type PlayerCharacterInput,
} from '../../core-kernels/player-character.ts'
import {
  gameSimulationPlayerRecords,
  getPlayerSkillBook,
  type GameSimulationState,
} from '../game-simulation.ts'
import {
  createMlBotPolicyEnemyMemory,
  observeMlBotPolicyEnemies,
  type MlBotPolicyEnemyMemory,
  type MlBotPolicyEnemyRow,
} from './enemies.ts'
import { observeMlBotPolicyEnemyExtensions } from './enemy-extensions.ts'
import { observeMlBotPolicyGeometry, type MlBotPolicyGeometryObservation } from './geometry.ts'
import { observeMlBotPolicyHazards } from './hazards.ts'
import {
  observeMlBotPolicyInventory,
  type MlBotPolicyInventoryObservation,
} from './inventory.ts'
import { observeMlBotPolicyMinions, type MlBotPolicyMinionObservation } from './minions.ts'
import { observeMlBotPolicyOwnEffects } from './own-effects.ts'
import {
  observeMlBotPolicyPlayerState,
  type MlBotPolicyPlayerObservation,
} from './player-state.ts'
import {
  ML_BOT_POLICY_BLOCKS,
  ML_BOT_POLICY_OBSERVATION_NAMES,
  type MlBotPolicyBlock,
} from './spec.ts'
import {
  createMlBotPolicyWorldMemory,
  observeMlBotPolicyWorldState,
  type MlBotPolicyCommittedAction,
  type MlBotPolicyWorldMemory,
} from './world-state.ts'

export interface MlBotPolicyObservationContext {
  readonly activeInputs: Readonly<Record<string, PlayerCharacterInput>>
  readonly controllers: Readonly<Record<string, 'bot' | 'human'>>
  readonly hasConsumable?: (contentId: string) => boolean
}

export interface MlBotPolicyObservedBlock {
  readonly key: MlBotPolicyBlock['key']
  readonly values: Float32Array
}

export interface MlBotPolicyFrame {
  readonly blocks: readonly MlBotPolicyObservedBlock[]
  readonly enemyRows: readonly MlBotPolicyEnemyRow[]
  readonly geometry: MlBotPolicyGeometryObservation
  readonly inventory: MlBotPolicyInventoryObservation
  readonly minions: MlBotPolicyMinionObservation
  readonly player: MlBotPolicyPlayerObservation
  readonly targetId: number | null
  readonly values: Float32Array
}

export class MlBotPolicyObserver {
  private enemyMemory: MlBotPolicyEnemyMemory = createMlBotPolicyEnemyMemory()
  private readonly playerId: string
  private previousAction: MlBotPolicyCommittedAction | null = null
  private worldMemory: MlBotPolicyWorldMemory = createMlBotPolicyWorldMemory()

  constructor(playerId: string) {
    if (playerId.length === 0) throw new Error('ML bot policy player id must not be empty')
    this.playerId = playerId
  }

  observe(
    state: GameSimulationState,
    context: MlBotPolicyObservationContext,
  ): MlBotPolicyFrame {
    if (state.world.kind !== 'boneyard') throw new Error('ML bot policy requires a Boneyard world')
    const players = gameSimulationPlayerRecords(state)
    const self = players[this.playerId]
    if (!self) throw new Error(`ML bot policy has no player ${this.playerId}`)
    const skillBook = getPlayerSkillBook(state, this.playerId)
    const minions = observeMlBotPolicyMinions(state.secondaryAbilities, {
      playerId: this.playerId,
      position: self.position,
      quickbar: skillBook.skillQuickbar,
      worldKey: state.world.runId,
    })
    const ownEffects = observeMlBotPolicyOwnEffects(state, {
      playerId: this.playerId,
      position: self.position,
      quickbar: skillBook.skillQuickbar,
      worldKey: state.world.runId,
    })
    const player = observeMlBotPolicyPlayerState(state, this.playerId, {
      primaryEffectActive: ownEffects.primaryEffectActive,
      secondaryEffectActive: ownEffects.secondaryEffectActive.map((active, slot) => (
        active || (minions.secondaryMinionActive[slot] ?? false)
      )),
    })
    const enemies = observeMlBotPolicyEnemies(state.world, {
      memory: this.enemyMemory,
      ownMinionTargetIds: minions.ownTargetIds,
      primaryRange: player.primaryRange,
      selfPosition: self.position,
      tick: state.tick,
    })
    const enemyExtensions = observeMlBotPolicyEnemyExtensions(enemies.rows, {
      secondaryAbilities: state.secondaryAbilities,
      selfPlayerId: this.playerId,
      tick: state.tick,
      worldKey: state.world.runId,
    })
    const geometry = observeMlBotPolicyGeometry(state.world, self.position)
    const hazards = observeMlBotPolicyHazards(state.world, {
      playerId: this.playerId,
      position: self.position,
      radius: PLAYER_CHARACTER_RADIUS,
    })
    const inventory = observeMlBotPolicyInventory(state, this.playerId, {
      hasConsumable: context.hasConsumable,
    })
    const targetId = enemies.next.memory.targetId
    const world = observeMlBotPolicyWorldState(state, this.playerId, enemies.rows, {
      activeInputs: context.activeInputs,
      controllers: context.controllers,
      memory: this.worldMemory,
      previousAction: this.previousAction,
      targetId,
    })
    const byKey = new Map<MlBotPolicyBlock['key'], Float32Array>([
      ['A', player.blockA],
      ['B', player.blockB],
      ['C', player.blockC],
      ['D', enemies.blockD],
      ['E', enemies.blockE],
      ['F', geometry.patchAndRays],
      ['G', world.blockG],
      ['I', world.blockI],
      ['H', world.blockH],
      ['J', world.blockJ],
      ['K', enemyExtensions],
      ['L', enemies.blockL],
      ['M', geometry.obstacles],
      ['N', hazards],
      ['O', inventory.blockO],
      ['P', inventory.blockP],
      ['Q', inventory.blockQ],
      ['R', ownEffects.blockR],
      ['S', minions.blockS],
    ])
    const blocks = ML_BOT_POLICY_BLOCKS.map(({ key, names }) => {
      const values = byKey.get(key)
      if (!values || values.length !== names.length) {
        throw new Error(`ML bot policy Block ${key} does not match schema v5`)
      }
      return Object.freeze({ key, values })
    })
    const values = new Float32Array(ML_BOT_POLICY_OBSERVATION_NAMES.length)
    for (const block of ML_BOT_POLICY_BLOCKS) values.set(byKey.get(block.key)!, block.start)
    for (let index = 0; index < values.length; index += 1) {
      if (!Number.isFinite(values[index])) {
        throw new Error(`ML bot policy observation ${ML_BOT_POLICY_OBSERVATION_NAMES[index]} is not finite`)
      }
    }
    this.enemyMemory = enemies.next.memory
    this.worldMemory = world.nextMemory
    this.previousAction = null
    return {
      blocks: Object.freeze(blocks),
      enemyRows: enemies.rows,
      geometry,
      inventory,
      minions,
      player,
      targetId,
      values,
    }
  }

  commit(action: MlBotPolicyCommittedAction, targetId: number | null): void {
    this.previousAction = action
    this.enemyMemory = { ...this.enemyMemory, targetId }
  }

  reset(): void {
    this.enemyMemory = createMlBotPolicyEnemyMemory()
    this.previousAction = null
    this.worldMemory = createMlBotPolicyWorldMemory()
  }
}

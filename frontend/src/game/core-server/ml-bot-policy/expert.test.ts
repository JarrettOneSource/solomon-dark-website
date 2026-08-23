import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../../core-kernels/boneyard.ts'
import {
  createGameSimulation,
  enterBoneyardWorld,
  type GameSimulationState,
} from '../game-simulation.ts'
import type { BoneyardEnemyActor } from '../boneyard-enemy-store.ts'
import {
  damagePlayerEntity,
  playerEconomyAt,
  replacePlayerEconomy,
} from '../player-entity-store.ts'
import { MlBotPolicyObserver } from './observer.ts'
import { selectMlBotPolicyExpertAction } from './expert.ts'

const BONEYARD: LoadedBoneyard = {
  choice: { id: 'headless', name: 'Headless', source: 'mod', modId: 'tests', modName: 'Tests' },
  geometrySha256: 'geometry',
  runId: 'run',
  scene: {
    bounds: { h: 1_000, w: 1_000, x: 0, y: 0 },
    environmentMode: 0,
    fences: [],
    name: 'Headless',
    objects: [],
    roads: [],
    solomonDig: null,
    spawn: { facingDeg: 180, x: 500, y: 500 },
    sprites: [],
    terrain: [],
  },
  seed: '12345678',
  sourceSha256: 'source',
}

test('semantic expert selects a target before choosing a target-conditioned cast', () => {
  const base = enterBoneyardWorld(createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'ether' },
  }), BONEYARD)
  const actor = {
    brain: { family: 'skeleton', phase: 'approach' },
    config: {
      attackSpeed: 1,
      collisionRadius: 20,
      enemyToken: 'SKELETON',
      family: { armor: false, headgear: 0, weapon: 'sword' },
      maximumHealth: 100,
    },
    currentHealth: 50,
    headingDeg: 0,
    id: 7,
    lifeState: 'alive',
    position: { x: 700, y: 500 },
    shieldHealth: 0,
    shieldMaximumHealth: 0,
    staffActionFactor: 1,
    targetPlayerId: 'agent',
  } as BoneyardEnemyActor
  const state = {
    ...base,
    world: { ...base.world, enemies: { ...base.world.enemies, actors: [actor] } },
  } as GameSimulationState
  const observer = new MlBotPolicyObserver('agent')
  const frame = observer.observe(state, { activeInputs: {}, controllers: { agent: 'bot' } })
  const action = selectMlBotPolicyExpertAction(state, 'agent', frame)
  assert.equal(action.target, 1)
  assert.equal(action.ability, 2)
  assert.equal(action.aim, 0)
  assert.equal(action.movement, 1)
})

test('semantic expert emits no skill-choice label', () => {
  const state = enterBoneyardWorld(createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  }), BONEYARD)
  const frame = new MlBotPolicyObserver('agent').observe(state, {
    activeInputs: {},
    controllers: { agent: 'bot' },
  })
  const action = selectMlBotPolicyExpertAction(state, 'agent', frame)
  assert.deepEqual(Object.keys(action).sort(), ['ability', 'aim', 'movement', 'target'])
  assert.equal(action.ability, 0)
})

test('semantic expert emits only null actions under the global input gate', () => {
  const state = enterBoneyardWorld(createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  }), BONEYARD)
  const frame = new MlBotPolicyObserver('agent').observe(state, {
    activeInputs: {},
    controllers: { agent: 'bot' },
  })
  frame.player.blockA[23] = 1
  assert.deepEqual(selectMlBotPolicyExpertAction(state, 'agent', frame), {
    ability: 0,
    aim: 0,
    movement: 0,
    target: 0,
  })
})

test('semantic expert consumes a recursively owned health potion when critically injured', () => {
  const base = enterBoneyardWorld(createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  }), BONEYARD)
  const economy = playerEconomyAt(base.playerEntities, 'agent')!
  const nestedPotion = {
    equipmentType: null,
    iconRecords: [46],
    id: 90_001,
    kind: 'health-potion' as const,
    name: 'Health Potion',
    nativeSubtype: 0,
    nativeTypeId: 7001,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  const state = {
    ...base,
    playerEntities: damagePlayerEntity(replacePlayerEconomy(base.playerEntities, 'agent', {
      ...economy,
      backpack: [{
        contents: [nestedPotion],
        equipmentType: null,
        iconRecords: [70],
        id: 90_000,
        kind: 'sack',
        name: 'Sack',
        nativeSubtype: 0,
        nativeTypeId: 7008,
        quantity: 1,
        rarity: null,
        recipeIndex: null,
      }],
    }), 'agent', 45, 0),
  }
  const frame = new MlBotPolicyObserver('agent').observe(state, {
    activeInputs: {},
    controllers: { agent: 'bot' },
  })
  assert.equal(frame.inventory.potions[0]?.itemId, nestedPotion.id)
  assert.equal(selectMlBotPolicyExpertAction(state, 'agent', frame).ability, 10)
})

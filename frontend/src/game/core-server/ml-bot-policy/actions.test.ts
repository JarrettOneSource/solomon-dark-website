import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../../core-kernels/boneyard.ts'
import {
  createGameSimulation,
  enterBoneyardWorld,
  grantGameSimulationPlayerExperience,
} from '../game-simulation.ts'
import {
  damagePlayerEntity,
  playerEconomyAt,
  replacePlayerEconomy,
} from '../player-entity-store.ts'
import { resolveMlBotPolicyDecision } from './actions.ts'
import { MlBotPolicyObserver } from './observer.ts'

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

test('four-head decision emits one legal player input with target-conditioned masks', () => {
  const state = enterBoneyardWorld(createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  }), BONEYARD)
  const frame = new MlBotPolicyObserver('agent').observe(state, {
    activeInputs: {},
    controllers: { agent: 'bot' },
  })
  const decision = resolveMlBotPolicyDecision(state, 'agent', frame, {
    ability: 1,
    aim: 1,
    movement: 1,
    target: 0,
  })
  assert.deepEqual(decision.masks.movement, new Uint8Array(9).fill(1))
  assert.equal(decision.masks.target[0], 1)
  assert.equal(decision.masks.ability[1], 1)
  assert.equal(decision.masks.aim[1], 1)
  assert.deepEqual(decision.input.movement, { x: 1, y: 0 })
  assert.equal(decision.input.cast.primary, true)
  assert.equal(decision.input.cast.quickbar, null)
  assert.equal(decision.hubAction, null)
  assert.equal(decision.targetId, null)
  assert.ok(decision.input.aim!.x > 500)
})

test('non-free primary is illegal without a target', () => {
  const state = enterBoneyardWorld(createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'ether' },
  }), BONEYARD)
  const frame = new MlBotPolicyObserver('agent').observe(state, {
    activeInputs: {},
    controllers: { agent: 'bot' },
  })
  assert.throws(() => resolveMlBotPolicyDecision(state, 'agent', frame, {
    ability: 1,
    aim: 0,
    movement: 0,
    target: 0,
  }), /illegal ability action/)
})

test('potion ability emits the hub action and idles same-tick movement and casting', () => {
  let state = enterBoneyardWorld(createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  }), BONEYARD)
  const economy = playerEconomyAt(state.playerEntities, 'agent')!
  state = {
    ...state,
    playerEntities: damagePlayerEntity(replacePlayerEconomy(state.playerEntities, 'agent', {
      ...economy,
      backpack: [{
        equipmentType: null,
        iconRecords: [46],
        id: 99,
        kind: 'health-potion',
        name: 'Health Potion',
        nativeSubtype: 0,
        nativeTypeId: 7001,
        quantity: 1,
        rarity: null,
        recipeIndex: null,
      }],
    }), 'agent', 10, 0),
  }
  const frame = new MlBotPolicyObserver('agent').observe(state, {
    activeInputs: {},
    controllers: { agent: 'bot' },
  })
  const decision = resolveMlBotPolicyDecision(state, 'agent', frame, {
    ability: 10,
    aim: 0,
    movement: 1,
    target: 0,
  })
  assert.deepEqual(decision.hubAction, { itemId: 99, type: 'consume' })
  assert.deepEqual(decision.input.movement, { x: 0, y: 0 })
  assert.deepEqual(decision.input.cast, { primary: false, quickbar: null })
})

test('level-up and Solomon locks force every head to its null-only mask', () => {
  const active = enterBoneyardWorld(createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  }), BONEYARD)
  const levelUp = grantGameSimulationPlayerExperience(active, 'agent', 100)
  const levelFrame = new MlBotPolicyObserver('agent').observe(levelUp, {
    activeInputs: {},
    controllers: { agent: 'bot' },
  })
  const levelDecision = resolveMlBotPolicyDecision(levelUp, 'agent', levelFrame, {
    ability: 0,
    aim: 0,
    movement: 0,
    target: 0,
  })
  assert.deepEqual(Object.values(levelDecision.masks).map((mask) => (
    [...mask].reduce((sum, value) => sum + value, 0)
  )), [1, 1, 1, 1])
  assert.throws(() => resolveMlBotPolicyDecision(levelUp, 'agent', levelFrame, {
    ability: 0,
    aim: 0,
    movement: 1,
    target: 0,
  }), /illegal movement action/)

  const solomon = {
    ...active,
    world: {
      ...active.world,
      encounter: { phase: 'speaking', targetPlayerId: 'agent' },
    },
  } as typeof active
  const solomonFrame = new MlBotPolicyObserver('agent').observe(solomon, {
    activeInputs: {},
    controllers: { agent: 'bot' },
  })
  const solomonDecision = resolveMlBotPolicyDecision(solomon, 'agent', solomonFrame, {
    ability: 0,
    aim: 0,
    movement: 0,
    target: 0,
  })
  assert.deepEqual(Object.values(solomonDecision.masks).map((mask) => (
    [...mask].reduce((sum, value) => sum + value, 0)
  )), [1, 1, 1, 1])
})

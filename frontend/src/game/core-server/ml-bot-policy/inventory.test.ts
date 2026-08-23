import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyGameSimulationHubAction,
  createGameSimulation,
  getPlayerProgression,
} from '../game-simulation.ts'
import {
  damagePlayerEntity,
  playerEconomyAt,
  replacePlayerEconomy,
} from '../player-entity-store.ts'
import { observeMlBotPolicyInventory } from './inventory.ts'

test('inventory observation ranks potions and exposes exact state-changing legality', () => {
  let state = createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  })
  const economy = playerEconomyAt(state.playerEntities, 'agent')!
  state = {
    ...state,
    playerEntities: damagePlayerEntity(replacePlayerEconomy(state.playerEntities, 'agent', {
      ...economy,
      backpack: [{
        contents: [{
          equipmentType: null,
          iconRecords: [46],
          id: 99,
          kind: 'health-potion',
          name: 'Health Potion',
          nativeSubtype: 0,
          nativeTypeId: 7001,
          quantity: 2,
          rarity: null,
          recipeIndex: null,
        }],
        equipmentType: null,
        iconRecords: [70],
        id: 98,
        kind: 'sack',
        name: 'Sack',
        nativeSubtype: 0,
        nativeTypeId: 7008,
        quantity: 1,
        rarity: null,
        recipeIndex: null,
      }],
    }), 'agent', 10, 0),
  }
  const observed = observeMlBotPolicyInventory(state, 'agent')
  assert.equal(observed.blockO.length, 12 * 19 + 2)
  assert.equal(observed.blockP.length, 7 * 15)
  assert.equal(observed.blockQ.length, 9)
  assert.equal(observed.blockO[0], 1)
  assert.equal(observed.blockO[2], 1)
  assert.equal(observed.potions[0]?.legal, true)
  assert.equal(observed.potions[0]?.itemId, 99)
  const count = Math.log(3) / Math.log(100)
  const totalCount = Math.log(4) / Math.log(100)
  assert.ok(Math.abs(observed.blockO[1]! - count) < 1e-6)
  assert.ok(Math.abs(observed.blockQ[0]! - totalCount) < 1e-6)
  assert.ok(Math.abs(observed.blockQ[1]! - count) < 1e-6)
})

test('web potion legality enables participant-scoped chugs and antidote through the real consume path', () => {
  let state = createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  })
  const economy = playerEconomyAt(state.playerEntities, 'agent')!
  const kinds = [
    ['health-potion', 0],
    ['mana-potion', 1],
    ['wizard-chug', 2],
    ['antidote', 3],
    ['mind-chug', 4],
    ['rejuvenation-potion', 5],
  ] as const
  state = {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'agent', {
      ...economy,
      backpack: kinds.map(([kind, nativeSubtype], index) => ({
        equipmentType: null,
        iconRecords: [],
        id: 100 + index,
        kind,
        name: kind,
        nativeSubtype,
        nativeTypeId: 7001,
        quantity: 1,
        rarity: null,
        recipeIndex: null,
      })),
    }),
  }
  const observed = observeMlBotPolicyInventory(state, 'agent')
  const legality = new Map(observed.potions.map(({ itemId, legal }) => [itemId, legal]))
  assert.deepEqual(kinds.map((_, index) => legality.get(100 + index)), [
    false, false, true, true, true, false,
  ])
  const consumed = applyGameSimulationHubAction(state, 'agent', { type: 'consume', itemId: 102 })
  assert.equal(consumed.accepted, true)
  assert.equal(getPlayerProgression(consumed.state, 'agent').damageX4TicksRemaining, 6_000)
})

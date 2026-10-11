import assert from 'node:assert/strict'
import test from 'node:test'
import { createGameSimulation } from '../game-simulation.ts'
import { createMlBotPolicyWorldMemory, observeMlBotPolicyWorldState } from './world-state.ts'

test('mixed Create roots retain the finite 43-feature ML shape without inventing discipline flags', () => {
  for (const discipline of ['ether', 'fire', 'air', 'water', 'earth', 'body', 'mind', 'arcane'] as const) {
    const state = createGameSimulation({
      self: { displayName: 'Self', element: 'fire', discipline },
      ally: { displayName: 'Ally', element: 'water', discipline: 'earth' },
    })
    const result = observeMlBotPolicyWorldState(state, 'self', [], {
      activeInputs: {}, controllers: { self: 'bot', ally: 'human' },
      memory: createMlBotPolicyWorldMemory(), previousAction: null, targetId: null,
    })
    assert.equal(result.blockH.length, 43)
    assert.equal(Object.keys(result.blockH).length, 43, 'no undefined-index property')
    for (const block of [result.blockG, result.blockH, result.blockI, result.blockJ]) {
      assert.ok([...block].every(Number.isFinite))
    }
    assert.deepEqual([...result.blockH.slice(16, 21)], [1, 0, 0, 0, 0])
    assert.deepEqual([...result.blockH.slice(21, 24)], [
      Number(discipline === 'mind'), Number(discipline === 'body'), Number(discipline === 'arcane'),
    ])
  }
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addPlayerCharacter,
  createGameSimulation,
  removePlayerCharacter,
  stepGameSimulation,
  stepGameSimulationTick,
} from './game-simulation.ts'

test('game simulation owns player characters outside the active world', () => {
  const firstConfig = {
    discipline: 'arcane',
    displayName: 'Helvidius',
    element: 'ether',
  } as const
  const secondConfig = {
    discipline: 'mind',
    displayName: 'Vibia',
    element: 'water',
  } as const
  let state = createGameSimulation({ first: firstConfig })
  assert.equal(state.accumulatorSeconds, 0)
  assert.equal(state.world.kind, 'hub')
  assert.equal('players' in state.world, false)

  state = addPlayerCharacter(state, 'second', secondConfig)
  state = stepGameSimulationTick(state, {
    first: { movement: { x: 1, y: 0 } },
    second: { movement: { x: 0, y: 1 } },
  })
  assert.equal(state.tick, 1)
  assert.equal(state.accumulatorSeconds, 0)
  assert.deepEqual(state.players.first.config, firstConfig)
  assert.deepEqual(state.players.second.config, secondConfig)
  assert.ok(state.players.first.position.x > state.players.second.position.x)
  assert.ok(state.players.second.position.y > state.players.first.position.y)

  state = removePlayerCharacter(state, 'first')
  assert.equal(state.players.first, undefined)
  assert.deepEqual(state.players.second.config, secondConfig)
})

test('game simulation owns fixed-step accumulation independently of its world', () => {
  let state = createGameSimulation()
  state = stepGameSimulation(state, {}, 0.005)
  assert.equal(state.tick, 0)
  assert.equal(state.accumulatorSeconds, 0.005)
  state = stepGameSimulation(state, {}, 0.005)
  assert.equal(state.tick, 1)
  assert.equal(state.accumulatorSeconds, 0)
})

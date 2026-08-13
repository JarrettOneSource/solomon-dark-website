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
  assert.deepEqual(Object.keys(state.world.participants), ['first'])

  state = addPlayerCharacter(state, 'second', secondConfig)
  state = stepGameSimulationTick(state, {
    first: { movement: { x: 1, y: 0 } },
    second: { movement: { x: 0, y: 1 } },
  })
  assert.equal(state.tick, 1)
  assert.equal(state.accumulatorSeconds, 0)
  if (state.world.kind !== 'hub') throw new Error('expected Hub world')
  assert.deepEqual(state.players.first.config, firstConfig)
  assert.deepEqual(state.players.second.config, secondConfig)
  assert.deepEqual(Object.keys(state.world.participants).sort(), ['first', 'second'])
  assert.ok(state.players.first.position.x > state.players.second.position.x)
  assert.ok(state.players.second.position.y > state.players.first.position.y)

  state = removePlayerCharacter(state, 'first')
  if (state.world.kind !== 'hub') throw new Error('expected Hub world')
  assert.equal(state.players.first, undefined)
  assert.deepEqual(state.players.second.config, secondConfig)
  assert.deepEqual(Object.keys(state.world.participants), ['second'])
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

test('the authoritative tick latches footsteps only while native movement is active', () => {
  let state = createGameSimulation()
  for (let tick = 1; tick <= 100; tick += 1) {
    state = stepGameSimulationTick(state, {
      'local-player': { movement: { x: 1, y: 0 } },
    })
    if (tick % 25 === 0) {
      assert.equal(state.players['local-player'].footstepTick, tick)
    }
  }

  for (let tick = 101; tick <= 200; tick += 1) {
    state = stepGameSimulationTick(state, {
      'local-player': { movement: { x: 0, y: 0 } },
    })
  }

  assert.equal(state.players['local-player'].footstepTick, 100)
})

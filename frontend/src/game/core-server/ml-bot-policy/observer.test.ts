import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../../core-kernels/boneyard.ts'
import { createGameSimulation, enterBoneyardWorld } from '../game-simulation.ts'
import { MlBotPolicyObserver } from './observer.ts'
import { ML_BOT_POLICY_BLOCKS } from './spec.ts'

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

test('stateful observer assembles the exact finite schema-v7 vector', () => {
  const state = enterBoneyardWorld(createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  }), BONEYARD)
  const observer = new MlBotPolicyObserver('agent')
  const frame = observer.observe(state, {
    activeInputs: {},
    controllers: { agent: 'bot' },
  })
  assert.equal(frame.values.length, 3_026)
  assert.ok(frame.values.every(Number.isFinite))
  assert.deepEqual(frame.blocks.map(({ key, values }) => [key, values.length]),
    ML_BOT_POLICY_BLOCKS.map(({ key, names }) => [key, names.length]))
  assert.equal(frame.enemyRows.length, 0)
  assert.equal(frame.values[0], 1)
})

test('observer reset clears history and target state', () => {
  const state = enterBoneyardWorld(createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  }), BONEYARD)
  const observer = new MlBotPolicyObserver('agent')
  const initial = observer.observe(state, { activeInputs: {}, controllers: { agent: 'bot' } })
  observer.commit({
    abilityAction: 0,
    movement: { x: 1, y: 0 },
    targetAction: 0,
    targetSwitched: false,
  }, null)
  observer.observe(state, { activeInputs: {}, controllers: { agent: 'bot' } })
  observer.reset()
  assert.deepEqual(observer.observe(state, {
    activeInputs: {},
    controllers: { agent: 'bot' },
  }).values, initial.values)
})

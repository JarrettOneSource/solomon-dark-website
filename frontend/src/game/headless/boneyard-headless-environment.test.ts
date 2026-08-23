import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BONEYARD_HEADLESS_ACTION_STRIDE,
  BoneyardHeadlessEnvironment,
  createBoneyardHeadlessActionBuffer,
} from './boneyard-headless-environment.ts'

const RESET = { seed: 0x1234_5678 }

test('Boneyard headless reset reproduces schema-v5 observations and authoritative hashes', () => {
  const environment = new BoneyardHeadlessEnvironment(RESET)
  const initialObservation = environment.observe()
  const initialHash = environment.stateHash()
  assert.equal(initialObservation.length, 1_784)
  assert.equal(initialObservation[25], 1)
  assert.equal(environment.state().world.kind, 'boneyard')
  if (environment.state().world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.notEqual(environment.state().world.waves?.phase, 'dormant')
  const actions = createBoneyardHeadlessActionBuffer()
  actions[2] = 1
  actions[3] = 1
  environment.step(actions, 10)
  assert.notEqual(environment.stateHash(), initialHash)
  assert.deepEqual(environment.reset(RESET), initialObservation)
  assert.equal(environment.stateHash(), initialHash)
})

test('Boneyard headless action buffers use four selected categorical heads per world', () => {
  const actions = createBoneyardHeadlessActionBuffer(3)
  assert.equal(BONEYARD_HEADLESS_ACTION_STRIDE, 4)
  assert.equal(actions.length, 12)
  assert.deepEqual([...actions], new Array(12).fill(0))
  assert.throws(() => createBoneyardHeadlessActionBuffer(0), /positive integer/)
})

test('Boneyard headless transition aligns the current observation, masks, action, reward, and next state', () => {
  const environment = new BoneyardHeadlessEnvironment(RESET)
  const before = environment.observe()
  const actions = createBoneyardHeadlessActionBuffer()
  const transition = environment.stepTransition(actions, 1)
  assert.deepEqual(transition.observation, before)
  assert.deepEqual(transition.actions, { ability: 0, aim: 0, movement: 0, target: 0 })
  assert.equal(transition.reward.reward, 0)
  assert.equal(transition.done, false)
  assert.equal(transition.simulationTick + 1, transition.nextSimulationTick)
  assert.equal(transition.masks.movement[0], 1)
  assert.equal(transition.masks.ability[0], 1)
  assert.deepEqual(transition.nextObservation, environment.observe())
  assert.deepEqual(environment.lastTransition(), transition)
})

test('Boneyard headless episode starts the real wave director with combat enabled', () => {
  const environment = new BoneyardHeadlessEnvironment(RESET)
  assert.equal(environment.state().world.kind, 'boneyard')
  if (environment.state().world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(environment.state().world.encounter?.runEventId, 1)
  let sawEnemy = false
  for (let decision = 0; decision < 500; decision += 1) {
    const action = environment.expertAction()
    const actions = Float32Array.from([
      action.movement,
      action.target,
      action.ability,
      action.aim,
    ])
    environment.step(actions, 10)
    if (
      environment.state().world.kind === 'boneyard'
      && environment.state().world.enemies.actors.some(({ lifeState }) => lifeState === 'alive')
    ) {
      sawEnemy = true
      break
    }
  }
  assert.equal(sawEnemy, true)
  assert.ok(environment.expertAction().target > 0)
})

test('Boneyard headless reset rejects seeds outside uint32', () => {
  assert.throws(() => new BoneyardHeadlessEnvironment({ seed: -1 }), /uint32/)
  assert.throws(() => new BoneyardHeadlessEnvironment({ seed: 0x1_0000_0000 }), /uint32/)
})

test('Boneyard action repeat stops on the first terminal simulation tick', () => {
  const environment = new BoneyardHeadlessEnvironment(RESET)
  const actions = createBoneyardHeadlessActionBuffer()
  const transition = environment.stepTransition(actions, 100_000)
  assert.equal(transition.done, true)
  assert.ok(transition.ticks > 0 && transition.ticks < 100_000)
  assert.equal(transition.nextSimulationTick - transition.simulationTick, transition.ticks)
  assert.equal(environment.state().world.kind, 'boneyard')
  const repeated = environment.stepTransition(actions, 10)
  assert.equal(repeated.done, true)
  assert.equal(repeated.ticks, 0)
  assert.equal(repeated.reward.reward, 0)
  assert.equal(repeated.nextStateHash, transition.nextStateHash)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { PLAYER_CHARACTER_RADIUS } from '../core-kernels/player-character.ts'
import {
  canPlaceBoneyardBody,
  withBoneyardGateCollision,
} from '../core-server/boneyard-collision.ts'
import {
  gameSimulationPlayerRecords,
  getPlayerSkillBook,
} from '../core-server/game-simulation.ts'
import { ML_BOT_PRIMARY_CURRICULUM } from '../core-server/ml-bot-policy/primary-curriculum.ts'
import {
  BONEYARD_HEADLESS_ACTION_STRIDE,
  BoneyardHeadlessEnvironment,
  createBoneyardHeadlessActionBuffer,
} from './boneyard-headless-environment.ts'

const RESET = { seed: 0x1234_5678 }

test('Boneyard headless reset reproduces schema-v7 observations and authoritative hashes', () => {
  const environment = new BoneyardHeadlessEnvironment(RESET)
  const initialObservation = environment.observe()
  const initialHash = environment.stateHash()
  assert.equal(initialObservation.length, 3_026)
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

test('headless wave staging places every participant inside the sealed combat arena', () => {
  const seeds = [...Array.from({ length: 12 }, (_, seed) => seed), 1_592_594_436]
  for (const seed of seeds) {
    const environment = new BoneyardHeadlessEnvironment({ seed })
    const state = environment.state()
    assert.equal(state.world.kind, 'boneyard')
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    const transition = state.world.arenaTransition
    assert.ok(transition)
    assert.notEqual(transition.phase, 'open')
    const collision = withBoneyardGateCollision(state.world.collision, state.world.gateLeaves)
    for (const player of Object.values(gameSimulationPlayerRecords(state))) {
      assert.equal(canPlaceBoneyardBody(
        player.position,
        transition.combatBounds,
        collision,
        PLAYER_CHARACTER_RADIUS,
      ), true)
    }
  }
})

test('Boneyard headless reset rejects seeds outside uint32', () => {
  assert.throws(() => new BoneyardHeadlessEnvironment({ seed: -1 }), /uint32/)
  assert.throws(() => new BoneyardHeadlessEnvironment({ seed: 0x1_0000_0000 }), /uint32/)
})

test('Boneyard headless materializes every pure and welded primary curriculum member', () => {
  for (const [index, primary] of ML_BOT_PRIMARY_CURRICULUM.entries()) {
    const environment = new BoneyardHeadlessEnvironment({
      primaryLoadoutKey: primary.key,
      seed: 0x5000_0000 + index,
    })
    const skillBook = getPlayerSkillBook(environment.state(), 'agent')
    assert.equal(skillBook.primarySkillId, primary.primarySkillId, primary.key)
    assert.equal(skillBook.weldBuildId, primary.weldBuildId, primary.key)
    assert.deepEqual(environment.episodeMetadata(), {
      continuousPrimaryCast: primary.castMode === 'continuous',
      geometrySha256: environment.episodeMetadata().geometrySha256,
      primaryLoadoutKey: primary.key,
      primarySkillId: primary.primarySkillId,
      runId: `headless-${(0x5000_0000 + index).toString(16)}`,
      seed: 0x5000_0000 + index,
      weldBuildId: primary.weldBuildId,
    })
  }
})

test('native expert holds every continuous primary across policy decisions', () => {
  for (const [index, primary] of ML_BOT_PRIMARY_CURRICULUM.entries()) {
    if (primary.castMode !== 'continuous') continue
    const environment = new BoneyardHeadlessEnvironment({
      primaryLoadoutKey: primary.key,
      seed: 0x5100_0000 + index,
    })
    let consecutivePrimaryDecisions = 0
    let maximumConsecutivePrimaryDecisions = 0
    for (let decision = 0; decision < 800 && maximumConsecutivePrimaryDecisions < 2; decision += 1) {
      const action = environment.expertAction()
      consecutivePrimaryDecisions = action.ability === 1
        ? consecutivePrimaryDecisions + 1
        : 0
      maximumConsecutivePrimaryDecisions = Math.max(
        maximumConsecutivePrimaryDecisions,
        consecutivePrimaryDecisions,
      )
      environment.step(Float32Array.from([
        action.movement,
        action.target,
        action.ability,
        action.aim,
      ]), 10)
    }
    assert.ok(maximumConsecutivePrimaryDecisions >= 2, primary.key)
  }
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

test('learned skill choices are externally selected and open trainable SMDP credit', () => {
  const environment = new BoneyardHeadlessEnvironment({
    ...RESET,
    choiceMode: 'learned',
  })
  let choice = environment.choicePlan()
  for (let decision = 0; choice === null && decision < 2_000; decision += 1) {
    const action = environment.expertAction()
    environment.step(Float32Array.from([
      action.movement,
      action.target,
      action.ability,
      action.aim,
    ]), 10)
    choice = environment.choicePlan()
  }
  assert.ok(choice)
  const stateHash = environment.stateHash()
  const selection = environment.selectLearnedChoice({
    oldLogProbability: -0.25,
    oldValue: 0.5,
    selectedOption: 0,
  })
  assert.notEqual(environment.stateHash(), stateHash)
  assert.equal(selection.choiceIndex, 0)
  assert.equal(environment.choicePlan(), null)

  const nextAction = environment.expertAction()
  const transition = environment.stepTransition(Float32Array.from([
    nextAction.movement,
    nextAction.target,
    nextAction.ability,
    nextAction.aim,
  ]), 10)
  assert.equal(transition.choiceEvents.length, 1)
  assert.equal(transition.choiceEvents[0]?.choiceMode, 'learned')
  assert.equal(transition.choiceEvents[0]?.trainable, true)
  assert.equal(transition.choiceEvents[0]?.oldLogProbability, -0.25)
  assert.equal(transition.choiceEvents[0]?.oldValue, 0.5)
  assert.equal(transition.reward.gameplay.skillPicks, 1)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { MlBotPolicyChoiceTrajectoryTracker } from './choice-trajectory.ts'

test('choice tracker emits only complete variable-duration intervals', () => {
  const tracker = new MlBotPolicyChoiceTrajectoryTracker('episode-1', 'agent')
  tracker.open({
    accepted: true,
    choiceMode: 'scripted',
    generation: 1,
    observation: new Float32Array(2_738),
    oldLogProbability: 0,
    oldValue: 0,
    optionDescriptors: new Float32Array(3 * 106),
    optionIds: [1, 2, 3],
    optionMask: Uint8Array.from([1, 1, 1]),
    selectedOption: 1,
    simulationTick: 10,
    trainable: false,
  })
  tracker.accumulate(0.2, 10)
  tracker.accumulate(0.1, 10)
  assert.deepEqual(tracker.drain(), [])
  tracker.open({
    accepted: true,
    choiceMode: 'scripted',
    generation: 2,
    observation: new Float32Array(2_738),
    oldLogProbability: 0,
    oldValue: 0.25,
    optionDescriptors: new Float32Array(2 * 106),
    optionIds: [4, 5],
    optionMask: Uint8Array.from([1, 1]),
    selectedOption: 0,
    simulationTick: 30,
    trainable: false,
  })
  const [closed] = tracker.drain()
  assert.ok(closed)
  assert.equal(closed.choiceTrajectoryVersion, 6)
  assert.equal(closed.durationTicks, 20)
  assert.deepEqual(closed.rewards, [0.2, 0.1])
  assert.equal(closed.nextValue, 0.25)
  assert.equal(closed.done, false)
  assert.equal(closed.trainable, false)
})

test('terminal close flushes the final interval exactly once', () => {
  const tracker = new MlBotPolicyChoiceTrajectoryTracker('episode-2', 'agent')
  tracker.open({
    accepted: true,
    choiceMode: 'learned',
    generation: 1,
    observation: new Float32Array(2_738),
    oldLogProbability: -1,
    oldValue: 0.5,
    optionDescriptors: new Float32Array(106),
    optionIds: [52],
    optionMask: Uint8Array.from([1]),
    selectedOption: 0,
    simulationTick: 1,
    trainable: true,
  })
  tracker.accumulate(-2, 4)
  tracker.finish(true)
  const [closed] = tracker.drain()
  assert.equal(closed?.done, true)
  assert.equal(closed?.nextValue, 0)
  assert.equal(closed?.durationTicks, 4)
  assert.deepEqual(tracker.drain(), [])
})

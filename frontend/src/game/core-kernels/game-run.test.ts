import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BONEYARD_GAME_OVER_INPUT_GATE_TICKS,
  acknowledgeGameOver,
  confirmPostRunLoadout,
  createGameRunLifecycle,
  gameOverAcceptsInput,
  startGameRun,
  stepGameRunLifecycle,
  synchronizeGameRunParticipants,
} from './game-run.ts'

test('one dead participant spectates while another eligible participant lives', () => {
  const run = startGameRun(createGameRunLifecycle(), 'run-a', ['b', 'a'])
  assert.deepEqual(run.eligiblePlayerIds, ['a', 'b'])
  assert.equal(stepGameRunLifecycle(run, new Set(['b'])).phase, 'active')
})

test('all eligible participants dead emits one run-scoped terminal event', () => {
  const run = startGameRun(createGameRunLifecycle(), 'run-a', ['a', 'b'])
  const terminal = stepGameRunLifecycle(run, new Set())
  assert.equal(terminal.phase, 'game-over')
  assert.equal(terminal.gameOverEventId, 1)
  const later = stepGameRunLifecycle(terminal, new Set())
  assert.equal(later.gameOverEventId, 1)
  assert.equal(later.gameOverTicks, 1)
})

test('Boneyard Game Over rejects input before tick 1000 and returns to loadout once', () => {
  let state = stepGameRunLifecycle(
    startGameRun(createGameRunLifecycle(), 'run-a', ['a']),
    new Set(),
  )
  for (let tick = 0; tick < BONEYARD_GAME_OVER_INPUT_GATE_TICKS; tick += 1) {
    assert.equal(gameOverAcceptsInput(state), tick === BONEYARD_GAME_OVER_INPUT_GATE_TICKS)
    if (tick < BONEYARD_GAME_OVER_INPUT_GATE_TICKS) {
      assert.equal(acknowledgeGameOver(state, 'run-a', 1), null)
    }
    state = stepGameRunLifecycle(state, new Set())
  }
  assert.equal(gameOverAcceptsInput(state), true)
  const loadout = acknowledgeGameOver(state, 'run-a', 1)
  assert.equal(loadout?.phase, 'loadout')
  assert.equal(loadout?.lastCompletedRunId, 'run-a')
  assert.equal(acknowledgeGameOver(loadout!, 'run-a', 1), null)
  assert.equal(confirmPostRunLoadout(loadout!)?.phase, 'hub')
})

test('participant synchronization is deterministic and active-run-only', () => {
  const run = startGameRun(createGameRunLifecycle(), 'run-a', ['a'])
  const joined = synchronizeGameRunParticipants(run, ['b', 'a', 'b'])
  assert.deepEqual(joined.eligiblePlayerIds, ['a', 'b'])
  const terminal = stepGameRunLifecycle(joined, new Set())
  assert.equal(synchronizeGameRunParticipants(terminal, ['c']), terminal)
})

test('a second run receives a fresh terminal identity without losing session lineage', () => {
  let state = stepGameRunLifecycle(
    startGameRun(createGameRunLifecycle(), 'run-a', ['a']),
    new Set(),
  )
  for (let tick = 0; tick < BONEYARD_GAME_OVER_INPUT_GATE_TICKS; tick += 1) {
    state = stepGameRunLifecycle(state, new Set())
  }
  const loadout = acknowledgeGameOver(state, 'run-a', 1)
  assert.ok(loadout)
  const hub = confirmPostRunLoadout(loadout!)
  assert.ok(hub)
  const second = stepGameRunLifecycle(startGameRun(hub!, 'run-b', ['a']), new Set())
  assert.equal(second.gameOverEventId, 2)
  assert.equal(second.runId, 'run-b')
})

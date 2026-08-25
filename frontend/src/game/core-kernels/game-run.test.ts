import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GAME_OVER_AUTOMATIC_ACCEPT_TICK,
  GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
  GAME_OVER_INPUT_ACCEPT_TICK,
  GAME_OVER_INPUT_EXIT_FADE_TICKS,
  confirmPostRunLoadout,
  continueGameOver,
  continuePostRunToCollegeIntro,
  createGameRunLifecycle,
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
  assert.equal(terminal.gameOverExitKind, null)
  assert.deepEqual(terminal.loadoutReadyPlayerIds, [])
  const later = stepGameRunLifecycle(terminal, new Set())
  assert.equal(later.gameOverEventId, 1)
  assert.equal(later.gameOverTicks, 1)
})

test('normal Game Over accepts run-scoped input at tick 500 and owns the 20-tick exit', () => {
  let state = stepGameRunLifecycle(
    startGameRun(createGameRunLifecycle(), 'run-a', ['a']),
    new Set(),
  )
  for (let tick = 1; tick < GAME_OVER_INPUT_ACCEPT_TICK; tick += 1) {
    state = stepGameRunLifecycle(state, new Set())
    assert.equal(state.gameOverTicks, tick)
  }
  assert.equal(continueGameOver(state, 'run-a', 1), null)
  state = stepGameRunLifecycle(state, new Set())
  assert.equal(state.gameOverTicks, GAME_OVER_INPUT_ACCEPT_TICK)
  assert.equal(continueGameOver(state, 'wrong-run', 1), null)
  assert.equal(continueGameOver(state, 'run-a', 2), null)

  const continuing = continueGameOver(state, 'run-a', 1)
  assert.ok(continuing)
  state = continuing
  assert.equal(state.gameOverExitKind, 'input')
  assert.equal(state.gameOverExitTicks, 1)
  assert.equal(continueGameOver(state, 'run-a', 1), null)

  for (let exitTick = 2; exitTick <= GAME_OVER_INPUT_EXIT_FADE_TICKS; exitTick += 1) {
    state = stepGameRunLifecycle(state, new Set())
    assert.equal(state.gameOverExitTicks, exitTick)
  }
  assert.equal(state.phase, 'game-over')
  const loadout = stepGameRunLifecycle(state, new Set())
  assert.equal(loadout.phase, 'loadout')
  assert.equal(loadout.lastCompletedRunId, 'run-a')
  assert.deepEqual(loadout.eligiblePlayerIds, ['a'])
})

test('unattended Game Over accepts at Riff completion and owns the 250-tick exit', () => {
  let state = stepGameRunLifecycle(
    startGameRun(createGameRunLifecycle(), 'run-a', ['a']),
    new Set(),
  )
  for (let tick = 1; tick < GAME_OVER_AUTOMATIC_ACCEPT_TICK; tick += 1) {
    state = stepGameRunLifecycle(state, new Set())
    assert.equal(state.gameOverTicks, tick)
    assert.equal(state.gameOverExitTicks, null)
    assert.equal(state.gameOverExitKind, null)
  }
  state = stepGameRunLifecycle(state, new Set())
  assert.equal(state.gameOverTicks, GAME_OVER_AUTOMATIC_ACCEPT_TICK)
  assert.equal(state.gameOverExitKind, 'automatic')
  assert.equal(state.gameOverExitTicks, 1)

  for (let exitTick = 2; exitTick <= GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS; exitTick += 1) {
    state = stepGameRunLifecycle(state, new Set())
    assert.equal(state.gameOverExitTicks, exitTick)
  }
  assert.equal(state.phase, 'game-over')
  assert.equal(stepGameRunLifecycle(state, new Set()).phase, 'loadout')
})

test('post-run loadout readiness is participant-owned and completes only when all remain ready', () => {
  const loadout = {
    ...createGameRunLifecycle(),
    eligiblePlayerIds: ['a', 'b'],
    gameOverEventId: 1,
    lastCompletedRunId: 'run-a',
    nextGameOverEventId: 2,
    phase: 'loadout' as const,
  }
  const first = confirmPostRunLoadout(loadout, 'a')
  assert.ok(first)
  assert.equal(first.phase, 'loadout')
  assert.deepEqual(first.loadoutReadyPlayerIds, ['a'])
  assert.equal(confirmPostRunLoadout(first, 'a'), null)
  assert.equal(confirmPostRunLoadout(first, 'missing'), null)

  const hub = confirmPostRunLoadout(first, 'b')
  assert.ok(hub)
  assert.equal(hub.phase, 'hub')
  assert.deepEqual(hub.eligiblePlayerIds, [])
  assert.deepEqual(hub.loadoutReadyPlayerIds, [])

  const departed = synchronizeGameRunParticipants(first, ['a'])
  assert.equal(departed.phase, 'hub')

  const college = continuePostRunToCollegeIntro(loadout)
  assert.ok(college)
  assert.equal(college.phase, 'hub')
  assert.deepEqual(college.eligiblePlayerIds, [])
  assert.equal(continuePostRunToCollegeIntro(college), null)
})

test('participant synchronization follows active, Game Over, and loadout membership', () => {
  const run = startGameRun(createGameRunLifecycle(), 'run-a', ['a'])
  const joined = synchronizeGameRunParticipants(run, ['b', 'a', 'b'])
  assert.deepEqual(joined.eligiblePlayerIds, ['a', 'b'])
  const terminal = stepGameRunLifecycle(joined, new Set())
  const departed = synchronizeGameRunParticipants(terminal, ['b'])
  assert.deepEqual(departed.eligiblePlayerIds, ['b'])
})

test('a second run receives a fresh terminal identity without losing session lineage', () => {
  let state = stepGameRunLifecycle(
    startGameRun(createGameRunLifecycle(), 'run-a', ['a']),
    new Set(),
  )
  for (let tick = 0; tick < GAME_OVER_AUTOMATIC_ACCEPT_TICK; tick += 1) {
    state = stepGameRunLifecycle(state, new Set())
  }
  for (let tick = 1; tick <= GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS; tick += 1) {
    state = stepGameRunLifecycle(state, new Set())
  }
  const hub = confirmPostRunLoadout(state, 'a')
  assert.ok(hub)
  const second = stepGameRunLifecycle(startGameRun(hub, 'run-b', ['a']), new Set())
  assert.equal(second.gameOverEventId, 2)
  assert.equal(second.runId, 'run-b')
})

import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  GameSnapshot,
  ProtocolPlayerState,
} from '../protocol/game-state.ts'
import { HallOfFameRunRecorder } from './hall-of-fame-run-recorder.ts'

test('records one row from host-owned Hall counters without inferring from experience', () => {
  const recorder = new HallOfFameRunRecorder(
    () => new Date('2026-08-20T12:00:00.000Z'),
  )

  assert.equal(recorder.observe(snapshot('active', 120, null), 'local', 'account'), null)
  assert.equal(recorder.observe(snapshot('game-over', 300, null), 'local', 'account'), null)
  const completed = recorder.observe(snapshot('game-over', 439, 339), 'local', 'account')

  assert.deepEqual(completed, {
    accountUsername: 'account',
    awesomeness: 91,
    awesomestKill: 'Skeleton',
    completedAtUtc: '2026-08-20T12:00:00.000Z',
    discipline: 'arcane',
    elapsedTicks: 339,
    element: 'ether',
    headingIndex: 4,
    highestSkills: [
      { rank: 3, skillId: 2 },
      { rank: 2, skillId: 7 },
      { rank: 1, skillId: 1 },
    ],
    level: 4,
    monstersKilled: 17,
    perksUsed: [3, 8],
    portraitScale: 0.9,
    runId: 'run-one',
    wave: 1,
    wizardName: 'Volusius',
  })
  assert.equal(recorder.observe(snapshot('game-over', 440, 339), 'local', 'account'), null)
})

function snapshot(
  phase: 'active' | 'game-over',
  tick: number,
  elapsedTicks: number | null,
): GameSnapshot {
  return {
    players: { local: player() },
    run: { phase, runId: 'run-one' },
    tick,
    world: {
      hallOfFameRuns: {
        local: {
          awesomeness: 91,
          awesomestKill: 'Skeleton',
          elapsedTicks,
          monstersKilled: 17,
          portraitHeadingIndex: elapsedTicks === null ? null : 4,
          portraitScale: elapsedTicks === null ? null : 0.9,
        },
      },
      kind: 'boneyard',
      runId: 'run-one',
      waves: { waveOrdinal: 1 },
    },
  } as GameSnapshot
}

function player(): ProtocolPlayerState {
  return {
    config: {
      discipline: 'arcane',
      displayName: 'Volusius',
      element: 'ether',
    },
    economy: {
      ownedPerkSelectors: [3, 8],
    },
    headingIndex: 4,
    progression: {
      experience: 50_000,
      learnedSkills: [
        [1, 1, 1],
        [2, 3, 3],
        [7, 2, 2],
        [9, 0, 1],
      ],
      level: 4,
    },
  } as ProtocolPlayerState
}

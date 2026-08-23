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
      { rank: 3, skillId: 11 },
      { rank: 2, skillId: 13 },
      { rank: 1, skillId: 8 },
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

test('records only the ordered public skill list, never element or discipline roots', () => {
  const completed = new HallOfFameRunRecorder(
    () => new Date('2026-08-23T12:00:00.000Z'),
  ).observe(levelOneSnapshot(), 'local', null)

  assert.deepEqual(completed?.highestSkills, [
    { rank: 1, skillId: 8 },
    { rank: 1, skillId: 11 },
  ])
})

test('keeps learned-list order across equal ranks and caps the Hall projection at three', () => {
  const source = levelOneSnapshot()
  const player = source.players.local!
  const completed = new HallOfFameRunRecorder().observe({
    ...source,
    players: {
      local: {
        ...player,
        progression: {
          ...player.progression,
          learnedSkills: [
            ...player.progression.learnedSkills,
            [13, 1, 1] as const,
            [15, 1, 1] as const,
          ],
          learnedSkillOrder: [8, 11, 15, 13],
        },
      },
    },
  }, 'local', null)

  assert.deepEqual(completed?.highestSkills, [
    { rank: 1, skillId: 8 },
    { rank: 1, skillId: 11 },
    { rank: 1, skillId: 15 },
  ])
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
        [0, 1, 1],
        [7, 1, 1],
        [8, 1, 1],
        [11, 3, 3],
        [13, 2, 2],
        [15, 0, 1],
      ],
      learnedSkillOrder: [8, 11, 13],
      level: 4,
    },
  } as ProtocolPlayerState
}

function levelOneSnapshot(): GameSnapshot {
  const source = snapshot('game-over', 439, 339)
  return {
    ...source,
    players: {
      local: {
        ...source.players.local!,
        config: {
          discipline: 'mind',
          displayName: 'Volusius',
          element: 'ether',
        },
        progression: {
          ...source.players.local!.progression,
          learnedSkills: [
            [0, 1, 1],
            [6, 1, 1],
            [8, 1, 1],
            [11, 1, 1],
          ],
          learnedSkillOrder: [8, 11],
          level: 1,
        },
      },
    },
  }
}

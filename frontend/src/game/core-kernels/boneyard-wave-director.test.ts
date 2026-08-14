import assert from 'node:assert/strict'
import test from 'node:test'

import type { WaveDef } from './boneyard-wave-schema.ts'
import {
  BONEYARD_WAVE_ENEMY_TYPES,
  createBoneyardWaveDirector,
  retireBoneyardEnemy,
  startBoneyardWaveDirector,
  stepBoneyardWaveDirector,
  type BoneyardWaveDirectorState,
} from './boneyard-wave-director.ts'

const BOUNDS = { x: 0, y: 0, w: 1000, h: 800 }
const PLAYERS = {
  a: { position: { x: 250, y: 300 } },
  b: { position: { x: 750, y: 500 } },
}

test('all eight retail wave enemy tokens map to their native type ids', () => {
  assert.deepEqual(BONEYARD_WAVE_ENEMY_TYPES, {
    COFFIN: 1013,
    DEMON: 1009,
    IMP: 1004,
    SKELETON: 1001,
    SKELETONARCHER: 1002,
    SKELETONMAGE: 1003,
    WRAITH: 1007,
    ZOMBIE: 1006,
  })
})

test('Solomon run starts the exact ten-plus-five weakened Skeleton opening', () => {
  let state = startBoneyardWaveDirector(createBoneyardWaveDirector(
    'opening-seed',
    [wave({ maxEnemies: 100 })],
  ))

  state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, 0)
  assert.equal(state.phase, 'opening')
  assert.equal(state.enemies.length, 10)
  assert.equal(state.pendingSpawnBudget, 5)
  assert.ok(state.enemies.every((enemy) => (
    enemy.enemyToken === 'SKELETON'
    && enemy.locationPolicy === 'near-player'
    && enemy.spawnTick === 0
  )))
  for (const enemy of state.enemies) {
    assert.deepEqual(enemy.flags, [
      'FLAG_WEAK',
      'FLAG_HPDOWN',
      'FLAG_XPBONUS',
    ])
  }

  for (let tick = 1; tick < 500; tick += 1) {
    state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, tick)
  }
  assert.equal(state.enemies.length, 10)
  const expectedCounts = new Map([
    [500, 11],
    [600, 12],
    [700, 13],
    [800, 14],
    [900, 15],
  ])
  for (let tick = 500; tick <= 900; tick += 1) {
    state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, tick)
    const expected = expectedCounts.get(tick)
    if (expected !== undefined) assert.equal(state.enemies.length, expected)
  }
  assert.equal(state.phase, 'opening-threshold')
  assert.deepEqual(state.enemies.slice(10).map((enemy) => enemy.spawnTick), [
    500,
    600,
    700,
    800,
    900,
  ])
})

test('opening threshold is strict and Wave1 starts ten ticks after release', () => {
  let state = completeOpening('opening-release', [wave({ maxEnemies: 100 })])
  state = retireUntil(state, 4)
  const held = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, 901)
  assert.equal(held.phase, 'opening-threshold')
  assert.equal(held.waveOrdinal, 0)

  state = retireBoneyardEnemy(held, held.enemies[0].id)
  state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, 902)
  assert.equal(state.phase, 'spawning')
  assert.equal(state.waveOrdinal, 1)
  assert.equal(state.waveEventId, 1)
  assert.equal(state.spawnDelayTicks, 10)
  const priorCount = state.enemies.length
  for (let tick = 903; tick < 912; tick += 1) {
    state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, tick)
  }
  assert.equal(state.enemies.length, priorCount)
  state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, 912)
  assert.ok(state.enemies.length > priorCount)
  assert.ok(state.enemies.slice(priorCount).every((enemy) => (
    enemy.locationPolicy === 'anywhere'
  )))
})

test('default Spawner chooses a random event record per actor, not source order', () => {
  const schedule = [wave({
    groups: [{ entries: [
      { enemy: 'SKELETON', flags: ['FLAG_WEAK'] },
      { enemy: 'SKELETONARCHER', flags: ['FLAG_RANGEDOWN'] },
    ] }],
    maxEnemies: 100,
    spawn: 4,
  })]
  let state = beginFirstWave('record-sampling', schedule)
  const firstWaveId = state.nextEnemyId
  state = stepUntilNewEnemy(state, 2000)
  const spawned = state.enemies.filter((enemy) => enemy.id >= firstWaveId)
  assert.ok(spawned.length > schedule[0].spawn)
  assert.ok(spawned.some((enemy) => enemy.enemyToken === 'SKELETON'))
  assert.ok(spawned.some((enemy) => enemy.enemyToken === 'SKELETONARCHER'))
  assert.notDeepEqual(spawned.slice(0, 4).map((enemy) => enemy.enemyToken), [
    'SKELETON',
    'SKELETONARCHER',
    'SKELETON',
    'SKELETONARCHER',
  ])
  assert.ok(spawned.every((enemy) => (
    enemy.position.x >= BOUNDS.x
    && enemy.position.y >= BOUNDS.y
    && enemy.position.x <= BOUNDS.x + BOUNDS.w
    && enemy.position.y <= BOUNDS.y + BOUNDS.h
  )))
})

test('MAXENEMIES round-trips but does not cap the native compiler or Spawner', () => {
  const schedule = [wave({ maxEnemies: 1, spawn: 20 })]
  let state = completeOpening('parsed-max-enemies', schedule)
  assert.equal(state.enemies.length, 15)
  state = retireUntil(state, 0)
  state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, 901)
  for (let tick = 902; tick <= 911; tick += 1) {
    state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, tick)
  }
  assert.ok(state.enemies.length > schedule[0].maxEnemies)
  assert.equal(state.pendingSpawnBudget, 0)
  assert.equal(state.phase, 'wave-threshold')
})

test('live enemies never age out and threshold/lull nodes drive signed NEXT', () => {
  const schedule = [
    wave({ maxEnemies: 100, next: [1], spawn: 20 }),
    wave({
      groups: [{ entries: [{ enemy: 'SKELETONARCHER', flags: [] }] }],
      next: [-1],
      spawn: 1,
    }),
  ]
  let state = beginFirstWave('advance-seed', schedule)
  state = stepUntilNewEnemy(state, 2000)
  const firstWaveEnemy = state.enemies.find((enemy) => enemy.id > 15)
  assert.ok(firstWaveEnemy)
  for (let tick = 2001; tick < 3001; tick += 1) {
    state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, tick)
  }
  assert.equal(state.enemies.some((enemy) => enemy.id === firstWaveEnemy.id), true)

  state = retireUntil(state, 0)
  state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, 3001)
  assert.equal(state.phase, 'wave-lull-delay')
  assert.equal(state.interwaveDelayTicks, 25)
  for (let tick = 3002; tick <= 3026; tick += 1) {
    state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, tick)
  }
  assert.equal(state.phase, 'wave-lull')
  assert.ok(state.lowPopulationTicks > 1)
  state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, 3027)
  assert.equal(state.phase, 'interwave')
  assert.equal(state.interwaveDelayTicks, 75)

  for (let tick = 3028; tick <= 3052; tick += 1) {
    state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, tick)
  }
  assert.equal(state.nextScheduleIndex, 1)
  assert.equal(state.scheduleIndex, 0)
  while (state.phase === 'interwave') {
    state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, 4000)
  }
  assert.equal(state.phase, 'spawning')
  assert.equal(state.scheduleIndex, 1)
  assert.equal(state.waveOrdinal, 2)
  assert.equal(state.spawnDelayTicks, 10)
})

test('mode-6 lull uses strict population or the Arena low-population timer', () => {
  let opening = startBoneyardWaveDirector(createBoneyardWaveDirector(
    'mode-six-lull',
    [wave({ maxEnemies: 100 })],
  ))
  opening = stepBoneyardWaveDirector(opening, PLAYERS, BOUNDS, 0)
  const atThreshold = {
    ...opening,
    enemies: opening.enemies.slice(0, 4),
    lowPopulationTicks: 0,
    lullThreshold: 4,
    phase: 'wave-lull' as const,
  }

  const held = stepBoneyardWaveDirector(atThreshold, PLAYERS, BOUNDS, 1)
  assert.equal(held.phase, 'wave-lull')
  assert.equal(held.lowPopulationTicks, 1)
  const timerReleased = stepBoneyardWaveDirector(held, PLAYERS, BOUNDS, 2)
  assert.equal(timerReleased.phase, 'interwave')
  assert.equal(timerReleased.lowPopulationTicks, 2)

  const populationReleased = stepBoneyardWaveDirector({
    ...atThreshold,
    enemies: atThreshold.enemies.slice(0, 3),
  }, PLAYERS, BOUNDS, 1)
  assert.equal(populationReleased.phase, 'interwave')
  assert.equal(populationReleased.lowPopulationTicks, 1)
})

test('retirement is stable and ignores an unknown combat actor id', () => {
  let state = startBoneyardWaveDirector(createBoneyardWaveDirector(
    'retirement-seam',
    [wave({ maxEnemies: 100 })],
  ))
  state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, 0)
  assert.equal(retireBoneyardEnemy(state, 9999), state)
  const remainingIds = state.enemies.slice(1).map((enemy) => enemy.id)
  state = retireBoneyardEnemy(state, state.enemies[0].id)
  assert.deepEqual(state.enemies.map((enemy) => enemy.id), remainingIds)
})

function completeOpening(
  seed: string,
  schedule: readonly WaveDef[],
): BoneyardWaveDirectorState {
  let state = startBoneyardWaveDirector(createBoneyardWaveDirector(seed, schedule))
  for (let tick = 0; tick <= 900; tick += 1) {
    state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, tick)
  }
  assert.equal(state.phase, 'opening-threshold')
  assert.equal(state.enemies.length, 15)
  return state
}

function beginFirstWave(
  seed: string,
  schedule: readonly WaveDef[],
): BoneyardWaveDirectorState {
  let state = retireUntil(completeOpening(seed, schedule), 0)
  state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, 901)
  assert.equal(state.phase, 'spawning')
  return state
}

function stepUntilNewEnemy(
  source: BoneyardWaveDirectorState,
  tick: number,
): BoneyardWaveDirectorState {
  const nextId = source.nextEnemyId
  let state = source
  for (let offset = 0; offset < 1000 && state.nextEnemyId === nextId; offset += 1) {
    state = stepBoneyardWaveDirector(state, PLAYERS, BOUNDS, tick + offset)
  }
  if (state.nextEnemyId === nextId) throw new Error('fixture did not spawn an enemy')
  return state
}

function retireUntil(
  source: BoneyardWaveDirectorState,
  count: number,
): BoneyardWaveDirectorState {
  let state = source
  while (state.enemies.length > count) {
    state = retireBoneyardEnemy(state, state.enemies[0].id)
  }
  return state
}

function wave(patch: Partial<WaveDef>): WaveDef {
  return {
    groups: [{ entries: [{ enemy: 'SKELETON', flags: [] }] }],
    maxEnemies: 40,
    next: [0],
    spawn: 3,
    spawnDelay: [0, 0],
    waveDelay: [0, 0],
    ...patch,
  }
}

import assert from 'node:assert/strict'
import test from 'node:test'

import type { WaveDef } from './boneyard-wave-schema.ts'
import {
  BONEYARD_WAVE_ENEMY_TYPES,
  createBoneyardWaveDirector,
  startBoneyardWaveDirector,
  stepBoneyardWaveDirector,
  type BoneyardEnemySpawnIntent,
  type BoneyardWaveDirectorState,
} from './boneyard-wave-director.ts'

const BOUNDS = { x: 0, y: 0, w: 1000, h: 800 }
const PLAYERS = {
  a: { position: { x: 250, y: 300 } },
  b: { position: { x: 750, y: 500 } },
}

interface DirectorHarness {
  liveEnemyCount: number
  spawnIntents: BoneyardEnemySpawnIntent[]
  state: BoneyardWaveDirectorState
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

test('Solomon run emits its generated weakened Skeleton opening through tick 900', () => {
  const harness = startHarness('opening-seed', [wave({ maxEnemies: 100 })])
  const immediateCount = harness.state.openingBursts[0]!.count
  const spreadCount = harness.state.openingBursts[1]!.count
  tick(harness, 0)

  assert.equal(harness.state.phase, 'opening')
  assert.equal(harness.liveEnemyCount, immediateCount)
  assert.equal(harness.state.pendingSpawnBudget, spreadCount)
  assert.deepEqual(
    harness.spawnIntents.map((intent) => intent.id),
    Array.from({ length: immediateCount }, (_, index) => index + 1),
  )
  assert.ok(harness.spawnIntents.every((intent) => (
    intent.enemyToken === 'SKELETON'
    && intent.locationPolicy === 'near-player'
    && intent.positionPolicy === 'dark'
    && intent.spawnTick === 0
    && !('targetPlayerId' in intent)
  )))
  for (const intent of harness.spawnIntents) {
    assert.deepEqual(intent.flags, [
      'FLAG_WEAK',
      'FLAG_HPDOWN',
      'FLAG_XPBONUS',
    ])
    assert.equal(Object.isFrozen(intent.flags), true)
    assert.equal(Object.isFrozen(intent.position), true)
  }

  harness.spawnIntents.length = 0
  for (let currentTick = 1; currentTick <= 900; currentTick += 1) {
    tick(harness, currentTick)
  }
  assert.equal(harness.liveEnemyCount, immediateCount + spreadCount)
  assert.equal(harness.state.phase, 'opening-threshold')
  assert.equal(harness.spawnIntents.length, spreadCount)
  assert.equal(harness.spawnIntents[0]?.spawnTick, 500)
  assert.equal(harness.spawnIntents.at(-1)?.spawnTick, 900)
})

test('near-player Spawner preserves the raw 100-unit point for placement recovery', () => {
  let position: BoneyardEnemySpawnIntent['position'] | null = null
  for (let seed = 0; seed < 100 && position === null; seed += 1) {
    const state = startBoneyardWaveDirector(createBoneyardWaveDirector(`edge-${seed}`))
    const result = stepBoneyardWaveDirector(state, {
      bounds: { x: 0, y: 375, w: 1_000, h: 600 },
      liveEnemyCount: 0,
      players: { a: { position: { x: 500, y: 375 } } },
      tick: 0,
    })
    const candidate = result.spawnIntents[0]!.position
    if (candidate.y < 375) position = candidate
  }

  assert.ok(position)
  assert.ok(position.y < 375, 'raw spawn should remain outside for the placement search')
  assert.ok(Math.abs(Math.hypot(position.x - 500, position.y - 375) - 100) < 0.001)
})

test('zero-player opening continues from the native camera-center fallback', () => {
  const state = startBoneyardWaveDirector(createBoneyardWaveDirector('no-player-opening'))
  const result = stepBoneyardWaveDirector(state, {
    bounds: BOUNDS,
    liveEnemyCount: 0,
    players: {},
    tick: 0,
  })
  assert.equal(result.spawnIntents.length, state.openingBursts[0]!.count)
  assert.ok(result.spawnIntents.every(({ position, positionPolicy }) => (
    positionPolicy === 'dark'
    && Math.abs(Math.hypot(position.x - 500, position.y - 400) - 100) < 0.001
  )))
})

test('retail compilation carries ordinary dark and Coffin light policies', () => {
  const state = createBoneyardWaveDirector('position-policy-census')
  const bursts = state.compiledSchedule.flatMap(({ bursts }) => bursts)
  const coffins = bursts.filter(({ entries }) => entries[0]?.enemy === 'COFFIN')
  const ordinary = bursts.filter(({ entries }) => entries[0]?.enemy !== 'COFFIN')
  assert.ok(coffins.length > 0)
  assert.ok(ordinary.length > 0)
  assert.ok(coffins.every((burst) => (
    burst.locationPolicy === 'near-player' && burst.positionPolicy === 'light'
  )))
  assert.ok(ordinary.every((burst) => (
    burst.locationPolicy === 'anywhere' && burst.positionPolicy === 'dark'
  )))
})

test('external nonterminal live count strictly gates opening and wave spawning', () => {
  const harness = completeOpening('opening-release', [wave({ maxEnemies: 100 })])
  harness.liveEnemyCount = harness.state.openingReleaseThreshold
  tick(harness, 901)
  assert.equal(harness.state.phase, 'opening-threshold')
  assert.equal(harness.state.waveOrdinal, 0)

  harness.liveEnemyCount = harness.state.openingReleaseThreshold - 1
  tick(harness, 902)
  assert.equal(harness.state.phase, 'spawning')
  assert.equal(harness.state.waveOrdinal, 1)
  assert.equal(harness.state.waveEventId, 1)
  assert.equal(harness.state.spawnDelayTicks, 10)

  harness.spawnIntents.length = 0
  for (let currentTick = 903; currentTick < 912; currentTick += 1) {
    tick(harness, currentTick)
  }
  assert.equal(harness.spawnIntents.length, 0)
  tick(harness, 912)
  assert.ok(harness.spawnIntents.length > 0)
  assert.ok(harness.spawnIntents.every((intent) => (
    intent.locationPolicy === 'anywhere'
  )))
})

test('Spawner samples event records per actor and emits target-neutral intents', () => {
  const schedule = [wave({
    groups: [{ entries: [
      { enemy: 'SKELETON', flags: ['FLAG_WEAK'] },
      { enemy: 'SKELETONARCHER', flags: ['FLAG_RANGEDOWN'] },
    ] }],
    maxEnemies: 100,
    spawn: 4,
  })]
  const harness = beginFirstWave('record-sampling', schedule)
  harness.spawnIntents.length = 0
  stepUntilIntent(harness, 2000)

  assert.ok(harness.spawnIntents.length > schedule[0]!.spawn)
  assert.ok(harness.spawnIntents.some((intent) => intent.enemyToken === 'SKELETON'))
  assert.ok(harness.spawnIntents.some((intent) => intent.enemyToken === 'SKELETONARCHER'))
  assert.notDeepEqual(harness.spawnIntents.slice(0, 4).map((intent) => intent.enemyToken), [
    'SKELETON',
    'SKELETONARCHER',
    'SKELETON',
    'SKELETONARCHER',
  ])
  assert.ok(harness.spawnIntents.every((intent) => (
    intent.position.x >= BOUNDS.x
    && intent.position.y >= BOUNDS.y
    && intent.position.x <= BOUNDS.x + BOUNDS.w
    && intent.position.y <= BOUNDS.y + BOUNDS.h
    && !('targetPlayerId' in intent)
  )))
})

test('MAXENEMIES round-trips but does not cap native compilation or Spawner', () => {
  const schedule = [wave({ maxEnemies: 1, spawn: 20 })]
  const harness = completeOpening('parsed-max-enemies', schedule)
  harness.liveEnemyCount = 0
  tick(harness, 901)
  harness.spawnIntents.length = 0
  for (let currentTick = 902; currentTick <= 911; currentTick += 1) {
    tick(harness, currentTick)
  }
  assert.ok(harness.spawnIntents.length > schedule[0]!.maxEnemies)
  assert.equal(harness.state.pendingSpawnBudget, 0)
  assert.equal(harness.state.phase, 'wave-threshold')
})

test('mode-6 lull uses strict population or Arena low-population time', () => {
  const opening = startHarness('mode-six-lull', [wave({ maxEnemies: 100 })])
  tick(opening, 0)
  opening.state = {
    ...opening.state,
    lowPopulationTicks: 0,
    lullThreshold: 4,
    phase: 'wave-lull',
  }
  opening.liveEnemyCount = 4

  tick(opening, 1)
  assert.equal(opening.state.phase, 'wave-lull')
  assert.equal(opening.state.lowPopulationTicks, 1)
  tick(opening, 2)
  assert.equal(opening.state.phase, 'interwave')
  assert.equal(opening.state.lowPopulationTicks, 2)

  const population = startHarness('population-lull', [wave({ maxEnemies: 100 })])
  population.state = {
    ...population.state,
    lowPopulationTicks: 0,
    lullThreshold: 4,
    phase: 'wave-lull',
  }
  population.liveEnemyCount = 3
  tick(population, 1)
  assert.equal(population.state.phase, 'interwave')
  assert.equal(population.state.lowPopulationTicks, 1)
})

test('invalid live-count feedback is rejected at the scheduling boundary', () => {
  const state = createBoneyardWaveDirector('invalid-live-count', [wave({})])
  for (const liveEnemyCount of [-1, 1.5, Number.NaN]) {
    assert.throws(() => stepBoneyardWaveDirector(state, {
      bounds: BOUNDS,
      liveEnemyCount,
      players: PLAYERS,
      tick: 0,
    }), /live enemy count/)
  }
})

function startHarness(
  seed: string,
  schedule: readonly WaveDef[],
): DirectorHarness {
  return {
    liveEnemyCount: 0,
    spawnIntents: [],
    state: startBoneyardWaveDirector(createBoneyardWaveDirector(seed, schedule)),
  }
}

function completeOpening(
  seed: string,
  schedule: readonly WaveDef[],
): DirectorHarness {
  const harness = startHarness(seed, schedule)
  for (let currentTick = 0; currentTick <= 900; currentTick += 1) {
    tick(harness, currentTick)
  }
  assert.equal(harness.state.phase, 'opening-threshold')
  assert.equal(
    harness.liveEnemyCount,
    harness.state.openingBursts.reduce((total, burst) => total + burst.count, 0),
  )
  return harness
}

function beginFirstWave(
  seed: string,
  schedule: readonly WaveDef[],
): DirectorHarness {
  const harness = completeOpening(seed, schedule)
  harness.liveEnemyCount = 0
  tick(harness, 901)
  assert.equal(harness.state.phase, 'spawning')
  return harness
}

function stepUntilIntent(harness: DirectorHarness, startTick: number): void {
  for (let offset = 0; offset < 1000 && harness.spawnIntents.length === 0; offset += 1) {
    tick(harness, startTick + offset)
  }
  if (harness.spawnIntents.length === 0) throw new Error('fixture emitted no spawn intent')
}

function tick(harness: DirectorHarness, currentTick: number): void {
  const result = stepBoneyardWaveDirector(harness.state, {
    bounds: BOUNDS,
    liveEnemyCount: harness.liveEnemyCount,
    players: PLAYERS,
    tick: currentTick,
  })
  harness.state = result.director
  harness.liveEnemyCount += result.spawnIntents.length
  harness.spawnIntents.push(...result.spawnIntents)
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

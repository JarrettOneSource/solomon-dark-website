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
import {
  NATIVE_SLUMPGUT_RECIPE_SOURCE,
  NATIVE_SLUMPGUT_TRIGGER,
  nativeSlumpgutRecipe,
} from './native-survival-slumpgut.ts'

const BOUNDS = { x: 0, y: 0, w: 1000, h: 800 }
const PLAYERS = {
  a: { position: { x: 250, y: 300 } },
  b: { position: { x: 750, y: 500 } },
}

interface DirectorHarness {
  liveEnemyCount: number
  liveZombieCount: number
  spawnIntents: BoneyardEnemySpawnIntent[]
  state: BoneyardWaveDirectorState
}

test('all retail and Portal enemy tokens map to their native type ids', () => {
  assert.deepEqual(BONEYARD_WAVE_ENEMY_TYPES, {
    COFFIN: 1013,
    DEMON: 1009,
    IMP: 1004,
    PORTAL: 5021,
    SKELETON: 1001,
    SKELETONARCHER: 1002,
    SKELETONMAGE: 1003,
    WRAITH: 1007,
    ZOMBIE: 1006,
  })
})

test('Deep Portal holds the timeline, births three bosses, and polls only bosses', () => {
  const sourceSha256 = '9e9e1bccd99babf99e190ae4acdae98d1fea2f782b60ba6d45a6b9eae6afe2d9'
  let state: BoneyardWaveDirectorState = {
    ...createBoneyardWaveDirector('portal-barrier', [wave({ next: [0] })], {
      sourceSha256,
    }),
    phase: 'spawning' as const,
    waveOrdinal: 24,
  }
  const spawnIntents: BoneyardEnemySpawnIntent[] = []
  const step = (tick: number, liveBossCount: number) => {
    const result = stepBoneyardWaveDirector(state, {
      bounds: BOUNDS,
      liveBossCount,
      liveEnemyCount: 20,
      liveZombieCount: 0,
      players: PLAYERS,
      tick,
    })
    state = result.director
    spawnIntents.push(...result.spawnIntents)
  }

  step(0, 0)
  assert.equal(state.portalScriptPhase, 'intro')
  assert.equal(state.portalTicksRemaining, 150)
  assert.equal(state.portalTimelinePaused, true)
  for (let tick = 1; tick < 150; tick += 1) step(tick, 0)
  assert.equal(spawnIntents.length, 0)
  step(150, 0)
  assert.equal(spawnIntents.length, 1)
  for (let tick = 151; tick < 175; tick += 1) step(tick, 1)
  step(175, 1)
  for (let tick = 176; tick < 200; tick += 1) step(tick, 2)
  step(200, 2)

  assert.equal(spawnIntents.length, 3)
  assert.ok(spawnIntents.every((intent) => (
    intent.enemyToken === 'PORTAL'
    && intent.nativeTypeId === 5021
    && intent.placementRadius === 45
    && intent.reachabilityRadius === 25
    && intent.positionPolicy === 'light'
    && intent.authoredRecipe?.classification === 'multiple-boss'
  )))
  assert.equal(state.portalScriptPhase, 'boss-wait')
  assert.equal(state.portalTicksRemaining, 100)

  state = { ...state, portalTicksRemaining: 1 }
  step(201, 1)
  assert.equal(state.portalTicksRemaining, 200)
  assert.equal(state.portalTimelinePaused, true)
  state = { ...state, portalTicksRemaining: 1 }
  step(202, 0)
  assert.equal(state.portalTimelinePaused, false)
  assert.equal(state.portalPhaseIndex, 1)
  assert.equal(state.portalScriptPhase, 'idle')
  assert.equal(state.waveOrdinal, 25)
})

test('later Deep Portal phases run alongside the ordinary timeline', () => {
  const sourceSha256 = '2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f'
  const source = {
    ...createBoneyardWaveDirector('portal-concurrent', [wave({})], { sourceSha256 }),
    phase: 'wave-threshold' as const,
    populationThreshold: 1,
    waveOrdinal: 42,
  }
  const result = stepBoneyardWaveDirector(source, {
    bounds: BOUNDS,
    liveBossCount: 0,
    liveEnemyCount: 2,
    liveZombieCount: 0,
    players: PLAYERS,
    tick: 50,
  })
  assert.equal(result.spawnIntents.filter(({ enemyToken }) => enemyToken === 'PORTAL').length, 1)
  assert.equal(result.director.portalTimelinePaused, false)
  assert.equal(result.director.portalTicksRemaining, 25)
  assert.equal(result.director.phase, 'wave-threshold')
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
      liveZombieCount: 0,
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
    liveZombieCount: 0,
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

test('drains the generated Slumpgut trigger and complete authored recipe', () => {
  const recipeUids = {
    '1be4c308ccd442d70060cc66e3daa7b073faf035fd92d6b49fad4c33a91ef0c1': 37_391,
    '2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f': 36_805,
    '506200e6f89dd26150c7fcc76f5cddfdb321412657ac979ea5924b567b4a2933': 37_465,
    '624b79ae325daa714b24017e0a308c64519f7481eb206e4489968217b1a2e123': 37_386,
    '8c2f97d2ed54431987e3cb54b7ae3c1098bf1c4517f59ade6aea57759187adb0': 37_317,
    '9e9e1bccd99babf99e190ae4acdae98d1fea2f782b60ba6d45a6b9eae6afe2d9': 36_808,
    'bd3c38468481b7337b1e7382e5503cc214356906571763a68188b23e821e73fb': 35_004,
    'bec9377cf539bb193e8af6ad72fa78a5e47e44206a1fef4d6bf3bfbda3f04a08': 36_822,
    'cd4d1ba948ca6624fffb967b02b7c93a6d00cbf9b5ec2c4541330b0616a1c239': 37_355,
    'e62e5e847562d822382fba14709d5367c9cd7de40f8b4fa52ecea3bfc8d9a430': 37_377,
    'ec2b27a1415c944c233158da8c21324760cd896e1228143aa18d262f65fa2a45': 37_377,
    'efa240ce741df0f781228206d024bb1903c7210d1163eccf80c87e835365422f': 37_329,
  }
  for (const [sourceSha256, uid] of Object.entries(recipeUids)) {
    assert.equal(nativeSlumpgutRecipe(sourceSha256).uid, uid)
  }
  assert.deepEqual(NATIVE_SLUMPGUT_TRIGGER, {
    intervalTicks: 1_000,
    pollPeriodTicks: 4,
    scriptSleepTicks: 1_500,
    spawnLocationPolicy: 'anywhere',
    spawnPositionPolicy: 'light',
    zombieCountThreshold: 75,
  })
  assert.deepEqual(NATIVE_SLUMPGUT_RECIPE_SOURCE, {
    archetype: 'Slumpgut',
    attackSpeed: 1,
    auraMode: 0,
    behaviorCount: 1,
    behaviorMax: 0,
    behaviorMin: 0,
    behaviorTimer: 0,
    burning: false,
    castMode: 0,
    chaseSpeed: 1,
    dropGold: 4,
    dropItems: 4,
    dropOrbs: 4,
    dropPotions: 4,
    dropPowerups: 4,
    dropSpecificItems: 0,
    enemyType: 1006,
    extraDamage: 10,
    flanking: false,
    headgearMode: 0,
    hasLinkedUid: true,
    maxHp: 1_575,
    moveSpeedScale: 1,
    name: 'Slumpgut',
    pathfindingMode: 2,
    primaryDamage: 35,
    projectileMode: 0,
    randomVariant: 0,
    rect98: [1, 1, 1, 1],
    rectA8: [1, 1, 1, 1],
    secondaryDamage: 10,
    shield: true,
    shieldOthers: false,
    specialSpawnMode: 1,
    tertiaryDamage: 15,
    unknown81: 0,
    unknown82: 0,
    unknown96: false,
    variantMode: 0,
    xpBonus: -196.875,
  })
  assert.throws(
    () => nativeSlumpgutRecipe('0'.repeat(64)),
    /has no extracted Slumpgut recipe/,
  )
  assert.deepEqual(
    nativeSlumpgutRecipe(
      '2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f',
    ),
    {
      archerAccuracyMode: 0,
      attackSpeed: 1,
      chaseSpeed: 1,
      classification: 'boss',
      experience: 2_756.25,
      extraDamage: 10,
      family: {
        bodyType: 1,
        flyblown: true,
        kind: 'zombie',
        poisonDuration: 10,
        poisonPoolDamage: 15,
        poisonPunchDamage: 10,
      },
      lootPolicies: {
        gold: 4,
        item: 4,
        orb: 4,
        potion: 4,
        powerup: 4,
        specificItem: 0,
      },
      maximumHealth: 1_575,
      movementScale: 1,
      name: 'Slumpgut',
      onDeathProgram: 'miniboss-die',
      primaryDamage: 35,
      secondaryDamage: 10,
      tertiaryDamage: 15,
      uid: 36_805,
    },
  )
})

test('Slumpgut arms strictly above 75 Zombies and spawns once after 2500 ticks', () => {
  const sourceSha256 = '2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f'
  let state = createBoneyardWaveDirector('slumpgut-threshold', [wave({})], {
    sourceSha256,
  })
  const step = (liveEnemyCount: number, liveZombieCount: number, tick: number) => {
    const result = stepBoneyardWaveDirector(state, {
      bounds: BOUNDS,
      liveEnemyCount,
      liveZombieCount,
      players: PLAYERS,
      tick,
    })
    state = result.director
    return result.spawnIntents
  }

  assert.deepEqual(step(200, 75, 0), [])
  assert.equal(state.slumpgutPhase, 'eligible')
  assert.equal(state.slumpgutTicksRemaining, 0)

  for (let tick = 1; tick <= 3; tick += 1) {
    assert.deepEqual(step(200, 76, tick), [])
    assert.equal(state.slumpgutPhase, 'eligible')
  }
  assert.deepEqual(step(200, 76, 4), [])
  assert.equal(state.slumpgutPhase, 'interval-countdown')
  assert.equal(state.slumpgutTicksRemaining, 1_000)
  for (let tick = 5; tick <= 1_003; tick += 1) assert.deepEqual(step(200, 0, tick), [])
  assert.equal(state.slumpgutPhase, 'interval-countdown')
  assert.equal(state.slumpgutTicksRemaining, 1)

  assert.deepEqual(step(200, 0, 1_004), [])
  assert.equal(state.slumpgutPhase, 'script-sleep')
  assert.equal(state.slumpgutTicksRemaining, 1_500)
  for (let tick = 1_005; tick <= 2_503; tick += 1) assert.deepEqual(step(200, 0, tick), [])
  assert.equal(state.slumpgutPhase, 'script-sleep')
  assert.equal(state.slumpgutTicksRemaining, 1)

  const intents = step(200, 0, 2_504)
  assert.equal(intents.length, 1)
  assert.deepEqual(intents[0], {
    authoredRecipe: nativeSlumpgutRecipe(sourceSha256),
    enemyToken: 'ZOMBIE',
    flags: [],
    flanking: false,
    id: 1,
    locationPolicy: 'anywhere',
    nativeTypeId: 1006,
    pathfindingMode: 2,
    position: intents[0]!.position,
    positionPolicy: 'light',
    spawnTick: 2_504,
    waveOrdinal: 0,
    zombieBodyType: 1,
  })
  assert.equal(Object.isFrozen(intents[0]!.position), true)
  assert.equal(state.phase, 'dormant')
  assert.equal(state.pendingSpawnBudget, 0)
  assert.equal(state.slumpgutPhase, 'retired')
  assert.equal(state.slumpgutTicksRemaining, 0)
  assert.deepEqual(step(500, 500, 5_000), [])
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
      liveZombieCount: 0,
      players: PLAYERS,
      tick: 0,
    }), /live enemy count/)
  }
  for (const liveZombieCount of [-1, 1.5, Number.NaN]) {
    assert.throws(() => stepBoneyardWaveDirector(state, {
      bounds: BOUNDS,
      liveEnemyCount: 0,
      liveZombieCount,
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
    liveZombieCount: 0,
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
    liveZombieCount: harness.liveZombieCount,
    players: PLAYERS,
    tick: currentTick,
  })
  harness.state = result.director
  harness.liveEnemyCount += result.spawnIntents.length
  harness.liveZombieCount += result.spawnIntents.filter(({ enemyToken }) => (
    enemyToken === 'ZOMBIE'
  )).length
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

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import type { WaveDef } from './boneyard-wave-schema.ts'
import {
  compileBoneyardOpening,
  compileBoneyardWaveSection,
  NATIVE_LULL_RELEASE_TO_NEXT_SPAWN_TICKS,
  NATIVE_OPENING_IMMEDIATE_COUNT,
  NATIVE_OPENING_RELEASE_THRESHOLD,
  NATIVE_OPENING_SPREAD_COUNT,
  NATIVE_PAUSE_NODE_GAP_TICKS,
  NATIVE_WAVE_LABEL_TO_FIRST_SPAWN_TICKS,
  seedBoneyardWaveRng,
} from './boneyard-wave-timeline.ts'
import { advanceNativeRngWords, createNativeRng, drawNativeInteger } from './native-rng.ts'
import { NATIVE_RETAIL_WAVES } from './native-retail-wave-schedule.ts'

test('pins the generated opening draws, policies, and TimeLine node offsets', () => {
  assert.deepEqual(NATIVE_OPENING_IMMEDIATE_COUNT, { minimum: 8, randomCount: 5 })
  assert.deepEqual(NATIVE_OPENING_SPREAD_COUNT, { minimum: 3, randomCount: 3 })
  assert.deepEqual(NATIVE_OPENING_RELEASE_THRESHOLD, { minimum: 1, randomCount: 4 })
  assert.equal(NATIVE_WAVE_LABEL_TO_FIRST_SPAWN_TICKS, 10)
  assert.equal(NATIVE_PAUSE_NODE_GAP_TICKS, 25)
  assert.equal(NATIVE_LULL_RELEASE_TO_NEXT_SPAWN_TICKS, 85)

  const source = compilerRng('opening-draw-order')
  const immediate = drawNativeInteger(source, 5)
  const spread = drawNativeInteger(immediate.state, 3)
  const release = drawNativeInteger(spread.state, 4)
  const opening = compileBoneyardOpening(source)
  assert.equal(opening.bursts[0]?.count, 8 + immediate.value)
  assert.equal(opening.bursts[1]?.count, 3 + spread.value)
  assert.equal(opening.releaseThreshold, 1 + release.value)
  assert.deepEqual(opening.rngState, release.state)
  assert.ok(opening.bursts.every((burst) => (
    burst.locationPolicy === 'near-player'
    && burst.positionPolicy === 'dark'
    && burst.entries[0]?.enemy === 'SKELETON'
    && burst.entries[0].flags.join(',') === 'FLAG_WEAK,FLAG_HPDOWN,FLAG_XPBONUS'
  )))

  const immediateCounts = new Set<number>()
  const spreadCounts = new Set<number>()
  const releaseThresholds = new Set<number>()
  for (let seed = 1; seed <= 2_000; seed += 1) {
    const sampled = compileBoneyardOpening(createNativeRng(seed))
    immediateCounts.add(sampled.bursts[0]!.count)
    spreadCounts.add(sampled.bursts[1]!.count)
    releaseThresholds.add(sampled.releaseThreshold)
  }
  assert.deepEqual([...immediateCounts].sort((left, right) => left - right), [8, 9, 10, 11, 12])
  assert.deepEqual([...spreadCounts].sort((left, right) => left - right), [3, 4, 5])
  assert.deepEqual([...releaseThresholds].sort((left, right) => left - right), [1, 2, 3, 4])
})

test('retail SPAWN is a cost budget that expands into larger grouped bursts', () => {
  const wave = NATIVE_RETAIL_WAVES[0]
  const state = compilerRng('wave-one-compiler-fixture')
  const left = compileBoneyardWaveSection(wave, 1, state)
  const right = compileBoneyardWaveSection(wave, 1, state)
  assert.deepEqual(left, right)
  assert.equal(wave.spawn, 14)
  assert.ok(left.section.bursts.reduce((total, burst) => total + burst.count, 0) > wave.spawn)
  assert.equal(left.section.bursts[0].startDelayTicks, 10)
  assert.ok(left.section.bursts.every((burst) => (
    burst.locationPolicy === 'anywhere'
    && burst.positionPolicy === 'dark'
    && burst.entries.length === wave.groups[burst.groupIndex].entries.length
    && burst.steady
  )))
  assert.ok(left.section.releaseThreshold >= 10)
  assert.ok(left.section.lullThreshold >= 3)
})

test('consecutive selections of one GROUP merge count and spread into one event', () => {
  const wave: WaveDef = {
    groups: [{ entries: [{ enemy: 'SKELETON', flags: ['FLAG_WEAK'] }] }],
    maxEnemies: 40,
    next: [0],
    spawn: 6,
    spawnDelay: [20, 20],
    waveDelay: [0, 0],
  }
  const result = compileBoneyardWaveSection(
    wave,
    1,
    compilerRng('single-group-merge'),
  )
  assert.equal(result.section.bursts.length, 1)
  assert.ok(result.section.bursts[0].count > wave.spawn)
  assert.ok(result.section.bursts[0].spreadTicks > 0)
  assert.deepEqual(result.section.bursts[0].entries, wave.groups[0].entries)
})

test('retail logged-and-ignored flags stay out of emitted enemy configs', () => {
  const wave: WaveDef = {
    groups: [{ entries: [{
      enemy: 'DEMON',
      flags: ['FLAG_IGNITE', 'FLAG_HPUP', 'FLAG_IMMORTALIZE'],
    }] }],
    maxEnemies: 40,
    next: [0],
    spawn: 3,
    spawnDelay: [0, 0],
    waveDelay: [0, 0],
  }
  const result = compileBoneyardWaveSection(
    wave,
    1,
    compilerRng('ignored-source-flags'),
  )

  assert.ok(result.section.bursts.length > 0)
  assert.ok(result.section.bursts.every((burst) => (
    burst.entries.every((entry) => (
      entry.flags.length === 1 && entry.flags[0] === 'FLAG_HPUP'
    ))
  )))
})

function compilerRng(seed: string) {
  return createNativeRng(seedBoneyardWaveRng(seed))
}


test('all retail Coffin groups leave the ordered selection pool after one choice', () => {
  const seen = new Set<string>()
  const seenGroups = new Set<string>()
  const expected = ['15:6', '19:7', '25:6', '33:5', '34:11', '34:12', '35:6', '35:7']
  assert.equal(NATIVE_RETAIL_WAVES.length, 42)
  assert.equal(NATIVE_RETAIL_WAVES.reduce((total, wave) => total + wave.groups.length, 0), 205)
  for (let seed = 1; seed <= 32; seed += 1) {
    let rng = compileBoneyardOpening(createNativeRng(seed * 0x123456)).rngState
    for (const [row, wave] of NATIVE_RETAIL_WAVES.entries()) {
      const result = compileBoneyardWaveSection(wave, row + 1, rng)
      rng = result.rngState
      const selected = new Set<number>()
      for (const burst of result.section.bursts) {
        seenGroups.add(`${row}:${burst.groupIndex}`)
        assert.deepEqual(burst.entries, wave.groups[burst.groupIndex].entries.map(entry => ({
          enemy: entry.enemy,
          flags: entry.flags.filter(flag => flag !== 'FLAG_IGNITE' && flag !== 'FLAG_IMMORTALIZE'),
        })))
        if (burst.entries[0].enemy !== 'COFFIN') continue
        assert.equal(selected.has(burst.groupIndex), false, `row ${row} repeats Coffin group ${burst.groupIndex}`)
        selected.add(burst.groupIndex)
        seen.add(`${row}:${burst.groupIndex}`)
        assert.equal(burst.locationPolicy, 'near-player')
        assert.equal(burst.positionPolicy, 'light')
        assert.equal(burst.afterDelayTicks, 100)
        assert.ok(burst.count <= Math.trunc((row + 1) / 5))
      }
    }
  }
  assert.deepEqual([...seen].sort(), expected.sort())
  assert.equal(seenGroups.size, 205, 'every authored group must have a compiled assertion')
})

test('Coffin removal keeps original group identity and the order of later groups', () => {
  const wave: WaveDef = {
    groups: ['SKELETON', 'COFFIN', 'ZOMBIE', 'DEMON'].map(enemy => ({ entries: [{ enemy, flags: [] }] })),
    maxEnemies: 40, next: [0], spawn: 2, spawnDelay: [50, 50], waveDelay: [0, 0],
  }
  const words = Array<number>(55).fill(0)
  words[35] = 64
  words[38] = 64
  const source = { indexA: 0, indexB: 31, words }
  const result = compileBoneyardWaveSection(wave, 16, source)
  assert.deepEqual(result.section.bursts.map(burst => burst.groupIndex), [1, 2])
  assert.deepEqual(result.section.bursts.map(burst => burst.count), [2, 2])
  assert.deepEqual(result.section.bursts.map(burst => burst.spreadTicks), [25, 25])
  assert.deepEqual(result.rngState, advanceNativeRngWords(source, 12))
  assert.deepEqual(wave.groups.map(group => group.entries[0].enemy), ['SKELETON', 'COFFIN', 'ZOMBIE', 'DEMON'])
})

test('budget reductions emit the already snapshotted last member and constant bonus without a draw', () => {
  const source = createNativeRng(0x12345678)
  for (const enemy of ['SKELETON', 'ZOMBIE', 'DEMON', 'IMP']) {
    const wave: WaveDef = {
      groups: [{ entries: [{ enemy, flags: [] }] }],
      maxEnemies: 40, next: [0], spawn: 1, spawnDelay: [50, 50], waveDelay: [0, 0],
    }
    for (const ordinal of [1, 2, 3, 4, 5]) {
      const result = compileBoneyardWaveSection(wave, ordinal, source)
      assert.equal(result.section.bursts.length, 1, `${enemy} ordinal ${ordinal}`)
      assert.equal(result.section.bursts[0].count, 2)
      assert.equal(result.section.bursts[0].spreadTicks, 25)
      assert.deepEqual(result.rngState, advanceNativeRngWords(source, 7))
    }
  }
})

test('only the first entry owns Pike and split-Imp budget predicates', () => {
  for (const [enemy, flag] of [
    ['SKELETON', 'FLAG_PIKE'], ['IMP', 'FLAG_SPLIT'], ['IMP', 'FLAG_SPLITMANY'],
  ]) {
    const wave: WaveDef = {
      groups: [
        { entries: [{ enemy, flags: [] }, { enemy, flags: [] }] },
        { entries: [{ enemy: 'DEMON', flags: [] }] },
      ],
      maxEnemies: 40, next: [0], spawn: 6, spawnDelay: [30, 40], waveDelay: [20, 25],
    }
    const control = compileBoneyardWaveSection(wave, 16, createNativeRng(0x12345678))
    const candidate = structuredClone(wave)
    candidate.groups[0].entries[1].flags.push(flag)
    const result = compileBoneyardWaveSection(candidate, 16, createNativeRng(0x12345678))
    const counts = (value: typeof result) => value.section.bursts.map(burst => ({
      count: burst.count, groupIndex: burst.groupIndex, spreadTicks: burst.spreadTicks,
    }))
    assert.deepEqual(counts(result), counts(control), flag)
    assert.deepEqual(result.rngState, control.rngState, flag)
  }
})

test('custom Coffin-only rows fail explicitly when their native selection pool is exhausted', () => {
  const wave: WaveDef = {
    groups: [{ entries: [{ enemy: 'COFFIN', flags: [] }] }],
    maxEnemies: 40, next: [0], spawn: 2, spawnDelay: [50, 50], waveDelay: [0, 0],
  }
  assert.throws(() => compileBoneyardWaveSection(wave, 16, createNativeRng(1)), /exhausted.*group/i)
  const valid = { ...wave, spawn: 1 }
  assert.equal(compileBoneyardWaveSection(valid, 16, createNativeRng(1)).section.bursts.length, 1)
})


test('first-entry resets and ordinal boundaries retain native pre-mutation cost', () => {
  for (const [enemy, flags, ordinal, secondCount] of [
    ['ZOMBIE', [], 27, 2], ['ZOMBIE', [], 28, 6],
    ['IMP', [], 36, 2], ['IMP', [], 37, 6],
    ['IMP', ['FLAG_SPLIT'], 36, 2], ['IMP', ['FLAG_SPLIT'], 37, 6],
    ['IMP', ['FLAG_SPLITMANY'], 36, 2], ['IMP', ['FLAG_SPLITMANY'], 37, 6],
    ['SKELETON', ['FLAG_PIKE'], 36, 2], ['SKELETON', ['FLAG_PIKE'], 37, 2],
    ['DEMON', [], 28, 2], ['DEMON', [], 37, 2],
  ] as const) {
    const wave: WaveDef = {
      groups: [
        { entries: Array.from({ length: 3 }, () => ({ enemy, flags: [...flags] })) },
        { entries: Array.from({ length: 3 }, () => ({ enemy: 'DEMON', flags: [] })) },
      ],
      maxEnemies: 40, next: [0], spawn: 4, spawnDelay: [50, 50], waveDelay: [0, 0],
    }
    const words = Array<number>(55).fill(0)
    words[40] = 64
    const source = { indexA: 0, indexB: 31, words }
    const result = compileBoneyardWaveSection(wave, ordinal, source)
    assert.deepEqual(result.section.bursts.map(burst => burst.groupIndex), [0, 1])
    assert.deepEqual(result.section.bursts.map(burst => burst.count), [6, secondCount], `${enemy} ${flags} ${ordinal}`)
    assert.deepEqual(result.rngState, advanceNativeRngWords(source, secondCount === 2 ? 14 : 16))
  }
})


test('the initial scalar SPAWN draw precedes half-budget expansion and both retained text samples', () => {
  const wave: WaveDef = {
    groups: [{ entries: Array.from({ length: 5 }, () => ({ enemy: 'SKELETON', flags: [] })) }],
    maxEnemies: 40, next: [0], spawn: 8, spawnDelay: [50, 50], waveDelay: [0, 0],
  }
  const words = Array<number>(55).fill(0)
  words[32] = 3 * 64
  const source = { indexA: 0, indexB: 31, words }
  const result = compileBoneyardWaveSection(wave, 1, source)
  assert.equal(result.section.bursts.length, 1)
  assert.equal(result.section.bursts[0].count, 18)
  assert.equal(result.section.bursts[0].spreadTicks, 375)
  assert.deepEqual(result.rngState, advanceNativeRngWords(source, 24))
})


test('custom recurring-reset pools reject proven nontermination without limiting valid groups', () => {
  const moduleUrl = new URL('./boneyard-wave-timeline.ts', import.meta.url).href
  const rngUrl = new URL('./native-rng.ts', import.meta.url).href
  const source = `
    import { compileBoneyardWaveSection } from ${JSON.stringify(moduleUrl)}
    import { createNativeRng } from ${JSON.stringify(rngUrl)}
    const failures = []
    for (const [enemy, flags] of [
      ['SKELETON',['FLAG_PIKE']], ['IMP',['FLAG_SPLIT']], ['IMP',['FLAG_SPLITMANY']],
    ]) {
      const wave = { groups:[{entries:[{enemy,flags}]}], maxEnemies:40, next:[0],
        spawn:2, spawnDelay:[0,0], waveDelay:[0,0] }
      try { compileBoneyardWaveSection(wave,16,createNativeRng(1)); failures.push(null) }
      catch (error) { failures.push(error.message) }
      const singleton = compileBoneyardWaveSection({...wave,spawn:1},16,createNativeRng(1))
      if (singleton.section.bursts.length !== 1) throw new Error('valid singleton was rejected')
      const large = {...wave,groups:[{entries:Array.from({length:3},()=>({enemy,flags}))}]}
      if (compileBoneyardWaveSection(large,16,createNativeRng(1)).section.bursts.length !== 1) {
        throw new Error('valid large first group was rejected')
      }
      if (enemy === 'IMP') compileBoneyardWaveSection(wave,37,createNativeRng(1))
    }
    const mixed = { groups:[
      {entries:[{enemy:'COFFIN',flags:[]}]},
      {entries:[{enemy:'SKELETON',flags:['FLAG_PIKE']}]},
    ], maxEnemies:40, next:[0], spawn:2, spawnDelay:[0,0], waveDelay:[0,0] }
    try { compileBoneyardWaveSection(mixed,16,createNativeRng(1)); failures.push(null) }
    catch (error) { failures.push(error.message) }
    console.log(JSON.stringify(failures))
  `
  // A regression must fail in bounded time rather than hang the Website gate.
  const child = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', source], {
    encoding: 'utf8', timeout: 2_000,
  })
  assert.ifError(child.error)
  assert.equal(child.status, 0, child.stderr)
  const failures: unknown = JSON.parse(child.stdout)
  assert.ok(Array.isArray(failures) && failures.length === 4)
  assert.ok(failures.every((value: unknown) => typeof value === 'string' && /cannot consume.*budget/i.test(value)))
})

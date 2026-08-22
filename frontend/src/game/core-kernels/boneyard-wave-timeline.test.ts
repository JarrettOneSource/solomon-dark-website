import assert from 'node:assert/strict'
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
import { createNativeRng, drawNativeInteger } from './native-rng.ts'
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

import assert from 'node:assert/strict'
import test from 'node:test'

import type { WaveDef } from './boneyard-wave-schema.ts'
import {
  compileBoneyardWaveSection,
  NATIVE_LULL_RELEASE_TO_NEXT_SPAWN_TICKS,
  NATIVE_OPENING_RELEASE_THRESHOLD,
  NATIVE_PAUSE_NODE_GAP_TICKS,
  NATIVE_SOLOMON_OPENING_BURSTS,
  NATIVE_WAVE_LABEL_TO_FIRST_SPAWN_TICKS,
  seedBoneyardWaveRng,
} from './boneyard-wave-timeline.ts'
import { NATIVE_RETAIL_WAVES } from './native-retail-wave-schedule.ts'

test('pins the generated opening and TimeLine node offsets', () => {
  assert.equal(NATIVE_OPENING_RELEASE_THRESHOLD, 4)
  assert.equal(NATIVE_WAVE_LABEL_TO_FIRST_SPAWN_TICKS, 10)
  assert.equal(NATIVE_PAUSE_NODE_GAP_TICKS, 25)
  assert.equal(NATIVE_LULL_RELEASE_TO_NEXT_SPAWN_TICKS, 85)
  assert.deepEqual(NATIVE_SOLOMON_OPENING_BURSTS, [
    {
      afterDelayTicks: 0,
      count: 10,
      entries: [{
        enemy: 'SKELETON',
        flags: ['FLAG_WEAK', 'FLAG_HPDOWN', 'FLAG_XPBONUS'],
      }],
      groupIndex: -1,
      locationPolicy: 'near-player',
      spreadTicks: 0,
      startDelayTicks: 0,
      steady: true,
    },
    {
      afterDelayTicks: 0,
      count: 5,
      entries: [{
        enemy: 'SKELETON',
        flags: ['FLAG_WEAK', 'FLAG_HPDOWN', 'FLAG_XPBONUS'],
      }],
      groupIndex: -1,
      locationPolicy: 'near-player',
      spreadTicks: 400,
      startDelayTicks: 500,
      steady: true,
    },
  ])
})

test('retail SPAWN is a cost budget that expands into larger grouped bursts', () => {
  const wave = NATIVE_RETAIL_WAVES[0]
  const state = seedBoneyardWaveRng('wave-one-compiler-fixture')
  const left = compileBoneyardWaveSection(wave, 1, state)
  const right = compileBoneyardWaveSection(wave, 1, state)
  assert.deepEqual(left, right)
  assert.equal(wave.spawn, 14)
  assert.ok(left.section.bursts.reduce((total, burst) => total + burst.count, 0) > wave.spawn)
  assert.equal(left.section.bursts[0].startDelayTicks, 10)
  assert.ok(left.section.bursts.every((burst) => (
    burst.locationPolicy === 'anywhere'
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
    seedBoneyardWaveRng('single-group-merge'),
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
    seedBoneyardWaveRng('ignored-source-flags'),
  )

  assert.ok(result.section.bursts.length > 0)
  assert.ok(result.section.bursts.every((burst) => (
    burst.entries.every((entry) => (
      entry.flags.length === 1 && entry.flags[0] === 'FLAG_HPUP'
    ))
  )))
})

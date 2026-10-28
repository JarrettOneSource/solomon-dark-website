import assert from 'node:assert/strict'
import test from 'node:test'
import { RunObservation } from './run-observation.mjs'

const frame = (overrides = {}) => ({
  runId: 'run-a', tick: 100, wave: 1, wavePhase: 'spawning',
  seed: '01352a1400000000000000000000000000', sourceSha256: 'scene', geometrySha256: 'geometry',
  health: 100, mana: 80, maximumMana: 80, protected: true,
  castSequence: 1, secondaryCastSequence: 0, secondarySkill: null,
  enemies: [{ id: 1, kind: 'skeleton', nativeTypeId: 1000, spawnTick: 90, x: 10, y: 20 }],
  loot: [], enemyEvents: [{ id: 1, kind: 'enemyspawned', actorId: 1, tick: 90 }], lootEvents: [],
  ...overrides,
})

test('retains first observations once across repeated snapshots and a saved continuation', () => {
  const trace = new RunObservation()
  trace.accept(frame())
  trace.accept(frame({ tick: 101 }))
  trace.accept(frame({ tick: 104, enemies: [], loot: [{ id: 1, kind: 'gold', amount: 3, spawnTick: 103 }],
    lootEvents: [{ id: 1, kind: 'lootdropsound', actorId: 1, tick: 103 }] }))
  trace.accept(frame({ tick: 104, enemies: [], loot: [{ id: 1, kind: 'gold', amount: 3, spawnTick: 103 }],
    lootEvents: [{ id: 1, kind: 'lootdropsound', actorId: 1, tick: 103 }] }))
  assert.equal(trace.runs[0].enemies.length, 1)
  assert.equal(trace.runs[0].loot.length, 1)
  assert.equal(trace.runs[0].enemies[0].observedTick, 100)
  assert.deepEqual(trace.runs[0].eventGaps, [])
})

test('retains a new pickup when the authority reuses its finite world ID', () => {
  const trace = new RunObservation()
  trace.accept(frame({ loot: [{ id: 1, kind: 'gold', spawnTick: 95 }] }))
  trace.accept(frame({ tick: 105, loot: [] }))
  trace.accept(frame({ tick: 110, loot: [{ id: 1, kind: 'orb', spawnTick: 109 }] }))
  assert.deepEqual(trace.runs[0].loot.map(row => [row.kind, row.spawnTick]), [
    ['gold', 95], ['orb', 109],
  ])
})

test('records Boneyard identity when its admitted metadata follows the first snapshot', () => {
  const trace = new RunObservation()
  trace.accept(frame({ seed: undefined, sourceSha256: undefined, geometrySha256: undefined }))
  trace.accept(frame({ tick: 101 }))
  assert.equal(trace.runs[0].seed, frame().seed)
  assert.equal(trace.runs[0].sourceSha256, 'scene')
  assert.equal(trace.runs[0].geometrySha256, 'geometry')
})

test('records missing event intervals instead of presenting a complete trace', () => {
  const trace = new RunObservation()
  trace.accept(frame())
  trace.accept(frame({ tick: 150, enemyEvents: [{ id: 4, kind: 'enemyspawned', actorId: 2, tick: 148 }] }))
  assert.deepEqual(trace.runs[0].eventGaps, [{ lane: 'enemy', after: 1, before: 4, observedTick: 150 }])
})

test('counts accepted ability sequences and separates independent runs', () => {
  const trace = new RunObservation()
  trace.accept(frame())
  trace.accept(frame({ tick: 120, wave: 2, castSequence: 4, secondaryCastSequence: 1, secondarySkill: 'ringoffire' }))
  trace.accept(frame({ tick: 130, wave: 2, castSequence: 4, secondaryCastSequence: 1, secondarySkill: 'ringoffire' }))
  trace.accept(frame({ tick: 140, wave: 2, castSequence: 5, secondaryCastSequence: 3, secondarySkill: 'teleport' }))
  trace.accept(frame({ runId: 'run-b', seed: 'other' }))
  assert.equal(trace.runs.length, 2)
  assert.equal(trace.runs[0].maximumPrimarySequence, 5)
  assert.equal(trace.runs[0].maximumSecondarySequence, 3)
  assert.equal(trace.runs[0].unobservedSecondaryCasts, 1)
  assert.deepEqual(trace.runs[0].secondaryCasts.map(row => row.skill), ['ringoffire', 'teleport'])
  assert.deepEqual(trace.runs[0].waves.map(row => row.wave), [1, 2])
  assert.equal(trace.runs[1].enemies.length, 1)
})

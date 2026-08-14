import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_ENEMY_ACTION_PROGRAMS,
  NATIVE_ENEMY_DEATH_PROGRAMS,
  nativeEnemyActionFrame,
  nativeEnemyIdleAnimationSample,
} from './native-enemy-animation.ts'

test('stock Skeleton, Archer, and Mage selectors are recorded exactly', () => {
  assert.deepEqual(
    NATIVE_ENEMY_ACTION_PROGRAMS['skeleton-claw-a'].frames,
    [4, 5, 6, 7, 8, 9, 10, 11],
  )
  assert.deepEqual(
    NATIVE_ENEMY_ACTION_PROGRAMS['skeleton-claw-b'].frames,
    [2, 3, 4, 5, 6, 7, 8, 9],
  )
  assert.deepEqual(
    NATIVE_ENEMY_ACTION_PROGRAMS['skeleton-weapon'].frames,
    [1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1],
  )
  assert.deepEqual(
    NATIVE_ENEMY_ACTION_PROGRAMS['skeleton-pike'].frames,
    [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  )
  assert.deepEqual(
    NATIVE_ENEMY_ACTION_PROGRAMS['archer-shot'].frames,
    [3, 4, 5, 6, 7, 6, 7, 6, 7, 6, 7, 6, 7, 8, 8, 8, 8],
  )
  assert.equal(NATIVE_ENEMY_ACTION_PROGRAMS['mage-cast-short'].frames.length, 42)
  assert.equal(NATIVE_ENEMY_ACTION_PROGRAMS['mage-cast-long'].frames.length, 48)
})

test('native strict completion boundaries do not complete on equality', () => {
  for (const name of [
    'skeleton-claw-a',
    'skeleton-claw-b',
    'skeleton-weapon',
    'skeleton-pike',
    'archer-shot',
    'mage-cast-short',
    'mage-cast-long',
  ] as const) {
    const end = NATIVE_ENEMY_ACTION_PROGRAMS[name].strictEnd
    assert.equal(nativeEnemyActionFrame(name, end).complete, false, name)
    assert.equal(nativeEnemyActionFrame(name, end + Number.EPSILON * Math.max(1, end)).complete, true, name)
  }
})

test('stock fixed-tick rates reproduce the recovered nominal marker and end ticks', () => {
  const nominalTicks = {
    'skeleton-claw-a': { end: 57, marker: 32 },
    'skeleton-weapon': { end: 97, marker: 36 },
    'skeleton-pike': { end: 97, marker: 16 },
    'archer-shot': { end: 190, marker: 155 },
  } as const
  for (const [name, ticks] of Object.entries(nominalTicks) as [
    keyof typeof nominalTicks,
    { end: number; marker: number },
  ][]) {
    const program = NATIVE_ENEMY_ACTION_PROGRAMS[name]
    assert.ok((ticks.marker - 1) * program.progressPerTick < program.eventMarkers[0])
    assert.ok(ticks.marker * program.progressPerTick >= program.eventMarkers[0])
    assert.ok((ticks.end - 1) * program.progressPerTick <= program.strictEnd)
    assert.ok(ticks.end * program.progressPerTick > program.strictEnd)
  }
  assert.deepEqual(NATIVE_ENEMY_ACTION_PROGRAMS['mage-cast-short'].rateFactors, [
    'one-plus-cast-roll',
    'attack-speed',
  ])
})

test('event markers and terminal selectors remain sampled after completion', () => {
  const before = nativeEnemyActionFrame('archer-shot', 12.999)
  const marker = nativeEnemyActionFrame('archer-shot', 13)
  const complete = nativeEnemyActionFrame('archer-shot', 17)

  assert.deepEqual(before.eventMarkersReached, [])
  assert.deepEqual(marker.eventMarkersReached, [13])
  assert.equal(marker.selector, 8)
  assert.equal(complete.selector, 8)
  assert.equal(complete.complete, true)
})

test('unresolved family programs are explicitly bounded web programs', () => {
  for (const name of [
    'imp-contact',
    'zombie-swipe',
    'wraith-drain',
    'demon-claw',
    'demon-bomb',
    'coffin-open',
    'maggot-bite',
  ] as const) {
    const program = NATIVE_ENEMY_ACTION_PROGRAMS[name]
    assert.equal(program.provenance, 'bounded-web')
    assert.equal(nativeEnemyActionFrame(name, program.strictEnd).complete, false)
    assert.equal(nativeEnemyActionFrame(name, program.strictEnd + 1).complete, true)
  }
})

test('every family death has a named bounded terminal program', () => {
  assert.deepEqual(
    Object.values(NATIVE_ENEMY_DEATH_PROGRAMS).map((program) => program.name),
    [
      'skeleton-shatter',
      'archer-shatter',
      'mage-shatter',
      'imp-split',
      'zombie-collapse',
      'wraith-dissolve',
      'demon-split',
      'coffin-break',
    ],
  )
  assert.ok(Object.values(NATIVE_ENEMY_DEATH_PROGRAMS).every((program) => (
    program.provenance === 'bounded-web' && program.durationTicks > 0
  )))
  assert.equal(NATIVE_ENEMY_DEATH_PROGRAMS.SKELETON.bodyRemovedAtTick, 0)
  assert.equal(NATIVE_ENEMY_DEATH_PROGRAMS.ZOMBIE.bodyRemovedAtTick, null)
})

test('renderer animation samples have stable authoritative defaults', () => {
  const sample = nativeEnemyIdleAnimationSample({
    alpha: 0.5,
    state: 'locomotion',
  })
  assert.equal(sample.alpha, 0.5)
  assert.equal(sample.state, 'locomotion')
  assert.equal(sample.gaitPose, 0)
  assert.equal(sample.action, null)
  assert.equal(sample.deathEpoch, 0)
  assert.deepEqual(sample.effects, [])
  assert.deepEqual(sample.maggots, [])
})

test('invalid action clocks fail closed', () => {
  assert.throws(() => nativeEnemyActionFrame('imp-contact', -1), /finite and non-negative/)
  assert.throws(() => nativeEnemyActionFrame('imp-contact', Number.NaN), /finite and non-negative/)
})

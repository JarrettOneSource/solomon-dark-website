import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import {
  NATIVE_PORTAL_ACTOR_PROGRAM,
  NATIVE_PORTAL_FREQUENCY_PRESETS,
  NATIVE_PORTAL_PROGRAM_BY_SOURCE_SHA256,
  createNativePortalState,
  nativePortalChildPosition,
  nativePortalCollisionRadius,
  nativePortalProgram,
  nativePortalRecipe,
  stepNativePortalState,
} from './native-survival-portal.ts'

test('drains every generated Deep Portal recipe, script, and trigger row', () => {
  const entries = Object.entries(NATIVE_PORTAL_PROGRAM_BY_SOURCE_SHA256)
  assert.equal(entries.length, 12)
  assert.equal(
    entries.reduce((total, [, program]) => total + program.phases.length, 0),
    80,
  )
  assert.equal(
    entries.filter(([, program]) => program.phases[0]?.name === 'Deep Portal').length,
    8,
  )
  assert.equal(
    createHash('sha256').update(JSON.stringify(entries)).digest('hex'),
    '9cc23e2bf95af4779ce835c4199ab018483aa0259f046c8c067a94f3db9ea7f9',
  )

  const first = nativePortalProgram(
    '9e9e1bccd99babf99e190ae4acdae98d1fea2f782b60ba6d45a6b9eae6afe2d9',
  )
  assert.equal(first.timelineUid, 36_773)
  assert.deepEqual(first.phases.map(({ name, startWave, spawnCount }) => ({
    name,
    spawnCount,
    startWave,
  })), [
    { name: 'Deep Portal', spawnCount: 3, startWave: 24 },
    { name: 'Deep Portal 2', spawnCount: 6, startWave: 41 },
    { name: 'Deep Portal 3', spawnCount: 5, startWave: 50 },
    { name: 'Deep Portal 4', spawnCount: 8, startWave: 57 },
    { name: 'Deep Portal 5', spawnCount: 7, startWave: 66 },
    { name: 'Deep Portal 6', spawnCount: 9, startWave: 75 },
    { name: 'Deep Portal 7', spawnCount: 12, startWave: 81 },
  ])
  assert.throws(
    () => nativePortalProgram('0'.repeat(64)),
    /has no extracted Deep Portal program/,
  )
})

test('retains all six Portal frequency presets as exact fixed-tick ranges', () => {
  assert.deepEqual(NATIVE_PORTAL_FREQUENCY_PRESETS, [
    { label: 'VERY LOW', lowerTicks: 800, upperTicks: 1_000 },
    { label: 'LOW', lowerTicks: 600, upperTicks: 800 },
    { label: 'NORMAL', lowerTicks: 300, upperTicks: 400 },
    { label: 'HIGH', lowerTicks: 200, upperTicks: 300 },
    { label: 'VERY HIGH', lowerTicks: 100, upperTicks: 200 },
    { label: 'YOU WILL DIE', lowerTicks: 25, upperTicks: 50 },
  ])
})

test('materializes for ten ticks, opens at radius five, and ejects an Imp', () => {
  const constructionDraws = draws([0.5, 0])
  let state = createNativePortalState(5, constructionDraws)
  assert.equal(state.fixedScale, 1.5)
  assert.equal(state.ticksUntilEjection, 450)
  assert.equal(nativePortalCollisionRadius(state), 45)

  for (let tick = 1; tick <= 10; tick += 1) {
    const stepped = stepNativePortalState(state, 5, constructionDraws)
    state = stepped.state
    assert.equal(stepped.opened, tick === 10)
    assert.equal(stepped.ejection, null)
  }
  assert.equal(nativePortalCollisionRadius(state), 5)

  const ejected = stepNativePortalState(
    { ...state, ticksUntilEjection: 1 },
    5,
    draws([0, 0, 0.25, 0.5, 0, 0]),
  )
  assert.deepEqual(ejected.ejection, {
    childHeadingDeg: 90,
    verticalVelocity: -12.5,
  })
  assert.equal(ejected.state.alpha, Math.fround(0.025))
  assert.equal(ejected.state.bodyPhase, Math.fround(0.15))
  assert.equal(ejected.state.auraPhase, Math.fround(0.05))
  assert.equal(ejected.state.ticksUntilEjection, 25)
})

test('uses Portal-facing clearance plus the child radial ejection root', () => {
  assert.deepEqual(
    nativePortalChildPosition({ x: 100, y: 100 }, 0, 90, 10),
    { x: 130, y: 85 },
  )
  assert.equal(NATIVE_PORTAL_ACTOR_PROGRAM.childInitialHorizontalSpeed, 6.75)
  assert.equal(NATIVE_PORTAL_ACTOR_PROGRAM.childVerticalOffset, -0.1)
})

test('one-in-eight fast reset retains the native zero-tick endpoint', () => {
  let state = createNativePortalState(5, draws([0, 0]))
  for (let tick = 0; tick < 10; tick += 1) {
    state = stepNativePortalState(state, 5, draws([])).state
  }
  const reset = stepNativePortalState(
    { ...state, ticksUntilEjection: 1 },
    5,
    draws([0, 0, 0, 0, 1, 0.2, 0]),
  )
  assert.ok(reset.ejection)
  assert.equal(reset.state.ticksUntilEjection, 0)
  assert.doesNotThrow(() => stepNativePortalState(
    reset.state,
    5,
    draws([0, 0, 0, 0, 0, 0]),
  ))
})

test('builds the authored Portal boss recipe from its generated phase row', () => {
  const phase = nativePortalProgram(
    '9e9e1bccd99babf99e190ae4acdae98d1fea2f782b60ba6d45a6b9eae6afe2d9',
  ).phases[0]!
  assert.deepEqual(nativePortalRecipe(phase), {
    archerAccuracyMode: 0,
    attackSpeed: 1,
    chaseSpeed: 1,
    classification: 'multiple-boss',
    experience: phase.maximumHealth * 2,
    extraDamage: 0,
    family: { frequency: 3, kind: 'portal' },
    lootPolicies: {
      gold: 4,
      item: 4,
      orb: 4,
      potion: 0,
      powerup: 4,
      specificItem: 4,
    },
    maximumHealth: phase.maximumHealth,
    movementScale: 1,
    name: 'Deep Portal',
    onDeathProgram: null,
    primaryDamage: 2,
    secondaryDamage: 0,
    tertiaryDamage: 0,
    uid: phase.recipeUid,
  })
})

function draws(values: readonly number[]): () => number {
  let index = 0
  return () => {
    const value = values[index]
    assert.notEqual(value, undefined, `missing deterministic draw ${index}`)
    index += 1
    return value!
  }
}

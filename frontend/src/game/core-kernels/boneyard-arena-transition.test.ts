import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BONEYARD_ARENA_SEAL_TICKS,
  boneyardArenaTransitionSafetyClear,
  boneyardActiveBounds,
  createBoneyardArenaTransition,
  startBoneyardArenaTransition,
  stepBoneyardArenaTransition,
} from './boneyard-arena-transition.ts'

test('derives the exact generated south and north combat rectangles', () => {
  const south = createBoneyardArenaTransition(
    { x: 0, y: 0, w: 2339.889892578125, h: 3460.110107421875 },
    { x: 1323.68310546875, y: 3310.110107421875 },
  )
  assert.deepEqual(south.combatBounds, {
    x: 0,
    y: 0,
    w: 2339.889892578125,
    h: 3060.110107421875,
  })
  assert.equal(south.entrySide, 'south')

  const north = createBoneyardArenaTransition(
    { x: 0, y: 0, w: 3674.89013671875, h: 2125.10986328125 },
    { x: 1258.9234619140625, y: 150 },
  )
  assert.deepEqual(north.combatBounds, {
    x: 0,
    y: 375,
    w: 3674.89013671875,
    h: 1725.10986328125,
  })
  assert.equal(north.entrySide, 'north')
})

test('starts the native recursive camera lock and seals exactly after four seconds', () => {
  const created = createBoneyardArenaTransition(
    { x: 0, y: 0, w: 3674.89013671875, h: 2125.10986328125 },
    { x: 1258.9234619140625, y: 150 },
  )
  const started = startBoneyardArenaTransition(created)
  assert.equal(started.phase, 'locking')
  assert.equal(started.blendFactor, Math.fround(0.01))
  assert.equal(started.sealTicksRemaining, BONEYARD_ARENA_SEAL_TICKS)
  assert.deepEqual(started.cameraBounds, created.fullBounds)
  assert.deepEqual(boneyardActiveBounds(started), created.combatBounds)

  const first = stepBoneyardArenaTransition(started)
  assert.equal(first.cameraBounds.y, Math.fround(3.75))
  assert.equal(first.cameraBounds.h, Math.fround(2121.10986328125))
  assert.equal(first.blendFactor, Math.fround(Math.fround(0.01) * 1.01))
  assert.equal(first.sealTicksRemaining, BONEYARD_ARENA_SEAL_TICKS - 1)

  let state = first
  for (let tick = 1; tick < BONEYARD_ARENA_SEAL_TICKS; tick += 1) {
    state = stepBoneyardArenaTransition(state)
  }
  assert.equal(state.phase, 'sealed')
  assert.equal(state.sealTicksRemaining, 0)
  assert.ok(state.blendFactor <= 1)
  assert.ok(state.cameraBounds.y > created.fullBounds.y)
  assert.ok(state.cameraBounds.y <= created.combatBounds.y)
})

test('the open phase preserves full movement while a repeated start is idempotent', () => {
  const created = createBoneyardArenaTransition(
    { x: 10, y: 20, w: 1200, h: 1400 },
    { x: 600, y: 1270 },
  )
  assert.equal(created.phase, 'open')
  assert.deepEqual(boneyardActiveBounds(created), created.fullBounds)
  const started = startBoneyardArenaTransition(created)
  assert.equal(startBoneyardArenaTransition(started), started)
})

test('generated lock safety requires every complete live circle inside combat bounds', () => {
  const bounds = { x: 0, y: 0, w: 200, h: 120 }

  assert.equal(boneyardArenaTransitionSafetyClear(bounds, [
    { position: { x: 20, y: 20 }, radius: 20 },
    { position: { x: 180, y: 100 }, radius: 20 },
  ]), true, 'circle contact with the inside edge remains safe')
  assert.equal(boneyardArenaTransitionSafetyClear(bounds, [
    { position: { x: 20, y: 20 }, radius: 20.001 },
  ]), false, 'a fractional radius beyond the edge must hold the lock open')
  assert.equal(boneyardArenaTransitionSafetyClear(bounds, [
    { position: { x: 100, y: 121 }, radius: 1 },
  ]), false)
  assert.equal(boneyardArenaTransitionSafetyClear(bounds, []), true)
})

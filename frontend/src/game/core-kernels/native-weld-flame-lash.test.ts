import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createNativeWeldFlameLashFade,
  stepNativeWeldFlameLashFade,
} from './native-weld-flame-lash.ts'
import { createNativeRng, drawNativeFloat } from './native-rng.ts'

test('Flame Lash endpoint fade consumes its complete six-word native program', () => {
  const sourceRng = createNativeRng(903)
  const result = createNativeWeldFlameLashFade({
    direction: { x: 1, y: 0 },
    id: 8,
    origin: { x: 100, y: 200 },
    ownerId: 'wizard',
    rng: sourceRng,
    tick: 4,
    variant: 'endpoint',
    vector: [8, 2, 1, 0.8, 0, 0, 0, 0],
    worldKey: 'boneyard:1',
  })
  let expected = drawNativeFloat(sourceRng, 360).state
  expected = drawNativeFloat(expected, 360).state
  expected = drawNativeFloat(expected, Math.fround(0.5)).state
  expected = drawNativeFloat(expected, 10).state
  expected = drawNativeFloat(expected, Math.fround(0.5)).state
  expected = drawNativeFloat(expected, Math.fround(0.75)).state
  assert.deepEqual(result.rng, expected)
  assert.equal(result.actor.record, 35)
  assert.ok(result.actor.colorGreen >= 0.5 && result.actor.colorGreen <= 1)
  assert.ok(result.actor.baseScale >= 0.5 && result.actor.baseScale < 1)
  assert.ok(result.actor.wrapperScalar >= 0.75 && result.actor.wrapperScalar < 1.5)
})

test('Flame Lash chain fade uses fixed orange, one-tenth scale, and native .2 loss', () => {
  const sourceRng = createNativeRng(904)
  const result = createNativeWeldFlameLashFade({
    direction: { x: 0, y: -1 },
    id: 9,
    origin: { x: 10, y: 20 },
    ownerId: 'wizard',
    rng: sourceRng,
    tick: 4,
    variant: 'chain',
    vector: [8, 2, 1, 0.8, 0, 0, 0, 0],
    worldKey: 'boneyard:1',
  })
  let expected = drawNativeFloat(sourceRng, 360).state
  expected = drawNativeFloat(expected, 360).state
  expected = drawNativeFloat(expected, 10).state
  expected = drawNativeFloat(expected, Math.fround(0.5)).state
  expected = drawNativeFloat(expected, Math.fround(0.75)).state
  assert.deepEqual(result.rng, expected)
  assert.equal(result.actor.colorGreen, Math.fround(0.75))
  assert.ok(result.actor.baseScale >= 0.05 && result.actor.baseScale < 0.1)

  let actor = result.actor
  for (let age = 1; age <= 5; age += 1) {
    const stepped = stepNativeWeldFlameLashFade(actor)
    assert.ok(stepped)
    if (!stepped) break
    actor = stepped
  }
  assert.equal(stepNativeWeldFlameLashFade(actor), null)
})

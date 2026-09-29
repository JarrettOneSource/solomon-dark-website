import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createNativeWeldFlameLashFade,
  stepNativeWeldFlameLashFade,
} from './native-weld-flame-lash.ts'
import { createNativeRng, drawNativeFloat } from './native-rng.ts'

test('the first-link Flame Lash source flare has its distinct .1/.4 fade and final overwritten scale', () => {
  const base = { direction: { x: 0, y: -1 }, id: 4, origin: { x: 100, y: 200 }, ownerId: 'wizard',
    rng: createNativeRng(42), tick: 5, variant: 'source' as const,
    vector: [8, 2, 1, .8, 0, 0, 0, 0], worldKey: 'boneyard:1' }
  const on = createNativeWeldFlameLashFade({ ...base, enhancedEffects: true })
  const off = createNativeWeldFlameLashFade({ ...base, enhancedEffects: false })
  assert.deepEqual(on.rng, off.rng)
  assert.deepEqual({ ...on.actor, alphaStep: Math.fround(.4) }, off.actor)
  assert.equal(on.actor.alpha, .5)
  assert.equal(on.actor.alphaStep, Math.fround(.1))
  assert.equal(on.actor.colorGreen, 1)
  assert.ok(on.actor.baseScale >= .75 && on.actor.baseScale <= 1.25)
  assert.ok(Math.hypot(on.actor.position.x - base.origin.x, on.actor.position.y - base.origin.y) <= 15.0001)
  for (const birth of [on.actor, off.actor]) {
    let actor: typeof birth | null = birth
    let lifetime = 0
    while (actor) { lifetime++; actor = stepNativeWeldFlameLashFade(actor) }
    assert.equal(lifetime, birth === on.actor ? 6 : 2)
  }
})

test('Enhanced Effects Off latches native contact decay without changing Flame Lash birth draws', () => {
  for (const variant of ['endpoint', 'chain'] as const) {
    for (const alpha of [.5, 1]) {
      const input = { alpha, direction: { x: 1, y: 0 }, id: 12,
        origin: { x: 100, y: 200 }, ownerId: 'wizard', rng: createNativeRng(771),
        tick: 31, variant, vector: [8, 2, 1, .8, 0, 0, 0, 0], worldKey: 'boneyard:1' }
      const on = createNativeWeldFlameLashFade({ ...input, enhancedEffects: true })
      const off = createNativeWeldFlameLashFade({ ...input, enhancedEffects: false })
      assert.deepEqual(off.rng, on.rng)
      assert.deepEqual(off.actor, { ...on.actor, alphaStep: Math.fround(.4) })
      let current: typeof off.actor | null = off.actor
      let ages = 0
      while (current) {
        ages++
        assert.equal(current.alphaStep, Math.fround(.4))
        current = stepNativeWeldFlameLashFade(current)
      }
      assert.equal(ages, alpha === 1 ? 3 : 2)
    }
  }
})

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

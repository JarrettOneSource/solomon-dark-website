import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { createHeartmongerTendrils, heartmongerTendrilLayers, moveHeartmongerTendrils } from './native-heartmonger-tendrils.ts'

test('Heartmonger creates the two native chains from one continuing eleven-point walk', () => {
  const created = createHeartmongerTendrils({ x: 10, y: 20 }, 180, createNativeRng(7))
  assert.deepEqual(created.state.chains.map(({ points }) => points.length), [7, 4])
  const [first, second] = created.state.chains
  assert.deepEqual(first!.points[0], { x: 10, y: 20 })
  assert.ok(second!.points[0]!.y < first!.points[6]!.y - 21)
  assert.ok(second!.points[0]!.y > first!.points[6]!.y - 29)
  for (const chain of created.state.chains) {
    assert.equal(chain.lengths.length, chain.points.length - 1)
    for (const length of chain.lengths) assert.ok(length >= 21 && length <= 29)
  }
})

test('tendrils reanchor only on a new integer leg pose and preserve every authored segment length', () => {
  const created = createHeartmongerTendrils({ x: 0, y: 0 }, 90, createNativeRng(5)).state
  const anchors = [{ x: -2, y: 8 }, { x: 7, y: 11 }]
  const first = moveHeartmongerTendrils(created, 0.2, { x: 10, y: 20 }, anchors)
  assert.deepEqual(first.chains.map(({ points }) => points[0]), [{ x: 8, y: 28 }, { x: 17, y: 31 }])
  assert.equal(moveHeartmongerTendrils(first, .9, { x: 200, y: 400 }, anchors), first)
  const moved = moveHeartmongerTendrils(first, 1, { x: 200, y: 400 }, anchors)
  for (const [index, chain] of moved.chains.entries()) {
    assert.deepEqual(chain.lengths, created.chains[index]!.lengths)
    for (let point = 1; point < chain.points.length; point += 1) {
      const before = chain.points[point - 1]!
      const after = chain.points[point]!
      assert.ok(Math.abs(Math.hypot(after.x - before.x, after.y - before.y) - chain.lengths[point - 1]!) < .0001)
    }
  }
})

test('tendril art uses nine unscaled BadGuys glyphs and a preceding shadow pass at three times the first light direction', () => {
  const state = createHeartmongerTendrils({ x: 10, y: 20 }, 90, createNativeRng(3)).state
  const layers = heartmongerTendrilLayers(state, { x: 10, y: 20 }, { x: .6, y: .8 })
  assert.equal(layers.length, 18)
  assert.ok(layers.every(({ atlas, entry, scale }) => atlas === 'BadGuys' && entry === 19 && scale === 1))
  for (let index = 0; index < 9; index += 1) {
    const shadow = layers[index]!
    const actual = layers[index + 9]!
    assert.equal(shadow.tint, 0)
    assert.equal(actual.tint, 0xffffff)
    assert.ok(Math.abs(shadow.offset.x - actual.offset.x - 1.8) < .00001)
    assert.ok(Math.abs(shadow.offset.y - actual.offset.y - 2.4) < .00001)
    assert.equal(shadow.rotationRadians, actual.rotationRadians)
  }
})

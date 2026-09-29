import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeRng, drawNativeFloat, drawNativeInteger } from './native-rng.ts'
import { createNativeStoneskinWarp, nativeStoneskinGeometry } from './native-stoneskin.ts'

test('Stoneskin retains the exact 100-vertex birth draw program including the unused color-bank draws', () => {
  for (const seed of [0, 31, 741]) {
    const source = createNativeRng(seed)
    const saved = structuredClone(source)
    const warp = createNativeStoneskinWarp(source)
    let rng = source
    for (let vertex = 0; vertex < 100; vertex++) {
      const grey = drawNativeInteger(rng, 3)
      rng = grey.state
      if (grey.value === 1) rng = drawNativeFloat(rng, .5).state
      const radius = drawNativeFloat(rng, 4)
      const heading = drawNativeFloat(radius.state, 360)
      rng = heading.state
      const x = Math.floor(vertex / 10)
      const y = vertex % 10
      const baseX = Math.fround(Math.fround(x * Math.fround(12.8)) - 64)
      const baseY = Math.fround(Math.fround(y * Math.fround(12.8)) - 64)
      const dx = warp.positions[vertex * 2]! - baseX
      const dy = warp.positions[vertex * 2 + 1]! - baseY
      assert.ok(Math.abs(Math.hypot(dx, dy) - radius.value) < .00001)
      assert.equal(warp.positions[vertex * 2], Math.fround(warp.positions[vertex * 2]!))
      assert.equal(warp.positions[vertex * 2 + 1], Math.fround(warp.positions[vertex * 2 + 1]!))
    }
    assert.deepEqual(warp.rng, rng)
    assert.deepEqual(source, saved)
    assert.deepEqual(createNativeStoneskinWarp(source), warp)
    assert.notDeepEqual(createNativeStoneskinWarp(warp.rng).positions, warp.positions)
  }
})

test('live Stoneskin quality selects native warped grid or whole capture quad without mutating birth state', () => {
  const warp = createNativeStoneskinWarp(createNativeRng(881))
  const before = structuredClone(warp)
  const on = nativeStoneskinGeometry(warp.positions, true)
  const off = nativeStoneskinGeometry(warp.positions, false)
  assert.equal(on.positions.length, 200)
  assert.equal(on.uvs.length, 200)
  assert.equal(on.indices.length, 486)
  assert.deepEqual([...on.positions], warp.positions)
  assert.deepEqual([...on.uvs.slice(0, 4)], [.25, .25, .25, Math.fround(.25 + Math.fround(.05))])
  assert.deepEqual([...off.positions], [-128, -128, 128, -128, -128, 128, 128, 128])
  assert.deepEqual([...off.uvs], [0, 0, 1, 0, 0, 1, 1, 1])
  assert.deepEqual([...off.indices], [0, 1, 2, 2, 1, 3])
  assert.deepEqual(nativeStoneskinGeometry(warp.positions, true), on)
  assert.deepEqual(warp, before)
  assert.throws(() => nativeStoneskinGeometry([], false), /Stoneskin grid/)
})

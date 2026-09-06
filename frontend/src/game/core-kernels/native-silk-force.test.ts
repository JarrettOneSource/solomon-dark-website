import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeRng } from './native-rng.ts'
import { createNativeSilk } from './native-silk.ts'
import { createNativeSilkFragments, stepNativeFadeLine } from './native-silk-force.ts'

test('Silk force fragments consume the full visible trail, use the supplied force direction, and skip darkness without draws', () => {
  const source = createNativeSilk({ x: 100, y: 200 }, {
    position: { x: 100, y: 600 }, velocityPerTick: { x: 0, y: 0 },
  }, 10, createNativeRng(5)).state
  const silk = { ...source, phase: 18 }
  const rng = createNativeRng(76)
  const darkness = createNativeSilkFragments(silk, { x: 1, y: 0 }, () => 0, rng)
  assert.deepEqual(darkness.fragments, [])
  assert.deepEqual(darkness.rngState, rng)
  const created = createNativeSilkFragments(silk, { x: 1, y: 0 }, () => 1, rng)
  // The float32 cursor remains just above the lower bound after five steps.
  assert.equal(created.fragments.length, 6)
  for (const line of created.fragments) {
    assert.ok(line.opacity >= 0.33249 && line.opacity <= 0.52501)
    assert.ok(line.opacityLossPerTick >= 0.01499 && line.opacityLossPerTick <= 0.02001)
    assert.ok(line.velocity.x >= 0)
    assert.ok(Math.abs(line.velocity.y) <= line.velocity.x * Math.tan(5 * Math.PI / 180) + 0.00001)
    const next = stepNativeFadeLine(line)!
    assert.equal(next.start.x, Math.fround(line.start.x + line.velocity.x))
    assert.equal(next.middle.y, Math.fround(line.middle.y + line.velocity.y))
    assert.deepEqual(next.velocity, line.velocity)
    assert.equal(next.opacity, Math.fround(line.opacity - line.opacityLossPerTick))
    assert.equal(stepNativeFadeLine({ ...line, opacity: line.opacityLossPerTick }), null)
  }
})

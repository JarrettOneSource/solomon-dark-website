import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeGuidedMissile, stepNativeGuidedMissile } from './native-guided-missile.ts'
import { createNativeRng } from './native-rng.ts'

test('GuidedMissile moves along its current heading before steering toward the live target', () => {
  const created = createNativeGuidedMissile(createNativeRng(10), { x: 0, y: 0 }, 0, 1.5)
  const source = { ...created.state, turnRate: .5 }
  const moved = stepNativeGuidedMissile(source, { x: 100, y: 0 }, 1)
  assert.deepEqual(moved.state.position, { x: 0, y: -4.5 })
  assert.equal(moved.state.headingDeg, .5)
  assert.deepEqual(moved.terrainProbe, { x: 0, y: -27 })
  assert.equal(moved.state.speed, Math.fround(4.5 - .07500000298023224))
  assert.equal(moved.state.remainingTicks, 1999)
  assert.equal(moved.state.phaseDeg, Math.fround(source.phaseDeg + 27))
})

test('GuidedMissile retains its heading after target loss, observes fractional clocks, and stops at its speed floor', () => {
  const created = createNativeGuidedMissile(createNativeRng(81), { x: 0, y: 0 }, 90, 1)
  let source = created.state
  const stopped = stepNativeGuidedMissile(source, { x: -100, y: 20 }, 0)
  assert.deepEqual(stopped.state, source)
  let elapsed = 0
  while (elapsed < 2000) {
    source = stepNativeGuidedMissile(source, null, .5).state
    elapsed += .5
    assert.equal(source.headingDeg, 90)
    assert.ok(source.speed >= source.minimumSpeed)
  }
  assert.equal(source.remainingTicks, 0)
  assert.equal(source.speed, source.minimumSpeed)
  assert.ok(source.position.x > 1500)
})

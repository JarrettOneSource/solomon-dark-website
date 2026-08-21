import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
} from './native-rng.ts'
import {
  NATIVE_WELD_BOULDER_DEBRIS_LIFETIME_TICKS,
  createNativeWeldEtherealBoulderWeakDebrisProgram,
} from './native-weld-boulder-debris.ts'

test('weak EBoulder debris preserves native count, macro redraw, and field order', () => {
  const source = createNativeRng(71)
  const scale = 1
  const program = createNativeWeldEtherealBoulderWeakDebrisProgram({
    direction: { x: 1, y: 0 },
    rng: source,
    scale,
  })
  assert.equal(program.debris.length, 30)
  assert.equal(NATIVE_WELD_BOULDER_DEBRIS_LIFETIME_TICKS, 80)

  let expected = drawNativeFloat(source, 360).state
  let scaleRedraws = 0
  for (let index = 0; index < 30; index += 1) {
    expected = drawNativeFloat(expected, 3).state
    expected = drawNativeFloat(expected, 20).state
    expected = drawNativeFloat(expected, 360).state
    expected = drawNativeFloat(expected, 10).state
    expected = drawNativeFloat(expected, Math.fround(0.5)).state
    expected = drawNativeInteger(expected, 3).state
    expected = drawNativeFloat(expected, Math.fround(1.5)).state
    expected = drawNativeFloat(expected, 50).state
    expected = drawNativeFloat(expected, 40).state
    const comparison = drawNativeFloat(expected, Math.fround(0.75))
    expected = comparison.state
    if (Math.fround(comparison.value + 0.5) >= Math.fround(0.45)) {
      expected = drawNativeFloat(expected, Math.fround(0.75)).state
      scaleRedraws += 1
    }
    expected = drawNativeFloat(expected, Math.fround(1.5)).state
    expected = drawNativeFloat(expected, Math.fround(4), true).state
  }
  assert.equal(scaleRedraws, 30)
  assert.deepEqual(program.rng, expected)
  assert.ok(program.debris.every(({ alpha, record, scale: visualScale }) => (
    alpha === 2
    && record >= 2008 && record <= 2010
    && visualScale > 0
    && visualScale <= Math.fround(0.75 * 0.75)
  )))
})

test('weak EBoulder debris uses the eight-piece floor and forward spawn socket', () => {
  const program = createNativeWeldEtherealBoulderWeakDebrisProgram({
    direction: { x: 0, y: -1 },
    rng: createNativeRng(9),
    scale: Math.fround(0.2),
  })
  assert.equal(program.debris.length, 8)
  assert.ok(program.debris.every(({ position }) => position.y < 0))
})

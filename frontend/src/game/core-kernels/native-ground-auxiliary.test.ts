import assert from 'node:assert/strict'
import test from 'node:test'
import {
  nativeCompactSurfaceContains,
  nativePlayerGroundGlyph,
  nativeNpcGroundGlyph,
  nativeStudentGroundGlyph,
} from './native-ground-auxiliary.ts'

const PLAYER = {
  position: { x: 100, y: 200 },
  headingDegrees: 0,
  scale: 1,
  lifeState: 'alive' as const,
  deathTick: 0,
  corpseConsumed: false,
}

test('ordinary and special player glyphs retain native offset, scale and opacity', () => {
  assert.deepEqual(nativePlayerGroundGlyph(PLAYER, false), {
    position: { x: 100, y: 205 }, scaleX: 1.25, scaleY: 1.25, alpha: 1,
  })
  assert.deepEqual(nativePlayerGroundGlyph(PLAYER, true), {
    position: { x: 100, y: 202 }, scaleX: 1.2000000476837158,
    scaleY: 1.2000000476837158, alpha: 0.5,
  })
  const student = nativeStudentGroundGlyph({ position: PLAYER.position, heading: 0, scale: 0.8 })
  assert.deepEqual(student, { position: { x: 100, y: 205 }, scaleX: 1, scaleY: 1, alpha: 1 })
})

test('NPC ground programs retain their asymmetric matrix and explicit alpha', () => {
  assert.deepEqual(nativeNpcGroundGlyph(PLAYER.position, { x: -18, y: 7 }), {
    position: { x: 82, y: 207 }, scaleX: 1.25, scaleY: 1.0499999523162842, alpha: 1,
  })
  assert.deepEqual(nativeNpcGroundGlyph(PLAYER.position, { x: -2, y: 0 }, 0.5), {
    position: { x: 98, y: 200 }, scaleX: 1.25, scaleY: 1.0499999523162842, alpha: 0.5,
  })
})

test('the ordinary glyph survives terminal delay and stops at151 or consumption', () => {
  assert.notEqual(nativePlayerGroundGlyph({ ...PLAYER, lifeState: 'dying', deathTick: 150 }, false), null)
  assert.equal(nativePlayerGroundGlyph({ ...PLAYER, lifeState: 'dying', deathTick: 151 }, false), null)
  assert.equal(nativePlayerGroundGlyph({ ...PLAYER, lifeState: 'spectating', deathTick: 159 }, false), null)
  assert.equal(nativePlayerGroundGlyph({ ...PLAYER, corpseConsumed: true }, false), null)
})

test('ground offsets retain angles inside one body-facing bin', () => {
  const first = nativePlayerGroundGlyph({ ...PLAYER, headingDegrees: 16 }, false)!
  const second = nativePlayerGroundGlyph({ ...PLAYER, headingDegrees: 22 }, false)!
  assert.notEqual(first.position.x, second.position.x)
  assert.notEqual(first.position.y, second.position.y)
})

test('all five authored compact surfaces use their native translated contours', () => {
  for (const selector of [25, 26, 27, 28, 29]) {
    assert.equal(nativeCompactSurfaceContains(selector, { x: 0, y: 0 }), true)
    assert.equal(nativeCompactSurfaceContains(selector, { x: 200, y: 200 }), false)
  }
  // Inside the visual bounding rectangle, outside the authored25 indentation.
  assert.equal(nativeCompactSurfaceContains(25, { x: -30, y: -10 }), false)
  assert.equal(nativeCompactSurfaceContains(29, { x: 100, y: 0 }), true)
  assert.equal(nativeCompactSurfaceContains(29, { x: 107, y: 0 }), false)
})

test('compact membership keeps the native strict side tests at authored vertices', () => {
  assert.equal(nativeCompactSurfaceContains(25, { x: 41, y: -6 }), false)
  assert.equal(nativeCompactSurfaceContains(25, { x: 40.99, y: -6 }), true)
  assert.equal(nativeCompactSurfaceContains(25, { x: 2, y: -37 }), false)
  assert.equal(nativeCompactSurfaceContains(25, { x: 2, y: -36.99 }), true)
  assert.equal(nativeCompactSurfaceContains(29, { x: 106.5, y: -3 }), false)
  assert.equal(nativeCompactSurfaceContains(29, { x: 106.49, y: -3 }), true)
})

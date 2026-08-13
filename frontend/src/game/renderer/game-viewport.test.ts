import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GAME_VIEWPORT_MIN_HEIGHT,
  GAME_VIEWPORT_MIN_WIDTH,
  gameViewportLayout,
} from './game-viewport.ts'

function closeTo(actual: number, expected: number, epsilon = 0.000_001): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`)
}

test('the stock viewport is the unchanged responsive identity case', () => {
  assert.deepEqual(gameViewportLayout(1600, 900), {
    displayScale: 1,
    height: 900,
    width: 1600,
  })
})

test('larger browsers expand camera field of view at native scale', () => {
  assert.deepEqual(gameViewportLayout(1920, 1080), {
    displayScale: 1,
    height: 1080,
    width: 1920,
  })
})

test('smaller and non-native aspects retain a minimum logical viewport without stretching', () => {
  const desktop = gameViewportLayout(1280, 800)
  assert.deepEqual(desktop, {
    displayScale: 0.8,
    height: 1000,
    width: 1600,
  })

  const mobile = gameViewportLayout(844, 390)
  closeTo(mobile.displayScale, 390 / GAME_VIEWPORT_MIN_HEIGHT)
  closeTo(mobile.width, 844 / mobile.displayScale)
  closeTo(mobile.height, GAME_VIEWPORT_MIN_HEIGHT)
  closeTo(mobile.width * mobile.displayScale, 844)
  closeTo(mobile.height * mobile.displayScale, 390)
  assert.ok(mobile.width >= GAME_VIEWPORT_MIN_WIDTH)
  assert.ok(mobile.height >= GAME_VIEWPORT_MIN_HEIGHT)
})

test('an unmeasured scene falls back to the exact stock viewport', () => {
  assert.deepEqual(gameViewportLayout(0, 0), {
    displayScale: 1,
    height: 900,
    width: 1600,
  })
  assert.deepEqual(gameViewportLayout(Number.NaN, Number.POSITIVE_INFINITY), {
    displayScale: 1,
    height: 900,
    width: 1600,
  })
})

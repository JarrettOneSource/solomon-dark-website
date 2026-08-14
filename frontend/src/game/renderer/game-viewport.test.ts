import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GAME_VIEWPORT_MIN_HEIGHT,
  GAME_VIEWPORT_MIN_WIDTH,
  fixedGameBottomStageBounds,
  fixedGameStageCssBounds,
  fixedGameViewportLayout,
  fixedGameViewportScale,
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

test('fixed native scenes scale with the limiting viewport axis', () => {
  assert.equal(fixedGameViewportScale(1600, 900), 1)
  assert.equal(fixedGameViewportScale(1920, 1080), 1.2)
  assert.equal(fixedGameViewportScale(1280, 800), 0.8)
  assert.equal(fixedGameViewportScale(844, 390), 390 / GAME_VIEWPORT_MIN_HEIGHT)
  assert.equal(fixedGameViewportScale(0, 0), 1)
})

test('fixed native scenes fill the browser while preserving one centered 1600 by 900 stage', () => {
  const deck = fixedGameViewportLayout(1280, 800)
  assert.deepEqual(deck, {
    displayScale: 0.8,
    height: 1000,
    nativeStage: { height: 900, width: 1600, x: 0, y: 50 },
    width: 1600,
  })
  assert.deepEqual(fixedGameStageCssBounds(deck), {
    height: 720,
    width: 1280,
    x: 0,
    y: 40,
  })
  assert.deepEqual(fixedGameStageCssBounds(deck, fixedGameBottomStageBounds(deck)), {
    height: 720,
    width: 1280,
    x: 0,
    y: 80,
  })

  const large = fixedGameViewportLayout(1920, 1080)
  assert.deepEqual(large, {
    displayScale: 1.2,
    height: 900,
    nativeStage: { height: 900, width: 1600, x: 0, y: 0 },
    width: 1600,
  })

  const mobile = fixedGameViewportLayout(844, 390)
  closeTo(mobile.displayScale, 390 / 900)
  closeTo(mobile.width, 844 / mobile.displayScale)
  closeTo(mobile.height, 900)
  closeTo(mobile.nativeStage.x, (mobile.width - 1600) / 2)
  closeTo(mobile.nativeStage.y, 0)
  closeTo(fixedGameStageCssBounds(mobile).x, (844 - 1600 * mobile.displayScale) / 2)
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
  assert.deepEqual(fixedGameViewportLayout(0, 0), {
    displayScale: 1,
    height: 900,
    nativeStage: { height: 900, width: 1600, x: 0, y: 0 },
    width: 1600,
  })
})

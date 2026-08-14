import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GAME_VIEWPORT_MIN_HEIGHT,
  GAME_VIEWPORT_MIN_WIDTH,
  fixedGamePresentationResolution,
  fixedGameStageBounds,
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

test('fixed native scenes fill the browser while preserving the centered 1600 by 900 stage', () => {
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
  assert.deepEqual(fixedGameStageCssBounds(
    deck,
    fixedGameStageBounds(deck, 'center', 'bottom'),
  ), {
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

test('fixed native stage lanes independently preserve all screen-edge relationships', () => {
  const wide = fixedGameViewportLayout(2560, 1080)
  closeTo(wide.width, 2560 / 1.2)
  assert.equal(wide.height, 900)

  const expectedX = {
    left: 0,
    center: (wide.width - GAME_VIEWPORT_MIN_WIDTH) / 2,
    right: wide.width - GAME_VIEWPORT_MIN_WIDTH,
  }
  const expectedY = { top: 0, center: 0, bottom: 0 }
  for (const horizontal of ['left', 'center', 'right'] as const) {
    for (const vertical of ['top', 'center', 'bottom'] as const) {
      const bounds = fixedGameStageBounds(wide, horizontal, vertical)
      closeTo(bounds.x, expectedX[horizontal])
      closeTo(bounds.y, expectedY[vertical])
      assert.equal(bounds.width, GAME_VIEWPORT_MIN_WIDTH)
      assert.equal(bounds.height, GAME_VIEWPORT_MIN_HEIGHT)
    }
  }

  const tall = fixedGameViewportLayout(1280, 800)
  assert.deepEqual(fixedGameStageBounds(tall, 'left', 'top'), {
    height: 900,
    width: 1600,
    x: 0,
    y: 0,
  })
  assert.deepEqual(fixedGameStageBounds(tall, 'center', 'center'), tall.nativeStage)
  assert.deepEqual(fixedGameStageBounds(tall, 'right', 'bottom'), {
    height: 900,
    width: 1600,
    x: 0,
    y: 100,
  })
})

test('fixed-screen backing density maps directly to physical pixels below its cap', () => {
  assert.equal(fixedGamePresentationResolution(1, 1), 1)
  assert.equal(fixedGamePresentationResolution(1, 0.8), 0.8)
  assert.equal(fixedGamePresentationResolution(1, 390 / 900), 390 / 900)
  assert.equal(fixedGamePresentationResolution(2, 0.8), 1.5)
  assert.equal(fixedGamePresentationResolution(Number.NaN, Number.NaN), 1)
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

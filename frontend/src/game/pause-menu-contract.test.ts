import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import fontAssetsJson from '../assets/game/skill-picker-native-assets.json' with { type: 'json' }
import uiAssetsJson from '../assets/game/hub-trader-native-assets.json' with { type: 'json' }
import {
  NATIVE_PAUSE_ART_COUNTS,
  NATIVE_PAUSE_ART_RECORDS,
  NATIVE_PAUSE_CLOSE_MS,
  NATIVE_PAUSE_DIM_ALPHA,
  NATIVE_PAUSE_EDGE_UV_START,
  NATIVE_PAUSE_FONT,
  NATIVE_PAUSE_PRESSED_ROW_FRAME,
  NATIVE_PAUSE_ROW_END_FRAME,
  NATIVE_PAUSE_REVEAL_MS,
  NATIVE_PAUSE_TEXT_TINT,
  PAUSE_MENU_ACTION_BOUNDS,
  gameplayPausePresentation,
  nativePauseMenuRenderPlan,
  nativePauseMenuReveal,
} from './pause-menu-contract.ts'

const PAUSE = {
  ownerDisplayName: 'Helvidius',
  ownerPlayerId: 'player-1',
} as const
const pauseCss = readFileSync(new URL('./gameplay-pause-menu.css', import.meta.url), 'utf8')

test('pause menu keeps the recovered native fixed-step timing and action geometry', () => {
  assert.equal(NATIVE_PAUSE_REVEAL_MS, 290)
  assert.equal(NATIVE_PAUSE_CLOSE_MS, 200)
  assert.equal(NATIVE_PAUSE_DIM_ALPHA, 0.85)
  assert.deepEqual(PAUSE_MENU_ACTION_BOUNDS, {
    resume: { height: 69, left: 623.5, top: 339.5, width: 353 },
    settings: { height: 69, left: 623.5, top: 415.5, width: 353 },
    leave: { height: 69, left: 623.5, top: 491.5, width: 353 },
  })
  assert.equal(nativePauseMenuReveal('opening', 0), 0)
  assert.equal(nativePauseMenuReveal('opening', 9.999), 0)
  assert.equal(nativePauseMenuReveal('opening', 10), 0.03500000014901161)
  assert.equal(nativePauseMenuReveal('opening', 280), 0.9800003170967102)
  assert.equal(nativePauseMenuReveal('opening', 290), 1)
  assert.equal(nativePauseMenuReveal('closing', 0), 1)
  assert.equal(nativePauseMenuReveal('closing', 10), 0.949999988079071)
  assert.equal(nativePauseMenuReveal('closing', 190), 0.049999844282865524)
  assert.equal(nativePauseMenuReveal('closing', 200), 0)
})

test('pause menu drains the exact UI and bitmap-font membership', () => {
  assert.deepEqual(NATIVE_PAUSE_ART_RECORDS, {
    arrow: 8,
    frame: 17,
    header: 18,
    idleRow: 101,
    pressedRow: 102,
    rowEnd: 54,
  })
  assert.deepEqual(NATIVE_PAUSE_ART_COUNTS, {
    8: 3,
    17: 4,
    18: 1,
    54: 6,
    101: 3,
  })
  assert.equal(NATIVE_PAUSE_EDGE_UV_START, 0.95)
  assert.equal(NATIVE_PAUSE_TEXT_TINT, 0xd9ba70)
  assert.deepEqual(NATIVE_PAUSE_PRESSED_ROW_FRAME, [620, 482, 353, 69])
  assert.deepEqual(NATIVE_PAUSE_ROW_END_FRAME, [679, 394, 70, 85])
  assert.deepEqual(NATIVE_PAUSE_FONT, {
    firstRecord: 216,
    glyphCount: 92,
    group: 'menu',
    kerningCount: 210,
    lastRecord: 307,
    metrics: [24, 6, 28],
    spaceAdvance: 6,
  })

  const ui = uiAssetsJson.atlases.UI.records
  assert.deepEqual(ui['8'], {
    frame: [824, 587, 49, 112],
    logicalSize: [49, 112],
    trimOrigin: [0, 0],
  })
  assert.deepEqual(ui['17'], {
    frame: [743, 588, 80, 83],
    logicalSize: [80, 83],
    trimOrigin: [0, 0],
  })
  assert.deepEqual(ui['18'], {
    frame: [543, 205, 67, 262],
    logicalSize: [86, 262],
    trimOrigin: [19, 0],
  })
  assert.deepEqual(ui['54'], {
    frame: [679, 394, 70, 85],
    logicalSize: [70, 85],
    trimOrigin: [0, 0],
  })
  assert.deepEqual(ui['101'], {
    frame: [266, 482, 353, 69],
    logicalSize: [353, 69],
    trimOrigin: [0, 0],
  })
  assert.deepEqual(ui['102'], {
    frame: [620, 482, 353, 69],
    logicalSize: [353, 69],
    trimOrigin: [0, 0],
  })
  assert.equal(Object.keys(fontAssetsJson.fonts.menu.glyphs).length, 92)
  assert.equal(fontAssetsJson.fonts.menu.kerning.length, 210)
})

test('settled and closed render plans preserve native chrome ownership', () => {
  const settled = nativePauseMenuRenderPlan(1, null)
  assert.equal(settled.alpha, 1)
  assert.equal(settled.dimAlpha, 0.8500000238418579)
  assert.deepEqual(settled.chrome, {
    bottom: 600.5,
    height: 301,
    left: 583.5,
    right: 1016.5,
    top: 299.5,
    width: 433,
  })
  assert.deepEqual(settled.header, { rotation: Math.PI / 2, x: 800, y: 257.5 })
  assert.deepEqual(settled.arrows, [
    { scale: 1, x: 800, y: 655.5 },
    { scale: 0.75, x: 725, y: 642.5 },
    { scale: 0.75, x: 875, y: 642.5 },
  ])
  assert.deepEqual(
    settled.rows.map(({ action, bodyRecord, labelX, labelY }) => ({
      action,
      bodyRecord,
      labelX,
      labelY,
    })),
    [
      { action: 'resume', bodyRecord: 101, labelX: 800, labelY: 383 },
      { action: 'settings', bodyRecord: 101, labelX: 800, labelY: 459 },
      { action: 'leave', bodyRecord: 101, labelX: 800, labelY: 535 },
    ],
  )

  const closed = nativePauseMenuRenderPlan(0, null)
  assert.equal(closed.alpha, 0)
  assert.equal(closed.dimAlpha, 0)
  assert.deepEqual(closed.chrome, {
    bottom: 625.5,
    height: 351,
    left: 558.5,
    right: 1041.5,
    top: 274.5,
    width: 483,
  })
  assert.deepEqual(closed.header, { rotation: Math.PI / 2, x: 800, y: 232.5 })
  assert.deepEqual(closed.arrows, [
    { scale: 1, x: 800, y: 680.5 },
    { scale: 0.75, x: 725, y: 667.5 },
    { scale: 0.75, x: 875, y: 667.5 },
  ])
})

test('every action has the same exact pressed substitution and no hover render branch', () => {
  for (const action of ['resume', 'settings', 'leave'] as const) {
    const plan = nativePauseMenuRenderPlan(1, action)
    for (const row of plan.rows) {
      const pressed = row.action === action
      assert.equal(row.bodyRecord, pressed ? 102 : 101)
      assert.equal(row.labelX, pressed ? 806 : 800)
      assert.equal(
        row.labelY,
        PAUSE_MENU_ACTION_BOUNDS[row.action].top + 69 / 2 + 9 + (pressed ? 6 : 0),
      )
    }
  }
  assert.equal(nativePauseMenuRenderPlan.length, 2)
  assert.match(
    pauseCss,
    /\.main-menu-native-stage\.gameplay-pause-stage\s*\{[^}]*z-index:\s*80;[^}]*pointer-events:\s*auto;/s,
  )
  assert.doesNotMatch(pauseCss, /\.gameplay-pause-action:(?:hover|focus-visible)/)
  assert.doesNotMatch(pauseCss, /\.gameplay-pause-frame/)
})

test('pause presentation gives actions only to the authoritative owner', () => {
  assert.deepEqual(gameplayPausePresentation(PAUSE, 'player-1'), {
    kind: 'owner',
    label: 'Game paused',
  })
  assert.deepEqual(gameplayPausePresentation(PAUSE, 'player-2'), {
    detail: 'Waiting for Helvidius to resume.',
    kind: 'waiting',
    label: 'Helvidius has paused the game.',
  })
})

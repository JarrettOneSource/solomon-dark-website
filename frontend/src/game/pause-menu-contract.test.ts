import assert from 'node:assert/strict'
import test from 'node:test'

import nativeUiAssetsJson from '../assets/game/native-ui-assets.json' with { type: 'json' }
import {
  NATIVE_UI_BUTTON,
  NATIVE_UI_SIMPLE_MENU,
  planNativeUiSimpleMenu,
  type NativeUiPlan,
} from './native-ui/core.ts'
import {
  CHEAT_PAUSE_MENU_ROWS,
  NATIVE_PAUSE_CHROME_ART_SIZES,
  NATIVE_PAUSE_CLOSE_MS,
  NATIVE_PAUSE_REVEAL_MS,
  NATIVE_PAUSE_TOUCH_MARGIN_PX,
  NATIVE_PAUSE_TOUCH_ROW_MIN_PX,
  PAUSE_MENU_ACTION_BOUNDS,
  gameplayPausePresentation,
  nativePauseMenuExtent,
  nativePauseMenuReveal,
  nativePauseMenuStagePlacement,
  NATIVE_DARK_CLOUD_GUEST_MENU_ROWS,
  NATIVE_DARK_CLOUD_MENU_ROWS,
  NATIVE_PAUSE_MENU_ROWS,
  NATIVE_SIMPLE_MENU_ROW_SIZE,
  nativeSimpleMenuRowBounds,
} from './pause-menu-contract.ts'
import {
  fixedGameStageBounds,
  fixedGameStageCssBounds,
  fixedGameViewportLayout,
} from './renderer/game-viewport.ts'

const PAUSE = {
  ownerDisplayName: 'Helvidius',
  ownerPlayerId: 'player-1',
  source: 'pause-menu',
} as const
function recordGeometry(record: {
  readonly frame: readonly number[]
  readonly logicalSize: readonly number[]
  readonly trimOrigin: readonly number[]
}) {
  return {
    frame: record.frame,
    logicalSize: record.logicalSize,
    trimOrigin: record.trimOrigin,
  }
}

function simpleMenuPlan(
  reveal: number,
  pressedAction: string | null = null,
  rows = NATIVE_PAUSE_MENU_ROWS,
): NativeUiPlan {
  return planNativeUiSimpleMenu({
    height: 900,
    reveal,
    rows: rows.map(({ action, label }) => ({
      id: action,
      label,
      state: action === pressedAction ? 'pressed' : 'idle',
    })),
    width: 1_600,
  })
}

test('pause menu keeps the recovered native fixed-step timing and action geometry', () => {
  assert.equal(NATIVE_PAUSE_REVEAL_MS, 290)
  assert.equal(NATIVE_PAUSE_CLOSE_MS, 200)
  assert.equal(NATIVE_UI_SIMPLE_MENU.dimAlpha, 0.85)
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
  assert.deepEqual({
    arrow: NATIVE_UI_SIMPLE_MENU.arrowRecord,
    frame: NATIVE_UI_SIMPLE_MENU.frameRecord,
    header: NATIVE_UI_SIMPLE_MENU.headerRecord,
    idleRow: NATIVE_UI_BUTTON.idleRecord,
    pressedRow: NATIVE_UI_BUTTON.pressedRecord,
    rowEnd: NATIVE_UI_BUTTON.surroundEndRecord,
  }, {
    arrow: 8,
    frame: 17,
    header: 18,
    idleRow: 101,
    pressedRow: 102,
    rowEnd: 54,
  })
  const plan = simpleMenuPlan(1)
  const recordCounts = plan.nodes.reduce<Record<number, number>>((counts, node) => {
    if ('record' in node) counts[node.record] = (counts[node.record] ?? 0) + 1
    return counts
  }, {})
  assert.deepEqual(recordCounts, {
    8: 3,
    17: 1,
    18: 1,
    54: 9,
    101: 3,
  })
  assert.equal(NATIVE_UI_SIMPLE_MENU.frameEdgeUvOrigin, 0.95)
  assert.equal(NATIVE_UI_BUTTON.textTint, 0xd9ba70)

  const ui = nativeUiAssetsJson.atlases.UI.records
  assert.deepEqual(recordGeometry(ui['8']), {
    frame: [824, 587, 49, 112],
    logicalSize: [49, 112],
    trimOrigin: [0, 0],
  })
  assert.deepEqual(recordGeometry(ui['17']), {
    frame: [743, 588, 80, 83],
    logicalSize: [80, 83],
    trimOrigin: [0, 0],
  })
  assert.deepEqual(recordGeometry(ui['18']), {
    frame: [543, 205, 67, 262],
    logicalSize: [86, 262],
    trimOrigin: [19, 0],
  })
  assert.deepEqual(recordGeometry(ui['54']), {
    frame: [679, 394, 70, 85],
    logicalSize: [70, 85],
    trimOrigin: [0, 0],
  })
  assert.deepEqual(recordGeometry(ui['101']), {
    frame: [266, 482, 353, 69],
    logicalSize: [353, 69],
    trimOrigin: [0, 0],
  })
  assert.deepEqual(recordGeometry(ui['102']), {
    frame: [620, 482, 353, 69],
    logicalSize: [353, 69],
    trimOrigin: [0, 0],
  })
  assert.equal(Object.keys(nativeUiAssetsJson.fonts.menu.glyphs).length, 92)
  assert.equal(nativeUiAssetsJson.fonts.menu.kerning.length, 210)
})

test('settled and closed render plans preserve native chrome ownership', () => {
  const settled = simpleMenuPlan(1)
  assert.equal(settled.opacity, 1)
  const settledCurtain = settled.nodes.find(({ label }) => label === 'simple-menu:curtain')
  const settledFrame = settled.nodes.find(({ label }) => label === 'simple-menu:frame')
  const settledHeader = settled.nodes.find(({ label }) => label === 'simple-menu:header')
  assert.ok(settledCurtain?.kind === 'solid')
  assert.ok(settledFrame?.kind === 'nine-slice')
  assert.ok(settledHeader?.kind === 'sprite')
  assert.equal(settledCurtain.alpha, 0.85)
  assert.deepEqual(settledFrame.bounds, {
    height: 301,
    left: 583.5,
    top: 299.5,
    width: 433,
  })
  assert.deepEqual(
    { rotation: settledHeader.rotation, x: settledHeader.x, y: settledHeader.y },
    { rotation: Math.PI / 2, x: 800, y: 257.5 },
  )
  assert.deepEqual(
    settled.nodes
      .filter(({ label }) => label?.startsWith('simple-menu:arrow-'))
      .map((node) => node.kind === 'sprite'
        ? { scale: node.scale ?? 1, x: node.x, y: node.y }
        : null),
    [
      { scale: 1, x: 800, y: 655.5 },
      { scale: 0.75, x: 725, y: 642.5 },
      { scale: 0.75, x: 875, y: 642.5 },
    ],
  )
  assert.deepEqual(settled.actions.map(({ bounds, id }) => ({ bounds, id })), [
    { bounds: PAUSE_MENU_ACTION_BOUNDS.resume, id: 'resume' },
    { bounds: PAUSE_MENU_ACTION_BOUNDS.settings, id: 'settings' },
    { bounds: PAUSE_MENU_ACTION_BOUNDS.leave, id: 'leave' },
  ])

  const closed = simpleMenuPlan(0)
  const closedFrame = closed.nodes.find(({ label }) => label === 'simple-menu:frame')
  const closedHeader = closed.nodes.find(({ label }) => label === 'simple-menu:header')
  assert.equal(closed.opacity, 0)
  assert.ok(closedFrame?.kind === 'nine-slice')
  assert.ok(closedHeader?.kind === 'sprite')
  assert.deepEqual(closedFrame.bounds, {
    height: 351,
    left: 558.5,
    top: 274.5,
    width: 483,
  })
  assert.deepEqual(
    { rotation: closedHeader.rotation, x: closedHeader.x, y: closedHeader.y },
    { rotation: Math.PI / 2, x: 800, y: 232.5 },
  )
})

test('every action has the same exact pressed substitution and no hover render branch', () => {
  for (const action of ['resume', 'settings', 'leave'] as const) {
    const plan = simpleMenuPlan(1, action)
    for (const row of NATIVE_PAUSE_MENU_ROWS) {
      const body = plan.nodes.find(({ label }) => label === `${row.action}:body`)
      const label = plan.nodes.find(({ label }) => label === `${row.action}:label`)
      const pressed = row.action === action
      assert.ok(body?.kind === 'sprite')
      assert.ok(label?.kind === 'text')
      assert.equal(body.record, pressed ? 102 : 101)
      assert.equal(label.text.x, pressed ? 806 : 800)
      assert.equal(
        label.text.y,
        PAUSE_MENU_ACTION_BOUNDS[row.action].top + 69 / 2 + 9 + (pressed ? 6 : 0),
      )
    }
  }
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
  assert.deepEqual(gameplayPausePresentation({ ...PAUSE, source: 'inventory' }, 'player-2'), {
    detail: 'Waiting for Helvidius to close Inventory.',
    kind: 'waiting',
    label: 'Helvidius is using Inventory.',
  })
  assert.deepEqual(gameplayPausePresentation({ ...PAUSE, source: 'skill-book' }, 'player-2'), {
    detail: 'Waiting for Helvidius to close the Skill Book.',
    kind: 'waiting',
    label: 'Helvidius is using the Skill Book.',
  })
  assert.deepEqual(gameplayPausePresentation({ ...PAUSE, source: 'skill-selector' }, 'player-2'), {
    detail: 'Waiting for Helvidius to close the skill selector.',
    kind: 'waiting',
    label: 'Helvidius is using the skill selector.',
  })
})

const near = (actual: number, expected: number, label: string) => {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} !== ${expected}`)
}

test('pause menu extent spans the rotated header through the large arrow', () => {
  const ui = nativeUiAssetsJson.atlases.UI.records
  assert.deepEqual(ui['8'].logicalSize, [NATIVE_PAUSE_CHROME_ART_SIZES.arrow.width, NATIVE_PAUSE_CHROME_ART_SIZES.arrow.height])
  assert.deepEqual(ui['18'].logicalSize, [NATIVE_PAUSE_CHROME_ART_SIZES.header.width, NATIVE_PAUSE_CHROME_ART_SIZES.header.height])
  // Settled chrome is (583.5, 299.5, 433×301); the header sits 43 above its top edge
  // and the scale-1 arrow reaches 111 below its bottom edge.
  assert.deepEqual(nativePauseMenuExtent(), { height: 497, left: 583.5, top: 214.5, width: 433 })
})

test('viewport-laid-out hosts keep gameplay\'s fixed stage until a row would drop under the touch floor', () => {
  assert.equal(NATIVE_PAUSE_TOUCH_ROW_MIN_PX, 44)
  assert.equal(NATIVE_PAUSE_TOUCH_MARGIN_PX, 12)
  for (const [width, height] of [[1600, 900], [1920, 1080], [2560, 1080], [1024, 768], [0, 0]] as const) {
    const layout = fixedGameViewportLayout(width, height)
    const placement = nativePauseMenuStagePlacement(layout)
    const gameplay = fixedGameStageCssBounds(layout, fixedGameStageBounds(layout, 'center', 'center'))
    assert.equal(placement.mode, 'native-stage', `${width}x${height}`)
    assert.equal(placement.scale, layout.displayScale)
    near(placement.x, gameplay.x, `${width}x${height} x`)
    near(placement.y, gameplay.y, `${width}x${height} y`)
    assert.ok(PAUSE_MENU_ACTION_BOUNDS.resume.height * placement.scale >= NATIVE_PAUSE_TOUCH_ROW_MIN_PX)
  }
  assert.equal(nativePauseMenuStagePlacement(fixedGameViewportLayout(1920, 1080)).scale, 1.2)
  assert.equal(nativePauseMenuStagePlacement(fixedGameViewportLayout(1024, 768)).scale, 0.64)
  near(nativePauseMenuStagePlacement(fixedGameViewportLayout(2560, 1080)).x, 320, 'ultrawide letterbox')
})

test('phone hosts centre the stage at the largest fit that keeps the whole menu art in view', () => {
  const reachX = 216.5
  const reachY = 261.5
  const cases: readonly (readonly [number, number, number])[] = [
    [390, 844, (390 / 2 - 12) / reachX],
    [844, 390, (390 / 2 - 12) / reachY],
    [320, 568, (320 / 2 - 12) / reachX],
    [768, 1024, 1],
  ]
  for (const [width, height, scale] of cases) {
    const placement = nativePauseMenuStagePlacement(fixedGameViewportLayout(width, height))
    assert.equal(placement.mode, 'touch-fit', `${width}x${height}`)
    near(placement.scale, scale, `${width}x${height} scale`)
    near(placement.x, (width - 1600 * scale) / 2, `${width}x${height} x`)
    near(placement.y, (height - 900 * scale) / 2, `${width}x${height} y`)
    const extent = nativePauseMenuExtent()
    near(placement.x + 800 * scale, width / 2, `${width}x${height} stage centre x`)
    near(placement.y + 450 * scale, height / 2, `${width}x${height} stage centre y`)
    assert.ok(placement.x + extent.left * scale >= NATIVE_PAUSE_TOUCH_MARGIN_PX - 1e-9)
    assert.ok(placement.y + extent.top * scale >= NATIVE_PAUSE_TOUCH_MARGIN_PX - 1e-9)
    assert.ok(placement.x + (extent.left + extent.width) * scale <= width - NATIVE_PAUSE_TOUCH_MARGIN_PX + 1e-9)
    assert.ok(placement.y + (extent.top + extent.height) * scale <= height - NATIVE_PAUSE_TOUCH_MARGIN_PX + 1e-9)
    if (scale < 1) assert.ok(PAUSE_MENU_ACTION_BOUNDS.resume.height * scale >= NATIVE_PAUSE_TOUCH_ROW_MIN_PX)
  }
  const degenerate = nativePauseMenuStagePlacement(fixedGameViewportLayout(20, 20))
  assert.equal(degenerate.scale, 0)
  assert.ok(Number.isFinite(degenerate.x) && Number.isFinite(degenerate.y))
})

test('the shared SimpleMenu plan follows the rows a host authors', () => {
  assert.deepEqual(NATIVE_SIMPLE_MENU_ROW_SIZE, { height: 69, width: 353 })
  assert.deepEqual(nativeSimpleMenuRowBounds(3), [
    PAUSE_MENU_ACTION_BOUNDS.resume,
    PAUSE_MENU_ACTION_BOUNDS.settings,
    PAUSE_MENU_ACTION_BOUNDS.leave,
  ])
  assert.deepEqual(NATIVE_PAUSE_MENU_ROWS.map((row) => [row.action, row.label]), [
    ['resume', 'RESUME GAME'],
    ['settings', 'GAME SETTINGS'],
    ['leave', 'LEAVE GAME'],
  ])
  assert.deepEqual(simpleMenuPlan(0.5, 'leave'), simpleMenuPlan(0.5, 'leave', NATIVE_PAUSE_MENU_ROWS))
  assert.deepEqual(nativePauseMenuExtent(), nativePauseMenuExtent(NATIVE_PAUSE_MENU_ROWS))
  assert.throws(() => nativeSimpleMenuRowBounds(0), RangeError)
  assert.throws(() => nativeSimpleMenuRowBounds(2.5), RangeError)
})

test('the Dark Cloud authors the native four rows and the plan grows around them', () => {
  // 0x005A5530 authors RESUME[0]|GAME SETTINGS[1]|SIGN OUT[2]|MAIN MENU[3]; the retail capture
  // dark-cloud-menu.png shows the frame at y 265–635 and the row tops at y 301/377/453/529.
  assert.deepEqual(NATIVE_DARK_CLOUD_MENU_ROWS.map((row) => [row.action, row.label]), [
    ['resume', 'RESUME'],
    ['settings', 'GAME SETTINGS'],
    ['sign-out', 'SIGN OUT'],
    ['leave', 'MAIN MENU'],
  ])
  assert.deepEqual(NATIVE_DARK_CLOUD_GUEST_MENU_ROWS.map((row) => row.label), ['RESUME', 'GAME SETTINGS', 'MAIN MENU'])
  const plan = simpleMenuPlan(1, null, NATIVE_DARK_CLOUD_MENU_ROWS)
  const bounds = plan.actions.map((row) => row.bounds)
  const frame = plan.nodes.find(({ label }) => label === 'simple-menu:frame')
  const header = plan.nodes.find(({ label }) => label === 'simple-menu:header')
  assert.deepEqual(bounds, nativeSimpleMenuRowBounds(4))
  assert.deepEqual(bounds.map((row) => row.top), [301.5, 377.5, 453.5, 529.5])
  assert.deepEqual(bounds.map((row) => row.left), [623.5, 623.5, 623.5, 623.5])
  assert.ok(frame?.kind === 'nine-slice')
  assert.ok(header?.kind === 'sprite')
  assert.deepEqual(frame.bounds, { height: 377, left: 583.5, top: 261.5, width: 433 })
  assert.deepEqual(
    { rotation: header.rotation, x: header.x, y: header.y },
    { rotation: Math.PI / 2, x: 800, y: 219.5 },
  )
  assert.deepEqual(
    plan.nodes
      .filter(({ label }) => label?.startsWith('simple-menu:arrow-'))
      .map((node) => node.kind === 'sprite' ? node.y : null),
    [693.5, 680.5, 680.5],
  )
  assert.deepEqual(nativePauseMenuExtent(NATIVE_DARK_CLOUD_MENU_ROWS), { height: 573, left: 583.5, top: 176.5, width: 433 })
  const pressed = simpleMenuPlan(1, 'sign-out', NATIVE_DARK_CLOUD_MENU_ROWS)
  assert.deepEqual(
    NATIVE_DARK_CLOUD_MENU_ROWS.map(({ action }) => {
      const body = pressed.nodes.find(({ label }) => label === `${action}:body`)
      return body?.kind === 'sprite' ? body.record : null
    }),
    [101, 101, 102, 101],
  )
  const pressedLabel = pressed.nodes.find(({ label }) => label === 'sign-out:label')
  assert.ok(pressedLabel?.kind === 'text')
  assert.deepEqual([pressedLabel.text.x, pressedLabel.text.y], [806, 503])
  const opening = simpleMenuPlan(0, null, NATIVE_DARK_CLOUD_MENU_ROWS)
  const openingFrame = opening.nodes.find(({ label }) => label === 'simple-menu:frame')
  assert.ok(openingFrame?.kind === 'nine-slice')
  assert.deepEqual(
    [openingFrame.bounds.top, openingFrame.bounds.top + openingFrame.bounds.height],
    [236.5, 663.5],
  )
  // Guests lose only the SIGN OUT row, so their three rows sit exactly where gameplay's do.
  assert.deepEqual(
    simpleMenuPlan(1, null, NATIVE_DARK_CLOUD_GUEST_MENU_ROWS).actions.map((row) => row.bounds),
    simpleMenuPlan(1).actions.map((row) => row.bounds),
  )
})

test('cheat-enabled gameplay adds one explicit Website row to the shared SimpleMenu', () => {
  assert.deepEqual(CHEAT_PAUSE_MENU_ROWS.map((row) => [row.action, row.label]), [
    ['resume', 'RESUME GAME'],
    ['cheats', 'CHEAT MENU'],
    ['settings', 'GAME SETTINGS'],
    ['leave', 'LEAVE GAME'],
  ])
  const plan = simpleMenuPlan(1, null, CHEAT_PAUSE_MENU_ROWS)
  assert.deepEqual(plan.actions.map((row) => row.bounds), nativeSimpleMenuRowBounds(4))
  assert.equal(plan.actions[1]!.id, 'cheats')
})

test('phone hosts fit the taller Dark Cloud menu by its own extent', () => {
  const fourRowReachY = 299.5
  for (const [width, height] of [[1600, 900], [1024, 768]] as const) {
    assert.deepEqual(
      nativePauseMenuStagePlacement(fixedGameViewportLayout(width, height), NATIVE_DARK_CLOUD_MENU_ROWS),
      nativePauseMenuStagePlacement(fixedGameViewportLayout(width, height)),
    )
  }
  const landscape = nativePauseMenuStagePlacement(fixedGameViewportLayout(844, 390), NATIVE_DARK_CLOUD_MENU_ROWS)
  assert.equal(landscape.mode, 'touch-fit')
  near(landscape.scale, (390 / 2 - 12) / fourRowReachY, 'landscape scale')
  near(landscape.y + 749.5 * landscape.scale, 390 - 12, 'large arrow bottom on the margin')
  assert.ok(landscape.y + 176.5 * landscape.scale >= NATIVE_PAUSE_TOUCH_MARGIN_PX)
  assert.ok(NATIVE_SIMPLE_MENU_ROW_SIZE.height * landscape.scale > 42)
  const portrait = nativePauseMenuStagePlacement(fixedGameViewportLayout(390, 844), NATIVE_DARK_CLOUD_MENU_ROWS)
  near(portrait.scale, (390 / 2 - 12) / 216.5, 'portrait scale is width-bound')
  assert.ok(NATIVE_SIMPLE_MENU_ROW_SIZE.height * portrait.scale >= NATIVE_PAUSE_TOUCH_ROW_MIN_PX)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import nativeUiAssetsJson from '../assets/game/native-ui-assets.json' with { type: 'json' }
import {
  NATIVE_PAUSE_ART_COUNTS,
  NATIVE_PAUSE_ART_RECORDS,
  NATIVE_PAUSE_CHROME_ART_SIZES,
  NATIVE_PAUSE_CLOSE_MS,
  NATIVE_PAUSE_DIM_ALPHA,
  NATIVE_PAUSE_EDGE_UV_START,
  NATIVE_PAUSE_FONT,
  NATIVE_PAUSE_PRESSED_ROW_FRAME,
  NATIVE_PAUSE_ROW_END_FRAME,
  NATIVE_PAUSE_REVEAL_MS,
  NATIVE_PAUSE_TEXT_TINT,
  NATIVE_PAUSE_TOUCH_MARGIN_PX,
  NATIVE_PAUSE_TOUCH_ROW_MIN_PX,
  PAUSE_MENU_ACTION_BOUNDS,
  gameplayPausePresentation,
  nativePauseMenuExtent,
  nativePauseMenuRenderPlan,
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
const pauseCss = readFileSync(new URL('./gameplay-pause-menu.css', import.meta.url), 'utf8')
const pauseComponent = readFileSync(new URL('./GameplayPauseMenu.tsx', import.meta.url), 'utf8')
const mainMenuComponent = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const hubComponent = readFileSync(new URL('./HubScene.tsx', import.meta.url), 'utf8')
const hubInventoryComponent = readFileSync(new URL('./HubInventoryUi.tsx', import.meta.url), 'utf8')
const clientSessionSource = readFileSync(
  new URL('./client/game-client-session.ts', import.meta.url),
  'utf8',
)
const hostSource = readFileSync(new URL('./host/game-host.ts', import.meta.url), 'utf8')

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
    /\.gameplay-pause-overlay\s*\{[^}]*z-index:\s*80;[^}]*pointer-events:\s*auto;/s,
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

test('every optional Hub activity is local over an always-live world', () => {
  assert.match(
    mainMenuComponent,
    /const \[hubPauseMenuOpen, setHubPauseMenuOpen\] = useState\(false\)/,
  )
  assert.match(
    mainMenuComponent,
    /runtimeSnapshot\?\.world\.kind === 'hub'[\s\S]*setHubPauseMenuOpen\(true\)[\s\S]*return/,
  )
  assert.match(mainMenuComponent, /const displayedGameplayPause = gameplayPause \?\? localHubPause/)
  assert.match(
    mainMenuComponent,
    /runtimeSnapshot\?\.world\.kind === 'boneyard'[\s\S]*\? 'skill-book'[\s\S]*\? 'skill-selector'[\s\S]*\? 'inventory'/,
  )
  assert.match(
    mainMenuComponent,
    /const localHubActivity:[\s\S]*hubPauseMenuOpen[\s\S]*\? 'paused'[\s\S]*chatOpen[\s\S]*skillBookOpen[\s\S]*hudSkillSelector[\s\S]*inventoryScreenOpen[\s\S]*hubSceneOccupied[\s\S]*\? 'occupied'/,
  )
  assert.match(mainMenuComponent, /session\?\.setHubActivity\(localHubActivity\)/)
  assert.match(hubComponent, /inputRef\.current\?\.setBlocked\(inputBlocked \|\| modalOpen\)/)
  assert.match(hubComponent, /onOccupiedChange\(modalOpen\)/)
  assert.doesNotMatch(hubComponent, /presentationPausedRef/)
  assert.match(hubComponent, /data-hub-ui-surface=\{hubUiSurface\?\.kind \?\? 'none'\}/)
  assert.doesNotMatch(hubInventoryComponent, /requestGameplayPause|client-gameplay-pause/)
  assert.match(clientSessionSource, /if \(snapshot\.world\.kind === 'hub'\) return/)
  assert.match(hostSource, /if \(activeState\.world\.kind === 'hub'\) return/)
  assert.doesNotMatch(hostSource, /sharedHubGameplayPause|stopSharedHubInputs/)
})

test('Pause Menu and both native skill pickers mute only the non-music audio lane', () => {
  assert.match(
    mainMenuComponent,
    /const nonMusicMuted = darkCloudMenuOpen\s*\|\| displayedGameplayPause\?\.source === 'pause-menu'\s*\|\| displayedGameplayPause\?\.source === 'skill-selector'\s*\|\| hudSkillSelector !== null\s*\|\| levelUpModalActive/,
  )
  assert.match(
    mainMenuComponent,
    /useLayoutEffect\(\(\) => \{\s*audio\.setSoundMuted\(nonMusicMuted\)\s*\}, \[audio, nonMusicMuted\]\)/,
  )
  assert.match(mainMenuComponent, /data-game-sounds-muted=\{nonMusicMuted\}/)
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

test('a viewport host shares the full-display owner while placing its own native stage', () => {
  assert.match(pauseComponent, /className\?: string/)
  assert.match(pauseComponent, /gameplay-pause-overlay gameplay-pause-stage\$\{className \? ` \$\{className\}` : ''\}/)
  assert.match(
    pauseComponent,
    /className="main-menu-native-stage gameplay-pause-native-stage" style=\{style\}/,
  )
  assert.doesNotMatch(pauseCss, /-4000px|main-menu-native-stage\.gameplay-pause-stage\.dark-cloud-pause-stage/)
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
  assert.deepEqual(nativePauseMenuRenderPlan(0.5, 'leave'), nativePauseMenuRenderPlan(0.5, 'leave', NATIVE_PAUSE_MENU_ROWS))
  assert.deepEqual(nativePauseMenuExtent(), nativePauseMenuExtent(NATIVE_PAUSE_MENU_ROWS))
  assert.throws(() => nativeSimpleMenuRowBounds(0), RangeError)
  assert.throws(() => nativeSimpleMenuRowBounds(2.5), RangeError)
  // The component renders whatever rows the plan carries; no label or row is hard-coded there any more.
  assert.match(pauseComponent, /renderPlan\.rows\.map\(\(row, index\) => \(/)
  assert.match(pauseComponent, /buttonRef=\{index === 0 \? firstRowRef : undefined\}/)
  assert.match(pauseComponent, /rows = NATIVE_PAUSE_MENU_ROWS/)
  assert.doesNotMatch(pauseComponent, /'RESUME GAME'|'LEAVE GAME'|pauseActionLabel/)
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
  const plan = nativePauseMenuRenderPlan(1, null, NATIVE_DARK_CLOUD_MENU_ROWS)
  assert.deepEqual(plan.rows.map((row) => row.bounds), nativeSimpleMenuRowBounds(4))
  assert.deepEqual(plan.rows.map((row) => row.bounds.top), [301.5, 377.5, 453.5, 529.5])
  assert.deepEqual(plan.rows.map((row) => row.bounds.left), [623.5, 623.5, 623.5, 623.5])
  assert.deepEqual(plan.chrome, { bottom: 638.5, height: 377, left: 583.5, right: 1016.5, top: 261.5, width: 433 })
  assert.deepEqual(plan.header, { rotation: Math.PI / 2, x: 800, y: 219.5 })
  assert.deepEqual(plan.arrows.map((arrow) => arrow.y), [693.5, 680.5, 680.5])
  assert.deepEqual(nativePauseMenuExtent(NATIVE_DARK_CLOUD_MENU_ROWS), { height: 573, left: 583.5, top: 176.5, width: 433 })
  const pressed = nativePauseMenuRenderPlan(1, 'sign-out', NATIVE_DARK_CLOUD_MENU_ROWS)
  assert.deepEqual(pressed.rows.map((row) => row.bodyRecord), [101, 101, 102, 101])
  assert.deepEqual([pressed.rows[2]!.labelX, pressed.rows[2]!.labelY], [806, 503])
  const opening = nativePauseMenuRenderPlan(0, null, NATIVE_DARK_CLOUD_MENU_ROWS)
  assert.deepEqual([opening.chrome.top, opening.chrome.bottom], [236.5, 663.5])
  // Guests lose only the SIGN OUT row, so their three rows sit exactly where gameplay's do.
  assert.deepEqual(
    nativePauseMenuRenderPlan(1, null, NATIVE_DARK_CLOUD_GUEST_MENU_ROWS).rows.map((row) => row.bounds),
    nativePauseMenuRenderPlan(1, null).rows.map((row) => row.bounds),
  )
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

test('a row releases only its own press when focus leaves it', () => {
  // The first row owns focus after the reveal, so pressing any other row blurs it in the same gesture; that blur must
  // not release the press that just landed, or the native pressed body (UI.102) never shows for unfocused rows.
  assert.match(pauseComponent, /row: \{ action, bodyRecord, bounds, label \},\n\}: NativePauseButtonProps\)/)
  assert.match(pauseComponent, /const blur = \(\) => \{\n\s+if \(bodyRecord === 102\) release\(\)\n\s+\}/)
  assert.match(pauseComponent, /onBlur=\{blur\}/)
  assert.doesNotMatch(pauseComponent, /onBlur=\{release\}/)
})

test('pause owns the full display separately from its transformed native stage', () => {
  assert.match(
    pauseCss,
    /\.gameplay-pause-overlay\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*80;[^}]*inset:\s*0;[^}]*pointer-events:\s*auto;/s,
  )
  assert.match(
    pauseCss,
    /\.gameplay-pause-dim\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%;/s,
  )
  assert.match(
    pauseComponent,
    /gameplay-pause-overlay gameplay-pause-stage\$\{className[\s\S]*className="main-menu-native-stage gameplay-pause-native-stage"[\s\S]*style=\{style\}/,
  )
  assert.match(
    pauseComponent,
    /className="gameplay-pause-native-render"[\s\S]*renderPlan\.rows\.map\(\(row, index\) => \([\s\S]*<NativePauseButton/,
  )
})

test('each host owns its second-Escape result without changing the gameplay default', () => {
  assert.match(
    pauseComponent,
    /escapeAction = 'resume'[\s\S]*const consumeEscape =[\s\S]*event\.key !== 'Escape'[\s\S]*event\.repeat[\s\S]*event\.altKey[\s\S]*event\.ctrlKey[\s\S]*event\.metaKey[\s\S]*presentation\.kind !== 'owner'[\s\S]*if \(escapeAction\) beginClose\(escapeAction\)/,
  )
})

test('gameplay Main Menu durably saves the final host checkpoint before disconnecting', () => {
  assert.match(
    mainMenuComponent,
    /const leaveGameplay = async \(\) => \{[\s\S]*await session\.saveBeforeLeave\(\)[\s\S]*await persistSaveCheckpoint\(checkpoint\)[\s\S]*session\.destroy\(\)[\s\S]*setSession\(null\)/,
  )
  assert.match(mainMenuComponent, /setGameplayPauseMenuGeneration\(current => current \+ 1\)/)
  assert.match(mainMenuComponent, /key=\{gameplayPauseMenuGeneration\}/)
  assert.match(mainMenuComponent, /leaving \? 'Saving game…' : 'Entering the shared Hub…'/)
})

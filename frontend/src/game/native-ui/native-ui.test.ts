import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { TextureSource } from 'pixi.js'

import {
  NATIVE_UI_ATLAS_NAMES,
  NATIVE_UI_FONT_NAMES,
  NATIVE_UI_MANIFEST,
  nativeUiAtlas,
  nativeUiFont,
  nativeUiRecord,
} from './native-ui-catalog.ts'
import {
  NATIVE_UI_BUTTON,
  NATIVE_UI_MESSAGE,
  NATIVE_UI_STONE_BUTTON,
  NATIVE_UI_TAB,
  layoutNativeUiSingleActionMessage,
  nativeUiMessageActionBounds,
  nativeUiRect,
  nativeUiStripPieces,
  planNativeUiButton,
  planNativeUiButtonChrome,
  planNativeUiMessage,
  planNativeUiMessageFrame,
  planNativeUiSimpleMenu,
  planNativeUiStoneButton,
  planNativeUiTabs,
  type NativeUiNode,
} from './native-ui-plan.ts'
import {
  NATIVE_DARK_CLOUD_PRESENTATION,
  NATIVE_DARK_CLOUD_ROOT_RECORDS,
  NATIVE_DARK_CLOUD_TABS,
  planNativeDarkCloudToolButton,
} from './native-dark-cloud-contract.ts'

import {
  layoutNativeUiText,
  measureNativeUiText,
  nativeUiGlyphInkBounds,
  wrapNativeUiMsgBoxText,
  wrapNativeUiText,
} from './native-ui-text.ts'
import { nativeUiGlyphRecordTexture } from './native-ui-glyph-texture.ts'
import {
  NATIVE_UI_BOAST_SELECTED_TINT,
  NATIVE_UI_BOAST_TEXT_TINT,
  planNativeUiBoastMenu,
} from './native-ui-boast-menu.ts'
import {
  NATIVE_UI_SWIPE_BOX,
  clampNativeUiSwipeBoxOffset,
  dragNativeUiSwipeBoxOffset,
  nativeUiSwipeBoxMaximumOffset,
} from './native-ui-swipe-box.ts'
import {
  NATIVE_BOASTS,
  NATIVE_BOAST_PRESENTATION,
} from '../core-kernels/native-hub-npc.ts'
import {
  NATIVE_KILL_CHARACTER_BODY,
  NATIVE_KILL_CHARACTER_QUESTION,
  NATIVE_KILL_CHARACTER_TITLE,
  planTitleMenuPrompt,
} from '../title-menu-prompt.ts'

test('native repeated strips preserve thirds and repeat only their authored center', () => {
  assert.deepEqual(nativeUiStripPieces(102, 125), [
    { sourceLeft: 0, targetLeft: 0, width: 34 },
    { sourceLeft: 34, targetLeft: 34, width: 34 },
    { sourceLeft: 34, targetLeft: 68, width: 23 },
    { sourceLeft: 68, targetLeft: 91, width: 34 },
  ])
  assert.deepEqual(nativeUiStripPieces(21, 31.25), [
    { sourceLeft: 0, targetLeft: 0, width: 7 },
    { sourceLeft: 7, targetLeft: 7, width: 7 },
    { sourceLeft: 7, targetLeft: 14, width: 7 },
    { sourceLeft: 7, targetLeft: 21, width: 3.25 },
    { sourceLeft: 14, targetLeft: 24.25, width: 7 },
  ])
  assert.deepEqual(
    nativeUiStripPieces(112, 135).map(({ sourceLeft, targetLeft, width }) => ({
      sourceLeft: Number(sourceLeft.toFixed(6)),
      targetLeft: Number(targetLeft.toFixed(6)),
      width: Number(width.toFixed(6)),
    })),
    [
      { sourceLeft: 0, targetLeft: 0, width: 37.333333 },
      { sourceLeft: 37.333333, targetLeft: 37.333333, width: 37.333333 },
      { sourceLeft: 37.333333, targetLeft: 74.666667, width: 23 },
      { sourceLeft: 74.666667, targetLeft: 97.666667, width: 37.333333 },
    ],
  )
})

test('native UI catalog drains all stock presentation records and font wrappers', () => {
  assert.deepEqual(Object.keys(NATIVE_UI_MANIFEST.atlases).sort(), [...NATIVE_UI_ATLAS_NAMES].sort())
  assert.deepEqual(Object.keys(NATIVE_UI_MANIFEST.fonts).sort(), [...NATIVE_UI_FONT_NAMES].sort())
  const expectedCounts = {
    Bonedit: 84,
    ControlPanel: 116,
    Controls: 4,
    Create: 24,
    Fonts: 627,
    GameOver: 3,
    Inventory: 84,
    LevelPicker: 8,
    Library: 33,
    Loader: 5,
    Skills: 166,
    Title: 25,
    UI: 113,
  } as const
  for (const atlas of NATIVE_UI_ATLAS_NAMES) {
    const records = NATIVE_UI_MANIFEST.atlases[atlas].records
    assert.deepEqual(Object.keys(records).map(Number), Array.from({ length: expectedCounts[atlas] }, (_, index) => index))
    assert.ok(Object.values(records).every(({ rotated }) => rotated === false))
  }
  assert.throws(() => nativeUiRecord('UI', 113), /native UI\.113 does not exist/)
  assert.throws(() => nativeUiRecord('UI', 1.5), /nonnegative integer/)
  assert.deepEqual(nativeUiRecord('UI', 17).frame, [743, 588, 80, 83])
  assert.deepEqual(nativeUiRecord('UI', 8).frame, [824, 587, 49, 112])
})

test('native bitmap text shares exact measurement, wrapping, kerning, and no-fallback layout', () => {
  assert.deepEqual(nativeUiFont('menu').metrics, [24, 6, 28])
  assert.equal(measureNativeUiText('AV', 'menu'), 37)
  assert.equal(measureNativeUiText('A V', 'menu'), 45)
  assert.deepEqual(wrapNativeUiText('AV AV', 'menu', 40), ['AV', 'AV'])
  const layout = layoutNativeUiText({
    align: 'left',
    font: 'menu',
    text: 'AV\n☃',
    tint: 0xd9ba70,
    x: 10,
    y: 20,
  })
  assert.deepEqual(layout.lines.map(({ text, width }) => ({ text, width })), [
    { text: 'AV', width: 37 },
    { text: '☃', width: 0 },
  ])
  assert.deepEqual(layout.glyphs.map(({ centerX, centerY, record, tint }) => ({ centerX, centerY, record, tint })), [
    { centerX: 20, centerY: 12, record: 248, tint: 0xd9ba70 },
    { centerX: 37, centerY: 12, record: 269, tint: 0xd9ba70 },
  ])
  assert.deepEqual(layout.unsupportedCodePoints, [0x2603])
})

test('native bitmap glyph ink retains every authored logical canvas and trim origin', () => {
  let glyphCount = 0
  let shiftedTightFrameCount = 0
  for (const fontName of NATIVE_UI_FONT_NAMES) {
    for (const codePointText of Object.keys(nativeUiFont(fontName).glyphs)) {
      const codePoint = Number(codePointText)
      const layout = layoutNativeUiText({
        align: 'left',
        font: fontName,
        text: String.fromCodePoint(codePoint),
        x: 100,
        y: 200,
      })
      assert.equal(layout.glyphs.length, 1)
      const glyph = layout.glyphs[0]!
      const bounds = nativeUiGlyphInkBounds(glyph)
      const [, , frameWidth, frameHeight] = glyph.frame
      const [logicalWidth, logicalHeight] = glyph.logicalSize
      const [trimX, trimY] = glyph.trimOrigin
      assert.deepEqual(bounds, {
        height: frameHeight,
        left: glyph.centerX + trimX - logicalWidth / 2,
        top: glyph.centerY + trimY - logicalHeight / 2,
        width: frameWidth,
      })
      if (
        bounds.left !== glyph.centerX - frameWidth / 2
        || bounds.top !== glyph.centerY - frameHeight / 2
      ) shiftedTightFrameCount += 1
      glyphCount += 1
    }
  }
  assert.equal(glyphCount, 718)
  assert.equal(shiftedTightFrameCount, 626)

  const representativeBounds = (
    font: 'body' | 'medium' | 'menu' | 'world-and-roster',
    character: string,
  ) => nativeUiGlyphInkBounds(layoutNativeUiText({
    align: 'left',
    font,
    text: character,
    x: 100,
    y: 200,
  }).glyphs[0]!)
  assert.deepEqual(representativeBounds('menu', 's'), {
    height: 15,
    left: 100,
    top: 186,
    width: 15,
  })
  assert.deepEqual(representativeBounds('medium', 'R'), {
    height: 13,
    left: 99,
    top: 188,
    width: 15,
  })
  assert.deepEqual(representativeBounds('body', 'H'), {
    height: 11,
    left: 100,
    top: 190,
    width: 11,
  })
  assert.deepEqual(representativeBounds('world-and-roster', 'X'), {
    height: 24,
    left: 99,
    top: 184,
    width: 18,
  })
})

test('native point glyph textures and both DOM adapters keep record trim geometry', () => {
  const atlas = nativeUiAtlas('Fonts')
  const source = new TextureSource({
    height: atlas.dimensions[1],
    width: atlas.dimensions[0],
  })
  const glyph = nativeUiFont('menu').glyphs[`${'s'.codePointAt(0)!}`]!
  const texture = nativeUiGlyphRecordTexture(source, glyph)
  assert.deepEqual(rectangleValues(texture.frame), {
    height: 15,
    width: 15,
    x: 396,
    y: 236,
  })
  assert.deepEqual(rectangleValues(texture.orig), {
    height: 48,
    width: 48,
    x: 0,
    y: 0,
  })
  assert.ok(texture.trim)
  assert.deepEqual(rectangleValues(texture.trim), {
    height: 15,
    width: 15,
    x: 17,
    y: 17,
  })
  texture.destroy(true)

  const pixiSource = readFileSync(new URL('./native-ui-pixi.ts', import.meta.url), 'utf8')
  assert.match(pixiSource, /nativeUiGlyphRecordTexture\(source\.source, glyph\)/)
  for (const component of ['NativeUiPlanView.tsx', 'NativeBitmapText.tsx']) {
    const domSource = readFileSync(new URL(`./${component}`, import.meta.url), 'utf8')
    assert.match(domSource, /nativeUiGlyphInkBounds\(glyph\)/)
    assert.doesNotMatch(domSource, /glyph\.center[XY] - rendered(?:Width|Height) \/ 2/)
  }
})

function rectangleValues(rectangle: Readonly<{
  height: number
  width: number
  x: number
  y: number
}>): Readonly<{ height: number; width: number; x: number; y: number }> {
  return {
    height: rectangle.height,
    width: rectangle.width,
    x: rectangle.x,
    y: rectangle.y,
  }
}

test('native wrapper preserves authored whitespace and its overflow carry', () => {
  assert.deepEqual(
    wrapNativeUiMsgBoxText(
      "Strip away the robe and people might make comments about the kind of physique you get from years in wizarding school.  And then you'd have a completely avoidable disintegration on your conscience.",
      'medium',
      400,
    ),
    [
      'Strip away the robe and people might make',
      'comments about the kind of physique you',
      'get from years in wizarding school.  And',
      "then you'd have a completely avoidable",
      'disintegration on your conscience.',
    ],
  )
  assert.deepEqual(wrapNativeUiMsgBoxText('ONE  TWO', 'medium', 400), ['ONE  TWO'])
  assert.deepEqual(wrapNativeUiMsgBoxText('ONE\nTWO', 'medium', 400), ['ONE', 'TWO'])
  assert.deepEqual(wrapNativeUiMsgBoxText('AV AV', 'menu', 40), ['AV', '-', 'AV'])
})

test('native single-action MsgBox derives the clean-stock Robe geometry from DataLines', () => {
  const layout = layoutNativeUiSingleActionMessage({
    anchorX: 800,
    anchorY: 450,
    height: 900,
    lines: [
      { font: 'menu', gapAfter: 10, text: 'A WIZARD WOULD NEVER REMOVE HIS ROBE!' },
      {
        font: 'medium',
        text: 'A long, intimidating flowing robe looks debonaire on both a gluttonously fat slob and a pathetically wasted weakling.',
      },
      { font: 'medium', text: '' },
      {
        font: 'medium',
        text: "Strip away the robe and people might make comments about the kind of physique you get from years in wizarding school.  And then you'd have a completely avoidable disintegration on your conscience.",
      },
      { font: 'medium', text: '' },
    ],
    width: 1_600,
  })
  assert.deepEqual(layout.panelBounds, nativeUiRect(584.5, 262.5, 431, 375))
  assert.deepEqual(layout.frameBounds, nativeUiRect(535.5, 212.5, 529, 475))
  assert.deepEqual(layout.actionBounds, nativeUiRect(702, 543, 196, 69))
  assert.deepEqual(layout.lines.map(({ baselineY, text }) => ({ baselineY, text })), [
    { baselineY: 306.5, text: 'A WIZARD WOULD NEVER\nREMOVE HIS ROBE!' },
    {
      baselineY: 366.5,
      text: 'A long, intimidating flowing robe looks\ndebonaire on both a gluttonously fat slob\nand a pathetically wasted weakling.',
    },
    { baselineY: 417.5, text: '' },
    {
      baselineY: 434.5,
      text: "Strip away the robe and people might make\ncomments about the kind of physique you\nget from years in wizarding school.  And\nthen you'd have a completely avoidable\ndisintegration on your conscience.",
    },
    { baselineY: 519.5, text: '' },
  ])
})

test('stock button plans share visible and semantic geometry for every state', () => {
  const bounds = nativeUiRect(623.5, 339.5, 353, 69)
  for (const [state, bodyRecord, labelOffset, disabled] of [
    ['idle', 101, 0, false],
    ['focused', 101, 0, false],
    ['pressed', 102, 6, false],
    ['selected', 102, 6, false],
    ['disabled', 101, 0, true],
  ] as const) {
    const plan = planNativeUiButton({ bounds, id: state, label: 'RESUME GAME', state })
    assert.deepEqual(plan.actions, [{ bounds, disabled, id: state, role: 'button' }])
    const body = plan.nodes.find(({ label }) => label === `${state}:body`)
    assert.ok(body?.kind === 'sprite')
    assert.equal(body.record, bodyRecord)
    const label = plan.nodes.find(({ label }) => label === `${state}:label`)
    assert.ok(label?.kind === 'text')
    assert.equal(label.text.x, bounds.left + bounds.width / 2 + labelOffset)
    assert.equal(label.text.y, bounds.top + bounds.height / 2 + NATIVE_UI_BUTTON.labelYOffset + labelOffset)
    assert.equal(plan.nodes.some(({ label }) => label === `${state}:disabled-overlay`), disabled)
  }

  const chrome = planNativeUiButtonChrome({ bounds, id: 'exact-surround', state: 'idle' })
  assert.deepEqual(chrome.actions, [])
  assert.deepEqual(chrome.nodes, [
    {
      alpha: 1,
      atlas: 'UI',
      height: 69,
      kind: 'sprite',
      label: 'exact-surround:body',
      record: 101,
      width: 353,
      x: 623.5,
      y: 339.5,
    },
    {
      alpha: 1,
      atlas: 'UI',
      kind: 'sprite',
      label: 'exact-surround:end-left',
      record: 54,
      x: 617.5,
      y: 333.5,
    },
    {
      alpha: 1,
      atlas: 'UI',
      bounds: { height: 85, left: 687.5, top: 333.5, width: 225 },
      kind: 'slice',
      label: 'exact-surround:edge',
      record: 54,
      sourceUv: [0.95, 0, 1, 1],
    },
    {
      alpha: 1,
      atlas: 'UI',
      kind: 'sprite',
      label: 'exact-surround:end-right',
      mirrorX: true,
      record: 54,
      x: 982.5,
      y: 333.5,
    },
  ])
})

test('stock green stone buttons use the exact idle and pressed faces', () => {
  const bounds = nativeUiRect(650, 739.5, 300, 41)
  for (const [state, record, disabled] of [
    ['idle', 105, false],
    ['focused', 105, false],
    ['pressed', 106, false],
    ['selected', 106, false],
    ['disabled', 105, true],
  ] as const) {
    const plan = planNativeUiStoneButton({ bounds, id: state, label: 'DONE', state })
    assert.deepEqual(plan.actions, [{ bounds, disabled, id: state, role: 'button' }])
    const body = plan.nodes.find(({ label }) => label === `${state}:body`)
    assert.ok(body?.kind === 'sprite')
    assert.equal(body.record, record)
    assert.equal(body.width, 300)
    assert.equal(body.height, NATIVE_UI_STONE_BUTTON.sourceHeight)
    const label = plan.nodes.find(({ label }) => label === `${state}:label`)
    assert.ok(label?.kind === 'text')
    assert.equal(label.text.font, 'control-panel')
  }
})

test('Dark Cloud contract drains the complete stock root and footer membership', () => {
  assert.deepEqual(NATIVE_DARK_CLOUD_PRESENTATION.design, { height: 900, width: 1_600 })
  assert.deepEqual(NATIVE_DARK_CLOUD_PRESENTATION.geometry, {
    accountBounds: { height: 50, left: 586, top: 58, width: 428 },
    listBounds: { height: 627, left: 55, top: 173, width: 1_490 },
    optionsBounds: { height: 52, left: 1_017.5, top: 818, width: 185 },
    primaryBounds: { height: 69, left: 623.5, top: 809.5, width: 353 },
    searchBounds: { height: 52, left: 390, top: 818, width: 90 },
    searchPanelBounds: { height: 205, left: 540, top: 347.5, width: 520 },
    sortBounds: { height: 52, left: 495, top: 818, width: 90 },
    sortPanelBounds: { height: 255, left: 640, top: 347.5, width: 320 },
    tabStripBounds: { height: 69, left: 460, top: 128, width: 882 },
  })
  assert.deepEqual(NATIVE_DARK_CLOUD_ROOT_RECORDS, [
    'UI.29', 'UI.29', 'UI.31', 'UI.31', 'UI.32', 'UI.32',
    'UI.20', 'UI.20', 'UI.20', 'UI.20',
    'UI.107', 'UI.108', 'UI.109', 'UI.110',
    'UI.17', 'UI.17', 'UI.17', 'UI.17',
    'UI.13', 'UI.13', 'UI.13', 'UI.13', 'UI.13', 'UI.13', 'UI.13', 'UI.13',
    'UI.101', 'UI.54', 'UI.54',
    'UI.103', 'UI.53', 'UI.53', 'UI.58',
    'UI.103', 'UI.53', 'UI.53', 'UI.66',
    'UI.103', 'UI.53', 'UI.53', 'UI.42',
  ])
  assert.deepEqual(NATIVE_DARK_CLOUD_TABS.map(tab => tab.bounds), [
    { height: 69, left: 0, top: 0, width: 170 },
    { height: 69, left: 170, top: 0, width: 340 },
    { height: 69, left: 510, top: 0, width: 170 },
    { height: 69, left: 680, top: 0, width: 202 },
  ])
})

test('Dark Cloud tool controls use their distinct native body, surround, icon, and press states', () => {
  const bounds = nativeUiRect(0, 0, 90, 52)
  const search = planNativeDarkCloudToolButton({ bounds, iconRecord: 58, id: 'search' })
  assert.deepEqual(search.nodes.map(node => node.label), [
    'search:body', 'search:end-left', 'search:end-right', 'search:icon',
  ])
  assert.deepEqual(search.nodes.filter(node => node.kind === 'sprite').map(node => node.record), [103, 53, 53, 58])
  const pressed = planNativeDarkCloudToolButton({ bounds, iconRecord: 66, id: 'sort', state: 'pressed' })
  assert.equal(pressed.nodes[0]?.kind === 'sprite' && pressed.nodes[0].record, 104)
  const options = planNativeDarkCloudToolButton({
    bounds: nativeUiRect(0, 0, 185, 52),
    id: 'options',
    label: 'OPTIONS',
  })
  assert.equal(options.nodes.at(-1)?.kind, 'text')
  assert.throws(
    () => planNativeDarkCloudToolButton({ bounds, id: 'invalid' }),
    /requires exactly one icon or label/,
  )
})

test('Dark Cloud callers consume the semantic stock composition without retired crop skins', () => {
  const scene = readFileSync(new URL('../DarkCloudScene.tsx', import.meta.url), 'utf8')
  const panel = readFileSync(new URL('../DarkCloudPanel.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../dark-cloud.css', import.meta.url), 'utf8')
  for (const semantic of [
    'NativeDarkCloudHeading',
    'NativeDarkCloudListFrameArt',
    'NativeDarkCloudPrimaryButton',
    'NativeDarkCloudSceneArt',
    'NativeDarkCloudTabs',
    'NativeDarkCloudToolButton',
  ]) assert.match(scene, new RegExp(`<${semantic}`))
  assert.match(panel, /<NativeDarkCloudPanelArt/)
  for (const retired of [
    'account-flourish.png',
    'border-corner-',
    'button-dark-',
    'corner-gold.png',
    'panel-edge-',
    'search.png',
    'sort.png',
    'stone-button-selected.png',
    'tab-bracket.png',
    'wizard-left.png',
    'wizard-right.png',
  ]) {
    assert.equal(scene.includes(retired) || panel.includes(retired) || css.includes(retired), false)
  }
  assert.doesNotMatch(css, /\.dark-cloud-tabs button\s*\{[^}]*border-radius/s)
  assert.doesNotMatch(css, /\.dark-cloud-primary-button::(?:before|after)/)
  assert.doesNotMatch(css, /\.dark-cloud-tool-button::(?:before|after)/)
})

test('stock tabs keep bracket X fixed and move only the selected Y contract', () => {
  const recent = nativeUiRect(460, 128, 170, 69)
  const online = nativeUiRect(630, 128, 340, 69)
  const plan = planNativeUiTabs({
    height: 900,
    selectedId: 'online',
    tabs: [
      { bounds: recent, id: 'recent', label: 'RECENT' },
      { bounds: online, id: 'online', label: 'ONLINE LEVELS' },
    ],
    width: 1_600,
  })
  const recentLeft = plan.nodes.find(({ label }) => label === 'recent:bracket-left')
  const onlineLeft = plan.nodes.find(({ label }) => label === 'online:bracket-left')
  assert.ok(recentLeft?.kind === 'slice' && onlineLeft?.kind === 'slice')
  assert.equal(recentLeft.bounds.left, recent.left)
  assert.equal(onlineLeft.bounds.left, online.left)
  assert.equal(recentLeft.bounds.top, recent.top + NATIVE_UI_TAB.restingTopTrim)
  assert.equal(recentLeft.bounds.height, NATIVE_UI_TAB.restingHeight)
  assert.equal(onlineLeft.bounds.top, online.top)
  assert.equal(onlineLeft.bounds.height, NATIVE_UI_TAB.selectedHeight)
  const recentLabel = plan.nodes.find(({ label }) => label === 'recent:label')
  const onlineLabel = plan.nodes.find(({ label }) => label === 'online:label')
  assert.ok(recentLabel?.kind === 'text' && onlineLabel?.kind === 'text')
  assert.equal(recentLabel.text.y - onlineLabel.text.y, NATIVE_UI_TAB.selectedRise)
})

test('stock messages compose exact chrome and one or two action rows in order', () => {
  for (const actionCount of [1, 2]) {
    const plan = planNativeUiMessage({
      actions: Array.from({ length: actionCount }, (_, index) => ({ id: `action-${index}`, label: `ACTION ${index + 1}` })),
      body: 'A STOCK MESSAGE BODY',
      bounds: nativeUiRect(535.5, 158, 529, 384),
      height: 900,
      title: 'STOCK MESSAGE',
      width: 1_600,
    })
    assert.equal(plan.actions.length, actionCount)
    assert.deepEqual(
      plan.nodes.filter(({ label }) => label?.startsWith('message:corner-')).map((node) => (
        node.kind === 'sprite' ? node.record : -1
      )),
      [...NATIVE_UI_MESSAGE.cornerRecords],
    )
    assert.ok(plan.nodes.some((node) => node.kind === 'nine-slice' && node.record === 17))
    assert.ok(plan.nodes.some((node) => node.kind === 'text' && node.text.text === 'STOCK MESSAGE'))
  }
})

test('stock message frame is independently reusable by semantic adapters', () => {
  const bounds = nativeUiRect(550, 268, 500, 362)
  const frame = planNativeUiMessageFrame({
    body: 'BODY',
    bounds,
    height: 900,
    title: 'TITLE',
    width: 1_600,
  })
  assert.deepEqual(frame.actions, [])
  assert.ok(frame.nodes.some(({ label }) => label === 'message:background'))
  assert.ok(frame.nodes.some(({ label }) => label === 'message:title'))
  assert.deepEqual(nativeUiMessageActionBounds(bounds, 1), [
    nativeUiRect(623.5, 538, 353, 69),
  ])
  assert.deepEqual(nativeUiMessageActionBounds(bounds, 2), [
    nativeUiRect(590, 538, 206, 69),
    nativeUiRect(804, 538, 206, 69),
  ])
})

test('title Kill Character prompt preserves the settled stock lines and action geometry', () => {
  const plan = planTitleMenuPrompt({
    busy: false,
    hoveredAction: 'prompt-secondary',
    kind: 'kill-wizard',
    pressedAction: null,
  }, 0.75)
  assert.equal(NATIVE_KILL_CHARACTER_TITLE, 'Kill character?')
  assert.equal(
    NATIVE_KILL_CHARACTER_BODY,
    'Starting a new game will kill off your current game and character (Lucritius will scavenge his equipment)!',
  )
  assert.equal(NATIVE_KILL_CHARACTER_QUESTION, 'Are you sure you want to do this?')
  assert.deepEqual(plan.actions.map(({ bounds, id }) => ({ bounds, id })), [
    { bounds: nativeUiRect(595, 484, 200, 69), id: 'prompt-primary' },
    { bounds: nativeUiRect(811, 484, 200, 69), id: 'prompt-secondary' },
  ])
  const background = plan.nodes.find(({ label }) => label === 'message:background')
  assert.ok(background?.kind === 'tile')
  assert.deepEqual(background.bounds, nativeUiRect(550, 268, 500, 362))
  const title = plan.nodes.find(({ label }) => label === 'message:title')
  const body = plan.nodes.find(({ label }) => label === 'message:body')
  assert.ok(title?.kind === 'text' && body?.kind === 'text')
  assert.deepEqual([title.text.align, title.text.x, title.text.y], ['left', 626, 363])
  assert.deepEqual([body.text.x, body.text.y, body.text.lineHeight], [626, 398.5, 17])
  assert.deepEqual(layoutNativeUiText(body.text).lines.map(({ text }) => text), [
    'Starting a new game will kill off your',
    'current game and character (Lucritius',
    'will scavenge his equipment)!',
    'Are you sure you want to do this?',
  ])
  assert.equal(
    plan.nodes.find(({ label }) => label === 'prompt-secondary:body')?.kind,
    'sprite',
  )
  const secondaryBody = plan.nodes.find(({ label }) => label === 'prompt-secondary:body')
  assert.ok(secondaryBody?.kind === 'sprite')
  assert.equal(secondaryBody.record, NATIVE_UI_BUTTON.idleRecord)
})

test('tutorial offer reuses the same exact stock MsgBox composition', () => {
  const plan = planTitleMenuPrompt({
    busy: false,
    hoveredAction: null,
    kind: 'tutorial',
    pressedAction: null,
  }, 0.75)
  const body = plan.nodes.find(({ label }) => label === 'message:body')
  assert.ok(body?.kind === 'text')
  assert.deepEqual(layoutNativeUiText(body.text).lines.map(({ text }) => text), [
    'Learn the controls and confront',
    'Solomon Dark before beginning your',
    'first game.',
  ])
  assert.deepEqual(plan.actions.map(({ id }) => id), ['prompt-primary', 'prompt-secondary'])
})

test('title prompt separates its stock content from a full responsive render-target curtain', () => {
  const frame = {
    busy: false,
    hoveredAction: null,
    kind: 'tutorial' as const,
    pressedAction: null,
  }
  const stock = planTitleMenuPrompt(frame, 0.75)
  const stockCurtain = stock.nodes.find(({ label }) => label === 'message:curtain')
  assert.ok(stockCurtain?.kind === 'solid')
  assert.deepEqual(stockCurtain.bounds, nativeUiRect(0, 0, 1_600, 900))
  assert.equal(stockCurtain.alpha, 0.75)

  const content = planTitleMenuPrompt(frame, 0)
  assert.equal(content.nodes.some(({ label }) => label === 'message:curtain'), false)
  assert.deepEqual(
    content.nodes.find(({ label }) => label === 'message:background'),
    stock.nodes.find(({ label }) => label === 'message:background'),
  )
  assert.deepEqual(content.actions, stock.actions)

})

test('SimpleMenu is a reusable composition over the same stock primitives', () => {
  const plan = planNativeUiSimpleMenu({
    height: 900,
    rows: [
      { id: 'resume', label: 'RESUME GAME' },
      { id: 'settings', label: 'GAME SETTINGS', state: 'focused' },
      { id: 'leave', label: 'LEAVE GAME' },
    ],
    width: 1_600,
  })
  assert.equal(plan.opacity, 1)
  assert.equal(plan.actions.length, 3)
  const frame = plan.nodes.find((node) => node.label === 'simple-menu:frame')
  assert.ok(frame?.kind === 'nine-slice')
  assert.equal(frame.record, 17)
  assert.deepEqual(frame.bounds, nativeUiRect(583.5, 299.5, 433, 301))
  const header = plan.nodes.find((node) => node.label === 'simple-menu:header')
  assert.ok(header?.kind === 'sprite')
  assert.deepEqual([header.x, header.y, header.rotation], [800, 257.5, Math.PI / 2])
  const arrows = plan.nodes.filter(({ label }) => label?.startsWith('simple-menu:arrow-'))
  assert.equal(arrows.length, 3)
  for (const arrow of arrows) {
    assert.ok(arrow.kind === 'sprite')
    assert.equal(arrow.record, 8)
    assert.ok(arrow.y > frame.bounds.top + frame.bounds.height)
  }
  assert.deepEqual(
    arrows.map((arrow) => arrow.kind === 'sprite'
      ? [arrow.x, arrow.y, arrow.scale ?? 1]
      : null),
    [[800, 655.5, 1], [725, 642.5, 0.75], [875, 642.5, 0.75]],
  )

  const pressedMenu = planNativeUiSimpleMenu({
    height: 900,
    rows: [{ id: 'resume', label: 'RESUME GAME', state: 'pressed' }],
    width: 1_600,
  })
  const pressedButton = planNativeUiButton({
    bounds: nativeUiRect(623.5, 415.5, 353, 69),
    id: 'resume',
    label: 'RESUME GAME',
    state: 'pressed',
  })
  assert.deepEqual(
    pressedMenu.nodes.find(({ label }) => label === 'resume:label'),
    pressedButton.nodes.find(({ label }) => label === 'resume:label'),
  )

  const opening = planNativeUiSimpleMenu({
    height: 900,
    reveal: 0,
    rows: [{ id: 'resume', label: 'RESUME GAME' }],
    width: 1_600,
  })
  assert.equal(opening.opacity, 0)
  const openingFrame = opening.nodes.find((node) => node.label === 'simple-menu:frame')
  assert.ok(openingFrame?.kind === 'nine-slice')
  assert.deepEqual(openingFrame.bounds, nativeUiRect(558.5, 350.5, 483, 199))
  assert.throws(() => planNativeUiSimpleMenu({
    height: 900,
    reveal: 1.01,
    rows: [{ id: 'resume', label: 'RESUME GAME' }],
    width: 1_600,
  }), RangeError)
})

test('BoastMenu owns the exact stock BoastBox frame, five rows, fonts, and mirrored art', () => {
  const plan = planNativeUiBoastMenu({
    height: 900,
    rows: NATIVE_BOASTS.map(boast => ({
      detail: boast.statement,
      id: `native:${boast.id}`,
      label: boast.label,
      state: boast.id === 1 ? 'selected' : 'idle',
      stockIconRecord: boast.iconRecord,
    })),
    width: 1_600,
  })
  assert.deepEqual(plan.outerBounds, nativeUiRect(450, 240, 700, 560))
  assert.deepEqual(plan.viewportBounds, nativeUiRect(540, 320, 520, 400))
  assert.equal(plan.contentHeight, 495)
  assert.equal(plan.maximumScrollY, 95)
  assert.equal(plan.scrollY, 0)
  assert.deepEqual(NATIVE_BOAST_PRESENTATION.scroll, {
    pointerDrag: true,
    wheelStep: NATIVE_UI_SWIPE_BOX.wheelStep,
  })
  assert.deepEqual(plan.rowBounds.map(({ bounds }) => bounds), [
    nativeUiRect(555, 345, 490, 85),
    nativeUiRect(555, 435, 490, 85),
    nativeUiRect(555, 525, 490, 85),
    nativeUiRect(555, 615, 490, 85),
    nativeUiRect(555, 705, 490, 85),
  ])
  assert.deepEqual(plan.rowBounds.map(({ visibleBounds }) => visibleBounds), [
    nativeUiRect(555, 345, 490, 85),
    nativeUiRect(555, 435, 490, 85),
    nativeUiRect(555, 525, 490, 85),
    nativeUiRect(555, 615, 490, 85),
    nativeUiRect(555, 705, 490, 15),
  ])
  assert.deepEqual(plan.doneBounds, nativeUiRect(700, 725, 200, 40))
  assert.deepEqual(NATIVE_BOASTS.map(({ iconRecord }) => iconRecord), [90, 91, 92, 93, 94])
  assert.deepEqual(NATIVE_BOAST_PRESENTATION.iconRecords, [90, 91, 92, 93, 94, 95, 96, 97])
  const viewport = plan.nodes.find(({ label }) => label === 'boast:swipe-box')
  assert.ok(viewport?.kind === 'clip')
  assert.deepEqual(viewport.bounds, plan.viewportBounds)
  const frames = [
    ...plan.nodes.filter(node => node.label?.endsWith(':frame')),
    ...viewport.nodes.filter(node => node.label?.endsWith(':frame')),
  ]
  assert.deepEqual(frames.map(node => node.kind === 'nine-slice' ? node.record : null), [11, 50, 50, 50, 50, 50])
  const selectedFrame = viewport.nodes.find(({ label }) => label === 'native:1:frame')
  assert.ok(selectedFrame?.kind === 'nine-slice')
  assert.equal(selectedFrame.tint, NATIVE_UI_BOAST_SELECTED_TINT)
  for (const boast of NATIVE_BOASTS) {
    const left: NativeUiNode | undefined = viewport.nodes.find(
      ({ label }) => label === `native:${boast.id}:icon-left`,
    )
    const right: NativeUiNode | undefined = viewport.nodes.find(
      ({ label }) => label === `native:${boast.id}:icon-right`,
    )
    assert.ok(left?.kind === 'sprite' && right?.kind === 'sprite')
    assert.equal(left.record, boast.iconRecord)
    assert.equal(right.record, boast.iconRecord)
    assert.equal(right.mirrorX, true)
  }
  assert.deepEqual(
    NATIVE_BOASTS.map(boast => {
      const detail = viewport.nodes.find(({ label }) => label === `native:${boast.id}:detail`)
      assert.ok(detail?.kind === 'text')
      return layoutNativeUiText(detail.text).lines.map(({ text }) => text)
    }),
    [
      ['"I can do this entire mission without', 'drinking a single potion of any kind!"'],
      ['"A true magician does not wear magical', 'clothing, rings, or other implements!"'],
      ['"The learned wizard need not cast', 'secondary spells at all!"'],
      ['"A master sorceror does not choose', 'magic, the magic chooses him!"'],
      ['"A profound practicioner of magic never', 'allows his mana pool to empty!"'],
    ],
  )
  const firstDetail = viewport.nodes.find(({ label }) => label === 'native:0:detail')
  assert.ok(firstDetail?.kind === 'text')
  assert.equal(firstDetail.text.maxWidth, 370)
  assert.equal(firstDetail.text.lineHeight, 17)
  const title = plan.nodes.find(({ label }) => label === 'boast:title')
  const done = plan.nodes.find(({ label }) => label === 'boast:done-label')
  assert.ok(title?.kind === 'text' && done?.kind === 'text')
  assert.deepEqual([title.text.font, title.text.text, title.text.tint, title.text.x, title.text.y], [
    'menu', 'Select a Boast', NATIVE_UI_BOAST_TEXT_TINT, 800, 304,
  ])
  assert.deepEqual([done.text.font, done.text.text, done.text.x, done.text.y], [
    'menu', 'DONE', 800, 750,
  ])
})

test('BoastMenu scrolls one continuous clipped list and extends it for mod rows', () => {
  const plan = planNativeUiBoastMenu({
    height: 900,
    rows: [
      ...NATIVE_BOASTS.map(boast => ({
        detail: boast.statement,
        id: `native:${boast.id}`,
        label: boast.label,
        stockIconRecord: boast.iconRecord,
      })),
      { detail: 'CUSTOM DETAIL', id: 'mod:one', label: 'CUSTOM BOAST' },
    ],
    scrollY: 1_000,
    width: 1_600,
  })
  assert.equal(plan.contentHeight, 585)
  assert.equal(plan.maximumScrollY, 185)
  assert.equal(plan.scrollY, 185)
  assert.deepEqual(plan.rowBounds[0]?.bounds, nativeUiRect(555, 160, 490, 85))
  assert.equal(plan.rowBounds[0]?.visibleBounds, null)
  assert.deepEqual(plan.rowBounds[1]?.visibleBounds, nativeUiRect(555, 320, 490, 15))
  assert.deepEqual(plan.rowBounds[5]?.visibleBounds, nativeUiRect(555, 610, 490, 85))
  assert.deepEqual(plan.customIcons, [{
    id: 'mod:one',
    leftEdgeX: 570,
    rightEdgeX: 1_030,
    selected: false,
    y: 652.5,
  }])
  assert.deepEqual(
    plan.actions.map(({ id }) => id),
    ['done', 'native:1', 'native:2', 'native:3', 'native:4', 'mod:one'],
  )
  assert.equal(plan.nodes.some(({ label }) => label === 'boast:next'), false)
  assert.equal(plan.nodes.some(({ label }) => label === 'boast:previous'), false)
})

test('SwipeBox offset follows native previous-minus-current drag and clamps to content', () => {
  assert.equal(nativeUiSwipeBoxMaximumOffset(495, 400), 95)
  assert.equal(clampNativeUiSwipeBoxOffset(-20, 495, 400), 0)
  assert.equal(clampNativeUiSwipeBoxOffset(200, 495, 400), 95)
  assert.equal(dragNativeUiSwipeBoxOffset(0, 650, 600, 495, 400), 50)
  assert.equal(dragNativeUiSwipeBoxOffset(50, 600, 500, 495, 400), 95)
  assert.equal(dragNativeUiSwipeBoxOffset(95, 500, 650, 495, 400), 0)
})

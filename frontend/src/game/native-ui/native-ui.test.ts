import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  NATIVE_UI_ATLAS_NAMES,
  NATIVE_UI_FONT_NAMES,
  NATIVE_UI_MANIFEST,
  nativeUiFont,
  nativeUiRecord,
} from './native-ui-catalog.ts'
import {
  NATIVE_UI_BUTTON,
  NATIVE_UI_MESSAGE,
  NATIVE_UI_TAB,
  nativeUiRect,
  planNativeUiButton,
  planNativeUiMessage,
  planNativeUiSimpleMenu,
  planNativeUiTabs,
} from './native-ui-plan.ts'
import {
  layoutNativeUiText,
  measureNativeUiText,
  wrapNativeUiText,
} from './native-ui-text.ts'
import {
  NATIVE_KILL_CHARACTER_BODY,
  NATIVE_KILL_CHARACTER_QUESTION,
  NATIVE_KILL_CHARACTER_TITLE,
  planTitleMenuPrompt,
} from '../title-menu-prompt.ts'

test('native UI catalog drains all stock presentation records and font wrappers', () => {
  assert.deepEqual(NATIVE_UI_MANIFEST.summary, {
    atlasCount: 12,
    fontCount: 10,
    glyphCount: 718,
    recordCount: 1_259,
  })
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

test('stock button plans share visible and semantic geometry for every state', () => {
  const bounds = nativeUiRect(623.5, 339.5, 353, 69)
  for (const [state, bodyRecord, disabled] of [
    ['idle', 101, false],
    ['focused', 102, false],
    ['pressed', 102, false],
    ['selected', 102, false],
    ['disabled', 101, true],
  ] as const) {
    const plan = planNativeUiButton({ bounds, id: state, label: 'RESUME GAME', state })
    assert.deepEqual(plan.actions, [{ bounds, disabled, id: state, role: 'button' }])
    assert.equal(plan.nodes[0]!.kind, 'sprite')
    if (plan.nodes[0]!.kind === 'sprite') assert.equal(plan.nodes[0]!.record, bodyRecord)
    assert.ok(plan.nodes.some((node) => node.kind === 'slice' && node.record === NATIVE_UI_BUTTON.surroundEndRecord))
    assert.equal(plan.nodes.some(({ label }) => label === `${state}:disabled-overlay`), disabled)
  }
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
  assert.equal(secondaryBody.record, NATIVE_UI_BUTTON.pressedRecord)
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
  assert.equal(plan.actions.length, 3)
  assert.ok(plan.nodes.some((node) => node.label === 'simple-menu:frame' && node.kind === 'nine-slice'))
  assert.equal(plan.nodes.filter(({ label }) => label?.startsWith('simple-menu:arrow-')).length, 3)
})

test('existing WebGL and DOM owners consume the shared native UI seam', () => {
  const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
  for (const path of [
    '../renderer/gameplay-pause-renderer.ts',
    '../renderer/skill-picker-renderer.ts',
    '../renderer/hub-inventory-renderer.ts',
  ]) {
    assert.match(source(path), /nativeUi(PixiFor|Record|PixiAdapter)/)
  }
  assert.match(source('../NativeGameOverPrompt.tsx'), /NativeBitmapText/)
  assert.match(source('../NativeLootBitmapText.tsx'), /NativeBitmapText/)
  assert.match(source('../GameplayPauseMenu.tsx'), /NativeBitmapText/)
  assert.doesNotMatch(source('../renderer/hub-inventory-renderer.ts'), /hub-trader-native-assets\.json|skill-picker-native-assets\.json/)
  assert.doesNotMatch(source('../renderer/skill-picker-renderer.ts'), /skill-picker-native-assets\.json/)
})

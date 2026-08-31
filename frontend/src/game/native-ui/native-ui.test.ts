import assert from 'node:assert/strict'
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
  nativeUiMessageActionBounds,
  nativeUiRect,
  nativeUiStripPieces,
  planNativeUiButton,
  planNativeUiButtonChrome,
  planNativeUiMessage,
  planNativeUiMessageFrame,
  planNativeUiSimpleMenu,
  planNativeUiTabs,
} from './native-ui-plan.ts'

import {
  layoutNativeUiText,
  measureNativeUiText,
  wrapNativeUiText,
} from './native-ui-text.ts'
import {
  NATIVE_UI_BOAST_SELECTED_TINT,
  NATIVE_UI_BOAST_TEXT_TINT,
  planNativeUiBoastMenu,
} from './native-ui-boast-menu.ts'
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
  assert.deepEqual(plan.rowBounds.map(({ bounds }) => bounds), [
    nativeUiRect(555, 345, 490, 85),
    nativeUiRect(555, 435, 490, 85),
    nativeUiRect(555, 525, 490, 85),
    nativeUiRect(555, 615, 490, 85),
    nativeUiRect(555, 705, 490, 85),
  ])
  assert.deepEqual(plan.doneBounds, nativeUiRect(700, 725, 200, 40))
  assert.deepEqual(NATIVE_BOASTS.map(({ iconRecord }) => iconRecord), [90, 91, 92, 93, 94])
  assert.deepEqual(NATIVE_BOAST_PRESENTATION.iconRecords, [90, 91, 92, 93, 94, 95, 96, 97])
  const frames = plan.nodes.filter(node => node.label?.endsWith(':frame'))
  assert.deepEqual(frames.map(node => node.kind === 'nine-slice' ? node.record : null), [11, 50, 50, 50, 50, 50])
  const selectedFrame = plan.nodes.find(({ label }) => label === 'native:1:frame')
  assert.ok(selectedFrame?.kind === 'nine-slice')
  assert.equal(selectedFrame.tint, NATIVE_UI_BOAST_SELECTED_TINT)
  for (const boast of NATIVE_BOASTS) {
    const left = plan.nodes.find(({ label }) => label === `native:${boast.id}:icon-left`)
    const right = plan.nodes.find(({ label }) => label === `native:${boast.id}:icon-right`)
    assert.ok(left?.kind === 'sprite' && right?.kind === 'sprite')
    assert.equal(left.record, boast.iconRecord)
    assert.equal(right.record, boast.iconRecord)
    assert.equal(right.mirrorX, true)
  }
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

test('BoastMenu reserves custom icon placements and paginates without shrinking stock rows', () => {
  const plan = planNativeUiBoastMenu({
    height: 900,
    pageCount: 2,
    pageIndex: 1,
    rows: [{ detail: 'CUSTOM DETAIL', id: 'mod:one', label: 'CUSTOM BOAST' }],
    width: 1_600,
  })
  assert.deepEqual(plan.rowBounds[0]?.bounds, nativeUiRect(555, 345, 490, 85))
  assert.deepEqual(plan.customIcons, [{
    id: 'mod:one',
    leftEdgeX: 570,
    rightEdgeX: 1_030,
    selected: false,
    y: 387.5,
  }])
  assert.deepEqual(plan.actions.map(({ id }) => id), ['done', 'mod:one', 'previous'])
  assert.equal(plan.nodes.some(({ label }) => label === 'boast:next'), false)
  const previous = plan.nodes.find(({ label }) => label === 'boast:previous')
  assert.ok(previous?.kind === 'text')
  assert.deepEqual(
    [previous.text.font, previous.text.text, previous.text.x, previous.text.y],
    ['menu', 'PREVIOUS', 535, 304],
  )
  assert.equal(
    plan.nodes.some(node => node.kind === 'sprite' && node.atlas === 'UI' && node.record === 8),
    false,
  )
  assert.deepEqual(
    plan.actions.find(({ id }) => id === 'previous')?.bounds,
    nativeUiRect(470, 280, 130, 48),
  )
  assert.throws(() => planNativeUiBoastMenu({
    height: 900,
    rows: Array.from({ length: 6 }, (_, id) => ({ detail: '', id: `${id}`, label: '' })),
    width: 1_600,
  }), /at most 5 rows/)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import nativeAssetsJson from '../../assets/game/hub-trader-native-assets.json' with { type: 'json' }
import {
  HUB_CHAT_PANEL,
  HUB_DOWSING_FIELD,
  HUB_DOWSING_MSGBOX,
  HUB_DOWSING_PREROLL,
  HUB_DOWSING_FLASH,
  HUB_DOWSING_INSUFFICIENT_GOLD,
  HUB_DOWSING_GRID,
  HUB_HAGATHA_PERK_PANE,
  HUB_INVENTORY_GRID,
  HUB_NATIVE_UI_TIMING,
  HUB_NATIVE_UI_SIZE,
  HUB_NATIVE_UI_SURFACES,
  HUB_SHOP_GRID,
  HUB_SHOP_PANEL,
  HUB_SHOP_TEXT,
  hubDowsingSlotPosition,
  hubDowsingFieldTint,
  hubInventoryPrimarySpellLines,
  hubInventorySlotPosition,
  hubShopSlotPosition,
} from './hub-inventory-render-contract.ts'

test('stock inventory owns the fixed 1600 by 900 stage and all 88 authored cells', () => {
  assert.deepEqual(HUB_NATIVE_UI_SIZE, { height: 900, width: 1600 })
  assert.equal(HUB_INVENTORY_GRID.columns * HUB_INVENTORY_GRID.rows, 88)
  assert.equal(HUB_INVENTORY_GRID.slotAlpha, 0.4)
  assert.deepEqual(hubInventorySlotPosition(0), { x: 24, y: 496 })
  assert.deepEqual(hubInventorySlotPosition(1), { x: 24, y: 571 })
  assert.deepEqual(hubInventorySlotPosition(4), { x: 99, y: 496 })
  assert.deepEqual(hubInventorySlotPosition(87), { x: 1599, y: 721 })
  assert.throws(() => hubInventorySlotPosition(88), /\[0, 87\]/)
})

test('stock inventory derives every elemental primary stat pane from native skill ranks', () => {
  assert.deepEqual(hubInventoryPrimarySpellLines('ether', [[8, 1, 1]]), [
    'MAGIC MISSILE',
    'DAMAGE: 1 - 2',
    'MANA COST: 6',
    'MANA HEAL: 10 / SEC',
  ])
  assert.deepEqual(hubInventoryPrimarySpellLines('fire', [[16, 1, 1]]), [
    'FIREBALL',
    'DAMAGE: 4',
    'MANA COST: 12',
    'MANA HEAL: 10 / SEC',
  ])
  assert.deepEqual(hubInventoryPrimarySpellLines('air', [[24, 1, 1]]), [
    'LIGHTNING',
    'DAMAGE: 2.5 / SECOND',
    'MANA COST: 12 / SEC',
    'MANA HEAL: 10 / SEC',
  ])
  assert.deepEqual(hubInventoryPrimarySpellLines('water', [[32, 1, 1]]), [
    'FROST JET',
    'DAMAGE: 2.5 / SECOND',
    'MANA COST: 12.5 / SEC',
    'MANA HEAL: 10 / SEC',
  ])
  assert.deepEqual(hubInventoryPrimarySpellLines('earth', [[40, 1, 1]]), [
    'BOULDER',
    'TOTAL DAMAGE: 10 X SIZE',
    'MANA COST: 12 / SEC',
    'MANA HEAL: 10 / SEC',
  ])
})

test('shop and dowsing screens use the recovered stock grids without invented pages', () => {
  assert.deepEqual(HUB_SHOP_GRID, {
    cellSize: 72,
    columns: 7,
    left: 539,
    pitchX: 75,
    pitchY: 75,
    retainedCapacity: 28,
    rows: 4,
    slotAlpha: 0.6,
    top: 56.5,
  })
  assert.deepEqual(hubShopSlotPosition(0), { x: 539, y: 56.5 })
  assert.deepEqual(hubShopSlotPosition(1), { x: 539, y: 131.5 })
  assert.deepEqual(hubShopSlotPosition(4), { x: 614, y: 56.5 })
  assert.deepEqual(hubShopSlotPosition(27), { x: 989, y: 281.5 })
  assert.throws(() => hubShopSlotPosition(28), /\[0, 27\]/)
  assert.deepEqual(HUB_DOWSING_GRID, {
    cellSize: 72,
    columns: 3,
    left: 689,
    pitchX: 75,
    pitchY: 75,
    retainedCapacity: 9,
    rows: 3,
    slotAlpha: 0.6,
    top: 94,
  })
  assert.deepEqual(hubDowsingSlotPosition(8), { x: 839, y: 244 })
  assert.deepEqual(HUB_SHOP_PANEL, {
    backgroundHeight: 400,
    backgroundRepeat: [4, 2],
    doneInnerTint: 0xbfffbf,
    doneMiddleAlpha: 0.85,
    doneRect: [714.5, 358, 171, 58],
    height: 430,
    settledLeft: 498,
    settledTop: -20,
    slideDistance: 100,
    width: 604,
  })
})

test('trader Chat owns its stock panel, clip, controls, and timing independently of MsgBox', () => {
  assert.deepEqual(HUB_CHAT_PANEL, {
    actionTextTint: 0x8cbf8c,
    contentHeight: 250,
    contentLeft: 561.5,
    contentTop: 111,
    contentWidth: 477,
    doneRect: [730, 370, 140, 45],
    doneTextBaselineY: 396,
    edgeUvOrigin: 0.95,
    height: 420,
    left: 476.5,
    primaryChoiceRect: [590, 195, 420, 43],
    primaryChoiceTextBaselineY: 226,
    secondaryChoiceRect: [690, 235, 220, 32],
    secondaryChoiceTextBaselineY: 256,
    top: 26,
    titleCenterX: 800,
    titleCenterY: 90,
    titleTextBaselineY: 90,
    textTint: 0xd9ba70,
    uiRecord: 11,
    width: 647,
  })
  assert.deepEqual(HUB_SHOP_TEXT, {
    affordableTint: 0xd9ba70,
    goldTint: 0xd9ba70,
    normalBackgroundTint: 0xd9ffd9,
    priceFont: 'body',
    priceTextBaselineOffsetY: 67,
    priceTextRightOffsetX: 67,
    doneTextBaselineY: 392,
    titleTextBaselineY: 32,
    unaffordableTint: 0xff8080,
  })
  assert.equal(HUB_NATIVE_UI_TIMING.chatRevealPerTick, 0.05)
  assert.equal(HUB_NATIVE_UI_TIMING.chatScrollPerTick, 0.125)
  assert.equal(HUB_NATIVE_UI_TIMING.chatAcceleratedScrollPerTick, 0.8)
  assert.equal(HUB_NATIVE_UI_TIMING.messageBoxRevealPerTick, 0.035)
})

test('dowsing preserves the stock red flash and insufficient-gold message branch', () => {
  assert.deepEqual(HUB_DOWSING_FLASH, {
    decrementPerTick: 0.05,
    durationMs: 200,
    durationTicks: 20,
  })
  assert.equal(HUB_DOWSING_INSUFFICIENT_GOLD.title, 'NOT ENOUGH GOLD!')
  assert.match(HUB_DOWSING_INSUFFICIENT_GOLD.body, /endless, swirling, impossible colors/)
  assert.deepEqual(HUB_DOWSING_PREROLL, {
    buttonCenter: [800, 300],
    buttonRect: [623.5, 265.5, 353, 69],
    buttonSideCenters: [[704, 302], [896, 302]],
    feeTextBaselineY: 322.5,
    labelTextBaselineY: 302,
    mirrorPromptRect: [693, 54.5, 214, 41],
    referenceDropRect: [750, 101, 100, 149],
  })
  assert.deepEqual(HUB_DOWSING_MSGBOX, {
    arrowCentersAndScales: [[800, 592, 1], [725, 579, 0.75], [875, 579, 0.75]],
    bodyLeft: 609,
    bodyMaxWidth: 382,
    bodyTextBaselineY: 287.5,
    horizontalEdgeRecord: 10,
    interiorBackgroundRecord: null,
    interiorFill: null,
    innerCornerCenters: [[580.5, 204.5], [1019.5, 204.5], [580.5, 495.5], [1019.5, 495.5]],
    outerCornerCenters: [[564.5, 190], [1035.5, 190], [564.5, 510], [1035.5, 510]],
    primaryButtonCenter: [800, 432],
    primaryButtonRect: [623.5, 397.5, 353, 69],
    primaryButtonSideCenters: [[731, 434], [869, 434]],
    primaryButtonTextBaselineY: 440,
    primaryButtonTextTint: 0xd9ba70,
    skullHeaderCenter: [800, 121],
    titleTextBaselineY: 252,
    verticalEdgeRecord: 79,
  })
  assert.deepEqual(HUB_HAGATHA_PERK_PANE, {
    bundleCenter: [253, 288],
    columns: 3,
    emptySlotTint: 0x808080,
    innerHeight: 238,
    innerPanelTint: 0x1a1a17,
    innerWidth: 227,
    left: 139,
    rows: 3,
    slotCenterOrigin: [193, 198],
    slotPitch: 60,
    slotScale: 0.8,
    titleTint: 0xd9ba70,
    titleCenterX: 253,
    titleTextBaselineY: 152.5,
    top: 129,
  })
  assert.deepEqual(HUB_DOWSING_FIELD, {
    greenAmplitude: 0.1,
    greenBase: 0.7,
    phaseDegreesPerTick: 0.5,
    periodTicks: 720,
  })
  assert.equal(hubDowsingFieldTint(0), 0xffb3ff)
  assert.equal(hubDowsingFieldTint(180), 0xffccff)
  assert.equal(hubDowsingFieldTint(540), 0xff99ff)
  assert.equal(hubDowsingFieldTint(720), 0xffb3ff)
})

test('the port exports the complete stock UI membership', () => {
  assert.equal(Object.keys(nativeAssetsJson.atlases.Inventory.records).length, 84)
  assert.equal(Object.keys(nativeAssetsJson.atlases.Skills.records).length, 166)
  assert.equal(Object.keys(nativeAssetsJson.atlases.UI.records).length, 113)
  assert.deepEqual(HUB_NATIVE_UI_SURFACES, [
    'dialogue',
    'fomentius-shop',
    'hagatha-perk-shop',
    'luthacus-inventory-shop',
    'shlorio-dowsing-before-roll',
    'shlorio-dowsing-flash',
    'shlorio-dowsing-results',
    'shlorio-insufficient-gold-message',
    'inventory',
  ])
})

test('visible hub inventory presentation is owned by the native WebGL renderer', () => {
  const source = readFileSync(new URL('../HubInventoryUi.tsx', import.meta.url), 'utf8')
  const rendererSource = readFileSync(new URL('./hub-inventory-renderer.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /function ModalFrame/)
  assert.doesNotMatch(source, /function NativeAtlasSprite/)
  assert.match(source, /createHubInventoryRenderer/)
  assert.match(rendererSource, /'UI', 62/)
  assert.match(rendererSource, /addNativeNineSlice\(/)
  assert.match(rendererSource, /atlasSliceTexture\(context, atlas, record, edgeUvOrigin, 0, 1, 1\)/)
  assert.match(rendererSource, /'UI', 73/)
  assert.match(rendererSource, /'UI', 74/)
  assert.match(rendererSource, /item\.price > model\.economy\.gold \? 46 : 84/)
  assert.match(rendererSource, /`\$\{item\.price\}`,[\s\S]*?HUB_SHOP_TEXT\.priceFont/)
  assert.doesNotMatch(rendererSource, /`\$\{item\.price\}`, 'skill'/)
  assert.match(rendererSource, /'UI', 86/)
  assert.match(rendererSource, /'UI', 71, 21, 481/)
  assert.match(rendererSource, /'Inventory', 8, 557\.5, 16\.5/)
  assert.doesNotMatch(rendererSource, /'Inventory', 10, position\.x, position\.y, \{ scale:/)
  assert.match(rendererSource, /slot\.alpha = HUB_INVENTORY_GRID\.slotAlpha/)
  assert.match(rendererSource, /slot\.alpha = HUB_SHOP_GRID\.slotAlpha/)
  assert.match(rendererSource, /slot\.alpha = HUB_DOWSING_GRID\.slotAlpha/)
  assert.match(rendererSource, /owner === 'storage'[\s\S]*111/)
  assert.doesNotMatch(source, /Previous page|Next page|Goodbye|Your Prices/)
  assert.match(rendererSource, /dowsingFlash\.alpha = 1/)
  assert.match(rendererSource, /dataset\.dowsingFlash = 'active'/)
  assert.match(rendererSource, /dataset\.nativeReveal = clampedReveal >= 1 \? 'settled' : 'revealing'/)
  assert.match(rendererSource, /dataset\.nativeNoticeReveal/)
  assert.match(rendererSource, /typeof child\.label === 'string'/)
  assert.doesNotMatch(rendererSource, /Math\.random\(\)/)
  assert.doesNotMatch(rendererSource, /addTiledAtlas\(context, noticeLayer, 'UI', 49/)
})

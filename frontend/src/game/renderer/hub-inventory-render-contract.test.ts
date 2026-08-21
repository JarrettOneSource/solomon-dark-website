import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import nativeAssetsJson from '../../assets/game/hub-trader-native-assets.json' with { type: 'json' }
import {
  HUB_CHAT_PANEL,
  HUB_CHAT_INLINE_EMPHASIS,
  HUB_DOWSING_FIELD,
  HUB_DOWSING_MSGBOX,
  HUB_DOWSING_PREROLL,
  HUB_DOWSING_FLASH,
  HUB_DOWSING_INSUFFICIENT_GOLD,
  HUB_DOWSING_GRID,
  HUB_HAGATHA_PERK_PANE,
  HUB_HAT_REMOVAL_MSGBOX,
  HUB_INVENTORY_GRID,
  HUB_INVENTORY_INTERACTION,
  HUB_EQUIPMENT_SINK_RENDER,
  HUB_ITEM_ICON_TRANSFORMS,
  HUB_NATIVE_UI_TIMING,
  HUB_NATIVE_UI_SIZE,
  HUB_NATIVE_UI_SURFACES,
  HUB_PRIMARY_SPELL_PANE,
  HUB_ROBE_REMOVAL_MSGBOX,
  HUB_SHOP_GRID,
  HUB_SHOP_PANEL,
  HUB_SHOP_TEXT,
  HUB_STARTER_EQUIPMENT_PRIMARY_TINT,
  HUB_UNFORGE_CONFIRMATION,
  HUB_UNFORGE_RESULT,
  HUB_UNFORGE_TARGET,
  hubDowsingSlotPosition,
  hubDowsingFieldTint,
  hubChatTextRuns,
  hubInventoryPrimarySpellLines,
  hubInventoryItemInfoText,
  hubInventoryEquipmentSlotRects,
  hubInventorySlotPosition,
  hubShopSlotPosition,
  hubUnforgeResultLayout,
  hubUnforgeTargetTint,
} from './hub-inventory-render-contract.ts'

const inventoryComponent = readFileSync(new URL('../HubInventoryUi.tsx', import.meta.url), 'utf8')
const inventoryCss = readFileSync(new URL('../hub-inventory.css', import.meta.url), 'utf8')
const mainScene = readFileSync(new URL('../MainMenuScene.tsx', import.meta.url), 'utf8')
const hubScene = readFileSync(new URL('../HubScene.tsx', import.meta.url), 'utf8')
const boneyardScene = readFileSync(new URL('../BoneyardScene.tsx', import.meta.url), 'utf8')

test('every inventory and trader modal consumes the shell fixed-stage projection', () => {
  assert.equal(mainScene.match(/nativeUiStageStyle=\{nativeStageStyle\}/g)?.length, 2)
  for (const scene of [hubScene, boneyardScene]) {
    assert.match(scene, /nativeUiStageStyle: CSSProperties/)
    assert.match(scene, /<HubInventoryUi[\s\S]*nativeUiStageStyle=\{nativeUiStageStyle\}/)
  }
  assert.match(
    inventoryComponent,
    /className="hub-native-ui-overlay"[\s\S]*className="hub-native-ui-stage"[\s\S]*style=\{style\}/,
  )
  assert.match(
    inventoryCss,
    /\.hub-native-ui-overlay\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*30000;[^}]*inset:\s*0;[^}]*background:\s*#000;/s,
  )
  assert.match(
    inventoryCss,
    /\.hub-native-ui-stage\s*\{[^}]*width:\s*1600px;[^}]*height:\s*900px;/s,
  )
  assert.match(inventoryComponent, /closest\('\.hub-native-ui-stage'\)/)
})

test('stock inventory owns the fixed 1600 by 900 stage and all 88 authored cells', () => {
  assert.deepEqual(HUB_NATIVE_UI_SIZE, { height: 900, width: 1600 })
  assert.equal(HUB_INVENTORY_GRID.columns * HUB_INVENTORY_GRID.rows, 88)
  assert.equal(HUB_INVENTORY_GRID.slotAlpha, 0.4)
  assert.deepEqual(hubInventorySlotPosition(0), { x: 24, y: 496 })
  assert.deepEqual(hubInventorySlotPosition(1), { x: 24, y: 571 })
  assert.deepEqual(hubInventorySlotPosition(4), { x: 99, y: 496 })
  assert.deepEqual(hubInventorySlotPosition(87), { x: 1599, y: 721 })
  assert.throws(() => hubInventorySlotPosition(88), /\[0, 87\]/)
  assert.deepEqual(hubInventoryEquipmentSlotRects('weapon'), [
    [1274, 223, 72, 72],
    [1434, 223, 72, 72],
  ])
  assert.deepEqual(hubInventoryEquipmentSlotRects('weapon', true), [
    [1221, 223, 72, 72],
    [1381, 223, 72, 72],
  ])
  assert.deepEqual(hubInventoryEquipmentSlotRects('robe'), [[1354, 223, 72, 108]])
  assert.deepEqual(hubInventoryEquipmentSlotRects('robe', true), [[1301, 223, 72, 108]])
})

test('stock inventory owns native ItemInfo, drag, double activation, and protected clothing copy', () => {
  assert.deepEqual(HUB_INVENTORY_INTERACTION, {
    doubleActivationMs: 500,
    doubleActivationTicks: 50,
    dragThresholdPixels: 10,
    itemInfoDelayMs: 200,
    itemInfoDelayTicks: 20,
    itemInfoOffset: 40,
    itemInfoPadding: 20,
    itemInfoViewportMargin: 25,
    selectionTint: 0x00c020,
  })
  const item = {
    equipmentType: null,
    iconRecords: [46],
    id: 1,
    kind: 'health-potion',
    name: 'Health Potion',
    nativeSubtype: 0,
    nativeTypeId: 7001,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  } as const
  assert.deepEqual(hubInventoryItemInfoText(item), {
    description: 'Restores your health to maximum',
    instruction: 'Double-click to drink',
    title: 'Health Potion',
  })
  assert.equal(HUB_HAT_REMOVAL_MSGBOX.title, 'A WIZARD WOULD NEVER REMOVE HIS HAT!')
  assert.match(HUB_HAT_REMOVAL_MSGBOX.body, /jaunty angle/)
  assert.equal(HUB_ROBE_REMOVAL_MSGBOX.title, 'A WIZARD WOULD NEVER REMOVE HIS ROBE!')
  assert.match(HUB_ROBE_REMOVAL_MSGBOX.body, /avoidable disintegration/)
})

test('the unforge anvil owns its native drop geometry, pulse, and dialog layouts', () => {
  assert.deepEqual(HUB_UNFORGE_TARGET.rect, [1500, 800, 100, 100])
  assert.deepEqual(HUB_UNFORGE_TARGET.center, [1562, 868])
  assert.equal(hubUnforgeTargetTint(0), 0x99ffff)
  assert.equal(hubUnforgeTargetTint(90), 0xccffff)
  assert.equal(hubUnforgeTargetTint(270), 0x66ffff)
  assert.deepEqual(HUB_UNFORGE_CONFIRMATION.innerPanelRect, [544.5, 387.5, 514, 326])
  assert.deepEqual(HUB_UNFORGE_CONFIRMATION.primaryButtonRect, [589, 567, 209, 85])
  assert.deepEqual(HUB_UNFORGE_CONFIRMATION.secondaryButtonRect, [805, 567, 209, 85])
  assert.deepEqual(HUB_UNFORGE_RESULT.innerPanelRect, [606.5, 396.5, 390, 308])
  assert.deepEqual(HUB_UNFORGE_RESULT.primaryButtonRect, [697, 558, 209, 85])
  assert.deepEqual(hubUnforgeResultLayout(249), {
    bodyLeft: 677,
    innerPanelRect: [606.5, 396.5, 390, 308],
    primaryButtonRect: [697, 558, 209, 85],
  })
  assert.deepEqual(hubUnforgeResultLayout(460), {
    bodyLeft: 571.5,
    innerPanelRect: [501, 396.5, 601, 308],
    primaryButtonRect: [697, 558, 209, 85],
  })
  assert.throws(() => hubUnforgeResultLayout(Number.NaN), /finite and nonnegative/)
})

test('stock equipment icons retain class-owned natural transforms and starter appearance colors', () => {
  assert.deepEqual(HUB_ITEM_ICON_TRANSFORMS, {
    amulet: { rotationDegrees: 0, translation: [0, -5] },
    hat: { rotationDegrees: 0, translation: [0, 0] },
    ring: { rotationDegrees: 0, translation: [0, 0] },
    robe: { rotationDegrees: 0, translation: [0, 0] },
    staff: { rotationDegrees: 35, translation: [-22.94306, 32.76608] },
    wand: { rotationDegrees: 45, translation: [0, 0] },
  })
  assert.deepEqual(HUB_STARTER_EQUIPMENT_PRIMARY_TINT, {
    air: 0xa0c3c3,
    earth: 0x90b390,
    ether: 0x886688,
    fire: 0x998077,
    water: 0x5e6e81,
  })
  assert.deepEqual(HUB_EQUIPMENT_SINK_RENDER, {
    interiorTint: 0x191916,
    normalFrameRecord: 10,
    smallFrameRecord: 9,
    tallPrimitiveOutline: true,
  })
})

test('stock inventory derives every elemental primary stat pane from native skill ranks', () => {
  assert.deepEqual(HUB_PRIMARY_SPELL_PANE, {
    bodyRect: [86, 230, 227, 79],
    companionShift: 53,
    contentAdvanceScale: 0.9,
    contentFont: 'medium',
    contentTextBaselines: [251, 273, 286, 299],
    headingRect: [86, 207, 227, 24],
    headingFont: 'body',
    headingTextBaselineY: 226,
    inlineUnit: { italic: true, offset: [0, 1], scale: 0.7 },
    textLeft: 95,
    textTint: 0xc8f3f3,
  })
  assert.deepEqual(hubInventoryPrimarySpellLines('ether', [[8, 1, 1]]), [
    { text: 'MAGIC MISSILE', unit: null },
    { text: 'DAMAGE: 1 - 2', unit: null },
    { text: 'MANA COST: 6', unit: null },
    { text: 'MANA HEAL: 10', unit: ' / SEC' },
  ])
  assert.deepEqual(hubInventoryPrimarySpellLines('fire', [[16, 1, 1]]), [
    { text: 'FIREBALL', unit: null },
    { text: 'DAMAGE: 4', unit: null },
    { text: 'MANA COST: 12', unit: null },
    { text: 'MANA HEAL: 10', unit: ' / SEC' },
  ])
  assert.deepEqual(hubInventoryPrimarySpellLines('air', [[24, 1, 1]]), [
    { text: 'LIGHTNING', unit: null },
    { text: 'DAMAGE: 2.5', unit: ' / SECOND' },
    { text: 'MANA COST: 12', unit: ' / SEC' },
    { text: 'MANA HEAL: 10', unit: ' / SEC' },
  ])
  assert.deepEqual(hubInventoryPrimarySpellLines('water', [[32, 1, 1]]), [
    { text: 'FROST JET', unit: null },
    { text: 'DAMAGE: 2.5', unit: ' / SECOND' },
    { text: 'MANA COST: 12.5', unit: ' / SEC' },
    { text: 'MANA HEAL: 10', unit: ' / SEC' },
  ])
  assert.deepEqual(hubInventoryPrimarySpellLines('earth', [[40, 1, 1]]), [
    { text: 'BOULDER', unit: null },
    { text: 'TOTAL DAMAGE: 10 X SIZE', unit: null },
    { text: 'MANA COST: 12', unit: ' / SEC' },
    { text: 'MANA HEAL: 10', unit: ' / SEC' },
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
    backgroundBlendModes: ['normal', 'add'],
    backgroundTileExtent: [264, 264],
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

test('trader Chat preserves ExactText inline italic commands and authored spacing', () => {
  assert.deepEqual(HUB_CHAT_INLINE_EMPHASIS, {
    exactTextCommand: 'i',
    exactTextMarker: '_',
    fontLineHeight: 24,
    glyphBottomDelta: -3,
    glyphTopDelta: 3,
    italicFactor: 0.125,
    sourceDelimiter: '*',
  })
  assert.deepEqual(hubChatTextRuns("But it's a lot *less* work.  Fair do's."), [
    { italic: false, text: "But it's a lot " },
    { italic: true, text: 'less' },
    { italic: false, text: " work.  Fair do's." },
  ])
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
    interiorBackgroundRecord: 49,
    interiorClipRect: [535.5, 158, 529, 384],
    interiorFill: 'tiled-clipped',
    innerPanelEdgeUvOrigin: 0.95,
    innerPanelRecord: 17,
    innerPanelRect: [540.5, 163, 519, 374],
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
    innerPanelTint: 0x191916,
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
    'inventory-item-info',
    'inventory-dragger',
    'inventory-required-clothing-message',
    'inventory-unforge-confirmation',
    'inventory-unforge-result',
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
  assert.match(rendererSource, /tile\.blendMode = blendMode/)
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
  assert.match(
    rendererSource,
    /addTiledAtlas\([\s\S]*?HUB_DOWSING_MSGBOX\.interiorBackgroundRecord,[\s\S]*?\.\.\.HUB_DOWSING_MSGBOX\.interiorClipRect/,
  )
  assert.match(
    rendererSource,
    /addNativeNineSlice\([\s\S]*?HUB_DOWSING_MSGBOX\.innerPanelRecord,[\s\S]*?\.\.\.HUB_DOWSING_MSGBOX\.innerPanelRect,[\s\S]*?HUB_DOWSING_MSGBOX\.innerPanelEdgeUvOrigin/,
  )
  assert.doesNotMatch(rendererSource, /fit \/ Math\.max/)
  assert.match(rendererSource, /sprite\.rotation = \(transform\?\.rotationDegrees \?\? 0\) \* Math\.PI \/ 180/)
  assert.match(rendererSource, /HUB_STARTER_EQUIPMENT_PRIMARY_TINT\[element\]/)
  assert.doesNotMatch(rendererSource, /`EQUIP \$\{equipmentSlotLabel\(slot\)\}`/)
  assert.doesNotMatch(rendererSource, /selected\.rarity \?\? selected\.kind/)
  assert.match(rendererSource, /hubInventoryItemInfoText\(/)
  assert.match(rendererSource, /native-inventory-dragger/)
  assert.match(rendererSource, /addClippedItemIcon\(/)
  assert.match(rendererSource, /hubInventorySlotPosition\(index\)[\s\S]*?addClippedItemIcon\(/)
  assert.match(rendererSource, /function addEquipment\([\s\S]*?addClippedItemIcon\(/)
  assert.match(rendererSource, /function addStoreGrid\([\s\S]*?addClippedItemIcon\(/)
  assert.match(rendererSource, /function addDowsingGrid\([\s\S]*?addClippedItemIcon\(/)
  assert.match(rendererSource, /targetItem = draggedBackpack/)
  assert.doesNotMatch(rendererSource, /draggedBackpack \?\? selectedBackpack/)
  assert.match(rendererSource, /dragging\.owner === 'storage'/)
  assert.match(source, /inventorySelection=\{inventorySelection\}/)
  assert.match(source, /const companionInventory = \([\s\S]*?<InventoryActions[\s\S]*?companion/)
  assert.doesNotMatch(source, /readonly owner: 'backpack' \| 'storage' \| null/)
  assert.match(source, /gesture: 'double-activation'/)
  assert.match(source, /gesture: 'drag'/)
  assert.match(source, /function InventoryActions[\s\S]*activateSource/)
  assert.doesNotMatch(source, /direction: 'to-storage'[^}]*gesture: 'double-activation'/s)
  assert.match(source, /audio\.playSound\('backpack-close'\)/)
  assert.match(source, /audio\.playSound\('distort-reality', \{ playbackRate: feedback\.dowsingPitch \}\)/)
  assert.match(source, /audio\.playSound\('open-panel'\)/)
  assert.match(rendererSource, /hubChatTextRuns\(/)
  assert.match(rendererSource, /sprite\.skew\.x = -italicAngle/)
  assert.doesNotMatch(rendererSource, /replaceAll\('\*', ''\)/)
})

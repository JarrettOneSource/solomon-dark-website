import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import nativeAssetsJson from '../../assets/game/native-ui-assets.json' with { type: 'json' }
import {
  createEquipmentInventoryItem,
  DOWSING_EQUIPMENT_RECIPES,
  FOMENTIUS_STOCK_DEFINITIONS,
  type HubInventoryItem,
} from '../core-kernels/hub-economy.ts'
import {
  NATIVE_EQUIPMENT_CATALOG_EFFECT_COUNT,
  NATIVE_EQUIPMENT_RECIPE_COUNT,
  NATIVE_EQUIPMENT_SET_COUNT,
  nativeEquipmentRecipeDescription,
  nativeEquipmentRecipeEffects,
  nativeEquipmentTooltipSets,
} from '../core-kernels/native-equipment-effects.ts'
import {
  NATIVE_TUTORIAL_AMULET_DESCRIPTION,
  nativeTutorialAmuletItem,
} from '../core-kernels/native-tutorial.ts'
import {
  HAGATHA_NATIVE_TOOLTIP_LINES,
  HUB_CHAT_PANEL,
  HUB_CHAT_INLINE_EMPHASIS,
  HUB_DOWSING_FIELD,
  HUB_DYE_CLOTHING,
  HUB_DOWSING_MSGBOX,
  HUB_DOWSING_PREROLL,
  HUB_DOWSING_FLASH,
  HUB_DOWSING_INSUFFICIENT_GOLD,
  HUB_DOWSING_GRID,
  HUB_HAGATHA_PERK_PANE,
  HUB_HOVER_BOX,
  HUB_HAT_REMOVAL_MSGBOX,
  HUB_INVENTORY_GRID,
  HUB_INVENTORY_FLYBY,
  HUB_INVENTORY_INTERACTION,
  HUB_INVENTORY_PARENT_HOLDER,
  HUB_INVENTORY_ATTRIBUTES_PAGE,
  HUB_INVENTORY_STATS_PAGES,
  HUB_EQUIPMENT_SINK_RENDER,
  HUB_ITEM_ICON_TRANSFORMS,
  HUB_MODAL_HUD_CONTROLS,
  HUB_NATIVE_UI_TIMING,
  HUB_NATIVE_UI_SIZE,
  HUB_NATIVE_UI_SURFACES,
  HUB_PRIMARY_SPELL_PANE,
  HUB_ROBE_REMOVAL_MSGBOX,
  HUB_SACK_PAGE_TRANSITION,
  HUB_SHOP_GRID,
  HUB_SHOP_PANEL,
  HUB_STOREGRID_SELECTED_RECORDS,
  HUB_SHOP_TEXT,
  HUB_STARTER_EQUIPMENT_PRIMARY_TINT,
  HUB_UNFORGE_CONFIRMATION,
  HUB_UNFORGE_RESULT,
  HUB_UNFORGE_TARGET,
  hubDowsingSlotPosition,
  hubDowsingFieldTint,
  hubDowsingFlashAlpha,
  hubDowsingFlashFeedbackSequence,
  hubDyeItemLayerRects,
  hubDyeModalOpacity,
  hubDyeSelectedPulse,
  hubDyeSwatchRect,
  hubHagathaFullMindNotice,
  hubHagathaPerkSlotAlpha,
  hubHagathaTonicPromptCenter,
  hubChatTextRuns,
  hubInventoryPrimarySpellLines,
  hubInventoryWizardIdentityText,
  hubInventoryStatsArrowRect,
  hubInventoryStatsPage,
  hubInventoryItemInfoText,
  hubHagathaTooltipLines,
  hubItemTooltipLines,
  hubNativeEquipmentEffectText,
  hubNativeUiCloseReveal,
  hubNativeUiElapsedTicks,
  hubNativeUiReveal,
  hubOwnedPerkSlotRect,
  hubInventoryEquipmentSlotRects,
  hubInventoryFlybyFrame,
  hubInventoryRootSlot,
  hubInventorySlotPosition,
  hubInventoryVisibleSlot,
  hubShopSlotPosition,
  hubShopSlideOffset,
  hubSackPageOffsets,
  hubUnforgeResultLayout,
  hubUnforgeTargetTint,
} from './hub-inventory-render-contract.ts'

const hubInventoryRendererSource = readFileSync(
  new URL('./hub-inventory-renderer.ts', import.meta.url),
  'utf8',
)

const AUTHORED_EQUIPMENT_DESCRIPTIONS: Readonly<Record<number, string>> = {
  29: 'An amulet, apparently forged by Conchiphus Obfuscate himself.  The runes read "Interferenal."',
  30: 'An amulet known to be forged by the great wizard Basculus.  Much has been written about the unusual name, with some speculating that Basculus finished work on the amulet immediately after an unhappy love affair.',
  31: 'An amulet clearly forged during the Great Healing Madness.',
  32: 'Designed for those whose passion for Ether Magic surpasses their taste.',
  33: 'Formerly the property of Archmage Garthus Absolox, who was overly enthusiastic about the Meteor spell.',
  34: 'Forged by the wizard Gnoxis to achieve minimal functionality on mornings without coffee.  The imprints of hands have been squeezed into the wood at the gripping spots.',
  35: 'A simple ring, crafted to give unhealthy mages that extra staying power.',
  36: "Forged to boost dexterity and allow mages to work faster, this ring was stolen immediately by Casanava Lancashire, history's greatest reputed lover.  The ring only resurfaced again recently, but frequently changes owners because of a tendency to fly off the hand in the heat of casting.",
  37: 'Created by Blue Mage Wendrell to prove once and for all that a strong mind is worth more that a strong body.',
  38: "When presented at the artificer's conclave, this ring garnered much interest because it emits a destructive blast (dealing damage depending on level) when the bearer levels up.  Concern was expressed that the presenter (level 47) was so close to levelling up that even the experience of speaking before a large group might do it, and an early lunch was declared.",
  39: 'The high level requirments of this ring indicate that it was not necessarily forged to assist in learning, but rather to allow those smug in their knowledge to be more smug.',
  40: 'Annoyed at being accused of dueling with opponents below his magical grade, the wizard Yzmar designed this hat to provide a handicap to his challengers and silence accusations of advantage.  Sadly, Yzmar was disintegrated in his next duel.',
  41: 'Part of Qubar\'s "Elemental Boost" collection.',
  42: 'Part of Qubar\'s "Elemental Boost" collection.',
  43: 'Part of Qubar\'s "Elemental Boost" collection.',
  44: 'Part of Qubar\'s "Elemental Boost" collection.',
  45: 'Part of Qubar\'s "Elemental Boost" collection.',
  46: 'Woven as a defensive outfit for working with demons, this robe absorbs almost all magic in the vicinity.  The only known side effect is that your own magic is harmed as well.',
}

test('stock inventory owns the fixed 1600 by 900 stage and all 88 authored cells', () => {
  assert.deepEqual(HUB_NATIVE_UI_SIZE, { height: 900, width: 1600 })
  assert.equal(HUB_INVENTORY_GRID.columns * HUB_INVENTORY_GRID.rows, 88)
  assert.equal(HUB_INVENTORY_GRID.slotAlpha, 0.4)
  assert.deepEqual(hubInventorySlotPosition(0), { x: 24, y: 496 })
  assert.deepEqual(hubInventorySlotPosition(1), { x: 24, y: 571 })
  assert.deepEqual(hubInventorySlotPosition(4), { x: 99, y: 496 })
  assert.deepEqual(hubInventorySlotPosition(87), { x: 1599, y: 721 })
  assert.throws(() => hubInventorySlotPosition(88), /\[0, 87\]/)
  assert.equal(hubInventoryVisibleSlot(0, false), 0)
  assert.equal(hubInventoryVisibleSlot(0, true), 1)
  assert.equal(hubInventoryVisibleSlot(86, true), 87)
  assert.throws(() => hubInventoryVisibleSlot(87, true), /not visible/)
  assert.equal(hubInventoryRootSlot(0, true), null)
  assert.equal(hubInventoryRootSlot(1, true), 0)
  assert.equal(hubInventoryRootSlot(87, true), 86)
  assert.equal(hubInventoryRootSlot(87, false), 87)
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

test('InventoryFlyby owns twenty discrete steps and ten independently fading copies', () => {
  assert.deepEqual(HUB_INVENTORY_FLYBY, {
    afterimageAlphaLossPerTick: 0.1,
    afterimageBirthTicks: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19],
    tailTicks: 10,
    tickMs: 10,
    travelTicks: 20,
  })
  assert.deepEqual(hubInventoryFlybyFrame(1_000, 1_000), {
    afterimages: [],
    complete: false,
    mainProgress: 0,
    mainVisible: true,
    tick: 0,
    travelComplete: false,
  })
  assert.deepEqual(hubInventoryFlybyFrame(1_000, 1_010), {
    afterimages: [{ alpha: 1, progress: 0.05, spawnTick: 1 }],
    complete: false,
    mainProgress: 0.05,
    mainVisible: true,
    tick: 1,
    travelComplete: false,
  })
  assert.deepEqual(hubInventoryFlybyFrame(1_000, 1_200), {
    afterimages: [
      { alpha: 0.1, progress: 0.55, spawnTick: 11 },
      { alpha: 0.3, progress: 0.65, spawnTick: 13 },
      { alpha: 0.5, progress: 0.75, spawnTick: 15 },
      { alpha: 0.7, progress: 0.85, spawnTick: 17 },
      { alpha: 0.9, progress: 0.95, spawnTick: 19 },
    ],
    complete: false,
    mainProgress: 1,
    mainVisible: false,
    tick: 20,
    travelComplete: true,
  })
  assert.equal(hubInventoryFlybyFrame(1_000, 1_290).complete, true)
})

test('nested InventoryGrid reserves its painted quarter-alpha parent holder at cell zero', () => {
  assert.deepEqual(HUB_INVENTORY_PARENT_HOLDER, {
    alpha: 0.25,
    visibleSlot: 0,
  })
  assert.equal(hubInventoryRootSlot(HUB_INVENTORY_PARENT_HOLDER.visibleSlot, true), null)
})

test('Item_Sack pages traverse the fixed stage in exact discrete native ticks', () => {
  assert.deepEqual(HUB_SACK_PAGE_TRANSITION, {
    nativeTickMs: 10,
    pixelsPerTick: 10,
    stageWidth: 1600,
    ticks: 160,
  })
  assert.deepEqual(hubSackPageOffsets('open', 1_000, 1_000), {
    incomingX: 1_600,
    outgoingX: 0,
    settled: false,
    ticks: 0,
  })
  assert.deepEqual(hubSackPageOffsets('open', 1_000, 1_010), {
    incomingX: 1_590,
    outgoingX: -10,
    settled: false,
    ticks: 1,
  })
  assert.deepEqual(hubSackPageOffsets('open', 1_000, 2_599), {
    incomingX: 10,
    outgoingX: -1_590,
    settled: false,
    ticks: 159,
  })
  assert.deepEqual(hubSackPageOffsets('open', 1_000, 2_600), {
    incomingX: 0,
    outgoingX: -1_600,
    settled: true,
    ticks: 160,
  })
  assert.deepEqual(hubSackPageOffsets('back', 1_000, 1_010), {
    incomingX: -1_590,
    outgoingX: 10,
    settled: false,
    ticks: 1,
  })
  assert.deepEqual(hubSackPageOffsets('back', 1_000, 2_600), {
    incomingX: 0,
    outgoingX: 1_600,
    settled: true,
    ticks: 160,
  })
})

test('InventoryScreen paints the Game-owned backpack return control at every Sack depth', () => {
  assert.deepEqual(HUB_MODAL_HUD_CONTROLS, {
    backpack: {
      label: 'native-inventory-resume-control',
      record: 47,
    },
    shadowOffset: [5, 5],
    shadowTint: 0x000000,
    tome: {
      label: 'native-skill-book-control',
      record: 48,
    },
  })
  assert.deepEqual(nativeAssetsJson.atlases.UI.records['47']?.logicalSize, [58, 62])
  assert.deepEqual(nativeAssetsJson.atlases.UI.records['48']?.logicalSize, [58, 62])
})

test('DyeClothing retains stock relative geometry and discrete update timing', () => {
  assert.deepEqual(HUB_DYE_CLOTHING, {
    bankSize: 9,
    cancelRect: [690, 390, 220, 44],
    closeDecrementPerTick: 0.1,
    emptyTubAlpha: 0.2,
    instructionTextBaselineY: 151,
    itemLayerSplitOffsetY: 40,
    nativeTickMs: 10,
    openIncrementPerTick: 0.01,
    panelRect: [480, 80, 640, 360],
    selectedPulseDecrementPerTick: 0.05,
    selectedPulseTicks: 20,
    swatchBankOrigins: [[560, 185], [760, 185]],
    swatchColumns: 3,
    swatchCount: 18,
    swatchPitchX: 40,
    swatchPitchY: 50,
    swatchRows: 3,
    swatchSize: 32,
    titleTextBaselineY: 121,
    tubRect: [960, 198, 96, 96],
  })
  assert.deepEqual(hubDyeSwatchRect(0), [560, 185, 32, 32])
  assert.deepEqual(hubDyeSwatchRect(2), [640, 185, 32, 32])
  assert.deepEqual(hubDyeSwatchRect(3), [560, 235, 32, 32])
  assert.deepEqual(hubDyeSwatchRect(8), [640, 285, 32, 32])
  assert.deepEqual(hubDyeSwatchRect(9), [760, 185, 32, 32])
  assert.deepEqual(hubDyeSwatchRect(17), [840, 285, 32, 32])
  assert.throws(() => hubDyeSwatchRect(18), /\[0, 17\]/)
  assert.deepEqual(hubDyeItemLayerRects(0), {
    cloth: [24, 496, 72, 40],
    trim: [24, 536, 72, 32],
  })
  assert.equal(hubDyeModalOpacity(100, null, 100), 0)
  assert.equal(hubDyeModalOpacity(100, null, 110), 0.01)
  assert.equal(hubDyeModalOpacity(100, null, 1_100), 1)
  assert.equal(hubDyeModalOpacity(100, 600, 600), 0.5)
  assert.equal(hubDyeModalOpacity(100, 600, 620), 0.3)
  assert.equal(hubDyeModalOpacity(100, 600, 650), 0)
  assert.equal(hubDyeSelectedPulse(null, 100), 0)
  assert.equal(hubDyeSelectedPulse(100, 100), 1)
  assert.equal(hubDyeSelectedPulse(100, 200), 0.5)
  assert.equal(hubDyeSelectedPulse(100, 300), 0)
})

test('stock inventory owns native ItemInfo, drag, double activation, and protected clothing copy', () => {
  assert.deepEqual(HUB_INVENTORY_INTERACTION, {
    doubleActivationMs: 500,
    doubleActivationTicks: 50,
    dragThresholdPixels: 10,
    itemInfoDelayMs: 200,
    itemInfoDelayTicks: 20,
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
  const sack = {
    ...item,
    contents: [{ ...item, id: 3, quantity: 5 }],
    iconRecords: [70],
    id: 2,
    kind: 'sack',
    name: 'Sack',
    nativeSubtype: 0,
    nativeTypeId: 7008,
  } as const
  assert.deepEqual(hubInventoryItemInfoText(sack), {
    description: 'Contains 1 item',
    instruction: null,
    title: 'Sack',
  })
  assert.deepEqual(hubInventoryItemInfoText({ ...sack, contents: undefined }), {
    description: 'Currently empty',
    instruction: null,
    title: 'Sack',
  })
  assert.equal(HUB_HAT_REMOVAL_MSGBOX.title, 'A WIZARD WOULD NEVER REMOVE HIS HAT!')
  assert.match(HUB_HAT_REMOVAL_MSGBOX.body, /jaunty angle/)
  assert.equal(HUB_ROBE_REMOVAL_MSGBOX.title, 'A WIZARD WOULD NEVER REMOVE HIS ROBE!')
  assert.match(HUB_ROBE_REMOVAL_MSGBOX.body, /avoidable disintegration/)
})

test("Sorceror's Amulet ItemInfo carries the exact authored description and effect", () => {
  assert.equal(
    NATIVE_TUTORIAL_AMULET_DESCRIPTION,
    'A dull trinket, carved with a few beneficial runes',
  )
  assert.deepEqual(
    hubItemTooltipLines(nativeTutorialAmuletItem()).map(({ text }) => text),
    [
      "Sorceror's Amulet",
      'A dull trinket, carved with a few beneficial runes',
      'Ether Damage +10.0%',
    ],
  )
})

test('mod wearable tooltips show the authored description and affix names', () => {
  const item: HubInventoryItem = {
    equipmentType: 'robe',
    iconRecords: [],
    iconTints: [0xffffff, 0xffffff],
    id: 90,
    kind: 'equipment',
    modAffixes: [{
      contentId: '5000000000000000002',
      modId: 'example.wearables',
      modifiers: [],
      name: 'Starlit',
    }],
    modItemContent: {
      contentId: '5000000000000000001',
      description: 'A robe from beyond.',
      icon: {
        atlasId: 'example.wearables:starfall_icon',
        frame: {
          centerOffsetX: 0,
          centerOffsetY: 0,
          contentHeight: 50,
          contentWidth: 50,
          height: 50,
          logicalHeight: 50,
          logicalWidth: 50,
          width: 50,
          x: 0,
          y: 0,
        },
        frameIndex: 0,
        imagePath: 'art/starfall-icon.png',
      },
      key: 'starfall_robe',
      modId: 'example.wearables',
      stackMaximum: 1,
      wearable: {
        deathShape: 2,
        dyeable: false,
        slot: 'robe',
        wornImagePath: 'art/starfall-robe.png',
      },
    },
    name: 'Starfall Robe',
    nativeSubtype: null,
    nativeTypeId: 7013,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  assert.deepEqual(hubItemTooltipLines(item).map(({ text }) => text), [
    'Starfall Robe',
    'A robe from beyond.',
    'Starlit',
  ])
})

test('retail StoreGrid selected state uses only the live Windows CLICK AGAIN records', () => {
  assert.deepEqual(HUB_STOREGRID_SELECTED_RECORDS, {
    buyClickAgain: 84,
    buyTouchAgainDormant: 85,
    takeClickAgain: 111,
    takeTouchAgainDormant: 112,
    unaffordable: 46,
  })
  assert.deepEqual(nativeAssetsJson.atlases.UI.records['84']?.frame, [753, 435, 66, 45])
  assert.deepEqual(nativeAssetsJson.atlases.UI.records['85']?.frame, [847, 425, 66, 45])
  assert.deepEqual(nativeAssetsJson.atlases.UI.records['111']?.frame, [874, 587, 66, 45])
  assert.deepEqual(nativeAssetsJson.atlases.UI.records['112']?.frame, [933, 426, 66, 45])
})

test('HoverBox owns exact immediate Shop and occupied-Hagatha geometry', () => {
  assert.deepEqual(HUB_HOVER_BOX, {
    contentMargin: 25,
    contentMaxWidth: 300,
    lineGap: 10,
    ownedPerkDelayTicks: 0,
    ownedPerkSourceExclusionSize: 60,
    ownedPerkSourceGap: 25,
    shopDelayTicks: 0,
    shopSourceExclusionSize: 70,
    shopSourceGap: 35,
    viewportMargin: 25,
  })
  assert.deepEqual(hubOwnedPerkSlotRect(0), [163, 168, 60, 60])
  assert.deepEqual(hubOwnedPerkSlotRect(4), [223, 228, 60, 60])
  assert.deepEqual(hubOwnedPerkSlotRect(8), [283, 288, 60, 60])
  assert.throws(() => hubOwnedPerkSlotRect(9), /\[0, 8\]/)
})

test('all Hagatha rows use exact native HoverBox copy and preserve dynamic/suffix branches', () => {
  assert.equal(HAGATHA_NATIVE_TOOLTIP_LINES.length, 28)
  assert.equal(HAGATHA_NATIVE_TOOLTIP_LINES.every((lines) => lines.length > 0), true)
  assert.deepEqual(HAGATHA_NATIVE_TOOLTIP_LINES[4], [
    'Odds of finding gold is increased.',
    'Quantity of gold found is increased.',
  ])
  assert.deepEqual(HAGATHA_NATIVE_TOOLTIP_LINES[13], [
    'Welded spells recombine any time the compenent spells are improved.',
  ])

  const firstMix = hubHagathaTooltipLines({
    cheatDeathCharges: null,
    firstMixed: false,
    price: 600,
    selector: 0,
  }).map(({ text }) => text)
  assert.deepEqual(firstMix, [
    'LIFE CHARM',
    'Maximum life is always increased by 25%.',
    '',
    '    Price: 600',
    '    High price due to first mixing.',
  ])
  assert.deepEqual(hubHagathaTooltipLines({
    cheatDeathCharges: 2,
    firstMixed: true,
    price: null,
    selector: 7,
  }).map(({ text }) => text), [
    'CHEAT DEATH CHARM',
    'Survive one killing blow by recovering half of your health.',
    '   Cheats remaining: 2',
  ])
  assert.deepEqual(hubHagathaTooltipLines({
    cheatDeathCharges: 0,
    firstMixed: true,
    price: null,
    selector: 7,
  }).at(-1)?.text, '   Used up!')
  assert.deepEqual(hubHagathaTooltipLines({
    bundleSelectors: [0, 4],
    cheatDeathCharges: null,
    firstMixed: true,
    price: 1_050,
    selector: -1,
  }).map(({ text }) => text), [
    'BARGAIN BUNDLE',
    'Get everything the last wizard got.',
    '        LIFE CHARM',
    '        GOLD CHARM',
    '',
    '    Price: 1050',
    '    Bulk discount: 50%',
  ])
})

test('every Fomentius class and all 47 recipe rows build complete contextual details', () => {
  assert.equal(FOMENTIUS_STOCK_DEFINITIONS.length, 9)
  for (const [index, definition] of FOMENTIUS_STOCK_DEFINITIONS.entries()) {
    const item: HubInventoryItem = {
      equipmentType: null,
      iconRecords: definition.iconRecords,
      id: index + 1,
      kind: definition.kind,
      name: definition.name,
      nativeSubtype: definition.nativeSubtype,
      nativeTypeId: definition.nativeTypeId,
      quantity: 1,
      rarity: null,
      recipeIndex: null,
    }
    const lines = hubItemTooltipLines(item, { price: definition.price }).map(({ text }) => text)
    assert.ok(lines.length >= 3, `${definition.name} tooltip is incomplete`)
    assert.equal(lines.at(-1), `    Price: ${definition.price}`)
  }

  assert.equal(NATIVE_EQUIPMENT_RECIPE_COUNT, 47)
  assert.equal(DOWSING_EQUIPMENT_RECIPES.length, 47)
  assert.equal(NATIVE_EQUIPMENT_SET_COUNT, 7)
  assert.equal(nativeEquipmentTooltipSets().length, 7)
  assert.equal(NATIVE_EQUIPMENT_CATALOG_EFFECT_COUNT, 86)
  assert.equal(Object.keys(AUTHORED_EQUIPMENT_DESCRIPTIONS).length, 18)
  for (const recipe of DOWSING_EQUIPMENT_RECIPES) {
    const item = createEquipmentInventoryItem(recipe, recipe.sourceIndex + 100)
    const lines = hubItemTooltipLines(item, {
      creativityRank: 0,
      playerLevel: 100,
      price: 5_000,
    }).map(({ text }) => text)
    assert.equal(lines[0], recipe.name)
    assert.equal(lines.at(-1), '    Price: 5000')
    const description = AUTHORED_EQUIPMENT_DESCRIPTIONS[recipe.sourceIndex] ?? ''
    assert.equal(nativeEquipmentRecipeDescription(recipe.sourceIndex), description)
    if (description) assert.ok(lines.includes(description))
    for (const effect of nativeEquipmentRecipeEffects(recipe.sourceIndex)) {
      assert.ok(lines.includes(hubNativeEquipmentEffectText(effect)))
    }
    if (recipe.setName !== null) {
      assert.ok(lines.includes('Item Set:'))
      assert.ok(lines.includes(recipe.setName))
      assert.ok(lines.includes('Complete Set Bonus:'))
    }
  }
})

test('equipment ItemInfo uses permanent Creativity for the native two-level reduction', () => {
  const ringwallRecipe = DOWSING_EQUIPMENT_RECIPES.find(
    ({ sourceIndex }) => sourceIndex === 35,
  )!
  const ringwall = createEquipmentInventoryItem(ringwallRecipe, 35)
  assert.ok(hubItemTooltipLines(ringwall, {
    creativityRank: 0,
    playerLevel: 1,
  }).some(({ text }) => text === 'Requires Player Level 3'))
  assert.equal(hubItemTooltipLines(ringwall, {
    creativityRank: 1,
    playerLevel: 1,
  }).some(({ text }) => text.startsWith('Requires Player Level')), false)

  const staffRecipe = DOWSING_EQUIPMENT_RECIPES.find(
    ({ sourceIndex }) => sourceIndex === 33,
  )!
  const staff = createEquipmentInventoryItem(staffRecipe, 33)
  assert.ok(hubItemTooltipLines(staff, {
    creativityRank: 2,
    playerLevel: 2,
  }).some(({ text }) => text === 'Requires Player Level 5'))
})

test('native equipment HoverBox effect formatting covers every operator and feature family', () => {
  assert.equal(hubNativeEquipmentEffectText({ kind: 1, magnitude: 12.5, operator: 0, target: 0 }), 'Spell Damage +12.5')
  assert.equal(hubNativeEquipmentEffectText({ kind: 9, magnitude: 2, operator: 1, target: 0 }), 'Mana Recovery x2.0')
  assert.equal(hubNativeEquipmentEffectText({ kind: 17, magnitude: -10, operator: 2, target: 0 }), 'Walk Speed -10%')
  assert.equal(hubNativeEquipmentEffectText({ kind: 7, magnitude: 1, operator: 0, target: 11 }), 'Call Leviathan + 1')
  assert.equal(hubNativeEquipmentEffectText({ kind: 26, magnitude: 0, operator: 0, target: 0 }), 'Always summon max Leviathan tentacles')
  assert.equal(hubNativeEquipmentEffectText({ kind: 39, magnitude: 0, operator: 0, target: 0 }), '+Bias for welding skill picks')
  assert.throws(
    () => hubNativeEquipmentEffectText({ kind: 40, magnitude: 1, operator: 0, target: 0 }),
    /unknown native equipment effect kind/,
  )
})

test('the unforge anvil owns its native drop geometry, pulse, and dialog layouts', () => {
  assert.deepEqual(HUB_UNFORGE_TARGET.rect, [1500, 800, 100, 100])
  assert.deepEqual(HUB_UNFORGE_TARGET.center, [1562, 868])
  assert.equal(hubUnforgeTargetTint(0), 0x99ffff)
  assert.equal(hubUnforgeTargetTint(90), 0xccffff)
  assert.equal(hubUnforgeTargetTint(270), 0x66ffff)
  assert.deepEqual(HUB_UNFORGE_CONFIRMATION.innerPanelRect, [544.5, 387.5, 514, 326])
  assert.deepEqual(HUB_UNFORGE_CONFIRMATION.primaryButtonRect, [595, 573, 197, 69])
  assert.deepEqual(HUB_UNFORGE_CONFIRMATION.secondaryButtonRect, [811, 573, 197, 69])
  assert.deepEqual(HUB_UNFORGE_RESULT.innerPanelRect, [606.5, 396.5, 390, 308])
  assert.deepEqual(HUB_UNFORGE_RESULT.primaryButtonRect, [703, 564, 197, 69])
  assert.deepEqual(hubUnforgeResultLayout(249), {
    bodyLeft: 677,
    innerPanelRect: [606.5, 396.5, 390, 308],
    primaryButtonRect: [703, 564, 197, 69],
  })
  assert.deepEqual(hubUnforgeResultLayout(460), {
    bodyLeft: 571.5,
    innerPanelRect: [501, 396.5, 601, 308],
    primaryButtonRect: [703, 564, 197, 69],
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

test('InventoryScreen owns three clipped 320-pixel stat pages and bounded arrow actions', () => {
  assert.deepEqual(HUB_INVENTORY_STATS_PAGES, {
    actionSize: 36,
    companionClipRect: [103, 89, 320, 320],
    companionIndicatorX: 391,
    contentHeight: 960,
    dragThresholdPixels: 10,
    indicatorRecord: 13,
    pageCount: 3,
    pageHeight: 320,
    standaloneClipRect: [50, 89, 320, 320],
    standaloneIndicatorX: 338,
  })
  assert.deepEqual(HUB_INVENTORY_ATTRIBUTES_PAGE.attributesRows, [500, 516, 548, 564])
  assert.deepEqual(HUB_INVENTORY_ATTRIBUTES_PAGE.resistanceRows, [670, 686, 702])
  assert.equal(hubInventoryStatsPage(2), 2)
  assert.throws(() => hubInventoryStatsPage(3), /within \[0,2\]/)
  assert.equal(hubInventoryStatsArrowRect(0, 'up', false), null)
  assert.deepEqual(hubInventoryStatsArrowRect(0, 'down', false), [320, 361, 36, 36])
  assert.deepEqual(hubInventoryStatsArrowRect(1, 'up', true), [373, 101, 36, 36])
  assert.deepEqual(hubInventoryStatsArrowRect(1, 'down', true), [373, 361, 36, 36])
  assert.equal(hubInventoryStatsArrowRect(2, 'down', false), null)
})

test('InventoryScreen assigns the retail class title instead of exposing its component pair', () => {
  assert.equal(hubInventoryWizardIdentityText(7, 'air', 'arcane'), 'LEVEL 7\nSTORM MAGE')
  assert.equal(hubInventoryWizardIdentityText(3, 'ether', 'body'), 'LEVEL 3\nSAGE')
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
  assert.equal(HUB_NATIVE_UI_TIMING.nativeTickMs, 10)
  assert.deepEqual([
    hubNativeUiElapsedTicks(0),
    hubNativeUiElapsedTicks(9.999),
    hubNativeUiElapsedTicks(10),
    hubNativeUiElapsedTicks(399.999),
    hubNativeUiElapsedTicks(400),
  ], [0, 0, 1, 39, 40])
  assert.deepEqual([
    hubNativeUiReveal(0, HUB_NATIVE_UI_TIMING.inventoryRevealPerTick),
    hubNativeUiReveal(9.999, HUB_NATIVE_UI_TIMING.inventoryRevealPerTick),
    hubNativeUiReveal(10, HUB_NATIVE_UI_TIMING.inventoryRevealPerTick),
    hubNativeUiReveal(200, HUB_NATIVE_UI_TIMING.inventoryRevealPerTick),
    hubNativeUiReveal(400, HUB_NATIVE_UI_TIMING.inventoryRevealPerTick),
  ], [0, 0, 0.025, 0.5, 1])
  assert.deepEqual([
    hubNativeUiCloseReveal(1, 0, HUB_NATIVE_UI_TIMING.inventoryRevealPerTick),
    hubNativeUiCloseReveal(1, 10, HUB_NATIVE_UI_TIMING.inventoryRevealPerTick),
    hubNativeUiCloseReveal(1, 200, HUB_NATIVE_UI_TIMING.inventoryRevealPerTick),
    hubNativeUiCloseReveal(1, 400, HUB_NATIVE_UI_TIMING.inventoryRevealPerTick),
    hubNativeUiCloseReveal(0.5, 200, HUB_NATIVE_UI_TIMING.inventoryRevealPerTick),
  ], [1, 0.975, 0.5, 0, 0])
  assert.throws(
    () => hubNativeUiCloseReveal(1.01, 0, HUB_NATIVE_UI_TIMING.inventoryRevealPerTick),
    RangeError,
  )
  assert.deepEqual([0, 0.25, 0.5, 0.75, 1].map(hubShopSlideOffset), [
    -100,
    -75,
    -50,
    -25,
    0,
  ])
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

test('native shop message boxes preserve Dowsing and Hagatha rejection copy', () => {
  assert.deepEqual(HUB_DOWSING_FLASH, {
    decrementPerTick: 0.05,
    durationMs: 200,
    durationTicks: 20,
  })
  assert.equal(HUB_DOWSING_INSUFFICIENT_GOLD.title, 'NOT ENOUGH GOLD!')
  assert.match(HUB_DOWSING_INSUFFICIENT_GOLD.body, /endless, swirling, impossible colors/)
  assert.deepEqual(hubHagathaFullMindNotice(27), {
    actionLabel: 'OKAY',
    body: "Because the divinatorial phlogiston of your neurologic peridium is already at full capacity, drinking Hagatha's tonic would cause your head to explode!",
    title: 'YOUR MIND IS FULL!',
  })
  assert.deepEqual(hubHagathaFullMindNotice(0), {
    actionLabel: 'OKAY',
    body: "The Thaumic Covalence Meridian of your cortex is full and cannot hold more charms!\n\nDrinking Hagatha's tonic can sublimate the memetic sensorial pathways to allow more charms, but only if you're not already overloaded.",
    title: 'YOUR MIND IS FULL!',
  })
  assert.deepEqual(HUB_DOWSING_PREROLL, {
    buttonActionRect: [675, 265.5, 250, 69],
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
    primaryButtonActionRect: [702, 397.5, 196, 69],
    primaryButtonTextBaselineY: 440,
    primaryButtonTextTint: 0xd9ba70,
    skullHeaderCenter: [800, 121],
    titleTextBaselineY: 252,
    verticalEdgeRecord: 79,
  })
  assert.deepEqual(HUB_HAGATHA_PERK_PANE, {
    columns: 3,
    innerHeight: 238,
    innerPanelTint: 0x191916,
    innerWidth: 227,
    left: 139,
    lockedSlotAlpha: 0.5,
    rows: 3,
    slotCenterOrigin: [193, 198],
    slotPitch: 60,
    slotScale: 0.8,
    titleTint: 0xd9ba70,
    titleCenterX: 253,
    titleTextBaselineY: 152.5,
    tonicPromptCenters: [[253, 288], [253, 318]],
    tonicPromptRecord: 5,
    top: 129,
  })
  assert.deepEqual(nativeAssetsJson.atlases.Inventory.records['5']?.frame, [429, 0, 92, 50])
  assert.deepEqual(
    Array.from({ length: 9 }, (_, index) => hubHagathaPerkSlotAlpha(index, 3)),
    [1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  )
  assert.deepEqual(
    Array.from({ length: 9 }, (_, index) => hubHagathaPerkSlotAlpha(index, 6)),
    [1, 1, 1, 1, 1, 1, 0.5, 0.5, 0.5],
  )
  assert.deepEqual(
    Array.from({ length: 9 }, (_, index) => hubHagathaPerkSlotAlpha(index, 9)),
    [1, 1, 1, 1, 1, 1, 1, 1, 1],
  )
  assert.deepEqual(hubHagathaTonicPromptCenter(3), [253, 288])
  assert.deepEqual(hubHagathaTonicPromptCenter(6), [253, 318])
  assert.equal(hubHagathaTonicPromptCenter(9), null)
  assert.throws(() => hubHagathaPerkSlotAlpha(-1, 3), /within \[0, 8\]/)
  assert.throws(() => hubHagathaPerkSlotAlpha(9, 9), /within \[0, 8\]/)
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
  assert.equal(hubDowsingFlashAlpha(0), 1)
  assert.equal(hubDowsingFlashAlpha(9.999), 1)
  assert.ok(Math.abs(hubDowsingFlashAlpha(10) - 0.95) < 1e-6)
  assert.ok(Math.abs(hubDowsingFlashAlpha(190) - 0.05) < 1e-6)
  assert.equal(hubDowsingFlashAlpha(200), 0)
  assert.equal(hubDowsingFlashAlpha(2_000), 0)
  assert.equal(hubDowsingFlashFeedbackSequence(null), null)
  assert.equal(hubDowsingFlashFeedbackSequence({
    accepted: true,
    action: 'dowse',
    sequence: 7,
  }), 7)
  assert.equal(hubDowsingFlashFeedbackSequence({
    accepted: true,
    action: 'buy-dowsing',
    sequence: 8,
  }), 8)
  assert.equal(hubDowsingFlashFeedbackSequence({
    accepted: false,
    action: 'buy-dowsing',
    sequence: 9,
  }), null)
  assert.equal(hubDowsingFlashFeedbackSequence({
    accepted: true,
    action: 'buy-fomentius',
    sequence: 10,
  }), null)
})

test('every Hub standard button consumes the shared body and UI.54 surround plan', () => {
  assert.equal(hubInventoryRendererSource.match(/addNativeButton\(/g)?.length, 4)
  assert.equal(hubInventoryRendererSource.match(/planNativeUiButtonChrome\(/g)?.length, 1)
  assert.doesNotMatch(hubInventoryRendererSource, /buttonSideCenters|primaryButtonSideCenters/)
  assert.doesNotMatch(hubInventoryRendererSource, /hubNativeLabeledControlPresentation/)
  assert.match(hubInventoryRendererSource, /pressedControl === 'message-secondary'/)
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
    'shlorio-dowsing-roll-flash',
    'shlorio-dowsing-purchase-flash',
    'shlorio-dowsing-results',
    'shlorio-insufficient-gold-message',
    'inventory',
    'inventory-item-info',
    'contextual-hover-box',
    'inventory-dragger',
    'inventory-dye-clothing',
    'inventory-required-clothing-message',
    'inventory-unforge-confirmation',
    'inventory-unforge-result',
  ])
})

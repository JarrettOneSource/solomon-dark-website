import { Container, Graphics, Sprite, type Texture } from 'pixi.js'
import { findInventoryItem } from '../core-kernels/hub-economy.ts'
import type { PlayerCharacterConfig, WizardElement } from '../core-kernels/player-character.ts'
import { nativeSkillIconRecord } from '../core-kernels/player-progression.ts'
import {
  nativeBeltEntryItem,
  nativeBeltPotionProjection,
  type PlayerBeltComponent,
} from '../core-kernels/native-belt.ts'
import { equipmentSlotsForItem } from '../hub-inventory-presentation.ts'
import {
  NATIVE_HUD_BACKBUFFER,
  nativeHudModalSlideLayout,
  nativeHudRectCenter,
  type NativeHudControlLayout,
} from '../native-hud-layout.ts'
import {
  playerCharacterStaffIsFront,
  playerCharacterStaffOrbOffset,
} from '../player-character-presentation.ts'
import type { ProtocolPlayerEconomy, ProtocolPlayerProgression } from '../protocol/game-state.ts'
import { measureNativeUiText } from '../native-ui/core.ts'
import {
  HUB_EQUIPMENT_SINK_RENDER,
  HUB_HAGATHA_PERK_PANE,
  HUB_INVENTORY_IDENTITY_PAGE,
  HUB_INVENTORY_ROOT_CHROME,
  HUB_INVENTORY_ATTRIBUTES_PAGE,
  HUB_INVENTORY_STATS_PAGES,
  HUB_MODAL_HUD_CONTROLS,
  HUB_PRIMARY_SPELL_PANE,
  hubHagathaPerkSlotAlpha,
  hubHagathaTonicPromptCenter,
  hubInventoryEquipmentSlotRects,
  hubInventoryPrimarySpellLines,
  hubInventoryPrimarySpellTint,
  hubInventoryWizardIdentityText,
} from './hub-inventory-render-contract.ts'
import { NativeElementVfxView } from './native-element-vfx-view.ts'
import { PLAYER_CHARACTER_SHEETS } from './player-character-atlas.ts'
import type { RenderContext } from './hub-inventory-render-model.ts'
import type {
  HubInventorySelectionModel,
  HubInventoryDragModel,
} from './hub-inventory-renderer.ts'
import {
  addInventorySelection,
  itemAtEquipmentSlot,
  addItemIcon,
  addClippedItemIcon,
} from './hub-inventory-items.ts'
import {
  addInventoryInfoFrame,
  addPrimitiveFrame,
  addAtlasSprite,
  addCenteredAtlasSprite,
  addNativeNineSlice,
  addTiledAtlas,
  addBitmapText,
  addBitmapTextRuns,
} from './hub-inventory-drawing.ts'

export function addInventorySidePanelBackdrop(
  context: RenderContext,
  layer: Container,
  side: 'left' | 'right',
  companion: boolean,
): void {
  const chrome = HUB_INVENTORY_ROOT_CHROME
  const shift = companion ? 0 : side === 'left'
    ? -chrome.standaloneOutwardShift
    : chrome.standaloneOutwardShift
  if (side === 'left') {
    for (const x of [233, 24]) {
      addCenteredAtlasSprite(context, layer, 'UI', 30, x + shift, 429)
      addCenteredAtlasSprite(context, layer, 'UI', 30, x + shift, 39)
    }
    addCenteredAtlasSprite(context, layer, 'UI', 33, 53 + shift, 249, -1, 1)
    addCenteredAtlasSprite(context, layer, 'UI', 29, 303 + shift, 449, 1, -1)
    addCenteredAtlasSprite(context, layer, 'UI', 32, 63 + shift, 439, 0.85, 0.85)
    addCenteredAtlasSprite(context, layer, 'UI', 31, 343 + shift, 449, -0.75, 0.75)
    addCenteredAtlasSprite(context, layer, 'UI', 31, 343 + shift, 39, -1, 1)
    addCenteredAtlasSprite(context, layer, 'UI', 31, 73 + shift, 39)
    addCenteredAtlasSprite(context, layer, 'UI', 20, 55 + shift, 119)
  } else {
    for (const x of [1367, 1576]) {
      addCenteredAtlasSprite(context, layer, 'UI', 30, x + shift, 429)
      addCenteredAtlasSprite(context, layer, 'UI', 30, x + shift, 39)
    }
    addCenteredAtlasSprite(context, layer, 'UI', 33, 1547 + shift, 279)
    addCenteredAtlasSprite(context, layer, 'UI', 29, 1297 + shift, 449, -1, -1)
    addCenteredAtlasSprite(context, layer, 'UI', 31, 1527 + shift, 439, 0.85, 0.85)
    addCenteredAtlasSprite(context, layer, 'UI', 32, 1257 + shift, 459, -0.75, 0.75)
    addCenteredAtlasSprite(context, layer, 'UI', 31, 1257 + shift, 39)
    addCenteredAtlasSprite(context, layer, 'UI', 31, 1527 + shift, 39, -1, 1)
    addCenteredAtlasSprite(context, layer, 'UI', 20, 1549 + shift, 119)
  }

  const paneLeft = chrome.companionPaneLeft[side] + shift
  addTiledAtlas(
    context,
    layer,
    'UI',
    49,
    paneLeft,
    chrome.paneTop,
    chrome.paneSize[0],
    chrome.paneSize[1],
  )
}

export function addInventorySidePanelChrome(
  context: RenderContext,
  layer: Container,
  side: 'left' | 'right',
  companion: boolean,
): void {
  const chrome = HUB_INVENTORY_ROOT_CHROME
  const shift = companion ? 0 : side === 'left'
    ? -chrome.standaloneOutwardShift
    : chrome.standaloneOutwardShift
  const paneLeft = chrome.companionPaneLeft[side] + shift
  const [paneWidth, paneHeight] = chrome.paneSize
  const paneTop = chrome.paneTop

  addNativeNineSlice(
    context,
    layer,
    'Inventory',
    chrome.frameRecord,
    paneLeft,
    paneTop,
    paneWidth,
    paneHeight,
    chrome.edgeUvOrigin,
    false,
  )
  addTiledAtlas(
    context,
    layer,
    'UI',
    chrome.horizontalChain.record,
    paneLeft,
    paneTop + chrome.horizontalChain.topOffset,
    paneWidth,
    chrome.horizontalChain.size[1],
  )
  addTiledAtlas(
    context,
    layer,
    'UI',
    chrome.horizontalChain.record,
    paneLeft,
    paneTop + paneHeight + chrome.horizontalChain.bottomOffset,
    paneWidth,
    chrome.horizontalChain.size[1],
  )
  addTiledAtlas(
    context,
    layer,
    'UI',
    chrome.verticalChain.record,
    paneLeft + chrome.verticalChain.leftOffset,
    paneTop,
    chrome.verticalChain.size[0],
    paneHeight,
  )
  addTiledAtlas(
    context,
    layer,
    'UI',
    chrome.verticalChain.record,
    paneLeft + paneWidth + chrome.verticalChain.rightOffset,
    paneTop,
    chrome.verticalChain.size[0],
    paneHeight,
  )

  addInventorySectionHeader(
    context,
    layer,
    chrome.sideHeader.titles[side],
    paneLeft + paneWidth / 2,
    chrome.sideHeader.frameTop,
    chrome.sideHeader.baselineY,
  )

  const cornerX = side === 'left' ? [128, 398] as const : [1202, 1472] as const
  chrome.cornerRecords.forEach((record, index) => {
    addCenteredAtlasSprite(
      context,
      layer,
      'UI',
      record,
      cornerX[index % 2]! + shift,
      index < 2 ? 114 : 384,
    )
  })
}

export function addInventorySectionHeader(
  context: RenderContext,
  layer: Container,
  label: string,
  centerX: number,
  frameTop: number,
  baselineY: number,
): void {
  const header = HUB_INVENTORY_ROOT_CHROME.sectionHeader
  const frameWidth = measureNativeUiText(label, header.font)
    + header.horizontalPadding * 2
  addNativeNineSlice(
    context,
    layer,
    'UI',
    header.record,
    centerX - frameWidth / 2,
    frameTop,
    frameWidth,
    header.frameHeight,
    HUB_INVENTORY_ROOT_CHROME.edgeUvOrigin,
  )
  addBitmapText(context, layer, label, header.font, centerX, baselineY, { tint: header.tint })
}

export function addStats(
  context: RenderContext,
  layer: Container,
  model: {
    readonly config: PlayerCharacterConfig
    readonly economy: ProtocolPlayerEconomy
    readonly progression: ProtocolPlayerProgression
  },
  companion: boolean,
  page: number,
): void {
  if (!Number.isInteger(page) || page < 0 || page >= HUB_INVENTORY_STATS_PAGES.pageCount) {
    throw new RangeError('native InventoryScreen stats page must be within [0,2]')
  }
  const clipRect = companion
    ? HUB_INVENTORY_STATS_PAGES.companionClipRect
    : HUB_INVENTORY_STATS_PAGES.standaloneClipRect
  const viewport = new Container({ label: 'native-inventory-stats-viewport' })
  const content = new Container({ label: 'native-inventory-stats-content' })
  const mask = new Graphics()
    .rect(clipRect[0], clipRect[1], clipRect[2], clipRect[3])
    .fill({ color: 0xffffff })
  content.mask = mask
  content.y = -page * HUB_INVENTORY_STATS_PAGES.pageHeight
  viewport.addChild(content, mask)
  layer.addChild(viewport)

  const decorationShift = companion ? 0 : -53
  const contentShift = companion ? 53 : 0
  addCenteredAtlasSprite(context, content, 'Inventory', 16, 119 + decorationShift, 151)
  addCenteredAtlasSprite(context, content, 'Inventory', 16, 309 + decorationShift, 151)
  addCenteredAtlasSprite(context, content, 'Inventory', 16, 164 + decorationShift, 233.5)
  addCenteredAtlasSprite(context, content, 'Inventory', 16, 169 + decorationShift, 284.5)
  addCenteredAtlasSprite(context, content, 'Inventory', 16, 319 + decorationShift, 256.5)
  addCenteredAtlasSprite(context, content, 'Inventory', 16, 119 + decorationShift, 367.5)
  for (const [x, y] of HUB_INVENTORY_ATTRIBUTES_PAGE.decorationCenters) {
    addCenteredAtlasSprite(context, content, 'Inventory', 16, x + contentShift, y)
  }
  addCenteredAtlasSprite(
    context,
    content,
    'Inventory',
    HUB_PRIMARY_SPELL_PANE.gemRecord,
    HUB_PRIMARY_SPELL_PANE.gemCenter[0] + contentShift,
    HUB_PRIMARY_SPELL_PANE.gemCenter[1],
  )
  const indicatorX = companion
    ? HUB_INVENTORY_STATS_PAGES.companionIndicatorX
    : HUB_INVENTORY_STATS_PAGES.standaloneIndicatorX
  for (const y of [379, 699]) {
    addCenteredAtlasSprite(context, content, 'Inventory', HUB_INVENTORY_STATS_PAGES.indicatorRecord, indicatorX, y)
  }
  for (const y of [439, 759]) {
    addCenteredAtlasSprite(
      context,
      content,
      'Inventory',
      HUB_INVENTORY_STATS_PAGES.indicatorRecord,
      indicatorX,
      y,
      1,
      -1,
    )
  }
  addInventoryInfoFrame(
    context,
    content,
    HUB_INVENTORY_IDENTITY_PAGE.headingRect[0] + contentShift,
    HUB_INVENTORY_IDENTITY_PAGE.headingRect[1],
    HUB_INVENTORY_IDENTITY_PAGE.headingRect[2],
    HUB_INVENTORY_IDENTITY_PAGE.headingRect[3],
  )
  addInventoryInfoFrame(
    context,
    content,
    HUB_INVENTORY_IDENTITY_PAGE.bodyRect[0] + contentShift,
    HUB_INVENTORY_IDENTITY_PAGE.bodyRect[1],
    HUB_INVENTORY_IDENTITY_PAGE.bodyRect[2],
    HUB_INVENTORY_IDENTITY_PAGE.bodyRect[3],
  )
  addInventoryInfoFrame(
    context,
    content,
    HUB_PRIMARY_SPELL_PANE.headingRect[0] + contentShift,
    HUB_PRIMARY_SPELL_PANE.headingRect[1],
    HUB_PRIMARY_SPELL_PANE.headingRect[2],
    HUB_PRIMARY_SPELL_PANE.headingRect[3],
  )
  addInventoryInfoFrame(
    context,
    content,
    HUB_PRIMARY_SPELL_PANE.bodyRect[0] + contentShift,
    HUB_PRIMARY_SPELL_PANE.bodyRect[1],
    HUB_PRIMARY_SPELL_PANE.bodyRect[2],
    HUB_PRIMARY_SPELL_PANE.bodyRect[3],
  )
  addInventoryInfoFrame(
    context,
    content,
    HUB_PRIMARY_SPELL_PANE.meleeHeadingRect[0] + contentShift,
    HUB_PRIMARY_SPELL_PANE.meleeHeadingRect[1],
    HUB_PRIMARY_SPELL_PANE.meleeHeadingRect[2],
    HUB_PRIMARY_SPELL_PANE.meleeHeadingRect[3],
  )
  addInventoryInfoFrame(
    context,
    content,
    HUB_PRIMARY_SPELL_PANE.meleeBodyRect[0] + contentShift,
    HUB_PRIMARY_SPELL_PANE.meleeBodyRect[1],
    HUB_PRIMARY_SPELL_PANE.meleeBodyRect[2],
    HUB_PRIMARY_SPELL_PANE.meleeBodyRect[3],
  )
  addBitmapText(
    context,
    content,
    model.config.displayName.toUpperCase(),
    'menu',
    HUB_INVENTORY_IDENTITY_PAGE.textLeft + contentShift,
    HUB_INVENTORY_IDENTITY_PAGE.nameTextBaselineY,
    { align: 'left', tint: 0xffffff },
  )
  addBitmapText(
    context,
    content,
    hubInventoryWizardIdentityText(
      model.progression.level,
      model.config.element,
      model.config.discipline,
    ),
    'medium',
    HUB_INVENTORY_IDENTITY_PAGE.textLeft + contentShift,
    HUB_INVENTORY_IDENTITY_PAGE.identityTextBaselineY,
    { align: 'left', tint: HUB_INVENTORY_IDENTITY_PAGE.textTint },
  )
  const primaryTextTint = hubInventoryPrimarySpellTint(
    model.progression.selectedPrimarySkillId,
  )
  addBitmapText(
    context,
    content,
    'MELEE DAMAGE',
    HUB_PRIMARY_SPELL_PANE.headingFont,
    HUB_PRIMARY_SPELL_PANE.textLeft + contentShift,
    HUB_PRIMARY_SPELL_PANE.meleeHeadingTextBaselineY,
    { align: 'left', tint: HUB_PRIMARY_SPELL_PANE.headingTint },
  )
  addBitmapText(
    context,
    content,
    '0.5 - 1 / WHACK',
    HUB_PRIMARY_SPELL_PANE.contentFont,
    HUB_PRIMARY_SPELL_PANE.textLeft + contentShift,
    HUB_PRIMARY_SPELL_PANE.meleeValueTextBaselineY,
    {
      align: 'left',
      tint: primaryTextTint,
    },
  )

  const primarySpellLines = hubInventoryPrimarySpellLines(model.progression)
  const primaryTextLeft = HUB_PRIMARY_SPELL_PANE.textLeft + contentShift
  addBitmapText(
    context,
    content,
    'PRIMARY SPELL',
    HUB_PRIMARY_SPELL_PANE.headingFont,
    primaryTextLeft,
    HUB_PRIMARY_SPELL_PANE.headingTextBaselineY,
    { align: 'left', tint: HUB_PRIMARY_SPELL_PANE.headingTint },
  )
  primarySpellLines.forEach((line, index) => addBitmapTextRuns(
    context,
    content,
    [
      { advanceScale: HUB_PRIMARY_SPELL_PANE.contentAdvanceScale, text: line.text },
      ...(line.unit ? [{
        advanceScale: HUB_PRIMARY_SPELL_PANE.contentAdvanceScale
          * HUB_PRIMARY_SPELL_PANE.inlineUnit.scale,
        italic: HUB_PRIMARY_SPELL_PANE.inlineUnit.italic,
        offsetX: HUB_PRIMARY_SPELL_PANE.inlineUnit.offset[0],
        offsetY: HUB_PRIMARY_SPELL_PANE.inlineUnit.offset[1],
        scale: HUB_PRIMARY_SPELL_PANE.inlineUnit.scale,
        text: line.unit,
      }] : []),
    ],
    HUB_PRIMARY_SPELL_PANE.contentFont,
    primaryTextLeft,
    HUB_PRIMARY_SPELL_PANE.contentTextBaselines[index]!,
    primaryTextTint,
  ))

  addInventoryAttributePage(context, content, model.progression, contentShift)
  addHagathaInventoryPane(context, content, model.economy, decorationShift, 640)
}

function addInventoryAttributePage(
  context: RenderContext,
  layer: Container,
  progression: ProtocolPlayerProgression,
  shiftX: number,
): void {
  const page = HUB_INVENTORY_ATTRIBUTES_PAGE
  for (const rect of [
    page.attributesHeadingRect,
    page.attributesBodyRect,
    HUB_INVENTORY_ATTRIBUTES_PAGE.attributesValueRect,
    page.resistancesHeadingRect,
    page.resistancesBodyRect,
    HUB_INVENTORY_ATTRIBUTES_PAGE.resistancesValueRect,
  ]) {
    addInventoryInfoFrame(context, layer, rect[0] + shiftX, rect[1], rect[2], rect[3])
  }
  addBitmapText(
    context,
    layer,
    'ATTRIBUTES',
    page.headingFont,
    page.titleCenterX + shiftX,
    page.attributesHeadingTextBaselineY,
    { tint: page.headingTint },
  )
  addBitmapText(
    context,
    layer,
    'RESISTANCES',
    page.headingFont,
    page.titleCenterX + shiftX,
    page.resistancesHeadingTextBaselineY,
    { tint: page.headingTint },
  )
  const attributeRows = [
    ['HEALTH:', `${nativeRoundedStat(progression.currentHealth)}/${nativeRoundedStat(progression.maximumHealth)}`, page.rowTints.red],
    ['MANA:', `${nativeRoundedStat(progression.currentMana)}/${nativeRoundedStat(progression.maximumMana)}`, page.rowTints.blue],
    ['CAST SPEED:', `${nativeRoundedStat(progression.inventoryStats.castSpeedPercent)}%`, page.rowTints.green],
    ['WALK SPEED:', `${nativeRoundedStat(progression.inventoryStats.walkSpeedPercent)}%`, page.rowTints.green],
  ] as const
  attributeRows.forEach(([label, value, tint], index) => {
    const y = page.attributesRows[index]!
    addBitmapText(context, layer, label, page.labelFont, page.labelRight + shiftX, y, { align: 'right', tint })
    addBitmapText(context, layer, value, page.valueFont, page.valueLeft + shiftX, y, { align: 'left', tint })
  })
  const resistanceRows = [
    ['PAIN:', progression.inventoryStats.painResistancePercent, page.rowTints.red],
    ['MAGIC:', progression.inventoryStats.magicResistancePercent, page.rowTints.blue],
    ['POISON:', progression.inventoryStats.poisonResistancePercent, page.rowTints.green],
  ] as const
  resistanceRows.forEach(([label, value, tint], index) => {
    const y = page.resistanceRows[index]!
    addBitmapText(context, layer, label, page.labelFont, page.labelRight + shiftX, y, { align: 'right', tint })
    addBitmapText(context, layer, `${nativeRoundedStat(value)}%`, page.valueFont, page.valueLeft + shiftX, y, { align: 'left', tint })
  })
}

function nativeRoundedStat(value: number): string {
  return `${Math.round(value)}`
}

export function addPlayerPreview(context: RenderContext, layer: Container, element: WizardElement): NativeElementVfxView {
  const seal = addAtlasSprite(context, layer, 'UI', 62, 800, 249, { anchor: 0.5, scale: 1.25 })
  seal.alpha = 0.32
  seal.label = 'native-seal:0'
  const heading = 9
  const centerX = 800
  const centerY = 249
  const actor = new Container({ label: 'native-inventory-player-preview' })
  actor.sortableChildren = true
  actor.position.set(centerX, centerY)
  actor.scale.set(1.25)
  layer.addChild(actor)
  const staffFront = playerCharacterStaffIsFront(heading)
  const layers = [
    [PLAYER_CHARACTER_SHEETS.staffBack, 0, staffFront ? -1 : 1],
    [PLAYER_CHARACTER_SHEETS.robeDynamic[element], 0, 3],
    [PLAYER_CHARACTER_SHEETS.robeFixed[element], 0, 4],
    [PLAYER_CHARACTER_SHEETS.staffFront, 0, staffFront ? 5 : -1],
    [PLAYER_CHARACTER_SHEETS.head[element], null, 7],
  ] as const
  for (const [source, column, zIndex] of layers) {
    if (zIndex < 0) continue
    const sprite = new Sprite(actorFrameTexture(context, source, heading, column))
    sprite.anchor.set(0.5)
    sprite.zIndex = zIndex
    actor.addChild(sprite)
  }
  const vfx = new NativeElementVfxView(element, context.elementVfxTextures)
  const orbOffset = playerCharacterStaffOrbOffset(heading)
  vfx.container.position.set(orbOffset.x, orbOffset.y)
  vfx.container.zIndex = staffFront ? 6 : 2
  actor.addChild(vfx.container)
  vfx.update(0, 1)
  addBitmapText(context, layer, 'KILLS: 0', 'medium', 800, 337, { tint: 0xe7cc71 })
  addBitmapText(context, layer, 'AWESOMENESS: 0', 'medium', 800, 359, { tint: 0xe7cc71 })
  return vfx
}

function actorFrameTexture(
  context: RenderContext,
  sheet: string,
  heading: number,
  column: number | null,
): Texture {
  return context.playerCharacterAtlas.frame(sheet, column ?? 0, heading)
}

export function addEquipment(
  context: RenderContext,
  layer: Container,
  economy: ProtocolPlayerEconomy,
  selection: HubInventorySelectionModel | null,
  dragging: HubInventoryDragModel | null,
  hiddenItemIds: ReadonlySet<number>,
  companion: boolean,
  element: WizardElement,
): void {
  const xShift = companion ? 0 : 53
  for (const [x, y] of [[1337, 224], [1337, 289], [1479, 192], [1479, 256], [1479, 321]] as const) {
    addCenteredAtlasSprite(context, layer, 'Inventory', 16, x + xShift, y)
  }
  const thirdRingUnlocked = economy.ownedPerkSelectors.includes(19)
  const draggedBackpack = dragging?.owner === 'backpack'
    ? findInventoryItem(economy.backpack, dragging.itemId)
    : null
  const targetItem = draggedBackpack
  const acceptingSlots = new Set(targetItem ? equipmentSlotsForItem(targetItem, thirdRingUnlocked) : [])
  for (const slot of ['amulet', 'hat', 'weapon', 'robe', 'ring-0', 'ring-1', 'ring-2'] as const) {
    if (slot === 'ring-2' && !thirdRingUnlocked) continue
    const item = itemAtEquipmentSlot(economy, slot)
    const held = hiddenItemIds.has(item?.id ?? -1)
      || (dragging?.owner === 'equipment' && dragging.equipmentSlot === slot)
    for (const [x, y, width, height] of hubInventoryEquipmentSlotRects(slot, companion)) {
      layer.addChild(new Graphics()
        .rect(x, y, width, height)
        .fill({ color: HUB_EQUIPMENT_SINK_RENDER.interiorTint }))
      if (height === 46 || height === 72) {
        addAtlasSprite(
          context,
          layer,
          'Inventory',
          height === 46
            ? HUB_EQUIPMENT_SINK_RENDER.smallFrameRecord
            : HUB_EQUIPMENT_SINK_RENDER.normalFrameRecord,
          x,
          y,
        )
      } else if (HUB_EQUIPMENT_SINK_RENDER.tallPrimitiveOutline) {
        addPrimitiveFrame(layer, x + 1, y, width - 1, height - 1)
      }
      if (item && !held) addClippedItemIcon(
        context,
        layer,
        item,
        x + width / 2,
        y + height / 2,
        element,
        [x, y, width, height],
      )
      if (
        acceptingSlots.has(slot)
        || (selection?.owner === 'equipment'
          && selection.equipmentSlot === slot
          && selection.id === item?.id)
      ) addInventorySelection(layer, x, y, width, height)
    }
  }
}

export function addBelt(
  context: RenderContext,
  layer: Container,
  belt: PlayerBeltComponent,
  economy: ProtocolPlayerEconomy,
  progression: ProtocolPlayerProgression,
  element: WizardElement,
): Container {
  const hudLayer = new Container()
  hudLayer.label = 'native-modal-hud'
  layer.addChild(hudLayer)
  const hud = nativeHudModalSlideLayout(
    NATIVE_HUD_BACKBUFFER.width,
    NATIVE_HUD_BACKBUFFER.height,
    0,
  )
  addModalHudControls(context, hudLayer, hud)
  hud.belt.forEach((slot, index) => {
    const { x, y } = nativeHudRectCenter(slot)
    addCenteredAtlasSprite(context, hudLayer, 'UI', 2, x, y)
    const entry = belt[index]
    if (entry?.kind === 'skill') {
      addCenteredAtlasSprite(
        context,
        hudLayer,
        'Skills',
        nativeSkillIconRecord(entry.skillId, progression.weldBuildId),
        x,
        y,
      )
      return
    }
    if (!entry) return
    const potion = entry.kind === 'health-potion'
      ? nativeBeltPotionProjection(economy.backpack, 0)
      : entry.kind === 'mana-potion'
        ? nativeBeltPotionProjection(economy.backpack, 1)
        : null
    const item = potion?.item ?? nativeBeltEntryItem(entry, economy)
    if (!item) return
    addItemIcon(context, hudLayer, item, x, y, element)
    const quantity = potion?.count ?? item.quantity
    if (quantity > 1) addBitmapText(context, hudLayer, `${quantity}`, 'medium', x + 20, y + 22, {
      tint: 0xf4e5b4,
    })
  })
  addCenteredAtlasSprite(context, layer, 'UI', 82, 800.5, 872)
  return hudLayer
}

function addModalHudControls(
  context: RenderContext,
  layer: Container,
  hud: NativeHudControlLayout,
): void {
  for (const [control, rect] of [
    [HUB_MODAL_HUD_CONTROLS.backpack, hud.backpack],
    [HUB_MODAL_HUD_CONTROLS.tome, hud.tome],
  ] as const) {
    const center = nativeHudRectCenter(rect)
    const shadow = addCenteredAtlasSprite(
      context,
      layer,
      'UI',
      control.record,
      center.x + HUB_MODAL_HUD_CONTROLS.shadowOffset[0],
      center.y + HUB_MODAL_HUD_CONTROLS.shadowOffset[1],
    )
    shadow.label = `${control.label}-shadow`
    shadow.tint = HUB_MODAL_HUD_CONTROLS.shadowTint
    const base = addCenteredAtlasSprite(context, layer, 'UI', control.record, center.x, center.y)
    base.label = control.label
  }
}

export function addHagathaInventoryPane(
  context: RenderContext,
  layer: Container,
  economy: ProtocolPlayerEconomy,
  offsetX = 0,
  offsetY = 0,
): void {
  const left = HUB_HAGATHA_PERK_PANE.left + offsetX
  const top = HUB_HAGATHA_PERK_PANE.top + offsetY
  for (const [x, y] of [[323, 227], [166, 247], [166, 312], [166, 182], [111, 125]] as const) {
    addCenteredAtlasSprite(context, layer, 'Inventory', 16, x + offsetX, y + offsetY)
  }
  addAtlasSprite(context, layer, 'Inventory', 3, 362 + offsetX, 218 + offsetY)
  addInventoryInfoFrame(
    context,
    layer,
    left,
    top,
    HUB_HAGATHA_PERK_PANE.innerWidth,
    HUB_HAGATHA_PERK_PANE.innerHeight,
  )
  addBitmapText(
    context,
    layer,
    'CHARMS/CURSES',
    'medium',
    HUB_HAGATHA_PERK_PANE.titleCenterX + offsetX,
    HUB_HAGATHA_PERK_PANE.titleTextBaselineY + offsetY,
    { tint: HUB_HAGATHA_PERK_PANE.titleTint },
  )
  for (let index = 0; index < HUB_HAGATHA_PERK_PANE.columns * HUB_HAGATHA_PERK_PANE.rows; index += 1) {
    const centerX = HUB_HAGATHA_PERK_PANE.slotCenterOrigin[0] + offsetX
      + (index % HUB_HAGATHA_PERK_PANE.columns) * HUB_HAGATHA_PERK_PANE.slotPitch
    const centerY = HUB_HAGATHA_PERK_PANE.slotCenterOrigin[1] + offsetY
      + Math.floor(index / HUB_HAGATHA_PERK_PANE.columns) * HUB_HAGATHA_PERK_PANE.slotPitch
    const selector = economy.ownedPerkSelectors[index]
    const slot = addCenteredAtlasSprite(
      context,
      layer,
      'Inventory',
      10,
      centerX,
      centerY,
      HUB_HAGATHA_PERK_PANE.slotScale,
    )
    slot.alpha = hubHagathaPerkSlotAlpha(index, economy.charmCapacity)
    if (selector !== undefined) addCenteredAtlasSprite(
      context,
      layer,
      'Skills',
      127 + selector,
      centerX,
      centerY,
      HUB_HAGATHA_PERK_PANE.slotScale,
    )
  }
  const tonicPromptCenter = hubHagathaTonicPromptCenter(economy.charmCapacity)
  if (tonicPromptCenter) {
    addCenteredAtlasSprite(
      context,
      layer,
      'Inventory',
      HUB_HAGATHA_PERK_PANE.tonicPromptRecord,
      tonicPromptCenter[0] + offsetX,
      tonicPromptCenter[1] + offsetY,
    )
  }
}

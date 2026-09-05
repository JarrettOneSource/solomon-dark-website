import { type PlayerCharacterConfig } from '../../core-kernels/player-character.ts'
import {
  type ProtocolPlayerEconomy,
  type ProtocolPlayerProgression,
} from '../../protocol/game-state.ts'
import {
  HUB_INVENTORY_ATTRIBUTES_PAGE,
  HUB_INVENTORY_IDENTITY_PAGE,
  HUB_INVENTORY_STATS_PAGES,
  HUB_PRIMARY_SPELL_PANE,
  hubInventoryPrimarySpellLines,
  hubInventoryPrimarySpellTint,
  hubInventoryWizardIdentityText,
} from '../hub-inventory-render-contract.ts'
import { addInventoryInfoFrame } from './chrome.ts'
import {
  addBitmapText,
  addBitmapTextRuns,
  addCenteredAtlasSprite,
} from './drawing.ts'
import { type RenderContext } from './model.ts'
import { addHagathaInventoryPane } from './services.ts'
import {
  Container,
  Graphics,
} from 'pixi.js'

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

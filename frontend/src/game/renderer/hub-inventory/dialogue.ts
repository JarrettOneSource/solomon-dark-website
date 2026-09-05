import { boastSelectionKey } from '../../core-kernels/boast.ts'
import {
  nativeSkillColorRoot,
  nativeSkillIconRecord,
} from '../../core-kernels/player-progression.ts'
import { hubInteractionDialogue } from '../../hub-inventory-presentation.ts'
import {
  type HubNpcSelectorRow,
  hubNpcChatChoices,
  hubNpcSelectorTitle,
} from '../../hub-npc-dialogue.ts'
import {
  NATIVE_UI_BOAST_SELECTED_TINT,
  nativeUiRecord,
  planNativeUiBoastMenu,
} from '../../native-ui/core.ts'
import { nativeUiPixiFor } from '../../native-ui/pixi.ts'
import {
  HUB_CHAT_PANEL,
  HUB_NATIVE_UI_SIZE,
  HUB_NPC_SELECTOR,
  hubNpcBookArtRecord,
  hubNpcBookDisplayTitle,
  hubNpcSelectorClampScroll,
  hubNpcSelectorContentHeight,
  hubNpcSelectorPriceTint,
  hubNpcSelectorRowRect,
} from '../hub-inventory-render-contract.ts'
import { skillPickerRootTint } from '../skill-picker-render-contract.ts'
import { addChatPanel } from './chrome.ts'
import {
  addBitmapText,
  addCenteredAtlasSprite,
  addChatBitmapText,
  addNativeNineSlice,
} from './drawing.ts'
import {
  type ChatRenderState,
  type HubInventoryRendererModel,
  type RenderContext,
} from './model.ts'
import {
  Container,
  Graphics,
  Sprite,
} from 'pixi.js'

export function buildDialogue(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'dialogue' }>,
): ChatRenderState {
  if (model.content.kind === 'selector') {
    if (model.content.selector === 'boast') {
      return buildBoastDialogue(context, layer, model)
    }
    return buildNpcSelector(context, layer, model)
  }
  const dialogue = hubInteractionDialogue(model.interaction, model.storyOffice)
  addChatPanel(context, layer)
  addBitmapText(
    context,
    layer,
    dialogue.name.toUpperCase(),
    'menu',
    HUB_CHAT_PANEL.titleCenterX,
    HUB_CHAT_PANEL.titleTextBaselineY,
    { tint: HUB_CHAT_PANEL.textTint },
  )

  const viewport = new Container()
  viewport.position.set(HUB_CHAT_PANEL.contentLeft, HUB_CHAT_PANEL.contentTop)
  const mask = new Graphics()
    .rect(0, 0, HUB_CHAT_PANEL.contentWidth, HUB_CHAT_PANEL.contentHeight)
    .fill({ color: 0xffffff })
  const content = new Container()
  viewport.addChild(mask, content)
  viewport.mask = mask
  layer.addChild(viewport)

  let contentHeight = 0
  if (model.content.kind === 'choices') {
    const choices = hubNpcChatChoices(model.interaction, model.storyOffice)
    const rowHeight = Math.min(52, HUB_CHAT_PANEL.contentHeight / Math.max(1, choices.length))
    choices.forEach((choice, index) => addBitmapText(
      context,
      content,
      choice.label,
      'menu',
      HUB_CHAT_PANEL.contentWidth / 2,
      54 + index * rowHeight,
      {
        scale: choice.kind === 'command' ? 1.25 : 1,
        tint: choice.kind === 'command'
          ? HUB_CHAT_PANEL.actionTextTint
          : HUB_CHAT_PANEL.textTint,
      },
    ))
  } else {
    const paragraphs = model.content.lines
    const lineHeight = 27
    for (const paragraph of paragraphs) {
      const lineCount = addChatBitmapText(context, content, paragraph, 0, contentHeight, {
        lineHeight,
        maxWidth: HUB_CHAT_PANEL.contentWidth,
        tint: HUB_CHAT_PANEL.textTint,
      })
      contentHeight += lineCount * lineHeight + 22
    }
  }
  addBitmapText(
    context,
    layer,
    model.content.kind === 'speech' ? 'Skip' : 'Done',
    'menu',
    800,
    HUB_CHAT_PANEL.doneTextBaselineY,
    { tint: HUB_CHAT_PANEL.textTint },
  )
  return { content, contentHeight }
}

function buildBoastDialogue(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'dialogue' }>,
): ChatRenderState {
  const plan = planBoastDialogue(model)
  const rendered = nativeUiPixiFor(context.textures).render(plan, 'native-boast-menu')
  const viewport = rendered.children.find(child => child.label === 'boast:swipe-box')
  if (!(viewport instanceof Container)) {
    throw new Error('native Boast SwipeBox content layer is missing')
  }
  for (const placement of plan.customIcons) {
    const row = model.selectorRows.find(candidate => (
      hubNpcSelectorRendererRowKey(candidate) === placement.id
    ))
    const icon = row?.boastIcon
    if (!row || !icon || icon.kind !== 'mod' || typeof row.id === 'number') continue
    const texture = context.modTextures.spriteFrame(
      `boast:${row.id.modId}:${row.id.contentId}`,
      row.id.modId,
      icon.imagePath,
      icon.frame,
    )
    for (const side of ['left', 'right'] as const) {
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.position.set(
        side === 'left'
          ? placement.leftEdgeX + icon.frame.logicalWidth / 2
          : placement.rightEdgeX - icon.frame.logicalWidth / 2,
        placement.y,
      )
      if (side === 'right') sprite.scale.x = -1
      if (placement.selected) sprite.tint = NATIVE_UI_BOAST_SELECTED_TINT
      sprite.eventMode = 'none'
      sprite.label = `${placement.id}:custom-icon-${side}`
      viewport.addChild(sprite)
    }
  }
  layer.addChild(rendered)
  return { content: new Container({ label: 'native-boast-static-content' }), contentHeight: 0 }
}

export function planBoastDialogue(
  model: Extract<HubInventoryRendererModel, { kind: 'dialogue' }>,
) {
  const active = model.highlightedSelectorId ?? model.selectedSelectorId
  return planNativeUiBoastMenu({
    height: HUB_NATIVE_UI_SIZE.height,
    rows: model.selectorRows.map(row => ({
      detail: row.detail,
      id: hubNpcSelectorRendererRowKey(row),
      label: row.label,
      ...(row.boastIcon?.kind === 'stock' ? { stockIconRecord: row.boastIcon.record } : {}),
      state: selectorIdsEqual(row.id, active) ? 'selected' : 'idle',
    })),
    scrollY: model.selectorScroll,
    width: HUB_NATIVE_UI_SIZE.width,
  })
}

function hubNpcSelectorRendererRowKey(row: HubNpcSelectorRow): string {
  return typeof row.id === 'number' ? `native:${row.id}` : boastSelectionKey(row.id)
}

function selectorIdsEqual(
  left: HubNpcSelectorRow['id'],
  right: HubNpcSelectorRow['id'] | null,
): boolean {
  if (right === null || typeof left === 'number' || typeof right === 'number') return left === right
  return left.contentId === right.contentId && left.modId === right.modId
}

function buildNpcSelector(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'dialogue' }>,
): ChatRenderState {
  if (model.content.kind !== 'selector') {
    throw new TypeError('native NPC selector renderer requires selector content')
  }
  const selector = model.content.selector
  if (selector === 'boast') {
    throw new TypeError('native Boast selector requires the dedicated BoastBox renderer')
  }
  const [panelLeft, panelTop, panelWidth, panelHeight] = HUB_NPC_SELECTOR.panelRect
  addNativeNineSlice(
    context,
    layer,
    'UI',
    HUB_CHAT_PANEL.uiRecord,
    panelLeft,
    panelTop,
    panelWidth,
    panelHeight,
    HUB_CHAT_PANEL.edgeUvOrigin,
  )
  addBitmapText(
    context,
    layer,
    hubNpcSelectorTitle(selector),
    'menu',
    HUB_CHAT_PANEL.titleCenterX,
    HUB_NPC_SELECTOR.titleTextBaselineY,
    { tint: HUB_NPC_SELECTOR.rowTextTint },
  )

  const [viewportLeft, viewportTop, viewportWidth, viewportHeight] = HUB_NPC_SELECTOR.viewportRect
  const viewport = new Container()
  viewport.position.set(viewportLeft, viewportTop)
  const mask = new Graphics()
    .rect(0, 0, viewportWidth, viewportHeight)
    .fill({ color: 0xffffff })
  const content = new Container()
  const scroll = hubNpcSelectorClampScroll(model.selectorScroll, model.selectorRows.length)
  content.position.y = -scroll
  viewport.addChild(mask, content)
  viewport.mask = mask
  layer.addChild(viewport)

  if (model.selectorRows.length === 0) {
    addBitmapText(
      context,
      content,
      selector === 'teacher-spells' ? 'ALL SPELLS\nALREADY BOUGHT!' : 'NO ENTRIES',
      'menu',
      viewportWidth / 2,
      HUB_NPC_SELECTOR.emptyTextBaselineY - viewportTop,
      { align: 'center', tint: HUB_NPC_SELECTOR.rowTextTint },
    )
  }

  model.selectorRows.forEach((row, index) => {
    const [, globalTop] = hubNpcSelectorRowRect(index, 0)
    const rowX = HUB_NPC_SELECTOR.rowInsetX
    const rowY = globalTop - viewportTop
    const active = selectorIdsEqual(
      row.id,
      model.highlightedSelectorId ?? model.selectedSelectorId,
    )
    const rowTint = active
      ? NATIVE_UI_BOAST_SELECTED_TINT
      : HUB_NPC_SELECTOR.rowTextTint
    const frame = new Container()
    addNativeNineSlice(
      context,
      frame,
      'UI',
      HUB_NPC_SELECTOR.rowRecord,
      rowX,
      rowY,
      HUB_NPC_SELECTOR.rowWidth,
      HUB_NPC_SELECTOR.rowHeight,
      HUB_CHAT_PANEL.edgeUvOrigin,
    )
    if (active) frame.tint = HUB_NPC_SELECTOR.selectedTint
    content.addChild(frame)
    if (selector === 'teacher-spells') {
      addTeacherSpellSelectorRow(context, content, row, rowX, rowY, model.gold, rowTint)
    } else {
      addBookSelectorRow(context, content, row, rowX, rowY, rowTint)
    }
  })

  if (selector === 'teacher-spells') {
    addCenteredAtlasSprite(
      context,
      layer,
      'UI',
      21,
      ...HUB_NPC_SELECTOR.balanceIconCenter,
    )
    addBitmapText(
      context,
      layer,
      `${model.gold}`,
      'body',
      ...HUB_NPC_SELECTOR.balanceTextBaseline,
      { align: 'left', tint: 0xffffff },
    )
  }
  addBitmapText(
    context,
    layer,
    'DONE',
    'menu',
    HUB_CHAT_PANEL.titleCenterX,
    HUB_NPC_SELECTOR.doneTextBaselineY,
    { tint: HUB_NPC_SELECTOR.rowTextTint },
  )
  return {
    content,
    contentHeight: hubNpcSelectorContentHeight(model.selectorRows.length),
  }
}

function addTeacherSpellSelectorRow(
  context: RenderContext,
  layer: Container,
  row: HubNpcSelectorRow,
  x: number,
  y: number,
  gold: number,
  tint: number,
): void {
  if (typeof row.id !== 'number') throw new TypeError('native Teacher row ID must be numeric')
  const root = nativeSkillColorRoot(row.id)
  const centerX = x + 43
  const centerY = y + HUB_NPC_SELECTOR.rowHeight / 2
  const backing = addCenteredAtlasSprite(
    context,
    layer,
    'Skills',
    HUB_NPC_SELECTOR.spellBackingRecord,
    centerX,
    centerY,
  )
  backing.tint = skillPickerRootTint(root)
  addCenteredAtlasSprite(
    context,
    layer,
    'Skills',
    HUB_NPC_SELECTOR.spellFrameRecord,
    centerX,
    centerY,
    HUB_NPC_SELECTOR.spellFrameScale,
  )
  const icon = addCenteredAtlasSprite(
    context,
    layer,
    'Skills',
    nativeSkillIconRecord(row.id),
    centerX,
    centerY,
  )
  icon.tint = 0xffffff
  addBitmapText(context, layer, row.label, 'special-uppercase', x + 90, y + 31, {
    align: 'left',
    tint,
  })
  addBitmapText(context, layer, row.detail.toUpperCase(), 'medium', x + 90, y + 49, {
    align: 'left',
    lineHeight: HUB_NPC_SELECTOR.spellDescriptionLineHeight,
    maxWidth: HUB_NPC_SELECTOR.spellDescriptionWidth,
    scale: HUB_NPC_SELECTOR.spellDescriptionScale,
    tint,
  })
  if (row.price !== null) {
    addBitmapText(context, layer, `${row.price}`, 'body', x + HUB_NPC_SELECTOR.rowWidth - 3, y + 80, {
      align: 'right',
      tint: hubNpcSelectorPriceTint(row.price, gold),
    })
  }
}

function addBookSelectorRow(
  context: RenderContext,
  layer: Container,
  row: HubNpcSelectorRow,
  x: number,
  y: number,
  tint: number,
): void {
  if (typeof row.id !== 'number') throw new TypeError('native Book row ID must be numeric')
  const record = hubNpcBookArtRecord(row.label)
  const artWidth = nativeUiRecord('Library', record).logicalSize[0]
  const art = addCenteredAtlasSprite(
    context,
    layer,
    'Library',
    record,
    x + HUB_NPC_SELECTOR.bookArtInsetX + artWidth / 2,
    y + HUB_NPC_SELECTOR.rowHeight / 2,
  )
  art.tint = tint
  addBitmapText(
    context,
    layer,
    hubNpcBookDisplayTitle(row.label),
    'special-uppercase',
    x + HUB_NPC_SELECTOR.bookTextInsetX,
    y + HUB_NPC_SELECTOR.rowHeight / 2 - 15,
    {
      align: 'left',
      lineHeight: 22,
      maxWidth: HUB_NPC_SELECTOR.rowWidth - HUB_NPC_SELECTOR.bookTextInsetX - 15,
      tint,
    },
  )
}

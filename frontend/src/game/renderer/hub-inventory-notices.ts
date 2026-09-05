import { Container, Graphics } from 'pixi.js'
import {
  NATIVE_DYE_SWATCHES,
  inventoryItemsAtSackPath,
  nativeDyeMixedTint,
  inventoryDyeableClothingItems,
  projectInventoryRootSlots,
} from '../core-kernels/hub-economy.ts'
import type { ProtocolPlayerEconomy } from '../protocol/game-state.ts'
import {
  measureNativeUiText,
  planNativeUiMessageFrame,
  type NativeUiSingleActionMessageLayout,
} from '../native-ui/core.ts'
import { nativeUiPixiFor } from '../native-ui/pixi.ts'
import {
  HUB_DYE_CLOTHING,
  HUB_INVENTORY_GRID,
  HUB_MSGBOX_ART,
  HUB_NATIVE_UI_TIMING,
  HUB_NATIVE_UI_SIZE,
  HUB_SHOP_TEXT,
  HUB_UNFORGE_CONFIRMATION,
  HUB_UNFORGE_RESULT,
  hubDyeItemLayerRects,
  hubDyeSwatchRect,
  hubInventorySlotPosition,
  hubInventoryVisibleSlot,
  hubStandardNoticeLayout,
  hubUnforgeResultLayout,
} from './hub-inventory-render-contract.ts'
import type { RenderContext } from './hub-inventory-render-model.ts'
import type {
  HubInventoryPressedControl,
  HubContentSizedRendererNotice,
  HubInventoryRendererNotice,
  HubInventoryDyeModalModel,
} from './hub-inventory-renderer.ts'
import {
  addNativeButton,
  addCenteredAtlasSprite,
  addNativeNineSlice,
  addTiledAtlas,
  addBitmapText,
} from './hub-inventory-drawing.ts'

export function buildDyeClothing(
  context: RenderContext,
  root: Container,
  economy: ProtocolPlayerEconomy,
  model: HubInventoryDyeModalModel,
): { readonly layer: Container; readonly selectedPulse: Graphics | null } {
  const layer = new Container()
  layer.label = 'native-dye-clothing'
  layer.alpha = 0
  layer.addChild(new Graphics()
    .rect(0, 0, HUB_NATIVE_UI_SIZE.width, HUB_NATIVE_UI_SIZE.height)
    .fill({ color: 0x000000, alpha: HUB_NATIVE_UI_TIMING.messageBoxCurtainAlpha }))
  const [panelLeft, panelTop, panelWidth, panelHeight] = HUB_DYE_CLOTHING.panelRect
  layer.addChild(new Graphics()
    .rect(panelLeft, panelTop, panelWidth, panelHeight)
    .fill({ color: 0x090908, alpha: 0.96 })
    .stroke({ color: 0xd8ba70, width: 3 }))
  layer.addChild(new Graphics()
    .rect(panelLeft + 7, panelTop + 7, panelWidth - 14, panelHeight - 14)
    .stroke({ color: 0xeadab3, width: 1 }))
  addBitmapText(
    context,
    layer,
    'FABRIC DYE',
    'menu',
    HUB_NATIVE_UI_SIZE.width / 2,
    HUB_DYE_CLOTHING.titleTextBaselineY,
    { tint: 0xe4c56d },
  )
  const instruction = model.pending
    ? 'DYEING...'
    : model.targetItemId !== null
      ? 'CHOOSE DYE CLOTH OR DYE TRIM'
      : model.swatchRows.length === 0
        ? 'MIX ONE OR MORE COLORS'
        : 'CHOOSE A HAT OR ROBE FROM YOUR BACKPACK'
  addBitmapText(
    context,
    layer,
    instruction,
    'medium',
    HUB_NATIVE_UI_SIZE.width / 2,
    HUB_DYE_CLOTHING.instructionTextBaselineY,
    { tint: 0xffffff },
  )

  let selectedPulse: Graphics | null = null
  for (let index = 0; index < NATIVE_DYE_SWATCHES.length; index += 1) {
    const rect = hubDyeSwatchRect(index)
    layer.addChild(new Graphics()
      .rect(...rect)
      .fill({ color: NATIVE_DYE_SWATCHES[index]! })
      .stroke({ color: 0x201c13, width: 2 }))
    if (index === model.selectedRow) {
      selectedPulse = new Graphics()
        .rect(rect[0] - 4, rect[1] - 4, rect[2] + 8, rect[3] + 8)
        .stroke({ color: 0xffffff, width: 3 })
      selectedPulse.label = 'native-dye-selected-pulse'
      layer.addChild(selectedPulse)
    }
  }

  const mixedTint = nativeDyeMixedTint(model.swatchRows)
  const [tubLeft, tubTop, tubWidth, tubHeight] = HUB_DYE_CLOTHING.tubRect
  const tub = new Graphics()
    .roundRect(tubLeft, tubTop, tubWidth, tubHeight, 18)
    .fill({
      color: mixedTint ?? 0xffffff,
      alpha: mixedTint === null ? HUB_DYE_CLOTHING.emptyTubAlpha : 1,
    })
    .stroke({ color: 0xeadab3, width: 3 })
  layer.addChild(tub)
  addBitmapText(context, layer, 'DYE TUB', 'medium', tubLeft + tubWidth / 2, tubTop + tubHeight + 25, {
    tint: 0xe4c56d,
  })

  const projected = projectInventoryRootSlots(
    inventoryItemsAtSackPath(economy.backpack, model.path) ?? [],
  ).filter(({ slot }) => (
    slot < HUB_INVENTORY_GRID.capacity - (model.path.length > 0 ? 1 : 0)
  ))
  const eligibleIds = new Set(inventoryDyeableClothingItems(economy.backpack).map(({ item }) => item.id))
  projected.forEach(({ item, slot }) => {
    if (!eligibleIds.has(item.id)) return
    const visibleSlot = hubInventoryVisibleSlot(slot, model.path.length > 0)
    const { x, y } = hubInventorySlotPosition(visibleSlot)
    layer.addChild(new Graphics()
      .rect(x + 2, y + 2, HUB_INVENTORY_GRID.cellSize - 4, HUB_INVENTORY_GRID.cellSize - 4)
      .stroke({ color: item.id === model.targetItemId ? 0xffffff : 0xd8ba70, width: 3 }))
  })
  if (model.targetItemId !== null) {
    const target = projected.find(({ item }) => item.id === model.targetItemId)
    if (target) {
      const rects = hubDyeItemLayerRects(hubInventoryVisibleSlot(
        target.slot,
        model.path.length > 0,
      ))
      layer.addChild(new Graphics()
        .rect(...rects.cloth)
        .fill({ color: 0x000000, alpha: 0.38 })
        .stroke({ color: 0xffffff, width: 2 }))
      layer.addChild(new Graphics()
        .rect(...rects.trim)
        .fill({ color: 0x000000, alpha: 0.38 })
        .stroke({ color: 0xffffff, width: 2 }))
      addBitmapText(
        context,
        layer,
        'CLOTH',
        'body',
        rects.cloth[0] + rects.cloth[2] / 2,
        rects.cloth[1] + 26,
        { tint: 0xffffff },
      )
      addBitmapText(
        context,
        layer,
        'TRIM',
        'body',
        rects.trim[0] + rects.trim[2] / 2,
        rects.trim[1] + 22,
        { tint: 0xffffff },
      )
    }
  }

  const [cancelLeft, cancelTop, cancelWidth, cancelHeight] = HUB_DYE_CLOTHING.cancelRect
  layer.addChild(new Graphics()
    .rect(cancelLeft, cancelTop, cancelWidth, cancelHeight)
    .fill({ color: 0x191916 })
    .stroke({ color: 0xd8ba70, width: 2 }))
  addBitmapText(
    context,
    layer,
    'CANCEL',
    'menu',
    cancelLeft + cancelWidth / 2,
    cancelTop + 31,
    { tint: 0xffffff },
  )
  root.addChild(layer)
  return { layer, selectedPulse }
}

export function buildNotice(
  context: RenderContext,
  layer: Container,
  notice: HubInventoryRendererNotice,
  pressedControl: HubInventoryPressedControl,
): void {
  if (notice.variant !== 'standard') {
    buildUnforgeNotice(context, layer, notice, pressedControl)
    return
  }
  const noticeLayer = new Container()
  noticeLayer.label = 'native-notice'
  const layout = hubStandardNoticeLayout(notice)
  const frame = planNativeUiMessageFrame({
    bounds: layout.frameBounds,
    dimAlpha: 0.75,
    height: HUB_NATIVE_UI_SIZE.height,
    lines: layout.lines,
    width: HUB_NATIVE_UI_SIZE.width,
  })
  noticeLayer.addChild(nativeUiPixiFor(context.textures).render(frame, 'message-frame'))
  addMessageBoxButton(
    context,
    noticeLayer,
    notice.actionLabel,
    pressedControl === 'message-primary',
    layout,
  )
  layer.addChild(noticeLayer)
}

function buildUnforgeNotice(
  context: RenderContext,
  layer: Container,
  notice: HubContentSizedRendererNotice,
  pressedControl: HubInventoryPressedControl,
): void {
  const confirmation = notice.variant === 'unforge-confirmation'
  const resultLayout = confirmation ? null : hubUnforgeResultLayout(Math.max(
    measureNativeUiText(notice.title, 'menu'),
    measureNativeUiText(notice.summary ?? 'Unforging bonus:', 'medium'),
    measureNativeUiText(notice.body, 'medium'),
  ))
  const innerPanelRect = confirmation
    ? HUB_UNFORGE_CONFIRMATION.innerPanelRect
    : resultLayout!.innerPanelRect
  const bodyLeft = confirmation ? HUB_UNFORGE_CONFIRMATION.bodyLeft : resultLayout!.bodyLeft
  const titleTextBaselineY = confirmation
    ? HUB_UNFORGE_CONFIRMATION.titleTextBaselineY
    : HUB_UNFORGE_RESULT.titleTextBaselineY
  const noticeLayer = new Container()
  noticeLayer.label = 'native-notice'
  noticeLayer.addChild(new Graphics()
    .rect(0, 0, HUB_NATIVE_UI_SIZE.width, HUB_NATIVE_UI_SIZE.height)
    .fill({ color: 0x000000, alpha: HUB_NATIVE_UI_TIMING.messageBoxCurtainAlpha }))
  addContentSizedMessageBox(context, noticeLayer, innerPanelRect)

  addBitmapText(
    context,
    noticeLayer,
    notice.title,
    'menu',
    bodyLeft,
    titleTextBaselineY,
    { align: 'left', tint: 0xffffff },
  )
  if (confirmation) {
    addBitmapText(
      context,
      noticeLayer,
      notice.body,
      'medium',
      HUB_UNFORGE_CONFIRMATION.bodyLeft,
      HUB_UNFORGE_CONFIRMATION.bodyTextBaselineY,
      {
        align: 'left',
        lineHeight: 17,
        maxWidth: HUB_UNFORGE_CONFIRMATION.bodyMaxWidth,
        tint: 0xffffff,
      },
    )
    addContentSizedMessageButton(
      context,
      noticeLayer,
      notice.actionLabel,
      HUB_UNFORGE_CONFIRMATION.primaryButtonRect,
      pressedControl === 'message-primary',
    )
    addContentSizedMessageButton(
      context,
      noticeLayer,
      notice.secondaryActionLabel ?? 'CANCEL',
      HUB_UNFORGE_CONFIRMATION.secondaryButtonRect,
      pressedControl === 'message-secondary',
    )
  } else {
    addBitmapText(
      context,
      noticeLayer,
      notice.summary ?? 'Unforging bonus:',
      'medium',
      resultLayout!.bodyLeft,
      HUB_UNFORGE_RESULT.summaryTextBaselineY,
      { align: 'left', tint: HUB_SHOP_TEXT.goldTint },
    )
    addBitmapText(
      context,
      noticeLayer,
      notice.body,
      'medium',
      resultLayout!.bodyLeft,
      HUB_UNFORGE_RESULT.outcomeTextBaselineY,
      { align: 'left', tint: notice.outcomeTint ?? 0x40ff40 },
    )
    addContentSizedMessageButton(
      context,
      noticeLayer,
      notice.actionLabel,
      resultLayout!.primaryButtonRect,
      pressedControl === 'message-primary',
    )
  }
  layer.addChild(noticeLayer)
}

function addContentSizedMessageBox(
  context: RenderContext,
  layer: Container,
  innerRect: readonly [number, number, number, number],
): void {
  const [x, y, width, height] = innerRect
  addTiledAtlas(context, layer, 'UI', HUB_MSGBOX_ART.horizontalEdgeRecord, x + 66.5, y - 11.5, width - 133, 19)
  addTiledAtlas(context, layer, 'UI', HUB_MSGBOX_ART.horizontalEdgeRecord, x + 66.5, y + height - 7.5, width - 133, 19)
  addTiledAtlas(context, layer, 'UI', HUB_MSGBOX_ART.verticalEdgeRecord, x - 11.5, y + 71.5, 21, height - 143)
  addTiledAtlas(context, layer, 'UI', HUB_MSGBOX_ART.verticalEdgeRecord, x + width - 9.5, y + 71.5, 21, height - 143)
  const corners = [
    [x + 24, y + 27],
    [x + width - 24, y + 27],
    [x + 24, y + height - 27],
    [x + width - 24, y + height - 27],
  ] as const
  corners.forEach(([centerX, centerY], index) => {
    addCenteredAtlasSprite(context, layer, 'UI', 107 + index, centerX, centerY)
  })
  addTiledAtlas(
    context,
    layer,
    'UI',
    HUB_MSGBOX_ART.interiorBackgroundRecord,
    x - 5,
    y - 5,
    width + 10,
    height + 10,
  )
  addNativeNineSlice(
    context,
    layer,
    'UI',
    HUB_MSGBOX_ART.innerPanelRecord,
    x,
    y,
    width,
    height,
    HUB_MSGBOX_ART.innerPanelEdgeUvOrigin,
  )
  const centerX = x + width / 2
  const skull = addCenteredAtlasSprite(context, layer, 'UI', 18, centerX, y - 42)
  skull.rotation = Math.PI / 2
  addCenteredAtlasSprite(context, layer, 'UI', 8, centerX, y + height + 55)
  addCenteredAtlasSprite(context, layer, 'UI', 8, centerX - 75, y + height + 42, 0.75)
  addCenteredAtlasSprite(context, layer, 'UI', 8, centerX + 75, y + height + 42, 0.75)
}

function addContentSizedMessageButton(
  context: RenderContext,
  layer: Container,
  label: string,
  [left, top, width, height]: readonly [number, number, number, number],
  pressed: boolean,
): void {
  addNativeButton(
    context,
    layer,
    `content-message-${label}`,
    label,
    [left, top, width, height],
    pressed,
    left + width / 2,
    top + 45,
  )
}

function addMessageBoxButton(
  context: RenderContext,
  layer: Container,
  label: string,
  pressed: boolean,
  layout: Pick<NativeUiSingleActionMessageLayout, 'actionBounds' | 'actionTextBaselineY'>,
): void {
  const { height, left, top, width } = layout.actionBounds
  addNativeButton(
    context,
    layer,
    'message-primary',
    label,
    [left, top, width, height],
    pressed,
    left + width / 2,
    layout.actionTextBaselineY,
  )
}

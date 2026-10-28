import {
  measureNativeUiText,
  planNativeUiMessageFrame,
} from '../../native-ui/core.ts'
import { nativeUiPixiFor } from '../../native-ui/pixi.ts'
import {
  HUB_MSGBOX_ART,
  HUB_NATIVE_UI_SIZE,
  HUB_NATIVE_UI_TIMING,
  HUB_SHOP_TEXT,
  HUB_UNFORGE_CONFIRMATION,
  HUB_UNFORGE_RESULT,
  hubStandardNoticeLayout,
  hubUnforgeResultLayout,
} from '../hub-inventory-render-contract.ts'
import {
  addMessageBoxButton,
  addNativeButton,
} from './chrome.ts'
import {
  addBitmapText,
  addCenteredAtlasSprite,
  addNativeNineSlice,
  addTiledAtlas,
} from './drawing.ts'
import {
  type HubContentSizedRendererNotice,
  type HubInventoryPressedControl,
  type HubInventoryRendererNotice,
  type RenderContext,
} from './model.ts'
import {
  Container,
  Graphics,
} from 'pixi.js'

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

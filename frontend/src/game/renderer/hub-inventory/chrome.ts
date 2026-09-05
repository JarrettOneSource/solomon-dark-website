import { NATIVE_INVENTORY_GOLD_LEDGER } from '../../native-inventory-gold-layout.ts'
import {
  NATIVE_UI_BUTTON,
  type NativeUiSingleActionMessageLayout,
  measureNativeUiText,
  nativeUiRect,
  planNativeUiButtonChrome,
} from '../../native-ui/core.ts'
import { nativeUiPixiFor } from '../../native-ui/pixi.ts'
import {
  HUB_CHAT_PANEL,
  HUB_DOWSING_PREROLL,
  HUB_INVENTORY_INFO_FRAME,
  HUB_INVENTORY_ROOT_CHROME,
  HUB_MSGBOX_ART,
  HUB_SHOP_PANEL,
  HUB_SHOP_TEXT,
  hubDowsingFieldTint,
} from '../hub-inventory-render-contract.ts'
import {
  addBitmapText,
  addCenteredAtlasSprite,
  addNativeNineSlice,
  addRepeatedAtlas,
  addTiledAtlas,
  atlasTexture,
} from './drawing.ts'
import { type RenderContext } from './model.ts'
import {
  Container,
  Graphics,
  NineSliceSprite,
} from 'pixi.js'

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

function addInventorySectionHeader(
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

export function addBackpackFrame(context: RenderContext, layer: Container): void {
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, -63.5, 513.5)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 1663.5, 513.5, -1, 1)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, -63.5, 775.5, 1, -1)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 1663.5, 775.5, -1, -1)
  addCenteredAtlasSprite(context, layer, 'UI', 71, 21, 481)
  addCenteredAtlasSprite(context, layer, 'UI', 71, 1631, 481)
  addCenteredAtlasSprite(context, layer, 'UI', 71, 21, 809)
  addCenteredAtlasSprite(context, layer, 'UI', 71, 1631, 809)
  const header = HUB_INVENTORY_ROOT_CHROME.backpackHeader
  addInventorySectionHeader(
    context,
    layer,
    header.text,
    header.centerX,
    header.frameTop,
    header.baselineY,
  )
}

export function addChatPanel(context: RenderContext, layer: Container): void {
  addNativeNineSlice(
    context,
    layer,
    'UI',
    HUB_CHAT_PANEL.uiRecord,
    HUB_CHAT_PANEL.left,
    HUB_CHAT_PANEL.top,
    HUB_CHAT_PANEL.width,
    HUB_CHAT_PANEL.height,
    HUB_CHAT_PANEL.edgeUvOrigin,
  )
}

export function addShopPanel(context: RenderContext, layer: Container, purple: boolean): void {
  const { backgroundHeight, backgroundRepeat, settledLeft: left, settledTop: top, width } = HUB_SHOP_PANEL
  for (const blendMode of HUB_SHOP_PANEL.backgroundBlendModes) {
    const backgroundTiles = addRepeatedAtlas(
      context,
      layer,
      'UI',
      49,
      left,
      top,
      width,
      backgroundHeight,
      ...backgroundRepeat,
    )
    for (const tile of backgroundTiles) {
      tile.blendMode = blendMode
      tile.tint = purple ? hubDowsingFieldTint(0) : HUB_SHOP_TEXT.normalBackgroundTint
      if (purple) tile.label = 'native-dowsing-field'
    }
  }
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 557.5, 16.5)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 1041.5, 16.5, -1, 1)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 557.5, 333.5, 1, -1)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 1041.5, 333.5, -1, -1)
  addCenteredAtlasSprite(context, layer, 'Skills', 4, 600, 25)
  addCenteredAtlasSprite(context, layer, 'Skills', 4, 1000, 25, -1, 1)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 588.5, 13)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 1011.5, 13, -1, 1)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 588.5, 33, 1, -1)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 1011.5, 33, -1, -1)

  for (let index = 0; index < 5; index += 1) {
    addCenteredAtlasSprite(context, layer, 'UI', 74, 570.5 + index * 129, -35, 1, -1)
  }
  for (let index = 0; index < 10; index += 1) {
    const leftRail = addCenteredAtlasSprite(context, layer, 'UI', 74, 506, -13 + index * 44)
    leftRail.rotation = Math.PI / 2
    const rightRail = addCenteredAtlasSprite(context, layer, 'UI', 74, 1093, -13 + index * 44, 1, -1)
    rightRail.rotation = Math.PI / 2
  }
  addCenteredAtlasSprite(context, layer, 'UI', 73, 1063, 355)
  addCenteredAtlasSprite(context, layer, 'UI', 73, 536, 355, -1, 1)
  addCenteredAtlasSprite(context, layer, 'UI', 73, 1063, -5, 1, -1)
  addCenteredAtlasSprite(context, layer, 'UI', 73, 536, -5, -1, -1)
}

export function addDoneControl(context: RenderContext, layer: Container): void {
  addCenteredAtlasSprite(context, layer, 'UI', 72, 800, 387)
  const middle = addCenteredAtlasSprite(context, layer, 'UI', 12, 800, 385)
  middle.alpha = HUB_SHOP_PANEL.doneMiddleAlpha
  const inner = addCenteredAtlasSprite(context, layer, 'UI', 86, 800, 385)
  inner.tint = HUB_SHOP_PANEL.doneInnerTint
  addBitmapText(context, layer, 'DONE', 'menu', 800, HUB_SHOP_TEXT.doneTextBaselineY, { tint: 0xffffff })
}

export function addDowsingButton(
  context: RenderContext,
  layer: Container,
  fee: number,
  pressed: boolean,
): void {
  const copyOffset = addNativeButton(
    context,
    layer,
    'dowsing',
    'DOWSE',
    HUB_DOWSING_PREROLL.buttonActionRect,
    pressed,
    800,
    HUB_DOWSING_PREROLL.labelTextBaselineY,
  )
  addBitmapText(
    context,
    layer,
    `${fee} GOLD`,
    'medium',
    800 + copyOffset,
    HUB_DOWSING_PREROLL.feeTextBaselineY + copyOffset,
    { tint: HUB_SHOP_TEXT.goldTint },
  )
}

export function addMessageBoxButton(
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

export function addNativeButton(
  context: RenderContext,
  layer: Container,
  id: string,
  label: string,
  [left, top, width, height]: readonly [number, number, number, number],
  pressed: boolean,
  labelCenterX: number,
  labelBaselineY: number,
): number {
  const chrome = planNativeUiButtonChrome({
    bounds: nativeUiRect(left, top, width, height),
    id,
    state: pressed ? 'pressed' : 'idle',
  })
  layer.addChild(nativeUiPixiFor(context.textures).render(chrome, `${id}:chrome`))
  const copyOffset = pressed ? NATIVE_UI_BUTTON.pressedOffset : 0
  addBitmapText(
    context,
    layer,
    label,
    'menu',
    labelCenterX + copyOffset,
    labelBaselineY + copyOffset,
    { tint: HUB_MSGBOX_ART.primaryButtonTextTint },
  )
  return copyOffset
}

export function addHorizontalChain(context: RenderContext, layer: Container, x: number, y: number, width: number): void {
  addTiledAtlas(context, layer, 'UI', 10, x, y, width, 24, 1.25)
}

export function addInventoryInfoFrame(
  context: RenderContext,
  layer: Container,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  layer.addChild(new Graphics()
    .rect(x, y, width, height)
    .fill({ color: HUB_INVENTORY_INFO_FRAME.fillTint }))
  const frame = new NineSliceSprite({
    bottomHeight: HUB_INVENTORY_INFO_FRAME.sourceThird,
    height,
    leftWidth: HUB_INVENTORY_INFO_FRAME.sourceThird,
    rightWidth: HUB_INVENTORY_INFO_FRAME.sourceThird,
    texture: atlasTexture(context, 'Inventory', HUB_INVENTORY_INFO_FRAME.frameRecord),
    topHeight: HUB_INVENTORY_INFO_FRAME.sourceThird,
    width,
  })
  frame.label = 'native-inventory-info-frame'
  frame.position.set(x, y)
  layer.addChild(frame)
}

export function addPrimitiveFrame(layer: Container, x: number, y: number, width: number, height: number): void {
  layer.addChild(new Graphics().rect(x, y, width, height).stroke({ color: 0x000000, width: 2 }))
  layer.addChild(new Graphics().rect(x + 1, y + 1, width - 2, height - 2).stroke({
    color: 0xeadab3,
    width: 1,
  }))
  layer.addChild(new Graphics().rect(x + 2, y + 2, width - 4, height - 4).stroke({
    color: 0xd8ba70,
    width: 1,
  }))
  layer.addChild(new Graphics().rect(x + 3, y + 3, width - 6, height - 6).stroke({
    color: 0x15130b,
    width: 1,
  }))
}

export function addGold(context: RenderContext, layer: Container, gold: number): void {
  addCenteredAtlasSprite(
    context,
    layer,
    'UI',
    NATIVE_INVENTORY_GOLD_LEDGER.iconRecord,
    ...NATIVE_INVENTORY_GOLD_LEDGER.iconCenter,
  )
  addBitmapText(
    context,
    layer,
    gold.toLocaleString(),
    'body',
    NATIVE_INVENTORY_GOLD_LEDGER.textLeft,
    NATIVE_INVENTORY_GOLD_LEDGER.textBaselineY,
    { align: 'left', tint: 0xffffff },
  )
}

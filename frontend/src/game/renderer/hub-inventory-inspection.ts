import { Container, Graphics } from 'pixi.js'
import type { HubInventoryItem } from '../core-kernels/hub-economy.ts'
import type { ProtocolPlayerEconomy } from '../protocol/game-state.ts'
import { measureNativeUiText, nativeUiFont, wrapNativeUiText } from '../native-ui/core.ts'
import {
  HUB_HOVER_BOX,
  HUB_NATIVE_UI_SIZE,
  hubHagathaTooltipLines,
  hubItemTooltipLines,
  hubOwnedPerkSlotRect,
  type HubTooltipLine,
  type HubTooltipOptions,
} from './hub-inventory-render-contract.ts'
import type { RenderContext } from './hub-inventory-render-model.ts'
import type { HubServiceInspectionModel } from './hub-inventory-renderer.ts'
import { addBitmapText } from './hub-inventory-drawing.ts'

export function addOwnedPerkInspection(
  context: RenderContext,
  layer: Container,
  economy: ProtocolPlayerEconomy,
  inspection: Extract<HubServiceInspectionModel, { kind: 'owned-perk' }>,
  companion: boolean,
): void {
  if (economy.ownedPerkSelectors[inspection.index] !== inspection.selector) return
  const [baseLeft, top, width, height] = hubOwnedPerkSlotRect(inspection.index)
  const left = baseLeft - (companion ? 0 : 53)
  addNativeContextualHoverBox(
    context,
    layer,
    hubHagathaTooltipLines({
      cheatDeathCharges: inspection.selector === 7 ? 1 : null,
      firstMixed: true,
      price: null,
      selector: inspection.selector,
    }),
    left + width / 2,
    top + height / 2,
    HUB_HOVER_BOX.ownedPerkSourceGap,
  )
}

export function addNativeContextualHoverBox(
  context: RenderContext,
  layer: Container,
  lines: readonly HubTooltipLine[],
  sourceCenterX: number,
  sourceCenterY: number,
  sourceGap: number,
): Container {
  const rendered = lines.map((line) => {
    const font = nativeUiFont(line.font)
    const wrapped = wrapNativeUiText(line.text, line.font, HUB_HOVER_BOX.contentMaxWidth)
    return { font, line, wrapped }
  })
  const contentWidth = Math.max(0, ...rendered.flatMap(({ line, wrapped }) => (
    wrapped.map((text) => measureNativeUiText(text, line.font))
  )))
  const contentHeight = rendered.reduce((height, { font, wrapped }, index) => (
    height
    + wrapped.length * font.metrics[0]
    + (index === rendered.length - 1 ? 0 : HUB_HOVER_BOX.lineGap)
  ), 0)
  const width = contentWidth + HUB_HOVER_BOX.contentMargin * 2
  const height = contentHeight + HUB_HOVER_BOX.contentMargin * 2
  const margin = HUB_HOVER_BOX.viewportMargin
  let x = sourceCenterX + sourceGap
  if (x + width > HUB_NATIVE_UI_SIZE.width - margin) x = sourceCenterX - sourceGap - width
  x = Math.max(margin, Math.min(HUB_NATIVE_UI_SIZE.width - margin - width, x))
  const y = Math.max(
    margin,
    Math.min(HUB_NATIVE_UI_SIZE.height - margin - height, sourceCenterY - height / 2),
  )

  const info = new Container()
  info.label = 'native-contextual-hover-box'
  info.position.set(x, y)
  info.addChild(new Graphics()
    .rect(0, 0, width, height)
    .fill({ color: 0x000000 })
    .stroke({ color: 0xffffff, width: 1 }))
  let cursorY = HUB_HOVER_BOX.contentMargin
  for (const { font, line, wrapped } of rendered) {
    addBitmapText(
      context,
      info,
      line.text,
      line.font,
      HUB_HOVER_BOX.contentMargin,
      cursorY,
      {
        align: 'left',
        lineHeight: font.metrics[0],
        maxWidth: HUB_HOVER_BOX.contentMaxWidth,
        tint: line.tint,
      },
    )
    cursorY += wrapped.length * font.metrics[0] + HUB_HOVER_BOX.lineGap
  }
  layer.addChild(info)
  return info
}

export function addInventoryItemInfo(
  context: RenderContext,
  layer: Container,
  item: HubInventoryItem,
  sourceCenterX: number,
  sourceCenterY: number,
  options: HubTooltipOptions,
): Container {
  const info = addNativeContextualHoverBox(
    context,
    layer,
    hubItemTooltipLines(item, options),
    sourceCenterX,
    sourceCenterY,
    HUB_HOVER_BOX.shopSourceGap,
  )
  info.label = 'native-inventory-item-info'
  info.visible = false
  return info
}

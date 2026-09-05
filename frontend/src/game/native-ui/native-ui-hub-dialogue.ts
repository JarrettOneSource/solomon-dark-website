import { NATIVE_BOAST_PRESENTATION } from '../core-kernels/native-hub-npc.ts'
import { type NativeUiFragment, type NativeUiRect } from './native-ui-plan.ts'
import { NATIVE_UI_TEXT_ITALIC } from './native-ui-text.ts'

export const HUB_CHAT_PANEL = {
  actionTextTint: 0x8cbf8c,
  contentHeight: 250,
  contentLeft: 561.5,
  contentTop: 111,
  contentWidth: 477,
  doneRect: [730, 370, 140, 45] as const,
  doneTextBaselineY: 396,
  edgeUvOrigin: 0.95,
  height: 420,
  left: 476.5,
  primaryChoiceRect: [590, 195, 420, 43] as const,
  primaryChoiceTextBaselineY: 226,
  secondaryChoiceRect: [690, 235, 220, 32] as const,
  secondaryChoiceTextBaselineY: 256,
  top: 26,
  titleCenterX: 800,
  titleCenterY: 90,
  titleTextBaselineY: 90,
  textTint: 0xd9ba70,
  uiRecord: 11,
  width: 647,
} as const

const selector = NATIVE_BOAST_PRESENTATION
const selectorLeft = HUB_CHAT_PANEL.left + (HUB_CHAT_PANEL.width - selector.outer.width) / 2
const selectorTop = HUB_CHAT_PANEL.top + HUB_CHAT_PANEL.height / 2
  + selector.outer.centerYOffset - selector.outer.height / 2

export const HUB_NPC_SELECTOR = {
  balanceIconCenter: [570, 539] as const,
  balanceTextBaseline: [580, 555] as const,
  bookArtInsetX: 15,
  bookTextInsetX: 100,
  contentBottomInset: 25,
  doneRect: [700, 511, 200, 40] as const,
  doneTextBaselineY: 536,
  emptyTextBaselineY: 306,
  panelRect: [selectorLeft, selectorTop, selector.outer.width, selector.outer.height] as const,
  rowHeight: 85,
  rowInsetX: 15,
  rowInsetY: 25,
  rowPitch: 90,
  rowRecord: 50,
  rowTextTint: 0xd9ba70,
  rowWidth: 490,
  selectedTint: 0x9feb9f,
  spellBackingRecord: 164,
  spellDescriptionLineHeight: 68 / 3,
  spellDescriptionScale: 0.75,
  spellDescriptionWidth: 333,
  spellFrameRecord: 5,
  spellFrameScale: 0.75,
  titleTextBaselineY: 90,
  unaffordableTint: 0xff6680,
  viewportRect: [
    selectorLeft + selector.boxInset.left,
    selectorTop + selector.boxInset.top,
    selector.outer.width - selector.boxInset.widthReduction,
    selector.outer.height - selector.boxInset.heightReduction,
  ] as const,
  wheelStep: 25,
} as const

export interface HubNpcSelectorVisibleRow {
  readonly index: number
  readonly rect: readonly [left: number, top: number, width: number, height: number]
}

export function planNativeUiSelectorGold(gold: number, bounds: NativeUiRect): NativeUiFragment {
  const offsetX = bounds.left - HUB_NPC_SELECTOR.panelRect[0]
  const offsetY = bounds.top - HUB_NPC_SELECTOR.panelRect[1]
  return {
    actions: [],
    nodes: [
      {
        anchor: [0.5, 0.5],
        atlas: 'UI',
        kind: 'sprite',
        label: 'selector:gold-icon',
        record: 21,
        x: HUB_NPC_SELECTOR.balanceIconCenter[0] + offsetX,
        y: HUB_NPC_SELECTOR.balanceIconCenter[1] + offsetY,
      },
      {
        kind: 'text',
        label: 'selector:gold-balance',
        text: {
          align: 'left',
          font: 'body',
          text: `${gold}`,
          tint: 0xffffff,
          x: HUB_NPC_SELECTOR.balanceTextBaseline[0] + offsetX,
          y: HUB_NPC_SELECTOR.balanceTextBaseline[1] + offsetY,
        },
      },
    ],
  }
}

export function hubNpcSelectorContentHeight(rowCount: number): number {
  if (!Number.isSafeInteger(rowCount) || rowCount < 0) {
    throw new RangeError('native selector row count must be a nonnegative safe integer')
  }
  if (rowCount === 0) return 0
  return HUB_NPC_SELECTOR.rowInsetY
    + (rowCount - 1) * HUB_NPC_SELECTOR.rowPitch
    + HUB_NPC_SELECTOR.rowHeight
    + HUB_NPC_SELECTOR.contentBottomInset
}

export function hubNpcSelectorMaximumScroll(rowCount: number): number {
  return Math.max(0, hubNpcSelectorContentHeight(rowCount) - HUB_NPC_SELECTOR.viewportRect[3])
}

export function hubNpcSelectorClampScroll(scroll: number, rowCount: number): number {
  if (!Number.isFinite(scroll)) throw new RangeError('native selector scroll must be finite')
  return Math.max(0, Math.min(hubNpcSelectorMaximumScroll(rowCount), scroll))
}

export function hubNpcSelectorWheelScroll(
  scroll: number,
  deltaY: number,
  rowCount: number,
): number {
  if (!Number.isFinite(deltaY)) throw new RangeError('native selector wheel delta must be finite')
  const direction = deltaY === 0 ? 0 : deltaY > 0 ? 1 : -1
  return hubNpcSelectorClampScroll(
    scroll + direction * HUB_NPC_SELECTOR.wheelStep,
    rowCount,
  )
}

export function hubNpcSelectorDragScroll(
  scroll: number,
  pointerDeltaY: number,
  rowCount: number,
): number {
  if (!Number.isFinite(pointerDeltaY)) {
    throw new RangeError('native selector pointer delta must be finite')
  }
  return hubNpcSelectorClampScroll(scroll - pointerDeltaY, rowCount)
}

export function hubNpcSelectorRowRect(
  index: number,
  scroll: number,
): readonly [left: number, top: number, width: number, height: number] {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError('native selector row index must be a nonnegative safe integer')
  }
  const [viewportLeft, viewportTop] = HUB_NPC_SELECTOR.viewportRect
  return [
    viewportLeft + HUB_NPC_SELECTOR.rowInsetX,
    viewportTop + HUB_NPC_SELECTOR.rowInsetY + index * HUB_NPC_SELECTOR.rowPitch - scroll,
    HUB_NPC_SELECTOR.rowWidth,
    HUB_NPC_SELECTOR.rowHeight,
  ]
}

export function hubNpcSelectorVisibleRows(
  rowCount: number,
  scroll: number,
): readonly HubNpcSelectorVisibleRow[] {
  const boundedScroll = hubNpcSelectorClampScroll(scroll, rowCount)
  const [viewportLeft, viewportTop, viewportWidth, viewportHeight] = HUB_NPC_SELECTOR.viewportRect
  const viewportRight = viewportLeft + viewportWidth
  const viewportBottom = viewportTop + viewportHeight
  const result: HubNpcSelectorVisibleRow[] = []
  for (let index = 0; index < rowCount; index += 1) {
    const [left, top, width, height] = hubNpcSelectorRowRect(index, boundedScroll)
    const clippedLeft = Math.max(left, viewportLeft)
    const clippedTop = Math.max(top, viewportTop)
    const clippedRight = Math.min(left + width, viewportRight)
    const clippedBottom = Math.min(top + height, viewportBottom)
    if (clippedRight <= clippedLeft || clippedBottom <= clippedTop) continue
    result.push({
      index,
      rect: [clippedLeft, clippedTop, clippedRight - clippedLeft, clippedBottom - clippedTop],
    })
  }
  return result
}

export function hubNpcBookTitleHash(title: string): number {
  let value = 1
  for (let index = 0; index < title.length; index += 1) {
    const code = title.charCodeAt(index)
    value = index % 2 === 0 ? value * code : value + code
    if (value > 2_000_000) value = Math.trunc(value / index)
    if (value === 0) value = code
  }
  return value
}

export function hubNpcBookArtRecord(title: string): number {
  return 13 + hubNpcBookTitleHash(title) % 4
}

export function hubNpcBookDisplayTitle(title: string): string {
  return title.toUpperCase()
}

export function hubNpcSelectorPriceTint(price: number, gold: number): number {
  if (!Number.isSafeInteger(price) || price < 0 || !Number.isSafeInteger(gold) || gold < 0) {
    throw new RangeError('native selector price and gold must be nonnegative safe integers')
  }
  return gold >= price
    ? HUB_NPC_SELECTOR.rowTextTint
    : HUB_NPC_SELECTOR.unaffordableTint
}

export const HUB_CHAT_INLINE_EMPHASIS = {
  exactTextCommand: 'i',
  exactTextMarker: '_',
  fontLineHeight: 24,
  ...NATIVE_UI_TEXT_ITALIC,
  italicFactor: 0.125,
  sourceDelimiter: '*',
} as const

export interface HubChatTextRun {
  readonly italic: boolean
  readonly text: string
}

export function hubChatTextRuns(source: string): readonly HubChatTextRun[] {
  const runs: HubChatTextRun[] = []
  let italic = false
  let text = ''
  const flush = (): void => {
    if (!text) return
    runs.push({ italic, text })
    text = ''
  }
  for (const character of source) {
    if (character === HUB_CHAT_INLINE_EMPHASIS.sourceDelimiter) {
      flush()
      italic = !italic
    } else {
      text += character
    }
  }
  flush()
  return runs
}

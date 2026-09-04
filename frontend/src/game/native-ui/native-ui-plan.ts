import {
  nativeUiFont,
  type NativeUiAtlasName,
  type NativeUiFontName,
} from './native-ui-catalog.ts'
import {
  layoutNativeUiText,
  wrapNativeUiMsgBoxText,
  type NativeUiTextSpec,
} from './native-ui-text.ts'

export interface NativeUiRect {
  readonly height: number
  readonly left: number
  readonly top: number
  readonly width: number
}

export interface NativeUiStripPiece {
  readonly sourceLeft: number
  readonly targetLeft: number
  readonly width: number
}

interface NativeUiNodeBase {
  readonly alpha?: number
  readonly label?: string
}

export interface NativeUiClipNode extends NativeUiNodeBase {
  readonly bounds: NativeUiRect
  readonly kind: 'clip'
  readonly nodes: readonly NativeUiNode[]
}

export interface NativeUiSpriteNode extends NativeUiNodeBase {
  readonly anchor?: readonly [x: number, y: number]
  readonly atlas: NativeUiAtlasName
  readonly height?: number
  readonly kind: 'sprite'
  readonly mirrorX?: boolean
  readonly mirrorY?: boolean
  readonly record: number
  readonly rotation?: number
  readonly scale?: number
  readonly tint?: number
  readonly width?: number
  readonly x: number
  readonly y: number
}

export interface NativeUiSliceNode extends NativeUiNodeBase {
  readonly atlas: NativeUiAtlasName
  readonly bounds: NativeUiRect
  readonly kind: 'slice'
  readonly mirrorX?: boolean
  readonly mirrorY?: boolean
  readonly record: number
  readonly sourceUv: readonly [left: number, top: number, right: number, bottom: number]
  readonly tint?: number
}

export interface NativeUiTileNode extends NativeUiNodeBase {
  readonly atlas: NativeUiAtlasName
  readonly bounds: NativeUiRect
  readonly kind: 'tile'
  readonly record: number
  readonly scale?: number
  readonly tint?: number
}

export interface NativeUiNineSliceNode extends NativeUiNodeBase {
  readonly atlas: NativeUiAtlasName
  readonly bounds: NativeUiRect
  readonly edgeUvOrigin: number
  readonly kind: 'nine-slice'
  readonly record: number
  readonly tint?: number
}

export interface NativeUiSolidNode extends NativeUiNodeBase {
  readonly bounds: NativeUiRect
  readonly color: number
  readonly kind: 'solid'
}

export interface NativeUiTextNode extends NativeUiNodeBase {
  readonly kind: 'text'
  readonly text: NativeUiTextSpec
}

export type NativeUiNode =
  | NativeUiClipNode
  | NativeUiNineSliceNode
  | NativeUiSliceNode
  | NativeUiSolidNode
  | NativeUiSpriteNode
  | NativeUiTextNode
  | NativeUiTileNode

export interface NativeUiActionRegion {
  readonly bounds: NativeUiRect
  readonly disabled: boolean
  readonly id: string
  readonly role: 'button' | 'tab'
}

export interface NativeUiFragment {
  readonly actions: readonly NativeUiActionRegion[]
  readonly nodes: readonly NativeUiNode[]
}

export interface NativeUiPlan extends NativeUiFragment {
  readonly height: number
  readonly opacity?: number
  readonly width: number
}

export type NativeUiButtonState = 'disabled' | 'focused' | 'idle' | 'pressed' | 'selected'

export interface NativeUiButtonChromeSpec {
  /** Body rectangle at the requested scale; the surround extends outside it. */
  readonly bounds: NativeUiRect
  readonly id: string
  /** Uniform scale of the stock chrome and label. Defaults to 1. */
  readonly scale?: number
  readonly state?: NativeUiButtonState
}

export interface NativeUiButtonSpec extends NativeUiButtonChromeSpec {
  readonly label: string
}

export interface NativeUiStoneButtonSpec extends NativeUiButtonChromeSpec {
  readonly label: string
}

export interface NativeUiTabSpec {
  readonly bounds: NativeUiRect
  readonly disabled?: boolean
  readonly id: string
  readonly label: string
  readonly labelBaselineY?: number
}

export interface NativeUiTabsSpec {
  readonly height: number
  readonly selectedId: string
  readonly tabs: readonly NativeUiTabSpec[]
  readonly width: number
}

export interface NativeUiMessageAction {
  readonly bounds?: NativeUiRect
  readonly id: string
  readonly label: string
  readonly state?: NativeUiButtonState
}

export interface NativeUiMessageDataLineSpec {
  readonly font: NativeUiFontName
  readonly gapAfter?: number
  readonly text: string
  readonly tint?: number
}

export interface NativeUiMessageDataLineLayout {
  readonly baselineY: number
  readonly font: NativeUiFontName
  readonly gapAfter: number
  readonly height: number
  readonly lineHeight: number
  readonly text: string
  readonly tint: number
  readonly width: number
  readonly x: number
}

export interface NativeUiSingleActionMessageLayoutSpec {
  readonly anchorX: number
  readonly anchorY: number
  readonly height: number
  readonly lines: readonly NativeUiMessageDataLineSpec[]
  readonly width: number
}

export interface NativeUiSingleActionMessageLayout {
  readonly actionBounds: NativeUiRect
  readonly actionTextBaselineY: number
  readonly frameBounds: NativeUiRect
  readonly lines: readonly NativeUiMessageDataLineLayout[]
  readonly panelBounds: NativeUiRect
}

export interface NativeUiMessageFrameSpec {
  readonly body?: string
  readonly bounds: NativeUiRect
  readonly dimAlpha?: number
  readonly height: number
  readonly lines?: readonly NativeUiMessageDataLineLayout[]
  readonly title?: string
  readonly width: number
}

export interface NativeUiMessageSpec extends NativeUiMessageFrameSpec {
  readonly actions: readonly NativeUiMessageAction[]
}

export interface NativeUiSimpleMenuRow {
  readonly id: string
  readonly label: string
  readonly state?: NativeUiButtonState
}

export interface NativeUiSimpleMenuSpec {
  readonly centerX?: number
  readonly dimAlpha?: number
  readonly firstRowTop?: number
  readonly height: number
  readonly reveal?: number
  readonly rowGap?: number
  readonly rows: readonly NativeUiSimpleMenuRow[]
  readonly width: number
}

export const NATIVE_UI_BUTTON = Object.freeze({
  disabledAlpha: 0.5,
  idleRecord: 101,
  labelYOffset: 9,
  minWidth: 140,
  pressedOffset: 6,
  pressedRecord: 102,
  surround: 6,
  surroundEndRecord: 54,
  surroundEdgeUvOrigin: 0.95,
  textTint: 0xd9ba70,
})

export const NATIVE_UI_STONE_BUTTON = Object.freeze({
  idleRecord: 105,
  labelScale: 1.15,
  labelYOffset: 4,
  pressedRecord: 106,
  sourceHeight: 41,
  sourceWidth: 141,
  textTint: 0xf2f0dc,
})

export const NATIVE_UI_TAB = Object.freeze({
  bracketRecord: 13,
  bracketWidth: 34,
  plateUvOrigin: 0.95,
  restingBottomTrim: 6,
  restingHeight: 51,
  restingTopTrim: 8,
  selectedHeight: 65,
  selectedRise: 8,
})

export const NATIVE_UI_MESSAGE = Object.freeze({
  actionFooterHeight: 100,
  actionHeight: 69,
  actionLabelBaselineOffset: 42.5,
  actionPanelBottomOffset: 60,
  actionWidth: 196,
  arrowRecord: 8,
  backgroundRecord: 49,
  bodyBaselineOffset: 130.5,
  bodyLineHeight: 17,
  cornerRecords: [107, 108, 109, 110] as const,
  edgeInsetX: 71.5,
  edgeInsetY: 76.5,
  headerRecord: 18,
  horizontalEdgeRecord: 10,
  innerEdgeUvOrigin: 0.95,
  innerFrameRecord: 17,
  panelPadding: 25,
  panelToFrameX: 49,
  panelToFrameY: 50,
  storedLineAdvance: 1,
  textPanelInsetX: 25,
  textPanelInsetY: 20,
  textInsetX: 76,
  titleBaselineOffset: 95,
  verticalEdgeRecord: 79,
  wrapWidth: 400,
})

export function layoutNativeUiSingleActionMessage(
  spec: NativeUiSingleActionMessageLayoutSpec,
): NativeUiSingleActionMessageLayout {
  nativeUiRect(0, 0, spec.width, spec.height)
  if (spec.lines.length === 0) throw new RangeError('native UI MsgBox requires at least one DataLine')
  if (![spec.anchorX, spec.anchorY].every(Number.isFinite)) {
    throw new RangeError('native UI MsgBox anchor must be finite')
  }

  const prepared = spec.lines.map((line) => {
    const gapAfter = line.gapAfter ?? 0
    if (!Number.isFinite(gapAfter) || gapAfter < 0) {
      throw new RangeError('native UI MsgBox DataLine gap must be finite and nonnegative')
    }
    const font = nativeUiFont(line.font)
    const text = wrapNativeUiMsgBoxText(
      line.text,
      line.font,
      NATIVE_UI_MESSAGE.wrapWidth,
    ).join('\n')
    const layout = layoutNativeUiText({
      font: line.font,
      lineHeight: font.metrics[0] + NATIVE_UI_MESSAGE.storedLineAdvance,
      text,
      x: 0,
      y: 0,
    })
    return { font, gapAfter, layout, source: line, text }
  })
  const contentWidth = Math.max(...prepared.map(({ layout }) => layout.width))
  const contentHeight = prepared.reduce(
    (height, { gapAfter, layout }) => height + layout.height + gapAfter,
    0,
  )
  const panelWidth = contentWidth + NATIVE_UI_MESSAGE.panelPadding * 2
  const panelHeight = contentHeight
    + NATIVE_UI_MESSAGE.panelPadding * 2
    + NATIVE_UI_MESSAGE.actionFooterHeight
  const panelBounds = nativeUiRect(
    spec.anchorX - panelWidth / 2,
    spec.anchorY - panelHeight / 2,
    panelWidth,
    panelHeight,
  )
  const frameBounds = nativeUiRect(
    panelBounds.left - NATIVE_UI_MESSAGE.panelToFrameX,
    panelBounds.top - NATIVE_UI_MESSAGE.panelToFrameY,
    panelBounds.width + NATIVE_UI_MESSAGE.panelToFrameX * 2,
    panelBounds.height + NATIVE_UI_MESSAGE.panelToFrameY * 2,
  )
  const textX = panelBounds.left + NATIVE_UI_MESSAGE.textPanelInsetX
  let baselineY = panelBounds.top
    + NATIVE_UI_MESSAGE.textPanelInsetY
    + prepared[0]!.font.metrics[0]
  const lines = prepared.map(({ font, gapAfter, layout, source, text }) => {
    const line: NativeUiMessageDataLineLayout = {
      baselineY,
      font: source.font,
      gapAfter,
      height: layout.height,
      lineHeight: font.metrics[0] + NATIVE_UI_MESSAGE.storedLineAdvance,
      text,
      tint: source.tint ?? 0xffffff,
      width: layout.width,
      x: textX,
    }
    baselineY += layout.height + gapAfter + NATIVE_UI_MESSAGE.storedLineAdvance
    return Object.freeze(line)
  })
  const actionBounds = nativeUiRect(
    panelBounds.left + panelBounds.width / 2 - NATIVE_UI_MESSAGE.actionWidth / 2,
    panelBounds.top + panelBounds.height
      - NATIVE_UI_MESSAGE.actionPanelBottomOffset
      - NATIVE_UI_MESSAGE.actionHeight / 2,
    NATIVE_UI_MESSAGE.actionWidth,
    NATIVE_UI_MESSAGE.actionHeight,
  )
  return Object.freeze({
    actionBounds,
    actionTextBaselineY: actionBounds.top + NATIVE_UI_MESSAGE.actionLabelBaselineOffset,
    frameBounds,
    lines: Object.freeze(lines),
    panelBounds,
  })
}

export const NATIVE_UI_SIMPLE_MENU = Object.freeze({
  arrowRecord: 8,
  chromeMotion: 25,
  chromePadding: 40,
  dimAlpha: 0.85,
  frameEdgeUvOrigin: 0.95,
  frameRecord: 17,
  headerOffset: 42,
  headerRecord: 18,
  largeArrowOffset: 55,
  rowGap: 7,
  rowHeight: 69,
  rowWidth: 353,
  sideArrowOffset: 42,
  sideArrowScale: 0.75,
  sideArrowSpacing: 75,
})

export function nativeUiRect(
  left: number,
  top: number,
  width: number,
  height: number,
): NativeUiRect {
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new RangeError('native UI rectangle must be finite with positive size')
  }
  return { height, left, top, width }
}

export function intersectNativeUiRects(
  left: NativeUiRect,
  right: NativeUiRect,
): NativeUiRect | null {
  const intersectionLeft = Math.max(left.left, right.left)
  const intersectionTop = Math.max(left.top, right.top)
  const intersectionRight = Math.min(left.left + left.width, right.left + right.width)
  const intersectionBottom = Math.min(left.top + left.height, right.top + right.height)
  return intersectionRight <= intersectionLeft || intersectionBottom <= intersectionTop
    ? null
    : nativeUiRect(
        intersectionLeft,
        intersectionTop,
        intersectionRight - intersectionLeft,
        intersectionBottom - intersectionTop,
      )
}

/** Exact horizontal thirds emitted by stock repeated-strip helper `0x00415230`. */
export function nativeUiStripPieces(
  sourceWidth: number,
  targetWidth: number,
): readonly NativeUiStripPiece[] {
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0) {
    throw new RangeError('native UI strip source width must be positive and finite')
  }
  if (!Number.isFinite(targetWidth) || targetWidth < 0) {
    throw new RangeError('native UI strip target width must be nonnegative and finite')
  }
  if (targetWidth === 0) return Object.freeze([])

  const third = sourceWidth / 3
  const pieces: NativeUiStripPiece[] = [
    { sourceLeft: 0, targetLeft: 0, width: third },
  ]
  let remaining = targetWidth - 2 * third
  let targetLeft = third
  while (remaining > 1e-9) {
    const width = Math.min(third, remaining)
    pieces.push({ sourceLeft: third, targetLeft, width })
    targetLeft += width
    remaining -= width
  }
  pieces.push({
    sourceLeft: 2 * third,
    targetLeft: targetWidth - third,
    width: third,
  })
  return Object.freeze(pieces.map((piece) => Object.freeze(piece)))
}

export function nativeUiPlan(
  width: number,
  height: number,
  ...fragments: readonly NativeUiFragment[]
): NativeUiPlan {
  nativeUiRect(0, 0, width, height)
  return {
    actions: fragments.flatMap(({ actions }) => actions),
    height,
    nodes: fragments.flatMap(({ nodes }) => nodes),
    width,
  }
}

function nativeUiButtonScale(scale: number | undefined): number {
  if (scale === undefined) return 1
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError('native UI button scale must be a positive finite number')
  }
  return scale
}

export function planNativeUiButtonChrome(spec: NativeUiButtonChromeSpec): NativeUiFragment {
  const state = spec.state ?? 'idle'
  const disabled = state === 'disabled'
  const pressed = state === 'pressed' || state === 'selected'
  const scale = nativeUiButtonScale(spec.scale)
  if (spec.bounds.width / scale < NATIVE_UI_BUTTON.minWidth) {
    throw new RangeError(`native UI button width must be at least ${NATIVE_UI_BUTTON.minWidth}`)
  }
  const { left, top, width, height } = spec.bounds
  const surround = NATIVE_UI_BUTTON.surround * scale
  const surroundLeft = left - surround
  const surroundTop = top - surround
  const surroundRight = left + width + surround
  const endWidth = 70 * scale
  const endHeight = 85 * scale
  const endSize = scale === 1 ? {} : { height: endHeight, width: endWidth }
  const connectorWidth = Math.max(0, surroundRight - surroundLeft - endWidth * 2)
  const alpha = disabled ? NATIVE_UI_BUTTON.disabledAlpha : 1
  const nodes: NativeUiNode[] = [
    {
      alpha,
      atlas: 'UI',
      height,
      kind: 'sprite',
      label: `${spec.id}:body`,
      record: pressed ? NATIVE_UI_BUTTON.pressedRecord : NATIVE_UI_BUTTON.idleRecord,
      width,
      x: left,
      y: top,
    },
    {
      alpha,
      atlas: 'UI',
      kind: 'sprite',
      label: `${spec.id}:end-left`,
      record: NATIVE_UI_BUTTON.surroundEndRecord,
      x: surroundLeft,
      y: surroundTop,
      ...endSize,
    },
    {
      alpha,
      atlas: 'UI',
      bounds: nativeUiRect(surroundLeft + endWidth, surroundTop, connectorWidth, endHeight),
      kind: 'slice',
      label: `${spec.id}:edge`,
      record: NATIVE_UI_BUTTON.surroundEndRecord,
      sourceUv: [NATIVE_UI_BUTTON.surroundEdgeUvOrigin, 0, 1, 1],
    },
    {
      alpha,
      atlas: 'UI',
      kind: 'sprite',
      label: `${spec.id}:end-right`,
      mirrorX: true,
      record: NATIVE_UI_BUTTON.surroundEndRecord,
      x: surroundRight,
      y: surroundTop,
      ...endSize,
    },
  ]
  return { actions: [], nodes }
}

export function planNativeUiButton(spec: NativeUiButtonSpec): NativeUiFragment {
  const state = spec.state ?? 'idle'
  const disabled = state === 'disabled'
  const pressed = state === 'pressed' || state === 'selected'
  const alpha = disabled ? NATIVE_UI_BUTTON.disabledAlpha : 1
  const scale = nativeUiButtonScale(spec.scale)
  const labelOffset = pressed ? NATIVE_UI_BUTTON.pressedOffset * scale : 0
  const chrome = planNativeUiButtonChrome(spec)
  const nodes: NativeUiNode[] = [
    ...chrome.nodes,
    {
      kind: 'text',
      label: `${spec.id}:label`,
      text: {
        alpha,
        font: 'menu',
        text: spec.label,
        tint: NATIVE_UI_BUTTON.textTint,
        x: spec.bounds.left + spec.bounds.width / 2 + labelOffset,
        y: spec.bounds.top + spec.bounds.height / 2
          + NATIVE_UI_BUTTON.labelYOffset * scale + labelOffset,
        ...(scale === 1 ? {} : { scale }),
      },
    },
  ]
  if (disabled) {
    nodes.push({
      alpha: 0.25,
      bounds: spec.bounds,
      color: 0x808080,
      kind: 'solid',
      label: `${spec.id}:disabled-overlay`,
    })
  }
  return {
    actions: [{ bounds: spec.bounds, disabled, id: spec.id, role: 'button' }],
    nodes,
  }
}

export function planNativeUiStoneButton(spec: NativeUiStoneButtonSpec): NativeUiFragment {
  const state = spec.state ?? 'idle'
  const disabled = state === 'disabled'
  const pressed = state === 'pressed' || state === 'selected'
  const alpha = disabled ? NATIVE_UI_BUTTON.disabledAlpha : 1
  const labelOffset = pressed ? 1 : 0
  const nodes: NativeUiNode[] = [
    {
      alpha,
      atlas: 'UI',
      height: spec.bounds.height,
      kind: 'sprite',
      label: `${spec.id}:body`,
      record: pressed
        ? NATIVE_UI_STONE_BUTTON.pressedRecord
        : NATIVE_UI_STONE_BUTTON.idleRecord,
      width: spec.bounds.width,
      x: spec.bounds.left,
      y: spec.bounds.top,
    },
    {
      kind: 'text',
      label: `${spec.id}:label`,
      text: {
        alpha,
        font: 'control-panel',
        scale: NATIVE_UI_STONE_BUTTON.labelScale,
        text: spec.label,
        tint: NATIVE_UI_STONE_BUTTON.textTint,
        x: spec.bounds.left + spec.bounds.width / 2 + labelOffset,
        y: spec.bounds.top + spec.bounds.height / 2
          + NATIVE_UI_STONE_BUTTON.labelYOffset + labelOffset,
      },
    },
  ]
  if (disabled) {
    nodes.push({
      alpha: 0.25,
      bounds: spec.bounds,
      color: 0x202020,
      kind: 'solid',
      label: `${spec.id}:disabled-overlay`,
    })
  }
  return {
    actions: [{ bounds: spec.bounds, disabled, id: spec.id, role: 'button' }],
    nodes,
  }
}

export function planNativeUiTabs(spec: NativeUiTabsSpec): NativeUiPlan {
  if (!spec.tabs.some(({ id }) => id === spec.selectedId)) {
    throw new RangeError(`native UI selected tab ${spec.selectedId} is absent`)
  }
  const fragments = spec.tabs.map((tab): NativeUiFragment => {
    const selected = tab.id === spec.selectedId
    const top = tab.bounds.top + (selected ? 0 : NATIVE_UI_TAB.restingTopTrim)
    const bracketHeight = selected ? NATIVE_UI_TAB.selectedHeight : NATIVE_UI_TAB.restingHeight
    const rightX = tab.bounds.left + tab.bounds.width - NATIVE_UI_TAB.bracketWidth
    const sourceUv = selected
      ? [0, 0, 1, 1] as const
      : [
          0,
          NATIVE_UI_TAB.restingTopTrim / NATIVE_UI_TAB.selectedHeight,
          1,
          1 - NATIVE_UI_TAB.restingBottomTrim / NATIVE_UI_TAB.selectedHeight,
        ] as const
    const labelBaselineY = (tab.labelBaselineY ?? tab.bounds.top + 44)
      - (selected ? NATIVE_UI_TAB.selectedRise : 0)
    const plateWidth = tab.bounds.width - NATIVE_UI_TAB.bracketWidth * 2
    // UI.13 carries the tab's dark plate and gold top edge along with the bracket.
    // Retail stretches its last column across the middle, the way the button
    // stretches UI.54, so the plate reaches from bracket to bracket.
    const plate: NativeUiNode[] = plateWidth > 0
      ? [{
          alpha: tab.disabled ? NATIVE_UI_BUTTON.disabledAlpha : 1,
          atlas: 'UI',
          bounds: nativeUiRect(
            tab.bounds.left + NATIVE_UI_TAB.bracketWidth,
            top,
            plateWidth,
            bracketHeight,
          ),
          kind: 'slice',
          label: `${tab.id}:plate`,
          record: NATIVE_UI_TAB.bracketRecord,
          sourceUv: [NATIVE_UI_TAB.plateUvOrigin, sourceUv[1], 1, sourceUv[3]],
        }]
      : []
    return {
      actions: [{ bounds: tab.bounds, disabled: tab.disabled ?? false, id: tab.id, role: 'tab' }],
      nodes: [
        ...plate,
        {
          alpha: tab.disabled ? NATIVE_UI_BUTTON.disabledAlpha : 1,
          atlas: 'UI',
          bounds: nativeUiRect(tab.bounds.left, top, NATIVE_UI_TAB.bracketWidth, bracketHeight),
          kind: 'slice',
          label: `${tab.id}:bracket-left`,
          record: NATIVE_UI_TAB.bracketRecord,
          sourceUv,
        },
        {
          alpha: tab.disabled ? NATIVE_UI_BUTTON.disabledAlpha : 1,
          atlas: 'UI',
          bounds: nativeUiRect(rightX, top, NATIVE_UI_TAB.bracketWidth, bracketHeight),
          kind: 'slice',
          label: `${tab.id}:bracket-right`,
          mirrorX: true,
          record: NATIVE_UI_TAB.bracketRecord,
          sourceUv,
        },
        {
          kind: 'text',
          label: `${tab.id}:label`,
          text: {
            alpha: tab.disabled ? NATIVE_UI_BUTTON.disabledAlpha : 1,
            font: 'menu',
            text: tab.label,
            tint: selected ? 0xffffff : 0xaaa2a6,
            x: tab.bounds.left + tab.bounds.width / 2,
            y: labelBaselineY,
          },
        },
      ],
    }
  })
  return nativeUiPlan(spec.width, spec.height, ...fragments)
}

export function planNativeUiMessageFrame(spec: NativeUiMessageFrameSpec): NativeUiPlan {
  const hasDataLines = spec.lines !== undefined
  const hasLegacyContent = spec.title !== undefined || spec.body !== undefined
  if (hasDataLines === hasLegacyContent) {
    throw new TypeError('native UI message frame requires DataLines or title/body content')
  }
  if (!hasDataLines && (spec.title === undefined || spec.body === undefined)) {
    throw new TypeError('native UI message title and body must be supplied together')
  }
  const { bounds } = spec
  const centerX = bounds.left + bounds.width / 2
  const inner = nativeUiRect(bounds.left + 5, bounds.top + 5, bounds.width - 10, bounds.height - 10)
  const horizontalWidth = bounds.width - NATIVE_UI_MESSAGE.edgeInsetX * 2
  const verticalHeight = bounds.height - NATIVE_UI_MESSAGE.edgeInsetY * 2
  const cornerCenters = [
    [bounds.left + 29, bounds.top + 32],
    [bounds.left + bounds.width - 29, bounds.top + 32],
    [bounds.left + 29, bounds.top + bounds.height - 32],
    [bounds.left + bounds.width - 29, bounds.top + bounds.height - 32],
  ] as const
  const nodes: NativeUiNode[] = []
  if ((spec.dimAlpha ?? 0.75) > 0) {
    nodes.push({
      alpha: spec.dimAlpha ?? 0.75,
      bounds: nativeUiRect(0, 0, spec.width, spec.height),
      color: 0x000000,
      kind: 'solid',
      label: 'message:curtain',
    })
  }
  nodes.push(
    {
      atlas: 'UI',
      bounds,
      kind: 'tile',
      label: 'message:background',
      record: NATIVE_UI_MESSAGE.backgroundRecord,
    },
    {
      atlas: 'UI',
      bounds: nativeUiRect(bounds.left + NATIVE_UI_MESSAGE.edgeInsetX, bounds.top - 6.5, horizontalWidth, 19),
      kind: 'tile',
      label: 'message:edge-top',
      record: NATIVE_UI_MESSAGE.horizontalEdgeRecord,
    },
    {
      atlas: 'UI',
      bounds: nativeUiRect(bounds.left + NATIVE_UI_MESSAGE.edgeInsetX, bounds.top + bounds.height - 12.5, horizontalWidth, 19),
      kind: 'tile',
      label: 'message:edge-bottom',
      record: NATIVE_UI_MESSAGE.horizontalEdgeRecord,
    },
    {
      atlas: 'UI',
      bounds: nativeUiRect(bounds.left - 6.5, bounds.top + NATIVE_UI_MESSAGE.edgeInsetY, 21, verticalHeight),
      kind: 'tile',
      label: 'message:edge-left',
      record: NATIVE_UI_MESSAGE.verticalEdgeRecord,
    },
    {
      atlas: 'UI',
      bounds: nativeUiRect(bounds.left + bounds.width - 14.5, bounds.top + NATIVE_UI_MESSAGE.edgeInsetY, 21, verticalHeight),
      kind: 'tile',
      label: 'message:edge-right',
      record: NATIVE_UI_MESSAGE.verticalEdgeRecord,
    },
  )
  for (let index = 0; index < cornerCenters.length; index += 1) {
    const [x, y] = cornerCenters[index]!
    nodes.push({
      anchor: [0.5, 0.5],
      atlas: 'UI',
      kind: 'sprite',
      label: `message:corner-${index}`,
      record: NATIVE_UI_MESSAGE.cornerRecords[index]!,
      x,
      y,
    })
  }
  nodes.push(
    {
      atlas: 'UI',
      bounds: inner,
      edgeUvOrigin: NATIVE_UI_MESSAGE.innerEdgeUvOrigin,
      kind: 'nine-slice',
      label: 'message:inner-frame',
      record: NATIVE_UI_MESSAGE.innerFrameRecord,
    },
    {
      anchor: [0.5, 0.5],
      atlas: 'UI',
      kind: 'sprite',
      label: 'message:header',
      record: NATIVE_UI_MESSAGE.headerRecord,
      rotation: Math.PI / 2,
      x: centerX,
      y: bounds.top - 37,
    },
  )
  if (spec.lines) {
    nodes.push(...spec.lines.map((line, index): NativeUiTextNode => ({
      kind: 'text',
      label: `message:line-${index}`,
      text: {
        align: 'left',
        font: line.font,
        lineHeight: line.lineHeight,
        text: line.text,
        tint: line.tint,
        x: line.x,
        y: line.baselineY,
      },
    })))
  } else {
    nodes.push(
      {
        kind: 'text',
        label: 'message:title',
        text: {
          align: 'left',
          font: 'menu',
          maxWidth: NATIVE_UI_MESSAGE.wrapWidth,
          text: spec.title!,
          tint: 0xffffff,
          x: bounds.left + NATIVE_UI_MESSAGE.textInsetX,
          y: bounds.top + NATIVE_UI_MESSAGE.titleBaselineOffset,
        },
      },
      {
        kind: 'text',
        label: 'message:body',
        text: {
          align: 'left',
          font: 'medium',
          lineHeight: NATIVE_UI_MESSAGE.bodyLineHeight,
          maxWidth: NATIVE_UI_MESSAGE.wrapWidth,
          text: spec.body!,
          tint: 0xffffff,
          x: bounds.left + NATIVE_UI_MESSAGE.textInsetX,
          y: bounds.top + NATIVE_UI_MESSAGE.bodyBaselineOffset,
        },
      },
    )
  }
  for (const [x, y, scale] of [
    [centerX, bounds.top + bounds.height + 50, 1],
    [centerX - 75, bounds.top + bounds.height + 37, 0.75],
    [centerX + 75, bounds.top + bounds.height + 37, 0.75],
  ] as const) {
    nodes.push({ anchor: [0.5, 0.5], atlas: 'UI', kind: 'sprite', record: 8, scale, x, y })
  }

  return nativeUiPlan(spec.width, spec.height, { actions: [], nodes })
}

export interface NativeUiMessageActionLayout {
  /** Horizontal gap between two actions. Defaults to the stock 8. */
  readonly gap?: number
  /** Top edge of the action row. Defaults to 92 above the frame bottom. */
  readonly top?: number
}

export function nativeUiMessageActionBounds(
  bounds: NativeUiRect,
  actionCount: 1 | 2,
  layout: NativeUiMessageActionLayout = {},
): readonly NativeUiRect[] {
  const actionGap = layout.gap ?? 8
  const availableWidth = bounds.width - 80
  const actionWidth = actionCount === 1
    ? Math.min(353, availableWidth)
    : Math.min(260, (availableWidth - actionGap) / 2)
  const actionsWidth = actionWidth * actionCount + actionGap * (actionCount - 1)
  const centerX = bounds.left + bounds.width / 2
  const actionTop = layout.top ?? bounds.top + bounds.height - 92
  return Object.freeze(Array.from({ length: actionCount }, (_, index) => nativeUiRect(
    centerX - actionsWidth / 2 + index * (actionWidth + actionGap),
    actionTop,
    actionWidth,
    69,
  )))
}

export function planNativeUiMessage(spec: NativeUiMessageSpec): NativeUiPlan {
  if (spec.actions.length < 1 || spec.actions.length > 2) {
    throw new RangeError('native UI message requires one or two actions')
  }

  const suppliedActionBounds = spec.actions.filter(({ bounds: actionBounds }) => actionBounds !== undefined).length
  if (suppliedActionBounds !== 0 && suppliedActionBounds !== spec.actions.length) {
    throw new RangeError('native UI message action bounds must be supplied for every action or none')
  }
  const defaultBounds = nativeUiMessageActionBounds(spec.bounds, spec.actions.length as 1 | 2)
  const actionFragments = spec.actions.map((action, index) => planNativeUiButton({
    bounds: action.bounds ?? defaultBounds[index]!,
    id: action.id,
    label: action.label,
    state: action.state,
  }))
  return nativeUiPlan(
    spec.width,
    spec.height,
    planNativeUiMessageFrame(spec),
    ...actionFragments,
  )
}

export function planNativeUiSimpleMenu(spec: NativeUiSimpleMenuSpec): NativeUiPlan {
  if (spec.rows.length === 0) throw new RangeError('native UI SimpleMenu requires at least one row')
  const reveal = spec.reveal ?? 1
  if (!Number.isFinite(reveal) || reveal < 0 || reveal > 1) {
    throw new RangeError('native UI SimpleMenu reveal must be between zero and one')
  }
  const centerX = spec.centerX ?? spec.width / 2
  const rowGap = spec.rowGap ?? NATIVE_UI_SIMPLE_MENU.rowGap
  const rowStackHeight = spec.rows.length * NATIVE_UI_SIMPLE_MENU.rowHeight
    + (spec.rows.length - 1) * rowGap
  const firstTop = spec.firstRowTop ?? (spec.height - rowStackHeight) / 2
  const rowFragments = spec.rows.map((row, index) => planNativeUiButton({
    bounds: nativeUiRect(
      centerX - NATIVE_UI_SIMPLE_MENU.rowWidth / 2,
      firstTop + index * (NATIVE_UI_SIMPLE_MENU.rowHeight + rowGap),
      NATIVE_UI_SIMPLE_MENU.rowWidth,
      NATIVE_UI_SIMPLE_MENU.rowHeight,
    ),
    id: row.id,
    label: row.label,
    state: row.state,
  }))
  const spread = Math.fround(
    (1 - reveal) * NATIVE_UI_SIMPLE_MENU.chromeMotion
      + NATIVE_UI_SIMPLE_MENU.chromePadding,
  )
  const top = firstTop - spread
  const height = rowStackHeight + spread * 2
  const bottom = top + height
  const curtain: NativeUiFragment = {
    actions: [],
    nodes: [{
      alpha: spec.dimAlpha ?? NATIVE_UI_SIMPLE_MENU.dimAlpha,
      bounds: nativeUiRect(0, 0, spec.width, spec.height),
      color: 0x000000,
      kind: 'solid',
      label: 'simple-menu:curtain',
    }],
  }
  const chrome: NativeUiFragment = {
    actions: [],
    nodes: [
      {
        atlas: 'UI',
        bounds: nativeUiRect(
          centerX - NATIVE_UI_SIMPLE_MENU.rowWidth / 2 - spread,
          top,
          NATIVE_UI_SIMPLE_MENU.rowWidth + spread * 2,
          height,
        ),
        edgeUvOrigin: NATIVE_UI_SIMPLE_MENU.frameEdgeUvOrigin,
        kind: 'nine-slice',
        label: 'simple-menu:frame',
        record: NATIVE_UI_SIMPLE_MENU.frameRecord,
      },
      {
        anchor: [0.5, 0.5],
        atlas: 'UI',
        kind: 'sprite',
        label: 'simple-menu:header',
        record: NATIVE_UI_SIMPLE_MENU.headerRecord,
        rotation: Math.PI / 2,
        x: centerX,
        y: top - NATIVE_UI_SIMPLE_MENU.headerOffset,
      },
      {
        anchor: [0.5, 0.5],
        atlas: 'UI',
        kind: 'sprite',
        label: 'simple-menu:arrow-center',
        record: NATIVE_UI_SIMPLE_MENU.arrowRecord,
        x: centerX,
        y: bottom + NATIVE_UI_SIMPLE_MENU.largeArrowOffset,
      },
      ...[-1, 1].map((side): NativeUiSpriteNode => ({
        anchor: [0.5, 0.5],
        atlas: 'UI',
        kind: 'sprite',
        label: `simple-menu:arrow-${side < 0 ? 'left' : 'right'}`,
        record: NATIVE_UI_SIMPLE_MENU.arrowRecord,
        scale: NATIVE_UI_SIMPLE_MENU.sideArrowScale,
        x: centerX + side * NATIVE_UI_SIMPLE_MENU.sideArrowSpacing,
        y: bottom + NATIVE_UI_SIMPLE_MENU.sideArrowOffset,
      })),
    ],
  }
  return {
    ...nativeUiPlan(spec.width, spec.height, curtain, ...rowFragments, chrome),
    opacity: reveal,
  }
}

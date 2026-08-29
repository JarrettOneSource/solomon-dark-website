import type { NativeUiAtlasName } from './native-ui-catalog.ts'
import type { NativeUiTextSpec } from './native-ui-text.ts'

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
  readonly width: number
}

export type NativeUiButtonState = 'disabled' | 'focused' | 'idle' | 'pressed' | 'selected'

export interface NativeUiButtonSpec {
  readonly bounds: NativeUiRect
  readonly id: string
  readonly label: string
  readonly state?: NativeUiButtonState
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

export interface NativeUiMessageSpec {
  readonly actions: readonly NativeUiMessageAction[]
  readonly body: string
  readonly bounds: NativeUiRect
  readonly dimAlpha?: number
  readonly height: number
  readonly title: string
  readonly width: number
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
  readonly rowGap?: number
  readonly rows: readonly NativeUiSimpleMenuRow[]
  readonly width: number
}

export const NATIVE_UI_BUTTON = Object.freeze({
  disabledAlpha: 0.5,
  idleRecord: 101,
  labelYOffset: 9,
  minWidth: 140,
  pressedRecord: 102,
  surround: 6,
  surroundEndRecord: 54,
  surroundEdgeUvOrigin: 0.95,
  textTint: 0xd9ba70,
})

export const NATIVE_UI_TAB = Object.freeze({
  bracketRecord: 13,
  bracketWidth: 34,
  restingBottomTrim: 6,
  restingHeight: 51,
  restingTopTrim: 8,
  selectedHeight: 65,
  selectedRise: 8,
})

export const NATIVE_UI_MESSAGE = Object.freeze({
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
  textInsetX: 76,
  titleBaselineOffset: 95,
  verticalEdgeRecord: 79,
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

export function planNativeUiButton(spec: NativeUiButtonSpec): NativeUiFragment {
  const state = spec.state ?? 'idle'
  const disabled = state === 'disabled'
  const selected = state === 'focused' || state === 'pressed' || state === 'selected'
  if (spec.bounds.width < NATIVE_UI_BUTTON.minWidth) {
    throw new RangeError(`native UI button width must be at least ${NATIVE_UI_BUTTON.minWidth}`)
  }
  const { left, top, width, height } = spec.bounds
  const surroundLeft = left - NATIVE_UI_BUTTON.surround
  const surroundTop = top - NATIVE_UI_BUTTON.surround
  const surroundRight = left + width + NATIVE_UI_BUTTON.surround
  const endWidth = 70
  const endHeight = 85
  const connectorWidth = Math.max(0, surroundRight - surroundLeft - endWidth * 2)
  const alpha = disabled ? NATIVE_UI_BUTTON.disabledAlpha : 1
  const nodes: NativeUiNode[] = [
    {
      alpha,
      atlas: 'UI',
      height,
      kind: 'sprite',
      label: `${spec.id}:body`,
      record: selected ? NATIVE_UI_BUTTON.pressedRecord : NATIVE_UI_BUTTON.idleRecord,
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
    },
    {
      kind: 'text',
      label: `${spec.id}:label`,
      text: {
        alpha,
        font: 'menu',
        text: spec.label,
        tint: NATIVE_UI_BUTTON.textTint,
        x: left + width / 2,
        y: top + height / 2 + NATIVE_UI_BUTTON.labelYOffset,
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
    return {
      actions: [{ bounds: tab.bounds, disabled: tab.disabled ?? false, id: tab.id, role: 'tab' }],
      nodes: [
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

export function planNativeUiMessage(spec: NativeUiMessageSpec): NativeUiPlan {
  if (spec.actions.length < 1 || spec.actions.length > 2) {
    throw new RangeError('native UI message requires one or two actions')
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
    {
      kind: 'text',
      label: 'message:title',
      text: {
        align: 'left',
        font: 'menu',
        maxWidth: 400,
        text: spec.title,
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
        maxWidth: 400,
        text: spec.body,
        tint: 0xffffff,
        x: bounds.left + NATIVE_UI_MESSAGE.textInsetX,
        y: bounds.top + NATIVE_UI_MESSAGE.bodyBaselineOffset,
      },
    },
  )
  for (const [x, y, scale] of [
    [centerX, bounds.top + bounds.height + 50, 1],
    [centerX - 75, bounds.top + bounds.height + 37, 0.75],
    [centerX + 75, bounds.top + bounds.height + 37, 0.75],
  ] as const) {
    nodes.push({ anchor: [0.5, 0.5], atlas: 'UI', kind: 'sprite', record: 8, scale, x, y })
  }

  const actionGap = 8
  const availableWidth = bounds.width - 80
  const actionWidth = spec.actions.length === 1
    ? Math.min(353, availableWidth)
    : Math.min(260, (availableWidth - actionGap) / 2)
  const actionsWidth = actionWidth * spec.actions.length + actionGap * (spec.actions.length - 1)
  const actionTop = bounds.top + bounds.height - 92
  const suppliedActionBounds = spec.actions.filter(({ bounds: actionBounds }) => actionBounds !== undefined).length
  if (suppliedActionBounds !== 0 && suppliedActionBounds !== spec.actions.length) {
    throw new RangeError('native UI message action bounds must be supplied for every action or none')
  }
  const actionFragments = spec.actions.map((action, index) => planNativeUiButton({
    bounds: action.bounds ?? nativeUiRect(
      centerX - actionsWidth / 2 + index * (actionWidth + actionGap),
      actionTop,
      actionWidth,
      69,
    ),
    id: action.id,
    label: action.label,
    state: action.state,
  }))
  return nativeUiPlan(
    spec.width,
    spec.height,
    { actions: [], nodes },
    ...actionFragments,
  )
}

export function planNativeUiSimpleMenu(spec: NativeUiSimpleMenuSpec): NativeUiPlan {
  if (spec.rows.length === 0) throw new RangeError('native UI SimpleMenu requires at least one row')
  const centerX = spec.centerX ?? spec.width / 2
  const firstTop = spec.firstRowTop ?? (spec.height - (spec.rows.length * 69 + (spec.rows.length - 1) * 7)) / 2
  const rowGap = spec.rowGap ?? 7
  const rowFragments = spec.rows.map((row, index) => planNativeUiButton({
    bounds: nativeUiRect(centerX - 176.5, firstTop + index * (69 + rowGap), 353, 69),
    id: row.id,
    label: row.label,
    state: row.state,
  }))
  const top = firstTop - 40
  const height = spec.rows.length * 69 + (spec.rows.length - 1) * rowGap + 80
  const chrome: NativeUiFragment = {
    actions: [],
    nodes: [
      {
        alpha: spec.dimAlpha ?? 0.85,
        bounds: nativeUiRect(0, 0, spec.width, spec.height),
        color: 0x000000,
        kind: 'solid',
        label: 'simple-menu:curtain',
      },
      {
        atlas: 'UI',
        bounds: nativeUiRect(centerX - 216.5, top, 433, height),
        edgeUvOrigin: 0.95,
        kind: 'nine-slice',
        label: 'simple-menu:frame',
        record: 17,
      },
      {
        anchor: [0.5, 0.5],
        atlas: 'UI',
        kind: 'sprite',
        label: 'simple-menu:header',
        record: 18,
        rotation: Math.PI / 2,
        x: centerX,
        y: top - 37,
      },
      ...[0, 1, 2].map((index): NativeUiSpriteNode => ({
        anchor: [0.5, 0.5],
        atlas: 'UI',
        kind: 'sprite',
        label: `simple-menu:arrow-${index}`,
        record: 8,
        scale: index === 0 ? 1 : 0.75,
        x: centerX + (index - 1) * 75,
        y: top + height + (index === 1 ? 50 : 37),
      })),
    ],
  }
  return nativeUiPlan(spec.width, spec.height, chrome, ...rowFragments)
}

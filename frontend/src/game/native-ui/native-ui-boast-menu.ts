import { NATIVE_BOAST_PRESENTATION } from '../core-kernels/native-hub-npc.ts'
import { nativeUiRecord } from './native-ui-catalog.ts'
import {
  intersectNativeUiRects,
  nativeUiRect,
  type NativeUiActionRegion,
  type NativeUiFragment,
  type NativeUiNode,
  type NativeUiRect,
} from './native-ui-plan.ts'
import {
  clampNativeUiSwipeBoxOffset,
  nativeUiSwipeBoxMaximumOffset,
} from './native-ui-swipe-box.ts'

export interface NativeUiBoastMenuRow {
  readonly detail: string
  readonly id: string
  readonly label: string
  readonly stockIconRecord?: number
  readonly state?: 'idle' | 'selected'
}

export interface NativeUiBoastMenuSpec {
  readonly height: number
  readonly rows: readonly NativeUiBoastMenuRow[]
  readonly scrollY?: number
  readonly width: number
}

export interface NativeUiBoastCustomIconPlacement {
  readonly id: string
  readonly leftEdgeX: number
  readonly rightEdgeX: number
  readonly selected: boolean
  readonly y: number
}

export interface NativeUiBoastMenuPlan extends NativeUiFragment {
  readonly contentHeight: number
  readonly customIcons: readonly NativeUiBoastCustomIconPlacement[]
  readonly doneBounds: NativeUiRect
  readonly maximumScrollY: number
  readonly outerBounds: NativeUiRect
  readonly rowBounds: readonly Readonly<{
    bounds: NativeUiRect
    id: string
    visibleBounds: NativeUiRect | null
  }>[]
  readonly scrollY: number
  readonly viewportBounds: NativeUiRect
}

export const NATIVE_UI_BOAST_SELECTED_TINT = 0x9feb9f
export const NATIVE_UI_BOAST_TEXT_TINT = 0xd9ba70

/** Exact stock Boast and embedded SwipeBox composition. */
export function planNativeUiBoastMenu(spec: NativeUiBoastMenuSpec): NativeUiBoastMenuPlan {
  const presentation = NATIVE_BOAST_PRESENTATION
  if (!Number.isFinite(spec.width) || spec.width <= 0
      || !Number.isFinite(spec.height) || spec.height <= 0) {
    throw new RangeError('native Boast menu stage must have positive finite dimensions')
  }

  const outer = nativeUiRect(
    (spec.width - presentation.outer.width) / 2,
    (spec.height - presentation.outer.height) / 2 + presentation.outer.centerYOffset,
    presentation.outer.width,
    presentation.outer.height,
  )
  const viewport = nativeUiRect(
    outer.left + presentation.boxInset.left,
    outer.top + presentation.boxInset.top,
    outer.width - presentation.boxInset.widthReduction,
    outer.height - presentation.boxInset.heightReduction,
  )
  const contentHeight = spec.rows.length === 0
    ? 0
    : presentation.row.firstTop
      + (spec.rows.length - 1) * presentation.row.pitch
      + presentation.row.height
      + presentation.contentBottomInset
  const maximumScrollY = nativeUiSwipeBoxMaximumOffset(contentHeight, viewport.height)
  const scrollY = clampNativeUiSwipeBoxOffset(
    spec.scrollY ?? 0,
    contentHeight,
    viewport.height,
  )
  const nodes: NativeUiNode[] = [{
    atlas: 'UI',
    bounds: outer,
    edgeUvOrigin: presentation.edgeUvOrigin,
    kind: 'nine-slice',
    label: 'boast:frame',
    record: presentation.outer.panelRecord,
  }]
  const actions: NativeUiActionRegion[] = []
  const customIcons: NativeUiBoastCustomIconPlacement[] = []
  const contentNodes: NativeUiNode[] = []
  const rowBounds: Array<Readonly<{
    bounds: NativeUiRect
    id: string
    visibleBounds: NativeUiRect | null
  }>> = []

  const doneBounds = nativeUiRect(
    outer.left + outer.width / 2 - 100,
    outer.top + outer.height - 75,
    200,
    40,
  )
  nodes.push(
    {
      kind: 'text',
      label: 'boast:done-label',
      text: {
        font: presentation.fonts.title,
        text: presentation.doneText,
        tint: NATIVE_UI_BOAST_TEXT_TINT,
        x: outer.left + outer.width / 2,
        y: outer.top + outer.height - presentation.doneBottomInset,
      },
    },
    {
      kind: 'text',
      label: 'boast:title',
      text: {
        font: presentation.fonts.title,
        text: presentation.titleText,
        tint: NATIVE_UI_BOAST_TEXT_TINT,
        x: outer.left + outer.width / 2,
        y: outer.top + presentation.titleBaselineY,
      },
    },
  )
  actions.push({ bounds: doneBounds, disabled: false, id: 'done', role: 'button' })

  for (let index = 0; index < spec.rows.length; index += 1) {
    const row = spec.rows[index]!
    const selected = row.state === 'selected'
    const bounds = nativeUiRect(
      viewport.left + presentation.row.left,
      viewport.top + presentation.row.firstTop + index * presentation.row.pitch - scrollY,
      viewport.width - presentation.row.widthInset,
      presentation.row.height,
    )
    const visibleBounds = intersectNativeUiRects(bounds, viewport)
    rowBounds.push(Object.freeze({ bounds, id: row.id, visibleBounds }))
    if (visibleBounds === null) continue

    const tint = selected ? NATIVE_UI_BOAST_SELECTED_TINT : undefined
    const centerY = bounds.top + bounds.height / 2
    contentNodes.push({
      atlas: 'UI',
      bounds,
      edgeUvOrigin: presentation.edgeUvOrigin,
      kind: 'nine-slice',
      label: `${row.id}:frame`,
      record: presentation.row.record,
      tint,
    })
    if (row.stockIconRecord === undefined) {
      customIcons.push(Object.freeze({
        id: row.id,
        leftEdgeX: bounds.left + presentation.iconInset,
        rightEdgeX: bounds.left + bounds.width - presentation.iconInset,
        selected,
        y: centerY,
      }))
    } else {
      const icon = nativeUiRecord('UI', row.stockIconRecord)
      const centerOffset = icon.logicalSize[0] / 2
      contentNodes.push(
        {
          anchor: [0.5, 0.5],
          atlas: 'UI',
          kind: 'sprite',
          label: `${row.id}:icon-left`,
          record: row.stockIconRecord,
          tint,
          x: bounds.left + presentation.iconInset + centerOffset,
          y: centerY,
        },
        {
          anchor: [0.5, 0.5],
          atlas: 'UI',
          kind: 'sprite',
          label: `${row.id}:icon-right`,
          mirrorX: true,
          record: row.stockIconRecord,
          tint,
          x: bounds.left + bounds.width - presentation.iconInset - centerOffset,
          y: centerY,
        },
      )
    }
    contentNodes.push(
      {
        kind: 'text',
        label: `${row.id}:label`,
        text: {
          font: presentation.fonts.label,
          text: row.label,
          tint: tint ?? NATIVE_UI_BOAST_TEXT_TINT,
          x: bounds.left + bounds.width / 2,
          y: centerY + presentation.rowTextOffsets.label,
        },
      },
      {
        kind: 'text',
        label: `${row.id}:detail`,
        text: {
          font: presentation.fonts.detail,
          lineHeight: presentation.detailLineHeight,
          maxWidth: viewport.width - presentation.detailWidthReduction,
          text: row.detail,
          tint: tint ?? NATIVE_UI_BOAST_TEXT_TINT,
          x: bounds.left + bounds.width / 2,
          y: centerY + presentation.rowTextOffsets.detail,
        },
      },
    )
    actions.push({ bounds: visibleBounds, disabled: false, id: row.id, role: 'button' })
  }

  nodes.push(Object.freeze({
    bounds: viewport,
    kind: 'clip' as const,
    label: 'boast:swipe-box',
    nodes: Object.freeze(contentNodes),
  }))

  return Object.freeze({
    actions: Object.freeze(actions),
    contentHeight,
    customIcons: Object.freeze(customIcons),
    doneBounds,
    maximumScrollY,
    nodes: Object.freeze(nodes),
    outerBounds: outer,
    rowBounds: Object.freeze(rowBounds),
    scrollY,
    viewportBounds: viewport,
  })
}

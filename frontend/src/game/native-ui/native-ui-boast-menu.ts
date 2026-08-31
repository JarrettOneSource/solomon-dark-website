import { NATIVE_BOAST_PRESENTATION } from '../core-kernels/native-hub-npc.ts'
import { nativeUiRecord } from './native-ui-catalog.ts'
import {
  nativeUiRect,
  type NativeUiActionRegion,
  type NativeUiFragment,
  type NativeUiNode,
  type NativeUiRect,
} from './native-ui-plan.ts'

export interface NativeUiBoastMenuRow {
  readonly detail: string
  readonly id: string
  readonly label: string
  readonly stockIconRecord?: number
  readonly state?: 'idle' | 'selected'
}

export interface NativeUiBoastMenuSpec {
  readonly height: number
  readonly pageCount?: number
  readonly pageIndex?: number
  readonly rows: readonly NativeUiBoastMenuRow[]
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
  readonly customIcons: readonly NativeUiBoastCustomIconPlacement[]
  readonly doneBounds: NativeUiRect
  readonly outerBounds: NativeUiRect
  readonly rowBounds: readonly Readonly<{ bounds: NativeUiRect; id: string }>[]
}

export const NATIVE_UI_BOAST_SELECTED_TINT = 0x9feb9f
export const NATIVE_UI_BOAST_TEXT_TINT = 0xd9ba70

/** Exact stock BoastBox composition, with pagination only when web mods add rows. */
export function planNativeUiBoastMenu(spec: NativeUiBoastMenuSpec): NativeUiBoastMenuPlan {
  const presentation = NATIVE_BOAST_PRESENTATION
  if (!Number.isFinite(spec.width) || spec.width <= 0 || !Number.isFinite(spec.height) || spec.height <= 0) {
    throw new RangeError('native Boast menu stage must have positive finite dimensions')
  }
  if (spec.rows.length > presentation.stockRowCount) {
    throw new RangeError(`native Boast page supports at most ${presentation.stockRowCount} rows`)
  }
  const pageCount = spec.pageCount ?? 1
  const pageIndex = spec.pageIndex ?? 0
  if (!Number.isSafeInteger(pageCount) || pageCount < 1
      || !Number.isSafeInteger(pageIndex) || pageIndex < 0 || pageIndex >= pageCount) {
    throw new RangeError('native Boast page index is invalid')
  }

  const outer = nativeUiRect(
    (spec.width - presentation.outer.width) / 2,
    (spec.height - presentation.outer.height) / 2 + presentation.outer.centerYOffset,
    presentation.outer.width,
    presentation.outer.height,
  )
  const boxLeft = outer.left + presentation.boxInset.left
  const boxTop = outer.top + presentation.boxInset.top
  const boxWidth = outer.width - presentation.boxInset.widthReduction
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
  const rowBounds: Array<Readonly<{ bounds: NativeUiRect; id: string }>> = []

  const doneBounds = nativeUiRect(
    outer.left + outer.width / 2 - 100,
    outer.top + outer.height - 75,
    200,
    40,
  )
  nodes.push({
    kind: 'text',
    label: 'boast:done-label',
    text: {
      font: presentation.fonts.title,
      text: presentation.doneText,
      tint: NATIVE_UI_BOAST_TEXT_TINT,
      x: outer.left + outer.width / 2,
      y: outer.top + outer.height - presentation.doneBottomInset,
    },
  })
  actions.push({ bounds: doneBounds, disabled: false, id: 'done', role: 'button' })

  for (let index = 0; index < spec.rows.length; index += 1) {
    const row = spec.rows[index]!
    const selected = row.state === 'selected'
    const bounds = nativeUiRect(
      boxLeft + presentation.row.left,
      boxTop + presentation.row.firstTop + index * presentation.row.pitch,
      boxWidth - presentation.row.widthInset,
      presentation.row.height,
    )
    const tint = selected ? NATIVE_UI_BOAST_SELECTED_TINT : undefined
    const centerY = bounds.top + bounds.height / 2
    nodes.push({
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
      nodes.push(
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
    nodes.push(
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
          text: row.detail,
          tint: tint ?? NATIVE_UI_BOAST_TEXT_TINT,
          x: bounds.left + bounds.width / 2,
          y: centerY + presentation.rowTextOffsets.detail,
        },
      },
    )
    actions.push({ bounds, disabled: false, id: row.id, role: 'button' })
    rowBounds.push(Object.freeze({ bounds, id: row.id }))
  }

  nodes.push({
    kind: 'text',
    label: 'boast:title',
    text: {
      font: presentation.fonts.title,
      text: presentation.titleText,
      tint: NATIVE_UI_BOAST_TEXT_TINT,
      x: outer.left + outer.width / 2,
      y: outer.top + presentation.titleBaselineY,
    },
  })

  if (pageCount > 1) {
    const actionY = outer.top + presentation.titleBaselineY
    if (pageIndex > 0) {
      addPageAction(
        nodes,
        actions,
        presentation.fonts.title,
        'previous',
        'PREVIOUS',
        outer.left + 85,
        actionY,
      )
    }
    if (pageIndex + 1 < pageCount) {
      addPageAction(
        nodes,
        actions,
        presentation.fonts.title,
        'next',
        'MORE',
        outer.left + outer.width - 85,
        actionY,
      )
    }
  }

  return Object.freeze({
    actions: Object.freeze(actions),
    customIcons: Object.freeze(customIcons),
    doneBounds,
    nodes: Object.freeze(nodes),
    outerBounds: outer,
    rowBounds: Object.freeze(rowBounds),
  })
}

function addPageAction(
  nodes: NativeUiNode[],
  actions: NativeUiActionRegion[],
  font: 'menu',
  id: 'next' | 'previous',
  text: string,
  x: number,
  y: number,
): void {
  nodes.push({
    kind: 'text',
    label: `boast:${id}`,
    text: {
      font,
      text,
      tint: NATIVE_UI_BOAST_TEXT_TINT,
      x,
      y,
    },
  })
  actions.push({
    bounds: nativeUiRect(x - 65, y - 24, 130, 48),
    disabled: false,
    id,
    role: 'button',
  })
}

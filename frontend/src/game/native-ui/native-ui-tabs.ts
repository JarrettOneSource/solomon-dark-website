import { NATIVE_UI_BUTTON, nativeUiPlan, nativeUiRect, type NativeUiFragment, type NativeUiNode, type NativeUiPlan, type NativeUiRect } from './native-ui-plan.ts'

export interface NativeUiTab {
  readonly bounds: NativeUiRect
  readonly disabled?: boolean
  readonly id: string
  readonly label: string
}

export interface NativeUiTabsSpec {
  readonly height: number
  readonly selectedId: string
  readonly scale?: number
  readonly tabs: readonly NativeUiTab[]
  readonly tint?: number
  readonly width: number
}

const NATIVE_UI_TAB = Object.freeze({
  bracketRecord: 13,
  bracketWidth: 34,
  plateUvOrigin: 0.95,
  restingHeight: 51,
  restingOffsetY: 8,
  selectedHeight: 65,
  selectedRise: 8,
})

export function planNativeUiTabs(spec: NativeUiTabsSpec): NativeUiPlan {
  const scale = spec.scale ?? 1
  if (!spec.tabs.some(({ id }) => id === spec.selectedId)) {
    throw new RangeError(`native UI selected tab ${spec.selectedId} is absent`)
  }
  const fragments = spec.tabs.map((tab): NativeUiFragment => {
    const selected = tab.id === spec.selectedId
    const chromeTop = tab.bounds.top + Math.max(0, tab.bounds.height - 69 * scale)
    const top = chromeTop + (selected ? 0 : NATIVE_UI_TAB.restingOffsetY * scale)
    const bracketHeight = (selected ? NATIVE_UI_TAB.selectedHeight : NATIVE_UI_TAB.restingHeight) * scale
    const bracketWidth = NATIVE_UI_TAB.bracketWidth * scale
    const rightX = tab.bounds.left + tab.bounds.width - bracketWidth
    const sourceUv = selected
      ? [0, 0, 1, 1] as const
      : [
          0,
          0,
          1,
          NATIVE_UI_TAB.restingHeight / NATIVE_UI_TAB.selectedHeight,
        ] as const
    const labelBaselineY = chromeTop + (45 + (selected ? 0 : NATIVE_UI_TAB.selectedRise)) * scale
    const plateWidth = tab.bounds.width - bracketWidth * 2
    // UI.13 carries the tab's dark plate and gold top edge along with the bracket.
    // Retail stretches its last column across the middle, the way the button
    // stretches UI.54, so the plate reaches from bracket to bracket.
    const plate: NativeUiNode[] = plateWidth > 0
      ? [{
          alpha: tab.disabled ? NATIVE_UI_BUTTON.disabledAlpha : 1,
          atlas: 'UI',
          bounds: nativeUiRect(
            tab.bounds.left + bracketWidth,
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
          bounds: nativeUiRect(tab.bounds.left, top, bracketWidth, bracketHeight),
          kind: 'slice',
          label: `${tab.id}:bracket-left`,
          record: NATIVE_UI_TAB.bracketRecord,
          sourceUv,
        },
        {
          alpha: tab.disabled ? NATIVE_UI_BUTTON.disabledAlpha : 1,
          atlas: 'UI',
          bounds: nativeUiRect(rightX, top, bracketWidth, bracketHeight),
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
            scale,
            text: tab.label,
            tint: spec.tint ?? (selected ? 0xffffff : 0xaaa2a6),
            x: tab.bounds.left + tab.bounds.width / 2,
            y: labelBaselineY,
          },
        },
      ],
    }
  })
  return nativeUiPlan(spec.width, spec.height, ...fragments)
}

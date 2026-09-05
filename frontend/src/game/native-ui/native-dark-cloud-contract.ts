import type { NativeUiTab } from './native-ui-tabs.ts'
import {
  nativeUiRect,
  type NativeUiButtonState,
  type NativeUiFragment,
  type NativeUiNode,
  type NativeUiRect,
} from './native-ui-plan.ts'

export const NATIVE_DARK_CLOUD_TABS = Object.freeze([
  Object.freeze({ bounds: nativeUiRect(0, 0, 170, 69), id: 'mods', label: 'MODS' }),
  Object.freeze({ bounds: nativeUiRect(170, 0, 340, 69), id: 'subscribed', label: 'SUBSCRIBED MODS' }),
  Object.freeze({ bounds: nativeUiRect(510, 0, 170, 69), id: 'parties', label: 'PARTIES' }),
  Object.freeze({ bounds: nativeUiRect(680, 0, 202, 69), id: 'layouts', label: 'LAYOUTS' }),
] satisfies readonly NativeUiTab[])

type NativeDarkCloudToolButtonSpec = {
  readonly bounds: NativeUiRect
  readonly id: string
  readonly state?: NativeUiButtonState
  readonly scale?: number
} & (
  | { readonly iconRecord: number; readonly label?: never }
  | { readonly iconRecord?: never; readonly label: string }
)

export function planNativeDarkCloudToolButton(spec: NativeDarkCloudToolButtonSpec): NativeUiFragment {
  const state = spec.state
  const disabled = state === 'disabled'
  const pressed = state === 'pressed' || state === 'selected'
  const scale = spec.scale ?? 1
  const { bounds } = spec
  const offset = pressed ? 4 * scale : 0
  const centerX = bounds.left + bounds.width / 2
  const centerY = bounds.top + bounds.height / 2
  const content: NativeUiNode[] = [{
    anchor: [0.5, 0.5],
    atlas: 'UI',
    kind: 'sprite',
    label: `${spec.id}:body`,
    record: pressed ? 104 : 103,
    scale,
    x: centerX,
    y: centerY,
  }]
  if (spec.iconRecord !== undefined) {
    content.push({
      alpha: disabled ? 0.5 : 1,
      anchor: [0.5, 0.5],
      atlas: 'UI',
      kind: 'sprite',
      label: `${spec.id}:icon`,
      record: spec.iconRecord,
      scale,
      x: centerX + offset,
      y: centerY + offset,
    })
  } else {
    content.push({
      kind: 'text',
      label: `${spec.id}:label`,
      text: {
        alpha: disabled ? 0.5 : 1,
        font: 'menu',
        scale,
        text: spec.label,
        tint: 0xd9ba70,
        x: centerX + offset,
        y: centerY + 8 * scale + offset,
      },
    })
  }
  if (disabled) {
    content.push({ alpha: 0.25, bounds, color: 0x808080, kind: 'solid', label: `${spec.id}:disabled-overlay` })
  }
  return {
    actions: [{ bounds, disabled, id: spec.id, role: 'button' }],
    nodes: [
      { bounds, kind: 'clip', label: `${spec.id}:face`, nodes: content },
      { atlas: 'UI', kind: 'sprite', label: `${spec.id}:end-left`, record: 53, scale, x: bounds.left - 6 * scale, y: bounds.top - 6 * scale },
      {
        atlas: 'UI',
        bounds: nativeUiRect(bounds.left + 21 * scale, bounds.top - 6 * scale, bounds.width - 42 * scale, 62 * scale),
        kind: 'slice',
        label: `${spec.id}:edge`,
        record: 53,
        sourceUv: [0.95, 0, 1, 1],
      },
      { atlas: 'UI', kind: 'sprite', label: `${spec.id}:end-right`, mirrorX: true, record: 53, scale, x: bounds.left + bounds.width + 6 * scale, y: bounds.top - 6 * scale },
    ],
  }
}

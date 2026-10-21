// Source native-ui-plan.ts: only the stock button plan used by the authoring shelf.
import type { NativeUiAtlasName } from './native-ui-catalog.ts'
import type { NativeUiTextSpec } from './native-ui-text.ts'

export interface NativeUiRect {
  readonly height: number
  readonly left: number
  readonly top: number
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
  | NativeUiSliceNode
  | NativeUiSolidNode
  | NativeUiSpriteNode
  | NativeUiTextNode

export interface NativeUiActionRegion {
  readonly bounds: NativeUiRect
  readonly disabled: boolean
  readonly id: string
  readonly role: 'button'
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

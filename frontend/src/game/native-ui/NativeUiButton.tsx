import { forwardRef, useImperativeHandle, useRef, type ButtonHTMLAttributes } from 'react'

import NativeUiPlanView from './NativeUiPlanView.tsx'
import { useNativeUiButtonState } from './native-ui-button-state.ts'
import { useNativeUiElementSize } from './native-ui-element-size.ts'
import { nativeUiPlan, nativeUiRect, planNativeUiButton, type NativeUiRect } from './native-ui-plan.ts'
import './native-ui.css'

export interface NativeUiButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly children: string
  readonly height?: number
  readonly nativeBounds?: NativeUiRect
  readonly scale?: number
  readonly selected?: boolean
  /** Fill a flow/grid cell, or use an authored native width. */
  readonly width?: number | 'fill'
}

/** Semantic React button backed by the exact shared stock Button plan. */
const NativeUiButton = forwardRef<HTMLButtonElement, NativeUiButtonProps>(function NativeUiButton({
  children,
  className,
  height: requestedHeight = 69,
  nativeBounds,
  scale = 1,
  selected = false,
  style,
  width: requestedWidth = 353,
  ...buttonProps
}, forwardedRef) {
  const ref = useRef<HTMLButtonElement>(null)
  useImperativeHandle(forwardedRef, () => ref.current!, [])
  const { events, state } = useNativeUiButtonState(buttonProps, selected)
  const height = nativeBounds?.height ?? requestedHeight
  const size = useNativeUiElementSize(ref, { height, width: typeof requestedWidth === 'number' ? requestedWidth : 353 })
  const width = nativeBounds?.width ?? (requestedWidth === 'fill' ? size.width : requestedWidth)
  const plan = nativeUiPlan(width, height, planNativeUiButton({
    bounds: nativeUiRect(0, 0, width, height),
    id: buttonProps.name ?? 'native-button',
    label: children,
    scale,
    state,
  }))
  return (
    <button
      {...buttonProps}
      {...events}
      aria-label={buttonProps['aria-label'] ?? children}
      className={['native-ui-button', className].filter(Boolean).join(' ')}
      data-native-ui-button
      data-native-ui-button-state={state}
      ref={ref}
      style={{
        height,
        left: nativeBounds?.left,
        position: requestedWidth === 'fill' ? 'relative' : undefined,
        top: nativeBounds?.top,
        width: requestedWidth === 'fill' ? '100%' : width,
        ...style,
      }}
      type={buttonProps.type ?? 'button'}
    >
      <NativeUiPlanView plan={plan} />
      <span className="sr-only native-ui-sr-only">{children}</span>
    </button>
  )
})

export default NativeUiButton

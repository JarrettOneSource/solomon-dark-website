import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'

import NativeUiPlanView from './NativeUiPlanView.tsx'
import {
  nativeUiPlan,
  nativeUiRect,
  planNativeUiButton,
  type NativeUiRect,
} from './native-ui-plan.ts'
import './native-ui.css'

export interface NativeUiButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly children: string
  readonly height?: number
  readonly nativeBounds?: NativeUiRect
  readonly selected?: boolean
  readonly width?: number
}

/** Semantic React button backed by the exact shared stock Button plan. */
const NativeUiButton = forwardRef<HTMLButtonElement, NativeUiButtonProps>(function NativeUiButton({
  children,
  className,
  disabled = false,
  height: requestedHeight = 69,
  nativeBounds,
  onBlur,
  onFocus,
  onKeyDown,
  onKeyUp,
  onPointerCancel,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerUp,
  selected = false,
  style,
  width: requestedWidth = 353,
  ...buttonProps
}, ref) {
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const width = nativeBounds?.width ?? requestedWidth
  const height = nativeBounds?.height ?? requestedHeight
  const state = disabled
    ? 'disabled'
    : pressed
      ? 'pressed'
      : selected
        ? 'selected'
        : focused || hovered
          ? 'focused'
          : 'idle'
  const plan = nativeUiPlan(width, height, planNativeUiButton({
    bounds: nativeUiRect(0, 0, width, height),
    id: buttonProps.name ?? 'native-button',
    label: children,
    state,
  }))

  return (
    <button
      {...buttonProps}
      aria-label={buttonProps['aria-label'] ?? children}
      className={['native-ui-button', className].filter(Boolean).join(' ')}
      data-native-ui-button
      data-native-ui-button-state={state}
      disabled={disabled}
      onBlur={(event) => {
        setFocused(false)
        setPressed(false)
        onBlur?.(event)
      }}
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        if (!disabled && !event.repeat && (event.key === 'Enter' || event.key === ' ')) {
          setPressed(true)
        }
        onKeyDown?.(event)
      }}
      onKeyUp={(event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'Enter' || event.key === ' ') setPressed(false)
        onKeyUp?.(event)
      }}
      onPointerCancel={(event: PointerEvent<HTMLButtonElement>) => {
        setPressed(false)
        onPointerCancel?.(event)
      }}
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        if (!disabled && event.button === 0) setPressed(true)
        onPointerDown?.(event)
      }}
      onPointerEnter={(event: PointerEvent<HTMLButtonElement>) => {
        setHovered(true)
        onPointerEnter?.(event)
      }}
      onPointerLeave={(event: PointerEvent<HTMLButtonElement>) => {
        setHovered(false)
        setPressed(false)
        onPointerLeave?.(event)
      }}
      onPointerUp={(event: PointerEvent<HTMLButtonElement>) => {
        setPressed(false)
        onPointerUp?.(event)
      }}
      ref={ref}
      style={{
        height,
        left: nativeBounds?.left,
        top: nativeBounds?.top,
        width,
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

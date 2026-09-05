import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  WheelEvent as ReactWheelEvent,
} from 'react'

export function NativeAction({
  children,
  data,
  disabled = false,
  gameBack = false,
  label,
  onBlur,
  onClick,
  onFocus,
  onKeyDown,
  onLostPointerCapture,
  onPointerCancel,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  onPointerUp,
  onPressedChange,
  onWheel,
  rect,
  tabIndex,
}: {
  children?: ReactNode
  data?: Record<string, number | string>
  disabled?: boolean
  gameBack?: boolean
  label: string
  onBlur?: () => void
  onClick?: () => void
  onFocus?: () => void
  onKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
  onLostPointerCapture?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerCancel?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  onPointerMove?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerUp?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPressedChange?: (pressed: boolean) => void
  onWheel?: (event: ReactWheelEvent<HTMLButtonElement>) => void
  rect: readonly [number, number, number, number]
  tabIndex?: number
}) {
  return (
    <button
      type="button"
      className="hub-native-ui-action"
      aria-label={label}
      data-game-back={gameBack || undefined}
      disabled={disabled}
      style={rectStyle(rect)}
      tabIndex={tabIndex}
      onBlur={() => {
        onPressedChange?.(false)
        onBlur?.()
      }}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={(event) => {
        if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) onPressedChange?.(true)
        onKeyDown?.(event)
      }}
      onKeyUp={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onPressedChange?.(false)
      }}
      onLostPointerCapture={onLostPointerCapture}
      onPointerCancel={(event) => {
        onPressedChange?.(false)
        onPointerCancel?.(event)
      }}
      onPointerDown={(event) => {
        if (event.button === 0) onPressedChange?.(true)
        onPointerDown?.(event)
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={() => {
        onPressedChange?.(false)
        onPointerLeave?.()
      }}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => {
        onPressedChange?.(false)
        onPointerUp?.(event)
      }}
      onWheel={onWheel}
      {...data}
    >
      <span className="hub-native-ui-semantic">{label}</span>
      {children}
    </button>
  )
}

function rectStyle([left, top, width, height]: readonly [number, number, number, number]): CSSProperties {
  return { height, left, top, width }
}

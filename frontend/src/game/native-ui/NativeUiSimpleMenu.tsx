import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'

import NativeUiPlanView from './NativeUiPlanView.tsx'
import { planNativeUiSimpleMenu } from './native-ui-plan.ts'
import './native-ui.css'

export interface NativeUiSimpleMenuRow<Id extends string = string> {
  readonly disabled?: boolean
  readonly id: Id
  readonly label: string
}

interface NativeUiSimpleMenuProps<Id extends string> {
  readonly ariaLabel: string
  readonly autoFocus?: boolean
  readonly backId?: Id | null
  readonly centerX?: number
  readonly className?: string
  readonly dimAlpha?: number
  readonly disabled?: boolean
  readonly firstRowTop?: number
  readonly height?: number
  readonly onAction: (id: Id) => void
  readonly reveal: number
  readonly rowGap?: number
  readonly rows: readonly NativeUiSimpleMenuRow<Id>[]
  readonly style?: CSSProperties
  readonly width?: number
}

/** Semantic owner for the shared stock SimpleMenu presentation and action geometry. */
export default function NativeUiSimpleMenu<Id extends string>({
  ariaLabel,
  autoFocus = false,
  backId = null,
  centerX,
  className,
  dimAlpha,
  disabled = false,
  firstRowTop,
  height = 900,
  onAction,
  reveal,
  rowGap,
  rows,
  style,
  width = 1_600,
}: NativeUiSimpleMenuProps<Id>) {
  const firstActionRef = useRef<HTMLButtonElement>(null)
  const [pressedId, setPressedId] = useState<Id | null>(null)
  const plan = planNativeUiSimpleMenu({
    centerX,
    height,
    dimAlpha,
    firstRowTop,
    reveal,
    rowGap,
    rows: rows.map((row) => ({
      id: row.id,
      label: row.label,
      state: disabled || row.disabled
        ? 'disabled'
        : pressedId === row.id
          ? 'pressed'
          : 'idle',
    })),
    width,
  })

  useEffect(() => {
    if (autoFocus && !disabled) firstActionRef.current?.focus()
  }, [autoFocus, disabled])

  useEffect(() => {
    if (disabled) setPressedId(null)
  }, [disabled])

  const release = (id: Id) => {
    setPressedId((current) => current === id ? null : current)
  }

  return (
    <div
      aria-label={ariaLabel}
      className={['native-ui-simple-menu', className].filter(Boolean).join(' ')}
      data-native-ui-simple-menu
      data-native-ui-simple-menu-pressed={pressedId ?? 'none'}
      role="group"
      style={{
        height,
        left: 0,
        position: 'absolute',
        top: 0,
        width,
        ...style,
      }}
    >
      <NativeUiPlanView plan={plan} />
      {plan.actions.map((action, index) => {
        const row = rows[index]!
        const rowDisabled = disabled || row.disabled === true
        return (
          <button
            aria-label={row.label}
            className="native-ui-simple-menu-action"
            data-game-back={backId === row.id || undefined}
            data-game-default-focus={index === 0 || undefined}
            data-native-ui-simple-menu-action={row.id}
            disabled={rowDisabled}
            key={row.id}
            onBlur={() => release(row.id)}
            onClick={() => {
              if (!rowDisabled) onAction(row.id)
            }}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
              if (
                !rowDisabled
                && !event.repeat
                && (event.key === 'Enter' || event.key === ' ')
              ) setPressedId(row.id)
            }}
            onKeyUp={(event: KeyboardEvent<HTMLButtonElement>) => {
              if (event.key === 'Enter' || event.key === ' ') release(row.id)
            }}
            onPointerCancel={() => release(row.id)}
            onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
              if (!rowDisabled && event.button === 0) setPressedId(row.id)
            }}
            onPointerLeave={() => release(row.id)}
            onPointerUp={() => release(row.id)}
            ref={index === 0 ? firstActionRef : undefined}
            style={{
              height: action.bounds.height,
              left: action.bounds.left,
              top: action.bounds.top,
              width: action.bounds.width,
            }}
            type="button"
          >
            <span className="native-ui-sr-only">{row.label}</span>
          </button>
        )
      })}
    </div>
  )
}

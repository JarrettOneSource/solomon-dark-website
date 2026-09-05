import { useId, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes } from 'react'

import NativeUiPlanView from './NativeUiPlanView.tsx'
import NativeUiText from './NativeUiText.tsx'
import { useNativeUiButtonState } from './native-ui-button-state.ts'
import { planNativeUiControlPanel } from './native-ui-control-panel.ts'
import { useNativeUiElementSize } from './native-ui-element-size.ts'
import './native-ui-control-panel.css'

interface NativeUiControlPanelProps extends HTMLAttributes<HTMLDivElement> {
  readonly variant?: 'inset' | 'field'
}

/** Stock beveled group; children retain all data and action ownership. */
export function NativeUiControlPanel({ children, className, variant = 'inset', ...props }: NativeUiControlPanelProps) {
  return (
    <div {...props} className={['native-ui-control-panel', className].filter(Boolean).join(' ')} data-native-ui-control-panel={variant}>
      <NativeUiControlPanelArt variant={variant} />
      {children}
    </div>
  )
}

export function NativeUiControlPanelArt({ variant = 'inset' }: { readonly variant?: 'inset' | 'field' }) {
  const ref = useRef<HTMLSpanElement>(null)
  const { width, height } = useNativeUiElementSize(ref, { height: 44, width: 315 })
  return (
    <span aria-hidden className="native-ui-control-panel-art" ref={ref}>
      <NativeUiPlanView plan={planNativeUiControlPanel(width, height, variant === 'inset' ? 3 : 5)} />
    </span>
  )
}

interface NativeUiControlPanelActionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly children: string
  readonly selected?: boolean
}

/** An action/choice row inside the shared CPanel bevel, without a second button skin. */
export function NativeUiControlPanelAction({ children, className, selected = false, ...props }: NativeUiControlPanelActionProps) {
  const { events, state } = useNativeUiButtonState(props, selected)
  const tint = props.disabled ? 0x8e7c4d : selected || state === 'pressed' ? 0xbfffbf : 0xd9ba70
  return (
    <button
      {...props}
      {...events}
      aria-label={props['aria-label'] ?? children}
      className={['native-ui-control-action', className].filter(Boolean).join(' ')}
      data-game-default-focus={props.autoFocus ? 'true' : undefined}
      data-native-ui-control-state={state}
      type={props.type ?? 'button'}
    >
      <span className="native-ui-sr-only">{children}</span>
      <NativeUiText font="medium" text={children} tint={tint} />
    </button>
  )
}

interface NativeUiControlPanelFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly clearLabel?: string
  readonly label: string
  readonly onClear?: () => void
}

/** The native input recess around a browser-owned editable value and caret. */
export function NativeUiControlPanelField({ className, clearLabel = 'Clear', id, label, onClear, ...inputProps }: NativeUiControlPanelFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <div className={['native-ui-control-field-row', className].filter(Boolean).join(' ')}>
      <label htmlFor={inputId}>
        <span className="native-ui-sr-only">{label}</span>
        <NativeUiText font="medium" text={label} tint={0xd9ba70} />
      </label>
      <NativeUiControlPanel className="native-ui-control-field" variant="field">
        <input {...inputProps} data-game-default-focus={inputProps.autoFocus ? 'true' : undefined} id={inputId} />
        {onClear ? (
          <button aria-label={clearLabel} className="native-ui-control-clear" disabled={!inputProps.value} onClick={onClear} type="button">
            <NativeUiText font="medium" text="x" tint={0xd9ba70} />
          </button>
        ) : null}
      </NativeUiControlPanel>
    </div>
  )
}

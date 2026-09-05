import { forwardRef, useImperativeHandle, useRef, type ButtonHTMLAttributes } from 'react'

import NativeUiPlanView from './NativeUiPlanView.tsx'
import { useNativeUiButtonState } from './native-ui-button-state.ts'
import { useNativeUiElementSize } from './native-ui-element-size.ts'
import { nativeUiPlan, nativeUiRect, planNativeUiStoneButton } from './native-ui-plan.ts'
import './native-ui.css'

export interface NativeUiStoneButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly children: string
  readonly height?: number
  readonly selected?: boolean
  readonly width?: number | 'fill'
}

/** Semantic stock green stone action used by CPanel and Dark Cloud dialogs. */
const NativeUiStoneButton = forwardRef<HTMLButtonElement, NativeUiStoneButtonProps>(function NativeUiStoneButton({
  children,
  className,
  height = 41,
  selected = false,
  style,
  width: requestedWidth = 300,
  ...buttonProps
}, forwardedRef) {
  const ref = useRef<HTMLButtonElement>(null)
  useImperativeHandle(forwardedRef, () => ref.current!, [])
  const size = useNativeUiElementSize(ref, { height, width: typeof requestedWidth === 'number' ? requestedWidth : 300 })
  const width = requestedWidth === 'fill' ? size.width : requestedWidth
  const { events, state } = useNativeUiButtonState(buttonProps, selected)
  const plan = nativeUiPlan(width, height, planNativeUiStoneButton({
    bounds: nativeUiRect(0, 0, width, height),
    id: buttonProps.name ?? 'native-stone-button',
    label: children,
    state,
  }))
  return (
    <button
      {...buttonProps}
      {...events}
      aria-label={buttonProps['aria-label'] ?? children}
      className={['native-ui-stone-button', className].filter(Boolean).join(' ')}
      data-native-ui-stone-button
      data-native-ui-stone-button-state={state}
      ref={ref}
      style={{ height, width: requestedWidth === 'fill' ? '100%' : width, ...style }}
      type={buttonProps.type ?? 'button'}
    >
      <NativeUiPlanView plan={plan} />
      <span className="sr-only native-ui-sr-only">{children}</span>
    </button>
  )
})

export default NativeUiStoneButton

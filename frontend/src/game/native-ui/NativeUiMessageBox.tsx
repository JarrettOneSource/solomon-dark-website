import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type CSSProperties,
  type KeyboardEventHandler,
  type ReactElement,
  type ReactNode,
} from 'react'

import NativeUiButton, { type NativeUiButtonProps } from './NativeUiButton.tsx'
import NativeUiPlanView from './NativeUiPlanView.tsx'
import {
  nativeUiMessageActionBounds,
  nativeUiRect,
  planNativeUiMessageFrame,
  type NativeUiRect,
} from './native-ui-plan.ts'

interface NativeUiMessageBoxProps {
  readonly accessibleBody?: string
  readonly accessibleTitle?: string
  readonly body: string
  readonly bounds?: NativeUiRect
  readonly children: ReactNode
  readonly className?: string
  readonly dimAlpha?: number
  readonly height?: number
  readonly onKeyDown?: KeyboardEventHandler<HTMLElement>
  readonly style?: CSSProperties
  readonly title: string
  readonly width?: number
}

const DEFAULT_BOUNDS = nativeUiRect(550, 268, 500, 362)

/** Stock MsgBox presentation with one or two caller-defined stock buttons. */
export default function NativeUiMessageBox({
  accessibleBody,
  accessibleTitle,
  body,
  bounds = DEFAULT_BOUNDS,
  children,
  className,
  dimAlpha = 0.75,
  height = 900,
  onKeyDown,
  style,
  title,
  width = 1_600,
}: NativeUiMessageBoxProps) {
  const headingId = useId()
  const bodyId = useId()
  const buttons = messageButtons(children)
  const suppliedBounds = buttons.filter(({ props }) => props.nativeBounds !== undefined).length
  if (suppliedBounds !== 0 && suppliedBounds !== buttons.length) {
    throw new RangeError('native UI message button bounds must be supplied for every button or none')
  }
  const defaultBounds = nativeUiMessageActionBounds(bounds, buttons.length as 1 | 2)
  const frame = planNativeUiMessageFrame({
    body,
    bounds,
    dimAlpha,
    height,
    title,
    width,
  })

  return (
    <section
      aria-describedby={bodyId}
      aria-labelledby={headingId}
      aria-modal="true"
      className={className}
      data-native-ui-message-box
      onKeyDown={onKeyDown}
      role="dialog"
      style={{
        height,
        left: 0,
        position: 'absolute',
        top: 0,
        width,
        ...style,
      }}
    >
      <h2 className="sr-only native-ui-sr-only" id={headingId}>{accessibleTitle ?? title}</h2>
      <p className="sr-only native-ui-sr-only" id={bodyId}>
        {accessibleBody ?? body.replaceAll('\n', ' ')}
      </p>
      <NativeUiPlanView plan={frame} />
      {buttons.map((button, index) => cloneElement(button, {
        key: button.key ?? button.props.name ?? index,
        nativeBounds: button.props.nativeBounds ?? defaultBounds[index],
      }))}
    </section>
  )
}

function messageButtons(children: ReactNode): readonly ReactElement<NativeUiButtonProps>[] {
  const buttons = Children.toArray(children).map((child) => {
    if (!isValidElement<NativeUiButtonProps>(child) || child.type !== NativeUiButton) {
      throw new TypeError('native UI message children must be NativeUiButton elements')
    }
    return child
  })
  if (buttons.length < 1 || buttons.length > 2) {
    throw new RangeError('native UI message requires one or two buttons')
  }
  return buttons
}

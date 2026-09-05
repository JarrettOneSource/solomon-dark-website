import {
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
} from 'react'

import NativeUiText from './NativeUiText.tsx'
import NativeUiButton from './NativeUiButton.tsx'
import NativeUiPlanView from './NativeUiPlanView.tsx'
import { useNativeUiButtonState } from './native-ui-button-state.ts'
import { useNativeUiElementSize } from './native-ui-element-size.ts'
import { planNativeDarkCloudListFrame, planNativeDarkCloudPanel, planNativeDarkCloudSceneArt } from './native-dark-cloud-frame.ts'
import './native-dark-cloud.css'
import NativeUiTabs from './NativeUiTabs.tsx'
import { nativeUiFont } from './native-ui-catalog.ts'
import { layoutNativeUiText } from './native-ui-text.ts'
import {
  NATIVE_DARK_CLOUD_TABS,
  planNativeDarkCloudToolButton,
} from './native-dark-cloud-contract.ts'
import { nativeUiPlan, nativeUiRect } from './native-ui-plan.ts'

type DarkCloudTabId = 'layouts' | 'mods' | 'parties' | 'subscribed'

export function NativeDarkCloudText({
  align = 'left',
  className,
  content = false,
  font = 'menu',
  scale = 0.68,
  style,
  text,
  tint = 0xd9ba70,
  width,
}: {
  readonly align?: 'center' | 'left' | 'right'
  readonly className?: string
  /** External names and metadata may contain characters absent from retail atlases. */
  readonly content?: boolean
  readonly font?: 'heading' | 'medium' | 'menu'
  readonly scale?: number
  readonly style?: CSSProperties
  readonly text: string
  readonly tint?: number
  readonly width?: number
}) {
  if (content && layoutNativeUiText({ font, scale, text, x: 0, y: 0 }).unsupportedCodePoints.length > 0) {
    return <span className={['native-ui-content-text', className].filter(Boolean).join(' ')} data-native-ui-content-text style={{ color: `#${tint.toString(16).padStart(6, '0')}`, fontSize: nativeUiFont(font).metrics[0] * scale, ...style }}>{text}</span>
  }
  return (
    <>
      <span className="native-ui-sr-only">{text}</span>
      <NativeUiText
        align={align}
        className={className}
        font={font}
        scale={scale}
        style={style}
        text={text}
        tint={tint}
        width={width}
      />
    </>
  )
}

export function NativeDarkCloudSceneArt() {
  const ref = useRef<HTMLDivElement>(null)
  const { width, height } = useNativeUiElementSize(ref, { height: 900, width: 1_600 })
  return (
    <div aria-hidden className="dark-cloud-native-scene-art" ref={ref}>
      <NativeUiPlanView plan={planNativeDarkCloudSceneArt(width, height)} />
      <i className="native-dark-cloud-curtain" />
      <div className="native-dark-cloud-frame-shade-box">
        <i className="native-dark-cloud-frame-shade top" />
        <i className="native-dark-cloud-frame-shade bottom" />
        <i className="native-dark-cloud-frame-shade left" />
        <i className="native-dark-cloud-frame-shade right" />
      </div>
    </div>
  )
}

export function NativeDarkCloudListFrameArt() {
  const ref = useRef<HTMLDivElement>(null)
  const { width, height } = useNativeUiElementSize(ref, { height: 627, width: 1_490 })
  return (
    <div aria-hidden className="dark-cloud-native-list-art" ref={ref}>
      <NativeUiPlanView plan={planNativeDarkCloudListFrame(width, height)} />
    </div>
  )
}

export function NativeDarkCloudPanelArt() {
  const ref = useRef<HTMLDivElement>(null)
  const { width, height } = useNativeUiElementSize(ref, { height: 205, width: 520 })
  return (
    <div aria-hidden className="dark-cloud-native-panel-art" ref={ref}>
      <NativeUiPlanView plan={planNativeDarkCloudPanel(width, height)} />
    </div>
  )
}

export function NativeDarkCloudHeading({
  accountUsername,
  onAccount,
}: {
  readonly accountUsername: string | null
  readonly onAccount: () => void
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const accountRef = useRef<HTMLButtonElement>(null)
  const titleSize = useNativeUiElementSize(titleRef, { height: 58, width: 760 })
  const accountSize = useNativeUiElementSize(accountRef, { height: 50, width: 560 })
  const titleScale = Math.min(1, titleSize.width / 560, titleSize.height / 58)
  const accountScale = Math.min(1, accountSize.width / 560)
  const accountLine = accountUsername
    ? `You are signed in as ${accountUsername}.`
    : 'You are signed in as a GUEST.'
  return (
    <header className="dark-cloud-heading">
      <h1 ref={titleRef}>
        <span className="native-ui-sr-only">THE DARK CLOUD</span>
        <NativeUiText
          align="center"
          font="heading"
          placement="baseline"
          scale={titleScale}
          style={{ left: '50%', top: 50 * titleScale }}
          text="THE DARK CLOUD"
          tint={0xd9ba70}
        />
        <span className="dark-cloud-beta">
          <NativeUiText
            font="menu"
            align="center"
            placement="baseline"
            scale={titleScale}
            style={{ left: titleSize.width / 2 + 235 * titleScale, top: 50 * titleScale }}
            text="beta"
            tint={0xd9ba70}
          />
        </span>
      </h1>
      <button aria-label={accountLine} onClick={onAccount} ref={accountRef} type="button">
        <NativeUiText
          align="center"
          font="menu"
          placement="baseline"
          scale={accountScale}
          style={{ left: '50%', top: 25 }}
          text={accountLine}
          tint={0xd9ba70}
        />
        {!accountUsername ? (
          <NativeUiText
            align="center"
            className="dark-cloud-account-action"
            font="menu"
            placement="baseline"
            scale={accountScale}
            style={{ left: '50%', top: 25 + 18 * accountScale }}
            text="To change this, click here."
            tint={0xd9ba70}
          />
        ) : null}
        {!accountUsername ? <i aria-hidden className="native-dark-cloud-account-underline" style={{ left: `calc(50% + ${34 * accountScale}px)`, top: 25 + 20 * accountScale, width: 145 * accountScale }} /> : null}
      </button>
    </header>
  )
}

export function NativeDarkCloudTabs({
  onSelect,
  selectedId,
}: {
  readonly onSelect: (id: DarkCloudTabId) => void
  readonly selectedId: DarkCloudTabId
}) {
  const hostRef = useRef<HTMLElement>(null)
  const size = useNativeUiElementSize(hostRef, { height: 69, width: 882 })
  const scale = Math.min(1, size.width / 882, size.height / 69)
  return (
    <nav className="dark-cloud-tabs" ref={hostRef}>
      <NativeUiTabs
        ariaLabel="Dark Cloud sections"
        className="dark-cloud-tabs-plan"
        height={size.height}
        onSelect={(id) => onSelect(id as DarkCloudTabId)}
        selectedId={selectedId}
        scale={scale}
        tabs={NATIVE_DARK_CLOUD_TABS.map(tab => ({ ...tab, bounds: nativeUiRect(tab.bounds.left * size.width / 882, 0, tab.bounds.width * size.width / 882, size.height) }))}
        tint={0xd9ba70}
        width={size.width}
      />
    </nav>
  )
}

interface NativeDarkCloudToolButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  readonly icon: 'search' | 'sort' | null
  readonly label: string
  readonly nativeWidth?: number
}

export function NativeDarkCloudToolButton({
  className,
  icon,
  label,
  nativeWidth = 90,
  ...buttonProps
}: NativeDarkCloudToolButtonProps) {
  const hostRef = useRef<HTMLButtonElement>(null)
  const size = useNativeUiElementSize(hostRef, { height: 52, width: nativeWidth })
  const { events, state } = useNativeUiButtonState(buttonProps)
  const content = icon === null
    ? { label: label.toLowerCase() }
    : { iconRecord: icon === 'search' ? 58 : 66 }
  const plan = nativeUiPlan(size.width, size.height, planNativeDarkCloudToolButton({
    ...content,
    bounds: nativeUiRect(0, 0, size.width, size.height),
    id: label.toLowerCase().replaceAll(' ', '-'),
    state,
    scale: size.height / 52,
  }))
  return (
    <button
      {...buttonProps}
      aria-label={buttonProps['aria-label'] ?? label}
      className={['dark-cloud-tool-button', className].filter(Boolean).join(' ')}
      data-native-dark-cloud-tool={icon ?? 'options'}
      {...events}
      ref={hostRef}
      type={buttonProps.type ?? 'button'}
    >
      <NativeUiPlanView plan={plan} />
      <span className="native-ui-sr-only">{label}</span>
    </button>
  )
}

interface NativeDarkCloudPrimaryButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  readonly children: string
}

export function NativeDarkCloudPrimaryButton({
  children,
  className,
  ...buttonProps
}: NativeDarkCloudPrimaryButtonProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const size = useNativeUiElementSize(hostRef, { height: 69, width: 353 })
  return (
    <div className="dark-cloud-primary-control" ref={hostRef}>
      <NativeUiButton
        {...buttonProps}
        className={['dark-cloud-primary-button', className].filter(Boolean).join(' ')}
        height={size.height}
        scale={size.height / 69}
        style={{
          left: 0,
          top: 0,
        }}
        width={size.width}
      >
        {children}
      </NativeUiButton>
    </div>
  )
}

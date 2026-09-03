import {
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'

import NativeBitmapText from './NativeBitmapText.tsx'
import NativeUiButton from './NativeUiButton.tsx'
import NativeUiPlanView from './NativeUiPlanView.tsx'
import NativeUiSprite from './NativeUiSprite.tsx'
import NativeUiTabs, { type NativeUiTab } from './NativeUiTabs.tsx'
import {
  NATIVE_DARK_CLOUD_PRESENTATION,
  NATIVE_DARK_CLOUD_TABS,
  planNativeDarkCloudToolButton,
} from './native-dark-cloud-contract.ts'
import { nativeUiPlan, nativeUiRect, type NativeUiButtonState } from './native-ui-plan.ts'

type DarkCloudTabId = 'layouts' | 'mods' | 'parties' | 'subscribed'

export function NativeDarkCloudText({
  align = 'left',
  className,
  font = 'menu',
  scale = 0.68,
  style,
  text,
  tint = 0xd9ba70,
  width,
}: {
  readonly align?: 'center' | 'left' | 'right'
  readonly className?: string
  readonly font?: 'heading' | 'medium' | 'menu'
  readonly scale?: number
  readonly style?: CSSProperties
  readonly text: string
  readonly tint?: number
  readonly width?: number
}) {
  return (
    <>
      <span className="native-ui-sr-only">{text}</span>
      <NativeBitmapText
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
  return (
    <div aria-hidden className="dark-cloud-native-scene-art">
      <NativeUiSprite atlas="UI" className="dark-cloud-scene-flourish left" record={29} />
      <NativeUiSprite atlas="UI" className="dark-cloud-scene-flourish right" record={29} />
      <NativeUiSprite atlas="UI" className="dark-cloud-scene-wizard tall top-right" record={31} />
      <NativeUiSprite atlas="UI" className="dark-cloud-scene-wizard short top-left" record={32} />
      <NativeUiSprite atlas="UI" className="dark-cloud-scene-wizard short bottom-right" record={32} />
      <NativeUiSprite atlas="UI" className="dark-cloud-scene-wizard tall bottom-left" record={31} />
      <NativeUiSprite atlas="UI" className="dark-cloud-scene-side top-left" record={20} />
      <NativeUiSprite atlas="UI" className="dark-cloud-scene-side bottom-left" record={20} />
      <NativeUiSprite atlas="UI" className="dark-cloud-scene-side top-right" record={20} />
      <NativeUiSprite atlas="UI" className="dark-cloud-scene-side bottom-right" record={20} />
    </div>
  )
}

export function NativeDarkCloudListFrameArt() {
  return (
    <div aria-hidden className="dark-cloud-native-list-art">
      <NativeUiSprite atlas="UI" className="dark-cloud-frame-stone top-left" record={107} />
      <NativeUiSprite atlas="UI" className="dark-cloud-frame-stone top-right" record={108} />
      <NativeUiSprite atlas="UI" className="dark-cloud-frame-stone bottom-left" record={109} />
      <NativeUiSprite atlas="UI" className="dark-cloud-frame-stone bottom-right" record={110} />
      <NativeUiSprite atlas="UI" className="dark-cloud-frame-gold top-left" record={17} />
      <NativeUiSprite atlas="UI" className="dark-cloud-frame-gold top-right" record={17} />
      <NativeUiSprite atlas="UI" className="dark-cloud-frame-gold bottom-left" record={17} />
      <NativeUiSprite atlas="UI" className="dark-cloud-frame-gold bottom-right" record={17} />
    </div>
  )
}

export function NativeDarkCloudPanelArt({
  flourishes = true,
}: {
  readonly flourishes?: boolean
}) {
  const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
  return (
    <div aria-hidden className="dark-cloud-native-panel-art">
      {corners.map(corner => (
        <NativeUiSprite
          atlas="UI"
          className={`dark-cloud-panel-corner outer ${corner}`}
          key={`outer:${corner}`}
          record={17}
        />
      ))}
      {corners.map(corner => (
        <NativeUiSprite
          atlas="UI"
          className={`dark-cloud-panel-corner inner ${corner}`}
          key={`inner:${corner}`}
          record={17}
        />
      ))}
      {flourishes ? (
        <>
          <NativeUiSprite atlas="UI" className="dark-cloud-panel-flourish left" record={18} />
          <NativeUiSprite atlas="UI" className="dark-cloud-panel-flourish right" record={18} />
        </>
      ) : null}
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
  const accountLine = accountUsername
    ? `YOU ARE SIGNED IN AS ${accountUsername.toUpperCase()}.`
    : 'YOU ARE SIGNED IN AS A GUEST.'
  return (
    <header className="dark-cloud-heading">
      <h1>
        <span className="native-ui-sr-only">THE DARK CLOUD</span>
        <NativeBitmapText
          align="center"
          font={NATIVE_DARK_CLOUD_PRESENTATION.fonts.heading}
          text="THE DARK CLOUD"
          tint={0xd9ba70}
          width={420}
        />
        <NativeBitmapText
          className="dark-cloud-beta"
          font={NATIVE_DARK_CLOUD_PRESENTATION.fonts.menu}
          scale={0.68}
          text="BETA"
          tint={0xd9ba70}
        />
      </h1>
      <button onClick={onAccount} type="button">
        <span className="native-ui-sr-only">{accountLine}</span>
        {accountUsername ? <span className="native-ui-sr-only">{accountUsername.toUpperCase()}</span> : null}
        <NativeBitmapText
          align="center"
          font={NATIVE_DARK_CLOUD_PRESENTATION.fonts.menu}
          scale={0.72}
          text={accountLine}
          tint={0xd9ba70}
          width={560}
        />
        {!accountUsername ? (
          <NativeBitmapText
            align="center"
            className="dark-cloud-account-action"
            font={NATIVE_DARK_CLOUD_PRESENTATION.fonts.menu}
            scale={0.68}
            text="TO CHANGE THIS, CLICK HERE."
            tint={0xd9ba70}
            width={560}
          />
        ) : null}
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
  const size = useElementSize(hostRef, { height: 69, width: 882 })
  const scaleX = size.width / 882
  const scaleY = size.height / 69
  return (
    <nav className="dark-cloud-tabs" ref={hostRef}>
      <NativeUiTabs
        ariaLabel="Dark Cloud sections"
        className="dark-cloud-tabs-plan"
        height={69}
        onSelect={(id) => onSelect(id as DarkCloudTabId)}
        selectedId={selectedId}
        style={{ transform: `scale(${scaleX}, ${scaleY})`, transformOrigin: 'top left' }}
        tabs={NATIVE_DARK_CLOUD_TABS as readonly NativeUiTab[]}
        width={882}
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
  disabled = false,
  icon,
  label,
  nativeWidth = 90,
  onBlur,
  onPointerCancel,
  onPointerDown,
  onPointerLeave,
  onPointerUp,
  ...buttonProps
}: NativeDarkCloudToolButtonProps) {
  const hostRef = useRef<HTMLButtonElement>(null)
  const [pressed, setPressed] = useState(false)
  const size = useElementSize(hostRef, { height: 52, width: nativeWidth })
  const state: NativeUiButtonState = disabled ? 'disabled' : pressed ? 'pressed' : 'idle'
  const iconRecord = icon === 'search'
    ? NATIVE_DARK_CLOUD_PRESENTATION.records.searchIcon.record
    : icon === 'sort'
      ? NATIVE_DARK_CLOUD_PRESENTATION.records.sortIcon.record
      : undefined
  const plan = nativeUiPlan(nativeWidth, 52, planNativeDarkCloudToolButton({
    bounds: nativeUiRect(0, 0, nativeWidth, 52),
    iconRecord,
    id: label.toLocaleLowerCase().replaceAll(' ', '-'),
    label: icon === null ? label : undefined,
    state,
  }))
  return (
    <button
      {...buttonProps}
      aria-label={buttonProps['aria-label'] ?? label}
      className={['dark-cloud-tool-button', className].filter(Boolean).join(' ')}
      data-native-dark-cloud-tool={icon ?? 'options'}
      disabled={disabled}
      onBlur={(event) => {
        setPressed(false)
        onBlur?.(event)
      }}
      onPointerCancel={(event) => {
        setPressed(false)
        onPointerCancel?.(event)
      }}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        if (!disabled && event.button === 0) setPressed(true)
        onPointerDown?.(event)
      }}
      onPointerLeave={(event) => {
        setPressed(false)
        onPointerLeave?.(event)
      }}
      onPointerUp={(event) => {
        setPressed(false)
        onPointerUp?.(event)
      }}
      ref={hostRef}
      type={buttonProps.type ?? 'button'}
    >
      <NativeUiPlanView
        plan={plan}
        style={{
          transform: `scale(${size.width / nativeWidth}, ${size.height / 52})`,
          transformOrigin: 'top left',
        }}
      />
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
  const size = useElementSize(hostRef, { height: 69, width: 353 })
  return (
    <div className="dark-cloud-primary-control" ref={hostRef}>
      <NativeUiButton
        {...buttonProps}
        className={['dark-cloud-primary-button', className].filter(Boolean).join(' ')}
        height={69}
        style={{
          left: 0,
          top: 0,
          transform: `scale(${size.width / 353}, ${size.height / 69})`,
          transformOrigin: 'top left',
        }}
        width={353}
      >
        {children}
      </NativeUiButton>
    </div>
  )
}

function useElementSize<T extends Element>(
  ref: RefObject<T | null>,
  fallback: { readonly height: number; readonly width: number },
) {
  const [size, setSize] = useState(fallback)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const update = () => {
      const bounds = element.getBoundingClientRect()
      if (bounds.width > 0 && bounds.height > 0) {
        setSize({ height: bounds.height, width: bounds.width })
      }
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}

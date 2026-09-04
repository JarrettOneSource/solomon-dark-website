import {
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

import NativeBitmapText from './NativeBitmapText.tsx'
import NativeUiButton from './NativeUiButton.tsx'
import NativeUiPlanView from './NativeUiPlanView.tsx'
import NativeUiSprite from './NativeUiSprite.tsx'
import NativeUiTabs, { type NativeUiTab } from './NativeUiTabs.tsx'
import {
  NATIVE_DARK_CLOUD_PRESENTATION,
  NATIVE_DARK_CLOUD_SCENE,
  NATIVE_DARK_CLOUD_TABS,
  NATIVE_DARK_CLOUD_TEXT,
  planNativeDarkCloudBackdrop,
  planNativeDarkCloudFrame,
  planNativeDarkCloudToolButton,
  type NativeDarkCloudColumn,
} from './native-dark-cloud-contract.ts'
import { nativeUiFont } from './native-ui-catalog.ts'
import { nativeUiPlan, nativeUiRect, type NativeUiButtonState } from './native-ui-plan.ts'

type DarkCloudTabId = 'layouts' | 'mods' | 'parties' | 'subscribed'

const HEADING_FONT = NATIVE_DARK_CLOUD_PRESENTATION.fonts.heading
const MENU_FONT = NATIVE_DARK_CLOUD_PRESENTATION.fonts.menu
const FRAME_LEFT = NATIVE_DARK_CLOUD_SCENE.shade.panel.left
const FRAME_TOP = NATIVE_DARK_CLOUD_SCENE.shade.panel.top
const FRAME_RIGHT = FRAME_LEFT + NATIVE_DARK_CLOUD_SCENE.shade.panel.width

/** NativeBitmapText puts the baseline metrics[0] * scale / 2 below its top edge. */
function textTop(font: 'heading' | 'menu', baselineY: number, scale: number): number {
  return baselineY - nativeUiFont(font).metrics[0] * scale / 2
}

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
  const { shade } = NATIVE_DARK_CLOUD_SCENE
  const reach = shade.glowReach
  const { panel } = shade
  const right = panel.left + panel.width
  const bottom = panel.top + panel.height
  return (
    <div aria-hidden className="dark-cloud-native-scene-art">
      <NativeUiPlanView className="dark-cloud-backdrop-plan" plan={planNativeDarkCloudBackdrop()} />
      <div className="dark-cloud-shade">
        <i className="dark-cloud-shade-band" style={{ height: shade.bandBottom }} />
        <i
          className="dark-cloud-shade-gradient"
          style={{ height: shade.gradientBottom - shade.bandBottom, top: shade.bandBottom }}
        />
        <i className="dark-cloud-glow top" style={{ height: reach, left: panel.left, top: panel.top - reach, width: panel.width }} />
        <i className="dark-cloud-glow bottom" style={{ height: reach, left: panel.left, top: bottom, width: panel.width }} />
        <i className="dark-cloud-glow left" style={{ height: panel.height, left: panel.left - reach, top: panel.top, width: reach }} />
        <i className="dark-cloud-glow right" style={{ height: panel.height, left: right, top: panel.top, width: reach }} />
        <i className="dark-cloud-glow corner top-left" style={{ height: reach, left: panel.left - reach, top: panel.top - reach, width: reach }} />
        <i className="dark-cloud-glow corner top-right" style={{ height: reach, left: right, top: panel.top - reach, width: reach }} />
        <i className="dark-cloud-glow corner bottom-left" style={{ height: reach, left: panel.left - reach, top: bottom, width: reach }} />
        <i className="dark-cloud-glow corner bottom-right" style={{ height: reach, left: right, top: bottom, width: reach }} />
      </div>
      <NativeUiPlanView className="dark-cloud-frame-plan" plan={planNativeDarkCloudFrame()} />
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
  const text = NATIVE_DARK_CLOUD_TEXT
  const { account } = text
  const accountLine = accountUsername
    ? `You are signed in as ${accountUsername}.`
    : 'You are signed in as a GUEST.'
  return (
    <header className="dark-cloud-heading">
      <h1>
        <span className="native-ui-sr-only">THE DARK CLOUD</span>
        <NativeBitmapText
          align="center"
          font={HEADING_FONT}
          scale={text.heading.scale}
          style={{ left: 0, position: 'absolute', top: textTop('heading', text.heading.baselineY, text.heading.scale) }}
          text="THE DARK CLOUD"
          tint={text.colors.gold}
          width={text.heading.centerX * 2}
        />
        <NativeBitmapText
          className="dark-cloud-beta"
          font={MENU_FONT}
          scale={text.beta.scale}
          style={{ left: text.beta.x, position: 'absolute', top: textTop('menu', text.beta.baselineY, text.beta.scale) }}
          text="beta"
          tint={text.colors.gold}
        />
      </h1>
      <button
        onClick={onAccount}
        style={{ height: account.bounds.height, left: account.bounds.left, top: account.bounds.top, width: account.bounds.width }}
        type="button"
      >
        <span className="native-ui-sr-only">{accountLine}</span>
        <NativeBitmapText
          align="center"
          font={MENU_FONT}
          scale={account.line1.scale}
          style={{
            left: 0,
            position: 'absolute',
            top: textTop('menu', account.line1.baselineY, account.line1.scale) - account.bounds.top,
          }}
          text={accountLine}
          tint={text.colors.gold}
          width={account.bounds.width}
        />
        {!accountUsername ? (
          <>
            <NativeBitmapText
              align="center"
              className="dark-cloud-account-action"
              font={MENU_FONT}
              scale={account.line2.scale}
              style={{
                left: 0,
                position: 'absolute',
                top: textTop('menu', account.line2.baselineY, account.line2.scale) - account.bounds.top,
              }}
              text="To change this, click here."
              tint={text.colors.gold}
              width={account.bounds.width}
            />
            <i
              className="dark-cloud-account-underline"
              style={{
                height: account.underline.height,
                left: account.underline.left - account.bounds.left,
                top: account.underline.top - account.bounds.top,
                width: account.underline.width,
              }}
            />
          </>
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
  const strip = NATIVE_DARK_CLOUD_PRESENTATION.geometry.tabStripBounds
  return (
    <nav className="dark-cloud-tabs" style={{ height: strip.height, left: strip.left, top: strip.top, width: strip.width }}>
      <NativeUiTabs
        ariaLabel="Dark Cloud sections"
        className="dark-cloud-tabs-plan"
        height={strip.height}
        onSelect={(id) => onSelect(id as DarkCloudTabId)}
        selectedId={selectedId}
        tabs={NATIVE_DARK_CLOUD_TABS as readonly NativeUiTab[]}
        width={strip.width}
      />
    </nav>
  )
}

/** Column x anchors expressed inside the list frame (design x minus the frame left). */
function columnStyle(column: NativeDarkCloudColumn): CSSProperties {
  if (column.left !== undefined) return { left: column.left - FRAME_LEFT }
  return { right: FRAME_RIGHT - (column.right ?? FRAME_RIGHT) }
}

function columnAlign(column: NativeDarkCloudColumn): 'left' | 'right' {
  return column.left !== undefined ? 'left' : 'right'
}

/** The lowercase small-caps column header row inside the frame's dark band. */
export function NativeDarkCloudColumns({
  columns,
}: {
  readonly columns: readonly NativeDarkCloudColumn[]
}) {
  const { columns: metrics, colors } = NATIVE_DARK_CLOUD_TEXT
  const top = textTop('menu', metrics.baselineY, metrics.scale) - FRAME_TOP
  return (
    <div aria-hidden className="dark-cloud-columns">
      {columns.map(column => (
        <span
          className={`dark-cloud-column dark-cloud-column-${column.id}`}
          key={column.id}
          style={{ ...columnStyle(column), top }}
        >
          <NativeBitmapText
            align={columnAlign(column)}
            font={MENU_FONT}
            scale={metrics.scale}
            text={column.label}
            tint={colors.gold}
          />
        </span>
      ))}
    </div>
  )
}

export interface NativeDarkCloudCell {
  readonly text: string
  readonly tint?: number
  readonly title?: string
}

/** One stock list row: single-line menu-face cells on the column anchors. */
export function NativeDarkCloudRowCells({
  cells,
  columns,
  tint = NATIVE_DARK_CLOUD_TEXT.colors.gold,
}: {
  readonly cells: readonly NativeDarkCloudCell[]
  readonly columns: readonly NativeDarkCloudColumn[]
  readonly tint?: number
}) {
  const { rows } = NATIVE_DARK_CLOUD_TEXT
  const top = rows.baselineOffset - nativeUiFont('menu').metrics[0] * rows.scale / 2
  return (
    <>
      {cells.map((cell, index) => {
        const column = columns[index]
        if (!column) return null
        return (
          <span
            className={`dark-cloud-cell dark-cloud-cell-${column.id}`}
            key={column.id}
            style={{ ...columnStyle(column), top }}
            title={cell.title}
          >
            <span className="native-ui-sr-only">{cell.text}</span>
            <NativeBitmapText
              align={columnAlign(column)}
              font={MENU_FONT}
              scale={rows.scale}
                text={cell.text}
              tint={cell.tint ?? tint}
            />
          </span>
        )
      })}
    </>
  )
}

/** A green status row (loading, empty, error) in the stock list voice. */
export function NativeDarkCloudStatusRow({
  children,
  text,
}: {
  readonly children?: ReactNode
  readonly text: string
}) {
  const { colors, rows } = NATIVE_DARK_CLOUD_TEXT
  const top = rows.baselineOffset - nativeUiFont('menu').metrics[0] * rows.scale / 2
  return (
    <div className="dark-cloud-empty">
      <span className="dark-cloud-cell dark-cloud-cell-name" style={{ left: 105 - FRAME_LEFT, top }}>
        <span className="native-ui-sr-only">{text}</span>
        <NativeBitmapText
          font={MENU_FONT}
          scale={rows.scale}
          text={text}
          tint={colors.green}
        />
      </span>
      {children}
    </div>
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
  const [pressed, setPressed] = useState(false)
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
      style={{ height: 52, width: nativeWidth, ...buttonProps.style }}
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
  return (
    <div className="dark-cloud-primary-control">
      <NativeUiButton
        {...buttonProps}
        className={['dark-cloud-primary-button', className].filter(Boolean).join(' ')}
        height={69}
        style={{ left: 0, top: 0 }}
        width={353}
      >
        {children}
      </NativeUiButton>
    </div>
  )
}

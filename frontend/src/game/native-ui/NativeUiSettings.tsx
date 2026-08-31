import {
  useId,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react'

import { NATIVE_UI_ATLAS_SOURCES } from './native-ui-assets.ts'
import {
  NativeSettingsActionArrow,
  NativeSettingsBindingPlate,
  NativeSettingsPanelArt,
  NativeSettingsRangeTrack,
  NativeSettingsRowPlate,
  NativeSettingsText,
  NativeSettingsToggleArt,
} from './NativeSettingsPresentation.tsx'
import '../main-menu.css'

interface NativeUiSettingsPanelProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'children' | 'title'
> {
  readonly children: ReactNode
  readonly contentRef?: Ref<HTMLDivElement>
  readonly footerBack?: boolean
  readonly footerLabel: string
  readonly onFooter: () => void
  readonly title: string
}

/** Exact stock Settings shell; callers retain page state and setting behavior. */
export function NativeUiSettingsPanel({
  children,
  className,
  contentRef,
  footerBack = false,
  footerLabel,
  onFooter,
  style,
  title,
  ...sectionProps
}: NativeUiSettingsPanelProps) {
  const titleId = useId()
  return (
    <div className="game-settings-backdrop" data-native-ui-settings role="presentation">
      <section
        {...sectionProps}
        aria-labelledby={titleId}
        aria-modal="true"
        className={['game-settings-dialog', className].filter(Boolean).join(' ')}
        role="dialog"
        style={{
          '--settings-control-panel-atlas': `url("${NATIVE_UI_ATLAS_SOURCES.ControlPanel}")`,
          '--settings-ui-atlas': `url("${NATIVE_UI_ATLAS_SOURCES.UI}")`,
          ...style,
        } as CSSProperties}
      >
        <NativeSettingsPanelArt />
        <header className="game-settings-header">
          <h2 id={titleId}>
            <span className="sr-only native-ui-sr-only">{title}</span>
            <NativeSettingsText align="center" scale={1.75} text={title} tint={0xd9bd72} />
          </h2>
        </header>
        <div className="game-settings-content" ref={contentRef}>
          {children}
        </div>
        <button
          className="game-settings-close"
          data-game-back={footerBack || undefined}
          onClick={onFooter}
          type="button"
        >
          <span className="sr-only native-ui-sr-only">{footerLabel}</span>
          <NativeSettingsText
            align="center"
            scale={1.15}
            text={footerLabel}
            tint={0xf2f0dc}
          />
        </button>
      </section>
    </div>
  )
}

export function NativeUiSettingsGroup({
  children,
  title,
}: {
  readonly children: ReactNode
  readonly title: string
}) {
  return (
    <section className="game-settings-group" aria-label={title}>
      <h3>
        <span className="sr-only native-ui-sr-only">{title}</span>
        <NativeSettingsText scale={1.05} text={title} tint={0xa99258} />
      </h3>
      <div>{children}</div>
    </section>
  )
}

interface NativeUiSettingsActionProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  readonly label: string
}

export function NativeUiSettingsAction({
  autoFocus,
  className,
  label,
  type = 'button',
  ...buttonProps
}: NativeUiSettingsActionProps) {
  return (
    <button
      {...buttonProps}
      aria-label={buttonProps['aria-label'] ?? label}
      autoFocus={autoFocus}
      className={['game-settings-action', className].filter(Boolean).join(' ')}
      data-game-default-focus={autoFocus ? 'true' : undefined}
      type={type}
    >
      <NativeSettingsRowPlate className="game-settings-row-plate" />
      <span className="game-settings-native-label">
        <span className="sr-only native-ui-sr-only">{label}</span>
        <NativeSettingsText scale={1.15} text={label} />
      </span>
      <NativeSettingsActionArrow />
    </button>
  )
}

interface NativeUiSettingsToggleProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'onChange'
> {
  readonly checked: boolean
  readonly label: string
  readonly nested?: boolean
  readonly onChange: (checked: boolean) => void
}

export function NativeUiSettingsToggle({
  autoFocus,
  checked,
  className,
  disabled,
  label,
  nested = false,
  onChange,
  type = 'button',
  ...buttonProps
}: NativeUiSettingsToggleProps) {
  return (
    <button
      {...buttonProps}
      aria-label={buttonProps['aria-label'] ?? label}
      aria-pressed={checked}
      autoFocus={autoFocus}
      className={['game-settings-native-toggle-row', className].filter(Boolean).join(' ')}
      data-game-default-focus={autoFocus ? 'true' : undefined}
      data-settings-nested={nested || undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      type={type}
    >
      <NativeSettingsRowPlate className="game-settings-row-plate" />
      <span className="game-settings-native-label">
        <span className="sr-only native-ui-sr-only">{label}</span>
        <NativeSettingsText scale={nested ? 1 : 1.15} text={label} />
      </span>
      <NativeSettingsToggleArt enabled={checked} />
    </button>
  )
}

interface NativeUiSettingsRangeProps {
  readonly autoFocus?: boolean
  readonly disabled?: boolean
  readonly label: string
  readonly maximum: number
  readonly minimum: number
  readonly onChange: (value: number) => void
  readonly value: number
}

export function NativeUiSettingsRange({
  autoFocus = false,
  disabled = false,
  label,
  maximum,
  minimum,
  onChange,
  value,
}: NativeUiSettingsRangeProps) {
  return (
    <label
      className="game-settings-range"
      style={{
        '--settings-control-panel-atlas': `url("${NATIVE_UI_ATLAS_SOURCES.ControlPanel}")`,
      } as CSSProperties}
    >
      <NativeSettingsRowPlate className="game-settings-row-plate" />
      <span className="game-settings-native-label">
        <span className="sr-only native-ui-sr-only">{label}</span>
        <NativeSettingsText scale={1.15} text={label} />
      </span>
      <div className="game-settings-range-control">
        <NativeSettingsRangeTrack />
        <input
          aria-valuetext={`${value}%`}
          autoFocus={autoFocus}
          data-game-default-focus={autoFocus ? 'true' : undefined}
          disabled={disabled}
          max={maximum}
          min={minimum}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
          step={1}
          type="range"
          value={value}
        />
        <output>
          <span className="sr-only native-ui-sr-only">{value}%</span>
          <NativeSettingsText
            align="right"
            scale={0.9}
            text={`${value}%`}
            tint={0xf0d996}
            width={48}
          />
        </output>
      </div>
    </label>
  )
}

interface NativeUiSettingsBindingProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  readonly label: string
  readonly value: string
}

export function NativeUiSettingsBinding({
  className,
  label,
  type = 'button',
  value,
  ...buttonProps
}: NativeUiSettingsBindingProps) {
  return (
    <button
      {...buttonProps}
      aria-label={buttonProps['aria-label'] ?? `${label}, ${value}`}
      className={['game-settings-binding', className].filter(Boolean).join(' ')}
      type={type}
    >
      <NativeSettingsRowPlate className="game-settings-row-plate" />
      <span className="game-settings-native-label">
        <span className="sr-only native-ui-sr-only">{label}</span>
        <NativeSettingsText scale={1.15} text={label} />
      </span>
      <strong>
        <NativeSettingsBindingPlate />
        <span className="sr-only native-ui-sr-only">{value}</span>
        <NativeSettingsText
          align="center"
          scale={1.05}
          text={value}
          tint={0xd9bd72}
          width={200}
        />
      </strong>
    </button>
  )
}

interface NativeUiSettingsValueActionProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  readonly label: string
  readonly value: string
}

export function NativeUiSettingsValueAction({
  className,
  label,
  type = 'button',
  value,
  ...buttonProps
}: NativeUiSettingsValueActionProps) {
  return (
    <button
      {...buttonProps}
      aria-label={buttonProps['aria-label'] ?? `${label}, ${value}`}
      className={['game-settings-native-toggle-row', className].filter(Boolean).join(' ')}
      type={type}
    >
      <NativeSettingsRowPlate className="game-settings-row-plate" />
      <span className="game-settings-native-label">
        <span className="sr-only native-ui-sr-only">{label}</span>
        <NativeSettingsText scale={1.15} text={label} />
      </span>
      <strong>
        <span className="sr-only native-ui-sr-only">{value}</span>
        <NativeSettingsText align="right" scale={1.05} text={value} tint={0xd9bd72} width={82} />
      </strong>
    </button>
  )
}

export function NativeUiSettingsStaticRow({
  detail,
  label,
}: {
  readonly detail?: ReactNode
  readonly label: string
}) {
  return (
    <p className="game-settings-fixed-policy">
      <NativeSettingsRowPlate className="game-settings-row-plate" />
      <span className="game-settings-native-label">
        <span className="sr-only native-ui-sr-only">{label}</span>
        <NativeSettingsText scale={1.15} text={label} />
      </span>
      {detail === undefined ? null : <small>{detail}</small>}
    </p>
  )
}

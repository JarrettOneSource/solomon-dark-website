import type { CSSProperties } from 'react'

import NativeUiText from './NativeUiText.tsx'
import NativeUiPlanView from './NativeUiPlanView.tsx'
import NativeUiSprite from './NativeUiSprite.tsx'
import NativeUiStrip from './NativeUiStrip.tsx'
import { NATIVE_SETTINGS_PRESENTATION } from './native-settings-contract.ts'
import { nativeUiPlan } from './native-ui-plan.ts'

interface NativeSettingsTextProps {
  readonly align?: 'center' | 'left' | 'right'
  readonly className?: string
  readonly scale?: number
  readonly style?: CSSProperties
  readonly text: string
  readonly tint?: number
  readonly width?: number
}

export function NativeSettingsText({
  align = 'left',
  className,
  scale = 1,
  style,
  text,
  tint = 0xdbc174,
  width,
}: NativeSettingsTextProps) {
  return (
    <NativeUiText
      align={align}
      className={className}
      font={NATIVE_SETTINGS_PRESENTATION.font}
      scale={scale}
      style={style}
      text={text}
      tint={tint}
      width={width}
    />
  )
}

export function NativeSettingsPanelArt() {
  const { frameCorner, frameFlourish } = NATIVE_SETTINGS_PRESENTATION.records
  return (
    <div aria-hidden className="game-settings-native-art native-settings-panel-art">
      <NativeUiSprite atlas={frameCorner.atlas} className="game-settings-frame-corner top-left" record={frameCorner.record} style={{ position: 'absolute' }} />
      <NativeUiSprite atlas={frameCorner.atlas} className="game-settings-frame-corner top-right" record={frameCorner.record} style={{ position: 'absolute' }} />
      <NativeUiSprite atlas={frameCorner.atlas} className="game-settings-frame-corner bottom-left" record={frameCorner.record} style={{ position: 'absolute' }} />
      <NativeUiSprite atlas={frameCorner.atlas} className="game-settings-frame-corner bottom-right" record={frameCorner.record} style={{ position: 'absolute' }} />
      <NativeUiSprite atlas={frameFlourish.atlas} className="game-settings-frame-flourish left" record={frameFlourish.record} style={{ position: 'absolute' }} />
      <NativeUiSprite atlas={frameFlourish.atlas} className="game-settings-frame-flourish right" record={frameFlourish.record} style={{ position: 'absolute' }} />
    </div>
  )
}

export function NativeSettingsRowPlate({
  className,
}: {
  readonly className?: string
}) {
  const { contentWidth, rowHeight } = NATIVE_SETTINGS_PRESENTATION.panel
  const { atlas, record } = NATIVE_SETTINGS_PRESENTATION.records.rowPlate
  const plan = nativeUiPlan(contentWidth, rowHeight, {
    actions: [],
    nodes: [{
      atlas,
      height: rowHeight,
      kind: 'sprite',
      record,
      width: contentWidth,
      x: 0,
      y: 0,
    }],
  })
  return <NativeUiPlanView className={className} plan={plan} />
}

export function NativeSettingsToggleArt({
  enabled,
}: {
  readonly enabled: boolean
}) {
  const source = enabled
    ? NATIVE_SETTINGS_PRESENTATION.records.toggleOn
    : NATIVE_SETTINGS_PRESENTATION.records.toggleOff
  return (
    <NativeUiSprite
      atlas={source.atlas}
      className="game-settings-native-toggle"
      record={source.record}
    />
  )
}

export function NativeSettingsRangeTrack() {
  const source = NATIVE_SETTINGS_PRESENTATION.records.sliderTrack
  return (
    <NativeUiStrip
      atlas={source.atlas}
      className="game-settings-native-range-track"
      record={source.record}
    />
  )
}

export function NativeSettingsActionArrow() {
  const source = NATIVE_SETTINGS_PRESENTATION.records.actionArrow
  return (
    <NativeUiSprite
      atlas={source.atlas}
      className="game-settings-action-arrow"
      record={source.record}
    />
  )
}

export function NativeSettingsBindingPlate() {
  const { atlas, record } = NATIVE_SETTINGS_PRESENTATION.records.bindingPlate
  const plan = nativeUiPlan(200, 30, {
    actions: [],
    nodes: [{ atlas, height: 30, kind: 'sprite', record, width: 200, x: 0, y: 0 }],
  })
  return <NativeUiPlanView className="game-settings-binding-plate" plan={plan} />
}

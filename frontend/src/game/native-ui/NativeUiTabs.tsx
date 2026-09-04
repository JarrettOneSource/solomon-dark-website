import type { CSSProperties } from 'react'

import NativeUiPlanView from './NativeUiPlanView.tsx'
import {
  planNativeUiTabs,
  type NativeUiRect,
} from './native-ui-plan.ts'
import './native-ui.css'

export interface NativeUiTab {
  readonly bounds: NativeUiRect
  readonly disabled?: boolean
  readonly id: string
  readonly label: string
  readonly labelBaselineY?: number
  readonly labelScale?: number
  readonly labelTint?: number
  readonly selectedLabel?: string
  readonly selectedLabelTint?: number
}

interface NativeUiTabsProps {
  readonly ariaLabel: string
  readonly className?: string
  readonly height: number
  readonly onSelect: (id: string) => void
  readonly selectedId: string
  readonly style?: CSSProperties
  readonly tabs: readonly NativeUiTab[]
  readonly width: number
}

/** Semantic tablist backed by the exact shared stock Tabs plan. */
export default function NativeUiTabs({
  ariaLabel,
  className,
  height,
  onSelect,
  selectedId,
  style,
  tabs,
  width,
}: NativeUiTabsProps) {
  const plan = planNativeUiTabs({ height, selectedId, tabs, width })
  return (
    <div
      aria-label={ariaLabel}
      className={['native-ui-tabs', className].filter(Boolean).join(' ')}
      data-native-ui-tabs
      role="tablist"
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
        const tab = tabs[index]!
        const selected = tab.id === selectedId
        return (
          <button
            aria-label={tab.label}
            aria-current={selected ? 'page' : undefined}
            aria-selected={selected}
            className="native-ui-tabs-action"
            data-native-ui-tab={tab.id}
            disabled={tab.disabled}
            key={tab.id}
            onClick={() => {
              if (!tab.disabled) onSelect(tab.id)
            }}
            role="tab"
            style={{
              height: action.bounds.height,
              left: action.bounds.left,
              top: action.bounds.top,
              width: action.bounds.width,
            }}
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            <span className="native-ui-sr-only">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

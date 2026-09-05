import { planNativeUiTabs, type NativeUiTab } from './native-ui-tabs.ts'
import type { CSSProperties } from 'react'

import NativeUiPlanView from './NativeUiPlanView.tsx'
import './native-ui.css'

interface NativeUiTabsProps {
  readonly ariaLabel: string
  readonly className?: string
  readonly height: number
  readonly onSelect: (id: string) => void
  readonly selectedId: string
  readonly scale?: number
  readonly style?: CSSProperties
  readonly tabs: readonly NativeUiTab[]
  readonly tint?: number
  readonly width: number
}

/** Semantic tablist backed by the exact shared stock Tabs plan. */
export default function NativeUiTabs({
  ariaLabel,
  className,
  height,
  onSelect,
  selectedId,
  scale,
  style,
  tabs,
  tint,
  width,
}: NativeUiTabsProps) {
  const plan = planNativeUiTabs({ height, scale, selectedId, tabs, tint, width })
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

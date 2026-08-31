import {
  useMemo,
  useState,
  type CSSProperties,
} from 'react'

import NativeUiPlanView from './NativeUiPlanView.tsx'
import {
  planNativeUiBoastMenu,
  type NativeUiBoastMenuRow,
} from './native-ui-boast-menu.ts'
import './native-ui.css'

export interface NativeUiBoastMenuCustomIcon {
  readonly frame: Readonly<{
    centerOffsetX: number
    centerOffsetY: number
    height: number
    logicalHeight: number
    logicalWidth: number
    width: number
    x: number
    y: number
  }>
  readonly imageHeight: number
  readonly imageUrl: string
  readonly imageWidth: number
}

export interface NativeUiBoastMenuItem extends NativeUiBoastMenuRow {
  readonly customIcon?: NativeUiBoastMenuCustomIcon
}

export interface NativeUiBoastMenuProps {
  readonly height?: number
  readonly items: readonly NativeUiBoastMenuItem[]
  readonly onDone: () => void
  readonly onPageChange?: (pageIndex: number) => void
  readonly onSelect: (id: string) => void
  readonly pageCount?: number
  readonly pageIndex?: number
  readonly selectedId?: string | null
  readonly width?: number
}

/** Semantic DOM adapter for the stock BoastBox plan. */
export default function NativeUiBoastMenu({
  height = 900,
  items,
  onDone,
  onPageChange,
  onSelect,
  pageCount = 1,
  pageIndex = 0,
  selectedId = null,
  width = 1600,
}: NativeUiBoastMenuProps) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const plan = useMemo(() => planNativeUiBoastMenu({
    height,
    pageCount,
    pageIndex,
    rows: items.map(item => ({
      ...item,
      state: item.id === (highlightedId ?? selectedId) ? 'selected' : 'idle',
    })),
    width,
  }), [height, highlightedId, items, pageCount, pageIndex, selectedId, width])
  const byId = new Map(items.map(item => [item.id, item]))

  return (
    <section
      aria-label="Select a Boast"
      className="native-ui-boast-menu"
      data-native-ui-boast-menu
      style={{ height, width }}
    >
      <NativeUiPlanView plan={{ ...plan, height, width }} />
      {plan.customIcons.flatMap((placement) => {
        const icon = byId.get(placement.id)?.customIcon
        if (!icon) return []
        return [
          <CustomIcon icon={icon} key={`${placement.id}:left`} placement="left" selected={placement.selected} x={placement.leftEdgeX} y={placement.y} />,
          <CustomIcon icon={icon} key={`${placement.id}:right`} placement="right" selected={placement.selected} x={placement.rightEdgeX} y={placement.y} />,
        ]
      })}
      {plan.actions.map(action => (
        <button
          aria-label={actionLabel(action.id, byId)}
          data-game-back={action.id === 'done' || undefined}
          data-native-ui-boast-action={action.id}
          key={action.id}
          onBlur={() => setHighlightedId(current => current === action.id ? null : current)}
          onClick={() => {
            if (action.id === 'done') onDone()
            else if (action.id === 'previous') onPageChange?.(pageIndex - 1)
            else if (action.id === 'next') onPageChange?.(pageIndex + 1)
            else onSelect(action.id)
          }}
          onFocus={() => {
            if (byId.has(action.id)) setHighlightedId(action.id)
          }}
          onPointerEnter={() => {
            if (byId.has(action.id)) setHighlightedId(action.id)
          }}
          onPointerLeave={() => setHighlightedId(current => current === action.id ? null : current)}
          style={rectStyle(action.bounds)}
          type="button"
        >
          <span className="native-ui-sr-only">{actionLabel(action.id, byId)}</span>
        </button>
      ))}
    </section>
  )
}

function CustomIcon({
  icon,
  placement,
  selected,
  x,
  y,
}: Readonly<{
  icon: NativeUiBoastMenuCustomIcon
  placement: 'left' | 'right'
  selected: boolean
  x: number
  y: number
}>) {
  const frame = icon.frame
  const trimLeft = (frame.logicalWidth - frame.width) / 2 + frame.centerOffsetX
  const trimTop = (frame.logicalHeight - frame.height) / 2 + frame.centerOffsetY
  const logicalLeft = placement === 'left' ? x : x - frame.logicalWidth
  return (
    <span
      aria-hidden
      className="native-ui-boast-custom-icon"
      style={{
        height: frame.logicalHeight,
        left: logicalLeft,
        top: y - frame.logicalHeight / 2,
        transform: placement === 'right' ? 'scaleX(-1)' : undefined,
        width: frame.logicalWidth,
      }}
    >
      <i style={{
        backgroundColor: selected ? '#9feb9f' : undefined,
        backgroundImage: selected ? undefined : `url(${JSON.stringify(icon.imageUrl)})`,
        backgroundPosition: `${-frame.x}px ${-frame.y}px`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${icon.imageWidth}px ${icon.imageHeight}px`,
        height: frame.height,
        left: trimLeft,
        maskImage: selected ? `url(${JSON.stringify(icon.imageUrl)})` : undefined,
        maskPosition: selected ? `${-frame.x}px ${-frame.y}px` : undefined,
        maskRepeat: selected ? 'no-repeat' : undefined,
        maskSize: selected ? `${icon.imageWidth}px ${icon.imageHeight}px` : undefined,
        position: 'absolute',
        top: trimTop,
        width: frame.width,
        WebkitMaskImage: selected ? `url(${JSON.stringify(icon.imageUrl)})` : undefined,
        WebkitMaskPosition: selected ? `${-frame.x}px ${-frame.y}px` : undefined,
        WebkitMaskRepeat: selected ? 'no-repeat' : undefined,
        WebkitMaskSize: selected ? `${icon.imageWidth}px ${icon.imageHeight}px` : undefined,
      }} />
    </span>
  )
}

function actionLabel(
  id: string,
  items: ReadonlyMap<string, NativeUiBoastMenuItem>,
): string {
  if (id === 'done') return 'Done'
  if (id === 'previous') return 'Previous Boasts'
  if (id === 'next') return 'More Boasts'
  const item = items.get(id)
  return item ? `${item.label}. ${item.detail}` : id
}

function rectStyle(bounds: Readonly<{
  height: number
  left: number
  top: number
  width: number
}>): CSSProperties {
  return {
    height: bounds.height,
    left: bounds.left,
    position: 'absolute',
    top: bounds.top,
    width: bounds.width,
  }
}

import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react'

import NativeUiPlanView from './NativeUiPlanView.tsx'
import {
  planNativeUiBoastMenu,
  type NativeUiBoastMenuRow,
} from './native-ui-boast-menu.ts'
import {
  NATIVE_UI_SWIPE_BOX,
  clampNativeUiSwipeBoxOffset,
  dragNativeUiSwipeBoxOffset,
} from './native-ui-swipe-box.ts'
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
  readonly onScrollChange?: (scrollY: number) => void
  readonly onSelect: (id: string) => void
  readonly scrollY?: number
  readonly selectedId?: string | null
  readonly width?: number
}

/** Semantic DOM adapter for the stock BoastBox plan. */
export default function NativeUiBoastMenu({
  height = 900,
  items,
  onDone,
  onScrollChange,
  onSelect,
  scrollY: controlledScrollY,
  selectedId = null,
  width = 1600,
}: NativeUiBoastMenuProps) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [localScrollY, setLocalScrollY] = useState(0)
  const dragRef = useRef<{
    moved: boolean
    pointerId: number
    pointerY: number
    scrollY: number
    startedY: number
  } | null>(null)
  const suppressClickRef = useRef(false)
  const requestedScrollY = controlledScrollY ?? localScrollY
  const plan = useMemo(() => planNativeUiBoastMenu({
    height,
    rows: items.map(item => ({
      ...item,
      state: item.id === (highlightedId ?? selectedId) ? 'selected' : 'idle',
    })),
    scrollY: requestedScrollY,
    width,
  }), [height, highlightedId, items, requestedScrollY, selectedId, width])
  const byId = new Map(items.map(item => [item.id, item]))
  const updateScrollY = (next: number) => {
    const clamped = clampNativeUiSwipeBoxOffset(
      next,
      plan.contentHeight,
      plan.viewportBounds.height,
    )
    if (controlledScrollY === undefined) setLocalScrollY(clamped)
    onScrollChange?.(clamped)
  }

  const beginDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const point = stagePoint(event, width, height)
    if (!contains(plan.viewportBounds, point.x, point.y)) return
    dragRef.current = {
      moved: false,
      pointerId: event.pointerId,
      pointerY: point.y,
      scrollY: plan.scrollY,
      startedY: point.y,
    }
  }
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const pointerY = stagePoint(event, width, height).y
    const next = dragNativeUiSwipeBoxOffset(
      drag.scrollY,
      drag.pointerY,
      pointerY,
      plan.contentHeight,
      plan.viewportBounds.height,
    )
    if (!drag.moved && Math.abs(pointerY - drag.startedY) >= 3) {
      drag.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    drag.pointerY = pointerY
    drag.scrollY = next
    if (drag.moved) {
      event.preventDefault()
      setHighlightedId(null)
      updateScrollY(next)
    }
  }
  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    suppressClickRef.current = drag.moved
    if (drag.moved) window.setTimeout(() => { suppressClickRef.current = false }, 0)
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
  const wheel = (event: ReactWheelEvent<HTMLElement>) => {
    const point = stagePoint(event, width, height)
    if (!contains(plan.viewportBounds, point.x, point.y) || event.deltaY === 0) return
    const next = clampNativeUiSwipeBoxOffset(
      plan.scrollY + Math.sign(event.deltaY) * NATIVE_UI_SWIPE_BOX.wheelStep,
      plan.contentHeight,
      plan.viewportBounds.height,
    )
    if (next === plan.scrollY) return
    event.preventDefault()
    setHighlightedId(null)
    updateScrollY(next)
  }
  const keyScroll = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const delta = event.key === 'ArrowUp'
      ? -NATIVE_UI_SWIPE_BOX.wheelStep
      : event.key === 'ArrowDown'
        ? NATIVE_UI_SWIPE_BOX.wheelStep
        : event.key === 'PageUp'
          ? -plan.viewportBounds.height
          : event.key === 'PageDown'
            ? plan.viewportBounds.height
            : 0
    if (delta === 0) return
    event.preventDefault()
    setHighlightedId(null)
    updateScrollY(plan.scrollY + delta)
  }

  return (
    <section
      aria-label="Select a Boast"
      className="native-ui-boast-menu"
      data-native-ui-boast-menu
      data-native-ui-boast-scroll-max={plan.maximumScrollY}
      data-native-ui-boast-scroll-y={plan.scrollY}
      onLostPointerCapture={() => { dragRef.current = null }}
      onPointerCancel={endDrag}
      onPointerDownCapture={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onWheel={wheel}
      style={{ height, width }}
    >
      <NativeUiPlanView plan={{ ...plan, height, width }} />
      <CustomIconViewport bounds={plan.viewportBounds}>
        {plan.customIcons.flatMap((placement) => {
          const icon = byId.get(placement.id)?.customIcon
          if (!icon) return []
          return [
            <CustomIcon icon={icon} key={`${placement.id}:left`} placement="left" selected={placement.selected} x={placement.leftEdgeX} y={placement.y} />,
            <CustomIcon icon={icon} key={`${placement.id}:right`} placement="right" selected={placement.selected} x={placement.rightEdgeX} y={placement.y} />,
          ]
        })}
      </CustomIconViewport>
      {plan.actions.map(action => (
        <button
          aria-label={actionLabel(action.id, byId)}
          aria-pressed={byId.has(action.id) ? action.id === selectedId : undefined}
          data-game-back={action.id === 'done' || undefined}
          data-native-ui-boast-action={action.id}
          key={action.id}
          onBlur={() => setHighlightedId(current => current === action.id ? null : current)}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false
              return
            }
            if (action.id === 'done') onDone()
            else onSelect(action.id)
          }}
          onFocus={() => {
            if (byId.has(action.id)) setHighlightedId(action.id)
          }}
          onKeyDown={byId.has(action.id) ? keyScroll : undefined}
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

function CustomIconViewport({
  bounds,
  children,
}: Readonly<{
  bounds: Readonly<{ height: number; left: number; top: number; width: number }>
  children: ReactNode
}>) {
  return (
    <span
      aria-hidden
      className="native-ui-boast-custom-icon-viewport"
      style={{
        height: bounds.height,
        left: bounds.left,
        overflow: 'hidden',
        position: 'absolute',
        top: bounds.top,
        width: bounds.width,
      }}
    >
      <span style={{
        height: bounds.height,
        left: -bounds.left,
        position: 'absolute',
        top: -bounds.top,
        width: bounds.width,
      }}>
        {children}
      </span>
    </span>
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
  const item = items.get(id)
  return item ? `${item.label}. ${item.detail}` : id
}

function stagePoint(
  event: ReactPointerEvent<HTMLElement> | ReactWheelEvent<HTMLElement>,
  width: number,
  height: number,
): Readonly<{ x: number; y: number }> {
  const bounds = event.currentTarget.getBoundingClientRect()
  return {
    x: (event.clientX - bounds.left) * width / bounds.width,
    y: (event.clientY - bounds.top) * height / bounds.height,
  }
}

function contains(
  bounds: Readonly<{ height: number; left: number; top: number; width: number }>,
  x: number,
  y: number,
): boolean {
  return x >= bounds.left && x <= bounds.left + bounds.width
    && y >= bounds.top && y <= bounds.top + bounds.height
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

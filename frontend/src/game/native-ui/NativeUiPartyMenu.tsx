import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'

import NativeUiPlanView from './NativeUiPlanView.tsx'
import {
  NATIVE_UI_PARTY_MENU_TABS,
  NATIVE_UI_PARTY_MENU_TAB_LABELS,
  isNativeUiPartyMenuTabId,
  parseNativeUiPartyMenuAction,
  planNativeUiPartyMenu,
  type NativeUiPartyMenuMember,
  type NativeUiPartyMenuRequest,
  type NativeUiPartyMenuTabId,
  type NativeUiPartyMenuVisibilityOption,
} from './native-ui-party-menu.ts'
import type { NativeUiActionRegion, NativeUiRect } from './native-ui-plan.ts'
import {
  NATIVE_UI_SWIPE_BOX,
  clampNativeUiSwipeBoxOffset,
  dragNativeUiSwipeBoxOffset,
} from './native-ui-swipe-box.ts'
import './native-ui.css'

export interface NativeUiPartyMenuProps {
  readonly className?: string
  readonly code: string | null
  /** Swaps the COPY label for COPIED while the clipboard write is fresh. */
  readonly copied?: boolean
  /** Curtain alpha behind the frame; pass 0 when the host stage dims the scene itself. */
  readonly curtainAlpha?: number
  readonly error?: string | null
  readonly height?: number
  /** Tab shown when the menu mounts; ignored while `selectedTab` controls it. */
  readonly initialTab?: NativeUiPartyMenuTabId
  readonly leader: boolean
  readonly leaveLabel?: string | null
  readonly members: readonly NativeUiPartyMenuMember[]
  readonly onAcceptRequest?: (requestId: string) => void
  readonly onClose: () => void
  readonly onCopyCode?: () => void
  readonly onDenyRequest?: (requestId: string) => void
  readonly onGenerateCode?: () => void
  readonly onKick?: (memberId: string) => void
  readonly onLeave?: () => void
  readonly onSelectTab?: (tab: NativeUiPartyMenuTabId) => void
  readonly onVisibility?: (visibilityId: string) => void
  readonly requests?: readonly NativeUiPartyMenuRequest[]
  /** Controlled tab; omit to let the menu track its own. */
  readonly selectedTab?: NativeUiPartyMenuTabId
  readonly style?: CSSProperties
  readonly title?: string
  readonly visibility: string
  readonly visibilityOptions: readonly NativeUiPartyMenuVisibilityOption[]
  readonly width?: number
}

interface Drag {
  moved: boolean
  pointerId: number
  pointerY: number
  scrollY: number
  startedY: number
}

const NO_REQUESTS: readonly NativeUiPartyMenuRequest[] = []

/** Semantic DOM adapter for the stock party menu plan. */
export default function NativeUiPartyMenu({
  className,
  code,
  copied = false,
  curtainAlpha,
  error = null,
  height = 900,
  initialTab,
  leader,
  leaveLabel = null,
  members,
  onAcceptRequest,
  onClose,
  onCopyCode,
  onDenyRequest,
  onGenerateCode,
  onKick,
  onLeave,
  onSelectTab,
  onVisibility,
  requests = NO_REQUESTS,
  selectedTab: controlledTab,
  style,
  title = 'PARTY',
  visibility,
  visibilityOptions,
  width = 1600,
}: NativeUiPartyMenuProps) {
  const [localTab, setLocalTab] = useState<NativeUiPartyMenuTabId>(initialTab ?? 'members')
  const selectedTab = controlledTab ?? localTab
  const [requestedScrollY, setRequestedScrollY] = useState(0)
  const [pressedId, setPressedId] = useState<string | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const suppressClickRef = useRef(false)
  const tablistRef = useRef<HTMLDivElement>(null)
  const radiogroupRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const plan = useMemo(() => planNativeUiPartyMenu({
    code,
    copyLabel: copied ? 'COPIED' : 'COPY',
    curtainAlpha,
    error,
    height,
    leader,
    leaveLabel,
    members,
    pressedId,
    requests,
    scrollY: requestedScrollY,
    selectedTab,
    title,
    visibility,
    visibilityOptions,
    width,
  }), [
    code,
    copied,
    curtainAlpha,
    error,
    height,
    leader,
    leaveLabel,
    members,
    pressedId,
    requestedScrollY,
    requests,
    selectedTab,
    title,
    visibility,
    visibilityOptions,
    width,
  ])

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
  }, [])

  const rowNames = useMemo(() => new Map<string, string>([
    ...requests.map(request => [`request:${request.id}`, request.name] as const),
    ...members.map(member => [`member:${member.id}`, member.name] as const),
  ]), [members, requests])
  const rowActionIds = new Set(plan.rowActions.map(action => action.id))
  const tabActions = plan.actions.filter(action => action.id.startsWith('tab:'))
  const visibilityActions = plan.actions.filter(action => action.id.startsWith('visibility:'))
  const looseActions = plan.actions.filter(action => (
    !rowActionIds.has(action.id)
    && !action.id.startsWith('tab:')
    && !action.id.startsWith('visibility:')
  ))
  const tabStrip = unionBounds(tabActions.map(action => action.bounds))
  const visibilityStrip = unionBounds(visibilityActions.map(action => action.bounds))

  const updateScrollY = (next: number) => {
    setRequestedScrollY(clampNativeUiSwipeBoxOffset(
      next,
      plan.contentHeight,
      plan.viewportBounds.height,
    ))
  }
  const selectTab = (tab: NativeUiPartyMenuTabId) => {
    setPressedId(null)
    if (controlledTab === undefined) setLocalTab(tab)
    onSelectTab?.(tab)
  }
  const activate = (id: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    const action = parseNativeUiPartyMenuAction(id)
    if (!action) return
    switch (action.kind) {
      case 'accept': onAcceptRequest?.(action.target); break
      case 'close': onClose(); break
      case 'copy': onCopyCode?.(); break
      case 'deny': onDenyRequest?.(action.target); break
      case 'generate': onGenerateCode?.(); break
      case 'kick': onKick?.(action.target); break
      case 'leave': onLeave?.(); break
      case 'tab':
        if (isNativeUiPartyMenuTabId(action.target)) selectTab(action.target)
        break
      case 'visibility': onVisibility?.(action.target); break
    }
  }
  const release = (id: string) => {
    setPressedId(current => (current === id ? null : current))
  }
  const pressHandlers = (id: string) => ({
    onBlur: () => release(id),
    onKeyUp: () => release(id),
    onPointerCancel: () => release(id),
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button === 0) setPressedId(id)
    },
    onPointerLeave: () => release(id),
    onPointerUp: () => release(id),
  })
  const pressKey = (event: ReactKeyboardEvent<HTMLButtonElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') setPressedId(id)
  }
  const revealRow = (rowId: string) => {
    const row = plan.rows.find(candidate => candidate.id === rowId)
    if (!row) return
    const viewport = plan.viewportBounds
    const rowBottom = row.bounds.top + row.bounds.height
    const viewportBottom = viewport.top + viewport.height
    if (row.bounds.top < viewport.top) updateScrollY(plan.scrollY - (viewport.top - row.bounds.top))
    else if (rowBottom > viewportBottom) updateScrollY(plan.scrollY + (rowBottom - viewportBottom))
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
    updateScrollY(plan.scrollY + delta)
  }
  const stepTab = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (step === 0) return
    event.preventDefault()
    const index = NATIVE_UI_PARTY_MENU_TABS.indexOf(selectedTab)
    const count = NATIVE_UI_PARTY_MENU_TABS.length
    const next = NATIVE_UI_PARTY_MENU_TABS[(index + step + count) % count]!
    selectTab(next)
    tablistRef.current
      ?.querySelector<HTMLButtonElement>(`[data-native-ui-party-tab-action="${next}"]`)
      ?.focus({ preventScroll: true })
  }
  const stepVisibility = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
      ? -1
      : event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : 0
    if (step === 0 || visibilityOptions.length === 0) return
    event.preventDefault()
    const index = Math.max(0, visibilityOptions.findIndex(option => option.id === visibility))
    const count = visibilityOptions.length
    const next = visibilityOptions[(index + step + count) % count]!
    onVisibility?.(next.id)
    radiogroupRef.current
      ?.querySelector<HTMLButtonElement>(`[data-native-ui-party-visibility="${cssEscape(next.id)}"]`)
      ?.focus({ preventScroll: true })
  }

  const beginDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || selectedTab !== 'members') return
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
      setPressedId(null)
    }
    drag.pointerY = pointerY
    drag.scrollY = next
    if (drag.moved) {
      event.preventDefault()
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
    if (selectedTab !== 'members' || event.deltaY === 0) return
    const point = stagePoint(event, width, height)
    if (!contains(plan.viewportBounds, point.x, point.y)) return
    const next = clampNativeUiSwipeBoxOffset(
      plan.scrollY + Math.sign(event.deltaY) * NATIVE_UI_SWIPE_BOX.wheelStep,
      plan.contentHeight,
      plan.viewportBounds.height,
    )
    if (next === plan.scrollY) return
    event.preventDefault()
    updateScrollY(next)
  }
  const closeOutsideFrame = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const point = stagePoint(event, width, height)
    if (!contains(plan.frameBounds, point.x, point.y)) onClose()
  }
  const escape = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  const checkedIndex = Math.max(0, visibilityOptions.findIndex(option => option.id === visibility))

  return (
    <section
      aria-label={title}
      aria-modal="true"
      className={['native-ui-party-menu', className].filter(Boolean).join(' ')}
      data-native-ui-party-menu
      data-native-ui-party-scroll-max={plan.maximumScrollY}
      data-native-ui-party-scroll-y={plan.scrollY}
      data-native-ui-party-tab={selectedTab}
      onKeyDown={escape}
      onLostPointerCapture={() => { dragRef.current = null }}
      onPointerCancel={endDrag}
      onPointerDown={closeOutsideFrame}
      onPointerDownCapture={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onWheel={wheel}
      role="dialog"
      style={{ height, width, ...style }}
    >
      <NativeUiPlanView plan={plan} />
      {error ? <p className="native-ui-sr-only" role="alert">{error}</p> : null}
      {tabStrip ? (
        <div
          aria-label="Party menu sections"
          ref={tablistRef}
          role="tablist"
          style={rectStyle(tabStrip)}
        >
          {tabActions.map((action) => {
            const tab = parseNativeUiPartyMenuAction(action.id)?.target ?? ''
            const label = isNativeUiPartyMenuTabId(tab) ? NATIVE_UI_PARTY_MENU_TAB_LABELS[tab] : tab
            const selected = tab === selectedTab
            return (
              <button
                aria-label={label}
                aria-selected={selected}
                className="native-ui-party-menu-action"
                data-native-ui-party-tab-action={tab}
                key={action.id}
                onClick={() => activate(action.id)}
                onKeyDown={stepTab}
                role="tab"
                style={rectStyle(offsetBounds(action.bounds, tabStrip))}
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                <span className="native-ui-sr-only">{label}</span>
              </button>
            )
          })}
        </div>
      ) : null}
      {visibilityStrip ? (
        <div
          aria-label="Visibility"
          ref={radiogroupRef}
          role="radiogroup"
          style={rectStyle(visibilityStrip)}
        >
          {visibilityActions.map((action, index) => {
            const optionId = parseNativeUiPartyMenuAction(action.id)?.target ?? ''
            const option = visibilityOptions.find(candidate => candidate.id === optionId)
            const checked = optionId === visibility
            return (
              <button
                aria-checked={checked}
                aria-label={option?.label ?? optionId}
                className="native-ui-party-menu-action"
                data-native-ui-party-visibility={optionId}
                disabled={action.disabled}
                key={action.id}
                onClick={() => activate(action.id)}
                onKeyDown={stepVisibility}
                role="radio"
                style={rectStyle(offsetBounds(action.bounds, visibilityStrip))}
                tabIndex={index === checkedIndex ? 0 : -1}
                type="button"
              >
                <span className="native-ui-sr-only">{option?.label ?? optionId}</span>
              </button>
            )
          })}
        </div>
      ) : null}
      {selectedTab === 'members' ? (
        <div
          className="native-ui-party-menu-viewport"
          data-native-ui-party-viewport
          style={rectStyle(plan.viewportBounds)}
        >
          {plan.rowActions.map((action) => {
            const label = `${action.label} ${rowNames.get(action.rowId) ?? ''}`.trim()
            return (
              <button
                aria-label={label}
                className="native-ui-party-menu-action"
                data-native-ui-party-action={action.id}
                key={action.id}
                {...pressHandlers(action.id)}
                onClick={() => activate(action.id)}
                onFocus={() => revealRow(action.rowId)}
                onKeyDown={(event) => {
                  pressKey(event, action.id)
                  keyScroll(event)
                }}
                style={rectStyle(offsetBounds(action.bounds, plan.viewportBounds))}
                type="button"
              >
                <span className="native-ui-sr-only">{label}</span>
              </button>
            )
          })}
        </div>
      ) : null}
      {looseActions.map((action) => {
        const label = looseActionLabel(action, copied, leaveLabel)
        const close = action.id === 'close'
        return (
          <button
            aria-label={label}
            className="native-ui-party-menu-action"
            data-game-back={close || undefined}
            data-game-default-focus={close || undefined}
            data-native-ui-party-action={action.id}
            disabled={action.disabled}
            key={action.id}
            ref={close ? closeRef : undefined}
            {...pressHandlers(action.id)}
            onClick={() => activate(action.id)}
            onKeyDown={event => pressKey(event, action.id)}
            style={rectStyle(action.bounds)}
            type="button"
          >
            <span className="native-ui-sr-only">{label}</span>
          </button>
        )
      })}
    </section>
  )
}

function looseActionLabel(
  action: NativeUiActionRegion,
  copied: boolean,
  leaveLabel: string | null,
): string {
  switch (action.id) {
    case 'close': return 'Close'
    case 'copy': return copied ? 'Party ID copied' : 'Copy party ID'
    case 'generate': return 'Generate a new party ID'
    case 'leave': return leaveLabel ?? 'Leave'
    default: return action.id
  }
}

function unionBounds(rects: readonly NativeUiRect[]): NativeUiRect | null {
  if (rects.length === 0) return null
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const rect of rects) {
    left = Math.min(left, rect.left)
    top = Math.min(top, rect.top)
    right = Math.max(right, rect.left + rect.width)
    bottom = Math.max(bottom, rect.top + rect.height)
  }
  return { height: bottom - top, left, top, width: right - left }
}

function offsetBounds(bounds: NativeUiRect, origin: NativeUiRect): NativeUiRect {
  return {
    height: bounds.height,
    left: bounds.left - origin.left,
    top: bounds.top - origin.top,
    width: bounds.width,
  }
}

function stagePoint(
  event: ReactPointerEvent<HTMLElement> | ReactWheelEvent<HTMLElement>,
  width: number,
  height: number,
): Readonly<{ x: number; y: number }> {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: rect.width > 0 ? (event.clientX - rect.left) / rect.width * width : 0,
    y: rect.height > 0 ? (event.clientY - rect.top) / rect.height * height : 0,
  }
}

function contains(bounds: NativeUiRect, x: number, y: number): boolean {
  return x >= bounds.left
    && x < bounds.left + bounds.width
    && y >= bounds.top
    && y < bounds.top + bounds.height
}

function rectStyle(bounds: NativeUiRect): CSSProperties {
  return {
    height: bounds.height,
    left: bounds.left,
    position: 'absolute',
    top: bounds.top,
    width: bounds.width,
  }
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/["\\]/g, '\\$&')
}

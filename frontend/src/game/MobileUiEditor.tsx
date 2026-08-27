import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'

import { hub } from '../lib/assets.ts'
import {
  MOBILE_UI_ELEMENT_IDS,
  MOBILE_UI_ELEMENT_LABELS,
  MOBILE_UI_GRID_SIZE,
  MOBILE_UI_PAGE_ZOOM_MAX,
  MOBILE_UI_PAGE_ZOOM_MIN,
  MOBILE_UI_SCALE_MAX,
  MOBILE_UI_SCALE_MIN,
  constrainMobileUiTransform,
  defaultMobileUiGeometry,
  mobileUiElementPinchScale,
  mobileUiElementRotation,
  mobileUiLayoutWith,
  mobileUiPagePinchZoom,
  snapMobileUiPoint,
  type MobileUiElementId,
  type MobileUiElementTransform,
  type MobileUiLayout,
  type MobileUiPoint,
  type MobileUiSize,
} from './mobile-ui-layout.ts'

import './mobile-ui-editor.css'

interface MobileUiEditorProps {
  layout: MobileUiLayout
  onChange: (layout: MobileUiLayout) => void
  onReset: () => void
  page: MobileUiSize
  restoringDefault: boolean
  uiScale: number
}

type ElementInteraction = {
  readonly id: MobileUiElementId
  readonly initialDistance: number
  readonly initialScale: number
  readonly kind: 'pinch'
} | {
  readonly id: MobileUiElementId
  readonly initialPointer: MobileUiPoint
  readonly initialTransform: MobileUiElementTransform
  readonly kind: 'drag'
}

type HandleInteraction = {
  readonly center: MobileUiPoint
  readonly id: MobileUiElementId
  readonly initialAngle: number
  readonly initialRotation: number
  readonly kind: 'rotate'
  readonly pointerId: number
} | {
  readonly center: MobileUiPoint
  readonly id: MobileUiElementId
  readonly initialDistance: number
  readonly initialScale: number
  readonly kind: 'resize'
  readonly pointerId: number
}

type PageInteraction = {
  readonly initialClient: MobileUiPoint
  readonly initialScroll: MobileUiPoint
  readonly kind: 'pan'
} | {
  readonly anchor: MobileUiPoint
  readonly initialDistance: number
  readonly initialZoom: number
  readonly kind: 'pinch'
}

const RESIZE_HANDLES = Object.freeze([
  'north-west',
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
] as const)

export default function MobileUiEditor({
  layout,
  onChange,
  onReset,
  page,
  restoringDefault,
  uiScale,
}: MobileUiEditorProps) {
  const geometry = useMemo(
    () => defaultMobileUiGeometry(page.width, page.height, uiScale),
    [page.height, page.width, uiScale],
  )
  const [selected, setSelected] = useState<MobileUiElementId>('pause')
  const [snap, setSnap] = useState(true)
  const [zoom, setZoom] = useState(1)
  const viewportRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const elementRefs = useRef(new Map<MobileUiElementId, HTMLDivElement>())
  const elementPointers = useRef(new Map<number, MobileUiPoint>())
  const elementPointerOwner = useRef<MobileUiElementId | null>(null)
  const elementInteraction = useRef<ElementInteraction | null>(null)
  const handleInteraction = useRef<HandleInteraction | null>(null)
  const pagePointers = useRef(new Map<number, MobileUiPoint>())
  const pageInteraction = useRef<PageInteraction | null>(null)
  const zoomFrame = useRef<number | null>(null)

  const fitPage = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const next = clamp(
      Math.min(
        (viewport.clientWidth - 48) / page.width,
        (viewport.clientHeight - 48) / page.height,
        1,
      ),
      MOBILE_UI_PAGE_ZOOM_MIN,
      MOBILE_UI_PAGE_ZOOM_MAX,
    )
    setZoom(next)
    requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, (page.width * next + 48 - viewport.clientWidth) / 2)
      viewport.scrollTop = Math.max(0, (page.height * next + 48 - viewport.clientHeight) / 2)
    })
  }, [page.height, page.width])

  useLayoutEffect(() => {
    fitPage()
  }, [fitPage])

  useEffect(() => () => {
    if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current)
  }, [])

  const updateElement = useCallback((
    id: MobileUiElementId,
    transform: MobileUiElementTransform,
  ) => {
    onChange(mobileUiLayoutWith(
      layout,
      id,
      constrainMobileUiTransform(transform, geometry.sizes[id], page),
    ))
  }, [geometry.sizes, layout, onChange, page])

  const pagePoint = useCallback((clientX: number, clientY: number): MobileUiPoint => {
    const bounds = pageRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return { x: 50, y: 50 }
    return {
      x: (clientX - bounds.left) / bounds.width * 100,
      y: (clientY - bounds.top) / bounds.height * 100,
    }
  }, [])

  const beginElement = (
    id: MobileUiElementId,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (elementPointers.current.size > 0 && elementPointerOwner.current !== id) return
    event.preventDefault()
    event.stopPropagation()
    setSelected(id)
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    elementPointerOwner.current = id
    elementPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (elementPointers.current.size === 1) {
      elementInteraction.current = {
        id,
        initialPointer: pagePoint(event.clientX, event.clientY),
        initialTransform: layout[id],
        kind: 'drag',
      }
      return
    }
    if (elementPointers.current.size === 2) {
      const [first, second] = [...elementPointers.current.values()]
      elementInteraction.current = {
        id,
        initialDistance: distance(first, second),
        initialScale: layout[id].scale,
        kind: 'pinch',
      }
    }
  }

  const moveElement = (
    id: MobileUiElementId,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!elementPointers.current.has(event.pointerId)) return
    event.preventDefault()
    event.stopPropagation()
    elementPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const interaction = elementInteraction.current
    if (!interaction || interaction.id !== id) return
    if (interaction.kind === 'pinch') {
      if (elementPointers.current.size < 2) return
      const [first, second] = [...elementPointers.current.values()]
      updateElement(id, {
        ...layout[id],
        scale: snapScale(mobileUiElementPinchScale(
          interaction.initialScale,
          interaction.initialDistance,
          distance(first, second),
        ), snap),
      })
      return
    }
    const current = pagePoint(event.clientX, event.clientY)
    const moved = {
      x: interaction.initialTransform.x + current.x - interaction.initialPointer.x,
      y: interaction.initialTransform.y + current.y - interaction.initialPointer.y,
    }
    const position = snap ? snapMobileUiPoint(moved, page) : moved
    updateElement(id, { ...interaction.initialTransform, ...position })
  }

  const finishElement = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!elementPointers.current.has(event.pointerId)) return
    event.preventDefault()
    event.stopPropagation()
    elementPointers.current.delete(event.pointerId)
    if (elementPointers.current.size === 0) elementPointerOwner.current = null
    elementInteraction.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const beginHandle = (
    id: MobileUiElementId,
    kind: HandleInteraction['kind'],
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setSelected(id)
    const bounds = elementRefs.current.get(id)?.getBoundingClientRect()
    if (!bounds) return
    const center = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
    event.currentTarget.setPointerCapture(event.pointerId)
    if (kind === 'rotate') {
      handleInteraction.current = {
        center,
        id,
        initialAngle: angle(center, { x: event.clientX, y: event.clientY }),
        initialRotation: layout[id].rotation,
        kind,
        pointerId: event.pointerId,
      }
      return
    }
    handleInteraction.current = {
      center,
      id,
      initialDistance: Math.max(1, distance(center, { x: event.clientX, y: event.clientY })),
      initialScale: layout[id].scale,
      kind,
      pointerId: event.pointerId,
    }
  }

  const moveHandle = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const interaction = handleInteraction.current
    if (!interaction || interaction.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const current = { x: event.clientX, y: event.clientY }
    if (interaction.kind === 'rotate') {
      updateElement(interaction.id, {
        ...layout[interaction.id],
        rotation: mobileUiElementRotation(
          interaction.initialRotation,
          interaction.initialAngle,
          angle(interaction.center, current),
          snap,
        ),
      })
      return
    }
    updateElement(interaction.id, {
      ...layout[interaction.id],
      scale: snapScale(mobileUiElementPinchScale(
        interaction.initialScale,
        interaction.initialDistance,
        distance(interaction.center, current),
      ), snap),
    })
  }

  const finishHandle = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const interaction = handleInteraction.current
    if (!interaction || interaction.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    handleInteraction.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const zoomAt = useCallback((nextZoom: number, client: MobileUiPoint) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const bounds = viewport.getBoundingClientRect()
    const local = { x: client.x - bounds.left, y: client.y - bounds.top }
    const anchor = {
      x: (viewport.scrollLeft + local.x - 24) / zoom,
      y: (viewport.scrollTop + local.y - 24) / zoom,
    }
    const next = clamp(nextZoom, MOBILE_UI_PAGE_ZOOM_MIN, MOBILE_UI_PAGE_ZOOM_MAX)
    setZoom(next)
    if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current)
    zoomFrame.current = requestAnimationFrame(() => {
      viewport.scrollLeft = anchor.x * next + 24 - local.x
      viewport.scrollTop = anchor.y * next + 24 - local.y
      zoomFrame.current = null
    })
  }, [zoom])

  const beginPage = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('.mobile-ui-editor-element')) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    const viewport = viewportRef.current
    if (!viewport) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pagePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pagePointers.current.size === 1) {
      pageInteraction.current = {
        initialClient: { x: event.clientX, y: event.clientY },
        initialScroll: { x: viewport.scrollLeft, y: viewport.scrollTop },
        kind: 'pan',
      }
      return
    }
    if (pagePointers.current.size === 2) {
      const [first, second] = [...pagePointers.current.values()]
      const midpoint = middle(first, second)
      const bounds = viewport.getBoundingClientRect()
      pageInteraction.current = {
        anchor: {
          x: (viewport.scrollLeft + midpoint.x - bounds.left - 24) / zoom,
          y: (viewport.scrollTop + midpoint.y - bounds.top - 24) / zoom,
        },
        initialDistance: distance(first, second),
        initialZoom: zoom,
        kind: 'pinch',
      }
    }
  }

  const movePage = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pagePointers.current.has(event.pointerId)) return
    event.preventDefault()
    const viewport = viewportRef.current
    const interaction = pageInteraction.current
    if (!viewport || !interaction) return
    pagePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (interaction.kind === 'pan') {
      viewport.scrollLeft = interaction.initialScroll.x
        - (event.clientX - interaction.initialClient.x)
      viewport.scrollTop = interaction.initialScroll.y
        - (event.clientY - interaction.initialClient.y)
      return
    }
    if (pagePointers.current.size < 2) return
    const [first, second] = [...pagePointers.current.values()]
    const midpoint = middle(first, second)
    const next = mobileUiPagePinchZoom(
      interaction.initialZoom,
      interaction.initialDistance,
      distance(first, second),
    )
    const bounds = viewport.getBoundingClientRect()
    setZoom(next)
    if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current)
    zoomFrame.current = requestAnimationFrame(() => {
      viewport.scrollLeft = interaction.anchor.x * next + 24 - (midpoint.x - bounds.left)
      viewport.scrollTop = interaction.anchor.y * next + 24 - (midpoint.y - bounds.top)
      zoomFrame.current = null
    })
  }

  const finishPage = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pagePointers.current.has(event.pointerId)) return
    event.preventDefault()
    pagePointers.current.delete(event.pointerId)
    pageInteraction.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const wheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    zoomAt(zoom * Math.exp(-event.deltaY * 0.002), { x: event.clientX, y: event.clientY })
  }

  const keyboardMove = (id: MobileUiElementId, event: ReactKeyboardEvent<HTMLDivElement>) => {
    let deltaX = 0
    let deltaY = 0
    const step = event.shiftKey ? MOBILE_UI_GRID_SIZE : 1
    if (event.key === 'ArrowLeft') deltaX = -step / page.width * 100
    else if (event.key === 'ArrowRight') deltaX = step / page.width * 100
    else if (event.key === 'ArrowUp') deltaY = -step / page.height * 100
    else if (event.key === 'ArrowDown') deltaY = step / page.height * 100
    else if (event.key === '[' || event.key === ']') {
      event.preventDefault()
      updateElement(id, {
        ...layout[id],
        rotation: mobileUiElementRotation(layout[id].rotation, 0, event.key === '[' ? -Math.PI / 36 : Math.PI / 36, true),
      })
      return
    } else if (event.key === '-' || event.key === '+') {
      event.preventDefault()
      updateElement(id, {
        ...layout[id],
        scale: clamp(
          layout[id].scale + (event.key === '-' ? -0.05 : 0.05),
          MOBILE_UI_SCALE_MIN,
          MOBILE_UI_SCALE_MAX,
        ),
      })
      return
    } else return
    event.preventDefault()
    const current = layout[id]
    updateElement(id, {
      ...current,
      x: current.x + deltaX,
      y: current.y + deltaY,
    })
  }

  const selectedTransform = layout[selected]
  return (
    <div
      className="mobile-ui-editor"
      data-grid-snap={snap}
      data-restoring-default={restoringDefault}
      data-selected-element={selected}
    >
      <div className="mobile-ui-editor-toolbar" aria-label="Mobile UI editor tools">
        <label>
          <span>ELEMENT</span>
          <select
            aria-label="Selected mobile UI element"
            value={selected}
            onChange={(event) => setSelected(event.currentTarget.value as MobileUiElementId)}
          >
            {MOBILE_UI_ELEMENT_IDS.map((id) => (
              <option key={id} value={id}>{MOBILE_UI_ELEMENT_LABELS[id]}</option>
            ))}
          </select>
        </label>
        <button
          aria-pressed={snap}
          data-mobile-ui-grid-toggle
          onClick={() => setSnap((enabled) => !enabled)}
          type="button"
        >
          GRID {snap ? 'ON' : 'OFF'}
        </button>
        <div className="mobile-ui-editor-zoom-controls" aria-label="Page zoom">
          <button
            aria-label="Zoom out"
            disabled={zoom <= MOBILE_UI_PAGE_ZOOM_MIN}
            onClick={() => zoomAt(zoom / 1.25, viewportCenter(viewportRef.current))}
            type="button"
          >−</button>
          <output aria-label="Zoom level">{Math.round(zoom * 100)}%</output>
          <button
            aria-label="Zoom in"
            disabled={zoom >= MOBILE_UI_PAGE_ZOOM_MAX}
            onClick={() => zoomAt(zoom * 1.25, viewportCenter(viewportRef.current))}
            type="button"
          >+</button>
          <button onClick={fitPage} type="button">FIT</button>
        </div>
        <button data-mobile-ui-reset onClick={onReset} type="button">RESET DEFAULT</button>
      </div>

      <div
        ref={viewportRef}
        className="mobile-ui-editor-viewport"
        onPointerCancel={finishPage}
        onPointerDown={beginPage}
        onPointerMove={movePage}
        onPointerUp={finishPage}
        onWheel={wheel}
      >
        <div
          className="mobile-ui-editor-page-shell"
          style={{
            height: page.height * zoom + 48,
            width: page.width * zoom + 48,
          }}
        >
          <div
            ref={pageRef}
            aria-label={`Mobile HUD layout page, ${page.width} by ${page.height}`}
            className="mobile-ui-editor-page"
            data-grid-visible={snap}
            role="application"
            style={{
              '--mobile-ui-editor-grid': `${MOBILE_UI_GRID_SIZE}px`,
              height: page.height,
              transform: `scale(${zoom})`,
              width: page.width,
            } as CSSProperties}
          >
            {MOBILE_UI_ELEMENT_IDS.map((id) => {
              const transform = layout[id]
              const size = geometry.sizes[id]
              const active = selected === id
              return (
                <div
                  ref={(node) => {
                    if (node) elementRefs.current.set(id, node)
                    else elementRefs.current.delete(id)
                  }}
                  aria-label={`${MOBILE_UI_ELEMENT_LABELS[id]}, x ${transform.x.toFixed(1)} percent, y ${transform.y.toFixed(1)} percent, scale ${transform.scale.toFixed(2)}, rotation ${transform.rotation.toFixed(0)} degrees`}
                  aria-pressed={active}
                  className="mobile-ui-editor-element"
                  data-mobile-ui-editor-element={id}
                  data-selected={active}
                  key={id}
                  onFocus={() => setSelected(id)}
                  onKeyDown={(event) => keyboardMove(id, event)}
                  onPointerCancel={finishElement}
                  onPointerDown={(event) => beginElement(id, event)}
                  onPointerMove={(event) => moveElement(id, event)}
                  onPointerUp={finishElement}
                  role="button"
                  style={{
                    '--mobile-ui-element-scale': transform.scale,
                    height: size.height,
                    left: `${transform.x}%`,
                    top: `${transform.y}%`,
                    transform: `translate(-50%, -50%) rotate(${transform.rotation}deg) scale(${transform.scale})`,
                    width: size.width,
                  } as CSSProperties}
                  tabIndex={active ? 0 : -1}
                >
                  <MobileUiElementPreview id={id} />
                  {active ? (
                    <>
                      {RESIZE_HANDLES.map((handle) => (
                        <button
                          aria-label={`Resize ${MOBILE_UI_ELEMENT_LABELS[id]} from ${handle}`}
                          className="mobile-ui-editor-resize-node"
                          data-resize-handle={handle}
                          key={handle}
                          onPointerCancel={finishHandle}
                          onPointerDown={(event) => beginHandle(id, 'resize', event)}
                          onPointerMove={moveHandle}
                          onPointerUp={finishHandle}
                          type="button"
                        />
                      ))}
                      <button
                        aria-label={`Rotate ${MOBILE_UI_ELEMENT_LABELS[id]}`}
                        className="mobile-ui-editor-rotate-handle"
                        onPointerCancel={finishHandle}
                        onPointerDown={(event) => beginHandle(id, 'rotate', event)}
                        onPointerMove={moveHandle}
                        onPointerUp={finishHandle}
                        type="button"
                      />
                    </>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mobile-ui-editor-status" aria-live="polite">
        <strong>{MOBILE_UI_ELEMENT_LABELS[selected]}</strong>
        <span>X {selectedTransform.x.toFixed(1)}%</span>
        <span>Y {selectedTransform.y.toFixed(1)}%</span>
        <span>SIZE {Math.round(selectedTransform.scale * 100)}%</span>
        <span>ROTATE {Math.round(selectedTransform.rotation)}°</span>
        <small>Drag to move. Pinch the selection or use its nodes to resize. Pinch empty silver to zoom.</small>
      </div>
    </div>
  )
}

function MobileUiElementPreview({ id }: { id: MobileUiElementId }) {
  if (id === 'pause') return <img draggable={false} src={hub.hud.skull} alt="" />
  if (id === 'diagnostics') {
    return (
      <span className="mobile-ui-editor-diagnostics">
        <span>60 FPS</span>
        <span>42 ms</span>
      </span>
    )
  }
  if (id === 'leftJoystick' || id === 'rightJoystick') {
    return (
      <span className="mobile-ui-editor-joystick" aria-hidden>
        <span />
      </span>
    )
  }
  if (id.startsWith('slot')) {
    return <span className="mobile-ui-editor-slot">{id.slice(4)}</span>
  }
  if (id === 'inventory') return <img draggable={false} src={hub.hud.backpack} alt="" />
  if (id === 'skillbook') return <img draggable={false} src={hub.hud.tome} alt="" />
  if (id === 'xp') {
    return (
      <span className="mobile-ui-editor-xp" aria-hidden>
        <img draggable={false} src={hub.hud.xpFill} alt="" />
        <img draggable={false} src={hub.hud.xpFrame} alt="" />
      </span>
    )
  }
  return (
    <img
      className="mobile-ui-editor-potion"
      draggable={false}
      src={id === 'healthPotion' ? hub.hud.potionRed : hub.hud.potionBlue}
      alt=""
    />
  )
}

function snapScale(scale: number, snap: boolean): number {
  if (!snap) return scale
  return clamp(Math.round(scale / 0.05) * 0.05, MOBILE_UI_SCALE_MIN, MOBILE_UI_SCALE_MAX)
}

function angle(center: MobileUiPoint, point: MobileUiPoint): number {
  return Math.atan2(point.y - center.y, point.x - center.x)
}

function distance(left: MobileUiPoint, right: MobileUiPoint): number {
  return Math.hypot(right.x - left.x, right.y - left.y)
}

function middle(left: MobileUiPoint, right: MobileUiPoint): MobileUiPoint {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 }
}

function viewportCenter(viewport: HTMLDivElement | null): MobileUiPoint {
  if (!viewport) return { x: 0, y: 0 }
  const bounds = viewport.getBoundingClientRect()
  return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

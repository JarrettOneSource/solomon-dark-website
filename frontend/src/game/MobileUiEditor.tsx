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
import { nativeBeltEntryItem, nativeBeltPotionProjection } from './core-kernels/native-belt.ts'
import type { NativeSecondaryPlayerState } from './core-kernels/native-secondary-abilities.ts'
import { nativeSkillCategory, nativeSkillIconRecord } from './core-kernels/player-progression.ts'
import { MOBILE_JOYSTICK_BASE } from './mobile-quickbar-layout.ts'
import NativeBeltItemIcon from './NativeBeltItemIcon.tsx'
import type { ProtocolPlayerState } from './protocol/game-state.ts'
import { CooldownSector, NativeSkillIcon } from './SkillQuickbar.tsx'
import { nativeSkillQuickbarIconAlpha, nativeSkillQuickbarCooldownPresentation } from './skill-quickbar.ts'
import {
  MOBILE_UI_ELEMENT_IDS,
  MOBILE_UI_ELEMENT_LABELS,
  MOBILE_UI_GRID_SIZE,
  MOBILE_UI_PAGE_ZOOM_MAX,
  MOBILE_UI_PAGE_ZOOM_MIN,
  MOBILE_UI_RESIZE_HANDLES,
  MOBILE_UI_SCALE_MAX,
  MOBILE_UI_SCALE_MIN,
  MOBILE_UI_SNAP_THRESHOLD,
  constrainMobileUiTransform,
  defaultMobileUiGeometry,
  mobileUiElementPinchScale,
  mobileUiElementRotation,
  mobileUiElementSnapRect,
  mobileUiLayoutWith,
  mobileUiBeltElementId,
  mobileUiPagePinchZoom,
  mobileUiResizeTransform,
  snapMobileUiMove,
  snapMobileUiResize,
  snapMobileUiScale,
  type MobileUiElementId,
  type MobileUiElementTransform,
  type MobileUiLayout,
  type MobileUiPoint,
  type MobileUiResizeHandle,
  type MobileUiSize,
  type MobileUiSnapGuide,
} from './mobile-ui-layout.ts'

import './mobile-ui-editor.css'
import './hub.css'

interface MobileUiEditorProps {
  layout: MobileUiLayout
  onChange: (layout: MobileUiLayout) => void
  onReset: () => void
  onSave?: () => void
  page: MobileUiSize
  player?: ProtocolPlayerState
  inHub?: boolean
  secondary?: NativeSecondaryPlayerState
  presentation?: 'fullscreen' | 'windowed'
  restoringDefault: boolean
  uiScale: number
}

type ElementInteraction = {
  readonly id: MobileUiElementId
  readonly initialDistance: number
  readonly initialTransform: MobileUiElementTransform
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
  readonly handle: MobileUiResizeHandle
  readonly id: MobileUiElementId
  readonly initialPointer: MobileUiPoint
  readonly initialTransform: MobileUiElementTransform
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

interface DockInteraction {
  readonly offset: MobileUiPoint
  readonly pointerId: number
}

interface EditorSnapshot {
  readonly layout: MobileUiLayout
  readonly restoringDefault: boolean
}

export default function MobileUiEditor({
  layout,
  onChange,
  onReset,
  onSave,
  page,
  player,
  inHub = false,
  secondary,
  presentation = 'windowed',
  restoringDefault,
  uiScale,
}: MobileUiEditorProps) {
  const geometry = useMemo(
    () => defaultMobileUiGeometry(page.width, page.height, uiScale),
    [page.height, page.width, uiScale],
  )
  const [selected, setSelected] = useState<MobileUiElementId>('pause')
  const [snap, setSnap] = useState(true)
  const [snapGuides, setSnapGuides] = useState<readonly MobileUiSnapGuide[]>([])
  const [zoom, setZoom] = useState(1)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [history, setHistory] = useState<{ past: EditorSnapshot[], future: EditorSnapshot[] }>({
    past: [], future: [],
  })
  const recordedInteraction = useRef(false)
  const [dockPosition, setDockPosition] = useState<MobileUiPoint | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const dockInteraction = useRef<DockInteraction | null>(null)
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
    if (presentation === 'fullscreen') {
      setZoom(1)
      viewport.scrollLeft = 0
      viewport.scrollTop = 0
      return
    }
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
  }, [page.height, page.width, presentation])

  useLayoutEffect(() => {
    fitPage()
  }, [fitPage])

  useLayoutEffect(() => {
    if (presentation !== 'fullscreen') return
    const root = rootRef.current
    const dock = dockRef.current
    if (!root || !dock) return
    const resize = () => setDockPosition((current) => constrainDockPosition(
      current ?? { x: (root.clientWidth - dock.offsetWidth) / 2, y: 54 }, root, dock,
    ))
    const observer = new ResizeObserver(resize)
    observer.observe(root)
    observer.observe(dock)
    resize()
    return () => observer.disconnect()
  }, [presentation])

  useEffect(() => () => {
    if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current)
  }, [])

  const rememberChange = useCallback(() => {
    if (recordedInteraction.current) return
    recordedInteraction.current = true
    setHistory((current) => ({
      past: [...current.past.slice(-99), { layout, restoringDefault }],
      future: [],
    }))
  }, [layout, restoringDefault])

  const beginChange = () => {
    if (elementPointers.current.size === 0 && !handleInteraction.current) {
      recordedInteraction.current = false
    }
  }

  const restoreHistory = (direction: 'undo' | 'redo') => {
    const source = direction === 'undo' ? history.past : history.future
    const snapshot = source.at(-1)
    if (!snapshot) return
    elementPointers.current.clear()
    elementPointerOwner.current = null
    elementInteraction.current = null
    handleInteraction.current = null
    const current = { layout, restoringDefault }
    setHistory(direction === 'undo'
      ? { past: history.past.slice(0, -1), future: [...history.future, current] }
      : { past: [...history.past, current], future: history.future.slice(0, -1) })
    setSnapGuides([])
    if (snapshot.restoringDefault) onReset()
    else onChange(snapshot.layout)
  }

  const resetLayout = () => {
    if (restoringDefault) return
    rememberChange()
    setSnapGuides([])
    onReset()
  }

  const updateElement = useCallback((
    id: MobileUiElementId,
    transform: MobileUiElementTransform,
    guides: readonly MobileUiSnapGuide[] = [],
  ) => {
    setSnapGuides(guides)
    const next = constrainMobileUiTransform(transform, geometry.sizes[id], page)
    const current = layout[id]
    if (current.x === next.x && current.y === next.y
      && current.scale === next.scale && current.rotation === next.rotation) return
    rememberChange()
    onChange(mobileUiLayoutWith(layout, id, next))
  }, [geometry.sizes, layout, onChange, page, rememberChange])

  const pagePoint = useCallback((clientX: number, clientY: number): MobileUiPoint => {
    const bounds = pageRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return { x: 50, y: 50 }
    return {
      x: (clientX - bounds.left) / bounds.width * 100,
      y: (clientY - bounds.top) / bounds.height * 100,
    }
  }, [])

  const pagePixelPoint = useCallback((clientX: number, clientY: number): MobileUiPoint => {
    const bounds = pageRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      return { x: page.width / 2, y: page.height / 2 }
    }
    return {
      x: (clientX - bounds.left) / bounds.width * page.width,
      y: (clientY - bounds.top) / bounds.height * page.height,
    }
  }, [page.height, page.width])

  const snapTargets = useCallback((id: MobileUiElementId) => (
    MOBILE_UI_ELEMENT_IDS
      .filter((candidate) => candidate !== id)
      .map((candidate) => mobileUiElementSnapRect(
        layout[candidate],
        geometry.sizes[candidate],
        page,
      ))
  ), [geometry.sizes, layout, page])

  const nudgeElement = (direction: MobileUiPoint) => {
    const step = snap ? MOBILE_UI_GRID_SIZE : 1
    const candidate = {
      ...layout[selected],
      x: layout[selected].x + direction.x * step / page.width * 100,
      y: layout[selected].y + direction.y * step / page.height * 100,
    }
    if (!snap) {
      updateElement(selected, candidate)
      return
    }
    const result = snapMobileUiMove(candidate, geometry.sizes[selected], page, snapTargets(selected))
    updateElement(selected, result.transform, result.guides)
  }

  const toggleGrid = () => {
    setSnap((enabled) => !enabled)
    setSnapGuides([])
  }

  const beginElement = (
    id: MobileUiElementId,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (elementPointers.current.size > 0 && elementPointerOwner.current !== id) return
    event.preventDefault()
    event.stopPropagation()
    setSnapGuides([])
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
        initialTransform: layout[id],
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
      const candidate = {
        ...interaction.initialTransform,
        scale: mobileUiElementPinchScale(
          interaction.initialTransform.scale,
          interaction.initialDistance,
          distance(first, second),
        ),
      }
      if (!snap) {
        setSnapGuides([])
        updateElement(id, candidate)
        return
      }
      const result = snapMobileUiScale(
        candidate,
        geometry.sizes[id],
        page,
        snapTargets(id),
        MOBILE_UI_SNAP_THRESHOLD / zoom,
      )
      updateElement(id, result.transform, result.guides)
      return
    }
    const current = pagePoint(event.clientX, event.clientY)
    const moved = {
      x: interaction.initialTransform.x + current.x - interaction.initialPointer.x,
      y: interaction.initialTransform.y + current.y - interaction.initialPointer.y,
    }
    const candidate = { ...interaction.initialTransform, ...moved }
    if (!snap) {
      setSnapGuides([])
      updateElement(id, candidate)
      return
    }
    const result = snapMobileUiMove(
      candidate,
      geometry.sizes[id],
      page,
      snapTargets(id),
      MOBILE_UI_SNAP_THRESHOLD / zoom,
    )
    updateElement(id, result.transform, result.guides)
  }

  const finishElement = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!elementPointers.current.has(event.pointerId)) return
    event.preventDefault()
    event.stopPropagation()
    elementPointers.current.delete(event.pointerId)
    if (elementPointers.current.size === 0) elementPointerOwner.current = null
    elementInteraction.current = null
    const remaining = elementPointers.current.values().next().value
    const id = elementPointerOwner.current
    if (remaining && id) {
      elementInteraction.current = {
        id,
        initialPointer: pagePoint(remaining.x, remaining.y),
        initialTransform: layout[id],
        kind: 'drag',
      }
    }
    setSnapGuides([])
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const beginHandle = (
    id: MobileUiElementId,
    handle: MobileUiResizeHandle | 'rotate',
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setSnapGuides([])
    setSelected(id)
    if (handle === 'rotate') {
      const bounds = elementRefs.current.get(id)?.getBoundingClientRect()
      if (!bounds) return
      event.currentTarget.setPointerCapture(event.pointerId)
      const center = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
      handleInteraction.current = {
        center,
        id,
        initialAngle: angle(center, { x: event.clientX, y: event.clientY }),
        initialRotation: layout[id].rotation,
        kind: 'rotate',
        pointerId: event.pointerId,
      }
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    handleInteraction.current = {
      handle,
      id,
      initialPointer: pagePixelPoint(event.clientX, event.clientY),
      initialTransform: layout[id],
      kind: 'resize',
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
      setSnapGuides([])
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
    const currentPointer = pagePixelPoint(current.x, current.y)
    if (!snap) {
      setSnapGuides([])
      updateElement(interaction.id, mobileUiResizeTransform(
        interaction.initialTransform,
        geometry.sizes[interaction.id],
        page,
        interaction.handle,
        interaction.initialPointer,
        currentPointer,
      ))
      return
    }
    const result = snapMobileUiResize(
      interaction.initialTransform,
      geometry.sizes[interaction.id],
      page,
      interaction.handle,
      interaction.initialPointer,
      currentPointer,
      snapTargets(interaction.id),
      MOBILE_UI_SNAP_THRESHOLD / zoom,
    )
    updateElement(interaction.id, result.transform, result.guides)
  }

  const finishHandle = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const interaction = handleInteraction.current
    if (!interaction || interaction.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    handleInteraction.current = null
    setSnapGuides([])
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
    setSnapGuides([])
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
    setSnapGuides([])
    const current = layout[id]
    updateElement(id, {
      ...current,
      x: current.x + deltaX,
      y: current.y + deltaY,
    })
  }

  const beginDockDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const dock = dockRef.current
    if (!dock) return
    const bounds = dock.getBoundingClientRect()
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dockInteraction.current = {
      offset: { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      pointerId: event.pointerId,
    }
  }

  const moveDock = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const interaction = dockInteraction.current
    const root = rootRef.current
    const dock = dockRef.current
    if (!interaction || interaction.pointerId !== event.pointerId || !root || !dock) return
    event.preventDefault()
    event.stopPropagation()
    const bounds = root.getBoundingClientRect()
    setDockPosition(constrainDockPosition({
      x: event.clientX - bounds.left - interaction.offset.x,
      y: event.clientY - bounds.top - interaction.offset.y,
    }, root, dock))
  }

  const finishDockDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const interaction = dockInteraction.current
    if (!interaction || interaction.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    dockInteraction.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const selectedTransform = layout[selected]
  const previewScale = geometry.sizes.leftJoystick.width / MOBILE_JOYSTICK_BASE
  return (
    <div
      ref={rootRef}
      className="mobile-ui-editor"
      data-editor-presentation={presentation}
      data-grid-snap={snap}
      data-restoring-default={restoringDefault}
      data-selected-element={selected}
      onClickCapture={beginChange}
      onPointerDownCapture={beginChange}
      onKeyDownCapture={(event) => {
        recordedInteraction.current = false
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return
        const key = event.key.toLowerCase()
        if (key !== 'z' && key !== 'y') return
        event.preventDefault()
        event.stopPropagation()
        restoreHistory(key === 'y' || event.shiftKey ? 'redo' : 'undo')
      }}
    >
      {presentation === 'windowed' ? (
        <div className="mobile-ui-editor-toolbar" aria-label="Mobile UI editor tools">
          <label>
            <span>CONTROL</span>
            <select
              aria-label="Selected mobile UI element"
              value={selected}
              onChange={(event) => {
                setSelected(event.currentTarget.value as MobileUiElementId)
                setSnapGuides([])
              }}
            >
              {MOBILE_UI_ELEMENT_IDS.map((id) => (
                <option key={id} value={id}>{MOBILE_UI_ELEMENT_LABELS[id]}</option>
              ))}
            </select>
          </label>
          <button disabled={!history.past.length} onClick={() => restoreHistory('undo')} type="button">UNDO</button>
          <button disabled={!history.future.length} onClick={() => restoreHistory('redo')} type="button">REDO</button>
          <button
            aria-pressed={snap}
            data-mobile-ui-grid-toggle
            onClick={toggleGrid}
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
          <button data-mobile-ui-reset disabled={restoringDefault} onClick={resetLayout} type="button">RESET LAYOUT</button>
        </div>
      ) : null}

      <div
        ref={viewportRef}
        className="mobile-ui-editor-viewport"
        onPointerCancel={presentation === 'windowed' ? finishPage : undefined}
        onPointerDown={presentation === 'windowed' ? beginPage : undefined}
        onPointerMove={presentation === 'windowed' ? movePage : undefined}
        onPointerUp={presentation === 'windowed' ? finishPage : undefined}
        onWheel={presentation === 'windowed' ? wheel : undefined}
      >
        <div
          className="mobile-ui-editor-page-shell"
          style={{
            height: page.height * zoom + (presentation === 'windowed' ? 48 : 0),
            width: page.width * zoom + (presentation === 'windowed' ? 48 : 0),
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
            {snapGuides.map((guide) => (
              <span
                aria-hidden
                className="mobile-ui-editor-snap-guide"
                data-snap-guide-axis={guide.axis}
                data-snap-guide-kind={guide.kind}
                key={`${guide.axis}:${guide.kind}:${guide.position}`}
                style={guide.axis === 'x' ? { left: guide.position } : { top: guide.position }}
              />
            ))}
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
                  onFocus={() => {
                    setSelected(id)
                    setSnapGuides([])
                  }}
                  onKeyDown={(event) => keyboardMove(id, event)}
                  onPointerCancel={finishElement}
                  onLostPointerCapture={finishElement}
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
                  <MobileUiElementPreview id={id} uiScale={uiScale} player={player} inHub={inHub} previewScale={previewScale} secondary={secondary} size={size} />
                  {active ? (
                    <>
                      {MOBILE_UI_RESIZE_HANDLES.map((handle) => (
                        <button
                          aria-label={`Resize ${MOBILE_UI_ELEMENT_LABELS[id]} from ${handle}`}
                          className="mobile-ui-editor-resize-node"
                          data-resize-handle={handle}
                          key={handle}
                          onPointerCancel={finishHandle}
                          onLostPointerCapture={finishHandle}
                          onPointerDown={(event) => beginHandle(id, handle, event)}
                          onPointerMove={moveHandle}
                          onPointerUp={finishHandle}
                          type="button"
                        />
                      ))}
                      <button
                        aria-label={`Rotate ${MOBILE_UI_ELEMENT_LABELS[id]}`}
                        className="mobile-ui-editor-rotate-handle"
                        onPointerCancel={finishHandle}
                        onLostPointerCapture={finishHandle}
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

      {presentation === 'windowed' ? (
        <div className="mobile-ui-editor-details">
          <MobileUiAdjustments
            onChange={(transform) => updateElement(selected, transform)}
            onNudge={nudgeElement}
            onReset={() => updateElement(selected, geometry.layout[selected])}
            selected={selected}
            transform={selectedTransform}
          />
          <div className="mobile-ui-editor-status">
            <strong>{MOBILE_UI_ELEMENT_LABELS[selected]}</strong>
            <span>X {selectedTransform.x.toFixed(1)}%</span>
            <span>Y {selectedTransform.y.toFixed(1)}%</span>
            <span>SIZE {Math.round(selectedTransform.scale * 100)}%</span>
            <span>ROTATE {Math.round(selectedTransform.rotation)}°</span>
            <small>GRID snaps nearby edges and centres. Drag to move; pinch or use a node to resize.</small>
          </div>
        </div>
      ) : (
        <div
          ref={dockRef}
          className="mobile-ui-editor-dock"
          aria-label="Mobile UI editor actions"
          style={dockPosition ? { left: dockPosition.x, right: 'auto', top: dockPosition.y } : undefined}
        >
          <div className="mobile-ui-editor-dock-heading">
            <button
              aria-label="Move editor actions"
              className="mobile-ui-editor-dock-handle"
              onPointerCancel={finishDockDrag}
              onLostPointerCapture={finishDockDrag}
              onPointerDown={beginDockDrag}
              onPointerMove={moveDock}
              onPointerUp={finishDockDrag}
              type="button"
            >⠿</button>
            <strong>Mobile controls</strong>
            <button
              className="mobile-ui-editor-dock-save"
              data-mobile-ui-save
              onClick={onSave}
              type="button"
            >SAVE</button>
          </div>
          <div className="mobile-ui-editor-dock-actions">
            <button disabled={!history.past.length} onClick={() => restoreHistory('undo')} type="button">UNDO</button>
            <button disabled={!history.future.length} onClick={() => restoreHistory('redo')} type="button">REDO</button>
            <button
              aria-pressed={snap}
              data-mobile-ui-grid-toggle
              onClick={toggleGrid}
              type="button"
            >GRID {snap ? 'ON' : 'OFF'}</button>
            <button
              aria-expanded={toolsOpen}
              aria-controls="mobile-ui-adjustments"
              onClick={() => setToolsOpen((open) => !open)}
              type="button"
            >ADJUST {toolsOpen ? '−' : '+'}</button>
          </div>
          {!toolsOpen ? <p className="mobile-ui-editor-hint">Drag to move. Pinch to resize.</p> : null}
          {toolsOpen ? (
            <div className="mobile-ui-editor-inspector" id="mobile-ui-adjustments">
              <label className="mobile-ui-editor-control-picker">
                <span>Control</span>
                <select
                  aria-label="Selected mobile UI element"
                  value={selected}
                  onChange={(event) => {
                    const id = MOBILE_UI_ELEMENT_IDS.find((candidate) => candidate === event.currentTarget.value)
                    if (id) {
                      setSelected(id)
                      setSnapGuides([])
                    }
                  }}
                >
                  {MOBILE_UI_ELEMENT_IDS.map((id) => (
                    <option key={id} value={id}>{MOBILE_UI_ELEMENT_LABELS[id]}</option>
                  ))}
                </select>
              </label>
              <MobileUiAdjustments
                onChange={(transform) => updateElement(selected, transform)}
                onNudge={nudgeElement}
                onReset={() => updateElement(selected, geometry.layout[selected])}
                selected={selected}
                transform={selectedTransform}
              />
              <button data-mobile-ui-reset disabled={restoringDefault} onClick={resetLayout} type="button">RESET LAYOUT</button>
              <small>Changes apply when you save. Undo also restores a reset.</small>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function MobileUiAdjustments({
  onChange,
  onNudge,
  onReset,
  selected,
  transform,
}: {
  onChange: (transform: MobileUiElementTransform) => void
  onNudge: (direction: MobileUiPoint) => void
  onReset: () => void
  selected: MobileUiElementId
  transform: MobileUiElementTransform
}) {
  return (
    <div className="mobile-ui-editor-adjustments" aria-label={`Adjust ${MOBILE_UI_ELEMENT_LABELS[selected]}`}>
      <div className="mobile-ui-editor-position">
        <span>Move</span>
        <button aria-label="Move control left" onClick={() => onNudge({ x: -1, y: 0 })} type="button">←</button>
        <button aria-label="Move control up" onClick={() => onNudge({ x: 0, y: -1 })} type="button">↑</button>
        <button aria-label="Move control down" onClick={() => onNudge({ x: 0, y: 1 })} type="button">↓</button>
        <button aria-label="Move control right" onClick={() => onNudge({ x: 1, y: 0 })} type="button">→</button>
      </div>
      <div className="mobile-ui-editor-size">
        <label htmlFor="mobile-ui-control-size">Size <output>{Math.round(transform.scale * 100)}%</output></label>
        <button aria-label="Make control smaller" disabled={transform.scale <= MOBILE_UI_SCALE_MIN} onClick={() => onChange({ ...transform, scale: transform.scale - 0.05 })} type="button">−</button>
        <input
          id="mobile-ui-control-size"
          min={MOBILE_UI_SCALE_MIN * 100}
          max={MOBILE_UI_SCALE_MAX * 100}
          onChange={(event) => onChange({ ...transform, scale: event.currentTarget.valueAsNumber / 100 })}
          step={5}
          type="range"
          value={Math.round(transform.scale * 100)}
        />
        <button aria-label="Make control larger" disabled={transform.scale >= MOBILE_UI_SCALE_MAX} onClick={() => onChange({ ...transform, scale: transform.scale + 0.05 })} type="button">+</button>
      </div>
      <div className="mobile-ui-editor-rotation">
        <span>Rotation <output>{Math.round(transform.rotation)}°</output></span>
        <button aria-label="Rotate control left" onClick={() => onChange({ ...transform, rotation: mobileUiElementRotation(transform.rotation, 0, -Math.PI / 12, false) })} type="button">−15°</button>
        <button aria-label="Straighten control" disabled={transform.rotation === 0} onClick={() => onChange({ ...transform, rotation: 0 })} type="button">0°</button>
        <button aria-label="Rotate control right" onClick={() => onChange({ ...transform, rotation: mobileUiElementRotation(transform.rotation, 0, Math.PI / 12, false) })} type="button">+15°</button>
      </div>
      <button className="mobile-ui-editor-reset-control" onClick={onReset} type="button">RESET THIS CONTROL</button>
    </div>
  )
}

function MobileUiElementPreview({ id, uiScale, player, inHub, previewScale, secondary, size }: {
  id: MobileUiElementId
  uiScale: number
  player: ProtocolPlayerState | undefined
  inHub: boolean
  previewScale: number
  secondary: NativeSecondaryPlayerState | undefined
  size: MobileUiSize
}) {
  if (id === 'pause') {
    return <img className="mobile-ui-editor-pause" draggable={false} src={hub.hud.skull} alt="" />
  }
  if (id === 'diagnostics') {
    return (
      <span className="mobile-ui-editor-diagnostics">
        <span>60 FPS</span>
        <span>0 ms</span>
      </span>
    )
  }
  if (id === 'meters') {
    return (
      <span className="mobile-ui-editor-meters" aria-hidden>
        <span className="mobile-ui-editor-meter health">
          <img draggable={false} src={hub.hud.barRed} alt="" />
        </span>
        <span className="mobile-ui-editor-meter mana">
          <img draggable={false} src={hub.hud.barBlue} alt="" />
        </span>
      </span>
    )
  }
  if (id === 'leftJoystick' || id === 'rightJoystick') {
    return (
      <span className="mobile-ui-editor-joystick" aria-hidden>
        <span />
        <span className="mobile-ui-editor-joystick-label" style={{ fontSize: 11 * uiScale }}>
          {id === 'leftJoystick' ? 'MOVE' : 'AIM / CAST'}
        </span>
      </span>
    )
  }
  if (id.startsWith('slot')) {
    const slot = Number(id.slice(4)) - 1
    const entry = player?.belt[slot] ?? null
    const alias = player && mobileUiBeltElementId(player.belt, slot) !== id
    return (
      <>
        <MobileUiBeltPreview id={id} inHub={inHub} player={player} previewScale={previewScale} secondary={secondary} size={size} />
        <span className="mobile-ui-editor-slot-number" aria-hidden>{slot + 1}</span>
        {alias ? <span className="mobile-ui-editor-slot-alias" aria-hidden>{entry?.kind === 'health-potion' ? 'Health' : 'Mana'}<br />control</span> : null}
      </>
    )
  }
  if (id === 'inventory') {
    return <img className="mobile-ui-editor-dock-art" draggable={false} src={hub.hud.backpack} alt="" />
  }
  if (id === 'skillbook') {
    return <img className="mobile-ui-editor-dock-art" draggable={false} src={hub.hud.tome} alt="" />
  }
  if (id === 'xp') {
    return (
      <span className="mobile-ui-editor-xp" aria-hidden>
        <img draggable={false} src={hub.hud.xpFill} alt="" />
        <img draggable={false} src={hub.hud.xpFrame} alt="" />
      </span>
    )
  }
  return <MobileUiBeltPreview id={id} inHub={inHub} player={player} previewScale={previewScale} secondary={secondary} size={size} />
}

function MobileUiBeltPreview({ id, inHub, player, previewScale, secondary, size }: {
  id: MobileUiElementId
  inHub: boolean
  player: ProtocolPlayerState | undefined
  previewScale: number
  secondary: NativeSecondaryPlayerState | undefined
  size: MobileUiSize
}) {
  const slot = id.startsWith('slot') ? Number(id.slice(4)) - 1 : null
  const entry = player && slot !== null && mobileUiBeltElementId(player.belt, slot) === id
    ? player.belt[slot] : null
  const potionType = id === 'healthPotion' || entry?.kind === 'health-potion' ? 0
    : id === 'manaPotion' || entry?.kind === 'mana-potion' ? 1 : null
  const skillId = entry?.kind === 'skill' ? entry.skillId : null
  const potion = player && potionType !== null
    ? nativeBeltPotionProjection(player.economy.backpack, potionType) : null
  const item = potion?.item
    ? { ...potion.item, quantity: potion.count }
    : player && entry?.kind === 'item' ? nativeBeltEntryItem(entry, player.economy) : null
  const populated = skillId !== null || item !== null || potionType !== null
  const secondarySkill = skillId !== null && nativeSkillCategory(skillId) === 2
  const unavailable = secondarySkill && (
    inHub || (player?.progression.currentMana ?? 0) < (
      player?.progression.secondaryManaCosts.find(([candidate]) => candidate === skillId)?.[1] ?? 0
    )
  )
  const cooldown = secondarySkill ? nativeSkillQuickbarCooldownPresentation(
    secondary?.cooldownTicksBySkill[skillId] ?? 0,
    secondary?.cooldownMaximumTicksBySkill[skillId] ?? 0,
    secondary?.globalCooldownTicks ?? 0,
  ) : { capacity: 0, remaining: 0 }
  return (
    <span
      className="hub-hud-quickbar-slot mobile-ui-editor-belt-preview"
      data-populated={populated}
      data-preview-in-hub={inHub}
      aria-hidden
      style={{
        bottom: 'auto',
        height: size.height / previewScale,
        left: '50%',
        pointerEvents: 'none',
        top: '50%',
        transform: `translate(-50%, -50%) scale(${previewScale})`,
        width: size.width / previewScale,
      }}
    >
      {cooldown.remaining > 0 ? <CooldownSector {...cooldown} /> : null}
      {skillId !== null ? <NativeSkillIcon
        cooldown={cooldown.remaining > 0}
        opacity={nativeSkillQuickbarIconAlpha({ cooldown: cooldown.remaining > 0, unavailable })}
        record={nativeSkillIconRecord(skillId, player?.progression.weldBuildId ?? null)}
      /> : null}
      {item && player ? <NativeBeltItemIcon element={player.config.element} item={item} /> : null}
      {!item && potionType !== null ? <img className="hub-hud-belt-potion-fallback" draggable={false} src={potionType === 0 ? hub.hud.potionRed : hub.hud.potionBlue} alt="" /> : null}
    </span>
  )
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

function constrainDockPosition(
  position: MobileUiPoint,
  root: HTMLElement,
  dock: HTMLElement,
): MobileUiPoint {
  const inset = 8
  return {
    x: clamp(position.x, inset, Math.max(inset, root.clientWidth - dock.offsetWidth - inset)),
    y: clamp(position.y, inset, Math.max(inset, root.clientHeight - dock.offsetHeight - inset)),
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

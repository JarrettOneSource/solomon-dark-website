// The dig site itself: canvas viewport, camera, pointer tools, status strip.
// Rendering runs off refs and a dirty flag; React only mounts the chrome.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import type { PaletteItem } from '../../editor/assets'
import { findPaletteItem, spriteImage, spriteRefFor } from '../../editor/assets'
import { STATIC_SPRITE_ATLAS_BASE } from '../../editor/io'
import type { EditorDoc, SelEntry, Selection, Vec2 } from '../../editor/model'
import { entryKey, expandSelection, selectionSet } from '../../editor/model'
import type { Camera, Tool, ToolStyles } from '../../editor/render'
import { STAGE_TEXTURES, drawStage, pick, pickInRadius, pickInRect, screenToWorld } from '../../editor/render'
import type { EditorAction } from '../../editor/store'

const SNAP = 16
const ZOOM_MIN = 0.15
const ZOOM_MAX = 3

export interface StageHandle {
  fit: () => void
  zoomBy: (factor: number) => void
  /** Slide the camera by a screen-pixel delta. */
  panBy: (dx: number, dy: number) => void
}

interface Props {
  doc: EditorDoc
  selection: Selection
  tool: Tool
  activeItem: PaletteItem | null
  snap: boolean
  showGrid: boolean
  styles: ToolStyles
  dispatch: Dispatch<EditorAction>
  /** Place tools hand the stage a sound to make when a piece lands. */
  onPlaced?: () => void
  onDeleted?: () => void
  /** Right-click (or Esc, page-side) puts the chosen piece down. */
  onExitPlace?: () => void
}

const TOOL_HINT: Record<Tool, string> = {
  select: 'click holds · drag moves · drag empty ground lassos · space surveys',
  place: 'click plants · esc or right-click puts it down',
  brush: 'drag to scatter · esc or right-click puts it down',
  erase: 'click or drag to evict',
  pan: 'drag to survey · arrows walk the view when nothing is held',
  road: 'click to lay · double-click or enter ends the road',
  fence: 'click to post · double-click or enter ends the run',
  terrain: 'click to carve · double-click or enter ends the cut',
}

type Gesture =
  | { kind: 'pan'; sx: number; sy: number; camX: number; camY: number }
  | { kind: 'drag'; origin: Vec2 }
  | { kind: 'marquee'; origin: Vec2; base: Selection }
  | { kind: 'stroke'; last: Vec2; touched: boolean }
  | null

export default forwardRef<StageHandle, Props>(function CanvasStage(
  { doc, selection, tool, activeItem, snap, showGrid, styles, dispatch, onPlaced, onDeleted, onExitPlace },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const coordsRef = useRef<HTMLSpanElement>(null)
  const zoomRef = useRef<HTMLSpanElement>(null)

  const cam = useRef<Camera>({ x: 0, y: 0, zoom: 0.5 })
  const dirty = useRef(true)
  const size = useRef({ w: 0, h: 0 })
  const hover = useRef<SelEntry | null>(null)
  const ghost = useRef<Vec2 | null>(null)
  const draft = useRef<Vec2[] | null>(null)
  const marquee = useRef<{ a: Vec2; b: Vec2 } | null>(null)
  const brushAt = useRef<Vec2 | null>(null)
  const gesture = useRef<Gesture>(null)
  // Held spacebar turns any tool into the surveyor's hand.
  const spaceRef = useRef(false)
  const [spaceHeld, setSpaceHeld] = useState(false)

  // Live mirrors so pointer handlers never close over stale props.
  const live = useRef({ doc, selection, tool, activeItem, snap, showGrid, styles })
  live.current = { doc, selection, tool, activeItem, snap, showGrid, styles }

  const markDirty = useCallback(() => {
    dirty.current = true
  }, [])

  // Every sprite referenced by the doc, and the stage textures, request a
  // redraw as they decode.
  useEffect(() => {
    const seen = new Set<string>()
    for (const o of doc.objects) if (o.sprite && !seen.has(o.sprite.src)) { seen.add(o.sprite.src); spriteImage(o.sprite.src, markDirty) }
    for (const s of doc.sprites) if (s.sprite && !seen.has(s.sprite.src)) { seen.add(s.sprite.src); spriteImage(s.sprite.src, markDirty) }
    markDirty()
  }, [doc, markDirty])

  useEffect(() => {
    for (const src of STAGE_TEXTURES) spriteImage(src, markDirty)
  }, [markDirty])

  useEffect(() => {
    markDirty()
  }, [selection, tool, showGrid, styles, markDirty])

  const fit = useCallback(() => {
    const b = live.current.doc.meta.bounds
    const { w, h } = size.current
    if (w === 0 || h === 0) return
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min((w - 80) / b.w, (h - 80) / b.h)))
    cam.current = { x: b.x + b.w / 2, y: b.y + b.h / 2, zoom }
    markDirty()
  }, [markDirty])

  const zoomBy = useCallback((factor: number) => {
    cam.current.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.current.zoom * factor))
    markDirty()
  }, [markDirty])

  const zoomTo = useCallback((zoom: number) => {
    cam.current.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
    markDirty()
  }, [markDirty])

  const panBy = useCallback((dx: number, dy: number) => {
    cam.current.x += dx / cam.current.zoom
    cam.current.y += dy / cam.current.zoom
    markDirty()
  }, [markDirty])

  useImperativeHandle(ref, () => ({ fit, zoomBy, panBy }), [fit, zoomBy, panBy])

  // Spacebar: temporary survey from any tool, back the moment it lifts.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      e.preventDefault()
      if (!spaceRef.current) {
        spaceRef.current = true
        setSpaceHeld(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      spaceRef.current = false
      setSpaceHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // Resize, then render loop.
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let first = true
    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      size.current = { w: rect.width, h: rect.height }
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (first) {
        first = false
        fit()
      }
      markDirty()
    })
    ro.observe(wrap)

    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!dirty.current) return
      dirty.current = false
      const s = live.current
      drawStage(ctx, size.current.w, size.current.h, cam.current, s.doc, {
        tool: s.tool,
        selection: s.selection,
        hover: hover.current,
        ghost: (() => {
          if (s.tool !== 'place' || !s.activeItem || !ghost.current) return null
          const ref = spriteRefFor(s.activeItem.atlas, s.activeItem.entry)
          return ref ? { ref, pos: ghost.current } : null
        })(),
        draft: draft.current,
        styles: s.styles,
        marquee: marquee.current,
        brush:
          (s.tool === 'brush' || s.tool === 'erase') && brushAt.current
            ? { pos: brushAt.current, radius: s.tool === 'brush' ? s.styles.brushRadius : s.styles.eraseRadius }
            : null,
        showGrid: s.showGrid,
      })
      if (zoomRef.current) zoomRef.current.textContent = `${Math.round(cam.current.zoom * 100)}%`
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [fit, markDirty])

  // Tool changes clear transient drawing state.
  useEffect(() => {
    draft.current = null
    ghost.current = null
    marquee.current = null
    brushAt.current = null
    gesture.current = null
    markDirty()
  }, [tool, markDirty])

  const toWorld = useCallback((e: { clientX: number; clientY: number }): Vec2 => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return screenToWorld(
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
      cam.current,
      size.current.w,
      size.current.h,
    )
  }, [])

  const snapped = useCallback((p: Vec2): Vec2 => {
    if (!live.current.snap) return { x: Math.round(p.x), y: Math.round(p.y) }
    return { x: Math.round(p.x / SNAP) * SNAP, y: Math.round(p.y / SNAP) * SNAP }
  }, [])

  const placeAt = useCallback((world: Vec2, viaGesture: boolean, jitter = 0, itemOverride?: PaletteItem) => {
    const item = itemOverride ?? live.current.activeItem
    if (!item) return false
    const sprite = spriteRefFor(item.atlas, item.entry)
    if (!sprite) return false
    let pos = world
    if (jitter > 0) {
      const ang = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * jitter
      pos = { x: world.x + Math.cos(ang) * r, y: world.y + Math.sin(ang) * r }
    }
    pos = jitter > 0 ? { x: Math.round(pos.x), y: Math.round(pos.y) } : snapped(pos)
    if (item.kind === 'object' && item.typeId !== undefined) {
      const obj = { typeId: item.typeId, pos, variant: item.variant, sprite }
      dispatch(viaGesture ? { type: 'gesture-place-object', obj } : { type: 'place-object', obj })
    } else {
      // Scenery: a section-11 static sprite record. The file stores the entry
      // relative to STATIC_SPRITE_ATLAS_BASE; s0/s1/s2 are rotation/scale/alpha.
      const scatter = jitter > 0
      const spr = {
        atlasEntry: item.entry - STATIC_SPRITE_ATLAS_BASE,
        pos,
        s0: scatter ? Math.round((Math.random() * 24 - 12) * 10) / 10 : 0,
        s1: scatter ? Math.round((0.85 + Math.random() * 0.35) * 100) / 100 : 1,
        s2: 1,
        flags: 0,
        sprite,
      }
      dispatch(viaGesture ? { type: 'gesture-place-sprite', spr } : { type: 'place-sprite', spr })
    }
    return true
  }, [dispatch, snapped])

  const eraseAt = useCallback((world: Vec2): boolean => {
    const s = live.current
    const hits = pickInRadius(s.doc, world, s.styles.eraseRadius)
    if (hits.length === 0) return false
    dispatch({ type: 'gesture-erase', entries: expandSelection(s.doc, hits) })
    return true
  }, [dispatch])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = live.current
    canvasRef.current?.setPointerCapture(e.pointerId)

    // Right-click while planting puts the piece down instead of surveying.
    if (e.button === 2 && (s.tool === 'place' || s.tool === 'brush')) {
      onExitPlace?.()
      return
    }

    // Middle button, right button, the pan tool, or a held spacebar surveys.
    if (e.button === 1 || e.button === 2 || s.tool === 'pan' || spaceRef.current) {
      gesture.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, camX: cam.current.x, camY: cam.current.y }
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
      return
    }
    if (e.button !== 0) return
    const world = toWorld(e)

    switch (s.tool) {
      case 'place':
        if (placeAt(world, false)) onPlaced?.()
        return
      case 'brush': {
        dispatch({ type: 'gesture-start' })
        const placedAny = placeAt(world, true, s.styles.brushRadius * 0.6)
        gesture.current = { kind: 'stroke', last: world, touched: placedAny }
        brushAt.current = world
        markDirty()
        return
      }
      case 'erase': {
        dispatch({ type: 'gesture-start' })
        const touched = eraseAt(world)
        gesture.current = { kind: 'stroke', last: world, touched }
        brushAt.current = world
        markDirty()
        return
      }
      case 'road':
      case 'fence':
      case 'terrain': {
        const pt = snapped(world)
        if (!draft.current) draft.current = [pt, pt]
        else draft.current = [...draft.current.slice(0, -1), pt, pt]
        markDirty()
        return
      }
      case 'select': {
        const hit = pick(s.doc, world)
        if (hit) {
          const expanded = expandSelection(s.doc, [hit])
          const selKeys = selectionSet(s.selection)
          let next: Selection
          if (e.shiftKey) {
            const allIn = expanded.every((en) => selKeys.has(entryKey(en)))
            if (allIn) {
              const drop = new Set(expanded.map(entryKey))
              next = s.selection.filter((en) => !drop.has(entryKey(en)))
            } else {
              const have = new Set(s.selection.map(entryKey))
              next = [...s.selection, ...expanded.filter((en) => !have.has(entryKey(en)))]
            }
          } else {
            next = selKeys.has(entryKey(hit)) ? s.selection : expanded
          }
          dispatch({ type: 'select', sel: next })
          const stillHeld = next.some((en) => en.kind === hit.kind && en.eid === hit.eid)
          if (stillHeld) {
            gesture.current = { kind: 'drag', origin: world }
            dispatch({ type: 'gesture-start' })
          }
        } else {
          gesture.current = { kind: 'marquee', origin: world, base: e.shiftKey ? s.selection : [] }
          marquee.current = { a: world, b: world }
          if (!e.shiftKey) dispatch({ type: 'select', sel: [] })
          markDirty()
        }
        return
      }
    }
  }, [dispatch, toWorld, snapped, placeAt, eraseAt, markDirty, onPlaced, onExitPlace])

  // A piece dragged straight from the catalogue: one placement, no mode.
  const onDragOver = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    if (e.dataTransfer.types.includes('application/x-sdr-piece')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent<HTMLCanvasElement>) => {
    const key = e.dataTransfer.getData('application/x-sdr-piece')
    if (!key) return
    e.preventDefault()
    const item = findPaletteItem(key)
    if (!item) return
    if (placeAt(toWorld(e), false, 0, item)) onPlaced?.()
  }, [placeAt, toWorld, onPlaced])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = live.current
    const world = toWorld(e)
    if (coordsRef.current) {
      coordsRef.current.textContent = `${Math.round(world.x)}, ${Math.round(world.y)}`
    }

    const g = gesture.current
    if (g?.kind === 'pan') {
      cam.current.x = g.camX - (e.clientX - g.sx) / cam.current.zoom
      cam.current.y = g.camY - (e.clientY - g.sy) / cam.current.zoom
      markDirty()
      return
    }

    if (g?.kind === 'drag') {
      // Snap the delta, not the endpoints: a held group keeps its offsets.
      const rawDx = world.x - g.origin.x
      const rawDy = world.y - g.origin.y
      const dx = s.snap ? Math.round(rawDx / SNAP) * SNAP : Math.round(rawDx)
      const dy = s.snap ? Math.round(rawDy / SNAP) * SNAP : Math.round(rawDy)
      dispatch({ type: 'gesture-move', dx, dy })
      return
    }

    if (g?.kind === 'marquee') {
      marquee.current = { a: g.origin, b: world }
      const found = expandSelection(s.doc, pickInRect(s.doc, g.origin, world))
      const have = new Set(g.base.map(entryKey))
      const merged = [...g.base, ...found.filter((en) => !have.has(entryKey(en)))]
      dispatch({ type: 'select', sel: merged })
      markDirty()
      return
    }

    if (g?.kind === 'stroke') {
      brushAt.current = world
      if (s.tool === 'brush') {
        const spacing = Math.max(10, s.styles.brushRadius / Math.max(1, s.styles.brushDensity))
        if (Math.hypot(world.x - g.last.x, world.y - g.last.y) >= spacing) {
          g.last = world
          if (placeAt(world, true, s.styles.brushRadius * 0.6)) g.touched = true
        }
      } else if (s.tool === 'erase') {
        if (eraseAt(world)) g.touched = true
      }
      markDirty()
      return
    }

    if (s.tool === 'place') {
      ghost.current = snapped(world)
      markDirty()
      return
    }

    if ((s.tool === 'road' || s.tool === 'fence' || s.tool === 'terrain') && draft.current) {
      draft.current = [...draft.current.slice(0, -1), snapped(world)]
      markDirty()
      return
    }

    if (s.tool === 'brush' || s.tool === 'erase') {
      brushAt.current = world
      markDirty()
    }

    if (s.tool === 'select' || s.tool === 'erase') {
      const hit = pick(s.doc, world)
      const prev = hover.current
      if (hit?.kind !== prev?.kind || hit?.eid !== prev?.eid) {
        hover.current = hit
        markDirty()
      }
    }
  }, [dispatch, toWorld, snapped, placeAt, eraseAt, markDirty])

  const endGesture = useCallback(() => {
    const g = gesture.current
    gesture.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = ''
    if (!g) return
    if (g.kind === 'drag') {
      dispatch({ type: 'gesture-end' })
    } else if (g.kind === 'marquee') {
      marquee.current = null
      markDirty()
    } else if (g.kind === 'stroke') {
      dispatch({ type: 'gesture-end' })
      if (g.touched) (live.current.tool === 'erase' ? onDeleted : onPlaced)?.()
    }
  }, [dispatch, markDirty, onPlaced, onDeleted])

  const finishDraft = useCallback(() => {
    const s = live.current
    const pts = draft.current
    draft.current = null
    markDirty()
    if (!pts || pts.length < 3) return
    const points = pts.slice(0, -1) // last one chases the cursor
    if (points.length < 2) return
    if (s.tool === 'terrain') {
      dispatch({ type: 'add-terrain', points, style: s.styles.terrain })
    } else if (s.tool === 'road' || s.tool === 'fence') {
      dispatch({
        type: 'add-chain',
        kind: s.tool,
        points,
        style: s.tool === 'road' ? s.styles.road : s.styles.fence,
        widthScale: s.tool === 'road' ? s.styles.roadWidth : undefined,
      })
    }
    onPlaced?.()
  }, [dispatch, markDirty, onPlaced])

  const onDoubleClick = useCallback(() => {
    const s = live.current
    if (s.tool === 'road' || s.tool === 'fence' || s.tool === 'terrain') finishDraft()
  }, [finishDraft])

  // Wheel zoom wants preventDefault, and React registers root wheel listeners
  // passively, so this one is attached by hand.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const before = screenToWorld({ x: px, y: py }, cam.current, size.current.w, size.current.h)
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      cam.current.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.current.zoom * factor))
      const after = screenToWorld({ x: px, y: py }, cam.current, size.current.w, size.current.h)
      cam.current.x += before.x - after.x
      cam.current.y += before.y - after.y
      markDirty()
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [markDirty])

  // Draft-line keys live here; the page owns the rest of the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (draft.current) {
          draft.current = null
          markDirty()
          e.stopPropagation()
        }
      } else if (e.key === 'Enter' && draft.current) {
        finishDraft()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finishDraft, markDirty])

  const cursor =
    spaceHeld || tool === 'pan'
      ? 'grab'
      : tool === 'select' ? 'default' : tool === 'brush' || tool === 'erase' ? 'none' : 'crosshair'

  return (
    <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden border-y border-gold/15 bg-[#07060a]">
      <canvas
        ref={canvasRef}
        className="block touch-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onPointerLeave={() => {
          ghost.current = null
          brushAt.current = null
          markDirty()
        }}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={onDragOver}
        onDrop={onDrop}
      />
      {/* the spyglass: zoom controls riding the stage's corner */}
      <div className="absolute bottom-9 right-3 flex items-center gap-0.5 rounded border border-gold/20 bg-abyss/85 p-1 shadow-[0_2px_12px_rgba(0,0,0,.5)] backdrop-blur-sm">
        <button
          type="button"
          title="Step back"
          aria-label="Zoom out"
          className="flex h-7 w-7 items-center justify-center rounded-sm font-display text-sm text-bone hover:bg-gold/15 hover:text-gold-bright"
          onClick={() => zoomBy(1 / 1.25)}
        >
          −
        </button>
        <button
          type="button"
          title="True scale (100%)"
          aria-label="Reset zoom to 100%"
          className="flex h-7 min-w-12 items-center justify-center rounded-sm px-1 font-mono text-[11px] text-gold/90 hover:bg-gold/15 hover:text-gold-bright"
          onClick={() => zoomTo(1)}
        >
          <span ref={zoomRef}>·</span>
        </button>
        <button
          type="button"
          title="Lean in"
          aria-label="Zoom in"
          className="flex h-7 w-7 items-center justify-center rounded-sm font-display text-sm text-bone hover:bg-gold/15 hover:text-gold-bright"
          onClick={() => zoomBy(1.25)}
        >
          +
        </button>
        <span className="mx-0.5 h-5 w-px bg-gold/15" />
        <button
          type="button"
          title="Fit the whole plot"
          aria-label="Fit the whole plot"
          className="flex h-7 w-7 items-center justify-center rounded-sm font-display text-sm text-bone hover:bg-gold/15 hover:text-gold-bright"
          onClick={fit}
        >
          ▣
        </button>
      </div>

      {/* the surveyor's strip */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-4 border-t border-gold/15 bg-abyss/80 px-3 py-1.5 font-mono text-[10px] text-bone-dim backdrop-blur-sm">
        <span ref={coordsRef} className="min-w-20">·</span>
        <span className={snap ? 'text-gold/80' : 'text-bone-dim/40'}>{snap ? 'snap 16' : 'snap off'}</span>
        {selection.length > 0 && (
          <span className="text-gold/80">{selection.length} held</span>
        )}
        <span className="ml-auto hidden uppercase tracking-wider text-bone-dim/50 sm:block">{TOOL_HINT[tool]}</span>
      </div>
    </div>
  )
})

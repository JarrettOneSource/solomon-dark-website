// Canvas painter for the Boneyard stage. Pure drawing and hit-testing;
// no React in here. World units are game pixels, origin at the plot center,
// y growing downward, painter-sorted by baseline like the game draws it.

import type { EditorDoc, PlacedObject, Polyline, SelEntry, Selection, SpriteRef, StaticSprite, TerrainPatch, Vec2 } from './model'
import { entryKey, sameEntry, selectionSet } from './model'
import { spriteImage, spriteRefFor } from './assets'
import { liftedSpriteSource } from './lifted-sprite'
import {
  FENCE_GRATE_TEXTURE,
  GROUND_TEXTURE,
  ROAD_HALF_WIDTH,
  ROAD_TEXTURES,
  TERRAIN_TEXTURES,
} from './textures'

// The fence pieces RegionLayout materializes from a segment's five-code
// grammar (native-regions-npcs-and-world-props.md): posts at the endpoints,
// broken-grate halves, hinged gate leaves, and the rail bar.
const FENCE_ART = {
  post: spriteRefFor('DeadHawg', 36),
  broken: spriteRefFor('DeadHawg', 3),
  gateLeaf: spriteRefFor('DeadHawg', 7),
  gateHinge: spriteRefFor('DeadHawg', 8),
  rail: spriteRefFor('DeadHawg', 23),
}

export interface Camera {
  x: number
  y: number
  zoom: number
}

export type Tool = 'select' | 'place' | 'brush' | 'erase' | 'pan' | 'road' | 'fence' | 'terrain'

/** Per-tool option state the page owns and the stage reads. */
export interface ToolStyles {
  road: number
  roadWidth: number
  fence: number
  terrain: number
  brushRadius: number
  brushDensity: number
  eraseRadius: number
}

export interface StageUI {
  tool: Tool
  selection: Selection
  hover: SelEntry | null
  /** Sprite following the cursor on the place tool. */
  ghost: { ref: SpriteRef; pos: Vec2 } | null
  /** In-progress road/fence/terrain points, cursor last. */
  draft: Vec2[] | null
  styles: ToolStyles
  /** Rubber-band rectangle, world corners. */
  marquee: { a: Vec2; b: Vec2 } | null
  /** Brush cursor ring, world units. */
  brush: { pos: Vec2; radius: number } | null
  showGrid: boolean
  /** True while a survey (camera pan) gesture is live: the frame may come
   * from the cached scene layer instead of a full repaint. */
  panning: boolean
  /** True while a selection drag gesture is live: the still world blits from
   * the layer and only the held pieces paint per frame. */
  dragging: boolean
  /** True while a scatter-brush stroke is live: placements append into the
   * cached layer instead of forcing full repaints. */
  appending: boolean
}

export function worldToScreen(p: Vec2, cam: Camera, w: number, h: number): Vec2 {
  return { x: (p.x - cam.x) * cam.zoom + w / 2, y: (p.y - cam.y) * cam.zoom + h / 2 }
}

export function screenToWorld(p: Vec2, cam: Camera, w: number, h: number): Vec2 {
  return { x: (p.x - w / 2) / cam.zoom + cam.x, y: (p.y - h / 2) / cam.zoom + cam.y }
}

/** Everything the stage tiles; the stage preloads these and redraws as they
 * decode. */
export const STAGE_TEXTURES: string[] = [
  GROUND_TEXTURE,
  ...ROAD_TEXTURES,
  ...TERRAIN_TEXTURES,
  FENCE_GRATE_TEXTURE,
  ...Object.values(FENCE_ART).flatMap((ref) => (ref ? [ref.src] : [])),
]

interface Drawable {
  sel: SelEntry
  img: HTMLImageElement | null
  ref: SpriteRef | null
  pos: Vec2
  /** Scenery records carry their own transform (s0/s1/s2 = rot/scale/alpha). */
  rot: number
  scale: number
  alpha: number
  /** Sort baseline: the feet, not the center. */
  baseline: number
}

function drawableFor(kind: 'object' | 'sprite', item: PlacedObject | StaticSprite): Drawable {
  const img = item.sprite ? spriteImage(item.sprite.src) : null
  const spr = kind === 'sprite' ? (item as StaticSprite) : null
  return {
    sel: { kind, eid: item.eid },
    img,
    ref: item.sprite ?? null,
    pos: item.pos,
    rot: spr?.s0 ?? 0,
    scale: spr?.s1 && spr.s1 > 0 ? spr.s1 : 1,
    alpha: spr ? Math.max(0.05, Math.min(1, spr.s2 || 1)) : 1,
    baseline: item.pos.y,
  }
}

const drawableCache = new WeakMap<EditorDoc, Drawable[]>()

function drawablesFor(doc: EditorDoc): Drawable[] {
  let drawables = drawableCache.get(doc)
  if (!drawables) {
    drawables = [
      ...doc.objects.map((o) => drawableFor('object', o)),
      ...doc.sprites.map((s) => drawableFor('sprite', s)),
    ].sort((a, z) => a.baseline - z.baseline)
    drawableCache.set(doc, drawables)
  }
  return drawables
}

/** Anchored draw rect in world units, scale applied. The sprite ref carries
 * the art's registration; without one, feet on pos and centred. */
function anchoredRect(d: {
  ref: SpriteRef | null
  img: HTMLImageElement | null
  pos: Vec2
  scale?: number
}): { x: number; y: number; w: number; h: number } {
  const k = d.scale && d.scale > 0 ? d.scale : 1
  if (d.ref) {
    return {
      x: d.pos.x - d.ref.anchorX * k,
      y: d.pos.y - d.ref.anchorY * k,
      w: d.ref.w * k,
      h: d.ref.h * k,
    }
  }
  const w = (d.img?.naturalWidth ?? 48) * k
  const h = (d.img?.naturalHeight ?? 48) * k
  return { x: d.pos.x - w / 2, y: d.pos.y - h, w, h }
}

const GRID = 32

/** World-space rectangle the camera can currently see, padded so wide
 * strokes and tall fence art on the fringe still draw. */
interface ViewRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

function visibleWorld(cam: Camera, w: number, h: number, margin: number): ViewRect {
  const halfW = w / 2 / cam.zoom
  const halfH = h / 2 / cam.zoom
  return {
    x0: cam.x - halfW - margin,
    y0: cam.y - halfH - margin,
    x1: cam.x + halfW + margin,
    y1: cam.y + halfH + margin,
  }
}

/** Any point's bounding box touching the view: cheap cull for line work. */
function lineInView(points: Vec2[], view: ViewRect): boolean {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return maxX >= view.x0 && minX <= view.x1 && maxY >= view.y0 && minY <= view.y1
}

// ---------- world-anchored texture patterns ----------

const patternCache = new WeakMap<HTMLImageElement, CanvasPattern>()

function worldPattern(
  ctx: CanvasRenderingContext2D,
  src: string,
  cam: Camera,
  w: number,
  h: number,
  texScale = 1,
): CanvasPattern | null {
  const img = spriteImage(src)
  if (!img.complete || img.naturalWidth === 0) return null
  let pat = patternCache.get(img)
  if (!pat) {
    const created = ctx.createPattern(img, 'repeat')
    if (!created) return null
    patternCache.set(img, created)
    pat = created
  }
  const origin = worldToScreen({ x: 0, y: 0 }, cam, w, h)
  pat.setTransform(
    new DOMMatrix().translateSelf(origin.x, origin.y).scaleSelf(cam.zoom * texScale, cam.zoom * texScale),
  )
  return pat
}

// ---------- road geometry (mirrors the native quad derivation) ----------

export function roadQuad(points: Vec2[], startScale: number, endScale: number): Vec2[] {
  const dx = points[1].x - points[0].x
  const dy = points[1].y - points[0].y
  const length = Math.hypot(dx, dy)
  const nx = length === 0 ? 0 : -dy / length
  const ny = length === 0 ? 1 : dx / length
  const s = ROAD_HALF_WIDTH * startScale
  const e = ROAD_HALF_WIDTH * endScale
  return [
    { x: points[0].x + nx * s, y: points[0].y + ny * s },
    { x: points[0].x - nx * s, y: points[0].y - ny * s },
    { x: points[1].x + nx * e, y: points[1].y + ny * e },
    { x: points[1].x - nx * e, y: points[1].y - ny * e },
  ]
}

function quadFor(road: Polyline): Vec2[] | null {
  if (road.points.length < 2) return null
  const stored = (road as Polyline & { quad?: Vec2[] }).quad
  if (stored && stored.length === 4) return stored
  return roadQuad(road.points, road.startWidthScale ?? 1, road.endWidthScale ?? 1)
}

function tracePolygon(ctx: CanvasRenderingContext2D, pts: Vec2[]) {
  ctx.beginPath()
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.closePath()
}

// ---------- the stage ----------

// The vignette only depends on the plot's screen rectangle; while the camera
// holds still (drags, strokes, marquees) the same gradient serves every frame.
let vignetteKey = ''
let vignetteGrad: CanvasGradient | null = null

const EMPTY_SET = new Set<string>()

/** What paintWorld knows about selection: the direct path interleaves
 * outlines exactly as the stage always has; the layer path paints a clean
 * world and adds outlines on top per frame. */
interface WorldPaintUI {
  selected: Set<string>
  hover: SelEntry | null
  showGrid: boolean
}

// ---------- the gesture scene layer ----------
//
// During camera pans, marquee sweeps, and selection drags the world barely
// changes frame to frame, yet repainting it costs a thousand draw calls. So
// those gestures render the world once into an offscreen layer and each frame
// blits it, painting live only what actually moves: outlines, the held
// pieces, the gesture chrome. Every at-rest frame still takes the direct
// path, so a resting stage is pixel-identical to the classic renderer.

// Pans glide the viewport, so their layer carries extra painted world at the
// edges; every other gesture holds the camera still and skips the margin.
const LAYER_MARGIN = 256 // css px of extra world beyond each viewport edge

interface SceneLayer {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  /** World coordinates of the layer's top-left corner. */
  wx: number
  wy: number
  camX: number
  camY: number
  zoom: number
  dpr: number
  cssW: number
  cssH: number
  showGrid: boolean
  mode: 'world' | 'sans-selection' | 'append'
  doc: EditorDoc
  /** Selection identity plus per-kind eids when mode is sans-selection. */
  sel: Selection | null
  selEids: Record<'object' | 'sprite' | 'road' | 'fence' | 'terrain', Set<string>> | null
  /** How many objects/sprites are already painted in, when mode is append. */
  painted: { objects: number; sprites: number } | null
}

let sceneLayer: SceneLayer | null = null

/** Drop the cached layer; the stage calls this when a sprite or texture
 * finishes decoding so a mid-gesture frame never keeps a stale placeholder. */
export function invalidateSceneLayer() {
  sceneLayer = null
}

function selEidsByKind(sel: Selection): NonNullable<SceneLayer['selEids']> {
  const out = {
    object: new Set<string>(),
    sprite: new Set<string>(),
    road: new Set<string>(),
    fence: new Set<string>(),
    terrain: new Set<string>(),
  }
  for (const e of sel) out[e.kind].add(e.eid)
  return out
}

/** Unselected entries must be the very same objects the layer was painted
 * from; gesture-move keeps their identities, so this is a cheap ref walk. */
function sameUnselected<T extends { eid: string }>(a: T[], b: T[], sel: Set<string>): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i] && !sel.has(b[i].eid)) return false
  }
  return true
}

/** First maxLen entries of b must be the very same objects as a's. */
function samePrefix<T>(a: T[], b: T[], len: number): boolean {
  if (a.length < len || b.length < len) return false
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) return false
  return true
}

function layerUsable(mode: SceneLayer['mode'], cam: Camera, doc: EditorDoc, cssW: number, cssH: number, dpr: number, ui: StageUI): boolean {
  const L = sceneLayer
  if (!L || L.mode !== mode || L.zoom !== cam.zoom || L.dpr !== dpr || L.cssW !== cssW || L.cssH !== cssH || L.showGrid !== ui.showGrid) return false
  if (mode === 'world') {
    if (L.doc !== doc) return false
  } else if (mode === 'append') {
    // A brush stroke only ever appends placed pieces; everything painted so
    // far must still be exactly the same records, and the camera pinned.
    if (!L.painted || L.camX !== cam.x || L.camY !== cam.y) return false
    if (L.doc !== doc) {
      if (
        L.doc.meta.bounds !== doc.meta.bounds
        || L.doc.roads !== doc.roads
        || L.doc.fences !== doc.fences
        || L.doc.terrain !== doc.terrain
        || !samePrefix(L.doc.objects, doc.objects, L.painted.objects)
        || !samePrefix(L.doc.sprites, doc.sprites, L.painted.sprites)
      ) return false
    }
  } else {
    if (L.sel !== ui.selection || !L.selEids) return false
    if (L.doc !== doc) {
      if (L.doc.meta.bounds !== doc.meta.bounds) return false
      const se = L.selEids
      if (
        !sameUnselected(L.doc.objects, doc.objects, se.object)
        || !sameUnselected(L.doc.sprites, doc.sprites, se.sprite)
        || !sameUnselected(L.doc.roads, doc.roads, se.road)
        || !sameUnselected(L.doc.fences, doc.fences, se.fence)
        || !sameUnselected(L.doc.terrain, doc.terrain, se.terrain)
      ) return false
    }
  }
  // The viewport must sit inside the layer's painted world.
  const left = cam.x - cssW / 2 / cam.zoom
  const top = cam.y - cssH / 2 / cam.zoom
  const lw = L.canvas.width / L.dpr / L.zoom
  const lh = L.canvas.height / L.dpr / L.zoom
  return left >= L.wx && top >= L.wy && left + cssW / cam.zoom <= L.wx + lw && top + cssH / cam.zoom <= L.wy + lh
}

/** Stamp any pieces the stroke added since the layer was painted. Painter
 * order inside the gesture is approximate (new pieces land on top); the
 * direct frame after the stroke restores true sorting. */
function reconcileAppend(cam: Camera, doc: EditorDoc) {
  const L = sceneLayer!
  if (L.doc === doc || !L.painted) return
  const fresh = new Set<string>()
  for (let i = L.painted.objects; i < doc.objects.length; i++) fresh.add(`object:${doc.objects[i].eid}`)
  for (let i = L.painted.sprites; i < doc.sprites.length; i++) fresh.add(`sprite:${doc.sprites[i].eid}`)
  if (fresh.size > 0) {
    const lw = L.canvas.width / L.dpr
    const lh = L.canvas.height / L.dpr
    paintDrawables(L.ctx, doc, cam, lw, lh, EMPTY_SET, null, { only: fresh })
  }
  L.painted = { objects: doc.objects.length, sprites: doc.sprites.length }
  L.doc = doc
}

function renderLayer(mode: SceneLayer['mode'], margin: number, cam: Camera, doc: EditorDoc, cssW: number, cssH: number, dpr: number, ui: StageUI): boolean {
  const lw = cssW + margin * 2
  const lh = cssH + margin * 2
  const pw = Math.round(lw * dpr)
  const ph = Math.round(lh * dpr)
  let L = sceneLayer
  if (!L || L.canvas.width !== pw || L.canvas.height !== ph) {
    const canvas = document.createElement('canvas')
    canvas.width = pw
    canvas.height = ph
    const lctx = canvas.getContext('2d', { alpha: false })
    if (!lctx) return false
    L = sceneLayer = {
      canvas, ctx: lctx, wx: 0, wy: 0, camX: 0, camY: 0, zoom: 1, dpr: 1, cssW: 0, cssH: 0,
      showGrid: true, mode: 'world', doc, sel: null, selEids: null, painted: null,
    }
  }
  L.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const skip = mode === 'sans-selection' ? selectionSet(ui.selection) : undefined
  paintWorld(L.ctx, lw, lh, cam, doc, { selected: EMPTY_SET, hover: null, showGrid: ui.showGrid }, skip)
  L.wx = cam.x - lw / 2 / cam.zoom
  L.wy = cam.y - lh / 2 / cam.zoom
  L.camX = cam.x
  L.camY = cam.y
  L.zoom = cam.zoom
  L.dpr = dpr
  L.cssW = cssW
  L.cssH = cssH
  L.showGrid = ui.showGrid
  L.mode = mode
  L.doc = doc
  L.sel = mode === 'sans-selection' ? ui.selection : null
  L.selEids = mode === 'sans-selection' ? selEidsByKind(ui.selection) : null
  L.painted = mode === 'append' ? { objects: doc.objects.length, sprites: doc.sprites.length } : null
  return true
}

function blitLayer(ctx: CanvasRenderingContext2D, cam: Camera, cssW: number, cssH: number) {
  const L = sceneLayer!
  const left = cam.x - cssW / 2 / cam.zoom
  const top = cam.y - cssH / 2 / cam.zoom
  // Rounded to whole device pixels: a straight memcpy-style blit, and any
  // half-pixel drift only exists mid-gesture (rest frames draw direct).
  const sx = (L.wx - left) * cam.zoom * L.dpr
  const sy = (L.wy - top) * cam.zoom * L.dpr
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(L.canvas, Math.round(sx), Math.round(sy))
  ctx.restore()
}

export function drawStage(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  cam: Camera,
  doc: EditorDoc,
  ui: StageUI,
) {
  const mode: SceneLayer['mode'] | null =
    ui.dragging && ui.selection.length > 0
      ? 'sans-selection'
      : ui.appending
        ? 'append'
        : ui.panning || ui.marquee
          ? 'world'
          : null
  if (mode) {
    const dpr = ctx.getTransform().a || 1
    const margin = ui.panning ? LAYER_MARGIN : 0
    const usable = layerUsable(mode, cam, doc, cssW, cssH, dpr, ui)
    if (usable && mode === 'append') reconcileAppend(cam, doc)
    if (usable || renderLayer(mode, margin, cam, doc, cssW, cssH, dpr, ui)) {
      blitLayer(ctx, cam, cssW, cssH)
      const view = visibleWorld(cam, cssW, cssH, 256)
      const selected = selectionSet(ui.selection)
      if (mode === 'sans-selection') {
        // The held pieces travel live above the frozen ground, in the same
        // kind order the world paints them.
        for (const t of doc.terrain) {
          if (!selected.has(`terrain:${t.eid}`)) continue
          if (t.points && t.points.length >= 2 && !lineInView(t.points, view)) continue
          drawTerrain(ctx, t, cam, cssW, cssH, true, false)
        }
        const heldRoads = doc.roads.filter((r) => selected.has(`road:${r.eid}`))
        drawRoads(ctx, heldRoads, cam, cssW, cssH, view, selected, null)
        for (const f of doc.fences) {
          if (!selected.has(`fence:${f.eid}`) || !lineInView(f.points, view)) continue
          drawFence(ctx, f, cam, cssW, cssH, true, false)
        }
        paintDrawables(ctx, doc, cam, cssW, cssH, selected, null, { only: selected })
      } else {
        lineOverlays(ctx, doc, cam, cssW, cssH, view, selected, ui.hover)
        paintDrawableOutlines(ctx, doc, cam, cssW, cssH, selected, ui.hover)
      }
      drawTransientOverlays(ctx, ui, cam, cssW, cssH)
      return
    }
  }
  paintWorld(ctx, cssW, cssH, cam, doc, { selected: selectionSet(ui.selection), hover: ui.hover, showGrid: ui.showGrid })
  drawTransientOverlays(ctx, ui, cam, cssW, cssH)
}

/** Dashed held/hover strokes for lines, drawn over a blitted layer. Styles
 * mirror the interleaved ones in drawTerrain/drawRoads/drawFence. */
function lineOverlays(
  ctx: CanvasRenderingContext2D,
  doc: EditorDoc,
  cam: Camera,
  w: number,
  h: number,
  view: ViewRect,
  selected: Set<string>,
  hover: SelEntry | null,
) {
  if (selected.size === 0 && !hover) return
  ctx.save()
  for (const t of doc.terrain) {
    const isSel = selected.has(`terrain:${t.eid}`)
    if (!isSel && !sameEntry(hover, { kind: 'terrain', eid: t.eid })) continue
    const points = t.points && t.points.length >= 2 ? t.points : null
    if (!points || !lineInView(points, view)) continue
    ctx.strokeStyle = isSel ? 'rgba(240,212,145,0.9)' : 'rgba(230,220,195,0.4)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    strokePath(ctx, points.map((p) => worldToScreen(p, cam, w, h)))
  }
  for (const road of doc.roads) {
    const isSel = selected.has(`road:${road.eid}`)
    if (!isSel && !sameEntry(hover, { kind: 'road', eid: road.eid })) continue
    if (!lineInView(road.points, view)) continue
    const quad = quadFor(road)
    if (!quad) continue
    ctx.strokeStyle = isSel ? 'rgba(240,212,145,0.9)' : 'rgba(230,220,195,0.4)'
    ctx.lineWidth = 1.5
    ctx.setLineDash(isSel ? [] : [5, 4])
    tracePolygon(ctx, [quad[0], quad[2], quad[3], quad[1]].map((p) => worldToScreen(p, cam, w, h)))
    ctx.stroke()
  }
  for (const fence of doc.fences) {
    const isSel = selected.has(`fence:${fence.eid}`)
    if (!isSel && !sameEntry(hover, { kind: 'fence', eid: fence.eid })) continue
    if (!lineInView(fence.points, view)) continue
    ctx.strokeStyle = isSel ? 'rgba(240,212,145,0.9)' : 'rgba(230,220,195,0.35)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    strokePath(ctx, fence.points.map((p) => worldToScreen(p, cam, w, h)))
  }
  ctx.restore()
}

/** Held/hover rectangles for placed pieces, drawn over a blitted layer. */
function paintDrawableOutlines(
  ctx: CanvasRenderingContext2D,
  doc: EditorDoc,
  cam: Camera,
  w: number,
  h: number,
  selected: Set<string>,
  hover: SelEntry | null,
) {
  if (selected.size === 0 && !hover) return
  for (const d of drawablesFor(doc)) {
    const isSel = selected.has(entryKey(d.sel))
    const isHover = !isSel && sameEntry(hover, d.sel)
    if (!isSel && !isHover) continue
    const r = anchoredRect(d)
    const s = worldToScreen({ x: r.x, y: r.y }, cam, w, h)
    const drawW = r.w * cam.zoom
    const drawH = r.h * cam.zoom
    if (s.x + drawW < 0 || s.y + drawH < 0 || s.x > w || s.y > h) continue
    drawableOutline(ctx, s.x, s.y, drawW, drawH, isSel)
  }
}

function drawableOutline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, isSel: boolean) {
  ctx.save()
  ctx.strokeStyle = isSel ? 'rgba(240,212,145,0.95)' : 'rgba(230,220,195,0.4)'
  ctx.lineWidth = isSel ? 1.5 : 1
  ctx.setLineDash(isSel ? [] : [4, 3])
  ctx.strokeRect(x - 2, y - 2, w + 4, h + 4)
  if (isSel) {
    ctx.shadowColor = 'rgba(200,168,98,0.8)'
    ctx.shadowBlur = 10
    ctx.strokeRect(x - 2, y - 2, w + 4, h + 4)
  }
  ctx.restore()
}

function paintWorld(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  cam: Camera,
  doc: EditorDoc,
  wui: WorldPaintUI,
  skip?: Set<string>,
) {
  // The void beyond the plot. The context is opaque (alpha: false), and this
  // covers every pixel, so no clear pass is needed.
  ctx.fillStyle = '#07060a'
  ctx.fillRect(0, 0, cssW, cssH)

  const b = doc.meta.bounds
  const tl = worldToScreen({ x: b.x, y: b.y }, cam, cssW, cssH)
  const br = worldToScreen({ x: b.x + b.w, y: b.y + b.h }, cam, cssW, cssH)
  const selected = wui.selected
  // Fence art can tower ~220 world px above its baseline; pad the cull rect
  // so nothing pops at the fringe.
  const view = visibleWorld(cam, cssW, cssH, 256)

  // Consecrated ground: the arena field itself, sampled from the retail
  // editor's render (the base fill is generated in-game, not a loose file),
  // tiled at native scale with a whisper of the site's gloom.
  const groundPat = worldPattern(ctx, GROUND_TEXTURE, cam, cssW, cssH, 1)
  if (groundPat) {
    ctx.fillStyle = groundPat
    ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y)
    ctx.fillStyle = 'rgba(8, 12, 8, 0.1)'
    ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y)
  } else {
    ctx.fillStyle = '#22251f'
    ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y)
  }
  const vigKey = `${tl.x.toFixed(1)},${tl.y.toFixed(1)},${br.x.toFixed(1)},${br.y.toFixed(1)}`
  if (vigKey !== vignetteKey || !vignetteGrad) {
    vignetteGrad = ctx.createRadialGradient(
      (tl.x + br.x) / 2, (tl.y + br.y) / 2, Math.min(br.x - tl.x, br.y - tl.y) * 0.3,
      (tl.x + br.x) / 2, (tl.y + br.y) / 2, Math.max(br.x - tl.x, br.y - tl.y) * 0.75,
    )
    vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)')
    vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.22)')
    vignetteKey = vigKey
  }
  ctx.fillStyle = vignetteGrad
  ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y)

  // Survey grid: the step widens as the camera pulls out so the lines stay
  // an honest surveyor's grid instead of vanishing or turning to noise.
  if (wui.showGrid) {
    let step = GRID
    while (step * cam.zoom < 26 && step < 4096) step *= 2
    ctx.save()
    ctx.beginPath()
    ctx.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y)
    ctx.clip()
    ctx.lineWidth = 1
    // Only the lines crossing the viewport, and one batched stroke per
    // weight instead of a stroke per line.
    const wx0 = Math.max(b.x, view.x0)
    const wx1 = Math.min(b.x + b.w, view.x1)
    const wy0 = Math.max(b.y, view.y0)
    const wy1 = Math.min(b.y + b.h, view.y1)
    const yTop = Math.max(tl.y, 0)
    const yBot = Math.min(br.y, cssH)
    const xLeft = Math.max(tl.x, 0)
    const xRight = Math.min(br.x, cssW)
    for (const major of [false, true]) {
      ctx.strokeStyle = major ? 'rgba(200, 168, 98, 0.14)' : 'rgba(200, 168, 98, 0.07)'
      ctx.beginPath()
      for (let wx = Math.ceil(wx0 / step) * step; wx <= wx1; wx += step) {
        if ((wx % (step * 4) === 0) !== major) continue
        const x = tl.x + (wx - b.x) * cam.zoom
        ctx.moveTo(x, yTop)
        ctx.lineTo(x, yBot)
      }
      for (let wy = Math.ceil(wy0 / step) * step; wy <= wy1; wy += step) {
        if ((wy % (step * 4) === 0) !== major) continue
        const y = tl.y + (wy - b.y) * cam.zoom
        ctx.moveTo(xLeft, y)
        ctx.lineTo(xRight, y)
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  // Terrain lies lowest: rivers and rises carved into the ground.
  for (const t of doc.terrain) {
    if (skip?.has(`terrain:${t.eid}`)) continue
    if (t.points && t.points.length >= 2 && !lineInView(t.points, view)) continue
    drawTerrain(ctx, t, cam, cssW, cssH, selected.has(`terrain:${t.eid}`), sameEntry(wui.hover, { kind: 'terrain', eid: t.eid }))
  }

  // Roads on the ground, quad by native quad.
  drawRoads(ctx, skip ? doc.roads.filter((r) => !skip.has(`road:${r.eid}`)) : doc.roads, cam, cssW, cssH, view, selected, wui.hover)

  // Fences: the game's grate and wall art along each segment.
  for (const f of doc.fences) {
    if (skip?.has(`fence:${f.eid}`)) continue
    if (!lineInView(f.points, view)) continue
    drawFence(ctx, f, cam, cssW, cssH, selected.has(`fence:${f.eid}`), sameEntry(wui.hover, { kind: 'fence', eid: f.eid }))
  }

  // Objects and scenery sprites, painter-sorted together.
  paintDrawables(ctx, doc, cam, cssW, cssH, selected, wui.hover, skip ? { skip } : undefined)

  // Plot boundary: the property line, in gold.
  ctx.save()
  ctx.strokeStyle = 'rgba(200,168,98,0.4)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([10, 6])
  ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y)
  ctx.restore()
}

/** The painter-sorted sprite pass, filterable so the layer path can leave
 * held pieces out (skip) or draw exactly the held pieces live (only). */
function paintDrawables(
  ctx: CanvasRenderingContext2D,
  doc: EditorDoc,
  cam: Camera,
  cssW: number,
  cssH: number,
  selected: Set<string>,
  hover: SelEntry | null,
  filter?: { only?: Set<string>; skip?: Set<string> },
) {
  const drawables = drawablesFor(doc)
  ctx.imageSmoothingEnabled = cam.zoom < 1

  for (const d of drawables) {
    if (filter) {
      const key = entryKey(d.sel)
      if (filter.only && !filter.only.has(key)) continue
      if (filter.skip && filter.skip.has(key)) continue
    }
    const r = anchoredRect(d)
    const s = worldToScreen({ x: r.x, y: r.y }, cam, cssW, cssH)
    const drawW = r.w * cam.zoom
    const drawH = r.h * cam.zoom
    // Rotation can swing a corner beyond the unrotated sprite rectangle, so
    // rotated scenery gets a conservative margin at the viewport edge.
    const cullMargin = d.rot === 0 ? 0 : Math.max(drawW, drawH)
    if (
      s.x + drawW < -cullMargin || s.y + drawH < -cullMargin
      || s.x > cssW + cullMargin || s.y > cssH + cullMargin
    ) continue
    const isSel = selected.has(entryKey(d.sel))
    const isHover = !isSel && sameEntry(hover, d.sel)

    // Rooting shadow so pieces sit in the ground instead of on it.
    const foot = worldToScreen(d.pos, cam, cssW, cssH)
    ctx.fillStyle = 'rgba(0,0,0,0.42)'
    ctx.beginPath()
    ctx.ellipse(foot.x, foot.y, (r.w / 2.6) * cam.zoom, Math.max(3, r.w / 7) * cam.zoom, 0, 0, Math.PI * 2)
    ctx.fill()

    const image = d.img && d.img.complete && d.img.naturalWidth > 0
      ? liftedSpriteSource(d.img)
      : null
    if (image) {
      if (d.rot !== 0 && d.ref) {
        ctx.save()
        ctx.globalAlpha = d.alpha
        ctx.translate(foot.x, foot.y)
        ctx.rotate((d.rot * Math.PI) / 180)
        ctx.drawImage(
          image,
          -d.ref.anchorX * d.scale * cam.zoom,
          -d.ref.anchorY * d.scale * cam.zoom,
          drawW,
          drawH,
        )
        ctx.restore()
      } else if (d.alpha !== 1) {
        ctx.save()
        ctx.globalAlpha = d.alpha
        ctx.drawImage(image, s.x, s.y, drawW, drawH)
        ctx.restore()
      } else {
        ctx.drawImage(image, s.x, s.y, drawW, drawH)
      }
    } else {
      ctx.fillStyle = 'rgba(200,168,98,0.2)'
      ctx.fillRect(s.x, s.y, drawW, drawH)
    }

    if (isSel || isHover) {
      drawableOutline(ctx, s.x, s.y, drawW, drawH, isSel)
    }
  }
}

/** The gesture chrome above everything: place ghost, draft path, marquee,
 * brush ring. Shared verbatim by the direct and layered paths. */
function drawTransientOverlays(
  ctx: CanvasRenderingContext2D,
  ui: StageUI,
  cam: Camera,
  cssW: number,
  cssH: number,
) {
  // Ghost of the piece about to be placed.
  if (ui.ghost) {
    const img = spriteImage(ui.ghost.ref.src)
    if (img.complete && img.naturalWidth > 0) {
      const r = anchoredRect({ ref: ui.ghost.ref, img, pos: ui.ghost.pos })
      const g = worldToScreen({ x: r.x, y: r.y }, cam, cssW, cssH)
      ctx.save()
      ctx.globalAlpha = 0.55
      ctx.drawImage(liftedSpriteSource(img), g.x, g.y, r.w * cam.zoom, r.h * cam.zoom)
      ctx.globalAlpha = 0.9
      const foot = worldToScreen(ui.ghost.pos, cam, cssW, cssH)
      ctx.strokeStyle = 'rgba(65,227,255,0.6)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(foot.x, foot.y, (r.w / 2.6) * cam.zoom, Math.max(3, r.w / 7) * cam.zoom, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }

  // Path in the drawing: preview with the real surface art.
  if (ui.draft && ui.draft.length > 1) {
    drawDraftPath(ctx, ui, cam, cssW, cssH)
  }

  // Rubber-band rectangle.
  if (ui.marquee) {
    const a = worldToScreen(ui.marquee.a, cam, cssW, cssH)
    const z = worldToScreen(ui.marquee.b, cam, cssW, cssH)
    const x = Math.min(a.x, z.x)
    const y = Math.min(a.y, z.y)
    const w = Math.abs(a.x - z.x)
    const h = Math.abs(a.y - z.y)
    ctx.save()
    ctx.fillStyle = 'rgba(200,168,98,0.08)'
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = 'rgba(240,212,145,0.8)'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 4])
    ctx.strokeRect(x, y, w, h)
    ctx.restore()
  }

  // Brush ring.
  if (ui.brush) {
    const c = worldToScreen(ui.brush.pos, cam, cssW, cssH)
    const r = ui.brush.radius * cam.zoom
    ctx.save()
    ctx.strokeStyle = ui.tool === 'erase' ? 'rgba(196,74,58,0.85)' : 'rgba(65,227,255,0.75)'
    ctx.fillStyle = ui.tool === 'erase' ? 'rgba(196,74,58,0.07)' : 'rgba(65,227,255,0.05)'
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}

function drawRoads(
  ctx: CanvasRenderingContext2D,
  roads: Polyline[],
  cam: Camera,
  w: number,
  h: number,
  view: ViewRect,
  selected: Set<string>,
  hover: SelEntry | null,
) {
  if (roads.length === 0) return
  // Group by texture style so each pattern binds once; skip what the camera
  // cannot see.
  const byStyle = new Map<number, Polyline[]>()
  for (const r of roads) {
    if (!lineInView(r.points, view)) continue
    const style = Math.max(0, Math.min(ROAD_TEXTURES.length - 1, r.style ?? 0))
    const list = byStyle.get(style) ?? []
    list.push(r)
    byStyle.set(style, list)
  }
  for (const [style, list] of byStyle) {
    const pat = worldPattern(ctx, ROAD_TEXTURES[style], cam, w, h)
    ctx.save()
    for (const road of list) {
      const quad = quadFor(road)
      if (!quad) continue
      const pts = [quad[0], quad[2], quad[3], quad[1]].map((p) => worldToScreen(p, cam, w, h))
      ctx.fillStyle = pat ?? '#241c15'
      tracePolygon(ctx, pts)
      ctx.fill()
      // A soft edge line grounds the surface.
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = Math.max(1, 2 * cam.zoom)
      ctx.stroke()
      // Seam cover where chained segments meet.
      if (road.points.length === 2) {
        const endScale = (road.endWidthScale ?? 1) * ROAD_HALF_WIDTH
        const end = worldToScreen(road.points[1], cam, w, h)
        ctx.fillStyle = pat ?? '#241c15'
        ctx.beginPath()
        ctx.arc(end.x, end.y, Math.max(0, endScale * cam.zoom - 1), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()

    for (const road of list) {
      const isSel = selected.has(`road:${road.eid}`)
      const isHover = !isSel && sameEntry(hover, { kind: 'road', eid: road.eid })
      if (!isSel && !isHover) continue
      const quad = quadFor(road)
      if (!quad) continue
      const pts = [quad[0], quad[2], quad[3], quad[1]].map((p) => worldToScreen(p, cam, w, h))
      ctx.save()
      ctx.strokeStyle = isSel ? 'rgba(240,212,145,0.9)' : 'rgba(230,220,195,0.4)'
      ctx.lineWidth = 1.5
      ctx.setLineDash(isSel ? [] : [5, 4])
      tracePolygon(ctx, pts)
      ctx.stroke()
      ctx.restore()
    }
  }
}

function drawTerrain(
  ctx: CanvasRenderingContext2D,
  t: TerrainPatch,
  cam: Camera,
  w: number,
  h: number,
  isSel: boolean,
  isHover: boolean,
) {
  const points = t.points && t.points.length >= 2 ? t.points : null
  if (!points) return
  const style = Math.max(0, Math.min(1, t.style ?? t.entry ?? 0))
  const pat = worldPattern(ctx, TERRAIN_TEXTURES[style], cam, w, h)
  const pts = points.map((p) => worldToScreen(p, cam, w, h))
  const width = (style === 0 ? 96 : 64) * cam.zoom

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  // Carved bed under the surface.
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = width + Math.max(2, 5 * cam.zoom)
  strokePath(ctx, pts)
  ctx.strokeStyle = pat ?? (style === 0 ? '#12222a' : '#242e22')
  ctx.lineWidth = width
  strokePath(ctx, pts)
  if (style === 0) {
    // Water sheen down the middle of a river.
    ctx.strokeStyle = 'rgba(65,227,255,0.12)'
    ctx.lineWidth = width * 0.45
    strokePath(ctx, pts)
  }
  if (isSel || isHover) {
    ctx.strokeStyle = isSel ? 'rgba(240,212,145,0.9)' : 'rgba(230,220,195,0.4)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    strokePath(ctx, pts)
  }
  ctx.restore()
}

/** Draw a fence-family sprite with its feet at a world point. */
function plantArt(
  ctx: CanvasRenderingContext2D,
  ref: SpriteRef | null,
  at: Vec2,
  cam: Camera,
  w: number,
  h: number,
  mirror = false,
) {
  if (!ref) return false
  const img = spriteImage(ref.src)
  if (!img.complete || img.naturalWidth === 0) return false
  const s = worldToScreen(at, cam, w, h)
  ctx.save()
  ctx.translate(s.x, s.y)
  if (mirror) ctx.scale(-1, 1)
  ctx.drawImage(liftedSpriteSource(img), -ref.anchorX * cam.zoom, -ref.anchorY * cam.zoom, ref.w * cam.zoom, ref.h * cam.zoom)
  ctx.restore()
  return true
}

function drawFence(
  ctx: CanvasRenderingContext2D,
  fence: Polyline,
  cam: Camera,
  w: number,
  h: number,
  isSel: boolean,
  isHover: boolean,
) {
  if (fence.points.length < 2) return
  const code = fence.segmentCode ?? fence.style ?? 0
  const a = fence.points[0]
  const z = fence.points[1]
  const len = Math.hypot(z.x - a.x, z.y - a.y)
  if (len === 0) return
  const at = (t: number): Vec2 => ({ x: a.x + (z.x - a.x) * t, y: a.y + (z.y - a.y) * t })

  ctx.save()
  if (code === 3) {
    // Wall: the game builds a generated mesh (WallTop is a dormant load), so
    // the editor draws the same idea: a heavy stone band with a lit cap.
    const pts = [worldToScreen(a, cam, w, h), worldToScreen(z, cam, w, h)]
    ctx.lineCap = 'butt'
    ctx.strokeStyle = '#101014'
    ctx.lineWidth = 26 * cam.zoom
    strokePath(ctx, pts)
    ctx.strokeStyle = '#3a3a42'
    ctx.lineWidth = 20 * cam.zoom
    strokePath(ctx, pts)
    ctx.strokeStyle = '#55555e'
    ctx.lineWidth = 8 * cam.zoom
    strokePath(ctx, pts)
  } else if (code === 4) {
    // Rails: the rail bar art repeated along a thin run.
    const rail = FENCE_ART.rail
    const railW = rail?.w ?? 90
    const count = Math.max(1, Math.round(len / railW))
    let drew = false
    for (let i = 0; i < count; i++) {
      drew = plantArt(ctx, rail, at((i + 0.5) / count), cam, w, h) || drew
    }
    if (!drew) {
      ctx.strokeStyle = '#2c2620'
      ctx.lineWidth = Math.max(1.5, 3 * cam.zoom)
      strokePath(ctx, [worldToScreen(a, cam, w, h), worldToScreen(z, cam, w, h)])
    }
  } else if (code === 1) {
    // Broken grate: two fallen halves, one leaning from each end.
    plantArt(ctx, FENCE_ART.broken, at(0.28), cam, w, h)
    plantArt(ctx, FENCE_ART.broken, at(0.72), cam, w, h, true)
  } else if (code === 2) {
    // Gate: two hinged leaves meeting at the middle, hinge on top.
    plantArt(ctx, FENCE_ART.gateLeaf, at(0.26), cam, w, h)
    plantArt(ctx, FENCE_ART.gateLeaf, at(0.74), cam, w, h, true)
    plantArt(ctx, FENCE_ART.gateHinge, at(0.5), cam, w, h)
  } else {
    // Intact grate: repeated loose fencegrate quads, exactly as materialized.
    const img = spriteImage(FENCE_GRATE_TEXTURE)
    if (img.complete && img.naturalWidth > 0) {
      const tileW = img.naturalWidth
      const count = Math.max(1, Math.round(len / tileW))
      const step = len / count
      for (let i = 0; i < count; i++) {
        const s = worldToScreen(at((i + 0.5) / count), cam, w, h)
        ctx.drawImage(
          img,
          s.x - (step / 2) * cam.zoom,
          s.y - img.naturalHeight * cam.zoom,
          step * cam.zoom,
          img.naturalHeight * cam.zoom,
        )
      }
    } else {
      ctx.strokeStyle = '#2c2620'
      ctx.lineWidth = Math.max(1.5, 3 * cam.zoom)
      strokePath(ctx, [worldToScreen(a, cam, w, h), worldToScreen(z, cam, w, h)])
    }
  }

  // Endpoint posts for the grate family, as the five-code expansion does.
  if (code !== 3) {
    plantArt(ctx, FENCE_ART.post, a, cam, w, h)
    plantArt(ctx, FENCE_ART.post, z, cam, w, h)
  }

  if (isSel || isHover) {
    ctx.strokeStyle = isSel ? 'rgba(240,212,145,0.9)' : 'rgba(230,220,195,0.35)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    strokePath(ctx, fence.points.map((p) => worldToScreen(p, cam, w, h)))
  }
  ctx.restore()
}

function drawDraftPath(ctx: CanvasRenderingContext2D, ui: StageUI, cam: Camera, w: number, h: number) {
  const draft = ui.draft!
  const pts = draft.map((p) => worldToScreen(p, cam, w, h))
  ctx.save()
  ctx.globalAlpha = 0.62
  if (ui.tool === 'road') {
    const style = Math.max(0, Math.min(ROAD_TEXTURES.length - 1, ui.styles.road))
    const pat = worldPattern(ctx, ROAD_TEXTURES[style], cam, w, h)
    ctx.strokeStyle = pat ?? '#241c15'
    ctx.lineWidth = 2 * ROAD_HALF_WIDTH * ui.styles.roadWidth * cam.zoom
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    strokePath(ctx, pts)
  } else if (ui.tool === 'terrain') {
    const style = Math.max(0, Math.min(1, ui.styles.terrain))
    const pat = worldPattern(ctx, TERRAIN_TEXTURES[style], cam, w, h)
    ctx.strokeStyle = pat ?? '#12222a'
    ctx.lineWidth = (style === 0 ? 96 : 64) * cam.zoom
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    strokePath(ctx, pts)
  } else {
    ctx.strokeStyle = '#2c2620'
    ctx.lineWidth = Math.max(1.5, 3 * cam.zoom)
    strokePath(ctx, pts)
  }
  ctx.globalAlpha = 0.9
  ctx.strokeStyle = 'rgba(65,227,255,0.8)'
  ctx.lineWidth = 1.25
  ctx.setLineDash([8, 5])
  ctx.lineJoin = 'round'
  strokePath(ctx, pts)
  ctx.setLineDash([])
  for (const p of pts) {
    ctx.fillStyle = '#41e3ff'
    ctx.beginPath()
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function strokePath(ctx: CanvasRenderingContext2D, pts: Vec2[]) {
  ctx.beginPath()
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.stroke()
}

/** Evenly spaced points along a polyline, endpoints included. */
export function postsAlong(points: Vec2[], spacing: number): Vec2[] {
  const out: Vec2[] = []
  if (points.length === 0) return out
  out.push(points[0])
  let carry = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const z = points[i]
    const len = Math.hypot(z.x - a.x, z.y - a.y)
    if (len === 0) continue
    let d = spacing - carry
    while (d <= len) {
      out.push({ x: a.x + ((z.x - a.x) * d) / len, y: a.y + ((z.y - a.y) * d) / len })
      d += spacing
    }
    carry = (len + carry) % spacing
  }
  return out
}

// ---------- hit testing ----------

function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y
    const xj = poly[j].x, yj = poly[j].y
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Topmost thing under the cursor, respecting draw order (later = on top). */
export function pick(doc: EditorDoc, world: Vec2): SelEntry | null {
  const drawables = drawablesFor(doc)

  for (let i = drawables.length - 1; i >= 0; i--) {
    const r = anchoredRect(drawables[i])
    if (world.x >= r.x && world.x <= r.x + r.w && world.y >= r.y && world.y <= r.y + r.h) {
      return drawables[i].sel
    }
  }

  for (let i = doc.fences.length - 1; i >= 0; i--) {
    const line = doc.fences[i]
    for (let j = 1; j < line.points.length; j++) {
      if (distToSegment(world, line.points[j - 1], line.points[j]) <= 10) {
        return { kind: 'fence', eid: line.eid }
      }
    }
  }

  for (let i = doc.roads.length - 1; i >= 0; i--) {
    const quad = quadFor(doc.roads[i])
    if (quad && pointInPolygon(world, [quad[0], quad[2], quad[3], quad[1]])) {
      return { kind: 'road', eid: doc.roads[i].eid }
    }
  }

  for (let i = doc.terrain.length - 1; i >= 0; i--) {
    const t = doc.terrain[i]
    const pts = t.points
    if (!pts || pts.length < 2) continue
    const tol = (t.style ?? t.entry ?? 0) === 0 ? 48 : 34
    for (let j = 1; j < pts.length; j++) {
      if (distToSegment(world, pts[j - 1], pts[j]) <= tol) {
        return { kind: 'terrain', eid: t.eid }
      }
    }
  }

  return null
}

/** Everything intersecting a world-space rectangle (marquee). */
export function pickInRect(doc: EditorDoc, a: Vec2, b: Vec2): SelEntry[] {
  const x0 = Math.min(a.x, b.x)
  const x1 = Math.max(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const y1 = Math.max(a.y, b.y)
  const inRect = (p: Vec2) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1
  const out: SelEntry[] = []
  for (const o of doc.objects) if (inRect(o.pos)) out.push({ kind: 'object', eid: o.eid })
  for (const s of doc.sprites) if (inRect(s.pos)) out.push({ kind: 'sprite', eid: s.eid })
  for (const r of doc.roads) if (r.points.some(inRect)) out.push({ kind: 'road', eid: r.eid })
  for (const f of doc.fences) if (f.points.some(inRect)) out.push({ kind: 'fence', eid: f.eid })
  for (const t of doc.terrain) if ((t.points ?? [t.pos]).some(inRect)) out.push({ kind: 'terrain', eid: t.eid })
  return out
}

/** Everything within a world-space radius (the erase brush). */
export function pickInRadius(doc: EditorDoc, pos: Vec2, radius: number): SelEntry[] {
  const out: SelEntry[] = []
  const near = (p: Vec2) => Math.hypot(p.x - pos.x, p.y - pos.y) <= radius
  for (const o of doc.objects) if (near(o.pos)) out.push({ kind: 'object', eid: o.eid })
  for (const s of doc.sprites) if (near(s.pos)) out.push({ kind: 'sprite', eid: s.eid })
  const lineNear = (points: Vec2[]) => {
    for (let j = 1; j < points.length; j++) {
      if (distToSegment(pos, points[j - 1], points[j]) <= radius) return true
    }
    return points.length === 1 ? near(points[0]) : false
  }
  for (const r of doc.roads) if (lineNear(r.points)) out.push({ kind: 'road', eid: r.eid })
  for (const f of doc.fences) if (lineNear(f.points)) out.push({ kind: 'fence', eid: f.eid })
  for (const t of doc.terrain) if (lineNear(t.points ?? [t.pos])) out.push({ kind: 'terrain', eid: t.eid })
  return out
}

function distToSegment(p: Vec2, a: Vec2, z: Vec2): number {
  const dx = z.x - a.x
  const dy = z.y - a.y
  const lenSq = dx * dx + dy * dy
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

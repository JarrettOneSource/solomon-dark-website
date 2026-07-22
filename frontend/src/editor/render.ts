// Canvas painter for the Boneyard stage. Pure drawing and hit-testing;
// no React in here. World units are game pixels, origin at the plot center,
// y growing downward, painter-sorted by baseline like the game draws it.

import type { EditorDoc, PlacedObject, Polyline, SelEntry, Selection, SpriteRef, StaticSprite, TerrainPatch, Vec2 } from './model'
import { entryKey, sameEntry, selectionSet } from './model'
import { spriteImage, spriteRefFor } from './assets'
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
    img: img && img.complete && img.naturalWidth > 0 ? img : null,
    ref: item.sprite ?? null,
    pos: item.pos,
    rot: spr?.s0 ?? 0,
    scale: spr?.s1 && spr.s1 > 0 ? spr.s1 : 1,
    alpha: spr ? Math.max(0.05, Math.min(1, spr.s2 || 1)) : 1,
    baseline: item.pos.y,
  }
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

export function drawStage(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  cam: Camera,
  doc: EditorDoc,
  ui: StageUI,
) {
  ctx.clearRect(0, 0, cssW, cssH)

  // The void beyond the plot.
  ctx.fillStyle = '#07060a'
  ctx.fillRect(0, 0, cssW, cssH)

  const b = doc.meta.bounds
  const tl = worldToScreen({ x: b.x, y: b.y }, cam, cssW, cssH)
  const br = worldToScreen({ x: b.x + b.w, y: b.y + b.h }, cam, cssW, cssH)
  const selected = selectionSet(ui.selection)

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
  const vignette = ctx.createRadialGradient(
    (tl.x + br.x) / 2, (tl.y + br.y) / 2, Math.min(br.x - tl.x, br.y - tl.y) * 0.3,
    (tl.x + br.x) / 2, (tl.y + br.y) / 2, Math.max(br.x - tl.x, br.y - tl.y) * 0.75,
  )
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.22)')
  ctx.fillStyle = vignette
  ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y)

  // Survey grid: the step widens as the camera pulls out so the lines stay
  // an honest surveyor's grid instead of vanishing or turning to noise.
  if (ui.showGrid) {
    let step = GRID
    while (step * cam.zoom < 26 && step < 4096) step *= 2
    ctx.save()
    ctx.beginPath()
    ctx.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y)
    ctx.clip()
    ctx.lineWidth = 1
    const startWx = Math.ceil(b.x / step) * step
    for (let wx = startWx; wx <= b.x + b.w; wx += step) {
      const x = tl.x + (wx - b.x) * cam.zoom
      const major = wx % (step * 4) === 0
      ctx.strokeStyle = major ? 'rgba(200, 168, 98, 0.14)' : 'rgba(200, 168, 98, 0.07)'
      ctx.beginPath(); ctx.moveTo(x, tl.y); ctx.lineTo(x, br.y); ctx.stroke()
    }
    const startWy = Math.ceil(b.y / step) * step
    for (let wy = startWy; wy <= b.y + b.h; wy += step) {
      const y = tl.y + (wy - b.y) * cam.zoom
      const major = wy % (step * 4) === 0
      ctx.strokeStyle = major ? 'rgba(200, 168, 98, 0.14)' : 'rgba(200, 168, 98, 0.07)'
      ctx.beginPath(); ctx.moveTo(tl.x, y); ctx.lineTo(br.x, y); ctx.stroke()
    }
    ctx.restore()
  }

  // Terrain lies lowest: rivers and rises carved into the ground.
  for (const t of doc.terrain) {
    drawTerrain(ctx, t, cam, cssW, cssH, selected.has(`terrain:${t.eid}`), sameEntry(ui.hover, { kind: 'terrain', eid: t.eid }))
  }

  // Roads on the ground, quad by native quad.
  drawRoads(ctx, doc.roads, cam, cssW, cssH, selected, ui.hover)

  // Fences: the game's grate and wall art along each segment.
  for (const f of doc.fences) {
    drawFence(ctx, f, cam, cssW, cssH, selected.has(`fence:${f.eid}`), sameEntry(ui.hover, { kind: 'fence', eid: f.eid }))
  }

  // Objects and scenery sprites, painter-sorted together.
  const drawables: Drawable[] = [
    ...doc.objects.map((o) => drawableFor('object', o)),
    ...doc.sprites.map((s) => drawableFor('sprite', s)),
  ].sort((a, z) => a.baseline - z.baseline)

  for (const d of drawables) {
    const r = anchoredRect(d)
    const s = worldToScreen({ x: r.x, y: r.y }, cam, cssW, cssH)
    const isSel = selected.has(entryKey(d.sel))
    const isHover = !isSel && sameEntry(ui.hover, d.sel)

    // Rooting shadow so pieces sit in the ground instead of on it.
    const foot = worldToScreen(d.pos, cam, cssW, cssH)
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.42)'
    ctx.beginPath()
    ctx.ellipse(foot.x, foot.y, (r.w / 2.6) * cam.zoom, Math.max(3, r.w / 7) * cam.zoom, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    if (d.img) {
      ctx.imageSmoothingEnabled = cam.zoom < 1
      ctx.save()
      ctx.globalAlpha = d.alpha
      // The game's piece art is authentically near-black; on the site's
      // darker table it wears the same lift as the palette thumbs.
      ctx.filter = 'brightness(1.12)'
      if (d.rot !== 0 && d.ref) {
        ctx.translate(foot.x, foot.y)
        ctx.rotate((d.rot * Math.PI) / 180)
        ctx.drawImage(
          d.img,
          -d.ref.anchorX * d.scale * cam.zoom,
          -d.ref.anchorY * d.scale * cam.zoom,
          r.w * cam.zoom,
          r.h * cam.zoom,
        )
      } else {
        ctx.drawImage(d.img, s.x, s.y, r.w * cam.zoom, r.h * cam.zoom)
      }
      ctx.restore()
    } else {
      ctx.fillStyle = 'rgba(200,168,98,0.2)'
      ctx.fillRect(s.x, s.y, r.w * cam.zoom, r.h * cam.zoom)
    }

    if (isSel || isHover) {
      ctx.save()
      ctx.strokeStyle = isSel ? 'rgba(240,212,145,0.95)' : 'rgba(230,220,195,0.4)'
      ctx.lineWidth = isSel ? 1.5 : 1
      ctx.setLineDash(isSel ? [] : [4, 3])
      ctx.strokeRect(s.x - 2, s.y - 2, r.w * cam.zoom + 4, r.h * cam.zoom + 4)
      if (isSel) {
        ctx.shadowColor = 'rgba(200,168,98,0.8)'
        ctx.shadowBlur = 10
        ctx.strokeRect(s.x - 2, s.y - 2, r.w * cam.zoom + 4, r.h * cam.zoom + 4)
      }
      ctx.restore()
    }
  }

  // Plot boundary: the property line, in gold.
  ctx.save()
  ctx.strokeStyle = 'rgba(200,168,98,0.4)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([10, 6])
  ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y)
  ctx.restore()

  // Ghost of the piece about to be placed.
  if (ui.ghost) {
    const img = spriteImage(ui.ghost.ref.src)
    if (img.complete && img.naturalWidth > 0) {
      const r = anchoredRect({ ref: ui.ghost.ref, img, pos: ui.ghost.pos })
      const g = worldToScreen({ x: r.x, y: r.y }, cam, cssW, cssH)
      ctx.save()
      ctx.globalAlpha = 0.55
      ctx.filter = 'brightness(1.12)'
      ctx.drawImage(img, g.x, g.y, r.w * cam.zoom, r.h * cam.zoom)
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
  selected: Set<string>,
  hover: SelEntry | null,
) {
  if (roads.length === 0) return
  // Group by texture style so each pattern binds once.
  const byStyle = new Map<number, Polyline[]>()
  for (const r of roads) {
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
  ctx.filter = 'brightness(1.12)'
  ctx.translate(s.x, s.y)
  if (mirror) ctx.scale(-1, 1)
  ctx.drawImage(img, -ref.anchorX * cam.zoom, -ref.anchorY * cam.zoom, ref.w * cam.zoom, ref.h * cam.zoom)
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
  const drawables: Drawable[] = [
    ...doc.objects.map((o) => drawableFor('object', o)),
    ...doc.sprites.map((s) => drawableFor('sprite', s)),
  ].sort((a, z) => a.baseline - z.baseline)

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

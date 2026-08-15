import type { Vec2 } from '../../editor/model.ts'
import {
  NATIVE_LIGHT_OUTER_DISTANCE,
  NATIVE_LIGHT_VERTICAL_SCALE,
  nativeBoneyardLightScalar,
  type NativeBoneyardLightSource,
} from './boneyard-lighting.ts'

export interface NativeBoneyardComplexShadowCaster {
  id: string
  /** Object-local, convex silhouette vertices in winding order. */
  outline: readonly Vec2[]
  position: Vec2
}

export interface NativeBoneyardComplexShadowRecord {
  baseAlpha: number
  behindScalar: number
  direction: Vec2
  distanceFraction: number
  projectionDistance: number
  sourcePosition: Vec2
  sourceRadius: number
}

export interface NativeBoneyardProjectedShadowEdge {
  baseAlpha: number
  baseEnd: Vec2
  baseStart: Vec2
  tipAlpha: number
  tipEnd: Vec2
  tipStart: Vec2
}

const NATIVE_LIGHT_OUTER_DISTANCE_SQUARED = NATIVE_LIGHT_OUTER_DISTANCE ** 2
const MAX_ALPHA_OUTLINE_POINTS = 16
const NATIVE_TREE_COMPLEX_SHADOW_OUTLINES: readonly (readonly Vec2[])[] = [
  [{ x: -2, y: 12 }, { x: 18, y: 9 }, { x: 17, y: -8 }, { x: -5, y: -4 }],
  [{ x: 3, y: 14 }, { x: 14, y: -3 }, { x: -4, y: -13 }, { x: -19, y: 3 }],
  [{ x: 1, y: 9 }, { x: 15, y: -2 }, { x: 7, y: -13 }, { x: -15, y: -3 }],
  [{ x: 7, y: 7 }, { x: 27, y: 1 }, { x: 24, y: -16 }, { x: 4, y: -11 }],
  [{ x: 5, y: 10 }, { x: 12, y: -8 }, { x: -3, y: -17 }, { x: -20, y: -1 }],
  [{ x: -20, y: 8 }, { x: -12, y: -2 }, { x: 7, y: 6 }, { x: 0, y: 17 }],
  [
    { x: -19.5, y: 12.5 },
    { x: -19.5, y: -12.5 },
    { x: 19.5, y: -12.5 },
    { x: 19.5, y: 12.5 },
  ],
  [{ x: -6, y: 10 }, { x: -6, y: -1 }, { x: 7, y: -1 }, { x: 8, y: 10 }],
  [{ x: -6, y: 10 }, { x: -6, y: -1 }, { x: 7, y: -1 }, { x: 8, y: 10 }],
  [
    { x: -1.5, y: 1.5 },
    { x: -1.5, y: -1.5 },
    { x: 1.5, y: -1.5 },
    { x: 1.5, y: 1.5 },
  ],
  [
    { x: -1.5, y: 1.5 },
    { x: -1.5, y: -1.5 },
    { x: 1.5, y: -1.5 },
    { x: 1.5, y: 1.5 },
  ],
  [
    { x: 0.5, y: 2.5 },
    { x: -2.5, y: -0.5 },
    { x: 0.5, y: -3.5 },
    { x: 3.5, y: -0.5 },
  ],
  [
    { x: 0.5, y: 2.5 },
    { x: -2.5, y: -0.5 },
    { x: 0.5, y: -3.5 },
    { x: 3.5, y: -0.5 },
  ],
  [
    { x: -1.5, y: 1.5 },
    { x: -1.5, y: -1.5 },
    { x: 1.5, y: -1.5 },
    { x: 1.5, y: 1.5 },
  ],
  [
    { x: -1.5, y: 1.5 },
    { x: -1.5, y: -1.5 },
    { x: 1.5, y: -1.5 },
    { x: 1.5, y: 1.5 },
  ],
]

/** Exact Tree shape selected by `0x0081B910 + mainVariant * 0x34`. */
export function nativeBoneyardTreeComplexShadowOutline(mainVariant: number): Vec2[] {
  const outline = NATIVE_TREE_COMPLEX_SHADOW_OUTLINES[mainVariant]
  if (!outline) {
    throw new RangeError(
      `Unsupported native Tree complex-shadow variant ${mainVariant}.`,
    )
  }
  return outline.map((point) => ({ ...point }))
}

export function nativeBoneyardComplexShadowRecords(
  caster: NativeBoneyardComplexShadowCaster,
  sources: readonly NativeBoneyardLightSource[],
  presentationFrame: number,
): NativeBoneyardComplexShadowRecord[] {
  const records: NativeBoneyardComplexShadowRecord[] = []
  sources.forEach((source, sourceIndex) => {
    if (!source.multipleShadows || source.radius <= 0) return
    const worldDx = caster.position.x - source.position.x
    const worldDy = caster.position.y - source.position.y
    const dx = worldDx / source.radius
    const dy = worldDy / (NATIVE_LIGHT_VERTICAL_SCALE * source.radius)
    const distanceSquared = dx * dx + dy * dy
    if (distanceSquared >= NATIVE_LIGHT_OUTER_DISTANCE_SQUARED) return

    const worldDistance = Math.hypot(worldDx, worldDy)
    const direction = worldDistance === 0
      ? { x: 0, y: 0 }
      : { x: worldDx / worldDistance, y: worldDy / worldDistance }
    const behindPosition = {
      x: caster.position.x + direction.x,
      y: caster.position.y + direction.y,
    }
    records.push({
      baseAlpha: 1,
      behindScalar: nativeBoneyardLightScalar(behindPosition, sources),
      direction,
      distanceFraction: distanceSquared / NATIVE_LIGHT_OUTER_DISTANCE_SQUARED,
      projectionDistance: (
        NATIVE_LIGHT_OUTER_DISTANCE
        - presentationRandom(caster, source, sourceIndex, presentationFrame)
      ) * source.radius,
      sourcePosition: { ...source.position },
      sourceRadius: source.radius,
    })
  })

  if (records.length > 1) {
    for (let recordIndex = 0; recordIndex < records.length; recordIndex += 1) {
      const record = records[recordIndex]
      for (let otherIndex = 0; otherIndex < records.length; otherIndex += 1) {
        if (otherIndex === recordIndex) continue
        const other = records[otherIndex]
        const directionDot = (
          record.direction.x * other.direction.x
          + record.direction.y * other.direction.y
        )
        record.baseAlpha *= Math.max(directionDot, other.distanceFraction)
      }
      record.baseAlpha = clampUnit(record.baseAlpha)
    }
  }
  return records
}

export function nativeBoneyardProjectedShadowEdges(
  caster: NativeBoneyardComplexShadowCaster,
  record: NativeBoneyardComplexShadowRecord,
): NativeBoneyardProjectedShadowEdge[] {
  if (caster.outline.length < 3) return []
  const winding = signedArea(caster.outline) >= 0 ? 1 : -1
  const tipAlpha = clampUnit(
    ((1 - record.behindScalar) * (1 - record.distanceFraction)) ** 3,
  )
  const edges: NativeBoneyardProjectedShadowEdge[] = []
  for (let index = 0; index < caster.outline.length; index += 1) {
    const localStart = caster.outline[index]
    const localEnd = caster.outline[(index + 1) % caster.outline.length]
    const baseStart = add(caster.position, localStart)
    const baseEnd = add(caster.position, localEnd)
    const edgeX = baseEnd.x - baseStart.x
    const edgeY = baseEnd.y - baseStart.y
    const edgeLength = Math.hypot(edgeX, edgeY)
    if (edgeLength === 0) continue
    const outward = winding > 0
      ? { x: edgeY / edgeLength, y: -edgeX / edgeLength }
      : { x: -edgeY / edgeLength, y: edgeX / edgeLength }
    const midpoint = {
      x: (baseStart.x + baseEnd.x) / 2,
      y: (baseStart.y + baseEnd.y) / 2,
    }
    const sourceDirection = {
      x: record.sourcePosition.x - midpoint.x,
      y: record.sourcePosition.y - midpoint.y,
    }
    if (sourceDirection.x * outward.x + sourceDirection.y * outward.y <= 0) continue
    edges.push({
      baseAlpha: record.baseAlpha,
      baseEnd,
      baseStart,
      tipAlpha,
      tipEnd: projectAway(baseEnd, record.sourcePosition, record.projectionDistance),
      tipStart: projectAway(baseStart, record.sourcePosition, record.projectionDistance),
    })
  }
  return edges
}

/**
 * Recovers a stable, bounded convex presentation outline from extracted native
 * sprite alpha. Runtime shadow projection never needs the source bitmap again.
 */
export function nativeBoneyardAlphaSilhouette(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
): Vec2[] {
  if (width <= 0 || height <= 0 || pixels.length < width * height * 4) return []
  const candidates: Vec2[] = []
  for (let y = 0; y < height; y += 1) {
    let left = width
    let right = -1
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
    }
    if (right < left) continue
    candidates.push(
      { x: left, y },
      { x: right + 1, y },
      { x: left, y: y + 1 },
      { x: right + 1, y: y + 1 },
    )
  }
  return nativeBoneyardConvexSilhouette(candidates)
}

export function nativeBoneyardConvexSilhouette(
  boundaryPoints: readonly Vec2[],
): Vec2[] {
  return limitConvexOutline(
    convexHull(boundaryPoints),
    MAX_ALPHA_OUTLINE_POINTS,
  )
}

function convexHull(points: readonly Vec2[]): Vec2[] {
  const sorted = [...new Map(
    points.map((point) => [`${point.x},${point.y}`, point] as const),
  ).values()].sort((left, right) => left.x - right.x || left.y - right.y)
  if (sorted.length <= 2) return sorted.map((point) => ({ ...point }))
  const lower: Vec2[] = []
  for (const point of sorted) {
    while (
      lower.length >= 2
      && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0
    ) lower.pop()
    lower.push(point)
  }
  const upper: Vec2[] = []
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index]
    while (
      upper.length >= 2
      && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0
    ) upper.pop()
    upper.push(point)
  }
  lower.pop()
  upper.pop()
  return [...lower, ...upper].map((point) => ({ ...point }))
}

function limitConvexOutline(points: readonly Vec2[], maximum: number): Vec2[] {
  const outline = points.map((point) => ({ ...point }))
  while (outline.length > maximum) {
    let smallestArea = Number.POSITIVE_INFINITY
    let removeIndex = 0
    for (let index = 0; index < outline.length; index += 1) {
      const area = Math.abs(cross(
        outline[(index + outline.length - 1) % outline.length],
        outline[index],
        outline[(index + 1) % outline.length],
      ))
      if (area < smallestArea) {
        smallestArea = area
        removeIndex = index
      }
    }
    outline.splice(removeIndex, 1)
  }
  return outline
}

function projectAway(point: Vec2, source: Vec2, distance: number): Vec2 {
  const dx = point.x - source.x
  const dy = point.y - source.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return { ...point }
  return {
    x: point.x + dx / length * distance,
    y: point.y + dy / length * distance,
  }
}

function presentationRandom(
  caster: NativeBoneyardComplexShadowCaster,
  source: NativeBoneyardLightSource,
  sourceIndex: number,
  presentationFrame: number,
): number {
  const key = [
    caster.id,
    Math.trunc(presentationFrame),
    sourceIndex,
    source.position.x,
    source.position.y,
    source.radius,
  ].join(':')
  let value = 0x811c9dc5
  for (let index = 0; index < key.length; index += 1) {
    value = Math.imul(value ^ key.charCodeAt(index), 0x01000193) >>> 0
  }
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad) >>> 0
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0
  return ((value ^ (value >>> 15)) >>> 0) / 0x1_0000_0000
}

function add(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x + right.x, y: left.y + right.y }
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function cross(origin: Vec2, left: Vec2, right: Vec2): number {
  return (
    (left.x - origin.x) * (right.y - origin.y)
    - (left.y - origin.y) * (right.x - origin.x)
  )
}

function signedArea(points: readonly Vec2[]): number {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }
  return area / 2
}

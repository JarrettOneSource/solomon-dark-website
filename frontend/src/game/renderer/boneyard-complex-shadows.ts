import type { Vec2 } from '../../editor/model.ts'
import {
  NATIVE_LIGHT_OUTER_DISTANCE,
  NATIVE_LIGHT_VERTICAL_SCALE,
  nativeBoneyardLightScalar,
  type NativeBoneyardLightSource,
} from './boneyard-lighting.ts'

export interface NativeBoneyardComplexShadowCaster {
  id: string
  /** Object-local native authored vertices in their original order. */
  outline: readonly Vec2[]
  position: Vec2
  program?: NativeBoneyardShadowProgram
}

export type NativeBoneyardShadowProgram =
  | {
      construction: 'gate' | 'intact'
      end: Vec2
      kind: 'fence-grate'
      start: Vec2
    }
  | {
      end: Vec2
      kind: 'rails'
      start: Vec2
    }
  | {
      end: Vec2
      kind: 'wall'
      start: Vec2
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

export interface NativeBoneyardProjectedShadowMesh {
  alphas: Float32Array
  indices: Uint32Array
  vertices: Float32Array
}

export interface NativeBoneyardFenceGrateShadowPlan {
  bars: readonly NativeBoneyardProjectedShadowEdge[]
  rail: {
    alpha: number
    end: Vec2
    start: Vec2
    width: 4
  }
}

export interface NativeBoneyardRailShadowPlan {
  alpha: number
  end: Vec2
  start: Vec2
  width: 10
}

export function nativeBoneyardPackedShadowAlpha(alpha: number): number {
  return Math.trunc(Math.min(1, Math.max(0, alpha)) * 255) / 255
}

const NATIVE_LIGHT_OUTER_DISTANCE_SQUARED = NATIVE_LIGHT_OUTER_DISTANCE ** 2
const MAX_ALPHA_OUTLINE_POINTS = 16
export const NATIVE_FENCE_SHADOW_END_INSET = 12
export const NATIVE_FENCE_SHADOW_BAR_STEP = 13.333333015441895
export const NATIVE_GATE_SHADOW_END_INSET = 4
export const NATIVE_GATE_SHADOW_BAR_DIVISOR = 4.5
export const NATIVE_FENCE_SHADOW_NEAR_HALF_WIDTH = 2
export const NATIVE_FENCE_SHADOW_FAR_HALF_WIDTH = 8
export const NATIVE_FENCE_SHADOW_RAIL_WIDTH = 4
export const NATIVE_RAIL_SHADOW_END_INSET = 4
export const NATIVE_RAIL_SHADOW_WIDTH = 10
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
    if (!source.castsDirectionalShadow || source.radius <= 0) return
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
    const outward = { x: edgeY / edgeLength, y: -edgeX / edgeLength }
    const midpoint = {
      x: (baseStart.x + baseEnd.x) / 2,
      y: (baseStart.y + baseEnd.y) / 2,
    }
    const sourceDirection = {
      x: midpoint.x - record.sourcePosition.x,
      y: midpoint.y - record.sourcePosition.y,
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

export function nativeBoneyardProjectedShadowMesh(
  edge: NativeBoneyardProjectedShadowEdge,
): NativeBoneyardProjectedShadowMesh {
  return {
    alphas: Float32Array.from([
      edge.baseAlpha,
      edge.baseAlpha,
      edge.tipAlpha,
      edge.tipAlpha,
    ]),
    indices: Uint32Array.from([0, 1, 2, 1, 3, 2]),
    vertices: Float32Array.from([
      edge.baseStart.x, edge.baseStart.y,
      edge.baseEnd.x, edge.baseEnd.y,
      edge.tipStart.x, edge.tipStart.y,
      edge.tipEnd.x, edge.tipEnd.y,
    ]),
  }
}

export function nativeBoneyardFenceGrateShadows(
  program: Extract<NativeBoneyardShadowProgram, { kind: 'fence-grate' }>,
  record: NativeBoneyardComplexShadowRecord,
): NativeBoneyardFenceGrateShadowPlan {
  const dx = Math.fround(program.end.x - program.start.x)
  const dy = Math.fround(program.end.y - program.start.y)
  const length = nativeStoredLength(dx, dy)
  const endInset = program.construction === 'gate'
    ? NATIVE_GATE_SHADOW_END_INSET
    : NATIVE_FENCE_SHADOW_END_INSET
  if (length <= endInset * 2) {
    return {
      bars: [],
      rail: { alpha: 0, end: { ...program.end }, start: { ...program.start }, width: 4 },
    }
  }
  const inverseLength = Math.fround(1 / length)
  const along = {
    x: Math.fround(dx * inverseLength),
    y: Math.fround(dy * inverseLength),
  }
  const shortStart = {
    x: Math.fround(program.start.x + Math.fround(along.x * endInset)),
    y: Math.fround(program.start.y + Math.fround(along.y * endInset)),
  }
  const shortEnd = {
    x: Math.fround(program.end.x - Math.fround(along.x * endInset)),
    y: Math.fround(program.end.y - Math.fround(along.y * endInset)),
  }
  const shortDx = Math.fround(shortEnd.x - shortStart.x)
  const shortDy = Math.fround(shortEnd.y - shortStart.y)
  const shortLength = nativeStoredLength(shortDx, shortDy)
  const nominalStep = program.construction === 'gate'
    ? Math.fround(shortLength / NATIVE_GATE_SHADOW_BAR_DIVISOR)
    : NATIVE_FENCE_SHADOW_BAR_STEP
  const step = {
    x: Math.fround(along.x * nominalStep),
    y: Math.fround(along.y * nominalStep),
  }
  const storedStepLength = nativeStoredLength(step.x, step.y)
  const count = Math.max(1, Math.trunc(shortLength / storedStepLength) + 1)
  const bars = Array.from({ length: count }, (_, index) => {
    const center = {
      x: Math.fround(shortStart.x + Math.fround(step.x * (index + 0.5))),
      y: Math.fround(shortStart.y + Math.fround(step.y * (index + 0.5))),
    }
    const away = normalizedFrom(record.sourcePosition, center)
    const perpendicular = { x: -away.y, y: away.x }
    const far = {
      x: center.x + away.x * record.projectionDistance,
      y: center.y + away.y * record.projectionDistance,
    }
    return {
      baseAlpha: record.baseAlpha,
      baseEnd: {
        x: center.x + perpendicular.x * NATIVE_FENCE_SHADOW_NEAR_HALF_WIDTH,
        y: center.y + perpendicular.y * NATIVE_FENCE_SHADOW_NEAR_HALF_WIDTH,
      },
      baseStart: {
        x: center.x - perpendicular.x * NATIVE_FENCE_SHADOW_NEAR_HALF_WIDTH,
        y: center.y - perpendicular.y * NATIVE_FENCE_SHADOW_NEAR_HALF_WIDTH,
      },
      tipAlpha: 0,
      tipEnd: {
        x: far.x + perpendicular.x * NATIVE_FENCE_SHADOW_FAR_HALF_WIDTH,
        y: far.y + perpendicular.y * NATIVE_FENCE_SHADOW_FAR_HALF_WIDTH,
      },
      tipStart: {
        x: far.x - perpendicular.x * NATIVE_FENCE_SHADOW_FAR_HALF_WIDTH,
        y: far.y - perpendicular.y * NATIVE_FENCE_SHADOW_FAR_HALF_WIDTH,
      },
    }
  })
  return {
    bars,
    rail: {
      alpha: clampUnit(0.1 * record.behindScalar + 0.9 * record.baseAlpha),
      end: projectAway(shortEnd, record.sourcePosition, record.projectionDistance * 0.125),
      start: projectAway(shortStart, record.sourcePosition, record.projectionDistance * 0.125),
      width: NATIVE_FENCE_SHADOW_RAIL_WIDTH,
    },
  }
}

export function nativeBoneyardRailsShadows(
  program: Extract<NativeBoneyardShadowProgram, { kind: 'rails' }>,
  record: NativeBoneyardComplexShadowRecord,
): readonly [NativeBoneyardRailShadowPlan, NativeBoneyardRailShadowPlan] {
  const dx = Math.fround(program.end.x - program.start.x)
  const dy = Math.fround(program.end.y - program.start.y)
  const length = nativeStoredLength(dx, dy)
  const inverseLength = length > 0 ? Math.fround(1 / length) : 0
  const along = {
    x: Math.fround(dx * inverseLength),
    y: Math.fround(dy * inverseLength),
  }
  const start = {
    x: Math.fround(program.start.x + Math.fround(along.x * NATIVE_RAIL_SHADOW_END_INSET)),
    y: Math.fround(program.start.y + Math.fround(along.y * NATIVE_RAIL_SHADOW_END_INSET)),
  }
  const shortenedEnd = {
    x: Math.fround(program.end.x - Math.fround(along.x * NATIVE_RAIL_SHADOW_END_INSET)),
    y: Math.fround(program.end.y - Math.fround(along.y * NATIVE_RAIL_SHADOW_END_INSET)),
  }
  const shortenedLength = nativeStoredLength(
    Math.fround(shortenedEnd.x - start.x),
    Math.fround(shortenedEnd.y - start.y),
  )
  const step = {
    x: Math.fround(along.x * NATIVE_FENCE_SHADOW_BAR_STEP),
    y: Math.fround(along.y * NATIVE_FENCE_SHADOW_BAR_STEP),
  }
  const stepLength = nativeStoredLength(step.x, step.y)
  const count = stepLength > 0
    ? Math.trunc(shortenedLength / stepLength) + 1
    : 0
  const farBaseline = {
    x: Math.fround(start.x + Math.fround(count * step.x)),
    y: Math.fround(start.y + Math.fround(count * step.y)),
  }
  const alpha = clampUnit(0.9 * record.baseAlpha + 0.1 * record.behindScalar)
  const line = (divisor: number): NativeBoneyardRailShadowPlan => ({
    alpha,
    end: projectByDivisor(farBaseline, record.sourcePosition, divisor),
    start: projectByDivisor(start, record.sourcePosition, divisor),
    width: NATIVE_RAIL_SHADOW_WIDTH,
  })
  return [line(5), line(1.5)]
}

export function nativeBoneyardWallShadow(
  program: Extract<NativeBoneyardShadowProgram, { kind: 'wall' }>,
  record: NativeBoneyardComplexShadowRecord,
): NativeBoneyardProjectedShadowEdge {
  return {
    baseAlpha: record.baseAlpha,
    baseEnd: { ...program.end },
    baseStart: { ...program.start },
    tipAlpha: clampUnit(
      ((1 - record.behindScalar) * (1 - record.distanceFraction)) ** 3,
    ),
    tipEnd: projectAway(program.end, record.sourcePosition, record.projectionDistance),
    tipStart: projectAway(program.start, record.sourcePosition, record.projectionDistance),
  }
}

function nativeStoredLength(dx: number, dy: number): number {
  return Math.fround(Math.sqrt(Math.fround(
    Math.fround(dx * dx) + Math.fround(dy * dy),
  )))
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

function projectByDivisor(point: Vec2, source: Vec2, divisor: number): Vec2 {
  return {
    x: point.x - (source.x - point.x) / divisor,
    y: point.y - (source.y - point.y) / divisor,
  }
}

function normalizedFrom(source: Vec2, destination: Vec2): Vec2 {
  const dx = destination.x - source.x
  const dy = destination.y - source.y
  const length = Math.hypot(dx, dy)
  return length === 0 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length }
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

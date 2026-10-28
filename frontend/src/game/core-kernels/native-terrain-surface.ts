import type { BoneyardBounds, BoneyardPoint, BoneyardRoad, BoneyardTerrain } from './boneyard.ts'
import { NATIVE_GROUND_PI } from './native-ground-auxiliary.ts'
import { createNativeRng, drawNativeFloat } from './native-rng.ts'

const f = Math.fround
export type NativeSurfaceQuad = readonly [BoneyardPoint, BoneyardPoint, BoneyardPoint, BoneyardPoint]
interface Axis { points: readonly number[]; coefficients: readonly (readonly [number, number, number])[] }
interface Spline { extent: number; x: Axis; y: Axis }
export interface NativeTerrainSurface {
  readonly cursors: readonly number[]
  readonly quads: readonly NativeSurfaceQuad[]
}
export interface NativeBridgeSurface { readonly quad: NativeSurfaceQuad; readonly bounds: BoneyardBounds }

/** QuickSpline 0062A9E0, flags zero. This is the fixed-quarter tangent solver,
 * not the natural-cubic solver used by other browser spline consumers. */
function axis(points: readonly number[]): Axis {
  const count = points.length
  if (count < 2) return { points, coefficients: [] }
  if (count === 2) return { points, coefficients: [[f(points[1] - points[0]), 0, 0]] }
  const forward = new Float32Array(count)
  const tangent = new Float32Array(count)
  forward[0] = (points[1] - points[0]) * 3 * 0.25
  for (let i = 1; i < count - 1; i += 1) forward[i] = ((points[i + 1] - points[i - 1]) * 3 - forward[i - 1]) * 0.25
  forward[count - 1] = ((points[count - 1] - points[count - 2]) * 3 - forward[count - 2]) * 0.25
  tangent[count - 1] = forward[count - 1]
  for (let i = count - 2; i >= 0; i -= 1) tangent[i] = forward[i] - tangent[i + 1] * 0.25
  return { points, coefficients: Array.from({ length: count - 1 }, (_, i) => [tangent[i],
    f((points[i + 1] - points[i]) * 3 - tangent[i] * 2 - tangent[i + 1]),
    f((points[i] - points[i + 1]) * 2 + tangent[i] + tangent[i + 1]),
  ]) }
}

function evaluateAxis(value: Axis, cursor: number, derivative = false): number {
  if (value.coefficients.length === 0) return 0
  const segment = Math.max(0, Math.min(value.coefficients.length - 1, Math.trunc(cursor)))
  const t = f(Math.max(0, Math.min(value.coefficients.length, cursor)) - segment)
  const [b, c, d] = value.coefficients[segment]
  return derivative ? f(t * t * d * 3 + t * c * 2 + b)
    : f(value.points[segment] + t * (b + t * (c + t * d)))
}

function evaluate(spline: Spline, cursor: number, derivative = false): BoneyardPoint {
  return { x: evaluateAxis(spline.x, cursor, derivative), y: evaluateAxis(spline.y, cursor, derivative) }
}

function difference(a: Readonly<BoneyardPoint>, b: Readonly<BoneyardPoint>): BoneyardPoint {
  return { x: f(a.x - b.x), y: f(a.y - b.y) }
}
function lengthSquared(p: Readonly<BoneyardPoint>): number { return f(p.x * p.x + p.y * p.y) }
function unit(p: Readonly<BoneyardPoint>): BoneyardPoint {
  const length = f(Math.sqrt(lengthSquared(p)))
  const scale = length > 0 ? f(1 / length) : 0
  return { x: f(p.x * scale), y: f(p.y * scale) }
}

/** 0062B520 arc-length table and 0062B8E0 inversion, including its endpoint rule. */
function distanceLookup(spline: Spline): (distance: number) => number {
  const distances = [0]
  const cursors = [0]
  const step = f(0.025)
  let previous = { x: spline.x.points[0] ?? 0, y: spline.y.points[0] ?? 0 }
  let total = 0
  let cursor = step
  while (cursor < spline.extent) {
    let point = evaluate(spline, cursor)
    let squared = lengthSquared(difference(point, previous))
    while (squared < 6.25 && cursor < spline.extent) {
      cursor = f(cursor + step)
      point = evaluate(spline, cursor)
      squared = lengthSquared(difference(point, previous))
    }
    cursor = Math.min(cursor, spline.extent)
    total = f(total + f(Math.sqrt(squared)))
    distances.push(total)
    cursors.push(cursor)
    cursor = f(cursor + step)
    previous = point
  }
  return (requested) => {
    if (distances.length < 2) return 0
    const distance = Math.max(0, Math.min(total, f(requested)))
    let low = 0
    let high = distances.length - 1
    while (low <= high) {
      const middle = (low + high) >> 1
      if (distances[middle] < distance) low = middle + 1
      else high = middle - 1
    }
    const index = Math.max(0, low - 1)
    const span = f(distances[index + 1] - distances[index])
    if (span <= 0.25) return distances[index + 1]
    const t = Math.max(0, Math.min(1, f(1 - (distances[index + 1] - distance) / span)))
    return f((cursors[index + 1] - cursors[index]) * t + cursors[index])
  }
}

/** 0062BFF0 uses parameter-space steps obtained once from lengths 20 and 120. */
function sampleCursors(spline: Spline): number[] {
  const lookup = distanceLookup(spline)
  const cursors = [0]
  if (lookup(spline.extent) > 0) {
    const step = Math.min(1, lookup(20))
    const maximumGap = lookup(120)
    let last = 0
    let previous = unit({ x: spline.x.coefficients[0]?.[0] ?? 0, y: spline.y.coefficients[0]?.[0] ?? 0 })
    for (let cursor = step; cursor < spline.extent; cursor = f(cursor + step)) {
      const direction = unit(evaluate(spline, Math.max(f(0.0001), cursor), true))
      const dot = f(direction.x * previous.x + direction.y * previous.y)
      if (maximumGap < cursor - last || (dot < f(0.995) && -f(0.995) < dot)) {
        cursors.push(cursor)
        previous = direction
        last = cursor
      }
    }
  }
  cursors.push(spline.extent)
  return cursors
}

function crossSection(spline: Spline, cursor: number, leftWidth: number, rightWidth: number): readonly [BoneyardPoint, BoneyardPoint] {
  const center = evaluate(spline, cursor)
  const normalCursor = Math.max(f(0.001), cursor)
  const delta = difference(evaluate(spline, normalCursor), evaluate(spline, f(normalCursor - f(0.001))))
  const normal = unit({ x: delta.y, y: -delta.x })
  return [{ x: f(center.x + f(leftWidth * normal.x)), y: f(center.y + f(leftWidth * normal.y)) },
    { x: f(center.x - f(rightWidth * normal.x)), y: f(center.y - f(rightWidth * normal.y)) }]
}

/** 0064FA90 / 00651DF0. Profiles and sideSign belong to style one, which cannot
 * register in Arena's style-zero surface grid. Points are already world-space. */
export function buildNativeTerrainSurface(terrain: BoneyardTerrain): NativeTerrainSurface {
  if ((terrain.style ?? 0) !== 0) return { cursors: [], quads: [] }
  const points = terrain.points ?? []
  const spline: Spline = { extent: Math.max(0, points.length - 1),
    x: axis(points.map((p) => f(p.x))), y: axis(points.map((p) => f(p.y))) }
  const cursors = sampleCursors(spline)
  const sections: (readonly [BoneyardPoint, BoneyardPoint])[] = []
  let rng = createNativeRng(terrain.uid ?? 0)
  for (let index = 1; index < cursors.length; index += 1) {
    const widths = []
    for (let draw = 0; draw < 4; draw += 1) {
      const next = drawNativeFloat(rng, 16.25)
      rng = next.state
      widths.push(next.value)
    }
    const left = f(widths[1] * 0.5 + 32.5)
    const right = f(widths[2] * 0.5 + 32.5)
    if (index === 1) sections.push(crossSection(spline, cursors[0], left, right))
    sections.push(crossSection(spline, cursors[index], left, right))
  }
  return { cursors, quads: sections.slice(1).map((current, index) => [current[0], current[1], sections[index][0], sections[index][1]]) }
}

/** Native triangle helper 004119C0 compares three <0 signs, without epsilon. */
function triangleContains(p: Readonly<BoneyardPoint>, a: Readonly<BoneyardPoint>, b: Readonly<BoneyardPoint>, c: Readonly<BoneyardPoint>): boolean {
  const negative = f((p.x - b.x) * (a.y - b.y) - (p.y - b.y) * (a.x - b.x)) < 0
  return (f((b.y - c.y) * (p.x - c.x) - (b.x - c.x) * (p.y - c.y)) < 0) === negative
    && (f((c.y - a.y) * (p.x - a.x) - (c.x - a.x) * (p.y - a.y)) < 0) === negative
}

export function nativeSurfaceQuadContains(quad: NativeSurfaceQuad, p: Readonly<BoneyardPoint>): boolean {
  return triangleContains(p, quad[0], quad[1], quad[2]) || triangleContains(p, quad[1], quad[3], quad[2])
}

export function nativeSurfaceQuadBounds(quad: NativeSurfaceQuad): BoneyardBounds {
  const x = Math.min(...quad.map((p) => p.x))
  const y = Math.min(...quad.map((p) => p.y))
  return { x, y, w: f(Math.max(...quad.map((p) => p.x)) - x), h: f(Math.max(...quad.map((p) => p.y)) - y) }
}

/** 00403DA0 admits left/top and excludes right/bottom. Upper sums remain
 * in x87 precision until comparison; do not add a float32 store there. */
export function nativeBridgeSurfaceContains(bridge: NativeBridgeSurface, point: Readonly<BoneyardPoint>): boolean {
  const { bounds } = bridge
  return point.x >= bounds.x && point.y >= bounds.y
    && point.x < bounds.x + bounds.w && point.y < bounds.y + bounds.h
    && nativeSurfaceQuadContains(bridge.quad, point)
}

/** 00410820: strict orientation comparisons, including the native endpoint rule. */
function segmentsCross(a: Readonly<BoneyardPoint>, b: Readonly<BoneyardPoint>, c: Readonly<BoneyardPoint>, d: Readonly<BoneyardPoint>): boolean {
  return ((c.y - a.y) * (d.x - a.x) < (d.y - a.y) * (c.x - a.x))
      !== ((c.y - b.y) * (d.x - b.x) < (d.y - b.y) * (c.x - b.x))
    && ((b.y - a.y) * (c.x - a.x) < (b.x - a.x) * (c.y - a.y))
      !== ((b.y - a.y) * (d.x - a.x) < (b.x - a.x) * (d.y - a.y))
}

function crossing(a: Readonly<BoneyardPoint>, b: Readonly<BoneyardPoint>, c: Readonly<BoneyardPoint>, d: Readonly<BoneyardPoint>): BoneyardPoint | null {
  if (!segmentsCross(a, b, c, d)) return null
  const ay = f(b.y - a.y)
  const ax = f(a.x - b.x)
  const ac = f(ay * a.x + ax * a.y)
  const by = f(d.y - c.y)
  const bx = f(c.x - d.x)
  const bc = f(by * c.x + bx * c.y)
  const determinant = f(bx * ay - by * ax)
  return determinant === 0 ? null : { x: f((ac * bx - bc * ax) / determinant), y: f((bc * ay - by * ac) / determinant) }
}

function roadCrossesQuad(quad: NativeSurfaceQuad, a: Readonly<BoneyardPoint>, b: Readonly<BoneyardPoint>): boolean {
  if (nativeSurfaceQuadContains(quad, a) || nativeSurfaceQuadContains(quad, b)) return true
  // 00411BF0 calls 00411A70 for 012, then 132, including their diagonal.
  for (const [i, j] of [[0, 1], [1, 2], [0, 2], [1, 3], [3, 2], [1, 2]]) {
    if (segmentsCross(a, b, quad[i], quad[j])) return true
  }
  return false
}

function bridgeQuad(center: Readonly<BoneyardPoint>, direction: Readonly<BoneyardPoint>): NativeSurfaceQuad {
  const radians = f(Math.atan2(direction.x, -direction.y))
  let degrees = f(radians * 180 / NATIVE_GROUND_PI)
  if (degrees < 0) degrees = f(degrees + 360)
  const angle = f(-degrees * NATIVE_GROUND_PI / 180)
  const cosine = f(Math.cos(angle))
  const sine = -f(Math.sin(angle))
  const yx = f(f(0.9) * sine)
  const yy = f(f(0.9) * cosine)
  const transform = (x: number, y: number): BoneyardPoint => ({
    x: f(f(x * cosine - y * sine) + center.x),
    y: f(f(x * yx + y * yy) + center.y),
  })
  return [transform(-36, -67.5), transform(36, -67.5), transform(-36, 67.5), transform(36, 67.5)]
}

/** RegionLayout 00653BF0: one bridge per Road per Terrain, from the first
 * intersecting inner quad. Road visual width/style/quad never enter this path. */
export function buildNativeBridgeSurfaces(surfaces: readonly NativeTerrainSurface[], roads: readonly BoneyardRoad[]): readonly NativeBridgeSurface[] {
  const bridges: NativeBridgeSurface[] = []
  for (const surface of surfaces) {
    for (const road of roads) {
      if (road.points.length < 2) continue
      const start = { x: f(road.points[0].x), y: f(road.points[0].y) }
      const end = { x: f(road.points[1].x), y: f(road.points[1].y) }
      const quad = surface.quads.find((candidate) => roadCrossesQuad(candidate, start, end))
      if (quad === undefined) continue
      let nearestStart = { x: f((start.x + end.x) * 0.5), y: f((start.y + end.y) * 0.5) }
      let nearestEnd = nearestStart
      let startDistance = 1e9
      let endDistance = 1e9
      for (const [i, j] of [[0, 1], [2, 3], [0, 2], [1, 3]]) {
        const hit = crossing(start, end, quad[i], quad[j])
        if (hit === null) continue
        const fromStart = lengthSquared(difference(hit, start))
        const fromEnd = lengthSquared(difference(hit, end))
        if (fromStart < startDistance) { startDistance = fromStart; nearestStart = hit }
        if (fromEnd < endDistance) { endDistance = fromEnd; nearestEnd = hit }
      }
      const direction = unit(difference(end, start))
      let center = { x: f((nearestStart.x + nearestEnd.x) * 0.5), y: f((nearestStart.y + nearestEnd.y) * 0.5) }
      if (startDistance === endDistance) center = { x: f(f(direction.x * 15) + nearestStart.x), y: f(f(direction.y * 15) + nearestStart.y) }
      center = { x: f(center.x + f(direction.x * 5)), y: f(center.y + f(direction.y * 5)) }
      const bridge = bridgeQuad(center, difference(end, start))
      bridges.push({ quad: bridge, bounds: nativeSurfaceQuadBounds(bridge) })
    }
  }
  return bridges
}

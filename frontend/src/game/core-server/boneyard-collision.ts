import type {
  BoneyardBounds,
  BoneyardGateLeafSnapshot,
  BoneyardObject,
  BoneyardPoint,
  BoneyardScene,
} from '../core-kernels/boneyard.ts'
import {
  lineCapsuleObstruction,
  lineCircleObstruction,
  lineSegmentObstruction,
  nearerLineObstruction,
  type LineObstruction,
} from '../core-kernels/line-obstruction.ts'

export interface BoneyardCollisionPolygon {
  points: readonly BoneyardPoint[]
  sourceId?: string
}

export interface BoneyardCollisionCircle {
  center: BoneyardPoint
  radius: number
  sourceId?: string
}

export interface BoneyardCollisionSegment {
  start: BoneyardPoint
  end: BoneyardPoint
  radius: number
  sourceId?: string
}

export interface BoneyardCollisionWorld {
  circles: readonly BoneyardCollisionCircle[]
  polygons: readonly BoneyardCollisionPolygon[]
  segments: readonly BoneyardCollisionSegment[]
}

const MONUMENT_POLYGONS: readonly (readonly BoneyardPoint[])[] = [
  rectangle(-51, -27, 50, 22), rectangle(-51, -27, 50, 22),
  rectangle(-29, -27, 25, 19), rectangle(-29, -27, 25, 19),
  rectangle(-32, -14, 30, 35), rectangle(-32, -14, 30, 35),
  rectangle(-21, -17, 20, 19),
  rectangle(-48, -23, 49, 21), rectangle(-48, -23, 49, 21),
  rectangle(-23, -20, 22, 18),
  rectangle(-33.5, -11.5, 34.5, 22.5),
  rectangle(-68.5, -22.5, 71.5, 33.5), rectangle(-68.5, -22.5, 71.5, 33.5),
  rectangle(-23, -15, 24, 19), rectangle(-23, -15, 24, 19),
  rectangle(-26, -18, 28, 17), rectangle(-26, -18, 28, 17),
  rectangle(-25, -16, 28, 27), rectangle(-11, -10, 11, 10),
  [{ x: -3.5, y: 8.5 }, { x: -11.5, y: -5.5 }, { x: 5.5, y: -14.5 }, { x: 14.5, y: 1.5 }],
  [{ x: -2.5, y: 14.5 }, { x: -14.5, y: 1.5 }, { x: -1.5, y: -10.5 }, { x: 12.5, y: 3.5 }],
]

const BUILDING_POLYGONS: readonly (readonly BoneyardPoint[])[] = [
  [
    { x: 92.5, y: 140.5 }, { x: 56.5, y: 140.5 },
    { x: 54.5, y: 161.5 }, { x: 31.5, y: 161.5 },
    { x: 31.5, y: 155.5 }, { x: -31.5, y: 155.5 },
    { x: -32.5, y: 161.5 }, { x: -57.5, y: 161.5 },
    { x: -56.5, y: 139.5 }, { x: -93.5, y: 139.5 },
    { x: -93.5, y: -19.5 }, { x: 92.5, y: -19.5 },
  ],
  [
    { x: -60, y: 103 }, { x: -60, y: 116 }, { x: -82, y: 132 },
    { x: -103, y: 117 }, { x: -103, y: 77 }, { x: -91, y: 77 },
    { x: -91, y: -23 }, { x: -101, y: -23 }, { x: -102, y: -49 },
    { x: 101, y: -49 }, { x: 101, y: -23 }, { x: 90, y: -23 },
    { x: 90, y: 77 }, { x: 103, y: 77 }, { x: 103, y: 108 },
    { x: 82, y: 132 }, { x: 59, y: 108 }, { x: 59, y: 103 },
  ],
  [
    { x: 74, y: 141 }, { x: -75, y: 141 }, { x: -75, y: 85 },
    { x: -132, y: 85 }, { x: -132, y: -61 }, { x: 131, y: -61 },
    { x: 131, y: 85 }, { x: 74, y: 85 },
  ],
  rectangle(-64.5, 6, 65.5, 132),
]

const GRAVE_POLYGON = [
  { x: -38, y: 104 }, { x: -35, y: 36 },
  { x: 27, y: 35 }, { x: 31, y: 105 },
] as const

const GOODIE_POLYGON = rectangle(-25.125, -8.625, 25.875, 16.875)

const FENCE_POST_RADIUS = 10
const GOODIE_RADIUS = 8

export function createBoneyardCollisionWorld(scene: BoneyardScene): BoneyardCollisionWorld {
  const polygons: BoneyardCollisionPolygon[] = []
  const circles: BoneyardCollisionCircle[] = []
  const segments: BoneyardCollisionSegment[] = []

  for (const object of scene.objects) appendObjectCollision(object, polygons, circles)

  const posts = new Set<string>()
  for (const fence of scene.fences) {
    const start = fence.points[0]
    const end = fence.points[1]
    if (!start || !end) continue
    const code = fence.segmentCode ?? fence.style ?? 0
    if (code !== 3) {
      appendPost(start, posts, circles)
      appendPost(end, posts, circles)
    }
    if (code === 2) {
      continue
    } else if (code === 1) {
      const midpoint = mix(start, end, 0.5)
      segments.push({ start, end: mix(start, midpoint, 0.82), radius: 0 })
      segments.push({ start: end, end: mix(end, midpoint, 0.82), radius: 0 })
    } else {
      segments.push({ start: { ...start }, end: { ...end }, radius: code === 3 ? 10 : 0 })
    }
  }
  return { circles, polygons, segments }
}

export function withBoneyardGateCollision(
  world: BoneyardCollisionWorld,
  gateLeaves: readonly BoneyardGateLeafSnapshot[],
): BoneyardCollisionWorld {
  if (gateLeaves.length === 0) return world
  return {
    ...world,
    segments: [
      ...world.segments,
      ...gateLeaves.map((leaf) => ({
        end: leaf.tip,
        radius: 0,
        start: leaf.hinge,
      })),
    ],
  }
}

export function touchingBoneyardGateLeaves(
  center: BoneyardPoint,
  gateLeaves: readonly BoneyardGateLeafSnapshot[],
  radius: number,
): readonly number[] {
  const contacts: number[] = []
  for (const [index, leaf] of gateLeaves.entries()) {
    const nearest = closestPointOnSegment(center, leaf.hinge, leaf.tip)
    const dx = center.x - nearest.x
    const dy = center.y - nearest.y
    if (dx * dx + dy * dy < radius * radius) contacts.push(index)
  }
  return contacts
}

export function canPlaceBoneyardBody(
  position: BoneyardPoint,
  bounds: BoneyardBounds,
  world: BoneyardCollisionWorld,
  radius: number,
): boolean {
  if (
    position.x < bounds.x + radius
    || position.x > bounds.x + bounds.w - radius
    || position.y < bounds.y + radius
    || position.y > bounds.y + bounds.h - radius
  ) return false
  return firstContact(position, world, radius, position) === null
}

export function firstBoneyardLineObstruction(
  start: BoneyardPoint,
  end: BoneyardPoint,
  bounds: BoneyardBounds,
  world: BoneyardCollisionWorld,
  excludedSourceId?: string,
): BoneyardPoint | null {
  let nearest: LineObstruction | null = null
  const left = bounds.x
  const right = bounds.x + bounds.w
  const top = bounds.y
  const bottom = bounds.y + bounds.h
  const boundary = [
    [{ x: left, y: top }, { x: right, y: top }],
    [{ x: right, y: top }, { x: right, y: bottom }],
    [{ x: right, y: bottom }, { x: left, y: bottom }],
    [{ x: left, y: bottom }, { x: left, y: top }],
  ] as const
  for (const [edgeStart, edgeEnd] of boundary) {
    nearest = nearerLineObstruction(
      nearest,
      lineSegmentObstruction(start, end, edgeStart, edgeEnd),
    )
  }
  for (const polygon of world.polygons) {
    if (excludedSourceId !== undefined && polygon.sourceId === excludedSourceId) continue
    for (let index = 0; index < polygon.points.length; index += 1) {
      nearest = nearerLineObstruction(nearest, lineSegmentObstruction(
        start,
        end,
        polygon.points[index],
        polygon.points[(index + 1) % polygon.points.length],
      ))
    }
  }
  for (const circle of world.circles) {
    if (excludedSourceId !== undefined && circle.sourceId === excludedSourceId) continue
    nearest = nearerLineObstruction(
      nearest,
      lineCircleObstruction(start, end, circle.center, circle.radius),
    )
  }
  for (const segment of world.segments) {
    if (excludedSourceId !== undefined && segment.sourceId === excludedSourceId) continue
    nearest = nearerLineObstruction(nearest, lineCapsuleObstruction(
      start,
      end,
      segment.start,
      segment.end,
      segment.radius,
    ))
  }
  return nearest?.point ?? null
}

/**
 * Returns the first point hit by a point-sized spell segment. The selected
 * scenery actor can be excluded so its own collision does not occlude its
 * native target attachment.
 */
export function clipBoneyardSegment(
  start: BoneyardPoint,
  end: BoneyardPoint,
  bounds: BoneyardBounds,
  world: BoneyardCollisionWorld,
  excludedSourceId?: string,
): BoneyardPoint {
  return firstBoneyardLineObstruction(
    start,
    end,
    bounds,
    world,
    excludedSourceId,
  ) ?? { ...end }
}

export function resolveBoneyardMovement(
  start: BoneyardPoint,
  requested: BoneyardPoint,
  bounds: BoneyardBounds,
  world: BoneyardCollisionWorld,
  radius: number,
): BoneyardPoint {
  const desired = clampToBounds(requested, bounds, radius)
  if (!firstContact(desired, world, radius, start)) return desired

  const swept = sweepToLastClear(start, desired, world, radius)
  const contact = firstContact(
    mix(swept, desired, 1 / 64),
    world,
    radius,
    start,
  ) ?? firstContact(desired, world, radius, start)
  if (!contact) return swept

  const remaining = { x: desired.x - swept.x, y: desired.y - swept.y }
  const towardSurface = remaining.x * contact.normal.x + remaining.y * contact.normal.y
  const slide = towardSurface < 0
    ? {
        x: remaining.x - contact.normal.x * towardSurface,
        y: remaining.y - contact.normal.y * towardSurface,
      }
    : remaining
  const slideTarget = clampToBounds(
    { x: swept.x + slide.x, y: swept.y + slide.y },
    bounds,
    radius,
  )
  return firstContact(slideTarget, world, radius, swept)
    ? sweepToLastClear(swept, slideTarget, world, radius)
    : slideTarget
}

function appendObjectCollision(
  object: BoneyardObject,
  polygons: BoneyardCollisionPolygon[],
  circles: BoneyardCollisionCircle[],
) {
  if (object.typeId === 2001) {
    circles.push({ center: { ...object.pos }, radius: object.variant === 1 ? 12 : 8 })
  } else if (object.typeId === 2009) {
    appendLocalPolygon(polygons, object, MONUMENT_POLYGONS[object.variant ?? 0])
  } else if (object.typeId === 2029) {
    const sourceId = `scenery:${object.eid}`
    circles.push({
      center: { ...object.pos },
      radius: object.variant === 1 ? 0 : 1,
      sourceId,
    })
    if ((object.overlayVariant ?? 0) >= 7) {
      appendLocalPolygon(polygons, object, GRAVE_POLYGON, sourceId)
    }
  } else if (object.typeId === 2040) {
    appendLocalPolygon(polygons, object, BUILDING_POLYGONS[object.variant ?? 0])
  } else if (object.typeId === 2061) {
    circles.push({ center: { ...object.pos }, radius: GOODIE_RADIUS })
    appendLocalPolygon(polygons, object, GOODIE_POLYGON)
  }
}

function appendLocalPolygon(
  polygons: BoneyardCollisionPolygon[],
  object: BoneyardObject,
  local: readonly BoneyardPoint[] | undefined,
  sourceId?: string,
) {
  if (!local) return
  polygons.push({
    points: local.map((point) => ({
      x: object.pos.x + point.x,
      y: object.pos.y + point.y,
    })),
    ...(sourceId === undefined ? {} : { sourceId }),
  })
}

function appendPost(
  point: BoneyardPoint,
  posts: Set<string>,
  circles: BoneyardCollisionCircle[],
) {
  const key = `${point.x},${point.y}`
  if (posts.has(key)) return
  posts.add(key)
  circles.push({ center: { ...point }, radius: FENCE_POST_RADIUS })
}

interface CollisionContact {
  normal: BoneyardPoint
}

function firstContact(
  center: BoneyardPoint,
  world: BoneyardCollisionWorld,
  radius: number,
  previous: BoneyardPoint,
): CollisionContact | null {
  for (const polygon of world.polygons) {
    const contact = polygonContact(center, radius, polygon.points, previous)
    if (contact) return contact
  }
  for (const segment of world.segments) {
    const contact = segmentContact(
      center,
      radius + segment.radius,
      segment.start,
      segment.end,
      previous,
    )
    if (contact) return contact
  }
  for (const circle of world.circles) {
    const dx = center.x - circle.center.x
    const dy = center.y - circle.center.y
    const required = radius + circle.radius
    if (dx * dx + dy * dy >= required * required) continue
    return { normal: normalized(dx, dy, previous.x - center.x, previous.y - center.y) }
  }
  return null
}

function polygonContact(
  center: BoneyardPoint,
  radius: number,
  points: readonly BoneyardPoint[],
  previous: BoneyardPoint,
): CollisionContact | null {
  let nearest = points[0]
  let nearestDistanceSquared = Number.POSITIVE_INFINITY
  for (let index = 0; index < points.length; index += 1) {
    const point = closestPointOnSegment(
      center,
      points[index],
      points[(index + 1) % points.length],
    )
    const dx = center.x - point.x
    const dy = center.y - point.y
    const distanceSquared = dx * dx + dy * dy
    if (distanceSquared < nearestDistanceSquared) {
      nearestDistanceSquared = distanceSquared
      nearest = point
    }
  }
  const inside = pointInPolygon(center, points)
  if (!inside && nearestDistanceSquared >= radius * radius) return null
  return inside
    ? { normal: normalized(nearest.x - center.x, nearest.y - center.y, previous.x - center.x, previous.y - center.y) }
    : { normal: normalized(center.x - nearest.x, center.y - nearest.y, previous.x - center.x, previous.y - center.y) }
}

function segmentContact(
  center: BoneyardPoint,
  radius: number,
  start: BoneyardPoint,
  end: BoneyardPoint,
  previous: BoneyardPoint,
): CollisionContact | null {
  const nearest = closestPointOnSegment(center, start, end)
  const dx = center.x - nearest.x
  const dy = center.y - nearest.y
  if (dx * dx + dy * dy >= radius * radius) return null
  return { normal: normalized(dx, dy, previous.x - center.x, previous.y - center.y) }
}

function sweepToLastClear(
  start: BoneyardPoint,
  end: BoneyardPoint,
  world: BoneyardCollisionWorld,
  radius: number,
): BoneyardPoint {
  let clear = { ...start }
  let blocked = { ...end }
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const candidate = mix(clear, blocked, 0.5)
    if (firstContact(candidate, world, radius, clear)) blocked = candidate
    else clear = candidate
  }
  return clear
}

function pointInPolygon(point: BoneyardPoint, polygon: readonly BoneyardPoint[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    if (((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

function closestPointOnSegment(
  point: BoneyardPoint,
  start: BoneyardPoint,
  end: BoneyardPoint,
): BoneyardPoint {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return { ...start }
  const t = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
  ))
  return { x: start.x + dx * t, y: start.y + dy * t }
}

function normalized(x: number, y: number, fallbackX: number, fallbackY: number): BoneyardPoint {
  const length = Math.hypot(x, y)
  if (length > 0.000001) return { x: x / length, y: y / length }
  const fallbackLength = Math.hypot(fallbackX, fallbackY)
  if (fallbackLength > 0.000001) {
    return { x: fallbackX / fallbackLength, y: fallbackY / fallbackLength }
  }
  return { x: 1, y: 0 }
}

function mix(start: BoneyardPoint, end: BoneyardPoint, t: number): BoneyardPoint {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  }
}

function clampToBounds(
  point: BoneyardPoint,
  bounds: BoneyardBounds,
  radius: number,
): BoneyardPoint {
  return {
    x: Math.min(bounds.x + bounds.w - radius, Math.max(bounds.x + radius, point.x)),
    y: Math.min(bounds.y + bounds.h - radius, Math.max(bounds.y + radius, point.y)),
  }
}

function rectangle(left: number, top: number, right: number, bottom: number): readonly BoneyardPoint[] {
  return [
    { x: left, y: bottom }, { x: left, y: top },
    { x: right, y: top }, { x: right, y: bottom },
  ]
}

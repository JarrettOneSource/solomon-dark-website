import { PLAYER_CHARACTER_RADIUS } from '../../core-kernels/player-character.ts'
import type { Vector2 } from '../../core-kernels/vector.ts'
import {
  canPlaceBoneyardBody,
  withBoneyardGateCollision,
  type BoneyardCollisionCircle,
  type BoneyardCollisionPolygon,
  type BoneyardCollisionSegment,
} from '../boneyard-collision.ts'
import type { BoneyardWorldState } from '../boneyard-world.ts'
import { ML_BOT_POLICY_SCALES } from './spec.ts'

export type MlBotPolicyGeometryWorld = Pick<
  BoneyardWorldState,
  'bounds' | 'collision' | 'gateLeaves' | 'scenerySpellTargets'
>

export interface MlBotPolicyGeometryObservation {
  readonly obstacles: Float32Array
  readonly patchAndRays: Float32Array
}

interface PrimitiveFeature {
  readonly clearance: number
  readonly extentX: number
  readonly extentY: number
  readonly index: number
  readonly isDestructible: boolean
  readonly kind: 'circle' | 'polygon' | 'segment'
  readonly nearest: Vector2
  readonly normal: Vector2
  readonly radius: number
}

const INVERSE_SQRT_TWO = 1 / Math.sqrt(2)
const DIRECTIONS = Object.freeze([
  { x: 1, y: 0 },
  { x: INVERSE_SQRT_TWO, y: INVERSE_SQRT_TWO },
  { x: 0, y: 1 },
  { x: -INVERSE_SQRT_TWO, y: INVERSE_SQRT_TWO },
  { x: -1, y: 0 },
  { x: -INVERSE_SQRT_TWO, y: -INVERSE_SQRT_TWO },
  { x: 0, y: -1 },
  { x: INVERSE_SQRT_TWO, y: -INVERSE_SQRT_TWO },
])

export function observeMlBotPolicyGeometry(
  world: MlBotPolicyGeometryWorld,
  position: Readonly<Vector2>,
): MlBotPolicyGeometryObservation {
  const collision = withBoneyardGateCollision(world.collision, world.gateLeaves)
  const patchAndRays = new Float32Array(56)
  let cursor = 0
  for (const direction of DIRECTIONS) {
    let clearance: number = ML_BOT_POLICY_SCALES.rayRange
    for (
      let distance = ML_BOT_POLICY_SCALES.rayStep;
      distance <= ML_BOT_POLICY_SCALES.rayRange;
      distance += ML_BOT_POLICY_SCALES.rayStep
    ) {
      const sample = {
        x: position.x + direction.x * distance,
        y: position.y + direction.y * distance,
      }
      if (!canPlaceBoneyardBody(sample, world.bounds, collision, PLAYER_CHARACTER_RADIUS)) {
        clearance = distance
        break
      }
    }
    patchAndRays[cursor] = clearance / ML_BOT_POLICY_SCALES.rayRange
    cursor += 1
  }
  for (let row = -ML_BOT_POLICY_SCALES.patchRadius; row <= ML_BOT_POLICY_SCALES.patchRadius; row += 1) {
    for (
      let column = -ML_BOT_POLICY_SCALES.patchRadius;
      column <= ML_BOT_POLICY_SCALES.patchRadius;
      column += 1
    ) {
      if (row === 0 && column === 0) continue
      patchAndRays[cursor] = Number(canPlaceBoneyardBody({
        x: position.x + column * ML_BOT_POLICY_SCALES.patchSpacing,
        y: position.y + row * ML_BOT_POLICY_SCALES.patchSpacing,
      }, world.bounds, collision, PLAYER_CHARACTER_RADIUS))
      cursor += 1
    }
  }

  const destructibleIds = new Set(world.scenerySpellTargets.map(({ id }) => String(id)))
  const features: PrimitiveFeature[] = []
  let primitiveIndex = 0
  for (const circle of collision.circles) {
    features.push(circleFeature(circle, position, primitiveIndex, destructibleIds))
    primitiveIndex += 1
  }
  for (const segment of collision.segments) {
    features.push(segmentFeature(segment, position, primitiveIndex, destructibleIds))
    primitiveIndex += 1
  }
  for (const polygon of collision.polygons) {
    features.push(polygonFeature(polygon, position, primitiveIndex, destructibleIds))
    primitiveIndex += 1
  }
  features.sort((left, right) => left.clearance - right.clearance || left.index - right.index)

  const obstacles = new Float32Array(8 * 13)
  for (let slot = 0; slot < Math.min(8, features.length); slot += 1) {
    const feature = features[slot]!
    const start = slot * 13
    obstacles[start] = 1
    obstacles[start + 1] = scaledSigned(feature.nearest.x, ML_BOT_POLICY_SCALES.range)
    obstacles[start + 2] = scaledSigned(feature.nearest.y, ML_BOT_POLICY_SCALES.range)
    obstacles[start + 3] = scaledUnsigned(feature.clearance, ML_BOT_POLICY_SCALES.range)
    obstacles[start + 4] = clampSigned(feature.normal.x)
    obstacles[start + 5] = clampSigned(feature.normal.y)
    obstacles[start + 6] = scaledUnsigned(feature.radius, ML_BOT_POLICY_SCALES.radius)
    obstacles[start + 7] = scaledUnsigned(feature.extentX, ML_BOT_POLICY_SCALES.range)
    obstacles[start + 8] = scaledUnsigned(feature.extentY, ML_BOT_POLICY_SCALES.range)
    obstacles[start + 9] = Number(feature.kind === 'circle')
    obstacles[start + 10] = Number(feature.kind === 'segment')
    obstacles[start + 11] = Number(feature.kind === 'polygon')
    obstacles[start + 12] = Number(feature.isDestructible)
  }
  return { obstacles, patchAndRays }
}

function circleFeature(
  circle: BoneyardCollisionCircle,
  position: Readonly<Vector2>,
  index: number,
  destructibleIds: ReadonlySet<string>,
): PrimitiveFeature {
  const fromCenter = normalized(position.x - circle.center.x, position.y - circle.center.y)
  const closest = {
    x: circle.center.x + fromCenter.x * circle.radius,
    y: circle.center.y + fromCenter.y * circle.radius,
  }
  const centerDistance = Math.hypot(position.x - circle.center.x, position.y - circle.center.y)
  return {
    clearance: Math.max(0, centerDistance - circle.radius - PLAYER_CHARACTER_RADIUS),
    extentX: 0,
    extentY: 0,
    index,
    isDestructible: circle.sourceId !== undefined && destructibleIds.has(circle.sourceId),
    kind: 'circle',
    nearest: { x: closest.x - position.x, y: closest.y - position.y },
    normal: fromCenter,
    radius: circle.radius,
  }
}

function segmentFeature(
  segment: BoneyardCollisionSegment,
  position: Readonly<Vector2>,
  index: number,
  destructibleIds: ReadonlySet<string>,
): PrimitiveFeature {
  const closest = closestPointOnSegment(position, segment.start, segment.end)
  const delta = { x: closest.x - position.x, y: closest.y - position.y }
  const distance = Math.hypot(delta.x, delta.y)
  return {
    clearance: Math.max(0, distance - segment.radius - PLAYER_CHARACTER_RADIUS),
    extentX: Math.abs(segment.end.x - segment.start.x) / 2,
    extentY: Math.abs(segment.end.y - segment.start.y) / 2,
    index,
    isDestructible: segment.sourceId !== undefined && destructibleIds.has(segment.sourceId),
    kind: 'segment',
    nearest: delta,
    normal: normalized(position.x - closest.x, position.y - closest.y),
    radius: segment.radius,
  }
}

function polygonFeature(
  polygon: BoneyardCollisionPolygon,
  position: Readonly<Vector2>,
  index: number,
  destructibleIds: ReadonlySet<string>,
): PrimitiveFeature {
  const closest = closestPointOnPolygon(position, polygon.points)
  const delta = { x: closest.x - position.x, y: closest.y - position.y }
  const distance = Math.hypot(delta.x, delta.y)
  const bounds = polygonBounds(polygon.points)
  return {
    clearance: pointInPolygon(position, polygon.points)
      ? 0
      : Math.max(0, distance - PLAYER_CHARACTER_RADIUS),
    extentX: bounds.w / 2,
    extentY: bounds.h / 2,
    index,
    isDestructible: polygon.sourceId !== undefined && destructibleIds.has(polygon.sourceId),
    kind: 'polygon',
    nearest: delta,
    normal: normalized(position.x - closest.x, position.y - closest.y),
    radius: 0,
  }
}

function closestPointOnPolygon(
  point: Readonly<Vector2>,
  polygon: readonly Readonly<Vector2>[],
): Vector2 {
  if (polygon.length === 0) return { ...point }
  let closest = polygon[0]!
  let closestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!
    const end = polygon[(index + 1) % polygon.length]!
    const candidate = closestPointOnSegment(point, start, end)
    const distance = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2
    if (distance < closestDistance) {
      closest = candidate
      closestDistance = distance
    }
  }
  return { ...closest }
}

function closestPointOnSegment(
  point: Readonly<Vector2>,
  start: Readonly<Vector2>,
  end: Readonly<Vector2>,
): Vector2 {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return { ...start }
  const progress = Math.max(0, Math.min(1, (
    (point.x - start.x) * dx + (point.y - start.y) * dy
  ) / lengthSquared))
  return { x: start.x + dx * progress, y: start.y + dy * progress }
}

function pointInPolygon(point: Readonly<Vector2>, polygon: readonly Readonly<Vector2>[]): boolean {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index]!
    const previousPoint = polygon[previous]!
    if (
      (currentPoint.y > point.y) !== (previousPoint.y > point.y)
      && point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)
        / (previousPoint.y - currentPoint.y) + currentPoint.x
    ) inside = !inside
  }
  return inside
}

function polygonBounds(points: readonly Readonly<Vector2>[]): { h: number; w: number } {
  if (points.length === 0) return { h: 0, w: 0 }
  const x = points.map((point) => point.x)
  const y = points.map((point) => point.y)
  return { h: Math.max(...y) - Math.min(...y), w: Math.max(...x) - Math.min(...x) }
}

function normalized(x: number, y: number): Vector2 {
  const magnitude = Math.hypot(x, y)
  return magnitude > 1e-9 ? { x: x / magnitude, y: y / magnitude } : { x: 1, y: 0 }
}

function scaledSigned(value: number, scale: number): number {
  return clampSigned(value / scale)
}

function scaledUnsigned(value: number, scale: number): number {
  return Math.max(0, Math.min(1, value / scale))
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

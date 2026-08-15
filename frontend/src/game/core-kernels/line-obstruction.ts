import type { Vector2 } from './vector.ts'

export interface LineObstruction {
  point: Vector2
  t: number
}

export interface LineBounds {
  h: number
  w: number
  x: number
  y: number
}

export function lineBoundsExitObstruction(
  start: Vector2,
  end: Vector2,
  bounds: LineBounds,
): LineObstruction | null {
  const delta = subtract(end, start)
  let t = Number.POSITIVE_INFINITY
  if (delta.x > 0) t = Math.min(t, (bounds.x + bounds.w - start.x) / delta.x)
  else if (delta.x < 0) t = Math.min(t, (bounds.x - start.x) / delta.x)
  if (delta.y > 0) t = Math.min(t, (bounds.y + bounds.h - start.y) / delta.y)
  else if (delta.y < 0) t = Math.min(t, (bounds.y - start.y) / delta.y)
  return t >= 0 && t <= 1 ? { point: mix(start, end, t), t } : null
}

export function nearerLineObstruction(
  current: LineObstruction | null,
  candidate: LineObstruction | null,
): LineObstruction | null {
  if (!candidate || candidate.t < 0 || candidate.t > 1) return current
  return !current || candidate.t < current.t ? candidate : current
}

export function lineSegmentObstruction(
  start: Vector2,
  end: Vector2,
  obstacleStart: Vector2,
  obstacleEnd: Vector2,
): LineObstruction | null {
  const ray = subtract(end, start)
  const obstacle = subtract(obstacleEnd, obstacleStart)
  const denominator = cross(ray, obstacle)
  if (Math.abs(denominator) < Number.EPSILON) return null
  const offset = subtract(obstacleStart, start)
  const t = cross(offset, obstacle) / denominator
  const u = cross(offset, ray) / denominator
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { point: mix(start, end, t), t }
}

export function lineCircleObstruction(
  start: Vector2,
  end: Vector2,
  center: Vector2,
  radius: number,
): LineObstruction | null {
  const ray = subtract(end, start)
  const relative = subtract(start, center)
  const a = dot(ray, ray)
  if (a === 0) return null
  const c = dot(relative, relative) - radius * radius
  if (c <= 0) return { point: { ...start }, t: 0 }
  const b = 2 * dot(relative, ray)
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return null
  const root = Math.sqrt(discriminant)
  const near = (-b - root) / (2 * a)
  const far = (-b + root) / (2 * a)
  const t = near >= 0 && near <= 1
    ? near
    : far >= 0 && far <= 1
      ? far
      : null
  return t === null ? null : { point: mix(start, end, t), t }
}

export function lineCapsuleObstruction(
  start: Vector2,
  end: Vector2,
  capsuleStart: Vector2,
  capsuleEnd: Vector2,
  radius: number,
): LineObstruction | null {
  if (radius <= 0) {
    return lineSegmentObstruction(start, end, capsuleStart, capsuleEnd)
  }
  let result = nearerLineObstruction(
    lineCircleObstruction(start, end, capsuleStart, radius),
    lineCircleObstruction(start, end, capsuleEnd, radius),
  )
  const axis = subtract(capsuleEnd, capsuleStart)
  const length = Math.hypot(axis.x, axis.y)
  if (length === 0) return result
  const normal = { x: -axis.y / length, y: axis.x / length }
  for (const sign of [-1, 1]) {
    const offset = { x: normal.x * radius * sign, y: normal.y * radius * sign }
    result = nearerLineObstruction(result, lineSegmentObstruction(
      start,
      end,
      add(capsuleStart, offset),
      add(capsuleEnd, offset),
    ))
  }
  return result
}

function add(first: Vector2, second: Vector2): Vector2 {
  return { x: first.x + second.x, y: first.y + second.y }
}

function subtract(first: Vector2, second: Vector2): Vector2 {
  return { x: first.x - second.x, y: first.y - second.y }
}

function dot(first: Vector2, second: Vector2): number {
  return first.x * second.x + first.y * second.y
}

function cross(first: Vector2, second: Vector2): number {
  return first.x * second.y - first.y * second.x
}

function mix(start: Vector2, end: Vector2, t: number): Vector2 {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  }
}

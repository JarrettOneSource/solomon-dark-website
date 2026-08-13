import {
  isHubTraversable as isCourtyardTraversable,
  moveWithHubCollision as moveAgainstCourtyardSegments,
} from './hub-collision.ts'
import { PLAYER_CHARACTER_RADIUS } from './player-character.ts'
import type { Vector2 } from './vector.ts'

export const HUB_WORLD_WIDTH = 2000
export const HUB_WORLD_HEIGHT = 1024
export const HUB_CAMERA_SCALE = 1.2
export const HUB_VIEW_WIDTH = 1600 / HUB_CAMERA_SCALE
export const HUB_VIEW_HEIGHT = 900 / HUB_CAMERA_SCALE
export const HUB_SPAWN = { x: 950.64, y: 164.04 }

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function hubCameraOrigin(position: Vector2): Vector2 {
  const halfWidth = HUB_VIEW_WIDTH / 2
  const halfHeight = HUB_VIEW_HEIGHT / 2
  return {
    x: clamp(position.x, halfWidth, HUB_WORLD_WIDTH - halfWidth) - halfWidth,
    y: clamp(position.y, halfHeight, HUB_WORLD_HEIGHT - halfHeight) - halfHeight,
  }
}

export function isHubTraversable(
  point: Vector2,
  radius = PLAYER_CHARACTER_RADIUS,
): boolean {
  return isCourtyardTraversable(point, radius)
}

export function moveWithHubCollision(
  position: Vector2,
  delta: Vector2,
  radius = PLAYER_CHARACTER_RADIUS,
): Vector2 {
  return moveAgainstCourtyardSegments(position, delta, radius)
}

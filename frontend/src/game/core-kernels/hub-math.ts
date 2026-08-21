import {
  isHubTraversable as isCourtyardTraversable,
  moveWithHubCollision as moveAgainstCourtyardSegments,
} from './hub-collision.ts'
import {
  HUB_REGION_DEFINITIONS,
  type HubRegionId,
} from './hub-regions.ts'
import { PLAYER_CHARACTER_RADIUS } from './player-character.ts'
import type { Vector2 } from './vector.ts'

export const HUB_WORLD_WIDTH = 2000
export const HUB_WORLD_HEIGHT = 1024
export const HUB_CAMERA_SCALE = 1.2
export const HUB_VIEW_WIDTH = 1600 / HUB_CAMERA_SCALE
export const HUB_VIEW_HEIGHT = 900 / HUB_CAMERA_SCALE
export const HUB_SPAWN = { x: 950.64, y: 164.04 }

export interface HubRenderViewport {
  height: number
  width: number
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function hubCameraOrigin(
  position: Vector2,
  viewport?: HubRenderViewport,
  cameraScale = HUB_CAMERA_SCALE,
): Vector2 {
  return hubRegionCameraOrigin('courtyard', position, viewport, cameraScale)
}

export function hubRegionCameraOrigin(
  region: HubRegionId,
  position: Vector2,
  viewport: HubRenderViewport = { width: 1600, height: 900 },
  cameraScale = HUB_CAMERA_SCALE,
): Vector2 {
  const definition = HUB_REGION_DEFINITIONS[region]
  const viewWidth = viewport.width / cameraScale
  const viewHeight = viewport.height / cameraScale
  return {
    x: cameraAxisOrigin(position.x, viewWidth, definition.width),
    y: cameraAxisOrigin(position.y, viewHeight, definition.height),
  }
}

function cameraAxisOrigin(position: number, viewSize: number, worldSize: number): number {
  if (worldSize <= viewSize) return (worldSize - viewSize) / 2
  const halfView = viewSize / 2
  return clamp(position, halfView, worldSize - halfView) - halfView
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

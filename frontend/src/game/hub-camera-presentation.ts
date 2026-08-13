import {
  HUB_CAMERA_SCALE,
  HUB_WORLD_HEIGHT,
  HUB_WORLD_WIDTH,
  HUB_VIEW_HEIGHT,
  HUB_VIEW_WIDTH,
} from './core-kernels/hub-math.ts'
import type { Vector2 } from './core-kernels/vector.ts'

export const HUB_SOUTHERN_CAMERA_FACTOR = 1.25

export const HUB_SOUTHERN_EXTENT = {
  x: specialExtent(HUB_WORLD_WIDTH, HUB_VIEW_WIDTH),
  y: specialExtent(HUB_WORLD_HEIGHT, HUB_VIEW_HEIGHT),
} as const

export const HUB_SOUTHERN_WEST_PLATFORM_ORIGIN = {
  x: 128 / HUB_CAMERA_SCALE,
  y: HUB_SOUTHERN_EXTENT.y - 407,
} as const

export const HUB_SOUTHERN_EAST_PLATFORM_ORIGIN = {
  x: 1843,
  y: HUB_SOUTHERN_EXTENT.y - 415,
} as const

export const HUB_ASTRONOMER_ROOT = {
  x: 2150,
  y: HUB_SOUTHERN_EXTENT.y - 190,
} as const

export const HUB_ASTRONOMER_TELESCOPE_ORIGIN = {
  x: 2017,
  y: HUB_SOUTHERN_EXTENT.y - 358,
} as const

export function hubSouthernCameraTranslation(cameraOrigin: Vector2): Vector2 {
  const cameraCenter = {
    x: cameraOrigin.x + HUB_VIEW_WIDTH / 2,
    y: cameraOrigin.y + HUB_VIEW_HEIGHT / 2,
  }
  return {
    x: -cameraOrigin.x - (HUB_SOUTHERN_CAMERA_FACTOR - 1) * cameraCenter.x,
    y: -cameraOrigin.y - (HUB_SOUTHERN_CAMERA_FACTOR - 1) * cameraCenter.y,
  }
}

function specialExtent(boundsExtent: number, viewExtent: number): number {
  return HUB_SOUTHERN_CAMERA_FACTOR * boundsExtent
    - (HUB_SOUTHERN_CAMERA_FACTOR - 1) * viewExtent / 2
}

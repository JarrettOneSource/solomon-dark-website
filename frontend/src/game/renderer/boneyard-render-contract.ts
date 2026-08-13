import type { Camera } from '../../editor/render.ts'
import type { Vec2 } from '../../editor/model.ts'

export const BONEYARD_RENDER_WIDTH = 1600
export const BONEYARD_RENDER_HEIGHT = 900
export const BONEYARD_CAMERA_ZOOM = 1.35
export const BONEYARD_STATIC_TILE_SIZE = 1024
export const BONEYARD_STATIC_ART_MARGIN = 256

export interface BoneyardBounds {
  h: number
  w: number
  x: number
  y: number
}

export interface BoneyardStaticTile {
  h: number
  w: number
  x: number
  y: number
}

export function boneyardCamera(position: Vec2, bounds: BoneyardBounds): Camera {
  return {
    x: clampCameraAxis(
      position.x,
      bounds.x,
      bounds.w,
      BONEYARD_RENDER_WIDTH / 2 / BONEYARD_CAMERA_ZOOM,
    ),
    y: clampCameraAxis(
      position.y,
      bounds.y,
      bounds.h,
      BONEYARD_RENDER_HEIGHT / 2 / BONEYARD_CAMERA_ZOOM,
    ),
    zoom: BONEYARD_CAMERA_ZOOM,
  }
}

export function boneyardWorldPosition(camera: Camera): Vec2 {
  return {
    x: BONEYARD_RENDER_WIDTH / 2 - camera.x * camera.zoom,
    y: BONEYARD_RENDER_HEIGHT / 2 - camera.y * camera.zoom,
  }
}

export function boneyardStaticTiles(
  bounds: BoneyardBounds,
  tileSize = BONEYARD_STATIC_TILE_SIZE,
  margin = BONEYARD_STATIC_ART_MARGIN,
): BoneyardStaticTile[] {
  const x0 = bounds.x - margin
  const y0 = bounds.y - margin
  const x1 = bounds.x + bounds.w + margin
  const y1 = bounds.y + bounds.h + margin
  const tiles: BoneyardStaticTile[] = []
  for (let y = y0; y < y1; y += tileSize) {
    for (let x = x0; x < x1; x += tileSize) {
      tiles.push({
        h: Math.min(tileSize, y1 - y),
        w: Math.min(tileSize, x1 - x),
        x,
        y,
      })
    }
  }
  return tiles
}

function clampCameraAxis(
  position: number,
  start: number,
  size: number,
  halfView: number,
): number {
  if (size <= halfView * 2) return start + size / 2
  return Math.min(start + size - halfView, Math.max(start + halfView, position))
}

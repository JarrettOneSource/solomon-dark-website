import type { Camera } from '../../editor/render.ts'
import type { Vec2 } from '../../editor/model.ts'
import {
  GAME_VIEWPORT_MIN_HEIGHT,
  GAME_VIEWPORT_MIN_WIDTH,
} from './game-viewport.ts'

export const BONEYARD_RENDER_WIDTH = GAME_VIEWPORT_MIN_WIDTH
export const BONEYARD_RENDER_HEIGHT = GAME_VIEWPORT_MIN_HEIGHT
export const BONEYARD_CAMERA_ZOOM = 1.35
export const BONEYARD_STATIC_TILE_SIZE = 1024
export const BONEYARD_STATIC_ART_MARGIN = 256
export const BONEYARD_RESIDENT_CULL_PADDING = 32

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

export interface BoneyardRenderViewport {
  height: number
  width: number
}

export function boneyardCamera(
  position: Vec2,
  bounds: BoneyardBounds,
  viewport: BoneyardRenderViewport = {
    height: BONEYARD_RENDER_HEIGHT,
    width: BONEYARD_RENDER_WIDTH,
  },
): Camera {
  return {
    x: clampCameraAxis(
      position.x,
      bounds.x,
      bounds.w,
      viewport.width / 2 / BONEYARD_CAMERA_ZOOM,
    ),
    y: clampCameraAxis(
      position.y,
      bounds.y,
      bounds.h,
      viewport.height / 2 / BONEYARD_CAMERA_ZOOM,
    ),
    zoom: BONEYARD_CAMERA_ZOOM,
  }
}

export function boneyardWorldPosition(
  camera: Camera,
  viewport: BoneyardRenderViewport = {
    height: BONEYARD_RENDER_HEIGHT,
    width: BONEYARD_RENDER_WIDTH,
  },
): Vec2 {
  return {
    x: viewport.width / 2 - camera.x * camera.zoom,
    y: viewport.height / 2 - camera.y * camera.zoom,
  }
}

export function boneyardVisibleWorldBounds(
  camera: Camera,
  viewport: BoneyardRenderViewport = {
    height: BONEYARD_RENDER_HEIGHT,
    width: BONEYARD_RENDER_WIDTH,
  },
  padding = BONEYARD_RESIDENT_CULL_PADDING,
): BoneyardBounds {
  const width = viewport.width / camera.zoom
  const height = viewport.height / camera.zoom
  return {
    x: camera.x - width / 2 - padding,
    y: camera.y - height / 2 - padding,
    w: width + padding * 2,
    h: height + padding * 2,
  }
}

export function boneyardResidentIsVisible(
  resident: BoneyardBounds,
  view: BoneyardBounds,
): boolean {
  return resident.x <= view.x + view.w
    && resident.x + resident.w >= view.x
    && resident.y <= view.y + view.h
    && resident.y + resident.h >= view.y
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

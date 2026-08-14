import type { Vector2 } from '../core-kernels/vector.ts'

interface NativePointerSurface {
  height: number
  left: number
  top: number
  width: number
}

interface NativePointerViewport {
  height: number
  width: number
}

const NATIVE_AIM_ANCHOR_Y_PIXELS = 25

export function projectNativeWorldPointer(
  pointer: Vector2,
  surface: NativePointerSurface,
  viewport: NativePointerViewport,
  viewOrigin: Vector2,
  viewScale: number,
): Vector2 | null {
  if (
    !finitePoint(pointer)
    || !finitePoint(viewOrigin)
    || !Number.isFinite(surface.left)
    || !Number.isFinite(surface.top)
    || !(surface.width > 0)
    || !(surface.height > 0)
    || !(viewport.width > 0)
    || !(viewport.height > 0)
    || !(viewScale > 0)
    || !Number.isFinite(viewScale)
  ) return null

  const logicalScreen = {
    x: (pointer.x - surface.left) * viewport.width / surface.width,
    y: (pointer.y - surface.top) * viewport.height / surface.height,
  }
  const world = {
    x: viewOrigin.x + logicalScreen.x / viewScale,
    y: viewOrigin.y + logicalScreen.y / viewScale,
  }
  return finitePoint(world) ? world : null
}

export function projectNativeStickAim(
  direction: Vector2,
  playerPosition: Vector2,
  viewport: NativePointerViewport,
  viewScale: number,
): Vector2 | null {
  if (
    !finitePoint(direction)
    || !finitePoint(playerPosition)
    || !(viewport.width > 0)
    || !(viewport.height > 0)
    || !(viewScale > 0)
    || !Number.isFinite(viewScale)
  ) return null

  const magnitude = Math.hypot(direction.x, direction.y)
  const reachPixels = Math.min(viewport.width, viewport.height) / 2
    - NATIVE_AIM_ANCHOR_Y_PIXELS
  if (!(magnitude > 0.001) || !(reachPixels > 0)) return null

  const reach = reachPixels / viewScale
  return {
    x: playerPosition.x + direction.x / magnitude * reach,
    y: playerPosition.y - NATIVE_AIM_ANCHOR_Y_PIXELS / viewScale
      + direction.y / magnitude * reach,
  }
}

function finitePoint(point: Vector2): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

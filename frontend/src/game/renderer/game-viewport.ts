export const GAME_VIEWPORT_MIN_WIDTH = 1600
export const GAME_VIEWPORT_MIN_HEIGHT = 900

export interface GameViewportLayout {
  displayScale: number
  height: number
  width: number
}

export function fixedGameViewportScale(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 1
  }
  return Math.min(
    width / GAME_VIEWPORT_MIN_WIDTH,
    height / GAME_VIEWPORT_MIN_HEIGHT,
  )
}

export function gameViewportLayout(width: number, height: number): GameViewportLayout {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {
      displayScale: 1,
      height: GAME_VIEWPORT_MIN_HEIGHT,
      width: GAME_VIEWPORT_MIN_WIDTH,
    }
  }
  const displayScale = Math.min(1, fixedGameViewportScale(width, height))
  return {
    displayScale,
    height: height / displayScale,
    width: width / displayScale,
  }
}

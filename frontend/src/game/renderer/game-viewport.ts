export const GAME_VIEWPORT_MIN_WIDTH = 1600
export const GAME_VIEWPORT_MIN_HEIGHT = 900

export interface GameViewportLayout {
  displayScale: number
  height: number
  width: number
}

export interface GameViewportBounds {
  height: number
  width: number
  x: number
  y: number
}

export interface FixedGameViewportLayout extends GameViewportLayout {
  nativeStage: GameViewportBounds
}

export type GameViewportHorizontalAnchor = 'center' | 'left' | 'right'
export type GameViewportVerticalAnchor = 'bottom' | 'center' | 'top'

export const FIXED_GAME_MAX_PRESENTATION_RESOLUTION = 1.5

export function fixedGameViewportScale(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 1
  }
  return Math.min(
    width / GAME_VIEWPORT_MIN_WIDTH,
    height / GAME_VIEWPORT_MIN_HEIGHT,
  )
}

export function fixedGameViewportLayout(
  width: number,
  height: number,
): FixedGameViewportLayout {
  const displayScale = fixedGameViewportScale(width, height)
  const measured = validSize(width, height)
  const logicalWidth = measured ? width / displayScale : GAME_VIEWPORT_MIN_WIDTH
  const logicalHeight = measured ? height / displayScale : GAME_VIEWPORT_MIN_HEIGHT
  return {
    displayScale,
    height: logicalHeight,
    nativeStage: {
      height: GAME_VIEWPORT_MIN_HEIGHT,
      width: GAME_VIEWPORT_MIN_WIDTH,
      x: (logicalWidth - GAME_VIEWPORT_MIN_WIDTH) / 2,
      y: (logicalHeight - GAME_VIEWPORT_MIN_HEIGHT) / 2,
    },
    width: logicalWidth,
  }
}

export function fixedGameStageBounds(
  layout: FixedGameViewportLayout,
  horizontal: GameViewportHorizontalAnchor,
  vertical: GameViewportVerticalAnchor,
): GameViewportBounds {
  return gameViewportAnchoredBounds(
    layout,
    GAME_VIEWPORT_MIN_WIDTH,
    GAME_VIEWPORT_MIN_HEIGHT,
    horizontal,
    vertical,
  )
}

export function gameViewportAnchoredBounds(
  viewport: Pick<GameViewportLayout, 'height' | 'width'>,
  width: number,
  height: number,
  horizontal: GameViewportHorizontalAnchor,
  vertical: GameViewportVerticalAnchor,
): GameViewportBounds {
  return {
    height,
    width,
    x: anchoredOffset(viewport.width, width, horizontal),
    y: anchoredOffset(viewport.height, height, vertical),
  }
}

export function fixedGameStageCssBounds(
  layout: FixedGameViewportLayout,
  stage = layout.nativeStage,
): GameViewportBounds {
  return {
    height: stage.height * layout.displayScale,
    width: stage.width * layout.displayScale,
    x: stage.x * layout.displayScale,
    y: stage.y * layout.displayScale,
  }
}

export function fixedGamePresentationResolution(
  devicePixelRatio: number,
  displayScale: number,
): number {
  return Math.min(
    FIXED_GAME_MAX_PRESENTATION_RESOLUTION,
    positiveFiniteOr(devicePixelRatio, 1) * positiveFiniteOr(displayScale, 1),
  )
}

export function gameViewportLayout(width: number, height: number): GameViewportLayout {
  if (!validSize(width, height)) {
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

function validSize(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
}

function anchoredOffset(
  available: number,
  extent: number,
  anchor: GameViewportHorizontalAnchor | GameViewportVerticalAnchor,
): number {
  if (anchor === 'left' || anchor === 'top') return 0
  if (anchor === 'right' || anchor === 'bottom') return available - extent
  return (available - extent) / 2
}

function positiveFiniteOr(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

import type { Vec2 } from '../editor/model.ts'
import {
  GAME_VIEWPORT_MIN_HEIGHT,
  GAME_VIEWPORT_MIN_WIDTH,
  type GameViewportLayout,
} from './renderer/game-viewport.ts'

export const SOLOMON_DIG_HOTKEY_CODE = 'KeyH'

const HUD_SAFE_LEFT = 64
const HUD_SAFE_TOP = 88
const HUD_SAFE_RIGHT_INSET = 64
const HUD_SAFE_BOTTOM_INSET = 120
const TARGET_STANDOFF = 36

export interface BoneyardDigIndicatorLayout {
  placement: 'edge' | 'target'
  rotationDeg: number
  x: number
  y: number
}

export function boneyardDigIndicatorLayout(
  playerScreen: Vec2,
  digScreen: Vec2,
  viewport: Pick<GameViewportLayout, 'height' | 'width'> = {
    height: GAME_VIEWPORT_MIN_HEIGHT,
    width: GAME_VIEWPORT_MIN_WIDTH,
  },
): BoneyardDigIndicatorLayout {
  const deltaX = digScreen.x - playerScreen.x
  const deltaY = digScreen.y - playerScreen.y
  const distance = Math.hypot(deltaX, deltaY)
  const directionX = distance === 0 ? 1 : deltaX / distance
  const directionY = distance === 0 ? 0 : deltaY / distance
  const rotationDeg = Math.atan2(directionY, directionX) * 180 / Math.PI

  const safeRight = viewport.width - HUD_SAFE_RIGHT_INSET
  const safeBottom = viewport.height - HUD_SAFE_BOTTOM_INSET
  if (insideHudSafeArea(digScreen, safeRight, safeBottom)) {
    return {
      placement: 'target',
      rotationDeg,
      x: digScreen.x - directionX * TARGET_STANDOFF,
      y: digScreen.y - directionY * TARGET_STANDOFF,
    }
  }

  const center = { x: viewport.width / 2, y: viewport.height / 2 }
  const horizontalDistance = directionX > 0
    ? (safeRight - center.x) / directionX
    : directionX < 0
      ? (HUD_SAFE_LEFT - center.x) / directionX
      : Number.POSITIVE_INFINITY
  const verticalDistance = directionY > 0
    ? (safeBottom - center.y) / directionY
    : directionY < 0
      ? (HUD_SAFE_TOP - center.y) / directionY
      : Number.POSITIVE_INFINITY
  const edgeDistance = Math.min(horizontalDistance, verticalDistance)

  return {
    placement: 'edge',
    rotationDeg,
    x: center.x + directionX * edgeDistance,
    y: center.y + directionY * edgeDistance,
  }
}

export function boneyardTutorialDigIndicatorLayout(
  playerScreen: Vec2,
  digScreen: Vec2,
  viewport?: Pick<GameViewportLayout, 'height' | 'width'>,
): BoneyardDigIndicatorLayout {
  const layout = boneyardDigIndicatorLayout(playerScreen, digScreen, viewport)
  return layout.placement === 'edge' && layout.y < 230
    ? { ...layout, y: 230 }
    : layout
}

function insideHudSafeArea(point: Vec2, right: number, bottom: number): boolean {
  return point.x >= HUD_SAFE_LEFT
    && point.x <= right
    && point.y >= HUD_SAFE_TOP
    && point.y <= bottom
}

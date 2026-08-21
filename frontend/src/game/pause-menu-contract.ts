import type { GameplayPauseState } from './protocol/game-protocol.ts'

export type NativePauseAction = 'leave' | 'resume' | 'settings'
export type NativePausePhase = 'closing' | 'opening'

export interface NativePauseBounds {
  readonly height: number
  readonly left: number
  readonly top: number
  readonly width: number
}

export interface NativePauseMenuRowPlan {
  readonly action: NativePauseAction
  readonly bodyRecord: 101 | 102
  readonly bounds: NativePauseBounds
  readonly label: string
  readonly labelX: number
  readonly labelY: number
}

export interface NativePauseMenuRenderPlan {
  readonly alpha: number
  readonly arrows: readonly Readonly<{ scale: number; x: number; y: number }>[]
  readonly chrome: Readonly<NativePauseBounds & { bottom: number; right: number }>
  readonly dimAlpha: number
  readonly header: Readonly<{ rotation: number; x: number; y: number }>
  readonly rows: readonly NativePauseMenuRowPlan[]
}

export const NATIVE_PAUSE_REVEAL_MS = 29 * 10
export const NATIVE_PAUSE_CLOSE_MS = 20 * 10
export const NATIVE_PAUSE_DIM_ALPHA = 0.85
export const NATIVE_PAUSE_EDGE_UV_START = 0.95
export const NATIVE_PAUSE_TEXT_TINT = 0xd9ba70
export const NATIVE_PAUSE_PRESSED_ROW_FRAME = Object.freeze([620, 482, 353, 69] as const)
export const NATIVE_PAUSE_ROW_END_FRAME = Object.freeze([679, 394, 70, 85] as const)

const NATIVE_PAUSE_REVEAL_STEP = 0.03500000014901161
const NATIVE_PAUSE_CLOSE_STEP = 0.05000000074505806
const NATIVE_PAUSE_TICK_MS = 10
const NATIVE_PAUSE_CHROME_PADDING = 40
const NATIVE_PAUSE_CHROME_MOTION = 25
const NATIVE_PAUSE_LABEL_Y_OFFSET = 9
const NATIVE_PAUSE_PRESSED_OFFSET = 6

export const NATIVE_PAUSE_ART_RECORDS = Object.freeze({
  arrow: 8,
  frame: 17,
  header: 18,
  idleRow: 101,
  pressedRow: 102,
  rowEnd: 54,
} as const)

export const NATIVE_PAUSE_ART_COUNTS = Object.freeze({
  8: 3,
  17: 4,
  18: 1,
  54: 6,
  101: 3,
} as const)

export const NATIVE_PAUSE_FONT = Object.freeze({
  firstRecord: 216,
  glyphCount: 92,
  group: 'menu',
  kerningCount: 210,
  lastRecord: 307,
  metrics: Object.freeze([24, 6, 28] as const),
  spaceAdvance: 6,
})

export const PAUSE_MENU_ACTION_BOUNDS = Object.freeze({
  resume: Object.freeze({ height: 69, left: 623.5, top: 339.5, width: 353 }),
  settings: Object.freeze({ height: 69, left: 623.5, top: 415.5, width: 353 }),
  leave: Object.freeze({ height: 69, left: 623.5, top: 491.5, width: 353 }),
})

const NATIVE_PAUSE_ACTIONS = Object.freeze([
  Object.freeze({ action: 'resume', label: 'RESUME GAME' }),
  Object.freeze({ action: 'settings', label: 'GAME SETTINGS' }),
  Object.freeze({ action: 'leave', label: 'LEAVE GAME' }),
] as const)

const NATIVE_PAUSE_CONTROL_UNION = Object.freeze({
  height: 221,
  left: 623.5,
  top: 339.5,
  width: 353,
})

export function nativePauseMenuReveal(phase: NativePausePhase, elapsedMs: number): number {
  const ticks = Math.max(0, Math.floor(elapsedMs / NATIVE_PAUSE_TICK_MS))
  if (phase === 'opening') {
    let reveal = 0
    for (let tick = 0; tick < Math.min(ticks, 29); tick += 1) {
      reveal = Math.fround(reveal + NATIVE_PAUSE_REVEAL_STEP)
      if (reveal > 1) return 1
    }
    return reveal
  }

  let reveal = 1
  for (let tick = 0; tick < Math.min(ticks, 20); tick += 1) {
    reveal = Math.fround(reveal - NATIVE_PAUSE_CLOSE_STEP)
    if (reveal < 0) return 0
  }
  return reveal
}

export function nativePauseMenuRenderPlan(
  reveal: number,
  pressedAction: NativePauseAction | null,
): NativePauseMenuRenderPlan {
  const alpha = Math.min(1, Math.max(0, reveal))
  const spread = Math.fround(
    (1 - alpha) * NATIVE_PAUSE_CHROME_MOTION + NATIVE_PAUSE_CHROME_PADDING,
  )
  const left = NATIVE_PAUSE_CONTROL_UNION.left - spread
  const top = NATIVE_PAUSE_CONTROL_UNION.top - spread
  const width = NATIVE_PAUSE_CONTROL_UNION.width + spread * 2
  const height = NATIVE_PAUSE_CONTROL_UNION.height + spread * 2
  const right = left + width
  const bottom = top + height

  return {
    alpha,
    arrows: [
      { scale: 1, x: 800, y: bottom + 55 },
      { scale: 0.75, x: 725, y: bottom + 42 },
      { scale: 0.75, x: 875, y: bottom + 42 },
    ],
    chrome: { bottom, height, left, right, top, width },
    dimAlpha: Math.fround(alpha * NATIVE_PAUSE_DIM_ALPHA),
    header: { rotation: Math.PI / 2, x: 800, y: top - 42 },
    rows: NATIVE_PAUSE_ACTIONS.map(({ action, label }) => {
      const bounds = PAUSE_MENU_ACTION_BOUNDS[action]
      const pressedOffset = action === pressedAction ? NATIVE_PAUSE_PRESSED_OFFSET : 0
      return {
        action,
        bodyRecord: action === pressedAction ? 102 : 101,
        bounds,
        label,
        labelX: bounds.left + bounds.width / 2 + pressedOffset,
        labelY: bounds.top + bounds.height / 2 + NATIVE_PAUSE_LABEL_Y_OFFSET + pressedOffset,
      }
    }),
  }
}

export type GameplayPausePresentation =
  | { kind: 'owner'; label: 'Game paused' }
  | { detail: string; kind: 'waiting'; label: string }

export function gameplayPausePresentation(
  pause: GameplayPauseState,
  playerId: string,
): GameplayPausePresentation {
  if (pause.ownerPlayerId === playerId) return { kind: 'owner', label: 'Game paused' }
  const activity = pause.source === 'inventory'
    ? 'Inventory'
    : pause.source === 'skill-book'
      ? 'the Skill Book'
      : null
  return {
    detail: activity
      ? `Waiting for ${pause.ownerDisplayName} to close ${activity}.`
      : `Waiting for ${pause.ownerDisplayName} to resume.`,
    kind: 'waiting',
    label: activity
      ? `${pause.ownerDisplayName} is using ${activity}.`
      : `${pause.ownerDisplayName} has paused the game.`,
  }
}

import type { GameplayPauseState } from './protocol/game-protocol.ts'

export const NATIVE_PAUSE_REVEAL_MS = 29 * 10
export const NATIVE_PAUSE_CLOSE_MS = 20 * 10
export const NATIVE_PAUSE_DIM_ALPHA = 0.85

export const PAUSE_MENU_ACTION_BOUNDS = Object.freeze({
  resume: Object.freeze({ height: 69, left: 623.5, top: 339.5, width: 353 }),
  settings: Object.freeze({ height: 69, left: 623.5, top: 415.5, width: 353 }),
  leave: Object.freeze({ height: 69, left: 623.5, top: 491.5, width: 353 }),
})

export interface NativePauseArtMember {
  flipX?: boolean
  flipY?: boolean
  left: number
  record: 8 | 17 | 18 | 54 | 101
  rotate?: -90
  scale?: number
  top: number
}

export const NATIVE_PAUSE_ATLAS_FRAMES = Object.freeze({
  8: [824, 587, 49, 112],
  17: [743, 588, 80, 83],
  18: [543, 205, 67, 262],
  54: [679, 394, 70, 85],
  101: [266, 482, 353, 69],
} as const)

export const NATIVE_PAUSE_ART_MEMBERS: readonly NativePauseArtMember[] = Object.freeze([
  { left: 623.5, record: 101, top: 339.5 },
  { left: 617.5, record: 54, top: 333.5 },
  { flipX: true, left: 982.5, record: 54, top: 333.5 },
  { left: 623.5, record: 101, top: 415.5 },
  { left: 617.5, record: 54, top: 409.5 },
  { flipX: true, left: 982.5, record: 54, top: 409.5 },
  { left: 623.5, record: 101, top: 491.5 },
  { left: 617.5, record: 54, top: 485.5 },
  { flipX: true, left: 982.5, record: 54, top: 485.5 },
  { left: 583.5, record: 17, top: 299.5 },
  { flipX: true, left: 1016.5, record: 17, top: 299.5 },
  { flipY: true, left: 583.5, record: 17, top: 600.5 },
  { flipX: true, flipY: true, left: 1016.5, record: 17, top: 600.5 },
  { left: 669, record: 18, rotate: -90, top: 300.5 },
  { left: 775.5, record: 8, top: 599.5 },
  { left: 706.625, record: 8, scale: 0.75, top: 600.5 },
  { left: 856.625, record: 8, scale: 0.75, top: 600.5 },
])

export type GameplayPausePresentation =
  | { kind: 'owner'; label: 'Game paused' }
  | { detail: string; kind: 'waiting'; label: string }

export function gameplayPausePresentation(
  pause: GameplayPauseState,
  playerId: string,
): GameplayPausePresentation {
  if (pause.ownerPlayerId === playerId) return { kind: 'owner', label: 'Game paused' }
  return {
    detail: `Waiting for ${pause.ownerDisplayName} to resume.`,
    kind: 'waiting',
    label: `${pause.ownerDisplayName} has paused the game.`,
  }
}

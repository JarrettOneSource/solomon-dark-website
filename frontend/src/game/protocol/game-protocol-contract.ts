import { MAX_WEB_GAME_SAVE_BYTES } from '../save/game-save-contract.ts'

export const GAME_PROTOCOL_VERSION = 124

export const GAME_WEBSOCKET_MAX_PAYLOAD_BYTES = MAX_WEB_GAME_SAVE_BYTES * 2 + 64 * 1024

export const GAME_PROTOCOL_NAME = `solomon-dark/${GAME_PROTOCOL_VERSION}`

export const GAME_CONNECTION_TIMEOUT_CLOSE_CODE = 4000

export const GAME_HOST_ENDED_SESSION_CLOSE_CODE = 4001

export const GAME_SESSION_REPLACED_CLOSE_CODE = 4002

export const EMPTY_CONTENT_MANIFEST_SHA256 = '0'.repeat(64)

export interface GameContentIdentity {
  id: string
  version: string
  contentSha256: string
}

export interface GameContentManifest {
  manifestSha256: string
  mods: readonly GameContentIdentity[]
}

export interface PlayerCharacterKernelParameters {
  fixedTickSeconds: number
  movementAcceleration: number
  movementLaneCap: number
  movementRetention: number
  movementThresholdSquared: number
  playerRadius: number
}

export type GameplayPauseSource = 'inventory' | 'pause-menu' | 'skill-book' | 'skill-selector'

export interface GameplayPauseState {
  ownerDisplayName: string
  ownerPlayerId: string
  source: GameplayPauseSource
}

export const GAMEPLAY_RESUME_GRACE_DURATION_MS = 2_000

export const GAMEPLAY_RESUME_GRACE_REASONS = [
  'game-rejoined',
  'game-restarted',
  'game-started',
  'inventory-closed',
  'pause-menu-closed',
  'skill-book-closed',
  'skill-picker-closed',
  'party-rejoin-wait',
] as const

export type GameplayResumeGraceReason = typeof GAMEPLAY_RESUME_GRACE_REASONS[number]

export interface GameplayResumeGraceState {
  readonly reason: GameplayResumeGraceReason
  readonly remainingMs: number | null
  readonly sequence: number
}

export type GameSessionKind = 'global-hub' | 'private-college' | 'standalone'

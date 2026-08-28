import {
  GAMEPLAY_RESUME_GRACE_DURATION_MS,
  type GameplayPauseSource,
  type GameplayResumeGraceReason,
  type GameplayResumeGraceState,
} from './protocol/game-protocol.ts'

const PAUSE_SOURCE_GRACE_REASON = {
  inventory: 'inventory-closed',
  'pause-menu': 'pause-menu-closed',
  'skill-book': 'skill-book-closed',
  'skill-selector': 'skill-selector-closed',
} as const satisfies Readonly<Record<GameplayPauseSource, GameplayResumeGraceReason>>

export function gameplayResumeGraceReasonForPauseSource(
  source: GameplayPauseSource,
): GameplayResumeGraceReason {
  return PAUSE_SOURCE_GRACE_REASON[source]
}

export function gameplayResumeGraceProgress(
  grace: GameplayResumeGraceState,
  elapsedMs: number,
): number | null {
  if (grace.remainingMs === null) return null
  const remainingMs = Math.max(0, grace.remainingMs - Math.max(0, elapsedMs))
  return Math.min(1, Math.max(
    0,
    1 - remainingMs / GAMEPLAY_RESUME_GRACE_DURATION_MS,
  ))
}

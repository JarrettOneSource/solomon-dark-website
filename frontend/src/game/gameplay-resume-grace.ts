import type {
  GameplayPauseSource,
  GameplayResumeGraceReason,
  GameplayResumeGraceState,
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

export function gameplayResumeGraceSeconds(
  grace: GameplayResumeGraceState,
  elapsedMs: number,
): number | null {
  if (grace.remainingMs === null) return null
  const remainingMs = grace.remainingMs - Math.max(0, elapsedMs)
  return Math.max(1, Math.ceil(remainingMs / 1_000))
}

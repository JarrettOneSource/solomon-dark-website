import type { GameSnapshot } from './protocol/game-state.ts'

export const HUB_SOCIAL_SOUND_REQUESTS = Object.freeze({
  chat: Object.freeze({ cue: 'click' as const, playbackRate: 1.1, volume: 0.65 }),
  join: Object.freeze({ cue: 'click' as const, playbackRate: 1.25, volume: 0.65 }),
  leave: Object.freeze({ cue: 'click' as const, playbackRate: 0.85, volume: 0.65 }),
})

export interface HubMembershipAudioCursor {
  /** Null while this client is outside the Hub; an empty array is a valid Hub baseline. */
  readonly participantIds: readonly string[] | null
}

export interface HubMembershipAudioDelta {
  readonly cursor: HubMembershipAudioCursor
  readonly joinedPlayerIds: readonly string[]
  readonly leftPlayerIds: readonly string[]
}

export function createHubMembershipAudioCursor(
  snapshot: GameSnapshot,
  localPlayerId: string,
): HubMembershipAudioCursor {
  return Object.freeze({
    participantIds: snapshot.world.kind === 'hub'
      ? hubPeerIds(snapshot, localPlayerId)
      : null,
  })
}

export function advanceHubMembershipAudioCursor(
  cursor: HubMembershipAudioCursor,
  snapshot: GameSnapshot,
  localPlayerId: string,
): HubMembershipAudioDelta {
  if (snapshot.world.kind !== 'hub') {
    return Object.freeze({
      cursor: Object.freeze({ participantIds: null }),
      joinedPlayerIds: Object.freeze([]),
      leftPlayerIds: Object.freeze([]),
    })
  }
  const participantIds = hubPeerIds(snapshot, localPlayerId)
  if (cursor.participantIds === null) {
    return Object.freeze({
      cursor: Object.freeze({ participantIds }),
      joinedPlayerIds: Object.freeze([]),
      leftPlayerIds: Object.freeze([]),
    })
  }
  const previous = new Set(cursor.participantIds)
  const current = new Set(participantIds)
  return Object.freeze({
    cursor: Object.freeze({ participantIds }),
    joinedPlayerIds: Object.freeze(participantIds.filter(playerId => !previous.has(playerId))),
    leftPlayerIds: Object.freeze(cursor.participantIds.filter(playerId => !current.has(playerId))),
  })
}

function hubPeerIds(snapshot: GameSnapshot, localPlayerId: string): readonly string[] {
  if (snapshot.world.kind !== 'hub') return Object.freeze([])
  return Object.freeze(Object.keys(snapshot.world.participants)
    .filter(playerId => playerId !== localPlayerId)
    .sort())
}

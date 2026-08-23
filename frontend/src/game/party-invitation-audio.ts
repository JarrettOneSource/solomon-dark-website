export const PARTY_INVITATION_SOUND_REQUEST = Object.freeze({
  cue: 'click',
  playbackRate: 1,
  volume: 1,
})

const PARTY_INVITATION_AUDIO_HISTORY_LIMIT = 128

export interface PartyInvitationAudioCursor {
  readonly seenInvitationIds: readonly string[]
}

export interface PartyInvitationAudioDelta {
  readonly cursor: PartyInvitationAudioCursor
  readonly newInvitationCount: number
}

export function createPartyInvitationAudioCursor(
  invitationIds: readonly string[],
): PartyInvitationAudioCursor {
  return Object.freeze({
    seenInvitationIds: Object.freeze(unique(invitationIds).slice(
      -PARTY_INVITATION_AUDIO_HISTORY_LIMIT,
    )),
  })
}

export function advancePartyInvitationAudioCursor(
  cursor: PartyInvitationAudioCursor,
  invitationIds: readonly string[],
): PartyInvitationAudioDelta {
  const seen = new Set(cursor.seenInvitationIds)
  let newInvitationCount = 0
  for (const invitationId of invitationIds) {
    if (seen.has(invitationId)) continue
    seen.add(invitationId)
    newInvitationCount += 1
  }
  return Object.freeze({
    cursor: createPartyInvitationAudioCursor([...seen]),
    newInvitationCount,
  })
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

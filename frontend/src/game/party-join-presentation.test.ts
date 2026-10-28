import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PARTY_INVITATION_SOUND_REQUEST,
  advancePartyInvitationAudioCursor,
  createPartyInvitationAudioCursor,
} from './party-invitation-audio.ts'

test('incoming invitation audio is edge-triggered from a session baseline without snapshot replay', () => {
  assert.deepEqual(PARTY_INVITATION_SOUND_REQUEST, {
    cue: 'click',
    playbackRate: 1,
    volume: 1,
  })

  let cursor = createPartyInvitationAudioCursor(['invite-1'])
  let delta = advancePartyInvitationAudioCursor(cursor, ['invite-1'])
  assert.equal(delta.newInvitationCount, 0)
  cursor = delta.cursor

  delta = advancePartyInvitationAudioCursor(cursor, ['invite-1', 'invite-2', 'invite-3'])
  assert.equal(delta.newInvitationCount, 2)
  cursor = delta.cursor

  delta = advancePartyInvitationAudioCursor(cursor, [])
  assert.equal(delta.newInvitationCount, 0)
  cursor = delta.cursor
  delta = advancePartyInvitationAudioCursor(cursor, ['invite-2'])
  assert.equal(delta.newInvitationCount, 0, 'an id already seen in this session does not re-arm')

  const reconnect = createPartyInvitationAudioCursor(['invite-4'])
  assert.equal(
    advancePartyInvitationAudioCursor(reconnect, ['invite-4']).newInvitationCount,
    0,
    'pending reconnect history seeds a new baseline',
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  GameCollegeInvitation,
  GameOnlinePreferences,
  GamePlayerCardProfile,
} from '../protocol/game-chat.ts'
import {
  GAME_SOCIAL_INVITATION_TIMEOUT_MS,
  startGameSocialBroker,
  type GameSocialChatDelivery,
  type GameSocialParticipant,
} from './game-social-broker.ts'

const ENABLED: GameOnlinePreferences = {
  activityMessages: true,
  globalChat: true,
  submitRuns: true,
}
const REFERENCE_A = `player-ref-${'a'.repeat(32)}`
const REFERENCE_B = `player-ref-${'b'.repeat(32)}`
const REFERENCE_C = `player-ref-${'c'.repeat(32)}`

test('broker routes Global, activity, Whisper, and current Player Cards across hosts', () => {
  const broker = startGameSocialBroker()
  const first = participant('host-a', 'player-1', REFERENCE_A, 'Aurelia')
  const second = participant('host-b', 'player-1', REFERENCE_B, 'Basil')
  const third = participant('host-a', 'player-2', REFERENCE_C, 'Cassia')
  const firstConnection = broker.register(first.endpoint, ENABLED, REFERENCE_A)
  const secondConnection = broker.register(second.endpoint, ENABLED, REFERENCE_B)
  const thirdConnection = broker.register(third.endpoint, ENABLED, REFERENCE_C)

  assert.equal(firstConnection.publishGlobal('Too early'), false)
  firstConnection.activate()
  secondConnection.activate()
  thirdConnection.activate()
  assert.equal(firstConnection.publishGlobal('Across every College'), true)
  assert.deepEqual(first.chat.map(({ sender }) => sender), [{
    displayName: 'Aurelia',
    playerId: 'player-1',
    playerReference: REFERENCE_A,
  }])
  assert.deepEqual(second.chat.map(({ sender }) => sender), [{
    displayName: 'Aurelia',
    playerId: REFERENCE_A,
    playerReference: REFERENCE_A,
  }])
  assert.equal(third.chat[0]?.sender.playerId, 'player-1')

  firstConnection.publishActivity('searching-solomon')
  assert.equal(first.chat.length, 1)
  assert.equal(second.chat[1]?.activity, 'searching-solomon')
  assert.equal(second.chat[1]?.text, 'Aurelia is searching for Solomon.')
  assert.equal(third.chat[1]?.activity, 'searching-solomon')

  assert.equal(firstConnection.publishWhisper(REFERENCE_B, 'Between hosts'), true)
  const senderCopy = first.chat.at(-1)
  const targetCopy = second.chat.at(-1)
  assert.equal(senderCopy?.channel, 'whisper')
  assert.equal(senderCopy?.recipient?.playerId, REFERENCE_B)
  assert.equal(targetCopy?.sender.playerId, REFERENCE_A)
  assert.equal(targetCopy?.recipient?.playerId, 'player-1')
  assert.equal(third.chat.length, 2)

  second.profile = { ...second.profile, gold: 777 }
  assert.equal(firstConnection.resolvePlayerCard(REFERENCE_B)?.gold, 777)
  assert.equal(firstConnection.resolvePlayerCard('player-ref-' + 'z'.repeat(32)), null)

  secondConnection.setOnlinePreferences({
    activityMessages: false,
    globalChat: false,
    submitRuns: true,
  })
  assert.equal(firstConnection.publishWhisper(REFERENCE_B, 'Hidden'), false)
  assert.equal(firstConnection.resolvePlayerCard(REFERENCE_B), null)
  firstConnection.publishGlobal('Not delivered to disabled target')
  assert.equal(second.chat.at(-1), targetCopy)

  firstConnection.close()
  secondConnection.close()
  thirdConnection.close()
  broker.close()
})

test('broker bounds targeted College invitations and closes every lifecycle edge', () => {
  const broker = startGameSocialBroker()
  const source = participant('private-a', 'player-1', REFERENCE_A, 'Aurelia')
  const target = participant('private-b', 'player-1', REFERENCE_B, 'Basil')
  const sourceConnection = broker.register(source.endpoint, ENABLED, REFERENCE_A)
  const targetConnection = broker.register(target.endpoint, ENABLED, REFERENCE_B)
  sourceConnection.activate()
  targetConnection.activate()

  assert.equal(
    sourceConnection.inviteToCollege(REFERENCE_A, 'party-a', 'ABCD-EFGH'),
    'self-invite',
  )
  target.canReceiveInvitation = false
  assert.equal(
    sourceConnection.inviteToCollege(REFERENCE_B, 'party-a', 'ABCD-EFGH'),
    'not-in-hub',
  )
  target.canReceiveInvitation = true
  assert.equal(
    sourceConnection.inviteToCollege(REFERENCE_B, 'party-a', 'ABCD-EFGH'),
    null,
  )
  const invitation = target.invitations.at(-1)?.[0]
  assert.ok(invitation)
  assert.equal(invitation.joinCode, 'ABCD-EFGH')
  assert.equal(invitation.inviter.playerReference, REFERENCE_A)
  assert.equal(
    sourceConnection.inviteToCollege(REFERENCE_B, 'party-a', 'ABCD-EFGH'),
    'already-invited',
  )

  target.canReceiveInvitation = false
  targetConnection.refreshCollegeInvitationAvailability()
  assert.deepEqual(target.invitations.at(-1), [])
  target.canReceiveInvitation = true

  assert.equal(
    sourceConnection.inviteToCollege(REFERENCE_B, 'party-a', 'ABCD-EFGH'),
    null,
  )
  targetConnection.dismissCollegeInvitation(target.invitations.at(-1)![0]!.id)
  assert.deepEqual(target.invitations.at(-1), [])
  assert.equal(
    sourceConnection.inviteToCollege(REFERENCE_B, 'party-a', 'ABCD-EFGH'),
    null,
  )
  sourceConnection.revokeCollegeInvitations('party-a')
  assert.deepEqual(target.invitations.at(-1), [])

  assert.equal(
    sourceConnection.inviteToCollege(REFERENCE_B, 'party-a', 'ABCD-EFGH'),
    null,
  )
  broker.prune(Date.now() + GAME_SOCIAL_INVITATION_TIMEOUT_MS + 1)
  assert.deepEqual(target.invitations.at(-1), [])

  assert.equal(
    sourceConnection.inviteToCollege(REFERENCE_B, 'party-a', 'ABCD-EFGH'),
    null,
  )
  for (let index = 1; index < 8; index += 1) {
    assert.equal(
      sourceConnection.inviteToCollege(
        REFERENCE_B,
        `party-${index}`,
        'ABCD-EFGH',
      ),
      null,
    )
  }
  assert.equal(target.invitations.at(-1)?.length, 8)
  assert.equal(
    sourceConnection.inviteToCollege(REFERENCE_B, 'party-overflow', 'JKLM-NPQR'),
    'already-invited',
  )
  targetConnection.setOnlinePreferences({
    activityMessages: false,
    globalChat: false,
    submitRuns: true,
  })
  assert.deepEqual(target.invitations.at(-1), [])
  assert.equal(
    sourceConnection.inviteToCollege(REFERENCE_B, 'party-a', 'ABCD-EFGH'),
    'player-missing',
  )

  targetConnection.setOnlinePreferences(ENABLED)
  assert.equal(
    sourceConnection.inviteToCollege(REFERENCE_B, 'party-a', 'ABCD-EFGH'),
    null,
  )
  const replacement = participant('private-b', 'player-1', REFERENCE_B, 'Basil II')
  const replacementConnection = broker.register(replacement.endpoint, ENABLED, REFERENCE_B)
  replacementConnection.activate()
  targetConnection.close()
  assert.equal(sourceConnection.resolvePlayerCard(REFERENCE_B)?.displayName, 'Basil II')

  replacementConnection.close()
  assert.equal(sourceConnection.resolvePlayerCard(REFERENCE_B), null)
  assert.equal(
    sourceConnection.inviteToCollege(REFERENCE_B, 'party-a', 'ABCD-EFGH'),
    'player-missing',
  )
  sourceConnection.close()
  broker.close()
})

function participant(
  hostId: string,
  localPlayerId: string,
  playerReference: string,
  displayName: string,
): {
  canReceiveInvitation: boolean
  chat: GameSocialChatDelivery[]
  endpoint: GameSocialParticipant
  invitations: (readonly GameCollegeInvitation[])[]
  profile: GamePlayerCardProfile
} {
  const state: {
    canReceiveInvitation: boolean
    chat: GameSocialChatDelivery[]
    endpoint: GameSocialParticipant
    invitations: (readonly GameCollegeInvitation[])[]
    profile: GamePlayerCardProfile
  } = {
    canReceiveInvitation: true,
    chat: [],
    endpoint: null as unknown as GameSocialParticipant,
    invitations: [],
    profile: {
      accountUsername: displayName.toLowerCase(),
      activity: 'hub' as const,
      discipline: 'arcane' as const,
      displayName,
      element: 'ether' as const,
      gold: 100,
      highestWave: 10,
      playerReference,
      sessionKind: hostId.startsWith('private')
        ? 'private-college' as const
        : 'global-hub' as const,
      totalPlaytimeMs: 60_000,
    },
  }
  state.endpoint = {
    hostId,
    localPlayerId,
    canReceiveCollegeInvitation: () => state.canReceiveInvitation,
    deliverChat: message => state.chat.push(message),
    deliverCollegeInvitations: invitations => state.invitations.push(invitations),
    profile: () => ({ ...state.profile }),
  }
  return state
}

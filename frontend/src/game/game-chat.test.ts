import assert from 'node:assert/strict'
import test from 'node:test'

import type { LocalPartyState } from './protocol/party-state.ts'
import {
  GAME_CHAT_HISTORY_LIMIT,
  GAME_CHAT_INACTIVITY_HOLD_MS,
  appendGameChatMessage,
  availableGameChatChannels,
  defaultGameChatChannel,
  gameChatRejectionText,
  isGameChatFaded,
  nextGameChatChannel,
  reconcileGameChatChannel,
  shouldIncrementGameChatUnread,
} from './game-chat.ts'
import { nativeInventoryGoldLedgerRight } from './native-inventory-gold-layout.ts'

const singleton = partyState(['player-1'])
const grouped = partyState(['player-1', 'player-2'])
const playerReference = (suffix: string) => `player-ref-${suffix.padEnd(32, 'x').slice(0, 32)}`

test('chat channels follow host-wide Global, Hub Party, and exact Boneyard scope', () => {
  assert.deepEqual(availableGameChatChannels('hub', singleton, 'global-hub'), ['global'])
  assert.equal(defaultGameChatChannel('hub', singleton, 'global-hub'), 'global')
  assert.deepEqual(
    availableGameChatChannels('hub', grouped, 'global-hub'),
    ['party', 'global'],
  )
  assert.equal(defaultGameChatChannel('hub', grouped, 'global-hub'), 'party')
  assert.deepEqual(
    availableGameChatChannels('boneyard', grouped, 'global-hub'),
    ['boneyard', 'global'],
  )
  assert.equal(defaultGameChatChannel('boneyard', grouped, 'global-hub'), 'boneyard')
  assert.deepEqual(
    availableGameChatChannels('boneyard', grouped, 'private-college'),
    ['boneyard', 'global'],
  )
  assert.deepEqual(
    availableGameChatChannels('hub', singleton, 'private-college'),
    ['global'],
  )
  assert.deepEqual(
    availableGameChatChannels('hub', grouped, 'private-college'),
    ['party', 'global'],
  )
  assert.deepEqual(availableGameChatChannels('hub', null, 'standalone'), ['party'])
})

test('whisper channel appears exactly while a whisper thread is open', () => {
  assert.deepEqual(
    availableGameChatChannels('hub', singleton, 'global-hub', true),
    ['global', 'whisper'],
  )
  assert.deepEqual(
    availableGameChatChannels('hub', grouped, 'global-hub', true),
    ['party', 'global', 'whisper'],
  )
  assert.deepEqual(
    availableGameChatChannels('boneyard', grouped, 'global-hub', true),
    ['boneyard', 'global', 'whisper'],
  )
  assert.deepEqual(
    availableGameChatChannels('hub', grouped, 'global-hub', false),
    ['party', 'global'],
  )
  const channels = availableGameChatChannels('hub', grouped, 'global-hub', true)
  assert.equal(nextGameChatChannel('global', channels), 'whisper')
  assert.equal(nextGameChatChannel('whisper', channels), 'party')
  assert.equal(reconcileGameChatChannel('whisper', ['party', 'global']), 'party')
})

test('Tab cycling and channel reconciliation stay inside current membership', () => {
  const channels = availableGameChatChannels('hub', grouped, 'global-hub')
  assert.equal(nextGameChatChannel('party', channels), 'global')
  assert.equal(nextGameChatChannel('global', channels), 'party')
  assert.equal(nextGameChatChannel('global', ['global']), 'global')
  assert.equal(nextGameChatChannel('party', ['party']), 'party')
  assert.equal(reconcileGameChatChannel('global', ['party']), 'party')
  assert.equal(reconcileGameChatChannel('party', channels), 'party')
})

test('chat history is ordered, duplicate-safe, and bounded', () => {
  let messages = [] as ReturnType<typeof appendGameChatMessage>
  for (let sequence = 1; sequence <= GAME_CHAT_HISTORY_LIMIT + 2; sequence += 1) {
    messages = appendGameChatMessage(messages, {
      channel: 'party',
      sender: {
        displayName: 'Helvidius',
        playerId: 'player-1',
        playerReference: playerReference('one'),
      },
      sequence,
      text: `Message ${sequence}`,
    })
  }
  assert.equal(messages.length, GAME_CHAT_HISTORY_LIMIT)
  assert.equal(messages[0]!.sequence, 3)
  assert.equal(messages.at(-1)?.sequence, GAME_CHAT_HISTORY_LIMIT + 2)
  assert.equal(appendGameChatMessage(messages, messages.at(-1)!), messages)
})

test('host-authored activity shares Global history without becoming player speech', () => {
  const activity = {
    activity: 'entered-college',
    channel: 'global',
    sender: {
      displayName: 'Aurelia',
      playerId: 'player-2',
      playerReference: playerReference('two'),
    },
    sequence: 1,
    text: 'Aurelia has entered the college.',
  } as const
  assert.deepEqual(appendGameChatMessage([], activity), [activity])
  assert.equal(shouldIncrementGameChatUnread(activity, 'player-1', false, 'boneyard'), true)
})

test('closed chat fades at the exact inactivity boundary and open chat does not', () => {
  assert.equal(isGameChatFaded(false, 10, 10 + GAME_CHAT_INACTIVITY_HOLD_MS - 1), false)
  assert.equal(isGameChatFaded(false, 10, 10 + GAME_CHAT_INACTIVITY_HOLD_MS), true)
  assert.equal(isGameChatFaded(true, 10, 10 + GAME_CHAT_INACTIVITY_HOLD_MS * 2), false)
})

test('chat rejections provide concise channel and retry feedback', () => {
  assert.equal(gameChatRejectionText({
    channel: 'global',
    reason: 'channel-unavailable',
    retryAfterMs: 0,
  }), 'Global chat is unavailable here.')
  assert.equal(gameChatRejectionText({
    channel: 'party',
    reason: 'rate-limited',
    retryAfterMs: 1_001,
  }), 'Slow down. Try again in 2s.')
  assert.equal(gameChatRejectionText({
    channel: 'whisper',
    reason: 'target-unavailable',
    retryAfterMs: 0,
  }), 'That wizard is no longer connected.')
})

test('closed chat counts only remote messages as unread', () => {
  const own = {
    channel: 'global',
    sender: {
      displayName: 'Helvidius',
      playerId: 'player-1',
      playerReference: playerReference('one'),
    },
    sequence: 1,
    text: 'sent and closed',
  } as const
  const remote = {
    ...own,
    sender: {
      displayName: 'Daria',
      playerId: 'player-2',
      playerReference: playerReference('two'),
    },
    sequence: 2,
  } as const
  assert.equal(shouldIncrementGameChatUnread(own, 'player-1', false, 'global'), false)
  assert.equal(shouldIncrementGameChatUnread(remote, 'player-1', false, 'global'), true)
  assert.equal(shouldIncrementGameChatUnread(remote, 'player-1', true, 'global'), false)
  assert.equal(shouldIncrementGameChatUnread(remote, 'player-1', true, 'party'), true)
})

test('native gold-ledger clearance scales with account balance', () => {
  assert.equal(nativeInventoryGoldLedgerRight(500), 75)
  assert.equal(nativeInventoryGoldLedgerRight(10_000), 96)
  assert.equal(nativeInventoryGoldLedgerRight(Number.MAX_SAFE_INTEGER), 207)
})

function partyState(memberPlayerIds: readonly string[]): LocalPartyState {
  return {
    hubPlayers: memberPlayerIds.map((playerId, index) => ({
      accountUsername: null,
      displayName: `Player ${index + 1}`,
      highestWave: null,
      playerId,
      totalPlaytimeMs: null,
    })),
    invitations: [],
    joinRequests: [],
    party: {
      id: 'party-1',
      joinCode: 'TEST-2345',
      leaderPlayerId: memberPlayerIds[0]!,
      listingId: 'listing-1',
      memberPlayerIds,
      visibility: 'private',
    },
    partyRoster: memberPlayerIds.map((playerId, index) => ({
      connected: true,
      currentHealth: 50,
      displayName: `Player ${index + 1}`,
      element: 'ether',
      lifeState: 'alive',
      maximumHealth: 50,
      playerId,
    })),
    revision: 1,
  }
}

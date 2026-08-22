import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
} from './game-chat.ts'

const singleton = partyState(['player-1'])
const grouped = partyState(['player-1', 'player-2'])
const component = readFileSync(new URL('./GameChat.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./game-chat.css', import.meta.url), 'utf8')
const mainMenu = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
const hubScene = readFileSync(new URL('./HubScene.tsx', import.meta.url), 'utf8')
const boneyardScene = readFileSync(new URL('./BoneyardScene.tsx', import.meta.url), 'utf8')

test('chat channels follow public Hub party membership and Boneyard scope', () => {
  assert.deepEqual(availableGameChatChannels('hub', singleton), ['global'])
  assert.equal(defaultGameChatChannel('hub', singleton), 'global')
  assert.deepEqual(availableGameChatChannels('hub', grouped), ['party', 'global'])
  assert.equal(defaultGameChatChannel('hub', grouped), 'party')
  assert.deepEqual(availableGameChatChannels('boneyard', grouped), ['party'])
  assert.deepEqual(availableGameChatChannels('hub', null), ['party'])
})

test('whisper channel appears exactly while a whisper thread is open', () => {
  assert.deepEqual(
    availableGameChatChannels('hub', singleton, true),
    ['global', 'whisper'],
  )
  assert.deepEqual(
    availableGameChatChannels('hub', grouped, true),
    ['party', 'global', 'whisper'],
  )
  assert.deepEqual(
    availableGameChatChannels('boneyard', grouped, true),
    ['party', 'whisper'],
  )
  assert.deepEqual(availableGameChatChannels('hub', grouped, false), ['party', 'global'])
  const channels = availableGameChatChannels('hub', grouped, true)
  assert.equal(nextGameChatChannel('global', channels), 'whisper')
  assert.equal(nextGameChatChannel('whisper', channels), 'party')
  assert.equal(reconcileGameChatChannel('whisper', ['party', 'global']), 'party')
})

test('Tab cycling and channel reconciliation stay inside current membership', () => {
  const channels = availableGameChatChannels('hub', grouped)
  assert.equal(nextGameChatChannel('party', channels), 'global')
  assert.equal(nextGameChatChannel('global', channels), 'party')
  assert.equal(reconcileGameChatChannel('global', ['party']), 'party')
  assert.equal(reconcileGameChatChannel('party', channels), 'party')
})

test('chat history is ordered, duplicate-safe, and bounded', () => {
  let messages = [] as ReturnType<typeof appendGameChatMessage>
  for (let sequence = 1; sequence <= GAME_CHAT_HISTORY_LIMIT + 2; sequence += 1) {
    messages = appendGameChatMessage(messages, {
      channel: 'party',
      sender: { displayName: 'Helvidius', playerId: 'player-1' },
      sequence,
      text: `Message ${sequence}`,
    })
  }
  assert.equal(messages.length, GAME_CHAT_HISTORY_LIMIT)
  assert.equal(messages[0]!.sequence, 3)
  assert.equal(messages.at(-1)?.sequence, GAME_CHAT_HISTORY_LIMIT + 2)
  assert.equal(appendGameChatMessage(messages, messages.at(-1)!), messages)
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

test('chat UI owns its configured key, real text focus, Tab channels, fade, and local gameplay exclusion', () => {
  assert.match(component, /event\.code !== openKeyCode/)
  assert.match(component, /<input/)
  assert.match(component, /event\.key === 'Tab'/)
  assert.match(component, /aria-live="polite"/)
  assert.match(component, /aria-label="Open chat"/)
  assert.match(css, /data-chat-faded='true'/)
  assert.match(css, /opacity 650ms ease/)
  assert.match(mainMenu, /const sceneInputBlocked = chatOpen/)
  assert.match(mainMenu, /openKeyCode=\{gameSettings\.controls\.openChat\}/)
  assert.match(hubScene, /event\.code !== settings\.controls\.openSkills/)
  assert.match(boneyardScene, /event\.code !== settings\.controls\.openSkills/)
})

test('whisper UX runs from the Player Card into a dedicated chat thread', () => {
  assert.match(component, /data-whisper-target=/)
  assert.match(component, /whisperRequest/)
  assert.match(component, /onWhisperRequestHandled\(\)/)
  assert.match(css, /data-message-channel='whisper'/)
  assert.match(css, /data-channel='whisper'/)
  assert.match(hubScene, /hub-player-profile-message/)
  assert.match(hubScene, /onMessagePlayer\(/)
  assert.match(mainMenu, /whisperRequest=/)
  assert.match(mainMenu, /onWhisperRequestHandled=/)
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
    party: {
      id: 'party-1',
      leaderPlayerId: memberPlayerIds[0]!,
      memberPlayerIds,
    },
    revision: 1,
  }
}

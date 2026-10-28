import assert from 'node:assert/strict'
import test from 'node:test'

import type { GameChatChannel, GameChatMessage } from './protocol/game-chat.ts'
import {
  GAME_WORLD_SPEECH_FADE_MS,
  GAME_WORLD_SPEECH_HOLD_MS,
  GAME_WORLD_SPEECH_SPEAKER_LIMIT,
  appendGameWorldSpeech,
  sampleGameWorldSpeech,
  type GameWorldSpeech,
} from './world-speech-presentation.ts'

function message(
  sequence: number,
  playerId: string,
  channel: GameChatChannel = 'global',
): GameChatMessage {
  return {
    channel,
    sender: {
      displayName: playerId,
      playerId,
      playerReference: `player-ref-${playerId.padEnd(32, 'x').slice(0, 32)}`,
    },
    sequence,
    text: `Message ${sequence}`,
  }
}

test('world speech consumes the authoritative chat event once and replaces only that sender', () => {
  let speeches: readonly GameWorldSpeech[] = []
  speeches = appendGameWorldSpeech(speeches, message(1, 'player-a'), 100)
  speeches = appendGameWorldSpeech(speeches, message(2, 'player-b', 'party'), 200)
  const unchanged = appendGameWorldSpeech(speeches, message(1, 'player-a', 'whisper'), 300)
  assert.equal(unchanged, speeches)

  speeches = appendGameWorldSpeech(speeches, message(3, 'player-a', 'whisper'), 400)
  assert.deepEqual(speeches.map(({ channel, playerId, sequence, startedAtMs }) => ({
    channel,
    playerId,
    sequence,
    startedAtMs,
  })), [
    { channel: 'party', playerId: 'player-b', sequence: 2, startedAtMs: 200 },
    { channel: 'whisper', playerId: 'player-a', sequence: 3, startedAtMs: 400 },
  ])
})

test('world speech holds for three seconds, fades linearly for two, and expires at five', () => {
  const speech = appendGameWorldSpeech([], message(1, 'player-a'), 1_000)[0]!
  assert.equal(GAME_WORLD_SPEECH_HOLD_MS, 3_000)
  assert.equal(GAME_WORLD_SPEECH_FADE_MS, 2_000)
  assert.equal(sampleGameWorldSpeech(speech, 999)?.alpha, 1)
  assert.equal(sampleGameWorldSpeech(speech, 3_999)?.alpha, 1)
  assert.equal(sampleGameWorldSpeech(speech, 4_000)?.alpha, 1)
  assert.equal(sampleGameWorldSpeech(speech, 5_000)?.alpha, 0.5)
  assert.ok(Math.abs((sampleGameWorldSpeech(speech, 5_999)?.alpha ?? 1) - 0.0005) < 1e-12)
  assert.equal(sampleGameWorldSpeech(speech, 6_000), null)
})

test('world speech prunes expired speakers and bounds latest-per-sender state', () => {
  let speeches: readonly GameWorldSpeech[] = []
  for (let index = 0; index < GAME_WORLD_SPEECH_SPEAKER_LIMIT + 2; index += 1) {
    speeches = appendGameWorldSpeech(
      speeches,
      message(index + 1, `player-${index}`),
      index,
    )
  }
  assert.equal(speeches.length, GAME_WORLD_SPEECH_SPEAKER_LIMIT)
  assert.equal(speeches[0]?.playerId, 'player-2')

  speeches = appendGameWorldSpeech(
    speeches,
    message(100, 'fresh-player'),
    GAME_WORLD_SPEECH_HOLD_MS + GAME_WORLD_SPEECH_FADE_MS + 100,
  )
  assert.deepEqual(speeches.map(({ playerId }) => playerId), ['fresh-player'])
})

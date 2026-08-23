import type {
  GameChatChannel,
  GameChatMessage,
} from './protocol/game-chat.ts'

export const GAME_WORLD_SPEECH_HOLD_MS = 3_000
export const GAME_WORLD_SPEECH_FADE_MS = 2_000
export const GAME_WORLD_SPEECH_SPEAKER_LIMIT = 64

export interface GameWorldSpeech {
  readonly channel: GameChatChannel
  readonly expiresAtMs: number
  readonly holdUntilMs: number
  readonly playerId: string
  readonly sequence: number
  readonly startedAtMs: number
  readonly text: string
}

export interface SampledGameWorldSpeech extends GameWorldSpeech {
  readonly alpha: number
}

export function appendGameWorldSpeech(
  speeches: readonly GameWorldSpeech[],
  message: GameChatMessage,
  receivedAtMs: number,
): readonly GameWorldSpeech[] {
  const current = speeches.find(({ playerId }) => playerId === message.sender.playerId)
  if (current && current.sequence >= message.sequence) return speeches

  const next = speeches
    .filter(speech => (
      speech.playerId !== message.sender.playerId
      && sampleGameWorldSpeech(speech, receivedAtMs) !== null
    ))
    .concat(Object.freeze({
      channel: message.channel,
      expiresAtMs: receivedAtMs + GAME_WORLD_SPEECH_HOLD_MS + GAME_WORLD_SPEECH_FADE_MS,
      holdUntilMs: receivedAtMs + GAME_WORLD_SPEECH_HOLD_MS,
      playerId: message.sender.playerId,
      sequence: message.sequence,
      startedAtMs: receivedAtMs,
      text: message.text,
    }))
    .slice(-GAME_WORLD_SPEECH_SPEAKER_LIMIT)
  return Object.freeze(next)
}

export function sampleGameWorldSpeech(
  speech: GameWorldSpeech,
  nowMs: number,
): SampledGameWorldSpeech | null {
  if (nowMs >= speech.expiresAtMs) return null
  const alpha = nowMs <= speech.holdUntilMs
    ? 1
    : (speech.expiresAtMs - nowMs) / (speech.expiresAtMs - speech.holdUntilMs)
  return Object.freeze({ ...speech, alpha })
}

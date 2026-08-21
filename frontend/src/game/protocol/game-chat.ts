export const GAME_CHAT_MAX_TEXT_CODE_UNITS = 180
export const GAME_CHAT_MAX_TEXT_BYTES = 512

export type GameChatChannel = 'global' | 'party'

export interface GameChatSender {
  readonly displayName: string
  readonly playerId: string
}

export interface GameChatMessage {
  readonly channel: GameChatChannel
  readonly sender: GameChatSender
  readonly sequence: number
  readonly text: string
}

export type GameChatRejectionReason = 'channel-unavailable' | 'rate-limited'

export interface GameChatRejection {
  readonly channel: GameChatChannel
  readonly reason: GameChatRejectionReason
  readonly retryAfterMs: number
}

const gameChatTextEncoder = new TextEncoder()

export function normalizeGameChatText(value: string): string {
  const text = value.trim()
  if (text.length === 0) throw new Error('Chat messages cannot be empty.')
  if (text.length > GAME_CHAT_MAX_TEXT_CODE_UNITS) {
    throw new Error(`Chat messages may contain at most ${GAME_CHAT_MAX_TEXT_CODE_UNITS} characters.`)
  }
  if ([...text].some(character => {
    const code = character.codePointAt(0)!
    return code <= 0x1f || code === 0x7f
  })) {
    throw new Error('Chat messages cannot contain control characters.')
  }
  if (gameChatTextEncoder.encode(text).byteLength > GAME_CHAT_MAX_TEXT_BYTES) {
    throw new Error(`Chat messages may contain at most ${GAME_CHAT_MAX_TEXT_BYTES} bytes.`)
  }
  return text
}

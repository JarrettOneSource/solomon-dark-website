export const GAME_CHAT_MAX_TEXT_CODE_UNITS = 180
export const GAME_CHAT_MAX_TEXT_BYTES = 512

export type GameChatChannel = 'boneyard' | 'global' | 'party' | 'whisper'

export const GAME_CHAT_ACTIVITIES = Object.freeze([
  'entered-college',
  'searching-solomon',
  'left-game',
] as const)
export type GameChatActivity = typeof GAME_CHAT_ACTIVITIES[number]

export interface GameOnlinePreferences {
  readonly activityMessages: boolean
  readonly globalChat: boolean
  readonly submitRuns: boolean
}

export const DEFAULT_GAME_ONLINE_PREFERENCES: GameOnlinePreferences = Object.freeze({
  activityMessages: true,
  globalChat: true,
  submitRuns: true,
})

export interface GameChatSender {
  readonly displayName: string
  readonly playerId: string
}

export interface GameChatMessage {
  /** Present only for a host-authored Global lifecycle event. */
  readonly activity?: GameChatActivity
  readonly channel: GameChatChannel
  /** Present exactly when the channel is whisper: the private message target. */
  readonly recipient?: GameChatSender
  readonly sender: GameChatSender
  readonly sequence: number
  readonly text: string
}

export function gameChatActivityText(
  activity: GameChatActivity,
  displayName: string,
): string {
  if (activity === 'entered-college') return `${displayName} has entered the college.`
  if (activity === 'searching-solomon') return `${displayName} is searching for Solomon.`
  return `${displayName} has left the game.`
}

export type GameChatRejectionReason =
  | 'channel-unavailable'
  | 'rate-limited'
  | 'target-unavailable'

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

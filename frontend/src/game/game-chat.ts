import type { LocalPartyState } from './protocol/party-state.ts'
import type {
  GameChatChannel,
  GameChatMessage,
  GameChatRejection,
} from './protocol/game-chat.ts'

export const GAME_CHAT_HISTORY_LIMIT = 80
export const GAME_CHAT_INACTIVITY_HOLD_MS = 5_000
export const GAME_CHAT_FADE_TRANSITION_MS = 650

export type GameChatWorldKind = 'boneyard' | 'hub'

const PARTY_CHANNELS = ['party'] as const
const GLOBAL_CHANNELS = ['global'] as const
const GROUPED_HUB_CHANNELS = ['party', 'global'] as const

export function availableGameChatChannels(
  worldKind: GameChatWorldKind,
  partyState: LocalPartyState | null,
  hasWhisperThread = false,
): readonly GameChatChannel[] {
  const base: readonly GameChatChannel[] =
    worldKind === 'boneyard' || partyState === null
      ? PARTY_CHANNELS
      : partyState.party.memberPlayerIds.length > 1
        ? GROUPED_HUB_CHANNELS
        : GLOBAL_CHANNELS
  return hasWhisperThread ? [...base, 'whisper'] : base
}

export function defaultGameChatChannel(
  worldKind: GameChatWorldKind,
  partyState: LocalPartyState | null,
): GameChatChannel {
  return availableGameChatChannels(worldKind, partyState)[0]!
}

export function reconcileGameChatChannel(
  current: GameChatChannel,
  channels: readonly GameChatChannel[],
): GameChatChannel {
  return channels.includes(current) ? current : channels[0]!
}

export function nextGameChatChannel(
  current: GameChatChannel,
  channels: readonly GameChatChannel[],
): GameChatChannel {
  const currentIndex = channels.indexOf(current)
  return channels[(currentIndex + 1) % channels.length]!
}

export function appendGameChatMessage(
  messages: readonly GameChatMessage[],
  message: GameChatMessage,
): readonly GameChatMessage[] {
  if (message.sequence <= (messages.at(-1)?.sequence ?? 0)) return messages
  return [...messages, message].slice(-GAME_CHAT_HISTORY_LIMIT)
}

export function isGameChatFaded(
  open: boolean,
  lastActivityAtMs: number,
  nowMs: number,
): boolean {
  return !open && nowMs - lastActivityAtMs >= GAME_CHAT_INACTIVITY_HOLD_MS
}

export function gameChatRejectionText(rejection: GameChatRejection): string {
  if (rejection.reason === 'channel-unavailable') {
    return `${channelLabel(rejection.channel)} chat is unavailable here.`
  }
  if (rejection.reason === 'target-unavailable') {
    return 'That wizard is no longer connected.'
  }
  return `Slow down. Try again in ${Math.max(1, Math.ceil(rejection.retryAfterMs / 1_000))}s.`
}

export function channelLabel(channel: GameChatChannel): 'Global' | 'Party' | 'Whisper' {
  if (channel === 'party') return 'Party'
  if (channel === 'whisper') return 'Whisper'
  return 'Global'
}

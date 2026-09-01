import type { LocalPartyState } from './protocol/party-state.ts'
import type { GameSessionKind } from './protocol/game-protocol.ts'
import type {
  GameChatChannel,
  GameChatMessage,
  GameChatRejection,
} from './protocol/game-chat.ts'

export const GAME_CHAT_HISTORY_LIMIT = 80
export const GAME_CHAT_INACTIVITY_HOLD_MS = 5_000

export type GameChatWorldKind = 'boneyard' | 'hub'

const PARTY_CHANNELS = ['party'] as const
const GLOBAL_CHANNELS = ['global'] as const
const GROUPED_HUB_CHANNELS = ['party', 'global'] as const
const BONEYARD_CHANNELS = ['boneyard'] as const
const GLOBAL_BONEYARD_CHANNELS = ['boneyard', 'global'] as const

export function availableGameChatChannels(
  worldKind: GameChatWorldKind,
  partyState: LocalPartyState | null,
  sessionKind: GameSessionKind,
  hasWhisperThread = false,
): readonly GameChatChannel[] {
  const globalHost = sessionKind !== 'standalone'
  const base: readonly GameChatChannel[] = worldKind === 'boneyard'
    ? globalHost ? GLOBAL_BONEYARD_CHANNELS : BONEYARD_CHANNELS
    : partyState?.party.memberPlayerIds.length
      ? partyState.party.memberPlayerIds.length > 1
        ? globalHost ? GROUPED_HUB_CHANNELS : PARTY_CHANNELS
        : globalHost ? GLOBAL_CHANNELS : PARTY_CHANNELS
      : globalHost ? GLOBAL_CHANNELS : PARTY_CHANNELS
  return hasWhisperThread ? [...base, 'whisper'] : base
}

export function defaultGameChatChannel(
  worldKind: GameChatWorldKind,
  partyState: LocalPartyState | null,
  sessionKind: GameSessionKind,
): GameChatChannel {
  return availableGameChatChannels(worldKind, partyState, sessionKind)[0]!
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

export function shouldIncrementGameChatUnread(
  message: GameChatMessage,
  localPlayerId: string,
  open: boolean,
  currentChannel: GameChatChannel,
): boolean {
  return message.sender.playerId !== localPlayerId
    && (!open || currentChannel !== message.channel)
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

export function channelLabel(
  channel: GameChatChannel,
): 'Boneyard' | 'Global' | 'Party' | 'Whisper' {
  if (channel === 'boneyard') return 'Boneyard'
  if (channel === 'party') return 'Party'
  if (channel === 'whisper') return 'Whisper'
  return 'Global'
}

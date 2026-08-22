import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from 'react'

import type { GameClientSession } from './client/game-client-session.ts'
import {
  availableGameChatChannels,
  channelLabel,
  defaultGameChatChannel,
  gameChatRejectionText,
  isGameChatFaded,
  nextGameChatChannel,
  reconcileGameChatChannel,
  GAME_CHAT_INACTIVITY_HOLD_MS,
  type GameChatWorldKind,
} from './game-chat.ts'
import {
  GAME_CHAT_MAX_TEXT_CODE_UNITS,
  type GameChatChannel,
  type GameChatMessage,
  type GameChatSender,
} from './protocol/game-protocol.ts'
import type { LocalPartyState } from './protocol/party-state.ts'
import { gameBindingLabel } from './game-settings.ts'
import './game-chat.css'

export interface GameChatWhisperRequest {
  readonly displayName: string
  readonly playerId: string
  readonly requestedAtMs: number
}

interface GameChatProps {
  disabled: boolean
  onOpenChange: (open: boolean) => void
  onWhisperRequestHandled: () => void
  openKeyCode: string
  partyState: LocalPartyState | null
  session: GameClientSession
  whisperRequest: GameChatWhisperRequest | null
  worldKind: GameChatWorldKind
}

type UnreadCounts = Record<GameChatChannel, number>

const EMPTY_UNREAD: UnreadCounts = { global: 0, party: 0, whisper: 0 }
const CLOSED_MESSAGE_LIMIT = 5
const PINNED_SCROLL_SLACK_PX = 48

export default function GameChat({
  disabled,
  onOpenChange,
  onWhisperRequestHandled,
  openKeyCode,
  partyState,
  session,
  whisperRequest,
  worldKind,
}: GameChatProps) {
  const [whisperTarget, setWhisperTarget] = useState<GameChatSender | null>(null)
  const channels = useMemo(
    () => availableGameChatChannels(worldKind, partyState, whisperTarget !== null),
    [partyState, whisperTarget, worldKind],
  )
  const [channel, setChannel] = useState<GameChatChannel>(() => (
    defaultGameChatChannel(worldKind, partyState)
  ))
  const [draft, setDraft] = useState('')
  const [lastActivityAtMs, setLastActivityAtMs] = useState(() => Date.now())
  const [messages, setMessages] = useState(() => session.getChatMessages())
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [unread, setUnread] = useState<UnreadCounts>(EMPTY_UNREAD)
  const [viewportHeightPx, setViewportHeightPx] = useState(() => (
    window.visualViewport?.height ?? window.innerHeight
  ))
  const channelRef = useRef(channel)
  const draftRef = useRef(draft)
  const inputRef = useRef<HTMLInputElement>(null)
  const manuallySelectedChannelRef = useRef(false)
  const messageListRef = useRef<HTMLOListElement>(null)
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const openRef = useRef(open)
  const pinnedToNewestRef = useRef(true)
  const previousGroupedRef = useRef(channels.length > 1)
  const previousWorldRef = useRef<GameChatWorldKind | null>(worldKind)
  channelRef.current = channel
  draftRef.current = draft
  openRef.current = open

  const markActivity = useCallback(() => {
    const activityAtMs = Date.now()
    setLastActivityAtMs(activityAtMs)
    setNowMs(activityAtMs)
  }, [])

  const filteredMessages = messages.filter(message => message.channel === channel)
  const visibleMessages = open
    ? filteredMessages
    : messages.slice(-CLOSED_MESSAGE_LIMIT)
  const faded = isGameChatFaded(open, lastActivityAtMs, nowMs)
  const totalUnread = unread.party + unread.global + unread.whisper

  useEffect(() => {
    setMessages(session.getChatMessages())
    setUnread(EMPTY_UNREAD)
    setStatus(null)
    setDraft('')
    setOpen(false)
    setWhisperTarget(null)
    manuallySelectedChannelRef.current = false
    setChannel('party')
    channelRef.current = 'party'
    previousGroupedRef.current = false
    previousWorldRef.current = null
    markActivity()

    const removeMessage = session.onChatMessage((message) => {
      setMessages(session.getChatMessages())
      const partner = whisperPartner(message, session.playerId)
      if (partner) {
        setWhisperTarget(current => (
          current !== null
          && current.playerId !== partner.playerId
          && message.sender.playerId !== session.playerId
          && openRef.current
          && channelRef.current === 'whisper'
          && draftRef.current.length > 0
        ) ? current : partner)
      }
      if (!openRef.current || channelRef.current !== message.channel) {
        setUnread(current => ({
          ...current,
          [message.channel]: Math.min(99, current[message.channel] + 1),
        }))
      }
      setStatus(null)
      markActivity()
    })
    const removeRejection = session.onChatRejected((rejection) => {
      setStatus(gameChatRejectionText(rejection))
      markActivity()
    })
    return () => {
      removeMessage()
      removeRejection()
    }
  }, [markActivity, session])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const measure = () => setViewportHeightPx(viewport.height)
    measure()
    viewport.addEventListener('resize', measure)
    return () => viewport.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const worldChanged = previousWorldRef.current !== worldKind
    const grouped = channels.length > 1
    const becameGrouped = grouped && !previousGroupedRef.current
    if (worldChanged || (becameGrouped && !manuallySelectedChannelRef.current)) {
      const next = defaultGameChatChannel(worldKind, partyState)
      channelRef.current = next
      setChannel(next)
      manuallySelectedChannelRef.current = false
    } else {
      setChannel(current => {
        const next = reconcileGameChatChannel(current, channels)
        channelRef.current = next
        return next
      })
    }
    if (channels.length === 1) manuallySelectedChannelRef.current = false
    previousGroupedRef.current = grouped
    previousWorldRef.current = worldKind
  }, [channels, partyState, session, worldKind])

  useEffect(() => {
    if (!disabled || !open) return
    setOpen(false)
    markActivity()
  }, [disabled, markActivity, open])

  useEffect(() => {
    if (!whisperRequest || disabled) return
    if (whisperRequest.playerId === session.playerId) {
      onWhisperRequestHandled()
      return
    }
    setWhisperTarget({
      displayName: whisperRequest.displayName,
      playerId: whisperRequest.playerId,
    })
    manuallySelectedChannelRef.current = true
    channelRef.current = 'whisper'
    setChannel('whisper')
    setUnread(current => current.whisper === 0 ? current : { ...current, whisper: 0 })
    setOpen(true)
    setStatus(null)
    markActivity()
    inputRef.current?.focus({ preventScroll: true })
    onWhisperRequestHandled()
  }, [disabled, markActivity, onWhisperRequestHandled, session, whisperRequest])

  useEffect(() => {
    onOpenChange(open)
  }, [onOpenChange, open])

  useEffect(() => () => onOpenChange(false), [onOpenChange])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus({ preventScroll: true })
      return
    }
    const remainingMs = GAME_CHAT_INACTIVITY_HOLD_MS - (Date.now() - lastActivityAtMs)
    if (remainingMs <= 0) {
      setNowMs(Date.now())
      return
    }
    const timeout = window.setTimeout(() => setNowMs(Date.now()), remainingMs + 1)
    return () => window.clearTimeout(timeout)
  }, [lastActivityAtMs, open])

  useEffect(() => {
    if (!open) return
    pinnedToNewestRef.current = true
    const list = messageListRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [channel, open])

  useEffect(() => {
    if (!open) return
    setUnread(current => current[channel] === 0
      ? current
      : { ...current, [channel]: 0 })
    const list = messageListRef.current
    if (list && pinnedToNewestRef.current) list.scrollTop = list.scrollHeight
  }, [channel, messages, open])

  useEffect(() => {
    const openFromKeyboard = (event: globalThis.KeyboardEvent) => {
      if (
        disabled
        || openRef.current
        || event.code !== openKeyCode
        || event.repeat
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || isEditableTarget(event.target)
      ) return
      event.preventDefault()
      event.stopPropagation()
      setOpen(true)
      setUnread(current => current[channelRef.current] === 0
        ? current
        : { ...current, [channelRef.current]: 0 })
      setStatus(null)
      markActivity()
    }
    window.addEventListener('keydown', openFromKeyboard, { capture: true })
    return () => window.removeEventListener('keydown', openFromKeyboard, { capture: true })
  }, [disabled, markActivity, openKeyCode])

  const chooseChannel = (next: GameChatChannel) => {
    manuallySelectedChannelRef.current = true
    channelRef.current = next
    setChannel(next)
    setUnread(current => current[next] === 0 ? current : { ...current, [next]: 0 })
    setStatus(null)
    markActivity()
    inputRef.current?.focus({ preventScroll: true })
  }

  const closeChat = () => {
    setOpen(false)
    markActivity()
    window.requestAnimationFrame(() => openButtonRef.current?.focus({ preventScroll: true }))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      session.sendChatMessage(
        channel,
        draft,
        channel === 'whisper' ? whisperTarget?.playerId : undefined,
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The message could not be sent.')
      markActivity()
      return
    }
    setDraft('')
    setStatus(null)
    markActivity()
  }

  const handleInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeChat()
      return
    }
    if (event.key === 'Tab' && channels.length > 1) {
      event.preventDefault()
      event.stopPropagation()
      chooseChannel(nextGameChatChannel(channel, channels))
      return
    }
    event.stopPropagation()
  }

  function openChat() {
    if (disabled) return
    setOpen(true)
    setUnread(current => current[channelRef.current] === 0
      ? current
      : { ...current, [channelRef.current]: 0 })
    setStatus(null)
    markActivity()
  }

  const openKeyLabel = gameBindingLabel(openKeyCode)

  return (
    <section
      aria-label="Game chat"
      className="game-chat"
      data-chat-channel={channel}
      data-chat-channels={channels.join(',')}
      data-chat-faded={faded}
      data-chat-open={open}
      data-whisper-target={whisperTarget?.playerId}
      hidden={disabled}
      onPointerDown={event => event.stopPropagation()}
      style={{ '--game-chat-vvh': `${Math.round(viewportHeightPx)}px` } as CSSProperties}
    >
      {open ? (
        <div
          className="game-chat-scrim"
          role="presentation"
          onPointerDown={closeChat}
        />
      ) : null}

      <div className="game-chat-panel">
        {open ? (
          <header className="game-chat-header">
            <div className="game-chat-tabs" role="tablist" aria-label="Chat channel">
              {channels.map(candidate => (
                <button
                  aria-selected={candidate === channel}
                  className="game-chat-tab"
                  data-channel={candidate}
                  key={candidate}
                  onClick={() => chooseChannel(candidate)}
                  role="tab"
                  tabIndex={open && candidate === channel ? 0 : -1}
                  type="button"
                >
                  {channelLabel(candidate)}
                  {unread[candidate] > 0 ? (
                    <span className="game-chat-unread" aria-label={`${unread[candidate]} unread`}>
                      {unread[candidate]}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <button
              aria-label="Close chat"
              className="game-chat-close"
              onClick={closeChat}
              type="button"
            >
              ×
            </button>
          </header>
        ) : null}

        <ol
          aria-atomic="false"
          aria-live="polite"
          className="game-chat-messages"
          onScroll={event => {
            const list = event.currentTarget
            pinnedToNewestRef.current =
              list.scrollHeight - list.scrollTop - list.clientHeight < PINNED_SCROLL_SLACK_PX
          }}
          ref={messageListRef}
        >
          {visibleMessages.length === 0 && open ? (
            <li className="game-chat-empty">
              {`No ${channelLabel(channel).toLowerCase()} messages yet.`}
            </li>
          ) : visibleMessages.map(message => (
            <li
              className="game-chat-message"
              data-message-channel={message.channel}
              data-message-sequence={message.sequence}
              data-recipient-player-id={message.recipient?.playerId}
              data-sender-player-id={message.sender.playerId}
              key={message.sequence}
            >
              <strong>{messageAuthorLabel(message, session.playerId)}</strong>
              <span>{message.text}</span>
            </li>
          ))}
        </ol>

        {status ? <p className="game-chat-status" role="status">{status}</p> : null}

        {open ? (
          <form aria-label={`${channelLabel(channel)} chat message`} className="game-chat-form" onSubmit={submit}>
            <span aria-hidden="true" className="game-chat-rune" data-channel={channel} />
            <input
              aria-label="Chat message"
              autoCapitalize="sentences"
              autoComplete="off"
              className="game-chat-input"
              enterKeyHint="send"
              maxLength={GAME_CHAT_MAX_TEXT_CODE_UNITS}
              onChange={event => {
                setDraft(event.target.value)
                markActivity()
              }}
              onKeyDown={handleInputKey}
              placeholder={channel === 'whisper' && whisperTarget
                ? `Whisper ${whisperTarget.displayName}`
                : `Message ${channelLabel(channel)}`}
              ref={inputRef}
              spellCheck
              value={draft}
            />
            <button className="game-chat-send" type="submit">Send</button>
          </form>
        ) : null}

        {open ? (
          <p className="game-chat-help">Enter send · Tab channel · Esc close</p>
        ) : null}
      </div>

      {!open ? (
        <button
          aria-keyshortcuts={openKeyLabel}
          aria-label="Open chat"
          className="game-chat-open"
          onClick={openChat}
          ref={openButtonRef}
          type="button"
        >
          <svg aria-hidden="true" className="game-chat-open-icon" viewBox="0 0 24 24">
            <path d="M5 4.2h14a2.6 2.6 0 0 1 2.6 2.6v7.6A2.6 2.6 0 0 1 19 17h-6.4l-4.1 3.8V17H5a2.6 2.6 0 0 1-2.6-2.6V6.8A2.6 2.6 0 0 1 5 4.2Z" />
            <circle cx="8.1" cy="10.6" r="1.15" />
            <circle cx="12" cy="10.6" r="1.15" />
            <circle cx="15.9" cy="10.6" r="1.15" />
          </svg>
          <kbd>{openKeyLabel}</kbd>
          {totalUnread > 0 ? <span className="game-chat-open-unread">{totalUnread}</span> : null}
        </button>
      ) : null}
    </section>
  )
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || (target instanceof HTMLElement && target.isContentEditable)
}

function messageAuthorLabel(message: GameChatMessage, localPlayerId: string): string {
  const own = message.sender.playerId === localPlayerId
  if (message.channel === 'whisper') {
    return own && message.recipient
      ? `To ${message.recipient.displayName}`
      : `From ${message.sender.displayName}`
  }
  return own ? 'You' : message.sender.displayName
}

function whisperPartner(
  message: GameChatMessage,
  localPlayerId: string,
): GameChatSender | null {
  if (message.channel !== 'whisper' || !message.recipient) return null
  return message.sender.playerId === localPlayerId ? message.recipient : message.sender
}

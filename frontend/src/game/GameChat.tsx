import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
} from './protocol/game-protocol.ts'
import type { LocalPartyState } from './protocol/party-state.ts'
import { gameBindingLabel } from './game-settings.ts'
import './game-chat.css'

interface GameChatProps {
  disabled: boolean
  onOpenChange: (open: boolean) => void
  openKeyCode: string
  partyState: LocalPartyState | null
  session: GameClientSession
  worldKind: GameChatWorldKind
}

type UnreadCounts = Record<GameChatChannel, number>

const EMPTY_UNREAD: UnreadCounts = { global: 0, party: 0 }
const CLOSED_MESSAGE_LIMIT = 5

export default function GameChat({
  disabled,
  onOpenChange,
  openKeyCode,
  partyState,
  session,
  worldKind,
}: GameChatProps) {
  const channels = useMemo(
    () => availableGameChatChannels(worldKind, partyState),
    [partyState, worldKind],
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
  const channelRef = useRef(channel)
  const inputRef = useRef<HTMLInputElement>(null)
  const manuallySelectedChannelRef = useRef(false)
  const messageListRef = useRef<HTMLOListElement>(null)
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const openRef = useRef(open)
  const previousGroupedRef = useRef(channels.length > 1)
  const previousWorldRef = useRef<GameChatWorldKind | null>(worldKind)
  channelRef.current = channel
  openRef.current = open

  const markActivity = useCallback(() => {
    const activityAtMs = Date.now()
    setLastActivityAtMs(activityAtMs)
    setNowMs(activityAtMs)
  }, [])

  const filteredMessages = messages.filter(message => message.channel === channel)
  const visibleMessages = open
    ? filteredMessages
    : filteredMessages.slice(-CLOSED_MESSAGE_LIMIT)
  const faded = isGameChatFaded(open, lastActivityAtMs, nowMs)

  useEffect(() => {
    setMessages(session.getChatMessages())
    setUnread(EMPTY_UNREAD)
    setStatus(null)
    setDraft('')
    setOpen(false)
    manuallySelectedChannelRef.current = false
    setChannel('party')
    channelRef.current = 'party'
    previousGroupedRef.current = false
    previousWorldRef.current = null
    markActivity()

    const removeMessage = session.onChatMessage((message) => {
      setMessages(session.getChatMessages())
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
    setUnread(current => current[channel] === 0
      ? current
      : { ...current, [channel]: 0 })
    const list = messageListRef.current
    if (list) list.scrollTop = list.scrollHeight
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
      session.sendChatMessage(channel, draft)
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

  return (
    <section
      aria-label="Game chat"
      className="game-chat"
      data-chat-channel={channel}
      data-chat-channels={channels.join(',')}
      data-chat-faded={faded}
      data-chat-open={open}
      hidden={disabled}
      onPointerDown={event => event.stopPropagation()}
    >
      <div className="game-chat-panel">
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
          {open ? (
            <button
              aria-label="Close chat"
              className="game-chat-close"
              onClick={closeChat}
              type="button"
            >
              ×
            </button>
          ) : null}
        </header>

        <ol
          aria-atomic="false"
          aria-live="polite"
          className="game-chat-messages"
          ref={messageListRef}
        >
          {visibleMessages.length === 0 ? (
            <li className="game-chat-empty">
              {open
                ? `No ${channelLabel(channel).toLowerCase()} messages yet.`
                : `Press ${gameBindingLabel(openKeyCode)} to chat.`}
            </li>
          ) : visibleMessages.map(message => (
            <li
              className="game-chat-message"
              data-message-channel={message.channel}
              data-message-sequence={message.sequence}
              data-sender-player-id={message.sender.playerId}
              key={message.sequence}
            >
              <strong>{message.sender.playerId === session.playerId ? 'You' : message.sender.displayName}</strong>
              <span>{message.text}</span>
            </li>
          ))}
        </ol>

        {status ? <p className="game-chat-status" role="status">{status}</p> : null}

        {open ? (
          <form aria-label={`${channelLabel(channel)} chat message`} className="game-chat-form" onSubmit={submit}>
            <span aria-hidden="true" className="game-chat-prompt">›</span>
            <input
              aria-label="Chat message"
              autoComplete="off"
              className="game-chat-input"
              maxLength={GAME_CHAT_MAX_TEXT_CODE_UNITS}
              onChange={event => {
                setDraft(event.target.value)
                markActivity()
              }}
              onKeyDown={handleInputKey}
              placeholder={`Message ${channelLabel(channel)}`}
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
          aria-keyshortcuts="T"
          aria-label="Open chat"
          className="game-chat-open"
          onClick={openChat}
          ref={openButtonRef}
          type="button"
        >
          Chat <kbd>T</kbd>
          {unread[channel] > 0 ? <span>{unread[channel]}</span> : null}
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

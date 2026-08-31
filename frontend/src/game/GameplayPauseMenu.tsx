import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'

import type { GameAudioDirector } from './game-audio-director.ts'
import { NATIVE_UI_SIMPLE_MENU } from './native-ui/core.ts'
import { NativeUiSimpleMenu } from './native-ui/react.ts'
import {
  NATIVE_PAUSE_MENU_ROWS,
  gameplayPausePresentation,
  nativePauseMenuReveal,
  type NativeSimpleMenuAction,
  type NativeSimpleMenuRow,
} from './pause-menu-contract.ts'
import type { GameplayPauseState } from './protocol/game-protocol.ts'
import './gameplay-pause-menu.css'

interface GameplayPauseMenuProps {
  audio: GameAudioDirector
  /**
   * Row that owns controller B and the menu skull's back press; defaults to `escapeAction`.
   * A host that consumes Escape (`escapeAction={null}`) still names its back row here.
   */
  backAction?: NativeSimpleMenuAction | null
  /** Extra full-display owner class for a host whose stage placement differs from gameplay's fixed stage. */
  className?: string
  /** Action selected by an owner Escape; null consumes the edge without closing. */
  escapeAction?: NativeSimpleMenuAction | null
  inputSuspended: boolean
  /** Receives the chosen row's action once the native close tick has run out. */
  onSelect: (action: NativeSimpleMenuAction) => void
  pause: GameplayPauseState
  playerId: string
  /** Authored rows; gameplay's RESUME GAME / GAME SETTINGS / LEAVE GAME unless the host authors its own. */
  rows?: readonly NativeSimpleMenuRow[]
  style: CSSProperties
}

export default function GameplayPauseMenu({
  audio,
  backAction,
  className,
  escapeAction = 'resume',
  inputSuspended,
  onSelect,
  pause,
  playerId,
  rows = NATIVE_PAUSE_MENU_ROWS,
  style,
}: GameplayPauseMenuProps) {
  const backOwner = backAction === undefined ? escapeAction : backAction
  const openingStartedAtRef = useRef(performance.now())
  const closingStartedAtRef = useRef<number | null>(null)
  const completedCloseRef = useRef(false)
  const callbacksRef = useRef({ onSelect })
  const [closing, setClosing] = useState<NativeSimpleMenuAction | null>(null)
  const [reveal, setReveal] = useState(0)
  const presentation = gameplayPausePresentation(pause, playerId)
  callbacksRef.current = { onSelect }

  useEffect(() => {
    const phase = closing ? 'closing' : 'opening'
    const startedAt = closingStartedAtRef.current ?? openingStartedAtRef.current
    let animationFrame = 0
    const sample = (now: number) => {
      const nextReveal = nativePauseMenuReveal(phase, now - startedAt)
      setReveal(nextReveal)
      if (phase === 'opening' && nextReveal === 1) return
      if (phase === 'closing' && nextReveal === 0) {
        if (!closing || completedCloseRef.current) return
        completedCloseRef.current = true
        callbacksRef.current.onSelect(closing)
        return
      }
      animationFrame = requestAnimationFrame(sample)
    }
    sample(performance.now())
    return () => cancelAnimationFrame(animationFrame)
  }, [closing])

  const beginClose = (action: NativeSimpleMenuAction) => {
    if (closing || presentation.kind !== 'owner') return
    audio.playSound('click')
    closingStartedAtRef.current = performance.now()
    setClosing(action)
  }
  const consumeEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== 'Escape'
      || event.repeat
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || presentation.kind !== 'owner'
    ) return
    event.preventDefault()
    event.stopPropagation()
    if (escapeAction) beginClose(escapeAction)
  }
  return (
    <div
      className={`gameplay-pause-overlay gameplay-pause-stage${className ? ` ${className}` : ''}`}
      data-gameplay-pause-owner-id={pause.ownerPlayerId}
      data-gameplay-pause-owner-name={pause.ownerDisplayName}
      data-gameplay-pause-source={pause.source}
      data-input-suspended={inputSuspended}
      data-gameplay-pause-reveal={reveal}
      data-gameplay-pause-view={presentation.kind}
      inert={inputSuspended || undefined}
      onKeyDown={consumeEscape}
      role={presentation.kind === 'owner' ? 'dialog' : 'status'}
      aria-live={presentation.kind === 'waiting' ? 'polite' : undefined}
      aria-modal={presentation.kind === 'owner' ? true : undefined}
      aria-label={presentation.label}
    >
      <div
        aria-hidden
        className="gameplay-pause-dim"
        style={{
          backgroundColor: `rgb(0 0 0 / ${Math.fround(reveal * NATIVE_UI_SIMPLE_MENU.dimAlpha)})`,
        }}
      />
      <div className="main-menu-native-stage gameplay-pause-native-stage" style={style}>
        {presentation.kind === 'owner' ? (
          <NativeUiSimpleMenu
            ariaLabel={presentation.label}
            autoFocus={!inputSuspended}
            backId={backOwner}
            dimAlpha={0}
            disabled={closing !== null}
            onAction={beginClose}
            reveal={reveal}
            rows={rows.map(({ action, label }) => ({ id: action, label }))}
          />
        ) : (
          <div className="gameplay-pause-waiting" style={{ opacity: reveal }}>
            <p>{presentation.label}</p>
            <span>{presentation.detail}</span>
          </div>
        )}
      </div>
    </div>
  )
}

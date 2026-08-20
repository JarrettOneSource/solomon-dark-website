import {
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'

import type { GameAudioDirector } from './game-audio-director.ts'
import { skillPicker } from '../lib/assets.ts'
import {
  NATIVE_PAUSE_CLOSE_MS,
  NATIVE_PAUSE_DIM_ALPHA,
  NATIVE_PAUSE_REVEAL_MS,
  NATIVE_PAUSE_ART_MEMBERS,
  NATIVE_PAUSE_ATLAS_FRAMES,
  PAUSE_MENU_ACTION_BOUNDS,
  gameplayPausePresentation,
  type NativePauseArtMember,
} from './pause-menu-contract.ts'
import type { GameplayPauseState } from './protocol/game-protocol.ts'
import './gameplay-pause-menu.css'

interface GameplayPauseMenuProps {
  audio: GameAudioDirector
  onLeave: () => void
  onResume: () => void
  pause: GameplayPauseState
  playerId: string
  style: CSSProperties
}

type ClosingAction = 'leave' | 'resume'

export default function GameplayPauseMenu({
  audio,
  onLeave,
  onResume,
  pause,
  playerId,
  style,
}: GameplayPauseMenuProps) {
  const resumeRef = useRef<HTMLButtonElement>(null)
  const [closing, setClosing] = useState<ClosingAction | null>(null)
  const presentation = gameplayPausePresentation(pause, playerId)

  useEffect(() => {
    if (presentation.kind === 'owner') resumeRef.current?.focus()
  }, [presentation.kind])

  const beginClose = (action: ClosingAction) => {
    if (closing || presentation.kind !== 'owner') return
    audio.playSound('click')
    setClosing(action)
  }
  const finishClose = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !closing) return
    if (closing === 'resume') onResume()
    else onLeave()
  }
  const consumeEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
  }
  const pauseStyle = {
    ...style,
    '--gameplay-pause-close': `${NATIVE_PAUSE_CLOSE_MS}ms`,
    '--gameplay-pause-dim': NATIVE_PAUSE_DIM_ALPHA,
    '--gameplay-pause-reveal': `${NATIVE_PAUSE_REVEAL_MS}ms`,
  } as CSSProperties

  return (
    <div
      className={`main-menu-native-stage gameplay-pause-stage${closing ? ' gameplay-pause-closing' : ''}`}
      style={pauseStyle}
      data-gameplay-pause-owner-id={pause.ownerPlayerId}
      data-gameplay-pause-owner-name={pause.ownerDisplayName}
      data-gameplay-pause-view={presentation.kind}
      onAnimationEnd={finishClose}
      onKeyDown={consumeEscape}
      role={presentation.kind === 'owner' ? 'dialog' : 'status'}
      aria-live={presentation.kind === 'waiting' ? 'polite' : undefined}
      aria-modal={presentation.kind === 'owner' ? true : undefined}
      aria-label={presentation.label}
    >
      <div className="gameplay-pause-dim" aria-hidden />
      {presentation.kind === 'owner' ? (
        <div className="gameplay-pause-frame">
          {NATIVE_PAUSE_ART_MEMBERS.map((definition, index) => (
            <NativePauseArt key={`${definition.record}-${index}`} definition={definition} />
          ))}
          <button
            ref={resumeRef}
            type="button"
            className="gameplay-pause-action"
            style={PAUSE_MENU_ACTION_BOUNDS.resume}
            disabled={closing !== null}
            data-pause-action="resume"
            onClick={() => beginClose('resume')}
          >
            RESUME GAME
          </button>
          <button
            type="button"
            className="gameplay-pause-action"
            style={PAUSE_MENU_ACTION_BOUNDS.settings}
            disabled
            data-pause-action="settings"
            aria-label="Game Settings unavailable"
          >
            GAME SETTINGS
          </button>
          <button
            type="button"
            className="gameplay-pause-action"
            style={PAUSE_MENU_ACTION_BOUNDS.leave}
            disabled={closing !== null}
            data-pause-action="leave"
            onClick={() => beginClose('leave')}
          >
            LEAVE GAME
          </button>
        </div>
      ) : (
        <div className="gameplay-pause-waiting">
          <p>{presentation.label}</p>
          <span>{presentation.detail}</span>
        </div>
      )}
    </div>
  )
}

function NativePauseArt({ definition }: { definition: NativePauseArtMember }) {
  const frame = NATIVE_PAUSE_ATLAS_FRAMES[definition.record]
  const [x, y, width, height] = frame
  const scale = definition.scale ?? 1
  const transform = definition.rotate === -90
    ? 'rotate(-90deg)'
    : `scale(${definition.flipX ? -scale : scale}, ${definition.flipY ? -scale : scale})`
  return (
    <span
      className="gameplay-pause-native-art"
      style={{
        backgroundImage: `url(${skillPicker.uiAtlas})`,
        backgroundPosition: `-${x}px -${y}px`,
        height,
        left: definition.left,
        top: definition.top,
        transform,
        width,
      }}
      aria-hidden
    />
  )
}

import { useEffect, useId, useRef } from 'react'

import { art, skillIcons } from '../lib/assets.ts'
import { nativeWizardClassTitle } from './core-kernels/native-wizard-class.ts'
import type {
  WizardDiscipline,
  WizardElement,
} from './core-kernels/player-character.ts'
import {
  PLAYER_CHARACTER_SHEETS,
  playerCharacterAtlasCssFrame,
} from './renderer/player-character-atlas.ts'
import { NativeUiSprite } from './native-ui/react-raw.ts'
import './hub.css'

export interface PlayerCardView {
  readonly accountUsername: string | null
  readonly activity: string | null
  readonly activityKind?: string
  readonly discipline: WizardDiscipline
  readonly displayName: string
  readonly element: WizardElement
  readonly gold: number | null
  readonly highestWave: number | null
  readonly id: string
  readonly totalPlaytimeMs: number | null
}

export default function PlayerCardDialog({
  canInvite,
  canMessage,
  onClose,
  onInvite,
  onMessage,
  player,
}: {
  canInvite: boolean
  canMessage: boolean
  onClose: () => void
  onInvite: () => void
  onMessage: () => void
  player: PlayerCardView
}) {
  const headingId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const className = nativeWizardClassTitle(player.element, player.discipline)
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      onCloseRef.current()
    }
    window.addEventListener('keydown', closeOnEscape, { capture: true })
    return () => window.removeEventListener('keydown', closeOnEscape, { capture: true })
  }, [])
  return (
    <div
      className="hub-player-profile-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="hub-player-profile"
        role="dialog"
        ref={dialogRef}
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={headingId}
        data-profile-player={player.id}
        data-profile-element={player.element}
      >
        <NativeUiSprite className="hub-player-profile-corner" atlas="UI" record={17} style={{ position: 'absolute' }} />
        <NativeUiSprite
          atlas="UI"
          className="hub-player-profile-corner hub-player-profile-corner-right"
          record={17}
          style={{ position: 'absolute' }}
        />
        <div className="hub-player-profile-body">
          <header className="hub-player-profile-header">
            <WizardPortrait element={player.element} />
            <div className="hub-player-profile-title">
              <h2 id={headingId}>{player.displayName}</h2>
              <p className="hub-player-profile-class">{className}</p>
              <p
                className="hub-player-profile-badge"
                data-registered={player.accountUsername !== null}
              >
                {player.accountUsername !== null
                  ? `Registered · ${player.accountUsername}`
                  : 'Guest wizard'}
              </p>
              {player.activity ? (
                <p
                  className="hub-player-profile-activity"
                  data-profile-activity={player.activityKind}
                >{player.activity}</p>
              ) : null}
            </div>
          </header>
          <dl className="hub-player-profile-stats">
            <div className="hub-player-profile-stat">
              <img src={skillIcons.bag} alt="" aria-hidden />
              <dt>Gold</dt>
              <dd data-profile-gold={player.gold ?? undefined}>
                {player.gold === null ? '—' : player.gold.toLocaleString()}
              </dd>
            </div>
            <div className="hub-player-profile-stat">
              <img src={skillIcons.wave} alt="" aria-hidden />
              <dt>Highest Wave</dt>
              <dd>
                {player.highestWave === null ? '—' : player.highestWave.toLocaleString()}
              </dd>
            </div>
            <div className="hub-player-profile-stat">
              <img src={skillIcons.infinity} alt="" aria-hidden />
              <dt>Time in the Dark</dt>
              <dd>
                {player.totalPlaytimeMs === null ? '—' : formatPlaytime(player.totalPlaytimeMs)}
              </dd>
            </div>
          </dl>
          <div className="hub-player-profile-actions">
            {canMessage ? (
              <button
                type="button"
                className="hub-player-profile-message"
                onClick={onMessage}
              >
                Message
              </button>
            ) : null}
            {canInvite ? (
              <button
                type="button"
                className="hub-player-profile-invite"
                onClick={onInvite}
              >
                Invite to Party
              </button>
            ) : null}
            <button
              type="button"
              className="hub-player-profile-close"
              data-game-back="true"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

const WIZARD_PORTRAIT_HEADING_INDEX = 12

function WizardPortrait({ element }: { element: WizardElement }) {
  const layers = [
    PLAYER_CHARACTER_SHEETS.staffBack,
    PLAYER_CHARACTER_SHEETS.robeDynamic[element],
    PLAYER_CHARACTER_SHEETS.robeFixed[element],
    PLAYER_CHARACTER_SHEETS.staffFront,
    PLAYER_CHARACTER_SHEETS.head[element],
  ] as const
  return (
    <span className="hub-wizard-portrait" data-portrait-element={element} aria-hidden>
      {layers.map((sheet, index) => (
        <span
          key={`${sheet}:${index}`}
          className="hub-wizard-portrait-layer"
        >
          <span style={playerCharacterAtlasCssFrame(
            sheet,
            0,
            WIZARD_PORTRAIT_HEADING_INDEX,
          )} />
        </span>
      ))}
      <img className="hub-wizard-portrait-frame" src={art.frameGold} alt="" />
    </span>
  )
}

function formatPlaytime(totalPlaytimeMs: number): string {
  const totalMinutes = Math.floor(totalPlaytimeMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

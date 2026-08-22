import { art, skillIcons } from '../lib/assets.ts'
import { HALL_OF_FAME_CLASS_NAMES } from './core-kernels/hall-of-fame.ts'
import type { WizardDiscipline, WizardElement } from './core-kernels/player-character.ts'
import {
  PLAYER_CHARACTER_SHEETS,
  playerCharacterAtlasCssFrame,
} from './renderer/player-character-atlas.ts'
import type { PlayerSocialProfile } from './protocol/party-state.ts'

import './player-profile-card.css'

export interface PlayerProfileCardProps {
  canInvite: boolean
  discipline: WizardDiscipline
  displayName: string
  element: WizardElement
  gold: number | null
  isSelf: boolean
  onClose: () => void
  onInvite?: (playerId: string) => void
  onMessage?: (playerId: string, displayName: string) => void
  playerId: string
  profile: PlayerSocialProfile | null
}

/** The wizard card opened from the College courtyard, the ally strip, or the party sheet. */
export default function PlayerProfileCard({
  canInvite,
  discipline,
  displayName,
  element,
  gold,
  isSelf,
  onClose,
  onInvite,
  onMessage,
  playerId,
  profile,
}: PlayerProfileCardProps) {
  const cardClassName = HALL_OF_FAME_CLASS_NAMES[element][discipline]
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
        aria-modal="true"
        aria-labelledby="hub-player-profile-name"
        data-profile-player={playerId}
        data-profile-element={element}
      >
        <img className="hub-player-profile-corner" src={art.cornerGold} alt="" aria-hidden />
        <img
          className="hub-player-profile-corner hub-player-profile-corner-right"
          src={art.cornerGold}
          alt=""
          aria-hidden
        />
        <header className="hub-player-profile-header">
          <WizardPortrait element={element} />
          <div className="hub-player-profile-title">
            <h2 id="hub-player-profile-name">{displayName}</h2>
            <p className="hub-player-profile-class">{cardClassName}</p>
            {profile && (
              <p
                className="hub-player-profile-badge"
                data-registered={profile.accountUsername !== null}
              >
                {profile.accountUsername !== null
                  ? `Registered · ${profile.accountUsername}`
                  : 'Guest wizard'}
              </p>
            )}
          </div>
        </header>
        <dl className="hub-player-profile-stats">
          <div className="hub-player-profile-stat">
            <img src={skillIcons.bag} alt="" aria-hidden />
            <dt>Gold</dt>
            <dd data-profile-gold={gold ?? undefined}>
              {gold === null ? '—' : gold.toLocaleString()}
            </dd>
          </div>
          <div className="hub-player-profile-stat">
            <img src={skillIcons.wave} alt="" aria-hidden />
            <dt>Highest Wave</dt>
            <dd>
              {profile?.highestWave == null ? '—' : profile.highestWave.toLocaleString()}
            </dd>
          </div>
          <div className="hub-player-profile-stat">
            <img src={skillIcons.infinity} alt="" aria-hidden />
            <dt>Time in the Dark</dt>
            <dd>
              {profile?.totalPlaytimeMs == null ? '—' : formatPlaytime(profile.totalPlaytimeMs)}
            </dd>
          </div>
        </dl>
        <div className="hub-player-profile-actions">
          {!isSelf && onMessage && (
            <button
              type="button"
              className="hub-player-profile-message"
              onClick={() => {
                onMessage(playerId, displayName)
                onClose()
              }}
            >
              Message
            </button>
          )}
          {canInvite && onInvite && (
            <button
              type="button"
              className="hub-player-profile-invite"
              onClick={() => onInvite(playerId)}
            >
              Invite to Party
            </button>
          )}
          <button
            type="button"
            className="hub-player-profile-close"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </section>
    </div>
  )
}

const WIZARD_PORTRAIT_HEADING_INDEX = 12

export function WizardPortrait({ element }: { element: WizardElement }) {
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
        <span key={`${sheet}:${index}`} className="hub-wizard-portrait-layer">
          <span style={playerCharacterAtlasCssFrame(sheet, 0, WIZARD_PORTRAIT_HEADING_INDEX)} />
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

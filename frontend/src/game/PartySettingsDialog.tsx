import { useState } from 'react'

import { art } from '../lib/assets.ts'
import type { GameSessionKind } from './protocol/game-protocol.ts'
import { PARTY_VISIBILITIES, type LocalPartyState, type PartyVisibility } from './protocol/party-state.ts'
import './party-settings.css'

const VISIBILITY_LABELS: Record<PartyVisibility, string> = {
  public: 'PUBLIC',
  'invite-only': 'INVITE ONLY',
  private: 'PRIVATE',
}

export default function PartySettingsDialog({
  error,
  onAcceptRequest,
  onClose,
  onDenyRequest,
  onKick,
  onLeave,
  onRotateCode,
  onVisibility,
  playerId,
  sessionKind,
  state,
}: {
  error: string | null
  onAcceptRequest: (requestId: string) => void
  onClose: () => void
  onDenyRequest: (requestId: string) => void
  onKick: (playerId: string) => void
  onLeave: () => void
  onRotateCode: () => void
  onVisibility: (visibility: PartyVisibility) => void
  playerId: string
  sessionKind: GameSessionKind
  state: LocalPartyState
}) {
  const [copied, setCopied] = useState(false)
  const leader = state.party.leaderPlayerId === playerId
  const memberCount = state.party.memberPlayerIds.length
  const copyCode = () => {
    setCopied(false)
    const write = navigator.clipboard?.writeText(state.party.joinCode)
    if (!write) return
    void write.then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1_500)
    }, () => setCopied(false))
  }
  const displayName = (id: string) => (
    state.hubPlayers.find(player => player.playerId === id)?.displayName
      ?? state.partyRoster.find(player => player.playerId === id)?.displayName
      ?? id
  )
  return (
    <div className="party-settings-backdrop" role="presentation" onPointerDown={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="party-settings-dialog" role="dialog" aria-modal="true" aria-label="Party settings">
        <img className="party-settings-corner" src={art.cornerGold} alt="" aria-hidden />
        <img className="party-settings-corner party-settings-corner-right" src={art.cornerGold} alt="" aria-hidden />
        <header className="party-settings-header">
          <img className="party-settings-header-skull" src={art.skullGold} alt="" aria-hidden />
          <h2>PARTY</h2>
          <span className="party-settings-size">
            {memberCount} {memberCount === 1 ? 'MEMBER' : 'MEMBERS'}
          </span>
          <button className="party-settings-close" data-game-back="true" type="button" onClick={onClose}>CLOSE</button>
        </header>
        {error ? <p className="party-settings-error" role="alert">{error}</p> : null}
        <div className="party-settings-body">
          {leader && sessionKind === 'global-hub' ? (
            <fieldset className="party-settings-group">
              <legend>VISIBILITY</legend>
              <div className="party-settings-segmented">
                {PARTY_VISIBILITIES.map(visibility => (
                  <label className="party-settings-segment" key={visibility}>
                    <input
                      checked={state.party.visibility === visibility}
                      name="party-visibility"
                      onChange={() => onVisibility(visibility)}
                      type="radio"
                    />
                    <span>{VISIBILITY_LABELS[visibility]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : leader ? (
            <p className="party-settings-note">PRIVATE · PARTY ID ONLY</p>
          ) : (
            <p className="party-settings-note">PARTY MEMBER</p>
          )}
          {leader ? (
            <section className="party-settings-group">
              <h3>PARTY ID</h3>
              <div className="party-settings-code">
                <code tabIndex={0}>{state.party.joinCode}</code>
                <button type="button" onClick={copyCode}>{copied ? 'COPIED' : 'COPY'}</button>
                <button type="button" onClick={onRotateCode}>REGENERATE</button>
              </div>
              {!copied ? <small>Long-press the Party ID if clipboard access is unavailable.</small> : null}
            </section>
          ) : null}
          {leader && state.joinRequests.length > 0 ? (
            <section className="party-settings-group">
              <h3>JOIN REQUESTS</h3>
              <div className="party-settings-rows">
                {state.joinRequests.map(request => (
                  <div className="party-settings-request" key={request.id}>
                    <span>{request.requester.displayName}</span>
                    <button type="button" onClick={() => onAcceptRequest(request.id)}>ACCEPT</button>
                    <button type="button" onClick={() => onDenyRequest(request.id)}>DENY</button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {leader && memberCount > 1 ? (
            <section className="party-settings-group">
              <h3>MEMBERS</h3>
              <div className="party-settings-rows">
                {state.party.memberPlayerIds.filter(id => id !== playerId).map(id => (
                  <div className="party-settings-request" key={id}>
                    <span>{displayName(id)}</span>
                    <button type="button" onClick={() => onKick(id)}>KICK</button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        {memberCount > 1 || sessionKind === 'private-college' ? (
          <footer className="party-settings-footer">
            <button className="party-settings-leave" type="button" onClick={onLeave}>
              {sessionKind === 'private-college' ? 'LEAVE COLLEGE' : 'LEAVE PARTY'}
            </button>
          </footer>
        ) : null}
      </section>
    </div>
  )
}

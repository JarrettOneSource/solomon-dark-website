import { useState } from 'react'

import type { GameSessionKind } from './protocol/game-protocol.ts'
import type { LocalPartyState, PartyVisibility } from './protocol/party-state.ts'
import './party-settings.css'

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
  const copyCode = () => {
    setCopied(false)
    const write = navigator.clipboard?.writeText(state.party.joinCode)
    if (!write) return
    void write.then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1_500)
    }, () => setCopied(false))
  }
  return (
    <div className="party-settings-backdrop" role="presentation" onPointerDown={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="party-settings-dialog" role="dialog" aria-modal="true" aria-label="Party settings">
        <header><h2>PARTY</h2><button type="button" onClick={onClose}>CLOSE</button></header>
        {error ? <p className="party-settings-error" role="alert">{error}</p> : null}
        {leader && sessionKind === 'global-hub' ? (
          <fieldset>
            <legend>VISIBILITY</legend>
            {(['public', 'invite-only', 'private'] as const).map(visibility => (
              <label key={visibility}>
                <input
                  checked={state.party.visibility === visibility}
                  name="party-visibility"
                  onChange={() => onVisibility(visibility)}
                  type="radio"
                />
                {visibility === 'invite-only' ? 'INVITE ONLY' : visibility.toUpperCase()}
              </label>
            ))}
          </fieldset>
        ) : leader ? (
          <p className="party-settings-private">PRIVATE · PARTY ID ONLY</p>
        ) : (
          <p className="party-settings-private">PARTY MEMBER</p>
        )}
        {leader ? (
          <section>
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
          <section>
            <h3>JOIN REQUESTS</h3>
            {state.joinRequests.map(request => (
              <div className="party-settings-request" key={request.id}>
                <span>{request.requester.displayName}</span>
                <button type="button" onClick={() => onAcceptRequest(request.id)}>ACCEPT</button>
                <button type="button" onClick={() => onDenyRequest(request.id)}>DENY</button>
              </div>
            ))}
          </section>
        ) : null}
        {leader && state.party.memberPlayerIds.length > 1 ? (
          <section>
            <h3>MEMBERS</h3>
            {state.party.memberPlayerIds.filter(id => id !== playerId).map(id => {
              const profile = state.hubPlayers.find(player => player.playerId === id)
              return (
                <div className="party-settings-request" key={id}>
                  <span>{profile?.displayName ?? id}</span>
                  <button type="button" onClick={() => onKick(id)}>KICK</button>
                </div>
              )
            })}
          </section>
        ) : null}
        {state.party.memberPlayerIds.length > 1 || sessionKind === 'private-college' ? (
          <button className="party-settings-leave" type="button" onClick={onLeave}>
            {sessionKind === 'private-college' ? 'LEAVE COLLEGE' : 'LEAVE PARTY'}
          </button>
        ) : null}
      </section>
    </div>
  )
}

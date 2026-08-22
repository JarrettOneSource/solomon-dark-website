import { useEffect, useState, type CSSProperties } from 'react'

import type { PartyJoinResolution } from '../lib/api.ts'
import { directoryPartyAction, usePartyDirectory } from './party-directory.ts'
import {
  completePartyCode,
  normalizePartyCode,
  usePartyJoinActions,
} from './party-join.ts'
import './join-party.css'

export default function JoinPartyScene({
  onBack,
  onResolved,
  requesterDisplayName,
}: {
  onBack: () => void
  onResolved: (resolution: PartyJoinResolution) => void
  requesterDisplayName: string
}) {
  const directory = usePartyDirectory(true)
  const actions = usePartyJoinActions(requesterDisplayName, onResolved)
  const [code, setCode] = useState('')
  const [viewportHeight, setViewportHeight] = useState(() => (
    window.visualViewport?.height ?? window.innerHeight
  ))

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const resize = () => setViewportHeight(viewport.height)
    viewport.addEventListener('resize', resize)
    return () => viewport.removeEventListener('resize', resize)
  }, [])

  return (
    <section
      className="join-party-scene"
      aria-label="Join Party"
      style={{ '--join-party-viewport-height': `${viewportHeight}px` } as CSSProperties}
    >
      <header>
        <h1>JOIN PARTY</h1>
        <p>Enter a Party ID or join a listed party.</p>
      </header>
      <form
        className="join-party-code"
        onSubmit={event => {
          event.preventDefault()
          if (completePartyCode(code)) void actions.resolveCode(code)
        }}
      >
        <label htmlFor="join-party-code">PARTY ID</label>
        <div>
          <input
            id="join-party-code"
            aria-label="Party ID"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="go"
            inputMode="text"
            maxLength={128}
            onChange={event => setCode(normalizePartyCode(event.target.value))}
            placeholder="XXXX-XXXX"
            spellCheck={false}
            value={code}
          />
          <button disabled={actions.busy || !completePartyCode(code)} type="submit">
            JOIN
          </button>
        </div>
      </form>
      {actions.error || directory.error ? (
        <p className="join-party-error" role="alert">{actions.error ?? directory.error}</p>
      ) : null}
      <div className="join-party-list" role="list" aria-busy={directory.loading}>
        {directory.loading && directory.parties.length === 0 ? (
          <p>CONSULTING THE DARK CLOUD…</p>
        ) : directory.parties.length === 0 ? (
          <p>NO PARTIES ARE FORMING RIGHT NOW.</p>
        ) : directory.parties.map(party => {
          const action = directoryPartyAction(party)
          return (
            <article key={party.id} role="listitem" data-party-listing={party.id}>
              <span>
                <strong>{party.leader.toUpperCase()}</strong>
                <small>{party.members.join(' · ')}</small>
              </span>
              <span>{party.memberCount} / {party.maxMembers}</span>
              <button
                disabled={actions.busy || action === 'wait'}
                onClick={() => {
                  if (action === 'join') void actions.joinPublic(party.id)
                  if (action === 'request') void actions.requestInvite(party.id)
                }}
                type="button"
              >
                {action === 'wait'
                  ? 'IN GAME'
                  : actions.pendingListingId === party.id
                    ? 'REQUESTED'
                    : action === 'request' ? 'REQUEST' : 'JOIN'}
              </button>
            </article>
          )
        })}
      </div>
      <footer>
        <button type="button" onClick={onBack}>BACK</button>
        <button type="button" onClick={() => { void directory.refresh() }}>REFRESH</button>
      </footer>
    </section>
  )
}

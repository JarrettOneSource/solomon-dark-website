import { useEffect, useRef } from 'react'

import type { GameCollegeInvitation } from './protocol/game-protocol.ts'
import './play-routing-dialog.css'

export default function CollegeInvitationDialog({
  busy,
  invitation,
  onAccept,
  onDecline,
}: {
  busy: boolean
  invitation: GameCollegeInvitation
  onAccept: () => void
  onDecline: () => void
}) {
  const declineRef = useRef<HTMLButtonElement>(null)
  const decline = useRef(onDecline)
  decline.current = onDecline
  useEffect(() => {
    declineRef.current?.focus({ preventScroll: true })
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || busy) return
      event.preventDefault()
      event.stopImmediatePropagation()
      decline.current()
    }
    window.addEventListener('keydown', closeOnEscape, { capture: true })
    return () => window.removeEventListener('keydown', closeOnEscape, { capture: true })
  }, [busy])
  return (
    <div className="play-routing-backdrop" role="presentation">
      <section
        className="play-routing-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Private College invitation"
      >
        <h2>COLLEGE INVITATION</h2>
        <p><strong>{invitation.inviter.displayName}</strong> invited you to their private College.</p>
        <p>You will preview its mods and cheat policy before leaving your current session.</p>
        <footer>
          <button data-game-back="true" disabled={busy} ref={declineRef} type="button" onClick={onDecline}>
            DECLINE
          </button>
          <button disabled={busy} type="button" onClick={onAccept}>
            {busy ? 'RESOLVING…' : 'VIEW & JOIN'}
          </button>
        </footer>
      </section>
    </div>
  )
}

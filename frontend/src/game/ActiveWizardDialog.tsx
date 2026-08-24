import type { CSSProperties, KeyboardEvent } from 'react'

import './active-wizard-dialog.css'

export const NATIVE_KILL_CHARACTER_TITLE = 'KILL CHARACTER?'
export const NATIVE_KILL_CHARACTER_BODY =
  'Starting a new game will kill off your current game and character (Lucritius will scavenge his equipment)!'

export default function ActiveWizardDialog({
  busy,
  onCancel,
  onKill,
  onResume,
  style,
}: {
  busy: boolean
  onCancel: () => void
  onKill: () => void
  onResume: () => void
  style: CSSProperties
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || busy) return
    event.preventDefault()
    onCancel()
  }
  return (
    <div className="main-menu-native-stage active-wizard-stage" style={style}>
      <section
        aria-label="Resume or kill the current wizard"
        aria-modal="true"
        className="active-wizard-dialog"
        data-native-dialog-title={NATIVE_KILL_CHARACTER_TITLE}
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <h2>{NATIVE_KILL_CHARACTER_TITLE}</h2>
        <p>{NATIVE_KILL_CHARACTER_BODY}</p>
        <div className="active-wizard-actions">
          <button autoFocus disabled={busy} type="button" onClick={onResume}>
            RESUME LAST GAME
          </button>
          <button disabled={busy} type="button" onClick={onKill}>
            {busy ? 'KILLING WIZARD…' : 'KILL WIZARD'}
          </button>
        </div>
      </section>
    </div>
  )
}

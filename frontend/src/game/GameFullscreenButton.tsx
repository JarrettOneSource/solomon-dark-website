import { useEffect, useState } from 'react'

import {
  GAME_FULLSCREEN_CHANGE_EVENTS,
  gameFullscreenActive,
  gameFullscreenControlMode,
  gameInstalledDisplayMode,
  toggleGameFullscreen,
} from './game-fullscreen.ts'

export default function GameFullscreenButton() {
  const [active, setActive] = useState(() => gameFullscreenActive(document))
  const [error, setError] = useState<string | null>(null)
  const [installed] = useState(() => gameInstalledDisplayMode(window))
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const mode = gameFullscreenControlMode(document, installed)

  useEffect(() => {
    const update = () => {
      setActive(gameFullscreenActive(document))
      setError(null)
      setShowInstallHelp(false)
    }
    for (const eventName of GAME_FULLSCREEN_CHANGE_EVENTS) {
      document.addEventListener(eventName, update)
    }
    return () => {
      for (const eventName of GAME_FULLSCREEN_CHANGE_EVENTS) {
        document.removeEventListener(eventName, update)
      }
    }
  }, [])

  if (mode === 'hidden') return null

  const toggle = async () => {
    setError(null)
    if (mode === 'install') {
      setShowInstallHelp((visible) => !visible)
      return
    }
    try {
      await toggleGameFullscreen(document)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Fullscreen could not be changed.')
    }
  }

  const label = mode === 'install'
    ? 'Fullscreen options'
    : active ? 'Exit fullscreen' : 'Enter fullscreen'

  return (
    <div className="game-fullscreen-control">
      <button
        type="button"
        className="game-fullscreen-button"
        aria-controls={mode === 'install' ? 'game-fullscreen-help' : undefined}
        aria-expanded={mode === 'install' ? showInstallHelp : undefined}
        aria-label={label}
        aria-pressed={mode === 'fullscreen' ? active : undefined}
        data-game-fullscreen
        data-game-fullscreen-mode={mode}
        onClick={() => { void toggle() }}
        title={label}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          {active ? (
            <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
          ) : (
            <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
          )}
        </svg>
      </button>
      {showInstallHelp && (
        <div id="game-fullscreen-help" className="game-fullscreen-message" role="status">
          <strong>Fullscreen on iPhone or iPad</strong>
          <span>Tap Share, Add to Home Screen, keep Open as Web App enabled if shown, then launch Solomon Darker from its icon.</span>
          <span>Otherwise, open the game in a browser that supports fullscreen.</span>
        </div>
      )}
      {error && <div className="game-fullscreen-message" role="alert">{error}</div>}
    </div>
  )
}

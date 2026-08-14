import { useEffect, useState } from 'react'

import {
  gameFullscreenActive,
  gameFullscreenSupported,
  toggleGameFullscreen,
} from './game-fullscreen.ts'

export default function GameFullscreenButton() {
  const [active, setActive] = useState(() => gameFullscreenActive(document))
  const [error, setError] = useState<string | null>(null)
  const supported = gameFullscreenSupported(document)

  useEffect(() => {
    const update = () => {
      setActive(gameFullscreenActive(document))
      setError(null)
    }
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])

  if (!supported) return null

  const toggle = async () => {
    setError(null)
    try {
      await toggleGameFullscreen(document)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Fullscreen could not be changed.')
    }
  }

  return (
    <div className="game-fullscreen-control">
      <button
        type="button"
        className="game-fullscreen-button"
        aria-label={active ? 'Exit fullscreen' : 'Enter fullscreen'}
        aria-pressed={active}
        data-game-fullscreen
        onClick={() => { void toggle() }}
        title={active ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          {active ? (
            <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
          ) : (
            <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
          )}
        </svg>
      </button>
      {error && <div className="game-fullscreen-error" role="alert">{error}</div>}
    </div>
  )
}

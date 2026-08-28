import { useEffect, useState, type CSSProperties } from 'react'

import { subscribeGamePresentationFrames } from './game-presentation-frame-loop.ts'
import { gameplayResumeGraceProgress } from './gameplay-resume-grace.ts'
import type { GameplayResumeGraceState } from './protocol/game-protocol.ts'
import './gameplay-resume-progress.css'

interface GameplayResumeProgressProps {
  readonly grace: GameplayResumeGraceState
  readonly style: CSSProperties
}

export default function GameplayResumeProgress({
  grace,
  style,
}: GameplayResumeProgressProps) {
  const [progress, setProgress] = useState<number | null>(() => (
    gameplayResumeGraceProgress(grace, 0)
  ))

  useEffect(() => {
    const receivedAtMs = performance.now()
    setProgress(gameplayResumeGraceProgress(grace, 0))
    return subscribeGamePresentationFrames((nowMs) => {
      const next = gameplayResumeGraceProgress(grace, nowMs - receivedAtMs)
      setProgress(current => current === next ? current : next)
    })
  }, [grace])

  const phase = progress === null ? 'waiting' : 'progress'

  return (
    <div
      className="gameplay-resume-progress-overlay"
      data-gameplay-resume-grace-phase={phase}
      data-gameplay-resume-grace-progress={progress}
      data-gameplay-resume-grace-reason={grace.reason}
      data-gameplay-resume-grace-remaining-ms={grace.remainingMs}
      data-gameplay-resume-grace-sequence={grace.sequence}
    >
      <div className="main-menu-native-stage gameplay-resume-progress-stage" style={style}>
        <div className="gameplay-resume-progress-panel">
          <span
            className="gameplay-resume-progress-label"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {progress === null
              ? grace.reason === 'party-rejoin-wait'
                ? 'Waiting for players to rejoin'
                : 'Waiting on players ...'
              : 'RESUMING...'}
          </span>
          {progress === null ? null : (
            <div
              className="gameplay-resume-progress-track"
              role="progressbar"
              aria-label="Resuming gameplay"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
            >
              <div
                className="gameplay-resume-progress-fill"
                style={{ transform: `scaleX(${progress})` } satisfies CSSProperties}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

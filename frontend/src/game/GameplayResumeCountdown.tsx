import { useEffect, useState, type CSSProperties } from 'react'

import { subscribeGamePresentationFrames } from './game-presentation-frame-loop.ts'
import { gameplayResumeGraceSeconds } from './gameplay-resume-grace.ts'
import type { GameplayResumeGraceState } from './protocol/game-protocol.ts'
import './gameplay-resume-countdown.css'

interface GameplayResumeCountdownProps {
  readonly grace: GameplayResumeGraceState
  readonly style: CSSProperties
}

export default function GameplayResumeCountdown({
  grace,
  style,
}: GameplayResumeCountdownProps) {
  const [seconds, setSeconds] = useState<number | null>(() => (
    gameplayResumeGraceSeconds(grace, 0)
  ))

  useEffect(() => {
    const receivedAtMs = performance.now()
    setSeconds(gameplayResumeGraceSeconds(grace, 0))
    return subscribeGamePresentationFrames((nowMs) => {
      const next = gameplayResumeGraceSeconds(grace, nowMs - receivedAtMs)
      setSeconds(current => current === next ? current : next)
    })
  }, [grace])

  const phase = seconds === null ? 'waiting' : 'countdown'

  return (
    <div
      className="gameplay-resume-countdown-overlay"
      data-gameplay-resume-grace-phase={phase}
      data-gameplay-resume-grace-reason={grace.reason}
      data-gameplay-resume-grace-remaining-ms={grace.remainingMs}
      data-gameplay-resume-grace-sequence={grace.sequence}
      data-gameplay-resume-grace-seconds={seconds}
      role="status"
      aria-live={seconds === null ? 'polite' : 'assertive'}
      aria-atomic="true"
    >
      <div className="main-menu-native-stage gameplay-resume-countdown-stage" style={style}>
        <div className="gameplay-resume-countdown-panel">
          <span className="gameplay-resume-countdown-label">
            {seconds === null ? 'Waiting on players ...' : 'RESUMING IN'}
          </span>
          {seconds === null ? null : (
            <strong className="gameplay-resume-countdown-value">{seconds}</strong>
          )}
        </div>
      </div>
    </div>
  )
}

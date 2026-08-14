import { useEffect, useState, type CSSProperties } from 'react'

import { matchLoading } from '../lib/assets.ts'
import {
  MATCH_LOADING_PRESENTATION_DELAY_MS,
  shouldPresentMatchLoading,
  type MatchLoadingState,
} from './match-loading.ts'
import './match-loading-screen.css'

interface MatchLoadingScreenProps {
  loading: MatchLoadingState
}

export default function MatchLoadingScreen({ loading }: MatchLoadingScreenProps) {
  const [presented, setPresented] = useState(() => shouldPresentMatchLoading(loading))

  useEffect(() => {
    const remainingMs = MATCH_LOADING_PRESENTATION_DELAY_MS
      - (performance.now() - loading.startedAtMs)
    if (remainingMs <= 0) {
      setPresented(true)
      return
    }
    setPresented(false)
    const timeout = window.setTimeout(() => setPresented(true), remainingMs)
    return () => window.clearTimeout(timeout)
  }, [loading.startedAtMs])

  return (
    <div
      className="match-loading-screen"
      data-flow={loading.flow}
      data-progress={loading.progress}
      data-stage={loading.stage}
      data-visible={presented}
      aria-busy="true"
    >
      <img
        className="match-loading-art"
        src={matchLoading.background}
        alt=""
        draggable="false"
      />
      <div className="match-loading-scrim" aria-hidden />
      <div
        className="match-loading-label"
        role="status"
        aria-live="polite"
      >
        {loading.label}
      </div>
      <div
        className="match-loading-progress"
        role="progressbar"
        aria-label={loading.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={loading.progress * 100}
      >
        <div
          className="match-loading-progress-fill"
          style={{ width: `${loading.progress * 100}%` } satisfies CSSProperties}
        />
      </div>
    </div>
  )
}

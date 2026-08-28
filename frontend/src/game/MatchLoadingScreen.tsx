import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

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
  const imageRef = useRef<HTMLImageElement>(null)
  const [artReady, setArtReady] = useState(false)
  const [delayElapsed, setDelayElapsed] = useState(() => shouldPresentMatchLoading(loading))

  const markArtReady = useCallback(() => setArtReady(true), [])

  useLayoutEffect(() => {
    const image = imageRef.current
    if (image && image.complete && image.naturalWidth > 0) markArtReady()
  }, [markArtReady])

  useEffect(() => {
    const remainingMs = MATCH_LOADING_PRESENTATION_DELAY_MS
      - (performance.now() - loading.startedAtMs)
    if (remainingMs <= 0) {
      setDelayElapsed(true)
      return
    }
    setDelayElapsed(false)
    const timeout = window.setTimeout(() => setDelayElapsed(true), remainingMs)
    return () => window.clearTimeout(timeout)
  }, [loading.startedAtMs])

  return (
    <div
      className="match-loading-screen"
      data-art-ready={artReady}
      data-delay-elapsed={delayElapsed}
      data-flow={loading.flow}
      data-progress={loading.progress}
      data-stage={loading.stage}
      data-visible={delayElapsed && artReady}
      aria-busy="true"
    >
      <img
        ref={imageRef}
        className="match-loading-art"
        src={matchLoading.background}
        alt=""
        draggable="false"
        onLoad={markArtReady}
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

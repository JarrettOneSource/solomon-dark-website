import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  createLoaderRenderer,
  type LoaderRenderer,
} from './renderer/loader-renderer.ts'
import { loaderProgressPercent } from './renderer/loader-render-contract.ts'
import {
  GAME_VIEWPORT_MIN_HEIGHT,
  GAME_VIEWPORT_MIN_WIDTH,
  fixedGameViewportLayout,
  type FixedGameViewportLayout,
} from './renderer/game-viewport.ts'
import './native-loader.css'

interface NativeLoaderProps {
  completed?: number
  currentItem?: string | null
  progress: number
  stage: string
  total?: number
}

export default function NativeLoader({
  completed,
  currentItem,
  progress,
  stage,
  total,
}: NativeLoaderProps) {
  const stageRef = useRef<HTMLElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<LoaderRenderer | null>(null)
  const progressRef = useRef(progress)
  const viewportRef = useRef(fixedGameViewportLayout(
    GAME_VIEWPORT_MIN_WIDTH,
    GAME_VIEWPORT_MIN_HEIGHT,
  ))
  const [viewport, setViewport] = useState(viewportRef.current)
  const [rendererError, setRendererError] = useState<string | null>(null)
  const boundedProgress = Math.max(0, Math.min(1, progress))
  const percentage = loaderProgressPercent(boundedProgress)
  progressRef.current = boundedProgress
  viewportRef.current = viewport

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const resize = () => {
      const next = fixedGameViewportLayout(stage.clientWidth, stage.clientHeight)
      setViewport((current) => sameViewport(current, next) ? current : next)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => rendererRef.current?.resize(viewport), [viewport])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    setRendererError(null)
    void createLoaderRenderer({
      viewport: viewportRef.current,
    }).then((renderer) => {
      if (cancelled) {
        renderer.destroy()
        return
      }
      rendererRef.current = renderer
      renderer.mount(host)
      renderer.resize(viewportRef.current)
      renderer.render(progressRef.current)
    }).catch((error: unknown) => {
      if (!cancelled) {
        setRendererError(error instanceof Error
          ? error.message
          : 'The WebGL loader renderer could not start.')
      }
    })
    return () => {
      cancelled = true
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    rendererRef.current?.render(boundedProgress)
  }, [boundedProgress])

  return (
    <div className="native-loader-page">
      <section ref={stageRef} className="native-loader-stage">
        <div ref={hostRef} className="native-loader-renderer" aria-hidden />
        <div className="native-loader-status">
          <div
            className="native-loader-summary"
            role="status"
            aria-atomic="true"
            aria-live="polite"
          >
            <span>{stage}</span>
            <span className="native-loader-percent">
              {percentage}%
            </span>
          </div>
          {currentItem && (
            <div className="native-loader-item" title={currentItem}>
              Current item: {currentItem}
            </div>
          )}
          {completed !== undefined && total !== undefined && (
            <div className="native-loader-count">
              {completed.toLocaleString()} / {total.toLocaleString()} items ready
            </div>
          )}
        </div>
      </section>
      {rendererError && (
        <div className="native-loader-error" role="alert">{rendererError}</div>
      )}
    </div>
  )
}

function sameViewport(
  first: FixedGameViewportLayout,
  second: FixedGameViewportLayout,
): boolean {
  return first.displayScale === second.displayScale
    && first.height === second.height
    && first.width === second.width
}

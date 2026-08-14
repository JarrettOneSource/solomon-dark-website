import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  createLoaderRenderer,
  type LoaderRenderer,
} from './renderer/loader-renderer.ts'
import { loaderProgressPercent } from './renderer/loader-render-contract.ts'
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
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<LoaderRenderer | null>(null)
  const progressRef = useRef(progress)
  const [rendererError, setRendererError] = useState<string | null>(null)
  const boundedProgress = Math.max(0, Math.min(1, progress))
  const percentage = loaderProgressPercent(boundedProgress)
  progressRef.current = boundedProgress

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const resize = () => {
      rendererRef.current?.resize(host.clientWidth / 480)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    setRendererError(null)
    void createLoaderRenderer({
      displayScale: host.clientWidth / 480,
    }).then((renderer) => {
      if (cancelled) {
        renderer.destroy()
        return
      }
      rendererRef.current = renderer
      host.replaceChildren(renderer.canvas)
      renderer.resize(host.clientWidth / 480)
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
      host.replaceChildren()
    }
  }, [])

  useEffect(() => {
    rendererRef.current?.render(boundedProgress)
  }, [boundedProgress])

  return (
    <div className="native-loader-page">
      <section className="native-loader-stage">
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

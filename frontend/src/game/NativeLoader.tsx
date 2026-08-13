import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  createLoaderRenderer,
  type LoaderRenderer,
} from './renderer/loader-renderer.ts'
import './native-loader.css'

interface NativeLoaderProps {
  progress: number
}

export default function NativeLoader({ progress }: NativeLoaderProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<LoaderRenderer | null>(null)
  const progressRef = useRef(progress)
  const [rendererError, setRendererError] = useState<string | null>(null)
  const boundedProgress = Math.max(0, Math.min(1, progress))
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
    <div
      className="native-loader-page"
      role="status"
      aria-label={`Loading ${Math.round(boundedProgress * 100)}%`}
    >
      <section className="native-loader-stage" aria-hidden>
        <div ref={hostRef} className="native-loader-renderer" />
      </section>
      {rendererError && (
        <div className="native-loader-error" role="alert">{rendererError}</div>
      )}
    </div>
  )
}

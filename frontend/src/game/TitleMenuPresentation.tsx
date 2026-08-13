import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { fixedGameViewportScale } from './renderer/game-viewport.ts'
import {
  createTitleMenuRenderer,
  type TitleMenuAction,
  type TitleMenuRenderFrame,
  type TitleMenuRenderer,
  type TitleMenuScreen,
} from './renderer/title-menu-renderer.ts'

interface TitleMenuPresentationProps {
  hoveredAction: TitleMenuAction | null
  pressedAction: TitleMenuAction | null
  screen: TitleMenuScreen
}

export default function TitleMenuPresentation({
  hoveredAction,
  pressedAction,
  screen,
}: TitleMenuPresentationProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<TitleMenuRenderer | null>(null)
  const frameRef = useRef<Omit<TitleMenuRenderFrame, 'elapsedMs'>>({
    hoveredAction,
    pressedAction,
    reducedMotion: false,
    screen,
  })
  const [rendererError, setRendererError] = useState<string | null>(null)

  frameRef.current.hoveredAction = hoveredAction
  frameRef.current.pressedAction = pressedAction
  frameRef.current.screen = screen

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const resize = () => {
      rendererRef.current?.resize(fixedGameViewportScale(host.clientWidth, host.clientHeight))
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
    let animationFrame = 0
    const startedAt = performance.now()
    frameRef.current.reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    setRendererError(null)

    void createTitleMenuRenderer({
      displayScale: fixedGameViewportScale(host.clientWidth, host.clientHeight),
    }).then((renderer) => {
      if (cancelled) {
        renderer.destroy()
        return
      }
      rendererRef.current = renderer
      host.replaceChildren(renderer.canvas)
      renderer.resize(fixedGameViewportScale(host.clientWidth, host.clientHeight))
      const animate = (now: number) => {
        renderer.render({
          ...frameRef.current,
          elapsedMs: now - startedAt,
        })
        animationFrame = requestAnimationFrame(animate)
      }
      animationFrame = requestAnimationFrame(animate)
    }).catch((error: unknown) => {
      if (!cancelled) {
        setRendererError(error instanceof Error
          ? error.message
          : 'The WebGL title renderer could not start.')
      }
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(animationFrame)
      rendererRef.current?.destroy()
      rendererRef.current = null
      host.replaceChildren()
    }
  }, [])

  return (
    <>
      <div ref={hostRef} className="title-menu-renderer" aria-hidden />
      {rendererError && (
        <div className="main-menu-renderer-error" role="alert">{rendererError}</div>
      )}
    </>
  )
}

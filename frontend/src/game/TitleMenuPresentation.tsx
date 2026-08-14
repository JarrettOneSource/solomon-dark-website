import { useEffect, useRef, useState } from 'react'

import { startGamePresentationLoop } from './game-presentation-frame-loop.ts'
import type { FixedGameViewportLayout } from './renderer/game-viewport.ts'
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
  viewport: FixedGameViewportLayout
}

export default function TitleMenuPresentation({
  hoveredAction,
  pressedAction,
  screen,
  viewport,
}: TitleMenuPresentationProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<TitleMenuRenderer | null>(null)
  const frameRef = useRef<Omit<TitleMenuRenderFrame, 'elapsedMs'>>({
    hoveredAction,
    pressedAction,
    reducedMotion: false,
    screen,
  })
  const viewportRef = useRef(viewport)
  const [rendererError, setRendererError] = useState<string | null>(null)

  frameRef.current.hoveredAction = hoveredAction
  frameRef.current.pressedAction = pressedAction
  frameRef.current.screen = screen
  viewportRef.current = viewport

  useEffect(() => rendererRef.current?.resize(viewport), [viewport])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let stopPresentationLoop: (() => void) | null = null
    const startedAt = performance.now()
    frameRef.current.reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    setRendererError(null)

    void createTitleMenuRenderer({
      viewport: viewportRef.current,
    }).then((renderer) => {
      if (cancelled) {
        renderer.destroy()
        return
      }
      rendererRef.current = renderer
      host.replaceChildren(renderer.canvas)
      renderer.resize(viewportRef.current)
      stopPresentationLoop = startGamePresentationLoop((now) => {
        renderer.render({
          ...frameRef.current,
          elapsedMs: now - startedAt,
        })
      })
    }).catch((error: unknown) => {
      if (!cancelled) {
        setRendererError(error instanceof Error
          ? error.message
          : 'The WebGL title renderer could not start.')
      }
    })

    return () => {
      cancelled = true
      stopPresentationLoop?.()
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

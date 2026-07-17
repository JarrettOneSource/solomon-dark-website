import { useEffect, useRef } from 'react'
import { menuSolomon } from '../lib/assets'

/**
 * The title-screen Solomon, rebuilt from the game's own menu renderer
 * (MainMenu_Render, 0x00598780): black body, red eyes bobbing one render
 * pixel on a sine, and a five-frame cloak crossfading forever. Layer
 * rectangles, the tick-based phase advance, the 1−f³/f alpha pair, and the
 * deliberate double-draw of each cloak frame all match the decompile —
 * fixed-pixel at the stock 2× scale, anchored bottom-left, with the cloak's
 * last 60px clipping below the fold exactly like the real menu.
 */

// Stock coordinates want a client at least 594px tall; the cloak's left
// 40px fall off the canvas edge just as they fall off the game's screen.
const W = 330
const H = 600
const TICK_MS = 1000 / 60

interface Layers {
  body: HTMLImageElement
  eyes: HTMLImageElement
  cloak: HTMLImageElement[]
}

function draw(ctx: CanvasRenderingContext2D, layers: Layers, phase: number, tick: number) {
  const theta = (tick * Math.PI) / 180
  const current = Math.floor(phase)
  const fraction = phase - current
  const next = (current + 1) % 5

  ctx.clearRect(0, 0, W, H)
  ctx.globalAlpha = 1
  ctx.drawImage(layers.body, 48, H - 494, 208, 498)
  ctx.drawImage(layers.eyes, 50, H - 370 + Math.sin(theta), 171, 30)

  const cloak = (index: number, alpha: number) => {
    const edge = index === 0 || index === 4
    const top = H - (edge ? 594 : 592)
    const height = edge ? 654 : 652
    ctx.globalAlpha = alpha
    // the game draws each selected frame twice; the doubled alpha is part of the look
    ctx.drawImage(layers.cloak[index], -40, top, 366, height)
    ctx.drawImage(layers.cloak[index], -40, top, 366, height)
  }
  cloak(current, 1 - fraction ** 3)
  cloak(next, fraction)
  ctx.globalAlpha = 1
}

export default function MenuSolomon() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let disposed = false
    let cleanupObserver = () => {}

    const load = (src: string) => {
      const img = new Image()
      img.src = src
      return img.decode().then(() => img)
    }

    Promise.all([
      load(menuSolomon.body),
      load(menuSolomon.eyes),
      ...menuSolomon.cloak.map(load),
    ]).then(([body, eyes, ...cloak]) => {
      if (disposed) return
      const layers: Layers = { body, eyes, cloak }

      if (reduced) {
        draw(ctx, layers, 0, 0)
        return
      }

      // The stock phase advance is per-tick, not per-elapsed-second; a fixed
      // 60Hz accumulator keeps a 144Hz display from billowing 2.4× too fast.
      let phase = 0
      let tick = 0
      let acc = 0
      let last = performance.now()

      const frame = (now: number) => {
        acc += Math.min(now - last, 250)
        last = now
        while (acc >= TICK_MS) {
          const theta = (tick * Math.PI) / 180
          phase = (phase + 0.025 + 0.005 * Math.sin(theta)) % 5
          tick += 1
          acc -= TICK_MS
        }
        draw(ctx, layers, phase, tick)
        raf = requestAnimationFrame(frame)
      }

      const start = () => {
        cancelAnimationFrame(raf)
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }

      // observers report their initial state, so this also starts the loop
      const observer = new IntersectionObserver(([entry]) => {
        cancelAnimationFrame(raf)
        if (entry.isIntersecting) start()
      })
      observer.observe(canvas)
      cleanupObserver = () => observer.disconnect()
    })

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      cleanupObserver()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none"
      style={{ width: W, height: H }}
    />
  )
}

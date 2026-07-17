import { useEffect, useRef } from 'react'
import { mouseFxEnabled, onMouseFx, onSpell } from './bus'
import { ATTUNEMENT_KEY, ELEMENT_PALETTES } from './grimoire'

/**
 * Arcane cursor trail: cyan motes with the occasional gold spark, additive
 * glow, gentle upward drift. Click = a small casting burst. Pre-rendered
 * glow sprites keep it cheap (no per-frame shadowBlur). Disabled for touch
 * pointers and prefers-reduced-motion.
 *
 * sd.attune("<element>") re-tints the trail to one of the eight disciplines
 * (persisted, so your wand remembers).
 */

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  gold: boolean
}

function makeGlowSprite(r: number, g: number, b: number): HTMLCanvasElement {
  const size = 32
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, `rgba(${r},${g},${b},0.9)`)
  grad.addColorStop(0.35, `rgba(${r},${g},${b},0.35)`)
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return c
}

export default function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (reduced || coarse) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let [main, spark] =
      ELEMENT_PALETTES[localStorage.getItem(ATTUNEMENT_KEY) ?? ''] ?? ELEMENT_PALETTES.arcane
    let cyan = makeGlowSprite(...main)
    let gold = makeGlowSprite(...spark)
    const offSpell = onSpell((s) => {
      if (s.spell !== 'attune') return
      ;[main, spark] = ELEMENT_PALETTES[s.element] ?? ELEMENT_PALETTES.arcane
      cyan = makeGlowSprite(...main)
      gold = makeGlowSprite(...spark)
    })

    let fxOn = mouseFxEnabled()
    const offMouseFx = onMouseFx((on) => {
      fxOn = on
      if (!on) {
        particles.length = 0
        cancelAnimationFrame(raf)
        running = false
        prev = 0
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      }
    })

    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    const particles: Particle[] = []
    let raf = 0
    let running = false
    let lastX = -1
    let lastY = -1

    const spawn = (x: number, y: number, count: number, spread: number, gold_?: boolean) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = Math.random() * spread
        particles.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.35,
          life: 0,
          maxLife: 420 + Math.random() * 480,
          size: 3 + Math.random() * 7,
          gold: gold_ ?? Math.random() < 0.14,
        })
      }
      if (particles.length > 400) particles.splice(0, particles.length - 400)
      start()
    }

    let prev = 0
    const tick = (t: number) => {
      const dt = prev ? Math.min(t - prev, 40) : 16
      prev = t
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      ctx.globalCompositeOperation = 'lighter'

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life += dt
        if (p.life >= p.maxLife) {
          particles.splice(i, 1)
          continue
        }
        p.x += p.vx * (dt / 16)
        p.y += p.vy * (dt / 16)
        p.vx *= 0.96
        p.vy = p.vy * 0.96 - 0.012 * (dt / 16)

        const k = 1 - p.life / p.maxLife
        const flicker = 0.75 + Math.sin(p.life * 0.05 + p.x) * 0.25
        const s = p.size * (0.4 + k * 0.6) * 2
        ctx.globalAlpha = k * flicker * (p.gold ? 0.95 : 0.8)
        ctx.drawImage(p.gold ? gold : cyan, p.x - s / 2, p.y - s / 2, s, s)
      }

      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'

      if (particles.length > 0) {
        raf = requestAnimationFrame(tick)
      } else {
        running = false
        prev = 0
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      }
    }

    const start = () => {
      if (!running) {
        running = true
        raf = requestAnimationFrame(tick)
      }
    }

    const onMove = (e: PointerEvent) => {
      if (!fxOn || e.pointerType !== 'mouse') return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      const dist = lastX < 0 ? 0 : Math.hypot(dx, dy)
      lastX = e.clientX
      lastY = e.clientY
      spawn(e.clientX, e.clientY, Math.min(1 + Math.floor(dist / 14), 4), 0.6)
    }

    const onDown = (e: PointerEvent) => {
      if (!fxOn || e.pointerType !== 'mouse') return
      spawn(e.clientX, e.clientY, 14, 3.2)
      spawn(e.clientX, e.clientY, 4, 2.2, true)
    }

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        running = false
        prev = 0
        particles.length = 0
      }
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      offSpell()
      offMouseFx()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[90] h-full w-full"
    />
  )
}

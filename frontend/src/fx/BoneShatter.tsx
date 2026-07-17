import { useEffect, useRef } from 'react'
import { skeletonDeath } from '../lib/assets'

/**
 * The skeleton's actual death, rebuilt from the decompile (death presenter
 * 0x0048D2A0, Anim_Bouncer 0x00453060/0x00456720, Anim_Unbind 0x00453020;
 * see skeleton-death-effects-re). There is no death animation strip — the
 * game removes the live actor and shatters it into independent objects:
 * nine shuffled bone shards from record sequence [113,115,118,121,120,119,
 * 116,117,117] (117 twice on purpose, 114 never picked), one of four skulls
 * flung at double speed, and the white unbind star 15 units above the
 * corpse. Bouncers run the game's numbers exactly: spawn displacement
 * 15–25× a 1.5x-widened radial velocity, vertical launch -(2..5), gravity
 * +0.4, bounce retention 0.65 with a 50% horizontal damp, rest below 0.75,
 * a 2.0 timer fading below 1.0 at 0.015 per active tick — and the bouncers'
 * every-third-world-tick update skip.
 */

const TICK_MS = 1000 / 60
const CANVAS_W = 640
const CANVAS_H = 480

// Normal-mode payload. The decompile also confirms an ENHANCED EFFECTS
// variant (18 shards, shadow copies, 10.0 timers) behind the game setting.
const SHARD_SEQUENCE = [113, 115, 118, 121, 120, 119, 116, 117, 117]

interface Bouncer {
  img: HTMLImageElement
  /** world position relative to the corpse; height is z drawn as a y offset */
  wx: number
  wy: number
  vx: number
  vy: number
  height: number
  vz: number
  bounce: number
  timer: number
  rot: number
  angVel: number
  scale: number
}

function spawnBouncer(img: HTMLImageElement, wx: number, wy: number, vx: number, vy: number, scale: number): Bouncer {
  const vz = -(Math.random() * 3 + 2)
  return {
    img,
    wx,
    wy,
    vx,
    vy,
    height: -Math.random() * 20,
    vz,
    bounce: vz,
    timer: 2.0,
    rot: Math.random() * 360,
    angVel: Math.random() * 10 + 1,
    scale,
  }
}

interface LoadedArt {
  shards: Record<number, HTMLImageElement>
  skulls: HTMLImageElement[]
  star: HTMLImageElement
}

let artPromise: Promise<LoadedArt> | null = null
function loadArt(): Promise<LoadedArt> {
  artPromise ??= (async () => {
    const load = (src: string) => {
      const img = new Image()
      img.src = src
      return img.decode().then(() => img)
    }
    const records = Object.keys(skeletonDeath.shards).map(Number)
    const [star, skulls, shardImgs] = await Promise.all([
      load(skeletonDeath.starFlash),
      Promise.all(skeletonDeath.skulls.map(load)),
      Promise.all(records.map((r) => load(skeletonDeath.shards[r]))),
    ])
    const shards: Record<number, HTMLImageElement> = {}
    records.forEach((r, i) => (shards[r] = shardImgs[i]))
    return { shards, skulls, star }
  })()
  return artPromise
}

export default function BoneShatter({
  x,
  y,
  scale,
  onDone,
}: {
  x: number
  y: number
  scale: number
  onDone: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = CANVAS_W * dpr
    canvas.height = CANVAS_H * dpr

    let raf = 0
    let disposed = false

    loadArt().then((art) => {
      if (disposed) return

      // presenter payload: shuffle the shard sequence, walk a 72°±10° fan
      const sequence = [...SHARD_SEQUENCE]
      for (let i = sequence.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[sequence[i], sequence[j]] = [sequence[j], sequence[i]]
      }
      const bouncers: Bouncer[] = []
      let angle = Math.random() * 360
      for (const record of sequence) {
        const rad = (angle * Math.PI) / 180
        const vx = Math.cos(rad) * 1.5
        const vy = Math.sin(rad)
        const disp = 15 + Math.random() * 10
        bouncers.push(spawnBouncer(art.shards[record], vx * disp + 2 * vx, vy * disp, vx, vy, 1.2))
        angle += 72 + (Math.random() * 20 - 10)
      }
      // the skull: straight from the corpse, double speed
      const skullRad = Math.random() * Math.PI * 2
      bouncers.push(
        spawnBouncer(
          art.skulls[Math.floor(Math.random() * art.skulls.length)],
          0,
          0,
          Math.cos(skullRad) * 2,
          Math.sin(skullRad) * 2,
          1,
        ),
      )
      const star = {
        rot: Math.random() * 360,
        alpha: 0.75,
        angVel: Math.random() < 0.5 ? -(2.5 + Math.random() * 2.5) : 5 + Math.random() * 2.5,
      }

      let tick = 0
      const step = () => {
        tick += 1
        // bouncers skip their whole update every third world tick
        if (tick % 3 !== 0) {
          for (const b of bouncers) {
            if (b.timer <= 0) continue
            b.wx += b.vx
            b.wy += b.vy
            b.height += b.vz
            b.vz += 0.4
            b.rot += b.angVel
            b.timer -= 0.015
            if (b.height >= 0) {
              b.height = 0
              b.bounce *= 0.65
              b.vz = b.bounce
              if (Math.random() < 0.5) {
                b.vx *= 0.65
                b.vy *= 0.65
              }
              if (b.bounce > -0.75) {
                b.vx = 0
                b.vy = 0
                b.vz = 0
                b.angVel = 0
              }
            }
          }
        }
        if (star.alpha > 0) {
          star.alpha -= 0.0225
          star.rot += star.angVel
        }
      }

      const render = () => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
        ctx.translate(CANVAS_W / 2, CANVAS_H / 2)
        ctx.scale(scale, scale)
        for (const b of bouncers) {
          if (b.timer <= 0) continue
          ctx.save()
          ctx.globalAlpha = Math.min(b.timer, 1)
          ctx.translate(b.wx, b.wy + b.height)
          ctx.rotate((b.rot * Math.PI) / 180)
          const w = b.img.naturalWidth * b.scale
          const h = b.img.naturalHeight * b.scale
          ctx.drawImage(b.img, -w / 2, -h / 2, w, h)
          ctx.restore()
        }
        if (star.alpha > 0) {
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = Math.min(star.alpha, 1)
          ctx.translate(0, -15)
          ctx.rotate((star.rot * Math.PI) / 180)
          ctx.drawImage(art.star, -art.star.naturalWidth / 2, -art.star.naturalHeight / 2)
          ctx.restore()
        }
      }

      let acc = 0
      let last = performance.now()
      const frame = (now: number) => {
        acc += Math.min(now - last, 250)
        last = now
        while (acc >= TICK_MS) {
          step()
          acc -= TICK_MS
        }
        render()
        if (bouncers.some((b) => b.timer > 0) || star.alpha > 0) {
          raf = requestAnimationFrame(frame)
        } else {
          onDoneRef.current()
        }
      }
      raf = requestAnimationFrame(frame)
    })

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
    }
    // a shatter is one-shot: position and scale are fixed at death
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute"
      style={{ left: x - CANVAS_W / 2, top: y - CANVAS_H / 2, width: CANVAS_W, height: CANVAS_H }}
    />
  )
}

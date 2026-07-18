import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { art } from '../lib/assets'
import BoneShatter from './BoneShatter'
import { onSpell } from './bus'
import { playSound } from './sounds'

/**
 * Wandering sprites, resurrected straight from BadGuys.png via the game's own
 * bundle metadata (tools/extract-anims.py): boneyard crawlers that shamble
 * through the home hero's graveyard, and stray library tomes that tumble across
 * the stacks. Frame strips play via steps() on
 * background-position (see strip-run in index.css).
 */

const CRAWLER = { frames: 12, w: 41, h: 64 }
const TOME = { frames: 18, w: 33, h: 44 }
const MAX_CRAWLERS = 5

function stripStyle(
  img: string,
  s: { frames: number; w: number; h: number },
  secondsPerCycle: number,
): CSSProperties {
  return {
    width: s.w,
    height: s.h,
    backgroundImage: `url(${img})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${s.w * s.frames}px ${s.h}px`,
    ['--strip-shift' as string]: `${-s.w * s.frames}px`,
    animation: `strip-run ${secondsPerCycle}s steps(${s.frames}) infinite`,
  }
}

/** Occasionally, skeletons drag themselves across the graveyard. Let them.
 * Fills its host section — the home hero mounts it over the graves. */
export function CrawlerStroll() {
  const [crawlers, setCrawlers] = useState<{
    id: number
    leftToRight: boolean
    dur: number
    top: number
    scale: number
  }[]>([])
  const [shatters, setShatters] = useState<{ id: number; x: number; y: number; scale: number }[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Set<number>())
  const activeIds = useRef(new Set<number>())
  const rootRef = useRef<HTMLDivElement>(null)

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer)
      callback()
    }, delay)
    timers.current.add(timer)
  }

  const removeCrawler = (id: number) => {
    activeIds.current.delete(id)
    setCrawlers((prev) => prev.filter((crawler) => crawler.id !== id))
  }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const scheduledTimers = timers.current
    const activeCrawlers = activeIds.current

    const spawnCrawler = () => {
      if (activeIds.current.size >= MAX_CRAWLERS) return

      const id = nextId.current++
      const dur = 26 + Math.random() * 18
      activeIds.current.add(id)
      setCrawlers((prev) => [
        ...prev,
        {
          id,
          leftToRight: Math.random() < 0.5,
          dur,
          top: 8 + Math.random() * 84,
          scale: 0.85 + Math.random() * 0.3,
        },
      ])
      schedule(() => removeCrawler(id), dur * 1000 + 500)
    }

    const spawnWave = (requestedCount?: number) => {
      const available = MAX_CRAWLERS - activeIds.current.size
      const count = Math.min(
        requestedCount ?? 1 + Math.floor(Math.random() * MAX_CRAWLERS),
        available,
      )
      let stagger = 0

      for (let index = 0; index < count; index += 1) {
        if (index > 0) stagger += Math.random() * 4_000
        schedule(spawnCrawler, stagger)
      }
    }

    const scheduleWave = (delay: number) => {
      schedule(() => {
        spawnWave()
        scheduleWave(90_000 + Math.random() * 150_000)
      }, delay)
    }
    scheduleWave(20_000 + Math.random() * 40_000)
    const offSpell = onSpell((event) => {
      if (event.spell === 'wave') spawnWave(event.count)
    })

    return () => {
      scheduledTimers.forEach(window.clearTimeout)
      scheduledTimers.clear()
      activeCrawlers.clear()
      offSpell()
    }
  }, [])

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {crawlers.map((crawler) => (
        <div
          key={crawler.id}
          className="absolute"
          style={{
            top: `${crawler.top}%`,
            ['--tx-from' as string]: crawler.leftToRight ? '-8vw' : '108vw',
            ['--tx-to' as string]: crawler.leftToRight ? '108vw' : '-8vw',
            animation: `traverse-x ${crawler.dur}s linear both`,
          }}
        >
          <div
            className="pointer-events-auto cursor-pointer"
            style={{
              ...stripStyle(art.animCrawler, CRAWLER, 1.15),
              // The unmirrored base strip reaches left; mirror it only for rightward travel.
              transform: `scale(${crawler.scale}) scaleX(${crawler.leftToRight ? -1 : 1})`,
              opacity: 0.95,
              filter: 'brightness(1.12) drop-shadow(0 0 3px rgba(214,210,150,.18)) drop-shadow(0 2px 6px rgba(0,0,0,.8))',
            }}
            title="…let it rest"
            onClick={(e) => {
              // the game's death presenter: remove the live actor and
              // scatter the bones
              // BoneShatter positions absolutely inside this section, so the
              // sprite's viewport rect must become host-relative coordinates
              const rect = e.currentTarget.getBoundingClientRect()
              const host = rootRef.current?.getBoundingClientRect()
              removeCrawler(crawler.id)
              const id = nextId.current++
              setShatters((prev) => [
                ...prev,
                {
                  id,
                  x: rect.left + rect.width / 2 - (host?.left ?? 0),
                  y: rect.top + rect.height / 2 - (host?.top ?? 0),
                  scale: crawler.scale,
                },
              ])
              playSound('skeletonDie', 0.3)
            }}
          />
        </div>
      ))}
      {shatters.map((s) => (
        <BoneShatter
          key={s.id}
          x={s.x}
          y={s.y}
          scale={s.scale}
          onDone={() => setShatters((prev) => prev.filter((p) => p.id !== s.id))}
        />
      ))}
    </div>
  )
}

/** The Library's stock does not always stay shelved. */
export function TomeFlybys() {
  const [tomes, setTomes] = useState<{
    id: number
    img: string
    top: number
    ltr: boolean
    dur: number
    incline: number
    rise: number
    scale: number
  }[]>([])
  const nextId = useRef(1)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let alive = true
    const timers: number[] = []

    const spawn = () => {
      if (!alive) return
      const id = nextId.current++
      const dur = 7 + Math.random() * 3
      const ltr = Math.random() < 0.5
      const incline = -15 + Math.random() * 30
      setTomes((prev) => [
        ...prev.slice(-1),
        {
          id,
          img: Math.random() < 0.5 ? art.animTomeBlue : art.animTomeRed,
          top: 12 + Math.random() * 55,
          ltr,
          dur,
          incline,
          rise: Math.tan((incline * Math.PI) / 180) * window.innerWidth * 1.12 * (ltr ? 1 : -1),
          scale: 0.8 + Math.random() * 0.35,
        },
      ])
      timers.push(window.setTimeout(() => {
        setTomes((prev) => prev.filter((t) => t.id !== id))
      }, dur * 1000 + 400))
    }

    const scheduleSpawn = (delay: number) => {
      timers.push(window.setTimeout(() => {
        spawn()
        scheduleSpawn(26_000 + Math.random() * 50_000)
      }, delay))
    }

    scheduleSpawn(9_000 + Math.random() * 18_000)
    const offSpell = onSpell((event) => {
      if (event.spell === 'tomefly') spawn()
    })

    return () => {
      alive = false
      timers.forEach(clearTimeout)
      offSpell()
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {tomes.map((t) => (
        <div
          key={t.id}
          className="absolute"
          style={{
            top: `${t.top}%`,
            ['--tx-from' as string]: t.ltr ? '-6vw' : '106vw',
            ['--tx-to' as string]: t.ltr ? '106vw' : '-6vw',
            ['--ty-from' as string]: `${-t.rise / 2}px`,
            ['--ty-to' as string]: `${t.rise / 2}px`,
            animation: `inclined-traverse ${t.dur}s linear both`,
          }}
        >
          <div className="[animation:float-y_2.2s_ease-in-out_infinite_alternate]">
            <div
              style={{
                ...stripStyle(t.img, TOME, 0.95),
                opacity: 0.5,
                filter: 'brightness(0.8) drop-shadow(0 3px 8px rgba(0,0,0,.7))',
                transform: `rotate(${t.incline}deg) scale(${t.scale}) scaleX(${t.ltr ? 1 : -1})`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

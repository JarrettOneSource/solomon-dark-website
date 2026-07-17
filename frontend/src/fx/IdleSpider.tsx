import { useEffect, useRef, useState } from 'react'
import { art } from '../lib/assets'
import { onSpell } from './bus'
import { playSound } from './sounds'

/**
 * Leave the page alone long enough and a spider abseils down from the top of
 * the viewport to check on you. Any input sends it scuttling back up.
 * Clicking it is inadvisable but supported.
 */

type Phase = 'down' | 'up' | 'drop'

const IDLE_MS = () => 70_000 + Math.random() * 45_000
const HANG = 150 // how far down it dangles, px

export default function IdleSpider() {
  const [spider, setSpider] = useState<{ left: number; phase: Phase } | null>(null)
  const spiderRef = useRef<typeof spider>(null)
  spiderRef.current = spider

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let idleTimer = 0
    let leaveTimer = 0

    const retreat = () => {
      clearTimeout(leaveTimer)
      setSpider((s) => (s && s.phase === 'down' ? { ...s, phase: 'up' } : s))
      window.setTimeout(() => setSpider(null), 1000)
    }

    const descend = () => {
      if (spiderRef.current) return
      clearTimeout(idleTimer)
      const next = { left: 8 + Math.random() * 80, phase: 'down' as const }
      spiderRef.current = next
      setSpider(next)
      // it gets bored on its own eventually
      leaveTimer = window.setTimeout(retreat, 45_000)
    }

    const arm = () => {
      clearTimeout(idleTimer)
      idleTimer = window.setTimeout(descend, IDLE_MS())
    }

    const onActivity = () => {
      if (spiderRef.current?.phase === 'down') retreat()
      else if (!spiderRef.current) arm()
    }

    const events = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    const offSpell = onSpell((event) => {
      if (event.spell === 'spider') descend()
    })
    arm()

    return () => {
      clearTimeout(idleTimer)
      clearTimeout(leaveTimer)
      events.forEach((e) => window.removeEventListener(e, onActivity))
      offSpell()
    }
  }, [])

  if (!spider) return null

  const y = spider.phase === 'down' ? HANG : spider.phase === 'up' ? -80 : 0

  return (
    <div
      className="fixed top-0 z-[85]"
      style={{ left: `${spider.left}%` }}
      aria-hidden
    >
      <div
        className="relative"
        style={{
          transform: spider.phase === 'drop' ? 'translateY(110vh) rotate(50deg)' : `translateY(${y}px)`,
          transition:
            spider.phase === 'down'
              ? 'transform 2.8s cubic-bezier(0.34, 1.3, 0.5, 1)'
              : spider.phase === 'up'
                ? 'transform 0.9s ease-in'
                : 'transform 1.4s cubic-bezier(0.5, 0, 0.9, 0.6)',
        }}
      >
        {spider.phase !== 'drop' && (
          <div
            className="absolute bottom-full left-1/2 h-[100vh] w-px"
            style={{
              background:
                'linear-gradient(to bottom, transparent, rgba(210,220,235,.28) 30%, rgba(210,220,235,.45))',
            }}
          />
        )}
        <img
          src={art.fxSpider}
          alt=""
          className="h-8 -translate-x-1/2 cursor-pointer [animation:spider-sway_3.4s_ease-in-out_infinite_alternate] origin-top"
          style={{ pointerEvents: spider.phase === 'down' ? 'auto' : 'none' }}
          onClick={() => {
            playSound('bonecrack', 0.3)
            setSpider((s) => (s ? { ...s, phase: 'drop' } : s))
            window.setTimeout(() => setSpider(null), 1500)
          }}
        />
      </div>
    </div>
  )
}

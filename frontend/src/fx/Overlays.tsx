import { useEffect, useRef, useState } from 'react'
import { art } from '../lib/assets'
import { castSpell, onSpell } from './bus'
import { installGrimoire } from './grimoire'
import { playSound } from './sounds'

/**
 * Site-wide secrets, mounted once in the Shell:
 *  - installs the sd.* console grimoire
 *  - konami code → the Midnight Class (plus the version tag goes unholy)
 *  - the real Boneyard tradition: at local midnight, the bell tolls
 *  - tab necromancy (the title changes while you're away)
 *  - full-screen midnight / game-over overlays for the matching spells
 */

const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA',
]

const AWAY_TITLES = [
  '☠ The class continues without you…',
  '☠ Solomon marks you absent.',
  '☠ The candles gutter…',
]

const SURGE_SPRITES = [art.fxWispPurple, art.fxWispCyan, art.fxFlame, art.fxImp]

interface SurgeGhost {
  id: number
  img: string
  left: number
  top: number
  size: number
  delay: number
}

export default function Overlays() {
  const [midnight, setMidnight] = useState(0) // key; >0 renders the overlay
  const [gameover, setGameover] = useState(0)
  const [ghosts, setGhosts] = useState<SurgeGhost[]>([])
  const nextId = useRef(1)

  useEffect(() => {
    installGrimoire()

    // -- konami --------------------------------------------------------------
    let progress = 0
    const onKey = (e: KeyboardEvent) => {
      progress = e.code === KONAMI[progress] ? progress + 1 : e.code === KONAMI[0] ? 1 : 0
      if (progress === KONAMI.length) {
        progress = 0
        document.documentElement.dataset.unholy = '1'
        window.dispatchEvent(new Event('sdr:unholy'))
        playSound('levelup', 0.3)
        castSpell({ spell: 'midnight', source: 'konami' })
      }
    }
    window.addEventListener('keydown', onKey)

    // -- the midnight bell (a Boneyard tradition) -----------------------------
    let clockTimer = 0
    const scheduleMidnight = () => {
      const now = new Date()
      const next = new Date(now)
      next.setHours(24, 0, 0, 500)
      clockTimer = window.setTimeout(() => {
        castSpell({ spell: 'midnight', source: 'clock' })
        scheduleMidnight()
      }, next.getTime() - now.getTime())
    }
    scheduleMidnight()

    // -- tab necromancy --------------------------------------------------------
    let realTitle = document.title
    const onVisibility = () => {
      if (document.hidden) {
        realTitle = document.title
        document.title = AWAY_TITLES[Math.floor(Math.random() * AWAY_TITLES.length)]
      } else {
        document.title = realTitle
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // -- overlay reactions ------------------------------------------------------
    const offSpell = onSpell((s) => {
      if (s.spell === 'midnight') {
        playSound('thunder', 0.3)
        setMidnight((k) => k + 1)
        const surge: SurgeGhost[] = Array.from({ length: 9 }, () => ({
          id: nextId.current++,
          img: SURGE_SPRITES[Math.floor(Math.random() * SURGE_SPRITES.length)],
          left: 4 + Math.random() * 90,
          top: 12 + Math.random() * 70,
          size: 26 + Math.random() * 34,
          delay: Math.random() * 1800,
        }))
        setGhosts(surge)
        window.setTimeout(() => setMidnight(0), 6200)
        window.setTimeout(() => setGhosts([]), 6400)
      } else if (s.spell === 'gameover') {
        setGameover((k) => k + 1)
        window.setTimeout(() => setGameover(0), 3400)
      }
    })

    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimeout(clockTimer)
      offSpell()
    }
  }, [])

  return (
    <>
      {midnight > 0 && (
        <div key={midnight} className="pointer-events-none fixed inset-0 z-[95]" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(100% 100% at 50% 45%, rgba(8,7,11,.55) 0%, rgba(4,3,7,.9) 100%)',
              animation: 'midnight-veil 6.2s ease-in-out both',
            }}
          />
          {ghosts.map((g) => (
            <img
              key={g.id}
              src={g.img}
              alt=""
              className="absolute"
              style={{
                left: `${g.left}%`,
                top: `${g.top}%`,
                height: g.size,
                ['--peak' as string]: 0.5,
                animation: `haunt-fade 4s ease-in-out ${g.delay}ms both`,
                filter: 'drop-shadow(0 0 10px rgba(140,170,255,.25))',
              }}
            />
          ))}
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={art.bannerMidnight}
              alt=""
              className="w-[min(70vw,520px)]"
              style={{
                animation: 'midnight-slam 6.2s ease-out both',
                filter:
                  'drop-shadow(0 0 22px rgba(65,227,255,.5)) drop-shadow(0 4px 14px rgba(0,0,0,.9))',
              }}
            />
          </div>
        </div>
      )}

      {gameover > 0 && (
        <div
          key={`go-${gameover}`}
          className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center bg-black/80"
          style={{ animation: 'gameover-flash 3.4s ease-in-out both' }}
          aria-hidden
        >
          <img src={art.gameover} alt="" className="w-72 max-w-[70vw]" />
        </div>
      )}
    </>
  )
}

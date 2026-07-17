import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { School } from '../lib/api'
import { art } from '../lib/assets'
import { mouseFxEnabled, onSpell } from './bus'
import { ATTUNEMENT_KEY } from './grimoire'

/**
 * School of Magic click effects. A wizard who has declared a school (on their
 * profile, or via sd.attune for the undeclared) casts on every click:
 *   fire  — the game's fireball burst over a concussion flash
 *   air   — a lightning bolt strikes at a random distance and bearing
 *   water — a frost ring expands while ice crystals shatter outward
 *   ether — a purple orb departs for somewhere off screen
 *   earth — the ground takes the slam: rubble is cast out on arcs and falls
 * All sprites are the game's own (tools/extract-fx.py). Pointer-events-none,
 * capped pool, disabled under prefers-reduced-motion.
 */

export const SCHOOLS: School[] = ['fire', 'air', 'water', 'ether', 'earth']

const STRIPS = {
  explosion: { frames: 4, w: 83, h: 80 },
  flash: { frames: 8, w: 56, h: 56 },
  iceBurst: { frames: 10, w: 103, h: 104 },
}

let profileSchool: School | null = null
/** Shell keeps this in sync with the signed-in user. */
export function setProfileSchool(school: School | null) {
  profileSchool = school
}

/** The latest attune event this session — the anon random deal or a manual
 * sd.attune — so clicks always match whatever the trail is currently wearing. */
let liveAttunement: string | null = null

function activeSchool(): School | null {
  if (profileSchool) return profileSchool
  const attuned = liveAttunement ?? localStorage.getItem(ATTUNEMENT_KEY)
  return SCHOOLS.includes(attuned as School) ? (attuned as School) : null
}

function stripStyle(img: string, s: { frames: number; w: number; h: number }, dur: number): CSSProperties {
  return {
    width: s.w,
    height: s.h,
    backgroundImage: `url(${img})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${s.w * s.frames}px ${s.h}px`,
    ['--strip-shift' as string]: `${-s.w * s.frames}px`,
    animation: `strip-run ${dur}s steps(${s.frames}) 1 both`,
  }
}

interface Burst {
  id: number
  school: School
  x: number
  y: number
  /** Per-burst randomness, fixed at spawn so re-renders don't rewrite fate. */
  angle: number
  dist: number
  scale: number
  flip: boolean
  /** 0–360 seed: spins the pre-rendered bursts so no two casts look alike. */
  spin: number
  /** air + ether: 1–3 strikes/orbs per click, each with its own bearing. */
  volleys: { angle: number; dist: number }[]
}

const LIFETIME: Record<School, number> = {
  fire: 700,
  air: 850, // up to two staggered follow-up strikes
  water: 900,
  ether: 1800, // staggered volley: last orb launches ~220ms in
  earth: 1100, // longest lob is ~950ms
}

export default function SchoolBursts() {
  const [bursts, setBursts] = useState<Burst[]>([])
  const nextId = useRef(1)
  const enabled = useRef(true)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      enabled.current = false
      return
    }
    const timers = new Set<number>()

    const spawn = (x: number, y: number) => {
      if (!mouseFxEnabled()) return
      const school = activeSchool()
      if (!school) return
      const id = nextId.current++
      const burst: Burst = {
        id,
        school,
        x,
        y,
        angle: Math.random() * Math.PI * 2,
        dist: 60 + Math.random() * 150,
        scale: 0.8 + Math.random() * 0.5,
        flip: Math.random() < 0.5,
        spin: Math.random() * 360,
        volleys:
          school === 'air' || school === 'ether'
            ? Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => ({
                angle: Math.random() * Math.PI * 2,
                dist: 60 + Math.random() * 150,
              }))
            : [],
      }
      setBursts((prev) => [...prev.slice(-11), burst])
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        setBursts((prev) => prev.filter((b) => b.id !== id))
      }, LIFETIME[school] + 100)
      timers.add(timer)
    }

    const onDown = (e: PointerEvent) => {
      const el = e.target as Element | null
      if (el?.closest?.('input, textarea, select')) return
      spawn(e.clientX, e.clientY)
    }
    document.addEventListener('pointerdown', onDown, { passive: true })
    const offAttune = onSpell((s) => {
      if (s.spell === 'attune') liveAttunement = s.element
    })

    return () => {
      document.removeEventListener('pointerdown', onDown)
      offAttune()
      timers.forEach(clearTimeout)
    }
  }, [])

  if (bursts.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[88] overflow-hidden" aria-hidden>
      {bursts.map((b) => (
        <div key={b.id} className="absolute" style={{ left: b.x, top: b.y }}>
          {b.school === 'fire' && <FireBurst b={b} />}
          {b.school === 'air' && <AirStrike b={b} />}
          {b.school === 'water' && <FrostRing b={b} />}
          {b.school === 'ether' && <EtherOrb b={b} />}
          {b.school === 'earth' && <RockSlam b={b} />}
        </div>
      ))}
    </div>
  )
}

function FireBurst({ b }: { b: Burst }) {
  // modest tilt only — the smoke frames have an upward character
  const tilt = (b.spin % 60) - 30
  return (
    <div style={{ transform: `translate(-50%, -50%) rotate(${tilt}deg) scale(${b.scale}) ${b.flip ? 'scaleX(-1)' : ''}` }}>
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
        style={{ ...stripStyle(art.fxFlash, STRIPS.flash, 0.4), opacity: 0.9 }}
      />
      <div
        style={{
          ...stripStyle(art.fxExplosion, STRIPS.explosion, 0.55),
          filter: 'drop-shadow(0 0 22px rgba(255,120,30,.75))',
        }}
      />
    </div>
  )
}

function AirStrike({ b }: { b: Burst }) {
  return (
    <>
      {/* 1–3 strikes, each along its own (cos, sin) bearing, staggered like
          crackling follow-ups: pivot each wrapper at the click (origin 0 0),
          rotated -90 because the sprite points along +Y at rest */}
      {b.volleys.map((bolt, i) => {
        const deg = (bolt.angle * 180) / Math.PI
        return (
          <div
            key={i}
            className="absolute left-0 top-0"
            style={{ transform: `rotate(${deg - 90}deg)`, transformOrigin: '0 0' }}
          >
            <img
              src={art.fxBolt}
              alt=""
              className="max-w-none"
              style={{
                height: bolt.dist,
                transform: 'translate(-50%, 0)',
                animation: `bolt-strike 0.6s ease-out ${i * 90}ms both`,
                filter: 'drop-shadow(0 0 14px rgba(140,220,255,.9))',
              }}
            />
          </div>
        )
      })}
      <img
        src={art.fxArc}
        alt=""
        className="absolute left-0 top-0 max-w-none"
        style={{
          height: 34,
          transform: `translate(-50%, -50%) rotate(${(b.angle * 180) / Math.PI}deg)`,
          animation: 'bolt-strike 0.45s ease-out both',
          filter: 'drop-shadow(0 0 10px rgba(140,220,255,.8))',
        }}
      />
    </>
  )
}

function FrostRing({ b }: { b: Burst }) {
  return (
    <>
      <img
        src={art.fxIceRing}
        alt=""
        className="max-w-none"
        style={{
          width: 90 * b.scale,
          transform: 'translate(-50%, -50%)',
          animation: 'ring-expand 0.9s cubic-bezier(0.16, 0.6, 0.4, 1) both',
          filter: 'sepia(1) saturate(2.6) hue-rotate(155deg) brightness(1.15) drop-shadow(0 0 12px rgba(120,210,255,.6))',
        }}
      />
      <div
        className="absolute left-0 top-0"
        style={{
          ...stripStyle(art.fxIceBurst, STRIPS.iceBurst, 0.7),
          // full random spin + mirror: the shatter is a pre-rendered game
          // animation, so this is what makes every cast spray differently
          transform: `translate(-50%,-50%) rotate(${b.spin}deg) scale(${b.scale}) ${b.flip ? 'scaleX(-1)' : ''}`,
        }}
      />
    </>
  )
}

function EtherOrb({ b }: { b: Burst }) {
  // 1–3 orbs, each flying from the click to somewhere decisively off screen
  // along its own bearing. Sum of the sides always exceeds the diagonal, so
  // no corner click can strand an orb on screen.
  const off = window.innerWidth + window.innerHeight
  return (
    <>
      {b.volleys.map((orb, i) => (
        <div
          key={i}
          className="absolute left-0 top-0"
          style={{
            ['--fx-dx' as string]: `${Math.cos(orb.angle) * off}px`,
            ['--fx-dy' as string]: `${Math.sin(orb.angle) * off}px`,
            animation: `orb-fly 1.5s cubic-bezier(0.5, 0, 0.9, 0.6) ${i * 110}ms both`,
          }}
        >
          <div style={{ transform: 'translate(-50%, -50%)' }}>
            <img
              src={art.fxWispPurple}
              alt=""
              className="max-w-none [animation:spin-slow_1.2s_linear_infinite]"
              style={{
                height: (28 + (orb.dist % 14)) * b.scale,
                filter: 'drop-shadow(0 0 16px rgba(196,120,255,.9)) saturate(1.6)',
              }}
            />
          </div>
        </div>
      ))}
    </>
  )
}

const CAST_ROCKS = [
  { img: 'fxRock1', h: 22 },
  { img: 'fxRock2', h: 17 },
  { img: 'fxRock2', h: 13 },
  { img: 'fxRock1', h: 11 },
  { img: 'fxRock2', h: 15 },
  { img: 'fxRock1', h: 10 },
] as const

function RockSlam({ b }: { b: Burst }) {
  // seeded per-rock randomness so every slam scatters differently but a
  // re-render never rewrites a burst mid-flight
  const rnd = (i: number, k: number) => (Math.sin(b.spin * 0.37 + i * 5.1 + k * 2.3) + 1) / 2
  return (
    <div style={{ transform: `scale(${b.scale})` }}>
      {/* the thud — a squashed shockwave where the ground took the hit */}
      <div
        className="absolute left-0 top-0 rounded-[100%]"
        style={{
          width: 74,
          height: 24,
          border: '2px solid rgba(196,158,96,.5)',
          boxShadow: '0 0 14px rgba(140,100,55,.55), inset 0 0 10px rgba(140,100,55,.45)',
          animation: 'slam-thud 0.45s ease-out both',
        }}
      />
      {/* rubble cast out of the crater: x and y ride separate nested layers so
          linear drift + eased rise/fall compose into a lob */}
      {CAST_ROCKS.map((r, i) => {
        const side = i % 2 === 0 ? 1 : -1
        const dur = 0.65 + rnd(i, 3) * 0.3
        return (
          <div
            key={i}
            className="absolute left-0 top-0"
            style={{
              ['--fx-dx' as string]: `${side * (28 + rnd(i, 0) * 85)}px`,
              animation: `rock-cast-x ${dur}s linear both`,
            }}
          >
            <div
              style={{
                ['--fx-peak' as string]: `${-(34 + rnd(i, 1) * 56)}px`,
                ['--fx-fall' as string]: `${46 + rnd(i, 2) * 44}px`,
                animation: `rock-cast-y ${dur}s linear both`,
              }}
            >
              <div style={{ transform: 'translate(-50%, -50%)' }}>
                <img
                  src={art[r.img]}
                  alt=""
                  className="max-w-none"
                  style={{
                    height: r.h,
                    animation: `${side < 0 ? 'spin-slow-rev' : 'spin-slow'} ${(0.55 + rnd(i, 4) * 0.4).toFixed(2)}s linear infinite`,
                    filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.7))',
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { art } from '../lib/assets'
import { onSpell } from './bus'
import type { SpellKind } from './bus'

/**
 * Ambient graveyard easter eggs for the hero: little enemies and wisps fade
 * in among the tombstones while stray spells cross the sky. Pure CSS sprite
 * animations, randomized timers, disabled under prefers-reduced-motion.
 *
 * Also answers the spell bus: console summons and casts land here, the
 * midnight bell brings a surge, and a blood moon triples the traffic.
 */

interface Haunt {
  id: number
  img: string
  left: number
  bottom: number
  height: number
  dur: number
  peak: number
}

type DetonationKind = 'fire' | 'ice'

interface SpellSpec {
  img: string
  frames: number
  w: number
  h: number
  cycle: number
  /** Direction the projectile faces in the source image, in CSS degrees. */
  restHeading: number
  filter: string
  detonation: DetonationKind | null
}

interface Detonation {
  kind: DetonationKind
  at: number
  /** Fixed per-event seed: constrained for fire, full-circle for ice. */
  spin: number
  flip: boolean
}

interface AmbientCast {
  id: number
  spell: SpellKind
  top: number
  dur: number
  ltr: boolean
  incline: number
  rise: number
  scale: number
  drift: number
  driftDur: number
  detonation: Detonation | null
  detonated: boolean
}

const GHOSTS = [
  { img: art.fxWispPurple, peak: 0.55, size: 40 },
  { img: art.fxWispCyan, peak: 0.6, size: 34 },
  { img: art.fxFlame, peak: 0.55, size: 30 },
  { img: art.fxImp, peak: 0.45, size: 26 },
  { img: art.fxSpider, peak: 0.32, size: 34 },
]

const SUMMONS: Record<string, { img: string; peak: number; size: number }> = {
  wisp: GHOSTS[0],
  flame: GHOSTS[2],
  imp: { ...GHOSTS[3], peak: 0.8 },
  spider: { ...GHOSTS[4], peak: 0.7 },
}

const SPELLS: Record<SpellKind, SpellSpec> = {
  fireball: {
    img: art.animFireball,
    frames: 1,
    w: 63,
    h: 165,
    cycle: 0,
    restHeading: -90,
    filter: 'drop-shadow(0 0 16px rgba(255,140,40,.7))',
    detonation: 'fire',
  },
  etherWisp: {
    img: art.animSpellEtherWisp,
    frames: 5,
    w: 50,
    h: 64,
    cycle: 0.5,
    restHeading: 90,
    filter: 'saturate(1.15) drop-shadow(0 0 14px rgba(198,105,255,.75))',
    detonation: null,
  },
  cyanOrb: {
    img: art.animSpellCyanOrb,
    frames: 12,
    w: 38,
    h: 36,
    cycle: 0.65,
    restHeading: 0,
    filter: 'drop-shadow(0 0 14px rgba(88,235,255,.8))',
    detonation: null,
  },
  purpleBolt: {
    img: art.fxSpellPurpleBolt,
    frames: 1,
    w: 8,
    h: 89,
    cycle: 0,
    restHeading: -90,
    filter: 'drop-shadow(0 0 10px rgba(246,90,255,.85))',
    detonation: null,
  },
  frostLance: {
    img: art.fxSpellFrostLance,
    frames: 1,
    w: 14,
    h: 65,
    cycle: 0,
    restHeading: -90,
    filter: 'drop-shadow(0 0 12px rgba(105,235,255,.9))',
    detonation: 'ice',
  },
}

const SPELL_ROSTER: SpellKind[] = ['fireball', 'etherWisp', 'cyanOrb', 'purpleBolt', 'frostLance']
const BURST_LIFETIME: Record<DetonationKind, number> = { fire: 550, ice: 700 }

function stripStyle(
  img: string,
  frames: number,
  w: number,
  h: number,
  dur: number,
  once = false,
): CSSProperties {
  return {
    width: w,
    height: h,
    backgroundImage: `url(${img})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${w * frames}px ${h}px`,
    ['--strip-shift' as string]: `${-w * frames}px`,
    animation: `strip-run ${dur}s steps(${frames}) ${once ? '1 both' : 'infinite'}`,
  }
}

function Projectile({ cast }: { cast: AmbientCast }) {
  const spell = SPELLS[cast.spell]
  const heading = cast.ltr ? cast.incline : 180 + cast.incline
  const transform = `translate(-50%, -50%) rotate(${heading - spell.restHeading}deg) scale(${cast.scale})`
  const spriteStyle: CSSProperties = spell.frames > 1
    ? stripStyle(spell.img, spell.frames, spell.w, spell.h, spell.cycle)
    : { width: spell.w, height: spell.h }

  return (
    <div
      style={cast.drift
        ? {
            ['--drift-from' as string]: `${-cast.drift}px`,
            ['--drift-to' as string]: `${cast.drift}px`,
            animation: `spell-cast-drift ${cast.driftDur}ms ease-in-out infinite alternate`,
          }
        : undefined}
    >
      {spell.frames > 1 ? (
        <div style={{ ...spriteStyle, transform, filter: spell.filter }} />
      ) : (
        <img
          src={spell.img}
          alt=""
          className="block max-w-none"
          style={{ ...spriteStyle, transform, filter: spell.filter }}
        />
      )}
    </div>
  )
}

function CastDetonation({ cast }: { cast: AmbientCast }) {
  const burst = cast.detonation
  if (!burst) return null

  if (burst.kind === 'ice') {
    return (
      <div
        style={{
          ...stripStyle(art.fxIceBurst, 10, 103, 104, 0.7, true),
          transform: `translate(-50%, -50%) rotate(${burst.spin}deg) scale(${cast.scale}) ${burst.flip ? 'scaleX(-1)' : ''}`,
        }}
      />
    )
  }

  const tilt = (burst.spin % 60) - 30
  return (
    <div
      style={{
        transform: `translate(-50%, -50%) rotate(${tilt}deg) scale(${cast.scale}) ${burst.flip ? 'scaleX(-1)' : ''}`,
      }}
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
        style={{ ...stripStyle(art.fxFlash, 8, 56, 56, 0.4, true), opacity: 0.9 }}
      />
      <div
        style={{
          ...stripStyle(art.fxExplosion, 4, 83, 80, 0.55, true),
          filter: 'drop-shadow(0 0 22px rgba(255,120,30,.75))',
        }}
      />
    </div>
  )
}

export default function AmbientHaunts() {
  const [haunts, setHaunts] = useState<Haunt[]>([])
  const [casts, setCasts] = useState<AmbientCast[]>([])
  const nextId = useRef(1)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let alive = true
    let frenzy = 1 // blood moon divides the spawn intervals
    const timers = new Set<number>()

    const schedule = (fn: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        fn()
      }, delay)
      timers.add(timer)
    }

    const spawnHaunt = (ghost?: (typeof GHOSTS)[number]) => {
      if (!alive) return
      const g = ghost ?? GHOSTS[Math.floor(Math.random() * GHOSTS.length)]
      const id = nextId.current++
      const haunt: Haunt = {
        id,
        img: g.img,
        peak: g.peak,
        left: 4 + Math.random() * 88,
        bottom: 26 + Math.random() * 130,
        height: g.size * (0.8 + Math.random() * 0.9),
        dur: 4200 + Math.random() * 2600,
      }
      setHaunts((prev) => [...prev.slice(-11), haunt])
      schedule(() => {
        setHaunts((prev) => prev.filter((h) => h.id !== id))
      }, haunt.dur + 120)
    }

    const hauntLoop = () => {
      if (!alive) return
      spawnHaunt()
      schedule(hauntLoop, (2600 + Math.random() * 4600) / frenzy)
    }

    const spawnCast = (forcedSpell?: SpellKind) => {
      if (!alive) return
      const id = nextId.current++
      const spell = forcedSpell ?? SPELL_ROSTER[Math.floor(Math.random() * SPELL_ROSTER.length)]
      const spec = SPELLS[spell]
      const ltr = Math.random() < 0.5
      const incline = -25 + Math.random() * 50
      const dur = 1400 + Math.random() * 1400
      const detonationKind = spec.detonation && Math.random() < 0.3 ? spec.detonation : null
      const detonation: Detonation | null = detonationKind
        ? {
            kind: detonationKind,
            at: 0.55 + Math.random() * 0.3,
            spin: Math.random() * 360,
            flip: Math.random() < 0.5,
          }
        : null
      const slowDrift = dur > 2200 && Math.random() < 0.65
      const cast: AmbientCast = {
        id,
        spell,
        top: 8 + Math.random() * 47,
        dur,
        ltr,
        incline,
        rise: Math.tan((incline * Math.PI) / 180) * window.innerWidth * 1.28 * (ltr ? 1 : -1),
        scale: 0.7 + Math.random() * 0.5,
        drift: slowDrift ? 3 + Math.random() * 5 : 0,
        driftDur: 650 + Math.random() * 450,
        detonation,
        detonated: false,
      }

      // Two slots total. A bus-forced cast always lands immediately by
      // replacing the oldest cast when both slots are occupied.
      setCasts((prev) => [...prev.slice(-1), cast])

      if (detonation) {
        const detonationTime = dur * detonation.at
        schedule(() => {
          setCasts((prev) => prev.map((c) => c.id === id ? { ...c, detonated: true } : c))
        }, detonationTime)
        schedule(() => {
          setCasts((prev) => prev.filter((c) => c.id !== id))
        }, detonationTime + BURST_LIFETIME[detonation.kind] + 120)
      } else {
        schedule(() => {
          setCasts((prev) => prev.filter((c) => c.id !== id))
        }, dur + 120)
      }
    }

    const castLoop = () => {
      if (!alive) return
      spawnCast()
      schedule(castLoop, (9000 + Math.random() * 11000) / frenzy)
    }

    schedule(hauntLoop, 1200)
    schedule(castLoop, 9000 + Math.random() * 11000)

    const offSpell = onSpell((s) => {
      if (s.spell === 'summon') {
        spawnHaunt(SUMMONS[s.what])
      } else if (s.spell === 'cast') {
        spawnCast(s.what ?? 'fireball')
      } else if (s.spell === 'midnight') {
        for (let i = 0; i < 7; i++) {
          schedule(() => spawnHaunt(), i * 260)
        }
      } else if (s.spell === 'bloodmoon') {
        frenzy = s.on ? 3.2 : 1
      }
    })

    return () => {
      alive = false
      timers.forEach(clearTimeout)
      offSpell()
    }
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {haunts.map((h) => (
        <img
          key={h.id}
          src={h.img}
          alt=""
          className="absolute"
          style={{
            left: `${h.left}%`,
            bottom: h.bottom,
            height: h.height,
            ['--peak' as string]: h.peak,
            animation: `haunt-fade ${h.dur}ms ease-in-out both`,
            filter: 'drop-shadow(0 0 10px rgba(140,170,255,.22))',
          }}
        />
      ))}
      {casts.map((cast) => (
        <div
          key={cast.id}
          className="absolute left-0"
          style={{
            top: `${cast.top}%`,
            ['--tx-from' as string]: cast.ltr ? '-14vw' : '114vw',
            ['--tx-to' as string]: cast.ltr ? '114vw' : '-14vw',
            ['--ty-from' as string]: `${-cast.rise / 2}px`,
            ['--ty-to' as string]: `${cast.rise / 2}px`,
            animation: `inclined-traverse ${cast.dur}ms linear both`,
            animationPlayState: cast.detonated ? 'paused' : 'running',
          }}
        >
          {cast.detonated ? <CastDetonation cast={cast} /> : <Projectile cast={cast} />}
        </div>
      ))}
    </div>
  )
}

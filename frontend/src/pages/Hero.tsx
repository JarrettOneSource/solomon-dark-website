import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { art } from '../lib/assets'
import { MOD_LOADER_DOWNLOAD_URL } from '../lib/links'
import AmbientHaunts from '../fx/Haunts'
import { CrawlerStroll } from '../fx/Critters'
import MenuSolomon from '../fx/MenuSolomon'
import { castSpell, onSpell } from '../fx/bus'
import { playSound } from '../fx/sounds'

interface Tip {
  x: number
  y: number
  epitaph: ReactNode
}

/** A gravestone that will, if lingered over, tell you who's in it. The
 * tooltip renders in the hero's own top layer — the parallax layers create
 * stacking contexts that would otherwise bury it under the plaques. */
function Grave({
  className,
  imgClass,
  src,
  filter,
  epitaph,
  onTip,
}: {
  className: string
  imgClass: string
  src: string
  filter: string
  epitaph: ReactNode
  onTip: (tip: Tip | null) => void
}) {
  return (
    <span
      className={`pointer-events-auto cursor-help ${className}`}
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        onTip({ x: r.left + r.width / 2, y: r.top, epitaph })
      }}
      onMouseLeave={() => onTip(null)}
    >
      <img src={src} alt="" className={imgClass} style={{ filter }} />
    </span>
  )
}

/**
 * The dashboard hero, composed after the game's actual main menu: Solomon's
 * cowl looming on the LEFT (mirrored so the eyes face the page), moonlit
 * clouds on the right, tombstones behind the content, and the CTAs styled as
 * the menu's gold-trimmed plaques flanked by the pentagram flourish columns.
 * All pieces are real Title.png / UI.png atlas art.
 */
export default function Hero() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [bloodMoon, setBloodMoon] = useState(false)
  const bloodMoonRef = useRef(bloodMoon)
  const moonClicks = useRef<number[]>([])
  const [unholy, setUnholy] = useState(() => document.documentElement.dataset.unholy === '1')
  const [tip, setTip] = useState<Tip | null>(null)

  useEffect(() => {
    const onUnholy = () => setUnholy(true)
    window.addEventListener('sdr:unholy', onUnholy)
    return () => window.removeEventListener('sdr:unholy', onUnholy)
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    return onSpell((event) => {
      if (event.spell !== 'bloodmoon') return
      bloodMoonRef.current = event.on
      setBloodMoon(event.on)
    })
  }, [])

  // Three quick taps on the moon and it remembers older nights.
  const onMoonClick = () => {
    const now = Date.now()
    moonClicks.current = [...moonClicks.current.filter((t) => now - t < 2500), now]
    if (moonClicks.current.length >= 3) {
      moonClicks.current = []
      const on = !bloodMoonRef.current
      bloodMoonRef.current = on
      setBloodMoon(on)
      castSpell({ spell: 'bloodmoon', on })
      if (on) playSound('thunder', 0.22)
    }
  }

  // Mouse parallax: lerp --px/--py custom props on the hero root.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (window.matchMedia('(pointer: coarse)').matches) return

    let tx = 0
    let ty = 0
    let cx = 0
    let cy = 0
    let raf = 0
    let running = false

    const tick = () => {
      cx += (tx - cx) * 0.06
      cy += (ty - cy) * 0.06
      el.style.setProperty('--px', cx.toFixed(4))
      el.style.setProperty('--py', cy.toFixed(4))
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
        raf = requestAnimationFrame(tick)
      } else {
        running = false
      }
    }
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2
      if (!running) {
        running = true
        raf = requestAnimationFrame(tick)
      }
    }
    el.addEventListener('mousemove', onMove)
    return () => {
      el.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  const layer = (depth: number) =>
    ({
      transform: `translate3d(calc(var(--px, 0) * ${depth}px), calc(var(--py, 0) * ${depth * 0.6}px), 0)`,
    }) as const

  return (
    <div ref={rootRef} className="relative min-h-[560px] overflow-hidden">
      {/* L0 — night sky + faint stars */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #0c0a18 0%, #0b0913 45%, #08070b 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 22% 28%, rgba(230,220,195,.5) 50%, transparent 51%), radial-gradient(1px 1px at 61% 14%, rgba(230,220,195,.35) 50%, transparent 51%), radial-gradient(1.5px 1.5px at 83% 42%, rgba(141,238,255,.3) 50%, transparent 51%), radial-gradient(1px 1px at 41% 51%, rgba(230,220,195,.28) 50%, transparent 51%), radial-gradient(1px 1px at 8% 64%, rgba(230,220,195,.22) 50%, transparent 51%)',
          backgroundSize: '420px 420px',
        }}
      />

      {/* L1 — drifting clouds (masked so their sprite edges dissolve) */}
      <div className="pointer-events-none absolute inset-0" style={layer(5)}>
        <img
          src={art.cloudsBlue}
          alt=""
          className="absolute -right-10 top-6 w-[58%] opacity-[0.09] mix-blend-screen [animation:sway-x_90s_ease-in-out_infinite_alternate]"
          style={{
            maskImage: 'radial-gradient(ellipse 55% 50% at 50% 50%, black 25%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(ellipse 55% 50% at 50% 50%, black 25%, transparent 72%)',
          }}
        />
        <img
          src={art.cloudsPurple}
          alt=""
          className="absolute -left-10 top-20 w-[52%] opacity-20 [animation:sway-x_70s_ease-in-out_infinite_alternate-reverse]"
          style={{
            maskImage: 'radial-gradient(ellipse 55% 50% at 50% 50%, black 25%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(ellipse 55% 50% at 50% 50%, black 25%, transparent 72%)',
          }}
        />
      </div>

      {/* L2 — the moon, in the clouds on the right like the menu */}
      <div className="pointer-events-none absolute inset-0" style={layer(9)}>
        <img
          src={art.moon}
          alt=""
          onClick={onMoonClick}
          className="pointer-events-auto absolute right-[10%] top-[8%] hidden h-28 sm:block [animation:float-y_14s_ease-in-out_infinite_alternate]"
          style={{
            filter: bloodMoon
              ? 'sepia(1) saturate(3) hue-rotate(-42deg) brightness(0.9) drop-shadow(0 0 38px rgba(255,64,40,.55))'
              : 'drop-shadow(0 0 34px rgba(220,228,255,.35))',
            transition: 'filter 1.8s ease',
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-[1800ms]"
        style={{
          background: 'radial-gradient(90% 80% at 78% 18%, rgba(160,20,12,.28) 0%, rgba(60,8,8,.12) 55%, transparent 100%)',
          opacity: bloodMoon ? 1 : 0,
        }}
      />

      {/* L3 — gravestones across the field, each with its resident (the cowl
          returns once we've decompiled how the game assembles its menu
          composite) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56" style={layer(-7)}>
        <Grave className="absolute bottom-2 left-[3%]" src={art.graveCeltic} imgClass="h-28 opacity-70" filter="brightness(0.4) blur(1px)"
          epitaph={<>Lucritius the Fire Mage<br />burned bright. Then just burned.</>} onTip={setTip} />
        <Grave className="absolute bottom-0 left-[17%] hidden sm:block" src={art.graveArch} imgClass="h-24 opacity-80" filter="brightness(0.35)"
          epitaph={<>Athicus the Diviner<br />“did not see it coming”</>} onTip={setTip} />
        <Grave className="absolute bottom-0 left-[31%]" src={art.obelisk} imgClass="h-40 opacity-90" filter="brightness(0.32)"
          epitaph={<>Solomon Dark<br />2015 – 2016<br />did not stay buried</>} onTip={setTip} />
        <Grave className="absolute bottom-0 left-[45%] hidden md:block" src={art.graveRip} imgClass="h-14 opacity-60" filter="brightness(0.4) blur(1px)"
          epitaph={<>Reserved.</>} onTip={setTip} />
        <Grave className="absolute bottom-1 right-[28%] hidden md:block" src={art.graveCross2} imgClass="h-20 opacity-70" filter="brightness(0.38) blur(0.5px)"
          epitaph={<>Magnus the Unprepared<br />brought a knife to a wizard fight</>} onTip={setTip} />
        <Grave className="absolute bottom-0 right-[14%] hidden sm:block" src={art.graveArchSmall} imgClass="h-24 opacity-80" filter="brightness(0.34)"
          epitaph={<>The Boneyards<br />now accepting residents</>} onTip={setTip} />
        <Grave className="absolute bottom-1 right-[3%]" src={art.graveCelticSwirl} imgClass="h-24 opacity-70" filter="brightness(0.4) blur(1px)"
          epitaph={<>our beloved beta testers<br />they knew the risks</>} onTip={setTip} />
      </div>

      {/* L3.5 — ambient haunts: enemies fading in and out, spell flybys,
          and the crawler waves shambling among the graves */}
      <AmbientHaunts />
      <CrawlerStroll />

      {/* L4 — the man himself, watching from the left exactly as the game's
          menu renders him; fog and grass wash over his hem. Slightly reduced
          on lg screens so he and the menu keep their distance */}
      <div className="absolute bottom-0 left-0 hidden origin-bottom-left lg:block lg:max-xl:scale-[0.78]">
        <MenuSolomon />
      </div>

      {/* epitaph tooltip — fixed, above every hero layer */}
      {tip && (
        <div
          className="text-fell pointer-events-none fixed z-30 w-max max-w-[240px] -translate-x-1/2 -translate-y-full rounded border border-gold/30 bg-[#0d0b12]/95 px-3 py-1.5 text-center text-[13px] leading-snug text-gold/90 shadow-[0_4px_18px_rgba(0,0,0,.8)]"
          style={{ left: tip.x, top: tip.y - 10, animation: 'reveal-up 0.25s ease-out both' }}
        >
          {tip.epitaph}
        </div>
      )}

      {/* L5 — fog (radially masked so tile edges never band) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 mix-blend-screen" style={layer(11)}>
        <img
          src={art.fog1}
          alt=""
          className="absolute -left-[8%] bottom-[-30%] w-[75%] opacity-20 blur-md [animation:sway-x_46s_ease-in-out_infinite_alternate]"
          style={{
            maskImage: 'radial-gradient(ellipse 50% 45% at 50% 55%, black 20%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse 50% 45% at 50% 55%, black 20%, transparent 70%)',
          }}
        />
        <img
          src={art.fog2}
          alt=""
          className="absolute -right-[4%] bottom-[-34%] w-[70%] opacity-[0.17] blur-lg [animation:sway-x_58s_ease-in-out_infinite_alternate-reverse]"
          style={{
            maskImage: 'radial-gradient(ellipse 50% 45% at 50% 55%, black 20%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse 50% 45% at 50% 55%, black 20%, transparent 70%)',
          }}
        />
      </div>

      {/* L6 — grass silhouette + fade into the page (decorative overlays must
          not eat the pointer — the moon and graves below are interactive) */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-9"
        style={{
          backgroundImage: `url(${art.grassStrip})`,
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'bottom',
          backgroundSize: 'auto 100%',
          filter: 'brightness(0.45)',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent to-abyss" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_20%,transparent_55%,rgba(8,7,11,.75)_100%)]" />

      {/* The forbidden version tag appears only during the unholy easter egg. */}
      {unholy && (
        <div className="absolute right-5 top-4 z-10 text-right font-display text-[11px] font-bold uppercase tracking-[0.25em] text-blood" style={{ textShadow: '0 0 12px rgba(212,58,58,.7)' }}>
          V.6.66 Beta
          <span className="block text-[9px] tracking-[0.3em] text-blood/80">Unholy</span>
        </div>
      )}

      {/* content — centered, menu-style stack (pointer-events pass through the
          transparent wrapper so the moon and gravestones stay clickable).
          min-h instead of a hard hero height: short screens grow the hero
          around the menu rather than clipping it */}
      <div className="pointer-events-none relative z-10 mx-auto flex min-h-[92vh] max-w-6xl items-center justify-center px-4 sm:px-6">
        <div className="pointer-events-auto flex w-full max-w-[560px] flex-col items-center pb-16 pt-8 text-center lg:max-xl:scale-[0.94]">
          <p className="kicker mb-5">Raptisoft’s lost game · raised from the dead</p>

          {/* the real title-screen logo, with a one-time shimmer sweep */}
          <div className="relative w-full max-w-[300px] sm:max-w-[440px]">
            <img
              src={art.logoSolomonDark}
              alt="Solomon Dark"
              className="w-full drop-shadow-[0_6px_24px_rgba(0,0,0,.8)]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                WebkitMaskImage: `url(${art.logoSolomonDark})`,
                maskImage: `url(${art.logoSolomonDark})`,
                WebkitMaskSize: '100% 100%',
                maskSize: '100% 100%',
                background:
                  'linear-gradient(105deg, transparent 38%, rgba(255,244,214,.85) 50%, transparent 62%)',
                backgroundSize: '260% 100%',
                animation: 'shimmer-move 7s ease 0.7s infinite',
              }}
            />
          </div>

          <div
            className="mt-3 font-display text-lg font-bold uppercase tracking-[0.6em] text-arcane sm:text-xl"
            style={{ textShadow: '0 0 18px rgba(65,227,255,.55)' }}
          >
            Revived
          </div>

          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-bone/90">
            The third Solomon game never made it to launch. We dug it up —{' '}
            <span className="text-gold-bright">multiplayer</span>, a{' '}
            <span className="text-gold-bright">Lua modding grimoire</span>, and{' '}
            <span className="text-gold-bright">cloud saves</span> for the beta Raptisoft
            left behind.
          </p>

          {/* menu plaques, flanked by the gold flourish columns from UI.png */}
          <div className="relative mt-8 w-full max-w-[360px]">
            <img
              src={art.flourishVert}
              alt=""
              className="absolute -left-16 top-1/2 hidden h-[105%] -translate-y-1/2 opacity-70 sm:block"
            />
            <img
              src={art.flourishVert}
              alt=""
              className="absolute -right-16 top-1/2 hidden h-[105%] opacity-70 sm:block"
              style={{ transform: 'translateY(-50%) scaleX(-1)' }}
            />
            <div className="flex flex-col gap-2.5">
              <a href="https://discord.gg/HGHxZgyM2p" target="_blank" rel="noreferrer" className="btn-plaque btn-plaque-beacon">
                Join the Discord
              </a>
              <a
                href={MOD_LOADER_DOWNLOAD_URL}
                target="_blank"
                rel="noreferrer"
                title="Download the mod loader from GitHub"
                className="btn-plaque"
              >
                Download the Mod Loader
              </a>
              <Link to="/mods" className="btn-plaque">
                The Library
              </Link>
              <Link to="/classes" className="btn-plaque">
                Classes in Session
              </Link>
              <Link to="/about" className="btn-plaque">
                The Revival Story
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

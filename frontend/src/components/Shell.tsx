import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import CursorTrail from '../fx/CursorTrail'
import Overlays from '../fx/Overlays'
import IdleSpider from '../fx/IdleSpider'
import SchoolBursts, { SCHOOLS, setProfileSchool } from '../fx/SchoolBursts'
import { ATTUNEMENT_KEY } from '../fx/grimoire'
import SolomonScurry from '../fx/SolomonScurry'
import { castSpell, mouseFxEnabled, setMouseFxEnabled } from '../fx/bus'
import { isSfxMuted, toggleSfxMuted } from '../fx/audio'
import {
  currentTrack,
  ensureStarted,
  isMuted,
  startJukeboxLifecycle,
  toggleMuted,
  uiClick,
  uiHover,
  uiPage,
} from '../fx/jukebox'
import { useAuth } from '../lib/auth'
import { art } from '../lib/assets'
import '../game/game-surface.css'

// The site is the door to the web port: Search Parties and the Library
// live in-game now (the Dark Cloud), so they no longer get tabs. Their
// routes stay for deep links and the Account page's mod management. The Boneyard
// editor is a maker's tool, reached from the footer passages.
//
const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/game', label: 'Play' },
  { to: '/about', label: 'About' },
]

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative px-1 py-2 font-display text-[13px] font-bold uppercase tracking-[0.18em] transition-colors ${
          isActive ? 'text-gold-bright' : 'text-bone-dim hover:text-bone'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {label}
          <span
            className={`absolute inset-x-0 -bottom-px h-px transition-opacity ${
              isActive
                ? 'bg-gradient-to-r from-transparent via-arcane to-transparent opacity-100 shadow-[0_0_8px_rgba(65,227,255,.8)]'
                : 'opacity-0'
            }`}
          />
        </>
      )}
    </NavLink>
  )
}

const SFX_TARGETS = 'a, button, select, [role="button"]'

/** One button of the header's effects rail: lit gold when on, struck through
 * and dimmed when off. */
function FxToggle({
  on,
  glyph,
  label,
  title,
  onClick,
}: {
  on: boolean
  glyph: string
  label: string
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={title}
      className={`rounded border px-2 py-1.5 font-display text-sm leading-none transition-colors ${
        on
          ? 'border-gold/30 text-gold hover:border-gold/60'
          : 'border-bone-dim/25 text-bone-dim/50 hover:border-bone-dim/50 hover:text-bone-dim'
      }`}
    >
      <span className={on ? '' : 'line-through'}>{glyph}</span>
    </button>
  )
}

export default function Shell() {
  const { user, loading: authLoading, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [quiet, setQuiet] = useState(isMuted)
  const [sfxQuiet, setSfxQuiet] = useState(isSfxMuted)
  const [wandOn, setWandOn] = useState(mouseFxEnabled)
  const location = useLocation()

  // The Boneyard editor takes the whole viewport: no chrome, no wandering
  // critters, and the wand grounds itself so the pointer stays a pointer.
  const workshop = location.pathname.startsWith('/boneyard')
  const game = location.pathname === '/game'

  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo({ top: 0 })
    if (!game) uiPage()
  }, [game, location.pathname])

  useEffect(() => {
    if (game) return
    return startJukeboxLifecycle()
  }, [game])

  // A declared School of Magic follows the wizard: click effects + wand tint.
  // Anonymous wanderers get dealt a random school's tint each visit — a taste
  // of the disciplines until they enroll (a manual sd.attune choice wins, and
  // the deal lasts only until the next page load).
  useEffect(() => {
    setProfileSchool(user?.school ?? null)
    if (user?.school) {
      castSpell({ spell: 'attune', element: user.school })
    } else if (!authLoading && !user && !localStorage.getItem(ATTUNEMENT_KEY)) {
      castSpell({ spell: 'attune', element: SCHOOLS[Math.floor(Math.random() * SCHOOLS.length)] })
    }
  }, [user, authLoading])

  // The public-site jukebox wakes on the first gesture; delegated UI sounds
  // cover public pages while /game retains its native scene-owned mapping.
  useEffect(() => {
    if (game) return
    const unlock = () => ensureStarted()
    let lastHovered: Element | null = null
    const onOver = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(SFX_TARGETS) ?? null
      if (el && el !== lastHovered) uiHover()
      lastHovered = el
    }
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.(SFX_TARGETS)) uiClick()
    }
    window.addEventListener('pointerdown', unlock, { capture: true })
    window.addEventListener('keydown', unlock, { capture: true })
    document.addEventListener('pointerover', onOver, { passive: true })
    document.addEventListener('pointerdown', onDown, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true })
      window.removeEventListener('keydown', unlock, { capture: true })
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [game])

  if (game) {
    return (
      <main
        className="game-surface h-dvh overflow-hidden"
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
      >
        <Outlet />
      </main>
    )
  }

  if (workshop) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden">
        <Overlays />
        <main className="min-h-0 flex-1">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <CursorTrail />
      <Overlays />
      <IdleSpider />
      <SchoolBursts />
      <SolomonScurry />

      <header className="sticky top-0 z-50 border-b border-gold/15 bg-abyss/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3" aria-label="Solomon Darker — home">
            <img src={art.skullGold} alt="" className="h-7 w-auto drop-shadow-[0_0_8px_rgba(200,168,98,.4)]" />
            <span className="font-display text-sm font-bold uppercase tracking-[0.2em] text-gold">
              Solomon Darker
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-6 md:flex">
            {NAV.map((n) => (
              <NavItem key={n.to} {...n} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 md:ml-6">
            {/* the effects rail: music, sound effects, and the wand cursor —
                each a per-device choice that persists across visits */}
            <div className="flex items-center gap-1.5" role="group" aria-label="Effects">
              <FxToggle
                on={!quiet}
                glyph="♪"
                label={quiet ? 'Unmute music' : 'Mute music'}
                title={
                  quiet
                    ? 'Turn the music on'
                    : `Turn the music off${currentTrack() ? ` (now playing: ${currentTrack()})` : ''}`
                }
                onClick={() => setQuiet(toggleMuted())}
              />
              <FxToggle
                on={!sfxQuiet}
                glyph="✷"
                label={sfxQuiet ? 'Unmute sound effects' : 'Mute sound effects'}
                title={sfxQuiet ? 'Turn sound effects on' : 'Turn sound effects off'}
                onClick={() => setSfxQuiet(toggleSfxMuted())}
              />
              <FxToggle
                on={wandOn}
                glyph={'☄︎'}
                label={wandOn ? 'Disable cursor effects' : 'Enable cursor effects'}
                title={
                  wandOn
                    ? 'Turn cursor effects off'
                    : 'Turn cursor effects on'
                }
                onClick={() => {
                  setMouseFxEnabled(!wandOn)
                  setWandOn(!wandOn)
                }}
              />
            </div>
            <Link
              to="/game"
              className="btn btn-gold hidden !px-3.5 !py-2.5 !text-[11px] sm:inline-flex"
            >
              Play
            </Link>
            {user ? (
              <div className="hidden items-center gap-2 md:flex">
                <Link
                  to="/account"
                  className="flex items-center gap-2 rounded border border-gold/25 bg-crypt px-3 py-1.5 text-sm text-gold-bright transition-colors hover:border-gold/60"
                >
                  <img src={art.skullWhite} alt="" className="h-4 w-auto opacity-80" />
                  {user.username}
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="text-xs uppercase tracking-wider text-bone-dim hover:text-blood"
                  title="Sign out"
                >
                  ✕
                </button>
              </div>
            ) : (
              <Link to="/login" className="hidden text-[13px] font-display font-bold uppercase tracking-[0.15em] text-bone-dim hover:text-gold-bright md:block">
                Sign in
              </Link>
            )}
            <button
              type="button"
              className="hidden max-md:inline-flex items-center rounded border border-gold/25 bg-crypt px-3 py-2 text-bone hover:border-gold/60"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              ☰
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-gold/15 bg-abyss/95 px-6 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              {NAV.map((n) => (
                <NavItem key={n.to} {...n} />
              ))}
              {user ? (
                <>
                  <NavItem to="/account" label="Account" />
                  <button
                    type="button"
                    onClick={logout}
                    className="w-fit px-1 py-2 text-left font-display text-[13px] font-bold uppercase tracking-[0.18em] text-bone-dim"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <NavItem to="/login" label="Sign in" />
              )}
              <Link
                to="/game"
                className="btn btn-gold w-fit !text-[11px]"
              >
                Play
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-24 border-t border-gold/15 bg-[#0a090e]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <img src={art.skullGold} alt="" className="h-8" />
              <span className="font-display text-sm font-bold uppercase tracking-[0.18em] text-gold">
                Solomon Darker
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-bone-dim">
              A fan preservation project — not affiliated with Raptisoft. Original game content
              © Raptisoft. Please keep any property damage down to an absolute minimum.
            </p>
          </div>
          <div>
            <div className="kicker mb-3">Passages</div>
            <ul className="space-y-2 text-sm">
              <li><Link to="/boneyard" className="link-arcane">The Boneyard</Link></li>
              <li><Link to="/boneyards" className="link-arcane">Boneyard Viewer</Link></li>
              <li><Link to="/about" className="link-arcane">The Revival Story</Link></li>
              <li>
                <a href="https://discord.gg/HGHxZgyM2p" target="_blank" rel="noreferrer" className="link-arcane">
                  Discord ↗
                </a>
              </li>
              <li>
                <a href="https://github.com/JayMcArthur/Raptisoft-Solomon" target="_blank" rel="noreferrer" className="link-arcane">
                  Preservation archive ↗
                </a>
              </li>
            </ul>
          </div>
          <div className="md:text-right">
            <p className="text-fell text-sm leading-relaxed text-gold/70">
              “Find Solomon Dark, and deal with him.”
              <br />
              <span className="text-bone-dim">— the Archchancellor, over brandy</span>
            </p>
            <p className="mt-6 font-mono text-[11px] text-bone-dim/60">
              beta 0.72.5 · web port
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

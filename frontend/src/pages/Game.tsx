import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Reveal from '../fx/Reveal'
import { ErrorNote, SectionHead } from '../components/ui'
import { art, skillIcons } from '../lib/assets'
import { MOD_LOADER_DOWNLOAD_URL } from '../lib/links'
import {
  ENGINE_STATUS,
  OFFLINE_BUILD_URL,
  bootGame,
  type GameSession,
  type Transport,
} from '../game/engine'

const ready = ENGINE_STATUS === 'ready'

/**
 * The three doors.
 *
 * They are three *distributions* of one game, not three games: same
 * simulation, same server, only the transport differs. See game/engine.ts —
 * the union there is the whole architecture in six lines.
 */
const DOORS = [
  {
    key: 'browser' as const,
    icon: skillIcons.door,
    kicker: 'No install',
    title: 'In the Browser',
    body:
      'Open a tab and you are in the Boneyard. The simulation runs right here — nothing to download, nothing to patch, and your account carries your runs into the Annals.',
  },
  {
    key: 'offline' as const,
    icon: skillIcons.bag,
    kicker: 'Yours to keep',
    title: 'Offline & Standalone',
    body:
      'A self-contained build that needs neither this website nor a connection. It is the same game with the server running inside it, so a lost domain never costs anyone their copy.',
  },
  {
    key: 'server' as const,
    icon: skillIcons.infinity,
    kicker: 'Play together',
    title: 'Dedicated Servers',
    body:
      'Point the game at a host and drop into a persistent world with other wizards. Anyone can run one — the server is the same build, minus the drawing.',
  },
]

/**
 * Honest status for the reconstruction, in the order the pieces have to land.
 * Sourced from the gap register in docs/browser-rebuild-roadmap.md; update it
 * here as campaigns close so the page never overstates what works.
 */
const RECONSTRUCTION = [
  { label: 'Assets & data tables', note: 'Sprites, boneyards, waves, nav grids — extracted and machine-readable.', state: 'done' },
  { label: 'Movement, tick & RNG', note: 'The integrator, the tick graph, and the native random stream.', state: 'active' },
  { label: 'Spells & projectiles', note: 'Every element, the earth charge curve, damage application.', state: 'active' },
  { label: 'Enemies, loot & progression', note: 'Behavior trees, drop tables, levelling.', state: 'queued' },
  { label: 'Renderer & audio parity', note: 'Frame cadence, atlases, the score.', state: 'queued' },
  { label: 'Netcode & dedicated hosting', note: 'Authoritative server, prediction, the public build.', state: 'queued' },
] as const

const STATE_BADGE: Record<string, { cls: string; label: string }> = {
  done: { cls: 'badge badge-moss', label: 'Reversed' },
  active: { cls: 'badge badge-arcane', label: 'In progress' },
  queued: { cls: 'badge badge-bone', label: 'Queued' },
}

export default function Game() {
  const [transport, setTransport] = useState<Transport | null>(null)
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sessionRef = useRef<GameSession | null>(null)

  const leave = useCallback(() => {
    sessionRef.current?.destroy()
    sessionRef.current = null
    setTransport(null)
  }, [])

  // Unlisted until the owner says otherwise: nothing links here, and a crawler
  // that finds the URL anyway is told not to index it. Drop this effect when
  // the game is announced.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  // The session owns the canvas for as long as the surface is mounted. Tearing
  // down on unmount matters more than usual here: a leaked loop keeps a GPU
  // context and a socket alive behind every other page on the site.
  useEffect(() => {
    if (!transport) return
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    setError(null)

    bootGame({ canvas, transport, onFatal: (e) => setError(e.message) })
      .then((session) => {
        if (cancelled) {
          session.destroy()
          return
        }
        sessionRef.current = session
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })

    return () => {
      cancelled = true
      sessionRef.current?.destroy()
      sessionRef.current = null
    }
  }, [transport])

  // Escape leaves the table.
  useEffect(() => {
    if (!transport) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [transport, leave])

  if (transport) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-abyss">
        <div className="flex items-center gap-4 border-b border-gold/15 px-4 py-2">
          <span className="kicker">
            {transport.kind === 'remote' ? `Connected — ${transport.url}` : 'Local table'}
          </span>
          <button type="button" onClick={leave} className="btn btn-stone ml-auto !px-3 !py-2 !text-[11px]">
            Leave
          </button>
        </div>
        <div className="relative min-h-0 flex-1">
          <canvas ref={canvasRef} className="h-full w-full" />
          {error && (
            <div className="absolute inset-x-0 bottom-0 p-4">
              <ErrorNote message={error} />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ---------- the gate ---------- */}
      <section className="relative overflow-hidden border-b border-gold/15">
        {/* The moon sits behind the veil; the graveyard stands in front of it,
            so the silhouettes still read against the dark. */}
        <div className="pointer-events-none absolute inset-0">
          <img src={art.moon} alt="" className="absolute right-[8%] top-8 h-28 opacity-70 sm:h-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-abyss/60 via-abyss/80 to-abyss/95" />
          <img src={art.graveArch} alt="" className="absolute -bottom-1 left-[4%] h-28 opacity-25 sm:h-44" />
          <img src={art.graveCeltic} alt="" className="absolute -bottom-1 left-[19%] h-20 opacity-20 sm:h-28" />
          <img src={art.graveRip} alt="" className="absolute -bottom-1 right-[30%] h-14 opacity-[0.16] sm:h-20" />
          <img src={art.graveCross1} alt="" className="absolute -bottom-1 right-[14%] h-20 opacity-20 sm:h-28" />
          <img src={art.fog1} alt="" className="absolute inset-x-0 bottom-0 w-full opacity-20" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-abyss" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="kicker mb-3">Three ways in</div>
          <h1 className="h-display text-3xl leading-tight sm:text-5xl">Play Solomon Dark</h1>
          <p className="text-fell mt-5 max-w-2xl text-base leading-relaxed text-bone-dim sm:text-lg">
            The College is being rebuilt from the ground up to run anywhere — in a browser tab, as a
            copy you own outright, or on a server full of other wizards. One game, three doors, and
            no wrong one.
          </p>

          {/* No dead gold button: until the engine ships, the honest primary
              action is to go read what is actually finished. */}
          <div className="mt-9 flex flex-wrap items-center gap-3">
            {ready && (
              <button
                type="button"
                onClick={() => setTransport({ kind: 'local' })}
                className="btn btn-gold"
                title="Start a table in this tab"
              >
                Play in the browser
              </button>
            )}
            <a href="#doors" className={ready ? 'btn btn-stone' : 'btn btn-gold'}>
              The three doors
            </a>
          </div>

          {!ready && (
            <p className="mt-6 flex items-center gap-2 font-mono text-[11px] tracking-wide text-bone-dim/70">
              <span className="orb orb-hub" />
              Engine under reconstruction — every door here opens the moment it lands.
            </p>
          )}
        </div>
      </section>

      {/* ---------- the three doors ---------- */}
      <section id="doors" className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionHead kicker="Pick your way" title="Three doors, one game" />
        </Reveal>

        <div className="grid gap-5 md:grid-cols-3">
          {DOORS.map((door, i) => (
            <Reveal key={door.key} delay={i * 90}>
              <div className="panel panel-ornate flex h-full flex-col gap-4 p-6">
                <div className="flex items-center gap-3">
                  <img src={door.icon} alt="" className="h-8 w-auto opacity-85" />
                  <div>
                    <div className="kicker">{door.kicker}</div>
                    <h3 className="h-display text-base">{door.title}</h3>
                  </div>
                </div>

                <p className="text-fell flex-1 text-sm leading-relaxed text-bone-dim">{door.body}</p>

                {/* Doors show their real control once there is something behind
                    them, and a plain status line before that — a greyed-out
                    button reads as "broken", which is not what this is. */}
                {!ready || (door.key === 'offline' && !OFFLINE_BUILD_URL) ? (
                  <div className="flex items-center gap-2 border-t border-gold/10 pt-4 font-mono text-[11px] tracking-wide text-bone-dim/60">
                    <span className="orb orb-veiled" />
                    {door.key === 'browser' && 'Opens when the engine lands'}
                    {door.key === 'offline' && 'No standalone build published yet'}
                    {door.key === 'server' && 'Hosting tools ship with the engine'}
                  </div>
                ) : door.key === 'server' ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const url = address.trim()
                      if (url) setTransport({ kind: 'remote', url })
                    }}
                    className="flex flex-col gap-2"
                  >
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="wss://your-server:7777"
                      aria-label="Server address"
                      className="input"
                    />
                    <button type="submit" disabled={!address.trim()} className="btn btn-stone w-full">
                      Connect
                    </button>
                  </form>
                ) : door.key === 'browser' ? (
                  <button
                    type="button"
                    onClick={() => setTransport({ kind: 'local' })}
                    className="btn btn-gold w-full"
                  >
                    Enter the Boneyard
                  </button>
                ) : OFFLINE_BUILD_URL ? (
                  <a href={OFFLINE_BUILD_URL} className="btn btn-stone w-full">
                    Download the standalone
                  </a>
                ) : null}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- what is actually finished ---------- */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionHead
            kicker="No guesswork"
            title="What the reconstruction has reached"
            action={
              <Link to="/about" className="link-arcane text-sm">
                The revival story
              </Link>
            }
          />
        </Reveal>

        <Reveal>
          <p className="text-fell mb-6 max-w-3xl text-sm leading-relaxed text-bone-dim">
            Nothing here is a re-imagining. Each system is read out of the original game first —
            the exact constants, the exact tick order — and the rebuild is checked against recorded
            traces from the real thing, so a wizard walks and a boulder lands the way they always did.
          </p>
        </Reveal>

        <Reveal>
          <div className="panel divide-y divide-gold/10">
            {RECONSTRUCTION.map((row) => {
              const badge = STATE_BADGE[row.state]
              return (
                <div key={row.label} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-sm tracking-wide text-bone">{row.label}</div>
                    <div className="text-fell mt-0.5 text-sm text-bone-dim">{row.note}</div>
                  </div>
                  <span className={badge.cls}>{badge.label}</span>
                </div>
              )
            })}
          </div>
        </Reveal>

        <Reveal>
          <div className="panel panel-ornate mt-10 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
            <img src={art.skullGold} alt="" className="h-10 w-auto opacity-80" />
            <p className="text-fell flex-1 text-sm leading-relaxed text-bone-dim">
              Want the original instead? The Windows game plus the mod loader still run the way they
              always have, with live co-op and the whole Library behind them.
            </p>
            <a href={MOD_LOADER_DOWNLOAD_URL} target="_blank" rel="noreferrer" className="btn btn-stone shrink-0">
              Get the mod loader
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  )
}

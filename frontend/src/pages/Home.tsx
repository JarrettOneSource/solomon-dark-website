import { useState } from 'react'
import { Link } from 'react-router-dom'
import Hero from './Hero'
import Reveal from '../fx/Reveal'
import LobbyPasswordDialog from '../components/LobbyPasswordDialog'
import LobbyTable from '../components/LobbyTable'
import PopularStrip from '../components/PopularStrip'
import { EmptyState, SectionHead, Spinner, StatTile } from '../components/ui'
import { api, type Lobby } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useLobbies } from '../lib/useLobbies'
import { useAuth } from '../lib/auth'
import { art, skillIcons } from '../lib/assets'
import { formatCount } from '../lib/format'

const FEATURES = [
  {
    icon: skillIcons.door,
    title: 'Classes in Session',
    body:
      'Live co-op through the SDR loader, with a master list of open matches. Bring a study group — the dead grade on a curve. Prefer privacy? Plain Steam P2P works without the site at all.',
    to: '/classes',
    label: 'See who’s in session',
  },
  {
    icon: skillIcons.book,
    title: 'The Lua Grimoire',
    body:
      'An embedded Lua runtime exposing the sd.* API. Community tomes install through the loader in one click — browse the shelf, tap, play.',
    to: '/mods',
    label: 'Enter the Library',
  },
  {
    icon: skillIcons.bag,
    title: 'Cloud Saves',
    body:
      'Your runs, immortalized in the Annals. An SDR account syncs save slots across machines, so no wizard dies of a misplaced hard drive.',
    to: '/account',
    label: 'Open the Annals',
  },
]

export default function Home() {
  const { user } = useAuth()
  const stats = useApi(() => api.stats(), [], 30_000)
  const lobbies = useLobbies()
  const [knock, setKnock] = useState<Lobby | null>(null)

  const liveLobbies = (lobbies.data?.items ?? []).slice(0, 5)

  return (
    <div>
      <Hero />

      {/* live stats strip — straddles the hero's fade on larger screens; on
          phones it stays below the fold. The reach into the hero (56px) is
          less than the menu column's pb-16, so it can never cover a plaque */}
      <div className="relative z-20 mx-auto mt-6 max-w-6xl px-4 sm:-mt-14 sm:px-6">
        <Reveal>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile
              icon={skillIcons.door}
              value={stats.data?.matchesLive ?? null}
              label="Classes in session"
              loading={stats.loading}
            />
            <StatTile
              icon={skillIcons.hat}
              value={stats.data?.wizardsOnline ?? null}
              label="Wizards in the field"
              loading={stats.loading}
            />
            <StatTile
              icon={skillIcons.book}
              value={stats.data?.tomes ?? null}
              label="Tomes in the Library"
              loading={stats.loading}
            />
            <StatTile
              icon={skillIcons.bag}
              value={stats.data ? formatCount(stats.data.downloadsTotal) : null}
              label="Tomes taken"
              loading={stats.loading}
            />
          </div>
        </Reveal>
      </div>

      {/* the revival */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <SectionHead kicker="What this is" title="The Revival" />
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 90}>
              <Link
                to={f.to}
                className="panel panel-ornate group block h-full p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/45"
              >
                <div
                  className="mb-5 flex h-14 w-14 items-center justify-center rounded-sm border border-gold/30 bg-[#0d0b12]"
                  style={{ boxShadow: 'inset 0 0 14px rgba(0,0,0,.8), 0 0 12px rgba(200,168,98,.1)' }}
                >
                  <img src={f.icon} alt="" className="h-9 w-9 object-contain" />
                </div>
                <h3 className="h-display text-base">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-bone-dim">{f.body}</p>
                <span className="link-arcane mt-4 inline-block text-xs uppercase tracking-[0.15em]">
                  {f.label} →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* classes in session */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionHead
            kicker="Live from the college"
            title="Classes in Session"
            action={
              <Link to="/classes" className="link-arcane text-xs uppercase tracking-[0.15em]">
                Join a class →
              </Link>
            }
          />
          {lobbies.loading ? (
            <Spinner label="Fetching classes…" />
          ) : lobbies.error ? (
            <EmptyState title="The crystal ball is cloudy" line={lobbies.error} />
          ) : liveLobbies.length === 0 ? (
            <EmptyState
              title="No classes in session"
              line="Solomon, for the record, is not resting. Host one from the SDR loader’s multiplayer card."
            />
          ) : (
            <LobbyTable lobbies={liveLobbies} onKnock={setKnock} />
          )}
        </Reveal>
      </section>

      {/* in heavy circulation */}
      <PopularStrip
        className="mx-auto mt-24 max-w-6xl px-4 sm:px-6"
        action={
          <Link to="/mods" className="link-arcane text-xs uppercase tracking-[0.15em]">
            Enter the Library →
          </Link>
        }
      />

      {/* the story so far */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <div className="panel panel-ornate overflow-hidden">
          <div className="grid gap-8 p-8 sm:p-10 md:grid-cols-[1.2fr_1fr]">
            <Reveal>
              <div>
                <div className="kicker mb-1.5">Ten. Dead. Mages.</div>
                <h2 className="h-display text-xl sm:text-2xl">The Story So Far</h2>
                <div className="prose-sdr mt-2 text-[15px]">
                  <p>
                    In 2015, after years of anticipation, Raptisoft confirmed{' '}
                    <em>Solomon Dark</em> — the third Solomon game — would never be
                    finished. On Halloween 2016 the unfinished beta escaped for a
                    single day, and fans mirrored it before midnight. This project
                    keeps those builds alive: a mod loader, an embedded Lua runtime,
                    Steam multiplayer, and this hall of records.
                  </p>
                  <p>
                    And because the fray shouldn’t depend on any one website, SDR also
                    speaks plain Steam P2P — host and invite friends directly, no
                    account required, even if this place ever goes dark.
                  </p>
                </div>
                <Link to="/about" className="btn btn-stone mt-6">
                  The Full Revival Story
                </Link>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <ul className="space-y-4 border-l border-gold/20 pl-6 text-sm">
                {[
                  ['2010', 'Solomon’s Keep enchants the App Store in April; Solomon’s Boneyard rises that September.'],
                  ['2015', 'Raptisoft confirms Solomon Dark will never be finished. The tower goes quiet.'],
                  ['2016', 'The unfinished beta escapes for one Halloween. Fans preserve it before midnight.'],
                  ['2022', 'A community archive gathers the surviving builds — 0.71.0, 0.72.0, 0.72.5.'],
                  ['2026', 'The SDR project awakens: Lua runtime, Steam multiplayer, this site. You are here.'],
                ].map(([year, line]) => (
                  <li key={year} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-2 w-2 rounded-full bg-gold shadow-[0_0_8px_rgba(200,168,98,.8)]" />
                    <span className="font-mono text-xs text-gold">{year}</span>
                    <p className="mt-0.5 leading-snug text-bone-dim">{line}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* enroll CTA */}
      <section className="mx-auto mt-24 max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          <img src={art.gargoyle} alt="" className="mx-auto mb-4 h-20 opacity-50" />
          {user ? (
            <>
              <h2 className="h-display text-xl">Welcome back, {user.username}</h2>
              <p className="text-fell mx-auto mt-3 max-w-md text-bone-dim">
                The Annals are keeping your place. Your saves and tomes await.
              </p>
              <Link to="/account" className="btn btn-gold mt-6">
                Open the Annals
              </Link>
            </>
          ) : (
            <>
              <h2 className="h-display text-xl">Enroll at the College</h2>
              <p className="text-fell mx-auto mt-3 max-w-md text-bone-dim">
                An SDR account gets you cloud saves, a place in the Annals, and the
                right to contribute tomes to the Library. Tuition is free. Survival is
                not guaranteed.
              </p>
              <Link to="/register" className="btn btn-gold mt-6">
                Enroll — it’s free
              </Link>
            </>
          )}
        </Reveal>
      </section>

      {knock && <LobbyPasswordDialog lobby={knock} onClose={() => setKnock(null)} />}
    </div>
  )
}

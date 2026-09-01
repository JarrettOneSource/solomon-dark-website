import { Link } from 'react-router-dom'
import Hero from './Hero'
import Reveal from '../fx/Reveal'
import PopularStrip from '../components/PopularStrip'
import { SectionHead, StatTile } from '../components/ui'
import { api } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useAuth } from '../lib/auth'
import { art, skillIcons } from '../lib/assets'
import { formatCount } from '../lib/format'

const FEATURES = [
  {
    icon: skillIcons.door,
    title: 'Search Parties',
    body:
      'Live browser co-op in one shared hub. Meet in the Courtyard, inspect another player, and form a party before taking on Solomon Dark.',
    to: '/game',
    label: 'Enter the Hub',
  },
  {
    icon: skillIcons.book,
    title: 'Lua Modding',
    body:
      'Build, browse, and play community Lua mods through the Dark Cloud.',
    to: '/game',
    label: 'Open the Dark Cloud',
  },
  {
    icon: skillIcons.bag,
    title: 'Cloud Saves',
    body:
      'A Solomon Darker account syncs save slots across machines, so no run dies of a misplaced hard drive.',
    to: '/account',
    label: 'Manage your account',
  },
]

export default function Home() {
  const { user } = useAuth()
  const stats = useApi(() => api.stats(), [], 30_000)

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
              label="Live parties"
              loading={stats.loading}
            />
            <StatTile
              icon={skillIcons.hat}
              value={stats.data?.wizardsOnline ?? null}
              label="Players online"
              loading={stats.loading}
            />
            <StatTile
              icon={skillIcons.book}
              value={stats.data?.tomes ?? null}
              label="Mods published"
              loading={stats.loading}
            />
            <StatTile
              icon={skillIcons.bag}
              value={stats.data ? formatCount(stats.data.downloadsTotal) : null}
              label="Mod downloads"
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

      {/* search parties */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionHead kicker="Live right now" title="Search Parties" />
          <div className="panel panel-ornate flex flex-wrap items-center gap-5 p-6">
            <img src={skillIcons.door} alt="" className="h-12 w-12" />
            <p className="text-fell min-w-0 flex-1 text-bone-dim">
              Browse parties in Play or the Dark Cloud, enter a Party ID, or invite
              the player standing beside you in the Courtyard.
            </p>
            <Link to="/game" className="btn btn-gold">Join Party</Link>
          </div>
        </Reveal>
      </section>

      {/* in heavy circulation */}
      <PopularStrip className="mx-auto mt-24 max-w-6xl px-4 sm:px-6" />

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
                    turns the preserved evidence into an authoritative web port with
                    subscribed Lua mods, browser multiplayer, and this hall of records.
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
                  ['2026', 'The Solomon Darker web port awakens: subscribed mods, browser multiplayer, and cloud saves. You are here.'],
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
                Your saves and mods are right where you left them.
              </p>
              <Link to="/account" className="btn btn-gold mt-6">
                Open your account
              </Link>
            </>
          ) : (
            <>
              <h2 className="h-display text-xl">Create an Account</h2>
              <p className="text-fell mx-auto mt-3 max-w-md text-bone-dim">
                A Solomon Darker account gets you cloud saves synced across machines and
                the right to publish your own mods. It costs nothing. Survival is
                not guaranteed.
              </p>
              <Link to="/register" className="btn btn-gold mt-6">
                Create account
              </Link>
            </>
          )}
        </Reveal>
      </section>

    </div>
  )
}

import { Link } from 'react-router-dom'
import Hero from './Hero'
import Reveal from '../fx/Reveal'
import PopularStrip from '../components/PopularStrip'
import { StatTile } from '../components/ui'
import { api } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useAuth } from '../lib/auth'
import { art, skillIcons } from '../lib/assets'
import { formatCount } from '../lib/format'

const FEATURES = [
  {
    icon: skillIcons.door,
    title: 'Multiplayer',
    body:
      'Meet other wizards in the Courtyard and form a party to take on Solomon Dark.',
    to: '/game',
    label: 'Play',
  },
  {
    icon: skillIcons.book,
    title: 'Lua Modding',
    body:
      'Create Lua mods and custom Boneyards, or try what other players have made.',
    to: '/mods',
    label: 'Browse mods',
  },
  {
    icon: skillIcons.bag,
    title: 'Cloud Saves',
    body:
      'Keep your progress across devices with a Solomon Darker account.',
    to: '/account',
    label: 'Your account',
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        <h2 className="h-display mb-6 text-xl sm:text-2xl">Back from the Dead</h2>
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

      {/* in heavy circulation */}
      <PopularStrip className="mx-auto mt-24 max-w-6xl px-4 sm:px-6" />

      {/* the story so far */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="panel panel-ornate p-8 sm:p-10">
            <div className="kicker mb-1.5">Ten. Dead. Mages.</div>
            <h2 className="h-display text-xl sm:text-2xl">The Revival Story</h2>
            <p className="text-fell mt-3 max-w-2xl text-bone-dim">
              Raptisoft left <em>Solomon Dark</em> unfinished. Fans preserved the
              beta. Solomon Darker brings it back to the browser.
            </p>
            <Link to="/about" className="btn btn-stone mt-6">
              Read the story
            </Link>
          </div>
        </Reveal>
      </section>

      {/* enroll CTA */}
      <section className="mx-auto mt-24 max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          <img src={art.gargoyle} alt="" className="mx-auto mb-4 h-20 opacity-50" />
          {user ? (
            <>
              <h2 className="h-display text-xl">Welcome back, {user.username}</h2>
              <Link to="/account" className="btn btn-gold mt-6">
                Open your account
              </Link>
            </>
          ) : (
            <>
              <h2 className="h-display text-xl">Create an Account</h2>
              <p className="text-fell mx-auto mt-3 max-w-md text-bone-dim">
                Save your progress and publish your own mods.
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

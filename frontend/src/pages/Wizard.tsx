import { Link, useParams } from 'react-router-dom'
import Reveal from '../fx/Reveal'
import ModCard from '../components/ModCard'
import { EmptyState, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { useApi } from '../lib/useApi'
import { art, elementWords } from '../lib/assets'
import { formatCount, formatDate } from '../lib/format'

/** A wizard's public page in the Annals: who they are, what they've shelved. */
export default function Wizard() {
  const { username = '' } = useParams()
  const profile = useApi(() => api.users.get(username), [username])

  if (profile.loading) return <Spinner label="Consulting the Annals…" />
  if (profile.error || !profile.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <img src={art.skullWhite} alt="" className="mx-auto mb-4 h-12 opacity-60" />
        <h1 className="h-display text-xl">No such wizard</h1>
        <p className="text-fell mt-2 text-bone-dim">
          {profile.error ?? 'The Annals contain no one by that name. Perhaps they never enrolled. Perhaps worse.'}
        </p>
        <Link to="/mods" className="btn btn-stone mt-6">
          ← Back to the Library
        </Link>
      </div>
    )
  }

  const { user, modCount, downloadsTotal, mods } = profile.data

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <Reveal>
        <div className="panel panel-ornate flex flex-wrap items-center gap-6 p-6 sm:p-8">
          <div
            className="flex h-20 w-20 flex-none items-center justify-center rounded-sm border border-gold/40 bg-[#0b0910]"
            style={{ boxShadow: 'inset 0 0 18px rgba(0,0,0,.85), 0 0 16px rgba(200,168,98,.15)' }}
          >
            <img src={art.skullWhite} alt="" className="h-12 opacity-80" />
          </div>
          <div className="min-w-0">
            <div className="kicker mb-1">From the Annals</div>
            <div className="flex items-center gap-3">
              <h1 className="h-display text-2xl">{user.username}</h1>
              {user.school && (
                <img
                  src={elementWords[user.school]}
                  alt={user.school}
                  title={`School of ${user.school}`}
                  className="h-5"
                />
              )}
            </div>
            <p className="mt-1 text-sm text-bone-dim">Enrolled {formatDate(user.createdAtUtc)}</p>
          </div>
          <div className="ml-auto flex gap-6 text-right">
            <div>
              <div className="h-display text-2xl leading-none">{modCount}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-bone-dim">
                tome{modCount === 1 ? '' : 's'}
              </div>
            </div>
            <div>
              <div className="h-display text-2xl leading-none">{formatCount(downloadsTotal)}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-bone-dim">taken</div>
            </div>
          </div>
        </div>
      </Reveal>

      <section className="mt-12">
        <Reveal>
          <div className="kicker mb-1.5">Shelved under their name</div>
          <h2 className="h-display text-xl">Contributions to the Library</h2>
        </Reveal>
        <div className="mt-6">
          {mods.length === 0 ? (
            <EmptyState
              title="No tomes yet"
              line="A wizard of theory, not practice. The Librarian reserves judgment."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mods.map((m, i) => (
                <Reveal key={m.id} delay={Math.min(i, 6) * 60}>
                  <ModCard mod={m} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

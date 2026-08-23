import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Reveal from '../fx/Reveal'
import { ErrorNote, Spinner, TagBadge } from '../components/ui'
import {
  api,
  ApiError,
  type ModSummary,
  type School,
  type WebGameSave,
} from '../lib/api'
import { useApi } from '../lib/useApi'
import { useAuth } from '../lib/auth'
import { art, elementWords } from '../lib/assets'
import { SCHOOLS } from '../fx/SchoolBursts'
import { formatBytes, formatCount, formatDate, timeAgo } from '../lib/format'

const SCHOOL_LORE: Record<School, string> = {
  fire: 'Every click, a small act of arson.',
  air: 'The sky takes your side. Loudly.',
  water: 'Cold. Patient. Expanding outward.',
  ether: 'Somewhere, something purple departs.',
  earth: 'You leave rubble. It’s a statement.',
}

function SchoolPicker() {
  const { user, refresh } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!user) return null

  const declare = async (school: School) => {
    setBusy(true)
    setError(null)
    try {
      // clicking your own school renounces it
      await api.setSchool(user.school === school ? null : school)
      await refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Saving your school choice failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-12">
      <Reveal>
        <div className="kicker mb-1.5">Declared to the faculty</div>
        <h2 className="h-display text-xl">School of Magic</h2>
        <p className="text-fell mt-2 max-w-2xl text-sm text-bone-dim">
          Declare a school and your wand follows you around the site — cursor, click,
          and all. Other players will see it beside your name. Click your school again
          to renounce it.
        </p>
      </Reveal>
      <div className="mt-6 flex flex-wrap gap-3">
        {SCHOOLS.map((s) => {
          const active = user.school === s
          return (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => declare(s)}
              aria-pressed={active}
              title={SCHOOL_LORE[s]}
              className={`flex min-w-28 flex-col items-center gap-2 rounded border px-5 py-4 transition-all ${
                active
                  ? 'border-arcane/70 bg-arcane/10 shadow-[0_0_16px_rgba(65,227,255,.3)]'
                  : 'border-gold/20 bg-[#0b0910] opacity-60 hover:opacity-100'
              }`}
            >
              <img src={elementWords[s]} alt={s} className="h-5" />
              {active && <span className="text-[10px] uppercase tracking-[0.2em] text-arcane">declared</span>}
            </button>
          )
        })}
      </div>
      {user.school && (
        <p className="text-fell mt-3 text-sm text-bone-dim">{SCHOOL_LORE[user.school]}</p>
      )}
      {error && <div className="mt-3"><ErrorNote message={error} /></div>}
    </section>
  )
}

function BrowserGameSaveSlot({
  save,
  onChanged,
}: {
  save: WebGameSave | null
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const remove = async () => {
    if (!save || !window.confirm('Erase browser save I from the cloud?')) return
    setBusy(true)
    try {
      await api.gameSaves.remove(save.slot, save.revision)
      onChanged()
    } catch (error) {
      alert(error instanceof ApiError ? error.message : 'Failed to erase')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel panel-ornate flex min-h-36 max-w-sm flex-col p-4">
      <div className="flex items-start justify-between">
        <span className="font-display text-lg text-gold">I</span>
        <span className="font-mono text-[10px] text-bone-dim/60">
          {save ? `revision ${save.revision} · ${formatBytes(save.size)}` : 'empty'}
        </span>
      </div>
      <div className="mt-1 font-display text-sm font-bold tracking-wide text-bone">
        Browser Game
      </div>
      <div className="mt-0.5 text-xs text-bone-dim">
        {save ? `saved ${timeAgo(save.updatedAtUtc)}` : 'Unwritten'}
      </div>
      {save ? (
        <button
          type="button"
          className="mt-auto self-start pt-3 text-[11px] uppercase tracking-wider text-blood/80 hover:text-blood"
          onClick={remove}
          disabled={busy}
        >
          erase
        </button>
      ) : null}
    </div>
  )
}

export default function Account() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true })
  }, [user, loading, navigate])

  const browserSave = useApi(
    () => user ? api.gameSaves.get(0) : Promise.resolve(null),
    [user?.id],
  )
  // The public index has no author filter, so pull one page and filter client-side.
  const mods = useApi(() => api.mods.list({ pageSize: 50, sort: 'newest' }), [user?.id])

  if (loading || !user) return <Spinner label="Loading your account…" />

  const myMods: ModSummary[] = (mods.data?.items ?? []).filter((m) => m.author.id === user.id)

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
            <div className="kicker mb-1">Your account</div>
            <div className="flex items-center gap-3">
              <h1 className="h-display text-2xl">{user.username}</h1>
              {user.school && <img src={elementWords[user.school]} alt={user.school} title={`School of ${user.school}`} className="h-5" />}
            </div>
            <p className="mt-1 text-sm text-bone-dim">Joined {formatDate(user.createdAtUtc)}</p>
          </div>
          <button type="button" onClick={() => { logout(); navigate('/') }} className="btn btn-stone ml-auto">
            Sign out
          </button>
        </div>
      </Reveal>

      <SchoolPicker />

      {/* Memoratorium — cloud saves */}
      <section className="mt-12">
        <Reveal>
          <div className="kicker mb-1.5">Runs on record</div>
          <h2 className="h-display text-xl">Cloud Saves</h2>
          <p className="text-fell mt-2 max-w-2xl text-sm text-bone-dim">
            The browser game writes slot I automatically while you play.
          </p>
        </Reveal>
        <div className="mt-6">
          {browserSave.loading ? (
            <Spinner label="Opening browser save I…" />
          ) : browserSave.error ? (
            <ErrorNote message={browserSave.error} />
          ) : (
            <BrowserGameSaveSlot save={browserSave.data} onChanged={browserSave.reload} />
          )}
        </div>
      </section>

      {/* My mods */}
      <section className="mt-12">
        <Reveal>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="kicker mb-1.5">Authored works</div>
              <h2 className="h-display text-xl">My Mods</h2>
            </div>
            <Link to="/mods/upload" className="btn btn-gold !py-2.5 !text-[11px]">
              ✦ Upload a Mod
            </Link>
          </div>
        </Reveal>
        <div className="mt-6 space-y-2">
          {mods.loading ? (
            <Spinner label="Loading your mods…" />
          ) : myMods.length === 0 ? (
            <div className="slab rounded px-5 py-6 text-center text-sm text-bone-dim">
              You haven’t uploaded any mods yet.
            </div>
          ) : (
            myMods.map((m) => (
              <div key={m.id} className="slab flex flex-wrap items-center gap-x-5 gap-y-2 rounded px-4 py-3">
                <Link to={`/mods/${m.slug}`} className="font-display text-sm font-bold tracking-wide text-bone hover:text-gold-bright">
                  {m.name}
                </Link>
                {m.tags.slice(0, 2).map((tag) => (
                  <TagBadge key={tag} tag={tag} />
                ))}
                <span className="badge badge-gold">v{m.latestVersion}</span>
                <span className="font-mono text-xs text-bone-dim">↓ {formatCount(m.downloads)}</span>
                <span className="text-xs text-bone-dim/70">updated {timeAgo(m.updatedAtUtc)}</span>
                <Link to={`/mods/${m.slug}`} className="link-arcane ml-auto text-[11px] uppercase tracking-wider">
                  manage
                </Link>
              </div>
            ))
          )}
        </div>
      </section>

    </div>
  )
}

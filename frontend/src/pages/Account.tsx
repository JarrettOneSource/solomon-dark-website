import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Reveal from '../fx/Reveal'
import { ErrorNote, Spinner, TagBadge } from '../components/ui'
import { api, ApiError, type CloudSave, type ModSummary, type School } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useAuth } from '../lib/auth'
import { art, elementWords } from '../lib/assets'
import { SCHOOLS } from '../fx/SchoolBursts'
import { formatBytes, formatCount, formatDate, timeAgo } from '../lib/format'

const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7]
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

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
      setError(e instanceof ApiError ? e.message : 'The College mislaid your declaration.')
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
          and all. Other wizards will see it beside your name. Click your school again
          to renounce it (the faculty will pretend not to mind).
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

function SteamRegistrar() {
  const { user, refresh } = useAuth()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const consumedResult = useRef(false)

  // Steam's OpenID round-trip lands back here with ?steamLink=<result>.
  useEffect(() => {
    if (consumedResult.current) return
    const result = searchParams.get('steamLink')
    if (!result) return
    consumedResult.current = true
    if (result === 'linked') {
      setNote('Your Steam self is now on record.')
      refresh()
    } else if (result === 'conflict') {
      setError('That Steam profile is already bound to another wizard.')
    } else {
      setError('Steam declined the ritual. Try the link again.')
    }
    searchParams.delete('steamLink')
    setSearchParams(searchParams, { replace: true })
  }, [searchParams, setSearchParams, refresh])

  if (!user) return null

  const link = async () => {
    setBusy(true)
    setError(null)
    try {
      const start = await api.steam.link('/account')
      window.location.assign(start.authorizationUrl)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The Registrar’s door stuck. Try again.')
      setBusy(false)
    }
  }

  const unlink = async () => {
    if (!window.confirm('Strike your Steam profile from the record? Friends-only classes and warded-lobby tickets will stop working until you relink.')) return
    setBusy(true)
    setError(null)
    try {
      await api.steam.unlink()
      setNote(null)
      await refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The record resisted erasure. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-12">
      <Reveal>
        <div className="kicker mb-1.5">The Registrar</div>
        <h2 className="h-display text-xl">Steam Linkage</h2>
        <p className="text-fell mt-2 max-w-2xl text-sm text-bone-dim">
          Bind your Steam self to your SDR account. The Registrar uses it to show you
          friends-only classes and to cut join tickets for warded ones. The rite happens
          on Steam’s own doorstep — no password changes hands here.
        </p>
      </Reveal>
      <div className="mt-6">
        {user.steamId ? (
          <div className="slab flex flex-wrap items-center gap-x-5 gap-y-2 rounded px-4 py-3">
            <span className="badge badge-arcane">Linked</span>
            <span className="font-mono text-xs text-bone-dim">{user.steamId}</span>
            <a
              href={`https://steamcommunity.com/profiles/${user.steamId}`}
              target="_blank"
              rel="noreferrer"
              className="link-arcane text-[11px] uppercase tracking-wider"
            >
              view profile
            </a>
            <button
              type="button"
              className="ml-auto text-[11px] uppercase tracking-wider text-blood/80 hover:text-blood"
              onClick={unlink}
              disabled={busy}
            >
              unlink
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-gold" onClick={link} disabled={busy}>
            {busy ? 'Opening Steam…' : 'Link Steam profile'}
          </button>
        )}
        {note && <p className="mt-3 text-sm text-moss">{note}</p>}
        {error && <div className="mt-3"><ErrorNote message={error} /></div>}
      </div>
    </section>
  )
}

async function downloadSave(slot: number, name: string | null) {
  const res = await fetch(api.saves.downloadUrl(slot), {
    headers: { Authorization: `Bearer ${localStorage.getItem('sdr.token') ?? ''}` },
  })
  if (!res.ok) throw new ApiError(res.status, 'Could not fetch the save')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(name ?? `slot-${slot + 1}`).replace(/[^\w-]+/g, '_')}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

function SaveSlot({ slot, save, onChanged }: { slot: number; save?: CloudSave; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)

  if (!save) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center rounded border border-dashed border-gold/15 bg-[#0b0910]/60 p-4 text-center">
        <div className="font-display text-lg text-gold/25">{ROMAN[slot]}</div>
        <div className="text-fell mt-1 text-xs text-bone-dim/50">Unwritten</div>
      </div>
    )
  }

  const remove = async () => {
    if (!window.confirm(`Erase save ${ROMAN[slot]} (“${save.name ?? 'unnamed'}”) from the Annals?`)) return
    setBusy(true)
    try {
      await api.saves.remove(slot)
      onChanged()
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Failed to erase')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel panel-ornate flex min-h-36 flex-col p-4">
      <div className="flex items-start justify-between">
        <span className="font-display text-lg text-gold">{ROMAN[slot]}</span>
        <span className="font-mono text-[10px] text-bone-dim/60">
          {save.fileCount} files · {formatBytes(save.size)}
        </span>
      </div>
      <div className="mt-1 truncate font-display text-sm font-bold tracking-wide text-bone" title={save.name ?? undefined}>
        {save.name ?? 'Unnamed run'}
      </div>
      <div className="mt-0.5 text-xs text-bone-dim">{timeAgo(save.updatedAtUtc)}</div>
      <div className="mt-auto flex items-center gap-3 pt-3">
        <button
          type="button"
          className="link-arcane text-[11px] uppercase tracking-wider"
          onClick={() => downloadSave(slot, save.name).catch((e) => alert(e.message))}
        >
          download
        </button>
        <button
          type="button"
          className="text-[11px] uppercase tracking-wider text-blood/80 hover:text-blood"
          onClick={remove}
          disabled={busy}
        >
          erase
        </button>
      </div>
    </div>
  )
}

export default function Account() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true })
  }, [user, loading, navigate])

  const saves = useApi(
    () => user?.steamId ? api.saves.list() : Promise.resolve<CloudSave[]>([]),
    [user?.id, user?.steamId],
  )
  // v1: no author filter on the mods API yet — pull a page and filter client-side.
  const mods = useApi(() => api.mods.list({ pageSize: 50, sort: 'newest' }), [user?.id])

  if (loading || !user) return <Spinner label="Consulting the Annals…" />

  const myMods: ModSummary[] = (mods.data?.items ?? []).filter((m) => m.author.id === user.id)
  const saveBySlot = new Map((saves.data ?? []).map((s) => [s.slot, s]))

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
            <div className="kicker mb-1">As recorded in the Annals</div>
            <div className="flex items-center gap-3">
              <h1 className="h-display text-2xl">{user.username}</h1>
              {user.school && <img src={elementWords[user.school]} alt={user.school} title={`School of ${user.school}`} className="h-5" />}
            </div>
            <p className="mt-1 text-sm text-bone-dim">Enrolled {formatDate(user.createdAtUtc)}</p>
          </div>
          <button type="button" onClick={() => { logout(); navigate('/') }} className="btn btn-stone ml-auto">
            Sign out
          </button>
        </div>
      </Reveal>

      <SteamRegistrar />

      <SchoolPicker />

      {/* Memoratorium — cloud saves */}
      <section className="mt-12">
        <Reveal>
          <div className="kicker mb-1.5">Runs on record</div>
          <h2 className="h-display text-xl">Cloud Saves</h2>
          <p className="text-fell mt-2 max-w-2xl text-sm text-bone-dim">
            Eight launcher-owned local saves, backed up here after they change. The
            launcher always plays from disk; the Annals keep a downloadable ZIP copy.
          </p>
        </Reveal>
        <div className="mt-6">
          {!user.steamId ? (
            <div className="slab rounded px-5 py-6 text-sm text-bone-dim">
              Cloud saves are disabled until this account is linked to Steam above.
            </div>
          ) : saves.loading ? (
            <Spinner label="Unlocking the vault…" />
          ) : saves.error ? (
            <ErrorNote message={saves.error} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SLOTS.map((slot) => (
                <SaveSlot key={slot} slot={slot} save={saveBySlot.get(slot)} onChanged={saves.reload} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* My tomes */}
      <section className="mt-12">
        <Reveal>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="kicker mb-1.5">Authored works</div>
              <h2 className="h-display text-xl">My Tomes</h2>
            </div>
            <Link to="/mods/upload" className="btn btn-gold !py-2.5 !text-[11px]">
              ✦ Contribute a Tome
            </Link>
          </div>
        </Reveal>
        <div className="mt-6 space-y-2">
          {mods.loading ? (
            <Spinner label="Fetching your shelf…" />
          ) : myMods.length === 0 ? (
            <div className="slab rounded px-5 py-6 text-center text-sm text-bone-dim">
              You haven’t contributed any tomes yet. The Librarian is trying not to look
              disappointed.
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

      {/* game sync hint */}
      <section className="mt-12">
        <Reveal>
          <div className="flex items-start gap-4 rounded border border-gold/15 bg-[#0b0910] p-5">
            <img src={art.parchment} alt="" className="h-14 flex-none opacity-80" />
            <div>
              <div className="font-display text-xs font-bold uppercase tracking-[0.18em] text-gold/80">
                Syncing from the game
              </div>
              <p className="mt-1 text-sm leading-relaxed text-bone-dim">
                Link your Steam profile above, then open the launcher while signed into
                that Steam account. It detects the linkage automatically—no website
                password is stored in the launcher.
              </p>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}

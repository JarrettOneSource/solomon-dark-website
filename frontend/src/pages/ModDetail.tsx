import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Reveal from '../fx/Reveal'
import { ErrorNote, Field, Spinner, TypeBadge } from '../components/ui'
import { api, ApiError } from '../lib/api'
import type { ModDetail as ModDetailShape } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useAuth } from '../lib/auth'
import { formatBytes, formatCount, formatDate, timeAgo } from '../lib/format'
import { art, elementWords } from '../lib/assets'
import { playSound } from '../fx/sounds'

/** Marginalia — notes other wizards left in this tome's margins. */
function Marginalia({ mod }: { mod: ModDetailShape }) {
  const { user } = useAuth()
  const comments = useApi(() => api.mods.comments.list(mod.slug), [mod.slug])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    setError(null)
    try {
      await api.mods.comments.add(mod.slug, body.trim())
      setBody('')
      comments.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The margin rejected your note.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: number) => {
    try {
      await api.mods.comments.remove(mod.slug, id)
      comments.reload()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to erase the note')
    }
  }

  const items = comments.data?.items ?? []

  return (
    <div className="mt-8">
      <div className="kicker mb-3">Marginalia · notes in the margin</div>
      {comments.loading ? (
        <Spinner label="Deciphering handwriting…" />
      ) : items.length === 0 ? (
        <div className="slab rounded px-5 py-6 text-center text-sm text-bone-dim">
          No notes yet. The margins are pristine — suspiciously so.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <div key={c.id} className="slab rounded px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  to={`/wizards/${encodeURIComponent(c.author.username)}`}
                  className="font-display text-[13px] font-bold tracking-wide text-gold hover:text-gold-bright"
                >
                  {c.author.username}
                </Link>
                {c.author.school && (
                  <img
                    src={elementWords[c.author.school]}
                    alt={c.author.school}
                    title={`School of ${c.author.school}`}
                    className="h-3.5"
                  />
                )}
                <span className="text-xs text-bone-dim/70">{timeAgo(c.createdAtUtc)}</span>
                {user && (user.id === c.author.id || user.id === mod.author.id) && (
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    className="ml-auto text-[11px] uppercase tracking-wider text-blood/70 hover:text-blood"
                  >
                    erase
                  </button>
                )}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-bone/90">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {user ? (
        <form onSubmit={submit} className="mt-4 space-y-2">
          <textarea
            className="input min-h-20"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            placeholder="Leave a note in the margin…"
          />
          {error && <ErrorNote message={error} />}
          <button type="submit" className="btn btn-stone" disabled={busy || !body.trim()}>
            {busy ? 'Inscribing…' : 'Inscribe'}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-bone-dim">
          <Link to="/login" className="link-arcane">
            Sign in
          </Link>{' '}
          to leave a note. The Librarian checks signatures.
        </p>
      )}
    </div>
  )
}

function AddVersionForm({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [version, setVersion] = useState('')
  const [changelog, setChangelog] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !version.trim()) {
      setError('A version number and a zip are both required. Pedantry is policy.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('version', version.trim())
      form.set('changelog', changelog)
      form.set('file', file)
      await api.mods.addVersion(slug, form)
      setVersion('')
      setChangelog('')
      setFile(null)
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 border-t border-gold/15 pt-4">
      <div className="kicker">Publish a new version</div>
      <Field label="Version">
        <input className="input" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.1.0" />
      </Field>
      <Field label="Changelog">
        <textarea
          className="input min-h-20"
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          placeholder="Fixed the golem. The golem is fine now."
        />
      </Field>
      <Field label="Zip file">
        <input
          type="file"
          accept=".zip"
          className="block w-full text-xs text-bone-dim file:mr-3 file:cursor-pointer file:rounded file:border file:border-gold/30 file:bg-crypt file:px-3 file:py-1.5 file:font-display file:text-[11px] file:uppercase file:tracking-wider file:text-gold"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>
      {error && <ErrorNote message={error} />}
      <button type="submit" className="btn btn-stone w-full" disabled={busy}>
        {busy ? 'Cataloguing…' : 'Publish version'}
      </button>
    </form>
  )
}

export default function ModDetail() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const mod = useApi(() => api.mods.get(slug), [slug])
  const [deleting, setDeleting] = useState(false)
  const [stamp, setStamp] = useState(0)

  if (mod.loading) return <Spinner label="Fetching the tome…" />
  if (mod.error || !mod.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <img src={art.skullWhite} alt="" className="mx-auto mb-4 h-12 opacity-60" />
        <h1 className="h-display text-xl">This tome is missing</h1>
        <p className="text-fell mt-2 text-bone-dim">
          {mod.error ?? 'Checked out, burned, or never written.'}
        </p>
        <Link to="/mods" className="btn btn-stone mt-6">
          ← Back to the Library
        </Link>
      </div>
    )
  }

  const m = mod.data
  const isOwner = user && user.id === m.author.id
  const latest = m.versions[0]

  const remove = async () => {
    if (!window.confirm(`Burn “${m.name}” from the Library? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await api.mods.remove(m.slug)
      navigate('/mods')
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Failed to delete')
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <Reveal>
        <Link to="/mods" className="link-arcane text-xs uppercase tracking-[0.15em]">
          ← The Library
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="h-display text-3xl">{m.name}</h1>
          <TypeBadge type={m.type} />
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm text-bone-dim">
          <span>
            by{' '}
            <Link to={`/wizards/${encodeURIComponent(m.author.username)}`} className="text-gold hover:text-gold-bright">
              {m.author.username}
            </Link>
          </span>
          {m.author.school && (
            <img
              src={elementWords[m.author.school]}
              alt={m.author.school}
              title={`School of ${m.author.school}`}
              className="h-4"
            />
          )}
          <span>· updated {timeAgo(m.updatedAtUtc)} · <span className="font-mono text-xs">{m.slug}</span></span>
        </p>
        <p className="mt-3 max-w-2xl text-[15px] text-bone/90">{m.summary}</p>
      </Reveal>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {m.screenshots.length > 0 && (
            <div className="mb-8 flex snap-x gap-3 overflow-x-auto pb-2">
              {m.screenshots.map((s) => (
                <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="snap-start">
                  <img
                    src={s.url}
                    alt=""
                    className="h-44 rounded border border-gold/20 object-cover transition-transform hover:scale-[1.02] sm:h-56"
                  />
                </a>
              ))}
            </div>
          )}

          <div className="panel panel-ornate p-6 sm:p-8">
            <div className="kicker mb-3">From the tome’s preface</div>
            <div className="prose-sdr whitespace-pre-wrap text-[15px]">{m.description || m.summary}</div>
          </div>

          <Marginalia mod={m} />

          <div className="mt-8">
            <div className="kicker mb-3">Editions</div>
            <div className="space-y-2">
              {m.versions.map((v) => (
                <div key={v.id} className="slab flex flex-wrap items-center gap-x-5 gap-y-2 rounded px-4 py-3">
                  <span className="badge badge-gold">v{v.version}</span>
                  <span className="text-xs text-bone-dim">{formatDate(v.createdAtUtc)}</span>
                  <span className="font-mono text-xs text-bone-dim">{formatBytes(v.fileSize)}</span>
                  <span className="font-mono text-xs text-bone-dim">↓ {formatCount(v.downloads)}</span>
                  {v.changelog && <span className="w-full text-sm text-bone-dim/90 sm:w-auto sm:flex-1">{v.changelog}</span>}
                  <a
                    href={api.mods.versionDownloadUrl(m.slug, v.id)}
                    className="link-arcane ml-auto text-xs uppercase tracking-wider"
                  >
                    download
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="panel panel-ornate p-6 text-center">
            <a
              href={api.mods.installUrl(m.slug)}
              className="btn btn-gold relative w-full !py-4 !text-sm"
              title="Opens the SDR loader and installs this tome"
              onClick={() => {
                setStamp((k) => k + 1)
                playSound('tomeGet', 0.3)
              }}
            >
              ⬩ Take This Tome
              {stamp > 0 && (
                <img
                  key={stamp}
                  src={art.stampTake}
                  alt=""
                  className="pointer-events-none absolute -right-3 -top-5 h-12"
                  style={{ animation: 'stamp-slam 1.2s ease-out both' }}
                  onAnimationEnd={() => setStamp(0)}
                />
              )}
            </a>
            <p className="mt-3 font-mono text-xs text-bone-dim">
              v{latest?.version ?? m.latestVersion} · {latest ? formatBytes(latest.fileSize) : ''} · ↓{' '}
              {formatCount(m.downloads)} total
            </p>
            <div className="rule-gold my-4" />
            <p className="text-left text-xs leading-relaxed text-bone-dim">
              One click installs it through the SDR loader (unreleased; the seal
              holds). Prefer to do it by hand?{' '}
              <a href={api.mods.downloadUrl(m.slug)} className="link-arcane">
                Download the zip
              </a>
              .
            </p>
          </div>

          {isOwner && (
            <div className="panel p-6">
              <div className="kicker">Author’s desk</div>
              <AddVersionForm slug={m.slug} onDone={mod.reload} />
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="btn btn-blood mt-4 w-full"
              >
                {deleting ? 'Burning…' : 'Burn this tome'}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

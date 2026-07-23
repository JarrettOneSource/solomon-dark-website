import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Reveal from '../fx/Reveal'
import PlatesGallery from '../components/PlatesGallery'
import TagsInput from '../components/TagsInput'
import { ErrorNote, Spinner, TagBadge } from '../components/ui'
import { api, ApiError } from '../lib/api'
import type { ModDetail as ModDetailShape } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useAuth } from '../lib/auth'
import { formatBytes, formatCount, formatDate, timeAgo } from '../lib/format'
import { art, elementWords } from '../lib/assets'
import { playSound } from '../fx/sounds'

/** Marginalia: notes other wizards left in this tome's margins. */
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
  const total = comments.data?.total ?? items.length

  return (
    <section className="mt-14">
      <div className="flex items-center gap-4" aria-hidden="true">
        <div className="rule-gold flex-1" />
        <img src={art.skullWhite} alt="" className="h-5 opacity-45" />
        <div className="rule-gold flex-1" />
      </div>

      <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="h-display text-lg">Marginalia</h2>
        <span className="text-fell text-sm text-bone-dim">notes left in the margins</span>
        {comments.data && (
          <span className="ml-auto font-mono text-xs text-bone-dim/70">
            {total} {total === 1 ? 'note' : 'notes'}
          </span>
        )}
      </div>

      {user ? (
        <form onSubmit={submit} className="slab mt-5 space-y-2.5 rounded p-4">
          <textarea
            className="input min-h-20"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            placeholder="Leave a note in the margin…"
          />
          {error && <ErrorNote message={error} />}
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] text-bone-dim/50">{body.length}/1000</span>
            <button type="submit" className="btn btn-stone" disabled={busy || !body.trim()}>
              {busy ? 'Inscribing…' : 'Inscribe'}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-5 text-sm text-bone-dim">
          <Link to="/login" className="link-arcane">
            Sign in
          </Link>{' '}
          to leave a note. The Librarian checks signatures.
        </p>
      )}

      {comments.loading ? (
        <Spinner label="Deciphering handwriting…" />
      ) : items.length === 0 ? (
        <div className="mt-5 rounded border border-dashed border-gold/20 px-5 py-8 text-center">
          <p className="text-fell text-sm text-bone-dim">
            No notes yet. The margins are pristine, suspiciously so.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((c) => (
            <article
              key={c.id}
              className="rounded-r border-l-2 border-gold/30 bg-crypt/50 px-4 py-3 transition-colors hover:border-gold/60 hover:bg-crypt/70"
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-gold/30 bg-[#0d0b12] font-display text-xs font-bold text-gold shadow-[inset_0_0_8px_rgba(0,0,0,.8)]">
                  {c.author.username.charAt(0).toUpperCase()}
                </span>
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
                <span className="text-xs text-bone-dim/60">{timeAgo(c.createdAtUtc)}</span>
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
              <p className="text-fell mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-bone/90">
                {c.body}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

/** Author-side plate management: bind, unbind, and shuffle the tome's images. */
function PlateManager({ mod, onChanged }: { mod: ModDetailShape; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const plates = mod.screenshots

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The plate press jammed.')
    } finally {
      setBusy(false)
    }
  }

  const add = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const form = new FormData()
    for (const f of Array.from(files)) form.append('screenshots', f)
    void run(() => api.mods.screenshots.add(mod.slug, form))
  }

  const move = (from: number, dir: -1 | 1) => {
    const ids = plates.map((p) => p.id)
    ;[ids[from], ids[from + dir]] = [ids[from + dir], ids[from]]
    void run(() => api.mods.screenshots.reorder(mod.slug, ids))
  }

  const smallButton =
    'absolute flex h-5 w-5 items-center justify-center rounded bg-black/75 text-[11px] leading-none opacity-0 transition-opacity group-hover:opacity-100'

  return (
    <div className="mt-4 border-t border-gold/15 pt-4">
      <div className="kicker mb-3">Plates · {plates.length}/10 bound</div>
      {plates.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {plates.map((p, n) => (
            <div key={p.id} className="group relative overflow-hidden rounded border border-gold/20">
              <img src={p.url} alt="" className="h-14 w-full object-cover" />
              <button
                type="button"
                aria-label="Unbind this plate"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Unbind this plate from the tome?')) {
                    void run(() => api.mods.screenshots.remove(mod.slug, p.id))
                  }
                }}
                className={`${smallButton} right-0.5 top-0.5 text-blood/80 hover:text-blood`}
              >
                ✕
              </button>
              {n > 0 && (
                <button
                  type="button"
                  aria-label="Move plate earlier"
                  disabled={busy}
                  onClick={() => move(n, -1)}
                  className={`${smallButton} bottom-0.5 left-0.5 text-gold/80 hover:text-gold-bright`}
                >
                  ‹
                </button>
              )}
              {n < plates.length - 1 && (
                <button
                  type="button"
                  aria-label="Move plate later"
                  disabled={busy}
                  onClick={() => move(n, 1)}
                  className={`${smallButton} bottom-0.5 right-0.5 text-gold/80 hover:text-gold-bright`}
                >
                  ›
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <label
        className={`mt-3 block ${plates.length >= 10 ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
      >
        <span className="btn btn-stone pointer-events-none w-full !py-2 !text-[11px]">
          {busy ? 'Pressing…' : 'Bind new plates'}
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg"
          multiple
          className="hidden"
          disabled={busy || plates.length >= 10}
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
      </label>
      <p className="mt-2 text-[11px] leading-relaxed text-bone-dim/70">
        png/jpg · 2MB each · the first plate faces the Library.
      </p>
      {error && (
        <div className="mt-2">
          <ErrorNote message={error} />
        </div>
      )}
    </div>
  )
}

/** Author-side filing: revise the tome's tags in place. */
function TagEditor({ mod, onChanged }: { mod: ModDetailShape; onChanged: () => void }) {
  const [tags, setTags] = useState(mod.tags)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = [...tags].sort().join(',') !== [...mod.tags].sort().join(',')

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.mods.update(mod.slug, { tags })
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The filing system rejected it.')
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 border-t border-gold/15 pt-4">
      <div className="kicker mb-3">Filing · {tags.length}/5 tags</div>
      <TagsInput tags={tags} onChange={setTags} disabled={busy} />
      {error && (
        <div className="mt-2">
          <ErrorNote message={error} />
        </div>
      )}
      {dirty && (
        <button
          type="button"
          className="btn btn-stone mt-3 w-full !py-2 !text-[11px]"
          disabled={busy}
          onClick={save}
        >
          {busy ? 'Refiling…' : 'Save the filing'}
        </button>
      )}
    </div>
  )
}

function RecordRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="font-display text-[11px] uppercase tracking-[0.18em] text-bone-dim/70">
        {label}
      </span>
      <span className="min-w-0 text-right text-bone/90">{children}</span>
    </div>
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
  const isOwner = user != null && user.id === m.author.id
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
          {m.tags.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5">
              {m.tags.map((tag) => (
                <TagBadge
                  key={tag}
                  tag={tag}
                  title={`Everything filed under ${tag}`}
                  onClick={() => navigate(`/mods?tag=${encodeURIComponent(tag)}`)}
                />
              ))}
            </span>
          )}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm text-bone-dim">
          <span>
            by{' '}
            <Link
              to={`/wizards/${encodeURIComponent(m.author.username)}`}
              className="text-gold hover:text-gold-bright"
            >
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
          <span>· updated {timeAgo(m.updatedAtUtc)}</span>
        </p>
        <p className="text-fell mt-3 max-w-2xl text-[16px] text-bone/85">{m.summary}</p>
      </Reveal>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {m.screenshots.length > 0 && (
            <Reveal delay={60}>
              <PlatesGallery plates={m.screenshots} name={m.name} />
            </Reveal>
          )}

          <Reveal delay={100} className={m.screenshots.length > 0 ? 'mt-8' : ''}>
            <div className="panel panel-ornate p-6 sm:p-8">
              <div className="kicker mb-3">From the tome’s preface</div>
              <div className="prose-sdr whitespace-pre-wrap text-[15px]">
                {m.description || m.summary}
              </div>
            </div>
          </Reveal>

          <Marginalia mod={m} />
        </div>

        <aside className="space-y-6">
          <div className="panel panel-ornate p-6 text-center">
            <a
              href={api.mods.downloadUrl(m.slug)}
              className="btn btn-gold relative w-full !py-4 !text-sm"
              title="Downloads the latest mod package"
              onClick={() => {
                setStamp((k) => k + 1)
                playSound('tomeGet', 0.3)
              }}
            >
              ⬩ Download This Tome
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
              v{latest?.version ?? m.latestVersion} · {latest ? formatBytes(latest.fileSize) : ''} ·
              ↓ {formatCount(m.downloads)} total
            </p>
          </div>

          {latest && (
            <div className="panel p-6">
              <div className="kicker mb-3">Latest edition</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="badge badge-gold">v{latest.version}</span>
                <span className="text-xs text-bone-dim">{formatDate(latest.createdAtUtc)}</span>
                <span className="ml-auto font-mono text-xs text-bone-dim">
                  {formatBytes(latest.fileSize)}
                </span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-bone-dim/90">
                {latest.changelog || 'No changelog. The scribe was terse.'}
              </p>
              <Link
                to={`/mods/${m.slug}/versions`}
                className="btn btn-stone mt-4 w-full !py-2.5 !text-[11px]"
              >
                {m.versions.length > 1
                  ? `Browse all ${m.versions.length} editions`
                  : 'Open the catalogue'}
              </Link>
            </div>
          )}

          <div className="panel p-6">
            <div className="kicker mb-2">Tome record</div>
            <div className="divide-y divide-gold/10">
              <RecordRow label="Author">
                <Link
                  to={`/wizards/${encodeURIComponent(m.author.username)}`}
                  className="text-gold hover:text-gold-bright"
                >
                  {m.author.username}
                </Link>
              </RecordRow>
              <RecordRow label="Shelved">{formatDate(m.createdAtUtc)}</RecordRow>
              <RecordRow label="Revised">{timeAgo(m.updatedAtUtc)}</RecordRow>
              <RecordRow label="Editions">{m.versions.length}</RecordRow>
              <RecordRow label="Downloads">{formatCount(m.downloads)}</RecordRow>
            </div>
          </div>

          {isOwner && (
            <div className="panel p-6">
              <div className="kicker">Author’s desk</div>
              <PlateManager mod={m} onChanged={mod.reload} />
              <TagEditor key={m.tags.join(',')} mod={m} onChanged={mod.reload} />
              <div className="mt-4 border-t border-gold/15 pt-4">
                <Link
                  to={`/mods/${m.slug}/versions`}
                  className="btn btn-stone w-full !py-2.5 !text-[11px]"
                >
                  Publish a new edition →
                </Link>
                <button
                  type="button"
                  onClick={remove}
                  disabled={deleting}
                  className="btn btn-blood mt-3 w-full !py-2.5 !text-[11px]"
                >
                  {deleting ? 'Burning…' : 'Burn this tome'}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

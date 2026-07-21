import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Reveal from '../fx/Reveal'
import { ErrorNote, Field, Spinner } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useAuth } from '../lib/auth'
import { formatBytes, formatCount, formatDate } from '../lib/format'
import { art } from '../lib/assets'

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
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <Field label="Version" hint="Must exactly match manifest.version.">
          <input
            className="input"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.1.0"
          />
        </Field>
        <Field label="Zip file">
          <input
            type="file"
            accept=".zip"
            className="block w-full text-xs text-bone-dim file:mr-3 file:cursor-pointer file:rounded file:border file:border-gold/30 file:bg-crypt file:px-3 file:py-2 file:font-display file:text-[11px] file:uppercase file:tracking-wider file:text-gold"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
      </div>
      <Field label="Changelog">
        <textarea
          className="input min-h-20"
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          placeholder="Fixed the golem. The golem is fine now."
        />
      </Field>
      {error && <ErrorNote message={error} />}
      <button type="submit" className="btn btn-stone w-full" disabled={busy}>
        {busy ? 'Cataloguing…' : 'Publish version'}
      </button>
    </form>
  )
}

export default function ModVersions() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const mod = useApi(() => api.mods.get(slug), [slug])

  if (mod.loading) return <Spinner label="Opening the catalogue…" />
  if (mod.error || !mod.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <img src={art.skullWhite} alt="" className="mx-auto mb-4 h-12 opacity-60" />
        <h1 className="h-display text-xl">This catalogue is missing</h1>
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
  const [latest, ...earlier] = m.versions

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <Reveal>
        <Link
          to={`/mods/${m.slug}`}
          className="link-arcane text-xs uppercase tracking-[0.15em]"
        >
          ← {m.name}
        </Link>
        <div className="kicker mb-1.5 mt-5">The catalogue · every recorded edition</div>
        <h1 className="h-display text-3xl">Editions</h1>
        <p className="text-fell mt-2 text-bone-dim">
          {m.versions.length} edition{m.versions.length === 1 ? '' : 's'} of {m.name} ·{' '}
          {formatCount(m.downloads)} downloads all told
        </p>
      </Reveal>

      {isOwner && (
        <Reveal delay={60}>
          <div className="panel mt-8 p-6">
            <div className="kicker">Author’s desk · publish a new edition</div>
            <AddVersionForm slug={m.slug} onDone={mod.reload} />
          </div>
        </Reveal>
      )}

      {latest && (
        <Reveal delay={100}>
          <section className="panel panel-ornate mt-8 p-6 sm:p-7">
            <div className="kicker mb-4">Current edition</div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="badge badge-gold !text-[13px]">v{latest.version}</span>
              <span className="text-xs text-bone-dim">{formatDate(latest.createdAtUtc)}</span>
              <span className="font-mono text-xs text-bone-dim">{formatBytes(latest.fileSize)}</span>
              <span className="font-mono text-xs text-bone-dim">↓ {formatCount(latest.downloads)}</span>
              <a
                href={api.mods.versionDownloadUrl(m.slug, latest.id)}
                className="btn btn-gold ml-auto !px-4 !py-2.5 !text-[11px]"
              >
                ⬩ Download
              </a>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-bone/90">
              {latest.changelog || 'No changelog. The scribe was terse.'}
            </p>
          </section>
        </Reveal>
      )}

      {earlier.length > 0 ? (
        <Reveal delay={140}>
          <section className="mt-10">
            <div className="kicker mb-3">Earlier editions</div>
            <div className="space-y-2">
              {earlier.map((v) => (
                <div
                  key={v.id}
                  className="slab flex flex-wrap items-center gap-x-5 gap-y-2 rounded px-4 py-3"
                >
                  <span className="badge badge-gold">v{v.version}</span>
                  <span className="text-xs text-bone-dim">{formatDate(v.createdAtUtc)}</span>
                  <span className="font-mono text-xs text-bone-dim">{formatBytes(v.fileSize)}</span>
                  <span className="font-mono text-xs text-bone-dim">↓ {formatCount(v.downloads)}</span>
                  {v.changelog && (
                    <span className="w-full text-sm text-bone-dim/90 sm:w-auto sm:flex-1">
                      {v.changelog}
                    </span>
                  )}
                  <a
                    href={api.mods.versionDownloadUrl(m.slug, v.id)}
                    className="link-arcane ml-auto text-xs uppercase tracking-wider"
                  >
                    download
                  </a>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      ) : (
        <p className="text-fell mt-6 text-sm text-bone-dim">
          No earlier editions. The first printing stands alone.
        </p>
      )}
    </div>
  )
}

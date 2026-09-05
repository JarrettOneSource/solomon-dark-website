import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Reveal from '../fx/Reveal'
import TagsInput from '../components/TagsInput'
import { ErrorNote, Field } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useAuth } from '../lib/auth'
import { art } from '../lib/assets'
import ModVisibilityField from '../components/ModVisibilityField'
import type { ModVisibility } from '../lib/api'

const MAX_ZIP_MB = 100

export default function ModUpload() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [version, setVersion] = useState('1.0.0')
  const [visibility, setVisibility] = useState<ModVisibility>('public')
  const [file, setFile] = useState<File | null>(null)
  const [screens, setScreens] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tagIndex = useApi(() => api.mods.tagIndex(), [])

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true })
  }, [user, loading, navigate])

  const pickZip = (f: File | undefined | null) => {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.zip')) {
      setError('Choose a ZIP file.')
      return
    }
    if (f.size > MAX_ZIP_MB * 1024 * 1024) {
      setError(`The ZIP must be ${MAX_ZIP_MB} MB or smaller.`)
      return
    }
    setError(null)
    setFile(f)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Choose a ZIP file to upload.')
      return
    }
    if (name.trim().length < 3) {
      setError('Enter a mod name with at least 3 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('name', name.trim())
      form.set('summary', summary.trim())
      form.set('description', description)
      if (tags.length > 0) form.set('tags', tags.join(','))
      form.set('version', version.trim() || '1.0.0')
      form.set('visibility', visibility)
      form.set('file', file)
      for (const s of screens.slice(0, 10)) form.append('screenshots', s)
      const created = await api.mods.create(form)
      navigate(`/mods/${created.slug}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <Reveal>
        <h1 className="h-display text-3xl">Upload a Mod</h1>
        <p className="text-fell mt-2 text-bone-dim">
          Upload a ZIP containing Lua scripts, Boneyards, or both, with{' '}
          <code>manifest.json</code> at the root.{' '}
          <a href="/mod-package-format.md" className="link-arcane">Read the package format</a>
          {' '}or <a href="/mod-manifest.schema.json" className="link-arcane">open the JSON Schema</a>.
        </p>
      </Reveal>

      <form onSubmit={submit} className="panel panel-ornate mt-8 space-y-6 p-6 sm:p-8">
        {/* dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            pickZip(e.dataTransfer.files?.[0])
          }}
          className={`relative flex flex-col items-center justify-center gap-3 rounded border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragOver ? 'border-arcane bg-arcane/5' : file ? 'border-moss/50 bg-moss/5' : 'border-gold/30 bg-[#0b0910]'
          }`}
        >
          <img src={art.stampSave} alt="" className="h-16 opacity-70" />
          {file ? (
            <>
              <div className="font-mono text-sm text-moss">{file.name}</div>
              <div className="font-mono text-xs text-bone-dim">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </div>
              <button type="button" className="link-arcane text-xs uppercase tracking-wider" onClick={() => setFile(null)}>
                choose another
              </button>
            </>
          ) : (
            <>
              <div className="font-display text-sm font-bold uppercase tracking-[0.15em] text-bone">
                Drop your mod ZIP here
              </div>
              <div className="text-xs text-bone-dim">or</div>
              <label className="btn btn-stone cursor-pointer !py-2 !text-[11px]">
                Choose ZIP
                <input type="file" accept=".zip" className="hidden" onChange={(e) => pickZip(e.target.files?.[0])} />
              </label>
              <div className="text-[11px] text-bone-dim/60">ZIP · up to {MAX_ZIP_MB} MB</div>
            </>
          )}
        </div>

        <ModVisibilityField disabled={busy} onChange={setVisibility} value={visibility} />

        <div>
          <span className="label">Tags</span>
          <TagsInput
            tags={tags}
            onChange={setTags}
            suggestions={(tagIndex.data?.items ?? []).map((entry) => entry.tag)}
            disabled={busy}
          />
          <span className="mt-1.5 block text-xs text-bone-dim/70">
            Up to five tags. Boneyards get the “boneyard” tag automatically.
          </span>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Mod name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Shock Nova Rework" maxLength={60} />
          </Field>
          <Field label="First version" hint="Must match the version in manifest.json.">
            <input className="input" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" />
          </Field>
        </div>

        <Field label="Summary" hint="Shown on your Library card. Up to 140 characters.">
          <input className="input" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={140} placeholder="Describe what your mod changes." />
        </Field>

        <Field label="Description">
          <textarea
            className="input min-h-36"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={10000}
            placeholder={'Describe features, setup, and known issues.\nPlain text only.'}
          />
        </Field>

        <Field label="Screenshots" hint="Up to 10 · PNG/JPG · 2 MB each">
          <input
            type="file"
            accept="image/png,image/jpeg"
            multiple
            className="block w-full text-xs text-bone-dim file:mr-3 file:cursor-pointer file:rounded file:border file:border-gold/30 file:bg-crypt file:px-3 file:py-1.5 file:font-display file:text-[11px] file:uppercase file:tracking-wider file:text-gold"
            onChange={(e) => setScreens(Array.from(e.target.files ?? []).slice(0, 10))}
          />
        </Field>

        {error && <ErrorNote message={error} />}

        <button type="submit" className="btn btn-gold w-full !py-4" disabled={busy}>
          {busy ? 'Uploading…' : 'Publish mod'}
        </button>
      </form>
    </div>
  )
}

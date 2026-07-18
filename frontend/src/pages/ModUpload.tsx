import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Reveal from '../fx/Reveal'
import TagsInput from '../components/TagsInput'
import { ErrorNote, Field } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useAuth } from '../lib/auth'
import { art } from '../lib/assets'

const MAX_ZIP_MB = 100

export default function ModUpload() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [version, setVersion] = useState('1.0.0')
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
      setError('The Library accepts zips only. Scrolls, at your own risk, later.')
      return
    }
    if (f.size > MAX_ZIP_MB * 1024 * 1024) {
      setError(`That tome is over ${MAX_ZIP_MB}MB. Abridge it.`)
      return
    }
    setError(null)
    setFile(f)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('No zip attached. The Librarian refuses to catalogue thin air.')
      return
    }
    if (name.trim().length < 3) {
      setError('Name your tome (3+ characters).')
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
        <div className="kicker mb-1.5">Acquisitions department</div>
        <h1 className="h-display text-3xl">Contribute a Tome</h1>
        <p className="text-fell mt-2 text-bone-dim">
          Any zip will do for now — required structure and validation arrive once the
          cataloguing standards committee stops arguing. (Estimated: several centuries.)
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
                {(file.size / (1024 * 1024)).toFixed(2)} MB — looks tome-shaped
              </div>
              <button type="button" className="link-arcane text-xs uppercase tracking-wider" onClick={() => setFile(null)}>
                choose another
              </button>
            </>
          ) : (
            <>
              <div className="font-display text-sm font-bold uppercase tracking-[0.15em] text-bone">
                Drop your mod zip here
              </div>
              <div className="text-xs text-bone-dim">or</div>
              <label className="btn btn-stone cursor-pointer !py-2 !text-[11px]">
                Browse for zip
                <input type="file" accept=".zip" className="hidden" onChange={(e) => pickZip(e.target.files?.[0])} />
              </label>
              <div className="text-[11px] text-bone-dim/60">.zip up to {MAX_ZIP_MB}MB</div>
            </>
          )}
        </div>

        <div>
          <span className="label">Filing tags</span>
          <TagsInput
            tags={tags}
            onChange={setTags}
            suggestions={(tagIndex.data?.items ?? []).map((entry) => entry.tag)}
            disabled={busy}
          />
          <span className="mt-1.5 block text-xs text-bone-dim/70">
            Up to five — how the Library files it. Boneyard runs tag themselves
            “boneyard”; the rest is your taxonomy.
          </span>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Tome name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Shock Nova Rework" maxLength={60} />
          </Field>
          <Field label="First version">
            <input className="input" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" />
          </Field>
        </div>

        <Field label="Summary" hint="One line on the card in the Library. ≤140 characters.">
          <input className="input" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={140} placeholder="Certified by no one. Works on my machine." />
        </Field>

        <Field label="Description">
          <textarea
            className="input min-h-36"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={10000}
            placeholder={'What it does, how to configure it, what it breaks.\nPlain text is fine.'}
          />
        </Field>

        <Field label="Screenshots" hint="Up to 10 · png/jpg · 2MB each">
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
          {busy ? 'Cataloguing… do not reshelve' : '✦ Submit to the Library'}
        </button>
      </form>
    </div>
  )
}

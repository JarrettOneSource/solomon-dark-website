// Publication papers: compile the plot, lodge it in the Annals, and enter it
// into the Library as a Boneyard tome. The Librarian's standards apply,
// eventually.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { bytesToBase64, compileNative, docFileValue } from '../../editor/io'
import type { EditorDoc } from '../../editor/model'
import { cloudIdFor, setCloudId } from '../../editor/store'
import { playSound } from '../../fx/sounds'
import { api, ApiError } from '../../lib/api'
import { ErrorNote, Field } from '../ui'

interface Props {
  doc: EditorDoc
  draftId: string
  onClose: () => void
}

export default function PublishDialog({ doc, draftId, onClose }: Props) {
  const [name, setName] = useState(doc.meta.name || 'Untitled Acre')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      // The papers' title becomes the arena name inside the compiled file,
      // not just the shelf label.
      const title = name.trim() || 'Untitled Acre'
      const pressed: EditorDoc = { ...doc, meta: { ...doc.meta, name: title } }
      const compiled = bytesToBase64(await compileNative(pressed))
      let cloudId = cloudIdFor(draftId)
      if (cloudId === null) {
        const created = await api.boneyards.create(title)
        cloudId = created.id
        setCloudId(draftId, cloudId)
      }
      await api.boneyards.update(cloudId, {
        name: title,
        document: docFileValue(pressed),
        compiledBoneyard: compiled,
      })
      const mod = await api.boneyards.publish(cloudId, {
        name: name.trim(),
        summary: summary.trim(),
        description: description.trim(),
      })
      playSound('tomeGet', 0.16)
      navigate(`/mods/${mod.slug}`)
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'The Librarian declined, without elaboration.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="panel panel-ornate w-full max-w-lg overflow-hidden"
        role="dialog"
        aria-label="Publish this boneyard"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gold/15 px-5 py-4">
          <div>
            <div className="kicker">Publication papers</div>
            <h2 className="h-display mt-0.5 text-lg">Enter the Library</h2>
          </div>
          <button type="button" className="text-bone-dim hover:text-blood" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <Field label="Title">
            <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Summary" hint="One line for the shelf card.">
            <input className="input" value={summary} maxLength={160} onChange={(e) => setSummary(e.target.value)} />
          </Field>
          <Field label="Description" hint="What awaits the residents. Markdown-ish.">
            <textarea
              className="input min-h-28 resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          {error && <ErrorNote message={error} />}
          <p className="text-fell text-xs text-bone-dim/70">
            Publishing compiles the plot to a native .boneyard, validates the container,
            and shelves it as a tome under your name. The draft stays in the Annals.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-gold/15 px-5 py-4">
          <button type="button" className="btn btn-stone" onClick={onClose} disabled={busy}>
            Not yet
          </button>
          <button
            type="button"
            className="btn btn-gold"
            onClick={submit}
            disabled={busy || !name.trim() || !summary.trim()}
          >
            {busy ? 'Binding…' : 'Publish the plot'}
          </button>
        </div>
      </div>
    </div>
  )
}

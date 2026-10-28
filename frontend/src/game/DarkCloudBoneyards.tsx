import { useEffect, useRef, useState, type ChangeEvent } from 'react'

import { setCloudId } from '../editor/cloud.ts'
import { importDocFile, importDocValue } from '../editor/io.ts'
import type { EditorDoc } from '../editor/model.ts'
import { countResidents } from '../editor/model.ts'
import {
  deleteDraft,
  listDrafts,
  loadDraft,
  newDraftId,
  saveDraft,
  type DraftMeta,
  type WorkshopRequest,
} from '../editor/store.ts'
import { api, type BoneyardDraftSummary } from '../lib/api.ts'
import { NativeDarkCloudText, NativeUiButton } from './native-ui/react.ts'

type RowAction = 'confirm' | 'delete' | 'edit' | 'keep' | 'test'
type RowRequest = { readonly action: 'delete' | 'edit' | 'test'; readonly row: string }

const UPDATED = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export default function DarkCloudBoneyards({ accountUsername, onOpen }: {
  accountUsername: string | null
  onOpen: (request: WorkshopRequest) => void
}) {
  const [local, setLocal] = useState<DraftMeta[]>(listDrafts)
  const [cloud, setCloud] = useState<BoneyardDraftSummary[] | null>(null)
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [cloudRequest, setCloudRequest] = useState(0)
  const [confirming, setConfirming] = useState<string | null>(null)
  // One request at a time keeps every row's buttons disabled while it runs.
  const [busy, setBusy] = useState<RowRequest | 'import' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [deletions, setDeletions] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const newRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (accountUsername === null) return
    let stale = false
    setCloud(null)
    setCloudError(null)
    api.boneyards.list().then(
      items => { if (!stale) setCloud(items) },
      (reason: unknown) => { if (!stale) setCloudError(messageOf(reason, 'Your cloud boneyards could not be loaded.')) },
    )
    return () => { stale = true }
  }, [accountUsername, cloudRequest])

  useEffect(() => {
    // The confirmed row is gone; keep keyboard focus inside the panel once its buttons are enabled again.
    if (deletions > 0) newRef.current?.focus({ preventScroll: true })
  }, [deletions])

  const begin = (request: RowRequest | 'import') => {
    setBusy(request)
    setError(null)
    setStatus('')
  }

  const deleted = (message: string) => {
    setConfirming(null)
    setStatus(message)
    setDeletions(count => count + 1)
  }

  const openLocal = (meta: DraftMeta, test: boolean) => {
    const doc = loadDraft(meta.id)
    if (!doc) {
      setError(`${displayName(meta.name)} could not be opened from this device.`)
      return
    }
    onOpen({ kind: 'open', doc, draftId: meta.id, savedAt: meta.updatedAt, test })
  }

  const openCloud = async (item: BoneyardDraftSummary, test: boolean) => {
    begin({ action: test ? 'test' : 'edit', row: `cloud:${item.id}` })
    try {
      const doc = importDocValue((await api.boneyards.get(item.id)).document)
      // A fresh local draft that saves back to this cloud copy.
      const draftId = newDraftId()
      setCloudId(draftId, item.id)
      onOpen({ kind: 'open', doc, draftId, savedAt: Date.now(), test })
    } catch (reason) {
      setError(`${item.name}: ${messageOf(reason, 'It could not be opened.')}`)
    } finally {
      setBusy(null)
    }
  }

  const deleteCloud = async (item: BoneyardDraftSummary) => {
    begin({ action: 'delete', row: `cloud:${item.id}` })
    try {
      await api.boneyards.remove(item.id)
      setCloud(current => current?.filter(entry => entry.id !== item.id) ?? null)
      deleted(`Deleted ${item.name} from the cloud.`)
    } catch (reason) {
      setError(`${item.name}: ${messageOf(reason, 'It could not be deleted.')}`)
    } finally {
      setBusy(null)
    }
  }

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    begin('import')
    try {
      let doc: EditorDoc
      try {
        doc = await importDocFile(file)
      } catch (reason) {
        setError(`${file.name}: ${messageOf(reason, 'It could not be read.')}`)
        return
      }
      try {
        saveDraft(newDraftId(), doc, countResidents(doc))
      } catch {
        setError(`${file.name} could not be saved on this device. Delete a boneyard here to make room, then try again.`)
        return
      }
      setLocal(listDrafts())
      setStatus(`Imported ${displayName(doc.meta.name)}.`)
    } finally {
      setBusy(null)
    }
  }

  const localAction = (meta: DraftMeta) => (action: RowAction) => {
    if (action === 'edit' || action === 'test') openLocal(meta, action === 'test')
    else if (action === 'delete') setConfirming(`local:${meta.id}`)
    else if (action === 'keep') setConfirming(null)
    else {
      deleteDraft(meta.id)
      setLocal(listDrafts())
      deleted(`Deleted ${displayName(meta.name)} from this device.`)
    }
  }

  const cloudAction = (item: BoneyardDraftSummary) => (action: RowAction) => {
    if (action === 'edit' || action === 'test') void openCloud(item, action === 'test')
    else if (action === 'delete') setConfirming(`cloud:${item.id}`)
    else if (action === 'keep') setConfirming(null)
    else void deleteCloud(item)
  }

  const busyAction = (row: string) => typeof busy === 'object' && busy?.row === row ? busy.action : null

  return (
    <section className="dark-cloud-boneyards" aria-label="Your boneyards">
      <header>
        <h2><NativeDarkCloudText scale={1} text="YOUR BONEYARDS" /></h2>
        <div className="dark-cloud-boneyards-tools">
          <NativeUiButton disabled={busy !== null} height={44} onClick={() => onOpen({ kind: 'new' })} ref={newRef} scale={0.55} width="fill">NEW BONEYARD</NativeUiButton>
          <NativeUiButton disabled={busy !== null} height={44} onClick={() => fileRef.current?.click()} scale={0.55} width="fill">
            {busy === 'import' ? 'IMPORTING...' : 'IMPORT FILE'}
          </NativeUiButton>
          <input accept=".boneyard,.json,application/json" hidden onChange={event => { void importFile(event) }} ref={fileRef} type="file" />
        </div>
      </header>
      <p className="dark-cloud-boneyards-status" role="status">{status}</p>
      {error ? <p className="dark-cloud-boneyards-error" role="alert">{error}</p> : null}

      <section aria-label="On this device" className="dark-cloud-boneyard-shelf">
        <h3><NativeDarkCloudText font="medium" scale={1} text="ON THIS DEVICE" /></h3>
        {local.length === 0 ? (
          <p className="dark-cloud-boneyards-note">Nothing saved here yet. Start a new boneyard or import a file.</p>
        ) : (
          <ul>
            {local.map(meta => (
              <BoneyardRow
                busy={null}
                confirming={confirming === `local:${meta.id}`}
                deletePrompt="Delete from this device? This can't be undone."
                detail={`${meta.residents} placed · ${UPDATED.format(meta.updatedAt)}`}
                key={meta.id}
                locked={busy !== null}
                name={displayName(meta.name)}
                onAction={localAction(meta)}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-label="In the cloud" className="dark-cloud-boneyard-shelf">
        <h3><NativeDarkCloudText font="medium" scale={1} text="IN THE CLOUD" /></h3>
        {accountUsername === null ? (
          <p className="dark-cloud-boneyards-note">Sign in to keep boneyards in the cloud.</p>
        ) : cloudError ? (
          <div className="dark-cloud-boneyards-retry">
            <p className="dark-cloud-boneyards-note">{cloudError}</p>
            <NativeUiButton height={44} onClick={() => setCloudRequest(request => request + 1)} scale={0.55} width="fill">RETRY</NativeUiButton>
          </div>
        ) : cloud === null ? (
          <p className="dark-cloud-boneyards-note">Loading your cloud boneyards…</p>
        ) : cloud.length === 0 ? (
          <p className="dark-cloud-boneyards-note">Nothing in the cloud yet. Use Save to cloud in the workshop.</p>
        ) : (
          <ul>
            {cloud.map(item => (
              <BoneyardRow
                busy={busyAction(`cloud:${item.id}`)}
                confirming={confirming === `cloud:${item.id}`}
                deletePrompt="Delete from the cloud? Copies on this device stay."
                detail={`Updated ${UPDATED.format(new Date(item.updatedAt))}`}
                key={item.id}
                locked={busy !== null}
                name={item.name}
                onAction={cloudAction(item)}
              />
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

function BoneyardRow({ busy, confirming, deletePrompt, detail, locked, name, onAction }: {
  busy: RowRequest['action'] | null
  confirming: boolean
  deletePrompt: string
  detail: string
  locked: boolean
  name: string
  onAction: (action: RowAction) => void
}) {
  return (
    <li className="dark-cloud-boneyard-row" data-confirming={confirming || undefined}>
      <span className="dark-cloud-boneyard-copy">
        <strong><NativeDarkCloudText content scale={0.85} text={name} /></strong>
        <small>{confirming ? deletePrompt : detail}</small>
      </span>
      {/* The last button stays mounted as DELETE becomes KEEP, so focus and a repeated click land on the safe choice. */}
      <span className="dark-cloud-boneyard-actions">
        {confirming ? (
          <NativeUiButton aria-label={`Delete ${name}`} disabled={locked} height={44} onClick={() => onAction('confirm')} scale={0.55} width="fill">
            {busy === 'delete' ? 'DELETING...' : 'DELETE'}
          </NativeUiButton>
        ) : (
          <>
            <NativeUiButton aria-label={`Edit ${name}`} disabled={locked} height={44} onClick={() => onAction('edit')} scale={0.55} width="fill">
              {busy === 'edit' ? 'OPENING...' : 'EDIT'}
            </NativeUiButton>
            <NativeUiButton aria-label={`Test ${name}`} disabled={locked} height={44} onClick={() => onAction('test')} scale={0.55} width="fill">
              {busy === 'test' ? 'OPENING...' : 'TEST'}
            </NativeUiButton>
          </>
        )}
        <NativeUiButton
          aria-label={confirming ? `Keep ${name}` : `Delete ${name}`}
          disabled={locked}
          height={44}
          onClick={() => onAction(confirming ? 'keep' : 'delete')}
          scale={0.55}
          width="fill"
        >
          {confirming ? 'KEEP' : 'DELETE'}
        </NativeUiButton>
      </span>
    </li>
  )
}

function displayName(name: string): string {
  return name.trim() || 'Untitled Acre'
}

function messageOf(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback
}

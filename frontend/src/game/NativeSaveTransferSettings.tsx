import { useRef, useState } from 'react'

import {
  NativeUiSettingsAction,
  NativeUiSettingsGroup,
} from './native-ui/react.ts'

export interface NativeSaveImportPreview {
  readonly discipline: string
  readonly displayName: string
  readonly document: string
  readonly element: string
  readonly gold: number
  readonly hagathaPerks: number
  readonly learnedRows: number
  readonly level: number
  readonly warnings: readonly string[]
}

export interface NativeSaveExportArchive {
  readonly archive: Uint8Array
  readonly warnings: readonly string[]
}

export interface NativeSaveTransferController {
  readonly canExport: boolean
  exportCurrent: () => Promise<NativeSaveExportArchive>
  inspectImport: (files: FileList) => Promise<NativeSaveImportPreview>
  replaceWithImport: (document: string) => Promise<void>
}

export default function NativeSaveTransferSettings({
  controller,
}: {
  controller: NativeSaveTransferController
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<NativeSaveImportPreview | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const inspect = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    setPendingImport(null)
    setStatus(null)
    try {
      setPendingImport(await controller.inspectImport(files))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The stock save could not be inspected.')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
      setBusy(false)
    }
  }

  const applyImport = async () => {
    if (!pendingImport) return
    setBusy(true)
    setError(null)
    try {
      await controller.replaceWithImport(pendingImport.document)
      setPendingImport(null)
      setStatus('Stock progression imported. Close Settings and choose Last Game.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The stock save could not replace this slot.')
    } finally {
      setBusy(false)
    }
  }

  const exportCurrent = async () => {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const exported = await controller.exportCurrent()
      if (
        exported.warnings.length > 0
        && !window.confirm(`${exported.warnings.join('\n\n')}\n\nExport anyway?`)
      ) return
      const url = URL.createObjectURL(new Blob(
        [new Uint8Array(exported.archive)],
        { type: 'application/zip' },
      ))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `solomon-dark-stock-save-${Date.now()}.zip`
      anchor.click()
      URL.revokeObjectURL(url)
      setStatus('Stock-compatible archive with browser support state downloaded.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The stock save could not be exported.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="native-save-transfer-settings">
      <p className="native-save-transfer-intro">
        Move permanent wizard progression between stock Solomon Dark and this browser slot.
        Stock imports resume in the Hub. Exports also include browser-game-save.json so a
        Website run can be supplied for support; retail Solomon Dark ignores that file.
      </p>
      <NativeUiSettingsGroup title="IMPORT FROM STOCK">
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept=".zip,.cfg,.sav"
            multiple
            onChange={event => { void inspect(event.currentTarget.files) }}
          />
          <NativeUiSettingsAction
            autoFocus
            disabled={busy}
            label="CHOOSE STOCK SAVE FILES"
            onClick={() => fileInput.current?.click()}
          />
      </NativeUiSettingsGroup>
      <NativeUiSettingsGroup title="EXPORT FOR STOCK">
          <NativeUiSettingsAction
            disabled={busy || !controller.canExport}
            label="DOWNLOAD STOCK SAVE ARCHIVE"
            onClick={() => { void exportCurrent() }}
          />
        {!controller.canExport ? (
          <p className="native-save-transfer-note">Create or import a wizard before exporting.</p>
        ) : null}
      </NativeUiSettingsGroup>
      {pendingImport ? (
        <section className="native-save-transfer-preview" aria-label="Stock import preview">
          <h3>{pendingImport.displayName}</h3>
          <p>
            Level {pendingImport.level} · {pendingImport.element} / {pendingImport.discipline}
            {' · '}{pendingImport.gold} gold
          </p>
          <p>
            {pendingImport.learnedRows} learned rows · {pendingImport.hagathaPerks} Hagatha perks
          </p>
          {pendingImport.warnings.map(warning => <p key={warning}>{warning}</p>)}
          <div>
            <button disabled={busy} onClick={() => { void applyImport() }} type="button">
              REPLACE BROWSER SLOT
            </button>
            <button disabled={busy} onClick={() => setPendingImport(null)} type="button">
              CANCEL
            </button>
          </div>
        </section>
      ) : null}
      {error ? <p className="native-save-transfer-error" role="alert">{error}</p> : null}
      {status ? <p className="native-save-transfer-status" role="status">{status}</p> : null}
    </div>
  )
}

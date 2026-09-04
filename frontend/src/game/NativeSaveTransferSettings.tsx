import { useRef, useState } from 'react'
import type { GameSaveImportPreview } from './save/game-save-files.ts'

import {
  NativeUiSettingsAction,
  NativeUiSettingsGroup,
} from './native-ui/react.ts'

export interface NativeSaveExportArchive {
  readonly archive: Uint8Array
  readonly warnings: readonly string[]
}

export interface NativeSaveTransferController {
  readonly canExport: boolean
  exportCurrent: () => Promise<NativeSaveExportArchive>
  inspectImport: (files: FileList) => Promise<GameSaveImportPreview>
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
  const [pendingImport, setPendingImport] = useState<GameSaveImportPreview | null>(null)
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
      setError(cause instanceof Error ? cause.message : 'The save could not be inspected.')
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
      setStatus('Save imported. Close Settings and choose Last Game.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The save could not replace this slot.')
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
        && !window.confirm(`These limitations apply when loading in stock Solomon Dark. The browser save retains your inventory and run.\n\n${exported.warnings.join('\n\n')}\n\nExport anyway?`)
      ) return
      const url = URL.createObjectURL(new Blob(
        [new Uint8Array(exported.archive)],
        { type: 'application/zip' },
      ))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `solomon-dark-save-${Date.now()}.zip`
      anchor.click()
      URL.revokeObjectURL(url)
      setStatus('Save archive downloaded, including inventory and your saved run.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The stock save could not be exported.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="native-save-transfer-settings">
      <p className="native-save-transfer-intro">
        Browser exports retain your inventory, equipment, and saved run.
        Import the ZIP to restore them. Stock-only saves import progression into the Hub.
      </p>
      <NativeUiSettingsGroup title="IMPORT SAVE">
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept=".zip,.json,.cfg,.sav"
            multiple
            onChange={event => { void inspect(event.currentTarget.files) }}
          />
          <NativeUiSettingsAction
            autoFocus
            disabled={busy}
            label="CHOOSE SAVE FILES"
            onClick={() => fileInput.current?.click()}
          />
      </NativeUiSettingsGroup>
      <NativeUiSettingsGroup title="EXPORT SAVE">
          <NativeUiSettingsAction
            disabled={busy || !controller.canExport}
            label="DOWNLOAD SAVE ARCHIVE"
            onClick={() => { void exportCurrent() }}
          />
        {!controller.canExport ? (
          <p className="native-save-transfer-note">Create or import a wizard before exporting.</p>
        ) : null}
      </NativeUiSettingsGroup>
      {pendingImport ? (
        <section className="native-save-transfer-preview" aria-label="Save import preview">
          <h3>{pendingImport.displayName}</h3>
          <p>
            Level {pendingImport.level} · {pendingImport.element} / {pendingImport.discipline}
            {' · '}{pendingImport.gold} gold
          </p>
          <p>
            {pendingImport.learnedRows} learned rows · {pendingImport.hagathaPerks} Hagatha perks
          </p>
          <p>{pendingImport.source === 'browser'
            ? 'Browser save: inventory, equipment, and the saved run will be restored.'
            : 'Stock progression only: inventory is not imported; play starts in the Hub.'}</p>
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

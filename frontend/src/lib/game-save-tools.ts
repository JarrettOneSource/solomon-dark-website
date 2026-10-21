import { gameArtifactUrl } from './game-artifact.ts'

/** The public save-tools WASM ABI. Validation and conversion are Rust-owned. */
export interface GameSaveImportPreview {
  readonly discipline: string
  readonly displayName: string
  readonly document: string
  readonly element: string
  readonly gold: number
  readonly hagathaPerks: number
  readonly learnedRows: number
  readonly level: number
  readonly source: 'browser' | 'stock'
  readonly warnings: readonly string[]
}

interface NativeArchiveExport {
  readonly archive: Uint8Array
  readonly portable: unknown
  readonly warnings: readonly string[]
}

interface SaveToolsModule {
  default(): Promise<unknown>
  readGameSaveFileSelection(files: FileList | readonly File[]): Promise<GameSaveImportPreview>
  exportWebGameSaveToNativeArchive(document: string): Promise<NativeArchiveExport>
}

let loading: Promise<SaveToolsModule> | undefined

function saveTools(): Promise<SaveToolsModule> {
  loading ??= (async () => {
    const url = gameArtifactUrl('save-tools/solomon_save_tools.js')
    const module: SaveToolsModule = await import(/* @vite-ignore */ url)
    await module.default()
    return module
  })().catch((error: unknown) => {
    loading = undefined
    throw error
  })
  return loading
}

export async function readGameSaveFileSelection(files: FileList | readonly File[]): Promise<GameSaveImportPreview> {
  return (await saveTools()).readGameSaveFileSelection(files)
}

export async function exportWebGameSaveToNativeArchive(document: string): Promise<NativeArchiveExport> {
  return (await saveTools()).exportWebGameSaveToNativeArchive(document)
}

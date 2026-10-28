import { gameArtifactUrl } from './game-artifact.ts'
import { gameRuntime } from './game-runtime.ts'

/** Common preview returned by the selected client's native-save importer. */
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
  if (gameRuntime === 'pixi') {
    return (await import('../game/save/game-save-files.ts')).readGameSaveFileSelection(files)
  }
  return (await saveTools()).readGameSaveFileSelection(files)
}

export async function exportWebGameSaveToNativeArchive(document: string): Promise<NativeArchiveExport> {
  if (gameRuntime === 'pixi') {
    return (await import('../game/save/game-save-portability.ts')).exportWebGameSaveToNativeArchive(document)
  }
  return (await saveTools()).exportWebGameSaveToNativeArchive(document)
}

import {
  readNativeSaveArchive,
  readZip,
  WEB_GAME_SAVE_SUPPORT_ARCHIVE_PATH,
} from './native-save-archive.ts'
import { loadNativeHubTemplate } from './native-save-bridge.ts'
import {
  createNativeGameSaveSource,
  createPortableGameProfileFromNative,
  type NativeGameSaveSource,
  type PortableGameProfile,
} from './portable-game-profile.ts'
import { createWebGameSaveFromPortableProfile } from './game-save-portability.ts'
import { createGameSaveDocument, restoreGameSaveDocument } from './game-save-document.ts'
import { MAX_WEB_GAME_SAVE_BYTES } from './game-save-contract.ts'

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

const decoder = new TextDecoder('utf-8', { fatal: true })

const DEFAULT_RUN_NAME = '_survival'
const STANDALONE_GAMESTATE_WARNING =
  'Only gamestate.sav was supplied. Wizard progression was imported from it; missing '
  + 'darkdata.cfg profile fields start from stock defaults (500 gold, fresh NPC/profile '
  + 'state, and empty Luthacus storage).'

function gamestateRunName(path: string): string {
  const parts = path.split('/').filter(Boolean)
  const candidate = parts.length >= 2 ? parts[parts.length - 2]! : ''
  return /^[A-Za-z0-9._-]{1,64}$/.test(candidate) ? candidate : DEFAULT_RUN_NAME
}

function isGamestatePath(path: string): boolean {
  return path.split('/').at(-1)?.toLowerCase() === 'gamestate.sav'
}

async function createStandaloneGamestateProfile(
  gamestate: Uint8Array,
  runName: string,
): Promise<PortableGameProfile> {
  const template = await loadNativeHubTemplate()
  return createPortableGameProfileFromNative(
    template.darkdata,
    gamestate,
    runName,
    [],
    [STANDALONE_GAMESTATE_WARNING],
  )
}

function previewSave(
  document: string,
  source: GameSaveImportPreview['source'],
  warnings: readonly string[],
  nativeSource?: NativeGameSaveSource,
): GameSaveImportPreview {
  const restored = restoreGameSaveDocument(document)
  const ownerIndex = restored.state.playerEntities.identities.findIndex(
    identity => identity.playerId === restored.playerId,
  )
  const character = restored.state.playerEntities.configs[ownerIndex]!
  const economy = restored.state.playerEntities.economies[ownerIndex]!
  const progression = restored.state.playerEntities.progressions[ownerIndex]!
  const skillBook = restored.state.playerEntities.skillBooks[ownerIndex]!
  return Object.freeze({
    discipline: character.discipline,
    displayName: character.displayName,
    document: createGameSaveDocument({
      integrity: 'local-only',
      loadedBoneyard: restored.loadedBoneyard,
      mods: restored.mods,
      modState: restored.modState,
      nativeSource: source === 'stock' ? restored.nativeSource : nativeSource ?? null,
      partyRejoinToken: null,
      playerId: restored.playerId,
      state: restored.state,
    }),
    element: character.element,
    gold: economy.gold,
    hagathaPerks: economy.ownedPerkSelectors.length,
    learnedRows: skillBook.permanentRanks.filter(rank => rank > 0).length,
    level: progression.level,
    source,
    warnings,
  })
}

function previewStock(profile: PortableGameProfile): GameSaveImportPreview {
  const imported = createWebGameSaveFromPortableProfile(profile)
  return previewSave(imported.document, 'stock', imported.warnings)
}

export async function readGameSaveFileSelection(
  selection: FileList | readonly File[],
): Promise<GameSaveImportPreview> {
  const files = [...selection]
  if (files.length === 0) throw new Error('Choose a save first.')
  if (files.length === 1 && files[0]!.name.toLowerCase().endsWith('.json')) {
    if (files[0]!.size > MAX_WEB_GAME_SAVE_BYTES) throw new Error('The browser save is too large.')
    return previewSave(decoder.decode(await files[0]!.arrayBuffer()), 'browser', [])
  }
  if (files.length === 1 && files[0]!.name.toLowerCase().endsWith('.zip')) {
    const archiveBytes = new Uint8Array(await files[0]!.arrayBuffer())
    const archiveFiles = await readZip(archiveBytes)
    if ([...archiveFiles.keys()].some(path => path.toLowerCase() === 'manifest.json')) {
      const archive = await readNativeSaveArchive(archiveBytes)
      const retainedFiles = (archive.retainedFiles ?? []).filter(({ path }) => (
        path.toLowerCase() !== WEB_GAME_SAVE_SUPPORT_ARCHIVE_PATH
      ))
      const browserSave = archive.retainedFiles?.find(({ path }) => (
        path.toLowerCase() === WEB_GAME_SAVE_SUPPORT_ARCHIVE_PATH
      ))
      if (browserSave) {
        const nativeSource = await createNativeGameSaveSource(
          archive.darkdata, archive.gamestate, archive.runName, retainedFiles,
        )
        return previewSave(decoder.decode(browserSave.bytes), 'browser', [], nativeSource)
      }
      return previewStock(await createPortableGameProfileFromNative(
        archive.darkdata,
        archive.gamestate,
        archive.runName,
        retainedFiles,
      ))
    }
    const entries = [...archiveFiles.entries()]
    if (entries.length !== 1 || !isGamestatePath(entries[0]![0])) {
      throw new Error('A ZIP without manifest.json must contain only one gamestate.sav.')
    }
    return previewStock(await createStandaloneGamestateProfile(
      entries[0]![1], gamestateRunName(entries[0]![0]),
    ))
  }

  const darkdataFile = files.find(file => file.name.toLowerCase() === 'darkdata.cfg')
  const gamestateFile = files.find(file => file.name.toLowerCase() === 'gamestate.sav')
  if (files.length === 1 && gamestateFile) {
    return previewStock(await createStandaloneGamestateProfile(
      new Uint8Array(await gamestateFile.arrayBuffer()),
      gamestateRunName(gamestateFile.webkitRelativePath),
    ))
  }
  if (!darkdataFile || !gamestateFile || files.length !== 2) {
    throw new Error(
      'Choose a browser save JSON, a save ZIP, one gamestate.sav, or darkdata.cfg and gamestate.sav together.',
    )
  }
  const darkdata = new Uint8Array(await darkdataFile.arrayBuffer())
  const gamestate = new Uint8Array(await gamestateFile.arrayBuffer())
  const runName = gamestateRunName(gamestateFile.webkitRelativePath)
  return previewStock(await createPortableGameProfileFromNative(
    darkdata,
    gamestate,
    runName,
  ))
}

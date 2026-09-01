import {
  readNativeSaveArchive,
  readZip,
  WEB_GAME_SAVE_SUPPORT_ARCHIVE_PATH,
} from './native-save-archive.ts'
import { loadNativeHubTemplate } from './native-save-bridge.ts'
import {
  createPortableGameProfileFromNative,
  type PortableGameProfile,
} from './portable-game-profile.ts'

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

export async function readNativeSaveFileSelection(
  selection: FileList | readonly File[],
): Promise<PortableGameProfile> {
  const files = [...selection]
  if (files.length === 0) throw new Error('Choose a native save first.')
  if (files.length === 1 && files[0]!.name.toLowerCase().endsWith('.zip')) {
    const archiveBytes = new Uint8Array(await files[0]!.arrayBuffer())
    const archiveFiles = await readZip(archiveBytes)
    if ([...archiveFiles.keys()].some(path => path.toLowerCase() === 'manifest.json')) {
      const archive = await readNativeSaveArchive(archiveBytes)
      return createPortableGameProfileFromNative(
        archive.darkdata,
        archive.gamestate,
        archive.runName,
        (archive.retainedFiles ?? []).filter(({ path }) => (
          path.toLowerCase() !== WEB_GAME_SAVE_SUPPORT_ARCHIVE_PATH
        )),
      )
    }
    const entries = [...archiveFiles.entries()]
    if (entries.length !== 1 || !isGamestatePath(entries[0]![0])) {
      throw new Error('A ZIP without manifest.json must contain only one gamestate.sav.')
    }
    return createStandaloneGamestateProfile(entries[0]![1], gamestateRunName(entries[0]![0]))
  }

  const darkdataFile = files.find(file => file.name.toLowerCase() === 'darkdata.cfg')
  const gamestateFile = files.find(file => file.name.toLowerCase() === 'gamestate.sav')
  if (files.length === 1 && gamestateFile) {
    return createStandaloneGamestateProfile(
      new Uint8Array(await gamestateFile.arrayBuffer()),
      gamestateRunName(gamestateFile.webkitRelativePath),
    )
  }
  if (!darkdataFile || !gamestateFile || files.length !== 2) {
    throw new Error(
      'Choose one gamestate.sav, a single-save ZIP, or darkdata.cfg and gamestate.sav together.',
    )
  }
  const darkdata = new Uint8Array(await darkdataFile.arrayBuffer())
  const gamestate = new Uint8Array(await gamestateFile.arrayBuffer())
  const runName = gamestateRunName(gamestateFile.webkitRelativePath)
  return createPortableGameProfileFromNative(
    darkdata,
    gamestate,
    runName,
  )
}

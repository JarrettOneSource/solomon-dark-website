import { readNativeSaveArchive } from './native-save-archive.ts'
import {
  createPortableGameProfileFromNative,
  type PortableGameProfile,
} from './portable-game-profile.ts'

export async function readNativeSaveFileSelection(
  selection: FileList | readonly File[],
): Promise<PortableGameProfile> {
  const files = [...selection]
  if (files.length === 0) throw new Error('Choose a native save first.')
  let darkdata: Uint8Array
  let gamestate: Uint8Array
  let runName = '_survival'
  const archive = files.length === 1 && files[0]!.name.toLowerCase().endsWith('.zip')
    ? await readNativeSaveArchive(new Uint8Array(await files[0]!.arrayBuffer()))
    : null
  if (archive) {
    ({ darkdata, gamestate, runName } = archive)
  } else {
    const darkdataFile = files.find(file => file.name.toLowerCase() === 'darkdata.cfg')
    const gamestateFile = files.find(file => file.name.toLowerCase() === 'gamestate.sav')
    if (!darkdataFile || !gamestateFile || files.length !== 2) {
      throw new Error('Choose one launcher save ZIP, or darkdata.cfg and gamestate.sav together.')
    }
    darkdata = new Uint8Array(await darkdataFile.arrayBuffer())
    gamestate = new Uint8Array(await gamestateFile.arrayBuffer())
    const path = gamestateFile.webkitRelativePath.split('/').filter(Boolean)
    const candidate = path.length >= 2 ? path[path.length - 2]! : ''
    if (/^[A-Za-z0-9._-]{1,64}$/.test(candidate)) runName = candidate
  }
  return createPortableGameProfileFromNative(
    darkdata,
    gamestate,
    runName,
    archive?.retainedFiles ?? [],
  )
}

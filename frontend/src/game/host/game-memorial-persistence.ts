import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute } from 'node:path'

import {
  copyHubMemorialState,
  createHubMemorialState,
  type HubMemorialState,
} from '../core-kernels/hub-memorial.ts'
import { decodeHubMemorialState } from '../protocol/game-protocol.ts'

const MAX_GAME_MEMORIAL_BYTES = 256 * 1024

export interface GameMemorialPersistence {
  readonly initialState: HubMemorialState
  persist(state: HubMemorialState): void
}

export function openGameMemorialPersistence(path: string): GameMemorialPersistence {
  if (!isAbsolute(path)) throw new Error('Game memorial path must be absolute')
  const directory = dirname(path)
  mkdirSync(directory, { mode: 0o750, recursive: true })
  const initialState = readMemorial(path)

  return {
    initialState,
    persist(state) {
      const document = JSON.stringify({ state })
      if (Buffer.byteLength(document, 'utf8') > MAX_GAME_MEMORIAL_BYTES) {
        throw new Error('Game memorial state exceeds its bounded document size')
      }
      const temporaryPath = `${path}.${process.pid}.tmp`
      const file = openSync(temporaryPath, 'w', 0o600)
      try {
        writeFileSync(file, `${document}\n`, 'utf8')
        fsyncSync(file)
      } finally {
        closeSync(file)
      }
      renameSync(temporaryPath, path)
      // Windows requires write access to flush a directory handle.
      const directoryHandle = openSync(directory, process.platform === 'win32' ? 'r+' : 'r')
      try {
        fsyncSync(directoryHandle)
      } finally {
        closeSync(directoryHandle)
      }
    },
  }
}

function readMemorial(path: string): HubMemorialState {
  let size: number
  try {
    size = statSync(path).size
  } catch (error) {
    if (isMissingFile(error)) return createHubMemorialState()
    throw error
  }
  if (size > MAX_GAME_MEMORIAL_BYTES) {
    throw new Error('Game memorial state exceeds its bounded document size')
  }
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Game memorial document must be an object')
  }
  const source = parsed as Record<string, unknown>
  return copyHubMemorialState(decodeHubMemorialState(source.state, 'gameMemorial.state'))
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error
    && 'code' in error
    && (error as NodeJS.ErrnoException).code === 'ENOENT'
}

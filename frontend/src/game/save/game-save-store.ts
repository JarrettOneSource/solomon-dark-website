import { api, ApiError } from '../../lib/api.ts'
import { WEB_GAME_SAVE_SCHEMA_VERSION, WEB_GAME_SAVE_SLOT } from './game-save-contract.ts'

export interface StoredGameSave {
  readonly document: string
  readonly formatVersion: number
  readonly revision: number
  readonly sha256: string
  readonly slot: number
  readonly updatedAtUtc: string
}

export interface GameSaveStore {
  read(): Promise<StoredGameSave | null>
  write(document: string, expectedRevision: number): Promise<StoredGameSave>
}

export function createCloudGameSaveStore(): GameSaveStore {
  return {
    async read() {
      try {
        return await api.gameSaves.get(WEB_GAME_SAVE_SLOT)
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
    write: (document, expectedRevision) => api.gameSaves.put(
      WEB_GAME_SAVE_SLOT,
      { document, expectedRevision },
    ),
  }
}

const LOCAL_DATABASE_NAME = 'solomon-dark-game-saves'
const LOCAL_DATABASE_VERSION = 1
const LOCAL_STORE_NAME = 'slots'

export function createLocalGameSaveStore(factory: IDBFactory = indexedDB): GameSaveStore {
  const database = openDatabase(factory)
  return {
    async read() {
      const db = await database
      return requestResult<StoredGameSave | undefined>(
        db.transaction(LOCAL_STORE_NAME, 'readonly')
          .objectStore(LOCAL_STORE_NAME)
          .get(WEB_GAME_SAVE_SLOT),
      ).then((record) => record ?? null)
    },
    async write(document, expectedRevision) {
      const documentSha256 = await sha256(document)
      const db = await database
      const transaction = db.transaction(LOCAL_STORE_NAME, 'readwrite')
      const store = transaction.objectStore(LOCAL_STORE_NAME)
      const existing = await requestResult<StoredGameSave | undefined>(
        store.get(WEB_GAME_SAVE_SLOT),
      )
      if ((existing?.revision ?? 0) !== expectedRevision) {
        transaction.abort()
        throw new Error('Local game save changed in another tab.')
      }
      const record: StoredGameSave = {
        document,
        formatVersion: WEB_GAME_SAVE_SCHEMA_VERSION,
        revision: expectedRevision + 1,
        sha256: documentSha256,
        slot: WEB_GAME_SAVE_SLOT,
        updatedAtUtc: new Date().toISOString(),
      }
      store.put(record)
      await transactionDone(transaction)
      return record
    },
  }
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(LOCAL_DATABASE_NAME, LOCAL_DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(LOCAL_STORE_NAME)) {
        request.result.createObjectStore(LOCAL_STORE_NAME, { keyPath: 'slot' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Local game save database failed.'))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Local game save request failed.'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('Local game save transaction aborted.'))
    transaction.onerror = () => reject(transaction.error ?? new Error('Local game save transaction failed.'))
  })
}

async function sha256(document: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(document))
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

import { websiteStorageKey } from '../lib/website-mount.ts'

const DATABASE = 'solomon-dark-boneyard-workshop'
const STORE = 'requests'
const TOKEN_KEY = 'sdr:boneyard:workshop:'

function unavailable(): Error {
  return new Error('This workshop request is no longer available. Open the boneyard from The Dark Cloud again.')
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(websiteStorageKey(DATABASE), 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function writePayload(database: IDBDatabase, id: string, value: unknown, remove = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('The workshop request could not be saved.'))
    const store = transaction.objectStore(STORE)
    if (remove) store.delete(id)
    else store.add(value, id)
  })
}

function takePayload(database: IDBDatabase, id: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite')
    const store = transaction.objectStore(STORE)
    const request = store.get(id)
    let value: unknown
    request.onsuccess = () => {
      value = request.result
      store.delete(id)
    }
    // Resolve only after the deletion commits, so a reload cannot replay it.
    transaction.oncomplete = () => resolve(value)
    transaction.onabort = () => reject(transaction.error ?? new Error('The workshop request could not be opened.'))
  })
}

/** Keep a tiny tab-scoped token; valid cloud documents can exceed Web Storage's quota. */
export async function putWorkshopRequest(value: unknown): Promise<string> {
  const id = crypto.randomUUID()
  const database = await openDatabase()
  try {
    await writePayload(database, id, value)
    try {
      sessionStorage.setItem(websiteStorageKey(TOKEN_KEY + id), id)
    } catch (reason) {
      await writePayload(database, id, undefined, true)
      throw reason
    }
    return id
  } finally {
    database.close()
  }
}

/** Retire both halves of the handoff, including invalid payloads. */
export async function consumeWorkshopRequest(id: string): Promise<unknown> {
  const key = websiteStorageKey(TOKEN_KEY + id)
  const token = sessionStorage.getItem(key)
  sessionStorage.removeItem(key)
  if (token !== id) throw unavailable()
  const database = await openDatabase()
  try {
    const value = await takePayload(database, id)
    if (value === undefined) throw unavailable()
    return value
  } finally {
    database.close()
  }
}

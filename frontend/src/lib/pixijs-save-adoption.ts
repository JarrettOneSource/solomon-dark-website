// When the Rust game replaces PixiJS at /game, a returning player's PixiJS guest
// save and preferences become the Rust game's, with nothing for the player to do.
// The Rust game keeps its data under its own storage namespace; PixiJS used the
// unsuffixed names on this origin.
const saveDatabase = 'solomon-dark-game-saves'
const rustNamespace = '/game-rust'
const marker = 'migration:pixijs-adoption'
const backupKey = 'backup:pixijs-adoption'

interface SaveRecord { slot: number | string, revision: number, document: string }

export type AdoptionResult = 'complete' | 'empty' | 'adopted' | 'same' | 'replaced' | 'kept'

/** Which save a player continues when both games have one. Both copies come from one
 * fork at the parallel launch and count revisions from it, so the copy written more
 * often since then is the one the player kept playing; a tie keeps PixiJS's, the
 * save most players have. The other copy is kept as a backup. */
export function adoptPixiJsSave(pixi: SaveRecord | undefined, rust: SaveRecord | undefined): 'empty' | 'adopted' | 'same' | 'replaced' | 'kept' {
  if (pixi === undefined) return 'empty'
  if (rust === undefined) return 'adopted'
  if (pixi.document === rust.document) return 'same'
  return pixi.revision >= rust.revision ? 'replaced' : 'kept'
}

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('slots', { keyPath: 'slot' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('Saved-game adoption was interrupted.'))
    transaction.onerror = () => reject(transaction.error)
  })
}

// The legacy v2 Hall of Fame is read beside v3 and keeps its own row shape.
const copiedPreferences = ['solomon-dark-game-settings-v1', 'solomon-dark-mobile-ui-layout-v1',
  'sdr.game.hall-of-fame.v2']
const hallKey = 'sdr.game.hall-of-fame.v3'
const playtimeKey = 'sdr.game.playtime.v1'
const rustKey = (key: string) => `${key}:${rustNamespace}`

/** The rows of a Hall of Fame document, or undefined when it is not a list of runs. */
function hallRows(text: string | null): Record<string, unknown>[] | undefined {
  if (text === null) return []
  try {
    const rows = JSON.parse(text)
    return Array.isArray(rows) && rows.every(row => row && typeof row.runId === 'string') ? rows : undefined
  } catch { return undefined }
}

function playtime(text: string | null): number {
  const value = Number(text ?? 0)
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

/** Settings, layout and the legacy Hall of Fame follow only where the Rust game has
 * none; current Hall of Fame rows are combined by run, the Rust game's row winning a
 * shared run; playtime adds up. A key the Rust game cannot read is left alone. */
function adoptPreferences(storage: Storage) {
  for (const key of copiedPreferences) {
    const value = storage.getItem(key)
    if (value !== null && storage.getItem(rustKey(key)) === null) storage.setItem(rustKey(key), value)
  }
  const rustText = storage.getItem(rustKey(hallKey))
  const rust = hallRows(rustText)
  if (rustText === null || rust !== undefined) {
    const seen = new Set((rust ?? []).map(row => row.runId))
    const pixi = (hallRows(storage.getItem(hallKey)) ?? []).filter(row => !seen.has(row.runId))
    if (pixi.length > 0) storage.setItem(rustKey(hallKey), JSON.stringify([...(rust ?? []), ...pixi]))
  }
  const total = playtime(storage.getItem(playtimeKey)) + playtime(storage.getItem(rustKey(playtimeKey)))
  if (total > 0 && Number.isSafeInteger(total)) storage.setItem(rustKey(playtimeKey), String(total))
}

/** Adopt PixiJS's guest save and preferences once per browser. The marker shares the
 * Rust save's transaction, so simultaneous tabs and reloads adopt exactly once, and
 * only the tab that wrote the marker merges preferences. */
export async function adoptPixiJsGuestData(storage: Storage = localStorage): Promise<AdoptionResult> {
  const source = await openDatabase(saveDatabase)
  let pixi: SaveRecord | undefined
  try {
    pixi = await requestResult(source.transaction('slots').objectStore('slots').get(0))
  } finally { source.close() }
  const destination = await openDatabase(`${saveDatabase}:${rustNamespace}`)
  let result: AdoptionResult = 'complete'
  try {
    const transaction = destination.transaction('slots', 'readwrite')
    const done = transactionDone(transaction)
    const slots = transaction.objectStore('slots')
    const [adopted, rust] = await Promise.all([
      requestResult(slots.get(marker)), requestResult(slots.get(0)) as Promise<SaveRecord | undefined>,
    ])
    if (adopted === undefined) {
      result = adoptPixiJsSave(pixi, rust)
      if (result === 'adopted' || result === 'replaced') slots.put({ ...pixi, slot: 0 })
      if (result === 'replaced') slots.put({ ...rust, slot: backupKey, source: 'rust' })
      if (result === 'kept') slots.put({ ...pixi, slot: backupKey, source: 'pixijs' })
      slots.put({ slot: marker, result })
    }
    await done
  } finally { destination.close() }
  if (result !== 'complete') adoptPreferences(storage)
  return result
}

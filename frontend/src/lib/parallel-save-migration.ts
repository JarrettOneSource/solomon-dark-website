const sourceName = 'solomon-dark-game-saves'
const destinationName = `${sourceName}:/game-rust`
const marker = 'migration:primary-to-rust'

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
    transaction.onabort = () => reject(transaction.error ?? new Error('Saved-game migration was interrupted.'))
    transaction.onerror = () => reject(transaction.error)
  })
}

/** Fork the old Rust continuation before either newly mounted game can write it.
 * The marker shares the destination transaction so retries, simultaneous tabs
 * and an intentional later deletion cannot copy the root game's progress again.
 */
export async function migrateParallelGuestSave(): Promise<'copied' | 'preserved' | 'empty' | 'complete'> {
  const source = await openDatabase(sourceName)
  let saved: unknown
  try {
    saved = await requestResult(source.transaction('slots').objectStore('slots').get(0))
  } finally { source.close() }
  const destination = await openDatabase(destinationName)
  try {
    const transaction = destination.transaction('slots', 'readwrite')
    const done = transactionDone(transaction)
    const slots = transaction.objectStore('slots')
    const completed = slots.get(marker)
    const existing = slots.get(0)
    const [migration, current] = await Promise.all([requestResult(completed), requestResult(existing)])
    let result: 'copied' | 'preserved' | 'empty' | 'complete' = 'complete'
    if (migration === undefined) {
      result = current !== undefined ? 'preserved' : saved === undefined ? 'empty' : 'copied'
      if (result === 'copied') slots.put(saved)
      slots.put({ slot: marker, source: sourceName })
    }
    await done
    return result
  } finally { destination.close() }
}

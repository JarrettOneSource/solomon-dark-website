export const PLAYTIME_STORAGE_KEY = 'sdr.game.playtime.v1'
export const PLAYTIME_FLUSH_INTERVAL_MS = 30_000

interface PlaytimeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface TrackPlaytimeOptions {
  intervalMs?: number
  now?: () => number
  schedule?: (callback: () => void, intervalMs: number) => () => void
  storage?: PlaytimeStorage
}

export function readTotalPlaytimeMs(
  storage: Pick<PlaytimeStorage, 'getItem'> = localStorage,
): number {
  const raw = storage.getItem(PLAYTIME_STORAGE_KEY)
  if (!raw) return 0
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
}

/**
 * Accumulates wall-clock time on the game page into persistent storage,
 * flushing on an interval and when the page is hidden. Returns a stop
 * function that performs a final flush.
 */
export function trackPlaytime(options: TrackPlaytimeOptions = {}): () => void {
  const storage = options.storage ?? localStorage
  const now = options.now ?? Date.now
  const schedule = options.schedule ?? ((callback, intervalMs) => {
    const interval = setInterval(callback, intervalMs)
    window.addEventListener('pagehide', callback)
    return () => {
      clearInterval(interval)
      window.removeEventListener('pagehide', callback)
    }
  })
  let markedAtMs = now()
  let stopped = false
  const flush = () => {
    if (stopped) return
    const flushedAtMs = now()
    const elapsedMs = Math.max(0, Math.round(flushedAtMs - markedAtMs))
    markedAtMs = flushedAtMs
    if (elapsedMs === 0) return
    storage.setItem(
      PLAYTIME_STORAGE_KEY,
      String(readTotalPlaytimeMs(storage) + elapsedMs),
    )
  }
  const cancel = schedule(flush, options.intervalMs ?? PLAYTIME_FLUSH_INTERVAL_MS)
  return () => {
    flush()
    stopped = true
    cancel()
  }
}

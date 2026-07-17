import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tiny data hook: loads once, optionally re-polls on an interval,
 * exposes { data, error, loading, reload }. Keeps stale data visible
 * during background refreshes so polling never flickers the UI.
 */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = [], pollMs?: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true)
    try {
      const result = await fnRef.current()
      setData(result)
      setError(null)
    } catch (e) {
      if (!background) setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      if (!background) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    load()
    if (!pollMs) return
    const id = setInterval(() => load(true), pollMs)
    return () => clearInterval(id)
  }, [load, pollMs])

  return { data, error, loading, reload: () => load(false) }
}

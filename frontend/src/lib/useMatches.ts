import { useEffect, useRef, useState } from 'react'
import { api, type MatchList } from './api'

/**
 * Live match list over SSE. The stream emits `matches` events carrying the
 * same payload as GET /api/matches?includeOffline=true; callers filter by
 * `online` themselves. EventSource handles reconnection on its own — we only
 * surface an error state while we've never received data.
 */
export function useMatches() {
  const [data, setData] = useState<MatchList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hasData = useRef(false)

  useEffect(() => {
    const source = new EventSource(api.matches.eventsUrl)

    // The stream is the live feed, but never let a silent one strand the UI:
    // the plain list answers immediately, and stream events override it.
    api.matches.list().then(
      (list) => {
        if (!hasData.current) {
          hasData.current = true
          setData(list)
          setError(null)
        }
      },
      (err: Error) => {
        if (!hasData.current) setError(err.message)
      },
    )

    source.addEventListener('matches', (event) => {
      hasData.current = true
      setData(JSON.parse((event as MessageEvent).data) as MatchList)
      setError(null)
    })
    source.onerror = () => {
      if (!hasData.current) {
        setError('The crystal ball is cloudy — trying to reconnect…')
      }
    }

    return () => source.close()
  }, [])

  return { data, error, loading: !data && !error }
}

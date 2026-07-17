import { useEffect, useRef, useState } from 'react'
import { api, getToken, type LobbyList } from './api'
import { useAuth } from './auth'
import { readEventStream } from './sse'

/**
 * Live lobby list over SSE, personalized when signed in with a linked Steam
 * account (friend lobbies appear, so the subscription restarts on auth
 * changes). Anonymous viewers use the browser's EventSource; authenticated
 * viewers use the fetch-based reader because EventSource cannot send an
 * Authorization header.
 */
export function useLobbies() {
  const { user } = useAuth()
  const [data, setData] = useState<LobbyList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hasData = useRef(false)

  useEffect(() => {
    hasData.current = false
    const token = getToken()
    const abort = new AbortController()

    const accept = (list: LobbyList) => {
      hasData.current = true
      setData(list)
      setError(null)
    }

    // The stream is the live feed, but never let a silent one strand the UI:
    // the plain list answers immediately, and stream events override it.
    api.lobbies.list().then(
      (list) => {
        if (!hasData.current && !abort.signal.aborted) accept(list)
      },
      (err: Error) => {
        if (!hasData.current && !abort.signal.aborted) setError(err.message)
      },
    )

    if (!token) {
      const source = new EventSource(api.lobbies.eventsUrl)
      source.addEventListener('lobbies', (event) => {
        accept(JSON.parse((event as MessageEvent).data) as LobbyList)
      })
      source.onerror = () => {
        if (!hasData.current) setError('The crystal ball is cloudy — trying to reconnect…')
      }
      abort.signal.addEventListener('abort', () => source.close())
      return () => abort.abort()
    }

    // Authenticated: fetch-based SSE with EventSource-style retry.
    ;(async () => {
      while (!abort.signal.aborted) {
        try {
          await readEventStream(
            api.lobbies.eventsUrl,
            { Authorization: `Bearer ${token}` },
            abort.signal,
            (event, payload) => {
              if (event === 'lobbies') accept(JSON.parse(payload) as LobbyList)
            },
          )
        } catch {
          if (!hasData.current) setError('The crystal ball is cloudy — trying to reconnect…')
        }
        if (!abort.signal.aborted) {
          await new Promise((resolve) => setTimeout(resolve, 3000))
        }
      }
    })()
    return () => abort.abort()
  }, [user?.id])

  return { data, error, loading: !data && !error }
}

import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react'
import type { GameClientSession } from './client/game-client-session.ts'
import { PlayerCardRequests } from './player-card-request.ts'

export function usePlayerCardRequest(session: GameClientSession | null) {
  const requests = useMemo(() => new PlayerCardRequests(session), [session])
  const state = useSyncExternalStore(requests.subscribe, requests.getSnapshot)
  // Teardown invalidates promises and timers before the old session is destroyed.
  useLayoutEffect(() => () => requests.dismiss(), [requests])
  return { ...state, open: requests.open, dismiss: requests.dismiss }
}

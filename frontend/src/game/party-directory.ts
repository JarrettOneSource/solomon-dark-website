import { useCallback, useEffect, useRef, useState } from 'react'

import { api, type PublicGameParty } from '../lib/api.ts'

export interface PartyDirectoryState {
  readonly error: string | null
  readonly loading: boolean
  readonly parties: readonly PublicGameParty[]
  refresh(): Promise<void>
}

export function usePartyDirectory(enabled = true): PartyDirectoryState {
  const generationRef = useRef(0)
  const [parties, setParties] = useState<readonly PublicGameParty[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(enabled)
  const refresh = useCallback(async () => {
    const generation = ++generationRef.current
    setLoading(true)
    try {
      const result = await api.gameParties.list()
      if (generation !== generationRef.current) return
      setParties(result.items)
      setError(null)
    } catch (error) {
      if (generation !== generationRef.current) return
      setError(error instanceof Error ? error.message : 'The party directory could not be loaded.')
    } finally {
      if (generation === generationRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 15_000)
    return () => {
      window.clearInterval(timer)
      generationRef.current += 1
    }
  }, [enabled, refresh])

  return { error, loading, parties, refresh }
}

export function directoryPartyAction(
  party: Pick<PublicGameParty, 'status' | 'visibility'>,
): 'join' | 'request' | 'wait' {
  if (party.status === 'playing') return 'wait'
  return party.visibility === 'public' ? 'join' : 'request'
}

export function directoryPartyPresentation(party: {
  readonly maxMembers: number
  readonly memberCount: number
} & (
  | { readonly boneyardName: null; readonly status: 'hub' }
  | { readonly boneyardName: string; readonly status: 'playing' }
)): {
  readonly location: string
  readonly squad: string
  readonly status: 'IN GAME' | 'IN HUB'
} {
  return {
    location: party.status === 'playing' ? party.boneyardName : 'COLLEGE COURTYARD',
    squad: `${party.memberCount} / ${party.maxMembers}`,
    status: party.status === 'playing' ? 'IN GAME' : 'IN HUB',
  }
}

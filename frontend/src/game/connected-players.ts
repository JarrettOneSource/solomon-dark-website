import { useCallback, useEffect, useRef, useState } from 'react'

import {
  api,
  type ConnectedGamePlayer,
  type DeveloperGameMatch,
} from '../lib/api.ts'

export interface ConnectedPlayersState {
  readonly error: string | null
  readonly loading: boolean
  readonly matches: readonly DeveloperGameMatch[]
  readonly players: readonly ConnectedGamePlayer[]
  refresh(): Promise<void>
}

export function useDeveloperPresence(enabled: boolean): ConnectedPlayersState {
  const generationRef = useRef(0)
  const [players, setPlayers] = useState<readonly ConnectedGamePlayer[]>([])
  const [matches, setMatches] = useState<readonly DeveloperGameMatch[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(enabled)
  const refresh = useCallback(async () => {
    const generation = ++generationRef.current
    setLoading(true)
    try {
      const [playerResult, matchResult] = await Promise.all([
        api.gamePlayers.list(),
        api.gameMatches.list(),
      ])
      if (generation !== generationRef.current) return
      setPlayers(playerResult.items)
      setMatches(matchResult.items)
      setError(null)
    } catch (error) {
      if (generation !== generationRef.current) return
      setError(error instanceof Error ? error.message : 'The connected players could not be loaded.')
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

  return { error, loading, matches, players, refresh }
}

export function connectedPlayerPresentation(player: ConnectedGamePlayer): {
  readonly detail: string
  readonly location: string
  readonly party: string | null
  readonly session: 'GLOBAL HUB' | 'PRIVATE COLLEGE'
  readonly status: string
} {
  return {
    detail: player.bot ? 'ML BOT' : player.accountUsername ?? 'GUEST WIZARD',
    location: player.activity === 'boneyard' ? player.boneyardName : 'COLLEGE COURTYARD',
    party: player.partyLeader === null || player.partySize === null
      ? null
      : `${player.partyLeader}'s party of ${player.partySize}`,
    session: player.session === 'global-hub' ? 'GLOBAL HUB' : 'PRIVATE COLLEGE',
    status: player.activity === 'hub'
      ? 'IN HUB'
      : player.waveNumber > 0 ? `WAVE ${player.waveNumber}` : 'STAGING',
  }
}

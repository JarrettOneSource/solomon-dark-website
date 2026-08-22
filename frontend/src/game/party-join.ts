import { useCallback, useEffect, useRef, useState } from 'react'

import { api, type PartyJoinResolution } from '../lib/api.ts'

export interface PartyJoinActions {
  readonly busy: boolean
  readonly error: string | null
  readonly pendingListingId: string | null
  joinPublic(listingId: string): Promise<void>
  requestInvite(listingId: string): Promise<void>
  resolveCode(code: string): Promise<void>
}

export function usePartyJoinActions(
  requesterDisplayName: string,
  onResolved: (resolution: PartyJoinResolution) => void,
): PartyJoinActions {
  const mountedRef = useRef(true)
  const busyRef = useRef(false)
  const requesterIdRef = useRef(`guest-${randomRequestId()}`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingListingId, setPendingListingId] = useState<string | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const resolve = useCallback(async (operation: () => Promise<PartyJoinResolution>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      const resolution = await operation()
      if (mountedRef.current) onResolved(resolution)
    } catch (error) {
      if (mountedRef.current) setError(message(error))
    } finally {
      busyRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }, [onResolved])

  const joinPublic = useCallback(async (listingId: string) => {
    await resolve(() => api.gameParties.resolvePublic(listingId))
  }, [resolve])

  const resolveCode = useCallback(async (code: string) => {
    await resolve(() => api.gameParties.resolveCode(normalizePartyCode(code)))
  }, [resolve])

  const requestInvite = useCallback(async (listingId: string) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    setPendingListingId(listingId)
    try {
      const { requestToken } = await api.gameParties.requestJoin(
        listingId,
        requesterDisplayName,
        requesterIdRef.current,
      )
      for (;;) {
        await delay(1_000)
        if (!mountedRef.current) return
        const status = await api.gameParties.requestStatus(requestToken)
        if (status.status === 'pending') continue
        if (status.status === 'denied') {
          setError('The party leader denied your request.')
          return
        }
        if (status.status === 'accepted') {
          onResolved({ intentId: status.intentId, target: status.target })
          return
        }
      }
    } catch (error) {
      if (mountedRef.current) setError(message(error))
    } finally {
      busyRef.current = false
      if (mountedRef.current) {
        setBusy(false)
        setPendingListingId(null)
      }
    }
  }, [onResolved, requesterDisplayName])

  return { busy, error, joinPublic, pendingListingId, requestInvite, resolveCode }
}

export function normalizePartyCode(value: string): string {
  const normalized = [...value.toUpperCase()]
    .filter(character => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.includes(character))
    .join('')
    .slice(-8)
  return normalized.length <= 4
    ? normalized
    : `${normalized.slice(0, 4)}-${normalized.slice(4)}`
}

export function completePartyCode(value: string): boolean {
  return /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(normalizePartyCode(value))
}

function randomRequestId(): string {
  return globalThis.crypto?.randomUUID?.().replaceAll('-', '')
    ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'That party is not available right now.'
}

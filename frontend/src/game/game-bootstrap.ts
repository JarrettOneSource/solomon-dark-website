import type { GameEndpoint, GameObserverEndpoint } from './engine.ts'
import './desktop-runtime.ts'
import { websiteBase, websiteUrl } from '../lib/website-mount.ts'

export type BrowserGameAdmission =
  | { readonly kind: 'global-hub' }
  | { readonly kind: 'party'; readonly intentId: string }
  | { readonly kind: 'private-college' }
  | {
      readonly fallback: 'global-hub' | 'private-college'
      readonly kind: 'resume'
      readonly partyRejoinToken: string | null
      readonly saveDocument: string
    }

/** Replace transport only: the selected authority and account are already admitted. */
export async function reconnectBrowserGame(
  endpoint: GameEndpoint,
  identity: { readonly playerId: string; readonly resumeToken: string; readonly requestId: string },
  token: string | null,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<GameEndpoint> {
  if (endpoint.kind !== 'remote') throw new Error('Only hosted games can restore their transport.')
  const original = new URL(endpoint.url)
  const originalPath = websiteBase && original.pathname.startsWith(`${websiteBase}/`)
    ? original.pathname.slice(websiteBase.length) : original.pathname
  const sessionId = endpoint.sessionKind === 'global-hub' ? null
    : /^\/game-sessions\/([A-Za-z0-9_-]{32})$/.exec(originalPath)?.[1]
  if (sessionId === undefined || endpoint.sessionKind === 'global-hub' && originalPath !== '/game-hub') {
    throw new Error('The original game endpoint is invalid.')
  }
  const headers = new Headers({ accept: 'application/json', 'content-type': 'application/json',
    'x-solomon-dark-session': 'reconnect' })
  if (token) headers.set('authorization', `Bearer ${token}`)
  const response = await request(websiteUrl('/api/game/reconnect'), { method: 'POST', credentials: 'same-origin',
    signal, headers, body: JSON.stringify({ ...identity, sessionId }) })
  const payload = await readJson(response)
  if (!response.ok) throw new Error(apiError(payload, 'The original game connection could not be restored.'))
  const replacement = decodeProvisionedGameEndpoint(payload)
  const replacementUrl = new URL(replacement.url)
  if (websiteBase && original.pathname !== originalPath && replacementUrl.origin === original.origin
    && replacementUrl.pathname === originalPath) {
    replacementUrl.pathname = websiteUrl(originalPath)
    replacement.url = replacementUrl.toString()
  }
  if (replacement.url !== endpoint.url || replacement.sessionKind !== endpoint.sessionKind) {
    throw new Error('The reconnect admission selected a different game authority.')
  }
  return replacement
}

export async function admitBrowserGame(
  admission: BrowserGameAdmission,
  token: string | null,
  request: typeof fetch = fetch,
): Promise<GameEndpoint> {
  if (admission.kind === 'global-hub') return admitSharedHubPlayer(token, request)
  if (admission.kind === 'private-college') return resolveGameEndpoint(token, request)
  if (admission.kind === 'party') return admitPartyJoin(admission.intentId, token, request)
  if (admission.partyRejoinToken !== null) {
    try {
      return await admitPartyRejoin(
        admission.partyRejoinToken,
        admission.saveDocument,
        token,
        request,
      )
    } catch (error) {
      if (!(error instanceof InactivePartyRejoinError)) throw error
    }
  }
  return admission.fallback === 'global-hub'
    ? admitSharedHubPlayer(token, request)
    : resolveGameEndpoint(token, request)
}

class InactivePartyRejoinError extends Error {}

/**
 * Platform-owned runtime configuration for the shared static client bundle.
 * A packaged desktop preload injects its freshly spawned localhost endpoint;
 * a web shell can supply the endpoint returned by remote provisioning. Vite
 * values remain a development-only fallback.
 */
export function configuredGameEndpoint(): GameEndpoint | null {
  const runtimeEndpoint = window.solomonDarkRuntime?.gameEndpoint
  if (runtimeEndpoint) return runtimeEndpoint

  const url = import.meta.env.VITE_GAME_SERVER_URL
  const credential = import.meta.env.VITE_GAME_BOOTSTRAP_CREDENTIAL
  if (!url || !credential) return null
  return import.meta.env.VITE_GAME_SERVER_KIND === 'remote'
    ? { kind: 'remote', sessionKind: 'private-college', url, credential }
    : { kind: 'localhost', sessionKind: 'standalone', url, credential }
}

async function resolveGameEndpoint(
  token: string | null = null,
  request: typeof fetch = fetch,
): Promise<GameEndpoint> {
  const configured = configuredGameEndpoint()
  if (configured) return configured

  const headers = new Headers({
    accept: 'application/json',
    'x-solomon-dark-session': 'provision',
  })
  if (token) headers.set('authorization', `Bearer ${token}`)
  const response = await request('/api/game/sessions', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
  })
  const payload = await readJson(response)
  if (!response.ok) {
    const message = record(payload) && typeof payload.error === 'string'
      ? payload.error
      : 'A private game session is not available right now.'
    throw new Error(message)
  }
  return decodeProvisionedGameEndpoint(payload)
}

export async function admitEditorTest(
  document: { readonly name: string; readonly bytesBase64: string },
  token: string | null,
  request: typeof fetch = fetch,
): Promise<GameEndpoint> {
  const headers = new Headers({
    accept: 'application/json',
    'content-type': 'application/json',
    'x-solomon-dark-session': 'editor-test',
  })
  if (token) headers.set('authorization', `Bearer ${token}`)
  const response = await request('/api/game/editor-test', {
    method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify(document),
  })
  const payload = await readJson(response)
  if (!response.ok) throw new Error(apiError(payload, 'The private test could not be started. Your draft is still here.'))
  return decodeProvisionedGameEndpoint(payload)
}

export async function admitSharedHubPlayer(
  token: string | null,
  request: typeof fetch = fetch,
): Promise<GameEndpoint> {
  const headers = new Headers({
    accept: 'application/json',
    'x-solomon-dark-session': 'enter-hub',
  })
  if (token) headers.set('authorization', `Bearer ${token}`)
  const response = await request('/api/game/hub', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
  })
  const payload = await readJson(response)
  if (!response.ok) throw new Error(apiError(payload, 'The shared Hub is not available right now.'))
  return decodeProvisionedGameEndpoint(payload)
}

export async function admitPartyJoin(
  intentId: string,
  token: string | null,
  request: typeof fetch = fetch,
): Promise<GameEndpoint> {
  const headers = new Headers({
    accept: 'application/json',
    'content-type': 'application/json',
  })
  if (token) headers.set('authorization', `Bearer ${token}`)
  const response = await request('/api/game/join/admit', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ intentId }),
  })
  const payload = await readJson(response)
  if (!response.ok) throw new Error(apiError(payload, 'That party is not available right now.'))
  return decodeProvisionedGameEndpoint(payload)
}

export async function admitPartyRejoin(
  token: string,
  save: string,
  accountToken: string | null,
  request: typeof fetch = fetch,
): Promise<GameEndpoint> {
  const headers = new Headers({
    accept: 'application/json',
    'content-type': 'application/json',
  })
  if (accountToken) headers.set('authorization', `Bearer ${accountToken}`)
  const response = await request('/api/game/rejoin', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ save, token }),
  })
  const payload = await readJson(response)
  if (!response.ok) {
    const error = apiError(payload, 'That active party run is not available right now.')
    if (response.status === 404) throw new InactivePartyRejoinError(error)
    throw new Error(error)
  }
  return decodeProvisionedGameEndpoint(payload)
}

export async function admitGameObserver(
  matchId: string,
  token: string | null,
  request: typeof fetch = fetch,
): Promise<GameObserverEndpoint> {
  const headers = new Headers({
    accept: 'application/json',
    'content-type': 'application/json',
  })
  if (token) headers.set('authorization', `Bearer ${token}`)
  const response = await request('/api/game/observe', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ matchId }),
  })
  const payload = await readJson(response)
  if (!response.ok) {
    throw new Error(apiError(payload, 'That match is not available to observe right now.'))
  }
  return decodeObserverEndpoint(payload)
}

export function decodeObserverEndpoint(value: unknown): GameObserverEndpoint {
  const endpoint = decodeProvisionedGameEndpoint(value)
  if (!record(value) || value.observer !== true || endpoint.sessionKind === 'standalone') {
    throw new Error('The game observer provisioner returned an invalid endpoint.')
  }
  return { ...endpoint, observer: true }
}

export function decodeProvisionedGameEndpoint(value: unknown): GameEndpoint {
  if (!record(value) ||
      value.kind !== 'remote' ||
      (value.sessionKind !== 'global-hub' && value.sessionKind !== 'private-college') ||
      typeof value.url !== 'string' ||
      typeof value.credential !== 'string' ||
      value.credential.length === 0 ||
      value.credential.length > 512) {
    throw new Error('The game session provisioner returned an invalid endpoint.')
  }
  let endpointUrl: URL
  try {
    endpointUrl = new URL(value.url)
  } catch {
    throw new Error('The game session provisioner returned an invalid endpoint.')
  }
  if (endpointUrl.protocol !== 'wss:' || endpointUrl.username || endpointUrl.password) {
    throw new Error('The game session provisioner returned an invalid endpoint.')
  }
  return {
    kind: 'remote',
    sessionKind: value.sessionKind,
    url: endpointUrl.toString(),
    credential: value.credential,
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new Error('The game session provisioner returned an invalid response.')
  }
}

function apiError(value: unknown, fallback: string): string {
  return record(value) && typeof value.error === 'string' ? value.error : fallback
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

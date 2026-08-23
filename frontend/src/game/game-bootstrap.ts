import type { GameEndpoint } from './engine.ts'

export type BrowserGameAdmission =
  | { readonly kind: 'global-hub' }
  | { readonly kind: 'party'; readonly intentId: string }
  | { readonly kind: 'private-college' }

export async function admitBrowserGame(
  admission: BrowserGameAdmission,
  token: string | null,
): Promise<GameEndpoint> {
  if (admission.kind === 'global-hub') return admitSharedHubPlayer(token)
  if (admission.kind === 'private-college') return resolveGameEndpoint(token)
  return admitPartyJoin(admission.intentId, token)
}

declare global {
  interface Window {
    solomonDarkRuntime?: {
      gameEndpoint?: GameEndpoint
    }
  }
}

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

export async function resolveGameEndpoint(
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

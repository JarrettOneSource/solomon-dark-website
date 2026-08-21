import type { GameEndpoint } from './engine.ts'

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
  return {
    kind: import.meta.env.VITE_GAME_SERVER_KIND === 'remote' ? 'remote' : 'localhost',
    url,
    credential,
  }
}

export async function resolveGameEndpoint(
  request: typeof fetch = fetch,
): Promise<GameEndpoint> {
  const configured = configuredGameEndpoint()
  if (configured) return configured

  const response = await request('/api/game/sessions', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      'x-solomon-dark-session': 'provision',
    },
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

export function decodeProvisionedGameEndpoint(value: unknown): GameEndpoint {
  if (!record(value) ||
      value.kind !== 'remote' ||
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
  return { kind: 'remote', url: endpointUrl.toString(), credential: value.credential }
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

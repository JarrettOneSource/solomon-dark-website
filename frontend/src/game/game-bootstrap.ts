import type { GameEndpoint } from './engine.ts'

const GAME_LOBBY_ID = /^[A-Za-z0-9_-]{32}$/

export interface CreatedGameLobby {
  endpoint: GameEndpoint
  lobbyId: string
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

export async function createGameLobby(
  hostPlayer: string,
  request: typeof fetch = fetch,
): Promise<CreatedGameLobby> {
  const response = await request('/api/game/lobbies', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-solomon-dark-session': 'create-lobby',
    },
    body: JSON.stringify({ hostPlayer }),
  })
  const payload = await readJson(response)
  if (!response.ok) throw new Error(apiError(payload, 'Web rebuild playtests are not available right now.'))
  return decodeCreatedGameLobby(payload)
}

export async function joinGameLobby(
  lobbyId: string,
  request: typeof fetch = fetch,
): Promise<GameEndpoint> {
  const normalized = parseGameLobbyId(lobbyId)
  if (!normalized) throw new Error('The web playtest lobby link is invalid.')
  const response = await request(`/api/game/lobbies/${normalized}/join`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      'x-solomon-dark-session': 'join-lobby',
    },
  })
  const payload = await readJson(response)
  if (!response.ok) throw new Error(apiError(payload, 'That web playtest is no longer available.'))
  return decodeProvisionedGameEndpoint(payload)
}

export async function cancelGameLobby(
  lobby: CreatedGameLobby,
  request: typeof fetch = fetch,
): Promise<void> {
  const response = await request(`/api/game/lobbies/${lobby.lobbyId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      'x-solomon-dark-host-credential': lobby.endpoint.credential,
    },
  })
  if (response.ok || response.status === 404) return
  const payload = await readJson(response)
  throw new Error(apiError(payload, 'The web playtest could not be cancelled.'))
}

export function decodeCreatedGameLobby(value: unknown): CreatedGameLobby {
  if (!record(value) || typeof value.lobbyId !== 'string' || !parseGameLobbyId(value.lobbyId)) {
    throw new Error('The game session provisioner returned an invalid lobby.')
  }
  return {
    lobbyId: value.lobbyId as string,
    endpoint: decodeProvisionedGameEndpoint(value),
  }
}

export function parseGameLobbyId(value: string | null | undefined): string | null {
  return value && GAME_LOBBY_ID.test(value) ? value : null
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

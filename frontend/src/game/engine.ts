import {
  connectGameClientSession,
  type GameSessionConnector,
  type GameClientSession,
} from './client/game-client-session.ts'
import {
  connectWebSocketTransport,
  type GameTransport,
} from './client/game-transport.ts'
import type { PlayerCharacterConfig } from './core-kernels/player-character.ts'

/**
 * The only public seam between a platform shell and the rebuilt game client.
 * Every session connects to an authoritative server through the complete game
 * protocol. Desktop solo supplies a URL for the separate server process it
 * spawned; browser sessions receive a provisioned remote URL. Neither mode
 * runs authoritative simulation in this client bundle.
 */
export type GameEndpoint =
  | {
      kind: 'localhost'
      url: string
      credential: string
    }
  | {
      kind: 'remote'
      url: string
      credential: string
    }

export interface SessionOptions {
  character: PlayerCharacterConfig
  endpoint: GameEndpoint
  onFatal?: (error: Error) => void
  transportFactory?: (url: string) => Promise<GameTransport>
  sessionConnector?: GameSessionConnector
}

export interface GameSession extends GameClientSession {}

export const ENGINE_STATUS = 'ready' as const

/** Set when the packaged desktop rebuild has a published release artifact. */
export const OFFLINE_BUILD_URL: string | null = null

export async function bootGame(options: SessionOptions): Promise<GameSession> {
  validateEndpoint(options.endpoint)
  const createTransport = options.transportFactory ?? connectWebSocketTransport
  const transport = await createTransport(options.endpoint.url)
  const connectSession = options.sessionConnector ?? connectGameClientSession
  return connectSession({
    character: options.character,
    transport,
    credential: options.endpoint.credential,
    ...(options.onFatal ? { onFatal: options.onFatal } : {}),
  })
}

function validateEndpoint(endpoint: GameEndpoint): void {
  const url = new URL(endpoint.url)
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('Game endpoints must use ws or wss.')
  }
  const local = isLoopback(url.hostname)
  if (endpoint.kind === 'localhost') {
    if (!local || url.protocol !== 'ws:') {
      throw new Error('A localhost endpoint must be an unencrypted loopback WebSocket.')
    }
    return
  }
  if (local || isPrivateNetwork(url.hostname)) {
    throw new Error('Browser remote sessions may not connect to local or private networks.')
  }
  if (url.protocol !== 'wss:') throw new Error('Remote game endpoints must use wss.')
}

function isLoopback(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '::1' || hostname === '[::1]') return true
  const ipv4 = parseIpv4(hostname)
  return ipv4?.[0] === 127
}

function isPrivateNetwork(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  if (normalized.endsWith('.localhost') || normalized.endsWith('.local')) return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8')
    || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true
  }
  const ipv4 = parseIpv4(hostname)
  if (!ipv4) return false
  const [first, second] = ipv4
  return first === 0
    || first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
}

function parseIpv4(hostname: string): readonly number[] | null {
  const octets = hostname.split('.')
  if (octets.length !== 4) return null
  const parsed = octets.map((octet) => Number(octet))
  return parsed.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
    ? parsed
    : null
}

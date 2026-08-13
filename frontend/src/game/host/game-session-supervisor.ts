import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http'
import type { Duplex } from 'node:stream'

import { WebSocket, WebSocketServer } from 'ws'

import { GAME_PROTOCOL_NAME } from '../protocol/game-protocol.ts'
import { startGameHost, type GameHost } from './game-host.ts'

export const GAME_SESSION_PATH_PREFIX = '/game-sessions/'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000
const DEFAULT_MAX_CONNECTIONS_PER_SESSION = 16
const DEFAULT_MAX_SESSIONS = 64
const DEFAULT_UNCLAIMED_TIMEOUT_MS = 2 * 60 * 1000

export interface GameSessionSupervisorOptions {
  adminSecret: string
  allowedOrigins: readonly string[]
  host?: string
  idleTimeoutMs?: number
  maxConnectionsPerSession?: number
  maxSessions?: number
  port?: number
  snapshotRate?: number
  unclaimedTimeoutMs?: number
}

export interface GameSessionSupervisorAddress {
  host: string
  port: number
  url: string
}

export interface GameSessionSupervisor {
  address: GameSessionSupervisorAddress
  close(): Promise<void>
  sessionCount(): number
}

interface SessionRecord {
  activeProxies: number
  closing: boolean
  createdAt: number
  credential: string
  emptySince: number | null
  hadPlayer: boolean
  host: GameHost
  id: string
}

export async function startGameSessionSupervisor(
  options: GameSessionSupervisorOptions,
): Promise<GameSessionSupervisor> {
  const host = options.host ?? '127.0.0.1'
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error('The game session supervisor must bind to loopback behind the TLS gateway')
  }
  if (!options.adminSecret) throw new Error('The game session supervisor requires an admin secret')
  if (options.allowedOrigins.length === 0) {
    throw new Error('The game session supervisor requires at least one browser origin')
  }
  const idleTimeoutMs = positiveDuration(
    options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS,
    'idleTimeoutMs',
  )
  const unclaimedTimeoutMs = positiveDuration(
    options.unclaimedTimeoutMs ?? DEFAULT_UNCLAIMED_TIMEOUT_MS,
    'unclaimedTimeoutMs',
  )
  const maxConnectionsPerSession = positiveInteger(
    options.maxConnectionsPerSession ?? DEFAULT_MAX_CONNECTIONS_PER_SESSION,
    'maxConnectionsPerSession',
  )
  const maxSessions = positiveInteger(options.maxSessions ?? DEFAULT_MAX_SESSIONS, 'maxSessions')
  const sessions = new Map<string, SessionRecord>()
  const downstreamSockets = new Set<WebSocket>()
  let closed = false
  let provisioning = 0

  const websocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: 64 * 1024,
  })
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': 'application/json',
      })
      response.end(JSON.stringify({
        status: 'ok',
        protocol: GAME_PROTOCOL_NAME,
        sessions: sessions.size,
      }))
      return
    }
    if (request.method === 'POST' && request.url === '/admin/sessions') {
      if (!bearerMatches(request.headers.authorization, options.adminSecret)) {
        response.writeHead(401, {
          'cache-control': 'no-store',
          'content-type': 'application/json',
        })
        response.end(JSON.stringify({ error: 'Unauthorized.' }))
        return
      }
      if (sessions.size + provisioning >= maxSessions) {
        response.writeHead(503, {
          'cache-control': 'no-store',
          'content-type': 'application/json',
          'retry-after': '5',
        })
        response.end(JSON.stringify({ error: 'Game session capacity is exhausted.' }))
        return
      }
      provisioning += 1
      void provisionSession().then((session) => {
        response.writeHead(201, {
          'cache-control': 'no-store',
          'content-type': 'application/json',
        })
        response.end(JSON.stringify({
          credential: session.credential,
          path: `${GAME_SESSION_PATH_PREFIX}${session.id}`,
          protocol: GAME_PROTOCOL_NAME,
          sessionId: session.id,
        }))
      }).catch(() => {
        response.writeHead(503, {
          'cache-control': 'no-store',
          'content-type': 'application/json',
          'retry-after': '5',
        })
        response.end(JSON.stringify({ error: 'A game session could not be started.' }))
      }).finally(() => {
        provisioning -= 1
      })
      return
    }
    response.writeHead(404)
    response.end()
  })

  server.on('upgrade', (request, socket, head) => {
    if (!originAllowed(request.headers.origin, options.allowedOrigins)) {
      rejectUpgrade(socket, 403, 'Forbidden')
      return
    }
    const sessionId = sessionIdFromPath(request.url)
    const session = sessionId ? sessions.get(sessionId) : undefined
    if (!session || session.closing) {
      rejectUpgrade(socket, 404, 'Not Found')
      return
    }
    if (session.activeProxies >= maxConnectionsPerSession) {
      rejectUpgrade(socket, 503, 'Service Unavailable')
      return
    }
    session.activeProxies += 1
    proxyUpgrade(request, socket, head, session)
  })

  async function provisionSession(): Promise<SessionRecord> {
    if (closed) throw new Error('The game session supervisor is closed')
    const id = randomBytes(24).toString('base64url')
    const credential = randomBytes(32).toString('base64url')
    const sessionHost = await startGameHost({
      bootstrapCredential: credential,
      ...(options.snapshotRate === undefined ? {} : { snapshotRate: options.snapshotRate }),
    })
    const session: SessionRecord = {
      activeProxies: 0,
      closing: false,
      createdAt: Date.now(),
      credential,
      emptySince: null,
      hadPlayer: false,
      host: sessionHost,
      id,
    }
    if (closed) {
      await sessionHost.close()
      throw new Error('The game session supervisor closed during provisioning')
    }
    sessions.set(id, session)
    return session
  }

  function proxyUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    session: SessionRecord,
  ): void {
    const upstream = new WebSocket(session.host.address.url)
    let released = false
    let upgraded = false
    const release = () => {
      if (released) return
      released = true
      session.activeProxies = Math.max(0, session.activeProxies - 1)
    }
    const timeout = setTimeout(() => {
      if (!upgraded) rejectUpgrade(socket, 504, 'Gateway Timeout')
      upstream.terminate()
      release()
    }, 5000)
    timeout.unref()
    const abortPending = () => {
      if (upgraded) return
      clearTimeout(timeout)
      upstream.terminate()
      release()
    }
    socket.once('close', abortPending)
    upstream.once('error', () => {
      if (!upgraded && !socket.destroyed) rejectUpgrade(socket, 502, 'Bad Gateway')
      release()
    })
    upstream.once('open', () => {
      if (socket.destroyed) {
        upstream.terminate()
        release()
        return
      }
      clearTimeout(timeout)
      socket.off('close', abortPending)
      websocketServer.handleUpgrade(request, socket, head, (downstream) => {
        upgraded = true
        downstreamSockets.add(downstream)
        downstream.on('message', (data, binary) => {
          if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary })
        })
        upstream.on('message', (data, binary) => {
          if (downstream.readyState === WebSocket.OPEN) downstream.send(data, { binary })
        })
        downstream.once('close', (code, reason) => {
          downstreamSockets.delete(downstream)
          closePeer(upstream, code, reason.toString())
          release()
        })
        upstream.once('close', (code, reason) => {
          closePeer(downstream, code, reason.toString())
          release()
        })
        downstream.once('error', () => upstream.terminate())
        upstream.once('error', () => downstream.terminate())
      })
    })
  }

  const expiryTimer = setInterval(() => {
    const now = Date.now()
    for (const session of sessions.values()) {
      if (session.closing) continue
      const playerCount = session.host.playerCount()
      if (playerCount > 0) {
        session.hadPlayer = true
        session.emptySince = null
        continue
      }
      if (session.activeProxies > 0) continue
      if (!session.hadPlayer) {
        if (now - session.createdAt >= unclaimedTimeoutMs) void closeSession(session)
        continue
      }
      session.emptySince ??= now
      if (now - session.emptySince >= idleTimeoutMs) void closeSession(session)
    }
  }, Math.min(1000, unclaimedTimeoutMs, idleTimeoutMs))
  expiryTimer.unref()

  async function closeSession(session: SessionRecord): Promise<void> {
    if (session.closing) return
    session.closing = true
    sessions.delete(session.id)
    await session.host.close()
  }

  await listen(server, options.port ?? 0, host)
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('The game session supervisor did not bind a TCP address')
  }

  return {
    address: {
      host,
      port: address.port,
      url: `http://${formatHost(host)}:${address.port}`,
    },
    async close() {
      if (closed) return
      closed = true
      clearInterval(expiryTimer)
      for (const socket of downstreamSockets) socket.terminate()
      await Promise.all([...sessions.values()].map(closeSession))
      websocketServer.close()
      await closeHttpServer(server)
    },
    sessionCount: () => sessions.size,
  }
}

function sessionIdFromPath(path: string | undefined): string | null {
  if (!path?.startsWith(GAME_SESSION_PATH_PREFIX)) return null
  const sessionId = path.slice(GAME_SESSION_PATH_PREFIX.length)
  return /^[A-Za-z0-9_-]{32}$/.test(sessionId) ? sessionId : null
}

function originAllowed(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  return origin === undefined || (origin !== 'null' && allowedOrigins.includes(origin))
}

function bearerMatches(authorization: string | undefined, expected: string): boolean {
  if (!authorization?.startsWith('Bearer ')) return false
  return secretsEqual(authorization.slice('Bearer '.length), expected)
}

function secretsEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length
    && timingSafeEqual(actualBytes, expectedBytes)
}

function rejectUpgrade(socket: Duplex, status: number, reason: string): void {
  if (socket.destroyed) return
  socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
}

function closePeer(socket: WebSocket, code: number, reason: string): void {
  if (socket.readyState !== WebSocket.OPEN && socket.readyState !== WebSocket.CONNECTING) return
  if (code >= 1000 && ![1004, 1005, 1006, 1015].includes(code)) {
    socket.close(code, reason.slice(0, 123))
    return
  }
  socket.close()
}

function positiveDuration(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`)
  return value
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`)
  return value
}

function formatHost(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
}

function listen(server: HttpServer, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.off('error', reject)
      resolve()
    })
  })
}

function closeHttpServer(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
}

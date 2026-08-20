import { randomBytes, timingSafeEqual } from 'node:crypto'
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http'
import type { Duplex } from 'node:stream'

import { WebSocket, WebSocketServer } from 'ws'

import { GAME_PROTOCOL_NAME } from '../protocol/game-protocol.ts'
import type { BoneyardCatalog } from './boneyard-catalog.ts'
import { startGameHost, type GameHost } from './game-host.ts'
import {
  monitorWebSocketHeartbeat,
  resolveGameHeartbeatInterval,
} from './websocket-heartbeat.ts'
import { GAME_WEBSOCKET_COMPRESSION } from './websocket-compression.ts'
import {
  gameServerErrorDetails,
  logGameServerEvent,
  type GameServerLogSink,
} from './game-server-logger.ts'

export const GAME_SESSION_PATH_PREFIX = '/game-sessions/'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
const DEFAULT_MAX_CONNECTIONS_PER_SESSION = 16
const DEFAULT_MAX_SESSIONS = 64
const DEFAULT_UNCLAIMED_TIMEOUT_MS = 2 * 60 * 1000

export interface GameSessionSupervisorOptions {
  adminSecret: string
  allowedOrigins: readonly string[]
  boneyards?: BoneyardCatalog
  heartbeatIntervalMs?: number
  host?: string
  log?: GameServerLogSink
  luaWasmPath?: string
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
  claimed: boolean
  closePromise: Promise<void> | null
  closing: boolean
  createdAt: number
  guestCredential: string | null
  host: GameHost
  hostCredential: string
  hostPlayer: string | null
  id: string
  kind: 'lobby' | 'private'
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
  const unclaimedTimeoutMs = positiveDuration(
    options.unclaimedTimeoutMs ?? DEFAULT_UNCLAIMED_TIMEOUT_MS,
    'unclaimedTimeoutMs',
  )
  const heartbeatIntervalMs = resolveGameHeartbeatInterval(options.heartbeatIntervalMs)
  const maxConnectionsPerSession = positiveInteger(
    options.maxConnectionsPerSession ?? DEFAULT_MAX_CONNECTIONS_PER_SESSION,
    'maxConnectionsPerSession',
  )
  const maxSessions = positiveInteger(options.maxSessions ?? DEFAULT_MAX_SESSIONS, 'maxSessions')
  const sessions = new Map<string, SessionRecord>()
  const downstreamSockets = new Set<WebSocket>()
  let closed = false
  let provisioning = 0
  const logDetails = (details: Readonly<Record<string, unknown>> = {}) => details

  const websocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: 64 * 1024,
    perMessageDeflate: GAME_WEBSOCKET_COMPRESSION,
  })
  websocketServer.on('error', (error) => {
    logGameServerEvent(
      options.log,
      'session-supervisor',
      'error',
      'websocket.server_error',
      'The browser-facing WebSocket supervisor reported an error.',
      logDetails(gameServerErrorDetails(error)),
    )
  })
  const server = createServer((request, response) => {
    const path = request.url?.split('?', 1)[0] ?? ''
    if (request.method === 'GET' && path === '/health') {
      sendJson(response, 200, {
        status: 'ok',
        protocol: GAME_PROTOCOL_NAME,
        sessions: sessions.size,
        lobbies: [...sessions.values()].filter((session) => session.kind === 'lobby').length,
      })
      return
    }
    if (!path.startsWith('/admin/')) {
      response.writeHead(404)
      response.end()
      return
    }
    if (!bearerMatches(request.headers.authorization, options.adminSecret)) {
      logGameServerEvent(
        options.log,
        'session-supervisor',
        'warning',
        'admin.request_rejected',
        'A game-session supervisor admin request failed authentication.',
        logDetails({ method: request.method ?? 'unknown', path }),
      )
      sendJson(response, 401, { error: 'Unauthorized.' })
      return
    }
    if (request.method === 'POST' && path === '/admin/sessions') {
      provisionIntoResponse(response, 'private', null)
      return
    }
    if (request.method === 'GET' && path === '/admin/lobbies') {
      const items = [...sessions.values()]
        .filter((session) => session.kind === 'lobby' && !session.closing)
        .sort((first, second) => first.createdAt - second.createdAt)
        .map(lobbySummary)
      sendJson(response, 200, { items })
      return
    }
    if (request.method === 'POST' && path === '/admin/lobbies') {
      void readJsonObject(request).then((body) => {
        const hostPlayer = normalizeHostPlayer(body.hostPlayer)
        if (!hostPlayer) {
          sendJson(response, 400, { error: 'A valid host player name is required.' })
          return
        }
        provisionIntoResponse(response, 'lobby', hostPlayer)
      }).catch(() => {
        sendJson(response, 400, { error: 'A valid JSON request body is required.' })
      })
      return
    }
    const joinLobbyId = lobbyRouteId(path, '/join')
    if (request.method === 'POST' && joinLobbyId) {
      const session = sessions.get(joinLobbyId)
      if (!session || session.kind !== 'lobby' || session.closing || !session.guestCredential) {
        sendJson(response, 404, { error: 'That web playtest is no longer available.' })
        return
      }
      const guestLimit = session.host.hostPlayerId() === null
        ? maxConnectionsPerSession - 1
        : maxConnectionsPerSession
      if (session.host.playerCount() >= guestLimit) {
        sendJson(response, 409, { error: 'That web playtest is full.' })
        return
      }
      sendJson(response, 200, {
        credential: session.guestCredential,
        path: `${GAME_SESSION_PATH_PREFIX}${session.id}`,
      })
      return
    }
    const cancelLobbyId = lobbyRouteId(path)
    if (request.method === 'DELETE' && cancelLobbyId) {
      const session = sessions.get(cancelLobbyId)
      if (!session || session.kind !== 'lobby' || session.closing) {
        sendJson(response, 404, { error: 'That web playtest is no longer available.' })
        return
      }
      const suppliedCredential = request.headers['x-solomon-dark-host-credential']
      if (typeof suppliedCredential !== 'string'
        || !secretsEqual(suppliedCredential, session.hostCredential)) {
        sendJson(response, 403, { error: 'The web playtest host credential is invalid.' })
        return
      }
      void closeSession(session, 'host-cancelled').then(() => {
        response.writeHead(204, { 'cache-control': 'no-store' })
        response.end()
      }).catch(() => {
        sendJson(response, 503, { error: 'The web playtest could not be cancelled.' })
      })
      return
    }
    response.writeHead(404, { 'cache-control': 'no-store' })
    response.end()
  })
  server.on('clientError', (error, socket) => {
    logGameServerEvent(
      options.log,
      'session-supervisor',
      'warning',
      'http.client_error',
      'The game-session supervisor received an invalid HTTP connection.',
      logDetails({ remoteAddress: socketRemoteAddress(socket), ...gameServerErrorDetails(error) }),
    )
    if (!socket.destroyed) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
  })

  function provisionIntoResponse(
    response: ServerResponse,
    kind: SessionRecord['kind'],
    hostPlayer: string | null,
  ): void {
    if (sessions.size + provisioning >= maxSessions) {
      sendJson(response, 503, { error: 'Game session capacity is exhausted.' }, { 'retry-after': '5' })
      return
    }
    provisioning += 1
    void provisionSession(kind, hostPlayer).then((session) => {
      sendJson(response, 201, {
        credential: session.hostCredential,
        path: `${GAME_SESSION_PATH_PREFIX}${session.id}`,
        protocol: GAME_PROTOCOL_NAME,
        ...(kind === 'private' ? { sessionId: session.id } : { lobbyId: session.id }),
      })
    }).catch((error) => {
      logGameServerEvent(
        options.log,
        'session-supervisor',
        'error',
        'session.provision_failed',
        'A game session could not be provisioned.',
        logDetails({ kind, ...gameServerErrorDetails(error) }),
      )
      sendJson(response, 503, { error: 'A game session could not be started.' }, { 'retry-after': '5' })
    }).finally(() => {
      provisioning -= 1
    })
  }

  function lobbySummary(session: SessionRecord) {
    const world = session.host.state().world
    return {
      id: session.id,
      hostPlayer: session.hostPlayer,
      players: session.host.playerCount(),
      maxPlayers: maxConnectionsPerSession,
      phase: world.kind === 'boneyard'
        ? 'session'
        : session.host.hostPlayerId() === null ? 'picking-loadout' : 'hub',
      protocol: GAME_PROTOCOL_NAME,
    }
  }

  server.on('upgrade', (request, socket, head) => {
    if (!originAllowed(request.headers.origin, options.allowedOrigins)) {
      logGameServerEvent(
        options.log,
        'session-supervisor',
        'warning',
        'proxy.upgrade_rejected',
        'A browser game connection was rejected because its origin is not allowed.',
        logDetails({ origin: request.headers.origin ?? 'none', path: request.url ?? 'none' }),
      )
      rejectUpgrade(socket, 403, 'Forbidden')
      return
    }
    const sessionId = sessionIdFromPath(request.url)
    const session = sessionId ? sessions.get(sessionId) : undefined
    if (!session || session.closing) {
      logGameServerEvent(
        options.log,
        'session-supervisor',
        'warning',
        'proxy.session_missing',
        'A browser tried to connect to a game session that is unavailable.',
        logDetails({ path: request.url ?? 'none', sessionId: sessionId ?? 'invalid' }),
      )
      rejectUpgrade(socket, 404, 'Not Found')
      return
    }
    if (session.activeProxies >= maxConnectionsPerSession) {
      logGameServerEvent(
        options.log,
        'session-supervisor',
        'warning',
        'proxy.capacity_rejected',
        'A browser game connection exceeded the session proxy capacity.',
        logDetails({ activeProxies: session.activeProxies, sessionId: session.id }),
      )
      rejectUpgrade(socket, 503, 'Service Unavailable')
      return
    }
    session.activeProxies += 1
    proxyUpgrade(request, socket, head, session)
  })

  async function provisionSession(
    kind: SessionRecord['kind'],
    hostPlayer: string | null,
  ): Promise<SessionRecord> {
    if (closed) throw new Error('The game session supervisor is closed')
    const id = randomBytes(24).toString('base64url')
    const hostCredential = randomBytes(32).toString('base64url')
    const guestCredential = kind === 'lobby'
      ? randomBytes(32).toString('base64url')
      : null
    const sessionHost = await startGameHost({
      authentication: guestCredential
        ? { kind: 'reserved-host', hostCredential, guestCredential }
        : { kind: 'shared', credential: hostCredential },
      heartbeatIntervalMs,
      log: options.log,
      logContext: { sessionId: id, sessionKind: kind },
      luaWasmPath: options.luaWasmPath,
      maxPlayers: maxConnectionsPerSession,
      onPlayerCountChanged: (playerCount) => {
        const session = sessions.get(id)
        if (!session) return
        if (playerCount > 0) {
          session.claimed = true
          return
        }
        closeClaimedSessionIfEmpty(session)
      },
      ...(options.boneyards === undefined ? {} : { boneyards: options.boneyards }),
      ...(options.snapshotRate === undefined ? {} : { snapshotRate: options.snapshotRate }),
    })
    const session: SessionRecord = {
      activeProxies: 0,
      claimed: false,
      closePromise: null,
      closing: false,
      createdAt: Date.now(),
      guestCredential,
      host: sessionHost,
      hostCredential,
      hostPlayer,
      id,
      kind,
    }
    if (closed) {
      await sessionHost.close()
      throw new Error('The game session supervisor closed during provisioning')
    }
    sessions.set(id, session)
    logGameServerEvent(
      options.log,
      'session-supervisor',
      'info',
      'session.provisioned',
      'An isolated browser game session was provisioned.',
      logDetails({ kind, sessionId: id, sessionCount: sessions.size }),
    )
    return session
  }

  function proxyUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    session: SessionRecord,
  ): void {
    const upstream = new WebSocket(session.host.address.url, {
      perMessageDeflate: false,
    })
    let released = false
    let upgraded = false
    let stopHeartbeat: (() => void) | null = null
    const release = () => {
      if (released) return
      released = true
      stopHeartbeat?.()
      session.activeProxies = Math.max(0, session.activeProxies - 1)
      closeClaimedSessionIfEmpty(session)
    }
    const timeout = setTimeout(() => {
      if (!upgraded) {
        logGameServerEvent(
          options.log,
          'session-supervisor',
          'warning',
          'proxy.upstream_timeout',
          'The supervisor timed out while connecting to an authoritative game host.',
          logDetails({ sessionId: session.id }),
        )
        rejectUpgrade(socket, 504, 'Gateway Timeout')
      }
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
    upstream.once('error', (error) => {
      logGameServerEvent(
        options.log,
        'session-supervisor',
        'error',
        'proxy.upstream_error',
        'The authoritative game-host side of a proxy reported an error.',
        logDetails({ sessionId: session.id, ...gameServerErrorDetails(error) }),
      )
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
        stopHeartbeat = monitorWebSocketHeartbeat(downstream, heartbeatIntervalMs, {
          onTimeout: () => {
            logGameServerEvent(
              options.log,
              'session-supervisor',
              'warning',
              'proxy.heartbeat_timeout',
              'The supervisor stopped receiving heartbeat responses from a browser player.',
              logDetails({ sessionId: session.id }),
            )
          },
          timeoutReason: 'connection timed out',
        })
        downstreamSockets.add(downstream)
        logGameServerEvent(
          options.log,
          'session-supervisor',
          'debug',
          'proxy.opened',
          'A browser WebSocket proxy opened.',
          logDetails({ activeProxies: session.activeProxies, sessionId: session.id }),
        )
        downstream.on('message', (data, binary) => {
          if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary })
        })
        upstream.on('message', (data, binary) => {
          if (downstream.readyState === WebSocket.OPEN) downstream.send(data, { binary })
        })
        downstream.once('close', (code, reason) => {
          downstreamSockets.delete(downstream)
          logGameServerEvent(
            options.log,
            'session-supervisor',
            code === 1000 ? 'info' : 'warning',
            'proxy.browser_closed',
            'The browser side of a game-session proxy closed.',
            logDetails({ closeCode: code, closeReason: reason.toString(), sessionId: session.id }),
          )
          closePeer(upstream, code, reason.toString())
          release()
        })
        upstream.once('close', (code, reason) => {
          logGameServerEvent(
            options.log,
            'session-supervisor',
            code === 1000 ? 'info' : 'warning',
            'proxy.host_closed',
            'The authoritative host side of a game-session proxy closed.',
            logDetails({ closeCode: code, closeReason: reason.toString(), sessionId: session.id }),
          )
          closePeer(downstream, code, reason.toString())
          release()
        })
        downstream.once('error', (error) => {
          logGameServerEvent(
            options.log,
            'session-supervisor',
            'warning',
            'proxy.browser_error',
            'The browser side of a game-session proxy reported an error.',
            logDetails({ sessionId: session.id, ...gameServerErrorDetails(error) }),
          )
          upstream.terminate()
        })
        upstream.once('error', () => downstream.terminate())
      })
    })
  }

  const expiryTimer = setInterval(() => {
    const now = Date.now()
    for (const session of sessions.values()) {
      if (
        !session.closing
        && !session.claimed
        && session.activeProxies === 0
        && now - session.createdAt >= unclaimedTimeoutMs
      ) closeSessionInBackground(session, 'unclaimed-timeout')
    }
  }, Math.min(1000, unclaimedTimeoutMs))
  expiryTimer.unref()

  function closeClaimedSessionIfEmpty(session: SessionRecord): void {
    if (
      session.closing
      || !session.claimed
      || session.activeProxies > 0
      || session.host.playerCount() > 0
    ) return
    closeSessionInBackground(session, 'empty-after-use')
  }

  function closeSessionInBackground(session: SessionRecord, reason: string): void {
    void closeSession(session, reason).catch(() => {})
  }

  function closeSession(session: SessionRecord, reason: string): Promise<void> {
    if (session.closePromise) return session.closePromise
    session.closing = true
    logGameServerEvent(
      options.log,
      'session-supervisor',
      'info',
      'session.closing',
      'A browser game session is closing.',
      logDetails({ reason, sessionId: session.id }),
    )
    session.closePromise = (async () => {
      try {
        await session.host.close(
          reason === 'host-cancelled' ? 'host-ended-session' : 'server-shutdown',
        )
      } catch (error) {
        logGameServerEvent(
          options.log,
          'session-supervisor',
          'error',
          'session.close_failed',
          'A browser game session could not close cleanly.',
          logDetails({ reason, sessionId: session.id, ...gameServerErrorDetails(error) }),
        )
        throw error
      } finally {
        sessions.delete(session.id)
      }
      logGameServerEvent(
        options.log,
        'session-supervisor',
        'info',
        'session.closed',
        'A browser game session closed.',
        logDetails({ reason, sessionCount: sessions.size, sessionId: session.id }),
      )
    })()
    return session.closePromise
  }

  await listen(server, options.port ?? 0, host)
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('The game session supervisor did not bind a TCP address')
  }
  logGameServerEvent(
    options.log,
    'session-supervisor',
    'info',
    'supervisor.listening',
    'The browser game-session supervisor is listening.',
    logDetails({ host, maxSessions, port: address.port }),
  )

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
      await Promise.all([...sessions.values()].map((session) => (
        closeSession(session, 'supervisor-shutdown')
      )))
      for (const socket of downstreamSockets) {
        closePeer(socket, 1012, 'server shutdown')
        const forceClose = setTimeout(() => {
          if (socket.readyState !== WebSocket.CLOSED) socket.terminate()
        }, 1_000)
        forceClose.unref()
      }
      websocketServer.close()
      await closeHttpServer(server)
      logGameServerEvent(
        options.log,
        'session-supervisor',
        'info',
        'supervisor.closed',
        'The browser game-session supervisor stopped.',
        logDetails(),
      )
    },
    sessionCount: () => sessions.size,
  }
}

function lobbyRouteId(path: string, suffix = ''): string | null {
  const prefix = '/admin/lobbies/'
  if (!path.startsWith(prefix) || (suffix && !path.endsWith(suffix))) return null
  const end = suffix ? path.length - suffix.length : path.length
  const id = path.slice(prefix.length, end)
  return /^[A-Za-z0-9_-]{32}$/.test(id) ? id : null
}

function normalizeHostPlayer(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized || normalized.length > 64 || [...normalized].some(isControlCharacter)) {
    return null
  }
  return normalized
}

function isControlCharacter(value: string): boolean {
  const code = value.charCodeAt(0)
  return code < 32 || (code >= 127 && code <= 159)
}

async function readJsonObject(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > 4096) throw new Error('request body is too large')
    chunks.push(bytes)
  }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('request body must be an object')
  }
  return value as Record<string, unknown>
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json',
    ...headers,
  })
  response.end(JSON.stringify(body))
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

function socketRemoteAddress(socket: Duplex): string {
  if ('remoteAddress' in socket && typeof socket.remoteAddress === 'string') {
    return socket.remoteAddress
  }
  return 'unknown'
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

import { randomBytes, timingSafeEqual } from 'node:crypto'
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http'
import type { Duplex } from 'node:stream'

import { WebSocket, WebSocketServer } from 'ws'

import {
  GAME_PROTOCOL_NAME,
  GAME_WEBSOCKET_MAX_PAYLOAD_BYTES,
} from '../protocol/game-protocol.ts'
import { createBoneyardCatalog, type BoneyardCatalog } from './boneyard-catalog.ts'
import {
  startGameHost,
  type GameHost,
  type GameHostAdmission,
  type GameHostObservationTarget,
  type GameHostPartyTarget,
} from './game-host.ts'
import {
  compileWebSessionContentDefinitions,
  materializeWebSessionContent,
} from './web-mod-content.ts'
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
import type { MlBotPolicyInference } from './ml-bot-host-controller.ts'
import type { RuntimeEventSink } from './runtime-event-publisher.ts'
import {
  verifyPartyRecoveryClaim,
} from './party-recovery-claim.ts'

export const GAME_SESSION_PATH_PREFIX = '/game-sessions/'
export const GAME_HUB_PATH = '/game-hub'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
const DEFAULT_MAX_CONNECTIONS_PER_SESSION = 16
const DEFAULT_MAX_SESSIONS = 64
const DEFAULT_UNCLAIMED_TIMEOUT_MS = 2 * 60 * 1000
const JOIN_INTENT_TIMEOUT_MS = 10 * 60 * 1000
const MAX_PROVISION_REQUEST_BYTES = 48 * 1024 * 1024

export interface GameSessionSupervisorOptions {
  adminSecret: string
  allowedOrigins: readonly string[]
  boneyards?: BoneyardCatalog
  deploymentSaveTimeoutMs?: number
  heartbeatIntervalMs?: number
  host?: string
  log?: GameServerLogSink
  luaWasmPath?: string
  maxConnectionsPerSession?: number
  maxSessions?: number
  mlBotPolicy?: MlBotPolicyInference
  port?: number
  revision?: string
  runtimeEvents?: RuntimeEventSink
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
  content: GameHostAdmission['content']
  host: GameHost
  id: string
  kind: 'hub' | 'private'
  tickets: Map<string, HostTicket>
}

interface HostTicket {
  readonly admission: GameHostAdmission
  readonly expiresAt: number
}

interface JoinIntent {
  readonly expiresAt: number
  readonly locator: Readonly<{ kind: 'code' | 'public' | 'request'; value: string }>
  readonly partyId: string
  readonly requestToken: string | null
  readonly sessionId: string
}

interface SupervisorJoinRequest {
  readonly expiresAt: number
  intentId: string | null
  readonly listingId: string
  readonly sessionId: string
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
  const revision = (options.revision ?? '0'.repeat(40)).trim().toLowerCase()
  if (!/^[a-f0-9]{40}$/.test(revision)) {
    throw new Error('The game session supervisor revision must be a full Git commit ID')
  }
  const unclaimedTimeoutMs = positiveDuration(
    options.unclaimedTimeoutMs ?? DEFAULT_UNCLAIMED_TIMEOUT_MS,
    'unclaimedTimeoutMs',
  )
  const deploymentSaveTimeoutMs = positiveDuration(
    options.deploymentSaveTimeoutMs ?? 30_000,
    'deploymentSaveTimeoutMs',
  )
  const heartbeatIntervalMs = resolveGameHeartbeatInterval(options.heartbeatIntervalMs)
  const maxConnectionsPerSession = positiveInteger(
    options.maxConnectionsPerSession ?? DEFAULT_MAX_CONNECTIONS_PER_SESSION,
    'maxConnectionsPerSession',
  )
  const maxSessions = positiveInteger(options.maxSessions ?? DEFAULT_MAX_SESSIONS, 'maxSessions')
  const sessions = new Map<string, SessionRecord>()
  const hubTickets = new Map<string, HostTicket>()
  const joinIntents = new Map<string, JoinIntent>()
  const joinRequests = new Map<string, SupervisorJoinRequest>()
  const partyRecoverySessions = new Map<
    string,
    Readonly<{ seedExpiresAt: number; session: SessionRecord }>
  >()
  const partyRecoveryStarts = new Map<string, Promise<SessionRecord>>()
  const retiredPartyRecoveries = new Set<string>()
  const downstreamSockets = new Set<WebSocket>()
  let closed = false
  let draining = false
  let provisioning = 0
  const logDetails = (details: Readonly<Record<string, unknown>> = {}) => details
  const emitRuntimeEvent = (
    event: string,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) => options.runtimeEvents?.({
    component: 'session-supervisor',
    details,
    event,
    message,
    occurredAtUtc: new Date().toISOString(),
  })
  const claimHubTicket = (credential: string): GameHostAdmission | null => {
    const ticket = hubTickets.get(credential)
    if (ticket === undefined) return null
    hubTickets.delete(credential)
    return ticket.expiresAt > performance.now() ? ticket.admission : null
  }
  const hubHost = await startGameHost({
    authentication: { kind: 'tickets', claim: claimHubTicket },
    heartbeatIntervalMs,
    log: options.log,
    logContext: { sessionId: 'shared-hub', sessionKind: 'hub' },
    luaWasmPath: options.luaWasmPath,
    leaderboardReceiptSecret: options.adminSecret,
    maxPlayers: maxConnectionsPerSession,
    mlBotPolicy: options.mlBotPolicy,
    partyRecoverySecret: options.adminSecret,
    runtimeEvents: options.runtimeEvents,
    sharedHub: true,
    sessionKind: 'global-hub',
    ...(options.boneyards === undefined ? {} : { boneyards: options.boneyards }),
    ...(options.snapshotRate === undefined ? {} : { snapshotRate: options.snapshotRate }),
  })
  const hubSession: SessionRecord = {
    activeProxies: 0,
    claimed: true,
    closePromise: null,
    closing: false,
    createdAt: performance.now(),
    host: hubHost,
    content: materializeWebSessionContent({ manifestSha256: '0'.repeat(64), mods: [] }),
    id: 'shared-hub',
    kind: 'hub',
    tickets: hubTickets,
  }

  const websocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: GAME_WEBSOCKET_MAX_PAYLOAD_BYTES,
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
        draining,
        sessions: sessions.size + Number(hubHost.playerCount() > 0),
        privateSessions: sessions.size,
        privatePlayers: [...sessions.values()].reduce(
          (total, session) => total + session.host.humanPlayerCount(),
          0,
        ),
        hubPlayers: hubHost.hubPlayerCount(),
        hubHumanPlayers: hubHost.humanPlayerCount(),
        bots: hubHost.botCount(),
        parties: hubHost.partyCount(),
        runs: hubHost.runCount(),
        players: hubHost.playerCount(),
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
    if (request.method === 'POST' && path === '/admin/deployments/restart') {
      if (draining) {
        sendJson(response, 409, { error: 'A deployment restart is already in progress.' })
        return
      }
      void readJsonObject(request).then(async (body) => {
        const targetRevision = deploymentTargetRevision(body)
        draining = true
        hubTickets.clear()
        const privateSessions = [...sessions.values()]
        const restartablePrivateSessions = privateSessions.filter(session => !session.closing)
        const results = await Promise.all([
          hubHost.restartForDeployment(targetRevision, deploymentSaveTimeoutMs),
          ...restartablePrivateSessions.map(session => session.host.restartForDeployment(
            targetRevision,
            deploymentSaveTimeoutMs,
          )),
        ])
        await Promise.all(privateSessions.map(session => (
          session.closePromise ?? closeSession(session, 'deployment-restart')
        )))
        const players = results.reduce((total, result) => total + result.players, 0)
        const savedPlayers = results.reduce(
          (total, result) => total + result.savedPlayers,
          0,
        )
        const unacknowledgedPlayers = results.reduce(
          (total, result) => total + result.unacknowledgedPlayers,
          0,
        )
        logGameServerEvent(
          options.log,
          'session-supervisor',
          unacknowledgedPlayers === 0 ? 'info' : 'warning',
          'deployment.ready',
          'Browser game sessions are drained and ready for deployment.',
          logDetails({
            players,
            savedPlayers,
            targetRevision,
            unacknowledgedPlayers,
          }),
        )
        sendJson(response, 200, {
          status: 'ready',
          players,
          savedPlayers,
          targetRevision,
          unacknowledgedPlayers,
        })
      }).catch((error: unknown) => {
        logGameServerEvent(
          options.log,
          'session-supervisor',
          'error',
          'deployment.restart_failed',
          'The browser game sessions could not prepare for deployment.',
          logDetails(gameServerErrorDetails(error)),
        )
        if (!response.headersSent) {
          sendJson(response, 500, { error: 'The game update could not prepare active players.' })
        }
      })
      return
    }
    if (draining && request.method === 'POST') {
      sendJson(
        response,
        503,
        { error: 'The game is updating.' },
        { 'retry-after': '5' },
      )
      return
    }
    if (request.method === 'GET' && path === '/admin/hub/parties') {
      sendJson(response, 200, { items: hubHost.publicParties() })
      return
    }
    if (request.method === 'GET' && path === '/admin/presence') {
      // Developer-only telemetry: the backend gates who may read this; the
      // supervisor itself only ever answers admin-secret bearers.
      sendJson(response, 200, {
        items: [
          ...hubHost.presence().map(entry => ({ ...entry, session: 'global-hub' as const })),
          ...[...sessions.values()].filter(session => !session.closing).flatMap(
            session => session.host.presence().map(
              entry => ({ ...entry, session: 'private-college' as const }),
            ),
          ),
        ],
      })
      return
    }
    if (request.method === 'GET' && path === '/admin/matches') {
      sendJson(response, 200, { items: activeMatchDirectory() })
      return
    }
    if (request.method === 'POST' && path === '/admin/observers') {
      void readJsonObject(request).then((body) => {
        const observerRequest = materializeObserverRequest(body)
        const resolved = resolveObservationTarget(observerRequest.matchId)
        if (!resolved) {
          sendJson(response, 404, { error: 'That match is no longer active.' })
          return
        }
        const credential = randomBytes(32).toString('base64url')
        const expiresAt = performance.now() + unclaimedTimeoutMs
        resolved.session.tickets.set(credential, {
          admission: {
            content: resolved.session.content,
            developerAccess: true,
            leaderboardUserId: null,
            observer: {
              runId: resolved.target.runId,
              userId: observerRequest.userId,
              username: observerRequest.username,
            },
          },
          expiresAt,
        })
        const details = {
          boneyardName: resolved.target.boneyardName,
          matchId: observerRequest.matchId,
          observerUserId: observerRequest.userId,
          observerUsername: observerRequest.username,
          sessionId: resolved.session.id,
        }
        logGameServerEvent(
          options.log,
          'session-supervisor',
          'info',
          'observer.admission_issued',
          'A developer observer admission was issued for an active match.',
          logDetails(details),
        )
        emitRuntimeEvent(
          'observer.admission_issued',
          'A developer observer admission was issued for an active match.',
          details,
        )
        sendJson(response, 201, {
          credential,
          path: resolved.session.kind === 'hub'
            ? GAME_HUB_PATH
            : `${GAME_SESSION_PATH_PREFIX}${resolved.session.id}`,
          protocol: GAME_PROTOCOL_NAME,
          sessionKind: resolved.session.kind === 'hub' ? 'global-hub' : 'private-college',
        })
      }).catch(() => {
        sendJson(response, 400, { error: 'A valid observer request is required.' })
      })
      return
    }
    if (request.method === 'POST' && path === '/admin/sessions') {
      void readJsonObject(request).then(async (body) => {
        provisionIntoResponse(response, await materializeGameAdmission(body, options.luaWasmPath))
      }).catch(() => {
        sendJson(response, 400, { error: 'A valid game admission is required.' })
      })
      return
    }
    if (request.method === 'POST' && path === '/admin/hub/tickets') {
      void readJsonObject(request).then(async (body) => {
        const admission = await materializeGameAdmission(body, options.luaWasmPath)
        pruneHubTickets()
        if (hubHost.playerCount() + playerTicketCount(hubTickets) >= maxConnectionsPerSession) {
          sendJson(response, 503, { error: 'The shared Hub is full.' }, { 'retry-after': '5' })
          return
        }
        const credential = randomBytes(32).toString('base64url')
        hubTickets.set(credential, {
          admission,
          expiresAt: performance.now() + unclaimedTimeoutMs,
        })
        sendJson(response, 201, {
          credential,
          path: GAME_HUB_PATH,
          protocol: GAME_PROTOCOL_NAME,
          sessionKind: 'global-hub',
        })
      }).catch(() => {
        sendJson(response, 400, { error: 'A valid game admission is required.' })
      })
      return
    }
    if (request.method === 'POST' && path === '/admin/join/resolve') {
      void handleJoinResolve(request, response, 'code')
      return
    }
    if (request.method === 'POST' && path === '/admin/join/public') {
      void handleJoinResolve(request, response, 'listing')
      return
    }
    if (request.method === 'POST' && path === '/admin/join/requests') {
      void handleJoinRequest(request, response)
      return
    }
    const requestToken = /^\/admin\/join\/requests\/([A-Za-z0-9_-]{32,128})$/.exec(path)?.[1]
    if (request.method === 'GET' && requestToken) {
      handleJoinRequestStatus(requestToken, response)
      return
    }
    if (request.method === 'POST' && path === '/admin/join/admit') {
      void handleJoinAdmission(request, response)
      return
    }
    if (request.method === 'POST' && path === '/admin/rejoin') {
      void handlePartyRejoin(request, response)
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

  async function handleJoinResolve(
    request: IncomingMessage,
    response: ServerResponse,
    locatorKind: 'code' | 'listing',
  ): Promise<void> {
    try {
      const body = await readJsonObject(request)
      const locator = locatorKind === 'code'
        ? normalizePartyJoinCode(body.code)
        : partyLocator(body.listingId, 'listingId')
      const resolved = resolvePartyTarget(locatorKind, locator)
      if (!resolved) {
        sendJson(response, 404, { error: 'That party has ended or is no longer available.' })
        return
      }
      if (locatorKind === 'listing' && resolved.target.visibility !== 'public') {
        sendJson(response, 409, { error: 'That party requires a join request.' })
        return
      }
      if (resolved.target.status !== 'hub') {
        sendJson(response, 409, { error: 'That party is in a Boneyard. Wait for it to return.' })
        return
      }
      sendJson(response, 201, createJoinIntent(
        resolved.session,
        resolved.target,
        { kind: locatorKind === 'code' ? 'code' : 'public', value: locator },
      ))
    } catch {
      sendJson(response, 400, { error: 'A valid party join request is required.' })
    }
  }

  async function handleJoinRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    try {
      const body = await readJsonObject(request)
      const listingId = partyLocator(body.listingId, 'listingId')
      const requester = partyJoinRequester(body.requester)
      const resolved = resolvePartyTarget('listing', listingId)
      if (!resolved) {
        sendJson(response, 404, { error: 'That party has ended or is no longer available.' })
        return
      }
      if (resolved.target.visibility !== 'invite-only') {
        sendJson(response, 409, { error: 'That party does not accept join requests.' })
        return
      }
      if (resolved.target.status !== 'hub') {
        sendJson(response, 409, { error: 'That party is in a Boneyard. Wait for it to return.' })
        return
      }
      const token = randomBytes(24).toString('base64url')
      const result = resolved.session.host.createPartyJoinRequest({
        expiresAt: performance.now() + JOIN_INTENT_TIMEOUT_MS,
        id: `request-${randomBytes(18).toString('base64url')}`,
        listingId,
        requester,
        token,
      })
      if (!result.accepted) {
        sendJson(response, 409, { error: partyJoinError(result.reason) })
        return
      }
      joinRequests.set(token, {
        expiresAt: performance.now() + JOIN_INTENT_TIMEOUT_MS,
        intentId: null,
        listingId,
        sessionId: resolved.session.id,
      })
      sendJson(response, 201, { requestToken: token, status: 'pending' })
    } catch {
      sendJson(response, 400, { error: 'A valid party join request is required.' })
    }
  }

  function handleJoinRequestStatus(token: string, response: ServerResponse): void {
    const tracked = joinRequests.get(token)
    if (tracked && tracked.expiresAt <= performance.now()) joinRequests.delete(token)
    const active = joinRequests.get(token)
    const session = active ? sessionById(active.sessionId) : null
    const status = session?.host.partyJoinRequestStatus(token)
    if (!active || !session || !status) {
      joinRequests.delete(token)
      sendJson(response, 404, { error: 'That join request has expired.' })
      return
    }
    if (status.status === 'denied') {
      sendJson(response, 200, { status: 'denied' })
      return
    }
    if (status.status === 'pending') {
      sendJson(response, 200, { status: 'pending' })
      return
    }
    const target = session.host.partyTargetByListingId(active.listingId)
    if (!target || target.id !== status.partyId || target.status !== 'hub') {
      sendJson(response, 409, { error: 'That party is no longer available.' })
      return
    }
    let intentId = active.intentId
    if (!intentId || !joinIntents.has(intentId)) {
      const intent = createJoinIntent(
        session,
        target,
        { kind: 'request', value: active.listingId },
        token,
      )
      intentId = intent.intentId
      active.intentId = intentId
    }
    sendJson(response, 200, {
      status: 'accepted',
      ...joinIntentPayload(intentId, session, target),
    })
  }

  async function handleJoinAdmission(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    let reservationId: string | null = null
    let reservedHost: GameHost | null = null
    try {
      const body = await readJsonObject(request)
      const intentId = partyLocator(body.intentId, 'intentId')
      const intent = joinIntents.get(intentId)
      const session = intent ? sessionById(intent.sessionId) : null
      if (!intent || intent.expiresAt <= performance.now() || !session || session.closing) {
        joinIntents.delete(intentId)
        sendJson(response, 404, { error: 'That party join has expired.' })
        return
      }
      const target = intent.locator.kind === 'code'
        ? session.host.partyTargetByCode(intent.locator.value)
        : session.host.partyTargetByListingId(intent.locator.value)
      if (!target || target.id !== intent.partyId || target.status !== 'hub') {
        joinIntents.delete(intentId)
        sendJson(response, 409, { error: 'That party is no longer available.' })
        return
      }
      if (intent.locator.kind === 'public' && target.visibility !== 'public') {
        joinIntents.delete(intentId)
        sendJson(response, 409, { error: 'That party now requires a join request.' })
        return
      }
      const requestedAdmission = await materializeGameAdmission(body, options.luaWasmPath)
      if (typeof body.activeMods !== 'boolean') {
        throw new Error('active mod state is invalid')
      }
      if (session.kind === 'hub' && body.activeMods) {
        sendJson(response, 409, { error: 'Disable active mods before joining the global Hub.' })
        return
      }
      const now = performance.now()
      pruneHostTickets(session, now)
      if (session.host.playerCount() + playerTicketCount(session.tickets) >= maxConnectionsPerSession) {
        sendJson(response, 409, { error: 'That College is full.' })
        return
      }
      reservationId = randomBytes(24).toString('base64url')
      const expiresAt = now + unclaimedTimeoutMs
      const rejected = session.host.reservePartyJoin(target.id, reservationId, expiresAt)
      if (rejected) {
        sendJson(response, 409, { error: partyJoinError(rejected) })
        return
      }
      reservedHost = session.host
      const admission: GameHostAdmission = {
        content: session.kind === 'hub' ? requestedAdmission.content : session.content,
        developerAccess: requestedAdmission.developerAccess,
        leaderboardUserId: requestedAdmission.leaderboardUserId,
        partyId: target.id,
        reservationId,
      }
      const credential = randomBytes(32).toString('base64url')
      session.tickets.set(credential, { admission, expiresAt })
      joinIntents.delete(intentId)
      if (intent.requestToken) joinRequests.delete(intent.requestToken)
      sendJson(response, 201, {
        credential,
        path: session.kind === 'hub' ? GAME_HUB_PATH : `${GAME_SESSION_PATH_PREFIX}${session.id}`,
        protocol: GAME_PROTOCOL_NAME,
        sessionKind: session.kind === 'hub' ? 'global-hub' : 'private-college',
      })
    } catch {
      if (reservationId && reservedHost) reservedHost.cancelPartyReservation(reservationId)
      sendJson(response, 400, { error: 'A valid party admission is required.' })
    }
  }

  async function handlePartyRejoin(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    let reservationId: string | null = null
    let reservedHost: GameHost | null = null
    try {
      const body = await readJsonObject(request)
      const token = normalizePartyRejoinToken(body.token)
      if (typeof body.save !== 'string' || Buffer.byteLength(body.save, 'utf8') > 8 * 1024 * 1024) {
        throw new Error('party recovery save is invalid')
      }
      const requestedAdmission = await materializeGameAdmission(body, options.luaWasmPath)
      const claim = verifyPartyRecoveryClaim(options.adminSecret, token, body.save)
      if (!claim && /^[A-Za-z0-9_-]{43}$/.test(token)) {
        sendJson(response, 404, { error: 'That active party run has ended.' })
        return
      }
      if (
        !claim
        || claim.sessionKind === 'standalone'
        || claim.contentManifestSha256 !== requestedAdmission.content.manifest.manifestSha256
        || claim.leaderboardUserId !== requestedAdmission.leaderboardUserId
      ) {
        sendJson(response, 400, { error: 'A valid active-party rejoin is required.' })
        return
      }
      let resolved = [hubSession, ...sessions.values()].flatMap(session => {
        if (session.closing) return []
        const target = session.host.partyRejoinTarget(token)
        return target ? [{ session, target }] : []
      })
      if (resolved.length === 0) {
        const recovery = partyRecoverySessions.get(claim.recoveryId)
        const starting = partyRecoveryStarts.get(claim.recoveryId)
        if (recovery || starting) {
          const now = performance.now()
          if (
            recovery?.seedExpiresAt === Number.POSITIVE_INFINITY
            || (recovery !== undefined && recovery.seedExpiresAt <= now)
          ) {
            partyRecoverySessions.delete(claim.recoveryId)
            retiredPartyRecoveries.add(claim.recoveryId)
          } else {
            const session = recovery?.session ?? await starting!
            const waitMs = recovery
              ? Math.max(1, recovery.seedExpiresAt - now)
              : unclaimedTimeoutMs
            const target = await waitForPartyRecoveryTarget(session, token, waitMs)
            if (target) resolved = [{ session, target }]
            else if ((recovery?.seedExpiresAt ?? performance.now()) <= performance.now()) {
              partyRecoverySessions.delete(claim.recoveryId)
              retiredPartyRecoveries.add(claim.recoveryId)
            } else {
              sendJson(response, 409, { error: 'That party recovery is still starting.' })
              return
            }
          }
        }
      }
      if (resolved.length === 0) {
        if (claim.targetRevision !== revision || retiredPartyRecoveries.has(claim.recoveryId)) {
          sendJson(response, 404, { error: 'That active party run has ended.' })
          return
        }
        const seedAdmission: GameHostAdmission = {
          content: requestedAdmission.content,
          developerAccess: requestedAdmission.developerAccess,
          leaderboardUserId: requestedAdmission.leaderboardUserId,
          partyRecoverySeed: true,
          partyRejoinToken: token,
        }
        if (claim.sessionKind === 'global-hub') {
          const credential = randomBytes(32).toString('base64url')
          const expiresAt = performance.now() + unclaimedTimeoutMs
          hubSession.tickets.set(credential, { admission: seedAdmission, expiresAt })
          partyRecoverySessions.set(claim.recoveryId, {
            seedExpiresAt: expiresAt,
            session: hubSession,
          })
          sendPartyRejoinEndpoint(response, hubSession, credential)
          return
        }
        const start = provisionSession(seedAdmission)
        partyRecoveryStarts.set(claim.recoveryId, start.then(({ session }) => session))
        try {
          const provisioned = await start
          partyRecoverySessions.set(claim.recoveryId, {
            seedExpiresAt: performance.now() + unclaimedTimeoutMs,
            session: provisioned.session,
          })
          sendPartyRejoinEndpoint(response, provisioned.session, provisioned.credential)
        } finally {
          partyRecoveryStarts.delete(claim.recoveryId)
        }
        return
      }
      if (resolved.length !== 1) throw new Error('party recovery resolved to multiple hosts')
      const { session, target } = resolved[0]!
      partyRecoverySessions.set(claim.recoveryId, {
        seedExpiresAt: Number.POSITIVE_INFINITY,
        session,
      })
      if (target.status !== 'detached') {
        sendJson(response, 409, { error: 'That active-party rejoin is already being claimed.' })
        return
      }
      if (target.content.manifest.manifestSha256 !== claim.contentManifestSha256) {
        sendJson(response, 409, { error: 'The saved content no longer matches that party run.' })
        return
      }
      const now = performance.now()
      pruneHostTickets(session, now)
      if (
        session.host.playerCount() - 1 + playerTicketCount(session.tickets)
        >= maxConnectionsPerSession
      ) {
        sendJson(response, 409, { error: 'That College is full.' })
        return
      }
      reservationId = randomBytes(24).toString('base64url')
      const expiresAt = now + unclaimedTimeoutMs
      const rejection = session.host.reservePartyRejoin(token, reservationId, expiresAt)
      if (rejection) {
        sendJson(response, 409, {
          error: rejection === 'player-connected'
            ? 'That wizard is still connected.'
            : rejection === 'already-reserved'
              ? 'That active-party rejoin is already being claimed.'
              : 'That active party run has ended.',
        })
        return
      }
      reservedHost = session.host
      const credential = randomBytes(32).toString('base64url')
      session.tickets.set(credential, {
        admission: {
          content: requestedAdmission.content,
          developerAccess: requestedAdmission.developerAccess,
          leaderboardUserId: requestedAdmission.leaderboardUserId,
          partyRejoinToken: token,
          reservationId,
        },
        expiresAt,
      })
      sendPartyRejoinEndpoint(response, session, credential)
    } catch {
      if (reservationId && reservedHost) reservedHost.cancelPartyReservation(reservationId)
      sendJson(response, 400, { error: 'A valid active-party rejoin is required.' })
    }
  }

  function sendPartyRejoinEndpoint(
    response: ServerResponse,
    session: SessionRecord,
    credential: string,
  ): void {
    sendJson(response, 201, {
      credential,
      path: session.kind === 'hub' ? GAME_HUB_PATH : `${GAME_SESSION_PATH_PREFIX}${session.id}`,
      protocol: GAME_PROTOCOL_NAME,
      sessionKind: session.kind === 'hub' ? 'global-hub' : 'private-college',
    })
  }

  async function waitForPartyRecoveryTarget(
    session: SessionRecord,
    token: string,
    timeoutMs: number,
  ): Promise<ReturnType<GameHost['partyRejoinTarget']>> {
    const deadline = performance.now() + timeoutMs
    while (!session.closing && performance.now() < deadline) {
      const target = session.host.partyRejoinTarget(token)
      if (target) return target
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    return null
  }

  function resolvePartyTarget(
    kind: 'code' | 'listing',
    value: string,
  ): { session: SessionRecord; target: GameHostPartyTarget } | null {
    const matches: { session: SessionRecord; target: GameHostPartyTarget }[] = []
    for (const session of [hubSession, ...sessions.values()]) {
      if (session.closing) continue
      const target = kind === 'code'
        ? session.host.partyTargetByCode(value)
        : session.host.partyTargetByListingId(value)
      if (target) matches.push({ session, target })
    }
    return matches.length === 1 ? matches[0]! : null
  }

  function activeMatchDirectory() {
    return [hubSession, ...sessions.values()].flatMap(session => (
      session.closing ? [] : session.host.observationTargets().map(target => ({
        boneyardName: target.boneyardName,
        id: observationMatchId(session.id, target.runId),
        partyLeader: target.partyLeader,
        playerCount: target.playerCount,
        players: target.players,
        session: session.kind === 'hub' ? 'global-hub' as const : 'private-college' as const,
        visibility: target.visibility,
        waveNumber: target.waveNumber,
      }))
    ))
  }

  function resolveObservationTarget(matchId: string): {
    session: SessionRecord
    target: GameHostObservationTarget
  } | null {
    for (const session of [hubSession, ...sessions.values()]) {
      if (session.closing) continue
      for (const target of session.host.observationTargets()) {
        if (observationMatchId(session.id, target.runId) === matchId) {
          return { session, target }
        }
      }
    }
    return null
  }

  function createJoinIntent(
    session: SessionRecord,
    target: GameHostPartyTarget,
    locator: JoinIntent['locator'],
    requestToken: string | null = null,
  ) {
    const intentId = randomBytes(24).toString('base64url')
    joinIntents.set(intentId, {
      expiresAt: performance.now() + JOIN_INTENT_TIMEOUT_MS,
      locator,
      partyId: target.id,
      requestToken,
      sessionId: session.id,
    })
    return joinIntentPayload(intentId, session, target)
  }

  function joinIntentPayload(
    intentId: string,
    session: SessionRecord,
    target: GameHostPartyTarget,
  ) {
    return {
      intentId,
      target: {
        content: target.content,
        kind: session.kind === 'hub' ? 'global-hub' : 'private-college',
        leader: target.leader,
        memberCount: target.memberCount,
        status: target.status,
        visibility: target.visibility,
      },
    }
  }

  function sessionById(id: string): SessionRecord | null {
    return id === hubSession.id ? hubSession : sessions.get(id) ?? null
  }

  function provisionIntoResponse(
    response: ServerResponse,
    admission: GameHostAdmission,
  ): void {
    if (sessions.size + provisioning >= maxSessions) {
      sendJson(response, 503, { error: 'Game session capacity is exhausted.' }, { 'retry-after': '5' })
      return
    }
    provisioning += 1
    void provisionSession(admission).then(({ credential, session }) => {
      sendJson(response, 201, {
        credential,
        path: `${GAME_SESSION_PATH_PREFIX}${session.id}`,
        protocol: GAME_PROTOCOL_NAME,
        sessionKind: 'private-college',
        sessionId: session.id,
      })
    }).catch((error) => {
      logGameServerEvent(
        options.log,
        'session-supervisor',
        'error',
        'session.provision_failed',
        'A game session could not be provisioned.',
        logDetails({ kind: 'private', ...gameServerErrorDetails(error) }),
      )
      sendJson(response, 503, { error: 'A game session could not be started.' }, { 'retry-after': '5' })
    }).finally(() => {
      provisioning -= 1
    })
  }

  server.on('upgrade', (request, socket, head) => {
    if (draining) {
      rejectUpgrade(socket, 503, 'Game Updating')
      return
    }
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
    const path = request.url?.split('?', 1)[0]
    const sessionId = sessionIdFromPath(path)
    const session = path === GAME_HUB_PATH
      ? hubSession
      : sessionId ? sessions.get(sessionId) : undefined
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
    admission: GameHostAdmission,
  ): Promise<{ credential: string; session: SessionRecord }> {
    if (closed) throw new Error('The game session supervisor is closed')
    const id = randomBytes(24).toString('base64url')
    const credential = randomBytes(32).toString('base64url')
    const tickets = new Map<string, HostTicket>()
    tickets.set(credential, {
      admission,
      expiresAt: performance.now() + unclaimedTimeoutMs,
    })
    const sessionHost = await startGameHost({
      authentication: {
        kind: 'tickets',
        claim: candidate => claimHostTicket(tickets, candidate),
      },
      heartbeatIntervalMs,
      log: options.log,
      logContext: { sessionId: id, sessionKind: 'private' },
      luaWasmPath: options.luaWasmPath,
      content: admission.content.manifest,
      contentSummary: admission.content.summary,
      modContent: admission.content,
      modAssets: admission.content.assets,
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
      runtimeEvents: options.runtimeEvents,
      partyRecoverySecret: options.adminSecret,
      boneyards: createBoneyardCatalog([
        ...(options.boneyards?.modEntries.values() ?? []),
        ...admission.content.boneyards,
      ]),
      sessionKind: 'private-college',
      ...(options.snapshotRate === undefined ? {} : { snapshotRate: options.snapshotRate }),
    })
    const session: SessionRecord = {
      activeProxies: 0,
      claimed: false,
      closePromise: null,
      closing: false,
      createdAt: performance.now(),
      content: admission.content,
      host: sessionHost,
      id,
      kind: 'private',
      tickets,
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
      logDetails({ kind: 'private', sessionId: id, sessionCount: sessions.size }),
    )
    emitRuntimeEvent(
      'session.provisioned',
      'An isolated browser game session was provisioned.',
      { kind: 'private', sessionId: id, sessionCount: sessions.size },
    )
    return { credential, session }
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
      if (session.kind === 'private') closeClaimedSessionIfEmpty(session)
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
        // Let the authoritative host publish its explicit protocol timeout before
        // the outer proxy becomes the fallback liveness owner.
        stopHeartbeat = monitorWebSocketHeartbeat(downstream, heartbeatIntervalMs * 2, {
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
    const now = performance.now()
    pruneHubTickets(now)
    for (const [intentId, intent] of joinIntents) {
      if (intent.expiresAt <= now) joinIntents.delete(intentId)
    }
    for (const [token, request] of joinRequests) {
      if (request.expiresAt <= now) joinRequests.delete(token)
    }
    for (const session of sessions.values()) {
      pruneHostTickets(session, now)
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

  function pruneHubTickets(now = performance.now()): void {
    pruneHostTickets(hubSession, now)
  }

  function pruneHostTickets(session: SessionRecord, now: number): void {
    for (const [credential, ticket] of session.tickets) {
      if (ticket.expiresAt > now) continue
      session.tickets.delete(credential)
      if (ticket.admission.reservationId) {
        session.host.cancelPartyReservation(ticket.admission.reservationId)
      }
    }
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
        for (const ticket of session.tickets.values()) {
          if (ticket.admission.reservationId) {
            session.host.cancelPartyReservation(ticket.admission.reservationId)
          }
        }
        session.tickets.clear()
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
        for (const [recoveryId, recovery] of partyRecoverySessions) {
          if (recovery.session !== session) continue
          partyRecoverySessions.delete(recoveryId)
          retiredPartyRecoveries.add(recoveryId)
        }
      }
      logGameServerEvent(
        options.log,
        'session-supervisor',
        'info',
        'session.closed',
        'A browser game session closed.',
        logDetails({ reason, sessionCount: sessions.size, sessionId: session.id }),
      )
      emitRuntimeEvent(
        'session.closed',
        'A browser game session closed.',
        { reason, sessionCount: sessions.size, sessionId: session.id },
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
      hubTickets.clear()
      await Promise.all([...sessions.values()].map((session) => (
        closeSession(session, 'supervisor-shutdown')
      )))
      await hubHost.close('server-shutdown')
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
    sessionCount: () => sessions.size + Number(hubHost.playerCount() > 0),
  }
}

async function readJsonObject(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > MAX_PROVISION_REQUEST_BYTES) throw new Error('request body is too large')
    chunks.push(bytes)
  }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('request body must be an object')
  }
  return value as Record<string, unknown>
}

async function materializeGameAdmission(
  body: Record<string, unknown>,
  luaWasmPath: string | undefined,
): Promise<GameHostAdmission> {
  const value = body.leaderboardUserId
  if (
    value !== undefined
    && value !== null
    && (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 0x7fff_ffff)
  ) throw new Error('leaderboard user id is invalid')
  if (body.developerAccess !== undefined && typeof body.developerAccess !== 'boolean') {
    throw new Error('developer access is invalid')
  }
  const content = materializeWebSessionContent(body.content)
  if (content.modSources.length > 0 && !luaWasmPath) {
    throw new Error('Lua runtime is not configured for this game admission')
  }
  return {
    content: content.modSources.length === 0
      ? content
      : await compileWebSessionContentDefinitions(content, luaWasmPath!),
    developerAccess: body.developerAccess === true,
    leaderboardUserId: value === undefined || value === null ? null : Number(value),
  }
}

function materializeObserverRequest(body: Record<string, unknown>): {
  matchId: string
  userId: number
  username: string
} {
  if (
    Object.keys(body).sort().join('\0') !== ['matchId', 'observer'].join('\0')
    || typeof body.matchId !== 'string'
    || body.matchId.length < 8
    || body.matchId.length > 256
    || !/^[A-Za-z0-9_-]+$/.test(body.matchId)
    || !body.observer
    || typeof body.observer !== 'object'
    || Array.isArray(body.observer)
  ) throw new Error('observer request is invalid')
  const observer = body.observer as Record<string, unknown>
  if (
    Object.keys(observer).sort().join('\0') !== ['userId', 'username'].join('\0')
    || !Number.isSafeInteger(observer.userId)
    || Number(observer.userId) < 1
    || Number(observer.userId) > 0x7fff_ffff
    || typeof observer.username !== 'string'
    || observer.username.length < 1
    || observer.username.length > 64
  ) throw new Error('observer identity is invalid')
  return {
    matchId: body.matchId,
    userId: Number(observer.userId),
    username: observer.username,
  }
}

function observationMatchId(sessionId: string, runId: string): string {
  return Buffer.from(`${sessionId}\0${runId}`, 'utf8').toString('base64url')
}

function deploymentTargetRevision(body: Record<string, unknown>): string {
  if (Object.keys(body).length !== 1 || typeof body.targetRevision !== 'string') {
    throw new Error('deployment restart body is invalid')
  }
  const targetRevision = body.targetRevision.trim().toLowerCase()
  if (!/^[0-9a-f]{40}$/.test(targetRevision)) {
    throw new Error('deployment target revision is invalid')
  }
  return targetRevision
}

function claimHostTicket(
  tickets: Map<string, HostTicket>,
  credential: string,
): GameHostAdmission | null {
  const ticket = tickets.get(credential)
  if (!ticket) return null
  tickets.delete(credential)
  return ticket.expiresAt > performance.now() ? ticket.admission : null
}

function playerTicketCount(tickets: ReadonlyMap<string, HostTicket>): number {
  return [...tickets.values()].filter(ticket => ticket.admission.observer === undefined).length
}

function normalizePartyJoinCode(value: unknown): string {
  if (typeof value !== 'string' || value.length > 128) throw new Error('party code is invalid')
  const normalized = [...value.toUpperCase()]
    .filter(character => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.includes(character))
    .join('')
    .slice(-8)
  if (normalized.length !== 8) throw new Error('party code is invalid')
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`
}

function normalizePartyRejoinToken(value: unknown): string {
  if (
    typeof value !== 'string'
    || value.length > 2_048
    || (
      !/^[A-Za-z0-9_-]{43}$/.test(value)
      && !/^sdrpr1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)
    )
  ) {
    throw new Error('party rejoin token is invalid')
  }
  return value
}

function partyLocator(value: unknown, field: string): string {
  if (
    typeof value !== 'string'
    || value.length < 8
    || value.length > 128
    || !/^[A-Za-z0-9_-]+$/.test(value)
  ) throw new Error(`${field} is invalid`)
  return value
}

function partyJoinRequester(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('requester is invalid')
  }
  const source = value as Record<string, unknown>
  const keys = Object.keys(source).sort()
  if (keys.join('\0') !== ['accountUsername', 'displayName', 'requesterId'].join('\0')) {
    throw new Error('requester fields are invalid')
  }
  if (
    typeof source.displayName !== 'string'
    || source.displayName.length < 1
    || source.displayName.length > 64
  ) throw new Error('requester display name is invalid')
  if (
    source.accountUsername !== null
    && (
      typeof source.accountUsername !== 'string'
      || source.accountUsername.length < 1
      || source.accountUsername.length > 64
    )
  ) throw new Error('requester account name is invalid')
  return {
    accountUsername: source.accountUsername as string | null,
    displayName: source.displayName,
    requesterId: partyLocator(source.requesterId, 'requesterId'),
  }
}

function partyJoinError(reason: string): string {
  return reason === 'party-full'
    ? 'That party is full.'
    : reason === 'not-in-hub'
      ? 'That party is in a Boneyard. Wait for it to return.'
      : reason === 'already-requested'
        ? 'A join request is already pending for that party.'
        : reason === 'party-private'
          ? 'That party is private.'
          : 'That party is no longer available.'
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

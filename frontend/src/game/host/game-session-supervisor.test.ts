import assert from 'node:assert/strict'
import test from 'node:test'

import { WebSocket } from 'ws'

import {
  GAME_HOST_ENDED_SESSION_CLOSE_CODE,
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
  type ServerGameMessage,
} from '../protocol/game-protocol.ts'
import type { GameServerLogEntry } from './game-server-logger.ts'
import { startGameSessionSupervisor } from './game-session-supervisor.ts'

const ADMIN_SECRET = 'supervisor-test-secret-that-is-long-enough'
const BROWSER_ORIGIN = 'https://solomondarker.com'
const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

test('game session supervisor provisions isolated authenticated game sessions', async (context) => {
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())

  const unauthorized = await fetch(`${supervisor.address.url}/admin/sessions`, { method: 'POST' })
  assert.equal(unauthorized.status, 401)

  const firstEndpoint = await provision(supervisor.address.url)
  const secondEndpoint = await provision(supervisor.address.url)
  assert.notEqual(firstEndpoint.path, secondEndpoint.path)
  assert.notEqual(firstEndpoint.credential, secondEndpoint.credential)
  assert.equal(supervisor.sessionCount(), 2)

  const first = await join(supervisor.address.url, firstEndpoint, BROWSER_ORIGIN)
  const second = await join(supervisor.address.url, secondEndpoint, BROWSER_ORIGIN)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())
  assert.equal(first.socket.extensions, 'permessage-deflate')
  assert.equal(second.socket.extensions, 'permessage-deflate')
  assert.equal(first.welcome.playerId, 'player-1')
  assert.equal(second.welcome.playerId, 'player-1')

  await assert.rejects(
    () => openSocket(websocketUrl(supervisor.address.url, firstEndpoint.path), 'https://evil.example'),
    /403/,
  )
})

test('game session supervisor enforces capacity and expires unclaimed sessions and lobbies', async (context) => {
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    maxSessions: 1,
    unclaimedTimeoutMs: 1000,
  })
  context.after(() => supervisor.close())

  await provision(supervisor.address.url)
  const full = await fetch(`${supervisor.address.url}/admin/sessions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${ADMIN_SECRET}` },
  })
  assert.equal(full.status, 503)

  await waitFor(() => supervisor.sessionCount() === 0)
  const replacement = await createLobby(supervisor.address.url, 'Patient Wizard')
  assert.match(replacement.path, /^\/game-sessions\/[A-Za-z0-9_-]{32}$/)
  assert.equal((await listLobbies(supervisor.address.url))[0]?.id, replacement.lobbyId)
  await waitFor(async () => (await listLobbies(supervisor.address.url)).length === 0)
})

test('game session supervisor owns discoverable lobby lifecycle and reserved host access', async (context) => {
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())

  const created = await createLobby(supervisor.address.url, 'Host Wizard')
  assert.deepEqual(await listLobbies(supervisor.address.url), [{
    hostPlayer: 'Host Wizard',
    id: created.lobbyId,
    maxPlayers: 16,
    phase: 'picking-loadout',
    players: 0,
    protocol: `solomon-dark/${GAME_PROTOCOL_VERSION}`,
  }])

  const guestEndpoint = await joinLobby(supervisor.address.url, created.lobbyId)
  const guest = await join(supervisor.address.url, guestEndpoint, BROWSER_ORIGIN)
  context.after(() => guest.socket.close())
  assert.equal(guest.welcome.snapshot.hostPlayerId, null)
  assert.equal((await listLobbies(supervisor.address.url))[0].phase, 'picking-loadout')

  const creator = await join(supervisor.address.url, created, BROWSER_ORIGIN)
  context.after(() => creator.socket.close())
  const guestClosed = socketClosed(guest.socket)
  const creatorClosed = socketClosed(creator.socket)
  assert.equal(creator.welcome.snapshot.hostPlayerId, creator.welcome.playerId)
  await waitFor(async () => (await listLobbies(supervisor.address.url))[0]?.phase === 'hub')
  assert.equal((await listLobbies(supervisor.address.url))[0].players, 2)

  const denied = await fetch(`${supervisor.address.url}/admin/lobbies/${created.lobbyId}`, {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'x-solomon-dark-host-credential': 'wrong-secret',
    },
  })
  assert.equal(denied.status, 403)

  const cancelled = await fetch(`${supervisor.address.url}/admin/lobbies/${created.lobbyId}`, {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'x-solomon-dark-host-credential': created.credential,
    },
  })
  assert.equal(cancelled.status, 204)
  assert.deepEqual(await guestClosed, {
    code: GAME_HOST_ENDED_SESSION_CLOSE_CODE,
    reason: 'host ended session',
  })
  assert.deepEqual(await creatorClosed, {
    code: GAME_HOST_ENDED_SESSION_CLOSE_CODE,
    reason: 'host ended session',
  })
  assert.deepEqual(await listLobbies(supervisor.address.url), [])
})

test('game session supervisor gives connected players a reason when it shuts down', async (context) => {
  const logs: GameServerLogEntry[] = []
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    log: (entry) => logs.push(entry),
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())
  const endpoint = await provision(supervisor.address.url)
  const client = await join(supervisor.address.url, endpoint, BROWSER_ORIGIN)
  context.after(() => closeSocket(client.socket))
  const closed = socketClosed(client.socket)

  await supervisor.close()

  assert.deepEqual(await closed, { code: 1012, reason: 'server shutdown' })
  await waitFor(() => logs.some((entry) => entry.event === 'proxy.browser_closed'))
  const browserClose = logs.find((entry) => entry.event === 'proxy.browser_closed')
  assert.equal(browserClose?.details?.closeCode, 1012)
  assert.equal(browserClose?.details?.closeReason, 'server shutdown')
})

test('game session supervisor closes a used session after the final player and proxy leave', async (context) => {
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())

  const endpoint = await provision(supervisor.address.url)
  const first = await join(supervisor.address.url, endpoint, BROWSER_ORIGIN)
  const second = await join(supervisor.address.url, endpoint, BROWSER_ORIGIN)
  const pending = await openSocket(
    websocketUrl(supervisor.address.url, endpoint.path),
    BROWSER_ORIGIN,
  )

  await closeSocket(first.socket)
  assert.equal(supervisor.sessionCount(), 1)

  await closeSocket(second.socket)
  assert.equal(supervisor.sessionCount(), 1)

  await closeSocket(pending)
  await waitFor(() => supervisor.sessionCount() === 0)
  await assert.rejects(
    () => openSocket(websocketUrl(supervisor.address.url, endpoint.path), BROWSER_ORIGIN),
    /404/,
  )
})

test('game session supervisor drops a player that misses its transport heartbeat', async (context) => {
  const logs: GameServerLogEntry[] = []
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    heartbeatIntervalMs: 50,
    log: (entry) => logs.push(entry),
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())

  const created = await createLobby(supervisor.address.url, 'Responsive Wizard')
  const healthy = await join(supervisor.address.url, created, BROWSER_ORIGIN)
  context.after(() => closeSocket(healthy.socket))
  const guestEndpoint = await joinLobby(supervisor.address.url, created.lobbyId)
  const unresponsive = await join(
    supervisor.address.url,
    guestEndpoint,
    BROWSER_ORIGIN,
    false,
  )
  context.after(() => closeSocket(unresponsive.socket))
  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    unresponsive.socket.once('close', (code, reason) => resolve({
      code,
      reason: reason.toString(),
    }))
  })

  assert.equal((await listLobbies(supervisor.address.url))[0]?.players, 2)
  await waitFor(async () => (await listLobbies(supervisor.address.url))[0]?.players === 1)
  assert.deepEqual(await closed, { code: 4000, reason: 'connection timed out' })
  const timeout = logs.find((entry) => entry.event === 'proxy.heartbeat_timeout')
  assert.equal(timeout?.level, 'warning')
  assert.equal(timeout?.details?.sessionId, created.lobbyId)
  assert.equal(supervisor.sessionCount(), 1)
  assert.equal(healthy.socket.readyState, WebSocket.OPEN)

  await closeSocket(healthy.socket)
  await waitFor(() => supervisor.sessionCount() === 0)
})

interface ProvisionedEndpoint {
  credential: string
  path: string
}

interface CreatedLobbyEndpoint extends ProvisionedEndpoint {
  lobbyId: string
}

interface LobbySummary {
  hostPlayer: string
  id: string
  maxPlayers: number
  phase: 'picking-loadout' | 'hub' | 'session'
  players: number
  protocol: string
}

async function provision(supervisorUrl: string): Promise<ProvisionedEndpoint> {
  const response = await fetch(`${supervisorUrl}/admin/sessions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${ADMIN_SECRET}` },
  })
  assert.equal(response.status, 201)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const value = await response.json() as Record<string, unknown>
  assert.equal(typeof value.credential, 'string')
  assert.equal(typeof value.path, 'string')
  return {
    credential: value.credential as string,
    path: value.path as string,
  }
}

async function createLobby(supervisorUrl: string, hostPlayer: string): Promise<CreatedLobbyEndpoint> {
  const response = await fetch(`${supervisorUrl}/admin/lobbies`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ hostPlayer }),
  })
  assert.equal(response.status, 201)
  const value = await response.json() as Record<string, unknown>
  return {
    credential: value.credential as string,
    lobbyId: value.lobbyId as string,
    path: value.path as string,
  }
}

async function joinLobby(supervisorUrl: string, lobbyId: string): Promise<ProvisionedEndpoint> {
  const response = await fetch(`${supervisorUrl}/admin/lobbies/${lobbyId}/join`, {
    method: 'POST',
    headers: { authorization: `Bearer ${ADMIN_SECRET}` },
  })
  assert.equal(response.status, 200)
  return await response.json() as ProvisionedEndpoint
}

async function listLobbies(supervisorUrl: string): Promise<LobbySummary[]> {
  const response = await fetch(`${supervisorUrl}/admin/lobbies`, {
    headers: { authorization: `Bearer ${ADMIN_SECRET}` },
  })
  assert.equal(response.status, 200)
  const value = await response.json() as { items: LobbySummary[] }
  return value.items
}

async function join(
  supervisorUrl: string,
  endpoint: ProvisionedEndpoint,
  origin: string,
  autoPong = true,
) {
  const socket = await openSocket(websocketUrl(supervisorUrl, endpoint.path), origin, autoPong)
  socket.send(encodeGameMessage({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: endpoint.credential,
    character: CHARACTER,
  }))
  const welcome = await nextMessage(socket, (message) => message.type === 'server-welcome')
  assert.equal(welcome.type, 'server-welcome')
  return { socket, welcome }
}

function websocketUrl(supervisorUrl: string, path: string): string {
  const url = new URL(path, supervisorUrl)
  url.protocol = 'ws:'
  return url.toString()
}

function openSocket(url: string, origin: string, autoPong = true): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { autoPong, origin })
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
    socket.once('unexpected-response', (_request, response) => {
      reject(new Error(`upgrade rejected with ${response.statusCode}`))
    })
  })
}

function closeSocket(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED) return Promise.resolve()
  return new Promise((resolve) => {
    socket.once('close', () => resolve())
    socket.close(1000, 'test complete')
  })
}

function socketClosed(socket: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    socket.once('close', (code, reason) => resolve({
      code,
      reason: reason.toString(),
    }))
  })
}

function nextMessage(
  socket: WebSocket,
  predicate: (message: ServerGameMessage) => boolean,
): Promise<ServerGameMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('timed out waiting for game message'))
    }, 3000)
    const receive = (data: WebSocket.RawData) => {
      const message = decodeServerGameMessage(data.toString())
      if (!predicate(message)) return
      cleanup()
      resolve(message)
    }
    const fail = (error: Error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      clearTimeout(timeout)
      socket.off('message', receive)
      socket.off('error', fail)
    }
    socket.on('message', receive)
    socket.on('error', fail)
  })
}

async function waitFor(predicate: () => boolean | Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 3000
  while (!await predicate()) {
    if (Date.now() >= deadline) throw new Error('timed out waiting for condition')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

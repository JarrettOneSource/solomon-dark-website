import assert from 'node:assert/strict'
import test from 'node:test'

import { WebSocket } from 'ws'

import {
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
  type ServerGameMessage,
} from '../protocol/game-protocol.ts'
import { startGameSessionSupervisor } from './game-session-supervisor.ts'

const ADMIN_SECRET = 'supervisor-test-secret-that-is-long-enough'
const BROWSER_ORIGIN = 'https://solomondarker.com'

test('game session supervisor provisions isolated authenticated Hub sessions', async (context) => {
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
  assert.equal(first.welcome.playerId, 'player-1')
  assert.equal(second.welcome.playerId, 'player-1')

  await assert.rejects(
    () => openSocket(websocketUrl(supervisor.address.url, firstEndpoint.path), 'https://evil.example'),
    /403/,
  )
})

test('game session supervisor enforces capacity and expires unclaimed sessions', async (context) => {
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    maxSessions: 1,
    unclaimedTimeoutMs: 30,
    idleTimeoutMs: 30,
  })
  context.after(() => supervisor.close())

  await provision(supervisor.address.url)
  const full = await fetch(`${supervisor.address.url}/admin/sessions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${ADMIN_SECRET}` },
  })
  assert.equal(full.status, 503)

  await waitFor(() => supervisor.sessionCount() === 0)
  const replacement = await provision(supervisor.address.url)
  assert.match(replacement.path, /^\/game-sessions\/[A-Za-z0-9_-]{32}$/)
})

interface ProvisionedEndpoint {
  credential: string
  path: string
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

async function join(
  supervisorUrl: string,
  endpoint: ProvisionedEndpoint,
  origin: string,
) {
  const socket = await openSocket(websocketUrl(supervisorUrl, endpoint.path), origin)
  socket.send(encodeGameMessage({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: endpoint.credential,
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

function openSocket(url: string, origin: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { origin })
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
    socket.once('unexpected-response', (_request, response) => {
      reject(new Error(`upgrade rejected with ${response.statusCode}`))
    })
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

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 3000
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('timed out waiting for condition')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

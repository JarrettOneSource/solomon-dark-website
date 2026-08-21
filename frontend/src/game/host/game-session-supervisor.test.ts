import assert from 'node:assert/strict'
import test from 'node:test'

import { WebSocket } from 'ws'

import {
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
const EMPTY_CONTENT = { manifestSha256: '0'.repeat(64), mods: [] } as const
const MOD_CONTENT = {
  manifestSha256: '1'.repeat(64),
  mods: [{
    boneyards: [],
    contentSha256: 'a'.repeat(64),
    entryScript: null,
    id: 'tests.shared-content',
    name: 'Shared Content',
    priority: 0,
    slug: 'shared-content',
    version: '1.0.0',
  }],
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
  const invalidAccount = await fetch(`${supervisor.address.url}/admin/sessions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ content: EMPTY_CONTENT, leaderboardUserId: 0 }),
  })
  assert.equal(invalidAccount.status, 400)

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

test('game session supervisor enforces private capacity and expires unclaimed sessions', async (context) => {
  context.mock.method(Date, 'now', () => 1_700_000_000_000)
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
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ content: EMPTY_CONTENT }),
  })
  assert.equal(full.status, 503)

  await waitFor(() => supervisor.sessionCount() === 0)
  const replacement = await provision(supervisor.address.url)
  assert.match(replacement.path, /^\/game-sessions\/[A-Za-z0-9_-]{32}$/)
})

test('game session supervisor admits independent players to one shared Hub and removes lobby routes', async (context) => {
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())

  assert.equal((await fetch(`${supervisor.address.url}/admin/hub/parties`)).status, 401)

  const endpoints = await Promise.all([
    admitHub(supervisor.address.url, MOD_CONTENT, 42),
    admitHub(supervisor.address.url, MOD_CONTENT, 43),
    admitHub(supervisor.address.url, MOD_CONTENT),
  ])
  assert.deepEqual(new Set(endpoints.map(({ path }) => path)), new Set(['/game-hub']))
  assert.equal(new Set(endpoints.map(({ credential }) => credential)).size, 3)

  const [first, second, third] = await Promise.all(endpoints.map((endpoint) => (
    join(supervisor.address.url, endpoint, BROWSER_ORIGIN)
  )))
  context.after(() => closeSocket(first.socket))
  context.after(() => closeSocket(second.socket))
  context.after(() => closeSocket(third.socket))
  assert.equal(new Set([
    first.welcome.playerId,
    second.welcome.playerId,
    third.welcome.playerId,
  ]).size, 3)
  for (const client of [first, second, third]) {
    assert.deepEqual(client.welcome.content, {
      manifestSha256: MOD_CONTENT.manifestSha256,
      mods: [{
        contentSha256: MOD_CONTENT.mods[0].contentSha256,
        id: MOD_CONTENT.mods[0].id,
        version: MOD_CONTENT.mods[0].version,
      }],
    })
  }
  assert.deepEqual(await readPublicParties(supervisor.address.url), [])

  const firstParty = await first.next((message) => (
    message.type === 'server-party-state'
    && message.state.party.memberPlayerIds.length === 1
  ))
  assert.equal(firstParty.type, 'server-party-state')
  const inviteForSecond = second.next((message) => (
    message.type === 'server-party-state' && message.state.invitations.length === 1
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-party-invite',
    targetPlayerId: second.welcome.playerId,
  }))
  const invited = await inviteForSecond
  assert.equal(invited.type, 'server-party-state')
  const deniedForSecond = second.next((message) => (
    message.type === 'server-party-state'
    && message.state.revision > invited.state.revision
    && message.state.invitations.length === 0
    && message.state.party.memberPlayerIds.length === 1
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-party-deny',
    invitationId: invited.state.invitations[0]!.id,
  }))
  await deniedForSecond

  const reinviteForSecond = second.next((message) => (
    message.type === 'server-party-state' && message.state.invitations.length === 1
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-party-invite',
    targetPlayerId: second.welcome.playerId,
  }))
  const reinvited = await reinviteForSecond
  assert.equal(reinvited.type, 'server-party-state')
  const acceptedForFirst = first.next((message) => (
    message.type === 'server-party-state'
    && message.state.party.memberPlayerIds.length === 2
  ))
  const acceptedForSecond = second.next((message) => (
    message.type === 'server-party-state'
    && message.state.party.memberPlayerIds.length === 2
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-party-accept',
    invitationId: reinvited.state.invitations[0]!.id,
  }))
  await Promise.all([acceptedForFirst, acceptedForSecond])

  const hubDirectory = await readPublicParties(supervisor.address.url)
  assert.deepEqual(hubDirectory, [{
    boneyardName: null,
    id: 'party-1',
    leader: CHARACTER.displayName,
    maxMembers: 16,
    memberCount: 2,
    members: [CHARACTER.displayName, CHARACTER.displayName],
    status: 'hub',
  }])
  assert.doesNotMatch(JSON.stringify(hubDirectory), /player-|invitation|credential|manifest/i)

  const firstLoaded = first.next((message) => message.type === 'server-boneyard-loaded')
  const secondLoaded = second.next((message) => message.type === 'server-boneyard-loaded')
  const thirdHub = third.next((message) => (
    message.type === 'server-snapshot' && message.frame.world.kind === 'hub'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const [firstRun, secondRun, thirdFrame] = await Promise.all([
    firstLoaded,
    secondLoaded,
    thirdHub,
  ])
  assert.equal(firstRun.type, 'server-boneyard-loaded')
  assert.equal(secondRun.type, 'server-boneyard-loaded')
  assert.equal(firstRun.boneyard.runId, secondRun.boneyard.runId)
  assert.equal(thirdFrame.type === 'server-snapshot' && thirdFrame.frame.world.kind, 'hub')
  assert.deepEqual(await readPublicParties(supervisor.address.url), [{
    ...hubDirectory[0]!,
    boneyardName: firstRun.type === 'server-boneyard-loaded'
      ? firstRun.boneyard.choice.name
      : null,
    status: 'playing',
  }])

  const health = await readHealth(supervisor.address.url)
  assert.equal(health.hubPlayers, 1)
  assert.equal(health.parties, 2)
  assert.equal(health.runs, 1)
  assert.equal((await fetch(`${supervisor.address.url}/admin/lobbies`, {
    headers: { authorization: `Bearer ${ADMIN_SECRET}` },
  })).status, 404)
})

test('shared Hub refuses a party launch when member mod manifests differ', async (context) => {
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())

  const changedContent = {
    ...MOD_CONTENT,
    manifestSha256: '2'.repeat(64),
    mods: [{ ...MOD_CONTENT.mods[0], contentSha256: 'b'.repeat(64), version: '2.0.0' }],
  } as const
  const first = await join(
    supervisor.address.url,
    await admitHub(supervisor.address.url, MOD_CONTENT),
    BROWSER_ORIGIN,
  )
  const second = await join(
    supervisor.address.url,
    await admitHub(supervisor.address.url, changedContent),
    BROWSER_ORIGIN,
  )
  context.after(() => closeSocket(first.socket))
  context.after(() => closeSocket(second.socket))

  const invitation = second.next((message) => (
    message.type === 'server-party-state' && message.state.invitations.length === 1
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-party-invite',
    targetPlayerId: second.welcome.playerId,
  }))
  const invited = await invitation
  assert.equal(invited.type, 'server-party-state')
  const joined = first.next((message) => (
    message.type === 'server-party-state' && message.state.party.memberPlayerIds.length === 2
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-party-accept',
    invitationId: invited.state.invitations[0]!.id,
  }))
  await joined

  const rejected = first.next((message) => message.type === 'server-disconnect')
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const message = await rejected
  assert.equal(message.type, 'server-disconnect')
  assert.match(message.reason, /same mods/)
})

test('shared Hub admissions are single-use and expire before authentication', async (context) => {
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    snapshotRate: 100,
    unclaimedTimeoutMs: 50,
  })
  context.after(() => supervisor.close())

  const admission = await admitHub(supervisor.address.url)
  const accepted = await join(supervisor.address.url, admission, BROWSER_ORIGIN)
  await closeSocket(accepted.socket)

  const replay = await openSocket(
    websocketUrl(supervisor.address.url, admission.path),
    BROWSER_ORIGIN,
  )
  const replayMessages = messageQueue(replay)
  replay.send(encodeGameMessage({
    type: 'client-hello',
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: admission.credential,
    character: CHARACTER,
  }))
  const replayDenied = await replayMessages((message) => message.type === 'server-disconnect')
  assert.equal(replayDenied.type, 'server-disconnect')
  assert.equal(replayDenied.code, 'authentication-failed')

  const expired = await admitHub(supervisor.address.url)
  await new Promise((resolve) => setTimeout(resolve, 75))
  const late = await openSocket(websocketUrl(supervisor.address.url, expired.path), BROWSER_ORIGIN)
  const lateMessages = messageQueue(late)
  late.send(encodeGameMessage({
    type: 'client-hello',
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: expired.credential,
    character: CHARACTER,
  }))
  const expiredDenied = await lateMessages((message) => message.type === 'server-disconnect')
  assert.equal(expiredDenied.type, 'server-disconnect')
  assert.equal(expiredDenied.code, 'authentication-failed')
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

test('shared Hub drops only the player that misses its transport heartbeat', async (context) => {
  const logs: GameServerLogEntry[] = []
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    heartbeatIntervalMs: 50,
    log: (entry) => logs.push(entry),
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())

  const healthy = await join(
    supervisor.address.url,
    await admitHub(supervisor.address.url),
    BROWSER_ORIGIN,
  )
  context.after(() => closeSocket(healthy.socket))
  const unresponsive = await join(
    supervisor.address.url,
    await admitHub(supervisor.address.url),
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

  await waitFor(async () => (await readHealth(supervisor.address.url)).hubPlayers === 1)
  assert.deepEqual(await closed, { code: 4000, reason: 'connection timed out' })
  const timeout = logs.find((entry) => entry.event === 'proxy.heartbeat_timeout')
  assert.equal(timeout?.level, 'warning')
  assert.equal(timeout?.details?.sessionId, 'shared-hub')
  assert.equal(supervisor.sessionCount(), 1)
  assert.equal(healthy.socket.readyState, WebSocket.OPEN)

  await closeSocket(healthy.socket)
  await waitFor(() => supervisor.sessionCount() === 0)
})

interface ProvisionedEndpoint {
  credential: string
  path: string
}

interface SupervisorHealth {
  hubPlayers: number
  parties: number
  players: number
  privateSessions: number
  protocol: string
  runs: number
  sessions: number
  status: string
}

interface PublicPartyDirectoryEntry {
  boneyardName: string | null
  id: string
  leader: string
  maxMembers: number
  memberCount: number
  members: string[]
  status: 'hub' | 'playing'
}

async function readPublicParties(supervisorUrl: string): Promise<PublicPartyDirectoryEntry[]> {
  const response = await fetch(`${supervisorUrl}/admin/hub/parties`, {
    headers: { authorization: `Bearer ${ADMIN_SECRET}` },
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const value = await response.json() as { items?: PublicPartyDirectoryEntry[] }
  assert.ok(Array.isArray(value.items))
  return value.items
}

async function provision(supervisorUrl: string): Promise<ProvisionedEndpoint> {
  const response = await fetch(`${supervisorUrl}/admin/sessions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ content: EMPTY_CONTENT, leaderboardUserId: 42 }),
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

async function admitHub(
  supervisorUrl: string,
  content: typeof EMPTY_CONTENT | typeof MOD_CONTENT = EMPTY_CONTENT,
  leaderboardUserId: number | null = null,
): Promise<ProvisionedEndpoint> {
  const response = await fetch(`${supervisorUrl}/admin/hub/tickets`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ content, leaderboardUserId }),
  })
  assert.equal(response.status, 201)
  const value = await response.json() as Record<string, unknown>
  return {
    credential: value.credential as string,
    path: value.path as string,
  }
}

async function readHealth(supervisorUrl: string): Promise<SupervisorHealth> {
  const response = await fetch(`${supervisorUrl}/health`)
  assert.equal(response.status, 200)
  return await response.json() as SupervisorHealth
}

async function join(
  supervisorUrl: string,
  endpoint: ProvisionedEndpoint,
  origin: string,
  autoPong = true,
) {
  const socket = await openSocket(websocketUrl(supervisorUrl, endpoint.path), origin, autoPong)
  const next = messageQueue(socket)
  socket.send(encodeGameMessage({
    type: 'client-hello',
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: endpoint.credential,
    character: CHARACTER,
  }))
  const welcome = await next((message) => message.type === 'server-welcome')
  assert.equal(welcome.type, 'server-welcome')
  return { next, socket, welcome }
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

function messageQueue(socket: WebSocket) {
  const buffered: ServerGameMessage[] = []
  const waiters: Array<{
    predicate: (message: ServerGameMessage) => boolean
    reject: (error: Error) => void
    resolve: (message: ServerGameMessage) => void
    timeout: ReturnType<typeof setTimeout>
  }> = []
  socket.on('message', (data) => {
    const message = decodeServerGameMessage(data.toString())
    const waiterIndex = waiters.findIndex(({ predicate }) => predicate(message))
    if (waiterIndex < 0) {
      buffered.push(message)
      return
    }
    const [waiter] = waiters.splice(waiterIndex, 1)
    clearTimeout(waiter!.timeout)
    waiter!.resolve(message)
  })
  socket.on('error', (error) => {
    for (const waiter of waiters.splice(0)) {
      clearTimeout(waiter.timeout)
      waiter.reject(error)
    }
  })
  return (predicate: (message: ServerGameMessage) => boolean): Promise<ServerGameMessage> => {
    const bufferedIndex = buffered.findIndex(predicate)
    if (bufferedIndex >= 0) return Promise.resolve(buffered.splice(bufferedIndex, 1)[0]!)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = waiters.findIndex((waiter) => waiter.resolve === resolve)
        if (index >= 0) waiters.splice(index, 1)
        reject(new Error('timed out waiting for game message'))
      }, 3000)
      waiters.push({ predicate, reject, resolve, timeout })
    })
  }
}

async function waitFor(predicate: () => boolean | Promise<boolean>): Promise<void> {
  const deadline = performance.now() + 10_000
  while (!await predicate()) {
    if (performance.now() >= deadline) throw new Error('timed out waiting for condition')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

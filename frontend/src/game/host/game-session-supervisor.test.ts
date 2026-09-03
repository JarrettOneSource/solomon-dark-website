import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'

import { WebSocket } from 'ws'

import {
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
  type ServerGameMessage,
} from '../protocol/game-protocol.ts'
import {
  createGameSimulation,
  enterBoneyardWorld,
} from '../core-server/game-simulation.ts'
import type { PlayerCharacterConfig } from '../core-kernels/player-character.ts'
import { createGameSaveDocument } from '../save/game-save-document.ts'
import { materializeStockTutorial } from './boneyard-catalog.ts'
import type { GameServerLogEntry } from './game-server-logger.ts'
import { verifyPartyRecoveryClaim } from './party-recovery-claim.ts'
import {
  createRuntimeEventPublisher,
  type RuntimeEventEntry,
} from './runtime-event-publisher.ts'
import { startGameSessionSupervisor } from './game-session-supervisor.ts'
import type { HostPresenceEntry } from './host-presence.ts'

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
    files: [],
    id: 'tests.shared-content',
    name: 'Shared Content',
    priority: 0,
    slug: 'shared-content',
    version: '1.0.0',
  }],
} as const

test('runtime event publisher retries and posts bounded activity to the loopback outbox', async (context) => {
  const requests: Array<{ authorization: string; body: Record<string, unknown> }> = []
  let attempts = 0
  const receiver = createServer(async (request, response) => {
    attempts += 1
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    requests.push({
      authorization: request.headers.authorization ?? '',
      body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
    })
    response.writeHead(attempts === 1 ? 503 : 202)
    response.end()
  })
  await new Promise<void>((resolve, reject) => {
    receiver.once('error', reject)
    receiver.listen(0, '127.0.0.1', resolve)
  })
  context.after(() => new Promise<void>((resolve, reject) => {
    receiver.close(error => error ? reject(error) : resolve())
  }))
  const address = receiver.address()
  if (!address || typeof address === 'string') throw new Error('receiver did not bind')
  const secret = 'runtime-event-test-secret-that-is-long-enough'
  const publisher = createRuntimeEventPublisher(
    `http://127.0.0.1:${address.port}/api/internal/runtime-events`,
    secret,
  )
  publisher.publish({
    component: 'game-host',
    details: { playerCount: 1, runId: 'run-1' },
    event: 'run.started',
    message: 'A party started a Boneyard run.',
    occurredAtUtc: '2026-08-23T12:00:00.000Z',
  })
  await waitFor(() => requests.length === 2)
  await publisher.close()

  assert.equal(requests[1]?.authorization, `Bearer ${secret}`)
  assert.deepEqual(requests[1]?.body, {
    component: 'game-host',
    event: 'run.started',
    message: 'A party started a Boneyard run.',
    occurredAtUtc: '2026-08-23T12:00:00.000Z',
    details: { playerCount: 1, runId: 'run-1' },
  })
  assert.throws(
    () => createRuntimeEventPublisher('https://example.com/events', secret),
    /loopback HTTP/,
  )
})

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

  assert.deepEqual(await readPresence(supervisor.address.url), [1, 2].map(() => ({
    accountUsername: null,
    activity: 'hub',
    boneyardName: null,
    bot: false,
    developer: false,
    displayName: CHARACTER.displayName,
    partyLeader: null,
    partySize: null,
    session: 'private-college',
    waveNumber: null,
  })))

  await assert.rejects(
    () => openSocket(websocketUrl(supervisor.address.url, firstEndpoint.path), 'https://evil.example'),
    /403/,
  )
})

test('private Colleges opt into discovery and share live social routing with host content policy', async (context) => {
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())

  const modded = await join(
    supervisor.address.url,
    await provision(supervisor.address.url, MOD_CONTENT),
    BROWSER_ORIGIN,
    true,
    {
      character: { ...CHARACTER, displayName: 'Mod Host' },
      cheatsEnabled: true,
    },
  )
  const remote = await join(
    supervisor.address.url,
    await provision(supervisor.address.url),
    BROWSER_ORIGIN,
    true,
    { character: { ...CHARACTER, displayName: 'Remote Guest' } },
  )
  const hub = await join(
    supervisor.address.url,
    await admitHub(supervisor.address.url),
    BROWSER_ORIGIN,
    true,
    { character: { ...CHARACTER, displayName: 'Hub Guest' } },
  )
  context.after(() => closeSocket(modded.socket))
  context.after(() => closeSocket(remote.socket))
  context.after(() => closeSocket(hub.socket))
  assert.equal(modded.welcome.cheatsEnabled, true)
  assert.equal(remote.welcome.cheatsEnabled, false)

  const remoteGlobal = remote.next(message => (
    message.type === 'server-chat' && message.text === 'Hello from mods'
  ))
  const hubGlobal = hub.next(message => (
    message.type === 'server-chat' && message.text === 'Hello from mods'
  ))
  modded.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'global',
    text: 'Hello from mods',
  }))
  const [atRemote, atHub] = await Promise.all([remoteGlobal, hubGlobal])
  assert.equal(atRemote.type, 'server-chat')
  assert.equal(atHub.type, 'server-chat')
  assert.equal(atRemote.sender.displayName, 'Mod Host')
  assert.match(atRemote.sender.playerReference, /^player-ref-[A-Za-z0-9_-]{32}$/)
  assert.equal(atRemote.sender.playerId, atRemote.sender.playerReference)

  const moddedGlobal = modded.next(message => (
    message.type === 'server-chat' && message.text === 'Hello from elsewhere'
  ))
  remote.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'global',
    text: 'Hello from elsewhere',
  }))
  const remoteIdentity = await moddedGlobal
  assert.equal(remoteIdentity.type, 'server-chat')
  assert.equal(remoteIdentity.sender.displayName, 'Remote Guest')
  assert.equal(remoteIdentity.sender.playerId, remoteIdentity.sender.playerReference)
  assert.notEqual(remoteIdentity.sender.playerId, modded.welcome.playerId)

  const card = modded.next(message => (
    message.type === 'server-player-card' && message.requestId === 7
  ))
  modded.socket.send(encodeGameMessage({
    type: 'client-player-card-request',
    playerReference: remoteIdentity.sender.playerReference,
    requestId: 7,
  }))
  const resolvedCard = await card
  assert.equal(resolvedCard.type, 'server-player-card')
  assert.equal(resolvedCard.profile?.displayName, 'Remote Guest')
  assert.equal(resolvedCard.profile?.sessionKind, 'private-college')

  const whisperedToRemote = remote.next(message => (
    message.type === 'server-chat' && message.text === 'Private cross-host note'
  ))
  const whisperedToSender = modded.next(message => (
    message.type === 'server-chat' && message.text === 'Private cross-host note'
  ))
  modded.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'whisper',
    targetPlayerReference: remoteIdentity.sender.playerReference,
    text: 'Private cross-host note',
  }))
  const [remoteWhisper, senderWhisper] = await Promise.all([
    whisperedToRemote,
    whisperedToSender,
  ])
  assert.equal(remoteWhisper.type, 'server-chat')
  assert.equal(senderWhisper.type, 'server-chat')
  assert.equal(remoteWhisper.channel, 'whisper')
  assert.equal(remoteWhisper.recipient?.playerId, remote.welcome.playerId)
  assert.equal(senderWhisper.recipient?.playerReference, remoteIdentity.sender.playerReference)

  const listedState = await modded.next(message => (
    message.type === 'server-party-state' && message.state.party.visibility === 'public'
  ))
  assert.equal(listedState.type, 'server-party-state')
  const directory = await readPublicParties(supervisor.address.url)
  const listed = directory.find(({ id }) => id === listedState.state.party.listingId)
  assert.deepEqual(listed, {
    boneyardName: null,
    cheatsEnabled: true,
    id: listedState.state.party.listingId,
    leader: 'Mod Host',
    maxMembers: 16,
    memberCount: 1,
    members: ['Mod Host'],
    modCount: 1,
    sessionKind: 'private-college',
    status: 'hub',
    visibility: 'public',
  })
  assert.doesNotMatch(JSON.stringify(listed), /joinCode|credential|manifestSha256/)

  const invitationAtTarget = remote.next(message => (
    message.type === 'server-college-invitations' && message.invitations.length === 1
  ))
  const invitationResult = modded.next(message => (
    message.type === 'server-party-action' && message.action === 'invite-college'
  ))
  modded.socket.send(encodeGameMessage({
    type: 'client-college-invite',
    playerReference: remoteIdentity.sender.playerReference,
  }))
  const [invitations, inviteAction] = await Promise.all([
    invitationAtTarget,
    invitationResult,
  ])
  assert.equal(invitations.type, 'server-college-invitations')
  assert.equal(inviteAction.type, 'server-party-action')
  assert.equal(inviteAction.ok, true)
  const invitation = invitations.invitations[0]!
  assert.equal(invitation.inviter.displayName, 'Mod Host')

  const resolution = await resolveJoinCode(supervisor.address.url, invitation.joinCode)
  assert.equal(resolution.target.cheatsEnabled, true)
  assert.deepEqual(
    (resolution.target.content as { manifestSha256: string }).manifestSha256,
    MOD_CONTENT.manifestSha256,
  )
  const joined = await join(
    supervisor.address.url,
    await admitJoin(supervisor.address.url, resolution.intentId, 99),
    BROWSER_ORIGIN,
    true,
    { character: { ...CHARACTER, displayName: 'Transferred Guest' } },
  )
  context.after(() => closeSocket(joined.socket))
  assert.equal(joined.welcome.cheatsEnabled, true)
  assert.equal(joined.welcome.content.manifestSha256, MOD_CONTENT.manifestSha256)

  const hostLoaded = modded.next(message => message.type === 'server-boneyard-loaded')
  const joinedLoaded = joined.next(message => message.type === 'server-boneyard-loaded')
  modded.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const [hostRun, joinedRun] = await Promise.all([hostLoaded, joinedLoaded])
  assert.equal(hostRun.type, 'server-boneyard-loaded')
  assert.equal(joinedRun.type, 'server-boneyard-loaded')
  const runGlobal = remote.next(message => (
    message.type === 'server-chat' && message.text === 'Global from a modded Boneyard'
  ))
  modded.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'global',
    text: 'Global from a modded Boneyard',
  }))
  assert.equal((await runGlobal).type, 'server-chat')
  const playing = (await readPublicParties(supervisor.address.url)).find(
    ({ id }) => id === listedState.state.party.listingId,
  )
  assert.equal(playing?.status, 'playing')
  assert.equal(playing?.boneyardName, hostRun.boneyard.choice.name)
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
  const runtimeEvents: RuntimeEventEntry[] = []
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    runtimeEvents: entry => runtimeEvents.push(entry),
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())

  assert.equal((await fetch(`${supervisor.address.url}/admin/hub/parties`)).status, 401)
  assert.equal((await fetch(`${supervisor.address.url}/admin/presence`)).status, 401)

  const endpoints = await Promise.all([
    admitHub(supervisor.address.url, EMPTY_CONTENT, 42),
    admitHub(supervisor.address.url, EMPTY_CONTENT, 43),
    admitHub(supervisor.address.url, EMPTY_CONTENT),
  ])
  assert.deepEqual(new Set(endpoints.map(({ path }) => path)), new Set(['/game-hub']))
  assert.equal(new Set(endpoints.map(({ credential }) => credential)).size, 3)

  const [first, joinedSecond, third] = await Promise.all(endpoints.map((endpoint) => (
    join(supervisor.address.url, endpoint, BROWSER_ORIGIN)
  )))
  let second = joinedSecond
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
      manifestSha256: EMPTY_CONTENT.manifestSha256,
      mods: [],
    })
  }
  const defaultDirectory = await readPublicParties(supervisor.address.url)
  assert.equal(defaultDirectory.length, 3)
  assert.equal(new Set(defaultDirectory.map(({ id }) => id)).size, 3)
  assert.ok(defaultDirectory.every(party => (
    party.boneyardName === null
    && party.cheatsEnabled === false
    && party.leader === CHARACTER.displayName
    && party.maxMembers === 16
    && party.memberCount === 1
    && party.members.length === 1
    && party.members[0] === CHARACTER.displayName
    && party.modCount === 0
    && party.sessionKind === 'global-hub'
    && party.status === 'hub'
    && party.visibility === 'public'
  )))
  assert.deepEqual(await readPresence(supervisor.address.url), [1, 2, 3].map(() => ({
    accountUsername: null,
    activity: 'hub',
    boneyardName: null,
    bot: false,
    developer: false,
    displayName: CHARACTER.displayName,
    partyLeader: null,
    partySize: null,
    session: 'global-hub',
    waveNumber: null,
  })))

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
  const [acceptedFirstState, acceptedSecondState] = await Promise.all([
    acceptedForFirst,
    acceptedForSecond,
  ])
  assert.equal(acceptedFirstState.type, 'server-party-state')
  assert.equal(acceptedSecondState.type, 'server-party-state')
  const mergedPartyId = acceptedFirstState.state.party.id
  assert.equal(acceptedSecondState.state.party.id, mergedPartyId)

  const nonLeaderInvite = second.next(message => (
    message.type === 'server-party-action' && message.action === 'invite'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-party-invite',
    targetPlayerId: third.welcome.playerId,
  }))
  const nonLeaderRejection = await nonLeaderInvite
  assert.equal(nonLeaderRejection.type, 'server-party-action')
  assert.equal(nonLeaderRejection.ok, false)
  assert.equal(nonLeaderRejection.reason, 'not-leader')

  const listedParty = acceptedFirstState

  const hubDirectory = await readPublicParties(supervisor.address.url)
  assert.equal(hubDirectory.length, 2)
  const groupedDirectoryParty = hubDirectory.find(
    ({ id }) => id === listedParty.state.party.listingId,
  )
  assert.ok(groupedDirectoryParty)
  assert.deepEqual(groupedDirectoryParty, {
    boneyardName: null,
    cheatsEnabled: false,
    id: listedParty.state.party.listingId,
    leader: CHARACTER.displayName,
    maxMembers: 16,
    memberCount: 2,
    members: [CHARACTER.displayName, CHARACTER.displayName],
    modCount: 0,
    sessionKind: 'global-hub',
    status: 'hub',
    visibility: 'public',
  })
  const singletonDirectoryParty = hubDirectory.find(
    ({ id }) => id !== listedParty.state.party.listingId,
  )
  assert.ok(singletonDirectoryParty)
  assert.deepEqual(singletonDirectoryParty, {
    boneyardName: null,
    cheatsEnabled: false,
    id: singletonDirectoryParty.id,
    leader: CHARACTER.displayName,
    maxMembers: 16,
    memberCount: 1,
    members: [CHARACTER.displayName],
    modCount: 0,
    sessionKind: 'global-hub',
    status: 'hub',
    visibility: 'public',
  })
  assert.doesNotMatch(JSON.stringify(hubDirectory), /player-|invitation|credential|manifest/i)

  const stalePublicIntent = await resolvePublicParty(
    supervisor.address.url,
    listedParty.state.party.listingId,
  )
  const inviteOnlyAgain = first.next(message => (
    message.type === 'server-party-state'
    && message.state.party.visibility === 'invite-only'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-party-settings',
    visibility: 'invite-only',
  }))
  await inviteOnlyAgain
  const staleAdmission = await requestJoinAdmission(
    supervisor.address.url,
    stalePublicIntent.intentId,
    null,
  )
  assert.equal(staleAdmission.status, 409)
  assert.match(JSON.stringify(await staleAdmission.json()), /requires a join request/i)
  const publicAgain = first.next(message => (
    message.type === 'server-party-state' && message.state.party.visibility === 'public'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-party-settings',
    visibility: 'public',
  }))
  await publicAgain

  const firstLoaded = first.next((message) => message.type === 'server-boneyard-loaded')
  const secondLoaded = second.next((message) => message.type === 'server-boneyard-loaded')
  const secondRunSave = second.next(message => (
    message.type === 'server-save-checkpoint'
    && JSON.parse(message.save).continuation.summary.partyRejoinToken !== null
  ))
  const thirdHub = third.next((message) => (
    message.type === 'server-snapshot' && message.frame.world.kind === 'hub'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const [firstRun, secondRun, thirdFrame, secondCheckpoint] = await Promise.all([
    firstLoaded,
    secondLoaded,
    thirdHub,
    secondRunSave,
  ])
  assert.equal(firstRun.type, 'server-boneyard-loaded')
  assert.equal(secondRun.type, 'server-boneyard-loaded')
  assert.equal(firstRun.boneyard.runId, secondRun.boneyard.runId)
  assert.equal(thirdFrame.type === 'server-snapshot' && thirdFrame.frame.world.kind, 'hub')
  assert.equal(secondCheckpoint.type, 'server-save-checkpoint')
  const rejoinToken = JSON.parse(secondCheckpoint.save)
    .continuation.summary.partyRejoinToken as string
  const secondPlayerId = second.welcome.playerId
  await closeSocket(second.socket)
  await waitFor(() => runtimeEvents.some(entry => (
    entry.event === 'player.disconnected'
    && entry.details?.playerId === secondPlayerId
  )))
  let rejoinResponse: Response | null = null
  await waitFor(async () => {
    const candidate = await fetch(`${supervisor.address.url}/admin/rejoin`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ADMIN_SECRET}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        content: EMPTY_CONTENT,
        developerAccess: false,
        leaderboardUserId: 43,
        save: secondCheckpoint.save,
        token: rejoinToken,
      }),
    })
    if (candidate.status === 201) {
      rejoinResponse = candidate
      return true
    }
    assert.equal(candidate.status, 409, await candidate.text())
    return false
  })
  assert.ok(rejoinResponse)
  assert.equal(rejoinResponse.status, 201, await rejoinResponse.clone().text())
  const rejoinEndpoint = await rejoinResponse.json() as ProvisionedEndpoint
  second = await joinSaved(
    supervisor.address.url,
    rejoinEndpoint,
    BROWSER_ORIGIN,
    secondCheckpoint.save,
  )
  assert.equal(second.welcome.playerId, secondPlayerId)
  assert.equal(second.welcome.snapshot.world.kind, 'boneyard')
  if (second.welcome.snapshot.world.kind !== 'boneyard') assert.fail('expected Boneyard')
  assert.equal(second.welcome.snapshot.world.runId, firstRun.boneyard.runId)
  assert.equal((await fetch(`${supervisor.address.url}/admin/rejoin`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      content: EMPTY_CONTENT,
      developerAccess: false,
      leaderboardUserId: 43,
      save: secondCheckpoint.save,
      token: rejoinToken,
    }),
  })).status, 409)
  const runDirectory = await readPublicParties(supervisor.address.url)
  assert.equal(runDirectory.length, 2)
  assert.deepEqual(runDirectory.find(({ id }) => id === groupedDirectoryParty.id), {
    ...groupedDirectoryParty,
    boneyardName: firstRun.type === 'server-boneyard-loaded'
      ? firstRun.boneyard.choice.name
      : null,
    status: 'playing',
  })
  assert.deepEqual(
    runDirectory.find(({ id }) => id === singletonDirectoryParty.id),
    singletonDirectoryParty,
  )
  const runPresence = await readPresence(supervisor.address.url)
  const presenceInRun = runPresence.filter(player => player.activity === 'boneyard')
  const presenceInHub = runPresence.filter(player => player.activity === 'hub')
  assert.equal(presenceInRun.length, 2)
  assert.equal(presenceInHub.length, 1)
  for (const player of presenceInRun) {
    assert.equal(player.session, 'global-hub')
    assert.equal(player.displayName, CHARACTER.displayName)
    assert.equal(
      player.boneyardName,
      firstRun.type === 'server-boneyard-loaded' ? firstRun.boneyard.choice.name : null,
    )
    assert.ok(typeof player.waveNumber === 'number' && player.waveNumber >= 0)
    assert.equal(player.partyLeader, CHARACTER.displayName)
    assert.equal(player.partySize, 2)
  }
  assert.equal(presenceInHub[0]!.partyLeader, null)
  assert.equal(presenceInHub[0]!.waveNumber, null)
  assert.equal(presenceInHub[0]!.boneyardName, null)
  assert.doesNotMatch(JSON.stringify(runPresence), /player-|credential|joinCode|listing/i)
  const playingJoin = await fetch(`${supervisor.address.url}/admin/join/public`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ listingId: listedParty.state.party.listingId }),
  })
  assert.equal(playingJoin.status, 409)
  assert.match(JSON.stringify(await playingJoin.json()), /Boneyard/i)

  const health = await readHealth(supervisor.address.url)
  assert.equal(health.hubPlayers, 1)
  assert.equal(health.parties, 2)
  assert.equal(health.runs, 1)
  await waitFor(() => runtimeEvents.some(entry => entry.event === 'run.started'))
  assert.equal(runtimeEvents.filter(entry => entry.event === 'party.invitation_sent').length, 2)
  assert.equal(runtimeEvents.filter(entry => entry.event === 'party.invitation_denied').length, 1)
  assert.equal(runtimeEvents.filter(entry => entry.event === 'party.invitation_accepted').length, 1)
  const acceptedInvitation = runtimeEvents.find(
    entry => entry.event === 'party.invitation_accepted',
  )
  assert.deepEqual(acceptedInvitation?.details?.invited, {
    accountUsername: null,
    displayName: CHARACTER.displayName,
    playerId: second.welcome.playerId,
  })
  const runStarted = runtimeEvents.find(entry => entry.event === 'run.started')
  assert.equal(runStarted?.details?.partyId, mergedPartyId)
  assert.equal(runStarted?.details?.boneyardName, firstRun.boneyard.choice.name)
  assert.equal(runStarted?.details?.playerCount, 2)
  assert.equal((await fetch(`${supervisor.address.url}/admin/lobbies`, {
    headers: { authorization: `Bearer ${ADMIN_SECRET}` },
  })).status, 404)

  const targetRevision = 'c'.repeat(40)
  const restartMessages = [first, second, third].map(client => client.next(
    message => message.type === 'server-deployment-restart',
  ))
  const restartResponse = fetch(`${supervisor.address.url}/admin/deployments/restart`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ targetRevision }),
  })
  for (const [client, restartPromise] of [first, second, third].map(
    (client, index) => [client, restartMessages[index]!] as const,
  )) {
    const restart = await restartPromise
    assert.equal(restart.type, 'server-deployment-restart')
    const checkpoint = await client.next(message => (
      message.type === 'server-save-checkpoint'
      && message.sequence === restart.checkpointSequence
    ))
    assert.equal(checkpoint.type, 'server-save-checkpoint')
    assert.equal(
      (JSON.parse(checkpoint.save) as {
        continuation: { summary: { playerId: string } }
      }).continuation.summary.playerId,
      client.welcome.playerId,
    )
    client.socket.send(encodeGameMessage({
      type: 'client-deployment-ready',
      checkpointSequence: restart.checkpointSequence,
      targetRevision,
    }))
  }
  const deployed = await restartResponse
  assert.equal(deployed.status, 200)
  assert.deepEqual(await deployed.json(), {
    status: 'ready',
    players: 3,
    savedPlayers: 3,
    targetRevision,
    unacknowledgedPlayers: 0,
  })
})

test('shared Hub refuses a modded admission before it creates party membership', async (context) => {
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())

  const endpoint = await admitHub(supervisor.address.url, MOD_CONTENT)
  const socket = await openSocket(
    websocketUrl(supervisor.address.url, endpoint.path),
    BROWSER_ORIGIN,
  )
  context.after(() => closeSocket(socket))
  const next = messageQueue(socket)
  socket.send(encodeGameMessage({
    type: 'client-hello',
    onlinePreferences: { activityMessages: true, globalChat: true, submitRuns: true },
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: endpoint.credential,
    character: CHARACTER,
  }))
  const message = await next(candidate => candidate.type === 'server-disconnect')
  assert.equal(message.type, 'server-disconnect')
  assert.match(message.reason, /Mods require/)
  assert.equal((await readHealth(supervisor.address.url)).parties, 0)
})

test('developer observer admission reaches a private active match without changing occupancy', async (context) => {
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())
  assert.equal((await fetch(`${supervisor.address.url}/admin/matches`)).status, 401)
  assert.equal((await fetch(`${supervisor.address.url}/admin/observers`, { method: 'POST' })).status, 401)

  const firstEndpoint = await admitHub(supervisor.address.url, EMPTY_CONTENT, 42)
  const secondEndpoint = await admitHub(supervisor.address.url, EMPTY_CONTENT, 43)
  const first = await join(supervisor.address.url, firstEndpoint, BROWSER_ORIGIN)
  const second = await join(supervisor.address.url, secondEndpoint, BROWSER_ORIGIN)
  context.after(() => closeSocket(first.socket))
  context.after(() => closeSocket(second.socket))
  const invited = second.next(message => (
    message.type === 'server-party-state' && message.state.invitations.length === 1
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-party-invite',
    targetPlayerId: second.welcome.playerId,
  }))
  const invitation = await invited
  if (invitation.type !== 'server-party-state') throw new Error('expected invitation')
  const grouped = first.next(message => (
    message.type === 'server-party-state' && message.state.party.memberPlayerIds.length === 2
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-party-accept',
    invitationId: invitation.state.invitations[0]!.id,
  }))
  await grouped
  const loaded = first.next(message => message.type === 'server-boneyard-loaded')
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const boneyard = await loaded
  if (boneyard.type !== 'server-boneyard-loaded') throw new Error('expected Boneyard')

  const matchesResponse = await fetch(`${supervisor.address.url}/admin/matches`, {
    headers: { authorization: `Bearer ${ADMIN_SECRET}` },
  })
  assert.equal(matchesResponse.status, 200)
  const directory = await matchesResponse.json() as {
    items: Array<{
      id: string
      playerCount: number
      session: string
      visibility: string
    }>
  }
  assert.equal(directory.items.length, 1)
  assert.equal(directory.items[0]?.visibility, 'public')
  assert.equal(directory.items[0]?.playerCount, 2)

  const observerResponse = await fetch(`${supervisor.address.url}/admin/observers`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      matchId: directory.items[0]!.id,
      observer: { userId: 7, username: 'developer' },
    }),
  })
  assert.equal(observerResponse.status, 201)
  const observerEndpoint = await observerResponse.json() as {
    credential: string
    path: string
    sessionKind: string
  }
  assert.equal(observerEndpoint.sessionKind, 'global-hub')
  const observerSocket = await openSocket(
    websocketUrl(supervisor.address.url, observerEndpoint.path),
    BROWSER_ORIGIN,
  )
  context.after(() => closeSocket(observerSocket))
  const observerNext = messageQueue(observerSocket)
  const welcomed = observerNext(message => message.type === 'server-welcome')
  observerSocket.send(encodeGameMessage({
    type: 'client-observer-hello',
    credential: observerEndpoint.credential,
    protocolVersion: GAME_PROTOCOL_VERSION,
  }))
  const observerWelcome = await welcomed
  assert.equal(observerWelcome.type, 'server-welcome')
  assert.equal(observerWelcome.observer, true)
  assert.equal(Object.keys(observerWelcome.snapshot.players).length, 2)
  const health = await readHealth(supervisor.address.url)
  assert.equal(health.players, 2)
  assert.equal(health.hubHumanPlayers, 2)
})

test('party admission cannot overbook global Hub capacity across singleton parties', async (context) => {
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    maxConnectionsPerSession: 2,
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())
  const leader = await join(
    supervisor.address.url,
    await admitHub(supervisor.address.url),
    BROWSER_ORIGIN,
  )
  const other = await join(
    supervisor.address.url,
    await admitHub(supervisor.address.url),
    BROWSER_ORIGIN,
  )
  context.after(() => closeSocket(leader.socket))
  context.after(() => closeSocket(other.socket))
  const party = await leader.next(message => (
    message.type === 'server-party-state' && message.state.party.visibility === 'public'
  ))
  assert.equal(party.type, 'server-party-state')
  const resolved = await resolvePublicParty(
    supervisor.address.url,
    party.state.party.listingId,
  )
  const overbooked = await requestJoinAdmission(supervisor.address.url, resolved.intentId, null)
  assert.equal(overbooked.status, 409)
  assert.match(JSON.stringify(await overbooked.json()), /full/i)
})

test('invite-only directory accepts a guest request and mints admission after leader approval', async (context) => {
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())
  const leader = await join(
    supervisor.address.url,
    await admitHub(supervisor.address.url, EMPTY_CONTENT, 42),
    BROWSER_ORIGIN,
  )
  context.after(() => closeSocket(leader.socket))
  const initial = await leader.next(message => message.type === 'server-party-state')
  assert.equal(initial.type, 'server-party-state')
  const visible = leader.next(message => (
    message.type === 'server-party-state'
    && message.state.party.visibility === 'invite-only'
  ))
  leader.socket.send(encodeGameMessage({
    type: 'client-party-settings',
    visibility: 'invite-only',
  }))
  const listed = await visible
  assert.equal(listed.type, 'server-party-state')

  const pendingForLeader = leader.next(message => (
    message.type === 'server-party-state' && message.state.joinRequests.length === 1
  ))
  const requestToken = await requestJoin(
    supervisor.address.url,
    listed.state.party.listingId,
  )
  const pending = await pendingForLeader
  assert.equal(pending.type, 'server-party-state')
  assert.equal(pending.state.joinRequests[0]?.requester.displayName, 'Guest Cassia')
  leader.socket.send(encodeGameMessage({
    type: 'client-party-request-accept',
    requestId: pending.state.joinRequests[0]!.id,
  }))
  const approved = await pollJoinRequest(supervisor.address.url, requestToken)
  assert.equal(approved.status, 'accepted')
  assert.equal(typeof approved.intentId, 'string')
  const joinedParty = leader.next(message => (
    message.type === 'server-party-state'
    && message.state.party.memberPlayerIds.length === 2
  ))
  const guestEndpoint = await admitJoin(supervisor.address.url, approved.intentId!, null)
  const consumedRequest = await fetch(
    `${supervisor.address.url}/admin/join/requests/${requestToken}`,
    { headers: { authorization: `Bearer ${ADMIN_SECRET}` } },
  )
  assert.equal(consumedRequest.status, 404)
  const guest = await join(supervisor.address.url, guestEndpoint, BROWSER_ORIGIN)
  context.after(() => closeSocket(guest.socket))
  assert.equal((await joinedParty).type, 'server-party-state')
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
    onlinePreferences: { activityMessages: true, globalChat: true, submitRuns: true },
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
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
    onlinePreferences: { activityMessages: true, globalChat: true, submitRuns: true },
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
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

test('deployment restart drains admissions, waits for the final save, and closes with update copy', async (context) => {
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())
  const client = await join(
    supervisor.address.url,
    await admitHub(supervisor.address.url),
    BROWSER_ORIGIN,
  )
  const targetRevision = 'a'.repeat(40)
  const closed = socketClosed(client.socket)
  const responsePromise = fetch(`${supervisor.address.url}/admin/deployments/restart`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ targetRevision }),
  })
  const restart = await client.next(message => message.type === 'server-deployment-restart')
  assert.equal(restart.type, 'server-deployment-restart')
  const checkpoint = await client.next(message => (
    message.type === 'server-save-checkpoint'
    && message.sequence === restart.checkpointSequence
  ))
  assert.equal(checkpoint.type, 'server-save-checkpoint')
  assert.equal(checkpoint.reason, 'progress')
  assert.ok(checkpoint.save)
  assert.equal((await readHealth(supervisor.address.url)).draining, true)

  const rejectedAdmission = await fetch(`${supervisor.address.url}/admin/hub/tickets`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ content: EMPTY_CONTENT, leaderboardUserId: null }),
  })
  assert.equal(rejectedAdmission.status, 503)

  client.socket.send(encodeGameMessage({
    type: 'client-deployment-ready',
    checkpointSequence: restart.checkpointSequence,
    targetRevision,
  }))
  const response = await responsePromise
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    status: 'ready',
    players: 1,
    savedPlayers: 1,
    targetRevision,
    unacknowledgedPlayers: 0,
  })
  assert.deepEqual(await closed, { code: 1012, reason: 'game updating' })
})

test('first returning nonleader recovers the updated party run under the original leader', async (context) => {
  const oldRevision = '1'.repeat(40)
  const targetRevision = '2'.repeat(40)
  const oldSupervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    revision: oldRevision,
    snapshotRate: 100,
  })
  context.after(() => oldSupervisor.close())
  const leader = await join(
    oldSupervisor.address.url,
    await admitHub(oldSupervisor.address.url, EMPTY_CONTENT, 41),
    BROWSER_ORIGIN,
  )
  const member = await join(
    oldSupervisor.address.url,
    await admitHub(oldSupervisor.address.url, EMPTY_CONTENT, 42),
    BROWSER_ORIGIN,
  )
  const invited = member.next(message => (
    message.type === 'server-party-state' && message.state.invitations.length === 1
  ))
  leader.socket.send(encodeGameMessage({
    type: 'client-party-invite',
    targetPlayerId: member.welcome.playerId,
  }))
  const invitation = await invited
  if (invitation.type !== 'server-party-state') assert.fail('expected invitation')
  const grouped = member.next(message => (
    message.type === 'server-party-state' && message.state.party.memberPlayerIds.length === 2
  ))
  member.socket.send(encodeGameMessage({
    type: 'client-party-accept',
    invitationId: invitation.state.invitations[0]!.id,
  }))
  await grouped
  const leaderLoaded = leader.next(message => message.type === 'server-boneyard-loaded')
  const memberLoaded = member.next(message => message.type === 'server-boneyard-loaded')
  leader.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const [leaderRun, memberRun] = await Promise.all([leaderLoaded, memberLoaded])
  assert.equal(leaderRun.type, 'server-boneyard-loaded')
  assert.equal(memberRun.type, 'server-boneyard-loaded')
  assert.equal(leaderRun.boneyard.runId, memberRun.boneyard.runId)

  const restartResponse = fetch(`${oldSupervisor.address.url}/admin/deployments/restart`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ targetRevision }),
  })
  const leaderRestart = await leader.next(message => message.type === 'server-deployment-restart')
  const memberRestart = await member.next(message => message.type === 'server-deployment-restart')
  assert.equal(leaderRestart.type, 'server-deployment-restart')
  assert.equal(memberRestart.type, 'server-deployment-restart')
  const leaderFinal = await leader.next(message => (
    message.type === 'server-save-checkpoint'
    && message.sequence === leaderRestart.checkpointSequence
  ))
  const memberFinal = await member.next(message => (
    message.type === 'server-save-checkpoint'
    && message.sequence === memberRestart.checkpointSequence
  ))
  assert.equal(leaderFinal.type, 'server-save-checkpoint')
  assert.equal(memberFinal.type, 'server-save-checkpoint')
  leader.socket.send(encodeGameMessage({
    type: 'client-deployment-ready',
    checkpointSequence: leaderRestart.checkpointSequence,
    targetRevision,
  }))
  member.socket.send(encodeGameMessage({
    type: 'client-deployment-ready',
    checkpointSequence: memberRestart.checkpointSequence,
    targetRevision,
  }))
  assert.equal((await restartResponse).status, 200)
  await oldSupervisor.close()

  const replacement = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    revision: targetRevision,
    snapshotRate: 100,
  })
  context.after(() => replacement.close())
  const recover = async (save: string, leaderboardUserId: number) => {
    const token = JSON.parse(save).continuation.summary.partyRejoinToken as string
    const response = await fetch(`${replacement.address.url}/admin/rejoin`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ADMIN_SECRET}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        content: EMPTY_CONTENT,
        developerAccess: false,
        leaderboardUserId,
        save,
        token,
      }),
    })
    assert.equal(response.status, 201)
    return await response.json() as ProvisionedEndpoint
  }

  const recoveredMember = await joinSaved(
    replacement.address.url,
    await recover(memberFinal.save, 42),
    BROWSER_ORIGIN,
    memberFinal.save,
  )
  assert.equal(recoveredMember.welcome.playerId, member.welcome.playerId)
  assert.equal(recoveredMember.welcome.snapshot.world.kind, 'boneyard')
  if (recoveredMember.welcome.snapshot.world.kind !== 'boneyard') {
    assert.fail('expected recovered Boneyard')
  }
  assert.equal(recoveredMember.welcome.snapshot.world.runId, memberRun.boneyard.runId)
  assert.equal(recoveredMember.welcome.gameplayResumeGrace?.reason, 'game-restarted')
  assert.equal(recoveredMember.welcome.gameplayResumeGrace?.remainingMs, null)
  const memberRecoveredParty = await recoveredMember.next(message => (
    message.type === 'server-party-state'
    && message.state.party.memberPlayerIds.length === 2
  ))
  assert.equal(memberRecoveredParty.type, 'server-party-state')
  assert.equal(memberRecoveredParty.state.party.leaderPlayerId, leader.welcome.playerId)
  assert.deepEqual(
    memberRecoveredParty.state.partyRoster.map(row => ({
      connected: row.connected,
      playerId: row.playerId,
    })),
    [
      { connected: false, playerId: leader.welcome.playerId },
      { connected: true, playerId: member.welcome.playerId },
    ],
  )
  let countdownStartedBeforeLeader = false
  const observeEarlyCountdown = (data: WebSocket.RawData) => {
    const message = decodeServerGameMessage(data.toString())
    if (
      message.type === 'server-gameplay-resume-grace'
      && message.grace?.remainingMs !== null
    ) countdownStartedBeforeLeader = true
  }
  recoveredMember.socket.on('message', observeEarlyCountdown)
  const memberFirstResume = recoveredMember.next(message => (
    message.type === 'server-gameplay-resume-grace' && message.grace === null
  ))
  recoveredMember.socket.send(encodeGameMessage({
    type: 'client-resume-grace-ready',
    sequence: recoveredMember.welcome.gameplayResumeGrace!.sequence,
  }))
  await waitFor(() => countdownStartedBeforeLeader)
  assert.equal(countdownStartedBeforeLeader, true)
  await memberFirstResume
  const firstReturnTick = recoveredMember.welcome.snapshot.tick
  const progressedWithoutLeader = await recoveredMember.next(message => (
    message.type === 'server-snapshot' && message.frame.tick > firstReturnTick
  ))
  assert.equal(progressedWithoutLeader.type, 'server-snapshot')
  const progressedTick = progressedWithoutLeader.frame.tick
  countdownStartedBeforeLeader = false

  const recoveredLeader = await joinSaved(
    replacement.address.url,
    await recover(leaderFinal.save, 41),
    BROWSER_ORIGIN,
    leaderFinal.save,
  )
  assert.equal(recoveredLeader.welcome.playerId, leader.welcome.playerId)
  assert.equal(recoveredLeader.welcome.snapshot.world.kind, 'boneyard')
  if (recoveredLeader.welcome.snapshot.world.kind !== 'boneyard') {
    assert.fail('expected recovered Boneyard')
  }
  assert.equal(recoveredLeader.welcome.snapshot.world.runId, memberRun.boneyard.runId)
  assert.ok(recoveredLeader.welcome.snapshot.tick >= progressedTick)
  assert.equal(recoveredLeader.welcome.gameplayResumeGrace?.reason, 'game-rejoined')
  assert.equal(recoveredLeader.welcome.gameplayResumeGrace?.remainingMs, null)
  const refreshedMemberGrace = await recoveredMember.next(message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace?.remainingMs === null
    && message.grace.sequence === recoveredLeader.welcome.gameplayResumeGrace?.sequence
  ))
  assert.equal(refreshedMemberGrace.type, 'server-gameplay-resume-grace')
  const memberCounting = recoveredMember.next(message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace?.remainingMs !== null
    && message.grace.sequence === recoveredLeader.welcome.gameplayResumeGrace?.sequence
  ))
  const leaderCounting = recoveredLeader.next(message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace?.remainingMs !== null
    && message.grace.sequence === recoveredLeader.welcome.gameplayResumeGrace?.sequence
  ))
  recoveredMember.socket.send(encodeGameMessage({
    type: 'client-resume-grace-ready',
    sequence: recoveredLeader.welcome.gameplayResumeGrace!.sequence,
  }))
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(countdownStartedBeforeLeader, false)
  recoveredLeader.socket.send(encodeGameMessage({
    type: 'client-resume-grace-ready',
    sequence: recoveredLeader.welcome.gameplayResumeGrace!.sequence,
  }))
  const [memberGrace, leaderGrace] = await Promise.all([memberCounting, leaderCounting])
  assert.equal(memberGrace.type, 'server-gameplay-resume-grace')
  assert.equal(leaderGrace.type, 'server-gameplay-resume-grace')
  assert.ok((memberGrace.grace?.remainingMs ?? 0) > 1_900)
  assert.ok((memberGrace.grace?.remainingMs ?? Infinity) <= 2_000)
  recoveredMember.socket.off('message', observeEarlyCountdown)
  const recoveredParty = await recoveredLeader.next(message => (
    message.type === 'server-party-state'
    && message.state.party.memberPlayerIds.length === 2
  ))
  assert.equal(recoveredParty.type, 'server-party-state')
  assert.equal(recoveredParty.state.party.leaderPlayerId, leader.welcome.playerId)
  assert.deepEqual(new Set(recoveredParty.state.party.memberPlayerIds), new Set([
    member.welcome.playerId,
    leader.welcome.playerId,
  ]))
})

test('ordinary checkpoint survives same-revision host loss and repeated empty suspension', async (context) => {
  const revision = '3'.repeat(40)
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    revision,
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())
  const client = await join(
    supervisor.address.url,
    await admitHub(supervisor.address.url, EMPTY_CONTENT, 51),
    BROWSER_ORIGIN,
  )
  const loaded = client.next(message => message.type === 'server-boneyard-loaded')
  const checkpoint = client.next(message => (
    message.type === 'server-save-checkpoint'
    && message.reason === 'progress'
    && JSON.parse(message.save).continuation.summary.partyRejoinToken !== null
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const [run, saved] = await Promise.all([loaded, checkpoint])
  assert.equal(run.type, 'server-boneyard-loaded')
  assert.equal(saved.type, 'server-save-checkpoint')
  const token = JSON.parse(saved.save).continuation.summary.partyRejoinToken as string
  assert.equal(
    verifyPartyRecoveryClaim(ADMIN_SECRET, token, saved.save)?.targetRevision,
    revision,
  )

  await supervisor.close()

  const replacement = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    revision,
    snapshotRate: 100,
  })
  context.after(() => replacement.close())
  const response = await fetch(`${replacement.address.url}/admin/rejoin`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      content: EMPTY_CONTENT,
      developerAccess: false,
      leaderboardUserId: 51,
      save: saved.save,
      token,
    }),
  })
  assert.equal(response.status, 201)
  const endpoint = await response.json() as ProvisionedEndpoint
  const resumed = await joinSaved(
    replacement.address.url,
    endpoint,
    BROWSER_ORIGIN,
    saved.save,
  )
  context.after(() => closeSocket(resumed.socket))
  assert.equal(resumed.welcome.snapshot.world.kind, 'boneyard')
  if (resumed.welcome.snapshot.world.kind !== 'boneyard') assert.fail('expected resumed run')
  assert.equal(resumed.welcome.snapshot.world.runId, run.boneyard.runId)
  assert.equal(resumed.welcome.gameplayResumeGrace?.reason, 'game-restarted')

  const rotated = await resumed.next(message => (
    message.type === 'server-save-checkpoint'
    && JSON.parse(message.save).continuation.summary.partyRejoinToken !== token
  ))
  assert.equal(rotated.type, 'server-save-checkpoint')
  const rotatedToken = JSON.parse(rotated.save).continuation.summary.partyRejoinToken as string
  await closeSocket(resumed.socket)
  await waitFor(async () => (await readHealth(replacement.address.url)).runs === 0)
  const repeatedResponse = await fetch(`${replacement.address.url}/admin/rejoin`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      content: EMPTY_CONTENT,
      developerAccess: false,
      leaderboardUserId: 51,
      save: rotated.save,
      token: rotatedToken,
    }),
  })
  assert.equal(repeatedResponse.status, 201)
  const repeated = await joinSaved(
    replacement.address.url,
    await repeatedResponse.json() as ProvisionedEndpoint,
    BROWSER_ORIGIN,
    rotated.save,
  )
  context.after(() => closeSocket(repeated.socket))
  assert.equal(repeated.welcome.snapshot.world.kind, 'boneyard')
  if (repeated.welcome.snapshot.world.kind !== 'boneyard') assert.fail('expected repeated run')
  assert.equal(repeated.welcome.snapshot.world.runId, run.boneyard.runId)
})

test('private College spins its suspended run up from an ordinary current-revision claim', async (context) => {
  const revision = '4'.repeat(40)
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    revision,
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())
  const client = await join(
    supervisor.address.url,
    await provision(supervisor.address.url),
    BROWSER_ORIGIN,
  )
  const loaded = client.next(message => message.type === 'server-boneyard-loaded')
  const checkpoint = client.next(message => (
    message.type === 'server-save-checkpoint'
    && message.reason === 'progress'
    && JSON.parse(message.save).continuation.summary.partyRejoinToken !== null
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const [run, saved] = await Promise.all([loaded, checkpoint])
  assert.equal(run.type, 'server-boneyard-loaded')
  assert.equal(saved.type, 'server-save-checkpoint')
  const token = JSON.parse(saved.save).continuation.summary.partyRejoinToken as string
  await closeSocket(client.socket)
  await waitFor(() => supervisor.sessionCount() === 0)

  const response = await fetch(`${supervisor.address.url}/admin/rejoin`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      content: EMPTY_CONTENT,
      developerAccess: false,
      leaderboardUserId: 42,
      save: saved.save,
      token,
    }),
  })
  assert.equal(response.status, 201)
  const endpoint = await response.json() as ProvisionedEndpoint
  assert.match(endpoint.path, /^\/game-sessions\/[A-Za-z0-9_-]{32}$/)
  const resumed = await joinSaved(
    supervisor.address.url,
    endpoint,
    BROWSER_ORIGIN,
    saved.save,
  )
  context.after(() => closeSocket(resumed.socket))
  assert.equal(resumed.welcome.snapshot.world.kind, 'boneyard')
  if (resumed.welcome.snapshot.world.kind !== 'boneyard') assert.fail('expected private run')
  assert.equal(resumed.welcome.snapshot.world.runId, run.boneyard.runId)
})

test('deployment restart cannot be deferred by an unresponsive browser', async (context) => {
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    deploymentSaveTimeoutMs: 25,
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())
  const client = await join(
    supervisor.address.url,
    await admitHub(supervisor.address.url),
    BROWSER_ORIGIN,
  )
  const targetRevision = 'b'.repeat(40)
  const closed = socketClosed(client.socket)
  const responsePromise = fetch(`${supervisor.address.url}/admin/deployments/restart`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ targetRevision }),
  })
  const restart = await client.next(message => message.type === 'server-deployment-restart')
  assert.equal(restart.type, 'server-deployment-restart')

  const response = await responsePromise
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    status: 'ready',
    players: 1,
    savedPlayers: 0,
    targetRevision,
    unacknowledgedPlayers: 1,
  })
  assert.deepEqual(await closed, { code: 1012, reason: 'game updating' })
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
  const firstParty = await first.next(message => message.type === 'server-party-state')
  assert.equal(firstParty.type, 'server-party-state')
  const joinIntent = await resolveJoinCode(
    supervisor.address.url,
    firstParty.state.party.joinCode,
  )
  const secondEndpoint = await admitJoin(supervisor.address.url, joinIntent.intentId, 43)
  const second = await join(supervisor.address.url, secondEndpoint, BROWSER_ORIGIN)
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

test('game session supervisor closes a restored Tutorial after its final player leaves', async (context) => {
  const logs: GameServerLogEntry[] = []
  const supervisor = await startGameSessionSupervisor({
    adminSecret: ADMIN_SECRET,
    allowedOrigins: [BROWSER_ORIGIN],
    log: entry => logs.push(entry),
    snapshotRate: 100,
  })
  context.after(() => supervisor.close())

  const endpoint = await provision(supervisor.address.url)
  const client = await joinSaved(
    supervisor.address.url,
    endpoint,
    BROWSER_ORIGIN,
    tutorialSaveDocument(),
  )
  assert.equal(client.welcome.snapshot.world.kind, 'boneyard')
  if (client.welcome.snapshot.world.kind !== 'boneyard') assert.fail('expected Tutorial')
  assert.ok(client.welcome.snapshot.world.tutorial)

  await closeSocket(client.socket)
  await waitFor(() => supervisor.sessionCount() === 0)

  const health = await readHealth(supervisor.address.url)
  assert.equal(health.privateSessions, 0)
  assert.equal(health.runs, 0)
  assert.equal(health.players, 0)
  assert.equal(logs.some(entry => entry.level === 'error'), false)
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
  draining: boolean
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
  cheatsEnabled: boolean
  id: string
  leader: string
  maxMembers: number
  memberCount: number
  members: string[]
  modCount: number
  sessionKind: 'global-hub' | 'private-college'
  status: 'hub' | 'playing'
  visibility: 'invite-only' | 'public'
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

type PresenceDirectoryEntry = HostPresenceEntry & {
  session: 'global-hub' | 'private-college'
}

async function readPresence(supervisorUrl: string): Promise<PresenceDirectoryEntry[]> {
  const response = await fetch(`${supervisorUrl}/admin/presence`, {
    headers: { authorization: `Bearer ${ADMIN_SECRET}` },
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const value = await response.json() as { items?: PresenceDirectoryEntry[] }
  assert.ok(Array.isArray(value.items))
  return value.items
}

async function provision(
  supervisorUrl: string,
  content: typeof EMPTY_CONTENT | typeof MOD_CONTENT = EMPTY_CONTENT,
): Promise<ProvisionedEndpoint> {
  const response = await fetch(`${supervisorUrl}/admin/sessions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ content, leaderboardUserId: 42 }),
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

async function resolveJoinCode(
  supervisorUrl: string,
  code: string,
): Promise<{ intentId: string; target: Record<string, unknown> }> {
  const response = await fetch(`${supervisorUrl}/admin/join/resolve`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ code }),
  })
  assert.equal(response.status, 201)
  return await response.json() as { intentId: string; target: Record<string, unknown> }
}

async function resolvePublicParty(
  supervisorUrl: string,
  listingId: string,
): Promise<{ intentId: string; target: Record<string, unknown> }> {
  const response = await fetch(`${supervisorUrl}/admin/join/public`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ listingId }),
  })
  assert.equal(response.status, 201)
  return await response.json() as { intentId: string; target: Record<string, unknown> }
}

function requestJoinAdmission(
  supervisorUrl: string,
  intentId: string,
  leaderboardUserId: number | null,
): Promise<Response> {
  return fetch(`${supervisorUrl}/admin/join/admit`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      activeMods: false,
      content: EMPTY_CONTENT,
      intentId,
      leaderboardUserId,
    }),
  })
}

async function admitJoin(
  supervisorUrl: string,
  intentId: string,
  leaderboardUserId: number | null,
): Promise<ProvisionedEndpoint> {
  const response = await requestJoinAdmission(supervisorUrl, intentId, leaderboardUserId)
  assert.equal(response.status, 201)
  const value = await response.json() as Record<string, unknown>
  return {
    credential: value.credential as string,
    path: value.path as string,
  }
}

async function requestJoin(supervisorUrl: string, listingId: string): Promise<string> {
  const response = await fetch(`${supervisorUrl}/admin/join/requests`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ADMIN_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      listingId,
      requester: {
        accountUsername: null,
        displayName: 'Guest Cassia',
        requesterId: `guest-${randomToken()}`,
      },
    }),
  })
  assert.equal(response.status, 201)
  const value = await response.json() as { requestToken?: string }
  assert.equal(typeof value.requestToken, 'string')
  return value.requestToken!
}

async function pollJoinRequest(
  supervisorUrl: string,
  token: string,
): Promise<{ intentId?: string; status: 'accepted' | 'denied' | 'pending' }> {
  const deadline = performance.now() + 3_000
  for (;;) {
    const response = await fetch(`${supervisorUrl}/admin/join/requests/${token}`, {
      headers: { authorization: `Bearer ${ADMIN_SECRET}` },
    })
    assert.equal(response.status, 200)
    const value = await response.json() as {
      intentId?: string
      status: 'accepted' | 'denied' | 'pending'
    }
    if (value.status !== 'pending') return value
    if (performance.now() >= deadline) throw new Error('timed out waiting for join approval')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

function randomToken(): string {
  return Math.random().toString(36).slice(2).padEnd(12, '0')
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
  options: Readonly<{
    character?: PlayerCharacterConfig
    cheatsEnabled?: boolean
    onlinePreferences?: {
      activityMessages: boolean
      globalChat: boolean
      submitRuns: boolean
    }
  }> = {},
) {
  const socket = await openSocket(websocketUrl(supervisorUrl, endpoint.path), origin, autoPong)
  const next = messageQueue(socket)
  socket.send(encodeGameMessage({
    type: 'client-hello',
    onlinePreferences: options.onlinePreferences
      ?? { activityMessages: true, globalChat: true, submitRuns: true },
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: options.cheatsEnabled ?? false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: endpoint.credential,
    character: options.character ?? CHARACTER,
  }))
  const welcome = await next((message) => message.type === 'server-welcome')
  assert.equal(welcome.type, 'server-welcome')
  return { next, socket, welcome }
}

async function joinSaved(
  supervisorUrl: string,
  endpoint: ProvisionedEndpoint,
  origin: string,
  save: string,
) {
  const socket = await openSocket(websocketUrl(supervisorUrl, endpoint.path), origin)
  const next = messageQueue(socket)
  socket.send(encodeGameMessage({
    type: 'client-hello',
    onlinePreferences: { activityMessages: true, globalChat: true, submitRuns: true },
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: endpoint.credential,
    character: CHARACTER,
    save,
    saveIntent: 'resume',
  }))
  const welcome = await next(message => message.type === 'server-welcome')
  assert.equal(welcome.type, 'server-welcome')
  return { next, socket, welcome }
}

function tutorialSaveDocument(): string {
  const loadedBoneyard = materializeStockTutorial(Buffer.alloc(16, 31))
  return createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard,
    mods: [],
    modState: {},
    partyRejoinToken: null,
    playerId: 'owner',
    state: enterBoneyardWorld(
      createGameSimulation({ owner: CHARACTER }),
      loadedBoneyard,
    ),
  })
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
    if (message.type === 'server-snapshot') {
      socket.send(encodeGameMessage({
        type: 'client-snapshot-ack',
        requireKeyframe: false,
        sequence: message.sequence,
      }))
    }
    const waiterIndex = waiters.findIndex(({ predicate }) => predicate(message))
    if (waiterIndex < 0) {
      const replaceable = message.type === 'server-snapshot'
        || message.type === 'server-mod-runtime'
      const replaceableIndex = replaceable
        ? buffered.findIndex(candidate => candidate.type === message.type)
        : -1
      if (replaceableIndex < 0) buffered.push(message)
      else buffered[replaceableIndex] = message
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
        reject(new Error(`timed out waiting for game message; buffered=${buffered.map(message => (
          message.type === 'server-party-state'
            ? `${message.type}:${message.state.party.memberPlayerIds.length}:${message.state.party.visibility}`
            : message.type
        )).join(',')}`))
      }, 10_000)
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

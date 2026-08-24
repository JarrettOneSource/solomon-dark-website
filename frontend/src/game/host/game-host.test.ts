import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

import { WebSocket } from 'ws'

import { HUB_SPAWN } from '../core-kernels/hub-math.ts'
import {
  GAME_OVER_INPUT_ACCEPT_TICK,
  GAME_OVER_INPUT_EXIT_FADE_TICKS,
} from '../core-kernels/game-run.ts'
import { NATIVE_HALL_OF_FAME_SCORE } from '../core-kernels/hall-of-fame-score.ts'
import {
  createGameSimulation,
  gameSimulationPlayerRecords,
  getPlayerEconomy,
  getPlayerProgression,
  grantGameSimulationPlayerExperience,
} from '../core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../core-server/player-entity-store.ts'
import { createHubStudentFixturePopulation } from '../core-server/hub-student-fixtures.ts'
import type {
  PlayerCharacterConfig,
  PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import {
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
  type ServerGameMessage,
  type ServerSnapshotMessage,
} from '../protocol/game-protocol.ts'
import type { GameSnapshot } from '../protocol/game-state.ts'
import type { PlayerSocialProfile } from '../protocol/party-state.ts'
import { EntityReplicationReconstructor } from '../protocol/entity-replication.ts'
import type { BoneyardScene } from '../core-kernels/boneyard.ts'
import { createBoneyardCatalog, type ModBoneyardEntry } from './boneyard-catalog.ts'
import {
  GAME_SAVE_AUTOSAVE_INTERVAL_TICKS,
  startGameHost,
} from './game-host.ts'
import type { GameServerLogEntry } from './game-server-logger.ts'
import {
  deriveGameActivityEvents,
  type GameActivityPlayer,
  type GameActivitySnapshot,
} from './game-activity-events.ts'
import { SOLOMON_DIG_FRAME_PROGRAM } from './project-boneyard.ts'
import { GAME_WEBSOCKET_COMPRESSION } from './websocket-compression.ts'
import {
  createGameProfileSaveDocument,
  createGameSaveDocument,
  restoreGameSaveProfile,
} from '../save/game-save-document.ts'

const FIRST_CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const
const SECOND_CHARACTER = {
  discipline: 'mind',
  displayName: 'Vibia',
  element: 'water',
} as const
const SHARED_AUTHENTICATION = { kind: 'shared', credential: 'test-secret' } as const
const LEADERBOARD_RECEIPT_SECRET = 'leaderboard-receipt-test-secret-that-is-long-enough'
const EMPTY_SHARED_CONTENT = {
  assets: [],
  boneyards: [],
  manifest: { manifestSha256: '0'.repeat(64), mods: [] },
  modSources: [],
  summary: { manifestSha256: '0'.repeat(64), mods: [] },
} as const
const SHARED_HUB_AUTHENTICATION = {
  kind: 'tickets',
  claim: (credential: string) => credential.startsWith('ticket-')
    ? { content: EMPTY_SHARED_CONTENT, leaderboardUserId: null }
    : null,
} as const
const require = createRequire(import.meta.url)
const luaWasmPath = require.resolve('wasmoon/dist/glue.wasm')

type MaterializedServerSnapshotMessage = ServerSnapshotMessage & { snapshot: GameSnapshot }
type TestServerGameMessage =
  | Exclude<ServerGameMessage, ServerSnapshotMessage>
  | MaterializedServerSnapshotMessage
type TestChatMessage = Extract<
  ServerGameMessage,
  { type: 'server-chat' | 'server-chat-rejected' }
>

interface TestReplicationState {
  readonly frames: Map<number, MaterializedServerSnapshotMessage>
  readonly reconstructor: EntityReplicationReconstructor
}

const replicationBySocket = new WeakMap<WebSocket, TestReplicationState>()

test('game activity derivation emits detailed run, wave, death, level, and ending edges once', () => {
  const player = (changes: Partial<GameActivityPlayer> = {}): GameActivityPlayer => ({
    currentHealth: 100,
    deathEpoch: 0,
    discipline: 'arcane',
    displayName: 'Helvidius',
    element: 'ether',
    level: 1,
    lifeState: 'alive',
    maximumHealth: 100,
    playerId: 'player-1',
    x: 10,
    y: 20,
    ...changes,
  })
  const snapshot = (
    changes: Partial<GameActivitySnapshot> = {},
  ): GameActivitySnapshot => ({
    phase: 'hub',
    players: [player()],
    runId: null,
    tick: 0,
    wave: null,
    ...changes,
  })

  const runStarted = snapshot({ phase: 'active', runId: 'run-1', tick: 10 })
  assert.deepEqual(
    deriveGameActivityEvents(snapshot(), runStarted).map(({ event }) => event),
    ['run.started'],
  )

  const waveStarted = snapshot({
    phase: 'active',
    runId: 'run-1',
    tick: 20,
    wave: { eventId: 7, ordinal: 1, phase: 'wave-spawning' },
  })
  assert.deepEqual(
    deriveGameActivityEvents(runStarted, waveStarted).map(({ event }) => event),
    ['wave.started'],
  )

  const threshold = snapshot({
    phase: 'active',
    runId: 'run-1',
    tick: 30,
    wave: { eventId: 7, ordinal: 1, phase: 'wave-threshold' },
  })
  const diedAndLeveled = snapshot({
    phase: 'game-over',
    players: [player({ currentHealth: 0, deathEpoch: 1, level: 2, lifeState: 'dying' })],
    runId: 'run-1',
    tick: 31,
    wave: { eventId: 7, ordinal: 1, phase: 'wave-lull-delay' },
  })
  const terminalEvents = deriveGameActivityEvents(threshold, diedAndLeveled)
  assert.deepEqual(terminalEvents.map(({ event }) => event), [
    'wave.completed',
    'player.died',
    'player.leveled_up',
    'run.game_over',
  ])
  assert.deepEqual(
    terminalEvents.find(({ event }) => event === 'player.died')?.details,
    {
      ...player({ currentHealth: 0, deathEpoch: 1, level: 2, lifeState: 'dying' }),
      runId: 'run-1',
      serverTick: 31,
      wave: 1,
    },
  )

  assert.deepEqual(
    deriveGameActivityEvents(diedAndLeveled, snapshot({
      phase: 'loadout',
      players: diedAndLeveled.players,
      tick: 40,
    })).map(({ event }) => event),
    ['run.ended'],
  )
})

test('snapshot compression is bounded and skips sub-kilobyte control messages', () => {
  assert.deepEqual(GAME_WEBSOCKET_COMPRESSION, {
    clientNoContextTakeover: true,
    concurrencyLimit: 4,
    serverNoContextTakeover: true,
    threshold: 1_024,
    zlibDeflateOptions: { level: 3, memLevel: 7 },
  })
})

test('developer observer watches one private run without joining or mutating participant state', async (context) => {
  let observedRunId: string | null = null
  const runtimeEvents: GameServerLogEntry[] = []
  const host = await startGameHost({
    authentication: {
      kind: 'tickets',
      claim: credential => credential === 'observer-ticket' && observedRunId
        ? {
            content: EMPTY_SHARED_CONTENT,
            developerAccess: true,
            leaderboardUserId: null,
            observer: {
              runId: observedRunId,
              userId: 7,
              username: 'developer',
            },
          }
        : credential.startsWith('ticket-')
          ? { content: EMPTY_SHARED_CONTENT, leaderboardUserId: null }
          : null,
    },
    runtimeEvents: entry => runtimeEvents.push({
      ...entry,
      atUtc: entry.occurredAtUtc ?? new Date().toISOString(),
      level: 'info',
      component: 'game-host',
    }),
    sessionKind: 'global-hub',
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const leader = await join(host.address.url, 'ticket-leader', FIRST_CHARACTER)
  const guest = await join(host.address.url, 'ticket-guest', SECOND_CHARACTER)
  context.after(() => closeSocket(leader.socket))
  context.after(() => closeSocket(guest.socket))

  const invited = nextMessage(guest.socket, message => (
    message.type === 'server-party-state' && message.state.invitations.length === 1
  ))
  leader.socket.send(encodeGameMessage({
    type: 'client-party-invite',
    targetPlayerId: guest.welcome.playerId,
  }))
  const invitation = await invited
  if (invitation.type !== 'server-party-state') throw new Error('expected invitation')
  const grouped = nextMessage(leader.socket, message => (
    message.type === 'server-party-state' && message.state.party.memberPlayerIds.length === 2
  ))
  guest.socket.send(encodeGameMessage({
    type: 'client-party-accept',
    invitationId: invitation.state.invitations[0]!.id,
  }))
  await grouped
  const loaded = nextMessage(leader.socket, message => message.type === 'server-boneyard-loaded')
  leader.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const boneyard = await loaded
  if (boneyard.type !== 'server-boneyard-loaded') throw new Error('expected Boneyard')
  observedRunId = boneyard.boneyard.runId
  assert.equal(host.observationTargets().length, 1)
  assert.equal(host.observationTargets()[0]?.visibility, 'private')

  // Let the match transition finish publishing its own party state before the
  // observer admission becomes the event under test.
  await new Promise(resolve => setTimeout(resolve, 30))
  let playerFacingObserverCueCount = 0
  const countPlayerFacingCue = (payload: WebSocket.RawData) => {
    const message = decodeServerGameMessage(payload.toString())
    if (message.type === 'server-party-state') playerFacingObserverCueCount += 1
  }
  leader.socket.on('message', countPlayerFacingCue)
  guest.socket.on('message', countPlayerFacingCue)
  const observerSocket = await openSocket(host.address.url)
  context.after(() => closeSocket(observerSocket))
  const observerWelcome = nextMessage(observerSocket, message => message.type === 'server-welcome')
  observerSocket.send(encodeGameMessage({
    type: 'client-observer-hello',
    credential: 'observer-ticket',
    protocolVersion: GAME_PROTOCOL_VERSION,
  }))
  const welcome = await observerWelcome
  assert.equal(welcome.type, 'server-welcome')
  assert.equal(welcome.observer, true)
  assert.equal(Object.keys(welcome.snapshot.players).length, 2)
  assert.equal(welcome.snapshot.levelUpBarrier?.pendingPlayerIds.includes(welcome.resumeToken) ?? false, false)
  assert.equal(host.playerCount(), 2)
  assert.equal(host.presence().length, 2)
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(playerFacingObserverCueCount, 0)

  const observedChat = nextMessage(observerSocket, message => (
    message.type === 'server-chat' && message.text === 'Hidden observer copy'
  ))
  leader.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'party',
    text: 'Hidden observer copy',
  }))
  const chat = await observedChat
  assert.equal(chat.type, 'server-chat')
  assert.equal(chat.sender.playerId, leader.welcome.playerId)

  const observedWhisper = nextMessage(observerSocket, message => (
    message.type === 'server-chat' && message.text === 'Private observer copy'
  ))
  leader.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'whisper',
    targetPlayerId: guest.welcome.playerId,
    text: 'Private observer copy',
  }))
  const whisper = await observedWhisper
  assert.equal(whisper.type, 'server-chat')
  assert.equal(whisper.channel, 'whisper')
  assert.equal(whisper.recipient?.playerId, guest.welcome.playerId)

  const rejected = nextMessage(observerSocket, message => message.type === 'server-disconnect')
  observerSocket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 1, y: 0 }),
    sequence: 1,
    targetTick: welcome.snapshot.tick + 1,
  }))
  assert.deepEqual(await rejected, {
    type: 'server-disconnect',
    code: 'invalid-message',
    reason: 'Observer connections are read-only.',
  })
  await waitFor(() => runtimeEvents.some(entry => entry.event === 'observer.disconnected'))
  assert.equal(host.playerCount(), 2)
  assert.equal(host.presence().length, 2)
  leader.socket.off('message', countPlayerFacingCue)
  guest.socket.off('message', countPlayerFacingCue)
})

function gameplayInput(
  movement: { x: number; y: number },
  aim: { x: number; y: number } | null = null,
  primary = false,
  quickbar: number | null = null,
): PlayerCharacterInput {
  return {
    aim,
    cast: { primary, quickbar },
    movement,
    viewportWidth: 1_600,
  }
}

test('authoritative game host owns two configured player characters and movement', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  assert.equal(first.socket.extensions, 'permessage-deflate')
  assert.equal(second.socket.extensions, 'permessage-deflate')

  assert.notEqual(first.welcome.playerId, second.welcome.playerId)
  assert.equal(host.playerCount(), 2)
  const firstState = first.welcome.snapshot.players[first.welcome.playerId]
  const secondState = second.welcome.snapshot.players[second.welcome.playerId]
  assert.deepEqual(firstState.config, FIRST_CHARACTER)
  assert.deepEqual(secondState.config, SECOND_CHARACTER)
  assert.equal(firstState.position.x, HUB_SPAWN.x)
  assert.equal(secondState.position.x, HUB_SPAWN.x)
  first.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 1, y: 0 }),
    sequence: 1,
    targetTick: first.welcome.snapshot.tick + 1,
  }))
  const snapshot = await nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.acknowledgedInputSequence === 1
    && message.snapshot.players[first.welcome.playerId].position.x > firstState.position.x
  ))
  assert.equal(snapshot.type, 'server-snapshot')
  assert.ok(snapshot.snapshot.players[first.welcome.playerId].position.x > firstState.position.x)
  assert.deepEqual(
    snapshot.snapshot.players[second.welcome.playerId].velocity,
    { x: 0, y: 0 },
  )
})

test('global Hub rejects modded and cheats-on admissions before player ownership', async (context) => {
  const moddedContent = {
    ...EMPTY_SHARED_CONTENT,
    manifest: {
      manifestSha256: '1'.repeat(64),
      mods: [{
        contentSha256: 'a'.repeat(64),
        id: 'tests.modded',
        version: '1.0.0',
      }],
    },
    summary: {
      manifestSha256: '1'.repeat(64),
      mods: [{
        assets: [],
        contentSha256: 'a'.repeat(64),
        id: 'tests.modded',
        name: 'Modded',
        slug: 'modded',
        version: '1.0.0',
      }],
    },
  }
  const host = await startGameHost({
    authentication: {
      kind: 'tickets',
      claim: credential => credential === 'modded'
        ? { content: moddedContent, leaderboardUserId: null }
        : credential === 'cheats'
          ? { content: EMPTY_SHARED_CONTENT, leaderboardUserId: null }
          : null,
    },
    sessionKind: 'global-hub',
    sharedHub: true,
  })
  context.after(() => host.close())

  for (const [credential, cheatsEnabled, reason] of [
    ['modded', false, /Mods require/],
    ['cheats', true, /Cheats require/],
  ] as const) {
    const socket = await openSocket(host.address.url)
    const denied = nextMessage(socket, message => message.type === 'server-disconnect')
    socket.send(encodeGameMessage({
      type: 'client-hello',
      profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
      cheatsEnabled,
      protocolVersion: GAME_PROTOCOL_VERSION,
      credential,
      character: FIRST_CHARACTER,
    }))
    const message = await denied
    assert.equal(message.type, 'server-disconnect')
    assert.match(message.reason, reason)
    await closeSocket(socket)
  }
  assert.equal(host.playerCount(), 0)
})

test('private College projects one party, supports Party-ID reservation, and checkpoints each wizard', async (context) => {
  let thirdPartyId: string | null = null
  const host = await startGameHost({
    authentication: {
      kind: 'tickets',
      claim: credential => credential === 'ticket-c' && thirdPartyId
        ? {
            content: EMPTY_SHARED_CONTENT,
            leaderboardUserId: null,
            partyId: thirdPartyId,
            reservationId: 'reservation-c',
          }
        : ['ticket-a', 'ticket-b'].includes(credential)
          ? { content: EMPTY_SHARED_CONTENT, leaderboardUserId: null }
          : null,
    },
    sessionKind: 'private-college',
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'ticket-a', FIRST_CHARACTER)
  context.after(() => closeSocket(first.socket))
  const merged = nextMessage(first.socket, message => (
    message.type === 'server-party-state'
    && message.state.party.memberPlayerIds.length === 2
  ))
  const firstCheckpoint = nextMessage(first.socket, message => (
    message.type === 'server-save-checkpoint' && message.save !== null
  ))
  const second = await join(host.address.url, 'ticket-b', SECOND_CHARACTER)
  context.after(() => closeSocket(second.socket))
  const partyState = await merged
  assert.equal(partyState.type, 'server-party-state')
  assert.match(partyState.state.party.joinCode, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
  assert.equal(partyState.state.party.visibility, 'private')
  const target = host.partyTargetByCode(partyState.state.party.joinCode)
  assert.equal(target?.memberCount, 2)
  assert.equal(target?.visibility, 'private')
  thirdPartyId = target!.id
  assert.equal(host.reservePartyJoin(target!.id, 'reservation-c', performance.now() + 1_000), null)
  const third = await join(host.address.url, 'ticket-c', FIRST_CHARACTER)
  context.after(() => closeSocket(third.socket))
  assert.equal((await firstCheckpoint).type, 'server-save-checkpoint')
  assert.equal(host.playerCount(), 3)
})

test('expired external join requests disappear from the leader projection', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_HUB_AUTHENTICATION,
    sessionKind: 'global-hub',
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const leader = await join(host.address.url, 'ticket-leader', FIRST_CHARACTER)
  context.after(() => closeSocket(leader.socket))
  const inviteOnly = nextMessage(leader.socket, message => (
    message.type === 'server-party-state'
    && message.state.party.visibility === 'invite-only'
  ))
  leader.socket.send(encodeGameMessage({
    type: 'client-party-settings',
    visibility: 'invite-only',
  }))
  const party = await inviteOnly
  assert.equal(party.type, 'server-party-state')
  const pending = nextMessage(leader.socket, message => (
    message.type === 'server-party-state' && message.state.joinRequests.length === 1
  ))
  const created = host.createPartyJoinRequest({
    expiresAt: performance.now() + 50,
    id: 'request-expiring',
    listingId: party.state.party.listingId,
    requester: {
      accountUsername: null,
      displayName: 'Guest Cassia',
      requesterId: 'guest-expiring',
    },
    token: 'request-token-expiring',
  })
  assert.equal(created.accepted, true)
  const projected = await pending
  assert.equal(projected.type, 'server-party-state')
  const expired = await nextMessage(leader.socket, message => (
    message.type === 'server-party-state'
    && message.state.revision > projected.state.revision
    && message.state.joinRequests.length === 0
  ))
  assert.equal(expired.type, 'server-party-state')
  assert.equal(host.partyJoinRequestStatus('request-token-expiring'), null)
})

test('shared Hub chat isolates parties, reaches Hub global, and becomes party-only in a run', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_HUB_AUTHENTICATION,
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'ticket-first', FIRST_CHARACTER)
  const second = await join(host.address.url, 'ticket-second', SECOND_CHARACTER)
  const outsider = await join(host.address.url, 'ticket-outsider', {
    ...FIRST_CHARACTER,
    displayName: 'Cassia',
  })
  for (const client of [first, second, outsider]) {
    context.after(() => client.socket.close())
  }
  const outsiderChat = collectChatMessages(outsider.socket)
  context.after(outsiderChat.stop)

  const invited = nextMessage(second.socket, message => (
    message.type === 'server-party-state' && message.state.invitations.length === 1
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-party-invite',
    targetPlayerId: second.welcome.playerId,
  }))
  const invitation = await invited
  assert.equal(invitation.type, 'server-party-state')
  const groupedFirst = nextMessage(first.socket, message => (
    message.type === 'server-party-state' && message.state.party.memberPlayerIds.length === 2
  ))
  const groupedSecond = nextMessage(second.socket, message => (
    message.type === 'server-party-state' && message.state.party.memberPlayerIds.length === 2
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-party-accept',
    invitationId: invitation.state.invitations[0]!.id,
  }))
  await Promise.all([groupedFirst, groupedSecond])

  const partyForFirst = nextMessage(first.socket, message => (
    message.type === 'server-chat' && message.text === 'Party route'
  ))
  const partyForSecond = nextMessage(second.socket, message => (
    message.type === 'server-chat' && message.text === 'Party route'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'party',
    text: 'Party route',
  }))
  const [partyA, partyB] = await Promise.all([partyForFirst, partyForSecond])
  assert.equal(partyA.type, 'server-chat')
  assert.equal(partyB.type, 'server-chat')
  assert.deepEqual(partyA, partyB)
  assert.deepEqual(partyA.sender, {
    displayName: FIRST_CHARACTER.displayName,
    playerId: first.welcome.playerId,
  })
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(outsiderChat.messages.length, 0)

  const globalForFirst = nextMessage(first.socket, message => (
    message.type === 'server-chat' && message.text === 'Hub route'
  ))
  const globalForSecond = nextMessage(second.socket, message => (
    message.type === 'server-chat' && message.text === 'Hub route'
  ))
  const globalForOutsider = nextMessage(outsider.socket, message => (
    message.type === 'server-chat' && message.text === 'Hub route'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'global',
    text: 'Hub route',
  }))
  const globalMessages = await Promise.all([globalForFirst, globalForSecond, globalForOutsider])
  for (const message of globalMessages) {
    assert.equal(message.type, 'server-chat')
    assert.equal(message.channel, 'global')
    assert.equal(message.sender.playerId, second.welcome.playerId)
    assert.ok(message.sequence > partyA.sequence)
  }

  const loadedFirst = nextMessage(first.socket, message => message.type === 'server-boneyard-loaded')
  const loadedSecond = nextMessage(second.socket, message => message.type === 'server-boneyard-loaded')
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await Promise.all([loadedFirst, loadedSecond])

  const unavailable = nextMessage(second.socket, message => (
    message.type === 'server-chat-rejected' && message.reason === 'channel-unavailable'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'global',
    text: 'Must not leave the run',
  }))
  assert.deepEqual(await unavailable, {
    type: 'server-chat-rejected',
    channel: 'global',
    reason: 'channel-unavailable',
    retryAfterMs: 0,
  })

  const runPartyForFirst = nextMessage(first.socket, message => (
    message.type === 'server-chat' && message.text === 'Run route'
  ))
  const runPartyForSecond = nextMessage(second.socket, message => (
    message.type === 'server-chat' && message.text === 'Run route'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'party',
    text: 'Run route',
  }))
  await Promise.all([runPartyForFirst, runPartyForSecond])
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(outsiderChat.messages.length, 1)
  const outsiderOnlyMessage = outsiderChat.messages[0]!
  if (outsiderOnlyMessage.type !== 'server-chat') throw new Error('expected global chat')
  assert.equal(outsiderOnlyMessage.text, 'Hub route')
})

test('whispers route to exactly the target pair and expose Hub social profiles', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_HUB_AUTHENTICATION,
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'ticket-first', FIRST_CHARACTER, true, {
    accountUsername: 'helvidius-prime',
    highestWave: 41,
    totalPlaytimeMs: 7_260_000,
  })
  const second = await join(host.address.url, 'ticket-second', SECOND_CHARACTER)
  const profiledPromise = nextMessage(first.socket, message => (
    message.type === 'server-party-state'
    && message.state.hubPlayers.length === 3
  ))
  const outsider = await join(host.address.url, 'ticket-outsider', {
    ...FIRST_CHARACTER,
    displayName: 'Cassia',
  })
  for (const client of [first, second, outsider]) {
    context.after(() => client.socket.close())
  }
  const outsiderChat = collectChatMessages(outsider.socket)
  context.after(outsiderChat.stop)

  const profiled = await profiledPromise
  assert.equal(profiled.type, 'server-party-state')
  const hubProfiles = Object.fromEntries(
    profiled.state.hubPlayers.map(profile => [profile.playerId, profile]),
  )
  assert.deepEqual(hubProfiles[first.welcome.playerId], {
    accountUsername: 'helvidius-prime',
    displayName: FIRST_CHARACTER.displayName,
    highestWave: 41,
    playerId: first.welcome.playerId,
    totalPlaytimeMs: 7_260_000,
  })
  assert.deepEqual(hubProfiles[second.welcome.playerId], {
    accountUsername: null,
    displayName: SECOND_CHARACTER.displayName,
    highestWave: null,
    playerId: second.welcome.playerId,
    totalPlaytimeMs: null,
  })

  const whisperForSender = nextMessage(first.socket, message => (
    message.type === 'server-chat' && message.text === 'Between us'
  ))
  const whisperForTarget = nextMessage(second.socket, message => (
    message.type === 'server-chat' && message.text === 'Between us'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'whisper',
    targetPlayerId: second.welcome.playerId,
    text: 'Between us',
  }))
  const [atSender, atTarget] = await Promise.all([whisperForSender, whisperForTarget])
  assert.deepEqual(atSender, atTarget)
  assert.equal(atSender.type, 'server-chat')
  assert.equal(atSender.channel, 'whisper')
  assert.deepEqual(atSender.sender, {
    displayName: FIRST_CHARACTER.displayName,
    playerId: first.welcome.playerId,
  })
  assert.deepEqual(atSender.recipient, {
    displayName: SECOND_CHARACTER.displayName,
    playerId: second.welcome.playerId,
  })
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(outsiderChat.messages.length, 0)

  const unavailable = nextMessage(first.socket, message => (
    message.type === 'server-chat-rejected' && message.reason === 'target-unavailable'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'whisper',
    targetPlayerId: 'player-toltec-departed',
    text: 'Anyone there?',
  }))
  assert.deepEqual(await unavailable, {
    type: 'server-chat-rejected',
    channel: 'whisper',
    reason: 'target-unavailable',
    retryAfterMs: 0,
  })

  const selfRejected = nextMessage(first.socket, message => (
    message.type === 'server-chat-rejected' && message.reason === 'target-unavailable'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'whisper',
    targetPlayerId: first.welcome.playerId,
    text: 'Echoing into the void',
  }))
  assert.equal((await selfRejected).type, 'server-chat-rejected')
})

test('chat rejects unavailable channels and bounds floods per authenticated client', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const chat = collectChatMessages(client.socket)
  context.after(chat.stop)

  client.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'global',
    text: 'No public Hub here',
  }))
  await waitFor(() => chat.messages.length === 1)
  assert.deepEqual(chat.messages[0], {
    type: 'server-chat-rejected',
    channel: 'global',
    reason: 'channel-unavailable',
    retryAfterMs: 0,
  })
  chat.messages.length = 0

  for (let index = 1; index <= 6; index += 1) {
    client.socket.send(encodeGameMessage({
      type: 'client-chat',
      channel: 'party',
      text: `Burst ${index}`,
    }))
  }
  await waitFor(() => chat.messages.length === 6)
  const accepted = chat.messages.filter(message => message.type === 'server-chat')
  const rejected = chat.messages.filter(message => message.type === 'server-chat-rejected')
  assert.deepEqual(accepted.map(message => message.text), [
    'Burst 1',
    'Burst 2',
    'Burst 3',
    'Burst 4',
    'Burst 5',
  ])
  assert.equal(new Set(accepted.map(message => message.sequence)).size, 5)
  assert.equal(rejected.length, 1)
  assert.equal(rejected[0]!.reason, 'rate-limited')
  assert.ok(rejected[0]!.retryAfterMs > 0 && rejected[0]!.retryAfterMs <= 5_000)
})

test('Hub activity projects to every peer, blocks only its owner input, and survives no lifecycle boundary', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => second.socket.close())

  const occupiedForFirst = nextMessage(second.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.world.kind === 'hub'
    && message.snapshot.world.participants[first.welcome.playerId]?.activity === 'occupied'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-hub-activity',
    activity: 'occupied',
  }))
  const occupiedSnapshot = await occupiedForFirst
  assert.equal(occupiedSnapshot.type, 'server-snapshot')
  assert.equal(occupiedSnapshot.snapshot.world.kind, 'hub')
  const authoritativeHub = host.state().world
  if (authoritativeHub.kind !== 'hub') throw new Error('expected authoritative Hub')
  assert.equal(
    'activity' in authoritativeHub.participants[first.welcome.playerId]!,
    false,
  )
  const activityTick = occupiedSnapshot.snapshot.tick
  await waitFor(() => host.state().tick >= activityTick + 5)

  const firstBeforeBlockedInput = gameSimulationPlayerRecords(host.state())[first.welcome.playerId]!
  first.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 1, y: 0 }),
    sequence: 1,
    targetTick: host.state().tick + 1,
  }))
  await new Promise(resolve => setTimeout(resolve, 80))
  const firstAfterBlockedInput = gameSimulationPlayerRecords(host.state())[first.welcome.playerId]!
  assert.deepEqual(firstAfterBlockedInput.position, firstBeforeBlockedInput.position)

  const secondBeforeInput = gameSimulationPlayerRecords(host.state())[second.welcome.playerId]!
  second.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: -1, y: 0 }),
    sequence: 1,
    targetTick: host.state().tick + 1,
  }))
  await waitFor(() => (
    gameSimulationPlayerRecords(host.state())[second.welcome.playerId]!.position.x
      < secondBeforeInput.position.x - 1
  ))

  const pausedForFirst = nextMessage(second.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.world.kind === 'hub'
    && message.snapshot.world.participants[first.welcome.playerId]?.activity === 'paused'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-hub-activity',
    activity: 'paused',
  }))
  await pausedForFirst

  const late = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => late.socket.close())
  assert.equal(late.welcome.gameplayPause, null)
  assert.equal(late.welcome.snapshot.world.kind, 'hub')
  if (late.welcome.snapshot.world.kind !== 'hub') throw new Error('expected Hub welcome')
  assert.equal(
    late.welcome.snapshot.world.participants[first.welcome.playerId]?.activity,
    'paused',
  )
  assert.equal(
    late.welcome.snapshot.world.participants[late.welcome.playerId]?.activity,
    null,
  )

  const beforeDisconnectTick = host.state().tick
  await closeSocket(first.socket)
  await waitFor(() => host.state().tick > beforeDisconnectTick)
  await waitFor(() => !gameSimulationPlayerRecords(host.state())[first.welcome.playerId])
})

test('every crafted Hub gameplay-pause source is rejected without suspending the world', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  const pauseMessages: ServerGameMessage[] = []
  const observePause = (data: WebSocket.RawData) => {
    const message = decodeServerGameMessage(data.toString())
    if (message.type === 'server-gameplay-pause') pauseMessages.push(message)
  }
  first.socket.on('message', observePause)
  second.socket.on('message', observePause)
  context.after(() => {
    first.socket.off('message', observePause)
    second.socket.off('message', observePause)
  })

  const initialTick = host.state().tick
  for (const source of [
    'pause-menu',
    'inventory',
    'skill-book',
    'skill-selector',
  ] as const) {
    first.socket.send(encodeGameMessage({
      type: 'client-gameplay-pause',
      paused: true,
      source,
    }))
  }
  await waitFor(() => host.state().tick >= initialTick + 5)

  assert.deepEqual(pauseMessages, [])
})

test('Boneyard pause holds the complete world and only its owner can resume', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  const loadedA = nextMessage(first.socket, (message) => message.type === 'server-boneyard-loaded')
  const loadedB = nextMessage(second.socket, (message) => message.type === 'server-boneyard-loaded')
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await Promise.all([loadedA, loadedB])
  assert.equal(host.state().world.kind, 'boneyard')

  const pausedA = nextMessage(first.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause !== null
  ))
  const pausedB = nextMessage(second.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause !== null
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-gameplay-pause',
    paused: true,
    source: 'skill-book',
  }))
  const [pauseA, pauseB] = await Promise.all([pausedA, pausedB])
  assert.equal(pauseA.type, 'server-gameplay-pause')
  assert.equal(pauseB.type, 'server-gameplay-pause')
  assert.deepEqual(pauseA.pause, {
    ownerDisplayName: SECOND_CHARACTER.displayName,
    ownerPlayerId: second.welcome.playerId,
    source: 'skill-book',
  })

  const heldTick = host.state().tick
  const heldWorld = JSON.stringify(host.state().world)
  const heldPlayers = JSON.stringify(gameSimulationPlayerRecords(host.state()))
  await new Promise((resolve) => setTimeout(resolve, 100))
  assert.equal(host.state().tick, heldTick)
  assert.equal(JSON.stringify(host.state().world), heldWorld)
  assert.equal(JSON.stringify(gameSimulationPlayerRecords(host.state())), heldPlayers)

  first.socket.send(encodeGameMessage({ type: 'client-gameplay-pause', paused: false }))
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.equal(host.state().tick, heldTick)

  const releasedA = nextMessage(first.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause === null
  ))
  const releasedB = nextMessage(second.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause === null
  ))
  second.socket.send(encodeGameMessage({ type: 'client-gameplay-pause', paused: false }))
  await Promise.all([releasedA, releasedB])
  assert.ok(host.state().tick - heldTick <= 10, 'Boneyard release must not replay paused wall time')
  await waitFor(() => host.state().tick > heldTick)
})

test('shared Hub activity is replicated while every resident and the Hub clock stay live', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_HUB_AUTHENTICATION,
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'ticket-first', FIRST_CHARACTER)
  const second = await join(host.address.url, 'ticket-second', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  const pauseMessages: ServerGameMessage[] = []
  const observePause = (data: WebSocket.RawData) => {
    const message = decodeServerGameMessage(data.toString())
    if (message.type === 'server-gameplay-pause') pauseMessages.push(message)
  }
  second.socket.on('message', observePause)
  context.after(() => second.socket.off('message', observePause))

  const occupied = nextMessage(second.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.world.kind === 'hub'
    && message.snapshot.world.participants[first.welcome.playerId]?.activity === 'occupied'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-hub-activity',
    activity: 'occupied',
  }))
  await occupied

  const liveTick = host.state().tick
  first.socket.send(encodeGameMessage({
    type: 'client-gameplay-pause',
    paused: true,
    source: 'inventory',
  }))
  await new Promise((resolve) => setTimeout(resolve, 100))
  assert.ok(host.state().tick > liveTick)
  assert.deepEqual(pauseMessages, [])

  const cleared = nextMessage(second.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.world.kind === 'hub'
    && message.snapshot.world.participants[first.welcome.playerId]?.activity === null
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-hub-activity',
    activity: null,
  }))
  await cleared
})

test('game host routes global Hub shortcuts and rejects stale inventory commands without disconnecting', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const playerId = client.welcome.playerId
  const initial = getPlayerEconomy(host.state(), playerId)
  const stockItemId = initial.fomentiusStock[0]!.id

  const reconciled = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].economy.revision === initial.revision + 1
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-hub-action',
    action: { type: 'buy-fomentius', itemId: stockItemId },
  }))
  const snapshot = await reconciled
  assert.equal(snapshot.type, 'server-snapshot')
  assert.equal(snapshot.snapshot.players[playerId].economy.gold, 350)

  const rejected = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].economy.revision === initial.revision + 2
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-hub-action',
    action: { type: 'consume', itemId: 999_999 },
  }))
  const rejectedSnapshot = await rejected
  assert.equal(rejectedSnapshot.type, 'server-snapshot')
  assert.deepEqual(rejectedSnapshot.snapshot.players[playerId].economy.actionFeedback, {
    accepted: false,
    action: 'consume',
    dowsingPitch: null,
    reason: 'item-not-found',
    sequence: 2,
    transferDirection: null,
    transferGesture: null,
    unforgeOutcome: null,
  })

  const pong = nextMessage(client.socket, (message) => (
    message.type === 'server-pong' && message.nonce === 73
  ))
  client.socket.send(encodeGameMessage({ type: 'client-ping', nonce: 73 }))
  assert.deepEqual(await pong, { type: 'server-pong', nonce: 73 })
})

test('game host authoritatively binds and replicates a native primary quickbar entry', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const playerId = client.welcome.playerId
  const bound = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].progression.skillQuickbar[7] === 8
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-skill-quickbar-bind',
    skillId: 8,
    slot: 7,
  }))
  const snapshot = await bound
  assert.equal(snapshot.type, 'server-snapshot')
  assert.deepEqual(snapshot.snapshot.players[playerId].progression.skillQuickbar, [
    11, null, null, null, null, null, null, 8,
  ])
})

test('game host pauses a leveling player and authoritatively books the offered skill', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    initialPlayerExperience: 100,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())

  const playerId = client.welcome.playerId
  const initial = client.welcome.snapshot.players[playerId]
  const offer = initial.progression.pendingOffer
  assert.equal(initial.progression.level, 2)
  assert.equal(initial.progression.experience, 100)
  assert.equal(offer?.level, 2)
  assert.equal(offer?.options.length, 3)
  assert.ok(offer)
  assert.deepEqual(client.welcome.snapshot.levelUpBarrier?.pendingPlayerIds, [playerId])

  let gameplayPauseMessages = 0
  const observePause = (data: WebSocket.RawData) => {
    if (decodeServerGameMessage(data.toString()).type === 'server-gameplay-pause') {
      gameplayPauseMessages += 1
    }
  }
  client.socket.on('message', observePause)
  client.socket.send(encodeGameMessage({
    type: 'client-gameplay-pause',
    paused: true,
    source: 'pause-menu',
  }))
  await new Promise((resolve) => setTimeout(resolve, 25))
  client.socket.off('message', observePause)
  assert.equal(gameplayPauseMessages, 0)

  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 1, y: 0 }),
    sequence: 1,
    targetTick: client.welcome.snapshot.tick + 1,
  }))
  const paused = await nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.acknowledgedInputSequence === 1
  ))
  assert.equal(paused.type, 'server-snapshot')
  assert.deepEqual(paused.snapshot.players[playerId].position, initial.position)
  assert.deepEqual(paused.snapshot.players[playerId].velocity, { x: 0, y: 0 })

  const choiceIndex = 0
  const skillId = offer.options[choiceIndex]!.skillId
  const previousRank = initial.progression.learnedSkills
    .find(([learnedSkillId]) => learnedSkillId === skillId)?.[1] ?? 0
  const selectedSnapshot = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.levelUpBarrier === null
    && message.snapshot.players[playerId].progression.pendingOffer === null
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-select-skill',
    choiceIndex,
    offerSequence: offer.sequence,
    skillId,
  }))
  const selected = await selectedSnapshot
  assert.equal(selected.type, 'server-snapshot')
  const booked = selected.snapshot.players[playerId].progression
  assert.equal(booked.level, 2)
  assert.equal(booked.experience, 100)
  assert.equal(selected.snapshot.levelUpBarrier, null)
  assert.deepEqual(
    booked.learnedSkills.find(([learnedSkillId]) => learnedSkillId === skillId),
    [skillId, previousRank + 1, previousRank + 1],
  )
})

test('game host validates and broadcasts the complete Sorceror action sequence', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const playerId = client.welcome.playerId

  const current = host.state()
  const withCharm = {
    ...current,
    playerEntities: replacePlayerEconomy(current.playerEntities, playerId, {
      ...getPlayerEconomy(current, playerId),
      ownedPerkSelectors: [17],
    }),
  }
  Object.assign(current, grantGameSimulationPlayerExperience(withCharm, playerId, 300))
  const firstOffer = getPlayerProgression(host.state(), playerId).pendingOffer!

  const rerolledSnapshot = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].progression.pendingOffer !== null
    && message.snapshot.players[playerId].progression.pendingOffer.sequence !== firstOffer.sequence
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-level-up-action',
    action: 'reroll',
    offerSequence: firstOffer.sequence,
  }))
  const rerolled = await rerolledSnapshot
  assert.equal(rerolled.type, 'server-snapshot')
  assert.equal(rerolled.snapshot.players[playerId].progression.sorcerorsCharmAvailable, false)
  const rerolledOffer = rerolled.snapshot.players[playerId].progression.pendingOffer!

  const selectedSnapshot = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].progression.pendingOffer !== null
    && message.snapshot.players[playerId].progression.pendingOffer.sequence !== rerolledOffer.sequence
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-select-skill',
    choiceIndex: 0,
    offerSequence: rerolledOffer.sequence,
    skillId: rerolledOffer.options[0]!.skillId,
  }))
  const selected = await selectedSnapshot
  assert.equal(selected.type, 'server-snapshot')
  assert.equal(selected.snapshot.players[playerId].progression.sorcerorsCharmAvailable, true)
  const saveOffer = selected.snapshot.players[playerId].progression.pendingOffer!

  const savedSnapshot = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].progression.deferredSkillChoices === 1
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-level-up-action',
    action: 'save',
    offerSequence: saveOffer.sequence,
  }))
  const saved = await savedSnapshot
  assert.equal(saved.type, 'server-snapshot')
  assert.equal(saved.snapshot.players[playerId].progression.deferredSkillChoices, 1)
  assert.ok(saved.snapshot.players[playerId].progression.pendingOffer)
  assert.equal(saved.snapshot.players[playerId].progression.sorcerorsCharmAvailable, true)
})

test('game host authoritatively projects each player quickbar and rejects unlearned selections', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  const assigned = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[first.welcome.playerId].progression.skillQuickbar[7] === 11
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-skill-quickbar-bind',
    skillId: 11,
    slot: 7,
  }))
  const assignedSnapshot = await assigned
  assert.equal(assignedSnapshot.type, 'server-snapshot')
  assert.deepEqual(
    assignedSnapshot.snapshot.players[first.welcome.playerId].progression.skillQuickbar,
    [11, null, null, null, null, null, null, 11],
  )
  assert.deepEqual(
    assignedSnapshot.snapshot.players[second.welcome.playerId].progression.skillQuickbar,
    [35, null, null, null, null, null, null, null],
  )

  const rejected = nextMessage(second.socket, (message) => message.type === 'server-disconnect')
  second.socket.send(encodeGameMessage({
    type: 'client-select-concentration',
    skillId: 57,
  }))
  assert.deepEqual(await rejected, {
    type: 'server-disconnect',
    code: 'invalid-message',
    reason: 'The concentration is unavailable.',
  })
})

test('Boneyard host authorizes HUD concentration replacement only for the addressed selector', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const playerId = client.welcome.playerId
  const state = host.state()
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const sourceBook = state.playerEntities.skillBooks[index]!
  const permanentRanks = [...sourceBook.permanentRanks]
  const effectiveRanks = [...sourceBook.effectiveRanks]
  for (const skillId of [57, 58, 59]) {
    permanentRanks[skillId] = 1
    effectiveRanks[skillId] = 1
  }
  const skillBooks = [...state.playerEntities.skillBooks]
  skillBooks[index] = {
    ...sourceBook,
    effectiveRanks,
    learnedSkillOrder: [...sourceBook.learnedSkillOrder, 57, 58, 59],
    permanentRanks,
  }
  const economy = getPlayerEconomy(state, playerId)
  Object.assign(state, {
    ...state,
    playerEntities: replacePlayerEconomy({
      ...state.playerEntities,
      skillBooks,
    }, playerId, {
      ...economy,
      ownedPerkSelectors: [...new Set([...economy.ownedPerkSelectors, 21])],
    }),
  })

  const loaded = nextMessage(client.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await loaded
  assert.equal(host.state().world.kind, 'boneyard')

  const skillBookPause = nextMessage(client.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause?.source === 'skill-book'
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-gameplay-pause',
    paused: true,
    source: 'skill-book',
  }))
  await skillBookPause
  client.socket.send(encodeGameMessage({
    type: 'client-select-concentration-slot',
    skillId: 57,
    slot: 0,
  }))

  const selectorPause = nextMessage(client.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause?.source === 'skill-selector'
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-gameplay-pause',
    paused: true,
    source: 'skill-selector',
  }))
  await selectorPause
  assert.equal(host.state().playerEntities.skillRuntimes[index]!.concentrationSkillIdA, null)

  for (const [skillId, slot, expected] of [
    [57, 0, [57, null]],
    [58, 1, [57, 58]],
    [59, 0, [59, 58]],
  ] as const) {
    const selected = nextMessage(client.socket, (message) => (
      message.type === 'server-snapshot'
      && message.snapshot.players[playerId].progression.concentrationSkillIds[slot] === skillId
    ))
    client.socket.send(encodeGameMessage({
      type: 'client-select-concentration-slot',
      skillId,
      slot,
    }))
    await selected
    const runtime = host.state().playerEntities.skillRuntimes[index]!
    assert.deepEqual([runtime.concentrationSkillIdA, runtime.concentrationSkillIdB], expected)
  }

  Object.assign(host.state().playerEntities.progressions[index]!, {
    mindChugTicksRemaining: 10,
  })
  const rejected = nextMessage(client.socket, (message) => message.type === 'server-disconnect')
  client.socket.send(encodeGameMessage({
    type: 'client-select-concentration-slot',
    skillId: 57,
    slot: 0,
  }))
  assert.deepEqual(await rejected, {
    type: 'server-disconnect',
    code: 'invalid-message',
    reason: 'The concentration is unavailable.',
  })
})

test('game host accepts an empty deterministic Hub fixture factory', async (context) => {
  let factoryCalls = 0
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    createSimulation: () => {
      factoryCalls += 1
      return createGameSimulation({}, {
        hubStudentPopulation: createHubStudentFixturePopulation({
          count: 32,
          seed: 0x12345678,
        }),
      })
    },
    snapshotRate: 100,
  })
  context.after(() => host.close())
  assert.equal(factoryCalls, 1)
  const initialState = host.state()
  assert.equal(initialState.world.kind, 'hub')
  if (initialState.world.kind !== 'hub') throw new Error('expected Hub')
  assert.equal(initialState.world.studentPopulation.store.size, 32)

  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  assert.equal(client.welcome.snapshot.world.kind, 'hub')
  if (client.welcome.snapshot.world.kind !== 'hub') throw new Error('expected Hub snapshot')
  assert.equal(client.welcome.snapshot.world.students.length, 32)
})

test('game host rejects pre-populated initial simulation factories', async () => {
  await assert.rejects(() => startGameHost({
    authentication: SHARED_AUTHENTICATION,
    createSimulation: () => createGameSimulation(),
  }), /must start without player characters/)
})

test('game host enforces the declared snapshot cadence range', async () => {
  await assert.rejects(() => startGameHost({
    authentication: SHARED_AUTHENTICATION,
    snapshotRate: 0.5,
  }), /snapshotRate must be within 1/)
  await assert.rejects(() => startGameHost({
    authentication: SHARED_AUTHENTICATION,
    snapshotRate: 101,
  }), /snapshotRate must be within 1/)
})

test('game host echoes authenticated ping outside the snapshot loop', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 1 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())

  const pong = nextMessage(client.socket, (message) => (
    message.type === 'server-pong' && message.nonce === 41
  ))
  client.socket.send(encodeGameMessage({ type: 'client-ping', nonce: 41 }))
  assert.deepEqual(await pong, { type: 'server-pong', nonce: 41 })
})

test('game host drops an authenticated player that misses its transport heartbeat', async (context) => {
  const logs: GameServerLogEntry[] = []
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    heartbeatIntervalMs: 50,
    log: (entry) => logs.push(entry),
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER, false)
  context.after(() => closeSocket(client.socket))
  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    client.socket.once('close', (code, reason) => resolve({
      code,
      reason: reason.toString(),
    }))
  })

  assert.equal(host.playerCount(), 1)
  await waitFor(() => host.playerCount() === 0)
  assert.deepEqual(await closed, { code: 4000, reason: 'connection timed out' })
  assert.equal(client.socket.readyState, WebSocket.CLOSED)
  const disconnect = logs.find((entry) => entry.event === 'player.disconnected')
  assert.equal(disconnect?.details?.disconnectSource, 'heartbeat-timeout')
  assert.equal(disconnect?.details?.closeCode, 4000)
  assert.equal(disconnect?.details?.playerId, client.welcome.playerId)
})

test('game host records an abnormal player disconnect without inventing a cause', async (context) => {
  const logs: GameServerLogEntry[] = []
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    log: (entry) => logs.push(entry),
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)

  client.socket.terminate()
  await waitFor(() => host.playerCount() === 0)

  const disconnect = logs.find((entry) => entry.event === 'player.disconnected')
  assert.equal(disconnect?.level, 'warning')
  assert.equal(disconnect?.details?.disconnectSource, 'transport-lost')
  assert.equal(disconnect?.details?.closeCode, 1006)
  assert.equal(disconnect?.details?.closeReason, '')
})

test('game host tolerates one delayed transport pong before declaring the client dead', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    heartbeatIntervalMs: 50,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER, false)
  context.after(() => closeSocket(client.socket))
  client.socket.once('ping', () => {
    setTimeout(() => {
      if (client.socket.readyState === WebSocket.OPEN) client.socket.pong()
    }, 60)
  })

  await new Promise((resolve) => setTimeout(resolve, 170))
  assert.equal(host.playerCount(), 1)
  assert.equal(client.socket.readyState, WebSocket.OPEN)
})

test('game host sends a complete keyframe when a client requests recovery', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const first = await nextMessage(client.socket, (message) => message.type === 'server-snapshot')
  assert.equal(first.type, 'server-snapshot')
  client.socket.send(encodeGameMessage({
    type: 'client-snapshot-ack',
    requireKeyframe: true,
    sequence: first.sequence,
  }))
  const recovered = await nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'hub'
    && message.frame.world.entities.keyframe
  ))
  assert.equal(recovered.type, 'server-snapshot')
  assert.equal(recovered.frame.world.kind, 'hub')
  if (recovered.frame.world.kind !== 'hub') throw new Error('expected Hub frame')
  assert.equal(recovered.frame.world.entities.baselineSequence, 0)
  assert.equal(
    recovered.frame.world.entities.spawned.length,
    recovered.snapshot.world.kind === 'hub' ? recovered.snapshot.world.students.length : -1,
  )
})

test('game host reconnects a new character at the active world spawn', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())

  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  assert.deepEqual(first.welcome.snapshot.players[first.welcome.playerId].position, HUB_SPAWN)
  await closeSocket(first.socket)
  await waitFor(() => host.playerCount() === 0)

  const reconnected = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => reconnected.socket.close())
  assert.notEqual(reconnected.welcome.playerId, first.welcome.playerId)
  assert.deepEqual(
    reconnected.welcome.snapshot.players[reconnected.welcome.playerId].position,
    HUB_SPAWN,
  )
  assert.deepEqual(
    reconnected.welcome.snapshot.players[reconnected.welcome.playerId].config,
    SECOND_CHARACTER,
  )
})

test('game host rejects arbitrary origins and invalid bootstrap credentials', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION })
  context.after(() => host.close())

  await assert.rejects(() => openSocket(host.address.url, 'https://evil.example'))
  const socket = await openSocket(host.address.url)
  context.after(() => socket.close())
  socket.send(encodeGameMessage({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'wrong-secret',
    character: FIRST_CHARACTER,
  }))
  const message = await nextMessage(socket, (entry) => entry.type === 'server-disconnect')
  assert.deepEqual(message, {
    type: 'server-disconnect',
    code: 'authentication-failed',
    reason: 'The session credential is invalid.',
  })
})

test('game host is loopback-only by default and requires trusted proxy origins', async () => {
  await assert.rejects(() => startGameHost({
    authentication: SHARED_AUTHENTICATION,
    host: '0.0.0.0',
  }), /trusted secure proxy/)
  await assert.rejects(() => startGameHost({
    authentication: SHARED_AUTHENTICATION,
    host: '0.0.0.0',
    trustedProxy: true,
  }), /nonempty allowedOrigins/)
})

test('game host rejects intent targeting implausibly far-future ticks', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 1, y: 0 }),
    sequence: 1,
    targetTick: client.welcome.snapshot.tick + 1000,
  }))
  const message = await nextMessage(client.socket, (entry) => entry.type === 'server-disconnect')
  assert.equal(message.type, 'server-disconnect')
  assert.equal(message.code, 'invalid-message')
})

test('game host applies only the newest character input for a simulation tick', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const origin = client.welcome.snapshot.players[client.welcome.playerId].position
  const targetTick = client.welcome.snapshot.tick + 1
  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 1, y: 0 }),
    sequence: 1,
    targetTick,
  }))
  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 0, y: 1 }),
    sequence: 2,
    targetTick,
  }))
  const message = await nextMessage(client.socket, (entry) => (
    entry.type === 'server-snapshot' && entry.acknowledgedInputSequence === 2
  ))
  assert.equal(message.type, 'server-snapshot')
  const player = message.snapshot.players[client.welcome.playerId]
  assert.equal(player.position.x, origin.x)
  assert.ok(player.position.y > origin.y)
})

test('game host samples a press before a same-target-tick release', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const targetTick = client.welcome.snapshot.tick + 1
  const pressed = nextMessage(client.socket, (entry) => (
    entry.type === 'server-snapshot' && entry.acknowledgedInputSequence === 1
  ))
  const released = nextMessage(client.socket, (entry) => (
    entry.type === 'server-snapshot' && entry.acknowledgedInputSequence === 2
  ))

  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 0, y: 0 }, { x: 300, y: 400 }, true),
    sequence: 1,
    targetTick,
  }))
  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 0, y: 0 }, { x: 300, y: 400 }),
    sequence: 2,
    targetTick,
  }))

  const [pressedSnapshot, releasedSnapshot] = await Promise.all([pressed, released])
  assert.equal(pressedSnapshot.type, 'server-snapshot')
  assert.equal(releasedSnapshot.type, 'server-snapshot')
  assert.equal(releasedSnapshot.snapshot.tick, pressedSnapshot.snapshot.tick + 1)
})

test('host starts one exact random Boneyard for every connected client', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  assert.equal(first.welcome.snapshot.hostPlayerId, first.welcome.playerId)
  assert.deepEqual(first.welcome.boneyards, [
    { id: 'default-random', name: 'Random Boneyard', source: 'default' },
  ])

  second.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(host.loadedBoneyard(), null)

  const firstLoaded = nextMessage(first.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  const secondLoaded = nextMessage(second.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  const firstSnapshot = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot' && message.snapshot.world.kind === 'boneyard'
  ))
  const secondSnapshot = nextMessage(second.socket, (message) => (
    message.type === 'server-snapshot' && message.snapshot.world.kind === 'boneyard'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))

  const [loadedA, loadedB, snapshotA, snapshotB] = await Promise.all([
    firstLoaded,
    secondLoaded,
    firstSnapshot,
    secondSnapshot,
  ])
  assert.equal(loadedA.type, 'server-boneyard-loaded')
  assert.equal(loadedB.type, 'server-boneyard-loaded')
  assert.equal(snapshotA.type, 'server-snapshot')
  assert.equal(snapshotB.type, 'server-snapshot')
  assert.equal(loadedA.boneyard.runId, loadedB.boneyard.runId)
  assert.equal(loadedA.boneyard.geometrySha256, loadedB.boneyard.geometrySha256)
  assert.equal(snapshotA.snapshot.world.kind, 'boneyard')
  assert.equal(snapshotB.snapshot.world.kind, 'boneyard')
  if (snapshotA.snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  if (snapshotB.snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(snapshotA.snapshot.world.runId, loadedA.boneyard.runId)
  assert.equal(snapshotB.snapshot.world.runId, loadedA.boneyard.runId)
  assert.ok(snapshotA.snapshot.world.gateLeaves.length >= 2)
  assert.deepEqual(
    snapshotA.snapshot.world.gateLeaves,
    snapshotB.snapshot.world.gateLeaves,
  )
  assert.deepEqual(
    snapshotA.snapshot.players[first.welcome.playerId].position,
    { x: loadedA.boneyard.scene.spawn.x, y: loadedA.boneyard.scene.spawn.y },
  )
  assert.equal(loadedA.boneyard.scene.solomonDig?.frameProgram.length, 29)
})

test('host admits one fresh solo player into the hidden stock Tutorial and checkpoints it', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  assert.deepEqual(client.welcome.boneyards, [
    { id: 'default-random', name: 'Random Boneyard', source: 'default' },
  ])

  const loaded = nextMessage(client.socket, message => message.type === 'server-boneyard-loaded')
  const snapshot = nextMessage(client.socket, message => (
    message.type === 'server-snapshot'
    && message.snapshot.world.kind === 'boneyard'
    && message.snapshot.world.tutorial !== null
  ))
  const checkpoint = nextMessage(client.socket, message => (
    message.type === 'server-save-checkpoint'
    && JSON.parse(message.save).continuation?.simulation?.world?.tutorial !== undefined
  ))
  client.socket.send(encodeGameMessage({ type: 'client-start-tutorial' }))

  const [loadedMessage, snapshotMessage, checkpointMessage] = await Promise.all([
    loaded,
    snapshot,
    checkpoint,
  ])
  assert.equal(loadedMessage.type, 'server-boneyard-loaded')
  assert.equal(loadedMessage.boneyard.choice.id, 'stock-tutorial')
  assert.equal(snapshotMessage.type, 'server-snapshot')
  assert.equal(snapshotMessage.snapshot.world.kind, 'boneyard')
  if (snapshotMessage.snapshot.world.kind !== 'boneyard') throw new Error('expected Tutorial')
  assert.ok(snapshotMessage.snapshot.world.tutorial)
  assert.equal(snapshotMessage.snapshot.world.waves, null)
  assert.equal(checkpointMessage.type, 'server-save-checkpoint')
  const saved = JSON.parse(checkpointMessage.save)
  assert.equal(saved.schemaVersion, 7)
  assert.equal(saved.profile.economy.tutorialPending, true)
  assert.equal(saved.continuation.simulation.world.tutorial.stage, 0)
})

test('host rejects a Tutorial start after the fresh-profile pending fact clears', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const playerId = client.welcome.playerId
  const state = host.state()
  state.playerEntities = replacePlayerEconomy(state.playerEntities, playerId, {
    ...getPlayerEconomy(state, playerId),
    tutorialPending: false,
  })
  const rejected = nextMessage(client.socket, message => message.type === 'server-disconnect')
  client.socket.send(encodeGameMessage({ type: 'client-start-tutorial' }))
  assert.deepEqual(await rejected, {
    code: 'invalid-message',
    reason: 'The stock Tutorial is available only to a fresh profile.',
    type: 'server-disconnect',
  })
})

test('host accepts constructor-owned Boneyard entropy without reusing it as run identity', async (context) => {
  const seedBytes = Buffer.alloc(16, 0x5a)
  let seedRequests = 0
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    createBoneyardSeedBytes: () => {
      seedRequests += 1
      return seedBytes
    },
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const loaded = nextMessage(client.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))

  client.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))

  const message = await loaded
  assert.equal(message.type, 'server-boneyard-loaded')
  assert.equal(seedRequests, 1)
  assert.equal(message.boneyard.seed, seedBytes.toString('hex'))
  assert.match(message.boneyard.runId, /^[0-9a-f]{32}$/)
  assert.notEqual(message.boneyard.runId, message.boneyard.seed)
})

test('standalone host resets its run after the final client leaves', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    resetWhenEmpty: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const firstLoaded = nextMessage(first.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const firstRun = await firstLoaded
  assert.equal(firstRun.type, 'server-boneyard-loaded')

  await closeSocket(first.socket)
  await waitFor(() => host.loadedBoneyard() === null)
  assert.equal(host.hostPlayerId(), null)
  assert.equal(host.state().world.kind, 'hub')
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(host.state().tick, 0)

  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => second.socket.close())
  assert.equal(second.welcome.playerId, 'player-1')
  assert.equal(second.welcome.snapshot.tick, 0)
  assert.equal(second.welcome.snapshot.world.kind, 'hub')
  const secondLoaded = nextMessage(second.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const secondRun = await secondLoaded
  assert.equal(secondRun.type, 'server-boneyard-loaded')
  assert.notEqual(secondRun.boneyard.runId, firstRun.boneyard.runId)
  assert.notEqual(secondRun.boneyard.seed, firstRun.boneyard.seed)
})

test('persistent host retains its loaded run across an empty interval', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const loaded = nextMessage(first.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const firstRun = await loaded
  assert.equal(firstRun.type, 'server-boneyard-loaded')
  await closeSocket(first.socket)
  await waitFor(() => host.playerCount() === 0)
  const emptyTick = host.state().tick
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.ok(host.state().tick > emptyTick)

  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => second.socket.close())
  assert.equal(second.welcome.snapshot.world.kind, 'boneyard')
  if (second.welcome.snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(second.welcome.snapshot.world.runId, firstRun.boneyard.runId)
  assert.equal(host.loadedBoneyard()?.runId, firstRun.boneyard.runId)
})

test('host emits an owner checkpoint and revives it before a fresh welcome', async (context) => {
  const firstHost = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => firstHost.close())
  const firstSocket = await openSocket(firstHost.address.url)
  context.after(() => firstSocket.close())
  const firstWelcome = nextMessage(firstSocket, (message) => message.type === 'server-welcome')
  const firstCheckpoint = nextMessage(
    firstSocket,
    (message) => message.type === 'server-save-checkpoint' && message.save !== null,
  )
  firstSocket.send(encodeGameMessage({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'test-secret',
    character: FIRST_CHARACTER,
  }))
  const [welcomed, checkpoint] = await Promise.all([firstWelcome, firstCheckpoint])
  assert.equal(welcomed.type, 'server-welcome')
  assert.equal(checkpoint.type, 'server-save-checkpoint')
  assert.equal(checkpoint.reason, 'progress')
  assert.ok(checkpoint.save)

  const secondHost = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => secondHost.close())
  await waitFor(() => secondHost.state().tick > 0)
  const secondSocket = await openSocket(secondHost.address.url)
  context.after(() => secondSocket.close())
  const resumedMessage = nextMessage(secondSocket, (message) => (
    message.type === 'server-welcome' || message.type === 'server-disconnect'
  ))
  secondSocket.send(encodeGameMessage({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'test-secret',
    character: FIRST_CHARACTER,
    save: checkpoint.save,
    saveIntent: 'resume',
  }))
  const resumed = await resumedMessage
  assert.equal(resumed.type, 'server-welcome', JSON.stringify(resumed))
  assert.equal(resumed.playerId, welcomed.playerId)
  assert.equal(resumed.snapshot.tick, welcomed.snapshot.tick)
  assert.deepEqual(resumed.snapshot.players[resumed.playerId].config, FIRST_CHARACTER)
  assert.equal(resumed.snapshot.world.kind, 'hub')
})

test('a valid same-tab resume replaces only the live Tutorial transport and rotates its token', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_HUB_AUTHENTICATION,
    sessionKind: 'global-hub',
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'ticket-first', FIRST_CHARACTER)
  context.after(() => first.socket.close())
  assert.doesNotMatch(first.welcome.resumeToken, /^reserved-/)
  assert.ok(first.welcome.resumeToken.length >= 43)

  const loadedMessage = nextMessage(first.socket, message => (
    message.type === 'server-boneyard-loaded'
  ))
  first.socket.send(encodeGameMessage({ type: 'client-start-tutorial' }))
  const loaded = await loadedMessage
  assert.equal(loaded.type, 'server-boneyard-loaded')
  await waitFor(() => host.playerState(first.welcome.playerId)?.world.kind === 'boneyard')
  const savedState = host.playerState(first.welcome.playerId)
  assert.ok(savedState)
  const save = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: loaded.boneyard,
    mods: [],
    modState: {},
    playerId: first.welcome.playerId,
    state: savedState,
  })
  const savedTick = savedState.tick
  await waitFor(() => (host.playerState(first.welcome.playerId)?.tick ?? 0) > savedTick)

  const rejectedSocket = await openSocket(host.address.url)
  context.after(() => rejectedSocket.close())
  const rejectedMessage = nextMessage(rejectedSocket, message => (
    message.type === 'server-disconnect'
  ))
  rejectedSocket.send(encodeGameMessage({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'ticket-rejected',
    character: FIRST_CHARACTER,
    resumeToken: 'wrong-resume-token',
    save,
    saveIntent: 'resume',
  }))
  const rejected = await rejectedMessage
  assert.equal(rejected.type, 'server-disconnect')
  assert.match(rejected.reason, /already active in another browser/i)
  assert.equal(first.socket.readyState, WebSocket.OPEN)
  assert.equal(host.playerCount(), 1)

  const firstClosed = socketClose(first.socket)
  const replacementSocket = await openSocket(host.address.url)
  context.after(() => replacementSocket.close())
  const replacementMessage = nextMessage(replacementSocket, message => (
    message.type === 'server-welcome'
  ))
  replacementSocket.send(encodeGameMessage({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'ticket-replacement',
    character: FIRST_CHARACTER,
    resumeToken: first.welcome.resumeToken,
    save,
    saveIntent: 'resume',
  }))
  const replacement = await replacementMessage
  assert.equal(replacement.type, 'server-welcome')
  assert.equal(replacement.playerId, first.welcome.playerId)
  assert.notEqual(replacement.resumeToken, first.welcome.resumeToken)
  assert.equal(replacement.snapshot.world.kind, 'boneyard')
  assert.equal(replacement.snapshot.world.kind === 'boneyard'
    ? replacement.snapshot.world.runId
    : null, loaded.boneyard.runId)
  assert.ok(replacement.snapshot.tick > savedTick, 'live authority must not roll back to the save')
  assert.deepEqual(await firstClosed, {
    code: 4002,
    reason: 'wizard resumed in another browser',
  })
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(host.playerCount(), 1)
  assert.equal(host.playerState(replacement.playerId)?.world.kind, 'boneyard')
})

test('host starts a fresh character from the durable profile without reviving its old run', async (context) => {
  const source = createGameSimulation({ 'saved-owner': FIRST_CHARACTER })
  const economy = source.playerEntities.economies[0]!
  const profiledSource = {
    ...source,
    playerEntities: {
      ...source.playerEntities,
      economies: [{
        ...economy,
        gold: 12_345,
        unforgeBonuses: { ...economy.unforgeBonuses, maximumHealth: 20 },
      }],
    },
  }
  const profile = createGameProfileSaveDocument({
    integrity: 'global-clean',
    mods: [],
    modState: {},
    playerId: 'saved-owner',
    state: profiledSource,
  })
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const socket = await openSocket(host.address.url)
  context.after(() => socket.close())
  const welcomed = nextMessage(socket, message => message.type === 'server-welcome')
  socket.send(encodeGameMessage({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'test-secret',
    character: SECOND_CHARACTER,
    save: profile,
    saveIntent: 'new-game',
  }))

  const welcome = await welcomed
  assert.equal(welcome.type, 'server-welcome')
  assert.notEqual(welcome.playerId, 'saved-owner')
  assert.deepEqual(welcome.snapshot.players[welcome.playerId]?.config, SECOND_CHARACTER)
  assert.equal(welcome.snapshot.players[welcome.playerId]?.economy.gold, 12_345)
  assert.equal(welcome.snapshot.players[welcome.playerId]?.progression.maximumHealth, 70)
  assert.equal(welcome.snapshot.run.phase, 'hub')
  assert.equal(welcome.snapshot.run.runId, null)
})

test('new-game intent retires an active wizard and scavenges carried equipment', async (context) => {
  const active = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'saved-owner',
    state: createGameSimulation({ 'saved-owner': FIRST_CHARACTER }),
  })
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const socket = await openSocket(host.address.url)
  context.after(() => socket.close())
  const welcomed = nextMessage(socket, message => message.type === 'server-welcome')
  socket.send(encodeGameMessage({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'test-secret',
    character: SECOND_CHARACTER,
    save: active,
    saveIntent: 'new-game',
  }))

  const welcome = await welcomed
  assert.equal(welcome.type, 'server-welcome')
  const economy = welcome.snapshot.players[welcome.playerId]?.economy
  assert.equal(economy?.gold, 500)
  assert.equal(economy?.storage.at(-1)?.kind, 'sack')
  assert.deepEqual(
    economy?.storage.at(-1)?.contents?.map(({ name }) => name).sort(),
    ['Hat', 'Health Potion', 'Mana Potion', 'Robe', 'Staff'],
  )
})

test('host forces one correlated owner checkpoint before an explicit leave', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const leaving = leaveSaveMessages(client.socket, 7)

  client.socket.send(encodeGameMessage({
    type: 'client-save-before-leave',
    requestId: 7,
  }))
  const result = await leaving
  assert.equal(result.response.checkpointSequence, result.checkpoint.sequence)
  assert.equal(result.response.requestId, 7)
  assert.equal(client.socket.readyState, WebSocket.OPEN)
  assert.equal(
    (JSON.parse(result.checkpoint.save) as {
      continuation: { summary: { playerId: string } }
    }).continuation.summary.playerId,
    client.welcome.playerId,
  )

  const closed = socketClose(client.socket)
  client.socket.send(encodeGameMessage({ type: 'client-disconnect' }))
  assert.deepEqual(await closed, { code: 1000, reason: 'client disconnect' })
})

test('thirty-second autosave publishes owner-only saves to a party leader and guest', async (context) => {
  assert.equal(GAME_SAVE_AUTOSAVE_INTERVAL_TICKS, 3_000)
  const host = await startGameHost({
    authentication: SHARED_HUB_AUTHENTICATION,
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const leader = await join(host.address.url, 'ticket-leader', FIRST_CHARACTER)
  const guest = await join(host.address.url, 'ticket-guest', SECOND_CHARACTER)
  context.after(() => leader.socket.close())
  context.after(() => guest.socket.close())

  const invited = nextMessage(guest.socket, message => (
    message.type === 'server-party-state' && message.state.invitations.length === 1
  ))
  leader.socket.send(encodeGameMessage({
    type: 'client-party-invite',
    targetPlayerId: guest.welcome.playerId,
  }))
  const invitation = await invited
  assert.equal(invitation.type, 'server-party-state')
  const grouped = nextMessage(guest.socket, message => (
    message.type === 'server-party-state' && message.state.party.memberPlayerIds.length === 2
  ))
  guest.socket.send(encodeGameMessage({
    type: 'client-party-accept',
    invitationId: invitation.state.invitations[0]!.id,
  }))
  await grouped

  Object.assign(host.state(), { tick: GAME_SAVE_AUTOSAVE_INTERVAL_TICKS - 1 })
  const leaderSave = nextMessage(leader.socket, message => (
    message.type === 'server-save-checkpoint'
    && message.reason === 'progress'
    && JSON.parse(message.save).continuation.summary.savedAtTick
      === GAME_SAVE_AUTOSAVE_INTERVAL_TICKS
  ))
  const guestSave = nextMessage(guest.socket, message => (
    message.type === 'server-save-checkpoint'
    && message.reason === 'progress'
    && JSON.parse(message.save).continuation.summary.savedAtTick
      === GAME_SAVE_AUTOSAVE_INTERVAL_TICKS
  ))
  const [leaderCheckpoint, guestCheckpoint] = await Promise.all([leaderSave, guestSave])
  assert.equal(leaderCheckpoint.type, 'server-save-checkpoint')
  assert.equal(guestCheckpoint.type, 'server-save-checkpoint')
  assert.equal(
    JSON.parse(leaderCheckpoint.save).continuation.summary.playerId,
    leader.welcome.playerId,
  )
  assert.equal(
    JSON.parse(guestCheckpoint.save).continuation.summary.playerId,
    guest.welcome.playerId,
  )
})

test('deployment restart checkpoints every connected private-session player before closing', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  const firstMessages = deploymentMessages(first.socket)
  const secondMessages = deploymentMessages(second.socket)
  const firstClosed = socketClose(first.socket)
  const secondClosed = socketClose(second.socket)
  const targetRevision = 'a'.repeat(40)

  const restarting = host.restartForDeployment(targetRevision, 1_000)
  const [firstDeployment, secondDeployment] = await Promise.all([
    firstMessages,
    secondMessages,
  ])
  for (const deployment of [firstDeployment, secondDeployment]) {
    assert.equal(deployment.restart.checkpointSequence, deployment.checkpoint.sequence)
    assert.equal(deployment.restart.targetRevision, targetRevision)
  }
  assert.equal(
    (JSON.parse(firstDeployment.checkpoint.save) as {
      continuation: { summary: { playerId: string } }
    }).continuation.summary.playerId,
    first.welcome.playerId,
  )
  assert.equal(
    (JSON.parse(secondDeployment.checkpoint.save) as {
      continuation: { summary: { playerId: string } }
    }).continuation.summary.playerId,
    second.welcome.playerId,
  )
  for (const [socket, deployment] of [
    [first.socket, firstDeployment],
    [second.socket, secondDeployment],
  ] as const) {
    socket.send(encodeGameMessage({
      type: 'client-deployment-ready',
      checkpointSequence: deployment.restart.checkpointSequence,
      targetRevision,
    }))
  }

  assert.deepEqual(await restarting, {
    players: 2,
    savedPlayers: 2,
    unacknowledgedPlayers: 0,
  })
  assert.deepEqual(await firstClosed, { code: 1012, reason: 'game updating' })
  assert.deepEqual(await secondClosed, { code: 1012, reason: 'game updating' })
})

test('host rejects an unconfirmed save mod mismatch and accepts an explicit continuation', async (context) => {
  const savedMod = {
    contentSha256: 'a'.repeat(64),
    id: 'tests.saved-mod',
    version: '1.0.0',
  }
  const activeMod = {
    contentSha256: 'b'.repeat(64),
    id: 'tests.active-mod',
    version: '2.0.0',
  }
  const save = createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: null,
    mods: [savedMod],
    modState: { 'tests.saved-mod': { retained: true } },
    playerId: 'saved-owner',
    state: createGameSimulation({ 'saved-owner': FIRST_CHARACTER }),
  })
  const options = {
    authentication: SHARED_AUTHENTICATION,
    content: { manifestSha256: 'c'.repeat(64), mods: [activeMod] },
    snapshotRate: 100,
  } as const

  const rejectingHost = await startGameHost(options)
  context.after(() => rejectingHost.close())
  await waitFor(() => rejectingHost.state().tick > 0)
  const rejectedSocket = await openSocket(rejectingHost.address.url)
  context.after(() => rejectedSocket.close())
  const rejectedMessage = nextMessage(
    rejectedSocket,
    message => message.type === 'server-disconnect',
  )
  rejectedSocket.send(encodeGameMessage({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'test-secret',
    character: FIRST_CHARACTER,
    save,
    saveIntent: 'resume',
  }))
  const rejected = await rejectedMessage
  assert.equal(rejected.type, 'server-disconnect')
  assert.match(rejected.reason, /Confirm the mismatch/)

  const continuingHost = await startGameHost(options)
  context.after(() => continuingHost.close())
  const continuedSocket = await openSocket(continuingHost.address.url)
  context.after(() => continuedSocket.close())
  const continuedMessage = nextMessage(
    continuedSocket,
    message => message.type === 'server-welcome',
  )
  continuedSocket.send(encodeGameMessage({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    allowModMismatch: true,
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'test-secret',
    character: FIRST_CHARACTER,
    save,
    saveIntent: 'resume',
  }))
  const continued = await continuedMessage
  assert.equal(continued.type, 'server-welcome')
  assert.equal(continued.playerId, 'saved-owner')
  assert.deepEqual(continued.content.mods, [activeMod])
  assert.equal(continued.snapshot.world.kind, 'hub')
})

test('host retains the profile and removes only the continuation on Game Over', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const active = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'active'
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await active

  const profiled = nextMessage(client.socket, (message) => (
    message.type === 'server-save-checkpoint'
    && message.reason === 'game-over'
  ))
  Object.assign(host.state().playerEntities.progressions[0]!, {
    lifeState: 'spectating',
  })
  const checkpoint = await profiled
  assert.equal(checkpoint.type, 'server-save-checkpoint')
  assert.equal(checkpoint.reason, 'game-over')
  const profile = restoreGameSaveProfile(checkpoint.save)
  assert.equal(profile.continuation, null)
  assert.equal(profile.economy.gold, 500)
  assert.equal(profile.economy.storage.at(-1)?.kind, 'sack')
  assert.equal(profile.economy.storage.at(-1)?.contents?.length, 5)
  assert.equal(host.state().run.phase, 'game-over')

  let laterProgress = 0
  const countProgress = (data: WebSocket.RawData) => {
    const message = decodeServerGameMessage(data.toString())
    if (message.type === 'server-save-checkpoint' && message.reason === 'progress') {
      laterProgress += 1
    }
  }
  client.socket.on('message', countProgress)
  await new Promise((resolve) => setTimeout(resolve, 100))
  client.socket.off('message', countProgress)
  assert.equal(laterProgress, 0)
})

test('host returns the same multiplayer session from Game Over through loadout to Hub', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  const loadedMessage = nextMessage(first.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  const activeMessage = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'active'
    && message.snapshot.world.kind === 'boneyard'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const [loaded, active] = await Promise.all([loadedMessage, activeMessage])
  assert.equal(loaded.type, 'server-boneyard-loaded')
  assert.equal(active.type, 'server-snapshot')
  const runId = loaded.boneyard.runId
  assert.equal(active.snapshot.run.runId, runId)

  const inputExitForFirst = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'game-over'
    && message.snapshot.run.gameOverExitKind === 'input'
    && message.snapshot.run.gameOverExitTicks === 1
  ))
  const inputExitForSecond = nextMessage(second.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'game-over'
    && message.snapshot.run.gameOverExitKind === 'input'
    && message.snapshot.run.gameOverExitTicks === 1
  ))
  const gameOverState = host.state()
  if (gameOverState.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  gameOverState.world = {
    ...gameOverState.world,
    hallOfFameRuns: Object.fromEntries(Object.entries(
      gameOverState.world.hallOfFameRuns,
    ).map(([playerId, hallRun]) => [playerId, {
      ...hallRun,
      elapsedTicks: 0,
      portraitHeadingIndex: 12,
      portraitScale: 0.925,
    }])),
  }
  Object.assign(host.state().run, {
    gameOverEventId: 1,
    gameOverTicks: GAME_OVER_INPUT_ACCEPT_TICK,
    nextGameOverEventId: 2,
    phase: 'game-over',
  })
  assert.equal(host.state().run.gameOverExitTicks, null)
  second.socket.send(encodeGameMessage({
    type: 'client-continue-game-over',
    eventId: 1,
    runId,
  }))
  const [exiting, exitingForSecond] = await Promise.all([
    inputExitForFirst,
    inputExitForSecond,
  ])
  assert.equal(exiting.type, 'server-snapshot')
  assert.equal(exitingForSecond.type, 'server-snapshot')
  assert.equal(exiting.snapshot.run.runId, runId)
  assert.equal(exiting.snapshot.run.gameOverEventId, 1)
  assert.equal(exitingForSecond.snapshot.run.gameOverEventId, 1)
  assert.ok(exiting.snapshot.run.gameOverTicks >= GAME_OVER_INPUT_ACCEPT_TICK)
  assert.equal(exiting.snapshot.world.kind, 'boneyard')
  assert.equal(host.loadedBoneyard()?.runId, runId)
  const blackMessage = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'game-over'
    && message.snapshot.run.gameOverExitTicks === GAME_OVER_INPUT_EXIT_FADE_TICKS
    && message.snapshot.world.kind === 'boneyard'
  ))
  const loadoutMessage = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'loadout'
    && message.snapshot.world.kind === 'hub'
  ))
  Object.assign(host.state().run, {
    gameOverExitKind: 'input',
    gameOverExitTicks: GAME_OVER_INPUT_EXIT_FADE_TICKS - 1,
    gameOverTicks:
      GAME_OVER_INPUT_ACCEPT_TICK
      + GAME_OVER_INPUT_EXIT_FADE_TICKS
      - 2,
  })
  const [black, loadout] = await Promise.all([blackMessage, loadoutMessage])
  assert.equal(black.type, 'server-snapshot')
  assert.equal(black.snapshot.world.kind, 'boneyard')
  assert.equal(loadout.type, 'server-snapshot')
  assert.equal(loadout.snapshot.run.lastCompletedRunId, runId)
  assert.ok(loadout.snapshot.players[first.welcome.playerId])
  assert.ok(loadout.snapshot.players[second.welcome.playerId])
  assert.equal(host.loadedBoneyard(), null)

  second.socket.send(encodeGameMessage({
    type: 'client-confirm-loadout',
    discipline: 'mind',
    element: 'water',
  }))
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(host.state().run.phase, 'loadout')

  const hubMessage = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'hub'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-confirm-loadout',
    discipline: 'body',
    element: 'air',
  }))
  const hub = await hubMessage
  assert.equal(hub.type, 'server-snapshot')
  assert.equal(hub.snapshot.run.lastCompletedRunId, runId)
  assert.equal(hub.snapshot.hostPlayerId, first.welcome.playerId)
  assert.ok(hub.snapshot.players[first.welcome.playerId])
  assert.ok(hub.snapshot.players[second.welcome.playerId])
  assert.deepEqual(hub.snapshot.players[first.welcome.playerId]?.config, {
    ...FIRST_CHARACTER,
    discipline: 'body',
    element: 'air',
  })
  assert.deepEqual(hub.snapshot.players[second.welcome.playerId]?.config, {
    ...SECOND_CHARACTER,
    discipline: 'mind',
    element: 'water',
  })

  const secondLoadedMessage = nextMessage(first.socket, (message) => (
    message.type === 'server-boneyard-loaded'
    && message.boneyard.runId !== runId
  ))
  const secondActiveMessage = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'active'
    && message.snapshot.run.runId !== runId
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const [secondLoaded, secondActive] = await Promise.all([
    secondLoadedMessage,
    secondActiveMessage,
  ])
  assert.equal(secondLoaded.type, 'server-boneyard-loaded')
  assert.equal(secondActive.type, 'server-snapshot')
  assert.notEqual(secondLoaded.boneyard.runId, runId)
  assert.equal(secondActive.snapshot.run.lastCompletedRunId, runId)
  assert.equal(secondActive.snapshot.run.nextGameOverEventId, 2)
  assert.equal(host.playerCount(), 2)
})

test('host signs an account-bound global score only for a fresh cheats-off run', async () => {
  const result = await completeLeaderboardScenario()
  assert.equal(result.receipts.length, 1)
  const [payloadPart] = result.receipts[0]!.split('.')
  assert.ok(payloadPart)
  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
  assert.equal(payload.userId, 42)
  assert.equal(payload.runId, result.runId)
  assert.equal(payload.wizardName, FIRST_CHARACTER.displayName)
})

test('host withholds global scores across every ineligible authority branch', async () => {
  const save = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: 'saved-owner',
    state: createGameSimulation({ 'saved-owner': FIRST_CHARACTER }),
  })
  const scenarios: readonly [string, LeaderboardScenario][] = [
    ['anonymous admission', { leaderboardUserId: null }],
    ['initial cheat mode in a private College', { cheatsEnabled: true, private: true }],
    ['unattested save resume', { save }],
    ['live cheat mode', {
      private: true,
      beforeArchive: async (socket) => {
        socket.send(encodeGameMessage({ type: 'client-cheat-mode', enabled: true }))
        socket.send(encodeGameMessage({ type: 'client-cheat-mode', enabled: false }))
        await new Promise(resolve => setTimeout(resolve, 20))
      },
    }],
    ['accepted Lua', {
      lua: true,
      private: true,
      beforeArchive: async (socket) => {
        const result = nextMessage(socket, message => (
          message.type === 'server-lua-result' && message.requestId === 1
        ))
        socket.send(encodeGameMessage({
          type: 'client-lua-execute',
          code: 'return 1',
          requestId: 1,
        }))
        const executed = await result
        assert.equal(executed.type, 'server-lua-result')
        assert.equal(executed.ok, true)
      },
    }],
  ]
  for (const [label, scenario] of scenarios) {
    const result = await completeLeaderboardScenario(scenario)
    assert.deepEqual(result.receipts, [], label)
  }
})

test('host exposes and authoritatively loads a selected mod Boneyard', async (context) => {
  const mod = modBoneyardEntry()
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    boneyards: createBoneyardCatalog([mod]),
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())
  assert.deepEqual(first.welcome.boneyards, [
    { id: 'default-random', name: 'Random Boneyard', source: 'default' },
    mod.choice,
  ])

  const firstLoaded = nextMessage(first.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  const secondLoaded = nextMessage(second.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: mod.choice.id,
  }))
  const [loadedA, loadedB] = await Promise.all([firstLoaded, secondLoaded])
  assert.equal(loadedA.type, 'server-boneyard-loaded')
  assert.equal(loadedB.type, 'server-boneyard-loaded')
  assert.equal(loadedA.boneyard.choice.id, mod.choice.id)
  assert.deepEqual(loadedA.boneyard.scene, mod.scene)
  assert.equal(loadedB.boneyard.runId, loadedA.boneyard.runId)

  const lateSocket = await openSocket(host.address.url)
  context.after(() => lateSocket.close())
  const lateWelcome = nextMessage(lateSocket, (message) => message.type === 'server-welcome')
  const lateLoaded = nextMessage(lateSocket, (message) => message.type === 'server-boneyard-loaded')
  lateSocket.send(encodeGameMessage({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'test-secret',
    character: FIRST_CHARACTER,
  }))
  const [welcome, loaded] = await Promise.all([lateWelcome, lateLoaded])
  assert.equal(welcome.type, 'server-welcome')
  assert.equal(loaded.type, 'server-boneyard-loaded')
  assert.equal(welcome.snapshot.world.kind, 'boneyard')
  if (welcome.snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(welcome.snapshot.world.runId, loadedA.boneyard.runId)
  assert.equal(loaded.boneyard.runId, loadedA.boneyard.runId)
  assert.deepEqual(
    welcome.snapshot.players[welcome.playerId].position,
    { x: mod.scene.spawn.x, y: mod.scene.spawn.y },
  )
})

test('host lazily executes bounded Lua for authority and applies semantic commands', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    luaWasmPath,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const authority = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const guest = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => authority.socket.close())
  context.after(() => guest.socket.close())
  assert.equal((await hostHealth(host.address.url)).lua, null)

  const guestRejected = nextMessage(guest.socket, (message) => (
    message.type === 'server-lua-result' && message.requestId === 1
  ))
  guest.socket.send(encodeGameMessage({
    type: 'client-lua-execute',
    code: 'return 1',
    requestId: 1,
  }))
  const rejected = await guestRejected
  assert.equal(rejected.type, 'server-lua-result')
  assert.equal(rejected.ok, false)
  assert.match(rejected.error ?? '', /session host/)
  assert.equal((await hostHealth(host.address.url)).lua, null)

  const firstResult = nextMessage(authority.socket, (message) => (
    message.type === 'server-lua-result' && message.requestId === 2
  ))
  authority.socket.send(encodeGameMessage({
    type: 'client-lua-execute',
    code: `
      print('authority', sd.runtime.get_multiplayer_state().is_authority)
      sd.player.set_gold(4321)
      sd.rng.set_seed(42)
      return sd.player.get_state().display_name, sd.runtime.api_version
    `,
    requestId: 2,
  }))
  const executed = await firstResult
  assert.equal(executed.type, 'server-lua-result')
  assert.equal(executed.ok, true)
  assert.deepEqual(executed.output, ['authority\ttrue'])
  assert.deepEqual(executed.values, ['Helvidius', '0.2.0'])
  await waitFor(() => getPlayerEconomy(host.state(), authority.welcome.playerId).gold === 4321)
  assert.notEqual((await hostHealth(host.address.url)).lua, null)

  const loadedMessage = nextMessage(authority.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  authority.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const loaded = await loadedMessage
  assert.equal(loaded.type, 'server-boneyard-loaded')
  assert.equal(loaded.boneyard.seed, `0000002a${'00'.repeat(12)}`)

  const spawnResult = nextMessage(authority.socket, (message) => (
    message.type === 'server-lua-result' && message.requestId === 3
  ))
  authority.socket.send(encodeGameMessage({
    type: 'client-lua-execute',
    code: 'return sd.enemies.spawn("skeleton", {x = 250, y = 250}).request_id',
    requestId: 3,
  }))
  const spawned = await spawnResult
  assert.equal(spawned.type, 'server-lua-result')
  assert.deepEqual(spawned.values, [1])
  await waitFor(() => {
    const current = host.state()
    return current.world.kind === 'boneyard' && current.world.enemies.actors.length === 1
  })
  const current = host.state()
  if (current.world.kind !== 'boneyard') assert.fail('expected Boneyard')
  assert.equal(current.world.enemies.actors[0]?.config.enemyToken, 'SKELETON')
})

test('Lua authority migrates and reset-when-empty retires the VM', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    luaWasmPath,
    resetWhenEmpty: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => second.socket.close())
  await closeSocket(first.socket)
  await waitFor(() => host.hostPlayerId() === second.welcome.playerId)

  const resultMessage = nextMessage(second.socket, (message) => (
    message.type === 'server-lua-result' && message.requestId === 4
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-lua-execute',
    code: 'persistent = 99; return persistent',
    requestId: 4,
  }))
  const result = await resultMessage
  assert.equal(result.type, 'server-lua-result')
  assert.deepEqual(result.values, [99])
  assert.notEqual((await hostHealth(host.address.url)).lua, null)
  await closeSocket(second.socket)
  await waitFor(() => host.playerCount() === 0)
  assert.equal((await hostHealth(host.address.url)).lua, null)
})

test('host authority transfers to the earliest remaining client', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => second.socket.close())
  const transfer = nextMessage(second.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.hostPlayerId === second.welcome.playerId
  ))
  await closeSocket(first.socket)
  const transferred = await transfer
  assert.equal(transferred.type, 'server-snapshot')

  const loaded = nextMessage(second.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const result = await loaded
  assert.equal(result.type, 'server-boneyard-loaded')
  assert.equal(result.boneyard.choice.id, 'default-random')
})

async function join(
  url: string,
  credential: string,
  character: PlayerCharacterConfig,
  autoPong = true,
  profile: PlayerSocialProfile = {
    accountUsername: null,
    highestWave: null,
    totalPlaytimeMs: null,
  },
) {
  const socket = await openSocket(url, undefined, autoPong)
  socket.send(encodeGameMessage({
    type: 'client-hello',
    profile,
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential,
    character,
  }))
  const welcome = await nextMessage(socket, (message) => message.type === 'server-welcome')
  assert.equal(welcome.type, 'server-welcome')
  return { socket, welcome }
}

interface LeaderboardScenario {
  beforeArchive?: (socket: WebSocket) => Promise<void>
  cheatsEnabled?: boolean
  leaderboardUserId?: number | null
  lua?: boolean
  private?: boolean
  save?: string
}

async function completeLeaderboardScenario(
  scenario: LeaderboardScenario = {},
): Promise<{ receipts: string[]; runId: string }> {
  const host = await startGameHost({
    authentication: {
      kind: 'shared',
      credential: 'test-secret',
      leaderboardUserId: scenario.leaderboardUserId === undefined
        ? 42
        : scenario.leaderboardUserId,
    },
    leaderboardReceiptSecret: LEADERBOARD_RECEIPT_SECRET,
    ...(scenario.lua ? { luaWasmPath } : {}),
    snapshotRate: 100,
    sessionKind: scenario.private ? 'private-college' : 'standalone',
  })
  const socket = await openSocket(host.address.url)
  try {
    const receipts: string[] = []
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString()) as Record<string, unknown>
      if (message.type === 'server-leaderboard-receipt'
        && typeof message.receipt === 'string') receipts.push(message.receipt)
    })
    const welcomeMessage = nextMessage(socket, message => message.type === 'server-welcome')
    socket.send(encodeGameMessage({
      type: 'client-hello',
      profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
      cheatsEnabled: scenario.cheatsEnabled === true,
      protocolVersion: GAME_PROTOCOL_VERSION,
      credential: 'test-secret',
      character: FIRST_CHARACTER,
      ...(scenario.save === undefined
        ? {}
        : { save: scenario.save, saveIntent: 'resume' as const }),
    }))
    const welcome = await welcomeMessage
    assert.equal(welcome.type, 'server-welcome')
    const loaded = nextMessage(socket, message => message.type === 'server-boneyard-loaded')
    socket.send(encodeGameMessage({
      type: 'client-start-match',
      boneyardId: 'default-random',
    }))
    await loaded
    await scenario.beforeArchive?.(socket)
    const archived = nextMessage(socket, message => (
      message.type === 'server-snapshot'
      && message.snapshot.world.kind === 'boneyard'
      && message.snapshot.world.hallOfFameRuns[welcome.playerId]?.elapsedTicks !== null
    ))
    forceHallArchive(host)
    await archived
    await new Promise(resolve => setTimeout(resolve, 50))
    const runId = host.state().run.runId
    if (runId === null) throw new Error('expected completed run id')
    return { receipts, runId }
  } finally {
    await closeSocket(socket)
    await host.close()
  }
}

function forceHallArchive(host: Awaited<ReturnType<typeof startGameHost>>): void {
  if (host.state().world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  Object.assign(host.state().run, {
    gameOverEventId: 1,
    gameOverTicks: NATIVE_HALL_OF_FAME_SCORE.archiveDeathTick - 1,
    nextGameOverEventId: 2,
    phase: 'game-over',
  })
}

function collectChatMessages(socket: WebSocket): {
  messages: TestChatMessage[]
  stop: () => void
} {
  const messages: TestChatMessage[] = []
  const receive = (data: WebSocket.RawData) => {
    const message = decodeServerGameMessage(data.toString())
    if (message.type === 'server-chat' || message.type === 'server-chat-rejected') {
      messages.push(message)
    }
  }
  socket.on('message', receive)
  return {
    messages,
    stop: () => socket.off('message', receive),
  }
}

function closeSocket(socket: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (socket.readyState === WebSocket.CLOSED) {
      resolve()
      return
    }
    socket.once('close', resolve)
    socket.close(1000, 'test disconnect')
  })
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = performance.now() + 5000
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error('timed out waiting for condition')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

async function hostHealth(url: string): Promise<{ lua: unknown }> {
  const endpoint = new URL(url)
  endpoint.protocol = endpoint.protocol === 'wss:' ? 'https:' : 'http:'
  endpoint.pathname = '/health'
  const response = await fetch(endpoint)
  assert.equal(response.status, 200)
  return response.json() as Promise<{ lua: unknown }>
}

function openSocket(url: string, origin?: string, autoPong = true): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { autoPong, ...(origin ? { origin } : {}) })
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
    socket.once('unexpected-response', (_request, response) => {
      reject(new Error(`upgrade rejected with ${response.statusCode}`))
    })
  })
}

function deploymentMessages(socket: WebSocket): Promise<{
  checkpoint: Extract<ServerGameMessage, { type: 'server-save-checkpoint' }>
  restart: Extract<ServerGameMessage, { type: 'server-deployment-restart' }>
}> {
  return new Promise((resolve, reject) => {
    let checkpoint: Extract<ServerGameMessage, { type: 'server-save-checkpoint' }> | null = null
    let restart: Extract<ServerGameMessage, { type: 'server-deployment-restart' }> | null = null
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('timed out waiting for deployment messages'))
    }, 3_000)
    const receive = (data: WebSocket.RawData) => {
      const message = decodeServerGameMessage(data.toString())
      if (message.type === 'server-save-checkpoint') checkpoint = message
      if (message.type === 'server-deployment-restart') restart = message
      if (checkpoint && restart && checkpoint.sequence === restart.checkpointSequence) {
        cleanup()
        resolve({ checkpoint, restart })
      }
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

function leaveSaveMessages(socket: WebSocket, requestId: number): Promise<{
  checkpoint: Extract<ServerGameMessage, { type: 'server-save-checkpoint' }>
  response: Extract<ServerGameMessage, { type: 'server-save-before-leave' }>
}> {
  return new Promise((resolve, reject) => {
    let checkpoint: Extract<ServerGameMessage, { type: 'server-save-checkpoint' }> | null = null
    const timeout = setTimeout(() => fail(new Error('timed out waiting for leave save')), 3_000)
    const receive = (data: WebSocket.RawData) => {
      const message = decodeServerGameMessage(data.toString())
      if (message.type === 'server-save-checkpoint') checkpoint = message
      if (
        message.type === 'server-save-before-leave'
        && message.requestId === requestId
        && checkpoint?.sequence === message.checkpointSequence
      ) {
        cleanup()
        resolve({ checkpoint, response: message })
      }
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

function socketClose(socket: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise(resolve => socket.once('close', (code, reason) => resolve({
    code,
    reason: reason.toString(),
  })))
}

function nextMessage(
  socket: WebSocket,
  predicate: (message: TestServerGameMessage) => boolean,
): Promise<TestServerGameMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('timed out waiting for game message'))
    }, 10_000)
    const receive = (data: WebSocket.RawData) => {
      const message = materializeServerMessage(
        socket,
        decodeServerGameMessage(data.toString()),
      )
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

function materializeServerMessage(
  socket: WebSocket,
  message: ServerGameMessage,
): TestServerGameMessage {
  if (message.type === 'server-welcome') {
    const state: TestReplicationState = {
      frames: new Map(),
      reconstructor: new EntityReplicationReconstructor(),
    }
    state.reconstructor.reset(message.snapshot, message.snapshotSequence)
    replicationBySocket.set(socket, state)
    return message
  }
  if (message.type !== 'server-snapshot') return message
  const state = replicationBySocket.get(socket)
  if (!state) throw new Error('test socket received a snapshot before its welcome')
  const cached = state.frames.get(message.sequence)
  if (cached) return cached
  const snapshot = state.reconstructor.apply(message.frame, message.sequence)
  const materialized = { ...message, snapshot }
  state.frames.set(message.sequence, materialized)
  while (state.frames.size > 64) state.frames.delete(state.frames.keys().next().value!)
  socket.send(encodeGameMessage({
    type: 'client-snapshot-ack',
    requireKeyframe: false,
    sequence: message.sequence,
  }))
  return materialized
}

function modBoneyardEntry(): ModBoneyardEntry {
  const scene: BoneyardScene = {
    name: 'Contract Arena',
    environmentMode: 2,
    bounds: { x: 0, y: 0, w: 1800, h: 1200 },
    spawn: { x: 300, y: 200, facingDeg: 180 },
    objects: [{
      eid: 'solomon-grave',
      typeId: 2029,
      pos: { x: 290, y: 327 },
      variant: 0,
      overlayVariant: 8,
    }],
    sprites: [],
    roads: [],
    fences: [],
    terrain: [],
    solomonDig: {
      gravePosition: { x: 290, y: 327 },
      lanternPosition: { x: 235, y: 400 },
      position: { x: 300, y: 440 },
      frameProgram: SOLOMON_DIG_FRAME_PROGRAM,
      ticksPerFrame: 5,
    },
  }
  return {
    choice: {
      id: 'mod:tests.contract:contract-arena:111111111111',
      name: 'Contract Arena',
      source: 'mod',
      modId: 'tests.contract',
      modName: 'Contract Boneyard',
    },
    geometrySha256: '1'.repeat(64),
    scene,
    sourceSha256: '2'.repeat(64),
  }
}

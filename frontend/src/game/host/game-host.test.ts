import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test, { type TestContext } from 'node:test'

import { WebSocket } from 'ws'

import { HUB_SPAWN } from '../core-kernels/hub-math.ts'
import {
  GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
  GAME_OVER_INPUT_ACCEPT_TICK,
  GAME_OVER_INPUT_EXIT_FADE_TICKS,
} from '../core-kernels/game-run.ts'
import { NATIVE_HALL_OF_FAME_SCORE } from '../core-kernels/hall-of-fame-score.ts'
import {
  DOWSING_EQUIPMENT_RECIPES,
  createEquipmentInventoryItem,
} from '../core-kernels/hub-economy.ts'
import {
  createGameSimulation,
  enterBoneyardWorld,
  gameSimulationPlayerRecords,
  getPlayerCharacter,
  getPlayerEconomy,
  getPlayerProgression,
  grantGameSimulationPlayerExperience,
} from '../core-server/game-simulation.ts'
import {
  replacePlayerCharacter,
  replacePlayerEconomy,
} from '../core-server/player-entity-store.ts'
import { createHubStudentFixturePopulation } from '../core-server/hub-student-fixtures.ts'
import type {
  PlayerCharacterConfig,
  PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import {
  GAME_PROTOCOL_VERSION,
  GAME_SESSION_REPLACED_CLOSE_CODE,
  decodeServerGameMessage,
  encodeGameMessage,
  type GameOnlinePreferences,
  type ServerGameMessage,
  type ServerSnapshotMessage,
} from '../protocol/game-protocol.ts'
import type { GameSnapshot } from '../protocol/game-state.ts'
import type { PlayerSocialProfile } from '../protocol/party-state.ts'
import { EntityReplicationReconstructor } from '../protocol/entity-replication.ts'
import type { BoneyardScene, LoadedBoneyard } from '../core-kernels/boneyard.ts'
import {
  createBoneyardCatalog,
  materializeBoneyard,
  materializeStockTutorial,
  type ModBoneyardEntry,
} from './boneyard-catalog.ts'
import {
  GAME_SAVE_AUTOSAVE_INTERVAL_TICKS,
  startGameHost,
  type GameHostAdmission,
} from './game-host.ts'
import type { GameServerLogEntry } from './game-server-logger.ts'
import {
  deriveGameActivityEvents,
  type GameActivityPlayer,
  type GameActivitySnapshot,
} from './game-activity-events.ts'
import {
  boneyardGeometrySha256,
  SOLOMON_DIG_FRAME_PROGRAM,
} from './project-boneyard.ts'
import { GAME_WEBSOCKET_COMPRESSION } from './websocket-compression.ts'
import {
  createGameProfileSaveDocument,
  createGameSaveDocument,
  restoreGameSaveDocument,
  restoreGameSaveProfile,
} from '../save/game-save-document.ts'
import type { GameSaveIntent } from '../save/game-save-contract.ts'
import {
  createPartyRecoveryClaim,
  verifyPartyRecoveryClaim,
} from './party-recovery-claim.ts'
import {
  compileWebSessionContentDefinitions,
  materializeWebSessionContent,
} from './web-mod-content.ts'

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
const EMPTY_PLAYER_PROFILE = {
  accountUsername: null,
  highestWave: null,
  totalPlaytimeMs: null,
} as const
const ONLINE_PREFERENCES = {
  activityMessages: true,
  globalChat: true,
  submitRuns: true,
} as const satisfies GameOnlinePreferences
const LEADERBOARD_RECEIPT_SECRET = 'leaderboard-receipt-test-secret-that-is-long-enough'
const EMPTY_SHARED_CONTENT = {
  assets: [],
  boneyards: [],
  compiledMods: [],
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

test('party recovery claim seals the exact owner checkpoint and deployment target', () => {
  const loaded = materializeBoneyard(
    createBoneyardCatalog(),
    'default-random',
    Buffer.alloc(16, 17),
  )
  assert.ok(loaded)
  const playerId = 'member-player'
  const unsignedDocument = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: loaded,
    mods: [],
    modState: {},
    partyRejoinToken: null,
    playerId,
    state: enterBoneyardWorld(createGameSimulation({ [playerId]: SECOND_CHARACTER }), loaded),
  })
  const targetRevision = 'a'.repeat(40)
  const claimInput = {
    contentManifestSha256: '0'.repeat(64),
    globalScoreEligible: true,
    integrity: 'global-clean' as const,
    leaderboardUserId: 42,
    partyMemberCount: 2,
    partyLeaderPlayerId: 'leader-player',
    partyRoster: [
      {
        currentHealth: 50,
        displayName: 'Leader',
        element: 'ether' as const,
        lifeState: 'alive' as const,
        maximumHealth: 50,
        playerId: 'leader-player',
      },
      {
        currentHealth: 37,
        displayName: SECOND_CHARACTER.displayName,
        element: SECOND_CHARACTER.element,
        lifeState: 'alive' as const,
        maximumHealth: 50,
        playerId,
      },
    ],
    partyVisibility: 'invite-only' as const,
    playerId,
    recoveryId: 'R'.repeat(43),
    runId: loaded.runId,
    sessionKind: 'global-hub' as const,
    targetRevision,
  }
  const token = createPartyRecoveryClaim(
    LEADERBOARD_RECEIPT_SECRET,
    claimInput,
    unsignedDocument,
  )
  const final = JSON.parse(unsignedDocument)
  final.continuation.summary.partyRejoinToken = token
  const finalDocument = JSON.stringify(final)

  assert.match(token, /^sdrpr2\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/)
  assert.deepEqual(
    verifyPartyRecoveryClaim(LEADERBOARD_RECEIPT_SECRET, token, finalDocument),
    claimInput,
  )

  const legacyUnsigned = structuredClone(final)
  legacyUnsigned.schemaVersion = 12
  delete legacyUnsigned.nativeSource
  const legacyPlayerStore = legacyUnsigned.continuation.simulation.playerEntities
  legacyPlayerStore.skillBooks.forEach((
    skillBook: { skillQuickbar?: Array<number | null> },
    index: number,
  ) => {
    skillBook.skillQuickbar = legacyPlayerStore.belts[index].map((
      entry: { kind?: string, skillId?: number } | null,
    ) => (
      entry?.kind === 'skill' && typeof entry.skillId === 'number' ? entry.skillId : null
    ))
  })
  delete legacyPlayerStore.belts
  legacyUnsigned.continuation.summary.partyRejoinToken = null
  delete legacyUnsigned.profile.economy.collegeIntroPending
  delete legacyUnsigned.continuation.simulation.playerEntities.economies[0]
    .collegeIntroPending
  const legacyUnsignedDocument = JSON.stringify(legacyUnsigned)
  const legacyToken = createPartyRecoveryClaim(
    LEADERBOARD_RECEIPT_SECRET,
    claimInput,
    legacyUnsignedDocument,
  )
  legacyUnsigned.continuation.summary.partyRejoinToken = legacyToken
  assert.deepEqual(
    verifyPartyRecoveryClaim(
      LEADERBOARD_RECEIPT_SECRET,
      legacyToken,
      JSON.stringify(legacyUnsigned),
    ),
    claimInput,
  )

  const tampered = structuredClone(final)
  tampered.continuation.simulation.playerEntities.progressions[0].experience += 1
  assert.equal(
    verifyPartyRecoveryClaim(
      LEADERBOARD_RECEIPT_SECRET,
      token,
      JSON.stringify(tampered),
    ),
    null,
  )
  assert.equal(verifyPartyRecoveryClaim('x'.repeat(40), token, finalDocument), null)
})

test('game activity derivation omits wave and level notifications without hiding run edges', () => {
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
    wave: { ordinal: 1 },
  })
  assert.deepEqual(
    deriveGameActivityEvents(runStarted, waveStarted).map(({ event }) => event),
    [],
  )

  const beforeTerminal = snapshot({
    phase: 'active',
    runId: 'run-1',
    tick: 30,
    wave: { ordinal: 1 },
  })
  const diedAndLeveled = snapshot({
    phase: 'game-over',
    players: [player({ currentHealth: 0, deathEpoch: 1, level: 2, lifeState: 'dying' })],
    runId: 'run-1',
    tick: 31,
    wave: { ordinal: 1 },
  })
  const terminalEvents = deriveGameActivityEvents(beforeTerminal, diedAndLeveled)
  assert.deepEqual(terminalEvents.map(({ event }) => event), [
    'player.died',
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
  const logs: GameServerLogEntry[] = []
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
    log: entry => logs.push(entry),
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
  assert.equal(host.observationTargets()[0]?.visibility, 'public')

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
  assert.equal(host.capacityParticipantCount(), 2)
  assert.equal(host.presence().length, 2)
  playerFacingObserverCueCount = 0
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(playerFacingObserverCueCount, 0)

  const observedChat = nextMessage(observerSocket, message => (
    message.type === 'server-chat' && message.text === 'Hidden observer copy'
  ))
  leader.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'boneyard',
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
    targetPlayerReference: guest.welcome.playerId,
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
  assert.equal(host.capacityParticipantCount(), 2)
  assert.equal(host.presence().length, 2)

  const stalledObserver = await openSocket(host.address.url)
  context.after(() => closeSocket(stalledObserver))
  const stalledWelcome = nextMessage(stalledObserver, message => message.type === 'server-welcome')
  stalledObserver.send(encodeGameMessage({
    type: 'client-observer-hello',
    credential: 'observer-ticket',
    protocolVersion: GAME_PROTOCOL_VERSION,
  }))
  const stalledWelcomeMessage = await stalledWelcome
  assert.equal(stalledWelcomeMessage.type, 'server-welcome')
  const stalledObserverId = stalledWelcomeMessage.resumeToken
  const stalledSnapshots: ServerSnapshotMessage[] = []
  stalledObserver.on('message', (data) => {
    const message = decodeServerGameMessage(data.toString())
    if (message.type === 'server-snapshot') stalledSnapshots.push(message)
  })
  await waitFor(() => stalledSnapshots.length >= 80)
  const observerBacklog = [...stalledSnapshots]
  const observerRecoveryFloor = observerBacklog.at(-1)!.sequence
  for (const message of observerBacklog) {
    stalledObserver.send(encodeGameMessage({
      type: 'client-snapshot-ack',
      requireKeyframe: false,
      sequence: message.sequence,
    }))
  }
  await waitFor(() => stalledSnapshots.some(message => (
    message.sequence > observerRecoveryFloor
    && message.frame.world.entities.keyframe
  )))
  const observerRecovery = stalledSnapshots.find(message => (
    message.sequence > observerRecoveryFloor
    && message.frame.world.entities.keyframe
  ))!
  const observerFramesAtRecovery = stalledSnapshots.length
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(stalledSnapshots.length, observerFramesAtRecovery)
  stalledObserver.send(encodeGameMessage({
    type: 'client-snapshot-ack',
    requireKeyframe: false,
    sequence: observerRecovery.sequence,
  }))
  await waitFor(() => stalledSnapshots.length > observerFramesAtRecovery)
  await waitFor(() => logs.some(entry => (
    entry.event === 'replication.baseline_recovered'
    && entry.details?.observerId === stalledObserverId
  )))
  assert.equal(logs.filter(entry => (
    entry.event === 'replication.baseline_missing'
    && entry.details?.observerId === stalledObserverId
  )).length, 1)
  assert.equal(host.capacityParticipantCount(), 2)
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
    viewportHeight: 900,
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
  assert.equal(host.capacityParticipantCount(), 2)
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
        graphSha256: 'b'.repeat(64),
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
      onlinePreferences: ONLINE_PREFERENCES,
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
  assert.equal(host.capacityParticipantCount(), 0)
})

test('College confirmation checkpoints completion before the ordinary Courtyard return', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(
    host.address.url,
    'test-secret',
    FIRST_CHARACTER,
    true,
    EMPTY_PLAYER_PROFILE,
    true,
  )
  context.after(() => client.socket.close())

  const participant = client.welcome.snapshot.world.kind === 'hub'
    ? client.welcome.snapshot.world.participants[client.welcome.playerId]
    : null
  assert.equal(participant?.region, 'courtyard')
  assert.equal(participant?.transition, null)
  assert.equal(participant?.collegeIntro?.phase, 'courtyard-walk')
  assert.deepEqual(
    client.welcome.snapshot.players[client.welcome.playerId].position,
    { x: 972, y: 1_044 },
  )
  await new Promise((resolve) => setTimeout(resolve, 75))
  const waitingState = host.state()
  assert.equal(
    waitingState.world.kind === 'hub'
      ? waitingState.world.participants[client.welcome.playerId]?.collegeIntro?.pathCursor
      : null,
    0,
  )
  const walking = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.world.kind === 'hub'
    && (message.snapshot.world.participants[client.welcome.playerId]?.collegeIntro?.titleCursor
      ?? 0) > 0
  ))
  client.socket.send(encodeGameMessage({ type: 'client-ready-college-intro' }))
  await walking
  const officeReadyMessage = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.world.kind === 'hub'
    && message.snapshot.world.participants[client.welcome.playerId]?.region === 'office'
    && message.snapshot.world.participants[client.welcome.playerId]?.collegeIntro?.phase
      === 'arch-dialogue'
  ))
  placeCollegeAdmissionAtArch(host, client.welcome.playerId)

  const officeReady = await officeReadyMessage
  assert.equal(officeReady.type, 'server-snapshot')
  assert.equal(
    officeReady.snapshot.players[client.welcome.playerId].economy.collegeIntroPending,
    true,
  )
  const dialogueAcknowledged = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.world.kind === 'hub'
    && message.snapshot.world.participants[client.welcome.playerId]?.collegeIntro === null
  ))
  const dialogueCheckpoint = nextMessage(client.socket, (message) => {
    if (message.type !== 'server-save-checkpoint') return false
    const restored = restoreGameSaveDocument(message.save)
    return restored.state.world.kind === 'hub'
      && restored.state.world.participants[client.welcome.playerId]?.collegeIntro === null
  })
  client.socket.send(encodeGameMessage({
    type: 'client-hub-action',
    action: { type: 'acknowledge-college-intro-dialogue' },
  }))
  await Promise.all([dialogueAcknowledged, dialogueCheckpoint])
  const loadoutMessage = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.world.kind === 'hub'
    && message.snapshot.world.participants[client.welcome.playerId]?.transition?.phase
      === 'college-loadout'
  ))
  placeCollegeAdmissionAtOfficeExit(host, client.welcome.playerId)
  const loadout = await loadoutMessage
  assert.equal(loadout.type, 'server-snapshot')
  assert.deepEqual(
    loadout.snapshot.players[client.welcome.playerId].position,
    { x: 952.5, y: 67.5 },
  )
  const completedMessage = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.world.kind === 'hub'
    && message.snapshot.world.participants[client.welcome.playerId]?.transition?.phase
      === 'incoming'
    && message.snapshot.players[client.welcome.playerId].economy.collegeIntroPending === false
    && message.snapshot.players[client.welcome.playerId].economy.tutorialPending === false
  ))
  const settledMessage = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.world.kind === 'hub'
    && message.snapshot.world.participants[client.welcome.playerId]?.region === 'courtyard'
    && message.snapshot.world.participants[client.welcome.playerId]?.transition === null
  ))
  const checkpointMessage = nextMessage(client.socket, (message) => (
    message.type === 'server-save-checkpoint'
    && restoreGameSaveProfile(message.save).economy.collegeIntroPending === false
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-confirm-loadout',
    discipline: 'body',
    displayName: 'Reborn',
    element: 'air',
  }))
  const [completed, settled, checkpoint] = await Promise.all([
    completedMessage,
    settledMessage,
    checkpointMessage,
  ])
  assert.equal(completed.type, 'server-snapshot')
  assert.equal(settled.type, 'server-snapshot')
  assert.deepEqual(
    settled.snapshot.players[client.welcome.playerId].position,
    { x: 952.5, y: 157.5 },
  )
  assert.equal(
    settled.snapshot.players[client.welcome.playerId].config.displayName,
    'Reborn',
  )
  assert.equal(host.presence()[0]?.displayName, 'Reborn')
  assert.equal(checkpoint.type, 'server-save-checkpoint')
  assert.equal(getPlayerEconomy(host.state(), client.welcome.playerId).collegeIntroPending, false)
})

test('a fresh Tutorial decline enters the ordinary Hub and persists both consumed obligations', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const socket = await openSocket(host.address.url)
  context.after(() => socket.close())
  const welcomeMessage = nextMessage(socket, message => message.type === 'server-welcome')
  const checkpointMessage = nextMessage(socket, (message) => (
    message.type === 'server-save-checkpoint'
    && restoreGameSaveProfile(message.save).economy.tutorialPending === false
    && restoreGameSaveProfile(message.save).economy.collegeIntroPending === false
  ))
  socket.send(encodeGameMessage({
    type: 'client-hello',
    onlinePreferences: ONLINE_PREFERENCES,
    character: FIRST_CHARACTER,
    cheatsEnabled: false,
    credential: 'test-secret',
    declineTutorial: true,
    profile: EMPTY_PLAYER_PROFILE,
    protocolVersion: GAME_PROTOCOL_VERSION,
  }))
  const [welcome, checkpoint] = await Promise.all([welcomeMessage, checkpointMessage])
  assert.equal(welcome.type, 'server-welcome')
  assert.equal(checkpoint.type, 'server-save-checkpoint')
  const player = welcome.snapshot.players[welcome.playerId]
  assert.equal(player.economy.tutorialPending, false)
  assert.equal(player.economy.collegeIntroPending, false)
  assert.equal(
    welcome.snapshot.world.kind === 'hub'
      ? welcome.snapshot.world.participants[welcome.playerId]?.collegeIntro
      : undefined,
    null,
  )
  const persisted = restoreGameSaveProfile(checkpoint.save).economy
  assert.equal(persisted.tutorialPending, false)
  assert.equal(persisted.collegeIntroPending, false)
  assert.equal(getPlayerEconomy(host.state(), welcome.playerId).tutorialPending, false)
  assert.equal(getPlayerEconomy(host.state(), welcome.playerId).collegeIntroPending, false)

  const restoredHost = await startGameHost({
    authentication: { kind: 'shared', credential: 'restore-secret' },
    snapshotRate: 100,
  })
  context.after(() => restoredHost.close())
  const restoredSocket = await openSavedRunSocket(
    restoredHost.address.url,
    'restore-secret',
    checkpoint.save,
  )
  context.after(() => restoredSocket.close())
  const restoredPlayerId = restoreGameSaveDocument(checkpoint.save).playerId
  const restoredState = restoredHost.state()
  assert.equal(getPlayerEconomy(restoredState, restoredPlayerId).tutorialPending, false)
  assert.equal(getPlayerEconomy(restoredState, restoredPlayerId).collegeIntroPending, false)
  assert.equal(
    restoredState.world.kind === 'hub'
      ? restoredState.world.participants[restoredPlayerId]?.collegeIntro
      : undefined,
    null,
  )
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
  const first = await join(
    host.address.url,
    'ticket-a',
    FIRST_CHARACTER,
    true,
    EMPTY_PLAYER_PROFILE,
    false,
    false,
    ONLINE_PREFERENCES,
    true,
  )
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
  assert.equal(partyState.state.party.visibility, 'public')
  assert.equal(first.welcome.cheatsEnabled, true)
  assert.equal(second.welcome.cheatsEnabled, true)
  const rejectedCheatChange = nextMessage(second.socket, message => (
    message.type === 'server-cheat-mode'
  ))
  second.socket.send(encodeGameMessage({ type: 'client-cheat-mode', enabled: false }))
  const retainedCheats = await rejectedCheatChange
  assert.equal(retainedCheats.type, 'server-cheat-mode')
  assert.equal(retainedCheats.enabled, true)
  const disabledForFirst = nextMessage(first.socket, message => (
    message.type === 'server-cheat-mode' && !message.enabled
  ))
  const disabledForSecond = nextMessage(second.socket, message => (
    message.type === 'server-cheat-mode' && !message.enabled
  ))
  first.socket.send(encodeGameMessage({ type: 'client-cheat-mode', enabled: false }))
  await Promise.all([disabledForFirst, disabledForSecond])
  const enabledForFirst = nextMessage(first.socket, message => (
    message.type === 'server-cheat-mode' && message.enabled
  ))
  const enabledForSecond = nextMessage(second.socket, message => (
    message.type === 'server-cheat-mode' && message.enabled
  ))
  first.socket.send(encodeGameMessage({ type: 'client-cheat-mode', enabled: true }))
  await Promise.all([enabledForFirst, enabledForSecond])
  assert.deepEqual(host.publicParties(), [{
    boneyardName: null,
    cheatsEnabled: true,
    id: partyState.state.party.listingId,
    leader: FIRST_CHARACTER.displayName,
    maxMembers: 16,
    memberCount: 2,
    members: [FIRST_CHARACTER.displayName, SECOND_CHARACTER.displayName],
    modCount: 0,
    sessionKind: 'private-college',
    status: 'hub',
    visibility: 'public',
  }])
  const target = host.partyTargetByCode(partyState.state.party.joinCode)
  assert.equal(target?.memberCount, 2)
  assert.equal(target?.visibility, 'public')
  assert.equal(target?.cheatsEnabled, true)
  thirdPartyId = target!.id
  assert.equal(host.reservePartyJoin(target!.id, 'reservation-c', performance.now() + 1_000), null)
  const third = await join(host.address.url, 'ticket-c', FIRST_CHARACTER)
  context.after(() => closeSocket(third.socket))
  assert.equal((await firstCheckpoint).type, 'server-save-checkpoint')
  assert.equal(host.capacityParticipantCount(), 3)
})

test('reserved party transfer imports one durable profile into an existing private College', async (context) => {
  let partyId: string | null = null
  const reservationId = 'reserved-profile-transfer'
  const host = await startGameHost({
    authentication: {
      kind: 'tickets',
      claim: credential => credential === 'leader-ticket'
        ? { content: EMPTY_SHARED_CONTENT, leaderboardUserId: null }
        : credential === 'unreserved-ticket'
          ? { content: EMPTY_SHARED_CONTENT, leaderboardUserId: null }
          : credential === 'transfer-ticket' && partyId
            ? {
                content: EMPTY_SHARED_CONTENT,
                leaderboardUserId: null,
                partyId,
                reservationId,
              }
            : null,
    },
    sessionKind: 'private-college',
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const leader = await join(
    host.address.url,
    'leader-ticket',
    FIRST_CHARACTER,
    true,
    EMPTY_PLAYER_PROFILE,
    false,
    false,
    ONLINE_PREFERENCES,
    true,
  )
  context.after(() => closeSocket(leader.socket))
  const listing = host.publicParties()[0]
  assert.ok(listing)
  const target = host.partyTargetByListingId(listing.id)
  assert.ok(target)
  assert.equal(target.visibility, 'public')
  partyId = target.id
  assert.equal(
    host.reservePartyJoin(partyId, reservationId, performance.now() + 10_000),
    null,
  )

  const source = createGameSimulation({ saved: FIRST_CHARACTER })
  const savedEconomy = getPlayerEconomy(source, 'saved')
  const profile = createGameProfileSaveDocument({
    integrity: 'local-only',
    mods: [],
    modState: {},
    playerId: 'saved',
    state: {
      ...source,
      playerEntities: replacePlayerEconomy(source.playerEntities, 'saved', {
        ...savedEconomy,
        gold: 12_345,
      }),
    },
  })
  const unreservedSocket = await openSocket(host.address.url)
  context.after(() => closeSocket(unreservedSocket))
  const unreservedAdmission = nextMessage(unreservedSocket, message => (
    message.type === 'server-disconnect'
  ))
  unreservedSocket.send(encodeGameMessage({
    type: 'client-hello',
    onlinePreferences: ONLINE_PREFERENCES,
    profile: EMPTY_PLAYER_PROFILE,
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'unreserved-ticket',
    character: SECOND_CHARACTER,
    save: profile,
    saveIntent: 'new-game',
  }))
  const unreserved = await unreservedAdmission
  assert.equal(unreserved.type, 'server-disconnect')
  assert.match(unreserved.reason, /fresh host owner/)

  const transferredParty = nextMessage(leader.socket, message => (
    message.type === 'server-party-state' && message.state.party.memberPlayerIds.length === 2
  ))
  const socket = await openSocket(host.address.url)
  context.after(() => closeSocket(socket))
  const admitted = nextMessage(socket, message => (
    message.type === 'server-welcome' || message.type === 'server-disconnect'
  ))
  socket.send(encodeGameMessage({
    type: 'client-hello',
    onlinePreferences: ONLINE_PREFERENCES,
    profile: EMPTY_PLAYER_PROFILE,
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'transfer-ticket',
    character: SECOND_CHARACTER,
    save: profile,
    saveIntent: 'new-game',
  }))

  const welcome = await admitted
  assert.equal(welcome.type, 'server-welcome')
  if (welcome.type !== 'server-welcome') return
  assert.equal(welcome.cheatsEnabled, true)
  assert.deepEqual(welcome.snapshot.players[leader.welcome.playerId]?.config, FIRST_CHARACTER)
  assert.deepEqual(welcome.snapshot.players[welcome.playerId]?.config, SECOND_CHARACTER)
  assert.equal(welcome.snapshot.players[welcome.playerId]?.economy.gold, 12_345)
  assert.equal((await transferredParty).type, 'server-party-state')
  assert.equal(host.capacityParticipantCount(), 2)
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

test('shared-host Global crosses Hub and Boneyard while match chat stays run-scoped', async (context) => {
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
    playerReference: partyA.sender.playerReference,
  })
  assert.match(partyA.sender.playerReference, /^player-ref-[A-Za-z0-9_-]{32}$/)
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

  const searchingForSecond = nextMessage(second.socket, message => (
    message.type === 'server-chat'
    && message.activity === 'searching-solomon'
    && message.sender.playerId === first.welcome.playerId
  ))
  const searchingForOutsider = nextMessage(outsider.socket, message => (
    message.type === 'server-chat'
    && message.activity === 'searching-solomon'
    && message.sender.playerId === first.welcome.playerId
  ))
  const loadedFirst = nextMessage(first.socket, message => message.type === 'server-boneyard-loaded')
  const loadedSecond = nextMessage(second.socket, message => message.type === 'server-boneyard-loaded')
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const [, , searchingSecond, searchingOutsider] = await Promise.all([
    loadedFirst,
    loadedSecond,
    searchingForSecond,
    searchingForOutsider,
  ])
  for (const message of [searchingSecond, searchingOutsider]) {
    assert.equal(message.type, 'server-chat')
    assert.equal(message.text, `${FIRST_CHARACTER.displayName} is searching for Solomon.`)
  }

  const lateEnteredForFirst = nextMessage(first.socket, message => (
    message.type === 'server-chat'
    && message.activity === 'entered-college'
    && message.text === 'Daria has entered the college.'
  ))
  const lateEnteredForSecond = nextMessage(second.socket, message => (
    message.type === 'server-chat'
    && message.activity === 'entered-college'
    && message.text === 'Daria has entered the college.'
  ))
  const late = await join(host.address.url, 'ticket-late', {
    ...FIRST_CHARACTER,
    displayName: 'Daria',
  })
  await Promise.all([lateEnteredForFirst, lateEnteredForSecond])
  await closeSocket(late.socket)

  const runGlobalForFirst = nextMessage(first.socket, message => (
    message.type === 'server-chat' && message.text === 'Global from the run'
  ))
  const runGlobalForSecond = nextMessage(second.socket, message => (
    message.type === 'server-chat' && message.text === 'Global from the run'
  ))
  const runGlobalForOutsider = nextMessage(outsider.socket, message => (
    message.type === 'server-chat' && message.text === 'Global from the run'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'global',
    text: 'Global from the run',
  }))
  await Promise.all([runGlobalForFirst, runGlobalForSecond, runGlobalForOutsider])

  const loadedOutsider = nextMessage(
    outsider.socket,
    message => message.type === 'server-boneyard-loaded',
  )
  const outsiderSearchingForFirst = nextMessage(first.socket, message => (
    message.type === 'server-chat'
    && message.activity === 'searching-solomon'
    && message.sender.playerId === outsider.welcome.playerId
  ))
  const outsiderSearchingForSecond = nextMessage(second.socket, message => (
    message.type === 'server-chat'
    && message.activity === 'searching-solomon'
    && message.sender.playerId === outsider.welcome.playerId
  ))
  outsider.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await Promise.all([loadedOutsider, outsiderSearchingForFirst, outsiderSearchingForSecond])

  const hubGlobalForFirst = nextMessage(first.socket, message => (
    message.type === 'server-chat' && message.text === 'Global from the second run'
  ))
  const hubGlobalForSecond = nextMessage(second.socket, message => (
    message.type === 'server-chat' && message.text === 'Global from the second run'
  ))
  const hubGlobalForOutsider = nextMessage(outsider.socket, message => (
    message.type === 'server-chat' && message.text === 'Global from the second run'
  ))
  outsider.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'global',
    text: 'Global from the second run',
  }))
  await Promise.all([hubGlobalForFirst, hubGlobalForSecond, hubGlobalForOutsider])

  const boneyardForFirst = nextMessage(first.socket, message => (
    message.type === 'server-chat' && message.text === 'Boneyard route'
  ))
  const boneyardForSecond = nextMessage(second.socket, message => (
    message.type === 'server-chat' && message.text === 'Boneyard route'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'boneyard',
    text: 'Boneyard route',
  }))
  await Promise.all([boneyardForFirst, boneyardForSecond])
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(outsiderChat.messages.some(message => (
    message.type === 'server-chat' && message.text === 'Boneyard route'
  )), false)

  const unavailableParty = nextMessage(second.socket, message => (
    message.type === 'server-chat-rejected'
    && message.channel === 'party'
    && message.reason === 'channel-unavailable'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'party',
    text: 'Party is a Hub lane now',
  }))
  assert.equal((await unavailableParty).type, 'server-chat-rejected')

  const outsiderLeftForFirst = nextMessage(first.socket, message => (
    message.type === 'server-chat'
    && message.activity === 'left-game'
    && message.sender.playerId === outsider.welcome.playerId
  ))
  const outsiderLeftForSecond = nextMessage(second.socket, message => (
    message.type === 'server-chat'
    && message.activity === 'left-game'
    && message.sender.playerId === outsider.welcome.playerId
  ))
  await closeSocket(outsider.socket)
  const leftMessages = await Promise.all([outsiderLeftForFirst, outsiderLeftForSecond])
  assert.equal(leftMessages.every(message => (
    message.type === 'server-chat'
    && message.text === 'Cassia has left the game.'
  )), true)
})

test('activity and Global preferences gate both emission and receipt across disconnects', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_HUB_AUTHENTICATION,
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'ticket-first', FIRST_CHARACTER)
  context.after(() => first.socket.close())

  const enteredSecond = nextMessage(first.socket, message => (
    message.type === 'server-chat' && message.activity === 'entered-college'
  ))
  const second = await join(host.address.url, 'ticket-second', SECOND_CHARACTER)
  context.after(() => second.socket.close())
  const entered = await enteredSecond
  assert.equal(entered.type, 'server-chat')
  assert.equal(entered.text, `${SECOND_CHARACTER.displayName} has entered the college.`)

  const firstChat = collectChatMessages(first.socket)
  context.after(firstChat.stop)
  const quiet = await join(
    host.address.url,
    'ticket-quiet',
    { ...FIRST_CHARACTER, displayName: 'Quietus' },
    true,
    EMPTY_PLAYER_PROFILE,
    false,
    false,
    { activityMessages: false, globalChat: true, submitRuns: true },
  )
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(firstChat.messages.some(message => (
    message.type === 'server-chat' && message.sender.playerId === quiet.welcome.playerId
  )), false)
  const quietGlobal = nextMessage(quiet.socket, message => (
    message.type === 'server-chat' && message.text === 'Global without activity'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'global',
    text: 'Global without activity',
  }))
  assert.equal((await quietGlobal).type, 'server-chat')
  await closeSocket(quiet.socket)
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(firstChat.messages.some(message => (
    message.type === 'server-chat'
    && message.activity === 'left-game'
    && message.sender.playerId === quiet.welcome.playerId
  )), false)

  first.socket.send(encodeGameMessage({
    type: 'client-online-preferences',
    onlinePreferences: { activityMessages: false, globalChat: false, submitRuns: true },
  }))
  await new Promise(resolve => setTimeout(resolve, 20))
  const disabledSender = nextMessage(first.socket, message => (
    message.type === 'server-chat-rejected'
    && message.channel === 'global'
    && message.reason === 'channel-unavailable'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'global',
    text: 'Disabled sender must be rejected',
  }))
  assert.equal((await disabledSender).type, 'server-chat-rejected')
  firstChat.messages.length = 0
  const third = await join(host.address.url, 'ticket-third', {
    ...FIRST_CHARACTER,
    displayName: 'Cassia',
  })
  context.after(() => third.socket.close())
  third.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'global',
    text: 'Hidden while disabled',
  }))
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(firstChat.messages.length, 0)

  first.socket.send(encodeGameMessage({
    type: 'client-online-preferences',
    onlinePreferences: ONLINE_PREFERENCES,
  }))
  await new Promise(resolve => setTimeout(resolve, 20))
  const visibleAgain = nextMessage(first.socket, message => (
    message.type === 'server-chat' && message.text === 'Visible after enable'
  ))
  third.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'global',
    text: 'Visible after enable',
  }))
  assert.equal((await visibleAgain).type, 'server-chat')

  const leftSecond = nextMessage(first.socket, message => (
    message.type === 'server-chat'
    && message.activity === 'left-game'
    && message.sender.playerId === second.welcome.playerId
  ))
  await closeSocket(second.socket)
  const left = await leftSecond
  assert.equal(left.type, 'server-chat')
  assert.equal(left.text, `${SECOND_CHARACTER.displayName} has left the game.`)
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
    targetPlayerReference: second.welcome.playerId,
    text: 'Between us',
  }))
  const [atSender, atTarget] = await Promise.all([whisperForSender, whisperForTarget])
  assert.deepEqual(atSender, atTarget)
  assert.equal(atSender.type, 'server-chat')
  assert.equal(atSender.channel, 'whisper')
  assert.deepEqual(atSender.sender, {
    displayName: FIRST_CHARACTER.displayName,
    playerId: first.welcome.playerId,
    playerReference: atSender.sender.playerReference,
  })
  assert.deepEqual(atSender.recipient, {
    displayName: SECOND_CHARACTER.displayName,
    playerId: second.welcome.playerId,
    playerReference: atSender.recipient?.playerReference,
  })
  assert.match(atSender.sender.playerReference, /^player-ref-[A-Za-z0-9_-]{32}$/)
  assert.match(atSender.recipient!.playerReference, /^player-ref-[A-Za-z0-9_-]{32}$/)
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(outsiderChat.messages.length, 0)

  const unavailable = nextMessage(first.socket, message => (
    message.type === 'server-chat-rejected' && message.reason === 'target-unavailable'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'whisper',
    targetPlayerReference: 'player-toltec-departed',
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
    targetPlayerReference: first.welcome.playerId,
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

test('initial multiplayer Boneyard waits for every renderer then enters resume progress', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  const loadedFirst = nextMessage(first.socket, message => (
    message.type === 'server-boneyard-loaded'
  ))
  const loadedSecond = nextMessage(second.socket, message => (
    message.type === 'server-boneyard-loaded'
  ))
  const pendingFirst = nextMessage(first.socket, message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace !== null
    && message.grace.reason === 'game-started'
    && message.grace.remainingMs === null
  ))
  const pendingSecond = nextMessage(second.socket, message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace !== null
    && message.grace.reason === 'game-started'
    && message.grace.remainingMs === null
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await Promise.all([loadedFirst, loadedSecond])
  const [firstGrace, secondGrace] = await Promise.all([pendingFirst, pendingSecond])
  assert.equal(firstGrace.type, 'server-gameplay-resume-grace')
  assert.equal(secondGrace.type, 'server-gameplay-resume-grace')
  assert.equal(firstGrace.grace?.sequence, secondGrace.grace?.sequence)

  const heldTick = host.state().tick
  await new Promise(resolve => setTimeout(resolve, 80))
  assert.equal(host.state().tick, heldTick)
  first.socket.send(encodeGameMessage({
    type: 'client-resume-grace-ready',
    sequence: firstGrace.grace!.sequence,
  }))
  await new Promise(resolve => setTimeout(resolve, 80))
  assert.equal(host.state().tick, heldTick)

  const startedFirst = nextMessage(first.socket, message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace?.reason === 'game-started'
    && message.grace.remainingMs !== null
  ))
  const startedSecond = nextMessage(second.socket, message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace?.reason === 'game-started'
    && message.grace.remainingMs !== null
  ))
  const graceStartedAt = performance.now()
  second.socket.send(encodeGameMessage({
    type: 'client-resume-grace-ready',
    sequence: secondGrace.grace!.sequence,
  }))
  const [startedA, startedB] = await Promise.all([startedFirst, startedSecond])
  assert.equal(startedA.type, 'server-gameplay-resume-grace')
  assert.equal(startedB.type, 'server-gameplay-resume-grace')
  assert.ok((startedA.grace?.remainingMs ?? 0) > 1_900)
  assert.ok((startedA.grace?.remainingMs ?? Infinity) <= 2_000)
  const completedFirst = nextMessage(first.socket, message => (
    message.type === 'server-gameplay-resume-grace' && message.grace === null
  ))
  const completedSecond = nextMessage(second.socket, message => (
    message.type === 'server-gameplay-resume-grace' && message.grace === null
  ))
  await new Promise(resolve => setTimeout(resolve, 1_500))
  assert.equal(host.state().tick, heldTick)
  await Promise.all([completedFirst, completedSecond])
  assert.ok(performance.now() - graceStartedAt >= 1_850)
  await waitFor(() => host.state().tick > heldTick)
  await new Promise(resolve => setTimeout(resolve, 80))
  assert.ok(host.state().tick - heldTick <= 35, 'fresh progress must not replay held wall time')
})

test('modded Boneyard accepts renderer readiness while start grace is pending', async (context) => {
  const modContent = await compileWebSessionContentDefinitions(materializeWebSessionContent({
    manifestSha256: 'f'.repeat(64),
    mods: [{
      boneyards: [],
      contentSha256: 'e'.repeat(64),
      entryScript: 'return sd.mod({api = "1.0.0"})',
      files: [],
      id: 'tests.renderer-readiness',
      name: 'Renderer Readiness',
      priority: 0,
      slug: 'renderer-readiness',
      version: '1.0.0',
    }],
  }), luaWasmPath)
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    content: modContent.manifest,
    luaWasmPath,
    modAssets: modContent.assets,
    modContent,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  const loaded = [first, second].map(({ socket }) => nextMessage(socket, message => (
    message.type === 'server-boneyard-loaded'
  )))
  const pending = [first, second].map(({ socket }) => nextMessage(socket, message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace?.reason === 'game-started'
    && message.grace.remainingMs === null
  )))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const [firstLoaded, secondLoaded] = await Promise.all(loaded)
  const graces = await Promise.all(pending)
  assert.equal(firstLoaded.type, 'server-boneyard-loaded')
  assert.equal(secondLoaded.type, 'server-boneyard-loaded')
  assert.equal(firstLoaded.boneyard.runId, secondLoaded.boneyard.runId)

  const heldTick = host.state().tick
  const started = [first, second].map(({ socket }) => nextMessage(socket, message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace?.reason === 'game-started'
    && message.grace.remainingMs !== null
  )))
  for (const { socket } of [first, second]) socket.send(encodeGameMessage({
    type: 'client-ready-boneyard',
    runId: firstLoaded.boneyard.runId,
  }))
  for (const [index, message] of graces.entries()) {
    assert.equal(message.type, 'server-gameplay-resume-grace')
    assert.ok(message.grace)
    ;[first, second][index]!.socket.send(encodeGameMessage({
      type: 'client-resume-grace-ready',
      sequence: message.grace.sequence,
    }))
  }
  const activeGraces = await Promise.all(started)
  for (const activeGrace of activeGraces) {
    assert.equal(activeGrace.type, 'server-gameplay-resume-grace')
    assert.ok((activeGrace.grace?.remainingMs ?? 0) > 1_900)
  }
  const completed = [first, second].map(({ socket }) => nextMessage(socket, message => (
    message.type === 'server-gameplay-resume-grace' && message.grace === null
  )))
  await new Promise(resolve => setTimeout(resolve, 1_500))
  assert.equal(host.state().tick, heldTick)
  await Promise.all(completed)
  await waitFor(() => host.state().tick > heldTick)
})

test('Boneyard pause holds the complete world and only its owner can resume', async (context) => {
  const logs: GameServerLogEntry[] = []
  const runtimeEvents: string[] = []
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    log: entry => logs.push(entry),
    runtimeEvents: entry => runtimeEvents.push(entry.event),
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  const loadedA = nextMessage(first.socket, (message) => message.type === 'server-boneyard-loaded')
  const loadedB = nextMessage(second.socket, (message) => message.type === 'server-boneyard-loaded')
  const initialReady = completeInitialGameplayReadiness([first.socket, second.socket])
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await Promise.all([loadedA, loadedB])
  await initialReady
  logs.length = 0
  runtimeEvents.length = 0
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
  assert.ok(logs.some(entry => entry.event === 'gameplay.paused'))

  const heldTick = host.state().tick
  const heldWorld = JSON.stringify(host.state().world)
  const heldPlayers = JSON.stringify(gameSimulationPlayerRecords(host.state()))
  await new Promise((resolve) => setTimeout(resolve, 100))
  assert.equal(host.state().tick, heldTick)
  assert.equal(JSON.stringify(host.state().world), heldWorld)
  assert.equal(JSON.stringify(gameSimulationPlayerRecords(host.state())), heldPlayers)

  const pausedChatA = nextMessage(first.socket, (message) => (
    message.type === 'server-chat' && message.text === 'Chat remains live while paused'
  ))
  const pausedChatB = nextMessage(second.socket, (message) => (
    message.type === 'server-chat' && message.text === 'Chat remains live while paused'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'boneyard',
    text: 'Chat remains live while paused',
  }))
  const [chatA, chatB] = await Promise.all([pausedChatA, pausedChatB])
  assert.equal(chatA.type, 'server-chat')
  assert.equal(chatB.type, 'server-chat')
  assert.equal(chatA.sender.playerId, second.welcome.playerId)
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
  const graceA = nextMessage(first.socket, (message) => (
    message.type === 'server-gameplay-resume-grace' && message.grace !== null
  ))
  const graceB = nextMessage(second.socket, (message) => (
    message.type === 'server-gameplay-resume-grace' && message.grace !== null
  ))
  second.socket.send(encodeGameMessage({ type: 'client-gameplay-pause', paused: false }))
  const [, , resumedA, resumedB] = await Promise.all([
    releasedA,
    releasedB,
    graceA,
    graceB,
  ])
  assert.equal(resumedA.type, 'server-gameplay-resume-grace')
  assert.equal(resumedB.type, 'server-gameplay-resume-grace')
  assert.equal(resumedA.grace?.reason, 'skill-book-closed')
  assert.ok((resumedA.grace?.remainingMs ?? 0) > 1_900)
  assert.ok((resumedA.grace?.remainingMs ?? Infinity) <= 2_000)
  const graceStartedAt = performance.now()
  const graceCompleted = nextMessage(first.socket, (message) => (
    message.type === 'server-gameplay-resume-grace' && message.grace === null
  ))
  assert.ok(logs.some(entry => entry.event === 'gameplay.pause_released'))
  assert.deepEqual(runtimeEvents.filter(event => (
    event === 'gameplay.paused' || event === 'gameplay.resumed'
  )), [])
  assert.ok(host.state().tick - heldTick <= 10, 'Boneyard release must not replay paused wall time')
  await new Promise((resolve) => setTimeout(resolve, 1_500))
  assert.equal(host.state().tick, heldTick)
  await graceCompleted
  assert.ok(performance.now() - graceStartedAt >= 1_850)
  assert.ok(logs.some(entry => entry.event === 'gameplay.resumed'))
  await waitFor(() => host.state().tick > heldTick)
  assert.ok(host.state().tick - heldTick <= 10, 'grace expiry must not replay held wall time')
})

test('multiplayer compact skill selector resumes directly after teardown', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  const loadedFirst = nextMessage(
    first.socket,
    message => message.type === 'server-boneyard-loaded',
  )
  const loadedSecond = nextMessage(
    second.socket,
    message => message.type === 'server-boneyard-loaded',
  )
  const initialReady = completeInitialGameplayReadiness([first.socket, second.socket])
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await Promise.all([loadedFirst, loadedSecond])
  await initialReady

  const paused = nextMessage(first.socket, message => (
    message.type === 'server-gameplay-pause'
    && message.pause?.source === 'skill-selector'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-gameplay-pause',
    paused: true,
    source: 'skill-selector',
  }))
  await paused
  const heldTick = host.state().tick
  let graceMessages = 0
  const observeGrace = (data: WebSocket.RawData) => {
    if (decodeServerGameMessage(data.toString()).type === 'server-gameplay-resume-grace') {
      graceMessages += 1
    }
  }
  first.socket.on('message', observeGrace)
  context.after(() => first.socket.off('message', observeGrace))
  const released = nextMessage(first.socket, message => (
    message.type === 'server-gameplay-pause' && message.pause === null
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-gameplay-pause',
    paused: false,
  }))
  await released
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(graceMessages, 0)
  assert.ok(host.state().tick > heldTick)
  assert.ok(host.state().tick - heldTick <= 15, 'selector release must not replay held wall time')
})

test('solo Inventory admits item belt bind and pull-off before resume progress', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const loaded = nextMessage(
    client.socket,
    message => message.type === 'server-boneyard-loaded',
  )
  const initialReady = completeInitialGameplayReadiness([client.socket])
  client.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await loaded
  await initialReady
  const paused = nextMessage(client.socket, message => (
    message.type === 'server-gameplay-pause' && message.pause !== null
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-gameplay-pause',
    paused: true,
    source: 'inventory',
  }))
  await paused
  const heldTick = host.state().tick
  const playerId = client.welcome.playerId
  const economy = getPlayerEconomy(host.state(), playerId)
  const ringRecipe = DOWSING_EQUIPMENT_RECIPES.find(({ type }) => type === 'ring')!
  const ring = createEquipmentInventoryItem(ringRecipe, economy.nextItemId)
  Object.assign(host.state(), {
    playerEntities: replacePlayerEconomy(host.state().playerEntities, playerId, {
      ...economy,
      backpack: [...economy.backpack, ring],
      nextItemId: economy.nextItemId + 1,
    }),
  })
  const bound = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].belt[2]?.kind === 'item'
  ))
  client.socket.send(encodeGameMessage({
    action: { itemId: ring.id, slot: 2, type: 'bind-belt-item' },
    type: 'client-hub-action',
  }))
  const boundSnapshot = await bound
  assert.equal(boundSnapshot.type, 'server-snapshot')
  assert.deepEqual(boundSnapshot.snapshot.players[playerId].belt[2], {
    itemId: ring.id,
    kind: 'item',
    nativeTypeId: 7002,
  })
  const cleared = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].belt[2] === null
  ))
  client.socket.send(encodeGameMessage({
    skillId: null,
    slot: 2,
    type: 'client-skill-quickbar-bind',
  }))
  await cleared
  client.socket.send(encodeGameMessage({
    skillId: 11,
    slot: 2,
    type: 'client-skill-quickbar-bind',
  }))
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(host.state().playerEntities.belts[0]?.[2], null)
  const released = nextMessage(client.socket, message => (
    message.type === 'server-gameplay-pause' && message.pause === null
  ))
  const graceStarted = nextMessage(client.socket, message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace?.reason === 'inventory-closed'
    && message.grace.remainingMs !== null
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-gameplay-pause',
    paused: false,
  }))
  await released
  const activeGrace = await graceStarted
  assert.equal(activeGrace.type, 'server-gameplay-resume-grace')
  assert.ok((activeGrace.grace?.remainingMs ?? 0) > 1_900)
  const completed = nextMessage(client.socket, message => (
    message.type === 'server-gameplay-resume-grace' && message.grace === null
  ))
  await new Promise(resolve => setTimeout(resolve, 1_500))
  assert.equal(host.state().tick, heldTick)
  await completed
  await waitFor(() => host.state().tick > heldTick)
  assert.ok(host.state().tick - heldTick <= 10, 'solo Inventory must not replay held time')
})

test('solo Pause and full Skill Screen release through resume progress', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const loaded = nextMessage(
    client.socket,
    message => message.type === 'server-boneyard-loaded',
  )
  const initialReady = completeInitialGameplayReadiness([client.socket])
  client.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await loaded
  await initialReady

  for (const [source, reason] of [
    ['pause-menu', 'pause-menu-closed'],
    ['skill-book', 'skill-book-closed'],
  ] as const) {
    const paused = nextMessage(client.socket, message => (
      message.type === 'server-gameplay-pause' && message.pause?.source === source
    ))
    client.socket.send(encodeGameMessage({
      type: 'client-gameplay-pause',
      paused: true,
      source,
    }))
    await paused
    const heldTick = host.state().tick
    const started = nextMessage(client.socket, message => (
      message.type === 'server-gameplay-resume-grace'
      && message.grace?.reason === reason
      && message.grace.remainingMs !== null
    ))
    client.socket.send(encodeGameMessage({
      type: 'client-gameplay-pause',
      paused: false,
    }))
    const activeGrace = await started
    assert.equal(activeGrace.type, 'server-gameplay-resume-grace')
    assert.ok((activeGrace.grace?.remainingMs ?? 0) > 1_900)
    const completed = nextMessage(client.socket, message => (
      message.type === 'server-gameplay-resume-grace' && message.grace === null
    ))
    await new Promise(resolve => setTimeout(resolve, 1_500))
    assert.equal(host.state().tick, heldTick)
    await completed
    await waitFor(() => host.state().tick > heldTick)
    assert.ok(host.state().tick - heldTick <= 10, `${source} replayed held time`)
  }
})

test('the authority can start a Boneyard from a stable private Hub room', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())

  const playerId = client.welcome.playerId
  const state = host.state()
  assert.equal(state.world.kind, 'hub')
  if (state.world.kind !== 'hub') assert.fail('expected Hub world')
  Object.assign(state, {
    playerEntities: replacePlayerCharacter(state.playerEntities, playerId, {
      ...getPlayerCharacter(state, playerId),
      position: { x: 512, y: 512 },
      velocity: { x: 0, y: 0 },
    }),
    world: {
      ...state.world,
      participants: {
        ...state.world.participants,
        [playerId]: {
          ...state.world.participants[playerId]!,
          region: 'library',
          transition: null,
        },
      },
    },
  })

  const loaded = nextMessage(client.socket, message => message.type === 'server-boneyard-loaded')
  client.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await loaded
  assert.equal(host.state().world.kind, 'boneyard')
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

test('game host replicates and checkpoints native NPC hint acknowledgement', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const playerId = client.welcome.playerId
  const initialRevision = getPlayerEconomy(host.state(), playerId).revision
  const snapshot = nextMessage(client.socket, message => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].economy.revision === initialRevision + 1
    && message.snapshot.players[playerId].economy.npc.helpFlags[0] === false
  ))
  const checkpoint = nextMessage(client.socket, message => (
    message.type === 'server-save-checkpoint'
    && JSON.parse(message.save).profile.economy.npc.helpFlags[0] === false
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-hub-action',
    action: { type: 'acknowledge-npc-hint', interactionId: 'annalist' },
  }))
  const [snapshotMessage, checkpointMessage] = await Promise.all([snapshot, checkpoint])
  assert.equal(snapshotMessage.type, 'server-snapshot')
  assert.equal(checkpointMessage.type, 'server-save-checkpoint')
  assert.equal(JSON.parse(checkpointMessage.save).schemaVersion, 26)
})

test('shared Hub NPC actions and late-join defaults stay bound to the authenticated player', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_HUB_AUTHENTICATION,
    sessionKind: 'global-hub',
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'ticket-first', FIRST_CHARACTER)
  const second = await join(host.address.url, 'ticket-second', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())
  const firstPlayerId = first.welcome.playerId
  const secondPlayerId = second.welcome.playerId
  const state = host.state()
  const firstEconomy = getPlayerEconomy(state, firstPlayerId)
  state.playerEntities = replacePlayerEconomy(state.playerEntities, firstPlayerId, {
    ...firstEconomy,
    gold: 10_000,
    revision: firstEconomy.revision + 1,
  })

  const firstBoast = nextMessage(first.socket, message => (
    message.type === 'server-snapshot'
    && message.snapshot.players[firstPlayerId].economy.npc.boast.selected === 0
  ))
  const secondBoastView = nextMessage(second.socket, message => (
    message.type === 'server-snapshot'
    && message.snapshot.players[firstPlayerId].economy.npc.boast.selected === 0
    && message.snapshot.players[secondPlayerId].economy.npc.boast.selected === null
  ))
  first.socket.send(encodeGameMessage({
    action: { boastId: 0, type: 'select-boast' },
    type: 'client-hub-action',
  }))
  await Promise.all([firstBoast, secondBoastView])

  const firstUnlock = nextMessage(first.socket, message => (
    message.type === 'server-snapshot'
    && message.snapshot.players[firstPlayerId].progression.advancedUnlocks[0] === true
  ))
  const secondUnlockView = nextMessage(second.socket, message => (
    message.type === 'server-snapshot'
    && message.snapshot.players[firstPlayerId].progression.advancedUnlocks[0] === true
    && message.snapshot.players[secondPlayerId].progression.advancedUnlocks[0] === false
  ))
  first.socket.send(encodeGameMessage({
    action: { skillId: 72, type: 'buy-teacher-spell' },
    type: 'client-hub-action',
  }))
  await Promise.all([firstUnlock, secondUnlockView])

  const late = await join(host.address.url, 'ticket-late', {
    discipline: 'body',
    displayName: 'Late',
    element: 'fire',
  })
  context.after(() => late.socket.close())
  const latePlayer = late.welcome.snapshot.players[late.welcome.playerId]
  assert.equal(latePlayer.economy.gold, 500)
  assert.deepEqual(latePlayer.economy.ownedPerkSelectors, [])
  assert.deepEqual(latePlayer.economy.storage, [])
  assert.equal(latePlayer.economy.npc.boast.selected, null)
  assert.equal(latePlayer.economy.npc.librarianLaceRead, false)
  assert.deepEqual(latePlayer.economy.dowsingOffers, [])
  assert.deepEqual(latePlayer.progression.advancedUnlocks, new Array<boolean>(8).fill(false))
  assert.equal(
    late.welcome.snapshot.players[firstPlayerId].progression.advancedUnlocks[0],
    true,
  )
  assert.equal(
    late.welcome.snapshot.players[secondPlayerId].progression.advancedUnlocks[0],
    false,
  )
})

test('game host authoritatively binds and replicates a native primary belt entry', async (context) => {
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
    && ((entry) => entry?.kind === 'skill' && entry.skillId === 8)(
      message.snapshot.players[playerId].belt[7],
    )
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-skill-quickbar-bind',
    skillId: 8,
    slot: 7,
  }))
  const snapshot = await bound
  assert.equal(snapshot.type, 'server-snapshot')
  assert.deepEqual(snapshot.snapshot.players[playerId].belt, [
    { kind: 'skill', skillId: 11 }, null, null,
    { kind: 'health-potion' }, { kind: 'mana-potion' }, null, null,
    { kind: 'skill', skillId: 8 },
  ])

  const unbound = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].belt[7] === null
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-skill-quickbar-bind',
    skillId: null,
    slot: 7,
  }))
  const cleared = await unbound
  assert.equal(cleared.type, 'server-snapshot')
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

  const pickerChat = nextMessage(client.socket, (message) => (
    message.type === 'server-chat' && message.text === 'Choosing a skill'
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-chat',
    channel: 'party',
    text: 'Choosing a skill',
  }))
  const deliveredPickerChat = await pickerChat
  assert.equal(deliveredPickerChat.type, 'server-chat')
  assert.equal(deliveredPickerChat.sender.playerId, playerId)
  assert.equal(host.state().tick, client.welcome.snapshot.tick)

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

test('multiplayer SkillPicker holds through final close then resumes without a timer', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())
  const loadedFirst = nextMessage(first.socket, message => (
    message.type === 'server-boneyard-loaded'
  ))
  const loadedSecond = nextMessage(second.socket, message => (
    message.type === 'server-boneyard-loaded'
  ))
  const initialReady = completeInitialGameplayReadiness([first.socket, second.socket])
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await Promise.all([loadedFirst, loadedSecond])
  await initialReady
  const active = host.state()
  Object.assign(active, grantGameSimulationPlayerExperience(
    active,
    first.welcome.playerId,
    100,
  ))
  Object.assign(active, grantGameSimulationPlayerExperience(
    active,
    second.welcome.playerId,
    100,
  ))
  assert.ok(getPlayerProgression(host.state(), first.welcome.playerId).pendingOffer)
  assert.ok(getPlayerProgression(host.state(), second.welcome.playerId).pendingOffer)

  let graceMessages = 0
  const observeGrace = (data: WebSocket.RawData) => {
    if (decodeServerGameMessage(data.toString()).type === 'server-gameplay-resume-grace') {
      graceMessages += 1
    }
  }
  first.socket.on('message', observeGrace)
  context.after(() => first.socket.off('message', observeGrace))
  await resolveEveryHostSkillOffer(host, first.socket, first.welcome.playerId)
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(graceMessages, 0)

  let secondProgression = getPlayerProgression(host.state(), second.welcome.playerId)
  while (secondProgression.pendingLevels.length > 1) {
    const intermediateOffer = secondProgression.pendingOffer
    assert.ok(intermediateOffer)
    second.socket.send(encodeGameMessage({
      type: 'client-select-skill',
      choiceIndex: 0,
      offerSequence: intermediateOffer.sequence,
      skillId: intermediateOffer.options[0]!.skillId,
    }))
    await waitFor(() => (
      getPlayerProgression(host.state(), second.welcome.playerId).pendingOffer?.sequence
        !== intermediateOffer.sequence
    ))
    secondProgression = getPlayerProgression(host.state(), second.welcome.playerId)
    assert.equal(graceMessages, 0)
  }
  const finalOffer = secondProgression.pendingOffer
  assert.ok(finalOffer)
  const heldTick = host.state().tick
  const graceStarted = nextMessage(first.socket, message => (
    message.type === 'server-gameplay-resume-grace' && message.grace !== null
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-select-skill',
    choiceIndex: 0,
    offerSequence: finalOffer.sequence,
    skillId: finalOffer.options[0]!.skillId,
  }))
  const pendingGrace = await graceStarted
  assert.equal(pendingGrace.type, 'server-gameplay-resume-grace')
  assert.equal(pendingGrace.grace?.reason, 'skill-picker-closed')
  assert.equal(pendingGrace.grace?.remainingMs, null)
  const released = nextMessage(first.socket, message => (
    message.type === 'server-gameplay-resume-grace'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-resume-grace-ready',
    sequence: pendingGrace.grace!.sequence,
  }))
  const release = await released
  assert.equal(release.type, 'server-gameplay-resume-grace')
  assert.equal(release.grace, null)
  await waitFor(() => host.state().tick > heldTick)
  assert.ok(host.state().tick - heldTick <= 10, 'picker close must not replay held wall time')
})

test('multiplayer Sorceror save uses the same no-timer picker close hold', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())
  const loadedFirst = nextMessage(
    first.socket,
    message => message.type === 'server-boneyard-loaded',
  )
  const loadedSecond = nextMessage(
    second.socket,
    message => message.type === 'server-boneyard-loaded',
  )
  const initialReady = completeInitialGameplayReadiness([first.socket, second.socket])
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await Promise.all([loadedFirst, loadedSecond])
  await initialReady

  const active = host.state()
  const playerId = second.welcome.playerId
  const withCharm = {
    ...active,
    playerEntities: replacePlayerEconomy(active.playerEntities, playerId, {
      ...getPlayerEconomy(active, playerId),
      ownedPerkSelectors: [17],
    }),
  }
  Object.assign(active, grantGameSimulationPlayerExperience(withCharm, playerId, 100))
  await resolveEveryHostSkillOffer(host, first.socket, first.welcome.playerId)
  const finalChooserState = host.state()
  assert.deepEqual(finalChooserState.levelUpBarrier?.pendingPlayerIds, [playerId])
  const offer = getPlayerProgression(finalChooserState, playerId).pendingOffer
  assert.ok(offer)
  const pendingHold = nextMessage(first.socket, message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace?.reason === 'skill-picker-closed'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-level-up-action',
    action: 'save',
    offerSequence: offer.sequence,
  }))
  const pending = await pendingHold
  assert.equal(pending.type, 'server-gameplay-resume-grace')
  assert.equal(pending.grace?.remainingMs, null)
  assert.equal(host.state().levelUpBarrier, null)
  assert.equal(getPlayerProgression(host.state(), playerId).deferredSkillChoices, 1)
  const heldTick = host.state().tick
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(host.state().tick, heldTick)

  const released = nextMessage(first.socket, message => (
    message.type === 'server-gameplay-resume-grace'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-resume-grace-ready',
    sequence: pending.grace!.sequence,
  }))
  const release = await released
  assert.equal(release.type, 'server-gameplay-resume-grace')
  assert.equal(release.grace, null)
  await waitFor(() => host.state().tick > heldTick)
  assert.ok(host.state().tick - heldTick <= 10, 'saved picker close must not replay held time')
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

test('game host authoritatively projects each player belt and rejects unlearned selections', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  const assigned = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && ((entry) => entry?.kind === 'skill' && entry.skillId === 11)(
      message.snapshot.players[first.welcome.playerId].belt[7],
    )
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-skill-quickbar-bind',
    skillId: 11,
    slot: 7,
  }))
  const assignedSnapshot = await assigned
  assert.equal(assignedSnapshot.type, 'server-snapshot')
  assert.deepEqual(
    assignedSnapshot.snapshot.players[first.welcome.playerId].belt,
    [
      { kind: 'skill', skillId: 11 }, null, null,
      { kind: 'health-potion' }, { kind: 'mana-potion' }, null, null,
      { kind: 'skill', skillId: 11 },
    ],
  )
  assert.deepEqual(
    assignedSnapshot.snapshot.players[second.welcome.playerId].belt,
    [
      { kind: 'skill', skillId: 35 }, null, null,
      { kind: 'health-potion' }, { kind: 'mana-potion' }, null, null, null,
    ],
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
  const initialReady = completeInitialGameplayReadiness([client.socket])
  client.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await loaded
  await initialReady
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
  const concentrationBound = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && ((entry) => entry?.kind === 'skill' && entry.skillId === 57)(
      message.snapshot.players[playerId].belt[7],
    )
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-skill-quickbar-bind',
    skillId: 57,
    slot: 7,
  }))
  await concentrationBound
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

test('global Hub fixture factory owns the actual shared world', async (context) => {
  let factoryCalls = 0
  const host = await startGameHost({
    authentication: SHARED_HUB_AUTHENTICATION,
    createSimulation: () => {
      factoryCalls += 1
      return createGameSimulation({}, {
        hubSkorchaHiddenTicks: 3_000,
        hubSkorchaVisibleTicks: 12_000,
        hubStudentPopulation: createHubStudentFixturePopulation({ count: 0, seed: 4 }),
        hubTraderAnimationSeed: 4,
      })
    },
    sessionKind: 'global-hub',
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  assert.equal(factoryCalls, 1)
  const sharedState = host.state()
  assert.equal(sharedState.world.kind, 'hub')
  if (sharedState.world.kind !== 'hub') throw new Error('expected shared Hub')
  assert.equal(sharedState.world.skorcha, null)
  assert.ok(sharedState.world.skorchaTransitionTicksRemaining <= 3_000)
  assert.ok(sharedState.world.skorchaTransitionTicksRemaining > 2_900)

  const client = await join(host.address.url, 'ticket-fixture', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  assert.equal(client.welcome.sessionKind, 'global-hub')
  assert.equal(client.welcome.snapshot.world.kind, 'hub')
  if (client.welcome.snapshot.world.kind !== 'hub') throw new Error('expected Hub snapshot')
  assert.equal(client.welcome.snapshot.world.skorcha, null)
  assert.deepEqual(client.welcome.snapshot.world.students, [])
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

  assert.equal(host.capacityParticipantCount(), 1)
  await waitFor(() => host.capacityParticipantCount() === 0)
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
  await waitFor(() => host.capacityParticipantCount() === 0)

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
  assert.equal(host.capacityParticipantCount(), 1)
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

test('game host bounds stale baseline recovery while healthy peers keep receiving', async (context) => {
  const logs: GameServerLogEntry[] = []
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    log: entry => logs.push(entry),
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const stalled = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const healthy = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => closeSocket(stalled.socket))
  context.after(() => closeSocket(healthy.socket))

  const stalledSnapshots: ServerSnapshotMessage[] = []
  const healthySnapshots: ServerSnapshotMessage[] = []
  stalled.socket.on('message', (data) => {
    const message = decodeServerGameMessage(data.toString())
    if (message.type === 'server-snapshot') stalledSnapshots.push(message)
  })
  healthy.socket.on('message', (data) => {
    const message = decodeServerGameMessage(data.toString())
    if (message.type !== 'server-snapshot') return
    healthySnapshots.push(message)
    healthy.socket.send(encodeGameMessage({
      type: 'client-snapshot-ack',
      requireKeyframe: false,
      sequence: message.sequence,
    }))
  })

  await waitFor(() => stalledSnapshots.length >= 80 && healthySnapshots.length >= 80)
  const backlog = [...stalledSnapshots]
  const recoveryFloor = backlog.at(-1)!.sequence
  for (const message of backlog) {
    stalled.socket.send(encodeGameMessage({
      type: 'client-snapshot-ack',
      requireKeyframe: false,
      sequence: message.sequence,
    }))
  }
  await waitFor(() => stalledSnapshots.some(message => (
    message.sequence > recoveryFloor
    && message.frame.world.entities.keyframe
  )))
  const recovery = stalledSnapshots.find(message => (
    message.sequence > recoveryFloor
    && message.frame.world.entities.keyframe
  ))!
  const stalledFramesAtRecovery = stalledSnapshots.length
  const healthyFramesAtRecovery = healthySnapshots.length
  await new Promise(resolve => setTimeout(resolve, 100))

  assert.equal(stalledSnapshots.length, stalledFramesAtRecovery)
  assert.ok(healthySnapshots.length > healthyFramesAtRecovery)
  const warnings = logs.filter(entry => (
    entry.event === 'replication.baseline_missing'
    && entry.details?.connectionRole === 'player'
  ))
  assert.equal(warnings.length, 1)
  assert.equal(logs.some(entry => entry.event === 'replication.baseline_recovered'), false)

  stalled.socket.send(encodeGameMessage({
    type: 'client-snapshot-ack',
    requireKeyframe: false,
    sequence: recovery.sequence,
  }))
  await waitFor(() => stalledSnapshots.length > stalledFramesAtRecovery)
  const resumed = stalledSnapshots[stalledFramesAtRecovery]!
  assert.equal(resumed.frame.world.entities.keyframe, false)
  assert.equal(resumed.frame.world.entities.baselineSequence, recovery.sequence)
  await waitFor(() => logs.some(entry => (
    entry.event === 'replication.baseline_recovered'
    && entry.details?.connectionRole === 'player'
  )))
  const recovered = logs.find(entry => (
    entry.event === 'replication.baseline_recovered'
    && entry.details?.connectionRole === 'player'
  ))
  assert.equal(recovered?.details?.recoveryKeyframeSequence, recovery.sequence)
  assert.ok(Number(recovered?.details?.staleAcknowledgementCount) > 1)
  assert.equal(stalled.socket.readyState, WebSocket.OPEN)
  assert.equal(healthy.socket.readyState, WebSocket.OPEN)
})

test('game host reconnects a new character at the active world spawn', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())

  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  assert.deepEqual(first.welcome.snapshot.players[first.welcome.playerId].position, HUB_SPAWN)
  await closeSocket(first.socket)
  await waitFor(() => host.capacityParticipantCount() === 0)

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
    onlinePreferences: ONLINE_PREFERENCES,
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
  assert.equal(saved.schemaVersion, 26)
  assert.equal(saved.profile.economy.tutorialPending, true)
  assert.equal(saved.continuation.summary.partyRejoinToken, null)
  assert.equal(saved.continuation.simulation.world.tutorial.stage, 0)
})

test('Tutorial Game Over clears its Boneyard before the first College checkpoint', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const loaded = nextMessage(client.socket, message => message.type === 'server-boneyard-loaded')
  client.socket.send(encodeGameMessage({ type: 'client-start-tutorial' }))
  await loaded

  const checkpoint = nextMessage(client.socket, message => (
    message.type === 'server-save-checkpoint'
    && JSON.parse(message.save).continuation?.simulation?.world?.kind === 'hub'
  ))
  Object.assign(host.state().run, {
    gameOverEventId: 1,
    gameOverExitKind: 'automatic',
    gameOverExitTicks: GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
    gameOverTicks: 1_200,
    nextGameOverEventId: 2,
    phase: 'game-over',
  })

  const message = await checkpoint
  assert.equal(message.type, 'server-save-checkpoint')
  const raw = JSON.parse(message.save)
  assert.equal(raw.continuation.loadedBoneyard, null)
  const restored = restoreGameSaveDocument(message.save)
  assert.equal(restored.loadedBoneyard, null)
  assert.equal(restored.state.world.kind, 'hub')
  if (restored.state.world.kind !== 'hub') throw new Error('expected College continuation')
  assert.equal(
    restored.state.world.participants[client.welcome.playerId]?.collegeIntro?.phase,
    'courtyard-walk',
  )
})

test('shared-Hub Tutorial College deployment checkpoint detaches the completed Boneyard', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_HUB_AUTHENTICATION,
    sessionKind: 'global-hub',
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'ticket-college-deployment', FIRST_CHARACTER)
  const loaded = nextMessage(client.socket, message => message.type === 'server-boneyard-loaded')
  client.socket.send(encodeGameMessage({ type: 'client-start-tutorial' }))
  await loaded

  const tutorial = host.playerState(client.welcome.playerId)
  assert.ok(tutorial)
  Object.assign(tutorial.run, {
    gameOverEventId: 1,
    gameOverExitKind: 'automatic',
    gameOverExitTicks: GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
    gameOverTicks: 1_200,
    nextGameOverEventId: 2,
    phase: 'game-over',
  })
  await waitFor(() => host.playerState(client.welcome.playerId)?.world.kind === 'hub')
  placeCollegeAdmissionAtArch(host, client.welcome.playerId)
  const archState = host.playerState(client.welcome.playerId)
  assert.equal(
    archState?.world.kind === 'hub'
      ? archState.world.participants[client.welcome.playerId]?.collegeIntro?.phase
      : null,
    'arch-dialogue',
  )

  const targetRevision = 'c'.repeat(40)
  const deployment = deploymentMessages(client.socket)
  const closed = socketClose(client.socket)
  const restarting = host.restartForDeployment(targetRevision, 1_000)
  const { checkpoint, restart } = await deployment
  assert.equal(restart.checkpointSequence, checkpoint.sequence)
  const raw = JSON.parse(checkpoint.save)
  assert.equal(raw.continuation.simulation.world.kind, 'hub')
  assert.equal(raw.continuation.loadedBoneyard, null)
  const restored = restoreGameSaveDocument(checkpoint.save)
  assert.equal(restored.loadedBoneyard, null)
  assert.equal(
    restored.state.world.kind === 'hub'
      ? restored.state.world.participants[client.welcome.playerId]?.collegeIntro?.phase
      : null,
    'arch-dialogue',
  )
  client.socket.send(encodeGameMessage({
    type: 'client-deployment-ready',
    checkpointSequence: restart.checkpointSequence,
    targetRevision,
  }))
  assert.deepEqual(await restarting, {
    players: 1,
    savedPlayers: 1,
    unacknowledgedPlayers: 0,
  })
  assert.deepEqual(await closed, { code: 1012, reason: 'game updating' })

  const replacement = await startGameHost({
    authentication: SHARED_HUB_AUTHENTICATION,
    sessionKind: 'global-hub',
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => replacement.close())
  const resumedSocket = await openSocket(replacement.address.url)
  context.after(() => resumedSocket.close())
  resumedSocket.send(encodeGameMessage({
    type: 'client-hello',
    onlinePreferences: ONLINE_PREFERENCES,
    profile: EMPTY_PLAYER_PROFILE,
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'ticket-college-deployment',
    character: FIRST_CHARACTER,
    save: checkpoint.save,
    saveIntent: 'resume',
  }))
  const welcome = await nextMessage(resumedSocket, message => message.type === 'server-welcome')
  assert.equal(welcome.type, 'server-welcome')
  assert.equal(welcome.snapshot.world.kind, 'hub')
  assert.equal(
    welcome.snapshot.world.kind === 'hub'
      ? welcome.snapshot.world.participants[welcome.playerId]?.collegeIntro?.phase
      : null,
    'arch-dialogue',
  )
})

test('private College retires a restored Tutorial when its final actor disconnects', async (context) => {
  const logs: GameServerLogEntry[] = []
  const runtimeEvents: string[] = []
  const loadedBoneyard = materializeStockTutorial(Buffer.alloc(16, 31))
  const host = await startGameHost({
    authentication: {
      kind: 'tickets',
      claim: credential => credential === 'tutorial-ticket'
        ? { content: EMPTY_SHARED_CONTENT, leaderboardUserId: 42 }
        : null,
    },
    log: entry => logs.push(entry),
    runtimeEvents: entry => runtimeEvents.push(entry.event),
    sessionKind: 'private-college',
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const socket = await openSavedRunSocket(
    host.address.url,
    'tutorial-ticket',
    savedRunDocument(loadedBoneyard),
  )

  await closeSocket(socket)
  await waitFor(() => host.humanPlayerCount() === 0)
  await new Promise(resolve => setTimeout(resolve, 50))

  assert.equal(host.capacityParticipantCount(), 0)
  assert.equal(host.runCount(), 0)
  assert.equal(host.loadedBoneyard(), null)
  assert.equal(host.state().world.kind, 'hub')
  assert.equal(logs.some(entry => entry.level === 'error'), false)
  assert.equal(logs.filter(entry => entry.event === 'run.retired_empty').length, 1)
  assert.equal(runtimeEvents.includes('run.retired_empty'), false)
})

test('shared Hub recovers legacy saved Road links before its first Boneyard payload', async (context) => {
  const logs: GameServerLogEntry[] = []
  const loadedBoneyard = materializeBoneyard(
    createBoneyardCatalog(),
    'default-random',
    Buffer.alloc(16, 33),
  )
  assert.ok(loadedBoneyard)
  const host = await startGameHost({
    authentication: SHARED_HUB_AUTHENTICATION,
    log: entry => logs.push(entry),
    sessionKind: 'global-hub',
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const socket = await openSocket(host.address.url)
  context.after(() => socket.close())
  const welcomeMessage = nextMessage(socket, message => message.type === 'server-welcome')
  const loadedMessage = nextMessage(socket, message => message.type === 'server-boneyard-loaded')
  socket.send(encodeGameMessage({
    type: 'client-hello',
    onlinePreferences: ONLINE_PREFERENCES,
    profile: EMPTY_PLAYER_PROFILE,
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'ticket-legacy-road-resume',
    character: FIRST_CHARACTER,
    save: legacyRoadSaveDocument(savedRunDocument(loadedBoneyard)),
    saveIntent: 'resume',
  }))

  const [welcome, loaded] = await Promise.all([welcomeMessage, loadedMessage])
  assert.equal(welcome.type, 'server-welcome')
  assert.equal(loaded.type, 'server-boneyard-loaded')
  assert.deepEqual(
    loaded.boneyard.scene.roads.map(road => road.linkMask),
    loadedBoneyard.scene.roads.map(road => road.linkMask),
  )

  const leave = leaveSaveMessages(socket, 1)
  socket.send(encodeGameMessage({ type: 'client-save-before-leave', requestId: 1 }))
  const { checkpoint } = await leave
  const restored = restoreGameSaveDocument(checkpoint.save)
  assert.deepEqual(
    restored.loadedBoneyard?.scene.roads.map(road => road.linkMask),
    loadedBoneyard.scene.roads.map(road => road.linkMask),
  )
  assert.equal(logs.some(entry => entry.level === 'error'), false)
})

test('solo active-run restart waits for renderer readiness before its countdown', async (context) => {
  const loadedBoneyard = materializeBoneyard(
    createBoneyardCatalog(),
    'default-random',
    Buffer.alloc(16, 33),
  )
  assert.ok(loadedBoneyard)
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const socket = await openSocket(host.address.url)
  context.after(() => socket.close())
  socket.send(encodeGameMessage({
    type: 'client-hello',
    onlinePreferences: ONLINE_PREFERENCES,
    profile: EMPTY_PLAYER_PROFILE,
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'test-secret',
    character: FIRST_CHARACTER,
    save: savedRunDocument(loadedBoneyard),
    saveIntent: 'resume',
  }))
  const welcome = await nextMessage(socket, message => message.type === 'server-welcome')
  assert.equal(welcome.type, 'server-welcome')
  assert.equal(welcome.gameplayResumeGrace?.reason, 'game-restarted')
  assert.equal(welcome.gameplayResumeGrace?.remainingMs, null)
  const heldTick = host.state().tick
  await new Promise(resolve => setTimeout(resolve, 80))
  assert.equal(host.state().tick, heldTick)

  const counting = nextMessage(socket, message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace?.remainingMs !== null
  ))
  socket.send(encodeGameMessage({
    type: 'client-resume-grace-ready',
    sequence: welcome.gameplayResumeGrace!.sequence,
  }))
  const grace = await counting
  assert.equal(grace.type, 'server-gameplay-resume-grace')
  assert.equal(grace.grace?.reason, 'game-restarted')
  assert.ok((grace.grace?.remainingMs ?? 0) > 1_900)
  assert.ok((grace.grace?.remainingMs ?? Infinity) <= 2_000)
  await new Promise(resolve => setTimeout(resolve, 80))
  assert.equal(host.state().tick, heldTick)
})

test('private College retires an ordinary Boneyard instead of ticking it without actors', async (context) => {
  const logs: GameServerLogEntry[] = []
  const runtimeEvents: string[] = []
  const loadedBoneyard = materializeBoneyard(
    createBoneyardCatalog(),
    'default-random',
    Buffer.alloc(16, 32),
  )
  assert.ok(loadedBoneyard)
  const host = await startGameHost({
    authentication: {
      kind: 'tickets',
      claim: credential => credential === 'ordinary-ticket'
        ? { content: EMPTY_SHARED_CONTENT, leaderboardUserId: 42 }
        : null,
    },
    log: entry => logs.push(entry),
    runtimeEvents: entry => runtimeEvents.push(entry.event),
    sessionKind: 'private-college',
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const socket = await openSavedRunSocket(
    host.address.url,
    'ordinary-ticket',
    savedRunDocument(loadedBoneyard),
  )

  await closeSocket(socket)
  await waitFor(() => host.humanPlayerCount() === 0)
  await new Promise(resolve => setTimeout(resolve, 50))

  assert.equal(host.capacityParticipantCount(), 0)
  assert.equal(host.runCount(), 0)
  assert.equal(host.loadedBoneyard(), null)
  assert.equal(host.state().world.kind, 'hub')
  assert.equal(logs.some(entry => entry.level === 'error'), false)
  assert.equal(logs.filter(entry => entry.event === 'run.retired_empty').length, 1)
  assert.equal(runtimeEvents.includes('run.retired_empty'), false)
})

test('shared Hub retires the stock Tutorial when its final actor disconnects', async (context) => {
  const logs: GameServerLogEntry[] = []
  const runtimeEvents: string[] = []
  const host = await startGameHost({
    authentication: SHARED_HUB_AUTHENTICATION,
    log: entry => logs.push(entry),
    runtimeEvents: entry => runtimeEvents.push(entry.event),
    sessionKind: 'global-hub',
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'ticket-tutorial-final-actor', FIRST_CHARACTER)
  const loaded = nextMessage(client.socket, message => message.type === 'server-boneyard-loaded')
  client.socket.send(encodeGameMessage({ type: 'client-start-tutorial' }))
  const loadedMessage = await loaded
  assert.equal(loadedMessage.type, 'server-boneyard-loaded')
  assert.equal(loadedMessage.boneyard.choice.id, 'stock-tutorial')

  await closeSocket(client.socket)
  await waitFor(() => host.humanPlayerCount() === 0)
  await new Promise(resolve => setTimeout(resolve, 50))

  assert.equal(host.capacityParticipantCount(), 0)
  assert.equal(host.runCount(), 0)
  assert.equal(host.partyCount(), 0)
  assert.deepEqual(host.observationTargets(), [])
  assert.equal(logs.some(entry => entry.level === 'error'), false)
  assert.equal(logs.filter(entry => entry.event === 'run.retired_empty').length, 1)
  assert.equal(runtimeEvents.includes('run.retired_empty'), false)
})

test('the stock Tutorial is not announced as an ordinary Boneyard match', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_HUB_AUTHENTICATION,
    sessionKind: 'global-hub',
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const learner = await join(host.address.url, 'ticket-learner', FIRST_CHARACTER)
  const watcher = await join(host.address.url, 'ticket-watcher', SECOND_CHARACTER)
  context.after(() => learner.socket.close())
  context.after(() => watcher.socket.close())
  const watcherChat = collectChatMessages(watcher.socket)
  context.after(watcherChat.stop)
  const loaded = nextMessage(learner.socket, message => message.type === 'server-boneyard-loaded')
  learner.socket.send(encodeGameMessage({ type: 'client-start-tutorial' }))
  const tutorial = await loaded
  assert.equal(tutorial.type, 'server-boneyard-loaded')
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(watcherChat.messages.some(message => (
    message.type === 'server-chat' && message.activity === 'searching-solomon'
  )), false)
})

test('a fresh vanilla private College can start the Tutorial without global-score eligibility', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_HUB_AUTHENTICATION,
    sessionKind: 'private-college',
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'ticket-private-tutorial', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const loaded = nextMessage(client.socket, message => message.type === 'server-boneyard-loaded')
  client.socket.send(encodeGameMessage({ type: 'client-start-tutorial' }))
  const tutorial = await loaded
  assert.equal(tutorial.type, 'server-boneyard-loaded')
  assert.equal(tutorial.boneyard.choice.id, 'stock-tutorial')
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
  await waitFor(() => host.capacityParticipantCount() === 0)
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
    onlinePreferences: ONLINE_PREFERENCES,
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
    onlinePreferences: ONLINE_PREFERENCES,
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
  const initialReady = completeInitialGameplayReadiness([first.socket])
  first.socket.send(encodeGameMessage({ type: 'client-start-tutorial' }))
  const loaded = await loadedMessage
  await initialReady
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
  const watcher = await join(host.address.url, 'ticket-watcher', {
    ...SECOND_CHARACTER,
    displayName: 'Watcher',
  })
  context.after(() => watcher.socket.close())
  const watcherChat = collectChatMessages(watcher.socket)
  context.after(watcherChat.stop)

  const rejectedSocket = await openSocket(host.address.url)
  context.after(() => rejectedSocket.close())
  const rejectedMessage = nextMessage(rejectedSocket, message => (
    message.type === 'server-disconnect'
  ))
  rejectedSocket.send(encodeGameMessage({
    type: 'client-hello',
    onlinePreferences: ONLINE_PREFERENCES,
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
  assert.equal(host.capacityParticipantCount(), 2)

  const firstClosed = socketClose(first.socket)
  const replacementSocket = await openSocket(host.address.url)
  context.after(() => replacementSocket.close())
  const replacementMessage = nextMessage(replacementSocket, message => (
    message.type === 'server-welcome'
  ))
  replacementSocket.send(encodeGameMessage({
    type: 'client-hello',
    onlinePreferences: ONLINE_PREFERENCES,
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
    code: GAME_SESSION_REPLACED_CLOSE_CODE,
    reason: 'wizard resumed in another browser',
  })
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(host.capacityParticipantCount(), 2)
  assert.equal(host.playerState(replacement.playerId)?.world.kind, 'boneyard')
  assert.equal(watcherChat.messages.some(message => (
    message.type === 'server-chat'
    && message.activity === 'left-game'
    && message.sender.playerId === replacement.playerId
  )), false)
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
    onlinePreferences: ONLINE_PREFERENCES,
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
  const nativeSource = {
    darkdataBase64: 'AA==',
    darkdataSha256: '0'.repeat(64),
    gamestateBase64: 'AA==',
    gamestateSha256: '1'.repeat(64),
    retainedFiles: [],
    runName: '_survival',
  }
  const active = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    nativeSource,
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
    onlinePreferences: ONLINE_PREFERENCES,
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
  const leaving = leaveSaveMessages(socket, 91)
  socket.send(encodeGameMessage({ type: 'client-save-before-leave', requestId: 91 }))
  const checkpoint = await leaving
  assert.deepEqual(
    JSON.parse(checkpoint.checkpoint.save).nativeSource,
    nativeSource,
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

test('saved party member catches up detached while the live party run continues', async (context) => {
  const { checkpoint, host, leader, member, memberRun, tickets, token } =
    await startDetachedPartyRun(context)

  const retainedPartyState = nextMessage(leader.socket, message => (
    message.type === 'server-party-state'
    && message.state.partyRoster.some(row => (
      row.playerId === member.welcome.playerId && !row.connected
    ))
  ))
  await closeSocket(member.socket)
  await waitFor(() => host.humanPlayerCount() === 1)
  const retainedParty = await retainedPartyState
  assert.equal(retainedParty.type, 'server-party-state')
  assert.equal(retainedParty.state.party.leaderPlayerId, leader.welcome.playerId)
  assert.deepEqual(retainedParty.state.party.memberPlayerIds, [
    leader.welcome.playerId,
    member.welcome.playerId,
  ])
  assert.equal(
    retainedParty.state.partyRoster.find(row => row.playerId === member.welcome.playerId)
      ?.displayName,
    SECOND_CHARACTER.displayName,
  )
  assert.equal(host.capacityParticipantCount(), 2, 'the detached wizard keeps one capacity slot')
  assert.equal(host.partyRejoinTarget(token)?.status, 'detached')

  const active = host.playerState(leader.welcome.playerId)
  assert.ok(active)
  Object.assign(
    active,
    grantGameSimulationPlayerExperience(active, leader.welcome.playerId, 300),
  )
  await waitFor(() => host.playerState(leader.welcome.playerId)?.levelUpBarrier !== null)
  await resolveEveryHostSkillOffer(host, leader.socket, leader.welcome.playerId)
  assert.equal(host.playerState(leader.welcome.playerId)?.levelUpBarrier, null)

  const reservationId = 'active-party-rejoin-reservation'
  const target = host.partyRejoinTarget(token)
  assert.ok(target)
  assert.equal(host.reservePartyRejoin(token, reservationId, performance.now() + 5_000), null)
  assert.equal(host.partyRejoinTarget(token)?.status, 'reserved')
  tickets.set('rejoin-ticket', {
    content: target.content,
    developerAccess: target.developerAccess,
    leaderboardUserId: target.leaderboardUserId,
    partyRejoinToken: token,
    reservationId,
  })

  const returningSocket = await openSocket(host.address.url)
  context.after(() => returningSocket.close())
  const detachedLeader = nextMessage(leader.socket, message => (
    message.type === 'server-snapshot'
    && message.snapshot.world.kind === 'boneyard'
    && message.snapshot.players[member.welcome.playerId] === undefined
  ))
  const returningWelcome = nextMessage(returningSocket, message => message.type === 'server-welcome')
  const rotatedCheckpoint = nextMessage(returningSocket, message => (
    message.type === 'server-save-checkpoint'
    && JSON.parse(message.save).continuation.summary.partyRejoinToken !== token
  ))
  returningSocket.send(encodeGameMessage({
    type: 'client-hello',
    onlinePreferences: ONLINE_PREFERENCES,
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'rejoin-ticket',
    character: SECOND_CHARACTER,
    save: checkpoint.save,
    saveIntent: 'resume',
  }))
  const [welcome, leaderView] = await Promise.all([returningWelcome, detachedLeader])
  if (welcome.type !== 'server-welcome') assert.fail('expected rejoin welcome')
  assert.equal(leaderView.type, 'server-snapshot')
  assert.equal(welcome.playerId, member.welcome.playerId)
  assert.equal(welcome.snapshot.world.kind, 'boneyard')
  if (welcome.snapshot.world.kind !== 'boneyard') assert.fail('expected live Boneyard')
  assert.equal(welcome.snapshot.world.runId, memberRun.boneyard.runId)
  assert.deepEqual(welcome.snapshot.players[welcome.playerId].position, {
    x: memberRun.boneyard.scene.spawn.x,
    y: memberRun.boneyard.scene.spawn.y,
  })
  assert.equal(welcome.snapshot.players[welcome.playerId].progression.level, 4)
  assert.deepEqual(welcome.snapshot.materializingPlayerIds, [welcome.playerId])
  assert.ok(welcome.snapshot.players[welcome.playerId].progression.pendingOffer)
  assert.equal(host.playerState(welcome.playerId), null)
  assert.equal(host.partyRejoinTarget(token)?.status, 'staging')
  assert.deepEqual(welcome.gameplayResumeGrace, {
    reason: 'game-rejoined',
    remainingMs: null,
    sequence: welcome.gameplayResumeGrace?.sequence,
  })
  returningSocket.send(encodeGameMessage({
    type: 'client-resume-grace-ready',
    sequence: welcome.gameplayResumeGrace!.sequence,
  }))
  leader.socket.send(encodeGameMessage({
    type: 'client-resume-grace-ready',
    sequence: welcome.gameplayResumeGrace!.sequence,
  }))

  const heldTick = host.playerState(leader.welcome.playerId)!.tick
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(host.playerState(leader.welcome.playerId)!.tick, heldTick)
  const stackedCatchUp = nextMessage(returningSocket, message => (
    message.type === 'server-snapshot'
    && (message.snapshot.players[welcome.playerId]?.progression.level ?? 0) > 4
  ))
  const liveBeforeStack = host.playerState(leader.welcome.playerId)
  assert.ok(liveBeforeStack)
  Object.assign(
    liveBeforeStack,
    grantGameSimulationPlayerExperience(liveBeforeStack, leader.welcome.playerId, 1_000),
  )
  await waitFor(() => host.playerState(leader.welcome.playerId)?.levelUpBarrier !== null)
  await resolveEveryHostSkillOffer(host, leader.socket, leader.welcome.playerId)
  const stackedUpdate = await stackedCatchUp
  if (stackedUpdate.type !== 'server-snapshot') assert.fail('expected stacked catch-up snapshot')
  assert.equal(host.playerState(leader.welcome.playerId)?.levelUpBarrier, null)
  const tickAfterPeerChoices = host.playerState(leader.welcome.playerId)!.tick
  await new Promise(resolve => setTimeout(resolve, 40))
  assert.equal(host.playerState(leader.welcome.playerId)!.tick, tickAfterPeerChoices)

  const resumeGraceStarted = nextMessage(returningSocket, message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace?.remainingMs !== null
  ))
  let catchUpSnapshot = stackedUpdate.snapshot
  let catchUpChoices = 0
  while (catchUpSnapshot.players[welcome.playerId]?.progression.pendingOffer) {
    const offer = catchUpSnapshot.players[welcome.playerId]!.progression.pendingOffer!
    const next = nextMessage(returningSocket, message => (
      message.type === 'server-snapshot'
      && message.snapshot.players[welcome.playerId]?.progression.pendingOffer?.sequence
        !== offer.sequence
    ))
    returningSocket.send(encodeGameMessage({
      type: 'client-select-skill',
      choiceIndex: 0,
      offerSequence: offer.sequence,
      skillId: offer.options[0]!.skillId,
    }))
    const update = await next
    if (update.type !== 'server-snapshot') assert.fail('expected catch-up snapshot')
    catchUpSnapshot = update.snapshot
    catchUpChoices += 1
  }
  assert.ok(catchUpChoices > 3)
  await waitFor(() => host.playerState(welcome.playerId) !== null)
  const countingGrace = await resumeGraceStarted
  assert.equal(countingGrace.type, 'server-gameplay-resume-grace')
  assert.equal(countingGrace.grace?.reason, 'game-rejoined')
  assert.ok((countingGrace.grace?.remainingMs ?? 0) > 1_900)
  assert.ok((countingGrace.grace?.remainingMs ?? Infinity) <= 2_000)
  assert.deepEqual(catchUpSnapshot.materializingPlayerIds, [])
  assert.equal(host.playerState(welcome.playerId)?.levelUpBarrier, null)
  const rotated = await rotatedCheckpoint
  assert.equal(rotated.type, 'server-save-checkpoint')
  const rotatedToken = JSON.parse(rotated.save).continuation.summary.partyRejoinToken
  assert.match(rotatedToken, /^sdrpr2\./)
  assert.notEqual(rotatedToken, token)
  assert.equal(host.partyRejoinTarget(token)?.status, 'connected')

  await closeSocket(leader.socket)
  await waitFor(() => host.humanPlayerCount() === 1)
  assert.equal(host.runCount(), 1)
  await closeSocket(returningSocket)
  await waitFor(() => host.humanPlayerCount() === 0 && host.runCount() === 0)
  assert.equal(host.capacityParticipantCount(), 0)
  assert.equal(host.partyCount(), 0)
  assert.equal(host.partyRejoinTarget(token), null)
  assert.equal(host.partyRejoinTarget(rotatedToken), null)
})

test('staged catch-up loses its capability when the final live peer disconnects', async (context) => {
  const { checkpoint, host, leader, logs, member, tickets, token } =
    await startDetachedPartyRun(context)
  await closeSocket(member.socket)
  await waitFor(() => host.humanPlayerCount() === 1)

  const active = host.playerState(leader.welcome.playerId)
  assert.ok(active)
  Object.assign(
    active,
    grantGameSimulationPlayerExperience(active, leader.welcome.playerId, 300),
  )
  await waitFor(() => host.playerState(leader.welcome.playerId)?.levelUpBarrier !== null)
  await resolveEveryHostSkillOffer(host, leader.socket, leader.welcome.playerId)

  const target = host.partyRejoinTarget(token)
  assert.ok(target)
  const reservationId = 'staged-final-peer-reservation'
  assert.equal(host.reservePartyRejoin(token, reservationId, performance.now() + 5_000), null)
  tickets.set('staged-rejoin-ticket', {
    content: target.content,
    developerAccess: target.developerAccess,
    leaderboardUserId: target.leaderboardUserId,
    partyRejoinToken: token,
    reservationId,
  })

  const returningSocket = await openSocket(host.address.url)
  context.after(() => returningSocket.close())
  const returningWelcome = nextMessage(returningSocket, message => message.type === 'server-welcome')
  returningSocket.send(encodeGameMessage({
    type: 'client-hello',
    onlinePreferences: ONLINE_PREFERENCES,
    profile: EMPTY_PLAYER_PROFILE,
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'staged-rejoin-ticket',
    character: SECOND_CHARACTER,
    save: checkpoint.save,
    saveIntent: 'resume',
  }))
  const welcome = await returningWelcome
  if (welcome.type !== 'server-welcome') assert.fail('expected staged rejoin welcome')
  assert.deepEqual(welcome.snapshot.materializingPlayerIds, [member.welcome.playerId])
  assert.equal(host.partyRejoinTarget(token)?.status, 'staging')

  const returningClosed = socketClose(returningSocket)
  await closeSocket(leader.socket)
  assert.deepEqual(await returningClosed, {
    code: 1000,
    reason: 'active party run ended',
  })
  await waitFor(() => host.humanPlayerCount() === 0 && host.runCount() === 0)
  assert.equal(host.capacityParticipantCount(), 0)
  assert.equal(host.partyCount(), 0)
  assert.equal(host.partyRejoinTarget(token), null)
  assert.equal(logs.some(entry => entry.level === 'error'), false)
})

test('last living disconnect holds a dead connected party before Game Over', async (context) => {
  const { host, leader, member } = await startDetachedPartyRun(context)
  const paused = nextMessage(member.socket, message => (
    message.type === 'server-gameplay-pause' && message.pause !== null
  ))
  member.socket.send(encodeGameMessage({
    type: 'client-gameplay-pause',
    paused: true,
    source: 'skill-book',
  }))
  await paused

  const memberState = host.playerState(member.welcome.playerId)
  assert.ok(memberState)
  const memberIndex = memberState.playerEntities.identities.findIndex(({ playerId }) => (
    playerId === member.welcome.playerId
  ))
  assert.notEqual(memberIndex, -1)
  Object.assign(memberState.playerEntities.progressions[memberIndex]!, {
    currentHealth: 0,
    lifeState: 'spectating',
  })
  assert.equal(
    host.playerState(member.welcome.playerId)?.playerEntities.progressions[memberIndex]?.lifeState,
    'spectating',
  )

  const waiting = nextMessage(member.socket, message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace?.remainingMs === null
    && String(message.grace.reason) === 'party-rejoin-wait'
  ))
  await closeSocket(leader.socket)
  const hold = await waiting
  assert.equal(hold.type, 'server-gameplay-resume-grace')
  assert.equal(String(hold.grace?.reason), 'party-rejoin-wait')

  const unpaused = nextMessage(member.socket, message => (
    message.type === 'server-gameplay-pause' && message.pause === null
  ))
  member.socket.send(encodeGameMessage({
    type: 'client-gameplay-pause',
    paused: false,
  }))
  await unpaused
  const heldTick = host.playerState(member.welcome.playerId)?.tick
  assert.equal(typeof heldTick, 'number')
  await new Promise(resolve => setTimeout(resolve, 100))
  const held = host.playerState(member.welcome.playerId)
  assert.equal(held?.tick, heldTick)
  assert.equal(held?.run.phase, 'active')
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
    onlinePreferences: ONLINE_PREFERENCES,
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
    onlinePreferences: ONLINE_PREFERENCES,
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
  const initialReady = completeInitialGameplayReadiness([client.socket])
  client.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await active
  await initialReady

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
  assert.deepEqual(profile.economy.storage.at(-1)?.contents?.map(({ name }) => name).sort(), [
    'Hat',
    'Health Potion',
    'Mana Potion',
    'Robe',
    'Staff',
  ])
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
  const initialReady = completeInitialGameplayReadiness([first.socket, second.socket])
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const [loaded, active] = await Promise.all([loadedMessage, activeMessage])
  await initialReady
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
    displayName: 'Second Reborn',
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
    displayName: 'First Reborn',
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
    displayName: 'First Reborn',
    element: 'air',
  })
  assert.deepEqual(hub.snapshot.players[second.welcome.playerId]?.config, {
    ...SECOND_CHARACTER,
    discipline: 'mind',
    displayName: 'Second Reborn',
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
  assert.equal(host.capacityParticipantCount(), 2)
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

test('Submit Runs independently gates each party member receipt and Memoratorium portrait', async (context) => {
  const tickets = new Map<string, GameHostAdmission>([
    ['ticket-first', { content: EMPTY_SHARED_CONTENT, leaderboardUserId: 42 }],
    ['ticket-second', { content: EMPTY_SHARED_CONTENT, leaderboardUserId: 43 }],
  ])
  const host = await startGameHost({
    authentication: {
      kind: 'tickets',
      claim: credential => {
        const admission = tickets.get(credential) ?? null
        tickets.delete(credential)
        return admission
      },
    },
    leaderboardReceiptSecret: LEADERBOARD_RECEIPT_SECRET,
    sessionKind: 'global-hub',
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'ticket-first', FIRST_CHARACTER)
  const second = await join(host.address.url, 'ticket-second', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  const invited = nextMessage(second.socket, message => (
    message.type === 'server-party-state' && message.state.invitations.length === 1
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-party-invite',
    targetPlayerId: second.welcome.playerId,
  }))
  const invitation = await invited
  if (invitation.type !== 'server-party-state') assert.fail('expected party invitation')
  const grouped = nextMessage(first.socket, message => (
    message.type === 'server-party-state' && message.state.party.memberPlayerIds.length === 2
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-party-accept',
    invitationId: invitation.state.invitations[0]!.id,
  }))
  await grouped

  const firstLoaded = nextMessage(first.socket, message => message.type === 'server-boneyard-loaded')
  const secondLoaded = nextMessage(second.socket, message => message.type === 'server-boneyard-loaded')
  const ready = completeInitialGameplayReadiness([first.socket, second.socket])
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await Promise.all([firstLoaded, secondLoaded, ready])
  second.socket.send(encodeGameMessage({
    type: 'client-online-preferences',
    onlinePreferences: { ...ONLINE_PREFERENCES, submitRuns: false },
  }))
  await new Promise(resolve => setTimeout(resolve, 20))

  let secondReceiptCount = 0
  const countSecondReceipt = (payload: WebSocket.RawData) => {
    if (decodeServerGameMessage(payload.toString()).type === 'server-leaderboard-receipt') {
      secondReceiptCount += 1
    }
  }
  second.socket.on('message', countSecondReceipt)
  context.after(() => second.socket.off('message', countSecondReceipt))
  const firstReceipt = nextMessage(first.socket, message => (
    message.type === 'server-leaderboard-receipt'
  ))
  const archived = nextMessage(first.socket, message => (
    message.type === 'server-snapshot'
    && message.snapshot.world.kind === 'boneyard'
    && message.snapshot.world.hallOfFameRuns[first.welcome.playerId]?.elapsedTicks !== null
  ))
  forceHallArchive(host, first.welcome.playerId)
  assert.equal((await firstReceipt).type, 'server-leaderboard-receipt')
  await archived
  await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(secondReceiptCount, 0)
  const hub = host.state()
  if (hub.world.kind !== 'hub') assert.fail('expected shared Hub owner state')
  const memorialPlayerIds = hub.world.memorial.slots.flatMap(({ portrait }) => (
    portrait ? [portrait.playerId] : []
  ))
  assert.equal(memorialPlayerIds.includes(first.welcome.playerId), true)
  assert.equal(memorialPlayerIds.includes(second.welcome.playerId), false)
})

test('developer Lua keeps saves global-clean and preserves global score eligibility', async () => {
  const result = await completeLeaderboardScenario({
    cheatsEnabled: true,
    developerAccess: true,
    globalHub: true,
    lua: true,
    beforeArchive: async (socket) => {
      socket.send(encodeGameMessage({ type: 'client-cheat-mode', enabled: true }))
      socket.send(encodeGameMessage({ type: 'client-cheat-mode', enabled: false }))
      const luaResult = nextMessage(socket, message => (
        message.type === 'server-lua-result' && message.requestId === 1
      ))
      socket.send(encodeGameMessage({
        type: 'client-lua-execute',
        code: 'sd.dev.grant_gold(250); return sd.player.get_state().id',
        requestId: 1,
      }))
      const executed = await luaResult
      assert.equal(executed.type, 'server-lua-result')
      assert.equal(executed.ok, true)

      const checkpoint = nextMessage(socket, message => (
        message.type === 'server-save-checkpoint' && message.reason === 'progress'
      ))
      const acknowledged = nextMessage(socket, message => (
        message.type === 'server-save-before-leave' && message.requestId === 2
      ))
      socket.send(encodeGameMessage({ type: 'client-save-before-leave', requestId: 2 }))
      const [saved, receipt] = await Promise.all([checkpoint, acknowledged])
      assert.equal(saved.type, 'server-save-checkpoint')
      assert.equal(receipt.type, 'server-save-before-leave')
      assert.equal(JSON.parse(saved.save).integrity, 'global-clean')
    },
  })
  assert.equal(result.receipts.length, 1)
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
    ['Submit Runs opt-out', { submitRuns: false }],
    ['initial cheat mode in a private College', { cheatsEnabled: true, private: true }],
    ['forged global-clean local save resumed in the global Hub', {
      globalHub: true,
      save,
      saveIntent: 'resume',
    }],
    ['client-held profile hydrated into New Game in the global Hub', {
      globalHub: true,
      save,
      saveIntent: 'new-game',
    }],
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
    onlinePreferences: ONLINE_PREFERENCES,
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
  assert.deepEqual(executed.values, ['Helvidius', '1.0.0'])
  await waitFor(() => getPlayerEconomy(host.state(), authority.welcome.playerId).gold === 4321)
  assert.notEqual((await hostHealth(host.address.url)).lua, null)

  const loadedMessage = nextMessage(authority.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  const initialReady = completeInitialGameplayReadiness([authority.socket, guest.socket])
  authority.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const loaded = await loadedMessage
  await initialReady
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
  await waitFor(() => host.capacityParticipantCount() === 0)
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

async function startDetachedPartyRun(context: TestContext) {
  const logs: GameServerLogEntry[] = []
  const tickets = new Map<string, GameHostAdmission>([
    ['leader-ticket', { content: EMPTY_SHARED_CONTENT, leaderboardUserId: 42 }],
    ['member-ticket', { content: EMPTY_SHARED_CONTENT, leaderboardUserId: 43 }],
  ])
  const host = await startGameHost({
    authentication: {
      kind: 'tickets',
      claim: credential => {
        const admission = tickets.get(credential) ?? null
        tickets.delete(credential)
        return admission
      },
    },
    leaderboardReceiptSecret: LEADERBOARD_RECEIPT_SECRET,
    log: entry => logs.push(entry),
    sessionKind: 'global-hub',
    sharedHub: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const leader = await join(host.address.url, 'leader-ticket', FIRST_CHARACTER)
  const member = await join(host.address.url, 'member-ticket', SECOND_CHARACTER)
  context.after(() => leader.socket.close())
  context.after(() => member.socket.close())

  const invitationMessage = nextMessage(member.socket, message => (
    message.type === 'server-party-state' && message.state.invitations.length === 1
  ))
  leader.socket.send(encodeGameMessage({
    type: 'client-party-invite',
    targetPlayerId: member.welcome.playerId,
  }))
  const invitation = await invitationMessage
  if (invitation.type !== 'server-party-state') assert.fail('expected party invitation')
  const grouped = nextMessage(member.socket, message => (
    message.type === 'server-party-state' && message.state.party.memberPlayerIds.length === 2
  ))
  member.socket.send(encodeGameMessage({
    type: 'client-party-accept',
    invitationId: invitation.state.invitations[0]!.id,
  }))
  const party = await grouped
  if (party.type !== 'server-party-state') assert.fail('expected grouped party')

  const memberRunSave = nextMessage(member.socket, message => (
    message.type === 'server-save-checkpoint'
    && JSON.parse(message.save).continuation.summary.partyRejoinToken !== null
  ))
  const loadedLeader = nextMessage(leader.socket, message => message.type === 'server-boneyard-loaded')
  const loadedMember = nextMessage(member.socket, message => message.type === 'server-boneyard-loaded')
  const initialReady = completeInitialGameplayReadiness([leader.socket, member.socket])
  leader.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const [leaderRun, memberRun, checkpoint] = await Promise.all([
    loadedLeader,
    loadedMember,
    memberRunSave,
  ])
  await initialReady
  if (leaderRun.type !== 'server-boneyard-loaded') assert.fail('expected leader Boneyard')
  if (memberRun.type !== 'server-boneyard-loaded') assert.fail('expected member Boneyard')
  if (checkpoint.type !== 'server-save-checkpoint') assert.fail('expected member checkpoint')
  const saved = JSON.parse(checkpoint.save) as {
    continuation: { summary: { partyRejoinToken: string; playerId: string } }
  }
  const token = saved.continuation.summary.partyRejoinToken
  assert.match(token, /^sdrpr2\./)
  assert.equal(saved.continuation.summary.playerId, member.welcome.playerId)
  return { checkpoint, host, leader, logs, member, memberRun, tickets, token }
}

async function join(
  url: string,
  credential: string,
  character: PlayerCharacterConfig,
  autoPong = true,
  profile: PlayerSocialProfile = EMPTY_PLAYER_PROFILE,
  beginCollegeIntro = false,
  declineTutorial = false,
  onlinePreferences: GameOnlinePreferences = ONLINE_PREFERENCES,
  cheatsEnabled = false,
) {
  const socket = await openSocket(url, undefined, autoPong)
  socket.send(encodeGameMessage({
    type: 'client-hello',
    ...(beginCollegeIntro ? { beginCollegeIntro: true } : {}),
    ...(declineTutorial ? { declineTutorial: true } : {}),
    onlinePreferences,
    profile,
    cheatsEnabled,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential,
    character,
  }))
  const welcome = await nextMessage(socket, (message) => message.type === 'server-welcome')
  assert.equal(welcome.type, 'server-welcome')
  return { socket, welcome }
}

async function completeInitialGameplayReadiness(
  sockets: readonly WebSocket[],
): Promise<void> {
  const pending = await Promise.all(sockets.map(socket => nextMessage(socket, message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace !== null
    && message.grace.reason === 'game-started'
    && message.grace.remainingMs === null
  ))))
  const started = sockets.map(socket => nextMessage(socket, message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace?.reason === 'game-started'
    && message.grace.remainingMs !== null
  )))
  for (const [index, message] of pending.entries()) {
    if (message.type !== 'server-gameplay-resume-grace' || message.grace === null) {
      throw new Error('expected pending initial gameplay readiness')
    }
    sockets[index]!.send(encodeGameMessage({
      type: 'client-resume-grace-ready',
      sequence: message.grace.sequence,
    }))
  }
  const active = await Promise.all(started)
  for (const message of active) {
    assert.equal(message.type, 'server-gameplay-resume-grace')
    assert.ok((message.grace?.remainingMs ?? 0) > 1_900)
  }
  const completed = sockets.map(socket => nextMessage(socket, message => (
    message.type === 'server-gameplay-resume-grace' && message.grace === null
  )))
  await Promise.all(completed)
}

async function openSavedRunSocket(
  url: string,
  credential: string,
  save: string,
): Promise<WebSocket> {
  const socket = await openSocket(url)
  socket.send(encodeGameMessage({
    type: 'client-hello',
    onlinePreferences: ONLINE_PREFERENCES,
    profile: EMPTY_PLAYER_PROFILE,
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential,
    character: FIRST_CHARACTER,
    save,
    saveIntent: 'resume',
  }))
  const welcome = await nextMessage(socket, message => message.type === 'server-welcome')
  assert.equal(welcome.type, 'server-welcome')
  return socket
}

function savedRunDocument(loadedBoneyard: LoadedBoneyard): string {
  return createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard,
    mods: [],
    modState: {},
    partyRejoinToken: null,
    playerId: 'owner',
    state: enterBoneyardWorld(
      createGameSimulation({ owner: FIRST_CHARACTER }),
      loadedBoneyard,
    ),
  })
}

function legacyRoadSaveDocument(document: string): string {
  const parsed = JSON.parse(document) as {
    continuation: {
      loadedBoneyard: {
        geometrySha256: string
        scene: { roads: Record<string, unknown>[] }
      }
    }
  }
  const scene = parsed.continuation.loadedBoneyard.scene
  for (const road of scene.roads) delete road.linkMask
  parsed.continuation.loadedBoneyard.geometrySha256 = boneyardGeometrySha256(
    scene as unknown as BoneyardScene,
  )
  return JSON.stringify(parsed)
}

interface LeaderboardScenario {
  beforeArchive?: (socket: WebSocket) => Promise<void>
  cheatsEnabled?: boolean
  developerAccess?: boolean
  globalHub?: boolean
  leaderboardUserId?: number | null
  lua?: boolean
  private?: boolean
  save?: string
  saveIntent?: GameSaveIntent
  submitRuns?: boolean
}

async function completeLeaderboardScenario(
  scenario: LeaderboardScenario = {},
): Promise<{ receipts: string[]; runId: string }> {
  const host = await startGameHost({
    authentication: scenario.developerAccess || scenario.globalHub
      ? {
          kind: 'tickets',
          claim: credential => credential === 'test-secret'
            ? {
                content: EMPTY_SHARED_CONTENT,
                developerAccess: scenario.developerAccess === true,
                leaderboardUserId: scenario.leaderboardUserId === undefined
                  ? 42
                  : scenario.leaderboardUserId,
              }
            : null,
        }
      : {
          kind: 'shared',
          credential: 'test-secret',
          leaderboardUserId: scenario.leaderboardUserId === undefined
            ? 42
            : scenario.leaderboardUserId,
        },
    leaderboardReceiptSecret: LEADERBOARD_RECEIPT_SECRET,
    ...(scenario.lua ? { luaWasmPath } : {}),
    sharedHub: scenario.globalHub === true,
    snapshotRate: 100,
    sessionKind: scenario.private
      ? 'private-college'
      : scenario.globalHub ? 'global-hub' : 'standalone',
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
      onlinePreferences: {
        ...ONLINE_PREFERENCES,
        submitRuns: scenario.submitRuns !== false,
      },
      profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
      cheatsEnabled: scenario.cheatsEnabled === true,
      protocolVersion: GAME_PROTOCOL_VERSION,
      credential: 'test-secret',
      character: FIRST_CHARACTER,
      ...(scenario.save === undefined
        ? {}
        : { save: scenario.save, saveIntent: scenario.saveIntent ?? 'resume' }),
    }))
    const welcome = await welcomeMessage
    assert.equal(welcome.type, 'server-welcome')
    assert.equal(welcome.developerAccess, scenario.developerAccess === true)
    const collegeIntro = welcome.snapshot.world.kind === 'hub'
      && welcome.snapshot.world.participants[welcome.playerId]?.collegeIntro !== null
    if (collegeIntro) {
      const walking = nextMessage(socket, message => (
        message.type === 'server-snapshot'
        && message.snapshot.world.kind === 'hub'
        && (message.snapshot.world.participants[welcome.playerId]?.collegeIntro?.titleCursor
          ?? 0) > 0
      ))
      socket.send(encodeGameMessage({ type: 'client-ready-college-intro' }))
      await walking
      const readyMessage = nextMessage(socket, message => (
        message.type === 'server-snapshot'
        && message.snapshot.world.kind === 'hub'
        && message.snapshot.world.participants[welcome.playerId]?.collegeIntro?.phase
          === 'arch-dialogue'
      ))
      placeCollegeAdmissionAtArch(host, welcome.playerId)
      const ready = await readyMessage
      assert.equal(ready.type, 'server-snapshot')
      const acknowledged = nextMessage(socket, message => (
        message.type === 'server-snapshot'
        && message.snapshot.world.kind === 'hub'
        && message.snapshot.world.participants[welcome.playerId]?.collegeIntro === null
      ))
      socket.send(encodeGameMessage({
        type: 'client-hub-action',
        action: { type: 'acknowledge-college-intro-dialogue' },
      }))
      await acknowledged
      const loadoutMessage = nextMessage(socket, message => (
        message.type === 'server-snapshot'
        && message.snapshot.world.kind === 'hub'
        && message.snapshot.world.participants[welcome.playerId]?.transition?.phase
          === 'college-loadout'
      ))
      placeCollegeAdmissionAtOfficeExit(host, welcome.playerId)
      const loadout = await loadoutMessage
      assert.equal(loadout.type, 'server-snapshot')
      socket.send(encodeGameMessage({
        type: 'client-confirm-loadout',
        discipline: FIRST_CHARACTER.discipline,
        displayName: FIRST_CHARACTER.displayName,
        element: FIRST_CHARACTER.element,
      }))
      await nextMessage(socket, message => (
        message.type === 'server-snapshot'
        && message.snapshot.world.kind === 'hub'
        && message.snapshot.world.participants[welcome.playerId]?.region === 'courtyard'
        && message.snapshot.world.participants[welcome.playerId]?.transition === null
      ))
    } else {
      socket.send(encodeGameMessage({ type: 'client-ready-college-intro' }))
    }
    const loaded = nextMessage(socket, message => message.type === 'server-boneyard-loaded')
    const initialReady = scenario.beforeArchive
      ? completeInitialGameplayReadiness([socket])
      : null
    socket.send(encodeGameMessage({
      type: 'client-start-match',
      boneyardId: 'default-random',
    }))
    await loaded
    if (initialReady) await initialReady
    await scenario.beforeArchive?.(socket)
    const archived = nextMessage(socket, message => (
      message.type === 'server-snapshot'
      && message.snapshot.world.kind === 'boneyard'
      && message.snapshot.world.hallOfFameRuns[welcome.playerId]?.elapsedTicks !== null
    ))
    forceHallArchive(host, scenario.globalHub ? welcome.playerId : undefined)
    await archived
    await new Promise(resolve => setTimeout(resolve, 50))
    const runId = (scenario.globalHub
      ? host.playerState(welcome.playerId)
      : host.state())?.run.runId ?? null
    if (runId === null) throw new Error('expected completed run id')
    return { receipts, runId }
  } finally {
    await closeSocket(socket)
    await host.close()
  }
}

function forceHallArchive(
  host: Awaited<ReturnType<typeof startGameHost>>,
  playerId?: string,
): void {
  const state = playerId ? host.playerState(playerId) : host.state()
  if (!state || state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  Object.assign(state.run, {
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

async function resolveEveryHostSkillOffer(
  host: Awaited<ReturnType<typeof startGameHost>>,
  socket: WebSocket,
  playerId: string,
): Promise<void> {
  while (true) {
    const active = host.playerState(playerId)
    if (!active) throw new Error(`host has no player ${playerId}`)
    const offer = getPlayerProgression(active, playerId).pendingOffer
    if (!offer) return
    socket.send(encodeGameMessage({
      type: 'client-select-skill',
      choiceIndex: 0,
      offerSequence: offer.sequence,
      skillId: offer.options[0]!.skillId,
    }))
    await waitFor(() => {
      const next = host.playerState(playerId)
      if (!next) return false
      return getPlayerProgression(next, playerId).pendingOffer?.sequence !== offer.sequence
    })
  }
}

function placeCollegeAdmissionAtOfficeExit(
  host: Awaited<ReturnType<typeof startGameHost>>,
  playerId: string,
): void {
  const state = host.playerState(playerId)
  if (!state || state.world.kind !== 'hub') throw new Error('expected College Office state')
  const player = getPlayerCharacter(state, playerId)
  state.playerEntities = replacePlayerCharacter(
    state.playerEntities,
    playerId,
    {
      ...player,
      position: { x: 512, y: 924 },
      velocity: { x: 0, y: 0 },
    },
  )
}

function placeCollegeAdmissionAtArch(
  host: Awaited<ReturnType<typeof startGameHost>>,
  playerId: string,
): void {
  const state = host.playerState(playerId)
  if (!state || state.world.kind !== 'hub') throw new Error('expected College state')
  const participant = state.world.participants[playerId]
  if (!participant?.collegeIntro) throw new Error('expected active College intro')
  state.world = {
    ...state.world,
    participants: {
      ...state.world.participants,
      [playerId]: {
        collegeIntro: {
          ...participant.collegeIntro,
          contactCounter: 0,
          coverAlpha: 0,
          dialogueSequence: participant.collegeIntro.dialogueSequence + 1,
          officeSpeed: 0.5,
          pathCursor: 6,
          phase: 'arch-dialogue',
          titleCursor: 5,
        },
        region: 'office',
        transition: null,
      },
    },
  }
  const player = getPlayerCharacter(state, playerId)
  state.playerEntities = replacePlayerCharacter(
    state.playerEntities,
    playerId,
    {
      ...player,
      position: { x: 522.5, y: 530 },
      velocity: { x: 0, y: 0 },
    },
  )
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

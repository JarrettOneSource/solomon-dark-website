import assert from 'node:assert/strict'
import test from 'node:test'

import {
  confirmGameSimulationLoadout,
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerEconomy,
  grantGameSimulationPlayerExperience,
} from '../core-server/game-simulation.ts'
import {
  createPlayerCharacter,
  type PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { replacePlayerEconomy } from '../core-server/player-entity-store.ts'
import {
  createGameSnapshotFrame,
  createReplicatedEntityBaseline,
} from '../protocol/entity-replication.ts'
import {
  EMPTY_CONTENT_MANIFEST_SHA256,
  GAME_PROTOCOL_VERSION,
  PLAYER_CHARACTER_KERNEL_VERSION,
  decodeClientGameMessage,
  encodeGameMessage,
  type GameChatMessage,
  type GameChatRejection,
  type LoadedBoneyard,
} from '../protocol/game-protocol.ts'
import { connectGameClientSession } from './game-client-session.ts'
import type { GameConnectionFailure } from './game-connection-failure.ts'
import { createGameClientDiagnostics } from './game-diagnostics.ts'
import { predictPlayerCharacterInHub } from './hub-prediction.ts'
import type { GameTransport, GameTransportClose } from './game-transport.ts'

const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

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
  }
}

function loadedBoneyardFixture(runId: string): LoadedBoneyard {
  return {
    choice: { id: 'default-random', name: 'Random Boneyard', source: 'default' },
    geometrySha256: '2'.repeat(64),
    runId,
    scene: {
      bounds: { h: 1_200, w: 1_600, x: 0, y: 0 },
      environmentMode: 2,
      fences: [],
      name: 'Lifecycle Arena',
      objects: [],
      roads: [],
      solomonDig: null,
      spawn: { facingDeg: 180, x: 200, y: 150 },
      sprites: [],
      terrain: [],
    },
    seed: '0123456789abcdef',
    sourceSha256: '1'.repeat(64),
  }
}

test('client carries character config, publishes authority, and tears down', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    saveDocument: '{"schemaVersion":1}',
    transport,
  })
  assert.deepEqual(decodeClientGameMessage(transport.sent[0]), {
    type: 'client-hello',
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    character: CHARACTER,
    save: '{"schemaVersion":1}',
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  transport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-player-1',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: kernelParameters(),
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    modAssets: [],
    modCatalog: [],
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    gameplayPause: null,
    snapshot: createGameSnapshot(serverState, 'player-1'),
    snapshotSequence: 1,
  }))
  const session = await connecting
  assert.equal(session.isHost, true)
  session.setCheatsEnabled(true)
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-cheat-mode',
    enabled: true,
  })
  let leaderboardReceipt: string | null = null
  session.onLeaderboardReceipt((receipt) => { leaderboardReceipt = receipt })
  transport.receive(encodeGameMessage({
    type: 'server-leaderboard-receipt',
    receipt: 'payload.signature',
  }))
  assert.equal(leaderboardReceipt, 'payload.signature')
  assert.equal(session.boneyards[0].id, 'default-random')
  assert.equal(session.getSaveCheckpoint(), null)
  assert.equal(session.getPartyState(), null)
  let receivedPartyRevision = 0
  session.onPartyState((party) => { receivedPartyRevision = party.revision })
  transport.receive(encodeGameMessage({
    type: 'server-party-state',
    state: {
      hubPlayers: [
        { displayName: 'Helvidius', playerId: 'player-1' },
        { displayName: 'Aurelia', playerId: 'player-2' },
      ],
      invitations: [{
        id: 'invite-1',
        inviter: { displayName: 'Aurelia', playerId: 'player-2' },
        partyId: 'party-2',
      }],
      party: {
        id: 'party-1',
        leaderPlayerId: 'player-1',
        memberPlayerIds: ['player-1'],
      },
      revision: 3,
    },
  }))
  assert.equal(receivedPartyRevision, 3)
  assert.equal(session.getPartyState()?.party.id, 'party-1')
  session.inviteToParty('player-2')
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-party-invite',
    targetPlayerId: 'player-2',
  })
  session.acceptPartyInvitation('invite-1')
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-party-accept',
    invitationId: 'invite-1',
  })
  session.denyPartyInvitation('invite-1')
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-party-deny',
    invitationId: 'invite-1',
  })
  const receivedChat: GameChatMessage[] = []
  const rejectedChat: GameChatRejection[] = []
  session.onChatMessage(message => receivedChat.push(message))
  session.onChatRejected(rejection => rejectedChat.push(rejection))
  session.sendChatMessage('party', '  Meet by the fountain.  ')
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-chat',
    channel: 'party',
    text: 'Meet by the fountain.',
  })
  assert.throws(() => session.sendChatMessage('party', ' \n '), /cannot be empty/)
  transport.receive(encodeGameMessage({
    type: 'server-chat',
    channel: 'party',
    sender: { displayName: 'Aurelia', playerId: 'player-2' },
    sequence: 12,
    text: 'On my way.',
  }))
  transport.receive(encodeGameMessage({
    type: 'server-chat',
    channel: 'party',
    sender: { displayName: 'Aurelia', playerId: 'player-2' },
    sequence: 12,
    text: 'Duplicate transport event.',
  }))
  assert.deepEqual(receivedChat, [{
    channel: 'party',
    sender: { displayName: 'Aurelia', playerId: 'player-2' },
    sequence: 12,
    text: 'On my way.',
  }])
  assert.deepEqual(session.getChatMessages(), receivedChat)
  transport.receive(encodeGameMessage({
    type: 'server-chat-rejected',
    channel: 'party',
    reason: 'rate-limited',
    retryAfterMs: 2_000,
  }))
  assert.deepEqual(rejectedChat, [{
    channel: 'party',
    reason: 'rate-limited',
    retryAfterMs: 2_000,
  }])
  let receivedCheckpoint = null
  const removeCheckpoint = session.onSaveCheckpoint((checkpoint) => {
    receivedCheckpoint = checkpoint
  })
  transport.receive(encodeGameMessage({
    type: 'server-save-checkpoint',
    save: '{"schemaVersion":1,"checkpoint":true}',
    reason: 'progress',
    sequence: 1,
  }))
  assert.deepEqual(receivedCheckpoint, {
    document: '{"schemaVersion":1,"checkpoint":true}',
    reason: 'progress',
    sequence: 1,
  })
  assert.deepEqual(session.getSaveCheckpoint(), receivedCheckpoint)
  removeCheckpoint()
  const stockItemId = session.getSnapshot().players[session.playerId].economy.fomentiusStock[0]!.id
  session.sendHubAction({ type: 'buy-fomentius', itemId: stockItemId })
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-hub-action',
    action: { type: 'buy-fomentius', itemId: stockItemId },
  })
  session.bindSkillQuickbar(11, 7)
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-skill-quickbar-bind',
    skillId: 11,
    slot: 7,
  })
  session.selectPrimarySkill(8)
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-select-primary-skill',
    skillId: 8,
  })
  assert.throws(() => session.bindSkillQuickbar(16, 1), /unavailable/)
  assert.throws(() => session.selectConcentration(57), /unavailable/)
  session.startMatch('default-random')
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-start-match',
    boneyardId: 'default-random',
  })
  let receivedRunId: string | null = null
  session.onBoneyard((boneyard) => { receivedRunId = boneyard.runId })
  transport.receive(encodeGameMessage({
    type: 'server-boneyard-loaded',
    boneyard: {
      choice: { id: 'default-random', name: 'Random Boneyard', source: 'default' },
      runId: 'run-one',
      seed: '0123456789abcdef',
      sourceSha256: '1'.repeat(64),
      geometrySha256: '2'.repeat(64),
      scene: {
        name: 'Random Level',
        environmentMode: 2,
        bounds: { x: 0, y: 0, w: 1600, h: 1200 },
        spawn: { x: 200, y: 150, facingDeg: 180 },
        objects: [],
        sprites: [],
        roads: [],
        fences: [],
        terrain: [],
        solomonDig: {
          gravePosition: { x: 190, y: 277 },
          lanternPosition: { x: 135, y: 350 },
          position: { x: 200, y: 390 },
          frameProgram: [0, 3, 17, 3],
          ticksPerFrame: 5,
        },
      },
    },
  }))
  assert.equal(session.getBoneyard()?.runId, 'run-one')
  assert.equal(receivedRunId, 'run-one')
  const origin = session.getSnapshot().players['player-1'].position
  assert.deepEqual(session.getSnapshot().players['player-1'].config, CHARACTER)
  let presented = session.getSnapshot()
  session.onSnapshot((snapshot) => { presented = snapshot })
  session.sendInput(gameplayInput({ x: 1, y: 0 }))
  const firstInput = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(firstInput.type, 'client-input')
  session.sendInput(gameplayInput({ x: 0, y: 1 }))
  const replacementInput = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(replacementInput.type, 'client-input')
  assert.equal(
    replacementInput.targetTick,
    firstInput.type === 'client-input' ? firstInput.targetTick : -1,
  )
  receiveSnapshot(transport, createGameSnapshot(serverState, 'player-1'), 0)
  assert.deepEqual(presented.players['player-1'].position, origin)
  receiveSnapshot(transport, createGameSnapshot(serverState, 'player-1'), 2)
  assert.deepEqual(presented.players['player-1'].position, origin)

  const loadedBoneyard = session.getBoneyard()
  assert.ok(loadedBoneyard)
  receiveSnapshot(
    transport,
    createGameSnapshot(
      enterBoneyardWorld(serverState, loadedBoneyard),
      'player-1',
    ),
    2,
  )
  assert.equal(session.getSnapshot().world.kind, 'boneyard')
  assert.equal(session.samplePresentation().world.kind, 'hub')
  assert.equal(session.sampleBoneyardPresentation().world.kind, 'boneyard')

  session.destroy()
  assert.equal(decodeClientGameMessage(transport.sent.at(-1)!).type, 'client-disconnect')
  assert.equal(transport.readyState, 'closed')
  assert.deepEqual(session.getChatMessages(), [])
  transport.receive(encodeGameMessage({
    type: 'server-chat',
    channel: 'party',
    sender: { displayName: 'Aurelia', playerId: 'player-2' },
    sequence: 13,
    text: 'After teardown.',
  }))
  assert.equal(receivedChat.length, 1)
})

test('client projects authoritative gameplay pause and blocks input until release', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  receiveWelcome(
    transport,
    createGameSnapshot(createGameSimulation({ 'player-1': CHARACTER }), 'player-1'),
  )
  const session = await connecting
  assert.equal(session.getGameplayPause(), null)

  session.requestGameplayPause('inventory')
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-gameplay-pause',
    paused: true,
    source: 'inventory',
  })
  const received: Array<ReturnType<typeof session.getGameplayPause>> = []
  const removePause = session.onGameplayPause((pause) => received.push(pause))
  const pause = {
    ownerDisplayName: CHARACTER.displayName,
    ownerPlayerId: session.playerId,
    source: 'inventory' as const,
  }
  transport.receive(encodeGameMessage({ type: 'server-gameplay-pause', pause }))
  assert.deepEqual(session.getGameplayPause(), pause)
  assert.deepEqual(received, [pause])
  await assert.rejects(session.executeLua('return 1'), /paused/)

  const messageCount = transport.sent.length
  session.sendInput(gameplayInput({ x: 1, y: 0 }, { x: 100, y: 100 }, true, 2))
  assert.equal(transport.sent.length, messageCount)

  transport.receive(encodeGameMessage({ type: 'server-gameplay-pause', pause: null }))
  assert.equal(session.getGameplayPause(), null)
  assert.deepEqual(received, [pause, null])
  session.sendInput(gameplayInput({ x: 1, y: 0 }))
  assert.equal(decodeClientGameMessage(transport.sent.at(-1)!).type, 'client-input')

  removePause()
  session.destroy()
})

test('client replaces only its own modal pause source and emits a strict release', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  receiveWelcome(
    transport,
    createGameSnapshot(createGameSimulation({ 'player-1': CHARACTER }), 'player-1'),
  )
  const session = await connecting
  const inventoryPause = {
    ownerDisplayName: CHARACTER.displayName,
    ownerPlayerId: session.playerId,
    source: 'inventory' as const,
  }
  transport.receive(encodeGameMessage({ type: 'server-gameplay-pause', pause: inventoryPause }))

  session.requestGameplayPause('skill-book')
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    paused: true,
    source: 'skill-book',
    type: 'client-gameplay-pause',
  })
  session.requestGameplayPause(null)
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    paused: false,
    type: 'client-gameplay-pause',
  })

  transport.receive(encodeGameMessage({
    type: 'server-gameplay-pause',
    pause: { ...inventoryPause, ownerPlayerId: 'player-2' },
  }))
  const messageCount = transport.sent.length
  session.requestGameplayPause('skill-book')
  session.requestGameplayPause(null)
  assert.equal(transport.sent.length, messageCount)
  session.destroy()
})

test('client correlates bounded host Lua results and rejects guest or retired execution', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  receiveWelcome(
    transport,
    createGameSnapshot(createGameSimulation({ 'player-1': CHARACTER }), 'player-1'),
  )
  const session = await connecting
  const execution = session.executeLua('print("hello"); return 42')
  const request = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(request.type, 'client-lua-execute')
  if (request.type !== 'client-lua-execute') assert.fail('expected Lua request')
  transport.receive(encodeGameMessage({
    type: 'server-lua-result',
    error: null,
    ok: true,
    output: ['hello'],
    requestId: request.requestId,
    values: [42],
  }))
  assert.deepEqual(await execution, {
    error: null,
    ok: true,
    output: ['hello'],
    values: [42],
  })

  const pending = session.executeLua('return 1')
  session.destroy()
  await assert.rejects(pending, /destroyed/)

  const guestTransport = new MemoryTransport()
  const guestConnecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport: guestTransport,
  })
  const guestState = createGameSimulation({
    'player-1': CHARACTER,
    'player-2': { ...CHARACTER, displayName: 'Authority' },
  })
  guestTransport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-player-1',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: kernelParameters(),
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    modAssets: [],
    modCatalog: [],
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    gameplayPause: null,
    snapshot: createGameSnapshot(guestState, 'player-2'),
    snapshotSequence: 1,
  }))
  const guest = await guestConnecting
  await assert.rejects(guest.executeLua('return 1'), /session host/)
  guest.destroy()
})

test('client logs and explains an unexpected transport disconnect', async () => {
  const diagnostics = createGameClientDiagnostics({ writeToConsole: false })
  const transport = new MemoryTransport()
  let fatal: GameConnectionFailure | undefined
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    diagnostics,
    onFatal: (failure) => { fatal = failure },
    transport,
  })
  receiveWelcome(
    transport,
    createGameSnapshot(createGameSimulation({ 'player-1': CHARACTER }), 'player-1'),
  )
  await connecting

  transport.disconnect({ code: 1006, reason: '', wasClean: false })

  assert.equal(fatal?.code, 'connection-lost')
  assert.match(fatal?.message ?? '', /network connection.*server/i)
  const report = diagnostics.createReport(fatal ?? null, {
    online: true,
    pageUrl: 'https://solomondarker.com/game',
    sessionId: null,
    userAgent: 'Contract Browser',
  })
  const logged = report.entries.find((entry) => entry.event === 'connection.failed')
  assert.equal(logged?.level, 'error')
  assert.match(logged?.detail ?? '', /1006/)
})

test('host client keeps one session through Game Over, loadout, and Hub confirmation', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  const hubState = createGameSimulation({ 'player-1': CHARACTER })
  receiveWelcome(transport, createGameSnapshot(hubState, 'player-1'))
  const session = await connecting
  const playerId = session.playerId
  const runId = 'run-lifecycle'
  const loaded = loadedBoneyardFixture(runId)
  const activeState = enterBoneyardWorld(hubState, loaded)

  transport.receive(encodeGameMessage({
    type: 'server-boneyard-loaded',
    boneyard: loaded,
  }))
  receiveSnapshot(transport, createGameSnapshot(activeState, playerId), 0)
  assert.equal(session.getSnapshot().run.phase, 'active')
  assert.equal(session.getSnapshot().run.runId, runId)

  session.sendInput(gameplayInput({ x: 1, y: 0 }, { x: 500, y: 300 }, true))
  const activeInput = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(activeInput.type, 'client-input')

  const gameOverState = {
    ...activeState,
    run: {
      ...activeState.run,
      gameOverEventId: 1,
      gameOverExitTicks: 1,
      gameOverTicks: 1_000,
      nextGameOverEventId: 2,
      phase: 'game-over' as const,
    },
    world: activeState.world.kind === 'boneyard'
      ? {
          ...activeState.world,
          hallOfFameRuns: Object.fromEntries(Object.entries(
            activeState.world.hallOfFameRuns,
          ).map(([id, hallRun]) => [id, {
            ...hallRun,
            elapsedTicks: 0,
            portraitHeadingIndex: 12,
            portraitScale: 0.925,
          }])),
        }
      : activeState.world,
  }
  receiveSnapshot(transport, createGameSnapshot(gameOverState, playerId), 0)
  assert.equal(session.getSnapshot().run.phase, 'game-over')

  const beforeStoppedInput = transport.sent.length
  session.sendInput(gameplayInput({ x: 0, y: 1 }, { x: 600, y: 400 }, true, 0))
  assert.equal(transport.sent.length, beforeStoppedInput + 1)
  const stoppedInput = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(stoppedInput.type, 'client-input')
  if (stoppedInput.type !== 'client-input') assert.fail('expected stopped client input')
  assert.deepEqual(stoppedInput.input, gameplayInput({ x: 0, y: 0 }))

  receiveSnapshot(transport, createGameSnapshot(gameOverState, playerId), 0)
  assert.equal(session.getSnapshot().run.phase, 'game-over')
  assert.equal(session.getSnapshot().run.gameOverExitTicks, 1)
  const loadoutState = {
    ...gameOverState,
    run: {
      ...gameOverState.run,
      eligiblePlayerIds: [],
      gameOverExitTicks: null,
      gameOverTicks: 0,
      lastCompletedRunId: runId,
      phase: 'loadout' as const,
      runId: null,
    },
    world: createGameSimulation({ [playerId]: CHARACTER }).world,
  }
  receiveSnapshot(transport, createGameSnapshot(loadoutState, playerId), 0)
  assert.equal(session.playerId, playerId)
  assert.equal(session.getSnapshot().run.phase, 'loadout')
  assert.equal(session.getSnapshot().world.kind, 'hub')

  session.confirmLoadout()
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-confirm-loadout',
  })

  const confirmedState = confirmGameSimulationLoadout(loadoutState)
  assert.ok(confirmedState)
  receiveSnapshot(transport, createGameSnapshot(confirmedState, playerId), 0)
  assert.equal(session.playerId, playerId)
  assert.equal(session.getSnapshot().run.phase, 'hub')
  assert.equal(session.getSnapshot().run.lastCompletedRunId, runId)

  const beforeInvalidConfirmation = transport.sent.length
  session.confirmLoadout()
  assert.equal(transport.sent.length, beforeInvalidConfirmation)
  session.startMatch('default-random')
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-start-match',
    boneyardId: 'default-random',
  })
  session.destroy()
})

test('client consumes each run-scoped Boneyard enemy event exactly once', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  const hubState = createGameSimulation({ 'player-1': CHARACTER })
  const firstRunId = 'enemy-events-one'
  const firstSnapshot = createGameSnapshot(
    enterBoneyardWorld(hubState, loadedBoneyardFixture(firstRunId)),
    'player-1',
  )
  if (firstSnapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  firstSnapshot.world.enemyEvents = [{
    actorId: 4,
    eventId: 7,
    runId: firstRunId,
    targetPlayerId: 'player-1',
    tick: 0,
    type: 'attack-marker',
  }]
  receiveWelcome(transport, firstSnapshot)
  const session = await connecting
  const received: Parameters<Parameters<typeof session.onEnemyEvent>[0]>[0][] = []
  session.onEnemyEvent((event) => received.push(event))

  receiveSnapshot(transport, { ...firstSnapshot, tick: 5 }, 0)
  assert.deepEqual(received, [])

  const projectile = {
    actorId: 4,
    eventId: 8,
    projectileId: 12,
    runId: firstRunId,
    targetPlayerId: 'player-1',
    tick: 6,
    type: 'projectile-spawned' as const,
  }
  const deathSound = {
    actorId: 4,
    eventId: 9,
    gainScale: 1,
    pitch: 0.91,
    runId: firstRunId,
    sound: 'skeleton-die' as const,
    sourcePosition: { x: 110, y: 205 },
    tick: 6,
    type: 'enemy-death-sound' as const,
  }
  const withImpact = {
    ...firstSnapshot,
    tick: 10,
    world: {
      ...firstSnapshot.world,
      enemyEvents: [...firstSnapshot.world.enemyEvents, projectile, deathSound],
    },
  }
  receiveSnapshot(transport, withImpact, 0)
  receiveSnapshot(transport, { ...withImpact, tick: 15 }, 0)
  assert.deepEqual(received, [projectile, deathSound])

  const secondRunId = 'enemy-events-two'
  const secondSnapshot = createGameSnapshot(
    enterBoneyardWorld(hubState, loadedBoneyardFixture(secondRunId)),
    'player-1',
  )
  if (secondSnapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  secondSnapshot.world.enemyEvents = [{
    actorId: 1,
    eventId: 1,
    runId: secondRunId,
    targetPlayerId: 'player-1',
    tick: 0,
    type: 'enemy-spawned',
  }]
  receiveSnapshot(transport, secondSnapshot, 0)
  assert.deepEqual(received.at(-1), secondSnapshot.world.enemyEvents[0])
  assert.equal(received.length, 3)
  session.destroy()
})

test('client suppresses gameplay input while a skill offer is pending and submits the exact choice', async () => {
  let nowMs = 1_000
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    now: () => nowMs,
    transport,
  })
  const serverState = createGameSimulation(
    { 'player-1': CHARACTER },
    { initialPlayerExperience: 100 },
  )
  receiveWelcome(transport, createGameSnapshot(serverState, 'player-1'))
  const session = await connecting
  const initial = session.getSnapshot().players['player-1']
  const offer = initial.progression.pendingOffer
  assert.ok(offer)
  assert.deepEqual(session.getSnapshot().levelUpBarrier?.pendingPlayerIds, ['player-1'])

  const sentBeforeInput = transport.sent.length
  session.sendInput(gameplayInput({ x: 1, y: 0 }, { x: 900, y: 450 }, true))
  assert.equal(transport.sent.length, sentBeforeInput)
  nowMs += 100
  assert.deepEqual(
    session.samplePresentation().players['player-1'].position,
    initial.position,
  )

  const option = offer.options[0]!
  assert.throws(
    () => session.selectSkill(0, offer.sequence + 1, option.skillId),
    /not in the current offer/,
  )
  session.selectSkill(0, offer.sequence, option.skillId)
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-select-skill',
    choiceIndex: 0,
    offerSequence: offer.sequence,
    skillId: option.skillId,
  })
  session.destroy()
})

test('client submits native quickbar bindings and primary selection against learned rows', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  const snapshot = createGameSnapshot(createGameSimulation({ 'player-1': CHARACTER }), 'player-1')
  const player = snapshot.players['player-1']!
  receiveWelcome(transport, {
    ...snapshot,
    players: {
      ...snapshot.players,
      'player-1': {
        ...player,
        progression: {
          ...player.progression,
          learnedSkills: [...player.progression.learnedSkills, [57, 1, 1]],
          learnedSkillOrder: [...player.progression.learnedSkillOrder, 57],
        },
      },
    },
  })
  const session = await connecting
  session.bindSkillQuickbar(8, 7)
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-skill-quickbar-bind',
    skillId: 8,
    slot: 7,
  })
  session.selectPrimarySkill(8)
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-select-primary-skill',
    skillId: 8,
  })
  session.selectConcentration(57)
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-select-concentration',
    skillId: 57,
  })
  assert.throws(() => session.bindSkillQuickbar(57, 1), /unavailable/)
  assert.throws(() => session.selectPrimarySkill(16), /unavailable/)
  session.destroy()
})

test('client submits the exact Sorceror action for the current offer only', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  let serverState = createGameSimulation({ 'player-1': CHARACTER })
  serverState = {
    ...serverState,
    playerEntities: replacePlayerEconomy(serverState.playerEntities, 'player-1', {
      ...getPlayerEconomy(serverState, 'player-1'),
      ownedPerkSelectors: [17],
    }),
  }
  serverState = grantGameSimulationPlayerExperience(serverState, 'player-1', 100)
  receiveWelcome(transport, createGameSnapshot(serverState, 'player-1'))
  const session = await connecting
  const offer = session.getSnapshot().players['player-1']!.progression.pendingOffer!

  assert.throws(() => session.rerollSkill(offer.sequence + 1), /not available/)
  session.rerollSkill(offer.sequence)
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-level-up-action',
    action: 'reroll',
    offerSequence: offer.sequence,
  })
  session.saveSkill(offer.sequence)
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-level-up-action',
    action: 'save',
    offerSequence: offer.sequence,
  })
  session.destroy()
})

test('client schedules every cast-level transition on a distinct fixed tick', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  transport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-player-1',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: kernelParameters(),
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    modAssets: [],
    modCatalog: [],
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    gameplayPause: null,
    snapshot: createGameSnapshot(serverState, 'player-1'),
    snapshotSequence: 1,
  }))
  const session = await connecting

  session.sendInput(gameplayInput({ x: 0, y: 0 }, { x: 100, y: 200 }, true))
  const pressed = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(pressed.type, 'client-input')

  session.sendInput(gameplayInput({ x: 0, y: 0 }, { x: 110, y: 210 }))
  const released = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(released.type, 'client-input')
  if (pressed.type !== 'client-input' || released.type !== 'client-input') {
    assert.fail('expected client input messages')
  }
  assert.equal(released.targetTick, pressed.targetTick + 1)

  session.sendInput(gameplayInput({ x: 0, y: 0 }, { x: 120, y: 220 }))
  const moved = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(moved.type, 'client-input')
  if (moved.type !== 'client-input') assert.fail('expected client input message')
  assert.equal(moved.targetTick, released.targetTick)
  assert.deepEqual(moved.input, gameplayInput({ x: 0, y: 0 }, { x: 120, y: 220 }))

  const messageCount = transport.sent.length
  session.sendInput(gameplayInput({ x: 0, y: 0 }, { x: 120, y: 220 }))
  assert.equal(transport.sent.length, messageCount)
  session.destroy()
})

test('client measures authenticated WebSocket round trips with its monotonic clock', async () => {
  let nowMs = 1_000
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    now: () => nowMs,
    transport,
  })
  receiveWelcome(
    transport,
    createGameSnapshot(createGameSimulation({ 'player-1': CHARACTER }), 'player-1'),
  )
  const session = await connecting
  const ping = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.deepEqual(ping, { type: 'client-ping', nonce: 1 })
  assert.equal(session.getPingMs(), null)

  const samples: number[] = []
  const removePing = session.onPing((pingMs) => samples.push(pingMs))
  nowMs += 38
  transport.receive(encodeGameMessage({ type: 'server-pong', nonce: 2 }))
  assert.equal(session.getPingMs(), null)
  assert.deepEqual(samples, [])

  transport.receive(encodeGameMessage({ type: 'server-pong', nonce: 1 }))
  assert.equal(session.getPingMs(), 38)
  assert.deepEqual(samples, [38])

  removePing()
  session.destroy()
  nowMs += 10
  transport.receive(encodeGameMessage({ type: 'server-pong', nonce: 1 }))
  assert.deepEqual(samples, [38])
})

test('client disables prediction when the shared character kernel does not match', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  transport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-player-1',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: 'future-player-character-kernel',
    kernelParameters: kernelParameters(),
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    modAssets: [],
    modCatalog: [],
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    gameplayPause: null,
    snapshot: createGameSnapshot(serverState, 'player-1'),
    snapshotSequence: 1,
  }))
  const session = await connecting
  const origin = session.getSnapshot().players['player-1'].position.x
  let presented = session.getSnapshot()
  session.onSnapshot((snapshot) => { presented = snapshot })
  session.sendInput(gameplayInput({ x: 1, y: 0 }))
  receiveSnapshot(transport, createGameSnapshot(serverState, 'player-1'), 0)
  assert.equal(presented.players['player-1'].position.x, origin)
  session.destroy()
})

test('client presents bounded display-rate movement without resending unchanged input', async () => {
  let nowMs = 1_000
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    now: () => nowMs,
    transport,
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  transport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-player-1',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: kernelParameters(),
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    modAssets: [],
    modCatalog: [],
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    gameplayPause: null,
    snapshot: createGameSnapshot(serverState, 'player-1'),
    snapshotSequence: 1,
  }))
  const session = await connecting
  const origin = session.getSnapshot().players['player-1'].position.x

  session.sendInput(gameplayInput({ x: 1, y: 0 }))
  const messagesAfterChange = transport.sent.length
  session.sendInput(gameplayInput({ x: 1, y: 0 }))
  assert.equal(transport.sent.length, messagesAfterChange)

  nowMs += 20
  const early = session.samplePresentation()
  nowMs += 30
  const atSnapshotBoundary = session.samplePresentation()
  nowMs += 500
  const bounded = session.samplePresentation()
  assert.ok(early.players['player-1'].position.x > origin)
  assert.ok(atSnapshotBoundary.players['player-1'].position.x > early.players['player-1'].position.x)
  assert.equal(
    bounded.players['player-1'].position.x,
    atSnapshotBoundary.players['player-1'].position.x,
  )
  session.destroy()
})

test('client applies direction changes only to future presentation ticks', async () => {
  let nowMs = 1_000
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    now: () => nowMs,
    transport,
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  receiveWelcome(transport, createGameSnapshot(serverState, 'player-1'))
  const session = await connecting

  session.sendInput(gameplayInput({ x: 1, y: 0 }))
  nowMs += 40
  const beforeTurn = session.samplePresentation()
  session.sendInput(gameplayInput({ x: 0, y: 1 }))
  const atTurn = session.samplePresentation()

  assert.deepEqual(
    atTurn.players['player-1'].position,
    beforeTurn.players['player-1'].position,
  )
  assert.equal(
    atTurn.players['player-1'].headingIndex,
    beforeTurn.players['player-1'].headingIndex,
  )
  session.destroy()
})

test('client does not rewind a locally presented turn while acknowledgement is delayed', async () => {
  let nowMs = 1_000
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    now: () => nowMs,
    transport,
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  const source = createGameSnapshot(serverState, 'player-1')
  const sourcePlayer = source.players['player-1']
  const eastboundPlayer = {
    ...sourcePlayer,
    headingIndex: 6,
    velocity: { x: 90, y: 0 },
  }
  const initialSnapshot = {
    ...source,
    players: { ...source.players, 'player-1': eastboundPlayer },
    tick: 100,
  }
  receiveWelcome(transport, initialSnapshot)
  const session = await connecting
  session.samplePresentation()

  session.sendInput(gameplayInput({ x: 0, y: 1 }))
  nowMs += 50
  const beforeSnapshot = session.samplePresentation()
  assert.ok(beforeSnapshot.players['player-1'].headingIndex > eastboundPlayer.headingIndex)

  let authoritativePlayer = eastboundPlayer
  let collisionRngState = initialSnapshot.world.kind === 'hub'
    ? initialSnapshot.world.collisionRngState
    : 0
  for (let tick = 0; tick < 5; tick += 1) {
    const predicted = predictPlayerCharacterInHub(
      authoritativePlayer,
      gameplayInput({ x: 1, y: 0 }),
      collisionRngState,
      initialSnapshot.world.kind === 'hub'
        ? initialSnapshot.world.participants['player-1']
        : undefined,
    )
    authoritativePlayer = {
      ...predicted.player,
      economy: authoritativePlayer.economy,
      lighting: authoritativePlayer.lighting,
      progression: authoritativePlayer.progression,
    }
    collisionRngState = predicted.collisionRngState
  }
  receiveSnapshot(transport, {
      ...initialSnapshot,
      players: { ...initialSnapshot.players, 'player-1': authoritativePlayer },
      tick: 105,
      world: initialSnapshot.world.kind === 'hub'
        ? { ...initialSnapshot.world, collisionRngState }
        : initialSnapshot.world,
  }, 0)
  const afterSnapshot = session.samplePresentation()

  assert.equal(
    afterSnapshot.players['player-1'].headingIndex,
    beforeSnapshot.players['player-1'].headingIndex,
  )
  assert.deepEqual(
    afterSnapshot.players['player-1'].position,
    beforeSnapshot.players['player-1'].position,
  )
  session.destroy()
})

test('client accepts cast-owned heading and prevents movement prediction from replacing it', async () => {
  let nowMs = 1_000
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    now: () => nowMs,
    transport,
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  const initialSnapshot = createGameSnapshot(serverState, 'player-1')
  receiveWelcome(transport, initialSnapshot)
  const session = await connecting

  session.sendInput(gameplayInput(
    { x: -1, y: 0 },
    { x: 900, y: 450 },
  ))
  const castHeadingIndex = 8
  const castRadians = castHeadingIndex * 15 * Math.PI / 180
  nowMs += 50
  receiveSnapshot(transport, {
    ...initialSnapshot,
    players: {
      ...initialSnapshot.players,
      'player-1': {
        ...initialSnapshot.players['player-1'],
        headingIndex: castHeadingIndex,
        progression: {
          ...initialSnapshot.players['player-1'].progression,
          learnedSkills: [
            ...initialSnapshot.players['player-1'].progression.learnedSkills,
            [16, 1, 1],
          ],
          learnedSkillOrder: [
            ...initialSnapshot.players['player-1'].progression.learnedSkillOrder,
            16,
          ],
          selectedPrimarySkillId: 16,
        },
        lighting: {
          ...initialSnapshot.players['player-1'].lighting,
          driveActive: true,
        },
        primaryCast: {
          actionTick: 20,
          aimDirection: {
            x: Math.sin(castRadians),
            y: -Math.cos(castRadians),
          },
          castSequence: 1,
          channelActive: false,
          emissionSequence: 1,
          etherBlastCharge: 0,
          etherBlastChargeCueSequence: 0,
          fizzleSequence: 0,
          held: false,
          lastWeldPlaybackRate: null,
          lastWeldSoundVariant: null,
          selectedPrimaryAgeTicks: 1,
          selectedPrimaryId: 16,
          targetId: null,
          underpowered: false,
          weaponPulse: 0,
        },
      },
    },
    tick: initialSnapshot.tick + 5,
  }, 0)

  assert.equal(
    session.samplePresentation().players['player-1'].headingIndex,
    castHeadingIndex,
  )
  nowMs += 20
  assert.equal(
    session.samplePresentation().players['player-1'].headingIndex,
    castHeadingIndex,
  )
  session.destroy()
})

test('client visually absorbs an unpredicted push over one snapshot interval', async () => {
  let nowMs = 1_000
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    now: () => nowMs,
    transport,
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  const initialSnapshot = createGameSnapshot(serverState, 'player-1')
  receiveWelcome(transport, initialSnapshot)
  const session = await connecting
  const beforePush = session.samplePresentation()
  const origin = beforePush.players['player-1'].position
  const pushedX = origin.x + 10

  nowMs += 50
  receiveSnapshot(transport, {
      ...initialSnapshot,
      players: {
        ...initialSnapshot.players,
        'player-1': {
          ...initialSnapshot.players['player-1'],
          position: { x: pushedX, y: origin.y },
        },
      },
      tick: initialSnapshot.tick + 5,
  }, 0)
  const atArrival = session.samplePresentation()
  nowMs += 25
  const halfway = session.samplePresentation()
  nowMs += 25
  const settled = session.samplePresentation()

  assert.deepEqual(atArrival.players['player-1'].position, origin)
  assert.ok(Math.abs(halfway.players['player-1'].position.x - (origin.x + 5)) < 0.0001)
  assert.equal(settled.players['player-1'].position.x, pushedX)
  assert.equal(settled.players['player-1'].position.y, origin.y)
  session.destroy()
})

test('client predicts the authoritative scripted transition walk without accepting input', () => {
  const player = createPlayerCharacter(CHARACTER, { x: 100, y: 100 })
  const predicted = predictPlayerCharacterInHub(
    player,
    gameplayInput({ x: -1, y: 0 }),
    123,
    {
      region: 'courtyard',
      transition: {
        alpha: 0.4,
        destination: 'storeroom',
        phase: 'outgoing',
        scriptedSpeed: 0.45,
        scriptedTarget: { x: 100, y: -1000 },
        sourceRegion: 'courtyard',
      },
    },
  )

  assert.equal(predicted.player.position.x, 100)
  assert.ok(predicted.player.position.y < 100)
  assert.equal(predicted.collisionRngState, 123)
})

test('client rejects a welcome that omits its assigned player', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  transport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'missing-player',
    resumeToken: 'reserved-missing-player',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: kernelParameters(),
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    modAssets: [],
    modCatalog: [],
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    gameplayPause: null,
    snapshot: createGameSnapshot(createGameSimulation({}), null),
    snapshotSequence: 1,
  }))
  await assert.rejects(connecting, /does not contain the assigned player/)
})

test('client requests a keyframe after a replication gap and resumes cleanly', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  receiveWelcome(transport, snapshot)
  const session = await connecting
  const beforeGap = transport.sent.length
  transport.receive(encodeGameMessage({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(
      snapshot,
      99,
      createReplicatedEntityBaseline(snapshot),
    ),
    sequence: 10,
  }))
  assert.equal(transport.sent.length, beforeGap + 1)
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-snapshot-ack',
    requireKeyframe: true,
    sequence: 1,
  })

  const recovered = {
    ...snapshot,
    tick: snapshot.tick + 5,
  }
  transport.receive(encodeGameMessage({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(recovered, 0, undefined, true),
    sequence: 11,
  }))
  assert.equal(session.getSnapshot().tick, recovered.tick)
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-snapshot-ack',
    requireKeyframe: false,
    sequence: 11,
  })
  session.destroy()
})

function kernelParameters() {
  return {
    fixedTickSeconds: 0.01,
    movementAcceleration: 10,
    movementLaneCap: 118.75,
    movementRetention: 0.9,
    movementThresholdSquared: Math.fround(0.01),
    playerRadius: 25,
  }
}

function receiveWelcome(
  transport: MemoryTransport,
  snapshot: ReturnType<typeof createGameSnapshot>,
): void {
  transport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-player-1',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: kernelParameters(),
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    modAssets: [],
    modCatalog: [],
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    gameplayPause: null,
    snapshot,
    snapshotSequence: 1,
  }))
}

let nextSnapshotSequence = 10

function receiveSnapshot(
  transport: MemoryTransport,
  snapshot: ReturnType<typeof createGameSnapshot>,
  acknowledgedInputSequence: number,
): void {
  const sequence = nextSnapshotSequence
  nextSnapshotSequence += 1
  transport.receive(encodeGameMessage({
    type: 'server-snapshot',
    acknowledgedInputSequence,
    frame: createGameSnapshotFrame(snapshot, 0, undefined, true),
    sequence,
  }))
}

class MemoryTransport implements GameTransport {
  readyState: GameTransport['readyState'] = 'open'
  readonly sent: string[] = []
  private readonly closeListeners = new Set<(event: GameTransportClose) => void>()
  private readonly messageListeners = new Set<(payload: string) => void>()

  close(): void {
    this.readyState = 'closed'
  }

  onClose(listener: (event: GameTransportClose) => void): () => void {
    this.closeListeners.add(listener)
    return () => this.closeListeners.delete(listener)
  }

  onMessage(listener: (payload: string) => void): () => void {
    this.messageListeners.add(listener)
    return () => this.messageListeners.delete(listener)
  }

  receive(payload: string): void {
    for (const listener of this.messageListeners) listener(payload)
  }

  disconnect(event: GameTransportClose): void {
    this.readyState = 'closed'
    for (const listener of this.closeListeners) listener(event)
  }

  send(payload: string): void {
    this.sent.push(payload)
  }
}

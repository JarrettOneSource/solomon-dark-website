import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createGameSimulation,
  enterBoneyardWorld,
} from '../core-server/game-simulation.ts'
import { earthImpactLifetimeTicks } from '../core-kernels/primary-spell-earth.ts'
import {
  nativeFireParticleLifetimeTicks,
  nativeFireParticleVariant,
} from '../core-kernels/primary-spell-fire-native.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import {
  EMPTY_CONTENT_MANIFEST_SHA256,
  GAME_PROTOCOL_VERSION,
  PLAYER_CHARACTER_KERNEL_VERSION,
  GameProtocolError,
  decodeClientGameMessage,
  decodeServerGameMessage,
  encodeGameMessage,
  type ServerWelcomeMessage,
} from './game-protocol.ts'
import { createGameSnapshotFrame } from './entity-replication.ts'

const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

test('client protocol validates character hello, input, acknowledgement, and ping messages', () => {
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    character: CHARACTER,
    resumeToken: 'reserved-token',
  })), {
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    character: CHARACTER,
    resumeToken: 'reserved-token',
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-input',
    input: {
      aim: { x: 800, y: 450 },
      cast: { primary: true, secondary: false },
      movement: { x: 1, y: 0 },
    },
    sequence: 4,
    targetTick: 19,
  })), {
    type: 'client-input',
    input: {
      aim: { x: 800, y: 450 },
      cast: { primary: true, secondary: false },
      movement: { x: 1, y: 0 },
    },
    sequence: 4,
    targetTick: 19,
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  })), {
    type: 'client-start-match',
    boneyardId: 'default-random',
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-snapshot-ack',
    requireKeyframe: false,
    sequence: 12,
  })), {
    type: 'client-snapshot-ack',
    requireKeyframe: false,
    sequence: 12,
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-ping',
    nonce: 41,
  })), {
    type: 'client-ping',
    nonce: 41,
  })
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage({
    type: 'server-pong',
    nonce: 41,
  })), {
    type: 'server-pong',
    nonce: 41,
  })
})

test('server welcome round-trips content, kernel, character, and world ownership', () => {
  const welcome: ServerWelcomeMessage = {
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-token',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: {
      fixedTickSeconds: 0.01,
      movementAcceleration: 10,
      movementLaneCap: 118.75,
      movementRetention: 0.9,
      movementThresholdSquared: Math.fround(0.01),
      playerRadius: 25,
    },
    content: {
      manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256,
      mods: [],
    },
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    snapshot: createGameSnapshot(
      createGameSimulation({ 'player-1': CHARACTER }),
      'player-1',
    ),
    snapshotSequence: 1,
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(welcome)), welcome)
  assert.deepEqual(welcome.snapshot.players['player-1'].config, CHARACTER)
  assert.equal(welcome.snapshot.world.kind, 'hub')
})

test('protocol rejects legacy, malformed, and unsupported discriminated payloads', () => {
  assert.throws(() => decodeClientGameMessage('{'), GameProtocolError)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    displayName: 'legacy',
  })), /displayName|character/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    character: { ...CHARACTER, element: 'void' },
  })), /element/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-input',
    input: {
      aim: null,
      cast: { primary: false, secondary: false },
      movement: { x: 2, y: 0 },
    },
    sequence: 1,
    targetTick: 1,
  })), /magnitude/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-input',
    input: {
      aim: { x: 1, y: Number.POSITIVE_INFINITY },
      cast: { primary: false, secondary: false },
      movement: { x: 0, y: 0 },
    },
    sequence: 1,
    targetTick: 1,
  })), /aim/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-input',
    input: {
      aim: null,
      cast: { primary: 1, secondary: false },
      movement: { x: 0, y: 0 },
    },
    sequence: 1,
    targetTick: 1,
  })), /primary/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-input',
    input: { movement: { x: 0, y: 0 } },
    sequence: 1,
    targetTick: 1,
  })), /aim|cast/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-ping',
    nonce: -1,
  })), /nonce/)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-pong',
    nonce: 4.5,
  })), /nonce/)

  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: { ...frame, world: { ...frame.world, kind: 'unknown' } },
    sequence: 2,
  })), /kind/)
  const malformed = JSON.parse(JSON.stringify(frame))
  delete malformed.players['player-1'].config
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: malformed,
    sequence: 2,
  })), /config/)
  if (frame.world.kind !== 'hub') throw new Error('expected Hub frame')
  const malformedSample = JSON.parse(JSON.stringify(frame))
  malformedSample.world.entities.samples[0].pop()
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: malformedSample,
    sequence: 2,
  })), /invalid registered sample shape/)
  const malformedDescriptor = JSON.parse(JSON.stringify(frame))
  malformedDescriptor.world.entities.spawned[0][3] = 2
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: malformedDescriptor,
    sequence: 2,
  })), /invalid registered descriptor shape/)
})

test('protocol rejects malformed cast programs and primary-spell ownership', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  const decodeFrame = (candidate: unknown) => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: candidate,
    sequence: 2,
  }))
  const missile = {
    ageTicks: 1,
    charge: 1,
    direction: { x: 0, y: -1 },
    flightTicks: 1,
    id: 1,
    kind: 'ether',
    ownerId: 'player-1',
    phase: 'flight',
    position: { x: 800, y: 400 },
    velocity: { x: 0, y: -3 },
    worldKey: 'hub:courtyard',
  }
  const boulder = {
    ...missile,
    assemblyCharge: Math.fround(0.18),
    charge: 0.19,
    flightTicks: 0,
    kind: 'earth',
    phase: 'held',
    velocity: { x: 0, y: 0 },
  }
  const earthImpactSeed = {
    ageTicks: 3,
    birthTick: 40,
    charge: 0.5,
    id: 1,
    kind: 'earth-impact',
    origin: { x: 800, y: 400 },
    ownerId: 'player-1',
    worldKey: 'hub:courtyard',
  }
  const earthImpact = {
    ...earthImpactSeed,
    lifetimeTicks: earthImpactLifetimeTicks(earthImpactSeed),
  }
  const calledRock = {
    ageTicks: 8,
    falling: true,
    fallVelocity: 2,
    height: -12.5,
    id: 2,
    kind: 'earth-called-rock',
    lateralMagnitude: 3.25,
    ownerId: 'player-1',
    parentId: 1,
    position: { x: 760, y: 390 },
    rotation: 125,
    rotationStep: -12,
    scale: 0.2,
    speed: 0.5,
    targetHeight: -48,
    variant: 2,
    worldKey: 'hub:courtyard',
  }

  const decodedImpact = decodeFrame({
    ...frame,
    primarySpells: { nextId: 2, projectiles: [], transients: [earthImpact] },
  })
  assert.equal(decodedImpact.type, 'server-snapshot')
  assert.deepEqual(decodedImpact.frame.primarySpells.transients, [earthImpact])
  const fireParticle = {
    ageTicks: 7,
    direction: { x: 0, y: -1 },
    id: 1,
    kind: 'fire',
    origin: { x: 800, y: 400 },
    ownerId: 'player-1',
    variant: nativeFireParticleVariant(1),
    worldKey: 'hub:courtyard',
  }

  assert.doesNotThrow(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [fireParticle],
    },
  }))
  const decodedCalledRock = decodeFrame({
    ...frame,
    primarySpells: { nextId: 3, projectiles: [], transients: [calledRock] },
  })
  assert.equal(decodedCalledRock.type, 'server-snapshot')
  assert.deepEqual(decodedCalledRock.frame.primarySpells.transients, [calledRock])
  assert.doesNotThrow(() => decodeFrame({
    ...frame,
    primarySpells: { nextId: 2, projectiles: [boulder], transients: [] },
  }))
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...boulder, assemblyCharge: undefined }],
      transients: [],
    },
  }), /assemblyCharge/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...missile, assemblyCharge: 1 }],
      transients: [],
    },
  }), /assemblyCharge is not allowed/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...boulder, assemblyCharge: 0.21 }],
      transients: [],
    },
  }), /assemblyCharge/)

  assert.throws(() => decodeFrame({
    ...frame,
    players: {
      ...frame.players,
      'player-1': {
        ...frame.players['player-1'],
        primaryCast: { ...frame.players['player-1'].primaryCast, actionTick: 74 },
      },
    },
  }), /outside the Staff Cast 1 program/)
  assert.throws(() => decodeFrame({
    ...frame,
    players: {
      ...frame.players,
      'player-1': {
        ...frame.players['player-1'],
        primaryCast: {
          ...frame.players['player-1'].primaryCast,
          actionTick: 2,
          channelActive: true,
        },
      },
    },
  }), /outside the Staff Constant program/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...missile, ownerId: 'missing-player' }],
      transients: [],
    },
  }), /owner missing-player is not present/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...missile, phase: 'held' }],
      transients: [],
    },
  }), /only permits held Earth actors/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{
        ...missile,
        assemblyCharge: 0.2,
        charge: 0.2,
        kind: 'earth',
        phase: 'held',
        velocity: { x: 0, y: 0 },
      }],
      transients: [],
    },
  }), /flightTicks must be zero while held/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...missile, flightTicks: 0 }],
      transients: [],
    },
  }), /flightTicks is outside the actor age/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [missile],
      transients: [{
        ageTicks: 0,
        direction: { x: 0, y: -1 },
        id: 1,
        kind: 'water',
        origin: { x: 800, y: 400 },
        ownerId: 'player-1',
        variant: 0,
        worldKey: 'hub:courtyard',
      }],
    },
  }), /duplicate id 1/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{
        ageTicks: 0,
        direction: { x: 0, y: -1 },
        id: 1,
        kind: 'water',
        origin: { x: 800, y: 400 },
        ownerId: 'player-1',
        variant: 4,
        worldKey: 'hub:courtyard',
      }],
    },
  }), /variant exceeds the native family/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...earthImpact, direction: { x: 0, y: -1 } }],
    },
  }), /direction is not allowed/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...fireParticle, variant: (fireParticle.variant + 1) % 4 }],
    },
  }), /variant does not match its Fire particle id/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...earthImpact, charge: 1.1 }],
    },
  }), /charge must be within/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{
        ...fireParticle,
        ageTicks: nativeFireParticleLifetimeTicks(fireParticle.id),
      }],
    },
  }), /ageTicks exceeds its Fire particle lifetime/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 3,
      projectiles: [],
      transients: [{ ...calledRock, lateralMagnitude: 5 }],
    },
  }), /lateralMagnitude is outside/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...earthImpact, lifetimeTicks: earthImpact.lifetimeTicks + 1 }],
    },
  }), /lifetimeTicks does not match/)
})

test('protocol rejects player ids reserved by ordinary JavaScript records', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: {
      ...frame,
      players: { ['__proto__']: frame.players['player-1'] },
    },
    sequence: 2,
  })), /player id.*reserved/)
})

test('protocol validates participant ownership and the recovered Hub room graph', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  if (snapshot.world.kind !== 'hub') throw new Error('expected Hub snapshot')
  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  if (frame.world.kind !== 'hub') throw new Error('expected Hub frame')
  const message = (world: unknown) => JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: { ...frame, world },
    sequence: 2,
  })

  assert.throws(() => decodeServerGameMessage(message({
    ...frame.world,
    participants: {},
  })), /participants must match frame.players exactly/)

  assert.throws(() => decodeServerGameMessage(message({
    ...frame.world,
    participants: {
      'player-1': {
        region: 'mortuary',
        transition: {
          alpha: 0.5,
          destination: 'library',
          phase: 'outgoing',
          scriptedSpeed: 1,
          scriptedTarget: { x: 512, y: 2024 },
          sourceRegion: 'mortuary',
        },
      },
    },
  })), /transition is inconsistent/)

  assert.throws(() => decodeServerGameMessage(message({
    ...frame.world,
    participants: {
      'player-1': {
        region: 'courtyard',
        transition: {
          alpha: 1.1,
          destination: 'office',
          phase: 'outgoing',
          scriptedSpeed: 0.45,
          scriptedTarget: { x: 881.5, y: -1000 },
          sourceRegion: 'courtyard',
        },
      },
    },
  })), /alpha must be within/)
})

test('protocol bounds server-controlled world collections', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  assert.equal(snapshot.world.kind, 'hub')
  if (snapshot.world.kind !== 'hub') throw new Error('expected Hub snapshot')
  const hubWorld = snapshot.world
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-token',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: {
      fixedTickSeconds: 0.01,
      movementAcceleration: 10,
      movementLaneCap: 118.75,
      movementRetention: 0.9,
      movementThresholdSquared: Math.fround(0.01),
      playerRadius: 25,
    },
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    snapshot: {
      ...snapshot,
      world: {
        ...hubWorld,
        students: Array.from({ length: 257 }, () => hubWorld.students[0]),
      },
    },
    snapshotSequence: 1,
  })), /at most 256/)
})

test('loaded Boneyard round-trips scene identity, geometry, and Solomon Dig', () => {
  const message = {
    type: 'server-boneyard-loaded' as const,
    boneyard: {
      choice: { id: 'default-random', name: 'Random Boneyard', source: 'default' as const },
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
        fences: [{
          eid: 'entry-gate',
          points: [{ x: 100, y: 300 }, { x: 300, y: 300 }],
          segmentCode: 2,
          startPostVariant: 4,
          endPostVariant: 1,
          typeId: 3005,
        }],
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
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(message)), message)

  const snapshot = createGameSnapshot(
    enterBoneyardWorld(
      createGameSimulation({ 'player-1': CHARACTER }),
      message.boneyard,
    ),
    'player-1',
  )
  assert.equal(snapshot.world.kind, 'boneyard')
  if (snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(snapshot.world.gateLeaves.length, 2)
  assert.equal(snapshot.world.encounter?.acceleration, 0)
  assert.equal(snapshot.world.encounter?.digFrame, 0)
  assert.equal(snapshot.world.encounter?.transitionOffsetY, 0)
  const snapshotMessage = {
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(snapshot, 0, undefined, true),
    sequence: 2,
    type: 'server-snapshot' as const,
  }
  assert.deepEqual(
    decodeServerGameMessage(encodeGameMessage(snapshotMessage)),
    snapshotMessage,
  )

  const malformed = JSON.parse(encodeGameMessage(snapshotMessage))
  delete malformed.frame.world.gateLeaves[0].tip
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(malformed)),
    /tip/,
  )

  const invalidPhase = JSON.parse(encodeGameMessage(snapshotMessage))
  invalidPhase.frame.world.encounter.phase = 'monologuing'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidPhase)),
    /encounter\.phase/,
  )

  const invalidCue = JSON.parse(encodeGameMessage(snapshotMessage))
  invalidCue.frame.world.encounter.voiceEvents = [{ id: 1, cue: 'solomon-improvised' }]
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidCue)),
    /voiceEvents\[0\]\.cue/,
  )

  const exactNativeHeading = JSON.parse(encodeGameMessage(snapshotMessage))
  exactNativeHeading.frame.world.encounter.headingDeg = 360
  const decodedHeading = decodeServerGameMessage(JSON.stringify(exactNativeHeading))
  assert.equal(
    decodedHeading.type === 'server-snapshot'
      && decodedHeading.frame.world.kind === 'boneyard'
      ? decodedHeading.frame.world.encounter?.headingDeg
      : null,
    360,
  )

  const invalidDigFrame = JSON.parse(encodeGameMessage(snapshotMessage))
  invalidDigFrame.frame.world.encounter.digFrame = 18
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidDigFrame)),
    /encounter\.digFrame/,
  )

  const enemy = {
    enemyToken: 'SKELETON',
    flags: ['FLAG_WEAK'],
    headingDeg: 90,
    id: 1,
    locationPolicy: 'near-player',
    nativeTypeId: 1001,
    position: { x: 300, y: 400 },
    spawnTick: 12,
    targetPlayerId: 'player-1',
  }
  const invalidType = JSON.parse(encodeGameMessage(snapshotMessage))
  invalidType.frame.world.waves.enemies = [{ ...enemy, nativeTypeId: 1004 }]
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidType)),
    /nativeTypeId does not match/,
  )

  const duplicateEnemies = JSON.parse(encodeGameMessage(snapshotMessage))
  duplicateEnemies.frame.world.waves.enemies = [enemy, { ...enemy }]
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(duplicateEnemies)),
    /duplicates id 1/,
  )
})

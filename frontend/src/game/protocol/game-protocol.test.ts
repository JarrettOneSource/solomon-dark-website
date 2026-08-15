import assert from 'node:assert/strict'
import test from 'node:test'

import {
  acknowledgeGameSimulationOver,
  confirmGameSimulationLoadout,
  createGameSimulation,
  enterBoneyardWorld,
} from '../core-server/game-simulation.ts'
import { earthImpactLifetimeTicks } from '../core-kernels/primary-spell-earth.ts'
import { BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS } from '../core-kernels/boneyard-enemy-modifiers.ts'
import { EARTH_BOULDER_IDENTITY_ORIENTATION } from '../core-kernels/primary-spell-earth-orientation.ts'
import {
  NATIVE_FIRE_IMPACT_LIFETIME_TICKS,
  nativeFireParticleLifetimeTicks,
  nativeFireParticleVariant,
} from '../core-kernels/primary-spell-fire-native.ts'
import { ETHER_PRIMARY_INITIAL_TURN } from '../core-kernels/primary-spell-targeting.ts'
import type { BoneyardEnemySemanticEvent } from '../core-server/boneyard-enemy-store.ts'
import {
  coldSlowPlayerEntity,
  dazzlePlayerEntity,
} from '../core-server/player-entity-store.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import {
  EMPTY_CONTENT_MANIFEST_SHA256,
  GAME_PROTOCOL_VERSION,
  PLAYER_CHARACTER_KERNEL_VERSION,
  GameProtocolError,
  decodeClientGameMessage,
  decodeServerGameMessage,
  encodeGameMessage,
  type LoadedBoneyard,
  type ServerWelcomeMessage,
} from './game-protocol.ts'
import { createGameSnapshotFrame } from './entity-replication.ts'

const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

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
    type: 'client-acknowledge-game-over',
    eventId: 3,
    runId: 'run-three',
  })), {
    type: 'client-acknowledge-game-over',
    eventId: 3,
    runId: 'run-three',
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-confirm-loadout',
  })), {
    type: 'client-confirm-loadout',
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-select-skill',
    choiceIndex: 2,
    offerSequence: 7,
    skillId: 48,
  })), {
    type: 'client-select-skill',
    choiceIndex: 2,
    offerSequence: 7,
    skillId: 48,
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
  assert.deepEqual(welcome.snapshot.players['player-1'].progression, {
    activeWeldBuildId: null,
    currentHealth: 50,
    currentMana: 100,
    coldSlowTicksRemaining: 0,
    dazzleTicksRemaining: 0,
    deathEpoch: 0,
    deathTick: 0,
    experience: 0,
    learnedSkills: [[0, 1, 1], [7, 1, 1], [8, 1, 1], [11, 1, 1]],
    level: 1,
    lifeState: 'alive',
    maximumHealth: 50,
    maximumMana: 100,
    nextThreshold: 90,
    pendingOffer: null,
    poisonDamagePerTick: 0,
    poisonTicksRemaining: 0,
    previousThreshold: 0,
    revision: 0,
  })
  assert.deepEqual(welcome.snapshot.run, {
    eligiblePlayerIds: [],
    gameOverEventId: 0,
    gameOverTicks: 0,
    lastCompletedRunId: null,
    nextGameOverEventId: 1,
    phase: 'hub',
    runId: null,
  })
  assert.equal(welcome.snapshot.world.kind, 'hub')

  const resumedSnapshot = createGameSnapshot(
    enterBoneyardWorld(
      createGameSimulation({ 'player-1': CHARACTER }),
      loadedBoneyardFixture('maggot-resume'),
    ),
    'player-1',
  )
  if (resumedSnapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  resumedSnapshot.world.maggots = [{
    alpha: 1,
    currentHealth: 1,
    deathEpoch: 0,
    deathTick: 0,
    headingDeg: 90,
    hitFlash: 0.6,
    id: 2,
    emergenceTick: 24,
    launchTrajectory: 'edge',
    maximumHealth: 2,
    ownerCoffinActorId: 1,
    pose: 0.5,
    position: { x: 200, y: 300 },
    spawnTick: 10,
    state: 'crawl',
    verticalOffset: 0,
  }]
  const resumedWelcome = {
    ...welcome,
    snapshot: resumedSnapshot,
    snapshotSequence: 2,
  }
  assert.deepEqual(
    decodeServerGameMessage(encodeGameMessage(resumedWelcome)),
    resumedWelcome,
  )

  const missingHitFlash = JSON.parse(encodeGameMessage(resumedWelcome))
  delete missingHitFlash.snapshot.world.maggots[0].hitFlash
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingHitFlash)),
    /hitFlash/,
  )
})

test('protocol v20 strictly round-trips projected statuses, shields, payloads, and effects', () => {
  const loaded = loadedBoneyardFixture('modifier-protocol-run')
  const active = enterBoneyardWorld(
    createGameSimulation({ 'player-1': CHARACTER }),
    loaded,
  )
  const affected = {
    ...active,
    playerEntities: dazzlePlayerEntity(
      coldSlowPlayerEntity(active.playerEntities, 'player-1', 300),
      'player-1',
      50,
    ),
  }
  const snapshot = createGameSnapshot(affected, 'player-1')
  if (snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(snapshot.players['player-1']?.progression.coldSlowTicksRemaining, 300)
  assert.equal(snapshot.players['player-1']?.progression.dazzleTicksRemaining, 50)
  snapshot.world.enemies = [{
    animation: {
      action: null,
      actionProgress: 0,
      alpha: 1,
      bodyPose: 0,
      coffinPose: 0,
      coffinSecondaryPose: null,
      coffinState: 'closed',
      deathEpoch: 0,
      deathTick: 0,
      demonFrontJointRotationRadians: 0,
      demonFrontLimbRotationRadians: 0,
      demonRearJointRotationRadians: 0,
      demonRearLimbRotationRadians: 0,
      effects: [{
        alpha: 1 / BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS,
        atlas: 'BadGuys',
        blendMode: 'add',
        entry: 381,
        id: 42,
        offset: { x: 0, y: 0 },
        role: 'mage-lightning-source',
        rotationRadians: 0,
        scale: 1,
      }, {
        alpha: 1 / BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS,
        atlas: 'BadGuys',
        blendMode: 'add',
        entry: 382,
        id: 43,
        offset: { x: 150, y: 0 },
        role: 'mage-lightning-target',
        rotationRadians: 0,
        scale: 1,
      }],
      gaitPose: 0,
      hitFlash: 0,
      impEffectFrame: -1,
      maggots: [],
      state: 'idle',
      verticalOffset: 0,
      zombieAngularOffsetDeg: 0,
      zombieFrontArmPose: 0,
      zombieFrontArmRotationRadians: 0,
      zombieRearArmPose: 0,
      zombieRearArmRotationRadians: 0,
    },
    armored: true,
    currentHealth: 5,
    enemyToken: 'SKELETON',
    flags: ['FLAG_ARMOR'],
    headingDeg: 90,
    id: 1,
    maximumHealth: 5,
    nativeTypeId: 1001,
    position: { x: 100, y: 100 },
    shieldHealth: 25,
    shieldMaximumHealth: 50,
    spawnTick: 0,
  }]
  snapshot.world.enemyProjectiles = [{
    ageTicks: 3,
    contactRadius: 8,
    headingDeg: 90,
    homing: false,
    id: 2,
    kind: 'arrow',
    lifetimeTicks: 300,
    nativeTypeId: 0x7da,
    ownerActorId: 1,
    payload: 'poison',
    position: { x: 110, y: 100 },
    spawnTick: 1,
  }]
  snapshot.world.maggots = [{
    alpha: 1,
    currentHealth: 2,
    deathEpoch: 0,
    deathTick: 0,
    emergenceTick: 12,
    headingDeg: 90,
    hitFlash: 0,
    id: 3,
    launchTrajectory: 'lid',
    maximumHealth: 2,
    ownerCoffinActorId: 1,
    pose: 0.5,
    position: { x: 120, y: 100 },
    spawnTick: 1,
    state: 'emerging',
    verticalOffset: -20,
  }]
  snapshot.world.deathEffects = [{
    ageTicks: 7,
    alpha: 0.75,
    atlas: 'BadGuys',
    blendMode: 'normal',
    entry: 117,
    height: -4.25,
    id: 4,
    kind: 'bouncer',
    ownerActorId: 1,
    position: { x: 130, y: 100 },
    rotationRadians: 0.5,
    scale: 1.2,
    shadow: true,
    spawnTick: 1,
    tint: 0xffaa88,
  }]
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
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    boneyards: [loaded.choice],
    snapshot,
    snapshotSequence: 1,
  }

  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(welcome)), welcome)

  const missingCold = JSON.parse(encodeGameMessage(welcome))
  delete missingCold.snapshot.players['player-1'].progression.coldSlowTicksRemaining
  assert.throws(() => decodeServerGameMessage(JSON.stringify(missingCold)), /coldSlowTicksRemaining/)

  const oversizedDazzle = JSON.parse(encodeGameMessage(welcome))
  oversizedDazzle.snapshot.players['player-1'].progression.dazzleTicksRemaining = 51
  assert.throws(() => decodeServerGameMessage(JSON.stringify(oversizedDazzle)), /dazzleTicksRemaining/)

  const incompatiblePayload = JSON.parse(encodeGameMessage(welcome))
  incompatiblePayload.snapshot.world.enemyProjectiles[0].payload = 'cold'
  assert.throws(() => decodeServerGameMessage(JSON.stringify(incompatiblePayload)), /payload/)

  const invalidShield = JSON.parse(encodeGameMessage(welcome))
  invalidShield.snapshot.world.enemies[0].shieldHealth = 51
  assert.throws(() => decodeServerGameMessage(JSON.stringify(invalidShield)), /shieldHealth/)

  const invalidLightning = JSON.parse(encodeGameMessage(welcome))
  invalidLightning.snapshot.world.enemies[0].animation.effects[0].entry = 382
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidLightning)),
    /fields do not match role/,
  )

  const invalidEmergence = JSON.parse(encodeGameMessage(welcome))
  invalidEmergence.snapshot.world.maggots[0].state = 'crawl'
  assert.throws(() => decodeServerGameMessage(JSON.stringify(invalidEmergence)), /emergenceTick/)

  const invalidDeathEffect = JSON.parse(encodeGameMessage(welcome))
  invalidDeathEffect.snapshot.world.deathEffects[0].alpha = 1.01
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidDeathEffect)),
    /deathEffects\[0\]\.alpha/,
  )

  const duplicateDeathEffect = JSON.parse(encodeGameMessage(welcome))
  duplicateDeathEffect.snapshot.world.deathEffects.push(
    duplicateDeathEffect.snapshot.world.deathEffects[0],
  )
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(duplicateDeathEffect)),
    /deathEffects duplicates id/,
  )
})

test('protocol v20 carries run lifecycle and authoritative combat modifiers', () => {
  assert.equal(GAME_PROTOCOL_VERSION, 20)
  const loaded = loadedBoneyardFixture('run-v16')
  const active = enterBoneyardWorld(
    createGameSimulation({ 'player-1': CHARACTER }),
    loaded,
  )
  const gameOverState = {
    ...active,
    run: {
      ...active.run,
      gameOverEventId: 1,
      gameOverTicks: 1_000,
      nextGameOverEventId: 2,
      phase: 'game-over' as const,
    },
  }
  const gameOverSnapshot = createGameSnapshot(gameOverState, 'player-1')
  const dyingPlayer = gameOverSnapshot.players['player-1']!
  const snapshotWithDeath = {
    ...gameOverSnapshot,
    players: {
      ...gameOverSnapshot.players,
      'player-1': {
        ...dyingPlayer,
        progression: {
          ...dyingPlayer.progression,
          currentHealth: 0,
          deathEpoch: 1,
          deathTick: 159,
          lifeState: 'spectating' as const,
        },
      },
    },
  }
  const terminalMessage = {
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(snapshotWithDeath, 0, undefined, true),
    sequence: 2,
    type: 'server-snapshot' as const,
  }
  assert.deepEqual(
    decodeServerGameMessage(encodeGameMessage(terminalMessage)),
    terminalMessage,
  )

  const loadoutState = acknowledgeGameSimulationOver(gameOverState, 'run-v16', 1)
  assert.ok(loadoutState)
  const loadoutSnapshot = createGameSnapshot(loadoutState, 'player-1')
  const loadoutMessage = {
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(loadoutSnapshot, 0, undefined, true),
    sequence: 3,
    type: 'server-snapshot' as const,
  }
  assert.deepEqual(
    decodeServerGameMessage(encodeGameMessage(loadoutMessage)),
    loadoutMessage,
  )
  assert.equal(loadoutSnapshot.run.phase, 'loadout')
  assert.equal(loadoutSnapshot.run.lastCompletedRunId, 'run-v16')
  assert.equal(loadoutSnapshot.world.kind, 'hub')

  const hubState = confirmGameSimulationLoadout(loadoutState)
  assert.ok(hubState)
  const hubSnapshot = createGameSnapshot(hubState, 'player-1')
  assert.equal(hubSnapshot.run.phase, 'hub')
  assert.equal(hubSnapshot.run.gameOverEventId, 0)
  assert.equal(hubSnapshot.run.lastCompletedRunId, 'run-v16')

  const missingRun = JSON.parse(encodeGameMessage(terminalMessage))
  delete missingRun.frame.run
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingRun)),
    /frame\.run/,
  )

  const mismatchedWorld = JSON.parse(encodeGameMessage(loadoutMessage))
  mismatchedWorld.frame.run = terminalMessage.frame.run
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(mismatchedWorld)),
    /run does not match its Boneyard world/,
  )

  const unsupportedLifeState = JSON.parse(encodeGameMessage(terminalMessage))
  unsupportedLifeState.frame.players['player-1'].progression.lifeState = 'ghost'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(unsupportedLifeState)),
    /lifeState is not supported/,
  )
})

test('protocol v20 preserves the bounded run-scoped enemy semantic-event lane', () => {
  const runId = 'enemy-event-protocol-run'
  const active = enterBoneyardWorld(
    createGameSimulation({ 'player-1': CHARACTER }),
    loadedBoneyardFixture(runId),
  )
  if (active.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const enemyEvents: BoneyardEnemySemanticEvent[] = [
    {
      actorId: 3,
      eventId: 1,
      targetPlayerId: 'player-1',
      tick: 10,
      type: 'enemy-spawned',
    },
    {
      actorId: 3,
      eventId: 2,
      targetPlayerId: 'player-1',
      tick: 11,
      type: 'attack-marker',
    },
    {
      actorId: 3,
      eventId: 3,
      sourcePosition: { x: 120, y: 240 },
      targetPlayerId: 'player-1',
      targetPosition: { x: 300, y: 260 },
      tick: 11,
      type: 'mage-lightning',
    },
    {
      actorId: 3,
      eventId: 4,
      projectileId: 9,
      targetPlayerId: 'player-1',
      tick: 11,
      type: 'projectile-spawned',
    },
    {
      actorId: 3,
      eventId: 5,
      projectileId: 9,
      targetPlayerId: 'player-1',
      tick: 12,
      type: 'projectile-impact',
    },
    {
      actorId: 3,
      eventId: 6,
      projectileId: 9,
      targetPlayerId: 'player-1',
      tick: 12,
      type: 'projectile-retired',
    },
    { actorId: 3, eventId: 7, tick: 13, type: 'enemy-death' },
    {
      actorId: 3,
      count: 2,
      eventId: 8,
      output: 'demon-split',
      tick: 13,
      type: 'enemy-terminal-output',
    },
    {
      actorId: 3,
      eventId: 9,
      gainScale: 1,
      pitch: 0.875,
      sound: 'skeleton-die',
      sourcePosition: { x: 120, y: 240 },
      tick: 13,
      type: 'enemy-death-sound',
    },
    {
      actorId: 3,
      eventId: 10,
      targetPlayerId: 'player-1',
      tick: 13,
      type: 'reward',
    },
    { actorId: 3, eventId: 11, tick: 20, type: 'enemy-retired' },
    {
      actorId: 4,
      count: 20,
      eventId: 12,
      tick: 20,
      type: 'coffin-maggot-release',
    },
  ]
  const state = {
    ...active,
    tick: 20,
    world: { ...active.world, enemyEvents },
  }
  const snapshot = createGameSnapshot(state, 'player-1')
  if (snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.ok(snapshot.world.enemyEvents.every((event) => event.runId === runId))

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
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    boneyards: [loadedBoneyardFixture(runId).choice],
    snapshot,
    snapshotSequence: 1,
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(welcome)), welcome)

  const message = {
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(snapshot, 0, undefined, true),
    sequence: 2,
    type: 'server-snapshot' as const,
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(message)), message)

  const wrongRun = JSON.parse(encodeGameMessage(message))
  wrongRun.frame.world.enemyEvents[0].runId = 'another-run'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(wrongRun)),
    /runId does not match/,
  )

  const missingProjectile = JSON.parse(encodeGameMessage(message))
  delete missingProjectile.frame.world.enemyEvents[3].projectileId
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingProjectile)),
    /projectileId/,
  )

  const missingLightningEndpoint = JSON.parse(encodeGameMessage(message))
  delete missingLightningEndpoint.frame.world.enemyEvents[2].targetPosition
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingLightningEndpoint)),
    /targetPosition/,
  )

  const extraLightningPayload = JSON.parse(encodeGameMessage(message))
  extraLightningPayload.frame.world.enemyEvents[2].projectileId = 9
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(extraLightningPayload)),
    /projectileId is not allowed/,
  )

  const missingDeathSoundPitch = JSON.parse(encodeGameMessage(message))
  delete missingDeathSoundPitch.frame.world.enemyEvents[8].pitch
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(missingDeathSoundPitch)),
    /pitch/,
  )

  const unsupportedDeathSound = JSON.parse(encodeGameMessage(message))
  unsupportedDeathSound.frame.world.enemyEvents[8].sound = 'skeleton-ish'
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(unsupportedDeathSound)),
    /sound is not supported/,
  )

  const excessDeathSoundGain = JSON.parse(encodeGameMessage(message))
  excessDeathSoundGain.frame.world.enemyEvents[8].gainScale = 1.01
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(excessDeathSoundGain)),
    /gainScale must be within/,
  )
})

test('progression snapshots carry the next rank needed by the stock picker label', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': {
      discipline: 'arcane',
      displayName: 'Helvidius',
      element: 'fire',
    } }, { initialPlayerExperience: 100 }),
    'player-1',
  )
  const pendingOffer = snapshot.players['player-1']!.progression.pendingOffer
  assert.ok(pendingOffer)
  assert.deepEqual(snapshot.levelUpBarrier, {
    barrierId: 1,
    milestoneExperience: 100,
    milestoneLevel: 2,
    participantIds: ['player-1'],
    pendingPlayerIds: ['player-1'],
    runId: null,
    sourcePlayerId: 'player-1',
  })
  assert.ok(pendingOffer.options.every(({ skillId, targetRank }) => {
    const learned = snapshot.players['player-1']!.progression.learnedSkills
      .find(([learnedSkillId]) => learnedSkillId === skillId)
    return targetRank === (learned?.[1] ?? 0) + 1
  }))

  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  const fractional = JSON.parse(JSON.stringify(frame))
  fractional.players['player-1'].progression.experience = 90.85
  fractional.levelUpBarrier.milestoneExperience = 90.85
  const fractionalMessage = decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: fractional,
    sequence: 2,
  }))
  assert.equal(fractionalMessage.type, 'server-snapshot')
  assert.equal(fractionalMessage.frame.players['player-1']!.progression.experience, 90.85)

  const missingBarrierOffer = JSON.parse(JSON.stringify(frame))
  missingBarrierOffer.players['player-1'].progression.pendingOffer = null
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: missingBarrierOffer,
    sequence: 2,
  })), /pending player has no skill offer/)

  const duplicateBarrierParticipant = JSON.parse(JSON.stringify(frame))
  duplicateBarrierParticipant.levelUpBarrier.participantIds.push('player-1')
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: duplicateBarrierParticipant,
    sequence: 2,
  })), /sorted, unique/)
  const malformed = JSON.parse(JSON.stringify(frame))
  delete malformed.players['player-1'].progression.pendingOffer.options[0].targetRank
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: malformed,
    sequence: 2,
  })), /targetRank/)

  const missingWeldBuild = JSON.parse(JSON.stringify(frame))
  missingWeldBuild.players['player-1'].progression.pendingOffer.options[0] = {
    skillId: 52,
    targetRank: 1,
  }
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: missingWeldBuild,
    sequence: 2,
  })), /Spell Welding/)

  const invalidWeldBuild = JSON.parse(JSON.stringify(frame))
  invalidWeldBuild.players['player-1'].progression.pendingOffer.options[0] = {
    skillId: 52,
    targetRank: 1,
    weldBuildId: 1010,
  }
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: invalidWeldBuild,
    sequence: 2,
  })), /weldBuildId/)

  const misplacedWeldBuild = JSON.parse(JSON.stringify(frame))
  misplacedWeldBuild.players['player-1'].progression.pendingOffer.options[0].weldBuildId = 1000
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: misplacedWeldBuild,
    sequence: 2,
  })), /requires Spell Welding/)
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
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-select-skill',
    choiceIndex: 4,
    offerSequence: 1,
    skillId: 48,
  })), /choiceIndex/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-select-skill',
    choiceIndex: 0,
    offerSequence: 1,
    skillId: 80,
  })), /skillId/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-acknowledge-game-over',
    eventId: 0,
    runId: 'run-one',
  })), /eventId/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-confirm-loadout',
    runId: 'run-one',
  })), /message\.runId is not allowed/)
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
    damage: 4,
    direction: { x: 0, y: -1 },
    flightTicks: 1,
    headingDegrees: 0,
    id: 1,
    kind: 'ether',
    ownerId: 'player-1',
    phase: 'flight',
    position: { x: 800, y: 400 },
    targetId: null,
    turnAccumulator: ETHER_PRIMARY_INITIAL_TURN,
    underpowered: false,
    velocity: { x: 0, y: -3 },
    worldKey: 'hub:courtyard',
  }
  const boulder = {
    ageTicks: missile.ageTicks,
    assemblyCharge: Math.fround(0.18),
    charge: 0.19,
    damage: missile.damage,
    direction: missile.direction,
    flightTicks: 0,
    hitTargetIds: [],
    id: missile.id,
    kind: 'earth',
    orientation: EARTH_BOULDER_IDENTITY_ORIENTATION,
    ownerId: missile.ownerId,
    phase: 'held',
    position: missile.position,
    velocity: { x: 0, y: 0 },
    worldKey: missile.worldKey,
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

  assert.doesNotThrow(() => decodeFrame({
    ...frame,
    primarySpells: { nextId: 2, projectiles: [missile], transients: [] },
  }))

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
  const fireImpact = {
    ageTicks: 8,
    id: 1,
    kind: 'fire-impact',
    origin: { x: 800, y: 400 },
    ownerId: 'player-1',
    worldKey: 'hub:courtyard',
  }
  const etherImpact = {
    ageTicks: 8,
    birthTick: 91,
    id: 1,
    kind: 'ether-impact',
    origin: { x: 800, y: 400 },
    ownerId: 'player-1',
    worldKey: 'hub:courtyard',
  }
  const airBolt = {
    ageTicks: 0,
    birthTick: 91,
    direction: { x: 0, y: -1 },
    endpoint: { x: 820, y: 180 },
    id: 1,
    kind: 'air',
    midpoint: { x: 800, y: 290 },
    origin: { x: 800, y: 400 },
    ownerId: 'player-1',
    targetId: 'scenery:grave-7',
    underpowered: true,
    variant: 1,
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
  const decodedFireImpact = decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [fireImpact],
    },
  })
  assert.equal(decodedFireImpact.type, 'server-snapshot')
  assert.deepEqual(decodedFireImpact.frame.primarySpells.transients, [fireImpact])
  const decodedEtherImpact = decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [etherImpact],
    },
  })
  assert.equal(decodedEtherImpact.type, 'server-snapshot')
  assert.deepEqual(decodedEtherImpact.frame.primarySpells.transients, [etherImpact])
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...etherImpact, birthTick: undefined }],
    },
  }), /birthTick/)
  const decodedAir = decodeFrame({
    ...frame,
    primarySpells: { nextId: 2, projectiles: [], transients: [airBolt] },
  })
  assert.equal(decodedAir.type, 'server-snapshot')
  assert.deepEqual(decodedAir.frame.primarySpells.transients, [airBolt])
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...airBolt, ageTicks: 3 }],
    },
  }), /Air contact lifetime/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [],
      transients: [{ ...airBolt, midpoint: undefined }],
    },
  }), /midpoint/)
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
  const decodedMissile = decodeFrame({
    ...frame,
    primarySpells: { nextId: 2, projectiles: [missile], transients: [] },
  })
  assert.equal(decodedMissile.type, 'server-snapshot')
  assert.equal(decodedMissile.frame.primarySpells.projectiles[0]!.damage, 4)
  assert.equal(decodedMissile.frame.primarySpells.projectiles[0]!.kind, 'ether')
  if (decodedMissile.frame.primarySpells.projectiles[0]!.kind !== 'ether') {
    throw new Error('expected an Ether projectile')
  }
  assert.equal(decodedMissile.frame.primarySpells.projectiles[0]!.underpowered, false)

  const weakFrame = decodeFrame({
    ...frame,
    players: {
      ...frame.players,
      'player-1': {
        ...frame.players['player-1'],
        primaryCast: {
          ...frame.players['player-1'].primaryCast,
          fizzleSequence: 1,
          underpowered: true,
        },
      },
    },
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...missile, damage: 2, underpowered: true }],
      transients: [],
    },
  })
  assert.equal(weakFrame.type, 'server-snapshot')
  assert.equal(weakFrame.frame.players['player-1'].primaryCast.fizzleSequence, 1)
  assert.equal(weakFrame.frame.players['player-1'].primaryCast.underpowered, true)
  assert.equal(weakFrame.frame.primarySpells.projectiles[0]!.kind, 'ether')
  if (weakFrame.frame.primarySpells.projectiles[0]!.kind !== 'ether') {
    throw new Error('expected an Ether projectile')
  }
  assert.equal(weakFrame.frame.primarySpells.projectiles[0]!.underpowered, true)

  const missingDamage = JSON.parse(JSON.stringify(missile))
  delete missingDamage.damage
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: { nextId: 2, projectiles: [missingDamage], transients: [] },
  }), /damage must be finite/)
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
      projectiles: [{ ...boulder, hitTargetIds: undefined }],
      transients: [],
    },
  }), /hitTargetIds/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...boulder, hitTargetIds: ['enemy:1', 'enemy:1'] }],
      transients: [],
    },
  }), /duplicate target/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...boulder, orientation: undefined }],
      transients: [],
    },
  }), /orientation/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...boulder, orientation: [1, 0, 0] }],
      transients: [],
    },
  }), /nine float32 values/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 2,
      projectiles: [{
        ...boulder,
        orientation: [...EARTH_BOULDER_IDENTITY_ORIENTATION.slice(0, 8), 1 / 3],
      }],
      transients: [],
    },
  }), /must be float32/)
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
    primarySpells: {
      nextId: 2,
      projectiles: [{ ...missile, damage: 0 }],
      transients: [],
    },
  }), /damage must be positive/)

  assert.throws(() => decodeFrame({
    ...frame,
    players: {
      ...frame.players,
      'player-1': {
        ...frame.players['player-1'],
        primaryCast: { ...frame.players['player-1'].primaryCast, actionTick: 56 },
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
          targetId: 'scenery:grave-7',
        },
      },
    },
  }), /targetId is only valid for Air/)
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
        ...boulder,
        flightTicks: 1,
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
        ageTicks: 1,
        direction: { x: 0, y: -1 },
        id: 1,
        kind: 'water',
        obstructionDistance: null,
        obstructionPoint: null,
        origin: { x: 800, y: 400 },
        ownerId: 'player-1',
        underpowered: false,
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
        ageTicks: 1,
        direction: { x: 0, y: -1 },
        id: 1,
        kind: 'water',
        obstructionDistance: null,
        obstructionPoint: null,
        origin: { x: 800, y: 400 },
        ownerId: 'player-1',
        underpowered: false,
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
      transients: [{
        ageTicks: 1,
        direction: { x: 0, y: -1 },
        id: 1,
        kind: 'water',
        obstructionDistance: null,
        origin: { x: 800, y: 400 },
        ownerId: 'player-1',
        underpowered: false,
        variant: 0,
        worldKey: 'hub:courtyard',
      }],
    },
  }), /obstructionPoint must be an object/)
  assert.throws(() => decodeFrame({
    ...frame,
    primarySpells: {
      nextId: 3,
      projectiles: [],
      transients: [{
        ageTicks: 1,
        direction: { x: 1, y: 0 },
        id: 2,
        kind: 'water',
        obstructionDistance: 0,
        obstructionPoint: null,
        origin: { x: 800, y: 400 },
        ownerId: 'player-1',
        underpowered: false,
        variant: 0,
        worldKey: 'hub:courtyard',
      }],
    },
  }), /must be present together/)
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
      nextId: 2,
      projectiles: [],
      transients: [{
        ...fireImpact,
        ageTicks: NATIVE_FIRE_IMPACT_LIFETIME_TICKS,
      }],
    },
  }), /ageTicks exceeds the Fire impact lifetime/)
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

  const enemyDescriptor = [2, 1, 0, 1001, 12, 5, 1, 0]
  const invalidType = JSON.parse(encodeGameMessage(snapshotMessage))
  invalidType.frame.world.entities.spawned = [[...enemyDescriptor.slice(0, 3), 1004, ...enemyDescriptor.slice(4)]]
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalidType)),
    /invalid registered descriptor shape/,
  )

  const duplicateEnemies = JSON.parse(encodeGameMessage(snapshotMessage))
  duplicateEnemies.frame.world.entities.spawned = [enemyDescriptor, [...enemyDescriptor]]
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(duplicateEnemies)),
    /duplicates 2:1/,
  )
})

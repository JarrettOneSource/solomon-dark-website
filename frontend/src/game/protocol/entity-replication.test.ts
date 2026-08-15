import assert from 'node:assert/strict'
import test from 'node:test'

import { createHubStudentFixturePopulation } from '../core-server/hub-student-fixtures.ts'
import { createGameSimulation } from '../core-server/game-simulation.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import type {
  BoneyardEnemyDeathEffectSnapshot,
  BoneyardEnemySnapshot,
  BoneyardEnemyProjectileSnapshot,
  BoneyardMaggotSnapshot,
  GameSnapshot,
  ProtocolStudentState,
} from './game-state.ts'
import type {
  ReplicatedEntityDescriptor,
  ReplicatedEntitySample,
} from './replicated-entity-types.ts'
import {
  EntityReplicationGapError,
  EntityReplicationReconstructor,
  REPLICATED_ENTITY_TYPES,
  REPLICATED_ENTITY_TYPE_REGISTRY,
  createGameSnapshotFrame,
  createReplicatedEntityBaseline,
} from './entity-replication.ts'

function hubSnapshot(studentCount: number): GameSnapshot {
  return createGameSnapshot(createGameSimulation({}, {
    hubStudentPopulation: createHubStudentFixturePopulation({
      count: studentCount,
      seed: 0x12345678,
    }),
  }), null)
}

function boneyardSnapshot(runId: string): GameSnapshot {
  const base = createGameSnapshot(createGameSimulation({
    wizard: {
      discipline: 'arcane',
      displayName: 'Replication Wizard',
      element: 'fire',
    },
  }), 'wizard')
  return {
    ...base,
    run: {
      eligiblePlayerIds: ['wizard'],
      gameOverEventId: 0,
      gameOverTicks: 0,
      lastCompletedRunId: null,
      nextGameOverEventId: 1,
      phase: 'active',
      runId,
    },
    world: {
      deathEffects: [],
      encounter: null,
      enemies: [enemySnapshot()],
      enemyEvents: [{
        actorId: 7,
        eventId: 1,
        runId,
        targetPlayerId: 'wizard',
        tick: 0,
        type: 'enemy-spawned',
      }],
      enemyProjectiles: [],
      gateLeaves: [],
      kind: 'boneyard',
      maggots: [],
      runId,
      waves: null,
    },
  }
}

test('registry gives Students stable static descriptors and compact dynamic samples', () => {
  assert.equal(REPLICATED_ENTITY_TYPE_REGISTRY.has(REPLICATED_ENTITY_TYPES.student), true)
  const initial = hubSnapshot(256)
  const moved = cloneSnapshot(initial)
  if (moved.world.kind !== 'hub') throw new Error('expected Hub snapshot')
  moved.tick += 5
  moved.world.students = moved.world.students.map((student, index) => ({
    ...student,
    framePhase: student.framePhase + 0.37,
    heading: student.heading + 1.2,
    position: {
      x: student.position.x + index * 0.003,
      y: student.position.y - index * 0.002,
    },
  }))
  const frame = createGameSnapshotFrame(
    moved,
    10,
    createReplicatedEntityBaseline(initial),
  )
  if (frame.world.kind !== 'hub') throw new Error('expected Hub frame')
  assert.equal(frame.world.entities.keyframe, false)
  assert.equal(frame.world.entities.spawned.length, 0)
  assert.equal(frame.world.entities.retired.length, 0)
  assert.equal(frame.world.entities.samples.length, 256)

  const fullBytes = Buffer.byteLength(JSON.stringify(initial))
  const frameBytes = Buffer.byteLength(JSON.stringify(frame))
  assert.ok(frameBytes < fullBytes * 0.4, `${frameBytes} is not compact against ${fullBytes}`)
})

test('reconstructor applies quantized motion and exact spawn-retire lifecycle', () => {
  const initial = hubSnapshot(32)
  const changed = cloneSnapshot(initial)
  if (changed.world.kind !== 'hub' || initial.world.kind !== 'hub') {
    throw new Error('expected Hub snapshots')
  }
  changed.tick += 5
  const first = changed.world.students[0]
  changed.world.students = [
    ...changed.world.students.slice(1),
    {
      ...first,
      id: 999,
      position: { x: first.position.x + 12.345, y: first.position.y - 4.567 },
    },
  ]
  const frame = createGameSnapshotFrame(
    changed,
    20,
    createReplicatedEntityBaseline(initial),
  )
  if (frame.world.kind !== 'hub') throw new Error('expected Hub frame')
  assert.deepEqual(frame.world.entities.retired, [[REPLICATED_ENTITY_TYPES.student, first.id]])
  assert.equal(frame.world.entities.spawned.length, 1)

  const reconstructor = new EntityReplicationReconstructor()
  reconstructor.reset(initial, 20)
  const reconstructed = reconstructor.apply(frame, 21)
  if (reconstructed.world.kind !== 'hub') throw new Error('expected Hub reconstruction')
  assert.equal(reconstructed.world.students.some((student) => student.id === first.id), false)
  const spawned = reconstructed.world.students.find((student) => student.id === 999)
  assert.ok(spawned)
  assert.equal(spawned.scale, first.scale)
  assert.deepEqual(spawned.props, first.props)
  assert.ok(Math.abs(spawned.position.x - (first.position.x + 12.345)) <= 1 / 32)
  assert.ok(Math.abs(spawned.position.y - (first.position.y - 4.567)) <= 1 / 32)
})

test('periodic keyframes recover descriptors while invalid deltas fail closed', () => {
  const snapshot = hubSnapshot(8)
  const keyframe = createGameSnapshotFrame(snapshot, 0, undefined, true)
  if (keyframe.world.kind !== 'hub') throw new Error('expected Hub keyframe')
  assert.equal(keyframe.world.entities.keyframe, true)
  assert.equal(keyframe.world.entities.spawned.length, 8)

  const reconstructor = new EntityReplicationReconstructor()
  reconstructor.reset(snapshot, 1)
  const recovered = reconstructor.apply(keyframe, 2)
  assert.equal(recovered.tick, snapshot.tick)
  assert.equal(recovered.hostPlayerId, snapshot.hostPlayerId)
  assert.deepEqual(recovered.players, snapshot.players)
  if (recovered.world.kind !== 'hub' || snapshot.world.kind !== 'hub') {
    throw new Error('expected Hub snapshots')
  }
  assert.deepEqual(recovered.world.ambient, snapshot.world.ambient)
  assert.deepEqual(recovered.world.participants, snapshot.world.participants)
  assert.equal(recovered.world.collisionRngState, snapshot.world.collisionRngState)
  assert.equal(recovered.world.students.length, snapshot.world.students.length)
  for (let index = 0; index < snapshot.world.students.length; index += 1) {
    const expected: ProtocolStudentState = snapshot.world.students[index]
    const actual: ProtocolStudentState = recovered.world.students[index]
    assert.equal(actual.id, expected.id)
    assert.equal(actual.scale, expected.scale)
    assert.equal(actual.reading, expected.reading)
    assert.deepEqual(actual.props, expected.props)
    assert.ok(Math.abs(actual.position.x - expected.position.x) <= 1 / 32)
    assert.ok(Math.abs(actual.position.y - expected.position.y) <= 1 / 32)
    assert.ok(cyclicDistance(actual.heading, expected.heading, 360) <= 1 / 128)
    assert.ok(cyclicDistance(actual.gaitDegrees, expected.gaitDegrees, 360) <= 1 / 128)
    assert.ok(cyclicDistance(actual.framePhase, expected.framePhase, 5) <= 1 / 2048)
  }

  const invalid = cloneSnapshotFrame(keyframe)
  if (invalid.world.kind !== 'hub') throw new Error('expected Hub frame')
  invalid.world.entities = {
    ...invalid.world.entities,
    keyframe: false,
    baselineSequence: 99,
    spawned: [],
  }
  assert.throws(
    () => reconstructor.apply(invalid, 3),
    EntityReplicationGapError,
  )
})

test('Boneyard enemies use compact descriptors and authoritative dynamic samples', () => {
  assert.equal(REPLICATED_ENTITY_TYPE_REGISTRY.has(REPLICATED_ENTITY_TYPES.boneyardEnemy), true)
  const initial = boneyardSnapshot('enemy-run')
  const frame = createGameSnapshotFrame(initial, 0, undefined, true)
  if (frame.world.kind !== 'boneyard') throw new Error('expected Boneyard frame')
  assert.equal(frame.world.entities.keyframe, true)
  assert.equal(frame.world.entities.spawned.length, 1)
  assert.equal(frame.world.entities.spawned[0]!.length, 8)
  assert.equal(frame.world.entities.samples[0]!.length, 62)
  assert.equal(frame.world.entities.spawned[0]![7], 1)
  assert.equal(frame.world.entities.samples[0]![29], 25 * 1024)
  assert.equal(frame.world.entities.samples[0]![30], 50 * 1024)
  assert.equal(frame.world.entities.samples[0]![31], 3)

  const reconstructor = new EntityReplicationReconstructor()
  const reconstructed = reconstructor.apply(frame, 1)
  if (
    reconstructed.world.kind !== 'boneyard'
    || initial.world.kind !== 'boneyard'
  ) throw new Error('expected Boneyard snapshot')
  const enemy = reconstructed.world.enemies[0]!
  assert.equal(enemy.id, 7)
  assert.equal(enemy.enemyToken, 'SKELETON')
  assert.equal(enemy.armored, true)
  assert.deepEqual(enemy.flags, ['FLAG_ARMOR'])
  assert.equal(enemy.shieldHealth, 25)
  assert.equal(enemy.shieldMaximumHealth, 50)
  assert.deepEqual(enemy.animation.effects, enemySnapshot().animation.effects)
  assert.ok(Math.abs(enemy.position.x - 123.45) <= 1 / 16)
  assert.ok(Math.abs(enemy.animation.gaitPose - 2.75) <= 1 / 1024)
  assert.deepEqual(reconstructed.world.enemyEvents, initial.world.enemyEvents)
})

test('Boneyard enemy deltas update, retire, and force a keyframe across run nonces', () => {
  const initial = boneyardSnapshot('enemy-run-a')
  const baseline = createReplicatedEntityBaseline(initial)
  const changed = cloneSnapshot(initial)
  if (changed.world.kind !== 'boneyard') throw new Error('expected Boneyard snapshot')
  changed.tick += 5
  changed.world.enemies = [{
    ...changed.world.enemies[0]!,
    animation: {
      ...changed.world.enemies[0]!.animation,
      action: 'skeleton-claw-a',
      actionProgress: 4.25,
      state: 'action',
    },
    currentHealth: 2,
    position: { x: 130.125, y: 450.5 },
  }]
  const delta = createGameSnapshotFrame(changed, 10, baseline)
  if (delta.world.kind !== 'boneyard') throw new Error('expected Boneyard frame')
  assert.equal(delta.world.entities.keyframe, false)
  assert.deepEqual(delta.world.entities.spawned, [])

  const reconstructor = new EntityReplicationReconstructor()
  reconstructor.reset(initial, 10)
  const reconstructed = reconstructor.apply(delta, 11)
  if (reconstructed.world.kind !== 'boneyard') throw new Error('expected Boneyard snapshot')
  assert.equal(reconstructed.world.enemies[0]!.currentHealth, 2)
  assert.equal(reconstructed.world.enemies[0]!.animation.action, 'skeleton-claw-a')
  assert.equal(reconstructed.world.enemies[0]!.animation.actionProgress, 4.25)

  const retired = cloneSnapshot(changed)
  if (retired.world.kind !== 'boneyard') throw new Error('expected Boneyard snapshot')
  retired.world.enemies = []
  const retiredFrame = createGameSnapshotFrame(
    retired,
    11,
    createReplicatedEntityBaseline(changed),
  )
  if (retiredFrame.world.kind !== 'boneyard') throw new Error('expected Boneyard frame')
  assert.deepEqual(retiredFrame.world.entities.retired, [[REPLICATED_ENTITY_TYPES.boneyardEnemy, 7]])

  const nextRun = cloneSnapshot(initial)
  if (nextRun.world.kind !== 'boneyard') throw new Error('expected Boneyard snapshot')
  nextRun.run = { ...nextRun.run, runId: 'enemy-run-b' }
  nextRun.world.runId = 'enemy-run-b'
  nextRun.world.enemyEvents = []
  const resetFrame = createGameSnapshotFrame(nextRun, 11, baseline)
  if (resetFrame.world.kind !== 'boneyard') throw new Error('expected Boneyard frame')
  assert.equal(resetFrame.world.entities.keyframe, true)
  assert.equal(resetFrame.world.entities.baselineSequence, 0)
  assert.equal(resetFrame.world.entities.spawned.length, 1)
})

test('Boneyard enemy codec rejects family/type mismatches and malformed samples', () => {
  const registration = REPLICATED_ENTITY_TYPE_REGISTRY.get(
    REPLICATED_ENTITY_TYPES.boneyardEnemy,
  )!
  const snapshot = boneyardSnapshot('invalid-enemy')
  const frame = createGameSnapshotFrame(snapshot, 0, undefined, true)
  if (frame.world.kind !== 'boneyard') throw new Error('expected Boneyard frame')
  const descriptor = frame.world.entities.spawned[0]!
  const sample = frame.world.entities.samples[0]!
  const invalidDescriptor: ReplicatedEntityDescriptor = [
    ...descriptor.slice(0, 3),
    1004,
    ...descriptor.slice(4),
  ] as [number, number, ...number[]]
  const truncatedSample = sample.slice(0, -1) as [number, number, ...number[]]
  const mismatchedAction: ReplicatedEntitySample = [
    ...sample.slice(0, 6),
    2,
    0,
    ...sample.slice(8),
  ] as [number, number, ...number[]]
  const duplicateEffectRole: ReplicatedEntitySample = [
    ...sample.slice(0, 42),
    sample[32]!,
    ...sample.slice(43),
  ] as [number, number, ...number[]]
  assert.equal(registration.descriptorIsValid(invalidDescriptor), false)
  assert.equal(registration.sampleIsValid(truncatedSample), false)
  assert.equal(registration.sampleIsValid(mismatchedAction), false)
  assert.equal(registration.sampleIsValid(duplicateEffectRole), false)
})

test('Boneyard enemy projectiles replicate motion and exact spawn-retire identity', () => {
  const initial = boneyardSnapshot('projectile-run')
  if (initial.world.kind !== 'boneyard') throw new Error('expected Boneyard snapshot')
  initial.world.enemyProjectiles = [enemyProjectileSnapshot()]
  const keyframe = createGameSnapshotFrame(initial, 0, undefined, true)
  if (keyframe.world.kind !== 'boneyard') throw new Error('expected Boneyard frame')
  assert.equal(keyframe.world.entities.spawned.length, 2)
  assert.equal(keyframe.world.entities.samples.length, 2)
  const descriptor = keyframe.world.entities.spawned.find((entry) => (
    entry[0] === REPLICATED_ENTITY_TYPES.boneyardEnemyProjectile
  ))!
  assert.equal(descriptor.length, 10)
  assert.equal(descriptor[9], 3)

  const reconstructor = new EntityReplicationReconstructor()
  const reconstructed = reconstructor.apply(keyframe, 1)
  if (reconstructed.world.kind !== 'boneyard') throw new Error('expected Boneyard snapshot')
  assert.deepEqual(reconstructed.world.enemyProjectiles[0], enemyProjectileSnapshot())
  assert.equal(reconstructed.world.enemyProjectiles[0]!.payload, 'normal')

  const retired = cloneSnapshot(initial)
  if (retired.world.kind !== 'boneyard') throw new Error('expected Boneyard snapshot')
  retired.world.enemyProjectiles = []
  const delta = createGameSnapshotFrame(
    retired,
    1,
    createReplicatedEntityBaseline(initial),
  )
  if (delta.world.kind !== 'boneyard') throw new Error('expected Boneyard frame')
  assert.deepEqual(delta.world.entities.retired, [[
    REPLICATED_ENTITY_TYPES.boneyardEnemyProjectile,
    4,
  ]])
})

test('Coffin Maggots replicate as independently retiring combat actors', () => {
  const initial = boneyardSnapshot('maggot-run')
  if (initial.world.kind !== 'boneyard') throw new Error('expected Boneyard snapshot')
  initial.world.maggots = [maggotSnapshot()]
  const keyframe = createGameSnapshotFrame(initial, 0, undefined, true)
  if (keyframe.world.kind !== 'boneyard') throw new Error('expected Boneyard frame')
  assert.ok(keyframe.world.entities.spawned.some((entry) => (
    entry[0] === REPLICATED_ENTITY_TYPES.boneyardMaggot && entry[1] === 8
  )))
  const sample = keyframe.world.entities.samples.find((entry) => (
    entry[0] === REPLICATED_ENTITY_TYPES.boneyardMaggot && entry[1] === 8
  ))!
  const descriptor = keyframe.world.entities.spawned.find((entry) => (
    entry[0] === REPLICATED_ENTITY_TYPES.boneyardMaggot && entry[1] === 8
  ))!
  assert.equal(descriptor.length, 6)
  assert.equal(descriptor[5], 1)
  assert.equal(sample.length, 14)
  assert.equal(sample[9], 768)
  assert.equal(sample[12], 12)
  assert.equal(sample[13], -20 * 1024)
  const registration = REPLICATED_ENTITY_TYPE_REGISTRY.get(
    REPLICATED_ENTITY_TYPES.boneyardMaggot,
  )!
  assert.equal(registration.sampleIsValid(sample), true)
  assert.equal(registration.sampleIsValid(
    sample.slice(0, -1) as [number, number, ...number[]],
  ), false)
  const invalidHitFlash: ReplicatedEntitySample = [
    ...sample.slice(0, 9),
    1025,
    ...sample.slice(10),
  ] as [number, number, ...number[]]
  const invalidEmergenceState: ReplicatedEntitySample = [
    ...sample.slice(0, 6),
    1,
    ...sample.slice(7),
  ] as [number, number, ...number[]]
  const invalidVerticalOffset: ReplicatedEntitySample = [
    sample[0]!,
    sample[1]!,
    ...sample.slice(2, 13),
    1,
  ]
  assert.equal(registration.sampleIsValid(invalidHitFlash), false)
  assert.equal(registration.sampleIsValid(invalidEmergenceState), false)
  assert.equal(registration.sampleIsValid(invalidVerticalOffset), false)

  const reconstructor = new EntityReplicationReconstructor()
  const reconstructed = reconstructor.apply(keyframe, 1)
  if (reconstructed.world.kind !== 'boneyard') throw new Error('expected Boneyard snapshot')
  assert.deepEqual(reconstructed.world.maggots, [maggotSnapshot()])

  const retired = cloneSnapshot(initial)
  if (retired.world.kind !== 'boneyard') throw new Error('expected Boneyard snapshot')
  retired.world.maggots = []
  const delta = createGameSnapshotFrame(
    retired,
    1,
    createReplicatedEntityBaseline(initial),
  )
  if (delta.world.kind !== 'boneyard') throw new Error('expected Boneyard frame')
  assert.ok(delta.world.entities.retired.some(([typeId, id]) => (
    typeId === REPLICATED_ENTITY_TYPES.boneyardMaggot && id === 8
  )))
})

test('enemy death effects replicate independent motion and exact retirement identity', () => {
  assert.equal(
    REPLICATED_ENTITY_TYPE_REGISTRY.has(
      REPLICATED_ENTITY_TYPES.boneyardEnemyDeathEffect,
    ),
    true,
  )
  const initial = boneyardSnapshot('death-effect-run')
  if (initial.world.kind !== 'boneyard') throw new Error('expected Boneyard snapshot')
  initial.world.deathEffects = [enemyDeathEffectSnapshot()]
  const keyframe = createGameSnapshotFrame(initial, 0, undefined, true)
  if (keyframe.world.kind !== 'boneyard') throw new Error('expected Boneyard frame')
  const descriptor = keyframe.world.entities.spawned.find((entry) => (
    entry[0] === REPLICATED_ENTITY_TYPES.boneyardEnemyDeathEffect
  ))!
  const sample = keyframe.world.entities.samples.find((entry) => (
    entry[0] === REPLICATED_ENTITY_TYPES.boneyardEnemyDeathEffect
  ))!
  assert.equal(descriptor.length, 8)
  assert.equal(sample.length, 11)

  const registration = REPLICATED_ENTITY_TYPE_REGISTRY.get(
    REPLICATED_ENTITY_TYPES.boneyardEnemyDeathEffect,
  )!
  assert.equal(registration.descriptorIsValid(descriptor), true)
  assert.equal(registration.sampleIsValid(sample), true)
  assert.equal(registration.sampleIsValid(
    sample.slice(0, -1) as [number, number, ...number[]],
  ), false)

  const reconstructor = new EntityReplicationReconstructor()
  const reconstructed = reconstructor.apply(keyframe, 1)
  if (reconstructed.world.kind !== 'boneyard') {
    throw new Error('expected Boneyard snapshot')
  }
  const effect = reconstructed.world.deathEffects[0]!
  const expected = enemyDeathEffectSnapshot()
  assert.deepEqual(
    {
      ...effect,
      alpha: expected.alpha,
      height: expected.height,
      position: expected.position,
      rotationRadians: expected.rotationRadians,
      scale: expected.scale,
    },
    expected,
  )
  assert.ok(Math.abs(effect.position.x - expected.position.x) <= 1 / 16)
  assert.ok(Math.abs(effect.position.y - expected.position.y) <= 1 / 16)
  assert.ok(Math.abs(effect.height - expected.height) <= 1 / 16)

  const retired = cloneSnapshot(initial)
  if (retired.world.kind !== 'boneyard') throw new Error('expected Boneyard snapshot')
  retired.world.deathEffects = []
  const delta = createGameSnapshotFrame(
    retired,
    1,
    createReplicatedEntityBaseline(initial),
  )
  if (delta.world.kind !== 'boneyard') throw new Error('expected Boneyard frame')
  assert.ok(delta.world.entities.retired.some(([typeId, id]) => (
    typeId === REPLICATED_ENTITY_TYPES.boneyardEnemyDeathEffect && id === expected.id
  )))
})

function cloneSnapshot(snapshot: GameSnapshot): GameSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as GameSnapshot
}

function cloneSnapshotFrame(
  frame: ReturnType<typeof createGameSnapshotFrame>,
): ReturnType<typeof createGameSnapshotFrame> {
  return JSON.parse(JSON.stringify(frame)) as ReturnType<typeof createGameSnapshotFrame>
}

function cyclicDistance(first: number, second: number, period: number): number {
  const difference = Math.abs(first - second) % period
  return Math.min(difference, period - difference)
}

function enemySnapshot(): BoneyardEnemySnapshot {
  return {
    animation: {
      action: null,
      actionProgress: 0,
      alpha: 1,
      bodyPose: 2,
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
        alpha: 0.75,
        atlas: 'DeadHawg',
        blendMode: 'normal',
        entry: 52,
        id: 29,
        offset: { x: 0.5, y: -1 },
        role: 'burning-fire',
        rotationRadians: 0.25,
        scale: 1.25,
      }, {
        alpha: 0.5,
        atlas: 'BadGuys',
        blendMode: 'add',
        entry: 381,
        id: 30,
        offset: { x: 0, y: 0 },
        role: 'mage-lightning-source',
        rotationRadians: 0,
        scale: 1,
      }, {
        alpha: 0.5,
        atlas: 'BadGuys',
        blendMode: 'add',
        entry: 382,
        id: 31,
        offset: { x: 12, y: -4 },
        role: 'mage-lightning-target',
        rotationRadians: 0,
        scale: 1,
      }],
      gaitPose: 2.75,
      hitFlash: 0.5,
      impEffectFrame: -1,
      maggots: [],
      state: 'locomotion',
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
    id: 7,
    maximumHealth: 5,
    nativeTypeId: 1001,
    position: { x: 123.45, y: 456.75 },
    shieldHealth: 25,
    shieldMaximumHealth: 50,
    spawnTick: 12,
  }
}

function enemyProjectileSnapshot(): BoneyardEnemyProjectileSnapshot {
  return {
    ageTicks: 3,
    contactRadius: 8,
    headingDeg: 90,
    homing: false,
    id: 4,
    kind: 'arrow',
    lifetimeTicks: 300,
    nativeTypeId: 0x7da,
    ownerActorId: 7,
    payload: 'normal',
    position: { x: 128, y: 456.75 },
    spawnTick: 12,
  }
}

function enemyDeathEffectSnapshot(): BoneyardEnemyDeathEffectSnapshot {
  return {
    ageTicks: 7,
    alpha: 0.75,
    atlas: 'BadGuys',
    blendMode: 'normal',
    entry: 117,
    height: -4.25,
    id: 9,
    kind: 'bouncer',
    ownerActorId: 7,
    position: { x: 133.5, y: 463.25 },
    rotationRadians: 0.5,
    scale: 1.2,
    shadow: true,
    spawnTick: 20,
    tint: 0xffaa88,
  }
}

function maggotSnapshot(): BoneyardMaggotSnapshot {
  return {
    alpha: 1,
    currentHealth: 2,
    deathEpoch: 0,
    deathTick: 0,
    headingDeg: 180,
    hitFlash: 0.75,
    id: 8,
    emergenceTick: 12,
    launchTrajectory: 'lid',
    maximumHealth: 2,
    ownerCoffinActorId: 7,
    pose: 0.5,
    position: { x: 130, y: 460 },
    spawnTick: 20,
    state: 'emerging',
    verticalOffset: -20,
  }
}

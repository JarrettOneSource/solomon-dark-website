import assert from 'node:assert/strict'
import test from 'node:test'

import { createHubStudentFixturePopulation } from '../core-server/hub-student-fixtures.ts'
import { createGameSimulation } from '../core-server/game-simulation.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import type { GameSnapshot, ProtocolStudentState } from './game-state.ts'
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

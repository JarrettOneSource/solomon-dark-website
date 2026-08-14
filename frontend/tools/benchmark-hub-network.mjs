import { performance } from 'node:perf_hooks'
import { deflateRawSync } from 'node:zlib'

import { createHubStudentFixturePopulation } from '../src/game/core-server/hub-student-fixtures.ts'
import {
  createGameSimulation,
  stepGameSimulationTick,
} from '../src/game/core-server/game-simulation.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import {
  createGameSnapshotFrame,
  createReplicatedEntityBaseline,
} from '../src/game/protocol/entity-replication.ts'
import { encodeGameMessage } from '../src/game/protocol/game-protocol.ts'

const clientCount = positiveInteger(process.env.SDR_HUB_NETWORK_CLIENTS ?? '1', 'SDR_HUB_NETWORK_CLIENTS')
const counts = integerList(process.env.SDR_HUB_BENCH_COUNTS ?? '16,32,64,128,256')
const encodeIterations = positiveInteger(
  process.env.SDR_HUB_NETWORK_ENCODE_ITERATIONS ?? '500',
  'SDR_HUB_NETWORK_ENCODE_ITERATIONS',
)
const keyframeSeconds = positiveInteger(
  process.env.SDR_HUB_NETWORK_KEYFRAME_SECONDS ?? '5',
  'SDR_HUB_NETWORK_KEYFRAME_SECONDS',
)
const snapshotRate = positiveInteger(process.env.SDR_HUB_NETWORK_HZ ?? '20', 'SDR_HUB_NETWORK_HZ')
const results = counts.map(measurePopulation)

process.stdout.write(`${JSON.stringify({
  clientCount,
  encodeIterations,
  keyframeSeconds,
  node: process.version,
  protocol: 'json-static-descriptors-quantized-samples',
  results,
  snapshotRate,
}, null, 2)}\n`)

function measurePopulation(studentCount) {
  let simulation = createGameSimulation({}, {
    hubStudentPopulation: createHubStudentFixturePopulation({
      count: studentCount,
      seed: 0x12345678,
    }),
  })
  const initialSnapshot = createGameSnapshot(simulation, null)
  const baseline = createReplicatedEntityBaseline(initialSnapshot)
  for (let tick = 0; tick < 5; tick += 1) {
    simulation = stepGameSimulationTick(simulation, {})
  }
  const snapshot = createGameSnapshot(simulation, null)
  if (snapshot.world.kind !== 'hub' || simulation.world.kind !== 'hub') {
    throw new Error('Hub network benchmark left the Hub world')
  }
  const legacySnapshot = {
    ...snapshot,
    world: {
      ...snapshot.world,
      students: simulation.world.studentPopulation.students,
    },
  }
  const legacyPayload = JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    snapshot: legacySnapshot,
  })
  const presentationPayload = JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    snapshot,
  })
  const keyframe = createGameSnapshotFrame(snapshot, 0, undefined, true)
  const delta = createGameSnapshotFrame(snapshot, 1, baseline)
  if (keyframe.world.kind !== 'hub' || delta.world.kind !== 'hub') {
    throw new Error('Hub network benchmark produced a non-Hub frame')
  }
  const keyframeMessage = {
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: keyframe,
    sequence: 2,
  }
  const deltaMessage = {
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: delta,
    sequence: 2,
  }
  const keyframePayload = encodeGameMessage(keyframeMessage)
  const deltaPayload = encodeGameMessage(deltaMessage)
  const legacyPayloadBytes = Buffer.byteLength(legacyPayload)
  const presentationPayloadBytes = Buffer.byteLength(presentationPayload)
  const keyframePayloadBytes = Buffer.byteLength(keyframePayload)
  const deltaPayloadBytes = Buffer.byteLength(deltaPayload)
  const snapshotsPerKeyframe = snapshotRate * keyframeSeconds
  const averagePayloadBytes = (
    deltaPayloadBytes * (snapshotsPerKeyframe - 1) + keyframePayloadBytes
  ) / snapshotsPerKeyframe
  const entityJsonBytes = Buffer.byteLength(JSON.stringify(delta.world.entities))
  const entityBinaryBytes = encodeEntityFrameBinary(delta.world.entities).byteLength
  const binaryEntityLaneEstimateBytes = deltaPayloadBytes - entityJsonBytes + entityBinaryBytes
  const deflatedDeltaBytes = deflateRawSync(deltaPayload).byteLength
  const perClientKiBPerSecond = averagePayloadBytes * snapshotRate / 1024

  return {
    aggregateKiBPerSecond: perClientKiBPerSecond * clientCount,
    averagePayloadBytes,
    binaryEntityLaneEstimateBytes,
    binaryEntityLaneEstimatedReductionPercent: reductionPercent(
      deltaPayloadBytes,
      binaryEntityLaneEstimateBytes,
    ),
    deflatedDeltaBytes,
    deflateMicroseconds: benchmarkMicroseconds(
      () => deflateRawSync(deltaPayload),
      encodeIterations,
    ),
    deflatedDeltaReductionPercent: reductionPercent(deltaPayloadBytes, deflatedDeltaBytes),
    deltaEncodeMicroseconds: benchmarkMicroseconds(
      () => encodeGameMessage(deltaMessage),
      encodeIterations,
    ),
    deltaPayloadBytes,
    entityBinaryBytes,
    entityBinaryEncodeMicroseconds: benchmarkMicroseconds(
      () => encodeEntityFrameBinary(delta.world.entities),
      encodeIterations,
    ),
    entityJsonBytes,
    keyframePayloadBytes,
    legacyPayloadBytes,
    perClientKiBPerSecond,
    presentationPayloadBytes,
    reductionVersusLegacyPercent: reductionPercent(legacyPayloadBytes, averagePayloadBytes),
    reductionVersusPresentationPercent: reductionPercent(
      presentationPayloadBytes,
      averagePayloadBytes,
    ),
    studentCount,
  }
}

function encodeEntityFrameBinary(entities) {
  const byteLength = 18
    + entities.retired.length * 6
    + entities.samples.reduce((total, sample) => total + sampleByteLength(sample), 0)
    + entities.spawned.reduce((total, descriptor) => total + descriptorByteLength(descriptor), 0)
  const buffer = Buffer.allocUnsafe(byteLength)
  let offset = 0
  buffer.writeUInt8(1, offset)
  offset += 1
  buffer.writeUInt8(Number(entities.keyframe), offset)
  offset += 1
  buffer.writeUInt32LE(entities.baselineSequence, offset)
  offset += 4
  buffer.writeUInt32LE(entities.retired.length, offset)
  offset += 4
  buffer.writeUInt32LE(entities.samples.length, offset)
  offset += 4
  buffer.writeUInt32LE(entities.spawned.length, offset)
  offset += 4
  for (const key of entities.retired) {
    buffer.writeUInt16LE(key[0], offset)
    buffer.writeUInt32LE(key[1], offset + 2)
    offset += 6
  }
  for (const sample of entities.samples) {
    if (sample[0] !== 1 || sample.length !== 7) throw new Error('unsupported sample shape')
    buffer.writeUInt16LE(sample[0], offset)
    buffer.writeUInt32LE(sample[1], offset + 2)
    buffer.writeInt32LE(sample[2], offset + 6)
    buffer.writeInt32LE(sample[3], offset + 10)
    buffer.writeUInt16LE(sample[4], offset + 14)
    buffer.writeUInt16LE(sample[5], offset + 16)
    buffer.writeUInt16LE(sample[6], offset + 18)
    offset += 20
  }
  for (const descriptor of entities.spawned) {
    if (descriptor[0] !== 1 || descriptor.length < 5) {
      throw new Error('unsupported descriptor shape')
    }
    const propCount = descriptor[4]
    buffer.writeUInt16LE(descriptor[0], offset)
    buffer.writeUInt32LE(descriptor[1], offset + 2)
    buffer.writeFloatLE(descriptor[2], offset + 6)
    buffer.writeUInt8(descriptor[3], offset + 10)
    buffer.writeUInt8(propCount, offset + 11)
    offset += 12
    for (let index = 0; index < propCount; index += 1) {
      const source = 5 + index * 3
      buffer.writeFloatLE(descriptor[source], offset)
      buffer.writeUInt8(descriptor[source + 1], offset + 4)
      buffer.writeFloatLE(descriptor[source + 2], offset + 5)
      offset += 9
    }
  }
  if (offset !== byteLength) throw new Error('binary entity frame length mismatch')
  return buffer
}

function sampleByteLength(sample) {
  if (sample[0] !== 1 || sample.length !== 7) throw new Error('unsupported sample shape')
  return 20
}

function descriptorByteLength(descriptor) {
  if (descriptor[0] !== 1 || descriptor.length < 5) {
    throw new Error('unsupported descriptor shape')
  }
  return 12 + descriptor[4] * 9
}

function benchmarkMicroseconds(operation, iterations) {
  let receipt = 0
  for (let index = 0; index < 20; index += 1) receipt += operation().length
  const startedAt = performance.now()
  for (let index = 0; index < iterations; index += 1) receipt += operation().length
  const elapsedMs = performance.now() - startedAt
  if (receipt === 0) throw new Error('network encoder produced an empty receipt')
  return elapsedMs * 1000 / iterations
}

function reductionPercent(baseline, candidate) {
  return (1 - candidate / baseline) * 100
}

function integerList(value) {
  const values = value.split(',').map((entry) => positiveInteger(entry.trim(), 'SDR_HUB_BENCH_COUNTS'))
  if (values.length === 0) throw new Error('SDR_HUB_BENCH_COUNTS must not be empty')
  return values
}

function positiveInteger(value, name) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`)
  return parsed
}

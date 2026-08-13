import assert from 'node:assert/strict'
import test from 'node:test'

import { createGameSimulation } from '../core-server/game-simulation.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import type {
  ProtocolPlayerState,
  ProtocolStudentState,
} from '../protocol/game-state.ts'
import {
  createHubPresentationTimeline,
  isHubGameSnapshot,
  lerpCycle,
  type HubGameSnapshot,
} from './hub-presentation-timeline.ts'

const SERVER_TICK_RATE = 100
const SNAPSHOT_RATE = 20
const INTERVAL_MS = 50
const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

function playerAt(x: number, headingIndex = 0): ProtocolPlayerState {
  return {
    config: { ...CHARACTER },
    footstepTick: 0,
    gaitDegrees: x,
    headingIndex,
    position: { x, y: 200 },
    velocity: { x: 100, y: 0 },
    walkCyclePrimary: x / 10 % 5,
  }
}

function snapshotAt(tick: number, localX: number, remoteX: number): HubGameSnapshot {
  const source = createGameSnapshot(createGameSimulation({}), null)
  if (!isHubGameSnapshot(source)) throw new Error('expected Hub fixture')
  return {
    ...source,
    players: {
      local: playerAt(localX),
      remote: playerAt(remoteX),
    },
    tick,
    world: { ...source.world, students: [] },
  }
}

function timeline(initial: HubGameSnapshot, initialReceivedAtMs = 0) {
  return createHubPresentationTimeline({
    initialReceivedAtMs,
    initialSnapshot: initial,
    localPlayerId: 'local',
    serverTickRate: SERVER_TICK_RATE,
    snapshotRate: SNAPSHOT_RATE,
  })
}

test('returns an owned presentation copy until a second authoritative snapshot exists', () => {
  const initial = snapshotAt(100, 10, 20)
  const presentation = timeline(initial).sample(5_000)
  assert.deepEqual(presentation, initial)
  assert.notEqual(presentation, initial)
  assert.notEqual(presentation.players.local, initial.players.local)
  assert.notEqual(presentation.world, initial.world)
  assert.notEqual(presentation.world.ambient, initial.world.ambient)
})

test('interpolates remote state over one network interval while keeping local prediction immediate', () => {
  const first = snapshotAt(100, 10, 20)
  const second = snapshotAt(105, 15, 30)
  const presentation = timeline(first)
  presentation.push(second, INTERVAL_MS)

  const atArrival = presentation.sample(INTERVAL_MS)
  assert.equal(atArrival.tick, 100)
  assert.equal(atArrival.players.remote.position.x, 20)
  assert.equal(atArrival.players.local.position.x, 15)

  const halfway = presentation.sample(75)
  assert.equal(halfway.tick, 102.5)
  assert.equal(halfway.players.remote.position.x, 25)
  assert.equal(halfway.players.local.position.x, 15)

  const caughtUp = presentation.sample(100)
  assert.equal(caughtUp.tick, 105)
  assert.equal(caughtUp.players.remote.position.x, 30)
})

test('uses authoritative ticks rather than packet arrival spacing when receipts jitter', () => {
  const presentation = timeline(snapshotAt(200, 0, 0), 100)
  presentation.push(snapshotAt(205, 5, 50), 167)
  presentation.push(snapshotAt(210, 10, 100), 301)

  assert.equal(presentation.sample(301).players.remote.position.x, 50)
  assert.equal(presentation.sample(326).players.remote.position.x, 75)
  assert.equal(presentation.sample(351).players.remote.position.x, 100)
  assert.equal(presentation.sample(900).players.remote.position.x, 100)
})

test('takes the shortest path through cyclic headings, gait, walk poses, and ambient tracks', () => {
  assert.equal(lerpCycle(359, 1, 0.5, 360), 0)
  assert.equal(lerpCycle(23, 1, 0.5, 24), 0)
  assert.equal(lerpCycle(4.8, 0.2, 0.5, 5), 0)

  const firstBase = snapshotAt(0, 0, 0)
  const secondBase = snapshotAt(5, 0, 0)
  const first: HubGameSnapshot = {
    ...firstBase,
    players: {
      ...firstBase.players,
      remote: {
        ...firstBase.players.remote,
        gaitDegrees: 359,
        headingIndex: 23,
        walkCyclePrimary: 4.8,
      },
    },
    world: {
      ...firstBase.world,
      ambient: {
        ...firstBase.world.ambient,
        markerPhaseDegrees: 359,
        sealCorePhase: 2.8,
        sealGlyphPhase: 2.9,
        statuePhaseDegrees: 359,
      },
    },
  }
  const second: HubGameSnapshot = {
    ...secondBase,
    players: {
      ...secondBase.players,
      remote: {
        ...secondBase.players.remote,
        gaitDegrees: 1,
        headingIndex: 1,
        walkCyclePrimary: 0.2,
      },
    },
    world: {
      ...secondBase.world,
      ambient: {
        ...secondBase.world.ambient,
        markerPhaseDegrees: 1,
        sealCorePhase: 0.2,
        sealGlyphPhase: 0.1,
        statuePhaseDegrees: 1,
      },
    },
  }

  const presentation = timeline(first)
  presentation.push(second, 50)
  const frame = presentation.sample(75)
  assert.equal(frame.players.remote.gaitDegrees, 0)
  assert.equal(frame.players.remote.headingIndex, 0)
  assert.ok(frame.players.remote.walkCyclePrimary < 1e-9)
  assert.equal(frame.world.ambient.markerPhaseDegrees, 0)
  assert.ok(frame.world.ambient.sealCorePhase < 1e-9)
  assert.ok(frame.world.ambient.sealGlyphPhase < 1e-9)
  assert.equal(frame.world.ambient.statuePhaseDegrees, 0)
})

test('interpolates matching Students and fountain particles without popping lifecycle changes early', () => {
  const nativeSource = createGameSnapshot(createGameSimulation({}), null)
  if (!isHubGameSnapshot(nativeSource)) throw new Error('expected Hub fixture')
  const nativeStudent = nativeSource.world.students[0]
  const movedStudent: ProtocolStudentState = {
    ...nativeStudent,
    framePhase: (nativeStudent.framePhase + 1) % 5,
    heading: (nativeStudent.heading + 10) % 360,
    position: { x: nativeStudent.position.x + 50, y: nativeStudent.position.y + 20 },
  }
  const arrivingStudent = { ...movedStudent, id: 9_999 }
  const firstBase = snapshotAt(10, 0, 0)
  const secondBase = snapshotAt(15, 0, 0)
  const first: HubGameSnapshot = {
    ...firstBase,
    world: {
      ...firstBase.world,
      ambient: {
        ...firstBase.world.ambient,
        fountainParticles: [{ id: 1, remaining: 1, scale: 0.1 }],
      },
      students: [nativeStudent],
    },
  }
  const second: HubGameSnapshot = {
    ...secondBase,
    world: {
      ...secondBase.world,
      ambient: {
        ...secondBase.world.ambient,
        fountainParticles: [
          { id: 1, remaining: 0.5, scale: 0.2 },
          { id: 2, remaining: 1, scale: 0.1 },
        ],
      },
      students: [movedStudent, arrivingStudent],
    },
  }

  const presentation = timeline(first)
  presentation.push(second, 50)
  const halfway = presentation.sample(75)
  assert.deepEqual(halfway.world.students.map(({ id }) => id), [nativeStudent.id])
  assert.equal(halfway.world.students[0].position.x, nativeStudent.position.x + 25)
  assert.deepEqual(halfway.world.ambient.fountainParticles.map(({ id }) => id), [1])
  assert.equal(halfway.world.ambient.fountainParticles[0].remaining, 0.75)

  const caughtUp = presentation.sample(100)
  assert.deepEqual(caughtUp.world.students.map(({ id }) => id), [nativeStudent.id, 9_999])
  assert.deepEqual(caughtUp.world.ambient.fountainParticles.map(({ id }) => id), [1, 2])

  const thirdBase = snapshotAt(20, 0, 0)
  const third: HubGameSnapshot = {
    ...thirdBase,
    world: {
      ...thirdBase.world,
      ambient: { ...thirdBase.world.ambient, fountainParticles: [] },
      students: [arrivingStudent],
    },
  }
  presentation.push(third, 100)
  assert.deepEqual(presentation.sample(125).world.students.map(({ id }) => id), [nativeStudent.id, 9_999])
  assert.deepEqual(presentation.sample(150).world.students.map(({ id }) => id), [9_999])
  assert.deepEqual(presentation.sample(150).world.ambient.fountainParticles, [])
})

test('ignores stale snapshots and replaces a duplicate tick atomically', () => {
  const presentation = timeline(snapshotAt(10, 1, 10))
  presentation.push(snapshotAt(9, 2, 20), 10)
  assert.equal(presentation.latest().tick, 10)
  presentation.push(snapshotAt(10, 3, 30), 20)
  assert.equal(presentation.latest().players.local.position.x, 3)
  assert.equal(presentation.sample(20).players.remote.position.x, 30)
})

test('rejects invalid timeline clocks and non-Hub snapshots', () => {
  const initial = snapshotAt(0, 0, 0)
  assert.throws(() => createHubPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: initial,
    localPlayerId: 'local',
    serverTickRate: 0,
    snapshotRate: 20,
  }), /serverTickRate must be positive/)
  assert.throws(() => createHubPresentationTimeline({
    initialReceivedAtMs: 0,
    initialSnapshot: initial,
    localPlayerId: 'local',
    serverTickRate: 100,
    snapshotRate: Number.NaN,
  }), /snapshotRate must be finite/)
})

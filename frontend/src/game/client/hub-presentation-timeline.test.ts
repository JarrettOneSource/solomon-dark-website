import assert from 'node:assert/strict'
import test from 'node:test'

import { createGameSimulation } from '../core-server/game-simulation.ts'
import { createHubParticipantState } from '../core-kernels/hub-regions.ts'
import { createIdlePlayerPrimaryCast } from '../core-kernels/player-character.ts'
import { nativeFireParticleVariant } from '../core-kernels/primary-spell-fire-native.ts'
import type { PrimarySpellSimulationState } from '../core-kernels/primary-spells.ts'
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
import {
  copyPrimarySpellState,
  interpolatePrimarySpellState,
} from './primary-spell-presentation.ts'

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
    primaryCast: createIdlePlayerPrimaryCast(),
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
    world: {
      ...source.world,
      participants: {
        local: createHubParticipantState(),
        remote: createHubParticipantState(),
      },
      students: [],
    },
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

test('interpolates primary spells by stable identity without popping lifecycle edges early', () => {
  const older = {
    nextId: 4,
    projectiles: [
      {
        ageTicks: 1,
        assemblyCharge: Math.fround(0.18),
        charge: 0.2,
        direction: { x: 0, y: -1 },
        flightTicks: 0,
        id: 1,
        kind: 'earth',
        ownerId: 'local',
        phase: 'held',
        position: { x: 10, y: 20 },
        velocity: { x: 0, y: 0 },
        worldKey: 'hub:courtyard',
      },
      {
        ageTicks: 9,
        charge: 1,
        direction: { x: 1, y: 0 },
        flightTicks: 9,
        headingDegrees: 90,
        id: 3,
        kind: 'ether',
        ownerId: 'local',
        phase: 'flight',
        position: { x: 90, y: 20 },
        targetId: null,
        turnAccumulator: 0.01,
        velocity: { x: 3, y: 0 },
        worldKey: 'hub:courtyard',
      },
    ],
    transients: [{
      ageTicks: 2,
      direction: { x: 0, y: -1 },
      id: 2,
      kind: 'fire',
      origin: { x: 40, y: 50 },
      ownerId: 'local',
      variant: nativeFireParticleVariant(2),
      worldKey: 'hub:courtyard',
    }],
  } as const
  const newer = {
    nextId: 5,
    projectiles: [
      {
        ...older.projectiles[0],
        ageTicks: 6,
        assemblyCharge: 0.4,
        charge: 0.4,
        direction: { x: 1, y: 0 },
        flightTicks: 1,
        phase: 'flight',
        position: { x: 20, y: 30 },
        velocity: { x: 3, y: 0 },
      },
      {
        ageTicks: 1,
        charge: 1,
        direction: { x: 0, y: -1 },
        flightTicks: 1,
        id: 4,
        kind: 'fire',
        ownerId: 'local',
        phase: 'flight',
        position: { x: 50, y: 50 },
        velocity: { x: 0, y: -4.5 },
        worldKey: 'hub:courtyard',
      },
    ],
    transients: [{
      ageTicks: 6,
      direction: { x: 1, y: 0 },
      id: 2,
      kind: 'fire',
      origin: { x: 400, y: 500 },
      ownerId: 'local',
      variant: nativeFireParticleVariant(2),
      worldKey: 'hub:courtyard',
    }],
  } as const

  const halfway = interpolatePrimarySpellState(older, newer, 0.5)
  assert.deepEqual(halfway.projectiles.map(({ id }) => id), [1, 3])
  assert.deepEqual(halfway.projectiles[0].position, { x: 15, y: 25 })
  assert.equal(halfway.projectiles[0].charge, 0.30000000000000004)
  assert.equal(halfway.projectiles[0].phase, 'held')
  assert.equal(halfway.projectiles[0].kind, 'earth')
  if (halfway.projectiles[0].kind === 'earth') {
    assert.equal(halfway.projectiles[0].assemblyCharge, Math.fround(0.18))
  }
  assert.equal(halfway.transients[0].ageTicks, 4)
  assert.equal(halfway.transients[0].kind, 'fire')
  if (halfway.transients[0].kind === 'fire') {
    assert.deepEqual(halfway.transients[0].origin, { x: 40, y: 50 })
    assert.deepEqual(halfway.transients[0].direction, { x: 0, y: -1 })
  }
  const caughtUp = interpolatePrimarySpellState(older, newer, 1)
  assert.deepEqual(caughtUp.projectiles.map(({ id }) => id), [1, 4])
  assert.equal(caughtUp.projectiles[0].phase, 'flight')
  assert.equal(caughtUp.projectiles[0].kind, 'earth')
  if (caughtUp.projectiles[0].kind === 'earth') {
    assert.equal(caughtUp.projectiles[0].assemblyCharge, 0.4)
  }
  assert.equal(caughtUp.transients[0].kind, 'fire')
  if (caughtUp.transients[0].kind === 'fire') {
    assert.deepEqual(caughtUp.transients[0].origin, { x: 400, y: 500 })
    assert.deepEqual(caughtUp.transients[0].direction, { x: 1, y: 0 })
  }

  const owned = copyPrimarySpellState(newer)
  assert.deepEqual(owned, newer)
  assert.notEqual(owned.projectiles[0].position, newer.projectiles[0].position)
  assert.equal(owned.transients[0].kind, 'fire')
  if (owned.transients[0].kind === 'fire') {
    assert.notEqual(owned.transients[0].origin, newer.transients[0].origin)
  }
})

test('interpolates Fire impact age while retaining its semantic contact origin', () => {
  const older = {
    nextId: 2,
    projectiles: [],
    transients: [{
      ageTicks: 2,
      id: 1,
      kind: 'fire-impact',
      origin: { x: 100, y: 200 },
      ownerId: 'local',
      worldKey: 'hub:courtyard',
    }],
  } satisfies PrimarySpellSimulationState
  const newer = {
    nextId: 2,
    projectiles: [],
    transients: [{ ...older.transients[0], ageTicks: 7 }],
  } satisfies PrimarySpellSimulationState

  const halfway = interpolatePrimarySpellState(older, newer, 0.5)
  assert.equal(halfway.transients[0].kind, 'fire-impact')
  assert.equal(halfway.transients[0].ageTicks, 4.5)
  assert.deepEqual(halfway.transients[0].origin, { x: 100, y: 200 })
  assert.notEqual(halfway.transients[0].origin, older.transients[0].origin)

  const owned = copyPrimarySpellState(newer)
  assert.deepEqual(owned, newer)
  assert.notEqual(owned.transients[0].origin, newer.transients[0].origin)
})

test('interpolates authoritative called-rock absolute state across sparse snapshots', () => {
  const rock = {
    ageTicks: 2,
    falling: false,
    fallVelocity: 0,
    height: -5,
    id: 2,
    kind: 'earth-called-rock',
    lateralMagnitude: 2.5,
    ownerId: 'local',
    parentId: 1,
    position: { x: 100, y: 200 },
    rotation: 30,
    rotationStep: 5,
    scale: 0.2,
    speed: 0.2,
    targetHeight: -45,
    variant: 1,
    worldKey: 'hub:courtyard',
  } as const
  const older = {
    nextId: 4,
    projectiles: [],
    transients: [rock, { ...rock, id: 3, position: { x: 40, y: 50 } }],
  } satisfies PrimarySpellSimulationState
  const newer = {
    nextId: 5,
    projectiles: [],
    transients: [{
      ...rock,
      ageTicks: 7,
      falling: true,
      fallVelocity: 1,
      height: -12.5,
      position: { x: 112, y: 206 },
      rotation: 55,
      speed: 0.8,
    }, { ...rock, id: 4, position: { x: 300, y: 400 } }],
  } satisfies PrimarySpellSimulationState

  const halfway = interpolatePrimarySpellState(older, newer, 0.5)
  const interpolated = halfway.transients.find(({ id }) => id === 2)
  assert.ok(interpolated?.kind === 'earth-called-rock')
  assert.deepEqual(interpolated.position, { x: 106, y: 203 })
  assert.equal(interpolated.height, -8.75)
  assert.equal(interpolated.falling, false)
  assert.deepEqual(halfway.transients.map(({ id }) => id), [2, 3])

  const caughtUp = interpolatePrimarySpellState(older, newer, 1)
  assert.deepEqual(caughtUp.transients.map(({ id }) => id), [2, 4])
  const owned = copyPrimarySpellState(newer)
  const copied = owned.transients[0]
  assert.ok(copied.kind === 'earth-called-rock')
  assert.notEqual(copied.position, newer.transients[0].position)
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

test('projects the local native fade cadence while interpolating remote participants', () => {
  const firstBase = snapshotAt(100, 10, 20)
  const secondBase = snapshotAt(105, 15, 30)
  const transition = {
    destination: 'library',
    phase: 'outgoing',
    scriptedSpeed: 0.45,
    scriptedTarget: { x: 2057.5, y: 460.5 },
    sourceRegion: 'courtyard',
  } as const
  const first: HubGameSnapshot = {
    ...firstBase,
    world: {
      ...firstBase.world,
      participants: {
        local: { region: 'courtyard', transition: { ...transition, alpha: 0.2 } },
        remote: { region: 'courtyard', transition: { ...transition, alpha: 0.2 } },
      },
    },
  }
  const second: HubGameSnapshot = {
    ...secondBase,
    world: {
      ...secondBase.world,
      participants: {
        local: { region: 'courtyard', transition: { ...transition, alpha: 0.25 } },
        remote: { region: 'courtyard', transition: { ...transition, alpha: 0.25 } },
      },
    },
  }
  const presentation = timeline(first)
  presentation.push(second, INTERVAL_MS)

  const halfway = presentation.sample(75)
  assert.equal(halfway.world.participants.local.transition?.alpha, 0.275)
  assert.equal(halfway.world.participants.remote.transition?.alpha, 0.225)
  assert.equal(halfway.world.participants.local.region, 'courtyard')
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

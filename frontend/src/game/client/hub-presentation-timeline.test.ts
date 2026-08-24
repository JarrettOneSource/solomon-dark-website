import assert from 'node:assert/strict'
import test from 'node:test'

import { createGameSimulation } from '../core-server/game-simulation.ts'
import { createHubParticipantState } from '../core-kernels/hub-regions.ts'
import { createIdlePlayerPrimaryCast } from '../core-kernels/player-character.ts'
import { nativeFireParticleVariant } from '../core-kernels/primary-spell-fire-native.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { createNativeWeldBoulderContactDebrisProgram } from '../core-kernels/native-weld-boulder-debris.ts'
import {
  EARTH_BOULDER_IDENTITY_ORIENTATION,
  earthBoulderHeldOrientationStep,
} from '../core-kernels/primary-spell-earth-orientation.ts'
import {
  createPrimarySpellEarthBoulderBit,
  type PrimarySpellSimulationState,
} from '../core-kernels/primary-spells.ts'
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
const DEFAULT_PLAYER = createGameSnapshot(createGameSimulation(), null)
  .players['local-player']!
const LIGHTING = DEFAULT_PLAYER.lighting
const actorLightRegistration = (registrationOrdinal: number) => ({
  managerLane: 'actor' as const,
  registrationOrdinal,
})
const TRANSIENT_LIGHT_REGISTRATION = {
  managerLane: 'transient',
  registrationOrdinal: 2,
} as const
const primarySpellTime = (targetTick: number) => ({
  newerTick: 105,
  olderTick: 100,
  targetTick,
})

function playerAt(x: number, headingIndex = 0): ProtocolPlayerState {
  return {
    config: { ...CHARACTER },
    economy: DEFAULT_PLAYER.economy,
    footstepTick: 0,
    gaitDegrees: x,
    headingIndex,
    lighting: LIGHTING,
    movementScale: DEFAULT_PLAYER.movementScale,
    position: { x, y: 200 },
    primaryCast: createIdlePlayerPrimaryCast(),
    progression: DEFAULT_PLAYER.progression,
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
        local: { ...createHubParticipantState(), activity: null },
        remote: { ...createHubParticipantState(), activity: null },
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
  assert.notEqual(presentation.players.local.lighting, initial.players.local.lighting)
  assert.notEqual(presentation.world, initial.world)
  assert.notEqual(presentation.world.ambient, initial.world.ambient)
})

test('interpolates the shared player effect phase while keeping light ownership discrete in Hub', () => {
  const older = snapshotAt(100, 10, 20)
  const newer = snapshotAt(105, 20, 30)
  older.players.remote.lighting = {
    ...LIGHTING,
    driveActive: false,
    overlayEffectPhase: 0.135,
  }
  newer.players.remote.lighting = {
    ...LIGHTING,
    driveActive: true,
    lightRegistration: actorLightRegistration(9),
    overlayEffectPhase: 0.225,
  }
  const presentation = timeline(older)
  presentation.push(newer, 50)
  assert.deepEqual(presentation.sample(75).players.remote.lighting, {
    ...older.players.remote.lighting,
    overlayEffectPhase: 0.18,
  })
  assert.deepEqual(presentation.sample(100).players.remote.lighting, newer.players.remote.lighting)
  assert.notEqual(
    presentation.sample(100).players.remote.lighting.lightRegistration,
    newer.players.remote.lighting.lightRegistration,
  )
})

test('keeps the held one-shot attack pose discrete across Hub presentation samples', () => {
  const older = snapshotAt(100, 10, 20)
  const newer = snapshotAt(105, 20, 30)
  newer.players.remote.primaryCast = {
    ...newer.players.remote.primaryCast,
    actionTick: 0,
    castSequence: 2,
    emissionSequence: 1,
    held: true,
    oneShotAttackPoseHeld: true,
    selectedPrimaryId: 8,
  }
  const presentation = timeline(older)
  presentation.push(newer, 50)

  assert.equal(presentation.sample(75).players.remote.primaryCast.oneShotAttackPoseHeld, false)
  assert.equal(presentation.sample(100).players.remote.primaryCast.oneShotAttackPoseHeld, true)
  assert.notEqual(
    presentation.sample(100).players.remote.primaryCast,
    newer.players.remote.primaryCast,
  )
})

test('interpolates primary spells by stable identity without popping lifecycle edges early', () => {
  const older = {
    nextId: 4,
    projectiles: [
      {
        ageTicks: 1,
        assemblyCharge: Math.fround(0.18),
        charge: 0.2,
        damage: 10,
        direction: { x: 0, y: -1 },
        flightTicks: 0,
        hitTargetIds: [],
        id: 1,
        kind: 'earth',
        lightRegistration: actorLightRegistration(0),
        maximumCharge: 1,
        orientation: EARTH_BOULDER_IDENTITY_ORIENTATION,
        ownerId: 'local',
        phase: 'held',
        position: { x: 10, y: 20 },
        remainingDamage: 10,
        shellCharge: Math.fround(0.18),
        toughness: 1,
        velocity: { x: 0, y: 0 },
        worldKey: 'hub:courtyard',
      },
      {
        ageTicks: 9,
        charge: 1,
        damage: 2,
        damageRetention: 1,
        direction: { x: 1, y: 0 },
        flightTicks: 9,
        headingDegrees: 90,
        id: 3,
        kind: 'ether',
        lightRegistration: actorLightRegistration(1),
        ownerId: 'local',
        phase: 'flight',
        piercesRemaining: 0,
        position: { x: 90, y: 20 },
        reacquiresTarget: false,
        speed: 3,
        targetId: null,
        turnInput: 2,
        turnAccumulator: 0.01,
        underpowered: false,
        velocity: { x: 3, y: 0 },
        visualScale: 1,
        worldKey: 'hub:courtyard',
      },
    ],
    transients: [{
      ageTicks: 2,
      direction: { x: 0, y: -1 },
      id: 2,
      kind: 'fire',
      lightRegistration: null,
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
        hitTargetIds: ['enemy:7'],
        orientation: earthBoulderHeldOrientationStep(
          EARTH_BOULDER_IDENTITY_ORIENTATION,
          { x: 1, y: 0 },
        ),
        phase: 'flight',
        position: { x: 20, y: 30 },
        shellCharge: 0.4,
        velocity: { x: 3, y: 0 },
      },
      {
        ageTicks: 1,
        burnDamage: 0,
        charge: 1,
        damage: 4,
        direction: { x: 0, y: -1 },
        emberDamage: 0,
        emberFragments: 0,
        explodeDamage: 0,
        explodeRadius: 0,
        flightTicks: 1,
        id: 4,
        kind: 'fire',
        lightRegistration: actorLightRegistration(2),
        ownerId: 'local',
        phase: 'flight',
        position: { x: 50, y: 50 },
        privateSeed: 0,
        spentEmber: { kind: 'none' },
        underpowered: false,
        velocity: { x: 0, y: -4.5 },
        worldKey: 'hub:courtyard',
      },
    ],
    transients: [{
      ageTicks: 7,
      direction: { x: 1, y: 0 },
      id: 2,
      kind: 'fire',
      lightRegistration: null,
      origin: { x: 400, y: 500 },
      ownerId: 'local',
      variant: nativeFireParticleVariant(2),
      worldKey: 'hub:courtyard',
    }],
  } as const

  const halfway = interpolatePrimarySpellState(
    older,
    newer,
    0.5,
    primarySpellTime(102.5),
  )
  assert.deepEqual(halfway.projectiles.map(({ id }) => id), [1, 3])
  assert.deepEqual(halfway.projectiles[0].position, { x: 15, y: 25 })
  assert.equal(halfway.projectiles[0].charge, 0.30000000000000004)
  assert.equal(halfway.projectiles[0].phase, 'held')
  assert.equal(halfway.projectiles[0].kind, 'earth')
  assert.deepEqual(halfway.projectiles[0].lightRegistration, actorLightRegistration(0))
  assert.notEqual(
    halfway.projectiles[0].lightRegistration,
    older.projectiles[0].lightRegistration,
  )
  if (halfway.projectiles[0].kind === 'earth') {
    assert.equal(halfway.projectiles[0].assemblyCharge, Math.fround(0.18))
    assert.deepEqual(halfway.projectiles[0].hitTargetIds, [])
    assert.deepEqual(halfway.projectiles[0].orientation, EARTH_BOULDER_IDENTITY_ORIENTATION)
  }
  assert.equal(halfway.transients[0].ageTicks, 4.5)
  assert.equal(halfway.transients[0].kind, 'fire')
  if (halfway.transients[0].kind === 'fire') {
    assert.deepEqual(halfway.transients[0].origin, { x: 40, y: 50 })
    assert.deepEqual(halfway.transients[0].direction, { x: 0, y: -1 })
  }
  const caughtUp = interpolatePrimarySpellState(older, newer, 1, primarySpellTime(105))
  assert.deepEqual(caughtUp.projectiles.map(({ id }) => id), [1, 4])
  assert.equal(caughtUp.projectiles[0].phase, 'flight')
  assert.equal(caughtUp.projectiles[0].kind, 'earth')
  if (caughtUp.projectiles[0].kind === 'earth') {
    assert.equal(caughtUp.projectiles[0].assemblyCharge, 0.4)
    assert.deepEqual(caughtUp.projectiles[0].hitTargetIds, ['enemy:7'])
    assert.deepEqual(caughtUp.projectiles[0].orientation, newer.projectiles[0].orientation)
  }
  assert.equal(caughtUp.transients[0].kind, 'fire')
  if (caughtUp.transients[0].kind === 'fire') {
    assert.deepEqual(caughtUp.transients[0].origin, { x: 400, y: 500 })
    assert.deepEqual(caughtUp.transients[0].direction, { x: 1, y: 0 })
  }

  const owned = copyPrimarySpellState(newer)
  assert.deepEqual(owned, newer)
  assert.notEqual(owned.projectiles[0].position, newer.projectiles[0].position)
  assert.notEqual(owned.projectiles[0].lightRegistration, newer.projectiles[0].lightRegistration)
  if (owned.projectiles[0].kind === 'earth' && newer.projectiles[0].kind === 'earth') {
    assert.notEqual(owned.projectiles[0].hitTargetIds, newer.projectiles[0].hitTargetIds)
    assert.notEqual(owned.projectiles[0].orientation, newer.projectiles[0].orientation)
  }
  assert.equal(owned.transients[0].kind, 'fire')
  if (owned.transients[0].kind === 'fire') {
    assert.notEqual(owned.transients[0].origin, newer.transients[0].origin)
  }
})

test('interpolates Ember phase forward through the native four-frame wrap', () => {
  const ember = {
    ageTicks: 20,
    burnDamage: 0,
    contactCadence: 2,
    contactDue: false,
    damage: 4,
    height: -8,
    horizontalVelocity: { x: 1, y: 0 },
    id: 1,
    kind: 'fire-ember' as const,
    life: 2.5,
    lightRegistration: { managerLane: 'actor' as const, registrationOrdinal: 4 },
    ownerId: 'local',
    phase: 3.75,
    position: { x: 100, y: 200 },
    spentEmber: { kind: 'none' as const },
    verticalVelocity: -1,
    worldKey: 'hub:courtyard',
  }
  const older = {
    nextId: 2,
    projectiles: [],
    transients: [ember],
  } satisfies PrimarySpellSimulationState
  const newer = {
    nextId: 2,
    projectiles: [],
    transients: [{ ...ember, ageTicks: 25, phase: 1 }],
  } satisfies PrimarySpellSimulationState
  const halfway = interpolatePrimarySpellState(
    older,
    newer,
    0.5,
    primarySpellTime(102.5),
  )
  assert.equal(halfway.transients[0]?.kind, 'fire-ember')
  assert.equal(halfway.transients[0]?.phase, 0.375)
})

test('retains the state-driven Earth BoulderBit through the client presentation seam', () => {
  const program = createNativeWeldBoulderContactDebrisProgram({
    rng: createNativeRng(0x1234_5678),
    scale: 0.5,
  })
  const bit = createPrimarySpellEarthBoulderBit({
    debris: program.debris[0]!,
    enhancedEffects: true,
    id: 7,
    origin: { x: 100, y: 200 },
    ownerId: 'local',
    tick: 100,
    worldKey: 'hub:courtyard',
  })
  const older = {
    nextId: 8,
    projectiles: [],
    transients: [bit],
  } satisfies PrimarySpellSimulationState
  const newerBit = {
    ...bit,
    ageTicks: 5,
    position: { x: 110, y: 220 },
  }
  const newer = {
    nextId: 8,
    projectiles: [],
    transients: [newerBit],
  } satisfies PrimarySpellSimulationState

  const halfway = interpolatePrimarySpellState(
    older,
    newer,
    0.5,
    primarySpellTime(102.5),
  )
  assert.equal(halfway.transients.length, 1)
  assert.equal(halfway.transients[0]!.kind, 'earth-boulder-bit')
  assert.equal(halfway.transients[0]!.ageTicks, 2.5)
  if (halfway.transients[0]!.kind === 'earth-boulder-bit') {
    assert.deepEqual(halfway.transients[0]!.position, { x: 105, y: 210 })
    assert.notEqual(halfway.transients[0]!.debris, bit.debris)
  }

  const retired = interpolatePrimarySpellState(
    newer,
    { ...newer, transients: [] },
    1,
    { newerTick: 110, olderTick: 105, targetTick: 110 },
  )
  assert.deepEqual(retired.transients, [])
})

test('admits retained Air, Water, and Fire births on their owned 100 Hz ticks', () => {
  const air = (birthTick: number) => ({
    ageTicks: 0,
    birthTick,
    direction: { x: 1, y: 0 },
    endpoint: { x: 300, y: 200 },
    hurricaneCharge: 0,
    id: 1_000 + birthTick,
    kind: 'air' as const,
    lightRegistration: {
      managerLane: 'transient' as const,
      registrationOrdinal: 1_000 + birthTick,
    },
    midpoint: { x: 200, y: 200 },
    origin: { x: 100, y: 200 },
    ownerId: 'air-player',
    targetId: null,
    underpowered: false,
    variant: birthTick % 4,
    worldKey: 'hub:courtyard',
  })
  const water = (birthTick: number, variant: number, snapshotTick: number) => ({
    ageTicks: snapshotTick - birthTick + 1,
    direction: { x: 0, y: -1 },
    id: 2_000 + birthTick * 2 + variant,
    kind: 'water' as const,
    lightRegistration: null,
    obstructionDistance: null,
    obstructionPoint: null,
    origin: { x: 100, y: 200 },
    ownerId: 'water-player',
    underpowered: false,
    variant,
    worldKey: 'hub:courtyard',
  })
  const fire = (birthTick: number, snapshotTick: number) => {
    const id = 3_000 + birthTick
    return {
      ageTicks: snapshotTick - birthTick,
      direction: { x: 1, y: 0 },
      id,
      kind: 'fire' as const,
      lightRegistration: null,
      origin: { x: birthTick, y: 200 },
      ownerId: 'fire-player',
      variant: nativeFireParticleVariant(id),
      worldKey: 'hub:courtyard',
    }
  }
  const births = (first: number, last: number) => (
    Array.from({ length: last - first + 1 }, (_, index) => first + index)
  )
  const older = {
    nextId: 4_000,
    projectiles: [],
    transients: [
      ...births(96, 100).map(air).map((effect) => ({
        ...effect,
        ageTicks: 100 - effect.birthTick,
      })),
      ...births(96, 100).flatMap((birthTick) => [
        water(birthTick, 0, 100),
        water(birthTick, 1, 100),
      ]),
      ...births(96, 100).map((birthTick) => fire(birthTick, 100)),
    ],
  } satisfies PrimarySpellSimulationState
  const newer = {
    nextId: 4_100,
    projectiles: [],
    transients: [
      ...births(101, 105).map(air).map((effect) => ({
        ...effect,
        ageTicks: 105 - effect.birthTick,
      })),
      ...births(96, 105).flatMap((birthTick) => [
        water(birthTick, 0, 105),
        water(birthTick, 1, 105),
      ]),
      ...births(96, 105).map((birthTick) => fire(birthTick, 105)),
    ],
  } satisfies PrimarySpellSimulationState

  for (const targetTick of births(100, 105)) {
    const frame = interpolatePrimarySpellState(
      older,
      newer,
      (targetTick - 100) / 5,
      primarySpellTime(targetTick),
    )
    const airEffects = frame.transients.filter((effect) => effect.kind === 'air')
    const waterEffects = frame.transients.filter((effect) => effect.kind === 'water')
    const fireEffects = frame.transients.filter((effect) => effect.kind === 'fire')
    assert.deepEqual(
      airEffects.filter((effect) => effect.ageTicks === 0).map((effect) => effect.birthTick),
      [targetTick],
    )
    assert.deepEqual(
      waterEffects
        .filter((effect) => effect.ageTicks === 1)
        .map((effect) => effect.id),
      [2_000 + targetTick * 2, 2_001 + targetTick * 2],
    )
    assert.deepEqual(
      fireEffects.filter((effect) => effect.ageTicks === 0).map((effect) => effect.id),
      [3_000 + targetTick],
    )
    assert.equal(airEffects.length, 5)
    assert.equal(waterEffects.length, (targetTick - 95) * 2)
    assert.equal(fireEffects.length, targetTick - 95)
  }

  const fractional = interpolatePrimarySpellState(
    older,
    newer,
    0.5,
    primarySpellTime(102.5),
  )
  assert.deepEqual(
    fractional.transients
      .flatMap((effect) => (
        effect.kind === 'air' && effect.ageTicks === 0 ? [effect.birthTick] : []
      )),
    [102],
  )
  assert.deepEqual(
    fractional.transients
      .filter((effect) => effect.kind === 'water' && effect.ageTicks === 1.5)
      .map((effect) => effect.id),
    [2_204, 2_205],
  )
  assert.deepEqual(
    fractional.transients
      .filter((effect) => effect.kind === 'fire' && effect.ageTicks === 0.5)
      .map((effect) => effect.id),
    [3_102],
  )

  const exhausted = {
    ...newer,
    transients: newer.transients.filter((effect) => {
      if (effect.kind === 'air') return effect.birthTick <= 102
      if (effect.kind === 'water') return effect.id <= 2_205
      return effect.id <= 3_102
    }),
  }
  const afterExhaustion = interpolatePrimarySpellState(
    older,
    exhausted,
    0.8,
    primarySpellTime(104),
  ).transients
  assert.equal(afterExhaustion.some((effect) => (
    effect.kind === 'air' && effect.ageTicks === 0
  )), false)
  assert.equal(afterExhaustion.some((effect) => (
    effect.kind === 'water' && effect.ageTicks === 1
  )), false)
  assert.equal(afterExhaustion.some((effect) => (
    effect.kind === 'fire' && effect.ageTicks === 0
  )), false)
})

test('admits and retires every fixed-lifetime impact at its reconstructed tick', () => {
  const older = {
    nextId: 5,
    projectiles: [],
    transients: [{
      ageTicks: 15,
      id: 4,
      kind: 'fire-impact',
      lightRegistration: TRANSIENT_LIGHT_REGISTRATION,
      origin: { x: 40, y: 50 },
      ownerId: 'fire-player',
      worldKey: 'hub:courtyard',
    }],
  } satisfies PrimarySpellSimulationState
  const newer = {
    nextId: 5,
    projectiles: [],
    transients: [
      {
        ageTicks: 3,
        birthTick: 102,
        charge: 1,
        id: 1,
        kind: 'earth-impact',
        lightRegistration: null,
        lifetimeTicks: 10,
        origin: { x: 10, y: 20 },
        ownerId: 'earth-player',
        worldKey: 'hub:courtyard',
      },
      {
        ageTicks: 2,
        birthTick: 103,
        id: 2,
        kind: 'ether-impact',
        lightRegistration: TRANSIENT_LIGHT_REGISTRATION,
        origin: { x: 20, y: 30 },
        ownerId: 'ether-player',
        visualScale: 1,
        worldKey: 'hub:courtyard',
      },
      {
        ageTicks: 1,
        id: 3,
        kind: 'fire-impact',
        lightRegistration: TRANSIENT_LIGHT_REGISTRATION,
        origin: { x: 30, y: 40 },
        ownerId: 'fire-player',
        worldKey: 'hub:courtyard',
      },
    ],
  } satisfies PrimarySpellSimulationState
  const sample = (targetTick: number) => interpolatePrimarySpellState(
    older,
    newer,
    (targetTick - 100) / 5,
    primarySpellTime(targetTick),
  ).transients

  assert.deepEqual(sample(100).map(({ id, ageTicks }) => [id, ageTicks]), [[4, 15]])
  assert.deepEqual(sample(101), [])
  assert.deepEqual(sample(102).map(({ id, ageTicks }) => [id, ageTicks]), [[1, 0]])
  assert.deepEqual(sample(103.5).map(({ id, ageTicks }) => [id, ageTicks]), [
    [1, 1.5],
    [2, 0.5],
  ])
  assert.deepEqual(sample(104).map(({ id, ageTicks }) => [id, ageTicks]), [
    [1, 2],
    [2, 1],
    [3, 0],
  ])
})

test('interpolates Fire impact age while retaining its semantic contact origin', () => {
  const older = {
    nextId: 2,
    projectiles: [],
    transients: [{
      ageTicks: 2,
      id: 1,
      kind: 'fire-impact',
      lightRegistration: TRANSIENT_LIGHT_REGISTRATION,
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

  const halfway = interpolatePrimarySpellState(
    older,
    newer,
    0.5,
    primarySpellTime(102.5),
  )
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
    lightRegistration: null,
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

  const halfway = interpolatePrimarySpellState(
    older,
    newer,
    0.5,
    primarySpellTime(102.5),
  )
  const interpolated = halfway.transients.find(({ id }) => id === 2)
  assert.ok(interpolated?.kind === 'earth-called-rock')
  assert.deepEqual(interpolated.position, { x: 106, y: 203 })
  assert.equal(interpolated.height, -8.75)
  assert.equal(interpolated.falling, false)
  assert.deepEqual(halfway.transients.map(({ id }) => id), [2, 3])

  const caughtUp = interpolatePrimarySpellState(older, newer, 1, primarySpellTime(105))
  assert.deepEqual(caughtUp.transients.map(({ id }) => id), [2, 4])
  const owned = copyPrimarySpellState(newer)
  const copied = owned.transients[0]
  assert.ok(copied.kind === 'earth-called-rock')
  assert.notEqual(copied.position, newer.transients[0].position)
})

test('interpolates Staff action and VFX state while retaining semantic contact arrays discretely', () => {
  const melee = {
    actionTimingFactor: 1,
    ageTicks: 2,
    baseProgressPerTick: 0.1,
    contactSequence: 0,
    headingDegrees: 350,
    id: 1,
    kind: 'player-staff-melee',
    lane: 'primary',
    origin: { x: 100, y: 200 },
    outcome: 'normal',
    ownerId: 'local',
    progress: 2,
    swooshPitch: 1.05,
    worldKey: 'hub:courtyard',
  } as const
  const contact = {
    ageTicks: 2,
    id: 2,
    impactSoundPitches: [0.95],
    kind: 'player-staff-contact',
    origin: { x: 100, y: 180 },
    outcome: 'knockback',
    ownerId: 'local',
    procSound: 'knockback',
    procSoundPitches: [1.02],
    pikeBreakSoundIndexes: [0],
    swooshPitch: 1.05,
    targetIds: ['enemy:1'],
    worldKey: 'hub:courtyard',
  } as const
  const smoke = {
    ageTicks: 2,
    alpha: 0.9,
    alphaLoss: Math.fround(0.05),
    angularVelocityDegrees: 1,
    entry: 15,
    id: 3,
    kind: 'player-staff-smoke',
    ownerId: 'local',
    position: { x: 100, y: 175 },
    rotationDegrees: 350,
    scale: 8,
    worldKey: 'hub:courtyard',
  } as const
  const pikeBreak = {
    ageTicks: 2,
    headingDegrees: 180,
    id: 4,
    kind: 'player-staff-pike-break',
    ownerId: 'local',
    position: { x: 120, y: 175 },
    presentationRng: createNativeRng(44),
    targetId: 'enemy:1',
    worldKey: 'hub:courtyard',
  } as const
  const older = {
    nextId: 5,
    projectiles: [],
    transients: [melee, contact, smoke, pikeBreak],
  } satisfies PrimarySpellSimulationState
  const newer = {
    nextId: 5,
    projectiles: [],
    transients: [{
      ...melee,
      ageTicks: 7,
      headingDegrees: 10,
      origin: { x: 110, y: 210 },
      progress: 4,
    }, {
      ...contact,
      ageTicks: 7,
      origin: { x: 110, y: 190 },
    }, {
      ...smoke,
      ageTicks: 7,
      alpha: 0.65,
      position: { x: 110, y: 185 },
      rotationDegrees: 10,
    }, {
      ...pikeBreak,
      ageTicks: 7,
    }],
  } satisfies PrimarySpellSimulationState
  const halfway = interpolatePrimarySpellState(
    older,
    newer,
    0.5,
    primarySpellTime(102.5),
  )
  const action = halfway.transients[0]
  assert.ok(action.kind === 'player-staff-melee')
  assert.equal(action.progress, 3)
  assert.equal(action.headingDegrees, 360)
  assert.deepEqual(action.origin, { x: 105, y: 205 })
  const event = halfway.transients[1]
  assert.ok(event.kind === 'player-staff-contact')
  assert.deepEqual(event.origin, { x: 105, y: 185 })
  assert.notEqual(event.targetIds, contact.targetIds)
  assert.notEqual(event.procSoundPitches, contact.procSoundPitches)
  assert.notEqual(event.impactSoundPitches, contact.impactSoundPitches)
  assert.notEqual(event.pikeBreakSoundIndexes, contact.pikeBreakSoundIndexes)
  const effect = halfway.transients[2]
  assert.ok(effect.kind === 'player-staff-smoke')
  assert.equal(effect.alpha, 0.775)
  assert.equal(effect.rotationDegrees, 360)
  const pike = halfway.transients[3]
  assert.ok(pike.kind === 'player-staff-pike-break')
  assert.equal(pike.ageTicks, 4.5)
  assert.notEqual(pike.presentationRng, pikeBreak.presentationRng)
  assert.notEqual(pike.presentationRng.words, pikeBreak.presentationRng.words)

  const owned = copyPrimarySpellState(newer)
  assert.deepEqual(owned, newer)
  assert.notEqual(owned.transients[0], newer.transients[0])
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
        local: { activity: null, region: 'courtyard', transition: { ...transition, alpha: 0.2 } },
        remote: { activity: null, region: 'courtyard', transition: { ...transition, alpha: 0.2 } },
      },
    },
  }
  const second: HubGameSnapshot = {
    ...secondBase,
    world: {
      ...secondBase.world,
      participants: {
        local: { activity: 'occupied', region: 'courtyard', transition: { ...transition, alpha: 0.25 } },
        remote: { activity: 'paused', region: 'courtyard', transition: { ...transition, alpha: 0.25 } },
      },
    },
  }
  const presentation = timeline(first)
  presentation.push(second, INTERVAL_MS)

  const halfway = presentation.sample(75)
  assert.equal(halfway.world.participants.local.transition?.alpha, 0.275)
  assert.equal(halfway.world.participants.remote.transition?.alpha, 0.225)
  assert.equal(halfway.world.participants.local.region, 'courtyard')
  assert.equal(halfway.world.participants.local.activity, 'occupied')
  assert.equal(halfway.world.participants.remote.activity, null)
  assert.equal(presentation.sample(100).world.participants.remote.activity, 'paused')
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

test('does not replay the previous Hub interval when a frozen tick is replaced', () => {
  const presentation = timeline(snapshotAt(100, 10, 20))
  presentation.push(snapshotAt(105, 20, 30), 50)
  assert.equal(presentation.sample(100).players.remote.position.x, 30)

  presentation.push(snapshotAt(105, 20, 30), 100)
  assert.equal(presentation.sample(100).players.remote.position.x, 30)
  assert.equal(presentation.sample(125).players.remote.position.x, 30)

  presentation.push(snapshotAt(105, 20, 31), 150)
  assert.equal(presentation.latest().players.remote.position.x, 31)
  assert.equal(presentation.sample(150).players.remote.position.x, 31)
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

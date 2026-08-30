import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  PrimarySpellChannelEmission,
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import {
  createNativeWaterHailActor,
  stepNativeWaterHailActor,
} from '../core-kernels/air-water-spell-actors.ts'
import {
  createNativeHurricanePresentation,
  stepNativeHurricanePresentation,
} from '../core-kernels/native-hurricane.ts'
import {
  createNativeRng,
  drawNativeInteger,
} from '../core-kernels/native-rng.ts'
import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'
import { waterFrostJetKind } from '../core-kernels/primary-spell-water.ts'
import {
  finalizeAirWaterPlayerVisualActors,
  synchronizeAirWaterPlayerVisualActors,
} from './air-water-player-visual-system.ts'

test('Hurricane is one player-owned ECS actor that follows charge, position, and teardown', () => {
  const empty: PrimarySpellSimulationState = { nextId: 4, projectiles: [], transients: [] }
  const initialRng = createNativeRng(29)
  const expectedBorn = createNativeHurricanePresentation(initialRng)
  const born = synchronizeAirWaterPlayerVisualActors(empty, [{
    hurricaneContactCharge: 0,
    hurricaneCharge: 0.25,
    hurricaneDamageMaximum: 20,
    hurricaneDamageMinimum: 10,
    ownerId: 'air',
    position: { x: 10, y: 20 },
    worldKey: 'boneyard:1',
  }], 30, initialRng)
  assert.equal(born.spells.nextId, 5)
  assert.deepEqual(born.rng, expectedBorn.rng)
  assert.deepEqual(born.spells.transients, [{
    ageTicks: 0,
    birthTick: 30,
    charge: 0.25,
    contactCharge: 0,
    damageMaximum: 20,
    damageMinimum: 10,
    enhancedEffects: true,
    id: 4,
    kind: 'air-hurricane',
    lanes: expectedBorn.program.lanes,
    ownerId: 'air',
    painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: 4 }],
    phaseDegrees: 0,
    position: { x: 10, y: 20 },
    worldKey: 'boneyard:1',
  }])

  const expectedMoved = stepNativeHurricanePresentation(
    expectedBorn.program,
    0.25,
    expectedBorn.rng,
  )
  const moved = synchronizeAirWaterPlayerVisualActors(born.spells, [{
    hurricaneContactCharge: 0.25,
    hurricaneCharge: 0.5,
    hurricaneDamageMaximum: 30,
    hurricaneDamageMinimum: 15,
    ownerId: 'air',
    position: { x: 30, y: 40 },
    worldKey: 'boneyard:1',
  }], 31, born.rng)
  assert.equal(moved.spells.nextId, 5)
  assert.deepEqual(moved.rng, expectedMoved.rng)
  assert.deepEqual(moved.spells.transients[0], {
    ...born.spells.transients[0],
    ageTicks: 1,
    charge: 0.5,
    contactCharge: 0.25,
    damageMaximum: 30,
    damageMinimum: 15,
    lanes: expectedMoved.program.lanes,
    phaseDegrees: expectedMoved.program.phaseDegrees,
    position: { x: 30, y: 40 },
  })

  const released = synchronizeAirWaterPlayerVisualActors(moved.spells, [{
    hurricaneContactCharge: 0,
    hurricaneCharge: 0,
    hurricaneDamageMaximum: 30,
    hurricaneDamageMinimum: 15,
    ownerId: 'air',
    position: { x: 30, y: 40 },
    worldKey: 'boneyard:1',
  }], 32, moved.rng)
  assert.equal(released.spells.transients.length, 0)
})

test('Air/Water player visual synchronization rejects ambiguous owner rows', () => {
  const source: PrimarySpellSimulationState = { nextId: 1, projectiles: [], transients: [] }
  const owner = {
    hurricaneContactCharge: 0,
    hurricaneCharge: 0,
    hurricaneDamageMaximum: 0,
    hurricaneDamageMinimum: 0,
    ownerId: 'air',
    position: { x: 0, y: 0 },
    worldKey: 'hub:courtyard',
  }
  const rng = createNativeRng(0)
  assert.throws(
    () => synchronizeAirWaterPlayerVisualActors(source, [owner, owner], 0, rng),
    /duplicated/,
  )
  assert.throws(
    () => synchronizeAirWaterPlayerVisualActors(
      source,
      [{ ...owner, hurricaneCharge: 2 }],
      0,
      rng,
    ),
    /within \[0,1\]/,
  )
})

test('Cold Aura follows its live owner instead of retaining its birth point', () => {
  const source: PrimarySpellSimulationState = {
    nextId: 5,
    projectiles: [],
    transients: [{
      ageTicks: 10,
      alphaDecay: Math.fround(0.15 / 720),
      birthTick: 1,
      durationTicks: 2_400,
      id: 4,
      initialRotationDegrees: 90,
      kind: 'water-aura',
      origin: { x: 10, y: 20 },
      ownerId: 'water',
      rotationStepDegrees: 0.5,
      worldKey: 'hub:courtyard',
    }],
  }
  const result = synchronizeAirWaterPlayerVisualActors(source, [{
    hurricaneContactCharge: 0,
    hurricaneCharge: 0,
    hurricaneDamageMaximum: 0,
    hurricaneDamageMinimum: 0,
    ownerId: 'water',
    position: { x: 30, y: 40 },
    worldKey: 'hub:courtyard',
  }], 12, createNativeRng(0))
  const aura = result.spells.transients[0]
  assert.ok(aura?.kind === 'water-aura')
  assert.deepEqual(aura.origin, { x: 30, y: 40 })
})

test('Hub and Boneyard share Normal-only Hail allocation from the Staff emitter', () => {
  const emission = waterEmission({
    hailThreshold: 3_000,
    origin: { x: 300, y: 400 },
    widenHalfDegrees: 75,
  })
  const frost = Array.from({ length: 10 }, (_, variant): PrimarySpellTransientState => ({
    ageTicks: 7,
    direction: { x: 1, y: 0 },
    id: emission.id + variant,
    kind: 'water',
    lightRegistration: null,
    obstructionDistance: null,
    obstructionPoint: null,
    origin: { x: -200, y: -300 },
    ownerId: emission.ownerId,
    speed: 10,
    underpowered: false,
    variant,
    worldKey: emission.worldKey,
  }))
  const source: PrimarySpellSimulationState = {
    nextId: 100,
    projectiles: [],
    transients: frost,
  }
  const initialRng = createNativeRng(0)
  const painterOrder = createNativeWorldManagerOrder()
  let expectedRng = initialRng
  let expectedId = source.nextId
  const expectedHail: PrimarySpellTransientState[] = []
  for (const child of frost) {
    if (child.kind !== 'water' || waterFrostJetKind(child.id) !== 'normal') continue
    const gate = drawNativeInteger(expectedRng, 250)
    expectedRng = gate.state
    const hail = createNativeWaterHailActor(
      expectedId,
      emission.ownerId,
      emission.worldKey,
      1,
      emission.origin,
      child.direction,
      expectedRng,
    )
    expectedRng = hail.rng
    expectedId += 1
    expectedHail.push({
      ...hail.actor,
      painterRegistrations: [{
        managerLane: 'actor',
        registrationOrdinal: expectedHail.length,
      }],
    })
  }

  const result = synchronizeAirWaterPlayerVisualActors(
    source,
    [visualOwner('water', emission.worldKey, emission.queryOrigin)],
    1,
    initialRng,
    [emission],
    painterOrder.register,
  )
  assert.deepEqual(
    result.spells.transients.filter(({ kind }) => kind === 'water-hail'),
    expectedHail,
  )
  assert.deepEqual(result.rng, expectedRng)
  assert.equal(
    painterOrder.state().nextRegistrationOrdinal.actor,
    expectedHail.length,
  )
})

test('shared Water finalization creates Aura after contact and advances Hail in Hub', () => {
  const emission = waterEmission({ auraRadius: 720 })
  const painterOrder = createNativeWorldManagerOrder()
  const hailBirth = createNativeWaterHailActor(
    1,
    emission.ownerId,
    emission.worldKey,
    5,
    emission.origin,
    { x: 1, y: 0 },
    createNativeRng(3),
  )
  const registeredHail = {
    ...hailBirth.actor,
    painterRegistrations: [painterOrder.register('actor')],
  }
  const expectedHail = stepNativeWaterHailActor(registeredHail, hailBirth.rng)
  const result = finalizeAirWaterPlayerVisualActors({
    nextId: 2,
    projectiles: [],
    transients: [registeredHail],
  }, [emission], 6, hailBirth.rng, painterOrder.register)
  const aura = result.spells.transients.find(({ kind }) => kind === 'water-aura')
  assert.ok(aura?.kind === 'water-aura')
  assert.equal(aura.alphaDecay, Math.fround(0.15 / 720))
  assert.equal(aura.durationTicks, 2_400)
  assert.deepEqual(aura.origin, emission.queryOrigin)
  assert.deepEqual(aura.painterRegistrations, [{
    managerLane: 'actor',
    registrationOrdinal: 1,
  }])
  assert.deepEqual(
    result.spells.transients.find(({ kind }) => kind === 'water-hail'),
    expectedHail.actor,
  )
})

function visualOwner(
  ownerId: string,
  worldKey: string,
  position: Readonly<{ x: number; y: number }>,
) {
  return {
    hurricaneContactCharge: 0,
    hurricaneCharge: 0,
    hurricaneDamageMaximum: 0,
    hurricaneDamageMinimum: 0,
    ownerId,
    position,
    worldKey,
  }
}

function waterEmission(overrides: Readonly<{
  auraRadius?: number
  hailThreshold?: number
  origin?: Readonly<{ x: number; y: number }>
  widenHalfDegrees?: number
}> = {}): PrimarySpellChannelEmission {
  const widenHalfDegrees = overrides.widenHalfDegrees ?? 0
  return {
    damage: 0.025,
    direction: { x: 1, y: 0 },
    endpoint: null,
    id: 11,
    kind: 'water',
    manaCost: 0.125,
    origin: { ...(overrides.origin ?? { x: 30, y: 40 }) },
    ownerId: 'water',
    primarySkill: {
      armorMaximum: 0,
      armorPerSecond: 0,
      auraMovementFactor: 0.5,
      auraRadius: overrides.auraRadius ?? 0,
      auraSlowFactor: 0.5,
      coldDurationTicks: 25,
      coldMovementFactor: 0.5,
      damageMaximum: 2.5,
      damageMinimum: 2.5,
      damageRollCount: 1,
      hailChance: 0,
      hailDamageMaximum: 0,
      hailDamageMinimum: 0,
      hailThreshold: overrides.hailThreshold ?? 0,
      halfAngleDegrees: 15 + widenHalfDegrees * 0.5,
      kind: 'water',
      manaCost: 12.5,
      minimumColdDurationTicks: 0,
      pushbackFactor: 0,
      rank: 1,
      reach: 205 + 4 * widenHalfDegrees,
      skillId: 32,
      slowdownScale: 1,
      widenHalfDegrees,
    },
    queryOrigin: { x: 50, y: 60 },
    terrainContact: false,
    underpowered: false,
    worldKey: 'hub:courtyard',
  }
}

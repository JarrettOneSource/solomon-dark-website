import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  PrimarySpellChannelEmission,
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import { stepPrimarySpells } from '../core-kernels/primary-spells.ts'
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
import { nativePrimarySkillProfile } from '../core-kernels/native-primary-skill-profile.ts'
import { createPlayerSkillBook, playerStatBook } from '../core-kernels/player-progression.ts'
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
      alphaDecay: 0.006250000558793545,
      birthTick: 1,
      durationTicks: 81,
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
  assert.equal(synchronizeAirWaterPlayerVisualActors(
    source, [], 12, createNativeRng(0),
  ).spells.transients.length, 0)
  assert.equal(synchronizeAirWaterPlayerVisualActors(source, [{
    hurricaneContactCharge: 0, hurricaneCharge: 0,
    hurricaneDamageMaximum: 0, hurricaneDamageMinimum: 0,
    ownerId: 'water', position: { x: 30, y: 40 }, worldKey: 'boneyard:other',
  }], 12, createNativeRng(0)).spells.transients.length, 0)
})

test('Cold Aura births only on paid six-tick Water emissions in both scenes', () => {
  const initial = createNativeRng(43)
  for (const worldKey of ['hub:courtyard', 'boneyard:run']) {
    for (const auraRadiusScale of [0, 1]) {
      for (const underpowered of [false, true]) {
        for (let tick = 0; tick <= 12; tick += 1) {
          const emission = { ...waterEmission({ auraRadiusScale }), worldKey, underpowered }
          const result = finalizeAirWaterPlayerVisualActors(
            { nextId: 1, projectiles: [], transients: [] }, [emission], tick,
            initial, createNativeWorldManagerOrder().register,
          )
          const active = auraRadiusScale > 0 && !underpowered && tick % 6 === 0
          assert.equal(result.spells.transients.length, active ? 1 : 0)
          assert.equal(result.spells.nextId, active ? 2 : 1)
          assert.equal(result.rng.indexA, (initial.indexA + (active ? 3 : 0)) % 55)
        }
      }
    }
  }
  const released = finalizeAirWaterPlayerVisualActors(
    { nextId: 1, projectiles: [], transients: [] }, [], 6,
    initial, createNativeWorldManagerOrder().register,
  )
  assert.deepEqual(released.rng, initial)
  assert.deepEqual(released.spells.transients, [])
})

test('maximum-rank Cold Aura reaches its native 23-actor population and drains after release', () => {
  const emission = waterEmission({ auraRadiusScale: Math.fround(12 / 7) })
  const order = createNativeWorldManagerOrder()
  let rng = createNativeRng(43)
  let spells: PrimarySpellSimulationState = { nextId: 1, projectiles: [], transients: [] }
  let peak = 0
  let releaseRng = rng
  for (let tick = 0; tick <= 738; tick += 1) {
    const step = stepPrimarySpells({
      spells, rng, tick, castAuthority: {}, inputs: {}, players: {}, previousPlayers: {},
      viewScale: 1, registerWorldPainter: order.register,
      canPlaceProjectile: () => true, canTraverseProjectile: () => true,
      spellObstructionPoint: () => null, spellRangeEndpoint: (_owner, start) => start,
      spellTargets: () => [], worldKeyForPlayer: () => emission.worldKey,
    })
    const finalized = finalizeAirWaterPlayerVisualActors(
      step.spells, tick <= 600 ? [emission] : [], tick, step.rng, order.register,
    )
    spells = finalized.spells
    rng = finalized.rng
    peak = Math.max(peak, spells.transients.length)
    assert.ok(spells.transients.every(actor => actor.kind === 'water-aura' && actor.ageTicks < 138))
    if (tick === 600) releaseRng = rng
    if (tick === 737) assert.equal(spells.transients.length, 1)
  }
  assert.equal(peak, 23)
  assert.deepEqual(spells.transients, [])
  assert.deepEqual(rng, releaseRng)
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
    expectedHail.push({
      ...hail.actor,
      painterRegistrations: [{
        managerLane: 'actor',
        registrationOrdinal: expectedHail.length,
      }],
    })
    expectedId += 1
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

test('every authored Hail rank keeps the exact visual threshold and conditional RNG in both worlds', () => {
  const chances = [0, 5, 8, 10, 12, 14, 16, 18, 20, 22, 25]
  const baseBook = createPlayerSkillBook({ discipline: 'arcane', displayName: 'Hail', element: 'water' })
  for (const [rank, chance] of chances.entries()) {
    const effectiveRanks = [...baseBook.effectiveRanks]
    effectiveRanks[38] = rank
    const profile = nativePrimarySkillProfile({ ...baseBook, effectiveRanks }, playerStatBook(), { damage: 1, manaCost: 1 })
    assert.ok(profile.kind === 'water')
    for (const worldKey of ['hub:college', 'boneyard:run']) {
      for (const mode of ['normal', 'over', 'underpowered'] as const) {
        const id = Array.from({ length: 20 }, (_, i) => i + 1)
          .find(id => waterFrostJetKind(id) === (mode === 'over' ? 'over' : 'normal'))!
        for (const roll of [Math.max(0, chance - 1), chance, 249]) {
          const emission = { ...waterEmission(), id, worldKey, primarySkill: profile, underpowered: mode === 'underpowered' }
          const frost: PrimarySpellTransientState = {
            ageTicks: 0, direction: { x: 1, y: 0 }, id, kind: 'water',
            lightRegistration: null, obstructionDistance: null, obstructionPoint: null,
            origin: emission.origin, ownerId: emission.ownerId, speed: 4,
            underpowered: emission.underpowered, variant: 0, worldKey,
          }
          const words = new Array<number>(55).fill(0)
          words[0] = roll * 64
          const rng = { indexA: 0, indexB: 31, words }
          const rolls = chance > 0 && mode === 'normal'
          const succeeds = rolls && roll < chance
          let expectedRng = rolls ? drawNativeInteger(rng, 250).state : rng
          const expected = succeeds
            ? createNativeWaterHailActor(100, emission.ownerId, worldKey, 1, emission.origin, frost.direction, expectedRng)
            : null
          if (expected) expectedRng = expected.rng
          const result = synchronizeAirWaterPlayerVisualActors({ nextId: 100, projectiles: [], transients: [frost] },
            [visualOwner(emission.ownerId, worldKey, emission.queryOrigin)], 1, rng, [emission])
          const hail = result.spells.transients.filter(actor => actor.kind === 'water-hail')
          assert.equal(hail.length, succeeds ? 1 : 0, `${worldKey}/${mode}/rank ${rank}/roll ${roll}`)
          if (expected) {
            const { painterRegistrations, ...actor } = hail[0]!
            assert.ok(painterRegistrations)
            assert.deepEqual(actor, expected.actor)
          }
          assert.deepEqual(result.rng, expectedRng)
          assert.equal(result.spells.nextId, succeeds ? 101 : 100)
        }
      }
    }
  }
})

test('shared Water finalization creates Aura after contact and advances Hail in Hub', () => {
  const emission = waterEmission({ auraRadiusScale: 1 })
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
  assert.equal(aura.alphaDecay, 0.006250000558793545)
  assert.equal(aura.durationTicks, 81)
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
  auraRadiusScale?: number
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
      auraRadiusScale: overrides.auraRadiusScale ?? 0,
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

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createIdlePlayerCharacterInput,
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
  type PlayerCharacterState,
  type WizardElement,
} from './player-character.ts'
import {
  createPlayerSkillBook,
  playerStatBook,
} from './player-progression.ts'
import {
  nativePrimarySkillProfile,
  type NativePrimarySkillProfile,
} from './native-primary-skill-profile.ts'
import {
  advanceNativeRngWords,
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import {
  createPrimarySpellSimulation,
  PRIMARY_CAST_EMISSION_TICK,
  PRIMARY_CAST_ETHER_ACTION_END_TICK,
  PRIMARY_CAST_ETHER_EMISSION_TICK,
  PRIMARY_SPELL_EARTH_CHARGE_STEP,
  PRIMARY_SPELL_EARTH_FIRST_TICK_CHARGE,
  PRIMARY_SPELL_EARTH_INITIAL_CHARGE,
  PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE,
  PRIMARY_SPELL_ETHER_UNDERPOWERED_SPEED,
  PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS,
  PRIMARY_SPELL_FIRE_IMPACT_LIFETIME_TICKS,
  PRIMARY_SPELL_RANK_ONE_MANA_COSTS,
  primaryCastActionEndTick,
  primaryCastEmissionTick,
  primaryCastPose,
  primarySpellAimDirection,
  primarySpellEmitterOffset,
  removePrimarySpellOwner,
  stepPrimarySpells,
  type PrimarySpellChannelEmission,
  type PrimarySpellSimulationState,
} from './primary-spells.ts'
import { earthImpactLifetimeTicks } from './primary-spell-earth.ts'
import {
  advanceNativeEarthBoulderCharge,
  nativeEarthBoulderReleasedDamage,
} from './native-earth-boulder.ts'
import {
  EARTH_BOULDER_IDENTITY_ORIENTATION,
  earthBoulderFlightOrientationStep,
  earthBoulderHeldOrientationStep,
} from './primary-spell-earth-orientation.ts'
import {
  nativeFireParticleLifetimeTicks,
  nativeFireParticleVariant,
} from './primary-spell-fire-native.ts'
import {
  ETHER_PRIMARY_INITIAL_TURN,
  ETHER_PRIMARY_TURN_FAST_STEP,
  type PrimarySpellTarget,
} from './primary-spell-targeting.ts'
import {
  createGameSimulation,
  getPlayerCharacter,
  stepGameSimulationTick,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'
import { playerCharacterRecords } from '../core-server/player-entity-store.ts'
import { createNativeWeldMeteor } from './native-weld-primary-runtime.ts'
import { createNativeEtherBlastParticleProgram } from './native-ether-blast.ts'

const PLAYER_ID = 'caster'
const ACTOR_LIGHT_REGISTRATION = {
  managerLane: 'actor' as const,
  registrationOrdinal: 0,
}
const TRANSIENT_LIGHT_REGISTRATION = {
  managerLane: 'transient' as const,
  registrationOrdinal: 0,
}
const EMPTY_SPELL_WORLD = {
  canTraverseProjectile: () => true,
  castAuthority: {
    [PLAYER_ID]: { availableMana: 1_000_000, eligible: true },
  },
  rng: createNativeRng(0),
  spellObstructionPoint: () => null,
  spellRangeEndpoint: (
    _ownerId: string,
    start: { x: number; y: number },
    direction: { x: number; y: number },
  ) => ({ x: start.x + direction.x * 2_000, y: start.y + direction.y * 2_000 }),
  spellTargets: () => [],
} as const

function hostileTarget(
  id: string,
  position: { x: number; y: number },
  overrides: Partial<PrimarySpellTarget> = {},
): PrimarySpellTarget {
  return {
    active: true,
    actorFlags: 0x2,
    attachment: { x: 0, y: 0 },
    bodyRadius: 20,
    id,
    kind: 'enemy',
    nativePriority: 0,
    pendingRemove: false,
    position,
    registrationOrder: 1,
    ...overrides,
  }
}

function simulation(element: WizardElement): GameSimulationState {
  const config: PlayerCharacterConfig = {
    discipline: 'arcane',
    displayName: 'Caster',
    element,
  }
  return createGameSimulation({ [PLAYER_ID]: config })
}

function input(state: GameSimulationState, primary: boolean): PlayerCharacterInput {
  const player = getPlayerCharacter(state, PLAYER_ID)
  return {
    ...createIdlePlayerCharacterInput(),
    aim: { x: player.position.x, y: player.position.y - 200 },
    cast: { primary, quickbar: null },
  }
}

function step(
  state: GameSimulationState,
  primary: boolean,
  count = 1,
): GameSimulationState {
  let current = state
  for (let index = 0; index < count; index += 1) {
    current = stepGameSimulationTick(current, { [PLAYER_ID]: input(current, primary) })
  }
  return current
}

function earthChargeAfter(updateCount: number): number {
  let charge = PRIMARY_SPELL_EARTH_INITIAL_CHARGE
  for (let update = 0; update < updateCount; update += 1) {
    charge = Math.min(1, Math.fround(charge + PRIMARY_SPELL_EARTH_CHARGE_STEP))
  }
  return charge
}

interface DirectSpellHarness {
  players: Readonly<Record<string, PlayerCharacterState>>
  primarySkill: NativePrimarySkillProfile
  rng: NativeRngState
  spells: PrimarySpellSimulationState
  tick: number
}

function primarySkillRankStats(
  element: WizardElement,
  rank: number,
): NativePrimarySkillProfile {
  const book = createPlayerSkillBook({
    discipline: 'arcane',
    displayName: 'Caster',
    element,
  })
  const effectiveRanks = [...book.effectiveRanks]
  effectiveRanks[book.primarySkillId] = rank
  return nativePrimarySkillProfile(
    { ...book, effectiveRanks: Object.freeze(effectiveRanks) },
    playerStatBook(),
    { damage: 1, manaCost: 1 },
  )
}

function primarySkillWithRanks(
  element: WizardElement,
  ranks: Readonly<Record<number, number>>,
): NativePrimarySkillProfile {
  const book = createPlayerSkillBook({
    discipline: 'arcane',
    displayName: 'Caster',
    element,
  })
  const effectiveRanks = [...book.effectiveRanks]
  for (const [skillId, rank] of Object.entries(ranks)) {
    effectiveRanks[Number(skillId)] = rank
  }
  return nativePrimarySkillProfile(
    { ...book, effectiveRanks: Object.freeze(effectiveRanks) },
    playerStatBook(),
    { damage: 1, manaCost: 1 },
  )
}

function directSpellHarness(element: WizardElement, rank = 1): DirectSpellHarness {
  const state = simulation(element)
  return {
    players: { [PLAYER_ID]: getPlayerCharacter(state, PLAYER_ID) },
    primarySkill: primarySkillRankStats(element, rank),
    rng: createNativeRng(0),
    spells: createPrimarySpellSimulation(),
    tick: 0,
  }
}

function stepSpellKernel(
  state: DirectSpellHarness,
  primary: boolean,
  availableMana: number,
  eligible = true,
  canPlaceProjectile: () => boolean = () => true,
  primarySkill: NativePrimarySkillProfile = state.primarySkill,
): {
  channelEmissions: readonly PrimarySpellChannelEmission[]
  manaSpent: number
  state: DirectSpellHarness
} {
  const player = state.players[PLAYER_ID]!
  const result = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile,
    castAuthority: {
      [PLAYER_ID]: {
        alive: true,
        availableMana,
        castProgressFactor: 1,
        eligible,
        planeActive: false,
        primarySkill,
      },
    },
    inputs: {
      [PLAYER_ID]: {
        ...createIdlePlayerCharacterInput(),
        aim: { x: player.position.x, y: player.position.y - 200 },
        cast: { primary, quickbar: null },
      },
    },
    players: state.players,
    previousPlayers: state.players,
    rng: state.rng,
    spells: state.spells,
    tick: state.tick + 1,
    viewScale: 1.35,
    worldKeyForPlayer: () => 'hub:courtyard',
  })
  return {
    channelEmissions: result.channelEmissions,
    manaSpent: result.manaSpent[PLAYER_ID]!,
    state: {
      players: result.players,
      primarySkill,
      rng: result.rng,
      spells: result.spells,
      tick: state.tick + 1,
    },
  }
}

test('one-shot primaries debit at emission across every low-mana boundary', () => {
  for (const element of ['ether', 'fire'] as const) {
    const cost = PRIMARY_SPELL_RANK_ONE_MANA_COSTS[element]
    const normalDamage = element === 'ether' ? 2 : 4
    for (const expected of [
      { availableMana: cost + 1, spent: cost, underpowered: false },
      { availableMana: cost, spent: cost, underpowered: true },
      { availableMana: cost / 2, spent: cost / 2, underpowered: true },
      { availableMana: 0, spent: 0, underpowered: true },
    ]) {
      let state = directSpellHarness(element)
      let outcome = stepSpellKernel(state, true, expected.availableMana)
      state = outcome.state
      assert.equal(outcome.manaSpent, 0)
      assert.equal(state.players[PLAYER_ID]!.primaryCast.castSequence, 1)

      const emissionTick = primaryCastEmissionTick(element)
      for (let tick = 0; tick < emissionTick; tick += 1) {
        outcome = stepSpellKernel(state, true, expected.availableMana)
        state = outcome.state
      }

      const projectile = state.spells.projectiles[0]!
      assert.equal(outcome.manaSpent, expected.spent)
      assert.equal(state.spells.projectiles.length, 1)
      assert.equal(projectile.kind, element)
      if (projectile.kind === 'earth') throw new Error('expected a one-shot projectile')
      assert.equal(
        projectile.damage,
        normalDamage * (expected.underpowered ? 0.5 : 1),
      )
      assert.equal(
        Math.hypot(projectile.velocity.x, projectile.velocity.y),
        element === 'ether' && expected.underpowered
          ? PRIMARY_SPELL_ETHER_UNDERPOWERED_SPEED
          : element === 'ether' ? 3 : 4.5,
      )
      assert.equal(projectile.underpowered, expected.underpowered)
      assert.equal(
        state.players[PLAYER_ID]!.primaryCast.underpowered,
        expected.underpowered,
      )
      assert.equal(
        state.players[PLAYER_ID]!.primaryCast.fizzleSequence,
        expected.underpowered ? 1 : 0,
      )
    }
  }
})

test('sustained primaries select the same fixed branch at every mana boundary', () => {
  for (const element of ['air', 'water', 'earth'] as const) {
    const harness = directSpellHarness(element)
    const cost = PRIMARY_SPELL_RANK_ONE_MANA_COSTS[element]
    for (const expected of [
      { availableMana: cost + 1, spent: cost, underpowered: false },
      { availableMana: cost, spent: cost, underpowered: true },
      { availableMana: cost / 2, spent: cost / 2, underpowered: true },
      { availableMana: 0, spent: 0, underpowered: true },
    ]) {
      const outcome = stepSpellKernel(
        directSpellHarness(element),
        true,
        expected.availableMana,
      )
      const player = outcome.state.players[PLAYER_ID]!
      assert.equal(outcome.manaSpent, expected.spent)
      assert.equal(player.primaryCast.channelActive, true)
      assert.equal(player.primaryCast.underpowered, expected.underpowered)

      if (element === 'earth') {
        const boulder = outcome.state.spells.projectiles[0]!
        assert.equal(boulder.kind, 'earth')
        assert.equal(
          boulder.damage,
          harness.primarySkill.damageMinimum * (expected.underpowered ? 0.5 : 1),
        )
        assert.deepEqual(outcome.channelEmissions, [])
        continue
      }

      assert.equal(outcome.channelEmissions.length, 1)
      assert.equal(outcome.channelEmissions[0]!.underpowered, expected.underpowered)
      assert.equal(
        outcome.channelEmissions[0]!.damage,
        harness.primarySkill.damageMinimum / 100 * (expected.underpowered ? 0.5 : 1),
      )
      assert.equal(
        outcome.state.spells.transients.length,
        element === 'water' && !expected.underpowered ? 2 : 1,
      )
      assert.equal(
        outcome.state.spells.transients.every((effect) => (
          effect.kind === element && effect.underpowered === expected.underpowered
        )),
        true,
      )
    }
  }
})

test('rank-one one-shot casts arm before their emission-time debit', () => {
  let ether = directSpellHarness('ether')
  let outcome = stepSpellKernel(ether, true, PRIMARY_SPELL_RANK_ONE_MANA_COSTS.ether)
  ether = outcome.state
  assert.equal(outcome.manaSpent, 0)
  assert.equal(ether.players[PLAYER_ID]!.primaryCast.castSequence, 1)

  for (let tick = 0; tick < PRIMARY_CAST_ETHER_EMISSION_TICK; tick += 1) {
    outcome = stepSpellKernel(ether, true, 0)
    ether = outcome.state
    assert.equal(outcome.manaSpent, 0)
  }
  assert.equal(ether.spells.projectiles.length, 1)
  assert.equal(ether.spells.projectiles[0]!.kind, 'ether')

  let fire = directSpellHarness('fire')
  outcome = stepSpellKernel(fire, true, PRIMARY_SPELL_RANK_ONE_MANA_COSTS.fire)
  fire = outcome.state
  assert.equal(outcome.manaSpent, 0)
  assert.equal(fire.players[PLAYER_ID]!.primaryCast.castSequence, 1)

  const acceptedLowMana = stepSpellKernel(
    directSpellHarness('fire'),
    true,
    PRIMARY_SPELL_RANK_ONE_MANA_COSTS.fire - 0.001,
  )
  assert.equal(acceptedLowMana.manaSpent, 0)
  assert.equal(acceptedLowMana.state.players[PLAYER_ID]!.primaryCast.actionTick, 0)
  assert.equal(acceptedLowMana.state.players[PLAYER_ID]!.primaryCast.castSequence, 1)
})

test('Ether Blast releases before Magic Missile RNG and resumes charging after emission', () => {
  const primarySkill = primarySkillWithRanks('ether', { 8: 1, 14: 1 })
  if (primarySkill.kind !== 'ether') throw new Error('Expected an Ether skill profile')
  const sourceRng = createNativeRng(0x1414)
  const source = directSpellHarness('ether')
  let state: DirectSpellHarness = {
    ...source,
    players: {
      [PLAYER_ID]: {
        ...source.players[PLAYER_ID]!,
        primaryCast: {
          ...source.players[PLAYER_ID]!.primaryCast,
          etherBlastCharge: Math.fround(1.2),
        },
      },
    },
    primarySkill,
    rng: sourceRng,
  }
  let outcome = stepSpellKernel(state, true, 1_000, true, () => true, primarySkill)
  state = outcome.state
  for (let tick = 0; tick < PRIMARY_CAST_ETHER_EMISSION_TICK; tick += 1) {
    outcome = stepSpellKernel(state, true, 1_000, true, () => true, primarySkill)
    state = outcome.state
  }
  const pulse = state.spells.transients.find((effect) => effect.kind === 'ether-blast')
  assert.ok(pulse?.kind === 'ether-blast')
  assert.equal(pulse.charges, 1)
  assert.deepEqual(pulse.presentationRng, sourceRng)
  assert.deepEqual(
    state.rng,
    drawNativeInteger(
      createNativeEtherBlastParticleProgram(sourceRng).rng,
      primarySkill.damageRollCount,
    ).state,
  )
  assert.deepEqual(pulse.origin, {
    x: Math.fround(state.players[PLAYER_ID]!.position.x),
    y: Math.fround(state.players[PLAYER_ID]!.position.y - 100),
  })
  assert.equal(
    state.players[PLAYER_ID]!.primaryCast.etherBlastCharge,
    Math.fround(0.00700000022),
  )
  assert.equal(state.players[PLAYER_ID]!.primaryCast.weaponPulse, Math.fround(0.15))
})

test('rank-two spell payloads change debit and damage without rewriting a live projectile', () => {
  let rankOne = stepSpellKernel(directSpellHarness('fire'), true, 13)
  assert.equal(rankOne.manaSpent, 0)
  for (let tick = 0; tick < PRIMARY_CAST_EMISSION_TICK; tick += 1) {
    rankOne = stepSpellKernel(rankOne.state, true, 13)
  }
  assert.equal(rankOne.manaSpent, 12)
  assert.equal(rankOne.state.spells.projectiles[0]!.damage, 4)

  const rankTwoStats = primarySkillRankStats('fire', 2)
  const advanced = stepSpellKernel(
    rankOne.state,
    false,
    0,
    true,
    () => true,
    rankTwoStats,
  )
  assert.equal(advanced.state.spells.projectiles[0]!.damage, 4)

  let rankTwo = stepSpellKernel(directSpellHarness('fire', 2), true, 16)
  assert.equal(rankTwo.manaSpent, 0)
  for (let tick = 0; tick < PRIMARY_CAST_EMISSION_TICK; tick += 1) {
    rankTwo = stepSpellKernel(rankTwo.state, true, 16)
  }
  assert.equal(rankTwo.manaSpent, 15)
  assert.equal(rankTwo.state.spells.projectiles[0]!.damage, 7)
})

test('rank-two channels carry native 100 Hz cost and damage payloads', () => {
  const air = stepSpellKernel(directSpellHarness('air', 2), true, 0.15)
  assert.equal(air.manaSpent, 0.14)
  assert.deepEqual(air.state.spells.projectiles, [])
  assert.deepEqual(air.state.players[PLAYER_ID]!.primaryCast.channelActive, true)
  assert.deepEqual(air.state.spells.transients.length, 1)
  assert.deepEqual(air.channelEmissions.map(({ damage, manaCost }) => ({ damage, manaCost })), [
    { damage: 0.04, manaCost: 0.14 },
  ])

  const water = stepSpellKernel(directSpellHarness('water', 2), true, 0.18)
  assert.deepEqual(water.channelEmissions.map(({ damage, manaCost }) => ({ damage, manaCost })), [
    { damage: 0.035, manaCost: 0.175 },
  ])
  assert.equal(water.manaSpent, 0.175)
})

test('rank-two Boulder captures base damage while charging at its per-tick cost', () => {
  const earth = stepSpellKernel(directSpellHarness('earth', 2), true, 0.14)
  assert.equal(earth.manaSpent, 0.13)
  assert.equal(earth.state.spells.projectiles[0]!.damage, 30)
})

test('Hasten, Bind, and Gargantuan are captured by the authoritative Boulder actor', () => {
  const primarySkill = primarySkillWithRanks('earth', {
    40: 1,
    42: 2,
    43: 2,
    47: 2,
  })
  const born = stepSpellKernel(
    directSpellHarness('earth'),
    true,
    1,
    true,
    () => true,
    primarySkill,
  )
  const boulder = born.state.spells.projectiles[0]
  assert.ok(boulder?.kind === 'earth')
  assert.equal(born.manaSpent, primarySkill.manaCost / 100)
  assert.equal(boulder.charge, advanceNativeEarthBoulderCharge(0.18, 2, 2.2))
  assert.equal(boulder.maximumCharge, 2.2)
  assert.equal(boulder.toughness, 5)

  const releasable = {
    ...born.state,
    spells: {
      ...born.state.spells,
      projectiles: [{ ...boulder, charge: 1.5 }],
    },
  }
  const released = stepSpellKernel(
    releasable,
    false,
    1,
    true,
    () => true,
    primarySkill,
  ).state.spells.projectiles[0]
  assert.ok(released?.kind === 'earth')
  assert.equal(released.phase, 'flight')
  assert.equal(released.remainingDamage, nativeEarthBoulderReleasedDamage(10, 1.5))
})

test('Rock Surge consumes one 1/100-percent draw and its one-shot mana only on success', () => {
  const primarySkill = primarySkillWithRanks('earth', { 40: 1, 44: 2 })
  if (primarySkill.kind !== 'earth') throw new Error('Expected an Earth skill profile')
  const source = { ...directSpellHarness('earth'), rng: createNativeRng(3) }
  const successful = stepSpellKernel(
    source,
    true,
    100,
    true,
    () => true,
    primarySkill,
  )
  const surged = successful.state.spells.projectiles[0]
  assert.ok(surged?.kind === 'earth')
  assert.equal(successful.manaSpent, primarySkill.manaCost / 100 + primarySkill.rockSurgeManaCost)
  assert.equal(surged.phase, 'flight')
  assert.equal(surged.charge, 1)
  assert.equal(surged.remainingDamage, 10)
  assert.equal(successful.state.players[PLAYER_ID]?.primaryCast.channelActive, false)
  assert.notDeepEqual(successful.state.rng, source.rng)

  const unaffordable = stepSpellKernel(
    source,
    true,
    1,
    true,
    () => true,
    primarySkill,
  )
  const ordinary = unaffordable.state.spells.projectiles[0]
  assert.ok(ordinary?.kind === 'earth')
  assert.equal(unaffordable.manaSpent, primarySkill.manaCost / 100)
  assert.equal(ordinary.phase, 'held')
  assert.notDeepEqual(unaffordable.state.rng, source.rng)
})

test('a partial Ether payment at the emission marker still materializes weak flight', () => {
  let outcome = stepSpellKernel(directSpellHarness('ether'), true, 5)
  let state = outcome.state
  for (let tick = 0; tick < PRIMARY_CAST_ETHER_EMISSION_TICK; tick += 1) {
    outcome = stepSpellKernel(state, true, 5)
    state = outcome.state
  }
  const player = state.players[PLAYER_ID]!
  assert.equal(outcome.manaSpent, 5)
  assert.equal(player.primaryCast.castSequence, 1)
  assert.equal(player.primaryCast.emissionSequence, 1)
  assert.equal(state.spells.projectiles.length, 1)
  assert.equal(state.spells.projectiles[0]!.underpowered, true)
})

test('Air and Water debit every emitted channel tick and continue weak at zero', () => {
  for (const [element, startingMana] of [
    ['air', 0.24],
    ['water', 0.25],
  ] as const) {
    const cost = PRIMARY_SPELL_RANK_ONE_MANA_COSTS[element]
    let availableMana = startingMana
    let totalSpent = 0
    let state = directSpellHarness(element)
    const emissions: PrimarySpellChannelEmission[] = []

    for (let tick = 0; tick < 3; tick += 1) {
      const outcome = stepSpellKernel(state, true, availableMana)
      state = outcome.state
      availableMana -= outcome.manaSpent
      totalSpent += outcome.manaSpent
      emissions.push(...outcome.channelEmissions)
    }

    assert.equal(totalSpent, cost * 2)
    assert.equal(state.spells.transients.length, element === 'water' ? 4 : 3)
    assert.equal(state.players[PLAYER_ID]!.primaryCast.channelActive, true)
    assert.equal(state.players[PLAYER_ID]!.primaryCast.actionTick, 1)
    assert.equal(state.players[PLAYER_ID]!.primaryCast.underpowered, true)
    assert.deepEqual(emissions.map(({ underpowered }) => underpowered), [false, true, true])
    assert.deepEqual(
      emissions.map(({ damage }) => damage),
      [0.025, 0.0125, 0.0125],
    )
  }
})

test('Earth keeps charging weak and repeatedly halves its release base at zero', () => {
  let availableMana = 0.24
  let totalSpent = 0
  let state = directSpellHarness('earth')

  for (let tick = 0; tick < 2; tick += 1) {
    const outcome = stepSpellKernel(state, true, availableMana)
    state = outcome.state
    availableMana -= outcome.manaSpent
    totalSpent += outcome.manaSpent
  }

  const heldBoulder = state.spells.projectiles[0]!
  assert.equal(totalSpent, 0.24)
  assert.equal(heldBoulder.charge, earthChargeAfter(2))
  assert.equal(heldBoulder.damage, 5)
  assert.equal(heldBoulder.remainingDamage, 5)
  assert.ok(heldBoulder.charge < PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE)

  const exhausted = stepSpellKernel(state, true, availableMana)
  state = exhausted.state
  assert.equal(exhausted.manaSpent, 0)
  assert.equal(state.spells.projectiles.length, 1)
  assert.equal(state.spells.projectiles[0]!.charge, earthChargeAfter(3))
  assert.equal(state.spells.projectiles[0]!.damage, 2.5)
  assert.equal(state.spells.projectiles[0]!.remainingDamage, 2.5)
  assert.equal(state.players[PLAYER_ID]!.primaryCast.channelActive, true)
  assert.equal(state.players[PLAYER_ID]!.primaryCast.actionTick, 1)
  assert.equal(state.players[PLAYER_ID]!.primaryCast.emissionSequence, 0)
})

test('Earth publishes its half-gain fizzle sequence only on weak global 50-tick edges', () => {
  const weak = stepSpellKernel({ ...directSpellHarness('earth'), tick: 49 }, true, 0)
  assert.equal(weak.state.tick, 50)
  assert.equal(weak.state.players[PLAYER_ID]!.primaryCast.fizzleSequence, 1)
  assert.equal(weak.state.spells.projectiles[0]!.damage, 5)

  const normal = stepSpellKernel({ ...directSpellHarness('earth'), tick: 49 }, true, 1)
  assert.equal(normal.state.players[PLAYER_ID]!.primaryCast.fizzleSequence, 0)
})

test('Earth release finalization uses float32 quadratic damage with its native floor and cap', () => {
  assert.equal(nativeEarthBoulderReleasedDamage(10, 0.5), 2.5)
  assert.equal(nativeEarthBoulderReleasedDamage(0.0001, 0.30125), 0.25)
  assert.equal(nativeEarthBoulderReleasedDamage(10, 2), 12.5)
})

test('Earth zero mana freezes above 0.3 and release still uses the terrain probe', () => {
  const cost = PRIMARY_SPELL_RANK_ONE_MANA_COSTS.earth
  let state = directSpellHarness('earth')
  do {
    state = stepSpellKernel(state, true, cost).state
  } while (state.spells.projectiles[0]!.charge < PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE)

  const exhausted = stepSpellKernel(state, true, 0, true, () => false)

  assert.equal(exhausted.manaSpent, 0)
  assert.equal(exhausted.state.spells.projectiles.length, 1)
  assert.equal(exhausted.state.spells.projectiles[0]!.phase, 'held')
  assert.equal(exhausted.state.players[PLAYER_ID]!.primaryCast.channelActive, true)

  const released = stepSpellKernel(exhausted.state, false, 0, true, () => false)
  assert.equal(released.manaSpent, 0)
  assert.equal(released.state.spells.projectiles.length, 0)
  assert.equal(
    released.state.spells.transients.some((effect) => effect.kind === 'earth-impact'),
    true,
  )
  assert.equal(released.state.players[PLAYER_ID]!.primaryCast.channelActive, false)
  assert.equal(released.state.players[PLAYER_ID]!.primaryCast.emissionSequence, 1)
})

test('cast eligibility cancels an active channel without another debit or emission', () => {
  const started = stepSpellKernel(directSpellHarness('air'), true, 1)
  assert.equal(started.manaSpent, PRIMARY_SPELL_RANK_ONE_MANA_COSTS.air)
  assert.equal(started.state.spells.transients.length, 1)

  const cancelled = stepSpellKernel(started.state, true, 1, false)
  assert.equal(cancelled.manaSpent, 0)
  assert.equal(cancelled.state.spells.transients.length, 1)
  assert.equal(cancelled.state.players[PLAYER_ID]!.primaryCast.channelActive, false)
  assert.equal(cancelled.state.players[PLAYER_ID]!.primaryCast.actionTick, -1)
})

test('Ether uses its faster native Staff rate and repeats while held', () => {
  let state = step(simulation('ether'), true)
  assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.actionTick, 0)
  assert.equal(state.primarySpells.projectiles.length, 0)
  state = step(state, true, PRIMARY_CAST_ETHER_EMISSION_TICK)
  const player = getPlayerCharacter(state, PLAYER_ID)
  const missile = state.primarySpells.projectiles[0]
  assert.equal(player.primaryCast.actionTick, PRIMARY_CAST_ETHER_EMISSION_TICK)
  assert.equal(player.primaryCast.emissionSequence, 1)
  assert.equal(primaryCastPose(player.primaryCast.actionTick, false, 'ether'), 8)
  assert.equal(missile.kind, 'ether')
  assert.equal(missile.ageTicks, 1)
  assert.equal(missile.velocity.x, 0)
  assert.equal(missile.velocity.y, -3)
  assert.ok(Math.abs(missile.position.x - (player.position.x + 8.5)) < 0.0001)
  assert.ok(Math.abs(missile.position.y - (player.position.y - 40.5)) < 0.0001)
  state = step(
    state,
    true,
    PRIMARY_CAST_ETHER_ACTION_END_TICK - PRIMARY_CAST_ETHER_EMISSION_TICK,
  )
  assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.actionTick, -1)
  state = step(state, true)
  assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.actionTick, 0)
  assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.castSequence, 2)
  state = step(state, true, PRIMARY_CAST_ETHER_EMISSION_TICK)
  assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.emissionSequence, 2)
})

test('More Missiles shares one damage roll and preserves native fan and turn order', () => {
  const profile = primarySkillWithRanks('ether', { 8: 2, 9: 2, 10: 3 })
  assert.equal(profile.kind, 'ether')
  let harness = directSpellHarness('ether')
  let outcome = stepSpellKernel(harness, true, 1_000_000, true, () => true, profile)
  harness = outcome.state
  while (harness.spells.projectiles.length === 0) {
    outcome = stepSpellKernel(harness, true, 1_000_000, true, () => true, profile)
    harness = outcome.state
    assert.ok(harness.tick <= PRIMARY_CAST_ETHER_EMISSION_TICK + 1)
  }

  const missiles = harness.spells.projectiles
  assert.deepEqual(missiles.map(({ id }) => id), [1, 2, 3, 4])
  assert.deepEqual(
    missiles.map((spell) => spell.kind === 'ether' ? spell.headingDegrees : null),
    [10, 350, 50, 310],
  )
  assert.equal(new Set(missiles.map(({ damage }) => damage)).size, 1)
  assert.ok(missiles[0]!.damage >= 2 && missiles[0]!.damage <= 4)
  assert.deepEqual(
    missiles.map((spell) => spell.kind === 'ether' ? spell.speed : null),
    [3.75, 3.75, 3.75, 3.75],
  )
  assert.deepEqual(
    missiles.map((spell) => spell.kind === 'ether' ? spell.turnInput : null),
    [2.5, 1.875, 1.40625, 1.0546875],
  )
  assert.deepEqual(
    missiles.map((spell) => spell.kind === 'ether' ? spell.visualScale : null),
    [1, 1, 1, 1],
  )
  assert.deepEqual(harness.rng, drawNativeInteger(createNativeRng(0), 3).state)
})

test('Smart Missiles reacquires after its copied target handle is lost', () => {
  const profile = primarySkillWithRanks('ether', { 8: 1, 9: 1 })
  assert.equal(profile.kind, 'ether')
  let harness = directSpellHarness('ether')
  let outcome = stepSpellKernel(harness, true, 1_000_000, true, () => true, profile)
  harness = outcome.state
  while (harness.spells.projectiles.length === 0) {
    outcome = stepSpellKernel(harness, true, 1_000_000, true, () => true, profile)
    harness = outcome.state
  }
  const missile = harness.spells.projectiles[0]
  assert.equal(missile?.kind, 'ether')
  if (missile?.kind !== 'ether') throw new Error('Expected an Ether missile')
  const target = hostileTarget('enemy:new', {
    x: missile.position.x,
    y: missile.position.y - 100,
  })
  const advanced = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => true,
    inputs: {},
    players: {},
    previousPlayers: {},
    rng: harness.rng,
    spellTargets: () => [target],
    spells: {
      nextId: harness.spells.nextId,
      projectiles: [{ ...missile, targetId: null }],
      transients: [],
    },
    tick: harness.tick + 1,
    viewScale: 1.35,
    worldKeyForPlayer: () => 'hub:courtyard',
  }).spells.projectiles[0]
  assert.equal(advanced?.kind, 'ether')
  if (advanced?.kind === 'ether') assert.equal(advanced.targetId, target.id)
})

test('Ether snapshots the forward-probe target and steers after its first movement', () => {
  const initial = simulation('ether')
  const player = getPlayerCharacter(initial, PLAYER_ID)
  const target: PrimarySpellTarget = {
    active: true,
    actorFlags: 0x2,
    attachment: { x: 0, y: 0 },
    bodyRadius: 20,
    id: 'enemy:41',
    kind: 'enemy',
    nativePriority: 0,
    pendingRemove: false,
    position: { x: player.position.x + 100, y: player.position.y - 140 },
    registrationOrder: 41,
  }
  let players = playerCharacterRecords(initial.playerEntities)
  let previousPlayers = playerCharacterRecords(initial.playerEntities)
  let spells = initial.primarySpells
  const castAuthority = {
    [PLAYER_ID]: {
      availableMana: 1_000_000,
      eligible: true,
      primarySkill: primarySkillRankStats('ether', 1),
    },
  }
  for (let tick = 1; tick <= PRIMARY_CAST_ETHER_EMISSION_TICK + 1; tick += 1) {
    const result = stepPrimarySpells({
      ...EMPTY_SPELL_WORLD,
      canPlaceProjectile: () => true,
      canTraverseProjectile: () => true,
      castAuthority,
      inputs: { [PLAYER_ID]: input(initial, true) },
      players,
      previousPlayers,
      spellTargets: () => [target],
      spells,
      tick,
      viewScale: 1.2,
      worldKeyForPlayer: () => 'hub:courtyard',
    })
    players = result.players
    previousPlayers = result.players
    spells = result.spells
  }

  const missile = spells.projectiles[0]
  assert.equal(missile.kind, 'ether')
  assert.equal(missile.targetId, target.id)
  assert.equal(
    missile.turnAccumulator,
    Math.fround(ETHER_PRIMARY_INITIAL_TURN + ETHER_PRIMARY_TURN_FAST_STEP),
  )
  assert.ok(missile.headingDegrees > 0)
  assert.ok(missile.direction.x > 0)
  const firstPosition = { ...missile.position }

  const advanced = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => true,
    castAuthority,
    inputs: { [PLAYER_ID]: input(initial, false) },
    players,
    previousPlayers: players,
    spellTargets: () => [target],
    spells,
    tick: PRIMARY_CAST_ETHER_EMISSION_TICK + 2,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  }).spells.projectiles[0]
  assert.equal(advanced.kind, 'ether')
  assert.ok(advanced.position.x > firstPosition.x)

  const flagChanged = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => true,
    castAuthority,
    inputs: {},
    players: {},
    previousPlayers: {},
    spellTargets: () => [{ ...target, actorFlags: 0 }],
    spells: { nextId: spells.nextId, projectiles: [advanced], transients: [] },
    tick: PRIMARY_CAST_ETHER_EMISSION_TICK + 3,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  }).spells.projectiles[0]
  assert.equal(flagChanged.kind, 'ether')
  assert.equal(flagChanged.targetId, null)

  const inactiveTarget = { ...target, active: false, actorFlags: 0 }
  const finalTracked = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => true,
    castAuthority,
    inputs: {},
    players: {},
    previousPlayers: {},
    spellTargets: () => [inactiveTarget],
    spells: { nextId: spells.nextId, projectiles: [flagChanged], transients: [] },
    tick: PRIMARY_CAST_ETHER_EMISSION_TICK + 4,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  }).spells.projectiles[0]
  assert.equal(finalTracked.kind, 'ether')
  assert.equal(finalTracked.targetId, null)
  assert.equal(finalTracked.headingDegrees, flagChanged.headingDegrees)
  assert.equal(finalTracked.turnAccumulator, flagChanged.turnAccumulator)

  const lost = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => true,
    castAuthority,
    inputs: {},
    players: {},
    previousPlayers: {},
    spells: { nextId: spells.nextId, projectiles: [finalTracked], transients: [] },
    tick: PRIMARY_CAST_ETHER_EMISSION_TICK + 5,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  }).spells.projectiles[0]
  assert.equal(lost.kind, 'ether')
  assert.equal(lost.targetId, null)
  assert.equal(lost.turnAccumulator, finalTracked.turnAccumulator)

  const noRankOneRetarget = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => true,
    castAuthority,
    inputs: {},
    players: {},
    previousPlayers: {},
    spellTargets: () => [target],
    spells: { nextId: spells.nextId, projectiles: [lost], transients: [] },
    tick: PRIMARY_CAST_ETHER_EMISSION_TICK + 6,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  }).spells.projectiles[0]
  assert.equal(noRankOneRetarget.kind, 'ether')
  assert.equal(noRankOneRetarget.targetId, null)
})

test('Ether defers actor contact to combat and owns the terrain-impact lifetime', () => {
  const missile = {
    ageTicks: 1,
    charge: 1,
    damage: 2,
    damageRetention: 1,
    direction: { x: 1, y: 0 },
    flightTicks: 1,
    headingDegrees: 90,
    id: 1,
    kind: 'ether',
    lightRegistration: ACTOR_LIGHT_REGISTRATION,
    ownerId: PLAYER_ID,
    phase: 'flight',
    piercesRemaining: 0,
    position: { x: 100, y: 200 },
    reacquiresTarget: false,
    speed: 3,
    targetId: 'enemy:7',
    turnInput: 2,
    turnAccumulator: ETHER_PRIMARY_INITIAL_TURN,
    velocity: { x: 3, y: 0 },
    visualScale: 1,
    worldKey: 'hub:courtyard',
  } as const
  const target = hostileTarget('enemy:7', { x: 125, y: 200 })
  const actorDeferred = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => true,
    inputs: {},
    players: {},
    previousPlayers: {},
    spellTargets: () => [target],
    spells: { nextId: 2, projectiles: [missile], transients: [] },
    tick: 77,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  }).spells
  assert.equal(actorDeferred.projectiles.length, 1)
  assert.equal(actorDeferred.projectiles[0]?.position.x, 103)
  assert.deepEqual(actorDeferred.transients, [])

  let result = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => false,
    inputs: {},
    players: {},
    previousPlayers: {},
    spells: {
      nextId: 2,
      projectiles: [{ ...missile, ageTicks: 5, flightTicks: 5 }],
      transients: [],
    },
    tick: 88,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  }).spells
  assert.equal(result.projectiles.length, 0)
  assert.deepEqual(result.transients, [{
    ageTicks: 0,
    birthTick: 88,
    id: 2,
    kind: 'ether-impact',
    lightRegistration: TRANSIENT_LIGHT_REGISTRATION,
    origin: missile.position,
    ownerId: PLAYER_ID,
    visualScale: 1,
    worldKey: 'hub:courtyard',
  }])

  for (let age = 1; age < PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS; age += 1) {
    result = stepPrimarySpells({
      ...EMPTY_SPELL_WORLD,
      canPlaceProjectile: () => true,
      canTraverseProjectile: () => true,
      inputs: {},
      players: {},
      previousPlayers: {},
      spells: result,
      tick: 88 + age,
      viewScale: 1.2,
      worldKeyForPlayer: () => 'hub:courtyard',
    }).spells
    assert.equal(result.transients[0]?.ageTicks, age)
  }
  result = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => true,
    inputs: {},
    players: {},
    previousPlayers: {},
    spells: result,
    tick: 88 + PRIMARY_SPELL_ETHER_IMPACT_LIFETIME_TICKS,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  }).spells
  assert.equal(result.transients.length, 0)

})

test('Fire emits its one 4.5-unit missile from the native pushed socket', () => {
  let state = step(simulation('fire'), true, 20)
  const player = getPlayerCharacter(state, PLAYER_ID)
  const fireball = state.primarySpells.projectiles[0]
  assert.equal(fireball.kind, 'fire')
  assert.equal(fireball.velocity.x, 0)
  assert.equal(fireball.velocity.y, -4.5)
  assert.equal(fireball.position.x, player.position.x + 8.5)
  assert.equal(fireball.position.y, player.position.y - 62)
  assert.equal(fireball.ageTicks, 1)
  assert.deepEqual(fireball.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 1,
  })
  assert.equal(state.primarySpells.transients.length, 1)
  assert.deepEqual(state.primarySpells.transients[0], {
    ageTicks: 0,
    direction: { x: 0, y: -1 },
    id: 2,
    kind: 'fire',
    lightRegistration: null,
    origin: { ...fireball.position },
    ownerId: PLAYER_ID,
    variant: nativeFireParticleVariant(2),
    worldKey: 'hub:courtyard',
  })

  state = step(state, false, 3)
  assert.equal(state.primarySpells.projectiles[0].ageTicks, 4)
  assert.deepEqual(
    state.primarySpells.transients.map(({ ageTicks, id }) => ({ ageTicks, id })),
    [
      { ageTicks: 3, id: 2 },
      { ageTicks: 2, id: 3 },
      { ageTicks: 1, id: 4 },
      { ageTicks: 0, id: 5 },
    ],
  )
  assert.deepEqual(
    state.primarySpells.transients.map(({ origin }) => origin.y),
    [-62, -66.5, -71, -75.5].map((offset) => player.position.y + offset),
  )

  const firstLifetime = nativeFireParticleLifetimeTicks(2)
  state = step(state, false, firstLifetime)
  assert.equal(state.primarySpells.transients.some(({ id }) => id === 2), false)
  assert.equal(state.primarySpells.transients.length <= 41, true)
})

test('Fire blocked birth replaces the spawned actor before its first trail tick', () => {
  const beforeMarker = step(simulation('fire'), true, PRIMARY_CAST_EMISSION_TICK)
  const player = getPlayerCharacter(beforeMarker, PLAYER_ID)
  const players = playerCharacterRecords(beforeMarker.playerEntities)
  const probes: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> = []
  const result = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: (_spell, from, to) => {
      probes.push({ from, to })
      return false
    },
    castAuthority: {
      [PLAYER_ID]: {
        availableMana: 1_000_000,
        eligible: true,
        primarySkill: primarySkillRankStats('fire', 1),
      },
    },
    inputs: { [PLAYER_ID]: input(beforeMarker, true) },
    players,
    previousPlayers: players,
    spells: beforeMarker.primarySpells,
    tick: beforeMarker.tick + 1,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  })

  assert.equal(result.spells.projectiles.length, 0)
  assert.equal(result.players[PLAYER_ID].primaryCast.emissionSequence, 1)
  assert.deepEqual(probes, [{
    from: player.position,
    to: {
      x: player.position.x + 8.5,
      y: player.position.y - 57.5,
    },
  }])
  assert.deepEqual(result.spells.transients, [{
    ageTicks: 0,
    id: 2,
    kind: 'fire-impact',
    lightRegistration: TRANSIENT_LIGHT_REGISTRATION,
    origin: probes[0].to,
    ownerId: PLAYER_ID,
    worldKey: 'hub:courtyard',
  }])
})

test('Fire terrain lookahead contacts before movement and emits no final particle', () => {
  const fireball = {
    ageTicks: 5,
    burnDamage: 0,
    charge: 1,
    damage: 2,
    direction: { x: 1, y: 0 },
    emberDamage: 0,
    emberFragments: 0,
    explodeDamage: 0,
    explodeRadius: 0,
    flightTicks: 5,
    id: 1,
    kind: 'fire',
    lightRegistration: ACTOR_LIGHT_REGISTRATION,
    ownerId: PLAYER_ID,
    phase: 'flight',
    position: { x: 100, y: 200 },
    privateSeed: 0,
    spentEmber: { kind: 'none' },
    velocity: { x: 4.5, y: 0 },
    worldKey: 'hub:courtyard',
  } as const
  const probes: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> = []
  const result = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: (_spell, from, to) => {
      probes.push({ from, to })
      return false
    },
    inputs: {},
    players: {},
    previousPlayers: {},
    spells: { nextId: 2, projectiles: [fireball], transients: [] },
    tick: 50,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  })

  assert.deepEqual(probes, [{
    from: { x: 100, y: 200 },
    to: { x: 122.5, y: 200 },
  }])
  assert.equal(result.spells.projectiles.length, 0)
  assert.deepEqual(result.spells.transients, [{
    ageTicks: 0,
    id: 2,
    kind: 'fire-impact',
    lightRegistration: TRANSIENT_LIGHT_REGISTRATION,
    origin: { x: 100, y: 200 },
    ownerId: PLAYER_ID,
    worldKey: 'hub:courtyard',
  }])

  let impactState = result.spells
  for (let age = 1; age < PRIMARY_SPELL_FIRE_IMPACT_LIFETIME_TICKS; age += 1) {
    impactState = stepPrimarySpells({
      ...EMPTY_SPELL_WORLD,
      canPlaceProjectile: () => true,
      canTraverseProjectile: () => true,
      inputs: {},
      players: {},
      previousPlayers: {},
      spells: impactState,
      tick: 50 + age,
      viewScale: 1.2,
      worldKeyForPlayer: () => 'hub:courtyard',
    }).spells
    assert.equal(impactState.transients[0]?.ageTicks, age)
  }
  impactState = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => true,
    inputs: {},
    players: {},
    previousPlayers: {},
    spells: impactState,
    tick: 50 + PRIMARY_SPELL_FIRE_IMPACT_LIFETIME_TICKS,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  }).spells
  assert.equal(impactState.transients.length, 0)
})

test('Fire advances and emits its final trail before combat owns actor contact', () => {
  const fireball = {
    ageTicks: 1,
    burnDamage: 0,
    charge: 1,
    damage: 2,
    direction: { x: 1, y: 0 },
    emberDamage: 0,
    emberFragments: 0,
    explodeDamage: 0,
    explodeRadius: 0,
    flightTicks: 1,
    id: 1,
    kind: 'fire',
    lightRegistration: ACTOR_LIGHT_REGISTRATION,
    ownerId: PLAYER_ID,
    phase: 'flight',
    position: { x: 100, y: 200 },
    privateSeed: 0,
    spentEmber: { kind: 'none' },
    velocity: { x: 4.5, y: 0 },
    worldKey: 'hub:courtyard',
  } as const
  const target = hostileTarget('enemy:7', { x: 124.5, y: 200 })
  const result = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => true,
    inputs: {},
    players: {},
    previousPlayers: {},
    spellTargets: () => [target],
    spells: { nextId: 2, projectiles: [fireball], transients: [] },
    tick: 51,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  })

  assert.equal(result.spells.projectiles.length, 1)
  assert.deepEqual(result.spells.projectiles[0]?.position, { x: 104.5, y: 200 })
  assert.deepEqual(result.spells.transients.map(({ id, kind, origin }) => ({
    id,
    kind,
    origin,
  })), [{ id: 2, kind: 'fire', origin: { x: 104.5, y: 200 } }])
})

test('Fire has no distance or PoC flight-time range cap', () => {
  const ageTicks = 505
  const result = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => true,
    inputs: {},
    players: {},
    previousPlayers: {},
    spells: {
      nextId: 2,
      projectiles: [{
        ageTicks,
        burnDamage: 0,
        charge: 1,
        damage: 2,
        direction: { x: 1, y: 0 },
        emberDamage: 0,
        emberFragments: 0,
        explodeDamage: 0,
        explodeRadius: 0,
        flightTicks: ageTicks,
        id: 1,
        kind: 'fire',
        lightRegistration: ACTOR_LIGHT_REGISTRATION,
        ownerId: PLAYER_ID,
        phase: 'flight',
        position: { x: 100, y: 200 },
        privateSeed: 0,
        spentEmber: { kind: 'none' },
        velocity: { x: 4.5, y: 0 },
        worldKey: 'hub:courtyard',
      }],
      transients: [],
    },
    tick: 600,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  })
  assert.equal(result.spells.projectiles[0].ageTicks, ageTicks + 1)
  assert.equal(result.spells.projectiles[0].position.x, 104.5)
})

test('Ether has no distance or legacy PoC flight-time range cap', () => {
  const ageTicks = 505
  const result = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => true,
    inputs: {},
    players: {},
    previousPlayers: {},
    spells: {
      nextId: 2,
      projectiles: [{
        ageTicks,
        charge: 1,
        direction: { x: 1, y: 0 },
        flightTicks: ageTicks,
        headingDegrees: 90,
        id: 1,
        kind: 'ether',
        lightRegistration: ACTOR_LIGHT_REGISTRATION,
        ownerId: PLAYER_ID,
        phase: 'flight',
        piercesRemaining: 0,
        position: { x: 100, y: 200 },
        reacquiresTarget: false,
        speed: 3,
        targetId: null,
        turnInput: 2,
        turnAccumulator: ETHER_PRIMARY_INITIAL_TURN,
        velocity: { x: 3, y: 0 },
        visualScale: 1,
        worldKey: 'hub:courtyard',
      }],
      transients: [],
    },
    tick: 600,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  })
  assert.equal(result.spells.projectiles[0].ageTicks, ageTicks + 1)
  assert.equal(result.spells.projectiles[0].position.x, 103)
})

test('one-shot casts retain accepted facing against movement through projectile birth', () => {
  for (const element of ['ether', 'fire'] as const) {
    let state = simulation(element)
    const start = getPlayerCharacter(state, PLAYER_ID)
    const eastAim = {
      x: start.position.x + 200,
      y: start.position.y - 25 / 1.2,
    }
    const castInput = (primary: boolean): PlayerCharacterInput => ({
      aim: eastAim,
      cast: { primary, quickbar: null },
      movement: { x: -1, y: 0 },
    })

    state = stepGameSimulationTick(state, { [PLAYER_ID]: castInput(true) })
    assert.equal(getPlayerCharacter(state, PLAYER_ID).headingIndex, 6)

    const emissionTick = primaryCastEmissionTick(element)
    const actionEndTick = primaryCastActionEndTick(element)
    for (let tick = 0; tick < emissionTick; tick += 1) {
      state = stepGameSimulationTick(state, { [PLAYER_ID]: castInput(false) })
    }

    const projectile = state.primarySpells.projectiles[0]
    assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.actionTick, emissionTick)
    assert.equal(getPlayerCharacter(state, PLAYER_ID).headingIndex, 6)
    assert.ok(projectile.velocity.x > 0)
    assert.ok(Math.abs(projectile.velocity.y) < 0.000001)

    for (
      let tick = emissionTick;
      tick < actionEndTick;
      tick += 1
    ) {
      state = stepGameSimulationTick(state, { [PLAYER_ID]: castInput(false) })
    }
    assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.actionTick, -1)
    assert.equal(getPlayerCharacter(state, PLAYER_ID).headingIndex, 6)
    state = stepGameSimulationTick(state, { [PLAYER_ID]: castInput(false) })
    assert.equal(getPlayerCharacter(state, PLAYER_ID).headingIndex, 18)
  }
})

test('Air emits one presentation record per held tick for the five-tick contact fade', () => {
  let state = step(simulation('air'), true)
  let player = getPlayerCharacter(state, PLAYER_ID)
  assert.equal(player.primaryCast.channelActive, true)
  assert.equal(player.primaryCast.actionTick, 0)
  assert.equal(primaryCastPose(player.primaryCast.actionTick, true), 0)
  assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.castSequence, 1)
  assert.equal(state.primarySpells.transients.length, 1)
  assert.equal(state.primarySpells.transients[0].kind, 'air')
  assert.deepEqual(state.primarySpells.transients[0].origin, {
    x: player.position.x - 32.5,
    y: player.position.y - 66.5,
  })
  state = step(state, true)
  player = getPlayerCharacter(state, PLAYER_ID)
  assert.equal(player.primaryCast.actionTick, 1)
  assert.equal(primaryCastPose(player.primaryCast.actionTick, true), 7)
  assert.equal(state.primarySpells.transients.length, 2)
  assert.deepEqual(state.primarySpells.transients[1].origin, {
    x: player.position.x + 8.5,
    y: player.position.y - 56,
  })
  state = step(state, false)
  assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.channelActive, false)
  assert.equal(state.primarySpells.transients.length, 2)
  state = step(state, false, 3)
  assert.equal(state.primarySpells.transients.length, 1)
  state = step(state, false)
  assert.equal(state.primarySpells.transients.length, 0)
})

test('Water emits the shipped Enhanced Effects Frost pair while held and lets it decay', () => {
  let state = step(simulation('water'), true)
  const born = state.primarySpells.transients.filter((effect) => effect.kind === 'water')
  assert.equal(born.length, 2)
  assert.deepEqual(born.map(({ ageTicks }) => ageTicks), [1, 1])
  assert.equal(born.filter(({ obstructionPoint }) => obstructionPoint !== null).length, 1)
  assert.equal(born.find(({ id }) => id === 2)?.obstructionPoint?.y, 0)
  assert.ok((born.find(({ id }) => id === 2)?.obstructionDistance ?? -1) >= 0)
  state = step(state, true, 3)
  assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.actionTick, 1)
  assert.equal(primaryCastPose(1, true), 7)
  assert.equal(state.primarySpells.transients.length, 8)
  assert.deepEqual(
    state.primarySpells.transients.map((effect) => effect.variant),
    [0, 1, 0, 1, 0, 1, 0, 1],
  )
  state = step(state, false)
  assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.channelActive, false)
  state = step(state, false, 32)
  assert.equal(state.primarySpells.transients.length, 0)
})

test('Water wiggle uses the shared authority tick when player ids interleave', () => {
  const water = (displayName: string): PlayerCharacterConfig => ({
    discipline: 'arcane',
    displayName,
    element: 'water',
  })
  let state = createGameSimulation({
    'caster-a': water('Caster A'),
    'caster-b': water('Caster B'),
  })
  const heldInputs = (): Readonly<Record<string, PlayerCharacterInput>> => Object.fromEntries(
    Object.entries(playerCharacterRecords(state.playerEntities)).map(([playerId, player]) => [playerId, {
      ...createIdlePlayerCharacterInput(),
      aim: { x: player.position.x, y: player.position.y - 200 },
      cast: { primary: true, quickbar: null },
    }]),
  )

  state = stepGameSimulationTick(state, heldInputs())
  const firstA = state.primarySpells.transients.filter(({ ownerId }) => ownerId === 'caster-a')
  const firstB = state.primarySpells.transients.filter(({ ownerId }) => ownerId === 'caster-b')
  assert.deepEqual(firstA.map(({ direction }) => direction), firstB.map(({ direction }) => direction))

  state = stepGameSimulationTick(state, heldInputs())
  const secondA = state.primarySpells.transients
    .filter(({ ageTicks, ownerId }) => ageTicks === 1 && ownerId === 'caster-a')
  const secondB = state.primarySpells.transients
    .filter(({ ageTicks, ownerId }) => ageTicks === 1 && ownerId === 'caster-b')
  assert.deepEqual(secondA.map(({ direction }) => direction), secondB.map(({ direction }) => direction))
  assert.notDeepEqual(firstA[0].direction, secondA[0].direction)
})

test('Earth honors the native 0.3 latch and releases the same actor at age 98', () => {
  let state = step(simulation('earth'), true)
  const created = state.primarySpells.projectiles[0]
  const player = getPlayerCharacter(state, PLAYER_ID)
  assert.equal(created.kind, 'earth')
  assert.equal(created.phase, 'held')
  assert.equal(created.ageTicks, 1)
  assert.equal(created.flightTicks, 0)
  assert.equal(created.charge, PRIMARY_SPELL_EARTH_FIRST_TICK_CHARGE)
  assert.equal(created.assemblyCharge, PRIMARY_SPELL_EARTH_INITIAL_CHARGE)
  assert.deepEqual(
    created.orientation,
    earthBoulderHeldOrientationStep(EARTH_BOULDER_IDENTITY_ORIENTATION, created.direction),
  )
  assert.equal(created.position.x, player.position.x - 32.5)
  assert.equal(created.position.y, player.position.y - 51.5)
  state = step(state, true)
  const constantPose = state.primarySpells.projectiles[0]
  assert.equal(constantPose.ageTicks, 2)
  assert.equal(constantPose.charge, earthChargeAfter(2))
  assert.equal(constantPose.assemblyCharge, PRIMARY_SPELL_EARTH_INITIAL_CHARGE)
  assert.deepEqual(
    constantPose.orientation,
    earthBoulderHeldOrientationStep(created.orientation, constantPose.direction),
  )
  assert.equal(constantPose.position.x, player.position.x + 8.5)
  assert.equal(constantPose.position.y, player.position.y - 41)
  assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.actionTick, 1)

  state = step(state, false, 95)
  const thresholdRow = state.primarySpells.projectiles[0]
  assert.equal(thresholdRow.ageTicks, 97)
  assert.equal(thresholdRow.charge, earthChargeAfter(97))
  assert.equal(thresholdRow.charge, 0.3012498915195465)
  assert.equal(thresholdRow.assemblyCharge, thresholdRow.charge)
  assert.ok(thresholdRow.charge >= PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE)
  assert.equal(thresholdRow.phase, 'held')
  assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.channelActive, true)

  state = step(state, false)
  const released = state.primarySpells.projectiles[0]
  assert.equal(released.id, created.id)
  assert.equal(released.phase, 'flight')
  assert.equal(released.velocity.y, -3)
  assert.equal(released.ageTicks, 98)
  assert.equal(released.flightTicks, 1)
  assert.equal(released.assemblyCharge, thresholdRow.assemblyCharge)
  assert.equal(released.damage, nativeEarthBoulderReleasedDamage(10, released.charge))
  const releaseDelta = {
    x: Math.fround(released.position.x - thresholdRow.position.x),
    y: Math.fround(released.position.y - thresholdRow.position.y),
  }
  assert.deepEqual(released.orientation, earthBoulderFlightOrientationStep(
    thresholdRow.orientation,
    released.direction,
    releaseDelta,
    released.charge,
  ))
  assert.notDeepEqual(released.orientation, thresholdRow.orientation)
  assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.emissionSequence, 1)
  assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.actionTick, -1)
  assert.equal(getPlayerCharacter(state, PLAYER_ID).primaryCast.channelActive, false)
})

test('Earth resamples world aim while held and freezes the last sample on release', () => {
  let state = step(simulation('earth'), true)
  const player = getPlayerCharacter(state, PLAYER_ID)
  const eastInput: PlayerCharacterInput = {
    ...createIdlePlayerCharacterInput(),
    aim: {
      x: player.position.x + 200,
      y: player.position.y - 25 / 1.2,
    },
    cast: { primary: true, quickbar: null },
  }
  state = stepGameSimulationTick(state, { [PLAYER_ID]: eastInput })
  const retargeted = state.primarySpells.projectiles[0]
  assert.deepEqual(retargeted.direction, { x: 1, y: 0 })
  assert.equal(getPlayerCharacter(state, PLAYER_ID).headingIndex, 6)

  state = step(state, false, 95)
  state = step(state, false)
  const released = state.primarySpells.projectiles[0]
  assert.deepEqual(released.direction, { x: 1, y: 0 })
  assert.deepEqual(released.velocity, { x: 3, y: 0 })

  const next = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    castAuthority: {
      [PLAYER_ID]: {
        availableMana: 1_000_000,
        eligible: true,
        primarySkill: primarySkillRankStats('earth', 1),
      },
    },
    inputs: { [PLAYER_ID]: input(state, false) },
    players: playerCharacterRecords(state.playerEntities),
    previousPlayers: playerCharacterRecords(state.playerEntities),
    spells: state.primarySpells,
    tick: state.tick + 1,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  })
  const flying = next.spells.projectiles[0]
  assert.deepEqual(flying.direction, released.direction)
  assert.deepEqual(flying.velocity, released.velocity)
  assert.notDeepEqual(flying.orientation, released.orientation)
})

test('Earth preserves long-held age and has no fixed flight range or timeout', () => {
  let state = step(simulation('earth'), true, 170)
  let boulder = state.primarySpells.projectiles[0]
  assert.equal(boulder.ageTicks, 170)
  assert.equal(boulder.flightTicks, 0)
  assert.equal(boulder.charge, 0.39249980449676514)
  assert.equal(boulder.phase, 'held')
  state = step(state, false)
  boulder = state.primarySpells.projectiles[0]
  assert.equal(boulder.ageTicks, 171)
  assert.equal(boulder.flightTicks, 1)
  assert.equal(boulder.phase, 'flight')

  state = step(simulation('earth'), true, 656)
  boulder = state.primarySpells.projectiles[0]
  assert.equal(boulder.ageTicks, 656)
  assert.equal(boulder.flightTicks, 0)
  assert.equal(boulder.charge, 1)
  assert.equal(boulder.phase, 'held')
  const projectedPlayers = playerCharacterRecords(state.playerEntities)
  const releaseResult = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => true,
    castAuthority: {
      [PLAYER_ID]: {
        availableMana: 1_000_000,
        eligible: true,
        primarySkill: primarySkillRankStats('earth', 1),
      },
    },
    inputs: { [PLAYER_ID]: input(state, false) },
    players: projectedPlayers,
    previousPlayers: projectedPlayers,
    spells: state.primarySpells,
    tick: state.tick + 1,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  })
  let spells = releaseResult.spells
  let players = releaseResult.players
  let tick = state.tick + 1
  const containmentStep = () => {
    tick += 1
    const result = stepPrimarySpells({
      ...EMPTY_SPELL_WORLD,
      canPlaceProjectile: () => true,
      canTraverseProjectile: () => true,
      castAuthority: {
        [PLAYER_ID]: {
          availableMana: 1_000_000,
          eligible: true,
          primarySkill: primarySkillRankStats('earth', 1),
        },
      },
      inputs: { [PLAYER_ID]: input(state, false) },
      players,
      previousPlayers: players,
      spells,
      tick,
      viewScale: 1.2,
      worldKeyForPlayer: () => 'hub:courtyard',
    })
    players = result.players
    spells = result.spells
  }
  for (let flightTick = 1; flightTick <= 510; flightTick += 1) {
    containmentStep()
  }
  assert.equal(spells.projectiles.length, 1)
  assert.equal(spells.projectiles[0].flightTicks, 511)
  assert.equal(spells.transients.some((effect) => effect.kind === 'earth-impact'), false)
})

test('Earth publishes one authoritative breakup when its next flight position contacts terrain', () => {
  let state = step(simulation('earth'), true, 97)
  state = step(state, false)
  const released = state.primarySpells.projectiles[0]
  const checked: { position: { x: number, y: number }, radius: number }[] = []
  const projectedPlayers = playerCharacterRecords(state.playerEntities)
  let collisionOrientation: readonly number[] | null = null
  const result = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: (spell, position, radius) => {
      checked.push({ position, radius })
      if (spell.kind === 'earth') collisionOrientation = spell.orientation
      return false
    },
    canTraverseProjectile: () => true,
    castAuthority: {
      [PLAYER_ID]: {
        availableMana: 1_000_000,
        eligible: true,
        primarySkill: primarySkillRankStats('earth', 1),
      },
    },
    inputs: { [PLAYER_ID]: input(state, false) },
    players: projectedPlayers,
    previousPlayers: projectedPlayers,
    spells: state.primarySpells,
    tick: state.tick + 1,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  })

  assert.deepEqual(checked, [{
    position: { x: released.position.x, y: released.position.y - 3 },
    radius: released.charge * 75,
  }])
  assert.equal(result.spells.projectiles.length, 0)
  assert.notDeepEqual(checked[0].position, released.position)
  assert.ok(collisionOrientation)
  assert.notDeepEqual(collisionOrientation, released.orientation)
  assert.deepEqual(collisionOrientation, earthBoulderFlightOrientationStep(
    released.orientation,
    released.direction,
    {
      x: Math.fround(checked[0].position.x - released.position.x),
      y: Math.fround(checked[0].position.y - released.position.y),
    },
    released.charge,
  ))
  const impact = result.spells.transients.find((effect) => effect.kind === 'earth-impact')
  assert.ok(impact)
  assert.deepEqual(impact, {
    ageTicks: 0,
    birthTick: state.tick + 1,
    charge: released.charge,
    id: impact.id,
    kind: 'earth-impact',
    lightRegistration: null,
    lifetimeTicks: earthImpactLifetimeTicks(impact),
    origin: checked[0].position,
    ownerId: PLAYER_ID,
    worldKey: 'hub:courtyard',
  })
})

test('Earth uses the native 45-charge release probe before normal 75-charge flight probes', () => {
  let state = step(simulation('earth'), true, 2)
  state = step(state, false, 95)
  const heldBoulder = state.primarySpells.projectiles[0]
  const checked: { position: { x: number, y: number }, radius: number }[] = []
  const projectedPlayers = playerCharacterRecords(state.playerEntities)
  const result = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: (_spell, position, radius) => {
      checked.push({ position, radius })
      return false
    },
    canTraverseProjectile: () => true,
    castAuthority: {
      [PLAYER_ID]: {
        availableMana: 1_000_000,
        eligible: true,
        primarySkill: primarySkillRankStats('earth', 1),
      },
    },
    inputs: { [PLAYER_ID]: input(state, false) },
    players: projectedPlayers,
    previousPlayers: projectedPlayers,
    spells: state.primarySpells,
    tick: state.tick + 1,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  })

  assert.deepEqual(checked, [{
    position: {
      x: Math.fround(heldBoulder.position.x),
      y: Math.fround(heldBoulder.position.y - 3),
    },
    radius: heldBoulder.charge * 45,
  }])
  assert.equal(result.spells.projectiles.length, 0)
  const impact = result.spells.transients.find((effect) => effect.kind === 'earth-impact')
  assert.ok(impact)
  assert.deepEqual(impact.origin, checked[0].position)
})

test('Earth called rocks are authoritative absolute actors under a moving parent', () => {
  let state = step(simulation('earth'), true)
  const born = state.primarySpells.transients.find((effect) => effect.kind === 'earth-called-rock')
  assert.ok(born)
  assert.equal(born.ageTicks, 0)
  assert.equal(born.parentId, state.primarySpells.projectiles[0].id)
  assert.equal(born.height, -2)
  assert.ok(born.targetHeight >= -40 - 30 * state.primarySpells.projectiles[0].charge)
  assert.ok(born.targetHeight < -35 - 30 * state.primarySpells.projectiles[0].charge)
  assert.ok(born.lateralMagnitude >= 0 && born.lateralMagnitude < 4)

  const player = getPlayerCharacter(state, PLAYER_ID)
  state = stepGameSimulationTick(state, { [PLAYER_ID]: {
    ...input(state, true),
    movement: { x: 1, y: 0 },
  } })
  const moved = state.primarySpells.transients.find((effect) => effect.id === born.id)
  assert.ok(moved?.kind === 'earth-called-rock')
  assert.equal(moved.ageTicks, 1)
  assert.notDeepEqual(moved.position, born.position)
  assert.notDeepEqual(moved.position, state.primarySpells.projectiles[0].position)
  assert.equal(moved.lateralMagnitude, born.lateralMagnitude)
  assert.equal(moved.rotationStep, born.rotationStep)
  assert.equal(moved.speed, Math.fround(Math.fround(0.1) * 1.100000023841858))
  assert.equal(moved.height, -3.5)
  assert.ok(getPlayerCharacter(state, PLAYER_ID).position.x > player.position.x)
})

test('Earth release switches existing called-rock identities to fall and teardown owns them', () => {
  let state = step(simulation('earth'), true, 97)
  const before = state.primarySpells.transients
    .filter((effect) => effect.kind === 'earth-called-rock')
  assert.ok(before.length > 0)
  state = step(state, false)
  const after = new Map(state.primarySpells.transients
    .filter((effect) => effect.kind === 'earth-called-rock')
    .map((effect) => [effect.id, effect]))
  for (const rock of before) {
    const released = after.get(rock.id)
    if (!released) continue
    assert.equal(released.falling, true)
    assert.deepEqual(released.position, rock.position)
  }
  const removed = removePrimarySpellOwner(state.primarySpells, PLAYER_ID)
  assert.equal(removed.projectiles.length, 0)
  assert.equal(removed.transients.length, 0)
})

test('pins native torso aim, Staff pose schedule, and observed socket banks', () => {
  assert.deepEqual(primarySpellAimDirection(
    { x: 100, y: 100 },
    { x: 100, y: 0 },
    1.2,
  ), { x: 0, y: -1 })
  assert.equal(primaryCastPose(-1), 0)
  assert.equal(primaryCastPose(2), 1)
  assert.equal(primaryCastPose(19), 8)
  assert.equal(primaryCastPose(37), 7)
  assert.equal(primaryCastPose(74), 0)
  assert.equal(primaryCastPose(15, false, 'ether'), 8)
  assert.equal(primaryCastPose(28, false, 'ether'), 7)
  assert.equal(primaryCastPose(56, false, 'ether'), 0)
  assert.equal(primaryCastPose(0, true), 0)
  assert.equal(primaryCastPose(1, true), 7)
  assert.equal(primaryCastPose(73, true), 7)
  assert.deepEqual(primarySpellEmitterOffset(0, 0), { x: -32.5, y: -66.5 })
  assert.deepEqual(primarySpellEmitterOffset(0, 2), { x: -41.5, y: 3.5 })
  assert.deepEqual(primarySpellEmitterOffset(0, 19), { x: 8.5, y: -47.5 })
  assert.deepEqual(primarySpellEmitterOffset(0, 15, false, 'ether'), { x: 8.5, y: -47.5 })
  assert.deepEqual(primarySpellEmitterOffset(19, 37), { x: -41.5, y: -34.5 })
  assert.deepEqual(primarySpellEmitterOffset(0, 1, true), { x: 8.5, y: -56 })
})
test('welded one-shot authority spends once at emission and creates the complete native fan', () => {
  const profile = weldedProfile(1000, 'one-shot', [4, 10, 12, 2, 1.25, 3, 8, 2, 3])
  let state = { ...directSpellHarness('ether'), primarySkill: profile }
  let stepped = stepSpellKernel(state, true, 100, true, () => true, profile)
  state = stepped.state
  assert.equal(stepped.manaSpent, 0)
  for (let tick = 1; tick <= PRIMARY_CAST_EMISSION_TICK; tick += 1) {
    stepped = stepSpellKernel(state, false, 100, true, () => true, profile)
    state = stepped.state
  }
  assert.equal(stepped.manaSpent, 12)
  assert.equal(state.players[PLAYER_ID]!.primaryCast.emissionSequence, 1)
  assert.deepEqual(state.spells.projectiles.map((spell) => spell.kind), ['weld', 'weld'])
  assert.deepEqual(state.spells.projectiles.map((spell) => (
    spell.kind === 'weld' ? spell.buildId : null
  )), [1000, 1000])
})

test('all welded sustained families use one latch and run their native release virtual', () => {
  for (const profile of [
    weldedProfile(1003, 'channel', [8, 10, 2, 0.5, 3, 10, 2, 3]),
    weldedProfile(1006, 'persistent', [8, 10, 2, 1.1, 1.5, 1.2]),
    weldedProfile(1007, 'persistent', [8, 16, 20, 1.1, 1.5, 3, 10, 2, 3]),
    weldedProfile(1008, 'persistent', [8, 10, 1.1, 1.5, 0.1, 0.5]),
  ] as const) {
    let state = { ...directSpellHarness('earth'), primarySkill: profile }
    const accepted = stepSpellKernel(state, true, 100, true, () => true, profile)
    state = accepted.state
    assert.equal(accepted.manaSpent, profile.manaCost / 100)
    assert.equal(state.players[PLAYER_ID]!.primaryCast.channelActive, true)
    assert.ok(state.spells.transients.some(({ kind }) => (
      kind === (profile.castKind === 'channel' ? 'weld-channel' : 'weld-persistent')
    )))
    state = stepSpellKernel(state, false, 100, true, () => true, profile).state
    assert.equal(state.players[PLAYER_ID]!.primaryCast.channelActive, false)
    const persistent = state.spells.transients.filter((effect) => (
      effect.kind === 'weld-persistent'
    ))
    if (profile.buildId === 1006) {
      assert.equal(persistent.length, 2)
      assert.ok(persistent.every((effect) => effect.phase === 'flight'))
    } else if (profile.buildId === 1008) {
      assert.equal(persistent.length, 1)
      assert.equal(persistent[0]!.phase, 'flight')
    } else {
      assert.equal(persistent.length, 0)
    }
  }
})

test('Flame Lash emission owns the independent six-word endpoint fade', () => {
  const profile = weldedProfile(1003, 'channel', [8, 10, 2, 0.5, 3, 10, 2, 3])
  const source = { ...directSpellHarness('earth'), primarySkill: profile }
  const result = stepSpellKernel(source, true, 100, true, () => true, profile).state
  const fade = result.spells.transients.find(({ kind }) => kind === 'weld-flame-lash-fade')
  assert.ok(fade?.kind === 'weld-flame-lash-fade')
  assert.equal(fade.variant, 'endpoint')
  assert.equal(fade.record, 35)
  assert.deepEqual(result.rng, advanceNativeRngWords(source.rng, 6))
})

test('Blizzard emission owns its two-glow four-word program and no endpoint extras', () => {
  const profile = weldedProfile(1004, 'channel', [8, 10, 1, 0.5, 0, 0, 0])
  const source = { ...directSpellHarness('earth'), primarySkill: profile }
  const result = stepSpellKernel(source, true, 100, true, () => true, profile).state
  const glows = result.spells.transients.filter(({ kind }) => kind === 'weld-blizzard-glow')
  assert.equal(glows.length, 2)
  assert.ok(glows.every((glow) => glow.kind === 'weld-blizzard-glow' && glow.variant === 24))
  assert.deepEqual(result.rng, advanceNativeRngWords(source.rng, 4))
})

test('released Hail terrain obstruction replaces its carrier with every native child actor', () => {
  const profile = weldedProfile(1008, 'persistent', [8, 10, 1.1, 1.5, 0.1, 0.5])
  let state = { ...directSpellHarness('earth'), primarySkill: profile }
  state = stepSpellKernel(state, true, 100, true, () => true, profile).state
  state = stepSpellKernel(state, true, 100, true, () => true, profile).state
  state = stepSpellKernel(state, false, 100, true, () => true, profile).state
  const hail = state.spells.transients.find((effect) => (
    effect.kind === 'weld-persistent' && effect.buildId === 1008
  ))
  assert.ok(hail?.kind === 'weld-persistent' && hail.buildId === 1008)
  assert.equal(hail.phase, 'flight')
  const rockCount = hail.rocks.length
  assert.ok(rockCount > 0)
  const sourceRng = state.rng
  const player = state.players[PLAYER_ID]!
  const stepped = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    castAuthority: {
      [PLAYER_ID]: {
        availableMana: 100,
        castProgressFactor: 1,
        eligible: true,
        primarySkill: profile,
      },
    },
    inputs: { [PLAYER_ID]: createIdlePlayerCharacterInput() },
    players: state.players,
    previousPlayers: state.players,
    rng: sourceRng,
    spellObstructionPoint: () => ({ x: player.position.x, y: player.position.y }),
    spells: state.spells,
    tick: state.tick + 1,
    viewScale: 1.35,
    worldKeyForPlayer: () => 'hub:courtyard',
  })
  assert.equal(stepped.spells.transients.some((effect) => (
    effect.kind === 'weld-persistent' && effect.buildId === 1008
  )), false)
  assert.equal(stepped.spells.transients.filter(({ kind }) => (
    kind === 'weld-hail-terrain-particle'
  )).length, rockCount * 15)
  assert.equal(stepped.spells.transients.filter(({ kind }) => (
    kind === 'weld-hail-terrain-bouncer'
  )).length, rockCount)
  assert.deepEqual(stepped.rng, advanceNativeRngWords(sourceRng, rockCount * 83))
})

test('Meteor Swarm emits Iceblast every tick and keys Meteors to selected-primary age', () => {
  const profile = weldedProfile(1007, 'persistent', [8, 16, 20, 1.1, 1.5, 3, 10, 2, 3])
  let state = { ...directSpellHarness('earth'), primarySkill: profile }
  state = stepSpellKernel(state, true, 100, true, () => true, profile).state
  assert.equal(state.players[PLAYER_ID]!.primaryCast.selectedPrimaryAgeTicks, 0)
  assert.equal(state.spells.transients.filter(({ kind }) => (
    kind === 'weld-meteor-marker'
  )).length, 1)
  assert.equal(state.spells.transients.some(({ kind }) => kind === 'weld-meteor'), false)

  state = stepSpellKernel(state, true, 100, true, () => true, profile).state
  assert.equal(state.players[PLAYER_ID]!.primaryCast.selectedPrimaryAgeTicks, 1)
  assert.equal(state.spells.transients.filter(({ kind }) => (
    kind === 'weld-meteor-marker'
  )).length, 2)
  const meteor = state.spells.transients.find(({ kind }) => kind === 'weld-meteor')
  assert.ok(meteor?.kind === 'weld-meteor')
  assert.equal(meteor.underpowered, false)
  assert.equal(meteor.impactTicksRemaining, 275)
  assert.ok(meteor.position.x !== state.players[PLAYER_ID]!.position.x)
  assert.deepEqual(state.rng, advanceNativeRngWords(createNativeRng(0), 17))

  let weak = { ...directSpellHarness('earth'), primarySkill: profile }
  weak = stepSpellKernel(weak, true, 0, true, () => true, profile).state
  weak = stepSpellKernel(weak, true, 0, true, () => true, profile).state
  const weakMeteor = weak.spells.transients.find(({ kind }) => kind === 'weld-meteor')
  assert.ok(weakMeteor?.kind === 'weld-meteor')
  assert.equal(weakMeteor.underpowered, true)
  assert.equal(weakMeteor.privateSeed, 0)
  assert.deepEqual(weakMeteor.vector.slice(5), [0, 0, 0, 0])
  assert.deepEqual(weak.rng, advanceNativeRngWords(createNativeRng(0), 16))
})

test('Meteor impact transition registers its additive flash as an independent actor', () => {
  const harness = directSpellHarness('earth')
  const meteor = createNativeWeldMeteor({
    bodyScale: 1,
    damage: 8,
    direction: { x: 0, y: -1 },
    fallHeadingDegrees: 0,
    fallHeight: Math.fround(0.01),
    fallStep: Math.fround(0.02),
    id: 9,
    impactTicks: 200,
    origin: { x: 100, y: 200 },
    ownerId: PLAYER_ID,
    position: { x: 100, y: 200 },
    privateSeed: 1,
    tick: 1,
    underpowered: false,
    vector: [8, 8, 2, 1, 1, 0, 0, 0, 0],
    worldKey: 'hub:courtyard',
  })
  const result = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    castAuthority: {
      [PLAYER_ID]: {
        availableMana: 100,
        castProgressFactor: 1,
        eligible: true,
        primarySkill: harness.primarySkill,
      },
    },
    inputs: { [PLAYER_ID]: createIdlePlayerCharacterInput() },
    players: harness.players,
    previousPlayers: harness.players,
    rng: createNativeRng(8),
    spells: { nextId: 20, projectiles: [], transients: [meteor] },
    tick: 2,
    viewScale: 1.35,
    worldKeyForPlayer: () => 'hub:courtyard',
  })
  const impacted = result.spells.transients.find(({ kind }) => kind === 'weld-meteor')
  const flash = result.spells.transients.find(({ kind }) => kind === 'weld-meteor-flash')
  assert.ok(impacted?.kind === 'weld-meteor' && impacted.phase === 'impact')
  assert.ok(flash?.kind === 'weld-meteor-flash')
  assert.equal(flash.id, 20)
  assert.equal(flash.alpha, 2)
  assert.equal(flash.scale, 6)
  const debris = result.spells.transients.filter(({ kind }) => kind === 'weld-boulder-debris')
  assert.equal(debris.length, 5)
  assert.ok(debris.every((child) => child.kind === 'weld-boulder-debris'
    && child.buildId === 1007))
})

test('retained rock welds publish their constructor-randomized start pitch', () => {
  for (const profile of [
    weldedProfile(1006, 'persistent', [8, 10, 2, 1.1, 1.5, 1.2]),
    weldedProfile(1008, 'persistent', [8, 10, 1.1, 1.5, 0.1, 0.5]),
  ] as const) {
    const state = { ...directSpellHarness('earth'), primarySkill: profile }
    const pitch = drawNativeFloat(state.rng, Math.fround(0.5))
    const stepped = stepSpellKernel(state, true, 100, true, () => true, profile).state
    assert.equal(
      stepped.players[PLAYER_ID]!.primaryCast.lastWeldPlaybackRate,
      Math.fround(1.5 - pitch.value),
    )
    assert.deepEqual(stepped.rng, pitch.state)
  }
})

function weldedProfile(
  buildId: 1000 | 1003 | 1006 | 1007 | 1008,
  castKind: 'channel' | 'one-shot' | 'persistent',
  values: readonly number[],
): Extract<NativePrimarySkillProfile, { kind: 'weld' }> {
  const manaIndex = castKind === 'one-shot' ? 2 : 1
  return {
    buildId,
    castKind,
    damageFactor: 1,
    damageMaximum: buildId === 1000 || buildId === 1007 ? values[1]! : values[0]!,
    damageMinimum: values[0]!,
    damageRollCount: 1,
    kind: 'weld',
    manaCost: values[manaIndex]!,
    rank: 1,
    skillId: buildId,
    vector: { buildId, castKind, values },
  }
}

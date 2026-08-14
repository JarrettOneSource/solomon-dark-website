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
  createPrimarySpellSimulation,
  PRIMARY_CAST_EMISSION_TICK,
  PRIMARY_CAST_ETHER_ACTION_END_TICK,
  PRIMARY_CAST_ETHER_EMISSION_TICK,
  PRIMARY_SPELL_EARTH_CHARGE_STEP,
  PRIMARY_SPELL_EARTH_FIRST_TICK_CHARGE,
  PRIMARY_SPELL_EARTH_INITIAL_CHARGE,
  PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE,
  PRIMARY_SPELL_FIRE_IMPACT_LIFETIME_TICKS,
  PRIMARY_SPELL_POC_FLIGHT_LIFETIME_TICKS,
  PRIMARY_SPELL_RANK_ONE_MANA_COSTS,
  primaryCastActionEndTick,
  primaryCastEmissionTick,
  primaryCastPose,
  primarySpellAimDirection,
  primarySpellEmitterOffset,
  removePrimarySpellOwner,
  stepPrimarySpells,
  type PrimarySpellSimulationState,
} from './primary-spells.ts'
import { earthImpactLifetimeTicks } from './primary-spell-earth.ts'
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

const PLAYER_ID = 'caster'
const EMPTY_SPELL_WORLD = {
  canTraverseProjectile: () => true,
  castAuthority: {
    [PLAYER_ID]: { availableMana: 1_000_000, eligible: true },
  },
  spellObstructionPoint: () => null,
  spellRangeEndpoint: (
    _ownerId: string,
    start: { x: number; y: number },
    direction: { x: number; y: number },
  ) => ({ x: start.x + direction.x * 2_000, y: start.y + direction.y * 2_000 }),
  spellTargets: () => [],
} as const

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
    cast: { primary, secondary: false },
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
  spells: PrimarySpellSimulationState
  tick: number
}

function directSpellHarness(element: WizardElement): DirectSpellHarness {
  const state = simulation(element)
  return {
    players: { [PLAYER_ID]: getPlayerCharacter(state, PLAYER_ID) },
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
): { manaSpent: number, state: DirectSpellHarness } {
  const player = state.players[PLAYER_ID]!
  const result = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile,
    castAuthority: {
      [PLAYER_ID]: { availableMana, eligible },
    },
    inputs: {
      [PLAYER_ID]: {
        ...createIdlePlayerCharacterInput(),
        aim: { x: player.position.x, y: player.position.y - 200 },
        cast: { primary, secondary: false },
      },
    },
    players: state.players,
    previousPlayers: state.players,
    spells: state.spells,
    tick: state.tick + 1,
    viewScale: 1.35,
    worldKeyForPlayer: () => 'boneyard:test',
  })
  return {
    manaSpent: result.manaSpent[PLAYER_ID]!,
    state: { players: result.players, spells: result.spells, tick: state.tick + 1 },
  }
}

test('rank-one one-shot casts debit once on acceptance and reject unaffordable presses', () => {
  let ether = directSpellHarness('ether')
  let outcome = stepSpellKernel(ether, true, PRIMARY_SPELL_RANK_ONE_MANA_COSTS.ether)
  ether = outcome.state
  assert.equal(outcome.manaSpent, 6)
  assert.equal(ether.players[PLAYER_ID]!.primaryCast.castSequence, 1)

  for (let tick = 0; tick < PRIMARY_CAST_EMISSION_TICK; tick += 1) {
    outcome = stepSpellKernel(ether, true, 0)
    ether = outcome.state
    assert.equal(outcome.manaSpent, 0)
  }
  assert.equal(ether.spells.projectiles.length, 1)
  assert.equal(ether.spells.projectiles[0]!.kind, 'ether')

  let fire = directSpellHarness('fire')
  outcome = stepSpellKernel(fire, true, PRIMARY_SPELL_RANK_ONE_MANA_COSTS.fire)
  fire = outcome.state
  assert.equal(outcome.manaSpent, 12)
  assert.equal(fire.players[PLAYER_ID]!.primaryCast.castSequence, 1)

  const rejected = stepSpellKernel(
    directSpellHarness('fire'),
    true,
    PRIMARY_SPELL_RANK_ONE_MANA_COSTS.fire - 0.001,
  )
  assert.equal(rejected.manaSpent, 0)
  assert.equal(rejected.state.players[PLAYER_ID]!.primaryCast.actionTick, -1)
  assert.equal(rejected.state.players[PLAYER_ID]!.primaryCast.castSequence, 0)
  assert.equal(rejected.state.spells.projectiles.length, 0)
})

test('an unaffordable held press stays rejected and cannot emit later for free', () => {
  let state = stepSpellKernel(directSpellHarness('ether'), true, 5).state
  for (let tick = 0; tick < PRIMARY_CAST_EMISSION_TICK + 10; tick += 1) {
    const outcome = stepSpellKernel(state, true, 100)
    assert.equal(outcome.manaSpent, 0)
    state = outcome.state
  }
  const player = state.players[PLAYER_ID]!
  assert.equal(player.primaryCast.actionTick, -1)
  assert.equal(player.primaryCast.castSequence, 0)
  assert.equal(player.primaryCast.emissionSequence, 0)
  assert.equal(state.spells.projectiles.length, 0)
})

test('Air and Water debit every emitted channel tick and stop at exhaustion', () => {
  for (const [element, startingMana] of [
    ['air', 0.24],
    ['water', 0.25],
  ] as const) {
    const cost = PRIMARY_SPELL_RANK_ONE_MANA_COSTS[element]
    let availableMana = startingMana
    let totalSpent = 0
    let state = directSpellHarness(element)

    for (let tick = 0; tick < 3; tick += 1) {
      const outcome = stepSpellKernel(state, true, availableMana)
      state = outcome.state
      availableMana -= outcome.manaSpent
      totalSpent += outcome.manaSpent
    }

    assert.equal(totalSpent, cost * 2)
    assert.equal(state.spells.transients.length, element === 'water' ? 4 : 2)
    assert.equal(state.players[PLAYER_ID]!.primaryCast.channelActive, false)
    assert.equal(state.players[PLAYER_ID]!.primaryCast.actionTick, -1)
  }
})

test('Earth debits each charging tick and cancels below its release gate at exhaustion', () => {
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
  assert.ok(heldBoulder.charge < PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE)

  const exhausted = stepSpellKernel(state, true, availableMana)
  state = exhausted.state
  assert.equal(exhausted.manaSpent, 0)
  assert.equal(state.spells.projectiles.length, 0)
  assert.equal(state.players[PLAYER_ID]!.primaryCast.channelActive, false)
  assert.equal(state.players[PLAYER_ID]!.primaryCast.actionTick, -1)
  assert.equal(state.players[PLAYER_ID]!.primaryCast.emissionSequence, 0)
})

test('Earth mana exhaustion runs an eligible release through the terrain probe', () => {
  const cost = PRIMARY_SPELL_RANK_ONE_MANA_COSTS.earth
  let state = directSpellHarness('earth')
  do {
    state = stepSpellKernel(state, true, cost).state
  } while (state.spells.projectiles[0]!.charge < PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE)

  const exhausted = stepSpellKernel(state, true, 0, true, () => false)

  assert.equal(exhausted.manaSpent, 0)
  assert.equal(exhausted.state.spells.projectiles.length, 0)
  assert.equal(
    exhausted.state.spells.transients.some((effect) => effect.kind === 'earth-impact'),
    true,
  )
  assert.equal(exhausted.state.players[PLAYER_ID]!.primaryCast.channelActive, false)
  assert.equal(exhausted.state.players[PLAYER_ID]!.primaryCast.emissionSequence, 1)
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

test('Ether snapshots the forward-probe target and steers after its first movement', () => {
  const initial = simulation('ether')
  const player = getPlayerCharacter(initial, PLAYER_ID)
  const target: PrimarySpellTarget = {
    airPriority: 0,
    attachment: { x: 0, y: 0 },
    id: 'enemy:41',
    kind: 'enemy',
    position: { x: player.position.x + 100, y: player.position.y - 140 },
  }
  let players = playerCharacterRecords(initial.playerEntities)
  let previousPlayers = playerCharacterRecords(initial.playerEntities)
  let spells = initial.primarySpells
  for (let tick = 1; tick <= PRIMARY_CAST_ETHER_EMISSION_TICK + 1; tick += 1) {
    const result = stepPrimarySpells({
      ...EMPTY_SPELL_WORLD,
      canPlaceProjectile: () => true,
      canTraverseProjectile: () => true,
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

  const lost = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => true,
    inputs: {},
    players: {},
    previousPlayers: {},
    spells: { nextId: spells.nextId, projectiles: [advanced], transients: [] },
    tick: PRIMARY_CAST_ETHER_EMISSION_TICK + 3,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  }).spells.projectiles[0]
  assert.equal(lost.kind, 'ether')
  assert.equal(lost.targetId, null)

  const noRankOneRetarget = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: () => true,
    canTraverseProjectile: () => true,
    inputs: {},
    players: {},
    previousPlayers: {},
    spellTargets: () => [target],
    spells: { nextId: spells.nextId, projectiles: [lost], transients: [] },
    tick: PRIMARY_CAST_ETHER_EMISSION_TICK + 4,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  }).spells.projectiles[0]
  assert.equal(noRankOneRetarget.kind, 'ether')
  assert.equal(noRankOneRetarget.targetId, null)
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
  assert.equal(state.primarySpells.transients.length, 1)
  assert.deepEqual(state.primarySpells.transients[0], {
    ageTicks: 0,
    direction: { x: 0, y: -1 },
    id: 2,
    kind: 'fire',
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
    origin: probes[0].to,
    ownerId: PLAYER_ID,
    worldKey: 'hub:courtyard',
  }])
})

test('Fire terrain lookahead contacts before movement and emits no final particle', () => {
  const fireball = {
    ageTicks: 5,
    charge: 1,
    direction: { x: 1, y: 0 },
    flightTicks: 5,
    id: 1,
    kind: 'fire',
    ownerId: PLAYER_ID,
    phase: 'flight',
    position: { x: 100, y: 200 },
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

test('Fire has no distance or PoC flight-time range cap', () => {
  const ageTicks = PRIMARY_SPELL_POC_FLIGHT_LIFETIME_TICKS + 5
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
        id: 1,
        kind: 'fire',
        ownerId: PLAYER_ID,
        phase: 'flight',
        position: { x: 100, y: 200 },
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
      cast: { primary, secondary: false },
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
  assert.equal(born.filter(({ obstructionPoint }) => obstructionPoint !== null).length, 1)
  assert.equal(born.find(({ id }) => id === 2)?.obstructionPoint?.y, 0)
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
      cast: { primary: true, secondary: false },
    }]),
  )

  state = stepGameSimulationTick(state, heldInputs())
  const firstA = state.primarySpells.transients.filter(({ ownerId }) => ownerId === 'caster-a')
  const firstB = state.primarySpells.transients.filter(({ ownerId }) => ownerId === 'caster-b')
  assert.deepEqual(firstA.map(({ direction }) => direction), firstB.map(({ direction }) => direction))

  state = stepGameSimulationTick(state, heldInputs())
  const secondA = state.primarySpells.transients
    .filter(({ ageTicks, ownerId }) => ageTicks === 0 && ownerId === 'caster-a')
  const secondB = state.primarySpells.transients
    .filter(({ ageTicks, ownerId }) => ageTicks === 0 && ownerId === 'caster-b')
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
  assert.equal(created.position.x, player.position.x - 32.5)
  assert.equal(created.position.y, player.position.y - 51.5)
  state = step(state, true)
  const constantPose = state.primarySpells.projectiles[0]
  assert.equal(constantPose.ageTicks, 2)
  assert.equal(constantPose.charge, earthChargeAfter(2))
  assert.equal(constantPose.assemblyCharge, PRIMARY_SPELL_EARTH_INITIAL_CHARGE)
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
    cast: { primary: true, secondary: false },
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
    castAuthority: { [PLAYER_ID]: { availableMana: 1_000_000, eligible: true } },
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
      castAuthority: { [PLAYER_ID]: { availableMana: 1_000_000, eligible: true } },
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
  const result = stepPrimarySpells({
    ...EMPTY_SPELL_WORLD,
    canPlaceProjectile: (_spell, position, radius) => {
      checked.push({ position, radius })
      return false
    },
    canTraverseProjectile: () => true,
    castAuthority: { [PLAYER_ID]: { availableMana: 1_000_000, eligible: true } },
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
  const impact = result.spells.transients.find((effect) => effect.kind === 'earth-impact')
  assert.ok(impact)
  assert.deepEqual(impact, {
    ageTicks: 0,
    birthTick: state.tick + 1,
    charge: released.charge,
    id: impact.id,
    kind: 'earth-impact',
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
    castAuthority: { [PLAYER_ID]: { availableMana: 1_000_000, eligible: true } },
    inputs: { [PLAYER_ID]: input(state, false) },
    players: projectedPlayers,
    previousPlayers: projectedPlayers,
    spells: state.primarySpells,
    tick: state.tick + 1,
    viewScale: 1.2,
    worldKeyForPlayer: () => 'hub:courtyard',
  })

  assert.deepEqual(checked, [{
    position: { x: heldBoulder.position.x, y: heldBoulder.position.y - 3 },
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

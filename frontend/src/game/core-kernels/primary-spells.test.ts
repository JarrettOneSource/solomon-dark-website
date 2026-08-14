import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createIdlePlayerCharacterInput,
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
  type WizardElement,
} from './player-character.ts'
import {
  PRIMARY_CAST_ACTION_END_TICK,
  PRIMARY_CAST_EMISSION_TICK,
  PRIMARY_SPELL_EARTH_CHARGE_STEP,
  PRIMARY_SPELL_EARTH_FIRST_TICK_CHARGE,
  PRIMARY_SPELL_EARTH_INITIAL_CHARGE,
  PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE,
  primaryCastPose,
  primarySpellAimDirection,
  primarySpellEmitterOffset,
  removePrimarySpellOwner,
  stepPrimarySpells,
} from './primary-spells.ts'
import { earthImpactLifetimeTicks } from './primary-spell-earth.ts'
import {
  nativeFireParticleLifetimeTicks,
  nativeFireParticleVariant,
} from './primary-spell-fire-native.ts'
import {
  createGameSimulation,
  stepGameSimulationTick,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'

const PLAYER_ID = 'caster'

function simulation(element: WizardElement): GameSimulationState {
  const config: PlayerCharacterConfig = {
    discipline: 'arcane',
    displayName: 'Caster',
    element,
  }
  return createGameSimulation({ [PLAYER_ID]: config })
}

function input(state: GameSimulationState, primary: boolean): PlayerCharacterInput {
  const player = state.players[PLAYER_ID]
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

test('Ether emits one native Magic Missile at Staff Cast 1 marker tick', () => {
  let state = step(simulation('ether'), true)
  assert.equal(state.players[PLAYER_ID].primaryCast.actionTick, 0)
  assert.equal(state.primarySpells.projectiles.length, 0)
  state = step(state, true, 19)
  const player = state.players[PLAYER_ID]
  const missile = state.primarySpells.projectiles[0]
  assert.equal(player.primaryCast.actionTick, 19)
  assert.equal(player.primaryCast.emissionSequence, 1)
  assert.equal(primaryCastPose(player.primaryCast.actionTick), 8)
  assert.equal(missile.kind, 'ether')
  assert.equal(missile.ageTicks, 1)
  assert.equal(missile.velocity.x, 0)
  assert.equal(missile.velocity.y, -3)
  assert.equal(missile.position.x, player.position.x + 8.5)
  assert.equal(missile.position.y, player.position.y - 40.5)
  state = step(state, true, 100)
  assert.equal(state.primarySpells.projectiles.length, 1)
  assert.equal(state.players[PLAYER_ID].primaryCast.emissionSequence, 1)
})

test('Fire emits its one 4.5-unit missile from the native pushed socket', () => {
  let state = step(simulation('fire'), true, 20)
  const player = state.players[PLAYER_ID]
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

test('one-shot casts retain accepted facing against movement through projectile birth', () => {
  for (const element of ['ether', 'fire'] as const) {
    let state = simulation(element)
    const start = state.players[PLAYER_ID]
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
    assert.equal(state.players[PLAYER_ID].headingIndex, 6)

    for (let tick = 0; tick < PRIMARY_CAST_EMISSION_TICK; tick += 1) {
      state = stepGameSimulationTick(state, { [PLAYER_ID]: castInput(false) })
    }

    const projectile = state.primarySpells.projectiles[0]
    assert.equal(state.players[PLAYER_ID].primaryCast.actionTick, PRIMARY_CAST_EMISSION_TICK)
    assert.equal(state.players[PLAYER_ID].headingIndex, 6)
    assert.ok(projectile.velocity.x > 0)
    assert.equal(projectile.velocity.y, 0)

    for (
      let tick = PRIMARY_CAST_EMISSION_TICK;
      tick < PRIMARY_CAST_ACTION_END_TICK;
      tick += 1
    ) {
      state = stepGameSimulationTick(state, { [PLAYER_ID]: castInput(false) })
    }
    assert.equal(state.players[PLAYER_ID].primaryCast.actionTick, -1)
    assert.equal(state.players[PLAYER_ID].headingIndex, 6)
    state = stepGameSimulationTick(state, { [PLAYER_ID]: castInput(false) })
    assert.equal(state.players[PLAYER_ID].headingIndex, 18)
  }
})

test('Air emits one presentation record per held tick for the five-tick contact fade', () => {
  let state = step(simulation('air'), true)
  let player = state.players[PLAYER_ID]
  assert.equal(player.primaryCast.channelActive, true)
  assert.equal(player.primaryCast.actionTick, 0)
  assert.equal(primaryCastPose(player.primaryCast.actionTick, true), 0)
  assert.equal(state.players[PLAYER_ID].primaryCast.castSequence, 1)
  assert.equal(state.primarySpells.transients.length, 1)
  assert.equal(state.primarySpells.transients[0].kind, 'air')
  assert.deepEqual(state.primarySpells.transients[0].origin, {
    x: player.position.x - 32.5,
    y: player.position.y - 66.5,
  })
  state = step(state, true)
  player = state.players[PLAYER_ID]
  assert.equal(player.primaryCast.actionTick, 1)
  assert.equal(primaryCastPose(player.primaryCast.actionTick, true), 7)
  assert.equal(state.primarySpells.transients.length, 2)
  assert.deepEqual(state.primarySpells.transients[1].origin, {
    x: player.position.x + 8.5,
    y: player.position.y - 56,
  })
  state = step(state, false)
  assert.equal(state.players[PLAYER_ID].primaryCast.channelActive, false)
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
  assert.equal(state.players[PLAYER_ID].primaryCast.actionTick, 1)
  assert.equal(primaryCastPose(1, true), 7)
  assert.equal(state.primarySpells.transients.length, 8)
  assert.deepEqual(
    state.primarySpells.transients.map((effect) => effect.variant),
    [0, 1, 0, 1, 0, 1, 0, 1],
  )
  state = step(state, false)
  assert.equal(state.players[PLAYER_ID].primaryCast.channelActive, false)
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
    Object.entries(state.players).map(([playerId, player]) => [playerId, {
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
  const player = state.players[PLAYER_ID]
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
  assert.equal(state.players[PLAYER_ID].primaryCast.actionTick, 1)

  state = step(state, false, 95)
  const thresholdRow = state.primarySpells.projectiles[0]
  assert.equal(thresholdRow.ageTicks, 97)
  assert.equal(thresholdRow.charge, earthChargeAfter(97))
  assert.equal(thresholdRow.charge, 0.3012498915195465)
  assert.equal(thresholdRow.assemblyCharge, thresholdRow.charge)
  assert.ok(thresholdRow.charge >= PRIMARY_SPELL_EARTH_MIN_RELEASE_CHARGE)
  assert.equal(thresholdRow.phase, 'held')
  assert.equal(state.players[PLAYER_ID].primaryCast.channelActive, true)

  state = step(state, false)
  const released = state.primarySpells.projectiles[0]
  assert.equal(released.id, created.id)
  assert.equal(released.phase, 'flight')
  assert.equal(released.velocity.y, -3)
  assert.equal(released.ageTicks, 98)
  assert.equal(released.flightTicks, 1)
  assert.equal(released.assemblyCharge, thresholdRow.assemblyCharge)
  assert.equal(state.players[PLAYER_ID].primaryCast.emissionSequence, 1)
  assert.equal(state.players[PLAYER_ID].primaryCast.actionTick, -1)
  assert.equal(state.players[PLAYER_ID].primaryCast.channelActive, false)
})

test('Earth resamples world aim while held and freezes the last sample on release', () => {
  let state = step(simulation('earth'), true)
  const player = state.players[PLAYER_ID]
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
  assert.equal(state.players[PLAYER_ID].headingIndex, 6)

  state = step(state, false, 95)
  state = step(state, false)
  const released = state.primarySpells.projectiles[0]
  assert.deepEqual(released.direction, { x: 1, y: 0 })
  assert.deepEqual(released.velocity, { x: 3, y: 0 })

  const next = stepPrimarySpells({
    canPlaceProjectile: () => true,
    inputs: { [PLAYER_ID]: input(state, false) },
    players: state.players,
    previousPlayers: state.players,
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
  const releaseResult = stepPrimarySpells({
    canPlaceProjectile: () => true,
    inputs: { [PLAYER_ID]: input(state, false) },
    players: state.players,
    previousPlayers: state.players,
    spells: state.primarySpells,
    tick: state.tick + 1,
    viewScale: 1.2,
    waterObstructionPoint: () => null,
    worldKeyForPlayer: () => 'hub:courtyard',
  })
  let spells = releaseResult.spells
  let players = releaseResult.players
  let tick = state.tick + 1
  const containmentStep = () => {
    tick += 1
    const result = stepPrimarySpells({
      canPlaceProjectile: () => true,
      inputs: { [PLAYER_ID]: input(state, false) },
      players,
      previousPlayers: players,
      spells,
      tick,
      viewScale: 1.2,
      waterObstructionPoint: () => null,
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
  const result = stepPrimarySpells({
    canPlaceProjectile: (_spell, position, radius) => {
      checked.push({ position, radius })
      return false
    },
    inputs: { [PLAYER_ID]: input(state, false) },
    players: state.players,
    previousPlayers: state.players,
    spells: state.primarySpells,
    tick: state.tick + 1,
    viewScale: 1.2,
    waterObstructionPoint: () => null,
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
  const result = stepPrimarySpells({
    canPlaceProjectile: (_spell, position, radius) => {
      checked.push({ position, radius })
      return false
    },
    inputs: { [PLAYER_ID]: input(state, false) },
    players: state.players,
    previousPlayers: state.players,
    spells: state.primarySpells,
    tick: state.tick + 1,
    viewScale: 1.2,
    waterObstructionPoint: () => null,
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

  const player = state.players[PLAYER_ID]
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
  assert.ok(state.players[PLAYER_ID].position.x > player.position.x)
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
  assert.equal(primaryCastPose(0, true), 0)
  assert.equal(primaryCastPose(1, true), 7)
  assert.equal(primaryCastPose(73, true), 7)
  assert.deepEqual(primarySpellEmitterOffset(0, 0), { x: -32.5, y: -66.5 })
  assert.deepEqual(primarySpellEmitterOffset(0, 2), { x: -41.5, y: 3.5 })
  assert.deepEqual(primarySpellEmitterOffset(0, 19), { x: 8.5, y: -47.5 })
  assert.deepEqual(primarySpellEmitterOffset(19, 37), { x: -41.5, y: -34.5 })
  assert.deepEqual(primarySpellEmitterOffset(0, 1, true), { x: 8.5, y: -56 })
})

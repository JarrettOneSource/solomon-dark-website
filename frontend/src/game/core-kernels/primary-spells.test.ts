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
  PRIMARY_SPELL_POC_FLIGHT_LIFETIME_TICKS,
  primaryCastPose,
  primarySpellAimDirection,
  primarySpellEmitterOffset,
} from './primary-spells.ts'
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
    assert.equal(state.players[PLAYER_ID].headingIndex, 18)
  }
})

test('Air emits one ten-tick procedural fade per held authority tick', () => {
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
  state = step(state, false, 9)
  assert.equal(state.primarySpells.transients.length, 0)
})

test('Water emits native-family Frost transients while held and lets them decay', () => {
  let state = step(simulation('water'), true, 4)
  assert.equal(state.players[PLAYER_ID].primaryCast.actionTick, 1)
  assert.equal(primaryCastPose(1, true), 7)
  assert.equal(state.primarySpells.transients.length, 4)
  assert.deepEqual(
    state.primarySpells.transients.map((effect) => effect.variant),
    [1, 2, 3, 0],
  )
  state = step(state, false)
  assert.equal(state.players[PLAYER_ID].primaryCast.channelActive, false)
  state = step(state, false, 29)
  assert.equal(state.primarySpells.transients.length, 3)
  state = step(state, false, 3)
  assert.equal(state.primarySpells.transients.length, 0)
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
  assert.equal(created.position.x, player.position.x - 32.5)
  assert.equal(created.position.y, player.position.y - 51.5)
  state = step(state, true)
  const constantPose = state.primarySpells.projectiles[0]
  assert.equal(constantPose.ageTicks, 2)
  assert.equal(constantPose.charge, earthChargeAfter(2))
  assert.equal(constantPose.position.x, player.position.x + 8.5)
  assert.equal(constantPose.position.y, player.position.y - 41)
  assert.equal(state.players[PLAYER_ID].primaryCast.actionTick, 1)

  state = step(state, false, 95)
  const thresholdRow = state.primarySpells.projectiles[0]
  assert.equal(thresholdRow.ageTicks, 97)
  assert.equal(thresholdRow.charge, earthChargeAfter(97))
  assert.equal(thresholdRow.charge, 0.3012498915195465)
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
  assert.equal(state.players[PLAYER_ID].primaryCast.emissionSequence, 1)
  assert.equal(state.players[PLAYER_ID].primaryCast.actionTick, -1)
  assert.equal(state.players[PLAYER_ID].primaryCast.channelActive, false)
})

test('Earth preserves long-held age and applies containment only after release', () => {
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
  state = step(state, false)
  state = step(state, false, PRIMARY_SPELL_POC_FLIGHT_LIFETIME_TICKS - 1)
  assert.equal(state.primarySpells.projectiles[0].flightTicks, 500)
  state = step(state, false)
  assert.equal(state.primarySpells.projectiles.length, 0)
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

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  coldSlowPlayer,
  createPlayerCombat,
  damagePlayer,
  dazzlePlayer,
  playerMovementScale,
  resetPlayerCombatForNewRun,
  stepPlayerCombatTick,
} from './player-combat.ts'

test('cold and dazzle are authoritative bounded counters with only native-supported movement effect', () => {
  const dazzled = dazzlePlayer(createPlayerCombat(), 50)
  assert.equal(playerMovementScale(dazzled), 1 / 50)
  let midpoint = dazzled
  for (let tick = 0; tick < 25; tick += 1) midpoint = stepPlayerCombatTick(midpoint).combat
  assert.equal(midpoint.dazzleTicksRemaining, 25)
  assert.equal(playerMovementScale(midpoint), 26 / 50)
  for (let tick = 0; tick < 25; tick += 1) midpoint = stepPlayerCombatTick(midpoint).combat
  assert.equal(midpoint.dazzleTicksRemaining, 0)
  assert.equal(playerMovementScale(midpoint), 1)

  const affected = dazzlePlayer(coldSlowPlayer(createPlayerCombat(), 3), 2)
  assert.equal(affected.coldSlowTicksRemaining, 3)
  assert.equal(affected.dazzleTicksRemaining, 2)
  assert.equal(playerMovementScale(affected), 0.49)

  const one = stepPlayerCombatTick(affected).combat
  assert.equal(one.coldSlowTicksRemaining, 2)
  assert.equal(one.dazzleTicksRemaining, 1)
  const two = stepPlayerCombatTick(one).combat
  assert.equal(two.dazzleTicksRemaining, 0)
  assert.equal(two.coldSlowTicksRemaining, 1)
})

test('cold/dazzle clear on death and on a new run', () => {
  const affected = dazzlePlayer(coldSlowPlayer(createPlayerCombat(), 30), 40)
  const lethal = damagePlayer(affected, 60)
  const dying = stepPlayerCombatTick(lethal).combat
  assert.equal(dying.lifeState, 'dying')
  assert.equal(dying.coldSlowTicksRemaining, 0)
  assert.equal(dying.dazzleTicksRemaining, 0)

  const reset = resetPlayerCombatForNewRun(affected)
  assert.equal(reset.coldSlowTicksRemaining, 0)
  assert.equal(reset.dazzleTicksRemaining, 0)
  assert.throws(() => coldSlowPlayer(affected, 1.5), /safe integer/)
})

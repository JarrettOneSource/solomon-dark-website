import assert from 'node:assert/strict'
import test from 'node:test'

import {
  coldSlowPlayer,
  createPlayerCombat,
  damagePlayer,
  dazzlePlayer,
  playerCollisionEnabled,
  playerCollisionEnabledAfterCombatTick,
  playerHitOverlayAlpha,
  playerMovementScale,
  poisonPlayer,
  resetPlayerCombatForNewRun,
  stepPlayerCombatTick,
} from './player-combat.ts'

test('direct damage owns the native 20-tick red redraw without changing poison presentation', () => {
  const initial = createPlayerCombat()
  const first = damagePlayer(initial, 5, 100)
  assert.equal(first.lastDamageTick, 100)
  assert.equal(playerHitOverlayAlpha(first, 100), 1)
  assert.equal(playerHitOverlayAlpha(first, 110), 0.5)
  assert.equal(playerHitOverlayAlpha(first, 120), 0)

  const refreshed = damagePlayer(first, 1, 115)
  assert.equal(refreshed.lastDamageTick, 115)
  assert.equal(playerHitOverlayAlpha(refreshed, 115), 1)
  assert.equal(playerHitOverlayAlpha(refreshed, 125), 0.5)

  const poisoned = stepPlayerCombatTick(poisonPlayer(initial, 2, 1)).combat
  assert.ok(poisoned.currentHealth < initial.currentHealth)
  assert.equal(poisoned.lastDamageTick, null)
  assert.equal(playerHitOverlayAlpha(poisoned, 1), 0)

  const overkillButLiving = damagePlayer(initial, 55, 200)
  assert.equal(overkillButLiving.lifeState, 'alive')
  assert.equal(playerHitOverlayAlpha(overkillButLiving, 200), 1)
  const lethal = damagePlayer(overkillButLiving, 5, 201)
  assert.equal(lethal.lifeState, 'lethal-pending')
  assert.equal(playerHitOverlayAlpha(lethal, 201), 0)
  const dying = stepPlayerCombatTick(lethal).combat
  assert.equal(dying.lastDamageTick, null)

  assert.equal(resetPlayerCombatForNewRun(refreshed).lastDamageTick, null)
  assert.throws(() => damagePlayer(initial, 1, 1.5), /safe integer/)
})

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
  const lethal = damagePlayer(affected, 60, 0)
  const dying = stepPlayerCombatTick(lethal).combat
  assert.equal(dying.lifeState, 'dying')
  assert.equal(dying.coldSlowTicksRemaining, 0)
  assert.equal(dying.dazzleTicksRemaining, 0)

  const reset = resetPlayerCombatForNewRun(affected)
  assert.equal(reset.coldSlowTicksRemaining, 0)
  assert.equal(reset.dazzleTicksRemaining, 0)
  assert.throws(() => coldSlowPlayer(affected, 1.5), /safe integer/)
})

test('native death tick 159 disables the player collision body', () => {
  const combat = createPlayerCombat()
  const dyingAt158 = {
    ...combat,
    deathTick: 158,
    lifeState: 'dying' as const,
  }

  assert.equal(playerCollisionEnabled(combat), true)
  assert.equal(playerCollisionEnabledAfterCombatTick({
    ...combat,
    deathTick: 157,
    lifeState: 'dying',
  }), true)
  assert.equal(playerCollisionEnabled(dyingAt158), true)
  assert.equal(playerCollisionEnabledAfterCombatTick(dyingAt158), false)
  assert.equal(dyingAt158.deathTick, 158)
  assert.equal(dyingAt158.lifeState, 'dying')
  assert.equal(playerCollisionEnabled({
    ...combat,
    deathTick: 159,
    lifeState: 'dying',
  }), false)
  assert.equal(playerCollisionEnabled({
    ...combat,
    deathTick: 159,
    lifeState: 'spectating',
  }), false)
})

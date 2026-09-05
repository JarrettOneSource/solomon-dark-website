import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PLAYER_DEATH_FRAME_ONE_TICK,
  PLAYER_DEATH_FRAME_THREE_TICK,
  PLAYER_DEATH_FRAME_TWO_TICK,
  PLAYER_DEATH_PRESENTATION_DURATION_TICKS,
  PLAYER_DEATH_PRESENTATION_MAXIMUM_HELD_TICK,
  coldSlowPlayer,
  createPlayerCombat,
  damagePlayer,
  dazzlePlayer,
  playerCollisionEnabled,
  playerCollisionEnabledAfterCombatTick,
  playerDeathFrame,
  playerDeathPresentationTickAtAge,
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

test('poison stops at zero health and never becomes a lethal hit', () => {
  let player = poisonPlayer({ ...createPlayerCombat(), currentHealth: 0.05 }, 100, 3)
  for (let tick = 0; tick < 300; tick += 1) {
    player = stepPlayerCombatTick(player, { healthRecoveryPerTick: 0 }).combat
    assert.equal(player.currentHealth, 0)
    assert.equal(player.lifeState, 'alive')
  }
  assert.equal(player.poisonTicksRemaining, 0)
  const negative = stepPlayerCombatTick(poisonPlayer({
    ...createPlayerCombat(), currentHealth: -5,
  }, 100, 1), { healthRecoveryPerTick: 0 }).combat
  assert.equal(negative.currentHealth, -5)
  assert.equal(negative.lifeState, 'alive')
})

test('poison refresh keeps the strongest per-tick damage and longest remaining clock', () => {
  const first = poisonPlayer(createPlayerCombat(), 5, 10)
  const shorter = poisonPlayer(first, 10, 2)
  assert.equal(shorter.poisonTicksRemaining, 1_000)
  assert.equal(shorter.poisonDamagePerTick, Math.fround(0.1))
  const longer = poisonPlayer(shorter, 1, 15)
  assert.equal(longer.poisonTicksRemaining, 1_500)
  assert.equal(longer.poisonDamagePerTick, Math.fround(0.1))
})

test('fully resisted poison receives its native first callback before retirement', () => {
  const poisoned = poisonPlayer(createPlayerCombat(), 5, 0)
  assert.equal(poisoned.poisonTicksRemaining, 1)
  const stepped = stepPlayerCombatTick(poisoned, { healthRecoveryPerTick: 0 }).combat
  assert.equal(stepped.currentHealth, 50 - Math.fround(0.05))
  assert.equal(stepped.poisonTicksRemaining, 0)
  assert.equal(stepped.poisonDamagePerTick, 0)
})

test('cold and poison refresh, expiry, antidote order and new-run reset keep the material order', () => {
  const poisonFirst = coldSlowPlayer(poisonPlayer(createPlayerCombat(), 5, 2), 250)
  assert.equal(poisonFirst.poisonBeforeCold, true)
  assert.equal(poisonPlayer(poisonFirst, 5, 3).poisonBeforeCold, true)
  const coldFirst = poisonPlayer(coldSlowPlayer(createPlayerCombat(), 250), 5, 2)
  assert.equal(coldFirst.poisonBeforeCold, false)
  assert.equal(coldSlowPlayer(coldFirst, 350).poisonBeforeCold, false)
  const expired = stepPlayerCombatTick({ ...poisonFirst, poisonTicksRemaining: 1 }).combat
  assert.equal(poisonPlayer(expired, 5, 1).poisonBeforeCold, false)
  assert.equal(resetPlayerCombatForNewRun(poisonFirst).poisonBeforeCold, false)
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

test('base mana recovery clamps current mana to the native hoard ceiling', () => {
  const full = createPlayerCombat()
  assert.equal(stepPlayerCombatTick(full, { manaCeiling: 75 }).combat.currentMana, 75)
  assert.equal(stepPlayerCombatTick({ ...full, currentMana: 70 }, {
    manaCeiling: 75,
  }).combat.currentMana, 70.1)
  assert.equal(stepPlayerCombatTick({ ...full, currentMana: 75 }, {
    manaCeiling: 75,
  }).combat.currentMana, 75)
  assert.equal(stepPlayerCombatTick(full, { manaCeiling: 0 }).combat.currentMana, 0)
})

test('native death tick 159 disables the player collision body', () => {
  const combat = createPlayerCombat()
  const dyingAt158 = {
    ...combat,
    deathAgeTicks: 264,
    deathTick: 158,
    lifeState: 'dying' as const,
  }

  assert.equal(playerCollisionEnabled(combat), true)
  assert.equal(playerCollisionEnabledAfterCombatTick({
    ...combat,
    deathAgeTicks: 263,
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

test('MP death presentation scales 100 Hz age to the native clock and completes at five seconds', () => {
  assert.equal(playerDeathPresentationTickAtAge(0), 0)
  assert.equal(playerDeathPresentationTickAtAge(254), 152)
  assert.equal(playerDeathPresentationTickAtAge(255), PLAYER_DEATH_FRAME_ONE_TICK)
  assert.equal(playerDeathPresentationTickAtAge(260), PLAYER_DEATH_FRAME_TWO_TICK)
  assert.equal(playerDeathPresentationTickAtAge(265), PLAYER_DEATH_FRAME_THREE_TICK)
  assert.equal(
    playerDeathPresentationTickAtAge(PLAYER_DEATH_PRESENTATION_DURATION_TICKS - 1),
    PLAYER_DEATH_PRESENTATION_MAXIMUM_HELD_TICK,
  )
  assert.equal(
    playerDeathPresentationTickAtAge(PLAYER_DEATH_PRESENTATION_DURATION_TICKS),
    PLAYER_DEATH_PRESENTATION_MAXIMUM_HELD_TICK,
  )

  let combat = stepPlayerCombatTick(damagePlayer(createPlayerCombat(), 60, 10)).combat
  assert.equal(combat.lifeState, 'dying')
  assert.equal(combat.deathAgeTicks, 0)
  assert.equal(combat.deathTick, 0)

  let burstCount = 0
  for (let age = 1; age < PLAYER_DEATH_PRESENTATION_DURATION_TICKS; age += 1) {
    const result = stepPlayerCombatTick(combat)
    combat = result.combat
    burstCount += Number(result.emittedDeathBurst)
    assert.equal(result.completedDeathPresentation, false)
    assert.equal(combat.deathAgeTicks, age)
    assert.equal(combat.deathTick, playerDeathPresentationTickAtAge(age))
  }
  assert.equal(burstCount, 1)
  assert.equal(combat.lifeState, 'dying')
  assert.equal(combat.deathAgeTicks, PLAYER_DEATH_PRESENTATION_DURATION_TICKS - 1)
  assert.equal(combat.deathTick, PLAYER_DEATH_PRESENTATION_MAXIMUM_HELD_TICK)
  assert.equal(playerDeathFrame(combat), 3)

  const completed = stepPlayerCombatTick(combat)
  assert.equal(completed.completedDeathPresentation, true)
  assert.equal(completed.emittedDeathBurst, false)
  assert.equal(completed.combat.deathAgeTicks, PLAYER_DEATH_PRESENTATION_DURATION_TICKS)
  assert.equal(completed.combat.deathTick, PLAYER_DEATH_PRESENTATION_MAXIMUM_HELD_TICK)

  const held = stepPlayerCombatTick(completed.combat)
  assert.equal(held.completedDeathPresentation, false)
  assert.equal(held.emittedDeathBurst, false)
  assert.equal(held.combat, completed.combat)
})

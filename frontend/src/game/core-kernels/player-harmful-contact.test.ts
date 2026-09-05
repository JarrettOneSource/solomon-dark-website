import assert from 'node:assert/strict'
import test from 'node:test'

import { createHubEconomy } from './hub-economy.ts'
import { createNativeRng, drawNativeFloat, drawNativeInteger } from './native-rng.ts'
import { createPlayerProgression, createPlayerSkillBook, playerStatBook } from './player-progression.ts'
import { createPlayerSkillRuntime, playerPoisonDurationSeconds, playerSkillDerivedStats } from './player-skill-runtime.ts'
import {
  playerDeflectReflectionSourceInRange,
  resolvePlayerFlashResponse,
  resolvePlayerHarmfulContact,
} from './player-harmful-contact.ts'

test('Deflect consumes its chance and signed pitch before any Flash response', () => {
  const player = contactPlayer()
  const rng = createNativeRng(15)
  const chance = drawNativeInteger(rng, 100)
  const pitch = drawNativeFloat(chance.state, Math.fround(0.1), true)
  const result = resolvePlayerHarmfulContact(
    player.runtime,
    {
    ...player.derived, deflectChancePercent: 100, flashChancePercent: 100,
    },
    player.progression,
    { physicalDamage: 2, magicDamage: 0 },
    false,
    rng,
    { x: 0, y: 0 },
  )
  assert.equal(result.deflected, true)
  assert.equal(result.physicalDamage + result.magicDamage, 0)
  assert.deepEqual(result.rng, pitch.state)
  assert.equal(result.deflectPitch, Math.fround(1 + pitch.value))
})

test('Harden reduces only physical damage after its matching resistance', () => {
  const { runtime, derived, progression } = contactPlayer()
  for (const [physicalDamage, magicDamage, expected] of [[10, 0, 5], [0, 10, 8], [10, 10, 13]]) {
    const result = resolvePlayerHarmfulContact(
      { ...runtime, harden: { armor: 2, coating: 0 } },
      {
      ...derived, damageResistance: 0.3, magicResistance: 0.2,
      },
      progression,
      { physicalDamage, magicDamage },
      false,
      createNativeRng(15),
      { x: 0, y: 0 },
    )
    assert.equal(result.deflected, false)
    assert.equal(result.physicalDamage + result.magicDamage, expected)
  }
  assert.equal(resolvePlayerHarmfulContact(
    { ...runtime, harden: { armor: 20, coating: 0 } },
    derived,
    progression,
    { physicalDamage: 1, magicDamage: 0 },
    false,
    createNativeRng(15),
    { x: 0, y: 0 },
  ).physicalDamage, 0)
  for (const amount of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    for (const damage of [{ physicalDamage: 0, magicDamage: amount }, { physicalDamage: amount, magicDamage: 0 }]) {
      assert.throws(() => resolvePlayerHarmfulContact(
        runtime,
        derived,
        progression,
        damage,
        false,
        createNativeRng(1),
        { x: 0, y: 0 },
      ), /finite and non-negative/)
    }
  }
})

test('concentrated Deflect reflects only physical contact within the native reach', () => {
  const player = contactPlayer()
  const runtime = { ...player.runtime, concentrationSkillIdA: 68 }
  const derived = { ...player.derived, deflectChancePercent: 100 }
  for (const [kind, inRange, expected] of [
    ['physical', true, 50], ['physical', false, 0], ['magic', true, 0], ['poison', true, 0],
  ] as const) {
    assert.equal(resolvePlayerHarmfulContact(
      runtime,
      derived,
      player.progression,
      { physicalDamage: kind === 'physical' ? 10 : 0, magicDamage: kind === 'magic' ? 10 : 0 },
      inRange,
      createNativeRng(1),
      { x: 0, y: 0 },
    ).reflectedDamage, expected)
  }
  assert.equal(resolvePlayerHarmfulContact(
    player.runtime,
    derived,
    player.progression,
    { physicalDamage: 10, magicDamage: 0 },
    true,
    createNativeRng(1),
    { x: 0, y: 0 },
  ).reflectedDamage, 0)
  assert.equal(playerDeflectReflectionSourceInRange({ x: 0, y: 0 }, 25, { x: 74.99, y: 0 }, 25), true)
  assert.equal(playerDeflectReflectionSourceInRange({ x: 0, y: 0 }, 25, { x: 75, y: 0 }, 25), false)
  for (const [playerRadius, sourceRadius] of [[-1, 25], [25, -1], [Infinity, 25], [25, Infinity]]) {
    assert.throws(() => playerDeflectReflectionSourceInRange({ x: 0, y: 0 }, playerRadius,
      { x: 0, y: 0 }, sourceRadius), /finite and non-negative/)
  }
  for (const target of [{ x: NaN, y: 0 }, { x: 0, y: Infinity }]) {
    assert.throws(() => playerDeflectReflectionSourceInRange({ x: 0, y: 0 }, 25, target, 25), /positions must be finite/)
  }
})

test('admitted Flash rejects percentile zero, truncates its chance and builds its complete response', () => {
  const disabled = resolvePlayerFlashResponse({ flashChancePercent: 0, flashDurationTicks: 400 }, createNativeRng(15))
  assert.equal(disabled.flash, null)
  assert.deepEqual(disabled.rng, createNativeRng(15))
  const zero = resolvePlayerFlashResponse({ flashChancePercent: 100, flashDurationTicks: 400 }, createNativeRng(121))
  assert.equal(zero.flash, null)
  const below = resolvePlayerFlashResponse({ flashChancePercent: 8.99, flashDurationTicks: 400 }, createNativeRng(15))
  assert.equal(below.flash, null)
  const success = resolvePlayerFlashResponse({ flashChancePercent: 9.01, flashDurationTicks: 400 }, createNativeRng(15))
  assert.ok(success.flash)
  assert.equal(success.flash.durationTicks, 400)
  assert.equal(success.flash.growScales.length, 8)
  assert.ok(success.flash.growScales.every(scale => scale >= 1 && scale <= 2))
  assert.ok(success.flash.pitch >= 1 && success.flash.pitch <= 1.2)
  assert.ok(Math.abs(Math.hypot(success.flash.cameraDisplacement.x, success.flash.cameraDisplacement.y) - 3) < 0.000_001)
  assert.equal(success.rng.indexA, 11)
})

function contactPlayer() {
  const book = createPlayerSkillBook({ discipline: 'arcane', displayName: 'Contact', element: 'ether' })
  const stats = playerStatBook()
  const economy = createHubEconomy(1)
  const progression = createPlayerProgression(1)
  const created = createPlayerSkillRuntime(book, stats, economy)
  return {
    runtime: created.runtime,
    derived: playerSkillDerivedStats(created.runtime, created.skillBook, stats, progression, economy),
    progression,
  }
}

test('Resist Poison truncates the removed native tick count', () => {
  const { derived } = contactPlayer()
  assert.equal(playerPoisonDurationSeconds({ ...derived, poisonResistance: Math.fround(0.333) }, 2.5), 1.67)
  assert.equal(playerPoisonDurationSeconds({ ...derived, poisonResistance: 1 }, 10), 0)
})

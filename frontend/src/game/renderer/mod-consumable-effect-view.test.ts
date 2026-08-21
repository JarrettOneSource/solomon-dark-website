import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProtocolModEffect } from '../protocol/game-state.ts'
import {
  modConsumableEffectPlan,
  modConsumableRingAlpha,
} from './mod-consumable-effect-presentation.ts'

const effect: ProtocolModEffect = {
  color: [0.15, 1, 0.25, 1],
  contentId: '8068156596081641415',
  expiresTick: 18_001,
  playerId: 'guest',
  startedTick: 1,
  useId: 7,
}

test('consumable carrier uses the recovered radius pulse, tint, alpha, and exact expiry lane', () => {
  const start = modConsumableEffectPlan(effect, 1)
  const widest = modConsumableEffectPlan(effect, 31)
  const center = modConsumableEffectPlan(effect, 61)
  const narrowest = modConsumableEffectPlan(effect, 91)
  assert.equal(start.radius, 42)
  assert.equal(widest.radius, 45)
  assert.ok(Math.abs(center.radius - 42) < 1e-12)
  assert.equal(narrowest.radius, 39)
  assert.equal(start.alpha, 0.8)
  assert.equal(start.tint, 0x26ff40)
  assert.equal(start.flashVisible, true)
  assert.equal(modConsumableEffectPlan(effect, 2).flashVisible, false)
})

test('consumable activation owns four finite record-110 transforms and the procedural ring', () => {
  const plan = modConsumableEffectPlan(effect, effect.startedTick)
  assert.equal(plan.flashScales.length, 4)
  assert.equal(plan.flashAlphas.length, 4)
  assert.equal(plan.flashRotations.length, 4)
  assert.ok([...plan.flashScales, ...plan.flashAlphas, ...plan.flashRotations].every(Number.isFinite))
  assert.equal(modConsumableRingAlpha(63.5, 63.5), 0.28)
  assert.ok(modConsumableRingAlpha(110.5, 63.5) > 0.99)
  assert.equal(modConsumableRingAlpha(0, 0), 0)
})

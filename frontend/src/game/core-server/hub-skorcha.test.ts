import assert from 'node:assert/strict'
import test from 'node:test'

import { NATIVE_HUB_NPC_CATALOG } from '../core-kernels/native-hub-npc.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import {
  createHubSkorcha,
  createHubSkorchaAtVariant,
  hubSkorchaHatFrame,
  stepHubSkorcha,
  type HubSkorchaState,
} from './hub-skorcha.ts'
import { createHubWorld, stepHubWorldTick } from './hub-world.ts'

test('the authoritative population generator reaches absence and every exact Skorcha placement', () => {
  assert.deepEqual(NATIVE_HUB_NPC_CATALOG.skorcha.placements, [
    { variant: 0, x: 1437.5, y: 732.5 },
    { variant: 1, x: 1637, y: 403.5 },
    { variant: 2, x: 669, y: 705.5 },
  ])
  let absent = false
  const variants = new Map<number, HubSkorchaState>()
  for (let seed = 0; seed < 10_000 && (!absent || variants.size < 3); seed += 1) {
    const state = createHubSkorcha(seed)
    if (state === null) absent = true
    else variants.set(state.variant, state)
  }
  assert.equal(absent, true)
  assert.deepEqual([...variants.keys()].sort(), [0, 1, 2])
  for (const [variant, state] of variants) {
    const placement = NATIVE_HUB_NPC_CATALOG.skorcha.placements[variant]!
    assert.deepEqual(state.position, { x: placement.x, y: placement.y })
    assert.ok(state.gesture >= 0 && state.gesture < 3)
    assert.ok(state.gestureTicksRemaining >= 20 && state.gestureTicksRemaining <= 29)
    assert.ok(state.dismissalIndex >= 0 && state.dismissalIndex < 3)
  }
})

test('Skorcha changes to a distinct gesture after an exact Integer(10)+20 interval', () => {
  for (const variant of [0, 1, 2] as const) {
    let state = createHubSkorchaAtVariant(createNativeRng(100 + variant), variant)
    const initialGesture = state.gesture
    const interval = state.gestureTicksRemaining
    for (let tick = 1; tick < interval; tick += 1) {
      state = stepHubSkorcha(state)
      assert.equal(state.gesture, initialGesture)
      assert.equal(state.gestureTicksRemaining, interval - tick)
    }
    state = stepHubSkorcha(state)
    assert.notEqual(state.gesture, initialGesture)
    assert.ok(state.gestureTicksRemaining >= 20 && state.gestureTicksRemaining <= 29)
  }
})

test('Skorcha common animator reaches the four hat records and native blank apex', () => {
  let state = createHubSkorchaAtVariant(createNativeRng(317), 2)
  const frames = new Set<number>()
  let activationObserved = false
  for (let tick = 0; tick < 20_000 && frames.size < 5; tick += 1) {
    state = stepHubSkorcha(state)
    activationObserved ||= state.hatActive
    frames.add(hubSkorchaHatFrame(state))
  }
  assert.equal(activationObserved, true)
  assert.deepEqual([...frames].sort(), [0, 1, 2, 3, 4])
  assert.ok(state.hatPhaseDegrees >= 0 && state.hatPhaseDegrees < 180)
  assert.ok(state.hatRateDegreesPerTick >= 0 && state.hatRateDegreesPerTick <= 1.8)
})

test('Hub world preserves forced absence/presence and advances Skorcha on the host tick', () => {
  const absent = createHubWorld([], { skorcha: null })
  assert.equal(absent.skorcha, null)

  const skorcha = createHubSkorchaAtVariant(createNativeRng(73), 2)
  const present = createHubWorld([], { skorcha })
  const stepped = stepHubWorldTick(present, {}, {}, {})
  assert.equal(stepped.world.skorcha?.variant, 2)
  assert.deepEqual(stepped.world.skorcha?.position, { x: 669, y: 705.5 })
  assert.equal(
    stepped.world.skorcha?.gestureTicksRemaining,
    skorcha.gestureTicksRemaining - 1,
  )
})

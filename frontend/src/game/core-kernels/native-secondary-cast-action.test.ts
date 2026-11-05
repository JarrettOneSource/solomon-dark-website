import assert from 'node:assert/strict'
import test from 'node:test'

import {
  stepNativeSecondaryCastAction,
  type NativeSecondaryCastAction,
} from './native-secondary-cast-action.ts'

test('Wand Cast 2 crosses the opening marker on tick 11 and finishes on tick 64', () => {
  let action: NativeSecondaryCastAction | null = { weaponKind: 'wand', progress: 0 }
  for (let tick = 1; tick <= 64; tick += 1) {
    action = stepNativeSecondaryCastAction(action, 0).action
    if (tick < 64) assert.ok(action)
    if (tick <= 10) assert.ok(action!.progress < 1)
    if (tick === 11) assert.ok(action!.progress >= 1)
  }
  assert.equal(action, null)
  assert.deepEqual(stepNativeSecondaryCastAction(null, 0), { action: null, pulse: false })
})

test('Staff occupancy finishes after fifty-one updates', () => {
  let action: NativeSecondaryCastAction | null = { weaponKind: 'staff', progress: 0 }
  for (let tick = 1; tick < 51; tick += 1) {
    action = stepNativeSecondaryCastAction(action, 0).action
    assert.ok(action)
  }
  assert.equal(stepNativeSecondaryCastAction(action, 0).action, null)
  let faster: NativeSecondaryCastAction | null = { weaponKind: 'staff', progress: 0 }
  for (let tick = 1; tick <= 45; tick += 1) {
    faster = stepNativeSecondaryCastAction(faster, 10).action
    assert.ok(faster)
  }
  assert.equal(stepNativeSecondaryCastAction(faster, 10).action, null)
})

test('bare Cast 2 writes its pose on the first step and retains the terminal pose for one accepted tick', () => {
  const born: NativeSecondaryCastAction = { weaponKind: null, progress: 0, handPose: 0, handDone: false }
  const paused = stepNativeSecondaryCastAction(born, 100, 0)
  assert.deepEqual(paused, { action: { ...born, handPose: 1 }, pulse: false })
  let action: NativeSecondaryCastAction | null = born
  for (let tick = 1; tick <= 64; tick++) {
    const stepped = stepNativeSecondaryCastAction(action, 100)
    action = stepped.action
    assert.equal(stepped.pulse, tick === 11)
    assert.ok(action)
    assert.equal(action.weaponKind, null)
    if (action.weaponKind !== null) throw new Error('expected hand action')
    assert.equal(action.handPose, tick < 11 ? 1 : 3)
    assert.equal(action.handDone, tick === 64)
  }
  assert.equal(stepNativeSecondaryCastAction(action, 100).action, null)
})

test('Wand opening phase follows live Faster Caster changes without restarting', () => {
  let action: NativeSecondaryCastAction | null = { weaponKind: 'wand', progress: 0 }
  for (let tick = 1; tick <= 5; tick += 1) action = stepNativeSecondaryCastAction(action, 0).action
  assert.ok(action!.progress < 1)
  action = stepNativeSecondaryCastAction(action, 100).action
  action = stepNativeSecondaryCastAction(action, 100).action
  assert.ok(action!.progress < 1)
  action = stepNativeSecondaryCastAction(action, 100).action
  assert.ok(action!.progress >= 1)
  assert.equal(action!.weaponKind, 'wand')
})

test('Cast2 marker delivery survives a terminal overshoot and does not replay retained progress', () => {
  const terminal = stepNativeSecondaryCastAction({ weaponKind: 'wand', progress: .9 }, 10_000)
  assert.deepEqual(terminal, { action: null, pulse: true })
  const hand = stepNativeSecondaryCastAction({ weaponKind: null, progress: Math.fround(.9),
    handPose: 1, handDone: false }, 0, 100)
  assert.equal(hand.pulse, true)
  assert.equal(hand.action?.weaponKind, null)
  assert.deepEqual(stepNativeSecondaryCastAction(hand.action, 0), { action: null, pulse: false })
  assert.equal(stepNativeSecondaryCastAction({ weaponKind: 'wand', progress: Math.fround(1.1) }, 0).pulse, false)
  assert.equal(stepNativeSecondaryCastAction({ weaponKind: 'wand', progress: 1 }, -100).pulse, false)
  assert.equal(stepNativeSecondaryCastAction({ weaponKind: 'wand', progress: 1 }, 0).pulse, true)
})

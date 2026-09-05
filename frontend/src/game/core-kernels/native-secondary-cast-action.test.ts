import assert from 'node:assert/strict'
import test from 'node:test'

import {
  stepNativeSecondaryCastAction,
  type NativeSecondaryCastAction,
} from './native-secondary-cast-action.ts'

test('Wand Cast 2 crosses the opening marker on tick 11 and finishes on tick 64', () => {
  let action: NativeSecondaryCastAction | null = { weaponKind: 'wand', progress: 0 }
  for (let tick = 1; tick <= 64; tick += 1) {
    action = stepNativeSecondaryCastAction(action, 0)
    if (tick < 64) assert.ok(action)
    if (tick <= 10) assert.ok(action!.progress < 1)
    if (tick === 11) assert.ok(action!.progress >= 1)
  }
  assert.equal(action, null)
  assert.equal(stepNativeSecondaryCastAction(null, 0), null)
})

test('Staff occupancy finishes after fifty-one updates and bare-hand casting after sixty-four', () => {
  for (const weaponKind of ['staff', null] as const) {
    let action: NativeSecondaryCastAction | null = { weaponKind, progress: 0 }
    for (let tick = 1; tick < (weaponKind === 'staff' ? 51 : 64); tick += 1) {
      action = stepNativeSecondaryCastAction(action, 0)
      assert.ok(action)
    }
    assert.equal(stepNativeSecondaryCastAction(action, 0), null)
  }
  let faster: NativeSecondaryCastAction | null = { weaponKind: 'staff', progress: 0 }
  for (let tick = 1; tick <= 45; tick += 1) {
    faster = stepNativeSecondaryCastAction(faster, 10)
    assert.ok(faster)
  }
  assert.equal(stepNativeSecondaryCastAction(faster, 10), null)
})

test('Wand opening phase follows live Faster Caster changes without restarting', () => {
  let action: NativeSecondaryCastAction | null = { weaponKind: 'wand', progress: 0 }
  for (let tick = 1; tick <= 5; tick += 1) action = stepNativeSecondaryCastAction(action, 0)
  assert.ok(action!.progress < 1)
  action = stepNativeSecondaryCastAction(action, 100)
  action = stepNativeSecondaryCastAction(action, 100)
  assert.ok(action!.progress < 1)
  action = stepNativeSecondaryCastAction(action, 100)
  assert.ok(action!.progress >= 1)
  assert.equal(action!.weaponKind, 'wand')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeFacultyAction, stepNativeFacultyAction } from './native-faculty-actions.ts'
import { createNativeRng } from './native-rng.ts'

for (const kind of ['throw', 'two-hand', 'lightning'] as const) {
  test(`Faculty ${kind} follows its full native pose program and marker interval`, () => {
    for (let seed = 0; seed < 32; seed += 1) {
      let action = createNativeFacultyAction(kind, createNativeRng(seed)).action
      const initialHand = action.handMask
      const markers: number[] = []
      const pulses: number[] = []
      const poses = new Set<number>()
      let tick = 0
      while (tick < 400) {
        const next = stepNativeFacultyAction(action, 1)
        poses.add(next.bodyPose)
        if (next.marker) markers.push(tick)
        if (next.dispatch) pulses.push(tick)
        assert.equal(next.lockedFacing, kind === 'lightning' && next.action.progress >= 9)
        action = next.action
        tick += 1
        if (next.complete) break
      }
      assert.ok(tick < 400)
      assert.equal(markers.length, 1)
      assert.deepEqual([...poses].sort(), kind === 'two-hand' ? [0, 3, 4] : [0, 1, 2])
      assert.ok(kind === 'lightning' ? pulses.length > 1 : pulses.length === 1)
      assert.ok(kind === 'two-hand' ? initialHand === 3 : initialHand === 1 || initialHand === 2)
    }
  })
}

test('the native interval-crossing helper includes both sides of an exact marker but ignores a stopped clock', () => {
  const source = createNativeFacultyAction('throw', createNativeRng(8)).action
  assert.equal(stepNativeFacultyAction({ ...source, progress: 14, rate: 1 }, 1).marker, true)
  assert.equal(stepNativeFacultyAction({ ...source, progress: 15, rate: 1 }, 1).marker, true)
  assert.equal(stepNativeFacultyAction({ ...source, progress: 15, rate: 1 }, 0).marker, false)
  assert.equal(stepNativeFacultyAction({ ...source, progress: 20, rate: 1 }, 0).complete, false)
  assert.equal(stepNativeFacultyAction({ ...source, progress: 20, rate: 1 }, 1).complete, true)
})

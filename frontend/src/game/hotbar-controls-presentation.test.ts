import assert from 'node:assert/strict'
import test from 'node:test'
import { modalHotbarLayout } from './hotbar-controls-presentation.ts'
import { nativeHudModalSlideLayout, nativeHudModalSlideOffset } from './native-hud-layout.ts'

test('both optional books keep bank controls on the same native belt slide', () => {
  const resting = modalHotbarLayout(nativeHudModalSlideLayout(1600, 900, 0).belt)
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    const belt = nativeHudModalSlideLayout(1600, 900, progress).belt
    const controls = modalHotbarLayout(belt)
    assert.equal(controls.top, resting.top + nativeHudModalSlideOffset(progress))
    assert.equal(controls.dotsTop, resting.dotsTop + nativeHudModalSlideOffset(progress))
    assert.equal(controls.previous, belt[0]!.x - 46)
    assert.equal(controls.next, belt[7]!.x + belt[7]!.width + 12)
    assert.equal(controls.top - controls.dotsTop, 29)
  }
})

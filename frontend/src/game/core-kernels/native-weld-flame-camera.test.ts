import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeRng, drawNativeFloat } from './native-rng.ts'
import { drawNativeFlameCameraDisplacement } from './native-weld-flame-camera.ts'

test('normal Flame camera consumes magnitude then unsigned direction; weak consumes neither', () => {
  for (const seed of [0, 1, 42, 18827, 0xffff_ffff]) {
    const rng = createNativeRng(seed), magnitude = drawNativeFloat(rng, 4)
    const angle = drawNativeFloat(magnitude.state, 360)
    const radians = Math.fround(angle.value * 3.141592502593994 / 180)
    const sampled = drawNativeFlameCameraDisplacement(rng, false)
    assert.deepEqual(sampled.rng, angle.state)
    assert.deepEqual(sampled.displacement, {
      x: Math.fround(magnitude.value * Math.fround(Math.sin(radians))),
      y: Math.fround(magnitude.value * -Math.fround(Math.cos(radians))),
    })
    assert.deepEqual(drawNativeFlameCameraDisplacement(rng, true), { rng, displacement: null })
  }
})

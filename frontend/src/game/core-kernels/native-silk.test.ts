import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeRng } from './native-rng.ts'
import { createNativeSilk, stepNativeSilk } from './native-silk.ts'

test('Silk skips every fourth active update, settles its completed spline, then fades to retirement', () => {
  let state = createNativeSilk({ x: 100, y: 200 }, {
    position: { x: 350, y: 200 }, velocityPerTick: { x: 0.5, y: 0 },
  }, 50, createNativeRng(11)).state
  assert.equal(state.center.extent, 19)
  for (let tick = 1; tick <= 4; tick += 1) {
    const next = stepNativeSilk(state)!
    assert.equal(next.ageTicks, tick)
    if (tick === 4) {
      assert.equal(next.phase, state.phase)
      assert.deepEqual(next.position, state.position)
      assert.equal(next.height, state.height)
    } else assert.ok(next.phase > state.phase)
    state = next
  }
  let ticks = 4
  while (!state.ended && ticks < 200) { state = stepNativeSilk(state)!; ticks += 1 }
  assert.equal(ticks, 169)
  assert.ok(state.phase > state.center.extent)
  const endPosition = state.position
  const next = stepNativeSilk(state)!
  assert.deepEqual(next.position, endPosition)
  assert.notDeepEqual(next.drift, state.drift)
  assert.ok(next.height < state.height)
  let sawFade = false
  while (ticks < 1_000) {
    const next = stepNativeSilk(state)
    ticks += 1
    if (next === null) break
    sawFade ||= next.alpha < 1
    assert.ok(next.waveScale > 0)
    state = next
  }
  assert.equal(sawFade, true)
  assert.ok(ticks < 1_000)
})

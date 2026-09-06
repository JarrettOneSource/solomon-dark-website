import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeRng } from './native-rng.ts'
import { createNativeDeadSpider, nativeDeadSpiderEntry, stepNativeDeadSpider } from './native-dead-spider.ts'

test('DeadSpider slides and twitches before admitting its shared temporary decal target', () => {
  let state = createNativeDeadSpider({ x: 100, y: 100 }, 90)
  let rng = createNativeRng(43)
  const first = stepNativeDeadSpider(state, rng)
  assert.equal(first.state!.position.x, 98)
  assert.equal(first.state!.frame, Math.fround(0.2))
  assert.equal(first.state!.decal, null)
  assert.equal(first.state!.slideSpeed.x, Math.fround(1.9))
  let tick = 0
  while (state.decal === null) {
    const result = stepNativeDeadSpider(state, rng)
    state = result.state!
    rng = result.rngState
    tick += 1
    assert.ok(tick < 85)
  }
  assert.ok(tick >= 80)
  assert.equal(state.frame, 1)
  assert.ok([140, 141, 142].includes(state.decal!.entry))
  assert.ok(Math.hypot(state.decal!.position.x - state.position.x, state.decal!.position.y - state.position.y) <= 15.00001)
  assert.equal(state.decal!.scale, Math.fround(Math.fround(Math.fround(0.35) + Math.fround(0.01)) * Math.fround(0.9)))
  const settled = stepNativeDeadSpider({ ...state, life: 0.005 }, rng)
  assert.equal(settled.state, null, 'the same retirement removes the body and both shared decal targets')
})

test('DeadSpider consumes both complete ten-direction banks and preserves native inclusive wrapping', () => {
  for (const frame of [0, 1]) {
    for (let direction = 0; direction < 10; direction += 1) {
      assert.equal(nativeDeadSpiderEntry({ frame, headingDeg: direction * 18 }), 208 + frame * 10 + direction)
    }
  }
  assert.equal(nativeDeadSpiderEntry({ frame: 0, headingDeg: -18 }), 217)
  assert.equal(nativeDeadSpiderEntry({ frame: 0, headingDeg: 198 }), 209)
  assert.equal(nativeDeadSpiderEntry({ frame: 1, headingDeg: 180 }), null)
})

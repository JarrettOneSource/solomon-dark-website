import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeHeartmonger, detachNativeHeartmongerCrows, stepNativeHeartmonger } from './native-heartmonger.ts'
import { createNativeRng } from './native-rng.ts'

const context = { position: { x: 0, y: 0 }, lightIntensity: 1, admitted: true, targets: [], isVisible: () => true }

test('Heartmonger owns five authored Crows with evenly spaced orbit goals', () => {
  const created = createNativeHeartmonger(createNativeRng(31), 5, 40)
  assert.equal(created.state.crows.length, 5)
  assert.deepEqual(created.state.crows.map((crow) => crow.id), [40, 41, 42, 43, 44])
  assert.equal(created.state.summonTicksRemaining, 200)
  assert.equal(created.state.activated, false)
  for (let i = 1; i < 5; i += 1) {
    assert.ok(Math.abs(created.state.crows[i]!.orbitPhaseDeg - created.state.crows[i - 1]!.orbitPhaseDeg - 72) < .0001)
  }
})

test('Heartmonger latches strict light exposure and mode 3 summons every 151 active ticks', () => {
  const initial = createNativeHeartmonger(createNativeRng(31), 0, 1)
  const dark = stepNativeHeartmonger(initial.state, initial.rng, 3, { ...context, lightIntensity: .4000000059604645 })
  assert.equal(dark.state.activated, false)
  const lit = stepNativeHeartmonger(dark.state, dark.rng, 3, context)
  assert.equal(lit.state.activated, true)
  assert.equal(lit.state.summonTicksRemaining, 200)
  let next = lit
  for (let tick = 0; tick < 200; tick += 1) {
    next = stepNativeHeartmonger(next.state, next.rng, 3, { ...context, lightIntensity: 0 })
    assert.equal(next.summons.length, 0)
  }
  next = stepNativeHeartmonger(next.state, next.rng, 3, context)
  assert.ok(next.summons.length > 0)
  assert.equal(next.state.summonTicksRemaining, 150)
  for (let tick = 0; tick < 150; tick += 1) {
    next = stepNativeHeartmonger(next.state, next.rng, 3, context)
    assert.equal(next.summons.length, 0)
  }
  assert.ok(stepNativeHeartmonger(next.state, next.rng, 3, context).summons.length > 0)
})

test('Heartmonger death releases the flock plus a new bird at its root', () => {
  const initial = createNativeHeartmonger(createNativeRng(31), 5, 20)
  const result = detachNativeHeartmongerCrows(initial.state, initial.rng, context.position, 30)
  assert.equal(result.crows.length, 6)
  assert.equal(result.crows.at(-1)?.height, 60)
  assert.equal(result.crows.at(-1)?.speed, -1)
  assert.deepEqual(result.crows.at(-1)?.position, context.position)
  assert.equal(initial.state.crows.length, 5)
})

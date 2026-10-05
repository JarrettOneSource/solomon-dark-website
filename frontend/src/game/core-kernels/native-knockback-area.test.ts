import assert from 'node:assert/strict'
import test from 'node:test'
import { stepNativeKnockbackArea } from './native-knockback-area.ts'
import { advanceNativeRngWords, createNativeRng } from './native-rng.ts'

test('both retained movement budgets consume one proposal per update and perturb only at termination', () => {
  for (const budget of [50, 150]) {
    const initialRng = createNativeRng(31)
    let rng = initialRng
    let position = { x: 0, y: -50 }
    let state = { origin: { x: 0, y: 0 }, remainingDistance: budget, targetIds: [1] }
    for (let tick = 1; tick <= budget / 10; tick += 1) {
      const result = stepNativeKnockbackArea(state, rng, {
        position: () => position,
        move: (_id, delta) => { position = { x: Math.fround(position.x + delta.x),
          y: Math.fround(position.y + delta.y) }; return [] },
      })
      rng = result.rng
      state = { ...state, remainingDistance: result.remainingDistance, targetIds: result.targetIds }
      assert.equal(result.terminal, tick === budget / 10)
      assert.equal(result.headingPerturbations.length, tick === budget / 10 ? 1 : 0)
    }
    assert.ok(Math.abs(position.y + 50 + budget) < .001)
    assert.deepEqual(rng, advanceNativeRngWords(initialRng, budget / 10 + 2))
  }
})

test('coincident roots stay still, missing targets leave the list and expiry still proposes', () => {
  const rng = createNativeRng(31)
  const result = stepNativeKnockbackArea({ origin: { x: 0, y: 0 }, remainingDistance: 5,
    targetIds: [2, 1] }, rng, { position: id => id === 2 ? null : { x: 0, y: 0 } })
  assert.deepEqual(result.targetIds, [1])
  assert.deepEqual(result.displacements, [{ targetId: 1, delta: { x: 0, y: 0 } }])
  assert.equal(result.terminal, true)
  assert.deepEqual(result.rng, advanceNativeRngWords(rng, 3))
  assert.ok(Math.hypot(result.cameraDisplacement.x, result.cameraDisplacement.y) > 9.99999)
})

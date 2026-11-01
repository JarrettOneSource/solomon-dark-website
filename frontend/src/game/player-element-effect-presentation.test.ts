import assert from 'node:assert/strict'
import test from 'node:test'
import {
  playerElementEffectCallAngle,
  playerHandElementAngleSocket,
  playerHandElementEffectPlan,
} from './player-element-effect-presentation.ts'

test('bare helper uses each authored action bank and the independent front/back depth admission', () => {
  for (const [pose, expectedFront, expectedBack] of [[0, 11, 13], [1, 12, 12], [2, 11, 13], [3, 9, 15]] as const) {
    let front = 0, back = 0
    for (let heading = 0; heading < 24; heading++) {
      const plan = playerHandElementEffectPlan(heading, pose, 0, 0, true)
      front += Number(plan.front)
      back += Number(plan.back)
    }
    assert.equal(front, expectedFront, `pose ${pose} front census`)
    assert.equal(back, expectedBack, `pose ${pose} back census`)
  }
  const idle = playerHandElementEffectPlan(0, 0, 0, 0, false)
  assert.deepEqual(idle.offset, { x: -5.5, y: -25.5 })
  const cast = playerHandElementEffectPlan(6, 3, 0, .45, false)
  assert.deepEqual(cast.offset, { x: 22.5, y: -18 })
  assert.equal(cast.scale, Math.fround(Math.fround(.8) * 5.5))
  const released = playerHandElementEffectPlan(0, 2, 0, 0, false)
  assert.equal(released.front, false)
  assert.equal(released.back, false)
  assert.equal(playerHandElementEffectPlan(0, 2, 0, 0, true).front, true)
})

test('bare bob uses accepted tick while the ordinary angle keeps pose-zero X/X', () => {
  const bob = playerHandElementEffectPlan(6, 3, 45, 0, false)
  assert.equal(bob.offset.y, -17)
  assert.deepEqual(playerHandElementAngleSocket(6), { x: 14, y: -18 })
  assert.equal(playerElementEffectCallAngle(playerHandElementAngleSocket(6), null), 149)
  const wand = { x: 14.5, y: -50.5 }
  assert.equal(playerElementEffectCallAngle(wand, 'wand'), 157)
  assert.equal(playerElementEffectCallAngle(wand, 'staff'), 25)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPlayerCharacterDrawPlan,
  playerCharacterFixedRobeOffset,
  playerCharacterFrontAttachmentOffset,
  playerCharacterHeadOffset,
  playerCharacterRobePose,
  playerCharacterStaffIsFront,
  playerCharacterStaffOrbOffset,
} from './player-character-presentation.ts'

function closeTo(actual: number, expected: number, epsilon = 0.001): void {
  assert.ok(Math.abs(actual - expected) <= epsilon)
}

test('player character draw plan preserves native attachment and gait transforms', () => {
  assert.deepEqual(playerCharacterStaffOrbOffset(0), { x: -32.5, y: -66.5 })
  assert.deepEqual(playerCharacterStaffOrbOffset(6), { x: 38.5, y: -61.5 })
  assert.deepEqual(playerCharacterStaffOrbOffset(12), { x: 32.5, y: -1.5 })
  assert.deepEqual(playerCharacterStaffOrbOffset(18), { x: -38.5, y: -6.5 })
  assert.deepEqual(playerCharacterStaffOrbOffset(30), playerCharacterStaffOrbOffset(6))
  assert.equal(playerCharacterStaffIsFront(4), false)
  assert.equal(playerCharacterStaffIsFront(5), true)
  assert.equal(playerCharacterStaffIsFront(16), true)
  assert.equal(playerCharacterStaffIsFront(17), false)

  assert.equal(playerCharacterRobePose(4.999), 4)
  closeTo(playerCharacterFixedRobeOffset(90).x, Math.SQRT1_2)
  closeTo(playerCharacterFixedRobeOffset(180, 2).x, 4)
  closeTo(playerCharacterFrontAttachmentOffset(90).y, 1)
  closeTo(playerCharacterHeadOffset(0, 0).x, -0.5)
  closeTo(playerCharacterHeadOffset(0, 90).y, -1.5)
  closeTo(playerCharacterHeadOffset(6, 0).y, -0.5)

  const plan = createPlayerCharacterDrawPlan({
    gaitDegrees: 90,
    headingIndex: 6,
    velocity: { x: 90, y: 0 },
    walkCyclePrimary: 2.5,
  })
  assert.equal(plan.robePose, 2)
  assert.equal(plan.headingSheetOffsetY, -1020)
  assert.equal(plan.moving, true)
  assert.equal(plan.staffFront, true)
  assert.equal(plan.orbZIndex, 6)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { createIdlePlayerPrimaryCast } from './core-kernels/player-character.ts'

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
    primaryCast: createIdlePlayerPrimaryCast(),
    velocity: { x: 90, y: 0 },
    walkCyclePrimary: 2.5,
  })
  assert.equal(plan.robePose, 2)
  assert.equal(plan.headingSheetOffsetY, -1020)
  assert.equal(plan.moving, true)
  assert.equal(plan.staffFront, true)
  assert.equal(plan.orbZIndex, 6)
})

test('player draw plan consumes the authoritative Staff Cast 1 pose bank', () => {
  const markerPlan = createPlayerCharacterDrawPlan({
    gaitDegrees: 0,
    headingIndex: 0,
    primaryCast: { ...createIdlePlayerPrimaryCast(), actionTick: 19 },
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  })
  assert.equal(markerPlan.attachmentPose, 8)
  assert.deepEqual(markerPlan.orbOffset, { x: 8.5, y: -47.5 })
  assert.equal(markerPlan.staffFront, false)

  const recoveryPlan = createPlayerCharacterDrawPlan({
    gaitDegrees: 0,
    headingIndex: 7,
    primaryCast: { ...createIdlePlayerPrimaryCast(), actionTick: 37 },
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  })
  assert.equal(recoveryPlan.attachmentPose, 7)
  assert.deepEqual(recoveryPlan.orbOffset, { x: 41.5, y: -0.5 })
  assert.equal(recoveryPlan.staffFront, true)
})

test('player draw plan holds the sustained Staff Constant pose bank', () => {
  const insertion = createPlayerCharacterDrawPlan({
    gaitDegrees: 0,
    headingIndex: 0,
    primaryCast: {
      ...createIdlePlayerPrimaryCast(),
      actionTick: 0,
      channelActive: true,
    },
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  })
  assert.equal(insertion.attachmentPose, 0)
  assert.deepEqual(insertion.orbOffset, { x: -32.5, y: -66.5 })

  const constant = createPlayerCharacterDrawPlan({
    gaitDegrees: 0,
    headingIndex: 0,
    primaryCast: {
      ...createIdlePlayerPrimaryCast(),
      actionTick: 1,
      channelActive: true,
    },
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
  })
  assert.equal(constant.attachmentPose, 7)
  assert.deepEqual(constant.orbOffset, { x: 8.5, y: -56 })
})

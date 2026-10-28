import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ACTOR_MOVEMENT_FACING_DISTANCE,
  ACTOR_MOVEMENT_FACING_TELEPORT_DISTANCE,
  actorHeadingFromVector,
  actorHeadingIndex,
  actorHeadingVector,
  advanceActorMovementFacing,
  createActorMovementFacingState,
} from './actor-heading.ts'

test('heading indices quantise the native atan2(x, -y) heading into 24 bins', () => {
  assert.equal(actorHeadingIndex(actorHeadingFromVector(0, -1)), 0)
  assert.equal(actorHeadingIndex(actorHeadingFromVector(1, 0)), 6)
  assert.equal(actorHeadingIndex(actorHeadingFromVector(0, 1)), 12)
  assert.equal(actorHeadingIndex(actorHeadingFromVector(-1, 0)), 18)
  for (let index = 0; index < 24; index += 1) {
    const vector = actorHeadingVector(index)
    assert.equal(actorHeadingIndex(actorHeadingFromVector(vector.x, vector.y)), index)
  }
})

test('movement facing only turns once the sprite has travelled the facing distance', () => {
  let facing = createActorMovementFacingState(100, 100)
  assert.equal(facing.headingIndex, null)
  facing = advanceActorMovementFacing(facing, 100, 98)
  assert.equal(facing.headingIndex, null, 'short travel keeps the fallback facing')
  facing = advanceActorMovementFacing(facing, 100, 100 - ACTOR_MOVEMENT_FACING_DISTANCE)
  assert.equal(facing.headingIndex, 0)
  assert.equal(facing.anchorY, 100 - ACTOR_MOVEMENT_FACING_DISTANCE)
})

test('a reconciliation ripple shorter than the facing distance never flips the sprite', () => {
  let facing = createActorMovementFacingState(500, 700)
  const forwardPerTick = 1.1875
  let y = 700
  for (let tick = 0; tick < 12; tick += 1) {
    y -= forwardPerTick
    facing = advanceActorMovementFacing(facing, 500, y)
  }
  assert.equal(facing.headingIndex, 0)
  const anchored = facing
  // A positive correction of three ticks decays over the next frames and
  // drags the displayed sprite back along its path before it resumes.
  const ripple = [1.5, 1.0, 0.5, 0.2, 0]
  for (const back of ripple) {
    facing = advanceActorMovementFacing(facing, 500, y + back)
    assert.equal(facing, anchored, `ripple ${back} must not re-anchor`)
    assert.equal(facing.headingIndex, 0)
  }
  for (let tick = 0; tick < 6; tick += 1) {
    y -= forwardPerTick
    facing = advanceActorMovementFacing(facing, 500, y)
  }
  assert.equal(facing.headingIndex, 0)
  assert.notEqual(facing, anchored)
})

test('a real turn still faces the new travel once it covers the facing distance', () => {
  let facing = createActorMovementFacingState(0, 0)
  facing = advanceActorMovementFacing(facing, 0, -ACTOR_MOVEMENT_FACING_DISTANCE)
  assert.equal(facing.headingIndex, 0)
  facing = advanceActorMovementFacing(facing, ACTOR_MOVEMENT_FACING_DISTANCE, -ACTOR_MOVEMENT_FACING_DISTANCE)
  assert.equal(facing.headingIndex, 6)
  facing = advanceActorMovementFacing(facing, ACTOR_MOVEMENT_FACING_DISTANCE, 0)
  assert.equal(facing.headingIndex, 12)
})

test('a placement jump re-anchors without turning towards the jump', () => {
  let facing = createActorMovementFacingState(957, 40)
  facing = advanceActorMovementFacing(facing, 957, 40 - ACTOR_MOVEMENT_FACING_DISTANCE)
  assert.equal(facing.headingIndex, 0)
  facing = advanceActorMovementFacing(facing, 512, 924)
  assert.equal(facing.headingIndex, 0, 'the Office door placement keeps the courtyard facing')
  assert.equal(facing.anchorX, 512)
  assert.equal(facing.anchorY, 924)
  facing = advanceActorMovementFacing(facing, 512, 924 - ACTOR_MOVEMENT_FACING_TELEPORT_DISTANCE / 2)
  assert.equal(facing.headingIndex, 0)
})

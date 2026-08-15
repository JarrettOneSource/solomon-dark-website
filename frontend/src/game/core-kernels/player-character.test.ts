import assert from 'node:assert/strict'
import test from 'node:test'

import { actorHeadingFromVector, actorHeadingIndex } from './actor-heading.ts'
import {
  PLAYER_CHARACTER_GAIT_DEGREES_PER_UNIT,
  PLAYER_CHARACTER_INPUT_ACCELERATION,
  PLAYER_CHARACTER_MOVEMENT_LANE_CAP,
  PLAYER_CHARACTER_MOVEMENT_RETENTION,
  PLAYER_CHARACTER_MOVEMENT_THRESHOLD_SQUARED,
  PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
  PLAYER_CHARACTER_STEADY_SPEED,
  PLAYER_CHARACTER_WALK_CYCLE_DISTANCE_PER_FRAME,
  PLAYER_CHARACTER_WALK_CYCLE_WRAP,
  advancePlayerCharacterWalkCycle,
  commitPlayerCharacterTick,
  createPlayerCharacter,
  planPlayerCharacterTick,
} from './player-character.ts'

const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

function closeTo(actual: number, expected: number, epsilon = 0.001): void {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${actual} is not within ${epsilon} of ${expected}`,
  )
}

test('player character headings use the native twenty-four-direction bank', () => {
  assert.equal(actorHeadingFromVector(0, -1), 0)
  assert.equal(actorHeadingFromVector(1, 0), 90)
  assert.equal(actorHeadingFromVector(0, 1), 180)
  assert.equal(actorHeadingFromVector(-1, 0), 270)
  assert.deepEqual([0, 90, 180, 270].map(actorHeadingIndex), [0, 6, 12, 18])
})

test('player character planning replays the native fixed-tick movement lane', () => {
  assert.equal(PLAYER_CHARACTER_STEADY_SPEED, 100)
  assert.equal(PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS, 0.01)
  assert.equal(PLAYER_CHARACTER_INPUT_ACCELERATION, 10)
  assert.equal(PLAYER_CHARACTER_MOVEMENT_LANE_CAP, 118.75)
  assert.equal(PLAYER_CHARACTER_MOVEMENT_RETENTION, 0.9)
  assert.equal(PLAYER_CHARACTER_MOVEMENT_THRESHOLD_SQUARED, Math.fround(0.01))

  const first = planPlayerCharacterTick(
    { velocity: { x: 0, y: 0 } },
    { movement: { x: 1, y: 0 } },
    1,
  )
  assert.deepEqual(first.requestedVelocity, { x: 10, y: 0 })
  closeTo(first.delta.x, 0.1)
  assert.equal(first.delta.y, 0)
  assert.deepEqual(first.retainedVelocity, { x: 9, y: 0 })
  assert.equal(first.movementActive, true)

  const fractional = planPlayerCharacterTick(
    { velocity: { x: 0, y: 0 } },
    { movement: { x: 1, y: 0 } },
    0.25,
  )
  assert.deepEqual(fractional.requestedVelocity, { x: 2.5, y: 0 })
  assert.deepEqual(fractional.delta, { x: 0, y: 0 })
  assert.equal(fractional.movementActive, false)
  const fractionalAtCap = planPlayerCharacterTick(
    { velocity: { x: 100, y: 0 } },
    { movement: { x: 1, y: 0 } },
    0.25,
  )
  closeTo(fractionalAtCap.requestedVelocity.x, 29.6875)
  closeTo(fractionalAtCap.retainedVelocity.x, 26.71875)

  let player = createPlayerCharacter(CHARACTER, { x: 0, y: 0 })
  for (let tick = 0; tick < 200; tick += 1) {
    const plan = planPlayerCharacterTick(player, { movement: { x: 1, y: 0 } }, 1)
    player = commitPlayerCharacterTick(player, plan, {
      x: player.position.x + plan.delta.x,
      y: player.position.y + plan.delta.y,
    })
  }
  closeTo(player.velocity.x, 90)
  const steadyStart = player.position.x
  for (let tick = 0; tick < 10; tick += 1) {
    const plan = planPlayerCharacterTick(player, { movement: { x: 1, y: 0 } }, 1)
    player = commitPlayerCharacterTick(player, plan, {
      x: player.position.x + plan.delta.x,
      y: player.position.y + plan.delta.y,
    })
  }
  closeTo(player.position.x - steadyStart, 10)
})

test('normal release stops movement and gait after the native 21-tick tail', () => {
  let player = createPlayerCharacter(CHARACTER, { x: 0, y: 0 })
  for (let tick = 0; tick < 200; tick += 1) {
    const plan = planPlayerCharacterTick(player, { movement: { x: 1, y: 0 } }, 1)
    player = commitPlayerCharacterTick(player, plan, {
      x: player.position.x + plan.delta.x,
      y: player.position.y + plan.delta.y,
    })
  }

  let activeReleaseTicks = 0
  for (let tick = 0; tick < 22; tick += 1) {
    const plan = planPlayerCharacterTick(player, { movement: { x: 0, y: 0 } }, 1)
    if (plan.movementActive) activeReleaseTicks += 1
    const previousGait = player.gaitDegrees
    player = commitPlayerCharacterTick(player, plan, {
      x: player.position.x + plan.delta.x,
      y: player.position.y + plan.delta.y,
    })
    if (tick === 21) {
      assert.deepEqual(plan.delta, { x: 0, y: 0 })
      assert.equal(player.gaitDegrees, previousGait)
      assert.ok(player.velocity.x > 0)
    }
  }

  assert.equal(activeReleaseTicks, 21)
})

test('world resolution cannot rewrite character intent, facing, or gait ownership', () => {
  const player = createPlayerCharacter(CHARACTER, { x: 100, y: 100 })
  const idlePlan = planPlayerCharacterTick(player, { movement: { x: 0, y: 0 } }, 1)
  const pushed = commitPlayerCharacterTick(player, idlePlan, { x: 112, y: 100 })
  assert.equal(pushed.headingIndex, player.headingIndex)
  assert.equal(pushed.gaitDegrees, player.gaitDegrees)
  assert.equal(pushed.walkCyclePrimary, player.walkCyclePrimary)
  assert.deepEqual(pushed.velocity, { x: 0, y: 0 })

  const intended = {
    delta: { x: 10, y: 0 },
    movementActive: true,
    requestedVelocity: { x: 100, y: 0 },
    retainedVelocity: { x: 90, y: 0 },
  }
  const blocked = commitPlayerCharacterTick(pushed, intended, pushed.position)
  assert.equal(blocked.headingIndex, 6)
  assert.equal(blocked.gaitDegrees, 50)
  assert.equal(blocked.walkCyclePrimary, 1)
  assert.deepEqual(blocked.position, pushed.position)
})

test('walk-cycle constants and wrap remain character-owned', () => {
  assert.equal(PLAYER_CHARACTER_GAIT_DEGREES_PER_UNIT, 5)
  assert.equal(PLAYER_CHARACTER_WALK_CYCLE_DISTANCE_PER_FRAME, 10)
  assert.equal(PLAYER_CHARACTER_WALK_CYCLE_WRAP, 5)
  closeTo(advancePlayerCharacterWalkCycle(4.9, 1), 5)
  closeTo(advancePlayerCharacterWalkCycle(5, 1), 0.1)
})

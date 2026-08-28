import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildNativeEnemySteering,
  clearNativeEnemyRoute,
  createNativeEnemyPathState,
  resolveNativeEnemyPathGoal,
} from './native-enemy-pathfinding.ts'
import { createNativeRng } from './native-rng.ts'

test('native route owner keeps direct LOS and retains two blocked-goal waypoints', () => {
  const source = createNativeEnemyPathState(createNativeRng(1)).state
  const direct = resolveNativeEnemyPathGoal(source, {
    actorPosition: { x: 0, y: 0 },
    bodyRadius: 20,
    cadenceTicks: 2,
    directPathClear: () => true,
    findRoute: () => assert.fail('direct LOS must not build a route'),
    navigationClearance: 25,
    rawGoal: { x: 100, y: 0 },
    targetPosition: { x: 100, y: 0 },
    targetRefreshTicks: 300,
  })
  assert.deepEqual(direct.goal, { x: 100, y: 0 })
  assert.equal(direct.state.routeRefreshTicksRemaining, 300)
  assert.equal(direct.state.routeTicksRemaining, 0)

  const blocked = resolveNativeEnemyPathGoal(source, {
    actorPosition: { x: 0, y: 0 },
    bodyRadius: 20,
    cadenceTicks: 2,
    directPathClear: () => false,
    findRoute: () => [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 100, y: 20 },
      { x: 100, y: 0 },
    ],
    navigationClearance: 25,
    rawGoal: { x: 90, y: 10 },
    targetPosition: { x: 100, y: 0 },
    targetRefreshTicks: 300,
  })
  assert.deepEqual(blocked.goal, { x: 20, y: 0 })
  assert.deepEqual(blocked.state.routeWaypoints, [
    { x: 20, y: 0 },
    { x: 20, y: 20 },
  ])
  assert.equal(blocked.state.routeTicksRemaining, 300)
  assert.equal(blocked.state.routeWaypointIndex, 0)

  const advanced = resolveNativeEnemyPathGoal(blocked.state, {
    actorPosition: { x: 20, y: 0 },
    bodyRadius: 20,
    cadenceTicks: 2,
    directPathClear: () => false,
    findRoute: () => assert.fail('first-waypoint passage must retain the route'),
    navigationClearance: 25,
    rawGoal: { x: 100, y: 0 },
    targetPosition: { x: 100, y: 0 },
    targetRefreshTicks: 300,
  })
  assert.deepEqual(advanced.goal, { x: 20, y: 20 })
  assert.equal(advanced.state.routeWaypointIndex, 1)
  assert.equal(advanced.state.routeTicksRemaining, 298)
})

test('native route failure requests the exact 180-degree recovery without a hidden goal', () => {
  const source = createNativeEnemyPathState(createNativeRng(2)).state
  const result = resolveNativeEnemyPathGoal(source, {
    actorPosition: { x: 0, y: 0 },
    bodyRadius: 35,
    cadenceTicks: 2,
    directPathClear: () => false,
    findRoute: () => null,
    navigationClearance: 50,
    rawGoal: { x: 80, y: 40 },
    targetPosition: { x: 100, y: 50 },
    targetRefreshTicks: 100,
  })
  assert.deepEqual(result.goal, { x: 100, y: 50 })
  assert.equal(result.turnAround, true)
  assert.equal(result.state.routeTicksRemaining, 0)
  assert.equal(result.state.routeWaypoints, null)
})

test('target identity changes clear only the actor-owned route continuation', () => {
  const source = createNativeEnemyPathState(createNativeRng(4)).state
  const routed = resolveNativeEnemyPathGoal(source, {
    actorPosition: { x: 0, y: 0 },
    bodyRadius: 20,
    cadenceTicks: 2,
    directPathClear: () => false,
    findRoute: () => [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ],
    navigationClearance: 25,
    rawGoal: { x: 20, y: 20 },
    targetPosition: { x: 20, y: 20 },
    targetRefreshTicks: 300,
  }).state
  const cleared = clearNativeEnemyRoute(routed)
  assert.equal(cleared.baseTurnRate, routed.baseTurnRate)
  assert.equal(cleared.wanderHeadingDeg, routed.wanderHeadingDeg)
  assert.equal(cleared.routePreviousVector, null)
  assert.equal(cleared.routeRefreshTicksRemaining, 0)
  assert.equal(cleared.routeTicksRemaining, 0)
  assert.equal(cleared.routeWaypointIndex, 0)
  assert.equal(cleared.routeWaypoints, null)
})

test('ordinary turning uses native sign/deadband instead of clamping to the remaining angle', () => {
  const source = createNativeEnemyPathState(createNativeRng(3)).state
  const step = source.baseTurnRate * source.turnFactor
  const steer = (targetDegrees: number) => buildNativeEnemySteering(source, {
    actorHeadingDeg: 0,
    actorPosition: { x: 0, y: 0 },
    cadenceTicks: 1,
    goalPosition: {
      x: Math.sin(targetDegrees * Math.PI / 180) * 100,
      y: -Math.cos(targetDegrees * Math.PI / 180) * 100,
    },
    movementPerTick: 0,
    radialDirection: 1,
    statusFactor: 1,
    tangentDirection: 0,
    targetHeadingDeg: 0,
    targetPosition: null,
  }).headingDeg

  assert.equal(steer(0.999), 0)
  assert.equal(steer(1), step)
  assert.equal(steer(step / 2 + 1), step)
  assert.equal(steer(359), 0)
  assert.equal(steer(358.999), (360 - step) % 360)
})

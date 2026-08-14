import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AIR_PRIMARY_CONE_HALF_ANGLE_DEGREES,
  AIR_PRIMARY_RETAIN_DOT,
  ETHER_PRIMARY_INITIAL_TURN,
  ETHER_PRIMARY_PROBE_DISTANCE,
  ETHER_PRIMARY_TURN_FAST_STEP,
  airPrimaryBoltGeometry,
  advanceEtherPrimaryHoming,
  selectAirPrimaryTarget,
  selectEtherPrimaryTarget,
  type PrimarySpellTarget,
} from './primary-spell-targeting.ts'

const enemy = (
  id: string,
  x: number,
  y: number,
): PrimarySpellTarget => ({
  airPriority: 0,
  attachment: { x: 0, y: 0 },
  id,
  kind: 'enemy',
  position: { x, y },
})

const grave = (
  id: string,
  x: number,
  y: number,
): PrimarySpellTarget => ({
  airPriority: 1000,
  attachment: { x: 0, y: 0 },
  id,
  kind: 'gravestone',
  position: { x, y },
})

test('Lightning prioritizes visible combat actors and falls back to a Gravestone', () => {
  assert.equal(AIR_PRIMARY_CONE_HALF_ANGLE_DEGREES, 15)
  const targets = [
    grave('grave:near', 0, -80),
    enemy('enemy:far', 40, -240),
  ]
  const base = {
    aimDirection: { x: 0, y: -1 },
    maxRange: 300,
    origin: { x: 0, y: 0 },
    previousTargetId: null,
    targets,
  }

  assert.equal(selectAirPrimaryTarget({
    ...base,
    hasLineOfSight: () => true,
  })?.id, 'enemy:far')
  assert.equal(selectAirPrimaryTarget({
    ...base,
    hasLineOfSight: (target) => target.kind === 'gravestone',
  })?.id, 'grave:near')
})

test('Lightning retains a missed live target only inside the native wider heading gate', () => {
  assert.equal(AIR_PRIMARY_RETAIN_DOT, Math.fround(0.71))
  const fortyDegrees = {
    x: Math.sin(40 * Math.PI / 180) * 500,
    y: -Math.cos(40 * Math.PI / 180) * 500,
  }
  const retained = enemy('enemy:retained', fortyDegrees.x, fortyDegrees.y)
  assert.equal(selectAirPrimaryTarget({
    aimDirection: { x: 0, y: -1 },
    hasLineOfSight: () => false,
    maxRange: 100,
    origin: { x: 0, y: 0 },
    previousTargetId: retained.id,
    targets: [retained],
  })?.id, retained.id)

  const fiftyDegrees = enemy(
    'enemy:lost',
    Math.sin(50 * Math.PI / 180) * 500,
    -Math.cos(50 * Math.PI / 180) * 500,
  )
  assert.equal(selectAirPrimaryTarget({
    aimDirection: { x: 0, y: -1 },
    hasLineOfSight: () => false,
    maxRange: 100,
    origin: { x: 0, y: 0 },
    previousTargetId: fiftyDegrees.id,
    targets: [fiftyDegrees],
  }), null)
})

test('Lightning middle control follows cast aim so an off-axis target gets the native arc', () => {
  const geometry = airPrimaryBoltGeometry(
    { x: 10, y: 20 },
    { x: 0, y: -1 },
    { x: 110, y: -180 },
  )
  assert.deepEqual(geometry.source, { x: 10, y: 20 })
  assert.deepEqual(geometry.endpoint, { x: 110, y: -180 })
  assert.ok(Math.abs(geometry.midpoint.x - 10) < 1e-12)
  assert.ok(Math.abs(geometry.midpoint.y - (20 - Math.hypot(100, -200) / 2)) < 1e-12)
  assert.notDeepEqual(geometry.midpoint, { x: 60, y: -80 })
})

test('Magic Missile chooses nearest to its 100-unit forward probe, not nearest to caster', () => {
  assert.equal(ETHER_PRIMARY_PROBE_DISTANCE, 100)
  const selected = selectEtherPrimaryTarget({
    aimDirection: { x: 1, y: 0 },
    origin: { x: 0, y: 0 },
    targets: [enemy('enemy:caster', 0, 1), enemy('enemy:probe', 101, 0)],
  })
  assert.equal(selected?.id, 'enemy:probe')
  assert.equal(selectEtherPrimaryTarget({
    aimDirection: { x: 1, y: 0 },
    origin: { x: 0, y: 0 },
    targets: [grave('grave:not-in-actor-query', 100, 0)],
  }), null)
})

test('Magic Missile moves on the old heading then applies native steering to the next tick', () => {
  assert.equal(ETHER_PRIMARY_INITIAL_TURN, Math.fround(0.01))
  const advanced = advanceEtherPrimaryHoming({
    headingDegrees: 0,
    movementScalar: 1,
    position: { x: 0, y: 0 },
    speed: 3,
    targetPosition: { x: 100, y: 0 },
    turnAccumulator: ETHER_PRIMARY_INITIAL_TURN,
  })
  assert.deepEqual(advanced.position, { x: 0, y: -3 })
  assert.ok(advanced.headingDegrees > 1.8 && advanced.headingDegrees < 1.9)
  assert.equal(
    advanced.turnAccumulator,
    Math.fround(ETHER_PRIMARY_INITIAL_TURN + ETHER_PRIMARY_TURN_FAST_STEP),
  )
  assert.ok(advanced.direction.x > 0)
  assert.ok(advanced.direction.y < 0)
})

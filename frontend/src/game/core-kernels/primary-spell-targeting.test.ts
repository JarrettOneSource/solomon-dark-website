import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AIR_PRIMARY_CONE_HALF_ANGLE_DEGREES,
  AIR_PRIMARY_RETAIN_DOT,
  ETHER_PRIMARY_INITIAL_TURN,
  ETHER_PRIMARY_PROBE_DISTANCE,
  ETHER_PRIMARY_TURN_FAST_STEP,
  ETHER_PRIMARY_TURN_INPUT,
  airPrimaryBoltGeometry,
  advanceEtherPrimaryHoming,
  firstNativePrimaryPointContact,
  nativeHeadingTurnDirection,
  nativePrimaryConeTargets,
  nativePrimaryRootTargets,
  selectAirPrimaryTarget,
  selectEtherPrimaryTarget,
  type PrimarySpellTarget,
} from './primary-spell-targeting.ts'

const enemy = (
  id: string,
  x: number,
  y: number,
): PrimarySpellTarget => ({
  active: true,
  actorFlags: 0x2,
  attachment: { x: 0, y: 0 },
  bodyRadius: 20,
  id,
  kind: 'enemy',
  nativePriority: 0,
  pendingRemove: false,
  position: { x, y },
  registrationOrder: Number(id.replace(/\D/g, '')) || 0,
})

const grave = (
  id: string,
  x: number,
  y: number,
): PrimarySpellTarget => ({
  active: true,
  actorFlags: 0x4,
  attachment: { x: 0, y: 0 },
  bodyRadius: 0,
  id,
  kind: 'gravestone',
  nativePriority: 1000,
  pendingRemove: false,
  position: { x, y },
  registrationOrder: Number(id.replace(/\D/g, '')) || 0,
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

test('Air and Magic Missile preserve projected native per-cell order on exact target ties', () => {
  const first = {
    ...enemy('enemy:first', 0, -100),
    registrationOrder: 3,
  }
  const later = {
    ...enemy('enemy:later', 0, -100),
    registrationOrder: 8,
  }
  const reversedInput = [later, first]

  assert.equal(selectAirPrimaryTarget({
    aimDirection: { x: 0, y: -1 },
    hasLineOfSight: () => true,
    maxRange: 205,
    origin: { x: 0, y: 0 },
    previousTargetId: null,
    targets: reversedInput,
  })?.id, first.id)
  assert.equal(selectEtherPrimaryTarget({
    aimDirection: { x: 0, y: -1 },
    origin: { x: 0, y: 0 },
    targets: reversedInput,
  })?.id, first.id)
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
    turnInput: ETHER_PRIMARY_TURN_INPUT,
  })
  assert.deepEqual(advanced.position, { x: 0, y: -3 })
  assert.equal(advanced.headingDegrees, Math.fround(0.02))
  assert.equal(
    advanced.turnAccumulator,
    Math.fround(ETHER_PRIMARY_INITIAL_TURN + ETHER_PRIMARY_TURN_FAST_STEP),
  )
  assert.ok(advanced.direction.x > 0)
  assert.ok(advanced.direction.y < 0)
})

test('Magic Missile uses the native sign gate, inclusive cyclic deadband, and 180-degree tie order', () => {
  assert.equal(nativeHeadingTurnDirection(0, 90), 1)
  assert.equal(nativeHeadingTurnDirection(0, 270), -1)
  assert.equal(nativeHeadingTurnDirection(359, 1), 1)
  assert.equal(nativeHeadingTurnDirection(1, 359), -1)

  assert.equal(nativeHeadingTurnDirection(0, 1), 0)
  assert.equal(nativeHeadingTurnDirection(1, 0), 0)
  assert.equal(nativeHeadingTurnDirection(0, 359), 0)
  assert.equal(nativeHeadingTurnDirection(359, 0), 0)

  assert.equal(nativeHeadingTurnDirection(0, 180), 1)
  assert.equal(nativeHeadingTurnDirection(180, 0), -1)
})

test('underpowered Magic Missile combines its 0.75 turn lane with the 0.8 speed lane', () => {
  const full = advanceEtherPrimaryHoming({
    headingDegrees: 0,
    movementScalar: 1,
    position: { x: 0, y: 0 },
    speed: 3,
    targetPosition: { x: 100, y: 0 },
    turnAccumulator: ETHER_PRIMARY_INITIAL_TURN,
    turnInput: ETHER_PRIMARY_TURN_INPUT,
  })
  const weak = advanceEtherPrimaryHoming({
    headingDegrees: 0,
    movementScalar: 1,
    position: { x: 0, y: 0 },
    speed: Math.fround(2.4),
    targetPosition: { x: 100, y: 0 },
    turnAccumulator: ETHER_PRIMARY_INITIAL_TURN,
    turnInput: Math.fround(1.2),
  })
  assert.deepEqual(weak.position, { x: 0, y: Math.fround(-2.4) })
  assert.equal(
    weak.headingDegrees,
    Math.fround(Math.fround(1.2) * ETHER_PRIMARY_INITIAL_TURN),
  )
  assert.ok(weak.headingDegrees < full.headingDegrees)
})

test('Magic Missile grows its accumulator only while a target handle resolves', () => {
  const base = {
    headingDegrees: 0,
    movementScalar: 1,
    position: { x: 0, y: 0 },
    speed: 3,
    turnInput: ETHER_PRIMARY_TURN_INPUT,
  }
  const noTarget = advanceEtherPrimaryHoming({
    ...base,
    targetPosition: null,
    turnAccumulator: ETHER_PRIMARY_INITIAL_TURN,
  })
  assert.equal(noTarget.turnAccumulator, ETHER_PRIMARY_INITIAL_TURN)

  const atThreshold = advanceEtherPrimaryHoming({
    ...base,
    targetPosition: { x: 100, y: 0 },
    turnAccumulator: 1,
  })
  assert.equal(atThreshold.turnAccumulator, Math.fround(1 + ETHER_PRIMARY_TURN_FAST_STEP))

  const aboveThreshold = advanceEtherPrimaryHoming({
    ...base,
    targetPosition: { x: 100, y: 0 },
    turnAccumulator: atThreshold.turnAccumulator,
  })
  assert.equal(
    aboveThreshold.turnAccumulator,
    Math.fround(atThreshold.turnAccumulator + 0.0020000000949949026),
  )

  const capped = advanceEtherPrimaryHoming({
    ...base,
    targetPosition: { x: 100, y: 0 },
    turnAccumulator: Math.fround(9.999),
  })
  assert.equal(capped.turnAccumulator, 10)
})

test('native point contact uses trunc0 cells, strict radii, and projected slot order', () => {
  const fartherFirst = { ...enemy('enemy:1', 18, 0), bodyRadius: 2, registrationOrder: 1 }
  const nearerSecond = { ...enemy('enemy:2', 5, 0), bodyRadius: 20, registrationOrder: 2 }
  assert.equal(firstNativePrimaryPointContact({
    actorMask: 0x2,
    position: { x: 0, y: 0 },
    queryRadius: 20,
    targets: [nearerSecond, fartherFirst],
  })?.id, fartherFirst.id)

  assert.equal(firstNativePrimaryPointContact({
    actorMask: 0x2,
    position: { x: 0, y: 0 },
    queryRadius: 20,
    targets: [{ ...fartherFirst, position: { x: 22, y: 0 } }],
  }), null, 'strict equality must miss')

  assert.equal(firstNativePrimaryPointContact({
    actorMask: 0x2,
    position: { x: 99, y: 0 },
    queryRadius: 20,
    targets: [{ ...nearerSecond, position: { x: 101, y: 0 } }],
  }), null, 'native point query never crosses a spatial-cell boundary')

  assert.equal(firstNativePrimaryPointContact({
    actorMask: 0x2,
    position: { x: -0.25, y: 0 },
    queryRadius: 20,
    targets: [{ ...nearerSecond, position: { x: 0.25, y: 0 } }],
  })?.id, nearerSecond.id, 'native cell conversion truncates float32 toward zero')
})

test('all primary queries skip inactive, pending, and actor-flag-ineligible Coffins', () => {
  const coffin = {
    ...enemy('enemy:1', 0, -20),
    actorFlags: 0,
    bodyRadius: 45,
    registrationOrder: 1,
  }
  const skeleton = { ...enemy('enemy:2', 0, -100), registrationOrder: 2 }
  const targets = [coffin, skeleton]

  assert.equal(selectAirPrimaryTarget({
    aimDirection: { x: 0, y: -1 },
    hasLineOfSight: () => true,
    maxRange: 205,
    origin: { x: 0, y: 0 },
    previousTargetId: null,
    targets,
  })?.id, skeleton.id)
  assert.equal(selectEtherPrimaryTarget({
    aimDirection: { x: 0, y: -1 },
    origin: { x: 0, y: 0 },
    targets,
  })?.id, skeleton.id)
  assert.deepEqual(nativePrimaryConeTargets({
    actorMask: 0x1082,
    aimDirection: { x: 0, y: -1 },
    halfAngleDegrees: 15,
    hasLineOfSight: () => true,
    origin: { x: 0, y: 0 },
    reach: 205,
    targets,
  }).map(({ id }) => id), [skeleton.id])
})

test('Water cone uses root-only strict reach, LOS, aperture, and column-first cell order', () => {
  const atAngle = (id: string, distance: number, degrees: number, order: number) => ({
    ...enemy(id, Math.sin(degrees * Math.PI / 180) * distance, -Math.cos(degrees * Math.PI / 180) * distance),
    registrationOrder: order,
  })
  const laterNear = atAngle('enemy:2', 20, 0, 8)
  const firstFar = atAngle('enemy:1', 204.999, 14.999, 3)
  const exactReach = atAngle('enemy:3', 205, 0, 1)
  const outsideAngle = atAngle('enemy:4', 100, 15.01, 2)
  const hidden = atAngle('enemy:5', 100, 0, 4)
  const selected = nativePrimaryConeTargets({
    actorMask: 0x1082,
    aimDirection: { x: 0, y: -1 },
    halfAngleDegrees: 15,
    hasLineOfSight: ({ id }) => id !== hidden.id,
    origin: { x: 0, y: 0 },
    reach: 205,
    targets: [laterNear, outsideAngle, hidden, exactReach, firstFar],
  })
  assert.deepEqual(selected.map(({ id }) => id), [firstFar.id, laterNear.id])

  const leftColumn = {
    ...enemy('enemy:left-column', 199, 150),
    registrationOrder: 99,
  }
  const rightColumn = {
    ...enemy('enemy:right-column', 201, 150),
    registrationOrder: 1,
  }
  assert.deepEqual(nativePrimaryConeTargets({
    actorMask: 0x1082,
    aimDirection: { x: 0, y: -1 },
    halfAngleDegrees: 15,
    hasLineOfSight: () => true,
    origin: { x: 195, y: 300 },
    reach: 205,
    targets: [rightColumn, leftColumn],
  }).map(({ id }) => id), [leftColumn.id, rightColumn.id])
})

test('Earth root gather ignores body radius, rejects equality, and keeps column-first cell order', () => {
  const outsideBodyOverlap = {
    ...enemy('enemy:3', 76, 0),
    bodyRadius: 100,
    registrationOrder: 1,
  }
  const exactRoot = { ...enemy('enemy:2', 75, 0), registrationOrder: 2 }
  const laterNear = { ...enemy('enemy:1', 4, 0), registrationOrder: 8 }
  const firstFar = { ...enemy('enemy:4', 74.999, 0), registrationOrder: 3 }
  assert.deepEqual(nativePrimaryRootTargets(
    { x: 0, y: 0 },
    75,
    0x6,
    [laterNear, outsideBodyOverlap, exactRoot, firstFar],
  ).map(({ id }) => id), [firstFar.id, laterNear.id])


  const firstColumn = {
    ...enemy('enemy:first-column', 99, 150),
    registrationOrder: 99,
  }
  const nextColumn = {
    ...enemy('enemy:next-column', 101, 150),
    registrationOrder: 1,
  }
  assert.deepEqual(nativePrimaryRootTargets(
    { x: 100, y: 150 },
    75,
    0x6,
    [nextColumn, firstColumn],
  ).map(({ id }) => id), [firstColumn.id, nextColumn.id])
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CREATE_ENTRY_ANIMATION_MS,
  CREATE_ENTRY_CUPPED_MS,
  CREATE_ENTRY_RAISED_MS,
  CREATE_ENTRY_SETTLED_MS,
  CREATE_SELECTION_LEFT_CUPPED_MS,
  CREATE_SELECTION_LEFT_START_MS,
  CREATE_SELECTION_LEFT_SETTLED_MS,
  CREATE_SELECTION_RIGHT_CUPPED_MS,
  CREATE_SELECTION_RIGHT_RAISED_MS,
  CREATE_SELECTION_ANIMATION_MS,
  CREATE_SELECTION_SETTLED_MS,
  createDisciplineRevealMotionAt,
  createElementRevealMotionAt,
  createEntryMotionAt,
  createHandIdleOffsetAt,
  createSelectedElementMotionAt,
  createSelectionMotionAt,
} from './create-menu-motion.ts'

const closeTo = (actual: number, expected: number, tolerance = 1e-5) => {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`)
}

test('entry replays the native pre-open recurrence and hard pose thresholds', () => {
  assert.deepEqual(createEntryMotionAt(0).leftOffset, { x: -50, y: 200 })
  assert.deepEqual(createEntryMotionAt(199).leftOffset, { x: -50, y: 200 })

  const firstTravel = createEntryMotionAt(210)
  closeTo(firstTravel.leftOffset.x, -50.510101)
  closeTo(firstTravel.leftOffset.y, 201)
  assert.equal(firstTravel.leftPose, 'fist')
  assert.notDeepEqual(firstTravel.leftImpulse, { x: 0, y: 0 })

  const lastTravel = createEntryMotionAt(1_190)
  closeTo(lastTravel.leftOffset.x, -135.59648)
  closeTo(lastTravel.leftOffset.y, 299)
  assert.equal(lastTravel.leftPose, 'fist')

  assert.equal(createEntryMotionAt(CREATE_ENTRY_CUPPED_MS - 1).leftPose, 'fist')
  assert.equal(createEntryMotionAt(CREATE_ENTRY_CUPPED_MS).leftPose, 'cupped')
  assert.equal(createEntryMotionAt(CREATE_ENTRY_RAISED_MS).leftPose, 'raised')
  assert.deepEqual(createEntryMotionAt(CREATE_ENTRY_RAISED_MS).leftOffset, { x: 0, y: 0 })
  assert.equal(createEntryMotionAt(CREATE_ENTRY_RAISED_MS - 1).elementsVisible, false)
  assert.equal(createEntryMotionAt(CREATE_ENTRY_RAISED_MS).elementsVisible, true)
  assert.equal(createEntryMotionAt(CREATE_ENTRY_SETTLED_MS - 1).settled, false)
  assert.equal(createEntryMotionAt(CREATE_ENTRY_SETTLED_MS).settled, true)
  assert.deepEqual(createEntryMotionAt(10_000).rightOffset, { x: 50, y: 300 })
  assert.equal(createEntryMotionAt(10_000).rightPose, 'fist')
})

test('elements fan from the raised hand on the inclusive native fixed tick', () => {
  assert.equal(CREATE_ENTRY_ANIMATION_MS, 2_330)
  assert.deepEqual(createElementRevealMotionAt('air', CREATE_ENTRY_RAISED_MS - 1), {
    opacity: 0,
    position: { x: 775, y: 510 },
  })

  const first = createElementRevealMotionAt('air', CREATE_ENTRY_RAISED_MS)
  closeTo(first.opacity, 0.01)
  closeTo(first.position.x, 778.307679)
  closeTo(first.position.y, 521.535118)

  const second = createElementRevealMotionAt('air', CREATE_ENTRY_RAISED_MS + 10)
  closeTo(second.opacity, 0.02)
  closeTo(second.position.x, 781.350745)
  closeTo(second.position.y, 532.147427)

  const settled = createElementRevealMotionAt('air', CREATE_ENTRY_ANIMATION_MS)
  assert.equal(settled.opacity, 1)
  closeTo(settled.position.x, 816.346, 0.05)
  closeTo(settled.position.y, 654.189, 0.05)
})

test('selection closes left with its two-substep recurrence before right opens', () => {
  const beforeTravel = createSelectionMotionAt(CREATE_SELECTION_LEFT_START_MS - 1)
  assert.deepEqual(beforeTravel.leftOffset, { x: 0, y: 0 })
  assert.equal(beforeTravel.leftPose, 'raised')
  assert.deepEqual(beforeTravel.rightOffset, { x: 50, y: 300 })
  assert.equal(beforeTravel.rightPose, 'fist')
  assert.equal(beforeTravel.disciplinesVisible, false)

  const firstNativeTravelTick = createSelectionMotionAt(
    CREATE_SELECTION_LEFT_START_MS + 10,
  ).leftOffset
  closeTo(firstNativeTravelTick.x, -0.00875)
  closeTo(firstNativeTravelTick.y, 0.538125)
  assert.equal(createSelectionMotionAt(CREATE_SELECTION_LEFT_CUPPED_MS).leftPose, 'cupped')
  assert.deepEqual(createSelectionMotionAt(CREATE_SELECTION_LEFT_SETTLED_MS).leftOffset, {
    x: -125.90988,
    y: 200,
  })
})

test('selected element holds at its picker then follows the native closing-hand spline', () => {
  const airStart = { x: 816.346, y: 654.189 }
  assert.deepEqual(createSelectedElementMotionAt('air', 0), {
    position: airStart,
    scale: 1,
  })
  assert.deepEqual(
    createSelectedElementMotionAt('air', CREATE_SELECTION_LEFT_START_MS - 1),
    { position: airStart, scale: 1 },
  )

  const moving = createSelectedElementMotionAt('air', CREATE_SELECTION_LEFT_START_MS + 200)
  assert.notDeepEqual(moving.position, airStart)
  assert.ok(moving.position.x < airStart.x)
  assert.ok(moving.position.y > airStart.y)
  assert.ok(moving.scale > 1 && moving.scale < 3)

  const settled = createSelectedElementMotionAt('air', CREATE_SELECTION_LEFT_SETTLED_MS)
  assert.deepEqual(settled, { position: { x: 450, y: 660 }, scale: 3 })
  assert.deepEqual(
    createSelectedElementMotionAt('earth', CREATE_SELECTION_LEFT_SETTLED_MS),
    settled,
  )
})

test('each element path starts from its recovered native picker center', () => {
  assert.deepEqual(createSelectedElementMotionAt('ether', 0).position, { x: 826.303, y: 369.046 })
  assert.deepEqual(createSelectedElementMotionAt('fire', 0).position, { x: 924.909, y: 515.235 })
  assert.deepEqual(createSelectedElementMotionAt('water', 0).position, { x: 650.644, y: 593.879 })
  assert.deepEqual(createSelectedElementMotionAt('earth', 0).position, { x: 656.798, y: 417.651 })
})

test('right discipline hand matches every recovered native turning point', () => {
  const first = createSelectionMotionAt(CREATE_SELECTION_LEFT_SETTLED_MS + 10)
  closeTo(first.rightOffset.x, 50.4899)
  closeTo(first.rightOffset.y, 301)

  const turn = createSelectionMotionAt(CREATE_SELECTION_LEFT_SETTLED_MS + 500)
  closeTo(turn.rightOffset.x, 81.58047)
  closeTo(turn.rightOffset.y, 350)

  const firstDamped = createSelectionMotionAt(CREATE_SELECTION_LEFT_SETTLED_MS + 510)
  closeTo(firstDamped.rightOffset.x, 57.10558)
  closeTo(firstDamped.rightOffset.y, 278.2731)
  assert.equal(firstDamped.rightPose, 'fist')

  assert.equal(createSelectionMotionAt(CREATE_SELECTION_RIGHT_CUPPED_MS - 1).rightPose, 'fist')
  assert.equal(createSelectionMotionAt(CREATE_SELECTION_RIGHT_CUPPED_MS).rightPose, 'cupped')
  assert.equal(createSelectionMotionAt(CREATE_SELECTION_RIGHT_RAISED_MS).rightPose, 'raised')
  assert.deepEqual(createSelectionMotionAt(CREATE_SELECTION_RIGHT_RAISED_MS).rightOffset, { x: 0, y: 0 })
  assert.equal(createSelectionMotionAt(CREATE_SELECTION_RIGHT_RAISED_MS).disciplinesVisible, true)
  assert.equal(createSelectionMotionAt(CREATE_SELECTION_SETTLED_MS - 1).settled, false)
  assert.equal(createSelectionMotionAt(CREATE_SELECTION_SETTLED_MS).settled, true)
})

test('discipline glyphs slide left from the native fifty-pixel offset', () => {
  assert.equal(CREATE_SELECTION_ANIMATION_MS, 2_630)
  assert.deepEqual(
    createDisciplineRevealMotionAt('arcane', CREATE_SELECTION_RIGHT_RAISED_MS - 1),
    { x: 1075, y: 460 },
  )
  const first = createDisciplineRevealMotionAt('arcane', CREATE_SELECTION_RIGHT_RAISED_MS)
  closeTo(first.x, 1071.000001)
  assert.equal(first.y, 460)
  const second = createDisciplineRevealMotionAt(
    'arcane',
    CREATE_SELECTION_RIGHT_RAISED_MS + 10,
  )
  closeTo(second.x, 1067.320001)

  const settled = createDisciplineRevealMotionAt('arcane', CREATE_SELECTION_ANIMATION_MS)
  closeTo(settled.x, 1025, 0.02)
  assert.equal(settled.y, 460)
})

test('hand idle drift follows the native 0.5-degree 100 Hz clocks', () => {
  assert.deepEqual(createHandIdleOffsetAt(0), { x: 0, y: 0 })

  const quarter = createHandIdleOffsetAt(1_800)
  closeTo(quarter.x, 5)
  closeTo(quarter.y, Math.SQRT1_2 * 2.5)

  const half = createHandIdleOffsetAt(3_600)
  closeTo(half.x, 0)
  closeTo(half.y, 2.5)

  const fullHorizontalCycle = createHandIdleOffsetAt(7_200)
  closeTo(fullHorizontalCycle.x, 0)
  closeTo(fullHorizontalCycle.y, 0)
})

test('hand clocks clamp negative time and advance only on fixed ticks', () => {
  assert.deepEqual(createHandIdleOffsetAt(-100), { x: 0, y: 0 })
  assert.deepEqual(createHandIdleOffsetAt(9), { x: 0, y: 0 })
  assert.notDeepEqual(createHandIdleOffsetAt(10), { x: 0, y: 0 })
  assert.deepEqual(createEntryMotionAt(209).leftOffset, createEntryMotionAt(200).leftOffset)
  assert.deepEqual(
    createSelectionMotionAt(CREATE_SELECTION_LEFT_SETTLED_MS + 19).rightOffset,
    createSelectionMotionAt(CREATE_SELECTION_LEFT_SETTLED_MS + 10).rightOffset,
  )
})

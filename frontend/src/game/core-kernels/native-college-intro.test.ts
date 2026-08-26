import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_COLLEGE_COURTYARD_PATH,
  NATIVE_COLLEGE_OFFICE_PATH,
  NATIVE_COLLEGE_TITLE_CURSOR_STEP,
  nativeCollegeContactStep,
  nativeCollegeOfficeSpeed,
  nativeCollegePathTarget,
  nativeCollegeTitlePresentation,
} from './native-college-intro.ts'

test('drains the complete authored Courtyard and Office admission splines', () => {
  assert.deepEqual(NATIVE_COLLEGE_COURTYARD_PATH, [
    { x: 972, y: 1_044 },
    { x: 1_074, y: 839 },
    { x: 1_119, y: 611 },
    { x: 1_167, y: 441 },
    { x: 1_164, y: 275 },
    { x: 1_095, y: 187 },
    { x: 1_017, y: 193 },
    { x: 963, y: 178 },
    { x: 956, y: 105 },
    { x: 957, y: 27 },
  ])
  assert.deepEqual(NATIVE_COLLEGE_OFFICE_PATH, [
    { x: 400, y: 773 },
    { x: 380, y: 722 },
    { x: 263, y: 636 },
    { x: 289, y: 509 },
    { x: 396, y: 471 },
    { x: 420, y: 445 },
    { x: 420, y: 415 },
  ])
  assert.equal(NATIVE_COLLEGE_TITLE_CURSOR_STEP, 0.005200000014156103)
})

test('targets at least Courtyard segment one and advances only inside the strict ten-unit edge', () => {
  const first = nativeCollegePathTarget('courtyard-walk', 0, { x: 972, y: 1_044 })
  assert.equal(first.pathCursor, 1)
  assert.deepEqual(first.target, { x: 1_074, y: 839 })

  const exactTen = nativeCollegePathTarget(
    'courtyard-walk',
    1,
    { x: first.target.x + 10, y: first.target.y },
  )
  assert.equal(exactTen.pathCursor, 1)

  const inside = nativeCollegePathTarget(
    'courtyard-walk',
    1,
    { x: first.target.x + 9.999, y: first.target.y },
  )
  assert.equal(inside.pathCursor, 1.25)
})

test('switches the two title cards at cursor four and preserves the uncovered logo product', () => {
  assert.deepEqual(nativeCollegeTitlePresentation(0, 1), {
    alpha: 0,
    record: 7,
    y: 250,
  })
  assert.equal(nativeCollegeTitlePresentation(4, 0.5).record, 7)
  const logo = nativeCollegeTitlePresentation(4 + NATIVE_COLLEGE_TITLE_CURSOR_STEP, 0.5)
  assert.equal(logo.record, 9)
  assert.equal(logo.y, 450)
  assert.ok(logo.alpha >= 0 && logo.alpha <= 0.5)
})

test('decays Office speed after cursor four and triggers automatic Chat on contact six', () => {
  assert.equal(nativeCollegeOfficeSpeed(4, 1), 1)
  assert.equal(nativeCollegeOfficeSpeed(4.25, 1), Math.fround(0.99000001))
  let counter = 0
  for (let contact = 0; contact < 5; contact += 1) {
    const stepped = nativeCollegeContactStep(counter, true)
    counter = stepped.counter
    assert.equal(stepped.activate, false)
  }
  assert.equal(counter, 10)
  assert.deepEqual(nativeCollegeContactStep(counter, true), {
    activate: true,
    counter: 0,
  })
  assert.deepEqual(nativeCollegeContactStep(8, false), {
    activate: false,
    counter: 0,
  })
})

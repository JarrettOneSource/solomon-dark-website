import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_COLLEGE_COURTYARD_PATH,
  NATIVE_COLLEGE_OFFICE_PATH,
  NATIVE_COLLEGE_TITLE_CURSOR_STEP,
  createNativeCollegeIntroState,
  nativeCollegeContactStep,
  nativeCollegeOfficeSpeed,
  nativeCollegePathHeadingIndex,
  nativeCollegePathTarget,
  nativeCollegeTitlePresentation,
  stepNativeCollegeTitle,
} from './native-college-intro.ts'
import { createNativeRng } from './native-rng.ts'
import {
  NATIVE_STARTER_EQUIPMENT_BASE_COLORS,
  rollNativeStarterEquipmentAppearance,
} from './native-starter-equipment.ts'

test('rolls every native starter garment base and the pre-Create College override', () => {
  assert.deepEqual(NATIVE_STARTER_EQUIPMENT_BASE_COLORS, {
    air: [0.1, 1, 1],
    college: [0.25, 0.5, 0.25],
    earth: [0, 0.75, 0],
    ether: [1, 0.1, 1],
    fire: [1, 0.1, 0.1],
    water: [0.1, 0.5, 1],
  })

  const appearances = Object.keys(NATIVE_STARTER_EQUIPMENT_BASE_COLORS).map((kind) => (
    rollNativeStarterEquipmentAppearance(
      createNativeRng(0x1357_9bdf),
      kind as keyof typeof NATIVE_STARTER_EQUIPMENT_BASE_COLORS,
    )
  ))
  assert.equal(new Set(appearances.map(({ primaryTint }) => primaryTint)).size, 6)
  for (const appearance of appearances) {
    assert.equal(appearance.secondaryTint, 0xffffff)
    assert.equal(appearance.rng.indexA, 3)
    assert.equal(appearance.rng.indexB, 34)
  }

  const college = rollNativeStarterEquipmentAppearance(createNativeRng(0x1357_9bdf), 'college')
  assert.equal(college.primaryTint, 0x687769)
  assert.ok((college.primaryTint >> 16) < ((college.primaryTint >> 8) & 0xff))
  assert.ok((college.primaryTint & 0xff) < ((college.primaryTint >> 8) & 0xff))
})

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
  assert.equal(nativeCollegePathHeadingIndex(
    'courtyard-walk',
    0,
    NATIVE_COLLEGE_COURTYARD_PATH[0],
  ), 2)

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

test('runs the complete stock College title timeline on authoritative ticks', () => {
  let state = createNativeCollegeIntroState()
  assert.deepEqual(nativeCollegeTitlePresentation(state.titleCursor, state.coverAlpha), {
    alpha: 0,
    record: 7,
    y: 250,
  })

  for (let tick = 1; tick <= 769; tick += 1) state = stepNativeCollegeTitle(state)
  assert.equal(state.titleCursor, 3.9988000108860433)
  assert.equal(nativeCollegeTitlePresentation(state.titleCursor, state.coverAlpha).record, 7)

  state = stepNativeCollegeTitle(state)
  assert.equal(state.titleCursor, 4.004000010900199)
  assert.equal(nativeCollegeTitlePresentation(state.titleCursor, state.coverAlpha).record, 9)

  for (let tick = 771; tick <= 962; tick += 1) state = stepNativeCollegeTitle(state)
  assert.equal(state.titleCursor, 5)
  const terminal = nativeCollegeTitlePresentation(state.titleCursor, state.coverAlpha)
  assert.equal(terminal.record, 9)
  const alphaAtTerminalCursor = terminal.alpha

  state = stepNativeCollegeTitle(state)
  assert.equal(state.titleCursor, 5)
  assert.ok(
    nativeCollegeTitlePresentation(state.titleCursor, state.coverAlpha).alpha
      > alphaAtTerminalCursor,
  )
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

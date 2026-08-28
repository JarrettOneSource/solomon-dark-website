import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  MOBILE_JOYSTICK_BASE,
  MOBILE_JOYSTICK_BOTTOM_INSET,
  MOBILE_JOYSTICK_EDGE_INSET,
  MOBILE_JOYSTICK_KNOB,
  MOBILE_QUICKBAR_BANK_BOTTOM,
  MOBILE_QUICKBAR_BANK_INSET,
  MOBILE_QUICKBAR_BANK_MIN_INSET,
  MOBILE_QUICKBAR_SLOT_GAP,
  MOBILE_QUICKBAR_SLOT_MIN_SIZE,
  MOBILE_QUICKBAR_SLOT_SIZE,
  MOBILE_DOCK_HALF_WIDTH,
  MOBILE_QUICKBAR_DOCK_GAP,
  mobileQuickbarBankLayout,
  mobileQuickbarSlotPlacement,
} from './mobile-quickbar-layout.ts'

// iPhone XR landscape: 896 x 414 CSS px -> display scale 0.46 -> 1947.83 logical px wide.
const XR_LOGICAL_WIDTH = 896 / 0.46

test('joystick constants are the 2026-08-21 geometry scaled by exactly 1.25', () => {
  assert.equal(MOBILE_JOYSTICK_BASE, 190 * 1.25)
  assert.equal(MOBILE_JOYSTICK_KNOB, 80 * 1.25)
})

test('slots split into two mirrored 2x2 banks that keep native slot order', () => {
  const size = MOBILE_QUICKBAR_SLOT_SIZE
  const pitch = size + MOBILE_QUICKBAR_SLOT_GAP
  const bank = { inset: MOBILE_QUICKBAR_BANK_INSET, size }
  const placements = Array.from({ length: 8 }, (_, slot) => mobileQuickbarSlotPlacement(slot, bank))
  assert.deepEqual(placements.map((placement) => placement.bank), [
    'left', 'left', 'left', 'left', 'right', 'right', 'right', 'right',
  ])
  // Left bank: [0 1 / 2 3], columns grow rightward from the left edge.
  assert.deepEqual(placements.slice(0, 4).map(({ inset, bottom }) => [inset, bottom]), [
    [MOBILE_QUICKBAR_BANK_INSET, MOBILE_QUICKBAR_BANK_BOTTOM + pitch],
    [MOBILE_QUICKBAR_BANK_INSET + pitch, MOBILE_QUICKBAR_BANK_BOTTOM + pitch],
    [MOBILE_QUICKBAR_BANK_INSET, MOBILE_QUICKBAR_BANK_BOTTOM],
    [MOBILE_QUICKBAR_BANK_INSET + pitch, MOBILE_QUICKBAR_BANK_BOTTOM],
  ])
  // Right bank: [4 5 / 6 7], slot 4 is inboard (larger inset from the right edge).
  assert.deepEqual(placements.slice(4).map(({ inset, bottom }) => [inset, bottom]), [
    [MOBILE_QUICKBAR_BANK_INSET + pitch, MOBILE_QUICKBAR_BANK_BOTTOM + pitch],
    [MOBILE_QUICKBAR_BANK_INSET, MOBILE_QUICKBAR_BANK_BOTTOM + pitch],
    [MOBILE_QUICKBAR_BANK_INSET + pitch, MOBILE_QUICKBAR_BANK_BOTTOM],
    [MOBILE_QUICKBAR_BANK_INSET, MOBILE_QUICKBAR_BANK_BOTTOM],
  ])
  assert.ok(placements.every((placement) => placement.size === size))
  assert.throws(() => mobileQuickbarSlotPlacement(8, bank), RangeError)
  assert.throws(() => mobileQuickbarSlotPlacement(-1, bank), RangeError)
  assert.throws(() => mobileQuickbarSlotPlacement(1.5, bank), RangeError)
  assert.throws(() => mobileQuickbarSlotPlacement(0, { inset: bank.inset, size: 0 }), RangeError)
  assert.throws(() => mobileQuickbarSlotPlacement(0, { inset: 0, size }), RangeError)
})

test('the bank clears the joystick on its own edge', () => {
  assert.ok(
    MOBILE_QUICKBAR_BANK_INSET >= MOBILE_JOYSTICK_EDGE_INSET + MOBILE_JOYSTICK_BASE + 24,
    'bank inset must leave a thumb gap beyond the joystick',
  )
  assert.equal(MOBILE_QUICKBAR_BANK_MIN_INSET, MOBILE_JOYSTICK_EDGE_INSET + MOBILE_JOYSTICK_BASE + 8)
  const joystickTop = MOBILE_JOYSTICK_BOTTOM_INSET + MOBILE_JOYSTICK_BASE
  const bankTop = MOBILE_QUICKBAR_BANK_BOTTOM + 2 * MOBILE_QUICKBAR_SLOT_SIZE + MOBILE_QUICKBAR_SLOT_GAP
  assert.ok(Math.abs(joystickTop - bankTop) < 40, 'bank and joystick share the thumb band')
})

test('full slots at the preferred inset at uiScale <= 125% on an XR and at the 1600 logical floor', () => {
  const full = { inset: MOBILE_QUICKBAR_BANK_INSET, size: MOBILE_QUICKBAR_SLOT_SIZE }
  for (const uiScale of [0.75, 1, 1.25]) {
    assert.deepEqual(mobileQuickbarBankLayout(XR_LOGICAL_WIDTH, uiScale), full, `uiScale ${uiScale}`)
  }
  // 16:9 at the 1600-wide logical floor (e.g. 667 x 375) keeps the full layout at 100%.
  assert.deepEqual(mobileQuickbarBankLayout(1600, 1), full)
  assert.throws(() => mobileQuickbarBankLayout(0, 1), RangeError)
  assert.throws(() => mobileQuickbarBankLayout(XR_LOGICAL_WIDTH, Number.NaN), RangeError)
})

test('the thumb gap yields before the slots shrink and the bank never crosses the dock', () => {
  const fullBankWidth = 2 * MOBILE_QUICKBAR_SLOT_SIZE + MOBILE_QUICKBAR_SLOT_GAP
  // 1500 logical px at 100%: full slots fit only by giving up part of the thumb gap.
  const yielded = mobileQuickbarBankLayout(1500, 1)
  assert.equal(yielded.size, MOBILE_QUICKBAR_SLOT_SIZE)
  assert.ok(yielded.inset < MOBILE_QUICKBAR_BANK_INSET && yielded.inset >= MOBILE_QUICKBAR_BANK_MIN_INSET, `inset ${yielded.inset}`)
  assert.equal(yielded.inset + fullBankWidth, 750 - MOBILE_DOCK_HALF_WIDTH - MOBILE_QUICKBAR_DOCK_GAP)
  // XR at 150% and 667 x 375 at 125%: even the minimum gap cannot host full slots, so the
  // slots shrink to the touch floor at the minimum inset.
  for (const [logicalWidth, uiScale] of [[XR_LOGICAL_WIDTH, 1.5], [1600, 1.25]] as const) {
    const floor = mobileQuickbarBankLayout(logicalWidth, uiScale)
    assert.equal(floor.inset, MOBILE_QUICKBAR_BANK_MIN_INSET, `${logicalWidth} x ${uiScale} inset`)
    assert.equal(floor.size, MOBILE_QUICKBAR_SLOT_MIN_SIZE, `${logicalWidth} x ${uiScale} size`)
  }
  // The floor itself is bounded by the narrowest supported case (1600 logical at 125%):
  // a floor that crosses the dock there is not a floor.
  assert.ok(
    MOBILE_QUICKBAR_BANK_MIN_INSET + 2 * MOBILE_QUICKBAR_SLOT_MIN_SIZE + MOBILE_QUICKBAR_SLOT_GAP
      <= 1600 / 1.25 / 2 - MOBILE_DOCK_HALF_WIDTH,
    'slot floor crosses the dock at 1600 x 1.25',
  )
  for (const [logicalWidth, uiScale] of [[XR_LOGICAL_WIDTH, 1.5], [1600, 1.25], [1500, 1], [XR_LOGICAL_WIDTH, 1]] as const) {
    const { inset, size } = mobileQuickbarBankLayout(logicalWidth, uiScale)
    const rootHalfWidth = logicalWidth / uiScale / 2
    assert.ok(inset >= MOBILE_JOYSTICK_EDGE_INSET + MOBILE_JOYSTICK_BASE + 8, `bank overlaps the joystick at ${logicalWidth} x ${uiScale}`)
    assert.ok(inset + 2 * size + MOBILE_QUICKBAR_SLOT_GAP <= rootHalfWidth - MOBILE_DOCK_HALF_WIDTH, `bank overlaps the dock at ${logicalWidth} x ${uiScale}`)
  }
})

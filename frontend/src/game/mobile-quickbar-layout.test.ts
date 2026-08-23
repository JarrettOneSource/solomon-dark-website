import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  MOBILE_JOYSTICK_BASE,
  MOBILE_JOYSTICK_BOTTOM_INSET,
  MOBILE_JOYSTICK_EDGE_INSET,
  MOBILE_JOYSTICK_KNOB,
  MOBILE_QUICKBAR_BANK_BOTTOM,
  MOBILE_QUICKBAR_BANK_INSET,
  MOBILE_QUICKBAR_SLOT_GAP,
  MOBILE_QUICKBAR_SLOT_MIN_SIZE,
  MOBILE_QUICKBAR_SLOT_SIZE,
  mobileQuickbarSlotPlacement,
  mobileQuickbarSlotSize,
} from './mobile-quickbar-layout.ts'

// iPhone XR landscape: 896 x 414 CSS px -> display scale 0.46 -> 1947.83 logical px wide.
const XR_LOGICAL_WIDTH = 896 / 0.46

function cssRule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  assert.ok(match, `expected a rule for ${selector}`)
  return match[1]
}

test('joystick constants are the 2026-08-21 geometry scaled by exactly 1.25', () => {
  assert.equal(MOBILE_JOYSTICK_BASE, 190 * 1.25)
  assert.equal(MOBILE_JOYSTICK_KNOB, 80 * 1.25)
})

test('slots split into two mirrored 2x2 banks that keep native slot order', () => {
  const size = MOBILE_QUICKBAR_SLOT_SIZE
  const pitch = size + MOBILE_QUICKBAR_SLOT_GAP
  const placements = Array.from({ length: 8 }, (_, slot) => mobileQuickbarSlotPlacement(slot, size))
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
  assert.throws(() => mobileQuickbarSlotPlacement(8, size), RangeError)
  assert.throws(() => mobileQuickbarSlotPlacement(-1, size), RangeError)
  assert.throws(() => mobileQuickbarSlotPlacement(1.5, size), RangeError)
  assert.throws(() => mobileQuickbarSlotPlacement(0, 0), RangeError)
})

test('the bank clears the joystick on its own edge', () => {
  assert.ok(
    MOBILE_QUICKBAR_BANK_INSET >= MOBILE_JOYSTICK_EDGE_INSET + MOBILE_JOYSTICK_BASE + 24,
    'bank inset must leave a thumb gap beyond the joystick',
  )
  const joystickTop = MOBILE_JOYSTICK_BOTTOM_INSET + MOBILE_JOYSTICK_BASE
  const bankTop = MOBILE_QUICKBAR_BANK_BOTTOM + 2 * MOBILE_QUICKBAR_SLOT_SIZE + MOBILE_QUICKBAR_SLOT_GAP
  assert.ok(Math.abs(joystickTop - bankTop) < 40, 'bank and joystick share the thumb band')
})

test('slot size stays full at uiScale <= 125% on an XR and shrinks instead of overlapping at 150%', () => {
  for (const uiScale of [0.75, 1, 1.25]) {
    assert.equal(mobileQuickbarSlotSize(XR_LOGICAL_WIDTH, uiScale), MOBILE_QUICKBAR_SLOT_SIZE, `uiScale ${uiScale}`)
  }
  const shrunk = mobileQuickbarSlotSize(XR_LOGICAL_WIDTH, 1.5)
  assert.ok(shrunk < MOBILE_QUICKBAR_SLOT_SIZE && shrunk >= MOBILE_QUICKBAR_SLOT_MIN_SIZE, `shrunk ${shrunk}`)
  // The bank's inboard edge must still clear the dock's outer potion at that scale.
  const rootHalfWidth = XR_LOGICAL_WIDTH / 1.5 / 2
  const bankInboardEdge = MOBILE_QUICKBAR_BANK_INSET + 2 * shrunk + MOBILE_QUICKBAR_SLOT_GAP
  assert.ok(bankInboardEdge <= rootHalfWidth - 215, 'shrunk bank overlaps the dock')
  // 16:9 at the 1600-wide logical floor (e.g. 667 x 375) keeps the full size at 100%.
  assert.equal(mobileQuickbarSlotSize(1600, 1), MOBILE_QUICKBAR_SLOT_SIZE)
  assert.throws(() => mobileQuickbarSlotSize(0, 1), RangeError)
  assert.throws(() => mobileQuickbarSlotSize(XR_LOGICAL_WIDTH, Number.NaN), RangeError)
})

test('touch joystick CSS carries the shared constants', () => {
  const styles = readFileSync(new URL('./input/touch-joystick.css', import.meta.url), 'utf8')
  const base = cssRule(styles, '.game-touch-joystick')
  assert.match(base, new RegExp(`width:\\s*${MOBILE_JOYSTICK_BASE}px;`))
  assert.match(base, new RegExp(`height:\\s*${MOBILE_JOYSTICK_BASE}px;`))
  assert.match(base, new RegExp(`bottom:\\s*calc\\(${MOBILE_JOYSTICK_BOTTOM_INSET}px \\* var\\(--game-ui-scale, 1\\)\\);`))
  const knob = cssRule(styles, '.game-touch-joystick-knob')
  assert.match(knob, new RegExp(`width:\\s*${MOBILE_JOYSTICK_KNOB}px;`))
  assert.match(knob, new RegExp(`height:\\s*${MOBILE_JOYSTICK_KNOB}px;`))
  const movement = cssRule(styles, '.game-touch-joystick-movement')
  assert.match(movement, new RegExp(`left:\\s*calc\\(${MOBILE_JOYSTICK_EDGE_INSET}px \\* var\\(--game-ui-scale, 1\\)`))
  assert.match(movement, /safe-area-inset-left/)
  const primary = cssRule(styles, '.game-touch-joystick-primary')
  assert.match(primary, new RegExp(`right:\\s*calc\\(${MOBILE_JOYSTICK_EDGE_INSET}px \\* var\\(--game-ui-scale, 1\\)`))
  assert.match(primary, /safe-area-inset-right/)
})

test('coarse quickbar CSS reads the per-slot bank placement variables', () => {
  const styles = readFileSync(new URL('./hub.css', import.meta.url), 'utf8')
  const coarse = styles.slice(styles.indexOf('@media (hover: none) and (pointer: coarse)'))
  assert.match(coarse, /\.hub-hud-quickbar-slot\s*\{[^}]*bottom:\s*var\(--mobile-quickbar-slot-bottom\);/)
  assert.match(coarse, /\.hub-hud-quickbar-slot\s*\{[^}]*width:\s*var\(--mobile-quickbar-slot-size\);/)
  assert.match(coarse, /\.hub-hud-quickbar-slot\[data-quickbar-bank='left'\]\s*\{[^}]*left:\s*calc\(var\(--mobile-quickbar-slot-inset\)/)
  assert.match(coarse, /\.hub-hud-quickbar-slot\[data-quickbar-bank='right'\]\s*\{[^}]*right:\s*calc\(var\(--mobile-quickbar-slot-inset\)/)
  assert.doesNotMatch(coarse, /--mobile-quickbar-slot-offset/)
})

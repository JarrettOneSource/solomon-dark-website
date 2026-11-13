import assert from 'node:assert/strict'
import test from 'node:test'

import { placePartyChip } from './party-chip-placement.ts'

const viewport = { width: 1600, height: 900 }
const card = { x: 11, y: 174, width: 236, height: 98 }
const callout = { x: 175, y: 244, width: 236, height: 130 }

test('Party leaves the College callout clear after the camera moves it into the card', () => {
  assert.deepEqual(placePartyChip(card, viewport, [callout]), { x: 11, y: 378 })
  assert.deepEqual(placePartyChip(card, viewport, []), { x: 11, y: 174 })
  assert.deepEqual(placePartyChip(card, viewport, [{ ...callout, x: 300 }]), { x: 11, y: 174 })
})

test('expanded Party clears both hints and stays inside a compact viewport', () => {
  const compact = { width: 896, height: 414 }
  const expanded = { x: 6, y: 54, width: 129.8, height: 200 }
  const hints = [
    { x: 0, y: 120, width: 150, height: 90 },
    { x: 125, y: 270, width: 120, height: 100 },
  ]
  const position = placePartyChip(expanded, compact, hints)
  assert.deepEqual(position, { x: 154, y: 54 })
  assert.ok(position.x + expanded.width <= compact.width)
  assert.ok(position.y + expanded.height <= compact.height)
})

test('offscreen guidance cannot push Party, and taller rows use the same geometry', () => {
  assert.deepEqual(placePartyChip(card, viewport, [{ ...callout, y: -200 }]), { x: 11, y: 174 })
  assert.deepEqual(placePartyChip({ ...card, height: 630 }, viewport, [callout]), { x: 415, y: 174 })
})

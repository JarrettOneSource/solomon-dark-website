import assert from 'node:assert/strict'
import test from 'node:test'

import {
  HUB_TRADER_DIALOGUES,
  HUB_TRADER_GRID_CAPACITY,
  HUB_TRADER_NATIVE_UI_RECORDS,
  equipmentSlotsForItem,
  hubTraderAtPoint,
  hubTraderWithinServiceRange,
  nearestHubTrader,
} from './hub-inventory-presentation.ts'

test('merchant dialogue exposes only the four reachable retail service commands', () => {
  assert.deepEqual(
    Object.values(HUB_TRADER_DIALOGUES).map(({ actionLabel }) => actionLabel),
    ['Buy Charms and Curses', 'Buy', 'Examine Items', 'Dowse'],
  )
  assert.equal(JSON.stringify(HUB_TRADER_DIALOGUES).includes('Outfit me Randomly'), false)
  assert.equal(HUB_TRADER_DIALOGUES.hagatha.intro[0], 'All right then wizard, what do you need?')
  assert.equal(HUB_TRADER_DIALOGUES.fomentius.intro[0], 'Hello Hello!')
  assert.equal(HUB_TRADER_DIALOGUES.shlorio.name, 'Shlorio the Dowser')
})

test('merchant proximity uses the exact native radius formula and room ownership', () => {
  assert.equal(hubTraderWithinServiceRange('hagatha', 'courtyard', { x: 1340, y: 280 }), true)
  assert.equal(hubTraderWithinServiceRange('hagatha', 'library', { x: 1340, y: 280 }), false)
  assert.equal(hubTraderWithinServiceRange('hagatha', 'courtyard', {
    x: 1340 + Math.sqrt(5 * 15 * 15 + 1500),
    y: 280,
  }), true)
  assert.equal(hubTraderWithinServiceRange('hagatha', 'courtyard', { x: 1392, y: 280 }), false)
  assert.equal(nearestHubTrader('library', { x: 900, y: 642.5 }), 'shlorio')
  assert.equal(hubTraderAtPoint('courtyard', { x: 1355, y: 280 }), 'hagatha')
  assert.equal(hubTraderAtPoint('courtyard', { x: 1355.01, y: 280 }), null)
  assert.equal(hubTraderAtPoint('library', { x: 900, y: 642.5 }), 'shlorio')
  assert.equal(hubTraderAtPoint('courtyard', { x: 900, y: 642.5 }), null)
})

test('native shop membership retains padded grids and every required atlas row', () => {
  assert.deepEqual(HUB_TRADER_GRID_CAPACITY, { fomentius: 28, shlorio: 9 })
  assert.deepEqual(HUB_TRADER_NATIVE_UI_RECORDS.Skills, [
    4, ...Array.from({ length: 28 }, (_, index) => 127 + index),
  ])
  assert.deepEqual(HUB_TRADER_NATIVE_UI_RECORDS.UI, [15, 20, 21, 30, 31, 33, 49, 62, 75, 76, 77])
})

test('all seven equipment sinks are reachable and the third ring remains gated', () => {
  assert.deepEqual(equipmentSlotsForItem({ equipmentType: 'hat' }, false), ['hat'])
  assert.deepEqual(equipmentSlotsForItem({ equipmentType: 'robe' }, false), ['robe'])
  assert.deepEqual(equipmentSlotsForItem({ equipmentType: 'amulet' }, false), ['amulet'])
  assert.deepEqual(equipmentSlotsForItem({ equipmentType: 'wand' }, false), ['weapon'])
  assert.deepEqual(equipmentSlotsForItem({ equipmentType: 'staff' }, false), ['weapon'])
  assert.deepEqual(equipmentSlotsForItem({ equipmentType: 'ring' }, false), ['ring-0', 'ring-1'])
  assert.deepEqual(equipmentSlotsForItem({ equipmentType: 'ring' }, true), ['ring-0', 'ring-1', 'ring-2'])
})

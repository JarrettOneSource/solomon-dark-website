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
  assert.equal(HUB_TRADER_DIALOGUES.hagatha.intro[0], 'All right then wizard, what do you want?')
  assert.equal(HUB_TRADER_DIALOGUES.fomentius.intro[0], 'Hello Hello!')
  assert.equal(HUB_TRADER_DIALOGUES.fomentius.intro[1], 'Can I interest you in a high quality and *very legal* herbal potion? Brewed with all the best natural magicks, minimal chance of causing intestinal combustion!')
  assert.equal(HUB_TRADER_DIALOGUES.hagatha.priceLabel, 'Charm Prices?')
  assert.equal(HUB_TRADER_DIALOGUES.shlorio.priceLabel, 'Dowsing Prices?')
  assert.equal(HUB_TRADER_DIALOGUES.shlorio.name, 'Shlorio')
  assert.match(HUB_TRADER_DIALOGUES.luthacus.intro[0], /Official Unreal Crime Scene Investigator/)
  assert.match(HUB_TRADER_DIALOGUES.luthacus.intro[2], /By order of the Archchancellor, o'course\./)
  assert.match(HUB_TRADER_DIALOGUES.shlorio.priceExplanation[2], /vapor burns/)
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

test('native shop membership retains padded grids and exports every atlas row', () => {
  assert.deepEqual(HUB_TRADER_GRID_CAPACITY, { fomentius: 28, shlorio: 9 })
  assert.deepEqual(HUB_TRADER_NATIVE_UI_RECORDS, {
    Inventory: 84,
    Skills: 166,
    UI: 113,
  })
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

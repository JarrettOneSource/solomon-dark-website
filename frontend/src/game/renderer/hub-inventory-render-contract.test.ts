import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import nativeAssetsJson from '../../assets/game/hub-trader-native-assets.json' with { type: 'json' }
import {
  HUB_DOWSING_FLASH,
  HUB_DOWSING_INSUFFICIENT_GOLD,
  HUB_DOWSING_GRID,
  HUB_INVENTORY_GRID,
  HUB_NATIVE_LOGICAL_SIZE,
  HUB_NATIVE_UI_SCALE,
  HUB_NATIVE_UI_SIZE,
  HUB_NATIVE_UI_SURFACES,
  HUB_SHOP_GRID,
  hubInventoryPrimarySpellLines,
  hubInventorySlotPosition,
} from './hub-inventory-render-contract.ts'

test('stock inventory owns the fixed 1600 by 900 stage and all 88 authored cells', () => {
  assert.deepEqual(HUB_NATIVE_LOGICAL_SIZE, { height: 720, width: 1280 })
  assert.deepEqual(HUB_NATIVE_UI_SIZE, { height: 900, width: 1600 })
  assert.equal(HUB_NATIVE_UI_SCALE, 1.25)
  assert.equal(HUB_INVENTORY_GRID.columns * HUB_INVENTORY_GRID.rows, 88)
  assert.deepEqual(hubInventorySlotPosition(0), { x: 27.5, y: 497.5 })
  assert.deepEqual(hubInventorySlotPosition(1), { x: 27.5, y: 572.5 })
  assert.deepEqual(hubInventorySlotPosition(4), { x: 102.5, y: 497.5 })
  assert.deepEqual(hubInventorySlotPosition(87), { x: 1602.5, y: 722.5 })
  assert.throws(() => hubInventorySlotPosition(88), /\[0, 87\]/)
})

test('stock inventory derives every elemental primary stat pane from native skill ranks', () => {
  assert.deepEqual(hubInventoryPrimarySpellLines('ether', [[8, 1, 1]]), [
    'MAGIC MISSILE',
    'DAMAGE: 1 - 2',
    'MANA COST: 6',
    'MANA HEAL: 10 / SEC',
  ])
  assert.deepEqual(hubInventoryPrimarySpellLines('fire', [[16, 1, 1]]), [
    'FIREBALL',
    'DAMAGE: 4',
    'MANA COST: 12',
    'MANA HEAL: 10 / SEC',
  ])
  assert.deepEqual(hubInventoryPrimarySpellLines('air', [[24, 1, 1]]), [
    'LIGHTNING',
    'DAMAGE: 2.5 / SECOND',
    'MANA COST: 12 / SEC',
    'MANA HEAL: 10 / SEC',
  ])
  assert.deepEqual(hubInventoryPrimarySpellLines('water', [[32, 1, 1]]), [
    'FROST JET',
    'DAMAGE: 2.5 / SECOND',
    'MANA COST: 12.5 / SEC',
    'MANA HEAL: 10 / SEC',
  ])
  assert.deepEqual(hubInventoryPrimarySpellLines('earth', [[40, 1, 1]]), [
    'BOULDER',
    'TOTAL DAMAGE: 10 X SIZE',
    'MANA COST: 12 / SEC',
    'MANA HEAL: 10 / SEC',
  ])
})

test('shop and dowsing screens keep native retained capacity separate from visible pages', () => {
  assert.deepEqual(HUB_SHOP_GRID, { columns: 4, pageSize: 8, retainedCapacity: 28, rows: 2 })
  assert.deepEqual(HUB_DOWSING_GRID, { columns: 3, pageSize: 9, retainedCapacity: 9, rows: 3 })
})

test('dowsing preserves the stock red flash and insufficient-gold message branch', () => {
  assert.deepEqual(HUB_DOWSING_FLASH, {
    decrementPerTick: 0.05,
    durationMs: 200,
    durationTicks: 20,
  })
  assert.equal(HUB_DOWSING_INSUFFICIENT_GOLD.title, 'NOT ENOUGH GOLD!')
  assert.match(HUB_DOWSING_INSUFFICIENT_GOLD.body, /endless, swirling, impossible colors/)
})

test('the port exports the complete stock UI membership', () => {
  assert.equal(Object.keys(nativeAssetsJson.atlases.Inventory.records).length, 84)
  assert.equal(Object.keys(nativeAssetsJson.atlases.Skills.records).length, 166)
  assert.equal(Object.keys(nativeAssetsJson.atlases.UI.records).length, 113)
  assert.deepEqual(HUB_NATIVE_UI_SURFACES, [
    'dialogue',
    'fomentius-shop',
    'hagatha-perk-shop',
    'luthacus-inventory-shop',
    'shlorio-dowsing-before-roll',
    'shlorio-dowsing-flash',
    'shlorio-dowsing-results',
    'shlorio-insufficient-gold-message',
    'inventory',
  ])
})

test('visible hub inventory presentation is owned by the native WebGL renderer', () => {
  const source = readFileSync(new URL('../HubInventoryUi.tsx', import.meta.url), 'utf8')
  const rendererSource = readFileSync(new URL('./hub-inventory-renderer.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /function ModalFrame/)
  assert.doesNotMatch(source, /function NativeAtlasSprite/)
  assert.match(source, /createHubInventoryRenderer/)
  assert.match(rendererSource, /'UI', 62/)
  assert.match(rendererSource, /'UI', 72/)
  assert.match(rendererSource, /'UI', 12/)
  assert.match(rendererSource, /'Skills', 4/)
  assert.match(rendererSource, /dowsingFlash\.alpha = 1/)
  assert.match(rendererSource, /dataset\.dowsingFlash = 'active'/)
  assert.match(rendererSource, /dataset\.nativeReveal = clampedReveal >= 1 \? 'settled' : 'revealing'/)
  assert.match(rendererSource, /dataset\.nativeNoticeReveal/)
  assert.match(rendererSource, /typeof child\.label === 'string'/)
})

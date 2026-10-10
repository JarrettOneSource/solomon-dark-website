import assert from 'node:assert/strict'
import test from 'node:test'
import type { HubInventoryItem } from './core-kernels/hub-economy.ts'
import { INVENTORY_SACK_RENAME_BUTTON, inventorySackNameNeedsBrowserFont, inventorySackRenameTarget } from './hub-sack-rename.ts'
import { hubItemTooltipLines } from './renderer/hub-inventory-item-text.ts'
import { layoutNativeUiText, nativeUiGlyphInkBounds, nativeUiRecord, planNativeUiButton } from './native-ui/core.ts'
import { hubInventorySlotPosition } from './renderer/hub-inventory-render-contract.ts'
import { inventorySackRenameDialogLayout } from './hub-sack-rename-dialog-layout.ts'

const potion: HubInventoryItem = {
  id: 1, name: 'Potion', kind: 'health-potion', nativeTypeId: 7001, nativeSubtype: 0,
  equipmentType: null, iconRecords: [46], quantity: 1, rarity: null, recipeIndex: null,
}
const inner: HubInventoryItem = {
  ...potion, id: 2, name: 'Inner', kind: 'sack', nativeTypeId: 7008, contents: [potion],
}
const outer: HubInventoryItem = { ...inner, id: 3, name: 'Outer', contents: [inner] }
const stored: HubInventoryItem = { ...inner, id: 4, name: 'Stored', contents: [] }
const economy = { backpack: [outer], storage: [stored] }

test('Rename targets the selected owned Sack across backpack and storage depths', () => {
  assert.equal(inventorySackRenameTarget(economy, { id: 3, owner: 'backpack' }, []), outer)
  assert.equal(inventorySackRenameTarget(economy, { id: 2, owner: 'backpack' }, [3]), inner)
  assert.equal(inventorySackRenameTarget(economy, { id: 4, owner: 'storage' }, [3, 2]), stored)
})

test('a selected non-Sack, shop offer, equipment or stale ID suppresses the current-bag fallback', () => {
  for (const selection of [
    { id: 1, owner: 'backpack' },
    { id: 3, owner: null },
    { id: 3, owner: 'equipment' },
    { id: 99, owner: 'storage' },
  ] as const) assert.equal(inventorySackRenameTarget(economy, selection, [3, 2]), null)
})

test('only an absent selection uses the current correctly parented Sack', () => {
  assert.equal(inventorySackRenameTarget(economy, null, [3, 2]), inner)
  assert.equal(inventorySackRenameTarget(economy, null, [3]), outer)
  assert.equal(inventorySackRenameTarget(economy, null, []), null)
  assert.equal(inventorySackRenameTarget(economy, null, [2]), null)
  assert.equal(inventorySackRenameTarget(economy, null, [3, 99, 2]), null)
})

test('Sack name fallback detects every missing glyph in Unicode, mixed and combining names', () => {
  assert.equal(inventorySackNameNeedsBrowserFont("Wizard's Supplies"), false)
  for (const name of ['火の袋', 'Potions火', 'Cafe\u0301', 'Family 👨‍👩‍👧']) {
    assert.equal(inventorySackNameNeedsBrowserFont(name), true, name)
    assert.equal(hubItemTooltipLines({ ...inner, name })[0]?.sackNameBrowserFont, true)
    assert.equal(hubItemTooltipLines({ ...inner, name })[0]?.text, name)
  }
  assert.equal(hubItemTooltipLines(inner)[0]?.sackNameBrowserFont, undefined)
  assert.equal(hubItemTooltipLines({ ...potion, name: '火の袋' })[0]?.sackNameBrowserFont, undefined)
})

test('compact Rename label and stock end caps fit above the Sack grid in idle and pressed states', () => {
  const button = INVENTORY_SACK_RENAME_BUTTON
  assert.equal(button.bounds.left + button.bounds.width, 1560)
  for (const state of ['idle', 'pressed'] as const) {
    const plan = planNativeUiButton({ ...button, id: 'rename-sack', state })
    const left = plan.nodes.find(node => node.label === 'rename-sack:end-left')
    const right = plan.nodes.find(node => node.label === 'rename-sack:end-right')
    const label = plan.nodes.find(node => node.label === 'rename-sack:label')
    assert.ok(left?.kind === 'sprite' && left.width && left.height)
    assert.ok(right?.kind === 'sprite' && right.width && right.height)
    assert.ok(label?.kind === 'text')
    assert.ok(Math.abs(left.height - button.bounds.height * 85 / 69) < 0.001)
    assert.ok(left.y + left.height < hubInventorySlotPosition(0).y)
    const layout = layoutNativeUiText(label.text)
    assert.deepEqual(layout.unsupportedCodePoints, [])
    assert.equal(layout.glyphs.length, 'RENAMESACK'.length)
    for (const glyph of layout.glyphs) {
      const ink = nativeUiGlyphInkBounds(glyph)
      assert.ok(ink.left >= left.x + left.width && ink.left + ink.width <= right.x - right.width)
      assert.ok(ink.top >= button.bounds.top && ink.top + ink.height <= button.bounds.top + button.bounds.height)
    }
  }
})

test('rename dialog fits the complete stock crown/footer and readable non-overlapping controls', () => {
  for (const size of [{ width: 1600, height: 900 }, { width: 844, height: 390 },
    { width: 568, height: 320 }, { width: 390, height: 844 }]) {
    const layout = inventorySackRenameDialogLayout(size)
    for (const node of layout.art.nodes) {
      let bounds
      if (node.kind === 'sprite') {
        const record = nativeUiRecord(node.atlas, node.record)
        const width = node.width ?? record.logicalSize[0] * (node.scale ?? 1)
        const height = node.height ?? record.logicalSize[1] * (node.scale ?? 1)
        const rotation = node.rotation ?? 0
        const rotatedWidth = Math.abs(Math.cos(rotation)) * width + Math.abs(Math.sin(rotation)) * height
        const rotatedHeight = Math.abs(Math.sin(rotation)) * width + Math.abs(Math.cos(rotation)) * height
        const x = node.x + (0.5 - (node.anchor?.[0] ?? 0)) * width
        const y = node.y + (0.5 - (node.anchor?.[1] ?? 0)) * height
        bounds = { left: x - rotatedWidth / 2, top: y - rotatedHeight / 2, width: rotatedWidth, height: rotatedHeight }
      } else {
        assert.notEqual(node.kind, 'text')
        assert.ok('bounds' in node)
        bounds = node.bounds
      }
      assert.ok(bounds.left * layout.artScale >= -0.001 && bounds.top * layout.artScale >= -0.001, node.label)
      assert.ok((bounds.left + bounds.width) * layout.artScale <= size.width + 0.001, node.label)
      assert.ok((bounds.top + bounds.height) * layout.artScale <= size.height + 0.001, node.label)
    }
    assert.ok(layout.field.height >= 44 && layout.save.height >= 44 && layout.cancel.height >= 44)
    assert.ok(layout.field.top + layout.field.height + 24 <= layout.save.top)
    for (const node of layout.text.nodes) {
      assert.ok(node.kind === 'text')
      for (const glyph of layoutNativeUiText(node.text).glyphs) {
        const ink = nativeUiGlyphInkBounds(glyph)
        assert.ok(ink.top >= layout.body.top && ink.top + ink.height < layout.field.top)
        assert.ok(ink.left >= layout.body.left && ink.left + ink.width <= layout.body.left + layout.body.width)
      }
    }
  }
})

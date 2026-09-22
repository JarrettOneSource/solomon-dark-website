import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createEquipmentInventoryItem, DOWSING_EQUIPMENT_RECIPES } from '../src/game/core-kernels/hub-economy.ts'
import { nativeEquipmentTooltipSets } from '../src/game/core-kernels/native-equipment-effects.ts'
import { NATIVE_WELD_COMPONENT_SKILL_IDS } from '../src/game/core-kernels/player-progression.ts'
import { getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'

// Seed only the backpack; every activation, removal, and restoration uses real Inventory clicks.
export async function acceptItemSets({ page, host, playerId, waitUntil, screenshotRoot }) {
  const original = getPlayerEconomy(host.state(), playerId)
  const index = host.state().playerEntities.identities.findIndex(row => row.playerId === playerId)
  const permanent = [...host.state().playerEntities.skillBooks[index].permanentRanks]
  const expectedBits = [0, 0x1800, 1, 2, 4, 16, 8]
  const receipts = []
  const runtime = () => host.state().playerEntities.skillRuntimes[index]
  const book = () => host.state().playerEntities.skillBooks[index]
  const equipped = slot => {
    const equipment = getPlayerEconomy(host.state(), playerId).equipment
    return slot.startsWith('ring-') ? equipment.rings[Number(slot.slice(-1))] : equipment[slot]
  }
  const seed = economy => {
    const state = host.state()
    Object.assign(state, { playerEntities: replacePlayerEconomy(state.playerEntities, playerId, economy) })
  }
  for (const [setIndex, set] of nativeEquipmentTooltipSets().entries()) {
    let ring = 0
    const members = set.memberRecipeIndices.map((recipe, inventorySlot) => {
      const item = { ...createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[recipe], 90_000 + recipe), inventorySlot }
      const slot = item.equipmentType === 'ring' ? `ring-${ring++}`
        : ['staff', 'wand'].includes(item.equipmentType) ? 'weapon' : item.equipmentType
      return { item, slot }
    })
    const last = members.at(-1)
    const alternate = DOWSING_EQUIPMENT_RECIPES.find(recipe => (
      recipe.type === last.item.equipmentType && recipe.level === 0
      && !set.memberRecipeIndices.includes(recipe.sourceIndex)
    ))
    assert.ok(alternate)
    const replacement = { ...createEquipmentInventoryItem(alternate, 99_000), inventorySlot: members.length }
    seed({ ...original, backpack: [...members.map(row => row.item), replacement], nextItemId: 100_000,
      revision: getPlayerEconomy(host.state(), playerId).revision + 1 })
    await page.getByRole('button', { name: /Open inventory/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Inventory' })
    await dialog.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
    const equip = async (item, slot) => {
      const cell = dialog.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${item.id}"]`)
      await cell.click()
      await cell.locator('xpath=self::*[@data-selected="true"]').waitFor()
      await dialog.locator(`[data-equipment-slot="${slot}"]`).first().click()
      await waitUntil(() => equipped(slot)?.id === item.id, `${set.name}: ${item.name} equip failed`)
      await dialog.locator(`[data-equipment-slot="${slot}"][data-inventory-item-id="${item.id}"]`).first().waitFor()
    }
    for (const [memberIndex, { item, slot }] of members.entries()) {
      await equip(item, slot)
      if (memberIndex < members.length - 1) {
        assert.equal(runtime().equipmentModifiers.featureBits & 0x81f, 0)
        if (setIndex === 0) assert.equal(runtime().equipmentModifiers.recharge.scale, 1)
      }
    }
    const full = structuredClone(runtime().equipmentModifiers)
    assert.equal(full.featureBits, expectedBits[setIndex], set.name)
    if (setIndex === 0) assert.equal(full.recharge.scale, 3)
    if (setIndex === 1) {
      assert.ok(Math.abs(full.weldEffect - 1.5) < 0.000001)
      assert.ok(NATIVE_WELD_COMPONENT_SKILL_IDS.every(id => book().effectiveRanks[id] >= 1))
    }
    if (setIndex === 2) {
      assert.equal(full.skillDamageFlat[11], 4)
      assert.equal(full.skillDamageMultiplier[11], 2)
    }
    if (setIndex === 3) {
      assert.equal(book().effectiveRanks[29], 1)
      assert.equal(full.classManaCostMultiplier[2], Math.fround(0.8))
    }
    if (setIndex === 5) assert.equal(full.classCastSpeedMultiplier[3], Math.fround(1.1))
    if (setIndex === 6) assert.equal(full.classCastSpeedMultiplier[4], Math.fround(1.1))
    await dialog.locator(`[data-equipment-slot="${last.slot}"]`).first().click()
    await dialog.locator('.hub-inventory-native-canvas[data-native-item-info="visible"]').waitFor()
    await page.screenshot({ path: join(screenshotRoot, `set-${setIndex}-complete.png`) })
    await equip(replacement, last.slot)
    assert.equal(runtime().equipmentModifiers.featureBits & 0x81f, 0)
    if (setIndex === 0) assert.equal(runtime().equipmentModifiers.recharge.scale, 1)
    if (setIndex === 3) assert.equal(book().effectiveRanks[29], 0)
    await equip(last.item, last.slot)
    assert.deepEqual(runtime().equipmentModifiers, full)
    assert.deepEqual(book().permanentRanks, permanent)
    receipts.push({ name: set.name, equippedRecipes: set.memberRecipeIndices,
      featureBits: full.featureBits, recharge: full.recharge.scale, weldEffect: full.weldEffect,
      completeBonus: true, partialRejected: true, removedAndRestored: true, permanentRanksUnchanged: true })
    await dialog.locator('[data-inventory-resume="true"]').click()
    await dialog.waitFor({ state: 'hidden' })
  }
  seed({ ...original, revision: getPlayerEconomy(host.state(), playerId).revision + 1 })
  return receipts
}

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createEquipmentInventoryItem, DOWSING_EQUIPMENT_RECIPES } from '../src/game/core-kernels/hub-economy.ts'
import { nativeEquipmentTooltipSets } from '../src/game/core-kernels/native-equipment-effects.ts'
import { hubNativeEquipmentEffectText } from '../src/game/renderer/hub-inventory-item-text.ts'
import { NATIVE_WELD_COMPONENT_SKILL_IDS } from '../src/game/core-kernels/player-progression.ts'
import { getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'

// Seed only the backpack; every activation, removal, and restoration uses real Inventory clicks.
export async function acceptItemSets({ page, host, playerId, waitUntil, screenshotRoot,
  activate = target => target.click() }) {
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
    await activate(page.locator('.hub-scene[data-gameplay-input-blocked="false"], .boneyard-scene[data-gameplay-input-blocked="false"]')
      .getByRole('button', { name: /Open inventory/ }))
    const dialog = page.getByRole('dialog', { name: 'Inventory' })
    await dialog.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
    const indicator = dialog.getByRole('status', { name: 'Active set bonuses' })
    const expectIndicator = async active => {
      await indicator.waitFor({ state: active ? 'attached' : 'hidden' })
      if (active) assert.deepEqual(await indicator.locator('p').allTextContents(), [
        'Set Bonus Active:', set.name, ...set.effects.map(hubNativeEquipmentEffectText),
      ])
    }
    await expectIndicator(false)
    const equip = async (item, slot) => {
      const cell = dialog.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${item.id}"]`)
      await activate(cell)
      await cell.locator('xpath=self::*[@data-selected="true"]').waitFor()
      await activate(dialog.locator(`[data-equipment-slot="${slot}"]`).first())
      await waitUntil(() => equipped(slot)?.id === item.id, `${set.name}: ${item.name} equip failed`)
      await dialog.locator(`[data-equipment-slot="${slot}"][data-inventory-item-id="${item.id}"]`).first().waitFor()
    }
    for (const [memberIndex, { item, slot }] of members.entries()) {
      await equip(item, slot)
      if (memberIndex < members.length - 1) {
        await expectIndicator(false)
        assert.equal(runtime().equipmentModifiers.featureBits & 0x81f, 0)
        if (setIndex === 0) assert.equal(runtime().equipmentModifiers.recharge.scale, 1)
      }
    }
    const full = structuredClone(runtime().equipmentModifiers)
    await expectIndicator(true)
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
    await activate(dialog.locator('[data-inventory-empty-space="true"]'))
    await dialog.locator('.hub-inventory-native-canvas[data-native-item-info="hidden"]').waitFor()
    const visibleCard = await inspectActiveSetBonusCard(page)
    await page.screenshot({ path: join(screenshotRoot, `set-${setIndex}-active-bonus.png`) })
    await activate(dialog.locator(`[data-equipment-slot="${last.slot}"]`).first())
    await dialog.locator('.hub-inventory-native-canvas[data-native-item-info="visible"]').waitFor()
    await page.screenshot({ path: join(screenshotRoot, `set-${setIndex}-complete.png`) })
    await equip(replacement, last.slot)
    await expectIndicator(false)
    assert.equal(runtime().equipmentModifiers.featureBits & 0x81f, 0)
    if (setIndex === 0) assert.equal(runtime().equipmentModifiers.recharge.scale, 1)
    if (setIndex === 3) assert.equal(book().effectiveRanks[29], 0)
    await equip(last.item, last.slot)
    await expectIndicator(true)
    assert.deepEqual(runtime().equipmentModifiers, full)
    assert.deepEqual(book().permanentRanks, permanent)
    receipts.push({ name: set.name, equippedRecipes: set.memberRecipeIndices,
      featureBits: full.featureBits, recharge: full.recharge.scale, weldEffect: full.weldEffect,
      completeBonus: true, partialRejected: true, removedAndRestored: true, permanentRanksUnchanged: true,
      activeIndicatorAndDescriptions: true, visibleCard })
    await activate(dialog.locator('[data-inventory-resume="true"]'))
    await dialog.waitFor({ state: 'hidden' })
  }
  seed({ ...original, revision: getPlayerEconomy(host.state(), playerId).revision + 1 })
  return receipts
}

// Pixi's supported application hook observes the production stage unchanged.
export function installActiveSetBonusProbe() {
  const applications = []
  const previous = window.__PIXI_APP_INIT__
  window.__PIXI_APP_INIT__ = (application, version) => {
    previous?.(application, version)
    applications.push(application)
  }
  window.__activeSetBonusCard = () => {
    const find = node => node?.label === 'active-equipped-set-bonus' ? node
      : node?.children?.map(find).find(Boolean)
    const card = applications.filter(application => application.renderer && application.stage
      && application.canvas?.matches('.hub-inventory-native-canvas'))
      .map(application => find(application.stage)).find(Boolean)
    if (!card) return null
    const bounds = card.getBounds()
    let opacity = 1, visible = true
    for (let node = card; node; node = node.parent) {
      opacity *= node.alpha
      visible = visible && node.visible && node.renderable
    }
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
      visible: visible && opacity >= 0.99 }
  }
}

export async function inspectActiveSetBonusCard(page) {
  await page.waitForFunction(() => window.__activeSetBonusCard()?.visible)
  const bounds = await page.evaluate(() => window.__activeSetBonusCard())
  assert.ok(bounds.x >= 850 && bounds.x + bounds.width <= 1230, 'card stays between the wizard and equipped slots')
  assert.ok(bounds.y >= 100 && bounds.y + bounds.height < 460, 'all card content stays above the backpack')
  const image = await page.locator('.hub-inventory-native-canvas').screenshot()
  const colors = await page.evaluate(async ({ encoded, bounds }) => {
    const image = new Image()
    image.src = 'data:image/png;base64,' + encoded
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width; canvas.height = image.height
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const sx = image.width / 1600, sy = image.height / 900
    const data = context.getImageData(Math.ceil(bounds.x * sx), Math.ceil(bounds.y * sy),
      Math.floor(bounds.width * sx), Math.floor(bounds.height * sy)).data
    const colors = { heading: [217, 186, 112], name: [255, 191, 128], effect: [191, 191, 191] }
    return Object.fromEntries(Object.entries(colors).map(([name, rgb]) => {
      let count = 0
      for (let i = 0; i < data.length; i += 4) {
        if (rgb.every((value, component) => Math.abs(data[i + component] - value) <= 3)) count++
      }
      return [name, count]
    }))
  }, { encoded: image.toString('base64'), bounds })
  assert.ok(Object.values(colors).every(count => count >= 4), 'heading, set name, and bonus effects are rendered')
  return { bounds, colors }
}

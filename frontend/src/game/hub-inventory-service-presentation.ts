import {
  DOWSING_EQUIPMENT_RECIPES,
  NATIVE_EQUIPMENT_LEVEL_REDUCTION_SKILL_ID,
  findInventoryItem,
  type HubInventoryItem,
  type HubShopItem,
  type HubTraderId,
} from './core-kernels/hub-economy.ts'
import type { ProtocolPlayerEconomy, ProtocolPlayerProgression } from './protocol/game-state.ts'
import type {
  HubServiceInspectionModel,
} from './renderer/hub-inventory/model.ts'
import {
  hubHagathaTooltipLines,
  hubItemTooltipLines,
} from './renderer/hub-inventory-render-contract.ts'

export function dowsingItems(economy: ProtocolPlayerEconomy): readonly HubShopItem[] {
  return economy.dowsingOffers.map((offer) => {
    const recipe = DOWSING_EQUIPMENT_RECIPES[offer.recipeIndex]!
    return {
      equipmentType: recipe.type,
      iconRecords: recipe.iconRecords,
      id: offer.id,
      kind: 'equipment',
      name: recipe.name,
      nativeSubtype: null,
      nativeTypeId: recipe.nativeTypeId,
      price: offer.price,
      quantity: 1,
      rarity: recipe.rarity,
      recipeIndex: recipe.sourceIndex,
    }
  })
}

export function serviceInspectionTooltipText(
  inspection: HubServiceInspectionModel,
  economy: ProtocolPlayerEconomy,
  progression: ProtocolPlayerProgression,
  trader: HubTraderId,
): string | null {
  if (inspection.kind === 'owned-perk') {
    if (
      economy.ownedPerkSelectors[inspection.index] !== inspection.selector
    ) return null
    return tooltipSemanticText(hubHagathaTooltipLines({
      cheatDeathCharges: inspection.selector === 7 ? 1 : null,
      firstMixed: true,
      price: null,
      selector: inspection.selector,
    }))
  }
  if (trader === 'hagatha') {
    const offer = economy.hagathaOffers.find(({ selector }) => selector === inspection.id)
    if (!offer || inspection.owner !== null) return null
    return tooltipSemanticText(hubHagathaTooltipLines({
      bundleSelectors: offer.members,
      cheatDeathCharges: null,
      firstMixed: offer.price === offer.basePrice,
      price: offer.price,
      selector: offer.selector,
    }))
  }
  const item = trader === 'luthacus'
    ? findInventoryItem(economy.storage, inspection.id)
    : trader === 'fomentius'
      ? economy.fomentiusStock.find(({ id }) => id === inspection.id)
      : dowsingItems(economy).find(({ id }) => id === inspection.id)
  if (!item) return null
  return tooltipSemanticText(hubItemTooltipLines(item, {
    creativityRank: progression.learnedSkills.find(
      ([skillId]) => skillId === NATIVE_EQUIPMENT_LEVEL_REDUCTION_SKILL_ID,
    )?.[1] ?? 0,
    playerLevel: progression.level,
    price: trader === 'luthacus' ? null : hubShopItemPrice(item),
  }))
}

function hubShopItemPrice(item: HubInventoryItem | HubShopItem): number | null {
  return 'price' in item && typeof item.price === 'number' ? item.price : null
}

function tooltipSemanticText(lines: readonly { readonly text: string }[]): string {
  return lines.map(({ text }) => text.trim()).filter(Boolean).join(' ')
}

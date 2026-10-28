import {
  NATIVE_LOOT_DEFAULT_MODIFIERS, NATIVE_LOOT_OPEN_PLACEMENT,
  type NativeLootSelectionInput,
} from '../src/game/core-kernels/native-loot.ts'
import { createNativeLootItemIds } from '../src/game/core-kernels/native-loot-items.ts'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'

export const ALL_DISABLED = Object.freeze({
  gold: 4,
  item: 4,
  orb: 4,
  potion: 4,
  powerup: 4,
  specificItem: 0,
} as const)

export function input(overrides: Partial<NativeLootSelectionInput> = {}): NativeLootSelectionInput {
  return {
    actorSeed: 12345,
    arena: {
      disableMask: 0,
      itemLevelMaximum: 100,
      itemLevelMinimum: 0,
      lastSuccessfulItemLevel: -1,
      level: 10,
      mode: 0,
      specialSuppression: false,
    },
    explicitGoldAmount: null,
    dropDelayContext: 0,
    itemIds: createNativeLootItemIds(1),
    key: { current: 1, level: 0, remaining: 0 },
    nearbyMaskTwoCount: 0,
    participant: {
      advancedUnlocks: new Array<boolean>(8).fill(false),
      level: 12,
      modifiers: NATIVE_LOOT_DEFAULT_MODIFIERS,
      ownedRecipeIndexes: [],
      slot: 0,
    },
    placement: NATIVE_LOOT_OPEN_PLACEMENT,
    policies: ALL_DISABLED,
    sceneForcesHealthPotion: false,
    sharedRng: createNativeRng(1),
    sourcePosition: { x: 100, y: 200 },
    worldBadguyCount: 0,
    worldHasHealthPotionSack: false,
    inventoryHasHealthPotion: false,
    ...overrides,
  }
}

import assert from 'node:assert/strict'
import test from 'node:test'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import {
  createEquipmentInventoryItem, DOWSING_EQUIPMENT_RECIPES,
  type HubInventoryItem,
} from '../core-kernels/hub-economy.ts'
import { NATIVE_LOOT_OPEN_PLACEMENT, nativeLootModifiers } from '../core-kernels/native-loot.ts'
import {
  activateBoneyardGoodie, createBoneyardLootStore, spawnBoneyardCustomLootItems,
  stepBoneyardLootStore,
} from './boneyard-loot-store.ts'
import {
  createGameSimulation, enterBoneyardWorld, getPlayerCharacter, getPlayerEconomy,
  stepGameSimulationTick,
} from './game-simulation.ts'
import { replacePlayerEconomy } from './player-entity-store.ts'

const arena: LoadedBoneyard = {
  choice: { id: 'pickup-ownership', name: 'Pickup ownership', source: 'default' },
  geometrySha256: 'b'.repeat(64), runId: 'pickup-ownership-run',
  scene: { bounds: { x: 0, y: 0, w: 500, h: 500 }, environmentMode: 2,
    fences: [], name: 'Pickup ownership', objects: [], roads: [], solomonDig: null,
    spawn: { facingDeg: 180, x: 250, y: 250 }, sprites: [], terrain: [] },
  seed: 'pickup-ownership-seed',
  sourceSha256: '2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f',
}

function recipeIndexes(items: readonly HubInventoryItem[]): number[] {
  return items.flatMap(item => [
    ...(item.recipeIndex === null ? [] : [item.recipeIndex]),
    ...recipeIndexes(item.contents ?? []),
  ])
}

for (const nested of [false, true]) {
  for (const [rootSlots, fillerFirst] of [[46, false], [2_048, false], [2_047, true], [2_047, false]] as const) {
    test(`public pickup admission composes with catch-up Goodie ownership: nested=${nested}, slots=${rootSlots}, fillerFirst=${fillerFirst}`, () => {
      let state = enterBoneyardWorld(createGameSimulation(), arena)
      const otherRecipes = DOWSING_EQUIPMENT_RECIPES.filter(recipe => recipe.sourceIndex !== 39)
      const economy = {
        ...getPlayerEconomy(state), nextItemId: 50_000,
        backpack: Array.from({ length: rootSlots }, (_, index) => ({
          ...createEquipmentInventoryItem(otherRecipes[index % otherRecipes.length]!, index + 1),
          inventorySlot: index,
        })),
      }
      state = { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, 'local-player', economy) }
      if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
      const context = {
        placement: NATIVE_LOOT_OPEN_PLACEMENT,
        participants: [{ advancedUnlocks: [], alive: true, connected: true, headingIndex: 0,
          level: 1, modifiers: nativeLootModifiers([]), ownedRecipeIndexes: recipeIndexes(economy.backpack),
          playerId: 'local-player', position: { x: -100, y: -100 } }],
      }
      let loot = activateBoneyardGoodie(createBoneyardLootStore('pickup-ownership', [{
        eid: 'chest', position: { x: 400, y: 400 }, rewardSeed: 10, subtype: 0,
      }]), 'chest', 'local-player')
      loot = stepBoneyardLootStore(loot, { ...context, tick: 0 }).store
      // Goodies run before carriers within each loot tick. Leave one loot tick
      // of catch-up so pickup at tick 248 precedes selection at tick 249 in one public step.
      loot = stepBoneyardLootStore(loot, { ...context, tick: 247 }).store
      assert.equal(loot.goodies[0]?.exhausted, false)
      assert.equal(loot.actors.length, 0)
      const ring = createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[39]!, 90_000)
      const item: HubInventoryItem = nested ? {
        contents: [ring], equipmentType: null, iconRecords: [70], id: 90_001,
        kind: 'sack', name: 'Named Sack', nativeSubtype: 0, nativeTypeId: 7008,
        quantity: 1, rarity: null, recipeIndex: null,
      } : ring
      const filler = createEquipmentInventoryItem(otherRecipes[0]!, 90_002)
      const items = rootSlots === 2_047 ? fillerFirst ? [filler, item] : [item, filler] : [item]
      loot = spawnBoneyardCustomLootItems(loot, items, getPlayerCharacter(state).position, 248).store
      assert.equal(loot.actors.length, items.length)
      const itemActor = loot.actors[items.indexOf(item)]!
      const fillerActor = loot.actors[items.indexOf(filler)]
      assert.ok(itemActor)
      state = stepGameSimulationTick({ ...state, tick: 248, world: {
        ...state.world, arenaTransition: null, encounter: null, waves: null, loot,
      } }, {})
      if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
      const admitted = rootSlots < 2_048 && !(rootSlots === 2_047 && fillerFirst)
      assert.equal(recipeIndexes(getPlayerEconomy(state).backpack).filter(index => index === 39).length,
        admitted ? 1 : 0)
      assert.equal(state.world.loot.goodies[0]?.exhausted, true)
      const retained = state.world.loot.actors.find(actor => actor.id === itemActor.id)
      assert.equal(retained !== undefined, !admitted)
      if (retained) assert.deepEqual(retained.item, itemActor.item)
      if (fillerActor) {
        assert.equal(state.world.loot.actors.some(actor => actor.id === fillerActor.id), !fillerFirst)
      }
      const goodieDrops = state.world.loot.actors.filter(actor => actor.source === 'goodie')
      const nativeBundleRemainsEligible = !admitted && nested
      assert.equal(goodieDrops.length, nativeBundleRemainsEligible ? 1 : 0)
      if (nativeBundleRemainsEligible) assert.deepEqual(recipeIndexes([goodieDrops[0]!.item!]), [39])
      assert.equal(state.world.lootEvents.filter(event => event.type === 'loot-pickup').length,
        rootSlots === 2_048 ? 0 : 1)
    })
  }
}

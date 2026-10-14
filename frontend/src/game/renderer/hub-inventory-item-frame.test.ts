import assert from 'node:assert/strict'
import test from 'node:test'
import { createEquipmentInventoryItem, DOWSING_EQUIPMENT_RECIPES } from '../core-kernels/hub-economy.ts'
import { nativeEquipmentTooltipSets } from '../core-kernels/native-equipment-effects.ts'
import { hubInventoryFrameTiles, hubInventoryItemFrame } from './hub-inventory-item-frame.ts'

const setRecipes = nativeEquipmentTooltipSets().flatMap(set => set.memberRecipeIndices)
const setRecipe = DOWSING_EQUIPMENT_RECIPES.find(recipe => setRecipes.includes(recipe.sourceIndex))!
const ordinaryRecipe = DOWSING_EQUIPMENT_RECIPES.find(recipe => !setRecipes.includes(recipe.sourceIndex))!
const setItem = createEquipmentInventoryItem(setRecipe, 1)
const ordinaryItem = createEquipmentInventoryItem(ordinaryRecipe, 2)

test('native parent-set zero is valid and the non-set recipe sentinel stays ordinary', () => {
  const firstSet = nativeEquipmentTooltipSets()[0]!
  assert.equal(firstSet.name, 'The Arcanus Spectrum Paraclosm')
  assert.deepEqual(firstSet.memberRecipeIndices, [0, 1, 2, 3, 4, 5])
  assert.equal(hubInventoryItemFrame('inventory', { ...setItem, recipeIndex: 0 }, [0, 0, 72, 72]).record, 15)
  assert.equal(ordinaryRecipe.sourceIndex, 29)
  assert.equal(hubInventoryItemFrame('inventory', ordinaryItem, [0, 0, 72, 72]).record, 10)
})

test('all recovered set recipes select the opaque, centered 80px inventory border', () => {
  for (const recipeIndex of setRecipes) {
    assert.deepEqual(hubInventoryItemFrame('inventory', { ...setItem, recipeIndex }, [24, 496, 72, 72]), {
      record: 15, rect: [20, 492, 80, 80], alpha: 1, tiled: false,
    })
  }
})

test('ordinary, missing, unresolved and non-equipment items retain the ordinary inventory border', () => {
  for (const item of [null, ordinaryItem, { ...setItem, recipeIndex: null },
    { ...setItem, recipeIndex: -1 }, { ...setItem, recipeIndex: 999999 },
    { ...setItem, kind: 'health-potion' as const }]) {
    assert.deepEqual(hubInventoryItemFrame('inventory', item, [24, 496, 72, 72]), {
      record: 10, rect: [24, 496, 72, 72], alpha: 0.4, tiled: false,
    })
  }
})

test('equipment uses small, square and tiled tall native frames centered on the existing slot', () => {
  for (const [width, height, ordinaryRecord, setRecord, tiled] of [
    [46, 46, 9, 14, false], [72, 72, 10, 15, false], [72, 108, 10, 15, true],
  ] as const) {
    assert.deepEqual(hubInventoryItemFrame('equipment', setItem, [100, 200, width, height]), {
      record: setRecord, rect: [96, 196, width + 8, height + 8], alpha: 1, tiled,
    })
    for (const item of [null, ordinaryItem, { ...setItem, recipeIndex: null }]) {
      assert.deepEqual(hubInventoryItemFrame('equipment', item, [100, 200, width, height]), {
        record: ordinaryRecord, rect: [100, 200, width, height], alpha: 1, tiled,
      })
    }
  }
})

test('ordinary tall border repeats native atlas-inset thirds and clips its half-height tail', () => {
  const tiles = hubInventoryFrameTiles(72, 72, 72, 108, 1024, 512)
  assert.equal(tiles.length, 12)
  assert.deepEqual(tiles[0], { sourceUv: [0, 0, 0.3338216245174408, 0.3343099057674408], x: 0, y: 0 })
  assert.equal(tiles[3]!.y, 24.070313215255737)
  assert.equal(tiles[5]!.y - tiles[3]!.y, 24)
  assert.deepEqual(tiles[7]!.sourceUv, [0, 0.3343099057674408, 0.3338216245174408, 0.50146484375])
  assert.equal(tiles.at(-1)!.x, 48.070313930511475)
  assert.equal(tiles.at(-1)!.y, 84.14062643051147)
})

test('purple tall border retains fractional thirds and the native nonzero f32 width tail', () => {
  const tiles = hubInventoryFrameTiles(80, 80, 80, 116, 1024, 512)
  assert.equal(tiles.length, 14)
  assert.deepEqual(tiles[2]!.sourceUv, [0.3338216245174408, 0, 0.3338216543197632, 0.3343099057674408])
  assert.equal(tiles[2]!.x, 53.37239599227905)
  assert.deepEqual(tiles[8]!.sourceUv, [0, 0.3343099057674408, 0.3338216245174408, 0.4513184130191803])
  for (const tile of tiles) {
    const [left, top, right, bottom] = tile.sourceUv
    assert.ok(left === 0 || top === 0 || right === 1 || bottom === 1, 'outline-only excludes center cells')
    assert.ok(right > left && bottom > top)
    assert.ok(Math.abs(tile.x + (right - left) * 80) <= 80 + 1e-6)
    assert.ok(Math.abs(tile.y + (bottom - top) * 80) <= 116 + 1e-6)
  }
})

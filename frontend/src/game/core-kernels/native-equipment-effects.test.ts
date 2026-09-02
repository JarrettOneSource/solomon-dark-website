import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createEquipmentInventoryItem,
  DOWSING_EQUIPMENT_RECIPES,
  type HubEquipmentState,
  type HubInventoryItem,
} from './hub-economy.ts'
import { nativeTutorialAmuletItem } from './native-tutorial.ts'
import {
  NATIVE_EQUIPMENT_FEATURE,
  NATIVE_EQUIPMENT_RECIPE_COUNT,
  NATIVE_EQUIPMENT_SET_COUNT,
  applyNativeEquipmentTransform,
  createNativeEquipmentModifiers,
  equippedNativeEffectSources,
  nativeEquipmentHasFeature,
  nativeEquipmentRecipeEffects,
  nativeEquipmentSetEffects,
  nativeEquipmentTooltipSets,
  resolveEquippedNativeEffects,
  resolveNativeEquipmentEffects,
} from './native-equipment-effects.ts'

test('pins the complete stock equipment and set effect catalogs', () => {
  assert.equal(NATIVE_EQUIPMENT_RECIPE_COUNT, 47)
  assert.equal(NATIVE_EQUIPMENT_SET_COUNT, 7)
  assert.deepEqual(nativeEquipmentRecipeEffects(1), [
    { kind: 7, magnitude: 1, operator: 0, target: 27 },
    { kind: 7, magnitude: 1, operator: 0, target: 28 },
  ])
  assert.deepEqual(nativeEquipmentRecipeEffects(46), [
    { kind: 19, magnitude: 95, operator: 2, target: 0 },
    { kind: 1, magnitude: -35, operator: 2, target: 0 },
    { kind: 9, magnitude: -50, operator: 2, target: 0 },
    { kind: 21, magnitude: -40, operator: 2, target: 0 },
  ])
  assert.deepEqual(nativeEquipmentSetEffects([0, 1, 2, 3, 4]), [])
  assert.deepEqual(nativeEquipmentSetEffects([0, 1, 2, 3, 4, 5]), [
    { kind: 21, magnitude: 3, operator: 1, target: 0 },
  ])
})

test('equipment skill pass preserves Grant-last ordering, learned gates, and caps', () => {
  const permanent = new Array<number>(83).fill(0)
  permanent[8] = 1
  permanent[16] = 25
  const result = resolveNativeEquipmentEffects(permanent, [
    {
      effects: [
        { kind: 5, magnitude: 2, operator: 0, target: 11 },
        { kind: 8, magnitude: 1, operator: 0, target: 0 },
      ],
      recipeIndex: null,
    },
    {
      effects: [{ kind: 4, magnitude: 2, operator: 0, target: 11 }],
      recipeIndex: null,
    },
    {
      effects: [{ kind: 7, magnitude: 3, operator: 0, target: 13 }],
      recipeIndex: null,
    },
  ])
  assert.equal(result.effectiveRanks[8], 2)
  assert.equal(result.effectiveRanks[16], 25)
  assert.equal(result.effectiveRanks[11], 2)
  assert.equal(result.effectiveRanks[13], 3)
  assert.equal(permanent[11], 0)
})

test('Revelation composes with every authored equipment skill-effect row', () => {
  const rows = [
    ...Array.from({ length: NATIVE_EQUIPMENT_RECIPE_COUNT }, (_, recipeIndex) => (
      nativeEquipmentRecipeEffects(recipeIndex).map((effect, effectIndex) => ({
        effect,
        label: `recipe ${recipeIndex} effect ${effectIndex}`,
      }))
    )).flat(),
    ...nativeEquipmentTooltipSets().flatMap((set, setIndex) => (
      set.effects.map((effect, effectIndex) => ({
        effect,
        label: `set ${setIndex} effect ${effectIndex}`,
      }))
    )),
  ].filter(({ effect }) => effect.kind >= 4 && effect.kind <= 8)
  assert.deepEqual(Object.fromEntries([4, 5, 6, 7, 8].map(kind => [
    kind,
    rows.filter(({ effect }) => effect.kind === kind).length,
  ])), { 4: 2, 5: 6, 6: 2, 7: 19, 8: 1 })

  for (const { effect, label } of rows) {
    const permanent = new Array<number>(83).fill(0)
    if (effect.kind === 5 || effect.kind === 6 || effect.kind === 8) {
      permanent.fill(1, 8, 80)
    }
    const permanentBefore = [...permanent]
    const source = [{ effects: [effect], recipeIndex: null }]
    const neutral = resolveNativeEquipmentEffects(permanent, source)
    const revelation = resolveNativeEquipmentEffects(permanent, source, [6])
    if (effect.kind === 4 || effect.kind === 7) {
      assert.equal(
        revelation.effectiveRanks[effect.target],
        Math.max(2, neutral.effectiveRanks[effect.target] ?? 0),
        label,
      )
    } else {
      assert.deepEqual(revelation.effectiveRanks, neutral.effectiveRanks, label)
    }
    assert.deepEqual(permanent, permanentBefore, `${label} permanent ranks`)
  }
})

test('equipment stat pass preserves every split lane, transform, class, and feature family', () => {
  const result = resolveNativeEquipmentEffects(new Array(83).fill(0), [{
    effects: [
      { kind: 1, magnitude: 5, operator: 0, target: 0 },
      { kind: 1, magnitude: 50, operator: 2, target: 0 },
      { kind: 2, magnitude: 10, operator: 2, target: 3 },
      { kind: 9, magnitude: 5, operator: 0, target: 0 },
      { kind: 9, magnitude: 2, operator: 1, target: 0 },
      { kind: 15, magnitude: 2, operator: 1, target: 0 },
      { kind: 17, magnitude: 5, operator: 0, target: 0 },
      { kind: 18, magnitude: 25, operator: 2, target: 0 },
      { kind: 23, magnitude: 25, operator: 0, target: 0 },
      { kind: 23, magnitude: 2, operator: 1, target: 0 },
      { kind: 25, magnitude: 7, operator: 0, target: 8 },
      { kind: 25, magnitude: 50, operator: 2, target: 8 },
      { kind: 29, magnitude: 0, operator: 0, target: 0 },
      { kind: 38, magnitude: 20, operator: 2, target: 0 },
      { kind: 39, magnitude: 0, operator: 0, target: 0 },
    ],
    recipeIndex: null,
  }])
  const modifiers = result.modifiers
  assert.equal(modifiers.globalDamageFlat, 5)
  assert.equal(modifiers.globalDamageMultiplier, 1.5)
  assert.equal(modifiers.classDamageMultiplier[3], 1.100000023841858)
  assert.equal(applyNativeEquipmentTransform(modifiers.manaRecovery, 1), 12)
  assert.equal(modifiers.orbPullMultiplier, 2)
  assert.equal(applyNativeEquipmentTransform(modifiers.walkSpeed, 1), 1.5)
  assert.equal(modifiers.damageResistance, 0.25)
  assert.equal(applyNativeEquipmentTransform(modifiers.maximumHealth, 100), 250)
  assert.equal(modifiers.skillDamageFlat[8], 7)
  assert.equal(modifiers.skillDamageMultiplier[8], 1.5)
  assert.equal(modifiers.featureBits, 0x1008)
  assert.equal(modifiers.weldEffect, 1.2000000476837158)
  assert.equal(nativeEquipmentHasFeature(modifiers, 'maximumGolem'), true)
  assert.equal(nativeEquipmentHasFeature(modifiers, 'weldCalling'), true)
  assert.equal(NATIVE_EQUIPMENT_FEATURE.maximumGolem, 0x0008)
})

test('five shipped maximum feature names retain their inert bit-only contract', () => {
  const permanent = new Array<number>(83).fill(0)
  permanent[17] = 2
  const result = resolveNativeEquipmentEffects(permanent, [{
    effects: [31, 32, 33, 34, 35].map((kind) => ({
      kind,
      magnitude: 0,
      operator: 0 as const,
      target: 0,
    })),
    recipeIndex: null,
  }])
  assert.deepEqual(result.effectiveRanks, permanent)
  assert.equal(result.modifiers.featureBits, 0x03e0)
  assert.deepEqual(
    { ...result.modifiers, featureBits: 0 },
    createNativeEquipmentModifiers(),
  )
})

test('equipped sources follow native sink order and exact set identity', () => {
  const item = (recipeIndex: number, id: number): HubInventoryItem => {
    const recipe = DOWSING_EQUIPMENT_RECIPES[recipeIndex]!
    return createEquipmentInventoryItem(recipe, id)
  }
  const equipment: HubEquipmentState = {
    amulet: item(15, 6),
    hat: item(11, 1),
    rings: [item(14, 3), null, null],
    robe: item(12, 2),
    weapon: item(13, 5),
  }
  assert.deepEqual(
    equippedNativeEffectSources(equipment).map(({ recipeIndex }) => recipeIndex),
    [11, 12, 14, 15, 13],
  )
  const resolved = resolveEquippedNativeEffects(new Array(83).fill(0), equipment)
  assert.equal(nativeEquipmentHasFeature(resolved.modifiers, 'maximumLeviathan'), true)
})

test('generated effects override recipe lookup without acquiring set membership', () => {
  const generated: HubInventoryItem = {
    equipmentType: 'ring',
    iconRecords: [52],
    id: 1,
    kind: 'equipment',
    name: 'Generated Ring',
    nativeEffects: [{ kind: 24, magnitude: 50, operator: 0, target: 0 }],
    nativeSubtype: null,
    nativeTypeId: 7002,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  const equipment: HubEquipmentState = {
    amulet: null,
    hat: null,
    rings: [generated, null, null],
    robe: null,
    weapon: null,
  }
  const resolved = resolveEquippedNativeEffects(new Array(83).fill(0), equipment)
  assert.equal(applyNativeEquipmentTransform(resolved.modifiers.maximumMana, 100), 150)
  assert.equal(resolved.modifiers.featureBits, 0)
})

test("Sorceror's Amulet applies only its authored ten-percent Ether damage effect", () => {
  const amulet = { ...nativeTutorialAmuletItem(), id: 1 }
  assert.deepEqual(amulet.nativeEffects, [
    { kind: 2, magnitude: 10, operator: 2, target: 0 },
  ])
  const resolved = resolveEquippedNativeEffects(new Array(83).fill(0), {
    amulet,
    hat: null,
    rings: [null, null, null],
    robe: null,
    weapon: null,
  })
  assert.equal(resolved.modifiers.classDamageMultiplier[0], 1.100000023841858)
  assert.deepEqual(resolved.modifiers.classDamageMultiplier.slice(1), new Array(7).fill(1))

  const unequipped = resolveEquippedNativeEffects(new Array(83).fill(0), {
    amulet: null,
    hat: null,
    rings: [null, null, null],
    robe: null,
    weapon: null,
  })
  assert.deepEqual(unequipped.modifiers, createNativeEquipmentModifiers())
})

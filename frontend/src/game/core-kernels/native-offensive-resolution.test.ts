import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveNativeEquipmentEffects } from './native-equipment-effects.ts'
import {
  NATIVE_OFFENSIVE_SKILL_IDS,
  nativeSkillIsOffensive,
  resolveNativeSkillDamage,
  resolveNativeSkillManaCost,
} from './native-offensive-resolution.ts'

test('pins every authored offensive row and every direct non-offensive counterexample', () => {
  assert.deepEqual(NATIVE_OFFENSIVE_SKILL_IDS, [
    8, 9, 10, 11, 13,
    16, 17, 18, 19, 20, 21, 23,
    24, 25, 26, 27, 29, 31,
    32, 33, 34, 35, 38,
    40, 41, 42, 43, 44, 47,
    50, 52, 55,
    65,
    72, 73, 74, 76, 77, 78, 79,
  ])
  for (const id of NATIVE_OFFENSIVE_SKILL_IDS) assert.equal(nativeSkillIsOffensive(id), true)
  for (const id of [0, 12, 15, 22, 28, 30, 45, 46, 48, 49, 51, 54, 66, 71, 75, 80]) {
    assert.equal(nativeSkillIsOffensive(id), false, `row ${id}`)
  }
})

test('Siege Mage runs after every flat, multiplier, and element damage lane', () => {
  const factors = { damage: 1.5, manaCost: 0.75 }
  assert.equal(resolveNativeSkillDamage(65, factors, {
    actorBaseDamage: 2,
    baseDamage: 10,
    classFlatDamage: 5,
    classMultiplier: 1.3,
    elementOrClassMultiplier: 1.4,
    globalFlatDamage: 3,
    globalMultiplier: 1.1,
    skillFlatDamage: 4,
    skillMultiplier: 1.2,
  }), (2 + 10 + 3 + 4 + 5) * 1.1 * 1.2 * 1.3 * 1.4 * 1.5)
  assert.equal(resolveNativeSkillDamage(66, factors, {
    baseDamage: 10,
    globalFlatDamage: 2,
  }), 12)
})

test('Battle Mage runs after the minimum-one clamp and before later cost lanes', () => {
  const factors = { damage: 1.5, manaCost: 0.75 }
  assert.equal(resolveNativeSkillManaCost(8, factors, {
    baseManaCost: 5,
    classFlatManaCost: 3,
    classMultiplier: 1.2,
    elementMultiplier: 1.3,
    globalFlatManaCost: 2,
    globalManaReduction: 10,
    globalMultiplier: 1.1,
    skillFlatManaCost: 4,
    skillMultiplier: 1.4,
  }), (1 * 0.75 + 2 + 3 + 4) * 1.1 * 1.2 * 1.4 * 1.3)
  assert.equal(resolveNativeSkillManaCost(15, factors, {
    baseManaCost: 5,
    globalFlatManaCost: 2,
    globalManaReduction: 10,
  }), 3)
})

test('unforge flat damage and mana reduction enter their native pre-multiplier lanes', () => {
  const factors = {
    damage: 1.5,
    globalFlatDamage: 2,
    globalManaReduction: 2,
    manaCost: 0.75,
  }
  assert.equal(resolveNativeSkillDamage(8, factors, { baseDamage: 10 }), 18)
  assert.equal(resolveNativeSkillDamage(66, factors, { baseDamage: 10 }), 10)
  assert.equal(resolveNativeSkillManaCost(8, factors, { baseManaCost: 10 }), 6)
  assert.equal(resolveNativeSkillManaCost(15, factors, { baseManaCost: 10 }), 8)
})

test('equipment spell, class, and one-spell lanes feed the shared resolver once', () => {
  const equipment = resolveNativeEquipmentEffects(new Array(83).fill(0), [{
    effects: [
      { kind: 1, magnitude: 5, operator: 0, target: 0 },
      { kind: 1, magnitude: 50, operator: 2, target: 0 },
      { kind: 2, magnitude: 20, operator: 2, target: 1 },
      { kind: 10, magnitude: -2, operator: 0, target: 0 },
      { kind: 11, magnitude: -50, operator: 2, target: 1 },
      { kind: 25, magnitude: 3, operator: 0, target: 16 },
      { kind: 25, magnitude: 2, operator: 1, target: 16 },
    ],
    recipeIndex: null,
  }]).modifiers
  const factors = { damage: 1.25, equipment, manaCost: 0.8 }
  assert.ok(Math.abs(
    resolveNativeSkillDamage(16, factors, { baseDamage: 10 })
    - (10 + 5 + 3) * 1.5 * 1.2 * 2 * 1.25
  ) < 0.00001)
  assert.equal(
    resolveNativeSkillManaCost(16, factors, { baseManaCost: 10 }),
    (10 * 0.8 - 2) * 0.5,
  )
  assert.equal(
    resolveNativeSkillDamage(8, factors, { baseDamage: 10 }),
    (10 + 5) * 1.5 * 1.25,
  )
})

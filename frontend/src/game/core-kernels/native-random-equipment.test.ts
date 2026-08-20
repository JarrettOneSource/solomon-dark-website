import assert from 'node:assert/strict'
import test from 'node:test'

import type { EquipmentType } from './hub-economy.ts'
import {
  generateNativeRandomEquipmentEffects,
  nativeRandomEquipmentSkillPools,
} from './native-random-equipment.ts'
import { createNativeRng } from './native-rng.ts'

const TYPES: readonly EquipmentType[] = ['hat', 'robe', 'staff', 'wand', 'ring', 'amulet']

test('random equipment synthesizes one or two complete native FX records and a native affix name', () => {
  let observedDouble = false
  const observedKinds = new Set<number>()
  for (const equipmentType of TYPES) {
    for (let seed = 1; seed <= 500; seed += 1) {
      const generated = generateNativeRandomEquipmentEffects(
        createNativeRng(seed),
        equipmentType,
        40,
        { advancedUnlocks: new Array<boolean>(8).fill(true) },
      )
      assert.ok(generated.effects.length === 1 || generated.effects.length === 2)
      observedDouble ||= generated.effects.length === 2
      assert.match(generated.name, new RegExp(equipmentType, 'i'))
      for (const effect of generated.effects) {
        assert.ok(effect.kind >= 1 && effect.kind <= 25)
        assert.ok(effect.operator >= 0 && effect.operator <= 2)
        assert.ok(Number.isFinite(effect.magnitude))
        assert.ok(Number.isInteger(effect.target))
        observedKinds.add(effect.kind)
      }
    }
  }
  assert.equal(observedDouble, true)
  assert.deepEqual([...observedKinds].sort((left, right) => left - right), [
    1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
  ])
})

test('random-equipment FX and names replay from the exact shared state', () => {
  const first = generateNativeRandomEquipmentEffects(
    createNativeRng(12_345),
    'staff',
    24,
    { advancedUnlocks: new Array<boolean>(8).fill(true) },
  )
  const replay = generateNativeRandomEquipmentEffects(
    createNativeRng(12_345),
    'staff',
    24,
    { advancedUnlocks: new Array<boolean>(8).fill(true) },
  )
  assert.deepEqual(replay, first)
  assert.ok(first.sharedRng.indexA > 0)
})

test('the second-affix lane starts strictly above level 18 and writes item level 8', () => {
  for (const level of [7, 13, 18]) {
    for (let seed = 1; seed <= 2_000; seed += 1) {
      const generated = generateNativeRandomEquipmentEffects(
        createNativeRng(seed),
        'staff',
        level,
        { advancedUnlocks: new Array<boolean>(8).fill(true) },
      )
      assert.equal(generated.effects.length, 1, `level ${level}, seed ${seed}`)
    }
  }

  let doubleWithoutSkillMinimum = null
  for (let seed = 1; seed <= 20_000; seed += 1) {
    const generated = generateNativeRandomEquipmentEffects(
      createNativeRng(seed),
      'staff',
      19,
      { advancedUnlocks: new Array<boolean>(8).fill(true) },
    )
    if (generated.effects.length === 2 && !generated.effects.some(({ kind }) => kind === 4)) {
      doubleWithoutSkillMinimum = generated
      break
    }
  }
  assert.ok(doubleWithoutSkillMinimum)
  assert.equal(doubleWithoutSkillMinimum.itemLevel, 8)
})

test('random equipment preserves the three compiled skill-target pools and advanced gates', () => {
  const locked = nativeRandomEquipmentSkillPools({
    advancedUnlocks: new Array<boolean>(8).fill(false),
  })
  assert.deepEqual(locked.primary, [8, 11, 15, 16, 21, 22, 23, 27, 29, 32, 40, 50, 52, 55, 65])
  assert.deepEqual(locked.primaryOrDiscipline, [
    8, 11, 15, 16, 21, 22, 23, 27, 29, 32, 40, 50, 52, 55,
    57, 58, 59, 60, 61, 62, 63, 65, 66, 67, 68, 69, 70, 71,
  ])
  assert.deepEqual(locked.all, Array.from({ length: 64 }, (_, index) => index + 8))

  const unlocked = nativeRandomEquipmentSkillPools({
    advancedUnlocks: new Array<boolean>(8).fill(true),
  })
  assert.deepEqual(unlocked.primary.slice(-4), [65, 72, 73, 74])
  assert.deepEqual(unlocked.all.slice(-8), [72, 73, 74, 75, 76, 77, 78, 79])
})

test('dynamic skill affixes use stock names and unhalved wearable families stay unhalved', () => {
  let dynamicName: string | null = null
  let wealthyMagnitude = 0
  for (let seed = 1; seed <= 20_000 && (dynamicName === null || wealthyMagnitude <= 100); seed += 1) {
    const wearable = generateNativeRandomEquipmentEffects(
      createNativeRng(seed),
      'hat',
      80,
      { advancedUnlocks: new Array<boolean>(8).fill(true) },
    )
    wealthyMagnitude = Math.max(
      wealthyMagnitude,
      ...wearable.effects.filter(({ kind }) => kind === 14).map(({ magnitude }) => magnitude),
    )
    const weapon = generateNativeRandomEquipmentEffects(
      createNativeRng(seed),
      'staff',
      80,
      { advancedUnlocks: new Array<boolean>(8).fill(true) },
    )
    if (weapon.effects.some(({ kind }) => kind === 5)) dynamicName = weapon.name
  }
  assert.ok(dynamicName)
  assert.doesNotMatch(dynamicName, /Skill \d+/u)
  assert.ok(wealthyMagnitude > 100)
})

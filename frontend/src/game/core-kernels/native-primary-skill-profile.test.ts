import assert from 'node:assert/strict'
import test from 'node:test'

import type { WizardElement } from './player-character.ts'
import {
  createPlayerSkillBook,
  playerStatBook,
  type PlayerSkillBookComponent,
} from './player-progression.ts'
import { nativePrimarySkillProfile } from './native-primary-skill-profile.ts'
import { createNativeEquipmentModifiers } from './native-equipment-effects.ts'

const FACTORS = Object.freeze({ damage: 1.5, manaCost: 0.75 })

test('resolves Ether ranks into a cast-time projectile payload', () => {
  const profile = nativePrimarySkillProfile(book('ether', {
    8: 2,
    9: 2,
    10: 3,
    13: 2,
    14: 3,
  }), playerStatBook(), FACTORS)
  assert.deepEqual(profile, {
    blastChargeCapacity: 3,
    damageMaximum: 6,
    damageMinimum: 3,
    damageRetention: 0.25,
    damageRollCount: 3,
    kind: 'ether',
    manaCost: (9 + 2 + 15 + 10) * 0.75,
    pierces: 2,
    quantity: 4,
    rank: 2,
    reacquiresTarget: true,
    skillId: 8,
    speedFactor: 1.25,
  })
})

test('resolves Fire impact, ember, burn, and exclusive spent-ember payloads', () => {
  const profile = nativePrimarySkillProfile(book('fire', {
    16: 3,
    17: 2,
    18: 2,
    19: 2,
    20: 0,
    22: 2,
  }), playerStatBook(), FACTORS)
  assert.deepEqual(profile, {
    burnDamage: 9,
    damageMaximum: 15,
    damageMinimum: 15,
    damageRollCount: 1,
    emberDamage: 6,
    emberFragments: 5,
    explodeDamage: 13.5,
    explodeRadius: 11,
    kind: 'fire',
    manaCost: (18 + 6 + 10 + 24) * 0.75,
    rank: 3,
    skillId: 16,
    spentEmber: { damage: 3, kind: 'imp', lifetimeTicks: 300 },
  })
})

test('repeats a short native property array terminal entry at higher effective ranks', () => {
  const statBook = playerStatBook()
  const entries = [...statBook.entries]
  const fireball = entries[16]!
  entries[16] = {
    ...fireball,
    numericProperties: {
      ...fireball.numericProperties,
      mDamage: [0, 10],
    },
  }
  const profile = nativePrimarySkillProfile(
    book('fire', { 16: 5 }),
    { ...statBook, entries },
    { damage: 1, manaCost: 1 },
  )
  assert.equal(profile.damageMinimum, 10)
  assert.equal(profile.damageMaximum, 10)
})

test('resolves Air chain, stun, hurricane, and disintegrate payloads', () => {
  const profile = nativePrimarySkillProfile(book('air', {
    24: 4,
    25: 3,
    26: 2,
    29: 2,
    31: 2,
  }), playerStatBook(), FACTORS)
  assert.deepEqual(profile, {
    arcCount: 3,
    damageMaximum: 13.5,
    damageMinimum: 13.5,
    damageRollCount: 1,
    disintegrateChance: 10,
    hurricaneDamageMaximum: 45,
    hurricaneDamageMinimum: 22.5,
    kind: 'air',
    manaCost: (20 + 20 + 10 + 40 + 10) * 0.75,
    rank: 4,
    skillId: 24,
    stunMovementFactor: 1 - 55 / 100,
  })
})

test('resolves Water geometry, armor, aura, hail, and permafrost payloads', () => {
  const profile = nativePrimarySkillProfile(book('water', {
    32: 2,
    33: 2,
    34: 3,
    36: 2,
    37: 2,
    38: 2,
    39: 1,
  }), playerStatBook(), FACTORS)
  assert.deepEqual(profile, {
    armorMaximum: 50,
    armorPerSecond: 12,
    auraMovementFactor: 0.5,
    auraRadius: 7,
    auraSlowFactor: 0.5,
    coldDurationTicks: 200,
    coldMovementFactor: 1 / 3,
    damageMaximum: 5.25,
    damageMinimum: 5.25,
    damageRollCount: 1,
    hailChance: 8,
    hailDamageMaximum: 30,
    hailDamageMinimum: 12,
    hailThreshold: 240,
    halfAngleDegrees: 32.5,
    kind: 'water',
    manaCost: (17.5 + 10 + 20 + 8 + 10 + 10) * 0.75,
    minimumColdDurationTicks: 200,
    pushbackFactor: Math.fround(20 * 0.009999999776482582),
    rank: 2,
    reach: 345,
    skillId: 32,
    slowdownScale: 1.5,
    widenHalfDegrees: 35,
  })
})

test('normalizes every authored Chill Wind percent before the Water handler', () => {
  for (const [rank, authored] of [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].entries()) {
    const profile = nativePrimarySkillProfile(
      book('water', { 32: 1, 33: rank }),
      playerStatBook(),
      { damage: 1, manaCost: 1 },
    )
    assert.equal(profile.kind, 'water')
    if (profile.kind !== 'water') throw new Error('expected Water profile')
    assert.equal(
      profile.pushbackFactor,
      Math.fround(authored * 0.009999999776482582),
      `Chill rank ${rank}`,
    )
  }
})

test('resolves Earth growth, toughness, surge, and Gargantuan ceiling', () => {
  const profile = nativePrimarySkillProfile(book('earth', {
    40: 3,
    42: 2,
    43: 2,
    44: 2,
    47: 2,
  }), playerStatBook(), FACTORS)
  assert.deepEqual(profile, {
    damageMaximum: 75,
    damageMinimum: 75,
    damageRollCount: 1,
    growthFactor: 2,
    kind: 'earth',
    manaCost: (14 + 0.2 + 0.2 + 0.2) * 0.75,
    maximumCharge: 2.2,
    rank: 3,
    rockSurgeChance: 25,
    rockSurgeManaCost: 90 * 0.75,
    skillId: 40,
    toughness: 5,
  })
})

test('resolves the selected welded build ahead of the elemental primary', () => {
  const source = book('ether', {
    8: 1,
    9: 1,
    10: 1,
    16: 1,
    17: 1,
    18: 1,
    52: 1,
  })
  const profile = nativePrimarySkillProfile(
    { ...source, primarySkillId: 52, weldBuildId: 1000 },
    playerStatBook(),
    FACTORS,
  )
  assert.equal(profile.kind, 'weld')
  if (profile.kind !== 'weld') return
  assert.equal(profile.buildId, 1000)
  assert.equal(profile.castKind, 'one-shot')
  assert.equal(profile.damageMinimum, 3)
  assert.ok(Math.abs(profile.damageMaximum - 4) < 0.000_001)
  assert.equal(profile.manaCost, 23.38349723815918 * 0.75)
  assert.deepEqual(profile.vector.values, [
    2,
    2.6666667461395264,
    23.38349723815918,
    2,
    1.375,
    3.75,
    8,
    1.5,
    3,
  ])

  const boosted = nativePrimarySkillProfile(
    { ...source, primarySkillId: 52, weldBuildId: 1000 },
    playerStatBook(),
    {
      ...FACTORS,
      equipment: { ...createNativeEquipmentModifiers(), weldEffect: 1.25 },
    },
  )
  assert.equal(boosted.kind, 'weld')
  if (boosted.kind !== 'weld') return
  assert.equal(boosted.vector.values[0], 2.5)
  assert.equal(boosted.damageMinimum, 3.75)
})

function book(
  element: WizardElement,
  ranks: Readonly<Record<number, number>>,
): PlayerSkillBookComponent {
  const source = createPlayerSkillBook({
    discipline: 'arcane',
    displayName: 'Profile Test',
    element,
  })
  const permanentRanks = [...source.permanentRanks]
  const effectiveRanks = [...source.effectiveRanks]
  for (const [rawSkillId, rank] of Object.entries(ranks)) {
    const skillId = Number(rawSkillId)
    permanentRanks[skillId] = rank
    effectiveRanks[skillId] = rank
  }
  return {
    ...source,
    effectiveRanks,
    permanentRanks,
  }
}

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
    auraMovementFactor: Math.fround(Math.fround(0.5) / Math.fround(1.5)),
    auraRadius: 840,
    auraSlowFactor: Math.fround(0.5),
    coldDurationTicks: 200,
    coldMovementFactor: Math.fround(Math.fround(0.5) / Math.fround(1.5)),
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
    slowdownScale: Math.fround(1.5),
    widenHalfDegrees: 35,
  })
})

test('drains every Cold Aura radius and Permafrost-scaled movement row', () => {
  const percentages = [0, 40, 50, 55, 60, 65, 70, 75, 80, 85, 90]
  const radiiFeet = [0, 6, 7, 8, 9, 9.5, 10, 10.5, 11, 11.5, 12]
  const auraMana = [0, 7.5, 10, 20, 25, 30, 35, 40, 45, 50.5, 51]
  for (const permafrostRank of [0, 1]) {
    const slowdownScale = Math.fround(permafrostRank === 0 ? 1 : 1.5)
    for (let auraRank = 0; auraRank < radiiFeet.length; auraRank += 1) {
      const profile = nativePrimarySkillProfile(
        book('water', { 32: 1, 37: auraRank, 39: permafrostRank }),
        playerStatBook(),
        { damage: 1, manaCost: 1 },
      )
      assert.equal(profile.kind, 'water')
      if (profile.kind !== 'water') throw new Error('expected Water profile')
      const auraSlowFactor = Math.fround(1 - percentages[auraRank]! / 100)
      assert.equal(profile.auraRadius, Math.fround(radiiFeet[auraRank]! * 120))
      assert.equal(profile.auraSlowFactor, auraSlowFactor)
      assert.equal(
        profile.auraMovementFactor,
        Math.fround(auraSlowFactor / slowdownScale),
      )
      assert.equal(profile.manaCost, 12.5 + auraMana[auraRank]!)
    }
  }
})

test('drains every Frost Jet damage, Harden, and Hail authored rank', () => {
  const frostDamage = [
    0, 2.5, 3.5, 5.5, 7.5, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33,
    35, 37, 39, 41, 43, 45, 47, 49,
  ]
  const frostMana = [
    0, 12.5, 17.5, 18.5, 20, 21, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 42.5,
    45, 47.5, 50, 52.5, 55, 57.5, 60, 62.5, 64.5, 66.5, 68.5, 70.5,
  ]
  for (let rank = 1; rank < frostDamage.length; rank += 1) {
    const profile = nativePrimarySkillProfile(
      book('water', { 32: rank }),
      playerStatBook(),
      { damage: 1, manaCost: 1 },
    )
    assert.equal(profile.kind, 'water')
    if (profile.kind !== 'water') throw new Error('expected Water profile')
    assert.equal(profile.damageMinimum, frostDamage[rank], `Frost damage rank ${rank}`)
    assert.equal(profile.damageMaximum, frostDamage[rank], `Frost damage rank ${rank}`)
    assert.equal(profile.manaCost, frostMana[rank], `Frost mana rank ${rank}`)
  }

  const hardenArmor = [0, 8, 12, 18, 25, 30, 35, 40, 45, 50, 60]
  const hardenMaximum = [0, 25, 50, 75, 100, 125, 150, 175, 200, 250, 300]
  const hardenMana = [0, 5, 8, 10, 15, 25, 32, 45, 50, 55, 58]
  for (let rank = 0; rank < hardenArmor.length; rank += 1) {
    const profile = nativePrimarySkillProfile(
      book('water', { 32: 1, 36: rank }),
      playerStatBook(),
      { damage: 1, manaCost: 1 },
    )
    assert.equal(profile.kind, 'water')
    if (profile.kind !== 'water') throw new Error('expected Water profile')
    assert.equal(profile.armorPerSecond, hardenArmor[rank], `Harden armor rank ${rank}`)
    assert.equal(profile.armorMaximum, hardenMaximum[rank], `Harden maximum rank ${rank}`)
    assert.equal(profile.manaCost, 12.5 + hardenMana[rank]!, `Harden mana rank ${rank}`)
  }

  const hailMinimum = [0, 5, 8, 10, 12, 14, 16, 17, 18, 19, 20]
  const hailMaximum = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  const hailChance = [0, 5, 8, 10, 12, 14, 16, 18, 20, 22, 25]
  const hailMana = [0, 7.5, 10, 20, 25, 30, 35, 40, 45, 50.5, 51]
  for (let rank = 0; rank < hailMinimum.length; rank += 1) {
    const profile = nativePrimarySkillProfile(
      book('water', { 32: 1, 38: rank }),
      playerStatBook(),
      { damage: 1, manaCost: 1 },
    )
    assert.equal(profile.kind, 'water')
    if (profile.kind !== 'water') throw new Error('expected Water profile')
    assert.equal(profile.hailDamageMinimum, hailMinimum[rank], `Hail minimum rank ${rank}`)
    assert.equal(profile.hailDamageMaximum, hailMaximum[rank], `Hail maximum rank ${rank}`)
    assert.equal(profile.hailChance, hailChance[rank], `Hail chance rank ${rank}`)
    assert.equal(profile.hailThreshold, hailChance[rank]! * 30, `Hail threshold rank ${rank}`)
    assert.equal(profile.manaCost, 12.5 + hailMana[rank]!, `Hail mana rank ${rank}`)
  }
})

test('normalizes every authored Chill Wind percent before the Water handler', () => {
  const manaCosts = [0, 5, 10, 15, 20, 25, 27.5, 30, 31, 32.5, 33.5]
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
    assert.equal(profile.manaCost, 12.5 + manaCosts[rank]!, `Chill mana rank ${rank}`)
  }
})

test('drains every Cone of Ice authored width and mana row into its cached profile', () => {
  const widen = [0, 30, 50, 70, 80, 90, 100, 110, 120, 130, 140, 150]
  const mana = [0, 7.5, 10, 20, 25, 30, 35, 40, 45, 50.5, 51, 51.5]
  for (let rank = 0; rank < widen.length; rank += 1) {
    const profile = nativePrimarySkillProfile(
      book('water', { 32: 1, 34: rank }),
      playerStatBook(),
      { damage: 1, manaCost: 1 },
    )
    assert.equal(profile.kind, 'water')
    if (profile.kind !== 'water') throw new Error('expected Water profile')
    assert.equal(profile.widenHalfDegrees, Math.fround(widen[rank]! * 0.5))
    assert.equal(profile.manaCost, 12.5 + mana[rank]!)
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

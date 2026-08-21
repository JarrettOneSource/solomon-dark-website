import assert from 'node:assert/strict'
import test from 'node:test'

import type { PlayerCharacterConfig } from './player-character.ts'
import {
  applyPlayerSkillChoice,
  createPlayerProgression,
  createPlayerSkillBook,
  effectiveSecondaryAbilityRankStats,
  equipPlayerSecondaryAbility,
  selectPlayerConcentrationSkill,
  selectPlayerPrimarySkill,
  type PlayerProgressionComponent,
  type PlayerSkillBookComponent,
} from './player-progression.ts'

const ETHER_ARCANE: PlayerCharacterConfig = {
  discipline: 'arcane',
  displayName: 'Belt Tester',
  element: 'ether',
}

test('a native player starts with one element secondary in right-mouse slot zero', () => {
  assert.deepEqual(createPlayerSkillBook(ETHER_ARCANE).secondaryBelt, [
    11, null, null, null, null, null, null, null,
  ])
  assert.deepEqual(createPlayerSkillBook({ ...ETHER_ARCANE, element: 'fire' }).secondaryBelt, [
    21, null, null, null, null, null, null, null,
  ])
  assert.deepEqual(createPlayerSkillBook({ ...ETHER_ARCANE, element: 'air' }).secondaryBelt, [
    27, null, null, null, null, null, null, null,
  ])
  assert.deepEqual(createPlayerSkillBook({ ...ETHER_ARCANE, element: 'water' }).secondaryBelt, [
    35, null, null, null, null, null, null, null,
  ])
  assert.deepEqual(createPlayerSkillBook({ ...ETHER_ARCANE, element: 'earth' }).secondaryBelt, [
    45, null, null, null, null, null, null, null,
  ])
})

test('learning a secondary fills one empty slot while rank-ups never duplicate it', () => {
  const initial = createPlayerSkillBook(ETHER_ARCANE)
  const learned = choose(initial, 48, 1)
  assert.deepEqual(learned.secondaryBelt, [11, 48, null, null, null, null, null, null])

  const ranked = choose(learned, 48, 2)
  assert.deepEqual(ranked.secondaryBelt, learned.secondaryBelt)
  assert.equal(ranked.secondaryBelt.filter((skillId) => skillId === 48).length, 1)
})

test('equipping a learned secondary replaces only the addressed stock belt slot', () => {
  const learned = choose(choose(createPlayerSkillBook(ETHER_ARCANE), 48, 1), 49, 1)
  const moved = equipPlayerSecondaryAbility(learned, 48, 7)
  assert.deepEqual(moved.secondaryBelt, [11, 48, 49, null, null, null, null, 48])
  const displaced = equipPlayerSecondaryAbility(moved, 49, 0)
  assert.deepEqual(displaced.secondaryBelt, [49, 48, 49, null, null, null, null, 48])

  assert.throws(() => equipPlayerSecondaryAbility(learned, 50, 4), /not learned/)
  assert.throws(() => equipPlayerSecondaryAbility(learned, 48, 8), /slot/)
  assert.throws(() => equipPlayerSecondaryAbility(learned, 8, 1), /secondary/)
})

test('primary and concentration interactions validate learned rows and native replacement order', () => {
  let book = choose(createPlayerSkillBook(ETHER_ARCANE), 16, 1)
  book = selectPlayerPrimarySkill(book, 16)
  assert.equal(book.primarySkillId, 16)

  book = choose(book, 57, 1)
  book = choose(book, 65, 1)
  book = choose(book, 58, 1)
  book = selectPlayerConcentrationSkill(book, 57, true, 0)
  assert.deepEqual(book.concentrationSkillIds, [57, null])
  book = selectPlayerConcentrationSkill(book, 65, true, 0)
  assert.deepEqual(book.concentrationSkillIds, [57, 65])
  book = selectPlayerConcentrationSkill(book, 58, true, 0)
  assert.deepEqual(book.concentrationSkillIds, [58, 65])
  assert.equal(book.nextConcentrationSlot, 1)
  assert.throws(() => selectPlayerConcentrationSkill(book, 57, true, 1), /Mind Chug/)
  assert.throws(() => selectPlayerConcentrationSkill(book, 65, true, 0), /already selected/)
})

test('all 23 secondaries resolve their authored rank-one payload without substitution', () => {
  const cases = [
    [11, { mDamage: 2, mManaCost: 75, mQuantity: 1 }],
    [12, { mDuration: 8, mManaCost: 100 }],
    [15, { mCooldown: 1, mManaCost: 75 }],
    [21, { mDamage: 5, mManaCost: 75 }],
    [23, { mDamage: 8, mDuration: 2.5, mHoard: 50 }],
    [27, { mDamage1: 4, mDamage2: 6, mManaCost: 70 }],
    [30, { mDuration: 10, mManaCost: 70 }],
    [35, { mDamage: 10, mManaCost: 40 }],
    [41, { mDuration: 10, mManaCost: 75 }],
    [45, { mDamage1: 4, mDamage2: 6, mHP: 100, mManaCost: 10 }],
    [46, { mDuration: 6, mManaCost: 10 }],
    [48, { mCooldown: 60, mManaCost: 10 }],
    [49, { mManaCost: 75, mSlow: 50 }],
    [50, { mDamage: 5, mManaCost: 25 }],
    [51, { mManaCost: 90 }],
    [54, { mAbsorb: 25, mManaCost: 80 }],
    [72, { mDamage: 2, mManaCost: 70 }],
    [73, { mDamage: 2, mManaCost: 70 }],
    [74, { mDamage: 5, mManaCost: 80 }],
    [76, { mDamage: 50, mFreeze: 10, mManaCost: 100 }],
    [77, { mFlee: 3, mManaCost: 100, mWeaken: 10 }],
    [78, { mHoard: 60 }],
    [79, { mHoard: 25 }],
  ] as const

  for (const [skillId, values] of cases) {
    const book = withLearnedRank(createPlayerSkillBook(ETHER_ARCANE), skillId, 1)
    const stats = effectiveSecondaryAbilityRankStats(book, skillId)
    assert.equal(stats.skillId, skillId)
    assert.equal(stats.rank, 1)
    assert.deepEqual(stats.values, values)
  }
})

test('secondary rank resolution uses effective rank and clamps authored terminal arrays', () => {
  let book = withLearnedRank(createPlayerSkillBook(ETHER_ARCANE), 78, 1)
  const effectiveRanks = [...book.effectiveRanks]
  effectiveRanks[78] = 2
  book = { ...book, effectiveRanks: Object.freeze(effectiveRanks) }
  assert.deepEqual(effectiveSecondaryAbilityRankStats(book, 78), {
    rank: 2,
    skillId: 78,
    values: Object.freeze({ mHoard: 40 }),
  })

  const terminal = withLearnedRank(book, 27, 10)
  assert.deepEqual(effectiveSecondaryAbilityRankStats(terminal, 27).values, {
    mDamage1: 25,
    mDamage2: 50,
    mManaCost: 50,
  })
  assert.throws(() => effectiveSecondaryAbilityRankStats(book, 8), /secondary/)
  assert.throws(() => effectiveSecondaryAbilityRankStats(book, 48), /rank 0/)
})

function choose(
  skillBook: PlayerSkillBookComponent,
  skillId: number,
  targetRank: number,
): PlayerSkillBookComponent {
  const progression: PlayerProgressionComponent = {
    ...createPlayerProgression(skillId),
    pendingLevels: Object.freeze([2]),
    pendingOffer: Object.freeze({
      level: 2,
      options: Object.freeze([Object.freeze({ skillId, targetRank })]),
      sequence: skillId * 100 + targetRank,
    }),
  }
  const applied = applyPlayerSkillChoice(progression, skillBook, {
    choiceIndex: 0,
    offerSequence: skillId * 100 + targetRank,
    skillId,
  })
  assert.ok(applied)
  return applied.skillBook
}

function withLearnedRank(
  source: PlayerSkillBookComponent,
  skillId: number,
  rank: number,
): PlayerSkillBookComponent {
  const permanentRanks = [...source.permanentRanks]
  const effectiveRanks = [...source.effectiveRanks]
  permanentRanks[skillId] = rank
  effectiveRanks[skillId] = rank
  return {
    ...source,
    permanentRanks: Object.freeze(permanentRanks),
    effectiveRanks: Object.freeze(effectiveRanks),
  }
}

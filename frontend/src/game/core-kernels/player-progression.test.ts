import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_PLAYER_EXPERIENCE,
  MAX_PLAYER_LEVEL,
  NATIVE_LEVEL_THRESHOLDS,
  NATIVE_SKILL_ROW_COUNT,
  NATIVE_WELD_BUILDS,
  SPELL_WELDING_SKILL_ID,
  applyPlayerSkillChoice,
  buildPlayerSkillOffer,
  createPlayerProgression,
  createPlayerSkillBook,
  grantPlayerExperience,
  nativeWeldBuild,
  playerStatBook,
  type PlayerProgressionComponent,
  type PlayerSkillBookComponent,
} from './player-progression.ts'
import { createNativeRng, drawNativeInteger } from './native-rng.ts'

const ETHER_ARCANE = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

function offerProgression(
  offerSeed: number,
  level: number,
  overrides: Partial<PlayerProgressionComponent> = {},
): PlayerProgressionComponent {
  return {
    ...createPlayerProgression(offerSeed),
    level,
    maximumMana: 100,
    ...overrides,
  }
}

function withLearnedSkills(
  book: PlayerSkillBookComponent,
  skillIds: readonly number[],
): PlayerSkillBookComponent {
  const permanentRanks = [...book.permanentRanks]
  const effectiveRanks = [...book.effectiveRanks]
  for (const skillId of skillIds) {
    permanentRanks[skillId] = 1
    effectiveRanks[skillId] = 1
  }
  return {
    ...book,
    permanentRanks: Object.freeze(permanentRanks),
    effectiveRanks: Object.freeze(effectiveRanks),
  }
}

test('the native integer stream matches the sealed retail seed-1 fixture', () => {
  const expected = [
    4, 15, 3, 3, 6, 10, 0, 10, 11, 6, 2, 8,
    11, 3, 15, 2, 1, 4, 6, 11, 2, 14, 0, 15,
  ]
  let rng = createNativeRng(1)
  const actual = expected.map(() => {
    const draw = drawNativeInteger(rng, 16)
    rng = draw.state
    return draw.value
  })
  assert.deepEqual(actual, expected)
})

test('a fresh wizard owns independent 83-row skill bookkeeping and the stock roots', () => {
  const first = createPlayerSkillBook(ETHER_ARCANE)
  const second = createPlayerSkillBook(ETHER_ARCANE)
  assert.equal(first.permanentRanks.length, NATIVE_SKILL_ROW_COUNT)
  assert.equal(first.effectiveRanks.length, NATIVE_SKILL_ROW_COUNT)
  assert.notEqual(first.permanentRanks, second.permanentRanks)
  assert.deepEqual(
    first.permanentRanks.flatMap((rank, id) => rank > 0 ? [id] : []),
    [0, 7, 8, 11],
  )
  assert.deepEqual(first.permanentRanks, first.effectiveRanks)
  assert.equal(first.activeWeldBuildId, null)
  assert.equal(first.primarySkillId, 8)
  assert.equal(first.secondarySkillId, 11)
  const progression = createPlayerProgression(0)
  assert.equal(progression.offerCycle, 0)
  assert.equal(progression.weldOfferMarker, 9_999)
  assert.deepEqual(progression.forcedOfferSkillIds, [])
})

test('the player stat book exposes the immutable native catalog including its internal row', () => {
  const statBook = playerStatBook()
  assert.equal(statBook.entries.length, NATIVE_SKILL_ROW_COUNT)
  assert.equal(statBook.entries[8]?.maximumLevel, 25)
  assert.deepEqual(statBook.entries[8]?.numericProperties.mManaCost, [
    0, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51,
    54, 57, 60, 63, 65, 67, 68, 69, 70,
  ])
  assert.equal(statBook.entries[82]?.maximumLevel, 0)
  assert.ok(Object.isFrozen(statBook.entries))
  assert.ok(Object.isFrozen(statBook.entries[8]?.numericProperties))
})

test('native XP thresholds queue a mandatory deterministic offer and selection only books rank', () => {
  const skillBook = createPlayerSkillBook(ETHER_ARCANE)
  const initial = createPlayerProgression(79225)
  assert.equal(grantPlayerExperience(initial, skillBook, 90).level, 1)
  const leveled = grantPlayerExperience(initial, skillBook, 100)
  assert.equal(leveled.level, 2)
  assert.equal(leveled.previousThreshold, 90)
  assert.equal(leveled.nextThreshold, 160)
  assert.deepEqual(leveled.pendingLevels, [2])
  assert.equal(leveled.pendingOffer?.options.length, 3)
  assert.deepEqual(leveled.pendingOffer?.options.map((option) => option.skillId), [8, 11, 67])
  assert.deepEqual(
    leveled.pendingOffer,
    buildPlayerSkillOffer(offerProgression(79225, 2, { offerCycle: 1 }), skillBook, 2),
  )

  const offer = leveled.pendingOffer!
  const chosen = offer.options[0]!
  const beforeRanks = [...skillBook.permanentRanks]
  assert.ok(offer.options.every((option) => (
    option.targetRank === beforeRanks[option.skillId]! + 1
  )))
  const applied = applyPlayerSkillChoice(leveled, skillBook, {
    choiceIndex: 0,
    offerSequence: offer.sequence,
    skillId: chosen.skillId,
  })
  assert.ok(applied)
  assert.equal(applied.progression.pendingOffer, null)
  assert.equal(applied.progression.currentHealth, leveled.currentHealth)
  assert.equal(applied.progression.currentMana, leveled.currentMana)
  assert.equal(
    applied.skillBook.permanentRanks[chosen.skillId],
    beforeRanks[chosen.skillId]! + 1,
  )
  assert.equal(
    applied.skillBook.effectiveRanks[chosen.skillId],
    beforeRanks[chosen.skillId]! + 1,
  )
  assert.equal(
    applied.skillBook.permanentRanks.filter((rank, id) => rank !== beforeRanks[id]).length,
    1,
  )
  assert.equal(applyPlayerSkillChoice(leveled, skillBook, {
    choiceIndex: 1,
    offerSequence: offer.sequence,
    skillId: chosen.skillId,
  }), null)
})

test('offer fill preserves the native category collision guards', () => {
  const fresh = createPlayerSkillBook(ETHER_ARCANE)
  const levelTen = buildPlayerSkillOffer(offerProgression(18, 10), fresh, 1)
  assert.deepEqual(levelTen.options.map((option) => option.skillId), [40, 69, 53])
  assert.equal(
    levelTen.options.filter((option) => [8, 16, 24, 32, 40, 52].includes(option.skillId)).length,
    1,
  )

  const permanentRanks = [...fresh.permanentRanks]
  const effectiveRanks = [...fresh.effectiveRanks]
  for (const skillId of [9, 17, 25, 33, 43]) {
    permanentRanks[skillId] = 1
    effectiveRanks[skillId] = 1
  }
  const advancedBook = {
    ...fresh,
    permanentRanks: Object.freeze(permanentRanks),
    effectiveRanks: Object.freeze(effectiveRanks),
  }
  const categoryFour = new Set([13, 14, 19, 20, 29, 31, 36, 37, 44, 47])
  for (let seed = 0; seed < 256; seed += 1) {
    const offer = buildPlayerSkillOffer(
      offerProgression(seed, 30),
      advancedBook,
      seed + 1,
    )
    assert.ok(offer.options.filter((option) => categoryFour.has(option.skillId)).length <= 1)
  }
})

test('the stock forced prefix is bookkeeping and consumes all three ordinary slots', () => {
  const skillBook = createPlayerSkillBook(ETHER_ARCANE)
  const offer = buildPlayerSkillOffer(offerProgression(19, 12, {
    forcedOfferSkillIds: Object.freeze([64, 56, 67]),
  }), skillBook, 1)
  assert.deepEqual(new Set(offer.options.map(({ skillId }) => skillId)), new Set([64, 56, 67]))
})

test('Spell Welding uses the ten recovered synthetic builds and native icon rows', () => {
  assert.deepEqual(
    NATIVE_WELD_BUILDS.map(({ id, skillsAtlasIconRecord }) => [id, skillsAtlasIconRecord]),
    [
      [1000, 81], [1001, 82], [1002, 83], [1003, 84], [1004, 85],
      [1005, 86], [1006, 87], [1007, 88], [1008, 89], [1009, 90],
    ],
  )
  assert.deepEqual(nativeWeldBuild(1000)?.primarySkillIds, [8, 16])
  assert.deepEqual(nativeWeldBuild(1009)?.primarySkillIds, [24, 40])
  assert.equal(nativeWeldBuild(999), null)
  assert.equal(nativeWeldBuild(1000.5), null)
})

test('Spell Welding is scheduled on the next offer and every fifth cycle from its marker', () => {
  const skillBook = withLearnedSkills(createPlayerSkillBook(ETHER_ARCANE), [16])
  const nextOffer = buildPlayerSkillOffer(offerProgression(31, 8, {
    offerCycle: 1,
    weldOfferMarker: 0,
  }), skillBook, 1)
  const welding = nextOffer.options.find(({ skillId }) => skillId === SPELL_WELDING_SKILL_ID)
  assert.deepEqual(welding, { skillId: 52, targetRank: 1, weldBuildId: 1000 })

  const interveningOffer = buildPlayerSkillOffer(offerProgression(31, 8, {
    offerCycle: 2,
    weldOfferMarker: 0,
  }), skillBook, 2)
  assert.equal(
    interveningOffer.options.some(({ skillId }) => skillId === SPELL_WELDING_SKILL_ID),
    false,
  )

  const fifthOffer = buildPlayerSkillOffer(offerProgression(31, 8, {
    offerCycle: 5,
    weldOfferMarker: 0,
  }), skillBook, 5)
  assert.ok(fifthOffer.options.some(({ skillId }) => skillId === SPELL_WELDING_SKILL_ID))
})

test('a second primary arms Spell Welding and choosing a synthetic build only books row 52', () => {
  const skillBook = createPlayerSkillBook(ETHER_ARCANE)
  const progression = offerProgression(7, 8, {
    offerCycle: 1,
    pendingLevels: Object.freeze([8]),
    pendingOffer: {
      level: 8,
      options: Object.freeze([
        { skillId: 16, targetRank: 1 },
        { skillId: 56, targetRank: 1 },
        { skillId: 64, targetRank: 1 },
      ]),
      sequence: 4,
    },
    revision: 4,
  })
  const primaryApplied = applyPlayerSkillChoice(progression, skillBook, {
    choiceIndex: 0,
    offerSequence: 4,
    skillId: 16,
  })
  assert.ok(primaryApplied)
  assert.equal(primaryApplied.progression.weldOfferMarker, 1)

  const weldingOffer = buildPlayerSkillOffer({
    ...primaryApplied.progression,
    level: 9,
    offerCycle: 2,
  }, primaryApplied.skillBook, 5)
  const choiceIndex = weldingOffer.options.findIndex(
    ({ skillId }) => skillId === SPELL_WELDING_SKILL_ID,
  )
  assert.notEqual(choiceIndex, -1)
  const pendingProgression: PlayerProgressionComponent = {
    ...primaryApplied.progression,
    level: 9,
    offerCycle: 2,
    pendingLevels: Object.freeze([9]),
    pendingOffer: weldingOffer,
    revision: 5,
  }
  const beforeRanks = [...primaryApplied.skillBook.permanentRanks]
  const welded = applyPlayerSkillChoice(pendingProgression, primaryApplied.skillBook, {
    choiceIndex,
    offerSequence: weldingOffer.sequence,
    skillId: SPELL_WELDING_SKILL_ID,
  })
  assert.ok(welded)
  assert.equal(welded.skillBook.permanentRanks[SPELL_WELDING_SKILL_ID], 1)
  assert.equal(welded.skillBook.effectiveRanks[SPELL_WELDING_SKILL_ID], 1)
  assert.equal(welded.skillBook.activeWeldBuildId, 1000)
  assert.deepEqual(
    welded.skillBook.permanentRanks.flatMap((rank, id) => rank !== beforeRanks[id] ? [id] : []),
    [SPELL_WELDING_SKILL_ID],
  )
})

test('the browser keeps the recovered curve but safely clamps the stock level-76 overrun', () => {
  const skillBook = createPlayerSkillBook(ETHER_ARCANE)
  const capped = grantPlayerExperience(
    createPlayerProgression(12),
    skillBook,
    MAX_PLAYER_EXPERIENCE + 500,
  )
  assert.equal(NATIVE_LEVEL_THRESHOLDS.length, 76)
  assert.equal(capped.level, MAX_PLAYER_LEVEL)
  assert.equal(capped.experience, MAX_PLAYER_EXPERIENCE)
  assert.equal(capped.previousThreshold, 8_500_000)
  assert.equal(capped.nextThreshold, MAX_PLAYER_EXPERIENCE)
  assert.equal(capped.pendingLevels.length, 74)
})

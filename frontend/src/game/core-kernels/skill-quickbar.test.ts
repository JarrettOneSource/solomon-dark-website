import assert from 'node:assert/strict'
import test from 'node:test'

import type { PlayerCharacterConfig } from './player-character.ts'
import { createNativeRng } from './native-rng.ts'
import {
  autofillNewlyLearnedNativeBeltSkills,
  bindNativeBeltItem,
  bindNativeBeltSkill,
  createNativePlayerBelt,
  freezeNativeBelt,
  migrateSkillQuickbarToNativeBelt,
  nativeBeltEntryItem,
  nativeBeltPotionProjection,
  nativeInventoryItemCanBindToBelt,
  nativePlayerBeltsEqual,
  refreshNativePlayerBelt,
} from './native-belt.ts'
import {
  DOWSING_EQUIPMENT_RECIPES,
  createEquipmentInventoryItem,
  createHubEconomy,
  type HubInventoryItem,
} from './hub-economy.ts'
import {
  applyPlayerSkillChoice,
  createPlayerProgression,
  createPlayerSkillBook,
  effectiveSecondaryAbilityRankStats,
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
  assert.deepEqual(createNativePlayerBelt(createPlayerSkillBook(ETHER_ARCANE)), [
    { kind: 'skill', skillId: 11 }, null, null,
    { kind: 'health-potion' }, { kind: 'mana-potion' }, null, null, null,
  ])
  assert.deepEqual(createNativePlayerBelt(createPlayerSkillBook({ ...ETHER_ARCANE, element: 'fire' })), [
    { kind: 'skill', skillId: 21 }, null, null,
    { kind: 'health-potion' }, { kind: 'mana-potion' }, null, null, null,
  ])
  assert.deepEqual(createNativePlayerBelt(createPlayerSkillBook({ ...ETHER_ARCANE, element: 'air' })), [
    { kind: 'skill', skillId: 27 }, null, null,
    { kind: 'health-potion' }, { kind: 'mana-potion' }, null, null, null,
  ])
  assert.deepEqual(createNativePlayerBelt(createPlayerSkillBook({ ...ETHER_ARCANE, element: 'water' })), [
    { kind: 'skill', skillId: 35 }, null, null,
    { kind: 'health-potion' }, { kind: 'mana-potion' }, null, null, null,
  ])
  assert.deepEqual(createNativePlayerBelt(createPlayerSkillBook({ ...ETHER_ARCANE, element: 'earth' })), [
    { kind: 'skill', skillId: 45 }, null, null,
    { kind: 'health-potion' }, { kind: 'mana-potion' }, null, null, null,
  ])
})

test('learning a secondary fills one empty slot while rank-ups never duplicate it', () => {
  const initial = createPlayerSkillBook(ETHER_ARCANE)
  const learned = choose(initial, 48, 1)
  const belt = autofillNewlyLearnedNativeBeltSkills(
    createNativePlayerBelt(initial),
    initial,
    learned,
  )
  assert.deepEqual(belt, [
    { kind: 'skill', skillId: 11 }, { kind: 'skill', skillId: 48 }, null,
    { kind: 'health-potion' }, { kind: 'mana-potion' }, null, null, null,
  ])

  const ranked = choose(learned, 48, 2)
  assert.strictEqual(autofillNewlyLearnedNativeBeltSkills(belt, learned, ranked), belt)
  assert.equal(belt.filter((entry) => entry?.kind === 'skill' && entry.skillId === 48).length, 1)
})

test('binding overwrites only the destination and preserves native duplicates', () => {
  const learned = choose(choose(createPlayerSkillBook(ETHER_ARCANE), 48, 1), 49, 1)
  let belt = migrateSkillQuickbarToNativeBelt([11, 48, 49, null, null, null, null, null])
  belt = bindNativeBeltSkill(belt, learned, 48, 7)
  assert.deepEqual(belt[7], { kind: 'skill', skillId: 48 })
  belt = bindNativeBeltSkill(belt, learned, 49, 0)
  assert.deepEqual(belt[0], { kind: 'skill', skillId: 49 })
  belt = bindNativeBeltSkill(belt, learned, null, 2)
  assert.equal(belt[2], null)

  assert.throws(() => bindNativeBeltSkill(belt, learned, 50, 4), /not learned/)
  assert.throws(() => bindNativeBeltSkill(belt, learned, 48, 8), /slot/)
})

test('belt snapshot equality distinguishes exact item identity without rerendering stable aliases', () => {
  const belt = createNativePlayerBelt(createPlayerSkillBook(ETHER_ARCANE))
  assert.equal(nativePlayerBeltsEqual(belt, belt), true)
  assert.equal(nativePlayerBeltsEqual(belt, migrateSkillQuickbarToNativeBelt([
    11, null, null, null, null, null, null, null,
  ])), true)
  const itemA = freezeNativeBelt([
    ...belt.slice(0, 2),
    { itemId: 10, kind: 'item' as const, nativeTypeId: 7002 as const },
    ...belt.slice(3),
  ])
  const itemB = freezeNativeBelt([
    ...itemA.slice(0, 2),
    { itemId: 11, kind: 'item' as const, nativeTypeId: 7002 as const },
    ...itemA.slice(3),
  ])
  assert.equal(nativePlayerBeltsEqual(itemA, itemB), false)
})

test('quickbar accepts learned primaries and concentrations while rejecting passives', () => {
  const initial = createPlayerSkillBook(ETHER_ARCANE)
  let belt = createNativePlayerBelt(initial)
  belt = bindNativeBeltSkill(belt, initial, 8, 1)
  assert.deepEqual(belt[1], { kind: 'skill', skillId: 8 })
  assert.throws(() => bindNativeBeltSkill(belt, initial, 16, 1), /not learned/)

  const concentration = withLearnedRank(initial, 57, 1)
  belt = bindNativeBeltSkill(belt, concentration, 57, 1)
  belt = bindNativeBeltSkill(belt, concentration, 57, 7)
  assert.deepEqual(belt[1], { kind: 'skill', skillId: 57 })
  assert.deepEqual(belt[7], { kind: 'skill', skillId: 57 })
  assert.throws(() => bindNativeBeltSkill(belt, initial, 0, 1), /belt skill/)
})

test('item drops produce aliases or exact native identities and refresh across nested/equipped ownership', () => {
  const skillBook = createPlayerSkillBook(ETHER_ARCANE)
  const base = createHubEconomy(1)
  const ringRecipe = DOWSING_EQUIPMENT_RECIPES.find(({ type }) => type === 'ring')!
  const ring = createEquipmentInventoryItem(ringRecipe, base.nextItemId)
  const sack: HubInventoryItem = {
    contents: [ring],
    equipmentType: null,
    iconRecords: [70],
    id: base.nextItemId + 1,
    kind: 'sack',
    name: 'Belt Sack',
    nativeSubtype: 0,
    nativeTypeId: 7008,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  let economy = { ...base, backpack: [base.backpack[0]!, base.backpack[1]!, sack] }
  let belt = bindNativeBeltItem(createNativePlayerBelt(skillBook), economy, base.backpack[0]!.id, 2)
  assert.deepEqual(belt[2], { kind: 'health-potion' })
  belt = bindNativeBeltItem(belt, economy, ring.id, 5)
  assert.deepEqual(belt[5], { itemId: ring.id, kind: 'item', nativeTypeId: 7002 })
  assert.equal(nativeBeltEntryItem(belt[5]!, economy)?.id, ring.id)

  const projected = nativeBeltPotionProjection(economy.backpack, 0)
  assert.equal(projected.count, 1)
  assert.equal(projected.item?.nativeSubtype, 0)

  economy = { ...economy, backpack: economy.backpack.filter(({ id }) => id !== sack.id) }
  const refreshed = refreshNativePlayerBelt(belt, skillBook, economy)
  assert.equal(refreshed[2]?.kind, 'health-potion')
  assert.equal(refreshed[5], null)
})

test('Misc and browser-only item classes cannot enter the native belt', () => {
  const skillBook = createPlayerSkillBook(ETHER_ARCANE)
  const base = createHubEconomy(1)
  const misc: HubInventoryItem = {
    equipmentType: null,
    iconRecords: [43],
    id: base.nextItemId,
    kind: 'key',
    name: 'Key',
    nativeSubtype: 1,
    nativeTypeId: 7012,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  const economy = { ...base, backpack: [...base.backpack, misc] }
  assert.throws(
    () => bindNativeBeltItem(createNativePlayerBelt(skillBook), economy, misc.id, 2),
    /cannot bind/,
  )
  assert.equal(nativeInventoryItemCanBindToBelt({
    kind: 'mod-potion',
    nativeSubtype: 0,
    nativeTypeId: 7001,
  }), false)
  assert.equal(nativeInventoryItemCanBindToBelt({
    kind: 'mod-item',
    nativeSubtype: null,
    nativeTypeId: 7009,
  }), false)
})

test('primary selection is independent of a learned weld', () => {
  const initial = createPlayerSkillBook(ETHER_ARCANE)
  const welded = {
    ...withLearnedRank(initial, 52, 1),
    weldBuildId: 1000,
  } satisfies PlayerSkillBookComponent
  const selectedWeld = selectPlayerPrimarySkill(welded, 52)
  assert.equal(selectedWeld.primarySkillId, 52)
  assert.equal(selectedWeld.weldBuildId, 1000)
  const selectedMissile = selectPlayerPrimarySkill(selectedWeld, 8)
  assert.equal(selectedMissile.primarySkillId, 8)
  assert.equal(selectedMissile.weldBuildId, 1000)
})

test('primary interactions validate learned rows independently of quickbar bindings', () => {
  let book = choose(createPlayerSkillBook(ETHER_ARCANE), 16, 1)
  book = selectPlayerPrimarySkill(book, 16)
  assert.equal(book.primarySkillId, 16)
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
  }, createNativeRng(skillId))
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

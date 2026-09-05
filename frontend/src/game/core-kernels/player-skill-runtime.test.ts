import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createEquipmentInventoryItem,
  createHubEconomy,
  DOWSING_EQUIPMENT_RECIPES,
  type HubEconomyState,
} from './hub-economy.ts'
import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
} from './native-rng.ts'
import { createPlayerProgression, createPlayerSkillBook, playerStatBook } from './player-progression.ts'
import {
  BODY_SKILL_IDS,
  CONCENTRATABLE_SKILL_IDS,
  MIND_SKILL_IDS,
  autofillPlayerSkillSelections,
  createPlayerSkillRuntime,
  isPlayerSkillConcentrated,
  markPlayerCreativityInsight,
  playerStaffDamage,
  playerSkillDerivedStats,
  refreshPlayerSkillRuntime,
  setPlayerConcentration,
  setPlayerConcentrationSlot,
  setPlayerMindstarActive,
  stepPlayerSkillRuntime,
} from './player-skill-runtime.ts'

import { resolvePlayerHarmfulContact } from './player-harmful-contact.ts'

const CONFIG = {
  discipline: 'mind',
  displayName: 'Runtime',
  element: 'ether',
} as const

function rankedBook(rows: Readonly<Record<number, number>>) {
  const source = createPlayerSkillBook(CONFIG)
  const permanentRanks = [...source.permanentRanks]
  for (const [id, rank] of Object.entries(rows)) permanentRanks[Number(id)] = rank
  return {
    ...source,
    effectiveRanks: Object.freeze([...permanentRanks]),
    permanentRanks: Object.freeze(permanentRanks),
  }
}

function progression(overrides: Record<string, number> = {}) {
  return { ...createPlayerProgression(1), ...overrides }
}

test('pins the complete passive family and concentration membership', () => {
  assert.deepEqual(MIND_SKILL_IDS, [56, 57, 58, 59, 60, 61, 62, 63])
  assert.deepEqual(BODY_SKILL_IDS, [64, 65, 66, 67, 68, 69, 70, 71])
  assert.deepEqual(CONCENTRATABLE_SKILL_IDS, [
    57, 58, 59, 60, 61, 62, 63,
    65, 66, 67, 68, 69, 70, 71,
  ])
})

test('native refresh auto-fills every first concentration and consumes one gameplay draw', () => {
  const statBook = playerStatBook()
  const economy = createHubEconomy(1)
  for (const skillId of CONCENTRATABLE_SKILL_IDS) {
    const book = rankedBook({ [skillId]: 1 })
    const created = createPlayerSkillRuntime(book, statBook, economy)
    const result = autofillPlayerSkillSelections(
      created.runtime,
      created.skillBook,
      statBook,
      economy,
      createNativeRng(skillId),
    )
    assert.deepEqual([
      result.runtime.concentrationSkillIdA,
      result.runtime.concentrationSkillIdB,
    ], [skillId, null])
    assert.equal(result.rng.indexA, 1)
  }
})

test('native refresh fills Split Mind A then B without duplicating the opposite lane', () => {
  const book = rankedBook({ 57: 1, 58: 1, 59: 1 })
  const statBook = playerStatBook()
  const economy = { ...createHubEconomy(1), ownedPerkSelectors: [21] }
  const created = createPlayerSkillRuntime(book, statBook, economy)
  const rng = createNativeRng(81)
  const firstDraw = drawNativeInteger(rng, 3)
  const expectedA = [57, 58, 59][firstDraw.value]!
  const secondCandidates = [57, 58, 59].filter(skillId => skillId !== expectedA)
  const secondDraw = drawNativeInteger(firstDraw.state, secondCandidates.length)
  const result = autofillPlayerSkillSelections(
    created.runtime,
    created.skillBook,
    statBook,
    economy,
    rng,
  )
  assert.deepEqual([
    result.runtime.concentrationSkillIdA,
    result.runtime.concentrationSkillIdB,
  ], [expectedA, secondCandidates[secondDraw.value]])
  assert.equal(result.rng.indexA, 2)

  const emptyBook = rankedBook({})
  const empty = autofillPlayerSkillSelections(
    created.runtime,
    emptyBook,
    statBook,
    economy,
    rng,
  )
  assert.deepEqual([
    empty.runtime.concentrationSkillIdA,
    empty.runtime.concentrationSkillIdB,
  ], [null, null])
  assert.equal(empty.rng, rng)
})

test('native refresh replaces an invalid selected primary after concentration lanes', () => {
  const sourceBook = rankedBook({ 40: 1 })
  const book = { ...sourceBook, primarySkillId: 16 as const }
  const statBook = playerStatBook()
  const economy = createHubEconomy(1)
  const created = createPlayerSkillRuntime(book, statBook, economy)
  const rng = createNativeRng(93)
  const candidates = [8, 40]
  const draw = drawNativeInteger(rng, candidates.length)
  const result = autofillPlayerSkillSelections(
    created.runtime,
    created.skillBook,
    statBook,
    economy,
    rng,
  )
  assert.equal(result.skillBook.primarySkillId, candidates[draw.value])
  assert.equal(result.rng.indexA, 1)
})

test('Revelation raises one-rank equipment grants in effective state only', () => {
  const book = createPlayerSkillBook(CONFIG)
  const statBook = playerStatBook()
  const base = createHubEconomy(1)
  const recipe = DOWSING_EQUIPMENT_RECIPES.find(({ sourceIndex }) => sourceIndex === 1)
  assert.ok(recipe)
  const equipment = {
    ...base.equipment,
    robe: createEquipmentInventoryItem(recipe, base.nextItemId),
  }
  const neutralEconomy = { ...base, equipment }
  const neutral = createPlayerSkillRuntime(book, statBook, neutralEconomy)
  assert.equal(neutral.skillBook.permanentRanks[27], 0)
  assert.equal(neutral.skillBook.permanentRanks[28], 0)
  assert.equal(neutral.skillBook.effectiveRanks[27], 1)
  assert.equal(neutral.skillBook.effectiveRanks[28], 1)

  const revelationEconomy = { ...neutralEconomy, ownedPerkSelectors: [6] }
  const revelation = createPlayerSkillRuntime(book, statBook, revelationEconomy)
  assert.equal(revelation.skillBook.permanentRanks[27], 0)
  assert.equal(revelation.skillBook.permanentRanks[28], 0)
  assert.equal(revelation.skillBook.effectiveRanks[27], 2)
  assert.equal(revelation.skillBook.effectiveRanks[28], 2)

  const unequipped = createPlayerSkillRuntime(book, statBook, {
    ...revelationEconomy,
    equipment: base.equipment,
  })
  assert.equal(unequipped.skillBook.effectiveRanks[27], 0)
  assert.equal(unequipped.skillBook.effectiveRanks[28], 0)
})

test('unforge bonuses enter the native base stat and offensive consumer lanes', () => {
  const book = createPlayerSkillBook(CONFIG)
  const statBook = playerStatBook()
  const base = createHubEconomy(1)
  const economy: HubEconomyState = {
    ...base,
    unforgeBonuses: {
      experience: 0.1,
      manaCostReduction: 2,
      maximumHealth: 10,
      maximumMana: 20,
      offensiveDamage: 2,
      recipeAttemptCount: 4,
    },
  }
  const created = createPlayerSkillRuntime(book, statBook, economy)
  const derived = playerSkillDerivedStats(
    created.runtime,
    created.skillBook,
    statBook,
    createPlayerProgression(1),
    economy,
  )
  assert.equal(derived.maximumHealth, 60)
  assert.equal(derived.maximumMana, 120)
  assert.equal(derived.offensiveDamageFlat, 2)
  assert.equal(derived.offensiveManaCostReduction, 2)
  assert.equal(derived.experienceBonus, 0.1)

  const charmedEconomy = { ...economy, ownedPerkSelectors: [0, 1] }
  const charmed = createPlayerSkillRuntime(book, statBook, charmedEconomy)
  const charmedDerived = playerSkillDerivedStats(
    charmed.runtime,
    charmed.skillBook,
    statBook,
    createPlayerProgression(1),
    charmedEconomy,
  )
  assert.deepEqual(
    [charmedDerived.maximumHealth, charmedDerived.maximumMana],
    [75, 150],
  )
})

test('all sixteen rows resolve their exact rank and concentration scalars', () => {
  const book = rankedBook({
    56: 1, 57: 1, 58: 1, 59: 1, 60: 1, 61: 1, 62: 1, 63: 1,
    64: 1, 65: 1, 66: 1, 67: 1, 68: 1, 69: 1, 70: 1, 71: 1,
  })
  const statBook = playerStatBook()
  const economy = createHubEconomy(1)
  let created = createPlayerSkillRuntime(book, statBook, economy)
  created = setPlayerConcentration(created.runtime, created.skillBook, statBook, economy, 61)
  const derived = playerSkillDerivedStats(
    created.runtime,
    created.skillBook,
    statBook,
    progression(),
    economy,
  )
  assert.equal(derived.maximumMana, 200)
  assert.equal(derived.maximumHealth, 100)
  assert.equal(derived.manaRecoveryPerTick, 0.125)
  assert.equal(derived.manaRecoveryPerSecond, 12.5)
  assert.equal(derived.meditationIdleDelayTicks, 350)
  assert.equal(derived.meditationRecoveryMultiplier, 4)
  assert.equal(derived.offensiveManaCostFactor, 0.9)
  assert.equal(derived.secondaryRechargeFactor, 2)
  assert.equal(derived.offensiveDamageFactor, 1.35)
  assert.equal(derived.orbPullMultiplier, 1)
  assert.equal(derived.magicResistance, 0.25)
  assert.equal(derived.staffDamagePrimary, 4)
  assert.equal(derived.staffDamageSecondary, 4)
  assert.equal(derived.pickupRangeScalar, 6.25)
  assert.equal(derived.movementFactor, 1.1)
  assert.equal(derived.deflectChancePercent, 10)
  assert.equal(derived.poisonResistance, 0.2)
  assert.equal(derived.castProgressFactor, 1.1)
})

test('mana recovery applies native flat equipment in per-second units', () => {
  const book = rankedBook({})
  const statBook = playerStatBook()
  const economy = createHubEconomy(1)
  const created = createPlayerSkillRuntime(book, statBook, economy)
  const runtime = {
    ...created.runtime,
    equipmentModifiers: {
      ...created.runtime.equipmentModifiers,
      manaRecovery: { offset: 5, scale: 1 },
    },
  }
  const derived = playerSkillDerivedStats(
    runtime,
    created.skillBook,
    statBook,
    progression(),
    economy,
  )
  assert.equal(derived.manaRecoveryPerSecond, 15)
  assert.equal(derived.manaRecoveryPerTick, 0.15)
})

test('Rush, concentration, and the sole authored walk-speed item compose above one', () => {
  const book = rankedBook({ 67: 8 })
  const statBook = playerStatBook()
  const base = createHubEconomy(1)
  const walkRecipe = DOWSING_EQUIPMENT_RECIPES.find(({ sourceIndex }) => sourceIndex === 30)
  assert.ok(walkRecipe)
  const economy = {
    ...base,
    equipment: {
      ...base.equipment,
      amulet: createEquipmentInventoryItem(walkRecipe, base.nextItemId),
    },
  }
  let state = createPlayerSkillRuntime(book, statBook, economy)
  state = setPlayerConcentration(
    state.runtime,
    state.skillBook,
    statBook,
    economy,
    67,
  )
  const derived = playerSkillDerivedStats(
    state.runtime,
    state.skillBook,
    statBook,
    progression(),
    economy,
  )

  assert.equal(derived.movementFactor, 2.8125)
})

test('Life and Mana Charms multiply their final maximum-vital lanes independently', () => {
  const book = rankedBook({ 56: 1, 64: 1 })
  const statBook = playerStatBook()
  const base = createHubEconomy(1)
  const lifeEconomy = { ...base, ownedPerkSelectors: [0] }
  const manaEconomy = { ...base, ownedPerkSelectors: [1] }
  const bothEconomy = { ...base, ownedPerkSelectors: [0, 1] }
  const derive = (economy: HubEconomyState) => {
    const state = createPlayerSkillRuntime(book, statBook, economy)
    return playerSkillDerivedStats(
      state.runtime,
      state.skillBook,
      statBook,
      progression(),
      economy,
    )
  }

  assert.deepEqual(
    [derive(base).maximumHealth, derive(base).maximumMana],
    [100, 200],
  )
  assert.deepEqual(
    [derive(lifeEconomy).maximumHealth, derive(lifeEconomy).maximumMana],
    [125, 200],
  )
  assert.deepEqual(
    [derive(manaEconomy).maximumHealth, derive(manaEconomy).maximumMana],
    [100, 250],
  )
  assert.deepEqual(
    [derive(bothEconomy).maximumHealth, derive(bothEconomy).maximumMana],
    [125, 250],
  )
})

test('Mindstar effective ranks refresh both maximum-vital skills', () => {
  const book = rankedBook({ 56: 1, 64: 1 })
  const statBook = playerStatBook()
  const economy = createHubEconomy(1)
  let state = createPlayerSkillRuntime(book, statBook, economy)
  const derive = () => playerSkillDerivedStats(
    state.runtime,
    state.skillBook,
    statBook,
    progression(),
    economy,
  )

  assert.deepEqual([derive().maximumHealth, derive().maximumMana], [100, 200])
  state = setPlayerMindstarActive(
    state.runtime,
    true,
    state.skillBook,
    statBook,
    economy,
  )
  assert.deepEqual([derive().maximumHealth, derive().maximumMana], [150, 300])
  state = setPlayerMindstarActive(
    state.runtime,
    false,
    state.skillBook,
    statBook,
    economy,
  )
  assert.deepEqual([derive().maximumHealth, derive().maximumMana], [100, 200])
})

test('Mind Chug concentrates every direct branch while Creativity remains slot-A only', () => {
  const book = rankedBook({ 57: 1, 58: 1, 59: 1, 60: 1, 61: 1, 63: 1, 66: 1 })
  const statBook = playerStatBook()
  const economy = createHubEconomy(1)
  const created = createPlayerSkillRuntime(book, statBook, economy)
  const active = progression({ mindChugTicksRemaining: 6_000 })
  const derived = playerSkillDerivedStats(
    created.runtime,
    created.skillBook,
    statBook,
    active,
    economy,
  )
  assert.equal(derived.manaRecoveryPerTick, 0.14375)
  assert.equal(derived.offensiveManaCostFactor, 0.75)
  assert.equal(derived.focusInstantRechargeChancePercent, 25)
  assert.equal(derived.offensiveDamageFactor, 1.35)
  assert.equal(derived.pickupRangeScalar, 12.5)
  assert.equal(derived.meditationConcentrated, true)
  assert.equal(isPlayerSkillConcentrated(created.runtime, active, 63), true)
  assert.equal(created.runtime.concentrationSkillIdA, null)
})

test('Creativity Insight uses fixed slot A, exact RNG order, and one eligible card', () => {
  const book = rankedBook({ 57: 1, 63: 1 })
  const statBook = playerStatBook()
  const economy = createHubEconomy(1)
  let state = createPlayerSkillRuntime(book, statBook, economy)
  state = setPlayerConcentration(state.runtime, state.skillBook, statBook, economy, 63)
  let seed = 0
  while (drawNativeInteger(createNativeRng(seed), 5).value !== 1) seed += 1
  const result = markPlayerCreativityInsight(
    state.runtime,
    {
      level: 12,
      options: [{ skillId: 57, targetRank: 2 }],
      sequence: 4,
    },
    state.skillBook,
    statBook,
    createNativeRng(seed),
  )
  assert.deepEqual(result.offer.options, [{ insight: true, skillId: 57, targetRank: 2 }])
  assert.equal(result.rng.indexA, 2)

  const slotBOnly = markPlayerCreativityInsight(
    { concentrationSkillIdA: null },
    result.offer,
    state.skillBook,
    statBook,
    createNativeRng(seed),
  )
  assert.equal(slotBOnly.rng.indexA, 0)
})

test('Split Mind owns two distinct selections and replacement alternates A then B', () => {
  const book = rankedBook({ 57: 1, 59: 1, 61: 1 })
  const statBook = playerStatBook()
  const baseEconomy = createHubEconomy(1)
  const economy: HubEconomyState = {
    ...baseEconomy,
    ownedPerkSelectors: [21],
  }
  let state = createPlayerSkillRuntime(book, statBook, economy)
  state = setPlayerConcentration(state.runtime, state.skillBook, statBook, economy, 57)
  state = setPlayerConcentration(state.runtime, state.skillBook, statBook, economy, 59)
  assert.deepEqual([
    state.runtime.concentrationSkillIdA,
    state.runtime.concentrationSkillIdB,
    state.runtime.nextConcentrationReplacementSlot,
  ], [57, 59, 'a'])
  state = setPlayerConcentration(state.runtime, state.skillBook, statBook, economy, 61)
  assert.deepEqual([
    state.runtime.concentrationSkillIdA,
    state.runtime.concentrationSkillIdB,
    state.runtime.nextConcentrationReplacementSlot,
  ], [61, 59, 'b'])
  const unchanged = setPlayerConcentration(
    state.runtime,
    state.skillBook,
    statBook,
    economy,
    59,
  )
  assert.equal(unchanged.runtime, state.runtime)
  assert.equal(unchanged.skillBook, state.skillBook)
  assert.equal(unchanged.runtime.nextConcentrationReplacementSlot, 'b')
})

test('HUD concentration selectors replace the addressed A or B slot exactly', () => {
  const book = rankedBook({ 57: 1, 58: 1, 59: 1, 60: 1 })
  const statBook = playerStatBook()
  const baseEconomy = createHubEconomy(1)
  const single = setPlayerConcentrationSlot(
    createPlayerSkillRuntime(book, statBook, baseEconomy).runtime,
    book,
    statBook,
    baseEconomy,
    57,
    0,
  )
  assert.deepEqual([
    single.runtime.concentrationSkillIdA,
    single.runtime.concentrationSkillIdB,
    single.runtime.nextConcentrationReplacementSlot,
  ], [57, null, 'a'])
  const economy: HubEconomyState = {
    ...baseEconomy,
    ownedPerkSelectors: [21],
  }
  let state = createPlayerSkillRuntime(book, statBook, economy)
  state = setPlayerConcentrationSlot(
    state.runtime,
    state.skillBook,
    statBook,
    economy,
    57,
    0,
  )
  state = setPlayerConcentrationSlot(
    state.runtime,
    state.skillBook,
    statBook,
    economy,
    58,
    1,
  )
  state = setPlayerConcentrationSlot(
    state.runtime,
    state.skillBook,
    statBook,
    economy,
    59,
    0,
  )
  assert.deepEqual([
    state.runtime.concentrationSkillIdA,
    state.runtime.concentrationSkillIdB,
    state.runtime.nextConcentrationReplacementSlot,
  ], [59, 58, 'b'])
  state = setPlayerConcentrationSlot(
    state.runtime,
    state.skillBook,
    statBook,
    economy,
    60,
    1,
  )
  assert.deepEqual([
    state.runtime.concentrationSkillIdA,
    state.runtime.concentrationSkillIdB,
    state.runtime.nextConcentrationReplacementSlot,
  ], [59, 60, 'a'])
  assert.throws(() => setPlayerConcentrationSlot(
    state.runtime,
    state.skillBook,
    statBook,
    economy,
    59,
    1,
  ), /other concentration slot/)
  assert.throws(() => setPlayerConcentrationSlot(
    state.runtime,
    state.skillBook,
    statBook,
    baseEconomy,
    58,
    1,
  ), /requires Split Mind/)
})

test('equipment skill effects compose before Mindstar and refresh back to permanent state', () => {
  const book = rankedBook({ 8: 1 })
  const statBook = playerStatBook()
  const base = createHubEconomy(1)
  const generated = {
    equipmentType: 'ring' as const,
    iconRecords: [52],
    id: 100,
    kind: 'equipment' as const,
    name: 'Rank Ring',
    nativeEffects: [
      { kind: 8, magnitude: 2, operator: 0 as const, target: 0 },
      { kind: 15, magnitude: 2, operator: 1 as const, target: 0 },
    ],
    nativeSubtype: null,
    nativeTypeId: 7002,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  const economy = {
    ...base,
    equipment: { ...base.equipment, rings: [generated, null, null] as const },
  }
  let state = createPlayerSkillRuntime(book, statBook, economy)
  assert.equal(state.skillBook.effectiveRanks[8], 3)
  assert.equal(playerSkillDerivedStats(
    state.runtime,
    state.skillBook,
    statBook,
    progression(),
    economy,
  ).orbPullMultiplier, 2)
  state = setPlayerMindstarActive(state.runtime, true, state.skillBook, statBook, economy)
  assert.equal(state.skillBook.effectiveRanks[8], 4)
  state = setPlayerMindstarActive(state.runtime, false, state.skillBook, statBook, economy)
  assert.equal(state.skillBook.effectiveRanks[8], 3)
  state = refreshPlayerSkillRuntime(state.runtime, state.skillBook, statBook, base)
  assert.equal(state.skillBook.effectiveRanks[8], 1)
  assert.equal(playerSkillDerivedStats(
    state.runtime,
    state.skillBook,
    statBook,
    progression(),
    base,
  ).orbPullMultiplier, 1)
})

test('Meditation preserves native idle threshold and concentrated activity ramp', () => {
  const book = rankedBook({ 58: 1 })
  const statBook = playerStatBook()
  const economy = createHubEconomy(1)
  let state = createPlayerSkillRuntime(book, statBook, economy)
  let derived = playerSkillDerivedStats(
    state.runtime,
    state.skillBook,
    statBook,
    progression(),
    economy,
  )
  for (let tick = 0; tick < 349; tick += 1) {
    const stepped = stepPlayerSkillRuntime(state.runtime, derived, { acting: false, moving: false })
    state = { ...state, runtime: stepped.runtime }
    assert.equal(stepped.baseManaRecoveryPerTick, 0.1)
    assert.equal(stepped.meditationManaRecoveryPerTick, 0)
  }
  let stepped = stepPlayerSkillRuntime(state.runtime, derived, { acting: false, moving: false })
  assert.equal(stepped.baseManaRecoveryPerTick, 0.1)
  assert.equal(stepped.meditationManaRecoveryPerTick, 0.4)

  state = setPlayerConcentration(stepped.runtime, state.skillBook, statBook, economy, 58)
  derived = playerSkillDerivedStats(
    state.runtime,
    state.skillBook,
    statBook,
    progression(),
    economy,
  )
  stepped = stepPlayerSkillRuntime(state.runtime, derived, { acting: true, moving: true })
  assert.equal(stepped.baseManaRecoveryPerTick, 0.1)
  assert.ok(Math.abs(stepped.meditationManaRecoveryPerTick - 0.175) < 1e-12)
})

test('Hurricane and Harden use player-owned channel clocks and weak Water clears only Harden', () => {
  const book = rankedBook({ 29: 1, 36: 1 })
  const statBook = playerStatBook()
  const economy = createHubEconomy(1)
  let state = createPlayerSkillRuntime(book, statBook, economy)
  assert.equal(state.runtime.hardenArmorMaximum, 25)
  assert.equal(state.runtime.hardenArmorPerTick, 0.08)
  assert.equal(state.runtime.hurricaneEnabled, true)
  const derived = playerSkillDerivedStats(
    state.runtime,
    state.skillBook,
    statBook,
    progression(),
    economy,
  )

  state = {
    ...state,
    runtime: stepPlayerSkillRuntime(state.runtime, derived, {
      acting: true,
      moving: false,
      primaryChannel: 'air',
      primaryUnderpowered: false,
    }).runtime,
  }
  assert.equal(state.runtime.hurricaneCharge, Math.fround(0.0015))
  assert.equal(state.runtime.hurricaneRefreshed, true)
  state = {
    ...state,
    runtime: stepPlayerSkillRuntime(state.runtime, derived, {
      acting: true,
      moving: false,
      primaryChannel: 'water',
      primaryUnderpowered: false,
    }).runtime,
  }
  assert.equal(state.runtime.hurricaneCharge, Math.fround(0.0015))
  assert.equal(state.runtime.hurricaneRefreshed, false)
  assert.equal(state.runtime.harden.armor, Math.fround(0.08))
  const reduced = resolvePlayerHarmfulContact(
    state.runtime,
    derived,
    progression(),
    { physicalDamage: 1, magicDamage: 0 },
    false,
    createNativeRng(1),
    { x: 0, y: 0 },
  )
  assert.equal(reduced.physicalDamage, Math.fround(1 - Math.fround(0.08)))

  state = {
    ...state,
    runtime: stepPlayerSkillRuntime(state.runtime, derived, {
      acting: true,
      moving: false,
      primaryChannel: 'water',
      primaryUnderpowered: false,
    }).runtime,
  }
  assert.equal(state.runtime.hurricaneCharge, 0)

  state = {
    ...state,
    runtime: stepPlayerSkillRuntime(state.runtime, derived, {
      acting: true,
      moving: false,
      primaryChannel: 'water',
      primaryUnderpowered: true,
    }).runtime,
  }
  assert.equal(state.runtime.harden.armor, 0)
})

test('Harden removes its armor when the held Frost Jet action is released', () => {
  const statBook = playerStatBook()
  const economy = createHubEconomy(1)
  const state = createPlayerSkillRuntime(rankedBook({ 36: 2 }), statBook, economy)
  const derived = playerSkillDerivedStats(
    state.runtime, state.skillBook, statBook, progression(), economy,
  )
  let runtime = state.runtime
  for (let tick = 0; tick < 100; tick += 1) {
    runtime = stepPlayerSkillRuntime(runtime, derived, {
      acting: true,
      moving: false,
      primaryChannel: 'water',
      primaryUnderpowered: false,
    }).runtime
  }
  assert.ok(runtime.harden.armor > 11.9)
  runtime = stepPlayerSkillRuntime(runtime, derived, {
    acting: false,
    moving: false,
    primaryChannel: null,
    primaryUnderpowered: false,
  }).runtime
  assert.equal(runtime.harden.armor, 0, 'native release clears Harden armor with the ice coating')
})


test('staff admission comes only from the exact native Staff type', () => {
  const book = rankedBook({ 65: 1, 68: 1 })
  const statBook = playerStatBook()
  const staffEconomy = createHubEconomy(1)
  const created = createPlayerSkillRuntime(book, statBook, staffEconomy)
  assert.equal(playerSkillDerivedStats(
    created.runtime,
    created.skillBook,
    statBook,
    progression(),
    staffEconomy,
  ).staffEquipped, true)
  const wandEconomy = {
    ...staffEconomy,
    equipment: {
      ...staffEconomy.equipment,
      weapon: {
        ...staffEconomy.equipment.weapon!,
        equipmentType: 'wand' as const,
        nativeTypeId: 7011,
      },
    },
  }
  const wand = refreshPlayerSkillRuntime(
    created.runtime,
    created.skillBook,
    statBook,
    wandEconomy,
  )
  const wandDerived = playerSkillDerivedStats(
    wand.runtime,
    wand.skillBook,
    statBook,
    progression(),
    wandEconomy,
  )
  assert.equal(wandDerived.staffEquipped, false)
  assert.equal(wandDerived.deflectChancePercent, 0)
})

test('Staff contact resolves row 65 at marker time and composes only proc multipliers', () => {
  const book = rankedBook({ 65: 1, 71: 1 })
  const statBook = playerStatBook()
  const economy = createHubEconomy(1)
  let state = createPlayerSkillRuntime(book, statBook, economy)
  let derived = playerSkillDerivedStats(
    state.runtime,
    state.skillBook,
    statBook,
    progression(),
    economy,
  )
  assert.equal(playerStaffDamage(state.runtime, derived, progression(), 'normal'), 4)
  assert.equal(playerStaffDamage(state.runtime, derived, progression(), 'critical-hit'), 12)

  state = setPlayerConcentration(state.runtime, state.skillBook, statBook, economy, 71)
  derived = playerSkillDerivedStats(
    state.runtime,
    state.skillBook,
    statBook,
    progression(),
    economy,
  )
  assert.equal(playerStaffDamage(state.runtime, derived, progression(), 'normal'), 4)
  assert.ok(Math.abs(
    playerStaffDamage(state.runtime, derived, progression(), 'critical-hit') - 14.4,
  ) < 1e-12)
})

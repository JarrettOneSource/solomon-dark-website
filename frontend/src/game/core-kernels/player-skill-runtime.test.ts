import assert from 'node:assert/strict'
import test from 'node:test'

import { createHubEconomy, type HubEconomyState } from './hub-economy.ts'
import { createNativeRng, drawNativeInteger } from './native-rng.ts'
import { createPlayerProgression, createPlayerSkillBook, playerStatBook } from './player-progression.ts'
import {
  BODY_SKILL_IDS,
  CONCENTRATABLE_SKILL_IDS,
  MIND_SKILL_IDS,
  createPlayerSkillRuntime,
  isPlayerSkillConcentrated,
  markPlayerCreativityInsight,
  playerStaffDamage,
  playerSkillDerivedStats,
  refreshPlayerSkillRuntime,
  setPlayerConcentration,
  setPlayerMindstarActive,
  stepPlayerSkillRuntime,
} from './player-skill-runtime.ts'

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
  assert.equal(derived.meditationIdleDelayTicks, 350)
  assert.equal(derived.meditationRecoveryMultiplier, 4)
  assert.equal(derived.offensiveManaCostFactor, 0.9)
  assert.equal(derived.secondaryRechargeFactor, 2)
  assert.equal(derived.offensiveDamageFactor, 1.35)
  assert.equal(derived.magicResistance, 0.25)
  assert.equal(derived.staffDamagePrimary, 4)
  assert.equal(derived.staffDamageSecondary, 4)
  assert.equal(derived.pickupRangeScalar, 6.25)
  assert.equal(derived.movementFactor, 1.1)
  assert.equal(derived.deflectChancePercent, 10)
  assert.equal(derived.poisonResistance, 0.2)
  assert.equal(derived.castProgressFactor, 1.1)
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
  assert.throws(() => setPlayerConcentration(
    state.runtime,
    state.skillBook,
    statBook,
    economy,
    59,
  ), /already concentrated/)
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
    nativeEffects: [{ kind: 8, magnitude: 2, operator: 0 as const, target: 0 }],
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
  state = setPlayerMindstarActive(state.runtime, true, state.skillBook, statBook, economy)
  assert.equal(state.skillBook.effectiveRanks[8], 4)
  state = setPlayerMindstarActive(state.runtime, false, state.skillBook, statBook, economy)
  assert.equal(state.skillBook.effectiveRanks[8], 3)
  state = refreshPlayerSkillRuntime(state.runtime, state.skillBook, statBook, base)
  assert.equal(state.skillBook.effectiveRanks[8], 1)
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
    assert.equal(stepped.manaRecoveryPerTick, 0.1)
  }
  let stepped = stepPlayerSkillRuntime(state.runtime, derived, { acting: false, moving: false })
  assert.equal(stepped.manaRecoveryPerTick, 0.4)

  state = setPlayerConcentration(stepped.runtime, state.skillBook, statBook, economy, 58)
  derived = playerSkillDerivedStats(
    state.runtime,
    state.skillBook,
    statBook,
    progression(),
    economy,
  )
  stepped = stepPlayerSkillRuntime(state.runtime, derived, { acting: true, moving: true })
  assert.ok(Math.abs(stepped.manaRecoveryPerTick - 0.175) < 1e-12)
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

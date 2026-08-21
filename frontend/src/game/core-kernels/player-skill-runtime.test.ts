import assert from 'node:assert/strict'
import test from 'node:test'

import { createHubEconomy, type HubEconomyState } from './hub-economy.ts'
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
  applyPlayerHardenArmor,
  createPlayerSkillRuntime,
  isPlayerSkillConcentrated,
  markPlayerCreativityInsight,
  playerStaffDamage,
  playerSkillDerivedStats,
  refreshPlayerSkillRuntime,
  resolvePlayerHarmfulContact,
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
  assert.equal(state.runtime.hardenArmor, Math.fround(0.08))
  const reduced = applyPlayerHardenArmor(state.runtime, 1)
  assert.equal(reduced.damage, 1 - Math.fround(0.08))
  assert.equal(reduced.runtime, state.runtime, 'Harden is persistent flat armor, not a consumed pool')

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
  assert.equal(state.runtime.hardenArmor, 0)
})

test('Flash consumes its complete response RNG before Deflect and rejects percentile zero', () => {
  const book = rankedBook({ 53: 1, 68: 1 })
  const statBook = playerStatBook()
  const economy = createHubEconomy(1)
  const created = createPlayerSkillRuntime(book, statBook, economy)
  const derived = playerSkillDerivedStats(
    created.runtime,
    created.skillBook,
    statBook,
    progression(),
    economy,
  )
  assert.equal(derived.flashChancePercent, 10)
  assert.equal(derived.flashDurationTicks, 400)

  let rng = createNativeRng(15)
  const chance = drawNativeInteger(rng, 100); rng = chance.state
  assert.equal(chance.value, 9)
  const responsePitch = drawNativeFloat(rng, Math.fround(0.2)); rng = responsePitch.state
  const heading = drawNativeInteger(rng, 100_001); rng = heading.state
  const growScales: number[] = []
  for (let index = 0; index < 8; index += 1) {
    const scale = drawNativeFloat(rng, 1); rng = scale.state
    growScales.push(Math.fround(2 - scale.value))
  }
  const deflect = drawNativeInteger(rng, 100); rng = deflect.state
  assert.equal(deflect.value, 0)
  const swipe = drawNativeFloat(rng, 1, true); rng = swipe.state
  const result = resolvePlayerHarmfulContact(
    created.runtime,
    derived,
    progression(),
    2,
    'physical',
    true,
    true,
    createNativeRng(15),
  )
  assert.equal(result.deflected, true)
  assert.equal(result.reflectedDamage, 0)
  assert.deepEqual(result.rng, rng)
  assert.deepEqual(result.flash?.growScales, growScales)
  assert.equal(result.flash?.durationTicks, 400)
  assert.equal(result.flash?.pitch, Math.fround(1 + responsePitch.value))
  const degrees = Math.fround(Math.fround(heading.value / 100_000) * 360)
  assert.deepEqual(result.flash?.cameraDisplacement, {
    x: Math.fround(Math.sin(degrees * Math.PI / 180) * 3),
    y: Math.fround(-Math.cos(degrees * Math.PI / 180) * 3),
  })

  const zero = resolvePlayerHarmfulContact(
    created.runtime,
    derived,
    progression(),
    2,
    'physical',
    false,
    false,
    createNativeRng(121),
  )
  assert.equal(zero.flash, null)
  assert.equal(zero.rng.indexA, 1)
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

import assert from 'node:assert/strict'
import test from 'node:test'

import './native-secondary-ability-contract.test.ts'
import './native-secondary-abilities.test.ts'
import '../skill-book.test.ts'
import './skill-quickbar.test.ts'
import './native-primary-skill-profile.test.ts'

import {
  MAX_PLAYER_EXPERIENCE,
  MAX_PLAYER_LEVEL,
  NATIVE_ANTIDOTE_IMMUNITY_TICKS,
  NATIVE_DAMAGE_X4_POTION_TICKS,
  NATIVE_LEVEL_THRESHOLDS,
  NATIVE_SKILL_CATALOG,
  NATIVE_SKILL_ROW_COUNT,
  NATIVE_MIND_CHUG_TICKS,
  NATIVE_WELD_BUILDS,
  SPELL_WELDING_SKILL_ID,
  applyPlayerSkillChoice,
  applyPlayerPotionEffect,
  boneyardEnemyExperienceAward,
  buildPlayerSkillOffer,
  createPlayerProgression,
  createPlayerSkillBook,
  deferPlayerSkillChoice,
  effectivePrimarySkillRankStats,
  evaluateBoneyardEnemyExperience,
  grantPlayerExperience,
  grantPlayerBonusSkillChoice,
  increaseRandomLearnedSkill,
  nativeSkillCategory,
  playerExperienceProgress,
  nativeWeldBuild,
  playerStatBook,
  rerollPlayerSkillOffer,
  resetPlayerPotionEffects,
  stepPlayerPotionEffects,
  type PlayerProgressionComponent,
  type PlayerSkillBookComponent,
} from './player-progression.ts'
import {
  damagePlayer,
  playerCanAcceptInput,
  playerCanCast,
  playerDeathFrameAtTick,
  playerDisplayHealth,
  poisonPlayer,
  resetPlayerCombatForNewRun,
  setPlayerSpectating,
  stepPlayerCombatTick,
  tryDebitPlayerMana,
} from './player-combat.ts'
import { createNativeRng, drawNativeInteger } from './native-rng.ts'

const ETHER_ARCANE = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

test('all six native potion subtypes mutate and expire their authoritative progression fields', () => {
  const damaged = {
    ...createPlayerProgression(1),
    currentHealth: 7,
    currentMana: 9,
    poisonDamagePerTick: 0.5,
    poisonTicksRemaining: 700,
  }
  assert.equal(applyPlayerPotionEffect(damaged, 0).currentHealth, damaged.maximumHealth)
  assert.equal(applyPlayerPotionEffect(damaged, 1).currentMana, damaged.maximumMana)
  assert.equal(
    applyPlayerPotionEffect(damaged, 2).damageX4TicksRemaining,
    NATIVE_DAMAGE_X4_POTION_TICKS,
  )
  const antidote = applyPlayerPotionEffect(damaged, 3)
  assert.equal(antidote.poisonDamagePerTick, 0)
  assert.equal(antidote.poisonTicksRemaining, 0)
  assert.equal(antidote.poisonImmunityTicksRemaining, NATIVE_ANTIDOTE_IMMUNITY_TICKS)
  assert.equal(
    applyPlayerPotionEffect(damaged, 4).mindChugTicksRemaining,
    NATIVE_MIND_CHUG_TICKS,
  )
  const rejuvenated = applyPlayerPotionEffect(damaged, 5)
  assert.equal(rejuvenated.currentHealth, damaged.maximumHealth)
  assert.equal(rejuvenated.currentMana, damaged.maximumMana)

  const armed = applyPlayerPotionEffect(
    applyPlayerPotionEffect(
      applyPlayerPotionEffect(damaged, 2),
      3,
    ),
    4,
  )
  const stepped = stepPlayerPotionEffects(armed)
  assert.equal(stepped.damageX4TicksRemaining, NATIVE_DAMAGE_X4_POTION_TICKS - 1)
  assert.equal(stepped.mindChugTicksRemaining, NATIVE_MIND_CHUG_TICKS - 1)
  assert.equal(stepped.poisonImmunityTicksRemaining, NATIVE_ANTIDOTE_IMMUNITY_TICKS - 1)
  assert.deepEqual(resetPlayerPotionEffects(stepped), {
    ...stepped,
    damageX4TicksRemaining: 0,
    mindChugTicksRemaining: 0,
    poisonImmunityTicksRemaining: 0,
  })
  assert.throws(() => applyPlayerPotionEffect(damaged, 6), /within \[0, 5\]/)
})

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
  assert.equal(first.weldBuildId, null)
  assert.equal(first.primarySkillId, 8)
  assert.deepEqual(first.skillQuickbar, [11, null, null, null, null, null, null, null])
  const progression = createPlayerProgression(0)
  assert.equal(progression.offerCycle, 0)
  assert.equal(progression.weldOfferMarker, 9_999)
  assert.deepEqual(progression.forcedOfferSkillIds, [])
  assert.equal(progression.deathEpoch, 0)
  assert.equal(progression.deathTick, 0)
  assert.equal(progression.lifeState, 'alive')
})

test('player damage preserves internal overkill and arms terminal dispatch only at -10 HP', () => {
  let progression = createPlayerProgression(0)
  progression = damagePlayer(progression, 55, 0)
  assert.equal(progression.currentHealth, -5)
  assert.equal(playerDisplayHealth(progression), 0)
  assert.equal(progression.lifeState, 'alive')

  progression = damagePlayer(progression, 5, 0)
  assert.equal(progression.currentHealth, -10)
  assert.equal(progression.lifeState, 'lethal-pending')
  assert.equal(progression.deathEpoch, 0)

  progression = damagePlayer(progression, 7, 0)
  assert.equal(progression.currentHealth, -17)
  const transition = stepPlayerCombatTick(progression)
  assert.equal(transition.combat.lifeState, 'dying')
  assert.equal(transition.combat.deathEpoch, 1)
  assert.equal(transition.combat.deathTick, 0)
  assert.equal(transition.beganDeathEpoch, true)
  assert.equal(transition.emittedDeathBurst, false)
})

test('the fixed combat tick recovers exact native HP and MP amounts and caps both resources', () => {
  const first = stepPlayerCombatTick({
    ...createPlayerProgression(0),
    currentHealth: 49.9995,
    currentMana: 99.95,
  })
  assert.equal(first.combat.currentHealth, 50)
  assert.equal(first.combat.currentMana, 100)

  const second = stepPlayerCombatTick({
    ...createPlayerProgression(0),
    currentHealth: 40,
    currentMana: 80,
  })
  assert.ok(Math.abs(second.combat.currentHealth - 40.001) < 1e-12)
  assert.ok(Math.abs(second.combat.currentMana - 80.1) < 1e-12)
})

test('authoritative poison applies DPS for its bounded duration and can arm lethal state', () => {
  let progression = poisonPlayer(createPlayerProgression(0), 10, 2)
  assert.equal(progression.poisonDamagePerTick, 0.1)
  assert.equal(progression.poisonTicksRemaining, 200)
  for (let tick = 0; tick < 200; tick += 1) {
    progression = stepPlayerCombatTick(progression).combat
  }
  assert.ok(Math.abs(progression.currentHealth - 30.2) < 1e-9)
  assert.equal(progression.poisonDamagePerTick, 0)
  assert.equal(progression.poisonTicksRemaining, 0)

  progression = poisonPlayer(progression, 1_000, 1)
  while (progression.lifeState === 'alive') {
    progression = stepPlayerCombatTick(progression).combat
  }
  assert.equal(progression.lifeState, 'lethal-pending')
  const dying = stepPlayerCombatTick(progression).combat
  assert.equal(dying.lifeState, 'dying')
  assert.equal(dying.poisonDamagePerTick, 0)
  assert.equal(dying.poisonTicksRemaining, 0)
})

test('mana debit is atomic, affordability checked, and unavailable outside alive play', () => {
  const initial = createPlayerProgression(0)
  const paid = tryDebitPlayerMana(initial, 6)
  assert.equal(paid.accepted, true)
  assert.equal(paid.combat.currentMana, 94)

  const unaffordable = tryDebitPlayerMana(paid.combat, 95)
  assert.equal(unaffordable.accepted, false)
  assert.equal(unaffordable.combat, paid.combat)

  const pending = damagePlayer(paid.combat, 60, 0)
  const deadDebit = tryDebitPlayerMana(pending, 1)
  assert.equal(deadDebit.accepted, false)
  assert.equal(deadDebit.combat, pending)
  assert.throws(() => tryDebitPlayerMana(initial, -1), RangeError)
})

test('death ticks own the recovered corpse frame boundaries and the tick-159 burst edge', () => {
  assert.equal(playerDeathFrameAtTick(0), 0)
  assert.equal(playerDeathFrameAtTick(149), 0)
  assert.equal(playerDeathFrameAtTick(150), 0)
  assert.equal(playerDeathFrameAtTick(152), 0)
  assert.equal(playerDeathFrameAtTick(153), 1)
  assert.equal(playerDeathFrameAtTick(155), 1)
  assert.equal(playerDeathFrameAtTick(156), 2)
  assert.equal(playerDeathFrameAtTick(158), 2)
  assert.equal(playerDeathFrameAtTick(159), 3)
  assert.equal(playerDeathFrameAtTick(500), 3)

  const beforeBurst = {
    ...createPlayerProgression(0),
    currentHealth: -10,
    deathAgeTicks: 264,
    deathEpoch: 1,
    deathTick: 158,
    lifeState: 'dying' as const,
  }
  const burst = stepPlayerCombatTick(beforeBurst)
  assert.equal(burst.combat.deathTick, 159)
  assert.equal(burst.emittedDeathBurst, true)
  assert.equal(stepPlayerCombatTick(burst.combat).emittedDeathBurst, false)
})

test('input and casts stop at lethal pending and remain stopped while dying or spectating', () => {
  const alive = createPlayerProgression(0)
  assert.equal(playerCanAcceptInput(alive), true)
  assert.equal(playerCanCast(alive), true)

  const pending = damagePlayer(alive, 60, 0)
  assert.equal(playerCanAcceptInput(pending), false)
  assert.equal(playerCanCast(pending), false)

  const dying = stepPlayerCombatTick(pending).combat
  const spectating = setPlayerSpectating(dying)
  assert.equal(spectating.lifeState, 'spectating')
  assert.equal(playerCanAcceptInput(spectating), false)
  assert.equal(playerCanCast(spectating), false)
})

test('level-up refill survives combat state and new-run reset retains progression', () => {
  const skillBook = createPlayerSkillBook(ETHER_ARCANE)
  const wounded = {
    ...createPlayerProgression(12),
    currentHealth: 4,
    currentMana: 3,
  }
  const leveled = grantPlayerExperience(wounded, skillBook, 100)
  assert.equal(leveled.currentHealth, leveled.maximumHealth)
  assert.equal(leveled.currentMana, leveled.maximumMana)

  const dying = stepPlayerCombatTick(damagePlayer(leveled, 75, 0)).combat
  const reset = resetPlayerCombatForNewRun(setPlayerSpectating(dying))
  assert.equal(reset.currentHealth, reset.maximumHealth)
  assert.equal(reset.currentMana, reset.maximumMana)
  assert.equal(reset.lifeState, 'alive')
  assert.equal(reset.deathEpoch, 0)
  assert.equal(reset.deathTick, 0)
  assert.equal(reset.level, leveled.level)
  assert.equal(reset.experience, leveled.experience)
  assert.equal(reset.pendingOffer, leveled.pendingOffer)
  assert.equal(reset.offerSeed, leveled.offerSeed)
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

test('effective primary rank indexes the native mana and damage catalog', () => {
  const expected = {
    air: {
      rankOne: { damageMaximum: 2.5, damageMinimum: 2.5, manaCost: 12 },
      rankTwo: { damageMaximum: 4, damageMinimum: 4, manaCost: 14 },
    },
    earth: {
      rankOne: { damageMaximum: 10, damageMinimum: 10, manaCost: 12 },
      rankTwo: { damageMaximum: 30, damageMinimum: 30, manaCost: 13 },
    },
    ether: {
      rankOne: { damageMaximum: 2, damageMinimum: 1, manaCost: 6 },
      rankTwo: { damageMaximum: 4, damageMinimum: 2, manaCost: 9 },
    },
    fire: {
      rankOne: { damageMaximum: 4, damageMinimum: 4, manaCost: 12 },
      rankTwo: { damageMaximum: 7, damageMinimum: 7, manaCost: 15 },
    },
    water: {
      rankOne: { damageMaximum: 2.5, damageMinimum: 2.5, manaCost: 12.5 },
      rankTwo: { damageMaximum: 3.5, damageMinimum: 3.5, manaCost: 17.5 },
    },
  } as const

  for (const [element, values] of Object.entries(expected)) {
    const rankOneBook = createPlayerSkillBook({
      ...ETHER_ARCANE,
      element: element as keyof typeof expected,
    })
    assert.deepEqual(effectivePrimarySkillRankStats(rankOneBook), {
      ...values.rankOne,
      rank: 1,
      skillId: rankOneBook.primarySkillId,
    })

    const effectiveRanks = [...rankOneBook.effectiveRanks]
    effectiveRanks[rankOneBook.primarySkillId] = 2
    const rankTwoBook = {
      ...rankOneBook,
      effectiveRanks: Object.freeze(effectiveRanks),
    }
    assert.equal(rankTwoBook.permanentRanks[rankTwoBook.primarySkillId], 1)
    assert.deepEqual(effectivePrimarySkillRankStats(rankTwoBook), {
      ...values.rankTwo,
      rank: 2,
      skillId: rankTwoBook.primarySkillId,
    })
  }
})

test('native XP thresholds queue a mandatory deterministic offer and selection only books rank', () => {
  const skillBook = createPlayerSkillBook(ETHER_ARCANE)
  assert.deepEqual(skillBook.learnedSkillOrder, [8, 11])
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

test('queued and saved choices use the final current level while Sorceror actions remain one-use', () => {
  const skillBook = createPlayerSkillBook(ETHER_ARCANE)
  const crossed = grantPlayerExperience(
    createPlayerProgression(41),
    skillBook,
    300,
    true,
  )
  assert.equal(crossed.level, 4)
  assert.deepEqual(crossed.pendingLevels, [4, 4, 4])
  assert.equal(crossed.pendingOffer?.level, 4)
  assert.equal(crossed.sorcerorsCharmAvailable, true)

  const firstOffer = crossed.pendingOffer!
  const rerolled = rerollPlayerSkillOffer(crossed, skillBook, firstOffer.sequence, 79225)
  assert.ok(rerolled)
  assert.equal(rerolled.offerSeed, 79225)
  assert.equal(rerolled.pendingLevels.length, 3)
  assert.equal(rerolled.pendingOffer?.level, 4)
  assert.notEqual(rerolled.pendingOffer?.sequence, firstOffer.sequence)
  assert.equal(rerolled.sorcerorsCharmAvailable, false)
  assert.equal(
    rerollPlayerSkillOffer(rerolled, skillBook, rerolled.pendingOffer!.sequence, 7),
    null,
  )

  const saved = deferPlayerSkillChoice(crossed, skillBook, firstOffer.sequence, true)
  assert.ok(saved)
  assert.equal(saved.deferredSkillChoices, 1)
  assert.deepEqual(saved.pendingLevels, [4, 4])
  assert.equal(saved.pendingOffer?.level, 4)
  assert.equal(saved.sorcerorsCharmAvailable, true)

  const single = grantPlayerExperience(createPlayerProgression(41), skillBook, 100, true)
  const deferred = deferPlayerSkillChoice(
    single,
    skillBook,
    single.pendingOffer!.sequence,
    true,
  )
  assert.ok(deferred)
  assert.equal(deferred.pendingOffer, null)
  assert.deepEqual(deferred.pendingLevels, [])
  assert.equal(deferred.deferredSkillChoices, 1)

  const reopened = grantPlayerExperience(deferred, skillBook, 61, true)
  assert.equal(reopened.level, 3)
  assert.deepEqual(reopened.pendingLevels, [3, 3])
  assert.equal(reopened.deferredSkillChoices, 0)
  assert.equal(reopened.pendingOffer?.level, 3)
  assert.equal(reopened.sorcerorsCharmAvailable, true)

  const ordinary = grantPlayerExperience(createPlayerProgression(41), skillBook, 100)
  assert.equal(ordinary.sorcerorsCharmAvailable, false)
  assert.equal(
    rerollPlayerSkillOffer(ordinary, skillBook, ordinary.pendingOffer!.sequence, 7),
    null,
  )
  assert.equal(
    deferPlayerSkillChoice(ordinary, skillBook, ordinary.pendingOffer!.sequence, false),
    null,
  )
})

test('Boneyard enemy XP preserves native fractional awards and strict threshold edges', () => {
  assert.equal(evaluateBoneyardEnemyExperience(10), 4.25)
  assert.equal(evaluateBoneyardEnemyExperience(2), 0.85)
  assert.equal(evaluateBoneyardEnemyExperience(4), 1.7)
  assert.equal(boneyardEnemyExperienceAward({
    arenaPlayerCount: 1,
    evaluatedActorReward: 4.25,
    receiverLevel: 1,
  }), 4.25)
  assert.equal(boneyardEnemyExperienceAward({
    arenaPlayerCount: 2,
    evaluatedActorReward: 4.25,
    receiverLevel: 6,
    receiverXpBonus: 0.25,
  }), 7.65)

  const book = createPlayerSkillBook(ETHER_ARCANE)
  const atThreshold = grantPlayerExperience(createPlayerProgression(12), book, 90)
  assert.equal(atThreshold.experience, 90)
  assert.equal(atThreshold.level, 1)
  const fractionalCrossing = grantPlayerExperience(atThreshold, book, 0.85)
  assert.equal(fractionalCrossing.experience, 90.85)
  assert.equal(fractionalCrossing.level, 2)
  assert.ok(fractionalCrossing.pendingOffer)
  assert.equal(playerExperienceProgress(createPlayerProgression(12)), 0)
  assert.equal(playerExperienceProgress({
    experience: 4.25,
    nextThreshold: 90,
    previousThreshold: 0,
  }), 4.25 / 90)
  assert.ok(Math.abs(playerExperienceProgress(fractionalCrossing) - 0.85 / 70) < 1e-15)
  assert.throws(() => grantPlayerExperience(atThreshold, book, Number.NaN), /finite/)
})

test('every offered row applies only its addressed player-book entry', () => {
  for (let skillId = 8; skillId <= 79; skillId += 1) {
    let skillBook = createPlayerSkillBook(ETHER_ARCANE)
    if (skillId === SPELL_WELDING_SKILL_ID) {
      skillBook = withLearnedSkills(skillBook, [16])
    }
    const beforeRanks = [...skillBook.permanentRanks]
    const option = skillId === SPELL_WELDING_SKILL_ID
      ? { skillId, targetRank: 1, weldBuildId: 1000 }
      : { skillId, targetRank: (beforeRanks[skillId] ?? 0) + 1 }
    const progression: PlayerProgressionComponent = {
      ...createPlayerProgression(skillId),
      currentHealth: 37,
      currentMana: 61,
      pendingLevels: Object.freeze([2]),
      pendingOffer: Object.freeze({
        level: 2,
        options: Object.freeze([
          Object.freeze(option),
          Object.freeze({ skillId: 48, targetRank: 1 }),
          Object.freeze({ skillId: 56, targetRank: 1 }),
        ]),
        sequence: skillId + 1,
      }),
    }
    const applied = applyPlayerSkillChoice(progression, skillBook, {
      choiceIndex: 0,
      offerSequence: skillId + 1,
      skillId,
    })
    assert.ok(applied, `skill ${skillId} did not book`)
    assert.equal(applied.progression.currentHealth, 37)
    assert.equal(applied.progression.currentMana, 61)
    assert.equal(applied.skillBook.elementRoot, skillBook.elementRoot)
    assert.equal(applied.skillBook.disciplineRoot, skillBook.disciplineRoot)
    assert.equal(
      applied.skillBook.primarySkillId,
      skillId === SPELL_WELDING_SKILL_ID ? SPELL_WELDING_SKILL_ID : skillBook.primarySkillId,
    )
    if (
      (nativeSkillCategory(skillId) !== 1 && nativeSkillCategory(skillId) !== 2)
      || beforeRanks[skillId]! > 0
    ) {
      assert.equal(applied.skillBook.skillQuickbar, skillBook.skillQuickbar)
    }
    assert.equal(applied.skillBook.advancedUnlocks, skillBook.advancedUnlocks)
    assert.equal(
      applied.skillBook.permanentRanks.filter((rank, id) => rank !== beforeRanks[id]).length,
      1,
    )
    assert.equal(
      applied.skillBook.permanentRanks[skillId],
      skillId === SPELL_WELDING_SKILL_ID ? 1 : (beforeRanks[skillId] ?? 0) + 1,
    )
    assert.equal(
      applied.skillBook.weldBuildId,
      skillId === SPELL_WELDING_SKILL_ID ? 1000 : skillBook.weldBuildId,
    )
    assert.equal(NATIVE_SKILL_CATALOG[skillId]?.id, skillId)
  }
})

test('Creativity Insight applies the selected skill twice without duplicating loadout identity', () => {
  const skillBook = withLearnedSkills(createPlayerSkillBook(ETHER_ARCANE), [57])
  const progression: PlayerProgressionComponent = {
    ...createPlayerProgression(1),
    pendingLevels: Object.freeze([12]),
    pendingOffer: Object.freeze({
      level: 12,
      options: Object.freeze([
        Object.freeze({ insight: true as const, skillId: 57, targetRank: 2 }),
        Object.freeze({ skillId: 48, targetRank: 1 }),
        Object.freeze({ skillId: 56, targetRank: 1 }),
      ]),
      sequence: 3,
    }),
  }
  const applied = applyPlayerSkillChoice(progression, skillBook, {
    choiceIndex: 0,
    offerSequence: 3,
    skillId: 57,
  })
  assert.ok(applied)
  assert.equal(applied.skillBook.permanentRanks[57], 3)
  assert.equal(applied.skillBook.skillQuickbar, skillBook.skillQuickbar)
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

  const cappedRanks = fresh.permanentRanks.map((rank, skillId) => {
    const maximum = playerStatBook().entries[skillId]?.maximumLevel ?? 0
    return skillId === 8 ? rank : maximum
  })
  const onlyCategoryOne = {
    ...fresh,
    effectiveRanks: Object.freeze([...cappedRanks]),
    permanentRanks: Object.freeze([...cappedRanks]),
  }
  const duplicateEscape = buildPlayerSkillOffer(offerProgression(7, 75, {
    forcedOfferSkillIds: Object.freeze([8]),
  }), onlyCategoryOne, 1)
  assert.deepEqual(duplicateEscape.options, [
    { skillId: 8, targetRank: 2 },
    { skillId: 8, targetRank: 2 },
    { skillId: 8, targetRank: 2 },
    { skillId: 8, targetRank: 2 },
  ])
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
  assert.deepEqual(primaryApplied.skillBook.learnedSkillOrder, [8, 11, 16])

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
  assert.equal(welded.skillBook.weldBuildId, 1000)
  assert.equal(welded.skillBook.primarySkillId, SPELL_WELDING_SKILL_ID)
  assert.equal(welded.skillBook.skillQuickbar[2], SPELL_WELDING_SKILL_ID)
  assert.deepEqual(welded.skillBook.learnedSkillOrder, [8, 11, 16, SPELL_WELDING_SKILL_ID])
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

test('Bonus kinds 0 and 1 queue a picker or increase one learned below-cap skill', () => {
  const progression = createPlayerProgression(17)
  const skillBook = createPlayerSkillBook(ETHER_ARCANE)
  const queued = grantPlayerBonusSkillChoice(progression, skillBook)
  assert.equal(queued.pendingLevels.length, 1)
  assert.equal(queued.pendingOffer?.level, progression.level)
  assert.ok(queued.pendingOffer?.options.length)

  const increased = increaseRandomLearnedSkill(skillBook, createNativeRng(123))
  assert.ok(increased.skillId === 8 || increased.skillId === 11)
  assert.equal(
    increased.skillBook.permanentRanks[increased.skillId],
    skillBook.permanentRanks[increased.skillId]! + 1,
  )
  assert.deepEqual(
    increased.skillBook.permanentRanks.flatMap((rank, id) => (
      rank === skillBook.permanentRanks[id] ? [] : [id]
    )),
    [increased.skillId],
  )
})

import { nativePuppetHit } from './native-state.ts'
import { NATIVE_MAGE_COLD_SLOW_TICKS, NATIVE_WRAITH_DAZZLE_TICKS } from '../../core-kernels/boneyard-enemy-modifiers.ts'
import { NATIVE_SECONDARY_ABILITY_IDS } from '../../core-kernels/native-secondary-ability-contract.ts'
import type { PlayerLifeState } from '../../core-kernels/player-combat.ts'
import { PLAYER_LIFE_STATES } from '../../core-kernels/player-combat.ts'
import { NATIVE_DAMAGE_X4_POTION_TICKS, nativeSkillCategory } from '../../core-kernels/player-progression.ts'
import type { ProtocolPlayerProgression } from '../game-state.ts'
import { GameProtocolError, array, boolean, finite, integer, integerWithin, limitedArray, limitedString, nonnegativeFinite, nonnegativeInteger, onlyKeys, positiveFinite, positiveInteger, record, unitInterval } from './values.ts'
export function playerProgression(value: unknown, field: string): ProtocolPlayerProgression {
  const source = record(value, field)
  onlyKeys(source, field, [
    'circleSlowTicksRemaining',
    'advancedUnlocks',
    'weldBuildId',
    'weldComponentRanks',
    'coldSlowTicksRemaining',
    'concentrationSkillIds',
    'currentHealth',
    'currentMana',
    'damageX4TicksRemaining',
    'deferredSkillChoices',
    'dazzleTicksRemaining',
    'deathEpoch',
    'deathTick',
    'experience',
    'hagathaRuntime',
    'hardenCoating',
    'inventoryStats',
    'learnedSkills',
    'learnedSkillOrder',
    'level',
    'lifeState',
    'lastDamageTick',
    'hitFeedback',
    'maximumHealth',
    'maximumMana',
    'mindChugTicksRemaining',
    'nextThreshold',
    'pendingOffer',
    'poisonDamagePerTick',
    'poisonBeforeCold',
    'poisonTicksRemaining',
    'previousThreshold',
    'revision',
    'secondaryManaCosts',
    'selectedPrimarySkillId',
    'sorcerorsCharmAvailable',
    'splitMind',
  ])
  const advancedUnlocks = limitedArray(
    source.advancedUnlocks,
    `${field}.advancedUnlocks`,
    8,
  ).map((entry, index) => boolean(entry, `${field}.advancedUnlocks[${index}]`))
  if (advancedUnlocks.length !== 8) {
    throw new GameProtocolError(`${field}.advancedUnlocks must contain eight flags`)
  }
  const maximumHealth = positiveFinite(source.maximumHealth, `${field}.maximumHealth`)
  const maximumMana = positiveFinite(source.maximumMana, `${field}.maximumMana`)
  const currentHealth = finite(source.currentHealth, `${field}.currentHealth`)
  const currentMana = finite(source.currentMana, `${field}.currentMana`)
  const poisonDamagePerTick = finite(
    source.poisonDamagePerTick,
    `${field}.poisonDamagePerTick`,
  )
  if (currentHealth < 0 || currentHealth > maximumHealth) {
    throw new GameProtocolError(`${field}.currentHealth is out of range`)
  }
  if (currentMana < 0 || currentMana > maximumMana) {
    throw new GameProtocolError(`${field}.currentMana is out of range`)
  }
  if (poisonDamagePerTick < 0) {
    throw new GameProtocolError(`${field}.poisonDamagePerTick is out of range`)
  }
  const coldSlowTicksRemaining = nonnegativeInteger(
    source.coldSlowTicksRemaining,
    `${field}.coldSlowTicksRemaining`,
  )
  if (coldSlowTicksRemaining > NATIVE_MAGE_COLD_SLOW_TICKS) {
    throw new GameProtocolError(`${field}.coldSlowTicksRemaining is out of range`)
  }
  const dazzleTicksRemaining = nonnegativeInteger(
    source.dazzleTicksRemaining,
    `${field}.dazzleTicksRemaining`,
  )
  if (dazzleTicksRemaining > NATIVE_WRAITH_DAZZLE_TICKS) {
    throw new GameProtocolError(`${field}.dazzleTicksRemaining is out of range`)
  }
  const damageX4TicksRemaining = nonnegativeInteger(
    source.damageX4TicksRemaining,
    `${field}.damageX4TicksRemaining`,
  )
  if (damageX4TicksRemaining > NATIVE_DAMAGE_X4_POTION_TICKS) {
    throw new GameProtocolError(`${field}.damageX4TicksRemaining is out of range`)
  }
  const level = positiveInteger(source.level, `${field}.level`)
  if (level > 75) throw new GameProtocolError(`${field}.level is out of range`)
  const experience = nonnegativeFinite(source.experience, `${field}.experience`)
  if (experience > 10_000_000) {
    throw new GameProtocolError(`${field}.experience is out of range`)
  }
  const rawHagathaRuntime = record(source.hagathaRuntime, `${field}.hagathaRuntime`)
  onlyKeys(rawHagathaRuntime, `${field}.hagathaRuntime`, [
    'cheatDeathCharges',
    'reverieActive',
    'serendipityActive',
  ])
  const cheatDeathCharges = nonnegativeInteger(
    rawHagathaRuntime.cheatDeathCharges,
    `${field}.hagathaRuntime.cheatDeathCharges`,
  )
  if (cheatDeathCharges > 1) {
    throw new GameProtocolError(`${field}.hagathaRuntime.cheatDeathCharges is out of range`)
  }
  const hagathaRuntime = {
    cheatDeathCharges,
    reverieActive: boolean(
      rawHagathaRuntime.reverieActive,
      `${field}.hagathaRuntime.reverieActive`,
    ),
    serendipityActive: boolean(
      rawHagathaRuntime.serendipityActive,
      `${field}.hagathaRuntime.serendipityActive`,
    ),
  }
  const inventoryStats = playerInventoryStats(
    source.inventoryStats,
    `${field}.inventoryStats`,
  )
  const learnedSkills = limitedArray(
    source.learnedSkills,
    `${field}.learnedSkills`,
    83,
  ).map((entry, index) => {
    const raw = array(entry, `${field}.learnedSkills[${index}]`)
    if (raw.length !== 3) {
      throw new GameProtocolError(`${field}.learnedSkills[${index}] must have three fields`)
    }
    const skillId = nonnegativeInteger(raw[0], `${field}.learnedSkills[${index}][0]`)
    const permanentRank = nonnegativeInteger(raw[1], `${field}.learnedSkills[${index}][1]`)
    const effectiveRank = nonnegativeInteger(raw[2], `${field}.learnedSkills[${index}][2]`)
    if (skillId > 82 || permanentRank > 255 || effectiveRank > 255) {
      throw new GameProtocolError(`${field}.learnedSkills[${index}] is out of range`)
    }
    return [skillId, permanentRank, effectiveRank] as const
  })
  if (learnedSkills.some((entry, index) => index > 0 && entry[0] <= learnedSkills[index - 1]![0])) {
    throw new GameProtocolError(`${field}.learnedSkills must be unique and sorted`)
  }
  const learnedPermanentIds = learnedSkills
    .filter(([skillId, permanentRank]) => skillId >= 8 && skillId <= 79 && permanentRank > 0)
    .map(([skillId]) => skillId)
  const secondaryManaCosts = limitedArray(
    source.secondaryManaCosts,
    `${field}.secondaryManaCosts`,
    NATIVE_SECONDARY_ABILITY_IDS.length,
  ).map((entry, index) => {
    const raw = array(entry, `${field}.secondaryManaCosts[${index}]`)
    if (raw.length !== 2) {
      throw new GameProtocolError(`${field}.secondaryManaCosts[${index}] must have two fields`)
    }
    const skillId = nonnegativeInteger(raw[0], `${field}.secondaryManaCosts[${index}][0]`)
    if (!(NATIVE_SECONDARY_ABILITY_IDS as readonly number[]).includes(skillId)) {
      throw new GameProtocolError(`${field}.secondaryManaCosts[${index}] has a non-secondary skill`)
    }
    return [
      skillId,
      nonnegativeFinite(raw[1], `${field}.secondaryManaCosts[${index}][1]`),
    ] as const
  })
  if (secondaryManaCosts.some((entry, index) => (
    index > 0 && entry[0] <= secondaryManaCosts[index - 1]![0]
  ))) throw new GameProtocolError(`${field}.secondaryManaCosts must be unique and sorted`)
  const learnedSecondaryIds = learnedSkills
    .filter(([skillId, , effectiveRank]) => (
      (NATIVE_SECONDARY_ABILITY_IDS as readonly number[]).includes(skillId)
      && effectiveRank > 0
    ))
    .map(([skillId]) => skillId)
  if (
    secondaryManaCosts.length !== learnedSecondaryIds.length
    || learnedSecondaryIds.some((skillId) => (
      !secondaryManaCosts.some(([candidate]) => candidate === skillId)
    ))
  ) throw new GameProtocolError(`${field}.secondaryManaCosts must contain every learned secondary`)
  const learnedSkillOrder = limitedArray(
    source.learnedSkillOrder,
    `${field}.learnedSkillOrder`,
    72,
  ).map((entry, index) => {
    const skillId = nonnegativeInteger(entry, `${field}.learnedSkillOrder[${index}]`)
    if (skillId < 8 || skillId > 79) {
      throw new GameProtocolError(`${field}.learnedSkillOrder[${index}] is out of range`)
    }
    return skillId
  })
  if (
    new Set(learnedSkillOrder).size !== learnedSkillOrder.length
    || learnedSkillOrder.length !== learnedPermanentIds.length
    || learnedPermanentIds.some((skillId) => !learnedSkillOrder.includes(skillId))
  ) throw new GameProtocolError(`${field}.learnedSkillOrder must contain every learned public skill`)
  const concentrationSkillIds = limitedArray(
    source.concentrationSkillIds,
    `${field}.concentrationSkillIds`,
    2,
  ).map((entry, index) => {
    if (entry === null) return null
    const skillId = nonnegativeInteger(entry, `${field}.concentrationSkillIds[${index}]`)
    if (
      nativeSkillCategory(skillId) !== 3
      || (learnedSkills.find(([id]) => id === skillId)?.[2] ?? 0) < 1
    ) throw new GameProtocolError(`${field}.concentrationSkillIds[${index}] is not eligible`)
    return skillId
  })
  if (concentrationSkillIds.length !== 2) {
    throw new GameProtocolError(`${field}.concentrationSkillIds must contain two slots`)
  }
  if (
    concentrationSkillIds[0] !== null
    && concentrationSkillIds[0] === concentrationSkillIds[1]
  ) throw new GameProtocolError(`${field}.concentrationSkillIds must be unique`)
  const splitMind = boolean(source.splitMind, `${field}.splitMind`)
  if (!splitMind && concentrationSkillIds[1] !== null) {
    throw new GameProtocolError(`${field}.concentrationSkillIds B requires Split Mind`)
  }
  const weldBuildId = source.weldBuildId === null
    ? null
    : integer(source.weldBuildId, `${field}.weldBuildId`)
  if (weldBuildId !== null && (weldBuildId < 1000 || weldBuildId > 1009)) {
    throw new GameProtocolError(`${field}.weldBuildId is out of range`)
  }
  const spellWeldingRank = learnedSkills.find(([skillId]) => skillId === 52)?.[1] ?? 0
  if ((weldBuildId === null) !== (spellWeldingRank === 0)) {
    throw new GameProtocolError(`${field}.weldBuildId does not match Spell Welding`)
  }
  const weldComponentRanks = source.weldComponentRanks === null
    ? null
    : limitedArray(source.weldComponentRanks, `${field}.weldComponentRanks`, 6)
      .map((entry, index) => {
        const rank = nonnegativeInteger(entry, `${field}.weldComponentRanks[${index}]`)
        if (rank > 255) {
          throw new GameProtocolError(`${field}.weldComponentRanks[${index}] is out of range`)
        }
        return rank
      })
  if (
    (weldBuildId === null) !== (weldComponentRanks === null)
    || (weldComponentRanks !== null && weldComponentRanks.length !== 6)
  ) throw new GameProtocolError(`${field}.weldComponentRanks does not match Spell Welding`)
  const selectedPrimarySkillId = nonnegativeInteger(
    source.selectedPrimarySkillId,
    `${field}.selectedPrimarySkillId`,
  )
  if (
    nativeSkillCategory(selectedPrimarySkillId) !== 1
    || (learnedSkills.find(([id]) => id === selectedPrimarySkillId)?.[2] ?? 0) < 1
    || (selectedPrimarySkillId === 52 && weldBuildId === null)
  ) {
    throw new GameProtocolError(`${field}.selectedPrimarySkillId is not a learned primary`)
  }
  const lifeState = limitedString(source.lifeState, `${field}.lifeState`, 32)
  if (!(PLAYER_LIFE_STATES as readonly string[]).includes(lifeState)) {
    throw new GameProtocolError(`${field}.lifeState is not supported`)
  }
  return {
    circleSlowTicksRemaining: integerWithin(source.circleSlowTicksRemaining, `${field}.circleSlowTicksRemaining`, 0, 20),
    advancedUnlocks,
    coldSlowTicksRemaining,
    concentrationSkillIds: concentrationSkillIds as [number | null, number | null],
    currentHealth,
    currentMana,
    damageX4TicksRemaining,
    deferredSkillChoices: nonnegativeInteger(
      source.deferredSkillChoices,
      `${field}.deferredSkillChoices`,
    ),
    dazzleTicksRemaining,
    deathEpoch: nonnegativeInteger(source.deathEpoch, `${field}.deathEpoch`),
    deathTick: nonnegativeInteger(source.deathTick, `${field}.deathTick`),
    experience,
    hagathaRuntime,
    hardenCoating: unitInterval(source.hardenCoating, `${field}.hardenCoating`),
    inventoryStats,
    learnedSkills,
    learnedSkillOrder,
    level,
    lifeState: lifeState as PlayerLifeState,
    hitFeedback: nativePuppetHit(source.hitFeedback, `${field}.hitFeedback`),
    lastDamageTick: source.lastDamageTick === null
      ? null
      : nonnegativeInteger(source.lastDamageTick, `${field}.lastDamageTick`),
    maximumHealth,
    maximumMana,
    mindChugTicksRemaining: nonnegativeInteger(
      source.mindChugTicksRemaining,
      `${field}.mindChugTicksRemaining`,
    ),
    nextThreshold: nonnegativeInteger(source.nextThreshold, `${field}.nextThreshold`),
    pendingOffer: source.pendingOffer === null
      ? null
      : playerSkillOffer(source.pendingOffer, `${field}.pendingOffer`, level),
    poisonDamagePerTick,
    poisonBeforeCold: boolean(source.poisonBeforeCold, `${field}.poisonBeforeCold`),
    poisonTicksRemaining: nonnegativeInteger(
      source.poisonTicksRemaining,
      `${field}.poisonTicksRemaining`,
    ),
    previousThreshold: nonnegativeInteger(
      source.previousThreshold,
      `${field}.previousThreshold`,
    ),
    revision: nonnegativeInteger(source.revision, `${field}.revision`),
    secondaryManaCosts,
    selectedPrimarySkillId,
    sorcerorsCharmAvailable: boolean(
      source.sorcerorsCharmAvailable,
      `${field}.sorcerorsCharmAvailable`,
    ),
    splitMind,
    weldBuildId,
    weldComponentRanks: weldComponentRanks as [number, number, number, number, number, number] | null,
  }
}

function playerInventoryStats(
  value: unknown,
  field: string,
): ProtocolPlayerProgression['inventoryStats'] {
  const source = record(value, field)
  onlyKeys(source, field, [
    'castSpeedPercent',
    'magicResistancePercent',
    'manaRecoveryPerSecond',
    'painResistancePercent',
    'poisonResistancePercent',
    'primarySpell',
    'walkSpeedPercent',
  ])
  const resistance = (name: 'magicResistancePercent' | 'painResistancePercent' | 'poisonResistancePercent') => {
    const value = nonnegativeFinite(source[name], `${field}.${name}`)
    if (value > 100) throw new GameProtocolError(`${field}.${name} is out of range`)
    return value
  }
  const primarySpellSource = record(source.primarySpell, `${field}.primarySpell`)
  onlyKeys(primarySpellSource, `${field}.primarySpell`, [
    'damageMaximum',
    'damageMinimum',
    'manaCost',
  ])
  const damageMinimum = nonnegativeFinite(
    primarySpellSource.damageMinimum,
    `${field}.primarySpell.damageMinimum`,
  )
  const damageMaximum = nonnegativeFinite(
    primarySpellSource.damageMaximum,
    `${field}.primarySpell.damageMaximum`,
  )
  if (damageMaximum < damageMinimum) {
    throw new GameProtocolError(`${field}.primarySpell damage range is inverted`)
  }
  return {
    castSpeedPercent: nonnegativeFinite(source.castSpeedPercent, `${field}.castSpeedPercent`),
    magicResistancePercent: resistance('magicResistancePercent'),
    manaRecoveryPerSecond: nonnegativeFinite(
      source.manaRecoveryPerSecond,
      `${field}.manaRecoveryPerSecond`,
    ),
    painResistancePercent: resistance('painResistancePercent'),
    poisonResistancePercent: resistance('poisonResistancePercent'),
    primarySpell: {
      damageMaximum,
      damageMinimum,
      manaCost: nonnegativeFinite(
        primarySpellSource.manaCost,
        `${field}.primarySpell.manaCost`,
      ),
    },
    walkSpeedPercent: nonnegativeFinite(source.walkSpeedPercent, `${field}.walkSpeedPercent`),
  }
}

function playerSkillOffer(value: unknown, field: string, playerLevel: number) {
  const source = record(value, field)
  onlyKeys(source, field, ['automaticChoiceIndex', 'level', 'options', 'sequence'])
  const level = positiveInteger(source.level, `${field}.level`)
  if (level > playerLevel) throw new GameProtocolError(`${field}.level is ahead of the player`)
  const options = limitedArray(source.options, `${field}.options`, 4)
  if (options.length !== 3 && options.length !== 4) {
    throw new GameProtocolError(`${field}.options must contain three or four choices`)
  }
  const automaticChoiceIndex = source.automaticChoiceIndex === undefined
    ? undefined
    : integerWithin(
        source.automaticChoiceIndex,
        `${field}.automaticChoiceIndex`,
        0,
        options.length - 1,
      )
  return {
    ...(automaticChoiceIndex === undefined ? {} : { automaticChoiceIndex }),
    level,
    options: options.map((option, index) => {
      const optionField = `${field}.options[${index}]`
      const row = record(option, optionField)
      onlyKeys(row, optionField, ['insight', 'skillId', 'targetRank', 'weldBuildId'])
      const skillId = nonnegativeInteger(row.skillId, `${optionField}.skillId`)
      if (skillId < 8 || skillId > 79) {
        throw new GameProtocolError(`${optionField}.skillId is out of range`)
      }
      const targetRank = positiveInteger(row.targetRank, `${optionField}.targetRank`)
      if (targetRank > 255) {
        throw new GameProtocolError(`${optionField}.targetRank is out of range`)
      }
      const weldBuildId = row.weldBuildId === undefined
        ? undefined
        : integer(row.weldBuildId, `${optionField}.weldBuildId`)
      const insight = row.insight === undefined ? undefined : row.insight
      if (insight !== undefined && insight !== true) {
        throw new GameProtocolError(`${optionField}.insight must be true`)
      }
      if (skillId === 52) {
        if (targetRank !== 1 || weldBuildId === undefined || row.insight !== undefined) {
          throw new GameProtocolError(`${optionField} is not a valid Spell Welding choice`)
        }
        if (weldBuildId < 1000 || weldBuildId > 1009) {
          throw new GameProtocolError(`${optionField}.weldBuildId is out of range`)
        }
      } else if (weldBuildId !== undefined) {
        throw new GameProtocolError(`${optionField}.weldBuildId requires Spell Welding`)
      }
      return {
        ...(insight === undefined ? {} : { insight: true as const }),
        skillId,
        targetRank,
        ...(weldBuildId === undefined ? {} : { weldBuildId }),
      }
    }),
    sequence: nonnegativeInteger(source.sequence, `${field}.sequence`),
  }
}

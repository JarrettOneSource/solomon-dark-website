import {
  NATIVE_SKILL_CATALOG,
  NATIVE_WELD_BUILDS,
  nativeSkillCategory,
} from '../../core-kernels/player-progression.ts'
import {
  getPlayerProgression,
  getPlayerSkillBook,
  getPlayerStatBook,
  type GameSimulationState,
} from '../game-simulation.ts'
import {
  ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES,
  ML_BOT_POLICY_SCALES,
} from './spec.ts'

export interface MlBotPolicySkillOfferDescription {
  readonly coverageKeys: readonly string[]
  readonly descriptors: Float32Array
  readonly generation: number
  readonly mask: Uint8Array
  readonly optionIds: readonly number[]
}

type DescriptorName = typeof ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES[number]

const PRIMARY_IDS = new Set([8, 16, 24, 32, 40])
const ELEMENT_FAMILIES = new Set(['air', 'earth', 'ether', 'fire', 'water'])
const DISCIPLINE_FAMILIES = new Set(['arcane', 'body', 'mind'])

export function describeMlBotPolicySkillOffer(
  state: GameSimulationState,
  playerId: string,
): MlBotPolicySkillOfferDescription | null {
  const progression = getPlayerProgression(state, playerId)
  const offer = progression.pendingOffer
  if (offer === null || offer.options.length === 0) return null
  const skillBook = getPlayerSkillBook(state, playerId)
  const statBook = getPlayerStatBook(state, playerId)
  const descriptors = new Float32Array(offer.options.length * ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.length)
  const coverageKeys: string[] = []
  const optionIds: number[] = []
  for (let index = 0; index < offer.options.length; index += 1) {
    const option = offer.options[index]!
    const skillId = option.skillId
    const catalog = NATIVE_SKILL_CATALOG[skillId]
    const stats = statBook.entries[skillId]
    const family = catalog?.family ?? 'unknown'
    const category = nativeSkillCategory(skillId)
    const permanentRank = skillBook.permanentRanks[skillId] ?? 0
    const effectiveRank = skillBook.effectiveRanks[skillId] ?? 0
    const targetRank = option.targetRank
    const values = descriptorValues()
    values.present = 1
    values.option_id_index_scaled = scaledUnsigned(skillId, ML_BOT_POLICY_SCALES.skillId)
    values.catalog_known = Number(catalog !== undefined && stats !== undefined)
    values.apply_count_scaled = scaledUnsigned(
      Math.max(0, targetRank - permanentRank),
      ML_BOT_POLICY_SCALES.skillRank,
    )
    values.learned_rank_scaled = scaledUnsigned(permanentRank, ML_BOT_POLICY_SCALES.skillRank)
    values.effective_rank_scaled = scaledUnsigned(effectiveRank, ML_BOT_POLICY_SCALES.skillRank)
    values.cap_rank_scaled = scaledUnsigned(stats?.capLevel ?? 0, ML_BOT_POLICY_SCALES.skillRank)
    values.max_rank_scaled = scaledUnsigned(stats?.maximumLevel ?? 0, ML_BOT_POLICY_SCALES.skillRank)
    values.band_index_scaled = skillBandIndex(skillId)
    values.family_element = Number(ELEMENT_FAMILIES.has(family))
    values.family_discipline = Number(DISCIPLINE_FAMILIES.has(family))
    for (const name of [
      'ether', 'fire', 'air', 'water', 'earth', 'arcane', 'mind', 'body', 'advanced', 'runtime_only',
    ] as const) values[`family_${name}`] = Number(family === name)
    values.is_primary = Number(PRIMARY_IDS.has(skillId))
    values.is_secondary = Number(category === 2)
    values.is_passive = Number(category === 0)
    values.is_utility = Number(category === 3 || skillId === 52)
    values.is_weld = Number(skillId === 52)
    values.is_health_up = Number(skillId === 64)
    values.is_mana_up = Number(skillId === 56)
    const weld = option.weldBuildId === undefined
      ? null
      : NATIVE_WELD_BUILDS.find(({ id }) => id === option.weldBuildId) ?? null
    if (weld) {
      for (const primaryId of weld.primarySkillIds) {
        values[`weld_element_${primaryElement(primaryId)}`] = 1
      }
      values.weld_build_index_scaled = scaledUnsigned(weld.id - 1_000, 10)
    }
    const mechanics = {
      mana_cost: ranked(stats?.numericProperties.mManaCost, targetRank),
      damage_min: ranked(
        stats?.numericProperties.mDamage1 ?? stats?.numericProperties.mDamage,
        targetRank,
      ),
      damage_max: ranked(
        stats?.numericProperties.mDamage2 ?? stats?.numericProperties.mDamage,
        targetRank,
      ),
      range: ranked(stats?.numericProperties.mRange, targetRank),
      cooldown: ranked(stats?.numericProperties.mCooldown, targetRank),
      radius: ranked(stats?.numericProperties.mRadius, targetRank),
      duration: ranked(
        stats?.numericProperties.mDuration ?? stats?.numericProperties.mSeconds,
        targetRank,
      ),
      value: ranked(stats?.numericProperties.mValue, targetRank),
      concentration: ranked(stats?.numericProperties.mConcentration, targetRank),
      chance: ranked(stats?.numericProperties.mChance, targetRank),
      quantity_or_strength: maximumKnown(
        ranked(stats?.numericProperties.mQuantity, targetRank),
        ranked(stats?.numericProperties.mStrength, targetRank),
      ),
    }
    setMechanical(values, 'mana_cost', mechanics.mana_cost, ML_BOT_POLICY_SCALES.mana)
    setMechanical(values, 'damage_min', mechanics.damage_min, ML_BOT_POLICY_SCALES.skillDamage)
    setMechanical(values, 'damage_max', mechanics.damage_max, ML_BOT_POLICY_SCALES.skillDamage)
    setMechanical(values, 'range', mechanics.range, ML_BOT_POLICY_SCALES.range)
    setMechanical(values, 'cooldown', mechanics.cooldown, ML_BOT_POLICY_SCALES.cooldownSeconds)
    setMechanical(values, 'radius', mechanics.radius, ML_BOT_POLICY_SCALES.skillRadius)
    setMechanical(values, 'duration', mechanics.duration, ML_BOT_POLICY_SCALES.skillDurationSeconds)
    setMechanical(values, 'value', mechanics.value, ML_BOT_POLICY_SCALES.skillValue)
    setMechanical(
      values,
      'concentration',
      mechanics.concentration,
      ML_BOT_POLICY_SCALES.skillConcentration,
    )
    setMechanical(values, 'chance', mechanics.chance, ML_BOT_POLICY_SCALES.skillChance)
    setMechanical(
      values,
      'quantity_or_strength',
      mechanics.quantity_or_strength,
      ML_BOT_POLICY_SCALES.skillQuantityOrStrength,
    )
    const offset = index * ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.length
    for (let column = 0; column < ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.length; column += 1) {
      descriptors[offset + column] = values[ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES[column]!] ?? 0
    }
    optionIds.push(skillId)
    coverageKeys.push(weld ? `weld:${weld.id}` : `family:${family}`)
  }
  return Object.freeze({
    coverageKeys: Object.freeze(coverageKeys),
    descriptors,
    generation: offer.sequence,
    mask: new Uint8Array(offer.options.length).fill(1),
    optionIds: Object.freeze(optionIds),
  })
}

function descriptorValues(): Record<DescriptorName, number> {
  return Object.fromEntries(ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.map((name) => [name, 0])) as Record<
    DescriptorName,
    number
  >
}

function setMechanical(
  values: Record<DescriptorName, number>,
  name: 'chance' | 'concentration' | 'cooldown' | 'damage_max' | 'damage_min' | 'duration' | 'mana_cost' | 'quantity_or_strength' | 'radius' | 'range' | 'value',
  value: number | null,
  scale: number,
): void {
  values[`${name}_present`] = Number(value !== null)
  values[`${name}_scaled`] = value === null ? 0 : scaledSigned(value, scale)
}

function ranked(value: number | readonly number[] | undefined, rank: number): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (!Array.isArray(value) || value.length === 0) return null
  const selected = value[Math.min(Math.max(0, rank), value.length - 1)]
  return typeof selected === 'number' && Number.isFinite(selected) ? selected : null
}

function maximumKnown(first: number | null, second: number | null): number | null {
  if (first === null) return second
  if (second === null) return first
  return Math.max(first, second)
}

function skillBandIndex(skillId: number): number {
  if (skillId < 8 || skillId > 47) return 0
  return ((skillId - Math.floor(skillId / 8) * 8) / ML_BOT_POLICY_SCALES.skillBand)
}

function primaryElement(skillId: number): 'air' | 'earth' | 'ether' | 'fire' | 'water' {
  switch (skillId) {
    case 8: return 'ether'
    case 16: return 'fire'
    case 24: return 'air'
    case 32: return 'water'
    case 40: return 'earth'
    default: throw new Error(`ML bot policy weld primary ${skillId} has no element`)
  }
}

function scaledSigned(value: number, scale: number): number {
  return Math.max(-1, Math.min(1, value / scale))
}

function scaledUnsigned(value: number, scale: number): number {
  return Math.max(0, Math.min(1, value / scale))
}

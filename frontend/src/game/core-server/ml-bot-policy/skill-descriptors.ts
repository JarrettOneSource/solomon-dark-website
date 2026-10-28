import {
  NATIVE_SKILL_CATALOG,
  NATIVE_WELD_BUILDS,
  nativeSkillCategory,
  type PlayerSkillBookComponent,
  type PlayerStatBookComponent,
} from '../../core-kernels/player-progression.ts'
import {
  ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES,
  ML_BOT_POLICY_SCALES,
} from './spec.ts'

export interface MlBotPolicySkillDescriptorInput {
  readonly applyCount: number
  readonly skillId: number
  readonly targetRank: number
  readonly weldBuildId?: number
}

type DescriptorName = typeof ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES[number]

const ELEMENT_FAMILIES = new Set(['air', 'earth', 'ether', 'fire', 'water'])
const DISCIPLINE_FAMILIES = new Set(['arcane', 'body', 'mind'])

export function describeMlBotPolicySkill(
  skillBook: PlayerSkillBookComponent,
  statBook: PlayerStatBookComponent,
  input: MlBotPolicySkillDescriptorInput,
): Float32Array {
  const { applyCount, skillId, targetRank, weldBuildId } = input
  const catalog = NATIVE_SKILL_CATALOG[skillId]
  const stats = statBook.entries[skillId]
  const family = catalog?.family ?? 'unknown'
  const category = nativeSkillCategory(skillId)
  const values = descriptorValues()
  values.present = 1
  values.option_id_index_scaled = scaledUnsigned(skillId, ML_BOT_POLICY_SCALES.skillId)
  setUnsignedIdentity(values, 'skill_id', skillId)
  values.catalog_known = Number(catalog !== undefined && stats !== undefined)
  values.apply_count_scaled = scaledUnsigned(applyCount, ML_BOT_POLICY_SCALES.skillRank)
  values.learned_rank_scaled = scaledUnsigned(
    skillBook.permanentRanks[skillId] ?? 0,
    ML_BOT_POLICY_SCALES.skillRank,
  )
  values.effective_rank_scaled = scaledUnsigned(
    skillBook.effectiveRanks[skillId] ?? 0,
    ML_BOT_POLICY_SCALES.skillRank,
  )
  values.cap_rank_scaled = scaledUnsigned(stats?.capLevel ?? 0, ML_BOT_POLICY_SCALES.skillRank)
  values.max_rank_scaled = scaledUnsigned(stats?.maximumLevel ?? 0, ML_BOT_POLICY_SCALES.skillRank)
  values.band_index_scaled = skillBandIndex(skillId)
  values.family_element = Number(ELEMENT_FAMILIES.has(family))
  values.family_discipline = Number(DISCIPLINE_FAMILIES.has(family))
  for (const name of [
    'ether', 'fire', 'air', 'water', 'earth', 'arcane', 'mind', 'body', 'advanced', 'runtime_only',
  ] as const) values[`family_${name}`] = Number(family === name)
  values.is_primary = Number(category === 1 && skillId !== 52)
  values.is_secondary = Number(category === 2)
  values.is_passive = Number(category === 0)
  values.is_utility = Number(category === 3 || skillId === 52)
  values.is_weld = Number(skillId === 52)
  values.is_health_up = Number(skillId === 64)
  values.is_mana_up = Number(skillId === 56)
  const weld = weldBuildId === undefined
    ? null
    : NATIVE_WELD_BUILDS.find(({ id }) => id === weldBuildId) ?? null
  if (weldBuildId !== undefined && weld === null) {
    throw new RangeError(`ML bot policy weld build ${weldBuildId} is not native`)
  }
  if (weld) {
    for (const primaryId of weld.primarySkillIds) {
      values[`weld_element_${primaryElement(primaryId)}`] = 1
    }
    values.weld_build_index_scaled = scaledUnsigned(weld.id - 1_000, 10)
    setUnsignedIdentity(values, 'weld_build_id', weld.id)
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
  setMechanical(values, 'quantity', rankedProperty(stats, 'mQuantity', targetRank), ML_BOT_POLICY_SCALES.skillQuantity)
  setMechanical(values, 'strength', rankedProperty(stats, 'mStrength', targetRank), ML_BOT_POLICY_SCALES.skillStrength)
  setMechanical(values, 'absorb', rankedProperty(stats, 'mAbsorb', targetRank), ML_BOT_POLICY_SCALES.skillAbsorb)
  setMechanical(values, 'arcs', rankedProperty(stats, 'mArcs', targetRank), ML_BOT_POLICY_SCALES.skillArcs)
  setMechanical(values, 'armor_plus', rankedProperty(stats, 'mArmorPlus', targetRank), ML_BOT_POLICY_SCALES.skillArmorPlus)
  setMechanical(values, 'charges', rankedProperty(stats, 'mCharges', targetRank), ML_BOT_POLICY_SCALES.skillCharges)
  setMechanical(values, 'flee', rankedProperty(stats, 'mFlee', targetRank), ML_BOT_POLICY_SCALES.skillFlee)
  setMechanical(values, 'fragments', rankedProperty(stats, 'mFragments', targetRank), ML_BOT_POLICY_SCALES.skillFragments)
  setMechanical(values, 'freeze', rankedProperty(stats, 'mFreeze', targetRank), ML_BOT_POLICY_SCALES.skillFreeze)
  setMechanical(values, 'hp', rankedProperty(stats, 'mHP', targetRank), ML_BOT_POLICY_SCALES.skillHp)
  setMechanical(values, 'hoard', rankedProperty(stats, 'mHoard', targetRank), ML_BOT_POLICY_SCALES.skillHoard)
  setMechanical(values, 'loss', rankedProperty(stats, 'mLoss', targetRank), ML_BOT_POLICY_SCALES.skillLoss)
  setMechanical(values, 'max_armor', rankedProperty(stats, 'mMaxArmor', targetRank), ML_BOT_POLICY_SCALES.skillMaxArmor)
  setMechanical(values, 'percent', rankedProperty(stats, 'mPercent', targetRank), ML_BOT_POLICY_SCALES.skillPercent)
  setMechanical(values, 'pierces', rankedProperty(stats, 'mPierces', targetRank), ML_BOT_POLICY_SCALES.skillPierces)
  setMechanical(values, 'pushback', rankedProperty(stats, 'mPushback', targetRank), ML_BOT_POLICY_SCALES.skillPushback)
  setMechanical(values, 'reflect', rankedProperty(stats, 'mReflect', targetRank), ML_BOT_POLICY_SCALES.skillReflect)
  setMechanical(values, 'size', rankedProperty(stats, 'mSize', targetRank), ML_BOT_POLICY_SCALES.skillSize)
  setMechanical(values, 'slow', rankedProperty(stats, 'mSlow', targetRank), ML_BOT_POLICY_SCALES.skillSlow)
  setMechanical(values, 'slowdown', rankedProperty(stats, 'mSlowdown', targetRank), ML_BOT_POLICY_SCALES.skillSlowdown)
  setMechanical(values, 'speed', rankedProperty(stats, 'mSpeed', targetRank), ML_BOT_POLICY_SCALES.skillSpeed)
  setMechanical(values, 'speed_up', rankedProperty(stats, 'mSpeedUp', targetRank), ML_BOT_POLICY_SCALES.skillSpeedUp)
  setMechanical(values, 'stun_amount', rankedProperty(stats, 'mStunAmount', targetRank), ML_BOT_POLICY_SCALES.skillStunAmount)
  setMechanical(values, 'to_hit', rankedProperty(stats, 'mToHit', targetRank), ML_BOT_POLICY_SCALES.skillToHit)
  setMechanical(values, 'weaken', rankedProperty(stats, 'mWeaken', targetRank), ML_BOT_POLICY_SCALES.skillWeaken)
  setMechanical(values, 'widen', rankedProperty(stats, 'mWiden', targetRank), ML_BOT_POLICY_SCALES.skillWiden)
  return Float32Array.from(
    ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.map((name) => values[name] ?? 0),
  )
}

function setUnsignedIdentity(
  values: Record<DescriptorName, number>,
  prefix: 'skill_id' | 'weld_build_id',
  value: number,
): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`ML bot policy ${prefix} ${value} is outside uint16`)
  }
  for (let bit = 0; bit < 16; bit += 1) {
    values[`${prefix}_bit_${bit}` as DescriptorName] = (value >>> bit) & 1
  }
}

export function mlBotPolicySkillCoverageKey(
  skillId: number,
  weldBuildId?: number,
): string {
  const weld = weldBuildId === undefined
    ? null
    : NATIVE_WELD_BUILDS.find(({ id }) => id === weldBuildId) ?? null
  return weld ? `weld:${weld.id}` : `family:${NATIVE_SKILL_CATALOG[skillId]?.family ?? 'unknown'}`
}

function descriptorValues(): Record<DescriptorName, number> {
  return Object.fromEntries(ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.map((name) => [name, 0])) as Record<
    DescriptorName,
    number
  >
}

function setMechanical(
  values: Record<DescriptorName, number>,
  name: 'absorb' | 'arcs' | 'armor_plus' | 'chance' | 'charges' | 'concentration' | 'cooldown' | 'damage_max' | 'damage_min' | 'duration' | 'flee' | 'fragments' | 'freeze' | 'hoard' | 'hp' | 'loss' | 'mana_cost' | 'max_armor' | 'percent' | 'pierces' | 'pushback' | 'quantity' | 'radius' | 'range' | 'reflect' | 'size' | 'slow' | 'slowdown' | 'speed' | 'speed_up' | 'strength' | 'stun_amount' | 'to_hit' | 'value' | 'weaken' | 'widen',
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

function rankedProperty(
  stats: PlayerStatBookComponent['entries'][number] | undefined,
  property: string,
  rank: number,
): number | null {
  return ranked(stats?.numericProperties[property], rank)
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

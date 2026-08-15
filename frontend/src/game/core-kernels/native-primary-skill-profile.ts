import type {
  PlayerSkillBookComponent,
  PlayerStatBookComponent,
} from './player-progression.ts'
import {
  validateOffensiveFactors,
  type NativeOffensiveSpellFactors,
} from './native-offensive-resolution.ts'

export type { NativeOffensiveSpellFactors } from './native-offensive-resolution.ts'

interface NativePrimarySkillProfileBase {
  readonly damageMaximum: number
  readonly damageMinimum: number
  readonly damageRollCount: number
  readonly manaCost: number
  readonly rank: number
  readonly skillId: 8 | 16 | 24 | 32 | 40
}

export interface NativeEtherPrimarySkillProfile extends NativePrimarySkillProfileBase {
  readonly blastChargeCapacity: number
  readonly damageRetention: number
  readonly kind: 'ether'
  readonly pierces: number
  readonly quantity: number
  readonly reacquiresTarget: boolean
  readonly speedFactor: number
}

export interface NativeFirePrimarySkillProfile extends NativePrimarySkillProfileBase {
  readonly burnDamage: number
  readonly emberDamage: number
  readonly emberFragments: number
  readonly explodeDamage: number
  readonly explodeRadius: number
  readonly kind: 'fire'
  readonly spentEmber:
    | Readonly<{ damage: number; kind: 'immolate' }>
    | Readonly<{ damage: number; kind: 'imp'; lifetimeTicks: number }>
    | Readonly<{ kind: 'none' }>
}

export interface NativeAirPrimarySkillProfile extends NativePrimarySkillProfileBase {
  readonly arcCount: number
  readonly disintegrateChance: number
  readonly hurricaneDamageMaximum: number
  readonly hurricaneDamageMinimum: number
  readonly kind: 'air'
  readonly stunMovementFactor: number
}

export interface NativeWaterPrimarySkillProfile extends NativePrimarySkillProfileBase {
  readonly armorMaximum: number
  readonly armorPerSecond: number
  readonly auraRadius: number
  readonly auraMovementFactor: number
  readonly auraSlowFactor: number
  readonly coldDurationTicks: number
  readonly coldMovementFactor: number
  readonly hailChance: number
  readonly hailDamageMaximum: number
  readonly hailDamageMinimum: number
  readonly hailThreshold: number
  readonly halfAngleDegrees: number
  readonly kind: 'water'
  readonly minimumColdDurationTicks: number
  readonly pushbackPercent: number
  readonly reach: number
  readonly slowdownScale: number
}

export interface NativeEarthPrimarySkillProfile extends NativePrimarySkillProfileBase {
  readonly growthFactor: number
  readonly kind: 'earth'
  readonly maximumCharge: number
  readonly rockSurgeChance: number
  readonly rockSurgeManaCost: number
  readonly toughness: number
}

export type NativePrimarySkillProfile =
  | NativeAirPrimarySkillProfile
  | NativeEarthPrimarySkillProfile
  | NativeEtherPrimarySkillProfile
  | NativeFirePrimarySkillProfile
  | NativeWaterPrimarySkillProfile

const PRIMARY_SKILL_IDS = Object.freeze([8, 16, 24, 32, 40] as const)

export function nativePrimarySkillProfile(
  skillBook: PlayerSkillBookComponent,
  statBook: PlayerStatBookComponent,
  factors: NativeOffensiveSpellFactors,
): NativePrimarySkillProfile {
  validateOffensiveFactors(factors)
  const skillId = skillBook.primarySkillId
  if (!(PRIMARY_SKILL_IDS as readonly number[]).includes(skillId)) {
    throw new RangeError(`skill ${skillId} is not an elemental primary`)
  }
  const primarySkillId = skillId as NativePrimarySkillProfile['skillId']
  const rank = effectiveRank(skillBook, primarySkillId, true)
  const rawDamageMinimum = damageValue(statBook, primarySkillId, rank, 'minimum')
  const rawDamageMaximum = damageValue(statBook, primarySkillId, rank, 'maximum')
  const damageMinimum = rawDamageMinimum * factors.damage
  const damageMaximum = rawDamageMaximum * factors.damage
  const common = {
    damageMaximum,
    damageMinimum,
    damageRollCount: rawDamageMaximum - rawDamageMinimum + 1,
    manaCost: primaryManaCost(skillBook, statBook, primarySkillId) * factors.manaCost,
    rank,
    skillId: primarySkillId,
  }

  switch (primarySkillId) {
    case 8: {
      const smartRank = effectiveRank(skillBook, 9)
      const quantityRank = effectiveRank(skillBook, 10)
      const piercingRank = effectiveRank(skillBook, 13)
      const blastRank = effectiveRank(skillBook, 14)
      return Object.freeze({
        ...common,
        blastChargeCapacity: Math.round(rankedOr(statBook, 14, 'mCharges', blastRank, 0)),
        damageRetention: piercingRank > 0
          ? 1 - ranked(statBook, 13, 'mLoss', piercingRank) / 100
          : 1,
        kind: 'ether',
        pierces: Math.round(rankedOr(statBook, 13, 'mPierces', piercingRank, 0)),
        quantity: Math.round(rankedOr(statBook, 10, 'mQuantity', quantityRank, 1)),
        reacquiresTarget: smartRank > 0,
        speedFactor: 1 + rankedOr(statBook, 9, 'mSpeed', smartRank, 0) / 100,
      })
    }
    case 16: {
      const emberRank = effectiveRank(skillBook, 17)
      const explodeRank = effectiveRank(skillBook, 18)
      const impRank = effectiveRank(skillBook, 19)
      const immolateRank = effectiveRank(skillBook, 20)
      const burnRank = effectiveRank(skillBook, 22)
      const spentEmber: NativeFirePrimarySkillProfile['spentEmber'] = impRank > 0
        ? Object.freeze({
            damage: ranked(statBook, 19, 'mDamage', impRank) * factors.damage,
            kind: 'imp',
            lifetimeTicks: 300,
          })
        : immolateRank > 0
          ? Object.freeze({
              damage: ranked(statBook, 20, 'mDamage', immolateRank) * factors.damage,
              kind: 'immolate',
            })
          : Object.freeze({ kind: 'none' })
      return Object.freeze({
        ...common,
        burnDamage: rankedOr(statBook, 22, 'mDamage', burnRank, 0) * factors.damage,
        emberDamage: rankedOr(statBook, 17, 'mDamage', emberRank, 0) * factors.damage,
        emberFragments: Math.round(rankedOr(statBook, 17, 'mFragments', emberRank, 0)),
        explodeDamage: rankedOr(statBook, 18, 'mDamage', explodeRank, 0) * factors.damage,
        explodeRadius: rankedOr(statBook, 18, 'mRadius', explodeRank, 0),
        kind: 'fire',
        spentEmber,
      })
    }
    case 24: {
      const chainingRank = effectiveRank(skillBook, 25)
      const stunRank = effectiveRank(skillBook, 26)
      const hurricaneRank = effectiveRank(skillBook, 29)
      const disintegrateRank = effectiveRank(skillBook, 31)
      return Object.freeze({
        ...common,
        arcCount: Math.round(rankedOr(statBook, 25, 'mArcs', chainingRank, 0)),
        disintegrateChance: rankedOr(statBook, 31, 'mChance', disintegrateRank, 0),
        hurricaneDamageMaximum: rankedOr(
          statBook,
          29,
          'mDamage2',
          hurricaneRank,
          0,
        ) * factors.damage,
        hurricaneDamageMinimum: rankedOr(
          statBook,
          29,
          'mDamage1',
          hurricaneRank,
          0,
        ) * factors.damage,
        kind: 'air',
        stunMovementFactor: 1 - rankedOr(
          statBook,
          26,
          'mStunAmount',
          stunRank,
          0,
        ) / 100,
      })
    }
    case 32: {
      const chillRank = effectiveRank(skillBook, 33)
      const coneRank = effectiveRank(skillBook, 34)
      const hardenRank = effectiveRank(skillBook, 36)
      const auraRank = effectiveRank(skillBook, 37)
      const hailRank = effectiveRank(skillBook, 38)
      const permafrostRank = effectiveRank(skillBook, 39)
      const widen = rankedOr(statBook, 34, 'mWiden', coneRank, 0)
      const slowdownScale = 1 + rankedOr(
        statBook,
        39,
        'mSlowdown',
        permafrostRank,
        0,
      ) / 100
      const minimumColdDurationTicks = permafrostRank > 0 ? 200 : 0
      const auraSlowFactor = 1 - rankedOr(statBook, 37, 'mPercent', auraRank, 0) / 100
      const hailChance = rankedOr(statBook, 38, 'mToHit', hailRank, 0)
      return Object.freeze({
        ...common,
        armorMaximum: rankedOr(statBook, 36, 'mMaxArmor', hardenRank, 0),
        armorPerSecond: rankedOr(statBook, 36, 'mArmorPlus', hardenRank, 0),
        auraRadius: rankedOr(statBook, 37, 'mRadius', auraRank, 0),
        auraMovementFactor: auraSlowFactor,
        auraSlowFactor,
        coldDurationTicks: Math.max(25, minimumColdDurationTicks),
        coldMovementFactor: 0.5 / slowdownScale,
        hailChance,
        hailDamageMaximum: rankedOr(statBook, 38, 'mDamage2', hailRank, 0)
          * factors.damage,
        hailDamageMinimum: rankedOr(statBook, 38, 'mDamage1', hailRank, 0)
          * factors.damage,
        hailThreshold: Math.round(hailChance * 30),
        halfAngleDegrees: 15 + widen,
        kind: 'water',
        minimumColdDurationTicks,
        pushbackPercent: rankedOr(statBook, 33, 'mPushback', chillRank, 0),
        reach: 205 + 4 * widen,
        slowdownScale,
      })
    }
    case 40: {
      const hastenRank = effectiveRank(skillBook, 42)
      const bindRank = effectiveRank(skillBook, 43)
      const surgeRank = effectiveRank(skillBook, 44)
      const gargantuanRank = effectiveRank(skillBook, 47)
      return Object.freeze({
        ...common,
        growthFactor: 1 + rankedOr(statBook, 42, 'mSpeedUp', hastenRank, 0) / 100,
        kind: 'earth',
        maximumCharge: 1 + rankedOr(statBook, 47, 'mSize', gargantuanRank, 0) / 100,
        rockSurgeChance: rankedOr(statBook, 44, 'mChance', surgeRank, 0),
        rockSurgeManaCost: rankedOr(statBook, 44, 'mManaCost', surgeRank, 0)
          * factors.manaCost,
        toughness: bindRank > 0
          ? ranked(statBook, 43, 'mStrength', bindRank) / 100
          : 1,
      })
    }
  }
}

function primaryManaCost(
  skillBook: PlayerSkillBookComponent,
  statBook: PlayerStatBookComponent,
  primarySkillId: NativePrimarySkillProfile['skillId'],
): number {
  const primaryRank = effectiveRank(skillBook, primarySkillId, true)
  const upgrades = primarySkillId === 8
    ? [9, 10, 13]
    : primarySkillId === 16
      ? [17, 18, 19, 20]
      : primarySkillId === 24
        ? [25, 26, 29, 31]
        : primarySkillId === 32
          ? [33, 34, 36, 37, 38]
          : [42, 43, 47]
  return rankedManaCost(statBook, primarySkillId, primaryRank)
    + upgrades.reduce((total, skillId) => {
      const rank = effectiveRank(skillBook, skillId)
      return total + (rank === 0 ? 0 : rankedManaCost(statBook, skillId, rank))
    }, 0)
}

function rankedManaCost(
  statBook: PlayerStatBookComponent,
  skillId: number,
  rank: number,
): number {
  const value = entry(statBook, skillId).numericProperties.mManaCost
  if (typeof value === 'number') return value
  if (!value || value.length === 0) return 0
  return rankedValue(
    value,
    Math.min(rank, value.length - 1),
    `${skillId}.mManaCost`,
  )
}

function damageValue(
  statBook: PlayerStatBookComponent,
  skillId: number,
  rank: number,
  endpoint: 'maximum' | 'minimum',
): number {
  const properties = entry(statBook, skillId).numericProperties
  const shared = properties.mDamage
  return rankedValue(
    shared ?? properties[endpoint === 'minimum' ? 'mDamage1' : 'mDamage2'],
    rank,
    `${skillId}.${endpoint}`,
  )
}

function ranked(
  statBook: PlayerStatBookComponent,
  skillId: number,
  property: string,
  rank: number,
): number {
  return rankedValue(
    entry(statBook, skillId).numericProperties[property],
    rank,
    `${skillId}.${property}`,
  )
}

function rankedOr(
  statBook: PlayerStatBookComponent,
  skillId: number,
  property: string,
  rank: number,
  fallback: number,
): number {
  return rank === 0 ? fallback : ranked(statBook, skillId, property, rank)
}

function rankedValue(
  value: number | readonly number[] | undefined,
  rank: number,
  field: string,
): number {
  const resolved = typeof value === 'number'
    ? value
    : value && value.length > 0
      ? value[Math.min(rank, value.length - 1)]
      : undefined
  if (resolved === undefined || !Number.isFinite(resolved)) {
    throw new RangeError(`native skill catalog is missing ${field} rank ${rank}`)
  }
  return resolved
}

function effectiveRank(
  skillBook: PlayerSkillBookComponent,
  skillId: number,
  required = false,
): number {
  const rank = skillBook.effectiveRanks[skillId] ?? 0
  if (!Number.isInteger(rank) || rank < 0) {
    throw new RangeError(`skill ${skillId} has invalid effective rank ${String(rank)}`)
  }
  if (required && rank < 1) {
    throw new RangeError(`primary skill ${skillId} is not learned`)
  }
  return rank
}

function entry(statBook: PlayerStatBookComponent, skillId: number) {
  const value = statBook.entries[skillId]
  if (!value || value.id !== skillId) {
    throw new RangeError(`stat book is missing native skill ${skillId}`)
  }
  return value
}

import nativeCatalogJson from './native-skill-catalog.json' with { type: 'json' }

import type {
  PlayerCharacterConfig,
  WizardDiscipline,
  WizardElement,
} from './player-character.ts'
import {
  createPlayerCombat,
  type PlayerCombatComponent,
} from './player-combat.ts'
import { createNativeRng, drawNativeInteger, type NativeRngState } from './native-rng.ts'
import {
  NATIVE_SECONDARY_ABILITY_IDS,
  type NativeSecondaryAbilityId,
} from './native-secondary-ability-contract.ts'

export const NATIVE_SKILL_ROW_COUNT = 83
export const MAX_PLAYER_LEVEL = 75
export const MAX_PLAYER_EXPERIENCE = 10_000_000
export const SPELL_WELDING_SKILL_ID = 52
export const INITIAL_WELD_OFFER_MARKER = 9_999
export const SPELL_WELDING_QUICK_DESCRIPTION = 'TWO ATTACK SPELLS TO COMBINE'
export const RETAIL_BONEYARD_EXPERIENCE_RECIPE_SCALAR = 0.425
export const NATIVE_DAMAGE_X4_POTION_TICKS = 6_000
export const NATIVE_MIND_CHUG_TICKS = 6_000
export const NATIVE_ANTIDOTE_IMMUNITY_TICKS = 1_000

export const NATIVE_LEVEL_THRESHOLDS = [
  0, 90, 160, 275, 390, 520, 650, 800, 1060, 1300, 1600, 2000, 2400,
  2850, 3400, 4200, 4800, 5650, 6000, 6500, 7200, 7850, 8900, 9900,
  11000, 12000, 13000, 14000, 15000, 16000, 20000, 25000, 30000, 35000,
  40000, 45000, 51000, 57000, 64000, 71000, 79000, 88000, 98000, 110000,
  120000, 130000, 135000, 150000, 175000, 200000, 300000, 400000, 500000,
  600000, 700000, 800000, 900000, 1000000, 1200000, 1400000, 1700000,
  2000000, 2300000, 2600000, 3000000, 3500000, 4000000, 4500000,
  5000000, 5500000, 6000000, 6500000, 7000000, 7500000, 8500000, 10000000,
] as const

export interface NativeSkillCatalogEntry {
  readonly config: null | {
    readonly mCapLevel?: number
    readonly mDescription?: string
    readonly mManaCost?: number | readonly number[]
    readonly mMaxLevel?: number
    readonly mQDescription?: string
    readonly [property: string]: unknown
  }
  readonly family: string
  readonly id: number
  readonly name: string
  readonly skills_atlas_icon_record: number
}

interface NativeSkillCatalogJson {
  readonly schema: string
  readonly skills: readonly NativeSkillCatalogEntry[]
}

export interface NativeSkillStatBookEntry {
  readonly capLevel: number
  readonly description: string
  readonly id: number
  readonly maximumLevel: number
  readonly numericProperties: Readonly<Record<string, number | readonly number[]>>
  readonly quickDescription: string
}

export interface PlayerStatBookComponent {
  readonly catalogSchema: string
  readonly entries: readonly NativeSkillStatBookEntry[]
}

export interface NativePrimarySkillRankStats {
  readonly damageMaximum: number
  readonly damageMinimum: number
  readonly manaCost: number
  readonly rank: number
  readonly skillId: number
}

export type PlayerSecondaryAbilityBelt = readonly [
  NativeSecondaryAbilityId | null,
  NativeSecondaryAbilityId | null,
  NativeSecondaryAbilityId | null,
  NativeSecondaryAbilityId | null,
  NativeSecondaryAbilityId | null,
  NativeSecondaryAbilityId | null,
  NativeSecondaryAbilityId | null,
  NativeSecondaryAbilityId | null,
]

export interface NativeSecondaryAbilityRankStats {
  readonly rank: number
  readonly skillId: NativeSecondaryAbilityId
  readonly values: Readonly<Record<string, number>>
}

export interface PlayerSkillBookComponent {
  readonly activeWeldBuildId: number | null
  readonly advancedUnlocks: readonly boolean[]
  readonly disciplineRoot: number
  readonly effectiveRanks: readonly number[]
  readonly elementRoot: number
  readonly permanentRanks: readonly number[]
  readonly primarySkillId: number
  readonly secondaryBelt: PlayerSecondaryAbilityBelt
}

export interface PlayerSkillOfferOption {
  readonly skillId: number
  readonly targetRank: number
  readonly weldBuildId?: number
}

export interface PlayerSkillOffer {
  readonly level: number
  readonly options: readonly PlayerSkillOfferOption[]
  readonly sequence: number
}

export interface PlayerProgressionComponent extends PlayerCombatComponent {
  readonly deferredSkillChoices: number
  readonly damageX4TicksRemaining: number
  readonly disciplineOfferBias: boolean
  readonly excludeActiveWeldBuildFromOffers: boolean
  readonly experience: number
  readonly forcedOfferSkillIds: readonly number[]
  readonly level: number
  readonly mindChugTicksRemaining: number
  readonly nextThreshold: number
  readonly offerCycle: number
  readonly offerSeed: number
  readonly pendingLevels: readonly number[]
  readonly pendingOffer: PlayerSkillOffer | null
  readonly previousThreshold: number
  readonly poisonImmunityTicksRemaining: number
  readonly revision: number
  readonly sorcerorsCharmAvailable: boolean
  readonly weldOfferMarker: number
  readonly weldingOfferBias: boolean
}

export interface NativeWeldBuild {
  readonly id: number
  readonly primarySkillIds: readonly [number, number]
  readonly skillsAtlasIconRecord: number
}

export interface SharedPlayerLevelMilestone {
  readonly crossedLevels: readonly number[]
  readonly experience: number
  readonly level: number
}

export interface PlayerLevelUpBarrierState {
  readonly barrierId: number
  readonly milestoneExperience: number
  readonly milestoneLevel: number
  readonly participantIds: readonly string[]
  readonly pendingPlayerIds: readonly string[]
  readonly runId: string | null
  readonly sourcePlayerId: string
}

export interface BoneyardEnemyExperienceAward {
  readonly arenaPlayerCount: number
  readonly evaluatedActorReward: number
  readonly gameplayScalar?: number
  readonly receiverLevel: number
  readonly receiverXpBonus?: number
}

interface SkillRule {
  readonly all?: readonly number[]
  readonly any?: readonly number[]
  readonly category: number
  readonly forbidden?: readonly number[]
  readonly minimumLevel: number
  readonly root: number
}

const ELEMENT_ROOT: Readonly<Record<WizardElement, number>> = {
  ether: 0,
  fire: 1,
  air: 2,
  water: 3,
  earth: 4,
}
const DISCIPLINE_ROOT: Readonly<Record<WizardDiscipline, number>> = {
  body: 5,
  mind: 6,
  arcane: 7,
}
const STARTING_SKILLS: Readonly<Record<WizardElement, readonly [number, number]>> = {
  ether: [8, 11],
  fire: [16, 21],
  air: [24, 27],
  water: [32, 35],
  earth: [40, 45],
}
const ELEMENTAL_PRIMARY_SKILL_IDS = [8, 16, 24, 32, 40] as const
const WELDING_RELATED_SKILLS: Readonly<Record<number, readonly [number, number]>> = {
  8: [10, 9],
  16: [18, 17],
  24: [25, 26],
  32: [34, 33],
  40: [43, 42],
}

export const NATIVE_WELD_BUILDS: readonly NativeWeldBuild[] = Object.freeze([
  Object.freeze({ id: 1000, primarySkillIds: [8, 16] as const, skillsAtlasIconRecord: 81 }),
  Object.freeze({ id: 1001, primarySkillIds: [8, 32] as const, skillsAtlasIconRecord: 82 }),
  Object.freeze({ id: 1002, primarySkillIds: [8, 24] as const, skillsAtlasIconRecord: 83 }),
  Object.freeze({ id: 1003, primarySkillIds: [16, 24] as const, skillsAtlasIconRecord: 84 }),
  Object.freeze({ id: 1004, primarySkillIds: [32, 24] as const, skillsAtlasIconRecord: 85 }),
  Object.freeze({ id: 1005, primarySkillIds: [16, 32] as const, skillsAtlasIconRecord: 86 }),
  Object.freeze({ id: 1006, primarySkillIds: [8, 40] as const, skillsAtlasIconRecord: 87 }),
  Object.freeze({ id: 1007, primarySkillIds: [16, 40] as const, skillsAtlasIconRecord: 88 }),
  Object.freeze({ id: 1008, primarySkillIds: [32, 40] as const, skillsAtlasIconRecord: 89 }),
  Object.freeze({ id: 1009, primarySkillIds: [24, 40] as const, skillsAtlasIconRecord: 90 }),
])

const CATALOG = nativeCatalogJson as unknown as NativeSkillCatalogJson
export const NATIVE_SKILL_CATALOG = CATALOG.skills

const SHARED_STAT_BOOK: PlayerStatBookComponent = Object.freeze({
  catalogSchema: CATALOG.schema,
  entries: Object.freeze([...CATALOG.skills.map((skill) => {
    const numericProperties: Record<string, number | readonly number[]> = {}
    for (const [property, value] of Object.entries(skill.config ?? {})) {
      if (typeof value === 'number') numericProperties[property] = value
      else if (Array.isArray(value) && value.every((entry) => typeof entry === 'number')) {
        numericProperties[property] = Object.freeze([...value]) as readonly number[]
      }
    }
    return Object.freeze({
      capLevel: skill.config?.mCapLevel ?? 0,
      description: skill.config?.mDescription ?? '',
      id: skill.id,
      maximumLevel: skill.config?.mMaxLevel ?? 0,
      numericProperties: Object.freeze(numericProperties),
      quickDescription: skill.config?.mQDescription ?? '',
    })
  }), Object.freeze({
    capLevel: 0,
    description: '',
    id: 82,
    maximumLevel: 0,
    numericProperties: Object.freeze({}),
    quickDescription: '',
  })]),
})
const PRIMARY_SKILL_RANK_STATS_CACHE = new Map<number, NativePrimarySkillRankStats>()

const RULES: Readonly<Record<number, SkillRule>> = createSkillRules()

export function playerStatBook(): PlayerStatBookComponent {
  return SHARED_STAT_BOOK
}

export function effectivePrimarySkillRankStats(
  skillBook: PlayerSkillBookComponent,
): NativePrimarySkillRankStats {
  const skillId = skillBook.primarySkillId
  return nativePrimarySkillRankStats(skillId, skillBook.effectiveRanks[skillId])
}

export function effectiveSecondaryAbilityRankStats(
  skillBook: PlayerSkillBookComponent,
  skillId: number,
): NativeSecondaryAbilityRankStats {
  if (!(NATIVE_SECONDARY_ABILITY_IDS as readonly number[]).includes(skillId)) {
    throw new RangeError(`skill ${skillId} is not a native secondary`)
  }
  const rank = skillBook.effectiveRanks[skillId] ?? 0
  const entry = SHARED_STAT_BOOK.entries[skillId]
  if (!entry || !Number.isInteger(rank) || rank < 1 || rank > entry.maximumLevel) {
    throw new RangeError(`secondary skill ${skillId} has invalid effective rank ${rank}`)
  }
  const values: Record<string, number> = {}
  for (const [property, configured] of Object.entries(entry.numericProperties)) {
    if (property === 'mCapLevel' || property === 'mMaxLevel') continue
    const value = typeof configured === 'number'
      ? configured
      : configured[Math.min(rank, configured.length - 1)]
    if (value === undefined || !Number.isFinite(value)) {
      throw new RangeError(`secondary skill ${skillId} is missing ${property} rank ${rank}`)
    }
    values[property] = value
  }
  return Object.freeze({
    rank,
    skillId: skillId as NativeSecondaryAbilityId,
    values: Object.freeze(values),
  })
}

export function equipPlayerSecondaryAbility(
  skillBook: PlayerSkillBookComponent,
  skillId: number,
  slot: number,
): PlayerSkillBookComponent {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 8) {
    throw new RangeError(`secondary belt slot ${slot} is outside 0..7`)
  }
  if (!(NATIVE_SECONDARY_ABILITY_IDS as readonly number[]).includes(skillId)) {
    throw new RangeError(`skill ${skillId} is not a native secondary`)
  }
  if ((skillBook.permanentRanks[skillId] ?? 0) < 1) {
    throw new Error(`secondary skill ${skillId} is not learned`)
  }
  const belt = skillBook.secondaryBelt.map((entry) => (
    entry === skillId ? null : entry
  )) as (NativeSecondaryAbilityId | null)[]
  belt[slot] = skillId as NativeSecondaryAbilityId
  return {
    ...skillBook,
    secondaryBelt: freezeSecondaryBelt(belt),
  }
}

function nativePrimarySkillRankStats(
  skillId: number,
  rank: number | undefined,
): NativePrimarySkillRankStats {
  if (!(ELEMENTAL_PRIMARY_SKILL_IDS as readonly number[]).includes(skillId)) {
    throw new RangeError(`skill ${skillId} is not an elemental primary`)
  }
  const entry = SHARED_STAT_BOOK.entries[skillId]
  if (
    !entry
    || rank === undefined
    || !Number.isInteger(rank)
    || rank < 1
    || rank > entry.maximumLevel
  ) {
    throw new RangeError(`skill ${skillId} has invalid effective rank ${String(rank)}`)
  }
  const cacheKey = skillId * NATIVE_SKILL_ROW_COUNT + rank
  const cached = PRIMARY_SKILL_RANK_STATS_CACHE.get(cacheKey)
  if (cached) return cached

  const sharedDamage = entry.numericProperties.mDamage
  const damageMinimum = rankedNativeSkillValue(
    sharedDamage ?? entry.numericProperties.mDamage1,
    rank,
    `${entry.id}.damageMinimum`,
  )
  const damageMaximum = rankedNativeSkillValue(
    sharedDamage ?? entry.numericProperties.mDamage2,
    rank,
    `${entry.id}.damageMaximum`,
  )
  const manaCost = rankedNativeSkillValue(
    entry.numericProperties.mManaCost,
    rank,
    `${entry.id}.manaCost`,
  )
  if (damageMinimum <= 0 || damageMaximum < damageMinimum || manaCost <= 0) {
    throw new RangeError(`skill ${skillId} rank ${rank} has invalid primary stats`)
  }
  const stats = Object.freeze({ damageMaximum, damageMinimum, manaCost, rank, skillId })
  PRIMARY_SKILL_RANK_STATS_CACHE.set(cacheKey, stats)
  return stats
}

export function nativeWeldBuild(buildId: number): NativeWeldBuild | null {
  if (!Number.isInteger(buildId)) return null
  return NATIVE_WELD_BUILDS[buildId - NATIVE_WELD_BUILDS[0]!.id] ?? null
}

export function createPlayerSkillBook(config: PlayerCharacterConfig): PlayerSkillBookComponent {
  const elementRoot = ELEMENT_ROOT[config.element]
  const disciplineRoot = DISCIPLINE_ROOT[config.discipline]
  const [primarySkillId, secondarySkillId] = STARTING_SKILLS[config.element]
  const permanentRanks = new Array<number>(NATIVE_SKILL_ROW_COUNT).fill(0)
  permanentRanks[elementRoot] = 1
  permanentRanks[disciplineRoot] = 1
  permanentRanks[primarySkillId] = 1
  permanentRanks[secondarySkillId] = 1
  return {
    activeWeldBuildId: null,
    advancedUnlocks: Object.freeze(new Array<boolean>(8).fill(false)),
    disciplineRoot,
    effectiveRanks: Object.freeze([...permanentRanks]),
    elementRoot,
    permanentRanks: Object.freeze(permanentRanks),
    primarySkillId,
    secondaryBelt: freezeSecondaryBelt([
      secondarySkillId as NativeSecondaryAbilityId,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]),
  }
}

export function createPlayerProgression(offerSeed: number): PlayerProgressionComponent {
  if (!Number.isInteger(offerSeed) || offerSeed < 0 || offerSeed >= 1_000_000) {
    throw new RangeError('player offer seed must be an integer from 0 through 999999')
  }
  return {
    ...createPlayerCombat(),
    deferredSkillChoices: 0,
    damageX4TicksRemaining: 0,
    disciplineOfferBias: false,
    excludeActiveWeldBuildFromOffers: false,
    experience: 0,
    forcedOfferSkillIds: Object.freeze([]),
    level: 1,
    mindChugTicksRemaining: 0,
    nextThreshold: NATIVE_LEVEL_THRESHOLDS[1],
    offerCycle: 0,
    offerSeed,
    pendingLevels: Object.freeze([]),
    pendingOffer: null,
    previousThreshold: NATIVE_LEVEL_THRESHOLDS[0],
    poisonImmunityTicksRemaining: 0,
    revision: 0,
    sorcerorsCharmAvailable: false,
    weldOfferMarker: INITIAL_WELD_OFFER_MARKER,
    weldingOfferBias: false,
  }
}

export function applyPlayerPotionEffect(
  source: PlayerProgressionComponent,
  subtype: number,
): PlayerProgressionComponent {
  switch (subtype) {
    case 0:
      return { ...source, currentHealth: source.maximumHealth, revision: source.revision + 1 }
    case 1:
      return { ...source, currentMana: source.maximumMana, revision: source.revision + 1 }
    case 2:
      return {
        ...source,
        damageX4TicksRemaining: NATIVE_DAMAGE_X4_POTION_TICKS,
        revision: source.revision + 1,
      }
    case 3:
      return {
        ...source,
        poisonDamagePerTick: 0,
        poisonImmunityTicksRemaining: NATIVE_ANTIDOTE_IMMUNITY_TICKS,
        poisonTicksRemaining: 0,
        revision: source.revision + 1,
      }
    case 4:
      return {
        ...source,
        mindChugTicksRemaining: NATIVE_MIND_CHUG_TICKS,
        revision: source.revision + 1,
      }
    case 5:
      return {
        ...source,
        currentHealth: source.maximumHealth,
        currentMana: source.maximumMana,
        revision: source.revision + 1,
      }
    default:
      throw new RangeError('native potion subtype must be within [0, 5]')
  }
}

export function stepPlayerPotionEffects(
  source: PlayerProgressionComponent,
): PlayerProgressionComponent {
  const damageX4TicksRemaining = Math.max(0, source.damageX4TicksRemaining - 1)
  const mindChugTicksRemaining = Math.max(0, source.mindChugTicksRemaining - 1)
  const poisonImmunityTicksRemaining = Math.max(0, source.poisonImmunityTicksRemaining - 1)
  return damageX4TicksRemaining === source.damageX4TicksRemaining
      && mindChugTicksRemaining === source.mindChugTicksRemaining
      && poisonImmunityTicksRemaining === source.poisonImmunityTicksRemaining
    ? source
    : {
        ...source,
        damageX4TicksRemaining,
        mindChugTicksRemaining,
        poisonImmunityTicksRemaining,
      }
}

export function resetPlayerPotionEffects(
  source: PlayerProgressionComponent,
): PlayerProgressionComponent {
  if (source.damageX4TicksRemaining === 0
    && source.mindChugTicksRemaining === 0
    && source.poisonImmunityTicksRemaining === 0) return source
  return {
    ...source,
    damageX4TicksRemaining: 0,
    mindChugTicksRemaining: 0,
    poisonImmunityTicksRemaining: 0,
  }
}

export function grantPlayerExperience(
  progression: PlayerProgressionComponent,
  skillBook: PlayerSkillBookComponent,
  amount: number,
  sorcerorsCharmOwned = false,
): PlayerProgressionComponent {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError('experience award must be finite and non-negative')
  }
  if (amount === 0 || progression.level >= MAX_PLAYER_LEVEL) {
    const experience = Math.min(MAX_PLAYER_EXPERIENCE, progression.experience + amount)
    return experience === progression.experience ? progression : {
      ...progression,
      experience,
      revision: progression.revision + 1,
    }
  }

  const experience = Math.min(MAX_PLAYER_EXPERIENCE, progression.experience + amount)
  let level = progression.level
  let crossedCount = 0
  while (
    level < MAX_PLAYER_LEVEL
    && experience > NATIVE_LEVEL_THRESHOLDS[level]!
  ) {
    level += 1
    crossedCount += 1
  }
  const nextThreshold = NATIVE_LEVEL_THRESHOLDS[level]!
  const previousThreshold = NATIVE_LEVEL_THRESHOLDS[level - 1]!
  const pendingLevels = crossedCount === 0
    ? progression.pendingLevels
    : Object.freeze(Array.from(
        {
          length: progression.pendingLevels.length
            + progression.deferredSkillChoices
            + crossedCount,
        },
        () => level,
      ))
  let next: PlayerProgressionComponent = {
    ...progression,
    currentHealth: level === progression.level
      ? progression.currentHealth
      : progression.maximumHealth,
    currentMana: level === progression.level
      ? progression.currentMana
      : progression.maximumMana,
    experience,
    level,
    nextThreshold,
    deferredSkillChoices: crossedCount === 0 ? progression.deferredSkillChoices : 0,
    pendingLevels,
    pendingOffer: crossedCount === 0 ? progression.pendingOffer : null,
    previousThreshold,
    revision: progression.revision + 1,
    sorcerorsCharmAvailable: crossedCount === 0
      ? progression.sorcerorsCharmAvailable
      : false,
  }
  if (!next.pendingOffer && next.pendingLevels.length > 0) {
    next = withNextSkillOffer(next, skillBook, sorcerorsCharmOwned)
  }
  return next
}

export function boneyardEnemyExperienceAward(
  award: BoneyardEnemyExperienceAward,
): number {
  if (!Number.isFinite(award.evaluatedActorReward) || award.evaluatedActorReward < 0) {
    throw new RangeError('evaluated enemy experience reward must be finite and non-negative')
  }
  if (!Number.isSafeInteger(award.arenaPlayerCount) || award.arenaPlayerCount < 1) {
    throw new RangeError('Arena player count must be a positive safe integer')
  }
  if (
    !Number.isSafeInteger(award.receiverLevel)
    || award.receiverLevel < 1
    || award.receiverLevel > MAX_PLAYER_LEVEL
  ) {
    throw new RangeError('experience receiver level is out of range')
  }
  const gameplayScalar = award.gameplayScalar ?? 1
  const receiverXpBonus = award.receiverXpBonus ?? 0
  if (!Number.isFinite(gameplayScalar) || gameplayScalar < 0) {
    throw new RangeError('Gameplay experience scalar must be finite and non-negative')
  }
  if (!Number.isFinite(receiverXpBonus) || receiverXpBonus < 0) {
    throw new RangeError('receiver experience bonus must be finite and non-negative')
  }
  return award.evaluatedActorReward
    * award.arenaPlayerCount
    * gameplayScalar
    * survivalExperienceLevelFactor(award.receiverLevel)
    * (1 + receiverXpBonus)
}

export function evaluateBoneyardEnemyExperience(familyBaseline: number): number {
  if (!Number.isFinite(familyBaseline) || familyBaseline < 0) {
    throw new RangeError('enemy family experience baseline must be finite and non-negative')
  }
  return familyBaseline * RETAIL_BONEYARD_EXPERIENCE_RECIPE_SCALAR
}

export function survivalExperienceLevelFactor(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1 || level > MAX_PLAYER_LEVEL) {
    throw new RangeError('survival experience level is out of range')
  }
  if (level === 1) return 1
  if (level <= 5) return 0.9
  if (level <= 15) return 0.72
  if (level <= 30) return 0.504
  return 0.3024
}

export function playerExperienceProgress(
  progression: Pick<
    PlayerProgressionComponent,
    'experience' | 'nextThreshold' | 'previousThreshold'
  >,
): number {
  const span = progression.nextThreshold - progression.previousThreshold
  if (span <= 0) return 1
  return Math.max(0, Math.min(
    1,
    (progression.experience - progression.previousThreshold) / span,
  ))
}

export function synchronizePlayerLevelMilestone(
  progression: PlayerProgressionComponent,
  skillBook: PlayerSkillBookComponent,
  milestone: SharedPlayerLevelMilestone,
  sorcerorsCharmOwned = false,
): PlayerProgressionComponent {
  if (!Number.isFinite(milestone.experience) || milestone.experience < 0) {
    throw new RangeError('shared milestone experience must be finite and non-negative')
  }
  if (
    !Number.isSafeInteger(milestone.level)
    || milestone.level < 1
    || milestone.level > MAX_PLAYER_LEVEL
  ) throw new RangeError('shared milestone level is out of range')
  const crossedLevels = milestone.crossedLevels.map((level, index) => {
    if (
      !Number.isSafeInteger(level)
      || level < 2
      || level > milestone.level
      || (index > 0 && level <= milestone.crossedLevels[index - 1]!)
    ) throw new RangeError('shared crossed levels must be sorted and in range')
    return level
  })
  const pendingLevels = crossedLevels.length === 0
    ? progression.pendingLevels
    : Object.freeze(Array.from(
        {
          length: progression.pendingLevels.length
            + progression.deferredSkillChoices
            + crossedLevels.length,
        },
        () => milestone.level,
      ))
  let next: PlayerProgressionComponent = {
    ...progression,
    deferredSkillChoices: crossedLevels.length === 0 ? progression.deferredSkillChoices : 0,
    experience: Math.min(MAX_PLAYER_EXPERIENCE, milestone.experience),
    level: milestone.level,
    nextThreshold: NATIVE_LEVEL_THRESHOLDS[milestone.level]!,
    pendingLevels,
    pendingOffer: crossedLevels.length === 0 ? progression.pendingOffer : null,
    previousThreshold: NATIVE_LEVEL_THRESHOLDS[milestone.level - 1]!,
    revision: progression.revision + 1,
    sorcerorsCharmAvailable: crossedLevels.length === 0
      ? progression.sorcerorsCharmAvailable
      : false,
  }
  if (!next.pendingOffer && next.pendingLevels.length > 0) {
    next = withNextSkillOffer(next, skillBook, sorcerorsCharmOwned)
  }
  return next
}

export function applyPlayerSkillChoice(
  progression: PlayerProgressionComponent,
  skillBook: PlayerSkillBookComponent,
  selection: { choiceIndex: number; offerSequence: number; skillId: number },
  sorcerorsCharmOwned = false,
): { progression: PlayerProgressionComponent; skillBook: PlayerSkillBookComponent } | null {
  const offer = progression.pendingOffer
  if (!offer || offer.sequence !== selection.offerSequence) return null
  const chosen = offer.options[selection.choiceIndex]
  if (!chosen || chosen.skillId !== selection.skillId) return null
  const maximum = SHARED_STAT_BOOK.entries[chosen.skillId]?.maximumLevel ?? 0
  const rank = skillBook.permanentRanks[chosen.skillId] ?? 0
  const weldBuild = chosen.weldBuildId === undefined
    ? null
    : nativeWeldBuild(chosen.weldBuildId)
  if (chosen.skillId === SPELL_WELDING_SKILL_ID) {
    if (!weldBuild || rank > 0 || chosen.targetRank !== 1) return null
  } else if (
    chosen.weldBuildId !== undefined
    || maximum < 1
    || rank >= maximum
    || chosen.targetRank !== rank + 1
  ) return null

  const permanentRanks = [...skillBook.permanentRanks]
  const effectiveRanks = [...skillBook.effectiveRanks]
  const nextRank = chosen.skillId === SPELL_WELDING_SKILL_ID ? 1 : rank + 1
  permanentRanks[chosen.skillId] = nextRank
  effectiveRanks[chosen.skillId] = nextRank
  const nextBook: PlayerSkillBookComponent = {
    ...skillBook,
    activeWeldBuildId: weldBuild?.id ?? skillBook.activeWeldBuildId,
    permanentRanks: Object.freeze(permanentRanks),
    effectiveRanks: Object.freeze(effectiveRanks),
    secondaryBelt: rank === 0 && nativeSkillCategory(chosen.skillId) === 2
      ? autofillSecondaryBelt(skillBook.secondaryBelt, chosen.skillId)
      : skillBook.secondaryBelt,
  }
  let nextProgression: PlayerProgressionComponent = {
    ...progression,
    forcedOfferSkillIds: Object.freeze([]),
    pendingLevels: Object.freeze(progression.pendingLevels.slice(1)),
    pendingOffer: null,
    revision: progression.revision + 1,
    sorcerorsCharmAvailable: false,
  }
  nextProgression = refreshWeldOfferMarker(nextProgression, nextBook)
  if (nextProgression.pendingLevels.length > 0) {
    nextProgression = withNextSkillOffer(
      nextProgression,
      nextBook,
      sorcerorsCharmOwned,
    )
  }
  return { progression: nextProgression, skillBook: nextBook }
}

export function rerollPlayerSkillOffer(
  progression: PlayerProgressionComponent,
  skillBook: PlayerSkillBookComponent,
  offerSequence: number,
  nextOfferSeed: number,
): PlayerProgressionComponent | null {
  if (
    !progression.sorcerorsCharmAvailable
    || progression.pendingOffer?.sequence !== offerSequence
  ) return null
  if (!Number.isInteger(nextOfferSeed) || nextOfferSeed < 0 || nextOfferSeed >= 1_000_000) {
    throw new RangeError('player offer seed must be an integer from 0 through 999999')
  }
  return withNextSkillOffer({
    ...progression,
    offerSeed: nextOfferSeed,
    pendingOffer: null,
    sorcerorsCharmAvailable: false,
  }, skillBook, false)
}

export function deferPlayerSkillChoice(
  progression: PlayerProgressionComponent,
  skillBook: PlayerSkillBookComponent,
  offerSequence: number,
  sorcerorsCharmOwned: boolean,
): PlayerProgressionComponent | null {
  if (
    !sorcerorsCharmOwned
    || !progression.sorcerorsCharmAvailable
    || progression.pendingOffer?.sequence !== offerSequence
  ) return null
  let next: PlayerProgressionComponent = {
    ...progression,
    deferredSkillChoices: progression.deferredSkillChoices + 1,
    pendingLevels: Object.freeze(progression.pendingLevels.slice(1)),
    pendingOffer: null,
    revision: progression.revision + 1,
    sorcerorsCharmAvailable: false,
  }
  if (next.pendingLevels.length > 0) {
    next = withNextSkillOffer(next, skillBook, true)
  }
  return next
}

export function buildPlayerSkillOffer(
  progression: Pick<PlayerProgressionComponent,
    | 'disciplineOfferBias'
    | 'excludeActiveWeldBuildFromOffers'
    | 'forcedOfferSkillIds'
    | 'level'
    | 'maximumMana'
    | 'offerCycle'
    | 'offerSeed'
    | 'weldOfferMarker'
    | 'weldingOfferBias'
  >,
  skillBook: PlayerSkillBookComponent,
  sequence: number,
): PlayerSkillOffer {
  let rng = createNativeRng(progression.offerSeed)
  const desired = learned(skillBook, 63) ? 4 : 3
  const categoryOneOwned = countOwnedCategory(skillBook, 1)
  const categoryTwoOwned = countOwnedCategory(skillBook, 2)

  let focusCategoryOne = progression.level < 5
    || (categoryOneOwned > 1 && progression.level < 10)
  ;({ rng, enabled: focusCategoryOne } = drawFocus(
    rng,
    2,
    (value) => value !== 0,
    focusCategoryOne,
  ))
  if (categoryOneOwned > 1) {
    ;({ rng, enabled: focusCategoryOne } = drawFocus(
      rng,
      4,
      (value) => value !== 1,
      focusCategoryOne,
    ))
  }

  let focusCategoryTwo = false
  if (!progression.disciplineOfferBias) {
    if (categoryTwoOwned > 1) {
      ;({ rng, enabled: focusCategoryTwo } = drawFocus(
        rng,
        2,
        (value) => value !== 1,
        focusCategoryTwo,
      ))
    }
    if (categoryTwoOwned > 2) {
      ;({ rng, enabled: focusCategoryTwo } = drawFocus(
        rng,
        3,
        (value) => value !== 1,
        focusCategoryTwo,
      ))
    }
    if (categoryTwoOwned > 3) {
      ;({ rng, enabled: focusCategoryTwo } = drawFocus(
        rng,
        6,
        (value) => value !== 2,
        focusCategoryTwo,
      ))
    }
    focusCategoryTwo ||= (categoryTwoOwned > 0 && progression.level < 9)
      || (categoryTwoOwned > 1 && progression.level < 16)
      || (categoryTwoOwned > 2 && progression.level < 26)
      || (categoryTwoOwned > 3 && progression.level < 36)
  }

  let rootPriority: number[] = []
  let general: number[] = []
  for (let skillId = 8; skillId <= 79; skillId += 1) {
    if (
      skillId === SPELL_WELDING_SKILL_ID
      || !isEligible(skillId, progression.level, skillBook)
    ) continue
    const rule = RULES[skillId]!
    const rank = skillBook.effectiveRanks[skillId] ?? 0
    const focusedOut = (focusCategoryOne && rule.category === 1 && rank === 0)
      || (focusCategoryTwo && rule.category === 2 && rank === 0)
    const rootMatch = rule.root === skillBook.elementRoot || rule.root === skillBook.disciplineRoot
    if (
      rootMatch
      && (!focusedOut || (rule.category === 2 && skillBook.disciplineRoot === 7))
      && (rule.category !== 2 || manaCost(skillId, rank + 1) <= progression.maximumMana)
    ) rootPriority.push(skillId)
    const generalMatch = !rootMatch
      || (progression.disciplineOfferBias && rule.root === skillBook.disciplineRoot)
    if (
      generalMatch
      && !focusedOut
      && (rule.category !== 2 || manaCost(skillId, progression.level + 1) <= progression.maximumMana)
    ) {
      const weight = progression.disciplineOfferBias && rule.root === skillBook.disciplineRoot
        ? 2
        : 1
      for (let copy = 0; copy < weight; copy += 1) general.push(skillId)
    }
  }

  ;({ values: general, rng } = fullRangeShuffle(general, rng))
  const selected: PlayerSkillOfferOption[] = []
  for (const skillId of progression.forcedOfferSkillIds.slice(0, desired)) {
    if (
      skillId >= 8
      && skillId <= 79
      && skillId !== SPELL_WELDING_SKILL_ID
      && hasDependenciesAndUnlock(skillId, skillBook)
    ) selected.push(offerOption(skillId, skillBook))
  }
  if (rootPriority.length > 0 && selected.length < desired) {
    let priorityPool = rootPriority
    if (progression.weldingOfferBias) {
      const biasDraw = drawNativeInteger(rng, 2)
      rng = biasDraw.state
      if (biasDraw.value === 1) {
        priorityPool = weldingRelatedSkillPool(skillBook, progression.level)
      }
    }
    const draw = drawNativeInteger(rng, priorityPool.length)
    rng = draw.state
    selected.push(offerOption(priorityPool[draw.value]!, skillBook))
  }

  if (selected.length < desired) {
    const welding = drawSpellWeldingOption(progression, skillBook, rng)
    rng = welding.rng
    if (welding.option) selected.push(welding.option)
  }

  const ownedCount = skillBook.permanentRanks.slice(8, 82).filter((rank) => rank > 0).length
  let keepStarted = false
  if (ownedCount > 8) {
    const draw = drawNativeInteger(rng, 2)
    rng = draw.state
    keepStarted = draw.value === 1
  }
  if (ownedCount > 12) {
    const draw = drawNativeInteger(rng, 5)
    rng = draw.state
    keepStarted = draw.value !== 2
  }
  if (ownedCount > 20) {
    const draw = drawNativeInteger(rng, 10)
    rng = draw.state
    keepStarted = draw.value !== 2
  }
  if (keepStarted) {
    rootPriority = rootPriority.filter((id) => isStartedOrDependent(id, skillBook))
    general = general.filter((id) => isStartedOrDependent(id, skillBook))
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      if (!isStartedOrDependent(selected[index]!.skillId, skillBook)) selected.splice(index, 1)
    }
  }

  general.push(...rootPriority)
  let attempts = 0
  let categoryOneCollisions = 0
  while (selected.length < desired && general.length > 0 && attempts < 200) {
    attempts += 1
    if (attempts === 100) {
      for (let skillId = 8; skillId <= 79; skillId += 1) {
        if (
          skillId !== SPELL_WELDING_SKILL_ID
          && isEligible(skillId, progression.level, skillBook)
        ) general.push(skillId)
      }
    }
    const draw = drawNativeInteger(rng, general.length)
    rng = draw.state
    const skillId = general[draw.value]!
    const category = RULES[skillId]?.category
    if (
      category === 4
      && selected.some((option) => RULES[option.skillId]?.category === 4)
    ) continue
    if (
      category === 1
      && selected.some((option) => RULES[option.skillId]?.category === 1)
      && categoryOneCollisions < 50
    ) {
      categoryOneCollisions += 1
      continue
    }
    selected.push(offerOption(skillId, skillBook))
  }

  let options: PlayerSkillOfferOption[]
  ;({ values: options, rng } = fullRangeShuffle(selected, rng))
  void rng
  return { level: progression.level, options: Object.freeze(options), sequence }
}

function offerOption(skillId: number, skillBook: PlayerSkillBookComponent): PlayerSkillOfferOption {
  return {
    skillId,
    targetRank: (skillBook.permanentRanks[skillId] ?? 0) + 1,
  }
}

function drawSpellWeldingOption(
  progression: Pick<PlayerProgressionComponent,
    | 'excludeActiveWeldBuildFromOffers'
    | 'level'
    | 'offerCycle'
    | 'weldOfferMarker'
  >,
  skillBook: PlayerSkillBookComponent,
  initialRng: NativeRngState,
): { option: PlayerSkillOfferOption | null; rng: NativeRngState } {
  if (
    progression.weldOfferMarker > 999
    || !isSpellWeldingEligible(progression.level, skillBook)
  ) return { option: null, rng: initialRng }

  const cyclesSinceMarker = (progression.offerCycle - progression.weldOfferMarker) >>> 0
  if (
    cyclesSinceMarker % 5 !== 0
    && progression.offerCycle > progression.weldOfferMarker + 1
  ) return { option: null, rng: initialRng }

  const candidates = NATIVE_WELD_BUILDS.filter((build) => (
    build.primarySkillIds.every((skillId) => learned(skillBook, skillId))
    && (!progression.excludeActiveWeldBuildFromOffers
      || build.id !== skillBook.activeWeldBuildId)
  ))
  if (candidates.length === 0) return { option: null, rng: initialRng }
  const draw = drawNativeInteger(initialRng, candidates.length)
  const build = candidates[draw.value]!
  return {
    option: {
      skillId: SPELL_WELDING_SKILL_ID,
      targetRank: 1,
      weldBuildId: build.id,
    },
    rng: draw.state,
  }
}

function weldingRelatedSkillPool(
  skillBook: PlayerSkillBookComponent,
  level: number,
): number[] {
  const related: number[] = []
  for (const shouldBeLearned of [true, false]) {
    for (const primarySkillId of ELEMENTAL_PRIMARY_SKILL_IDS) {
      if (learned(skillBook, primarySkillId) !== shouldBeLearned) continue
      related.push(primarySkillId)
      for (const skillId of WELDING_RELATED_SKILLS[primarySkillId]!) {
        if (isEligible(skillId, level, skillBook)) related.push(skillId)
      }
    }
    if (related.length >= 6) break
  }
  return related
}

function refreshWeldOfferMarker(
  progression: PlayerProgressionComponent,
  skillBook: PlayerSkillBookComponent,
): PlayerProgressionComponent {
  if (
    progression.weldOfferMarker < 1_001
    || !isSpellWeldingEligible(progression.level, skillBook)
  ) return progression
  return { ...progression, weldOfferMarker: progression.offerCycle }
}

function withNextSkillOffer(
  progression: PlayerProgressionComponent,
  skillBook: PlayerSkillBookComponent,
  sorcerorsCharmAvailable: boolean,
): PlayerProgressionComponent {
  if (progression.pendingLevels.length === 0) return progression
  const sequence = progression.revision + 1
  const offerCycle = (progression.offerCycle + 1) >>> 0
  const offerProgression = { ...progression, offerCycle }
  return {
    ...progression,
    offerCycle,
    pendingOffer: buildPlayerSkillOffer(offerProgression, skillBook, sequence),
    revision: sequence,
    sorcerorsCharmAvailable,
  }
}

function learned(book: PlayerSkillBookComponent, id: number, rank = 1): boolean {
  return (book.permanentRanks[id] ?? 0) >= rank
}

function countOwnedCategory(book: PlayerSkillBookComponent, category: number): number {
  let count = 0
  for (let id = 8; id <= 79; id += 1) {
    if (RULES[id]?.category === category && learned(book, id)) count += 1
  }
  return count
}

function isEligible(id: number, level: number, book: PlayerSkillBookComponent): boolean {
  const rule = RULES[id]
  const entry = SHARED_STAT_BOOK.entries[id]
  if (!rule || !entry || entry.maximumLevel < 1) return false
  if (!hasDependenciesAndUnlock(id, book)) return false
  if ((book.permanentRanks[id] ?? 0) >= entry.maximumLevel) return false
  const requirementReduction = learned(book, 63) ? 2 : 0
  if (!learned(book, id) && level < Math.max(0, rule.minimumLevel - requirementReduction)) return false
  return true
}

function hasDependenciesAndUnlock(id: number, book: PlayerSkillBookComponent): boolean {
  const rule = RULES[id]
  if (!rule) return false
  if (
    id >= 72
    && id <= 79
    && !book.advancedUnlocks[id - 72]
    && !(id === 72 && book.secondaryBelt.includes(72))
  ) return false
  if (rule.all?.some((required) => !learned(book, required))) return false
  if (rule.any && !rule.any.some((required) => learned(book, required))) return false
  if (rule.forbidden?.some((required) => learned(book, required))) return false
  return true
}

function autofillSecondaryBelt(
  source: PlayerSecondaryAbilityBelt,
  skillId: number,
): PlayerSecondaryAbilityBelt {
  if (source.includes(skillId as NativeSecondaryAbilityId)) return source
  const slot = source.indexOf(null)
  if (slot < 0) return source
  const belt = [...source]
  belt[slot] = skillId as NativeSecondaryAbilityId
  return freezeSecondaryBelt(belt)
}

function freezeSecondaryBelt(
  entries: readonly (NativeSecondaryAbilityId | null)[],
): PlayerSecondaryAbilityBelt {
  if (entries.length !== 8) throw new RangeError('secondary belt requires exactly eight slots')
  return Object.freeze([...entries]) as PlayerSecondaryAbilityBelt
}

function isSpellWeldingEligible(level: number, book: PlayerSkillBookComponent): boolean {
  return (book.permanentRanks[SPELL_WELDING_SKILL_ID] ?? 0) < 1
    && isEligible(SPELL_WELDING_SKILL_ID, level, book)
    && ELEMENTAL_PRIMARY_SKILL_IDS.filter((skillId) => learned(book, skillId)).length > 1
}

function manaCost(id: number, rank: number): number {
  const value = CATALOG.skills[id]?.config?.mManaCost
  if (typeof value === 'number') return value
  if (!Array.isArray(value) || value.length === 0) return 0
  return value[Math.min(Math.max(0, rank), value.length - 1)] ?? 0
}

function rankedNativeSkillValue(
  value: number | readonly number[] | undefined,
  rank: number,
  field: string,
): number {
  const ranked = typeof value === 'number' ? value : value?.[rank]
  if (ranked === undefined || !Number.isFinite(ranked)) {
    throw new RangeError(`native skill catalog is missing ${field} rank ${rank}`)
  }
  return ranked
}

function isStartedOrDependent(id: number, book: PlayerSkillBookComponent): boolean {
  if ((book.effectiveRanks[id] ?? 0) > 0) return true
  const firstRequired = RULES[id]?.all?.[0]
  return firstRequired !== undefined && learned(book, firstRequired)
}

function drawFocus(
  rng: NativeRngState,
  bound: number,
  predicate: (value: number) => boolean,
  enabled: boolean,
): { enabled: boolean; rng: NativeRngState } {
  const draw = drawNativeInteger(rng, bound)
  return { enabled: enabled || predicate(draw.value), rng: draw.state }
}

function fullRangeShuffle<T>(
  source: readonly T[],
  initialRng: NativeRngState,
): { rng: NativeRngState; values: T[] } {
  const values = [...source]
  let rng = initialRng
  for (let index = 0; index < values.length; index += 1) {
    const draw = drawNativeInteger(rng, values.length)
    rng = draw.state
    ;[values[index], values[draw.value]] = [values[draw.value]!, values[index]!]
  }
  return { rng, values }
}

function createSkillRules(): Readonly<Record<number, SkillRule>> {
  const rules: Record<number, SkillRule> = {}
  const add = (
    id: number,
    minimumLevel: number,
    root: number,
    category: number,
    dependencies: Pick<SkillRule, 'all' | 'any' | 'forbidden'> = {},
  ) => { rules[id] = { category, minimumLevel, root, ...dependencies } }
  add(8, 1, 0, 1); add(9, 1, 0, 0, { all: [8] }); add(10, 1, 0, 0, { all: [8] })
  add(11, 3, 0, 2); add(12, 25, 0, 2); add(13, 20, 0, 4, { all: [9], forbidden: [14] })
  add(14, 20, 0, 4, { all: [9], forbidden: [13] }); add(15, 6, 0, 2)
  add(16, 1, 1, 1); add(17, 1, 1, 0, { all: [18] }); add(18, 1, 1, 0, { all: [16] })
  add(19, 20, 1, 4, { all: [17], forbidden: [20] }); add(20, 20, 1, 4, { all: [17], forbidden: [19] })
  add(21, 4, 1, 2); add(22, 12, 1, 0, { any: [16, 21, 23] }); add(23, 8, 1, 2)
  add(24, 1, 2, 1); add(25, 1, 2, 0, { all: [24] }); add(26, 1, 2, 0, { all: [24] })
  add(27, 1, 2, 2); add(28, 12, 2, 0, { all: [27] }); add(29, 20, 2, 4, { all: [25], forbidden: [31] })
  add(30, 12, 2, 2, { any: [24, 27] }); add(31, 20, 2, 4, { all: [25], forbidden: [29] })
  add(32, 1, 3, 1); add(33, 1, 3, 0, { all: [32] }); add(34, 1, 3, 0, { all: [32] })
  add(35, 1, 3, 2); add(36, 20, 3, 4, { all: [33], forbidden: [37] }); add(37, 20, 3, 4, { all: [33], forbidden: [36] })
  add(38, 18, 3, 0, { all: [34] }); add(39, 16, 3, 0, { any: [32, 35] })
  add(40, 1, 4, 1); add(41, 3, 4, 2); add(42, 1, 4, 0, { all: [40] }); add(43, 1, 4, 0, { all: [40] })
  add(44, 20, 4, 4, { all: [43], forbidden: [47] }); add(45, 6, 4, 2); add(46, 25, 4, 2)
  add(47, 20, 4, 4, { all: [43], forbidden: [44] })
  add(48, 1, 7, 2); add(49, 1, 7, 2); add(50, 1, 7, 2); add(51, 18, 7, 2)
  add(52, 1, 7, 1); add(53, 8, 7, 0); add(54, 4, 7, 2); add(55, 10, 7, 0, { all: [54] })
  add(56, 1, 6, 0); add(57, 1, 6, 3); add(58, 8, 6, 3); add(59, 5, 6, 3)
  add(60, 8, 6, 3); add(61, 25, 6, 3, { all: [59] }); add(62, 18, 6, 3); add(63, 12, 6, 3)
  add(64, 1, 5, 0); add(65, 1, 5, 3); add(66, 10, 5, 3); add(67, 1, 5, 3)
  add(68, 10, 5, 3, { all: [71] }); add(69, 6, 5, 3); add(70, 25, 5, 3)
  add(71, 5, 5, 3, { all: [65] })
  add(72, 1, 2, 2); add(73, 5, 1, 2); add(74, 10, 0, 2)
  add(75, 10, 4, 0, { all: [45] }); add(76, 10, 3, 2); add(77, 6, 7, 2)
  add(78, 10, 6, 2); add(79, 10, 5, 2)
  return Object.freeze(rules)
}

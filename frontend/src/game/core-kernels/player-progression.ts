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
import {
  createNativeHagathaRuntimeState,
  nativeHagathaRevelationRank,
  type NativeHagathaRuntimeState,
} from './native-hagatha-effects.ts'
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
export const RETAIL_BONEYARD_EXPERIENCE_RECIPE_SCALAR = 0.425
export const NATIVE_DAMAGE_X4_BONUS_TICKS = 1_500
export const NATIVE_DAMAGE_X4_POTION_TICKS = 6_000
export const NATIVE_MIND_CHUG_TICKS = 6_000
export const NATIVE_ANTIDOTE_IMMUNITY_TICKS = 1_000
export const NATIVE_CONCENTRATION_SKILL_IDS = [
  57, 58, 59, 60, 61, 62, 63,
  65, 66, 67, 68, 69, 70, 71,
] as const

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
  readonly entries: readonly NativeSkillStatBookEntry[]
}

export interface NativePrimarySkillRankStats {
  readonly damageMaximum: number
  readonly damageMinimum: number
  readonly manaCost: number
  readonly rank: number
  readonly skillId: number
}

export type NativePlayerPrimarySkillId = 8 | 16 | 24 | 32 | 40 | 52
export type NativeConcentrationSkillId = typeof NATIVE_CONCENTRATION_SKILL_IDS[number]
export type NativeBeltSkillId =
  | NativePlayerPrimarySkillId
  | NativeSecondaryAbilityId
  | NativeConcentrationSkillId

export interface NativeSecondaryAbilityRankStats {
  readonly rank: number
  readonly skillId: NativeSecondaryAbilityId
  readonly values: Readonly<Record<string, number>>
}

export interface PlayerSkillBookComponent {
  readonly advancedUnlocks: readonly boolean[]
  readonly disciplineRoot: number
  readonly effectiveRanks: readonly number[]
  readonly elementRoot: number
  readonly learnedSkillOrder: readonly number[]
  readonly permanentRanks: readonly number[]
  readonly primarySkillId: NativePlayerPrimarySkillId
  readonly weldBuildId: number | null
  readonly weldComponentRanks: NativeWeldComponentRanks | null
}

export type NativeWeldComponentRanks = readonly [number, number, number, number, number, number]

export interface PlayerSkillOfferOption {
  readonly insight?: true
  readonly skillId: number
  readonly targetRank: number
  readonly weldBuildId?: number
}

export interface PlayerSkillOffer {
  readonly automaticChoiceIndex?: number
  readonly level: number
  readonly options: readonly PlayerSkillOfferOption[]
  readonly sequence: number
}

export interface PlayerSkillOfferBuildResult {
  readonly offer: PlayerSkillOffer
  readonly rng: NativeRngState
}

export interface PlayerProgressionRngResult {
  readonly progression: PlayerProgressionComponent
  readonly rng: NativeRngState
}

export interface PlayerSkillChoiceApplyResult extends PlayerProgressionRngResult {
  readonly skillBook: PlayerSkillBookComponent
}

export function setAutomaticPlayerSkillChoice(
  source: PlayerProgressionComponent,
  choiceIndex: number,
): PlayerProgressionComponent | null {
  const offer = source.pendingOffer
  if (!offer || !Number.isSafeInteger(choiceIndex)
    || choiceIndex < 0 || choiceIndex >= offer.options.length) return null
  return offer.automaticChoiceIndex === choiceIndex
    ? source
    : {
        ...source,
        pendingOffer: Object.freeze({ ...offer, automaticChoiceIndex: choiceIndex }),
        revision: source.revision + 1,
      }
}

export interface PlayerProgressionComponent extends PlayerCombatComponent {
  readonly deferredSkillChoices: number
  readonly damageX4TicksRemaining: number
  readonly disciplineOfferBias: boolean
  readonly excludeActiveWeldBuildFromOffers: boolean
  readonly experience: number
  readonly forcedOfferSkillIds: readonly number[]
  readonly hagathaRuntime: NativeHagathaRuntimeState
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
  readonly colorRoots: readonly [number, number]
  readonly componentSkillIds: readonly [number, number, number, number, number, number]
  readonly id: number
  readonly pairDescription: string
  readonly primarySkillIds: readonly [number, number]
  readonly skillsAtlasIconRecord: number
  readonly syntheticName: string
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

export interface NativeRandomSkillIncreaseResult {
  readonly rng: NativeRngState
  readonly skillBook: PlayerSkillBookComponent
  readonly skillId: number | null
}

export interface NativeWeirdCasterGrantResult extends NativeRandomSkillIncreaseResult {}

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
const STARTING_SKILLS: Readonly<Record<
  WizardElement,
  readonly [NativePlayerPrimarySkillId, NativeSecondaryAbilityId]
>> = {
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

const defineNativeWeldBuild = (build: NativeWeldBuild): NativeWeldBuild => Object.freeze(build)

// Skills.108..117 are the ten authored Weld sprites. The retail compact-display
// resolver aliases Skills.81..90, which overlap ordinary skills and are not a
// second Weld-art domain.
export const NATIVE_WELD_BUILDS: readonly NativeWeldBuild[] = Object.freeze([
  defineNativeWeldBuild({ colorRoots: [0, 1], componentSkillIds: [8, 16, 10, 18, 9, 17], id: 1000, pairDescription: 'Welded Magic Missile + Fireball', primarySkillIds: [8, 16], skillsAtlasIconRecord: 108, syntheticName: 'Burning Bolt' }),
  defineNativeWeldBuild({ colorRoots: [0, 3], componentSkillIds: [8, 32, 10, 34, 9, 33], id: 1001, pairDescription: 'Welded Magic Missile + Frost Jet', primarySkillIds: [8, 32], skillsAtlasIconRecord: 109, syntheticName: 'Frost Missile' }),
  defineNativeWeldBuild({ colorRoots: [0, 2], componentSkillIds: [8, 24, 10, 25, 9, 26], id: 1002, pairDescription: 'Welded Magic Missile + Lightning', primarySkillIds: [8, 24], skillsAtlasIconRecord: 110, syntheticName: 'Ball Lightning' }),
  defineNativeWeldBuild({ colorRoots: [2, 1], componentSkillIds: [16, 24, 18, 25, 17, 26], id: 1003, pairDescription: 'Welded Lighting + Fireball', primarySkillIds: [16, 24], skillsAtlasIconRecord: 111, syntheticName: 'Flame Lash' }),
  defineNativeWeldBuild({ colorRoots: [2, 3], componentSkillIds: [32, 24, 34, 25, 33, 26], id: 1004, pairDescription: 'Welded Lightning + Frost Jet', primarySkillIds: [32, 24], skillsAtlasIconRecord: 112, syntheticName: 'Blizzard Beam' }),
  defineNativeWeldBuild({ colorRoots: [3, 1], componentSkillIds: [16, 32, 18, 34, 17, 33], id: 1005, pairDescription: 'Welded Fireball + Frost Jet', primarySkillIds: [16, 32], skillsAtlasIconRecord: 113, syntheticName: 'Steam Jet' }),
  defineNativeWeldBuild({ colorRoots: [0, 4], componentSkillIds: [8, 40, 10, 43, 9, 42], id: 1006, pairDescription: 'Welded Magic Missile + Boulder', primarySkillIds: [8, 40], skillsAtlasIconRecord: 114, syntheticName: 'Ethereal Boulder' }),
  defineNativeWeldBuild({ colorRoots: [4, 1], componentSkillIds: [16, 40, 18, 43, 17, 42], id: 1007, pairDescription: 'Welded Fireball + Boulder', primarySkillIds: [16, 40], skillsAtlasIconRecord: 115, syntheticName: 'Meteor Swarm' }),
  defineNativeWeldBuild({ colorRoots: [4, 3], componentSkillIds: [32, 40, 34, 43, 33, 42], id: 1008, pairDescription: 'Welded Frost Jet + Boulder', primarySkillIds: [32, 40], skillsAtlasIconRecord: 116, syntheticName: 'Hailstones' }),
  defineNativeWeldBuild({ colorRoots: [4, 2], componentSkillIds: [24, 40, 25, 43, 26, 42], id: 1009, pairDescription: 'Welded Lightning + Boulder', primarySkillIds: [24, 40], skillsAtlasIconRecord: 117, syntheticName: 'Crawling Shock' }),
])

export const NATIVE_WELD_COMPONENT_SKILL_IDS: readonly number[] = Object.freeze([
  ...new Set(NATIVE_WELD_BUILDS.flatMap(({ componentSkillIds }) => (
    componentSkillIds.filter((skillId) => !ELEMENTAL_PRIMARY_SKILL_IDS.includes(
      skillId as typeof ELEMENTAL_PRIMARY_SKILL_IDS[number],
    ))
  ))),
].sort((left, right) => left - right))

const CATALOG = nativeCatalogJson as unknown as NativeSkillCatalogJson
export const NATIVE_SKILL_CATALOG = CATALOG.skills

const SHARED_STAT_BOOK: PlayerStatBookComponent = Object.freeze({
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

export function nativeSkillMinimumLevel(skillId: number): number {
  const rule = RULES[skillId]
  if (!rule) throw new RangeError(`native skill ${skillId} has no level rule`)
  return rule.minimumLevel
}

export function playerStatBook(): PlayerStatBookComponent {
  return SHARED_STAT_BOOK
}

export function nativeSkillCategory(skillId: number): number | null {
  return RULES[skillId]?.category ?? null
}

export function isNativeBeltSkill(skillId: number): skillId is NativeBeltSkillId {
  const category = nativeSkillCategory(skillId)
  return category === 1 || category === 2 || category === 3
}

export function nativeSkillRoot(skillId: number): number | null {
  return RULES[skillId]?.root ?? (skillId === 80 ? 0 : null)
}

/** Native Skills_Wizard row-colour ownership (`vftable +0x90`, 0x00660CE0). */
export function nativeSkillColorRoot(skillId: number): number | null {
  if (Number.isSafeInteger(skillId) && skillId >= 0 && skillId <= 7) return skillId
  return nativeSkillRoot(skillId)
}

export function nativeSkillDependencies(skillId: number): readonly number[] {
  const rule = RULES[skillId]
  if (!rule) throw new RangeError(`native skill ${skillId} has no dependency rule`)
  return Object.freeze([...new Set([...(rule.all ?? []), ...(rule.any ?? [])])])
}

export function effectivePrimarySkillRankStats(
  skillBook: PlayerSkillBookComponent,
): NativePrimarySkillRankStats {
  return effectiveElementalPrimarySkillRankStats(skillBook, skillBook.primarySkillId)
}

export function effectiveElementalPrimarySkillRankStats(
  skillBook: PlayerSkillBookComponent,
  skillId: number,
): NativePrimarySkillRankStats {
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

export function selectPlayerPrimarySkill(
  skillBook: PlayerSkillBookComponent,
  skillId: number,
): PlayerSkillBookComponent {
  if (nativeSkillCategory(skillId) !== 1) {
    throw new RangeError(`skill ${skillId} is not a native primary attack`)
  }
  if ((skillBook.permanentRanks[skillId] ?? 0) < 1) {
    throw new Error(`primary skill ${skillId} is not learned`)
  }
  if (skillId === SPELL_WELDING_SKILL_ID && skillBook.weldBuildId === null) {
    throw new Error('Spell Welding has no learned native build')
  }
  return skillBook.primarySkillId === skillId
    ? skillBook
    : { ...skillBook, primarySkillId: skillId as NativePlayerPrimarySkillId }
}

export function activePlayerWeldBuildId(
  skillBook: PlayerSkillBookComponent,
): number | null {
  return skillBook.primarySkillId === SPELL_WELDING_SKILL_ID
    ? skillBook.weldBuildId
    : null
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

export function nativeSkillIconRecord(
  skillId: number,
  weldBuildId: number | null = null,
): number {
  const skill = NATIVE_SKILL_CATALOG[skillId]
  if (!skill) throw new RangeError(`native skill ${skillId} has no Skills icon`)
  if (skillId !== SPELL_WELDING_SKILL_ID || weldBuildId === null) {
    return skill.skills_atlas_icon_record
  }
  const build = nativeWeldBuild(weldBuildId)
  if (!build) throw new RangeError(`native Weld build ${weldBuildId} has no Skills icon`)
  return build.skillsAtlasIconRecord
}

export function nativeWeldComponentRanksForBuild(
  ranks: readonly number[],
  build: NativeWeldBuild,
): NativeWeldComponentRanks {
  return Object.freeze(build.componentSkillIds.map((skillId) => {
    const rank = ranks[skillId] ?? 0
    if (!Number.isInteger(rank) || rank < 0 || rank > 255) {
      throw new RangeError(`weld component ${skillId} has invalid rank ${String(rank)}`)
    }
    return rank
  }) as unknown as NativeWeldComponentRanks)
}

export function createPlayerSkillBook(config: PlayerCharacterConfig): PlayerSkillBookComponent {
  const elementRoot = ELEMENT_ROOT[config.element]
  const disciplineRoot = DISCIPLINE_ROOT[config.discipline]
  const [primarySkillId, secondarySkillId] = STARTING_SKILLS[config.element]
  const permanentRanks = new Array<number>(NATIVE_SKILL_ROW_COUNT).fill(0)
  for (let root = 0; root < 8; root += 1) permanentRanks[root] = 1
  permanentRanks[primarySkillId] = 1
  permanentRanks[secondarySkillId] = 1
  return {
    advancedUnlocks: Object.freeze(new Array<boolean>(8).fill(false)),
    disciplineRoot,
    effectiveRanks: Object.freeze([...permanentRanks]),
    elementRoot,
    learnedSkillOrder: Object.freeze([primarySkillId, secondarySkillId]),
    permanentRanks: Object.freeze(permanentRanks),
    primarySkillId,
    weldBuildId: null,
    weldComponentRanks: null,
  }
}

export function unlockPlayerAdvancedSkill(
  source: PlayerSkillBookComponent,
  skillId: number,
): PlayerSkillBookComponent | null {
  if (!Number.isSafeInteger(skillId) || skillId < 72 || skillId > 79) return null
  const unlockIndex = skillId - 72
  if (source.advancedUnlocks[unlockIndex]) return null
  const advancedUnlocks = [...source.advancedUnlocks]
  advancedUnlocks[unlockIndex] = true
  return { ...source, advancedUnlocks: Object.freeze(advancedUnlocks) }
}

export function grantPlayerSkillRanks(
  source: PlayerSkillBookComponent,
  skillId: number,
  ranks: number,
): PlayerSkillBookComponent {
  if (!Number.isSafeInteger(ranks) || ranks < 1) {
    throw new RangeError('granted skill ranks must be a positive safe integer')
  }
  const maximum = SHARED_STAT_BOOK.entries[skillId]?.maximumLevel ?? 0
  if (!Number.isSafeInteger(skillId) || skillId < 8 || skillId > 79 || maximum < 1) {
    throw new RangeError(`skill ${skillId} is not a grantable native skill`)
  }
  if (skillId === SPELL_WELDING_SKILL_ID) {
    throw new RangeError('Spell Welding must be granted through a native Weld build')
  }
  const currentRank = source.permanentRanks[skillId] ?? 0
  const targetRank = Math.min(maximum, currentRank + ranks)
  const unlockIndex = skillId >= 72 ? skillId - 72 : -1
  const unlockChanged = unlockIndex >= 0 && !source.advancedUnlocks[unlockIndex]
  if (targetRank === currentRank && !unlockChanged) return source
  const permanentRanks = [...source.permanentRanks]
  const effectiveRanks = [...source.effectiveRanks]
  const advancedUnlocks = [...source.advancedUnlocks]
  permanentRanks[skillId] = targetRank
  effectiveRanks[skillId] = targetRank
  if (unlockIndex >= 0) advancedUnlocks[unlockIndex] = true
  return {
    ...source,
    advancedUnlocks: Object.freeze(advancedUnlocks),
    effectiveRanks: Object.freeze(effectiveRanks),
    learnedSkillOrder: currentRank === 0 && !source.learnedSkillOrder.includes(skillId)
      ? Object.freeze([...source.learnedSkillOrder, skillId])
      : source.learnedSkillOrder,
    permanentRanks: Object.freeze(permanentRanks),
  }
}

export function grantPlayerWeldBuild(
  source: PlayerSkillBookComponent,
  buildId: number,
): PlayerSkillBookComponent {
  const build = nativeWeldBuild(buildId)
  if (!build) throw new RangeError(`unknown native Weld build ${buildId}`)
  let next = source
  for (const skillId of build.componentSkillIds) {
    if ((next.permanentRanks[skillId] ?? 0) < 1) {
      next = grantPlayerSkillRanks(next, skillId, 1)
    }
  }
  const permanentRanks = [...next.permanentRanks]
  const effectiveRanks = [...next.effectiveRanks]
  const learned = (permanentRanks[SPELL_WELDING_SKILL_ID] ?? 0) === 0
  permanentRanks[SPELL_WELDING_SKILL_ID] = 1
  effectiveRanks[SPELL_WELDING_SKILL_ID] = 1
  return {
    ...next,
    effectiveRanks: Object.freeze(effectiveRanks),
    learnedSkillOrder: learned
      ? Object.freeze([...next.learnedSkillOrder, SPELL_WELDING_SKILL_ID])
      : next.learnedSkillOrder,
    permanentRanks: Object.freeze(permanentRanks),
    primarySkillId: SPELL_WELDING_SKILL_ID,
    weldBuildId: build.id,
    weldComponentRanks: nativeWeldComponentRanksForBuild(effectiveRanks, build),
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
    hagathaRuntime: createNativeHagathaRuntimeState(),
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

/**
 * Native fresh-player construction draws one seed in `0x006594E0`, then the
 * twelve non-disabled Create/loadout acquisitions in `0x005D0290` each replace
 * it through `0x00660320`. The last acquisition owns the first offer seed.
 */
export function drawNativePlayerCreationOfferSeed(
  sourceGameplayRng: NativeRngState,
): Readonly<{ rng: NativeRngState; seed: number }> {
  let rng = sourceGameplayRng
  let seed = 0
  for (let drawIndex = 0; drawIndex < 13; drawIndex += 1) {
    const draw = drawNativeInteger(rng, 1_000_000)
    rng = draw.state
    seed = draw.value
  }
  return { rng, seed }
}

/** Every reached `Skills_Wizard::Acquire 0x00660320` replaces `+0x834`. */
export function applyNativeSkillAcquisitionOfferSeeds(
  progression: PlayerProgressionComponent,
  sourceGameplayRng: NativeRngState,
  acquisitionCount: number,
): PlayerProgressionRngResult {
  if (!Number.isSafeInteger(acquisitionCount) || acquisitionCount < 0) {
    throw new RangeError('native skill acquisition count must be a non-negative safe integer')
  }
  let rng = sourceGameplayRng
  let offerSeed = progression.offerSeed
  for (let index = 0; index < acquisitionCount; index += 1) {
    const draw = drawNativeInteger(rng, 1_000_000)
    rng = draw.state
    offerSeed = draw.value
  }
  return {
    progression: offerSeed === progression.offerSeed
      ? progression
      : { ...progression, offerSeed },
    rng,
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

export function applyPlayerDamageX4Bonus(
  source: PlayerProgressionComponent,
): PlayerProgressionComponent {
  return {
    ...source,
    damageX4TicksRemaining: NATIVE_DAMAGE_X4_BONUS_TICKS,
    revision: source.revision + 1,
  }
}

export function applyNativeUnforgeFullRejuvenation(
  source: PlayerProgressionComponent,
): PlayerProgressionComponent {
  return {
    ...source,
    currentHealth: source.maximumHealth,
    currentMana: source.maximumMana,
    revision: source.revision + 1,
  }
}

export function grantNativeUnforgeMindDredge(
  source: PlayerProgressionComponent,
): PlayerProgressionComponent {
  return {
    ...source,
    deferredSkillChoices: source.deferredSkillChoices + 1,
    revision: source.revision + 1,
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
  sourceGameplayRng: NativeRngState,
  sorcerorsCharmOwned = false,
): PlayerProgressionRngResult {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError('experience award must be finite and non-negative')
  }
  if (amount === 0 || progression.level >= MAX_PLAYER_LEVEL) {
    const experience = Math.min(MAX_PLAYER_EXPERIENCE, progression.experience + amount)
    return {
      progression: experience === progression.experience ? progression : {
        ...progression,
        experience,
        revision: progression.revision + 1,
      },
      rng: sourceGameplayRng,
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
    return withNextSkillOffer(next, skillBook, sourceGameplayRng, sorcerorsCharmOwned)
  }
  return { progression: next, rng: sourceGameplayRng }
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

function survivalExperienceLevelFactor(level: number): number {
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
  sourceGameplayRng: NativeRngState,
  sorcerorsCharmOwned = false,
): PlayerProgressionRngResult {
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
    return withNextSkillOffer(next, skillBook, sourceGameplayRng, sorcerorsCharmOwned)
  }
  return { progression: next, rng: sourceGameplayRng }
}

export function applyPlayerSkillChoice(
  progression: PlayerProgressionComponent,
  skillBook: PlayerSkillBookComponent,
  selection: { choiceIndex: number; offerSequence: number; skillId: number },
  sourceGameplayRng: NativeRngState,
  ownedHagathaSelectors: readonly number[] = [],
): PlayerSkillChoiceApplyResult | null {
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
    if (chosen.insight === true || !weldBuild || rank > 0 || chosen.targetRank !== 1) return null
  } else if (
    chosen.weldBuildId !== undefined
    || maximum < 1
    || rank >= maximum
    || (chosen.insight === true && rank + 2 > maximum)
    || chosen.targetRank !== rank + 1
  ) return null

  const permanentRanks = [...skillBook.permanentRanks]
  const effectiveRanks = [...skillBook.effectiveRanks]
  const selectedRank = chosen.skillId === SPELL_WELDING_SKILL_ID
    ? 1
    : rank + (chosen.insight === true ? 2 : 1)
  const nextRank = chosen.skillId === SPELL_WELDING_SKILL_ID
    ? selectedRank
    : Math.min(maximum, nativeHagathaRevelationRank(selectedRank, ownedHagathaSelectors))
  permanentRanks[chosen.skillId] = nextRank
  effectiveRanks[chosen.skillId] = nextRank
  const nextBook: PlayerSkillBookComponent = {
    ...skillBook,
    learnedSkillOrder: rank === 0
      ? Object.freeze([...skillBook.learnedSkillOrder, chosen.skillId])
      : skillBook.learnedSkillOrder,
    permanentRanks: Object.freeze(permanentRanks),
    primarySkillId: weldBuild === null
      ? skillBook.primarySkillId
      : SPELL_WELDING_SKILL_ID,
    effectiveRanks: Object.freeze(effectiveRanks),
    weldBuildId: weldBuild?.id ?? skillBook.weldBuildId,
    weldComponentRanks: weldBuild === null
      ? skillBook.weldComponentRanks
      : nativeWeldComponentRanksForBuild(effectiveRanks, weldBuild),
  }
  let gameplayRng = sourceGameplayRng
  const reseeded = applyNativeSkillAcquisitionOfferSeeds(
    progression,
    gameplayRng,
    chosen.insight === true ? 2 : 1,
  )
  gameplayRng = reseeded.rng
  let nextProgression: PlayerProgressionComponent = {
    ...reseeded.progression,
    forcedOfferSkillIds: Object.freeze([]),
    pendingLevels: Object.freeze(progression.pendingLevels.slice(1)),
    pendingOffer: null,
    revision: progression.revision + 1,
    sorcerorsCharmAvailable: false,
  }
  nextProgression = refreshWeldOfferMarker(nextProgression, nextBook)
  return { progression: nextProgression, rng: gameplayRng, skillBook: nextBook }
}

export function replacePlayerSkillChoiceWithMod(
  progression: PlayerProgressionComponent,
  offerSequence: number,
  sourceGameplayRng: NativeRngState,
): PlayerProgressionRngResult | null {
  if (progression.pendingOffer?.sequence !== offerSequence) return null
  const next: PlayerProgressionComponent = {
    ...progression,
    forcedOfferSkillIds: Object.freeze([]),
    pendingLevels: Object.freeze(progression.pendingLevels.slice(1)),
    pendingOffer: null,
    revision: progression.revision + 1,
    sorcerorsCharmAvailable: false,
  }
  return { progression: next, rng: sourceGameplayRng }
}

export function openNextPlayerSkillOffer(
  progression: PlayerProgressionComponent,
  skillBook: PlayerSkillBookComponent,
  sourceGameplayRng: NativeRngState,
  sorcerorsCharmAvailable = false,
): PlayerProgressionRngResult {
  if (progression.pendingOffer !== null) {
    return { progression, rng: sourceGameplayRng }
  }
  return withNextSkillOffer(
    progression,
    skillBook,
    sourceGameplayRng,
    sorcerorsCharmAvailable,
  )
}

export function rerollPlayerSkillOffer(
  progression: PlayerProgressionComponent,
  skillBook: PlayerSkillBookComponent,
  offerSequence: number,
  nextOfferSeed: number,
  sourceGameplayRng: NativeRngState,
): PlayerProgressionRngResult | null {
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
  }, skillBook, sourceGameplayRng, false)
}

export function deferPlayerSkillChoice(
  progression: PlayerProgressionComponent,
  skillBook: PlayerSkillBookComponent,
  offerSequence: number,
  sourceGameplayRng: NativeRngState,
  sorcerorsCharmOwned: boolean,
): PlayerProgressionRngResult | null {
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
    return withNextSkillOffer(next, skillBook, sourceGameplayRng, true)
  }
  return { progression: next, rng: sourceGameplayRng }
}

export function grantPlayerBonusSkillChoice(
  progression: PlayerProgressionComponent,
  skillBook: PlayerSkillBookComponent,
  sourceGameplayRng: NativeRngState,
  sorcerorsCharmOwned = false,
): PlayerProgressionRngResult {
  const pendingLevels = Object.freeze([...progression.pendingLevels, progression.level])
  const queued: PlayerProgressionComponent = {
    ...progression,
    pendingLevels,
    revision: progression.pendingOffer === null
      ? progression.revision
      : progression.revision + 1,
  }
  return progression.pendingOffer === null
    ? withNextSkillOffer(queued, skillBook, sourceGameplayRng, sorcerorsCharmOwned)
    : { progression: queued, rng: sourceGameplayRng }
}

export function increaseRandomLearnedSkill(
  skillBook: PlayerSkillBookComponent,
  sourceRng: NativeRngState,
): NativeRandomSkillIncreaseResult {
  const eligible: number[] = []
  for (let skillId = 8; skillId < 82; skillId += 1) {
    const rank = skillBook.permanentRanks[skillId] ?? 0
    const maximum = SHARED_STAT_BOOK.entries[skillId]?.maximumLevel ?? 0
    if (rank > 0 && rank < maximum) eligible.push(skillId)
  }
  if (eligible.length === 0) {
    return { rng: sourceRng, skillBook, skillId: null }
  }
  const selected = drawNativeInteger(sourceRng, eligible.length)
  const skillId = eligible[selected.value]!
  const permanentRanks = [...skillBook.permanentRanks]
  const effectiveRanks = [...skillBook.effectiveRanks]
  permanentRanks[skillId] = permanentRanks[skillId]! + 1
  effectiveRanks[skillId] = effectiveRanks[skillId]! + 1
  return {
    rng: selected.state,
    skillBook: {
      ...skillBook,
      effectiveRanks: Object.freeze(effectiveRanks),
      permanentRanks: Object.freeze(permanentRanks),
    },
    skillId,
  }
}

/** Native Hagatha selector 14 purchase-time category-two grant. */
export function grantNativeWeirdCasterSkill(
  skillBook: PlayerSkillBookComponent,
  sourceRng: NativeRngState,
  ownedHagathaSelectors: readonly number[],
): NativeWeirdCasterGrantResult {
  const learnedCategoryTwoCount = NATIVE_SECONDARY_ABILITY_IDS.filter((skillId) => (
    (skillBook.permanentRanks[skillId] ?? 0) > 0
  )).length
  if (learnedCategoryTwoCount >= 2) {
    return { rng: sourceRng, skillBook, skillId: null }
  }
  const candidates = NATIVE_SECONDARY_ABILITY_IDS.filter((skillId) => (
    (skillBook.permanentRanks[skillId] ?? 0) === 0
  ))
  if (candidates.length === 0) {
    return { rng: sourceRng, skillBook, skillId: null }
  }
  const selected = drawNativeInteger(sourceRng, candidates.length)
  const skillId = candidates[selected.value]!
  const maximum = SHARED_STAT_BOOK.entries[skillId]?.maximumLevel ?? 0
  if (maximum < 1) throw new Error(`native Weird Caster row ${skillId} has no rank`)
  const grantedRank = Math.min(
    maximum,
    nativeHagathaRevelationRank(1, ownedHagathaSelectors),
  )
  const permanentRanks = [...skillBook.permanentRanks]
  const effectiveRanks = [...skillBook.effectiveRanks]
  permanentRanks[skillId] = grantedRank
  effectiveRanks[skillId] = grantedRank
  return {
    rng: selected.state,
    skillBook: {
      ...skillBook,
      effectiveRanks: Object.freeze(effectiveRanks),
      learnedSkillOrder: Object.freeze([...skillBook.learnedSkillOrder, skillId]),
      permanentRanks: Object.freeze(permanentRanks),
    },
    skillId,
  }
}

/** Native Revelation purchase refresh promotes the two creation starter rows. */
export function applyNativeRevelationToStartingSkills(
  skillBook: PlayerSkillBookComponent,
  config: Pick<PlayerCharacterConfig, 'element'>,
): PlayerSkillBookComponent {
  const permanentRanks = [...skillBook.permanentRanks]
  const effectiveRanks = [...skillBook.effectiveRanks]
  let changed = false
  for (const skillId of STARTING_SKILLS[config.element]) {
    const rank = permanentRanks[skillId] ?? 0
    const maximum = SHARED_STAT_BOOK.entries[skillId]?.maximumLevel ?? 0
    if (rank >= 2 || maximum < 2) continue
    permanentRanks[skillId] = 2
    effectiveRanks[skillId] = Math.max(2, effectiveRanks[skillId] ?? 0)
    changed = true
  }
  return changed
    ? {
        ...skillBook,
        effectiveRanks: Object.freeze(effectiveRanks),
        permanentRanks: Object.freeze(permanentRanks),
      }
    : skillBook
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
  sourceGameplayRng: NativeRngState,
): PlayerSkillOfferBuildResult {
  let rng = createNativeRng(progression.offerSeed)
  let gameplayRng = sourceGameplayRng
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
      || !nativeSkillPassesOfferEligibility(skillId, progression.level, skillBook)
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
    ) insertUniqueOfferOption(selected, offerOption(skillId, skillBook))
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
    insertUniqueOfferOption(selected, offerOption(priorityPool[draw.value]!, skillBook))
  }

  if (selected.length < desired) {
    const welding = drawSpellWeldingOption(progression, skillBook, gameplayRng)
    gameplayRng = welding.rng
    if (welding.option) insertUniqueOfferOption(selected, welding.option)
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
          && nativeSkillPassesOfferEligibility(skillId, progression.level, skillBook)
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
    insertUniqueOfferOption(selected, offerOption(skillId, skillBook))
  }

  let options: PlayerSkillOfferOption[]
  ;({ values: options, rng: gameplayRng } = fullRangeShuffle(selected, gameplayRng))
  return {
    offer: { level: progression.level, options: Object.freeze(options), sequence },
    rng: gameplayRng,
  }
}

function insertUniqueOfferOption(
  selected: PlayerSkillOfferOption[],
  option: PlayerSkillOfferOption,
): boolean {
  if (selected.some(({ skillId }) => skillId === option.skillId)) return false
  selected.push(option)
  return true
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
      || build.id !== skillBook.weldBuildId)
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
        if (nativeSkillPassesOfferEligibility(skillId, level, skillBook)) related.push(skillId)
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
  sourceGameplayRng: NativeRngState,
  sorcerorsCharmAvailable: boolean,
): PlayerProgressionRngResult {
  if (progression.pendingLevels.length === 0) {
    return { progression, rng: sourceGameplayRng }
  }
  const sequence = progression.revision + 1
  const offerCycle = (progression.offerCycle + 1) >>> 0
  const offerProgression = { ...progression, offerCycle }
  const built = buildPlayerSkillOffer(
    offerProgression,
    skillBook,
    sequence,
    sourceGameplayRng,
  )
  return {
    progression: {
      ...progression,
      offerCycle,
      pendingOffer: built.offer,
      revision: sequence,
      sorcerorsCharmAvailable,
    },
    rng: built.rng,
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

/** Native common offer gates (`0x0065EBA0` / `0x0065ED00`), before pool focus/root/cost. */
export function nativeSkillPassesOfferEligibility(
  id: number,
  level: number,
  book: PlayerSkillBookComponent,
): boolean {
  const rule = RULES[id]
  const entry = SHARED_STAT_BOOK.entries[id]
  if (!rule || !entry || entry.capLevel < 1) return false
  if (!hasDependenciesAndUnlock(id, book)) return false
  if ((book.permanentRanks[id] ?? 0) >= entry.capLevel) return false
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
    && !(id === 72 && (book.permanentRanks[72] ?? 0) > 0)
  ) return false
  if (rule.all?.some((required) => !learned(book, required))) return false
  if (rule.any && !rule.any.some((required) => learned(book, required))) return false
  if (rule.forbidden?.some((required) => learned(book, required))) return false
  return true
}

function isSpellWeldingEligible(level: number, book: PlayerSkillBookComponent): boolean {
  return (book.permanentRanks[SPELL_WELDING_SKILL_ID] ?? 0) < 1
    && nativeSkillPassesOfferEligibility(SPELL_WELDING_SKILL_ID, level, book)
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

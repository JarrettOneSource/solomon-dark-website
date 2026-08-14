import nativeCatalogJson from './native-skill-catalog.json' with { type: 'json' }

import type {
  PlayerCharacterConfig,
  WizardDiscipline,
  WizardElement,
} from './player-character.ts'
import { createNativeRng, drawNativeInteger, type NativeRngState } from './native-rng.ts'

export const NATIVE_SKILL_ROW_COUNT = 83
export const MAX_PLAYER_LEVEL = 75
export const MAX_PLAYER_EXPERIENCE = 10_000_000
export const SPELL_WELDING_SKILL_ID = 52
export const INITIAL_WELD_OFFER_MARKER = 9_999
export const SPELL_WELDING_QUICK_DESCRIPTION = 'TWO ATTACK SPELLS TO COMBINE'

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

export interface PlayerSkillBookComponent {
  readonly activeWeldBuildId: number | null
  readonly advancedUnlocks: readonly boolean[]
  readonly disciplineRoot: number
  readonly effectiveRanks: readonly number[]
  readonly elementRoot: number
  readonly permanentRanks: readonly number[]
  readonly primarySkillId: number
  readonly secondarySkillId: number
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

export interface PlayerProgressionComponent {
  readonly currentHealth: number
  readonly currentMana: number
  readonly disciplineOfferBias: boolean
  readonly excludeActiveWeldBuildFromOffers: boolean
  readonly experience: number
  readonly forcedOfferSkillIds: readonly number[]
  readonly level: number
  readonly maximumHealth: number
  readonly maximumMana: number
  readonly nextThreshold: number
  readonly offerCycle: number
  readonly offerSeed: number
  readonly pendingLevels: readonly number[]
  readonly pendingOffer: PlayerSkillOffer | null
  readonly previousThreshold: number
  readonly revision: number
  readonly weldOfferMarker: number
  readonly weldingOfferBias: boolean
}

export interface NativeWeldBuild {
  readonly id: number
  readonly primarySkillIds: readonly [number, number]
  readonly skillsAtlasIconRecord: number
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

const RULES: Readonly<Record<number, SkillRule>> = createSkillRules()

export function playerStatBook(): PlayerStatBookComponent {
  return SHARED_STAT_BOOK
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
    secondarySkillId,
  }
}

export function createPlayerProgression(offerSeed: number): PlayerProgressionComponent {
  if (!Number.isInteger(offerSeed) || offerSeed < 0 || offerSeed >= 1_000_000) {
    throw new RangeError('player offer seed must be an integer from 0 through 999999')
  }
  return {
    currentHealth: 50,
    currentMana: 100,
    disciplineOfferBias: false,
    excludeActiveWeldBuildFromOffers: false,
    experience: 0,
    forcedOfferSkillIds: Object.freeze([]),
    level: 1,
    maximumHealth: 50,
    maximumMana: 100,
    nextThreshold: NATIVE_LEVEL_THRESHOLDS[1],
    offerCycle: 0,
    offerSeed,
    pendingLevels: Object.freeze([]),
    pendingOffer: null,
    previousThreshold: NATIVE_LEVEL_THRESHOLDS[0],
    revision: 0,
    weldOfferMarker: INITIAL_WELD_OFFER_MARKER,
    weldingOfferBias: false,
  }
}

export function grantPlayerExperience(
  progression: PlayerProgressionComponent,
  skillBook: PlayerSkillBookComponent,
  amount: number,
): PlayerProgressionComponent {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError('experience award must be a non-negative safe integer')
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
  const crossed = [...progression.pendingLevels]
  while (
    level < MAX_PLAYER_LEVEL
    && experience > NATIVE_LEVEL_THRESHOLDS[level]!
  ) {
    level += 1
    crossed.push(level)
  }
  const nextThreshold = NATIVE_LEVEL_THRESHOLDS[level]!
  const previousThreshold = NATIVE_LEVEL_THRESHOLDS[level - 1]!
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
    pendingLevels: Object.freeze(crossed),
    previousThreshold,
    revision: progression.revision + 1,
  }
  if (!next.pendingOffer && crossed.length > 0) {
    next = withNextSkillOffer(next, skillBook)
  }
  return next
}

export function applyPlayerSkillChoice(
  progression: PlayerProgressionComponent,
  skillBook: PlayerSkillBookComponent,
  selection: { choiceIndex: number; offerSequence: number; skillId: number },
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
  }
  let nextProgression: PlayerProgressionComponent = {
    ...progression,
    forcedOfferSkillIds: Object.freeze([]),
    pendingLevels: Object.freeze(progression.pendingLevels.slice(1)),
    pendingOffer: null,
    revision: progression.revision + 1,
  }
  nextProgression = refreshWeldOfferMarker(nextProgression, nextBook)
  if (nextProgression.pendingLevels.length > 0) {
    nextProgression = withNextSkillOffer(nextProgression, nextBook)
  }
  return { progression: nextProgression, skillBook: nextBook }
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
): PlayerProgressionComponent {
  const level = progression.pendingLevels[0]
  if (level === undefined) return progression
  const sequence = progression.revision + 1
  const offerCycle = (progression.offerCycle + 1) >>> 0
  const offerProgression = { ...progression, level, offerCycle }
  return {
    ...progression,
    offerCycle,
    pendingOffer: buildPlayerSkillOffer(offerProgression, skillBook, sequence),
    revision: sequence,
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
    && !(id === 72 && book.secondarySkillId === 72)
  ) return false
  if (rule.all?.some((required) => !learned(book, required))) return false
  if (rule.any && !rule.any.some((required) => learned(book, required))) return false
  if (rule.forbidden?.some((required) => learned(book, required))) return false
  return true
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

import type { WizardElement } from '../../core-kernels/player-character.ts'
import {
  NATIVE_SKILL_CATALOG,
  NATIVE_WELD_BUILDS,
  SPELL_WELDING_SKILL_ID,
  nativeSkillCategory,
  type NativePlayerPrimarySkillId,
} from '../../core-kernels/player-progression.ts'
import {
  nativePrimaryCastMode,
  type NativePrimaryCastMode,
} from '../../core-kernels/native-primary-skill-profile.ts'
import {
  nativeWeldPrimaryCastMode,
  type NativeWeldBuildId,
} from '../../core-kernels/native-weld-primary-profile.ts'

export interface MlBotPrimaryCurriculumEntry {
  readonly castMode: NativePrimaryCastMode
  readonly creationElement: WizardElement
  readonly key: string
  readonly name: string
  readonly primarySkillId: NativePlayerPrimarySkillId
  readonly weldBuildId: NativeWeldBuildId | null
}

const WIZARD_ELEMENTS = new Set<WizardElement>([
  'air',
  'earth',
  'ether',
  'fire',
  'water',
])

const pureEntries = NATIVE_SKILL_CATALOG.flatMap((skill): MlBotPrimaryCurriculumEntry[] => {
  if (skill.id === SPELL_WELDING_SKILL_ID || nativeSkillCategory(skill.id) !== 1) return []
  if (!WIZARD_ELEMENTS.has(skill.family as WizardElement)) {
    throw new Error(`native primary ${skill.id} has no wizard element family`)
  }
  const primarySkillId = skill.id as NativePlayerPrimarySkillId
  return [Object.freeze({
    castMode: nativePrimaryCastMode(primarySkillId as 8 | 16 | 24 | 32 | 40),
    creationElement: skill.family as WizardElement,
    key: `primary:${skill.id}`,
    name: skill.name,
    primarySkillId,
    weldBuildId: null,
  })]
})

const weldEntries = NATIVE_WELD_BUILDS.map((build): MlBotPrimaryCurriculumEntry => {
  const firstPrimary = NATIVE_SKILL_CATALOG[build.primarySkillIds[0]]
  if (!firstPrimary || !WIZARD_ELEMENTS.has(firstPrimary.family as WizardElement)) {
    throw new Error(`native weld ${build.id} has no creation element`)
  }
  return Object.freeze({
    castMode: nativeWeldPrimaryCastMode(build.id) === 'channel' ? 'continuous' : 'one-shot',
    creationElement: firstPrimary.family as WizardElement,
    key: `weld:${build.id}`,
    name: build.syntheticName,
    primarySkillId: SPELL_WELDING_SKILL_ID,
    weldBuildId: build.id as NativeWeldBuildId,
  })
})

export const ML_BOT_PRIMARY_CURRICULUM: readonly MlBotPrimaryCurriculumEntry[] = Object.freeze([
  ...pureEntries,
  ...weldEntries,
])

const CURRICULUM_BY_KEY = new Map(ML_BOT_PRIMARY_CURRICULUM.map((entry) => [entry.key, entry]))

export function mlBotPrimaryCurriculumEntry(key: string): MlBotPrimaryCurriculumEntry {
  const entry = CURRICULUM_BY_KEY.get(key)
  if (!entry) throw new RangeError(`unknown ML bot primary curriculum entry ${key}`)
  return entry
}

export function mlBotPrimaryCurriculumEntryForSeed(seed: number): MlBotPrimaryCurriculumEntry {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError('ML bot primary curriculum seed must be a uint32')
  }
  return ML_BOT_PRIMARY_CURRICULUM[seed % ML_BOT_PRIMARY_CURRICULUM.length]!
}

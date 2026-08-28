import {
  NATIVE_SKILL_CATALOG,
  SPELL_WELDING_SKILL_ID,
  nativeSkillColorRoot,
  nativeWeldBuild,
} from '../core-kernels/player-progression.ts'
import type { ProtocolPlayerSkillOfferOption } from '../protocol/game-state.ts'
import {
  nativeSkillPageTextHeight,
  nativeSkillPageWrappedLines,
} from './skill-book-render-contract.ts'

export const SKILL_PICKER_SIZE = { height: 900, width: 1600 } as const
export const SKILL_PICKER_NATIVE_UI_RECORDS = [
  3, 10, 37, 49, 56, 57, 59, 62, 79, 107, 108, 109, 110,
] as const
export const SKILL_PICKER_CARD_RECORDS = [0, 13, 164, 5, 14] as const
export const SKILL_PICKER_ROOT_TINTS = [
  0xffe5ff,
  0xffcbcb,
  0xe5ffff,
  0xcbcbff,
  0xcbffcb,
  0xffe5cb,
  0xcbd8ff,
  0xe5e5e5,
] as const
export const SKILL_PICKER_CARD_CENTERS = {
  3: [600, 800, 1000],
  4: [500, 700, 900, 1100],
} as const
export const SKILL_PICKER_CARD_FRAME = { height: 88, width: 87, y: 382.5 } as const
export const SKILL_PICKER_ICON_ANCHOR_OFFSET = { x: 4, y: 4 } as const
export const SKILL_PICKER_ICON_INTER_DRAW_OFFSET = { x: -4, y: -4 } as const
export const SKILL_PICKER_PANEL = {
  cardHeight: 295,
  cardTop: 302.5,
  cardWidth: 200,
  height: 355,
  top: 272.5,
  widthPadding: 60,
} as const
export const SKILL_PICKER_INSIGHT_TINT = 0xd9ba70
export const SKILL_PICKER_INSIGHT_LABEL_Y = SKILL_PICKER_PANEL.top + 33
export const SKILL_PICKER_INSIGHT_PULSE_DEGREES_PER_TICK = 2
export const SKILL_PICKER_CARD_TEXT = {
  descriptionCenterY: 532.5,
  nameBaselineY: 452.5,
  textShadowOffset: 1,
  wrapWidth: 140,
} as const

const SKILL_PICKER_ROOT_LABELS = [
  ' ETHER',
  ' FIRE',
  ' AIR',
  ' WATER',
  ' EARTH',
  'BODY ',
  'MIND ',
  'ARCANE ',
] as const

export interface SkillPickerCardPresentation {
  readonly descriptionBaselineY: number
  readonly descriptionLines: readonly string[]
  readonly familyBaselineY: number
  readonly familyLabel: string
  readonly frameRecord: 5 | 14
  readonly glowTints: readonly number[]
  readonly iconRecord: number
  readonly name: string
  readonly nameBaselineY: number
  readonly nameLines: readonly string[]
  readonly quickDescription: string
  readonly root: number
  readonly rootTint: number
  readonly textShadowOffset: number
}

export interface SkillPickerPanelBounds {
  readonly height: number
  readonly left: number
  readonly top: number
  readonly width: number
}

export interface SkillPickerSpecialActionBounds {
  readonly reroll: SkillPickerPanelBounds
  readonly save: SkillPickerPanelBounds
}

export function skillPickerCardCenters(optionCount: number): readonly number[] {
  if (optionCount === 3 || optionCount === 4) return SKILL_PICKER_CARD_CENTERS[optionCount]
  throw new RangeError('native skill picker requires three or four options')
}

export function skillPickerRootTint(root: number | null): number {
  if (root === null || SKILL_PICKER_ROOT_TINTS[root] === undefined) {
    throw new RangeError(`unknown native skill root ${String(root)}`)
  }
  return SKILL_PICKER_ROOT_TINTS[root]
}

export function skillPickerCardPresentation(
  option: ProtocolPlayerSkillOfferOption,
): SkillPickerCardPresentation {
  const skill = NATIVE_SKILL_CATALOG[option.skillId]
  if (!skill) throw new RangeError(`skill picker has no catalog row ${option.skillId}`)
  const weldBuild = option.skillId === SPELL_WELDING_SKILL_ID
    ? nativeWeldBuild(option.weldBuildId ?? Number.NaN)
    : null
  if (option.skillId === SPELL_WELDING_SKILL_ID && !weldBuild) {
    throw new RangeError('Spell Welding choice has no native synthetic build')
  }
  if (option.skillId !== SPELL_WELDING_SKILL_ID && option.weldBuildId !== undefined) {
    throw new RangeError('ordinary skill choice carries a Spell Welding build')
  }
  const root = nativeSkillColorRoot(option.skillId)
  if (root === null) throw new RangeError(`skill picker row ${option.skillId} has no color root`)
  const rootTint = skillPickerRootTint(root)
  const name = weldBuild
    ? weldBuild.syntheticName
    : `${skill.name}${option.targetRank > 1 ? ` ${option.targetRank}` : ''}`.toUpperCase()
  const nameLines = nativeSkillPageWrappedLines(name)
  const quickDescription = weldBuild
    ? weldBuild.pairDescription
    : skill.config?.mQDescription ?? skill.config?.mDescription ?? ''
  if (!quickDescription) throw new RangeError(`skill picker row ${option.skillId} has no description`)
  const descriptionLines = nativeSkillPageWrappedLines(quickDescription)
  return Object.freeze({
    descriptionBaselineY: SKILL_PICKER_CARD_TEXT.descriptionCenterY
      - nativeSkillPageTextHeight(descriptionLines) / 2,
    descriptionLines,
    familyBaselineY: SKILL_PICKER_CARD_TEXT.nameBaselineY
      + nativeSkillPageTextHeight(nameLines),
    familyLabel: SKILL_PICKER_ROOT_LABELS[root]!,
    frameRecord: weldBuild ? 14 : 5,
    glowTints: Object.freeze(weldBuild
      ? weldBuild.colorRoots.map(skillPickerRootTint)
      : [rootTint]),
    iconRecord: weldBuild?.skillScreenIconRecord ?? skill.skills_atlas_icon_record,
    name,
    nameBaselineY: SKILL_PICKER_CARD_TEXT.nameBaselineY,
    nameLines,
    quickDescription,
    root,
    rootTint,
    textShadowOffset: SKILL_PICKER_CARD_TEXT.textShadowOffset,
  })
}

export function skillPickerInsightAlpha(ageTicks: number): number {
  return 0.5 + 0.5 * Math.sin(
    ageTicks * SKILL_PICKER_INSIGHT_PULSE_DEGREES_PER_TICK * Math.PI / 180,
  )
}

export function skillPickerPanelBounds(optionCount: number): SkillPickerPanelBounds {
  const width = optionCount * SKILL_PICKER_PANEL.cardWidth + SKILL_PICKER_PANEL.widthPadding
  return {
    height: SKILL_PICKER_PANEL.height,
    left: (SKILL_PICKER_SIZE.width - width) / 2,
    top: SKILL_PICKER_PANEL.top,
    width,
  }
}

export function skillPickerSpecialActionBounds(
  optionCount: number,
): SkillPickerSpecialActionBounds {
  const panel = skillPickerPanelBounds(optionCount)
  return {
    reroll: {
      height: 100,
      left: SKILL_PICKER_SIZE.width / 2 + panel.width / 2 + 40,
      top: 322.5,
      width: 255,
    },
    save: {
      height: 100,
      left: SKILL_PICKER_SIZE.width / 2 - panel.width / 2 - 140,
      top: 322.5,
      width: 255,
    },
  }
}

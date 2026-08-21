export const SKILL_PICKER_SIZE = { height: 900, width: 1600 } as const
export const SKILL_PICKER_NATIVE_UI_RECORDS = [
  3, 10, 37, 49, 56, 57, 59, 62, 79, 107, 108, 109, 110,
] as const
export const SKILL_PICKER_CARD_RECORDS = [0, 13, 164, 5] as const
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

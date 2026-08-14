export const SKILL_PICKER_SIZE = { height: 900, width: 1600 } as const
export const SKILL_PICKER_NATIVE_UI_RECORDS = [
  3, 10, 37, 49, 59, 62, 79, 107, 108, 109, 110,
] as const
export const SKILL_PICKER_CARD_RECORDS = [0, 13, 164, 5] as const
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

export function skillPickerCardCenters(optionCount: number): readonly number[] {
  if (optionCount === 3 || optionCount === 4) return SKILL_PICKER_CARD_CENTERS[optionCount]
  throw new RangeError('native skill picker requires three or four options')
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

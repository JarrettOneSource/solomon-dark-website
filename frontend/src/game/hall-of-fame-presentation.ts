import headingFontJson from '../assets/game/create-name-font-group-4.json' with { type: 'json' }
import nativeUiAssetsJson from '../assets/game/native-ui-assets.json' with { type: 'json' }

/**
 * Pure presentation kernel for the native Hall of Fame rows
 * (`HallOfFameBox::Render`, `0x005A2C80`).
 *
 * Every coordinate is box space: the box sits at (200, 80) on the 1600x900
 * stage and is 1200 wide by 695 tall. Rows are laid out from a cursor that
 * starts at `HALL_CONTENT_TOP`; the row's sprites and text go through a pen
 * shifted by `HALL_PEN_Y` (and the `HALL_PEN_X` cascade inside the expanded
 * block), while the highlight rectangle and separators use the cursor
 * directly. See
 * `Mod Loader/docs/reverse-engineering/native-hall-of-fame-and-memoratorium.md`
 * for the recovered contract and its capture proof.
 */

export type HallFont = 'body' | 'heading' | 'medium' | 'menu'
export type HallTextAlign = 'center' | 'left' | 'right'
export type HallAtlas = 'Inventory' | 'Skills' | 'UI'

export interface HallPoint {
  readonly x: number
  readonly y: number
}

export interface HallRect {
  readonly height: number
  readonly left: number
  readonly top: number
  readonly width: number
}

export interface HallTextAnchor extends HallPoint {
  readonly align: HallTextAlign
  readonly font: HallFont
}

export interface HallGlyphPlacement {
  readonly atlasX: number
  readonly atlasY: number
  readonly height: number
  readonly left: number
  readonly top: number
  readonly width: number
}

/** On-screen center of the chevron sprite after `Sprite_Draw` pixel snapping, plus its rotation. */
export interface HallChevronPlacement {
  readonly rotation: 90 | 180
  readonly x: number
  readonly y: number
}

/**
 * The native quad snap: a sprite or glyph edge at `k + 0.5` lands on pixel
 * `k + 1` (round half up). Measured on 73 stock glyphs across seven strings
 * (every quad sits on a whole pixel) and on both chevron states.
 */
export function hallRoundHalfUp(value: number): number {
  return Math.floor(value + 0.5)
}

export interface HallTextLayout {
  readonly glyphs: readonly HallGlyphPlacement[]
  readonly width: number
}

export interface HallAtlasRecord {
  readonly frame: readonly [x: number, y: number, width: number, height: number]
  readonly logicalSize: readonly [width: number, height: number]
  readonly trimOrigin: readonly [x: number, y: number]
}

export interface HallNineSlicePiece {
  readonly kind: 'corner' | 'horizontal' | 'vertical'
  readonly left: number
  readonly mirrorX: boolean
  readonly mirrorY: boolean
  readonly top: number
  readonly height: number
  readonly width: number
}

export interface HallRowLayout {
  readonly account: HallTextAnchor
  readonly awesomeness: HallTextAnchor
  readonly chevron: HallChevronPlacement
  readonly expanded: HallExpandedLayout | null
  readonly height: number
  readonly highlight: HallRect
  readonly level: HallTextAnchor
  readonly name: HallTextAnchor
  readonly ornament: HallPoint
  readonly rank: HallTextAnchor
  readonly separatorY: number
  readonly wizard: HallPoint
}

export interface HallSkillCellLayout {
  readonly center: HallPoint
  readonly numeral: HallTextAnchor
  badge(numeralWidth: number): HallRect
}

export interface HallExpandedLayout {
  readonly awesomestKill: HallTextAnchor
  readonly awesomestLabel: HallTextAnchor
  readonly highestSkills: HallTextAnchor
  readonly killsFrame: HallRect
  readonly monstersKilled: HallTextAnchor
  readonly perkCenters: readonly HallPoint[]
  readonly perksUsed: HallTextAnchor
  readonly skillCells: readonly HallSkillCellLayout[]
  readonly survival: HallTextAnchor
  readonly timeLabel: HallTextAnchor
  readonly timeValue: HallTextAnchor
  readonly top: number
  readonly waveLabel: HallTextAnchor
  readonly waveValue: HallTextAnchor
}

export const HALL_BOX = { height: 695, left: 200, top: 80, width: 1200 } as const
export const HALL_ROW_HEIGHT = 250
export const HALL_EXPANDED_HEIGHT = 150
export const HALL_CONTENT_TOP = 80
export const HALL_PEN_Y = 15
/** Wide-client pen.x cascade: survival + skills, then perks, then the kills box. */
export const HALL_PEN_X = { kills: 25, perks: 10, survival: -10 } as const
export const HALL_TILE = { columns: 5, record: 49, rows: 4, size: 264 } as const
export const HALL_GOLD = 0xd9ba70
export const HALL_GOLD_RGB = [217, 186, 112] as const
export const HALL_WHITE = 0xffffff
export const HALL_BADGE_ALPHA = 0.5
export const HALL_TICK_MS = 10
export const HALL_PULSE_PERIOD_TICKS = 120
export const HALL_OTHER_FRAME_ALPHA = 0.2
export const HALL_KILLS_FRAME_ALPHA = 0.5
export const HALL_WIZARD_SCALE = 1.25
export const HALL_NINE_SLICE_EDGE_UV = 0.95
export const HALL_CHEVRON_ROTATION = { collapsed: 90, expanded: 180 } as const
/** UI record 9's logical size (asserted against the atlas by the kernel tests). */
export const HALL_CHEVRON_SIZE = { height: 20, width: 22 } as const
/** Stock draws the 180°-rotated chevron one pixel below its nominal quad (see `hallChevronPlacement`). */
export const HALL_CHEVRON_EXPANDED_Y_SHIFT = 1
export const HALL_RECORDS = {
  inventory: { frame: 10 },
  skills: { backplate: 164, iconBase: 27, perkBase: 127 },
  ui: { chevron: 9, frame: 17, killsFrame: 50, ornament: 25, tile: 49 },
} as const
export const HALL_SKILL_CELL = {
  backplateScale: 1,
  emptyFrameScale: 0.8,
  frameScale: 0.8,
  iconScale: 0.9,
} as const
export const HALL_PERK_CELL = { frameScale: 0.57, iconScale: 0.7 } as const
export const HALL_KILLS_LINE_BOX = 50
/** Box tick (`0x00589DD0`): the one-shot scroll eases over 90 ticks of `sin(t deg)`. */
export const HALL_SCROLL_EASE_TICKS = 90
/** Render (`0x005A2C80`): the current wizard's row lands a quarter box below the top. */
export const HALL_CURRENT_ROW_SCROLL_FRACTION = 0.25
export const HALL_ATLAS_SIZES: Readonly<Record<HallAtlas, readonly [number, number]>> = {
  Inventory: [1024, 512],
  Skills: [1024, 512],
  UI: [1024, 1024],
}
export const HALL_FONT_ATLAS_SIZE = [512, 256] as const

const HALL_HALF_WIDTH = HALL_BOX.width / 2

interface PickerGlyph {
  readonly frame: readonly [number, number, number, number]
  readonly metrics?: readonly [number, number, number]
}

interface PickerFont {
  readonly glyphs: Readonly<Record<string, PickerGlyph>>
  readonly kerning: readonly (readonly [number, number, number])[]
  readonly spaceAdvance: number
}

interface HeadingGlyph {
  readonly advance: number
  readonly atlasHeight: number
  readonly atlasWidth: number
  readonly atlasX: number
  readonly atlasY: number
  readonly centerX: number
  readonly centerY: number
  readonly glyphId: number
  readonly spriteCenterX: number
  readonly spriteCenterY: number
}

interface HeadingFont {
  readonly glyphs: Readonly<Record<string, HeadingGlyph>>
  readonly kerning: Readonly<Record<string, number>>
  readonly spaceAdvance: number
}

const PICKER_FONTS = (nativeUiAssetsJson as unknown as {
  readonly fonts: Readonly<Record<'body' | 'medium' | 'menu', PickerFont>>
}).fonts
const HEADING_FONT = headingFontJson as unknown as HeadingFont
const ATLASES = (nativeUiAssetsJson as unknown as {
  readonly atlases: Readonly<Record<HallAtlas, {
    readonly records: Readonly<Record<string, HallAtlasRecord>>
  }>>
}).atlases

export function hallAtlasRecord(atlas: HallAtlas, record: number): HallAtlasRecord {
  const definition = ATLASES[atlas].records[`${record}`]
  if (!definition) throw new RangeError(`Missing native ${atlas} record ${record}`)
  return definition
}

export function hallSkillIconRecord(skillId: number): number {
  if (!Number.isSafeInteger(skillId) || skillId < 0) {
    throw new RangeError(`Hall skill id ${skillId} is not a native skill id`)
  }
  return HALL_RECORDS.skills.iconBase + skillId
}

export function hallPerkIconRecord(selector: number): number {
  if (!Number.isSafeInteger(selector) || selector < 0) {
    throw new RangeError(`Hall perk selector ${selector} is not a native selector`)
  }
  return HALL_RECORDS.skills.perkBase + selector
}

/** `sin(tick * 3 deg)` on the 100 Hz game tick: period 1.2 s. */
export function hallPulse(tick: number): number {
  return Math.sin(tick * 3 * Math.PI / 180)
}

export function hallHighlightFillAlpha(tick: number): number {
  return 0.1 + 0.05 * hallPulse(tick)
}

export function hallCurrentFrameAlpha(tick: number): number {
  return 0.5 + 0.2 * hallPulse(tick)
}

export function hallTileOffset(scrollTop: number): number {
  const offset = scrollTop % HALL_TILE.size
  return offset < 0 ? offset + HALL_TILE.size : offset
}

export function hallRowHeight(expanded: boolean): number {
  return HALL_ROW_HEIGHT + (expanded ? HALL_EXPANDED_HEIGHT : 0)
}

/** Row tops (the native `yCursor` before each row) and the total content height. */
export function hallRowTops(expandedRows: readonly boolean[]): {
  readonly contentHeight: number
  readonly tops: readonly number[]
} {
  const tops: number[] = []
  let cursor = HALL_CONTENT_TOP
  for (const expanded of expandedRows) {
    tops.push(cursor)
    cursor += hallRowHeight(expanded)
  }
  return { contentHeight: cursor, tops }
}

export function hallScrollExtent(contentHeight: number): number {
  return Math.max(0, contentHeight - HALL_BOX.height)
}

/**
 * The pending scroll written the first frame that renders the current wizard:
 * `rowTop - boxHeight / 4`, clamped by the scroll setter to the content extent.
 */
export function hallCurrentRowScrollTarget(rowTop: number, contentHeight: number): number {
  const target = rowTop - HALL_BOX.height * HALL_CURRENT_ROW_SCROLL_FRACTION
  return Math.max(0, Math.min(hallScrollExtent(contentHeight), target))
}

/** Scroll offset applied on tick `t` (0..89) of the one-shot scroll: `sin(t deg) * target`. */
export function hallScrollEase(tick: number): number {
  const clamped = Math.min(HALL_SCROLL_EASE_TICKS - 1, Math.max(0, tick))
  return Math.sin(clamped * Math.PI / 180)
}

/** Rows whose bounds intersect the viewport plus `margin` on each side. */
export function hallVisibleRowRange(
  tops: readonly number[],
  expandedRows: readonly boolean[],
  scrollTop: number,
  margin = HALL_ROW_HEIGHT,
): { readonly end: number; readonly start: number } {
  const windowTop = scrollTop - margin
  const windowBottom = scrollTop + HALL_BOX.height + margin
  let start = tops.length
  let end = 0
  for (let index = 0; index < tops.length; index += 1) {
    const top = tops[index]! - 25
    const bottom = tops[index]! + hallRowHeight(expandedRows[index] ?? false)
    if (bottom < windowTop || top > windowBottom) continue
    start = Math.min(start, index)
    end = Math.max(end, index + 1)
  }
  return start < end ? { end, start } : { end: 0, start: 0 }
}

export function hallRowLayout(
  rowTop: number,
  expanded: boolean,
  rankWidth: number,
  awesomenessWidth: number,
): HallRowLayout {
  const pen = rowTop + HALL_PEN_Y
  const rankBaseline = pen + HALL_ROW_HEIGHT / 2 - 65
  const height = hallRowHeight(expanded)
  return {
    account: { align: 'center', font: 'body', x: HALL_HALF_WIDTH, y: pen + 170 },
    awesomeness: { align: 'center', font: 'medium', x: HALL_HALF_WIDTH, y: pen + 155 },
    chevron: hallChevronPlacement(HALL_HALF_WIDTH - awesomenessWidth / 2 - 25, pen + 140, expanded),
    expanded: expanded ? hallExpandedLayout(pen + HALL_ROW_HEIGHT - 75) : null,
    height,
    highlight: {
      height: HALL_ROW_HEIGHT - 10 + (expanded ? HALL_EXPANDED_HEIGHT : 0),
      left: 50,
      top: rowTop - 25,
      width: HALL_BOX.width - 100,
    },
    level: { align: 'center', font: 'medium', x: HALL_HALF_WIDTH, y: pen + 140 },
    name: { align: 'center', font: 'menu', x: HALL_HALF_WIDTH, y: pen + 125 },
    ornament: { x: HALL_HALF_WIDTH - 60 - rankWidth / 2 - 11, y: rankBaseline - 10.5 },
    rank: { align: 'center', font: 'heading', x: HALL_HALF_WIDTH - 60, y: rankBaseline },
    separatorY: rowTop + height - 50,
    wizard: { x: HALL_HALF_WIDTH, y: pen + 73 },
  }
}

/**
 * The row chevron is UI record 9 (22x20) drawn center-anchored at
 * `(600 - awesomenessWidth / 2 - 25, pen + 140)`, rotated 90° while collapsed
 * (20x22 on screen, tip pointing right) and 180° while expanded. The quad
 * edges snap like every other native quad (`hallRoundHalfUp`); in the 180°
 * state the stock art additionally sits one pixel lower (measured: rows
 * 226-244 for a quad whose nominal top is 225, while the 90° state and the
 * x axis of both states carry no shift).
 */
export function hallChevronPlacement(centerX: number, centerY: number, expanded: boolean): HallChevronPlacement {
  const { width, height } = HALL_CHEVRON_SIZE
  const halfScreenWidth = expanded ? width / 2 : height / 2
  const halfScreenHeight = expanded ? height / 2 : width / 2
  const left = hallRoundHalfUp(centerX - halfScreenWidth)
  const top = hallRoundHalfUp(centerY - halfScreenHeight) + (expanded ? HALL_CHEVRON_EXPANDED_Y_SHIFT : 0)
  return {
    rotation: expanded ? HALL_CHEVRON_ROTATION.expanded : HALL_CHEVRON_ROTATION.collapsed,
    x: left + halfScreenWidth,
    y: top + halfScreenHeight,
  }
}

export function hallExpandedLayout(top: number): HallExpandedLayout {
  const survivalX = HALL_PEN_X.survival
  const perksX = HALL_PEN_X.perks
  const killsX = HALL_PEN_X.kills
  const killsY = top + HALL_EXPANDED_HEIGHT / 2 - HALL_KILLS_LINE_BOX / 2 + 8
  const skillRowY = top + 108
  return {
    awesomestKill: { align: 'center', font: 'menu', x: HALL_HALF_WIDTH + killsX, y: killsY + 40 },
    awesomestLabel: { align: 'center', font: 'medium', x: HALL_HALF_WIDTH + killsX, y: killsY + 20 },
    highestSkills: { align: 'left', font: 'medium', x: 100 + survivalX, y: top + 70 },
    killsFrame: {
      height: HALL_KILLS_LINE_BOX + 40,
      left: HALL_HALF_WIDTH - 150 + killsX,
      top: killsY - 30,
      width: 300,
    },
    monstersKilled: { align: 'center', font: 'medium', x: HALL_HALF_WIDTH + killsX, y: killsY },
    perkCenters: Array.from({ length: 9 }, (_, index) => ({
      x: HALL_BOX.width - 162 + perksX + 42 * (index % 3 - 1),
      y: top + 75 + 42 * (Math.floor(index / 3) - 1),
    })),
    perksUsed: { align: 'right', font: 'medium', x: HALL_BOX.width - 100 + perksX, y: top },
    skillCells: Array.from({ length: 3 }, (_, index) => {
      const cellX = 100 + 60 * index + survivalX
      return {
        badge: (numeralWidth: number) => ({
          height: 15,
          left: cellX + 52 - numeralWidth,
          top: skillRowY + 11,
          width: numeralWidth + 3,
        }),
        center: { x: cellX + 30, y: skillRowY },
        numeral: { align: 'right', font: 'body', x: cellX + 53, y: skillRowY + 22 },
      }
    }),
    survival: { align: 'left', font: 'medium', x: 100 + survivalX, y: top },
    timeLabel: { align: 'left', font: 'medium', x: 131 + survivalX, y: top + 20 },
    timeValue: { align: 'left', font: 'medium', x: 180 + survivalX, y: top + 20 },
    top,
    waveLabel: { align: 'left', font: 'medium', x: 120 + survivalX, y: top + 35 },
    waveValue: { align: 'left', font: 'medium', x: 180 + survivalX, y: top + 35 },
  }
}

/** The two 2-px separator halves: each runs from an outer end to the center. */
export function hallSeparatorHalves(y: number): readonly HallRect[] {
  return [
    { height: 2, left: 150, top: y - 1, width: HALL_HALF_WIDTH - 150 },
    { height: 2, left: HALL_HALF_WIDTH, top: y - 1, width: HALL_HALF_WIDTH - 150 },
  ]
}

/**
 * `FUN_00417760`: corners as drawn / mirrored, edges = the glyph's last 5 %
 * column or row stretched across the remaining span.
 *
 * Mirrored pieces sample texel `w - j` at pixel `j` (the stock's UV flip
 * runs from the far edge of the glyph), so their art sits one pixel further
 * out along each mirrored axis, the glyph's first column/row is never drawn
 * and the piece's first pixel shows the transparent atlas gutter. Measured on
 * the row frame (record 17) and the kills frame (record 50): the right edge
 * profile equals the left edge mirrored and shifted exactly +1 px. The host
 * clips the container to `rect`, which drops the pushed-out last column/row.
 */
export const HALL_MIRROR_SHIFT = 1

export function hallNineSliceLayout(
  glyphWidth: number,
  glyphHeight: number,
  rect: HallRect,
): readonly HallNineSlicePiece[] {
  const innerWidth = Math.max(0, rect.width - 2 * glyphWidth)
  const innerHeight = Math.max(0, rect.height - 2 * glyphHeight)
  const right = rect.width - glyphWidth + HALL_MIRROR_SHIFT
  const bottom = rect.height - glyphHeight + HALL_MIRROR_SHIFT
  return [
    { height: glyphHeight, kind: 'corner', left: 0, mirrorX: false, mirrorY: false, top: 0, width: glyphWidth },
    { height: glyphHeight, kind: 'corner', left: right, mirrorX: true, mirrorY: false, top: 0, width: glyphWidth },
    { height: glyphHeight, kind: 'corner', left: 0, mirrorX: false, mirrorY: true, top: bottom, width: glyphWidth },
    { height: glyphHeight, kind: 'corner', left: right, mirrorX: true, mirrorY: true, top: bottom, width: glyphWidth },
    { height: glyphHeight, kind: 'horizontal', left: glyphWidth, mirrorX: false, mirrorY: false, top: 0, width: innerWidth },
    { height: glyphHeight, kind: 'horizontal', left: glyphWidth, mirrorX: false, mirrorY: true, top: bottom, width: innerWidth },
    { height: innerHeight, kind: 'vertical', left: 0, mirrorX: false, mirrorY: false, top: glyphHeight, width: glyphWidth },
    { height: innerHeight, kind: 'vertical', left: right, mirrorX: true, mirrorY: false, top: glyphHeight, width: glyphWidth },
  ]
}

export function measureHallText(font: HallFont, text: string): number {
  return layoutHallText(font, text, 'left').width
}

/**
 * Glyph placements relative to the anchor. The native text draws truncate the
 * pen to a whole pixel (`pen = trunc(x - width / 2)` for centered text, so an
 * odd width shifts the run half a pixel left of its float center) and each
 * glyph quad, center-anchored at (cursor + offsetX, offsetY), snaps with
 * `hallRoundHalfUp`. Anchors are whole pixels, as every native anchor is.
 * Characters the font lacks are skipped with zero advance.
 */
export function layoutHallText(font: HallFont, text: string, align: HallTextAlign): HallTextLayout {
  const placed = font === 'heading' ? layoutHeadingText(text) : layoutPickerText(PICKER_FONTS[font], text)
  const shift = align === 'center' ? -Math.ceil(placed.width / 2) : align === 'right' ? -placed.width : 0
  return {
    glyphs: placed.glyphs.map((glyph) => ({ ...glyph, left: glyph.left + shift })),
    width: placed.width,
  }
}

/** Characters of `text` that `font` cannot draw (spaces always can). */
export function hallMissingGlyphs(font: HallFont, text: string): readonly string[] {
  const missing: string[] = []
  for (const character of text) {
    if (character === ' ') continue
    const present = font === 'heading'
      ? HEADING_FONT.glyphs[character.toUpperCase()] !== undefined
      : PICKER_FONTS[font].glyphs[`${character.codePointAt(0)!}`]?.metrics !== undefined
    if (!present) missing.push(character)
  }
  return missing
}

function layoutPickerText(font: PickerFont, text: string): HallTextLayout {
  const glyphs: HallGlyphPlacement[] = []
  let cursor = 0
  let previous = -1
  for (const character of text) {
    const code = character.codePointAt(0)!
    if (character === ' ') {
      cursor += font.spaceAdvance
      previous = code
      continue
    }
    const glyph = font.glyphs[`${code}`]
    if (!glyph?.metrics) continue
    if (previous >= 0) {
      cursor += font.kerning.find(([left, right]) => left === previous && right === code)?.[2] ?? 0
    }
    const [atlasX, atlasY, width, height] = glyph.frame
    glyphs.push({
      atlasX,
      atlasY,
      height,
      left: hallRoundHalfUp(cursor + glyph.metrics[1] - width / 2),
      top: hallRoundHalfUp(glyph.metrics[2] - height / 2),
      width,
    })
    cursor += glyph.metrics[0]
    previous = code
  }
  return { glyphs, width: cursor }
}

function layoutHeadingText(text: string): HallTextLayout {
  const glyphs: HallGlyphPlacement[] = []
  let cursor = 0
  let previousGlyphId: number | null = null
  for (const character of text.toUpperCase()) {
    if (character === ' ') {
      cursor += HEADING_FONT.spaceAdvance
      previousGlyphId = null
      continue
    }
    const glyph = HEADING_FONT.glyphs[character]
    if (!glyph) continue
    if (previousGlyphId !== null) {
      cursor += HEADING_FONT.kerning[`${previousGlyphId}:${glyph.glyphId}`] ?? 0
    }
    glyphs.push({
      atlasX: glyph.atlasX,
      atlasY: glyph.atlasY,
      height: glyph.atlasHeight,
      left: hallRoundHalfUp(cursor + glyph.centerX - glyph.atlasWidth / 2 + glyph.spriteCenterX),
      top: hallRoundHalfUp(glyph.centerY - glyph.atlasHeight / 2 + glyph.spriteCenterY),
      width: glyph.atlasWidth,
    })
    cursor += glyph.advance
    previousGlyphId = glyph.glyphId
  }
  return { glyphs, width: cursor }
}

import nativeFontData from '../assets/game/create-name-font-group-4.json' with { type: 'json' }
import stockWizardNames from '../assets/magenames.json' with { type: 'json' }

interface NativeCreateWizardNameGlyph {
  advance: number
  atlasHeight: number
  atlasWidth: number
  atlasX: number
  atlasY: number
  centerX: number
  centerY: number
  glyphId: number
  spriteCenterX: number
  spriteCenterY: number
}

interface NativeCreateWizardNameFont {
  atlasHeight: number
  atlasWidth: number
  glyphCount: number
  glyphs: Readonly<Record<string, NativeCreateWizardNameGlyph>>
  group: number
  kerning: Readonly<Record<string, number>>
  kerningCount: number
  spaceAdvance: number
}

export interface CreateWizardNameGlyph {
  atlasHeight: number
  atlasWidth: number
  atlasX: number
  atlasY: number
  char: string
  left: number
  top: number
}

export interface CreateWizardNameLayout {
  glyphs: readonly CreateWizardNameGlyph[]
  height: number
  left: number
  right: number
  top: number
  value: string
  width: number
}

export type CreateWizardNameValidation =
  | { ok: true; value: string }
  | { ok: false; reason: string }

export const CREATE_WIZARD_NAME_FONT: NativeCreateWizardNameFont = nativeFontData
export const CREATE_WIZARD_NAME_MAX_LENGTH = 64
export const CREATE_WIZARD_NAME_MAX_WIDTH = 372
export const STOCK_WIZARD_NAMES: readonly string[] = Object.freeze([...stockWizardNames])
export const CREATE_WIZARD_NAME_VALUE_BOUNDS = Object.freeze({
  height: 49,
  left: 50,
  top: 12,
  width: 384,
})

const CREATE_WIZARD_NAME_DEFAULT = 'Helvidius'
const CREATE_WIZARD_NAME_TEXT_TOP = 19

export function initialCreateWizardName(value: string): string {
  let supported = ''
  let width = 0
  let previousGlyphId: number | null = null

  for (const char of value) {
    const glyph = CREATE_WIZARD_NAME_FONT.glyphs[char.toUpperCase()]
    if (!glyph) continue
    const nextWidth = width
      + (previousGlyphId === null
        ? 0
        : CREATE_WIZARD_NAME_FONT.kerning[`${previousGlyphId}:${glyph.glyphId}`] ?? 0)
      + glyph.advance
    if (
      supported.length >= CREATE_WIZARD_NAME_MAX_LENGTH
      || nextWidth > CREATE_WIZARD_NAME_MAX_WIDTH
    ) break
    supported += char
    width = nextWidth
    previousGlyphId = glyph.glyphId
  }
  return supported || CREATE_WIZARD_NAME_DEFAULT
}

export function randomStockWizardName(random: () => number = Math.random): string {
  const index = Math.min(
    STOCK_WIZARD_NAMES.length - 1,
    Math.max(0, Math.floor(random() * STOCK_WIZARD_NAMES.length)),
  )
  return STOCK_WIZARD_NAMES[index]!
}

export function initialCreateWizardNameForSession(
  value: string,
  random: () => number = Math.random,
): string {
  return value.length === 0
    ? randomStockWizardName(random)
    : initialCreateWizardName(value)
}

export function validateCreateWizardName(value: string): CreateWizardNameValidation {
  if (value.length === 0) {
    return { ok: false, reason: 'Enter a wizard name.' }
  }
  if (value.length > CREATE_WIZARD_NAME_MAX_LENGTH) {
    return {
      ok: false,
      reason: `Wizard names may contain at most ${CREATE_WIZARD_NAME_MAX_LENGTH} characters.`,
    }
  }
  if ([...value].some((char) => !Object.hasOwn(
    CREATE_WIZARD_NAME_FONT.glyphs,
    char.toUpperCase(),
  ))) {
    return {
      ok: false,
      reason: 'Use letters, numbers, or ! , . / : ? only.',
    }
  }
  if (measureCreateWizardName(value) > CREATE_WIZARD_NAME_MAX_WIDTH) {
    return {
      ok: false,
      reason: 'Wizard name is too wide.',
    }
  }
  return { ok: true, value }
}

export function measureCreateWizardName(value: string): number {
  let width = 0
  let previousGlyphId: number | null = null

  for (const char of value.toUpperCase()) {
    const glyph = CREATE_WIZARD_NAME_FONT.glyphs[char]
    if (!glyph) throw new Error('Cannot measure an unsupported wizard-name character.')
    if (previousGlyphId !== null) {
      width += CREATE_WIZARD_NAME_FONT.kerning[
        `${previousGlyphId}:${glyph.glyphId}`
      ] ?? 0
    }
    width += glyph.advance
    previousGlyphId = glyph.glyphId
  }
  return width
}

export function layoutCreateWizardName(value: string): CreateWizardNameLayout {
  const validation = validateCreateWizardName(value)
  if (!validation.ok) throw new Error(validation.reason)
  const renderedValue = validation.value.toUpperCase()

  let cursor = 0
  let previousGlyphId: number | null = null
  const glyphs: Array<CreateWizardNameGlyph & { rawLeft: number; rawTop: number }> = []

  for (const char of renderedValue) {
    const glyph = CREATE_WIZARD_NAME_FONT.glyphs[char]!
    if (previousGlyphId !== null) {
      cursor += CREATE_WIZARD_NAME_FONT.kerning[
        `${previousGlyphId}:${glyph.glyphId}`
      ] ?? 0
    }
    glyphs.push({
      atlasHeight: glyph.atlasHeight,
      atlasWidth: glyph.atlasWidth,
      atlasX: glyph.atlasX,
      atlasY: glyph.atlasY,
      char,
      left: 0,
      rawLeft: cursor + glyph.centerX - glyph.atlasWidth / 2 + glyph.spriteCenterX,
      rawTop: glyph.centerY - glyph.atlasHeight / 2 + glyph.spriteCenterY,
      top: 0,
    })
    cursor += glyph.advance
    previousGlyphId = glyph.glyphId
  }

  const minimumLeft = Math.floor(Math.min(...glyphs.map((glyph) => glyph.rawLeft)))
  const minimumTop = Math.floor(Math.min(...glyphs.map((glyph) => glyph.rawTop)))
  const maximumRight = Math.ceil(Math.max(...glyphs.map((glyph) => glyph.rawLeft + glyph.atlasWidth)))
  const maximumBottom = Math.ceil(Math.max(...glyphs.map((glyph) => glyph.rawTop + glyph.atlasHeight)))
  const width = maximumRight - minimumLeft
  const height = maximumBottom - minimumTop
  const left = CREATE_WIZARD_NAME_VALUE_BOUNDS.left
    + (CREATE_WIZARD_NAME_VALUE_BOUNDS.width - width) / 2

  return {
    glyphs: glyphs.map(({ rawLeft, rawTop, ...glyph }) => ({
      ...glyph,
      left: left + rawLeft - minimumLeft,
      top: CREATE_WIZARD_NAME_TEXT_TOP + rawTop - minimumTop,
    })),
    height,
    left,
    right: left + width,
    top: CREATE_WIZARD_NAME_TEXT_TOP,
    value: renderedValue,
    width,
  }
}

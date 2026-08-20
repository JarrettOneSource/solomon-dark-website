import nativeFontData from '../assets/game/create-name-font-group-4.json' with { type: 'json' }

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
export const CREATE_WIZARD_NAME_VALUE_BOUNDS = Object.freeze({
  height: 49,
  left: 50,
  top: 12,
  width: 384,
})

const CREATE_WIZARD_NAME_DEFAULT = 'Helvidius'
const CREATE_WIZARD_NAME_TEXT_TOP = 19

export function initialCreateWizardName(value: string): string {
  const supported = [...value]
    .filter((char) => Object.hasOwn(CREATE_WIZARD_NAME_FONT.glyphs, char.toUpperCase()))
    .join('')
    .slice(0, CREATE_WIZARD_NAME_MAX_LENGTH)
  return supported || CREATE_WIZARD_NAME_DEFAULT
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
      reason: 'Use only the characters available in the native wizard-name face.',
    }
  }
  return { ok: true, value }
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

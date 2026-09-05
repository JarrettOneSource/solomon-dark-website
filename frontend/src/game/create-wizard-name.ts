import { layoutNativeUiText, measureNativeUiText, nativeUiFont, nativeUiGlyphInkBounds, type NativeUiGlyphLayout } from './native-ui/core.ts'
import stockWizardNames from '../assets/magenames.json' with { type: 'json' }

export interface CreateWizardNameLayout {
  glyphs: readonly NativeUiGlyphLayout[]
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

const NAME_FONT = nativeUiFont('heading')
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

  for (const char of value) {
    const upper = char.toUpperCase()
    if (upper.length !== 1) continue
    if (!NAME_FONT.glyphs[`${upper.codePointAt(0)!}`]) continue
    const next = supported + char
    if (
      next.length > CREATE_WIZARD_NAME_MAX_LENGTH
      || measureNativeUiText(next.toUpperCase(), 'heading') > CREATE_WIZARD_NAME_MAX_WIDTH
    ) break
    supported = next
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
  if ([...value].some(char => char.toUpperCase().length !== 1
    || !NAME_FONT.glyphs[`${char.toUpperCase().codePointAt(0)!}`])) {
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
  const text = value.toUpperCase()
  if ([...text].some(char => !NAME_FONT.glyphs[`${char.codePointAt(0)!}`])) {
    throw new Error('Cannot measure an unsupported wizard-name character.')
  }
  return measureNativeUiText(text, 'heading')
}

export function layoutCreateWizardName(value: string): CreateWizardNameLayout {
  const validation = validateCreateWizardName(value)
  if (!validation.ok) throw new Error(validation.reason)
  const renderedValue = validation.value.toUpperCase()
  const layout = layoutNativeUiText({ align: 'left', font: 'heading', text: renderedValue, x: 0, y: 0 })
  const ink = layout.glyphs.map(nativeUiGlyphInkBounds)
  const minimumLeft = Math.floor(Math.min(...ink.map(glyph => glyph.left)))
  const minimumTop = Math.floor(Math.min(...ink.map(glyph => glyph.top)))
  const maximumRight = Math.ceil(Math.max(...ink.map(glyph => glyph.left + glyph.width)))
  const maximumBottom = Math.ceil(Math.max(...ink.map(glyph => glyph.top + glyph.height)))
  const width = maximumRight - minimumLeft
  const height = maximumBottom - minimumTop
  const left = CREATE_WIZARD_NAME_VALUE_BOUNDS.left
    + (CREATE_WIZARD_NAME_VALUE_BOUNDS.width - width) / 2
  return {
    glyphs: layout.glyphs.map(glyph => ({
      ...glyph,
      centerX: left + glyph.centerX - minimumLeft,
      centerY: CREATE_WIZARD_NAME_TEXT_TOP + glyph.centerY - minimumTop,
    })),
    height,
    left,
    right: left + width,
    top: CREATE_WIZARD_NAME_TEXT_TOP,
    value: renderedValue,
    width,
  }
}

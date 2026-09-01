import {
  NATIVE_UI_FONT_NAMES,
  nativeUiFont,
  type NativeUiBitmapFont,
  type NativeUiFontName,
  type NativeUiGlyphRecord,
} from './native-ui-catalog.ts'

export type NativeUiTextAlign = 'center' | 'left' | 'right'

export interface NativeUiTextSpec {
  readonly align?: NativeUiTextAlign
  readonly alpha?: number
  readonly font: NativeUiFontName
  readonly lineHeight?: number
  readonly maxWidth?: number
  readonly scale?: number
  readonly text: string
  readonly tint?: number
  /** Horizontal anchor: left edge, center, or right edge according to `align`. */
  readonly x: number
  /** Native text baseline for the first line. */
  readonly y: number
}

export interface NativeUiGlyphLayout extends NativeUiGlyphRecord {
  readonly alpha: number
  readonly centerX: number
  readonly centerY: number
  readonly character: string
  readonly codePoint: number
  readonly font: NativeUiFontName
  readonly scale: number
  readonly tint: number
}

export interface NativeUiTextLineLayout {
  readonly baselineY: number
  readonly text: string
  readonly width: number
  readonly x: number
}

export interface NativeUiTextLayout {
  readonly font: NativeUiFontName
  readonly glyphs: readonly NativeUiGlyphLayout[]
  readonly height: number
  readonly lines: readonly NativeUiTextLineLayout[]
  readonly unsupportedCodePoints: readonly number[]
  readonly width: number
}

const KERNING = new Map<NativeUiFontName, ReadonlyMap<string, number>>(
  NATIVE_UI_FONT_NAMES.map((name) => [
    name,
    new Map(nativeUiFont(name).kerning.map(([left, right, adjustment]) => (
      [`${left}:${right}`, adjustment] as const
    ))),
  ]),
)

export function nativeUiKerning(
  fontName: NativeUiFontName,
  left: number,
  right: number,
): number {
  if (left < 0) return 0
  return KERNING.get(fontName)!.get(`${left}:${right}`) ?? 0
}

export function measureNativeUiText(
  text: string,
  fontName: NativeUiFontName,
  scale = 1,
): number {
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('native UI text scale must be positive')
  const font = nativeUiFont(fontName)
  let width = 0
  let previous = -1
  for (const character of text) {
    const codePoint = character.codePointAt(0)!
    if (character === ' ') width += font.spaceAdvance
    else {
      const glyph = font.glyphs[`${codePoint}`]
      if (glyph) width += nativeUiKerning(fontName, previous, codePoint) + glyph.metrics[0]
    }
    previous = codePoint
  }
  return width * scale
}

export function wrapNativeUiText(
  text: string,
  fontName: NativeUiFontName,
  maxWidth = Number.POSITIVE_INFINITY,
  scale = 1,
): readonly string[] {
  if (!Number.isFinite(maxWidth)) return text.split('\n')
  if (maxWidth < 0) throw new RangeError('native UI text max width must be nonnegative')
  const unscaledMaxWidth = maxWidth / scale
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (current && measureNativeUiText(next, fontName) > unscaledMaxWidth) {
        lines.push(current)
        current = word
      } else current = next
    }
    lines.push(current)
  }
  return lines
}

/** Exact in-place mutation performed while native MsgBox stores a DataLine. */
export function wrapNativeUiMsgBoxText(
  text: string,
  fontName: NativeUiFontName,
  maxWidth: number,
): readonly string[] {
  if (!Number.isFinite(maxWidth) || maxWidth < 0) {
    throw new RangeError('native UI MsgBox wrap width must be finite and nonnegative')
  }
  const font = nativeUiFont(fontName)
  const characters = [...text]
  let index = 0
  let lineStart = 0
  let lineWidth = 0
  let wrapped = false

  while (index < characters.length) {
    let character = characters[index]!
    if (character === '\n' || character === '\r') lineWidth = 0

    let advance = 0
    if (character === ' ') {
      if (wrapped) {
        let count = 1
        while (characters[index + count] === ' ') count += 1
        characters.splice(index, count)
        index -= 1
      } else advance = font.spaceAdvance
    } else {
      const glyph = font.glyphs[`${character.codePointAt(0)!}`]
      if (glyph) {
        wrapped = false
        advance = glyph.metrics[0]
      }
    }

    let nextLineStart = lineStart
    if (lineWidth + advance > maxWidth) {
      lineWidth = 0
      let breakAt = index
      let cursor = index - 1
      if (cursor !== lineStart) {
        do {
          breakAt = cursor
          if (characters[cursor] === ' ' || characters[cursor] === '-') break
          cursor -= 1
          breakAt = index
        } while (cursor !== lineStart)
      }

      character = characters[breakAt]!
      index = breakAt
      if (character === ' ' || character === '-') characters[breakAt] = '\n'
      else {
        if (breakAt > 1) index = breakAt - 1
        characters.splice(index, 0, '-', '\n')
      }
      wrapped = true
      nextLineStart = breakAt
    }

    // MsgBox intentionally carries the glyph that overflowed into the scan of
    // the new line. This differs from renderer-level greedy word wrapping.
    lineWidth += advance
    index += 1
    lineStart = nextLineStart
  }

  return characters.join('').split('\n')
}

export function layoutNativeUiText(spec: NativeUiTextSpec): NativeUiTextLayout {
  const font = nativeUiFont(spec.font)
  const scale = spec.scale ?? 1
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('native UI text scale must be positive')
  const alpha = spec.alpha ?? 1
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new RangeError('native UI text alpha must be within [0, 1]')
  }
  const lines = wrapNativeUiText(spec.text, spec.font, spec.maxWidth, scale)
  const lineHeight = (spec.lineHeight ?? font.metrics[0]) * scale
  const glyphs: NativeUiGlyphLayout[] = []
  const lineLayouts: NativeUiTextLineLayout[] = []
  const unsupported = new Set<number>()
  let widest = 0
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const text = lines[lineIndex]!
    const width = measureNativeUiText(text, spec.font, scale)
    widest = Math.max(widest, width)
    const lineX = spec.align === 'left'
      ? spec.x
      : spec.align === 'right'
        ? spec.x - width
        : spec.x - width / 2
    const baselineY = spec.y + lineIndex * lineHeight
    lineLayouts.push({ baselineY, text, width, x: lineX })
    layoutLine(font, spec, text, lineX, baselineY, scale, alpha, glyphs, unsupported)
  }
  return {
    font: spec.font,
    glyphs,
    height: lines.length === 0 ? 0 : font.metrics[0] * scale + (lines.length - 1) * lineHeight,
    lines: lineLayouts,
    unsupportedCodePoints: [...unsupported].sort((left, right) => left - right),
    width: widest,
  }
}

function layoutLine(
  font: NativeUiBitmapFont,
  spec: NativeUiTextSpec,
  text: string,
  lineX: number,
  baselineY: number,
  scale: number,
  alpha: number,
  output: NativeUiGlyphLayout[],
  unsupported: Set<number>,
): void {
  let cursor = lineX
  let previous = -1
  for (const character of text) {
    const codePoint = character.codePointAt(0)!
    if (character === ' ') {
      cursor += font.spaceAdvance * scale
      previous = codePoint
      continue
    }
    const glyph = font.glyphs[`${codePoint}`]
    if (!glyph) {
      unsupported.add(codePoint)
      previous = codePoint
      continue
    }
    cursor += nativeUiKerning(spec.font, previous, codePoint) * scale
    output.push({
      ...glyph,
      alpha,
      centerX: cursor + glyph.metrics[1] * scale,
      centerY: baselineY + glyph.metrics[2] * scale,
      character,
      codePoint,
      font: spec.font,
      scale,
      tint: spec.tint ?? 0xffffff,
    })
    cursor += glyph.metrics[0] * scale
    previous = codePoint
  }
}

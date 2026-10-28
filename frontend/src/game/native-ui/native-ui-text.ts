import {
  NATIVE_UI_FONT_NAMES,
  nativeUiFont,
  type NativeUiFontName,
  type NativeUiGlyphRecord,
} from './native-ui-catalog.ts'

export type NativeUiTextAlign = 'center' | 'left' | 'right'

export const NATIVE_UI_TEXT_ITALIC = Object.freeze({ glyphBottomDelta: -3, glyphTopDelta: 3 })

export interface NativeUiTextRun {
  readonly advanceScale?: number
  readonly italic?: boolean
  readonly offsetX?: number
  readonly offsetY?: number
  readonly scale?: number
  readonly text: string
}

export interface NativeUiTextSpec {
  readonly align?: NativeUiTextAlign
  readonly alpha?: number
  readonly font: NativeUiFontName
  readonly lineHeight?: number
  readonly maxWidth?: number
  /** A native pen baseline, or a flow box containing and centering its visible ink. */
  readonly placement?: 'baseline' | 'box'
  readonly scale?: number
  readonly text: string
  readonly tint?: number
  /** Horizontal anchor: left edge, center, or right edge according to `align`. */
  readonly x: number
  /** First native baseline, or the top of the flow box when placement is box. */
  readonly y: number
}

export interface NativeUiGlyphLayout extends NativeUiGlyphRecord {
  readonly alpha: number
  readonly centerX: number
  readonly centerY: number
  readonly character: string
  readonly codePoint: number
  readonly font: NativeUiFontName
  readonly italic?: boolean
  readonly scale: number
  readonly tint: number
}

export interface NativeUiGlyphInkBounds {
  readonly height: number
  readonly left: number
  readonly top: number
  readonly width: number
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

/** Tight atlas ink positioned inside the glyph's authored logical sprite quad. */
export function nativeUiGlyphInkBounds(
  glyph: NativeUiGlyphLayout,
): NativeUiGlyphInkBounds {
  const [, , frameWidth, frameHeight] = glyph.frame
  const [logicalWidth, logicalHeight] = glyph.logicalSize
  const [trimX, trimY] = glyph.trimOrigin
  return {
    height: frameHeight * glyph.scale,
    left: glyph.centerX + (trimX - logicalWidth / 2) * glyph.scale,
    top: glyph.centerY + (trimY - logicalHeight / 2) * glyph.scale,
    width: frameWidth * glyph.scale,
  }
}

export function measureNativeUiText(
  text: string,
  fontName: NativeUiFontName,
  scale = 1,
): number {
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('native UI text scale must be positive')
  return layoutLine({ font: fontName, scale, x: 0, y: 0 }, [{ text }])
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
    layoutLine({ ...spec, x: lineX, y: baselineY }, [{ text }], glyphs, unsupported)
  }
  const layout: NativeUiTextLayout = {
    font: spec.font,
    glyphs,
    height: font.metrics[0] * scale + (lines.length - 1) * lineHeight,
    lines: lineLayouts,
    unsupportedCodePoints: [...unsupported].sort((left, right) => left - right),
    width: widest,
  }
  return spec.placement === 'box' ? placeTextInBox(layout) : layout
}

function placeTextInBox(layout: NativeUiTextLayout): NativeUiTextLayout {
  if (layout.glyphs.length === 0) return layout
  let inkTop = Number.POSITIVE_INFINITY
  let inkBottom = Number.NEGATIVE_INFINITY
  for (const glyph of layout.glyphs) {
    const bounds = nativeUiGlyphInkBounds(glyph)
    const baseline = glyph.centerY - glyph.metrics[2] * glyph.scale
    inkTop = Math.min(inkTop, bounds.top - baseline)
    inkBottom = Math.max(inkBottom, bounds.top + bounds.height - baseline)
  }
  const inkHeight = inkBottom - inkTop
  const lineSpan = layout.lines.at(-1)!.baselineY - layout.lines[0]!.baselineY
  const lineHeight = Math.max(layout.height - lineSpan, inkHeight)
  const height = lineSpan + lineHeight
  const offsetY = (lineHeight - inkHeight) / 2 - inkTop
  return {
    ...layout,
    glyphs: layout.glyphs.map(glyph => ({ ...glyph, centerY: glyph.centerY + offsetY })),
    height,
    lines: layout.lines.map(line => ({ ...line, baselineY: line.baselineY + offsetY })),
  }
}

/** Styled runs share the same native pen, including kerning across run boundaries. */
export function layoutNativeUiTextRuns(
  spec: Pick<NativeUiTextSpec, 'font' | 'tint' | 'x' | 'y'> & { readonly runs: readonly NativeUiTextRun[] },
): NativeUiTextLayout {
  const font = nativeUiFont(spec.font)
  const glyphs: NativeUiGlyphLayout[] = []
  const unsupported = new Set<number>()
  const width = layoutLine(spec, spec.runs, glyphs, unsupported)
  return {
    font: spec.font,
    glyphs,
    height: font.metrics[0],
    lines: [{ baselineY: spec.y, text: spec.runs.map(run => run.text).join(''), width, x: spec.x }],
    unsupportedCodePoints: [...unsupported].sort((left, right) => left - right),
    width,
  }
}

type NativeUiTextPen = Pick<NativeUiTextSpec, 'alpha' | 'font' | 'scale' | 'tint' | 'x' | 'y'>

function layoutLine(
  spec: NativeUiTextPen,
  runs: readonly NativeUiTextRun[],
  output?: NativeUiGlyphLayout[],
  unsupported?: Set<number>,
): number {
  const font = nativeUiFont(spec.font)
  const scale = spec.scale ?? 1
  let cursor = spec.x
  let previous = -1
  for (const run of runs) {
    const glyphScale = scale * (run.scale ?? 1)
    const advanceScale = scale * (run.advanceScale ?? run.scale ?? 1)
    for (const character of run.text) {
      const codePoint = character.codePointAt(0)!
      if (character === ' ') {
        cursor += font.spaceAdvance * advanceScale
        previous = codePoint
        continue
      }
      const glyph = font.glyphs[`${codePoint}`]
      if (!glyph) {
        unsupported?.add(codePoint)
        previous = codePoint
        continue
      }
      cursor += nativeUiKerning(spec.font, previous, codePoint) * advanceScale
      output?.push({
        ...glyph,
        alpha: spec.alpha ?? 1,
        centerX: cursor + glyph.metrics[1] * glyphScale + (run.offsetX ?? 0),
        centerY: spec.y + glyph.metrics[2] * glyphScale + (run.offsetY ?? 0),
        character,
        codePoint,
        font: spec.font,
        italic: run.italic ?? false,
        scale: glyphScale,
        tint: spec.tint ?? 0xffffff,
      })
      cursor += glyph.metrics[0] * advanceScale
      previous = codePoint
    }
  }
  return cursor - spec.x
}

/** Preserve authored spaces and emphasis when wrapping a native dialogue paragraph. */
export function wrapNativeUiTextRuns(
  runs: readonly NativeUiTextRun[],
  font: NativeUiFontName,
  maxWidth: number,
): readonly (readonly NativeUiTextRun[])[] {
  const lines: NativeUiTextRun[][] = []
  let paragraph: NativeUiTextRun[] = []
  for (const run of runs) {
    for (const character of run.text) {
      if (character === '\n') {
        lines.push(...wrapRunParagraph(paragraph, font, maxWidth))
        paragraph = []
      } else paragraph.push({ ...run, text: character })
    }
  }
  lines.push(...wrapRunParagraph(paragraph, font, maxWidth))
  return lines
}

function wrapRunParagraph(
  paragraph: readonly NativeUiTextRun[],
  font: NativeUiFontName,
  maxWidth: number,
): NativeUiTextRun[][] {
  const lines: NativeUiTextRun[][] = []
  let line: NativeUiTextRun[] = []
  let index = 0
  while (index < paragraph.length) {
    const spaces: NativeUiTextRun[] = []
    while (paragraph[index]?.text === ' ') spaces.push(paragraph[index++]!)
    const word: NativeUiTextRun[] = []
    while (index < paragraph.length && paragraph[index]!.text !== ' ') word.push(paragraph[index++]!)
    const candidate = [...line, ...spaces, ...word]
    if (line.length > 0 && word.length > 0
      && layoutLine({ font, x: 0, y: 0 }, candidate) > maxWidth) {
      lines.push(line)
      line = word
    } else line = candidate
  }
  lines.push(line)
  return lines
}

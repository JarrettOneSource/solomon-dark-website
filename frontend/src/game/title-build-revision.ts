import nativeFontData from '../assets/game/hub-hud-font-group-8.json' with { type: 'json' }

declare const __SDR_BUILD_REVISION__: string

interface NativeTitleFontGlyph {
  advance: number
  atlasHeight: number
  atlasWidth: number
  atlasX: number
  atlasY: number
  centerX: number
  centerY: number
  glyphId: number
  offsetX: number
  offsetY: number
}

interface NativeTitleFontData {
  glyphs: Readonly<Record<string, NativeTitleFontGlyph>>
  header: readonly number[]
  kerning: Readonly<Record<string, number>>
}

export interface TitleBuildRevision {
  full: string | null
  label: string
  short: string | null
}

export interface TitleBuildRevisionGlyph {
  atlasX: number
  atlasY: number
  char: string
  height: number
  left: number
  top: number
  width: number
}

export interface TitleBuildRevisionLayout {
  advance: number
  bottom: number
  glyphs: readonly TitleBuildRevisionGlyph[]
  left: number
  right: number
  top: number
}

const FULL_GIT_REVISION = /^[0-9a-f]{40}$/i
const TITLE_BUILD_REVISION_FONT: NativeTitleFontData = nativeFontData
const injectedRevision = typeof __SDR_BUILD_REVISION__ === 'string'
  ? __SDR_BUILD_REVISION__
  : undefined

export const TITLE_BUILD_REVISION = titleBuildRevision(injectedRevision)

export function titleBuildRevision(revision: string | undefined): TitleBuildRevision {
  if (revision === undefined) {
    return { full: null, label: 'LOCAL BUILD', short: null }
  }

  const full = revision.trim().toLowerCase()
  if (!FULL_GIT_REVISION.test(full)) {
    throw new Error('The title build revision must be a full 40-character Git commit ID')
  }

  const short = full.slice(0, 8).toUpperCase()
  return { full, label: `BUILD ${short}`, short }
}

export function layoutTitleBuildRevisionLabel(text: string): TitleBuildRevisionLayout {
  const glyphs: TitleBuildRevisionGlyph[] = []
  let cursor = 0
  let previousGlyphId: number | null = null

  for (const char of text) {
    if (char === ' ') {
      cursor += TITLE_BUILD_REVISION_FONT.header[1] ?? 0
      previousGlyphId = null
      continue
    }

    const glyph = TITLE_BUILD_REVISION_FONT.glyphs[char]
    if (!glyph) throw new Error(`The title build font has no ${JSON.stringify(char)} glyph`)
    if (previousGlyphId !== null) {
      cursor += TITLE_BUILD_REVISION_FONT.kerning[
        `${previousGlyphId}:${glyph.glyphId}`
      ] ?? 0
    }
    glyphs.push({
      atlasX: glyph.atlasX,
      atlasY: glyph.atlasY,
      char,
      height: glyph.atlasHeight,
      left: cursor + glyph.offsetX - glyph.atlasWidth / 2 + glyph.centerX,
      top: glyph.offsetY - glyph.atlasHeight / 2 + glyph.centerY,
      width: glyph.atlasWidth,
    })
    cursor += glyph.advance
    previousGlyphId = glyph.glyphId
  }

  return {
    advance: cursor,
    bottom: Math.max(...glyphs.map((glyph) => glyph.top + glyph.height)),
    glyphs,
    left: Math.min(...glyphs.map((glyph) => glyph.left)),
    right: Math.max(...glyphs.map((glyph) => glyph.left + glyph.width)),
    top: Math.min(...glyphs.map((glyph) => glyph.top)),
  }
}

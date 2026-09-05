import { layoutNativeUiText, nativeUiGlyphInkBounds, type NativeUiGlyphLayout } from './native-ui/core.ts'

declare const __SDR_BUILD_REVISION__: string

export interface TitleBuildRevision {
  full: string | null
  label: string
  short: string | null
}

export interface TitleBuildRevisionLayout {
  advance: number
  bottom: number
  glyphs: readonly NativeUiGlyphLayout[]
  left: number
  right: number
  top: number
}

const FULL_GIT_REVISION = /^[0-9a-f]{40}$/i
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
  const layout = layoutNativeUiText({ align: 'left', font: 'belt', text, x: 0, y: 0 })
  if (layout.unsupportedCodePoints.length > 0) {
    throw new Error(`The title build font has no ${JSON.stringify(String.fromCodePoint(layout.unsupportedCodePoints[0]!))} glyph`)
  }
  const ink = layout.glyphs.map(nativeUiGlyphInkBounds)
  return {
    advance: layout.width,
    bottom: Math.max(...ink.map(glyph => glyph.top + glyph.height)),
    glyphs: layout.glyphs,
    left: Math.min(...ink.map(glyph => glyph.left)),
    right: Math.max(...ink.map(glyph => glyph.left + glyph.width)),
    top: Math.min(...ink.map(glyph => glyph.top)),
  }
}

import nativeFontData from '../assets/game/hub-hud-font-group-8.json' with { type: 'json' }
import { NATIVE_SECONDARY_GLOBAL_COOLDOWN_TICKS } from './core-kernels/native-secondary-abilities.ts'

interface NativeBeltFontGlyph {
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
  record: number
}

interface NativeBeltFontData {
  atlasHeight: number
  atlasWidth: number
  glyphCount: number
  glyphs: Readonly<Record<string, NativeBeltFontGlyph>>
  group: number
  header: readonly number[]
  kerning: Readonly<Record<string, number>>
  kerningCount: number
  scale: number
}

export interface NativeBeltBindingGlyph {
  atlasX: number
  atlasY: number
  char: string
  height: number
  left: number
  top: number
  width: number
}

export interface NativeBeltBindingLayout {
  advance: number
  backingLeft: number
  backingWidth: number
  glyphs: readonly NativeBeltBindingGlyph[]
}

export interface NativeSkillQuickbarCooldownPresentation {
  capacity: number
  remaining: number
}

export const NATIVE_SKILL_QUICKBAR_FONT: NativeBeltFontData = nativeFontData
export const NATIVE_SKILL_QUICKBAR_SLOT_OFFSETS = Object.freeze([
  -332, -272, -212, -152, 98, 158, 218, 278,
])

const SLOT_SIZE = 53
const SECTOR_CENTER = SLOT_SIZE / 2

export function nativeSkillQuickbarCooldownPresentation(
  rowRemaining: number,
  rowCapacity: number,
  globalRemaining: number,
): NativeSkillQuickbarCooldownPresentation {
  if (!(rowCapacity > 0)) return { capacity: 0, remaining: 0 }
  if (rowRemaining > 0 && globalRemaining <= rowRemaining) {
    return { capacity: rowCapacity, remaining: rowRemaining }
  }
  return {
    capacity: NATIVE_SECONDARY_GLOBAL_COOLDOWN_TICKS,
    remaining: Math.max(0, globalRemaining),
  }
}

export function layoutNativeQuickbarBinding(text: string): NativeBeltBindingLayout {
  const glyphs: Array<NativeBeltBindingGlyph & { cursor: number }> = []
  let cursor = 0
  let previousGlyphId: number | null = null

  for (const char of text) {
    const glyph = NATIVE_SKILL_QUICKBAR_FONT.glyphs[char]
    if (glyph) {
      if (previousGlyphId !== null) {
        cursor += NATIVE_SKILL_QUICKBAR_FONT.kerning[
          `${previousGlyphId}:${glyph.glyphId}`
        ] ?? 0
      }
      glyphs.push({
        atlasX: glyph.atlasX,
        atlasY: glyph.atlasY,
        char,
        cursor,
        height: glyph.atlasHeight,
        left: glyph.offsetX - glyph.atlasWidth / 2 + glyph.centerX,
        top: glyph.offsetY - glyph.atlasHeight / 2 + glyph.centerY,
        width: glyph.atlasWidth,
      })
      cursor += glyph.advance
    } else if (char === ' ') {
      cursor += NATIVE_SKILL_QUICKBAR_FONT.header[1] ?? 0
    }
    previousGlyphId = char.codePointAt(0) ?? null
  }

  const advance = cursor
  const backingWidth = advance + 6
  return {
    advance,
    backingLeft: (SLOT_SIZE - backingWidth) / 2,
    backingWidth,
    glyphs: glyphs.map(({ cursor: glyphCursor, ...glyph }) => ({
      ...glyph,
      left: SECTOR_CENTER - advance / 2 + glyphCursor + glyph.left,
    })),
  }
}

export function nativeCooldownSectorPath(remaining: number, capacity: number): string {
  if (!(remaining > 0) || !(capacity > 0)) return ''
  const ratio = Math.min(1, remaining / capacity)
  const startDegrees = 360 * (1 - ratio)
  const perimeter = [squareRayPoint(startDegrees)]
  for (
    let boundary = (Math.floor(startDegrees / 45) + 1) * 45;
    boundary <= 360;
    boundary += 45
  ) {
    perimeter.push(squareRayPoint(boundary))
  }
  return [
    `M ${formatCoordinate(SECTOR_CENTER)} ${formatCoordinate(SECTOR_CENTER)}`,
    ...perimeter.map(({ x, y }) => `L ${formatCoordinate(x)} ${formatCoordinate(y)}`),
    'Z',
  ].join(' ')
}

function squareRayPoint(degrees: number): { x: number; y: number } {
  const radians = degrees * Math.PI / 180
  const dx = Math.cos(radians)
  const dy = -Math.sin(radians)
  const scale = SECTOR_CENTER / Math.max(Math.abs(dx), Math.abs(dy))
  return {
    x: SECTOR_CENTER + dx * scale,
    y: SECTOR_CENTER + dy * scale,
  }
}

function formatCoordinate(value: number): string {
  const rounded = Math.round(value * 1_000_000) / 1_000_000
  return Object.is(rounded, -0) ? '0' : `${rounded}`
}

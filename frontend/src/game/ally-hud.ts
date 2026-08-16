import nativeFontData from '../assets/game/hub-hud-font-group-6.json' with { type: 'json' }
import type {
  NativeSecondaryActorState,
  NativeSecondaryGolemState,
} from './core-kernels/native-secondary-abilities.ts'
import type { ProtocolPlayerState } from './protocol/game-state.ts'

export type AllyHudIdentity =
  | { kind: 'player'; displayName: string }
  | { kind: 'golem' }

export interface AllyHudRow {
  healthRatio: number
  id: string
  identity: AllyHudIdentity
}

interface NativeAllyFontGlyph {
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

interface NativeAllyFontData {
  atlasHeight: number
  atlasWidth: number
  glyphCount: number
  glyphs: Readonly<Record<string, NativeAllyFontGlyph>>
  group: number
  header: readonly number[]
  kerning: Readonly<Record<string, number>>
  kerningCount: number
  scale: number
}

export interface NativeAllyNameGlyph {
  atlasX: number
  atlasY: number
  char: string
  height: number
  left: number
  top: number
  width: number
}

export interface NativeAllyNameLayout {
  advance: number
  glyphs: readonly NativeAllyNameGlyph[]
}

export const NATIVE_ALLY_FONT: NativeAllyFontData = nativeFontData

export function derivePlayerAllyHudRows(
  players: Readonly<Record<string, ProtocolPlayerState>>,
  localPlayerId: string,
): AllyHudRow[] {
  return Object.entries(players)
    .filter(([playerId]) => playerId !== localPlayerId)
    .sort(([leftId], [rightId]) => leftId < rightId ? -1 : leftId > rightId ? 1 : 0)
    .map(([playerId, player]) => ({
      healthRatio: clampAllyHudHealthRatio(
        player.progression.currentHealth / player.progression.maximumHealth,
      ),
      id: playerId,
      identity: {
        kind: 'player',
        displayName: player.config.displayName,
      },
    }))
}

type GolemAllyHudActor = Pick<
  NativeSecondaryActorState,
  'id' | 'kind' | 'worldKey'
> & {
  readonly golem: Pick<
    NativeSecondaryGolemState,
    'currentHealth' | 'maximumHealth'
  > | null
}

export function deriveGolemAllyHudRows(
  actors: readonly GolemAllyHudActor[],
  worldKey: string,
): AllyHudRow[] {
  return [...actors]
    .sort((left, right) => left.id - right.id)
    .flatMap((actor) => {
      if (actor.kind !== 'golem' || actor.golem === null || actor.worldKey !== worldKey) {
        return []
      }
      return [{
        healthRatio: clampAllyHudHealthRatio(
          actor.golem.currentHealth / actor.golem.maximumHealth,
        ),
        id: `golem:${actor.id}`,
        identity: { kind: 'golem' as const },
      }]
    })
}

export function combineAllyHudRows(
  playerRows: readonly AllyHudRow[],
  additionalRows: readonly AllyHudRow[],
): AllyHudRow[] {
  return [...playerRows, ...additionalRows]
}

export function clampAllyHudHealthRatio(healthRatio: number): number {
  return Math.min(1, Math.max(0, healthRatio))
}

export function allyHudIdentityPresentation(identity: AllyHudIdentity): {
  accessibleName: string
  visual: 'native-font' | 'stock-golem'
} {
  return identity.kind === 'player'
    ? { accessibleName: identity.displayName, visual: 'native-font' }
    : { accessibleName: 'Golem', visual: 'stock-golem' }
}

export function allyHudRowsEqual(
  left: readonly AllyHudRow[],
  right: readonly AllyHudRow[],
): boolean {
  return left.length === right.length && left.every((leftRow, index) => {
    const rightRow = right[index]
    if (
      !rightRow
      || leftRow.healthRatio !== rightRow.healthRatio
      || leftRow.id !== rightRow.id
      || leftRow.identity.kind !== rightRow.identity.kind
    ) return false
    return leftRow.identity.kind === 'golem'
      || (
        rightRow.identity.kind === 'player'
        && leftRow.identity.displayName === rightRow.identity.displayName
      )
  })
}

export function layoutNativeAllyName(text: string): NativeAllyNameLayout {
  const glyphs: NativeAllyNameGlyph[] = []
  let cursor = 0
  let previousGlyphId: number | null = null

  for (const char of text) {
    const glyph = NATIVE_ALLY_FONT.glyphs[char]
    if (glyph) {
      if (previousGlyphId !== null) {
        cursor += NATIVE_ALLY_FONT.kerning[`${previousGlyphId}:${glyph.glyphId}`] ?? 0
      }
      glyphs.push({
        atlasX: glyph.atlasX,
        atlasY: glyph.atlasY,
        char,
        height: glyph.atlasHeight * NATIVE_ALLY_FONT.scale,
        left: (
          cursor
          + glyph.offsetX
          - glyph.atlasWidth / 2
          + glyph.centerX
        ) * NATIVE_ALLY_FONT.scale,
        top: (
          glyph.offsetY
          - glyph.atlasHeight / 2
          + glyph.centerY
        ) * NATIVE_ALLY_FONT.scale,
        width: glyph.atlasWidth * NATIVE_ALLY_FONT.scale,
      })
      cursor += glyph.advance
    } else if (char === ' ') {
      cursor += NATIVE_ALLY_FONT.header[1]
    }
    previousGlyphId = char.codePointAt(0) ?? null
  }

  return {
    advance: cursor * NATIVE_ALLY_FONT.scale,
    glyphs,
  }
}

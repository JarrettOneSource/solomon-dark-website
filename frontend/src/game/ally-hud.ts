import nativeFontData from '../assets/game/hub-hud-font-group-6.json' with { type: 'json' }
import type {
  NativeSecondaryActorState,
  NativeSecondaryGolemState,
} from './core-kernels/native-secondary-abilities.ts'
import type { WizardElement } from './core-kernels/player-character.ts'
import type { ProtocolPlayerState } from './protocol/game-state.ts'
import type { PartyRosterPlayer } from './protocol/party-state.ts'

export type AllyHudIdentity =
  | { kind: 'player'; displayName: string; element: WizardElement }
  | { kind: 'golem' }

export interface AllyHudRow {
  connected: boolean
  dead: boolean
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
  partyRoster?: readonly PartyRosterPlayer[],
): AllyHudRow[] {
  const roster = partyRoster ?? Object.entries(players).map(([playerId, player]) => ({
    connected: true,
    currentHealth: player.progression.currentHealth,
    displayName: player.config.displayName,
    element: player.config.element,
    lifeState: player.progression.lifeState,
    maximumHealth: player.progression.maximumHealth,
    playerId,
  }))
  return roster
    .filter(({ playerId }) => playerId !== localPlayerId)
    .sort((left, right) => left.playerId.localeCompare(right.playerId))
    .map((retained) => {
      const snapshotPlayer = players[retained.playerId]
      const connected = partyRoster === undefined
        ? snapshotPlayer !== undefined
        : retained.connected
      const player = connected ? snapshotPlayer : undefined
      const currentHealth = player?.progression.currentHealth ?? retained.currentHealth
      const maximumHealth = player?.progression.maximumHealth ?? retained.maximumHealth
      const lifeState = player?.progression.lifeState ?? retained.lifeState
      return {
        connected,
        dead: lifeState !== 'alive' || currentHealth <= 0,
        healthRatio: clampAllyHudHealthRatio(
          currentHealth / maximumHealth,
        ),
        id: retained.playerId,
        identity: {
          kind: 'player',
          displayName: player?.config.displayName ?? retained.displayName,
          element: player?.config.element ?? retained.element,
        },
      }
    })
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
        connected: true,
        dead: false,
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

export function allyHudAccessibleName(identity: AllyHudIdentity): string {
  return identity.kind === 'player' ? identity.displayName : 'Golem'
}

export function allyHudAccessibleStatus(row: AllyHudRow): string {
  const name = allyHudAccessibleName(row.identity)
  if (row.identity.kind === 'golem') return name
  if (row.dead && !row.connected) return `${name}, dead and disconnected`
  if (row.dead) return `${name}, dead`
  if (!row.connected) return `${name}, disconnected`
  return name
}

export function allyHudRowsEqual(
  left: readonly AllyHudRow[],
  right: readonly AllyHudRow[],
): boolean {
  return left.length === right.length && left.every((leftRow, index) => {
    const rightRow = right[index]
    if (
      !rightRow
      || leftRow.connected !== rightRow.connected
      || leftRow.dead !== rightRow.dead
      || leftRow.healthRatio !== rightRow.healthRatio
      || leftRow.id !== rightRow.id
      || leftRow.identity.kind !== rightRow.identity.kind
    ) return false
    return leftRow.identity.kind === 'golem'
      || (
        leftRow.identity.kind === 'player'
        && rightRow.identity.kind === 'player'
        && leftRow.identity.displayName === rightRow.identity.displayName
        && leftRow.identity.element === rightRow.identity.element
      )
  })
}

export function layoutNativeAllyName(
  text: string,
  scale = NATIVE_ALLY_FONT.scale,
): NativeAllyNameLayout {
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
        height: glyph.atlasHeight * scale,
        left: (
          cursor
          + glyph.offsetX
          - glyph.atlasWidth / 2
          + glyph.centerX
        ) * scale,
        top: (
          glyph.offsetY
          - glyph.atlasHeight / 2
          + glyph.centerY
        ) * scale,
        width: glyph.atlasWidth * scale,
      })
      cursor += glyph.advance
    } else if (char === ' ') {
      cursor += NATIVE_ALLY_FONT.header[1]
    }
    previousGlyphId = char.codePointAt(0) ?? null
  }

  return {
    advance: cursor * scale,
    glyphs,
  }
}

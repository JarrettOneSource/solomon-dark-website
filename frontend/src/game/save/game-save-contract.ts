import {
  WIZARD_DISCIPLINES,
  WIZARD_ELEMENTS,
  type PlayerCharacterConfig,
} from '../core-kernels/player-character.ts'
import { GAME_RUN_PHASES, type GameRunPhase } from '../core-kernels/game-run.ts'

export const WEB_GAME_SAVE_SCHEMA_VERSION = 1
export const WEB_GAME_SAVE_SLOT = 0
export const MAX_WEB_GAME_SAVE_BYTES = 8 * 1024 * 1024
export const MAX_WEB_GAME_SAVE_JSON_DEPTH = 64
export const MAX_WEB_GAME_SAVE_JSON_NODES = 250_000

export interface GameSaveSummary {
  readonly character: PlayerCharacterConfig
  readonly phase: GameRunPhase
  readonly playerId: string
  readonly savedAtTick: number
  readonly worldKind: 'boneyard' | 'hub'
}

export interface GameSaveCheckpoint {
  readonly document: string | null
  readonly reason: 'game-over' | 'progress'
  readonly sequence: number
}

export interface ResumableGameSave {
  readonly document: string
  readonly summary: GameSaveSummary
}

export interface ParsedGameSaveDocument {
  readonly loadedBoneyard: unknown
  readonly simulation: unknown
  readonly summary: GameSaveSummary
}

const encoder = new TextEncoder()

export function parseGameSaveDocument(document: string): ParsedGameSaveDocument {
  if (
    typeof document !== 'string'
    || document.length === 0
    || encoder.encode(document).byteLength > MAX_WEB_GAME_SAVE_BYTES
  ) throw new Error('game save exceeds its size limit')

  let parsed: unknown
  try {
    parsed = JSON.parse(document)
  } catch {
    throw new Error('game save is not valid JSON')
  }
  const root = record(parsed, 'game save')
  onlyKeys(root, 'game save', [
    'loadedBoneyard',
    'schemaVersion',
    'simulation',
    'summary',
  ])
  if (root.schemaVersion !== WEB_GAME_SAVE_SCHEMA_VERSION) {
    throw new Error('game save schema version is not supported')
  }
  const summary = parseSummary(root.summary)
  if (!('simulation' in root) || !('loadedBoneyard' in root)) {
    throw new Error('game save is missing authoritative state')
  }
  return {
    loadedBoneyard: root.loadedBoneyard,
    simulation: root.simulation,
    summary,
  }
}

export function readGameSaveSummary(document: string): GameSaveSummary {
  return parseGameSaveDocument(document).summary
}

function parseSummary(value: unknown): GameSaveSummary {
  const summary = record(value, 'game save summary')
  onlyKeys(summary, 'game save summary', [
    'character',
    'phase',
    'playerId',
    'savedAtTick',
    'worldKind',
  ])
  const character = record(summary.character, 'game save character')
  onlyKeys(character, 'game save character', ['discipline', 'displayName', 'element'])
  if (
    typeof character.discipline !== 'string'
    || !(WIZARD_DISCIPLINES as readonly string[]).includes(character.discipline)
  ) throw new Error('game save character discipline is invalid')
  if (
    typeof character.element !== 'string'
    || !(WIZARD_ELEMENTS as readonly string[]).includes(character.element)
  ) throw new Error('game save character element is invalid')
  if (
    typeof character.displayName !== 'string'
    || character.displayName.length === 0
    || character.displayName.length > 64
  ) throw new Error('game save character display name is invalid')
  if (
    typeof summary.playerId !== 'string'
    || summary.playerId.length === 0
    || summary.playerId.length > 128
  ) throw new Error('game save owner is invalid')
  if (
    typeof summary.phase !== 'string'
    || !(GAME_RUN_PHASES as readonly string[]).includes(summary.phase)
  ) throw new Error('game save phase is invalid')
  if (
    summary.worldKind !== 'hub'
    && summary.worldKind !== 'boneyard'
  ) throw new Error('game save world kind is invalid')
  if (!Number.isSafeInteger(summary.savedAtTick) || Number(summary.savedAtTick) < 0) {
    throw new Error('game save tick is invalid')
  }
  return {
    character: {
      discipline: character.discipline as PlayerCharacterConfig['discipline'],
      displayName: character.displayName,
      element: character.element as PlayerCharacterConfig['element'],
    },
    phase: summary.phase as GameRunPhase,
    playerId: summary.playerId,
    savedAtTick: Number(summary.savedAtTick),
    worldKind: summary.worldKind,
  }
}

export function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`)
  }
  return value as Record<string, unknown>
}

export function onlyKeys(
  source: Record<string, unknown>,
  field: string,
  allowed: readonly string[],
): void {
  const allowedKeys = new Set(allowed)
  for (const key of Object.keys(source)) {
    if (!allowedKeys.has(key)) throw new Error(`${field} has unexpected field ${key}`)
  }
  for (const key of allowed) {
    if (!(key in source)) throw new Error(`${field} is missing field ${key}`)
  }
}

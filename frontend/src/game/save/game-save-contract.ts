import {
  WIZARD_DISCIPLINES,
  WIZARD_ELEMENTS,
  type PlayerCharacterConfig,
} from '../core-kernels/player-character.ts'
import { GAME_RUN_PHASES, type GameRunPhase } from '../core-kernels/game-run.ts'
import type {
  GameContentIdentity,
  LuaConsoleValue,
} from '../protocol/game-protocol.ts'

export const WEB_GAME_SAVE_SCHEMA_VERSION = 16
export const LEGACY_WEB_GAME_SAVE_SCHEMA_VERSIONS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
] as const
export const WEB_GAME_SAVE_SLOT = 0
export const MAX_WEB_GAME_SAVE_BYTES = 8 * 1024 * 1024
/** Accommodates the 32-level Sack wire bound plus the complete save-document envelope. */
export const MAX_WEB_GAME_SAVE_JSON_DEPTH = 80
export const MAX_WEB_GAME_SAVE_JSON_NODES = 250_000

export interface GameSaveSummary {
  readonly activeRun: boolean
  readonly character: PlayerCharacterConfig
  readonly partyRejoinToken: string | null
  readonly phase: GameRunPhase
  readonly playerId: string
  readonly savedAtTick: number
  readonly worldKind: 'boneyard' | 'hub'
}

export interface GameSaveCheckpoint {
  readonly document: string
  readonly reason: 'game-over' | 'progress'
  readonly sequence: number
  readonly streamId: number
}

export type GameSaveIntent = 'new-game' | 'resume'

export interface GameProfileSave {
  readonly document: string
  readonly integrity: GameSaveIntegrity
  readonly mods: readonly GameContentIdentity[]
}

export interface ResumableGameSave extends GameProfileSave {
  readonly summary: GameSaveSummary
}

export type GameSaveIntegrity = 'global-clean' | 'local-only'

export interface ParsedGameSaveProfile {
  readonly economy: unknown
  readonly hagathaRuntime: unknown
}

export interface ParsedGameSaveContinuation {
  readonly loadedBoneyard: unknown
  readonly simulation: unknown
  readonly summary: GameSaveSummary
}

export interface ParsedGameSaveDocument {
  readonly continuation: ParsedGameSaveContinuation | null
  readonly integrity: GameSaveIntegrity
  readonly mods: readonly GameContentIdentity[]
  readonly modState: Readonly<Record<string, Readonly<Record<string, LuaConsoleValue>>>>
  readonly profile: ParsedGameSaveProfile
  readonly sourceSchemaVersion: number
}

const encoder = new TextEncoder()
const MAX_WEB_GAME_MOD_STATE_BYTES = 60 * 1024

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
  const schemaVersion = root.schemaVersion
  if (!knownGameSaveSchemaVersion(schemaVersion)) {
    throw new Error('game save schema version is not supported')
  }
  return schemaVersion >= 6
    ? parseCurrentDocument(root, schemaVersion)
    : schemaVersion === 5
      ? parseLegacyEnvelope(root)
      : parseLegacyDocument(root, schemaVersion)
}

function knownGameSaveSchemaVersion(value: unknown): value is number {
  return value === WEB_GAME_SAVE_SCHEMA_VERSION
    || (LEGACY_WEB_GAME_SAVE_SCHEMA_VERSIONS as readonly unknown[]).includes(value)
}

function parseCurrentDocument(
  root: Record<string, unknown>,
  schemaVersion: number,
): ParsedGameSaveDocument {
  onlyKeys(root, 'game save', [
    'continuation',
    'integrity',
    'mods',
    'modState',
    'profile',
    'schemaVersion',
  ])
  const profile = parseProfile(root.profile)
  return {
    continuation: root.continuation === null
      ? null
      : parseContinuation(
          root.continuation,
          false,
          schemaVersion < 10,
          schemaVersion >= 12,
        ),
    integrity: parseIntegrity(root.integrity),
    mods: parseMods(root.mods),
    modState: parseModState(root.modState),
    profile,
    sourceSchemaVersion: schemaVersion,
  }
}

function parseLegacyEnvelope(root: Record<string, unknown>): ParsedGameSaveDocument {
  onlyKeys(root, 'game save', [
    'continuation',
    'integrity',
    'mods',
    'modState',
    'profile',
    'schemaVersion',
  ])
  return {
    continuation: root.continuation === null
      ? null
      : parseContinuation(root.continuation, true, true, false),
    integrity: parseIntegrity(root.integrity),
    mods: parseMods(root.mods),
    modState: parseModState(root.modState),
    profile: parseProfile(root.profile),
    sourceSchemaVersion: 5,
  }
}

function parseLegacyDocument(
  root: Record<string, unknown>,
  schemaVersion: number,
): ParsedGameSaveDocument {
  onlyKeys(root, 'game save', [
    ...(schemaVersion === 4 ? ['integrity'] : []),
    'loadedBoneyard',
    ...(schemaVersion >= 2 ? ['mods', 'modState'] : []),
    'schemaVersion',
    'simulation',
    'summary',
  ])
  const summary = parseSummary(root.summary, true, true, false)
  if (!('simulation' in root) || !('loadedBoneyard' in root)) {
    throw new Error('game save is missing authoritative state')
  }
  return {
    continuation: {
      loadedBoneyard: root.loadedBoneyard,
      simulation: root.simulation,
      summary,
    },
    integrity: schemaVersion === 4 ? parseIntegrity(root.integrity) : 'local-only',
    mods: schemaVersion >= 2 ? parseMods(root.mods) : [],
    modState: schemaVersion >= 2 ? parseModState(root.modState) : {},
    profile: profileFromLegacySimulation(root.simulation, summary.playerId),
    sourceSchemaVersion: schemaVersion,
  }
}

function parseProfile(value: unknown): ParsedGameSaveProfile {
  const profile = record(value, 'game save profile')
  onlyKeys(profile, 'game save profile', ['economy', 'hagathaRuntime'])
  record(profile.economy, 'game save profile economy')
  record(profile.hagathaRuntime, 'game save profile Hagatha runtime')
  return {
    economy: profile.economy,
    hagathaRuntime: profile.hagathaRuntime,
  }
}

function parseContinuation(
  value: unknown,
  legacySummary: boolean,
  legacyPartyRejoin: boolean,
  signedPartyRejoin: boolean,
): ParsedGameSaveContinuation {
  const continuation = record(value, 'game save continuation')
  onlyKeys(continuation, 'game save continuation', [
    'loadedBoneyard',
    'simulation',
    'summary',
  ])
  if (!('simulation' in continuation) || !('loadedBoneyard' in continuation)) {
    throw new Error('game save continuation is missing authoritative state')
  }
  return {
    loadedBoneyard: continuation.loadedBoneyard,
    simulation: continuation.simulation,
    summary: parseSummary(
      continuation.summary,
      legacySummary,
      legacyPartyRejoin,
      signedPartyRejoin,
    ),
  }
}

function profileFromLegacySimulation(
  value: unknown,
  playerId: string,
): ParsedGameSaveProfile {
  const simulation = record(value, 'game save simulation')
  const players = record(simulation.playerEntities, 'game save players')
  if (!Array.isArray(players.identities) || !Array.isArray(players.economies)) {
    throw new Error('game save player profile is invalid')
  }
  const index = players.identities.findIndex((identity) => {
    const entry = record(identity, 'game save player identity')
    return entry.playerId === playerId
  })
  const economy = players.economies[index]
  if (index < 0 || economy === undefined) throw new Error('game save profile owner is absent')
  record(economy, 'game save profile economy')
  const progressions = Array.isArray(players.progressions) ? players.progressions : []
  const progression = progressions[index]
  const hagathaRuntime = progression && typeof progression === 'object'
    ? (progression as Record<string, unknown>).hagathaRuntime
    : undefined
  return { economy, hagathaRuntime }
}

function parseIntegrity(value: unknown): GameSaveIntegrity {
  if (value !== 'global-clean' && value !== 'local-only') {
    throw new Error('game save integrity is invalid')
  }
  return value
}

function parseMods(value: unknown): readonly GameContentIdentity[] {
  if (!Array.isArray(value) || value.length > 128) throw new Error('game save mods are invalid')
  const ids = new Set<string>()
  return value.map((entry, index) => {
    const mod = record(entry, `game save mod ${index}`)
    onlyKeys(mod, `game save mod ${index}`, ['contentSha256', 'id', 'version'])
    if (
      typeof mod.id !== 'string'
      || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(mod.id)
      || ids.has(mod.id.toLowerCase())
      || typeof mod.version !== 'string'
      || mod.version.length === 0
      || mod.version.length > 64
      || typeof mod.contentSha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(mod.contentSha256)
    ) throw new Error('game save mod identity is invalid')
    ids.add(mod.id.toLowerCase())
    return {
      contentSha256: mod.contentSha256,
      id: mod.id,
      version: mod.version,
    }
  })
}

function parseModState(
  value: unknown,
): Readonly<Record<string, Readonly<Record<string, LuaConsoleValue>>>> {
  const source = record(value, 'game save mod state')
  if (Object.keys(source).length > 128) throw new Error('game save mod state is too large')
  const result: Record<string, Readonly<Record<string, LuaConsoleValue>>> = {}
  for (const [modId, rawState] of Object.entries(source)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(modId)) {
      throw new Error('game save mod state id is invalid')
    }
    const state = record(rawState, `game save state for ${modId}`)
    if (Object.keys(state).length > 256) throw new Error('game save mod state has too many keys')
    if (Object.keys(state).some(key => key.length === 0 || key.length > 128)) {
      throw new Error('game save mod state key is invalid')
    }
    if (encoder.encode(JSON.stringify(state)).byteLength > MAX_WEB_GAME_MOD_STATE_BYTES) {
      throw new Error('game save mod state exceeds its size limit')
    }
    validateModStateValue(state, 0)
    result[modId] = state as Readonly<Record<string, LuaConsoleValue>>
  }
  return result
}

function validateModStateValue(value: unknown, depth: number): void {
  if (depth > 16) throw new Error('game save mod state is too deeply nested')
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('game save mod state number is invalid')
    return
  }
  if (Array.isArray(value)) {
    if (value.length > 2_048) throw new Error('game save mod state array is too large')
    for (const child of value) validateModStateValue(child, depth + 1)
    return
  }
  if (!value || typeof value !== 'object') throw new Error('game save mod state value is invalid')
  const entries = Object.entries(value)
  if (entries.length > 2_048) throw new Error('game save mod state object is too large')
  for (const [key, child] of entries) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new Error(`game save mod state has unsafe field ${key}`)
    }
    validateModStateValue(child, depth + 1)
  }
}

export function readGameSaveSummary(document: string): GameSaveSummary | null {
  return parseGameSaveDocument(document).continuation?.summary ?? null
}

function parseSummary(
  value: unknown,
  legacy = true,
  legacyPartyRejoin = true,
  signedPartyRejoin = false,
): GameSaveSummary {
  const summary = record(value, 'game save summary')
  onlyKeys(summary, 'game save summary', [
    ...(legacy ? [] : ['activeRun']),
    'character',
    ...(legacyPartyRejoin ? [] : ['partyRejoinToken']),
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
    activeRun: legacy
      ? summary.worldKind === 'boneyard' && summary.phase === 'active'
      : boolean(summary.activeRun, 'game save active run'),
    character: {
      discipline: character.discipline as PlayerCharacterConfig['discipline'],
      displayName: character.displayName,
      element: character.element as PlayerCharacterConfig['element'],
    },
    partyRejoinToken: legacyPartyRejoin
      ? null
      : parsePartyRejoinToken(summary.partyRejoinToken, signedPartyRejoin),
    phase: summary.phase as GameRunPhase,
    playerId: summary.playerId,
    savedAtTick: Number(summary.savedAtTick),
    worldKind: summary.worldKind,
  }
}

function parsePartyRejoinToken(value: unknown, signed: boolean): string | null {
  if (value === null) return null
  if (
    typeof value !== 'string'
    || (signed
      ? value.length > 8_192
        || !/^sdrpr[12]\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)
      : !/^[A-Za-z0-9_-]{43}$/.test(value))
  ) {
    throw new Error('game save party rejoin token is invalid')
  }
  return value
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} is invalid`)
  return value
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

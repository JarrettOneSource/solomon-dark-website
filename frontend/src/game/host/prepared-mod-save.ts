import type { CompiledWebLuaMod, WebLuaScopeKind } from '../modding/definition/index.ts'
import { WEB_LUA_SCOPE_KINDS } from '../modding/definition/index.ts'
import type { LuaConsoleObject, LuaConsoleValue } from '../protocol/game-protocol.ts'
import type { PreparedModHostCheckpoint } from './prepared-mod-host.ts'

export type PreparedModSaveState = Readonly<
  Record<string, Readonly<Record<string, LuaConsoleValue>>>
>

export function encodePreparedModSaveState(
  mods: readonly CompiledWebLuaMod[],
  checkpoint: PreparedModHostCheckpoint,
): PreparedModSaveState {
  if (checkpoint.session.graphSha256.length !== mods.length) {
    throw new Error('prepared mod checkpoint graph count is invalid')
  }
  const ownerByContent = contentOwners(mods)
  return Object.freeze(Object.fromEntries(mods.map((mod, index) => [
    mod.identity.id,
    Object.freeze({
      api: '1.0.0',
      graph_sha256: checkpoint.session.graphSha256[index] ?? '',
      powerups: checkpoint.powerups.instances
        .filter(instance => instance.modId === mod.identity.id)
        .map(instance => ({
          content_id: instance.contentId,
          id: instance.id,
          spawned_tick: instance.spawnedTick,
          x: instance.x,
          y: instance.y,
        })),
      spell_cooldowns: checkpoint.spells.cooldowns
        .filter(cooldown => ownerByContent.get(cooldown.contentId) === mod.identity.id)
        .map(cooldown => ({
          content_id: cooldown.contentId,
          player_id: cooldown.playerId,
          ready_tick: cooldown.readyTick,
        })),
      state_cells: checkpoint.session.state.cells
        .filter(cell => cell.modId === mod.identity.id)
        .map(cell => ({
          key: cell.key,
          schema_version: cell.schemaVersion,
          scope_id: cell.scope.id,
          scope_kind: cell.scope.kind,
          value: cell.value,
        })),
      statuses: checkpoint.statuses.instances
        .filter(status => status.modId === mod.identity.id)
        .map(status => ({
          content_id: status.contentId,
          expires_tick: status.expiresTick,
          instance_id: status.instanceId,
          started_tick: status.startedTick,
          target_id: status.targetId,
        })),
      ...(index === 0 ? { runtime: {
        powerup_next_id: checkpoint.powerups.nextId,
        powerup_revision: checkpoint.powerups.revision,
        spell_revision: checkpoint.spells.revision,
        state_revision: checkpoint.session.state.revision,
        status_next_id: checkpoint.statuses.nextInstanceId,
        status_revision: checkpoint.statuses.revision,
      } } : {}),
    }),
  ])))
}

export function decodePreparedModSaveState(
  mods: readonly CompiledWebLuaMod[],
  state: PreparedModSaveState,
): PreparedModHostCheckpoint {
  if (mods.length === 0) throw new Error('cannot restore mod state without prepared mods')
  const ownerByContent = contentOwners(mods)
  const first = object(state[mods[0]!.identity.id], 'mod runtime state')
  const runtime = object(first.runtime, 'mod runtime metadata')
  const cells: PreparedModHostCheckpoint['session']['state']['cells'][number][] = []
  const statuses: PreparedModHostCheckpoint['statuses']['instances'][number][] = []
  const powerups: PreparedModHostCheckpoint['powerups']['instances'][number][] = []
  const cooldowns: PreparedModHostCheckpoint['spells']['cooldowns'][number][] = []
  for (const [index, mod] of mods.entries()) {
    const entry = object(state[mod.identity.id], `mod state ${mod.identity.id}`)
    if (entry.api !== '1.0.0' || entry.graph_sha256 !== mod.graphSha256) {
      throw new Error(`mod state graph does not match ${mod.identity.id}`)
    }
    for (const value of array(entry.state_cells, `${mod.identity.id}.state_cells`)) {
      const row = object(value, 'mod state cell')
      const scopeKind = text(row.scope_kind, 'mod state scope kind')
      if (!(WEB_LUA_SCOPE_KINDS as readonly string[]).includes(scopeKind)) {
        throw new Error('mod state scope kind is invalid')
      }
      cells.push(Object.freeze({
        key: text(row.key, 'mod state key'),
        modId: mod.identity.id,
        schemaVersion: positiveInteger(row.schema_version, 'mod state schema version'),
        scope: Object.freeze({
          id: text(row.scope_id, 'mod state scope id'),
          kind: scopeKind as WebLuaScopeKind,
        }),
        value: luaValue(row.value),
      }))
    }
    for (const value of array(entry.statuses, `${mod.identity.id}.statuses`)) {
      const row = object(value, 'mod status')
      const contentId = content(row.content_id, mod.identity.id, ownerByContent)
      statuses.push(Object.freeze({
        contentId,
        expiresTick: positiveInteger(row.expires_tick, 'mod status expiry'),
        instanceId: positiveInteger(row.instance_id, 'mod status instance'),
        modId: mod.identity.id,
        startedTick: nonnegativeInteger(row.started_tick, 'mod status start'),
        targetId: text(row.target_id, 'mod status target'),
      }))
    }
    for (const value of array(entry.powerups, `${mod.identity.id}.powerups`)) {
      const row = object(value, 'mod powerup')
      powerups.push(Object.freeze({
        contentId: content(row.content_id, mod.identity.id, ownerByContent),
        id: positiveInteger(row.id, 'mod powerup id'),
        modId: mod.identity.id,
        spawnedTick: nonnegativeInteger(row.spawned_tick, 'mod powerup spawn'),
        x: finite(row.x, 'mod powerup x'),
        y: finite(row.y, 'mod powerup y'),
      }))
    }
    for (const value of array(entry.spell_cooldowns, `${mod.identity.id}.spell_cooldowns`)) {
      const row = object(value, 'mod spell cooldown')
      cooldowns.push(Object.freeze({
        contentId: content(row.content_id, mod.identity.id, ownerByContent),
        playerId: text(row.player_id, 'mod spell player'),
        readyTick: nonnegativeInteger(row.ready_tick, 'mod spell ready tick'),
      }))
    }
    if (index > 0 && entry.runtime !== undefined) throw new Error('mod runtime metadata is duplicated')
  }
  return Object.freeze({
    powerups: Object.freeze({
      instances: Object.freeze(powerups),
      nextId: positiveInteger(runtime.powerup_next_id, 'mod powerup next id'),
      revision: nonnegativeInteger(runtime.powerup_revision, 'mod powerup revision'),
    }),
    session: Object.freeze({
      graphSha256: Object.freeze(mods.map(mod => mod.graphSha256)),
      state: Object.freeze({
        cells: Object.freeze(cells),
        revision: nonnegativeInteger(runtime.state_revision, 'mod state revision'),
      }),
    }),
    spells: Object.freeze({
      cooldowns: Object.freeze(cooldowns),
      revision: nonnegativeInteger(runtime.spell_revision, 'mod spell revision'),
    }),
    statuses: Object.freeze({
      instances: Object.freeze(statuses),
      nextInstanceId: positiveInteger(runtime.status_next_id, 'mod status next id'),
      revision: nonnegativeInteger(runtime.status_revision, 'mod status revision'),
    }),
  })
}

function content(
  value: LuaConsoleValue | undefined,
  modId: string,
  owners: ReadonlyMap<string, string>,
): string {
  const contentId = text(value, 'mod content id')
  if (owners.get(contentId) !== modId) throw new Error(`mod content is not owned by ${modId}`)
  return contentId
}

function contentOwners(mods: readonly CompiledWebLuaMod[]): ReadonlyMap<string, string> {
  return new Map(mods.flatMap(mod => mod.content.map(content => [
    content.contentId,
    mod.identity.id,
  ] as const)))
}

function object(value: LuaConsoleValue | undefined, field: string): LuaConsoleObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`)
  return value as LuaConsoleObject
}

function array(value: LuaConsoleValue | undefined, field: string): readonly LuaConsoleValue[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`)
  return value
}

function text(value: LuaConsoleValue | undefined, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256) throw new Error(`${field} is invalid`)
  return value
}

function finite(value: LuaConsoleValue | undefined, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} is invalid`)
  return value
}

function nonnegativeInteger(value: LuaConsoleValue | undefined, field: string): number {
  const result = finite(value, field)
  if (!Number.isSafeInteger(result) || result < 0) throw new Error(`${field} is invalid`)
  return result
}

function positiveInteger(value: LuaConsoleValue | undefined, field: string): number {
  const result = nonnegativeInteger(value, field)
  if (result < 1) throw new Error(`${field} is invalid`)
  return result
}

function luaValue(value: LuaConsoleValue | undefined): LuaConsoleValue {
  return value === undefined ? null : value
}

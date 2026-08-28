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
      spell_effects: checkpoint.spellEffects.effects
        .filter(effect => effect.modId === mod.identity.id)
        .map(effect => ({
          content_id: effect.contentId,
          effects: effect.effects.map(template => ({
            fields: template.fields,
            kind: template.kind,
          })),
          expires_tick: effect.expiresTick,
          hit_targets: effect.hitTargets,
          id: effect.id,
          interval_ticks: effect.intervalTicks,
          kind: effect.kind,
          last_tick: effect.lastTick,
          next_pulse_tick: effect.nextPulseTick,
          owner_player_id: effect.ownerPlayerId,
          radius: effect.radius,
          scope_id: effect.scope.id,
          scope_kind: effect.scope.kind,
          speed_per_tick: effect.speedPerTick,
          started_tick: effect.startedTick,
          target_x: effect.targetX,
          target_y: effect.targetY,
          x: effect.x,
          y: effect.y,
        })),
      state_values: checkpoint.semanticState.values
        .filter(row => row.modId === mod.identity.id)
        .map(row => ({
          key: row.key,
          scope_id: row.scope.id,
          scope_kind: row.scope.kind,
          value: row.value,
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
      timers: checkpoint.session.timers
        .filter(timer => timer.modId === mod.identity.id)
        .map(timer => ({
          context: timer.context,
          due_tick: timer.dueTick,
          event: timer.event,
          id: timer.id,
          interval_ticks: timer.intervalTicks,
          node_id: timer.nodeId,
          payload: timer.payload,
          remaining: timer.remaining,
          scope_id: timer.scope.id,
          scope_kind: timer.scope.kind,
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
        enemies: checkpoint.enemies.enemies.map(enemy => ({
          content_id: enemy.contentId,
          current_health: enemy.currentHealth,
          death_tick: enemy.deathTick,
          heading_index: enemy.headingIndex,
          id: enemy.id,
          last_attack_tick: enemy.lastAttackTick,
          last_damaged_by_player_id: enemy.lastDamagedByPlayerId,
          life_state: enemy.lifeState,
          maximum_health: enemy.maximumHealth,
          moving: enemy.moving,
          next_attack_tick: enemy.nextAttackTick,
          spawned_tick: enemy.spawnedTick,
          target_player_id: enemy.targetPlayerId,
          x: enemy.x,
          y: enemy.y,
        })),
        enemy_next_id: checkpoint.enemies.nextId,
        enemy_revision: checkpoint.enemies.revision,
        next_intent_sequence: checkpoint.session.nextIntentSequence,
        next_timer_id: checkpoint.session.nextTimerId,
        powerup_next_id: checkpoint.powerups.nextId,
        powerup_revision: checkpoint.powerups.revision,
        reducer_health: checkpoint.session.reducerHealth.map(row => ({
          disabled: row.disabled,
          failures: row.failures,
          key: row.key,
          mod_id: row.modId,
        })),
        scene_next_epoch: checkpoint.scenes.nextEpoch,
        scenes: checkpoint.scenes.scenes.map(scene => ({
          epoch: scene.epoch,
          owner_id: scene.ownerId,
          parent_content_id: scene.parentContentId,
          room_index: scene.roomIndex,
          scene_content_id: scene.sceneContentId,
        })),
        scene_stacks: checkpoint.scenes.stacks.map(stack => ({
          owner_id: stack.ownerId,
          room_indexes: stack.roomIndexes,
          scene_content_ids: stack.sceneContentIds,
        })),
        semantic_state_revision: checkpoint.semanticState.revision,
        shop_stock: checkpoint.shops.stock.map(stock => ({
          player_id: stock.playerId,
          remaining: stock.remaining,
          restock_tick: stock.restockTick,
          row: stock.row,
          shop_content_id: stock.shopContentId,
        })),
        shop_revision: checkpoint.shops.revision,
        skill_ranks: checkpoint.skills.ranks.map(rank => ({
          content_id: rank.contentId,
          player_id: rank.playerId,
          rank: rank.rank,
        })),
        skill_offers: checkpoint.skills.offers.map(offer => ({
          content_ids: offer.contentIds,
          player_id: offer.playerId,
          sequence: offer.sequence,
        })),
        skill_bindings: checkpoint.skills.bindings.map(binding => ({
          content_id: binding.contentId,
          player_id: binding.playerId,
          slot: binding.slot,
        })),
        skill_revision: checkpoint.skills.revision,
        spell_revision: checkpoint.spells.revision,
        spell_effect_next_id: checkpoint.spellEffects.nextId,
        spell_effect_next_sequence: checkpoint.spellEffects.nextSequence,
        spell_effect_revision: checkpoint.spellEffects.revision,
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
  const timers: PreparedModHostCheckpoint['session']['timers'][number][] = []
  const semanticValues: PreparedModHostCheckpoint['semanticState']['values'][number][] = []
  const spellEffects: PreparedModHostCheckpoint['spellEffects']['effects'][number][] = []
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
    for (const value of array(entry.timers, `${mod.identity.id}.timers`)) {
      const row = object(value, 'mod rule timer')
      const scopeKind = text(row.scope_kind, 'mod timer scope kind')
      if (!(WEB_LUA_SCOPE_KINDS as readonly string[]).includes(scopeKind)) {
        throw new Error('mod timer scope kind is invalid')
      }
      timers.push(Object.freeze({
        context: object(row.context, 'mod timer context'),
        dueTick: nonnegativeInteger(row.due_tick, 'mod timer due tick'),
        event: text(row.event, 'mod timer event'),
        id: positiveInteger(row.id, 'mod timer id'),
        intervalTicks: row.interval_ticks === null
          ? null
          : positiveInteger(row.interval_ticks, 'mod timer interval'),
        modId: mod.identity.id,
        nodeId: text(row.node_id, 'mod timer node'),
        payload: luaValue(row.payload),
        remaining: positiveInteger(row.remaining, 'mod timer remaining'),
        scope: Object.freeze({
          id: text(row.scope_id, 'mod timer scope id'),
          kind: scopeKind as WebLuaScopeKind,
        }),
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
    for (const value of array(entry.spell_effects, `${mod.identity.id}.spell_effects`)) {
      const row = object(value, 'mod spell effect')
      const scopeKind = text(row.scope_kind, 'mod spell effect scope kind')
      if (!(WEB_LUA_SCOPE_KINDS as readonly string[]).includes(scopeKind)) {
        throw new Error('mod spell effect scope kind is invalid')
      }
      const kind = text(row.kind, 'mod spell effect kind')
      if (kind !== 'area' && kind !== 'channel' && kind !== 'projectile') {
        throw new Error('mod spell effect kind is invalid')
      }
      spellEffects.push(Object.freeze({
        contentId: content(row.content_id, mod.identity.id, ownerByContent),
        effects: Object.freeze(array(row.effects, 'mod spell effect templates').map((value) => {
          const template = object(value, 'mod spell effect template')
          return Object.freeze({
            fields: object(template.fields, 'mod spell effect fields'),
            kind: text(template.kind, 'mod spell effect template kind'),
          })
        })),
        expiresTick: positiveInteger(row.expires_tick, 'mod spell effect expiry'),
        hitTargets: Object.freeze(array(row.hit_targets, 'mod spell hit targets').map(value => (
          text(value, 'mod spell hit target')
        ))),
        id: positiveInteger(row.id, 'mod spell effect id'),
        intervalTicks: positiveInteger(row.interval_ticks, 'mod spell effect interval'),
        kind,
        lastTick: nonnegativeInteger(row.last_tick, 'mod spell effect last tick'),
        modId: mod.identity.id,
        nextPulseTick: nonnegativeInteger(row.next_pulse_tick, 'mod spell effect next pulse'),
        ownerPlayerId: text(row.owner_player_id, 'mod spell effect owner'),
        radius: finite(row.radius, 'mod spell effect radius'),
        scope: Object.freeze({
          id: text(row.scope_id, 'mod spell effect scope id'),
          kind: scopeKind as WebLuaScopeKind,
        }),
        speedPerTick: finite(row.speed_per_tick, 'mod spell effect speed'),
        startedTick: nonnegativeInteger(row.started_tick, 'mod spell effect start'),
        targetX: finite(row.target_x, 'mod spell effect target x'),
        targetY: finite(row.target_y, 'mod spell effect target y'),
        x: finite(row.x, 'mod spell effect x'),
        y: finite(row.y, 'mod spell effect y'),
      }))
    }
    for (const value of array(entry.state_values, `${mod.identity.id}.state_values`)) {
      const row = object(value, 'mod semantic state')
      const scopeKind = text(row.scope_kind, 'mod semantic state scope kind')
      if (!(WEB_LUA_SCOPE_KINDS as readonly string[]).includes(scopeKind)) {
        throw new Error('mod semantic state scope kind is invalid')
      }
      semanticValues.push(Object.freeze({
        key: text(row.key, 'mod semantic state key'),
        modId: mod.identity.id,
        scope: Object.freeze({
          id: text(row.scope_id, 'mod semantic state scope id'),
          kind: scopeKind as WebLuaScopeKind,
        }),
        value: luaValue(row.value),
      }))
    }
    if (index > 0 && entry.runtime !== undefined) throw new Error('mod runtime metadata is duplicated')
  }
  const enemies = array(runtime.enemies, 'mod enemies').map((value) => {
    const row = object(value, 'mod enemy')
    return Object.freeze({
      contentId: text(row.content_id, 'mod enemy content'),
      currentHealth: finite(row.current_health, 'mod enemy health'),
      deathTick: row.death_tick === null ? null : nonnegativeInteger(row.death_tick, 'mod enemy death'),
      headingIndex: nonnegativeInteger(row.heading_index, 'mod enemy heading'),
      id: positiveInteger(row.id, 'mod enemy id'),
      lastAttackTick: row.last_attack_tick === null
        ? null
        : nonnegativeInteger(row.last_attack_tick, 'mod enemy last attack'),
      lastDamagedByPlayerId: row.last_damaged_by_player_id === null
        ? null
        : text(row.last_damaged_by_player_id, 'mod enemy damage owner'),
      lifeState: text(row.life_state, 'mod enemy life') as 'alive' | 'dying',
      maximumHealth: finite(row.maximum_health, 'mod enemy maximum health'),
      moving: boolean(row.moving, 'mod enemy moving'),
      nextAttackTick: nonnegativeInteger(row.next_attack_tick, 'mod enemy next attack'),
      spawnedTick: nonnegativeInteger(row.spawned_tick, 'mod enemy spawn'),
      targetPlayerId: row.target_player_id === null ? null : text(row.target_player_id, 'mod enemy target'),
      x: finite(row.x, 'mod enemy x'),
      y: finite(row.y, 'mod enemy y'),
    })
  })
  const scenes = array(runtime.scenes, 'mod scenes').map((value) => {
    const row = object(value, 'mod scene')
    return Object.freeze({
      epoch: positiveInteger(row.epoch, 'mod scene epoch'),
      ownerId: text(row.owner_id, 'mod scene owner'),
      parentContentId: row.parent_content_id === null ? null : text(row.parent_content_id, 'mod scene parent'),
      roomIndex: nonnegativeInteger(row.room_index, 'mod scene room'),
      sceneContentId: text(row.scene_content_id, 'mod scene content'),
    })
  })
  const stacks = array(runtime.scene_stacks, 'mod scene stacks').map((value) => {
    const row = object(value, 'mod scene stack')
    return Object.freeze({
      ownerId: text(row.owner_id, 'mod scene stack owner'),
      roomIndexes: Object.freeze(array(row.room_indexes, 'mod scene stack rooms').map(value => (
        nonnegativeInteger(value, 'mod scene stack room')
      ))),
      sceneContentIds: Object.freeze(array(row.scene_content_ids, 'mod scene stack ids').map(value => (
        text(value, 'mod scene stack id')
      ))),
    })
  })
  const stock = array(runtime.shop_stock, 'mod shop stock').map((value) => {
    const row = object(value, 'mod shop stock row')
    return Object.freeze({
      playerId: text(row.player_id, 'mod shop player'),
      remaining: nonnegativeInteger(row.remaining, 'mod shop remaining'),
      restockTick: row.restock_tick === null
        ? null
        : nonnegativeInteger(row.restock_tick, 'mod shop restock tick'),
      row: nonnegativeInteger(row.row, 'mod shop row'),
      shopContentId: text(row.shop_content_id, 'mod shop content'),
    })
  })
  const ranks = array(runtime.skill_ranks, 'mod skill ranks').map((value) => {
    const row = object(value, 'mod skill rank')
    return Object.freeze({
      contentId: text(row.content_id, 'mod skill content'),
      playerId: text(row.player_id, 'mod skill player'),
      rank: positiveInteger(row.rank, 'mod skill rank'),
    })
  })
  const offers = array(runtime.skill_offers, 'mod skill offers').map((value) => {
    const row = object(value, 'mod skill offer')
    return Object.freeze({
      contentIds: Object.freeze(array(row.content_ids, 'mod skill offer ids').map(value => (
        text(value, 'mod skill offer id')
      ))),
      playerId: text(row.player_id, 'mod skill offer player'),
      sequence: positiveInteger(row.sequence, 'mod skill offer sequence'),
    })
  })
  const reducerHealth = array(runtime.reducer_health, 'mod reducer health').map((value) => {
    const row = object(value, 'mod reducer health row')
    return Object.freeze({
      disabled: boolean(row.disabled, 'mod reducer disabled'),
      failures: nonnegativeInteger(row.failures, 'mod reducer failures'),
      key: text(row.key, 'mod reducer key'),
      modId: text(row.mod_id, 'mod reducer owner'),
    })
  })
  const bindings = array(runtime.skill_bindings, 'mod skill bindings').map((value) => {
    const row = object(value, 'mod skill binding')
    return Object.freeze({
      contentId: text(row.content_id, 'mod skill binding content'),
      playerId: text(row.player_id, 'mod skill binding player'),
      slot: nonnegativeInteger(row.slot, 'mod skill binding slot'),
    })
  })
  return Object.freeze({
    enemies: Object.freeze({
      enemies: Object.freeze(enemies),
      nextId: positiveInteger(runtime.enemy_next_id, 'mod enemy next id'),
      revision: nonnegativeInteger(runtime.enemy_revision, 'mod enemy revision'),
    }),
    powerups: Object.freeze({
      instances: Object.freeze(powerups),
      nextId: positiveInteger(runtime.powerup_next_id, 'mod powerup next id'),
      revision: nonnegativeInteger(runtime.powerup_revision, 'mod powerup revision'),
    }),
    session: Object.freeze({
      graphSha256: Object.freeze(mods.map(mod => mod.graphSha256)),
      nextIntentSequence: positiveInteger(
        runtime.next_intent_sequence,
        'mod next intent sequence',
      ),
      nextTimerId: positiveInteger(runtime.next_timer_id, 'mod next timer id'),
      reducerHealth: Object.freeze(reducerHealth),
      state: Object.freeze({
        cells: Object.freeze(cells),
        revision: nonnegativeInteger(runtime.state_revision, 'mod state revision'),
      }),
      timers: Object.freeze(timers),
    }),
    scenes: Object.freeze({
      nextEpoch: positiveInteger(runtime.scene_next_epoch, 'mod scene next epoch'),
      scenes: Object.freeze(scenes),
      stacks: Object.freeze(stacks),
    }),
    semanticState: Object.freeze({
      revision: nonnegativeInteger(
        runtime.semantic_state_revision,
        'mod semantic state revision',
      ),
      values: Object.freeze(semanticValues),
    }),
    shops: Object.freeze({
      revision: nonnegativeInteger(runtime.shop_revision, 'mod shop revision'),
      stock: Object.freeze(stock),
    }),
    skills: Object.freeze({
      bindings: Object.freeze(bindings),
      offers: Object.freeze(offers),
      ranks: Object.freeze(ranks),
      revision: nonnegativeInteger(runtime.skill_revision, 'mod skill revision'),
    }),
    spells: Object.freeze({
      cooldowns: Object.freeze(cooldowns),
      revision: nonnegativeInteger(runtime.spell_revision, 'mod spell revision'),
    }),
    spellEffects: Object.freeze({
      effects: Object.freeze(spellEffects),
      nextId: positiveInteger(runtime.spell_effect_next_id, 'mod spell effect next id'),
      nextSequence: positiveInteger(
        runtime.spell_effect_next_sequence,
        'mod spell effect next sequence',
      ),
      revision: nonnegativeInteger(runtime.spell_effect_revision, 'mod spell effect revision'),
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

function boolean(value: LuaConsoleValue | undefined, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} is invalid`)
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

import { LuaMultiReturn, type LuaEngine } from 'wasmoon'

import type { LuaConsoleValue } from '../../protocol/game-protocol.ts'
import {
  WEB_LUA_API_VERSION,
  WEB_LUA_CAPABILITIES,
  WEB_LUA_EVENT_NAMES,
  WEB_LUA_MAX_STATE_BYTES,
  WEB_LUA_MAX_STATE_KEYS,
  WEB_LUA_STOCK_ENEMIES,
  type WebLuaCommand,
  type WebLuaDeveloperBindings,
  type WebLuaEventName,
  type WebLuaFilterName,
  type WebLuaFrameState,
  type WebLuaModIdentity,
} from './web-lua-contract.ts'
import type { WebLuaContentModBinding } from './web-lua-content-registry.ts'
import {
  WEB_LUA_DEVELOPER_ITEMS,
  WEB_LUA_DEVELOPER_SKILLS,
  WEB_LUA_DEVELOPER_WELDS,
  webLuaDeveloperItemExists,
  webLuaDeveloperSkill,
  webLuaDeveloperWeld,
} from './web-lua-developer-grants.ts'
import {
  encodedByteLength,
  luaObjectString,
  normalizeLuaValue,
  requireFiniteWithin,
  requireHandle,
  requireIntegerWithin,
  requireNonnegativeSafeInteger,
  requireStateKey,
  requireStockEnemy,
  requireString,
  stockEnemyDescriptor,
  stockEnemyDescriptorForLua,
  webLuaPlayerState,
  webLuaSceneState,
} from './web-lua-values.ts'

const capabilitySet = new Set<string>(WEB_LUA_CAPABILITIES)

interface WebLuaApiBindings {
  addCallback(name: unknown, callback: unknown): boolean
  addFilter(name: unknown, callback: unknown): boolean
  addTimer(delayMs: unknown, callback: unknown, repeating: boolean): number
  addTimerSequence(steps: unknown): number
  cancelTimer(handle: number): boolean
  clearTimers(): number
  currentTick(): number
  developer?: WebLuaDeveloperBindings
  getActivePlayerId(): string | null
  getAuthorityPlayerId(): string | null
  getFrame(): WebLuaFrameState
  now(): number
  print(values: readonly unknown[]): void
  queueCommand(command: WebLuaCommand): void
  submitFilterResult(value: unknown): void
}

export class WebLuaApi {
  readonly #bindings: WebLuaApiBindings
  readonly #content: WebLuaContentModBinding | null
  readonly #mod: WebLuaModIdentity
  readonly #state = new Map<string, LuaConsoleValue>()
  readonly #stateEntryBytes = new Map<string, number>()
  #nextSpawnRequestId = 1
  #selectedRunId: string | null = null
  #selectedRunSeed: number | null = null
  #stateEntryBytesTotal = 0
  #stateRevision = 0

  constructor(
    bindings: WebLuaApiBindings,
    mod: WebLuaModIdentity,
    content: WebLuaContentModBinding | null = null,
  ) {
    this.#bindings = bindings
    this.#content = content
    this.#mod = Object.freeze({
      id: requireString(mod.id, 'mod id', 128),
      name: requireString(mod.name, 'mod name', 128),
      version: requireString(mod.version, 'mod version', 128),
    })
  }

  install(engine: LuaEngine): void {
    engine.global.set(
      '__sd_submit_filter_result',
      (value: unknown) => this.#bindings.submitFilterResult(value),
    )
    engine.global.set('print', (...values: unknown[]) => this.#bindings.print(values))
    engine.global.set('sd', {
      ...(this.#bindings.developer ? {
        bots: {
          summon: (options?: unknown) => this.#summonBot(options),
        },
        dev: {
          grant_gold: (amount: unknown, playerId?: unknown) => (
            this.#grantGold(amount, playerId)
          ),
          grant_item: (
            itemKey: unknown,
            quantity?: unknown,
            playerId?: unknown,
          ) => this.#grantItem(itemKey, quantity, playerId),
          grant_skill: (
            skillId: unknown,
            ranks?: unknown,
            playerId?: unknown,
          ) => this.#grantSkill(skillId, ranks, playerId),
          grant_weld: (buildId: unknown, playerId?: unknown) => (
            this.#grantWeld(buildId, playerId)
          ),
          list_items: () => WEB_LUA_DEVELOPER_ITEMS.map(item => ({
            key: item.key,
            kind: item.kind,
            name: item.name,
            native_type_id: item.native_type_id,
            ...(item.native_subtype === null
              ? {}
              : { native_subtype: item.native_subtype }),
            ...(item.recipe_index === null
              ? {}
              : { recipe_index: item.recipe_index }),
          })),
          list_skills: () => WEB_LUA_DEVELOPER_SKILLS.map(skill => ({ ...skill })),
          list_welds: () => WEB_LUA_DEVELOPER_WELDS.map(weld => ({
            ...weld,
            component_skill_ids: [...weld.component_skill_ids],
          })),
        },
      } : {}),
      enemies: {
        get: (identity: unknown) => {
          const descriptor = stockEnemyDescriptor(identity)
          return descriptor ? stockEnemyDescriptorForLua(descriptor) : null
        },
        list: () => WEB_LUA_STOCK_ENEMIES.map(stockEnemyDescriptorForLua),
        spawn: (identity: unknown, options: unknown) => this.#spawnEnemy(identity, options),
      },
      events: {
        names: () => [...WEB_LUA_EVENT_NAMES],
        on: (name: unknown, callback: unknown) => this.#bindings.addCallback(name, callback),
        ...(this.#content ? {
          filter: (name: unknown, callback: unknown) => this.#bindings.addFilter(
            name as WebLuaFilterName,
            callback,
          ),
        } : {}),
      },
      gameplay: {
        get_combat_state: () => this.#combatState(),
        get_state: () => {
          const frame = this.#bindings.getFrame()
          return { phase: frame.phase, run_id: frame.runId, tick: frame.tick }
        },
      },
      hub: {
        get_surface_state: () => this.#hubSurfaceState(),
      },
      ...(this.#content ? {
        items: {
          get: (identity: unknown) => this.#content!.item(identity),
          list: () => this.#content!.items(),
          register: (definition: unknown) => this.#content!.registerItem(definition),
        },
        loot: {
          list: () => this.#content!.loot(),
          register: (definition: unknown) => this.#content!.registerLoot(definition),
        },
      } : {}),
      player: {
        get_state: (playerId?: unknown) => webLuaPlayerState(this.#resolvePlayer(playerId)),
        grant_experience: (amount: unknown, playerId?: unknown) => this.#queuePlayerCommand({
          amount: requireFiniteWithin(amount, 'experience amount', 0, 10_000_000),
          type: 'grant-experience',
        }, playerId),
        list: () => this.#bindings.getFrame().players.map(webLuaPlayerState),
        restore_health: (amount: unknown, playerId?: unknown) => this.#queuePlayerCommand({
          amount: requireFiniteWithin(amount, 'health amount', 0, 10_000_000),
          type: 'restore-health',
        }, playerId),
        restore_mana: (...args: unknown[]) => this.#restoreMana(args),
        set_gold: (value: unknown, playerId?: unknown) => this.#queuePlayerCommand({
          type: 'set-gold',
          value: requireIntegerWithin(value, 'gold', 0, 10_000_000),
        }, playerId),
        set_mana: (value: unknown, playerId?: unknown) => this.#queuePlayerCommand({
          type: 'set-mana',
          value: requireFiniteWithin(value, 'mana', 0, 10_000_000),
        }, playerId),
      },
      rng: {
        get_seed: () => this.#selectedRunSeed,
        set_seed: (seed: unknown) => this.#setRunSeed(seed),
      },
      runtime: {
        api_version: WEB_LUA_API_VERSION,
        get_capabilities: () => [...WEB_LUA_CAPABILITIES],
        get_frame_state: () => ({
          ...this.#bindings.getFrame(),
          frame_count: this.#bindings.currentTick(),
          observed_ms: Math.floor(this.#bindings.now()),
        }),
        get_mod: () => ({
          api_version: WEB_LUA_API_VERSION,
          ...this.#mod,
        }),
        get_multiplayer_state: () => this.#multiplayerState(),
        has_capability: (capability: unknown) => capabilitySet.has(
          requireString(capability, 'capability', 128),
        ),
      },
      scene: {
        get_state: () => webLuaSceneState(this.#bindings.getFrame()),
      },
      state: {
        clear: () => this.#clearState(),
        delete: (key: unknown) => this.#deleteState(key),
        get: (key: unknown, fallback?: unknown) => this.#getState(key, fallback),
        get_revision: () => this.#stateRevision,
        is_authority: () => this.#isAuthority(),
        set: (key: unknown, value: unknown) => this.#setState(key, value),
        snapshot: () => Object.fromEntries(this.#state),
      },
      ...(this.#content ? {
        sprites: {
          get: (key: unknown) => this.#content!.sprite(key),
          list: () => this.#content!.sprites(),
          register: (key: unknown, image: unknown, bundle: unknown) => (
            this.#content!.registerSprite(key, image, bundle)
          ),
          unregister: (key: unknown) => this.#content!.unregisterSprite(key),
        },
      } : {}),
      timer: {
        after: (delayMs: unknown, callback: unknown) => this.#bindings.addTimer(
          delayMs,
          callback,
          false,
        ),
        cancel: (handle: unknown) => this.#bindings.cancelTimer(requireHandle(handle)),
        clear: () => this.#bindings.clearTimers(),
        every: (intervalMs: unknown, callback: unknown) => this.#bindings.addTimer(
          intervalMs,
          callback,
          true,
        ),
        sequence: (steps: unknown) => this.#bindings.addTimerSequence(steps),
      },
      waves: {
        get_state: () => this.#bindings.getFrame().waves,
      },
      world: {
        get_scene: () => webLuaSceneState(this.#bindings.getFrame()),
        get_state: () => this.#worldState(),
        list_actors: () => this.#worldActors(),
      },
    })
  }

  get stateBytes(): number {
    return 2 + this.#stateEntryBytesTotal + Math.max(0, this.#state.size - 1)
  }

  snapshotState(): Readonly<Record<string, LuaConsoleValue>> {
    return Object.fromEntries(this.#state)
  }

  restoreState(source: Readonly<Record<string, LuaConsoleValue>>): void {
    this.#clearState()
    for (const [key, value] of Object.entries(source)) this.#setState(key, value)
  }

  close(): void {
    this.#state.clear()
    this.#stateEntryBytes.clear()
    this.#stateEntryBytesTotal = 0
    this.#selectedRunId = null
    this.#selectedRunSeed = null
  }

  observeRunLifecycle(name: WebLuaEventName, payload: LuaConsoleValue): void {
    if (name === 'run.started' && this.#selectedRunSeed !== null) {
      const runId = luaObjectString(payload, 'run_id')
      if (runId !== null) this.#selectedRunId = runId
      return
    }
    if (name === 'run.ended' && this.#selectedRunId !== null) {
      this.#selectedRunId = null
      this.#selectedRunSeed = null
    }
  }

  wantsLifecycleEvent(name: Exclude<WebLuaEventName, 'runtime.tick'>): boolean {
    return this.#selectedRunSeed !== null
      && (name === 'run.started' || name === 'run.ended')
  }

  #resolvePlayer(candidate?: unknown) {
    const playerId = candidate === undefined || candidate === null
      ? this.#bindings.getActivePlayerId()
      : requireString(candidate, 'player id', 128)
    if (!playerId) throw new Error('Lua player operation has no active player')
    const player = this.#bindings.getFrame().players.find(({ id }) => id === playerId)
    if (!player) throw new Error(`unknown player: ${playerId}`)
    return player
  }

  #queuePlayerCommand(
    command:
      | Readonly<{
          amount: number
          type: 'grant-experience' | 'restore-health' | 'restore-mana'
        }>
      | Readonly<{ type: 'set-gold' | 'set-mana'; value: number }>,
    candidate?: unknown,
  ): boolean {
    const player = this.#resolvePlayer(candidate)
    this.#bindings.queueCommand({ ...command, playerId: player.id } as WebLuaCommand)
    return true
  }

  #restoreMana(args: readonly unknown[]): LuaMultiReturn {
    if (args.length !== 0) throw new Error('sd.player.restore_mana expects no arguments')
    const player = this.#resolvePlayer()
    this.#bindings.queueCommand({
      amount: Math.max(0, player.maximumMana - player.currentMana),
      playerId: player.id,
      type: 'restore-mana',
    })
    const result = new LuaMultiReturn(2)
    result[0] = true
    result[1] = player.maximumMana
    return result
  }

  #grantGold(amount: unknown, candidate?: unknown): boolean {
    const player = this.#resolvePlayer(candidate)
    this.#bindings.queueCommand({
      amount: requireIntegerWithin(amount, 'Gold grant', 1, 10_000_000),
      playerId: player.id,
      type: 'grant-gold',
    })
    return true
  }

  #grantItem(itemKey: unknown, quantity: unknown, candidate?: unknown): boolean {
    const key = requireString(itemKey, 'developer item key', 128)
    if (!webLuaDeveloperItemExists(key)) throw new Error(`unknown developer item: ${key}`)
    const player = this.#resolvePlayer(candidate)
    this.#bindings.queueCommand({
      itemKey: key,
      playerId: player.id,
      quantity: requireIntegerWithin(quantity ?? 1, 'item quantity', 1, 100),
      type: 'grant-item',
    })
    return true
  }

  #grantSkill(skillId: unknown, ranks: unknown, candidate?: unknown): boolean {
    const id = requireIntegerWithin(skillId, 'skill id', 8, 79)
    const skill = webLuaDeveloperSkill(id)
    if (!skill) throw new Error(`unknown developer skill: ${id}`)
    if (skill.weld_only) {
      throw new Error('Spell Welding must be granted with sd.dev.grant_weld')
    }
    const player = this.#resolvePlayer(candidate)
    this.#bindings.queueCommand({
      playerId: player.id,
      ranks: requireIntegerWithin(ranks ?? 1, 'skill ranks', 1, skill.maximum_rank),
      skillId: id,
      type: 'grant-skill',
    })
    return true
  }

  #grantWeld(buildId: unknown, candidate?: unknown): boolean {
    const id = requireIntegerWithin(buildId, 'Weld build id', 1000, 1009)
    if (!webLuaDeveloperWeld(id)) throw new Error(`unknown native Weld build: ${id}`)
    const player = this.#resolvePlayer(candidate)
    this.#bindings.queueCommand({
      buildId: id,
      playerId: player.id,
      type: 'grant-weld',
    })
    return true
  }

  #spawnEnemy(identity: unknown, options: unknown) {
    const frame = this.#bindings.getFrame()
    if (frame.world !== 'boneyard' || frame.phase !== 'active') {
      throw new Error('sd.enemies.spawn requires an active Boneyard run')
    }
    const descriptor = requireStockEnemy(identity)
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new Error('sd.enemies.spawn options must be a table')
    }
    const source = options as Record<string, unknown>
    const unexpected = Object.keys(source).find((key) => key !== 'x' && key !== 'y')
    if (unexpected) throw new Error(`unsupported sd.enemies.spawn option: ${unexpected}`)
    const x = requireFiniteWithin(source.x, 'enemy x', -1_000_000, 1_000_000)
    const y = requireFiniteWithin(source.y, 'enemy y', -1_000_000, 1_000_000)
    const requestId = this.#nextSpawnRequestId
    this.#nextSpawnRequestId += 1
    this.#bindings.queueCommand({
      requestId,
      token: descriptor.token,
      type: 'spawn-enemy',
      x,
      y,
    })
    return {
      ...stockEnemyDescriptorForLua(descriptor),
      request_id: requestId,
      x,
      y,
    }
  }

  #summonBot(options?: unknown) {
    const source = options === undefined || options === null
      ? {}
      : options
    if (typeof source !== 'object' || Array.isArray(source)) {
      throw new Error('sd.bots.summon options must be a table')
    }
    const values = source as Record<string, unknown>
    const unexpected = Object.keys(values).find((key) => (
      key !== 'discipline' && key !== 'element'
    ))
    if (unexpected) throw new Error(`unsupported sd.bots.summon option: ${unexpected}`)
    const discipline = values.discipline === undefined
      ? 'arcane'
      : requireString(values.discipline, 'bot discipline', 16)
    const element = values.element === undefined
      ? 'fire'
      : requireString(values.element, 'bot element', 16)
    if (!['arcane', 'body', 'mind'].includes(discipline)) {
      throw new Error(`unsupported bot discipline: ${discipline}`)
    }
    if (!['air', 'earth', 'ether', 'fire', 'water'].includes(element)) {
      throw new Error(`unsupported bot element: ${element}`)
    }
    return this.#bindings.developer!.summonBot({
      discipline: discipline as 'arcane' | 'body' | 'mind',
      element: element as 'air' | 'earth' | 'ether' | 'fire' | 'water',
    })
  }

  #setRunSeed(seed: unknown): number {
    const frame = this.#bindings.getFrame()
    if (frame.world !== 'hub' || frame.phase !== 'hub') {
      throw new Error('sd.rng.set_seed may only be called in the Hub before a run')
    }
    const normalized = requireNonnegativeSafeInteger(seed, 'run seed')
    if (normalized < 1 || normalized > 0x3fff_ffff) {
      throw new Error('run seed must be within 1..0x3fffffff')
    }
    this.#selectedRunSeed = normalized
    this.#bindings.queueCommand({ seed: normalized, type: 'set-next-run-seed' })
    return normalized
  }

  #combatState() {
    const frame = this.#bindings.getFrame()
    if (frame.world !== 'boneyard') return null
    return {
      active: frame.phase === 'active',
      run_id: frame.runId,
      tick: frame.tick,
      wave_index: frame.waves?.wave_ordinal ?? 0,
    }
  }

  #hubSurfaceState() {
    const frame = this.#bindings.getFrame()
    return frame.world === 'hub'
      ? {
          active: true,
          player_count: frame.playerCount,
          scene: frame.scene,
          shared_hub: frame.scene === 'hub.courtyard',
          surface_active: true,
          valid: true,
        }
      : {
          active: false,
          player_count: frame.playerCount,
          scene: frame.scene,
          shared_hub: false,
          surface_active: false,
          valid: false,
        }
  }

  #multiplayerState() {
    const frame = this.#bindings.getFrame()
    return {
      authority_player_id: frame.authorityPlayerId,
      is_authority: this.#bindings.getActivePlayerId() === frame.authorityPlayerId,
      participants: frame.players.map(webLuaPlayerState),
      player_count: frame.playerCount,
    }
  }

  #worldState() {
    const frame = this.#bindings.getFrame()
    return {
      enemy_count: frame.enemies.length,
      player_count: frame.playerCount,
      run_id: frame.runId,
      tick: frame.tick,
      world: frame.world,
    }
  }

  #worldActors() {
    const frame = this.#bindings.getFrame()
    return [
      ...frame.players.map((player) => ({
        dead: player.lifeState !== 'alive',
        hp: player.currentHealth,
        id: player.id,
        kind: 'player',
        life_state: player.lifeState,
        max_hp: player.maximumHealth,
        position: { ...player.position },
        tracked_enemy: false,
        x: player.position.x,
        y: player.position.y,
      })),
      ...frame.enemies.map((enemy) => {
        const descriptor = requireStockEnemy(enemy.token)
        return {
          dead: enemy.lifeState !== 'alive',
          enemy_type: descriptor.native_type_id,
          hp: enemy.health,
          id: enemy.id,
          kind: 'enemy',
          life_state: enemy.lifeState,
          max_hp: enemy.maximumHealth,
          network_actor_id: enemy.id,
          object_type_id: descriptor.native_type_id,
          position: { ...enemy.position },
          token: enemy.token,
          tracked_enemy: true,
          x: enemy.position.x,
          y: enemy.position.y,
        }
      }),
    ]
  }

  #getState(key: unknown, fallback: unknown): unknown {
    const normalizedKey = requireStateKey(key)
    return this.#state.has(normalizedKey) ? this.#state.get(normalizedKey) : fallback ?? null
  }

  #setState(key: unknown, value: unknown): number {
    const normalizedKey = requireStateKey(key)
    if (value === undefined || value === null) {
      throw new Error('Lua state values may not be nil; use sd.state.delete')
    }
    const normalizedValue = normalizeLuaValue(value, `state.${normalizedKey}`)
    const hadPrevious = this.#state.has(normalizedKey)
    const entryBytes = encodedByteLength(normalizedKey) + 1 + encodedByteLength(normalizedValue)
    const previousEntryBytes = this.#stateEntryBytes.get(normalizedKey) ?? 0
    const nextSize = this.#state.size + Number(!hadPrevious)
    const nextEntryBytesTotal = this.#stateEntryBytesTotal - previousEntryBytes + entryBytes
    const nextStateBytes = 2 + nextEntryBytesTotal + Math.max(0, nextSize - 1)
    if (nextSize > WEB_LUA_MAX_STATE_KEYS || nextStateBytes > WEB_LUA_MAX_STATE_BYTES) {
      throw new Error('Lua state exceeds its size limit')
    }
    this.#state.set(normalizedKey, normalizedValue)
    this.#stateEntryBytes.set(normalizedKey, entryBytes)
    this.#stateEntryBytesTotal = nextEntryBytesTotal
    this.#stateRevision += 1
    return this.#stateRevision
  }

  #deleteState(key: unknown): boolean {
    const normalizedKey = requireStateKey(key)
    const deleted = this.#state.delete(normalizedKey)
    if (deleted) {
      this.#stateEntryBytesTotal -= this.#stateEntryBytes.get(normalizedKey) ?? 0
      this.#stateEntryBytes.delete(normalizedKey)
      this.#stateRevision += 1
    }
    return deleted
  }

  #clearState(): boolean {
    const cleared = this.#state.size > 0
    this.#state.clear()
    this.#stateEntryBytes.clear()
    this.#stateEntryBytesTotal = 0
    if (cleared) this.#stateRevision += 1
    return cleared
  }

  #isAuthority(): boolean {
    const authorityPlayerId = this.#bindings.getAuthorityPlayerId()
    return authorityPlayerId !== null
      && this.#bindings.getActivePlayerId() === authorityPlayerId
  }
}

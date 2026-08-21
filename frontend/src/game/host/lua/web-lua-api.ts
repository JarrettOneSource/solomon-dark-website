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
  type WebLuaEventName,
  type WebLuaFrameState,
  type WebLuaModIdentity,
} from './web-lua-contract.ts'
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
  addTimer(delayMs: unknown, callback: unknown, repeating: boolean): number
  addTimerSequence(steps: unknown): number
  cancelTimer(handle: number): boolean
  clearTimers(): number
  currentTick(): number
  getActivePlayerId(): string | null
  getAuthorityPlayerId(): string | null
  getFrame(): WebLuaFrameState
  now(): number
  print(values: readonly unknown[]): void
  queueCommand(command: WebLuaCommand): void
}

export class WebLuaApi {
  readonly #bindings: WebLuaApiBindings
  readonly #mod: WebLuaModIdentity
  readonly #state = new Map<string, LuaConsoleValue>()
  readonly #stateEntryBytes = new Map<string, number>()
  #nextSpawnRequestId = 1
  #selectedRunId: string | null = null
  #selectedRunSeed: number | null = null
  #stateEntryBytesTotal = 0
  #stateRevision = 0

  constructor(bindings: WebLuaApiBindings, mod: WebLuaModIdentity) {
    this.#bindings = bindings
    this.#mod = Object.freeze({
      id: requireString(mod.id, 'mod id', 128),
      name: requireString(mod.name, 'mod name', 128),
      version: requireString(mod.version, 'mod version', 128),
    })
  }

  install(engine: LuaEngine): void {
    engine.global.set('print', (...values: unknown[]) => this.#bindings.print(values))
    engine.global.set('sd', {
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

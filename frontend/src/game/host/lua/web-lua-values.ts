import {
  MAX_LUA_CONSOLE_OUTPUT_LINE_LENGTH,
  MAX_LUA_CONSOLE_VALUE_DEPTH,
  MAX_LUA_CONSOLE_VALUE_FIELDS,
  MAX_LUA_CONSOLE_VALUE_NODES,
  MAX_LUA_CONSOLE_VALUE_STRING_LENGTH,
  type LuaConsoleObject,
  type LuaConsoleValue,
} from '../../protocol/game-protocol.ts'
import {
  WEB_LUA_MAX_STATE_KEY_LENGTH,
  WEB_LUA_STOCK_ENEMIES,
  type WebLuaFrameState,
} from './web-lua-contract.ts'

const encoder = new TextEncoder()

export function webLuaSceneState(frame: WebLuaFrameState) {
  const kind = frame.world === 'boneyard' ? 'arena' : 'hub'
  return {
    can_enter_run: frame.world === 'hub' && frame.phase === 'hub',
    can_switch_region: false,
    is_authority: frame.authorityPlayerId !== null,
    kind,
    name: frame.scene,
    run_id: frame.runId,
    scene_id: frame.runId ?? frame.scene,
    scene_key: frame.scene,
    seed: frame.boneyardSeed,
    tick: frame.tick,
    transitioning: false,
    web_world: frame.world,
  }
}

export function webLuaPlayerState(player: WebLuaFrameState['players'][number]) {
  return {
    currentHealth: player.currentHealth,
    currentMana: player.currentMana,
    dead: player.lifeState !== 'alive',
    death_tick: player.deathTick,
    discipline: player.discipline,
    display_name: player.displayName,
    element: player.element,
    experience: player.experience,
    gold: player.gold,
    hp: player.currentHealth,
    id: player.id,
    level: player.level,
    life_state: player.lifeState,
    max_hp: player.maximumHealth,
    max_mp: player.maximumMana,
    mp: player.currentMana,
    pending_level_up: player.pendingLevelUp,
    position: { ...player.position },
    x: player.position.x,
    xp: player.experience,
    y: player.position.y,
  }
}

export function normalizeLuaValue(value: unknown, field: string): LuaConsoleValue {
  const budget = { nodes: 0, seen: new WeakSet<object>() }
  const normalized = normalizeLuaValueNode(value, field, budget, 0)
  if (encodedByteLength(normalized) > 32 * 1024) {
    throw new Error(`${field} exceeds 32 KiB`)
  }
  return normalized
}

export function normalizeLuaValues(
  values: readonly unknown[],
  field: string,
): readonly LuaConsoleValue[] {
  const budget = { nodes: 0, seen: new WeakSet<object>() }
  return values.map((value, index) => normalizeLuaValueNode(
    value,
    `${field} ${index + 1}`,
    budget,
    0,
  ))
}

function normalizeLuaValueNode(
  value: unknown,
  field: string,
  budget: { nodes: number; seen: WeakSet<object> },
  depth: number,
): LuaConsoleValue {
  budget.nodes += 1
  if (budget.nodes > MAX_LUA_CONSOLE_VALUE_NODES) throw new Error(`${field} exceeds the node limit`)
  if (depth > MAX_LUA_CONSOLE_VALUE_DEPTH) throw new Error(`${field} exceeds the depth limit`)
  if (value === undefined || value === null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return requireFinite(value, field)
  if (typeof value === 'string') {
    if (utf8ByteLength(value) > MAX_LUA_CONSOLE_VALUE_STRING_LENGTH) {
      throw new Error(`${field} exceeds the string limit`)
    }
    return value
  }
  if (typeof value !== 'object') throw new Error(`${field} has unsupported Lua type`)
  if (budget.seen.has(value)) throw new Error(`${field} is cyclic`)
  budget.seen.add(value)
  try {
    if (Array.isArray(value)) {
      if (value.length > MAX_LUA_CONSOLE_VALUE_FIELDS) {
        throw new Error(`${field} exceeds the array limit`)
      }
      return value.map((entry, index) => normalizeLuaValueNode(
        entry,
        `${field}[${index}]`,
        budget,
        depth + 1,
      ))
    }
    const entries = Object.entries(value)
    if (entries.length > MAX_LUA_CONSOLE_VALUE_FIELDS) {
      throw new Error(`${field} exceeds the field limit`)
    }
    return Object.fromEntries(entries.map(([key, entry]) => {
      if (key.length === 0 || utf8ByteLength(key) > 128) {
        throw new Error(`${field} has invalid key`)
      }
      return [key, normalizeLuaValueNode(entry, `${field}.${key}`, budget, depth + 1)]
    }))
  } finally {
    budget.seen.delete(value)
  }
}

export function printableLuaValue(value: unknown): string {
  if (typeof value === 'string') return value
  const normalized = normalizeLuaValue(value, 'print value')
  return typeof normalized === 'object' && normalized !== null
    ? JSON.stringify(normalized)
    : String(normalized)
}

export function luaObjectString(value: LuaConsoleValue, key: string): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = (value as LuaConsoleObject)[key]
  return typeof candidate === 'string' ? candidate : null
}

export function boundedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return truncateUtf8(message, MAX_LUA_CONSOLE_OUTPUT_LINE_LENGTH)
}

export function requireString(value: unknown, field: string, maximum: number): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || utf8ByteLength(value) > maximum
  ) {
    throw new Error(`${field} must be nonempty text of at most ${maximum} bytes`)
  }
  return value
}

export function encodedByteLength(value: unknown): number {
  return utf8ByteLength(JSON.stringify(value))
}

export function utf8ByteLength(value: string): number {
  return encoder.encode(value).byteLength
}

function truncateUtf8(value: string, maximumBytes: number): string {
  if (utf8ByteLength(value) <= maximumBytes) return value
  let low = 0
  let high = value.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (utf8ByteLength(value.slice(0, middle)) <= maximumBytes) low = middle
    else high = middle - 1
  }
  while (low > 0 && utf8ByteLength(value.slice(0, low)) > maximumBytes) low -= 1
  return value.slice(0, low)
}

export function requireStateKey(value: unknown): string {
  return requireString(value, 'state key', WEB_LUA_MAX_STATE_KEY_LENGTH)
}

export function requireFinite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be finite`)
  }
  return value
}

export function requireNonnegativeFinite(value: unknown, field: string): number {
  const normalized = requireFinite(value, field)
  if (normalized < 0) throw new Error(`${field} must be non-negative`)
  return normalized
}

export function requireFiniteWithin(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  const normalized = requireFinite(value, field)
  if (normalized < minimum || normalized > maximum) {
    throw new Error(`${field} must be within ${minimum}..${maximum}`)
  }
  return normalized
}

export function requireNonnegativeInteger(value: unknown, field: string): number {
  const normalized = requireNonnegativeFinite(value, field)
  if (!Number.isSafeInteger(normalized)) throw new Error(`${field} must be a safe integer`)
  return normalized
}

export function requireNonnegativeSafeInteger(value: unknown, field: string): number {
  return requireNonnegativeInteger(value, field)
}

export function requireIntegerWithin(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  const normalized = requireNonnegativeSafeInteger(value, field)
  if (normalized < minimum || normalized > maximum) {
    throw new Error(`${field} must be within ${minimum}..${maximum}`)
  }
  return normalized
}

export function requireHandle(value: unknown): number {
  const handle = requireNonnegativeInteger(value, 'handle')
  if (handle === 0) throw new Error('handle must be positive')
  return handle
}

export function requireStockEnemy(value: unknown): typeof WEB_LUA_STOCK_ENEMIES[number] {
  const descriptor = stockEnemyDescriptor(value)
  if (!descriptor) throw new Error(`unknown stock enemy: ${String(value)}`)
  return descriptor
}

export function stockEnemyDescriptor(
  value: unknown,
): typeof WEB_LUA_STOCK_ENEMIES[number] | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const normalized = typeof value === 'string' ? value.toLowerCase() : value
  return WEB_LUA_STOCK_ENEMIES.find((descriptor) => (
    descriptor.key === normalized
    || descriptor.token.toLowerCase() === normalized
    || descriptor.native_type_id === normalized
  )) ?? null
}

export function stockEnemyDescriptorForLua(
  descriptor: typeof WEB_LUA_STOCK_ENEMIES[number],
) {
  return {
    base: descriptor.base,
    key: descriptor.key,
    native_type_id: descriptor.native_type_id,
  }
}

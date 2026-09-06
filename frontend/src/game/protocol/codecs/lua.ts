import {
  MAX_LUA_CONSOLE_VALUE_DEPTH,
  MAX_LUA_CONSOLE_VALUE_FIELDS,
  MAX_LUA_CONSOLE_VALUE_NODES,
  MAX_LUA_CONSOLE_VALUE_STRING_LENGTH,
} from '../game-protocol-limits.ts'
import {
  GameProtocolError,
  boundedString,
  byteLimitedString,
  finite,
  limitedArray,
  record,
} from './values.ts'

export interface LuaConsoleArray extends ReadonlyArray<LuaConsoleValue> {}

export interface LuaConsoleObject {
  readonly [key: string]: LuaConsoleValue
}

export type LuaConsoleValue =
  | null
  | boolean
  | number
  | string
  | LuaConsoleArray
  | LuaConsoleObject

export function luaConsoleValue(
  value: unknown,
  field: string,
  budget: { nodes: number },
  depth: number,
): LuaConsoleValue {
  budget.nodes += 1
  if (budget.nodes > MAX_LUA_CONSOLE_VALUE_NODES) {
    throw new GameProtocolError(`${field} exceeds the Lua value node limit`)
  }
  if (depth > MAX_LUA_CONSOLE_VALUE_DEPTH) {
    throw new GameProtocolError(`${field} exceeds the Lua value depth limit`)
  }
  if (value === null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return finite(value, field)
  if (typeof value === 'string') {
    return boundedString(value, field, MAX_LUA_CONSOLE_VALUE_STRING_LENGTH)
  }
  if (Array.isArray(value)) {
    return limitedArray(value, field, MAX_LUA_CONSOLE_VALUE_FIELDS).map(
      (entry, index) => luaConsoleValue(entry, `${field}[${index}]`, budget, depth + 1),
    )
  }
  const source = record(value, field)
  const entries = Object.entries(source)
  if (entries.length > MAX_LUA_CONSOLE_VALUE_FIELDS) {
    throw new GameProtocolError(`${field} has too many Lua value fields`)
  }
  return Object.fromEntries(entries.map(([key, entry]) => [
    byteLimitedString(key, `${field} key`, 128),
    luaConsoleValue(entry, `${field}.${key}`, budget, depth + 1),
  ]))
}

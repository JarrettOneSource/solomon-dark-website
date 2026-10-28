import type { WebLuaDefinitionValue } from './web-lua-definition-types.ts'

export function isWebLuaRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function isWebLuaToken<TKind extends string>(
  value: unknown,
  kind: TKind,
): value is Record<string, unknown> & { kind: TKind } {
  return isWebLuaRecord(value) && value.kind === kind
}

export function cloneWebLuaDefinitionRecord(
  source: Record<string, unknown>,
  field: string,
): Readonly<Record<string, WebLuaDefinitionValue>> {
  return cloneWebLuaValue(source, field, true) as Readonly<Record<string, WebLuaDefinitionValue>>
}

export function webLuaPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(webLuaPayload)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([, child]) => child !== null && child !== undefined)
    .map(([key, child]) => [key, webLuaPayload(child)]))
}

export function cloneWebLuaRuntimeValue(value: unknown, field: string): unknown {
  return cloneWebLuaValue(value, field, false)
}

function cloneWebLuaValue(value: unknown, field: string, freeze: boolean): unknown {
  const seen = new WeakSet<object>()
  let nodes = 0
  const clone = (candidate: unknown, path: string, depth: number): unknown => {
    nodes += 1
    if (nodes > 65_536) throw new Error(`${field} exceeds its node limit`)
    if (depth > 32) throw new Error(`${path} exceeds its nesting limit`)
    if (candidate === undefined || candidate === null) return null
    if (typeof candidate === 'boolean' || typeof candidate === 'string') return candidate
    if (typeof candidate === 'number') {
      if (!Number.isFinite(candidate)) throw new Error(`${path} must be finite`)
      return candidate
    }
    if (typeof candidate === 'function') throw new Error(`${path} may not contain a function`)
    if (typeof candidate !== 'object') throw new Error(`${path} contains unsupported data`)
    if (seen.has(candidate)) throw new Error(`${path} is cyclic`)
    seen.add(candidate)
    try {
      if (Array.isArray(candidate)) {
        const result = candidate.map((entry, index) => clone(entry, `${path}[${index}]`, depth + 1))
        return freeze ? Object.freeze(result) : result
      }
      const result = Object.fromEntries(Object.entries(candidate).map(([key, entry]) => [
        key,
        clone(entry, `${path}.${key}`, depth + 1),
      ]))
      return freeze ? Object.freeze(result) : result
    } finally {
      seen.delete(candidate)
    }
  }
  return clone(value, field, 0)
}

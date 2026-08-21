import type { LuaConsoleObject, LuaConsoleValue } from '../../protocol/game-protocol.ts'
import type { WebLuaFilterName } from './web-lua-contract.ts'
import { normalizeLuaValue } from './web-lua-values.ts'

const MAXIMUM_ABSOLUTE_DELTA = 1_000_000

export interface WebLuaFilterOutcome {
  readonly canceled: boolean
  readonly payload: LuaConsoleObject
}

export function applyWebLuaFilterResult(
  name: WebLuaFilterName,
  payload: LuaConsoleObject,
  rawResult: unknown,
): WebLuaFilterOutcome {
  const decoded = typeof rawResult === 'string' && rawResult.startsWith('sd-filter:')
    ? decodeFilterToken(rawResult.slice('sd-filter:'.length))
    : rawResult
  const result = normalizeLuaValue(decoded, `${name} filter result`)
  if (result === null || result === true) return { canceled: false, payload }
  if (result === false) return { canceled: true, payload }
  if (typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('filter handler must return nil, a boolean, or a table')
  }
  const patch = result as LuaConsoleObject
  if (patch.cancel !== undefined && typeof patch.cancel !== 'boolean') {
    throw new Error('filter cancel must be a boolean')
  }
  if (patch.cancel === true) return { canceled: true, payload }
  return {
    canceled: false,
    payload: name === 'mana.changing'
      ? manaPatch(payload, patch)
      : damagePatch(payload, patch),
  }
}

function decodeFilterToken(token: string): unknown {
  if (token === 'keep') return null
  if (token === 'cancel') return false
  if (!token.startsWith('patch')) return token
  const patch: Record<string, unknown> = {}
  for (const part of token.split(';').slice(1)) {
    const separator = part.indexOf('=')
    if (separator < 1) throw new Error('filter patch token is malformed')
    const field = part.slice(0, separator)
    const value = part.slice(separator + 1)
    if (field === 'lanes') {
      patch.lanes = value.split(',').map(entry => entry === '_' ? null : Number(entry))
    } else {
      patch[field] = Number(value)
    }
  }
  return patch
}

function manaPatch(
  payload: LuaConsoleObject,
  patch: LuaConsoleObject,
): LuaConsoleObject {
  if (patch.delta === undefined) return payload
  const delta = boundedNumber(patch.delta, 'mana delta')
  const currentMana = boundedNumber(payload.current_mana, 'current mana')
  return {
    ...payload,
    delta,
    resulting_mana: currentMana + delta,
  }
}

function damagePatch(
  payload: LuaConsoleObject,
  patch: LuaConsoleObject,
): LuaConsoleObject {
  const current = payload.lanes
  if (!Array.isArray(current) || current.length !== 9) {
    throw new Error('damage filter payload must contain nine lanes')
  }
  const lanes = current.map((value, index) => boundedNumber(value, `damage lane ${index + 1}`))
  if (patch.lanes !== undefined) {
    if (Array.isArray(patch.lanes)) {
      patch.lanes.forEach((value, index) => {
        if (value !== null && index < lanes.length) lanes[index] = boundedNumber(value, `damage lane ${index + 1}`)
      })
    } else if (patch.lanes && typeof patch.lanes === 'object') {
      for (const [key, value] of Object.entries(patch.lanes)) {
        const index = Number(key) - 1
        if (!Number.isInteger(index) || index < 0 || index >= lanes.length) {
          throw new Error(`damage lane key is invalid: ${key}`)
        }
        lanes[index] = boundedNumber(value, `damage lane ${index + 1}`)
      }
    } else throw new Error('damage lanes patch must be a table')
  }
  if (patch.projectile_damage !== undefined) {
    lanes[0] = boundedNumber(patch.projectile_damage, 'projectile damage')
  }
  if (patch.magic_damage !== undefined) {
    lanes[1] = boundedNumber(patch.magic_damage, 'magic damage')
  }
  return {
    ...payload,
    lanes,
    magic_damage: lanes[1]!,
    projectile_damage: lanes[0]!,
    total_damage: lanes.reduce((total, value) => total + value, 0),
  }
}

function boundedNumber(value: LuaConsoleValue | undefined, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > MAXIMUM_ABSOLUTE_DELTA) {
    throw new Error(`${field} must be finite and within +/-${MAXIMUM_ABSOLUTE_DELTA}`)
  }
  return value
}

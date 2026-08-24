import type { LuaConsoleValue } from '../../protocol/game-protocol.ts'
import type {
  WebLuaSchemaDefinition,
  WebLuaScopeKind,
} from '../definition/index.ts'

const MAXIMUM_STATE_BYTES_PER_MOD = 64 * 1024
const MAXIMUM_STATE_CELLS = 4_096
const MAXIMUM_VALUE_DEPTH = 32
const encoder = new TextEncoder()

export interface ModStateScope {
  readonly id: string
  readonly kind: WebLuaScopeKind
}

export interface ModStateCellDefinition {
  readonly defaultValue?: LuaConsoleValue
  readonly key: string
  readonly migrations?: Readonly<Record<number, (value: LuaConsoleValue) => LuaConsoleValue>>
  readonly modId: string
  readonly schema: WebLuaSchemaDefinition
  readonly schemaVersion: number
  readonly scope: WebLuaScopeKind
}

export interface ModStateCellSnapshot {
  readonly key: string
  readonly modId: string
  readonly schemaVersion: number
  readonly scope: ModStateScope
  readonly value: LuaConsoleValue
}

export interface ModStateCheckpoint {
  readonly cells: readonly ModStateCellSnapshot[]
  readonly revision: number
}

interface StoredCell {
  readonly definition: ModStateCellDefinition
  readonly scope: ModStateScope
  value: LuaConsoleValue
}

export class ModStateStore {
  readonly #cells = new Map<string, StoredCell>()
  #closed = false
  #revision = 0

  get revision(): number {
    return this.#revision
  }

  cell(
    definition: ModStateCellDefinition,
    scope: ModStateScope,
  ): ModStateCell {
    this.#requireOpen()
    validateCellDefinition(definition)
    validateScope(scope)
    if (definition.scope !== scope.kind) {
      throw new Error(`state cell ${definition.modId}:${definition.key} requires ${definition.scope} scope`)
    }
    const id = cellId(definition.modId, definition.key, scope)
    let stored = this.#cells.get(id)
    if (!stored) {
      if (this.#cells.size >= MAXIMUM_STATE_CELLS) throw new Error('mod state cell limit reached')
      const initial = definition.defaultValue === undefined
        ? schemaDefault(definition.schema, `state ${definition.modId}:${definition.key}`)
        : validateSchemaValue(
            definition.schema,
            definition.defaultValue,
            `state ${definition.modId}:${definition.key} default`,
          )
      stored = {
        definition,
        scope: Object.freeze({ ...scope }),
        value: cloneLuaValue(initial),
      }
      this.#cells.set(id, stored)
      try {
        this.#enforceModBudget(definition.modId)
      } catch (error) {
        this.#cells.delete(id)
        throw error
      }
    } else if (!sameDefinition(stored.definition, definition)) {
      throw new Error(`state cell definition changed during one runtime: ${definition.modId}:${definition.key}`)
    }
    return new ModStateCell(this, id)
  }

  snapshot(scopes?: readonly ModStateScope[]): ModStateCheckpoint {
    this.#requireOpen()
    const selected = scopes
      ? new Set(scopes.map(scopeKey))
      : null
    const cells = [...this.#cells.values()]
      .filter(cell => selected === null || selected.has(scopeKey(cell.scope)))
      .sort(compareCells)
      .map(cell => Object.freeze({
        key: cell.definition.key,
        modId: cell.definition.modId,
        schemaVersion: cell.definition.schemaVersion,
        scope: Object.freeze({ ...cell.scope }),
        value: cloneLuaValue(cell.value),
      }))
    return Object.freeze({ cells: Object.freeze(cells), revision: this.#revision })
  }

  restore(
    checkpoint: ModStateCheckpoint,
    definitions: readonly ModStateCellDefinition[],
  ): void {
    this.#requireOpen()
    if (!Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0) {
      throw new Error('mod state checkpoint revision is invalid')
    }
    const byDefinition = new Map(definitions.map(definition => [
      `${definition.modId}\0${definition.key}\0${definition.scope}`,
      definition,
    ]))
    const candidate = new Map(this.#cells)
    for (const snapshot of checkpoint.cells) {
      validateScope(snapshot.scope)
      const definition = byDefinition.get(
        `${snapshot.modId}\0${snapshot.key}\0${snapshot.scope.kind}`,
      )
      if (!definition) continue
      validateCellDefinition(definition)
      let value = cloneLuaValue(snapshot.value)
      let version = snapshot.schemaVersion
      if (!Number.isSafeInteger(version) || version < 1 || version > definition.schemaVersion) {
        throw new Error(`state checkpoint has invalid schema version for ${snapshot.modId}:${snapshot.key}`)
      }
      while (version < definition.schemaVersion) {
        const migration = definition.migrations?.[version]
        if (!migration) {
          throw new Error(`state cell ${snapshot.modId}:${snapshot.key} has no migration from version ${version}`)
        }
        value = cloneLuaValue(migration(cloneLuaValue(value)))
        version += 1
      }
      value = validateSchemaValue(
        definition.schema,
        value,
        `state checkpoint ${snapshot.modId}:${snapshot.key}`,
      )
      candidate.set(cellId(snapshot.modId, snapshot.key, snapshot.scope), {
        definition,
        scope: Object.freeze({ ...snapshot.scope }),
        value,
      })
    }
    const previous = new Map(this.#cells)
    this.#cells.clear()
    for (const [id, cell] of candidate) this.#cells.set(id, cell)
    try {
      for (const definition of definitions) this.#enforceModBudget(definition.modId)
    } catch (error) {
      this.#cells.clear()
      for (const [id, cell] of previous) this.#cells.set(id, cell)
      throw error
    }
    this.#revision = Math.max(this.#revision, checkpoint.revision)
  }

  closeScope(scope: ModStateScope): number {
    this.#requireOpen()
    const target = scopeKey(scope)
    let removed = 0
    for (const [id, cell] of this.#cells) {
      if (scopeKey(cell.scope) !== target) continue
      this.#cells.delete(id)
      removed += 1
    }
    if (removed > 0) this.#revision += 1
    return removed
  }

  close(): void {
    if (this.#closed) return
    this.#closed = true
    this.#cells.clear()
  }

  read(id: string): LuaConsoleValue {
    this.#requireOpen()
    const cell = this.#cells.get(id)
    if (!cell) throw new Error('mod state cell is stale')
    return cloneLuaValue(cell.value)
  }

  update(
    id: string,
    reducer: (current: LuaConsoleValue) => LuaConsoleValue,
  ): Readonly<{ revision: number; value: LuaConsoleValue }> {
    this.#requireOpen()
    const cell = this.#cells.get(id)
    if (!cell) throw new Error('mod state cell is stale')
    const before = cell.value
    const next = validateSchemaValue(
      cell.definition.schema,
      reducer(cloneLuaValue(before)),
      `state ${cell.definition.modId}:${cell.definition.key}`,
    )
    cell.value = cloneLuaValue(next)
    try {
      this.#enforceModBudget(cell.definition.modId)
    } catch (error) {
      cell.value = before
      throw error
    }
    if (!sameLuaValue(before, next)) this.#revision += 1
    return Object.freeze({ revision: this.#revision, value: cloneLuaValue(cell.value) })
  }

  #enforceModBudget(modId: string): void {
    const values = [...this.#cells.values()]
      .filter(cell => cell.definition.modId === modId)
      .sort(compareCells)
      .map(cell => ({
        key: cell.definition.key,
        scope: cell.scope,
        value: cell.value,
      }))
    if (encoder.encode(JSON.stringify(values)).length > MAXIMUM_STATE_BYTES_PER_MOD) {
      throw new Error(`mod state exceeds ${MAXIMUM_STATE_BYTES_PER_MOD} bytes for ${modId}`)
    }
  }

  #requireOpen(): void {
    if (this.#closed) throw new Error('mod state store is closed')
  }
}

export class ModStateCell {
  readonly #id: string
  readonly #store: ModStateStore

  constructor(store: ModStateStore, id: string) {
    this.#id = id
    this.#store = store
  }

  get(): LuaConsoleValue {
    return this.#store.read(this.#id)
  }

  set(value: LuaConsoleValue): Readonly<{ revision: number; value: LuaConsoleValue }> {
    return this.#store.update(this.#id, () => value)
  }

  update(
    reducer: (current: LuaConsoleValue) => LuaConsoleValue,
  ): Readonly<{ revision: number; value: LuaConsoleValue }> {
    return this.#store.update(this.#id, reducer)
  }
}

export function validateSchemaValue(
  schema: WebLuaSchemaDefinition,
  value: LuaConsoleValue,
  field: string,
  depth = 0,
): LuaConsoleValue {
  if (depth > MAXIMUM_VALUE_DEPTH) throw new Error(`${field} exceeds schema depth`)
  switch (schema.schemaKind) {
    case 'boolean':
      if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean`)
      return value
    case 'integer': {
      if (!Number.isSafeInteger(value)) throw new Error(`${field} must be a safe integer`)
      const minimum = schemaNumber(schema, 'min', Number.MIN_SAFE_INTEGER)
      const maximum = schemaNumber(schema, 'max', Number.MAX_SAFE_INTEGER)
      if (value < minimum || value > maximum) throw new Error(`${field} is outside ${minimum}..${maximum}`)
      return value
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} must be finite`)
      const minimum = schemaNumber(schema, 'min', -Number.MAX_VALUE)
      const maximum = schemaNumber(schema, 'max', Number.MAX_VALUE)
      if (value < minimum || value > maximum) throw new Error(`${field} is outside ${minimum}..${maximum}`)
      return value
    }
    case 'string': {
      if (typeof value !== 'string') throw new Error(`${field} must be text`)
      const maximum = schemaNumber(schema, 'max_bytes', 16 * 1024)
      if (encoder.encode(value).length > maximum) throw new Error(`${field} exceeds ${maximum} bytes`)
      return value
    }
    case 'enum': {
      const values = schemaArray(schema, 'values')
      if (!values.some(candidate => sameLuaValue(candidate, value))) {
        throw new Error(`${field} is not an accepted enum value`)
      }
      return cloneLuaValue(value)
    }
    case 'array': {
      if (!Array.isArray(value)) throw new Error(`${field} must be an array`)
      const item = schema.fields.item
      if (!isSchema(item)) throw new Error(`${field} array schema has no item definition`)
      const maximum = schemaNumber(schema, 'max_items', 256)
      if (value.length > maximum) throw new Error(`${field} exceeds ${maximum} items`)
      return value.map((entry, index) => validateSchemaValue(item, entry, `${field}[${index}]`, depth + 1))
    }
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${field} must be an object`)
      }
      const fields = schema.fields.fields
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
        throw new Error(`${field} object schema has no fields`)
      }
      const accepted = Object.keys(fields)
      const unknown = Object.keys(value).filter(key => !accepted.includes(key))
      if (unknown.length > 0) throw new Error(`${field} has unknown fields: ${unknown.join(', ')}`)
      return Object.fromEntries(accepted.map((key) => {
        const child = fields[key]
        if (!isSchema(child)) throw new Error(`${field}.${key} has an invalid schema`)
        const candidate = value[key] ?? schemaDefault(child, `${field}.${key}`)
        return [key, validateSchemaValue(child, candidate, `${field}.${key}`, depth + 1)]
      }))
    }
    default:
      throw new Error(`${field} uses unsupported schema kind ${schema.schemaKind}`)
  }
}

export function schemaDefault(schema: WebLuaSchemaDefinition, field: string): LuaConsoleValue {
  const candidate = schema.fields.default
  if (candidate !== undefined && !isSchema(candidate)) {
    return validateSchemaValue(schema, candidate as LuaConsoleValue, `${field} default`)
  }
  if (schema.schemaKind === 'object') {
    const fields = schema.fields.fields
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      throw new Error(`${field} object schema has no fields`)
    }
    return Object.fromEntries(Object.entries(fields).map(([key, child]) => {
      if (!isSchema(child)) throw new Error(`${field}.${key} has an invalid schema`)
      return [key, schemaDefault(child, `${field}.${key}`)]
    }))
  }
  if (schema.schemaKind === 'array') return []
  if (schema.schemaKind === 'boolean') return false
  if (schema.schemaKind === 'integer' || schema.schemaKind === 'number') return 0
  if (schema.schemaKind === 'string') return ''
  if (schema.schemaKind === 'enum') return cloneLuaValue(schemaArray(schema, 'values')[0] ?? null)
  throw new Error(`${field} has no default`)
}

function validateCellDefinition(definition: ModStateCellDefinition): void {
  if (!definition.modId || !definition.key) throw new Error('mod state cell identity is invalid')
  if (!Number.isSafeInteger(definition.schemaVersion) || definition.schemaVersion < 1) {
    throw new Error('mod state cell schema version must be positive')
  }
  if (definition.schemaVersion > 1) {
    for (let version = 1; version < definition.schemaVersion; version += 1) {
      if (typeof definition.migrations?.[version] !== 'function') {
        throw new Error(`mod state cell is missing migration from version ${version}`)
      }
    }
  }
}

function validateScope(scope: ModStateScope): void {
  if (!scope.id || !scope.kind) throw new Error('mod state scope is invalid')
}

function sameDefinition(left: ModStateCellDefinition, right: ModStateCellDefinition): boolean {
  return left.modId === right.modId
    && left.key === right.key
    && left.scope === right.scope
    && left.schemaVersion === right.schemaVersion
    && JSON.stringify(left.schema) === JSON.stringify(right.schema)
}

function cellId(modId: string, key: string, scope: ModStateScope): string {
  return `${modId}\0${key}\0${scope.kind}\0${scope.id}`
}

function scopeKey(scope: ModStateScope): string {
  return `${scope.kind}\0${scope.id}`
}

function compareCells(left: StoredCell, right: StoredCell): number {
  return left.definition.modId.localeCompare(right.definition.modId)
    || left.definition.key.localeCompare(right.definition.key)
    || left.scope.kind.localeCompare(right.scope.kind)
    || left.scope.id.localeCompare(right.scope.id)
}

function schemaNumber(schema: WebLuaSchemaDefinition, key: string, fallback: number): number {
  const value = schema.fields[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function schemaArray(schema: WebLuaSchemaDefinition, key: string): readonly LuaConsoleValue[] {
  const value = schema.fields[key]
  if (!Array.isArray(value)) throw new Error(`${schema.schemaKind} schema ${key} must be an array`)
  return value as readonly LuaConsoleValue[]
}

function isSchema(value: unknown): value is WebLuaSchemaDefinition {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === 'schema-definition')
}

function cloneLuaValue(value: LuaConsoleValue): LuaConsoleValue {
  if (Array.isArray(value)) return value.map(cloneLuaValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneLuaValue(child)]))
}

function sameLuaValue(left: LuaConsoleValue, right: LuaConsoleValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

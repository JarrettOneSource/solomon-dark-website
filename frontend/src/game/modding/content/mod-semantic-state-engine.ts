import type { WebLuaScopeKind } from '../definition/index.ts'
import type { LuaConsoleValue } from '../../protocol/game-protocol.ts'

const MAXIMUM_VALUES = 4_096
const MAXIMUM_NODES = 4_096
const MAXIMUM_DEPTH = 16

export interface ModSemanticValue {
  readonly key: string
  readonly modId: string
  readonly scope: Readonly<{ id: string; kind: WebLuaScopeKind }>
  readonly value: LuaConsoleValue
}

export interface ModSemanticStateCheckpoint {
  readonly revision: number
  readonly values: readonly ModSemanticValue[]
}

export class ModSemanticStateEngine {
  readonly #modIds: ReadonlySet<string>
  readonly #values = new Map<string, ModSemanticValue>()
  #revision = 0

  constructor(modIds: readonly string[]) {
    this.#modIds = new Set(modIds)
  }

  get revision(): number {
    return this.#revision
  }

  checkpoint(): ModSemanticStateCheckpoint {
    return Object.freeze({
      revision: this.#revision,
      values: this.project(),
    })
  }

  project(viewerId?: string): readonly ModSemanticValue[] {
    return Object.freeze([...this.#values.values()]
      .filter(row => viewerId === undefined || visibleTo(row.scope, viewerId))
      .sort((left, right) => identity(left).localeCompare(identity(right)))
      .map(row => freeze(row)))
  }

  restore(checkpoint: ModSemanticStateCheckpoint): void {
    if (!Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0 ||
        checkpoint.values.length > MAXIMUM_VALUES) {
      throw new Error('mod semantic state checkpoint is invalid')
    }
    const values = new Map<string, ModSemanticValue>()
    for (const row of checkpoint.values) {
      validateIdentity(row, this.#modIds)
      const id = identity(row)
      if (values.has(id)) throw new Error('mod semantic state checkpoint contains duplicates')
      values.set(id, freeze({ ...row, value: clone(row.value) }))
    }
    this.#values.clear()
    for (const [id, row] of values) this.#values.set(id, row)
    this.#revision = checkpoint.revision
  }

  set(
    modId: string,
    scope: Readonly<{ id: string; kind: WebLuaScopeKind }>,
    key: string,
    value: LuaConsoleValue,
  ): void {
    const row = { key, modId, scope, value }
    validateIdentity(row, this.#modIds)
    const id = identity(row)
    if (!this.#values.has(id) && this.#values.size >= MAXIMUM_VALUES) {
      throw new Error('mod semantic state limit reached')
    }
    this.#values.set(id, freeze({ ...row, value: clone(value) }))
    this.#revision += 1
  }

  clear(
    modId: string,
    scope: Readonly<{ id: string; kind: WebLuaScopeKind }>,
    key: string,
  ): boolean {
    const id = identity({ key, modId, scope })
    if (!this.#values.delete(id)) return false
    this.#revision += 1
    return true
  }
}

function visibleTo(
  scope: Readonly<{ id: string; kind: WebLuaScopeKind }>,
  viewerId: string,
): boolean {
  return scope.kind !== 'participant-profile' && scope.kind !== 'participant-run'
    || scope.id === viewerId || scope.id.startsWith(`${viewerId}:`)
}

function identity(row: Pick<ModSemanticValue, 'key' | 'modId' | 'scope'>): string {
  return `${row.modId}\0${row.scope.kind}\0${row.scope.id}\0${row.key}`
}

function validateIdentity(
  row: Pick<ModSemanticValue, 'key' | 'modId' | 'scope'>,
  modIds: ReadonlySet<string>,
): void {
  if (!modIds.has(row.modId) || !/^[a-z][a-z0-9._-]{0,127}$/.test(row.key) ||
      !row.scope.id || row.scope.id.length > 256 || !scopeKinds.has(row.scope.kind)) {
    throw new Error('mod semantic state identity is invalid')
  }
}

const scopeKinds = new Set<WebLuaScopeKind>([
  'entity',
  'participant-profile',
  'participant-run',
  'party-run',
  'scene',
  'session',
])

function freeze(row: ModSemanticValue): ModSemanticValue {
  return Object.freeze({ ...row, scope: Object.freeze({ ...row.scope }) })
}

function clone(value: LuaConsoleValue, depth = 0, nodes = { value: 0 }): LuaConsoleValue {
  nodes.value += 1
  if (depth > MAXIMUM_DEPTH || nodes.value > MAXIMUM_NODES) {
    throw new Error('mod semantic state value exceeds its graph budget')
  }
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('mod semantic state number must be finite')
    return value
  }
  if (typeof value === 'string') {
    if (value.length > 4_096) throw new Error('mod semantic state text is too long')
    return value
  }
  if (Array.isArray(value)) return Object.freeze(value.map(child => clone(child, depth + 1, nodes)))
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (!/^[a-zA-Z0-9._-]{1,128}$/.test(key)) throw new Error('mod semantic state field is invalid')
    return [key, clone(child, depth + 1, nodes)]
  })))
}

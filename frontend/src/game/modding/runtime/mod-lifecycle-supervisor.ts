const MAXIMUM_SCOPES_PER_MOD = 8_192
const MAXIMUM_RESOURCES_PER_MOD = 32_768

export const MOD_LIFECYCLE_KINDS = [
  'audio',
  'cast',
  'entity',
  'mod',
  'participant',
  'presentation',
  'projectile',
  'run',
  'scene',
  'session',
  'status',
  'subscription',
  'timer',
  'ui',
] as const

export type ModLifecycleKind = typeof MOD_LIFECYCLE_KINDS[number]

export interface ModLifecycleCloseContext {
  readonly reason: string
  readonly scopeId: string
}

export interface ModLifecycleDiagnostic {
  readonly alive: boolean
  readonly childCount: number
  readonly closeReason: string | null
  readonly id: string
  readonly key: string
  readonly kind: ModLifecycleKind
  readonly modId: string
  readonly parentId: string | null
  readonly resourceCount: number
}

interface OwnedResource {
  readonly close: (context: ModLifecycleCloseContext) => void
  readonly id: number
  readonly key: string
  readonly kind: ModLifecycleKind
}

interface ScopeRecord {
  alive: boolean
  readonly children: string[]
  closeReason: string | null
  readonly id: string
  readonly key: string
  readonly kind: ModLifecycleKind
  readonly modId: string
  readonly parentId: string | null
  readonly resources: OwnedResource[]
}

export class ModLifecycleSupervisor {
  readonly #log: (message: string) => void
  readonly #nextScopeId = new Map<string, number>()
  readonly #records = new Map<string, ScopeRecord>()
  #nextResourceId = 1

  constructor(log: (message: string) => void = () => {}) {
    this.#log = log
  }

  root(modId: string): ModLifecycleScope {
    if (!modId) throw new Error('mod lifecycle root requires a mod id')
    const existing = this.#records.get(`${modId}:mod:root`)
    if (existing?.alive) return new ModLifecycleScope(this, existing.id)
    return this.create(modId, 'mod', 'root', null)
  }

  create(
    modId: string,
    kind: ModLifecycleKind,
    key: string,
    parentId: string | null,
  ): ModLifecycleScope {
    if (!modId || !key) throw new Error('mod lifecycle scope identity is invalid')
    const parent = parentId === null ? null : this.#live(parentId)
    if (parent && parent.modId !== modId) throw new Error('mod lifecycle parent belongs to another mod')
    const scopeCount = [...this.#records.values()].filter(record => (
      record.modId === modId && record.alive
    )).length
    if (scopeCount >= MAXIMUM_SCOPES_PER_MOD) throw new Error('mod lifecycle scope limit reached')
    const sequenceKey = `${modId}\0${kind}\0${key}`
    const sequence = (this.#nextScopeId.get(sequenceKey) ?? 0) + 1
    this.#nextScopeId.set(sequenceKey, sequence)
    const id = kind === 'mod' && key === 'root'
      ? `${modId}:mod:root`
      : `${modId}:${kind}:${key}:${sequence}`
    const record: ScopeRecord = {
      alive: true,
      children: [],
      closeReason: null,
      id,
      key,
      kind,
      modId,
      parentId,
      resources: [],
    }
    this.#records.set(id, record)
    parent?.children.push(id)
    return new ModLifecycleScope(this, id)
  }

  own(
    scopeId: string,
    kind: ModLifecycleKind,
    key: string,
    close: (context: ModLifecycleCloseContext) => void,
  ): ModLifecycleLease {
    const record = this.#live(scopeId)
    const resourceCount = [...this.#records.values()].reduce(
      (total, candidate) => total + (candidate.modId === record.modId ? candidate.resources.length : 0),
      0,
    )
    if (resourceCount >= MAXIMUM_RESOURCES_PER_MOD) {
      throw new Error('mod lifecycle resource limit reached')
    }
    const resource = Object.freeze({
      close,
      id: this.#nextResourceId++,
      key,
      kind,
    })
    record.resources.push(resource)
    return new ModLifecycleLease(this, scopeId, resource.id)
  }

  release(scopeId: string, resourceId: number, reason: string): boolean {
    const record = this.#records.get(scopeId)
    if (!record?.alive) return false
    const index = record.resources.findIndex(resource => resource.id === resourceId)
    if (index < 0) return false
    const [resource] = record.resources.splice(index, 1)
    this.#closeResource(record, resource!, reason)
    return true
  }

  close(scopeId: string, reason: string): boolean {
    const record = this.#records.get(scopeId)
    if (!record?.alive) return false
    record.alive = false
    record.closeReason = reason
    for (const childId of [...record.children].reverse()) this.close(childId, reason)
    record.children.length = 0
    for (const resource of [...record.resources].reverse()) {
      this.#closeResource(record, resource, reason)
    }
    record.resources.length = 0
    if (record.parentId) {
      const parent = this.#records.get(record.parentId)
      const index = parent?.children.indexOf(record.id) ?? -1
      if (index >= 0) parent!.children.splice(index, 1)
    }
    return true
  }

  closeKind(modId: string, kind: ModLifecycleKind, reason: string): number {
    const scopes = [...this.#records.values()].filter(record => (
      record.alive && record.modId === modId && record.kind === kind
    ))
    for (const scope of scopes) this.close(scope.id, reason)
    return scopes.length
  }

  diagnostic(scopeId: string): ModLifecycleDiagnostic {
    const record = this.#records.get(scopeId)
    if (!record) throw new Error('unknown mod lifecycle scope')
    return Object.freeze({
      alive: record.alive,
      childCount: record.children.length,
      closeReason: record.closeReason,
      id: record.id,
      key: record.key,
      kind: record.kind,
      modId: record.modId,
      parentId: record.parentId,
      resourceCount: record.resources.length,
    })
  }

  child(scopeId: string, kind: ModLifecycleKind, key: string): ModLifecycleScope {
    const parent = this.#live(scopeId)
    return this.create(parent.modId, kind, key, parent.id)
  }

  alive(scopeId: string): boolean {
    return this.#records.get(scopeId)?.alive === true
  }

  #live(scopeId: string): ScopeRecord {
    const record = this.#records.get(scopeId)
    if (!record?.alive) throw new Error('mod lifecycle scope is stale')
    return record
  }

  #closeResource(record: ScopeRecord, resource: OwnedResource, reason: string): void {
    try {
      resource.close(Object.freeze({ reason, scopeId: record.id }))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.#log(`${record.modId}:${record.id}:${resource.kind}:${resource.key}: ${message}`)
    }
  }
}

export class ModLifecycleScope {
  readonly #id: string
  readonly #supervisor: ModLifecycleSupervisor

  constructor(supervisor: ModLifecycleSupervisor, id: string) {
    this.#supervisor = supervisor
    this.#id = id
  }

  get id(): string {
    return this.#id
  }

  get alive(): boolean {
    return this.#supervisor.alive(this.#id)
  }

  child(kind: ModLifecycleKind, key: string): ModLifecycleScope {
    return this.#supervisor.child(this.#id, kind, key)
  }

  own(
    kind: ModLifecycleKind,
    key: string,
    close: (context: ModLifecycleCloseContext) => void,
  ): ModLifecycleLease {
    return this.#supervisor.own(this.#id, kind, key, close)
  }

  close(reason: string): boolean {
    return this.#supervisor.close(this.#id, reason)
  }

  diagnostic(): ModLifecycleDiagnostic {
    return this.#supervisor.diagnostic(this.#id)
  }
}

export class ModLifecycleLease {
  readonly #resourceId: number
  readonly #scopeId: string
  readonly #supervisor: ModLifecycleSupervisor
  #released = false

  constructor(supervisor: ModLifecycleSupervisor, scopeId: string, resourceId: number) {
    this.#supervisor = supervisor
    this.#scopeId = scopeId
    this.#resourceId = resourceId
  }

  release(reason = 'released'): boolean {
    if (this.#released) return false
    this.#released = true
    return this.#supervisor.release(this.#scopeId, this.#resourceId, reason)
  }
}

import type { WebLuaDefinitionValue } from '../definition/index.ts'
import type {
  PreparedModContentCatalog,
  PreparedModStatusDefinition,
} from './mod-content-catalog.ts'

const MAXIMUM_ACTIVE_STATUSES = 4_096
const MAXIMUM_STACKS = 8

export interface ActiveModStatus {
  readonly contentId: string
  readonly expiresTick: number
  readonly instanceId: number
  readonly modId: string
  readonly startedTick: number
  readonly targetId: string
}

export interface ModStatusCheckpoint {
  readonly instances: readonly ActiveModStatus[]
  readonly nextInstanceId: number
  readonly revision: number
}

export class ModStatusEngine {
  readonly #catalog: PreparedModContentCatalog
  readonly #ticksPerSecond: number
  #instances: ActiveModStatus[] = []
  #nextInstanceId = 1
  #revision = 0

  constructor(
    catalog: PreparedModContentCatalog,
    ticksPerSecond: number,
  ) {
    if (!Number.isSafeInteger(ticksPerSecond) || ticksPerSecond < 1 || ticksPerSecond > 1_000) {
      throw new Error('mod status tick rate is invalid')
    }
    this.#catalog = catalog
    this.#ticksPerSecond = ticksPerSecond
  }

  get revision(): number {
    return this.#revision
  }

  apply(contentId: string, targetId: string, tick: number, durationMs?: number): boolean {
    const definition = this.#catalog.status(contentId)
    if (!definition) throw new Error(`mod status is unavailable: ${contentId}`)
    validateTarget(targetId)
    validateTick(tick)
    const durationTicks = Math.max(1, Math.ceil((durationMs ?? definition.durationMs) * this.#ticksPerSecond / 1_000))
    const matching = this.#instances.filter(instance => (
      instance.contentId === contentId && instance.targetId === targetId
    ))
    if (definition.stacking === 'ignore' && matching.some(instance => instance.expiresTick > tick)) return false
    if (definition.stacking === 'stack' && matching.filter(instance => instance.expiresTick > tick).length >= MAXIMUM_STACKS) {
      return false
    }
    if (definition.stacking !== 'stack') {
      this.#instances = this.#instances.filter(instance => (
        instance.contentId !== contentId || instance.targetId !== targetId
      ))
    }
    if (this.#instances.length >= MAXIMUM_ACTIVE_STATUSES) throw new Error('active mod status limit reached')
    this.#instances.push(Object.freeze({
      contentId,
      expiresTick: tick + durationTicks,
      instanceId: this.#nextInstanceId++,
      modId: definition.modId,
      startedTick: tick,
      targetId,
    }))
    this.#revision += 1
    return true
  }

  checkpoint(): ModStatusCheckpoint {
    return Object.freeze({
      instances: Object.freeze(this.#instances.map(instance => Object.freeze({ ...instance }))),
      nextInstanceId: this.#nextInstanceId,
      revision: this.#revision,
    })
  }

  filterDamage(targetId: string, amount: number, tick: number): number {
    return this.#modify(targetId, 'incoming_damage', amount, tick)
  }

  filterMana(targetId: string, delta: number, tick: number): number {
    return delta < 0 ? -this.#modify(targetId, 'mana_spend', -delta, tick) : delta
  }

  project(targetId?: string): readonly ActiveModStatus[] {
    return Object.freeze(this.#instances
      .filter(instance => targetId === undefined || instance.targetId === targetId)
      .sort((left, right) => left.instanceId - right.instanceId)
      .map(instance => Object.freeze({ ...instance })))
  }

  restore(checkpoint: ModStatusCheckpoint): void {
    if (!Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0 ||
        !Number.isSafeInteger(checkpoint.nextInstanceId) || checkpoint.nextInstanceId < 1 ||
        checkpoint.instances.length > MAXIMUM_ACTIVE_STATUSES) {
      throw new Error('mod status checkpoint is invalid')
    }
    const ids = new Set<number>()
    const instances = checkpoint.instances.map((instance) => {
      validateTarget(instance.targetId)
      validateTick(instance.startedTick)
      validateTick(instance.expiresTick)
      const definition = this.#catalog.status(instance.contentId)
      if (!Number.isSafeInteger(instance.instanceId) || instance.instanceId < 1 ||
          instance.expiresTick <= instance.startedTick || !definition ||
          instance.modId !== definition.modId || ids.has(instance.instanceId)) {
        throw new Error('mod status checkpoint contains an invalid instance')
      }
      ids.add(instance.instanceId)
      return Object.freeze({ ...instance })
    })
    this.#instances = instances
    this.#nextInstanceId = checkpoint.nextInstanceId
    this.#revision = checkpoint.revision
  }

  tick(tick: number): number {
    validateTick(tick)
    const before = this.#instances.length
    this.#instances = this.#instances.filter(instance => instance.expiresTick > tick)
    const removed = before - this.#instances.length
    if (removed > 0) this.#revision += 1
    return removed
  }

  #modify(targetId: string, lane: string, source: number, tick: number): number {
    if (!Number.isFinite(source) || source < 0) throw new Error(`mod status ${lane} input is invalid`)
    validateTick(tick)
    let value = source
    for (const instance of this.#instances) {
      if (instance.targetId !== targetId || instance.expiresTick <= tick) continue
      const definition = this.#catalog.status(instance.contentId)
      if (!definition) continue
      const modifier = definition.modifiers[lane]
      if (modifier !== undefined) value = applyModifier(value, modifier, definition, lane)
    }
    return Math.max(0, value)
  }
}

function applyModifier(
  source: number,
  modifier: WebLuaDefinitionValue,
  definition: PreparedModStatusDefinition,
  lane: string,
): number {
  if (typeof modifier === 'number' && Number.isFinite(modifier)) return source * modifier
  if (!modifier || typeof modifier !== 'object' || Array.isArray(modifier)) {
    throw new Error(`${definition.modId}:${definition.key} ${lane} modifier is invalid`)
  }
  const values = modifier as Readonly<Record<string, WebLuaDefinitionValue>>
  const keys = Object.keys(values)
  if (keys.length !== 1) throw new Error(`${definition.modId}:${definition.key} ${lane} modifier is ambiguous`)
  const amount = values[keys[0]!]
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new Error(`${definition.modId}:${definition.key} ${lane} modifier amount is invalid`)
  }
  if (keys[0] === 'multiply') return source * amount
  if (keys[0] === 'add') return source + amount
  if (keys[0] === 'set') return amount
  throw new Error(`${definition.modId}:${definition.key} ${lane} modifier operation is invalid`)
}

function validateTarget(value: string): void {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128) throw new Error('mod status target is invalid')
}

function validateTick(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('mod status tick is invalid')
}

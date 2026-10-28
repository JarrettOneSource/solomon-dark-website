import type { PreparedModContentCatalog } from './mod-content-catalog.ts'

const MAXIMUM_POWERUPS = 1_024
const MAXIMUM_COLLECTION_EVENTS = 256
const COLLECTION_EVENT_TICKS = 50

export interface ActiveModPowerup {
  readonly contentId: string
  readonly id: number
  readonly modId: string
  readonly spawnedTick: number
  readonly x: number
  readonly y: number
}

export interface ModPowerupCheckpoint {
  readonly instances: readonly ActiveModPowerup[]
  readonly nextId: number
  readonly revision: number
}

export interface ModPowerupCollectionEvent {
  readonly contentId: string
  readonly id: number
  readonly playerId: string
  readonly tick: number
  readonly x: number
  readonly y: number
}

export class ModPowerupEngine {
  readonly #catalog: PreparedModContentCatalog
  #instances: ActiveModPowerup[] = []
  #collections: ModPowerupCollectionEvent[] = []
  #nextId = 1
  #revision = 0

  constructor(catalog: PreparedModContentCatalog) {
    this.#catalog = catalog
  }

  get revision(): number {
    return this.#revision
  }

  checkpoint(): ModPowerupCheckpoint {
    return Object.freeze({
      instances: Object.freeze(this.#instances.map(instance => Object.freeze({ ...instance }))),
      nextId: this.#nextId,
      revision: this.#revision,
    })
  }

  collect(id: number, playerId: string, tick = 0): Readonly<{
    contentId: string
    playerId: string
  } & ModPowerupCollectionEvent> | null {
    if (!Number.isSafeInteger(tick) || tick < 0) throw new Error('mod powerup collection tick is invalid')
    const index = this.#instances.findIndex(instance => instance.id === id)
    if (index < 0) return null
    const [instance] = this.#instances.splice(index, 1)
    const event = Object.freeze({
      contentId: instance!.contentId,
      id: instance!.id,
      playerId,
      tick,
      x: instance!.x,
      y: instance!.y,
    })
    this.#collections.push(event)
    if (this.#collections.length > MAXIMUM_COLLECTION_EVENTS) this.#collections.shift()
    this.#revision += 1
    return event
  }

  clear(): void {
    if (this.#instances.length + this.#collections.length === 0) return
    this.#instances = []
    this.#collections = []
    this.#revision += 1
  }

  candidates(
    players: readonly Readonly<{ id: string; x: number; y: number }>[],
  ): readonly Readonly<{ instance: ActiveModPowerup; playerId: string }>[] {
    return Object.freeze(this.#instances.flatMap((instance) => {
      const definition = this.#catalog.powerup(instance.contentId)!
      const maximum = definition.pickupRadius * definition.pickupRadius
      const player = players.find(candidate => {
        const x = candidate.x - instance.x
        const y = candidate.y - instance.y
        return x * x + y * y < maximum
      })
      return player ? [{ instance, playerId: player.id }] : []
    }))
  }

  project(): readonly ActiveModPowerup[] {
    return Object.freeze(this.#instances.map(instance => Object.freeze({ ...instance })))
  }

  projectCollections(): readonly ModPowerupCollectionEvent[] {
    return Object.freeze(this.#collections.map(event => Object.freeze({ ...event })))
  }

  restore(checkpoint: ModPowerupCheckpoint): void {
    if (!Number.isSafeInteger(checkpoint.nextId) || checkpoint.nextId < 1 ||
        !Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0 ||
        checkpoint.instances.length > MAXIMUM_POWERUPS) {
      throw new Error('mod powerup checkpoint is invalid')
    }
    const ids = new Set<number>()
    this.#instances = checkpoint.instances.map((instance) => {
      const definition = this.#catalog.powerup(instance.contentId)
      if (!Number.isSafeInteger(instance.id) || instance.id < 1 || ids.has(instance.id) ||
          !definition || instance.modId !== definition.modId || !Number.isFinite(instance.x) ||
          !Number.isFinite(instance.y) || !Number.isSafeInteger(instance.spawnedTick) ||
          instance.spawnedTick < 0) throw new Error('mod powerup checkpoint contains an invalid instance')
      ids.add(instance.id)
      return Object.freeze({ ...instance })
    })
    this.#nextId = checkpoint.nextId
    this.#revision = checkpoint.revision
    this.#collections = []
  }

  spawn(contentId: string, x: number, y: number, tick: number): ActiveModPowerup {
    const definition = this.#catalog.powerup(contentId)
    if (!definition) throw new Error(`mod powerup is unavailable: ${contentId}`)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isSafeInteger(tick) || tick < 0) {
      throw new Error('mod powerup spawn is invalid')
    }
    if (this.#instances.length >= MAXIMUM_POWERUPS) throw new Error('active mod powerup limit reached')
    const instance = Object.freeze({
      contentId,
      id: this.#nextId++,
      modId: definition.modId,
      spawnedTick: tick,
      x,
      y,
    })
    this.#instances.push(instance)
    this.#revision += 1
    return instance
  }

  tick(tick: number): boolean {
    if (!Number.isSafeInteger(tick) || tick < 0) throw new Error('mod powerup tick is invalid')
    const retained = this.#collections.filter(event => tick - event.tick < COLLECTION_EVENT_TICKS)
    if (retained.length === this.#collections.length) return false
    this.#collections = retained
    this.#revision += 1
    return true
  }
}

import type { PreparedModContentCatalog } from './mod-content-catalog.ts'

const MAXIMUM_POWERUPS = 1_024

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

export class ModPowerupEngine {
  readonly #catalog: PreparedModContentCatalog
  #instances: ActiveModPowerup[] = []
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

  collect(id: number, playerId: string): Readonly<{
    contentId: string
    playerId: string
  }> | null {
    const index = this.#instances.findIndex(instance => instance.id === id)
    if (index < 0) return null
    const [instance] = this.#instances.splice(index, 1)
    this.#revision += 1
    return Object.freeze({ contentId: instance!.contentId, playerId })
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

  restore(checkpoint: ModPowerupCheckpoint): void {
    if (!Number.isSafeInteger(checkpoint.nextId) || checkpoint.nextId < 1 ||
        !Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0 ||
        checkpoint.instances.length > MAXIMUM_POWERUPS) {
      throw new Error('mod powerup checkpoint is invalid')
    }
    const ids = new Set<number>()
    this.#instances = checkpoint.instances.map((instance) => {
      if (!Number.isSafeInteger(instance.id) || instance.id < 1 || ids.has(instance.id) ||
          !this.#catalog.powerup(instance.contentId) || !Number.isFinite(instance.x) ||
          !Number.isFinite(instance.y) || !Number.isSafeInteger(instance.spawnedTick) ||
          instance.spawnedTick < 0) throw new Error('mod powerup checkpoint contains an invalid instance')
      ids.add(instance.id)
      return Object.freeze({ ...instance })
    })
    this.#nextId = checkpoint.nextId
    this.#revision = checkpoint.revision
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
}

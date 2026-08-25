import type { PreparedModContentCatalog } from './mod-content-catalog.ts'

const MAXIMUM_ENEMIES = 2_048

export interface ActiveModEnemy {
  readonly contentId: string
  readonly currentHealth: number
  readonly id: number
  readonly maximumHealth: number
  readonly spawnedTick: number
  readonly targetPlayerId: string | null
  readonly x: number
  readonly y: number
}

export interface ModEnemyCheckpoint {
  readonly enemies: readonly ActiveModEnemy[]
  readonly nextId: number
  readonly revision: number
}

export class ModEnemyEngine {
  readonly #catalog: PreparedModContentCatalog
  #enemies: ActiveModEnemy[] = []
  #nextId = 1
  #revision = 0

  constructor(catalog: PreparedModContentCatalog) {
    this.#catalog = catalog
  }

  checkpoint(): ModEnemyCheckpoint {
    return Object.freeze({ enemies: this.project(), nextId: this.#nextId, revision: this.#revision })
  }

  damage(id: number, amount: number): ActiveModEnemy | null {
    if (!Number.isFinite(amount) || amount < 0) throw new Error('mod enemy damage is invalid')
    const index = this.#enemies.findIndex(enemy => enemy.id === id)
    if (index < 0) return null
    const enemy = this.#enemies[index]!
    const next = Object.freeze({ ...enemy, currentHealth: Math.max(0, enemy.currentHealth - amount) })
    this.#revision += 1
    if (next.currentHealth === 0) this.#enemies.splice(index, 1)
    else this.#enemies[index] = next
    return next
  }

  project(): readonly ActiveModEnemy[] {
    return Object.freeze(this.#enemies.map(enemy => Object.freeze({ ...enemy })))
  }

  restore(checkpoint: ModEnemyCheckpoint): void {
    if (!Number.isSafeInteger(checkpoint.nextId) || checkpoint.nextId < 1 ||
        !Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0 ||
        checkpoint.enemies.length > MAXIMUM_ENEMIES) throw new Error('mod enemy checkpoint is invalid')
    const ids = new Set<number>()
    this.#enemies = checkpoint.enemies.map((enemy) => {
      const definition = this.#catalog.enemy(enemy.contentId)
      if (!definition || !Number.isSafeInteger(enemy.id) || enemy.id < 1 || ids.has(enemy.id) ||
          !Number.isFinite(enemy.currentHealth) || enemy.currentHealth <= 0 ||
          enemy.maximumHealth !== definition.health || enemy.currentHealth > enemy.maximumHealth ||
          !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) {
        throw new Error('mod enemy checkpoint contains an invalid enemy')
      }
      ids.add(enemy.id)
      return Object.freeze({ ...enemy })
    })
    this.#nextId = checkpoint.nextId
    this.#revision = checkpoint.revision
  }

  spawn(contentId: string, x: number, y: number, tick: number): ActiveModEnemy {
    const definition = this.#catalog.enemy(contentId)
    if (!definition) throw new Error(`mod enemy is unavailable: ${contentId}`)
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isSafeInteger(tick) || tick < 0) {
      throw new Error('mod enemy spawn is invalid')
    }
    if (this.#enemies.length >= MAXIMUM_ENEMIES) throw new Error('active mod enemy limit reached')
    const enemy = Object.freeze({
      contentId,
      currentHealth: definition.health,
      id: this.#nextId++,
      maximumHealth: definition.health,
      spawnedTick: tick,
      targetPlayerId: null,
      x,
      y,
    })
    this.#enemies.push(enemy)
    this.#revision += 1
    return enemy
  }

  tick(players: readonly Readonly<{ id: string; x: number; y: number }>[]): void {
    let changed = false
    this.#enemies = this.#enemies.map((enemy) => {
      const target = [...players].sort((left, right) => {
        const leftDistance = distanceSquared(enemy, left)
        const rightDistance = distanceSquared(enemy, right)
        return leftDistance - rightDistance || left.id.localeCompare(right.id)
      })[0]
      if (!target) return enemy
      const definition = this.#catalog.enemy(enemy.contentId)!
      const x = target.x - enemy.x
      const y = target.y - enemy.y
      const length = Math.hypot(x, y)
      const step = Math.min(definition.speed, length)
      const next = Object.freeze({
        ...enemy,
        targetPlayerId: target.id,
        x: length === 0 ? enemy.x : enemy.x + x / length * step,
        y: length === 0 ? enemy.y : enemy.y + y / length * step,
      })
      changed ||= next.x !== enemy.x || next.y !== enemy.y || next.targetPlayerId !== enemy.targetPlayerId
      return next
    })
    if (changed) this.#revision += 1
  }
}

function distanceSquared(
  enemy: Pick<ActiveModEnemy, 'x' | 'y'>,
  target: Readonly<{ x: number; y: number }>,
): number {
  const x = target.x - enemy.x
  const y = target.y - enemy.y
  return x * x + y * y
}

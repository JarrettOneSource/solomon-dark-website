import type { PreparedModContentCatalog } from './mod-content-catalog.ts'

const MAXIMUM_ENEMIES = 2_048
const DEATH_TOMBSTONE_TICKS = 50

export interface ActiveModEnemy {
  readonly contentId: string
  readonly currentHealth: number
  readonly deathTick: number | null
  readonly headingIndex: number
  readonly id: number
  readonly lastAttackTick: number | null
  readonly lastDamagedByPlayerId: string | null
  readonly lifeState: 'alive' | 'dying'
  readonly maximumHealth: number
  readonly moving: boolean
  readonly nextAttackTick: number
  readonly spawnedTick: number
  readonly targetPlayerId: string | null
  readonly x: number
  readonly y: number
}

export interface ModEnemyAttack {
  readonly amount: number
  readonly enemyId: number
  readonly playerId: string
}

export interface ModEnemyCheckpoint {
  readonly enemies: readonly ActiveModEnemy[]
  readonly nextId: number
  readonly revision: number
}

export interface ModEnemyTickInput {
  readonly move: (
    start: Readonly<{ x: number; y: number }>,
    requested: Readonly<{ x: number; y: number }>,
    radius: number,
  ) => Readonly<{ x: number; y: number }>
  readonly players: readonly Readonly<{ id: string; x: number; y: number }>[]
  readonly tick: number
}

export class ModEnemyEngine {
  readonly #catalog: PreparedModContentCatalog
  readonly #ticksPerSecond: number
  #enemies: ActiveModEnemy[] = []
  #nextId = 1
  #revision = 0

  constructor(catalog: PreparedModContentCatalog, ticksPerSecond = 100) {
    if (!Number.isSafeInteger(ticksPerSecond) || ticksPerSecond < 1 || ticksPerSecond > 1_000) {
      throw new Error('mod enemy tick rate is invalid')
    }
    this.#catalog = catalog
    this.#ticksPerSecond = ticksPerSecond
  }

  get revision(): number {
    return this.#revision
  }

  checkpoint(): ModEnemyCheckpoint {
    return Object.freeze({ enemies: this.project(), nextId: this.#nextId, revision: this.#revision })
  }

  collisionRadius(contentId: string): number {
    const definition = this.#catalog.enemy(contentId)
    if (!definition) throw new Error(`mod enemy is unavailable: ${contentId}`)
    return definition.collisionRadius
  }

  clear(): void {
    if (this.#enemies.length === 0) return
    this.#enemies = []
    this.#revision += 1
  }

  damage(
    id: number,
    amount: number,
    tick = 0,
    sourcePlayerId: string | null = null,
  ): ActiveModEnemy | null {
    if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(tick) || tick < 0) {
      throw new Error('mod enemy damage is invalid')
    }
    const index = this.#enemies.findIndex(enemy => enemy.id === id)
    const enemy = this.#enemies[index]
    if (index < 0 || !enemy || enemy.lifeState !== 'alive') return null
    const currentHealth = Math.max(0, enemy.currentHealth - amount)
    const next = freezeEnemy({
      ...enemy,
      currentHealth,
      deathTick: currentHealth === 0 ? tick : null,
      lastDamagedByPlayerId: sourcePlayerId ?? enemy.lastDamagedByPlayerId,
      lifeState: currentHealth === 0 ? 'dying' : 'alive',
      moving: currentHealth === 0 ? false : enemy.moving,
    })
    this.#enemies[index] = next
    this.#revision += 1
    return next
  }

  project(): readonly ActiveModEnemy[] {
    return Object.freeze(this.#enemies.map(freezeEnemy))
  }

  restore(checkpoint: ModEnemyCheckpoint): void {
    if (!Number.isSafeInteger(checkpoint.nextId) || checkpoint.nextId < 1 ||
        !Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0 ||
        checkpoint.enemies.length > MAXIMUM_ENEMIES) throw new Error('mod enemy checkpoint is invalid')
    const ids = new Set<number>()
    this.#enemies = checkpoint.enemies.map((enemy) => {
      const definition = this.#catalog.enemy(enemy.contentId)
      if (!definition || !Number.isSafeInteger(enemy.id) || enemy.id < 1 || ids.has(enemy.id) ||
          !Number.isFinite(enemy.currentHealth) || enemy.currentHealth < 0 ||
          enemy.maximumHealth !== definition.health || enemy.currentHealth > enemy.maximumHealth ||
          !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y) ||
          !Number.isSafeInteger(enemy.headingIndex) || enemy.headingIndex < 0 || enemy.headingIndex > 15 ||
          (enemy.lastAttackTick !== null && (
            !Number.isSafeInteger(enemy.lastAttackTick) || enemy.lastAttackTick < enemy.spawnedTick
          )) ||
          !Number.isSafeInteger(enemy.nextAttackTick) || enemy.nextAttackTick < enemy.spawnedTick ||
          (enemy.lifeState === 'alive') !== (enemy.currentHealth > 0 && enemy.deathTick === null) ||
          (enemy.lifeState === 'dying') !== (enemy.currentHealth === 0 && enemy.deathTick !== null)) {
        throw new Error('mod enemy checkpoint contains an invalid enemy')
      }
      ids.add(enemy.id)
      return freezeEnemy(enemy)
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
    const enemy = freezeEnemy({
      contentId,
      currentHealth: definition.health,
      deathTick: null,
      headingIndex: 0,
      id: this.#nextId++,
      lastAttackTick: null,
      lastDamagedByPlayerId: null,
      lifeState: 'alive',
      maximumHealth: definition.health,
      moving: false,
      nextAttackTick: tick + cooldownTicks(definition.attackCooldownMs, this.#ticksPerSecond),
      spawnedTick: tick,
      targetPlayerId: null,
      x,
      y,
    })
    this.#enemies.push(enemy)
    this.#revision += 1
    return enemy
  }

  tick(input: ModEnemyTickInput): readonly ModEnemyAttack[] {
    if (!Number.isSafeInteger(input.tick) || input.tick < 0) throw new Error('mod enemy tick is invalid')
    const attacks: ModEnemyAttack[] = []
    const retained: ActiveModEnemy[] = []
    let changed = false
    for (const enemy of this.#enemies) {
      if (enemy.lifeState === 'dying') {
        if (input.tick - enemy.deathTick! >= DEATH_TOMBSTONE_TICKS) changed = true
        else retained.push(enemy)
        continue
      }
      const target = nearest(enemy, input.players)
      if (!target) {
        const next = enemy.targetPlayerId === null && !enemy.moving
          ? enemy
          : freezeEnemy({ ...enemy, moving: false, targetPlayerId: null })
        retained.push(next)
        changed ||= next !== enemy
        continue
      }
      const definition = this.#catalog.enemy(enemy.contentId)!
      const dx = target.x - enemy.x
      const dy = target.y - enemy.y
      const distance = Math.hypot(dx, dy)
      const canAttack = distance <= definition.attackRange
      const requested = canAttack || distance === 0
        ? enemy
        : input.move(enemy, {
            x: enemy.x + dx / distance * Math.min(definition.speed, distance),
            y: enemy.y + dy / distance * Math.min(definition.speed, distance),
          }, definition.collisionRadius)
      const blocked = retained.some(other => other.lifeState === 'alive' && overlaps(
        requested,
        definition.collisionRadius,
        other,
        this.#catalog.enemy(other.contentId)!.collisionRadius,
      ))
      const x = blocked ? enemy.x : requested.x
      const y = blocked ? enemy.y : requested.y
      const attacked = canAttack && input.tick >= enemy.nextAttackTick
      if (attacked) attacks.push(Object.freeze({
        amount: definition.attackDamage,
        enemyId: enemy.id,
        playerId: target.id,
      }))
      const next = freezeEnemy({
        ...enemy,
        headingIndex: heading(dx, dy),
        lastAttackTick: attacked ? input.tick : enemy.lastAttackTick,
        moving: x !== enemy.x || y !== enemy.y,
        nextAttackTick: attacked
          ? input.tick + cooldownTicks(definition.attackCooldownMs, this.#ticksPerSecond)
          : enemy.nextAttackTick,
        targetPlayerId: target.id,
        x,
        y,
      })
      retained.push(next)
      changed ||= next.x !== enemy.x || next.y !== enemy.y ||
        next.headingIndex !== enemy.headingIndex || next.moving !== enemy.moving ||
        next.nextAttackTick !== enemy.nextAttackTick || next.targetPlayerId !== enemy.targetPlayerId
    }
    this.#enemies = retained
    if (changed || attacks.length > 0) this.#revision += 1
    return Object.freeze(attacks)
  }
}

function cooldownTicks(milliseconds: number, ticksPerSecond: number): number {
  return Math.max(1, Math.ceil(milliseconds * ticksPerSecond / 1_000))
}

function freezeEnemy(enemy: ActiveModEnemy): ActiveModEnemy {
  return Object.freeze({ ...enemy })
}

function heading(x: number, y: number): number {
  const turn = (Math.atan2(y, x) / (Math.PI * 2) + 1) % 1
  return Math.round(turn * 16) % 16
}

function nearest(
  enemy: Pick<ActiveModEnemy, 'x' | 'y'>,
  players: readonly Readonly<{ id: string; x: number; y: number }>[],
) {
  return [...players].sort((left, right) => (
    distanceSquared(enemy, left) - distanceSquared(enemy, right) || left.id.localeCompare(right.id)
  ))[0]
}

function overlaps(
  left: Readonly<{ x: number; y: number }>,
  leftRadius: number,
  right: Readonly<{ x: number; y: number }>,
  rightRadius: number,
): boolean {
  const radius = leftRadius + rightRadius
  return distanceSquared(left, right) < radius * radius
}

function distanceSquared(
  enemy: Readonly<{ x: number; y: number }>,
  target: Readonly<{ x: number; y: number }>,
): number {
  const x = target.x - enemy.x
  const y = target.y - enemy.y
  return x * x + y * y
}

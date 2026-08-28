import type {
  PreparedModContentCatalog,
  PreparedModShopDefinition,
} from './mod-content-catalog.ts'

const MAXIMUM_SHOP_CELLS = 4_096

export interface ModShopPurchase {
  readonly itemContentId: string
  readonly price: number
  readonly quantity: number
  readonly row: number
  readonly shopContentId: string
}

export interface ModShopStockState {
  readonly playerId: string
  readonly remaining: number
  readonly restockTick: number | null
  readonly row: number
  readonly shopContentId: string
}

export interface ModShopCheckpoint {
  readonly revision: number
  readonly stock: readonly ModShopStockState[]
}

export class ModShopEngine {
  readonly #catalog: PreparedModContentCatalog
  readonly #remaining = new Map<string, Readonly<{ remaining: number; restockTick: number | null }>>()
  readonly #ticksPerSecond: number
  #revision = 0

  constructor(catalog: PreparedModContentCatalog, ticksPerSecond = 100) {
    if (!Number.isSafeInteger(ticksPerSecond) || ticksPerSecond < 1 || ticksPerSecond > 1_000) {
      throw new Error('mod shop tick rate is invalid')
    }
    this.#catalog = catalog
    this.#ticksPerSecond = ticksPerSecond
  }

  get revision(): number {
    return this.#revision
  }

  checkpoint(): ModShopCheckpoint {
    return Object.freeze({ revision: this.#revision, stock: this.project() })
  }

  purchase(
    playerId: string,
    shopContentId: string,
    row: number,
    gold: number,
    tick = 0,
  ): ModShopPurchase {
    const shop = this.#catalog.shop(shopContentId)
    if (!shop || !Number.isSafeInteger(row) || row < 0 || row >= shop.stock.length ||
        !Number.isSafeInteger(tick) || tick < 0) {
      throw new Error('mod shop purchase is unavailable')
    }
    const stock = shop.stock[row]!
    if (!Number.isSafeInteger(gold) || gold < stock.price) throw new Error('mod shop purchase has insufficient currency')
    const key = cellKey(playerId, shop, row)
    const current = this.#remaining.get(key)
    const remaining = current && (current.restockTick === null || tick < current.restockTick)
      ? current.remaining
      : stock.quantity
    if (remaining < 1) throw new Error('mod shop stock is exhausted')
    if (!this.#remaining.has(key) && this.#remaining.size >= MAXIMUM_SHOP_CELLS) {
      throw new Error('mod shop state limit reached')
    }
    this.#remaining.set(key, Object.freeze({
      remaining: remaining - 1,
      restockTick: shop.restockMs === 0
        ? null
        : tick + Math.ceil(shop.restockMs * this.#ticksPerSecond / 1_000),
    }))
    this.#revision += 1
    return Object.freeze({
      itemContentId: stock.item.contentId,
      price: stock.price,
      quantity: 1,
      row,
      shopContentId,
    })
  }

  remaining(playerId: string, shopContentId: string, row: number, tick = 0): number {
    const shop = this.#catalog.shop(shopContentId)
    const stock = shop?.stock[row]
    if (!shop || !stock) return 0
    const current = this.#remaining.get(cellKey(playerId, shop, row))
    return !current || current.restockTick !== null && current.restockTick <= tick
      ? stock.quantity
      : current.remaining
  }

  project(playerId?: string): readonly ModShopStockState[] {
    return Object.freeze([...this.#remaining.entries()].flatMap(([key, state]) => {
      const [owner, shopContentId, row] = key.split('\0')
      return playerId !== undefined && owner !== playerId && owner !== '*' ? [] : [Object.freeze({
        playerId: owner!,
        remaining: state.remaining,
        restockTick: state.restockTick,
        row: Number(row),
        shopContentId: shopContentId!,
      })]
    }))
  }

  restore(checkpoint: ModShopCheckpoint): void {
    if (!Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0 ||
        checkpoint.stock.length > MAXIMUM_SHOP_CELLS) throw new Error('mod shop checkpoint is invalid')
    const candidate = new Map<string, Readonly<{ remaining: number; restockTick: number | null }>>()
    for (const row of checkpoint.stock) {
      const shop = this.#catalog.shop(row.shopContentId)
      const stock = shop?.stock[row.row]
      const key = shop ? cellKey(row.playerId, shop, row.row, true) : ''
      if (!stock || candidate.has(key) || !Number.isSafeInteger(row.remaining) ||
          row.remaining < 0 || row.remaining > stock.quantity ||
          (row.restockTick !== null && (!Number.isSafeInteger(row.restockTick) || row.restockTick < 0))) {
        throw new Error('mod shop checkpoint contains invalid stock')
      }
      candidate.set(key, Object.freeze({ remaining: row.remaining, restockTick: row.restockTick }))
    }
    this.#remaining.clear()
    for (const [key, state] of candidate) this.#remaining.set(key, state)
    this.#revision = checkpoint.revision
  }

  tick(tick: number): boolean {
    if (!Number.isSafeInteger(tick) || tick < 0) throw new Error('mod shop tick is invalid')
    let changed = false
    for (const [key, state] of this.#remaining) {
      if (state.restockTick !== null && state.restockTick <= tick) {
        this.#remaining.delete(key)
        changed = true
      }
    }
    if (changed) this.#revision += 1
    return changed
  }
}

function cellKey(
  playerId: string,
  shop: PreparedModShopDefinition,
  row: number,
  ownerIsStored = false,
): string {
  if (!playerId || playerId.length > 128) throw new Error('mod shop player is invalid')
  const owner = ownerIsStored || shop.stockScope === 'player' ? playerId : '*'
  const requiresPlayerOwner = shop.stockScope === 'player'
  if (ownerIsStored && requiresPlayerOwner !== (playerId !== '*')) {
    throw new Error('mod shop stock scope does not match its owner')
  }
  return `${owner}\0${shop.contentId}\0${row}`
}

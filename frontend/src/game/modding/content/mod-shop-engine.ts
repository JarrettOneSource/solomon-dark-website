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
  readonly row: number
  readonly shopContentId: string
}

export interface ModShopCheckpoint {
  readonly stock: readonly ModShopStockState[]
}

export class ModShopEngine {
  readonly #catalog: PreparedModContentCatalog
  readonly #remaining = new Map<string, number>()

  constructor(catalog: PreparedModContentCatalog) {
    this.#catalog = catalog
  }

  checkpoint(): ModShopCheckpoint {
    return Object.freeze({ stock: this.project() })
  }

  purchase(
    playerId: string,
    shopContentId: string,
    row: number,
    gold: number,
  ): ModShopPurchase {
    const shop = this.#catalog.shop(shopContentId)
    if (!shop || !Number.isSafeInteger(row) || row < 0 || row >= shop.stock.length) {
      throw new Error('mod shop purchase is unavailable')
    }
    const stock = shop.stock[row]!
    if (!Number.isSafeInteger(gold) || gold < stock.price) throw new Error('mod shop purchase has insufficient currency')
    const key = cellKey(playerId, shop, row)
    const remaining = this.#remaining.get(key) ?? stock.quantity
    if (remaining < 1) throw new Error('mod shop stock is exhausted')
    if (!this.#remaining.has(key) && this.#remaining.size >= MAXIMUM_SHOP_CELLS) {
      throw new Error('mod shop state limit reached')
    }
    this.#remaining.set(key, remaining - 1)
    return Object.freeze({
      itemContentId: stock.item.contentId,
      price: stock.price,
      quantity: 1,
      row,
      shopContentId,
    })
  }

  remaining(playerId: string, shopContentId: string, row: number): number {
    const shop = this.#catalog.shop(shopContentId)
    if (!shop || !shop.stock[row]) return 0
    return this.#remaining.get(cellKey(playerId, shop, row)) ?? shop.stock[row]!.quantity
  }

  project(playerId?: string): readonly ModShopStockState[] {
    return Object.freeze([...this.#remaining.entries()].flatMap(([key, remaining]) => {
      const [owner, shopContentId, row] = key.split('\0')
      return playerId !== undefined && owner !== playerId ? [] : [Object.freeze({
        playerId: owner!,
        remaining,
        row: Number(row),
        shopContentId: shopContentId!,
      })]
    }))
  }

  restore(checkpoint: ModShopCheckpoint): void {
    if (checkpoint.stock.length > MAXIMUM_SHOP_CELLS) throw new Error('mod shop checkpoint is invalid')
    const candidate = new Map<string, number>()
    for (const row of checkpoint.stock) {
      const shop = this.#catalog.shop(row.shopContentId)
      const stock = shop?.stock[row.row]
      const key = shop ? cellKey(row.playerId, shop, row.row) : ''
      if (!stock || candidate.has(key) || !Number.isSafeInteger(row.remaining) ||
          row.remaining < 0 || row.remaining > stock.quantity) {
        throw new Error('mod shop checkpoint contains invalid stock')
      }
      candidate.set(key, row.remaining)
    }
    this.#remaining.clear()
    for (const [key, remaining] of candidate) this.#remaining.set(key, remaining)
  }
}

function cellKey(playerId: string, shop: PreparedModShopDefinition, row: number): string {
  if (!playerId || playerId.length > 128) throw new Error('mod shop player is invalid')
  return `${playerId}\0${shop.contentId}\0${row}`
}

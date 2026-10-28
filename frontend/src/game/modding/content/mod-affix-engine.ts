import type {
  PreparedModAffixDefinition,
  PreparedModContentCatalog,
} from './mod-content-catalog.ts'

export interface RolledModAffix {
  readonly contentId: string
  readonly modifiers: PreparedModAffixDefinition['modifiers']
  readonly name: string
  readonly roll: number
}

export class ModAffixEngine {
  readonly #catalog: PreparedModContentCatalog

  constructor(catalog: PreparedModContentCatalog) {
    this.#catalog = catalog
  }

  roll(
    poolId: string,
    equipmentType: string,
    seed: number,
  ): readonly RolledModAffix[] {
    const pool = this.#catalog.affixPool(poolId)
    if (!pool) throw new Error(`mod affix pool is unavailable: ${poolId}`)
    if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('mod affix seed is invalid')
    if (pool.appliesTo.length > 0 && !pool.appliesTo.includes(equipmentType)) return []
    const selected: RolledModAffix[] = []
    for (let roll = 0; roll < pool.rolls; roll += 1) {
      const candidates = pool.entries.filter(entry => !selected.some(item => (
        item.contentId === entry.affix.contentId
      ))).filter(entry => {
        const affix = this.#catalog.affix(entry.affix.contentId)!
        return affix.appliesTo.length === 0 || affix.appliesTo.includes(equipmentType)
      })
      if (candidates.length === 0) break
      const total = candidates.reduce((sum, entry) => sum + entry.weight, 0)
      let cursor = unitRoll(seed, pool.rngDomain, roll) * total
      const chosen = candidates.find((entry) => {
        cursor -= entry.weight
        return cursor < 0
      }) ?? candidates.at(-1)!
      const affix = this.#catalog.affix(chosen.affix.contentId)!
      selected.push(Object.freeze({
        contentId: affix.contentId,
        modifiers: affix.modifiers,
        name: affix.name,
        roll,
      }))
    }
    return Object.freeze(selected)
  }
}

function unitRoll(seed: number, domain: string, ordinal: number): number {
  let hash = 0x811c9dc5 ^ seed
  for (const byte of new TextEncoder().encode(`${domain}\0${ordinal}`)) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash / 0x1_0000_0000
}

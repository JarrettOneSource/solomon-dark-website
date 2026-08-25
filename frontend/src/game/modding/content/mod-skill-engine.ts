import type {
  PreparedModContentCatalog,
  PreparedModSkillDefinition,
} from './mod-content-catalog.ts'

const MAXIMUM_SKILL_CELLS = 4_096

export interface ModSkillRank {
  readonly contentId: string
  readonly playerId: string
  readonly rank: number
}

export interface ModSkillCheckpoint {
  readonly ranks: readonly ModSkillRank[]
  readonly revision: number
}

export class ModSkillEngine {
  readonly #catalog: PreparedModContentCatalog
  readonly #ranks = new Map<string, number>()
  #revision = 0

  constructor(catalog: PreparedModContentCatalog) {
    this.#catalog = catalog
  }

  get revision(): number {
    return this.#revision
  }

  checkpoint(): ModSkillCheckpoint {
    return Object.freeze({ ranks: this.project(), revision: this.#revision })
  }

  choose(playerId: string, contentId: string): ModSkillRank {
    const definition = this.#catalog.skill(contentId)
    if (!definition) throw new Error(`mod skill is unavailable: ${contentId}`)
    if (!this.#eligible(playerId, definition)) throw new Error(`mod skill is not eligible: ${contentId}`)
    const key = cellKey(playerId, contentId)
    const rank = (this.#ranks.get(key) ?? 0) + 1
    if (!this.#ranks.has(key) && this.#ranks.size >= MAXIMUM_SKILL_CELLS) {
      throw new Error('mod skill rank limit reached')
    }
    this.#ranks.set(key, rank)
    this.#revision += 1
    return Object.freeze({ contentId, playerId, rank })
  }

  offer(
    playerId: string,
    level: number,
    seed: number,
    count = 3,
  ): readonly PreparedModSkillDefinition[] {
    if (!Number.isSafeInteger(level) || level < 1 || !Number.isSafeInteger(seed) || seed < 0 ||
        !Number.isSafeInteger(count) || count < 1 || count > 8) {
      throw new Error('mod skill offer input is invalid')
    }
    const pool = this.#catalog.skills().filter(skill => (
      level >= skill.minimumLevel && this.#eligible(playerId, skill)
    ))
    const selected: PreparedModSkillDefinition[] = []
    while (pool.length > 0 && selected.length < count) {
      const total = pool.reduce((sum, skill) => sum + skill.offerWeight, 0)
      let cursor = unitRoll(seed, selected.length) * total
      const index = pool.findIndex((skill) => {
        cursor -= skill.offerWeight
        return cursor < 0
      })
      selected.push(...pool.splice(index < 0 ? pool.length - 1 : index, 1))
    }
    return Object.freeze(selected)
  }

  project(playerId?: string): readonly ModSkillRank[] {
    return Object.freeze([...this.#ranks.entries()].flatMap(([key, rank]) => {
      const split = key.indexOf('\0')
      const owner = key.slice(0, split)
      return playerId !== undefined && owner !== playerId ? [] : [Object.freeze({
        contentId: key.slice(split + 1),
        playerId: owner,
        rank,
      })]
    }).sort((left, right) => left.playerId.localeCompare(right.playerId) || (
      BigInt(left.contentId) < BigInt(right.contentId) ? -1 : 1
    )))
  }

  rank(playerId: string, contentId: string): number {
    return this.#ranks.get(cellKey(playerId, contentId)) ?? 0
  }

  restore(checkpoint: ModSkillCheckpoint): void {
    if (!Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0 ||
        checkpoint.ranks.length > MAXIMUM_SKILL_CELLS) throw new Error('mod skill checkpoint is invalid')
    const candidate = new Map<string, number>()
    for (const row of checkpoint.ranks) {
      const definition = this.#catalog.skill(row.contentId)
      const key = cellKey(row.playerId, row.contentId)
      if (!definition || candidate.has(key) || !Number.isSafeInteger(row.rank) ||
          row.rank < 1 || row.rank > definition.maximumRank) {
        throw new Error('mod skill checkpoint contains an invalid rank')
      }
      candidate.set(key, row.rank)
    }
    this.#ranks.clear()
    for (const [key, rank] of candidate) this.#ranks.set(key, rank)
    this.#revision = checkpoint.revision
  }

  #eligible(playerId: string, skill: PreparedModSkillDefinition): boolean {
    if (this.rank(playerId, skill.contentId) >= skill.maximumRank) return false
    return skill.prerequisites.every(required => this.rank(playerId, required.contentId) > 0)
  }
}

function cellKey(playerId: string, contentId: string): string {
  if (!playerId || playerId.length > 128) throw new Error('mod skill player is invalid')
  return `${playerId}\0${contentId}`
}

function unitRoll(seed: number, ordinal: number): number {
  let value = (seed ^ Math.imul(ordinal + 1, 0x9e3779b9)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  return value / 0x1_0000_0000
}

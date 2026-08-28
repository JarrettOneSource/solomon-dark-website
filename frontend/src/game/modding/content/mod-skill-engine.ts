import type {
  PreparedModContentCatalog,
  PreparedModSkillDefinition,
} from './mod-content-catalog.ts'

const MAXIMUM_SKILL_CELLS = 4_096
const MOD_QUICKBAR_SLOTS = 8

export interface ModSkillBinding {
  readonly contentId: string
  readonly playerId: string
  readonly slot: number
}

export interface ModSkillRank {
  readonly contentId: string
  readonly playerId: string
  readonly rank: number
}

export interface ModSkillCheckpoint {
  readonly bindings: readonly ModSkillBinding[]
  readonly offers: readonly ModSkillOffer[]
  readonly ranks: readonly ModSkillRank[]
  readonly revision: number
}

export interface ModSkillOffer {
  readonly contentIds: readonly string[]
  readonly playerId: string
  readonly sequence: number
}

export class ModSkillEngine {
  readonly #catalog: PreparedModContentCatalog
  readonly #bindings = new Map<string, string>()
  readonly #ranks = new Map<string, number>()
  readonly #offers = new Map<string, ModSkillOffer>()
  #revision = 0

  constructor(catalog: PreparedModContentCatalog) {
    this.#catalog = catalog
  }

  get revision(): number {
    return this.#revision
  }

  checkpoint(): ModSkillCheckpoint {
    return Object.freeze({
      bindings: this.projectBindings(),
      offers: Object.freeze([...this.#offers.values()]),
      ranks: this.project(),
      revision: this.#revision,
    })
  }

  choose(playerId: string, contentId: string, offerSequence: number): ModSkillRank {
    const definition = this.#catalog.skill(contentId)
    if (!definition) throw new Error(`mod skill is unavailable: ${contentId}`)
    const offer = this.#offers.get(playerId)
    if (offer?.sequence !== offerSequence || !offer.contentIds.includes(contentId)) {
      throw new Error(`mod skill was not offered: ${contentId}`)
    }
    if (!this.#eligible(playerId, definition)) throw new Error(`mod skill is not eligible: ${contentId}`)
    const key = cellKey(playerId, contentId)
    const rank = (this.#ranks.get(key) ?? 0) + 1
    if (!this.#ranks.has(key) && this.#ranks.size >= MAXIMUM_SKILL_CELLS) {
      throw new Error('mod skill rank limit reached')
    }
    this.#ranks.set(key, rank)
    this.#offers.delete(playerId)
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
    const result = Object.freeze(selected)
    this.#offers.set(playerId, Object.freeze({
      contentIds: Object.freeze(result.map(skill => skill.contentId)),
      playerId,
      sequence: this.#revision + 1,
    }))
    this.#revision += 1
    return result
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

  bind(playerId: string, slot: number, contentId: string | null): void {
    if (!Number.isSafeInteger(slot) || slot < 0 || slot >= MOD_QUICKBAR_SLOTS) {
      throw new Error('mod quickbar slot is invalid')
    }
    const key = bindingKey(playerId, slot)
    if (contentId === null) {
      if (this.#bindings.delete(key)) this.#revision += 1
      return
    }
    if (!this.#catalog.spell(contentId) || !this.spellUnlocked(playerId, contentId)) {
      throw new Error('mod quickbar spell is unavailable')
    }
    if (this.#bindings.get(key) === contentId) return
    this.#bindings.set(key, contentId)
    this.#revision += 1
  }

  filter(playerId: string, key: string, source: number): number {
    let value = source
    for (const skill of this.#catalog.skills()) {
      const rank = this.rank(playerId, skill.contentId)
      for (const row of skill.ranks.slice(0, rank)) {
        const modifiers = record(row.modify ?? row.modifiers)
        const modifier = modifiers ? modifiers[key] : undefined
        if (typeof modifier === 'number' && Number.isFinite(modifier)) value = modifier
        else {
          const operations = record(modifier)
          if (typeof operations?.add === 'number') value += operations.add
          if (typeof operations?.multiply === 'number') value *= operations.multiply
          if (typeof operations?.set === 'number') value = operations.set
        }
      }
    }
    return Number.isFinite(value) ? Math.max(0, value) : source
  }

  projectBindings(playerId?: string): readonly ModSkillBinding[] {
    return Object.freeze([...this.#bindings.entries()].flatMap(([key, contentId]) => {
      const split = key.lastIndexOf('\0')
      const owner = key.slice(0, split)
      return playerId !== undefined && owner !== playerId ? [] : [Object.freeze({
        contentId,
        playerId: owner,
        slot: Number(key.slice(split + 1)),
      })]
    }).sort((left, right) => left.playerId.localeCompare(right.playerId) || left.slot - right.slot))
  }

  spellUnlocked(playerId: string, contentId: string): boolean {
    const owners = this.#catalog.skills().filter(skill => [
      ...skill.grants,
      ...skill.rankGrants.flat(),
    ].some(grant => grant.targetKind === 'spell' && grant.contentId === contentId))
    if (owners.length === 0) return true
    return owners.some(skill => {
      const rank = this.rank(playerId, skill.contentId)
      return skill.grants.some(grant => grant.contentId === contentId) && rank > 0
        || skill.rankGrants.slice(0, rank).flat().some(grant => grant.contentId === contentId)
    })
  }

  offers(playerId?: string): readonly ModSkillOffer[] {
    return Object.freeze([...this.#offers.values()].filter(offer => (
      playerId === undefined || offer.playerId === playerId
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
    this.#offers.clear()
    this.#bindings.clear()
    for (const [key, rank] of candidate) this.#ranks.set(key, rank)
    for (const offer of checkpoint.offers) {
      if (this.#offers.has(offer.playerId) || !Number.isSafeInteger(offer.sequence) || offer.sequence < 1 ||
          offer.contentIds.length > 8 || offer.contentIds.some(id => !this.#catalog.skill(id))) {
        throw new Error('mod skill checkpoint contains an invalid offer')
      }
      this.#offers.set(offer.playerId, Object.freeze({
        contentIds: Object.freeze([...offer.contentIds]),
        playerId: offer.playerId,
        sequence: offer.sequence,
      }))
    }
    for (const binding of checkpoint.bindings) {
      const key = bindingKey(binding.playerId, binding.slot)
      if (this.#bindings.has(key) || !this.#catalog.spell(binding.contentId) ||
          !this.spellUnlocked(binding.playerId, binding.contentId)) {
        throw new Error('mod skill checkpoint contains an invalid quickbar binding')
      }
      this.#bindings.set(key, binding.contentId)
    }
    this.#revision = checkpoint.revision
  }

  #eligible(playerId: string, skill: PreparedModSkillDefinition): boolean {
    if (this.rank(playerId, skill.contentId) >= skill.maximumRank) return false
    return (!skill.parent || this.rank(playerId, skill.parent.contentId) > 0)
      && skill.prerequisites.every(required => this.rank(playerId, required.contentId) > 0)
  }
}

function cellKey(playerId: string, contentId: string): string {
  if (!playerId || playerId.length > 128) throw new Error('mod skill player is invalid')
  return `${playerId}\0${contentId}`
}

function bindingKey(playerId: string, slot: number): string {
  if (!playerId || playerId.length > 128) throw new Error('mod skill player is invalid')
  return `${playerId}\0${slot}`
}

function record(value: unknown): Readonly<Record<string, unknown>> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : null
}

function unitRoll(seed: number, ordinal: number): number {
  let value = (seed ^ Math.imul(ordinal + 1, 0x9e3779b9)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  return value / 0x1_0000_0000
}

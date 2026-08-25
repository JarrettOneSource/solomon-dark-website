import type {
  PreparedModContentCatalog,
  PreparedModSpellDefinition,
} from './mod-content-catalog.ts'

const MAXIMUM_COOLDOWNS = 4_096

export interface ModSpellCooldown {
  readonly contentId: string
  readonly playerId: string
  readonly readyTick: number
}

export interface ModSpellCheckpoint {
  readonly cooldowns: readonly ModSpellCooldown[]
  readonly revision: number
}

export class ModSpellEngine {
  readonly #catalog: PreparedModContentCatalog
  readonly #cooldowns = new Map<string, number>()
  readonly #ticksPerSecond: number
  #revision = 0

  constructor(catalog: PreparedModContentCatalog, ticksPerSecond: number) {
    if (!Number.isSafeInteger(ticksPerSecond) || ticksPerSecond < 1 || ticksPerSecond > 1_000) {
      throw new Error('mod spell tick rate is invalid')
    }
    this.#catalog = catalog
    this.#ticksPerSecond = ticksPerSecond
  }

  admit(
    playerId: string,
    contentId: string,
    tick: number,
    currentMana: number,
  ): Readonly<{ manaCost: number; readyTick: number; spell: PreparedModSpellDefinition }> {
    const spell = this.#catalog.spell(contentId)
    if (!spell) throw new Error(`mod spell is unavailable: ${contentId}`)
    if (!Number.isSafeInteger(tick) || tick < 0 || !Number.isFinite(currentMana) || currentMana < 0) {
      throw new Error('mod spell admission input is invalid')
    }
    const key = cellKey(playerId, contentId)
    if ((this.#cooldowns.get(key) ?? 0) > tick) throw new Error('mod spell is cooling down')
    if (currentMana < spell.mana) throw new Error('mod spell has insufficient mana')
    if (!this.#cooldowns.has(key) && this.#cooldowns.size >= MAXIMUM_COOLDOWNS) {
      throw new Error('mod spell cooldown limit reached')
    }
    const readyTick = tick + Math.ceil(spell.cooldownMs * this.#ticksPerSecond / 1_000)
    this.#cooldowns.set(key, readyTick)
    this.#revision += 1
    return Object.freeze({ manaCost: spell.mana, readyTick, spell })
  }

  checkpoint(): ModSpellCheckpoint {
    return Object.freeze({ cooldowns: this.project(), revision: this.#revision })
  }

  project(playerId?: string): readonly ModSpellCooldown[] {
    return Object.freeze([...this.#cooldowns.entries()].flatMap(([key, readyTick]) => {
      const split = key.indexOf('\0')
      const owner = key.slice(0, split)
      return playerId !== undefined && playerId !== owner ? [] : [Object.freeze({
        contentId: key.slice(split + 1),
        playerId: owner,
        readyTick,
      })]
    }))
  }

  restore(checkpoint: ModSpellCheckpoint): void {
    if (!Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0 ||
        checkpoint.cooldowns.length > MAXIMUM_COOLDOWNS) throw new Error('mod spell checkpoint is invalid')
    const candidate = new Map<string, number>()
    for (const row of checkpoint.cooldowns) {
      const key = cellKey(row.playerId, row.contentId)
      if (!this.#catalog.spell(row.contentId) || candidate.has(key) ||
          !Number.isSafeInteger(row.readyTick) || row.readyTick < 0) {
        throw new Error('mod spell checkpoint contains an invalid cooldown')
      }
      candidate.set(key, row.readyTick)
    }
    this.#cooldowns.clear()
    for (const [key, tick] of candidate) this.#cooldowns.set(key, tick)
    this.#revision = checkpoint.revision
  }
}

function cellKey(playerId: string, contentId: string): string {
  if (!playerId || playerId.length > 128) throw new Error('mod spell player is invalid')
  return `${playerId}\0${contentId}`
}

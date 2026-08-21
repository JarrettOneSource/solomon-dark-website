import {
  rankHallOfFameEntries,
  type HallOfFameEntry,
} from './core-kernels/hall-of-fame.ts'

export const HALL_OF_FAME_STORAGE_KEY = 'sdr.game.hall-of-fame.v2'

export function readLocalHallOfFame(
  storage: Pick<Storage, 'getItem'> = localStorage,
): HallOfFameEntry[] {
  const raw = storage.getItem(HALL_OF_FAME_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const entries = parsed.map(hallOfFameEntry)
    return rankHallOfFameEntries(entries)
  } catch {
    return []
  }
}

export function recordLocalHallOfFame(
  entry: HallOfFameEntry,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): HallOfFameEntry[] {
  const entries = rankHallOfFameEntries([
    entry,
    ...readLocalHallOfFame(storage).filter((candidate) => candidate.runId !== entry.runId),
  ])
  storage.setItem(HALL_OF_FAME_STORAGE_KEY, JSON.stringify(entries))
  return entries
}

function hallOfFameEntry(value: unknown): HallOfFameEntry {
  if (!value || typeof value !== 'object') throw new Error('Hall of Fame entry is invalid')
  const source = value as Record<string, unknown>
  const entry: HallOfFameEntry = {
    accountUsername: nullableString(source.accountUsername),
    awesomeness: integer(source.awesomeness),
    awesomestKill: nullableString(source.awesomestKill),
    completedAtUtc: string(source.completedAtUtc),
    discipline: discipline(source.discipline),
    elapsedTicks: integer(source.elapsedTicks),
    element: element(source.element),
    headingIndex: integer(source.headingIndex),
    highestSkills: array(source.highestSkills).map((skill) => {
      if (!skill || typeof skill !== 'object') throw new Error('Hall skill is invalid')
      const row = skill as Record<string, unknown>
      return { rank: integer(row.rank), skillId: integer(row.skillId) }
    }),
    level: integer(source.level),
    monstersKilled: integer(source.monstersKilled),
    perksUsed: array(source.perksUsed).map(integer),
    portraitScale: finiteNumber(source.portraitScale),
    runId: string(source.runId),
    wave: integer(source.wave),
    wizardName: string(source.wizardName),
  }
  if (entry.highestSkills.length > 3 || entry.perksUsed.length > 9) {
    throw new Error('Hall of Fame entry exceeds its native row limits')
  }
  if (entry.portraitScale < 0.85 || entry.portraitScale > 1) {
    throw new Error('Hall portrait scale is outside its native range')
  }
  return entry
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Hall of Fame array is invalid')
  return value
}

function integer(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error('Hall of Fame integer is invalid')
  }
  return value as number
}

function finiteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Hall of Fame number is invalid')
  }
  return value
}

function nullableString(value: unknown): string | null {
  return value === null ? null : string(value)
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Hall of Fame string is invalid')
  return value
}

function element(value: unknown): HallOfFameEntry['element'] {
  if (value !== 'air' && value !== 'earth' && value !== 'ether'
    && value !== 'fire' && value !== 'water') {
    throw new Error('Hall of Fame element is invalid')
  }
  return value
}

function discipline(value: unknown): HallOfFameEntry['discipline'] {
  if (value !== 'arcane' && value !== 'body' && value !== 'mind') {
    throw new Error('Hall of Fame discipline is invalid')
  }
  return value
}

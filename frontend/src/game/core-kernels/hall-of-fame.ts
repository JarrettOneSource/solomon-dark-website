import type {
  WizardDiscipline,
  WizardElement,
} from './player-character.ts'

export const HALL_OF_FAME_BOARDS = [
  'awesomeness',
  'wave',
  'kills',
  'time',
] as const

export type HallOfFameBoard = typeof HALL_OF_FAME_BOARDS[number]

export interface HallOfFameSkill {
  rank: number
  skillId: number
}

export interface HallOfFameEntry {
  accountUsername: string | null
  awesomeness: number
  awesomestKill: string | null
  completedAtUtc: string
  discipline: WizardDiscipline
  elapsedTicks: number
  element: WizardElement
  headingIndex: number
  highestSkills: readonly HallOfFameSkill[]
  level: number
  monstersKilled: number
  perksUsed: readonly number[]
  portraitScale: number
  runId: string
  wave: number
  wizardName: string
}

const BOARD_VALUE: Readonly<Record<
  HallOfFameBoard,
  (entry: HallOfFameEntry) => number
>> = {
  awesomeness: (entry) => entry.awesomeness,
  wave: (entry) => entry.wave,
  kills: (entry) => entry.monstersKilled,
  time: (entry) => entry.elapsedTicks,
}

export function rankHallOfFameEntries(
  entries: readonly HallOfFameEntry[],
  board: HallOfFameBoard = 'awesomeness',
  limit = 100,
): HallOfFameEntry[] {
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new RangeError('Hall of Fame limit must be a non-negative safe integer')
  }
  const value = BOARD_VALUE[board]
  return entries
    .map((entry, sourceIndex) => ({ entry, sourceIndex }))
    .sort((left, right) => (
      value(right.entry) - value(left.entry)
      || (board === 'awesomeness'
        ? 0
        : right.entry.awesomeness - left.entry.awesomeness)
      || left.sourceIndex - right.sourceIndex
    ))
    .slice(0, limit)
    .map(({ entry }) => entry)
}

export function formatHallOfFameTime(elapsedTicks: number): string {
  if (!Number.isSafeInteger(elapsedTicks) || elapsedTicks < 0) {
    throw new RangeError('Hall of Fame elapsed ticks must be a non-negative safe integer')
  }
  const totalSeconds = Math.floor(elapsedTicks / 100)
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor(totalSeconds % 3_600 / 60)
  const seconds = totalSeconds % 60
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function isHallOfFameBoard(value: string): value is HallOfFameBoard {
  return HALL_OF_FAME_BOARDS.some((board) => board === value)
}

import {
  NATIVE_SKILL_CATALOG,
  nativeSkillCategory,
  nativeSkillDependencies,
} from './core-kernels/player-progression.ts'
import type { NativeHudPoint, NativeHudRect } from './native-hud-layout.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'

export const NATIVE_SKILL_DRAG_THRESHOLD_SQUARED = 9
export const NATIVE_SKILL_DRAGGER_SIZE = 40
export const NATIVE_SKILL_DRAGGER_SCALE = 1.25
export const NATIVE_SKILL_PAGE_BASE_WIDTH = 200
export const NATIVE_SKILL_PAGE_DEPENDENT_WIDTH = 160
export const NATIVE_SKILL_PAGE_HEIGHT = 300
export const NATIVE_SKILL_SCREEN_WIDTH = 1_600
export const NATIVE_SKILL_SCREEN_PAGE_REGION_HEIGHT = 760
export const NATIVE_SKILL_SCREEN_PAGE_REGION_TOP = 50
export const NATIVE_SKILL_SCREEN_ROW_INSET = 10
export const NATIVE_SKILL_SCREEN_ROW_OFFSET_Y = 22

export interface NativeSkillBookRow {
  readonly category: number
  readonly dependencyIds: readonly number[]
  readonly description: string
  readonly effectiveRank: number
  readonly iconRecord: number
  readonly id: number
  readonly name: string
  readonly permanentRank: number
  readonly weldBuildId: number | null
}

export interface NativeSkillBookPage {
  readonly height: number
  readonly rootSkillId: number
  readonly rows: readonly NativeSkillBookRow[]
  readonly width: number
}

export interface NativeSkillBookPagePlacement {
  readonly page: NativeSkillBookPage
  readonly x: number
  readonly y: number
}

export type NativeSkillBookTooltipLineKind =
  | 'bonus'
  | 'boost'
  | 'category'
  | 'description'
  | 'level'
  | 'spacer'
  | 'stat'
  | 'title'

export interface NativeSkillBookTooltipLine {
  readonly kind: NativeSkillBookTooltipLineKind
  readonly text: string
}

export function nativeSkillDragStarted(
  origin: Readonly<NativeHudPoint>,
  current: Readonly<NativeHudPoint>,
): boolean {
  const dx = current.x - origin.x
  const dy = current.y - origin.y
  return dx * dx + dy * dy > NATIVE_SKILL_DRAG_THRESHOLD_SQUARED
}

export function nativeSkillQuickbarDropSlot(
  pointer: Readonly<NativeHudPoint>,
  slots: readonly NativeHudRect[],
): number | null {
  const half = NATIVE_SKILL_DRAGGER_SIZE / 2
  const dragLeft = pointer.x - half
  const dragTop = pointer.y - half
  const dragRight = dragLeft + NATIVE_SKILL_DRAGGER_SIZE
  const dragBottom = dragTop + NATIVE_SKILL_DRAGGER_SIZE
  let greatestArea = 0
  let winner: number | null = null
  slots.forEach((slot, index) => {
    const width = Math.max(0, Math.min(dragRight, slot.x + slot.width) - Math.max(dragLeft, slot.x))
    const height = Math.max(0, Math.min(dragBottom, slot.y + slot.height) - Math.max(dragTop, slot.y))
    const area = width * height
    if (area <= greatestArea) return
    greatestArea = area
    winner = index
  })
  return winner
}

/**
 * Mirrors SkillScreen_BuildPages: each learned row with no dependency owns a
 * page and every learned transitive dependent is appended to that page.
 */
export function nativeSkillBookPages(
  progression: ProtocolPlayerProgression,
): readonly NativeSkillBookPage[] {
  const rankBySkillId = new Map(progression.learnedSkills.map((entry) => [entry[0], entry] as const))
  const learnedRows = progression.learnedSkillOrder.flatMap((id) => {
    const ranks = rankBySkillId.get(id)
    if (!ranks) return []
    const [, permanentRank, effectiveRank] = ranks
    if (permanentRank <= 0) return []
    const skill = NATIVE_SKILL_CATALOG[id]
    if (!skill) return []
    const category = nativeSkillCategory(id)
    if (category === null) return []
    return [Object.freeze({
      category,
      dependencyIds: nativeSkillDependencies(id),
      description: skill.config?.mQDescription ?? skill.config?.mDescription ?? '',
      effectiveRank,
      iconRecord: skill.skills_atlas_icon_record,
      id,
      name: skill.name,
      permanentRank,
      weldBuildId: id === 52 ? progression.weldBuildId : null,
    })]
  })
  const byId = new Map(learnedRows.map((row) => [row.id, row] as const))
  const dependsOn = (skillId: number, rootSkillId: number, seen = new Set<number>()): boolean => {
    if (seen.has(skillId)) return false
    seen.add(skillId)
    const row = byId.get(skillId)
    if (!row) return false
    return row.dependencyIds.some((dependencyId) => (
      dependencyId === rootSkillId || dependsOn(dependencyId, rootSkillId, seen)
    ))
  }
  const roots = learnedRows.filter(({ dependencyIds }) => dependencyIds.length === 0)
  return Object.freeze(roots.map((root) => {
    const rows = [root, ...learnedRows.filter((row) => (
      row.id !== root.id && dependsOn(row.id, root.id)
    ))]
    return Object.freeze({
      height: NATIVE_SKILL_PAGE_HEIGHT,
      rootSkillId: root.id,
      rows: Object.freeze(rows),
      width: NATIVE_SKILL_PAGE_BASE_WIDTH
        + NATIVE_SKILL_PAGE_DEPENDENT_WIDTH * (rows.length - 1),
    })
  }))
}

/** Recovered row wrapping and centering used by SkillScreen_BuildPages. */
export function nativeSkillBookPagePlacements(
  pages: readonly NativeSkillBookPage[],
): readonly NativeSkillBookPagePlacement[] {
  if (pages.length === 0) return Object.freeze([])
  const maximumRowWidth = NATIVE_SKILL_SCREEN_WIDTH - NATIVE_SKILL_SCREEN_ROW_INSET
  const rows: NativeSkillBookPage[][] = [[]]
  const rowWidths = [0]
  for (const page of pages) {
    const rowIndex = rows.length - 1
    if (rowWidths[rowIndex]! > 0 && rowWidths[rowIndex]! + page.width > maximumRowWidth) {
      rows.push([page])
      rowWidths.push(page.width)
    } else {
      rows[rowIndex]!.push(page)
      rowWidths[rowIndex] = rowWidths[rowIndex]! + page.width
    }
  }
  const widestRow = Math.max(...rowWidths)
  const xOrigin = NATIVE_SKILL_SCREEN_WIDTH / 2 - widestRow / 2
  const yOrigin = rows.length === 1
    ? NATIVE_SKILL_SCREEN_PAGE_REGION_TOP
      + (NATIVE_SKILL_SCREEN_PAGE_REGION_HEIGHT - NATIVE_SKILL_PAGE_HEIGHT) / 2
    : NATIVE_SKILL_SCREEN_PAGE_REGION_TOP + NATIVE_SKILL_SCREEN_ROW_OFFSET_Y
  const placements: NativeSkillBookPagePlacement[] = []
  rows.forEach((row, rowIndex) => {
    let x = xOrigin
    for (const page of row) {
      placements.push(Object.freeze({
        page,
        x,
        y: yOrigin + rowIndex * NATIVE_SKILL_PAGE_HEIGHT,
      }))
      x += page.width
    }
  })
  return Object.freeze(placements)
}

export function nativeSkillBookRows(
  progression: ProtocolPlayerProgression,
): readonly NativeSkillBookRow[] {
  return [...new Map(nativeSkillBookPages(progression)
    .flatMap((page) => page.rows)
    .map((row) => [row.id, row] as const)).values()]
}

export function selectableSecondarySkillRows(
  progression: ProtocolPlayerProgression,
): readonly NativeSkillBookRow[] {
  return nativeSkillBookRows(progression).filter(({ category }) => category === 2)
}

export function selectableConcentrationSkillRows(
  progression: ProtocolPlayerProgression,
): readonly NativeSkillBookRow[] {
  return nativeSkillBookRows(progression).filter(({ category }) => category === 3)
}

export function selectablePrimarySkillRows(
  progression: ProtocolPlayerProgression,
): readonly NativeSkillBookRow[] {
  return nativeSkillBookRows(progression).filter(({ category }) => category === 1)
}

export function nativeSkillBookMaximumRank(row: NativeSkillBookRow): number {
  const config = NATIVE_SKILL_CATALOG[row.id]?.config
  return typeof config?.mCapLevel === 'number' && config.mCapLevel > 0
    ? config.mCapLevel
    : typeof config?.mMaxLevel === 'number' && config.mMaxLevel > 0
      ? config.mMaxLevel
      : row.effectiveRank
}

export function nativeSkillBookTooltipLines(
  row: NativeSkillBookRow,
): readonly NativeSkillBookTooltipLine[] {
  const config = NATIVE_SKILL_CATALOG[row.id]?.config
  if (!config) return Object.freeze([])
  const lines: NativeSkillBookTooltipLine[] = []
  if (row.effectiveRank > row.permanentRank) {
    lines.push(Object.freeze({
      kind: 'boost',
      text: row.permanentRank === 0 ? 'GRANTED BY ITEM' : 'BOOSTED',
    }))
  }
  const rankSuffix = nativeSkillBookMaximumRank(row) > 1
    ? ` _s(.7)_o(0,1)${row.effectiveRank}/${nativeSkillBookMaximumRank(row)}`
    : ''
  lines.push(
    Object.freeze({ kind: 'title', text: `${row.name.toUpperCase()}${rankSuffix}` }),
    Object.freeze({ kind: 'category', text: nativeSkillBookCategoryName(row.category) }),
    Object.freeze({ kind: 'description', text: config.mDescription ?? row.description }),
    Object.freeze({ kind: 'spacer', text: '' }),
    Object.freeze({ kind: 'level', text: `   Current Level: ${row.effectiveRank}` }),
  )
  for (const source of nativeSkillBookConfigLines(config.mStats)) {
    lines.push(Object.freeze({
      kind: 'stat',
      text: `   ${formatNativeSkillBookTooltipLine(source, config, row.effectiveRank)}`,
    }))
  }
  if (row.category === 3) {
    for (const source of nativeSkillBookConfigLines(config.mBonus)) {
      lines.push(Object.freeze({
        kind: 'bonus',
        text: `   ${formatNativeSkillBookTooltipLine(source, config, row.effectiveRank)}`,
      }))
    }
  }
  return Object.freeze(lines)
}

export function formatNativeSkillBookTooltipLine(
  source: string,
  config: Readonly<Record<string, unknown>>,
  rank: number,
): string {
  let result = ''
  for (let index = 0; index < source.length;) {
    if (source.startsWith('%%', index)) {
      result += '%'
      index += 2
      continue
    }
    if (source[index] !== '%' || index + 2 >= source.length || source[index + 2] !== ':') {
      result += source[index]
      index += 1
      continue
    }
    const format = source[index + 1]!.toUpperCase()
    if (!['D', 'F', 'N', 'X'].includes(format)) {
      result += source[index]
      index += 1
      continue
    }
    let propertyEnd = index + 3
    while (propertyEnd < source.length && /[A-Za-z0-9_]/.test(source[propertyEnd]!)) {
      propertyEnd += 1
    }
    const property = source.slice(index + 3, propertyEnd)
    const configured = config[property]
    const configuredValue = typeof configured === 'number'
      ? configured
      : Array.isArray(configured)
        ? configured[Math.min(rank, configured.length - 1)]
        : undefined
    const value = typeof configuredValue === 'number' && Number.isFinite(configuredValue)
      ? configuredValue
      : 0
    result += nativeSkillBookFormattedNumber(value, format)
    index = propertyEnd + (source[propertyEnd] === '%' ? 1 : 0)
  }
  return result
    .replaceAll('[CR]', '\n')
    .replaceAll('"\r\n\t"', '\n')
    .replaceAll('"', '')
}

function nativeSkillBookConfigLines(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((line): line is string => typeof line === 'string')
    : Object.freeze([])
}

function nativeSkillBookFormattedNumber(value: number, format: string): string {
  if (format === 'D') return value.toFixed(0)
  if (format === 'F') return value.toFixed(1)
  if (format === 'X') return value.toFixed(2)
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
}

function nativeSkillBookCategoryName(category: number): string {
  if (category === 1) return 'PRIMARY CAST'
  if (category === 2) return 'SECONDARY CAST'
  if (category === 3) return 'CONCENTRATION'
  return 'PASSIVE SKILL'
}

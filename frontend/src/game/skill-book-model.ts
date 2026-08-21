import {
  NATIVE_SKILL_CATALOG,
  nativeSkillCategory,
  nativeSkillDependencies,
} from './core-kernels/player-progression.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'

export const NATIVE_SKILL_PAGE_BASE_WIDTH = 200
export const NATIVE_SKILL_PAGE_DEPENDENT_WIDTH = 160
export const NATIVE_SKILL_PAGE_HEIGHT = 300
export const NATIVE_SKILL_SCREEN_WIDTH = 1_600
export const NATIVE_SKILL_SCREEN_PAGE_REGION_HEIGHT = 760
export const NATIVE_SKILL_SCREEN_PAGE_REGION_TOP = 50
export const NATIVE_SKILL_SCREEN_ROW_INSET = 10
export const NATIVE_SKILL_SCREEN_ROW_OFFSET_Y = 22

const ELEMENTAL_PRIMARY_SKILL_IDS = new Set([8, 16, 24, 32, 40])

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
      weldBuildId: id === 52 ? progression.activeWeldBuildId : null,
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
    row.forEach((page) => {
      placements.push(Object.freeze({
        page,
        x,
        y: yOrigin + rowIndex * NATIVE_SKILL_PAGE_HEIGHT,
      }))
      x += page.width
    })
  })
  return Object.freeze(placements)
}

export function selectableSecondarySkillRows(
  progression: ProtocolPlayerProgression,
): readonly NativeSkillBookRow[] {
  return uniquePageRows(progression).filter(({ category }) => category === 2)
}

export function selectableConcentrationSkillRows(
  progression: ProtocolPlayerProgression,
): readonly NativeSkillBookRow[] {
  return uniquePageRows(progression).filter(({ category }) => category === 3)
}

export function selectablePrimarySkillRows(
  progression: ProtocolPlayerProgression,
): readonly NativeSkillBookRow[] {
  return uniquePageRows(progression).filter(({ id }) => ELEMENTAL_PRIMARY_SKILL_IDS.has(id))
}

function uniquePageRows(progression: ProtocolPlayerProgression): readonly NativeSkillBookRow[] {
  const rows = nativeSkillBookPages(progression).flatMap((page) => page.rows)
  return [...new Map(rows.map((row) => [row.id, row] as const)).values()]
}

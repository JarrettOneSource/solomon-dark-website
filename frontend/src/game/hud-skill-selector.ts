import {
  NATIVE_SKILL_CATALOG,
  nativeSkillCategory,
  nativeWeldBuild,
} from './core-kernels/player-progression.ts'
import type { NativeHudSkillBinding } from './native-hud-presentation.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'

export const NATIVE_HUD_SKILL_SELECTOR_CELL_SIZE = 52
export const NATIVE_HUD_SKILL_SELECTOR_CENTER_X = 800
export const NATIVE_HUD_SKILL_SELECTOR_CENTER_Y = 100
export const NATIVE_HUD_SKILL_SELECTOR_PANEL_HEIGHT = 79
export const NATIVE_HUD_SKILL_SELECTOR_PANEL_TOP = 52
export const NATIVE_HUD_SKILL_SELECTOR_TITLE_Y = 69

export type NativeHudSkillSelectorTarget =
  | Readonly<{ binding: 12; kind: 'primary' }>
  | Readonly<{ binding: 16; kind: 'concentration'; slot: 0 }>
  | Readonly<{ binding: 20; kind: 'concentration'; slot: 1 }>

export interface NativeHudSkillSelectorOption {
  readonly iconRecord: number
  readonly name: string
  readonly skillId: number
}

export interface NativeHudSkillSelectorLayout {
  readonly optionLeft: number
  readonly optionTop: number
  readonly panelHeight: number
  readonly panelLeft: number
  readonly panelTop: number
  readonly panelWidth: number
  readonly stripWidth: number
  readonly titleY: number
}

export function nativeHudSkillSelectorTarget(
  binding: NativeHudSkillBinding,
): NativeHudSkillSelectorTarget {
  if (binding === 12) return Object.freeze({ binding, kind: 'primary' })
  if (binding === 16) return Object.freeze({ binding, kind: 'concentration', slot: 0 })
  return Object.freeze({ binding, kind: 'concentration', slot: 1 })
}

export function nativeHudSkillSelectorTitle(target: NativeHudSkillSelectorTarget): string {
  return target.kind === 'primary' ? 'Select Primary Attack' : 'Select Concentration'
}

export function nativeHudSkillSelectorOptions(
  progression: ProtocolPlayerProgression,
  target: NativeHudSkillSelectorTarget,
): readonly NativeHudSkillSelectorOption[] {
  const category = target.kind === 'primary' ? 1 : 3
  const excludedSkillId = target.kind === 'concentration'
    ? progression.concentrationSkillIds[target.slot === 0 ? 1 : 0]
    : null
  return Object.freeze(progression.learnedSkills
    .filter(([skillId, , effectiveRank]) => (
      effectiveRank > 0
      && skillId !== excludedSkillId
      && nativeSkillCategory(skillId) === category
      && (skillId !== 52 || progression.weldBuildId !== null)
    ))
    .sort(([left], [right]) => left - right)
    .map(([skillId]) => {
      const skill = NATIVE_SKILL_CATALOG[skillId]
      if (!skill) throw new RangeError(`native selector skill ${skillId} is absent`)
      const weld = skillId === 52 ? nativeWeldBuild(progression.weldBuildId!) : null
      return Object.freeze({
        iconRecord: weld?.skillsAtlasIconRecord ?? skill.skills_atlas_icon_record,
        name: skill.name,
        skillId,
      })
    }))
}

export function nativeHudSkillSelectorLayout(
  optionCount: number,
  titleWidth: number,
): NativeHudSkillSelectorLayout {
  const stripWidth = Math.max(0, Math.trunc(optionCount)) * NATIVE_HUD_SKILL_SELECTOR_CELL_SIZE
  const panelWidth = Math.max(stripWidth, titleWidth) + 10
  return Object.freeze({
    optionLeft: NATIVE_HUD_SKILL_SELECTOR_CENTER_X - stripWidth / 2,
    optionTop: NATIVE_HUD_SKILL_SELECTOR_CENTER_Y - NATIVE_HUD_SKILL_SELECTOR_CELL_SIZE / 2,
    panelHeight: NATIVE_HUD_SKILL_SELECTOR_PANEL_HEIGHT,
    panelLeft: NATIVE_HUD_SKILL_SELECTOR_CENTER_X - panelWidth / 2,
    panelTop: NATIVE_HUD_SKILL_SELECTOR_PANEL_TOP,
    panelWidth,
    stripWidth,
    titleY: NATIVE_HUD_SKILL_SELECTOR_TITLE_Y,
  })
}

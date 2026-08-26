import {
  NATIVE_SKILL_CATALOG,
  nativeSkillCategory,
  nativeWeldBuild,
} from './core-kernels/player-progression.ts'

export const NATIVE_HUD_BASE_HEALTH = 50
export const NATIVE_HUD_BASE_MANA = 100
export const NATIVE_HUD_METER_INSET = 5
export const NATIVE_HUD_TRACK_PADDING = NATIVE_HUD_METER_INSET * 2

export interface NativeHudMeterPresentation {
  readonly coreWidth: number
  readonly fillProgress: number
  readonly fillWidth: number
  readonly trackWidth: number
}

export interface NativeHudHealthPresentation extends NativeHudMeterPresentation {
  readonly shieldProgress: number
  readonly shieldWidth: number
}

export interface NativeHudManaPresentation extends NativeHudMeterPresentation {
  readonly reserveProgress: number
  readonly reserveWidth: number
}

export function nativeHudLeftOriginClipPath(progress: number): string {
  return `inset(0 ${(1 - clampUnit(progress)) * 100}% 0 0)`
}

export type NativeHudSkillBinding = 12 | 16 | 20

export const NATIVE_HUD_SKILL_ACTION_HEIGHT = 65
export const NATIVE_HUD_SKILL_ACTION_TOP = -7
export const NATIVE_HUD_SKILL_ACTION_WIDTH = 40

export interface NativeHudSkillActionRect {
  readonly height: number
  readonly left: number
  readonly top: number
  readonly width: number
}

export interface NativeHudSkillBindingPresentation {
  readonly binding: NativeHudSkillBinding
  readonly centerOffset: number
  readonly record: number
  readonly skillId: number
}

export interface NativeTutorialSelectedHudLayout {
  readonly firstLine: Readonly<{ x: number; y: number }>
  readonly pointer: Readonly<{
    scale: number
    toX: number
    toY: number
    x: number
    y: number
  }>
  readonly secondLine: Readonly<{ x: number; y: number }>
}

export function nativeHudSkillActionRect(
  centerOffset: number,
  viewportWidth = 1_600,
  hudVerticalOffset = 0,
): NativeHudSkillActionRect {
  return Object.freeze({
    height: NATIVE_HUD_SKILL_ACTION_HEIGHT,
    left: viewportWidth / 2 + centerOffset - NATIVE_HUD_SKILL_ACTION_WIDTH / 2,
    top: NATIVE_HUD_SKILL_ACTION_TOP + hudVerticalOffset,
    width: NATIVE_HUD_SKILL_ACTION_WIDTH,
  })
}

export function nativeTutorialSelectedHudLayout(
  bindings: readonly NativeHudSkillBindingPresentation[],
  hudVerticalOffset = 0,
  viewportWidth = 1_600,
): NativeTutorialSelectedHudLayout | null {
  const primary = bindings.find(({ binding }) => binding === 12)
  const concentrationA = bindings.find(({ binding }) => binding === 16)
  if (!primary || !concentrationA) return null
  const primaryRect = nativeHudSkillActionRect(
    primary.centerOffset,
    viewportWidth,
    hudVerticalOffset,
  )
  const concentrationRect = nativeHudSkillActionRect(
    concentrationA.centerOffset,
    viewportWidth,
    hudVerticalOffset,
  )
  const primaryCenter = Object.freeze({
    x: primaryRect.left + primaryRect.width / 2,
    y: primaryRect.top + primaryRect.height / 2,
  })
  const concentrationCenter = Object.freeze({
    x: concentrationRect.left + concentrationRect.width / 2,
    y: concentrationRect.top + concentrationRect.height / 2,
  })
  return nativeTutorialSelectedHudLayoutFromCenters(primaryCenter, concentrationCenter)
}

export function nativeTutorialSelectedHudLayoutFromCenters(
  primaryCenter: Readonly<{ x: number; y: number }>,
  concentrationCenter: Readonly<{ x: number; y: number }>,
  scale = 1,
): NativeTutorialSelectedHudLayout {
  if (!finitePoint(primaryCenter)
    || !finitePoint(concentrationCenter)
    || !Number.isFinite(scale)
    || scale <= 0) {
    throw new RangeError('Tutorial selected-HUD centres must be finite and scale must be positive')
  }
  return Object.freeze({
    firstLine: Object.freeze({
      x: primaryCenter.x - 220 * scale,
      y: primaryCenter.y + 50 * scale,
    }),
    // Tutorial::Render stage 14 (0x005D1D36..0x005D1DE9): 0x005C9BB0 draws
    // the sprite at the first pair, primary centre + (30, 50), rotated toward
    // the second pair, the midpoint of the primary and concentration-A
    // centres; blink = 1.
    pointer: Object.freeze({
      scale,
      toX: (primaryCenter.x + concentrationCenter.x) * 0.5,
      toY: (primaryCenter.y + concentrationCenter.y) * 0.5,
      x: primaryCenter.x + 30 * scale,
      y: primaryCenter.y + 50 * scale,
    }),
    secondLine: Object.freeze({
      x: primaryCenter.x - 220 * scale,
      y: primaryCenter.y + 70 * scale,
    }),
  })
}

function finitePoint(point: Readonly<{ x: number; y: number }>): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

export function nativeHealthHudPresentation(
  currentHealth: number,
  maximumHealth: number,
  shieldCurrent = 0,
  shieldMaximum = 0,
): NativeHudHealthPresentation {
  const coreWidth = 2 * (
    NATIVE_HUD_BASE_HEALTH
    + 0.25 * (maximumHealth - NATIVE_HUD_BASE_HEALTH)
  )
  const fillProgress = clampUnit(currentHealth / maximumHealth) ** 2
  const shieldProgress = shieldMaximum > 0
    ? clampUnit(shieldCurrent / shieldMaximum)
    : 0
  return Object.freeze({
    coreWidth,
    fillProgress,
    fillWidth: coreWidth * fillProgress,
    shieldProgress,
    shieldWidth: coreWidth * shieldProgress,
    trackWidth: coreWidth + NATIVE_HUD_TRACK_PADDING,
  })
}

export function nativeManaHudPresentation(
  currentMana: number,
  maximumMana: number,
  reservedMana = 0,
): NativeHudManaPresentation {
  const coreWidth = (
    NATIVE_HUD_BASE_MANA
    + 0.25 * (maximumMana - NATIVE_HUD_BASE_MANA)
  )
  const fillProgress = clampUnit(currentMana / maximumMana)
  const reserveProgress = clampUnit(reservedMana / maximumMana)
  return Object.freeze({
    coreWidth,
    fillProgress,
    fillWidth: coreWidth * fillProgress,
    reserveProgress,
    reserveWidth: coreWidth * reserveProgress,
    trackWidth: coreWidth + NATIVE_HUD_TRACK_PADDING,
  })
}

export function nativeHudSkillBindings({
  concentrationSkillIds,
  planewalkerActive,
  selectedPrimarySkillId,
  weldBuildId,
}: {
  readonly concentrationSkillIds: readonly [number | null, number | null]
  readonly planewalkerActive: boolean
  readonly selectedPrimarySkillId: number
  readonly weldBuildId: number | null
}): readonly NativeHudSkillBindingPresentation[] {
  const activePrimarySkillId = planewalkerActive ? 80 : selectedPrimarySkillId
  const primary = Object.freeze({
    binding: 12 as const,
    centerOffset: 0,
    record: primaryHudRecord(activePrimarySkillId, weldBuildId),
    skillId: activePrimarySkillId,
  })
  const concentrationA = concentrationBinding(16, concentrationSkillIds[0])
  const concentrationB = concentrationBinding(20, concentrationSkillIds[1])
  const visualOrder = [
    primary,
    ...(concentrationB === null ? [] : [concentrationB]),
    ...(concentrationA === null ? [] : [concentrationA]),
  ]
  const firstOffset = -20 * (visualOrder.length - 1)
  const offsets = new Map(visualOrder.map((binding, index) => (
    [binding.binding, firstOffset + index * 40] as const
  )))
  return Object.freeze([
    Object.freeze({ ...primary, centerOffset: offsets.get(12)! }),
    ...(concentrationA === null
      ? []
      : [Object.freeze({ ...concentrationA, centerOffset: offsets.get(16)! })]),
    ...(concentrationB === null
      ? []
      : [Object.freeze({ ...concentrationB, centerOffset: offsets.get(20)! })]),
  ])
}

function primaryHudRecord(skillId: number, weldBuildId: number | null): number {
  if (skillId === 52 && weldBuildId !== null) {
    const build = nativeWeldBuild(weldBuildId)
    if (build !== null) return build.skillsAtlasIconRecord
  }
  return skillRecord(skillId)
}

function concentrationBinding(
  binding: 16 | 20,
  skillId: number | null,
): NativeHudSkillBindingPresentation | null {
  if (skillId === null || nativeSkillCategory(skillId) !== 3) return null
  return Object.freeze({
    binding,
    centerOffset: 0,
    record: skillRecord(skillId),
    skillId,
  })
}

function skillRecord(skillId: number): number {
  const record = NATIVE_SKILL_CATALOG[skillId]?.skills_atlas_icon_record
  if (record === undefined) throw new RangeError(`native HUD skill ${skillId} has no icon`)
  return record
}

function clampUnit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

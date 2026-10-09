import { nativeSkillColorRoot } from './player-progression.ts'
import { nativeDesaturateColor } from './native-color.ts'

/** Skills_Wizard::GetColor, 0x00661260; complete root table at 0x0081CCA8. */
export const NATIVE_SKILL_ROOT_COLORS = [
  [1, 0.1, 1], [1, 0.35, 0.1], [0.1, 1, 1], [0.1, 0.5, 1],
  [0.1, 1, 0.1], [1, 0.5, 0.1], [0.1, 0.5, 0.5], [0.75, 0.75, 0.75],
] as const

const WELD_COLORS = [
  [1, 0.1, 0.5], [1, 0.5, 1], [1, 0.75, 1], [1, 0.75, 0.5],
  [1, 0.75, 1], [0.75, 0.75, 0.75], [1, 0.75, 1], [1, 0.75, 0.5],
  [0.8, 1, 1], [0.9, 1, 1], [1, 0.1, 0.5], [1, 0.35, 0.1],
  [0.1, 0.5, 1], [0.1, 1, 1], [0.1, 1, 0.1],
] as const

function nativeSkillBaseColor(skillId: number, weldBuildId: number | null): readonly [number, number, number] | undefined {
  const root = nativeSkillColorRoot(skillId)
  const weldColor = skillId === 52 && weldBuildId !== null
    ? WELD_COLORS[weldBuildId - 1000]
    : undefined
  return weldColor ?? (root === null ? undefined : NATIVE_SKILL_ROOT_COLORS[root])
}

export function nativePrimarySpellTint(skillId: number, weldBuildId: number | null): number {
  const color = nativeSkillBaseColor(skillId, weldBuildId)
  if (color === undefined) return 0xffffff
  const channel = (value: number) => Math.trunc(Math.fround(value) * 255)
  return channel(color[0]) * 0x10000 + channel(color[1]) * 0x100 + channel(color[2])
}

/** Arena +0x110 uses Skills_Wizard +0x88, then S20/D25 before packing RGB. */
export function nativePlayerGroundLightTint(skillId: number, weldBuildId: number | null): number {
  if (!Number.isInteger(skillId) || skillId < 0) {
    throw new RangeError('Ground light color requires a resolved nonnegative primary selector')
  }
  const base = nativeSkillBaseColor(skillId, weldBuildId) ?? NATIVE_SKILL_ROOT_COLORS[0]
  const descriptor = nativeDesaturateColor([
    Math.fround(base[0]), Math.fround(base[1]), Math.fround(base[2]), 1,
  ], Math.fround(.85))
  const light = nativeDesaturateColor(descriptor, Math.fround(.2))
  const channel = (value: number) => Math.trunc(Math.fround(value * .75) * 255)
  return channel(light[0]) * 0x10000 + channel(light[1]) * 0x100 + channel(light[2])
}

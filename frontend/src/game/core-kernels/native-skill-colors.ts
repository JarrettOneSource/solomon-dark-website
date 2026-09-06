import { nativeSkillColorRoot } from './player-progression.ts'

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

export function nativePrimarySpellTint(skillId: number, weldBuildId: number | null): number {
  const root = nativeSkillColorRoot(skillId)
  const weldColor = skillId === 52 && weldBuildId !== null
    ? WELD_COLORS[weldBuildId - 1000]
    : undefined
  const color = weldColor ?? (root === null ? undefined : NATIVE_SKILL_ROOT_COLORS[root])
  if (color === undefined) return 0xffffff
  const channel = (value: number) => Math.trunc(Math.fround(value) * 255)
  return channel(color[0]) * 0x10000 + channel(color[1]) * 0x100 + channel(color[2])
}

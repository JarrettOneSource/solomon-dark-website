import type { PlayerCharacterInput } from '../core-kernels/player-character.ts'
import { nativeSkillCategory } from '../core-kernels/player-progression.ts'

export function sealPlayerCombatInput(
  input: PlayerCharacterInput,
  quickbar: readonly (number | null)[],
): PlayerCharacterInput {
  const requestedSlot = input.cast.quickbar
  const selectedSkill = requestedSlot === null ? null : quickbar[requestedSlot] ?? null
  const selectedCategory = selectedSkill === null ? null : nativeSkillCategory(selectedSkill)
  const safeSlot = selectedCategory === 1 || selectedCategory === 3
    ? requestedSlot
    : null
  if (!input.cast.primary && input.cast.quickbar === safeSlot && input.aim === null) return input
  return {
    ...input,
    aim: null,
    cast: { primary: false, quickbar: safeSlot },
  }
}

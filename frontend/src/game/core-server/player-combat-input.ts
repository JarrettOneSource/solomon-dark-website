import type { PlayerCharacterInput } from '../core-kernels/player-character.ts'
import { nativeSkillCategory } from '../core-kernels/player-progression.ts'

export function sealPlayerCombatInput(
  input: PlayerCharacterInput,
  quickbar: readonly (number | null)[],
): PlayerCharacterInput {
  const requestedSlot = input.cast.quickbar
  const selectedSkill = requestedSlot === null ? null : quickbar[requestedSlot] ?? null
  const safeSlot = selectedSkill !== null && nativeSkillCategory(selectedSkill) === 1
    ? requestedSlot
    : null
  if (!input.cast.primary && input.cast.quickbar === safeSlot && input.aim === null) return input
  return {
    aim: null,
    cast: { primary: false, quickbar: safeSlot },
    movement: input.movement,
  }
}

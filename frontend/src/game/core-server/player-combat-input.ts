import type { PlayerCharacterInput } from '../core-kernels/player-character.ts'
import type { PlayerBeltComponent } from '../core-kernels/native-belt.ts'
import { nativeSkillCategory } from '../core-kernels/player-progression.ts'

export function sealPlayerCombatInput(
  input: PlayerCharacterInput,
  belt: PlayerBeltComponent,
): PlayerCharacterInput {
  const requestedSlot = input.cast.quickbar
  const entry = requestedSlot === null ? null : belt[requestedSlot] ?? null
  const selectedSkill = entry?.kind === 'skill' ? entry.skillId : null
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

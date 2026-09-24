import type { HubActionFeedback, NativeSkillBookOutcome } from './core-kernels/hub-economy.ts'
import { NATIVE_SKILL_CATALOG } from './core-kernels/player-progression.ts'
import { layoutNativeUiSingleActionMessage } from './native-ui/core.ts'

/** A new connection starts after its retained receipt; restored results never replay. */
export class NativeSkillBookFeedbackCursor {
  private sequence: number

  constructor(initial: HubActionFeedback | null) {
    this.sequence = initial?.sequence ?? 0
  }

  consume(feedback: HubActionFeedback | null): Readonly<{
    sequence: number
    outcome: NativeSkillBookOutcome
  }> | null {
    if (feedback === null || feedback.sequence <= this.sequence) return null
    this.sequence = feedback.sequence
    return feedback.accepted && feedback.action === 'read-skill-book' && feedback.skillBookOutcome !== null
      ? { sequence: feedback.sequence, outcome: feedback.skillBookOutcome }
      : null
  }
}

export function nativeSkillBookResultText(skillId: number): string {
  const skill = NATIVE_SKILL_CATALOG[skillId]
  if (!Number.isInteger(skillId) || skillId < 8 || skillId > 81 || !skill) {
    throw new RangeError('Book result must name a native rank-award skill')
  }
  return `${skill.name} +1`
}

/** 0x0056D570..0x0056D7A0: two authored DataLines and the screen-centered MsgBox. */
export function nativeSkillBookResultLayout(skillId: number) {
  return layoutNativeUiSingleActionMessage({
    anchorX: 800, anchorY: 450, width: 1600, height: 900,
    lines: [
      { font: 'menu', text: 'Skill improved', tint: 0xb2b2ff, gapAfter: 10 },
      { font: 'medium', text: nativeSkillBookResultText(skillId), tint: 0xb2b2ff },
    ],
  })
}

export function nativeSkillBookWorldMessage(sequence: number, skillId: number, tick: number) {
  // Negative presentation IDs cannot collide with positive replicated Loot event IDs.
  return { eventId: -sequence, tick, text: nativeSkillBookResultText(skillId), tint: 0x8080ff }
}

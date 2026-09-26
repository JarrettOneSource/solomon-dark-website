import {
  nativePlayerBeltsEqual,
  type PlayerBeltComponent,
} from './core-kernels/native-belt.ts'
import type { WizardElement } from './core-kernels/player-character.ts'
import type {
  GameSnapshot,
  ProtocolPlayerEconomy,
  ProtocolPlayerProgression,
} from './protocol/game-state.ts'

export interface SkillBookModel {
  readonly belt: PlayerBeltComponent
  readonly economy: ProtocolPlayerEconomy
  readonly element: WizardElement
  readonly progression: ProtocolPlayerProgression
}

interface SkillBookModelSource {
  getSnapshot(): Pick<GameSnapshot, 'players'>
  onSnapshot(listener: () => void): () => void
}

/**
 * Actor-owned read-only projection for useSyncExternalStore. Read the current
 * session at mount and during its render/subscription consistency checks, not
 * the intentionally coarse scene snapshot or only the next network event.
 */
export function createSkillBookModelStore(source: SkillBookModelSource, playerId: string) {
  let current: SkillBookModel | null = null
  return {
    subscribe: (listener: () => void) => source.onSnapshot(listener),
    getSnapshot(): SkillBookModel | null {
      const player = source.getSnapshot().players[playerId]
      if (!player) {
        current = null
        return null
      }
      if (current
        && nativePlayerBeltsEqual(current.belt, player.belt)
        && current.economy.revision === player.economy.revision
        && current.element === player.config.element
        && sameSkillBookProgression(current.progression, player.progression)) return current
      current = {
        belt: player.belt,
        economy: player.economy,
        element: player.config.element,
        progression: player.progression,
      }
      return current
    },
  }
}

// Revision owns learned rows/ranks/order. Selection, the concentration lock and
// XP rail also have live values. Unrelated movement/combat ticks must not rebuild
// the SkillScreen's retained GPU nodes at the network snapshot rate.
function sameSkillBookProgression(
  current: ProtocolPlayerProgression,
  next: ProtocolPlayerProgression,
): boolean {
  return current.revision === next.revision
    && current.selectedPrimarySkillId === next.selectedPrimarySkillId
    && current.weldBuildId === next.weldBuildId
    && current.mindChugTicksRemaining === next.mindChugTicksRemaining
    && current.splitMind === next.splitMind
    && current.experience === next.experience
    && current.previousThreshold === next.previousThreshold
    && current.nextThreshold === next.nextThreshold
    && current.concentrationSkillIds.every((skillId, index) => (
      skillId === next.concentrationSkillIds[index]
    ))
}

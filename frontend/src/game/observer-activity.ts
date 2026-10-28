import { NATIVE_SKILL_CATALOG } from './core-kernels/player-progression.ts'
import type { GameSnapshot, ProtocolPlayerSkillOffer } from './protocol/game-state.ts'

export interface ObserverSkillEvent {
  readonly detail: string
  readonly id: string
  readonly playerName: string
  readonly title: string
}

export interface ObserverSkillOfferPresentation {
  readonly id: string
  readonly options: readonly string[]
  readonly playerName: string
  readonly title: string
}

export function observerSkillOffers(
  snapshot: GameSnapshot,
): readonly ObserverSkillOfferPresentation[] {
  return Object.entries(snapshot.players).flatMap(([playerId, player]) => {
    const offer = player.progression.pendingOffer
    return offer ? [{
      id: `${playerId}:${offer.sequence}`,
      options: offer.options.map(optionName),
      playerName: player.config.displayName,
      title: `LEVEL ${offer.level} CHOICE`,
    }] : []
  })
}

export function deriveObserverSkillEvents(
  previous: GameSnapshot,
  current: GameSnapshot,
): readonly ObserverSkillEvent[] {
  const events: ObserverSkillEvent[] = []
  for (const [playerId, player] of Object.entries(current.players)) {
    const before = previous.players[playerId]
    if (!before) continue
    const previousOffer = before.progression.pendingOffer
    const currentOffer = player.progression.pendingOffer
    if (
      previousOffer
      && previousOffer.sequence !== currentOffer?.sequence
    ) {
      const increased = increasedOfferedSkill(previousOffer, before, player)
      const saved = player.progression.deferredSkillChoices
        > before.progression.deferredSkillChoices
      events.push({
        detail: increased
          ? `${skillName(increased.skillId)} reached rank ${increased.rank}.`
          : saved
            ? 'The choice was saved for later.'
            : currentOffer
              ? 'The offered choices were rerolled.'
              : 'The choice closed without a learned-rank change.',
        id: `${current.tick}:${playerId}:${previousOffer.sequence}:resolved`,
        playerName: player.config.displayName,
        title: increased ? 'SKILL SELECTED' : saved ? 'SKILL SAVED' : 'SKILL CHOICE UPDATED',
      })
    }
    if (currentOffer && previousOffer?.sequence !== currentOffer.sequence) {
      events.push({
        detail: currentOffer.options.map(optionName).join(' · '),
        id: `${current.tick}:${playerId}:${currentOffer.sequence}:offered`,
        playerName: player.config.displayName,
        title: `LEVEL ${currentOffer.level} CHOICES`,
      })
    }
  }
  return events
}

function increasedOfferedSkill(
  offer: ProtocolPlayerSkillOffer,
  previous: GameSnapshot['players'][string],
  current: GameSnapshot['players'][string],
): { rank: number; skillId: number } | null {
  const previousRanks = new Map(previous.progression.learnedSkills.map(
    ([skillId, rank]) => [skillId, rank],
  ))
  const currentRanks = new Map(current.progression.learnedSkills.map(
    ([skillId, rank]) => [skillId, rank],
  ))
  for (const option of offer.options) {
    const before = previousRanks.get(option.skillId) ?? 0
    const after = currentRanks.get(option.skillId) ?? 0
    if (after > before) return { rank: after, skillId: option.skillId }
  }
  return null
}

function optionName(option: ProtocolPlayerSkillOffer['options'][number]): string {
  const name = skillName(option.skillId)
  return option.targetRank > 1 ? `${name} ${option.targetRank}` : name
}

function skillName(skillId: number): string {
  return NATIVE_SKILL_CATALOG[skillId]?.name ?? `Skill ${skillId}`
}

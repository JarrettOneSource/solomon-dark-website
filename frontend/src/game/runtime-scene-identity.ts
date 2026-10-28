import type { GameClientSnapshot } from './protocol/game-state.ts'

export function sameRuntimeScene(
  current: GameClientSnapshot | null,
  next: GameClientSnapshot,
  playerId: string,
): boolean {
  if (
    !current
    || current.hostPlayerId !== next.hostPlayerId
    || current.enhancedEffects !== next.enhancedEffects
    || current.materializingPlayerIds.includes(playerId) !== next.materializingPlayerIds.includes(playerId)
    || !sameLevelUpBarrier(current.levelUpBarrier, next.levelUpBarrier)
    || current.run.phase !== next.run.phase
    || current.world.kind !== next.world.kind
  ) return false
  if (current.world.kind === 'boneyard' && next.world.kind === 'boneyard') {
    return current.world.runId === next.world.runId
  }
  if (current.world.kind !== 'hub' || next.world.kind !== 'hub') return false
  const currentCollegeLoadout = current.world.participants[playerId]?.transition?.phase
    === 'college-loadout'
  const nextCollegeLoadout = next.world.participants[playerId]?.transition?.phase
    === 'college-loadout'
  return currentCollegeLoadout === nextCollegeLoadout
}

function sameLevelUpBarrier(
  first: GameClientSnapshot['levelUpBarrier'],
  second: GameClientSnapshot['levelUpBarrier'],
): boolean {
  if (first === null || second === null) return first === second
  return first.barrierId === second.barrierId
    && first.milestoneExperience === second.milestoneExperience
    && first.milestoneLevel === second.milestoneLevel
    && first.runId === second.runId
    && first.sourcePlayerId === second.sourcePlayerId
    && first.participantIds.length === second.participantIds.length
    && first.participantIds.every((playerId, index) => (
      playerId === second.participantIds[index]
    ))
    && first.pendingPlayerIds.length === second.pendingPlayerIds.length
    && first.pendingPlayerIds.every((playerId, index) => (
      playerId === second.pendingPlayerIds[index]
    ))
}

import type { HallOfFameEntry } from './core-kernels/hall-of-fame.ts'
import type {
  GameSnapshot,
  NativeHallOfFameRunSnapshot,
  ProtocolPlayerState,
} from './protocol/game-state.ts'

export function completedHallOfFameEntry(
  snapshot: GameSnapshot,
  playerId: string,
  accountUsername: string | null,
  completedAtUtc: string,
): HallOfFameEntry | null {
  if (snapshot.world.kind !== 'boneyard' || snapshot.run.phase !== 'game-over') return null
  const player = snapshot.players[playerId]
  const run = snapshot.world.hallOfFameRuns[playerId]
  if (!player || !run || run.elapsedTicks === null
    || run.portraitHeadingIndex === null || run.portraitScale === null) return null
  return completedEntry(
    snapshot.world.runId,
    run,
    player,
    snapshot.world.waves?.waveOrdinal ?? 0,
    accountUsername,
    completedAtUtc,
  )
}

function completedEntry(
  runId: string,
  run: NativeHallOfFameRunSnapshot,
  player: ProtocolPlayerState,
  wave: number,
  accountUsername: string | null,
  completedAtUtc: string,
): HallOfFameEntry {
  const permanentRanks = new Map(player.progression.learnedSkills.map(
    ([skillId, permanentRank]) => [skillId, permanentRank],
  ))
  const highestSkills = player.progression.learnedSkillOrder
    .map((skillId, learnedIndex) => ({
      learnedIndex,
      rank: permanentRanks.get(skillId) ?? 0,
      skillId,
    }))
    .filter(({ rank }) => rank > 0)
    .sort((left, right) => right.rank - left.rank || left.learnedIndex - right.learnedIndex)
    .slice(0, 3)
    .map(({ rank, skillId }) => ({ rank, skillId }))
  return {
    accountUsername,
    awesomeness: run.awesomeness,
    awesomestKill: run.awesomestKill,
    completedAtUtc,
    discipline: player.config.discipline,
    elapsedTicks: run.elapsedTicks!,
    element: player.config.element,
    headingIndex: run.portraitHeadingIndex!,
    highestSkills,
    level: player.progression.level,
    monstersKilled: run.monstersKilled,
    perksUsed: player.economy.ownedPerkSelectors.slice(0, 9),
    portraitScale: run.portraitScale!,
    runId,
    wave,
    wizardName: player.config.displayName,
  }
}

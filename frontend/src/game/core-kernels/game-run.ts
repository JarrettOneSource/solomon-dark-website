export const GAME_OVER_ENTRY_FADE_TICKS = 40
export const GAME_OVER_INPUT_ACCEPT_TICK = 500
export const GAME_OVER_INPUT_EXIT_FADE_TICKS = 20
export const GAME_OVER_AUTOMATIC_ACCEPT_TICK = 951
export const GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS = 250

export const GAME_OVER_EXIT_KINDS = ['automatic', 'input'] as const

export type GameOverExitKind = typeof GAME_OVER_EXIT_KINDS[number]

export const GAME_RUN_PHASES = [
  'hub',
  'active',
  'game-over',
  'loadout',
] as const

export type GameRunPhase = typeof GAME_RUN_PHASES[number]

export interface GameRunLifecycleState {
  readonly eligiblePlayerIds: readonly string[]
  readonly gameOverEventId: number
  readonly gameOverExitKind: GameOverExitKind | null
  readonly gameOverExitTicks: number | null
  readonly gameOverTicks: number
  readonly lastCompletedRunId: string | null
  readonly loadoutReadyPlayerIds: readonly string[]
  readonly nextGameOverEventId: number
  readonly phase: GameRunPhase
  readonly runId: string | null
}

export function createGameRunLifecycle(): GameRunLifecycleState {
  return {
    eligiblePlayerIds: Object.freeze([]),
    gameOverEventId: 0,
    gameOverExitKind: null,
    gameOverExitTicks: null,
    gameOverTicks: 0,
    lastCompletedRunId: null,
    loadoutReadyPlayerIds: Object.freeze([]),
    nextGameOverEventId: 1,
    phase: 'hub',
    runId: null,
  }
}

export function startGameRun(
  source: GameRunLifecycleState,
  runId: string,
  playerIds: readonly string[],
): GameRunLifecycleState {
  if (!runId) throw new Error('game run id must not be empty')
  if (source.phase !== 'hub') {
    throw new Error(`cannot start a game run while session phase is ${source.phase}`)
  }
  return {
    ...source,
    eligiblePlayerIds: stablePlayerIds(playerIds),
    gameOverEventId: 0,
    gameOverExitKind: null,
    gameOverExitTicks: null,
    gameOverTicks: 0,
    loadoutReadyPlayerIds: Object.freeze([]),
    phase: 'active',
    runId,
  }
}

export function synchronizeGameRunParticipants(
  source: GameRunLifecycleState,
  playerIds: readonly string[],
): GameRunLifecycleState {
  if (
    source.phase !== 'active'
    && source.phase !== 'game-over'
    && source.phase !== 'loadout'
  ) return source
  const eligiblePlayerIds = stablePlayerIds(playerIds)
  const eligible = new Set(eligiblePlayerIds)
  const loadoutReadyPlayerIds = source.loadoutReadyPlayerIds.filter((playerId) => (
    eligible.has(playerId)
  ))
  if (
    source.phase === 'loadout'
    && eligiblePlayerIds.length > 0
    && loadoutReadyPlayerIds.length === eligiblePlayerIds.length
  ) return completePostRunLoadout(source)
  return sameStrings(source.eligiblePlayerIds, eligiblePlayerIds)
    && sameStrings(source.loadoutReadyPlayerIds, loadoutReadyPlayerIds)
    ? source
    : { ...source, eligiblePlayerIds, loadoutReadyPlayerIds }
}

export function stepGameRunLifecycle(
  source: GameRunLifecycleState,
  alivePlayerIds: ReadonlySet<string>,
): GameRunLifecycleState {
  if (source.phase === 'game-over') {
    if (source.gameOverExitTicks === null) {
      const gameOverTicks = source.gameOverTicks + 1
      return {
        ...source,
        gameOverExitKind: gameOverTicks === GAME_OVER_AUTOMATIC_ACCEPT_TICK
          ? 'automatic'
          : null,
        gameOverExitTicks: gameOverTicks === GAME_OVER_AUTOMATIC_ACCEPT_TICK
          ? 1
          : null,
        gameOverTicks,
      }
    }
    const exitDuration = gameOverExitDurationTicks(source.gameOverExitKind)
    if (source.gameOverExitTicks < exitDuration) {
      return {
        ...source,
        gameOverExitTicks: source.gameOverExitTicks + 1,
        gameOverTicks: source.gameOverTicks + 1,
      }
    }
    return {
      ...source,
      gameOverExitKind: null,
      gameOverExitTicks: null,
      gameOverTicks: 0,
      lastCompletedRunId: source.runId,
      loadoutReadyPlayerIds: Object.freeze([]),
      phase: 'loadout',
      runId: null,
    }
  }
  if (source.phase !== 'active' || source.eligiblePlayerIds.length === 0) return source
  if (source.eligiblePlayerIds.some((playerId) => alivePlayerIds.has(playerId))) return source
  return {
    ...source,
    gameOverEventId: source.nextGameOverEventId,
    gameOverExitKind: null,
    gameOverExitTicks: null,
    gameOverTicks: 0,
    loadoutReadyPlayerIds: Object.freeze([]),
    nextGameOverEventId: source.nextGameOverEventId + 1,
    phase: 'game-over',
  }
}

export function continueGameOver(
  source: GameRunLifecycleState,
  runId: string,
  eventId: number,
): GameRunLifecycleState | null {
  if (
    source.phase !== 'game-over'
    || source.gameOverExitTicks !== null
    || source.gameOverTicks < GAME_OVER_INPUT_ACCEPT_TICK
    || source.runId !== runId
    || source.gameOverEventId !== eventId
  ) return null
  return {
    ...source,
    gameOverExitKind: 'input',
    gameOverExitTicks: 1,
  }
}

export function confirmPostRunLoadout(
  source: GameRunLifecycleState,
  playerId: string,
): GameRunLifecycleState | null {
  if (
    source.phase !== 'loadout'
    || !source.eligiblePlayerIds.includes(playerId)
    || source.loadoutReadyPlayerIds.includes(playerId)
  ) return null
  const loadoutReadyPlayerIds = stablePlayerIds([
    ...source.loadoutReadyPlayerIds,
    playerId,
  ])
  return loadoutReadyPlayerIds.length === source.eligiblePlayerIds.length
    ? completePostRunLoadout(source)
    : { ...source, loadoutReadyPlayerIds }
}

export function gameOverExitDurationTicks(kind: GameOverExitKind | null): number {
  if (kind === 'input') return GAME_OVER_INPUT_EXIT_FADE_TICKS
  if (kind === 'automatic') return GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS
  throw new Error('Game Over exit ticks require an exit kind')
}

function completePostRunLoadout(source: GameRunLifecycleState): GameRunLifecycleState {
  return {
    ...source,
    eligiblePlayerIds: Object.freeze([]),
    gameOverEventId: 0,
    loadoutReadyPlayerIds: Object.freeze([]),
    phase: 'hub',
  }
}

function stablePlayerIds(playerIds: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(playerIds)].sort())
}

function sameStrings(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length
    && first.every((value, index) => value === second[index])
}

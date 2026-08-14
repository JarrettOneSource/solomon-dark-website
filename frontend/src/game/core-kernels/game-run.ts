export const BONEYARD_GAME_OVER_INPUT_GATE_TICKS = 1_000

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
  readonly gameOverTicks: number
  readonly lastCompletedRunId: string | null
  readonly nextGameOverEventId: number
  readonly phase: GameRunPhase
  readonly runId: string | null
}

export function createGameRunLifecycle(): GameRunLifecycleState {
  return {
    eligiblePlayerIds: Object.freeze([]),
    gameOverEventId: 0,
    gameOverTicks: 0,
    lastCompletedRunId: null,
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
    gameOverTicks: 0,
    phase: 'active',
    runId,
  }
}

export function synchronizeGameRunParticipants(
  source: GameRunLifecycleState,
  playerIds: readonly string[],
): GameRunLifecycleState {
  if (source.phase !== 'active') return source
  const eligiblePlayerIds = stablePlayerIds(playerIds)
  return sameStrings(source.eligiblePlayerIds, eligiblePlayerIds)
    ? source
    : { ...source, eligiblePlayerIds }
}

export function stepGameRunLifecycle(
  source: GameRunLifecycleState,
  alivePlayerIds: ReadonlySet<string>,
): GameRunLifecycleState {
  if (source.phase === 'game-over') {
    return { ...source, gameOverTicks: source.gameOverTicks + 1 }
  }
  if (source.phase !== 'active' || source.eligiblePlayerIds.length === 0) return source
  if (source.eligiblePlayerIds.some((playerId) => alivePlayerIds.has(playerId))) return source
  return {
    ...source,
    gameOverEventId: source.nextGameOverEventId,
    gameOverTicks: 0,
    nextGameOverEventId: source.nextGameOverEventId + 1,
    phase: 'game-over',
  }
}

export function gameOverAcceptsInput(source: GameRunLifecycleState): boolean {
  return source.phase === 'game-over'
    && source.gameOverTicks >= BONEYARD_GAME_OVER_INPUT_GATE_TICKS
}

export function acknowledgeGameOver(
  source: GameRunLifecycleState,
  runId: string,
  eventId: number,
): GameRunLifecycleState | null {
  if (
    !gameOverAcceptsInput(source)
    || source.runId !== runId
    || source.gameOverEventId !== eventId
  ) return null
  return {
    ...source,
    eligiblePlayerIds: Object.freeze([]),
    gameOverTicks: 0,
    lastCompletedRunId: source.runId,
    phase: 'loadout',
    runId: null,
  }
}

export function confirmPostRunLoadout(
  source: GameRunLifecycleState,
): GameRunLifecycleState | null {
  if (source.phase !== 'loadout') return null
  return {
    ...source,
    gameOverEventId: 0,
    lastCompletedRunId: source.lastCompletedRunId,
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

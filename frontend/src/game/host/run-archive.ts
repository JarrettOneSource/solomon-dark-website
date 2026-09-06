import { randomUUID } from 'node:crypto'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import type { BoneyardEnemySpawnIntent } from '../core-kernels/boneyard-wave-director.ts'
import type { GameSimulationState, PlayerCharacterInputs } from '../core-server/game-simulation.ts'
import { GAME_PROTOCOL_VERSION, type GameContentManifest } from '../protocol/game-protocol-contract.ts'

type RunArchiveEndReason = 'game-over' | 'world-ended' | 'host-closed' | 'server-error'

interface RunArchiveCheckpoint {
  readonly state: GameSimulationState
  readonly inputs: PlayerCharacterInputs
  readonly enemySpawnIntents: readonly BoneyardEnemySpawnIntent[]
  readonly tickMs: number
}

interface RunArchivePerformanceWindow {
  readonly tick: number
  readonly tickCount: number
  readonly meanTickMs: number
  readonly maximumTickMs: number
  readonly maximumBehindMs: number
  readonly overBudgetTicks: number
}

export interface RunArchive {
  readonly schemaVersion: 1
  readonly id: string
  readonly runId: string
  readonly sessionId: string
  readonly revision: string
  readonly protocolVersion: number
  readonly nodeVersion: string
  readonly startedAtUtc: string
  readonly endedAtUtc: string
  readonly endReason: RunArchiveEndReason
  readonly content: GameContentManifest
  readonly loadedBoneyard: LoadedBoneyard
  readonly lastAlive: RunArchiveCheckpoint | null
  readonly lastAliveByPlayer: ReadonlyMap<string, RunArchiveCheckpoint>
  readonly worstTick: RunArchiveCheckpoint
  readonly finalState: GameSimulationState
  readonly performance: {
    readonly tickCount: number
    readonly overBudgetTicks: number
    readonly totalTickMs: number
    readonly recent: readonly RunArchivePerformanceWindow[]
  }
}

interface RunArchiveRecorderOptions {
  readonly content: GameContentManifest
  readonly revision: string
  readonly sessionId: string
  readonly write: (archive: RunArchive) => void
  readonly now?: () => Date
}

export interface RunArchiveObservation {
  readonly before: GameSimulationState
  readonly after: GameSimulationState
  readonly inputs: PlayerCharacterInputs
  readonly loadedBoneyard: LoadedBoneyard
  readonly enemySpawnIntents?: readonly BoneyardEnemySpawnIntent[]
  readonly tickMs: number
  readonly behindMs: number
}

interface ActiveRun {
  readonly loadedBoneyard: LoadedBoneyard
  readonly startedAtUtc: string
  lastAlive: RunArchiveCheckpoint | null
  readonly lastAliveByPlayer: Map<string, RunArchiveCheckpoint>
  worstTick: RunArchiveCheckpoint
  finalState: GameSimulationState
  tickCount: number
  overBudgetTicks: number
  totalTickMs: number
  recent: RunArchivePerformanceWindow[]
}

/** Retains immutable simulation states; serialization and I/O belong to the store. */
export class RunArchiveRecorder {
  private readonly runs = new Map<string, ActiveRun>()
  private readonly options: RunArchiveRecorderOptions
  private readonly now: () => Date

  constructor(options: RunArchiveRecorderOptions) {
    this.options = options
    this.now = options.now ?? (() => new Date())
  }

  checkpoint(state: GameSimulationState, loadedBoneyard: LoadedBoneyard): void {
    if (state.run.phase !== 'active') return
    const run = this.activeRun(state, loadedBoneyard)
    run.finalState = state
    this.rememberLiving(run, {
      state, inputs: run.lastAlive?.inputs ?? {}, enemySpawnIntents: [], tickMs: 0,
    })
  }

  private activeRun(state: GameSimulationState, loadedBoneyard: LoadedBoneyard): ActiveRun {
    const existing = this.runs.get(loadedBoneyard.runId)
    if (existing) return existing
    const checkpoint: RunArchiveCheckpoint = {
      state, inputs: {}, enemySpawnIntents: [], tickMs: 0,
    }
    const run: ActiveRun = {
      loadedBoneyard,
      startedAtUtc: this.now().toISOString(),
      lastAlive: null,
      lastAliveByPlayer: new Map(),
      worstTick: checkpoint,
      finalState: state,
      tickCount: 0,
      overBudgetTicks: 0,
      totalTickMs: 0,
      recent: [],
    }
    this.runs.set(loadedBoneyard.runId, run)
    return run
  }

  observe(observation: RunArchiveObservation): void {
    const { before, after, loadedBoneyard, tickMs, behindMs } = observation
    if (before.run.phase !== 'active') return
    const checkpoint: RunArchiveCheckpoint = {
      state: before,
      inputs: observation.inputs,
      enemySpawnIntents: observation.enemySpawnIntents ?? [],
      tickMs,
    }
    const run = this.activeRun(before, loadedBoneyard)
    this.rememberLiving(run, checkpoint)
    this.rememberLiving(run, { ...checkpoint, state: after })
    if (tickMs > run.worstTick.tickMs) run.worstTick = checkpoint
    run.finalState = after
    run.tickCount += 1
    run.totalTickMs += tickMs
    run.overBudgetTicks += Number(tickMs > 10)
    let window = run.recent.at(-1)
    if (!window || window.tickCount === 100) {
      window = {
        tick: before.tick, tickCount: 0, meanTickMs: 0, maximumTickMs: 0,
        maximumBehindMs: 0, overBudgetTicks: 0,
      }
      run.recent.push(window)
      if (run.recent.length > 60) run.recent.shift()
    }
    const count = window.tickCount + 1
    run.recent[run.recent.length - 1] = {
      ...window,
      tick: after.tick,
      tickCount: count,
      meanTickMs: (window.meanTickMs * (count - 1) + tickMs) / count,
      maximumTickMs: Math.max(window.maximumTickMs, tickMs),
      maximumBehindMs: Math.max(window.maximumBehindMs, behindMs),
      overBudgetTicks: window.overBudgetTicks + Number(tickMs > 10),
    }
    if (after.run.phase === 'game-over') this.finish(loadedBoneyard.runId, 'game-over')
    else if (after.world.kind !== 'boneyard') this.finish(loadedBoneyard.runId, 'world-ended')
  }

  retain(activeRunIds: ReadonlySet<string>): void {
    for (const runId of this.runs.keys()) {
      if (!activeRunIds.has(runId)) this.finish(runId, 'world-ended')
    }
  }

  close(reason: RunArchiveEndReason = 'host-closed'): void {
    for (const runId of this.runs.keys()) this.finish(runId, reason)
  }

  private finish(runId: string, endReason: RunArchiveEndReason): void {
    const run = this.runs.get(runId)!
    this.runs.delete(runId)
    this.options.write({
      schemaVersion: 1,
      id: randomUUID(),
      runId,
      sessionId: this.options.sessionId,
      revision: this.options.revision,
      protocolVersion: GAME_PROTOCOL_VERSION,
      nodeVersion: process.version,
      startedAtUtc: run.startedAtUtc,
      endedAtUtc: this.now().toISOString(),
      endReason,
      content: this.options.content,
      loadedBoneyard: run.loadedBoneyard,
      lastAlive: run.lastAlive,
      lastAliveByPlayer: run.lastAliveByPlayer,
      worstTick: run.worstTick,
      finalState: run.finalState,
      performance: {
        tickCount: run.tickCount,
        overBudgetTicks: run.overBudgetTicks,
        totalTickMs: run.totalTickMs,
        recent: run.recent,
      },
    })
  }

  private rememberLiving(run: ActiveRun, checkpoint: RunArchiveCheckpoint): void {
    const state = checkpoint.state
    if (state.run.phase !== 'active') return
    state.playerEntities.identities.forEach((player, index) => {
      if (state.playerEntities.progressions[index]!.lifeState !== 'alive') return
      run.lastAlive = checkpoint
      run.lastAliveByPlayer.set(player.playerId, checkpoint)
    })
  }
}

export function runArchivePlayers(archive: RunArchive): readonly {
  playerId: string
  displayName: string
  lastAliveTick: number | null
}[] {
  const players = new Map<string, string>()
  for (const [playerId, checkpoint] of archive.lastAliveByPlayer) {
    const index = checkpoint.state.playerEntities.identities.findIndex(player => player.playerId === playerId)
    players.set(playerId, checkpoint.state.playerEntities.configs[index]!.displayName)
  }
  archive.finalState.playerEntities.identities.forEach((player, index) => {
    players.set(player.playerId, archive.finalState.playerEntities.configs[index]!.displayName)
  })
  return [...players].map(([playerId, displayName]) => ({
    playerId, displayName, lastAliveTick: archive.lastAliveByPlayer.get(playerId)?.state.tick ?? null,
  }))
}

import {
  getPlayerCharacter,
  getPlayerProgression,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'

export interface GameActivityPlayer {
  readonly currentHealth: number
  readonly deathEpoch: number
  readonly discipline: string
  readonly displayName: string
  readonly element: string
  readonly level: number
  readonly lifeState: string
  readonly maximumHealth: number
  readonly playerId: string
  readonly x: number
  readonly y: number
}

export interface GameActivityWave {
  readonly eventId: number
  readonly ordinal: number
  readonly phase: string
}

export interface GameActivitySnapshot {
  readonly phase: string
  readonly players: readonly GameActivityPlayer[]
  readonly runId: string | null
  readonly tick: number
  readonly wave: GameActivityWave | null
}

export interface GameActivityEvent {
  readonly details: Readonly<Record<string, unknown>>
  readonly event: string
  readonly message: string
}

export function projectGameActivity(state: GameSimulationState): GameActivitySnapshot {
  return {
    phase: state.run.phase,
    players: state.playerEntities.identities.map(({ playerId }) => {
      const character = getPlayerCharacter(state, playerId)
      const progression = getPlayerProgression(state, playerId)
      return {
        currentHealth: progression.currentHealth,
        deathEpoch: progression.deathEpoch,
        discipline: character.config.discipline,
        displayName: character.config.displayName,
        element: character.config.element,
        level: progression.level,
        lifeState: progression.lifeState,
        maximumHealth: progression.maximumHealth,
        playerId,
        x: character.position.x,
        y: character.position.y,
      }
    }),
    runId: state.run.runId,
    tick: state.tick,
    wave: state.world.kind === 'boneyard' && state.world.waves !== null
      ? {
          eventId: state.world.waves.waveEventId,
          ordinal: state.world.waves.waveOrdinal,
          phase: state.world.waves.phase,
        }
      : null,
  }
}

export function deriveGameActivityEvents(
  previous: GameActivitySnapshot,
  current: GameActivitySnapshot,
): readonly GameActivityEvent[] {
  const events: GameActivityEvent[] = []
  if (previous.runId !== current.runId && current.runId !== null) {
    events.push({
      event: 'run.started',
      message: 'A party started a Boneyard run.',
      details: {
        playerCount: current.players.length,
        players: current.players,
        runId: current.runId,
        serverTick: current.tick,
      },
    })
  }

  if (
    current.wave !== null
    && (previous.wave === null || current.wave.eventId > previous.wave.eventId)
  ) {
    events.push({
      event: 'wave.started',
      message: 'A Boneyard wave started.',
      details: {
        playerCount: current.players.length,
        runId: current.runId,
        serverTick: current.tick,
        wave: current.wave.ordinal,
        waveEventId: current.wave.eventId,
      },
    })
  }

  if (
    previous.wave?.phase === 'wave-threshold'
    && current.wave?.phase === 'wave-lull-delay'
  ) {
    events.push({
      event: 'wave.completed',
      message: 'A party completed a Boneyard wave.',
      details: {
        playerCount: current.players.length,
        runId: current.runId,
        serverTick: current.tick,
        wave: current.wave.ordinal,
        waveEventId: current.wave.eventId,
      },
    })
  }

  const previousPlayers = new Map(previous.players.map(player => [player.playerId, player]))
  for (const player of current.players) {
    const before = previousPlayers.get(player.playerId)
    if (!before) continue
    if (player.deathEpoch > before.deathEpoch) {
      events.push({
        event: 'player.died',
        message: 'A player died in the Boneyard.',
        details: {
          ...player,
          runId: current.runId,
          serverTick: current.tick,
          wave: current.wave?.ordinal ?? null,
        },
      })
    }
    if (player.level > before.level) {
      events.push({
        event: 'player.leveled_up',
        message: 'A player gained a level.',
        details: {
          ...player,
          previousLevel: before.level,
          runId: current.runId,
          serverTick: current.tick,
          wave: current.wave?.ordinal ?? null,
        },
      })
    }
  }

  if (previous.phase === 'active' && current.phase === 'game-over') {
    events.push({
      event: 'run.game_over',
      message: 'A Boneyard run reached Game Over.',
      details: {
        playerCount: current.players.length,
        players: current.players,
        runId: current.runId,
        serverTick: current.tick,
        wave: current.wave?.ordinal ?? null,
      },
    })
  }

  if (previous.runId !== null && current.runId === null) {
    events.push({
      event: 'run.ended',
      message: 'A Boneyard run ended.',
      details: {
        playerCount: current.players.length,
        reason: previous.phase === 'game-over' ? 'game-over' : 'ended',
        runId: previous.runId,
        serverTick: current.tick,
        wave: previous.wave?.ordinal ?? null,
      },
    })
  }

  return events
}

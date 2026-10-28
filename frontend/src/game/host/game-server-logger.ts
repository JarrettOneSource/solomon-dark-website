export type GameServerLogLevel = 'debug' | 'error' | 'info' | 'warning'

export interface GameServerLogEntry {
  atUtc: string
  level: GameServerLogLevel
  component: 'game-host' | 'session-supervisor'
  event: string
  message: string
  details?: Readonly<Record<string, unknown>>
}

export type GameServerLogSink = (entry: GameServerLogEntry) => void

const LEVEL_ORDER: Readonly<Record<GameServerLogLevel, number>> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
}

export function logGameServerEvent(
  sink: GameServerLogSink | undefined,
  component: GameServerLogEntry['component'],
  level: GameServerLogLevel,
  event: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): void {
  sink?.({
    atUtc: new Date().toISOString(),
    level,
    component,
    event,
    message,
    ...(details ? { details } : {}),
  })
}

export function createJsonGameServerLogSink(
  minimumLevel: GameServerLogLevel,
): GameServerLogSink {
  return (entry) => {
    if (LEVEL_ORDER[entry.level] < LEVEL_ORDER[minimumLevel]) return
    process.stderr.write(`${JSON.stringify({ service: 'solomon-dark-game', ...entry })}\n`)
  }
}

export function parseGameServerLogLevel(value: string | undefined): GameServerLogLevel {
  const normalized = value?.trim().toLowerCase() || 'info'
  if (normalized === 'warn') return 'warning'
  if (normalized in LEVEL_ORDER) return normalized as GameServerLogLevel
  throw new Error('SDR_GAME_LOG_LEVEL must be debug, info, warning, or error')
}

export function gameServerErrorDetails(error: unknown): Readonly<Record<string, unknown>> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      ...(error.stack ? { errorStack: error.stack } : {}),
    }
  }
  return { errorMessage: String(error) }
}

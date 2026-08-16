import { GAME_PROTOCOL_NAME } from '../protocol/game-protocol.ts'
import {
  createBoneyardCatalog,
  loadModBoneyardsFromStageReport,
} from './boneyard-catalog.ts'
import { startGameSessionSupervisor } from './game-session-supervisor.ts'
import {
  createJsonGameServerLogSink,
  gameServerErrorDetails,
  logGameServerEvent,
  parseGameServerLogLevel,
} from './game-server-logger.ts'

const log = createJsonGameServerLogSink(
  parseGameServerLogLevel(process.env.SDR_GAME_LOG_LEVEL),
)

process.on('uncaughtExceptionMonitor', (error, origin) => {
  logGameServerEvent(
    log,
    'session-supervisor',
    'error',
    'process.uncaught_exception',
    'The game-session supervisor encountered an uncaught exception.',
    { origin, ...gameServerErrorDetails(error) },
  )
})
process.on('warning', (warning) => {
  logGameServerEvent(
    log,
    'session-supervisor',
    'warning',
    'process.warning',
    'The game-session supervisor emitted a runtime warning.',
    gameServerErrorDetails(warning),
  )
})

const adminSecret = requiredEnvironment('SDR_GAME_SUPERVISOR_SECRET')
const allowedOrigins = requiredEnvironment('SDR_GAME_ALLOWED_ORIGINS')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const stageReport = process.env.SDR_GAME_STAGE_REPORT?.trim()
const boneyards = createBoneyardCatalog(
  stageReport ? await loadModBoneyardsFromStageReport(stageReport) : [],
)

const supervisor = await startGameSessionSupervisor({
  adminSecret,
  allowedOrigins,
  boneyards,
  host: process.env.SDR_GAME_SUPERVISOR_HOST?.trim() || '127.0.0.1',
  log,
  port: parseInteger(process.env.SDR_GAME_SUPERVISOR_PORT, 5222, 0, 65535),
  maxSessions: parseInteger(process.env.SDR_GAME_MAX_SESSIONS, 64, 1, 10_000),
  maxConnectionsPerSession: parseInteger(
    process.env.SDR_GAME_MAX_CONNECTIONS_PER_SESSION,
    16,
    1,
    10_000,
  ),
  unclaimedTimeoutMs: parseInteger(
    process.env.SDR_GAME_UNCLAIMED_TIMEOUT_SECONDS,
    120,
    1,
    86_400,
  ) * 1000,
})

process.stdout.write(`${JSON.stringify({
  type: 'ready',
  url: supervisor.address.url,
  protocol: GAME_PROTOCOL_NAME,
})}\n`)

let stopping = false
async function stop(): Promise<void> {
  if (stopping) return
  stopping = true
  await supervisor.close()
  process.exitCode = 0
}

process.once('SIGINT', () => { void stop() })
process.once('SIGTERM', () => { void stop() })

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} must be configured`)
  return value
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Expected an integer within ${minimum}..${maximum}, received ${value}`)
  }
  return parsed
}

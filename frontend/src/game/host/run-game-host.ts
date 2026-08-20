import { GAME_PROTOCOL_NAME } from '../protocol/game-protocol.ts'
import { createGameSimulation } from '../core-server/game-simulation.ts'
import { createHubStudentFixturePopulation } from '../core-server/hub-student-fixtures.ts'
import {
  createBoneyardCatalog,
  loadModBoneyardsFromStageReport,
} from './boneyard-catalog.ts'
import { startGameHost } from './game-host.ts'
import { resolveWebLuaWasmPath } from './lua/web-lua-wasm-path.ts'
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
    'game-host',
    'error',
    'process.uncaught_exception',
    'The authoritative game-host process encountered an uncaught exception.',
    { origin, ...gameServerErrorDetails(error) },
  )
})
process.on('warning', (warning) => {
  logGameServerEvent(
    log,
    'game-host',
    'warning',
    'process.warning',
    'The authoritative game-host process emitted a runtime warning.',
    gameServerErrorDetails(warning),
  )
})

const host = process.env.SDR_GAME_HOST?.trim() || '127.0.0.1'
const port = parsePort(process.env.SDR_GAME_PORT)
const credential = process.env.SDR_GAME_BOOTSTRAP_CREDENTIAL?.trim()
if (!credential) throw new Error('SDR_GAME_BOOTSTRAP_CREDENTIAL must be configured')
const allowedOrigins = process.env.SDR_GAME_ALLOWED_ORIGINS
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const snapshotRate = parseSnapshotRate(process.env.SDR_GAME_SNAPSHOT_RATE)
const trustedProxy = process.env.SDR_GAME_TRUSTED_PROXY === '1'
const benchmarkStudentCount = parseBenchmarkStudentCount(
  process.env.SDR_HUB_BENCH_STUDENTS,
)
const benchmarkStudentSeed = parseBenchmarkStudentSeed(
  process.env.SDR_HUB_BENCH_SEED,
  benchmarkStudentCount,
)
const stageReport = process.env.SDR_GAME_STAGE_REPORT?.trim()
const boneyards = createBoneyardCatalog(
  stageReport ? await loadModBoneyardsFromStageReport(stageReport) : [],
)

const server = await startGameHost({
  authentication: { kind: 'shared', credential },
  host,
  log,
  luaWasmPath: resolveWebLuaWasmPath(import.meta.url),
  port,
  resetWhenEmpty: true,
  boneyards,
  snapshotRate,
  trustedProxy,
  ...(allowedOrigins ? { allowedOrigins } : {}),
  ...(benchmarkStudentCount === undefined
    ? {}
    : {
        createSimulation: () => createGameSimulation({}, {
          hubStudentPopulation: createHubStudentFixturePopulation({
            count: benchmarkStudentCount,
            routeEndBehavior: 'reverse',
            seed: benchmarkStudentSeed,
          }),
        }),
      }),
})

process.stdout.write(`${JSON.stringify({
  type: 'ready',
  url: server.address.url,
  protocol: GAME_PROTOCOL_NAME,
  ...(benchmarkStudentCount === undefined
    ? {}
    : {
        benchmarkStudentCount,
        benchmarkStudentSeed,
      }),
})}\n`)

let stopping = false
async function stop(): Promise<void> {
  if (stopping) return
  stopping = true
  await server.close()
  process.exitCode = 0
}

process.once('SIGINT', () => { void stop() })
process.once('SIGTERM', () => { void stop() })

function parsePort(value: string | undefined): number {
  if (!value) return 0
  const port = Number(value)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('SDR_GAME_PORT must be an integer between 0 and 65535')
  }
  return port
}

function parseSnapshotRate(value: string | undefined): number {
  if (!value) return 20
  const rate = Number(value)
  if (!Number.isInteger(rate) || rate < 1 || rate > 100) {
    throw new Error('SDR_GAME_SNAPSHOT_RATE must be an integer between 1 and 100')
  }
  return rate
}

function parseBenchmarkStudentCount(value: string | undefined): number | undefined {
  if (!value) return undefined
  const count = Number(value)
  if (!Number.isInteger(count) || count < 0 || count > 256) {
    throw new Error('SDR_HUB_BENCH_STUDENTS must be an integer between 0 and 256')
  }
  return count
}

function parseBenchmarkStudentSeed(
  value: string | undefined,
  count: number | undefined,
): number {
  if (count === undefined && value) {
    throw new Error('SDR_HUB_BENCH_SEED requires SDR_HUB_BENCH_STUDENTS')
  }
  if (!value) return 0x51d07e57
  const seed = Number(value)
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new Error('SDR_HUB_BENCH_SEED must be an unsigned 32-bit integer')
  }
  return seed
}

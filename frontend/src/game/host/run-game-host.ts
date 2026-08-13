import { randomBytes } from 'node:crypto'

import { GAME_PROTOCOL_NAME } from '../protocol/game-protocol.ts'
import { startGameHost } from './game-host.ts'

const host = process.env.SDR_GAME_HOST?.trim() || '127.0.0.1'
const port = parsePort(process.env.SDR_GAME_PORT)
const credential = process.env.SDR_GAME_BOOTSTRAP_CREDENTIAL?.trim()
  || randomBytes(32).toString('base64url')
const allowedOrigins = process.env.SDR_GAME_ALLOWED_ORIGINS
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const snapshotRate = parseSnapshotRate(process.env.SDR_GAME_SNAPSHOT_RATE)
const trustedProxy = process.env.SDR_GAME_TRUSTED_PROXY === '1'

const server = await startGameHost({
  host,
  port,
  bootstrapCredential: credential,
  snapshotRate,
  trustedProxy,
  ...(allowedOrigins ? { allowedOrigins } : {}),
})

process.stdout.write(`${JSON.stringify({
  type: 'ready',
  url: server.address.url,
  bootstrapCredential: credential,
  protocol: GAME_PROTOCOL_NAME,
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

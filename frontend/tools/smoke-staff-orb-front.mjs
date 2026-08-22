import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createServer as createViteServer } from 'vite'

import { startGameHost } from '../src/game/host/game-host.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotRoot = process.env.SDR_HUB_COMBAT_SCREENSHOT_ROOT
  || join(tmpdir(), 'solomon-staff-orb-front')
const credential = randomBytes(32).toString('base64url')

await mkdir(screenshotRoot, { recursive: true })
const frontend = await createViteServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
await frontend.listen()
const address = frontend.httpServer?.address()
if (!address || typeof address === 'string') {
  await frontend.close()
  throw new Error('Vite did not expose its Staff-orb acceptance port')
}
const baseUrl = `http://127.0.0.1:${address.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  resetWhenEmpty: true,
  snapshotRate: 20,
})

try {
  const [receipt] = await Promise.all([
    runFocusedSmoke({
      ...process.env,
      SDR_GAME_SMOKE_CREDENTIAL: credential,
      SDR_GAME_SMOKE_ENDPOINT: host.address.url,
      SDR_GAME_SMOKE_URL: baseUrl,
      SDR_HUB_COMBAT_SCREENSHOT_ROOT: screenshotRoot,
    }),
    unlockBoneyardCombat(host),
  ])
  assert.equal(receipt.status, 'ok')
  assert.ok(receipt.hubBackFacingOrb.orbSpriteCount > receipt.hubBefore.orbSpriteCount)
  process.stdout.write(`${JSON.stringify({ receipt, screenshotRoot, status: 'ok' })}\n`)
} finally {
  await Promise.all([host.close(), frontend.close()])
}

async function unlockBoneyardCombat(host) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    const state = host.state()
    if (state.world.kind === 'boneyard') {
      Object.assign(state, {
        world: {
          ...state.world,
          arenaTransition: null,
          encounter: null,
          waves: null,
        },
      })
      return
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('Staff-orb browser journey did not enter the Boneyard')
}

function runFocusedSmoke(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['tools/smoke-hub-combat-entry.mjs'], {
      cwd: frontendRoot,
      env,
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    let output = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => { output += chunk })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code !== 0) {
        reject(new Error(`Staff-orb browser journey failed (${code ?? signal ?? 'unknown'})`))
        return
      }
      try {
        resolve(JSON.parse(output.trim()))
      } catch (error) {
        reject(new Error('Staff-orb browser receipt was not JSON', { cause: error }))
      }
    })
  })
}

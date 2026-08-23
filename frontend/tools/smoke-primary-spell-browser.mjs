import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build as buildFrontend, preview as previewBuiltFrontend } from 'vite'

import { startGameHost } from '../src/game/host/game-host.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const kind = process.env.SDR_PRIMARY_SPELL_KIND?.trim().toLowerCase()
const supportedKinds = new Set(['ether', 'fire', 'air', 'water', 'earth'])
if (!kind || !supportedKinds.has(kind)) {
  throw new Error('SDR_PRIMARY_SPELL_KIND must name one elemental primary')
}

const screenshotRoot = process.env.SDR_PRIMARY_SPELL_SCREENSHOT_ROOT
  || join(tmpdir(), `solomon-primary-${kind}`)
const credential = randomBytes(32).toString('base64url')
const viteConfig = fileURLToPath(new URL('../vite.config.ts', import.meta.url))

await mkdir(screenshotRoot, { recursive: true })
await buildFrontend({
  configFile: viteConfig,
  logLevel: 'error',
  root: frontendRoot,
})
const frontend = await previewBuiltFrontend({
  configFile: viteConfig,
  logLevel: 'error',
  preview: { host: '127.0.0.1', port: 0 },
  root: frontendRoot,
})
const address = frontend.httpServer.address()
if (!address || typeof address === 'string') {
  await frontend.close()
  throw new Error('Vite did not expose its primary-spell acceptance port')
}
const baseUrl = `http://127.0.0.1:${address.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  resetWhenEmpty: true,
  snapshotRate: 20,
})

try {
  const receipt = await runBrowserSmoke({
    ...process.env,
    SDR_GAME_SMOKE_CREDENTIAL: credential,
    SDR_GAME_SMOKE_ENDPOINT: host.address.url,
    SDR_GAME_SMOKE_URL: baseUrl,
    SDR_PRIMARY_SPELL_BONEYARD_ONLY: kind === 'ether' || kind === 'air' ? '1' : '',
    SDR_PRIMARY_SPELL_COMBAT_ADMISSION: kind === 'ether' || kind === 'air' ? '1' : '',
    SDR_PRIMARY_SPELL_KIND: kind,
    SDR_PRIMARY_SPELL_SCREENSHOT_ROOT: screenshotRoot,
  })
  assert.equal(receipt.status, 'ok')
  assert.deepEqual(receipt.errors, [])
  assert.equal(receipt.receipts.length, 1)
  assert.equal(receipt.receipts[0].kind, kind)
  assert.ok(receipt.boneyard, 'the browser journey must reach the Boneyard')
  process.stdout.write(`${JSON.stringify({
    kind,
    receipt,
    screenshotRoot,
    status: 'ok',
  })}\n`)
} finally {
  await Promise.all([host.close(), frontend.close()])
}

function runBrowserSmoke(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['tools/smoke-primary-spells.mjs'], {
      cwd: frontendRoot,
      env,
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    let output = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { output += chunk })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code !== 0) {
        reject(new Error(
          `Primary ${kind} browser journey failed (${code ?? signal ?? 'unknown'})`,
        ))
        return
      }
      try {
        resolve(JSON.parse(output.trim()))
      } catch (error) {
        reject(new Error(`Primary ${kind} receipt was not JSON`, { cause: error }))
      }
    })
  })
}

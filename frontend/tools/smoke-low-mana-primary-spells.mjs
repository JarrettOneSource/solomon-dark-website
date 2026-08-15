import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createServer as createViteServer } from 'vite'

import { startGameHost } from '../src/game/host/game-host.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotRoot = process.env.SDR_PRIMARY_SPELL_SCREENSHOT_ROOT
  || join(tmpdir(), 'solomon-low-mana-primary-spells')
const credential = randomBytes(32).toString('base64url')
const requestedKind = process.env.SDR_PRIMARY_SPELL_KIND?.trim().toLowerCase()
const spellKinds = requestedKind
  ? [requestedKind]
  : ['ether', 'fire', 'air', 'water', 'earth']
const supportedKinds = new Set(['ether', 'fire', 'air', 'water', 'earth'])
if (spellKinds.some((kind) => !supportedKinds.has(kind))) {
  throw new Error(`Unknown SDR_PRIMARY_SPELL_KIND: ${requestedKind}`)
}

await mkdir(screenshotRoot, { recursive: true })
const vite = await createViteServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
const viteAddress = vite.httpServer?.address()
if (!viteAddress || typeof viteAddress === 'string') {
  await vite.close()
  throw new Error('Vite did not expose its local low-mana acceptance port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
let host = null
let forcedAuthoritySamples = 0
let manaClamp = null

try {
  host = await startGameHost({
    allowedOrigins: [baseUrl],
    authentication: { kind: 'shared', credential },
    resetWhenEmpty: true,
    snapshotRate: 100,
  })
  manaClamp = setInterval(() => {
    const progressions = host.state().playerEntities.progressions
    for (let index = 0; index < progressions.length; index += 1) {
      const progression = progressions[index]
      if (progression.currentMana !== 0) {
        progressions[index] = { ...progression, currentMana: 0 }
      }
      forcedAuthoritySamples += 1
    }
  }, 1)
  const receipts = []
  for (const kind of spellKinds) {
    const receipt = await runSpellSmoke(kind, {
      ...process.env,
      SDR_GAME_SMOKE_CREDENTIAL: credential,
      SDR_GAME_SMOKE_ENDPOINT: host.address.url,
      SDR_GAME_SMOKE_URL: baseUrl,
      SDR_PRIMARY_SPELL_KIND: kind,
      SDR_PRIMARY_SPELL_LOW_MANA: '1',
      SDR_PRIMARY_SPELL_SCREENSHOT_ROOT: screenshotRoot,
    })
    receipts.push(receipt)
    await waitForHostReset(host, kind)
  }
  if (forcedAuthoritySamples === 0) {
    throw new Error('The zero-MP authority fixture never observed a joined player')
  }
  process.stdout.write(`${JSON.stringify({
    fixture: {
      forcedAuthorityMana: 0,
      forcedAuthoritySamples,
    },
    receipts,
    screenshotRoot,
    status: 'ok',
  })}\n`)
} finally {
  if (manaClamp !== null) clearInterval(manaClamp)
  await Promise.all([host?.close(), vite.close()])
}

function runSpellSmoke(kind, env) {
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
          `Low-mana ${kind} browser journey failed (${code ?? signal ?? 'unknown'})`,
        ))
        return
      }
      try {
        resolve(JSON.parse(output.trim()))
      } catch (error) {
        reject(new Error(`Low-mana ${kind} receipt was not JSON`, { cause: error }))
      }
    })
  })
}

async function waitForHostReset(host, kind) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (
      host.playerCount() === 0
      && host.state().world.kind === 'hub'
      && host.state().playerEntities.entityIds.length === 0
    ) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Low-mana ${kind} browser journey did not release the shared host`)
}

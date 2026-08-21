import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

import { GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import { GAME_PROTOCOL_NAME } from '../src/game/protocol/game-protocol.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const webRoot = fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url))
const hostEntry = fileURLToPath(new URL('../dist-game-host/game-host.mjs', import.meta.url))
const wasmPath = fileURLToPath(new URL('../dist-game-host/lua54.wasm', import.meta.url))
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')
const maximumP95Ms = finiteEnvironmentNumber('SDR_LUA_MAX_P95_MS', 4)
const maximumP99Ms = finiteEnvironmentNumber('SDR_LUA_MAX_P99_MS', 6)
const maximumSampleMs = finiteEnvironmentNumber('SDR_LUA_MAX_SAMPLE_MS', 10)
const sampleCount = 120

await Promise.all([stat(hostEntry), stat(wasmPath), stat(chromePath)])
const staticServer = await startStaticServer(webRoot)
const staticAddress = staticServer.address()
if (!staticAddress || typeof staticAddress === 'string') {
  throw new Error('built-game static server did not bind a TCP address')
}
const baseUrl = `http://127.0.0.1:${staticAddress.port}`
const credential = randomBytes(32).toString('base64url')
const host = spawn(process.execPath, [hostEntry], {
  cwd: frontendRoot,
  env: {
    ...process.env,
    SDR_GAME_ALLOWED_ORIGINS: baseUrl,
    SDR_GAME_BOOTSTRAP_CREDENTIAL: credential,
    SDR_GAME_HOST: '127.0.0.1',
    SDR_GAME_PORT: '0',
    SDR_GAME_SNAPSHOT_RATE: '20',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
const hostDiagnostics = []
host.stderr.setEncoding('utf8')
host.stderr.on('data', (chunk) => hostDiagnostics.push(chunk))

let browser
let page
try {
  const readiness = await readHostReadiness(host)
  assert.equal(readiness.protocol, GAME_PROTOCOL_NAME)
  const healthUrl = new URL(readiness.url)
  healthUrl.protocol = 'http:'
  healthUrl.pathname = '/health'
  const coldHealth = await readHealth(healthUrl)
  assert.equal(coldHealth.lua, null)

  browser = await chromium.launch({ executablePath: chromePath, headless: true })
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  page = await context.newPage()
  const consoleErrors = []
  const pageErrors = []
  const requestFailures = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => {
    requestFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`)
  })
  await page.addInitScript(({ credential: token, endpoint }) => {
    window.solomonDarkRuntime = {
      gameEndpoint: { credential: token, kind: 'localhost', url: endpoint },
    }
  }, { credential, endpoint: readiness.url })

  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  assert.equal(await page.evaluate(() => window.solomonDark), undefined)

  await page.getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await settings.waitFor()
  const cheats = settings.getByRole('button', { name: /Enable Cheats/i })
  assert.equal(await cheats.getAttribute('aria-pressed'), 'false')
  await cheats.click()
  assert.equal(await page.evaluate((key) => (
    JSON.parse(localStorage.getItem(key)).enableCheats
  ), GAME_SETTINGS_STORAGE_KEY), true)
  await settings.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]')
    .waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]')
    .waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]')
    .waitFor({ timeout: 30_000 })
  await page.waitForFunction(() => window.solomonDark?.lua)

  const identity = await executeLua(page, `
    print('web-lua', _VERSION)
    return _VERSION, sd.runtime.api_version, sd.state.is_authority(),
      sd.runtime.has_capability('player.resources.write'),
      type(io), type(os), type(package), type(require), type(debug)
  `)
  assert.equal(identity.ok, true, identity.error)
  assert.deepEqual(identity.output, ['web-lua\tLua 5.4'])
  assert.deepEqual(identity.values, [
    'Lua 5.4',
    '0.2.0',
    true,
    true,
    'nil',
    'nil',
    'nil',
    'nil',
    'nil',
  ])
  const initializedHealth = await readHealth(healthUrl)
  assert.ok(initializedHealth.lua)
  assert.ok(initializedHealth.lua.initializedAtMs < 1_000)
  assert.ok(initializedHealth.lua.memoryBytes <= 16 * 1024 * 1024)

  const mutation = await executeLua(page, `
    sd.player.set_gold(4321)
    local revision = sd.state.set('ticks', 0)
    sd.events.on('runtime.tick', function(event)
      sd.state.set('ticks', sd.state.get('ticks', 0) + 1)
    end)
    return revision, sd.rng.set_seed(42), sd.rng.get_seed()
  `)
  assert.equal(mutation.ok, true, mutation.error)
  assert.deepEqual(mutation.values, [1, 42, 42])
  await page.waitForTimeout(50)
  const mutated = await executeLua(page, `
    return sd.player.get_state().gold, sd.state.get('ticks'), sd.state.get_revision()
  `)
  assert.equal(mutated.ok, true, mutated.error)
  assert.equal(mutated.values[0], 4321)
  assert.ok(mutated.values[1] >= 2)
  assert.ok(mutated.values[2] > mutated.values[1])

  await page.waitForTimeout(100)
  const budgetExceededBeforeSample = (await readHealth(healthUrl)).lua.budgetExceededCount
  const tickWorkSamples = []
  for (let index = 0; index < sampleCount; index += 1) {
    const health = await readHealth(healthUrl)
    if (health.lua && health.lua.lastTickWorkMs > 0) {
      tickWorkSamples.push(health.lua.lastTickWorkMs)
    }
    await delay(12)
  }
  assert.ok(tickWorkSamples.length >= 50, `expected active Lua tick samples, got ${tickWorkSamples.length}`)
  const tickWork = distribution(tickWorkSamples)
  assert.ok(tickWork.p95 < maximumP95Ms, JSON.stringify(tickWork))
  assert.ok(tickWork.p99 < maximumP99Ms, JSON.stringify(tickWork))
  assert.ok(tickWork.maximum < maximumSampleMs, JSON.stringify(tickWork))
  const budgetExceededDuringSample = (
    (await readHealth(healthUrl)).lua.budgetExceededCount
    - budgetExceededBeforeSample
  )
  assert.ok(
    budgetExceededDuringSample <= Math.ceil(sampleCount * 0.05),
    `Lua exceeded its tick budget ${budgetExceededDuringSample} times`,
  )

  const runawayStartedAt = performance.now()
  const runaway = await executeLua(page, 'while true do end')
  const runawayDurationMs = performance.now() - runawayStartedAt
  assert.equal(runaway.ok, false)
  assert.match(runaway.error || '', /thread timeout exceeded/)
  assert.ok(runawayDurationMs < 1_000, `runaway Lua took ${runawayDurationMs} ms`)
  assert.equal(await page.locator('.hub-scene').count(), 1)

  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const boneyard = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  await boneyard.waitFor({ timeout: 30_000 })
  const seeded = await executeLua(page, `
    local scene = sd.scene.get_state()
    sd.events.on('enemy.spawned', function(event)
      sd.state.set('spawned_actor', event.actor_id)
    end)
    local player = sd.player.get_state()
    local request = sd.enemies.spawn('skeleton', {x = player.x + 80, y = player.y})
    return sd.rng.get_seed(), scene.seed, request.request_id
  `)
  assert.equal(seeded.ok, true, seeded.error)
  assert.equal(seeded.values[0], 42)
  assert.equal(seeded.values[1], `0000002a${'00'.repeat(12)}`)
  assert.equal(seeded.values[2], 1)
  await page.waitForTimeout(100)
  const spawnReceipt = await executeLua(page, `
    local enemies = 0
    for _, actor in ipairs(sd.world.list_actors()) do
      if actor.tracked_enemy then enemies = enemies + 1 end
    end
    return enemies, sd.state.get('spawned_actor')
  `)
  assert.equal(spawnReceipt.ok, true, spawnReceipt.error)
  assert.ok(spawnReceipt.values[0] >= 1)
  assert.ok(spawnReceipt.values[1] >= 1)

  if (process.env.SDR_GAME_SMOKE_SCREENSHOT) {
    await page.screenshot({ path: process.env.SDR_GAME_SMOKE_SCREENSHOT })
  }

  await page.evaluate((key) => {
    localStorage.setItem(key, '{"enableCheats":false}')
    window.dispatchEvent(new StorageEvent('storage', { key }))
  }, GAME_SETTINGS_STORAGE_KEY)
  await page.waitForFunction(() => window.solomonDark === undefined)
  assert.equal(await page.evaluate(() => window.solomonDark), undefined)

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(requestFailures.filter((failure) => (
    !/\.mp3: net::ERR_ABORTED$/.test(failure)
  )), [])
  const expectedLuaErrors = consoleErrors.filter((message) => (
    /^\[Lua error\].*thread timeout exceeded/.test(message)
  ))
  assert.equal(expectedLuaErrors.length, 1, JSON.stringify(consoleErrors))
  assert.deepEqual(consoleErrors.filter((message) => !expectedLuaErrors.includes(message)), [])

  await page.close()
  page = undefined
  await waitFor(async () => {
    const health = await readHealth(healthUrl)
    return health.players === 0 && health.lua === null
  }, 5_000)

  const [hostBundle, wasm] = await Promise.all([stat(hostEntry), stat(wasmPath)])
  process.stdout.write(`${JSON.stringify({
    browserVersion: browser.version(),
    budgetExceededDuringSample,
    coldLua: coldHealth.lua,
    consoleErrors,
    hostBundleBytes: hostBundle.size,
    initializedAtMs: initializedHealth.lua.initializedAtMs,
    luaMemoryBytes: initializedHealth.lua.memoryBytes,
    protocol: readiness.protocol,
    requestFailures,
    runawayDurationMs,
    spawnActorId: spawnReceipt.values[1],
    status: 'ok',
    tickWork,
    wasmBytes: wasm.size,
  })}\n`)
} finally {
  if (page && !page.isClosed()) await page.close().catch(() => {})
  if (browser) await browser.close().catch(() => {})
  await stopChild(host)
  await new Promise((resolveClose) => staticServer.close(resolveClose))
  if (host.exitCode !== 0 && host.exitCode !== null) {
    process.stderr.write(hostDiagnostics.join(''))
  }
}

async function executeLua(target, code) {
  return target.evaluate((source) => window.solomonDark.lua.execute(source), code)
}

async function readHealth(url) {
  const response = await fetch(url)
  assert.equal(response.status, 200)
  return response.json()
}

function distribution(values) {
  const sorted = [...values].sort((left, right) => left - right)
  return {
    maximum: sorted.at(-1),
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    samples: sorted.length,
  }
}

function percentile(sorted, quantile) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))]
}

function finiteEnvironmentNumber(name, fallback) {
  const value = Number(process.env[name] || fallback)
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`)
  return value
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (!await predicate()) {
    if (Date.now() >= deadline) throw new Error('timed out waiting for runtime teardown')
    await delay(25)
  }
}

function readHostReadiness(child) {
  return new Promise((resolveReadiness, reject) => {
    let buffer = ''
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('built game host did not become ready'))
    }, 15_000)
    const receive = (chunk) => {
      buffer += chunk
      const newline = buffer.indexOf('\n')
      if (newline < 0) return
      let message
      try {
        message = JSON.parse(buffer.slice(0, newline))
      } catch (error) {
        cleanup()
        reject(error)
        return
      }
      if (message.type !== 'ready' || typeof message.url !== 'string') {
        cleanup()
        reject(new Error('built game host emitted invalid readiness data'))
        return
      }
      cleanup()
      resolveReadiness(message)
    }
    const exited = (code, signal) => {
      cleanup()
      reject(new Error(`built game host exited before readiness (${code ?? signal})`))
    }
    const cleanup = () => {
      clearTimeout(timeout)
      child.stdout.off('data', receive)
      child.off('exit', exited)
    }
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', receive)
    child.once('exit', exited)
  })
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  await new Promise((resolveExit) => {
    const timeout = setTimeout(() => child.kill('SIGKILL'), 3_000)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolveExit()
    })
    child.kill('SIGTERM')
  })
}

async function startStaticServer(root) {
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`
  const index = resolve(root, 'index.html')
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
      const relative = pathname === '/' || extname(pathname) === ''
        ? 'index.html'
        : pathname.slice(1)
      const target = resolve(root, relative)
      if (target !== index && !target.startsWith(rootPrefix)) {
        response.writeHead(403)
        response.end()
        return
      }
      const body = await readFile(target)
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': contentType(target),
      })
      response.end(body)
    } catch {
      response.writeHead(404)
      response.end()
    }
  })
  await new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolveListen()
    })
  })
  return server
}

function contentType(path) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.webmanifest': 'application/manifest+json',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  })[extname(path)] || 'application/octet-stream'
}

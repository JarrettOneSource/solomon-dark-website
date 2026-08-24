import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

import { chromium } from 'playwright-core'
import { WebSocket } from 'ws'

import { EntityReplicationReconstructor } from '../src/game/protocol/entity-replication.ts'
import {
  GAME_PROTOCOL_NAME,
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
} from '../src/game/protocol/game-protocol.ts'

const frontendRoot = resolve(import.meta.dirname, '..')
const webRoot = resolve(frontendRoot, '../backend/wwwroot')
const supervisorEntry = resolve(frontendRoot, 'dist-game-host/game-session-supervisor.mjs')
const wasmPath = resolve(frontendRoot, 'dist-game-host/lua54.wasm')
const checkpointPath = resolve(frontendRoot, 'server-assets/ml-bot-policy-v7-selected.sdml')
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')
const adminSecret = `developer-grants-${randomBytes(24).toString('base64url')}`

await Promise.all([
  stat(supervisorEntry),
  stat(wasmPath),
  stat(checkpointPath),
  stat(chromePath),
])
const staticServer = await startStaticServer(webRoot)
const staticAddress = staticServer.address()
if (!staticAddress || typeof staticAddress === 'string') {
  throw new Error('built-game static server did not bind a TCP address')
}
const baseUrl = `http://127.0.0.1:${staticAddress.port}`
const supervisor = spawn(process.execPath, [supervisorEntry], {
  cwd: frontendRoot,
  env: {
    ...process.env,
    SDR_GAME_ALLOWED_ORIGINS: baseUrl,
    SDR_GAME_LOG_LEVEL: 'warning',
    SDR_GAME_ML_BOT_CHECKPOINT: checkpointPath,
    SDR_GAME_SUPERVISOR_HOST: '127.0.0.1',
    SDR_GAME_SUPERVISOR_PORT: '0',
    SDR_GAME_SUPERVISOR_SECRET: adminSecret,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
const hostDiagnostics = []
supervisor.stderr.setEncoding('utf8')
supervisor.stderr.on('data', chunk => hostDiagnostics.push(chunk))

let browser
let page
let ordinary
try {
  const readiness = await readReadyLine(supervisor)
  assert.equal(readiness.protocol, GAME_PROTOCOL_NAME)
  const [developerTicket, ordinaryTicket] = await Promise.all([
    issueHubTicket(readiness.url, true, 7),
    issueHubTicket(readiness.url, false, 42),
  ])
  ordinary = await connectTrackedPlayer(
    gameEndpoint(readiness.url, ordinaryTicket.path),
    ordinaryTicket.credential,
    baseUrl,
  )

  browser = await chromium.launch({ executablePath: chromePath, headless: true })
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  page = await context.newPage()
  const consoleErrors = []
  const pageErrors = []
  const requestFailures = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('requestfailed', request => {
    requestFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`)
  })
  await page.addInitScript(({ credential, endpoint }) => {
    window.solomonDarkRuntime = {
      gameEndpoint: { credential, kind: 'localhost', url: endpoint },
    }
  }, {
    credential: developerTicket.credential,
    endpoint: gameEndpoint(readiness.url, developerTicket.path),
  })

  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  const tutorialOffer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialOffer.isVisible()) {
    await tutorialOffer.getByRole('button', { exact: true, name: 'NO' }).click()
  }
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

  const targetId = ordinary.welcome.playerId
  const granted = await executeLua(page, `
    local target = '${targetId}'
    local items = sd.dev.list_items()
    local skills = sd.dev.list_skills()
    local welds = sd.dev.list_welds()
    sd.dev.grant_gold(250, target)
    sd.dev.grant_item('health-potion', 3, target)
    sd.dev.grant_item('equipment:0', 1, target)
    sd.dev.grant_skill(72, 2, target)
    sd.dev.grant_weld(1000, target)
    return #items, #skills, #welds, true
  `)
  assert.equal(granted.ok, true, granted.error ?? 'developer grants failed')
  assert.deepEqual(granted.values, [58, 72, 10, true])

  await waitFor(() => grantsPresent(ordinary.snapshot(), targetId), 10_000)
  const hubPlayer = ordinary.snapshot().players[targetId]
  assert.ok(hubPlayer)
  ordinary.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: ordinary.welcome.boneyards[0].id,
  }))
  await waitFor(() => (
    ordinary.snapshot().world.kind === 'boneyard'
    && grantsPresent(ordinary.snapshot(), targetId)
  ), 15_000)
  const runPlayer = ordinary.snapshot().players[targetId]
  assert.ok(runPlayer)

  if (process.env.SDR_GAME_SMOKE_SCREENSHOT) {
    await page.screenshot({ path: process.env.SDR_GAME_SMOKE_SCREENSHOT })
  }
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(requestFailures.filter(failure => (
    !/\.mp3: net::ERR_ABORTED$/.test(failure)
  )), [])
  assert.deepEqual(consoleErrors, [])
  const hostErrors = hostDiagnostics.filter(chunk => /"level":"error"/.test(chunk))
  assert.deepEqual(hostErrors, [])

  process.stdout.write(`${JSON.stringify({
    browserVersion: browser.version(),
    catalogs: granted.values.slice(0, 3),
    consoleErrors,
    hub: grantReceipt(hubPlayer),
    hostErrors,
    pageErrors,
    protocol: readiness.protocol,
    requestFailures,
    run: grantReceipt(runPlayer),
    status: 'ok',
    targetPlayerId: targetId,
  })}\n`)
} finally {
  if (page && !page.isClosed()) await page.close().catch(() => {})
  await browser?.close().catch(() => {})
  await ordinary?.close().catch(() => {})
  await stopChild(supervisor)
  await new Promise(resolveClose => staticServer.close(resolveClose))
  if (supervisor.exitCode !== 0 && supervisor.exitCode !== null) {
    process.stderr.write(hostDiagnostics.join(''))
  }
}

function grantsPresent(snapshot, playerId) {
  const player = snapshot.players[playerId]
  if (!player) return false
  const acidRain = player.progression.learnedSkills.find(([skillId]) => skillId === 72)
  return player.economy.gold === 750
    && player.economy.backpack.some(item => (
      item.kind === 'health-potion' && item.quantity === 4
    ))
    && player.economy.backpack.some(item => item.recipeIndex === 0)
    && acidRain?.[1] === 2
    && player.progression.advancedUnlocks[0] === true
    && player.progression.selectedPrimarySkillId === 52
    && player.progression.weldBuildId === 1000
}

function grantReceipt(player) {
  return {
    acidRain: player.progression.learnedSkills.find(([skillId]) => skillId === 72),
    equipmentRecipeZero: player.economy.backpack.some(item => item.recipeIndex === 0),
    gold: player.economy.gold,
    healthPotions: player.economy.backpack.find(item => (
      item.kind === 'health-potion'
    ))?.quantity,
    primarySkillId: player.progression.selectedPrimarySkillId,
    weldBuildId: player.progression.weldBuildId,
  }
}

async function issueHubTicket(supervisorUrl, developerAccess, leaderboardUserId) {
  const response = await fetch(`${supervisorUrl}/admin/hub/tickets`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${adminSecret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      content: { manifestSha256: '0'.repeat(64), mods: [] },
      developerAccess,
      leaderboardUserId,
    }),
  })
  assert.equal(response.status, 201)
  return response.json()
}

async function connectTrackedPlayer(url, credential, origin) {
  const socket = await openSocket(url, origin)
  const welcomeMessage = nextMessage(socket, message => message.type === 'server-welcome')
  socket.send(encodeGameMessage({
    character: { discipline: 'mind', displayName: 'Grant Target', element: 'water' },
    cheatsEnabled: false,
    credential,
    profile: { accountUsername: 'Target', highestWave: null, totalPlaytimeMs: null },
    protocolVersion: GAME_PROTOCOL_VERSION,
    type: 'client-hello',
  }))
  const welcome = await welcomeMessage
  assert.equal(welcome.type, 'server-welcome')
  assert.equal(welcome.developerAccess, false)
  const reconstructor = new EntityReplicationReconstructor()
  reconstructor.reset(welcome.snapshot, welcome.snapshotSequence)
  let snapshot = welcome.snapshot
  const receive = data => {
    const message = decodeServerGameMessage(data.toString())
    if (message.type !== 'server-snapshot') return
    snapshot = reconstructor.apply(message.frame, message.sequence)
    socket.send(encodeGameMessage({
      type: 'client-snapshot-ack',
      requireKeyframe: false,
      sequence: message.sequence,
    }))
  }
  socket.on('message', receive)
  return {
    close: async () => {
      socket.off('message', receive)
      await closeSocket(socket)
    },
    snapshot: () => snapshot,
    socket,
    welcome,
  }
}

function gameEndpoint(supervisorUrl, path) {
  const endpoint = new URL(path, supervisorUrl)
  endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:'
  return endpoint.toString()
}

function executeLua(target, code) {
  return target.evaluate(source => window.solomonDark.lua.execute(source), code)
}

function openSocket(url, origin) {
  return new Promise((resolveOpen, reject) => {
    const socket = new WebSocket(url, { origin })
    socket.once('open', () => resolveOpen(socket))
    socket.once('error', reject)
  })
}

function nextMessage(socket, predicate, timeoutMs = 10_000) {
  return new Promise((resolveMessage, reject) => {
    const timeout = setTimeout(() => finish(new Error('timed out waiting for game message')), timeoutMs)
    const receive = data => {
      const message = decodeServerGameMessage(data.toString())
      if (predicate(message)) finish(message)
    }
    const fail = error => finish(error)
    const finish = result => {
      clearTimeout(timeout)
      socket.off('message', receive)
      socket.off('error', fail)
      if (result instanceof Error) reject(result)
      else resolveMessage(result)
    }
    socket.on('message', receive)
    socket.on('error', fail)
  })
}

function closeSocket(socket) {
  if (socket.readyState === WebSocket.CLOSED) return Promise.resolve()
  return new Promise(resolveClose => {
    socket.once('close', resolveClose)
    socket.close(1_000, 'developer grant smoke complete')
  })
}

function readReadyLine(child) {
  return new Promise((resolveReady, reject) => {
    let buffer = ''
    const timeout = setTimeout(() => finish(new Error('supervisor did not become ready')), 20_000)
    const receive = chunk => {
      buffer += chunk
      const newline = buffer.indexOf('\n')
      if (newline < 0) return
      try {
        const message = JSON.parse(buffer.slice(0, newline))
        if (message.type !== 'ready' || typeof message.url !== 'string') {
          finish(new Error('supervisor emitted invalid readiness data'))
          return
        }
        finish(message)
      } catch (error) {
        finish(error)
      }
    }
    const exited = (code, signal) => finish(
      new Error(`supervisor exited before readiness (${code ?? signal})`),
    )
    const finish = result => {
      clearTimeout(timeout)
      child.stdout.off('data', receive)
      child.off('exit', exited)
      if (result instanceof Error) reject(result)
      else resolveReady(result)
    }
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', receive)
    child.once('exit', exited)
  })
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  await new Promise(resolveExit => {
    const timeout = setTimeout(() => child.kill('SIGKILL'), 3_000)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolveExit()
    })
    child.kill('SIGTERM')
  })
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('timed out waiting for grant state')
    await new Promise(resolveDelay => setTimeout(resolveDelay, 25))
  }
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
    '.json': 'application/json',
    '.mp3': 'audio/mpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  })[extname(path)] || 'application/octet-stream'
}

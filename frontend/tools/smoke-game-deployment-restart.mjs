import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { chromium } from 'playwright-core'

const frontendRoot = resolve(import.meta.dirname, '..')
const repositoryRoot = resolve(frontendRoot, '..')
const currentRevision = execFileSync(
  'git',
  ['rev-parse', '--verify', 'HEAD'],
  { cwd: repositoryRoot, encoding: 'utf8' },
).trim().toLowerCase()
const targetRevision = currentRevision[0] === 'f' ? 'e'.repeat(40) : 'f'.repeat(40)
const baseUrl = 'http://127.0.0.1:4187'
const backendUrl = 'http://127.0.0.1:5210'
const adminSecret = 'deployment-smoke-supervisor-secret-0123456789'
const storageRoot = await mkdtemp(`${tmpdir()}/solomon-deployment-smoke-`)
const children = []
let browser = null

try {
  const backend = startProcess(
    process.env.SDR_DOTNET || resolve(homedir(), '.dotnet/dotnet'),
    ['run', '--project', '../backend/Server.csproj', '--configuration', 'Release', '--no-build'],
    {
      ASPNETCORE_ENVIRONMENT: 'Development',
      ASPNETCORE_URLS: backendUrl,
      Jwt__Secret: 'deployment-smoke-jwt-secret-that-is-long-enough-0123456789',
      Storage__Root: storageRoot,
    },
  )
  children.push(backend)
  await waitForHttp(`${backendUrl}/api/game/saves/0`, 401)
  const vite = startProcess(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4187', '--strictPort'],
  )
  children.push(vite)
  await waitForHttp(`${baseUrl}/game`, 200)
  browser = await chromium.launch({
    executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
    headless: true,
  })
  const anonymous = await exercisePlayer({ account: null, label: 'anonymous' })
  const username = `DeploySmoke${Date.now()}`
  const password = 'Deployment-smoke-password-42!'
  const token = await registerAccount(username, password)
  const authenticated = await exercisePlayer({
    account: { token, username },
    label: 'authenticated',
  })
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    currentRevision,
    targetRevision,
    anonymous,
    authenticated,
  })}\n`)
} finally {
  await browser?.close()
  await Promise.all(children.reverse().map(stopProcess))
  await rm(storageRoot, { recursive: true })
}

async function exercisePlayer({ account, label }) {
  const supervisor = await startSupervisor()
  children.push(supervisor.child)
  try {
    const ticket = await issueHubTicket(supervisor.url)
    const endpoint = new URL('/game-hub', supervisor.url)
    endpoint.protocol = 'ws:'
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
    await context.addInitScript(({ credential, gameUrl, token }) => {
      window.solomonDarkRuntime = {
        gameEndpoint: { kind: 'localhost', credential, url: gameUrl },
      }
      if (token) localStorage.setItem('sdr.token', token)
    }, {
      credential: ticket.credential,
      gameUrl: endpoint.toString(),
      token: account?.token ?? null,
    })
    const page = await context.newPage()
    let manifestRevision = currentRevision
    await page.route('**/deployment.json*', route => route.fulfill({
      body: JSON.stringify({ revision: manifestRevision }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    }))
    const pageErrors = []
    const consoleErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
    await page.getByRole('button', { name: 'Play' }).click()
    await page.getByRole('button', { name: 'New game' }).click()
    await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
      timeout: 30_000,
    })
    await page.getByRole('button', { name: /fire/i }).click()
    await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
      timeout: 15_000,
    })
    await page.locator('.create-menu-discipline-arcane').click()
    const canvas = page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]')
    await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
    await canvas.waitFor({ timeout: 30_000 })
    const initialSave = await waitForSave(page, account, record => record?.revision >= 1)
    const initialTick = JSON.parse(initialSave.document).summary.savedAtTick
    await page.keyboard.down('d')
    await page.waitForTimeout(600)
    await page.keyboard.up('d')

    const drainResponse = fetch(`${supervisor.url}/admin/deployments/restart`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminSecret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ targetRevision }),
    })
    const updatePanel = page.locator('.game-deployment-update')
    await updatePanel.getByRole('heading', { name: 'Game updating' }).waitFor({ timeout: 10_000 })
    const drain = await drainResponse
    assert.equal(drain.status, 200)
    const receipt = await drain.json()
    assert.deepEqual(receipt, {
      status: 'ready',
      players: 1,
      savedPlayers: 1,
      targetRevision,
      unacknowledgedPlayers: 0,
    })
    await updatePanel.getByText(/Your game is saved/).waitFor({ timeout: 10_000 })
    const screenshotPath = `/tmp/solomon-deployment-update-${label}.png`
    await page.screenshot({ path: screenshotPath })
    const finalSave = await waitForSave(
      page,
      account,
      record => record?.revision > initialSave.revision,
    )
    const finalTick = JSON.parse(finalSave.document).summary.savedAtTick
    assert.ok(finalTick >= initialTick)

    const reloaded = page.waitForEvent('framenavigated', frame => (
      frame === page.mainFrame() && new URL(frame.url()).pathname === '/game'
    ))
    manifestRevision = targetRevision
    await reloaded
    manifestRevision = currentRevision
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
    await page.getByRole('button', { name: 'Play' }).click()
    assert.equal(await page.getByRole('button', { name: 'Last game' }).isEnabled(), true)
    assert.deepEqual(pageErrors, [])
    assert.deepEqual(consoleErrors, [])
    await context.close()
    return {
      finalRevision: finalSave.revision,
      finalTick,
      initialRevision: initialSave.revision,
      initialTick,
      label,
      screenshotPath,
      updateMessage: 'Game updating',
    }
  } finally {
    const index = children.indexOf(supervisor.child)
    if (index >= 0) children.splice(index, 1)
    await stopProcess(supervisor.child)
  }
}

async function startSupervisor() {
  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', 'src/game/host/run-game-session-supervisor.ts'],
    {
      cwd: frontendRoot,
      env: {
        ...process.env,
        SDR_GAME_ALLOWED_ORIGINS: baseUrl,
        SDR_GAME_LOG_LEVEL: 'warning',
        SDR_GAME_ML_BOT_CHECKPOINT: 'server-assets/ml-bot-policy-v5-selected.sdml',
        SDR_GAME_SUPERVISOR_HOST: '127.0.0.1',
        SDR_GAME_SUPERVISOR_PORT: '0',
        SDR_GAME_SUPERVISOR_SECRET: adminSecret,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  try {
    const message = await readReadyLine(child)
    return { child, url: message.url }
  } catch (error) {
    await stopProcess(child)
    throw error
  }
}

async function issueHubTicket(supervisorUrl) {
  const response = await fetch(`${supervisorUrl}/admin/hub/tickets`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${adminSecret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      content: { manifestSha256: '0'.repeat(64), mods: [] },
      leaderboardUserId: null,
    }),
  })
  assert.equal(response.status, 201)
  return response.json()
}

async function waitForSave(page, account, predicate) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const record = account
      ? await page.evaluate(async (token) => {
          const response = await fetch('/api/game/saves/0', {
            headers: { authorization: `Bearer ${token}` },
          })
          if (!response.ok) throw new Error(`cloud save read failed (${response.status})`)
          return response.json().then(value => value.save)
        }, account.token)
      : await page.evaluate(() => new Promise((resolveSave, reject) => {
          const open = indexedDB.open('solomon-dark-game-saves', 1)
          open.onerror = () => reject(open.error)
          open.onsuccess = () => {
            const request = open.result.transaction('slots', 'readonly').objectStore('slots').get(0)
            request.onerror = () => reject(request.error)
            request.onsuccess = () => resolveSave(request.result ?? null)
          }
        }))
    if (predicate(record)) return record
    await page.waitForTimeout(100)
  }
  throw new Error(`timed out waiting for ${account ? 'cloud' : 'IndexedDB'} save`)
}

async function registerAccount(username, password) {
  const response = await fetch(`${backendUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: `${username.toLowerCase()}@example.invalid`,
      password,
      username,
    }),
  })
  assert.equal(response.status, 201)
  return (await response.json()).token
}

function startProcess(command, arguments_, extraEnvironment = {}) {
  return spawn(command, arguments_, {
    cwd: frontendRoot,
    env: { ...process.env, ...extraEnvironment },
    stdio: 'ignore',
  })
}

function readReadyLine(child) {
  return new Promise((resolveReady, reject) => {
    let stdout = ''
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => { stderr += chunk })
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      const newline = stdout.indexOf('\n')
      if (newline < 0) return
      try {
        const message = JSON.parse(stdout.slice(0, newline))
        if (message.type !== 'ready' || typeof message.url !== 'string') {
          throw new Error('supervisor emitted invalid readiness data')
        }
        resolveReady(message)
      } catch (error) {
        reject(error)
      }
    })
    child.once('exit', (code, signal) => {
      reject(new Error(`supervisor exited before ready (${code ?? signal}); ${stderr}`))
    })
  })
}

async function waitForHttp(url, expectedStatus) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.status === expectedStatus) return
    } catch {
      // The process is still starting.
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 100))
  }
  throw new Error(`timed out waiting for ${url}`)
}

function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  return new Promise((resolveStop) => {
    const force = setTimeout(() => child.kill('SIGKILL'), 5_000)
    child.once('exit', () => {
      clearTimeout(force)
      resolveStop()
    })
    child.kill('SIGTERM')
  })
}

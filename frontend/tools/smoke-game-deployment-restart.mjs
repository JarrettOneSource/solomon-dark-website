import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { basename, resolve } from 'node:path'

import { chromium } from 'playwright-core'

const frontendRoot = resolve(import.meta.dirname, '..')
const repositoryRoot = resolve(frontendRoot, '..')
const currentRevision = execFileSync(
  'git',
  ['rev-parse', '--verify', 'HEAD'],
  { cwd: repositoryRoot, encoding: 'utf8' },
).trim().toLowerCase()
const targetRevision = currentRevision[0] === 'f' ? 'e'.repeat(40) : 'f'.repeat(40)
const baseUrl = loopbackOrigin(
  process.env.SDR_GAME_DEPLOYMENT_SMOKE_URL ?? 'http://127.0.0.1:4187',
  'browser',
)
const backendUrl = loopbackOrigin(
  process.env.SDR_GAME_DEPLOYMENT_SMOKE_BACKEND_URL ?? 'http://127.0.0.1:5210',
  'backend',
)
const frontendAddress = new URL(baseUrl)
const frontendRequiresVite = frontendAddress.origin !== new URL(backendUrl).origin
const smokeScope = process.env.SDR_GAME_DEPLOYMENT_SMOKE_SCOPE || 'all'
if (!['all', 'legacy', 'primary'].includes(smokeScope)) {
  throw new Error('SDR_GAME_DEPLOYMENT_SMOKE_SCOPE must be all, legacy, or primary')
}
const legacySavePaths = (process.env.SDR_GAME_DEPLOYMENT_LEGACY_SAVES || '')
  .split(',')
  .map(path => path.trim())
  .filter(Boolean)
const adminSecret = 'deployment-smoke-supervisor-secret-0123456789'
const storageRoot = await mkdtemp(`${tmpdir()}/solomon-deployment-smoke-`)
const children = []
let browser = null

try {
  const backend = startProcess(
    process.env.SDR_DOTNET || resolve(homedir(), '.dotnet/dotnet'),
    [resolve(repositoryRoot, 'backend/bin/Release/net10.0/Server.dll')],
    {
      ASPNETCORE_ENVIRONMENT: 'Development',
      ASPNETCORE_URLS: backendUrl,
      Jwt__Secret: 'deployment-smoke-jwt-secret-that-is-long-enough-0123456789',
      Storage__Root: storageRoot,
    },
    resolve(repositoryRoot, 'backend'),
  )
  children.push(backend)
  await waitForHttp(`${backendUrl}/api/game/saves/0`, 401)
  if (frontendRequiresVite) {
    const vite = startProcess(
      process.execPath,
      [
        'node_modules/vite/bin/vite.js',
        '--host',
        frontendAddress.hostname,
        '--port',
        frontendAddress.port,
        '--strictPort',
      ],
      { SDR_VITE_BACKEND_URL: backendUrl },
    )
    children.push(vite)
  }
  await waitForHttp(`${baseUrl}/game`, 200)
  browser = await chromium.launch({
    executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
    headless: true,
  })
  let anonymous = null
  let authenticated = null
  let profileOnly = null
  let killedWizard = null
  if (smokeScope !== 'legacy') {
    const anonymousRun = await exercisePlayer({ account: null, label: 'anonymous' })
    const { finalDocument, ...anonymousReceipt } = anonymousRun
    anonymous = anonymousReceipt
    const username = `DeploySmoke${Date.now()}`
    const password = 'Deployment-smoke-password-42!'
    const token = await registerAccount(username, password)
    const authenticatedRun = await exercisePlayer({
      account: { token, username },
      label: 'authenticated',
    })
    const { finalDocument: _authenticatedDocument, ...authenticatedReceipt } = authenticatedRun
    authenticated = authenticatedReceipt
    const profileDocument = JSON.parse(finalDocument)
    profileDocument.continuation = null
    profileDocument.profile.economy.gold = 12_345
    profileDocument.profile.economy.unforgeBonuses.maximumHealth = 20
    profileOnly = await exerciseProfileOnly(JSON.stringify(profileDocument))
    killedWizard = await exerciseKilledWizard(finalDocument)
  }
  const legacyResumes = []
  if (smokeScope !== 'primary') {
    for (const path of legacySavePaths) {
      legacyResumes.push(await exerciseHistoricalSave(
        await readFile(path, 'utf8'),
        basename(path, '.json'),
      ))
    }
  }
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    smokeScope,
    currentRevision,
    targetRevision,
    anonymous,
    authenticated,
    killedWizard,
    profileOnly,
    legacyResumes,
  })}\n`)
} finally {
  await browser?.close()
  await Promise.all(children.reverse().map(stopProcess))
  await rm(storageRoot, { recursive: true })
}

function loopbackOrigin(value, label) {
  const parsed = new URL(value)
  if (
    parsed.protocol !== 'http:'
    || parsed.hostname !== '127.0.0.1'
    || parsed.port.length === 0
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
  ) throw new Error(`${label} smoke URL must be an explicit loopback HTTP origin`)
  return parsed.origin
}

async function exercisePlayer({ account, label }) {
  const supervisor = await startSupervisor()
  let replacementSupervisor = null
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
    if (account) await routeBackendApi(page)
    let manifestRevision = currentRevision
    await page.route('**/deployment.json*', route => route.fulfill({
      body: JSON.stringify({ revision: manifestRevision }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    }))
    const pageErrors = []
    const consoleErrors = []
    const failedResponses = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('response', response => {
      if (response.status() >= 400) failedResponses.push({
        status: response.status(),
        url: response.url(),
      })
    })

    await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
    try {
      await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
    } catch (error) {
      throw new Error(`${label} title did not become ready: ${JSON.stringify({
        body: (await page.locator('body').innerText()).slice(0, 2_000),
        consoleErrors,
        failedResponses,
        pageErrors,
        url: page.url(),
      })}`, { cause: error })
    }
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
    const initialDocument = JSON.parse(initialSave.document)
    assert.equal(initialDocument.continuation.summary.activeRun, false)
    const initialTick = initialDocument.continuation.summary.savedAtTick
    const initialX = initialDocument.continuation.simulation
      .playerEntities.locomotions[0].position.x
    await page.getByRole('button', { name: 'Open inventory, 500 gold' }).waitFor({
      timeout: 30_000,
    })
    await page.keyboard.down('d')
    await page.waitForTimeout(600)
    await page.keyboard.up('d')

    const drainResponse = fetchWithRetry(`${supervisor.url}/admin/deployments/restart`, {
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
    const finalDocument = JSON.parse(finalSave.document)
    assert.equal(finalDocument.continuation.summary.activeRun, false)
    const finalTick = finalDocument.continuation.summary.savedAtTick
    const finalX = finalDocument.continuation.simulation
      .playerEntities.locomotions[0].position.x
    assert.ok(finalTick >= initialTick)

    replacementSupervisor = await startSupervisor()
    children.push(replacementSupervisor.child)
    const replacementTicket = await issueHubTicket(replacementSupervisor.url)
    const replacementEndpoint = new URL('/game-hub', replacementSupervisor.url)
    replacementEndpoint.protocol = 'ws:'

    const reloaded = page.waitForEvent('framenavigated', frame => (
      frame === page.mainFrame() && new URL(frame.url()).pathname === '/game'
    ))
    manifestRevision = targetRevision
    await reloaded
    manifestRevision = currentRevision
    await page.evaluate(({ credential, url }) => {
      window.solomonDarkRuntime = {
        gameEndpoint: { kind: 'localhost', credential, url },
      }
    }, {
      credential: replacementTicket.credential,
      url: replacementEndpoint.toString(),
    })
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
    await page.getByRole('button', { name: 'Play' }).click()
    const lastGame = page.getByRole('button', { name: 'Last game' })
    await page.locator('.main-menu-button-last-game:not(:disabled)')
      .waitFor({ timeout: 30_000 })
    assert.equal(await lastGame.isEnabled(), true)
    await page.locator('.title-menu-canvas[data-can-resume="true"]')
      .waitFor({ timeout: 30_000 })
    await page.getByRole('button', { name: 'New game' }).click()
    const activeWizardDialog = page.getByRole('dialog', {
      name: 'Resume or kill the current wizard',
    })
    await activeWizardDialog.waitFor({ timeout: 10_000 })
    await activeWizardDialog.getByText('KILL CHARACTER?').waitFor()
    await activeWizardDialog.getByText(/Lucritius will scavenge his equipment/).waitFor()
    const promptScreenshotPath = `/tmp/solomon-active-wizard-${label}.png`
    await page.screenshot({ path: promptScreenshotPath })
    await activeWizardDialog.getByRole('button', { name: 'Resume Last Game' }).click()
    const resumedCanvas = page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]')
    await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
    await resumedCanvas.waitFor({ timeout: 30_000 })
    const resumed = await resumedCanvas.evaluate(node => ({
      tick: node.__sdrHubFrame.tick,
      x: node.__sdrHubFrame.playerX,
      y: node.__sdrHubFrame.playerY,
    }))
    assert.ok(Math.abs(resumed.x - 950.64) < 0.01, JSON.stringify({ finalX, initialX, resumed }))
    assert.ok(Math.abs(resumed.y - 164.04) < 0.01, JSON.stringify({ finalX, initialX, resumed }))
    const resumedDrainResponse = fetchWithRetry(`${replacementSupervisor.url}/admin/deployments/restart`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminSecret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ targetRevision }),
    })
    await page.locator('.game-deployment-update').getByText(/Your game is saved/)
      .waitFor({ timeout: 10_000 })
    const resumedDrain = await resumedDrainResponse
    assert.equal(resumedDrain.status, 200)
    const resumedReceipt = await resumedDrain.json()
    assert.equal(resumedReceipt.savedPlayers, 1)
    assert.equal(resumedReceipt.unacknowledgedPlayers, 0)
    const resumedSave = await waitForSave(
      page,
      account,
      record => record?.revision > finalSave.revision,
    )
    assert.equal(JSON.parse(resumedSave.document).continuation.summary.activeRun, false)
    assert.deepEqual(pageErrors, [])
    assert.deepEqual(failedResponses, [])
    assert.deepEqual(consoleErrors, [])
    await context.close()
    return {
      finalRevision: finalSave.revision,
      finalDocument: finalSave.document,
      finalTick,
      initialRevision: initialSave.revision,
      initialTick,
      initialX,
      label,
      resumedTick: resumed.tick,
      resumedX: resumed.x,
      resumedY: resumed.y,
      resumedRevision: resumedSave.revision,
      resumedSavedPlayers: resumedReceipt.savedPlayers,
      promptScreenshotPath,
      screenshotPath,
      updateMessage: 'Game updating',
    }
  } finally {
    for (const owned of [replacementSupervisor, supervisor]) {
      if (!owned) continue
      const index = children.indexOf(owned.child)
      if (index >= 0) children.splice(index, 1)
      await stopProcess(owned.child)
    }
  }
}

async function exerciseKilledWizard(document) {
  const supervisor = await startSupervisor()
  children.push(supervisor.child)
  try {
    const ticket = await issueHubTicket(supervisor.url)
    const endpoint = new URL('/game-hub', supervisor.url)
    endpoint.protocol = 'ws:'
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
    await context.addInitScript(({ credential, gameUrl }) => {
      window.solomonDarkRuntime = {
        gameEndpoint: { kind: 'localhost', credential, url: gameUrl },
      }
    }, { credential: ticket.credential, gameUrl: endpoint.toString() })
    const page = await context.newPage()
    const consoleErrors = []
    const failedResponses = []
    const pageErrors = []
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('response', response => {
      if (response.status() >= 400) failedResponses.push({
        status: response.status(),
        url: response.url(),
      })
    })
    await page.route('**/deployment.json*', route => route.fulfill({
      body: JSON.stringify({ revision: currentRevision }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    }))

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await seedLocalSave(page, document)
    await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
    await page.getByRole('button', { name: 'Play' }).click()
    await page.getByRole('button', { name: 'New game' }).click()
    const dialog = page.getByRole('dialog', { name: 'Resume or kill the current wizard' })
    await dialog.waitFor({ timeout: 10_000 })
    const promptScreenshotPath = '/tmp/solomon-kill-wizard-prompt.png'
    await page.screenshot({ path: promptScreenshotPath })
    await dialog.getByRole('button', { name: 'Kill Wizard' }).click()
    await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
      timeout: 30_000,
    })
    const retired = await waitForSave(page, null, record => (
      record?.revision >= 2 && JSON.parse(record.document).continuation === null
    ))
    const retiredDocument = JSON.parse(retired.document)
    assert.equal(retiredDocument.profile.economy.gold, 500)
    assert.equal(retiredDocument.profile.economy.storage.at(-1)?.kind, 'sack')
    assert.equal(retiredDocument.profile.economy.storage.at(-1)?.contents.length, 5)
    const screenshotPath = '/tmp/solomon-kill-wizard-create.png'
    await page.screenshot({ path: screenshotPath })
    assert.deepEqual(pageErrors, [])
    assert.deepEqual(consoleErrors, [])
    assert.deepEqual(failedResponses, [])
    await context.close()
    return {
      gold: retiredDocument.profile.economy.gold,
      retainedItems: retiredDocument.profile.economy.storage.at(-1)?.contents.length,
      revision: retired.revision,
      promptScreenshotPath,
      screenshotPath,
    }
  } finally {
    const index = children.indexOf(supervisor.child)
    if (index >= 0) children.splice(index, 1)
    await stopProcess(supervisor.child)
  }
}

async function exerciseProfileOnly(document) {
  const supervisor = await startSupervisor()
  children.push(supervisor.child)
  try {
    const ticket = await issueHubTicket(supervisor.url)
    const endpoint = new URL('/game-hub', supervisor.url)
    endpoint.protocol = 'ws:'
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
    await context.addInitScript(({ credential, gameUrl }) => {
      window.solomonDarkRuntime = {
        gameEndpoint: { kind: 'localhost', credential, url: gameUrl },
      }
    }, { credential: ticket.credential, gameUrl: endpoint.toString() })
    const page = await context.newPage()
    const consoleErrors = []
    const failedResponses = []
    const pageErrors = []
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('response', response => {
      if (response.status() >= 400) failedResponses.push({
        status: response.status(),
        url: response.url(),
      })
    })
    await page.route('**/deployment.json*', route => route.fulfill({
      body: JSON.stringify({ revision: currentRevision }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    }))

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await seedLocalSave(page, document)
    await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
    await page.getByRole('button', { name: 'Play' }).click()
    const lastGame = page.getByRole('button', { name: 'Last game' })
    assert.equal(await lastGame.isDisabled(), true)
    await page.getByRole('button', { name: 'New game' }).click()
    await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
      timeout: 30_000,
    })
    await page.getByRole('button', { name: /fire/i }).click()
    await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
      timeout: 15_000,
    })
    await page.locator('.create-menu-discipline-arcane').click()
    await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Open inventory, 12345 gold' }).waitFor({
      timeout: 30_000,
    })
    const screenshotPath = '/tmp/solomon-profile-only-new-game.png'
    await page.screenshot({ path: screenshotPath })
    assert.deepEqual(pageErrors, [])
    assert.deepEqual(consoleErrors, [])
    assert.deepEqual(failedResponses, [])
    await context.close()
    return { gold: 12_345, lastGameDisabled: true, screenshotPath }
  } finally {
    const index = children.indexOf(supervisor.child)
    if (index >= 0) children.splice(index, 1)
    await stopProcess(supervisor.child)
  }
}

async function exerciseHistoricalSave(document, label) {
  const supervisor = await startSupervisor()
  children.push(supervisor.child)
  try {
    const parsed = JSON.parse(document)
    const ticket = parsed.schemaVersion < 4
      ? await issuePrivateTicket(supervisor.url)
      : await issueHubTicket(supervisor.url)
    const endpoint = new URL(ticket.path, supervisor.url)
    endpoint.protocol = 'ws:'
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
    await context.addInitScript(({ credential, gameUrl }) => {
      window.solomonDarkRuntime = {
        gameEndpoint: { kind: 'localhost', credential, url: gameUrl },
      }
    }, { credential: ticket.credential, gameUrl: endpoint.toString() })
    const page = await context.newPage()
    const consoleErrors = []
    const failedResponses = []
    const pageErrors = []
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('response', response => {
      if (response.status() >= 400) failedResponses.push({
        status: response.status(),
        url: response.url(),
      })
    })
    await page.route('**/deployment.json*', route => route.fulfill({
      body: JSON.stringify({ revision: currentRevision }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    }))

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await seedLocalSave(page, document)
    await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
    await page.getByRole('button', { name: 'Play' }).click()
    const lastGame = page.getByRole('button', { name: 'Last game' })
    await page.locator('.main-menu-button-last-game:not(:disabled)')
      .waitFor({ timeout: 30_000 })
    assert.equal(await lastGame.isEnabled(), true)
    await lastGame.click()
    const scene = parsed.summary.worldKind === 'boneyard'
      ? '.boneyard-scene[data-renderer-state="ready"]'
      : '.hub-scene[data-renderer-state="ready"]'
    try {
      await page.locator(scene).waitFor({ timeout: 90_000 })
    } catch (error) {
      throw new Error(`historical save ${label} did not resume: ${JSON.stringify({
        body: await page.locator('body').innerText(),
        consoleErrors,
        failedResponses,
        pageErrors,
      })}`, { cause: error })
    }
    const migrated = await waitForSave(page, null, record => record?.revision > 1)
    const migratedSummary = JSON.parse(migrated.document).continuation.summary
    assert.equal(migratedSummary.activeRun, parsed.summary.worldKind === 'boneyard')
    let resumedHubPosition = null
    if (parsed.summary.worldKind === 'hub') {
      resumedHubPosition = await page.locator('.hub-world-canvas').evaluate(node => ({
        x: node.__sdrHubFrame.playerX,
        y: node.__sdrHubFrame.playerY,
      }))
      assert.ok(Math.abs(resumedHubPosition.x - 950.64) < 0.01)
      assert.ok(Math.abs(resumedHubPosition.y - 164.04) < 0.01)
    }
    const screenshotPath = `/tmp/solomon-${label}-resume.png`
    await page.screenshot({ path: screenshotPath })
    assert.deepEqual(pageErrors, [])
    assert.deepEqual(consoleErrors, [])
    assert.deepEqual(failedResponses, [])
    await context.close()
    return {
      label,
      activeRun: migratedSummary.activeRun,
      resumedHubPosition,
      schemaVersion: parsed.schemaVersion,
      screenshotPath,
      worldKind: parsed.summary.worldKind,
    }
  } finally {
    const index = children.indexOf(supervisor.child)
    if (index >= 0) children.splice(index, 1)
    await stopProcess(supervisor.child)
  }
}

async function seedLocalSave(page, document) {
  await page.evaluate(async (saveDocument) => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('solomon-dark-game-saves', 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('slots')) {
          request.result.createObjectStore('slots', { keyPath: 'slot' })
        }
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('slots', 'readwrite')
      transaction.objectStore('slots').put({
        document: saveDocument,
        formatVersion: JSON.parse(saveDocument).schemaVersion,
        revision: 1,
        sha256: '0'.repeat(64),
        slot: 0,
        updatedAtUtc: new Date().toISOString(),
      })
      transaction.onabort = () => reject(transaction.error)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  }, document)
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
        SDR_GAME_ML_BOT_CHECKPOINT: 'server-assets/ml-bot-policy-v6-selected.sdml',
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
  const response = await fetchWithRetry(`${supervisorUrl}/admin/hub/tickets`, {
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

async function issuePrivateTicket(supervisorUrl) {
  const response = await fetchWithRetry(`${supervisorUrl}/admin/sessions`, {
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
      ? await fetchWithRetry(`${backendUrl}/api/game/saves/0`, {
          headers: { authorization: `Bearer ${account.token}` },
        }).then(async (response) => {
          if (!response.ok) throw new Error(`cloud save read failed (${response.status})`)
          return (await response.json()).save
        })
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

async function routeBackendApi(page) {
  await page.route('**/api/**', async (route) => {
    const target = new URL(route.request().url())
    const backend = new URL(backendUrl)
    target.protocol = backend.protocol
    target.host = backend.host
    let lastError = null
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const response = await route.fetch({ url: target.toString() })
        await route.fulfill({ response })
        return
      } catch (error) {
        lastError = error
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    await route.abort('connectionfailed')
    throw lastError
  })
}

async function registerAccount(username, password) {
  const response = await fetchWithRetry(`${backendUrl}/api/auth/register`, {
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

function startProcess(
  command,
  arguments_,
  extraEnvironment = {},
  workingDirectory = frontendRoot,
) {
  return spawn(command, arguments_, {
    cwd: workingDirectory,
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

async function fetchWithRetry(url, options) {
  let lastError = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await fetch(url, options)
    } catch (error) {
      lastError = error
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  throw lastError
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

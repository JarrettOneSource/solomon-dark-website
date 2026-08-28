import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

import { chromium } from 'playwright-core'

import {
  createStoredZip,
  readNativeSaveArchive,
  readZip,
} from '../src/game/save/native-save-archive.ts'
import {
  decodeNativeDarkdataProfile,
  decodeNativeGamestateWizard,
} from '../src/game/save/native-save-bridge.ts'
import { parseNativeSyncBuffer } from '../src/game/save/native-save-codec.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

const baseUrl = process.env.SDR_NATIVE_SAVE_SMOKE_URL || 'http://127.0.0.1:4187'
const chromePath = process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome'
const screenshotRoot = process.env.SDR_NATIVE_SAVE_SMOKE_SCREENSHOT_ROOT || '/tmp'
const localCredential = 'native-save-browser-parity'
const localHost = new URL(baseUrl).protocol === 'https:'
  ? null
  : await startGameHost({
      allowedOrigins: [new URL(baseUrl).origin],
      authentication: { credential: localCredential, kind: 'shared' },
      snapshotRate: 100,
    })
const runtime = localHost
  ? {
      gameEndpoint: {
        credential: localCredential,
        kind: 'localhost',
        url: localHost.address.url,
      },
    }
  : null
await mkdir(screenshotRoot, { recursive: true })
const fixture = JSON.parse(await readFile(
  new URL('../public/game/native/portable-profile-template.json', import.meta.url),
  'utf8',
))
const templateGamestate = Buffer.from(fixture.files.gamestate.base64, 'base64')
const sourceZipPath = process.env.SDR_NATIVE_SAVE_SOURCE_ZIP
let stockArchive
let gamestate
if (sourceZipPath) {
  stockArchive = new Uint8Array(await readFile(sourceZipPath))
  const files = [...(await readZip(stockArchive)).entries()]
  assert.equal(files.length, 1)
  assert.equal(files[0][0].split('/').at(-1).toLowerCase(), 'gamestate.sav')
  gamestate = files[0][1]
} else {
  gamestate = new Uint8Array(templateGamestate)
  stockArchive = createStoredZip([{ bytes: gamestate, path: 'gamestate.sav' }])
}
const expectedWizard = decodeNativeGamestateWizard(gamestate)
const expectedLearnedRows = expectedWizard.rows
  .filter(row => row.permanentRank > 0).length
const expectedEffectiveOnlyRows = expectedWizard.learnedOrder.filter(skillId => (
  expectedWizard.rows[skillId]?.permanentRank === 0
  && expectedWizard.rows[skillId]?.effectiveRank > 0
))
const expectedGamestateSha256 = createHash('sha256').update(gamestate).digest('hex')
const expectedBindingIntegerCount = bindingIntegerCount(gamestate)
const elementName = ['Ether', 'Fire', 'Air', 'Water', 'Earth'][expectedWizard.elementRoot]
const disciplineName = ({ 5: 'Body', 6: 'Mind', 7: 'Arcane' })[expectedWizard.disciplineRoot]
assert.ok(elementName)
assert.ok(disciplineName)
const stockUpload = {
  buffer: Buffer.from(stockArchive),
  mimeType: 'application/zip',
  name: sourceZipPath ? 'SolomonDarkStockSaveWaterMage.zip' : 'controlled-standalone-save.zip',
}

const accountUsername = process.env.SDR_NATIVE_SAVE_SMOKE_USERNAME
  || `SavePort${Date.now().toString(36).slice(-7)}`
const accountPassword = process.env.SDR_NATIVE_SAVE_SMOKE_PASSWORD
  || `SdrSave!${crypto.randomUUID()}`
const accountToken = await registerSmokeAccount(accountUsername, accountPassword)
const browser = await chromium.launch({ executablePath: chromePath, headless: true })

try {
  const anonymous = await runAnonymousJourney(browser)
  const cloud = await runCloudJourney(browser, accountToken)
  process.stdout.write(`${JSON.stringify({
    anonymous,
    cloud,
    fixture: {
      bindingIntegerCount: expectedBindingIntegerCount,
      effectiveOnlyRows: expectedEffectiveOnlyRows,
      gamestateSha256: expectedGamestateSha256,
      level: expectedWizard.level,
      wizardName: expectedWizard.name,
    },
    status: 'ok',
  })}\n`)
} finally {
  await Promise.all([
    browser.close(),
    localHost?.close(),
  ])
}

async function runAnonymousJourney(browser) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { height: 900, width: 1600 },
  })
  await mockDevelopmentDeployment(context)
  if (runtime) {
    await context.addInitScript((value) => {
      window.solomonDarkRuntime = value
    }, runtime)
  }
  const page = await context.newPage()
  const diagnostics = collectDiagnostics(page)
  try {
    await openGameTitle(page)
    await importFromTitleSettings(page)
    const imported = await readLocalSave(page)
    assertImportedWebSave(imported)

    await resumeLastGame(page)
    await returnToTitle(page)
    const persisted = await readLocalSave(page)
    assertImportedWebSave(persisted)
    assert.ok(persisted.revision >= imported.revision)

    const exported = await exportFromTitleSettings(page)
    await assertStockExport(exported)
    const archivePath = `${screenshotRoot}/solomon-dark-native-save-anonymous.zip`
    await writeFile(archivePath, exported)
    await page.getByRole('button', { name: 'BACK', exact: true }).click()
    await page.getByRole('button', { name: 'DONE', exact: true }).click()

    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForTitle(page)
    await resumeLastGame(page)
    await page.waitForTimeout(2_500)
    await page.screenshot({
      path: `${screenshotRoot}/solomon-dark-native-save-anonymous.png`,
    })
    assertCleanDiagnostics(diagnostics)
    return {
      exportedBytes: exported.byteLength,
      archivePath,
      importedRevision: imported.revision,
      previewScreenshot: `${screenshotRoot}/solomon-dark-native-save-anonymous-preview.png`,
      resumedRevision: persisted.revision,
      screenshot: `${screenshotRoot}/solomon-dark-native-save-anonymous.png`,
    }
  } finally {
    await context.close()
  }
}

async function runCloudJourney(browser, token) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { height: 900, width: 1600 },
  })
  await mockDevelopmentDeployment(context)
  if (runtime) {
    await context.addInitScript((value) => {
      window.solomonDarkRuntime = value
    }, runtime)
  }
  await context.addInitScript((value) => localStorage.setItem('sdr.token', value), token)
  const page = await context.newPage()
  const diagnostics = collectDiagnostics(page)
  try {
    await page.goto(`${baseUrl}/account`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: accountUsername }).waitFor({ timeout: 30_000 })
    await page.getByRole('heading', { name: 'Cloud Saves' }).waitFor()
    await page.getByRole('button', { name: /import stock save/i }).waitFor()
    await page.locator('input[type="file"][accept*=".zip"]').setInputFiles(stockUpload)
    const accountPreview = page.getByText(expectedWizard.name, { exact: true }).locator('..')
    await assertImportPreview(accountPreview)
    const previewScreenshot = `${screenshotRoot}/solomon-dark-native-save-cloud-preview.png`
    await page.screenshot({ path: previewScreenshot })
    const importResponse = page.waitForResponse(response => (
      response.request().method() === 'PUT'
      && new URL(response.url()).pathname === '/api/game/saves/0'
    ))
    await page.getByRole('button', { name: /write slot I|replace slot I/i }).click()
    assert.ok((await importResponse).ok())
    await page.getByText(/revision 1/).waitFor({ timeout: 15_000 })
    const imported = await readCloudSave(page, token)
    assertImportedWebSave(imported)

    await openGameTitle(page)
    await resumeLastGame(page)
    await returnToTitle(page)
    const persisted = await readCloudSave(page, token)
    assertImportedWebSave(persisted)
    assert.ok(persisted.revision >= imported.revision)

    await page.goto(`${baseUrl}/account`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Cloud Saves' }).waitFor({ timeout: 30_000 })
    const exported = await captureDownload(
      page,
      page.getByRole('button', { name: /export for stock/i }),
    )
    await assertStockExport(exported)
    const archivePath = `${screenshotRoot}/solomon-dark-native-save-cloud.zip`
    await writeFile(archivePath, exported)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByText(new RegExp(`revision ${persisted.revision}`)).waitFor({ timeout: 30_000 })
    await openGameTitle(page)
    await resumeLastGame(page)
    await page.waitForTimeout(2_500)
    await page.screenshot({
      path: `${screenshotRoot}/solomon-dark-native-save-cloud.png`,
    })
    assertCleanDiagnostics(diagnostics)
    return {
      exportedBytes: exported.byteLength,
      archivePath,
      importedRevision: imported.revision,
      previewScreenshot,
      resumedRevision: persisted.revision,
      screenshot: `${screenshotRoot}/solomon-dark-native-save-cloud.png`,
      username: accountUsername,
    }
  } finally {
    await context.close()
  }
}

async function openGameTitle(page) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await waitForTitle(page)
}

async function waitForTitle(page) {
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  const tutorial = page.locator('.stock-prompt-dialog[data-prompt-kind="tutorial"]')
  if (await tutorial.isVisible()) {
    await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
    await tutorial.waitFor({ state: 'detached' })
  }
}

async function openTitleSaveTransfer(page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('button', { name: 'STOCK / BROWSER SAVE', exact: true }).click()
  await page.locator('.game-settings-dialog[data-settings-page="save-transfer"]').waitFor()
}

async function importFromTitleSettings(page) {
  await openTitleSaveTransfer(page)
  await page.getByRole('button', { name: 'CHOOSE STOCK SAVE FILES', exact: true }).waitFor()
  await page.locator('.native-save-transfer-settings input[type="file"]').setInputFiles(stockUpload)
  await assertImportPreview(page.getByRole('region', { name: 'Stock import preview' }))
  await page.screenshot({
    path: `${screenshotRoot}/solomon-dark-native-save-anonymous-preview.png`,
  })
  await page.getByRole('button', { name: 'REPLACE BROWSER SLOT', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Stock progression imported' }).waitFor()
  await page.getByRole('button', { name: 'BACK', exact: true }).click()
  await page.getByRole('button', { name: 'DONE', exact: true }).click()
}

async function assertImportPreview(preview) {
  await preview.waitFor({ timeout: 30_000 })
  await assertContains(preview, expectedWizard.name)
  await assertContains(preview, `Level ${expectedWizard.level}`)
  await assertContains(preview, `${elementName} / ${disciplineName}`)
  await assertContains(preview, '500 gold')
  await assertContains(preview, `${expectedLearnedRows} learned rows`)
  await assertContains(preview, 'Only gamestate.sav was supplied')
  if (expectedEffectiveOnlyRows.length > 0) {
    await assertContains(preview, `row(s) ${expectedEffectiveOnlyRows.join(', ')}`)
  }
}

async function resumeLastGame(page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const lastGame = page.getByRole('button', { name: 'Last game', exact: true })
  assert.equal(await lastGame.isEnabled(), true)
  await lastGame.click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 45_000 })
  await page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]').waitFor()
}

async function returnToTitle(page) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await waitForTitle(page)
}

async function exportFromTitleSettings(page) {
  await openTitleSaveTransfer(page)
  return captureDownload(
    page,
    page.getByRole('button', { name: 'DOWNLOAD STOCK SAVE ARCHIVE', exact: true }),
  )
}

async function captureDownload(page, button) {
  const accept = async (dialog) => {
    await dialog.accept()
  }
  page.on('dialog', accept)
  try {
    const downloadEvent = page.waitForEvent('download')
    await button.click()
    const download = await downloadEvent
    const path = await download.path()
    assert.ok(path)
    return new Uint8Array(await readFile(path))
  } finally {
    page.off('dialog', accept)
  }
}

async function assertStockExport(bytes) {
  const archive = await readNativeSaveArchive(bytes)
  const profile = decodeNativeDarkdataProfile(archive.darkdata)
  const wizard = decodeNativeGamestateWizard(archive.gamestate)
  assert.equal(profile.gold, 500)
  assert.equal(wizard.name, expectedWizard.name)
  assert.equal(wizard.level, expectedWizard.level)
  assert.equal(wizard.elementRoot, expectedWizard.elementRoot)
  assert.equal(wizard.disciplineRoot, expectedWizard.disciplineRoot)
  assert.equal(wizard.rows.length, 83)
  assert.equal(bindingIntegerCount(archive.gamestate), expectedBindingIntegerCount)
}

function assertImportedWebSave(record) {
  assert.ok(record)
  const document = JSON.parse(record.document)
  assert.equal(document.integrity, 'local-only')
  assert.equal(document.continuation.simulation.world.kind, 'hub')
  assert.equal(
    document.continuation.simulation.playerEntities.configs[0].displayName,
    expectedWizard.name,
  )
  assert.equal(
    document.continuation.simulation.playerEntities.progressions[0].level,
    expectedWizard.level,
  )
  assert.equal(
    document.continuation.simulation.playerEntities.economies[0].gold,
    500,
  )
  assert.equal(document.nativeSource.darkdataSha256, fixture.files.darkdata.sha256)
  assert.equal(document.nativeSource.gamestateSha256, expectedGamestateSha256)
}

function bindingIntegerCount(bytes) {
  const binding = parseNativeSyncBuffer(bytes).root.children[1].children[0].payload
  const view = new DataView(binding.buffer, binding.byteOffset, binding.byteLength)
  const booleanCount = view.getUint32(0, true)
  return view.getUint32(4 + booleanCount, true)
}

async function assertContains(locator, expected) {
  assert.match((await locator.textContent()) || '', new RegExp(escapeRegExp(expected), 'i'))
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function collectDiagnostics(page) {
  const pageErrors = []
  const consoleErrors = []
  const failedResponses = []
  const requestFailures = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') {
      const location = message.location().url
      consoleErrors.push(`${message.text()}${location ? ` [${location}]` : ''}`)
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText ?? ''
    if (errorText === 'net::ERR_ABORTED') return
    requestFailures.push(`${request.method()} ${request.url()} ${errorText}`.trim())
  })
  return { consoleErrors, failedResponses, pageErrors, requestFailures }
}

function assertCleanDiagnostics(diagnostics) {
  assert.deepEqual(diagnostics.pageErrors, [])
  assert.deepEqual(diagnostics.consoleErrors, [])
  assert.deepEqual(diagnostics.failedResponses, [])
  assert.deepEqual(diagnostics.requestFailures, [])
}

function readLocalSave(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('solomon-dark-game-saves', 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const request = open.result.transaction('slots', 'readonly').objectStore('slots').get(0)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result ?? null)
    }
  }))
}

function readCloudSave(page, token) {
  return page.evaluate(async (bearer) => {
    const response = await fetch('/api/game/saves/0', {
      headers: { Authorization: `Bearer ${bearer}` },
    })
    if (!response.ok) throw new Error(`cloud save read failed (${response.status})`)
    return response.json().then(({ save }) => save)
  }, token)
}

async function registerSmokeAccount(username, password) {
  const response = await fetch(new URL('/api/auth/register', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: `${username.toLowerCase()}@example.invalid`,
      password,
      username,
    }),
  })
  const payload = await response.json()
  if (response.status !== 201 || typeof payload.token !== 'string') {
    throw new Error(`smoke account registration failed (${response.status})`)
  }
  return payload.token
}

async function mockDevelopmentDeployment(context) {
  await context.route('**/deployment.json?*', async (route) => {
    const revision = new URL(route.request().url()).searchParams.get('current')
    await route.fulfill({ json: { revision } })
  })
}

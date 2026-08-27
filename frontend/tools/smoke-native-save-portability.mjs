import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

import { chromium } from 'playwright-core'

import {
  createNativeSaveArchive,
  readNativeSaveArchive,
} from '../src/game/save/native-save-archive.ts'
import {
  decodeNativeDarkdataProfile,
  decodeNativeGamestateWizard,
} from '../src/game/save/native-save-bridge.ts'

const baseUrl = process.env.SDR_NATIVE_SAVE_SMOKE_URL || 'http://127.0.0.1:4187'
const chromePath = process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome'
const screenshotRoot = process.env.SDR_NATIVE_SAVE_SMOKE_SCREENSHOT_ROOT || '/tmp'
await mkdir(screenshotRoot, { recursive: true })
const fixture = JSON.parse(await readFile(
  new URL('../public/game/native/portable-profile-template.json', import.meta.url),
  'utf8',
))
const darkdata = Buffer.from(fixture.files.darkdata.base64, 'base64')
const gamestate = Buffer.from(fixture.files.gamestate.base64, 'base64')
const expectedLearnedRows = decodeNativeGamestateWizard(gamestate).rows
  .filter(row => row.permanentRank > 0).length
const stockArchive = await createNativeSaveArchive({
  darkdata,
  gamestate,
  runName: fixture.expected.runName,
})
const stockUpload = {
  buffer: Buffer.from(stockArchive),
  mimeType: 'application/zip',
  name: 'controlled-stock-save.zip',
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
      level: fixture.expected.level,
      wizardName: fixture.expected.wizardName,
    },
    status: 'ok',
  })}\n`)
} finally {
  await browser.close()
}

async function runAnonymousJourney(browser) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { height: 900, width: 1600 },
  })
  const page = await context.newPage()
  const diagnostics = collectDiagnostics(page)
  try {
    await openGameTitle(page)
    await importFromTitleSettings(page)
    const imported = await readLocalSave(page)
    assertImportedWebSave(imported)

    await resumeLastGame(page)
    await leaveHub(page)
    const checkpointed = await readLocalSave(page)
    assertImportedWebSave(checkpointed)
    assert.ok(checkpointed.revision > imported.revision)

    const exported = await exportFromTitleSettings(page)
    await assertStockExport(exported)
    const archivePath = `${screenshotRoot}/solomon-dark-native-save-anonymous.zip`
    await writeFile(archivePath, exported)
    await page.getByRole('button', { name: 'BACK', exact: true }).click()
    await page.getByRole('button', { name: 'DONE', exact: true }).click()

    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForTitle(page)
    await resumeLastGame(page)
    await page.screenshot({
      path: `${screenshotRoot}/solomon-dark-native-save-anonymous.png`,
    })
    assertCleanDiagnostics(diagnostics)
    return {
      exportedBytes: exported.byteLength,
      archivePath,
      importedRevision: imported.revision,
      resumedRevision: checkpointed.revision,
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
  await context.addInitScript((value) => localStorage.setItem('sdr.token', value), token)
  const page = await context.newPage()
  const diagnostics = collectDiagnostics(page)
  try {
    await page.goto(`${baseUrl}/account`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: accountUsername }).waitFor({ timeout: 30_000 })
    await page.getByRole('heading', { name: 'Cloud Saves' }).waitFor()
    await page.getByRole('button', { name: /import stock save/i }).waitFor()
    await page.locator('input[type="file"][accept*=".zip"]').setInputFiles(stockUpload)
    const accountPreview = page.getByText(fixture.expected.wizardName, { exact: true }).locator('..')
    await assertImportPreview(accountPreview)
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
    await leaveHub(page)
    const checkpointed = await readCloudSave(page, token)
    assertImportedWebSave(checkpointed)
    assert.ok(checkpointed.revision > imported.revision)

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
    await page.getByText(new RegExp(`revision ${checkpointed.revision}`)).waitFor({ timeout: 30_000 })
    await openGameTitle(page)
    await resumeLastGame(page)
    await page.screenshot({
      path: `${screenshotRoot}/solomon-dark-native-save-cloud.png`,
    })
    assertCleanDiagnostics(diagnostics)
    return {
      exportedBytes: exported.byteLength,
      archivePath,
      importedRevision: imported.revision,
      resumedRevision: checkpointed.revision,
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
  await page.getByRole('button', { name: 'REPLACE BROWSER SLOT', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Stock progression imported' }).waitFor()
  await page.getByRole('button', { name: 'BACK', exact: true }).click()
  await page.getByRole('button', { name: 'DONE', exact: true }).click()
}

async function assertImportPreview(preview) {
  await preview.waitFor({ timeout: 30_000 })
  await assertContains(preview, fixture.expected.wizardName)
  await assertContains(preview, `Level ${fixture.expected.level}`)
  await assertContains(preview, 'Fire / Arcane')
  await assertContains(preview, '500 gold')
  await assertContains(preview, `${expectedLearnedRows} learned rows`)
}

async function resumeLastGame(page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const lastGame = page.getByRole('button', { name: 'Last game', exact: true })
  assert.equal(await lastGame.isEnabled(), true)
  await lastGame.click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 45_000 })
  await page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]').waitFor()
}

async function leaveHub(page) {
  await page.locator('.hub-scene').focus()
  await page.keyboard.press('Escape')
  const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await pause.waitFor({ timeout: 10_000 })
  await pause.getByRole('button', { name: 'LEAVE GAME', exact: true }).click()
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
  assert.equal(wizard.name, fixture.expected.wizardName)
  assert.equal(wizard.level, fixture.expected.level)
  assert.equal(wizard.elementRoot, fixture.expected.elementRoot)
  assert.equal(wizard.disciplineRoot, fixture.expected.disciplineRoot)
  assert.equal(wizard.rows.length, fixture.expected.progressionRows)
}

function assertImportedWebSave(record) {
  assert.ok(record)
  const document = JSON.parse(record.document)
  assert.equal(document.integrity, 'local-only')
  assert.equal(document.continuation.simulation.world.kind, 'hub')
  assert.equal(
    document.continuation.simulation.playerEntities.configs[0].displayName,
    fixture.expected.wizardName,
  )
  assert.equal(
    document.continuation.simulation.playerEntities.progressions[0].level,
    fixture.expected.level,
  )
  assert.equal(
    document.continuation.simulation.playerEntities.economies[0].gold,
    500,
  )
  assert.equal(document.nativeSource.darkdataSha256, fixture.files.darkdata.sha256)
  assert.equal(document.nativeSource.gamestateSha256, fixture.files.gamestate.sha256)
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
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  return { consoleErrors, pageErrors }
}

function assertCleanDiagnostics(diagnostics) {
  assert.deepEqual(diagnostics.pageErrors, [])
  assert.deepEqual(diagnostics.consoleErrors, [])
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

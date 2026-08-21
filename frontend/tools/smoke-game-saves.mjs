import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SAVE_SMOKE_URL || 'http://127.0.0.1:4187'
const screenshotPath = process.env.SDR_GAME_SAVE_SMOKE_SCREENSHOT
  || '/tmp/solomon-dark-game-save-resume.png'
const accountUsername = process.env.SDR_GAME_SAVE_SMOKE_USERNAME?.trim()
const accountPassword = process.env.SDR_GAME_SAVE_SMOKE_PASSWORD?.trim()
if (Boolean(accountPassword) !== Boolean(accountUsername)) {
  throw new Error('SDR_GAME_SAVE_SMOKE_USERNAME and SDR_GAME_SAVE_SMOKE_PASSWORD must be set together')
}
const accountToken = accountUsername
  ? await registerSmokeAccount(accountUsername, accountPassword)
  : null
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  if (accountToken) {
    await context.addInitScript((token) => localStorage.setItem('sdr.token', token), accountToken)
  }
  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  const consoleWarnings = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
    if (message.type() === 'warning') consoleWarnings.push(message.text())
  })

  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await assertTitleIdentity(page, accountUsername || 'Not logged in')
  await page.getByRole('button', { name: 'Play' }).click()
  const unavailableLastGame = page.getByRole('button', { name: 'Last game' })
  assert.equal(await unavailableLastGame.isDisabled(), true)
  await page.getByRole('button', { name: 'New game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: /fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-arcane').click()
  const firstCanvas = page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]')
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
  await firstCanvas.waitFor({ timeout: 30_000 })
  const initialRecord = await waitForSave(page, (record) => record?.revision >= 1)
  const startX = await firstCanvas.evaluate((canvas) => canvas.__sdrHubFrame.playerX)

  await page.keyboard.down('d')
  await page.waitForTimeout(1_200)
  await page.keyboard.up('d')
  const movedX = await firstCanvas.evaluate((canvas) => canvas.__sdrHubFrame.playerX)
  assert.ok(movedX > startX, `expected saved wizard movement (${startX} -> ${movedX})`)
  const progressedRecord = await waitForSave(
    page,
    (record) => record?.revision > initialRecord.revision
      && JSON.parse(record.document).simulation.playerEntities.locomotions[0].position.x
        > startX,
    12_000,
  )
  const savedTick = JSON.parse(progressedRecord.document).summary.savedAtTick

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await assertTitleIdentity(page, accountUsername || 'Not logged in')
  await page.getByRole('button', { name: 'Play' }).click()
  const lastGame = page.getByRole('button', { name: 'Last game' })
  assert.equal(await lastGame.isEnabled(), true)
  await lastGame.click()
  const resumedCanvas = page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]')
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
  await resumedCanvas.waitFor({ timeout: 30_000 })
  const resumed = await resumedCanvas.evaluate((canvas) => ({
    playerX: canvas.__sdrHubFrame.playerX,
    tick: canvas.__sdrHubFrame.tick,
  }))
  assert.ok(resumed.playerX > startX, JSON.stringify({ resumed, startX }))
  assert.ok(resumed.tick >= savedTick, JSON.stringify({ resumed, savedTick }))
  await page.screenshot({ path: screenshotPath })

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  const unexpectedWarnings = consoleWarnings.filter(
    (warning) => !/GL Driver Message .*GPU stall due to ReadPixels/.test(warning),
  )
  assert.deepEqual(unexpectedWarnings, [])
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    initialRevision: initialRecord.revision,
    progressedRevision: progressedRecord.revision,
    resumed,
    savedTick,
    screenshotPath,
    startX,
    movedX,
    pageErrors,
    consoleErrors,
    consoleWarnings,
    unexpectedWarnings,
  })}\n`)
} finally {
  await browser.close()
}

async function assertTitleIdentity(page, expected) {
  const identity = page.locator('.game-account-name-title')
  await identity.waitFor()
  assert.equal((await identity.textContent())?.trim(), expected)
  const bounds = await identity.boundingBox()
  assert.ok(bounds)
  assert.ok(bounds.x >= 10 && bounds.x <= 12, JSON.stringify(bounds))
}

async function waitForSave(page, predicate, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const record = accountToken
      ? await readCloudSave(page, accountToken)
      : await readLocalSave(page)
    if (predicate(record)) return record
    await page.waitForTimeout(100)
  }
  throw new Error('timed out waiting for the local game save')
}

function readCloudSave(page, token) {
  return page.evaluate(async (bearer) => {
    const response = await fetch('/api/game/saves/0', {
      headers: { Authorization: `Bearer ${bearer}` },
    })
    if (response.status === 404) return null
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

import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_DARK_CLOUD_SMOKE_URL || 'http://127.0.0.1:5173'
const screenshotPath = process.env.SDR_DARK_CLOUD_SCREENSHOT || '/tmp/solomon-dark-cloud-web-port.png'
const username = `darkcloud${Date.now().toString(36)}`
const registration = await fetch(`${baseUrl}/api/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    username,
    email: `${username}@example.invalid`,
    password: 'correct-horse-battery-staple',
  }),
})
const account = await registration.json()
assert.equal(registration.status, 201, JSON.stringify(account))

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const pageErrors = []
const consoleErrors = []
page.on('pageerror', error => pageErrors.push(error.message))
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
await page.addInitScript(token => localStorage.setItem('sdr.token', token), account.token)

let subscribedSlug = null
try {
  await page.goto(`${baseUrl}/mods`, { waitUntil: 'domcontentloaded' })
  const subscribeButton = page.getByRole('button', { name: 'Subscribe', exact: true }).first()
  await subscribeButton.waitFor({ timeout: 30_000 })
  const card = subscribeButton.locator('xpath=ancestor::a[1]')
  const cardHref = await card.getAttribute('href')
  assert.match(cardHref ?? '', /^\/mods\/[a-z0-9-]+$/)
  subscribedSlug = cardHref.split('/').at(-1)
  const subscribeResponse = page.waitForResponse(response => (
    response.request().method() === 'PUT'
    && new URL(response.url()).pathname === `/api/mods/${subscribedSlug}/subscription`
  ))
  await subscribeButton.click()
  assert.ok([200, 201].includes((await subscribeResponse).status()))
  await page.getByRole('button', { name: 'Subscribed', exact: true }).waitFor()

  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  const explore = page.getByRole('button', { name: 'Explore the Dark Cloud' })
  await explore.waitFor({ timeout: 90_000 })
  await explore.click()
  await page.getByRole('heading', { name: /THE DARK CLOUD/ }).waitFor({ timeout: 15_000 })
  await page.getByText(username.toUpperCase(), { exact: true }).waitFor()
  for (const label of ['RECENT', 'MODS', 'BONEYARDS', 'MULTIPLAYER']) {
    assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 1)
  }

  const geometry = await page.evaluate(() => {
    const bounds = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }
    const textBounds = selector => {
      const element = document.querySelector(selector)
      const range = document.createRange()
      range.selectNodeContents(element)
      const rect = range.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }
    return {
      columnLabel: textBounds('.dark-cloud-columns span:first-child'),
      list: bounds('.dark-cloud-list-frame'),
      menu: bounds('.dark-cloud-menu'),
      tabs: bounds('.dark-cloud-tabs'),
      tabLabels: [...document.querySelectorAll('.dark-cloud-tabs button')].map(button => ({
        label: button.textContent.trim(),
        color: getComputedStyle(button).color,
        opacity: getComputedStyle(button).opacity,
        rect: bounds(`.dark-cloud-tabs button:nth-child(${[...button.parentElement.children].indexOf(button) + 1})`),
      })),
      leather: getComputedStyle(document.querySelector('.dark-cloud-list-frame')).backgroundImage,
      topLeftCorner: bounds('.dark-cloud-corner.top-left'),
      wall: getComputedStyle(document.querySelector('.dark-cloud-wall')).backgroundImage,
    }
  })
  assert.deepEqual(geometry.menu, { x: 5, y: 5, width: 50, height: 50 })
  assert.deepEqual(geometry.list, { x: 55, y: 175, width: 1490, height: 620 })
  assert.equal(geometry.tabs.x, 460)
  assert.equal(geometry.tabs.y, 128)
  assert.ok(
    geometry.columnLabel.x >= geometry.topLeftCorner.x + geometry.topLeftCorner.width,
    'the first column heading must clear the stock stone corner',
  )
  assert.match(geometry.leather, /leather/)
  assert.match(geometry.wall, /stone-wall/)

  const firstRow = page.locator('.dark-cloud-rows > button').first()
  await page.waitForFunction(() => (
    document.querySelector('.dark-cloud-rows > button')
    || document.querySelector('.dark-cloud-empty')
  ), undefined, { timeout: 30_000 })
  if (await firstRow.count() === 0) {
    throw new Error(`Dark Cloud rows missing: ${await page.locator('.dark-cloud-empty').allTextContents()}`)
  }
  await firstRow.click()
  const selectedRow = page.locator('.dark-cloud-rows > button.selected')
  await selectedRow.waitFor()
  assert.match(await selectedRow.innerText(), /ENABLED/)
  await page.getByRole('button', { name: 'OPTIONS', exact: true }).click()
  const disableResponse = page.waitForResponse(response => (
    response.request().method() === 'PATCH'
    && new URL(response.url()).pathname === `/api/mods/${subscribedSlug}/subscription`
  ))
  await page.getByRole('button', { name: 'DISABLE MOD', exact: true }).click()
  assert.equal((await disableResponse).status(), 200)
  await page.getByText('DISABLED', { exact: true }).waitFor()
  const disabledManifest = await activeManifest(page, account.token)
  assert.equal(disabledManifest.mods.length, 0)

  await page.getByRole('button', { name: 'OPTIONS', exact: true }).click()
  const enableResponse = page.waitForResponse(response => (
    response.request().method() === 'PATCH'
    && new URL(response.url()).pathname === `/api/mods/${subscribedSlug}/subscription`
  ))
  await page.getByRole('button', { name: 'ENABLE MOD', exact: true }).click()
  assert.equal((await enableResponse).status(), 200)
  await page.getByText('ENABLED', { exact: true }).waitFor()
  const enabledManifest = await activeManifest(page, account.token)
  assert.equal(enabledManifest.mods.length, 1)
  assert.match(enabledManifest.manifestSha256, /^[a-f0-9]{64}$/)
  assert.notEqual(enabledManifest.manifestSha256, '0'.repeat(64))

  await page.screenshot({ path: screenshotPath })
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    username,
    subscribedSlug,
    geometry,
    manifestSha256: enabledManifest.manifestSha256,
    screenshotPath,
    pageErrors,
    consoleErrors,
  })}\n`)
} finally {
  if (subscribedSlug) {
    await fetch(`${baseUrl}/api/mods/${subscribedSlug}/subscription`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${account.token}` },
    })
  }
  await browser.close()
}

async function activeManifest(page, token) {
  return page.evaluate(async ({ token }) => {
    const response = await fetch('/api/mods/active', {
      headers: { authorization: `Bearer ${token}` },
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error ?? `active manifest failed (${response.status})`)
    return payload
  }, { token })
}

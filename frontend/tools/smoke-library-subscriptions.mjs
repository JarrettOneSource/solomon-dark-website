import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_LIBRARY_SMOKE_URL || 'http://127.0.0.1:5173'
const screenshotPath = process.env.SDR_LIBRARY_SCREENSHOT
  || '/tmp/solomon-dark-library-subscriptions.png'
const username = `library${Date.now().toString(36)}`
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
const pageErrors = []
const consoleErrors = []
page.on('pageerror', error => pageErrors.push(error.message))
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})

try {
  await page.goto(`${baseUrl}/mods`, { waitUntil: 'domcontentloaded' })
  const registration = await page.evaluate(async registrationBody => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(registrationBody),
    })
    return { status: response.status, account: await response.json() }
  }, {
    username,
    email: `${username}@example.invalid`,
    password: 'correct-horse-battery-staple',
  })
  assert.equal(registration.status, 201, JSON.stringify(registration.account))
  const account = registration.account
  await page.evaluate(token => localStorage.setItem('sdr.token', token), account.token)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Subscribed Mods', exact: true }).waitFor()
  await page.getByText('No subscribed mods', { exact: true }).waitFor()

  const subscribe = page.getByRole('button', { name: 'Subscribe', exact: true }).first()
  await subscribe.waitFor({ timeout: 30_000 })
  const cardHref = await subscribe.locator('xpath=ancestor::a[1]').getAttribute('href')
  assert.match(cardHref ?? '', /^\/mods\/[a-z0-9-]+$/)
  const slug = cardHref.split('/').at(-1)
  const subscribeResponse = page.waitForResponse(response => (
    response.request().method() === 'PUT'
    && new URL(response.url()).pathname === `/api/mods/${slug}/subscription`
  ))
  await subscribe.click()
  assert.ok([200, 201].includes((await subscribeResponse).status()))

  const unsubscribe = page.getByRole('button', { name: 'Unsubscribe', exact: true })
  await unsubscribe.waitFor()
  assert.equal(await unsubscribe.count(), 1)
  assert.equal(await page.getByRole('button', { name: 'Subscribed', exact: true }).count(), 1)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: screenshotPath, fullPage: true })

  const unsubscribeResponse = page.waitForResponse(response => (
    response.request().method() === 'DELETE'
    && new URL(response.url()).pathname === `/api/mods/${slug}/subscription`
  ))
  await unsubscribe.click()
  assert.equal((await unsubscribeResponse).status(), 204)
  await page.getByText('No subscribed mods', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Subscribe', exact: true }).first().waitFor()

  const subscriptions = await page.evaluate(async token => {
    const response = await fetch('/api/mods/subscriptions', {
      headers: { authorization: `Bearer ${token}` },
    })
    return { status: response.status, body: await response.json() }
  }, account.token)
  assert.equal(subscriptions.status, 200, JSON.stringify(subscriptions.body))
  assert.deepEqual(subscriptions.body.items, [])

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    username,
    slug,
    screenshotPath,
    pageErrors,
    consoleErrors,
  })}\n`)
} finally {
  await browser.close()
}

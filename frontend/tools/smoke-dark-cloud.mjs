import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_DARK_CLOUD_SMOKE_URL || 'http://127.0.0.1:5173'
const desktopScreenshotPath = process.env.SDR_DARK_CLOUD_SCREENSHOT || '/tmp/solomon-dark-cloud-desktop.png'
const detailScreenshotPath = process.env.SDR_DARK_CLOUD_DETAIL_SCREENSHOT || '/tmp/solomon-dark-cloud-detail.png'
const landscapeScreenshotPath = process.env.SDR_DARK_CLOUD_LANDSCAPE_SCREENSHOT || '/tmp/solomon-dark-cloud-landscape.png'
const mobileScreenshotPath = process.env.SDR_DARK_CLOUD_MOBILE_SCREENSHOT || '/tmp/solomon-dark-cloud-mobile.png'
const partyScreenshotPath = process.env.SDR_DARK_CLOUD_PARTY_SCREENSHOT || '/tmp/solomon-dark-cloud-party-desktop.png'
const partyMobileScreenshotPath = process.env.SDR_DARK_CLOUD_PARTY_MOBILE_SCREENSHOT || '/tmp/solomon-dark-cloud-party-mobile.png'
const layoutsScreenshotPath = process.env.SDR_DARK_CLOUD_LAYOUTS_SCREENSHOT || '/tmp/solomon-dark-cloud-layouts.png'
const joinPartyScreenshotPath = process.env.SDR_JOIN_PARTY_SCREENSHOT || '/tmp/solomon-join-party-desktop.png'
const joinPartyMobileScreenshotPath = process.env.SDR_JOIN_PARTY_MOBILE_SCREENSHOT || '/tmp/solomon-join-party-mobile.png'
const username = `darkcloud${Date.now().toString(36)}`
const mobileUiStorageKey = 'solomon-dark-mobile-ui-layout-v1'
const mobileUiElementIds = [
  'pause', 'diagnostics', 'meters', 'leftJoystick', 'rightJoystick',
  'slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8',
  'inventory', 'skillbook', 'xp', 'healthPotion', 'manaPotion',
]

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
const failedResponses = []
page.on('pageerror', error => pageErrors.push(error.message))
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('response', response => {
  if (response.status() >= 400) {
    failedResponses.push({ status: response.status(), url: response.url() })
  }
})
await page.addInitScript(token => localStorage.setItem('sdr.token', token), account.token)

await page.route('**/api/game/parties', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({
    items: [{
      cheatsEnabled: true,
      id: 'party-smoke-public',
      leader: 'Hagatha',
      members: ['Hagatha', 'Luthacus'],
      memberCount: 2,
      maxMembers: 16,
      modCount: 2,
      sessionKind: 'private-college',
      status: 'playing',
      visibility: 'public',
      boneyardName: 'The Survival Grounds',
    }],
  }),
}))

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
  const tutorialOffer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialOffer.isVisible()) {
    await tutorialOffer.getByRole('button', { name: 'NO', exact: true }).click()
    await tutorialOffer.waitFor({ state: 'detached' })
  }
  await explore.click()
  await page.getByRole('heading', { name: 'THE DARK CLOUD', exact: true }).waitFor({ timeout: 15_000 })
  await page.getByText(username.toUpperCase(), { exact: true }).waitFor()

  for (const label of ['MODS', 'SUBSCRIBED MODS', 'PARTIES', 'LAYOUTS']) {
    assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 1)
  }
  for (const removed of ['RECENT', 'BONEYARDS', 'MULTIPLAYER']) {
    assert.equal(await page.getByRole('button', { name: removed, exact: true }).count(), 0)
  }
  assert.equal(await page.getByText('HOW DARK ARE YOU TODAY?', { exact: true }).count(), 0)
  assert.equal(
    await page.getByRole('button', { name: 'MODS', exact: true }).getAttribute('aria-current'),
    'page',
  )

  const modRow = page.locator(`.dark-cloud-mod-row[data-mod-slug="${subscribedSlug}"]`)
  await modRow.waitFor({ timeout: 30_000 })
  await modRow.locator('.dark-cloud-media-placeholder').waitFor()
  assert.equal(await modRow.getByText('NO IMAGE', { exact: true }).count(), 1)

  const desktopGeometry = await darkCloudGeometry(page)
  assert.deepEqual(desktopGeometry.scene, { x: 0, y: 0, width: 1600, height: 900 })
  assert.deepEqual(desktopGeometry.stage, desktopGeometry.scene)
  assert.equal(desktopGeometry.stageTransform, 'none')
  assert.ok(desktopGeometry.list.width >= 1480)
  assert.ok(desktopGeometry.list.height >= 610)
  assert.equal(desktopGeometry.horizontalOverflow, 0)
  assertCornerLegs(desktopGeometry.cornerLegs)
  await page.screenshot({ path: desktopScreenshotPath })

  const subscriptionMutations = []
  const captureSubscriptionMutation = request => {
    const path = new URL(request.url()).pathname
    if (path === `/api/mods/${subscribedSlug}/subscription` && request.method() !== 'GET') {
      subscriptionMutations.push(request.method())
    }
  }
  page.on('request', captureSubscriptionMutation)
  await modRow.locator('.dark-cloud-row-main').dblclick()
  const detail = page.getByRole('dialog', { name: await modRow.locator('.dark-cloud-row-copy strong').innerText() })
  await detail.waitFor()
  assert.deepEqual(subscriptionMutations, [])
  await detail.getByRole('heading', { name: 'SCREENSHOTS', exact: true }).waitFor()
  await detail.getByText('NO IMAGE', { exact: true }).waitFor()
  assert.equal(await detail.getByRole('button', { name: 'PREVIOUS IMAGE' }).isDisabled(), true)
  assert.equal(await detail.getByRole('button', { name: 'NEXT IMAGE' }).isDisabled(), true)
  await detail.getByRole('heading', { name: 'DESCRIPTION', exact: true }).waitFor()
  await detail.getByRole('heading', { name: 'VERSION HISTORY', exact: true }).waitFor()
  await detail.getByRole('heading', { name: 'COMMENTS', exact: true }).waitFor()

  const commentBody = `Dark Cloud smoke note ${Date.now()}`
  await detail.getByLabel('LEAVE A COMMENT').fill(commentBody)
  const commentResponse = page.waitForResponse(response => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === `/api/mods/${subscribedSlug}/comments`
  ))
  await detail.getByRole('button', { name: 'POST COMMENT', exact: true }).click()
  assert.equal((await commentResponse).status(), 201)
  await detail.getByText(commentBody, { exact: true }).waitFor()
  await page.screenshot({ path: detailScreenshotPath })
  const deleteResponse = page.waitForResponse(response => (
    response.request().method() === 'DELETE'
    && new URL(response.url()).pathname.startsWith(`/api/mods/${subscribedSlug}/comments/`)
  ))
  await detail.getByRole('button', { name: `Delete comment by ${username}` }).click()
  assert.equal((await deleteResponse).status(), 204)
  await detail.getByText('NO COMMENTS YET.', { exact: true }).waitFor()
  await detail.getByRole('button', { name: 'Close mod details' }).click()
  page.off('request', captureSubscriptionMutation)

  await page.getByRole('button', { name: 'SUBSCRIBED MODS', exact: true }).click()
  const subscribedRow = page.locator(`.dark-cloud-mod-row[data-mod-slug="${subscribedSlug}"]`)
  await subscribedRow.waitFor()
  const modName = await subscribedRow.locator('.dark-cloud-row-copy strong').innerText()

  const disableResponse = page.waitForResponse(response => (
    response.request().method() === 'PATCH'
    && new URL(response.url()).pathname === `/api/mods/${subscribedSlug}/subscription`
  ))
  await subscribedRow.getByRole('button', { name: `Disable ${modName}` }).click()
  assert.equal((await disableResponse).status(), 200)
  await subscribedRow.getByText('DISABLED', { exact: true }).waitFor()
  assert.equal((await activeManifest(page, account.token)).mods.length, 0)

  const enableResponse = page.waitForResponse(response => (
    response.request().method() === 'PATCH'
    && new URL(response.url()).pathname === `/api/mods/${subscribedSlug}/subscription`
  ))
  await subscribedRow.getByRole('button', { name: `Enable ${modName}` }).click()
  assert.equal((await enableResponse).status(), 200)
  await subscribedRow.getByText('ENABLED', { exact: true }).waitFor()
  const enabledManifest = await activeManifest(page, account.token)
  assert.equal(enabledManifest.mods.length, 1)
  assert.match(enabledManifest.manifestSha256, /^[a-f0-9]{64}$/)
  assert.notEqual(enabledManifest.manifestSha256, '0'.repeat(64))
  const enabledAssetUrls = enabledManifest.mods.flatMap(mod => (
    mod.assets.map(asset => `/api/game/content/${asset.sha256}`)
  ))
  if (enabledAssetUrls.length > 0) {
    await page.waitForFunction(async urls => (
      (await Promise.all(urls.map(url => caches.match(url)))).every(Boolean)
    ), enabledAssetUrls)
  }

  const unsubscribeResponse = page.waitForResponse(response => (
    response.request().method() === 'DELETE'
    && new URL(response.url()).pathname === `/api/mods/${subscribedSlug}/subscription`
  ))
  await subscribedRow.getByRole('button', { name: `Unsubscribe from ${modName}` }).click()
  assert.equal((await unsubscribeResponse).status(), 204)
  await subscribedRow.waitFor({ state: 'detached' })
  assert.equal((await activeManifest(page, account.token)).mods.length, 0)
  subscribedSlug = null

  await page.getByRole('button', { name: 'PARTIES', exact: true }).click()
  const partyRow = page.locator('[data-party-id="party-smoke-public"]')
  await partyRow.waitFor()
  await partyRow.getByText("HAGATHA'S PARTY", { exact: true }).waitFor()
  await partyRow.getByText('2 / 16', { exact: true }).waitFor()
  for (const disclosure of ['PRIVATE COLLEGE', 'MODDED · 2', 'CHEATS']) {
    await partyRow.getByText(disclosure, { exact: true }).waitFor()
  }
  assert.equal(await partyRow.locator('.dark-cloud-party-status').innerText(), 'IN GAME')
  await partyRow.getByText('The Survival Grounds', { exact: true }).waitFor()
  assert.equal(
    await partyRow.locator('.dark-cloud-party-location').getAttribute('title'),
    'The Survival Grounds',
  )
  assert.equal(await partyRow.getByRole('button', { name: 'IN GAME', exact: true }).isDisabled(), true)
  const partyFooterAction = page.locator('.dark-cloud-primary-button')
  assert.equal(await partyFooterAction.innerText(), 'IN GAME')
  assert.equal(await partyFooterAction.isDisabled(), true)
  assert.equal(await page.locator('.dark-cloud-party-row').count(), 1)
  await page.screenshot({ path: partyScreenshotPath })

  const sharedDocument = {
    version: 2,
    elements: Object.fromEntries(mobileUiElementIds.map((id, index) => [id, {
      rotation: 0,
      scale: 1,
      x: 10 + index * 4,
      y: 15 + index * 3,
    }])),
  }
  await page.evaluate(({ key, layout }) => {
    localStorage.setItem(key, JSON.stringify(layout))
  }, { key: mobileUiStorageKey, layout: sharedDocument })
  await page.getByRole('button', { name: 'LAYOUTS', exact: true }).click()
  await page.getByRole('heading', { name: 'MOBILE UI LAYOUTS', exact: true }).waitFor()
  const publishLayoutResponse = page.waitForResponse(response => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/game/layouts'
  ))
  await page.getByRole('button', { name: 'SUBMIT CURRENT LAYOUT', exact: true }).click()
  assert.equal((await publishLayoutResponse).status(), 201)
  await page.getByText('LAYOUT PUBLISHED', { exact: true }).waitFor()
  const sharedCode = await page.locator('.dark-cloud-layout-receipt output').innerText()
  assert.match(sharedCode, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
  await page.screenshot({ path: layoutsScreenshotPath })

  await page.locator('.game-menu-skull').click()
  await page.getByRole('button', { name: 'SIGN OUT', exact: true }).click()
  await explore.waitFor({ timeout: 30_000 })
  if (await tutorialOffer.isVisible()) {
    await tutorialOffer.getByRole('button', { name: 'NO', exact: true }).click()
    await tutorialOffer.waitFor({ state: 'detached' })
  }
  await explore.click()
  await page.getByText('YOU ARE SIGNED IN AS A GUEST.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'LAYOUTS', exact: true }).click()
  await page.evaluate(key => localStorage.removeItem(key), mobileUiStorageKey)
  const codeInput = page.getByLabel('SHARE CODE')
  await codeInput.fill(sharedCode)
  const loadLayoutResponse = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === `/api/game/layouts/${sharedCode}`
  ))
  await page.getByRole('button', { name: 'LOAD LAYOUT', exact: true }).click()
  const loadedResponse = await loadLayoutResponse
  assert.equal(loadedResponse.status(), 200)
  assert.equal(loadedResponse.request().headers().authorization, undefined)
  await page.getByText('LAYOUT LOADED', { exact: true }).waitFor()
  assert.deepEqual(
    JSON.parse(await page.evaluate(key => localStorage.getItem(key), mobileUiStorageKey)),
    sharedDocument,
  )
  await page.getByRole('button', { name: 'PARTIES', exact: true }).click()
  await partyRow.waitFor()

  await page.setViewportSize({ width: 390, height: 844 })
  for (const text of ['2 / 16', 'The Survival Grounds', 'MODDED · 2', 'CHEATS']) {
    assert.ok(await partyRow.getByText(text, { exact: true }).boundingBox(), `${text} was hidden on mobile`)
  }
  assert.ok(await partyRow.locator('.dark-cloud-party-status').boundingBox(), 'IN GAME was hidden on mobile')
  await page.screenshot({ path: partyMobileScreenshotPath })
  await page.getByRole('button', { name: 'MODS', exact: true }).click()
  await page.locator('.dark-cloud-mod-row').first().waitFor()
  const mobileGeometry = await darkCloudGeometry(page)
  assert.deepEqual(mobileGeometry.scene, { x: 0, y: 0, width: 390, height: 844 })
  assert.deepEqual(mobileGeometry.stage, mobileGeometry.scene)
  assert.equal(mobileGeometry.horizontalOverflow, 0)
  assert.ok(mobileGeometry.minimumTouchTarget >= 44)
  await page.screenshot({ path: mobileScreenshotPath })

  await page.setViewportSize({ width: 844, height: 390 })
  const landscapeGeometry = await darkCloudGeometry(page)
  assert.deepEqual(landscapeGeometry.scene, { x: 0, y: 0, width: 844, height: 390 })
  assert.deepEqual(landscapeGeometry.stage, landscapeGeometry.scene)
  assert.equal(landscapeGeometry.horizontalOverflow, 0)
  assert.ok(landscapeGeometry.minimumTouchTarget >= 44)
  await page.screenshot({ path: landscapeScreenshotPath })

  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  if (await tutorialOffer.isVisible()) {
    await tutorialOffer.getByRole('button', { name: 'NO', exact: true }).click()
    await tutorialOffer.waitFor({ state: 'detached' })
  }
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'Join party', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Join party', exact: true }).click()
  const joinParty = page.getByRole('region', { name: 'Join Party' })
  await joinParty.waitFor()
  const joinPartyRow = joinParty.locator('[data-party-listing="party-smoke-public"]')
  await joinPartyRow.waitFor()
  for (const text of [
    'HAGATHA',
    'PRIVATE COLLEGE',
    'MODDED · 2',
    'CHEATS',
    'Hagatha · Luthacus',
    '2 / 16',
    'The Survival Grounds',
  ]) {
    await joinPartyRow.getByText(text, { exact: true }).waitFor()
  }
  assert.equal(await joinPartyRow.locator('.join-party-status').innerText(), 'IN GAME')
  assert.equal(await joinPartyRow.getByRole('button', { name: 'IN GAME', exact: true }).isDisabled(), true)
  await page.screenshot({ path: joinPartyScreenshotPath })

  await page.setViewportSize({ width: 390, height: 844 })
  for (const text of ['2 / 16', 'The Survival Grounds', 'MODDED · 2', 'CHEATS']) {
    assert.ok(await joinPartyRow.getByText(text, { exact: true }).boundingBox(), `${text} was hidden on Join Party mobile`)
  }
  assert.ok(await joinPartyRow.locator('.join-party-status').boundingBox(), 'IN GAME was hidden on Join Party mobile')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0)
  await page.screenshot({ path: joinPartyMobileScreenshotPath })

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(failedResponses, [])
  assert.deepEqual(consoleErrors, [])
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    username,
    desktopGeometry,
    mobileGeometry,
    landscapeGeometry,
    partySource: 'bounded browser fixture; host/supervisor contracts prove the live projection',
    cachedGameContent: enabledAssetUrls.length,
    sharedLayoutCode: sharedCode,
    screenshots: {
      desktop: desktopScreenshotPath,
      detail: detailScreenshotPath,
      joinParty: joinPartyScreenshotPath,
      joinPartyMobile: joinPartyMobileScreenshotPath,
      landscape: landscapeScreenshotPath,
      layouts: layoutsScreenshotPath,
      mobile: mobileScreenshotPath,
      party: partyScreenshotPath,
      partyMobile: partyMobileScreenshotPath,
    },
    pageErrors,
    consoleErrors,
    failedResponses,
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

async function darkCloudGeometry(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const bounds = document.querySelector(selector).getBoundingClientRect()
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    }
    const cornerLeg = (selector, half) => {
      const image = document.querySelector(selector)
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(image, 0, 0)
      const startY = half === 'top' ? 0 : Math.floor(canvas.height / 2)
      const sampleHeight = half === 'top' ? Math.ceil(canvas.height / 2) : canvas.height - startY
      const pixels = context.getImageData(0, startY, canvas.width, sampleHeight).data
      let left = 0
      let right = 0
      for (let y = 0; y < sampleHeight; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const alpha = pixels[(y * canvas.width + x) * 4 + 3]
          if (x < canvas.width / 2) left += alpha
          else right += alpha
        }
      }
      return { left, right }
    }
    const touchTargets = [...document.querySelectorAll(
      '.dark-cloud-tabs button, .dark-cloud-footer button, .dark-cloud-row-actions button',
    )].filter(element => getComputedStyle(element).display !== 'none')
      .map(element => element.getBoundingClientRect().height)
    const scene = document.querySelector('.dark-cloud-scene')
    return {
      scene: rect('.dark-cloud-scene'),
      stage: rect('.dark-cloud-stage'),
      list: rect('.dark-cloud-list-frame'),
      stageTransform: getComputedStyle(document.querySelector('.dark-cloud-stage')).transform,
      horizontalOverflow: Math.max(0, scene.scrollWidth - scene.clientWidth),
      minimumTouchTarget: Math.min(...touchTargets),
      cornerLegs: {
        topLeft: cornerLeg('.dark-cloud-corner.top-left', 'bottom'),
        topRight: cornerLeg('.dark-cloud-corner.top-right', 'bottom'),
        bottomLeft: cornerLeg('.dark-cloud-corner.bottom-left', 'top'),
        bottomRight: cornerLeg('.dark-cloud-corner.bottom-right', 'top'),
      },
    }
  })
}

function assertCornerLegs(corners) {
  assert.ok(corners.topLeft.left > corners.topLeft.right * 1.15)
  assert.ok(corners.bottomLeft.left > corners.bottomLeft.right * 1.15)
  assert.ok(corners.topRight.right > corners.topRight.left * 1.15)
  assert.ok(corners.bottomRight.right > corners.bottomRight.left * 1.15)
}

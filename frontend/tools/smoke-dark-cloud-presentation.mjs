import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer } from 'vite'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { MOBILE_UI_ELEMENT_IDS } from '../src/game/mobile-ui-layout.ts'
import { assertNativeCloudChrome, assertNativePanel, assertStockCloudSurfaces } from './dark-cloud-presentation-assertions.mjs'

const evidence = process.env.SDR_DARK_CLOUD_EVIDENCE || '/tmp/solomon-dark-cloud-presentation'
await mkdir(evidence, { recursive: true })
const dev = process.argv.includes('--dev')
const server = dev
  ? await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 } })
  : await startStaticClientServer({ root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)) })
if (dev) await server.listen()
const origin = dev ? `http://127.0.0.1:${server.httpServer.address().port}` : server.origin
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--disable-audio-output'],
})
const problems = []
const receipts = []
try {
  for (const scenario of [
    { name: 'desktop', width: 1600, height: 900, authenticated: true, touch: false },
    { name: 'portrait', width: 390, height: 844, authenticated: false, touch: true },
    { name: 'landscape', width: 844, height: 390, authenticated: false, touch: true },
    { name: 'small-phone', width: 320, height: 640, authenticated: false, touch: true },
  ]) {
    const entryViewport = scenario.touch && scenario.height > scenario.width
      ? { width: scenario.height, height: scenario.width }
      : { width: scenario.width, height: scenario.height }
    const context = await browser.newContext({ viewport: entryViewport, deviceScaleFactor: 2, hasTouch: scenario.touch, isMobile: scenario.touch })
    console.log(`Checking ${scenario.name}`)
    try {
      const page = await context.newPage()
      const fixture = await installFixture(page, scenario.authenticated)
      const errors = []
      const expectedErrors = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => {
        if (message.type() === 'error') (fixture.expectFailure ? expectedErrors : errors).push(message.text())
      })
      await openCloud(page)
      const scene = page.locator('.dark-cloud-scene')
      await page.setViewportSize({ width: scenario.width, height: scenario.height })
      await page.locator('.dark-cloud-mod-row').first().waitFor()
      await assertNativeCloudChrome(scene)
      if (scenario.width < 700) assert.equal(await scene.locator('.dark-cloud-beta').isVisible(), false, 'the beta label must leave room for the phone fullscreen action')
      if (scenario.name === 'desktop') receipts.push({ surfaceBrightness: await assertStockCloudSurfaces(page) })
      await capture(page, scenario, 'root')

      // The non-Latin name is real external content, not a missing bitmap label.
      const unicode = page.locator('[data-mod-slug="moon-garden"]')
      assert.equal(await unicode.locator('[data-native-ui-content-text]').first().innerText(), 'Moon Garden 月庭')
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      const search = page.getByRole('dialog', { name: 'SEARCH THE DARK CLOUD' })
      await assertNativePanel(search, { stoneFooter: false })
      const input = search.getByRole('textbox')
      await input.fill('月庭')
      await input.press('Enter')
      await search.waitFor({ state: 'detached' })
      assert.equal(await page.locator('.dark-cloud-mod-row').count(), 1)
      await capture(page, scenario, 'search-results')
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      await search.getByRole('button', { name: 'Clear search text' }).click()
      await search.getByRole('button', { name: 'SEARCH NOW' }).click()
      await search.waitFor({ state: 'detached' })
      assert.equal(await page.locator('.dark-cloud-mod-row').count(), 12)

      await page.getByRole('button', { name: 'Sort', exact: true }).click()
      const sort = page.getByRole('dialog', { name: 'SORT MODS BY...' })
      await assertNativePanel(sort, { stoneFooter: false })
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'NEWEST', 'Sort must focus its selected choice when opened')
      await page.evaluate(() => { window.darkCloudTestPad.buttons[5] = { pressed: true, touched: true, value: 1 } })
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'UPDATED RECENTLY')
      await page.evaluate(() => { window.darkCloudTestPad.buttons[5] = { pressed: false, touched: false, value: 0 }; window.darkCloudTestPad.buttons[13] = { pressed: true, touched: true, value: 1 } })
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'MOST DOWNLOADED')
      await page.evaluate(() => { window.darkCloudTestPad.buttons[13] = { pressed: false, touched: false, value: 0 } })
      await sort.getByRole('button', { name: 'MOST DOWNLOADED', exact: true }).click()
      await sort.waitFor({ state: 'detached' })
      await page.getByRole('button', { name: 'Sort', exact: true }).click()
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'MOST DOWNLOADED', 'reopening Sort must focus the current choice')
      await capture(page, scenario, 'sort')
      await page.evaluate(() => { window.darkCloudTestPad.buttons[1] = { pressed: true, touched: true, value: 1 } })
      await sort.waitFor({ state: 'detached', timeout: 2000 })
      await page.evaluate(() => { window.darkCloudTestPad.buttons[1] = { pressed: false, touched: false, value: 0 } })
      assert.equal(await page.getByRole('dialog').count(), 0)

      const row = page.locator('[data-mod-slug="survival-grounds"]')
      await row.locator('.dark-cloud-row-main').click()
      const view = row.getByRole('button', { name: 'View The Survival Grounds', exact: true })
      await view.focus()
      await page.keyboard.down('Space')
      await view.locator('[data-native-ui-record="UI.102"]').waitFor()
      await page.keyboard.up('Space')
      const detail = page.getByRole('dialog', { name: 'The Survival Grounds', exact: true })
      await assertNativePanel(detail, { stoneFooter: true })
      const galleryImage = detail.locator('.dark-cloud-gallery-image img')
      await galleryImage.waitFor()
      await detail.getByRole('button', { name: 'NEXT IMAGE' }).click()
      await page.waitForFunction(() => document.querySelector('.dark-cloud-gallery-image img')?.alt.endsWith('2'))
      await detail.getByRole('button', { name: 'PREVIOUS IMAGE' }).click()
      await page.waitForFunction(() => document.querySelector('.dark-cloud-gallery-image img')?.alt.endsWith('1'))
      await assertNativeCloudChrome(detail)
      assert.equal(await detail.locator('.dark-cloud-gallery').evaluate(gallery => {
        const image = gallery.querySelector('.dark-cloud-gallery-image').getBoundingClientRect()
        return [...gallery.querySelectorAll('.dark-cloud-gallery-navigation button')].every(button => button.getBoundingClientRect().top >= image.bottom)
      }), true, 'gallery controls must not cover image content')
      await capture(page, scenario, 'detail')
      await assertModalFocus(page, detail)

      if (scenario.authenticated) {
        await detail.getByRole('textbox', { name: 'LEAVE A COMMENT' }).fill('A useful route through 月庭.')
        await detail.getByRole('button', { name: 'POST COMMENT' }).click()
        await detail.getByText('A useful route through 月庭.', { exact: true }).waitFor()
        await detail.getByRole('button', { name: 'Delete comment by Keeper' }).click()
        await detail.getByText('NO COMMENTS YET.', { exact: true }).waitFor()
        await detail.getByRole('button', { name: 'DISABLE MOD', exact: true }).click()
        await detail.getByRole('button', { name: 'ENABLE MOD', exact: true }).click()
        await detail.getByRole('button', { name: 'DISABLE MOD', exact: true }).waitFor()
      } else assert.equal(await detail.getByRole('button', { name: 'SIGN IN TO SUBSCRIBE' }).count(), 1)
      await detail.getByRole('button', { name: 'DONE', exact: true }).focus()
      await page.keyboard.down('Space')
      await detail.locator('[data-native-ui-record="UI.106"]').waitFor()
      await page.keyboard.up('Space')
      await detail.waitFor({ state: 'detached' })
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'View The Survival Grounds')

      await page.getByRole('tab', { name: 'SUBSCRIBED MODS', exact: true }).click()
      if (scenario.authenticated) {
        await page.getByRole('button', { name: 'Disable The Survival Grounds' }).click()
        await page.getByRole('button', { name: 'Enable The Survival Grounds' }).click()
        await page.getByRole('button', { name: 'Disable The Survival Grounds' }).waitFor()
      } else await page.getByText('SIGN IN TO SEE YOUR MODS.', { exact: true }).waitFor()
      await assertNativeCloudChrome(scene)

      fixture.failParties = true
      fixture.expectFailure = true
      await page.getByRole('tab', { name: 'PARTIES', exact: true }).click()
      await page.getByText('Party directory unavailable.', { exact: true }).waitFor()
      await Promise.all([
        page.waitForResponse(response => new URL(response.url()).pathname === '/api/game/parties', { timeout: 2000 }),
        page.getByRole('button', { name: 'RETRY', exact: true }).click(),
      ])
      await page.locator('.dark-cloud-party-row').waitFor()
      fixture.expectFailure = false
      await assertNativeCloudChrome(scene)
      for (const label of ['MODDED (2)', 'CHEATS', 'PRIVATE COLLEGE']) {
        const marker = page.locator('.dark-cloud-party-flags').getByText(label, { exact: true })
        assert.ok(await marker.boundingBox(), `${scenario.name}: ${label} must remain visible`)
      }
      if (scenario.authenticated) await page.getByRole('button', { name: 'OBSERVE' }).waitFor()
      await capture(page, scenario, 'parties')

      await page.getByRole('tab', { name: 'LAYOUTS', exact: true }).click()
      await page.getByRole('textbox', { name: 'SHARE CODE' }).fill('ABCD-EFGH')
      await page.getByRole('button', { name: 'LOAD LAYOUT', exact: true }).click()
      await page.getByText('LAYOUT LOADED', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'COPY CODE', exact: true }).click()
      await page.getByRole('button', { name: 'COPIED', exact: true }).waitFor()
      assert.equal(await page.evaluate(() => window.darkCloudCopiedCode), 'ABCD-EFGH')
      assert.equal(await page.locator('.dark-cloud-layout-receipt').evaluate(receipt => {
        const code = receipt.querySelector('output [data-native-ui-font]').getBoundingClientRect()
        const copy = receipt.querySelector('button').getBoundingClientRect()
        return Math.max(code.left, copy.left) < Math.min(code.right, copy.right)
          && Math.max(code.top, copy.top) < Math.min(code.bottom, copy.bottom)
      }), false, 'the copy action must not cover the share code')
      if (scenario.authenticated) {
        await page.getByRole('button', { name: 'SUBMIT CURRENT LAYOUT', exact: true }).click()
        await page.getByText('LAYOUT PUBLISHED', { exact: true }).waitFor()
      }
      await capture(page, scenario, 'layouts')
      await assertNativeCloudChrome(scene)
      assert.deepEqual(errors, [])
      assert.equal(expectedErrors.length, 1)
      assert.deepEqual(fixture.unexpectedRequests, [])
      receipts.push({ scenario: scenario.name, errors, expectedErrors })
    } finally {
      await context.close()
    }
  }
  await writeFile(`${evidence}/receipt.json`, JSON.stringify({ problems, receipts }, null, 2))
  assert.deepEqual(problems, [])
  process.stdout.write(`${JSON.stringify({ status: 'ok', receipts })}\n`)
} finally {
  await browser.close()
  await server.close()
}

async function openCloud(page) {
  await page.goto(`${origin}/game`, { waitUntil: 'domcontentloaded' })
  const explore = page.getByRole('button', { name: 'Explore the Dark Cloud' })
  await explore.waitFor({ timeout: 120000 })
  const offer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await offer.isVisible()) await offer.getByRole('button', { name: 'NO', exact: true }).click()
  await explore.click()
  await page.getByRole('heading', { name: 'THE DARK CLOUD', exact: true }).waitFor()
}

async function capture(page, scenario, name) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const layout = await page.evaluate(() => {
    const scope = document.querySelector('dialog[open]') ?? document.querySelector('.dark-cloud-scene')
    const content = scope.matches('dialog') ? scope.querySelector('.dark-cloud-detail-scroll, .dark-cloud-panel-body') : scope
    const controls = [...scope.querySelectorAll('button, input, textarea')].filter(element => element.getClientRects().length > 0)
    return {
      overflow: Math.max(0, content.scrollWidth - content.clientWidth),
      smallControls: controls.map(element => {
        const rect = element.getBoundingClientRect()
        return { height: rect.height, label: element.getAttribute('aria-label') ?? element.textContent, width: rect.width }
      }).filter(rect => rect.height < 43.9 || rect.width < 43.9),
    }
  })
  if (layout.overflow || layout.smallControls.length) {
    const details = await page.evaluate(() => {
      const root = document.querySelector('dialog[open]') ?? document.querySelector('.dark-cloud-scene')
      const content = root.matches('dialog') ? root.querySelector('.dark-cloud-detail-scroll, .dark-cloud-panel-body') : root
      const right = content.getBoundingClientRect().right
      return [...content.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > right + 1).slice(0, 12).map(el => ({ cls: el.className, tag: el.tagName, text: el.textContent.slice(0, 35), right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width }))
    })
    problems.push({ scenario: scenario.name, name, ...layout, details })
  }
  await page.screenshot({ path: `${evidence}/${scenario.name}-${name}.png`, scale: 'css' })
}

async function assertModalFocus(page, dialog) {
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab')
    const focus = await dialog.evaluate(element => ({
      contained: element.contains(document.activeElement),
      documentFocused: document.hasFocus(),
      label: document.activeElement?.getAttribute('aria-label'),
      tag: document.activeElement?.tagName,
    }))
    assert.ok(focus.contained || !focus.documentFocused, JSON.stringify({ index, focus }))
  }
}

async function installFixture(page, authenticated) {
  const state = { expectFailure: false, failParties: false, unexpectedRequests: [] }
  const user = { id: 1, username: 'Keeper', developerAccess: true, school: null, createdAtUtc: '2026-09-01T00:00:00Z' }
  const layout = { version: 2, elements: Object.fromEntries(MOBILE_UI_ELEMENT_IDS.map((id, index) => [id, { rotation: 0, scale: 1, x: 10 + index * 4, y: 15 + index * 3 }])) }
  const shared = { code: 'ABCD-EFGH', layout, author: { username: 'Keeper' }, createdAtUtc: user.createdAtUtc }
  const mods = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, slug: index === 0 ? 'survival-grounds' : index === 1 ? 'moon-garden' : `grounds-${index}`, name: index === 0 ? 'The Survival Grounds' : index === 1 ? 'Moon Garden 月庭' : `Boneyard ${index}`, summary: 'Survive the growing hordes.', packageId: `stock.grounds${index}`, visibility: 'public', tags: ['boneyard'], author: user, latestVersion: '1.0.0', downloads: 12 - index, thumbnailUrl: null, createdAtUtc: user.createdAtUtc, updatedAtUtc: user.createdAtUtc }))
  const subscriptions = new Map(authenticated ? [['survival-grounds', true]] : [])
  let comments = []
  const routes = new Map([
    ['/api/auth/me', () => ({ json: { user, modCount: 0, saveCount: 0 } })],
    ['/api/game/saves/0', () => ({ json: { save: null } })],
    ['/api/mods', () => ({ json: { items: mods, total: mods.length, page: 1, pageSize: 50 } })],
    ['/api/mods/active', () => ({ json: { mods: [], disabledMods: [], manifestSha256: '0'.repeat(64) } })],
    ['/api/mods/subscriptions', () => ({ json: { items: mods.filter(mod => subscriptions.has(mod.slug)).map(mod => ({ mod, enabled: subscriptions.get(mod.slug), createdAtUtc: user.createdAtUtc, updatedAtUtc: user.createdAtUtc })) } })],
    ['/api/game/layouts', () => ({ status: 201, json: shared })],
    ['/api/game/layouts/ABCD-EFGH', () => ({ json: shared })],
    ['/api/game/players', () => ({ json: { items: [{ displayName: 'Keeper', accountUsername: 'Keeper', bot: false, developer: true, session: 'private-college', partyLeader: 'Hagatha', partySize: 2, activity: 'boneyard', boneyardName: 'The Survival Grounds', waveNumber: 3 }] } })],
    ['/api/game/matches', () => ({ json: { items: [{ id: 'match', boneyardName: 'The Survival Grounds', partyLeader: 'Hagatha', playerCount: 2, players: ['Hagatha', 'Keeper'], session: 'private-college', visibility: 'private', waveNumber: 3 }] } })],
    ['/api/game/parties', () => {
      if (state.failParties) { state.failParties = false; return { status: 503, json: { error: 'Party directory unavailable.' } } }
      return { json: { items: [{ id: 'party', leader: 'Hagatha', members: ['Hagatha', 'Keeper'], memberCount: 2, maxMembers: 16, modCount: 2, cheatsEnabled: true, sessionKind: 'private-college', visibility: 'public', status: 'playing', boneyardName: 'The Survival Grounds' }] } }
    }],
  ])
  for (const mod of mods) {
    routes.set(`/api/mods/${mod.slug}`, () => ({ json: { ...mod, description: 'A stock Boneyard for surviving the hordes.', screenshots: [{ id: 1, url: '/cloud-test/one.png', sortOrder: 0 }, { id: 2, url: '/cloud-test/two.png', sortOrder: 1 }], versions: [{ id: 1, version: '1.0.0', changelog: 'Original release.', fileSize: 1024, downloads: 12, createdAtUtc: user.createdAtUtc }] } }))
    routes.set(`/api/mods/${mod.slug}/subscription`, request => {
      if (request.method() === 'DELETE') subscriptions.delete(mod.slug)
      else subscriptions.set(mod.slug, request.method() === 'PATCH' ? request.postDataJSON().enabled : true)
      return { json: { slug: mod.slug, enabled: subscriptions.get(mod.slug), subscribed: subscriptions.has(mod.slug) } }
    })
    routes.set(`/api/mods/${mod.slug}/comments`, request => {
      if (request.method() === 'POST') {
        const comment = { id: 1, author: user, body: request.postDataJSON().body, createdAtUtc: user.createdAtUtc }
        comments.push(comment)
        return { status: 201, json: comment }
      }
      return { json: { items: comments, total: comments.length } }
    })
    routes.set(`/api/mods/${mod.slug}/comments/1`, () => { comments = []; return { status: 204, body: '' } })
  }
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    const handler = routes.get(path)
    if (!handler) { state.unexpectedRequests.push(path); return route.fulfill({ status: 404, json: { error: 'Unexpected test request.' } }) }
    return route.fulfill(handler(route.request()))
  })
  const images = [await readFile(new URL('../src/assets/game/main-menu-text-dark-cloud.png', import.meta.url)), await readFile(new URL('../src/assets/game/main-menu-text-settings.png', import.meta.url))]
  await page.route('**/cloud-test/*.png', route => route.fulfill({ contentType: 'image/png', body: images[route.request().url().endsWith('one.png') ? 0 : 1] }))
  if (dev) await page.route('**/deployment.json?*', route => route.fulfill({ json: { revision: new URL(route.request().url()).searchParams.get('current') } }))
  await page.addInitScript(({ authenticated, layout }) => {
    if (authenticated) localStorage.setItem('sdr.token', 'native-ui-fixture')
    if (authenticated) localStorage.setItem('solomon-dark-mobile-ui-layout-v1', JSON.stringify(layout))
    window.darkCloudTestPad = { axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), connected: true, id: 'Dark Cloud test controller', index: 0, mapping: 'standard' }
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.darkCloudTestPad] })
    Object.defineProperty(navigator, 'clipboard', { value: { async writeText(code) { window.darkCloudCopiedCode = code } } })
  }, { authenticated, layout })
  return state
}

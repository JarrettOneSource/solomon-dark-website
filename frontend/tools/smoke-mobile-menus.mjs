import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { startGameHost } from '../src/game/host/game-host.ts'

// Mobile menu pass (docs/game-native-parity-re.md, 2026-08-24 "Mobile menu pass: dialog
// fit, one stage skull, skull backs out"): every game dialog and the stage menu skull at
// the iPhone XR landscape geometry Safari really gives us — 896 x 366 with the address bar
// shown (default) or 896 x 414 without it (SDR_MOBILE_MENUS_HEIGHT=414) — with touch
// emulation on. Asserts:
//   - dialog fit: the settings dialog (title, Dark Cloud, Hub, Boneyard, its TWEAK GAME
//     page), the Dark Cloud search modal and the Hub player card sit inside the stage, their
//     DONE / BACK / Close button is fully on screen and at least 44 px tall, and a touch
//     drag scrolls the settings body whenever it overflows;
//   - one stage skull: a 44 px button at stage (4, 4) with 36 px art over the Dark Cloud,
//     the Hub and the Boneyard, reporting its scene and its menu gate;
//   - skull backs out: with a modal open the skull presses that modal's back owner (pause
//     RESUME, settings BACK then DONE, search DONE, player card Close, picker Cancel) and
//     only opens the scene menu when nothing is open.
// Evidence (geometry receipts + screenshots) lands under SDR_MOBILE_MENUS_EVIDENCE_DIR.
const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const credential = randomBytes(32).toString('base64url')
const width = Number(process.env.SDR_MOBILE_MENUS_WIDTH || 896)
const height = Number(process.env.SDR_MOBILE_MENUS_HEIGHT || 366)
const evidenceRoot = process.env.SDR_MOBILE_MENUS_EVIDENCE_DIR
  || `/tmp/solomon-mobile-menus/${width}x${height}`
const IPHONE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) '
  + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const TOUCH_TARGET = 44
const SKULL = '.game-menu-skull'
const SETTINGS = '.game-settings-dialog'
const PAUSE = '.gameplay-pause-overlay'
const errors = []
const receipts = { viewport: { height, width } }

const vite = await createViteServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
const viteAddress = vite.httpServer?.address()
if (!viteAddress || typeof viteAddress === 'string') {
  await vite.close()
  throw new Error('Vite did not expose its local mobile-menus port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
// A private College like the provisioned production runtime: only 'private-college' and
// 'global-hub' sessions own a party system (game-host.ts `privateParties`), and the Hub party
// chip, member card and Player Card that this journey drives exist only with a party.
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  sessionKind: 'private-college',
  snapshotRate: 20,
})
const runtime = { gameEndpoint: { credential, kind: 'localhost', url: host.address.url } }
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output'],
  executablePath: process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome'),
  headless: true,
})
const context = await browser.newContext({
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  userAgent: IPHONE_USER_AGENT,
  viewport: { width, height },
})
const page = await context.newPage()

try {
  await mkdir(evidenceRoot, { recursive: true })
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  await page.route('**/api/mods?**', (route) => route.fulfill({
    body: JSON.stringify({ items: [], page: 1, pageSize: 50, total: 0 }),
    contentType: 'application/json',
    status: 200,
  }))
  await page.route('**/api/game/parties', (route) => route.fulfill({
    body: JSON.stringify({ items: [] }),
    contentType: 'application/json',
    status: 200,
  }))
  // The deployment-revision poll (deployment-revision.ts, every 15 s from Game.tsx) asks for
  // deployment.json; Vite dev serves none, and each 404 lands in `errors`, so answer with the
  // current revision like the other smokes do.
  await page.route('**/deployment.json?*', async (route) => {
    const revision = new URL(route.request().url()).searchParams.get('current')
    await route.fulfill({ json: { revision } })
  })
  await page.addInitScript(bypassStartupAudioPreload)
  await page.addInitScript((configuration) => {
    window.solomonDarkRuntime = configuration
  }, runtime)
  await page.goto(`${baseUrl}/game`, { timeout: 300_000, waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 300_000 })
  await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
  // A fresh browser profile has no save, so the title offers the stock Tutorial prompt
  // (MainMenuScene mounts after save detection settles, so it is already there or never).
  const tutorialOffer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialOffer.isVisible()) {
    await tutorialOffer.getByRole('button', { exact: true, name: 'NO' }).tap()
    await tutorialOffer.waitFor({ state: 'detached' })
  }

  // 1. Title → Settings: the dialog that lost its DONE button on the owner's phone.
  await page.getByRole('button', { name: 'Settings' }).tap()
  await settingsProbe('title-settings', 'DONE')
  await page.locator(SETTINGS).locator('.game-settings-close').tap()
  await page.locator(SETTINGS).waitFor({ state: 'detached' })
  assert.equal(await page.locator(SKULL).count(), 0, 'the title screen has no menu skull')

  // 2. Dark Cloud: skull opens the menu, skull backs out of the menu, settings, search.
  await page.getByRole('button', { name: 'Explore the Dark Cloud' }).tap()
  await page.locator('.dark-cloud-scene').waitFor()
  await page.locator('.main-menu-screen-fade-idle').waitFor()
  await assertSkull('dark-cloud', { available: true, scene: 'dark-cloud' })
  await openMenuWithSkull('dark-cloud-menu')
  await assertSkull('dark-cloud-menu-open', { available: false, scene: 'dark-cloud' })
  await backWithSkull('dark-cloud-menu', PAUSE, 'the skull presses RESUME')
  await assertSkull('dark-cloud-resumed', { available: true, scene: 'dark-cloud' })

  await openMenuWithSkull('dark-cloud-menu-again')
  await page.getByRole('button', { name: 'GAME SETTINGS' }).tap()
  await settingsProbe('dark-cloud-settings', 'DONE')
  await backWithSkull('dark-cloud-settings', SETTINGS, 'the skull presses DONE')
  assert.equal(await page.locator(PAUSE).count(), 0, 'Dark Cloud closes its menu when settings open')

  await page.getByRole('button', { name: 'Search' }).tap()
  const searchModal = page.locator('.dark-cloud-modal')
  await searchModal.waitFor({ timeout: 10_000 })
  const search = await capture('dark-cloud-search', {
    done: '.dark-cloud-modal-done',
    modal: '.dark-cloud-modal',
    stage: '.main-menu-stage',
  })
  assertDialogFits(search, 'dark-cloud-search', { button: 'done', dialog: 'modal' })
  await backWithSkull('dark-cloud-search', '.dark-cloud-modal', 'the skull presses DONE on the search modal')

  await openMenuWithSkull('dark-cloud-menu-exit')
  await page.getByRole('button', { name: 'MAIN MENU' }).tap()
  await page.getByRole('button', { name: 'Play' }).waitFor()
  assert.equal(await page.locator(SKULL).count(), 0, 'the skull leaves with the Dark Cloud')

  // 3. Hub: skull ↔ pause, settings from the pause menu, the player card, the picker.
  await page.getByRole('button', { name: 'Play' }).tap()
  await page.getByRole('button', { name: 'New Game' }).tap()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('textbox', { name: 'Wizard name' }).fill('Aurelia')
  await page.getByRole('button', { name: /water/i }).tap()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').tap()
  const hubScene = page.locator('.hub-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]')
  await hubScene.waitFor({ timeout: 240_000 })
  await page.locator('.main-menu-screen-fade-idle').waitFor()
  await assertSkull('hub', { available: true, scene: 'hub' })
  await openMenuWithSkull('hub-pause')
  await backWithSkull('hub-pause', PAUSE, 'the skull presses RESUME')
  await hubScene.waitFor({ timeout: 10_000 })
  await assertSkull('hub-resumed', { available: true, scene: 'hub' })

  await openMenuWithSkull('hub-pause-again')
  await page.getByRole('button', { name: 'GAME SETTINGS' }).tap()
  await settingsProbe('hub-settings', 'DONE')
  await backWithSkull('hub-settings', SETTINGS, 'the skull presses DONE')
  // Closing gameplay settings resumes play (MainMenuScene onClose), so no pause remains.
  await page.locator(PAUSE).waitFor({ state: 'detached', timeout: 10_000 })
  await hubScene.waitFor({ timeout: 10_000 })

  await page.locator('.hub-party-toggle').tap()
  await page.locator('.hub-party-member-open').first().tap()
  const profile = page.locator('.hub-player-profile')
  await profile.waitFor({ timeout: 10_000 })
  const card = await capture('hub-player-card', {
    body: '.hub-player-profile-body',
    card: '.hub-player-profile',
    close: '.hub-player-profile-close',
    stage: '.main-menu-stage',
  })
  // The card keeps its compact 30 px touch buttons (2026-08-23 touch HUD rounds).
  assertDialogFits(card, 'hub-player-card', { button: 'close', dialog: 'card', minButtonHeight: 30 })
  await backWithSkull('hub-player-card', '.hub-player-profile', 'the skull presses Close on the player card')
  await page.locator('.hub-party-toggle').tap()
  await page.locator('.hub-party-members[hidden]').waitFor({ state: 'attached', timeout: 10_000 })

  await page.getByRole('button', { name: 'Enter the Boneyard' }).tap()
  const boneyardScene = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  const picker = page.locator('.hub-boneyard-picker')
  await Promise.race([
    boneyardScene.waitFor({ timeout: 240_000 }),
    picker.waitFor({ timeout: 240_000 }),
  ])
  if (await picker.isVisible()) {
    await page.locator('.hub-boneyard-option').first().waitFor({ timeout: 30_000 })
    const pickerStop = await capture('hub-boneyard-picker', {
      cancel: '.hub-boneyard-cancel',
      option: '.hub-boneyard-option',
      picker: '.hub-boneyard-picker',
      stage: '.main-menu-stage',
    })
    assertDialogFits(pickerStop, 'hub-boneyard-picker', { button: 'cancel', dialog: 'picker' })
    await backWithSkull('hub-boneyard-picker', '.hub-boneyard-picker', 'the skull presses Cancel on the picker')
    await page.getByRole('button', { name: 'Enter the Boneyard' }).tap()
    await picker.waitFor({ timeout: 30_000 })
    await page.locator('.hub-boneyard-option').first().tap()
  } else {
    // The host owns a single boneyard (the stock random arena) under the stubbed mod list,
    // so the picker never shows here; its fit is covered by the stylesheet contract test.
    receipts['hub-boneyard-picker'] = { skipped: 'single boneyard, picker not shown' }
  }
  await boneyardScene.waitFor({ timeout: 240_000 })
  await page.locator('.main-menu-screen-fade-idle').waitFor()

  // 4. Boneyard: skull ↔ pause, settings and its sub-page backed out one press at a time.
  await assertSkull('boneyard', { available: true, scene: 'boneyard' })
  await openMenuWithSkull('boneyard-pause')
  await page.getByRole('button', { name: 'GAME SETTINGS' }).tap()
  await settingsProbe('boneyard-settings', 'DONE')
  await page.locator(SETTINGS).getByRole('button', { name: 'TWEAK GAME' }).tap()
  await settingsProbe('boneyard-settings-performance', 'BACK')
  await page.locator(SKULL).tap()
  await page.locator(SETTINGS).locator('.game-settings-close', { hasText: 'DONE' }).waitFor({ timeout: 10_000 })
  await capture('boneyard-settings-after-back', { close: '.game-settings-close', dialog: SETTINGS })
  await backWithSkull('boneyard-settings', SETTINGS, 'the skull presses DONE')
  await page.locator(PAUSE).waitFor({ state: 'detached', timeout: 10_000 })
  await assertSkull('boneyard-resumed', { available: true, scene: 'boneyard' })

  process.stdout.write(`${JSON.stringify({ errors, receipts, status: 'ok' }, null, 1)}\n`)
} catch (error) {
  await page.screenshot({ path: join(evidenceRoot, 'failure.png') }).catch(() => {})
  process.stderr.write(`${JSON.stringify({ errors, receipts }, null, 1)}\n`)
  throw error
} finally {
  await browser.close()
  await host.close()
  await vite.close()
}

/** Tap the skull with nothing open: the scene menu must appear. */
async function openMenuWithSkull(label) {
  await page.locator(SKULL).tap()
  const overlay = page.locator(`${PAUSE}[aria-modal="true"]`)
  await overlay.waitFor({ timeout: 10_000 })
  await page.locator('[data-pause-action="resume"]').waitFor({ timeout: 10_000 })
  const paused = await capture(label, { pause: PAUSE, rows: '[data-pause-action]', stage: '.main-menu-stage' })
  assert.ok(paused.members.pause[0]?.visible, `${label}: the scene menu opens on the skull tap`)
  receipts[label].skullOpensMenu = true
}

/** Tap the skull with `selector` open: the skull must press its back owner, closing it. */
async function backWithSkull(label, selector, expectation) {
  const target = page.locator(selector)
  assert.equal(await target.count(), 1, `${label}: ${selector} open before the skull tap`)
  await page.locator(SKULL).tap()
  await target.waitFor({ state: 'detached', timeout: 10_000 })
  receipts[label] = { ...receipts[label], skullBacksOut: expectation }
}

/**
 * The settings dialog fits the stage, its close button (DONE on the root page, BACK on a
 * sub-page) is fully on screen and touch-sized, and a touch drag scrolls the body when
 * the content is taller than the dialog gives it.
 */
async function settingsProbe(label, closeLabel) {
  const dialog = page.locator(SETTINGS)
  await dialog.waitFor()
  await nextPaint()
  const before = await capture(label, {
    backdrop: '.game-settings-backdrop',
    close: '.game-settings-close',
    content: '.game-settings-content',
    dialog: SETTINGS,
    header: '.game-settings-header',
    stage: '.main-menu-stage',
  })
  assertDialogFits(before, label, { button: 'close', dialog: 'dialog' })
  assert.equal(before.members.close[0]?.text, closeLabel, `${label}: close button reads ${closeLabel}`)
  const content = before.members.content[0]
  assert.ok(content?.visible, `${label}: settings content visible`)
  const scrollBefore = await dialog.locator('.game-settings-content').evaluate((node) => (
    { clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop }
  ))
  const x = content.x + content.width / 2
  await touchDrag(x, content.y + content.height * 0.85, x, content.y + content.height * 0.15)
  const scrollAfter = await dialog.locator('.game-settings-content').evaluate((node) => (
    { clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop }
  ))
  receipts[label].scroll = { after: scrollAfter, before: scrollBefore }
  await page.screenshot({ path: join(evidenceRoot, `${label}-after-drag.png`) })
  if (scrollBefore.scrollHeight > scrollBefore.clientHeight + 1) {
    assert.ok(scrollAfter.scrollTop > 0, `${label}: a touch drag scrolls the settings body ${JSON.stringify(scrollAfter)}`)
  } else {
    receipts[label].scroll.fits = true
  }
  // Scroll back so the next probe starts from the top.
  await dialog.locator('.game-settings-content').evaluate((node) => { node.scrollTop = 0 })
}

/** `dialog` sits inside the stage; `button` is visible, fully on screen and touch-sized. */
function assertDialogFits(geometry, label, { button, dialog, minButtonHeight = TOUCH_TARGET }) {
  const [stage] = geometry.members.stage
  const [box] = geometry.members[dialog]
  const [control] = geometry.members[button]
  assert.ok(box?.visible, `${label}: ${dialog} visible`)
  assert.ok(control?.visible, `${label}: ${button} visible`)
  const inside = (inner, outer, slack = 0.75) => (
    inner.x >= outer.x - slack
    && inner.y >= outer.y - slack
    && inner.x + inner.width <= outer.x + outer.width + slack
    && inner.y + inner.height <= outer.y + outer.height + slack
  )
  const viewport = { height: geometry.window.height, width: geometry.window.width, x: 0, y: 0 }
  assert.ok(inside(box, stage), `${label}: ${dialog} ${JSON.stringify(box)} inside the stage ${JSON.stringify(stage)}`)
  assert.ok(inside(control, viewport), `${label}: ${button} ${JSON.stringify(control)} inside the viewport ${JSON.stringify(viewport)}`)
  assert.ok(inside(control, box), `${label}: ${button} ${JSON.stringify(control)} inside ${dialog} ${JSON.stringify(box)}`)
  assert.ok(control.height >= minButtonHeight - 0.75, `${label}: ${button} ${control.height} px tall (touch target ${minButtonHeight})`)
}

/** One 44 px skull at stage (4, 4) with 36 px art, reporting `scene` and its menu gate. */
async function assertSkull(label, { available, scene }) {
  await nextPaint()
  const geometry = await capture(label, { art: `${SKULL} img`, skull: SKULL, stage: '.main-menu-stage' })
  const [stage] = geometry.members.stage
  const [skull] = geometry.members.skull
  const [art] = geometry.members.art
  assert.equal(geometry.members.skull.length, 1, `${label}: exactly one menu skull`)
  assert.ok(skull.visible, `${label}: menu skull visible`)
  const expected = { height: TOUCH_TARGET, width: TOUCH_TARGET, x: stage.x + 4, y: stage.y + 4 }
  for (const key of Object.keys(expected)) {
    assert.ok(Math.abs(skull[key] - expected[key]) <= 0.75,
      `${label}: menu skull ${key} ${skull[key]} (expected ${expected[key]}; stage ${JSON.stringify(stage)})`)
  }
  assert.ok(Math.abs(art.width - 36) <= 0.75, `${label}: skull art ${art.width} px wide (expected 36)`)
  const attributes = await page.locator(SKULL).evaluate((node) => ({
    available: node.dataset.gameMenuAvailable,
    scene: node.dataset.gameMenuScene,
  }))
  assert.deepEqual(attributes, { available: String(available), scene }, `${label}: skull scene and menu gate`)
  receipts[label].skull = attributes
}

async function touchDrag(x1, y1, x2, y2, steps = 12) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] })
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t }],
    })
    await page.waitForTimeout(16)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(400)
  await cdp.detach()
}

async function capture(label, selectors) {
  await settleAnimations()
  await settlePauseReveal()
  await nextPaint()
  const geometry = await page.evaluate((map) => {
    const round = (value) => Math.round(value * 100) / 100
    const members = {}
    for (const [name, selector] of Object.entries(map)) {
      members[name] = [...document.querySelectorAll(selector)].map((node) => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return {
          height: round(rect.height),
          visible: rect.width > 0 && rect.height > 0 && style.display !== 'none'
            && style.visibility !== 'hidden' && Number(style.opacity) > 0,
          width: round(rect.width),
          x: round(rect.x),
          y: round(rect.y),
          ...(node.textContent && node.textContent.length < 24 ? { text: node.textContent.trim() } : {}),
        }
      })
    }
    return {
      members,
      visualViewport: { height: window.visualViewport?.height, scale: window.visualViewport?.scale, width: window.visualViewport?.width },
      window: { height: window.innerHeight, width: window.innerWidth },
    }
  }, selectors)
  await page.screenshot({ path: join(evidenceRoot, `${label}.png`) })
  receipts[label] = { ...receipts[label], ...geometry }
  return geometry
}

async function nextPaint() {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => (
    requestAnimationFrame(resolve)
  ))))
}

/**
 * Evidence frames are settled states: let every finite CSS animation/transition (the
 * 100 ms menu fade-in, the settings dialog transitions) finish before measuring and
 * shooting. Endless animations (pulses) are not waited on; a paused one is capped.
 */
async function settleAnimations() {
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations()
      .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
      .map((animation) => animation.finished.catch(() => {}))),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]))
}

/**
 * The scene menu's reveal is JS-driven, not a CSS animation: GameplayPauseMenu samples
 * nativePauseMenuReveal on requestAnimationFrame (29 ticks of 10 ms), drives the dim
 * alpha, the native panel and the waiting note from it, and stamps it on the overlay as
 * data-gameplay-pause-reveal. document.getAnimations() cannot see that ramp, so wait until
 * every mounted menu reports the settled value before measuring and shooting.
 */
async function settlePauseReveal() {
  await page.waitForFunction(
    () => [...document.querySelectorAll('[data-gameplay-pause-reveal]')]
      .every((node) => node.getAttribute('data-gameplay-pause-reveal') === '1'),
    undefined,
    { timeout: 5_000 },
  )
}

function bypassStartupAudioPreload() {
  const nativeLoad = HTMLMediaElement.prototype.load
  HTMLMediaElement.prototype.load = function loadWithoutDecode() {
    if (!(this instanceof HTMLAudioElement)) return nativeLoad.call(this)
    queueMicrotask(() => this.dispatchEvent(new Event('loadeddata')))
  }
  Object.defineProperty(window, '__sdrRestoreAudioPreload', {
    value: () => { HTMLMediaElement.prototype.load = nativeLoad },
  })
}

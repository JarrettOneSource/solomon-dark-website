import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import {
  addPlayerCharacter, createGameSimulation, damageGameSimulationPlayer, enterBoneyardWorld,
  getPlayerEconomy, getPlayerProgression, removePlayerCharacter,
} from '../src/game/core-server/game-simulation.ts'
import { applyPlayerEntityHagathaPurchaseEffects, replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../src/game/host/boneyard-catalog.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { WEB_GAME_SAVE_SLOT } from '../src/game/save/game-save-contract.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import { observeGameWire, waitUntil } from './game-smoke-navigation.mjs'

// Run against a built candidate with SDR_CHARM_EVIDENCE set to its retained evidence folder.
// Chrome is headed by default; SDR_CHARM_HEADED=0 is a diagnostic-only headless run.
// SDR_CHARM_MODES may select a comma-separated subset for a scoped follow-up.
assert.ok(process.env.SDR_CHARM_EVIDENCE, 'SDR_CHARM_EVIDENCE must name an evidence directory')
const availableModes = ['desktop', 'touch-landscape', 'touch-portrait']
const modes = process.env.SDR_CHARM_MODES?.split(',') ?? availableModes
assert.ok(modes.length > 0 && modes.every(mode => availableModes.includes(mode)), 'Unknown SDR_CHARM_MODES')
const output = resolve(process.env.SDR_CHARM_EVIDENCE)
await mkdir(output, { recursive: true })
const server = await startStaticClientServer({ root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)) })
const headed = process.env.SDR_CHARM_HEADED !== '0'
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: !headed,
})
const errors = { page: [], console: [], responses: [], requests: [] }
const rawRequestFailures = []
const receipts = []
const owner = 'charm-hud-owner'
const peer = 'charm-hud-peer'
const selectors = [27, 24, 25, 27, 20, 0, 1, 2, 4]
const config = { discipline: 'arcane', displayName: 'Charms', element: 'ether' }
let failure = null
try {
  for (const mode of modes) await journey(mode)
  assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [] })
} catch (error) {
  failure = `${error.name}: ${error.message}`
  throw error
} finally {
  await writeFile(join(output, 'receipt.json'), JSON.stringify({ headed, modes, receipts, errors, rawRequestFailures, failure,
    qualification: 'Desktop and touch-landscape use the built client, real authority/replication/audio and public saved-run/leave/resume navigation. Narrow portrait checks only the intentional rotate gate; portrait gameplay is not accepted. Declared fixtures: owned charms, initial spent flags, authoritative damage, reactivation via existing purchase reducer, and one synthetic participant. The removed charm status row must stay absent throughout active, spent and restored states. Touch is Chrome emulation, not physical-device acceptance.' }, null, 2) + '\n')
  await browser.close()
  await server.close()
}

async function journey(mode) {
  const touch = mode !== 'desktop'
  const viewport = mode === 'desktop' ? { width: 1600, height: 900 }
    : mode === 'touch-landscape' ? { width: 896, height: 414 } : { width: 390, height: 844 }
  const catalog = createBoneyardCatalog()
  const loaded = materializeBoneyard(catalog, catalog.choices[0].id, Buffer.alloc(16))
  let initial = installCharms(createGameSimulation({ [owner]: config }), owner, selectors)
  initial = enterBoneyardWorld(initial, loaded)
  initial = damageGameSimulationPlayer(initial, owner, 1, initial.tick)
  const document = createGameSaveDocument({
    integrity: 'local-only', loadedBoneyard: loaded, mods: [], modState: {}, playerId: owner, state: initial,
  })
  const credential = randomBytes(32).toString('base64url')
  const host = await startGameHost({ allowedOrigins: [server.origin],
    authentication: { kind: 'shared', credential }, resetWhenEmpty: true, snapshotRate: 20 })
  const context = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1,
    isMobile: touch, hasTouch: touch })
  const page = await context.newPage()
  const wire = observeGameWire(page)
  let requestContext = 'setup'
  page.setDefaultTimeout(15_000)
  page.on('pageerror', error => errors.page.push(`${mode}: ${error.message}`))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(`${mode}: ${message.text()}`) })
  page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${mode}: ${response.status()} ${response.url()}`) })
  page.on('requestfailed', request => {
    const message = request.failure()?.errorText ?? 'failed'
    const url = new URL(request.url())
    const intentionalLifecycleAbort = message === 'net::ERR_ABORTED'
      && request.method() === 'GET' && request.resourceType() === 'media'
      && url.origin === server.origin && /\.(?:mp3|wav)$/.test(url.pathname)
      && ['resume-run', 'leave-run', 'reload', 'game-over-transition', 'teardown'].includes(requestContext)
    const failure = { mode, at: new Date().toISOString(), url: request.url(),
      method: request.method(), resourceType: request.resourceType(), errorText: message,
      context: requestContext, pageUrl: page.url(),
      classification: intentionalLifecycleAbort ? 'intentional-lifecycle-media-abort' : 'unexpected' }
    rawRequestFailures.push(failure)
    if (!intentionalLifecycleAbort) errors.requests.push(failure)
  })
  await page.addInitScript(installGameAudioSmokeProbe)
  await page.addInitScript(gameEndpoint => { window.solomonDarkRuntime = { gameEndpoint } },
    { kind: 'localhost', credential, url: host.address.url })
  await page.route('**/deployment.json?*', route => route.fulfill({
    json: { revision: new URL(route.request().url()).searchParams.get('current') },
  }))
  try {
    await page.route('**/__charm_seed', route => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>Charm save fixture</title>',
    }))
    requestContext = 'seed-navigation'
    await page.goto(`${server.origin}/__charm_seed`)
    await page.evaluate(record => new Promise((resolveSave, reject) => {
      const request = indexedDB.open('solomon-dark-game-saves', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('slots', { keyPath: 'slot' })
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const transaction = request.result.transaction('slots', 'readwrite')
        transaction.objectStore('slots').put(record)
        transaction.oncomplete = () => { request.result.close(); resolveSave() }
        transaction.onerror = () => reject(transaction.error)
      }
    }), { document, revision: 1, slot: WEB_GAME_SAVE_SLOT })
    requestContext = 'title-load'
    await page.goto(`${server.origin}/game`, { waitUntil: 'domcontentloaded' })
    if (mode === 'touch-portrait') {
      const hint = page.locator('.game-orientation-hint')
      await hint.waitFor({ state: 'visible', timeout: 30_000 })
      requestContext = 'portrait-gate'
      assert.equal(await hint.innerText(), 'Rotate your device to landscape to enter the College.')
      const visibility = await page.locator('.main-menu-stage').evaluate(element => getComputedStyle(element).visibility)
      assert.equal(visibility, 'hidden', 'portrait must preserve the intentional landscape-only policy')
      assert.equal(await page.locator('.run-charm-hud').count(), 0)
      await page.screenshot({ path: join(output, `${mode}-rotate-gate.png`) })
      receipts.push({ mode, viewport, name: 'portrait-rotate-gate', hint: await hint.innerText(),
        stageVisibility: visibility, qualification: 'Rotate prompt only; no portrait gameplay acceptance.' })
      return
    }
    await resume()
    assert.equal(host.hostPlayerId(), owner)
    expectActive(false)
    assert.deepEqual(getPlayerEconomy(host.state(), owner).ownedPerkSelectors, selectors)
    assert.equal(await lossCount(), 0, 'initial spent state must remain silent')
    await capture('initial-spent')

    rearm()
    expectActive(true)
    assert.equal(await lossCount(), 0, 'reactivation does not play a loss')
    Object.assign(host.state(), installCharms(addPlayerCharacter(host.state(), peer,
      { ...config, displayName: 'Peer', element: 'fire' }), peer, [5, 24, 25]))
    damage(peer, 1)
    await page.waitForTimeout(200)
    assert.equal(await lossCount(), 0, 'another owner cannot play the local loss stream')
    damage(owner, 0)
    await page.waitForTimeout(100)
    assert.equal(await lossCount(), 0)
    expectActive(true)
    damage(owner, 1)
    await waitForLoss(1)
    expectActive(false)
    damage(owner, 1)
    await page.waitForTimeout(250)
    assert.equal(await lossCount(), 1, 'repeated hits and snapshots cannot replay loss')
    await capture('authoritative-loss')

    rearm()
    expectActive(true)
    assert.equal(await lossCount(), 1)
    await capture('restored-active')
    Object.assign(host.state(), removePlayerCharacter(host.state(), peer))
    damage(owner, 1)
    await waitForLoss(2)
    const audio = await lossEvents()
    assert.ok(audio.every(event => event.playbackRate === 1 && event.volume > 0))
    await page.locator('.boneyard-scene').focus()
    await page.keyboard.press('Escape')
    const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
    await pause.waitFor()
    requestContext = 'leave-run'
    await pause.getByRole('button', { name: 'LEAVE GAME', exact: true }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 30_000 })
    requestContext = 'title-after-leave'
    assert.equal(await page.locator('.run-charm-hud').count(), 0)
    const beforeReloadAudio = await lossEvents()
    requestContext = 'reload'
    await page.reload({ waitUntil: 'domcontentloaded' })
    await resume()
    expectActive(false)
    await page.waitForTimeout(250)
    assert.equal(await lossCount(), 0, 'resume must not replay saved loss audio')
    await capture('reconnected-spent')
    rearm()
    expectActive(true)
    assert.equal(await lossCount(), 0)
    requestContext = 'game-over-transition'
    damage(owner, 1000)
    await waitUntil(() => host.state().run.phase === 'game-over', 'lethal damage did not end the run', 15_000)
    await waitForLoss(1)
    assert.equal(await page.locator('.run-charm-hud').count(), 0)
    requestContext = 'game-over'
    await page.screenshot({ path: join(output, `${mode}-game-over.png`) })
    receipts.push({ mode, viewport, nativeLossAudio: beforeReloadAudio, resumedLossAudio: await lossEvents(),
      lifecycle: 'initial/resume silent; active/spent/restored; owner-only audio; charm row absent', frames: wire.frames })
  } catch (error) {
    await page.screenshot({ path: join(output, `${mode}-failure.png`) })
    receipts.push({ mode, failure: `${error.name}: ${error.message}`, body: await page.locator('body').innerText() })
    throw error
  } finally {
    requestContext = 'teardown'
    await context.close()
    await host.close()
  }

  async function resume() {
    const play = page.getByRole('button', { name: 'Play', exact: true })
    await play.waitFor({ state: 'visible', timeout: 180_000 })
    requestContext = 'resume-run'
    await play.click()
    await page.getByRole('button', { name: 'Last game', exact: true }).click()
    await page.locator('.boneyard-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]')
      .waitFor({ timeout: 90_000 })
    requestContext = 'active-run'
  }
  function rearm() {
    const live = host.state()
    Object.assign(live, { playerEntities: applyPlayerEntityHagathaPurchaseEffects(
      live.playerEntities, owner, [24, 25], createNativeRng(1),
    ).store })
  }
  function damage(playerId, amount) {
    const live = host.state()
    Object.assign(live, damageGameSimulationPlayer(live, playerId, amount, live.tick))
  }
  function expectActive(active) {
    const runtime = getPlayerProgression(host.state(), owner).hagathaRuntime
    assert.equal(runtime.serendipityActive, active)
    assert.equal(runtime.reverieActive, active)
  }
  function lossEvents() {
    return page.evaluate(() => window.__sdrAudioEvents.filter(event => event.type === 'buffer-start'
      && window.__sdrAudioSourceMatches(event.src, 'lose-reverie.wav')))
  }
  async function lossCount() { return (await lossEvents()).length }
  async function waitForLoss(count) {
    await page.waitForFunction(expected => window.__sdrAudioEvents.filter(event => event.type === 'buffer-start'
      && window.__sdrAudioSourceMatches(event.src, 'lose-reverie.wav')).length === expected, count)
  }
  async function capture(name) {
    assert.equal(await page.locator('.run-charm-hud').count(), 0,
      'owned charms must not render the removed status row')
    assert.deepEqual(getPlayerEconomy(host.state(), owner).ownedPerkSelectors, selectors)
    await page.screenshot({ path: join(output, `${mode}-${name}.png`) })
    receipts.push({ mode, name, charmRowCount: 0,
      ownedCharms: getPlayerEconomy(host.state(), owner).ownedPerkSelectors,
      authority: getPlayerProgression(host.state(), owner).hagathaRuntime })
  }
}

function installCharms(state, playerId, owned) {
  const economy = getPlayerEconomy(state, playerId)
  const tonicPurchases = owned.filter(selector => selector === 27).length
  const store = replacePlayerEconomy(state.playerEntities, playerId, {
    ...economy, charmCapacity: 3 + 3 * tonicPurchases, collegeIntroPending: false,
    firstMixedSelectors: [...new Set(owned)], ownedPerkSelectors: [...owned],
    revision: economy.revision + 1, tonicPurchases, tutorialPending: false,
  })
  return { ...state, playerEntities: applyPlayerEntityHagathaPurchaseEffects(
    store, playerId, owned, createNativeRng(1),
  ).store }
}

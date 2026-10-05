import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { createGameSimulation, enterBoneyardWorld, addPlayerCharacter, getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { createBoneyardCatalog, materializeBoneyard, materializeStockTutorial } from '../src/game/host/boneyard-catalog.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import { createGameSaveDocument, restoreGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { WEB_GAME_SAVE_SLOT } from '../src/game/save/game-save-contract.ts'
import { observeGameWire, waitUntil } from './game-smoke-navigation.mjs'

const output = process.env.SDR_REPORT61_SCENE_OUTPUT
assert.ok(output && resolve(output).startsWith('/Volumes/Drive/codex-acceptance/solomon-report61-d7634e23/'))
await mkdir(output, { recursive: true })
const server = await startStaticClientServer({ root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)) })
const browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH, headless: true })
const receipts = []
const errors = { page: [], console: [], responses: [] }
let failure = null
const owner = 'report61-restored-owner'
const config = { discipline: 'arcane', displayName: 'Summary', element: 'ether' }
try {
  for (const mode of ['survival-desktop', 'tutorial-touch', 'hub-desktop']) await journey(mode)
  assert.deepEqual(errors, { page: [], console: [], responses: [] })
} catch (error) {
  failure = `${error.name}: ${error.message}`
  throw error
} finally {
  await writeFile(join(output, 'receipt.json'), JSON.stringify({ receipts, errors, failure,
    qualification: 'Exact built client, actual host/snapshot/UI/save restoration. Standalone paused fixture changes stay unpublished until public close/resume; a new observed frame precedes reopened current values. Declared numerical fixtures/additional actor/read-only wire metadata; touch is Mac Chrome emulation, not physical-device or network-party evidence.' }, null, 2) + '\n')
  await browser.close()
  await server.close()
}

async function journey(mode) {
  const tutorial = mode === 'tutorial-touch'
  const hub = mode === 'hub-desktop'
  const credential = randomBytes(32).toString('base64url')
  const catalog = createBoneyardCatalog()
  const loaded = hub ? null : tutorial ? materializeStockTutorial(Buffer.alloc(16, 31))
    : materializeBoneyard(catalog, catalog.choices[0].id, Buffer.alloc(16))
  assert.ok(hub || loaded)
  let initial = createGameSimulation({ [owner]: config })
  if (loaded) initial = enterBoneyardWorld(initial, loaded)
  else initial = { ...initial,
    world: { ...initial.world, participants: Object.fromEntries(Object.entries(initial.world.participants).map(([id, row]) =>
      [id, { ...row, collegeIntro: null, region: 'courtyard', transition: null }])) },
    playerEntities: { ...initial.playerEntities, economies: initial.playerEntities.economies.map(row =>
      ({ ...row, collegeIntroPending: false, tutorialPending: false })) } }
  if (loaded) initial = stageNumbers(initial, { wave: 6, monstersKilled: 17, awesomeness: 91 })
  if (hub) {
    // Fund one declared Shlorio roll without changing fresh-Game counters.
    const economy = getPlayerEconomy(initial, owner)
    initial = { ...initial, playerEntities: { ...initial.playerEntities,
      economies: initial.playerEntities.economies.map(row => row === economy
        ? { ...row, gold: row.gold + row.dowsingFee } : row) } }
  }
  const document = createGameSaveDocument({ integrity: 'local-only', loadedBoneyard: loaded, mods: [], modState: {}, playerId: owner, state: initial })
  const restored = restoreGameSaveDocument(document)
  if (loaded) {
    assert.equal(restored.state.world.hallOfFameRuns[owner].monstersKilled, 17)
    assert.equal(restored.state.world.hallOfFameRuns[owner].awesomeness, 91)
    assert.equal(tutorial ? restored.state.world.tutorial.waveOrdinal : restored.state.world.waves.waveOrdinal, 6)
  }
  const host = await startGameHost({ allowedOrigins: [server.origin], authentication: { kind: 'shared', credential }, snapshotRate: 20 })
  const context = await browser.newContext(tutorial
    ? { viewport: { width: 896, height: 414 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const wire = observeGameWire(page)
  page.setDefaultTimeout(15_000)
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
  await page.addInitScript(gameEndpoint => { window.solomonDarkRuntime = { gameEndpoint } }, { kind: 'localhost', credential, url: host.address.url })
  await page.route('**/deployment.json?*', route => route.fulfill({ json: { revision: new URL(route.request().url()).searchParams.get('current') } }))
  let inventory
  try {
    await page.route('**/__report61_seed', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Summary save fixture</title>' }))
    await page.goto(`${server.origin}/__report61_seed`)
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
    await page.goto(`${server.origin}/game`)
    await page.getByRole('button', { name: 'Play', exact: true }).click({ timeout: 90_000 })
    await page.getByRole('button', { name: 'Last game', exact: true }).click()
    await page.locator(hub ? '.hub-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]'
      : '.boneyard-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 90_000 })
    assert.equal(host.hostPlayerId(), owner)
    inventory = page.getByRole('dialog', { name: 'Inventory', exact: true })
    await activate(page.getByRole('button', { name: /Open inventory/ }), tutorial)
    if (hub) await capture('fresh-hub', { wave: 0, monstersKilled: 0, awesomeness: 0 })
    else {
      assert.equal(host.state().world.tutorial !== null, tutorial)
      if (tutorial) assert.equal(host.state().world.waves, null)
      const ownRun = host.state().world.hallOfFameRuns[owner]
      assert.equal(ownRun.monstersKilled, 17)
      assert.equal(ownRun.awesomeness, 91)
      const restoredWave = tutorial ? host.state().world.tutorial.waveOrdinal : host.state().world.waves.waveOrdinal
      await capture('restored', { wave: restoredWave, monstersKilled: 17, awesomeness: 91 })
      const beforeMutation = { ...authority(), snapshotSequence: wire.snapshotSequence() }
      Object.assign(host.state(), stageNumbers(host.state(), { wave: 7, monstersKilled: 19, awesomeness: 164 }))
      await capture('paused-last-published-values', { wave: restoredWave, monstersKilled: 17, awesomeness: 91 })
      assert.equal(host.state().tick, beforeMutation.tick, 'Standalone inventory must retain its authoritative pause')
      receipts.push({ mode, name: 'unpublished-authority-fixture', beforeMutation,
        authority: authority(),
        receivedSnapshotSequence: wire.snapshotSequence() })
      await reopenPublished('public-resume-publishes-current-values')
      await capture('reopened-current-values', { wave: 7, monstersKilled: 19, awesomeness: 164 })
      if (!tutorial) {
        Object.assign(host.state(), addPlayerCharacter(host.state(), 'report61-other-actor', { ...config, displayName: 'Other' }))
        const world = host.state().world
        Object.assign(host.state(), { world: { ...world, hallOfFameRuns: { ...world.hallOfFameRuns,
          'report61-other-actor': { ...world.hallOfFameRuns['report61-other-actor'], monstersKilled: 999, awesomeness: 8888 } } } })
        assert.ok(createGameSnapshot(host.state(), owner).players['report61-other-actor'])
        await reopenPublished('other-actor-publication')
        await page.waitForFunction(() => document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.playerCount === 2)
        await capture('other-actor-isolation', { wave: 7, monstersKilled: 19, awesomeness: 164 })
        Object.assign(host.state(), stageNumbers(host.state(), { wave: 0, monstersKilled: 2, awesomeness: 71 }))
        await reopenPublished('zero-wave-publication')
        await capture('zero-wave-omitted', { wave: 0, monstersKilled: 2, awesomeness: 71 })
      }
      await activate(inventory.getByRole('button', { name: 'Open skills', exact: true }), tutorial)
      const skills = page.getByRole('dialog', { name: 'Skills', exact: true })
      await skills.locator('xpath=self::*[@data-transition-phase="settled"]').waitFor()
      await activate(skills.getByRole('button', { name: 'Open inventory', exact: true }), tutorial)
      const world = host.state().world
      await capture('book-reopened', { wave: tutorial ? world.tutorial.waveOrdinal : world.waves.waveOrdinal,
        monstersKilled: world.hallOfFameRuns[owner].monstersKilled, awesomeness: world.hallOfFameRuns[owner].awesomeness })
    }
    await activate(inventory.getByRole('button', { name: 'Close inventory', exact: true }), tutorial)
    await inventory.waitFor({ state: 'hidden' })
    if (hub) for (const [name, title] of [['Fomentius', "FOMENTIUS' USEFUL THYNGS"], ['Hagatha', "HAGATHA'S CHARMS AND CURSES"], ['Luthacus', "LUTHACUS' SCAVENGED GOODS"], ['Shlorio', "SHLORIO'S DISCOUNT DOWSING"]]) {
      await page.getByRole('button', { name: `Open ${name} interaction`, exact: true }).click()
      const service = page.getByRole('dialog', { name: title, exact: true })
      const canvas = service.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]')
      await canvas.waitFor()
      await canvas.screenshot({ path: join(output, `${mode}-companion-${name}.png`) })
      assert.deepEqual(JSON.parse(await canvas.getAttribute('data-native-inventory-run-summary')), [])
      receipts.push({ mode, name: `companion-${name}`, summary: [] })
      if (name === 'Shlorio') {
        const dowse = service.getByRole('button', { name: /^DOWSE/ })
        await dowse.click()
        await dowse.waitFor({ state: 'detached' })
        assert.equal(getPlayerEconomy(host.state(), owner).dowsingRolled, true)
        await canvas.screenshot({ path: join(output, `${mode}-companion-Shlorio-result.png`) })
        assert.deepEqual(JSON.parse(await canvas.getAttribute('data-native-inventory-run-summary')), [])
        receipts.push({ mode, name: 'companion-Shlorio-result', summary: [] })
      }
      await service.getByRole('button', { name: 'Done', exact: true }).click()
      await service.waitFor({ state: 'hidden' })
    }
  } catch (error) {
    await page.screenshot({ path: join(output, `${mode}-failure.png`) })
    receipts.push({ mode, failure: `${error.name}: ${error.message}`, body: await page.locator('body').innerText() })
    throw error
  } finally {
    await context.close()
    await host.close()
    receipts.push({ mode, name: 'read-only-wire-trace', frames: wire.frames })
  }

  async function reopenPublished(name) {
    const previousSequence = wire.snapshotSequence()
    assert.equal(typeof previousSequence, 'number', 'An actual received snapshot must precede the fixture change')
    await activate(inventory.getByRole('button', { name: 'Close inventory', exact: true }), tutorial)
    await inventory.waitFor({ state: 'hidden' })
    await waitUntil(() => wire.snapshotSequence() > previousSequence,
      'Public pause release did not publish a fresh snapshot', 15_000)
    await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
    receipts.push({ mode, name, previousSequence, publishedSequence: wire.snapshotSequence(),
      authority: authority(), hostPlayerId: host.hostPlayerId() })
    await activate(page.getByRole('button', { name: /Open inventory/ }), tutorial)
  }

  function authority() {
    const state = host.state()
    const run = state.world.hallOfFameRuns[owner]
    return { tick: state.tick, runId: state.world.runId, summary: {
      wave: tutorial ? state.world.tutorial.waveOrdinal : state.world.waves.waveOrdinal,
      monstersKilled: run.monstersKilled, awesomeness: run.awesomeness,
    } }
  }

  async function capture(name, summary) {
    const texts = [...(summary.wave > 0 ? [`Wave: ${summary.wave}`] : []), `Kills: ${summary.monstersKilled}`, `Awesomeness: ${summary.awesomeness}`]
    await page.waitForFunction(expected => {
      const value = document.querySelector('.hub-inventory-native-canvas[data-native-reveal="settled"]')?.dataset.nativeInventoryRunSummary
      return value && JSON.stringify(JSON.parse(value).map(line => line.text)) === JSON.stringify(expected)
    }, texts)
    const canvas = inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]')
    await canvas.screenshot({ path: join(output, `${mode}-${name}.png`) })
    const lines = JSON.parse(await canvas.getAttribute('data-native-inventory-run-summary'))
    receipts.push({ mode, name, summary, lines, runId: host.state().world.runId ?? null, hostPlayerId: host.hostPlayerId() })
    assert.deepEqual(lines.map(line => line.text), texts)
    assert.deepEqual(lines.map(line => [line.x, line.y]), [...(summary.wave > 0 ? [[800, 329]] : []), [800, 344], [800, 364]])
  }
}

function stageNumbers(state, summary) {
  assert.equal(state.world.kind, 'boneyard')
  const world = state.world
  return { ...state, world: { ...world,
    hallOfFameRuns: { ...world.hallOfFameRuns, [owner]: { ...world.hallOfFameRuns[owner], monstersKilled: summary.monstersKilled, awesomeness: summary.awesomeness } },
    tutorial: world.tutorial === null ? null : { ...world.tutorial, introActive: false, introBlend: 1, introDelayTicksRemaining: 0, introFade: 0, waveOrdinal: summary.wave },
    waves: world.waves === null ? null : { ...world.waves, waveOrdinal: summary.wave, phase: 'interwave', interwaveDelayTicks: 100_000 },
  } }
}

async function activate(locator, touch) {
  if (touch) await locator.tap()
  else await locator.click()
}

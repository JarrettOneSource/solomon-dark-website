import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { finalizeNativeCreateLoadout } from '../src/game/core-kernels/native-create-loadout.ts'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import { damagePlayerEntity } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { restoreGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import { enterBoneyard, waitUntil } from './game-smoke-navigation.mjs'

const output = process.env.SDR_CREATE_OUTPUT || '/tmp/solomon-create-randomize'
await mkdir(output, { recursive: true })
const server = await startStaticClientServer({ root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)) })
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, args: ['--autoplay-policy=no-user-gesture-required'],
})
const receipts = []
try {
  receipts.push(await journey({ label: 'teardown', seed: 0,
    viewport: { width: 1600, height: 900 }, touch: false, lifecycle: true }))
  receipts.push(await journey({ label: 'desktop', seed: 4, viewport: { width: 1600, height: 900 }, touch: false }))
  receipts.push(await journey({ label: 'touch', seed: 0, viewport: { width: 914, height: 412 }, touch: true }))
  for (const selected of ['ether', 'fire', 'air', 'water', 'earth']) {
    receipts.push(await journey({ label: `selected-${selected}`, selected, seed: 4,
      viewport: { width: 1280, height: 960 }, touch: false }))
  }
  const receipt = { browser: browser.version(), headed: true, receipts }
  await writeFile(`${output}/receipt.json`, JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
} finally {
  await browser.close()
  await server.close()
}

async function journey({ label, seed, viewport, touch, selected = null, lifecycle = false }) {
  const credential = randomBytes(24).toString('base64url')
  const errors = { page: [], console: [], responses: [], host: [], unexpectedApi: [] }
  const host = await startGameHost({ allowedOrigins: [server.origin],
    authentication: { kind: 'shared', credential }, createBoneyardSeedBytes: () => Buffer.alloc(16),
    snapshotRate: 20, log: row => { if (row.level === 'error') errors.host.push(row) },
  })
  const contexts = []
  const page = await openPage(viewport, touch)
  let peer = null
  const checks = []
  try {
    await newGame(page)
    if (lifecycle) {
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await page.getByRole('button', { name: /^new game$/i }).waitFor()
      assert.equal(await page.locator('.create-menu-scene').count(), 0)
      assert.equal(host.capacityParticipantCount(), 0)
      await page.getByRole('button', { name: /^new game$/i }).click()
      await page.locator('.create-menu-scene[data-input-ready="true"]').waitFor()
      await page.getByRole('button', { name: 'Randomize wizard loadout', exact: true }).click()
      assert.equal(await page.getByRole('button', { name: 'Back', exact: true }).isDisabled(), true)
      await page.goBack()
      await page.getByRole('heading', { name: 'The Revival Story', exact: true }).waitFor()
      await page.waitForTimeout(350)
      assert.equal(await page.locator('.create-menu-scene').count(), 0)
      assert.equal(await page.evaluate(() => window.__createProbe.sent.length), 0,
        'route teardown must cancel the pending Create commit before host admission')
      assert.equal(host.capacityParticipantCount(), 0)
      await page.goForward()
      await newGame(page)
    }
    const name = page.getByRole('textbox', { name: 'Wizard name', exact: true })
    const dice = page.getByRole('button', { name: 'Randomize wizard loadout', exact: true })
    await name.fill('DiceMage')
    if (selected) {
      await page.locator('.create-menu-elements[data-visible="true"]').waitFor({ timeout: 30_000 })
      await page.getByRole('button', { name: selected, exact: true }).click()
      assert.equal(await page.locator('.create-menu-scene').getAttribute('data-motion-settled'), 'false')
    }
    const geometry = await dice.evaluate(button => {
      const rect = button.getBoundingClientRect()
      const stage = button.parentElement.getBoundingClientRect()
      return { style: [button.style.left, button.style.top, button.style.width, button.style.height],
        rightGap: stage.right - rect.right, topGap: rect.top - stage.top,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }
    })
    assert.deepEqual(geometry.style, ['1516px', '0px', '84px', '60px'])
    assert.ok(Math.abs(geometry.rightGap) < 0.1 && Math.abs(geometry.topGap) < 0.1)
    await page.screenshot({ path: `${output}/${label}-dice.png` })
    if (touch) await dice.tap()
    else if (selected) await dice.click()
    else { await dice.focus(); await page.keyboard.press('Enter') }
    // Repeated input after acceptance cannot create another commit.
    await dice.evaluate(button => { button.click(); button.click() }).catch(() => {})
    await waitForHub(page)
    const playerId = host.hostPlayerId()
    assert.ok(playerId)
    const expected = selected ? finalizeNativeCreateLoadout(createNativeRng(seed), {
      displayName: 'DiceMage', element: selected, discipline: null,
    }).config : label === 'desktop'
      ? { displayName: 'DiceMage', element: 'fire', discipline: 'air' }
      : { displayName: 'DiceMage', element: 'water', discipline: 'arcane' }
    assert.deepEqual(config(playerId), expected)
    checks.push(await auditCommit(page, 'client-hello', 1))
    await verifySaved(page, expected)
    console.log(JSON.stringify({ label, stage: 'fresh-dice-confirmed', config: expected }))
    if (label === 'desktop') {
      peer = await openPage({ width: 1280, height: 720 }, false)
      await newGame(peer)
      await peer.getByRole('textbox', { name: 'Wizard name', exact: true }).fill('PeerMage')
      await manual(peer, 'earth', 'body')
      await waitForHub(peer)
      await nextWizard()
      await name.fill('KeptMage')
      await page.getByRole('button', { name: 'water', exact: true }).click()
      assert.equal(await page.locator('.create-menu-scene').getAttribute('data-motion-settled'), 'false')
      assert.equal(await dice.isEnabled(), true, 'dice works during the element-selection motion')
      await dice.evaluate(button => { button.click(); button.click() })
      await waitUntil(() => host.state().run.loadoutReadyPlayerIds.includes(playerId), 'first ready barrier', 10_000)
      const selected = finalizeNativeCreateLoadout(createNativeRng(seed), {
        displayName: 'KeptMage', element: 'water', discipline: null,
      }).config
      assert.deepEqual(config(playerId), selected)
      assert.equal(await name.inputValue(), 'KeptMage')
      assert.equal(await name.evaluate(input => input.readOnly), true)
      assert.equal(await dice.isDisabled(), true)
      assert.equal(await page.getByRole('button', { name: 'Clear wizard name', exact: true }).isDisabled(), true)
      await dice.evaluate(button => button.click())
      const peerName = peer.getByRole('textbox', { name: 'Wizard name', exact: true })
      assert.equal(await peerName.evaluate(input => input.readOnly), false)
      await peerName.fill('PeerNext')
      await manual(peer, 'air', 'mind')
      await waitForHub(page)
      await waitForHub(peer)
      checks.push(await auditCommit(page, 'client-confirm-loadout', 1))
      await verifySaved(page, selected)

      await nextWizard()
      await manual(peer, 'fire', 'body')
      await waitUntil(() => host.state().run.loadoutReadyPlayerIds.length === 1, 'peer-first ready barrier', 10_000)
      await name.fill('RetryMage')
      await page.getByRole('button', { name: 'earth', exact: true }).click()
      await page.evaluate(() => { window.__createProbe.failNext = true })
      await dice.click()
      await page.locator('.create-menu-scene[data-finalizing="false"]').waitFor({ timeout: 10_000 })
      assert.equal(await name.evaluate(input => input.readOnly), false)
      assert.equal(await name.inputValue(), 'RetryMage')
      assert.equal(await page.locator('.create-menu-scene').getAttribute('data-element'), 'earth')
      assert.equal(await dice.isEnabled(), true)
      await dice.click()
      await waitForHub(page)
      await waitForHub(peer)
      assert.equal(config(playerId).displayName, 'RetryMage')
      assert.equal(config(playerId).element, 'earth')
      checks.push(await auditCommit(page, 'client-confirm-loadout', 2))
      assert.equal(await page.evaluate(() => window.__createProbe.failures), 1)
      await verifySaved(page, config(playerId))
      await peer.context().close()
      peer = null
      await waitUntil(() => host.state().playerEntities.identities.length === 1, 'peer departure', 10_000)
      await nextWizard()
      await page.getByRole('button', { name: 'Clear wizard name', exact: true }).click()
      await dice.click()
      await waitForHub(page)
      assert.equal(config(playerId).displayName, 'Genericus')
      checks.push(await auditCommit(page, 'client-confirm-loadout', 3))
    }
    await page.screenshot({ path: `${output}/${label}-hub.png` })
    for (const rows of Object.values(errors)) assert.deepEqual(rows, [])
    return { label, seed, geometry, expected, finalConfig: config(host.hostPlayerId()),
      peerOrdersAndRetry: label === 'desktop', backAndPendingRouteTeardown: lifecycle, checks, errors }
  } catch (error) {
    await page.screenshot({ path: `${output}/${label}-failure.png` }).catch(() => {})
    console.error(JSON.stringify({ label, errors, body: (await page.locator('body').innerText()).slice(0, 1800) }))
    throw error
  } finally {
    for (const context of contexts) await context.close()
    await host.close()
  }

  function config(playerId) {
    const state = host.state()
    return state.playerEntities.configs[state.playerEntities.identities.findIndex(row => row.playerId === playerId)]
  }

  async function openPage(size, hasTouch) {
    const context = await browser.newContext({ viewport: size, hasTouch, isMobile: hasTouch })
    contexts.push(context)
    const page = await context.newPage()
    await page.addInitScript(({ endpoint, seed }) => {
      window.solomonDarkRuntime = { gameEndpoint: endpoint }
      window.__createProbe = { sent: [], clicks: [], failNext: false, failures: 0 }
      const random = crypto.getRandomValues.bind(crypto)
      crypto.getRandomValues = values => {
        if (values instanceof Uint32Array && values.length === 1) { values[0] = seed; return values }
        return random(values)
      }
      const send = WebSocket.prototype.send
      WebSocket.prototype.send = function (payload) {
        const message = typeof payload === 'string' ? JSON.parse(payload) : null
        if (message?.type === 'client-confirm-loadout' && window.__createProbe.failNext) {
          window.__createProbe.failNext = false
          window.__createProbe.failures += 1
          throw new Error('Fixture loadout send failure')
        }
        const result = send.call(this, payload)
        if (['client-hello', 'client-confirm-loadout'].includes(message?.type)) {
          window.__createProbe.sent.push({ at: performance.now(), type: message.type,
            config: message.character ?? { displayName: message.displayName, element: message.element, discipline: message.discipline } })
        }
        return result
      }
      document.addEventListener('click', event => {
        if (event.target.closest?.('[data-game-create-randomize]')) window.__createProbe.clicks.push(performance.now())
      }, true)
    }, { endpoint: { kind: 'localhost', url: host.address.url, credential }, seed })
    await page.addInitScript(installGameAudioSmokeProbe, {})
    await page.route('**/deployment.json*', route => route.fulfill({
      json: { revision: new URL(route.request().url()).searchParams.get('current') },
    }))
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/mods/active') return route.fulfill({ json: { disabledMods: [], mods: [], manifestSha256: '0'.repeat(64) } })
      if (['/api/mods', '/api/game/parties', '/api/game/players'].includes(path)) {
        return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 50 } })
      }
      errors.unexpectedApi.push(`${route.request().method()} ${path}`)
      return route.fulfill({ status: 501, json: { error: 'Unexpected local fixture route' } })
    })
    page.on('pageerror', error => errors.page.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
    page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
    await page.goto(`${server.origin}/${lifecycle ? 'about' : 'game'}`)
    if (lifecycle) await page.locator('a[href="/game"]:visible').first().click()
    return page
  }

  async function nextWizard() {
    await enterBoneyard(page)
    await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 30_000 })
    const state = host.state()
    let playerEntities = state.playerEntities
    for (const { playerId } of playerEntities.identities) {
      playerEntities = damagePlayerEntity(playerEntities, playerId, 100_000, state.tick)
    }
    Object.assign(state, { playerEntities })
    await waitUntil(() => host.state().run.phase === 'game-over' && host.state().run.gameOverTicks >= 500,
      'Game Over did not become dismissible', 30_000)
    await page.getByRole('button', { name: /^Game over\./ }).click()
    await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 90_000 })
    if (peer) await peer.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 90_000 })
  }
}

async function newGame(page) {
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: /^new game$/i }).click()
  await page.locator('.create-menu-scene[data-input-ready="true"]').waitFor({ timeout: 90_000 })
}

async function manual(page, element, discipline) {
  await page.locator('.create-menu-elements[data-visible="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: element, exact: true }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: discipline, exact: true }).click()
}

async function waitForHub(page) {
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.locator('.match-loading-screen').waitFor({ state: 'detached', timeout: 90_000 })
}

async function auditCommit(page, type, expectedCount) {
  const observed = await page.evaluate(({ type }) => {
    const sent = window.__createProbe.sent.filter(row => row.type === type)
    const last = sent.at(-1)
    const clicks = window.__createProbe.clicks.filter(at => at <= last.at)
    let click = clicks.pop()
    while (clicks.length && click - clicks.at(-1) < 25) click = clicks.pop()
    const audio = window.__sdrAudioEvents.filter(event => event.at >= click && event.at <= last.at
      && (event.type === 'play' || event.type === 'buffer-start'))
    return { count: sent.length, last, delayMs: last.at - click,
      catchCues: audio.filter(event => window.__sdrAudioSourceMatches(event.src, 'catchit.wav')).length,
      clickCues: audio.filter(event => window.__sdrAudioSourceMatches(event.src, 'click.wav')).length }
  }, { type })
  assert.equal(observed.count, expectedCount)
  assert.ok(observed.delayMs >= 225 && observed.delayMs < 5000, `native fade delay ${observed.delayMs}`)
  assert.equal(observed.catchCues, 0, 'random completion bypasses the manual catch choreography')
  assert.equal(observed.clickCues, 1)
  return observed
}

async function verifySaved(page, expected) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const document = await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('solomon-dark-game-saves', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('slots')) { db.close(); resolve(null); return }
        const read = db.transaction('slots').objectStore('slots').get(0)
        read.onsuccess = () => { resolve(read.result?.document ?? null); db.close() }
        read.onerror = () => { reject(read.error); db.close() }
      }
    }))
    if (document) {
      const actual = restoreGameSaveDocument(document).state.playerEntities.configs[0]
      if (['displayName', 'element', 'discipline'].every(key => actual[key] === expected[key])) return
    }
    await page.waitForTimeout(50)
  }
  throw new Error('mixed-root local save did not retain the confirmed identity')
}

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import { NATIVE_SKILL_BOOK_DEFINITIONS, createNativeSkillBookInventoryItem, insertLootInventoryItem } from '../src/game/core-kernels/hub-economy.ts'
import { NATIVE_SKILL_CATALOG } from '../src/game/core-kernels/player-progression.ts'
import { getPlayerEconomy, getPlayerSkillBook, getPlayerProgression } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy, restorePlayerEntityHealth } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { decodeServerGameMessage } from '../src/game/protocol/game-protocol.ts'
import { enterElementHub, enterBoneyard, openBoneyardCombat } from './game-smoke-navigation.mjs'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const output = process.env.SDR_ITEM_SKILL_BOOK_OUTPUT || '/tmp/solomon-item-skill-books'
await mkdir(output, { recursive: true })
const root = fileURLToPath(new URL('../', import.meta.url))
const frontend = await preview({ root, configFile: `${root}vite.config.ts`, logLevel: 'error', preview: { host: '127.0.0.1', port: 0 } })
const origin = `http://127.0.0.1:${frontend.httpServer.address().port}`
const browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
try {
  const journeys = []
  for (const scenario of [
    { name: 'college-desktop', scene: 'hub', peers: 1, touch: false, nested: false, width: 1600, height: 900 },
    { name: 'boneyard-two-clients', scene: 'boneyard', peers: 2, touch: false, nested: true, width: 1600, height: 900 },
    { name: 'college-touch', scene: 'hub', peers: 1, touch: true, nested: true, width: 844, height: 390 },
  ]) journeys.push(await journey(scenario))
  const receipt = { status: 'ok', browser: browser.version(), journeys }
  await writeFile(`${output}/receipt.json`, JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
} finally { await browser.close(); await frontend.close() }

async function journey(scenario) {
  const errors = { host: [], page: [], console: [], responses: [], requests: [], wire: [] }
  const credential = randomBytes(32).toString('base64url')
  const host = await startGameHost({ allowedOrigins: [origin], authentication: { kind: 'shared', credential },
    createBoneyardSeedBytes: () => Buffer.alloc(16),
    log: event => { if (event.level === 'error') errors.host.push({ event: event.event, message: event.message }) },
  })
  const contexts = [], pages = []
  let refill
  try {
    for (let index = 0; index < scenario.peers; index += 1) {
      const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height },
        hasTouch: scenario.touch, isMobile: scenario.touch, deviceScaleFactor: 1 })
      contexts.push(context)
      const page = await context.newPage(); pages.push(page)
      page.on('pageerror', error => errors.page.push(error.message))
      page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
      page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
      page.on('requestfailed', request => {
        if (request.failure()?.errorText === 'net::ERR_ABORTED' && /\.(mp3|ogg)(\?|$)/.test(request.url())) return
        errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`)
      })
      page.on('websocket', socket => {
        socket.on('socketerror', error => errors.wire.push(String(error)))
        socket.on('framereceived', ({ payload }) => {
          try {
            const message = decodeServerGameMessage(String(payload))
            if (message.type === 'server-error') errors.wire.push(message.message)
          } catch (error) { errors.wire.push(error.message) }
        })
      })
      await page.addInitScript(installGameAudioSmokeProbe)
      await page.addInitScript(endpoint => { window.solomonDarkRuntime = { gameEndpoint: endpoint } },
        { credential, kind: 'localhost', url: host.address.url })
      await page.route('**/deployment.json*', route => route.fulfill({ json: { revision: new URL(route.request().url()).searchParams.get('current') } }))
      await enterElementHub(page, origin, index === 0 ? 'Water' : 'Fire')
    }
    if (scenario.scene === 'boneyard') {
      await pages[0].bringToFront()
      await enterBoneyard(pages[0])
      await Promise.all(pages.map(page => page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90000 })))
      await openBoneyardCombat(host, host.hostPlayerId())
      // Only local fixture health is replenished while inspecting menus; loot,
      // book choices, skill caps and all grant/offer RNG remain unmodified.
      refill = setInterval(() => {
        const state = host.state()
        let entities = state.playerEntities
        for (const row of entities.identities) entities = restorePlayerEntityHealth(entities, row.playerId, 1000)
        Object.assign(state, { playerEntities: entities })
      }, 100)
    }
    const page = pages.at(-1)
    const playerId = host.state().playerEntities.identities.at(-1).playerId
    const peerId = scenario.peers > 1 ? host.hostPlayerId() : null
    await page.bringToFront()
    await ready(page, scenario.scene)
    const initialAudio = await audioCount(page)
    const otherAudio = peerId ? await audioCount(pages[0]) : 0
    const before = [...getPlayerSkillBook(host.state(), playerId).permanentRanks]
    const peerBefore = peerId ? [...getPlayerSkillBook(host.state(), peerId).permanentRanks] : null
    const rankBook = insertBook(host, playerId, 3, scenario.nested)
    await openAndUse(page, rankBook, scenario.touch)
    const dialog = page.getByRole('dialog', { name: 'Skill improved', exact: true })
    await dialog.waitFor({ timeout: 10000 })
    const outcome = getPlayerEconomy(host.state(), playerId).actionFeedback.skillBookOutcome
    assert.equal(outcome.kind, 'rank'); assert.notEqual(outcome.skillId, null)
    const after = [...getPlayerSkillBook(host.state(), playerId).permanentRanks]
    assert.deepEqual(after.flatMap((rank, id) => rank === before[id] ? [] : [id]), [outcome.skillId])
    assert.equal(after[outcome.skillId], before[outcome.skillId] + 1)
    const text = `${NATIVE_SKILL_CATALOG[outcome.skillId].name} +1`
    assert.ok((await dialog.innerText()).includes(text))
    await page.getByRole('dialog', { name: 'Inventory', exact: true }).waitFor({ state: 'hidden' })
    await page.waitForFunction(() => window.__sdrAudioEvents.some(event => event.type === 'buffer-start' && event.src.includes('magic-book-get') && event.playbackRate === 1 && event.volume > 0))
    const okayBounds = await dialog.getByRole('button', { name: 'OKAY', exact: true }).boundingBox()
    assert.ok(okayBounds && okayBounds.x >= 0 && okayBounds.y >= 0
      && okayBounds.x + okayBounds.width <= scenario.width + 1 && okayBounds.y + okayBounds.height <= scenario.height + 1)
    const tick = host.state().tick
    await page.waitForTimeout(600)
    assert.equal(await page.locator('.main-menu-page').getAttribute('data-gameplay-resume-grace'), 'none')
    assert.equal(await audioCount(page), initialAudio + 1, 'Repeated snapshots replayed book audio')
    assert.equal(await dialog.count(), 1)
    if (scenario.scene === 'boneyard') assert.equal(host.state().tick, tick, 'Result did not retain Inventory pause')
    if (peerId) {
      assert.deepEqual(getPlayerSkillBook(host.state(), peerId).permanentRanks, peerBefore)
      assert.equal(await pages[0].getByRole('dialog', { name: 'Skill improved', exact: true }).count(), 0)
      assert.equal(await audioCount(pages[0]), otherAudio)
    }
    await page.screenshot({ path: `${output}/${scenario.name}-rank-result.png` })
    await activate(dialog.getByRole('button', { name: 'OKAY', exact: true }), scenario.touch)
    await dialog.waitFor({ state: 'hidden' })
    await ready(page, scenario.scene)
    const resumedTick = host.state().tick
    await page.waitForTimeout(150)
    assert.ok(host.state().tick > resumedTick)
    assert.deepEqual(getPlayerSkillBook(host.state(), playerId).permanentRanks, after)

    const choiceBook = insertBook(host, playerId, 2, false)
    await openAndUse(page, choiceBook, scenario.touch)
    const picker = page.getByRole('dialog', { name: /Select a skill/ })
    await picker.waitFor({ timeout: 15000 })
    await picker.locator('.skill-picker-stage[data-reveal-interactive="true"]').waitFor({ timeout: 15000 })
    assert.equal(await dialog.count(), 0, 'Choice book must use the normal picker, not a rank result')
    assert.deepEqual(getPlayerSkillBook(host.state(), playerId).permanentRanks, after)
    await page.screenshot({ path: `${output}/${scenario.name}-choice-picker.png` })
    const option = picker.locator('.skill-picker-action').first()
    const selectedSkillId = Number(await option.getAttribute('data-skill-id'))
    await activate(option, scenario.touch)
    await picker.waitFor({ state: 'hidden', timeout: 15000 })
    await ready(page, scenario.scene)
    assert.ok(getPlayerSkillBook(host.state(), playerId).permanentRanks[selectedSkillId] > after[selectedSkillId])
    assert.equal(getPlayerProgression(host.state(), playerId).pendingOffer, null)
    assert.equal(await audioCount(page), initialAudio + 2)
    assert.equal(await dialog.count(), 0)
    assert.ok(Object.values(errors).every(values => values.length === 0), JSON.stringify(errors))
    return { name: scenario.name, rankSkillId: outcome.skillId, rankText: text, choiceSkillId: selectedSkillId,
      bookPlays: 2, peers: scenario.peers, touch: scenario.touch, nested: scenario.nested, okayBounds,
      noPrematureResume: true, otherPlayerUnchanged: true, errors }
  } catch (error) {
    await pages.at(-1)?.screenshot({ path: `${output}/${scenario.name}-failure.png` }).catch(() => {})
    console.error(JSON.stringify({ scenario: scenario.name, errors, run: host.state().run }))
    throw error
  } finally {
    clearInterval(refill)
    await Promise.all(contexts.map(context => context.close()))
    await host.close()
  }
}

async function ready(page, scene) {
  await page.locator(`.${scene}-scene[data-gameplay-input-blocked="false"][data-renderer-state="ready"]`).waitFor({ timeout: 30000 })
}
function insertBook(host, playerId, subtype, nested) {
  const state = host.state(), economy = getPlayerEconomy(state, playerId)
  const book = createNativeSkillBookInventoryItem(NATIVE_SKILL_BOOK_DEFINITIONS.find(row => row.nativeSubtype === subtype), 1)
  // Item_Sack subtype0, Inventory70, from the existing native shop definition.
  const item = nested ? { ...book, nativeTypeId: 7008, nativeSubtype: 0, kind: 'sack', name: 'Sack', iconRecords: [70], contents: [book] } : book
  const inserted = insertLootInventoryItem(economy, item)
  assert.equal(inserted.accepted, true)
  Object.assign(state, { playerEntities: replacePlayerEconomy(state.playerEntities, playerId, inserted.state) })
  const added = inserted.state.backpack.at(-1)
  return { rootId: added.id, bookId: nested ? added.contents[0].id : added.id, nested }
}
async function openAndUse(page, item, touch) {
  await activate(page.getByRole('button', { name: /Open inventory/ }), touch)
  const inventory = page.getByRole('dialog', { name: 'Inventory', exact: true })
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  if (item.nested) {
    await doubleActivate(inventory.locator(`[data-inventory-item-id="${item.rootId}"]`).first(), touch)
    await inventory.locator(`[data-inventory-item-id="${item.bookId}"]`).first().waitFor()
  }
  await doubleActivate(inventory.locator(`[data-inventory-item-id="${item.bookId}"]`).first(), touch)
}
async function activate(locator, touch) { if (touch) await locator.tap(); else await locator.click() }
async function doubleActivate(locator, touch) {
  if (touch) { await locator.tap(); await locator.tap() } else await locator.dblclick()
}
async function audioCount(page) {
  return page.evaluate(() => window.__sdrAudioEvents.filter(event => event.type === 'buffer-start' && event.src.includes('magic-book-get')).length)
}

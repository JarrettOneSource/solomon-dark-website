import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { startGameHost } from '../src/game/host/game-host.ts'
import {
  getPlayerProgression, getPlayerSkillBook, grantGameSimulationPlayerExperience,
} from '../src/game/core-server/game-simulation.ts'
import { enterElementHub, enterBoneyard, waitUntil } from './game-smoke-navigation.mjs'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import { decodeServerGameMessage } from '../src/game/protocol/game-protocol.ts'
import { EntityReplicationReconstructor } from '../src/game/protocol/entity-replication.ts'

const evidence = process.env.SDR_TOOLTIP_EVIDENCE || '/tmp/solomon-skill-tooltip'
const baseline = process.argv.includes('--baseline')
await mkdir(evidence, { recursive: true })
const server = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const errors = { page: [], console: [], responses: [] }
const receipts = []
let host
let wire
try {
  for (const scenario of [
    { name: 'desktop', width: 1600, height: 900, touch: false },
    ...(baseline ? [] : [{ name: 'touch', width: 844, height: 390, touch: true }]),
  ]) {
    const credential = randomBytes(32).toString('base64url')
    host = await startGameHost({
      allowedOrigins: [server.origin], authentication: { kind: 'shared', credential },
      sessionKind: 'standalone', snapshotRate: 20,
      createBoneyardSeedBytes: () => Buffer.alloc(16),
    })
    const context = await browser.newContext({
      viewport: { width: scenario.width, height: scenario.height },
      hasTouch: scenario.touch, isMobile: scenario.touch,
    })
    const page = await context.newPage()
    wire = { playerId: null, sequence: -1, snapshot: null, errors: [] }
    const reconstructor = new EntityReplicationReconstructor()
    page.on('websocket', socket => {
      if (new URL(socket.url()).href !== new URL(host.address.url).href) return
      socket.on('framereceived', ({ payload }) => {
        try {
          const message = decodeServerGameMessage(Buffer.isBuffer(payload) ? payload.toString() : payload)
          if (message.type === 'server-welcome') {
            wire.playerId = message.playerId
            wire.snapshot = message.snapshot
            wire.sequence = message.snapshotSequence
            reconstructor.reset(message.snapshot, message.snapshotSequence)
          } else if (message.type === 'server-snapshot' && message.sequence > wire.sequence) {
            wire.snapshot = reconstructor.apply(message.frame, message.sequence)
            wire.sequence = message.sequence
          }
        } catch (error) { wire.errors.push(error.message) }
      })
    })
    page.on('pageerror', error => errors.page.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
    page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
    await page.addInitScript(installGameAudioSmokeProbe)
    await page.addInitScript(runtime => { window.solomonDarkRuntime = runtime }, {
      gameEndpoint: { credential, kind: 'localhost', url: host.address.url },
    })
    await page.route('**/deployment.json?*', route => route.fulfill({
      json: { revision: new URL(route.request().url()).searchParams.get('current') },
    }))
    await enterElementHub(page, server.origin, 'Fire')
    await page.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor()
    await page.locator('.main-menu-screen-fade-idle').waitFor()
    await page.waitForFunction(() => document.querySelector('.hub-world-canvas')?.dataset.transitionPhase === 'none')
    const playerId = host.hostPlayerId()
    assert.equal(wire.playerId, playerId)
    await acceptPicker(page, scenario, playerId, 'hub', 1)
    if (!baseline) {
      await acceptBook(page, scenario, 'hub', 1)
      await enterBoneyard(page)
      await page.locator('.main-menu-page[data-gameplay-resume-grace="none"]').waitFor({ timeout: 20000 })
      await acceptBook(page, scenario, 'boneyard', 1)
      await acceptPicker(page, scenario, playerId, 'boneyard', 2)
    }
    await context.close()
    assert.deepEqual(wire.errors, [])
    await host.close()
    host = null
  }
  assert.deepEqual(errors, { page: [], console: [], responses: [] })
  console.log(JSON.stringify({ status: baseline ? 'baseline-captured' : 'ok', productionClient: true, receipts, errors }))
} finally {
  await browser.close()
  await host?.close()
  await server.close()
}

async function acceptPicker(page, scenario, playerId, scene, targetRank) {
  await page.locator(scene === 'hub' ? '.hub-scene' : '.boneyard-scene').focus()
  const enteringTick = host.state().tick
  await page.keyboard.down('d')
  await waitUntil(() => host.state().tick > enteringTick + 5,
    'fixture needs an active host before the level-up barrier', 15000)
  const before = getPlayerProgression(host.state(), playerId)
  const next = grantGameSimulationPlayerExperience(host.state(), playerId,
    before.nextThreshold - before.experience + 1)
  const index = next.playerEntities.identities.findIndex(identity => identity.playerId === playerId)
  const progression = next.playerEntities.progressions[index]
  assert.ok(progression.pendingOffer)
  const progressions = [...next.playerEntities.progressions]
  progressions[index] = { ...progression, pendingOffer: {
    ...progression.pendingOffer,
    options: [{ skillId: 58, targetRank }, { skillId: 57, targetRank: 1 }, { skillId: 53, targetRank: 1 }],
  } }
  // A private deterministic offer fixture; normal replication, details and selection remain active.
  Object.assign(host.state(), { ...next, playerEntities: { ...next.playerEntities, progressions } })
  // Match smoke-skill-picker: publish the prepared barrier with a new input
  // edge, rather than waiting for ticks that the barrier intentionally stops.
  await page.keyboard.down('w')
  const stage = page.locator('.skill-picker-stage[data-picker-phase="settled"][data-reveal-interactive="true"]')
  try {
    await stage.waitFor({ timeout: 30000 })
  } catch (error) {
    console.error(JSON.stringify({ fixture: { scene, targetRank, before,
      current: getPlayerProgression(host.state(), playerId), barrier: host.state().levelUpBarrier },
      wire: { sequence: wire.sequence, playerId: wire.playerId, errors: wire.errors,
        tick: wire.snapshot?.tick, barrier: wire.snapshot?.levelUpBarrier, players: wire.snapshot?.players },
      client: await page.evaluate(() => ({ stage: { ...document.querySelector('.skill-picker-stage')?.dataset },
        scene: { ...document.querySelector('.main-menu-page')?.dataset }, text: document.body.innerText.slice(0, 2000) })), errors }))
    throw error
  } finally {
    await page.keyboard.up('w')
    await page.keyboard.up('d')
  }
  const sequence = getPlayerProgression(host.state(), playerId).pendingOffer.sequence
  const rank = getPlayerSkillBook(host.state(), playerId).permanentRanks[58]
  const sounds = await pickSounds(page)
  const icon = stage.locator('.skill-picker-info-action[data-skill-id="58"]')
  if (scenario.touch) await icon.tap()
  else await icon.hover()
  await page.locator('.skill-picker-stage[data-detail-skill-id="58"]').waitFor()
  await page.screenshot({ path: `${evidence}/${scenario.name}-${scene}-picker-rank${targetRank}.png` })
  assert.equal(getPlayerProgression(host.state(), playerId).pendingOffer.sequence, sequence)
  assert.equal(getPlayerSkillBook(host.state(), playerId).permanentRanks[58], rank)
  assert.equal(await pickSounds(page), sounds)
  receipts.push({ scenario: scenario.name, scene, menu: 'picker', targetRank, detailReadOnly: true, silent: true })
  if (baseline) return
  const sibling = stage.locator('.skill-picker-info-action[data-skill-id="57"]')
  if (scenario.touch) await sibling.tap()
  else await sibling.focus()
  await page.locator('.skill-picker-stage[data-detail-skill-id="57"]').waitFor()
  if (scenario.touch) await icon.tap()
  else await icon.focus()
  await page.locator('.skill-picker-stage[data-detail-skill-id="58"]').waitFor()
  const card = stage.locator('.skill-picker-action[data-skill-id="58"]')
  const bounds = await card.boundingBox()
  assert.ok(bounds)
  if (scenario.touch) await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height * .8)
  else await card.click({ position: { x: bounds.width / 2, y: bounds.height * .8 } })
  await page.getByRole('dialog', { name: /Select a skill/ }).waitFor({ state: 'hidden', timeout: 15000 })
  await waitUntil(() => !getPlayerProgression(host.state(), playerId).pendingOffer,
    'the real skill choice did not retire its offer', 15000)
  assert.equal(getPlayerSkillBook(host.state(), playerId).permanentRanks[58], targetRank)
  assert.equal(await pickSounds(page), sounds + 1)
}

async function acceptBook(page, scenario, scene, rank) {
  const open = page.getByRole('button', { name: 'Open skills', exact: true })
  if (scenario.touch) await open.tap()
  else await open.click()
  const book = page.getByRole('dialog', { name: 'Skills', exact: true })
  await book.locator('xpath=self::*[@data-transition-phase="settled"]').waitFor({ timeout: 15000 })
  const row = book.getByRole('button', { name: new RegExp(`Meditation, rank ${rank}`) }).first()
  if (scenario.touch) await row.tap()
  else await row.hover()
  await book.locator('xpath=self::*[@data-hovered-skill-id="58"]').waitFor()
  assert.equal(await book.locator('.skill-book-canvas').getAttribute('data-native-hover-skill-id'), '58')
  await page.screenshot({ path: `${evidence}/${scenario.name}-${scene}-book.png` })
  receipts.push({ scenario: scenario.name, scene, menu: 'book', rank, renderedSkill: 58 })
  const close = book.getByRole('button', { name: 'Close skills', exact: true })
  if (scenario.touch) await close.tap()
  else await close.click()
  await book.waitFor({ state: 'hidden', timeout: 15000 })
}

function pickSounds(page) {
  return page.evaluate(() => (window.__sdrAudioEvents ?? [])
    .filter(event => event.type === 'buffer-start' && event.src.includes('pickskill')).length)
}

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import {
  createGameSimulation,
  getPlayerEconomy,
  getPlayerCharacter,
  getPlayerSkillBook,
  getPlayerBelt,
  getPlayerProgression,
  stepGameSimulationTick,
} from '../src/game/core-server/game-simulation.ts'
import { damagePlayerEntity, replacePlayerCharacter, replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { HUB_INTERACTION_GEOMETRY } from '../src/game/hub-inventory-presentation.ts'
import { createGameProfileSaveDocument } from '../src/game/save/game-save-document.ts'
import { NATIVE_SECONDARY_ABILITY_IDS } from '../src/game/core-kernels/native-secondary-ability-contract.ts'
import { enterBoneyard, startElementHub, waitUntil } from './game-smoke-navigation.mjs'

const evidence = process.env.SDR_HAGATHA_RETENTION_EVIDENCE || '/tmp/solomon-hagatha-retention'
await mkdir(evidence, { recursive: true })
const originalWizard = { discipline: 'arcane', displayName: 'Old Wizard', element: 'ether' }
let original = createGameSimulation({ retired: originalWizard })
const originalEconomy = getPlayerEconomy(original, 'retired')
original = {
  ...original,
  playerEntities: replacePlayerEconomy(original.playerEntities, 'retired', {
    ...originalEconomy,
    collegeIntroPending: false,
    gold: 100_000,
    revision: originalEconomy.revision + 1,
    tutorialPending: false,
  }),
}
const profile = createGameProfileSaveDocument({
  integrity: 'global-clean', mods: [], modState: {}, playerId: 'retired', state: original,
})

const server = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const credential = randomBytes(32).toString('base64url')
const host = await startGameHost({
  allowedOrigins: [server.origin],
  authentication: { kind: 'shared', credential },
  createBoneyardSeedBytes: () => Buffer.alloc(16),
  sessionKind: 'standalone',
  snapshotRate: 20,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const errors = { console: [], page: [], responses: [] }
let page
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  await context.addInitScript(({ credential: key, url }) => {
    window.solomonDarkRuntime = { gameEndpoint: { credential: key, kind: 'localhost', url } }
  }, { credential, url: host.address.url })
  page = await context.newPage()
  page.on('console', message => {
    if (message.type() === 'error') errors.console.push(message.text())
  })
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('response', response => {
    if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`)
  })
  await page.route('**/deployment.json?*', route => route.fulfill({
    json: { revision: new URL(route.request().url()).searchParams.get('current') },
  }))
  await page.route(`${server.origin}/__seed-profile`, route => route.fulfill({
    body: '<!doctype html><body></body>', contentType: 'text/html',
  }))
  await page.goto(`${server.origin}/__seed-profile`)
  await page.evaluate(document => new Promise((resolve, reject) => {
    const open = indexedDB.open('solomon-dark-game-saves', 1)
    open.onerror = () => reject(open.error)
    open.onupgradeneeded = () => open.result.createObjectStore('slots', { keyPath: 'slot' })
    open.onsuccess = () => {
      const transaction = open.result.transaction('slots', 'readwrite')
      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => resolve()
      transaction.objectStore('slots').put({ document, revision: 1, slot: 0 })
    }
  }), profile)

  await page.goto(`${server.origin}/game`, { waitUntil: 'domcontentloaded' })
  await startElementHub(page, 'Fire')
  await page.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor()
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const character = getPlayerCharacter(host.state(), playerId)
  Object.assign(host.state(), {
    ...host.state(),
    playerEntities: replacePlayerCharacter(host.state().playerEntities, playerId, {
      ...character,
      position: { x: HUB_INTERACTION_GEOMETRY.hagatha.position.x, y: HUB_INTERACTION_GEOMETRY.hagatha.position.y + 45 },
      velocity: { x: 0, y: 0 },
    }),
  })
  const prompt = page.locator('.game-interact-prompt[data-interaction-target="hub:hagatha"]')
  await prompt.waitFor({ timeout: 15_000 })
  await prompt.click()
  const dialogue = page.getByRole('dialog', { name: 'Talking to Hagatha' })
  await dialogue.waitFor()
  await dialogue.getByRole('button', { name: 'Skip', exact: true }).click()
  await dialogue.getByRole('button', { name: 'Charm Prices?', exact: true }).click()
  await dialogue.getByRole('button', { name: 'Skip', exact: true }).click()
  await dialogue.locator('[data-service-trader="hagatha"]').click()
  const shop = page.getByRole('dialog', { name: "HAGATHA'S CHARMS AND CURSES" })
  await shop.waitFor()
  const purchases = []
  for (const selector of [6, 14]) {
    const offer = shop.locator(`[data-hagatha-selector="${selector}"]`)
    const price = Number.parseInt((await offer.locator('.hub-trader-price').innerText()).replace(/\D/g, ''), 10)
    const before = getPlayerEconomy(host.state(), playerId).gold
    await offer.click()
    await offer.locator('xpath=self::*[@data-selected="true"]').waitFor()
    await offer.click()
    await waitUntil(() => getPlayerEconomy(host.state(), playerId).ownedPerkSelectors.includes(selector),
      `Hagatha selector ${selector} did not complete`, 10_000)
    assert.equal(getPlayerEconomy(host.state(), playerId).gold, before - price)
    purchases.push({ selector, price })
  }
  const retainedGold = getPlayerEconomy(host.state(), playerId).gold
  assertFreshCharmedWizard(host, playerId, 'fire', retainedGold)
  await page.screenshot({ path: `${evidence}/real-charm-purchases.png` })
  await shop.getByRole('button', { name: 'Done', exact: true }).click()
  await shop.waitFor({ state: 'hidden' })
  const savedRevision = await waitForCharmedCheckpoint(page, 1)

  await enterBoneyard(page)
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
  const active = host.state()
  // Only the lethal hit is a fixture. Game Over, its exit, and Create are real.
  const terminal = stepGameSimulationTick({ ...active, playerEntities: damagePlayerEntity(
    active.playerEntities, playerId, 1000, active.tick,
  ) }, {})
  assert.equal(terminal.run.phase, 'game-over')
  Object.assign(active, terminal)
  await page.locator('.boneyard-game-over[data-input-ready="true"]').click({ timeout: 20_000 })
  await waitUntil(() => host.state().run.phase === 'loadout', 'post-run Create did not open', 20_000)
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor()
  await page.getByRole('button', { name: /Earth/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor()
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 90_000 })
  const postRun = assertFreshCharmedWizard(host, playerId, 'earth', retainedGold)
  const postRunRevision = await waitForCharmedCheckpoint(page, savedRevision)
  await page.screenshot({ path: `${evidence}/post-run-granted-secondary.png` })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await startElementHub(page, 'Air')
  await page.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor()
  const reloadedPlayerId = host.hostPlayerId()
  assert.ok(reloadedPlayerId)
  const reloaded = assertFreshCharmedWizard(host, reloadedPlayerId, 'air', retainedGold)
  const reloadRevision = await waitForCharmedCheckpoint(page, postRunRevision)
  await page.screenshot({ path: `${evidence}/reload-granted-secondary.png` })
  assert.deepEqual(errors, { console: [], page: [], responses: [] })
  console.log(JSON.stringify({ status: 'ok', purchases, retainedGold, postRun, reloaded,
    checkpointRevisions: [savedRevision, postRunRevision, reloadRevision],
    fixtureLimits: ['initial funded profile', 'authored Hagatha placement', 'lethal hit'], errors }))
  await context.close()
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: `${evidence}/failure.png` })
  console.error(JSON.stringify({ errors, phase: host.state().run.phase }))
  throw error
} finally {
  await browser.close()
  await host.close()
  await server.close()
}

function assertFreshCharmedWizard(host, playerId, element, gold) {
  const state = host.state()
  assert.equal(state.run.phase, 'hub')
  assert.equal(getPlayerCharacter(state, playerId).config.element, element)
  assert.equal(getPlayerEconomy(state, playerId).gold, gold)
  assert.deepEqual(getPlayerEconomy(state, playerId).ownedPerkSelectors, [6, 14])
  assert.equal(getPlayerProgression(state, playerId).level, 1)
  const book = getPlayerSkillBook(state, playerId)
  const secondaryIds = NATIVE_SECONDARY_ABILITY_IDS.filter(id => book.permanentRanks[id] > 0)
  assert.equal(secondaryIds.length, 2)
  const index = state.playerEntities.identities.findIndex(identity => identity.playerId === playerId)
  for (const id of secondaryIds) {
    assert.equal(book.permanentRanks[id], Math.min(2, state.playerEntities.statBooks[index].entries[id].maximumLevel))
    assert.ok(getPlayerBelt(state, playerId).some(slot => slot?.kind === 'skill' && slot.skillId === id))
  }
  assert.equal(book.permanentRanks[book.primarySkillId], 2)
  return { element, secondaryIds, ranks: secondaryIds.map(id => book.permanentRanks[id]) }
}

async function waitForCharmedCheckpoint(page, previousRevision) {
  let revision = null
  for (let attempt = 0; attempt < 100 && revision === null; attempt += 1) {
    const saved = await page.evaluate(() => new Promise((resolve, reject) => {
      const open = indexedDB.open('solomon-dark-game-saves', 1)
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const request = open.result.transaction('slots', 'readonly').objectStore('slots').get(0)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => { resolve(request.result ?? null); open.result.close() }
      }
    }))
    if (saved && saved.revision > previousRevision) {
      const document = JSON.parse(saved.document)
      if (document.continuation !== null && [6, 14].every(selector => document.profile.economy.ownedPerkSelectors.includes(selector))) {
        revision = saved.revision
      }
    }
    if (revision === null) await page.waitForTimeout(100)
  }
  assert.ok(revision !== null, 'new active checkpoint did not retain both charms')
  return revision
}

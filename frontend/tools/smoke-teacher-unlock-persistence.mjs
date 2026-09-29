import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import {
  applyGameSimulationHubAction,
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
import { enterBoneyard, startElementHub, waitUntil } from './game-smoke-navigation.mjs'

const evidence = process.env.SDR_TEACHER_UNLOCK_EVIDENCE || '/tmp/solomon-teacher-unlock'
await mkdir(evidence, { recursive: true })
const originalWizard = { discipline: 'arcane', displayName: 'Old Wizard', element: 'ether' }
let original = createGameSimulation({ retired: originalWizard })
const originalEconomy = getPlayerEconomy(original, 'retired')
original = {
  ...original,
  playerEntities: replacePlayerEconomy(original.playerEntities, 'retired', {
    ...originalEconomy,
    collegeIntroPending: false,
    gold: 20_465,
    revision: originalEconomy.revision + 1,
    tutorialPending: false,
  }),
}
const purchase = applyGameSimulationHubAction(original, 'retired', {
  skillId: 78,
  type: 'buy-teacher-spell',
})
assert.equal(purchase.accepted, true)
assert.equal(getPlayerSkillBook(purchase.state, 'retired').advancedUnlocks[6], true)
assert.equal(getPlayerSkillBook(purchase.state, 'retired').permanentRanks[78], 0)
const profile = createGameProfileSaveDocument({
  integrity: 'global-clean', mods: [], modState: {}, playerId: 'retired', state: purchase.state,
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
  const book = getPlayerSkillBook(host.state(), playerId)
  assert.equal(getPlayerEconomy(host.state(), playerId).gold, 15_165)
  assert.equal(book.advancedUnlocks[6], true)
  assert.equal(book.permanentRanks[78], 0)
  assert.notEqual(host.state().playerEntities.configs[0]?.displayName, originalWizard.displayName)
  let savedRevision = null
  for (let attempt = 0; attempt < 100 && savedRevision === null; attempt += 1) {
    const saved = await page.evaluate(() => new Promise((resolve, reject) => {
      const open = indexedDB.open('solomon-dark-game-saves', 1)
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const request = open.result.transaction('slots', 'readonly').objectStore('slots').get(0)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result ?? null)
      }
    }))
    if (saved) {
      const document = JSON.parse(saved.document)
      if (document.continuation !== null && document.profile.advancedUnlocks[6] === true) {
        savedRevision = saved.revision
      }
    }
    if (savedRevision === null) await page.waitForTimeout(100)
  }
  assert.ok(savedRevision !== null, 'new wizard checkpoint did not retain Mindstar')

  // Place the fixture at the authored contact point; pointer and shop flow stay real.
  const character = getPlayerCharacter(host.state(), playerId)
  assert.ok(character)
  Object.assign(host.state(), {
    ...host.state(),
    playerEntities: replacePlayerCharacter(host.state().playerEntities, playerId, {
      ...character,
      position: {
        x: HUB_INTERACTION_GEOMETRY.teacher.position.x,
        y: HUB_INTERACTION_GEOMETRY.teacher.position.y + 60,
      },
      velocity: { x: 0, y: 0 },
    }),
  })
  const prompt = page.locator('.game-interact-prompt[data-interaction-target="hub:teacher"]')
  await prompt.waitFor({ timeout: 15_000 })
  await prompt.click()
  const dialog = page.getByRole('dialog', { name: 'Talking to Professor Machinimbus' })
  await dialog.waitFor()
  await dialog.getByRole('button', { name: 'Skip' }).click()
  await dialog.getByRole('button', { name: 'Spell Testing?' }).click()
  await dialog.getByRole('button', { name: 'Skip' }).click()
  await dialog.getByRole('button', { name: 'Per$uade' }).click()
  await dialog.locator('[data-native-selector-kind="teacher-spells"]').first().waitFor()
  assert.equal(await dialog.locator('[data-native-selector-id="78"]').count(), 0)
  assert.equal(await dialog.locator('[data-native-selector-id="79"]').count(), 1)
  assert.equal(Number(await dialog.locator('[data-player-gold]').getAttribute('data-player-gold')), 15_165)
  await page.screenshot({ path: `${evidence}/new-wizard-teacher-shop.png` })

  // Buy a sibling through the real selector, not by changing its unlock flag.
  await dialog.locator('[data-native-selector-id="79"]').click()
  await waitUntil(() => getPlayerSkillBook(host.state(), playerId).advancedUnlocks[7],
    'real Teacher selector did not complete purchase 79', 10_000)
  assert.equal(getPlayerEconomy(host.state(), playerId).gold, 10_065)
  assert.equal(getPlayerSkillBook(host.state(), playerId).permanentRanks[79], 0)
  await dialog.locator('[data-native-selector-id="79"]').waitFor({ state: 'detached', timeout: 10_000 })
  assert.equal(await dialog.locator('[data-native-selector-id="79"]').count(), 0)
  const purchaseExplanation = dialog.getByRole('button', { name: 'Skip', exact: true })
  await purchaseExplanation.click()
  await purchaseExplanation.waitFor({ state: 'hidden' })
  if (await dialog.isVisible()) {
    const done = dialog.getByRole('button', { name: 'Done', exact: true })
    if (await done.isVisible()) await done.click()
    else await page.keyboard.press('Escape')
  }
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 })
  console.log(JSON.stringify({ stage: 'real-purchase-and-dialogue-complete', skillId: 79,
    gold: getPlayerEconomy(host.state(), playerId).gold }))

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
  assertFreshPurchasedWizard(host, playerId, 'earth')
  const postRunRevision = await waitForPurchasedCheckpoint(page, savedRevision)
  await page.screenshot({ path: `${evidence}/post-run-purchases-retained.png` })

  // Reload and deliberately retire the saved active wizard through the UI.
  // This exercises the durable profile producer and Create again, not a fixture hydrate.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await startElementHub(page, 'Air')
  await page.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor()
  const reloadedPlayerId = host.hostPlayerId()
  assert.ok(reloadedPlayerId)
  assertFreshPurchasedWizard(host, reloadedPlayerId, 'air')
  const reloadRevision = await waitForPurchasedCheckpoint(page, postRunRevision)
  await page.screenshot({ path: `${evidence}/reload-purchases-retained.png` })
  assert.deepEqual(errors, { console: [], page: [], responses: [] })
  console.log(JSON.stringify({ status: 'ok', purchasedFlag: true, nextWizardFlag: book.advancedUnlocks[6],
    nextWizardRank: book.permanentRanks[78], gold: 15_165, mindstarOffered: false,
    checkpointRevision: savedRevision, realSelectorPurchase: 79, postRunGold: 10_065,
    postRunRevision, reloadRevision, postRunAndReloadFlags: [78, 79],
    fixtureLimits: ['initial profile has purchased Mindstar', 'authored Teacher placement', 'lethal hit'], errors }))
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

function assertFreshPurchasedWizard(host, playerId, element) {
  const state = host.state()
  assert.equal(state.run.phase, 'hub')
  assert.equal(getPlayerCharacter(state, playerId).config.element, element)
  assert.equal(getPlayerEconomy(state, playerId).gold, 10_065)
  assert.equal(getPlayerProgression(state, playerId).level, 1)
  for (const skillId of [78, 79]) {
    assert.equal(getPlayerSkillBook(state, playerId).advancedUnlocks[skillId - 72], true)
    assert.equal(getPlayerSkillBook(state, playerId).permanentRanks[skillId], 0)
    assert.equal(getPlayerBelt(state, playerId).some(slot => slot?.kind === 'skill' && slot.skillId === skillId), false)
  }
}

async function waitForPurchasedCheckpoint(page, previousRevision) {
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
      if (document.continuation !== null && [6, 7].every(index => document.profile.advancedUnlocks[index])) {
        revision = saved.revision
      }
    }
    if (revision === null) await page.waitForTimeout(100)
  }
  assert.ok(revision !== null, 'new active checkpoint did not retain both purchases')
  return revision
}

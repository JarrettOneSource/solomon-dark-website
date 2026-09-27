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
} from '../src/game/core-server/game-simulation.ts'
import { replacePlayerCharacter, replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { HUB_INTERACTION_GEOMETRY } from '../src/game/hub-inventory-presentation.ts'
import { createGameProfileSaveDocument } from '../src/game/save/game-save-document.ts'
import { startElementHub } from './game-smoke-navigation.mjs'

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
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  await context.addInitScript(({ credential: key, url }) => {
    window.solomonDarkRuntime = { gameEndpoint: { credential: key, kind: 'localhost', url } }
  }, { credential, url: host.address.url })
  const page = await context.newPage()
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
  assert.deepEqual(errors, { console: [], page: [], responses: [] })
  console.log(JSON.stringify({ status: 'ok', purchasedFlag: true, nextWizardFlag: book.advancedUnlocks[6],
    nextWizardRank: book.permanentRanks[78], gold: 15_165, mindstarOffered: false,
    checkpointRevision: savedRevision, errors }))
  await context.close()
} finally {
  await browser.close()
  await host.close()
  await server.close()
}

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import {
  bindGameSimulationPlayerSkillQuickbar,
  getPlayerEconomy,
  selectGameSimulationPlayerConcentration,
} from '../src/game/core-server/game-simulation.ts'
import { applyNativeSecondaryPlayerDamage } from '../src/game/core-kernels/native-secondary-abilities.ts'
import { grantPlayerWeldBuild } from '../src/game/core-kernels/player-progression.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotPath = process.env.SDR_DERIVED_HUD_SMOKE_SCREENSHOT
  || '/tmp/solomon-dark-native-derived-hud.png'
const primarySpellScreenshotPath = process.env.SDR_DERIVED_HUD_PRIMARY_SCREENSHOT
  || '/tmp/solomon-dark-native-primary-spell-summary.png'
const productionBuild = process.env.SDR_DERIVED_HUD_PRODUCTION === '1'
const credential = randomBytes(32).toString('base64url')
const pageErrors = []
const consoleErrors = []
const networkErrors = []

const primarySpellCases = Object.freeze([
  { buildId: null, damageRange: true, damageUnit: ' / bolt', manaUnit: ' / cast', name: 'Magic Missile', skillId: 8 },
  { buildId: null, damageRange: false, damageUnit: ' / bolt', manaUnit: ' / cast', name: 'Fireball', skillId: 16 },
  { buildId: null, damageRange: false, damageUnit: ' / second', manaUnit: ' / sec', name: 'Lightning', skillId: 24 },
  { buildId: null, damageRange: false, damageUnit: ' / second', manaUnit: ' / sec', name: 'Frost Jet', skillId: 32 },
  { buildId: null, damageRange: true, damageUnit: ' / boulder', manaUnit: ' / sec', name: 'Boulder', skillId: 40 },
  { buildId: 1000, damageRange: true, damageUnit: ' / bolt', manaUnit: ' / cast', name: 'Burning Bolt', skillId: 52 },
  { buildId: 1001, damageRange: true, damageUnit: ' / bolt', manaUnit: ' / cast', name: 'Frost Missile', skillId: 52 },
  { buildId: 1002, damageRange: true, damageUnit: ' / bolt', manaUnit: ' / cast', name: 'Ball Lightning', skillId: 52 },
  { buildId: 1003, damageRange: false, damageUnit: ' / second', manaUnit: ' / sec', name: 'Flame Lash', skillId: 52 },
  { buildId: 1004, damageRange: false, damageUnit: ' / second', manaUnit: ' / sec', name: 'Blizzard Beam', skillId: 52 },
  { buildId: 1005, damageRange: false, damageUnit: ' / second', manaUnit: ' / sec', name: 'Steam Jet', skillId: 52 },
  { buildId: 1006, damageRange: true, damageUnit: ' / boulder', manaUnit: ' / sec', name: 'Ethereal Boulder', skillId: 52 },
  { buildId: 1007, damageRange: true, damageUnit: ' / impact', manaUnit: ' / sec', name: 'Meteor Swarm', skillId: 52 },
  { buildId: 1008, damageRange: false, damageUnit: ' / rock', manaUnit: ' / sec', name: 'Hailstones', skillId: 52 },
  { buildId: 1009, damageRange: false, damageUnit: ' / bolt', manaUnit: ' / cast', name: 'Crawling Shock', skillId: 52 },
])

let vite = null
let staticServer = null
let baseUrl
if (productionBuild) {
  staticServer = await startStaticClientServer({
    root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
  })
  baseUrl = staticServer.origin
} else {
  vite = await createViteServer({
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    logLevel: 'error',
    root: frontendRoot,
    server: { host: '127.0.0.1', port: 0 },
  })
  await vite.listen()
  const viteAddress = vite.httpServer?.address()
  if (!viteAddress || typeof viteAddress === 'string') {
    await vite.close()
    throw new Error('Vite did not expose its local smoke-test port')
  }
  baseUrl = `http://127.0.0.1:${viteAddress.port}`
}
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  snapshotRate: 100,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })

try {
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'failed'
    if (failure === 'net::ERR_ABORTED' && /\.(?:mp3|ogg)(?:\?|$)/.test(request.url())) return
    if (failure === 'net::ERR_ABORTED' && new URL(request.url()).pathname === '/deployment.json') return
    networkErrors.push(`${request.url()}: ${failure}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.url()}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.route('**/deployment.json?*', async (route) => {
    const revision = new URL(route.request().url()).searchParams.get('current')
    await route.fulfill({ json: { revision } })
  })
  await page.addInitScript((runtime) => {
    window.solomonDarkRuntime = runtime
  }, {
    gameEndpoint: {
      credential,
      kind: 'localhost',
      url: host.address.url,
    },
  })
  await page.goto(`${baseUrl}/game`, { timeout: 90_000, waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  const tutorialPrompt = page.locator(
    '[data-prompt-kind="tutorial"] .stock-prompt-dialog',
  )
  const tutorialPromptVisible = await tutorialPrompt
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true, () => false)
  if (tutorialPromptVisible) {
    await tutorialPrompt.getByRole('button', { name: 'NO' }).click()
    await tutorialPrompt.waitFor({ state: 'detached' })
  }
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: /Earth/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-mind').click()
  const hubScene = page.locator('.hub-scene[data-renderer-state="ready"]')
  await hubScene.waitFor({ timeout: 30_000 })
  await hubScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor({
    timeout: 10_000,
  })

  const defaultHud = await measureHud(page)
  assert.equal(defaultHud.health.width, 110)
  assert.deepEqual(defaultHud.healthCore, {
    bottom: 29.5,
    left: 645,
    right: 745,
    top: 19.5,
    width: 100,
  })
  assert.equal(defaultHud.health.right, 750)
  assert.equal(defaultHud.mana.left, 850)
  assert.equal(defaultHud.mana.width, 110)
  assert.deepEqual(defaultHud.manaCore, {
    bottom: 29.5,
    left: 855,
    right: 955,
    top: 19.5,
    width: 100,
  })
  assert.deepEqual(defaultHud.bindings, [
    { binding: 12, centerX: 800, record: 67 },
  ])

  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const primarySpellSummaryReceipt = await exercisePrimarySpellInventory(
    page,
    host,
    playerId,
  )
  setPlayerVitalComposition(host.state(), playerId, {
    currentHealth: 36,
    maximumHealth: 50,
    shieldCurrent: 26,
    shieldMaximum: 50,
  })
  await page.getByLabel('Magic shield 26 of 50').waitFor({ timeout: 10_000 })
  const shieldBeforeHit = await measureVitalComposition(page)
  assert.deepEqual(shieldBeforeHit.layers.map(({ kind }) => kind), ['health', 'shield'])
  assert.ok(shieldBeforeHit.layers.every(({ blend }) => blend === 'plus-lighter'))
  assert.equal(shieldBeforeHit.frameRecord, 'UI.70')

  applyShieldHit(host.state(), playerId, 1, 'hub')
  await page.getByLabel('Magic shield 25 of 50').waitFor({ timeout: 10_000 })
  const shieldAfterHit = await measureVitalComposition(page)
  assert.deepEqual(shieldAfterHit.layers.map(({ kind }) => kind), ['shield', 'health'])
  assert.ok(shieldAfterHit.layers.every(({ blend }) => blend === 'plus-lighter'))
  assert.equal(shieldAfterHit.shieldLabel, 'Magic shield 25 of 50')

  setPlayerVitalComposition(host.state(), playerId, {
    currentHealth: 30,
    maximumHealth: 50,
    shieldCurrent: 25,
    shieldMaximum: 50,
  })
  await page.getByLabel('Magic shield 25 of 50').waitFor({ timeout: 10_000 })
  const shieldWiderPixels = await sampleHealthMeterPixels(page, {
    empty: [80, 10],
    overlap: [20, 10],
    suffix: [47, 10],
  })
  assertAdditiveOverlap(shieldWiderPixels)

  setPlayerVitalComposition(host.state(), playerId, {
    currentHealth: 30,
    maximumHealth: 50,
    shieldCurrent: 10,
    shieldMaximum: 50,
  })
  await page.getByLabel('Magic shield 10 of 50').waitFor({ timeout: 10_000 })
  const shieldNarrowerPixels = await sampleHealthMeterPixels(page, {
    empty: [80, 10],
    overlap: [15, 10],
    suffix: [30, 10],
  })
  assertAdditiveOverlap(shieldNarrowerPixels)

  setPlayerVitalComposition(host.state(), playerId, {
    currentHealth: 36,
    maximumHealth: 50,
    poisonTicksRemaining: 100,
    shieldCurrent: 25,
    shieldMaximum: 50,
  })
  await page.locator('.hub-hud-meter-health [data-native-ui-strip="UI.52"]').first().waitFor({
    timeout: 10_000,
  })
  const poisonedShield = await measureVitalComposition(page)
  assert.deepEqual(poisonedShield.layers.map(({ record }) => record), ['UI.52', 'UI.52'])

  setPlayerVitalComposition(host.state(), playerId, {
    currentHealth: 50,
    maximumHealth: 50,
    poisonTicksRemaining: 0,
    shieldCurrent: 0,
    shieldMaximum: 0,
  })
  mutatePlayer(host.state(), playerId, {
    learnedSkillIds: [12, 23, 56, 57, 64],
    ownedPerkSelectors: [0, 1, 21],
  })
  await page.locator('.hub-hud-meter-health[data-core-width="137.5"]').waitFor({
    timeout: 10_000,
  })
  await page.locator('.hub-hud-meter-mana[data-core-width="137.5"]').waitFor({
    timeout: 10_000,
  })
  const charmedHud = await measureHud(page)
  assert.equal(charmedHud.health.left, 602.5)
  assert.equal(charmedHud.health.right, 750)
  assert.equal(charmedHud.health.width, 147.5)
  assert.equal(charmedHud.mana.left, 850)
  assert.equal(charmedHud.mana.right, 997.5)
  assert.equal(charmedHud.mana.width, 147.5)

  setPlayerHealthRatio(host.state(), playerId, 0.5)
  await waitForLocalHealthRatio(page, 0.5)
  const damagedHud = await measureHud(page)
  assertLocalHealthRetractsFromRight(damagedHud)

  setVitalLayers(host.state(), playerId)
  await page.locator('.hub-hud-mana-reserve').waitFor({ timeout: 10_000 })
  await page.locator('.hub-hud-meter-shield').waitFor({ timeout: 10_000 })
  const layeredHud = await measureHud(page)
  assert.deepEqual(layeredHud.reserve, {
    bottom: 29.5,
    left: 965,
    right: 992.5,
    top: 19.5,
    width: 27.5,
  })
  assert.equal(layeredHud.manaClip, 'inset(0px 20% 0px 0px)')
  assert.equal(layeredHud.manaVisible.right, layeredHud.reserve.left)
  const manaHoardPixels = await sampleMeterPixels(page, '.hub-hud-meter-mana', {
    available: [80, 10],
    hoarded: [128, 10],
  })
  assert.ok(manaHoardPixels.available[2] > manaHoardPixels.hoarded[2] + 40)
  assert.deepEqual(layeredHud.shield, {
    bottom: 29.5,
    left: 607.5,
    right: 745,
    top: 19.5,
    width: 137.5,
  })
  assert.equal(layeredHud.shieldClip, 'inset(0px 50% 0px 0px)')

  mutatePlayer(host.state(), playerId, { learnedSkillIds: [58] })
  selectConcentration(host.state(), playerId, 57)
  selectConcentration(host.state(), playerId, 58)
  await page.locator('.hub-hud-selected-skill[data-binding="20"][data-record="85"]').waitFor({
    timeout: 10_000,
  })
  const splitMindHud = await measureHud(page)
  assert.deepEqual(splitMindHud.bindings, [
    { binding: 12, centerX: 760, record: 67 },
    { binding: 16, centerX: 840, record: 84 },
    { binding: 20, centerX: 800, record: 85 },
  ])

  mutatePlayer(host.state(), playerId, {
    learnedSkillIds: [8, 9, 10, 16, 17, 18, 52],
    primarySkillId: 52,
    weldBuildId: 1000,
  })
  const weldIconRecords = []
  for (let index = 0; index < 10; index += 1) {
    const buildId = 1000 + index
    const record = 108 + index
    mutatePlayer(host.state(), playerId, { weldBuildId: buildId })
    await page.locator(
      `.hub-hud-selected-skill[data-binding="12"][data-record="${record}"]`,
    ).waitFor({ timeout: 10_000 })
    weldIconRecords.push({ buildId, record })
  }
  assert.deepEqual(weldIconRecords, [
    { buildId: 1000, record: 108 },
    { buildId: 1001, record: 109 },
    { buildId: 1002, record: 110 },
    { buildId: 1003, record: 111 },
    { buildId: 1004, record: 112 },
    { buildId: 1005, record: 113 },
    { buildId: 1006, record: 114 },
    { buildId: 1007, record: 115 },
    { buildId: 1008, record: 116 },
    { buildId: 1009, record: 117 },
  ])

  mutatePlayer(host.state(), playerId, { weldBuildId: 1005 })
  await page.locator('.hub-hud-selected-skill[data-binding="12"][data-record="113"]').waitFor({
    timeout: 10_000,
  })
  const boundWeld = bindGameSimulationPlayerSkillQuickbar(host.state(), playerId, 52, 7)
  assert.ok(boundWeld)
  Object.assign(host.state(), boundWeld)
  const steamQuickbarIcon = page.locator(
    '.hub-hud-quickbar-slot[data-slot="7"] .hub-hud-quickbar-skill-icon[data-record="113"]',
  )
  await steamQuickbarIcon.waitFor({ timeout: 10_000 })
  const steamQuickbarRecord = Number(await steamQuickbarIcon.getAttribute('data-record'))
  assert.equal(steamQuickbarRecord, 113)

  await page.locator('.hub-hud-selected-skill-action[data-binding="12"]').click({ force: true })
  const primarySelector = page.getByRole('dialog', { name: 'Select Primary Attack' })
  await primarySelector.waitFor({ timeout: 10_000 })
  const steamSelectorOption = primarySelector.locator(
    '.hud-skill-selector-action[data-skill-id="52"][data-icon-record="113"]',
  )
  await steamSelectorOption.waitFor({ timeout: 10_000 })
  const steamSelectorRecord = Number(await steamSelectorOption.getAttribute('data-icon-record'))
  assert.equal(steamSelectorRecord, 113)
  await page.keyboard.press('Escape')
  await primarySelector.waitFor({ state: 'detached', timeout: 10_000 })

  setPlanewalker(host.state(), playerId, true)
  await page.locator('.hub-hud-selected-skill[data-binding="12"][data-record="107"]').waitFor({
    timeout: 10_000,
  })
  const planewalkerHud = await measureHud(page)
  assert.equal(planewalkerHud.bindings[0].record, 107)
  await page.locator('.hub-hud-selected-skill-action[data-binding="12"]').click({ force: true })
  await page.waitForTimeout(100)
  assert.equal(await page.getByRole('dialog', { name: 'Select Primary Attack' }).count(), 0)
  assert.equal(await hubScene.getAttribute('data-gameplay-input-blocked'), 'false')
  setPlanewalker(host.state(), playerId, false)
  await page.locator('.hub-hud-selected-skill[data-binding="12"][data-record="113"]').waitFor({
    timeout: 10_000,
  })

  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const boneyardScene = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  await boneyardScene.waitFor({
    timeout: 90_000,
  })
  await boneyardScene.locator(
    'xpath=self::*[@data-gameplay-input-blocked="false"]',
  ).waitFor({ timeout: 30_000 })
  const boneyardSteamHudIcon = page.locator(
    '.hub-hud-selected-skill[data-binding="12"][data-record="113"]',
  )
  await boneyardSteamHudIcon.waitFor({ timeout: 10_000 })
  const boneyardSteamQuickbarIcon = page.locator(
    '.hub-hud-quickbar-slot[data-slot="7"] .hub-hud-quickbar-skill-icon[data-record="113"]',
  )
  await boneyardSteamQuickbarIcon.waitFor({ timeout: 10_000 })
  const boneyardSteamRecords = {
    hud: Number(await boneyardSteamHudIcon.getAttribute('data-record')),
    quickbar: Number(await boneyardSteamQuickbarIcon.getAttribute('data-record')),
  }
  assert.deepEqual(boneyardSteamRecords, { hud: 113, quickbar: 113 })
  await page.keyboard.press('i')
  const boneyardInventory = page.getByRole('dialog', { name: 'Inventory' })
  await boneyardInventory.waitFor({ timeout: 10_000 })
  await boneyardInventory.locator(
    '.hub-inventory-native-canvas[data-native-reveal="settled"]',
  ).waitFor({ state: 'attached', timeout: 30_000 })
  const boneyardPrimarySpellSummary = await readPrimarySpellSummary(
    boneyardInventory,
    primarySpellCases[10],
  )
  await page.keyboard.press('i')
  await boneyardInventory.waitFor({ state: 'hidden', timeout: 10_000 })
  await page.locator(
    '.boneyard-scene[data-gameplay-input-blocked="false"]',
  ).waitFor({ timeout: 10_000 })
  const boneyardMaximumHealth = playerProgression(host.state(), playerId).maximumHealth
  setPlayerVitalComposition(host.state(), playerId, {
    currentHealth: boneyardMaximumHealth * 0.72,
    maximumHealth: boneyardMaximumHealth,
    shieldCurrent: 26,
    shieldMaximum: 50,
  })
  await page.getByLabel('Magic shield 26 of 50').waitFor({ timeout: 10_000 })
  applyShieldHit(host.state(), playerId, 1, 'boneyard')
  await page.getByLabel('Magic shield 25 of 50').waitFor({ timeout: 10_000 })
  const boneyardShieldAfterHit = await measureVitalComposition(page)
  assert.deepEqual(boneyardShieldAfterHit.layers.map(({ kind }) => kind), ['shield', 'health'])
  assert.ok(boneyardShieldAfterHit.layers.every(({ blend }) => blend === 'plus-lighter'))

  setPlayerHealthRatio(host.state(), playerId, 0.5)
  await waitForLocalHealthRatio(page, 0.5)
  const boneyardDamagedHud = await measureHud(page)
  assertLocalHealthRetractsFromRight(boneyardDamagedHud)

  await page.screenshot({ path: screenshotPath })
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [], JSON.stringify({ consoleErrors, networkErrors }))
  assert.deepEqual(networkErrors, [])
  process.stdout.write(`${JSON.stringify({
    boneyardDamagedHud,
    boneyardShieldAfterHit,
    charmedHud,
    consoleErrors,
    boneyardPrimarySpellSummary,
    boneyardSteamRecords,
    damagedHud,
    defaultHud,
    layeredHud,
    manaHoardPixels,
    networkErrors,
    pageErrors,
    planeOrbSelectorGate: true,
    planewalkerHud,
    poisonedShield,
    primarySpellScreenshotPath,
    primarySpellSummaryReceipt,
    productionBuild,
    screenshotPath,
    shieldAfterHit,
    shieldBeforeHit,
    shieldNarrowerPixels,
    shieldWiderPixels,
    splitMindHud,
    steamQuickbarRecord,
    steamSelectorRecord,
    weldIconRecords,
  })}\n`)
} finally {
  await browser.close()
  await host.close()
  await vite?.close()
  await staticServer?.close()
}

async function exercisePrimarySpellInventory(page, host, playerId) {
  const learnedSkillIds = [
    8, 9, 10,
    16, 17, 18,
    24, 25, 26,
    32, 33, 34,
    40, 42, 43,
  ]
  mutatePlayer(host.state(), playerId, {
    learnedSkillIds,
    primarySkillId: 8,
    weldBuildId: null,
  })
  await page.keyboard.press('i')
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor({ timeout: 10_000 })
  await inventory.locator(
    'xpath=self::*[@data-renderer-state="ready"]',
  ).waitFor({ state: 'attached', timeout: 30_000 })
  await inventory.locator(
    '.hub-inventory-native-canvas[data-native-reveal="settled"]',
  ).waitFor({ state: 'attached', timeout: 30_000 })

  const summaries = []
  for (const expected of primarySpellCases) {
    mutatePlayer(host.state(), playerId, {
      primarySkillId: expected.skillId,
      weldBuildId: expected.buildId,
    })
    const summary = await readPrimarySpellSummary(inventory, expected)
    summaries.push({ buildId: expected.buildId, lines: summary, skillId: expected.skillId })
    if (expected.skillId === 16) {
      await page.waitForTimeout(100)
      await page.screenshot({ path: primarySpellScreenshotPath })
    }
  }

  mutatePlayer(host.state(), playerId, { primarySkillId: 40 })
  await readPrimarySpellSummary(inventory, {
    ...primarySpellCases[4],
    buildId: 1009,
  })
  await page.keyboard.press('i')
  await inventory.waitFor({ state: 'hidden', timeout: 10_000 })
  await page.locator(
    '.hub-scene[data-gameplay-input-blocked="false"]',
  ).waitFor({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Open Fomentius interaction' }).click()
  const fomentius = page.getByRole('dialog', { name: "FOMENTIUS' USEFUL THYNGS" })
  await fomentius.waitFor({ timeout: 10_000 })
  await fomentius.locator(
    '.hub-inventory-native-canvas[data-native-reveal="settled"]',
  ).waitFor({ state: 'attached', timeout: 30_000 })
  const companion = await readPrimarySpellSummary(fomentius, {
    ...primarySpellCases[4],
    buildId: 1009,
  })
  await fomentius.getByRole('button', { name: 'Done' }).click()
  await fomentius.waitFor({ state: 'hidden', timeout: 10_000 })
  await page.locator(
    '.hub-scene[data-gameplay-input-blocked="false"]',
  ).waitFor({ timeout: 10_000 })
  return { companion, standalone: summaries }
}

async function readPrimarySpellSummary(inventory, expected) {
  const build = expected.buildId === null ? '' : `${expected.buildId}`
  const canvas = inventory.locator(
    `.hub-inventory-native-canvas[data-native-primary-spell-id="${expected.skillId}"]`
      + `[data-native-primary-spell-build="${build}"]`,
  )
  await canvas.waitFor({ state: 'attached', timeout: 10_000 })
  const serialized = await canvas.getAttribute('data-native-primary-spell-lines')
  assert.ok(serialized)
  const lines = JSON.parse(serialized)
  assert.equal(lines.length, 4)
  assert.deepEqual(lines.map(({ unit }) => unit), [
    null,
    expected.damageUnit,
    expected.manaUnit,
    ' / sec',
  ])
  assert.equal(lines[0].text, expected.name)
  assert.match(
    lines[1].text,
    expected.damageRange
      ? /^damage: \d+\.\d - \d+\.\d$/
      : /^damage: \d+\.\d$/,
  )
  assert.match(lines[2].text, /^mana cost: \d+\.\d$/)
  assert.match(lines[3].text, /^mana heal: \d+\.\d$/)
  if (expected.damageRange) {
    const [minimum, maximum] = lines[1].text
      .slice('damage: '.length)
      .split(' - ')
      .map(Number)
    assert.ok(minimum <= maximum)
  }
  return lines
}

function mutatePlayer(state, playerId, {
  learnedSkillIds = [],
  ownedPerkSelectors,
  primarySkillId,
  weldBuildId,
}) {
  const index = state.playerEntities.identities.findIndex(
    ({ playerId: id }) => id === playerId,
  )
  assert.notEqual(index, -1)
  const sourceBook = state.playerEntities.skillBooks[index]
  const permanentRanks = [...sourceBook.permanentRanks]
  const effectiveRanks = [...sourceBook.effectiveRanks]
  const learnedSkillOrder = [...sourceBook.learnedSkillOrder]
  for (const skillId of learnedSkillIds) {
    permanentRanks[skillId] = 1
    effectiveRanks[skillId] = 1
    if (!learnedSkillOrder.includes(skillId)) learnedSkillOrder.push(skillId)
  }
  let skillBook = {
    ...sourceBook,
    effectiveRanks,
    learnedSkillOrder,
    permanentRanks,
    primarySkillId: primarySkillId ?? sourceBook.primarySkillId,
  }
  if (weldBuildId === null) {
    skillBook = { ...skillBook, weldBuildId: null, weldComponentRanks: null }
  } else if (weldBuildId !== undefined) {
    skillBook = grantPlayerWeldBuild(skillBook, weldBuildId)
  }
  if (primarySkillId !== undefined) skillBook = { ...skillBook, primarySkillId }
  const skillBooks = [...state.playerEntities.skillBooks]
  skillBooks[index] = skillBook
  const economy = getPlayerEconomy(state, playerId)
  const nextEconomy = ownedPerkSelectors === undefined
    ? economy
    : { ...economy, ownedPerkSelectors }
  Object.assign(state, {
    ...state,
    playerEntities: replacePlayerEconomy({
      ...state.playerEntities,
      skillBooks,
    }, playerId, nextEconomy),
  })
}

function selectConcentration(state, playerId, skillId) {
  const selected = selectGameSimulationPlayerConcentration(state, playerId, skillId)
  assert.ok(selected)
  Object.assign(state, selected)
}

function setPlanewalker(state, playerId, active) {
  const player = state.secondaryAbilities.players[playerId]
  assert.ok(player)
  Object.assign(state, {
    ...state,
    secondaryAbilities: {
      ...state.secondaryAbilities,
      players: {
        ...state.secondaryAbilities.players,
        [playerId]: {
          ...player,
          planewalkerTicksRemaining: active ? 10_000 : 0,
        },
      },
    },
  })
}

function setPlayerHealthRatio(state, playerId, ratio) {
  const index = state.playerEntities.identities.findIndex(
    ({ playerId: id }) => id === playerId,
  )
  assert.notEqual(index, -1)
  const current = state.playerEntities.progressions[index]
  assert.ok(current)
  const progressions = [...state.playerEntities.progressions]
  progressions[index] = {
    ...current,
    currentHealth: current.maximumHealth * ratio,
  }
  Object.assign(state, {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      progressions,
    },
  })
}

function setPlayerVitalComposition(state, playerId, {
  currentHealth,
  maximumHealth,
  poisonTicksRemaining = 0,
  shieldCurrent,
  shieldMaximum,
}) {
  const index = playerProgressionIndex(state, playerId)
  const current = state.playerEntities.progressions[index]
  const secondary = state.secondaryAbilities.players[playerId]
  assert.ok(current)
  assert.ok(secondary)
  const progressions = [...state.playerEntities.progressions]
  progressions[index] = {
    ...current,
    currentHealth,
    maximumHealth,
    poisonDamagePerTick: poisonTicksRemaining > 0 ? 0.01 : 0,
    poisonTicksRemaining,
  }
  Object.assign(state, {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      progressions,
    },
    secondaryAbilities: {
      ...state.secondaryAbilities,
      players: {
        ...state.secondaryAbilities.players,
        [playerId]: {
          ...secondary,
          magicShieldAbsorb: shieldCurrent,
          magicShieldMaximum: shieldMaximum,
        },
      },
    },
  })
}

function playerProgression(state, playerId) {
  return state.playerEntities.progressions[playerProgressionIndex(state, playerId)]
}

function playerProgressionIndex(state, playerId) {
  const index = state.playerEntities.identities.findIndex(
    ({ playerId: id }) => id === playerId,
  )
  assert.notEqual(index, -1)
  return index
}

function applyShieldHit(state, playerId, damage, worldKey) {
  const result = applyNativeSecondaryPlayerDamage(
    state.secondaryAbilities,
    playerId,
    damage,
    state.tick,
    { x: 0, y: 0 },
    worldKey,
  )
  assert.equal(result.absorbedDamage, damage)
  assert.equal(result.healthDamage, 0)
  Object.assign(state, {
    ...state,
    secondaryAbilities: result.state,
  })
}

function setVitalLayers(state, playerId) {
  const player = state.secondaryAbilities.players[playerId]
  const index = playerProgressionIndex(state, playerId)
  const progression = state.playerEntities.progressions[index]
  assert.ok(player)
  assert.ok(progression)
  const progressions = [...state.playerEntities.progressions]
  progressions[index] = {
    ...progression,
    currentMana: progression.maximumMana - 50,
  }
  Object.assign(state, {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      progressions,
    },
    secondaryAbilities: {
      ...state.secondaryAbilities,
      players: {
        ...state.secondaryAbilities.players,
        [playerId]: {
          ...player,
          firewalker: true,
          magicShieldAbsorb: 25,
          magicShieldMaximum: 50,
          reservedMana: 50,
        },
      },
    },
  })
}

async function measureHud(page) {
  return page.locator('.hub-hud').evaluate((hud) => {
    const rect = (selector) => {
      const element = hud.querySelector(selector)
      if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`)
      const bounds = element.getBoundingClientRect()
      return {
        bottom: bounds.bottom,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        width: bounds.width,
      }
    }
    const bindings = [...hud.querySelectorAll('.hub-hud-selected-skill')]
      .map((element) => {
        if (!(element instanceof HTMLElement)) throw new Error('Missing selected skill icon')
        const bounds = element.getBoundingClientRect()
        return {
          binding: Number(element.getAttribute('data-binding')),
          centerX: (bounds.left + bounds.right) / 2,
          record: Number(element.getAttribute('data-record')),
        }
      })
    const optionalRect = (selector) => {
      const element = hud.querySelector(selector)
      if (!(element instanceof HTMLElement)) return null
      const bounds = element.getBoundingClientRect()
      return {
        bottom: bounds.bottom,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        width: bounds.width,
      }
    }
    const shield = hud.querySelector('.hub-hud-meter-shield')
    const healthFill = hud.querySelector(
      '.hub-hud-meter-health .hub-hud-meter-fill:not(.hub-hud-meter-shield)',
    )
    if (!(healthFill instanceof HTMLElement)) throw new Error('Missing local health fill')
    const healthFillBounds = healthFill.getBoundingClientRect()
    const healthClip = getComputedStyle(healthFill).clipPath
    const healthRightInset = /^inset\(0px ([\d.]+)% 0px 0px\)$/.exec(healthClip)
    if (!healthRightInset) throw new Error(`Unexpected local health clip: ${healthClip}`)
    const healthLabelText = healthFill.getAttribute('aria-label')
      ?? healthFill.getAttribute('alt')
      ?? ''
    const healthLabel = /^Health ([\d.]+) of ([\d.]+)$/.exec(healthLabelText)
    if (!healthLabel) throw new Error(`Unexpected local health label: ${healthLabelText}`)
    const manaFill = hud.querySelector('.hub-hud-meter-mana .hub-hud-meter-fill')
    if (!(manaFill instanceof HTMLElement)) throw new Error('Missing local mana fill')
    const manaFillBounds = manaFill.getBoundingClientRect()
    const manaClip = getComputedStyle(manaFill).clipPath
    const manaRightInset = /^inset\(0px ([\d.]+)% 0px 0px\)$/.exec(manaClip)
    if (!manaRightInset) throw new Error(`Unexpected local mana clip: ${manaClip}`)
    const manaRightInsetPercent = Number(manaRightInset[1])
    const manaVisibleWidth = manaFillBounds.width * (1 - manaRightInsetPercent / 100)
    const healthRightInsetPercent = Number(healthRightInset[1])
    const healthVisibleWidth = healthFillBounds.width
      * (1 - healthRightInsetPercent / 100)
    return {
      bindings,
      health: rect('.hub-hud-meter-health'),
      healthClip,
      healthCurrent: Number(healthLabel[1]),
      healthCore: rect(
        '.hub-hud-meter-health .hub-hud-meter-fill:not(.hub-hud-meter-shield)',
      ),
      healthMaximum: Number(healthLabel[2]),
      healthRightInsetPercent,
      healthVisible: {
        left: healthFillBounds.left,
        right: healthFillBounds.left + healthVisibleWidth,
        width: healthVisibleWidth,
      },
      mana: rect('.hub-hud-meter-mana'),
      manaClip,
      manaCore: rect('.hub-hud-meter-mana .hub-hud-meter-fill'),
      manaVisible: {
        left: manaFillBounds.left,
        right: manaFillBounds.left + manaVisibleWidth,
        width: manaVisibleWidth,
      },
      reserve: optionalRect('.hub-hud-mana-reserve'),
      shield: optionalRect('.hub-hud-meter-shield'),
      shieldClip: shield instanceof HTMLElement ? getComputedStyle(shield).clipPath : null,
    }
  })
}

async function measureVitalComposition(page) {
  return page.locator('.hub-hud-meter-health').evaluate((meter) => {
    const layers = [...meter.querySelectorAll('.hub-hud-meter-fill')].map((element) => ({
      blend: getComputedStyle(element).mixBlendMode,
      kind: element.classList.contains('hub-hud-meter-shield') ? 'shield' : 'health',
      label: element.getAttribute('aria-label') ?? element.getAttribute('alt'),
      record: element.getAttribute('data-native-ui-strip'),
    }))
    return {
      frameRecord: meter.querySelector('.hub-hud-meter-frame')
        ?.getAttribute('data-native-ui-strip') ?? null,
      layers,
      shieldLabel: layers.find(({ kind }) => kind === 'shield')?.label ?? null,
    }
  })
}

async function sampleHealthMeterPixels(page, points) {
  return sampleMeterPixels(page, '.hub-hud-meter-health', points)
}

async function sampleMeterPixels(page, selector, points) {
  const png = await page.locator(selector).screenshot()
  return page.evaluate(async ({ dataUrl, samplePoints }) => {
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (context === null) throw new Error('Unable to sample health-meter pixels')
    context.drawImage(image, 0, 0)
    return Object.fromEntries(Object.entries(samplePoints).map(([name, [x, y]]) => (
      [name, [...context.getImageData(x, y, 1, 1).data]]
    )))
  }, {
    dataUrl: `data:image/png;base64,${png.toString('base64')}`,
    samplePoints: points,
  })
}

function assertAdditiveOverlap({ empty, overlap, suffix }) {
  const energy = (pixel) => pixel[0] + pixel[1] + pixel[2]
  assert.ok(energy(overlap) > energy(suffix) + 30)
  assert.ok(energy(suffix) > energy(empty) + 30)
}

async function waitForLocalHealthRatio(page, expectedRatio) {
  await page.waitForFunction((ratio) => {
    const fill = document.querySelector(
      '.hub-hud-meter-health .hub-hud-meter-fill:not(.hub-hud-meter-shield)',
    )
    if (!(fill instanceof HTMLElement)) return false
    const label = fill.getAttribute('aria-label') ?? fill.getAttribute('alt') ?? ''
    const match = /^Health ([\d.]+) of ([\d.]+)$/.exec(label)
    return match !== null && Math.abs(Number(match[1]) / Number(match[2]) - ratio) < 0.01
  }, expectedRatio, { timeout: 10_000 })
}

function assertLocalHealthRetractsFromRight(hud) {
  const healthRatio = Math.min(1, Math.max(0, hud.healthCurrent / hud.healthMaximum))
  const expectedVisibleWidth = hud.healthCore.width * healthRatio ** 2
  assert.ok(hud.healthRightInsetPercent > 70 && hud.healthRightInsetPercent < 80)
  assert.equal(hud.healthVisible.left, hud.healthCore.left)
  assert.ok(Math.abs(hud.healthVisible.width - expectedVisibleWidth) < 0.001)
  assert.ok(Math.abs(
    hud.healthVisible.right - (hud.healthCore.left + expectedVisibleWidth)
  ) < 0.001)
  assert.ok(hud.healthVisible.right < hud.healthCore.right)
}

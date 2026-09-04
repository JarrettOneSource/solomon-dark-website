import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

import { chromium } from 'playwright-core'

import {
  createStoredZip,
  readNativeSaveArchive,
  readZip,
  WEB_GAME_SAVE_SUPPORT_ARCHIVE_PATH,
} from '../src/game/save/native-save-archive.ts'
import {
  decodeNativeDarkdataProfile,
  decodeNativeGamestateWizard,
} from '../src/game/save/native-save-bridge.ts'
import { parseNativeSyncBuffer } from '../src/game/save/native-save-codec.ts'
import {
  createGameSaveDocument,
  restoreGameSaveDocument,
} from '../src/game/save/game-save-document.ts'
import {
  createBoneyardCatalog,
  materializeBoneyard,
} from '../src/game/host/boneyard-catalog.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import {
  enterBoneyardWorld,
  stepGameSimulationTick,
} from '../src/game/core-server/game-simulation.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../src/game/core-kernels/boneyard-wave-director.ts'
import {
  createEquipmentInventoryItem,
  createFomentiusInventoryItem,
  DOWSING_EQUIPMENT_RECIPES,
  FOMENTIUS_STOCK_DEFINITIONS,
} from '../src/game/core-kernels/hub-economy.ts'
import { bindNativeBeltItem } from '../src/game/core-kernels/native-belt.ts'
import { exportWebGameSaveToNativeArchive } from '../src/game/save/game-save-portability.ts'

const baseUrl = process.env.SDR_NATIVE_SAVE_SMOKE_URL || 'http://127.0.0.1:4187'
const chromePath = process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome'
const screenshotRoot = process.env.SDR_NATIVE_SAVE_SMOKE_SCREENSHOT_ROOT || '/tmp'
const localCredential = 'native-save-browser-parity'
const hostLogs = []
const localHost = new URL(baseUrl).protocol === 'https:'
  ? null
  : await startGameHost({
      allowedOrigins: [new URL(baseUrl).origin],
      authentication: { credential: localCredential, kind: 'shared' },
      log: entry => hostLogs.push(entry),
      resetWhenEmpty: true,
      snapshotRate: 100,
    })
const runtime = localHost
  ? {
      gameEndpoint: {
        credential: localCredential,
        kind: 'localhost',
        url: localHost.address.url,
      },
    }
  : null
await mkdir(screenshotRoot, { recursive: true })
const fixture = JSON.parse(await readFile(
  new URL('../public/game/native/portable-profile-template.json', import.meta.url),
  'utf8',
))
const templateGamestate = Buffer.from(fixture.files.gamestate.base64, 'base64')
const sourceZipPath = process.env.SDR_NATIVE_SAVE_SOURCE_ZIP
let stockArchive
let gamestate
if (sourceZipPath) {
  stockArchive = new Uint8Array(await readFile(sourceZipPath))
  const files = [...(await readZip(stockArchive)).entries()]
  assert.equal(files.length, 1)
  assert.equal(files[0][0].split('/').at(-1).toLowerCase(), 'gamestate.sav')
  gamestate = files[0][1]
} else {
  gamestate = new Uint8Array(templateGamestate)
  stockArchive = createStoredZip([{ bytes: gamestate, path: 'gamestate.sav' }])
}
const expectedWizard = decodeNativeGamestateWizard(gamestate)
const expectedLearnedRows = expectedWizard.rows
  .filter(row => row.permanentRank > 0).length
const expectedEffectiveOnlyRows = expectedWizard.learnedOrder.filter(skillId => (
  expectedWizard.rows[skillId]?.permanentRank === 0
  && expectedWizard.rows[skillId]?.effectiveRank > 0
))
const expectedGamestateSha256 = createHash('sha256').update(gamestate).digest('hex')
const expectedBindingIntegerCount = bindingIntegerCount(gamestate)
const elementName = ['Ether', 'Fire', 'Air', 'Water', 'Earth'][expectedWizard.elementRoot]
const disciplineName = ({ 5: 'Body', 6: 'Mind', 7: 'Arcane' })[expectedWizard.disciplineRoot]
assert.ok(elementName)
assert.ok(disciplineName)
const stockUpload = {
  buffer: Buffer.from(stockArchive),
  mimeType: 'application/zip',
  name: sourceZipPath ? 'SolomonDarkStockSaveWaterMage.zip' : 'controlled-standalone-save.zip',
}

const accountUsername = process.env.SDR_NATIVE_SAVE_SMOKE_USERNAME
  || `SavePort${Date.now().toString(36).slice(-7)}`
const accountPassword = process.env.SDR_NATIVE_SAVE_SMOKE_PASSWORD
  || `SdrSave!${crypto.randomUUID()}`
const accountToken = await registerSmokeAccount(accountUsername, accountPassword)
const browser = await chromium.launch({ executablePath: chromePath, headless: true })

try {
  const anonymous = await runAnonymousJourney(browser)
  const cloud = await runCloudJourney(browser, accountToken)
  process.stdout.write(`${JSON.stringify({
    anonymous,
    cloud,
    fixture: {
      bindingIntegerCount: expectedBindingIntegerCount,
      effectiveOnlyRows: expectedEffectiveOnlyRows,
      gamestateSha256: expectedGamestateSha256,
      level: expectedWizard.level,
      wizardName: expectedWizard.name,
    },
    status: 'ok',
  })}\n`)
} finally {
  await Promise.all([
    browser.close(),
    localHost?.close(),
  ])
}

async function runAnonymousJourney(browser) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { height: 900, width: 1600 },
  })
  await mockDevelopmentDeployment(context)
  if (runtime) {
    await context.addInitScript((value) => {
      window.solomonDarkRuntime = value
    }, runtime)
  }
  const page = await context.newPage()
  const diagnostics = collectDiagnostics(page)
  try {
    await openGameTitle(page)
    await importFromTitleSettings(page)
    const imported = await readLocalSave(page)
    assertImportedWebSave(imported)

    const preparedBoneyard = prepareBoneyardDocument(imported.document)
    await replaceLocalSave(page, preparedBoneyard.document, imported.revision)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForTitle(page)
    const enteredBoneyard = await resumeLastGame(page, 'boneyard')
    assert.equal(enteredBoneyard.runId, preparedBoneyard.runId)
    await leaveBoneyard(page)
    await waitForHostReset()
    const persisted = await readLocalSave(page)
    assertBoneyardWebSave(persisted, enteredBoneyard.runId)
    assert.ok(persisted.revision >= imported.revision)

    const exported = await exportFromTitleSettings(page)
    const support = await assertStockExport(exported, persisted.document)
    const archivePath = `${screenshotRoot}/solomon-dark-native-save-anonymous.zip`
    await writeFile(archivePath, exported)
    await page.locator('.native-save-transfer-settings input[type="file"]').setInputFiles({
      buffer: Buffer.from(exported), mimeType: 'application/zip', name: 'saved-inventory.zip',
    })
    await page.getByRole('region', { name: 'Save import preview' })
      .getByText('Browser save: inventory, equipment, and the saved run will be restored.').waitFor()
    await page.getByRole('button', { name: 'REPLACE BROWSER SLOT', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Save imported' }).waitFor()
    assertInventoryRetained((await readLocalSave(page)).document, persisted.document)
    await page.getByRole('button', { name: 'BACK', exact: true }).click()
    await page.getByRole('button', { name: 'DONE', exact: true }).click()

    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForTitle(page)
    const resumedBoneyard = await resumeLastGame(page, 'boneyard')
    assert.equal(resumedBoneyard.runId, enteredBoneyard.runId)
    assert.ok(resumedBoneyard.tick >= support.tick)
    await page.waitForTimeout(2_500)
    await assertInventoryResumed(page, persisted.document)
    await page.screenshot({
      path: `${screenshotRoot}/solomon-dark-native-save-anonymous.png`,
    })
    assertCleanDiagnostics(diagnostics)
    return {
      exportedBytes: exported.byteLength,
      archivePath,
      boneyardRunId: enteredBoneyard.runId,
      importedRevision: imported.revision,
      previewScreenshot: `${screenshotRoot}/solomon-dark-native-save-anonymous-preview.png`,
      resumedRevision: persisted.revision,
      screenshot: `${screenshotRoot}/solomon-dark-native-save-anonymous.png`,
      supportBytes: support.bytes,
      supportEnemyCount: support.enemyCount,
      supportTick: support.tick,
    }
  } finally {
    await context.close()
  }
}

async function runCloudJourney(browser, token) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { height: 900, width: 1600 },
  })
  await mockDevelopmentDeployment(context)
  if (runtime) {
    await context.addInitScript((value) => {
      window.solomonDarkRuntime = value
    }, runtime)
  }
  await context.addInitScript((value) => localStorage.setItem('sdr.token', value), token)
  const page = await context.newPage()
  const diagnostics = collectDiagnostics(page)
  try {
    await page.goto(`${baseUrl}/account`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: accountUsername }).waitFor({ timeout: 30_000 })
    await page.getByRole('heading', { name: 'Cloud Saves' }).waitFor()
    await page.getByRole('button', { name: /import save/i }).waitFor()
    await page.locator('input[type="file"][accept*=".zip"]').setInputFiles(stockUpload)
    const accountPreview = page.getByText(expectedWizard.name, { exact: true }).locator('..')
    await assertImportPreview(accountPreview)
    const previewScreenshot = `${screenshotRoot}/solomon-dark-native-save-cloud-preview.png`
    await page.screenshot({ path: previewScreenshot })
    const importResponse = page.waitForResponse(response => (
      response.request().method() === 'PUT'
      && new URL(response.url()).pathname === '/api/game/saves/0'
    ))
    await page.getByRole('button', { name: /write slot I|replace slot I/i }).click()
    assert.ok((await importResponse).ok())
    const imported = await waitForCloudSave(page, token, save => save?.revision === 1)
    assertImportedWebSave(imported)
    const inventorySave = prepareInventoryDocument(imported.document)
    const inventoryExport = await exportWebGameSaveToNativeArchive(inventorySave)
    await page.locator('input[type="file"][accept*=".zip"]').setInputFiles({
      buffer: Buffer.from(inventoryExport.archive), mimeType: 'application/zip', name: 'inventory.zip',
    })
    await page.getByText('Browser save: inventory, equipment, and the saved run will be restored.').waitFor()
    await page.getByRole('button', { name: /replace slot I/i }).click()
    const inventoryImport = await waitForCloudSave(page, token, save => save?.revision === 2)
    assertInventoryRetained(inventoryImport.document, inventorySave)

    await openGameTitle(page)
    await resumeLastGame(page)
    await returnToTitle(page)
    const persisted = await readCloudSave(page, token)
    assertInventoryRetained(persisted.document, inventorySave)
    assert.ok(persisted.revision >= imported.revision)

    await page.goto(`${baseUrl}/account`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Cloud Saves' }).waitFor({ timeout: 30_000 })
    const exported = await captureDownload(
      page,
      page.getByRole('button', { name: /export save/i }),
    )
    await assertStockExport(exported, persisted.document)
    const archivePath = `${screenshotRoot}/solomon-dark-native-save-cloud.zip`
    await writeFile(archivePath, exported)

    await page.locator('input[type="file"][accept*=".zip"]').setInputFiles({
      buffer: Buffer.from(exported), mimeType: 'application/zip', name: 'saved-inventory.zip',
    })
    await page.getByText('Browser save: inventory, equipment, and the saved run will be restored.').waitFor()
    await page.getByRole('button', { name: /replace slot I/i }).click()
    const reimported = await waitForCloudSave(page, token, save => save?.revision === persisted.revision + 1)
    assertInventoryRetained(reimported.document, persisted.document)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForCloudSave(page, token, save => save?.revision === reimported.revision)
    await openGameTitle(page)
    await resumeLastGame(page)
    await page.waitForTimeout(2_500)
    await assertInventoryResumed(page, persisted.document)
    await page.screenshot({
      path: `${screenshotRoot}/solomon-dark-native-save-cloud.png`,
    })
    assertCleanDiagnostics(diagnostics)
    return {
      exportedBytes: exported.byteLength,
      archivePath,
      importedRevision: imported.revision,
      previewScreenshot,
      resumedRevision: persisted.revision,
      screenshot: `${screenshotRoot}/solomon-dark-native-save-cloud.png`,
      username: accountUsername,
    }
  } finally {
    await context.close()
  }
}

async function openGameTitle(page) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await waitForTitle(page)
}

async function waitForTitle(page) {
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  const tutorial = page.locator('.stock-prompt-stage[data-prompt-kind="tutorial"]')
  const tutorialVisible = await tutorial.waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true, () => false)
  if (tutorialVisible) {
    await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
    await tutorial.waitFor({ state: 'detached' })
  }
}

async function openTitleSaveTransfer(page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('button', { name: 'STOCK / BROWSER SAVE', exact: true }).click()
  await page.locator('.game-settings-dialog[data-settings-page="save-transfer"]').waitFor()
}

async function importFromTitleSettings(page) {
  await openTitleSaveTransfer(page)
  await page.getByRole('button', { name: 'CHOOSE SAVE FILES', exact: true }).waitFor()
  await page.locator('.native-save-transfer-settings input[type="file"]').setInputFiles(stockUpload)
  await assertImportPreview(page.getByRole('region', { name: 'Save import preview' }))
  await page.screenshot({
    path: `${screenshotRoot}/solomon-dark-native-save-anonymous-preview.png`,
  })
  await page.getByRole('button', { name: 'REPLACE BROWSER SLOT', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Save imported' }).waitFor()
  await page.getByRole('button', { name: 'BACK', exact: true }).click()
  await page.getByRole('button', { name: 'DONE', exact: true }).click()
}

async function assertImportPreview(preview) {
  await preview.waitFor({ timeout: 30_000 })
  await assertContains(preview, expectedWizard.name)
  await assertContains(preview, `Level ${expectedWizard.level}`)
  await assertContains(preview, `${elementName} / ${disciplineName}`)
  await assertContains(preview, '500 gold')
  await assertContains(preview, `${expectedLearnedRows} learned rows`)
  await assertContains(preview, 'Only gamestate.sav was supplied')
  if (expectedEffectiveOnlyRows.length > 0) {
    await assertContains(preview, `row(s) ${expectedEffectiveOnlyRows.join(', ')}`)
  }
}

async function resumeLastGame(page, worldKind = 'hub') {
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const lastGame = page.getByRole('button', { name: 'Last game', exact: true })
  assert.equal(await lastGame.isEnabled(), true)
  await lastGame.click()
  if (worldKind === 'boneyard') {
    try {
      await page.locator('.boneyard-scene[data-renderer-state="ready"]')
        .waitFor({ timeout: 30_000 })
    } catch (cause) {
      const browserState = await page.evaluate(() => ({
        body: document.body.innerText.slice(0, 2_000),
        loading: document.querySelector('.match-loading-screen')?.textContent ?? null,
        title: document.querySelector('.main-menu-page') !== null,
        url: location.href,
      }))
      const taskHostState = localHost
        ? {
            loadedRunId: localHost.loadedBoneyard()?.runId ?? null,
            playerCount: localHost.humanPlayerCount(),
            tick: localHost.state().tick,
            worldKind: localHost.state().world.kind,
          }
        : null
      throw new Error(`Boneyard support-save resume did not become ready: ${JSON.stringify({
        browserState,
        hostLogs: hostLogs.slice(-20),
        taskHostState,
      })}`, { cause })
    }
    return readBoneyardFrame(page)
  }
  await page.locator('.hub-scene[data-renderer-state="ready"]')
    .waitFor({ timeout: 45_000 })
  await page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]').waitFor()
  return null
}

async function leaveBoneyard(page) {
  const scene = page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]')
  await scene.waitFor({ timeout: 30_000 })
  await scene.focus()
  await page.keyboard.press('Escape')
  const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await pause.waitFor({ timeout: 15_000 })
  await pause.getByRole('button', { name: 'LEAVE GAME', exact: true }).click()
  await waitForTitle(page)
}

function readBoneyardFrame(page) {
  return page.waitForFunction(() => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame?.runId && frame.runPhase === 'active'
      ? { runId: frame.runId, tick: frame.tick }
      : null
  }, undefined, { timeout: 30_000 }).then(handle => handle.jsonValue())
}

async function returnToTitle(page) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await waitForTitle(page)
}

async function exportFromTitleSettings(page) {
  await openTitleSaveTransfer(page)
  return captureDownload(
    page,
    page.getByRole('button', { name: 'DOWNLOAD SAVE ARCHIVE', exact: true }),
  )
}

async function captureDownload(page, button) {
  const accept = async (dialog) => {
    await dialog.accept()
  }
  page.on('dialog', accept)
  try {
    const downloadEvent = page.waitForEvent('download')
    await button.click()
    const download = await downloadEvent
    const path = await download.path()
    assert.ok(path)
    return new Uint8Array(await readFile(path))
  } finally {
    page.off('dialog', accept)
  }
}

async function assertStockExport(bytes, browserDocument) {
  const archive = await readNativeSaveArchive(bytes)
  const profile = decodeNativeDarkdataProfile(archive.darkdata)
  const wizard = decodeNativeGamestateWizard(archive.gamestate)
  assert.equal(profile.gold, 500)
  assert.equal(wizard.name, expectedWizard.name)
  assert.equal(wizard.level, expectedWizard.level)
  assert.equal(wizard.elementRoot, expectedWizard.elementRoot)
  assert.equal(wizard.disciplineRoot, expectedWizard.disciplineRoot)
  assert.equal(wizard.rows.length, 83)
  assert.equal(bindingIntegerCount(archive.gamestate), expectedBindingIntegerCount)
  const supportFiles = (archive.retainedFiles ?? []).filter(({ path }) => (
    path.toLowerCase() === WEB_GAME_SAVE_SUPPORT_ARCHIVE_PATH
  ))
  assert.equal(supportFiles.length, 1)
  const document = new TextDecoder().decode(supportFiles[0].bytes)
  const raw = JSON.parse(document)
  assert.equal(raw.integrity, 'local-only')
  assert.equal(raw.nativeSource, null)
  assert.equal(raw.continuation.summary.partyRejoinToken, null)
  const support = restoreGameSaveDocument(document)
  const source = restoreGameSaveDocument(browserDocument)
  assert.equal(support.state.world.kind, source.state.world.kind)
  if (source.state.world.kind === 'boneyard') {
    assert.ok(source.state.world.enemies.actors.length > 0)
    assert.deepEqual(support.loadedBoneyard, source.loadedBoneyard)
    assert.deepEqual(support.state, source.state)
  } else {
    assert.deepEqual(support.state.playerEntities.configs, source.state.playerEntities.configs)
    assert.deepEqual(
      support.state.playerEntities.progressions,
      source.state.playerEntities.progressions,
    )
  }
  return {
    bytes: supportFiles[0].bytes.byteLength,
    document,
    enemyCount: support.state.world.kind === 'boneyard'
      ? support.state.world.enemies.actors.length
      : 0,
    runId: support.state.world.kind === 'boneyard' ? support.state.world.runId : null,
    tick: support.state.tick,
  }
}

function assertImportedWebSave(record) {
  assert.ok(record)
  const document = JSON.parse(record.document)
  assert.equal(document.integrity, 'local-only')
  assert.equal(document.continuation.simulation.world.kind, 'hub')
  assert.equal(
    document.continuation.simulation.playerEntities.configs[0].displayName,
    expectedWizard.name,
  )
  assert.equal(
    document.continuation.simulation.playerEntities.progressions[0].level,
    expectedWizard.level,
  )
  assert.equal(
    document.continuation.simulation.playerEntities.economies[0].gold,
    500,
  )
  assert.equal(document.nativeSource.darkdataSha256, fixture.files.darkdata.sha256)
  assert.equal(document.nativeSource.gamestateSha256, expectedGamestateSha256)
}

function prepareBoneyardDocument(document) {
  const restored = restoreGameSaveDocument(prepareInventoryDocument(document))
  const loaded = materializeBoneyard(
    createBoneyardCatalog(),
    'default-random',
    Buffer.alloc(16, 41),
  )
  assert.ok(loaded)
  let state = enterBoneyardWorld(restored.state, loaded)
  assert.equal(state.world.kind, 'boneyard')
  state = stepGameSimulationTick(state, {}, {
    enemySpawnIntents: [{
      enemyToken: 'WRAITH',
      flags: [],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.WRAITH,
      position: { x: loaded.scene.spawn.x + 100, y: loaded.scene.spawn.y },
      spawnTick: state.tick,
      waveOrdinal: 1,
    }],
  })
  return {
    document: createGameSaveDocument({
      integrity: restored.integrity,
      loadedBoneyard: loaded,
      mods: restored.mods,
      modState: restored.modState,
      nativeSource: restored.nativeSource,
      playerId: restored.playerId,
      state,
    }),
    runId: loaded.runId,
  }
}

function prepareInventoryDocument(document) {
  const restored = restoreGameSaveDocument(document)
  const state = restored.state
  const economy = state.playerEntities.economies[0]
  const ring = createEquipmentInventoryItem(
    DOWSING_EQUIPMENT_RECIPES.find(recipe => recipe.type === 'ring'), 500_001,
  )
  const potion = createFomentiusInventoryItem(
    FOMENTIUS_STOCK_DEFINITIONS.find(row => row.kind === 'health-potion'), 500_002, 7,
  )
  const sack = {
    ...createFomentiusInventoryItem(FOMENTIUS_STOCK_DEFINITIONS.find(row => row.kind === 'sack'), 500_003),
    contents: [potion], name: 'Saved treasures',
  }
  const inventory = {
    ...economy,
    backpack: [...economy.backpack, { ...sack, inventorySlot: 6 }],
    equipment: { ...economy.equipment, rings: [ring, null, null] },
    nextItemId: 500_010,
    storage: [{ ...potion, id: 500_004, inventorySlot: 3 }],
  }
  return createGameSaveDocument({
    integrity: restored.integrity, loadedBoneyard: restored.loadedBoneyard,
    mods: restored.mods, modState: restored.modState,
    nativeSource: restored.nativeSource, playerId: restored.playerId,
    state: {
      ...state,
      playerEntities: {
        ...state.playerEntities, economies: [inventory],
        belts: [bindNativeBeltItem(state.playerEntities.belts[0], inventory, ring.id, 7)],
      },
    },
  })
}

function assertInventoryRetained(actualDocument, expectedDocument) {
  const actual = restoreGameSaveDocument(actualDocument).state.playerEntities
  const expected = restoreGameSaveDocument(expectedDocument).state.playerEntities
  for (const field of ['backpack', 'equipment', 'storage', 'nextItemId']) {
    assert.deepEqual(actual.economies[0][field], expected.economies[0][field], field)
  }
  assert.deepEqual(actual.belts[0], expected.belts[0])
}

async function assertInventoryResumed(page, expectedDocument) {
  if (localHost) {
    const expected = restoreGameSaveDocument(expectedDocument).state.playerEntities
    const actual = localHost.state().playerEntities
    for (const field of ['backpack', 'equipment', 'storage', 'nextItemId']) {
      assert.deepEqual(actual.economies[0][field], expected.economies[0][field], field)
    }
    assert.deepEqual(actual.belts[0], expected.belts[0])
  }
  await page.getByRole('button', { name: /Open inventory/ }).click()
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor()
  await inventory.getByRole('button', { name: /Saved treasures/ }).waitFor()
  await inventory.getByRole('button', { name: /Pentaclostic Ring/ }).first().waitFor()
}

function assertBoneyardWebSave(record, runId) {
  assert.ok(record)
  const document = JSON.parse(record.document)
  assert.equal(document.continuation.simulation.world.kind, 'boneyard')
  assert.equal(document.continuation.simulation.world.runId, runId)
  assert.equal(document.continuation.loadedBoneyard.runId, runId)
  assert.equal(document.continuation.summary.activeRun, true)
}

function bindingIntegerCount(bytes) {
  const binding = parseNativeSyncBuffer(bytes).root.children[1].children[0].payload
  const view = new DataView(binding.buffer, binding.byteOffset, binding.byteLength)
  const booleanCount = view.getUint32(0, true)
  return view.getUint32(4 + booleanCount, true)
}

async function assertContains(locator, expected) {
  assert.match((await locator.textContent()) || '', new RegExp(escapeRegExp(expected), 'i'))
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function collectDiagnostics(page) {
  const pageErrors = []
  const consoleErrors = []
  const failedResponses = []
  const requestFailures = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') {
      const location = message.location().url
      consoleErrors.push(`${message.text()}${location ? ` [${location}]` : ''}`)
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText ?? ''
    if (errorText === 'net::ERR_ABORTED') return
    requestFailures.push(`${request.method()} ${request.url()} ${errorText}`.trim())
  })
  return { consoleErrors, failedResponses, pageErrors, requestFailures }
}

function assertCleanDiagnostics(diagnostics) {
  assert.deepEqual(diagnostics.pageErrors, [])
  assert.deepEqual(diagnostics.consoleErrors, [])
  assert.deepEqual(diagnostics.failedResponses, [])
  assert.deepEqual(diagnostics.requestFailures, [])
}

function readLocalSave(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('solomon-dark-game-saves', 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const request = open.result.transaction('slots', 'readonly').objectStore('slots').get(0)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result ?? null)
    }
  }))
}

function replaceLocalSave(page, document, revision) {
  return page.evaluate(({ document: replacement, revision: currentRevision }) => (
    new Promise((resolve, reject) => {
      const open = indexedDB.open('solomon-dark-game-saves', 1)
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const transaction = open.result.transaction('slots', 'readwrite')
        transaction.onerror = () => reject(transaction.error)
        transaction.oncomplete = () => resolve()
        transaction.objectStore('slots').put({
          document: replacement,
          revision: currentRevision + 1,
          slot: 0,
        })
      }
    })
  ), { document, revision })
}

async function waitForHostReset() {
  if (!localHost) return
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (localHost.humanPlayerCount() === 0 && localHost.loadedBoneyard() === null) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('the local host did not reset after the Boneyard leave')
}

function readCloudSave(page, token) {
  return page.evaluate(async (bearer) => {
    const response = await fetch('/api/game/saves/0', {
      headers: { Authorization: `Bearer ${bearer}` },
    })
    if (!response.ok) throw new Error(`cloud save read failed (${response.status})`)
    return response.json().then(({ save }) => save)
  }, token)
}

async function waitForCloudSave(page, token, predicate, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const save = await readCloudSave(page, token)
    if (predicate(save)) return save
    await page.waitForTimeout(100)
  }
  throw new Error('timed out waiting for the cloud game save')
}

async function registerSmokeAccount(username, password) {
  const response = await fetch(new URL('/api/auth/register', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: `${username.toLowerCase()}@example.invalid`,
      password,
      username,
    }),
  })
  const payload = await response.json()
  if (response.status !== 201 || typeof payload.token !== 'string') {
    throw new Error(`smoke account registration failed (${response.status})`)
  }
  return payload.token
}

async function mockDevelopmentDeployment(context) {
  await context.route('**/deployment.json?*', async (route) => {
    const revision = new URL(route.request().url()).searchParams.get('current')
    await route.fulfill({ json: { revision } })
  })
}

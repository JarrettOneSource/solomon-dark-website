import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import {
  getPlayerCharacter,
  getPlayerEconomy,
  getPlayerProgression,
} from '../src/game/core-server/game-simulation.ts'
import {
  replacePlayerCharacter,
  replacePlayerEconomy,
} from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { createBoneyardCatalog } from '../src/game/host/boneyard-catalog.ts'
import {
  compileWebSessionContentDefinitions,
  materializeWebSessionContent,
} from '../src/game/host/web-mod-content.ts'
import { checkWebLuaPackage } from '../src/game/modding/definition/index.ts'
import { admitPreparedPackage } from './sdmod/cli.mjs'

const require = createRequire(import.meta.url)
const webRoot = fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url))
const examplesRoot = fileURLToPath(new URL('../examples/web-lua/', import.meta.url))
const screenshotRoot = process.env.SDR_SHOWCASE_SCREENSHOT_ROOT
  || join(tmpdir(), 'solomon-dark-web-lua-showcases')
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')

await mkdir(screenshotRoot, { recursive: true })
const content = await showcaseContent()
const server = await startStaticClientServer({ root: webRoot })
const credential = 'web-lua-showcase-browser-smoke'
const hostLogs = []
const host = await startGameHost({
  allowedOrigins: [server.origin],
  authentication: { kind: 'shared', credential },
  boneyards: createBoneyardCatalog(content.boneyards),
  content: content.manifest,
  log: entry => hostLogs.push(entry),
  luaWasmPath: require.resolve('wasmoon/dist/glue.wasm'),
  modAssets: content.assets,
  modContent: content,
  snapshotRate: 20,
})
const browser = await chromium.launch({ executablePath: chromePath, headless: true })
const contexts = await Promise.all([
  browser.newContext({ viewport: { height: 900, width: 1_600 } }),
  browser.newContext({ viewport: { height: 900, width: 1_600 } }),
])
const pages = await Promise.all(contexts.map(context => context.newPage()))
const [hostPage, guestPage] = pages
const consoleErrors = []
const pageErrors = []
const failedResponses = []
const contentRequests = []
const filesBySha = new Map(content.assets.map((asset) => {
  const source = content.modSources.find(mod => mod.identity.id === asset.modId)
  return [asset.sha256, { asset, bytes: source?.files[asset.path] }]
}))

for (const page of pages) {
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() })
  })
  await page.route('**/deployment.json?*', route => route.fulfill({
    json: { revision: 'web-lua-showcase-smoke' },
  }))
  await page.route('**/api/mods/active', route => route.fulfill({
    headers: { 'cache-control': 'no-store' },
    json: {
      manifestSha256: content.manifest.manifestSha256,
      mods: content.summary.mods.map(mod => ({
        ...mod,
        boneyardCount: mod.id === 'showcase.monument-crypt' ? 1 : 0,
        hasLua: true,
        priority: 0,
      })),
    },
  }))
  await page.route('**/api/game/content/*', (route) => {
    const sha = new URL(route.request().url()).pathname.split('/').at(-1)
    const file = filesBySha.get(sha)
    contentRequests.push({ found: Boolean(file?.bytes), sha })
    return file?.bytes
      ? route.fulfill({ body: Buffer.from(file.bytes), contentType: file.asset.contentType })
      : route.fulfill({ status: 404 })
  })
  await page.addInitScript(runtime => {
    window.solomonDarkRuntime = runtime
  }, {
    gameEndpoint: {
      credential,
      kind: 'localhost',
      url: host.address.url,
    },
  })
}

const screenshots = {}
let stage = 'bootstrap'
const mark = (value) => {
  stage = value
  process.stdout.write(`[showcase] ${value}\n`)
}
try {
  mark('entering host and guest Hub')
  await enterHub(hostPage, server.origin, 'ShowcaseHost', 'Fire')
  await enterHub(guestPage, server.origin, 'ShowcaseGuest', 'Air')
  await Promise.all(pages.map(page => waitForPlayerCount(page, 2)))
  mark('testing Apprentice Apothecary shop')
  const hostPlayerId = host.hostPlayerId()
  const guestPlayerId = host.state().playerEntities.identities
    .map(({ playerId }) => playerId)
    .find(playerId => playerId !== hostPlayerId)
  assert.ok(hostPlayerId && guestPlayerId)

  mark('testing mod-expanded stock Boast menu')
  const boastDefinition = content.compiledMods.flatMap(mod => mod.content.map(definition => ({
    definition,
    modId: mod.identity.id,
  }))).find(({ definition }) => definition.contentKind === 'boast')
  assert.ok(boastDefinition)
  movePlayer(host, hostPlayerId, { x: 895.5, y: 485.5 })
  movePlayer(host, guestPlayerId, { x: 1_300, y: 700 })
  const boastPrompt = hostPage.locator(
    '.game-interact-prompt[data-interaction-target="hub:annalist"]',
  )
  await boastPrompt.waitFor({ timeout: 15_000 })
  await boastPrompt.click()
  const boastDialog = hostPage.getByRole('dialog', { name: 'Talking to Provokatus' })
  await boastDialog.waitFor()
  await boastDialog.getByRole('button', { name: 'Skip' }).click()
  await boastDialog.getByRole('button', { name: 'Boast' }).click()
  await boastDialog.locator('[data-native-selector="boast"]').waitFor({ state: 'attached' })
  const boastCanvas = boastDialog.locator('.hub-inventory-native-canvas')
  await hostPage.waitForFunction(() => (
    document.querySelector('.hub-inventory-native-canvas')?.dataset.nativeBoastMenu
      === 'mod-expanded'
  ))
  await boastDialog.locator(
    '.hub-inventory-native-canvas[data-native-reveal="settled"]',
  ).waitFor({ timeout: 15_000 })
  assert.equal(await boastDialog.locator('[data-native-selector-kind="boast"]').count(), 5)
  assert.equal(await boastCanvas.getAttribute('data-native-boast-content-height'), '585')
  assert.equal(await boastCanvas.getAttribute('data-native-boast-scroll-max'), '185')
  assert.equal(await boastCanvas.getAttribute('data-native-boast-scroll-y'), '0')
  assert.equal(await boastCanvas.getAttribute('data-native-boast-icon-records'), '90,91,92,93,94')
  screenshots.boastStock = join(screenshotRoot, 'boast-initial.png')
  await hostPage.screenshot({ path: screenshots.boastStock })
  const boastActions = boastDialog.locator('[data-native-selector="boast"]')
  const boastBounds = await boastActions.boundingBox()
  assert.ok(boastBounds)
  await hostPage.mouse.move(boastBounds.x + 800, boastBounds.y + 650)
  await hostPage.mouse.down()
  await hostPage.mouse.move(boastBounds.x + 800, boastBounds.y + 400, { steps: 5 })
  await hostPage.mouse.up()
  await hostPage.waitForFunction(() => (
    document.querySelector('.hub-inventory-native-canvas')?.dataset.nativeBoastScrollY === '185'
  ))
  assert.equal(await boastCanvas.getAttribute('data-native-boast-rows'), '5')
  assert.equal(await boastCanvas.getAttribute('data-native-boast-icon-records'), '91,92,93,94,mod')
  const modBoastRow = boastDialog.locator(
    `[data-native-selector-kind="boast"][data-native-selector-id="${boastDefinition.definition.contentId}"]`,
  )
  await modBoastRow.hover()
  await hostPage.waitForFunction(expected => (
    document.querySelector('.hub-inventory-native-canvas')?.dataset.nativeBoastHighlighted
      === expected
  ), `mod:${boastDefinition.modId}:${boastDefinition.definition.contentId}`)
  screenshots.boastMod = join(screenshotRoot, 'boast-mod-scrolled.png')
  await hostPage.screenshot({ path: screenshots.boastMod })
  await modBoastRow.click()
  await waitUntil(() => {
    const selected = getPlayerEconomy(host.state(), hostPlayerId).npc.boast.selected
    return typeof selected !== 'number' && selected?.contentId === boastDefinition.definition.contentId
  }, 'mod Boast selection did not reach the authoritative participant economy')
  await boastDialog.locator(
    `xpath=self::*[@data-native-chat-record="MOD_BOAST_${boastDefinition.definition.contentId}"]`,
  ).waitFor({ timeout: 20_000 })
  await boastDialog.getByRole('button', { name: 'Skip' }).click()
  const boastInstruction = hostPage.locator(
    '.native-notebox-overlay[data-native-notebox-kind="instruction"]',
  )
  await boastInstruction.waitFor()
  assert.match(await boastInstruction.innerText(), /Wave 25/)
  await hostPage.waitForFunction(() => (
    Number(document.querySelector(
      '.native-notebox-overlay[data-native-notebox-kind="instruction"]',
    )?.dataset.nativeNoteboxOpacity) >= 0.99
  ))
  screenshots.boastInstruction = join(screenshotRoot, 'boast-mod-instruction.png')
  await hostPage.screenshot({ path: screenshots.boastInstruction })
  await boastInstruction.waitFor({ state: 'detached', timeout: 12_000 })

  giveGold(host, hostPlayerId, 200)
  moveStarterRobeToBackpack(host, hostPlayerId)
  movePlayer(host, hostPlayerId, { x: 1510, y: 665 })
  movePlayer(host, guestPlayerId, { x: 1480, y: 665 })
  const shopButton = hostPage.getByRole('button', { name: /Apprentice Apothecary · 8 gold/ })
  await shopButton.waitFor({ timeout: 15_000 })
  await shopButton.click()
  await waitUntil(() => getPlayerEconomy(host.state(), hostPlayerId).backpack.some(item => (
    item.kind === 'mod-item' && item.name === 'Moondust'
  )), 'browser shop purchase did not reach the host')
  const reforgeButton = hostPage.getByRole('button', { name: /Apprentice Apothecary · Reforge · 25 gold/ })
  await reforgeButton.waitFor({ timeout: 15_000 })
  await reforgeButton.click()
  await waitUntil(() => getPlayerEconomy(host.state(), hostPlayerId).backpack.some(item => (
    item.kind === 'equipment' && item.modAffixes?.some(affix => affix.name === 'Clear Minded')
  )), 'browser reforge did not attach Clear Minded')
  screenshots.apprentice = join(screenshotRoot, 'apprentice-apothecary.png')
  await hostPage.screenshot({ path: screenshots.apprentice })

  mark('entering Monument Approach')
  await hostPage.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const picker = hostPage.getByRole('dialog', { name: 'Choose a Boneyard' })
  await waitUntil(async () => (
    await picker.isVisible() || host.state().world.kind === 'boneyard'
  ), 'Boneyard picker or run did not open')
  if (await picker.isVisible()) {
    await picker.getByRole('button', { name: /Monument Approach/ }).click()
  }
  await waitUntil(
    () => host.state().world.kind === 'boneyard',
    'host did not accept the Monument Approach start request',
  )
  await Promise.all(pages.map(page => waitForBoneyard(page, 2)))
  assert.ok(contentRequests.length > 0)
  assert.ok(contentRequests.every(request => request.found))
  assert.equal(host.loadedBoneyard()?.choice.name, 'Monument Approach')
  mark('waiting for replicated minimap, enemy, and powerup')
  if (host.state().world.kind !== 'boneyard') throw new Error('showcase Boneyard did not load')
  Object.assign(host.state(), {
    world: {
      ...host.state().world,
      arenaTransition: null,
      encounter: null,
      waves: null,
    },
  })
  await Promise.all(pages.flatMap(page => [
    page.locator('.mod-minimap').waitFor({ timeout: 20_000 }),
    page.locator('.mod-enemy').first().waitFor({ timeout: 20_000 }),
    page.locator('.mod-powerup').waitFor({ timeout: 20_000 }),
  ]))
  await hostPage.locator('.mod-minimap').getByRole('button', { name: 'ping' }).click()
  assert.equal(await hostPage.locator('.mod-enemy').count(), await guestPage.locator('.mod-enemy').count())
  screenshots.boneyardHost = join(screenshotRoot, 'monument-boneyard-host.png')
  screenshots.boneyardGuest = join(screenshotRoot, 'monument-boneyard-guest.png')
  await Promise.all([
    hostPage.screenshot({ path: screenshots.boneyardHost }),
    guestPage.screenshot({ path: screenshots.boneyardGuest }),
  ])

  mark('casting Grave Aura and choosing Gravity Student')
  movePlayer(host, hostPlayerId, { x: 1700, y: 1700 })
  movePlayer(host, guestPlayerId, { x: 400, y: 400 })
  await hostPage.waitForTimeout(500)
  const gravityChoices = pages.map(page => page.getByRole('button', { name: /Gravity Student/ }))
  const graveAura = hostPage.getByRole('button', { name: 'Grave Aura' })
  await graveAura.click()
  await Promise.all(pages.map(page => page.locator('.mod-spell-effect__area').waitFor({ timeout: 10_000 })))
  await hostPage.waitForTimeout(3_500)
  await graveAura.click()
  await Promise.all(gravityChoices.map(choice => choice.waitFor({ timeout: 20_000 })))
  screenshots.gravity = join(screenshotRoot, 'gravity-lesson.png')
  await hostPage.screenshot({ path: screenshots.gravity })
  await Promise.all(gravityChoices.map(choice => choice.click()))
  await Promise.all(gravityChoices.map(choice => choice.waitFor({ state: 'detached', timeout: 15_000 })))
  await waitUntil(() => host.state().levelUpBarrier === null, 'shared mod skill choices did not resolve')
  await Promise.all(pages.map(page => page.locator(
    '.main-menu-page[data-gameplay-resume-grace="none"]',
  ).waitFor({ timeout: 15_000 })))
  await hostPage.getByRole('button', { name: 'Open skills' }).click()
  const modSkillBook = hostPage.locator('.mod-skill-book')
  await modSkillBook.waitFor({ state: 'visible', timeout: 15_000 })
  assert.match(await modSkillBook.textContent(), /Gravity Student/)
  await modSkillBook.getByRole('button', { name: /Gravity Well/ }).click()
  await hostPage.getByRole('button', { name: 'Close skills' }).click()
  await hostPage.getByRole('navigation', { name: 'Mod spell quickbar' })
    .getByTitle(/Gravity Well/).waitFor({ timeout: 15_000 })
  await Promise.all(pages.map(page => page.locator(
    '.main-menu-page[data-gameplay-resume-grace="none"]',
  ).waitFor({ timeout: 15_000 })))
  await Promise.all(pages.map(page => page.locator('.gameplay-pause-overlay').waitFor({
    state: 'detached',
    timeout: 15_000,
  })))

  mark('entering and traversing Monument Crypt')
  const monument = host.loadedBoneyard().scene.objects.find(object => object.typeId === 2009)
  assert.ok(monument)
  movePlayer(host, hostPlayerId, { x: monument.pos.x + 75, y: monument.pos.y })
  movePlayer(host, guestPlayerId, { x: monument.pos.x - 75, y: monument.pos.y })
  const portal = hostPage.getByRole('button', { name: 'Enter Monument Crypt' })
  await portal.waitFor({ timeout: 15_000 })
  await portal.click()
  await hostPage.locator('.mod-scene-overlay[data-room-index="0"]').waitFor({ timeout: 15_000 })
  await guestPage.locator('.mod-scene-overlay[data-room-index="0"]').waitFor({ timeout: 15_000 })
  await hostPage.getByRole('button', { name: 'Next room' }).click()
  await Promise.all(pages.map(page => page.locator('.mod-scene-overlay[data-room-index="1"]')
    .waitFor({ timeout: 15_000 })))
  await Promise.all(pages.map(page => page.getByRole('img', { name: 'Keeper Vault map' })
    .waitFor({ state: 'visible', timeout: 15_000 })))
  await Promise.all(pages.map(page => page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))))
  screenshots.cryptHost = join(screenshotRoot, 'monument-crypt-host.png')
  screenshots.cryptGuest = join(screenshotRoot, 'monument-crypt-guest.png')
  await Promise.all([
    hostPage.screenshot({ path: screenshots.cryptHost }),
    guestPage.screenshot({ path: screenshots.cryptGuest }),
  ])
  await hostPage.getByRole('button', { name: 'Return to the Boneyard' }).click()
  await Promise.all(pages.map(page => page.locator('.mod-scene-overlay')
    .waitFor({ state: 'detached', timeout: 15_000 })))

  mark('checking browser errors')
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(failedResponses, [])
  for (const path of [
    'audio/bookOpen.ogg',
    'audio/dungeon_ambient_1.ogg',
  ]) {
    const asset = content.assets.find(candidate => candidate.path === path)
    assert.ok(asset, `showcase audio asset is missing: ${path}`)
    assert.ok(contentRequests.some(request => request.sha === asset.sha256), `showcase audio was not requested: ${path}`)
  }
  process.stdout.write(`${JSON.stringify({
    assetRequests: contentRequests.length,
    enemyCount: await hostPage.locator('.mod-enemy').count(),
    packages: content.summary.mods.map(mod => mod.id),
    screenshots,
    status: 'ok',
  })}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    consoleErrors,
    error: error instanceof Error ? error.stack : String(error),
    failedResponses,
    hostLogs: hostLogs.slice(-100),
    pageErrors,
    pages: await Promise.all(pages.map(page => page.evaluate(() => ({
      grace: document.querySelector('.main-menu-page')?.getAttribute('data-gameplay-resume-grace'),
      roomIndexes: [...document.querySelectorAll('.mod-scene-overlay')].map(node => (
        node.getAttribute('data-room-index')
      )),
      text: document.body.innerText.slice(0, 400),
    })))),
    stage,
    state: {
      hostPlayerId: host.hostPlayerId(),
      levelUpBarrier: host.state().levelUpBarrier,
      phase: host.state().run.phase,
      progression: host.hostPlayerId()
        ? getPlayerProgression(host.state(), host.hostPlayerId())
        : null,
      positions: Object.fromEntries(host.state().playerEntities.identities.map(({ playerId }) => [
        playerId,
        getPlayerCharacter(host.state(), playerId).position,
      ])),
      runId: host.state().run.runId,
      tick: host.state().tick,
      transition: host.state().world.kind === 'hub'
        ? host.state().world.participants[host.hostPlayerId() ?? '']?.transition
        : null,
      world: host.state().world.kind,
    },
  }, null, 2)}\n`)
  throw error
} finally {
  await Promise.all(contexts.map(context => context.close()))
  await browser.close()
  await host.close()
  await server.close()
}

async function showcaseContent() {
  const checked = await Promise.all([
    'apprentice-apothecary',
    'gravity-lesson',
    'monument-crypt',
  ].map(async (directory) => {
    const value = await checkWebLuaPackage(join(examplesRoot, directory), require.resolve('wasmoon/dist/glue.wasm'))
    admitPreparedPackage(value)
    return value
  }))
  const mods = checked.map((value) => {
    const files = [...value.files].map(([path, bytes]) => ({
      byteLength: bytes.length,
      bytesBase64: Buffer.from(bytes).toString('base64'),
      ...typedFile(path),
      path,
      sha256: digest(bytes),
    }))
    const contentSha256 = createHash('sha256')
      .update(value.entryScript)
      .update(files.map(file => `${file.path}:${file.sha256}`).join('\0'))
      .digest('hex')
    return {
      boneyards: [],
      contentSha256,
      entryScript: value.entryScript,
      files,
      id: value.manifest.id,
      name: value.manifest.name,
      priority: 0,
      slug: value.manifest.id,
      version: value.manifest.version,
    }
  })
  const manifestSha256 = createHash('sha256')
    .update(mods.map(mod => `${mod.id}:${mod.contentSha256}`).join('\0'))
    .digest('hex')
  return compileWebSessionContentDefinitions(materializeWebSessionContent({
    manifestSha256,
    mods,
  }), require.resolve('wasmoon/dist/glue.wasm'))
}

async function enterHub(page, baseUrl, name, element) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorial.isVisible()) await tutorial.getByRole('button', { exact: true, name: 'NO' }).click()
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('textbox', { name: 'Wizard name' }).fill(name)
  await page.getByRole('button', { name: element }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.getByLabel(/College courtyard/).waitFor({ timeout: 60_000 })
}

async function waitForPlayerCount(page, count) {
  await page.waitForFunction(expected => (
    document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.playerCount === expected
  ), count, { timeout: 30_000 })
}

async function waitForBoneyard(page, count) {
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.waitForFunction(expected => (
    document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.playerCount === expected
  ), count, { timeout: 30_000 })
}

function movePlayer(host, playerId, position) {
  const state = host.state()
  const player = getPlayerCharacter(state, playerId)
  Object.assign(state, {
    playerEntities: replacePlayerCharacter(state.playerEntities, playerId, {
      ...player,
      position: { ...position },
      velocity: { x: 0, y: 0 },
    }),
  })
}

function giveGold(host, playerId, gold) {
  const state = host.state()
  const economy = getPlayerEconomy(state, playerId)
  Object.assign(state, {
    playerEntities: replacePlayerEconomy(state.playerEntities, playerId, {
      ...economy,
      gold,
      revision: economy.revision + 1,
    }),
  })
}

function moveStarterRobeToBackpack(host, playerId) {
  const state = host.state()
  const economy = getPlayerEconomy(state, playerId)
  const robe = economy.equipment.robe
  assert.ok(robe)
  Object.assign(state, {
    playerEntities: replacePlayerEconomy(state.playerEntities, playerId, {
      ...economy,
      backpack: [...economy.backpack, robe],
      equipment: { ...economy.equipment, robe: null },
      revision: economy.revision + 1,
    }),
  })
}

async function waitUntil(predicate, message, timeoutMs = 15_000) {
  const deadline = performance.now() + timeoutMs
  while (performance.now() < deadline) {
    if (await predicate()) return
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error(message)
}

function typedFile(path) {
  if (path.endsWith('.png')) return { contentType: 'image/png', kind: 'image' }
  if (path.endsWith('.ogg')) return { contentType: 'audio/ogg', kind: 'audio' }
  if (path.endsWith('.wav')) return { contentType: 'audio/wav', kind: 'audio' }
  if (path.endsWith('.mp3')) return { contentType: 'audio/mpeg', kind: 'audio' }
  if (path.endsWith('.boneyard')) {
    return { contentType: 'application/vnd.solomon-dark.boneyard', kind: 'boneyard' }
  }
  if (path.startsWith('scenes/') && path.endsWith('.json')) {
    return { contentType: 'application/json', kind: 'scene' }
  }
  if (path.startsWith('art/') && path.endsWith('.json')) {
    return { contentType: 'application/json', kind: 'art-metadata' }
  }
  if (path.endsWith('.bundle')) {
    return { contentType: 'application/vnd.solomon-dark.sprite-bundle', kind: 'sprite-bundle' }
  }
  throw new Error(`unsupported showcase file: ${path}`)
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

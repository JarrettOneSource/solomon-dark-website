import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { createEquipmentInventoryItem, DOWSING_EQUIPMENT_RECIPES } from '../src/game/core-kernels/hub-economy.ts'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import { getPlayerCharacter, getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { grantPlayerEntitySkillRanks, replacePlayerEconomy, selectPlayerEntityPrimarySkill } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { boneyardGeometrySha256 } from '../src/game/host/project-boneyard.ts'
import { decodeServerGameMessage } from '../src/game/protocol/game-protocol.ts'

const evidence = process.env.SDR_EQUIPPED_EFFECT_EVIDENCE
assert.ok(evidence, 'set SDR_EQUIPPED_EFFECT_EVIDENCE to a task-owned directory')
await mkdir(evidence, { recursive: true })
const server = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const credential = randomBytes(32).toString('base64url')
const scene = {
  bounds: { x: 0, y: 0, w: 2400, h: 2000 }, environmentMode: 2,
  fences: [], name: 'Equipped element acceptance', objects: [], roads: [], solomonDig: null,
  spawn: { x: 1200, y: 1000, facingDeg: 180 }, sprites: [], terrain: [],
}
const choice = { id: 'mod:equipped-effect:arena', name: scene.name, source: 'mod', modId: 'equipped-effect', modName: 'Equipped effect' }
const geometrySha256 = boneyardGeometrySha256(scene)
const host = await startGameHost({
  allowedOrigins: [server.origin], authentication: { kind: 'shared', credential },
  boneyards: { choices: [choice], modEntries: new Map([[choice.id, { choice, scene, geometrySha256, sourceSha256: geometrySha256 }]]) },
  luaWasmPath: fileURLToPath(new URL('../node_modules/wasmoon/dist/glue.wasm', import.meta.url)),
  resetWhenEmpty: true, snapshotRate: 30,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const errors = { page: [], console: [], requests: [], responses: [], wire: [] }
const receipts = []
let blastSeen = false
let page
try {
  page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  await page.addInitScript(gameEndpoint => { window.solomonDarkRuntime = { gameEndpoint } }, {
    credential, kind: 'localhost', url: host.address.url,
  })
  await page.route('**/deployment.json*', route => route.fulfill({
    json: { revision: new URL(route.request().url()).searchParams.get('current') },
  }))
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('requestfailed', request => {
    if (request.failure()?.errorText === 'net::ERR_ABORTED' && /\.(mp3|ogg)(\?|$)/.test(request.url())) return
    errors.requests.push(request.url())
  })
  page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
  page.on('websocket', socket => {
    socket.on('socketerror', error => errors.wire.push(String(error)))
    socket.on('framereceived', ({ payload }) => {
      try {
        const message = decodeServerGameMessage(String(payload))
        if (message.type === 'server-error') errors.wire.push(message.message)
      } catch (error) { errors.wire.push(error.message) }
    })
  })
  await page.goto(`${server.origin}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  const tutorial = page.locator('[data-prompt-kind="tutorial"] .stock-prompt-dialog')
  if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'New game', exact: true }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /Ether/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor()
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 60_000 })
  learnPrograms()
  await exerciseScene('hub')
  await page.getByRole('button', { name: 'Enter the Boneyard', exact: true }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
  await exerciseScene('boneyard')

  equip(13, 8)
  const grant = grantPlayerEntitySkillRanks(host.state().playerEntities, host.hostPlayerId(), 14, 1, createNativeRng(14))
  host.state().playerEntities = grant.store
  await waitUntil(() => getPlayerCharacter(host.state(), host.hostPlayerId()).primaryCast.etherBlastCharge >= 1,
    'Ether Blast did not charge')
  await page.waitForFunction(() => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame?.orbSpriteCount > 0 && frame.playerRobeFixedPose === 14
      && frame.playerElementEffectPrimaryId === 8
  })
  const before = await readFrame('boneyard')
  assert.ok(before.orbs > 0 && before.scale >= Math.fround(0.6))
  await page.screenshot({ path: `${evidence}/boneyard-ether-blast-charged.png` })
  const canvas = page.locator('.boneyard-world-canvas')
  await canvas.evaluate(node => {
    window.__equippedBlastSamples = []
    window.__equippedBlastTimer = setInterval(() => {
      const frame = node.__sdrBoneyardFrame
      window.__equippedBlastSamples.push({ kinds: frame.primarySpellKinds, orbs: frame.orbSpriteCount, pose: frame.playerAttachmentPose })
    }, 10)
  })
  const bounds = await canvas.boundingBox()
  await page.mouse.move(bounds.x + bounds.width / 2 + 180, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(650)
  await page.mouse.up()
  const samples = await page.evaluate(() => {
    clearInterval(window.__equippedBlastTimer)
    return window.__equippedBlastSamples
  })
  blastSeen = samples.some(sample => sample.kinds.includes('ether-blast'))
  assert.ok(blastSeen, 'real primary input must release Ether Blast')
  assert.ok(samples.every(sample => sample.orbs > 0), 'tip effect must survive charge, cast, and recovery')
  await page.screenshot({ path: `${evidence}/boneyard-ether-blast-wand.png` })
  assert.deepEqual(errors, { page: [], console: [], requests: [], responses: [], wire: [] })
  console.log(JSON.stringify({ status: 'ok', receipts, blastSeen, castSamples: samples.length, errors }))
} catch (error) {
  if (page) await page.screenshot({ path: `${evidence}/failure.png` })
  console.error(JSON.stringify({ errors, receipts, blastSeen }))
  throw error
} finally {
  await browser.close()
  await host.close()
  await server.close()
}

function learnPrograms() {
  const state = host.state()
  for (const id of [8, 16, 24, 32, 40]) {
    const grant = grantPlayerEntitySkillRanks(state.playerEntities, host.hostPlayerId(), id, 1, createNativeRng(id))
    state.playerEntities = grant.store
  }
}

function equip(recipeIndex, primary) {
  const state = host.state()
  const id = host.hostPlayerId()
  const economy = getPlayerEconomy(state, id)
  state.playerEntities = replacePlayerEconomy(state.playerEntities, id, {
    ...economy, equipment: { ...economy.equipment,
      weapon: recipeIndex === null ? null : createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[recipeIndex], 1000 + recipeIndex),
    },
  })
  state.playerEntities = selectPlayerEntityPrimarySkill(state.playerEntities, id, primary)
}

async function exerciseScene(region) {
  for (const recipeIndex of [13, 18]) {
    for (const primary of [8, 16, 24, 32, 40]) {
      equip(recipeIndex, primary)
      await page.waitForFunction(({ region, primary, wand }) => {
        const canvas = document.querySelector(`.${region}-world-canvas`)
        const frame = region === 'hub' ? canvas?.__sdrHubFrame : canvas?.__sdrBoneyardFrame
        return frame?.playerElementEffectPrimaryId === primary && frame.orbSpriteCount > 0
          && frame.playerRobeFixedPose === (wand ? 14 : 0)
      }, { region, primary, wand: recipeIndex === 13 })
      receipts.push({ region, recipeIndex, ...await readFrame(region) })
      if (primary === 8) await page.screenshot({ path: `${evidence}/${region}-${recipeIndex === 13 ? 'wand' : 'staff'}-ether.png` })
    }
  }
  equip(null, 8)
  await page.waitForFunction(region => {
    const canvas = document.querySelector(`.${region}-world-canvas`)
    const frame = region === 'hub' ? canvas?.__sdrHubFrame : canvas?.__sdrBoneyardFrame
    return frame?.orbSpriteCount === 0
  }, region)
  receipts.push({ region, recipeIndex: null, ...await readFrame(region) })
  equip(13, 8)
}

function readFrame(region) {
  return page.locator(`.${region}-world-canvas`).evaluate((canvas, region) => {
    const frame = region === 'hub' ? canvas.__sdrHubFrame : canvas.__sdrBoneyardFrame
    return { primary: frame.playerElementEffectPrimaryId, orbs: frame.orbSpriteCount,
      scale: frame.playerElementEffectScale, pose: frame.playerAttachmentPose }
  }, region)
}

async function waitUntil(predicate, message) {
  const deadline = Date.now() + 20_000
  while (!predicate()) {
    assert.ok(Date.now() < deadline, message)
    await page.waitForTimeout(30)
  }
}

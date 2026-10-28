import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const luaWasmPath = fileURLToPath(new URL('../node_modules/wasmoon/dist/glue.wasm', import.meta.url))
const screenshotRoot = process.env.SDR_SKELETON_UPPER_BODY_SCREENSHOT_ROOT
  || join(tmpdir(), 'solomon-dark-skeleton-upper-body')
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')
const credential = randomBytes(32).toString('base64url')
const vite = await createViteServer({
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
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  createBoneyardSeedBytes: () => Buffer.alloc(16),
  luaWasmPath,
  resetWhenEmpty: true,
  snapshotRate: 20,
})
const browser = await chromium.launch({ executablePath: chromePath, headless: true })
const context = await browser.newContext({
  deviceScaleFactor: 1,
  viewport: { height: 900, width: 1600 },
})
const page = await context.newPage()
const consoleErrors = []
const pageErrors = []
const failedResponses = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => pageErrors.push(error.message))
page.on('response', (response) => {
  if (response.status() >= 400) {
    failedResponses.push({ status: response.status(), url: response.url() })
  }
})
await page.addInitScript(({ credential: token, endpoint }) => {
  window.solomonDarkRuntime = {
    gameEndpoint: { credential: token, kind: 'localhost', url: endpoint },
  }
}, { credential, endpoint: host.address.url })
await page.route('**/deployment.json*', (route) => {
  const current = new URL(route.request().url()).searchParams.get('current')
  route.fulfill({
    body: JSON.stringify({ revision: current }),
    contentType: 'application/json',
    headers: { 'cache-control': 'no-store' },
    status: 200,
  })
})

try {
  try {
    await enterBoneyard(page, baseUrl)
  } catch (error) {
    const entryFailureScreenshot = `${screenshotRoot}-entry-failure.png`
    await page.screenshot({ path: entryFailureScreenshot })
    const entryFailure = await page.evaluate(() => ({
      bodyText: document.body.innerText.slice(0, 4_000),
      createScene: document.querySelector('.create-menu-scene')?.outerHTML.slice(0, 1_000) ?? null,
      url: location.href,
    }))
    throw new Error(JSON.stringify({
      consoleErrors,
      entryFailure,
      entryFailureScreenshot,
      failedResponses,
      pageErrors,
      sourceError: String(error),
    }, null, 2))
  }
  await page.waitForFunction(() => window.solomonDark?.lua)
  const spawn = await executeLua(page, `
    sd.events.on('enemy.spawned', function(event)
      sd.state.set('skeleton_upper_body_actor', event.actor_id)
    end)
    local player = sd.player.get_state()
    local request = sd.enemies.spawn('skeleton', {x = player.x + 180, y = player.y})
    return request.request_id, player.x, player.y
  `)
  assert.equal(spawn.ok, true, spawn.error)
  const walkingActorId = await waitForSpawnedActor(page)
  const canvas = page.locator('.boneyard-world-canvas')
  await canvas.waitFor({ timeout: 30_000 })
  const walkingSamples = []
  const walkingDeadline = Date.now() + 15_000
  while (Date.now() < walkingDeadline) {
    const frame = await canvas.evaluate((node) => structuredClone(node.__sdrBoneyardFrame))
    const enemy = frame.enemySamples.find((sample) => sample.id === walkingActorId)
    if (enemy?.lifeState === 'locomotion') {
      walkingSamples.push({
        bodyEntry: enemy.bodyEntry,
        bodyPose: enemy.bodyPose,
        gaitPose: enemy.gaitPose,
        limbsEntry: enemy.limbsEntry,
        tick: frame.tick,
        x: enemy.x,
        y: enemy.y,
      })
    }
    if (enemy?.action?.startsWith('skeleton-')) break
    await page.waitForTimeout(16)
  }
  const walkingPositions = new Set(walkingSamples.map(({ x, y }) => `${x}:${y}`))
  const walkingGaitPoses = new Set(walkingSamples.map(({ gaitPose }) => Math.floor(gaitPose)))
  const walkingLimbEntries = new Set(walkingSamples.map(({ limbsEntry }) => limbsEntry))
  const walkingBodyEntries = new Set(walkingSamples.map(({ bodyEntry }) => bodyEntry))
  assert.ok(walkingPositions.size > 10, JSON.stringify(walkingSamples))
  assert.ok(walkingGaitPoses.size > 1, JSON.stringify(walkingSamples))
  assert.ok(walkingLimbEntries.size > 1, JSON.stringify(walkingSamples))
  assert.ok(walkingBodyEntries.size > 1, JSON.stringify(walkingSamples))
  const attackSpawn = await executeLua(page, `
    sd.state.set('skeleton_upper_body_actor', 0)
    local player = sd.player.get_state()
    local request = sd.enemies.spawn('skeleton', {x = player.x + 30, y = player.y})
    return request.request_id
  `)
  assert.equal(attackSpawn.ok, true, attackSpawn.error)
  const attackActorId = await waitForSpawnedActor(page)
  const samples = []
  let early = null
  let earlyScreenshot = null
  let late = null
  let lateScreenshot = null
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline && (!early || !late)) {
    const frame = await canvas.evaluate((node) => structuredClone(node.__sdrBoneyardFrame))
    const enemy = frame.enemySamples.find((sample) => sample.id === attackActorId)
    if (enemy?.action?.startsWith('skeleton-')) {
      samples.push({
        action: enemy.action,
        actionProgress: enemy.actionProgress,
        bodyEntry: enemy.bodyEntry,
        bodyPose: enemy.bodyPose,
        gaitPose: enemy.gaitPose,
        tick: frame.tick,
      })
      if (!early && enemy.actionProgress < 1.5) {
        early = await captureActorCrop(canvas, attackActorId)
        earlyScreenshot = await page.screenshot({ path: `${screenshotRoot}-early.png` })
      }
      if (!late && enemy.actionProgress >= 6 && enemy.actionProgress <= 7.5) {
        late = await captureActorCrop(canvas, attackActorId)
        lateScreenshot = await page.screenshot({ path: `${screenshotRoot}-late.png` })
      }
    }
    await page.waitForTimeout(16)
  }
  assert.ok(early, `did not observe an early Skeleton attack sample: ${JSON.stringify(samples)}`)
  assert.ok(late, `did not observe a late Skeleton attack sample: ${JSON.stringify(samples)}`)
  assert.ok(earlyScreenshot)
  assert.ok(lateScreenshot)
  const difference = await compareScreenshotCrops(
    page,
    earlyScreenshot,
    early.crop,
    lateScreenshot,
    late.crop,
  )
  const uniqueBodyPoses = [...new Set(samples.map(({ bodyPose }) => bodyPose))]
  const uniqueBodyEntries = [...new Set(samples.map(({ bodyEntry }) => bodyEntry))]
  const uniqueActionBuckets = [...new Set(samples.map(({ actionProgress }) => (
    Math.floor(actionProgress)
  )))]
  assert.ok(uniqueBodyPoses.length >= 2, JSON.stringify({ samples, uniqueBodyPoses }))
  assert.ok(uniqueBodyEntries.length >= 2, JSON.stringify({ samples, uniqueBodyEntries }))
  assert.ok(uniqueActionBuckets.length >= 2, JSON.stringify({ samples, uniqueActionBuckets }))
  assert.equal(new Set(samples.map(({ gaitPose }) => gaitPose)).size, 1)
  const pixelReceipt = {
    difference,
    early: {
      actionProgress: early.actionProgress,
      bodyEntry: early.bodyEntry,
      bodyPose: early.bodyPose,
      crop: early.crop,
    },
    late: {
      actionProgress: late.actionProgress,
      bodyEntry: late.bodyEntry,
      bodyPose: late.bodyPose,
      crop: late.crop,
    },
  }
  assert.ok(difference.changedPixels > 100, JSON.stringify(pixelReceipt))
  assert.ok(difference.channelDelta > 1_000, JSON.stringify(pixelReceipt))
  assert.deepEqual(failedResponses, [], JSON.stringify({ consoleErrors, failedResponses }))
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  process.stdout.write(`${JSON.stringify({
    attackActorId,
    browserVersion: browser.version(),
    consoleErrors,
    difference,
    early: {
      actionProgress: early.actionProgress,
      bodyEntry: early.bodyEntry,
      bodyPose: early.bodyPose,
      crop: early.crop,
    },
    failedResponses,
    late: {
      actionProgress: late.actionProgress,
      bodyEntry: late.bodyEntry,
      bodyPose: late.bodyPose,
      crop: late.crop,
    },
    pageErrors,
    renderer: early.renderer,
    screenshotPaths: [`${screenshotRoot}-early.png`, `${screenshotRoot}-late.png`],
    status: 'ok',
    uniqueActionBuckets,
    uniqueBodyEntries,
    uniqueBodyPoses,
    walking: {
      actorId: walkingActorId,
      bodyEntries: [...walkingBodyEntries],
      gaitPoses: [...walkingGaitPoses],
      limbEntries: [...walkingLimbEntries],
      positionCount: walkingPositions.size,
      samples: walkingSamples.length,
    },
  }, null, 2)}\n`)
} finally {
  await page.close().catch(() => {})
  await context.close().catch(() => {})
  await browser.close().catch(() => {})
  await host.close().catch(() => {})
  await vite.close().catch(() => {})
}

async function enterBoneyard(target, url) {
  await target.goto(`${url}/game`, { waitUntil: 'domcontentloaded' })
  await target.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await target.getByRole('button', { name: 'Settings' }).click()
  const settings = target.getByRole('dialog', { name: 'Settings' })
  await settings.waitFor()
  const cheats = settings.getByRole('button', { name: /Enable Cheats/i })
  if (await cheats.getAttribute('aria-pressed') !== 'true') await cheats.click()
  assert.equal(await target.evaluate((key) => (
    JSON.parse(localStorage.getItem(key)).enableCheats
  ), GAME_SETTINGS_STORAGE_KEY), true)
  await settings.getByRole('button', { name: 'Done' }).click()
  await target.getByRole('button', { name: 'Play' }).click()
  await target.getByRole('button', { name: 'New Game' }).click()
  await target.getByRole('button', { name: 'Continue Local' }).click()
  await target.locator('.create-menu-scene[data-motion-settled="true"]')
    .waitFor({ timeout: 30_000 })
  await target.getByRole('button', { name: /fire/i }).click()
  await target.locator('.create-menu-disciplines[data-visible="true"]')
    .waitFor({ timeout: 15_000 })
  await target.locator('.create-menu-discipline-arcane').click()
  await target.locator('.hub-scene[data-renderer-state="ready"]')
    .waitFor({ timeout: 30_000 })
  await target.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await target.locator('.boneyard-scene[data-renderer-state="ready"]')
    .waitFor({ timeout: 30_000 })
}

async function executeLua(target, code) {
  return target.evaluate((source) => window.solomonDark.lua.execute(source), code)
}

async function waitForSpawnedActor(target) {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    const result = await executeLua(target, `
      return sd.state.get('skeleton_upper_body_actor')
    `)
    assert.equal(result.ok, true, result.error)
    if (Number.isSafeInteger(result.values[0]) && result.values[0] > 0) {
      return result.values[0]
    }
    await target.waitForTimeout(25)
  }
  throw new Error('timed out waiting for the spawned Skeleton actor')
}

async function captureActorCrop(canvas, actorId) {
  return canvas.evaluate((node, id) => {
    const frame = node.__sdrBoneyardFrame
    const enemy = frame.enemySamples.find((sample) => sample.id === id)
    if (!enemy) throw new Error(`missing Skeleton ${id} in renderer diagnostics`)
    const screenX = frame.playerScreenX
      + (enemy.x - frame.playerX) * frame.cameraZoom
    const screenY = frame.playerScreenY
      + (enemy.y - frame.playerY) * frame.cameraZoom
    const rect = node.getBoundingClientRect()
    const logicalWidth = 64
    const logicalHeight = 72
    return {
      actionProgress: enemy.actionProgress,
      bodyEntry: enemy.bodyEntry,
      bodyPose: enemy.bodyPose,
      crop: {
        canvasClientHeight: node.clientHeight,
        canvasClientWidth: node.clientWidth,
        canvasHeight: node.height,
        canvasWidth: node.width,
        height: logicalHeight,
        pageX: rect.left + screenX - logicalWidth / 2,
        pageY: rect.top + screenY - logicalHeight,
        screenX,
        screenY,
        width: logicalWidth,
      },
      renderer: node.dataset.gameRenderer,
    }
  }, actorId)
}

async function compareScreenshotCrops(
  target,
  firstScreenshot,
  firstCrop,
  secondScreenshot,
  secondCrop,
) {
  return target.evaluate(async ({ first, firstRect, second, secondRect }) => {
    const load = (source) => new Promise((resolve, reject) => {
      const image = new Image()
      image.addEventListener('load', () => resolve(image), { once: true })
      image.addEventListener('error', reject, { once: true })
      image.src = `data:image/png;base64,${source}`
    })
    const [firstImage, secondImage] = await Promise.all([load(first), load(second)])
    const pixels = (image, rect) => {
      const canvas = document.createElement('canvas')
      canvas.width = rect.width
      canvas.height = rect.height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(
        image,
        rect.pageX,
        rect.pageY,
        rect.width,
        rect.height,
        0,
        0,
        rect.width,
        rect.height,
      )
      return context.getImageData(0, 0, rect.width, rect.height).data
    }
    const firstPixels = pixels(firstImage, firstRect)
    const secondPixels = pixels(secondImage, secondRect)
    let changedPixels = 0
    let channelDelta = 0
    for (let offset = 0; offset < secondPixels.length; offset += 4) {
      const delta = Math.abs(firstPixels[offset] - secondPixels[offset])
        + Math.abs(firstPixels[offset + 1] - secondPixels[offset + 1])
        + Math.abs(firstPixels[offset + 2] - secondPixels[offset + 2])
      if (delta > 3) changedPixels += 1
      channelDelta += delta
    }
    return { changedPixels, channelDelta }
  }, {
    first: firstScreenshot.toString('base64'),
    firstRect: firstCrop,
    second: secondScreenshot.toString('base64'),
    secondRect: secondCrop,
  })
}

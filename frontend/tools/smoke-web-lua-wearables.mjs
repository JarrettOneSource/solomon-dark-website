import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import { createRequire } from 'node:module'

import { chromium } from 'playwright-core'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { grantPlayerEntityInventoryItems } from '../src/game/core-server/player-entity-store.ts'
import { getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import {
  compileWebSessionContentDefinitions,
  materializeWebSessionContent,
} from '../src/game/host/web-mod-content.ts'
import { compileModAssets } from '../src/game/modding/assets/index.ts'
import {
  compileModContentCatalog,
  modItemInventoryItem,
} from '../src/game/modding/content/index.ts'

const require = createRequire(import.meta.url)
const webRoot = fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url))
const screenshotRoot = process.env.SDR_WEARABLE_SCREENSHOT_ROOT
  || join(tmpdir(), 'solomon-dark-web-lua-wearables')
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')

await mkdir(screenshotRoot, { recursive: true })
const content = await wearableContent()
const server = await startStaticClientServer({ root: webRoot })
const credential = 'web-lua-wearable-browser-smoke'
const hostLogs = []
const host = await startGameHost({
  allowedOrigins: [server.origin],
  authentication: { kind: 'shared', credential },
  content: content.manifest,
  log: entry => hostLogs.push(entry),
  luaWasmPath: require.resolve('wasmoon/dist/glue.wasm'),
  modAssets: content.assets,
  modContent: content,
  snapshotRate: 20,
})
const assets = compileModAssets({
  assets: content.assets,
  mods: content.compiledMods,
  sources: content.modSources,
})
const catalog = compileModContentCatalog(content.compiledMods, assets)
const definitions = new Map(catalog.all().filter(entry => entry.contentKind === 'item').map(entry => [
  entry.key,
  catalog.item(entry.contentId),
]))
assert.deepEqual([...definitions.keys()].sort(), ['starfall_hat', 'starfall_robe', 'starfall_staff'])

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
const fileBySha = new Map(content.modSources[0].files
  ? content.assets.map(asset => [asset.sha256, content.modSources[0].files[asset.path]])
  : [])

for (const page of pages) {
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() })
  })
  await page.route('**/deployment.json?*', route => route.fulfill({
    json: { revision: 'wearable-smoke' },
  }))
  await page.route('**/api/mods/active', route => route.fulfill({
    headers: { 'cache-control': 'no-store' },
    json: {
      manifestSha256: content.manifest.manifestSha256,
      mods: content.summary.mods.map(mod => ({
        ...mod,
        boneyardCount: 0,
        hasLua: true,
        priority: 0,
      })),
    },
  }))
  await page.route('**/api/game/content/*', route => {
    const sha = new URL(route.request().url()).pathname.split('/').at(-1)
    const bytes = fileBySha.get(sha)
    return bytes
      ? route.fulfill({ body: Buffer.from(bytes), contentType: 'image/png' })
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

try {
  await enterHub(hostPage, server.origin, 'WearableHost', 'Fire')
  await enterHub(guestPage, server.origin, 'WearableGuest', 'Air')
  await Promise.all(pages.map(page => waitForPlayerCount(page, 2)))
  const hostPlayerId = host.hostPlayerId()
  assert.ok(hostPlayerId)
  const items = ['starfall_hat', 'starfall_robe', 'starfall_staff'].map(key => (
    modItemInventoryItem(definitions.get(key).catalog)
  ))
  const granted = grantPlayerEntityInventoryItems(host.state().playerEntities, hostPlayerId, items)
  assert.equal(granted.accepted, true)
  Object.assign(host.state(), { playerEntities: granted.store })
  await waitUntil(() => getPlayerEconomy(host.state(), hostPlayerId).backpack.some(item => (
    item.modItemContent?.wearable !== undefined
  )), 'wearable items did not enter the host backpack')

  await hostPage.keyboard.press('KeyI')
  const inventory = hostPage.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor({ timeout: 15_000 })
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]')
    .waitFor({ timeout: 15_000 })
  for (const [name, slot] of [
    ['Starfall Hat', 'hat'],
    ['Starfall Robe', 'robe'],
    ['Starfall Staff', 'weapon'],
  ]) {
    const item = inventory.getByLabel('Backpack').getByRole('button', { name: new RegExp(name) })
    await item.waitFor({ timeout: 10_000 })
    await doubleActivate(hostPage, item)
    await waitUntil(() => getPlayerEconomy(host.state(), hostPlayerId).equipment[slot]
      ?.modItemContent?.wearable !== undefined, `${name} did not equip`)
  }
  await hostPage.keyboard.press('Escape')
  await inventory.waitFor({ state: 'detached', timeout: 10_000 })

  await guestPage.waitForTimeout(500)
  const guestWearablePixels = await syntheticWearablePixels(guestPage)
  assert.ok(guestWearablePixels.primary > 500, 'guest did not render the mod robe primary layer')
  assert.ok(guestWearablePixels.trim > 100, 'guest did not render the mod robe trim layer')

  await hostPage.keyboard.down('KeyD')
  const poses = []
  for (let sample = 0; sample < 30; sample += 1) {
    await hostPage.waitForTimeout(30)
    poses.push(await hostPage.locator('.hub-world-canvas').evaluate(node => (
      node.__sdrHubFrame.playerWalkPose
    )))
  }
  await hostPage.keyboard.up('KeyD')
  assert.ok(new Set(poses).size > 1, `wearable robe did not follow walk poses: ${poses.join(',')}`)

  const hostScreenshot = join(screenshotRoot, 'host-three-wearables.png')
  const guestScreenshot = join(screenshotRoot, 'guest-sees-host-wearables.png')
  await Promise.all([
    hostPage.screenshot({ path: hostScreenshot }),
    guestPage.screenshot({ path: guestScreenshot }),
  ])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(failedResponses, [])
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    contentIds: Object.fromEntries([...definitions].map(([key, definition]) => [
      key,
      definition.contentId,
    ])),
    equipped: Object.fromEntries(Object.entries(
      getPlayerEconomy(host.state(), hostPlayerId).equipment,
    ).flatMap(([slot, item]) => item && !Array.isArray(item)
      ? [[slot, item.modItemContent?.key ?? item.name]]
      : [])),
    guestWearablePixels,
    hostScreenshot,
    guestScreenshot,
    poseCount: new Set(poses).size,
  })}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    consoleErrors,
    failedResponses,
    hostLogs: hostLogs.slice(-100),
    pageErrors,
    state: host.state(),
  }, null, 2)}\n`)
  throw error
} finally {
  await Promise.all(contexts.map(context => context.close()))
  await browser.close()
  await host.close()
  await server.close()
}

async function wearableContent() {
  const identity = {
    id: 'example.starfall-wearables',
    name: 'Starfall Wearables',
    version: '1.0.0',
  }
  const files = new Map([
    ['art/hat-icon.png', iconPng([255, 255, 255, 255], 'hat')],
    ['art/hat-icon-trim.png', iconPng([255, 255, 255, 255], 'hat-trim')],
    ['art/hat.png', actorPng(1, 'hat', false)],
    ['art/hat-trim.png', actorPng(1, 'hat', true)],
    ['art/robe-icon.png', iconPng([255, 255, 255, 255], 'robe')],
    ['art/robe-icon-trim.png', iconPng([255, 255, 255, 255], 'robe-trim')],
    ['art/robe.png', actorPng(5, 'robe', false)],
    ['art/robe-trim.png', actorPng(5, 'robe', true)],
    ['art/staff-icon.png', iconPng([255, 255, 255, 255], 'staff')],
    ['art/staff.png', actorPng(10, 'staff', false)],
  ])
  const entryScript = `
local hat_icon = sd.art.sprite("art/hat-icon.png")
local hat_icon_trim = sd.art.sprite("art/hat-icon-trim.png")
local hat = sd.art.wearable("art/hat.png")
local hat_trim = sd.art.wearable("art/hat-trim.png")
local robe_icon = sd.art.sprite("art/robe-icon.png")
local robe_icon_trim = sd.art.sprite("art/robe-icon-trim.png")
local robe = sd.art.wearable("art/robe.png")
local robe_trim = sd.art.wearable("art/robe-trim.png")
local staff_icon = sd.art.sprite("art/staff-icon.png")
local staff = sd.art.wearable("art/staff.png")

return sd.mod({
  api = "1.0.0",
  assets = {
    hat_icon = hat_icon, hat_icon_trim = hat_icon_trim, hat = hat, hat_trim = hat_trim,
    robe_icon = robe_icon, robe_icon_trim = robe_icon_trim, robe = robe, robe_trim = robe_trim,
    staff_icon = staff_icon, staff = staff,
  },
  content = {
    sd.kit.item({
      key = "starfall_hat", name = "Starfall Hat",
      equipment = {slot = "hat", dyeable = true, death_shape = 1,
        tints = {cloth = 0x66aaff, trim = 0xffdd55}},
      art = {icon = sd.art.ref("hat_icon"), icon_trim = sd.art.ref("hat_icon_trim"),
        worn = sd.art.ref("hat"), worn_trim = sd.art.ref("hat_trim")},
    }),
    sd.kit.item({
      key = "starfall_robe", name = "Starfall Robe",
      equipment = {slot = "robe", dyeable = true, death_shape = 2,
        tints = {cloth = 0x3344cc, trim = 0xffcc44}},
      art = {icon = sd.art.ref("robe_icon"), icon_trim = sd.art.ref("robe_icon_trim"),
        worn = sd.art.ref("robe"), worn_trim = sd.art.ref("robe_trim")},
    }),
    sd.kit.item({
      key = "starfall_staff", name = "Starfall Staff",
      equipment = {slot = "staff", death_shape = 5},
      art = {icon = sd.art.ref("staff_icon"), worn = sd.art.ref("staff")},
    }),
  },
})
`
  const payloadFiles = [...files].map(([path, bytes]) => ({
    byteLength: bytes.length,
    bytesBase64: bytes.toString('base64'),
    contentType: 'image/png',
    kind: 'image',
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }))
  const contentSha256 = createHash('sha256')
    .update(identity.id).update('\0').update(identity.version).update('\0').update(entryScript)
    .update('\0').update(payloadFiles.map(file => `${file.path}:${file.bytesBase64}`).join('\0'))
    .digest('hex')
  const manifestSha256 = createHash('sha256')
    .update(`${identity.id}\0${identity.version}\0${contentSha256}`)
    .digest('hex')
  const materialized = materializeWebSessionContent({
    manifestSha256,
    mods: [{
      boneyards: [],
      contentSha256,
      entryScript,
      files: payloadFiles,
      ...identity,
      priority: 0,
      slug: identity.id,
    }],
  })
  return compileWebSessionContentDefinitions(materialized, require.resolve('wasmoon/dist/glue.wasm'))
}

async function enterHub(page, baseUrl, name, element) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorial.isVisible()) await tutorial.getByRole('button', { exact: true, name: 'NO' }).click()
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]')
    .waitFor({ timeout: 30_000 })
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

async function doubleActivate(page, locator) {
  const box = await locator.boundingBox()
  assert.ok(box)
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)
}

async function syntheticWearablePixels(page) {
  const screenshot = await page.locator('.hub-world-canvas').screenshot()
  return page.evaluate(async source => {
    const image = new Image()
    image.src = source
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let primary = 0
    let trim = 0
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index]
      const green = pixels[index + 1]
      const blue = pixels[index + 2]
      if (Math.abs(red - 51) < 8 && Math.abs(green - 68) < 8 && Math.abs(blue - 204) < 8) primary += 1
      if (Math.abs(red - 255) < 8 && Math.abs(green - 204) < 8 && Math.abs(blue - 68) < 8) trim += 1
    }
    return { primary, trim }
  }, `data:image/png;base64,${screenshot.toString('base64')}`)
}

async function waitUntil(predicate, message, timeoutMs = 15_000) {
  const deadline = performance.now() + timeoutMs
  while (performance.now() < deadline) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(message)
}

function iconPng(color, shape) {
  return png(53, 50, (x, y) => {
    if (shape === 'staff') return x >= 24 && x <= 29 && y >= 5 && y <= 46 ? color : null
    if (shape === 'hat') return y >= 8 && y <= 26 && x >= 10 && x <= 43 ? color : null
    if (shape === 'hat-trim') return y >= 24 && y <= 30 && x >= 8 && x <= 45 ? color : null
    if (shape === 'robe') return y >= 8 && y <= 45 && x >= 12 && x <= 41 ? color : null
    return y >= 38 && y <= 46 && x >= 10 && x <= 43 ? color : null
  })
}

function actorPng(poses, slot, trim) {
  return png(24 * 170, poses * 170, (x, y) => {
    const localX = x % 170
    const localY = y % 170
    const pose = Math.floor(y / 170)
    if (slot === 'staff') {
      const shift = pose % 3 - 1
      return localX >= 82 + shift && localX <= 88 + shift && localY >= 25 && localY <= 145
        ? [255, 255, 255, 255]
        : null
    }
    if (slot === 'hat') {
      const visible = trim
        ? localX >= 54 && localX <= 116 && localY >= 52 && localY <= 60
        : localX >= 60 && localX <= 110 && localY >= 22 && localY <= 54
      return visible ? [255, 255, 255, 255] : null
    }
    const width = 48 + pose * 3
    const visible = trim
      ? localX >= 85 - width && localX <= 85 + width && localY >= 137 && localY <= 146
      : localX >= 85 - width && localX <= 85 + width && localY >= 65 && localY <= 140
    return visible ? [255, 255, 255, 255] : null
  })
}

function png(width, height, pixel) {
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    const row = y * stride + 1
    for (let x = 0; x < width; x += 1) {
      const color = pixel(x, y)
      if (!color) continue
      raw.set(color, row + x * 4)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function pngChunk(type, data) {
  const name = Buffer.from(type)
  const size = Buffer.alloc(4)
  size.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([size, name, data, crc])
}

function crc32(bytes) {
  let value = 0xffffffff
  for (const byte of bytes) {
    value ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      value = value >>> 1 ^ (value & 1 ? 0xedb88320 : 0)
    }
  }
  return (value ^ 0xffffffff) >>> 0
}

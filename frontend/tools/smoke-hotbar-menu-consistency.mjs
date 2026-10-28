import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { createGameSimulation, getPlayerBelt, getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { WEB_GAME_SAVE_SLOT } from '../src/game/save/game-save-contract.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { nativeHudModalSlideLayout } from '../src/game/native-hud-layout.ts'

// The server is real; only subsequent delivery is held after the edit has
// already reached the browser. A newly opened menu must read that current state
// without depending on a future network message or an unrelated hover event.
const output = process.env.SDR_HOTBAR_SCREENSHOT_ROOT
  || await mkdtemp(join(tmpdir(), 'solomon-hotbar-'))
await mkdir(output, { recursive: true })
// Thirty held captures span the multi-second seal drift measured without
// delivery; five delivered-state captures sample it again under a short hold.
const ambientBeforeSamples = 30
const ambientAfterSamples = 5
const playerId = 'hotbar-owner'
const initial = createGameSimulation({ [playerId]: {
  discipline: 'arcane', displayName: 'Hotbar', element: 'ether',
} })
const economy = getPlayerEconomy(initial, playerId)
const mana = economy.backpack.find(item => item.kind === 'mana-potion')
assert.ok(mana)
const ring = {
  id: 40_001, inventorySlot: 2, equipmentType: 'ring', generatedLevel: 0,
  iconRecords: [52], kind: 'equipment', name: 'Ring of Managrind',
  nativeEffects: [{ kind: 9, magnitude: 1, operator: 0, target: 0 }],
  nativeSelector: 0, nativeSubtype: null, nativeTypeId: 7002, quantity: 1,
  rarity: null, recipeIndex: null,
}
const sack = {
  ...mana, id: 40_002, inventorySlot: 3, kind: 'sack', name: 'Sack',
  nativeTypeId: 7008, nativeSubtype: 0, iconRecords: [70], quantity: 1,
  contents: [{ ...mana, id: 40_003, inventorySlot: 0, quantity: 2 }],
}
const document = createGameSaveDocument({
  integrity: 'local-only', loadedBoneyard: null, mods: [], modState: {}, playerId,
  state: {
    ...initial,
    world: {
      ...initial.world,
      participants: Object.fromEntries(Object.entries(initial.world.participants).map(([id, participant]) => (
        [id, { ...participant, collegeIntro: null, region: 'courtyard', transition: null }]
      ))),
    },
    playerEntities: replacePlayerEconomy(initial.playerEntities, playerId, {
      ...economy, collegeIntroPending: false, tutorialPending: false,
      backpack: [...economy.backpack, ring, sack], nextItemId: 50_000,
    }),
  },
})
const server = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const credential = randomBytes(32).toString('base64url')
const host = await startGameHost({
  allowedOrigins: [server.origin], authentication: { kind: 'shared', credential }, snapshotRate: 20,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const touch = process.env.SDR_HOTBAR_TOUCH === '1'
const page = await browser.newPage({
  viewport: touch ? { width: 844, height: 390 } : { width: 1600, height: 900 },
  hasTouch: touch,
})
const cdp = touch ? await page.context().newCDPSession(page) : null
page.setDefaultTimeout(15_000)
const errors = { console: [], page: [], responses: [], requests: [] }
const receipts = []
page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
page.on('pageerror', error => errors.page.push(error.message))
page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
page.on('requestfailed', request => {
  const failure = request.failure()?.errorText ?? 'unknown'
  if (failure === 'net::ERR_ABORTED' && /\.(?:mp3|ogg)(?:\?|$)|\/deployment\.json/.test(request.url())) return
  errors.requests.push(`${failure} ${request.url()}`)
})
let holding = false
let pending = []
let socket
await page.routeWebSocket(host.address.url, ws => {
  socket = ws
  const upstream = ws.connectToServer()
  upstream.onMessage(message => {
    if (holding) pending.push(message)
    else ws.send(message)
  })
})
function release() {
  holding = false
  for (const message of pending) socket.send(message)
  pending = []
}
await page.addInitScript(({ credential: token, url }) => {
  window.solomonDarkRuntime = { gameEndpoint: { kind: 'localhost', credential: token, url } }
}, { credential, url: host.address.url })
try {
  const setupUrl = `${server.origin}/__hotbar_fixture__`
  await page.route(setupUrl, route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><link rel="icon" href="data:,"><title>Save setup</title>',
  }))
  await page.goto(setupUrl)
  await page.evaluate(record => new Promise((resolve, reject) => {
    const open = indexedDB.open('solomon-dark-game-saves', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('slots', { keyPath: 'slot' })
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const transaction = open.result.transaction('slots', 'readwrite')
      transaction.objectStore('slots').put(record)
      transaction.oncomplete = () => { open.result.close(); resolve() }
      transaction.onerror = () => reject(transaction.error)
    }
  }), { document, revision: 1, slot: WEB_GAME_SAVE_SLOT })
  await page.unroute(setupUrl)
  await page.goto(`${server.origin}/game`)
  await page.getByRole('button', { name: 'Play', exact: true }).click({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Last game', exact: true }).click()
  await page.locator('.hub-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 60_000 })
  await page.getByRole('button', { name: /Open inventory/ }).click()
  const inventory = page.getByRole('dialog', { name: 'Inventory', exact: true })
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  const slot = inventory.getByRole('button', { name: 'Activate belt slot 4; drag to remove', exact: true })
  const bounds = await slot.boundingBox()
  assert.ok(bounds)
  await drag({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    { x: bounds.x + bounds.width / 2, y: bounds.y - 90 })
  await slot.waitFor({ state: 'detached' })
  holding = true
  await inventory.getByRole('button', { name: 'Open skills', exact: true }).click()
  const skills = page.getByRole('dialog', { name: 'Skills', exact: true })
  await skills.locator('xpath=self::*[@data-transition-phase="settled"]').locator('.skill-book-canvas').waitFor()
  const before = await skills.locator('.skill-book-quickbar-actions button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))
  await page.screenshot({ path: join(output, 'before-extra-snapshot.png') })
  release()
  await skills.getByRole('button', { name: /^Belt 4, empty/ }).waitFor()
  const after = await skills.locator('.skill-book-quickbar-actions button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))
  await page.screenshot({ path: join(output, 'after-extra-snapshot.png') })
  receipts.push({ scene: 'hub', edge: 'inventory-to-skills', before, after })
  assert.deepEqual(before, after, 'switching menus restored an old belt until another server snapshot arrived')
  await exerciseCount(inventory, skills, 'hub')
  await exerciseSlots(inventory, skills, 'hub')
  await exerciseItems(inventory, skills, 'hub')
  await closeSkills(skills)
  await page.getByRole('button', { name: 'Enter the Boneyard', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Choose a Boneyard' })
  if (await picker.count()) await picker.getByRole('button').first().click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Open skills', exact: true }).click()
  await skillsReady(skills)
  await exerciseCount(inventory, skills, 'boneyard')
  await exerciseSlots(inventory, skills, 'boneyard')
  await exerciseItems(inventory, skills, 'boneyard')
  await closeSkills(skills)
  assert.deepEqual(errors, { console: [], page: [], responses: [], requests: [] })
  console.log(JSON.stringify({ status: 'ok', touch, receipts, errors, output }))
} catch (error) {
  console.log(JSON.stringify({ receipts, errors, body: (await page.locator('body').innerText()).slice(-2500), output }))
  await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {})
  throw error
} finally {
  release()
  await browser.close()
  await host.close()
  await server.close()
}

async function frames() {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}
async function skillsReady(skills) {
  await skills.locator('xpath=self::*[@data-transition-phase="settled"]').locator('.skill-book-canvas').waitFor()
  await frames()
}
async function inventoryReady(inventory) {
  await inventory.locator('xpath=self::*[@data-renderer-state="ready"]').waitFor()
  await frames()
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
}
async function center(locator) {
  const box = await locator.boundingBox()
  assert.ok(box)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
async function drag(from, to) {
  if (cdp) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] })
    for (let step = 1; step <= 8; step += 1) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
        x: from.x + (to.x - from.x) * step / 8,
        y: from.y + (to.y - from.y) * step / 8, id: 1,
      }] })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 8 })
    await page.mouse.up()
    await page.mouse.move(10, 100)
  }
}
async function labels(skills) {
  return skills.locator('.skill-book-quickbar-actions button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))
}
async function beltPixels(skills, name = null) {
  await frames()
  const buttons = skills.locator('.skill-book-quickbar-actions button')
  const first = await buttons.first().boundingBox()
  const last = await buttons.last().boundingBox()
  assert.ok(first && last)
  const x = Math.floor(first.x)
  const y = Math.floor(first.y)
  const clip = {
    x, y, width: Math.ceil(last.x + last.width) - x,
    height: Math.min(page.viewportSize().height, Math.ceil(first.y + first.height)) - y,
  }
  const masks = []
  for (let slot = 0; slot < 8; slot += 1) {
    const box = await buttons.nth(slot).boundingBox()
    assert.ok(box)
    const inset = 3 * box.width / 53
    masks.push({
      left: Math.ceil(box.x - x + inset), right: Math.floor(box.x + box.width - x - inset),
      top: Math.ceil(box.y - y + inset), bottom: Math.floor(box.y + box.height - y - inset),
    })
  }
  return {
    encoded: (await page.screenshot(name === null
      ? { clip }
      : { clip, path: join(output, `${name}.png`) })).toString('base64'),
    masks,
  }
}
async function assertPixels(before, after, name, beforeControls, afterControls) {
  assert.deepEqual(before.masks, after.masks, 'settled belt slot rectangles are stable')
  for (const control of [...beforeControls, ...afterControls]) {
    assert.deepEqual(before.masks, control.masks, 'settled belt control rectangles are stable')
  }
  const difference = await page.evaluate(async ({ images, masks, beforeControlCount }) => {
    const pixels = []
    let width = 0
    for (const encoded of images) {
      const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0))
      const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      width = image.width
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      pixels.push(context.getImageData(0, 0, image.width, image.height).data)
      image.close()
    }
    if (pixels.some(values => values.length !== pixels[0].length)) {
      throw new Error('Belt crop dimensions changed')
    }
    let unexplainedChannels = 0
    let ambientChannels = 0
    let maximumDifference = 0
    let foregroundPixels = 0
    const afterControlStart = 2 + beforeControlCount
    for (let i = 0; i < pixels[0].length; i += 4) {
      const x = (i / 4) % width
      const y = Math.floor((i / 4) / width)
      // Gaps between slots and the book buttons are not belt content. Their
      // animated seal background is especially bright after compact scaling.
      if (!masks.some(mask => x >= mask.left && x < mask.right && y >= mask.top && y < mask.bottom)) continue
      // The native seals animate underneath the translucent belt. Compare
      // legible foreground, not dim background motion. With the original
      // fixed reopened/delivered pair, the stale a13fe08c Belt 4 differed in
      // 2,869 RGB channels over eight levels under this mask.
      if (Math.max(...pixels[0].subarray(i, i + 3), ...pixels[1].subarray(i, i + 3)) < 80) continue
      foregroundPixels += 1
      for (let channel = 0; channel < 3; channel += 1) {
        const difference = Math.abs(pixels[0][i + channel] - pixels[1][i + channel])
        if (difference > 8) {
          let beforeMinimum = pixels[0][i + channel]
          let beforeMaximum = beforeMinimum
          for (let control = 2; control < afterControlStart; control += 1) {
            const sample = pixels[control][i + channel]
            beforeMinimum = Math.min(beforeMinimum, sample)
            beforeMaximum = Math.max(beforeMaximum, sample)
          }
          let afterMinimum = pixels[1][i + channel]
          let afterMaximum = afterMinimum
          for (let control = afterControlStart; control < pixels.length; control += 1) {
            const sample = pixels[control][i + channel]
            afterMinimum = Math.min(afterMinimum, sample)
            afterMaximum = Math.max(afterMaximum, sample)
          }
          // Only a gap between the two observed ranges is a belt-art change.
          const gap = Math.max(0, beforeMinimum - afterMaximum, afterMinimum - beforeMaximum)
          if (gap > 8) unexplainedChannels += 1
          else ambientChannels += 1
        }
        maximumDifference = Math.max(maximumDifference, difference)
      }
    }
    return { unexplainedChannels, ambientChannels, maximumDifference, foregroundPixels }
  }, {
    images: [before.encoded, after.encoded,
      ...beforeControls.map(control => control.encoded),
      ...afterControls.map(control => control.encoded)],
    masks: before.masks,
    beforeControlCount: beforeControls.length,
  })
  receipts.push({ name, ...difference })
  assert.ok(difference.foregroundPixels > 0, 'nonempty foreground pixel witness')
  assert.equal(difference.unexplainedChannels, 0, `${name}: changed belt pixels after reopening`)
}
async function closeSkills(skills) {
  await skills.getByRole('button', { name: 'Close skills', exact: true }).click()
  await skills.waitFor({ state: 'hidden' })
  await page.locator('.hub-scene[data-gameplay-input-blocked="false"], .boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
}
async function inventoryFromSkills(inventory, skills) {
  await skills.getByRole('button', { name: 'Open inventory', exact: true }).click()
  await inventoryReady(inventory)
}
async function ambientControls(skills, count) {
  // The seals move beneath translucent belt art even while snapshots are held.
  const controls = []
  for (let sample = 0; sample < count; sample += 1) {
    await page.waitForTimeout(50)
    controls.push(await beltPixels(skills))
  }
  return controls
}
async function assertDeliveredBelt(skills, reopened, name, imageName, expected) {
  const beforeControls = await ambientControls(skills, ambientBeforeSamples)
  release()
  await frames()
  assert.deepEqual(await labels(skills), expected, name)
  const delivered = await beltPixels(skills, imageName)
  holding = true
  const afterControls = await ambientControls(skills, ambientAfterSamples)
  assert.deepEqual(await labels(skills), expected, name)
  release()
  await assertPixels(reopened, delivered, name, beforeControls, afterControls)
}
async function reopenWithoutSnapshot(inventory, skills, name, expected) {
  holding = true
  await inventory.getByRole('button', { name: 'Open skills', exact: true }).click()
  await skillsReady(skills)
  assert.deepEqual(await labels(skills), expected, name)
  const reopened = await beltPixels(skills, `${name}-reopened`)
  await assertDeliveredBelt(skills, reopened, `${name}-delivery`,
    `${name}-after-delivery`, expected)
}
async function exerciseSlots(inventory, skills, scene) {
  for (let slot = 0; slot < 8; slot += 1) {
    const target = skills.locator('.skill-book-quickbar-actions button').nth(slot)
    const previous = await target.getAttribute('aria-label')
    const name = previous.includes('Magic Missile') ? 'Call Leviathan' : 'Magic Missile'
    await drag(await center(skills.getByRole('button', { name: new RegExp(`${name}, rank`) })), await center(target))
    await skills.getByRole('button', { name: new RegExp(`^Belt ${slot + 1}, ${name},`) }).waitFor()
    assert.equal(getPlayerBelt(host.state(), host.hostPlayerId())[slot].skillId, name === 'Magic Missile' ? 8 : 11)
    const expected = await labels(skills)
    await beltPixels(skills, `${scene}-slot-${slot}-before`)
    await inventoryFromSkills(inventory, skills)
    const populated = await inventory.locator('[data-native-belt-populated="true"]').evaluateAll(nodes => nodes.map(node => Number(node.dataset.nativeBeltSlot)).sort())
    const expectedPopulated = getPlayerBelt(host.state(), host.hostPlayerId()).flatMap((entry, index) => entry ? [index] : [])
    assert.deepEqual(populated, expectedPopulated)
    await reopenWithoutSnapshot(inventory, skills, `${scene}-slot-${slot}`, expected)
  }
  const expected = await labels(skills)
  await beltPixels(skills, `${scene}-closed-before`)
  await closeSkills(skills)
  holding = true
  await page.getByRole('button', { name: 'Open skills', exact: true }).click()
  await skillsReady(skills)
  assert.deepEqual(await labels(skills), expected)
  const reopened = await beltPixels(skills, `${scene}-closed-reopened`)
  await assertDeliveredBelt(skills, reopened, `${scene}-complete-close-reopen`,
    `${scene}-closed-after-delivery`, expected)

}
async function exerciseCount(inventory, skills, scene) {
  const state = host.state()
  const owner = host.hostPlayerId()
  const current = getPlayerEconomy(state, owner)
  const quantity = scene === 'hub' ? 7 : 11
  state.playerEntities = replacePlayerEconomy(state.playerEntities, owner, {
    ...current, revision: current.revision + 1,
    backpack: current.backpack.map(item => item.id === mana.id ? { ...item, quantity } : item),
  })
  // A private Boneyard emits no periodic snapshots while a book owns pause.
  // Resume after seeding this server fixture, then reopen Inventory to witness
  // real delivery. Do not manufacture client state or expect a paused tick.
  await closeSkills(skills)
  await page.getByRole('button', { name: /Open inventory/ }).click()
  await inventoryReady(inventory)
  // Visible inventory acknowledgement proves the client already has the edit.
  await inventory.getByRole('button', { name: `Mana Potion, quantity ${quantity}`, exact: true }).waitFor()
  holding = true
  await inventory.getByRole('button', { name: 'Open skills', exact: true }).click()
  await skillsReady(skills)
  const expected = await labels(skills)
  const before = await beltPixels(skills, `${scene}-count-before-delivery`)
  await assertDeliveredBelt(skills, before, `${scene}-current-recursive-potion-count`,
    `${scene}-count-after-delivery`, expected)
}
async function exerciseItems(inventory, skills, scene) {
  await inventoryFromSkills(inventory, skills)
  for (const [id, slot] of [[mana.id, 5], [ring.id, 6], [sack.id, 7]]) {
    const source = inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${id}"]`).first()
    const box = await inventory.boundingBox()
    assert.ok(box)
    const target = nativeHudModalSlideLayout(1600, 900, 1).belt[slot]
    await drag(await center(source), {
      x: box.x + (target.x + target.width / 2) * box.width / 1600,
      y: box.y + (target.y + target.height / 2) * box.height / 900,
    })
    // Let the real host process the pointer release, then observe its result in
    // Skills before testing re-creation without any future message.
    await inventory.getByRole('button', { name: 'Open skills', exact: true }).click()
    await skillsReady(skills)
    const itemName = id === mana.id ? 'Mana Potion' : id === ring.id ? ring.name : 'Sack'
    await skills.getByRole('button', { name: new RegExp(`^Belt ${slot + 1}, ${itemName},`) }).waitFor()
    const expected = await labels(skills)
    await beltPixels(skills, `${scene}-item-${id}-before`)
    await inventoryFromSkills(inventory, skills)
    await reopenWithoutSnapshot(inventory, skills, `${scene}-item-${id}`, expected)
    if (id !== sack.id) await inventoryFromSkills(inventory, skills)
  }
}

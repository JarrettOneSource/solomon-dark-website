import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { createGameSimulation, enterBoneyardWorld } from '../src/game/core-server/game-simulation.ts'
import { GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS } from '../src/game/core-kernels/game-run.ts'
import { NATIVE_HUB_NPC_CATALOG } from '../src/game/core-kernels/native-hub-npc.ts'
import { materializeStockTutorial } from '../src/game/host/boneyard-catalog.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { WEB_GAME_SAVE_SLOT } from '../src/game/save/game-save-contract.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const output = process.env.SDR_STORY_OFFICE_SCREENSHOT_ROOT
  || join(tmpdir(), 'solomon-story-office-dialogue')
await mkdir(output, { recursive: true })
const server = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
let host
let browser
const receipt = { consoleErrors: [], pageErrors: [], failedResponses: [], wireErrors: [], steps: [] }

try {
  const credential = 'isolated-story-office-smoke'
  host = await startGameHost({
    allowedOrigins: [server.origin],
    authentication: { kind: 'shared', credential },
    resetWhenEmpty: true,
    snapshotRate: 100,
  })
  browser = await chromium.launch({
    executablePath: process.env.SDR_CHROME_PATH
      || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('console', message => {
    if (message.type() === 'error') receipt.consoleErrors.push(message.text())
  })
  page.on('pageerror', error => receipt.pageErrors.push(error.message))
  page.on('response', response => {
    if (response.status() >= 400) receipt.failedResponses.push(`${response.status()} ${response.url()}`)
  })
  page.on('websocket', socket => socket.on('socketerror', error => receipt.wireErrors.push(String(error))))
  await page.addInitScript(installGameAudioSmokeProbe)
  await page.addInitScript(({ credential, url }) => {
    window.solomonDarkRuntime = { gameEndpoint: { credential, kind: 'localhost', url } }
  }, { credential, url: host.address.url })
  await page.route('**/deployment.json?*', route => route.fulfill({
    json: { revision: new URL(route.request().url()).searchParams.get('current') },
  }))
  await page.route('**/api/mods?**', route => route.fulfill({
    json: { items: [], page: 1, pageSize: 50, total: 0 },
  }))
  await page.route('**/api/game/parties', route => route.fulfill({ json: { items: [] } }))

  const canvas = page.locator('.hub-world-canvas')
  const dialog = page.locator('[data-native-chat-phase]')
  const speech = key => page.locator(`[data-native-chat-record="${key}"]`)
  const choices = () => page.locator('[data-native-chat-phase="choices"]')
  const ready = async () => {
    await page.locator('.main-menu-page[data-hub-player-activity="none"]').waitFor({ timeout: 30_000 })
    await page.waitForTimeout(150)
  }
  const reopen = async () => { await ready(); await page.keyboard.press('e') }
  const skip = async () => { await dialog.getByRole('button', { name: 'Skip', exact: true }).click() }
  const closed = async () => { await dialog.waitFor({ state: 'detached', timeout: 15_000 }) }
  const checkpoint = async label => {
    const frame = await canvas.count() ? await canvas.evaluate(node => node.__sdrHubFrame) : null
    receipt.steps.push({
      label,
      record: await dialog.count() ? await dialog.getAttribute('data-native-chat-record') : null,
      position: frame ? { x: frame.playerX, y: frame.playerY } : null,
    })
    await page.screenshot({ path: join(output, `${label}.png`) })
    process.stdout.write(`${JSON.stringify(receipt.steps.at(-1))}\n`)
  }
  const assertSpeech = async key => {
    await speech(key).waitFor({ timeout: 15_000 })
    const text = (await dialog.innerText()).replace(/\s+/g, ' ')
    for (const line of NATIVE_HUB_NPC_CATALOG.storyOffice.dialogue[key].lines) {
      assert.ok(text.includes(line.replace(/\s+/g, ' ')), `${key} omitted retail text`)
    }
  }
  const assertChoices = async expected => {
    await choices().waitFor({ timeout: 15_000 })
    assert.deepEqual(await dialog.locator('[data-native-chat-choice="question"]')
      .evaluateAll(nodes => nodes.map(node => node.dataset.nativeChatKey)), expected)
  }
  const answer = async (label, key) => {
    await dialog.getByRole('button', { name: label, exact: true }).click()
    await assertSpeech(key)
    await checkpoint(key.toLowerCase())
    await skip()
  }
  const move = async (key, axis, target, greater) => {
    await ready()
    await page.keyboard.down(key)
    try {
      await page.waitForFunction(({ axis, target, greater }) => {
        const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
        return frame && (greater ? frame[axis] >= target : frame[axis] <= target)
      }, { axis, target, greater }, { timeout: 15_000 })
    } finally {
      await page.keyboard.up(key)
      await page.waitForTimeout(150)
    }
  }

  try {
    await seedTutorialSave(page, server.origin)
    await page.goto(`${server.origin}/game`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 180_000 })
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: 'Last game' }).click()
    await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
    assert.equal(host.state().world.kind, 'boneyard')
    assert.ok(host.state().world.tutorial)
    // Established smoke-tutorial-responsive completion fixture. Only the finished
    // Tutorial boundary is prepared; live ticks own College walking and all NPCs.
    Object.assign(host.state().run, {
      gameOverEventId: 1, gameOverExitKind: 'automatic',
      gameOverExitTicks: GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
      gameOverTicks: 1200, nextGameOverEventId: 2, phase: 'game-over',
    })
    await page.locator('.hub-scene[data-story-office="true"][data-renderer-state="ready"]')
      .waitFor({ timeout: 90_000 })
    await speech('ARCH_INTRO_0').waitFor({ timeout: 90_000 })
    await assertSpeech('ARCH_INTRO_0')
    await checkpoint('01-guided-arch-intro')
    await skip()
    await assertChoices(['ARCH_Q1_0', 'ARCH_Q2_0', 'ARCH_Q3_0'])
    await answer('Solomon Dark?', 'ARCH_Q1_0')
    await assertChoices(['ARCH_Q2_0', 'ARCH_Q3_0'])
    await dialog.getByRole('button', { name: 'Done', exact: true }).click()
    await closed()
    await checkpoint('02-done-closes-without-farewell')
    await reopen()
    await assertChoices(['ARCH_Q2_0', 'ARCH_Q3_0'])
    await checkpoint('03-reopened-remaining-questions')
    await answer('Collateral Damage?', 'ARCH_Q2_0')
    await assertChoices(['ARCH_Q3_0'])
    await answer('Assistance?', 'ARCH_Q3_0')
    await closed()
    await reopen()
    await assertSpeech('ARCH_DISMISS_0')
    await checkpoint('04-exhausted-arch-greeting')
    await skip()
    await closed()

    await move('a', 'playerX', 340, false)
    await move('s', 'playerY', 800, true)
    await move('d', 'playerX', 556, true)
    await ready()
    await page.keyboard.down('w')
    try { await speech('POLISHER_INTRO_0').waitFor({ timeout: 15_000 }) }
    finally { await page.keyboard.up('w') }
    await assertSpeech('POLISHER_INTRO_0')
    const contact = await canvas.evaluate(node => node.__sdrHubFrame)
    assert.ok(Math.hypot(contact.playerX - 566, contact.playerY - 735) <= 40.101,
      'Polisher must open at actual native collision contact')
    await checkpoint('05-polisher-walk-contact')
    await skip()
    await assertChoices(['POLISHER_Q1_0', 'POLISHER_Q2_0'])
    await answer('Your task?', 'POLISHER_Q1_0')
    await assertChoices(['POLISHER_Q2_0'])
    await dialog.getByRole('button', { name: 'Done', exact: true }).click()
    await closed()
    await ready()
    await page.keyboard.down('w')
    await page.waitForTimeout(500)
    await page.keyboard.up('w')
    assert.equal(await dialog.count(), 0, 'engaged NPC must not reopen on stationary contact')
    await reopen()
    await assertChoices(['POLISHER_Q2_0'])
    await answer('The Plaque', 'POLISHER_Q2_0')
    await closed()
    await ready()
    // The onboarding HUD prompt is intentionally hidden. Click the visible
    // actor's native foot circle through the real world pointer projection.
    const pointer = await canvas.evaluate(node => {
      const frame = node.__sdrHubFrame
      const screen = Object.values(frame.playerScreenPositions)[0]
      const scale = Number(document.querySelector('.hub-scene').dataset.cameraZoom)
      const bounds = node.getBoundingClientRect()
      return {
        x: bounds.left + screen.x + (566 - frame.playerX) * scale,
        y: bounds.top + screen.y + (735 - frame.playerY) * scale,
      }
    })
    assert.ok(Number.isFinite(pointer.x) && Number.isFinite(pointer.y))
    receipt.polisherPointer = pointer
    await page.mouse.click(pointer.x, pointer.y)
    await assertSpeech('POLISHER_DISMISS_0')
    await checkpoint('06-exhausted-polisher-pointer-greeting')
    await skip()
    await closed()

    const audio = await page.evaluate(() => {
      const matches = (source, name) => source && window.__sdrAudioSourceMatches(source, name)
      return {
        archVoiceStarts: window.__sdrAudioEvents.filter(event => event.type === 'buffer-start'
          && matches(event.src, 'arch-intro-0.wav')).length,
        wipeEvents: window.__sdrAudioEvents.filter(event => event.src && /wipe/i.test(event.src)).length,
      }
    })
    assert.equal(audio.archVoiceStarts, 1, 'reopening must not replay the introductory voice')
    assert.ok(audio.wipeEvents > 0, 'Polisher wipe loop must remain active')
    receipt.audio = audio
    await move('s', 'playerY', 815, true)
    await move('a', 'playerX', 540, false)
    await ready()
    await page.keyboard.down('s')
    try {
      await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
    } finally { await page.keyboard.up('s') }
    await checkpoint('07-native-office-exit-create')
    for (const key of ['consoleErrors', 'pageErrors', 'failedResponses', 'wireErrors']) {
      assert.deepEqual(receipt[key], [], key)
    }
    receipt.status = 'ok'
  } catch (error) {
    receipt.status = 'failed'
    receipt.error = error.stack
    receipt.body = await page.locator('body').innerText()
    await checkpoint('failure')
    throw error
  }
} finally {
  await writeFile(join(output, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`)
  await browser?.close()
  await host?.close()
  await server.close()
}
process.stdout.write(`${JSON.stringify(receipt)}\n`)

async function seedTutorialSave(page, origin) {
  const loadedBoneyard = materializeStockTutorial(Buffer.alloc(16, 31))
  const state = enterBoneyardWorld(createGameSimulation({ owner: {
    discipline: 'arcane', displayName: 'Sirmin', element: 'ether',
  } }), loadedBoneyard)
  const document = createGameSaveDocument({
    integrity: 'global-clean', loadedBoneyard, mods: [], modState: {}, playerId: 'owner', state,
  })
  await page.goto(`${origin}/deployment.json`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(record => new Promise((resolve, reject) => {
    const request = indexedDB.open('solomon-dark-game-saves', 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('slots')) {
        request.result.createObjectStore('slots', { keyPath: 'slot' })
      }
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction('slots', 'readwrite')
      transaction.objectStore('slots').put(record)
      transaction.oncomplete = () => { database.close(); resolve() }
      transaction.onerror = () => { database.close(); reject(transaction.error) }
      transaction.onabort = () => { database.close(); reject(transaction.error) }
    }
  }), { document, revision: 1, slot: WEB_GAME_SAVE_SLOT })
}

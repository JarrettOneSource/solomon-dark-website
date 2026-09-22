// Controlled report-11 checks; the reporter supplied no replay or freeze duration.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { DEFAULT_GAME_SETTINGS, GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { NativeSecondaryScreenFeedbackPresentation } from '../src/game/renderer/native-screen-feedback.ts'
import { enterBoneyard, enterElementHub } from './game-smoke-navigation.mjs'

const output = process.env.SDR_WHITE_RECEIPT_DIR
assert.ok(output, 'SDR_WHITE_RECEIPT_DIR is required')
await mkdir(output, { recursive: true })
const server = await startStaticClientServer({ root: fileURLToPath(new URL('../../backend/wwwroot', import.meta.url)) })
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--autoplay-policy=no-user-gesture-required'],
})
const receipts = []
try {
  for (const complexLighting of [true, false]) {
    const credential = randomBytes(32).toString('base64url')
    const host = await startGameHost({
      allowedOrigins: [server.origin], authentication: { kind: 'shared', credential },
      luaWasmPath: fileURLToPath(new URL('../node_modules/wasmoon/dist/glue.wasm', import.meta.url)),
      resetWhenEmpty: true, snapshotRate: 20,
    })
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
    const page = await context.newPage()
    const errors = { page: [], console: [], responses: [], requests: [] }
    const cancelledRequests = []
    page.on('pageerror', error => errors.page.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
    page.on('requestfailed', request => errors.requests.push({
      url: request.url(), type: request.resourceType(), error: request.failure()?.errorText,
    }))
    page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
    await page.route('**/deployment.json*', route => route.fulfill({ json: {
      revision: new URL(route.request().url()).searchParams.get('current'),
    } }))
    await page.addInitScript(({ credential, url, key, settings }) => {
      window.solomonDarkRuntime = { gameEndpoint: { credential, kind: 'localhost', url } }
      localStorage.setItem(key, JSON.stringify(settings))
    }, { credential, url: host.address.url, key: GAME_SETTINGS_STORAGE_KEY,
      settings: { ...DEFAULT_GAME_SETTINGS, complexLighting } })
    let moduleFailure = null
    try {
      if (complexLighting) {
        let blocked = false
        await page.route(/\/assets\/ModPowerups-[^/]+\.js$/, route => {
          if (!blocked) { blocked = true; return route.abort('failed') }
          return route.continue()
        })
        await page.goto(`${server.origin}/game`, { waitUntil: 'domcontentloaded' })
        await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
        const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
        if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
        await page.getByRole('button', { name: 'Play', exact: true }).click()
        await page.getByRole('button', { name: 'New game', exact: true }).click()
        await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
        await page.getByRole('button', { name: /Ether/i }).click()
        await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor()
        await page.locator('.create-menu-discipline-arcane').click()
        await page.getByRole('heading', { name: 'Page files could not be loaded' }).waitFor({ timeout: 30_000 })
        assert.equal(blocked, true)
        moduleFailure = structuredClone(errors)
        await page.getByRole('button', { name: 'Reload page', exact: true }).click()
        await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
        for (const values of Object.values(errors)) values.length = 0
      }
      await enterElementHub(page, server.origin, 'Ether')
      await enterBoneyard(page)
      await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 30_000 })
      const canvas = page.locator('.boneyard-world-canvas')
      const sample = () => canvas.evaluate(node => {
        const frame = node.__sdrBoneyardFrame
        return { tick: frame.tick, frames: frame.frameCount, alpha: frame.secondaryScreenFlashAlpha,
          color: frame.secondaryScreenFlashColor, lost: node.getContext('webgl2').isContextLost() }
      })
      const baseline = await sample()
      await page.screenshot({ path: `${output}/world-${complexLighting}.png` })
      const state = host.state()
      const playerId = host.hostPlayerId()
      const event = {
        actorId: null, cameraDisplacement: null, cameraMagnitude: 0, cue: null,
        eventId: state.secondaryAbilities.nextEventId, gain: 1, kind: 'impact', ownerId: playerId,
        pitch: 1, position: { x: 0, y: 0 }, skillId: 76, tick: state.tick,
        worldKey: `boneyard:${state.world.runId}`,
        screenFlash: { alpha: 1, blue: 1, green: 1, red: 1, decayPerTick: Math.fround(.005), pointAttenuated: false },
      }
      // Exercise the native event lane, not a guessed replacement flash shader.
      Object.assign(state, { secondaryAbilities: { ...state.secondaryAbilities,
        events: [...state.secondaryAbilities.events, event], nextEventId: event.eventId + 1 } })
      await page.waitForFunction(() => document.querySelector('.boneyard-world-canvas').__sdrBoneyardFrame.secondaryScreenFlashAlpha > .5)
      const flash = await sample()
      assert.equal(flash.color, 0xffffff)
      await page.screenshot({ path: `${output}/flash-${complexLighting}.png` })
      await page.waitForFunction(() => document.querySelector('.boneyard-world-canvas').__sdrBoneyardFrame.secondaryScreenFlashAlpha === 0)
      const retired = await sample()
      assert.ok(retired.tick > flash.tick)
      await page.screenshot({ path: `${output}/retired-${complexLighting}.png` })

      // Native time, not wall time, owns a frozen frame's flash.
      const lane = new NativeSecondaryScreenFeedbackPresentation(event.tick, event.worldKey)
      lane.consume(event, { cameraCenter: event.position, localPlayerAlternate: false, visibleWorldWidth: 1600 })
      assert.equal(lane.sample(event.tick).alpha, 1)
      assert.equal(lane.sample(event.tick).alpha, 1)
      assert.ok(lane.sample(event.tick + 200).alpha > 0)
      assert.equal(lane.sample(event.tick + 201), null)
      assert.equal(new NativeSecondaryScreenFeedbackPresentation(event.tick, 'boneyard:next-run').sample(event.tick), null)

      await canvas.evaluate(node => {
        const extension = node.getContext('webgl2').getExtension('WEBGL_lose_context')
        if (!extension) throw new Error('Context-loss extension unavailable')
        window.__r11ContextLoss = extension
        node.addEventListener('webglcontextlost', () => { window.__r11ContextLost = true }, { once: true })
        node.addEventListener('webglcontextrestored', () => { window.__r11ContextRestored = true }, { once: true })
        extension.loseContext()
      })
      await page.waitForFunction(() => window.__r11ContextLost === true)
      await page.evaluate(() => window.__r11ContextLoss.restoreContext())
      await page.waitForFunction(() => window.__r11ContextRestored === true)
      await page.waitForFunction(frames => document.querySelector('.boneyard-world-canvas').__sdrBoneyardFrame.frameCount > frames + 10, retired.frames)
      await page.screenshot({ path: `${output}/restored-${complexLighting}.png` })
      const restored = await sample()
      assert.equal(restored.lost, false)
      assert.equal(restored.alpha, 0)
      errors.requests = errors.requests.filter(request => {
        if (request.error !== 'net::ERR_ABORTED') return true
        cancelledRequests.push(request)
        return false
      })
      assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [] })
      receipts.push({ complexLighting, moduleFailure, baseline, flash, retired, restored, cancelledRequests, errors })
    } catch (error) {
      console.error(JSON.stringify({ complexLighting, error: String(error), errors }))
      await page.screenshot({ path: `${output}/failure-${complexLighting}.png` }).catch(() => {})
      throw error
    } finally {
      await context.close()
      await host.close()
    }
  }
  const receipt = { browser: browser.version(), receipts }
  await writeFile(`${output}/receipt.json`, JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
} finally {
  await browser.close()
  await server.close()
}

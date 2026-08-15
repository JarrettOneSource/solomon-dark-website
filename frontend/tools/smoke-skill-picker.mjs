import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import {
  getPlayerCharacter,
  getPlayerProgression,
  getPlayerSkillBook,
} from '../src/game/core-server/game-simulation.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotPath = process.env.SDR_SKILL_PICKER_SMOKE_SCREENSHOT
  || '/tmp/solomon-dark-skill-picker-smoke.png'
const revealScreenshotPath = process.env.SDR_SKILL_PICKER_REVEAL_SMOKE_SCREENSHOT
  || screenshotPath.replace(/\.png$/i, '-reveal.png')
const credential = randomBytes(32).toString('base64url')
const pageErrors = []
const consoleErrors = []

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
  initialPlayerExperience: 100,
  snapshotRate: 100,
})
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.addInitScript(installGameAudioSmokeProbe)
  await page.addInitScript((runtime) => {
    window.solomonDarkRuntime = runtime
  }, {
    gameEndpoint: {
      credential,
      kind: 'localhost',
      url: host.address.url,
    },
  })

  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Fire' }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-arcane').click()

  const hubScene = page.locator('.hub-scene[data-renderer-state="ready"]')
  const hubCanvas = page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]')
  const picker = page.getByRole('dialog', { name: 'Level 2. Select a skill.' })
  await picker.waitFor({ timeout: 30_000 })
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const earlyOfferSequence = getPlayerProgression(host.state(), playerId).pendingOffer?.sequence
  assert.equal(await picker.getAttribute('data-reveal-interactive'), 'false')
  assert.equal(await picker.getByRole('button').first().isDisabled(), true)
  await picker.getByRole('button').first().evaluate((button) => button.click())
  await page.waitForTimeout(20)
  assert.equal(
    getPlayerProgression(host.state(), playerId).pendingOffer?.sequence,
    earlyOfferSequence,
    'the native reveal gate must reject a choice before 0.4 seconds',
  )
  await page.screenshot({ path: revealScreenshotPath })
  await Promise.all([
    hubScene.waitFor({ timeout: 30_000 }),
    hubCanvas.waitFor({ timeout: 30_000 }),
  ])
  const presentationSamples = []
  const presentationDeadline = Date.now() + 5_000
  while (Date.now() < presentationDeadline) {
    const sample = await hubCanvas.evaluate((canvas) => ({
      dynamicSuppressed: canvas.dataset.levelUpDynamicSuppressed,
      particleCount: Number(canvas.dataset.levelUpParticleCount),
      presentationId: canvas.dataset.levelUpPresentationId,
    }))
    presentationSamples.push(sample)
    if (sample.dynamicSuppressed === 'true' && sample.particleCount > 0) break
    await page.waitForTimeout(20)
  }
  const livePresentation = presentationSamples.find((sample) => (
    sample.dynamicSuppressed === 'true' && sample.particleCount > 0
  ))
  assert.ok(livePresentation, `level-up particles were not rendered: ${JSON.stringify({
    pageErrors,
    presentationSamples,
  })}`)
  try {
    await Promise.all([
      page.locator('.skill-picker-stage[data-renderer-state="ready"]').waitFor({ timeout: 30_000 }),
      page.waitForFunction(() => (
        document.querySelector('.skill-picker-stage')?.getAttribute('data-reveal-interactive')
          === 'true'
      ), undefined, { timeout: 30_000 }),
      page.waitForFunction(() => window.__sdrAudioEvents?.some(({ playbackRate, src, type }) => (
        type === 'buffer-start'
          && src.includes('level-up')
          && playbackRate === 1
      )), undefined, { timeout: 30_000 }),
    ])
  } catch (error) {
    process.stderr.write(`${JSON.stringify(await page.evaluate(() => {
      const canvas = document.querySelector('.hub-world-canvas')
      const stage = document.querySelector('.skill-picker-stage')
      return {
        audioEvents: window.__sdrAudioEvents?.filter(({ src }) => src.includes('level-up')),
        canvasDataset: canvas ? { ...canvas.dataset } : null,
        frame: canvas?.__sdrHubFrame ? structuredClone(canvas.__sdrHubFrame) : null,
        pickerDataset: stage ? { ...stage.dataset } : null,
      }
    }))}\n`)
    throw error
  }
  assert.ok(Number(await picker.getAttribute('data-reveal-elapsed-ms')) >= 400)
  assert.equal(await picker.getByRole('button').first().isDisabled(), false)

  const initialHubCanvas = await hubCanvas.elementHandle()
  assert.ok(initialHubCanvas, 'expected the Hub WebGL canvas below the picker')
  const settledPresentation = await hubCanvas.evaluate((canvas) => ({
    dynamicSuppressed: canvas.dataset.levelUpDynamicSuppressed,
    presentationId: canvas.dataset.levelUpPresentationId,
  }))
  const presentationReceipt = {
    ...settledPresentation,
    particleCount: Math.max(...presentationSamples.map(({ particleCount }) => particleCount)),
  }
  assert.equal(presentationReceipt.dynamicSuppressed, 'true')
  assert.ok(presentationReceipt.particleCount > 0)
  assert.equal(presentationReceipt.presentationId, '1')
  const pickerCanvas = page.locator('.skill-picker-canvas[data-game-renderer="pixi-webgl"]')
  const pickerRenderer = await pickerCanvas.evaluate((canvas) => ({
    context: (canvas.getContext('webgl2') || canvas.getContext('webgl'))?.constructor.name,
    height: canvas.height,
    rendererName: canvas.dataset.rendererName,
    width: canvas.width,
  }))
  assert.match(pickerRenderer.context || '', /WebGL/)
  assert.match(pickerRenderer.rendererName || '', /webgl/i)
  assert.deepEqual(
    { height: pickerRenderer.height, width: pickerRenderer.width },
    { height: 900, width: 1600 },
  )

  const actions = picker.getByRole('button')
  assert.equal(await actions.count(), 3)
  const actionReceipt = []
  for (let index = 0; index < 3; index += 1) {
    const action = actions.nth(index)
    const bounds = await action.boundingBox()
    assert.ok(bounds)
    actionReceipt.push({
      centerX: bounds.x + bounds.width / 2,
      label: await action.getAttribute('aria-label'),
      skillId: Number(await action.getAttribute('data-skill-id')),
    })
  }
  assert.deepEqual(actionReceipt.map(({ centerX }) => centerX), [600, 800, 1000])
  assert.ok(actionReceipt.every(({ label, skillId }) => label && skillId >= 8 && skillId <= 79))

  const beforeChoice = getPlayerProgression(host.state(), playerId)
  assert.equal(beforeChoice.level, 2)
  assert.equal(beforeChoice.experience, 100)
  assert.equal(beforeChoice.pendingOffer?.options.length, 3)
  const playerXBeforeBlockedInput = getPlayerCharacter(host.state(), playerId).position.x
  await page.keyboard.press('Escape')
  assert.equal(await picker.count(), 1, 'Escape must not dismiss the mandatory picker')
  await page.keyboard.down('d')
  await page.waitForTimeout(350)
  await page.keyboard.up('d')
  assert.equal(
    getPlayerCharacter(host.state(), playerId).position.x,
    playerXBeforeBlockedInput,
    'the authoritative player must remain paused while choosing a skill',
  )

  await page.keyboard.press('ArrowRight')
  assert.equal(await actions.nth(1).getAttribute('aria-pressed'), 'true')
  const selectedSkillId = actionReceipt[1].skillId
  const previousRank = getPlayerSkillBook(host.state(), playerId).permanentRanks[selectedSkillId]
  await page.screenshot({ path: screenshotPath })
  await page.keyboard.press('Enter')
  await picker.waitFor({ state: 'detached', timeout: 15_000 })

  const afterChoice = getPlayerProgression(host.state(), playerId)
  const afterBook = getPlayerSkillBook(host.state(), playerId)
  assert.equal(afterChoice.pendingOffer, null)
  assert.equal(afterBook.permanentRanks[selectedSkillId], previousRank + 1)
  assert.equal(afterBook.effectiveRanks[selectedSkillId], previousRank + 1)
  assert.equal(await initialHubCanvas.evaluate((canvas) => canvas.isConnected), true)
  assert.equal(await page.locator('.hub-world-canvas').count(), 1)
  const levelUpSoundRates = await page.evaluate(() => window.__sdrAudioEvents
    .filter(({ src, type }) => type === 'buffer-start' && src.includes('level-up'))
    .map(({ playbackRate }) => playbackRate))
  assert.deepEqual(levelUpSoundRates, [1])

  const playerXBeforeReleasedInput = getPlayerCharacter(host.state(), playerId).position.x
  await page.keyboard.down('d')
  await page.waitForFunction(
    ({ startX }) => document.querySelector('.hub-world-canvas')?.__sdrHubFrame.playerX > startX,
    { startX: playerXBeforeReleasedInput },
    { timeout: 5_000 },
  )
  await page.keyboard.up('d')

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  process.stdout.write(`${JSON.stringify({
    actionReceipt,
    bookedRank: afterBook.permanentRanks[selectedSkillId],
    pickerRenderer,
    presentationReceipt,
    revealScreenshotPath,
    screenshotPath,
    selectedSkillId,
    levelUpSoundRates,
  })}\n`)
} finally {
  await browser.close()
  await host.close()
  await vite.close()
}

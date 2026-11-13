// Built-client regression for native College guidance and the added Party card.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'
import { enterHubForSmoke, navigateHubRegion, hubSmokePlayerPosition } from './hub-smoke-navigation.mjs'
import { HUB_INTERACTION_GEOMETRY } from '../src/game/hub-inventory-presentation.ts'

const root = resolve(process.env.OUT)
const touch = process.env.TOUCH === '1'
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const receipt = { passed: false, touch, frames: [], errors: [] }
await mkdir(root, { recursive: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, hasTouch: touch })
page.on('pageerror', error => receipt.errors.push({ type: 'page', message: error.message }))
page.on('console', message => {
  if (message.type() === 'error') receipt.errors.push({ type: 'console', message: message.text() })
})
page.on('response', response => {
  if (response.status() >= 400) receipt.errors.push({ type: 'response', status: response.status(), path: new URL(response.url()).pathname })
})
page.on('requestfailed', request => receipt.errors.push({ type: 'request', path: new URL(request.url()).pathname, failure: request.failure()?.errorText }))
try {
  await page.addInitScript(({ url, credential }) => {
    window.solomonDarkRuntime = { gameEndpoint: { credential, kind: 'localhost', sessionKind: 'private-college', url } }
  }, { url: process.env.SDR_GAME_ENDPOINT_URL, credential: process.env.SDR_GAME_ENDPOINT_CREDENTIAL })
  await page.route('**/deployment.json?*', route => route.fulfill({ json: { revision: new URL(route.request().url()).searchParams.get('current') } }))
  await page.route('**/api/mods?**', route => route.fulfill({ json: { items: [], page: 1, pageSize: 50, total: 0 } }))
  await page.route('**/api/game/parties', route => route.fulfill({ json: { items: [] } }))
  await enterHubForSmoke(page, process.env.URL)
  const canvas = page.locator('.hub-world-canvas')
  const bounds = async () => JSON.parse(await canvas.getAttribute('data-npc-guidance-bounds'))
  async function interact(interaction, name) {
    const approach = { annalist: 30, fomentius: 70, luthacus: 55 }[interaction]
    if (interaction === 'luthacus') {
      // Leave the tent to the east without walking into Skorcha's contact dialogue.
      await navigateHubRegion(page, canvas, 'courtyard', { x: 1480, y: 760 }, 12)
      await navigateHubRegion(page, canvas, 'courtyard', { x: 1560, y: 680 }, 12)
    }
    await navigateHubRegion(page, canvas, 'courtyard', HUB_INTERACTION_GEOMETRY[interaction].position, approach)
    const dialogue = page.getByRole('dialog', { name: `Talking to ${name}` })
    const prompt = page.locator(`.game-interact-prompt[data-interaction-target="hub:${interaction}"]`)
    // Walking into an NPC can already have opened native contact dialogue.
    await dialogue.or(prompt).first().waitFor()
    if (!await dialogue.isVisible()) await prompt.click()
    await dialogue.waitFor()
    return dialogue
  }
  async function capture(name, visibleHints = 0) {
    await page.waitForTimeout(400)
    if (visibleHints) {
      await page.waitForFunction(() => document.querySelector('.hub-world-canvas').dataset.npcDirectionalHintCount === '0')
      await page.waitForFunction(count => document.querySelector('.hub-world-canvas').dataset.npcDirectionalHintCount === String(count), visibleHints)
    }
    const party = await page.locator('.hub-party-panel').boundingBox()
    const guidance = await bounds()
    assert.ok(party, 'the real private College supplies a Party card')
    for (const hint of guidance) assert.ok(!(party.x < hint.x + hint.width && party.x + party.width > hint.x
      && party.y < hint.y + hint.height && party.y + party.height > hint.y), `${name}: Party leaves the rendered hint clear`)
    receipt.frames.push({ name, viewport: page.viewportSize(), position: await hubSmokePlayerPosition(canvas), party, guidance })
    await page.screenshot({ path: join(root, `${name}.png`) })
    console.log(name, JSON.stringify({ party, guidance }))
  }
  assert.equal(await canvas.getAttribute('data-npc-walk-to-talk-visible'), 'true')
  await capture('fresh-guidance')
  await navigateHubRegion(page, canvas, 'courtyard', { x: 1500, y: 500 }, 25)
  await capture('camera-overlap')
  for (const viewport of [{ width: 1024, height: 768 }, { width: 896, height: 414 }, { width: 414, height: 896 }]) {
    await page.setViewportSize(viewport)
    if (touch && viewport.height > viewport.width) {
      await page.locator('.game-orientation-hint').waitFor({ state: 'visible' })
      await page.screenshot({ path: join(root, 'portrait-orientation.png') })
      continue
    }
    await capture(`size-${viewport.width}`)
    if (touch) {
      await page.getByRole('button', { name: 'Party', exact: true }).click()
      await capture(`size-${viewport.width}-expanded`)
      await page.getByRole('button', { name: 'Party', exact: true }).click()
    }
  }
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.getByRole('button', { name: 'Party settings', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.hub-world-canvas').dataset.npcGuidanceBounds === '[]')
  await page.screenshot({ path: join(root, 'party-settings.png') })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('.hub-world-canvas').dataset.npcWalkToTalkVisible === 'true')
  const dialogue = await interact('annalist', 'Provokatus')
  await page.waitForFunction(() => document.querySelector('.hub-world-canvas').dataset.npcHelpFlags.startsWith('0'))
  assert.deepEqual(await bounds(), [], 'dialogue suppresses onboarding')
  await page.keyboard.press('Escape')
  await dialogue.waitFor({ state: 'hidden' })
  await page.waitForFunction(() => JSON.parse(document.querySelector('.hub-world-canvas').dataset.npcGuidanceBounds).length === 2)
  // Dialogue release can still interpolate the camera. Establish a stationary
  // observation before attributing any geometry change to the blink phase.
  let settled = false
  let stableSamples = 0
  let previousBounds = await bounds()
  receipt.settlingSamples = []
  for (let sample = 0; sample < 100; sample++) {
    await page.waitForTimeout(100)
    const current = await bounds()
    receipt.settlingSamples.push({ bounds: current, position: await hubSmokePlayerPosition(canvas),
      phase: await canvas.getAttribute('data-npc-directional-hint-count') })
    const stable = current.length === previousBounds.length && current.every((hint, index) =>
      ['x', 'y', 'width', 'height'].every(field => Math.abs(hint[field] - previousBounds[index][field]) < 0.01))
    stableSamples = stable ? stableSamples + 1 : 0
    previousBounds = current
    if (stableSamples >= 5) { settled = true; break }
  }
  assert.ok(settled, 'camera and hint bounds settle before blink observation')
  const phases = new Set()
  const reservation = await bounds()
  receipt.blinkSamples = []
  for (let sample = 0; sample < 32; sample++) {
    const phase = await canvas.getAttribute('data-npc-directional-hint-count')
    phases.add(phase)
    const current = await bounds()
    receipt.blinkSamples.push({ phase, bounds: current, position: await hubSmokePlayerPosition(canvas) })
    assert.equal(current.length, reservation.length, 'both active hints reserve space during blinking')
    for (let index = 0; index < current.length; index++) for (const field of ['x', 'y', 'width', 'height']) {
      assert.ok(Math.abs(current[index][field] - reservation[index][field]) < 0.1,
        `blink does not move hint ${index} ${field}: ${current[index][field]} versus ${reservation[index][field]}`)
    }
    await page.waitForTimeout(80)
  }
  assert.deepEqual([...phases].sort(), ['0', '2'])
  await capture('both-directional-hints', 2)
  for (const viewport of [{ width: 896, height: 414 }, { width: 414, height: 896 }]) {
    await page.setViewportSize(viewport)
    if (touch && viewport.height > viewport.width) {
      await page.locator('.game-orientation-hint').waitFor({ state: 'visible' })
      await page.screenshot({ path: join(root, 'hints-portrait-orientation.png') })
      continue
    }
    await capture(`hints-size-${viewport.width}`, 2)
    if (touch) {
      await page.getByRole('button', { name: 'Party', exact: true }).click()
      await capture(`hints-size-${viewport.width}-expanded`, 2)
      await page.getByRole('button', { name: 'Party', exact: true }).click()
    }
  }
  await page.setViewportSize({ width: 1600, height: 900 })
  for (const [name, remaining] of [['Fomentius', 1], ['Luthacus', 0]]) {
    const interaction = name.toLowerCase()
    const service = await interact(interaction, name)
    await page.waitForFunction(() => document.querySelector('.hub-world-canvas').dataset.npcGuidanceBounds === '[]')
    await page.keyboard.press('Escape')
    await service.waitFor({ state: 'hidden' })
    await page.waitForFunction(count => JSON.parse(document.querySelector('.hub-world-canvas').dataset.npcGuidanceBounds).length === count, remaining)
    await capture(`${name}-acknowledged`, remaining)
  }
  async function leave() {
    await page.locator('.hub-scene').focus()
    await page.keyboard.press('Escape')
    const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
    await pause.waitFor()
    await pause.getByRole('button', { name: 'LEAVE GAME' }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor()
  }
  await leave()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'Last game', exact: true }).click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor()
  await page.waitForFunction(() => document.querySelector('.hub-world-canvas').dataset.npcHelpFlags.startsWith('000'))
  await capture('continued')
  await leave()
  assert.deepEqual(receipt.errors, [])
  receipt.passed = true
} catch (error) {
  receipt.failure = error.stack
  await page.screenshot({ path: join(root, 'failure.png') }).catch(() => {})
  throw error
} finally {
  await writeFile(join(root, 'receipt.json'), JSON.stringify(receipt, null, 2))
  await browser.close()
}

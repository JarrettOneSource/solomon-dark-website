import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

import { GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import {
  HUB_INTERACTION_GEOMETRY,
} from '../src/game/hub-inventory-presentation.ts'
import {
  NATIVE_HUB_NPC_CATALOG,
} from '../src/game/core-kernels/native-hub-npc.ts'
import {
  holdForHubTransition,
  navigateHubRegion,
  waitForSettledHubRegion,
} from './hub-smoke-navigation.mjs'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const baseUrl = process.env.SDR_GAME_NPC_SMOKE_URL || 'http://127.0.0.1:4192'
const screenshotRoot = process.env.SDR_GAME_NPC_SCREENSHOT_ROOT || '/tmp/solomon-dark-hub-npcs'
const onlySection = process.env.SDR_GAME_NPC_SMOKE_ONLY?.trim() || null
const expectedSkorchaVariant = process.env.SDR_GAME_NPC_EXPECT_SKORCHA_VARIANT === undefined
  ? null
  : Number(process.env.SDR_GAME_NPC_EXPECT_SKORCHA_VARIANT)
assert.ok(
  onlySection === null
    || [
      'courtyard',
      'library',
      'mortuary',
      'office',
      'skorcha',
      'skorcha-lifecycle',
    ].includes(onlySection),
  `unknown NPC smoke section ${JSON.stringify(onlySection)}`,
)
assert.ok(
  expectedSkorchaVariant === null
    || [0, 1, 2].includes(expectedSkorchaVariant),
  `invalid expected Skorcha variant ${JSON.stringify(expectedSkorchaVariant)}`,
)
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { height: 900, width: 1600 } })
const consoleErrors = []
const pageErrors = []
const failedResponses = []
const receipts = []

await page.addInitScript(installGameAudioSmokeProbe)
await page.addInitScript(bypassStartupAudioPreload)
await page.route('**/deployment.json?*', async (route) => {
  const revision = new URL(route.request().url()).searchParams.get('current')
  await route.fulfill({ json: { revision } })
})
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => pageErrors.push(error.message))
page.on('response', (response) => {
  if (response.status() >= 400) failedResponses.push({
    status: response.status(),
    url: response.url(),
  })
})

try {
  await enterHub()
  const canvas = page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]')
  await fundNpcSmoke()

  if (onlySection === null || onlySection === 'courtyard') {
    await visitTrader(canvas, 'hagatha', 'Hagatha', 'WITCH_INTRO', 'Charm Prices?', 'hagatha')
    await visitTrader(canvas, 'fomentius', 'Fomentius', 'POTIONGUY_INTRO', null, 'fomentius')
    await exerciseProvokatus(canvas)
    await visitTrader(canvas, 'luthacus', 'Luthacus', 'SCAVENGER_INTRO', null, 'luthacus')
    await exerciseSkorcha(canvas)
    await exerciseTeacher(canvas)
  }
  if (onlySection === 'skorcha') await exerciseSkorcha(canvas)
  if (onlySection === 'skorcha-lifecycle') {
    assert.equal(
      await canvas.evaluate((node) => node.__sdrHubFrame.skorcha),
      null,
      'lifecycle smoke seed must begin with an absent Skorcha population',
    )
    await navigateHubRegion(page, canvas, 'courtyard', { x: 1800, y: 650 }, 40, log)
    await holdForHubTransition(page, canvas, ['d', 'w'], 'library')
    await waitForSettledHubRegion(page, canvas, 'library')
    await navigateHubRegion(page, canvas, 'library', { x: 512, y: 850 }, 25, log)
    await holdForHubTransition(page, canvas, ['s'], 'courtyard')
    await waitForSettledHubRegion(page, canvas, 'courtyard')
    await exerciseSkorcha(canvas)
  }

  if (onlySection === null || onlySection === 'library') {
    await navigateHubRegion(page, canvas, 'courtyard', { x: 1800, y: 650 }, 40, log)
    await holdForHubTransition(page, canvas, ['d', 'w'], 'library')
    await waitForSettledHubRegion(page, canvas, 'library')
    await exerciseLibrarian(canvas)
    await visitTrader(canvas, 'shlorio', 'Shlorio', 'DOWSER_INTRO', 'Dowsing Prices?', 'shlorio')
    await navigateHubRegion(page, canvas, 'library', { x: 512, y: 850 }, 25, log)
    await holdForHubTransition(page, canvas, ['s'], 'courtyard')
    await waitForSettledHubRegion(page, canvas, 'courtyard')
  }

  if (onlySection === null || onlySection === 'mortuary') {
    await navigateHubRegion(page, canvas, 'courtyard', { x: 260, y: 610 }, 40, log)
    await holdForHubTransition(page, canvas, ['a', 'w'], 'mortuary')
    await waitForSettledHubRegion(page, canvas, 'mortuary')
    await exerciseMemorator(canvas)
    await exercisePaintings(canvas)
    await navigateHubRegion(page, canvas, 'mortuary', { x: 512, y: 850 }, 25, log)
    await holdForHubTransition(page, canvas, ['s'], 'courtyard')
    await waitForSettledHubRegion(page, canvas, 'courtyard')
  }

  if (onlySection === null || onlySection === 'office') {
    await navigateHubRegion(page, canvas, 'courtyard', { x: 950.64, y: 180 }, 10, log)
    await holdForHubTransition(page, canvas, ['w'], 'office')
    await waitForSettledHubRegion(page, canvas, 'office')
    await exerciseArchchancellor(canvas)
  }

  const completeInteractions = [
    'annalist', 'arch-chancellor', 'fomentius', 'hagatha', 'librarian', 'luthacus',
    'memorator', 'painting-0', 'painting-1', 'painting-100', 'painting-3',
    'painting-4', 'painting-5', 'painting-6', 'painting-7', 'painting-8',
    'painting-9', 'shlorio', 'skorcha', 'teacher',
  ]
  const sectionInteractions = {
    courtyard: ['annalist', 'fomentius', 'hagatha', 'luthacus', 'skorcha', 'teacher'],
    library: ['librarian', 'shlorio'],
    mortuary: ['memorator', ...completeInteractions.filter(id => id.startsWith('painting-'))],
    office: ['arch-chancellor'],
    skorcha: ['skorcha'],
    'skorcha-lifecycle': ['skorcha'],
  }
  assert.deepEqual(
    receipts.map(({ interaction }) => interaction).sort(),
    (onlySection === null ? completeInteractions : sectionInteractions[onlySection]).sort(),
  )
  const renderer = await browserRendererReceipt(canvas)
  assert.match(renderer.gameRenderer, /pixi-webgl/)
  assert.doesNotMatch(renderer.unmaskedRenderer, /SwiftShader|llvmpipe/i)
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(failedResponses, [])
  process.stdout.write(`${JSON.stringify({
    consoleErrors,
    failedResponses,
    pageErrors,
    playerPosition: await page.locator('.hub-world-canvas').count() > 0
      ? await page.locator('.hub-world-canvas').evaluate(node => node.__sdrHubFrame && ({
          x: node.__sdrHubFrame.playerX,
          y: node.__sdrHubFrame.playerY,
        }))
      : null,
    prompts: await page.locator('.game-interact-prompt').evaluateAll(nodes => (
      nodes.map(node => node.dataset.interactionTarget)
    )),
    receipts,
    renderer,
    status: 'ok',
  })}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    consoleErrors,
    failedResponses,
    pageErrors,
    playerPosition: await page.locator('.hub-world-canvas').count() > 0
      ? await page.locator('.hub-world-canvas').evaluate(node => node.__sdrHubFrame && ({
          x: node.__sdrHubFrame.playerX,
          y: node.__sdrHubFrame.playerY,
        }))
      : null,
    prompts: await page.locator('.game-interact-prompt').evaluateAll(nodes => (
      nodes.map(node => node.dataset.interactionTarget)
    )),
    receipts,
    url: page.url(),
  })}\n`)
  throw error
} finally {
  await browser.close()
}

async function enterHub() {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
  await declineTutorialOffer()
  await page.getByRole('button', { name: 'Play' }).click()
  await declineTutorialOffer()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /ether/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.locator('.hub-world-canvas[data-hub-region="courtyard"]').waitFor({ timeout: 30_000 })
}

async function declineTutorialOffer() {
  const offer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await offer.isVisible()) await offer.getByRole('button', { name: 'NO' }).click()
}

async function fundNpcSmoke() {
  await page.evaluate((key) => {
    const current = JSON.parse(localStorage.getItem(key) || '{}')
    localStorage.setItem(key, JSON.stringify({ ...current, enableCheats: true }))
    window.dispatchEvent(new StorageEvent('storage', { key }))
  }, GAME_SETTINGS_STORAGE_KEY)
  await page.waitForFunction(() => Boolean(window.solomonDark?.lua), null, { timeout: 10_000 })
  const result = await page.evaluate(() => window.solomonDark.lua.execute('sd.player.set_gold(20000)'))
  assert.equal(result.ok, true, result.error)
}

async function visitTrader(canvas, interaction, name, introKey, questionLabel, service) {
  await navigateHubRegion(
    page,
    canvas,
    HUB_INTERACTION_GEOMETRY[interaction].region,
    HUB_INTERACTION_GEOMETRY[interaction].position,
    Math.sqrt(
      5 * HUB_INTERACTION_GEOMETRY[interaction].radius ** 2 + 1500,
    ) - 10,
    log,
  )
  const dialog = await openInteraction(interaction, name)
  await assertSpeech(dialog, introKey)
  await skipSpeech(dialog)
  if (questionLabel) {
    await dialog.getByRole('button', { name: questionLabel }).click()
    const question = NATIVE_HUB_NPC_CATALOG.interactions[interaction].questions[0]
    await assertSpeech(dialog, question)
    await skipSpeech(dialog)
  }
  await dialog.locator(`[data-service-trader="${service}"]`).click()
  const title = NATIVE_HUB_NPC_CATALOG.interactions[interaction].serviceTitle
  const serviceDialog = page.getByRole('dialog', { name: title })
  await serviceDialog.waitFor()
  await serviceDialog.getByRole('button', { name: 'Done' }).click()
  await serviceDialog.waitFor({ state: 'hidden' })
  receipts.push({ interaction, service })
}

async function exerciseProvokatus(canvas) {
  await navigateHubRegion(page, canvas, 'courtyard', HUB_INTERACTION_GEOMETRY.annalist.position, 30, log)
  const dialog = await openInteraction('annalist', 'Provokatus')
  await assertSpeech(dialog, 'ANNAL_INTRO')
  await skipSpeech(dialog)
  assert.equal(await dialog.getByText('Interesting how?').count(), 0)
  await dialog.getByRole('button', { name: 'Boast' }).click()
  await waitForPhase(dialog, 'selector')
  assert.equal(await dialog.locator('[data-native-selector-kind="boast"]').count(), 5)
  await page.screenshot({ path: `${screenshotRoot}-provokatus-boasts.png` })
  await dialog.locator('[data-native-selector-id="3"]').click()
  await assertSpeech(dialog, 'ANNAL_RANDOMBOAST', 5_000)
  await page.screenshot({ path: `${screenshotRoot}-provokatus-response.png` })
  await dialog.getByRole('button', { name: 'Skip' }).click()
  await dialog.waitFor({ state: 'hidden' })
  const note = page.getByRole('alertdialog', { name: 'Boast notice' })
  await note.waitFor()
  assert.match(await note.innerText(), /survive until at least Wave 30/)
  await note.getByRole('button', { name: 'OKAY' }).click()
  const grant = await page.evaluate(() => window.solomonDark.lua.execute(
    'sd.player.grant_experience(91)',
  ))
  assert.equal(grant.ok, true, grant.error)
  const picker = page.locator('.skill-picker-stage')
  await picker.waitFor({ timeout: 10_000 })
  await picker.locator('xpath=self::*[@data-picker-phase="settled"]').waitFor({ timeout: 10_000 })
  const automaticChoiceIndex = Number(await picker.getAttribute('data-automatic-choice-index'))
  assert.ok(Number.isSafeInteger(automaticChoiceIndex))
  assert.equal(
    await picker.locator('[data-choice-index]').evaluateAll(buttons => (
      buttons.every(button => button.disabled)
    )),
    true,
  )
  const automaticStartedAt = performance.now()
  await page.screenshot({ path: `${screenshotRoot}-provokatus-automatic-choice.png` })
  await picker.waitFor({ state: 'hidden', timeout: 10_000 })
  const automaticElapsedMs = performance.now() - automaticStartedAt
  assert.ok(automaticElapsedMs >= 900, `automatic choice closed in ${automaticElapsedMs} ms`)
  receipts.push({
    automaticChoiceIndex,
    automaticElapsedMs: Math.round(automaticElapsedMs),
    interaction: 'annalist',
    selectorRows: 5,
  })
}

async function exerciseSkorcha(canvas) {
  const state = await canvas.evaluate((node) => node.__sdrHubFrame.skorcha)
  assert.ok(state, 'deterministic NPC smoke seed did not create Skorcha')
  if (expectedSkorchaVariant !== null) assert.equal(state.variant, expectedSkorchaVariant)
  assert.equal(await canvas.getAttribute('data-skorcha-present'), 'true')
  await navigateHubRegion(page, canvas, 'courtyard', { x: state.x, y: state.y }, 35, log)
  const dialog = await openInteraction('skorcha', 'Skorcha')
  await assertSpeech(dialog, 'ENFORCER_INTRO')
  const dismissalKey = `ENFORCER_DISMISS${state.dismissalIndex + 1}`
  await dialog.getByRole('button', { name: 'Skip' }).click()
  await assertSpeech(dialog, dismissalKey)
  await page.screenshot({ path: `${screenshotRoot}-skorcha.png` })
  await dialog.getByRole('button', { name: 'Skip' }).click()
  await dialog.waitFor({ state: 'hidden' })
  receipts.push({
    dismissalKey,
    gesture: state.gesture,
    interaction: 'skorcha',
    variant: state.variant,
  })
}

async function exerciseTeacher(canvas) {
  await navigateHubRegion(page, canvas, 'courtyard', {
    x: HUB_INTERACTION_GEOMETRY.teacher.position.x,
    y: HUB_INTERACTION_GEOMETRY.teacher.position.y + 60,
  }, 15, log)
  const dialog = await openInteraction('teacher', 'Professor Machinimbus')
  await assertSpeech(dialog, 'TEACHER_INTRO')
  await skipSpeech(dialog)
  await dialog.getByRole('button', { name: 'Spell Testing?' }).click()
  await assertSpeech(dialog, 'TEACHER_Q')
  await skipSpeech(dialog)
  const goldBefore = Number(await dialog.locator('[data-player-gold]').getAttribute('data-player-gold'))
  await dialog.getByRole('button', { name: 'Per$uade' }).click()
  await waitForPhase(dialog, 'selector')
  assert.equal(await dialog.locator('[data-native-selector-kind="teacher-spells"]').count(), 5)
  await page.screenshot({ path: `${screenshotRoot}-teacher-spells.png` })
  await dialog.locator('[data-native-selector-id="72"]').click()
  await assertSpeech(dialog, 'ACID_RAIN', 5_000)
  assert.equal(Number(await dialog.locator('[data-player-gold]').getAttribute('data-player-gold')), goldBefore - 3000)
  await dialog.getByRole('button', { name: 'Skip' }).click()
  await waitForPhase(dialog, 'choices')
  await dialog.getByRole('button', { name: 'Per$uade' }).click()
  await waitForPhase(dialog, 'selector')
  assert.equal(await dialog.locator('[data-native-selector-id="72"]').count(), 0)
  await dialog.getByRole('button', { name: 'Done' }).click()
  await finishChoices(dialog)
  receipts.push({ interaction: 'teacher', purchasedSkillId: 72 })
}

async function exerciseLibrarian(canvas) {
  await navigateHubRegion(page, canvas, 'library', HUB_INTERACTION_GEOMETRY.librarian.position, 100, log)
  const dialog = await openInteraction('librarian', 'Professor Semicus')
  await assertSpeech(dialog, 'LIBRARIAN_INTRO')
  await skipSpeech(dialog)
  await dialog.getByRole('button', { name: 'Inquire about Books' }).click()
  await waitForPhase(dialog, 'selector')
  assert.match(await dialog.getByRole('status').innerText(), /26 entries/)
  for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
    const more = dialog.getByRole('button', { name: 'More entries' })
    if (await more.count() === 0) break
    await more.click()
  }
  const lace = dialog.locator('[data-native-selector-id="25"]')
  await lace.waitFor()
  await page.screenshot({ path: `${screenshotRoot}-librarian-lace.png` })
  await lace.click()
  await assertSpeech(dialog, 'BOOK25_LACE', 5_000)
  await dialog.getByRole('button', { name: 'Skip' }).click()
  await waitForPhase(dialog, 'choices')
  await dialog.getByRole('button', { name: 'Inquire about Books' }).click()
  await waitForPhase(dialog, 'selector')
  assert.match(await dialog.getByRole('status').innerText(), /25 entries/)
  assert.equal(await dialog.locator('[data-native-selector-id="25"]').count(), 0)
  await dialog.getByRole('button', { name: 'Done' }).click()
  await finishChoices(dialog)
  receipts.push({ interaction: 'librarian', laceRemoved: true })
}

async function exerciseMemorator(canvas) {
  await navigateHubRegion(page, canvas, 'mortuary', HUB_INTERACTION_GEOMETRY.memorator.position, 58, log)
  const dialog = await openInteraction('memorator', 'Declarius')
  await assertSpeech(dialog, 'MEMORATOR_INTRO')
  await skipSpeech(dialog)
  for (const [label, key] of [
    ['This memorial?', 'MEMORATOR_Q1'],
    ['These mages?', 'MEMORATOR_Q2'],
  ]) {
    await dialog.getByRole('button', { name: label }).click()
    await assertSpeech(dialog, key)
    await skipSpeech(dialog)
  }
  await dialog.getByRole('button', { name: 'Done' }).click()
  await assertSpeech(dialog, 'MEMORATOR_DISMISS')
  await dialog.getByRole('button', { name: 'Skip' }).click()
  await dialog.waitFor({ state: 'hidden' })
  receipts.push({ interaction: 'memorator', questions: 2 })
}

async function exercisePaintings(canvas) {
  const approachPaths = {
    'painting-0': [{ x: 512, y: 777 }],
    'painting-1': [
      { x: 260, y: 777 },
      { x: 350, y: 763 },
    ],
    'painting-100': [
      { x: 350, y: 850 },
      { x: 760, y: 850 },
      { x: 760, y: 610 },
      { x: 673, y: 618 },
    ],
    'painting-3': [{ x: 744, y: 610 }],
    'painting-4': [{ x: 590, y: 610 }],
    'painting-5': [{ x: 434, y: 610 }],
    'painting-6': [{ x: 279, y: 610 }],
    'painting-7': [{ x: 380, y: 470 }],
    'painting-8': [{ x: 512, y: 470 }],
    'painting-9': [{ x: 680, y: 470 }],
  }
  for (const interaction of NATIVE_HUB_NPC_CATALOG.interactionOrder.filter(
    candidate => candidate.startsWith('painting-'),
  )) {
    for (const waypoint of approachPaths[interaction]) {
      await navigateHubRegion(page, canvas, 'mortuary', waypoint, 10, log)
    }
    const dialog = await openInteraction(interaction, 'Declarius')
    const eulogyIndex = NATIVE_HUB_NPC_CATALOG.interactions[interaction].eulogyIndex
    await assertSpeech(dialog, `SAY_EULOGY_${eulogyIndex}`)
    const text = normalizeBrowserText(await dialog.innerText())
    const principal = NATIVE_HUB_NPC_CATALOG.eulogies[`${eulogyIndex}`]
    if (principal === null) assert.equal(text.includes('This portrait is of'), false)
    else assert.ok(text.includes(normalizeBrowserText(principal)), `${interaction} omitted its principal eulogy`)
    assert.ok(NATIVE_HUB_NPC_CATALOG.badEulogies.some(
      line => text.includes(normalizeBrowserText(line)),
    ))
    if (interaction === 'painting-100') {
      await page.screenshot({ path: `${screenshotRoot}-painting-100.png` })
    }
    await dialog.getByRole('button', { name: 'Skip' }).click()
    await dialog.waitFor({ state: 'hidden' })
    receipts.push({ interaction })
  }
  for (const waypoint of [
    { x: 820, y: 480 },
    { x: 820, y: 850 },
    { x: 512, y: 850 },
  ]) {
    await navigateHubRegion(page, canvas, 'mortuary', waypoint, 18, log)
  }
}

async function exerciseArchchancellor(canvas) {
  await navigateHubRegion(page, canvas, 'office', HUB_INTERACTION_GEOMETRY['arch-chancellor'].position, 100, log)
  const dialog = await openInteraction('arch-chancellor', 'The Archchancellor')
  await assertSpeech(dialog, 'ARCH_INTRO')
  await skipSpeech(dialog)
  await dialog.getByRole('button', { name: 'Equipment?' }).click()
  await assertSpeech(dialog, 'ARCH_Q')
  await skipSpeech(dialog)
  await dialog.getByRole('button', { name: 'Done' }).click()
  await assertSpeech(dialog, 'ARCH_DISMISS')
  await page.screenshot({ path: `${screenshotRoot}-archchancellor.png` })
  await dialog.getByRole('button', { name: 'Skip' }).click()
  await dialog.waitFor({ state: 'hidden' })
  receipts.push({ interaction: 'arch-chancellor', questions: 1 })
}

async function openInteraction(interaction, name) {
  const prompt = page.locator(`.game-interact-prompt[data-interaction-target="hub:${interaction}"]`)
  await prompt.waitFor({ timeout: 15_000 })
  await prompt.click()
  const dialog = page.getByRole('dialog', { name: `Talking to ${name}` })
  await dialog.waitFor()
  await dialog.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor({
    timeout: 10_000,
  })
  return dialog
}

async function browserRendererReceipt(canvas) {
  return canvas.evaluate((node) => {
    const context = node.getContext('webgl2')
    if (!context) throw new Error('Hub canvas lost its WebGL2 context')
    const debug = context.getExtension('WEBGL_debug_renderer_info')
    return {
      gameRenderer: node.dataset.gameRenderer || '',
      rendererName: node.dataset.rendererName || '',
      unmaskedRenderer: debug
        ? String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL))
        : String(context.getParameter(context.RENDERER)),
      unmaskedVendor: debug
        ? String(context.getParameter(debug.UNMASKED_VENDOR_WEBGL))
        : String(context.getParameter(context.VENDOR)),
    }
  })
}

async function assertSpeech(dialog, key, timeout = 10_000) {
  await dialog.locator(`xpath=self::*[@data-native-chat-phase="speech"][@data-native-chat-record="${key}"]`)
    .waitFor({ timeout })
  const expected = NATIVE_HUB_NPC_CATALOG.dialogue[key]?.lines
  if (expected) {
    const text = normalizeBrowserText(await dialog.innerText())
    for (const line of expected) assert.ok(
      text.includes(normalizeBrowserText(line)),
      `${key} omitted ${JSON.stringify(line)}`,
    )
  }
}

async function skipSpeech(dialog) {
  await dialog.getByRole('button', { name: 'Skip' }).click()
  await waitForPhase(dialog, 'choices')
}

async function waitForPhase(dialog, phase) {
  await dialog.locator(`xpath=self::*[@data-native-chat-phase="${phase}"]`).waitFor({ timeout: 10_000 })
}

async function finishChoices(dialog) {
  await waitForPhase(dialog, 'choices')
  await dialog.getByRole('button', { name: 'Done' }).click()
  if (await dialog.isVisible()) {
    await dialog.getByRole('button', { name: 'Skip' }).click()
  }
  await dialog.waitFor({ state: 'hidden' })
}

function log(message) {
  process.stdout.write(`[hub-npcs] ${message}\n`)
}

function normalizeBrowserText(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function bypassStartupAudioPreload() {
  const nativeLoad = HTMLMediaElement.prototype.load
  HTMLMediaElement.prototype.load = function loadWithoutDecode() {
    if (!(this instanceof HTMLAudioElement)) return nativeLoad.call(this)
    queueMicrotask(() => this.dispatchEvent(new Event('loadeddata')))
  }
  Object.defineProperty(window, '__sdrRestoreAudioPreload', {
    value: () => { HTMLMediaElement.prototype.load = nativeLoad },
  })
}

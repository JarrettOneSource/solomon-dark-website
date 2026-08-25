import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import {
  getPlayerEconomy,
  getPlayerCharacter,
  getPlayerProgression,
  getPlayerSkillBook,
  grantGameSimulationPlayerExperience,
  stepGameSimulationTick,
} from '../src/game/core-server/game-simulation.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../src/game/core-kernels/boneyard-wave-schema.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotPath = process.env.SDR_SKILL_PICKER_SMOKE_SCREENSHOT
  || '/tmp/solomon-dark-skill-picker-smoke.png'
const revealScreenshotPath = process.env.SDR_SKILL_PICKER_REVEAL_SMOKE_SCREENSHOT
  || screenshotPath.replace(/\.png$/i, '-reveal.png')
const boneyardScreenshotPath = process.env.SDR_SKILL_PICKER_BONEYARD_SMOKE_SCREENSHOT
  || screenshotPath.replace(/\.png$/i, '-boneyard.png')
const credential = randomBytes(32).toString('base64url')
const pageErrors = []
const consoleErrors = []
const failedResponses = []

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
  snapshotRate: 100,
})
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })

try {
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(`${message.text()} @ ${message.location().url}`)
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
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
  await page.route('**/deployment.json?*', async (route) => {
    const revision = new URL(route.request().url()).searchParams.get('current')
    await route.fulfill({ json: { revision } })
  })

  await page.goto(`${baseUrl}/game`, { timeout: 90_000, waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  const tutorialOffer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialOffer.isVisible()) {
    await tutorialOffer.getByRole('button', { exact: true, name: 'NO' }).click()
  }
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
  await Promise.all([
    hubScene.waitFor({ timeout: 30_000 }),
    hubCanvas.waitFor({ timeout: 30_000 }),
  ])
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const beforeCharm = host.state()
  const economy = getPlayerEconomy(beforeCharm, playerId)
  Object.assign(beforeCharm, {
    ...beforeCharm,
    playerEntities: replacePlayerEconomy(
      beforeCharm.playerEntities,
      playerId,
      {
        ...economy,
        ownedPerkSelectors: [...economy.ownedPerkSelectors, 17],
      },
    ),
  })
  assert.ok(getPlayerEconomy(host.state(), playerId).ownedPerkSelectors.includes(17))

  const playerXBeforeLevelUp = getPlayerCharacter(host.state(), playerId).position.x
  await page.keyboard.down('d')
  await waitForHost(
    () => getPlayerCharacter(host.state(), playerId).position.x > playerXBeforeLevelUp,
    'authoritative Hub movement before level-up',
  )
  const hubRevealReceiptPromise = observeNextPickerReveal(page, 'Hub')
  const leveled = grantGameSimulationPlayerExperience(host.state(), playerId, 300)
  Object.assign(host.state(), leveled)
  await page.keyboard.down('w')
  const picker = page.getByRole('dialog', { name: 'Level 4. Select a skill.' })
  await picker.waitFor({ timeout: 30_000 })
  await page.keyboard.up('w')
  await page.keyboard.up('d')
  await page.screenshot({ path: revealScreenshotPath })
  const presentationSamples = []
  const presentationDeadline = Date.now() + 5_000
  while (Date.now() < presentationDeadline) {
    const sample = await hubCanvas.evaluate((canvas) => ({
      dynamicSuppressed: canvas.dataset.levelUpDynamicSuppressed,
      particleCount: Number(canvas.dataset.levelUpParticleCount),
      presentationId: canvas.dataset.levelUpPresentationId,
    }))
    presentationSamples.push(sample)
    if (sample.dynamicSuppressed === 'false' && sample.particleCount > 0) break
    await page.waitForTimeout(20)
  }
  const livePresentation = presentationSamples.find((sample) => (
    sample.dynamicSuppressed === 'false' && sample.particleCount > 0
  ))
  assert.ok(livePresentation, 'Hub level-up did not render its actor-owned sparkle lane')
  assert.equal(livePresentation.presentationId, '1')
  const hubRevealReceipt = await hubRevealReceiptPromise
  const earlyRevealObserved = hubRevealReceipt.earlyRevealObserved
  const hubRevealAlphas = hubRevealReceipt.alphas
  try {
    await page.waitForFunction(() => window.__sdrAudioEvents?.some(({ playbackRate, src, type }) => (
      type === 'buffer-start'
        && src.includes('level-up')
        && playbackRate === 1
    )), undefined, { timeout: 30_000 })
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
  assert.equal(await picker.getByRole('button').first().isDisabled(), false)
  const pickerAudioReceipt = await audioLaneReceipt(page, 'academy')
  assert.equal(pickerAudioReceipt.attribute, 'false')
  assert.ok(pickerAudioReceipt.masterVolumes.length > 0)
  assert.equal(pickerAudioReceipt.masterVolumes.every(volume => volume > 0), true)
  assert.equal(pickerAudioReceipt.musicStarted, true)
  assert.equal(pickerAudioReceipt.musicPausedAfterStart, false)
  assert.equal(
    (await soundMasterVolumes(page, ['level-up', 'openpanel'])).every(volume => volume > 0),
    true,
  )

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
  assert.equal(presentationReceipt.dynamicSuppressed, 'false')
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

  const actions = picker.locator('.skill-picker-action')
  assert.equal(await actions.count(), 3)
  assert.equal(await picker.getByRole('button', { name: 'Save Skill' }).count(), 1)
  assert.equal(await picker.getByRole('button', { name: 'Roll Again' }).count(), 1)
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
  assert.equal(beforeChoice.level, 4)
  assert.equal(beforeChoice.experience, 300)
  assert.deepEqual(beforeChoice.pendingLevels, [4, 4, 4])
  assert.equal(beforeChoice.pendingOffer?.options.length, 3)
  assert.equal(beforeChoice.sorcerorsCharmAvailable, true)
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

  const pickSkillCountBeforeFocus = await soundCount(page, 'pickskill')
  await actions.nth(1).hover()
  await page.waitForFunction(() => (
    document.querySelectorAll('.skill-picker-action')[1]?.getAttribute('aria-pressed') === 'true'
  ), undefined, { timeout: 5_000 })
  await actions.nth(2).focus()
  await page.waitForFunction(() => (
    document.querySelectorAll('.skill-picker-action')[2]?.getAttribute('aria-pressed') === 'true'
  ), undefined, { timeout: 5_000 })
  await page.keyboard.press('ArrowLeft')
  await page.waitForFunction(() => (
    document.querySelectorAll('.skill-picker-action')[1]?.getAttribute('aria-pressed') === 'true'
  ), undefined, { timeout: 5_000 })
  const keyboardSelectionReceipt = await picker.evaluate((stage) => ({
    activeChoice: document.activeElement?.getAttribute('data-choice-index'),
    pressed: [...stage.querySelectorAll('.skill-picker-action')]
      .map((action) => action.getAttribute('aria-pressed')),
  }))
  assert.deepEqual(keyboardSelectionReceipt, {
    activeChoice: '1',
    pressed: ['false', 'true', 'false'],
  })
  assert.equal(await soundCount(page, 'pickskill'), pickSkillCountBeforeFocus)
  await page.screenshot({ path: screenshotPath })

  const rerollSequence = beforeChoice.pendingOffer.sequence
  const rerollRngBefore = { ...host.state().playerOfferRng }
  const summonRatesBeforeReroll = await soundRates(page, 'summon')
  const frozenHubFramesPromise = sampleHubWorldFrames(hubCanvas)
  await picker.getByRole('button', { name: 'Roll Again' }).click()
  await waitForHost(() => (
    getPlayerProgression(host.state(), playerId).pendingOffer?.sequence !== rerollSequence
  ), 'authoritative reroll')
  await page.waitForFunction((previousSequence) => {
    const stage = document.querySelector('.skill-picker-stage')
    return stage?.dataset.pickerPhase === 'settled'
      && Number(stage.dataset.offerSequence) !== previousSequence
  }, rerollSequence, { timeout: 10_000 })
  const rerolled = getPlayerProgression(host.state(), playerId)
  assert.notDeepEqual(host.state().playerOfferRng, rerollRngBefore)
  assert.equal(rerolled.sorcerorsCharmAvailable, false)
  assert.equal(await picker.getByRole('button', { name: 'Roll Again' }).count(), 0)
  assert.deepEqual(
    (await soundRates(page, 'summon')).slice(summonRatesBeforeReroll.length),
    [Math.fround(0.8)],
  )
  const frozenHubFrames = await frozenHubFramesPromise
  const frozenHubPlayerXs = frozenHubFrames.map(({ playerX }) => playerX)
  const frozenHubReceipt = {
    frameCount: new Set(frozenHubFrames.map(({ frameCount }) => frameCount)).size,
    maximumPlayerX: Math.max(...frozenHubPlayerXs),
    minimumPlayerX: Math.min(...frozenHubPlayerXs),
    ticks: [...new Set(frozenHubFrames.map(({ tick }) => tick))],
  }
  assert.ok(frozenHubReceipt.frameCount > 1)
  assert.equal(frozenHubReceipt.ticks.length, 1)
  assert.ok(
    frozenHubReceipt.maximumPlayerX - frozenHubReceipt.minimumPlayerX <= 1e-6,
    `frozen Hub player replayed movement: ${JSON.stringify(frozenHubReceipt)}`,
  )

  const selectedSkillId = rerolled.pendingOffer.options[0].skillId
  const previousRank = getPlayerSkillBook(host.state(), playerId).permanentRanks[selectedSkillId]
  const firstCloseSequence = rerolled.pendingOffer.sequence
  const firstCloseStartedAt = Date.now()
  const firstQueuedWaitReceiptPromise = observeQueuedWait(page)
  await picker.locator('.skill-picker-action').first().click()
  await waitForPickerCloseProgress(page, firstCloseSequence)
  assert.equal(await hubCanvas.getAttribute('data-level-up-dynamic-suppressed'), 'false')
  await waitForHost(() => (
    getPlayerProgression(host.state(), playerId).pendingOffer?.sequence !== firstCloseSequence
  ), 'queued offer after card selection')
  assert.deepEqual(await firstQueuedWaitReceiptPromise, {
    actionCount: 0,
    revealAlpha: '1',
  })
  await page.waitForFunction((previousSequence) => {
    const stage = document.querySelector('.skill-picker-stage')
    return stage?.dataset.pickerPhase === 'settled'
      && Number(stage.dataset.offerSequence) !== previousSequence
  }, firstCloseSequence, { timeout: 10_000 })
  assert.ok(Date.now() - firstCloseStartedAt >= 610)
  assert.equal(getPlayerSkillBook(host.state(), playerId).permanentRanks[selectedSkillId], previousRank + 1)
  assert.equal(getPlayerProgression(host.state(), playerId).sorcerorsCharmAvailable, true)
  assert.equal(await picker.getByRole('button', { name: 'Save Skill' }).count(), 1)

  const saveSequence = getPlayerProgression(host.state(), playerId).pendingOffer.sequence
  const saveCloseStartedAt = Date.now()
  const saveQueuedWaitReceiptPromise = observeQueuedWait(page)
  await picker.getByRole('button', { name: 'Save Skill' }).click()
  await waitForPickerCloseProgress(page, saveSequence)
  await waitForHost(() => (
    getPlayerProgression(host.state(), playerId).pendingOffer?.sequence !== saveSequence
  ), 'queued offer after Save Skill')
  assert.deepEqual(await saveQueuedWaitReceiptPromise, {
    actionCount: 0,
    revealAlpha: '1',
  })
  await page.waitForFunction((previousSequence) => {
    const stage = document.querySelector('.skill-picker-stage')
    return stage?.dataset.pickerPhase === 'settled'
      && Number(stage.dataset.offerSequence) !== previousSequence
  }, saveSequence, { timeout: 10_000 })
  assert.ok(Date.now() - saveCloseStartedAt >= 480)
  const saved = getPlayerProgression(host.state(), playerId)
  assert.equal(saved.deferredSkillChoices, 1)
  assert.deepEqual(saved.pendingLevels, [4])
  assert.equal(saved.sorcerorsCharmAvailable, true)

  const finalFirstScreenSequence = getPlayerProgression(host.state(), playerId).pendingOffer.sequence
  const finalFirstScreenCloseStartedAt = Date.now()
  await picker.locator('.skill-picker-action').first().click()
  await waitForPickerCloseProgress(page, finalFirstScreenSequence)
  await picker.waitFor({ state: 'detached', timeout: 15_000 })
  assert.ok(Date.now() - finalFirstScreenCloseStartedAt >= 520)
  await waitForHost(() => host.state().levelUpBarrier === null, 'first level-up barrier release')
  await page.waitForFunction(() => (
    document.querySelector('.main-menu-page')?.getAttribute('data-game-sounds-muted') === 'false'
    && window.__sdrAudioMasterVolumes?.('level-up').every(volume => volume > 0)
  ), undefined, { timeout: 5_000 })
  const releasedAudioReceipt = await audioLaneReceipt(page, 'academy')
  const afterFirstScreen = getPlayerProgression(host.state(), playerId)
  assert.equal(afterFirstScreen.pendingOffer, null)
  assert.equal(afterFirstScreen.deferredSkillChoices, 1)
  assert.equal(await initialHubCanvas.evaluate((canvas) => canvas.isConnected), true)
  assert.equal(await page.locator('.hub-world-canvas').count(), 1)
  await page.waitForFunction(() => (
    document.querySelector('.hub-world-canvas')?.dataset.levelUpDynamicSuppressed === 'false'
  ), undefined, { timeout: 5_000 })

  const playerXBeforeReleasedInput = getPlayerCharacter(host.state(), playerId).position.x
  await page.keyboard.down('d')
  await page.waitForFunction(
    ({ startX }) => document.querySelector('.hub-world-canvas')?.__sdrHubFrame.playerX > startX,
    { startX: playerXBeforeReleasedInput },
    { timeout: 5_000 },
  )
  await page.keyboard.up('d')

  const nextThreshold = grantGameSimulationPlayerExperience(host.state(), playerId, 91)
  Object.assign(host.state(), nextThreshold)
  const recoveredPicker = page.getByRole('dialog', { name: 'Level 5. Select a skill.' })
  await page.keyboard.down('a')
  await recoveredPicker.waitFor({ timeout: 15_000 })
  await page.keyboard.up('a')
  await page.waitForFunction(() => (
    document.querySelector('.skill-picker-stage')?.getAttribute('data-reveal-interactive')
      === 'true'
  ), undefined, { timeout: 15_000 })
  const recovered = getPlayerProgression(host.state(), playerId)
  assert.equal(recovered.deferredSkillChoices, 0)
  assert.deepEqual(recovered.pendingLevels, [5, 5])
  assert.equal(recovered.pendingOffer.level, 5)
  assert.equal(await recoveredPicker.getByRole('button', { name: 'Roll Again' }).count(), 1)

  const recoveredFirstSequence = recovered.pendingOffer.sequence
  await recoveredPicker.locator('.skill-picker-action').first().click()
  await page.waitForFunction((previousSequence) => {
    const stage = document.querySelector('.skill-picker-stage')
    return stage?.dataset.pickerPhase === 'settled'
      && Number(stage.dataset.offerSequence) !== previousSequence
  }, recoveredFirstSequence, { timeout: 10_000 })
  await recoveredPicker.locator('.skill-picker-action').first().click()
  await recoveredPicker.waitFor({ state: 'detached', timeout: 15_000 })
  await waitForHost(() => host.state().levelUpBarrier === null, 'recovered barrier release')

  const levelUpSoundRates = await soundRates(page, 'level-up')
  const openPanelSoundRates = await soundRates(page, 'openpanel')
  const unlockSkillSoundRates = await soundRates(page, 'unlockskill')
  assert.deepEqual(levelUpSoundRates, [1, 1])
  assert.deepEqual(openPanelSoundRates, [1, 0.75, 0.75, 0.75, 1, 0.75, 0.75])
  assert.deepEqual(unlockSkillSoundRates, [1, 1, 1])
  const pickerLifecycleMasterVolumes = await soundMasterVolumes(
    page,
    ['level-up', 'openpanel', 'pickskill', 'summon', 'unlockskill'],
  )
  assert.ok(pickerLifecycleMasterVolumes.length > 0)
  assert.equal(pickerLifecycleMasterVolumes.every(volume => volume > 0), true)

  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  const boneyardCanvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  await boneyardCanvas.waitFor({ timeout: 90_000 })
  const boneyardState = host.state()
  if (boneyardState.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const boneyardPlayer = getPlayerCharacter(boneyardState, playerId)
  const withEnemy = stepGameSimulationTick(boneyardState, {}, {
    enemySpawnIntents: [{
      enemyToken: 'SKELETON',
      flags: [],
      id: 9001,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x: boneyardPlayer.position.x + 120, y: boneyardPlayer.position.y },
      spawnTick: boneyardState.tick + 1,
      waveOrdinal: 1,
    }],
  })
  const boneyardProgression = getPlayerProgression(withEnemy, playerId)
  const boneyardLevelUp = grantGameSimulationPlayerExperience(
    withEnemy,
    playerId,
    boneyardProgression.nextThreshold - boneyardProgression.experience + 1,
  )
  assert.ok(boneyardLevelUp.levelUpBarrier, 'expected a Boneyard level-up barrier')
  assert.ok(
    getPlayerProgression(boneyardLevelUp, playerId).pendingOffer,
    'expected a Boneyard skill offer',
  )
  const boneyardRevealReceiptPromise = observeNextPickerReveal(page, 'Boneyard')
  Object.assign(host.state(), boneyardLevelUp)
  const boneyardPicker = page.getByRole('dialog', { name: /Select a skill/ })
  await page.getByRole('button', { name: /Use health potion/ }).click()
  await boneyardPicker.waitFor({ timeout: 30_000 })
  const boneyardRevealReceipt = await boneyardRevealReceiptPromise
  const boneyardEarlyRevealObserved = boneyardRevealReceipt.earlyRevealObserved
  const boneyardRevealAlphas = boneyardRevealReceipt.alphas
  const boneyardPresentationReceiptHandle = await page.waitForFunction(() => {
    const canvas = document.querySelector('.boneyard-world-canvas')
    const frame = canvas?.__sdrBoneyardFrame
    if (!canvas || !frame || frame.levelUpParticleCount <= 0) return false
    return {
      particleCount: frame.levelUpParticleCount,
      presentationId: canvas.dataset.levelUpPresentationId,
    }
  }, undefined, { timeout: 5_000 })
  const boneyardPresentationReceipt = await boneyardPresentationReceiptHandle.jsonValue()
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.boneyard-world-canvas')
    return canvas?.dataset.levelUpDynamicSuppressed === 'false'
      && Number(canvas.dataset.enemyCount) >= 1
  }, undefined, { timeout: 30_000 })
  const boneyardPickerAudioReceipt = await audioLaneReceipt(page, 'prelude')
  assert.equal(boneyardPickerAudioReceipt.attribute, 'false')
  assert.equal(boneyardPickerAudioReceipt.masterVolumes.every(volume => volume > 0), true)
  assert.equal(boneyardPickerAudioReceipt.musicStarted, true)
  assert.equal(boneyardPickerAudioReceipt.musicPausedAfterStart, false)
  const boneyardBackgroundReceipt = await boneyardCanvas.evaluate((canvas) => ({
    dynamicSuppressed: canvas.dataset.levelUpDynamicSuppressed,
    enemyCount: Number(canvas.dataset.enemyCount),
    renderer: canvas.dataset.gameRenderer,
  }))
  assert.deepEqual(boneyardBackgroundReceipt, {
    dynamicSuppressed: 'false',
    enemyCount: 1,
    renderer: 'pixi-webgl',
  })
  await page.screenshot({ path: boneyardScreenshotPath })

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  process.stdout.write(`${JSON.stringify({
    actionReceipt,
    bookedRank: getPlayerSkillBook(host.state(), playerId).permanentRanks[selectedSkillId],
    boneyardBackgroundReceipt,
    boneyardEarlyRevealObserved,
    boneyardPickerAudioReceipt,
    boneyardPresentationReceipt,
    boneyardRevealAlphas,
    boneyardScreenshotPath,
    earlyRevealObserved,
    frozenHubReceipt,
    failedResponses,
    hubRevealAlphas,
    livePresentationObserved: livePresentation !== undefined,
    openPanelSoundRates,
    pickerRenderer,
    pickerAudioReceipt,
    pickerLifecycleMasterVolumes,
    presentationReceipt,
    revealScreenshotPath,
    screenshotPath,
    selectedSkillId,
    releasedAudioReceipt,
    levelUpSoundRates,
    unlockSkillSoundRates,
  })}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    body: (await page.locator('body').innerText()).slice(0, 2_000),
    consoleErrors,
    failedResponses,
    pageErrors,
    url: page.url(),
  })}\n`)
  throw error
} finally {
  await browser.close()
  await host.close()
  await vite.close()
}

async function soundCount(page, sourceFragment) {
  return page.evaluate((fragment) => window.__sdrAudioEvents
    .filter(({ src, type }) => type === 'buffer-start' && src.includes(fragment))
    .length, sourceFragment)
}

async function soundRates(page, sourceFragment) {
  return page.evaluate((fragment) => window.__sdrAudioEvents
    .filter(({ src, type }) => type === 'buffer-start' && src.includes(fragment))
    .map(({ playbackRate }) => playbackRate), sourceFragment)
}

async function soundMasterVolumes(page, sourceFragments) {
  return page.evaluate((fragments) => window.__sdrAudioEvents
    .filter(({ src, type }) => (
      type === 'buffer-start' && fragments.some(fragment => src.includes(fragment))
    ))
    .map(({ masterVolume }) => masterVolume), sourceFragments)
}

async function audioLaneReceipt(page, musicSourceFragment) {
  return page.evaluate((fragment) => {
    const events = window.__sdrAudioEvents ?? []
    const musicStart = events.findLast(({ src, type }) => (
      type === 'started' && src.includes(fragment)
    ))
    return {
      attribute: document.querySelector('.main-menu-page')
        ?.getAttribute('data-game-sounds-muted'),
      masterVolumes: window.__sdrAudioMasterVolumes?.('level-up') ?? [],
      musicPausedAfterStart: Boolean(musicStart && events.some(event => (
        event.type === 'pause'
        && event.channelId === musicStart.channelId
        && event.at > musicStart.at
      ))),
      musicStarted: Boolean(musicStart),
    }
  }, musicSourceFragment)
}

async function sampleHubWorldFrames(canvas, count = 30) {
  return canvas.evaluate((node, requestedCount) => new Promise((resolve) => {
    const samples = []
    const sample = () => {
      const frame = node.__sdrHubFrame
      if (frame) {
        samples.push({
          frameCount: frame.frameCount,
          playerX: frame.playerX,
          tick: frame.tick,
        })
      }
      if (samples.length >= requestedCount) resolve(samples)
      else requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }), count)
}

async function waitForPickerCloseProgress(page, previousSequence) {
  await page.waitForFunction((sequence) => {
    const stage = document.querySelector('.skill-picker-stage')
    return !stage
      || stage.getAttribute('data-picker-phase') !== 'settled'
      || Number(stage.getAttribute('data-offer-sequence')) !== sequence
  }, previousSequence, { timeout: 30_000 })
}

async function observeQueuedWait(page) {
  const receipt = await page.waitForFunction(() => {
    const stage = document.querySelector('.skill-picker-stage')
    if (
      stage?.getAttribute('data-picker-phase') !== 'queued-wait'
      || stage.getAttribute('data-reveal-alpha') !== '1'
    ) return false
    return {
      actionCount: stage.querySelectorAll('.skill-picker-action').length,
      revealAlpha: stage.getAttribute('data-reveal-alpha'),
    }
  }, undefined, { timeout: 10_000 })
  return receipt.jsonValue()
}

async function observeNextPickerReveal(page, scene) {
  const receipt = await page.evaluate(() => new Promise((resolve, reject) => {
    const startedAt = performance.now()
    const alphas = []
    let earlyRevealObserved = false
    const sample = () => {
      const stage = document.querySelector('.skill-picker-stage')
      if (stage) {
        const interactive = stage.getAttribute('data-reveal-interactive') === 'true'
        if (!interactive) earlyRevealObserved = true
        const rawAlpha = stage.getAttribute('data-reveal-alpha')
        if (rawAlpha !== null) {
          const value = Number(rawAlpha)
          if (Number.isFinite(value)) alphas.push(value)
        }
        if (interactive) {
          resolve({ alphas, earlyRevealObserved })
          return
        }
      }
      if (performance.now() - startedAt >= 5_000) {
        reject(new Error('timed out observing the picker reveal'))
        return
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }))
  const { alphas, earlyRevealObserved } = receipt
  assert.equal(earlyRevealObserved, true, `${scene} picker skipped its native reveal`)
  assert.ok(alphas.length > 1, `${scene} picker did not expose a reveal envelope`)
  assert.ok(alphas[0] < 1, `${scene} picker first visible reveal was already settled`)
  assert.ok(
    alphas.some((alpha) => alpha > 0 && alpha < 1),
    `${scene} picker skipped every intermediate reveal alpha`,
  )
  assert.equal(alphas.at(-1), 1, `${scene} picker did not settle at reveal alpha one`)
  return { alphas, earlyRevealObserved }
}

async function waitForHost(predicate, label, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`timed out waiting for ${label}`)
}

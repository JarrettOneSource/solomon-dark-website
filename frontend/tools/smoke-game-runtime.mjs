import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import { NATIVE_GENERATED_BONEYARDS } from '../src/game/host/native-generated-boneyards.ts'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4181'
const CREATE_MENU_TIMEOUT_MS = 30_000
const HUB_SCENE_TIMEOUT_MS = 30_000
const expectedModBoneyard = process.env.SDR_GAME_EXPECT_MOD_BONEYARD?.trim()
const screenshotPath = process.env.SDR_GAME_SMOKE_SCREENSHOT
  || '/tmp/solomon-dark-boneyard-smoke.png'
const allyScreenshotPath = process.env.SDR_GAME_SMOKE_ALLY_SCREENSHOT
  || screenshotPath.replace(/(\.[^.]+)?$/, '-ally-hub$1')
const mobileAllyScreenshotPath = process.env.SDR_GAME_SMOKE_MOBILE_ALLY_SCREENSHOT
  || screenshotPath.replace(/(\.[^.]+)?$/, '-ally-mobile-hub$1')
const gateScreenshotPath = process.env.SDR_GAME_SMOKE_GATE_SCREENSHOT
  || screenshotPath.replace(/(\.[^.]+)?$/, '-gate-open$1')
const injectedEndpoint = process.env.SDR_GAME_SMOKE_ENDPOINT?.trim()
const injectedCredential = process.env.SDR_GAME_SMOKE_CREDENTIAL?.trim()
if (Boolean(injectedEndpoint) !== Boolean(injectedCredential)) {
  throw new Error('SDR_GAME_SMOKE_ENDPOINT and SDR_GAME_SMOKE_CREDENTIAL must be set together')
}
const runtime = injectedEndpoint && injectedCredential
  ? {
      gameEndpoint: {
        kind: new URL(injectedEndpoint).protocol === 'wss:' ? 'remote' : 'localhost',
        url: injectedEndpoint,
        credential: injectedCredential,
      },
    }
  : await provisionProductionRuntime()
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const clientPage = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const thirdPage = await browser.newPage({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 844, height: 390 },
  })
  const pageErrors = []
  const consoleErrors = []
  const clientPageErrors = []
  const clientConsoleErrors = []
  const thirdPageErrors = []
  const thirdConsoleErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  clientPage.on('pageerror', (error) => clientPageErrors.push(error.message))
  clientPage.on('console', (message) => {
    if (message.type() === 'error') clientConsoleErrors.push(message.text())
  })
  thirdPage.on('pageerror', (error) => thirdPageErrors.push(error.message))
  thirdPage.on('console', (message) => {
    if (message.type() === 'error') thirdConsoleErrors.push(message.text())
  })
  if (process.env.SDR_GAME_SMOKE_PROVE_WAVES === '1') {
    await Promise.all([
      page.addInitScript(installGameAudioSmokeProbe),
      clientPage.addInitScript(installGameAudioSmokeProbe),
    ])
  }
  if (runtime) {
    await Promise.all([
      page.addInitScript((configuration) => {
        window.solomonDarkRuntime = configuration
      }, runtime),
      clientPage.addInitScript((configuration) => {
        window.solomonDarkRuntime = configuration
      }, runtime),
      thirdPage.addInitScript((configuration) => {
        window.solomonDarkRuntime = configuration
      }, runtime),
    ])
  }

  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  try {
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  } catch (error) {
    process.stderr.write(JSON.stringify({
      body: (await page.locator('body').innerText()).slice(0, 2000),
      pageErrors,
      title: await page.title(),
      url: page.url(),
    }) + '\n')
    throw error
  }
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  try {
    await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
      timeout: CREATE_MENU_TIMEOUT_MS,
    })
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      body: (await page.locator('body').innerText()).slice(0, 2_000),
      create: await page.locator('.create-menu-scene').evaluateAll((nodes) => nodes.map((node) => ({
        finalizing: node.dataset.finalizing,
        handsReady: node.dataset.handsReady,
        motionSettled: node.dataset.motionSettled,
        phase: node.dataset.phase,
      }))),
      url: page.url(),
    })}\n`)
    throw error
  }
  await page.getByRole('button', { name: /fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()

  const scene = page.getByLabel(/College courtyard/)
  const canvas = page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]')
  try {
    await scene.waitFor({ timeout: HUB_SCENE_TIMEOUT_MS })
    await canvas.waitFor({ timeout: HUB_SCENE_TIMEOUT_MS })
    await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({
      timeout: HUB_SCENE_TIMEOUT_MS,
    })
  } catch (error) {
    process.stderr.write(JSON.stringify({
      body: (await page.locator('body').innerText()).slice(0, 2000),
      consoleErrors,
      pageErrors,
      url: page.url(),
    }) + '\n')
    throw error
  }
  const initialCanvas = await canvas.elementHandle()
  assert.ok(initialCanvas, 'expected the mounted WebGL canvas')

  const fpsCounter = page.locator('.hub-hud-fps')
  const pingCounter = page.locator('.hub-hud-ping')
  await page.waitForFunction(() => (
    /^[1-9]\d* FPS$/.test(document.querySelector('.hub-hud-fps')?.textContent?.trim() || '')
    && /^\d+ ms$/.test(document.querySelector('.hub-hud-ping')?.textContent?.trim() || '')
  ))
  const [skullBounds, fpsBounds, pingBounds] = await Promise.all([
    page.locator('.hub-hud-skull').boundingBox(),
    fpsCounter.boundingBox(),
    pingCounter.boundingBox(),
  ])
  assert.ok(skullBounds && fpsBounds && pingBounds, 'expected the skull, FPS, and ping to be visible')
  assert.ok(
    fpsBounds.x >= skullBounds.x + skullBounds.width,
    'expected the FPS counter to sit to the right of the skull',
  )
  assert.ok(
    pingBounds.x >= fpsBounds.x + fpsBounds.width,
    'expected ping to sit to the right of the FPS counter',
  )
  const hostHubPing = await pingCounter.textContent()

  const renderer = await canvas.evaluate((node) => {
    const canvas = node
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
    return {
      staticCulling: canvas.dataset.staticCulling,
      context: context ? context.constructor.name : null,
      rendererName: canvas.dataset.rendererName,
      resolution: Number(canvas.dataset.resolution),
    }
  })
  assert.ok(renderer.context?.includes('WebGL'), `expected a real WebGL context, got ${renderer.context}`)
  assert.match(renderer.rendererName || '', /webgl/i)
  assert.ok(renderer.resolution >= 0.5 && renderer.resolution <= 1.5)
  assert.equal(renderer.staticCulling, 'none')

  const before = await canvas.evaluate((node) => node.__sdrHubFrame.playerX)
  const initialTeacherFrame = await canvas.evaluate((node) => node.__sdrHubFrame.teacherFrame)
  const changedTeacherFrame = await page.waitForFunction(
    (initial) => {
      const frame = document.querySelector('.hub-world-canvas')
        ?.__sdrHubFrame.teacherFrame
      return frame !== initial ? { frame } : null
    },
    initialTeacherFrame,
    { timeout: 10_000 },
  )
  const teacherFrames = [
    initialTeacherFrame,
    (await changedTeacherFrame.jsonValue()).frame,
  ]
  await changedTeacherFrame.dispose()

  const presentationSamples = []
  await page.keyboard.down('d')
  for (let sample = 0; sample < 24; sample += 1) {
    presentationSamples.push(await canvas.evaluate((node) => ({
      astronomerRenderable: node.__sdrHubFrame.astronomerRenderable,
      cameraRenderGroupCount: node.__sdrHubFrame.cameraRenderGroupCount,
      frame: node.__sdrHubFrame.frameCount,
      playerX: node.__sdrHubFrame.playerX,
      telescopeFrame: node.__sdrHubFrame.astronomerTelescopeFrame,
      tick: node.__sdrHubFrame.tick,
      walkPose: node.__sdrHubFrame.playerWalkPose,
    })))
    await page.waitForTimeout(50)
  }
  await page.keyboard.up('d')
  await page.waitForTimeout(150)
  assert.equal(
    await initialCanvas.evaluate((node) => node.isConnected),
    true,
    'the renderer canvas must remain mounted across authoritative snapshots',
  )
  assert.equal(await page.locator('.hub-world-canvas').count(), 1)
  const finalFrame = await canvas.evaluate((node) => ({ ...node.__sdrHubFrame }))
  const after = finalFrame.playerX
  const studentCount = finalFrame.studentCount
  const orbSpriteCount = finalFrame.orbSpriteCount
  const textureSources = JSON.parse(await canvas.getAttribute('data-texture-sources'))

  assert.ok(after > before, `expected the authoritative player to move right (${before} -> ${after})`)
  assert.ok(new Set(teacherFrames).size > 1, `expected Teacher casting frames to animate (${teacherFrames.join(', ')})`)
  assert.ok(new Set(presentationSamples.map(({ walkPose }) => walkPose)).size > 1, 'expected the native five-pose robe walk selector to advance')
  assert.ok(new Set(presentationSamples.map(({ playerX }) => playerX)).size > 10, 'expected display-rate local presentation between 20 Hz snapshots')
  assert.ok(presentationSamples.at(-1).frame > presentationSamples[0].frame, 'expected the GPU renderer to keep presenting frames')
  assert.ok(presentationSamples.every(({ astronomerRenderable }) => astronomerRenderable), 'expected the animated Astronomer ensemble to remain unculled')
  assert.ok(presentationSamples.every(({ cameraRenderGroupCount }) => cameraRenderGroupCount === 3), 'expected all three Hub camera banks to remain render groups')
  assert.ok(new Set(presentationSamples.map(({ telescopeFrame }) => telescopeFrame)).size > 1, 'expected the unculled Astronomer telescope to keep animating')
  assert.ok(studentCount > 0, `expected authoritative Students, got ${studentCount}`)
  assert.ok(orbSpriteCount >= 3, `expected the native multi-sprite Fire orb, got ${orbSpriteCount}`)
  for (const element of ['air', 'earth', 'ether', 'fire', 'water']) {
    assert.ok(
      textureSources.some((source) => source.includes(`player-character-head-${element}`)),
      `expected the ${element} multiplayer appearance texture to be available`,
    )
  }

  await enterHub(clientPage, 'Earth')
  await clientPage.waitForFunction(() => /^\d+ ms$/.test(
    document.querySelector('.hub-hud-ping')?.textContent?.trim() || '',
  ))
  const clientHubPing = await clientPage.locator('.hub-hud-ping').textContent()
  assert.equal(await clientPage.getByRole('button', { name: 'Start Match' }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Start Match' }).count(), 0)
  assert.equal(await clientPage.getByRole('button', { name: 'Enter the Boneyard' }).count(), 1)

  await Promise.all([
    page.locator('.hub-hud-allies[data-ally-count="1"]').waitFor(),
    clientPage.locator('.hub-hud-allies[data-ally-count="1"]').waitFor(),
  ])
  const hostSingleAllyReceipt = await allyRosterReceipt(page)
  const clientSingleAllyReceipt = await allyRosterReceipt(clientPage)
  assert.deepEqual(hostSingleAllyReceipt.names, ['Helvidius'])
  assert.deepEqual(clientSingleAllyReceipt.names, ['Helvidius'])

  await enterHub(thirdPage, 'Water')
  await Promise.all([
    page.locator('.hub-hud-allies[data-ally-count="2"]').waitFor(),
    clientPage.locator('.hub-hud-allies[data-ally-count="2"]').waitFor(),
    thirdPage.locator('.hub-hud-allies[data-ally-count="2"]').waitFor(),
  ])
  const hostMultiAllyReceipt = await allyRosterReceipt(page)
  const thirdMobileHubAllyReceipt = await allyRosterReceipt(thirdPage)
  assert.deepEqual(hostMultiAllyReceipt.names, ['Helvidius', 'Helvidius'])
  assert.equal(hostMultiAllyReceipt.roster.x, 11)
  assert.equal(hostMultiAllyReceipt.roster.y, 62)
  assert.ok(
    hostMultiAllyReceipt.roster.y
      >= hostMultiAllyReceipt.diagnostics.y + hostMultiAllyReceipt.diagnostics.height,
  )
  for (const row of hostMultiAllyReceipt.rows) {
    assert.equal(row.bar.width, 50)
    assert.equal(row.bar.height, 5)
    assert.equal(row.fill.width, 50)
    assert.equal(row.identity.x - (row.bar.x + row.bar.width), 2)
    assert.equal(row.barColor, 'rgb(255, 128, 128)')
    assert.equal(row.identityColor, 'rgb(217, 186, 112)')
    assert.equal(row.healthRatio, '1')
    assert.ok(row.glyphCount > 0)
  }
  assert.equal(
    hostMultiAllyReceipt.rows[1].row.y - hostMultiAllyReceipt.rows[0].row.y,
    10,
  )
  await page.screenshot({ path: allyScreenshotPath })
  await thirdPage.screenshot({ path: mobileAllyScreenshotPath })

  const expectedMobileViewportScale = 390 / 900
  assert.equal(thirdMobileHubAllyReceipt.coarsePointer, true)
  assert.equal(
    thirdMobileHubAllyReceipt.presentationScale,
    2,
    JSON.stringify(thirdMobileHubAllyReceipt),
  )
  assertClose(
    thirdMobileHubAllyReceipt.viewportScale,
    expectedMobileViewportScale,
    'mobile viewport scale',
  )
  assert.deepEqual(thirdMobileHubAllyReceipt.names, ['Helvidius', 'Helvidius'])
  assertClose(
    thirdMobileHubAllyReceipt.roster.x,
    11 * expectedMobileViewportScale,
    'mobile ally roster x',
  )
  assertClose(
    thirdMobileHubAllyReceipt.roster.y,
    62 * expectedMobileViewportScale,
    'mobile ally roster y',
  )
  for (const row of thirdMobileHubAllyReceipt.rows) {
    assertClose(row.bar.width, 100 * expectedMobileViewportScale, 'mobile ally bar width')
    assertClose(row.bar.height, 10 * expectedMobileViewportScale, 'mobile ally bar height')
    assertClose(row.fill.width, 100 * expectedMobileViewportScale, 'mobile ally fill width')
    assertClose(
      row.identity.x - (row.bar.x + row.bar.width),
      4 * expectedMobileViewportScale,
      'mobile ally identity gap',
    )
    assert.equal(row.barColor, 'rgb(255, 128, 128)')
    assert.equal(row.identityColor, 'rgb(217, 186, 112)')
    assert.equal(row.healthRatio, '1')
    assert.ok(row.glyphCount > 0)
  }
  assertClose(
    thirdMobileHubAllyReceipt.rows[1].row.y
      - thirdMobileHubAllyReceipt.rows[0].row.y,
    20 * expectedMobileViewportScale,
    'mobile ally row pitch',
  )

  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  if (expectedModBoneyard) {
    const picker = page.getByRole('dialog', { name: 'Choose a Boneyard' })
    await picker.waitFor({ timeout: 15_000 })
    await picker.getByRole('button', { name: new RegExp(expectedModBoneyard, 'i') }).click()
  } else {
    assert.equal(await page.getByRole('dialog', { name: 'Choose a Boneyard' }).count(), 0)
  }

  const hostBoneyard = page.locator('.boneyard-scene')
  const clientBoneyard = clientPage.locator('.boneyard-scene')
  const thirdBoneyard = thirdPage.locator('.boneyard-scene')
  await Promise.all([
    hostBoneyard.waitFor({ timeout: 30_000 }),
    clientBoneyard.waitFor({ timeout: 30_000 }),
    thirdBoneyard.waitFor({ timeout: 30_000 }),
    page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 }),
    clientPage.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 }),
    thirdPage.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 }),
  ])
  const [hostReceipt, clientReceipt] = await Promise.all([
    boneyardReceipt(hostBoneyard),
    boneyardReceipt(clientBoneyard),
  ])
  const thirdMobileBoneyardAllyReceipt = await allyRosterReceipt(thirdPage)
  assert.deepEqual(thirdMobileBoneyardAllyReceipt.names, thirdMobileHubAllyReceipt.names)
  assert.deepEqual(thirdMobileBoneyardAllyReceipt.rowIds, thirdMobileHubAllyReceipt.rowIds)
  assert.equal(thirdMobileBoneyardAllyReceipt.presentationScale, 2)
  assertClose(
    thirdMobileBoneyardAllyReceipt.rows[0].bar.width,
    100 * expectedMobileViewportScale,
    'mobile Boneyard ally bar width',
  )

  await thirdPage.close()
  await Promise.all([
    page.locator('.hub-hud-allies[data-ally-count="1"]').waitFor(),
    clientPage.locator('.hub-hud-allies[data-ally-count="1"]').waitFor(),
  ])
  const [hostBoneyardAllyReceipt, clientBoneyardAllyReceipt] = await Promise.all([
    allyRosterReceipt(page),
    allyRosterReceipt(clientPage),
  ])
  assert.deepEqual(hostBoneyardAllyReceipt.names, hostSingleAllyReceipt.names)
  assert.deepEqual(clientBoneyardAllyReceipt.names, clientSingleAllyReceipt.names)
  assert.deepEqual(hostBoneyardAllyReceipt.rowIds, hostSingleAllyReceipt.rowIds)
  assert.deepEqual(clientBoneyardAllyReceipt.rowIds, clientSingleAllyReceipt.rowIds)
  const [hostPainterReceipt, clientPainterReceipt] = await Promise.all([
    boneyardPainterReceipt(page),
    boneyardPainterReceipt(clientPage),
  ])
  assert.equal(hostReceipt.runId, clientReceipt.runId)
  assert.equal(hostReceipt.geometrySha256, clientReceipt.geometrySha256)
  assert.equal(hostReceipt.boneyardId, clientReceipt.boneyardId)
  assert.equal(hostReceipt.gateLeafCount, clientReceipt.gateLeafCount)
  if (expectedModBoneyard) {
    assert.match(await hostBoneyard.getAttribute('aria-label') || '', new RegExp(expectedModBoneyard, 'i'))
  } else {
    assert.equal(hostReceipt.boneyardId, 'default-random')
    assert.ok(hostReceipt.gateLeafCount >= 2)
  }

  const boneyardPings = []
  for (const runPage of [page, clientPage]) {
    const boneyardCanvas = runPage.locator(
      '.boneyard-world-canvas[data-game-renderer="pixi-webgl"]',
    )
    assert.equal(await boneyardCanvas.count(), 1)
    const rendererReceipt = await boneyardCanvas.evaluate((canvas) => {
      const diagnostics = canvas.__sdrBoneyardFrame
      return {
        cameraRenderGroup: diagnostics?.cameraRenderGroup,
        culledResidentCount: diagnostics?.culledResidentCount,
        frameCount: diagnostics?.frameCount,
        residentCount: diagnostics?.residentCount,
        staticPaintCount: diagnostics?.staticPaintCount,
        visibleMainLayerCount: diagnostics?.visibleMainLayerCount,
        visibleOversizedResidentCount: diagnostics?.visibleOversizedResidentCount,
        visibleResidentCount: diagnostics?.visibleResidentCount,
      }
    })
    assert.equal(rendererReceipt.cameraRenderGroup, true)
    assert.ok(rendererReceipt.frameCount > 0)
    assert.ok(rendererReceipt.residentCount > 0)
    assert.ok(rendererReceipt.staticPaintCount > 0)
    assert.ok(rendererReceipt.visibleResidentCount > 0)
    assert.equal(
      rendererReceipt.visibleResidentCount + rendererReceipt.culledResidentCount,
      rendererReceipt.residentCount,
    )
    await runPage.waitForFunction(() => /^[1-9]\d* FPS$/.test(
      document.querySelector('.hub-hud-fps')?.textContent?.trim() || '',
    ))
    assert.match((await runPage.locator('.hub-hud-fps').textContent()) || '', /^[1-9]\d* FPS$/)
    await runPage.waitForFunction(() => /^\d+ ms$/.test(
      document.querySelector('.hub-hud-ping')?.textContent?.trim() || '',
    ))
    assert.match((await runPage.locator('.hub-hud-ping').textContent()) || '', /^\d+ ms$/)
    boneyardPings.push(await runPage.locator('.hub-hud-ping').textContent())
    assert.equal(await runPage.getByRole('img', { name: 'Help' }).count(), 0)
    assert.equal(await runPage.getByLabel('Equipped spells').count(), 0)
    assert.equal(await runPage.getByRole('button', { name: 'Enter the Boneyard' }).count(), 0)
    assert.equal(await runPage.getByLabel('Inventory shortcuts').count(), 1)
    const scene = runPage.locator('.boneyard-scene')
    const environmentMode = await scene.getAttribute('data-environment-mode')
    assert.equal(await scene.getAttribute('data-camera-zoom'), '1.35')
    assert.equal(
      await runPage.locator('.boneyard-darkness[data-native-mask="DeadHawg:18+9"]').count(),
      environmentMode === '1' || environmentMode === '2' ? 1 : 0,
    )
    if (environmentMode === '1' || environmentMode === '2') {
      const darkness = runPage.locator('.boneyard-darkness')
      assert.equal(await darkness.getAttribute('data-max-alpha'), '0.96')
      const pixels = await sampleDarknessPixels(runPage)
      assert.ok(pixels.centerAlpha < 16, `expected a clear player aperture, got alpha ${pixels.centerAlpha}`)
      assert.ok(
        pixels.farAlpha >= 244 && pixels.farAlpha <= 246,
        `expected the native ambient floor at alpha 245, got ${pixels.farAlpha}`,
      )
    }
  }

  const hostDigCount = await page.getByRole('img', { name: 'Solomon Dig' }).count()
  const clientDigCount = await clientPage.getByRole('img', { name: 'Solomon Dig' }).count()
  assert.equal(hostDigCount, clientDigCount)
  if (!expectedModBoneyard) assert.equal(hostDigCount, 1)
  const hostDigFrames = hostDigCount ? await sampleDigFrames(page) : []
  const clientDigFrames = clientDigCount ? await sampleDigFrames(clientPage) : []
  let digIndicatorReceipt = null
  let solomonPlacementReceipts = null
  if (hostDigCount) {
    assert.ok(new Set(hostDigFrames).size > 1, `expected host Solomon Dig to animate (${hostDigFrames.join(', ')})`)
    assert.ok(new Set(clientDigFrames).size > 1, `expected client Solomon Dig to animate (${clientDigFrames.join(', ')})`)
    for (const runPage of [page, clientPage]) {
      assert.equal(await runPage.locator('.boneyard-grave-dirt').count(), 1)
      assert.equal(await runPage.locator('.boneyard-lantern').count(), 1)
      await assertSolomonSetPieceRoots(runPage)
    }
    if (!expectedModBoneyard) {
      solomonPlacementReceipts = await Promise.all([
        stockSolomonPlacementReceipt(page),
        stockSolomonPlacementReceipt(clientPage),
      ])
      for (const receipt of solomonPlacementReceipts) {
        assert.ok(receipt.candidateCount >= 9 && receipt.candidateCount <= 14)
        assert.equal(receipt.selectedIndex, receipt.nearestIndex)
      }
      assert.deepEqual(solomonPlacementReceipts[0], solomonPlacementReceipts[1])
    }

    const hostIndicator = page.getByRole('img', { name: 'Direction to Solomon Dig' })
    const clientIndicator = clientPage.getByRole('img', { name: 'Direction to Solomon Dig' })
    assert.equal(await hostIndicator.count(), 0)
    assert.equal(await clientIndicator.count(), 0)
    assert.match(await hostBoneyard.getAttribute('aria-label') || '', /Press H to toggle/)

    await page.bringToFront()
    await page.keyboard.down('h')
    await hostIndicator.waitFor({ state: 'visible' })
    assert.equal(await hostIndicator.getAttribute('data-hotkey'), 'H')
    assert.equal(await clientIndicator.count(), 0)

    await page.keyboard.down('h')
    await page.waitForTimeout(100)
    assert.equal(await hostIndicator.count(), 1, 'a repeated keydown must not retrigger the toggle')
    await page.keyboard.up('h')

    await page.setViewportSize({ width: 1_280, height: 800 })
    await page.locator('.boneyard-scene[data-viewport-height="1000"]').waitFor()
    digIndicatorReceipt = await solomonDigIndicatorReceipt(page)
    assert.ok(digIndicatorReceipt.headingDot > 0)
    assert.equal(digIndicatorReceipt.viewportWidth, 1_600)
    assert.equal(digIndicatorReceipt.viewportHeight, 1_000)
    assert.ok(
      digIndicatorReceipt.x >= 64
      && digIndicatorReceipt.x <= digIndicatorReceipt.viewportWidth - 64,
    )
    assert.ok(
      digIndicatorReceipt.y >= 88
      && digIndicatorReceipt.y <= digIndicatorReceipt.viewportHeight - 120,
    )
    await page.screenshot({ path: screenshotPath })

    await page.keyboard.press('h')
    await page.waitForFunction(() => !document.querySelector('.boneyard-dig-indicator'))
    assert.equal(await clientIndicator.count(), 0)
    await page.setViewportSize({ width: 1_600, height: 900 })
    await page.locator('.boneyard-scene[data-viewport-height="900"]').waitFor()
  } else {
    await page.screenshot({ path: screenshotPath })
  }

  let encounterReceipt = null
  let gateCrossing = null
  if (!expectedModBoneyard) {
    gateCrossing = await crossEntryGate(page, clientPage)
    await page.screenshot({ path: gateScreenshotPath })
    if (process.env.SDR_GAME_SMOKE_PROVE_WAVES === '1') {
      encounterReceipt = await proveSolomonEncounter(
        page,
        clientPage,
        process.env.SDR_GAME_SMOKE_ENCOUNTER_SCREENSHOT
          || gateScreenshotPath.replace(/(\.[^.]+)?$/, '-solomon-waves$1'),
      )
    }
  }

  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(clientConsoleErrors, [])
  assert.deepEqual(clientPageErrors, [])
  assert.deepEqual(thirdConsoleErrors, [])
  assert.deepEqual(thirdPageErrors, [])
  process.stdout.write(JSON.stringify({
    status: 'ok',
    before,
    after,
    allyScreenshotPath,
    boneyardPings,
    clientBoneyardAllyReceipt,
    clientHubPing,
    clientSingleAllyReceipt,
    consoleErrors,
    pageErrors,
    clientConsoleErrors,
    clientPageErrors,
    clientDigFrames: [...new Set(clientDigFrames)],
    digIndicatorReceipt,
    hostDigFrames: [...new Set(hostDigFrames)],
    hostBoneyardAllyReceipt,
    hostMultiAllyReceipt,
    hostReceipt,
    hostHubPing,
    hostSingleAllyReceipt,
    hostPainterReceipt,
    clientPainterReceipt,
    mobileAllyScreenshotPath,
    encounterReceipt,
    gateCrossing,
    gateScreenshotPath: gateCrossing ? gateScreenshotPath : null,
    screenshotPath,
    orbSpriteCount,
    renderer,
    smoothPlayerSamples: new Set(presentationSamples.map(({ playerX }) => playerX)).size,
    solomonPlacementReceipts,
    studentCount,
    teacherFrames: [...new Set(teacherFrames)],
    thirdConsoleErrors,
    thirdMobileBoneyardAllyReceipt,
    thirdMobileHubAllyReceipt,
    thirdPageErrors,
    walkPoses: [...new Set(presentationSamples.map(({ walkPose }) => walkPose))],
  }) + '\n')
} finally {
  await browser.close()
}

function assertClose(actual, expected, label, epsilon = 0.05) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${label}: expected ${expected}, received ${actual}`,
  )
}
async function provisionProductionRuntime() {
  const origin = new URL(baseUrl)
  if (origin.protocol !== 'https:') return null

  const response = await fetch(new URL('/api/game/sessions', origin), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'x-solomon-dark-session': 'provision',
    },
  })
  const payload = await response.json()
  assert.equal(response.status, 200, JSON.stringify(payload))
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(payload.kind, 'remote')
  assert.equal(new URL(payload.url).protocol, 'wss:')
  assert.equal(typeof payload.credential, 'string')
  return { gameEndpoint: payload }
}

async function enterHub(page, element) {
  await page.bringToFront()
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  try {
    await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
      timeout: CREATE_MENU_TIMEOUT_MS,
    })
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      body: (await page.locator('body').innerText()).slice(0, 2_000),
      create: await page.locator('.create-menu-scene').evaluateAll((nodes) => nodes.map((node) => ({
        finalizing: node.dataset.finalizing,
        handsReady: node.dataset.handsReady,
        motionSettled: node.dataset.motionSettled,
        phase: node.dataset.phase,
      }))),
      url: page.url(),
    })}\n`)
    throw error
  }
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.getByLabel(/College courtyard/).waitFor({ timeout: HUB_SCENE_TIMEOUT_MS })
}

async function allyRosterReceipt(page) {
  return page.locator('.hub-hud-allies').evaluate((roster) => {
    const requireElement = (value, label) => {
      if (!(value instanceof Element)) throw new Error(`Expected ${label}`)
      return value
    }
    const bounds = (node) => {
      const rect = node.getBoundingClientRect()
      return {
        height: rect.height,
        width: rect.width,
        x: rect.x,
        y: rect.y,
      }
    }
    const rows = [...roster.querySelectorAll('.hub-hud-ally-row')]
    const skull = requireElement(document.querySelector('.hub-hud-skull'), 'HUD skull')
    const scene = requireElement(
      document.querySelector('.hub-scene, .boneyard-scene'),
      'gameplay scene',
    )
    const diagnostics = requireElement(
      document.querySelector('.hub-hud-diagnostics'),
      'HUD diagnostics',
    )
    const transform = getComputedStyle(roster).transform
    return {
      coarsePointer: matchMedia('(hover: none) and (pointer: coarse)').matches,
      diagnostics: bounds(diagnostics),
      names: rows.map((row) => row.getAttribute('aria-label')),
      presentationScale: transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a,
      roster: bounds(roster),
      rowIds: rows.map((row) => row.getAttribute('data-ally-id')),
      rows: rows.map((row) => {
        const bar = requireElement(row.querySelector('.hub-hud-ally-bar'), 'ally health bar')
        const fill = requireElement(
          row.querySelector('.hub-hud-ally-bar-fill'),
          'ally health fill',
        )
        const identity = requireElement(
          row.querySelector('.hub-hud-ally-identity'),
          'ally identity lane',
        )
        const glyph = requireElement(
          row.querySelector('.hub-hud-ally-glyph, .hub-hud-ally-golem'),
          'ally identity glyph',
        )
        return {
          bar: bounds(bar),
          barColor: getComputedStyle(fill).backgroundColor,
          fill: bounds(fill),
          glyphCount: identity.children.length,
          healthRatio: row.getAttribute('data-health-ratio'),
          identity: bounds(identity),
          identityColor: getComputedStyle(glyph).backgroundColor,
          row: bounds(row),
        }
      }),
      skull: bounds(skull),
      viewportScale: Number(scene.getAttribute('data-viewport-scale')),
    }
  })
}

async function boneyardReceipt(locator) {
  return {
    boneyardId: await locator.getAttribute('data-boneyard-id'),
    environmentMode: await locator.getAttribute('data-environment-mode'),
    gateLeafCount: Number(await locator.getAttribute('data-gate-leaf-count')),
    geometrySha256: await locator.getAttribute('data-geometry-sha256'),
    runId: await locator.getAttribute('data-run-id'),
  }
}

async function boneyardPainterReceipt(page) {
  const receipt = await page.evaluate(() => {
    const scene = document.querySelector('.boneyard-scene')
    const canvas = scene?.querySelector('.boneyard-world-canvas')
    const diagnostics = canvas?.__sdrBoneyardFrame

    return {
      bandCount: diagnostics?.painterBandCount,
      foregroundZIndex: diagnostics?.foregroundZIndex,
      lanternLightIntensity: diagnostics?.lanternLightIntensity,
      lightSourceCount: diagnostics?.lightSourceCount,
      localPlayerRow: diagnostics?.localPlayerPainterRow,
      localPlayerZIndex: diagnostics?.localPlayerZIndex,
      mainAboveLocal: diagnostics?.mainAboveLocal,
      mainBelowLocal: diagnostics?.mainBelowLocal,
      maxDynamicZIndex: diagnostics?.maxDynamicZIndex,
      maxMainLightScalar: diagnostics?.maxMainLightScalar,
      maxMainZIndex: diagnostics?.maxMainZIndex,
      minMainLightScalar: diagnostics?.minMainLightScalar,
      regionLightComposite: canvas?.getAttribute('data-region-light-composite'),
      regionLightCompositeZIndex: diagnostics?.regionLightCompositeZIndex,
      regionLightEntry: canvas?.getAttribute('data-region-light-entry'),
      regionLighting: canvas?.getAttribute('data-region-lighting'),
      renderer: canvas?.getAttribute('data-game-renderer'),
      sceneBandCount: Number(scene?.getAttribute('data-painter-band-count')),
      staticLayerCount: diagnostics?.staticLayerCount,
      cameraRenderGroup: diagnostics?.cameraRenderGroup,
      culledResidentCount: diagnostics?.culledResidentCount,
      residentCount: diagnostics?.residentCount,
      visibleMainLayerCount: diagnostics?.visibleMainLayerCount,
      visibleOversizedResidentCount: diagnostics?.visibleOversizedResidentCount,
      visibleResidentCount: diagnostics?.visibleResidentCount,
    }
  })
  assert.equal(receipt.cameraRenderGroup, true)
  assert.equal(receipt.renderer, 'pixi-webgl')
  assert.equal(receipt.regionLighting, 'native-region-field+object-scalar')
  assert.equal(receipt.regionLightComposite, 'multiply-pre-main')
  assert.equal(receipt.regionLightEntry, 'DeadHawg:18')
  assert.ok(receipt.regionLightCompositeZIndex > 0)
  assert.ok(receipt.regionLightCompositeZIndex < receipt.localPlayerZIndex)
  assert.equal(receipt.sceneBandCount, receipt.bandCount)
  assert.ok(receipt.bandCount >= 2, 'expected scenery bands on both sides of live actors')
  assert.ok(receipt.staticLayerCount > 0)
  assert.ok(receipt.residentCount > 0)
  assert.ok(receipt.visibleResidentCount > 0)
  assert.equal(receipt.visibleResidentCount + receipt.culledResidentCount, receipt.residentCount)
  assert.equal(receipt.localPlayerRow, 0)
  assert.equal(receipt.mainBelowLocal, true)
  assert.equal(receipt.mainAboveLocal, true)
  assert.ok(receipt.lightSourceCount >= 1)
  assert.ok(receipt.minMainLightScalar >= 0)
  assert.ok(receipt.maxMainLightScalar <= 1)
  assert.ok(receipt.minMainLightScalar <= receipt.maxMainLightScalar)
  assert.ok(receipt.foregroundZIndex > receipt.maxDynamicZIndex)
  assert.ok(receipt.foregroundZIndex > receipt.maxMainZIndex)
  return receipt
}

async function crossEntryGate(hostPage, clientPage) {
  const scene = hostPage.locator('.boneyard-scene')
  const clientScene = clientPage.locator('.boneyard-scene')
  const gate = await alignWithEntryGate(hostPage, scene)
  const initialY = Number(await scene.getAttribute('data-local-player-y'))
  const initialGateState = await scene.getAttribute('data-gate-state')
  const initialClientGateState = await clientScene.getAttribute('data-gate-state')
  const direction = Math.sign(gate.targetY - initialY)
  assert.notEqual(direction, 0, 'expected the entry gate to be beyond the player')
  const key = direction < 0 ? 'w' : 's'
  const crossingDistance = Math.abs(gate.targetY - initialY) + 35
  await hostPage.bringToFront()
  await hostPage.keyboard.down(key)
  try {
    await hostPage.waitForFunction(
      ({ crossingDistance, direction, initialY }) => {
        const value = Number(document.querySelector('.boneyard-scene')
          ?.getAttribute('data-local-player-y'))
        return Number.isFinite(value)
          && (value - initialY) * direction > crossingDistance
      },
      { crossingDistance, direction, initialY },
      { timeout: 8_000 },
    )
  } finally {
    await hostPage.keyboard.up(key)
  }
  const finalY = Number(await scene.getAttribute('data-local-player-y'))
  await hostPage.waitForTimeout(1_500)
  const finalGateState = await scene.getAttribute('data-gate-state')
  assert.ok((finalY - initialY) * direction > crossingDistance)
  assert.notEqual(finalGateState, initialGateState)

  await clientPage.bringToFront()
  await clientPage.waitForFunction(
    (initial) => document.querySelector('.boneyard-scene')
      ?.getAttribute('data-gate-state') !== initial,
    initialClientGateState,
    { timeout: 5_000 },
  )
  return { alignedX: gate.playerX, direction, finalY, initialY, targetY: gate.targetY }
}

async function proveSolomonEncounter(hostPage, clientPage, wavesScreenshotPath) {
  const hostScene = hostPage.locator('.boneyard-scene')
  const clientScene = clientPage.locator('.boneyard-scene')
  const initial = await solomonEncounterReceipt(hostScene)
  assert.equal(initial.phase, 'digging')
  assert.equal(initial.wavePhase, 'dormant')
  assert.equal(initial.liveEnemies, 0)

  const approach = await walkToSolomon(hostPage, hostScene)
  assert.notEqual(approach.phase, 'digging')

  await Promise.all([
    hostPage.waitForFunction(() => (
      Number(document.querySelector('.boneyard-scene')
        ?.getAttribute('data-solomon-voice-event-id')) >= 1
    ), undefined, { timeout: 15_000 }),
    clientPage.waitForFunction(() => (
      Number(document.querySelector('.boneyard-scene')
        ?.getAttribute('data-solomon-voice-event-id')) >= 1
    ), undefined, { timeout: 15_000 }),
  ])
  const [hostHello, clientHello] = await Promise.all([
    solomonEncounterReceipt(hostScene),
    solomonEncounterReceipt(clientScene),
  ])
  assert.equal(hostHello.phase, 'speaking')
  assert.match(hostHello.voiceCue, /^solomon-hello-[1-4]$/)
  assert.equal(clientHello.voiceCue, hostHello.voiceCue)

  const mouthPoses = []
  const headings = []
  for (let sample = 0; sample < 20; sample += 1) {
    const current = await solomonEncounterReceipt(hostScene)
    mouthPoses.push(current.mouthPose)
    headings.push(current.heading)
    await hostPage.waitForTimeout(100)
  }
  assert.ok(new Set(mouthPoses).size > 1, `expected speaking mouth animation (${mouthPoses.join(', ')})`)

  await Promise.all([
    hostPage.waitForFunction(() => (
      Number(document.querySelector('.boneyard-scene')
        ?.getAttribute('data-solomon-run-event-id')) === 1
    ), undefined, { timeout: 15_000 }),
    clientPage.waitForFunction(() => (
      Number(document.querySelector('.boneyard-scene')
        ?.getAttribute('data-solomon-run-event-id')) === 1
    ), undefined, { timeout: 15_000 }),
  ])
  await hostPage.waitForFunction(() => {
    const scene = document.querySelector('.boneyard-scene')
    return Number(scene?.getAttribute('data-wave-live-enemy-count')) >= 10
      && window.__sdrAudioPlaySources?.some((source) => source.includes('solomon-laugh-1'))
  }, undefined, { timeout: 5_000 })
  const [hostOpening, clientOpening] = await Promise.all([
    solomonEncounterReceipt(hostScene),
    solomonEncounterReceipt(clientScene),
  ])
  assert.equal(hostOpening.phase, 'escaping')
  assert.equal(hostOpening.voiceCue, 'solomon-laugh-1')
  assert.equal(hostOpening.wavePhase, 'opening')
  assert.equal(hostOpening.liveEnemies, 10)
  assert.equal(hostOpening.pendingSpawnBudget, 5)
  assert.equal(hostOpening.waveOrdinal, 0)
  assert.equal(clientOpening.liveEnemies, hostOpening.liveEnemies)
  assert.equal(clientOpening.runEventId, hostOpening.runEventId)
  await hostPage.screenshot({ path: wavesScreenshotPath })

  await Promise.all([
    hostPage.waitForFunction(() => (
      Number(document.querySelector('.boneyard-scene')
        ?.getAttribute('data-solomon-voice-event-id')) === 3
      && window.__sdrAudioPlaySources?.some(
        (source) => source.includes('solomon-get-him-boys'),
      )
    ), undefined, { timeout: 5_000 }),
    clientPage.waitForFunction(() => (
      Number(document.querySelector('.boneyard-scene')
        ?.getAttribute('data-solomon-voice-event-id')) === 3
    ), undefined, { timeout: 5_000 }),
  ])
  const hostTaunt = await solomonEncounterReceipt(hostScene)
  assert.equal(hostTaunt.voiceCue, 'solomon-get-him-boys')
  assert.equal(hostTaunt.liveEnemies, 10)

  const audioPlaySources = await hostPage.evaluate(() => (
    [...new Set(window.__sdrAudioPlaySources ?? [])]
  ))
  assert.ok(audioPlaySources.some((source) => source.includes(hostHello.voiceCue)))
  assert.ok(audioPlaySources.some((source) => source.includes('solomon-laugh-1')))
  assert.ok(audioPlaySources.some((source) => source.includes('solomon-get-him-boys')))
  return {
    approach,
    audioPlaySources,
    clientHello,
    clientOpening,
    headings: [...new Set(headings)],
    hostHello,
    hostOpening,
    hostTaunt,
    mouthPoses: [...new Set(mouthPoses)],
  }
}

async function walkToSolomon(page, scene) {
  await page.bringToFront()
  await scene.focus()
  const startedAt = Date.now()
  const samples = []
  let stalledSteps = 0
  let wallFollow = null

  while (Date.now() - startedAt < 120_000) {
    const before = await solomonApproachReceipt(scene)
    samples.push(before)
    if (before.phase !== 'digging') {
      return {
        contactPosition: { x: before.playerX, y: before.playerY },
        phase: before.phase,
        samples: samples.length,
        startPosition: { x: samples[0].playerX, y: samples[0].playerY },
      }
    }

    const dx = before.solomonX - before.playerX
    const dy = before.solomonY - before.playerY
    let movement = { x: dx, y: dy }
    if (wallFollow) {
      movement = {
        x: dx * 0.25 - dy * wallFollow.sign,
        y: dy * 0.25 + dx * wallFollow.sign,
      }
      wallFollow.steps += 1
    }
    await pulseMovement(page, movementKeys(movement), 150)

    const after = await solomonApproachReceipt(scene)
    if (after.phase !== 'digging') continue
    if (wallFollow && after.distance < wallFollow.blockedDistance - 30) {
      wallFollow = null
      stalledSteps = 0
    } else if (wallFollow?.steps >= 50) {
      wallFollow = {
        blockedDistance: after.distance,
        sign: -wallFollow.sign,
        steps: 0,
      }
    } else if (!wallFollow && after.distance < before.distance - 1) {
      stalledSteps = 0
    } else if (!wallFollow) {
      stalledSteps += 1
      if (stalledSteps >= 4) {
        wallFollow = {
          blockedDistance: after.distance,
          sign: 1,
          steps: 0,
        }
        stalledSteps = 0
      }
    }
  }
  throw new Error(`could not walk to Solomon: ${JSON.stringify(samples.at(-1))}`)
}

async function pulseMovement(page, keys, durationMs) {
  for (const key of keys) await page.keyboard.down(key)
  try {
    await page.waitForTimeout(durationMs)
  } finally {
    for (const key of keys.reverse()) await page.keyboard.up(key)
  }
}

function movementKeys({ x, y }) {
  const keys = []
  const scale = Math.max(Math.abs(x), Math.abs(y), 1)
  if (Math.abs(x) / scale >= 0.25) keys.push(x > 0 ? 'd' : 'a')
  if (Math.abs(y) / scale >= 0.25) keys.push(y > 0 ? 's' : 'w')
  return keys
}

async function solomonApproachReceipt(scene) {
  return scene.evaluate((node) => {
    const playerX = Number(node.getAttribute('data-local-player-x'))
    const playerY = Number(node.getAttribute('data-local-player-y'))
    const solomonX = Number(node.getAttribute('data-solomon-x'))
    const solomonY = Number(node.getAttribute('data-solomon-y'))
    return {
      distance: Math.hypot(solomonX - playerX, solomonY - playerY),
      phase: node.getAttribute('data-solomon-phase'),
      playerX,
      playerY,
      solomonX,
      solomonY,
    }
  })
}

async function solomonEncounterReceipt(scene) {
  return scene.evaluate((node) => ({
    heading: Number(node.getAttribute('data-solomon-heading')),
    liveEnemies: Number(node.getAttribute('data-wave-live-enemy-count')),
    mouthPose: Number(node.getAttribute('data-solomon-mouth-pose')),
    pendingSpawnBudget: Number(node.getAttribute('data-wave-pending-spawn-budget')),
    phase: node.getAttribute('data-solomon-phase'),
    runEventId: Number(node.getAttribute('data-solomon-run-event-id')),
    voiceCue: node.getAttribute('data-solomon-voice-cue'),
    voiceEventId: Number(node.getAttribute('data-solomon-voice-event-id')),
    waveOrdinal: Number(node.getAttribute('data-wave-ordinal')),
    wavePhase: node.getAttribute('data-wave-phase'),
    waveScheduleIndex: Number(node.getAttribute('data-wave-schedule-index')),
    waveSpawnDelayTicks: Number(node.getAttribute('data-wave-spawn-delay-ticks')),
  }))
}

async function alignWithEntryGate(page, scene) {
  const initialX = Number(await scene.getAttribute('data-local-player-x'))
  const initialY = Number(await scene.getAttribute('data-local-player-y'))
  const gateState = await scene.getAttribute('data-gate-state')
  const gates = new Map()
  for (const serialized of gateState?.split('|') || []) {
    const separator = serialized.lastIndexOf(':')
    if (separator < 0) continue
    const id = serialized.slice(0, separator)
    const [x, y] = serialized.slice(separator + 1).split(',').map(Number)
    const gateId = id.slice(0, id.lastIndexOf(':'))
    if (!Number.isFinite(x) || !Number.isFinite(y) || !gateId) continue
    const tips = gates.get(gateId) || []
    tips.push({ x, y })
    gates.set(gateId, tips)
  }
  const centers = [...gates.values()]
    .filter((tips) => tips.length === 2)
    .map((tips) => ({
      x: (tips[0].x + tips[1].x) / 2,
      y: (tips[0].y + tips[1].y) / 2,
    }))
  assert.ok(centers.length > 0, `expected an entry gate in ${gateState}`)
  const target = centers.reduce((nearest, center) => (
    Math.hypot(center.x - initialX, center.y - initialY)
      < Math.hypot(nearest.x - initialX, nearest.y - initialY)
      ? center
      : nearest
  ))
  const targetX = target.x
  const delta = targetX - initialX
  if (Math.abs(delta) <= 3) return { playerX: initialX, targetX, targetY: target.y }
  const direction = Math.sign(delta)
  const key = direction > 0 ? 'd' : 'a'
  await page.keyboard.down(key)
  try {
    await page.waitForFunction(
      ({ direction, initialX, targetX }) => {
        const value = Number(document.querySelector('.boneyard-scene')
          ?.getAttribute('data-local-player-x'))
        return Number.isFinite(value)
          && (value - initialX) * direction >= Math.abs(targetX - initialX) - 3
      },
      { direction, initialX, targetX },
      { timeout: 3_000 },
    )
  } finally {
    await page.keyboard.up(key)
  }
  return {
    playerX: Number(await scene.getAttribute('data-local-player-x')),
    targetX,
    targetY: target.y,
  }
}

async function sampleDigFrames(page) {
  const dig = page.getByRole('img', { name: 'Solomon Dig' })
  const frames = []
  for (let sample = 0; sample < 12; sample += 1) {
    frames.push(await dig.getAttribute('data-frame'))
    await page.waitForTimeout(60)
  }
  return frames
}

async function assertSolomonSetPieceRoots(page) {
  const roots = await page.evaluate(() => {
    const point = (selector) => {
      const element = document.querySelector(selector)
      return {
        x: Number(element?.getAttribute('data-world-x')),
        y: Number(element?.getAttribute('data-world-y')),
      }
    }
    return {
      dig: point('.boneyard-dig-anchor'),
      grave: point('.boneyard-grave-dirt'),
      lantern: point('.boneyard-lantern'),
    }
  })
  assert.deepEqual(roots.dig, {
    x: roots.grave.x + 10,
    y: roots.grave.y + 113,
  })
  assert.deepEqual(roots.lantern, {
    x: roots.grave.x - 55,
    y: roots.grave.y + 73,
  })
}

async function stockSolomonPlacementReceipt(page) {
  const observed = await page.evaluate(() => {
    const scene = document.querySelector('.boneyard-scene')
    const grave = document.querySelector('.boneyard-grave-dirt')
    return {
      geometrySha256: scene?.getAttribute('data-geometry-sha256'),
      selected: {
        x: Number(grave?.getAttribute('data-world-x')),
        y: Number(grave?.getAttribute('data-world-y')),
      },
    }
  })
  const template = NATIVE_GENERATED_BONEYARDS.find((entry) => (
    entry.geometrySha256 === observed.geometrySha256
  ))
  if (!template) throw new Error(`No native template for geometry ${observed.geometrySha256}`)
  const candidates = template.scene.objects.filter((object) => (
    object.typeId === 2029 && object.overlayVariant === 8
  ))
  const distance = (candidate) => (
    (candidate.pos.x - template.scene.spawn.x) ** 2
    + (candidate.pos.y - template.scene.spawn.y) ** 2
  )
  let nearestIndex = 0
  for (let index = 1; index < candidates.length; index += 1) {
    if (distance(candidates[index]) < distance(candidates[nearestIndex])) {
      nearestIndex = index
    }
  }
  const selectedIndex = candidates.findIndex((candidate) => (
    candidate.pos.x === observed.selected.x && candidate.pos.y === observed.selected.y
  ))
  return {
    candidateCount: candidates.length,
    geometrySha256: observed.geometrySha256,
    nearestIndex,
    selected: observed.selected,
    selectedIndex,
    sourceSha256: template.sourceSha256,
    spawn: template.scene.spawn,
  }
}

async function solomonDigIndicatorReceipt(page) {
  return page.evaluate(() => {
    const indicator = document.querySelector('.boneyard-dig-indicator')
    const scene = document.querySelector('.boneyard-scene')
    const dig = document.querySelector('.boneyard-dig-anchor')
    if (!(indicator instanceof HTMLElement)) throw new Error('Solomon Dig indicator is missing')
    if (!(scene instanceof HTMLElement)) throw new Error('Boneyard scene is missing')
    if (!(dig instanceof HTMLElement)) throw new Error('Solomon Dig root is missing')

    const rotationDeg = Number(indicator.dataset.rotationDeg)
    const rotationRad = rotationDeg * Math.PI / 180
    const deltaX = Number(dig.dataset.worldX) - Number(scene.dataset.localPlayerX)
    const deltaY = Number(dig.dataset.worldY) - Number(scene.dataset.localPlayerY)
    return {
      headingDot: Math.cos(rotationRad) * deltaX + Math.sin(rotationRad) * deltaY,
      placement: indicator.dataset.placement,
      rotationDeg,
      viewportHeight: Number(scene.dataset.viewportHeight),
      viewportWidth: Number(scene.dataset.viewportWidth),
      x: Number.parseFloat(indicator.style.left),
      y: Number.parseFloat(indicator.style.top),
    }
  })
}

async function sampleDarknessPixels(page) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const sample = await page.evaluate(() => {
      const canvas = document.querySelector('.boneyard-darkness')
      const world = document.querySelector('.boneyard-world-canvas')
      if (!(canvas instanceof HTMLCanvasElement) || !(world instanceof HTMLCanvasElement)) return null
      const context = canvas.getContext('2d')
      if (!context || canvas.width === 0 || canvas.height === 0) return null
      const diagnostics = world.__sdrBoneyardFrame
      if (!diagnostics) return null

      const scaleX = canvas.width / 1600
      const scaleY = canvas.height / 900
      const playerX = diagnostics.playerScreenX * scaleX
      const playerY = diagnostics.playerScreenY * scaleY
      const corners = [
        { x: 2 * scaleX, y: 2 * scaleY },
        { x: 1598 * scaleX, y: 2 * scaleY },
        { x: 2 * scaleX, y: 898 * scaleY },
        { x: 1598 * scaleX, y: 898 * scaleY },
      ]
      const farthest = corners.reduce((best, point) => (
        Math.hypot(point.x - playerX, point.y - playerY)
          > Math.hypot(best.x - playerX, best.y - playerY)
          ? point
          : best
      ))
      return {
        centerAlpha: context.getImageData(
          Math.round(playerX), Math.round(playerY), 1, 1,
        ).data[3],
        farAlpha: context.getImageData(
          Math.round(farthest.x), Math.round(farthest.y), 1, 1,
        ).data[3],
      }
    })
    if (sample && sample.centerAlpha < sample.farAlpha) return sample
    await page.waitForTimeout(50)
  }
  throw new Error('darkness canvas did not paint the native player aperture')
}

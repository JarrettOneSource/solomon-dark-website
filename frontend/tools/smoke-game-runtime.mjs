import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4181'
const CREATE_MENU_TIMEOUT_MS = 30_000
const expectedModBoneyard = process.env.SDR_GAME_EXPECT_MOD_BONEYARD?.trim()
const screenshotPath = process.env.SDR_GAME_SMOKE_SCREENSHOT
  || '/tmp/solomon-dark-boneyard-smoke.png'
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
  const pageErrors = []
  const consoleErrors = []
  const clientPageErrors = []
  const clientConsoleErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  clientPage.on('pageerror', (error) => clientPageErrors.push(error.message))
  clientPage.on('console', (message) => {
    if (message.type() === 'error') clientConsoleErrors.push(message.text())
  })
  if (runtime) {
    await Promise.all([
      page.addInitScript((configuration) => {
        window.solomonDarkRuntime = configuration
      }, runtime),
      clientPage.addInitScript((configuration) => {
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
    await scene.waitFor({ timeout: 30_000 })
    await canvas.waitFor({ timeout: 30_000 })
    await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
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
  await Promise.all([
    hostBoneyard.waitFor({ timeout: 30_000 }),
    clientBoneyard.waitFor({ timeout: 30_000 }),
    page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 }),
    clientPage.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 }),
  ])
  const [hostReceipt, clientReceipt] = await Promise.all([
    boneyardReceipt(hostBoneyard),
    boneyardReceipt(clientBoneyard),
  ])
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
  if (hostDigCount) {
    assert.ok(new Set(hostDigFrames).size > 1, `expected host Solomon Dig to animate (${hostDigFrames.join(', ')})`)
    assert.ok(new Set(clientDigFrames).size > 1, `expected client Solomon Dig to animate (${clientDigFrames.join(', ')})`)
    for (const runPage of [page, clientPage]) {
      assert.equal(await runPage.locator('.boneyard-grave-dirt').count(), 1)
      assert.equal(await runPage.locator('.boneyard-lantern').count(), 1)
      await assertSolomonSetPieceRoots(runPage)
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

  let gateCrossing = null
  if (!expectedModBoneyard) {
    gateCrossing = await crossEntryGate(page, clientPage)
    await page.screenshot({ path: gateScreenshotPath })
  }

  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(clientConsoleErrors, [])
  assert.deepEqual(clientPageErrors, [])
  process.stdout.write(JSON.stringify({
    status: 'ok',
    before,
    after,
    boneyardPings,
    clientHubPing,
    consoleErrors,
    pageErrors,
    clientConsoleErrors,
    clientPageErrors,
    clientDigFrames: [...new Set(clientDigFrames)],
    digIndicatorReceipt,
    hostDigFrames: [...new Set(hostDigFrames)],
    hostReceipt,
    hostHubPing,
    hostPainterReceipt,
    clientPainterReceipt,
    gateCrossing,
    gateScreenshotPath: gateCrossing ? gateScreenshotPath : null,
    screenshotPath,
    orbSpriteCount,
    renderer,
    smoothPlayerSamples: new Set(presentationSamples.map(({ playerX }) => playerX)).size,
    studentCount,
    teacherFrames: [...new Set(teacherFrames)],
    walkPoses: [...new Set(presentationSamples.map(({ walkPose }) => walkPose))],
  }) + '\n')
} finally {
  await browser.close()
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
  await page.getByLabel(/College courtyard/).waitFor({ timeout: 15_000 })
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
  assert.equal(receipt.regionLighting, 'native-object-scalar')
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
  const alignedX = await alignWithEntryGate(hostPage, scene)
  const initialY = Number(await scene.getAttribute('data-local-player-y'))
  const initialGateState = await scene.getAttribute('data-gate-state')
  const initialClientGateState = await clientScene.getAttribute('data-gate-state')
  const key = initialY > 1000 ? 'w' : 's'
  const direction = key === 'w' ? -1 : 1
  await hostPage.bringToFront()
  await hostPage.keyboard.down(key)
  try {
    await hostPage.waitForFunction(
      ({ direction, initialY }) => {
        const value = Number(document.querySelector('.boneyard-scene')
          ?.getAttribute('data-local-player-y'))
        return Number.isFinite(value) && (value - initialY) * direction > 200
      },
      { direction, initialY },
      { timeout: 8_000 },
    )
  } finally {
    await hostPage.keyboard.up(key)
  }
  const finalY = Number(await scene.getAttribute('data-local-player-y'))
  await hostPage.waitForTimeout(1_500)
  const finalGateState = await scene.getAttribute('data-gate-state')
  assert.ok((finalY - initialY) * direction > 200)
  assert.notEqual(finalGateState, initialGateState)

  await clientPage.bringToFront()
  await clientPage.waitForFunction(
    (initial) => document.querySelector('.boneyard-scene')
      ?.getAttribute('data-gate-state') !== initial,
    initialClientGateState,
    { timeout: 5_000 },
  )
  return { alignedX, direction, finalY, initialY }
}

async function alignWithEntryGate(page, scene) {
  const initialX = Number(await scene.getAttribute('data-local-player-x'))
  const gateState = await scene.getAttribute('data-gate-state')
  const gates = new Map()
  for (const serialized of gateState?.split('|') || []) {
    const separator = serialized.lastIndexOf(':')
    if (separator < 0) continue
    const id = serialized.slice(0, separator)
    const [x] = serialized.slice(separator + 1).split(',').map(Number)
    const gateId = id.slice(0, id.lastIndexOf(':'))
    if (!Number.isFinite(x) || !gateId) continue
    const tips = gates.get(gateId) || []
    tips.push(x)
    gates.set(gateId, tips)
  }
  const centers = [...gates.values()]
    .filter((tips) => tips.length === 2)
    .map((tips) => (tips[0] + tips[1]) / 2)
  assert.ok(centers.length > 0, `expected an entry gate in ${gateState}`)
  const targetX = centers.reduce((nearest, center) => (
    Math.abs(center - initialX) < Math.abs(nearest - initialX) ? center : nearest
  ))
  const delta = targetX - initialX
  if (Math.abs(delta) <= 3) return initialX
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
  return Number(await scene.getAttribute('data-local-player-x'))
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

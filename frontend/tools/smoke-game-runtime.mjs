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
  await page.waitForFunction(() => /^[1-9]\d* FPS$/.test(
    document.querySelector('.hub-hud-fps')?.textContent?.trim() || '',
  ))
  const [skullBounds, fpsBounds] = await Promise.all([
    page.locator('.hub-hud-skull').boundingBox(),
    fpsCounter.boundingBox(),
  ])
  assert.ok(skullBounds && fpsBounds, 'expected the skull and FPS counter to be visible')
  assert.ok(
    fpsBounds.x >= skullBounds.x + skullBounds.width,
    'expected the FPS counter to sit to the right of the skull',
  )

  const renderer = await canvas.evaluate((node) => {
    const canvas = node
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
    return {
      context: context ? context.constructor.name : null,
      rendererName: canvas.dataset.rendererName,
      resolution: Number(canvas.dataset.resolution),
    }
  })
  assert.ok(renderer.context?.includes('WebGL'), `expected a real WebGL context, got ${renderer.context}`)
  assert.match(renderer.rendererName || '', /webgl/i)
  assert.ok(renderer.resolution >= 0.5 && renderer.resolution <= 1.5)

  const before = await canvas.evaluate((node) => node.__sdrHubFrame.playerX)
  const initialTeacherFrame = await canvas.evaluate((node) => node.__sdrHubFrame.teacherFrame)
  await page.waitForFunction(
    (initial) => document.querySelector('.hub-world-canvas')?.__sdrHubFrame.teacherFrame !== initial,
    initialTeacherFrame,
    { timeout: 10_000 },
  )
  const teacherFrames = [initialTeacherFrame, await canvas.evaluate((node) => node.__sdrHubFrame.teacherFrame)]

  const presentationSamples = []
  await page.keyboard.down('d')
  for (let sample = 0; sample < 24; sample += 1) {
    presentationSamples.push(await canvas.evaluate((node) => ({
      frame: node.__sdrHubFrame.frameCount,
      playerX: node.__sdrHubFrame.playerX,
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
  assert.ok(studentCount > 0, `expected authoritative Students, got ${studentCount}`)
  assert.ok(orbSpriteCount >= 3, `expected the native multi-sprite Fire orb, got ${orbSpriteCount}`)
  for (const element of ['air', 'earth', 'ether', 'fire', 'water']) {
    assert.ok(
      textureSources.some((source) => source.includes(`player-character-head-${element}`)),
      `expected the ${element} multiplayer appearance texture to be available`,
    )
  }

  await enterHub(clientPage, 'Earth')
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

  for (const runPage of [page, clientPage]) {
    await runPage.waitForFunction(() => /^[1-9]\d* FPS$/.test(
      document.querySelector('.hub-hud-fps')?.textContent?.trim() || '',
    ))
    assert.match((await runPage.locator('.hub-hud-fps').textContent()) || '', /^[1-9]\d* FPS$/)
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
  if (hostDigCount) {
    assert.ok(new Set(hostDigFrames).size > 1, `expected host Solomon Dig to animate (${hostDigFrames.join(', ')})`)
    assert.ok(new Set(clientDigFrames).size > 1, `expected client Solomon Dig to animate (${clientDigFrames.join(', ')})`)
    for (const runPage of [page, clientPage]) {
      assert.equal(await runPage.locator('.boneyard-grave-dirt').count(), 1)
      assert.equal(await runPage.locator('.boneyard-lantern').count(), 1)
      await assertSolomonSetPieceRoots(runPage)
    }
  }
  await page.screenshot({ path: screenshotPath })

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
    consoleErrors,
    pageErrors,
    clientConsoleErrors,
    clientPageErrors,
    clientDigFrames: [...new Set(clientDigFrames)],
    hostDigFrames: [...new Set(hostDigFrames)],
    hostReceipt,
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
    const stack = scene?.querySelector('.boneyard-world-stack')
    const base = stack?.querySelector('.boneyard-canvas')
    const foreground = stack?.querySelector('.boneyard-foreground')
    const localPlayer = stack?.querySelector('.boneyard-player[data-local="true"]')
    const mainBands = [...(stack?.querySelectorAll('.boneyard-main-band') ?? [])]
    const actors = [...(stack?.querySelectorAll('.boneyard-player') ?? [])]
    const zIndex = (element) => Number.parseInt(getComputedStyle(element).zIndex, 10)
    const canvasAlpha = (element) => element instanceof HTMLCanvasElement
      ? element.getContext('2d')?.getContextAttributes()?.alpha
      : undefined

    return {
      actorZIndexes: actors.map(zIndex),
      bandCount: Number(scene?.getAttribute('data-painter-band-count')),
      baseAlpha: canvasAlpha(base),
      baseZIndex: base ? zIndex(base) : Number.NaN,
      foregroundAlpha: canvasAlpha(foreground),
      foregroundZIndex: foreground ? zIndex(foreground) : Number.NaN,
      isolation: stack ? getComputedStyle(stack).isolation : null,
      localPlayerRow: Number(localPlayer?.getAttribute('data-painter-row')),
      localPlayerZIndex: localPlayer ? zIndex(localPlayer) : Number.NaN,
      mainBands: mainBands.map((band) => ({
        alpha: canvasAlpha(band),
        layerCount: Number(band.getAttribute('data-main-layer-count')),
        row: Number(band.getAttribute('data-painter-row')),
        zIndex: zIndex(band),
      })),
    }
  })
  assert.equal(receipt.isolation, 'isolate')
  assert.equal(receipt.baseAlpha, false)
  assert.equal(receipt.baseZIndex, 0)
  assert.equal(receipt.bandCount, receipt.mainBands.length)
  assert.ok(receipt.mainBands.length >= 2, 'expected scenery bands on both sides of live actors')
  assert.ok(receipt.mainBands.every((band) => band.alpha === true && band.layerCount > 0))
  assert.equal(receipt.foregroundAlpha, true)
  assert.equal(receipt.localPlayerRow, 0)
  assert.ok(receipt.mainBands.some((band) => band.zIndex < receipt.localPlayerZIndex))
  assert.ok(receipt.mainBands.some((band) => band.zIndex > receipt.localPlayerZIndex))
  assert.ok(receipt.foregroundZIndex > Math.max(
    ...receipt.actorZIndexes,
    ...receipt.mainBands.map((band) => band.zIndex),
  ))
  return receipt
}

async function crossEntryGate(hostPage, clientPage) {
  const scene = hostPage.locator('.boneyard-scene')
  const initialY = Number(await scene.getAttribute('data-local-player-y'))
  const initialGateState = await scene.getAttribute('data-gate-state')
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
      { timeout: 6_000 },
    )
  } finally {
    await hostPage.keyboard.up(key)
  }
  const finalY = Number(await scene.getAttribute('data-local-player-y'))
  await hostPage.waitForTimeout(1_500)
  const finalGateState = await scene.getAttribute('data-gate-state')
  assert.ok((finalY - initialY) * direction > 200)
  assert.notEqual(finalGateState, initialGateState)

  await clientPage.waitForFunction(
    (expected) => document.querySelector('.boneyard-scene')
      ?.getAttribute('data-gate-state') === expected,
    finalGateState,
    { timeout: 3_000 },
  )
  return { direction, finalY, initialY }
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

async function sampleDarknessPixels(page) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const sample = await page.evaluate(() => {
      const canvas = document.querySelector('.boneyard-darkness')
      const player = document.querySelector('.boneyard-player[data-local="true"]')
      if (!(canvas instanceof HTMLCanvasElement) || !(player instanceof HTMLElement)) return null
      const context = canvas.getContext('2d')
      if (!context || canvas.width === 0 || canvas.height === 0) return null

      const scaleX = canvas.width / 1600
      const scaleY = canvas.height / 900
      const playerX = Number.parseFloat(player.style.left) * scaleX
      const playerY = Number.parseFloat(player.style.top) * scaleY
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

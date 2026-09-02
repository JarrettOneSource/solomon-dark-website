import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import {
  getPlayerCharacter,
  getPlayerEconomy,
} from '../src/game/core-server/game-simulation.ts'
import { spawnBoneyardLootSpecs } from '../src/game/core-server/boneyard-loot-store.ts'
import {
  replacePlayerCharacter,
  replacePlayerEconomy,
  setPlayerDeathWeaponPainterRegistration,
} from '../src/game/core-server/player-entity-store.ts'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const screenshotRoot = process.env.SDR_HAGATHA_SCREENSHOT_ROOT
  || '/tmp/solomon-dark-hagatha-effects'
const credential = randomBytes(32).toString('base64url')
const pageErrors = []
const consoleErrors = []
const failedResponses = []
const seekerOnly = process.argv.includes('--seeker-only')

const staticServer = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const baseUrl = staticServer.origin
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  snapshotRate: 100,
})
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')
const browser = await chromium.launch({ executablePath: chromePath, headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })

try {
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'failed'
    if (new URL(request.url()).pathname === '/deployment.json') return
    if (failure === 'net::ERR_ABORTED' && /\.(?:mp3|ogg)(?:\?|$)/.test(request.url())) return
    failedResponses.push(`${request.url()}: ${failure}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })
  await page.addInitScript(installGameAudioSmokeProbe)
  await page.addInitScript(bypassStartupAudioPreload)
  await page.addInitScript(() => {
    window.__sdrRendererPixelProbes = true
  })
  await page.addInitScript((runtime) => {
    window.solomonDarkRuntime = runtime
  }, {
    gameEndpoint: {
      credential,
      kind: 'localhost',
      url: host.address.url,
    },
  })
  await page.route('**/deployment.json*', (route) => {
    const current = new URL(route.request().url()).searchParams.get('current')
    return route.fulfill({
      body: JSON.stringify({ revision: current }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    })
  })
  await page.goto(`${baseUrl}/game`, { timeout: 90_000, waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
  const tutorialPrompt = page.locator('[data-prompt-kind="tutorial"] .stock-prompt-dialog')
  if (await tutorialPrompt.isVisible()) {
    await tutorialPrompt.getByRole('button', { name: 'NO' }).click()
    await tutorialPrompt.waitFor({ state: 'detached' })
  }
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await enterCreateAfterCollegeAdmission(page, host)
  await page.getByRole('button', { name: /Ether/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })

  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  installOwnedSelectors(host.state(), playerId, [5])
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({
    timeout: 90_000,
  })
  await waitForHost(() => host.state().world.kind === 'boneyard', 'Boneyard authority')
  const player = getPlayerCharacter(host.state(), playerId)
  const world = host.state().world
  if (world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const worldManagerOrder = createNativeWorldManagerOrder(host.state().worldManagerOrder)
  const seededLoot = spawnBoneyardLootSpecs(world.loot, [
    {
      activationDelayTicks: 0,
      amount: 7,
      id: 1,
      kind: 'gold',
      nativeTypeId: 2012,
      phase: 0,
      position: { x: player.position.x + 200, y: player.position.y },
      source: 'script',
      tier: 2,
    },
    {
      activationDelayTicks: 0,
      id: 2,
      item: {
        equipmentType: null,
        iconRecords: [46],
        id: 1,
        kind: 'health-potion',
        name: 'Last Word Potion',
        nativeSubtype: 0,
        nativeTypeId: 7001,
        quantity: 1,
        rarity: null,
        recipeIndex: null,
      },
      kind: 'sack',
      nativeTypeId: 2013,
      phase: 0,
      position: { x: player.position.x, y: player.position.y + 225 },
      source: 'script',
    },
    {
      activationDelayTicks: 0,
      id: 3,
      kind: 'orb',
      nativeTypeId: 2011,
      orbKind: 'mana',
      phase: 0,
      position: { x: player.position.x + 250, y: player.position.y },
      source: 'script',
      value: 0.5,
    },
  ], host.state().tick, worldManagerOrder.register).store
  Object.assign(host.state(), {
    ...host.state(),
    world: { ...world, loot: seededLoot },
    worldManagerOrder: worldManagerOrder.state(),
  })

  const canvas = page.locator('.boneyard-world-canvas')
  await canvas.waitFor()
  await page.waitForFunction(() => (
    document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
      ?.seekerSegmentCount === 4
  ), undefined, { timeout: 15_000 })
  const seekerFrame = await canvas.evaluate((node) => ({
    context: node.getContext('webgl2')?.constructor.name ?? null,
    lootCount: node.__sdrBoneyardFrame.lootCount,
    seekerSegmentCount: node.__sdrBoneyardFrame.seekerSegmentCount,
  }))
  if (seekerFrame.seekerSegmentCount !== 4) {
    process.stderr.write(`${JSON.stringify({
      authorityLoot: host.state().world.kind === 'boneyard'
        ? host.state().world.loot.actors.map(({ id, kind, position }) => ({ id, kind, position }))
        : [],
      authoritySelectors: getPlayerEconomy(host.state(), playerId).ownedPerkSelectors,
      consoleErrors,
      pageErrors,
      seekerFrame,
    })}\n`)
  }
  assert.deepEqual(seekerFrame, {
    context: 'WebGL2RenderingContext',
    lootCount: 3,
    seekerSegmentCount: 4,
  })
  const initialSeekerPixels = await seekerPixelProbe(page, [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ])
  assertSeekerPixelProbe(initialSeekerPixels, 'initial')
  await page.screenshot({ path: `${screenshotRoot}-seeker.png` })

  repositionSeekerFixture(host, playerId, [
    { id: 1, x: 0, y: -200 },
    { id: 2, x: -225, y: 0 },
    { id: 3, x: 250, y: -250 },
  ])
  await page.waitForFunction(() => {
    const vertices = document.querySelector('.boneyard-world-canvas')
      ?.__sdrSeekerPixelProbe?.meshVertices()[0]
    if (!vertices) return false
    const startX = (vertices[0] + vertices[2]) / 2
    const startY = (vertices[1] + vertices[3]) / 2
    const endX = (vertices[4] + vertices[6]) / 2
    const endY = (vertices[5] + vertices[7]) / 2
    return Math.abs(endX - startX) < 0.01 && endY < startY
  }, undefined, { timeout: 15_000 })
  const movedSeekerPixels = await seekerPixelProbe(page, [
    { x: 0, y: -1 },
    { x: -1, y: 0 },
  ])
  assertSeekerPixelProbe(movedSeekerPixels, 'moved')
  await page.screenshot({ path: `${screenshotRoot}-seeker-moved.png` })
  installOwnedSelectors(host.state(), playerId, [])
  await page.waitForFunction(() => (
    document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
      ?.seekerSegmentCount === 0
  ), undefined, { timeout: 15_000 })
  const removedSeekerMeshCount = await canvas.evaluate((node) => (
    node.__sdrSeekerPixelProbe?.meshCount() ?? -1
  ))
  installOwnedSelectors(host.state(), playerId, [5])
  await page.waitForFunction(() => (
    document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
      ?.seekerSegmentCount === 4
  ), undefined, { timeout: 15_000 })
  const restoredSeekerMeshCount = await canvas.evaluate((node) => (
    node.__sdrSeekerPixelProbe?.meshCount() ?? -1
  ))
  const seekerLifecycle = {
    removedMeshCount: removedSeekerMeshCount,
    restoredMeshCount: restoredSeekerMeshCount,
  }
  assert.deepEqual(seekerLifecycle, { removedMeshCount: 0, restoredMeshCount: 4 })

  if (seekerOnly) {
    assert.deepEqual(pageErrors, [])
    assert.deepEqual(consoleErrors, [])
    assert.deepEqual(failedResponses, [])
    process.stdout.write(`${JSON.stringify({
      consoleErrors,
      failedResponses,
      pageErrors,
      screenshots: [
        `${screenshotRoot}-seeker.png`,
        `${screenshotRoot}-seeker-moved.png`,
      ],
      seekerFrame,
      seekerLifecycle,
      seekerPixels: {
        initial: initialSeekerPixels,
        moved: movedSeekerPixels,
      },
    })}\n`)
  } else {
    const audioStart = await page.evaluate(() => window.__sdrAudioEvents.length)
    const goldBeforeArchive = getPlayerEconomy(host.state(), playerId).gold
    const authority = host.state()
    const playerIndex = authority.playerEntities.identities.findIndex(({ playerId: id }) => (
      id === playerId
    ))
    assert.notEqual(playerIndex, -1)
    const progressions = [...authority.playerEntities.progressions]
    progressions[playerIndex] = {
      ...progressions[playerIndex],
      currentHealth: 0,
      deathAgeTicks: 333,
      deathEpoch: progressions[playerIndex].deathEpoch + 1,
      deathTick: 199,
      lifeState: 'dying',
    }
    installOwnedSelectors(authority, playerId, [5, 12])
    const deathPainterOrder = createNativeWorldManagerOrder(authority.worldManagerOrder)
    const playerEntities = setPlayerDeathWeaponPainterRegistration(
      { ...authority.playerEntities, progressions },
      playerId,
      deathPainterOrder.register('actor'),
    )
    Object.assign(authority, {
      ...authority,
      playerEntities,
      run: {
        ...authority.run,
        gameOverEventId: Math.max(1, authority.run.gameOverEventId),
        gameOverTicks: 0,
        nextGameOverEventId: Math.max(2, authority.run.nextGameOverEventId),
        phase: 'game-over',
      },
      worldManagerOrder: deathPainterOrder.state(),
    })
    await waitForHost(() => host.state().secondaryAbilities.actors.some(({ kind, scale }) => (
      kind === 'mindblast-burst' && scale === 15
    )), 'Last Word Mindblast birth')
    await page.waitForFunction(() => {
      const kinds = document.querySelector('.boneyard-world-canvas')
        ?.__sdrBoneyardFrame?.secondaryAbilityKinds ?? []
      return kinds.includes('mindblast-burst') && kinds.includes('mindblast-shockwave')
    }, undefined, { timeout: 15_000 })
    const lastWordFrame = await canvas.evaluate((node) => ({
      kinds: [...node.__sdrBoneyardFrame.secondaryAbilityKinds],
      lifeState: node.__sdrBoneyardFrame.localPlayerLifeState,
    }))
    await page.waitForTimeout(150)
    await page.screenshot({ path: `${screenshotRoot}-last-word.png` })
    await page.waitForFunction((start) => {
      const events = window.__sdrAudioEvents.slice(start)
      const matches = (name) => events.filter((event) => (
        event.type === 'buffer-start' && window.__sdrAudioSourceMatches(event.src, name)
      ))
      return matches('magic-shield-explode.wav').length >= 1
        && matches('big-fire.wav').length >= 2
    }, audioStart, { timeout: 15_000 })
    await waitForHost(() => (
      getPlayerEconomy(host.state(), playerId).storage.length === 1
    ), 'Last Word Luthacus archive', 20_000)
    await page.waitForFunction(() => (
      document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
        ?.seekerSegmentCount === 0
    ), undefined, { timeout: 15_000 })
    const archivedEconomy = getPlayerEconomy(host.state(), playerId)
    assert.equal(archivedEconomy.gold, goldBeforeArchive + 7)
    assert.match(
      archivedEconomy.storage[0].name,
      /^(?:Helvidius|[A-Za-z]+)'s (Earthly Possessions|Stuff|Dead Stuff|Bag|Loot)$/,
    )
    if (host.state().world.kind !== 'boneyard') throw new Error('expected Boneyard world')
    assert.deepEqual(host.state().world.loot.actors.map(({ kind }) => kind), ['orb'])

    assert.deepEqual(pageErrors, [])
    assert.deepEqual(consoleErrors, [])
    assert.deepEqual(failedResponses, [])
    process.stdout.write(`${JSON.stringify({
      archivedGold: archivedEconomy.gold,
      archivedSackName: archivedEconomy.storage[0].name,
      consoleErrors,
      failedResponses,
      lastWordFrame,
      pageErrors,
      screenshots: [
        `${screenshotRoot}-seeker.png`,
        `${screenshotRoot}-seeker-moved.png`,
        `${screenshotRoot}-last-word.png`,
      ],
      seekerFrame,
      seekerLifecycle,
      seekerPixels: {
        initial: initialSeekerPixels,
        moved: movedSeekerPixels,
      },
    })}\n`)
  }
} catch (error) {
  const browserState = await page.evaluate(() => ({
    canvases: [...document.querySelectorAll('canvas')].map((canvas) => ({
      className: canvas.className,
      hasBoneyardFrame: '__sdrBoneyardFrame' in canvas,
      seekerSegmentCount: canvas.__sdrBoneyardFrame?.seekerSegmentCount ?? null,
    })),
    scene: document.querySelector('.boneyard-scene')?.getAttribute('data-renderer-state') ?? null,
    url: location.href,
  })).catch(() => null)
  process.stderr.write(`${JSON.stringify({
    browserState,
    consoleErrors,
    failedResponses,
    pageErrors,
  })}\n`)
  throw error
} finally {
  await closeWithin(() => browser.close())
  await closeWithin(() => host.close())
  await closeWithin(() => staticServer.close())
}
process.exit(0)

function installOwnedSelectors(state, playerId, ownedPerkSelectors) {
  const economy = getPlayerEconomy(state, playerId)
  Object.assign(state, {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, playerId, {
      ...economy,
      ownedPerkSelectors,
      revision: economy.revision + 1,
    }),
  })
}

function repositionSeekerFixture(host, playerId, offsets) {
  const state = host.state()
  const player = getPlayerCharacter(state, playerId)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const positionById = new Map(offsets.map(({ id, x, y }) => [id, {
    x: Math.fround(player.position.x + x),
    y: Math.fround(player.position.y + y),
  }]))
  state.world = {
    ...state.world,
    loot: {
      ...state.world.loot,
      actors: state.world.loot.actors.map(actor => ({
        ...actor,
        position: positionById.get(actor.id) ?? actor.position,
      })),
    },
  }
}

function assertSeekerPixelProbe(receipt, label) {
  assert.equal(receipt.alphaMode, 'no-premultiply-alpha', `${label} alpha mode`)
  assert.equal(receipt.scaleMode, 'linear', `${label} scale mode`)
  assert.equal(receipt.meshCount, 4, `${label} mesh count`)
  assert.equal(receipt.meshAlphas.length, 4, `${label} alpha count`)
  for (const alpha of receipt.meshAlphas) {
    assert.ok(alpha >= 38 / 255 && alpha <= 89 / 255, `${label} pulse alpha ${alpha}`)
  }
  for (const profile of receipt.profiles) {
    const [innerNear, innerFar, outerNear, outerMiddle, outerFar] = profile.samples
    assert.ok(innerNear.maximumLuma > 0, `${label} ${profile.direction} inner start`)
    assert.ok(
      innerFar.maximumLuma > innerNear.maximumLuma * 1.5,
      `${label} ${profile.direction} inner rise ${JSON.stringify(profile.samples)}`,
    )
    assert.ok(
      outerNear.maximumLuma > outerMiddle.maximumLuma,
      `${label} ${profile.direction} outer near/middle ${JSON.stringify(profile.samples)}`,
    )
    assert.ok(
      outerMiddle.maximumLuma > outerFar.maximumLuma * 1.5,
      `${label} ${profile.direction} outer fall ${JSON.stringify(profile.samples)}`,
    )
    assert.ok(
      Math.max(...profile.samples.map(({ maximumLuma }) => maximumLuma)) < 128,
      `${label} ${profile.direction} remains faint`,
    )
  }
}

async function seekerPixelProbe(page, directions) {
  return page.evaluate(({ directions, distances }) => {
    const canvas = document.querySelector('.boneyard-world-canvas')
    const probe = canvas?.__sdrSeekerPixelProbe
    const frame = canvas?.__sdrBoneyardFrame
    if (!canvas || !probe || !frame) throw new Error('Seeker pixel probe is unavailable.')
    const scratch = canvas.ownerDocument.createElement('canvas')
    scratch.height = canvas.height
    scratch.width = canvas.width
    const context = scratch.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Seeker pixel probe could not create a 2D context.')
    const capture = (renderable) => {
      probe.renderIsolated(renderable)
      context.clearRect(0, 0, scratch.width, scratch.height)
      context.drawImage(canvas, 0, 0)
      return context.getImageData(0, 0, scratch.width, scratch.height).data.slice()
    }
    const sample = (candidate, direction, distance) => {
      const viewportWidth = Number(canvas.dataset.viewportWidth)
      const viewportHeight = Number(canvas.dataset.viewportHeight)
      const scaleX = canvas.width / viewportWidth
      const scaleY = canvas.height / viewportHeight
      const worldTransform = probe.worldTransform()
      const centerX = (
        worldTransform.x
        + (frame.playerX + direction.x * distance) * worldTransform.scale
      ) * scaleX
      const centerY = (
        worldTransform.y
        + (frame.playerY + direction.y * distance) * worldTransform.scale
      ) * scaleY
      const radius = Math.max(
        2,
        Math.ceil(worldTransform.scale * Math.max(scaleX, scaleY) * 2),
      )
      let maximumLuma = 0
      let nonBlackPixels = 0
      for (let y = Math.floor(centerY - radius); y <= Math.ceil(centerY + radius); y += 1) {
        if (y < 0 || y >= canvas.height) continue
        for (let x = Math.floor(centerX - radius); x <= Math.ceil(centerX + radius); x += 1) {
          if (x < 0 || x >= canvas.width) continue
          const offset = (y * canvas.width + x) * 4
          const luma = Math.round((
            54 * candidate[offset]
            + 183 * candidate[offset + 1]
            + 19 * candidate[offset + 2]
          ) / 256)
          if (luma > 0) nonBlackPixels += 1
          maximumLuma = Math.max(maximumLuma, luma)
        }
      }
      return { distance, maximumLuma, nonBlackPixels }
    }
    try {
      const baseline = capture(false)
      const candidate = capture(true)
      for (let offset = 0; offset < baseline.length; offset += 4) {
        if (
          baseline[offset] !== 0
          || baseline[offset + 1] !== 0
          || baseline[offset + 2] !== 0
        ) throw new Error('Isolated Seeker baseline is not black.')
      }
      return {
        alphaMode: probe.alphaMode(),
        canvasHeight: canvas.height,
        canvasWidth: canvas.width,
        meshAlphas: probe.meshAlphas(),
        meshCount: probe.meshCount(),
        profiles: directions.map(direction => ({
          direction: `${direction.x},${direction.y}`,
          samples: distances.map(distance => sample(candidate, direction, distance)),
        })),
        scaleMode: probe.scaleMode(),
      }
    } finally {
      probe.renderCurrent()
    }
  }, { directions, distances: [38, 47, 55, 75, 95] })
}

async function waitForHost(predicate, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function closeWithin(close, timeoutMs = 5_000) {
  await Promise.race([
    close(),
    new Promise(resolve => setTimeout(resolve, timeoutMs)),
  ])
}

async function enterCreateAfterCollegeAdmission(page, host) {
  const create = page.locator('.create-menu-scene[data-motion-settled="true"]')
  const first = await Promise.race([
    create.waitFor({ timeout: 90_000 }).then(() => 'create'),
    page.locator('.hub-scene[data-renderer-state="ready"]')
      .waitFor({ timeout: 90_000 })
      .then(() => 'hub'),
  ])
  if (first === 'create') return

  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const state = host.state()
  assert.equal(state.world.kind, 'hub')
  const participant = state.world.participants[playerId]
  if (participant?.collegeIntro) {
    state.world = {
      ...state.world,
      participants: {
        ...state.world.participants,
        [playerId]: {
          collegeIntro: {
            ...participant.collegeIntro,
            contactCounter: 0,
            coverAlpha: 0,
            dialogueSequence: participant.collegeIntro.dialogueSequence + 1,
            officeSpeed: 0.5,
            pathCursor: 6,
            phase: 'arch-dialogue',
            titleCursor: 5,
          },
          region: 'office',
          transition: null,
        },
      },
    }
    state.playerEntities = replacePlayerCharacter(state.playerEntities, playerId, {
      ...getPlayerCharacter(state, playerId),
      position: { x: 522.5, y: 530 },
      velocity: { x: 0, y: 0 },
    })
    const dialog = page.getByRole('dialog', { name: 'Talking to The Archchancellor' })
    await dialog.waitFor({ timeout: 15_000 })
    await dialog.getByRole('button', { name: 'Skip' }).click()
    await dialog.getByRole('button', { name: 'Solomon Dark?' }).click()
    await waitForHost(() => (
      host.state().world.kind === 'hub'
      && host.state().world.participants[playerId]?.collegeIntro === null
    ), 'College dialogue acknowledgement', 10_000)
    await dialog.getByRole('button', { name: 'Skip' }).click()
    await dialog.getByRole('button', { name: 'Done' }).click()
    await dialog.getByRole('button', { name: 'Skip' }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 15_000 })
  }

  const office = host.state()
  assert.equal(office.world.kind, 'hub')
  office.playerEntities = replacePlayerCharacter(office.playerEntities, playerId, {
    ...getPlayerCharacter(office, playerId),
    position: { x: 512, y: 900 },
    velocity: { x: 0, y: 0 },
  })
  await page.keyboard.down('s')
  try {
    await create.waitFor({ timeout: 30_000 })
  } finally {
    await page.keyboard.up('s')
  }
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

import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4184'
const screenshotRoot = process.env.SDR_PRIMARY_SPELL_SCREENSHOT_ROOT || '/tmp'
const gameEndpointUrl = process.env.SDR_GAME_SMOKE_ENDPOINT?.trim()
const gameEndpointCredential = process.env.SDR_GAME_SMOKE_CREDENTIAL?.trim()
if (Boolean(gameEndpointUrl) !== Boolean(gameEndpointCredential)) {
  throw new Error('SDR_GAME_SMOKE_ENDPOINT and SDR_GAME_SMOKE_CREDENTIAL must be set together')
}
const BONEYARD_RENDER_TIMEOUT_MS = 60_000
const CREATE_MENU_TIMEOUT_MS = 30_000
const SPELLS = [
  {
    castPose: 8,
    element: 'Ether',
    kind: 'ether',
    mode: 'one-shot',
    releaseCue: '/game/audio/sfx/magic-missile.wav',
  },
  {
    castPose: 8,
    element: 'Fire',
    kind: 'fire',
    mode: 'one-shot',
    releaseCue: '/game/audio/sfx/throw-fire.wav',
  },
  {
    castPose: 7,
    element: 'Air',
    kind: 'air',
    loopCue: '/game/audio/sfx/lightning-loop.wav',
    mode: 'channel',
    startCue: '/game/audio/sfx/lightning-start.wav',
  },
  {
    castPose: 7,
    element: 'Water',
    kind: 'water',
    loopCue: '/game/audio/sfx/ice-loop.wav',
    mode: 'channel',
    startCue: '/game/audio/sfx/ice-start.wav',
  },
  {
    castPose: 7,
    element: 'Earth',
    kind: 'earth',
    loopCue: '/game/audio/sfx/gather-rocks-loop.wav',
    mode: 'charge',
    rollingCue: '/game/audio/sfx/rolling-stone-loop.wav',
    startCue: '/game/audio/sfx/start-boulder.wav',
  },
]
const BLIZZARD_SPELL = {
  castPose: 7,
  element: 'Water',
  kind: 'blizzard',
  loopCue: '/game/audio/sfx/ice-beam-loop.wav',
  mode: 'channel',
  startCue: '/game/audio/sfx/ice-start.wav',
}
const requestedSpellKind = process.env.SDR_PRIMARY_SPELL_KIND?.trim().toLowerCase()
const lowManaAcceptance = process.env.SDR_PRIMARY_SPELL_LOW_MANA === '1'
const hostOpenedBoneyard = process.env.SDR_PRIMARY_SPELL_HOST_OPENED_BONEYARD === '1'
const boneyardOnlyAcceptance = process.env.SDR_PRIMARY_SPELL_BONEYARD_ONLY === '1'
const fireGravestoneAcceptance = process.env.SDR_PRIMARY_FIRE_GRAVESTONE === '1'
const earthContactAcceptance = process.env.SDR_PRIMARY_EARTH_CONTACT === '1'
const etherFanAcceptance = process.env.SDR_PRIMARY_ETHER_FAN === '1'
const heldFacingAcceptance = process.env.SDR_PRIMARY_HELD_FACING === '1'
const heldPoseAcceptance = process.env.SDR_PRIMARY_HELD_POSE === '1'
const performanceAcceptance = process.env.SDR_PRIMARY_PERFORMANCE === '1'
const nativePhaseExpectation = process.env.SDR_PRIMARY_EXPECT_NATIVE_PHASE === '1'
const combatAdmissionAcceptance = process.env.SDR_PRIMARY_SPELL_COMBAT_ADMISSION === '1'
const replicationAcceptance = process.env.SDR_PRIMARY_SPELL_REPLICATION_ACCEPTANCE === '1'
const maggotReplicationAcceptance = process.env.SDR_MAGGOT_REPLICATION_ACCEPTANCE === '1'
const selectedSpells = requestedSpellKind
  ? requestedSpellKind === BLIZZARD_SPELL.kind
    ? [BLIZZARD_SPELL]
    : SPELLS.filter((spell) => spell.kind === requestedSpellKind)
  : SPELLS
if (selectedSpells.length === 0) {
  throw new Error(`Unknown SDR_PRIMARY_SPELL_KIND: ${requestedSpellKind}`)
}
if (lowManaAcceptance && selectedSpells.length !== 1) {
  throw new Error('Low-mana acceptance requires one SDR_PRIMARY_SPELL_KIND')
}
if (earthContactAcceptance && (
  selectedSpells.length !== 1 || selectedSpells[0].kind !== 'earth'
)) {
  throw new Error('Earth-contact acceptance requires SDR_PRIMARY_SPELL_KIND=earth')
}
if (etherFanAcceptance && (
  lowManaAcceptance
  || selectedSpells.length !== 1
  || selectedSpells[0].kind !== 'ether'
)) {
  throw new Error('Ether-fan acceptance requires full-power SDR_PRIMARY_SPELL_KIND=ether')
}
if (heldPoseAcceptance && (
  lowManaAcceptance
  || etherFanAcceptance
  || selectedSpells.length !== 1
  || selectedSpells[0].kind !== 'ether'
)) {
  throw new Error('Held-pose acceptance requires full-power SDR_PRIMARY_SPELL_KIND=ether')
}
if (heldFacingAcceptance && (
  lowManaAcceptance
  || etherFanAcceptance
  || performanceAcceptance
  || selectedSpells.length !== 1
  || selectedSpells[0].kind !== 'ether'
)) {
  throw new Error('Held-facing acceptance requires isolated full-power Ether')
}
if (performanceAcceptance && !heldPoseAcceptance) {
  throw new Error('Primary performance acceptance requires the held Ether journey')
}
if (nativePhaseExpectation && !performanceAcceptance) {
  throw new Error('Native phase expectations require primary performance acceptance')
}
if (boneyardOnlyAcceptance && selectedSpells.length !== 1) {
  throw new Error('Boneyard-only acceptance requires one SDR_PRIMARY_SPELL_KIND')
}
if (replicationAcceptance && (
  !boneyardOnlyAcceptance
  || selectedSpells.length !== 1
  || selectedSpells[0].kind !== 'blizzard'
)) {
  throw new Error('Replication acceptance requires Boneyard-only Blizzard')
}
if (maggotReplicationAcceptance && !replicationAcceptance) {
  throw new Error('Maggot replication acceptance requires two-peer Blizzard replication')
}
if (combatAdmissionAcceptance && (
  selectedSpells.length !== 1
  || (selectedSpells[0].kind !== 'ether' && selectedSpells[0].kind !== 'air')
)) {
  throw new Error('Combat-admission acceptance requires Ether or Air')
}

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
let context = null
let observerContext = null

try {
  context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  await configurePrimarySpellContext(context, true)

  const receipts = []
  const errors = []
  let airPage = null
  let blizzardPage = null
  let blizzardObserverPage = null
  let earthPage = null
  let etherPage = null
  let firePage = null
  let waterPage = null

  for (const spell of selectedSpells) {
    const page = await context.newPage()
    watchErrors(page, errors, spell.kind)
    await enterHub(page, spell.element)
    let observerJoinMode = null
    let observerPage = null
    if (lowManaAcceptance && (spell.mode === 'one-shot' || spell.kind === 'earth')) {
      observerJoinMode = spell.kind === 'earth' ? 'pre-cast-charge-peer' : 'pre-cast-peer'
      observerPage = await context.newPage()
      watchErrors(observerPage, errors, `${spell.kind}-observer`)
      await enterHub(observerPage, spell.element)
      await page.bringToFront()
    }
    const canvas = page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]')
    await canvas.waitFor({ timeout: 30_000 })
    const initial = await canvas.evaluate((node) => ({ ...node.__sdrHubFrame }))
    assert.equal(initial.playerAttachmentPose, 0)
    assert.equal(initial.primarySpellCount, 0)
    if (boneyardOnlyAcceptance) {
      if (spell.kind === 'blizzard' && replicationAcceptance) {
        observerContext = await browser.newContext({ viewport: { width: 1600, height: 900 } })
        await configurePrimarySpellContext(observerContext, false)
        observerPage = await observerContext.newPage()
        watchErrors(observerPage, errors, `${spell.kind}-observer`)
        await enterHub(observerPage, spell.element)
        await page.bringToFront()
        blizzardObserverPage = observerPage
      }
      receipts.push({
        element: spell.element,
        hubPrimarySpellCount: initial.primarySpellCount,
        kind: spell.kind,
        mode: 'boneyard-only',
      })
      if (spell.kind === 'ether') etherPage = page
      else if (spell.kind === 'air') airPage = page
      else if (spell.kind === 'fire') firePage = page
      else if (spell.kind === 'water') waterPage = page
      else if (spell.kind === 'earth') earthPage = page
      else if (spell.kind === 'blizzard') blizzardPage = page
      else throw new Error(`Boneyard-only acceptance is not implemented for ${spell.kind}`)
      continue
    }
    const eventStart = await audioEventCount(page)
    const poseEventStart = await page.evaluate(() => window.__primarySpellPoseEvents.length)
    const heldPoseCheckpoint = heldPoseAcceptance
      ? await oneShotPoseCheckpoint(page)
      : null
    const target = await castTarget(canvas, 0.67, 0.42)
    await page.mouse.move(target.x, target.y)
    await page.mouse.down({ button: 'left' })
    const castPosePromise = spell.mode === 'one-shot'
      ? null
      : waitForHubCastPose(page, poseEventStart, spell.castPose)
    let opening = null

    if (spell.mode === 'charge') {
      await waitForHubSpell(page, spell.kind)
      const openingScreenshotPath = `${screenshotRoot}/solomon-primary-earth-hub-opening.png`
      opening = {
        ...await captureHubEarthStage(page, openingScreenshotPath),
        screenshotPath: openingScreenshotPath,
      }
    }

    let heldPose = null
    if (spell.mode === 'one-shot') {
      if (heldPoseCheckpoint) {
        heldPose = await waitForHeldOneShotPose(page, heldPoseCheckpoint, 3)
      } else {
        await page.waitForTimeout(hostOpenedBoneyard ? 250 : 35)
      }
      await page.mouse.up({ button: 'left' })
      if (heldPose) {
        heldPose = {
          ...heldPose,
          release: await waitForOneShotPoseRelease(page),
        }
      }
    }

    let castFrame = castPosePromise === null ? null : await castPosePromise
    if (castFrame) assert.equal(castFrame.playerAttachmentPose, spell.castPose)
    const observableKinds = spell.kind === 'fire'
      ? ['fire', 'fire-impact']
      : spell.kind === 'blizzard'
        ? ['weld-channel']
      : spell.kind
    let screenshotPath = `${screenshotRoot}/solomon-primary-${spell.kind}-hub.png`
    const useTrackingWireFallback = hostOpenedBoneyard && spell.kind === 'ether'
    const observedSpellFrame = spell.mode === 'charge' || useTrackingWireFallback
      ? null
      : await waitForHubSpell(page, observableKinds)
    if (spell.kind === 'fire') await page.screenshot({ path: screenshotPath })
    const facingWire = await latestWireSpell(
      page,
      observableKinds,
      lowManaAcceptance && spell.kind === 'fire',
    )
    if (castFrame === null) {
      if (!hostOpenedBoneyard && !fireGravestoneAcceptance) {
        assert.ok(
          facingWire.observedAttachmentPoses.includes(spell.castPose),
          `expected authoritative ${spell.kind} pose ${spell.castPose}`,
        )
      }
      castFrame = {
        playerAttachmentPose: spell.castPose,
        tick: facingWire.tick,
      }
    }
    const expectedHeadingIndex = headingIndex(facingWire.castAimDirection)
    assert.equal(facingWire.playerHeadingIndex, expectedHeadingIndex)
    const facingFrame = observedSpellFrame?.playerHeadingIndex === expectedHeadingIndex
      ? observedSpellFrame
      : useTrackingWireFallback
        ? {
            playerHeadingIndex: facingWire.playerHeadingIndex,
            primarySpellCount: facingWire.projectileCount,
            primarySpellKinds: [facingWire.state.kind],
            tick: facingWire.tick,
          }
        : await waitForHubFacing(page, observableKinds, expectedHeadingIndex)
    const lowManaPresentation = lowManaAcceptance
      ? await captureLowManaPresentation(page, facingWire)
      : null
    if (lowManaAcceptance) assertLowManaWire(spell.kind, facingWire, lowManaPresentation)
    let replication = null
    if (lowManaAcceptance) {
      if (!observerPage) {
        observerJoinMode = 'late-held-peer'
        observerPage = await context.newPage()
        watchErrors(observerPage, errors, `${spell.kind}-observer`)
        await enterHub(observerPage, spell.element)
      }
      const observerWire = await latestWireSpell(
        observerPage,
        observableKinds,
        spell.kind === 'fire',
      )
      assert.equal(observerWire.state.kind, facingWire.state.kind)
      assert.equal(observerWire.state.ownerId, facingWire.state.ownerId)
      assert.equal(observerWire.playerUnderpowered, true)
      if ('underpowered' in facingWire.state) {
        assert.equal(observerWire.state.underpowered, facingWire.state.underpowered)
      }
      if (spell.mode === 'one-shot' || spell.kind === 'earth') {
        assert.equal(observerWire.state.id, facingWire.state.id)
      }
      replication = {
        joinMode: observerJoinMode,
        ownerId: observerWire.state.ownerId,
        stateId: observerWire.state.id,
        tick: observerWire.tick,
        underpowered: observerWire.playerUnderpowered,
      }
    }
    let earthStages = null
    if (spell.mode === 'charge') {
      await page.waitForTimeout(500)
      const midScreenshotPath = `${screenshotRoot}/solomon-primary-earth-hub-mid.png`
      const mid = await captureHubEarthStage(page, midScreenshotPath)
      await page.waitForTimeout(2_500)
      const highScreenshotPath = `${screenshotRoot}/solomon-primary-earth-hub-high.png`
      const high = await captureHubEarthStage(page, highScreenshotPath)
      earthStages = {
        high: { ...high, screenshotPath: highScreenshotPath },
        mid: { ...mid, screenshotPath: midScreenshotPath },
        opening,
      }
      screenshotPath = highScreenshotPath
    } else if (spell.kind !== 'fire') {
      await page.screenshot({ path: screenshotPath })
    }

    if (spell.startCue) await waitForAudio(page, eventStart, spell.startCue, 'play')
    if (spell.releaseCue && spell.mode === 'one-shot') {
      await waitForAudio(page, eventStart, spell.releaseCue, 'play')
    }
    if (spell.loopCue) {
      const loop = await waitForAudio(page, eventStart, spell.loopCue, 'play')
      assert.equal(loop.loop, true)
    }

    let releaseScreenshotPath = null
    if (spell.mode !== 'one-shot') {
      await page.mouse.up({ button: 'left' })
      if (spell.mode === 'channel') {
        await waitForAudio(page, eventStart, spell.loopCue, 'pause')
      } else {
        const releaseWirePromise = waitForEarthRelease(
          page,
          earthStages.high.wire.tick,
          10_000,
        )
        await page.waitForTimeout(40)
        releaseScreenshotPath = `${screenshotRoot}/solomon-primary-earth-hub-release.png`
        const releaseScreenshotPromise = page.screenshot({ path: releaseScreenshotPath })
        const releaseWire = await releaseWirePromise
        const rolling = await findAudio(page, eventStart, spell.rollingCue, 'play')
        if (releaseWire.state.kind === 'earth') assert.equal(rolling?.loop, true)
        await releaseScreenshotPromise
        earthStages.release = {
          frame: await page.evaluate(() => ({
            ...document.querySelector('.hub-world-canvas')?.__sdrHubFrame,
          })),
          rollingAudioObserved: rolling !== null,
          screenshotPath: releaseScreenshotPath,
          wire: releaseWire,
        }
        if (releaseWire.state.kind === 'earth-impact') {
          earthStages.impact = {
            fragmentCount: Math.floor(Math.max(8, 30 * releaseWire.state.charge)),
            screenshotPath: releaseScreenshotPath,
            wire: releaseWire,
          }
        } else {
          try {
            const impact = await waitForWireSpell(
              page,
              'earth-impact',
              earthStages.high.wire.tick,
              6_000,
            )
            await page.waitForTimeout(16)
            const impactScreenshotPath = `${screenshotRoot}/solomon-primary-earth-hub-impact.png`
            await page.screenshot({ path: impactScreenshotPath })
            earthStages.impact = { screenshotPath: impactScreenshotPath, wire: impact }
          } catch {
            earthStages.impact = null
          }
        }
      }
    }

    const spellEvents = (await audioEvents(page)).slice(eventStart)
      .filter((event) => ['play', 'pause', 'buffer-start', 'buffer-stop']
        .includes(event.type))
      .map((event) => ({
        loop: event.loop,
        playbackRate: event.playbackRate,
        source: new URL(event.src).pathname,
        type: event.type === 'buffer-start'
          ? 'play'
          : event.type === 'buffer-stop'
            ? 'pause'
            : event.type,
        volume: event.volume,
      }))
    if (lowManaAcceptance) assertLowManaAudio(spell.kind, spellEvents)
    receipts.push({
      castPose: castFrame.playerAttachmentPose,
      castPoseSource: castPosePromise === null ? 'authoritative-plan' : 'renderer',
      earthStages,
      element: spell.element,
      expectedHeadingIndex,
      heldPose,
      kind: spell.kind,
      lowManaPresentation,
      playerHeadingIndex: facingFrame.playerHeadingIndex,
      primarySpellCount: facingFrame.primarySpellCount,
      primarySpellKinds: facingFrame.primarySpellKinds,
      releaseScreenshotPath,
      replication,
      screenshotPath,
      spellEvents,
      tick: facingFrame.tick,
      wirePlayerHeadingIndex: facingWire.playerHeadingIndex,
    })

    await observerPage?.close()

    if (spell.kind === 'earth') {
      earthPage = page
    } else if (spell.kind === 'ether' && selectedSpells.length === 1) {
      etherPage = page
    } else if (spell.kind === 'air' && selectedSpells.length === 1) {
      airPage = page
    } else if (spell.kind === 'fire' && selectedSpells.length === 1) {
      firePage = page
    } else if (spell.kind === 'water' && selectedSpells.length === 1) {
      waterPage = page
    } else if (spell.kind === 'blizzard' && selectedSpells.length === 1) {
      blizzardPage = page
    } else {
      await page.close()
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }

  const boneyard = earthPage
    ? await castEarthInBoneyard(earthPage)
    : airPage
        ? await castAirInBoneyard(airPage)
      : etherPage
        ? await castEtherInBoneyard(etherPage)
      : firePage
        ? await castFireInBoneyard(firePage)
        : waterPage
          ? await castWaterInBoneyard(waterPage)
          : blizzardPage
            ? await castBlizzardInBoneyard(blizzardPage, blizzardObserverPage)
          : null
  assert.deepEqual(errors, [])
  process.stdout.write(`${JSON.stringify({
    boneyard,
    errors,
    receipts,
    status: 'ok',
  })}\n`)
} finally {
  await Promise.race([
    observerContext ? observerContext.close() : Promise.resolve(),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ])
  await Promise.race([
    context ? context.close() : Promise.resolve(),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ])
  await Promise.race([
    browser.close(),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ])
}
await new Promise((resolve) => process.stdout.write('', resolve))
process.exit(0)

async function configurePrimarySpellContext(browserContext, includeAudio) {
  await browserContext.route('**/deployment.json*', (route) => {
    const current = new URL(route.request().url()).searchParams.get('current')
    route.fulfill({
      body: JSON.stringify({ revision: current }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    })
  })
  if (gameEndpointUrl && gameEndpointCredential) {
    await browserContext.addInitScript((runtime) => {
      window.solomonDarkRuntime = runtime
    }, {
      gameEndpoint: {
        credential: gameEndpointCredential,
        kind: 'localhost',
        url: gameEndpointUrl,
      },
    })
  }
  if (includeAudio) {
    await browserContext.addInitScript(installGameAudioSmokeProbe, {
      eventsGlobal: '__primarySpellAudioEvents',
      sourceMatcherGlobal: '__primarySpellAudioSourceMatches',
    })
  }
  await browserContext.addInitScript(installPrimarySpellStateProbe, performanceAcceptance)
  if (maggotReplicationAcceptance) {
    await browserContext.addInitScript(installMaggotEndpointProbe)
  }
}

function installPrimarySpellStateProbe(measurePerformance) {
  // This is a visual/state acceptance run, not a frame-rate benchmark. Pace
  // headless SwiftShader so full-resolution Water particles cannot starve I/O.
  if (!measurePerformance) {
    window.requestAnimationFrame = (callback) => window.setTimeout(
      () => callback(performance.now()),
      1_000 / 30,
    )
    window.cancelAnimationFrame = (handle) => window.clearTimeout(handle)
  }
  const poseEvents = []
  const poseSamples = []
  const wireFrames = []
  let loadedBoneyard = null
  let localPlayerId = null
  let previousPose = null
  const nativeJsonParse = JSON.parse
  Object.defineProperties(window, {
    __primarySpellPoseEvents: { value: poseEvents },
    __primarySpellPoseSamples: { value: poseSamples },
    __primarySpellBoneyard: { get: () => loadedBoneyard },
    __primarySpellLocalPlayerId: { get: () => localPlayerId },
    __primarySpellWireFrames: { value: wireFrames },
  })
  JSON.parse = function (...args) {
    const value = nativeJsonParse.apply(this, args)
    if (value?.type === 'server-boneyard-loaded') loadedBoneyard = value.boneyard
    const frame = value?.type === 'server-welcome'
      ? value.snapshot
      : value?.type === 'server-snapshot'
        ? value.frame
        : null
    if (frame?.primarySpells) {
      wireFrames.push({
        players: frame.players,
        primarySpells: frame.primarySpells,
        tick: frame.tick,
      })
      if (wireFrames.length > 2_000) wireFrames.shift()
    }
    return value
  }
  const observePose = () => {
    const node = document.querySelector('.boneyard-world-canvas')
      ?? document.querySelector('.hub-world-canvas')
    const frame = node?.__sdrHubFrame ?? node?.__sdrBoneyardFrame
    if (frame) {
      if (typeof frame.localPlayerId === 'string') localPlayerId = frame.localPlayerId
      const cast = localPlayerId
        ? wireFrames.at(-1)?.players[localPlayerId]?.primaryCast
        : null
      poseSamples.push({
        actionTick: cast?.actionTick ?? null,
        at: performance.now(),
        emissionSequence: cast?.emissionSequence ?? null,
        orbSpriteCount: frame.orbSpriteCount,
        playerAttachmentPose: frame.playerAttachmentPose,
        playerElementEffectScale: frame.playerElementEffectScale,
        playerLightRadius: frame.playerLightRadius,
        tick: frame.tick,
      })
      if (poseSamples.length > 10_000) poseSamples.shift()
    }
    if (frame && frame.playerAttachmentPose !== previousPose) {
      previousPose = frame.playerAttachmentPose
      poseEvents.push({
        at: performance.now(),
        playerAttachmentPose: frame.playerAttachmentPose,
        tick: frame.tick,
      })
    }
    requestAnimationFrame(observePose)
  }
  requestAnimationFrame(observePose)
}

function installMaggotEndpointProbe() {
  const samples = []
  const nativeJsonParse = JSON.parse
  Object.defineProperty(window, '__maggotEndpointSamples', { value: samples })
  JSON.parse = function (...args) {
    const value = nativeJsonParse.apply(this, args)
    const frame = value?.type === 'server-snapshot' ? value.frame : null
    const entities = frame?.world?.kind === 'boneyard' ? frame.world.entities : null
    if (Array.isArray(entities?.samples)) {
      for (const sample of entities.samples) {
        if (!Array.isArray(sample) || sample[0] !== 4 || sample.length !== 16) continue
        samples.push({ id: sample[1], phase: sample[15], tick: frame.tick })
        if (samples.length > 2_000) samples.shift()
      }
    }
    return value
  }
}

async function enterHub(page, element) {
  await page.goto(`${baseUrl}/game`, {
    timeout: hostOpenedBoneyard ? 90_000 : 30_000,
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  const tutorialPrompt = page.locator('.stock-prompt-dialog[data-prompt-kind="tutorial"]')
  if (await tutorialPrompt.isVisible()) {
    await tutorialPrompt.getByRole('button', { name: 'NO' }).click()
    await tutorialPrompt.waitFor({ state: 'detached' })
  }
  if (heldPoseAcceptance && !hostOpenedBoneyard) {
    await page.getByRole('button', { name: 'Settings' }).click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await settings.waitFor()
    const cheats = settings.getByRole('button', { name: /Enable Cheats/i })
    if (await cheats.getAttribute('aria-pressed') !== 'true') await cheats.click()
    await settings.getByRole('button', { name: 'Done' }).click()
  }
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  if (heldPoseAcceptance && !hostOpenedBoneyard) {
    const continueLocal = page.getByRole('button', { name: 'Continue Local' })
    await continueLocal.waitFor({ timeout: 5_000 })
    await continueLocal.click()
  }
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: CREATE_MENU_TIMEOUT_MS,
  })
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.getByLabel(/College courtyard/).waitFor({ timeout: 30_000 })
  try {
    await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      alert: document.querySelector('.hub-renderer-error')?.textContent?.trim() || null,
      body: document.body.innerText.slice(0, 2_000),
      rendererState: document.querySelector('.hub-scene')?.getAttribute('data-renderer-state'),
      url: location.href,
    }))
    throw new Error(`Hub renderer did not become ready: ${JSON.stringify(diagnostics)}`, {
      cause: error,
    })
  }
  if (heldPoseAcceptance && !hostOpenedBoneyard) {
    await page.waitForFunction(() => window.solomonDark?.lua)
    const seeded = await page.evaluate(() => window.solomonDark.lua.execute(
      'return sd.rng.set_seed(12)',
    ))
    assert.equal(seeded.ok, true, seeded.error)
    assert.equal(seeded.values[0], 12)
  }
}

function headingIndex(direction) {
  const degrees = (Math.atan2(direction.x, -direction.y) * 180 / Math.PI + 360) % 360
  return Math.floor((degrees + 7.5) / 15) % 24
}

async function castEarthInBoneyard(page) {
  const canvas = await enterBoneyard(page)
  const contactTarget = earthContactAcceptance
    ? await visibleBoneyardEnemy(page, true)
    : null
  const eventStart = await audioEventCount(page)
  const bounds = contactTarget === null ? null : await canvas.boundingBox()
  if (contactTarget !== null) assert.ok(bounds, 'expected the Boneyard canvas to have bounds')
  const target = contactTarget === null
    ? await castTarget(canvas, 0.67, 0.38)
    : worldScreenPoint(bounds, contactTarget.frame, contactTarget.enemy)
  await page.mouse.move(target.x, target.y)
  await page.mouse.down({ button: 'left' })
  await waitForAudio(page, eventStart, '/game/audio/sfx/start-boulder.wav', 'play')
  const gather = await waitForAudio(
    page,
    eventStart,
    '/game/audio/sfx/gather-rocks-loop.wav',
    'play',
  )
  assert.equal(gather.loop, true)
  const held = await waitForBoneyardSpell(page, 'earth')
  const initialHeldWire = await latestWireSpell(page, 'earth')
  if (lowManaAcceptance) assert.ok(held.localPlayerMana <= 0.1)
  if (earthContactAcceptance) {
    await waitForHeldEarthCharge(
      page,
      initialHeldWire.state.id,
      initialHeldWire.state.worldKey,
      0.5,
      10_000,
    )
  } else {
    await page.waitForTimeout(400)
  }
  const heldWire = await latestWireSpell(page, 'earth')
  if (lowManaAcceptance) {
    assert.equal(heldWire.playerUnderpowered, true)
    assert.equal('underpowered' in heldWire.state, false)
    assert.ok(heldWire.state.damage <= 5)
  }
  const heldScreenshotPath = `${screenshotRoot}/solomon-primary-earth-boneyard-held.png`
  await page.screenshot({ path: heldScreenshotPath })
  await page.mouse.up({ button: 'left' })
  await page.waitForTimeout(40)
  const releaseScreenshotPath = `${screenshotRoot}/solomon-primary-earth-boneyard-release.png`
  const releaseScreenshotPromise = page.screenshot({ path: releaseScreenshotPath })
  const releasedWire = earthContactAcceptance
    ? await waitForEarthFlight(page, heldWire.state.id, heldWire.tick, 15_000)
    : await waitForWireSpell(page, 'earth', heldWire.tick, 10_000)
  assert.equal(releasedWire.state.phase, 'flight')
  const rolling = await waitForAudio(
    page,
    eventStart,
    '/game/audio/sfx/rolling-stone-loop.wav',
    'play',
  )
  assert.equal(rolling.loop, true)
  assert.notDeepEqual(releasedWire.state.orientation, heldWire.state.orientation)
  assert.notDeepEqual(releasedWire.state.position, heldWire.state.position)
  const released = await waitForBoneyardSpell(page, ['earth', 'earth-impact'])
  await releaseScreenshotPromise
  assert.ok(released.painterBandCount >= 2)
  assert.ok(released.maxDynamicZIndex > 0)
  let contact = null
  if (contactTarget !== null) {
    const targetId = `enemy:${contactTarget.enemy.id}`
    const residual = await waitForEarthResidualContact(
      page,
      releasedWire.state.id,
      targetId,
      releasedWire.tick,
      15_000,
    )
    assert.equal(residual.boulder.state.phase, 'flight')
    assert.ok(residual.boulder.state.hitTargetIds.includes(targetId))
    assert.ok(residual.boulder.state.remainingDamage > 0)
    assert.ok(residual.boulder.state.charge < residual.boulder.state.maximumCharge)
    assert.equal(residual.boulder.state.shellCharge, residual.boulder.state.charge)
    assert.ok(residual.boulder.state.assemblyCharge > residual.boulder.state.shellCharge)
    assert.equal(residual.bit.state.kind, 'earth-boulder-bit')
    const rendered = await waitForRenderedBoneyardSpellKinds(
      page,
      ['earth', 'earth-boulder-bit'],
      10_000,
    )
    assert.ok(rendered.painterBandCount >= 2)
    assert.ok(rendered.maxDynamicZIndex > 0)
    const contactScreenshotPath = `${screenshotRoot}/solomon-primary-earth-boneyard-contact.png`
    await page.screenshot({ path: contactScreenshotPath })

    const terminal = await waitForWireSpell(page, 'earth-impact', residual.tick, 20_000)
    const rockHit = await waitForAudio(
      page,
      eventStart,
      '/game/audio/sfx/rock-hit.wav',
      'play',
      20_000,
    )
    const stoneBreak = await waitForAudio(
      page,
      eventStart,
      '/game/audio/sfx/stone-break.wav',
      'play',
      20_000,
    )
    assert.ok(Math.abs(
      rockHit.playbackRate - (1 + 0.05 / terminal.state.charge),
    ) < 0.000_001)
    assert.ok(Math.abs(
      stoneBreak.playbackRate - (1 - 0.5 * terminal.state.charge),
    ) < 0.000_001)
    const terminalScreenshotPath = `${screenshotRoot}/solomon-primary-earth-boneyard-terminal.png`
    await page.screenshot({ path: terminalScreenshotPath })
    contact = {
      contactScreenshotPath,
      residual,
      rendered,
      rockHit,
      stoneBreak,
      target: contactTarget.enemy,
      targetId,
      terminal,
      terminalScreenshotPath,
    }
  }
  return {
    contact,
    held,
    heldWire,
    heldScreenshotPath,
    releaseScreenshotPath,
    released,
    releasedWire,
  }
}

async function enterBoneyard(page) {
  const renderTimeout = hostOpenedBoneyard ? 180_000 : BONEYARD_RENDER_TIMEOUT_MS
  const enter = page.getByRole('button', { name: 'Enter the Boneyard' })
  await enter.waitFor({ timeout: 10_000 })
  await enter.click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({
    timeout: renderTimeout,
  })
  const canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  await canvas.waitFor({ timeout: renderTimeout })
  return canvas
}

async function castAirInBoneyard(page) {
  const canvas = await enterBoneyard(page)
  const scene = page.locator('.boneyard-scene')
  const gate = await crossEntryGate(page, scene)
  const combatAdmission = combatAdmissionAcceptance
    ? await enableSolomonCombat(page, scene)
    : null
  const bounds = await canvas.boundingBox()
  assert.ok(bounds, 'expected the Boneyard canvas to have bounds')
  const frame = await boneyardFrame(page)
  const environmentMode = Number(await page.locator('.boneyard-scene')
    .getAttribute('data-environment-mode'))
  assert.equal(frame.localPlayerLifeState, 'alive')
  assert.equal(frame.runPhase, 'active')
  const idleScreenshotPath = `${screenshotRoot}/solomon-primary-air-boneyard-idle.png`
  await page.screenshot({ path: idleScreenshotPath })
  const idleEnvironmentLight = await page.evaluate(() => {
    const canvas = document.querySelector('.boneyard-environment-light')
    const world = document.querySelector('.boneyard-world-canvas')
    const frame = world?.__sdrBoneyardFrame
    if (!(canvas instanceof HTMLCanvasElement) || !frame) return null
    const context = canvas.getContext('2d')
    if (!context) return null
    const resolutionX = canvas.width / 1_600
    const resolutionY = canvas.height / 900
    const sample = context.getImageData(
      Math.round(frame.playerScreenX * resolutionX),
      Math.round(frame.playerScreenY * resolutionY),
      1,
      1,
    ).data
    return {
      alpha: sample[3],
      blue: sample[2],
      composite: getComputedStyle(canvas).mixBlendMode,
      green: sample[1],
      red: sample[0],
    }
  })
  const gravestones = await visibleGravestones(page, frame)
  assert.ok(gravestones.length > 0, 'expected a visible generated Gravestone')
  const eventStart = await audioEventCount(page)
  const afterTick = await latestWireTick(page)
  await page.bringToFront()
  const initialAimPoint = worldScreenPoint(bounds, frame, gravestones[0].pos)
  await page.mouse.move(initialAimPoint.x, initialAimPoint.y)
  await page.mouse.down({ button: 'left' })
  let receipt
  try {
    try {
      await waitForWireSpell(page, 'air', afterTick, 5_000)
    } catch (error) {
      const diagnostics = await page.evaluate((point) => {
        const target = document.elementFromPoint(point.x, point.y)
        return {
          body: document.body.innerText.slice(0, 1_000),
          frame: structuredClone(
            document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame,
          ),
          latestWire: window.__primarySpellWireFrames.at(-1),
          pointerTarget: target
            ? { className: target.className, tagName: target.tagName }
            : null,
          skillPicker: Boolean(document.querySelector('.skill-picker-stage')),
        }
      }, initialAimPoint)
      throw new Error(`Air cast did not start: ${JSON.stringify(diagnostics)}`, { cause: error })
    }
    await waitForAudio(page, eventStart, '/game/audio/sfx/lightning-start.wav', 'play')
    const loop = await waitForAudio(
      page,
      eventStart,
      '/game/audio/sfx/lightning-loop.wav',
      'play',
    )
    assert.equal(loop.loop, true)

    let targeted = null
    for (let index = 0; index < gravestones.length && targeted === null; index += 1) {
      const point = worldScreenPoint(bounds, frame, gravestones[index].pos)
      await page.mouse.move(point.x, point.y)
      await page.waitForTimeout(90)
      targeted = await targetedAirWire(page, afterTick)
    }
    assert.ok(targeted, 'expected held Air to acquire a Boneyard Gravestone')
    assert.match(targeted.state.targetId, /^scenery:/)
    assert.equal(targeted.playerTargetId, targeted.state.targetId)
    if (lowManaAcceptance) assert.equal(targeted.state.underpowered, true)
    const held = await waitForBoneyardSpell(page, 'air')
    assert.ok(
      held.lightProviderCandidateCount > frame.lightProviderCandidateCount,
      `expected Air to join the current light-provider frame: ${JSON.stringify({
        before: frame.lightProviderCandidateCount,
        held: held.lightProviderCandidateCount,
      })}`,
    )
    if (lowManaAcceptance) assert.ok(held.localPlayerMana <= 0.1)
    const screenshotPath = `${screenshotRoot}/solomon-primary-air-boneyard-target.png`
    await page.screenshot({ path: screenshotPath })
    receipt = {
      combatAdmission,
      gate,
      held,
      idleEnvironmentLight,
      idleScreenshotPath,
      environmentMode,
      lighting: {
        before: {
          accepted: frame.lightSourceCount,
          misc: frame.lightMiscTailCandidateCount,
          providers: frame.lightProviderCandidateCount,
        },
        held: {
          accepted: held.lightSourceCount,
          lanternIntensity: held.lanternLightIntensity,
          misc: held.lightMiscTailCandidateCount,
          providers: held.lightProviderCandidateCount,
        },
      },
      screenshotPath,
      targeted,
    }
  } finally {
    await page.mouse.up({ button: 'left' })
  }
  await waitForAudio(page, eventStart, '/game/audio/sfx/lightning-loop.wav', 'pause')
  return receipt
}

async function castBlizzardInBoneyard(page, observerPage = null) {
  const canvas = await enterBoneyard(page)
  if (observerPage) {
    const renderTimeout = hostOpenedBoneyard ? 180_000 : BONEYARD_RENDER_TIMEOUT_MS
    await observerPage.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({
      timeout: renderTimeout,
    })
    await observerPage.locator(
      '.boneyard-world-canvas[data-game-renderer="pixi-webgl"]',
    ).waitFor({ timeout: renderTimeout })
    await page.bringToFront()
    await page.waitForTimeout(2_500)
  }
  const maggotReplication = maggotReplicationAcceptance
    ? {
        observer: await waitForMaggotEndpointLifecycle(observerPage),
        owner: await waitForMaggotEndpointLifecycle(page),
      }
    : null
  const target = await visibleBoneyardEnemy(page, true)
  assert.ok(target, 'expected one visible enemy for Blizzard acceptance')
  const bounds = await canvas.boundingBox()
  assert.ok(bounds, 'expected the Boneyard canvas for Blizzard acceptance')
  const collisionAcceptance = process.env.SDR_PRIMARY_SPELL_BLIZZARD_COLLISION_ACCEPTANCE === '1'
  const aimWorld = collisionAcceptance
    ? blizzardCollisionAim(target)
    : target.enemy
  const aim = worldScreenPoint(bounds, target.frame, aimWorld)
  const observerFramePromise = observerPage
    ? waitForBoneyardSpell(observerPage, 'weld-blizzard-glow:1004')
    : null
  await page.mouse.move(aim.x, aim.y)
  await page.mouse.down({ button: 'left' })
  try {
    const frame = await waitForBoneyardSpell(page, 'weld-blizzard-glow:1004')
    const wire = await latestWireSpell(page, 'weld-channel')
    assert.equal(wire.state.buildId, 1004)
    const channelCount = frame.primarySpellKinds.filter((kind) => (
      kind === 'weld-channel:1004'
    )).length
    const glowCount = frame.primarySpellKinds.filter((kind) => (
      kind === 'weld-blizzard-glow:1004'
    )).length
    assert.ok(channelCount >= 1 && channelCount <= 2)
    assert.ok(glowCount >= 2)
    const observerFrame = await observerFramePromise
    const observerWire = observerPage
      ? await latestWireSpell(observerPage, 'weld-channel')
      : null
    if (observerWire) {
      assert.equal(observerWire.state.buildId, 1004)
      assert.equal(observerWire.state.ownerId, wire.state.ownerId)
    }
    const screenshotPath = `${screenshotRoot}/solomon-primary-blizzard-boneyard.png`
    await page.screenshot({ path: screenshotPath })
    return {
      channelCount,
      frame,
      glowCount,
      aimWorld,
      maggotReplication,
      replication: observerFrame && observerWire
        ? {
            buildId: observerWire.state.buildId,
            glowCount: observerFrame.primarySpellKinds.filter((kind) => (
              kind === 'weld-blizzard-glow:1004'
            )).length,
            ownerId: observerWire.state.ownerId,
            tick: observerWire.tick,
          }
        : null,
      screenshotPath,
      target: target.enemy,
      wire,
    }
  } finally {
    await page.mouse.up({ button: 'left' })
  }
}

async function waitForMaggotEndpointLifecycle(page) {
  if (!page) throw new Error('Maggot endpoint acceptance requires an observer page')
  await page.waitForFunction(() => {
    const samples = window.__maggotEndpointSamples ?? []
    const endpoint = samples.find(({ phase }) => phase === 5 * 1024)
    return endpoint && samples.some(({ id, phase, tick }) => (
      id === endpoint.id && tick > endpoint.tick && phase < 5 * 1024
    ))
  }, undefined, { timeout: 30_000 })
  return page.evaluate(() => {
    const samples = window.__maggotEndpointSamples
    const endpoint = samples.find(({ phase }) => phase === 5 * 1024)
    const wrapped = samples.find(({ id, phase, tick }) => (
      id === endpoint.id && tick > endpoint.tick && phase < 5 * 1024
    ))
    return { endpoint, wrapped }
  })
}

function blizzardCollisionAim(target) {
  const chain = target.frame.enemySamples.find(({ id }) => id === target.enemy.id + 1)
  assert.ok(chain, 'expected the controlled Blizzard chain target')
  const dx = chain.x - target.enemy.x
  const dy = chain.y - target.enemy.y
  const distance = Math.hypot(dx, dy)
  assert.ok(distance > 0, 'expected distinct Blizzard direct and chain roots')
  const perpendicular = { x: dx / distance, y: dy / distance }
  const directionX = target.enemy.x - target.frame.playerX - perpendicular.x * 30
  const directionY = target.enemy.y - target.frame.playerY - perpendicular.y * 30
  const directionLength = Math.hypot(directionX, directionY)
  assert.ok(directionLength > 0, 'expected a Blizzard collision aim direction')
  const direction = {
    x: directionX / directionLength,
    y: directionY / directionLength,
  }
  const horizontalDistance = direction.x === 0
    ? Number.POSITIVE_INFINITY
    : direction.x > 0
      ? (1_550 - target.frame.playerScreenX) / (direction.x * 1.35)
      : (50 - target.frame.playerScreenX) / (direction.x * 1.35)
  const verticalDistance = direction.y === 0
    ? Number.POSITIVE_INFINITY
    : direction.y > 0
      ? (850 - target.frame.playerScreenY) / (direction.y * 1.35)
      : (50 - target.frame.playerScreenY) / (direction.y * 1.35)
  const aimDistance = Math.min(300, horizontalDistance, verticalDistance)
  assert.ok(aimDistance > 90, 'expected the Blizzard collision aim to remain on canvas')
  return {
    x: target.frame.playerX + direction.x * aimDistance,
    y: target.frame.playerY + direction.y * aimDistance,
  }
}

async function castFireInBoneyard(page) {
  const canvas = await enterBoneyard(page)
  const gate = fireGravestoneAcceptance
    ? await crossEntryGate(page, page.locator('.boneyard-scene'))
    : null
  const eventStart = await audioEventCount(page)
  const afterTick = await latestWireTick(page)
  const idleScreenshotPath = `${screenshotRoot}/solomon-primary-fire-boneyard-idle.png`
  await page.screenshot({ path: idleScreenshotPath })
  let gravestone = null
  let target
  if (fireGravestoneAcceptance) {
    const bounds = await canvas.boundingBox()
    assert.ok(bounds, 'expected the Boneyard canvas to have bounds')
    const frame = await boneyardFrame(page)
    gravestone = (await visibleGravestones(page, frame))[0] ?? null
    assert.ok(gravestone, 'expected a visible generated Gravestone for Fire contact')
    target = worldScreenPoint(bounds, frame, gravestone.pos)
  } else {
    target = await castTarget(canvas, 0.5, 0.05)
  }
  await page.mouse.move(target.x, target.y)
  await page.mouse.down({ button: 'left' })
  const launch = await waitForAudio(page, eventStart, '/game/audio/sfx/throw-fire.wav', 'play')
  let flight = null
  let flightScreenshotPath = null
  if (lowManaAcceptance) {
    const fizzle = await waitForAudio(page, eventStart, '/game/audio/sfx/fizzle.wav', 'play')
    assert.ok(fizzle.at <= launch.at)
    assert.equal(fizzle.volume, 1)
    assert.equal(launch.playbackRate, 0.75)
    assert.equal(launch.volume, 1)
    flight = await waitForWireSpell(page, 'fire', afterTick, 10_000, true)
    assert.equal(flight.state.underpowered, true)
    assert.equal(flight.state.damage, 2)
    flightScreenshotPath = `${screenshotRoot}/solomon-primary-fire-boneyard-low-flight.png`
    await page.screenshot({ path: flightScreenshotPath })
  }
  await page.mouse.up({ button: 'left' })
  const impact = await waitForWireSpell(page, 'fire-impact', afterTick, 20_000)
  const gravestoneImpactDistance = gravestone === null
    ? null
    : Math.hypot(
        impact.state.origin.x - gravestone.pos.x,
        impact.state.origin.y - gravestone.pos.y,
      )
  if (gravestoneImpactDistance !== null) {
    assert.ok(
      gravestoneImpactDistance < 20.01,
      `Fire impacted ${gravestoneImpactDistance} units from the Gravestone root`,
    )
  }
  const screenshotPath = `${screenshotRoot}/solomon-primary-fire-boneyard-impact.png`
  await page.screenshot({ path: screenshotPath })
  await waitForAudio(page, eventStart, '/game/audio/sfx/fireball-hit.wav', 'play')
  return {
    flight,
    flightScreenshotPath,
    gate,
    gravestone: gravestone === null ? null : {
      eid: gravestone.eid,
      impactDistance: gravestoneImpactDistance,
      position: gravestone.pos,
    },
    impact,
    idleScreenshotPath,
    screenshotPath,
  }
}

async function castEtherInBoneyard(page) {
  const canvas = await enterBoneyard(page)
  if (!hostOpenedBoneyard) return castUntargetedEtherInBoneyard(page, canvas)

  if (etherFanAcceptance) await waitForEtherFanFixture(page)
  const target = await visibleBoneyardEnemy(page)
  const bounds = await canvas.boundingBox()
  assert.ok(bounds, 'expected the Boneyard canvas to have bounds')
  const targetPoint = worldScreenPoint(bounds, target.frame, target.enemy)
  const aimPoint = {
    x: Math.max(bounds.x + 30, Math.min(bounds.x + bounds.width - 30, targetPoint.x)),
    y: Math.max(bounds.y + 30, Math.min(bounds.y + bounds.height - 30, targetPoint.y)),
  }
  const eventStart = await audioEventCount(page)
  const afterTick = await latestWireTick(page)
  const heldPoseCheckpoint = heldPoseAcceptance
    ? await oneShotPoseCheckpoint(page)
    : null
  const heldFacingCheckpoint = heldFacingAcceptance
    ? await oneShotFacingCheckpoint(page)
    : null
  await page.mouse.move(aimPoint.x, aimPoint.y)
  await page.mouse.down({ button: 'left' })
  const launch = await waitForAudio(
    page,
    eventStart,
    '/game/audio/sfx/magic-missile.wav',
    'play',
    hostOpenedBoneyard ? 30_000 : 10_000,
  )
  let flight = null
  let flightScreenshotPath = null
  const heldFacing = heldFacingCheckpoint
    ? await waitForHeldOneShotFacing(page, canvas, heldFacingCheckpoint)
    : null
  let heldPose = null
  if (heldPoseCheckpoint) {
    heldPose = await waitForHeldOneShotPose(page, heldPoseCheckpoint, 3)
  }
  if (etherFanAcceptance) {
    const launchFan = await waitForEtherFan(page, afterTick, 4, 10_000, 1)
    await page.mouse.up({ button: 'left' })
    assertEtherFan(launchFan)
    const launchIds = launchFan.states.map(({ id }) => id)
    const spreadFan = await waitForEtherFan(
      page,
      afterTick,
      4,
      10_000,
      15,
      launchIds,
    )
    assert.deepEqual(
      spreadFan.states.map(({ id }) => id),
      launchIds,
    )
    const rendered = await waitForBoneyardSpell(page, 'ether')
    assert.ok(rendered.primarySpellCount >= 4)
    flight = {
      ...launchFan,
      renderedPrimarySpellCount: rendered.primarySpellCount,
      spreadStates: spreadFan.states,
      spreadTick: spreadFan.tick,
    }
    flightScreenshotPath = `${screenshotRoot}/solomon-primary-ether-boneyard-fan-flight.png`
    await page.screenshot({ path: flightScreenshotPath })
  } else if (lowManaAcceptance) {
    const fizzle = await waitForAudio(page, eventStart, '/game/audio/sfx/fizzle.wav', 'play')
    assert.ok(fizzle.at <= launch.at)
    assert.equal(fizzle.volume, 1)
    assert.equal(launch.playbackRate, 0.75)
    assert.equal(launch.volume, 1)
    flight = await waitForWireSpell(page, 'ether', afterTick, 10_000)
    assert.equal(flight.state.underpowered, true)
    assertWeakEtherDamage(flight.state.damage)
    assert.ok(
      Math.abs(Math.hypot(flight.state.velocity.x, flight.state.velocity.y) - 2.4) < 0.000001,
    )
    flightScreenshotPath = `${screenshotRoot}/solomon-primary-ether-boneyard-low-flight.png`
    await page.screenshot({ path: flightScreenshotPath })
  }
  if (!etherFanAcceptance) await page.mouse.up({ button: 'left' })
  if (heldPose) {
    heldPose = {
      ...heldPose,
      release: await waitForOneShotPoseRelease(page),
    }
  }
  const impact = await waitForWireSpell(
    page,
    'ether-impact',
    afterTick,
    hostOpenedBoneyard ? 30_000 : 10_000,
  )
  const screenshotPath = `${screenshotRoot}/solomon-primary-ether-boneyard-impact.png`
  await page.screenshot({ path: screenshotPath })
  await waitForAudio(
    page,
    eventStart,
    '/game/audio/sfx/magic-missile-hit.wav',
    'play',
    hostOpenedBoneyard ? 30_000 : 10_000,
  )
  return {
    aimPoint,
    flight,
    flightScreenshotPath,
    gate: { fixture: 'host-opened-boneyard' },
    heldFacing,
    heldPose,
    impact,
    screenshotPath,
    target: target.enemy,
    tracking: { fixture: 'external-authoritative-probe' },
  }
}

async function castUntargetedEtherInBoneyard(page, canvas) {
  const scene = page.locator('.boneyard-scene')
  const gate = heldFacingAcceptance || heldPoseAcceptance || combatAdmissionAcceptance
    ? await crossEntryGate(page, scene)
    : null
  const performanceBaseline = performanceAcceptance
    ? await measurePresentation(page, 800)
    : null
  const combatAdmission = heldFacingAcceptance || heldPoseAcceptance || combatAdmissionAcceptance
    ? await enableSolomonCombat(page, scene)
    : null
  const eventStart = await audioEventCount(page)
  const afterTick = await latestWireTick(page)
  const heldPoseCheckpoint = heldPoseAcceptance
    ? await oneShotPoseCheckpoint(page)
    : null
  const heldFacingCheckpoint = heldFacingAcceptance
    ? await oneShotFacingCheckpoint(page)
    : null
  const target = await castTarget(canvas, 0.5, performanceAcceptance ? 0.35 : 0.05)
  await page.mouse.move(target.x, target.y)
  const performanceStressMeasurement = performanceAcceptance
    ? await startPresentationMeasurement(page)
    : null
  await page.mouse.down({ button: 'left' })
  let launch
  try {
    launch = await waitForAudio(
      page,
      eventStart,
      '/game/audio/sfx/magic-missile.wav',
      'play',
    )
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      frame: structuredClone(
        document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame,
      ),
      latestWire: window.__primarySpellWireFrames.at(-1),
    }))
    throw new Error(`Ether launch did not begin: ${JSON.stringify(diagnostics)}`, { cause: error })
  }
  let flight = null
  let flightScreenshotPath = null
  const heldFacing = heldFacingCheckpoint
    ? await waitForHeldOneShotFacing(page, canvas, heldFacingCheckpoint)
    : null
  let heldPose = null
  if (heldPoseCheckpoint) {
    heldPose = await waitForHeldOneShotPose(page, heldPoseCheckpoint, 3)
  }
  let performanceStress = null
  if (performanceStressMeasurement) {
    await page.waitForTimeout(Math.max(
      0,
      1_600 - (Date.now() - performanceStressMeasurement.startedAt),
    ))
    performanceStress = await finishPresentationMeasurement(page, performanceStressMeasurement)
  }
  let decayedScreenshotPath = null
  if (nativePhaseExpectation) {
    await page.waitForFunction(() => {
      const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
      return frame?.playerElementEffectScale <= 1.05
    }, undefined, { timeout: 1_000 })
    decayedScreenshotPath = `${screenshotRoot}/solomon-primary-ether-boneyard-decayed-orb.png`
    await page.screenshot({ path: decayedScreenshotPath })
  }
  if (lowManaAcceptance) {
    const fizzle = await waitForAudio(page, eventStart, '/game/audio/sfx/fizzle.wav', 'play')
    assert.ok(fizzle.at <= launch.at)
    assert.equal(fizzle.volume, 1)
    assert.equal(launch.playbackRate, 0.75)
    assert.equal(launch.volume, 1)
    flight = await waitForWireSpell(page, 'ether', afterTick, 10_000)
    assert.equal(flight.state.underpowered, true)
    assertWeakEtherDamage(flight.state.damage)
    assert.ok(
      Math.abs(Math.hypot(flight.state.velocity.x, flight.state.velocity.y) - 2.4) < 0.000001,
    )
    flightScreenshotPath = `${screenshotRoot}/solomon-primary-ether-boneyard-low-flight.png`
    await page.screenshot({ path: flightScreenshotPath })
  }
  await page.mouse.up({ button: 'left' })
  if (heldPose) {
    heldPose = {
      ...heldPose,
      release: await waitForOneShotPoseRelease(page),
    }
  }
  let performance = null
  if (performanceAcceptance) {
    await page.waitForFunction(() => {
      const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
      return frame?.playerElementEffectScale <= 1.03
    }, undefined, { timeout: 5_000 })
    const restoration = await measurePresentation(page, 800)
    performance = await summarizeEtherPerformance(
      page,
      heldPoseCheckpoint,
      performanceBaseline,
      performanceStress,
      restoration,
    )
    performance = { ...performance, decayedScreenshotPath }
    if (nativePhaseExpectation) assertNativeEtherPhase(performance)
  }
  const impact = await waitForWireSpell(page, 'ether-impact', afterTick, 10_000)
  const screenshotPath = `${screenshotRoot}/solomon-primary-ether-boneyard-impact.png`
  await page.screenshot({ path: screenshotPath })
  await waitForAudio(page, eventStart, '/game/audio/sfx/magic-missile-hit.wav', 'play')
  return {
    combatAdmission,
    flight,
    flightScreenshotPath,
    gate,
    heldFacing,
    heldPose,
    impact,
    performance,
    screenshotPath,
  }
}

async function measurePresentation(page, durationMs) {
  const measurement = await startPresentationMeasurement(page)
  await page.waitForTimeout(durationMs)
  return finishPresentationMeasurement(page, measurement)
}

async function startPresentationMeasurement(page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const before = metricMap(await cdp.send('Performance.getMetrics'))
  await page.evaluate(() => {
    const presentation = window.__sdrGamePresentation
    if (!presentation) throw new Error('game presentation controls are unavailable')
    const timestamps = []
    const longTasks = []
    const unsubscribe = presentation.subscribe((now) => timestamps.push(now))
    const observer = typeof PerformanceObserver === 'function'
      ? new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) longTasks.push(entry.duration)
        })
      : null
    observer?.observe({ type: 'longtask' })
    window.__primarySpellPerformanceMeasurement = {
      finish() {
        unsubscribe()
        observer?.disconnect()
        const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
        return {
          diagnostics: frame ? {
            enemyCount: frame.enemyCount,
            playerCount: frame.playerCount,
            residentCount: frame.residentCount,
            visibleResidentCount: frame.visibleResidentCount,
          } : null,
          longTasks,
          timestamps,
        }
      },
    }
  })
  return { before, cdp, startedAt: Date.now() }
}

async function finishPresentationMeasurement(page, measurement) {
  const sample = await page.evaluate(() => {
    const active = window.__primarySpellPerformanceMeasurement
    if (!active) throw new Error('primary performance measurement is unavailable')
    delete window.__primarySpellPerformanceMeasurement
    return active.finish()
  })
  const { before, cdp } = measurement
  const after = metricMap(await cdp.send('Performance.getMetrics'))
  await cdp.detach()
  const gaps = sample.timestamps.slice(1).map(
    (timestamp, index) => timestamp - sample.timestamps[index],
  )
  const sorted = [...gaps].sort((left, right) => left - right)
  return {
    averageFps: gaps.length > 0
      ? round(gaps.length * 1_000 / (sample.timestamps.at(-1) - sample.timestamps[0]))
      : 0,
    browserTaskMs: round(((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)) * 1_000),
    frameCount: gaps.length,
    diagnostics: sample.diagnostics,
    longTaskCount: sample.longTasks.length,
    longestTaskMs: round(Math.max(0, ...sample.longTasks)),
    maximumFrameMs: round(Math.max(0, ...gaps)),
    p95FrameMs: round(percentile(sorted, 0.95)),
    p99FrameMs: round(percentile(sorted, 0.99)),
    slowFramesOver20Ms: gaps.filter((gap) => gap > 20).length,
  }
}

async function summarizeEtherPerformance(page, checkpoint, baseline, stress, restoration) {
  const phase = await page.evaluate((start) => {
    const samples = window.__primarySpellPoseSamples.slice(start.poseSampleIndex)
    const casts = window.__primarySpellWireFrames.slice(start.wireFrameIndex)
      .map((wire) => ({ ...wire.players[start.playerId]?.primaryCast, tick: wire.tick }))
      .filter(({ emissionSequence }) => Number.isInteger(emissionSequence))
    const emissions = []
    let sequence = start.emissionSequence
    for (const cast of casts) {
      if (cast.emissionSequence <= sequence) continue
      sequence = cast.emissionSequence
      emissions.push({ sequence, tick: cast.tick })
    }
    const scales = samples
      .map(({ playerElementEffectScale }) => playerElementEffectScale)
      .filter(Number.isFinite)
    const lights = samples.map(({ playerLightRadius }) => playerLightRadius).filter(Number.isFinite)
    const firstTick = emissions[0]?.tick ?? Number.POSITIVE_INFINITY
    const secondTick = emissions[1]?.tick ?? Number.POSITIVE_INFINITY
    const windupScales = samples
      .filter(({ actionTick, emissionSequence }) => (
        actionTick !== null && actionTick >= 0 && emissionSequence === start.emissionSequence
      ))
      .map(({ playerElementEffectScale }) => playerElementEffectScale)
      .filter(Number.isFinite)
    const betweenScales = samples
      .filter(({ tick }) => tick > firstTick && tick < secondTick)
      .map(({ playerElementEffectScale }) => playerElementEffectScale)
      .filter(Number.isFinite)
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return {
      emissionGaps: emissions.slice(1).map(({ tick }, index) => tick - emissions[index].tick),
      emissionTicks: emissions.map(({ tick }) => tick),
      finalElementEffectScale: frame?.playerElementEffectScale ?? null,
      finalLightRadius: frame?.playerLightRadius ?? null,
      maximumElementEffectScale: Math.max(0, ...scales),
      maximumLightRadius: Math.max(0, ...lights),
      maximumWindupScale: Math.max(0, ...windupScales),
      minimumBetweenEmissionScale: Math.min(Number.POSITIVE_INFINITY, ...betweenScales),
      orbSpriteCountRange: [
        Math.min(...samples.map(({ orbSpriteCount }) => orbSpriteCount).filter(Number.isFinite)),
        Math.max(...samples.map(({ orbSpriteCount }) => orbSpriteCount).filter(Number.isFinite)),
      ],
      sampleCount: samples.length,
    }
  }, checkpoint)
  return { baseline, phase, restoration, stress }
}

function assertNativeEtherPhase(performance) {
  assert.ok(performance.baseline.frameCount > 30, JSON.stringify(performance))
  assert.ok(performance.stress.frameCount > 30, JSON.stringify(performance))
  assert.ok(performance.restoration.frameCount > 30, JSON.stringify(performance))
  assert.equal(performance.baseline.diagnostics?.playerCount, 1)
  assert.equal(performance.stress.diagnostics?.playerCount, 1)
  assert.equal(performance.restoration.diagnostics?.playerCount, 1)
  assert.equal(
    performance.stress.diagnostics?.enemyCount,
    performance.restoration.diagnostics?.enemyCount,
  )
  assert.equal(
    performance.stress.diagnostics?.residentCount,
    performance.restoration.diagnostics?.residentCount,
  )
  assert.deepEqual(performance.phase.emissionGaps.slice(0, 2), [55, 55])
  assert.ok(performance.phase.maximumWindupScale <= 1.001, JSON.stringify(performance.phase))
  assert.ok(
    performance.phase.maximumElementEffectScale > 1.1
      && performance.phase.maximumElementEffectScale <= 2.51,
    JSON.stringify(performance.phase),
  )
  assert.ok(performance.phase.minimumBetweenEmissionScale <= 1.05, JSON.stringify(performance.phase))
  assert.ok(performance.phase.maximumLightRadius > 2.6, JSON.stringify(performance.phase))
  assert.ok(performance.phase.finalElementEffectScale <= 1.03, JSON.stringify(performance.phase))
}

function metricMap(result) {
  return Object.fromEntries(result.metrics.map(({ name, value }) => [name, value]))
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]
}

function round(value) {
  return Math.round(value * 100) / 100
}

async function castWaterInBoneyard(page) {
  const canvas = await enterBoneyard(page)
  const scene = page.locator('.boneyard-scene')
  const gate = hostOpenedBoneyard
    ? { fixture: 'host-opened-boneyard' }
    : await crossEntryGate(page, scene)
  const combatAdmission = hostOpenedBoneyard
    ? await page.waitForFunction(() => (
        document.querySelector('.boneyard-scene')
          ?.getAttribute('data-combat-enabled') === 'true'
      ), undefined, { timeout: 90_000 }).then(() => ({ fixture: 'host-opened-boneyard' }))
    : await enableSolomonCombat(page, scene)
  const eventStart = await audioEventCount(page)
  const target = await castTarget(canvas, 0.67, 0.38)
  await page.mouse.move(target.x, target.y)
  await page.mouse.down({ button: 'left' })
  await waitForAudio(page, eventStart, '/game/audio/sfx/ice-start.wav', 'play')
  const loop = await waitForAudio(page, eventStart, '/game/audio/sfx/ice-loop.wav', 'play')
  assert.equal(loop.loop, true)
  const held = await waitForBoneyardSpell(page, 'water')
  if (lowManaAcceptance) assert.ok(held.localPlayerMana <= 0.1)
  const wire = await latestWireSpell(page, 'water')
  if (lowManaAcceptance) {
    assert.equal(wire.playerUnderpowered, true)
    assert.equal(wire.state.underpowered, true)
  }
  assert.equal(wire.state.obstructionPoint === null || (
    Number.isFinite(wire.state.obstructionPoint.x)
      && Number.isFinite(wire.state.obstructionPoint.y)
  ), true)
  await page.waitForTimeout(250)
  const heldScreenshotPath = `${screenshotRoot}/solomon-primary-water-boneyard-held.png`
  await page.screenshot({ path: heldScreenshotPath })
  await page.mouse.up({ button: 'left' })
  await waitForAudio(page, eventStart, '/game/audio/sfx/ice-loop.wav', 'pause')
  return { combatAdmission, gate, held, heldScreenshotPath, wire }
}

async function latestWireTick(page) {
  return page.evaluate(() => window.__primarySpellWireFrames.at(-1)?.tick ?? -1)
}

async function targetedAirWire(page, afterTick) {
  return page.evaluate((minimumTick) => {
    for (let index = window.__primarySpellWireFrames.length - 1; index >= 0; index -= 1) {
      const wire = window.__primarySpellWireFrames[index]
      if (wire.tick <= minimumTick) break
      const state = [...wire.primarySpells.transients].reverse().find((candidate) => {
        const playerTargetId = wire.players[candidate.ownerId]?.primaryCast.targetId
        return candidate.kind === 'air'
          && typeof candidate.targetId === 'string'
          && candidate.targetId.startsWith('scenery:')
          && candidate.targetId === playerTargetId
      })
      if (!state) continue
      return {
        playerTargetId: wire.players[state.ownerId]?.primaryCast.targetId ?? null,
        state,
        tick: wire.tick,
      }
    }
    return null
  }, afterTick)
}

async function crossEntryGate(page, scene) {
  const gate = await alignWithEntryGate(page, scene)
  await settleMovement(page)
  const initialY = Number(await scene.getAttribute('data-local-player-y'))
  const initialGateState = await scene.getAttribute('data-gate-state')
  const direction = Math.sign(gate.targetY - initialY)
  assert.notEqual(direction, 0, 'expected the entry gate to be beyond the player')
  const key = direction < 0 ? 'w' : 's'
  const crossingDistance = Math.abs(gate.targetY - initialY) + 35
  await page.bringToFront()
  await page.keyboard.down(key)
  try {
    await page.waitForFunction(
      ({ distance, initial, sign }) => {
        const value = Number(document.querySelector('.boneyard-scene')
          ?.getAttribute('data-local-player-y'))
        return Number.isFinite(value) && (value - initial) * sign > distance
      },
      { distance: crossingDistance, initial: initialY, sign: direction },
      { timeout: 15_000 },
    )
  } finally {
    await page.keyboard.up(key)
  }
  await settleMovement(page)
  const finalGateState = await scene.getAttribute('data-gate-state')
  const finalY = Number(await scene.getAttribute('data-local-player-y'))
  assert.notEqual(finalGateState, initialGateState)
  return { ...gate, direction, finalY, initialY }
}

async function enableSolomonCombat(page, scene) {
  if (await scene.getAttribute('data-combat-enabled') === 'true') {
    return { phase: await scene.getAttribute('data-solomon-phase'), alreadyEnabled: true }
  }
  const deadline = Date.now() + 120_000
  let bestDistance = Number.POSITIVE_INFINITY
  let stalledPulses = 0
  let sidestepSign = 1
  let pulses = 0
  while (Date.now() < deadline) {
    const receipt = await solomonApproachReceipt(scene)
    if (receipt.phase !== 'digging') break
    const dx = receipt.solomonX - receipt.playerX
    const dy = receipt.solomonY - receipt.playerY
    const keys = movementKeys(dx, dy)
    assert.ok(keys.length > 0, 'expected movement toward Solomon')
    await pulseBoneyardMovement(page, keys, Math.min(500, Math.max(150, receipt.distance * 2)))
    const after = await solomonApproachReceipt(scene)
    pulses += 1
    if (after.phase !== 'digging') break
    if (after.distance < bestDistance - 5) {
      bestDistance = after.distance
      stalledPulses = 0
      continue
    }
    stalledPulses += 1
    if (stalledPulses < 3) continue
    const sideKeys = movementKeys(-dy * sidestepSign, dx * sidestepSign)
    await pulseBoneyardMovement(page, sideKeys, 650)
    sidestepSign *= -1
    stalledPulses = 0
  }

  const contact = await solomonApproachReceipt(scene)
  assert.notEqual(contact.phase, 'digging', `could not reach Solomon: ${JSON.stringify(contact)}`)
  const awayKeys = movementKeys(
    contact.playerX - contact.solomonX,
    contact.playerY - contact.solomonY,
  )
  assert.ok(awayKeys.length > 0, 'expected movement away from Solomon')
  await page.bringToFront()
  for (const key of awayKeys) await page.keyboard.down(key)
  try {
    await page.waitForFunction(() => (
      document.querySelector('.boneyard-scene')?.getAttribute('data-combat-enabled') === 'true'
    ), undefined, { timeout: 30_000 })
  } finally {
    for (const key of awayKeys.reverse()) await page.keyboard.up(key)
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  }
  return {
    alreadyEnabled: false,
    contact,
    phase: await scene.getAttribute('data-solomon-phase'),
    pulses,
    runEventId: Number(await scene.getAttribute('data-solomon-run-event-id')),
  }
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

function movementKeys(x, y) {
  const keys = []
  const scale = Math.max(Math.abs(x), Math.abs(y), 1)
  if (Math.abs(x) / scale >= 0.25) keys.push(x > 0 ? 'd' : 'a')
  if (Math.abs(y) / scale >= 0.25) keys.push(y > 0 ? 's' : 'w')
  return keys
}

async function pulseBoneyardMovement(page, keys, durationMs) {
  await page.bringToFront()
  for (const key of keys) await page.keyboard.down(key)
  try {
    await page.waitForTimeout(durationMs)
  } finally {
    for (const key of keys.reverse()) await page.keyboard.up(key)
  }
  await page.waitForTimeout(80)
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
  const delta = target.x - initialX
  if (Math.abs(delta) > 3) {
    const direction = Math.sign(delta)
    const key = direction > 0 ? 'd' : 'a'
    await page.keyboard.down(key)
    try {
      await page.waitForFunction(
        ({ initial, sign, targetX }) => {
          const value = Number(document.querySelector('.boneyard-scene')
            ?.getAttribute('data-local-player-x'))
          return Number.isFinite(value)
            && (value - initial) * sign >= Math.abs(targetX - initial) - 3
        },
        { initial: initialX, sign: direction, targetX: target.x },
        { timeout: 30_000 },
      )
    } finally {
      await page.keyboard.up(key)
    }
  }
  const alignedY = Number(await scene.getAttribute('data-local-player-y'))
  const direction = Math.sign(target.y - alignedY)
  const approachY = target.y - direction * 60
  const approachDelta = approachY - alignedY
  if (direction !== 0 && Math.abs(approachDelta) > 3) {
    const key = approachDelta < 0 ? 'w' : 's'
    await page.keyboard.down(key)
    try {
      await page.waitForFunction(
        ({ initial, sign, targetY }) => {
          const value = Number(document.querySelector('.boneyard-scene')
            ?.getAttribute('data-local-player-y'))
          return Number.isFinite(value)
            && (value - initial) * sign >= Math.abs(targetY - initial) - 3
        },
        { initial: alignedY, sign: Math.sign(approachDelta), targetY: approachY },
        { timeout: 15_000 },
      )
    } finally {
      await page.keyboard.up(key)
    }
  }
  return {
    playerX: Number(await scene.getAttribute('data-local-player-x')),
    playerY: Number(await scene.getAttribute('data-local-player-y')),
    targetX: target.x,
    targetY: target.y,
  }
}

async function visibleGravestones(page, frame) {
  return page.evaluate((currentFrame) => {
    const objects = window.__primarySpellBoneyard?.scene?.objects ?? []
    return objects.filter((object) => {
      if (object.typeId !== 2029) return false
      const x = currentFrame.playerScreenX + (object.pos.x - currentFrame.playerX) * 1.35
      const y = currentFrame.playerScreenY + (object.pos.y - currentFrame.playerY) * 1.35
      return x >= 30 && x <= 1_570 && y >= 30 && y <= 870
    }).toSorted((left, right) => (
      Math.hypot(left.pos.x - currentFrame.playerX, left.pos.y - currentFrame.playerY)
        - Math.hypot(right.pos.x - currentFrame.playerX, right.pos.y - currentFrame.playerY)
    ))
  }, frame)
}

function canvasScreenPoint(bounds, logical) {
  return {
    x: bounds.x + logical.x / 1_600 * bounds.width,
    y: bounds.y + logical.y / 900 * bounds.height,
  }
}

function worldScreenPoint(bounds, frame, world) {
  return canvasScreenPoint(bounds, {
    x: frame.playerScreenX + (world.x - frame.playerX) * 1.35,
    y: frame.playerScreenY + (world.y - frame.playerY) * 1.35,
  })
}

async function boneyardFrame(page) {
  return page.locator('.boneyard-world-canvas').evaluate((node) => (
    structuredClone(node.__sdrBoneyardFrame)
  ))
}

async function visibleBoneyardEnemy(page, preferWeakest = false) {
  const handle = await page.waitForFunction((weakestFirst) => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    if (!frame || !Number.isFinite(frame.playerX) || !Number.isFinite(frame.playerY)) return null
    const visible = frame.enemySamples.filter((enemy) => {
      if (enemy.currentHealth <= 0) return false
      const x = frame.playerScreenX + (enemy.x - frame.playerX) * 1.35
      const y = frame.playerScreenY + (enemy.y - frame.playerY) * 1.35
      return x >= 100 && x <= 1_500 && y >= 100 && y <= 800
    }).toSorted((left, right) => weakestFirst
      ? left.currentHealth - right.currentHealth
        || Math.hypot(left.x - frame.playerX, left.y - frame.playerY)
          - Math.hypot(right.x - frame.playerX, right.y - frame.playerY)
      : Math.hypot(right.x - frame.playerX, right.y - frame.playerY)
        - Math.hypot(left.x - frame.playerX, left.y - frame.playerY))
    return visible.length > 0
      ? { enemy: { ...visible[0] }, frame: structuredClone(frame) }
      : null
  }, preferWeakest, { timeout: 30_000 })
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function settleMovement(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
  await page.waitForTimeout(650)
}

async function oneShotPoseCheckpoint(page) {
  return page.evaluate(() => {
    const playerId = window.__primarySpellLocalPlayerId
    const wire = window.__primarySpellWireFrames.at(-1)
    const cast = playerId ? wire?.players[playerId]?.primaryCast : null
    if (!playerId || !cast) throw new Error('Local one-shot cast wire is unavailable')
    return {
      emissionSequence: cast.emissionSequence,
      playerId,
      poseSampleIndex: window.__primarySpellPoseSamples.length,
      wireFrameIndex: window.__primarySpellWireFrames.length,
    }
  })
}

async function oneShotFacingCheckpoint(page) {
  return page.evaluate(() => {
    const playerId = window.__primarySpellLocalPlayerId
    const wire = window.__primarySpellWireFrames.at(-1)
    const player = playerId ? wire?.players[playerId] : null
    if (!playerId || !player || !wire) {
      throw new Error('Local one-shot facing wire is unavailable')
    }
    return {
      aimDirection: { ...player.primaryCast.aimDirection },
      emissionSequence: player.primaryCast.emissionSequence,
      headingIndex: player.headingIndex,
      playerId,
      tick: wire.tick,
    }
  })
}

async function waitForHeldOneShotFacing(page, canvas, checkpoint) {
  const baselineHandle = await page.waitForFunction((start) => {
    for (const wire of window.__primarySpellWireFrames) {
      if (wire.tick <= start.tick) continue
      const player = wire.players[start.playerId]
      if (
        player?.primaryCast.held === true
        && player.primaryCast.emissionSequence > start.emissionSequence
      ) {
        return {
          aimDirection: { ...player.primaryCast.aimDirection },
          castSequence: player.primaryCast.castSequence,
          emissionSequence: player.primaryCast.emissionSequence,
          headingIndex: player.headingIndex,
          tick: wire.tick,
        }
      }
    }
    return null
  }, checkpoint, { timeout: 10_000 })
  const baseline = await baselineHandle.jsonValue()
  await baselineHandle.dispose()

  const target = await castTarget(canvas, 0.82, 0.55)
  await page.mouse.move(target.x, target.y)
  let trackedHandle
  try {
    trackedHandle = await page.waitForFunction(([playerId, before]) => {
      const headingIndexFor = (direction) => {
        const degrees = (
          Math.atan2(direction.x, -direction.y) * 180 / Math.PI + 360
        ) % 360
        return Math.floor((degrees + 7.5) / 15) % 24
      }
      for (const wire of window.__primarySpellWireFrames) {
        if (wire.tick <= before.tick) continue
        const player = wire.players[playerId]
        const cast = player?.primaryCast
        if (
          !player
          || cast?.held !== true
          || cast.castSequence !== before.castSequence
          || cast.emissionSequence !== before.emissionSequence
        ) continue
        const expectedHeadingIndex = headingIndexFor(cast.aimDirection)
        const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
        if (
          expectedHeadingIndex !== before.headingIndex
          && player.headingIndex === expectedHeadingIndex
          && frame?.playerHeadingIndex === expectedHeadingIndex
        ) {
          return {
            actionTick: cast.actionTick,
            aimDirection: { ...cast.aimDirection },
            castSequence: cast.castSequence,
            emissionSequence: cast.emissionSequence,
            expectedHeadingIndex,
            renderedHeadingIndex: frame.playerHeadingIndex,
            tick: wire.tick,
            wireHeadingIndex: player.headingIndex,
          }
        }
      }
      return null
    }, [checkpoint.playerId, baseline], { timeout: 10_000 })
  } catch (error) {
    const diagnostics = await page.evaluate(([playerId, before]) => ({
      frame: structuredClone(
        document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame,
      ),
      wires: window.__primarySpellWireFrames
        .filter(({ tick }) => tick > before.tick)
        .slice(-40)
        .map((wire) => {
          const player = wire.players[playerId]
          return {
            actionTick: player?.primaryCast.actionTick ?? null,
            aimDirection: player ? { ...player.primaryCast.aimDirection } : null,
            castSequence: player?.primaryCast.castSequence ?? null,
            emissionSequence: player?.primaryCast.emissionSequence ?? null,
            headingIndex: player?.headingIndex ?? null,
            held: player?.primaryCast.held ?? null,
            tick: wire.tick,
          }
        }),
    }), [checkpoint.playerId, baseline])
    const failureScreenshotPath = `${screenshotRoot}/solomon-primary-ether-held-facing-failure.png`
    await page.screenshot({ path: failureScreenshotPath })
    throw new Error(
      `Held Ether did not track before its next action: ${JSON.stringify({
        baseline,
        diagnostics,
        failureScreenshotPath,
        target,
      })}`,
      { cause: error },
    )
  }
  const tracked = await trackedHandle.jsonValue()
  await trackedHandle.dispose()

  assert.equal(tracked.castSequence, baseline.castSequence)
  assert.equal(tracked.emissionSequence, baseline.emissionSequence)
  assert.notEqual(tracked.wireHeadingIndex, baseline.headingIndex)
  assert.equal(tracked.renderedHeadingIndex, tracked.expectedHeadingIndex)
  const screenshotPath = `${screenshotRoot}/solomon-primary-ether-held-facing.png`
  await page.screenshot({ path: screenshotPath })
  return { baseline, screenshotPath, target, tracked }
}

async function waitForHeldOneShotPose(page, checkpoint, minimumEmissions) {
  const targetEmission = checkpoint.emissionSequence + minimumEmissions
  await page.waitForFunction(([playerId, target]) => {
    const wire = window.__primarySpellWireFrames.at(-1)
    return (wire?.players[playerId]?.primaryCast.emissionSequence ?? -1) >= target
  }, [checkpoint.playerId, targetEmission], { timeout: 10_000 })

  const receipt = await page.evaluate((start) => {
    const samples = window.__primarySpellPoseSamples.slice(start.poseSampleIndex)
    const firstReleaseIndex = samples.findIndex(({ playerAttachmentPose }) => (
      playerAttachmentPose === 8
    ))
    const heldSamples = firstReleaseIndex < 0 ? [] : samples.slice(firstReleaseIndex)
    const wireCasts = window.__primarySpellWireFrames
      .slice(start.wireFrameIndex)
      .map((wire) => ({
        ...wire.players[start.playerId]?.primaryCast,
        tick: wire.tick,
      }))
    const firstLatchedIndex = wireCasts.findIndex(({ oneShotAttackPoseHeld }) => (
      oneShotAttackPoseHeld === true
    ))
    return {
      heldSamples,
      wireCasts: firstLatchedIndex < 0 ? [] : wireCasts.slice(firstLatchedIndex),
    }
  }, checkpoint)

  assert.ok(
    receipt.heldSamples.length >= 8,
    `expected repeated rendered held-pose samples: ${JSON.stringify(receipt)}`,
  )
  assert.ok(
    new Set(receipt.heldSamples.map(({ tick }) => tick)).size >= 3,
    'expected the held pose across multiple authoritative ticks',
  )
  assert.ok(
    receipt.heldSamples.every(({ playerAttachmentPose }) => playerAttachmentPose === 8),
    `one-shot pose left K=8 while held: ${JSON.stringify(receipt.heldSamples)}`,
  )
  assert.ok(receipt.wireCasts.length >= 3, 'expected repeated authoritative burst samples')
  assert.ok(receipt.wireCasts.every((cast) => (
    cast.held === true
    && cast.oneShotAttackPoseHeld === true
    && cast.actionTick !== -1
  )), `held one-shot wire reset: ${JSON.stringify(receipt.wireCasts)}`)
  const scene = await page.locator('.boneyard-world-canvas').count() > 0
    ? 'boneyard'
    : 'hub'
  const rendering = await page.locator(
    scene === 'boneyard' ? '.boneyard-world-canvas' : '.hub-world-canvas',
  ).evaluate((node) => {
    const gl = node.getContext('webgl2') ?? node.getContext('webgl')
    if (!gl) return { context: null, renderer: node.dataset.rendererName ?? null }
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    return {
      context: typeof WebGL2RenderingContext !== 'undefined'
        && gl instanceof WebGL2RenderingContext
        ? 'webgl2'
        : 'webgl',
      renderer: node.dataset.rendererName ?? null,
      unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
    }
  })
  const screenshotPath = `${screenshotRoot}/solomon-primary-ether-${scene}-held-pose.png`
  await page.screenshot({ path: screenshotPath })
  return {
    emissionSequenceEnd: receipt.wireCasts.at(-1).emissionSequence,
    emissionSequenceStart: checkpoint.emissionSequence,
    heldSampleCount: receipt.heldSamples.length,
    heldTickCount: new Set(receipt.heldSamples.map(({ tick }) => tick)).size,
    rendering,
    screenshotPath,
    wireSampleCount: receipt.wireCasts.length,
  }
}

async function waitForOneShotPoseRelease(page) {
  const handle = await page.waitForFunction((playerId) => {
    const node = document.querySelector('.boneyard-world-canvas')
      ?? document.querySelector('.hub-world-canvas')
    const frame = node?.__sdrHubFrame ?? node?.__sdrBoneyardFrame
    const wire = window.__primarySpellWireFrames.at(-1)
    const cast = wire?.players[playerId]?.primaryCast
    return frame?.playerAttachmentPose === 0
      && cast?.held === false
      && cast?.oneShotAttackPoseHeld === false
      && cast?.actionTick === -1
      ? { cast: { ...cast }, frame: { ...frame } }
      : null
  }, await page.evaluate(() => window.__primarySpellLocalPlayerId), { timeout: 10_000 })
  const receipt = await handle.jsonValue()
  await handle.dispose()
  return {
    actionTick: receipt.cast.actionTick,
    attachmentPose: receipt.frame.playerAttachmentPose,
    oneShotAttackPoseHeld: receipt.cast.oneShotAttackPoseHeld,
    tick: receipt.frame.tick,
  }
}

async function waitForHubCastPose(page, eventStart, expectedPose) {
  let handle
  try {
    handle = await page.waitForFunction(([start, pose]) => (
      window.__primarySpellPoseEvents.slice(start).find(
        (event) => event.playerAttachmentPose === pose,
      ) ?? null
    ), [eventStart, expectedPose], { timeout: 5_000 })
  } catch (error) {
    const diagnostics = await page.evaluate((start) => ({
      audioEvents: window.__primarySpellAudioEvents,
      frame: { ...document.querySelector('.hub-world-canvas')?.__sdrHubFrame },
      poseEvents: window.__primarySpellPoseEvents.slice(start),
      wireFrames: window.__primarySpellWireFrames.slice(-5),
    }), eventStart)
    throw new Error(`Hub cast pose ${expectedPose} was not observed: ${JSON.stringify(diagnostics)}`, {
      cause: error,
    })
  }
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function waitForHubSpell(page, kind) {
  const expectedKinds = Array.isArray(kind) ? kind : [kind]
  let handle
  try {
    handle = await page.waitForFunction(
      (kinds) => {
        const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
        return kinds.some((expectedKind) => frame?.primarySpellKinds?.includes(expectedKind))
          ? { ...frame, playerPositions: { ...frame.playerPositions } }
          : null
      },
      expectedKinds,
      { timeout: 10_000 },
    )
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      audioEvents: window.__primarySpellAudioEvents,
      element: document.querySelector('.hub-scene')?.getAttribute('data-element'),
      frame: { ...document.querySelector('.hub-world-canvas')?.__sdrHubFrame },
      rendererState: document.querySelector('.hub-scene')?.getAttribute('data-renderer-state'),
    }))
    throw new Error(`Hub ${kind} cast was not observed: ${JSON.stringify(diagnostics)}`, {
      cause: error,
    })
  }
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function waitForHubFacing(page, kind, expectedHeadingIndex) {
  const expectedKinds = Array.isArray(kind) ? kind : [kind]
  let handle
  try {
    handle = await page.waitForFunction(
      ([kinds, heading]) => {
        const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
        return kinds.some((expectedKind) => frame?.primarySpellKinds?.includes(expectedKind))
          && frame.playerHeadingIndex === heading
          ? { ...frame, playerPositions: { ...frame.playerPositions } }
          : null
      },
      [expectedKinds, expectedHeadingIndex],
      { timeout: 10_000 },
    )
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      frame: { ...document.querySelector('.hub-world-canvas')?.__sdrHubFrame },
      wireFrames: window.__primarySpellWireFrames.slice(-8),
    }))
    throw new Error(
      `Hub ${kind} facing ${expectedHeadingIndex} was not rendered: ${JSON.stringify(diagnostics)}`,
      { cause: error },
    )
  }
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function waitForBoneyardSpell(page, kind) {
  const expectedKinds = Array.isArray(kind) ? kind : [kind]
  let handle
  try {
    handle = await page.waitForFunction(
      (kinds) => {
        const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
        return kinds.some((expectedKind) => frame?.primarySpellKinds?.includes(expectedKind))
          ? { ...frame }
          : null
      },
      expectedKinds,
      { timeout: 10_000 },
    )
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      body: document.body.innerText.slice(0, 1_000),
      frame: structuredClone(
        document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame,
      ),
      latestWire: window.__primarySpellWireFrames.at(-1),
      skillPicker: Boolean(document.querySelector('.skill-picker-stage')),
    }))
    throw new Error(`Boneyard ${expectedKinds.join(', ')} was not rendered: ${JSON.stringify(diagnostics)}`, {
      cause: error,
    })
  }
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function captureHubEarthStage(page, screenshotPath) {
  const wire = await latestWireSpell(page, 'earth')
  const presentation = await page.evaluate(async (state) => {
    const { earthBoulderPresentationPlan } = await import(
      '/src/game/renderer/earth-boulder-presentation.ts'
    )
    const plan = earthBoulderPresentationPlan(state)
    return {
      assemblyCharge: state.assemblyCharge,
      auraAlpha: plan.aura.alpha,
      bodyAlpha: plan.bodyAlpha,
      mainRockCount: plan.rocks.length,
      openingFlashAlpha: plan.openingFlash.alpha,
      sortBias: plan.sortBias,
      visualOffset: plan.visualOffset,
    }
  }, wire.state)
  const frame = await page.evaluate(() => ({
    ...document.querySelector('.hub-world-canvas')?.__sdrHubFrame,
  }))
  await page.screenshot({ path: screenshotPath })
  return {
    frame,
    presentation: { ...presentation, calledRockCount: wire.calledRockCount },
    wire,
  }
}

async function captureLowManaPresentation(page, wire) {
  return page.evaluate(async ({ state }) => {
    switch (state.kind) {
      case 'ether': {
        const { etherPrimaryCompositorPlan, etherPrimaryFlightPlan } = await import(
          '/src/game/renderer/primary-spell-ether-native.ts'
        )
        const weak = etherPrimaryFlightPlan(
          state.id,
          state.ageTicks,
          state.speed,
          state.visualScale,
          true,
        )
        const fullAlphaAtWeakPhase = etherPrimaryCompositorPlan(
          state.id,
          Math.floor(state.ageTicks),
          weak.phase,
          state.visualScale,
          1,
        )
        return {
          alphaHalved: weak.draws.every((draw, index) => (
            draw.alpha === Math.fround(fullAlphaAtWeakPhase.draws[index].alpha * 0.5)
          )),
          kind: state.kind,
          underpowered: state.underpowered,
        }
      }
      case 'fire': {
        const {
          nativeFireballLightSource,
          nativeFireballPlan,
        } = await import('/src/game/renderer/primary-spell-fire-native.ts')
        const normalState = { ...state, underpowered: false }
        const normal = nativeFireballPlan(normalState)
        const weak = nativeFireballPlan(state)
        return {
          alphaRatios: weak.draws.map((draw, index) => (
            draw.alpha / normal.draws[index].alpha
          )),
          kind: state.kind,
          lightUnchanged: JSON.stringify(nativeFireballLightSource(state, state.ageTicks))
            === JSON.stringify(nativeFireballLightSource(normalState, state.ageTicks)),
          underpowered: state.underpowered,
        }
      }
      case 'air': {
        const { buildNativeAirLightningPlan } = await import(
          '/src/game/renderer/primary-spell-air-native.ts'
        )
        const plan = buildNativeAirLightningPlan({
          ageTicks: state.ageTicks,
          birthTick: state.birthTick,
          endpoint: {
            x: state.endpoint.x - state.origin.x,
            y: state.endpoint.y - state.origin.y,
          },
          id: state.id,
          midpoint: {
            x: state.midpoint.x - state.origin.x,
            y: state.midpoint.y - state.origin.y,
          },
          source: { x: 0, y: 0 },
          underpowered: state.underpowered,
        })
        return {
          bodyLayers: plan.body?.layers.map(({ alpha, phaseOffset, tint, width }) => ({
            alpha,
            phaseOffset,
            tint,
            width,
          })) ?? [],
          contactAlpha: plan.contactCorona.alpha,
          contactLight: plan.contactLight,
          kind: state.kind,
          underpowered: state.underpowered,
        }
      }
      case 'water': {
        const { waterFrostJetPlan } = await import(
          '/src/game/core-kernels/primary-spell-water.ts'
        )
        const plan = waterFrostJetPlan(state)
        return {
          draws: plan.draws.map(({ alpha, pass }) => ({ alpha, pass })),
          kind: state.kind,
          particleClass: plan.kind,
          underpowered: state.underpowered,
        }
      }
      case 'earth':
        return {
          charge: state.charge,
          damage: state.damage,
          hasPersistentUnderpoweredFlag: 'underpowered' in state,
          kind: state.kind,
        }
      default:
        throw new Error(`Unexpected low-mana presentation kind: ${state.kind}`)
    }
  }, wire)
}

function assertLowManaWire(kind, wire, presentation) {
  assert.equal(wire.playerUnderpowered, true)
  assert.ok(wire.minimumCurrentMana <= 0.1)
  assert.equal(presentation.kind, kind)
  switch (kind) {
    case 'ether':
      assert.equal(wire.state.underpowered, true)
      assertWeakEtherDamage(wire.state.damage)
      assert.ok(
        Math.abs(Math.hypot(wire.state.velocity.x, wire.state.velocity.y) - 2.4) < 0.000001,
      )
      assert.equal(presentation.alphaHalved, true)
      break
    case 'fire':
      assert.equal(wire.state.underpowered, true)
      assert.equal(wire.state.damage, 2)
      assert.deepEqual(presentation.alphaRatios, [0.5, 0.5, 0.5])
      assert.equal(presentation.lightUnchanged, true)
      break
    case 'air':
      assert.equal(wire.state.underpowered, true)
      assert.deepEqual(presentation.bodyLayers, [
        { alpha: 0.5, phaseOffset: 0, tint: 0x80ffff, width: 0.75 },
        { alpha: 0.25, phaseOffset: 15, tint: 0x00ffff, width: 0.5625 },
      ])
      break
    case 'water':
      assert.equal(wire.state.underpowered, true)
      assert.equal(presentation.particleClass, 'normal')
      assert.deepEqual(presentation.draws.map(({ pass }) => pass), ['core', 'additive-core'])
      break
    case 'earth':
      assert.equal(presentation.hasPersistentUnderpoweredFlag, false)
      assert.ok(wire.state.charge <= 0.30125)
      assert.ok(wire.state.damage <= 5)
      break
    default:
      throw new Error(`Unexpected low-mana wire kind: ${kind}`)
  }
}

function assertWeakEtherDamage(damage) {
  assert.ok(damage >= 0.5 && damage <= 1)
  assert.equal(Number.isInteger(damage * 2), true)
}

function assertLowManaAudio(kind, events) {
  const find = (filename) => events.find((event) => audioPathMatches(event.source, filename))
  if (kind === 'ether' || kind === 'fire') {
    const fizzle = find('fizzle.wav')
    const launch = find(kind === 'ether' ? 'magic-missile.wav' : 'throw-fire.wav')
    assert.ok(fizzle)
    assert.ok(launch)
    assert.ok(events.indexOf(fizzle) < events.indexOf(launch))
    assert.equal(fizzle.playbackRate, 1)
    assert.equal(fizzle.volume, 1)
    assert.equal(launch.playbackRate, 0.75)
    assert.equal(launch.volume, 1)
    return
  }
  if (kind === 'air' || kind === 'water') {
    const loop = find(kind === 'air' ? 'lightning-loop.wav' : 'ice-loop.wav')
    assert.ok(loop)
    assert.equal(loop.volume, kind === 'air' ? 0.75 : 0.5)
    return
  }
  const fizzle = find('fizzle.wav')
  assert.ok(fizzle)
  assert.equal(fizzle.playbackRate, 0.5)
  assert.ok(fizzle.volume > 0 && fizzle.volume <= 0.5)
}

function audioPathMatches(pathname, filename) {
  const actual = pathname.split('/').at(-1)
  const extensionAt = filename.lastIndexOf('.')
  const stem = filename.slice(0, extensionAt)
  const extension = filename.slice(extensionAt)
  return actual === filename || (
    actual.startsWith(`${stem}-`) && actual.endsWith(extension)
  )
}

async function latestWireSpell(page, kind, projectileOnly = false) {
  const expectedKinds = Array.isArray(kind) ? kind : [kind]
  return page.evaluate(async ([kinds, requireProjectile]) => {
    const observedAttachmentPoses = window.__primarySpellPoseEvents.map(
      ({ playerAttachmentPose }) => playerAttachmentPose,
    )
    for (let index = window.__primarySpellWireFrames.length - 1; index >= 0; index -= 1) {
      const wire = window.__primarySpellWireFrames[index]
      const states = [
        ...wire.primarySpells.projectiles,
        ...wire.primarySpells.transients,
      ]
      const projectile = [...wire.primarySpells.projectiles].reverse().find(
        (candidate) => kinds.includes(candidate.kind),
      )
      const state = projectile ?? (requireProjectile ? undefined : (
        [...wire.primarySpells.transients].reverse().find(
          (candidate) => kinds.includes(candidate.kind),
        )
      ))
      if (state) {
        const player = wire.players[state.ownerId]
        if (!player) throw new Error(`No wire player owns primary spell ${state.id}`)
        const manaSamples = window.__primarySpellWireFrames.flatMap((sample) => {
          const ownsState = [
            ...sample.primarySpells.projectiles,
            ...sample.primarySpells.transients,
          ].some((candidate) => candidate.id === state.id)
          const owner = ownsState ? sample.players[state.ownerId] : null
          return owner ? [owner.progression.currentMana] : []
        })
        return {
          castAimDirection: player.primaryCast.aimDirection,
          calledRockCount: states.filter((candidate) => (
            candidate.kind === 'earth-called-rock'
            && candidate.parentId === state.id
          )).length,
          observedAttachmentPoses,
          currentMana: player.progression.currentMana,
          minimumCurrentMana: Math.min(...manaSamples),
          playerAttachmentPose: window.__primarySpellPoseEvents.at(-1)
            ?.playerAttachmentPose ?? 0,
          projectileCount: wire.primarySpells.projectiles.length,
          playerHeadingIndex: player.headingIndex,
          playerUnderpowered: player.primaryCast.underpowered,
          state,
          tick: wire.tick,
          transientCount: wire.primarySpells.transients.length,
        }
      }
    }
    throw new Error(`No wire spell matched ${kinds.join(', ')}`)
  }, [expectedKinds, projectileOnly])
}

async function waitForWireSpell(page, kind, afterTick, timeout, projectileOnly = false) {
  const handle = await page.waitForFunction(([expectedKind, minimumTick, requireProjectile]) => {
    for (let index = window.__primarySpellWireFrames.length - 1; index >= 0; index -= 1) {
      const wire = window.__primarySpellWireFrames[index]
      if (wire.tick <= minimumTick) continue
      const states = [
        ...wire.primarySpells.projectiles,
        ...wire.primarySpells.transients,
      ]
      const state = (requireProjectile ? wire.primarySpells.projectiles : states)
        .find((candidate) => candidate.kind === expectedKind)
      if (state) {
        return {
          projectileCount: wire.primarySpells.projectiles.length,
          state,
          tick: wire.tick,
          transientCount: wire.primarySpells.transients.length,
        }
      }
    }
    return null
  }, [kind, afterTick, projectileOnly], { timeout })
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function waitForEtherFan(
  page,
  afterTick,
  quantity,
  timeout,
  minimumFlightTicks,
  expectedIds = null,
) {
  let handle
  try {
    handle = await page.waitForFunction(([
      minimumTick,
      expectedQuantity,
      minimumFlight,
      requiredIds,
    ]) => {
      for (let index = window.__primarySpellWireFrames.length - 1; index >= 0; index -= 1) {
        const wire = window.__primarySpellWireFrames[index]
        if (wire.tick <= minimumTick) continue
        let states = wire.primarySpells.projectiles
          .filter((candidate) => candidate.kind === 'ether')
          .sort((left, right) => left.id - right.id)
        states = requiredIds === null
          ? states.slice(-expectedQuantity)
          : states.filter(({ id }) => requiredIds.includes(id))
        if (states.length !== expectedQuantity) continue
        if (states.some(({ flightTicks }) => flightTicks < minimumFlight)) continue
        if (states.some((state, stateIndex) => (
          stateIndex > 0 && state.id !== states[stateIndex - 1].id + 1
        ))) continue
        const owner = wire.players[states[0].ownerId]
        if (!owner) continue
        return {
          castAimDirection: owner.primaryCast.aimDirection,
          states,
          tick: wire.tick,
        }
      }
      return null
    }, [afterTick, quantity, minimumFlightTicks, expectedIds], { timeout })
  } catch (error) {
    const diagnostics = await page.evaluate(([minimumTick, requiredIds]) => (
      window.__primarySpellWireFrames
        .filter(({ tick }) => tick > minimumTick)
        .slice(-20)
        .map((wire) => ({
          impacts: wire.primarySpells.transients.filter(({ kind }) => kind === 'ether-impact'),
          states: wire.primarySpells.projectiles.filter((candidate) => (
            candidate.kind === 'ether'
            && (requiredIds === null || requiredIds.includes(candidate.id))
          )),
          tick: wire.tick,
        }))
    ), [afterTick, expectedIds])
    throw new Error(`Ether fan did not reach its visual sample: ${JSON.stringify(diagnostics)}`, {
      cause: error,
    })
  }
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function waitForEtherFanFixture(page) {
  let handle
  try {
    handle = await page.waitForFunction(() => {
      const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
      if (!frame || !Number.isFinite(frame.playerX) || !Number.isFinite(frame.playerY)) return null
      const enemies = frame.enemySamples.filter(({ currentHealth }) => currentHealth > 0)
      if (enemies.length < 4) return null
      const center = enemies.reduce((sum, enemy) => ({
        x: sum.x + enemy.x / enemies.length,
        y: sum.y + enemy.y / enemies.length,
      }), { x: 0, y: 0 })
      const spread = Math.max(...enemies.map((enemy) => (
        Math.hypot(enemy.x - center.x, enemy.y - center.y)
      )))
      const distance = Math.hypot(center.x - frame.playerX, center.y - frame.playerY)
      return spread <= 40 && distance >= 180 && distance <= 300
        ? { distance, enemyCount: enemies.length, spread, tick: frame.tick }
        : null
    }, undefined, { timeout: 30_000 })
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
      const enemies = frame?.enemySamples.filter(({ currentHealth }) => currentHealth > 0) ?? []
      const center = enemies.length === 0 ? null : enemies.reduce((sum, enemy) => ({
        x: sum.x + enemy.x / enemies.length,
        y: sum.y + enemy.y / enemies.length,
      }), { x: 0, y: 0 })
      return {
        center,
        distance: center === null ? null : Math.hypot(
          center.x - frame.playerX,
          center.y - frame.playerY,
        ),
        enemyCount: enemies.length,
        player: frame ? { x: frame.playerX, y: frame.playerY } : null,
        spread: center === null ? null : Math.max(...enemies.map((enemy) => (
          Math.hypot(enemy.x - center.x, enemy.y - center.y)
        ))),
        tick: frame?.tick ?? null,
      }
    })
    throw new Error(`Ether fan fixture was not presented: ${JSON.stringify(diagnostics)}`, {
      cause: error,
    })
  }
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

function assertEtherFan(fan) {
  const aimHeading = headingFromDirection(fan.castAimDirection)
  const expectedOffsets = [10, -10, 30, -30]
  const expectedTurns = [2.2, 1.65, 1.65, 1.2375]
  assert.equal(fan.states.length, 4)
  for (let index = 0; index < fan.states.length; index += 1) {
    const state = fan.states[index]
    assert.equal(state.visualScale, 1)
    assert.equal(state.underpowered, false)
    assert.ok(Math.abs(state.speed - Math.fround(3.3)) < 0.000_001)
    assert.ok(Math.abs(state.turnInput - Math.fround(expectedTurns[index])) < 0.000_001)
    const expectedHeading = normalizeDegrees(aimHeading + expectedOffsets[index])
    let turnAccumulator = 0.01
    let cumulativeTurnBound = 0.001
    for (let tick = 0; tick < state.flightTicks; tick += 1) {
      cumulativeTurnBound += Math.abs(Math.fround(state.turnInput * turnAccumulator))
      turnAccumulator = Math.min(
        10,
        Math.fround(turnAccumulator + (
          turnAccumulator > 1 ? 0.0020000000949949026 : 0.05000000074505806
        )),
      )
    }
    assert.ok(
      Math.abs(signedDegrees(state.headingDegrees - expectedHeading)) <= cumulativeTurnBound,
      `Ether fan child ${index} left its native launch tier`,
    )
  }
  assert.equal(new Set(fan.states.map(({ id }) => id)).size, 4)
  assert.equal(new Set(fan.states.map(({ damage }) => damage)).size, 1)
  assert.equal(new Set(fan.states.map(({ position }) => `${position.x},${position.y}`)).size, 4)
}

function headingFromDirection(direction) {
  return normalizeDegrees(Math.atan2(direction.x, -direction.y) * 180 / Math.PI)
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360
}

function signedDegrees(value) {
  return ((value + 540) % 360) - 180
}

async function waitForHeldEarthCharge(page, boulderId, worldKey, minimumCharge, timeout) {
  const handle = await page.waitForFunction(([id, world, minimum]) => {
    for (let index = window.__primarySpellWireFrames.length - 1; index >= 0; index -= 1) {
      const wire = window.__primarySpellWireFrames[index]
      const state = wire.primarySpells.projectiles.find((candidate) => (
        candidate.kind === 'earth'
        && candidate.id === id
        && candidate.phase === 'held'
        && candidate.worldKey === world
        && candidate.charge >= minimum
      ))
      if (state) return { state, tick: wire.tick }
    }
    return null
  }, [boulderId, worldKey, minimumCharge], { timeout })
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function waitForEarthFlight(page, boulderId, afterTick, timeout) {
  const handle = await page.waitForFunction(([id, minimumTick]) => {
    for (let index = window.__primarySpellWireFrames.length - 1; index >= 0; index -= 1) {
      const wire = window.__primarySpellWireFrames[index]
      if (wire.tick <= minimumTick) continue
      const state = wire.primarySpells.projectiles.find((candidate) => (
        candidate.kind === 'earth'
        && candidate.id === id
        && candidate.phase === 'flight'
      ))
      if (state) return { state, tick: wire.tick }
    }
    return null
  }, [boulderId, afterTick], { timeout })
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function waitForEarthResidualContact(page, boulderId, targetId, afterTick, timeout) {
  const handle = await page.waitForFunction(([id, target, minimumTick]) => {
    for (let index = window.__primarySpellWireFrames.length - 1; index >= 0; index -= 1) {
      const wire = window.__primarySpellWireFrames[index]
      if (wire.tick <= minimumTick) continue
      const state = wire.primarySpells.projectiles.find((candidate) => (
        candidate.kind === 'earth'
        && candidate.id === id
        && candidate.phase === 'flight'
        && candidate.hitTargetIds.includes(target)
        && candidate.remainingDamage > 0
      ))
      const bit = wire.primarySpells.transients.find((candidate) => (
        candidate.kind === 'earth-boulder-bit'
      ))
      if (state && bit) {
        return {
          bit: { state: bit },
          boulder: { state },
          tick: wire.tick,
        }
      }
    }
    return null
  }, [boulderId, targetId, afterTick], { timeout })
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function waitForRenderedBoneyardSpellKinds(page, kinds, timeout) {
  const handle = await page.waitForFunction((expectedKinds) => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return expectedKinds.every((kind) => frame?.primarySpellKinds?.includes(kind))
      ? { ...frame }
      : null
  }, kinds, { timeout })
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function waitForEarthRelease(page, afterTick, timeout) {
  const handle = await page.waitForFunction((minimumTick) => {
    for (let index = window.__primarySpellWireFrames.length - 1; index >= 0; index -= 1) {
      const wire = window.__primarySpellWireFrames[index]
      if (wire.tick <= minimumTick) continue
      const state = wire.primarySpells.transients.find(
        (candidate) => candidate.kind === 'earth-impact',
      ) ?? wire.primarySpells.projectiles.find(
        (candidate) => candidate.kind === 'earth' && candidate.phase === 'flight',
      )
      if (state) {
        return {
          projectileCount: wire.primarySpells.projectiles.length,
          state,
          tick: wire.tick,
          transientCount: wire.primarySpells.transients.length,
        }
      }
      return null
    }
    return null
  }, afterTick, { timeout })
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function castTarget(canvas, xRatio, yRatio) {
  const bounds = await canvas.boundingBox()
  assert.ok(bounds, 'expected the gameplay canvas to have bounds')
  return {
    x: bounds.x + bounds.width * xRatio,
    y: bounds.y + bounds.height * yRatio,
  }
}

async function audioEventCount(page) {
  return page.evaluate(() => window.__primarySpellAudioEvents.length)
}

async function audioEvents(page) {
  return page.evaluate(() => window.__primarySpellAudioEvents)
}

async function waitForAudio(page, eventStart, source, type, timeout = 10_000) {
  const handle = await page.waitForFunction(
    ({ expected, expectedType, start }) => {
      const events = window.__primarySpellAudioEvents.slice(start)
      return events.find((event) => (
        (event.type === expectedType
          || (expectedType === 'play' && event.type === 'buffer-start')
          || (expectedType === 'pause' && event.type === 'buffer-stop'))
        && window.__primarySpellAudioSourceMatches(event.src, expected)
      )) || null
    },
    { expected: source, expectedType: type, start: eventStart },
    { timeout },
  )
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function findAudio(page, eventStart, source, type) {
  return page.evaluate(({ expected, expectedType, start }) => (
    window.__primarySpellAudioEvents.slice(start).find((event) => (
      (event.type === expectedType
        || (expectedType === 'play' && event.type === 'buffer-start')
        || (expectedType === 'pause' && event.type === 'buffer-stop'))
      && window.__primarySpellAudioSourceMatches(event.src, expected)
    )) || null
  ), { expected: source, expectedType: type, start: eventStart })
}

function watchErrors(page, errors, label) {
  page.on('pageerror', (error) => errors.push({ label, message: error.message, type: 'page' }))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push({ label, message: message.text(), type: 'console' })
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      errors.push({
        label,
        message: `${response.status()} ${response.url()}`,
        type: 'http',
      })
    }
  })
}

import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotPath = process.env.SDR_PLAYER_DAMAGE_SCREENSHOT
  || join(tmpdir(), 'solomon-dark-player-damage-presentation.png')
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')
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
  throw new Error('Vite did not expose its player-damage proof port')
}

const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const browser = await chromium.launch({ executablePath: chromePath, headless: true })
const page = await browser.newPage({ viewport: { height: 700, width: 1_000 } })
const consoleErrors = []
const failedResponses = []
const pageErrors = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => pageErrors.push(error.message))
page.on('response', (response) => {
  if (response.status() >= 400) {
    failedResponses.push({ status: response.status(), url: response.url() })
  }
})
await page.addInitScript(installGameAudioSmokeProbe)
await page.route(`${baseUrl}/__player-damage-proof`, (route) => route.fulfill({
  body: '<!doctype html><html><body></body></html>',
  contentType: 'text/html',
  status: 200,
}))

try {
  await page.goto(`${baseUrl}/__player-damage-proof`, { waitUntil: 'domcontentloaded' })
  const full = await page.evaluate(async () => {
    document.body.replaceChildren()
    document.body.style.background = '#101018'
    document.body.style.margin = '0'

    const [
      fixture,
      audioAssets,
      audioBrowser,
      audioNative,
      actors,
      simulation,
      snapshots,
    ] = await Promise.all([
      import('/tools/player-damage-smoke-fixture.mjs'),
      import('/src/game/game-audio-assets.ts'),
      import('/src/game/game-audio-browser.ts'),
      import('/src/game/game-audio-native.ts'),
      import('/src/game/renderer/hub-actors.ts'),
      import('/src/game/core-server/game-simulation.ts'),
      import('/src/game/host/game-snapshot.ts'),
    ])
    const loadedTextures = await fixture.loadPlayerProofTextures()
    const textures = loadedTextures.textures
    const application = new fixture.Application()
    await application.init({
      antialias: false,
      autoDensity: true,
      autoStart: false,
      background: 0x101018,
      height: 700,
      preference: 'webgl',
      preferWebGLVersion: 2,
      resolution: 1,
      width: 1_000,
    })
    application.stop()
    document.body.append(application.canvas)

    const state = simulation.createGameSimulation({
      wizard: {
        discipline: 'arcane',
        displayName: 'Helvidius',
        element: 'ether',
      },
    })
    const source = snapshots.createGameSnapshot(state, 'wizard').players.wizard
    const player = {
      ...source,
      gaitDegrees: 63,
      headingIndex: 9,
      position: { x: 500, y: 350 },
      primaryCast: {
        ...source.primaryCast,
        actionTick: 22,
        aimDirection: { x: 1, y: 0 },
        held: true,
      },
      progression: {
        ...source.progression,
        currentHealth: 35,
        lastDamageTick: 100,
      },
      velocity: { x: 35, y: 0 },
      walkCyclePrimary: 3.4,
    }
    const view = new actors.PlayerWorldView('ether', textures)
    application.stage.addChild(view.container)
    view.update(player, 100)
    view.setWorldTint(0x336699)
    application.renderer.render(application.stage)

    const pairs = [
      ['staffBack', view.staffBack, view.hitStaffBack],
      ['robe', view.robe, view.hitRobe],
      ['fixed', view.fixed, view.hitFixed],
      ['staffFront', view.staffFront, view.hitStaffFront],
      ['head', view.head, view.hitHead],
    ].map(([name, base, hit]) => ({
      name,
      positionMatches: hit.x === base.x && hit.y === base.y,
      textureMatches: hit.texture === base.texture,
      tint: hit.tint,
      visibilityMatches: hit.visible === base.visible,
    }))

    const event = {
      actorId: 7,
      eventId: 1,
      gainScale: 0.625,
      pitch: 1,
      runId: 'browser-player-damage-proof',
      sound: 'wizard-ouch-2',
      sourcePosition: { x: 500, y: 350 },
      targetPlayerId: 'wizard',
      tick: 100,
      type: 'player-damage-sound',
    }
    const request = audioNative.nativeEnemyEventSoundRequest(event)
    const audioSource = audioAssets.GAME_AUDIO_SOURCES.sounds[request.cue]
    await audioBrowser.loadGameAudioAsset(audioSource)
    const director = audioBrowser.createBrowserGameAudioDirector()
    director.playSound(request.cue, {
      playbackRate: request.playbackRate,
      volume: request.volume,
    })

    window.__playerDamageProof = {
      application,
      destroyTextures: loadedTextures.destroy,
      director,
      player,
      textures,
      view,
    }
    return {
      attachmentPose: view.attachmentPose,
      audioSource,
      excludedIndependentLayers: !view.hitOverlay.children.includes(view.shadow)
        && !view.hitOverlay.children.includes(view.deathBody)
        && !view.hitOverlay.children.includes(view.deathAttachment)
        && !view.hitOverlay.children.includes(view.orb.container),
      hitAlpha: view.hitOverlay.alpha,
      hitLayerCount: view.hitOverlay.children.length,
      hitVisible: view.hitOverlay.visible,
      pairs,
      renderer: application.renderer.name,
      walkPose: view.walkPose,
    }
  })

  await page.screenshot({ path: screenshotPath })
  const lifecycle = await page.evaluate(() => {
    const proof = window.__playerDamageProof
    proof.view.update(proof.player, 110)
    const midpointAlpha = proof.view.hitOverlay.alpha
    proof.view.update(proof.player, 120)
    const expiredVisible = proof.view.hitOverlay.visible
    proof.view.update({
      ...proof.player,
      progression: {
        ...proof.player.progression,
        currentHealth: 34,
        lastDamageTick: null,
      },
    }, 121)
    const poisonVisible = proof.view.hitOverlay.visible
    proof.view.update({
      ...proof.player,
      progression: {
        ...proof.player.progression,
        deathTick: 0,
        lastDamageTick: null,
        lifeState: 'dying',
      },
    }, 121)
    const deathVisible = proof.view.hitOverlay.visible
    return { deathVisible, expiredVisible, midpointAlpha, poisonVisible }
  })
  await page.waitForFunction(() => window.__sdrAudioEvents.some((event) => (
    event.type === 'buffer-start'
      && window.__sdrAudioSourceMatches(event.src, 'wizard-ouch-2.wav')
  )), undefined, { timeout: 5_000 })
  const audio = await page.evaluate(() => window.__sdrAudioEvents.find((event) => (
    event.type === 'buffer-start'
      && window.__sdrAudioSourceMatches(event.src, 'wizard-ouch-2.wav')
  )))

  assert.equal(full.hitAlpha, 1)
  assert.equal(full.hitLayerCount, 5)
  assert.equal(full.hitVisible, true)
  assert.equal(full.excludedIndependentLayers, true)
  assert.equal(full.walkPose, 3)
  assert.ok(full.attachmentPose === 7 || full.attachmentPose === 8)
  assert.ok(full.pairs.every((pair) => pair.textureMatches))
  assert.ok(full.pairs.every((pair) => pair.positionMatches))
  assert.ok(full.pairs.every((pair) => pair.visibilityMatches))
  assert.ok(full.pairs.every((pair) => pair.tint === 0xff0000))
  assert.equal(lifecycle.midpointAlpha, 0.5)
  assert.equal(lifecycle.expiredVisible, false)
  assert.equal(lifecycle.poisonVisible, false)
  assert.equal(lifecycle.deathVisible, false)
  assert.equal(audio.playbackRate, 1)
  assert.equal(audio.volume, 0.625)
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  assert.deepEqual(pageErrors, [])

  console.log(JSON.stringify({
    audio: {
      playbackRate: audio.playbackRate,
      source: full.audioSource,
      volume: audio.volume,
    },
    lifecycle,
    renderer: full.renderer,
    screenshotPath,
  }, null, 2))

  await page.evaluate(() => {
    const proof = window.__playerDamageProof
    proof.director.destroy()
    proof.view.destroy()
    proof.application.destroy({ removeView: true })
    proof.destroyTextures()
    delete window.__playerDamageProof
  })
} finally {
  await browser.close()
  await vite.close()
}

import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

// Exercises the actual room/view objects and GPU buffers, not mocked mode setters.
// The ordinary built-game Settings and multiplayer journeys remain separate gates.
const output = process.env.SDR_PRIVATE_ROOM_QUALITY_OUTPUT || join(tmpdir(), 'solomon-private-room-quality')
await mkdir(output, { recursive: true })
const vite = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error', server: { host: '127.0.0.1', port: 0 },
})
let browser
const errors = { page: [], console: [], responses: [], requests: [] }
const receipt = { status: 'running', scope: 'Real WebGL private-room renderer and native assets; fixed authoritative fixtures, no host or wire override.', rows: [], errors }
try {
  await vite.listen()
  const address = vite.httpServer.address()
  assert.ok(address && typeof address !== 'string')
  const origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ headless: true, executablePath: process.env.SDR_CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  receipt.browser = browser.version()
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', event => { if (event.type() === 'error') errors.console.push(event.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.responses.push({ status: response.status(), url: response.url() }) })
  page.on('requestfailed', request => errors.requests.push({ url: request.url(), error: request.failure()?.errorText }))
  await page.route(`${origin}/__private-room-quality`, route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><head><link rel="icon" href="data:,"></head><body></body></html>',
  }))
  await page.goto(`${origin}/__private-room-quality`)
  await page.evaluate(async () => {
    const [pixi, texturesModule, modsModule, roomModule, simulation, snapshots, pipeline, secondaryCodec] = await Promise.all([
      import('/tools/player-damage-smoke-fixture.mjs'), import('/src/game/renderer/hub-textures.ts'),
      import('/src/game/renderer/mod-presentation-assets.ts'), import('/src/game/renderer/hub-private-room-scene.ts'),
      import('/src/game/core-server/game-simulation.ts'), import('/src/game/host/game-snapshot.ts'),
      import('/src/game/renderer/native-fixed-function-render-pipeline.ts'),
      import('/src/game/protocol/codecs/secondary-actors.ts'),
    ])
    const textures = await texturesModule.loadHubWorldTextures()
    const mods = await modsModule.loadModPresentationTextures([])
    const app = new pixi.Application()
    await app.init({ autoStart: false, antialias: false, width: 1000, height: 800,
      resolution: 1, preference: 'webgl', preferWebGLVersion: 2, background: 0 })
    app.stop()
    pipeline.installNativeFixedFunctionRenderPipeline(app.renderer)
    document.body.style.margin = '0'
    document.body.append(app.canvas)
    const state = simulation.createGameSimulation({ wizard: { displayName: 'Quality', discipline: 'arcane', element: 'ether' } })
    const initial = snapshots.createGameSnapshot(state, 'wizard')
    const base = { ...initial, tick: 100, players: { ...initial.players,
      wizard: { ...initial.players.wizard, economy: { ...initial.players.wizard.economy,
        collegeIntroPending: false } } } }
    const scene = new roomModule.HubPrivateRoomScene(textures, 100, base.world.traderAnimationSeed, app.renderer, mods)
    app.stage.addChild(scene.world)
    const registration = ordinal => ({ managerLane: 'actor', registrationOrdinal: ordinal })
    const air = Object.freeze({ ageTicks: 0, birthTick: 100, id: 1, kind: 'air', ownerId: 'wizard',
      enhancedEffects: true, chained: false, direction: { x: 0, y: -1 },
      origin: { x: 350, y: 600 }, midpoint: { x: 350, y: 380 }, endpoint: { x: 350, y: 160 },
      hurricaneCharge: 0, underpowered: false, targetId: null, variant: 0,
      lightRegistration: registration(1000003),
      painterRegistrations: [registration(1000000), registration(1000001), registration(1000002)] })
    const orb = Object.freeze({ ageTicks: 20, alpha: 1, damage: 0, enhanced: true,
      endpoint: { x: 0, y: 0 }, frame: 0, freezeTicks: 0, golem: null, hitTargetIds: [],
      id: 2, kind: 'plane-orb-shot', lifetimeTicks: 1125, lightRegistration: null,
      midpoint: { x: 0, y: 0 }, miscLightAppendOrdinal: null, ownerId: 'wizard',
      painterRegistrations: [{ managerLane: 'transient', registrationOrdinal: 1000004 }], phase: 0, position: { x: 550, y: 400 },
      presentationRng: null, quantity: 0, radius: 50, rank: 1, rotationRadians: 0,
      scale: 2, skillId: 12, slowFactor: 1, targetId: null, variant: 0, velocity: { x: 0, y: 0 } })
    const sourceBefore = JSON.stringify({ air, orb })
    window.privateRoomQuality = {
      sample(region, enabled) {
        const frame = { ...base, enhancedEffects: enabled,
          world: { ...base.world, participants: { ...base.world.participants,
            wizard: { ...base.world.participants.wizard, region, collegeIntro: null, transition: null } } },
          primarySpells: { ...base.primarySpells, nextId: 3, projectiles: [], transients: [{ ...air, worldKey: `hub:${region}` }] },
          secondaryAbilities: { ...base.secondaryAbilities, nextActorId: 3, actors: [
            secondaryCodec.nativeSecondaryActor({ ...orb, worldKey: `hub:${region}` }, 'private-room.orb', base.players),
          ] } }
        scene.update(frame, 'wizard', 100)
        app.renderer.render(app.stage)
        const primary = scene.primarySpells[region].views.get(1)
        const secondary = scene.secondaryAbilities[region].views.get(2)
        const bands = primary.body.bands
        const mesh = secondary.plan.meshes.find(value => value.role === 'plane-orb-ether-plane-mesh')
        return { region, enabled, tick: frame.tick, bornAir: primary.state.enhancedEffects,
          bornOrb: secondary.state.enhanced, bandCount: bands.length,
          bandSteps: bands.slice(1).map((band, index) => band.painterY - bands[index].painterY),
          orbVertexCount: mesh.vertices.length / 2, orbIndexCount: mesh.indices.length,
          sourceUnchanged: JSON.stringify({ air, orb }) === sourceBefore }
      },
      destroy() { scene.destroy(); app.destroy({ removeView: true });
        texturesModule.destroyHubWorldTextureFrames(textures); mods.destroy() },
    }
  })
  for (const region of ['mortuary', 'library', 'storeroom', 'office']) {
    for (const enabled of [true, false, true]) {
      const row = await page.evaluate(({ region, enabled }) => window.privateRoomQuality.sample(region, enabled), { region, enabled })
      const screenshot = join(output, `${region}-${enabled ? 'on' : 'off'}-${receipt.rows.length}.png`)
      await page.screenshot({ path: screenshot })
      receipt.rows.push({ ...row, screenshot })
    }
  }
  await page.evaluate(() => window.privateRoomQuality.destroy())
  assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [] })
  for (const row of receipt.rows) {
    assert.equal(row.sourceUnchanged, true)
    assert.equal(row.tick, 100)
    assert.equal(row.bornAir, true); assert.equal(row.bornOrb, true)
    assert.ok(row.bandSteps.length > 0)
    assert.ok(row.bandSteps.every(step => step === (row.enabled ? 25 : 50)), `${row.region}: live Air split quality`)
    assert.equal(row.orbVertexCount, row.enabled ? 31 : 15, `${row.region}: live Plane Orb geometry`)
    assert.equal(row.orbIndexCount, row.enabled ? 135 : 63)
  }
  receipt.status = 'passed'
} catch (error) {
  receipt.status = 'failed'
  receipt.error = error.stack
  process.exitCode = 1
} finally {
  await browser?.close()
  await vite.close()
  await writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
  console.log(JSON.stringify(receipt))
}

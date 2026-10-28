import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

// Real room objects/assets and WebGL; ordinary built-game traversal is a separate gate.
const output = process.env.SDR_ROOM_FLAME_OUTPUT || join(tmpdir(), 'solomon-room-flame-registration')
await mkdir(output, { recursive: true })
const root = fileURLToPath(new URL('../', import.meta.url))
const vite = await createServer({ root, configFile: join(root, 'vite.config.ts'),
  logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })
const errors = { page: [], console: [], responses: [], requests: [] }
const receipt = { status: 'running', scope: 'Real fixed-room candle sprite registration; no native RNG, separate light-map, ordinary gameplay or release claim.', rows: [], errors,
  sceneSha256: createHash('sha256').update(await readFile(join(root, 'src/game/renderer/hub-private-room-scene.ts'))).digest('hex') }
let browser
try {
  await vite.listen()
  const address = vite.httpServer.address()
  assert.ok(address && typeof address !== 'string')
  const origin = `http://127.0.0.1:${address.port}`
  receipt.origin = origin
  browser = await chromium.launch({ headless: true,
    executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  receipt.browser = browser.version()
  const page = await browser.newPage({ viewport: { width: 1100, height: 1050 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', event => { if (event.type() === 'error') errors.console.push(event.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.responses.push({ status: response.status(), url: response.url() }) })
  page.on('requestfailed', request => errors.requests.push({ url: request.url(), error: request.failure()?.errorText }))
  await page.route(`${origin}/__room-flame-registration`, route => route.fulfill({ contentType: 'text/html',
    body: '<!doctype html><html><head><link rel="icon" href="data:,"></head><body></body></html>' }))
  await page.goto(`${origin}/__room-flame-registration`)
  await page.evaluate(async () => {
    const [pixi, texturesModule, modsModule, roomModule, simulation, snapshots, pipeline, presentation] = await Promise.all([
      import('/tools/player-damage-smoke-fixture.mjs'), import('/src/game/renderer/hub-textures.ts'),
      import('/src/game/renderer/mod-presentation-assets.ts'), import('/src/game/renderer/hub-private-room-scene.ts'),
      import('/src/game/core-server/game-simulation.ts'), import('/src/game/host/game-snapshot.ts'),
      import('/src/game/renderer/native-fixed-function-render-pipeline.ts'), import('/src/game/renderer/hub-private-room-presentation.ts'),
    ])
    const textures = await texturesModule.loadHubWorldTextures()
    const mods = await modsModule.loadModPresentationTextures([])
    const app = new pixi.Application()
    await app.init({ autoStart: false, antialias: false, width: 1100, height: 1050,
      resolution: 1, preference: 'webgl', preferWebGLVersion: 2, background: 0 })
    app.stop()
    pipeline.installNativeFixedFunctionRenderPipeline(app.renderer)
    document.body.style.margin = '0'
    document.body.append(app.canvas)
    const state = simulation.createGameSimulation({ wizard: { displayName: 'Candles', discipline: 'arcane', element: 'ether' } })
    const initial = snapshots.createGameSnapshot(state, 'wizard')
    const base = { ...initial, players: { ...initial.players,
      wizard: { ...initial.players.wizard, economy: { ...initial.players.wizard.economy, collegeIntroPending: false } } } }
    const scene = new roomModule.HubPrivateRoomScene(textures, 0, base.world.traderAnimationSeed, app.renderer, mods)
    app.stage.addChild(scene.world)
    const original = JSON.stringify(presentation.HUB_PRIVATE_ROOM_FLAME_ANCHORS)
    window.roomFlameRegistration = {
      sample(region, tick, enhancedEffects) {
        const frame = { ...base, tick, enhancedEffects, world: { ...base.world,
          participants: { ...base.world.participants, wizard: { ...base.world.participants.wizard,
            region, collegeIntro: null, transition: null } } } }
        scene.update(frame, 'wizard', tick)
        app.renderer.render(app.stage)
        const flames = scene.roomFlames.get(region)
        const corners = [[0, 4], [10, 4], [10, 17], [0, 17]]
        const rows = flames.map((flame, index) => {
          const position = presentation.HUB_PRIVATE_ROOM_FLAME_ANCHORS[region][index]
          const transform = presentation.hubRoomFlameTransform(region, tick, index)
          const bounds = flame.getLocalBounds()
          const actual = corners.map(([x, y]) => flame.toGlobal({ x: bounds.minX + x, y: bounds.minY + y }))
          const expected = corners.map(([x, y]) => {
            const localX = (x - 5) * transform.scaleX
            const localY = (y - 13) * transform.scaleY
            return { x: position.x + localX * Math.cos(transform.rotation) - localY * Math.sin(transform.rotation),
              y: position.y + localX * Math.sin(transform.rotation) + localY * Math.cos(transform.rotation) }
          })
          return { index, position: { x: flame.x, y: flame.y }, expectedPosition: position,
            anchor: { x: flame.anchor.x, y: flame.anchor.y },
            textureOrig: flame.texture.orig, textureTrim: flame.texture.trim,
            localBounds: { minX: bounds.minX, minY: bounds.minY, maxX: bounds.maxX, maxY: bounds.maxY }, logicalSize: [flame.texture.orig.width, flame.texture.orig.height],
            scale: [flame.scale.x, flame.scale.y], rotation: flame.rotation, transform,
            blendMode: flame.blendMode, depth: flame.zIndex, expectedDepth: presentation.HUB_PRIVATE_ROOM_EFFECT_DEPTH,
            maximumCornerError: Math.max(...actual.map((point, i) => Math.hypot(point.x - expected[i].x, point.y - expected[i].y))) }
        })
        return { region, tick, enhancedEffects, count: rows.length, rows,
          sourceUnchanged: JSON.stringify(presentation.HUB_PRIVATE_ROOM_FLAME_ANCHORS) === original }
      },
      destroy() { scene.destroy(); app.destroy({ removeView: true });
        texturesModule.destroyHubWorldTextureFrames(textures); mods.destroy() },
    }
  })
  for (const tick of [0, 100, 701]) {
    for (const region of ['mortuary', 'library', 'storeroom', 'office']) {
      for (const enhancedEffects of [true, false, true]) {
        const row = await page.evaluate(({ region, tick, enhancedEffects }) => window.roomFlameRegistration.sample(region, tick, enhancedEffects), { region, tick, enhancedEffects })
        if (tick === 100 && receipt.rows.filter(value => value.region === region && value.tick === tick).length === 0) {
          row.screenshot = join(output, `${region}.png`)
          await page.screenshot({ path: row.screenshot })
        }
        receipt.rows.push(row)
      }
    }
  }
  await page.evaluate(() => window.roomFlameRegistration.destroy())
  assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [] })
  for (const sample of receipt.rows) {
    assert.equal(sample.count, { mortuary: 50, storeroom: 9, library: 17, office: 7 }[sample.region])
    assert.equal(sample.sourceUnchanged, true)
    for (const row of sample.rows) {
      const context = `${sample.region} tick ${sample.tick} flame ${row.index}`
      assert.deepEqual(row.position, row.expectedPosition, context)
      assert.deepEqual(row.logicalSize, [10, 26], context)
      assert.equal(row.blendMode, 'add', context)
      assert.equal(row.depth, row.expectedDepth, context)
      assert.deepEqual(row.scale, [row.transform.scaleX, row.transform.scaleY], context)
      assert.equal(row.rotation, row.transform.rotation, context)
      assert.ok(row.maximumCornerError < 1e-6, `${context}: native content corner drift ${row.maximumCornerError}`)
    }
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
  console.log(JSON.stringify({ status: receipt.status, output, samples: receipt.rows.length, error: receipt.error, errors }))
}

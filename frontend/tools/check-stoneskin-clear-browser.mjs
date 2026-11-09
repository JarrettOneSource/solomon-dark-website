import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { createGameSimulation } from '../src/game/core-server/game-simulation.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'

const [output] = process.argv.slice(2)
assert.ok(output, 'usage: node --experimental-strip-types tools/check-stoneskin-clear-browser.mjs OUTPUT')
await mkdir(output, { recursive: true })
const player = createGameSnapshot(createGameSimulation({ player: {
  discipline: 'mind', displayName: 'Stone clear', element: 'earth',
} }), 'player').players.player
const root = fileURLToPath(new URL('../', import.meta.url))
const server = await createServer({ root, appType: 'custom', logLevel: 'error', cacheDir: `${output}/vite-cache`,
  plugins: [{ name: 'stone-clear-pixi',
    resolveId(id) { if (id === 'virtual:stone-clear-pixi') return '\0stone-clear-pixi' },
    load(id) { if (id === '\0stone-clear-pixi') return 'export { BufferImageSource, Container, Matrix, Mesh, MeshGeometry, RenderTexture, Sprite, Texture } from "pixi.js"' },
  }], server: { host: '127.0.0.1', port: 0 },
})
server.middlewares.use((request, response, next) => {
  if (request.url !== '/__stone_clear') return next()
  response.setHeader('Content-Type', 'text/html')
  response.end('<!doctype html><title>Stone clear regression</title><link rel="icon" href="data:,">')
})
let browser
const errors = []
try {
  await server.listen()
  const address = server.httpServer.address()
  assert.ok(address && typeof address !== 'string')
  browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`))
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
  await page.goto(`http://127.0.0.1:${address.port}/__stone_clear`)
  const result = await page.evaluate(async player => {
    const { BufferImageSource, Container, Matrix, Mesh, MeshGeometry, RenderTexture, Sprite, Texture } = await import('/@id/__x00__stone-clear-pixi')
    const { createGameWebGlApplication } = await import('/src/game/renderer/game-webgl.ts')
    const { PlayerStoneskinView } = await import('/src/game/renderer/player-stoneskin-view.ts')
    const { PlayerHardenView } = await import('/src/game/renderer/player-harden-view.ts')
    const { PlayerWebbedView } = await import('/src/game/renderer/player-webbed-view.ts')
    const { renderNativeDiffuseMask } = await import('/src/game/renderer/native-texture-color.ts')
    const { createNativeStoneskinWarp, nativeStoneskinGeometry } = await import('/src/game/core-kernels/native-stoneskin.ts')
    const { createNativeRng } = await import('/src/game/core-kernels/native-rng.ts')
    const { application: app } = await createGameWebGlApplication({ width: 256, height: 256, className: 'stone-clear' })
    document.body.append(app.canvas)
    const texture = (side, alpha) => {
      const rgba = new Uint8Array(side * side * 4).fill(255)
      for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) rgba[(y * side + x) * 4 + 3] = alpha(x, y)
      return new Texture({ source: new BufferImageSource({ resource: rgba, width: side, height: side,
        alphaMode: 'no-premultiply-alpha', scaleMode: 'linear' }) })
    }
    const bodyTexture = texture(64, x => [64, 128, 192, 255][Math.floor(x / 16)])
    const material = texture(256, () => 255)
    const source = new Container()
    const body = new Sprite(bodyTexture)
    body.anchor.set(.5); body.position.set(.25, -25.25); body.tint = 0x808080
    source.addChild(body)
    const stone = new PlayerStoneskinView(material, app.renderer)
    const harden = new PlayerHardenView(material, app.renderer)
    const webbed = new PlayerWebbedView(material, app.renderer)
    const target = () => RenderTexture.create({ width: 256, height: 256,
      alphaMode: 'no-premultiply-alpha', scaleMode: 'linear' })
    const black = target(), white = target(), actual = target(), expected = target()
    const transform = new Matrix(1, 0, 0, 1, 128, 153)
    const pixels = target => app.renderer.extract.pixels({ target }).pixels.slice()
    const diff = (a, b) => {
      let changedChannels = 0, maximumDifference = 0
      for (let i = 0; i < a.length; i++) {
        const difference = Math.abs(a[i] - b[i])
        if (difference) changedChannels++
        maximumDifference = Math.max(maximumDifference, difference)
      }
      return { changedChannels, maximumDifference }
    }
    const capture = view => view.container.children.find(child => child.texture instanceof RenderTexture).texture
    const rows = [], images = []
    let retained
    try {
      const warp = createNativeStoneskinWarp(createNativeRng(125)).positions
      player.headingIndex = 0; player.gaitDegrees = 0
      // Native Stone clears black; neighboring materials explicitly clear white.
      // These references bypass the production capture wrapper.
      for (const [name, clear, reference] of [['black', [0, 0, 0, 0], black], ['white', [1, 1, 1, 0], white]]) {
        renderNativeDiffuseMask(app.renderer, { container: source, target: reference, clear: true, clearColor: clear, transform })
        rows.push({ kind: `${name}-reference`, corner: Array.from(pixels(reference).slice(0, 4)) })
      }
      const contrast = diff(pixels(black), pixels(white))
      for (const [step, enhanced] of [true, false, true].entries()) {
        stone.update(player, source, [], true, warp, enhanced)
        const captured = capture(stone)
        retained ??= captured
        const captureDifference = diff(pixels(captured), pixels(black))
        const world = new Container()
        world.position.set(128, 153)
        world.addChild(stone.container)
        app.renderer.render({ container: world, target: actual, clear: true, clearColor: [.05, .05, .05, 1] })
        world.removeChild(stone.container)
        const geometry = new MeshGeometry(nativeStoneskinGeometry(warp, enhanced))
        for (let pass = 0; pass < 2; pass++) {
          const mesh = new Mesh({ geometry, texture: black }); mesh.position.set(0, -25); world.addChild(mesh)
        }
        app.renderer.render({ container: world, target: expected, clear: true, clearColor: [.05, .05, .05, 1] })
        rows.push({ kind: 'stone', step, enhanced, reused: captured === retained, captureDifference,
          frameDifference: diff(pixels(actual), pixels(expected)) })
        if (step < 2) for (const [name, target] of [['actual', actual], ['expected', expected]]) {
          images.push({ name: `stone-${enhanced ? 'on' : 'off'}-${name}`, data: await app.renderer.extract.base64({ target }) })
        }
        world.destroy({ children: true }); geometry.destroy(true)
      }
      harden.update({ ...player, progression: { ...player.progression, hardenCoating: 1 } }, source, [], false)
      webbed.update(player, { severity: 1, strength: 10, cocoonHealth: 0, hitPulse: 0 }, source, [], false)
      for (const [kind, view] of [['harden', harden], ['webbed', webbed]]) rows.push({ kind,
        captureDifference: diff(pixels(capture(view)), pixels(white)) })
      return { rows, contrast, images, scope: 'Actual material views; synthetic fractional-alpha body; independent native clear references; no gameplay mutation.' }
    } finally {
      stone.destroy(); harden.destroy(); webbed.destroy(); source.destroy({ children: true })
      for (const target of [black, white, actual, expected]) target.destroy(true)
      bodyTexture.destroy(true); material.destroy(true); app.destroy({ removeView: true })
    }
  }, player)
  for (const image of result.images) await writeFile(`${output}/${image.name}.png`, Buffer.from(image.data.split(',')[1], 'base64'))
  delete result.images
  await writeFile(`${output}/receipt.json`, `${JSON.stringify({ ...result, errors }, null, 2)}\n`)
  assert.deepEqual(errors, [])
  assert.ok(result.contrast.maximumDifference > 100, 'fractional-alpha fixture must distinguish black and white captures')
  assert.equal(result.rows.filter(row => row.kind === 'stone').length, 3)
  for (const row of result.rows.filter(row => row.captureDifference)) assert.equal(row.captureDifference.changedChannels, 0, `${row.kind} native capture pixels`)
  for (const row of result.rows.filter(row => row.kind === 'stone')) {
    assert.ok(row.reused, 'mode changes reuse the cleared target')
    assert.equal(row.frameDifference.changedChannels, 0, 'two actual Stone composites use native black capture')
  }
  process.stdout.write(`${JSON.stringify({ output, rows: result.rows.length, errors })}\n`)
} finally {
  await browser?.close()
  await server.close()
}

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

// Material/transport qualification, not a native-versus-web scene-parity gate.
// Oracle: retail 608480, 41eae0, 625010/625097, corrected PC24 v2.
const root = resolve(process.env.SDR_TREE_MATERIAL_ROOT || fileURLToPath(new URL('../', import.meta.url)))
const output = resolve(process.env.SDR_TREE_MATERIAL_OUTPUT || resolve(root, 'reports/native-tree-material'))
await mkdir(output, { recursive: true })
// Canvas2D destroys RGB beneath alpha zero. Native NPM linear filtering consumes
// those channels, so decode the original PNG bytes with installed Pillow.
const decoder = JSON.parse(execFileSync(process.env.SDR_PYTHON_PATH || 'python3', ['-c', `
from PIL import Image, __version__
from pathlib import Path
import sys,json
root,out=map(Path,sys.argv[1:])
for index in range(7):
 image=Image.open(root/f'src/assets/game/boneyard-combat-atlas-{index}.png').convert('RGBA')
 (out/f'source-atlas-{index}.rgba').write_bytes(image.tobytes())
print(json.dumps({'name':'Pillow','version':__version__,'mode':'raw unassociated RGBA'}))
`, root, output], { encoding: 'utf8' }))
const vite = await createServer({
  root, configFile: false,
  logLevel: 'error', cacheDir: resolve(output, 'vite-cache'),
  plugins: [{
    name: 'tree-material-pixi-bridge',
    resolveId(id) { if (id === '/__tree-material-pixi') return '\0tree-material-pixi' },
    load(id) { if (id === '\0tree-material-pixi') return "export * from 'pixi.js'" },
  }],
  server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
const address = vite.httpServer.address()
assert.ok(address && typeof address !== 'string')
const origin = `http://127.0.0.1:${address.port}`
const errors = { console: [], page: [], responses: [], requests: [] }
let browser
try {
  browser = await chromium.launch({
    channel: 'chrome', executablePath: process.env.SDR_CHROME_PATH, headless: true,
  })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 })
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
  page.on('requestfailed', request => errors.requests.push(`${request.url()} ${request.failure()?.errorText}`))
  await page.route(`${origin}/__tree-material-source-*`, async route => {
    const index = Number(new URL(route.request().url()).pathname.split('-').at(-1))
    assert.ok(Number.isInteger(index) && index >= 0 && index < 7)
    await route.fulfill({ body: await readFile(resolve(output, `source-atlas-${index}.rgba`)), contentType: 'application/octet-stream' })
  })
  await page.route(`${origin}/__tree-material`, route => route.fulfill({
    body: '<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#101828"></body></html>',
    contentType: 'text/html',
  }))
  await page.goto(`${origin}/__tree-material`, { waitUntil: 'domcontentloaded' })
  const result = await page.evaluate(async () => {
    const { Application, BufferImageSource, Container, RenderTexture, Sprite, Texture } = await import('/__tree-material-pixi')
    const { installNativeFixedFunctionRenderPipeline, nativeStockTextureFromImage } = await import('/src/game/renderer/native-fixed-function-render-pipeline.ts')
    const { installNativeArenaRenderPipeline } = await import('/src/game/renderer/native-arena-render-pipeline.ts')
    const { createNativeSceneryGlyphMaterial } = await import('/src/game/renderer/native-scenery-glyph-material.ts')
    const { createBoneyardCombatAtlas, BONEYARD_COMBAT_ATLAS_SOURCES } = await import('/src/game/renderer/boneyard-combat-atlas.ts')
    const { BONEYARD_COMBAT_ATLAS_FRAMES } = await import('/src/game/renderer/boneyard-combat-atlas.generated.ts')
    const { nativeSceneryGlyphTexture } = await import('/src/game/renderer/native-scenery-shadow.ts')
    const { BoneyardSceneryShadowPresentation } = await import('/src/game/renderer/boneyard-scenery-shadow-presentation.ts')
    async function restoreContext(app) {
      const extension = app.renderer.gl.getExtension('WEBGL_lose_context')
      if (!extension) throw new Error('Context restoration extension missing')
      const event = name => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${name}`)), 5000)
        app.canvas.addEventListener(name, e => { e.preventDefault(); clearTimeout(timer); resolve() }, { once: true })
      })
      const lost = event('webglcontextlost'); extension.loseContext(); await lost
      const restored = event('webglcontextrestored')
      await new Promise(resolve => setTimeout(resolve, 100))
      extension.restoreContext(); await restored
    }
    const f = Math.fround, mul = (a, b) => f(f(a) * f(b))
    const byte = value => Math.trunc(f(value * 255))
    const background = [16, 24, 40, 255]
    const samples = [], buffers = [], originals = [], lifetimes = [], shadows = [], recovery = [], pictures = []
    // No production color helper participates in these expected endpoint values.
    function endpoints(input) {
      const light = mul(input.local, input.cc)
      const callback = input.pass === 'ordinary'
        ? [...input.rgb.map(channel => Math.min(1, Math.max(0, mul(light, channel)))), 1]
        : input.pass === 'complex-hit'
          ? [mul(.65, input.cc), 0, 0, mul(input.hit, input.cc)]
          : [1, 0, 0, f(input.hit)]
      const bottom = callback.map(byte)
      const top = [...bottom]
      if (input.tree && f(input.alpha) < .5) top[3] = byte(mul(input.alpha, .5))
      return [top, bottom]
    }
    function expected(input, texel, fractionY, mode, destination = background) {
      const [top, bottom] = endpoints(input)
      const vertex = top.map((value, channel) => (value * (1 - fractionY) + bottom[channel] * fractionY) / 255)
      const texture = input.pass === 'ordinary' ? texel.slice(0, 3).map(value => value / 255) : [1, 1, 1]
      const color = texture.map((value, channel) => value * vertex[channel])
      const grey = texture.reduce((a, b) => a + b, 0) / 3 * vertex.slice(0, 3).reduce((a, b) => a + b, 0) / 3
      const shaded = mode === 'arena' ? color.map(value => .65 * value + .35 * grey) : color
      const alpha = texel[3] / 255 * vertex[3]
      return [...shaded.map((value, channel) => Math.round(value * alpha * 255 + destination[channel] * (1 - alpha))),
        Math.round(alpha * alpha * 255 + destination[3] * (1 - alpha))]
    }
    const pages = new Map(), pagePixels = new Map()
    for (const [index, source] of BONEYARD_COMBAT_ATLAS_SOURCES.entries()) {
      const image = new Image()
      image.src = source
      await image.decode()
      const response = await fetch(`/__tree-material-source-${index}`)
      if (!response.ok) throw new Error(`Raw atlas decoder response ${response.status}`)
      const pixels = new Uint8Array(await response.arrayBuffer())
      if (pixels.length !== image.width * image.height * 4) throw new Error('Raw atlas dimensions changed')
      pagePixels.set(source, { pixels, width: image.width, height: image.height })
      pages.set(source, nativeStockTextureFromImage(image))
    }
    const atlas = createBoneyardCombatAtlas(source => pages.get(source))
    const glyph = entry => nativeSceneryGlyphTexture(atlas, entry)
    function sourceFor(entry) {
      const frame = BONEYARD_COMBAT_ATLAS_FRAMES.get(`boneyard-combat:DeadHawg:${entry}`)
      const [page, x, y, width, height] = frame
      return { entry, page, x, y, width, height, pagePixels: pagePixels.get(BONEYARD_COMBAT_ATLAS_SOURCES[page]) }
    }
    // Linear sampler from losslessly decoded original atlas texels and recovered record
    // half/quarter-texel bounds. Never samples the rendered candidate as oracle.
    function texelAt(source, x, y) {
      if (source.pixel) return source.pixel
      const { pixels, width: pageWidth, height: pageHeight } = source.pagePixels
      const sx = source.x + (x + .5) / source.width * (source.width - .25)
      const sy = source.y + (y + .5) / source.height * (source.height - .25)
      const x0 = Math.floor(sx), y0 = Math.floor(sy), dx = sx - x0, dy = sy - y0
      const result = [0, 0, 0, 0]
      for (let iy = 0; iy < 2; iy += 1) for (let ix = 0; ix < 2; ix += 1) {
        const offset = ((Math.min(pageHeight - 1, y0 + iy)) * pageWidth + Math.min(pageWidth - 1, x0 + ix)) * 4
        const weight = (ix ? dx : 1 - dx) * (iy ? dy : 1 - dy)
        for (let channel = 0; channel < 4; channel += 1) result[channel] += pixels[offset + channel] * weight
      }
      return result
    }
    function pointsFor(source) {
      if (source.pixel) return [0, 3, 7, 11, 15].map(y => ({ x: 8, y }))
      const points = []
      for (const fraction of [.1, .3, .5, .7, .9]) {
        const y = Math.min(source.height - 1, Math.floor(source.height * fraction))
        let best = null
        for (let x = 2; x < source.width - 2; x += 1) {
          const texel = texelAt(source, x, y)
          if (!best || texel[3] > best.alpha) best = { x, y, alpha: texel[3] }
        }
        if (best.alpha > 16) points.push({ x: best.x, y })
      }
      // One original antialiased edge guards source alpha independently of solid controls.
      outer: for (let y = 2; y < source.height - 2; y += 3) for (let x = 2; x < source.width - 2; x += 3) {
        const alpha = texelAt(source, x, y)[3]
        if (alpha > 64 && alpha < 192) { points.push({ x, y }); break outer }
      }
      if (points.length < 2) throw new Error(`Original glyph ${source.entry} lacks probe texels`)
      return points
    }
    function pixelsAt(pixels, width, point) {
      const offset = (point.y * width + point.x) * 4
      return Array.from(pixels.slice(offset, offset + 4))
    }
    function picture(name, columns, width, height) {
      const canvas = document.createElement('canvas')
      canvas.width = columns.length * width; canvas.height = height + 42
      const context = canvas.getContext('2d')
      context.fillStyle = '#101828'; context.fillRect(0, 0, canvas.width, canvas.height)
      context.font = '12px sans-serif'; context.fillStyle = '#ffffff'
      columns.forEach(({ title, pixels }, index) => {
        context.fillText(title, index * width + 4, 18)
        const display = new Uint8ClampedArray(pixels)
        for (let i = 3; i < display.length; i += 4) display[i] = 255
        context.putImageData(new ImageData(display, width, height), index * width, 36)
      })
      pictures.push({ name, url: canvas.toDataURL('image/png') })
    }
    for (const mode of ['fixed', 'arena']) {
      const app = new Application()
      await app.init({ antialias: false, autoStart: false, width: 512, height: 512, resolution: 1, preference: 'webgl' })
      const gl = app.renderer.gl, info = gl.getExtension('WEBGL_debug_renderer_info')
      const gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
      if (!/Apple M2/.test(gpu) || /SwiftShader|llvmpipe/i.test(gpu)) throw new Error(`Expected real M2 GPU, got ${gpu}`)
      installNativeFixedFunctionRenderPipeline(app.renderer)
      const pipeline = mode === 'arena' ? installNativeArenaRenderPipeline(app.renderer) : null
      const targets = new Map(), retained = [], ownedTextures = []
      const targetFor = (width, height) => {
        const key = `${width}x${height}`
        if (!targets.has(key)) targets.set(key, RenderTexture.create({ width, height, alphaMode: 'no-premultiply-alpha' }))
        return targets.get(key)
      }
      function draw(display, width, height) {
        const target = targetFor(width, height)
        app.stage.addChild(display)
        app.renderer.render({ container: app.stage, target, clear: true, clearColor: background.map(value => value / 255) })
        const pixels = app.renderer.extract.pixels({ target }).pixels.slice()
        app.stage.removeChild(display)
        return pixels
      }
      function capture(row, input, composite = false) {
        const display = composite ? new Container() : input.pass === 'ordinary' ? row.material.mesh : row.hit.display
        if (composite) display.addChild(row.material.mesh, row.hit.display)
        row.material.update(input.alpha, mul(input.local, input.cc), input.cc, input.rgb)
        row.hit.update(input.hit, input.pass === 'complex-hit')
        const actual = draw(display, row.source.width, row.source.height)
        if (composite) { display.removeChildren(); display.destroy() }
        const colors = Array.from(input.pass === 'ordinary' ? row.material.colors : row.hit.colors)
          .map(value => [value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24])
        const [top, bottom] = endpoints(input)
        const colorMismatch = JSON.stringify(colors) !== JSON.stringify([top, top, bottom, bottom])
        for (const point of row.points) {
          const texel = texelAt(row.source, point.x, point.y)
          const fractionY = (point.y + .5) / row.source.height
          const destination = composite ? expected({ ...input, pass: 'ordinary' }, texel, fractionY, mode) : background
          const oracle = expected(input, texel, fractionY, mode, destination)
          const pixel = pixelsAt(actual, row.source.width, point)
          samples.push({
            mode, gpu, source: row.name, kind: row.kind, composite, ...input, point, texel,
            fractionY, pixel, expected: oracle,
            maximumDelta: Math.max(...pixel.map((value, i) => Math.abs(value - oracle[i]))),
            colorMismatch,
          })
        }
        return actual
      }
      const sources = []
      for (const premultiplied of [false, true]) {
        const pixel = premultiplied ? [30, 60, 15, 128] : [60, 120, 30, 128]
        const texture = new Texture({ source: new BufferImageSource({
          width: 1, height: 1, resource: new Uint8Array(pixel), scaleMode: 'nearest',
          alphaMode: premultiplied ? 'premultiplied-alpha' : 'no-premultiply-alpha',
        }) })
        ownedTextures.push(texture)
        sources.push({ name: premultiplied ? 'solid-PMA' : 'solid-NPM', texture,
          source: { width: 16, height: 16, pixel: premultiplied ? [...pixel.slice(0, 3).map(value => value * 255 / pixel[3]), pixel[3]] : pixel } })
      }
      for (let variant = 0; variant < 15; variant += 1) {
        const entry = 264 + variant, source = sourceFor(entry), texture = glyph(entry)
        sources.push({ name: `original-DeadHawg-${entry}`, source, texture, variant })
        if (mode === 'arena') originals.push({
          entry, variant, frame: BONEYARD_COMBAT_ATLAS_FRAMES.get(`boneyard-combat:DeadHawg:${entry}`),
          textureAlphaMode: texture.source.alphaMode, scaleMode: texture.source.style.scaleMode,
          points: pointsFor(source), reachableFade: variant < 6,
        })
      }
      for (const item of sources) for (const kind of ['batched', 'standalone']) {
        const material = createNativeSceneryGlyphMaterial(item.texture, item.source.width, item.source.height, true)
        const hit = material.createHitRedraw()
        if (kind === 'standalone') {
          material.mesh.geometry.batchMode = 'no-batch'; hit.display.geometry.batchMode = 'no-batch'
        }
        const row = { ...item, material, hit, kind, points: pointsFor(item.source) }
        retained.push(row)
        const alphas = item.variant >= 6 ? [.505] : [.505, .490, .4]
        for (const alpha of alphas) for (const pass of ['ordinary', 'complex-hit', 'simple-hit']) {
          const input = { alpha, pass, local: .5, cc: .35, hit: .2, rgb: [1, .7, .4], tree: true }
          capture(row, input)
          if (pass !== 'ordinary') capture(row, input, true)
        }
        // At .4, a simple hit has constant endpoint alpha .2; complex hit
        // top is .2 and bottom is H*rawCC=.07, never H*D0*CC=.035.
        if (item.variant === undefined) for (const cc of [0, 1]) for (const pass of ['ordinary', 'complex-hit', 'simple-hit']) {
          capture(row, { alpha: .4, pass, local: .5, cc, hit: .2, rgb: [1, 1, 1], tree: true })
        }
        const colorBuffer = material.mesh.geometry.getBuffer('aColor')
        const hitBuffer = hit.display.geometry.getBuffer('aColor')
        const positionBuffer = material.mesh.geometry.getBuffer('aPosition')
        material.update(.4, .175, .35)
        const updated = colorBuffer._updateID
        material.update(.4, .175, .35)
        const unchanged = colorBuffer._updateID === updated
        const before = capture(row, { alpha: .4, pass: 'ordinary', local: .5, cc: .35, hit: .2, rgb: [1, 1, 1], tree: true })
        const after = capture(row, { alpha: .505, pass: 'ordinary', local: 1, cc: 1, hit: .2, rgb: [1, 1, 1], tree: true })
        buffers.push({
          mode, source: item.name, kind, unchanged,
          changed: colorBuffer._updateID > updated,
          colorBufferRetained: material.mesh.geometry.getBuffer('aColor') === colorBuffer,
          positionBufferRetained: material.mesh.geometry.getBuffer('aPosition') === positionBuffer,
          independentHitBuffer: hitBuffer !== colorBuffer,
          changedPixelChannels: before.reduce((sum, value, index) => sum + Number(value !== after[index]), 0),
        })
        if (mode === 'arena' && item.variant === 0 && kind === 'batched') {
          for (const pass of ['ordinary', 'complex-hit', 'simple-hit']) {
            const input = { alpha: .4, pass, local: .5, cc: .35, hit: .2, rgb: [1, 1, 1], tree: true }
            const afterPixels = capture(row, input)
            const oracle = new Uint8ClampedArray(afterPixels.length)
            for (let y = 0; y < item.source.height; y += 1) for (let x = 0; x < item.source.width; x += 1) {
              oracle.set(expected(input, texelAt(item.source, x, y), (y + .5) / item.source.height, mode), (y * item.source.width + x) * 4)
            }
            // The rejected old uniform fade is a labeled counterexample, not a native capture.
            const old = new Sprite({ texture: item.texture })
            old.alpha = .4; old.tint = 0x2c2c2c
            const oldPixels = draw(old, item.source.width, item.source.height)
            old.destroy()
            picture(`original-264-${pass}`, [
              { title: 'Rejected uniform-alpha control', pixels: oldPixels },
              { title: 'New retained glyph GPU output', pixels: afterPixels },
              { title: 'Independent source-texel oracle', pixels: oracle },
            ], item.source.width, item.source.height)
          }
          const columns = [.505, .490, .4].map(alpha => ({
            title: `Original glyph alpha state ${alpha}`,
            pixels: capture(row, { alpha, pass: 'ordinary', local: 1, cc: 1, hit: .2, rgb: [1, 1, 1], tree: true }),
          }))
          picture('original-264-thresholds', columns, item.source.width, item.source.height)
        }
      }
      // Shared scenery material is ordinary even if the supplied Tree-like alpha is .4.
      for (const kind of ['batched', 'standalone']) {
        const item = sources[0]
        const material = createNativeSceneryGlyphMaterial(item.texture, 16, 16, false), hit = material.createHitRedraw()
        if (kind === 'standalone') { material.mesh.geometry.batchMode = 'no-batch'; hit.display.geometry.batchMode = 'no-batch' }
        const row = { ...item, name: 'ordinary-scenery-control', material, hit, kind, points: pointsFor(item.source) }
        retained.push(row)
        for (const pass of ['ordinary', 'complex-hit', 'simple-hit']) {
          capture(row, { alpha: .4, pass, local: .5, cc: .35, hit: .2, rgb: [.5, 1, 0], tree: false })
        }
      }
      // Render the actual separate retained shadow owners with the main hidden
      // only during extraction, so their pixels cannot inherit the main gradient.
      if (mode === 'arena') {
        const row = retained.find(item => item.variant === 0 && item.kind === 'batched')
        const object = { eid: 'material-shadow-tree', typeId: 2001, variant: 0, secondaryVariant: 0,
          secondaryVisible: true, pos: { x: 256, y: 320 } }
        const layer = { kind: 'object', object, atlas: 'DeadHawg', atlasEntry: 264, pos: object.pos,
          sel: { kind: 'object', eid: object.eid }, worldY: 320, sortBias: 0, sortKey: 320, sourceOrder: 0 }
        const root = new Container()
        root.addChild(row.material.mesh)
        const resident = { sprite: row.material.mesh, texture: row.texture, x: 0, y: 0, w: row.source.width, h: row.source.height,
          mainLayerIndex: 0, pixels: new Uint8ClampedArray(0), shadowCaster: null, surfaceMesh: null }
        const view = new BoneyardSceneryShadowPresentation([layer], new Map([[0, resident]]), [],
          entry => entry === 'white' ? Texture.WHITE : glyph(entry))
        try {
          for (const complex of [true, false, true]) {
            const states = []
            for (const alpha of [.505, .490, .4, .505]) {
              row.material.update(alpha, .175, .35); row.hit.update(.2, true)
              const frame = view.render([row.material.mesh], complex, [])
              row.material.mesh.renderable = false
              const pixels = draw(root, 512, 512)
              row.material.mesh.renderable = true
              states.push({ alpha, pixels, frame })
            }
            const first = states[0].pixels
            shadows.push({ complex, quads: states.map(state => state.frame.quadCount),
              changedChannels: states.slice(1).map(state => first.reduce((sum, value, index) => sum + Number(value !== state.pixels[index]), 0)),
              visiblePixels: first.reduce((sum, value, index) => sum + Number(index % 4 === 0 && value !== background[0]), 0),
            })
          }
        } finally { view.destroy(); root.removeChildren(); root.destroy() }
      }
      const restoreRows = retained.filter(row => row.variant === 0 || row.variant === undefined)
      const prior = restoreRows.map(row => ({
        row, input: { alpha: .4, pass: 'complex-hit', local: .5, cc: .35, hit: .2, rgb: [1, 1, 1], tree: row.name !== 'ordinary-scenery-control' },
      })).map(entry => ({ ...entry, pixels: capture(entry.row, entry.input) }))
      await restoreContext(app)
      for (const entry of prior) {
        const pixels = capture(entry.row, entry.input)
        recovery.push({ mode, source: entry.row.name, kind: entry.row.kind,
          changedChannels: pixels.reduce((sum, value, index) => sum + Number(value !== entry.pixels[index]), 0) })
      }
      for (const row of retained) {
        const geometry = row.material.mesh.geometry, hitGeometry = row.hit.display.geometry
        const ownedBuffers = [...geometry.buffers, ...hitGeometry.buffers]
        row.material.destroy(); row.material.destroy(); row.hit.destroy()
        lifetimes.push({ mode, source: row.name, kind: row.kind,
          meshDestroyed: row.material.mesh.destroyed && row.hit.display.destroyed,
          buffersDestroyed: ownedBuffers.every(buffer => buffer.destroyed),
          borrowedTextureAlive: !row.texture.destroyed && !row.texture.source.destroyed,
        })
      }
      for (const target of targets.values()) target.destroy(true)
      pipeline?.destroy()
      app.destroy(true, { children: true })
      for (const texture of ownedTextures) texture.destroy(true)
    }
    atlas.destroy()
    for (const texture of pages.values()) texture.destroy(true)
    return { samples, buffers, originals, lifetimes, shadows, recovery, pictures }
  })
  for (const picture of result.pictures) {
    await writeFile(resolve(output, `${picture.name}.png`), Buffer.from(picture.url.split(',')[1], 'base64'))
  }
  delete result.pictures
  const sourceFiles = [
    'src/game/renderer/native-scenery-glyph-material.ts',
    'src/game/renderer/native-material-batch.ts',
    'src/game/renderer/native-fixed-function-render-pipeline.ts',
    'src/game/renderer/native-arena-render-pipeline.ts',
    'src/game/renderer/boneyard-combat-atlas.generated.ts',
    'tools/smoke-native-tree-material.mjs',
    ...Array.from({ length: 7 }, (_, i) => `src/assets/game/boneyard-combat-atlas-${i}.png`),
  ]
  const hashes = Object.fromEntries(await Promise.all(sourceFiles.map(async path => (
    [path, createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')]
  ))))
  const failures = result.samples.filter(sample => sample.maximumDelta > 3 || sample.colorMismatch)
  await writeFile(resolve(output, 'results.json'), JSON.stringify({
    classification: 'M2 GPU material/source-texel controls; not full native scene parity',
    errors, hashes, decoder, failures, ...result,
  }, null, 2) + '\n')
  console.log(JSON.stringify({
    output, gpu: [...new Set(result.samples.map(sample => sample.gpu))], samples: result.samples.length,
    originalGlyphs: result.originals.length, failures: failures.slice(0, 12), failureCount: failures.length,
    maximumDelta: Math.max(...result.samples.map(sample => sample.maximumDelta)),
    shadows: result.shadows, recovery: result.recovery, errors,
  }, null, 2))
  assert.deepEqual(errors, { console: [], page: [], responses: [], requests: [] })
  assert.deepEqual(failures, [], 'retained glyph output must match native endpoint interpolation and original source texels')
  assert.equal(result.originals.length, 15)
  for (const row of result.buffers) {
    assert.ok(row.unchanged && row.changed && row.colorBufferRetained && row.positionBufferRetained && row.independentHitBuffer, JSON.stringify(row))
    assert.ok(row.changedPixelChannels > 0, JSON.stringify(row))
  }
  for (const row of result.recovery) assert.equal(row.changedChannels, 0, JSON.stringify(row))
  for (const row of result.shadows) {
    assert.deepEqual(row.quads, Array(4).fill(row.complex ? 1 : 3))
    assert.ok(row.visiblePixels > 100, JSON.stringify(row))
    assert.ok(row.changedChannels.every(value => value === 0), JSON.stringify(row))
  }
  for (const row of result.lifetimes) assert.ok(row.meshDestroyed && row.buffersDestroyed && row.borrowedTextureAlive, JSON.stringify(row))
} finally {
  await browser?.close()
  await vite.close()
}

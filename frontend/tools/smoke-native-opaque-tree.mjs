import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

// Material/transport qualification, not a native-versus-web scene-parity gate.
// Oracle: retail 608480, 41eae0, 625010/625097, corrected PC24 v2.
const root = resolve(process.env.SDR_OPAQUE_TREE_ROOT || fileURLToPath(new URL('../', import.meta.url)))
const output = resolve(process.env.SDR_OPAQUE_TREE_OUTPUT || resolve(root, 'reports/native-opaque-tree'))
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
    const { Application, Container, RenderTexture, Sprite } = await import('/__tree-material-pixi')
    const { installNativeFixedFunctionRenderPipeline, nativeStockTextureFromImage } = await import('/src/game/renderer/native-fixed-function-render-pipeline.ts')
    const { installNativeArenaRenderPipeline } = await import('/src/game/renderer/native-arena-render-pipeline.ts')
    const { createNativeSceneryGlyphMaterial } = await import('/src/game/renderer/native-scenery-glyph-material.ts')
    const { createBoneyardCombatAtlas, BONEYARD_COMBAT_ATLAS_SOURCES } = await import('/src/game/renderer/boneyard-combat-atlas.ts')
    const { BONEYARD_COMBAT_ATLAS_FRAMES } = await import('/src/game/renderer/boneyard-combat-atlas.generated.ts')
    const { nativeSceneryGlyphTexture } = await import('/src/game/renderer/native-scenery-shadow.ts')
    const f = Math.fround, mul = (a, b) => f(f(a) * f(b))
    const byte = value => Math.trunc(f(value * 255))
    const background = [16, 24, 40, 255]
    const cases = [], comparisons = [], roundTrips = [], pictures = [], baselines = new Map()
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
        255]
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
      const sx = source.x + (x + .25) / source.width * (source.width - .25)
      const sy = source.y + (y + .25) / source.height * (source.height - .25)
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

    const source = sourceFor(264), texture = glyph(264), points = pointsFor(source)
    const pad = 4, width = source.width + pad * 2, height = source.height + pad * 2
    function differences(a, b) {
      let maximumDelta = 0, overTolerancePixels = 0, changedChannels = 0
      for (let i = 0; i < a.length; i += 4) {
        let pixelDelta = 0
        for (let c = 0; c < 4; c += 1) {
          const delta = Math.abs(a[i + c] - b[i + c])
          maximumDelta = Math.max(maximumDelta, delta)
          pixelDelta = Math.max(pixelDelta, delta)
          changedChannels += Number(delta > 0)
        }
        overTolerancePixels += Number(pixelDelta > 3)
      }
      return { maximumDelta, overTolerancePixels, changedChannels, pixels: a.length / 4 }
    }
    function oracleImage(input, composite) {
      const pixels = new Uint8Array(source.width * source.height * 4)
      for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
        const texel = texelAt(source, x, y), fractionY = (y + .25) / source.height
        const destination = composite ? expected({ ...input, pass: 'ordinary' }, texel, fractionY, 'arena') : background
        pixels.set(expected(input, texel, fractionY, 'arena', destination), (y * source.width + x) * 4)
      }
      return pixels
    }
    let negativeControl
    for (const optimized of [false, true]) {
      const app = new Application()
      // Matches Boneyard's actual renderer and world-root pipeline configuration.
      await app.init({ antialias: false, autoDensity: true, autoStart: false,
        background: 0x000000, backgroundAlpha: 1, width, height, resolution: 1,
        powerPreference: 'high-performance', preference: 'webgl', preferWebGLVersion: 2,
        roundPixels: false })
      installNativeFixedFunctionRenderPipeline(app.renderer, {
        installTextureAlphaShaders: false, nativeWorldPixelCenters: true,
      })
      const world = new Container({ isRenderGroup: true, label: 'opaque-tree-world' })
      app.stage.addChild(world)
      const pipeline = installNativeArenaRenderPipeline(app.renderer, optimized ? world : undefined)
      const gl = app.renderer.gl, info = gl.getExtension('WEBGL_debug_renderer_info')
      const gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
      if (!/Apple M2/.test(gpu) || /SwiftShader|llvmpipe/i.test(gpu)) throw new Error(`Expected real M2 GPU, got ${gpu}`)
      if (gl.getContextAttributes().alpha !== false) throw new Error('Default framebuffer must be opaque')
      const target = RenderTexture.create({ width, height, alphaMode: 'no-premultiply-alpha' })
      function draw(display, offscreen = false) {
        world.addChild(display)
        // Explicit quarter-pixel phase avoids fragment centers on a quad edge.
        // The actual native +0.5 projection remains enabled; oracle samples +0.25.
        display.position.set(pad - .25, pad - .25)
        const originalDraw = gl.drawElements, draws = []
        gl.drawElements = function (...args) {
          draws.push({ indices: args[1], defaultFramebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING) === null })
          return originalDraw.apply(this, args)
        }
        let pixels, witness
        try {
          // Omit target entirely for the default framebuffer; no extract API rerender.
          const options = { container: app.stage, clear: true, clearColor: background.map(value => value / 255) }
          if (offscreen) options.target = target
          app.renderer.render(options)
          const defaultFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING) === null
          const raw = new Uint8Array(width * height * 4)
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw)
          if (gl.getError() !== gl.NO_ERROR) throw new Error('WebGL readPixels failed')
          const batcher = app.renderer.renderPipes.batch['_batchersByInstructionSet'][world.renderGroup.instructionSet.uid]?.default
          const batches = Array.from(batcher?.batches ?? []).slice(0, batcher?.batchIndex ?? 0).map(batch => ({
            opaque: batch.opaque === true, blendMode: batch.blendMode, size: batch.size,
            elements: batch.elements.length,
          }))
          const modes = []
          if (batcher) for (let offset = 6; offset < batcher.attributeSize; offset += 7) {
            modes.push(batcher.attributeBuffer.float32View[offset])
          }
          witness = { defaultFramebuffer, alpha: gl.getContextAttributes().alpha,
            passEnabled: batcher?.pass?.enabled === true, batches, modes: [...new Set(modes)], draws,
            projection: { tx: app.renderer.renderTarget.projectionMatrix.tx, ty: app.renderer.renderTarget.projectionMatrix.ty } }
          pixels = new Uint8Array(source.width * source.height * 4)
          // Direct default-framebuffer readback is bottom-up. Offscreen is only a
          // branch-transition witness here, never an oracle or image comparison.
          for (let y = 0; y < source.height; y += 1) {
            const offset = ((height - 1 - pad - y) * width + pad) * 4
            pixels.set(raw.subarray(offset, offset + source.width * 4), y * source.width * 4)
          }
        } finally { gl.drawElements = originalDraw; world.removeChild(display) }
        return { pixels, witness }
      }
      for (const kind of ['batched', 'standalone']) {
        const material = createNativeSceneryGlyphMaterial(texture, source.width, source.height, true)
        const hit = material.createHitRedraw()
        if (kind === 'standalone') {
          material.mesh.geometry.batchMode = 'no-batch'; hit.display.geometry.batchMode = 'no-batch'
        }
        function capture(input, composite = false) {
          const display = composite ? new Container() : input.pass === 'ordinary' ? material.mesh : hit.display
          // Prior standalone draws may have left a position on the same mesh.
          material.mesh.position.set(0, 0); hit.display.position.set(0, 0)
          if (composite) display.addChild(material.mesh, hit.display)
          material.update(input.alpha, mul(input.local, input.cc), input.cc, input.rgb)
          hit.update(input.hit, input.pass === 'complex-hit')
          const actual = draw(display)
          if (composite) { display.removeChildren(); display.destroy() }
          const oracle = oracleImage(input, composite)
          const colors = Array.from(input.pass === 'ordinary' ? material.colors : hit.colors)
            .map(value => [value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24])
          const [top, bottom] = endpoints(input)
          const key = JSON.stringify({ kind, ...input, composite })
          if (optimized && baselines.has(key)) comparisons.push({ kind, ...input, composite,
            ...differences(actual.pixels, baselines.get(key)) })
          else if (!optimized) baselines.set(key, actual.pixels)
          const row = { optimized, kind, ...input, composite, gpu,
            colors, expectedColors: [top, top, bottom, bottom],
            colorMismatch: JSON.stringify(colors) !== JSON.stringify([top, top, bottom, bottom]),
            ...differences(actual.pixels, oracle), witness: actual.witness,
            samples: points.map(point => ({ point, texel: texelAt(source, point.x, point.y),
              fractionY: (point.y + .25) / source.height, pixel: pixelsAt(actual.pixels, source.width, point),
              expected: pixelsAt(oracle, source.width, point) })) }
          cases.push(row)
          return { ...actual, oracle, row }
        }
        for (const alpha of [.505, .490, .4]) for (const pass of ['ordinary', 'complex-hit', 'simple-hit']) {
          const input = { alpha, pass, local: .5, cc: .35, hit: .2, rgb: [1, .7, .4], tree: true }
          capture(input)
          if (pass !== 'ordinary') capture(input, true)
        }
        for (const cc of [0, 1]) for (const pass of ['ordinary', 'complex-hit', 'simple-hit']) {
          capture({ alpha: .4, pass, local: .5, cc, hit: .2, rgb: [1, 1, 1], tree: true })
        }
        if (optimized && kind === 'batched') {
          const input = { alpha: .4, pass: 'ordinary', local: .5, cc: .35, hit: .2, rgb: [1, 1, 1], tree: true }
          const after = capture(input)
          const old = new Sprite({ texture })
          old.alpha = .4; old.tint = 0x2c2c2c
          const oldOutput = draw(old); old.destroy()
          negativeControl = { label: 'Reconstructed old ordinary uniform-alpha counterexample, not native capture',
            rejected: differences(oldOutput.pixels, after.oracle),
            accepted: differences(after.pixels, after.oracle), witness: oldOutput.witness }
          picture('opaque-original-264-ordinary', [
            { title: 'Rejected uniform-alpha control', pixels: oldOutput.pixels },
            { title: 'Opaque screen Tree GPU', pixels: after.pixels },
            { title: 'Independent raw-PNG oracle', pixels: after.oracle },
          ], source.width, source.height)
          for (const pass of ['complex-hit', 'simple-hit']) {
            const result = capture({ ...input, pass }, true)
            picture(`opaque-original-264-${pass}`, [
              { title: 'Ordinary + hit, opaque GPU', pixels: result.pixels },
              { title: 'Independent raw-PNG oracle', pixels: result.oracle },
            ], source.width, source.height)
          }
          picture('opaque-original-264-thresholds', [.505, .490, .4].map(alpha => ({
            title: `Original Tree alpha ${alpha}`,
            pixels: capture({ ...input, alpha, local: 1, cc: 1 }).pixels,
          })), source.width, source.height)
          // Same retained mesh crosses target types. The optimization must turn
          // off for explicit RGBA targets and return for the default framebuffer.
          material.mesh.position.set(0, 0)
          const first = draw(material.mesh), middle = draw(material.mesh, true), last = draw(material.mesh)
          roundTrips.push({ first: first.witness, middle: middle.witness, last: last.witness,
            ...differences(first.pixels, last.pixels) })
        }
        material.destroy()
      }
      target.destroy(true); pipeline.destroy(); app.destroy(true, { children: true })
    }
    const textureAlphaMode = texture.source.alphaMode
    atlas.destroy()
    for (const texture of pages.values()) texture.destroy(true)
    return { cases, comparisons, roundTrips, pictures, negativeControl,
      source: { entry: 264, page: source.page, x: source.x, y: source.y,
        width: source.width, height: source.height, sampling: 'Native pixel-center projection; quad at pad-.25 samples object (x+.25,y+.25), quarter-texel UV bounds',
        textureAlphaMode }, tolerance: 3 }
  })
  for (const picture of result.pictures) {
    await writeFile(resolve(output, `${picture.name}.png`), Buffer.from(picture.url.split(',')[1], 'base64'))
  }
  delete result.pictures
  const failures = result.cases.filter(row => row.maximumDelta > 3 || row.colorMismatch)
  const summary = { cases: result.cases.length, comparedPixels: result.cases.reduce((sum, row) => sum + row.pixels, 0),
    maximumDelta: Math.max(...result.cases.map(row => row.maximumDelta)), failures: failures.length,
    pairComparisons: result.comparisons.length, pairMaximumDelta: Math.max(...result.comparisons.map(row => row.maximumDelta)),
    negativeControl: result.negativeControl, errors }
  await writeFile(resolve(output, 'results.json'), JSON.stringify({
    classification: 'Original264 opaque-screen GPU material qualification; not clean-stock scene parity',
    decoder, errors, failures, ...result,
  }, null, 2) + '\n')
  await writeFile(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
  console.log(JSON.stringify({ output, ...summary }, null, 2))
  assert.deepEqual(errors, { console: [], page: [], responses: [], requests: [] })
  assert.equal(failures.length, 0, 'Full original glyph must match raw source oracle within 3 bytes; see results.json')
  for (const row of result.cases) {
    const witness = row.witness
    assert.equal(witness.alpha, false)
    assert.equal(witness.defaultFramebuffer, true)
    assert.ok(witness.draws.every(draw => draw.defaultFramebuffer))
    assert.equal(witness.draws.reduce((n, draw) => n + draw.indices, 0), row.composite ? 12 : 6)
    if (row.kind === 'batched') {
      assert.equal(witness.draws.length, 1)
      assert.ok(witness.batches.length > 0)
      assert.ok(witness.batches.every(batch => batch.opaque === row.optimized))
      const ordinaryMode = row.optimized ? 4 : 0, hitMode = ordinaryMode + 2
      assert.deepEqual(witness.modes.slice().sort((a, b) => a - b), row.composite ? [ordinaryMode, hitMode]
        : [row.pass === 'ordinary' ? ordinaryMode : hitMode])
    } else {
      assert.equal(witness.draws.length, row.composite ? 2 : 1)
      assert.equal(witness.batches.length, 0)
    }
  }
  for (const row of result.comparisons) assert.ok(row.maximumDelta <= 3, JSON.stringify(row))
  assert.ok(result.negativeControl.rejected.overTolerancePixels > 1000)
  assert.equal(result.negativeControl.accepted.overTolerancePixels, 0)
  for (const row of result.roundTrips) {
    assert.equal(row.first.passEnabled, true)
    assert.equal(row.middle.passEnabled, false)
    assert.equal(row.last.passEnabled, true)
    assert.equal(row.middle.defaultFramebuffer, false)
    assert.equal(row.changedChannels, 0)
  }
} finally {
  await browser?.close()
  await vite.close()
}

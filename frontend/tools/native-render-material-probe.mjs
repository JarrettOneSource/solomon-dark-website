import {
  Application, BufferImageSource, Container, Graphics, MeshSimple, Particle, ParticleContainer,
  RenderTexture, Sprite, Texture,
} from 'pixi.js'
import {
  installNativeFixedFunctionRenderPipeline, setNativeFixedFunctionVertexColors,
} from '../src/game/renderer/native-fixed-function-render-pipeline.ts'
import {
  createNativeArenaUnpremultipliedParticleShader, installNativeArenaRenderPipeline,
  setNativeArenaVertexColors,
} from '../src/game/renderer/native-arena-render-pipeline.ts'

import { createNativeWallSurfaceMesh } from '../src/game/renderer/boneyard-building-surface-view.ts'

const size = 16
const vertices = new Float32Array([0, 0, size, 0, size, size, 0, size])
const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
const indices = new Uint32Array([0, 1, 2, 0, 2, 3])

function textureFromPixel(pixel, premultiplied = false) {
  return new Texture({
    source: new BufferImageSource({
      alphaMode: premultiplied ? 'premultiplied-alpha' : 'no-premultiply-alpha',
      height: 1,
      resource: new Uint8Array(pixel),
      scaleMode: 'nearest',
      width: 1,
    }),
  })
}

function pack([r, g, b, a]) {
  return (r | g << 8 | b << 16 | a << 24) >>> 0
}

function samplePixels(renderer, target) {
  const { pixels } = renderer.extract.pixels({ target })
  const offset = (8 * size + 8) * 4
  return Array.from(pixels.slice(offset, offset + 4))
}

export async function renderNativeMaterialSamples() {
  const samples = []
  for (const mode of ['fixed', 'arena']) {
    const app = new Application()
    await app.init({
      antialias: false, autoStart: false, height: size,
      preference: 'webgl', resolution: 1, width: size,
    })
    installNativeFixedFunctionRenderPipeline(app.renderer)
    const pipeline = mode === 'arena' ? installNativeArenaRenderPipeline(app.renderer) : null
    const target = RenderTexture.create({
      alphaMode: 'no-premultiply-alpha', height: size, width: size,
    })
    const setColors = mode === 'arena'
      ? setNativeArenaVertexColors : setNativeFixedFunctionVertexColors
    const retainedTextures = []
    try {
      const firstTexture = textureFromPixel([255, 255, 255, 255], true)
      retainedTextures.push(firstTexture)
      const firstSprite = new Sprite({ texture: firstTexture, width: size, height: size })
      firstSprite.alpha = 128 / 255
      app.stage.addChild(firstSprite)
      app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 0] })
      samples.push({ mode, pixel: samplePixels(app.renderer, target), role: 'first-normal' })
      app.stage.removeChild(firstSprite)
      firstSprite.destroy()
      const gradients = [
        { role: 'gradient', top: [255, 0, 0, 0], bottom: [0, 255, 0, 255] },
        { role: 'acid-gradient', top: [102, 242, 128, 0], bottom: [179, 242, 191, 127] },
        { role: 'storm-gradient', top: [102, 242, 255, 0], bottom: [204, 242, 255, 127] },
        { role: 'shadow-gradient', top: [0, 0, 0, 255], bottom: [0, 0, 0, 0] },
        { role: 'light-gradient', top: [64, 64, 64, 255], bottom: [192, 192, 192, 255] },
      ]
      for (const premultiplied of [false, true]) {
        for (const blend of ['add', 'normal']) {
          for (const gradient of gradients) {
            const texture = textureFromPixel([255, 255, 255, 255], premultiplied)
            retainedTextures.push(texture)
            const mesh = new MeshSimple({ indices, texture, uvs, vertices })
            mesh.blendMode = blend
            setColors(mesh, new Uint32Array([
              pack(gradient.top), pack(gradient.top), pack(gradient.bottom), pack(gradient.bottom),
            ]))
            samples.push({
              ...gradient, blend, mode, premultiplied,
              pixel: drawSample(app, target, mesh),
            })
            mesh.destroy()
          }
        }
      }
      samples.push(...uniformSamples(app, target, mode, retainedTextures))
      for (const alpha of [0, 1, 128, 255]) {
        const texture = textureFromPixel([128, 64, 192, alpha])
        retainedTextures.push(texture)
        const sprite = new Sprite({ texture, width: size, height: size, blendMode: 'multiply' })
        app.stage.addChild(sprite)
        app.renderer.render({ container: app.stage, target, clear: true, clearColor: [1, 1, 1, 1] })
        samples.push({ alpha, mode, pixel: samplePixels(app.renderer, target), role: 'multiply' })
        app.stage.removeChild(sprite)
        sprite.destroy()
      }
      if (mode === 'arena') {
        samples.push(...particleBlendSamples(app, target, retainedTextures))
      }
      await restoreContext(app)
      samples.push(...uniformSamples(app, target, mode, retainedTextures, true))
    } finally {
      target.destroy(true)
      pipeline?.destroy()
      app.destroy(true, { children: true })
      for (const texture of retainedTextures) texture.destroy(true)
    }
  }
  return samples
}

function drawSample(app, target, display, clearColor = [0, 0, 0, 0]) {
  app.stage.addChild(display)
  app.renderer.render({ container: app.stage, target, clear: true, clearColor })
  const pixel = samplePixels(app.renderer, target)
  app.stage.removeChild(display)
  return pixel
}

function uniformSamples(app, target, mode, retainedTextures, restored = false) {
  const samples = []
  for (const kind of ['sprite', 'standalone-mesh', 'graphics', 'surface', 'particle']) {
    if (mode === 'fixed' && (kind === 'surface' || kind === 'particle')) continue
    const texture = textureFromPixel([255, 255, 255, 255])
    retainedTextures.push(texture)
    const parent = new Container({ isRenderGroup: true })
    parent.alpha = 128 / 255
    let display
    let surface
    if (kind === 'sprite') {
      display = new Sprite({ texture, width: size, height: size })
    } else if (kind === 'standalone-mesh') {
      display = new MeshSimple({ indices, texture, uvs, vertices })
      display.geometry.batchMode = 'no-batch'
    } else if (kind === 'surface') {
      surface = createNativeWallSurfaceMesh(texture, size, size)
      surface.update([1, 1, 1, 1])
      display = surface.mesh
      display.position.set(size / 2, size / 2)
    } else if (kind === 'particle') {
      display = new ParticleContainer({
        shader: createNativeArenaUnpremultipliedParticleShader(), texture,
      })
      const particle = new Particle({ texture, scaleX: size, scaleY: size })
      display.addParticle(particle)
    } else {
      display = new Graphics()
      // Enough points force the standalone Graphics adapter, with the same
      // solid coverage at the sample as the Sprite and unbatchable mesh.
      const points = Array.from({ length: 150 }, (_, index) => {
        const angle = index * Math.PI * 2 / 150
        return [size / 2 + Math.cos(angle) * size, size / 2 + Math.sin(angle) * size]
      }).flat()
      display.poly(points).fill(0xffffff)
    }
    display.tint = 0x80c0ff
    display.alpha = 128 / 255
    parent.addChild(display)
    try {
      samples.push({ kind, mode, restored, pixel: drawSample(app, target, parent), role: 'uniform' })
    } catch (error) {
      throw new Error(`${mode}/${kind}/restored=${restored}: ${error.message}`, { cause: error })
    }
    if (surface) surface.destroy()
    parent.destroy({ children: true })
  }
  return samples
}

function particleBlendSamples(app, target, retainedTextures) {
  const samples = []
  for (const blend of ['normal', 'add', 'multiply']) {
    for (const alpha of [0, 128, 255]) {
      const texture = textureFromPixel([128, 64, 192, alpha])
      retainedTextures.push(texture)
      const container = new ParticleContainer({
        shader: createNativeArenaUnpremultipliedParticleShader(), texture,
      })
      container.blendMode = blend
      container.addParticle(new Particle({ texture, scaleX: size, scaleY: size }))
      const clear = blend === 'multiply' ? [1, 1, 1, 1] : [0, 0, 0, 0]
      samples.push({
        alpha, blend, mode: 'arena', role: 'particle-blend',
        pixel: drawSample(app, target, container, clear),
      })
      container.destroy()
    }
  }
  return samples
}

async function restoreContext(app) {
  const extension = app.renderer.gl.getExtension('WEBGL_lose_context')
  if (!extension) throw new Error('WebGL context-loss test extension is unavailable')
  const lost = contextEvent(app.canvas, 'webglcontextlost')
  extension.loseContext()
  await lost
  const restored = contextEvent(app.canvas, 'webglcontextrestored')
  // Chrome finishes the loss event before it accepts a restore request.
  await new Promise(resolve => setTimeout(resolve, 100))
  extension.restoreContext()
  await restored
}

function contextEvent(canvas, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${name}`)), 5000)
    canvas.addEventListener(name, event => {
      event.preventDefault()
      clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}

export async function measureNativeMaterialFrames() {
  const app = new Application()
  await app.init({
    antialias: false, autoStart: false, height: 900,
    preference: 'webgl', resolution: 1, width: 1600,
  })
  installNativeFixedFunctionRenderPipeline(app.renderer)
  const pipeline = installNativeArenaRenderPipeline(app.renderer)
  document.body.replaceChildren(app.canvas)
  const root = new Container()
  app.stage.addChild(root)
  const texture = textureFromPixel([255, 255, 255, 255])
  const meshes = Array.from({ length: 4096 }, (_, index) => {
    const mesh = new MeshSimple({ indices, texture, uvs, vertices })
    mesh.blendMode = index % 2 === 0 ? 'normal' : 'add'
    mesh.position.set(index % 64 * 24, Math.floor(index / 64) * 13)
    setNativeArenaVertexColors(mesh, new Uint32Array([
      pack([102, 242, 128, 0]), pack([102, 242, 128, 0]),
      pack([179, 242, 191, 127]), pack([179, 242, 191, 127]),
    ]))
    return mesh
  })
  const gl = app.renderer.gl
  const allocationCounts = { buffers: 0, programs: 0, textures: 0 }
  for (const [method, key] of [['createBuffer', 'buffers'], ['createProgram', 'programs'], ['createTexture', 'textures']]) {
    const original = gl[method].bind(gl)
    gl[method] = (...args) => { allocationCounts[key] += 1; return original(...args) }
  }
  const longTasks = []
  const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries()))
  observer.observe({ type: 'longtask' })
  const phases = []
  let frame = 0
  let churn = false
  function renderFrame() {
    frame += 1
    root.position.x = Math.sin(frame / 25) * 3
    for (let i = 0; i < root.children.length; i += 1) {
      root.children[i].alpha = 0.75 + ((frame + i) % 20) / 100
    }
    if (churn) root.addChild(root.removeChildAt(0))
    app.render()
  }
  try {
    const population = [['baseline', 64], ['stress', 4096], ['churn', 4096], ['restoration', 64]]
    for (const [name, count] of population) {
      churn = name === 'churn'
      root.removeChildren()
      root.addChild(...meshes.slice(0, count))
      for (let i = 0; i < 40; i += 1) {
        await new Promise(requestAnimationFrame)
        renderFrame()
      }
      const allocationsBefore = { ...allocationCounts }
      const frameGaps = []
      const renderTimes = []
      const startedAt = performance.now()
      let previous = await new Promise(requestAnimationFrame)
      while (performance.now() - startedAt < 3000) {
        const timestamp = await new Promise(requestAnimationFrame)
        frameGaps.push(timestamp - previous)
        previous = timestamp
        const renderStart = performance.now()
        renderFrame()
        renderTimes.push(performance.now() - renderStart)
      }
      const endedAt = performance.now()
      const tasks = longTasks.filter(entry => entry.startTime >= startedAt && entry.startTime < endedAt)
      phases.push({
        count, name, frameGaps, renderTimes,
        gpuAllocations: Object.fromEntries(Object.keys(allocationCounts).map(key => [key, allocationCounts[key] - allocationsBefore[key]])),
        longTasks: tasks.map(entry => entry.duration),
      })
    }
    const extension = gl.getExtension('WEBGL_debug_renderer_info')
    return { gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : '', phases }
  } finally {
    observer.disconnect()
    root.removeChildren()
    for (const mesh of meshes) mesh.destroy()
    texture.destroy(true)
    pipeline.destroy()
    app.destroy(true, { children: true })
  }
}

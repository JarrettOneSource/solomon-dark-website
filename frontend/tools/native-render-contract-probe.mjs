import { Application, BufferImageSource, Container, Rectangle, RenderTexture, Sprite, Texture } from 'pixi.js'
import {
  installNativeFixedFunctionRenderPipeline,
  nativeCompositedTextureFromImage,
  nativeStockFramedTextureFromImage,
  nativeStockPointTextureFromImage,
  nativeStockTextureFromImage,
} from '../src/game/renderer/native-fixed-function-render-pipeline.ts'
import { installNativeArenaRenderPipeline } from '../src/game/renderer/native-arena-render-pipeline.ts'
import { createNativeLitSurfaceGrid } from '../src/game/renderer/boneyard-building-surface-view.ts'
import { NativeBoneyardSurfaceView } from '../src/game/renderer/native-boneyard-surface-view.ts'

export async function inspectNativeRenderContracts() {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 1
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, 2, 1)
  const image = new Image()
  image.src = canvas.toDataURL()
  await image.decode()
  const factories = [
    ['stock', nativeStockTextureFromImage], ['point', nativeStockPointTextureFromImage],
    ['framed', nativeStockFramedTextureFromImage], ['composited', nativeCompositedTextureFromImage],
  ]
  const textures = factories.map(([name, factory]) => ({ name, texture: factory(image) }))
  const app = new Application()
  await app.init({ autoStart: false, width: 64, height: 64, preference: 'webgl', backgroundAlpha: 1 })
  installNativeFixedFunctionRenderPipeline(app.renderer, { installTextureAlphaShaders: false })
  installNativeFixedFunctionRenderPipeline(app.renderer, { installTextureAlphaShaders: false })
  const arena = installNativeArenaRenderPipeline(app.renderer)
  const target = RenderTexture.create({ width: 64, height: 64, alphaMode: 'no-premultiply-alpha' })
  const texture = textures[0].texture
  const result = { sources: [], grids: [], roads: {}, missingRoad: {}, detachedScene: {} }
  try {
    for (const { name, texture } of textures) {
      const sprite = new Sprite({ texture, width: 64, height: 64 })
      app.stage.addChild(sprite)
      app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 0] })
      result.sources.push({
        name, alphaMode: texture.source.alphaMode,
        addressMode: texture.source.style.addressMode,
        scaleMode: texture.source.style.scaleMode,
        pixel: pixel(app, target, 32, 32),
      })
      sprite.destroy()
    }
    for (const enhanced of [false, true]) {
      const surface = createNativeLitSurfaceGrid(texture, 64, 64, enhanced)
      app.stage.addChild(surface.mesh)
      const count = enhanced ? 9 : 4
      app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 0] })
      const initial = pixel(app, target, 32, 32)
      surface.update(new Array(count).fill(1))
      app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 0] })
      const before = pixel(app, target, 32, 32)
      surface.update(new Array(count).fill(0.25))
      app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 0] })
      const after = pixel(app, target, 32, 32)
      surface.update(new Array(count).fill(0.25))
      const colors = Array.from(surface.colors)
      const geometry = surface.mesh.geometry
      const buffers = [...geometry.buffers]
      const shader = surface.mesh.shader
      surface.destroy()
      result.grids.push({
        enhanced, initial, before, after, colors,
        vertices: count, removed: surface.mesh.parent === null,
        meshDestroyed: surface.mesh.destroyed,
        geometryDestroyed: geometry.buffers === null && buffers.every(buffer => buffer.destroyed),
        shaderDestroyed: shader.resources === null,
        borrowedTextureAlive: !texture.destroyed,
      })
    }
    const roads = Array.from({ length: 5 }, (_, style) => ({
      eid: `road-${style}`, typeId: 3004, style, linkMask: 3,
      startWidthScale: 1, endWidthScale: 1,
      points: [{ x: 0, y: 8 + style * 12 }, { x: 64, y: 8 + style * 12 }],
    }))
    const scene = { bounds: { x: 0, y: 0, w: 64, h: 64 }, roads }
    const roadTexture = new Texture({ source: new BufferImageSource({
      resource: new Uint8Array([128, 128, 128, 255]), width: 1, height: 1,
      alphaMode: 'no-premultiply-alpha',
    }) })
    const surface = new NativeBoneyardSurfaceView(app.stage, scene, {
      ground: texture, roads: new Array(5).fill(roadTexture),
    })
    const meshes = [surface.container.children[0], ...surface.container.children[1].children]
    const roadRoot = surface.container.children[1]
    const resources = meshes.map(mesh => ({ mesh, geometry: mesh.geometry, shader: mesh.shader, buffers: [...mesh.geometry.buffers] }))
    app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 0] })
    const countBefore = surface.activeRoadMeshCount
    surface.applyOffCameraCleanup(new Set(['road:road-0', 'road:road-2']))
    app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 0] })
    const countAfter = surface.activeRoadMeshCount
    surface.applyOffCameraCleanup(new Set())
    result.roads = {
      countBefore, countAfter, countAfterEmpty: surface.activeRoadMeshCount,
      vertices: surface.roadVertexCount, indices: surface.roadIndexCount,
      meshes: surface.roadMeshCount, pixel: pixel(app, target, 32, 32),
    }
    surface.destroy()
    result.roads.childrenAfterDestroy = app.stage.children.length
    result.roads.resourcesDestroyed = roadRoot.destroyed && resources.every(({ mesh, geometry, shader, buffers }) => (
      mesh.destroyed && geometry.buffers === null && shader.resources === null && buffers.every(buffer => buffer.destroyed)
    ))
    result.roads.textureAlive = !roadTexture.destroyed
    roadTexture.destroy(true)
    const detached = new NativeBoneyardSurfaceView(app.stage, { ...scene, roads: [] }, {
      ground: texture, roads: [],
    })
    app.stage.removeChild(detached.container)
    detached.destroy()
    result.detachedScene = { destroyed: detached.container.destroyed, count: detached.activeRoadMeshCount }
    const parent = new Container()
    try {
      new NativeBoneyardSurfaceView(parent, scene, { ground: texture, roads: [] })
    } catch (error) {
      result.missingRoad = { message: error.message, childrenAfterFailure: parent.children.length }
    }
    parent.destroy({ children: true })
  } finally {
    target.destroy(true)
    arena.destroy()
    arena.destroy()
    app.destroy(true, { children: true })
    for (const { texture } of textures) texture.destroy(true)
  }
  return result
}

function pixel(app, target, x, y) {
  const { pixels } = app.renderer.extract.pixels({ target })
  const offset = (y * 64 + x) * 4
  return Array.from(pixels.slice(offset, offset + 4))
}

export async function inspectNativeRendererVariants() {
  const { Particle, ParticleContainer, Texture, WebGLRenderer, WebGPURenderer } = await import('pixi.js')
  const errors = []
  for (const [name, renderer, install] of [
    ['uninitialized-fixed', new WebGLRenderer(), installNativeFixedFunctionRenderPipeline],
    ['uninitialized-arena', new WebGLRenderer(), installNativeArenaRenderPipeline],
    ['unsupported-renderer', new WebGPURenderer(), installNativeFixedFunctionRenderPipeline],
  ]) {
    try { install(renderer) } catch (error) { errors.push({ name, message: error.message }) }
  }
  const variants = []
  for (const name of ['sprite-only', 'blend-only', 'browser-overlay', 'default-particle']) {
    const app = new Application()
    await app.init({ autoStart: false, width: 64, height: 64, preference: 'webgl', backgroundAlpha: 0 })
    const target = RenderTexture.create({ width: 64, height: 64, alphaMode: 'no-premultiply-alpha' })
    let arena
    const meshPipe = app.renderer.renderPipes.mesh
    if (name === 'sprite-only') delete app.renderer.renderPipes.mesh
    installNativeFixedFunctionRenderPipeline(app.renderer, {
      preserveBrowserCompositingAlpha: name === 'browser-overlay',
      installTextureAlphaShaders: name !== 'blend-only',
    })
    if (name === 'sprite-only') app.renderer.renderPipes.mesh = meshPipe
    const texture = name === 'blend-only' ? new Texture({ source: new BufferImageSource({
      resource: new Uint8Array([255, 255, 255, 255]), width: 1, height: 1, alphaMode: 'no-premultiply-alpha',
    }) }) : Texture.WHITE
    try {
      const display = name === 'default-particle'
        ? new ParticleContainer({ texture: Texture.WHITE })
        : new Sprite({ texture, width: 64, height: 64 })
      if (name === 'default-particle') {
        arena = installNativeArenaRenderPipeline(app.renderer)
        display.addParticle(new Particle({ texture: Texture.WHITE, scaleX: 64, scaleY: 64 }))
      } else display.alpha = 128 / 255
      app.stage.addChild(display)
      app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 0] })
      variants.push({ name, pixel: pixel(app, target, 32, 32) })
    } finally {
      target.destroy(true)
      arena?.destroy()
      app.destroy(true, { children: true })
      if (name === 'blend-only') texture.destroy(true)
    }
  }
  return { errors, variants }
}

export async function compareNativeBatchTransforms() {
  const { BufferImageSource, MeshSimple, Texture } = await import('pixi.js')
  const sources = [
    new Uint8Array([48, 48, 48, 255, 144, 144, 144, 255, 208, 208, 208, 255, 255, 255, 255, 255]),
    new Uint8Array([255, 255, 255, 255, 64, 64, 64, 255, 128, 128, 128, 255, 192, 192, 192, 255]),
  ].map(resource => new Texture({ source: new BufferImageSource({
    resource, width: 2, height: 2, alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest',
  }) }))
  async function capture(mode) {
    const app = new Application()
    await app.init({ autoStart: false, width: 128, height: 128, preference: 'webgl', resolution: 1 })
    let arena
    if (mode !== 'reference') {
      installNativeFixedFunctionRenderPipeline(app.renderer)
      if (mode === 'arena') arena = installNativeArenaRenderPipeline(app.renderer)
    }
    const target = RenderTexture.create({ width: 128, height: 128, alphaMode: 'no-premultiply-alpha' })
    const root = new Container({ isRenderGroup: true })
    root.position.set(4.3, 7.1)
    app.stage.addChild(root)
    const views = []
    for (let i = 0; i < 8; i += 1) {
      const texture = sources[i % 2]
      const display = i < 4
        ? new Sprite({ texture, width: 16, height: 16 })
        : new MeshSimple({
            texture, indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
            vertices: new Float32Array([0, 0, 16, 0, 16, 16, 0, 16]),
            uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
          })
      display.position.set(16 + (i % 4) * 27, 22 + Math.floor(i / 4) * 55)
      display.pivot.set(2, 4)
      display.scale.set(0.7 + i * 0.04, 0.8 + i * 0.07)
      display.rotation = i * 0.19
      display.skew.set(0.07 * i, -0.03 * i)
      display.roundPixels = i % 2 === 0
      display.tint = i % 3 === 0 ? 0x808080 : 0xffffff
      views.push(display)
      root.addChild(display)
    }
    const frames = []
    try {
      for (let frame = 0; frame < 3; frame += 1) {
        views[0].texture = sources[frame % 2]
        views[5].position.x += 0.3
        if (frame === 2) root.addChild(root.removeChildAt(0))
        app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 0] })
        frames.push({
          pixels: Array.from(app.renderer.extract.pixels({ target }).pixels),
          batchShaders: Object.values(app.renderer.renderPipes.batch['_batchersByInstructionSet']).map(row => row.default.shader.uid),
        })
      }
    } finally {
      target.destroy(true)
      arena?.destroy()
      app.destroy(true, { children: true })
    }
    return frames
  }
  try {
    const reference = await capture('reference')
    const results = []
    for (const mode of ['fixed', 'arena']) {
      const frames = await capture(mode)
      for (const [index, { pixels, batchShaders }] of frames.entries()) {
        let changedChannels = 0
        let visiblePixels = 0
        for (let i = 0; i < pixels.length; i += 1) {
          if (Math.abs(pixels[i] - reference[index].pixels[i]) > 1) changedChannels += 1
          if (i % 4 === 3 && reference[index].pixels[i] > 0) visiblePixels += 1
        }
        const reusedBatchShaders = JSON.stringify(batchShaders) === JSON.stringify(frames[0].batchShaders)
        results.push({ mode, frame: index, changedChannels, visiblePixels, reusedBatchShaders })
      }
    }
    return results
  } finally {
    for (const texture of sources) texture.destroy(true)
  }
}

export async function inspectNativeSurfaceSampling() {
  const app = new Application()
  await app.init({ autoStart: false, width: 64, height: 64, preference: 'webgl', resolution: 1 })
  installNativeFixedFunctionRenderPipeline(app.renderer, { installTextureAlphaShaders: false })
  const arena = installNativeArenaRenderPipeline(app.renderer)
  const target = RenderTexture.create({ width: 64, height: 64, alphaMode: 'no-premultiply-alpha' })
  const texture = new Texture({
    source: new BufferImageSource({
      resource: new Uint8Array([32, 32, 32, 255, 160, 160, 160, 255]),
      width: 2, height: 1, alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest',
    }),
    frame: new Rectangle(1, 0, 1, 1),
  })
  texture.textureMatrix.update()
  const surface = createNativeLitSurfaceGrid(texture, 64, 64, false)
  app.stage.addChild(surface.mesh)
  try {
    app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 0] })
    return [pixel(app, target, 8, 32), pixel(app, target, 56, 32)]
  } finally {
    surface.destroy()
    texture.destroy(true)
    target.destroy(true)
    arena.destroy()
    app.destroy(true, { children: true })
  }
}

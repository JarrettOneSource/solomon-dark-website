import { Application, BufferImageSource, MeshSimple, RenderTexture, Sprite, Texture } from 'pixi.js'
import { installNativeFixedFunctionRenderPipeline } from '../src/game/renderer/native-fixed-function-render-pipeline.ts'
import { installNativeArenaRenderPipeline } from '../src/game/renderer/native-arena-render-pipeline.ts'

export async function inspectNativeMaterialLifetimes() {
  const app = new Application()
  await app.init({ autoStart: false, width: 16, height: 16, preference: 'webgl', resolution: 1 })
  const target = RenderTexture.create({ width: 16, height: 16, alphaMode: 'no-premultiply-alpha' })
  const textures = [false, true].map(premultiplied => new Texture({ source: new BufferImageSource({
    resource: new Uint8Array([128, 64, 192, 255]), width: 1, height: 1,
    alphaMode: premultiplied ? 'premultiplied-alpha' : 'no-premultiply-alpha', scaleMode: 'nearest',
  }) }))
  const meshAdaptor = app.renderer.renderPipes.mesh['_adaptor']
  const stockMesh = shaderLifetime(meshAdaptor['_shader'])
  installNativeFixedFunctionRenderPipeline(app.renderer)
  const listenerCount = app.renderer.runners.contextChange.items.length
  installNativeFixedFunctionRenderPipeline(app.renderer)
  const idempotent = listenerCount === app.renderer.runners.contextChange.items.length
  const fixedShaders = []
  const arenaShaders = []
  const pixels = []
  const geometries = []
  const batchLifetimes = []
  let arena
  let second
  try {
    draw('sprite', textures[0], 'fixed')
    const fixedBatch = batchLifetime(app.renderer)
    for (const texture of textures) {
      draw('mesh', texture, 'fixed')
      fixedShaders.push(shaderLifetime(meshAdaptor['_shader']))
    }
    arena = installNativeArenaRenderPipeline(app.renderer)
    const previousShadersPreserved = fixedShaders.every(row => row.shader.resources !== null)
    const graphicsShader = shaderLifetime(app.renderer.renderPipes.graphics['_adaptor'].shader)
    draw('sprite', textures[0], 'arena')
    batchLifetimes.push(destroyedBatch(fixedBatch))
    const arenaBatch = batchLifetime(app.renderer)
    for (const texture of textures) {
      draw('mesh', texture, 'arena')
      arenaShaders.push(shaderLifetime(meshAdaptor['_shader']))
    }
    arena.destroy()
    draw('sprite', textures[0], 'restored')
    draw('mesh', textures[0], 'restored')
    batchLifetimes.push(destroyedBatch(arenaBatch))
    const retiredArenaShaders = [...arenaShaders, graphicsShader].every(destroyedShader)
    second = installNativeArenaRenderPipeline(app.renderer)
    arena.destroy()
    draw('sprite', textures[0], 'second-arena')
    second.destroy()
    draw('sprite', textures[0], 'second-restored')
    const finalBatch = batchLifetime(app.renderer)
    target.destroy(true)
    app.destroy(true, { children: true })
    return {
      pixels, idempotent, previousShadersPreserved, retiredArenaShaders,
      replacedStockMesh: destroyedShader(stockMesh),
      fixedShadersDestroyed: fixedShaders.every(destroyedShader),
      batchLifetimes: [...batchLifetimes, destroyedBatch(finalBatch)],
      texturesAlive: textures.every(texture => !texture.destroyed),
    }
  } finally {
    second?.destroy()
    arena?.destroy()
    if (app.renderer) {
      target.destroy(true)
      app.destroy(true, { children: true })
    }
    for (const geometry of geometries) geometry.destroy(true)
    for (const texture of textures) texture.destroy(true)
  }

  function draw(kind, texture, phase) {
    for (const child of app.stage.removeChildren()) child.destroy()
    const display = kind === 'sprite'
      ? new Sprite({ texture, width: 16, height: 16 })
      : new MeshSimple({ texture, vertices: new Float32Array([0, 0, 16, 0, 16, 16, 0, 16]),
          indices: new Uint32Array([0, 1, 2, 0, 2, 3]), uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]) })
    if (kind === 'mesh') {
      display.geometry.batchMode = 'no-batch'
      geometries.push(display.geometry)
    }
    app.stage.addChild(display)
    app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 0] })
    const values = app.renderer.extract.pixels({ target }).pixels
    pixels.push({ phase, pixel: Array.from(values.slice((8 * 16 + 8) * 4, (8 * 16 + 8) * 4 + 4)) })
  }
}

function shaderLifetime(shader) {
  return { shader, program: shader.glProgram }
}

function destroyedShader({ shader, program }) {
  return shader.resources === null && program.vertex === null && program.fragment === null
}

function batchLifetime(renderer) {
  const batcher = Object.values(renderer.renderPipes.batch['_batchersByInstructionSet']).find(row => row.default.material).default
  return { ...shaderLifetime(batcher.shader), geometry: batcher.geometry, buffers: [...batcher.geometry.buffers] }
}

function destroyedBatch(resource) {
  return destroyedShader(resource) && resource.geometry.buffers === null && resource.buffers.every(buffer => buffer.destroyed)
}

import { Application, BufferImageSource, Container, MeshSimple, RenderTexture, Sprite, Texture } from 'pixi.js'
import { installNativeFixedFunctionRenderPipeline } from '../src/game/renderer/native-fixed-function-render-pipeline.ts'
import { installNativeArenaRenderPipeline } from '../src/game/renderer/native-arena-render-pipeline.ts'
import { NATIVE_TEXTURE_COLOR_UNIFORMS } from '../src/game/renderer/native-texture-color.ts'

export async function inspectNativeMaterialLifetimes(finishPremultiplied, installTextureAlphaShaders) {
  const app = new Application()
  await app.init({ autoStart: false, width: 16, height: 16, preference: 'webgl', resolution: 1 })
  const target = RenderTexture.create({ width: 16, height: 16, alphaMode: 'no-premultiply-alpha' })
  const textures = [false, true].map(premultiplied => new Texture({ source: new BufferImageSource({
    resource: new Uint8Array([128, 64, 192, 255]), width: 1, height: 1,
    alphaMode: premultiplied ? 'premultiplied-alpha' : 'no-premultiply-alpha', scaleMode: 'nearest',
  }) }))
  const meshAdaptor = app.renderer.renderPipes.mesh['_adaptor']
  const stockMesh = shaderLifetime(meshAdaptor['_shader'])
  installNativeFixedFunctionRenderPipeline(app.renderer, { installTextureAlphaShaders })
  const listenerCount = app.renderer.runners.contextChange.items.length
  installNativeFixedFunctionRenderPipeline(app.renderer, { installTextureAlphaShaders })
  const idempotent = listenerCount === app.renderer.runners.contextChange.items.length
  const fixedShaders = []
  const arenaShaders = []
  const pixels = []
  const geometries = []
  const batchLifetimes = []
  const shaderSystem = app.renderer.shader
  const updateUniformGroup = shaderSystem.updateUniformGroup
  let nativeUniformUpdates = 0
  shaderSystem.updateUniformGroup = function (group) {
    if (group === NATIVE_TEXTURE_COLOR_UNIFORMS) nativeUniformUpdates += 1
    return updateUniformGroup.call(this, group)
  }
  let arena
  let second
  try {
    draw('sprite', textures[0], 'fixed')
    const fixedBatch = installTextureAlphaShaders ? batchLifetime(app.renderer) : null
    for (const texture of textures) {
      draw('mesh', texture, 'fixed')
      fixedShaders.push(shaderLifetime(meshAdaptor['_shader']))
    }
    arena = installNativeArenaRenderPipeline(app.renderer)
    const previousShadersPreserved = fixedShaders.every(row => row.shader.resources !== null)
    const graphicsShader = shaderLifetime(app.renderer.renderPipes.graphics['_adaptor'].shader)
    draw('sprite', textures[0], 'arena')
    if (fixedBatch) batchLifetimes.push(destroyedBatch(fixedBatch))
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
    draw('mesh', textures[Number(finishPremultiplied)], 'second-restored')
    const finalBatch = installTextureAlphaShaders ? batchLifetime(app.renderer) : null
    target.destroy(true)
    app.destroy(true, { children: true })
    return {
      pixels, idempotent, previousShadersPreserved, retiredArenaShaders,
      replacedStockMesh: destroyedShader(stockMesh),
      fixedShadersDestroyed: fixedShaders.every(destroyedShader),
      batchLifetimes: finalBatch ? [...batchLifetimes, destroyedBatch(finalBatch)] : batchLifetimes,
      texturesAlive: textures.every(texture => !texture.destroyed),
    }
  } finally {
    shaderSystem.updateUniformGroup = updateUniformGroup
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
    const updatesBefore = nativeUniformUpdates
    app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 0] })
    const values = app.renderer.extract.pixels({ target }).pixels
    pixels.push({ phase, kind, nativeUniformUpdates: nativeUniformUpdates - updatesBefore,
      pixel: Array.from(values.slice((8 * 16 + 8) * 4, (8 * 16 + 8) * 4 + 4)) })
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
  return { batcher, ...shaderLifetime(batcher.shader), geometry: batcher.geometry, buffers: [...batcher.geometry.buffers] }
}

function destroyedBatch(resource) {
  const destroyed = destroyedShader(resource) && resource.geometry.buffers === null
    && resource.buffers.every(buffer => buffer.destroyed) && resource.batcher.shader === null
    && resource.batcher.geometry === null && resource.batcher.attributeBuffer === null && resource.batcher.indexBuffer === null
  if (destroyed) resource.batcher.destroy()
  return destroyed
}

export async function inspectRetainedMaterialChanges(installTextureAlphaShaders) {
  const app = new Application()
  await app.init({ autoStart: false, width: 16, height: 16, preference: 'webgl', resolution: 1 })
  installNativeFixedFunctionRenderPipeline(app.renderer, { installTextureAlphaShaders })
  const target = RenderTexture.create({ width: 16, height: 16, alphaMode: 'no-premultiply-alpha' })
  const texture = new Texture({ source: new BufferImageSource({
    resource: new Uint8Array([128, 64, 192, 255]), width: 1, height: 1, alphaMode: 'no-premultiply-alpha',
  }) })
  const direct = new Sprite({ texture, width: 16, height: 16 })
  const parent = new Container()
  parent.addChild(new Sprite({ texture, width: 16, height: 16 }))
  const inactive = new Sprite({ texture, width: 16, height: 16 })
  const roots = [direct, parent, inactive]
  const pixels = []
  let arena
  try {
    capture('before')
    const inactiveBatch = app.renderer.renderPipes.batch['_batchersByInstructionSet'][inactive.renderGroup.instructionSet.uid].default
    const inactiveGeometry = inactiveBatch.geometry
    const inactiveShader = inactiveBatch.shader
    arena = installNativeArenaRenderPipeline(app.renderer)
    capture('arena')
    arena.destroy()
    const preservedUnusedMaterial = inactiveBatch.geometry === inactiveGeometry && inactiveGeometry.buffers !== null
      && inactiveBatch.shader === inactiveShader && inactiveShader.resources !== null
    capture('after')
    return { pixels, preservedUnusedMaterial }
  } finally {
    for (const root of roots) root.destroy({ children: true })
    arena?.destroy()
    target.destroy(true)
    app.destroy(true, { children: true })
    texture.destroy(true)
  }

  function capture(phase) {
    for (const [root, container] of roots.entries()) {
      if (phase === 'arena' && container === inactive) continue
      app.renderer.render({ container, target, clear: true, clearColor: [0, 0, 0, 0] })
      const values = app.renderer.extract.pixels({ target }).pixels
      pixels.push({ phase, root, pixel: Array.from(values.slice((8 * 16 + 8) * 4, (8 * 16 + 8) * 4 + 4)) })
    }
  }
}

import { AlphaFilter, Application, BufferImageSource, Container, MeshSimple, RenderLayer, RenderTexture, Sprite, Texture } from 'pixi.js'
import { installNativeArenaRenderPipeline } from '../src/game/renderer/native-arena-render-pipeline.ts'
import { installNativeFixedFunctionRenderPipeline } from '../src/game/renderer/native-fixed-function-render-pipeline.ts'
import { restoreContext } from './native-render-material-probe.mjs'
import { setNativeVertexColors } from '../src/game/renderer/native-material-batch.ts'
import { setNativeDiffuseColor } from '../src/game/renderer/native-texture-color.ts'

function comparePixels(before, after) {
  let changedPixels = 0
  let changedChannels = 0
  let maximumDelta = 0
  for (let offset = 0; offset < before.length; offset += 4) {
    let changed = false
    for (let channel = 0; channel < 4; channel++) {
      const delta = Math.abs(before[offset + channel] - after[offset + channel])
      if (!delta) continue
      changed = true
      changedChannels++
      maximumDelta = Math.max(maximumDelta, delta)
    }
    changedPixels += Number(changed)
  }
  return { changedPixels, changedChannels, maximumDelta }
}

function capture(app, target) {
  const gl = app.renderer.gl
  const original = gl.drawElements
  let draws = 0
  let indices = 0
  gl.drawElements = function (...args) {
    draws++
    indices += args[1]
    return original.apply(this, args)
  }
  const pixels = new Uint8Array(96 * 64 * 4)
  try {
    app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0.08, 0.12, 0.18, target ? 0.2 : 1] })
    gl.readPixels(0, 0, 96, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  } finally { gl.drawElements = original }
  return { pixels, draws, indices }
}

export async function inspectNativeOpaqueBatches() {
  const app = new Application()
  await app.init({ antialias: false, autoStart: false, backgroundAlpha: 1,
    height: 64, width: 96, resolution: 1, preference: 'webgl', preferWebGLVersion: 2 })
  installNativeFixedFunctionRenderPipeline(app.renderer, { installTextureAlphaShaders: false })
  const root = new Container({ isRenderGroup: true })
  app.stage.addChild(root)
  const textures = [
    [[212, 87, 43, 127], false], [[35, 156, 219, 173], false],
    [[99, 54, 22, 127], true], [[23, 98, 146, 173], true],
  ].map(([rgba, premultiplied]) => new Texture({ source: new BufferImageSource({
    resource: new Uint8Array(rgba), height: 1, width: 1, scaleMode: 'nearest',
    alphaMode: premultiplied ? 'premultiplied-alpha' : 'no-premultiply-alpha',
  }) }))
  for (let index = 0; index < 8; index++) root.addChild(new Sprite({
    texture: textures[index % textures.length], width: 53, height: 41,
    x: index * 5 % 29, y: index * 3 % 19,
    alpha: 0.2 + index / 12, blendMode: index % 2 ? 'add' : 'normal',
  }))
  const target = RenderTexture.create({ width: 96, height: 64, alphaMode: 'no-premultiply-alpha' })
  let pipeline = installNativeArenaRenderPipeline(app.renderer)
  const sequence = () => {
    root.children[2].alpha = 0.4
    root.children[3].tint = 0xffffff
    const first = capture(app)
    root.children[2].alpha = 0.23
    root.children[3].tint = 0x97c5e3
    return { first, updated: capture(app), target: capture(app, target), roundTrip: capture(app) }
  }
  try {
    const baseline = sequence()
    pipeline.destroy()
    pipeline = installNativeArenaRenderPipeline(app.renderer, root)
    const candidate = sequence()
    return Object.fromEntries(Object.keys(baseline).map(name => [name, {
      baselineDraws: baseline[name].draws, candidateDraws: candidate[name].draws,
      baselineIndices: baseline[name].indices, candidateIndices: candidate[name].indices,
      ...comparePixels(baseline[name].pixels, candidate[name].pixels),
    }]))
  } finally {
    pipeline.destroy()
    target.destroy(true)
    app.destroy(true, { children: true })
    for (const texture of textures) texture.destroy(true)
  }
}

function addMixedSprites(root, textures) {
  for (let i = 0; i < 12; i++) root.addChild(new Sprite({
    texture: textures[i % textures.length], width: 47, height: 35,
    x: i * 7 % 39, y: i * 3 % 25, alpha: 0.18 + i / 20,
    blendMode: ['normal', 'add', 'normal-npm', 'add-npm'][i % 4],
  }))
}

function applyBoundary(role, app, root, texture) {
  const subject = role.startsWith('ancestor-') ? root.parent
    : role.startsWith('child-') ? root.children[0] : root
  if (role.endsWith('-filter')) {
    const filter = new AlphaFilter({ alpha: 0.63 })
    subject.filters = [filter]
    return () => { subject.filters = []; filter.destroy() }
  }
  if (role.endsWith('-cache')) {
    const wasRenderGroup = subject.isRenderGroup
    subject.cacheAsTexture({ antialias: false, resolution: 1 })
    return () => {
      subject.cacheAsTexture(false)
      if (wasRenderGroup) subject.enableRenderGroup()
    }
  }
  const mask = new Sprite({ texture, width: 73, height: 51, alpha: 0.59 })
  app.stage.addChild(mask)
  subject.mask = mask
  return () => { subject.mask = null; mask.destroy() }
}

export async function inspectNativeOpaqueBoundaries() {
  const rows = []
  for (const role of ['root-filter', 'ancestor-filter', 'child-filter',
    'root-cache', 'ancestor-cache', 'child-cache', 'root-mask', 'child-mask', 'transparent', 'context',
    'no-group', 'outside-root', 'foreign-layer']) {
    const app = new Application()
    await app.init({ antialias: false, autoStart: false, backgroundAlpha: role === 'transparent' ? 0 : 1,
      height: 64, width: 96, resolution: 1, preference: 'webgl', preferWebGLVersion: 2 })
    installNativeFixedFunctionRenderPipeline(app.renderer, { installTextureAlphaShaders: false })
    const parent = new Container({ isRenderGroup: true })
    const root = new Container({ isRenderGroup: role !== 'no-group' })
    const child = new Container({ isRenderGroup: role === 'child-cache' })
    app.stage.addChild(parent)
    parent.addChild(root)
    root.addChild(child)
    const textures = [[230, 66, 89, 131], [74, 92, 173, 197]].map(pixel => new Texture({
      source: new BufferImageSource({ resource: new Uint8Array(pixel), height: 1, width: 1,
        alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest' }),
    }))
    addMixedSprites(child, textures)
    if (role === 'foreign-layer') {
      app.stage.addChild(child)
      const layer = new RenderLayer()
      root.addChild(layer)
      layer.attach(...child.children)
    }
    const requestedRoot = role === 'outside-root' ? new Container() : root
    let pipeline = installNativeArenaRenderPipeline(app.renderer)
    const sequence = async () => {
      const initial = capture(app)
      let clear = () => {}
      if (role === 'context') await restoreContext(app)
      else if (!['transparent', 'no-group', 'outside-root', 'foreign-layer'].includes(role)) {
        clear = applyBoundary(role, app, root, textures[0])
      }
      const changed = capture(app)
      const retained = capture(app)
      clear()
      return { initial, changed, retained, recovered: capture(app) }
    }
    try {
      const baseline = await sequence()
      pipeline.destroy()
      pipeline = installNativeArenaRenderPipeline(app.renderer, requestedRoot)
      const candidate = await sequence()
      for (const name of Object.keys(baseline)) rows.push({
        role, phase: name, baselineDraws: baseline[name].draws, candidateDraws: candidate[name].draws,
        baselineIndices: baseline[name].indices, candidateIndices: candidate[name].indices,
        ...comparePixels(baseline[name].pixels, candidate[name].pixels),
      })
    } finally {
      pipeline.destroy()
      app.destroy(true, { children: true })
      if (requestedRoot !== root) requestedRoot.destroy()
      for (const texture of textures) texture.destroy(true)
    }
  }
  return rows
}

export async function inspectNativeOpaqueTransport() {
  const rows = []
  for (const role of ['texture-capacity', 'gradient', 'diffuse', 'multiply', 'explicit-npm-pma', 'topology', 'mixed-topology', 'empty']) {
    const app = new Application()
    await app.init({ antialias: false, autoStart: false, backgroundAlpha: 1,
      height: 64, width: 96, resolution: 1, preference: 'webgl', preferWebGLVersion: 2 })
    installNativeFixedFunctionRenderPipeline(app.renderer, { installTextureAlphaShaders: false })
    const root = new Container({ isRenderGroup: true })
    app.stage.addChild(root)
    const textures = []
    const meshes = []
    const count = role === 'texture-capacity' ? 40 : role === 'empty' ? 0 : 8
    for (let i = 0; i < count; i++) {
      const pma = role === 'explicit-npm-pma' || i % 2 === 1
      const texture = new Texture({ source: new BufferImageSource({
        resource: new Uint8Array(pma ? [88, 37, 60, 120] : [187, 79, 128, 120]),
        alphaMode: pma ? 'premultiplied-alpha' : 'no-premultiply-alpha', width: 1, height: 1,
        scaleMode: 'nearest',
      }) })
      textures.push(texture)
      let drawable
      if (role === 'gradient' || role === 'topology' || role === 'mixed-topology') {
        const strip = role === 'topology' || role === 'mixed-topology' && i % 2 === 1
        drawable = new MeshSimple({ texture,
          vertices: new Float32Array([0, 0, 49, 0, 49, 39, 0, 39]),
          uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
          indices: new Uint32Array(strip ? [0, 1, 3, 2] : [0, 1, 2, 0, 2, 3]),
        })
        if (strip) drawable.geometry.topology = 'triangle-strip'
        if (role === 'gradient') setNativeVertexColors(drawable, new Uint32Array([0x1800ffff, 0x1800ffff, 0xc0ff1800, 0xc0ff1800]))
        meshes.push(drawable)
      } else drawable = new Sprite({ texture, width: 49, height: 39 })
      drawable.position.set(i * 5 % 41, i * 3 % 23)
      drawable.alpha = 0.31 + i % 4 * 0.17
      drawable.blendMode = i % 2 ? 'add' : 'normal'
      if (role === 'mixed-topology') drawable.blendMode = 'multiply'
      if (role === 'explicit-npm-pma') drawable.blendMode += '-npm'
      if (role === 'multiply' && i % 3 === 1) drawable.blendMode = 'multiply'
      if (role === 'diffuse') setNativeDiffuseColor(drawable, i % 3 !== 0)
      root.addChild(drawable)
    }
    let pipeline = installNativeArenaRenderPipeline(app.renderer)
    try {
      const baseline = capture(app)
      pipeline.destroy()
      pipeline = installNativeArenaRenderPipeline(app.renderer, root)
      const candidate = capture(app)
      rows.push({ role, baselineDraws: baseline.draws, candidateDraws: candidate.draws,
        baselineIndices: baseline.indices, candidateIndices: candidate.indices,
        maxTextures: app.renderer.limits.maxBatchableTextures,
        ...comparePixels(baseline.pixels, candidate.pixels) })
    } finally {
      pipeline.destroy()
      for (const mesh of meshes) mesh.geometry.destroy(true)
      app.destroy(true, { children: true })
      for (const texture of textures) texture.destroy(true)
    }
  }
  return rows
}

function rootBatcher(app, root) {
  return app.renderer.renderPipes.batch['_batchersByInstructionSet'][root.renderGroup.instructionSet.uid].default
}

/** Rebuild with changed sources, then reorder and retire drawables using ordinary scene APIs. */
export async function inspectNativeOpaqueRebuilds() {
  const app = new Application()
  await app.init({ antialias: false, autoStart: false, backgroundAlpha: 1,
    height: 64, width: 96, resolution: 1, preference: 'webgl', preferWebGLVersion: 2 })
  installNativeFixedFunctionRenderPipeline(app.renderer, { installTextureAlphaShaders: false })
  const root = new Container({ isRenderGroup: true })
  app.stage.addChild(root)
  const limit = app.renderer.limits.maxBatchableTextures
  const textures = Array.from({ length: limit * 2 }, (_, index) => new Texture({
    source: new BufferImageSource({ width: 1, height: 1, scaleMode: 'nearest',
      alphaMode: 'premultiplied-alpha',
      resource: new Uint8Array([30 + index * 3 % 83, 40 + index * 7 % 79, 20 + index * 11 % 91, 160]),
    }),
  }))
  let pipeline = installNativeArenaRenderPipeline(app.renderer)
  const record = () => {
    const frame = capture(app)
    const batcher = rootBatcher(app, root)
    const batches = batcher.batches.slice(0, batcher.batchIndex)
    const members = batches.flatMap(batch => batch.elements.map(element => element.renderable))
    return { ...frame, maximumTextures: Math.max(...batches.map(batch => batch.textures.count)),
      expectedTextures: new Set(root.children.map(child => child.texture.source)).size,
      memberCount: members.length, onlyLiveMembers: members.every(member => root.children.includes(member)) }
  }
  const sequence = () => {
    for (const child of root.removeChildren()) child.destroy()
    for (let index = 0; index < limit * 2; index++) root.addChild(new Sprite({
      texture: textures[index % limit], width: 43, height: 37,
      x: index * 7 % 47, y: index * 5 % 29, alpha: 0.72,
      blendMode: index % 2 ? 'add' : 'normal',
    }))
    const fullAndReused = record()
    for (const [index, child] of root.children.entries()) {
      child.texture = textures[limit + index % limit]
      child.x += 1
    }
    const replaced = record()
    root.swapChildren(root.children[0], root.children.at(-1))
    const reordered = record()
    for (const child of root.removeChildren(limit)) child.destroy()
    return { fullAndReused, replaced, reordered, retired: record() }
  }
  try {
    const baseline = sequence()
    pipeline.destroy()
    pipeline = installNativeArenaRenderPipeline(app.renderer, root)
    const candidate = sequence()
    return Object.fromEntries(Object.keys(baseline).map(phase => [phase, {
      baselineDraws: baseline[phase].draws, candidateDraws: candidate[phase].draws,
      baselineIndices: baseline[phase].indices, candidateIndices: candidate[phase].indices,
      memberCount: candidate[phase].memberCount, onlyLiveMembers: candidate[phase].onlyLiveMembers,
      maximumTextures: candidate[phase].maximumTextures, expectedTextures: candidate[phase].expectedTextures, limit,
      ...comparePixels(baseline[phase].pixels, candidate[phase].pixels),
    }]))
  } finally {
    pipeline.destroy()
    app.destroy(true, { children: true })
    for (const texture of textures) texture.destroy(true)
  }
}

/** Foreign draws keep their own eligibility, and unrelated renders must not invalidate this root. */
export async function inspectNativeOpaqueInstructionOwnership() {
  const app = new Application()
  await app.init({ antialias: false, autoStart: false, backgroundAlpha: 1,
    height: 64, width: 96, resolution: 1, preference: 'webgl', preferWebGLVersion: 2 })
  installNativeFixedFunctionRenderPipeline(app.renderer, { installTextureAlphaShaders: false })
  const root = new Container({ isRenderGroup: true })
  const foreign = new Container()
  const unrelated = new Container()
  app.stage.addChild(root, foreign)
  const texture = new Texture({ source: new BufferImageSource({ width: 1, height: 1,
    alphaMode: 'premultiplied-alpha', resource: new Uint8Array([110, 50, 90, 160]),
  }) })
  const makeSprite = (x, blendMode) => new Sprite({ texture, x, y: 5, width: 51, height: 41, alpha: 0.63, blendMode })
  root.addChild(makeSprite(2, 'normal'))
  const layer = new RenderLayer()
  root.addChild(layer)
  const outsider = foreign.addChild(makeSprite(13, 'normal'))
  layer.attach(outsider)
  root.addChild(makeSprite(24, 'add'))
  const target = RenderTexture.create({ width: 96, height: 64, alphaMode: 'no-premultiply-alpha' })
  const original = installNativeArenaRenderPipeline(app.renderer)
  let replacement
  try {
    const baseline = capture(app)
    const originalBatcher = rootBatcher(app, root)
    // Reinstall the same material without removing it first: the old ordinary batcher cannot own this new pass.
    replacement = installNativeArenaRenderPipeline(app.renderer, root)
    const candidate = capture(app)
    const batcher = rootBatcher(app, root)
    const eligibility = batcher.batches.slice(0, batcher.batchIndex).map(batch => batch.opaque)
    let rebuilds = 0
    const begin = batcher.begin
    batcher.begin = function (...args) { rebuilds++; return begin.apply(this, args) }
    try {
      const retained = capture(app)
      app.renderer.render({ container: unrelated, target, clear: true })
      const afterUnrelated = capture(app)
      return { baselineDraws: baseline.draws, candidateDraws: candidate.draws,
        baselineIndices: baseline.indices, candidateIndices: candidate.indices, eligibility, rebuilds,
        originalRetired: originalBatcher.geometry === null && originalBatcher.shader === null,
        retained: comparePixels(candidate.pixels, retained.pixels),
        afterUnrelated: comparePixels(candidate.pixels, afterUnrelated.pixels),
        ...comparePixels(baseline.pixels, candidate.pixels) }
    } finally { batcher.begin = begin }
  } finally {
    replacement?.destroy()
    original.destroy()
    target.destroy(true)
    unrelated.destroy()
    app.destroy(true, { children: true })
    texture.destroy(true)
  }
}

export async function inspectNativeOpaqueRetirement() {
  const app = new Application()
  await app.init({ antialias: false, autoStart: false, backgroundAlpha: 1,
    height: 64, width: 96, resolution: 1, preference: 'webgl', preferWebGLVersion: 2 })
  installNativeFixedFunctionRenderPipeline(app.renderer, { installTextureAlphaShaders: false })
  const root = new Container({ isRenderGroup: true })
  app.stage.addChild(root)
  const texture = new Texture({ source: new BufferImageSource({ width: 1, height: 1,
    alphaMode: 'no-premultiply-alpha', resource: new Uint8Array([120, 50, 90, 160]),
  }) })
  addMixedSprites(root, [texture])
  const pipeline = installNativeArenaRenderPipeline(app.renderer, root)
  try {
    const active = capture(app)
    const batcher = app.renderer.renderPipes.batch['_batchersByInstructionSet'][root.renderGroup.instructionSet.uid].default
    const pass = batcher.pass
    root.destroy({ children: true })
    const afterRoot = capture(app)
    pipeline.destroy()
    batcher.destroy()
    pipeline.destroy()
    const afterRetirement = capture(app)
    return { activeDraws: active.draws, afterRootDraws: afterRoot.draws, afterRetirementDraws: afterRetirement.draws,
      textureAlive: !texture.destroyed && !texture.source.destroyed,
      batcherRetired: batcher.batches === null && batcher.geometry === null && batcher.shader === null,
      hookRemoved: !app.renderer.runners.prerender.items.includes(pass),
      ...comparePixels(afterRoot.pixels, afterRetirement.pixels) }
  } finally {
    pipeline.destroy()
    app.destroy(true, { children: true })
    texture.destroy(true)
  }
}

import {
  Application, BufferImageSource, Container, ImageSource, MeshSimple, NineSliceSprite, Rectangle,
  RenderTexture, Sprite, Texture,
} from 'pixi.js'
import {
  createNativeTexturedVertexMeshShader, installNativeFixedFunctionRenderPipeline,
  nativeStockFramedTextureFromImage, nativeStockTextureFromImage,
} from '../src/game/renderer/native-fixed-function-render-pipeline.ts'
import { installNativeArenaRenderPipeline } from '../src/game/renderer/native-arena-render-pipeline.ts'
import { createNativeSurfaceMesh } from '../src/game/renderer/boneyard-building-surface-view.ts'
import { nativeSpriteRecordTexture, nativeSpriteRecordTrimmedTexture } from '../src/game/renderer/native-sprite-record-texture.ts'
import { setNativeVertexColors } from '../src/game/renderer/native-material-batch.ts'
import { WeldDrawingResources } from '../src/game/renderer/primary-spell-weld-drawing.ts'
import { NativeWaterMeshRuns } from '../src/game/renderer/primary-spell-water-mesh-runs.ts'
import { waterFrostJetKind } from '../src/game/core-kernels/primary-spell-water.ts'
import { restoreContext } from './native-render-material-probe.mjs'
import golemAtlas from '../src/assets/game/boneyard-combat-atlas-3.png'
import golem9 from '../src/assets/game/boneyard/golem/009.png'
import golem61 from '../src/assets/game/boneyard/golem/061.png'
import golem199 from '../src/assets/game/boneyard/golem/199.png'
import badguysAtlas from '../src/assets/game/boneyard-combat-atlas-0.png'
import flame25 from '../src/assets/game/boneyard/badguys/0025.png'
import enchant0 from '../src/assets/game/player-enchant-staff-aura-0.png'
import enchant1 from '../src/assets/game/player-enchant-staff-aura-1.png'
import hagathaGlow from '../src/assets/game/hub-hagatha-ground-glow.png'
import luthacusShadow from '../src/assets/game/hub-luthacus-ground-shadow.png'
import actorShadow from '../src/assets/game/actor-shadow.png'
import actorShadow67 from '../src/assets/game/boneyard/badguys/0067.png'
import flydirt from '../src/assets/game/solomon-flydirt.png'
import { loadModPresentationTextures } from '../src/game/renderer/mod-presentation-assets.ts'
import { createHubVisualAtlas, HUB_VISUAL_ATLAS_SOURCES } from '../src/game/renderer/hub-visual-atlas.ts'
import paintings from '../src/assets/game/hub-room-mortuary-paintings.png'
import { loadHubWorldTextures, destroyHubWorldTextureFrames } from '../src/game/renderer/hub-textures.ts'
import { loadBoneyardWorldTextures, destroyBoneyardWorldTextures } from '../src/game/renderer/boneyard-textures.ts'

const RECORDS = [
  { record: 9, frame: [146, 265, 31, 45], crop: golem9 },
  { record: 61, frame: [97, 105, 49, 45], crop: golem61 },
  { record: 199, frame: [353, 149, 28, 32], crop: golem199 },
]
const SIZE = 256
const FULL_UV = [0, 0, 1, 1]

// The reference owns an independent image and the recovered native endpoints.
// It deliberately does not call the product record-texture constructor.
function croppedReference(source, width, height, sourceUv = FULL_UV, trim) {
  const [left, top, right, bottom] = sourceUv
  const texture = new Texture({
    source,
    frame: new Rectangle(width * left, height * top, width * (right - left), height * (bottom - top)),
    ...(trim ? { orig: new Rectangle(0, 0, width, height), trim } : {}),
  })
  const u = amount => (.5 + amount * (width - .25)) / width
  const v = amount => (.5 + amount * (height - .25)) / height
  Object.assign(texture.uvs, {
    x0: u(left), y0: v(top), x1: u(right), y1: v(top),
    x2: u(right), y2: v(bottom), x3: u(left), y3: v(bottom),
  })
  // Pixi's full-source fast path assumes identity UVs, unlike this native reference.
  texture.textureMatrix.isSimple = false
  return texture
}

function makeDrawable(texture, kind) {
  const width = texture.orig.width
  const height = texture.orig.height
  if (kind === 'sprite') return { view: new Sprite(texture), destroy() { this.view.destroy() } }
  if (kind === 'nine-slice') {
    const view = new NineSliceSprite({ texture, leftWidth: 3, rightWidth: 3, topHeight: 3, bottomHeight: 3,
      width: width * 1.2, height: height * 1.1 })
    return { view, destroy() { view.destroy() } }
  }
  const geometry = {
    positions: new Float32Array([0, 0, width, 0, width, height, 0, height]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  }
  if (kind === 'surface') {
    const surface = createNativeSurfaceMesh(texture, { ...geometry, colors: new Uint8Array(16).fill(255) })
    return { view: surface.mesh, destroy: () => surface.destroy() }
  }
  const mesh = new MeshSimple({ texture, vertices: geometry.positions, uvs: geometry.uvs, indices: geometry.indices })
  mesh.geometry.batchMode = kind === 'batched-mesh' ? 'batch' : 'no-batch'
  if (kind === 'capture-mesh') {
    setNativeVertexColors(mesh, new Uint32Array(4).fill(0xffffffff))
    mesh.shader = createNativeTexturedVertexMeshShader(texture)
  }
  return { view: mesh, destroy() { mesh.shader?.destroy(); mesh.geometry.destroy(true); mesh.destroy() } }
}

function render(app, target, drawable, scale, rotation) {
  const view = drawable.view
  view.position.set(48.375, 40.625)
  view.scale.set(scale)
  view.rotation = rotation
  app.stage.addChild(view)
  app.renderer.render({ container: app.stage, target, clear: true, clearColor: [.2, .15, .1, 0] })
  const pixels = app.renderer.extract.pixels({ target }).pixels.slice()
  view.removeFromParent()
  return pixels
}

function compare(left, right) {
  let maximumDelta = 0
  let changedChannels = 0
  let maximumAlphaDelta = 0
  let visiblePixels = 0
  for (let index = 0; index < left.length; index += 1) {
    const delta = Math.abs(left[index] - right[index])
    maximumDelta = Math.max(maximumDelta, delta)
    if (index % 4 === 3) {
      maximumAlphaDelta = Math.max(maximumAlphaDelta, delta)
      if (right[index] > 0) visiblePixels += 1
    }
    if (delta > 2) changedChannels += 1
  }
  return { maximumDelta, maximumAlphaDelta, changedChannels, visiblePixels }
}

async function load(source) {
  const image = new Image()
  image.src = source
  await image.decode()
  return image
}

export async function inspectNativeRecordSampling() {
  const page = nativeStockTextureFromImage(await load(golemAtlas))
  const crops = await Promise.all(RECORDS.map(async row => nativeStockFramedTextureFromImage(await load(row.crop))))
  const rows = []
  const batching = []
  const controls = []
  const backends = []
  try {
    for (const mode of ['fixed', 'arena']) {
      const app = new Application()
      await app.init({ antialias: false, autoStart: false, width: SIZE, height: SIZE,
        preference: 'webgl', resolution: 1, backgroundAlpha: 0 })
      const gl = app.renderer.gl
      const debug = gl.getExtension('WEBGL_debug_renderer_info')
      backends.push({ mode, renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) })
      installNativeFixedFunctionRenderPipeline(app.renderer)
      const arena = mode === 'arena' ? installNativeArenaRenderPipeline(app.renderer) : null
      const target = RenderTexture.create({ alphaMode: 'no-premultiply-alpha', width: SIZE, height: SIZE })
      try {
        for (let index = 0; index < RECORDS.length; index += 1) {
          const { record, frame } = RECORDS[index]
          const [x, y, width, height] = frame
          for (const kind of ['sprite', 'batched-mesh', 'standalone-mesh', 'capture-mesh', 'nine-slice', 'surface']) {
            for (const sourceUv of [FULL_UV, [.125, .125, 1, 1]]) {
              const actual = nativeSpriteRecordTexture({ source: page.source, frame: new Rectangle(x, y, width, height), sourceUv })
              const reference = croppedReference(crops[index].source, width, height, sourceUv)
              const candidate = makeDrawable(actual, kind)
              const control = makeDrawable(reference, kind)
              try {
                for (const [scale, rotation] of [[1.111, 0], [3.5, .125]]) {
                  rows.push({ mode, kind, record, sourceUv, scale, rotation,
                    ...compare(render(app, target, candidate, scale, rotation), render(app, target, control, scale, rotation)) })
                }
              } finally {
                candidate.destroy(); control.destroy(); actual.destroy(false); reference.destroy(false)
              }
            }
          }
        }
        // Trim/slices retain full record ownership through both mesh dispatches.
        const [x, y, width, height] = RECORDS[0].frame
        const whole = nativeSpriteRecordTexture({ source: page.source, frame: new Rectangle(x, y, width, height) })
        const trim = { x: 2, y: 3, width: width - 2, height: height - 3 }
        const trimmed = nativeSpriteRecordTrimmedTexture(whole, trim)
        const trimControl = croppedReference(crops[0].source, width, height,
          [trim.x / width, trim.y / height, 1, 1], new Rectangle(trim.x, trim.y, trim.width, trim.height))
        try {
          for (const kind of ['sprite', 'batched-mesh', 'standalone-mesh']) {
            const candidate = makeDrawable(trimmed, kind)
            const control = makeDrawable(trimControl, kind)
            try {
              controls.push({ mode, role: 'alpha-trim', kind,
                ...compare(render(app, target, candidate, 3.5, .125), render(app, target, control, 3.5, .125)) })
            } finally { candidate.destroy(); control.destroy() }
          }
          const candidate = makeDrawable(whole, 'sprite')
          const before = render(app, target, candidate, 3.5, .125)
          page.source.update(); whole.update()
          controls.push({ mode, role: 'source-update', ...compare(render(app, target, candidate, 3.5, .125), before) })
          await restoreContext(app)
          controls.push({ mode, role: 'context-restoration', ...compare(render(app, target, candidate, 3.5, .125), before) })
          candidate.destroy()
        } finally { whole.destroy(false); trimmed.destroy(false); trimControl.destroy(false) }
        controls.push(...await flameSamples(app, target, mode))
        controls.push(...repeatSamples(app, target, mode))
        controls.push(...sourceRetirementSamples(app, target, mode))
        if (mode === 'arena') controls.push(waterSample(app, target))
        const textures = RECORDS.map(({ frame }) => nativeSpriteRecordTexture({ source: page.source, frame: new Rectangle(...frame) }))
        const root = new Container()
        for (let index = 0; index < 12; index += 1) {
          const sprite = new Sprite(textures[index % textures.length])
          sprite.position.set(index % 4 * 60, Math.floor(index / 4) * 60)
          root.addChild(sprite)
        }
        app.stage.addChild(root)
        const gl = app.renderer.gl
        const original = gl.drawElements
        let draws = 0
        gl.drawElements = function (...args) { draws += 1; return original.apply(this, args) }
        try {
          app.renderer.render({ container: app.stage, target, clear: true })
          batching.push({ mode, records: textures.length, sprites: root.children.length, draws })
        } finally {
          gl.drawElements = original
          root.destroy({ children: true })
          textures.forEach(texture => texture.destroy(false))
        }
      } finally {
        target.destroy(true); arena?.destroy(); app.destroy(true, { children: true })
      }
    }
  } finally {
    page.destroy(true); crops.forEach(texture => texture.destroy(true))
  }
  return { rows, batching, controls, backends }
}

async function flameSamples(app, target, mode) {
  const page = nativeStockTextureFromImage(await load(badguysAtlas))
  const crop = nativeStockFramedTextureFromImage(await load(flame25))
  const record = nativeSpriteRecordTexture({ source: page.source, frame: new Rectangle(1760, 1492, 19, 20) })
  const resources = new WeldDrawingResources()
  const absolute = resources.atlasPage(record)
  const reference = croppedReference(crop.source, 19, 20)
  const rows = []
  try {
    for (const kind of ['batched-mesh', 'standalone-mesh']) {
      const candidate = makeDrawable(reference, kind)
      candidate.view.texture = absolute
      candidate.view.geometry.getBuffer('aUV').data.set([
        record.uvs.x0, record.uvs.y0, record.uvs.x1, record.uvs.y1,
        record.uvs.x2, record.uvs.y2, record.uvs.x3, record.uvs.y3,
      ])
      candidate.view.geometry.getBuffer('aUV').update()
      const control = makeDrawable(reference, kind)
      try {
        rows.push({ mode, role: 'flame-absolute-uv', kind,
          ...compare(render(app, target, candidate, 7.5, .125), render(app, target, control, 7.5, .125)) })
      } finally { candidate.destroy(); control.destroy() }
    }
  } finally {
    resources.destroy(); record.destroy(false); reference.destroy(false); page.destroy(true); crop.destroy(true)
  }
  return rows
}

function repeatSamples(app, target, mode) {
  const texture = new Texture({ source: new BufferImageSource({ width: 2, height: 2,
    addressMode: 'repeat', alphaMode: 'no-premultiply-alpha', scaleMode: 'linear',
    resource: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]) }) })
  const rows = []
  try {
    for (const kind of ['batched-mesh', 'standalone-mesh', 'surface']) {
      const candidate = makeDrawable(texture, kind)
      const buffer = candidate.view.geometry.getBuffer('aUV')
      buffer.data.set([0, 0, 3, 0, 3, 3, 0, 3]); buffer.update()
      const control = new Container()
      const tiles = []
      for (let y = 0; y < 3; y += 1) for (let x = 0; x < 3; x += 1) {
        const tile = makeDrawable(texture, kind)
        tile.view.scale.set(1 / 3)
        tile.view.position.set(x * 2 / 3, y * 2 / 3)
        control.addChild(tile.view); tiles.push(tile)
      }
      try {
        rows.push({ mode, role: 'whole-page-repeat', kind,
          ...compare(render(app, target, candidate, 72, 0), render(app, target, { view: control }, 72, 0)) })
      } finally { candidate.destroy(); tiles.forEach(tile => tile.destroy()); control.destroy() }
    }
  } finally { texture.destroy(true) }
  return rows
}

function waterSample(app, target) {
  const frames = { core: [4, 4, 93, 145], aura: [120, 4, 63, 63], glint: [120, 100, 10, 8], hail: [150, 100, 19, 20] }
  const colors = { core: [30, 120, 255, 220], aura: [20, 180, 130, 200], glint: [180, 90, 20, 240], hail: [40, 80, 180, 255] }
  const makeTextures = reference => {
    const pixels = new Uint8Array(256 * 256 * 4)
    for (let offset = 0; offset < pixels.length; offset += 4) pixels.set([255, 0, 255, 255], offset)
    // Independent reference extends each constant-color crop by two texels.
    // No product record metadata is attached to that page's Texture views.
    const padding = reference ? 2 : 0
    for (const [key, [x, y, width, height]] of Object.entries(frames)) {
      for (let row = y - padding; row < y + height + padding; row += 1) {
        for (let column = x - padding; column < x + width + padding; column += 1) {
          pixels.set(colors[key], (row * 256 + column) * 4)
        }
      }
    }
    const source = new BufferImageSource({ width: 256, height: 256, resource: pixels,
      addressMode: 'repeat', alphaMode: 'no-premultiply-alpha', scaleMode: 'linear' })
    return Object.fromEntries(Object.entries(frames).map(([key, [x, y, width, height]]) => {
      const texture = reference ? new Texture({ source, frame: new Rectangle(x, y, width, height) })
        : nativeSpriteRecordTexture({ source, frame: new Rectangle(x, y, width, height) })
      if (reference) Object.assign(texture.uvs, {
        x0: (x + .5) / 256, y0: (y + .5) / 256, x1: (x + width + .25) / 256, y1: (y + .5) / 256,
        x2: (x + width + .25) / 256, y2: (y + height + .25) / 256, x3: (x + .5) / 256, y3: (y + height + .25) / 256,
      })
      return [key, texture]
    }))
  }
  const build = textures => {
    const root = new Container()
    const runs = new NativeWaterMeshRuns(root, textures)
    let frostId = 10
    while (waterFrostJetKind(frostId) !== 'normal') frostId += 1
    const registration = (id, managerLane) => [{ registrationOrdinal: id, managerLane }]
    const states = [
      { id: 1, kind: 'water-hail', painterRegistrations: registration(1, 'actor'),
        position: { x: 45, y: 40 }, height: -5, life: .75, scale: 2.5, rotationDegrees: 7 },
      { id: 2, kind: 'water-aura', painterRegistrations: registration(2, 'actor'),
        origin: { x: 115, y: 45 }, ageTicks: 5, alphaDecay: .00625, initialRotationDegrees: 13, rotationStepDegrees: 0 },
      { id: frostId, kind: 'water', painterRegistrations: registration(frostId, 'transient'),
        origin: { x: 80, y: 130 }, direction: { x: 1, y: 0 }, ageTicks: 1,
        speed: 4, underpowered: false, obstructionDistance: null, obstructionPoint: null, variant: 0 },
    ]
    runs.beginFrame(); states.forEach(state => runs.update(state)); runs.endFrame()
    runs.beginDepths(); states.forEach((state, index) => runs.appendDepth(state.id, index)); runs.commitDepths()
    return { view: root, runs, destroy() { runs.destroy(); root.destroy() } }
  }
  const actualTextures = makeTextures(false)
  const referenceTextures = makeTextures(true)
  const candidate = build(actualTextures)
  const control = build(referenceTextures)
  try {
    return { mode: 'arena', role: 'mixed-water-records', runs: candidate.runs.runCount,
      ...compare(render(app, target, candidate, 1.111, .125), render(app, target, control, 1.111, .125)) }
  } finally {
    candidate.destroy(); control.destroy()
    for (const textures of [actualTextures, referenceTextures]) {
      const source = textures.core.source
      Object.values(textures).forEach(texture => texture.destroy(false))
      source.destroy()
    }
  }
}

function sourceRetirementSamples(app, target, mode) {
  const rows = []
  for (const alphaMode of ['no-premultiply-alpha', 'premultiplied-alpha']) {
    const create = () => {
      const source = new BufferImageSource({ width: 2, height: 2, alphaMode,
        resource: new Uint8Array([200, 80, 40, 255, 200, 80, 40, 255, 200, 80, 40, 255, 200, 80, 40, 255]) })
      const texture = nativeSpriteRecordTexture({ source, frame: new Rectangle(0, 0, 2, 2) })
      return { source, texture, drawable: makeDrawable(texture, 'standalone-mesh') }
    }
    const retired = create()
    const expected = render(app, target, retired.drawable, 64, .125)
    retired.drawable.destroy(); retired.texture.destroy(true)
    const current = create()
    try {
      rows.push({ mode, role: 'pooled-source-retirement', alphaMode, retiredSource: retired.source.destroyed,
        ...compare(render(app, target, current.drawable, 64, .125), expected) })
    } finally { current.drawable.destroy(); current.texture.destroy(true) }
  }
  return rows
}

export async function inspectLooseNativeSampling() {
  const hubTextures = await loadHubWorldTextures()
  const boneyardTextures = await loadBoneyardWorldTextures()
  const members = [
    ['Hub Clothes:11', hubTextures.enchantStaff.auras[0], enchant0],
    ['Hub Clothes:12', hubTextures.enchantStaff.auras[1], enchant1],
    ['Arena Clothes:11', boneyardTextures.enchantStaff.auras[0], enchant0],
    ['Arena Clothes:12', boneyardTextures.enchantStaff.auras[1], enchant1],
    ['College:5', hubTextures.base[hagathaGlow], hagathaGlow],
    ['College:11', hubTextures.base[luthacusShadow], luthacusShadow],
    ['BadGuys:67', hubTextures.base[actorShadow], actorShadow67],
    ['Solomon:0', boneyardTextures.solomonFlydirt, flydirt],
  ]
  const app = new Application()
  await app.init({ antialias: false, autoStart: false, width: SIZE, height: SIZE, preference: 'webgl' })
  installNativeFixedFunctionRenderPipeline(app.renderer)
  const target = RenderTexture.create({ alphaMode: 'no-premultiply-alpha', width: SIZE, height: SIZE })
  const rows = []
  try {
    for (const [member, current, cropUrl] of members) {
      const crop = nativeStockFramedTextureFromImage(await load(cropUrl))
      const reference = croppedReference(crop.source, crop.width, crop.height)
      const candidate = makeDrawable(current, 'sprite')
      const control = makeDrawable(reference, 'sprite')
      try {
        for (const scale of [1.111, 3.5]) rows.push({ member, kind: 'sprite', scale,
          ...compare(render(app, target, candidate, scale, .125), render(app, target, control, scale, .125)) })
        const mesh = makeDrawable(current, 'batched-mesh')
        const meshControl = makeDrawable(reference, 'batched-mesh')
        try {
          rows.push({ member, kind: 'batched-mesh', scale: 3.5,
            ...compare(render(app, target, mesh, 3.5, .125), render(app, target, meshControl, 3.5, .125)) })
        } finally { mesh.destroy(); meshControl.destroy() }
      } finally {
        candidate.destroy(); control.destroy(); reference.destroy(false); crop.destroy(true)
      }
    }
  } finally {
    target.destroy(true); app.destroy(true, { children: true })
    destroyHubWorldTextureFrames(hubTextures); destroyBoneyardWorldTextures(boneyardTextures)
  }
  return rows
}

export function authoredSamplingFixture() {
  const canvas = document.createElement('canvas')
  canvas.width = 24 * 170; canvas.height = 170
  const context = canvas.getContext('2d')
  context.fillStyle = '#ff00ff'; context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#0000ff'; context.fillRect(8, 0, 8, 8)
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
    context.fillStyle = (x + y) % 2 ? '#00ff00' : '#ff0000'
    context.fillRect(x, y, 1, 1)
  }
  return canvas.toDataURL('image/png').split(',')[1]
}

export async function inspectAuthoredSampling() {
  const assets = [{ kind: 'image', modId: 'sampling-test', path: 'tight.png', sha256: 'sampling-test-tight-sheet' }]
  const textures = await loadModPresentationTextures(assets)
  const frame = { x: 0, y: 0, width: 8, height: 8, logicalWidth: 8, logicalHeight: 8, centerOffsetX: 0, centerOffsetY: 0 }
  const content = { contentId: 'sampling-test:hat', modId: 'sampling-test', key: 'hat',
    icon: { imagePath: 'tight.png', frame }, wearable: { slot: 'hat', wornImagePath: 'tight.png' } }
  const app = new Application()
  await app.init({ antialias: false, autoStart: false, width: SIZE, height: SIZE, preference: 'webgl' })
  installNativeFixedFunctionRenderPipeline(app.renderer)
  const target = RenderTexture.create({ alphaMode: 'no-premultiply-alpha', width: SIZE, height: SIZE })
  const canvas = document.createElement('canvas')
  canvas.width = 8; canvas.height = 8
  const context = canvas.getContext('2d')
  context.drawImage(textures.texture(content).source.resource, 0, 0, 8, 8, 0, 0, 8, 8)
  const reference = Texture.from(await load(canvas.toDataURL()))
  const control = makeDrawable(reference, 'sprite')
  const icon = makeDrawable(textures.texture(content), 'sprite')
  const sprite = makeDrawable(textures.spriteFrame('tight', 'sampling-test', 'tight.png', frame), 'sprite')
  let result
  try {
    const expected = render(app, target, control, 7.5, .125)
    const before = render(app, target, icon, 7.5, .125)
    const spriteBefore = render(app, target, sprite, 7.5, .125)
    const wearable = textures.wearable(content)
    const iconSource = icon.view.texture.source
    const wearableSource = wearable.primary[0][0].source
    // Re-upload both roles after context restoration to exercise their sampler ownership.
    await restoreContext(app)
    const after = render(app, target, icon, 7.5, .125)
    const wearableCanvas = document.createElement('canvas')
    wearableCanvas.width = 170; wearableCanvas.height = 170
    wearableCanvas.getContext('2d').drawImage(iconSource.resource, 0, 0, 170, 170, 0, 0, 170, 170)
    const wearableReference = new Texture({ source: new ImageSource({ resource: wearableCanvas, scaleMode: 'nearest' }) })
    const wearableCandidate = makeDrawable(wearable.primary[0][0], 'sprite')
    const wearableControl = makeDrawable(wearableReference, 'sprite')
    let wearableResult
    try {
      wearableResult = compare(render(app, target, wearableCandidate, 1.111, .125), render(app, target, wearableControl, 1.111, .125))
    } finally { wearableCandidate.destroy(); wearableControl.destroy(); wearableReference.destroy(true) }
    const fractionalFrame = { ...frame, x: 3.25, y: 2.375, width: .5, height: .25 }
    const fractional = makeDrawable(textures.spriteFrame('fractional', 'sampling-test', 'tight.png', fractionalFrame), 'sprite')
    const centerSource = new BufferImageSource({ width: 1, height: 1, resource: new Uint8Array([0, 255, 0, 255]) })
    const centered = new Texture({ source: centerSource, orig: new Rectangle(0, 0, 8, 8), trim: new Rectangle(3.75, 3.875, .5, .25) })
    const fractionalControl = makeDrawable(centered, 'sprite')
    let fractionalResult
    try {
      fractionalResult = compare(render(app, target, fractional, 32, .125), render(app, target, fractionalControl, 32, .125))
    } finally { fractional.destroy(); fractionalControl.destroy(); centered.destroy(true) }
    result = {
      icon: compare(before, expected), sprite: compare(spriteBefore, expected),
      fractional: fractionalResult, wearable: wearableResult,
      sharedFilterMutation: compare(after, before),
      separateSamplerSources: iconSource !== wearableSource,
      iconScaleMode: iconSource.style.scaleMode,
      wearableScaleMode: wearableSource.style.scaleMode,
    }
    textures.destroy()
    result.retiredSources = iconSource.destroyed && wearableSource.destroyed
    return result
  } finally {
    icon.destroy(); sprite.destroy(); control.destroy(); reference.destroy(true); textures.destroy()
    target.destroy(true); app.destroy(true, { children: true })
  }
}

export async function inspectPackedPaintingSampling() {
  const pages = await Promise.all(HUB_VISUAL_ATLAS_SOURCES.map(async url => Texture.from(await load(url))))
  const atlas = createHubVisualAtlas(url => pages[HUB_VISUAL_ATLAS_SOURCES.indexOf(url)])
  const sheet = await load(paintings)
  const app = new Application()
  await app.init({ antialias: false, autoStart: false, width: SIZE, height: SIZE, preference: 'webgl' })
  installNativeFixedFunctionRenderPipeline(app.renderer)
  const target = RenderTexture.create({ alphaMode: 'no-premultiply-alpha', width: SIZE, height: SIZE })
  const rows = []
  try {
    for (let frame = 0; frame < 10; frame += 1) {
      const canvas = document.createElement('canvas'); canvas.width = 74; canvas.height = 224
      canvas.getContext('2d').drawImage(sheet, frame * 74, 0, 74, 224, 0, 0, 74, 224)
      const reference = Texture.from(canvas)
      const candidate = makeDrawable(atlas.frame(paintings, frame, 0), 'sprite')
      const control = makeDrawable(reference, 'sprite')
      try {
        for (const scale of [1.111, 3.5]) {
          const actual = render(app, target, candidate, scale, .125)
          const expected = render(app, target, control, scale, .125)
          const comparison = compare(actual, expected)
          const peaks = []
          for (let pixel = 0; pixel < actual.length / 4 && peaks.length < 8; pixel += 1) {
            if (![0, 1, 2, 3].some(channel => Math.abs(actual[pixel * 4 + channel] - expected[pixel * 4 + channel]) === comparison.maximumDelta)) continue
            const x = pixel % SIZE + .5 - 48.375
            const y = Math.floor(pixel / SIZE) + .5 - 40.625
            peaks.push({ logicalX: (x * Math.cos(.125) + y * Math.sin(.125)) / scale,
              logicalY: (-x * Math.sin(.125) + y * Math.cos(.125)) / scale,
              actual: Array.from(actual.slice(pixel * 4, pixel * 4 + 4)), expected: Array.from(expected.slice(pixel * 4, pixel * 4 + 4)) })
          }
          rows.push({ frame, scale, ...comparison, peaks })
        }
      } finally { candidate.destroy(); control.destroy(); reference.destroy(true) }
    }
  } finally {
    atlas.destroy(); pages.forEach(page => page.destroy(true)); target.destroy(true); app.destroy(true, { children: true })
  }
  return rows
}

export async function inspectPackedSupportSampling() {
  const { createPlayerCharacterAtlas, PLAYER_CHARACTER_ATLAS_SOURCES } = await import('../src/game/renderer/player-character-atlas.ts')
  const { PLAYER_CHARACTER_ATLAS_SHEETS } = await import('../src/game/renderer/player-character-atlas.generated.ts')
  const hubRows = [
    { image: (await import('../src/assets/game/hub-astronomer-assistants.png')).default, width: 150, height: 150 },
    { image: (await import('../src/assets/game/hub-room-arch-chancellor.png')).default, width: 150, height: 150 },
    { image: (await import('../src/assets/game/hub-npc-directional-hint.png')).default, width: 116, height: 128 },
  ]
  const playerRows = [
    ['player-character-head-air', (await import('../src/assets/game/player-character-head-air.png')).default],
    ['player-character-robe-dynamic-air', (await import('../src/assets/game/player-character-robe-dynamic-air.png')).default],
    ['player-character-death-air', (await import('../src/assets/game/player-character-death-air.png')).default],
    ['player-character-hat-0-primary', (await import('../src/assets/game/player-character-hat-0-primary.png')).default],
    ['player-character-staff-0-body-front', (await import('../src/assets/game/player-character-staff-0-body-front.png')).default],
  ]
  const hubPages = await Promise.all(HUB_VISUAL_ATLAS_SOURCES.map(async url => Texture.from(await load(url))))
  const playerPages = await Promise.all(PLAYER_CHARACTER_ATLAS_SOURCES.map(async url => Texture.from(await load(url))))
  const hubAtlas = createHubVisualAtlas(url => hubPages[HUB_VISUAL_ATLAS_SOURCES.indexOf(url)])
  const playerAtlas = createPlayerCharacterAtlas(url => playerPages[PLAYER_CHARACTER_ATLAS_SOURCES.indexOf(url)])
  const app = new Application()
  await app.init({ antialias: false, autoStart: false, width: SIZE, height: SIZE, preference: 'webgl' })
  installNativeFixedFunctionRenderPipeline(app.renderer)
  const target = RenderTexture.create({ alphaMode: 'no-premultiply-alpha', width: SIZE, height: SIZE })
  const rows = []
  const inspect = (member, texture, source, width, height, slice, sourceX = 0, sourceY = 0) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    canvas.getContext('2d').drawImage(source, sourceX, sourceY, width, height, 0, 0, width, height)
    const whole = Texture.from(canvas)
    const reference = slice ? new Texture({ source: whole.source, frame: new Rectangle(...slice) }) : whole
    const trim = texture.trim
    const originalX = texture.frame.x - trim.x - (slice?.[0] ?? 0)
    const originalY = texture.frame.y - trim.y - (slice?.[1] ?? 0)
    const matchingCanvas = document.createElement('canvas')
    matchingCanvas.width = texture.source.width; matchingCanvas.height = texture.source.height
    const matchingContext = matchingCanvas.getContext('2d')
    matchingContext.imageSmoothingEnabled = false
    // Independent original pixels with two-texel edge extrusion; preserve the
    // atlas denominator and coordinate origin without using product clamping.
    for (let y = -1; y <= 1; y += 1) for (let x = -1; x <= 1; x += 1) {
      matchingContext.drawImage(canvas,
        x < 0 ? 0 : x > 0 ? width - 1 : 0, y < 0 ? 0 : y > 0 ? height - 1 : 0,
        x === 0 ? width : 1, y === 0 ? height : 1,
        originalX + (x < 0 ? -2 : x > 0 ? width : 0), originalY + (y < 0 ? -2 : y > 0 ? height : 0),
        x === 0 ? width : 2, y === 0 ? height : 2)
    }
    const matchingPage = Texture.from(matchingCanvas)
    const matchingReference = new Texture({ source: matchingPage.source,
      frame: new Rectangle(originalX + (slice?.[0] ?? 0), originalY + (slice?.[1] ?? 0), slice?.[2] ?? width, slice?.[3] ?? height) })
    const sourcePixels = document.createElement('canvas')
    sourcePixels.width = texture.frame.width; sourcePixels.height = texture.frame.height
    const sourceContext = sourcePixels.getContext('2d')
    sourceContext.drawImage(texture.source.resource, texture.frame.x, texture.frame.y, texture.frame.width, texture.frame.height,
      0, 0, texture.frame.width, texture.frame.height)
    const sourcePixelMaximumDelta = compare(sourceContext.getImageData(0, 0, sourcePixels.width, sourcePixels.height).data,
      canvas.getContext('2d').getImageData(trim.x + (slice?.[0] ?? 0), trim.y + (slice?.[1] ?? 0), trim.width, trim.height).data).maximumDelta
    const candidate = makeDrawable(texture, 'sprite')
    const control = makeDrawable(reference, 'sprite')
    const matchingControl = makeDrawable(matchingReference, 'sprite')
    try {
      for (const scale of [1.111, 2.25]) {
        const actual = render(app, target, candidate, scale, .125)
        const expected = render(app, target, control, scale, .125)
        const comparison = compare(actual, expected)
        const peaks = []
        for (let pixel = 0; pixel < actual.length / 4 && peaks.length < 3; pixel += 1) {
          if (comparison.maximumDelta < 2 || ![0, 1, 2, 3].some(channel => Math.abs(actual[pixel * 4 + channel] - expected[pixel * 4 + channel]) === comparison.maximumDelta)) continue
          peaks.push({ x: pixel % SIZE, y: Math.floor(pixel / SIZE), actual: Array.from(actual.slice(pixel * 4, pixel * 4 + 4)), expected: Array.from(expected.slice(pixel * 4, pixel * 4 + 4)) })
        }
        rows.push({ member, scale, ...comparison, sourcePixelMaximumDelta, peaks,
          sameCoordinates: compare(actual, render(app, target, matchingControl, scale, .125)) })
      }
    } finally {
      candidate.destroy(); control.destroy(); matchingControl.destroy(); matchingReference.destroy(false); matchingPage.destroy(true)
      if (slice) reference.destroy(false); whole.destroy(true)
    }
  }
  try {
    for (const row of hubRows) {
      const source = await load(row.image)
      inspect(row.image, hubAtlas.frame(row.image, 0, 0), source, row.width, row.height)
    }
    const hint = hubRows[2]
    for (const slice of [[45, 50, 30, 35], [0, 0, 60, 65]]) {
      inspect(`hub-subframe:${slice}`, hubAtlas.subframe(hint.image, ...slice), await load(hint.image), hint.width, hint.height, slice)
    }
    for (const [member, image] of playerRows) {
      const [columns, , width, height, frames] = PLAYER_CHARACTER_ATLAS_SHEETS[member]
      const index = frames.findIndex(frame => frame !== null)
      const column = index % columns
      const row = Math.floor(index / columns)
      inspect(`${member}:${column},${row}`, playerAtlas.frame(member, column, row), await load(image), width, height, undefined, column * width, row * height)
    }
  } finally {
    hubAtlas.destroy(); playerAtlas.destroy(); hubPages.forEach(page => page.destroy(true)); playerPages.forEach(page => page.destroy(true))
    target.destroy(true); app.destroy(true, { children: true })
  }
  return rows
}

import { Application, BufferImageSource, Container, RenderTexture, Sprite, Texture } from 'pixi.js'
import { createNativeLitSurfaceGrid } from '../src/game/renderer/boneyard-building-surface-view.ts'
import { installNativeArenaRenderPipeline } from '../src/game/renderer/native-arena-render-pipeline.ts'
import { installNativeFixedFunctionRenderPipeline } from '../src/game/renderer/native-fixed-function-render-pipeline.ts'
import { NativeSceneryHitView } from '../src/game/renderer/native-scenery-hit-view.ts'
import { nativeSecondarySpriteRecord } from '../src/game/renderer/native-secondary-assets.ts'
import { NativeSecondaryWorldView } from '../src/game/renderer/native-secondary-world-view.ts'

function solidTexture(width, height, rgba) {
  const pixels = new Uint8Array(width * height * 4)
  for (let offset = 0; offset < pixels.length; offset += 4) pixels.set(rgba, offset)
  return new Texture({ source: new BufferImageSource({ width, height, resource: pixels,
    alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest' }) })
}

function equalPixels(a, b) { return a.length === b.length && a.every((value, index) => value === b[index]) }
function hit(kind, targetId, strength = .5) { return { kind, targetId, hitTick: 10, feedback: { tick: 10, timer: 1, strength } } }

export async function inspectNativePuppetHits() {
  const app = new Application()
  await app.init({ autoStart: false, width: 256, height: 256, preference: 'webgl', antialias: false, resolution: 1 })
  installNativeFixedFunctionRenderPipeline(app.renderer)
  const arena = installNativeArenaRenderPipeline(app.renderer)
  const target = RenderTexture.create({ width: 256, height: 256, alphaMode: 'no-premultiply-alpha' })
  const texture = solidTexture(16, 16, [60, 120, 30, 255])
  const textures = new Map()
  const render = () => {
    app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 0] })
    return app.renderer.extract.pixels({ target }).pixels
  }
  const rows = []
  try {
    for (const kind of ['glyph', 'tree', 'building']) {
      const root = new Container()
      app.stage.addChild(root)
      const surface = kind === 'building' ? createNativeLitSurfaceGrid(texture, 16, 16, false) : null
      surface?.update([.5, .5, .5, .5])
      const main = surface?.mesh ?? new Sprite(texture)
      main.position.set(20, 20)
      root.addChild(main)
      const upperSurface = kind === 'building' ? createNativeLitSurfaceGrid(texture, 16, 16, false) : null
      upperSurface?.update([.5, .5, .5, .5])
      const proxy = upperSurface?.mesh ?? new Sprite(texture)
      proxy.position.set(60, 20)
      root.addChild(proxy)
      const resident = { sprite: main, surfaceMesh: surface }
      const upper = { sprite: proxy, surfaceMesh: upperSurface }
      const view = new NativeSceneryHitView([{ kind: 'object', object: { eid: kind } }], new Map([[0, resident]]),
        new Map(kind === 'tree' ? [[kind, { main: resident, proxy: upper }]] : []),
        new Map(kind === 'building' ? [[kind, { main: resident, roof: upper }]] : []))
      const before = render()
      const bodyPixel = data => Array.from(data.slice((24 * 256 + 24) * 4, (24 * 256 + 24) * 4 + 4))
      const proxyPixel = data => Array.from(data.slice((24 * 256 + 64) * 4, (24 * 256 + 64) * 4 + 4))
      const samples = []
      for (const complex of [true, false, true]) {
        view.update([hit('scenery', `scenery:${kind}`)], 10, complex)
        const pixels = render()
        samples.push({ complex, body: bodyPixel(pixels), proxy: proxyPixel(pixels),
          proxyDraws: proxy.children.filter(child => child.visible).length })
      }
      const copies = [...main.children, ...proxy.children]
      const shader = surface?.mesh.shader
      const geometry = surface?.mesh.geometry
      view.update([], 11, true)
      const after = render()
      rows.push({ kind, before: bodyPixel(before), samples, restored: equalPixels(before, after),
        copiesDestroyed: copies.every(copy => copy.destroyed),
        borrowedResourcesAlive: !texture.destroyed && (!surface || (shader.resources !== null && geometry.buffers !== null
          && upperSurface.mesh.shader.resources !== null && upperSurface.mesh.geometry.buffers !== null)),
        childrenAfterRetire: main.children.length + proxy.children.length })
      view.destroy()
      surface?.destroy()
      upperSurface?.destroy()
      root.destroy({ children: true })
    }

    const secondary = new Proxy({}, { get(_target, key) {
      if (typeof key !== 'string') return undefined
      if (!textures.has(key)) {
        const [atlas, entry] = key.split(':')
        const record = nativeSecondarySpriteRecord(atlas, Number(entry))
        textures.set(key, solidTexture(record.width, record.height, [60, 120, 30, 128]))
      }
      return textures.get(key)
    } })
    const root = new Container()
    app.stage.addChild(root)
    const view = new NativeSecondaryWorldView(root, { secondary, secondarySpecial: {} }, app.renderer)
    const parent = { id: 1, kind: 'leviathan', ageTicks: 100, alpha: 1, damage: 1, enhanced: true,
      endpoint: { x: 0, y: 0 }, frame: 0, freezeTicks: 0, golem: null, hitTargetIds: [], lifetimeTicks: 1664,
      lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 }, midpoint: { x: 0, y: 0 },
      miscLightAppendOrdinal: null, ownerId: 'owner', painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: 1 }],
      phase: 0, position: { x: 128, y: 128 }, presentationRng: null, quantity: 1, radius: 30, rank: 1,
      rotationRadians: 0, scale: 1, skillId: 11, slowFactor: 1, targetId: null, variant: 0,
      velocity: { x: 0, y: 0 }, worldKey: 'boneyard:probe' }
    const appendage = { ...parent, id: 2, kind: 'leviathan-appendage', hitTargetIds: [1],
      endpoint: { x: 0, y: -30 }, radius: 2, quantity: 50,
      painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: 2 }] }
    const state = { actors: [parent, appendage] }
    view.update(state, parent.worldKey, 100)
    const original = render()
    const composite = [...view.leviathanComposites.values()][0]
    const readTarget = target => app.renderer.extract.pixels({ target }).pixels
    const sourceBefore = readTarget(composite.renderTexture)
    view.setPuppetHits(new Map([['secondary:1', hit('leviathan', 'secondary:1')]]), true)
    const withHit = render()
    const nestedHit = readTarget(composite.hitRenderTexture)
    const captureSamples = []
    for (let offset = 0; offset < 128 * 256 * 4; offset += 4) {
      if (sourceBefore[offset + 3] < 60 || nestedHit[offset + 3] < 10) continue
      captureSamples.push({ ordinary: Array.from(sourceBefore.slice(offset, offset + 4)),
        hit: Array.from(nestedHit.slice(offset, offset + 4)) })
      break
    }
    const normalTargetPreserved = equalPixels(sourceBefore, readTarget(composite.renderTexture))
    view.setPuppetHits(new Map(), true)
    view.update(state, parent.worldKey, 100)
    const restored = equalPixels(original, render())
    const normalTarget = composite.renderTexture
    const hitTarget = composite.hitRenderTexture
    view.update({ actors: [] }, parent.worldKey, 100)
    const leviathan = { visibleHit: !equalPixels(original, withHit), normalTargetPreserved, restored,
      captureSamples, retiredChildren: root.children.length,
      targetsDestroyed: normalTarget.destroyed && hitTarget.destroyed,
      sourceTexturesAlive: [...textures.values()].every(texture => !texture.destroyed) }
    view.destroy()
    root.destroy({ children: true })
    return { scenery: rows, leviathan }
  } finally {
    target.destroy(true)
    arena.destroy()
    app.destroy(true, { children: true })
    texture.destroy(true)
    for (const texture of textures.values()) texture.destroy(true)
  }
}

import { Application, Container, MeshSimple, RenderTexture, Texture } from 'pixi.js'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import { createNativeSilk } from '../src/game/core-kernels/native-silk.ts'
import { nativeSilkMesh } from '../src/game/core-kernels/native-silk-presentation.ts'
import { nativeLineColor, nativeLineVertices } from '../src/game/core-kernels/native-line.ts'
import { NativeSpiderWebViews } from '../src/game/renderer/native-spider-web-views.ts'
import { NativeEnemyProjectileViews } from '../src/game/renderer/native-enemy-projectile-view.ts'
import { nativeEnemyProjectilePlan } from '../src/game/renderer/native-enemy-projectile-presentation.ts'
import { nativeEnemySpriteRecord } from '../src/game/renderer/native-enemy-assets.ts'
import { installNativeFixedFunctionRenderPipeline } from '../src/game/renderer/native-fixed-function-render-pipeline.ts'
import { installNativeArenaRenderPipeline } from '../src/game/renderer/native-arena-render-pipeline.ts'
import { setNativeVertexColors } from '../src/game/renderer/native-material-batch.ts'
import { destroyOwnedMeshGeometry } from '../src/game/renderer/destroy-owned-mesh-geometry.ts'

const size = 640
const clearColor = [0.2, 0.1, 0.3, 1]

/** Actual view owners versus small, independently submitted native quads and a blend oracle. */
export async function inspectNativeProjectileTrails() {
  const app = new Application()
  await app.init({ width: size, height: size, preference: 'webgl', autoStart: false, antialias: false, resolution: 1 })
  installNativeFixedFunctionRenderPipeline(app.renderer)
  const pipeline = installNativeArenaRenderPipeline(app.renderer)
  const target = RenderTexture.create({ width: size, height: size, alphaMode: 'no-premultiply-alpha' })
  const root = new Container()
  const reference = new Container()
  const preWorld = new Container()
  const webs = new NativeSpiderWebViews(root)
  const colorBuffers = new Set()
  const silk = createNativeSilk({ x: 320, y: 40 }, {
    position: { x: 320, y: 300 }, velocityPerTick: { x: 0, y: 0 },
  }, 10, createNativeRng(315)).state
  const rows = []
  try {
    const background = pixels(reference)
    for (const [name, phase, alpha, light] of [
      ['new', 0, 1, 1], ['short', 2, 1, 1], ['grown', 18, 1, 1],
      ['reused-short', 2, 1, 0.25], ['faded-grown', 18, 0.2, 0.25], ['invisible', 18, 0, 1],
    ]) {
      const state = { ...silk, phase, alpha }
      webs.update([{ id: 7, state }], [], 17, () => light)
      const mesh = root.children[0]
      colorBuffers.add(mesh.geometry.getBuffer('aColor'))
      const plan = nativeSilkMesh(state, () => light, createNativeRng(7 ^ 17))
      const actual = pixels(root)
      for (let offset = 0; offset < plan.vertices.length; offset += 8) {
        addQuad(reference, plan.vertices.slice(offset, offset + 8), plan.colors.slice(offset / 2, offset / 2 + 4), 'add')
      }
      const expected = pixels(reference)
      let differentChannels = 0
      let visiblePixels = 0
      for (let i = 0; i < actual.length; i += 4) {
        if (actual[i] !== background[i] || actual[i + 1] !== background[i + 1] || actual[i + 2] !== background[i + 2]) visiblePixels += 1
        for (let c = 0; c < 4; c += 1) if (actual[i + c] !== expected[i + c]) differentChannels += 1
      }
      rows.push({ name, differentChannels, visiblePixels, capacity: mesh.vertices.length / 2, blend: mesh.blendMode })
      clearReference()
    }
    const fragment = { id: 8, spawnTick: 0, state: {
      start: { x: 100, y: 100 }, middle: { x: 160, y: 100 }, end: { x: 220, y: 100 },
      velocity: { x: 0, y: 0 }, opacity: 0.4, opacityLossPerTick: 0.01,
    } }
    webs.update([], [fragment], 17, () => 1)
    const fragmentMesh = root.children[0]
    colorBuffers.add(fragmentMesh.geometry.getBuffer('aColor'))
    const transparent = nativeLineColor(1, 1, 1, 0)
    const opaque = nativeLineColor(1, 1, 1, 0.4)
    addQuad(reference, nativeLineVertices(fragment.state.start, fragment.state.middle, 2), [transparent, transparent, opaque, opaque], 'normal')
    addQuad(reference, nativeLineVertices(fragment.state.middle, fragment.state.end, 2), [opaque, opaque, transparent, transparent], 'normal')
    const actualFragment = pixels(root)
    const expectedFragment = pixels(reference)
    rows.push({ name: 'fragment', differentChannels: actualFragment.reduce((count, value, i) => count + Number(value !== expectedFragment[i]), 0),
      blend: fragmentMesh.blendMode })
    clearReference()
    webs.update([], [], 18, () => 1)
    const retiredWebs = root.children.length === 0 && [...colorBuffers].every(buffer => buffer.destroyed)

    const fixture = {
      id: 90, kind: 'arrow', typeCode: 2010, position: { x: 240, y: 160 }, ageTicks: 30,
      lifetimeTicks: 300, headingDeg: 90, visualPhaseDeg: 90, speed: 4, visualScale: 1,
    }
    const base = { [nativeEnemySpriteRecord('BadGuys', 3).source]: Texture.EMPTY }
    for (const payload of ['normal', 'fire', 'poison']) {
      const plan = nativeEnemyProjectilePlan({ ...fixture, payload, verticalOffset: -25 }, 30)
      for (const layer of [...plan.layers, ...plan.underlays]) base[nativeEnemySpriteRecord(layer.atlas, layer.entry).source] = Texture.EMPTY
    }
    const arrows = new NativeEnemyProjectileViews(root, { base }, preWorld)
    const arrowRows = []
    try {
      for (const payload of ['normal', 'fire', 'poison']) {
        for (const light of [0, 0.25, 1]) {
          for (const height of [-25, -20, -19.5, 0]) {
            const projectile = { ...fixture, payload, verticalOffset: height }
            const plan = nativeEnemyProjectilePlan(projectile, 30)
            arrows.update([projectile], 30)
            arrows.setLightScalar(projectile.id, light)
            const output = pixels(root)
            const samples = [219, 170, 120].map(x => {
              const y = 160 + height
              const offset = (Math.floor(y) * size + x) * 4
              const alpha = plan.streak ? Math.trunc(Math.fround(plan.streak.alpha * light) * 255) / 255 * (x + 0.5 - 120) / 100 : 0
              return { pixel: [...output.slice(offset, offset + 4)], expected: [
                ...clearColor.slice(0, 3).map(background => 127 * alpha + background * 255 * (1 - alpha)),
                255 * (alpha * alpha + 1 - alpha),
              ] }
            })
            arrowRows.push({ payload, light, height, samples })
          }
        }
      }
    } finally { arrows.destroy() }
    return { silk: rows, arrows: arrowRows, retiredWebs, retiredArrows: root.children.length === 0 && preWorld.children.length === 0 }
  } finally {
    webs.destroy()
    clearReference()
    root.destroy({ children: true })
    reference.destroy({ children: true })
    preWorld.destroy({ children: true })
    target.destroy(true)
    pipeline.destroy()
    app.destroy(true, { children: true })
  }

  function pixels(container) {
    app.renderer.render({ container, target, clear: true, clearColor })
    return app.renderer.extract.pixels({ target }).pixels
  }
  function clearReference() {
    for (const mesh of reference.removeChildren()) {
      destroyOwnedMeshGeometry(mesh)
      mesh.destroy()
    }
  }
}

function addQuad(root, vertices, colors, blendMode) {
  const mesh = new MeshSimple({ texture: Texture.WHITE, topology: 'triangle-list',
    vertices: new Float32Array(vertices), uvs: new Float32Array(8), indices: new Uint32Array([0, 1, 2, 1, 2, 3]),
  })
  setNativeVertexColors(mesh, new Uint32Array(colors))
  mesh.blendMode = blendMode
  root.addChild(mesh)
}

import assert from 'node:assert/strict'
import test from 'node:test'
import { nativeBrokenFenceHalves, nativeQuadCanvasTriangles } from './native-fence-geometry.ts'
import { buildNativeRenderPlan } from './native-render-plan.ts'
import type { EditorDoc, Polyline } from './model.ts'
import { nativeBoneyardMainLayerShadowCaster } from '../game/renderer/boneyard-shadow-casters.ts'
import { nativeSceneryShadowPlan } from '../game/renderer/native-scenery-shadow.ts'
import { nativeFencepostShadowOutline } from '../game/renderer/boneyard-native-shadow-shapes.ts'
import { nativeBoneyardFenceGrateShadows } from '../game/renderer/boneyard-complex-shadows.ts'
import { BufferImageSource, Container, Texture } from 'pixi.js'
import { createNativeStaticQuad } from '../game/renderer/native-static-quad.ts'
import { destroyResidentTexture } from '../game/renderer/boneyard-resident-lifetime.ts'

test('retained native Broken quad owns one shared diagonal and releases all resident buffers', () => {
  const pixels = new Uint8ClampedArray(4).fill(255)
  const texture = new Texture({ source: new BufferImageSource({ resource: pixels, width: 1, height: 1 }) })
  const half = nativeBrokenFenceHalves([{ x: 300, y: 400 }, { x: 500, y: 460 }], 3, 5)[0]!
  const mesh = createNativeStaticQuad(texture, half)
  const parent = new Container()
  parent.addChild(mesh)
  const buffers = [...mesh.geometry.buffers]
  assert.deepEqual([...mesh.geometry.getIndex().data], [0, 1, 2, 2, 1, 3])
  assert.deepEqual([...mesh.vertices], [half.p0.x, half.p0.y, half.p1.x, half.p1.y, half.p2.x, half.p2.y, half.p3.x, half.p3.y])
  mesh.tint = 0x777777
  mesh.zIndex = 15
  mesh.renderable = false
  mesh.renderable = true
  assert.equal(mesh.tint, 0x777777)
  assert.equal(mesh.zIndex, 15)
  assert.equal(mesh.autoUpdate, false)
  const resident = { pixels, sprite: mesh, surfaceMesh: null, texture,
    x: 0, y: 0, w: 1, h: 1, mainLayerIndex: 0, cleanupSourceKey: null, shadowCaster: null }
  destroyResidentTexture(resident)
  assert.ok(buffers.every(buffer => buffer.destroyed))
  assert.equal(texture.destroyed, true)
  assert.equal(resident.pixels.length, 0)
  parent.destroy({ children: true })
})

test('retained Broken resident never destroys its borrowed native glyph texture', () => {
  const half = nativeBrokenFenceHalves([{ x: 100, y: 200 }, { x: 300, y: 200 }])[0]!
  const mesh = createNativeStaticQuad(Texture.WHITE, half)
  const buffers = [...mesh.geometry.buffers]
  destroyResidentTexture({ pixels: new Uint8ClampedArray(0), sprite: mesh, surfaceMesh: null,
    texture: Texture.WHITE, ownsTexture: false, x: 0, y: 0, w: 1, h: 1,
    mainLayerIndex: 0, cleanupSourceKey: null, shadowCaster: null })
  assert.ok(buffers.every(buffer => buffer.destroyed))
  assert.equal(Texture.WHITE.destroyed, false)
  mesh.destroy()
})

function document(fences: Polyline[]): EditorDoc {
  return { meta: { name: 'fences', bounds: { x: 0, y: 0, w: 1024, h: 1024 } },
    fences, objects: [], sprites: [], roads: [], terrain: [], opaque: [], hasTimeline: true }
}

test('Broken constructor obeys native post-D3D PC24 precision on ordinary non-round coordinates', () => {
  const halves = nativeBrokenFenceHalves([{ x: 300, y: 401 }, { x: 500, y: 461 }], 3, 5)
  assert.deepEqual(halves.map(h => h.seed), [1574021342, 775594861])
  const points = (rows: number[][]) => rows.map(([x, y]) => ({ x: Math.fround(x!), y: Math.fround(y!) }))
  assert.deepEqual(halves.flatMap(h => [h.p0, h.p1, h.p2, h.p3, h.shadowStart, h.shadowEnd, h.shadowStep, h.root]), points([
    [465.3839416503906,399.2221374511719], [488.2209167480469,406.7079772949219],
    [460.48388671875,453.31072998046875], [488.2209167480469,458.7079772949219],
    [466.3734130859375,454.4567565917969], [482.3313903808594,457.56195068359375],
    [7.852715015411377,1.5280259847640991], [482.3313903808594,457.56195068359375],
    [344.8943786621094,352.6610412597656], [311.96160888671875,349.958984375],
    [341.05291748046875,404.291259765625], [311.96160888671875,401.958984375],
    [335.0721130371094,403.811767578125], [317.9424133300781,402.4384765625],
    [-7.974414348602295,-.6393101811408997], [335.0721130371094,403.811767578125],
  ]))
  assert.deepEqual(halves.map(h => h.shadowCount), [3, 3])
})

test('Broken fractional authored positions preserve PC24 seed, squared-term and quotient rounding', () => {
  const halves = nativeBrokenFenceHalves([
    { x: 7979.3603515625, y: 9309.3544921875 }, { x: 8179.3603515625, y: 9369.3544921875 },
  ], 4, 5)
  assert.deepEqual(halves.map(h => h.seed), [1456855488, 881586560])
  assert.deepEqual(halves.flatMap(h => [h.p0, h.p1, h.p2, h.p3, h.shadowStart, h.shadowEnd, h.shadowStep, h.root]), [
    [8125.49853515625,9275.2294921875], [8168.9658203125,9311.3583984375],
    [8143.4736328125,9348.6552734375], [8168.9658203125,9363.3583984375],
    [8148.6708984375,9351.6533203125], [8163.7685546875,9360.3603515625],
    [6.930111408233643,3.9966931343078613], [8163.7685546875,9360.3603515625],
    [8016.26708984375,9258.0400390625], [7990.95166015625,9260.458984375],
    [8018.02099609375,9319.708984375], [7990.95166015625,9312.458984375],
    [8012.22509765625,9318.15625], [7996.74755859375,9314.01171875],
    [-7.727738857269287,-2.0693118572235107], [8012.22509765625,9318.15625],
  ].map(([x, y]) => ({ x: Math.fround(x!), y: Math.fround(y!) })))
  assert.deepEqual(halves.map(h => h.shadowCount), [3, 3])
})

test('Broken end/start halves match independent instruction-translated horizontal goldens', () => {
  const halves = nativeBrokenFenceHalves([{ x: 100, y: 200 }, { x: 300, y: 200 }])
  assert.equal(halves.length, 2)
  assert.deepEqual(halves.map(h => h.seed), [850310443, 1360916859])
  assert.deepEqual(halves.map(h => [h.p0, h.p1, h.p2, h.p3]), [
    [{ x: 259.11279296875, y: 149.554229736328125 }, { x: 288.01220703125, y: 148.54087829589844 },
      { x: 259.98779296875, y: 201.805328369140625 }, { x: 288.01220703125, y: 200.54087829589844 }],
    [{ x: 123.88500213623047, y: 128.36190795898438 }, { x: 111.98719024658203, y: 147.4457244873047 },
      { x: 140.01280212402344, y: 198.14987182617188 }, { x: 111.98719024658203, y: 199.4457244873047 }],
  ])
  assert.deepEqual(halves.map(h => [h.shadowStart, h.shadowEnd, h.shadowStep, h.shadowCount, h.root]), [
    [{ x: 265.981689453125, y: 201.53488159179688 }, { x: 282.018310546875, y: 200.8113250732422 },
      { x: 7.99186897277832, y: -.3605852425098419 }, 3, { x: 265.981689453125, y: 201.53488159179688 }],
    [{ x: 134.0192108154297, y: 198.427001953125 }, { x: 117.98078918457031, y: 199.16859436035156 },
      { x: -7.991462230682373, y: .3695131540298462 }, 3, { x: 117.98078918457031, y: 199.16859436035156 }],
  ])
})

test('Broken oblique selectors preserve float32 stores and each native painter root', () => {
  const halves = nativeBrokenFenceHalves([{ x: 300, y: 400 }, { x: 500, y: 460 }], 3, 5)
  assert.deepEqual(halves.map(h => h.seed), [324138022, 1831759006])
  assert.deepEqual(halves.map(h => [h.p0, h.p1, h.p2, h.p3]), [
    [{ x: 453.91827392578125, y: 366.2731628417969 }, { x: 489.6762390136719, y: 401.8828430175781 },
      { x: 464.2281188964844, y: 438.8039855957031 }, { x: 489.6762390136719, y: 453.8828430175781 }],
    [{ x: 339.9541320800781, y: 353.4029541015625 }, { x: 311.25201416015625, y: 352.1703796386719 },
      { x: 337.60516357421875, y: 413.93768310546875 }, { x: 311.25201416015625, y: 404.1703796386719 }],
  ])
  assert.deepEqual(halves.map(h => [h.shadowStart, h.shadowEnd, h.shadowStep, h.root]), [
    [{ x: 469.3900146484375, y: 441.8625793457031 }, { x: 484.51434326171875, y: 450.8242492675781 },
      { x: 6.882510662078857, y: 4.078117370605469 }, { x: 484.51434326171875, y: 450.8242492675781 }],
    [{ x: 331.9791564941406, y: 411.8525085449219 }, { x: 316.8780212402344, y: 406.25555419921875 },
      { x: -7.501352310180664, y: -2.7802364826202393 }, { x: 331.9791564941406, y: 411.8525085449219 }],
  ])
})

test('Broken art preserves both affine triangles of the native non-parallelogram quad', () => {
  const half = nativeBrokenFenceHalves([{ x: 100, y: 200 }, { x: 300, y: 200 }])[0]!
  const triangles = nativeQuadCanvasTriangles(half, 100, 80)
  const uv = [[0, 0], [100, 0], [0, 80], [100, 80]]
  const vertices = [half.p0, half.p1, half.p2, half.p3]
  for (const [index, indices] of [[0, [0, 1, 2]], [1, [2, 1, 3]]] as const) {
    const { transform: t, points } = triangles[index]!
    assert.deepEqual(points, indices.map(i => vertices[i]))
    for (const i of indices) {
      const [x, y] = uv[i]!
      assert.ok(Math.abs(t.a * x! + t.c * y! + t.e - vertices[i]!.x) < 1e-10)
      assert.ok(Math.abs(t.b * x! + t.d * y! + t.f - vertices[i]!.y) < 1e-10)
    }
  }
})

test('Broken constructor sees current post selectors but never later source-order overrides', () => {
  const broken: Polyline = { eid: 'broken', typeId: 3005, segmentCode: 1, startPostVariant: 3, endPostVariant: 5,
    points: [{ x: 300, y: 400 }, { x: 500, y: 460 }] }
  const later: Polyline = { eid: 'later', typeId: 3005, segmentCode: 0, startPostVariant: 1,
    points: [{ x: 500, y: 460 }, { x: 700, y: 460 }] }
  const doc = document([broken, later])
  const plan = buildNativeRenderPlan(doc)
  const bodies = plan.shadows.filter(l => l.kind === 'fence' && l.fence === broken && l.part === 'body')
  assert.deepEqual(bodies.map(l => l.kind === 'fence' ? l.brokenHalf?.seed : null), [324138022, 1831759006])
  for (const [index, layer] of bodies.entries()) {
    const caster = nativeBoneyardMainLayerShadowCaster(doc, layer, index)
    assert.equal(caster?.program?.kind, 'fence-grate')
    const program = caster!.program!
    if (program.kind !== 'fence-grate') throw new Error('expected Broken fence program')
    assert.equal(program.construction, 'broken')
    assert.deepEqual(caster!.position, layer.pos)
    const result = nativeBoneyardFenceGrateShadows(program, { baseAlpha: .8, behindScalar: .4,
      direction: { x: 1, y: 0 }, distanceFraction: .2, projectionDistance: 100,
      sourcePosition: { x: 100, y: 400 }, sourceRadius: 1 })
    assert.equal(result.bars.length, 3)
    assert.deepEqual(nativeSceneryShadowPlan(layer, false), [])
  }
})

test('shared Rails post style controls main, flat-mask and directional banks in either source order', () => {
  const grate: Polyline = { eid: 'grate', typeId: 3005, segmentCode: 0, points: [{ x: 0, y: 10 }, { x: 100, y: 20 }] }
  const rails: Polyline = { eid: 'rails', typeId: 3005, segmentCode: 4, points: [{ x: 100, y: 20 }, { x: 200, y: 30 }], startPostVariant: 9 }
  for (const fences of [[grate, rails], [rails, grate]]) {
    const doc = document(fences)
    const layer = buildNativeRenderPlan(doc).shadows.find(l => l.kind === 'fence' && l.part === 'post' && l.pos.x === 100)!
    if (layer.kind !== 'fence') throw new Error('expected post')
    assert.equal(layer.postStyle, 1)
    assert.equal(layer.postVariant, 9)
    assert.equal(nativeSceneryShadowPlan(layer, false)[0]!.texture, 329)
    assert.deepEqual(nativeBoneyardMainLayerShadowCaster(doc, layer, 0)?.outline, nativeFencepostShadowOutline(9, 1))
  }
})

import assert from 'node:assert/strict'
import test, { before, mock } from 'node:test'
import { Container, DOMAdapter, Rectangle, Texture, TextureSource,
  type Mesh, type MeshGeometry, type Shader } from 'pixi.js'

let NativeBoneyardSurfaceView: typeof import('./native-boneyard-surface-view.ts')['NativeBoneyardSurfaceView']
before(async () => {
  // Lifecycle/geometry unit checks only; actual GPU sampling has separate QA.
  const canvas = mock.method(DOMAdapter.get(), 'createCanvas', () => ({ getContext: () => null }))
  try { ({ NativeBoneyardSurfaceView } = await import('./native-boneyard-surface-view.ts')) }
  finally { canvas.mock.restore() }
})

function atlas(): Texture {
  return new Texture({ source: new TextureSource({ width: 2048, height: 2048 }) })
}

test('retains only visible native field quads and reuses geometry within a tile range', () => {
  const parent = new Container()
  const texture = atlas()
  const view = new NativeBoneyardSurfaceView(parent, {
    bounds: { x: 0, y: 0, w: 131072, h: 131072 }, environmentMode: 1, roads: [],
  }, { ground: texture, roads: [] })
  const mesh = view.container.children[0]!
  assert.equal(view.fieldRecord, 11)
  assert.equal(view.groundTileCount, 0)
  assert.equal(mesh.renderable, false)
  view.updateField({ x: 432.40740966796875, y: 1386.3333740234375,
    w: 1185.1851806640625, h: 666.6666259765625 })
  assert.equal(view.groundTileCount, 12)
  assert.equal(view.groundGeometryUpdateCount, 1)
  assert.equal(mesh.renderable, true)
  view.updateField({ x: 433, y: 1387, w: 1185, h: 666 })
  assert.equal(view.groundGeometryUpdateCount, 1)
  view.updateField({ x: 700, y: 1400, w: 350, h: 350 })
  assert.equal(view.groundTileCount, 1)
  assert.equal(view.groundGeometryUpdateCount, 2)
  view.updateField({ x: -700, y: -700, w: 100, h: 100 })
  assert.equal(view.groundTileCount, 0)
  assert.equal(mesh.renderable, false)
  view.destroy()
  assert.equal(parent.children.length, 0)
  assert.equal(mesh.destroyed, true)
  assert.equal(texture.destroyed, false)
  assert.equal(texture.source.destroyed, false)
  texture.destroy(true)
  parent.destroy()
})

test('uses all scene-mode branches and keeps full final tiles beyond authored endpoints', () => {
  for (const [mode, record] of [[0, 12], [1, 11], [2, 11], [255, 12]] as const) {
    const parent = new Container()
    const texture = atlas()
    const view = new NativeBoneyardSurfaceView(parent, {
      bounds: { x: -100, y: -200, w: 351, h: 351 }, environmentMode: mode, roads: [],
    }, { ground: texture, roads: [] })
    assert.equal(view.fieldRecord, record)
    view.updateField({ x: 251, y: 151, w: 349, h: 349 })
    assert.equal(view.groundTileCount, 1)
    view.updateField({ x: 600, y: 500, w: 1, h: 1 })
    assert.equal(view.groundTileCount, 0)
    view.destroy()
    texture.destroy(true)
    parent.destroy()
  }
})

test('rejects cropped frames instead of applying full-atlas UVs twice', () => {
  const parent = new Container()
  const texture = atlas()
  const cropped = new Texture({ source: texture.source, frame: new Rectangle(778, 859, 350, 350) })
  assert.throws(() => new NativeBoneyardSurfaceView(parent, {
    bounds: { x: 0, y: 0, w: 350, h: 350 }, environmentMode: 1, roads: [],
  }, { ground: cropped, roads: [] }), /original full atlas page/)
  assert.equal(parent.children.length, 0)
  cropped.destroy(false)
  texture.destroy(true)
  parent.destroy()
})

test('rejects every frame and source dimension mismatch before attaching a field', () => {
  for (const [x, y, width, height, sourceWidth, sourceHeight] of [
    [1, 0, 2048, 2048, 2048, 2048], [0, 1, 2048, 2048, 2048, 2048],
    [0, 0, 2047, 2048, 2048, 2048], [0, 0, 2048, 2047, 2048, 2048],
    [0, 0, 2048, 2048, 2047, 2048], [0, 0, 2048, 2048, 2048, 2047],
  ] as const) {
    const parent = new Container()
    const texture = new Texture({
      source: new TextureSource({ width: sourceWidth, height: sourceHeight }),
      frame: new Rectangle(x, y, width, height),
    })
    assert.throws(() => new NativeBoneyardSurfaceView(parent, {
      bounds: { x: 0, y: 0, w: 350, h: 350 }, environmentMode: 0, roads: [],
    }, { ground: texture, roads: [] }), /original full atlas page/)
    assert.equal(parent.children.length, 0)
    assert.equal(texture.source.destroyed, false)
    texture.destroy(true)
    parent.destroy()
  }
})

test('refreshes each independent visible-range edge without uploading unchanged ranges', () => {
  const parent = new Container()
  const texture = atlas()
  const view = new NativeBoneyardSurfaceView(parent, {
    bounds: { x: 0, y: 0, w: 1400, h: 1400 }, environmentMode: 1, roads: [],
  }, { ground: texture, roads: [] })
  for (const [i, visible] of [
    { x: 1, y: 1, w: 10, h: 10 },
    { x: 1, y: 1, w: 400, h: 10 },
    { x: 351, y: 1, w: 10, h: 10 },
    { x: 351, y: 1, w: 10, h: 400 },
    { x: 351, y: 351, w: 10, h: 10 },
  ].entries()) {
    view.updateField(visible)
    assert.equal(view.groundGeometryUpdateCount, i + 1)
    view.updateField(visible)
    assert.equal(view.groundGeometryUpdateCount, i + 1)
  }
  view.destroy()
  texture.destroy(true)
  parent.destroy()
})

test('refreshes the complete CPU affine after ancestor changes and bypasses unsupported coverage', () => {
  const stage = new Container({ isRenderGroup: true })
  const parent = new Container()
  stage.addChild(parent)
  const texture = atlas()
  const view = new NativeBoneyardSurfaceView(parent, {
    bounds: { x: 0, y: 0, w: 700, h: 700 }, environmentMode: 1, roads: [],
  }, { ground: texture, roads: [] })
  view.updateField({ x: 0, y: 0, w: 400, h: 400 })
  const mesh = view.container.children[0] as Mesh<MeshGeometry, Shader>
  const uniforms = mesh.shader!.resources.fieldCoverageUniforms.uniforms
  assert.equal(uniforms.uFieldCoverageEnabled, 0, 'unprepared targets keep ordinary material coverage')
  stage.scale.set(2)
  stage.position.set(3, 5)
  parent.scale.set(0.5)
  parent.position.set(7, -11)
  view.container.scale.set(1.5)
  view.container.position.set(0.1, 0.2)
  assert.equal(view.prepareFieldRender(2.5), true)
  const affine = uniforms.uFieldPhysicalAffine
  assert.equal(affine.a, 3.75)
  assert.equal(affine.d, 3.75)
  assert.equal(affine.b, 0)
  assert.equal(affine.c, 0)
  assert.equal(affine.tx, 42.75)
  assert.equal(affine.ty, -42)
  parent.position.x += 1
  assert.equal(view.prepareFieldRender(25 / 12), true)
  assert.equal(affine.tx, (19 + 0.1) * (25 / 12), 'fresh parents and target density need no prior render')
  assert.equal(uniforms.uFieldPhysicalAffine, affine, 'uniform matrix is retained')
  for (const density of [0, -1, Infinity, NaN, Number.MAX_VALUE]) {
    assert.equal(view.prepareFieldRender(density), false)
    assert.equal(uniforms.uFieldCoverageEnabled, 0)
    assert.equal(affine.a, 1, 'disabled coverage never uploads nonfinite affine operands')
  }
  parent.rotation = 0.1
  assert.equal(view.prepareFieldRender(2), false)
  parent.rotation = 0
  parent.skew.x = 0.1
  assert.equal(view.prepareFieldRender(2), false)
  parent.skew.x = 0
  parent.scale.x = -0.5
  assert.equal(view.prepareFieldRender(2), false)
  parent.scale.x = 0.5
  assert.equal(view.prepareFieldRender(2), true)
  texture.frame.x = 1
  texture.updateUvs()
  assert.equal(view.prepareFieldRender(2), false)
  texture.frame.x = 0
  texture.updateUvs()
  assert.equal(view.prepareFieldRender(2), true)
  mesh.roundPixels = true
  assert.equal(view.prepareFieldRender(2), false)
  mesh.roundPixels = false
  assert.equal(view.prepareFieldRender(2), true)
  view.destroy()
  texture.destroy(true)
  stage.destroy({ children: true })
})

test('retains UV slopes across unchanged ranges and destroys owned buffers without the borrowed atlas', () => {
  const parent = new Container()
  const texture = atlas()
  const view = new NativeBoneyardSurfaceView(parent, {
    bounds: { x: -0.1, y: 0.1, w: 700, h: 700 }, environmentMode: 0, roads: [],
  }, { ground: texture, roads: [] })
  const mesh = view.container.children[0] as Mesh<MeshGeometry, Shader>
  const geometry = mesh.geometry
  const slope = geometry.getBuffer('aFieldUvPerWorld')
  const shader = mesh.shader
  const visible = { x: 1, y: 1, w: 10, h: 10 }
  view.updateField(visible)
  const positions = geometry.getBuffer('aPosition').data
  const uvs = geometry.getBuffer('aUV').data
  const values = slope.data
  const du = Math.fround((uvs[2]! - uvs[0]!) / (positions[2]! - positions[0]!))
  const dv = Math.fround((uvs[5]! - uvs[1]!) / (positions[5]! - positions[1]!))
  assert.deepEqual(Array.from(values), [du, dv, du, dv, du, dv, du, dv])
  view.updateField(visible)
  view.prepareFieldRender(2.5)
  view.prepareFieldRender(2)
  assert.equal(slope.data, values, 'camera density updates never rewrite geometry')
  view.updateField({ x: -1000, y: -1000, w: 1, h: 1 })
  assert.equal(slope.data.length, 0)
  view.updateField(visible)
  assert.equal(geometry.getBuffer('aFieldUvPerWorld'), slope)
  assert.equal(mesh.shader, shader)
  view.destroy()
  assert.equal(slope.destroyed, true)
  assert.equal(geometry.buffers, null)
  assert.equal(texture.destroyed, false)
  assert.equal(texture.source.destroyed, false)
  texture.destroy(true)
  parent.destroy()
})

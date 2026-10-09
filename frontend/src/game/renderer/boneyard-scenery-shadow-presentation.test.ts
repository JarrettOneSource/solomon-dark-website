import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Container, MeshSimple, Sprite, Texture } from 'pixi.js'
import type { MainLayer } from '../../editor/native-render-plan.ts'
import type { BoneyardGoodieSnapshot } from '../protocol/game-state.ts'
import type { ResidentTexture } from './boneyard-renderer-model.ts'
import { BoneyardComplexShadowPresentation } from './boneyard-complex-shadow-presentation.ts'
import { BoneyardSceneryShadowPresentation } from './boneyard-scenery-shadow-presentation.ts'
import { nativeGoodieShadowOutline } from './boneyard-native-shadow-shapes.ts'
import { nativeGoodieShadowPlan } from './native-scenery-shadow.ts'
import { nativePackedColor } from './native-material-batch.ts'

function resident(sprite: Sprite, index = 0): ResidentTexture {
  return { cleanupSourceKey: 'object:tree', h: 271, w: 204, x: 0, y: 0, mainLayerIndex: index,
    pixels: new Uint8ClampedArray(0), shadowCaster: null, surfaceMesh: null, texture: Texture.WHITE, sprite }
}

function treeLayer(): MainLayer {
  const object = { eid: 'tree', typeId: 2001, variant: 0, secondaryVariant: 0,
    secondaryVisible: true, pos: { x: 200, y: 300 } }
  return { kind: 'object', object, atlas: 'DeadHawg', atlasEntry: 264, pos: object.pos,
    sel: { kind: 'object', eid: object.eid }, worldY: 300, sortBias: 0, sortKey: 300, sourceOrder: 0 }
}

const sources = [{ position: { x: 120, y: 300 }, radius: 1, intensity: 1, castsDirectionalShadow: true }]

function chest(id = 9): BoneyardGoodieSnapshot {
  return { id, phase: 0, position: { x: 200, y: 300 }, active: false, exhausted: false,
    sceneryRegistrationOrdinal: id, subtype: 0, timer: 0 }
}

function chestMesh(owner: Container): MeshSimple {
  const parent = owner.parent!
  return parent.children[parent.getChildIndex(owner) - 1]!.children[0] as MeshSimple
}

function chestBuffers(mesh: MeshSimple) {
  return ['aPosition', 'aUV', 'aColor'].map(name => mesh.geometry.getBuffer(name))
}

function assertChestGeometry(mesh: MeshSimple, goodie: BoneyardGoodieSnapshot): void {
  const quad = nativeGoodieShadowPlan(goodie, false)[0]!
  assert.deepEqual([...mesh.geometry.getBuffer('aPosition').data],
    quad.vertices.flatMap(point => [point.x, point.y]))
  assert.deepEqual([...mesh.geometry.getBuffer('aUV').data],
    quad.uvs.flatMap(point => [point.x, point.y]))
  assert.deepEqual([...mesh.geometry.getBuffer('aColor').data],
    quad.alphas.map(alpha => nativePackedColor(quad.tint, alpha)))
  assert.equal(mesh.label, `scenery-flat-shadow:${145 + goodie.phase}`)
}

test('unchanged live chest glyphs retain buffer revisions across fresh equal-valued snapshots', () => {
  const root = new Container(), owner = new Container({ label: 'goodie:9' })
  root.addChild(owner)
  const masks = new BoneyardSceneryShadowPresentation([], new Map(), [], () => Texture.WHITE)
  try {
    masks.render([], false, [{ goodie: chest(), depthOwner: owner }])
    const mesh = chestMesh(owner), buffers = chestBuffers(mesh)
    const revisions = buffers.map(buffer => buffer._updateID)
    const arrays = buffers.map(buffer => buffer.data)
    for (let frame = 0; frame < 240; frame += 1) {
      const goodie = { ...chest(), active: frame % 2 === 0, timer: frame }
      const receipt = masks.render([], false, [{ goodie, depthOwner: owner }])
      assert.equal(receipt.quadCount, 1)
      assert.equal(receipt.zOrderMismatchCount, 0)
      assert.strictEqual(chestMesh(owner), mesh)
      assert.deepEqual(chestBuffers(mesh).map(buffer => buffer._updateID), revisions)
      chestBuffers(mesh).forEach((buffer, index) => {
        assert.strictEqual(buffer, buffers[index])
        assert.strictEqual(buffer.data, arrays[index])
      })
      assertChestGeometry(mesh, goodie)
    }
  } finally {
    masks.destroy()
    root.destroy({ children: true })
  }
})

test('live chest glyph cache invalidates each native phase and position coordinate exactly once', () => {
  const root = new Container(), owner = new Container({ label: 'goodie:9' })
  root.addChild(owner)
  const masks = new BoneyardSceneryShadowPresentation([], new Map(), [], () => Texture.WHITE)
  try {
    let goodie = chest()
    masks.render([], false, [{ goodie, depthOwner: owner }])
    const mesh = chestMesh(owner), buffers = chestBuffers(mesh)
    let revisions = buffers.map(buffer => buffer._updateID)
    const states: BoneyardGoodieSnapshot[] = [
      { ...goodie, phase: 1 }, { ...goodie, phase: 2 },
      { ...goodie, phase: 2, position: { x: 200.25, y: 300 } },
      { ...goodie, phase: 2, position: { x: 200.25, y: 300.5 } },
      { ...goodie, phase: 0, position: { x: 200.25, y: 300.5 } },
    ]
    for (goodie of states) {
      masks.render([], false, [{ goodie, depthOwner: owner }])
      assert.strictEqual(chestMesh(owner), mesh)
      assert.deepEqual(buffers.map(buffer => buffer._updateID), revisions.map(value => value + 1))
      assertChestGeometry(mesh, goodie)
      revisions = buffers.map(buffer => buffer._updateID)
      masks.render([], false, [{ goodie: { ...goodie, position: { ...goodie.position } }, depthOwner: owner }])
      assert.deepEqual(buffers.map(buffer => buffer._updateID), revisions)
    }
  } finally {
    masks.destroy()
    root.destroy({ children: true })
  }
})

test('chest cache follows live owner, pooled-view, settings, culling and nested-parent lifetimes', () => {
  const root = new Container(), nested = new Container(), owner = new Container({ label: 'goodie:9' })
  const peer = new Container({ label: 'equal-depth-peer' })
  root.addChild(owner, peer, nested)
  const masks = new BoneyardSceneryShadowPresentation([], new Map(), [], () => Texture.WHITE)
  try {
    let goodie = chest()
    masks.render([], false, [{ goodie, depthOwner: owner }])
    const mesh = chestMesh(owner), buffers = chestBuffers(mesh)
    const revisions = buffers.map(buffer => buffer._updateID)
    nested.addChild(owner)
    owner.zIndex = 4
    const reparented = masks.render([], false, [{ goodie, depthOwner: owner }])
    assert.equal(reparented.zOrderMismatchCount, 0)
    assert.strictEqual(chestMesh(owner), mesh)
    assert.equal(nested.children[0]!.zIndex, 4)
    assert.deepEqual(buffers.map(buffer => buffer._updateID), revisions)
    for (const mode of ['settings', 'culling', 'removal'] as const) {
      if (mode === 'culling') owner.renderable = false
      const hidden = masks.render([], mode === 'settings', mode === 'removal' ? [] : [{ goodie, depthOwner: owner }])
      assert.equal(hidden.activeMeshCount, 0)
      assert.deepEqual(nested.children, [owner])
      for (const retained of Object.values(masks)) {
        if (retained instanceof Map || retained instanceof Set) assert.equal(retained.has(owner), false)
      }
      owner.renderable = true
      goodie = { ...goodie, position: { x: goodie.position.x + 11, y: goodie.position.y + 7 } }
      assert.equal(masks.render([], false, [{ goodie, depthOwner: owner }]).zOrderMismatchCount, 0)
      assertChestGeometry(chestMesh(owner), goodie)
    }
    masks.render([], false, [])
    owner.removeFromParent()
    const replacement = new Container({ label: 'goodie:9' })
    nested.addChild(replacement)
    const fresh = { ...chest(), position: { x: 600, y: 500 }, phase: 2 as const }
    masks.render([], false, [{ goodie: fresh, depthOwner: replacement }])
    assert.strictEqual(chestMesh(replacement), mesh)
    assertChestGeometry(mesh, fresh)
    assert.equal(masks.render([], false, [{ goodie: fresh, depthOwner: replacement }]).zOrderMismatchCount, 0)
    owner.destroy()
    masks.destroy()
    assert.ok(buffers.every(buffer => buffer.destroyed))
    assert.equal(Texture.WHITE.destroyed, false)
  } finally {
    masks.destroy()
    root.destroy({ children: true })
  }
})

test('a released chest view can paint a static Tree mask and return without a stale Goodie key', () => {
  const root = new Container(), owner = new Container({ label: 'goodie:9' })
  const tree = new Sprite(Texture.WHITE)
  tree.label = 'tree'
  root.addChild(owner, tree)
  const masks = new BoneyardSceneryShadowPresentation([treeLayer()],
    new Map([[0, resident(tree)]]), [], () => Texture.WHITE)
  try {
    masks.render([], false, [{ goodie: chest(), depthOwner: owner }])
    const mesh = chestMesh(owner), buffers = chestBuffers(mesh)
    masks.render([], false, [])
    masks.render([tree], true, [])
    const treeMask = root.children[root.getChildIndex(tree) - 1]!.children[0]
    assert.strictEqual(treeMask, mesh)
    assert.match(mesh.label, /^tree-root-mask:/)
    masks.render([], true, [])
    masks.render([], false, [{ goodie: chest(), depthOwner: owner }])
    assert.strictEqual(chestMesh(owner), mesh)
    assertChestGeometry(mesh, chest())
    const revisions = buffers.map(buffer => buffer._updateID)
    masks.render([], false, [{ goodie: chest(), depthOwner: owner }])
    assert.deepEqual(buffers.map(buffer => buffer._updateID), revisions)
    assert.deepEqual(root.children.filter(child => child.label.startsWith('scenery-shadow:')),
      [root.children[root.getChildIndex(owner) - 1]])
  } finally {
    masks.destroy()
    root.destroy({ children: true })
  }
})

test('cached Goodie subtype zero never masks unsupported native subtype errors in either shadow mode', () => {
  const root = new Container(), owner = new Container({ label: 'goodie:9' })
  root.addChild(owner)
  const masks = new BoneyardSceneryShadowPresentation([], new Map(), [], () => Texture.WHITE)
  try {
    masks.render([], false, [{ goodie: chest(), depthOwner: owner }])
    for (const complexShadows of [false, true]) {
      for (const subtype of [-1, 1, 2, Number.NaN]) {
        assert.throws(() => masks.render([], complexShadows,
          [{ goodie: { ...chest(), subtype }, depthOwner: owner }]),
        { name: 'RangeError', message: `Unsupported native Goodie shadow subtype ${subtype}.` })
      }
    }
    assert.equal(masks.render([], false, [{ goodie: chest(), depthOwner: owner }]).quadCount, 1)
  } finally {
    masks.destroy()
    root.destroy({ children: true })
  }
})

test('default-on chest lifetimes leave no retained owner references after removal', () => {
  const root = new Container()
  const masks = new BoneyardSceneryShadowPresentation([], new Map(), [], () => Texture.WHITE)
  try {
    for (let id = 0; id < 32; id += 1) {
      const owner = new Container({ label: `goodie:${id}` })
      root.addChild(owner)
      const goodie: BoneyardGoodieSnapshot = { id, phase: 0, position: { x: 200, y: 300 },
        active: false, exhausted: false, sceneryRegistrationOrdinal: 1, subtype: 0, timer: 0 }
      assert.equal(masks.render([], true, [{ goodie, depthOwner: owner }]).quadCount, 0)
      owner.removeFromParent()
      masks.render([], true, [])
      for (const retained of Object.values(masks)) {
        if (retained instanceof Map || retained instanceof Set) assert.equal(retained.has(owner), false)
      }
      owner.destroy()
    }
  } finally {
    masks.destroy()
    root.destroy()
  }
})

test('Tree mask is retained through on/off/on, independent of owner fade, and culled/reactivated without stale roots', () => {
  const root = new Container()
  const sprite = new Sprite(Texture.WHITE)
  sprite.label = 'tree'
  sprite.zIndex = 7
  root.addChild(sprite)
  const view = new BoneyardSceneryShadowPresentation([treeLayer()], new Map([[0, resident(sprite)]]), [], () => Texture.WHITE)
  try {
    assert.equal(view.render([sprite], true, []).quadCount, 1)
    const shadow = root.children[0]!
    assert.equal(shadow.zIndex, sprite.zIndex)
    const first = shadow.children[0]!
    sprite.alpha = .4
    sprite.tint = 0x555555
    assert.equal(view.render([sprite], false, []).quadCount, 3)
    assert.equal(root.children[0], shadow)
    assert.equal(shadow.children[0], first)
    assert.equal(shadow.alpha, 1)
    assert.equal(shadow.tint, 0xffffff)
    assert.equal(view.render([sprite], true, []).quadCount, 1)
    assert.equal(shadow.children.filter(child => child.renderable).length, 1)
    assert.equal(view.render([], true, []).activeMeshCount, 0)
    assert.deepEqual(root.children, [sprite])
    assert.equal(view.render([sprite], true, []).zOrderMismatchCount, 0)
    assert.equal(root.children[0], shadow)
    sprite.removeFromParent()
    assert.equal(view.render([sprite], true, []).quadCount, 0)
    assert.equal(root.children.length, 0)
  } finally {
    view.destroy()
    root.destroy({ children: true })
  }
})

test('live chest phase, position and removal own both native shadow branches at the actual painter slot', () => {
  const root = new Container()
  const owner = new Container({ label: 'goodie:9' })
  owner.zIndex = 9
  root.addChild(owner)
  const masks = new BoneyardSceneryShadowPresentation([], new Map(), [], () => Texture.WHITE)
  const complex = new BoneyardComplexShadowPresentation(root, [])
  const goodie: BoneyardGoodieSnapshot = { id: 9, phase: 0, position: { x: 200, y: 300 },
    active: false, exhausted: false, sceneryRegistrationOrdinal: 1, subtype: 0, timer: 0 }
  const dynamic = [{ depthOwner: owner, caster: { id: 'goodie:9', position: goodie.position, outline: nativeGoodieShadowOutline(0) } }]
  let ownedBuffers: Array<{ destroyed: boolean }> = []
  try {
    for (const phase of [0, 1, 2] as const) {
      goodie.phase = phase
      const glyph = masks.render([], false, [{ goodie, depthOwner: owner }])
      complex.render(sources, 0, [], new Map(), [], false, dynamic)
      assert.equal(glyph.quadCount, 1)
      assert.equal(glyph.goodies[0]!.phase, phase)
      assert.equal(root.children.at(-2)!.children[0]!.label, `scenery-flat-shadow:${145 + phase}`)
      const on = masks.render([], true, [{ goodie, depthOwner: owner }])
      const projection = complex.render(sources, 0, [], new Map(), [], true, dynamic)
      assert.equal(on.quadCount, 0)
      assert.equal(projection.casterCount, 1)
      assert.equal(projection.zOrderMismatchCount, 0)
      assert.equal(root.children.at(-2)!.label, 'complex-shadow:goodie:9')
    }
    const mesh = root.children.at(-2) as MeshSimple
    ownedBuffers = mesh.geometry.buffers
    assert.equal(complex.render(sources, 0, [], new Map(), [], true, []).quadCount, 0)
    masks.render([], false, [])
    assert.deepEqual(root.children, [owner])
  } finally {
    masks.destroy()
    complex.destroy()
    assert.ok(ownedBuffers.every(buffer => buffer.destroyed))
    assert.equal(Texture.WHITE.destroyed, false)
    root.destroy({ children: true })
  }
})

test('Wall skirt and directional mesh use actual nested pre-main parent with stable equal-depth order', () => {
  const world = new Container(), base = new Container(), owner = new Sprite(Texture.WHITE)
  world.addChild(base)
  base.addChild(owner)
  owner.zIndex = 3
  const wall = { depthOwner: owner, caster: { id: 'wall', position: { x: 200, y: 300 }, outline: [],
    program: { kind: 'wall' as const, start: { x: 160, y: 300 }, end: { x: 240, y: 300 } } } }
  const masks = new BoneyardSceneryShadowPresentation([], new Map(), [wall], () => Texture.WHITE)
  const complex = new BoneyardComplexShadowPresentation(world, [wall])
  try {
    for (const enabled of [true, false, true]) {
      assert.equal(masks.render([owner], enabled, []).quadCount, 1)
      const frame = complex.render(sources, 0, [], new Map(), [owner], enabled)
      assert.equal(frame.quadCount, enabled ? 1 : 0)
      assert.equal(frame.zOrderMismatchCount, 0)
      assert.equal(base.children.length, enabled ? 3 : 2)
      assert.equal(base.children[0]!.label, 'scenery-shadow:Wall:Sprite')
      assert.equal(base.children.at(-1), owner)
      assert.ok(base.children.every(child => child.zIndex === owner.zIndex))
    }
    owner.renderable = false
    masks.render([owner], true, [])
    complex.render(sources, 0, [], new Map(), [owner], true)
    assert.deepEqual(base.children, [owner])
  } finally {
    masks.destroy()
    complex.destroy()
    world.destroy({ children: true })
  }
})

test('runtime base omits only editor shadow pass while preserving underlays and cleanup repaint', () => {
  const source = readFileSync(new URL('../../editor/render.ts', import.meta.url), 'utf8')
  const shadow = source.indexOf('for (const item of scene.shadows)')
  const main = source.indexOf('for (const item of scene.main)', shadow)
  assert.match(source.slice(shadow, main), /if \(mode === 'runtime-base'\) continue/)
  assert.match(source.slice(source.indexOf('function paintPlacementPasses'), shadow), /drawSprite\(ctx, drawable/)
})

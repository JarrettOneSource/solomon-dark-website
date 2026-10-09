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

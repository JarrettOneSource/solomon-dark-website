import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Container, DOMAdapter, Mesh, Sprite, Texture } from 'pixi.js'
import { createServer, type ViteDevServer } from 'vite'
import type { BoneyardEnemyDeathEffectSnapshot } from '../protocol/game-state.ts'
import type { BoneyardWorldTextures } from './boneyard-textures.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import { nativeEnemyDeathEffectIsBanish, nativeEnemyDeathEffectPlan, nativeEnemyDeathEffectViewResourcePlan } from './native-enemy-death-effect-presentation.ts'

const kinds: Record<BoneyardEnemyDeathEffectSnapshot['kind'], true> = {
  banish: true, 'banish-black': true, bouncer: true, 'smoky-bouncer': true,
  crow: true, fade: true, 'fade-additive': true,
  'fade-perspective': true, 'fade-perspective-clipped': true,
  'fade-scale-perspective': true, 'fade-scale': true, 'fire-array': true,
  'late-splat': true, 'move-fade': true, 'move-fade-perspective': true,
  'move-fade-sin': true, 'sprite-array': true, unbind: true, scrap: true,
}
const lanes: Record<BoneyardEnemyDeathEffectSnapshot['presentationOwner'], true> = {
  background: true, 'direct-post-world': true, 'pre-world-queue': true,
  'world-sorted': true, 'late-world-overlay': true,
}
const inside = { x: -1000, y: -1000, w: 2000, h: 2000 }
const outside = { ...inside, x: 10000 }
const textures = { base: Object.fromEntries([1, 15, 333, 334, 335, 336].map(entry => [
  nativeEnemySpriteRecord('BadGuys', entry).source, Texture.EMPTY,
])) } as BoneyardWorldTextures
let server: ViteDevServer
let module: typeof import('./native-enemy-death-effect-view.ts')
before(async () => {
  server = await createServer({ appType: 'custom', logLevel: 'silent',
    root: fileURLToPath(new URL('../../../', import.meta.url)), server: { middlewareMode: true } })
  module = await server.ssrLoadModule('/src/game/renderer/native-enemy-death-effect-view.ts') as typeof module
})
after(async () => { await server?.close() })

test('nonbatched death-effect families retain painter order and defer unseen child resources', t => {
  t.mock.method(DOMAdapter.get(), 'createCanvas', (width: number, height: number) => ({
    width, height, getContext: () => ({
      createLinearGradient: () => ({ addColorStop() {} }), clearRect() {}, fillRect() {},
    }),
  }))
  for (const kind of Object.keys(kinds) as BoneyardEnemyDeathEffectSnapshot['kind'][]) {
    for (const shadow of [false, true]) {
      for (const lane of Object.keys(lanes) as BoneyardEnemyDeathEffectSnapshot['presentationOwner'][]) {
        if (lane === 'world-sorted' && !shadow && !nativeEnemyDeathEffectIsBanish(kind)) continue
        const root = new Container(), preWorld = new Container()
        const views = new module.NativeEnemyDeathEffectViews(root, textures, preWorld)
        const effect = fixture(kind, shadow, lane)
        try {
          views.update([effect], outside, 900)
          assert.equal(views.size, 1, `${kind}: logical membership retained`)
          assert.equal(views.visibleSize, 0)
          const initialContainer = [...root.children, ...preWorld.children][0]!
          assert.equal(root.children.length + preWorld.children.length, 1, `${kind}: painter position retained`)
          assert.equal(initialContainer.children.length, 0, `${kind}: unseen child allocation`)
          views.setDepth(effect.id, 17.25)
          views.setRenderable(false)
          const later = { ...effect, ageTicks: 25, alpha: 0.4, rotationRadians: 0.5, scale: 2, scaleY: 3 }
          views.update([later], inside, 900)
          const expectedRoot = lane === 'background' || lane === 'pre-world-queue' ? preWorld : root
          const otherRoot = expectedRoot === root ? preWorld : root
          assert.equal(expectedRoot.children.length, 1)
          assert.equal(otherRoot.children.length, 0)
          const container = expectedRoot.children[0]!
          assert.equal(container, initialContainer)
          const children = [...container.children]
          assert.equal(children.length, nativeEnemyDeathEffectViewResourcePlan(later).childCount)
          const direct = !shadow && !nativeEnemyDeathEffectIsBanish(kind)
          assert.equal(container.zIndex, 17.25)
          assert.equal(container.x, later.position.x)
          assert.equal(container.y, later.position.y + (direct ? later.height : 0))
          assert.equal(container.renderable, true)
          if (!nativeEnemyDeathEffectIsBanish(kind)) {
            const sprite = direct ? container : container.children[shadow ? 1 : 0]
            assert.ok(sprite instanceof Sprite)
            assert.equal(sprite.alpha, 0.4, 'first visible sample uses current alpha, not birth')
            assert.equal(sprite.rotation, 0.5)
            const plan = nativeEnemyDeathEffectPlan(later)
            if (kind === 'fade-scale') assert.equal(plan.effect.scale.y, later.scale)
            if (kind === 'fade-scale-perspective') assert.equal(plan.effect.scale.y, later.scaleY * .75)
            for (const [index, layer] of (shadow ? [plan.shadow!, plan.effect] : [plan.effect]).entries()) {
              const child = direct ? container : container.children[index]
              assert.ok(child instanceof Sprite)
              assert.equal(child.x, layer.offset.x + (direct ? later.position.x : 0))
              assert.equal(child.y, layer.offset.y + (direct ? later.position.y : 0))
              assert.equal(child.scale.x, layer.scale.x)
              assert.equal(child.scale.y, layer.scale.y)
              assert.equal(child.alpha, layer.alpha)
              assert.equal(child.tint, layer.tint)
              assert.equal(child.blendMode, layer.blendMode)
            }
          }
          views.update([later], outside, 900)
          assert.equal(container.renderable, false)
          views.update([{ ...later, ageTicks: 26 }], inside, 900)
          assert.equal(expectedRoot.children[0], container, 'offscreen/reentry keeps allocated resources')
          assert.deepEqual(container.children, children)
          views.update([], inside, 900)
          assert.equal(views.size, 0)
          assert.equal(container.destroyed, true)
          assert.equal(expectedRoot.children.length, 0)
        } finally { views.destroy(); root.destroy(); preWorld.destroy() }
      }
    }
  }
})

test('never-visible effects retire without sprite allocation and still reject changed identity resources', () => {
  const root = new Container(), preWorld = new Container()
  const views = new module.NativeEnemyDeathEffectViews(root, textures, preWorld)
  const effect = fixture('fade', false, 'world-sorted')
  try {
    views.update([effect], outside, 900)
    assert.throws(() => views.update([{ ...effect, kind: 'bouncer' }], outside, 900), /changed retained view resources/)
    assert.throws(() => views.update([{ ...effect, shadow: true }], outside, 900), /changed retained view resources/)
    views.update([], outside, 900)
    assert.equal(views.size, 0)
    assert.equal(root.children.length + preWorld.children.length, 0)
  } finally { views.destroy(); root.destroy(); preWorld.destroy() }
})

test('equal-depth background painters keep birth insertion order across deferred child creation', () => {
  const root = new Container(), preWorld = new Container({ sortableChildren: true })
  const views = new module.NativeEnemyDeathEffectViews(root, textures, preWorld)
  const first = { ...fixture('fade', false, 'background'), position: { x: 10000, y: 10000 } }
  const second = { ...fixture('fade', false, 'background'), id: 2 }
  try {
    views.update([first, second], inside, 900)
    const originalOrder = [...preWorld.children]
    assert.ok(originalOrder.every(row => row instanceof Sprite && row.children.length === 0))
    views.setDepth(1, 0); views.setDepth(2, 0)
    views.update([{ ...first, position: second.position }, second], inside, 900)
    preWorld.sortChildren()
    assert.deepEqual(preWorld.children, originalOrder)
    assert.ok(preWorld.children.every(row => row instanceof Sprite && row.children.length === 0))
  } finally { views.destroy(); root.destroy(); preWorld.destroy() }
})

test('mixed retirement preserves unrelated painters and surviving resources in both roots', () => {
  const root = new Container({ sortableChildren: true }), preWorld = new Container({ sortableChildren: true })
  const worldPainter = new Container({ label: 'unrelated-world', zIndex: 3 })
  const preWorldPainter = new Container({ label: 'unrelated-background', zIndex: 3 })
  root.addChild(worldPainter); preWorld.addChild(preWorldPainter)
  const views = new module.NativeEnemyDeathEffectViews(root, textures, preWorld)
  const effects = Array.from({ length: 2048 }, (_, index) => ({
    ...fixture('fade', true, index % 2 === 0 ? 'world-sorted' : 'background'), id: index + 1,
  }))
  try {
    views.update(effects, inside, 900)
    for (const effect of effects) views.setDepth(effect.id, 7 - effect.id)
    root.sortChildren(); preWorld.sortChildren()
    const original = [root, preWorld].map(parent => [...parent.children])
    const retainedIds = new Set([2, 5, 6])
    const expired = new Set(original.flat().filter(child => (
      effects.some(effect => !retainedIds.has(effect.id) && child.label.endsWith(`:${effect.id}`))
    )))
    const resources = new Map(original.flat().map(child => [child, [...child.children]]))
    views.update(effects.filter(effect => retainedIds.has(effect.id)), inside, 900)
    assert.equal(views.size, retainedIds.size)
    for (const [index, parent] of [root, preWorld].entries()) {
      assert.deepEqual(parent.children, original[index]!.filter(child => !expired.has(child)))
      for (const child of parent.children) {
        assert.equal(child.parent, parent)
        assert.equal(child.destroyed, false)
        assert.deepEqual(child.children, resources.get(child))
        for (const resource of child.children) assert.equal(resource.destroyed, false)
      }
    }
    for (const child of expired) {
      assert.equal(child.parent, null)
      assert.equal(child.destroyed, true)
      for (const resource of resources.get(child)!) assert.equal(resource.destroyed, true)
    }
    views.destroy()
    assert.deepEqual(root.children, [worldPainter])
    assert.deepEqual(preWorld.children, [preWorldPainter])
  } finally { views.destroy(); root.destroy({ children: true }); preWorld.destroy({ children: true }) }
})

function fixture(kind: BoneyardEnemyDeathEffectSnapshot['kind'], shadow: boolean,
  presentationOwner: BoneyardEnemyDeathEffectSnapshot['presentationOwner']): BoneyardEnemyDeathEffectSnapshot {
  return { ageTicks: 0, alpha: 1, atlas: 'BadGuys', blendMode: 'add', entry: 1,
    height: 5, id: 1, kind, ownerActorId: 1,
    painterRegistration: { managerLane: 'transient', registrationOrdinal: 1 },
    presentationOwner, position: { x: 10, y: 20 }, rotationRadians: 0,
    scale: 1, scaleY: 1, shadow, spawnTick: 100, tint: 0xffffff }
}

test('unshadowed Faculty smoke has one retained drawable with exact placement and painter order', () => {
  const root = new Container(), preWorld = new Container({ sortableChildren: true })
  const views = new module.NativeEnemyDeathEffectViews(root, textures, preWorld)
  const first = { ...fixture('fade', false, 'pre-world-queue'), position: { x: 40, y: 50 } }
  const second = { ...first, id: 2, position: { x: 70, y: 80 } }
  try {
    views.update([first, second], inside, 900)
    views.setDepth(1, 7); views.setDepth(2, 7)
    preWorld.sortChildren()
    const originalOrder = [...preWorld.children]
    assert.equal(root.children.length, 0)
    assert.equal(originalOrder.length, 2)
    assert.ok(originalOrder.every(child => child instanceof Sprite && child.children.length === 0))
    assert.deepEqual(originalOrder.map(child => ({ x: child.x, y: child.y })), [
      { x: 40, y: 55 }, { x: 70, y: 85 },
    ])
    views.update([{ ...first, position: { x: 10000, y: 10000 } }, second], inside, 900)
    assert.equal(originalOrder[0]!.renderable, false)
    views.update([first, second], inside, 900)
    preWorld.sortChildren()
    assert.deepEqual(preWorld.children, originalOrder)
    assert.equal(originalOrder[0]!.renderable, true)
    assert.equal(originalOrder[0]!.alpha, first.alpha)
    assert.equal(originalOrder[0]!.tint, first.tint)
    assert.equal(originalOrder[0]!.blendMode, first.blendMode)
  } finally { views.destroy(); root.destroy(); preWorld.destroy() }
})

test('world death-effect batches preserve intervening painters, textures, and blend boundaries', () => {
  const root = new Container({ sortableChildren: true }), preWorld = new Container()
  const unrelated = new Container({ label: 'other-world-painter', zIndex: 2 })
  root.addChild(unrelated)
  const batchTextures = { ...textures, base: { ...textures.base,
    [nativeEnemySpriteRecord('BadGuys', 15).source]: Texture.WHITE,
  } }
  const views = new module.NativeEnemyDeathEffectViews(root, batchTextures, preWorld)
  const effects = [1, 2, 3, 4, 5, 6].map(id => ({
    ...fixture('fade', false, 'world-sorted'), id,
    entry: id === 5 ? 15 : 1,
    shadow: id === 6,
    position: { x: id * 40, y: 30 }, alpha: 0.4, tint: 0x112233,
    blendMode: id >= 4 ? 'normal' as const : 'add' as const,
  }))
  try {
    views.update(effects, inside, 900)
    views.applyWorldPainterDepths([
      { id: 'enemy-death-effect:1', row: 0, zIndex: 1 },
      { id: 'other-world-painter', row: 0, zIndex: 2 },
      { id: 'enemy-death-effect:2', row: 0, zIndex: 3 },
      { id: 'enemy-death-effect:3', row: 0, zIndex: 4 },
      { id: 'enemy-death-effect:4', row: 0, zIndex: 5 },
      { id: 'enemy-death-effect:5', row: 0, zIndex: 6 },
      { id: 'enemy-death-effect:6', row: 0, zIndex: 7 },
    ])
    root.sortChildren()
    const meshes = root.children.filter(child => child instanceof Mesh)
    assert.equal(views.size, 6)
    assert.equal(views.visibleSize, 6)
    assert.equal(root.children.filter(child => child instanceof Sprite).length, 0)
    assert.equal(meshes.length, 4)
    assert.deepEqual(root.children.map(child => child.zIndex), [1, 2, 3, 5, 6, 7])
    assert.deepEqual(meshes.map(mesh => mesh.blendMode), ['add', 'add', 'normal', 'normal'])
    assert.deepEqual(meshes.map(mesh => visibleTriangleCount(mesh)), [2, 4, 2, 2])
    assert.equal(meshes[3]!.texture, Texture.WHITE)
    assert.equal(root.children[5]!.label, 'enemy-death-effect:fade:6')
    assert.equal(root.children[5]!.children.length, 2, 'shadowed effects keep their composite owner')
    assert.ok(meshes.every(mesh => mesh.geometry.getBuffer('aColor').data[0] === 0x66332211))
    assert.equal(root.children[1], unrelated)
  } finally { views.destroy(); root.destroy({ children: true }); preWorld.destroy() }
})

function visibleTriangleCount(mesh: Mesh): number {
  const indices = mesh.geometry.indexBuffer!.data
  let triangles = 0
  for (let index = 0; index < indices.length; index += 3) {
    if (indices[index] !== indices[index + 1] && indices[index] !== indices[index + 2]
      && indices[index + 1] !== indices[index + 2]) triangles += 1
  }
  return triangles
}

test('world batches cull, regrow, retire, and unload every owned geometry', () => {
  const root = new Container(), preWorld = new Container()
  const views = new module.NativeEnemyDeathEffectViews(root, textures, preWorld)
  const effects = [1, 2, 3].map(id => ({ ...fixture('fade', false, 'world-sorted'), id }))
  const order = effects.map(effect => ({ id: `enemy-death-effect:${effect.id}`, row: 0, zIndex: effect.id }))
  const geometries = new Set<Mesh['geometry']>()
  const unloaded = new Set<Mesh['geometry']>()
  const recordGeometry = () => {
    const mesh = root.children.find(child => child instanceof Mesh)
    assert.ok(mesh instanceof Mesh)
    const geometry = mesh.geometry
    if (!geometries.has(geometry)) {
      geometries.add(geometry)
      geometry.on('unload', () => unloaded.add(geometry))
    }
    return mesh
  }
  try {
    views.update(effects.slice(0, 1), inside, 900)
    views.applyWorldPainterDepths(order.slice(0, 1))
    assert.equal(visibleTriangleCount(recordGeometry()), 2)
    views.update(effects, inside, 900)
    views.applyWorldPainterDepths(order)
    const mesh = recordGeometry()
    assert.equal(visibleTriangleCount(mesh), 6)
    assert.equal(unloaded.size, 1, 'growing a run unloads its replaced GPU geometry')
    views.update(effects.slice(0, 1), inside, 900)
    views.applyWorldPainterDepths(order.slice(0, 1))
    assert.equal(recordGeometry(), mesh)
    assert.equal(visibleTriangleCount(mesh), 2, 'retired triangles cannot remain in the draw')
    views.update(effects, outside, 900)
    views.applyWorldPainterDepths([])
    assert.equal(views.size, 3)
    assert.equal(views.visibleSize, 0)
    assert.equal(mesh.renderable, false)
    views.update(effects, inside, 900)
    views.applyWorldPainterDepths(order)
    assert.equal(recordGeometry(), mesh)
    assert.equal(visibleTriangleCount(mesh), 6)
    assert.equal(mesh.renderable, true)
    views.setRenderable(false)
    assert.equal(mesh.renderable, false)
    views.setRenderable(true)
    assert.equal(mesh.renderable, true)
    views.update([], inside, 900)
    views.applyWorldPainterDepths([])
    assert.equal(views.size, 0)
    assert.equal(mesh.renderable, false)
    views.destroy()
    assert.equal(root.children.length, 0)
    assert.deepEqual(unloaded, geometries)
    assert.ok([...geometries].every(geometry => geometry.buffers === null))
  } finally { views.destroy(); root.destroy(); preWorld.destroy() }
})

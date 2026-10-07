import assert from 'node:assert/strict'
import test from 'node:test'
import { Container, MeshSimple, Sprite, Texture } from 'pixi.js'
import type { MainLayer } from '../../editor/native-render-plan.ts'
import type { ResidentTexture } from './boneyard-renderer-model.ts'
import { BoneyardScrubShadowPresentation } from './boneyard-scrub-shadow-presentation.ts'

const sources = [{ position: { x: 150, y: 300 }, radius: 1, intensity: 1, castsDirectionalShadow: true }]

function setup() {
  const root = new Container()
  const sprite = new Sprite(Texture.WHITE)
  sprite.zIndex = 7
  root.addChild(sprite)
  const resident: ResidentTexture = { cleanupSourceKey: 'object:scrub', h: 85, w: 67, x: 169, y: 239,
    mainLayerIndex: 0, pixels: new Uint8ClampedArray(0), shadowCaster: null, surfaceMesh: null,
    texture: Texture.WHITE, sprite }
  const object = { eid: 'scrub', typeId: 2062, pos: { x: 200, y: 300 }, variant: 15 }
  const layer: MainLayer = { kind: 'object', object, atlas: 'DeadHawg', atlasEntry: 279,
    pos: object.pos, sel: { kind: 'object', eid: object.eid }, sortBias: 0, sortKey: 0, sourceOrder: 0, worldY: 300 }
  const view = new BoneyardScrubShadowPresentation(root, [layer], new Map([[0, resident]]), 0, Texture.WHITE)
  return { root, resident, view }
}

test('Scrub keeps retained textured meshes directly before its owner across setting and source changes', () => {
  const { root, resident, view } = setup()
  try {
    const frame = view.render(sources, 0, 0, [resident], true, true, () => false)
    assert.equal(frame.quadCount, 1)
    assert.equal(frame.recordCount, 1)
    assert.equal(frame.zOrderMismatchCount, 0)
    const container = root.children[0]!
    const mesh = (container as Container).children[0]!
    assert.equal(root.children[1], resident.sprite)
    assert.equal(mesh.label, 'scrub-directional-shadow')
    const basic = view.render(sources, 1, 1, [resident], false, true, () => false)
    assert.equal(basic.quadCount, 1)
    assert.equal(basic.recordCount, 0)
    assert.equal((container as Container).children[0], mesh)
    assert.equal(mesh.label, 'scrub-flat-shadow')
    const dark = view.render([], 2, 2, [resident], true, true, () => false)
    assert.equal(dark.quadCount, 0)
    assert.equal(root.children.length, 1)
    assert.equal(dark.pooledMeshCount, 1)
    view.render(sources, 3, 3, [resident], true, true, () => false)
    assert.equal(root.children[0], container)
    assert.equal((container as Container).children[0], mesh)
    assert.equal(mesh.label, 'scrub-directional-shadow')
  } finally { view.destroy(); root.destroy({ children: true }) }
})

test('Scrub hides off-camera/retired owners, restores depth after sorting and releases all borrowed views', () => {
  const { root, resident, view } = setup()
  view.render(sources, 0, 0, [resident], true, true, () => false)
  const container = root.children[0]!
  const mesh = (container as Container).children[0]!
  const geometry = (mesh as MeshSimple).geometry
  const buffers = [...geometry.buffers]
  const events: string[] = []
  geometry.on('unload', () => events.push('unload'))
  geometry.on('destroy', () => events.push('destroy'))
  const invisible = view.render(sources, 1, 1, [], true, true, () => false)
  assert.equal(invisible.activeMeshCount, 0)
  assert.equal(container.parent, null)
  resident.sprite.zIndex = 17
  const restored = view.render(sources, 2, 2, [resident], true, true, () => false)
  assert.equal(restored.zOrderMismatchCount, 0)
  assert.equal(container.zIndex, 17)
  resident.sprite.renderable = false
  assert.equal(view.render(sources, 3, 3, [resident], true, true, () => false).quadCount, 0)
  resident.sprite.renderable = true
  resident.sprite.removeFromParent()
  assert.equal(view.render(sources, 4, 4, [resident], true, true, () => false).quadCount, 0)
  view.destroy()
  assert.equal(container.destroyed, true)
  assert.equal(mesh.destroyed, true)
  assert.deepEqual(events, ['unload', 'destroy'])
  assert.ok(buffers.every(buffer => buffer.destroyed))
  assert.equal(resident.texture.destroyed, false)
  resident.sprite.destroy()
  root.destroy()
})

test('Complex Lighting off empties directional records but does not remove the explicit flat-shadow branch', () => {
  const { root, resident, view } = setup()
  try {
    assert.equal(view.render(sources, 0, 0, [resident], true, false, () => false).quadCount, 0)
    const basic = view.render(sources, 1, 1, [resident], false, false, () => false)
    assert.equal(basic.quadCount, 1)
    assert.equal(basic.recordCount, 0)
  } finally { view.destroy(); root.destroy({ children: true }) }
})


test('Scrub reflection persists without lights, changes borrowed texture on toggle and keeps native colors', () => {
  const { root, resident, view } = setup()
  try {
    const first = view.render(sources, 0, 0, [resident], true, true, () => true)
    assert.equal(first.quadCount, 2)
    const container = root.children[0] as Container
    const reflection = container.children[0] as MeshSimple
    const shadow = container.children[1] as MeshSimple
    assert.equal(reflection.label, 'scrub-surface-reflection')
    assert.equal(shadow.label, 'scrub-directional-shadow')
    const positions = Array.from(reflection.vertices)
    view.render([], 1, 8, [resident], true, true, () => false)
    assert.notDeepEqual(Array.from(reflection.vertices), positions)
    assert.equal(shadow.renderable, false)
    const frozen = Array.from(reflection.vertices)
    view.render([], 2, 8, [resident], true, true, () => false)
    assert.deepEqual(Array.from(reflection.vertices), frozen)
    view.render([], 3, 8, [resident], false, false, () => false)
    assert.equal(reflection.label, 'scrub-flat-shadow')
    assert.equal(reflection.texture, resident.texture)
    assert.equal(container.children.length, 2)
  } finally { view.destroy(); root.destroy({ children: true }) }
})

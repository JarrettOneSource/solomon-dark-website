import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { parseBoneyard } from './format/boneyard.ts'
import type { EditorDoc, PlacedObject, Polyline, StaticSprite } from './model.ts'
import { NATIVE } from './model.ts'
import { buildNativeRenderPlan, NATIVE_PLACEMENT_PASSES } from './native-render-plan.ts'
import { nativeSpriteAnchor } from './sprite-registration.ts'

const storyFixture = new URL('../../public/samples/story0.boneyard', import.meta.url)

function doc(objects: PlacedObject[], sprites: StaticSprite[] = [], fences: Polyline[] = []): EditorDoc {
  return {
    meta: { name: 'render-order', bounds: { x: 0, y: 0, w: 1024, h: 1024 } },
    objects,
    sprites,
    roads: [],
    fences,
    terrain: [],
    opaque: [],
    hasTimeline: true,
  }
}

test('uses the five recovered native placement passes', () => {
  assert.deepEqual(NATIVE_PLACEMENT_PASSES, ['underlay', 'compact', 'shadow', 'main', 'foreground'])
})

test('places Gravestone, Tree, and Building component art in their native passes', () => {
  const plan = buildNativeRenderPlan(doc([
    { eid: 'grave', typeId: NATIVE.gravestone, pos: { x: 10, y: 100 }, variant: 2, overlayVariant: 3 } as PlacedObject,
    { eid: 'tree', typeId: NATIVE.tree, pos: { x: 20, y: 200 }, variant: 1 } as PlacedObject,
    { eid: 'building', typeId: NATIVE.building, pos: { x: 30, y: 300 }, variant: 2 } as PlacedObject,
  ]))

  assert.deepEqual(plan.underlays.map((layer) => [layer.sel.eid, layer.atlasEntry]), [['grave', 91]])
  assert.deepEqual(plan.main.map((layer) => [layer.sel.eid, layer.kind === 'object' ? layer.atlasEntry : null]), [
    ['grave', 99],
    ['tree', 265],
    ['building', 150],
  ])
  assert.deepEqual(plan.foreground.map((layer) => [layer.sel.eid, layer.atlasEntry]), [
    ['tree', 243],
    ['building', 154],
  ])
})

test('keeps compact sprites below shadows and main art and applies the Building sort bias', () => {
  const compact: StaticSprite = {
    eid: 'dirt', atlasEntry: 7, pos: { x: 0, y: 500 }, s0: 0, s1: 1, s2: 1, flags: 0,
  }
  const fence: Polyline = {
    eid: 'fence', typeId: NATIVE.fence, points: [{ x: 0, y: 70 }, { x: 100, y: 90 }],
  }
  const plan = buildNativeRenderPlan(doc([
    { eid: 'tree', typeId: NATIVE.tree, pos: { x: 0, y: 60 }, variant: 0 },
    { eid: 'building', typeId: NATIVE.building, pos: { x: 0, y: 100 }, variant: 0 },
  ], [compact], [fence]))

  assert.deepEqual(plan.compact.map((layer) => layer.atlasEntry), [121])
  assert.deepEqual(plan.shadows.map((layer) => layer.sel.eid), ['tree', 'building', 'fence'])
  assert.deepEqual(plan.main.map((layer) => [layer.sel.eid, layer.sortKey]), [
    ['building', 50],
    ['tree', 60],
    ['fence', 90],
  ])
})

test('suppresses the Tree foreground for native variants six and above', () => {
  const plan = buildNativeRenderPlan(doc([
    { eid: 'tree', typeId: NATIVE.tree, pos: { x: 0, y: 0 }, variant: 6 },
  ]))
  assert.deepEqual(plan.foreground, [])
})

test('reconstructs native logical-canvas registration from the crop origin', () => {
  assert.deepEqual(nativeSpriteAnchor(204, 271, { x: -15, y: -117.5 }), { x: 117, y: 253 })
  assert.deepEqual(nativeSpriteAnchor(268, 263, { x: -5, y: -181.5 }), { x: 139, y: 313 })
  assert.deepEqual(nativeSpriteAnchor(231, 209, { x: 0, y: -61 }), { x: 115.5, y: 165.5 })
})

test('plans every retail story0 placement without mixing compact art into the main queue', () => {
  const story = parseBoneyard(readFileSync(storyFixture))
  const plan = buildNativeRenderPlan(story)
  const treeForegroundCount = story.objects.filter((object) => {
    if (object.typeId !== NATIVE.tree || (object.variant ?? 0) >= 6) return false
    return !('secondaryVisible' in object) || object.secondaryVisible !== false
  }).length
  assert.equal(plan.underlays.length, 50)
  assert.equal(plan.compact.length, 133)
  assert.equal(plan.shadows.length, 137)
  assert.equal(plan.main.length, 137)
  assert.equal(treeForegroundCount, 49)
  assert.equal(plan.foreground.length, treeForegroundCount)
  assert.ok(plan.main.every((layer) => layer.kind !== 'object' || layer.sel.kind === 'object'))
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { parseBoneyard } from './format/boneyard.ts'
import type { EditorDoc, PlacedObject, Polyline, StaticSprite } from './model.ts'
import { NATIVE } from './model.ts'
import { nativeGateLeaves } from './native-fence-geometry.ts'
import { buildNativeRenderPlan, NATIVE_PLACEMENT_PASSES } from './native-render-plan.ts'
import { nativeSpriteAnchor } from './sprite-registration.ts'
import { buildBoneyardPainterOrder } from '../game/boneyard-painter-order.ts'

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

test('interleaves every stock main-prop family with actors and keeps proxy art late', () => {
  const plan = buildNativeRenderPlan(doc([
    { eid: 'grave', typeId: NATIVE.gravestone, pos: { x: 0, y: 100 }, variant: 0 },
    { eid: 'tree', typeId: NATIVE.tree, pos: { x: 0, y: 300 }, variant: 0 },
    { eid: 'monument', typeId: NATIVE.monument, pos: { x: 0, y: 400 }, variant: 0 },
    { eid: 'goodie', typeId: NATIVE.goodie, pos: { x: 0, y: 500 }, variant: 0 },
    { eid: 'building', typeId: NATIVE.building, pos: { x: 0, y: 600 }, variant: 0 },
  ]))
  const order = buildBoneyardPainterOrder({
    referenceY: 200,
    staticLayers: plan.main.map((layer, layerIndex) => ({
      layerIndex,
      worldY: layer.worldY,
      sortBias: layer.sortBias,
      sourceOrder: layer.sourceOrder,
    })),
    dynamicLayers: [{ id: 'player', worldY: 200, sortBias: 0, sourceOrder: 0 }],
  })
  const player = order.dynamicLayers[0]
  const eidsAt = (predicate: (zIndex: number) => boolean) => order.bands
    .filter((band) => predicate(band.zIndex))
    .flatMap((band) => band.layerIndexes.map((index) => plan.main[index].sel.eid))

  assert.deepEqual(eidsAt((zIndex) => zIndex < player.zIndex), ['grave'])
  assert.deepEqual(eidsAt((zIndex) => zIndex > player.zIndex), [
    'tree', 'monument', 'goodie', 'building',
  ])
  assert.deepEqual(plan.underlays.map((layer) => layer.sel.eid), ['grave'])
  assert.deepEqual(plan.foreground.map((layer) => layer.sel.eid), ['tree', 'building'])
})

test('keeps compact sprites below shadows and uses each Puppet effective-Y bias', () => {
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
  assert.deepEqual(plan.shadows.map((layer) => [layer.sel.eid, layer.kind === 'fence' ? layer.part : 'object']), [
    ['tree', 'object'],
    ['building', 'object'],
    ['fence', 'post'],
    ['fence', 'post'],
    ['fence', 'body'],
  ])
  assert.deepEqual(plan.main.map((layer) => [layer.sel.eid, layer.kind === 'fence' ? layer.part : 'object', layer.sortKey]), [
    ['tree', 'object', 60],
    ['fence', 'body', 65],
    ['fence', 'post', 70],
    ['fence', 'post', 90],
    ['building', 'object', 100],
  ])
})

test('materializes shared Fenceposts once and gives split fence leaves independent depth', () => {
  const plan = buildNativeRenderPlan(doc([], [], [
    {
      eid: 'broken', typeId: NATIVE.fence, segmentCode: 1,
      points: [{ x: 0, y: 10 }, { x: 100, y: 20 }],
    },
    {
      eid: 'rails', typeId: NATIVE.fence, segmentCode: 4,
      points: [{ x: 100, y: 20 }, { x: 200, y: 30 }],
    },
  ]))
  const fenceLayers = plan.shadows.filter((layer) => layer.kind === 'fence')
  assert.equal(fenceLayers.filter((layer) => layer.part === 'post').length, 3)
  assert.deepEqual(fenceLayers.filter((layer) => layer.part === 'body').map((layer) => [layer.sel.eid, layer.sortKey]), [
    ['broken', -2.1999999999999993],
    ['broken', 2.1999999999999993],
    ['rails', 10],
  ])
})

test('materializes native gate sides with endpoint trim and the two-unit center gap', () => {
  const leaves = nativeGateLeaves([{ x: 0, y: 40 }, { x: 100, y: 40 }])
  assert.deepEqual(leaves, [
    {
      hinge: { x: 86.5, y: 40 },
      tip: { x: 51, y: 40 },
      p0: { x: 86.5, y: -47 },
      p1: { x: 51, y: -47 },
      p2: { x: 86.5, y: 40 },
      p3: { x: 51, y: 40 },
    },
    {
      hinge: { x: 13.5, y: 40 },
      tip: { x: 49, y: 40 },
      p0: { x: 13.5, y: -47 },
      p1: { x: 49, y: -47 },
      p2: { x: 13.5, y: 40 },
      p3: { x: 49, y: 40 },
    },
  ])
  const plan = buildNativeRenderPlan(doc([], [], [{
    eid: 'gate', typeId: NATIVE.fence, segmentCode: 2,
    points: [{ x: 0, y: 40 }, { x: 100, y: 40 }],
  }]))
  assert.deepEqual(
    plan.shadows.filter((layer) => layer.kind === 'fence' && layer.part === 'body')
      .map((layer) => layer.pos),
    [{ x: 51, y: 40 }, { x: 49, y: 40 }],
  )
  assert.deepEqual(
    plan.main.map((layer) => [layer.kind === 'fence' ? layer.part : 'object', layer.sortKey]),
    [
      ['body', 25],
      ['body', 25],
      ['post', 40],
      ['post', 40],
    ],
  )
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
  assert.deepEqual(nativeSpriteAnchor(46, 10, { x: 7, y: 110 }), { x: 16, y: -105 })
  assert.deepEqual(nativeSpriteAnchor(34, 34, { x: 2.5, y: -5.5 }), { x: 14.5, y: 22.5 })
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
  assert.equal(plan.shadows.length, 160)
  assert.equal(plan.main.length, 160)
  assert.equal(treeForegroundCount, 49)
  assert.equal(plan.foreground.length, treeForegroundCount)
  assert.ok(plan.main.every((layer) => layer.kind !== 'object' || layer.sel.kind === 'object'))
})

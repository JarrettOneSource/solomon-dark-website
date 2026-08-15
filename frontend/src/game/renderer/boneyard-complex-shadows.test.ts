import assert from 'node:assert/strict'
import test from 'node:test'
import { Container, Sprite, Texture } from 'pixi.js'

import type { EditorDoc } from '../../editor/model.ts'
import type { MainLayer } from '../../editor/native-render-plan.ts'
import {
  NativeBoneyardShadowMeshBuffers,
  nativeBoneyardComplexShadowRecords,
  nativeBoneyardFenceGrateShadows,
  nativeBoneyardLineShadowEdge,
  nativeBoneyardPackedShadowAlpha,
  nativeBoneyardProjectedShadowEdges,
  nativeBoneyardProjectedShadowMesh,
  nativeBoneyardRailsShadows,
  nativeBoneyardShadowAlphaRampPixels,
  nativeBoneyardShadowAlphaUv,
  nativeBoneyardTreeComplexShadowOutline,
  nativeBoneyardWallShadow,
  type NativeBoneyardComplexShadowCaster,
} from './boneyard-complex-shadows.ts'
import { NativeBoneyardLightIndex } from './boneyard-lighting.ts'
import { BoneyardComplexShadowPresentation } from './boneyard-complex-shadow-presentation.ts'
import {
  nativeBuildingShadowOutline,
  nativeFencepostShadowOutline,
  nativeGoodieShadowOutline,
  nativeGravestoneShadowOutline,
  nativeMonumentShadowOutline,
} from './boneyard-native-shadow-shapes.ts'
import { nativeBoneyardMainLayerShadowCaster } from './boneyard-shadow-casters.ts'
import {
  buildNativeBoneyardShadowMesh,
  nativeBoneyardShadowLineQuad,
} from './boneyard-shadow-mesh.ts'

test('packs shadow vertex alpha through the native 8-bit truncation boundary', () => {
  assert.equal(nativeBoneyardPackedShadowAlpha(9.459294673673612e-7), 0)
  assert.equal(nativeBoneyardPackedShadowAlpha(0.5), 127 / 255)
  assert.equal(nativeBoneyardPackedShadowAlpha(1), 1)
})

test('encodes native packed alpha in one shared 256-entry ramp', () => {
  const pixels = nativeBoneyardShadowAlphaRampPixels()
  assert.equal(pixels.length, 256 * 4)
  assert.deepEqual([...pixels.slice(0, 8)], [0, 0, 0, 0, 0, 0, 0, 1])
  assert.deepEqual([...pixels.slice(-4)], [0, 0, 0, 255])
  assert.equal(nativeBoneyardShadowAlphaUv(0), 0.5 / 256)
  assert.equal(nativeBoneyardShadowAlphaUv(0.5), 127.5 / 256)
  assert.equal(nativeBoneyardShadowAlphaUv(1), 255.5 / 256)
})

test('reuses indexed shadow buffers and grows only when required', () => {
  const first = {
    baseAlpha: 0.8,
    baseEnd: { x: 10, y: 0 },
    baseStart: { x: 0, y: 0 },
    tipAlpha: 0.2,
    tipEnd: { x: 10, y: 20 },
    tipStart: { x: 0, y: 20 },
  }
  const buffers = new NativeBoneyardShadowMeshBuffers(1)
  buffers.write([first])
  const retained = {
    indices: buffers.indices,
    positions: buffers.positions,
    uvs: buffers.uvs,
  }
  assert.equal(buffers.quadCount, 1)
  assert.equal(buffers.quadCapacity, 1)
  assert.equal(buffers.indexRevision, 1)
  assert.deepEqual([...buffers.indices], [0, 1, 2, 1, 3, 2])
  assert.deepEqual([...buffers.positions], [0, 0, 10, 0, 0, 20, 10, 20])

  buffers.write([first])
  assert.equal(buffers.positions, retained.positions)
  assert.equal(buffers.uvs, retained.uvs)
  assert.equal(buffers.indices, retained.indices)
  assert.equal(buffers.indexRevision, 1)
  buffers.write([first, { ...first, baseStart: { x: 30, y: 0 } }])
  assert.equal(buffers.quadCount, 2)
  assert.equal(buffers.quadCapacity, 2)
  assert.notEqual(buffers.positions, retained.positions)
  assert.equal(buffers.indexRevision, 2)
  const grownPositions = buffers.positions
  buffers.write([first])
  assert.equal(buffers.positions, grownPositions)
  assert.equal(buffers.indexRevision, 3)
  assert.deepEqual([...buffers.indices.slice(6)], [0, 0, 0, 0, 0, 0])
})

test('turns native rail strokes into explicit constant-alpha quads', () => {
  const edge = nativeBoneyardLineShadowEdge({
    alpha: 0.5,
    end: { x: 20, y: 0 },
    start: { x: 0, y: 0 },
    width: 4,
  })
  assert.deepEqual(edge, {
    baseAlpha: 0.5,
    baseEnd: { x: 0, y: 2 },
    baseStart: { x: 0, y: -2 },
    tipAlpha: 0.5,
    tipEnd: { x: 20, y: 2 },
    tipStart: { x: 20, y: -2 },
  })
})

test('pools only active meshes and places each at equal depth immediately before its owner', () => {
  const root = new Container({ label: 'root' })
  root.sortableChildren = true
  const before = new Sprite(Texture.WHITE)
  const owner = new Sprite(Texture.WHITE)
  const offscreenOwner = new Sprite(Texture.WHITE)
  const after = new Sprite(Texture.WHITE)
  before.label = 'before'
  owner.label = 'owner'
  offscreenOwner.label = 'offscreen-owner'
  after.label = 'after'
  before.zIndex = 2
  owner.zIndex = 3
  offscreenOwner.zIndex = 3
  after.zIndex = 4
  root.addChild(before, offscreenOwner, owner, after)
  const caster = {
    id: 'grave:pool',
    outline: [
      { x: -1, y: -1 }, { x: 1, y: -1 },
      { x: 1, y: 1 }, { x: -1, y: 1 },
    ],
    position: { x: 100, y: 0 },
  }
  const presentation = new BoneyardComplexShadowPresentation(root, [
    { caster, depthOwner: owner },
    {
      caster: { ...caster, id: 'grave:offscreen' },
      depthOwner: offscreenOwner,
    },
  ])
  assert.equal(root.children.some(({ label }) => label.startsWith('complex-shadow:')), false)
  const source = {
    castsDirectionalShadow: true,
    intensity: 1,
    position: { x: 0, y: 0 },
    radius: 1,
  }
  const first = presentation.render([source], 1, [], new Map(), [owner])
  root.sortChildren()
  const mesh = root.children.find(({ label }) => label === 'complex-shadow:grave:pool')
  assert.ok(mesh)
  assert.equal(first.activeMeshCount, 1)
  assert.equal(first.casterCount, 1)
  assert.equal(
    root.children.some(({ label }) => label === 'complex-shadow:grave:offscreen'),
    false,
  )
  assert.equal(first.pooledMeshCount, 0)
  assert.equal(mesh.zIndex, owner.zIndex)
  assert.equal(root.getChildIndex(mesh), root.getChildIndex(owner) - 1)

  owner.renderable = false
  const hidden = presentation.render([source], 2, [], new Map(), [owner])
  assert.equal(hidden.activeMeshCount, 0)
  assert.equal(hidden.pooledMeshCount, 1)
  assert.equal(mesh.parent, null)
  owner.renderable = true
  const repeated = presentation.render([source], 3, [], new Map(), [owner])
  assert.equal(repeated.activeMeshCount, 1)
  assert.equal(
    root.children.find(({ label }) => label === 'complex-shadow:grave:pool'),
    mesh,
  )
  presentation.destroy()
  root.destroy({ children: true })
})

test('keeps a moving Gate shadow immediately before its Container owner after sorting', () => {
  const root = new Container({ label: 'root' })
  root.sortableChildren = true
  const before = new Sprite(Texture.WHITE)
  const owner = new Container({ label: 'gate-owner' })
  const sameDepthAfter = new Sprite(Texture.WHITE)
  before.zIndex = 4
  owner.zIndex = 4
  sameDepthAfter.zIndex = 4
  root.addChild(before, owner, sameDepthAfter)
  const presentation = new BoneyardComplexShadowPresentation(root, [])
  const gate = {
    fenceEid: 'gate',
    hinge: { x: 0, y: 0 },
    id: 'gate:0',
    side: 0 as const,
    tip: { x: 80, y: 0 },
  }
  const frame = presentation.render(
    [{
      castsDirectionalShadow: true,
      intensity: 1,
      position: { x: 40, y: -80 },
      radius: 1,
    }],
    7,
    [gate],
    new Map([['gate:0', owner]]),
    [],
  )
  root.sortChildren()
  const shadow = root.children.find(({ label }) => label === 'complex-shadow:gate:gate:0')
  assert.ok(shadow)
  assert.equal(frame.zOrderMismatchCount, 0)
  assert.equal(shadow.zIndex, owner.zIndex)
  assert.equal(root.getChildIndex(shadow), root.getChildIndex(owner) - 1)
  assert.ok(root.getChildIndex(owner) < root.getChildIndex(sameDepthAfter))
  presentation.destroy()
  root.destroy({ children: true })
})

const squareCaster: NativeBoneyardComplexShadowCaster = {
  id: 'grave:one',
  outline: [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
  ],
  position: { x: 100, y: 0 },
}

test('builds records only from shadow-flagged sources inside native falloff', () => {
  const source = {
    intensity: 1,
    castsDirectionalShadow: true,
    position: { x: 0, y: 0 },
    radius: 1,
  }
  const [record] = nativeBoneyardComplexShadowRecords(squareCaster, [source], 7)
  assert.ok(record)
  assert.deepEqual(record.direction, { x: 1, y: 0 })
  assert.deepEqual(record.sourcePosition, source.position)
  assert.equal(record.distanceFraction, 10_000 / 21_025)
  assert.ok(record.projectionDistance >= 144)
  assert.ok(record.projectionDistance < 145)
  assert.equal(
    nativeBoneyardComplexShadowRecords(
      squareCaster,
      [{ ...source, castsDirectionalShadow: false }],
      7,
    ).length,
    0,
  )
  assert.equal(
    nativeBoneyardComplexShadowRecords(
      { ...squareCaster, position: { x: 145, y: 0 } },
      [source],
      7,
    ).length,
    0,
  )
})

test('keeps projection jitter deterministic and presentation-only', () => {
  const source = {
    intensity: 1,
    castsDirectionalShadow: true,
    position: { x: 0, y: 0 },
    radius: 2.6,
  }
  const first = nativeBoneyardComplexShadowRecords(squareCaster, [source], 33)[0]
  const repeated = nativeBoneyardComplexShadowRecords(squareCaster, [source], 33)[0]
  const nextFrame = nativeBoneyardComplexShadowRecords(squareCaster, [source], 34)[0]
  assert.equal(first?.projectionDistance, repeated?.projectionDistance)
  assert.notEqual(first?.projectionDistance, nextFrame?.projectionDistance)
  assert.ok((first?.projectionDistance ?? 0) >= 144 * 2.6)
  assert.ok((first?.projectionDistance ?? 0) < 145 * 2.6)
})

test('applies native pairwise attenuation to multiple source directions', () => {
  const caster = { ...squareCaster, position: { x: 0, y: 0 } }
  const sources = [
    {
      intensity: 1,
      castsDirectionalShadow: true,
      position: { x: -100, y: 0 },
      radius: 1,
    },
    {
      intensity: 1,
      castsDirectionalShadow: true,
      position: { x: 0, y: -85 },
      radius: 1,
    },
  ]
  const records = nativeBoneyardComplexShadowRecords(caster, sources, 4)
  assert.equal(records.length, 2)
  assert.equal(records[0]?.baseAlpha, records[1]?.distanceFraction)
  assert.equal(records[1]?.baseAlpha, records[0]?.distanceFraction)
})

test('lets a non-directional Air contact light erase a directional shadow tail', () => {
  const caster = { ...squareCaster, position: { x: 0, y: 0 } }
  const directional = {
    intensity: 1,
    castsDirectionalShadow: true,
    position: { x: -100, y: 0 },
    radius: 1,
  }
  const contact = {
    intensity: 1,
    castsDirectionalShadow: false,
    position: { x: 1, y: 0 },
    radius: 1,
  }
  const records = nativeBoneyardComplexShadowRecords(
    caster,
    [directional, contact],
    4,
  )

  assert.equal(records.length, 1)
  assert.equal(records[0]?.behindScalar, 1)
  assert.ok(nativeBoneyardProjectedShadowEdges(caster, records[0]!).every(
    ({ tipAlpha }) => tipAlpha === 0,
  ))
})

test('uses retained light buckets without changing global source order or behind scalar', () => {
  const caster = { ...squareCaster, position: { x: 0, y: 0 } }
  const accepted = [
    {
      intensity: 1,
      castsDirectionalShadow: true,
      position: { x: 1_000, y: 0 },
      radius: 1,
    },
    {
      intensity: 1,
      castsDirectionalShadow: true,
      position: { x: -100, y: 0 },
      radius: 1,
    },
    {
      intensity: 1,
      castsDirectionalShadow: false,
      position: { x: 1, y: 0 },
      radius: 1,
    },
  ]
  const index = new NativeBoneyardLightIndex({ height: 900, width: 1_600 })
  index.rebuild(accepted, [], {
    camera: { x: 800, y: 450, zoom: 1 },
    viewport: { height: 900, width: 1_600 },
  })
  assert.deepEqual(
    nativeBoneyardComplexShadowRecords(caster, index, 19),
    nativeBoneyardComplexShadowRecords(caster, accepted, 19),
  )
})

test('projects every authored-normal-visible edge away from the source', () => {
  const caster = { ...squareCaster, position: { x: 0, y: 0 } }
  const edges = nativeBoneyardProjectedShadowEdges(caster, {
    baseAlpha: 0.8,
    behindScalar: 0.25,
    direction: { x: 1, y: 0 },
    distanceFraction: 0.2,
    projectionDistance: 20,
    sourcePosition: { x: -10, y: 0 },
    sourceRadius: 1,
  })
  assert.equal(edges.length, 3)
  assert.deepEqual(edges.map(({ baseEnd, baseStart }) => ({ baseEnd, baseStart })), [
    { baseStart: { x: -1, y: -1 }, baseEnd: { x: 1, y: -1 } },
    { baseStart: { x: 1, y: -1 }, baseEnd: { x: 1, y: 1 } },
    { baseStart: { x: 1, y: 1 }, baseEnd: { x: -1, y: 1 } },
  ])
  assert.ok(edges.every(({ baseAlpha, tipAlpha }) => (
    baseAlpha === 0.8 && Math.abs(tipAlpha - 0.216) < 1e-12
  )))
  assert.ok(edges.every(({ baseStart, tipStart }) => tipStart.x > baseStart.x))
  const mesh = nativeBoneyardProjectedShadowMesh(edges[0])
  assert.equal(mesh.vertices.length, 8)
  assert.deepEqual([...mesh.indices], [0, 1, 2, 1, 3, 2])
  assert.deepEqual([...mesh.alphas], [
    Math.fround(0.8),
    Math.fround(0.8),
    Math.fround(0.216),
    Math.fround(0.216),
  ])
})

test('projects intact FenceGrate bars with native count, widths, gaps, and rail', () => {
  const record = {
    baseAlpha: 0.8,
    behindScalar: 0.25,
    direction: { x: 0, y: 1 },
    distanceFraction: 0.2,
    projectionDistance: 40,
    sourcePosition: { x: 50, y: -100 },
    sourceRadius: 1,
  }
  const plan = nativeBoneyardFenceGrateShadows({
    construction: 'intact',
    end: { x: 104, y: 0 },
    kind: 'fence-grate',
    start: { x: 0, y: 0 },
  }, record)

  // Shortened length is 80; native uses trunc(80 / stored-float 13 1/3) + 1.
  assert.equal(plan.bars.length, 7)
  assert.ok(Math.abs(Math.hypot(
    plan.bars[0]!.baseEnd.x - plan.bars[0]!.baseStart.x,
    plan.bars[0]!.baseEnd.y - plan.bars[0]!.baseStart.y,
  ) - 4) < 1e-12)
  assert.ok(Math.abs(Math.hypot(
    plan.bars[0]!.tipEnd.x - plan.bars[0]!.tipStart.x,
    plan.bars[0]!.tipEnd.y - plan.bars[0]!.tipStart.y,
  ) - 16) < 1e-12)
  assert.ok(plan.bars.every(({ tipAlpha }) => tipAlpha === 0))
  assert.ok(
    plan.bars[1]!.baseStart.x - plan.bars[0]!.baseEnd.x
    > 8,
  )
  assert.equal(plan.rail.width, 4)
  assert.equal(plan.rail.alpha, 0.7450000000000001)
})

test('rebuilds moving Gate shadows from live endpoints with the native five-bar program', () => {
  const record = {
    baseAlpha: 1,
    behindScalar: 0,
    direction: { x: 0, y: 1 },
    distanceFraction: 0,
    projectionDistance: 30,
    sourcePosition: { x: 0, y: -100 },
    sourceRadius: 1,
  }
  const closed = nativeBoneyardFenceGrateShadows({
    construction: 'gate',
    end: { x: 75, y: 0 },
    kind: 'fence-grate',
    start: { x: 0, y: 0 },
  }, record)
  const moved = nativeBoneyardFenceGrateShadows({
    construction: 'gate',
    end: { x: 0, y: 75 },
    kind: 'fence-grate',
    start: { x: 0, y: 0 },
  }, record)

  assert.equal(closed.bars.length, 5)
  assert.equal(moved.bars.length, 5)
  assert.notDeepEqual(closed.bars, moved.bars)
  assert.ok(closed.bars.every(({ baseStart }) => baseStart.x > 4))
  assert.ok(moved.bars.every(({ baseStart }) => baseStart.y > 4))
})

test('projects Rails as two native fixed-width lines from the repeated far baseline', () => {
  const lines = nativeBoneyardRailsShadows({
    end: { x: 104, y: 0 },
    kind: 'rails',
    start: { x: 0, y: 0 },
  }, {
    baseAlpha: 0.8,
    behindScalar: 0.25,
    direction: { x: 1, y: 0 },
    distanceFraction: 0.2,
    projectionDistance: 40,
    sourcePosition: { x: -100, y: 0 },
    sourceRadius: 1,
  })
  assert.equal(lines.length, 2)
  assert.ok(lines.every(({ alpha, width }) => alpha === 0.7450000000000001 && width === 10))
  assert.deepEqual(lines.map(({ start }) => start), [
    { x: 24.8, y: 0 },
    { x: 73.33333333333333, y: 0 },
  ])
  assert.ok(lines[0]!.end.x > 100)
  assert.ok(lines[1]!.end.x > lines[0]!.end.x)
})

test('projects Wall endpoints once with native cubed fade and no edge filter', () => {
  const edge = nativeBoneyardWallShadow({
    end: { x: 115, y: 0 },
    kind: 'wall',
    start: { x: -15, y: 0 },
  }, {
    baseAlpha: 0.75,
    behindScalar: 0.25,
    direction: { x: 0, y: 1 },
    distanceFraction: 0.2,
    projectionDistance: 40,
    sourcePosition: { x: 0, y: -100 },
    sourceRadius: 1,
  })
  assert.deepEqual(edge.baseStart, { x: -15, y: 0 })
  assert.deepEqual(edge.baseEnd, { x: 115, y: 0 })
  assert.equal(edge.baseAlpha, 0.75)
  assert.ok(Math.abs(edge.tipAlpha - 0.216) < 1e-12)
  assert.ok(edge.tipStart.y > 0)
  assert.ok(edge.tipEnd.y > 0)
})

test('selects the exact native Tree complex-shadow outline by main variant', () => {
  const expected = [
    [[-2, 12], [18, 9], [17, -8], [-5, -4]],
    [[3, 14], [14, -3], [-4, -13], [-19, 3]],
    [[1, 9], [15, -2], [7, -13], [-15, -3]],
    [[7, 7], [27, 1], [24, -16], [4, -11]],
    [[5, 10], [12, -8], [-3, -17], [-20, -1]],
    [[-20, 8], [-12, -2], [7, 6], [0, 17]],
    [[-19.5, 12.5], [-19.5, -12.5], [19.5, -12.5], [19.5, 12.5]],
    [[-6, 10], [-6, -1], [7, -1], [8, 10]],
    [[-6, 10], [-6, -1], [7, -1], [8, 10]],
    [[-1.5, 1.5], [-1.5, -1.5], [1.5, -1.5], [1.5, 1.5]],
    [[-1.5, 1.5], [-1.5, -1.5], [1.5, -1.5], [1.5, 1.5]],
    [[0.5, 2.5], [-2.5, -0.5], [0.5, -3.5], [3.5, -0.5]],
    [[0.5, 2.5], [-2.5, -0.5], [0.5, -3.5], [3.5, -0.5]],
    [[-1.5, 1.5], [-1.5, -1.5], [1.5, -1.5], [1.5, 1.5]],
    [[-1.5, 1.5], [-1.5, -1.5], [1.5, -1.5], [1.5, 1.5]],
  ].map((outline) => outline.map(([x, y]) => ({ x, y })))

  assert.deepEqual(
    expected.map((_, variant) => nativeBoneyardTreeComplexShadowOutline(variant)),
    expected,
  )
  assert.notEqual(
    nativeBoneyardTreeComplexShadowOutline(0),
    nativeBoneyardTreeComplexShadowOutline(0),
  )
  assert.throws(
    () => nativeBoneyardTreeComplexShadowOutline(15),
    /Unsupported native Tree complex-shadow variant 15/,
  )
})

test('selects native authored Grave, Fencepost, Monument, Building, and Goodie shapes', () => {
  assert.equal(Array.from({ length: 17 }, (_, variant) => (
    nativeGravestoneShadowOutline(variant)
  )).length, 17)
  assert.deepEqual(nativeGravestoneShadowOutline(0), [
    { x: -19.5, y: -3.5 }, { x: 19.5, y: -3.5 },
    { x: 19.5, y: 12.5 }, { x: -20.5, y: 12.5 },
  ])
  assert.deepEqual(nativeGravestoneShadowOutline(16), [
    { x: -15.5, y: 7.5 }, { x: -15.5, y: -4.5 },
    { x: 15.5, y: -4.5 }, { x: 15.5, y: 7.5 },
  ])

  assert.deepEqual(nativeFencepostShadowOutline(0, 1), [
    { x: -5.175, y: 3.2750000000000004 }, { x: -5.175, y: -4.825 },
    { x: 5.175, y: -4.825 }, { x: 5.175, y: 3.2750000000000004 },
  ])
  assert.equal(Array.from({ length: 21 }, (_, variant) => (
    nativeMonumentShadowOutline(variant)
  )).length, 21)
  assert.deepEqual(nativeMonumentShadowOutline(20), [
    { x: -2.5, y: 14.5 }, { x: -14.5, y: 1.5 },
    { x: -1.5, y: -10.5 }, { x: 12.5, y: 3.5 },
  ])
  const concave = nativeBuildingShadowOutline(0)
  assert.equal(concave.length, 12)
  assert.deepEqual(concave.slice(1, 5), [
    { x: 56.5, y: 140.5 }, { x: 54.5, y: 161.5 },
    { x: 31.5, y: 161.5 }, { x: 31.5, y: 155.5 },
  ])
  assert.deepEqual(nativeGoodieShadowOutline(0), [
    { x: -33.5, y: 22.5 }, { x: -33.5, y: -11.5 },
    { x: 34.5, y: -11.5 }, { x: 34.5, y: 22.5 },
  ])
  assert.notEqual(nativeBuildingShadowOutline(0), nativeBuildingShadowOutline(0))
  assert.throws(() => nativeGravestoneShadowOutline(17), RangeError)
  assert.throws(() => nativeGoodieShadowOutline(1), RangeError)
})

test('keeps Tree root edges fixed while native presentation jitter moves only tips', () => {
  const caster: NativeBoneyardComplexShadowCaster = {
    id: 'tree:root-stability',
    outline: nativeBoneyardTreeComplexShadowOutline(0),
    position: { x: 0, y: 0 },
  }
  const source = {
    intensity: 1,
    castsDirectionalShadow: true,
    position: { x: -100, y: 0 },
    radius: 2.6,
  }
  const frames = Array.from({ length: 32 }, (_, presentationFrame) => {
    const record = nativeBoneyardComplexShadowRecords(
      caster,
      [source],
      presentationFrame,
    )[0]!
    return nativeBoneyardProjectedShadowEdges(caster, record)
  })
  const baseEdges = frames[0]!.map(({ baseEnd, baseStart }) => ({ baseEnd, baseStart }))

  assert.ok(baseEdges.length > 0)
  for (const edges of frames) {
    assert.deepEqual(
      edges.map(({ baseEnd, baseStart }) => ({ baseEnd, baseStart })),
      baseEdges,
    )
  }
  assert.ok(new Set(frames.map(([edge]) => edge!.tipStart.x)).size > 1)
})

test('never invents complex-shadow silhouettes from arbitrary sprite alpha', () => {
  const unknownLayer: MainLayer = {
    atlas: 'DeadHawg',
    atlasEntry: 23,
    kind: 'object',
    object: { eid: 'unknown', pos: { x: 10, y: 20 }, typeId: 9999 },
    pos: { x: 10, y: 20 },
    sel: { eid: 'unknown', kind: 'object' },
    sortBias: 0,
    sortKey: 20,
    sourceOrder: 0,
    worldY: 20,
  }
  const brokenBody: MainLayer = {
    fence: {
      eid: 'broken',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      segmentCode: 1,
      style: 1,
      typeId: 3005,
    },
    kind: 'fence',
    part: 'body',
    pieceIndex: 0,
    pos: { x: 28, y: 0 },
    sel: { eid: 'broken', kind: 'fence' },
    sortBias: -15,
    sortKey: -15,
    sourceOrder: 0,
    worldY: 0,
  }
  const document = { fences: [brokenBody.fence] } as EditorDoc

  assert.equal(nativeBoneyardMainLayerShadowCaster(document, unknownLayer, 0), null)
  assert.equal(nativeBoneyardMainLayerShadowCaster(document, brokenBody, 1), null)
})

test('selects Goodie authored shadow geometry by subtype, not visible phase', () => {
  const layer: MainLayer = {
    atlas: 'DeadHawg',
    atlasEntry: 147,
    kind: 'object',
    object: {
      eid: 'goodie',
      pos: { x: 50, y: 60 },
      subtype: 0,
      typeId: 2061,
      variant: 2,
    },
    pos: { x: 50, y: 60 },
    sel: { eid: 'goodie', kind: 'object' },
    sortBias: 0,
    sortKey: 60,
    sourceOrder: 0,
    worldY: 60,
  }
  const caster = nativeBoneyardMainLayerShadowCaster({ fences: [] } as EditorDoc, layer, 3)

  assert.deepEqual(caster?.outline, nativeGoodieShadowOutline(0))
})

test('packs tapered shadow edges into one indexed vertex-alpha mesh', () => {
  const mesh = buildNativeBoneyardShadowMesh([{
    baseAlpha: 0.75,
    baseEnd: { x: 4, y: 2 },
    baseStart: { x: 1, y: 2 },
    tipAlpha: 0.125,
    tipEnd: { x: 8, y: 10 },
    tipStart: { x: 2, y: 10 },
  }], [])

  assert.deepEqual([...mesh.positions], [1, 2, 4, 2, 2, 10, 8, 10])
  assert.deepEqual([...mesh.alphas], [
    Math.fround(nativeBoneyardPackedShadowAlpha(0.75)),
    Math.fround(nativeBoneyardPackedShadowAlpha(0.75)),
    Math.fround(nativeBoneyardPackedShadowAlpha(0.125)),
    Math.fround(nativeBoneyardPackedShadowAlpha(0.125)),
  ])
  assert.deepEqual([...mesh.indices], [0, 1, 2, 1, 3, 2])
})

test('packs native fixed-width shadow strokes as butt-ended quads', () => {
  const line = nativeBoneyardShadowLineQuad({
    alpha: 0.4,
    end: { x: 10, y: 5 },
    start: { x: 2, y: 5 },
    width: 4,
  })
  assert.deepEqual(line, {
    baseAlpha: 0.4,
    baseEnd: { x: 10, y: 3 },
    baseStart: { x: 2, y: 3 },
    tipAlpha: 0.4,
    tipEnd: { x: 10, y: 7 },
    tipStart: { x: 2, y: 7 },
  })

  const mesh = buildNativeBoneyardShadowMesh([], [line])
  assert.equal(mesh.positions.length, 8)
  assert.deepEqual(
    [...mesh.alphas],
    Array(4).fill(Math.fround(nativeBoneyardPackedShadowAlpha(0.4))),
  )
  assert.deepEqual([...mesh.indices], [0, 1, 2, 1, 3, 2])
})

test('keeps an empty shadow mesh allocation-free and non-renderable', () => {
  const mesh = buildNativeBoneyardShadowMesh([], [])
  assert.equal(mesh.positions.length, 0)
  assert.equal(mesh.alphas.length, 0)
  assert.equal(mesh.indices.length, 0)
})

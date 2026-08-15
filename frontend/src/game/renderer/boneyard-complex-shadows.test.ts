import assert from 'node:assert/strict'
import test from 'node:test'

import {
  nativeBoneyardAlphaSilhouette,
  nativeBoneyardComplexShadowRecords,
  nativeBoneyardFenceGrateShadows,
  nativeBoneyardPackedShadowAlpha,
  nativeBoneyardProjectedShadowEdges,
  nativeBoneyardProjectedShadowMesh,
  nativeBoneyardRailsShadows,
  nativeBoneyardTreeComplexShadowOutline,
  nativeBoneyardWallShadow,
  type NativeBoneyardComplexShadowCaster,
} from './boneyard-complex-shadows.ts'
import {
  nativeBuildingShadowOutline,
  nativeFencepostShadowOutline,
  nativeGoodieShadowOutline,
  nativeGravestoneShadowOutline,
  nativeMonumentShadowOutline,
} from './boneyard-native-shadow-shapes.ts'

test('packs shadow vertex alpha through the native 8-bit truncation boundary', () => {
  assert.equal(nativeBoneyardPackedShadowAlpha(9.459294673673612e-7), 0)
  assert.equal(nativeBoneyardPackedShadowAlpha(0.5), 127 / 255)
  assert.equal(nativeBoneyardPackedShadowAlpha(1), 1)
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

test('derives a bounded non-rectangular convex silhouette from native alpha art', () => {
  const width = 5
  const height = 5
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (const [x, y] of [[2, 0], [0, 2], [2, 2], [4, 2], [2, 4]]) {
    pixels[(y * width + x) * 4 + 3] = 255
  }
  const outline = nativeBoneyardAlphaSilhouette(pixels, width, height)
  assert.ok(outline.length > 4)
  assert.ok(outline.length <= 16)
  assert.deepEqual(
    outline,
    nativeBoneyardAlphaSilhouette(pixels, width, height),
  )
  assert.deepEqual(
    {
      maxX: Math.max(...outline.map(({ x }) => x)),
      maxY: Math.max(...outline.map(({ y }) => y)),
      minX: Math.min(...outline.map(({ x }) => x)),
      minY: Math.min(...outline.map(({ y }) => y)),
    },
    { maxX: 5, maxY: 5, minX: 0, minY: 0 },
  )
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

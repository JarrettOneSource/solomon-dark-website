import assert from 'node:assert/strict'
import test from 'node:test'

import {
  nativeBoneyardAlphaSilhouette,
  nativeBoneyardComplexShadowRecords,
  nativeBoneyardProjectedShadowEdges,
  type NativeBoneyardComplexShadowCaster,
} from './boneyard-complex-shadows.ts'

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
    multipleShadows: true,
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
      [{ ...source, multipleShadows: false }],
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
    multipleShadows: true,
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
      multipleShadows: true,
      position: { x: -100, y: 0 },
      radius: 1,
    },
    {
      intensity: 1,
      multipleShadows: true,
      position: { x: 0, y: -85 },
      radius: 1,
    },
  ]
  const records = nativeBoneyardComplexShadowRecords(caster, sources, 4)
  assert.equal(records.length, 2)
  assert.equal(records[0]?.baseAlpha, records[1]?.distanceFraction)
  assert.equal(records[1]?.baseAlpha, records[0]?.distanceFraction)
})

test('projects only source-facing outline edges away from the source', () => {
  const caster = { ...squareCaster, position: { x: 0, y: 0 } }
  const [edge] = nativeBoneyardProjectedShadowEdges(caster, {
    baseAlpha: 0.8,
    behindScalar: 0.25,
    direction: { x: 1, y: 0 },
    distanceFraction: 0.2,
    projectionDistance: 20,
    sourcePosition: { x: -10, y: 0 },
    sourceRadius: 1,
  })
  assert.ok(edge)
  assert.equal(nativeBoneyardProjectedShadowEdges(caster, {
    baseAlpha: 0.8,
    behindScalar: 0.25,
    direction: { x: 1, y: 0 },
    distanceFraction: 0.2,
    projectionDistance: 20,
    sourcePosition: { x: -10, y: 0 },
    sourceRadius: 1,
  }).length, 1)
  assert.equal(edge.baseStart.x, -1)
  assert.equal(edge.baseEnd.x, -1)
  assert.ok(edge.tipStart.x > edge.baseStart.x)
  assert.ok(edge.tipEnd.x > edge.baseEnd.x)
  assert.equal(edge.baseAlpha, 0.8)
  assert.ok(Math.abs(edge.tipAlpha - 0.216) < 1e-12)
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

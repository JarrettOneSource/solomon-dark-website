import assert from 'node:assert/strict'
import test from 'node:test'
import type { BoneyardRoad, BoneyardTerrain } from './boneyard.ts'
import { buildNativeBridgeSurfaces, buildNativeTerrainSurface, nativeBridgeSurfaceContains, nativeSurfaceQuadContains, type NativeSurfaceQuad } from './native-terrain-surface.ts'
import { createNativeRng, drawNativeFloat } from './native-rng.ts'

const river = (uid = 42001): BoneyardTerrain => ({ eid: 'river', pos: { x: 900, y: 900 }, uid, style: 0,
  points: [{ x: 100, y: 200 }, { x: 300, y: 200 }] })
const road = (points: BoneyardRoad['points']): BoneyardRoad => ({ eid: 'road', typeId: 3007, linkMask: 0, points })
const box: NativeSurfaceQuad = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }]

test('Terrain UID seeds the native inclusive-width draws and first pair shares them', () => {
  const shape = buildNativeTerrainSurface(river())
  let rng = createNativeRng(42001)
  const draws: number[] = []
  for (let i = 0; i < 4; i += 1) { const draw = drawNativeFloat(rng, 16.25); rng = draw.state; draws.push(draw.value) }
  const left = Math.fround(draws[1] * 0.5 + 32.5)
  const right = Math.fround(draws[2] * 0.5 + 32.5)
  assert.equal(shape.quads.length, 2)
  assert.deepEqual(shape.quads[0][2], { x: 100, y: Math.fround(200 - left) })
  assert.deepEqual(shape.quads[0][3], { x: 100, y: Math.fround(200 + right) })
  assert.equal(shape.quads[0][0].y, shape.quads[0][2].y)
  assert.equal(shape.quads[0][1].y, shape.quads[0][3].y)
  assert.notDeepEqual(shape.quads, buildNativeTerrainSurface(river(99)).quads)
  assert.deepEqual(shape, buildNativeTerrainSurface(river()))
})

test('style zero ignores profile and side sign; other styles never register', () => {
  const expected = buildNativeTerrainSurface(river())
  for (const sideSign of [-1, 0, 1, 2]) {
    assert.deepEqual(buildNativeTerrainSurface({ ...river(), profileSamples: [0, 3, -2], sideSign }), expected)
  }
  for (const style of [1, 2, -1, 20]) assert.deepEqual(buildNativeTerrainSurface({ ...river(), style }).quads, [])
  assert.equal(nativeSurfaceQuadContains(expected.quads[0], { x: 150, y: 200 }), true)
  assert.equal(nativeSurfaceQuadContains(expected.quads[0], { x: 150, y: 245 }), false)
})

test('native triangle signs preserve winding-specific boundaries and zero-area behavior', () => {
  const reverse: NativeSurfaceQuad = [box[1], box[0], box[3], box[2]]
  assert.equal(nativeSurfaceQuadContains(box, { x: 50, y: 50 }), true)
  assert.equal(nativeSurfaceQuadContains(reverse, { x: 50, y: 50 }), false)
  assert.equal(nativeSurfaceQuadContains(box, { x: 0, y: 50 }), true)
  assert.equal(nativeSurfaceQuadContains(reverse, { x: 0, y: 50 }), false)
  assert.equal(nativeSurfaceQuadContains(box, { x: -0.00001, y: 50 }), false)
  const p = { x: 4, y: 8 }
  assert.equal(nativeSurfaceQuadContains([p, p, p, p], { x: 1e6, y: -1e6 }), true)
})

test('first quad and authored Terrain order determine bridge construction', () => {
  const later = box.map((p) => ({ x: p.x, y: p.y + 200 })) as unknown as NativeSurfaceQuad
  const crossing = road([{ x: 50, y: -50 }, { x: 50, y: 350 }])
  const result = buildNativeBridgeSurfaces([{ cursors: [], quads: [box, later] }], [crossing])
  assert.equal(result.length, 1)
  assert.equal(nativeSurfaceQuadContains(result[0].quad, { x: 50, y: 55 }), true)
  assert.equal(nativeSurfaceQuadContains(result[0].quad, { x: 50, y: 250 }), false)
  const all = buildNativeBridgeSurfaces([{ cursors: [], quads: [box] }, { cursors: [], quads: [later] }], [crossing])
  assert.equal(all.length, 2)
  assert.ok(all[0].bounds.y < all[1].bounds.y)
})

test('bridge uses endpoint admission, midpoint fallback, native offsets and world-Y scale', () => {
  const short = road([{ x: 40, y: 50 }, { x: 60, y: 50 }])
  const [bridge] = buildNativeBridgeSurfaces([{ cursors: [], quads: [box] }], [short])
  assert.ok(bridge)
  // Both endpoints inside: no boundary intersections, equal sentinels. Native
  // midpoint50 +15 direction +5 direction places the glyph at70,50.
  assert.ok(Math.abs((bridge.quad[0].x + bridge.quad[3].x) / 2 - 70) < 0.0001)
  assert.ok(Math.abs((bridge.quad[0].y + bridge.quad[3].y) / 2 - 50) < 0.0001)
  assert.ok(Math.abs(bridge.bounds.w - 135) < 0.0001)
  assert.ok(Math.abs(bridge.bounds.h - Math.fround(72 * Math.fround(0.9))) < 0.0001)
  const changed = { ...short, style: 4, startWidthScale: 10, endWidthScale: 0.1, quad: laterQuad() }
  assert.deepEqual(buildNativeBridgeSurfaces([{ cursors: [], quads: [box] }], [changed]), [bridge])
  assert.deepEqual(buildNativeBridgeSurfaces([{ cursors: [], quads: [box] }], [road([{ x: -10, y: -10 }, { x: -10, y: 200 }])]), [])
})
function laterQuad(): NativeSurfaceQuad { return box.map((p) => ({ x: p.x + 200, y: p.y + 200 })) as unknown as NativeSurfaceQuad }

test('curved QuickSpline sample selection keeps native tangent, arc table and normal order', () => {
  const shape = buildNativeTerrainSurface({ ...river(), points: [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 0 }] })
  // Instruction-derived QuickSpline recurrence, 0.025/2.5 arc table,
  // 20/120 length conversion, then 0.995 tangent-change admission.
  assert.deepEqual(shape.cursors, [0, 0.5243602395057678, 0.6991469860076904, 0.873933732509613,
    1.0487204790115356, 1.2235071659088135, 1.3982939720153809, 1.5730807781219482, 1.922654390335083, 2])
  assert.equal(shape.quads.length, 9)
  assert.deepEqual(shape.quads[0], [
    { x: 69.07649230957031, y: 40.6563835144043 }, { x: 18.28387451171875, y: 83.9683609008789 },
    { x: 29.239856719970703, y: -17.407400131225586 }, { x: -28.117237091064453, y: 16.739070892333984 },
  ])
  for (let i = 1; i < shape.quads.length; i += 1) assert.deepEqual(shape.quads[i].slice(2), shape.quads[i - 1].slice(0, 2))
  assert.equal(shape.quads.some((quad) => nativeSurfaceQuadContains(quad, { x: 100, y: 90 })), true)
  assert.equal(shape.quads.some((quad) => nativeSurfaceQuadContains(quad, { x: 100, y: 0 })), false)
})

test('long straight river uses strict maximum-gap comparison and repeated float32 cursor adds', () => {
  const shape = buildNativeTerrainSurface({ ...river(), points: [{ x: 0, y: 0 }, { x: 400, y: 0 }] })
  assert.deepEqual(shape.cursors, [0, 0.3500000238418579, 0.6500000953674316, 0.9500001668930054, 1])
  assert.equal(shape.quads[0][0].x, 140.00001525878906)
  assert.equal(shape.quads.at(-1)![0].x, 400)
  assert.deepEqual(buildNativeTerrainSurface({ ...river(), points: [{ x: 0, y: 0 }, { x: 40, y: 0 }] }).cursors, [0, 1])
})


test('bridge rectangle includes left/top, excludes right/bottom, and does not round upper sums', () => {
  const bridge = { quad: box, bounds: { x: 0, y: 0, w: 100, h: 100 } }
  assert.equal(nativeBridgeSurfaceContains(bridge, { x: 0, y: 50 }), true)
  assert.equal(nativeBridgeSurfaceContains(bridge, { x: 50, y: 0 }), true)
  assert.equal(nativeBridgeSurfaceContains(bridge, { x: 100, y: 50 }), false)
  assert.equal(nativeBridgeSurfaceContains(bridge, { x: 50, y: 100 }), false)
  const p = { x: 16777216, y: 16777216 }
  const zero: NativeSurfaceQuad = [p, p, p, p]
  assert.equal(nativeBridgeSurfaceContains({ quad: zero, bounds: { ...p, w: 1, h: 1 } }, p), true)
})

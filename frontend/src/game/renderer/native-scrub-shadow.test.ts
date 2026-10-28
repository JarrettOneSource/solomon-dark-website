import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeRng, drawNativeInteger } from '../core-kernels/native-rng.ts'
import { nativeBoneyardComplexShadowRecords, type NativeBoneyardComplexShadowRecord } from './boneyard-complex-shadows.ts'
import { nativeBoneyardMainLayerShadowCaster } from './boneyard-shadow-casters.ts'
import { nativeEnemySpriteGeometry } from './native-enemy-assets.ts'
import { NativeScrubShadowState, nativeScrubGlyph, nativeScrubShadowPlan } from './native-scrub-shadow.ts'

const position = { x: 200, y: 300 }
const glyph = { anchorX: 20, anchorY: 60, width: 40, height: 80 }
const record: NativeBoneyardComplexShadowRecord = {
  baseAlpha: .2, behindScalar: .9, direction: { x: 1, y: 0 },
  distanceFraction: .25, projectionDistance: 100, sourcePosition: { x: 150, y: 300 }, sourceRadius: 1,
}

for (const [variant, width, height, anchorX, anchorY] of [
  [15, 67, 85, 31, 61], [16, 64, 81, 30, 58], [17, 58, 79, 29, 56], [18, 53, 79, 22, 57],
]) {
  test(`Scrub variant${variant} preserves registered glyph${264 + variant} and never selects a Tree hull`, () => {
    const actual = nativeScrubGlyph(variant)
    assert.equal(actual.width, width)
    assert.equal(actual.height, height)
    assert.equal(actual.anchorX, anchorX)
    assert.equal(actual.anchorY, anchorY)
    const object = { eid: `scrub-${variant}`, typeId: 2062, pos: position, variant }
    const layer = { kind: 'object' as const, object, sel: { kind: 'object' as const, eid: object.eid },
      atlas: 'DeadHawg', atlasEntry: 264 + variant, pos: position, worldY: position.y, sortBias: 0, sortKey: 0, sourceOrder: 0 }
    assert.equal(nativeBoneyardMainLayerShadowCaster({ fences: [] } as never, layer, 0), null)
    const state = new NativeScrubShadowState(0, 10)
    const basic = nativeScrubShadowPlan(actual, position, state, [], false, () => { throw new Error('basic branch sampled a surface') })
    assert.equal(basic.length, 1)
    assert.equal(basic[0]!.role, 'scrub-flat-shadow')
    assert.deepEqual(basic[0]!.alphas, [1, 1, 1, 1])
    assert.equal(basic[0]!.tint, 0)
    assert.equal(state.uvInset, 0)
    const complex = nativeScrubShadowPlan(actual, position, state, [record], true, () => false)
    assert.equal(complex.length, 1)
    assert.equal(complex[0]!.role, 'scrub-directional-shadow')
    assert.deepEqual(complex[0]!.alphas, [0, 0, 1, 1])
    assert.equal(complex[0]!.uvs[2].y, Math.fround(.8))
    assert.equal(complex[0]!.uvs[3].y, Math.fround(.8))
  })
}

test('Scrub phase consumes the native Int360 then exactly one Int3 per world tick', () => {
  const initial = drawNativeInteger(createNativeRng(123), 360)
  const state = new NativeScrubShadowState(123, 20)
  assert.equal(state.phase, initial.value)
  state.advanceTo(20)
  assert.equal(state.phase, initial.value)
  let rng = initial.state
  let phase = initial.value
  for (let tick = 21; tick <= 28; tick += 1) {
    const draw = drawNativeInteger(rng, 3)
    rng = draw.state
    phase += draw.value
  }
  state.advanceTo(28)
  assert.equal(state.phase, phase)
  state.advanceTo(28)
  assert.equal(state.phase, phase)
})

test('Scrub flat shadow offsets only its top corners with original glyph UVs', () => {
  const state = new NativeScrubShadowState(0, 0)
  const [flat] = nativeScrubShadowPlan(glyph, position, state, [record], false, () => false)
  assert.deepEqual(flat!.vertices, [{ x: 0, y: -35 }, { x: 40, y: -35 }, { x: -20, y: 20 }, { x: 20, y: 20 }])
  assert.deepEqual(flat!.uvs, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }])
})

test('Scrub queries and caches all three native surface points only on first complex draw', () => {
  const state = new NativeScrubShadowState(1, 0)
  const samples: { x: number, y: number }[] = []
  const first = nativeScrubShadowPlan(glyph, position, state, [], true, point => {
    samples.push({ ...point })
    return samples.length === 1
  })
  assert.deepEqual(samples, [position, { x: 200, y: 310 }, { x: 200, y: 290 }])
  assert.equal(first.length, 1)
  assert.equal(first[0]!.role, 'scrub-surface-reflection')
  assert.equal(first[0]!.tint, 0xffffff)
  assert.ok(first[0]!.alphas.every(alpha => alpha === Math.fround(.35)))
  const cached = () => { throw new Error('cached surface was queried twice') }
  nativeScrubShadowPlan(glyph, position, state, [], true, cached)
  nativeScrubShadowPlan(glyph, position, state, [], false, cached)
  nativeScrubShadowPlan(glyph, position, state, [], true, cached)
})

test('Scrub directional shadows consume one quad per accepted source and vanish with the source', () => {
  const state = new NativeScrubShadowState(2, 0)
  const caster = { id: 'scrub', outline: [], position }
  const sources = [-50, 50].map(dx => ({ position: { x: position.x + dx, y: position.y }, radius: 1,
    intensity: 1, castsDirectionalShadow: true }))
  const records = nativeBoneyardComplexShadowRecords(caster, sources, 0)
  assert.equal(records.length, 2)
  const plan = nativeScrubShadowPlan(glyph, position, state, records, true, () => false)
  assert.equal(plan.length, 2)
  for (let index = 0; index < 2; index += 1) {
    const quad = plan[index]!
    const source = records[index]!
    assert.equal(Math.sign(quad.vertices[0].x - quad.vertices[2].x), Math.sign(source.direction.x))
    assert.equal(quad.vertices[0].y, quad.vertices[2].y)
  }
  assert.deepEqual(nativeScrubShadowPlan(glyph, position, state, [], true, () => false), [])
})

for (const [direction, expectedNear, expectedFar] of [
  [{ x: 1, y: 0 }, { x: 0, y: -16 }, { x: 62.5, y: -16 }],
  [{ x: -1, y: 0 }, { x: 0, y: 16 }, { x: -62.5, y: 16 }],
  [{ x: 0, y: 1 }, { x: 20, y: 4 }, { x: 20, y: 66.5 }],
  [{ x: 0, y: -1 }, { x: -20, y: -4 }, { x: -20, y: -66.5 }],
  [{ x: .6, y: .8 }, { x: 16, y: -6.4 }, { x: 53.5, y: 43.6 }],
] as const) {
  test(`Scrub transforms only the glyph bottom edge for light direction(${direction.x},${direction.y})`, () => {
    const [quad] = nativeScrubShadowPlan(glyph, position, new NativeScrubShadowState(0, 0),
      [{ ...record, direction }], true, () => false)
    closePoint(quad!.vertices[2], expectedNear)
    closePoint(quad!.vertices[0], expectedFar)
  })
}

test('Scrub close-light compression clamps the first X scale at ten times distanceFraction', () => {
  const state = new NativeScrubShadowState(0, 0)
  const plan = (distanceFraction: number) => nativeScrubShadowPlan(glyph, position, state,
    [{ ...record, distanceFraction }], true, () => false)[0]!
  closePoint(plan(.05).vertices[2], { x: 0, y: -8 })
  closePoint(plan(.05).vertices[0], { x: 2.5, y: -8 })
  closePoint(plan(.1).vertices[2], { x: 0, y: -16 })
  closePoint(plan(.9).vertices[2], { x: 0, y: -16 })
})

function closePoint(actual: Readonly<{ x: number, y: number }>, expected: Readonly<{ x: number, y: number }>): void {
  assert.ok(Math.abs(actual.x - expected.x) < .00002, `x ${actual.x} != ${expected.x}`)
  assert.ok(Math.abs(actual.y - expected.y) < .00002, `y ${actual.y} != ${expected.y}`)
}


test('Scrub reflection uses independent DeadHawg21 geometry and the native radians sway', () => {
  const state = new NativeScrubShadowState(1, 0)
  const reflectionGlyph = nativeEnemySpriteGeometry('DeadHawg', 21)
  for (const phase of [0, 1, 90, 180, 360, 98765]) {
    state.phase = phase
    const [reflection, directional] = nativeScrubShadowPlan(glyph, position, state, [record], true, () => true)
    const scale = Math.fround(Math.abs(Math.fround(Math.sin(Math.fround(phase / 3)))) * .25 + Math.fround(.6))
    assert.equal(reflection!.role, 'scrub-surface-reflection')
    assert.equal(directional!.role, 'scrub-directional-shadow')
    assert.deepEqual(reflection!.vertices[0], {
      x: Math.fround(-reflectionGlyph.anchorX * scale), y: Math.fround(-reflectionGlyph.anchorY * scale),
    })
    assert.deepEqual(reflection!.vertices[3], {
      x: Math.fround((reflectionGlyph.width - reflectionGlyph.anchorX) * scale),
      y: Math.fround((reflectionGlyph.height - reflectionGlyph.anchorY) * scale),
    })
  }
})

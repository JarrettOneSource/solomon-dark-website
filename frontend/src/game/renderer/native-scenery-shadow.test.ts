import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { Texture } from 'pixi.js'
import type { MainLayer } from '../../editor/native-render-plan.ts'
import { nativeEnemySpriteGeometry } from './native-enemy-assets.ts'
import {
  nativeFlatGlyphShadowVertices, nativeSceneryShadowPlan,
  nativeGoodieShadowPlan, nativeWallSkirtPlan,
  nativeSceneryGlyphTexture,
} from './native-scenery-shadow.ts'

test('all scenery glyph bindings resolve original loaded atlas frames without enemy-only selection', () => {
  const source = readFileSync(new URL('./boneyard-combat-atlas.generated.ts', import.meta.url), 'utf8')
  const seen: string[] = []
  const atlas = { single: (key: string) => { seen.push(key); return Texture.WHITE } }
  for (const [first, last] of [[3, 3], [36, 42], [97, 113], [145, 151], [156, 176], [228, 250], [264, 278], [320, 347]]) {
    for (let entry = first!; entry <= last!; entry += 1) {
      assert.equal(nativeSceneryGlyphTexture(atlas, entry), Texture.WHITE)
      const key = `boneyard-combat:DeadHawg:${entry}`
      assert.equal(seen.at(-1), key)
      assert.ok(source.includes(`["${key}", [`), `Missing original frame ${key}`)
    }
  }
})

function object(typeId: number, variant = 0, extra = {}): MainLayer {
  const placed = { eid: 'probe', typeId, variant, pos: { x: 200, y: 300 }, ...extra }
  return { kind: 'object', object: placed, atlas: 'DeadHawg', atlasEntry: 0,
    pos: placed.pos, sel: { kind: 'object', eid: placed.eid }, worldY: 300,
    sortBias: 0, sortKey: 300, sourceOrder: 0 }
}

function fence(code: number, part: 'post' | 'body' = 'body', selector = 0): MainLayer {
  const line = { eid: 'fence', typeId: 3005, segmentCode: code, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }
  return { kind: 'fence', fence: line, part, postVariant: selector, pieceIndex: 0,
    pos: { x: 50, y: 0 }, sel: { kind: 'fence', eid: line.eid }, worldY: 0,
    sortBias: -15, sortKey: -15, sourceOrder: 0 }
}

test('shared flat glyph shadow shifts only original top corners and preserves registration', () => {
  assert.deepEqual(nativeFlatGlyphShadowVertices({ width: 52, height: 52, anchorX: 27, anchorY: 33 }), [
    { x: -14, y: -16.75 }, { x: 38, y: -16.75 },
    { x: -27, y: 19 }, { x: 25, y: 19 },
  ])
})

test('every authored scenery glyph replaces the off-branch oval without changing on polygons', () => {
  for (const [type, count, first] of [[2029, 17, 97], [2009, 21, 156], [2040, 4, 148]]) {
    for (let variant = 0; variant < count!; variant += 1) {
      const layer = object(type!, variant)
      assert.deepEqual(nativeSceneryShadowPlan(layer, true), [])
      const plan = nativeSceneryShadowPlan(layer, false)
      assert.equal(plan.length, 1)
      assert.equal(plan[0]!.texture, first! + variant)
      assert.equal(plan[0]!.tint, 0)
      assert.deepEqual(plan[0]!.alphas, [1, 1, 1, 1])
      const glyph = nativeEnemySpriteGeometry('DeadHawg', first! + variant)
      assert.deepEqual(plan[0]!.vertices, nativeFlatGlyphShadowVertices(glyph).map(p => ({ x: p.x + 200, y: p.y + 300 })))
    }
  }
})

test('all fifteen Tree root masks are unconditional and independent of secondary visibility', () => {
  for (let variant = 0; variant < 15; variant += 1) {
    const layer = object(2001, variant, { secondaryVisible: false })
    const on = nativeSceneryShadowPlan(layer, true)
    const off = nativeSceneryShadowPlan(layer, false)
    assert.equal(on.length, 1)
    assert.equal(on[0]!.texture, 228 + variant)
    assert.equal(on[0]!.tint, 0xffffff)
    assert.deepEqual(off[0], on[0])
    assert.equal(off[1]!.texture, 264 + variant)
    assert.deepEqual(on[0]!.alphas, [1, 1, 1, 1])
  }
  assert.throws(() => nativeSceneryShadowPlan(object(2001, 15), true), RangeError)
})

test('all Tree secondary masks use their own height at root plus25 only in the enabled off branch', () => {
  for (let variant = 0; variant < 6; variant += 1) {
    for (let secondaryVariant = 0; secondaryVariant < 21; secondaryVariant += 1) {
      const layer = object(2001, variant, { secondaryVariant, secondaryVisible: true })
      const plan = nativeSceneryShadowPlan(layer, false)
      assert.equal(plan.length, secondaryVariant < 8 ? 3 : 2)
      if (secondaryVariant >= 8) continue
      assert.equal(plan[2]!.texture, 243 + secondaryVariant)
      const glyph = nativeEnemySpriteGeometry('DeadHawg', 243 + secondaryVariant)
      assert.deepEqual(plan[2]!.vertices, nativeFlatGlyphShadowVertices(glyph).map(p => ({ x: p.x + 200, y: p.y + 325 })))
      assert.equal(nativeSceneryShadowPlan(layer, true).length, 1)
    }
  }
  assert.equal(nativeSceneryShadowPlan(object(2001, 6, { secondaryVisible: true }), false).length, 2)
})

test('post masks drain both native glyph banks and Goodie mask follows every live phase', () => {
  for (const [code, count, first] of [[0, 7, 36], [4, 28, 320]]) {
    for (let selector = 0; selector < count!; selector += 1) {
      assert.equal(nativeSceneryShadowPlan(fence(code!, 'post', selector), false)[0]!.texture, first! + selector)
      assert.deepEqual(nativeSceneryShadowPlan(fence(code!, 'post', selector), true), [])
    }
  }
  for (const phase of [0, 1, 2] as const) {
    const plan = nativeGoodieShadowPlan({ position: { x: 1, y: 2 }, subtype: 0, phase }, false)
    assert.equal(plan[0]!.texture, 145 + phase)
    assert.deepEqual(nativeGoodieShadowPlan({ position: { x: 1, y: 2 }, subtype: 0, phase }, true), [])
  }
})

test('intact and Rails off masks preserve repeating quad UVs while Gate/Broken add no invented mask', () => {
  const grate = nativeSceneryShadowPlan(fence(0), false)[0]!
  assert.deepEqual(grate.vertices, [{ x: 22, y: -42 }, { x: 98, y: -42 }, { x: 12, y: 0 }, { x: 88, y: 0 }])
  assert.equal(grate.texture, 'fence-grate')
  assert.deepEqual(grate.alphas, [.5, .5, .5, .5])
  assert.equal(grate.uvs[1]!.x, Math.fround(76 / 53.33333121405716))
  const rails = nativeSceneryShadowPlan(fence(4), false)[0]!
  for (const [index, expected] of [[0, [14, -7]], [1, [106, -7]], [2, [4, 3]], [3, [96, 3]]] as const) {
    assert.ok(Math.abs(rails.vertices[index]!.x - expected[0]) < .00001)
    assert.ok(Math.abs(rails.vertices[index]!.y - expected[1]) < .00001)
  }
  assert.deepEqual(nativeSceneryShadowPlan(fence(0), true), [])
  assert.deepEqual(nativeSceneryShadowPlan(fence(4), true), [])
  for (const code of [1, 2]) for (const enabled of [false, true]) {
    assert.deepEqual(nativeSceneryShadowPlan(fence(code), enabled), [])
  }
})

test('Wall skirt is an unconditional twenty-unit gradient and non-casters have no fallback', () => {
  const plan = nativeWallSkirtPlan({ x: -15, y: 7 }, { x: 120, y: 45 })
  assert.deepEqual(plan.vertices, [{ x: -15, y: 7 }, { x: 120, y: 45 }, { x: -15, y: 27 }, { x: 120, y: 65 }])
  assert.deepEqual(plan.alphas, [1, 1, 0, 0])
  for (const type of [2062, 9999]) for (const enabled of [false, true]) {
    assert.deepEqual(nativeSceneryShadowPlan(object(type), enabled), [])
  }
})

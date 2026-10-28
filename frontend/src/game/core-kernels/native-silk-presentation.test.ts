import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeRng } from './native-rng.ts'
import { createNativeSilk } from './native-silk.ts'
import { nativeSilkCurvePoint, nativeSilkMesh } from './native-silk-presentation.ts'
import { nativeLineColor } from './native-line.ts'

const silk = createNativeSilk(
  { x: 100, y: 200 },
  { position: { x: 100, y: 600 }, velocityPerTick: { x: 0, y: 0 } },
  10, createNativeRng(315),
).state

test('Silk draws its native two-pixel gradient, translated above the path, with an initially transparent head', () => {
  assert.equal(nativeSilkMesh(silk, () => 1, createNativeRng(5)).segmentCount, 0)
  const state = { ...silk, phase: 2, height: 12, drift: { x: 3, y: 4 } }
  const samples: { x: number; y: number }[] = []
  const mesh = nativeSilkMesh(state, point => { samples.push(point); return 1 }, createNativeRng(5))
  assert.equal(samples.length, 2)
  assert.equal(mesh.segmentCount, 3)
  assert.equal(mesh.colors[0], nativeLineColor(Math.fround(0.95), 1, 1, 0))
  assert.equal(mesh.colors[2], nativeLineColor(Math.fround(0.95), 1, 1, 0.5))
  const head = nativeSilkCurvePoint(state, 2)
  assert.ok(Math.abs((mesh.vertices[0]! + mesh.vertices[2]!) / 2 - head.x) < 0.0001)
  assert.ok(Math.abs((mesh.vertices[1]! + mesh.vertices[3]!) / 2 - head.y) < 0.0001)
  assert.ok(Math.abs(Math.hypot(mesh.vertices[2]! - mesh.vertices[0]!, mesh.vertices[3]! - mesh.vertices[1]!) - 2) < 0.0001)
  assert.equal(mesh.indices.length, (mesh.segmentCount + mesh.sparkleCount) * 6)
})

test('Silk clips its retained trail to sixteen phase units and samples the two native lighting endpoints', () => {
  const state = { ...silk, phase: 18 }
  const lightSamples: { x: number; y: number }[] = []
  const mesh = nativeSilkMesh(state, point => { lightSamples.push(point); return 0.25 }, createNativeRng(41))
  assert.equal(mesh.segmentCount, 20)
  assert.equal(mesh.colors[0], nativeLineColor(Math.fround(0.95) * 0.25, 0.25, 0.25, 0))
  assert.ok(lightSamples[0]!.y > lightSamples[1]!.y)
  assert.ok(lightSamples[1]!.y > 200)
  assert.deepEqual(mesh, nativeSilkMesh(state, () => 0.25, createNativeRng(41)))
})

test('the shared native line color packer preserves truncation and eight-bit channel wrapping', () => {
  assert.equal(nativeLineColor(1.25, 1, 0, 0.5), 0x7f00ff3e)
})

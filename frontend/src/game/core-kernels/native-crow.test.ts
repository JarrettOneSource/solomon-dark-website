import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeCrow, stepNativeCrow } from './native-crow.ts'
import { createNativeRng } from './native-rng.ts'

const parent = { x: 0, y: 0 }
const visible = () => true

test('Crow construction preserves native flight ranges and immutable continuation', () => {
  const initial = createNativeCrow(1, createNativeRng(123))
  assert.equal(initial.crow.position, null)
  assert.ok(initial.crow.orbitRadius >= 40 && initial.crow.orbitRadius <= 80)
  assert.ok(initial.crow.height >= 100 && initial.crow.height <= 150)
  assert.ok(initial.crow.maximumSpeed >= Math.fround(.95) && initial.crow.maximumSpeed <= Math.fround(1.1))
  assert.deepEqual(stepNativeCrow(initial.crow, initial.rng, parent, false, [], visible),
    stepNativeCrow(structuredClone(initial.crow), structuredClone(initial.rng), parent, false, [], visible))
})

test('Crow polls at maximum speed and locks the first eligible native target', () => {
  const initial = createNativeCrow(1, createNativeRng(31))
  const source = { ...initial.crow, age: 4, headingDeg: 0, position: { x: 0, y: 0 },
    orbitPhaseDeg: 0, orbitRadius: 70 }
  const targets = [{ id: 'first', position: { x: 0, y: -125 } },
    { id: 'second', position: { x: 0, y: -115 } }]
  const result = stepNativeCrow(source, initial.rng, parent, true, targets, visible)
  assert.equal(result.crow?.phase, 'dive')
  assert.equal(result.crow?.targetId, 'first')
  assert.ok(result.parentCooldownTicks! >= 50 && result.parentCooldownTicks! <= 125)
  assert.equal(source.phase, 'orbit')
})

test('Crow cannot acquire while its parent cooldown is held', () => {
  const initial = createNativeCrow(1, createNativeRng(31))
  const source = { ...initial.crow, age: 4, headingDeg: 0, position: { x: 0, y: 0 },
    orbitPhaseDeg: 0, orbitRadius: 70 }
  const result = stepNativeCrow(source, initial.rng, parent, false,
    [{ id: 'target', position: { x: 0, y: -125 } }], visible)
  assert.equal(result.crow?.phase, 'orbit')
  assert.equal(result.parentCooldownTicks, null)
})

test('Crow dive strikes its locked target below height 15 and returns to orbit', () => {
  const initial = createNativeCrow(2, createNativeRng(51))
  const source = { ...initial.crow, phase: 'dive' as const, height: 15,
    heightPerDistance: 1, diveSpeed: 3, targetId: 'locked', position: { x: 0, y: 0 } }
  const result = stepNativeCrow(source, initial.rng, parent, false, [], visible)
  assert.equal(result.struckTargetId, 'locked')
  assert.equal(result.crow?.phase, 'orbit')
  assert.equal(result.crow?.speed, -1)
  assert.ok(result.crow!.orbitRadius >= 40 && result.crow!.orbitRadius <= 120)
})

test('Detached Crows climb and retire at the projected viewport boundary', () => {
  const initial = createNativeCrow(2, createNativeRng(51))
  const source = { ...initial.crow, height: 60, speed: -1, position: parent }
  const alive = stepNativeCrow(source, initial.rng, null, false, [], visible)
  assert.ok(alive.crow!.height > source.height)
  assert.equal(alive.struckTargetId, null)
  const retired = stepNativeCrow(source, initial.rng, null, false, [], () => false)
  assert.equal(retired.crow, null)
})

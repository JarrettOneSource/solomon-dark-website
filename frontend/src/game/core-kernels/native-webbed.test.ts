import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyNativeWebbed, damageNativeCocoon, nativeCocoonPosition,
  nativeWebbedMovementScale, stepNativeWebbed,
} from './native-webbed.ts'

test('three admitted Silk contacts restrain the player; repeated contacts preserve remaining Cocoon HP', () => {
  const first = applyNativeWebbed(null, 10)
  assert.equal(first.severity, 1)
  assert.equal(first.cocoonHealth, 0)
  assert.ok(nativeWebbedMovementScale(first) > 0)
  const second = applyNativeWebbed(first, 50)
  assert.equal(second.severity, 2)
  const full = applyNativeWebbed(second, 10)
  assert.equal(full.severity, 3)
  assert.equal(full.cocoonHealth, 50)
  assert.equal(nativeWebbedMovementScale(full), 0)
  const damaged = damageNativeCocoon(full, 15, 1)!
  assert.equal(damaged.cocoonHealth, 35)
  assert.equal(applyNativeWebbed(damaged, 250).cocoonHealth, 35)
  assert.equal(damageNativeCocoon(damaged, 35, 1), null)
  assert.equal(nativeWebbedMovementScale(undefined), 1)
})

test('partial web wears off only above the native movement threshold and the next hit floors its stack', () => {
  const web = applyNativeWebbed(null, 10)
  assert.equal(stepNativeWebbed(web, { x: 0, y: 0 })!.severity, 1)
  assert.equal(stepNativeWebbed(web, { x: 0.5, y: 0.5 })!.severity, 1)
  const worn = stepNativeWebbed(web, { x: 1, y: 0 })!
  assert.equal(worn.severity, Math.fround(1 - Math.fround(0.001)))
  assert.equal(applyNativeWebbed(worn, 5).severity, 1)
  assert.equal(stepNativeWebbed({ ...web, severity: 0.0005 }, { x: 1, y: 0 }), null)
  assert.equal(stepNativeWebbed({ ...web, severity: 3 }, { x: 1, y: 0 })!.severity, 3)
  assert.equal(stepNativeWebbed({ ...web, hitPulse: 0.04 }, { x: 0, y: 0 })!.hitPulse, 0)
})

test('the full Cocoon collider follows the player heading sixty units ahead with the native offset', () => {
  assert.deepEqual(nativeCocoonPosition({ x: 100, y: 100 }, 0), {
    x: Math.fround(100.1), y: Math.fround(40.1),
  })
  assert.deepEqual(nativeCocoonPosition({ x: 100, y: 100 }, 90), {
    x: Math.fround(160.1), y: Math.fround(100.1),
  })
})

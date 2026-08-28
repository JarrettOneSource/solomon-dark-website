import assert from 'node:assert/strict'
import test from 'node:test'
import { Texture } from 'pixi.js'

import {
  DAMAGE_X4_VFX_TINT,
  PlayerDamageX4VfxView,
  nativeDamageX4VfxPlan,
} from './player-damage-x4-vfx-view.ts'

test('native Damage x4 plan pins both BadGuys-7 layers and the final-100-tick fade', () => {
  assert.deepEqual(nativeDamageX4VfxPlan(1_500, 12, 3), [
    { alpha: 1, rotationDegrees: 12, scale: 7.5 },
    { alpha: 1, rotationDegrees: -6, scale: 6 },
  ])
  assert.deepEqual(nativeDamageX4VfxPlan(100, 12, 1), [
    { alpha: 1, rotationDegrees: 12, scale: 2.5 },
    { alpha: 1, rotationDegrees: -6, scale: 2 },
  ])
  assert.equal(nativeDamageX4VfxPlan(99, 12, 1)[0]?.alpha, 0.99)
  assert.equal(nativeDamageX4VfxPlan(1, 12, 1)[0]?.alpha, 0.01)
  assert.deepEqual(nativeDamageX4VfxPlan(0, 12, 1), [])
  assert.deepEqual(nativeDamageX4VfxPlan(-1, 12, 1), [])
})

test('retained Damage x4 view applies exact additive gold state and tears down at zero', () => {
  const view = new PlayerDamageX4VfxView(Texture.EMPTY)
  view.update(100, 20, 2)
  assert.equal(view.visibleSpriteCount, 2)
  assert.equal(view.alpha, 1)
  assert.deepEqual(view.sprites.map((sprite) => sprite.tint), [
    DAMAGE_X4_VFX_TINT,
    DAMAGE_X4_VFX_TINT,
  ])
  assert.deepEqual(view.sprites.map((sprite) => sprite.blendMode), ['add', 'add'])
  assert.deepEqual(view.sprites.map((sprite) => sprite.scale.x), [5, 4])
  assert.deepEqual(view.sprites.map((sprite) => sprite.angle), [20, -10])

  view.update(1, 21, 1)
  assert.equal(view.alpha, 0.01)
  view.update(0, 22, 1)
  assert.equal(view.visibleSpriteCount, 0)
  assert.equal(view.alpha, 0)
  view.destroy()
  assert.equal(view.sprites.length, 0)
})

import { nativeBossSpellLight } from '../core-kernels/native-boss-spell-light.ts'
import assert from 'node:assert/strict'
import test from 'node:test'
import { Texture } from 'pixi.js'
import type { NativeBossSpell } from '../core-kernels/native-boss-spell.ts'
import { nativeDemonSkullBob, nativeDemonSkullEyes } from '../core-kernels/native-demon-skull-attachments.ts'
import { createNativeDemonSkull } from '../core-kernels/native-demon-skull.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { NativeBossSpellMesh } from './native-boss-spell-mesh.ts'
import { nativeBossSpellLayers } from './native-boss-spell-presentation.ts'
import { demonSkullPresentation } from './native-demon-skull-presentation.ts'
import { nativeEnemyIdleAnimationSample } from './native-enemy-animation.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import type { NativeEnemyVisualSnapshot } from './native-enemy-presentation-model.ts'
import { nativeUltraBanishPlan } from './native-ultra-banish-presentation.ts'

function enemy(): NativeEnemyVisualSnapshot {
  return { id: 1, nativeTypeId: 1008, enemyToken: 'DEMONSKULL', position: { x: 10, y: 20 }, headingDeg: 0,
    demonSkull: { ...createNativeDemonSkull(createNativeRng(1), 1).state, bodyHeadingDeg: 0 },
    animation: nativeEnemyIdleAnimationSample(), armored: false, arrowType: 'normal', burning: false,
    flags: [], headgear: 0, lighting: { charge: 0, glow: 1, providerCopies: 1 },
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 0 }, mageCloak: false, mageElement: 'fire',
    rotten: false, scale: 1, shieldHealth: 0, shieldMaximumHealth: 0, spawnTick: 0, weapon: 'claw' }
}

test('all 72 native head rows preserve their authored art and avoid nonexistent pose-two overlays', () => {
  for (let pose = 0; pose < 3; pose += 1) for (let facing = 0; facing < 24; facing += 1) {
    const source = enemy()
    const plan = demonSkullPresentation({ ...source, demonSkull: { ...source.demonSkull!, bodyPose: pose,
      bodyHeadingDeg: facing * 15, chargeGlow: 1, eyeCharge: 1 } }, 1)
    assert.equal(plan.body.find(value => value.role === 'discorporeal-body')?.entry, 99 + pose * 24 + facing)
    assert.ok(plan.body.every(value => value.entry < 219))
    for (const value of plan.body) assert.ok(nativeEnemySpriteRecord(value.atlas, value.entry))
    assert.equal(plan.body.some(value => value.role === 'discorporeal-charge-glow'), pose < 2)
  }
})

test('charge eyes retain the native doubled offset and bob, one jitter, and the before/after blend split', () => {
  const source = enemy()
  const state = { ...source.demonSkull!, bodyOffset: { x: 7, y: 23 }, jitter: { x: 3, y: -4 },
    bodyPhaseDeg: 90, eyeCharge: 1, bodyHeadingDeg: 180 }
  const plan = demonSkullPresentation({ ...source, demonSkull: state, scale: 2 }, 1)
  const points = nativeDemonSkullEyes({ x: 0, y: 0 }, state, 2, 180)
  for (const [index, eye] of points.entries()) {
    const glow = plan.body.find(layer => layer.role === `discorporeal-eye-charge-${index}`)!
    assert.equal(glow.offset.x, (eye.x + 7 + 3) / 2)
    assert.equal(glow.offset.y, (eye.y + 23 - 4 + nativeDemonSkullBob(90)) / 2)
    assert.equal(glow.scale, 2)
    assert.equal(glow.blendMode, eye.y + 45 < 23 + nativeDemonSkullBob(90) ? 'normal' : 'add')
  }
})

test('UltraBanish owns its gradient quads and light after the actor disappears', () => {
  const spell: Extract<NativeBossSpell, { kind: 'ultra-banish' }> = { id: 1, kind: 'ultra-banish',
    ownerActorId: 1, ageTicks: 50, spawnTick: 100, damage: 0, position: { x: 0, y: 0 },
    painterRegistration: { managerLane: 'transient', registrationOrdinal: 1 },
    remainingTicks: 100, alpha: 1, flashAlpha: 1.5, lightRadius: 1.4, megaDeath: false }
  const plan = nativeUltraBanishPlan(spell, 150, 900)
  assert.equal(plan.gradients.length, 12)
  assert.equal(plan.layers.length, 2)
  assert.equal(nativeUltraBanishPlan({ ...spell, flashAlpha: 0 }, 150, 900).gradients.length, 6)
  assert.ok(plan.gradients.every(rect => rect.width > 0 && rect.height > 0))
  assert.equal(nativeBossSpellLight(spell, 150, true)?.radius, 1.4)
  assert.equal(nativeBossSpellLayers(spell, 150).length, 2)
  const view = new NativeBossSpellMesh(spell, Texture.EMPTY)
  view.update(spell, 150, 900)
  let destroyed = false
  view.mesh.geometry.on('destroy', () => { destroyed = true })
  view.destroy()
  view.mesh.destroy()
  assert.equal(destroyed, true)
})

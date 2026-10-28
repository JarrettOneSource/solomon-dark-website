import assert from 'node:assert/strict'
import test from 'node:test'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import { createNativeDemonSkull } from '../core-kernels/native-demon-skull.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import type { NativeBoneyardComplexShadowRecord } from './boneyard-complex-shadows.ts'
import { nativeEnemyIdleAnimationSample } from './native-enemy-animation.ts'
import { nativeEnemySpriteRecord } from './native-enemy-assets.ts'
import { NATIVE_ENEMY_FAMILIES, type NativeEnemyFamily, type NativeEnemyVisualSnapshot } from './native-enemy-presentation-model.ts'
import { nativeEnemyUnderlayPlan } from './native-enemy-underlay.ts'

const light: NativeBoneyardComplexShadowRecord = {
  baseAlpha: .8, behindScalar: .25, direction: { x: 1, y: 0 }, distanceFraction: .5,
  projectionDistance: 377, sourcePosition: { x: -100, y: 0 }, sourceRadius: 1,
}

test('every enemy family selects its stock shadow callback in simple and complex modes', () => {
  const expected = { SKELETON: [1, 2], SKELETONARCHER: [1, 2], SKELETONMAGE: [1, 2],
    ZOMBIE: [1, 2], DIREFACULTY: [1, 2], HEARTMONGER: [1, 2], IMP: [0, 0], WRAITH: [0, 0],
    DEMON: [1, 1], DEMONSKULL: [1, 1], COFFIN: [1, 0], PORTAL: [3, 3], SPIDER: [1, 2], COCOON: [0, 0],
  } satisfies Record<NativeEnemyFamily, readonly [number, number]>
  for (const family of NATIVE_ENEMY_FAMILIES) {
    for (const complex of [false, true]) {
      const plan = nativeEnemyUnderlayPlan(enemy(family), 120, [light], .75, complex)
      assert.equal(plan.length, expected[family][Number(complex)], `${family}, complex=${complex}`)
      for (const layer of plan) assert.ok(nativeEnemySpriteRecord(layer.atlas, layer.entry))
    }
  }
  assert.deepEqual(nativeEnemyUnderlayPlan({ ...enemy('IMP'), nativeTypeId: 2044 }, 120, [light], .75, true), [])
})

test('Spider offsets the inherited shadow along its actor heading without moving its body', () => {
  for (const headingDeg of [0, 90, 180, 270]) {
    const spider = { ...enemy('SPIDER'), headingDeg }
    const originalPosition = { ...spider.position }
    const heading = headingDeg * Math.PI / 180
    for (const complex of [false, true]) {
      const reference = nativeEnemyUnderlayPlan({ ...spider, enemyToken: 'SKELETON' }, 120, [light], .75, complex)
      const actual = nativeEnemyUnderlayPlan(spider, 120, [light], .75, complex)
      for (let layer = 0; layer < actual.length; layer += 1) {
        for (let corner = 0; corner < 4; corner += 1) {
          const before = reference[layer]!.vertices[corner]!
          const after = actual[layer]!.vertices[corner]!
          assert.ok(Math.abs(after.x - before.x - 10 * Math.sin(heading)) < .00001)
          assert.ok(Math.abs(after.y - before.y + 10 * Math.cos(heading)) < .00001)
        }
      }
    }
    assert.deepEqual(spider.position, originalPosition)
  }
})

test('humanoid shadow uses the native textured quad, gait shear, 150-unit cap and distinct alpha lanes', () => {
  const [quad, circle] = nativeEnemyUnderlayPlan(enemy('SKELETON'), 120, [light], .75, true)
  assert.equal(quad?.entry, 80)
  assert.deepEqual(quad.vertices, [{ x: 150, y: -8.25 }, { x: 150, y: 14.25 }, { x: 0, y: -5 }, { x: 0, y: 15 }])
  assert.deepEqual(quad.alphas.slice(0, 2), [.375, .375])
  assert.ok(Math.abs(quad.alphas[2] - .6) < 1e-7)
  assert.equal(circle?.entry, 67)
  assert.ok(Math.abs(circle.vertices[1].x - circle.vertices[0].x - 20) < 1e-5)
  const short = nativeEnemyUnderlayPlan(enemy('SKELETON'), 120,
    [{ ...light, projectionDistance: 50 }], .75, true)
  assert.equal(short[0]!.vertices[0].x, 50)
  const multiple = nativeEnemyUnderlayPlan(enemy('DIREFACULTY'), 120,
    [light, { ...light, direction: { x: 0, y: 1 } }], .75, true)
  assert.deepEqual(multiple.map(layer => layer.entry), [80, 80, 67])
})

test('Heartmonger doubles shadow size, and Archer and Mage use limb heading for the backward shift', () => {
  const heart = nativeEnemyUnderlayPlan(enemy('HEARTMONGER'), 120, [light], .75, true)
  assert.deepEqual(heart[0]!.vertices.slice(2), [{ x: 0, y: -15 }, { x: 0, y: 25 }])
  for (const family of ['SKELETONARCHER', 'SKELETONMAGE'] as const) {
    const actor = enemy(family)
    const plan = nativeEnemyUnderlayPlan({ ...actor,
      animation: { ...actor.animation!, limbHeadingDeg: 90 } }, 120, [], 1, false)
    assert.equal((plan[0]!.vertices[0].x + plan[0]!.vertices[1].x) / 2, -5)
    assert.ok(Math.abs((plan[0]!.vertices[0].y + plan[0]!.vertices[2].y) / 2) < 1e-6)
  }
  const largeSkeleton = nativeEnemyUnderlayPlan({ ...enemy('SKELETON'), scale: 4 }, 120, [], 1, false)
  assert.equal(largeSkeleton[0]!.vertices[1].x - largeSkeleton[0]!.vertices[0].x, 25)
})

test('Demon shadow follows grounded endpoints while Discorporeal shadow excludes bob, spin and charge jitter', () => {
  const demon = enemy('DEMON')
  const shadow = nativeEnemyUnderlayPlan({ ...demon, animation: { ...demon.animation!,
    demonShadowOffset: { x: 13, y: 17 }, demonFrontExtremityOffset: { x: 100, y: 100 },
    demonRearExtremityOffset: { x: 200, y: 200 }, verticalOffset: -50 } }, 120, [light], .75, true)[0]!
  assert.deepEqual(shadow.alphas, [.5, .5, .5, .5])
  assert.deepEqual(shadow.vertices, [{ x: -12, y: -8 }, { x: 38, y: -8 }, { x: -12, y: 42 }, { x: 38, y: 42 }])
  const skull = enemy('DEMONSKULL')
  const skullShadow = nativeEnemyUnderlayPlan({ ...skull, scale: 2,
    demonSkull: { ...createNativeDemonSkull(createNativeRng(1), 1).state,
      bodyOffset: { x: 3, y: 4 }, bodyPhaseDeg: 90, bodyHeadingDeg: 0, jitter: { x: 100, y: 100 }, spin: 180 },
  }, 120, [light], .75, true)[0]!
  assert.deepEqual(skullShadow.vertices, [{ x: -97, y: -96 }, { x: 103, y: -96 }, { x: -97, y: 104 }, { x: 103, y: 104 }])
})

test('Coffin projects all ten poses through the authored top-corner shift and its launch mirror', () => {
  for (let pose = 0; pose < 10; pose += 1) {
    const actor = enemy('COFFIN')
    const record = nativeEnemySpriteRecord('BadGuys', 383 + pose)
    for (const mirror of [-1, 1] as const) {
      const quad = nativeEnemyUnderlayPlan({ ...actor, animation: { ...actor.animation!,
        coffinPose: pose, coffinScaleX: mirror } }, 120, [], 1, false)[0]!
      assert.equal(quad.entry, 383 + pose)
      assert.equal(quad.tint, 0)
      assert.equal(quad.vertices[0].x, Math.fround((-record.anchorX + record.height / 4) * mirror))
      assert.equal(quad.vertices[0].y, Math.fround(-record.anchorY + record.height * .3125))
      assert.equal(quad.vertices[2].y, record.height - record.anchorY)
    }
  }
  const hidden = enemy('COFFIN')
  assert.deepEqual(nativeEnemyUnderlayPlan({ ...hidden, animation: { ...hidden.animation!, coffinState: 'hidden' } }, 120, [], 1, false), [])
})

test('Portal ground passes keep alpha, fixed disk size, native aura flattening and all twenty atlas frames', () => {
  const portal = enemy('PORTAL')
  for (let frame = 0; frame < 20; frame += 1) {
    const plan = nativeEnemyUnderlayPlan({ ...portal, animation: { ...portal.animation!,
      alpha: .5, gaitPose: frame + .25, stridePhaseDeg: 1.5 } }, 120, [], 1, true)
    assert.deepEqual(plan.map(layer => [layer.entry, layer.blendMode]), [[18, 'normal'], [22, 'add'], [180 + frame, 'add']])
    assert.ok(plan.every(layer => layer.alphas.every(alpha => alpha === .5)))
    assert.equal(plan[0]!.tint, 0)
    assert.equal(plan[0]!.vertices[1].x - plan[0]!.vertices[0].x, 168)
    const record = nativeEnemySpriteRecord('DeadHawg', 180 + frame)
    assert.ok(Math.abs(plan[2]!.vertices[2].y - plan[2]!.vertices[0].y - record.height * 1.2) < 1e-5)
  }
})

function enemy(enemyToken: NativeEnemyFamily): NativeEnemyVisualSnapshot {
  return { enemyToken, nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[enemyToken], id: 1, position: { x: 100, y: 100 },
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 }, lighting: { charge: 0, glow: 0, providerCopies: 0 },
    armored: false, arrowType: 'normal', burning: false, flags: [], headgear: 0, headingDeg: 0,
    mageCloak: false, mageElement: 'fire', rotten: false, scale: 1, shieldHealth: 0, shieldMaximumHealth: 0,
    spawnTick: 0, weapon: 'claw', animation: nativeEnemyIdleAnimationSample({ shadowLateralOffset: 2, stridePhaseDeg: 1.5 }) }
}

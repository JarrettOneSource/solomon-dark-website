import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import type { AtlasManifest } from '../../editor/manifest/index.ts'
import type { BoneyardEnemyProjectileSnapshot } from '../protocol/game-state.ts'
import { nativeEnemyProjectilePlan } from './native-enemy-projectile-presentation.ts'

const manifests = {
  BadGuys: manifest('../../editor/manifest/badguys.json'),
  DeadHawg: manifest('../../editor/manifest/deadhawg.json'),
  Demon: manifest('../../editor/manifest/demon.json'),
} as const

test('every enemy projectile uses its recovered native atlas range', () => {
  const fixtures = [
    projectile('arrow', 0x7da, { payload: 'normal' }),
    projectile('firebolt', 0x7eb, { payload: 'fire' }),
    projectile('guided-missile', 0x7ec, { payload: 'cold' }),
    projectile('demon-bomb', 0x7f7, { payload: 'none' }),
    projectile('poison-pool', 0x806, { payload: 'poison' }),
  ] as const
  for (const fixture of fixtures) {
    const plan = nativeEnemyProjectilePlan(fixture, 120)
    assert.deepEqual(plan.position, fixture.position)
    assert.ok(plan.layers.length > 0)
    for (const layer of plan.layers) {
      const record = manifests[layer.atlas].entries[layer.entry]
      assert.ok(record, `${layer.atlas}:${layer.entry}`)
      assert.ok(record.rect.w > 0, fixture.kind)
      assert.ok(record.rect.h > 0, fixture.kind)
    }
  }
})

test('live projectile selectors and clocks follow the recovered compositor', () => {
  const arrow = nativeEnemyProjectilePlan(projectile('arrow', 0x7da, {
    headingDeg: 90,
    payload: 'normal',
    verticalOffset: -25,
  }), 120).layers[0]!
  assert.equal(arrow.entry, 2)
  assert.deepEqual(arrow.offset, { x: 0, y: -25 })
  assert.equal(arrow.rotationRadians, Math.PI / 2)
  assert.equal(arrow.scale, 1.25)

  const firebolt = nativeEnemyProjectilePlan(projectile('firebolt', 0x7eb, {
    ageTicks: 5,
    headingDeg: 180,
    lifetimeTicks: 400,
    payload: 'fire',
  }), 120)
  assert.deepEqual(firebolt.layers.map(({ entry, role }) => ({ entry, role })), [
    { entry: 15, role: 'firebolt-orange-glow' },
    { entry: 260, role: 'firebolt-body' },
  ])
  assert.equal(firebolt.layers[0]!.alpha, 0.5)
  assert.deepEqual(firebolt.layers[0]!.offset, { x: 0, y: -15 })
  assert.ok(firebolt.layers.every(({ blendMode }) => blendMode === 'add'))
  assert.equal(firebolt.layers[0]!.scale, 2)
  assert.ok(firebolt.layers[1]!.scale >= 1 && firebolt.layers[1]!.scale < 1.5)

  const fadingFirebolt = nativeEnemyProjectilePlan(projectile('firebolt', 0x7eb, {
    ageTicks: 350,
    lifetimeTicks: 400,
    payload: 'fire',
  }), 120)
  assert.equal(fadingFirebolt.layers[0]!.alpha, 0.25)
  assert.equal(fadingFirebolt.layers[1]!.alpha, 0.5)

  const guided = nativeEnemyProjectilePlan(projectile('guided-missile', 0x7ec, {
    ageTicks: 50,
    lifetimeTicks: 400,
    payload: 'cold',
    visualPhaseDeg: 6,
    visualScale: 1,
  }), 120)
  assert.deepEqual(guided.layers.map((layer) => layer.entry), [110, 112])
  assert.ok(guided.layers.every(({ blendMode }) => blendMode === 'add'))
  assert.equal(guided.layers[0]!.rotationRadians, 0)
  assert.ok(Math.abs(guided.layers[0]!.scale - 1.25) < 1e-12)
  assert.ok(Math.abs(guided.layers[1]!.alpha - Math.sin(Math.PI / 5) * 0.55) < 1e-12)
  assert.ok(Math.abs(guided.layers[1]!.rotationRadians - Math.PI / 60) < 1e-12)

  const poisonGuided = nativeEnemyProjectilePlan(projectile('guided-missile', 0x7ec, {
    lifetimeTicks: 400,
    payload: 'poison',
    visualScale: 1,
  }), 120)
  assert.equal(poisonGuided.layers[0]!.entry, 111)
  assert.equal(poisonGuided.layers[1]!.tint, 0x40ff40)

  const bomb = nativeEnemyProjectilePlan(projectile('demon-bomb', 0x7f7, {
    ageTicks: 5,
    payload: 'none',
    speed: 1.5,
    verticalOffset: -12,
  }), 120)
  assert.equal(bomb.layers.length, 4)
  assert.ok(bomb.layers.slice(0, 3).every((layer) => layer.entry >= 267 && layer.entry <= 270))
  assert.deepEqual(bomb.layers.slice(0, 3).map((layer) => layer.offset), [
    { x: 0, y: -12 },
    { x: 0, y: -12 },
    { x: 0, y: -12 },
  ])
  assert.deepEqual(bomb.layers.slice(0, 3).map((layer) => layer.scale), [2, 2, 1.5])
  assert.ok(bomb.layers.slice(0, 3).every(({ rotationRadians }) => rotationRadians === 0))
  assert.equal(bomb.layers[3]!.entry, 74)
  assert.equal(bomb.layers[3]!.alpha, 0.25)
  assert.deepEqual(bomb.layers[3]!.offset, { x: 0, y: -20 })
  assert.equal(bomb.layers[3]!.scaleY, 0.5)

  const airborneBomb = nativeEnemyProjectilePlan(projectile('demon-bomb', 0x7f7, {
    payload: 'none',
    speed: 2.1,
  }), 120)
  assert.equal(airborneBomb.layers.length, 3)

  const poison = nativeEnemyProjectilePlan(projectile('poison-pool', 0x806, {
    ageTicks: 64,
    payload: 'poison',
    visualScale: 1.6,
  }), 120)
  assert.deepEqual(poison.layers.map((layer) => layer.entry), [0, 0])
  assert.equal(poison.layers[0]!.alpha, 0.5)
  assert.equal(poison.layers[0]!.scale, 1.6)
  assert.ok(Math.abs(poison.layers[1]!.scale - 1.2) < 1e-12)
  assert.ok(poison.layers.every(({ blendMode, tint }) => (
    blendMode === 'normal' && tint === 0xffffff
  )))
})

test('arrow payloads select their native banks and fire effect', () => {
  const normal = nativeEnemyProjectilePlan(projectile('arrow', 0x7da, {
    payload: 'normal',
  }), 60)
  const poison = nativeEnemyProjectilePlan(projectile('arrow', 0x7da, {
    payload: 'poison',
  }), 60)
  const fire = nativeEnemyProjectilePlan(projectile('arrow', 0x7da, {
    payload: 'fire',
  }), 60)

  assert.deepEqual(normal.layers.map(({ entry, role }) => ({ entry, role })), [
    { entry: 2, role: 'arrow-normal' },
  ])
  assert.deepEqual(poison.layers.map(({ entry, role }) => ({ entry, role })), [
    { entry: 2, role: 'arrow-poison' },
    { entry: 271, role: 'arrow-poison-overlay' },
  ])
  assert.deepEqual(fire.layers.map(({ entry, role }) => ({ entry, role })), [
    { entry: 2, role: 'arrow-fire' },
    { entry: 255, role: 'arrow-fire-overlay' },
  ])
  assert.throws(
    () => nativeEnemyProjectilePlan(projectile('firebolt', 0x7eb, {
      payload: 'poison',
    }), 60),
    /does not support poison payload/,
  )
})

test('Arrow elemental overlays use their independent native clocks', () => {
  const fire = projectile('arrow', 0x7da, { ageTicks: 77, payload: 'fire' })
  assert.equal(nativeEnemyProjectilePlan(fire, 59).layers[1]!.entry, 266)
  assert.equal(nativeEnemyProjectilePlan(fire, 60).layers[1]!.entry, 255)

  const poison = projectile('arrow', 0x7da, { ageTicks: 71, payload: 'poison' })
  assert.equal(nativeEnemyProjectilePlan(poison, 1_000).layers[1]!.entry, 282)
  assert.equal(nativeEnemyProjectilePlan({ ...poison, ageTicks: 72 }, 1_000).layers[1]!.entry, 271)
  assert.equal(nativeEnemyProjectilePlan(poison, 1_000).layers[1]!.blendMode, 'add')
  assert.equal(nativeEnemyProjectilePlan(fire, 59).layers[1]!.blendMode, 'add')
})

test('interpolated display ticks sample the owning native fixed tick', () => {
  const source = projectile('demon-bomb', 0x7f7, {
    payload: 'none',
    speed: 1,
  })
  assert.deepEqual(
    nativeEnemyProjectilePlan(source, 120.75),
    nativeEnemyProjectilePlan(source, 120),
  )
})

function projectile(
  kind: BoneyardEnemyProjectileSnapshot['kind'],
  nativeTypeId: BoneyardEnemyProjectileSnapshot['nativeTypeId'],
  overrides: Partial<BoneyardEnemyProjectileSnapshot> = {},
): BoneyardEnemyProjectileSnapshot {
  return {
    ageTicks: 0,
    contactRadius: 10,
    headingDeg: 0,
    homing: false,
    id: 1,
    kind,
    lightRegistration: null,
    lifetimeTicks: 1_000,
    nativeTypeId,
    ownerActorId: 2,
    payload: 'none',
    position: { x: 10, y: 20 },
    speed: 1,
    spawnTick: 5,
    verticalOffset: 0,
    visualPhaseDeg: 0,
    visualScale: 1,
    ...overrides,
  }
}

function manifest(relativePath: string): AtlasManifest {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as AtlasManifest
}

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
    const plan = nativeEnemyProjectilePlan(fixture)
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

test('directional shots, animated missiles, and poison lifetime are authoritative samples', () => {
  assert.equal(nativeEnemyProjectilePlan(projectile('arrow', 0x7da, {
    headingDeg: 90,
    payload: 'normal',
  })).layers[0]!.entry, 258)
  assert.equal(nativeEnemyProjectilePlan(projectile('firebolt', 0x7eb, {
    headingDeg: 180,
    payload: 'fire',
  })).layers[0]!.entry, 259)
  assert.equal(nativeEnemyProjectilePlan(projectile('guided-missile', 0x7ec, {
    ageTicks: 5,
    payload: 'cold',
  })).layers[0]!.entry, 112)
  assert.equal(nativeEnemyProjectilePlan(projectile('demon-bomb', 0x7f7, {
    ageTicks: 5,
    payload: 'none',
  })).layers[0]!.entry, 268)
  const poison = nativeEnemyProjectilePlan(projectile('poison-pool', 0x806, {
    ageTicks: 500,
    payload: 'poison',
  })).layers[0]!
  assert.equal(poison.entry, 77)
  assert.equal(poison.alpha, 0.5)
})

test('arrow payloads select their native banks and fire effect', () => {
  const normal = nativeEnemyProjectilePlan(projectile('arrow', 0x7da, {
    payload: 'normal',
  }))
  const poison = nativeEnemyProjectilePlan(projectile('arrow', 0x7da, {
    payload: 'poison',
  }))
  const fire = nativeEnemyProjectilePlan(projectile('arrow', 0x7da, {
    payload: 'fire',
  }))

  assert.deepEqual(normal.layers.map(({ entry, role }) => ({ entry, role })), [
    { entry: 255, role: 'arrow-normal' },
  ])
  assert.deepEqual(poison.layers.map(({ entry, role }) => ({ entry, role })), [
    { entry: 271, role: 'arrow-poison' },
  ])
  assert.deepEqual(fire.layers.map(({ entry, role }) => ({ entry, role })), [
    { entry: 255, role: 'arrow-fire' },
    { entry: 2, role: 'arrow-fire-effect' },
  ])
  assert.throws(
    () => nativeEnemyProjectilePlan(projectile('firebolt', 0x7eb, {
      payload: 'poison',
    })),
    /does not support poison payload/,
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
    lifetimeTicks: 1_000,
    nativeTypeId,
    ownerActorId: 2,
    payload: 'none',
    position: { x: 10, y: 20 },
    spawnTick: 5,
    ...overrides,
  }
}

function manifest(relativePath: string): AtlasManifest {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as AtlasManifest
}

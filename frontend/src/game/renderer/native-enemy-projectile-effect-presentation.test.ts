import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import type { AtlasManifest } from '../../editor/manifest/index.ts'
import type { BoneyardEnemyProjectileEffectSnapshot } from '../protocol/game-state.ts'
import {
  nativeEnemyProjectileEffectBypassesWorldTint,
  nativeEnemyProjectileEffectPainterLayer,
  nativeEnemyProjectileEffectPlan,
} from './native-enemy-projectile-effect-presentation.ts'

const manifests = {
  BadGuys: manifest('../../editor/manifest/badguys.json'),
  DeadHawg: manifest('../../editor/manifest/deadhawg.json'),
} as const

test('every projectile-owned transient resolves its exact atlas record and layer state', () => {
  const effects = [
    effect('arrow-tumble', 'BadGuys', 2, 'normal'),
    effect('fire-burst-frame', 'BadGuys', 253, 'add'),
    effect('fire-burst-glow', 'BadGuys', 110, 'normal'),
    effect('firebolt-trail', 'BadGuys', 260, 'normal'),
    effect('guided-impact-main', 'BadGuys', 110, 'add'),
    effect('guided-impact-aura-one', 'BadGuys', 111, 'add'),
    effect('guided-impact-aura-two', 'BadGuys', 112, 'add'),
    effect('demon-fire', 'DeadHawg', 46, 'add'),
    effect('poison-pool-fade-outer', 'DeadHawg', 0, 'normal'),
    effect('poison-pool-fade-inner', 'DeadHawg', 0, 'normal'),
  ] as const

  for (const source of effects) {
    const plan = nativeEnemyProjectileEffectPlan(source)
    assert.deepEqual(plan.position, source.position)
    assert.equal(plan.blendMode, source.blendMode)
    assert.equal(plan.entry, source.entry)
    assert.equal(plan.tint, source.tint)
    if (!source.kind.startsWith('guided-impact-')) {
      assert.equal(plan.alpha, source.alpha)
      assert.equal(plan.rotationRadians, source.rotationRadians)
      assert.equal(plan.scale, source.scale)
    }
    const record = manifests[plan.atlas].entries[plan.entry]
    assert.ok(record && !record.empty && record.file, `${plan.atlas}:${plan.entry}`)
  }
})

test('GuidedMissile impact retains the four-layer Anim_FadeGM compositor', () => {
  const main = nativeEnemyProjectileEffectPlan(effect(
    'guided-impact-main',
    'BadGuys',
    110,
    'add',
    { alpha: 2, rotationRadians: 12 * Math.PI / 180, scale: 2 },
  ))
  assert.equal(main.rotationRadians, 0)
  assert.ok(main.alpha >= 1 && main.alpha < 2)
  assert.ok(Math.abs(main.scale - 1.1) < 1e-12)

  const auraOne = nativeEnemyProjectileEffectPlan(effect(
    'guided-impact-aura-one',
    'BadGuys',
    111,
    'add',
    { alpha: 2, rotationRadians: 10 * Math.PI / 180, scale: 2 },
  ))
  assert.ok(Math.abs(auraOne.alpha - 0.55) < 1e-12)
  assert.ok(Math.abs(auraOne.rotationRadians - 5 * Math.PI / 180) < 1e-12)
  assert.ok(auraOne.scale >= 2 && auraOne.scale < 2.6)

  const auraTwo = nativeEnemyProjectileEffectPlan(effect(
    'guided-impact-aura-two',
    'BadGuys',
    112,
    'add',
    { alpha: 2, rotationRadians: 15 * Math.PI / 180, scale: 2 },
  ))
  assert.ok(Math.abs(auraTwo.alpha - 1.1) < 1e-12)
})

test('wrapped FireBurst children retain one native bias and bypass Region tint', () => {
  const source = effect('fire-burst-frame', 'BadGuys', 251, 'add')
  assert.deepEqual(nativeEnemyProjectileEffectPainterLayer(source), {
    id: `enemy-projectile-effect:${source.id}`,
    queueFamily: 'zanim',
    registration: source.painterRegistration,
    sortBias: 50,
    worldY: source.position.y,
  })
  assert.equal(nativeEnemyProjectileEffectBypassesWorldTint(source), true)
  assert.equal(
    nativeEnemyProjectileEffectBypassesWorldTint(
      effect('guided-impact-main', 'BadGuys', 110, 'add'),
    ),
    false,
  )
})

function effect(
  kind: BoneyardEnemyProjectileEffectSnapshot['kind'],
  atlas: BoneyardEnemyProjectileEffectSnapshot['atlas'],
  entry: number,
  blendMode: BoneyardEnemyProjectileEffectSnapshot['blendMode'],
  overrides: Partial<BoneyardEnemyProjectileEffectSnapshot> = {},
): BoneyardEnemyProjectileEffectSnapshot {
  return {
    ageTicks: 3,
    alpha: 0.75,
    atlas,
    blendMode,
    entry,
    id: entry + 1,
    kind,
    lightRegistration: kind === 'fire-burst-glow'
      ? { managerLane: 'transient', registrationOrdinal: 3 }
      : null,
    lifetimeTicks: 20,
    ownerActorId: 7,
    ownerProjectileId: 9,
    painterRegistration: {
      managerLane: kind.startsWith('fire-burst-') ? 'transient' : 'actor',
      registrationOrdinal: entry + 1,
    },
    phaseOriginTicks: 12,
    position: { x: 125, y: 240 },
    rotationRadians: 0.25,
    scale: 1.2,
    spawnTick: 100,
    tint: 0xff4949,
    ...overrides,
  }
}

function manifest(relativePath: string): AtlasManifest {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as AtlasManifest
}

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import type { AtlasManifest } from '../../editor/manifest/index.ts'
import type {
  BoneyardEnemyProjectileEffectSnapshot,
  BoneyardEnemyProjectileEffectSnapshotBase,
} from '../protocol/game-state.ts'
import {
  nativeEnemyProjectileEffectBypassesWorldTint,
  nativeEnemyProjectileEffectPainterLayer,
  nativeEnemyProjectileEffectPlan,
} from './native-enemy-projectile-effect-presentation.ts'

const manifests = {
  BadGuys: manifest('../../editor/manifest/badguys.json'),
  DeadHawg: manifest('../../editor/manifest/deadhawg.json'),
} as const

test('every native projectile effect resolves its complete resident draw bank', () => {
  const effects = [
    effect('arrow-tumble', 'BadGuys', 2),
    effect('poison-bubble', 'BadGuys', 57),
    effect('firebolt-trail', 'BadGuys', 260),
    effect('fire-burst', 'BadGuys', 253),
    effect('guided-impact', 'BadGuys', 110),
    effect('guided-impact', 'BadGuys', 111),
    effect('demon-fire', 'DeadHawg', 46),
    effect('demon-explosion-core', 'BadGuys', 15),
    effect('demon-explosion-array', 'BadGuys', 401),
    effect('demon-explosion-lit-array', 'BadGuys', 420),
  ]
  for (const source of effects) {
    const plan = nativeEnemyProjectileEffectPlan(source)
    assert.ok(plan.layers.length > 0)
    for (const layer of plan.layers) {
      const record = manifests[layer.atlas].entries[layer.entry]
      assert.ok(record && !record.empty && record.file, `${source.kind}: ${layer.atlas}:${layer.entry}`)
      assert.ok(Number.isFinite(layer.scale) && Number.isFinite(layer.alpha))
    }
  }
})

test('GuidedMissile impact keeps two identical main draws and two independent aura samples in one wrapper', () => {
  for (const entry of [110, 111]) {
    const source = effect('guided-impact', 'BadGuys', entry, {
      alpha: 2, rotationRadians: 12 * Math.PI / 180, scale: 2,
      tint: entry === 110 ? 0x4080ff : 0x40ff40,
    })
    const plan = nativeEnemyProjectileEffectPlan(source)
    assert.deepEqual(plan.position, source.position)
    assert.deepEqual(plan.layers.map(layer => layer.entry), [entry, entry, 111, 112])
    assert.deepEqual(plan.layers[0], plan.layers[1])
    assert.equal(plan.layers[0]!.scale, Math.fround(1.1))
    assert.equal(plan.layers[0]!.rotationRadians, 0)
    assert.ok(plan.layers[0]!.alpha >= 1 && plan.layers[0]!.alpha <= 2)
    for (const aura of plan.layers.slice(2)) {
      assert.equal(aura.rotationRadians, source.rotationRadians / 2)
      assert.equal(aura.tint, source.tint)
      assert.ok(aura.scale >= 2 && aura.scale <= Math.fround(2.6))
    }
    const painter = nativeEnemyProjectileEffectPainterLayer(source)
    assert.equal(painter?.queueFamily, 'zanim')
    assert.equal(painter.sortBias, 100)
    assert.deepEqual(painter.registration, source.painterRegistration)
  }
})

test('FireBurst owns both render passes and one native depth bias', () => {
  const source = effect('fire-burst', 'BadGuys', 253, { alpha: 0.25, scale: 0.5 })
  const plan = nativeEnemyProjectileEffectPlan(source)
  assert.deepEqual(plan.layers.map(layer => ({
    alpha: layer.alpha, blend: layer.blendMode, entry: layer.entry, scale: layer.scale,
  })), [
    { alpha: 0.25, blend: 'normal', entry: 110, scale: 2.5 },
    { alpha: 1, blend: 'add', entry: 253, scale: 0.5 },
  ])
  assert.equal(nativeEnemyProjectileEffectPainterLayer(source)?.sortBias, 50)
  assert.equal(nativeEnemyProjectileEffectBypassesWorldTint(source), true)
  assert.equal(nativeEnemyProjectileEffectBypassesWorldTint(effect('poison-bubble', 'BadGuys', 57)), false)
})

test('Demon Fire mirrors around the scaled native origin and draws its ground glow independently', () => {
  const source = effect('demon-fire', 'DeadHawg', 46, { scale: 2, alpha: 0.75 })
  const plan = nativeEnemyProjectileEffectPlan(source)
  const scale = Math.fround(Math.fround(1.1) * 2 * 0.5)
  assert.equal(plan.layers[0]!.scale, -scale)
  assert.equal(plan.layers[0]!.scaleY, scale)
  assert.deepEqual(plan.position, { x: source.position.x, y: Math.fround(source.position.y + 10 + Math.fround(-20 * scale)) })
  assert.deepEqual(plan.groundGlow?.position, source.position)
  assert.equal(plan.groundGlow?.alpha, 0.375)
  assert.equal(plan.groundGlow?.scale, 4)
})

test('Demon Explosion spans the direct pre-world, shared, and direct post-world intervals', () => {
  assert.equal(nativeEnemyProjectileEffectPainterLayer(effect('demon-explosion-core', 'BadGuys', 15)), null)
  assert.equal(nativeEnemyProjectileEffectPainterLayer(effect('demon-explosion-array', 'BadGuys', 401)), null)
  const lit = effect('demon-explosion-lit-array', 'BadGuys', 420, { scale: 1.5 })
  assert.equal(nativeEnemyProjectileEffectPainterLayer(lit)?.queueFamily, 'zanim')
  assert.equal(nativeEnemyProjectileEffectPlan(lit, 0.25).layers[0]!.scale, 0.5)
  for (const ageTicks of [0, 9, 10, 34, 35, 36]) {
    for (const [kind, entry, lifetime] of [
      ['demon-explosion-core', 15, 10],
      ['demon-explosion-array', 401, 35],
      ['demon-explosion-lit-array', 420, 37],
    ] as const) {
      const layers = nativeEnemyProjectileEffectPlan(effect(kind, 'BadGuys', entry, { ageTicks })).layers
      assert.equal(layers.length, ageTicks < lifetime ? 1 : 0)
    }
  }
})

function effect(
  kind: BoneyardEnemyProjectileEffectSnapshot['kind'],
  atlas: BoneyardEnemyProjectileEffectSnapshot['atlas'],
  entry: number,
  overrides: Partial<BoneyardEnemyProjectileEffectSnapshotBase> = {},
): BoneyardEnemyProjectileEffectSnapshot {
  const base: BoneyardEnemyProjectileEffectSnapshotBase = {
    ageTicks: 3, alpha: 0.5, atlas, blendMode: 'add', entry, id: entry + 1,
    lightRegistration: null, lifetimeTicks: 501, ownerActorId: 7, ownerProjectileId: 9,
    painterRegistration: { managerLane: 'transient', registrationOrdinal: entry + 1 },
    phaseOriginTicks: 12, position: { x: 125, y: 240 }, rotationRadians: 0.25,
    scale: 1.2, spawnTick: 100, tint: 0xffffff, ...overrides,
  }
  return kind === 'demon-fire'
    ? { ...base, kind, fireFadeAlpha: 0.5, fireHorizontalSign: -1 }
    : { ...base, kind }
}

function manifest(relativePath: string): AtlasManifest {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as AtlasManifest
}

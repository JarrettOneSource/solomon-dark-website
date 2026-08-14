import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import test from 'node:test'

import type { AtlasManifest } from '../../editor/manifest/index.ts'
import { nativeSpriteAnchor } from '../../editor/sprite-registration.ts'
import {
  NATIVE_ENEMY_FAMILIES,
  nativeEnemyPresentationPlan,
  type NativeEnemyAtlas,
  type NativeEnemyFamily,
  type NativeEnemyVisualSnapshot,
} from './native-enemy-presentation.ts'

const manifests: Readonly<Record<NativeEnemyAtlas, AtlasManifest>> = {
  BadGuys: manifest('../../editor/manifest/badguys.json'),
  Demon: manifest('../../editor/manifest/demon.json'),
}

test('every reachable native enemy plan uses a shipped nonempty atlas record', () => {
  const used = new Set<string>()
  for (const family of NATIVE_ENEMY_FAMILIES) {
    for (const flags of familyFlagSets(family)) {
      for (let id = 1; id <= 256; id += 1) {
        for (const headingDeg of familyHeadings(family)) {
          const plan = nativeEnemyPresentationPlan(enemy(family, id, headingDeg, flags), 500)
          for (const layer of plan.layers) {
            const entry = manifests[layer.atlas].entries[layer.entry]
            assert.ok(entry && !entry.empty && entry.file, `${layer.atlas}:${layer.entry}`)
            statSync(new URL(`../../assets/game/boneyard/${entry.file}`, import.meta.url))
            used.add(`${layer.atlas}:${layer.entry}`)
          }
        }
      }
    }
  }
  for (let id = 1; id <= 256; id += 1) {
    for (let age = 0; age <= 900; age += 1) {
      const plan = nativeEnemyPresentationPlan(enemy('COFFIN', id, 0, []), 450 + age)
      for (const layer of plan.layers) used.add(`${layer.atlas}:${layer.entry}`)
    }
  }
  assert.equal(used.size, 665)
})

test('representative enemy records retain native registration and joints', () => {
  const archer = manifests.BadGuys.entries[451]
  const wraith = manifests.BadGuys.entries[2070]
  const zombieController = manifests.BadGuys.entries[2203]
  const demonController = manifests.Demon.entries[19]

  assert.deepEqual(nativeSpriteAnchor(archer.rect.w, archer.rect.h, archer.origin), {
    x: 21,
    y: 34,
  })
  assert.deepEqual(nativeSpriteAnchor(wraith.rect.w, wraith.rect.h, wraith.origin), {
    x: 9.5,
    y: 20.5,
  })
  assert.deepEqual(zombieController.extras, [
    { x: 0, y: -8.5 },
    { x: -12.5, y: -17.5 },
    { x: 8.5, y: -20.5 },
  ])
  assert.deepEqual(demonController.extras, [
    { x: 15, y: -28 },
    { x: -14, y: -28 },
    { x: -17.5, y: -28.5 },
    { x: -0.5, y: -32 },
    { x: 19.5, y: -29 },
    { x: -0.5, y: -45.5 },
    { x: -8.5, y: -13 },
    { x: 10, y: -13 },
  ])
})

function manifest(relativePath: string): AtlasManifest {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as AtlasManifest
}

function enemy(
  enemyToken: NativeEnemyFamily,
  id: number,
  headingDeg: number,
  flags: readonly string[],
): NativeEnemyVisualSnapshot {
  return {
    enemyToken,
    flags,
    headingDeg,
    id,
    nativeTypeId: 1000,
    position: { x: 0, y: 0 },
    spawnTick: 450,
  }
}

function familyFlagSets(family: NativeEnemyFamily): readonly (readonly string[])[] {
  if (family === 'SKELETON') {
    return [
      [],
      ['FLAG_ARMOR'],
      ['FLAG_SWORD', 'FLAG_HELM'],
      ['FLAG_MACE', 'FLAG_HORNED'],
      ['FLAG_FLAIL', 'FLAG_HOODED'],
      ['FLAG_AXE', 'FLAG_ARMORMAYBE'],
      ['FLAG_PIKE'],
      ['FLAG_ARMOR', 'FLAG_SWORD'],
      ['FLAG_ARMOR', 'FLAG_PIKE'],
    ]
  }
  if (family === 'SKELETONARCHER') return [[], ['FLAG_HELM'], ['FLAG_HOODED']]
  if (family === 'SKELETONMAGE') return [[], ['FLAG_HORNED'], ['FLAG_HOODED']]
  if (family === 'ZOMBIE') return [[], ['FLAG_ROTTEN']]
  return [[]]
}

function familyHeadings(family: NativeEnemyFamily): readonly number[] {
  if (family === 'COFFIN') return [0]
  const step = family === 'IMP' ? 30 : 20
  const count = 360 / step
  return Array.from({ length: count }, (_, facing) => (
    (facing * step - step / 2 + 360) % 360
  ))
}

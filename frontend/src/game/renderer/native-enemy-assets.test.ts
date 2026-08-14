import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import test from 'node:test'

import type { AtlasManifest } from '../../editor/manifest/index.ts'
import { nativeSpriteAnchor } from '../../editor/sprite-registration.ts'
import {
  NATIVE_ENEMY_ACTION_PROGRAMS,
  NATIVE_ENEMY_DEATH_PROGRAMS,
  nativeEnemyIdleAnimationSample,
  type NativeEnemyActionProgramName,
} from './native-enemy-animation.ts'
import {
  NATIVE_ENEMY_FAMILIES,
  nativeEnemyPresentationPlan,
  type NativeEnemyAtlas,
  type NativeEnemyFamily,
  type NativeEnemyVisualSnapshot,
} from './native-enemy-presentation.ts'

const manifests: Readonly<Record<NativeEnemyAtlas, AtlasManifest>> = {
  BadGuys: manifest('../../editor/manifest/badguys.json'),
  DeadHawg: manifest('../../editor/manifest/deadhawg.json'),
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

test('every combat, death, and Coffin child plan resolves to extracted records', () => {
  const plans: ReturnType<typeof nativeEnemyPresentationPlan>[] = []
  const actionFamilies: readonly [NativeEnemyFamily, NativeEnemyActionProgramName][] = [
    ['SKELETON', 'skeleton-claw-a'],
    ['SKELETON', 'skeleton-claw-b'],
    ['SKELETON', 'skeleton-weapon'],
    ['SKELETON', 'skeleton-pike'],
    ['SKELETONARCHER', 'archer-shot'],
    ['SKELETONMAGE', 'mage-cast-short'],
    ['SKELETONMAGE', 'mage-cast-long'],
    ['IMP', 'imp-contact'],
    ['ZOMBIE', 'zombie-swipe'],
    ['WRAITH', 'wraith-drain'],
    ['DEMON', 'demon-claw'],
    ['DEMON', 'demon-bomb'],
    ['COFFIN', 'coffin-open'],
  ]
  for (const [family, action] of actionFamilies) {
    const program = NATIVE_ENEMY_ACTION_PROGRAMS[action]
    for (let progress = 0; progress <= program.strictEnd + 1; progress += 1) {
      for (const headingDeg of familyHeadings(family)) {
        plans.push(nativeEnemyPresentationPlan({
          ...enemy(family, 7, headingDeg, actionFlags(action)),
          animation: nativeEnemyIdleAnimationSample({
            action,
            actionProgress: progress,
            impEffectFrame: action === 'imp-contact' ? 9 : -1,
            state: 'action',
          }),
        }, 500))
      }
    }
  }
  for (const family of NATIVE_ENEMY_FAMILIES) {
    const death = NATIVE_ENEMY_DEATH_PROGRAMS[family]
    for (let deathTick = 0; deathTick <= death.durationTicks + 1; deathTick += 1) {
      plans.push(nativeEnemyPresentationPlan({
        ...enemy(family, 8, 0, []),
        animation: nativeEnemyIdleAnimationSample({ deathTick, state: 'death' }),
      }, 500))
    }
  }
  plans.push(nativeEnemyPresentationPlan({
    ...enemy('COFFIN', 9, 0, []),
    animation: nativeEnemyIdleAnimationSample({
      coffinSecondaryPose: 9,
      coffinState: 'open',
      maggots: [
        {
          alpha: 1,
          headingDeg: 340,
          id: 1,
          offset: { x: 0, y: 0 },
          pose: 1,
          rotationRadians: 0,
          state: 'bite',
        },
        {
          alpha: 1,
          headingDeg: 0,
          id: 2,
          offset: { x: 0, y: 0 },
          pose: 0,
          rotationRadians: 0,
          state: 'death',
        },
      ],
    }),
  }, 500))

  const used = new Set<string>()
  for (const plan of plans) {
    for (const layer of plan.layers) {
      const record = manifests[layer.atlas].entries[layer.entry]
      assert.ok(record && !record.empty && record.file, `${layer.atlas}:${layer.entry}`)
      statSync(new URL(`../../assets/game/boneyard/${record.file}`, import.meta.url))
      used.add(`${layer.atlas}:${layer.entry}`)
    }
  }
  assert.ok(used.has('BadGuys:1819'))
  assert.ok(used.has('DeadHawg:144'))
  assert.ok(used.has('Demon:61'))
  assert.ok(used.has('BadGuys:220'))
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

function actionFlags(action: NativeEnemyActionProgramName): readonly string[] {
  if (action === 'skeleton-weapon') return ['FLAG_SWORD']
  if (action === 'skeleton-pike') return ['FLAG_PIKE']
  return []
}

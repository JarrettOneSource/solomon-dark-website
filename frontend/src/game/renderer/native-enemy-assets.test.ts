import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { createServer } from 'vite'

import type { AtlasManifest } from '../../editor/manifest/index.ts'
import { nativeSpriteAnchor } from '../../editor/sprite-registration.ts'
import type { BoneyardEnemyProjectileSnapshot } from '../protocol/game-state.ts'
import {
  NATIVE_ENEMY_ACTION_PROGRAMS,
  NATIVE_ENEMY_DEATH_PROGRAMS,
  nativeEnemyIdleAnimationSample,
  type NativeEnemyActionProgramName,
} from './native-enemy-animation.ts'
import {
  NATIVE_ENEMY_FAMILIES,
  nativeEnemyPresentationPlan as buildNativeEnemyPresentationPlan,
  type NativeEnemyAtlas,
  type NativeEnemyFamily,
  type NativeEnemyVisualSnapshot,
} from './native-enemy-presentation.ts'
import { nativeEnemyProjectilePlan } from './native-enemy-projectile-presentation.ts'
import {
  NATIVE_WELD_BADGUYS_RECORDS,
  NATIVE_WELD_DEADHAWG_RECORDS,
} from './primary-spell-weld-native.ts'

const manifests: Readonly<Record<NativeEnemyAtlas, AtlasManifest>> = {
  BadGuys: manifest('../../editor/manifest/badguys.json'),
  DeadHawg: manifest('../../editor/manifest/deadhawg.json'),
  Demon: manifest('../../editor/manifest/demon.json'),
}

function nativeEnemyPresentationPlan(
  snapshot: NativeEnemyVisualSnapshot,
  tick: number,
) {
  return buildNativeEnemyPresentationPlan(snapshot, tick, (atlas, entry) => (
    manifests[atlas].entries[entry]?.extras ?? []
  ))
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
            const key = `${layer.atlas}:${layer.entry}`
            if (!used.has(key)) {
              statSync(new URL(`../../assets/game/boneyard/${entry.file}`, import.meta.url))
              used.add(key)
            }
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
  const activePike = nativeEnemyPresentationPlan({
    ...enemy('SKELETON', 1, 0, ['FLAG_PIKE']),
    animation: nativeEnemyIdleAnimationSample({
      action: 'skeleton-pike',
      actionProgress: 1,
      state: 'action',
    }),
  }, 500)
  for (const layer of activePike.layers) used.add(`${layer.atlas}:${layer.entry}`)
  assert.ok(used.size > 665)
  for (const key of [
    'BadGuys:26',
    'BadGuys:46',
    'BadGuys:54',
    'BadGuys:56',
    'BadGuys:65',
  ]) assert.ok(used.has(key), key)
  assert.deepEqual(
    Array.from({ length: 32 }, (_, index) => `DeadHawg:${46 + index}`)
      .filter((key) => !used.has(key)),
    [],
  )
})

test('every reachable projectile and welded painter record is selected for preload', async () => {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    server: { middlewareMode: true },
  })
  try {
    const assetModule = await server.ssrLoadModule(
      '/src/game/renderer/native-enemy-assets.ts',
    ) as {
      nativeEnemySpriteGeometry(
        atlas: NativeEnemyAtlas,
        entry: number,
      ): {
        readonly anchorX: number
        readonly anchorY: number
        readonly atlas: NativeEnemyAtlas
        readonly entry: number
        readonly height: number
        readonly points: readonly Readonly<{ x: number; y: number }>[]
        readonly width: number
      }
      nativeEnemySpriteRecord(
        atlas: NativeEnemyAtlas,
        entry: number,
      ): { readonly atlas: NativeEnemyAtlas; readonly entry: number; readonly source: string }
    }
    assert.deepEqual(assetModule.nativeEnemySpriteGeometry('BadGuys', 73), {
      anchorX: 6,
      anchorY: 6.5,
      atlas: 'BadGuys',
      entry: 73,
      height: 13,
      points: [],
      width: 12,
    })
    const required = new Set([
      'BadGuys:2',
      'BadGuys:15',
      ...atlasRecordKeys('BadGuys', 110, 112),
      ...atlasRecordKeys('BadGuys', 251, 282),
      ...NATIVE_WELD_BADGUYS_RECORDS.map((record) => `BadGuys:${record}`),
      'DeadHawg:0',
      ...atlasRecordKeys('DeadHawg', 46, 77),
      ...NATIVE_WELD_DEADHAWG_RECORDS.map((record) => `DeadHawg:${record}`),
    ])
    const sampled = new Set<string>()
    for (const projectile of enemyProjectileAssetSamples()) {
      for (const layer of nativeEnemyProjectilePlan(
        projectile,
        projectile.spawnTick + projectile.ageTicks,
      ).layers) {
        const record = assetModule.nativeEnemySpriteRecord(layer.atlas, layer.entry)
        assert.equal(record.atlas, layer.atlas)
        assert.equal(record.entry, layer.entry)
        assert.ok(record.source.length > 0)
        sampled.add(`${layer.atlas}:${layer.entry}`)
      }
    }
    assert.deepEqual([...sampled].filter((key) => !required.has(key)), [])
    for (const key of required) {
      const [atlas, entry] = key.split(':') as [NativeEnemyAtlas, string]
      const record = assetModule.nativeEnemySpriteRecord(atlas, Number(entry))
      assert.ok(record.source.length > 0, key)
    }
    assert.equal(required.size, 102)

    const deathEffectRecords = [
      ...[10, 11, 15, 21, 27, 49, 55, 69, 86]
        .map((entry) => ['BadGuys', entry] as const),
      ...recordPairs('BadGuys', 92, 121),
      ...recordPairs('BadGuys', 401, 419),
      ...recordPairs('BadGuys', 1_819, 1_822),
      ...recordPairs('BadGuys', 2_013, 2_069),
      ...[2_088, 2_089, 2_091, 2_093, 2_293, 2_297]
        .map((entry) => ['BadGuys', entry] as const),
      ...[28, 30].map((entry) => ['DeadHawg', entry] as const),
      ...recordPairs('DeadHawg', 114, 144),
    ]
    const selectedDeathEffects = new Set<string>()
    for (const [atlas, entry] of deathEffectRecords) {
      const record = assetModule.nativeEnemySpriteRecord(atlas, entry)
      assert.ok(record.source.length > 0)
      selectedDeathEffects.add(`${atlas}:${entry}`)
    }
    assert.equal(selectedDeathEffects.size, 158)
  } finally {
    await server.close()
  }
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

test('every live combat and Coffin child plan resolves through the runtime preload', async (t) => {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    server: { middlewareMode: true },
  })
  t.after(() => server.close())
  const assetModule = await server.ssrLoadModule(
    '/src/game/renderer/native-enemy-assets.ts',
  ) as {
    nativeEnemySpriteRecord(
      atlas: NativeEnemyAtlas,
      entry: number,
    ): { readonly source: string }
  }
  const plans: ReturnType<typeof nativeEnemyPresentationPlan>[] = []
  const actionFamilies: readonly [
    NativeEnemyFamily,
    NativeEnemyActionProgramName,
    readonly string[],
  ][] = [
    ['SKELETON', 'skeleton-claw-a', []],
    ['SKELETON', 'skeleton-claw-b', ['FLAG_ARMOR']],
    ['SKELETON', 'skeleton-weapon', ['FLAG_SWORD']],
    ['SKELETON', 'skeleton-weapon', ['FLAG_ARMOR', 'FLAG_SWORD']],
    ['SKELETON', 'skeleton-pike', ['FLAG_PIKE']],
    ['SKELETON', 'skeleton-pike', ['FLAG_ARMOR', 'FLAG_PIKE']],
    ['SKELETONARCHER', 'archer-shot', []],
    ['SKELETONMAGE', 'mage-cast-short', []],
    ['SKELETONMAGE', 'mage-cast-long', []],
    ['DEMON', 'demon-bomb', []],
  ]
  for (const [family, action, flags] of actionFamilies) {
    const program = NATIVE_ENEMY_ACTION_PROGRAMS[action]
    for (let progress = 0; progress <= program.strictEnd + 1; progress += 1) {
      for (const headingDeg of familyHeadings(family)) {
        plans.push(nativeEnemyPresentationPlan({
          ...enemy(family, 7, headingDeg, flags),
          animation: nativeEnemyIdleAnimationSample({
            action,
            actionProgress: progress,
            state: 'action',
          }),
        }, 500))
      }
    }
  }
  for (const [family, action] of [
    ['IMP', 'imp-contact'],
    ['ZOMBIE', 'zombie-beat'],
    ['WRAITH', 'wraith-drain'],
  ] as const) {
    for (const headingDeg of familyHeadings(family)) {
      plans.push(nativeEnemyPresentationPlan({
        ...enemy(family, 7, headingDeg, []),
        animation: nativeEnemyIdleAnimationSample({
          action,
          actionProgress: action === 'zombie-beat' ? 100 : 4,
          impEffectFrame: action === 'imp-contact' ? 9 : -1,
          state: 'action',
          zombieBodyType: 2,
          zombieFlyblownSide: 1,
          zombieFrontArmPose: action === 'zombie-beat' ? 2 : 0,
          zombieHeadType: 2,
        }),
      }, 500))
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
      const key = `${layer.atlas}:${layer.entry}`
      if (!used.has(key)) {
        statSync(new URL(`../../assets/game/boneyard/${record.file}`, import.meta.url))
        assert.ok(assetModule.nativeEnemySpriteRecord(layer.atlas, layer.entry).source.length > 0)
        used.add(key)
      }
    }
  }
  assert.ok(used.has('BadGuys:237'))
  assert.ok(used.has('BadGuys:937'))
})

function manifest(relativePath: string): AtlasManifest {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as AtlasManifest
}

function recordPairs(
  atlas: NativeEnemyAtlas,
  first: number,
  last: number,
): readonly (readonly [NativeEnemyAtlas, number])[] {
  return Array.from(
    { length: last - first + 1 },
    (_, index) => [atlas, first + index] as const,
  )
}

function enemyProjectileAssetSamples(): readonly BoneyardEnemyProjectileSnapshot[] {
  const samples: BoneyardEnemyProjectileSnapshot[] = []
  for (let headingDeg = 0; headingDeg < 360; headingDeg += 1) {
    for (const payload of ['normal', 'fire', 'poison'] as const) {
      samples.push(enemyProjectile('arrow', 0x7da, { headingDeg, payload }))
    }
    samples.push(enemyProjectile('firebolt', 0x7eb, { headingDeg, payload: 'fire' }))
  }
  for (let ageTicks = 0; ageTicks <= 31; ageTicks += 1) {
    samples.push(enemyProjectile('guided-missile', 0x7ec, {
      ageTicks,
      payload: 'cold',
    }))
    samples.push(enemyProjectile('guided-missile', 0x7ec, {
      ageTicks,
      payload: 'poison',
    }))
    samples.push(enemyProjectile('demon-bomb', 0x7f7, { ageTicks, payload: 'none' }))
    samples.push(enemyProjectile('poison-pool', 0x806, { ageTicks, payload: 'poison' }))
  }
  return samples
}

function enemyProjectile(
  kind: BoneyardEnemyProjectileSnapshot['kind'],
  nativeTypeId: BoneyardEnemyProjectileSnapshot['nativeTypeId'],
  overrides: Partial<BoneyardEnemyProjectileSnapshot>,
): BoneyardEnemyProjectileSnapshot {
  return {
    ageTicks: 0,
    contactRadius: 20,
    headingDeg: 0,
    homing: false,
    id: 1,
    kind,
    lifetimeTicks: 1_000,
    nativeTypeId,
    ownerActorId: 2,
    payload: 'none',
    position: { x: 0, y: 0 },
    speed: 1,
    spawnTick: 0,
    verticalOffset: 0,
    visualPhaseDeg: 0,
    visualScale: 1,
    ...overrides,
  }
}

function atlasRecordKeys(
  atlas: NativeEnemyAtlas,
  first: number,
  last: number,
): readonly string[] {
  return Array.from({ length: last - first + 1 }, (_, offset) => (
    `${atlas}:${first + offset}`
  ))
}

function enemy(
  enemyToken: NativeEnemyFamily,
  id: number,
  headingDeg: number,
  flags: readonly string[],
): NativeEnemyVisualSnapshot {
  return {
    armored: flags.includes('FLAG_ARMOR') || (
      flags.includes('FLAG_ARMORMAYBE') && id % 2 === 0
    ),
    enemyToken,
    flags,
    headingDeg,
    id,
    lighting: { charge: 1, glow: 0, providerCopies: 1 },
    mageCloak: flags.includes('MAGE_CLOAK'),
    nativeTypeId: 1000,
    position: { x: 0, y: 0 },
    shieldHealth: 0,
    shieldMaximumHealth: 0,
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
      ['FLAG_BURNING'],
    ]
  }
  if (family === 'SKELETONARCHER') return [
    [],
    ['FLAG_HELM'],
    ['FLAG_HOODED'],
    ['FLAG_FIREARROW'],
    ['FLAG_POISONARROW'],
    ['FLAG_BURNING'],
  ]
  if (family === 'SKELETONMAGE') return [
    [],
    ['FLAG_HORNED'],
    ['FLAG_HOODED'],
    ['FLAG_CASTFIRE'],
    ['FLAG_CASTLIGHTNING'],
    ['FLAG_CASTFROST'],
    ['FLAG_CASTPOISON'],
    ['FLAG_BURNING'],
    ['MAGE_CLOAK'],
  ]
  if (family === 'ZOMBIE') return [[], ['FLAG_ROTTEN']]
  if (family === 'WRAITH') return [[], ['FLAG_BURNING']]
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

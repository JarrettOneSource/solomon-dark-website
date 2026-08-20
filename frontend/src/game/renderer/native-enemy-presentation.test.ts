import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import './player-hit-presentation.test.ts'

import type { AtlasManifest } from '../../editor/manifest/index.ts'
import {
  NATIVE_ENEMY_ACTION_PROGRAMS,
  nativeEnemyActionFrame,
  nativeEnemyIdleAnimationSample,
} from './native-enemy-animation.ts'
import {
  NATIVE_IMP_CONTACT_FIRE_BURST_TICKS,
  nativeImpContactFireBurstSample,
} from './native-enemy-attack-effect.ts'
import {
  nativeEnemyDeathEffectPainterLayer,
  nativeEnemyDeathEffectPlan,
} from './native-enemy-death-effect-presentation.ts'
import {
  NATIVE_ENEMY_FAMILIES,
  nativeEnemyFacingBucket,
  nativeEnemyPainterLayer,
  nativeEnemyPresentationPlan as buildNativeEnemyPresentationPlan,
  roundHalfToEven,
  type NativeEnemyAtlas,
  type NativeEnemyVisualSnapshot,
} from './native-enemy-presentation.ts'

const geometryManifests: Readonly<Record<NativeEnemyAtlas, AtlasManifest>> = {
  BadGuys: manifest('../../editor/manifest/badguys.json'),
  DeadHawg: manifest('../../editor/manifest/deadhawg.json'),
  Demon: manifest('../../editor/manifest/demon.json'),
}

function nativeEnemyPresentationPlan(
  snapshot: NativeEnemyVisualSnapshot,
  tick: number,
) {
  return buildNativeEnemyPresentationPlan(snapshot, tick, (atlas, entry) => (
    geometryManifests[atlas].entries[entry]?.extras ?? []
  ))
}

function manifest(relativePath: string): AtlasManifest {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as AtlasManifest
}

function enemy(
  enemyToken: NativeEnemyVisualSnapshot['enemyToken'],
  flags: readonly string[] = [],
): NativeEnemyVisualSnapshot {
  return {
    armored: flags.includes('FLAG_ARMOR'),
    enemyToken,
    flags,
    headingDeg: 0,
    id: 7,
    lighting: { charge: 0, glow: 0, providerCopies: 0 },
    mageCloak: false,
    nativeTypeId: {
      SKELETON: 1001,
      SKELETONARCHER: 1002,
      SKELETONMAGE: 1003,
      IMP: 1004,
      ZOMBIE: 1006,
      WRAITH: 1007,
      DEMON: 1009,
      COFFIN: 1013,
    }[enemyToken],
    position: { x: 125, y: 240 },
    shieldHealth: 0,
    shieldMaximumHealth: 0,
    spawnTick: 100,
  }
}

test('x87 round-to-nearest-even remains available for non-facing animation arithmetic', () => {
  assert.equal(roundHalfToEven(0.5), 0)
  assert.equal(roundHalfToEven(1.5), 2)
  assert.equal(roundHalfToEven(2.5), 2)
  assert.equal(roundHalfToEven(-0.5), -0)
})

test('native enemy facing truncates toward zero at every authored bucket boundary', () => {
  assert.equal(nativeEnemyFacingBucket('SKELETON', 0), 0)
  assert.equal(nativeEnemyFacingBucket('SKELETON', 20), 1)
  assert.equal(nativeEnemyFacingBucket('SKELETON', 40), 2)
  assert.equal(nativeEnemyFacingBucket('SKELETON', 340), 17)
  assert.equal(nativeEnemyFacingBucket('IMP', 0), 0)
  assert.equal(nativeEnemyFacingBucket('IMP', 30), 1)
  assert.deepEqual(
    Array.from({ length: 18 }, (_, facing) => nativeEnemyFacingBucket(
      'SKELETON',
      (facing * 20 - 10 + 360) % 360,
    )),
    Array.from({ length: 18 }, (_, facing) => facing),
  )
  assert.deepEqual(
    Array.from({ length: 12 }, (_, facing) => nativeEnemyFacingBucket(
      'IMP',
      (facing * 30 - 15 + 360) % 360,
    )),
    Array.from({ length: 12 }, (_, facing) => facing),
  )
})

test('Skeleton flags select native armor, weapon, and headgear banks', () => {
  const plan = nativeEnemyPresentationPlan(enemy('SKELETON', [
    'FLAG_ARMOR',
    'FLAG_SWORD',
    'FLAG_HOODED',
  ]), 100)

  assert.equal(plan.facing, 0)
  assert.deepEqual(plan.layers.map(({ atlas, entry, role }) => ({ atlas, entry, role })), [
    { atlas: 'BadGuys', entry: 1585, role: 'skeleton-limbs' },
    { atlas: 'BadGuys', entry: 919, role: 'skeleton-body' },
    { atlas: 'BadGuys', entry: 1045, role: 'skeleton-weapon' },
    { atlas: 'BadGuys', entry: 1495, role: 'skeleton-headgear' },
  ])
})

test('all four Skeleton headgear banks consume the independent wrapped facing', () => {
  for (const [flag, base] of [
    [null, 1477],
    ['FLAG_HELM', 1531],
    ['FLAG_HORNED', 1549],
    ['FLAG_HOODED', 1495],
  ] as const) {
    const flags = flag === null ? [] : [flag]
    const plan = nativeEnemyPresentationPlan({
      ...enemy('SKELETON', flags),
      animation: nativeEnemyIdleAnimationSample({ headFacingOffset: -1 }),
    }, 100)
    assert.equal(
      plan.layers.find(({ role }) => role === 'skeleton-headgear')?.entry,
      base + 17,
    )
  }
})

test('Skeleton ARMORMAYBE consumes the projected armor decision', () => {
  const source = enemy('SKELETON', ['FLAG_ARMORMAYBE'])
  const unarmored = nativeEnemyPresentationPlan(source, 100)
  const armored = nativeEnemyPresentationPlan({ ...source, armored: true }, 100)

  assert.equal(unarmored.layers[1]?.entry, 1117)
  assert.equal(armored.layers[1]?.entry, 613)
})

test('authoritative shields draw one sampled BadGuys 49 shell instead of body copies', () => {
  const plan = nativeEnemyPresentationPlan({
    ...enemy('SKELETONMAGE'),
    animation: nativeEnemyIdleAnimationSample({
      effects: [{
        alpha: 0.75,
        atlas: 'BadGuys',
        blendMode: 'add',
        entry: 49,
        id: 28,
        offset: { x: 0, y: -30 },
        role: 'magic-shield',
        rotationRadians: 0,
        scale: 1.6,
      }],
    }),
    shieldHealth: 25,
    shieldMaximumHealth: 50,
  }, 100)

  const shield = plan.layers.filter(({ entry }) => entry === 49)
  assert.deepEqual(shield, [{
    alpha: 0.75,
    atlas: 'BadGuys',
    blendMode: 'add',
    entry: 49,
    offset: { x: 0, y: -30 },
    role: 'effect:28:magic-shield',
    rotationRadians: 0,
    scale: 1.6,
    tint: 0xffffff,
  }])
  assert.ok(plan.layers.every(({ role }) => !role.startsWith('shield:')))
})

test('ordinary body hit redraw does not tint the independent shield shell', () => {
  const source = enemy('SKELETON')
  const plan = nativeEnemyPresentationPlan({
    ...source,
    animation: nativeEnemyIdleAnimationSample({
      effects: [{
        alpha: 0.25,
        atlas: 'BadGuys',
        blendMode: 'add',
        entry: 49,
        id: 28,
        offset: { x: 0, y: -30 },
        role: 'magic-shield',
        rotationRadians: 0,
        scale: 1.5,
      }],
      hitFlash: 0.65,
    }),
  }, 100)

  assert.equal(plan.layers.filter(({ entry }) => entry === 49).length, 1)
  assert.ok(plan.layers.some(({ role }) => role.startsWith('hit:')))
  assert.ok(plan.layers.every(({ role }) => role !== 'hit:effect:28:magic-shield'))
})

test('native hit feedback redraws the exact current pose red with normal blending', () => {
  const source = {
    ...enemy('SKELETON'),
    animation: nativeEnemyIdleAnimationSample({
      headFacingOffset: -1,
      hitFlash: 0.65,
    }),
  }
  const plan = nativeEnemyPresentationPlan(source, 100)
  const midpoint = plan.layers.length / 2
  const body = plan.layers.slice(0, midpoint)
  const hit = plan.layers.slice(midpoint)

  assert.equal(body.find(({ role }) => role === 'skeleton-headgear')?.entry, 1494)

  assert.deepEqual(
    hit.map(({ atlas, entry, offset, rotationRadians, scale }) => ({
      atlas, entry, offset, rotationRadians, scale,
    })),
    body.map(({ atlas, entry, offset, rotationRadians, scale }) => ({
      atlas, entry, offset, rotationRadians, scale,
    })),
  )
  assert.ok(hit.every((layer) => (
    layer.alpha === 0.65
    && layer.blendMode === 'normal'
    && layer.tint === 0xff0000
    && layer.role.startsWith('hit:')
  )))
})

test('Archer and Mage retain the shared stock component order', () => {
  assert.deepEqual(
    nativeEnemyPresentationPlan(enemy('SKELETONARCHER', ['FLAG_HELM']), 100)
      .layers.map((layer) => layer.entry),
    [1585, 451, 1531],
  )
  assert.deepEqual(
    nativeEnemyPresentationPlan(enemy('SKELETONMAGE', ['FLAG_HORNED']), 100)
      .layers.map((layer) => layer.entry),
    [1585, 1729, 1549],
  )
})

test('Imp uses four native 12-facing bodies and the registered upper effect', () => {
  const plan = nativeEnemyPresentationPlan(enemy('IMP'), 100)
  assert.equal(plan.layers.length, 2)
  assert.equal((plan.layers[0].entry - 285) % 12, 0)
  assert.ok(plan.layers[0].entry >= 285 && plan.layers[0].entry <= 332)
  assert.ok(plan.layers[1].entry >= 333 && plan.layers[1].entry <= 342)
  assert.deepEqual(plan.layers[1].offset, { x: 0, y: -10 })
  assert.equal(plan.layers[1].alpha, 0)
})

test('Imp renderer consumes native pose, rotation, bounce, and upper-effect alpha', () => {
  const source = enemy('IMP')
  const opening = nativeEnemyPresentationPlan({
    ...source,
    animation: nativeEnemyIdleAnimationSample({
      alpha: 1,
      bodyPose: 0,
      impBodyRotationRadians: 0.1,
      impEffectAlpha: 1,
      impEffectFrame: 0,
      verticalOffset: 0,
    }),
  }, 100)
  const airborne = nativeEnemyPresentationPlan({
    ...source,
    animation: nativeEnemyIdleAnimationSample({
      alpha: 1,
      bodyPose: 2,
      impBodyRotationRadians: 0.25,
      impEffectAlpha: 0.6,
      impEffectFrame: 7,
      verticalOffset: -4,
    }),
  }, 120)

  assert.deepEqual(
    opening.layers.map(({ alpha, entry, offset, role, rotationRadians }) => ({
      alpha, entry, offset, role, rotationRadians,
    })),
    [{ alpha: 1, entry: 285, offset: { x: 0, y: 0 }, role: 'imp-body', rotationRadians: 0.1 }, {
      alpha: 1,
      entry: 333,
      offset: { x: 0, y: -10 },
      role: 'imp-upper-effect',
      rotationRadians: 0,
    }],
  )
  assert.deepEqual(
    airborne.layers.map(({ alpha, entry, offset, role, rotationRadians }) => ({
      alpha, entry, offset, role, rotationRadians,
    })),
    [{ alpha: 1, entry: 309, offset: { x: 0, y: -4 }, role: 'imp-body', rotationRadians: 0.25 }, {
      alpha: 0.6,
      entry: 340,
      offset: { x: 0, y: -14 },
      role: 'imp-upper-effect',
      rotationRadians: 0,
    }],
  )
  assert.equal(source.id, 7)
  assert.equal(source.spawnTick, 100)
})

test('Imp attack markers own one finite native Anim_FireBurst child', () => {
  const frames = Array.from(
    { length: NATIVE_IMP_CONTACT_FIRE_BURST_TICKS },
    (_, age) => nativeImpContactFireBurstSample(17, age)!,
  )
  assert.deepEqual(frames.map(({ frameEntry }) => frameEntry), [
    251, 251, 251, 251,
    252, 252, 252, 252,
    253, 253, 253, 253,
    254, 254, 254, 254,
  ])
  assert.equal(frames[0]?.glowAlpha, 0.5)
  assert.equal(frames[15]?.glowAlpha, 0.5 / 16)
  assert.equal(frames[15]?.verticalOffset, -15)
  assert.equal(nativeImpContactFireBurstSample(17, 16), null)
  assert.throws(() => nativeImpContactFireBurstSample(0, 0), /positive safe integer/)
})

test('Zombie keeps its native constructor selectors independent', () => {
  const plan = nativeEnemyPresentationPlan({
    ...enemy('ZOMBIE'),
    animation: nativeEnemyIdleAnimationSample({
      zombieBodyType: 0,
      zombieFlyblownSide: 1,
      zombieHeadType: 0,
    }),
  }, 100)
  const entries = plan.layers.map((layer) => layer.entry)
  const bodyType = (entries[1] - 2203) / 18
  const headType = (entries[4] - 2293) / 18
  assert.ok(Number.isInteger(bodyType) && bodyType >= 0 && bodyType <= 2)
  assert.ok(Number.isInteger(headType) && headType >= 0 && headType <= 2)
  assert.deepEqual(entries, [
    2365,
    2203 + bodyType * 18,
    2095,
    2149,
    2293 + headType * 18,
  ])
  assert.deepEqual(plan.layers.map((layer) => layer.offset), [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: -12.5, y: -17.5 },
    { x: 8.5, y: -20.5 },
    { x: 0, y: -8.5 },
  ])

  const rottenEntries = nativeEnemyPresentationPlan(
    enemy('ZOMBIE', ['FLAG_ROTTEN']),
    100,
  ).layers.map((layer) => layer.entry)
  assert.ok(
    (rottenEntries[2] === 2113 && rottenEntries[3] === 2149)
    || (rottenEntries[2] === 2095 && rottenEntries[3] === 2167),
  )
})

test('Wraith, Demon, and Coffin preserve their native spawn compositions', () => {
  const wraith = nativeEnemyPresentationPlan(enemy('WRAITH'), 100)
  assert.deepEqual(wraith.layers.map((layer) => layer.entry), [2070])
  assert.deepEqual(wraith.layers[0].offset, { x: 0, y: 15 })
  assert.equal(wraith.layers[0].scale, 2)

  const demon = nativeEnemyPresentationPlan(enemy('DEMON'), 100)
  const demonBody = demon.layers.filter(({ role }) => !role.startsWith('demon-flame:'))
  const demonFlames = demon.layers.filter(({ role }) => role.startsWith('demon-flame:'))
  assert.deepEqual(demonBody.map((layer) => layer.entry), [62, 98, 19, 1, 80])
  assert.deepEqual(
    demonBody.map((layer) => layer.offset),
    [
      { x: -14, y: -28 },
      { x: 10, y: -13 },
      { x: 0, y: 0 },
      { x: 15, y: -28 },
      { x: -8.5, y: -13 },
    ],
  )
  assert.equal(demonFlames.length, 5)
  assert.deepEqual(demonFlames.map(({ scale }) => scale), [0.5, 1.1, 0.5, 0.8, 0.8])
  assert.ok(demonFlames.every(({ atlas, entry }) => (
    atlas === 'DeadHawg' && entry >= 46 && entry <= 77
  )))
  assert.deepEqual(nativeEnemyPresentationPlan(enemy('COFFIN'), 100).layers, [])
})

test('spawn presentation is stable across view creation time', () => {
  const state = enemy('IMP')
  const atSpawn = nativeEnemyPresentationPlan(state, 100)
  const afterSnapshotChurn = nativeEnemyPresentationPlan(state, 117)
  const beforeSpawn = nativeEnemyPresentationPlan(state, 50)

  assert.equal(atSpawn.spawnAgeTicks, 0)
  assert.equal(beforeSpawn.spawnAgeTicks, 0)
  assert.equal(afterSnapshotChurn.spawnAgeTicks, 17)
  assert.deepEqual(afterSnapshotChurn.layers, atSpawn.layers)
})

test('deterministic stock cosmetic choices stay inside their native banks', () => {
  for (let id = 0; id < 256; id += 1) {
    const state = { ...enemy('IMP'), id, spawnTick: id * 37 - 4_000 }
    const imp = nativeEnemyPresentationPlan(state, state.spawnTick)
    assert.ok(imp.layers[0].entry >= 285 && imp.layers[0].entry <= 332)
    assert.ok(imp.layers[1].entry >= 333 && imp.layers[1].entry <= 342)

    const zombie = nativeEnemyPresentationPlan({ ...state, enemyToken: 'ZOMBIE' }, state.spawnTick)
    assert.ok(zombie.layers[0].entry >= 2365 && zombie.layers[0].entry <= 2382)
    assert.ok(zombie.layers[1].entry >= 2203 && zombie.layers[1].entry <= 2256)
    assert.ok(zombie.layers[4].entry >= 2293 && zombie.layers[4].entry <= 2346)
  }
})

test('Coffin replays the native hidden, rise, hold, and open spawn states', () => {
  const state = enemy('COFFIN')
  const frames = Array.from({ length: 801 }, (_, age) => (
    nativeEnemyPresentationPlan(state, state.spawnTick + age).layers[0]
  ))
  const visibleFrames = frames.filter((frame) => frame !== undefined)

  assert.equal(frames[0], undefined)
  assert.ok(visibleFrames.some((frame) => frame.entry === 175))
  assert.ok(visibleFrames.some((frame) => frame.entry === 178))
  assert.equal(visibleFrames.at(-1)?.entry, 187)
  assert.deepEqual(
    nativeEnemyPresentationPlan(state, 700).layers,
    nativeEnemyPresentationPlan(state, 700).layers,
  )
})

test('enemy roots enter the shared painter queue at actor Y', () => {
  assert.deepEqual(nativeEnemyPainterLayer(enemy('COFFIN'), 12), {
    id: 'enemy:7',
    queueFamily: 'ordinary-dynamic',
    sortBias: 0,
    sourceOrder: 12,
    worldY: 240,
  })
})

test('unknown family tokens fail instead of producing a generic marker', () => {
  assert.throws(
    () => nativeEnemyPresentationPlan({
      ...enemy('IMP'),
      enemyToken: 'SPIDER' as NativeEnemyVisualSnapshot['enemyToken'],
    }, 100),
    /unsupported native enemy family SPIDER/,
  )
})

test('action programs fail closed when sampled for the wrong family', () => {
  assert.throws(
    () => nativeEnemyPresentationPlan({
      ...enemy('IMP'),
      animation: nativeEnemyIdleAnimationSample({
        action: 'archer-shot',
        state: 'action',
      }),
    }, 100),
    /action archer-shot is invalid for IMP/,
  )
})

test('presentation-facing array actions preserve exact strict ends', () => {
  for (const name of [
    'skeleton-claw-a',
    'skeleton-claw-b',
    'skeleton-weapon',
    'skeleton-pike',
    'archer-shot',
    'mage-cast-short',
    'mage-cast-long',
    'demon-bomb',
  ] as const) {
    const program = NATIVE_ENEMY_ACTION_PROGRAMS[name]
    assert.equal(program.provenance, 'native-exact')
    assert.equal(nativeEnemyActionFrame(name, program.strictEnd).complete, false)
    assert.equal(nativeEnemyActionFrame(name, program.strictEnd + 1).complete, true)
  }
})

test('authoritative gait and exact action selectors choose stock component banks', () => {
  const skeletonWalk = nativeEnemyPresentationPlan({
    ...enemy('SKELETON', ['FLAG_SWORD']),
    animation: nativeEnemyIdleAnimationSample({ gaitPose: 3, state: 'locomotion' }),
  }, 100)
  assert.deepEqual(skeletonWalk.layers.slice(0, 3).map((layer) => layer.entry), [
    1639,
    1333,
    1045,
  ])

  const archerRelease = nativeEnemyPresentationPlan({
    ...enemy('SKELETONARCHER'),
    animation: nativeEnemyIdleAnimationSample({
      action: 'archer-shot',
      actionProgress: 13,
      state: 'action',
    }),
  }, 100)
  assert.deepEqual(archerRelease.layers.slice(0, 2).map((layer) => layer.entry), [1585, 595])
  assert.equal(archerRelease.actionFrame?.selector, 8)
  assert.deepEqual(archerRelease.actionFrame?.eventMarkersReached, [13])

  const mageRelease = nativeEnemyPresentationPlan({
    ...enemy('SKELETONMAGE'),
    animation: nativeEnemyIdleAnimationSample({
      action: 'mage-cast-short',
      actionProgress: 25,
      state: 'action',
    }),
  }, 100)
  assert.deepEqual(mageRelease.layers.slice(0, 2).map((layer) => layer.entry), [1585, 1801])
})

test('Skeleton-family attacks keep gait limbs independent from body and equipment selectors', () => {
  const samples = [
    {
      action: 'skeleton-claw-a' as const,
      bodyEntry: 1315,
      flags: [],
      limbEntry: 1693,
      progress: 7,
      token: 'SKELETON' as const,
      weaponEntry: null,
    },
    {
      action: 'skeleton-weapon' as const,
      bodyEntry: 1387,
      flags: ['FLAG_SWORD'],
      limbEntry: 1693,
      progress: 9,
      token: 'SKELETON' as const,
      weaponEntry: 1099,
    },
    {
      action: 'skeleton-weapon' as const,
      bodyEntry: 973,
      flags: ['FLAG_ARMOR', 'FLAG_SWORD'],
      limbEntry: 1693,
      progress: 9,
      token: 'SKELETON' as const,
      weaponEntry: 1099,
    },
    {
      action: 'skeleton-pike' as const,
      bodyEntry: 1441,
      flags: ['FLAG_PIKE'],
      limbEntry: 1693,
      progress: 1,
      token: 'SKELETON' as const,
      weaponEntry: null,
    },
    {
      action: 'skeleton-pike' as const,
      bodyEntry: 1027,
      flags: ['FLAG_ARMOR', 'FLAG_PIKE'],
      limbEntry: 1693,
      progress: 1,
      token: 'SKELETON' as const,
      weaponEntry: null,
    },
    {
      action: 'archer-shot' as const,
      bodyEntry: 559,
      flags: [],
      limbEntry: 1693,
      progress: 3,
      token: 'SKELETONARCHER' as const,
      weaponEntry: null,
    },
    {
      action: 'mage-cast-short' as const,
      bodyEntry: 1801,
      flags: [],
      limbEntry: 1693,
      progress: 25,
      token: 'SKELETONMAGE' as const,
      weaponEntry: null,
    },
    {
      action: 'mage-cast-long' as const,
      bodyEntry: 1783,
      flags: [],
      limbEntry: 1693,
      progress: 30,
      token: 'SKELETONMAGE' as const,
      weaponEntry: null,
    },
  ]

  for (const sample of samples) {
    const plan = nativeEnemyPresentationPlan({
      ...enemy(sample.token, sample.flags),
      animation: nativeEnemyIdleAnimationSample({
        action: sample.action,
        actionProgress: sample.progress,
        bodyPose: 0,
        gaitPose: 6,
        state: 'action',
      }),
    }, 100)
    assert.equal(plan.layers[0]?.entry, sample.limbEntry, sample.action)
    assert.equal(
      plan.layers.find(({ role }) => role.endsWith('-body'))?.entry,
      sample.bodyEntry,
      sample.action,
    )
    assert.equal(
      plan.layers.find(({ role }) => role === 'skeleton-weapon')?.entry ?? null,
      sample.weaponEntry,
      sample.action,
    )
  }
})

test('stock Skeleton head-facing edge remains independent from limbs and attack body', () => {
  const animation = {
    ...nativeEnemyIdleAnimationSample({
      action: 'skeleton-claw-a',
      actionProgress: 4,
      bodyPose: 8,
      gaitPose: 2,
      state: 'action',
    }),
    headFacingOffset: -1,
  }
  const plan = nativeEnemyPresentationPlan({
    ...enemy('SKELETON'),
    animation,
    headingDeg: 151.796188,
  }, 19_948)

  assert.deepEqual(
    plan.layers.map(({ entry, role }) => ({ entry, role })),
    [
      { entry: 1629, role: 'skeleton-limbs' },
      { entry: 1269, role: 'skeleton-body' },
      { entry: 1484, role: 'skeleton-headgear' },
    ],
  )
})

test('all Skeleton-family renderers wrap only the sampled head-facing lane', () => {
  for (const token of [
    'SKELETON',
    'SKELETONARCHER',
    'SKELETONMAGE',
  ] as const) {
    const plan = nativeEnemyPresentationPlan({
      ...enemy(token),
      animation: nativeEnemyIdleAnimationSample({ headFacingOffset: 1 }),
      headingDeg: 340,
    }, 100)
    const head = plan.layers.find(({ role }) => role.endsWith('headgear'))
    const body = plan.layers.find(({ role }) => role.endsWith('body'))

    assert.equal(head?.entry, 1477, token)
    assert.ok(body, `${token} body is missing`)
    assert.notEqual(body.entry, 1477, token)
  }
})

test('Skeleton mace, flail, and pike own their native auxiliary records and geometry', () => {
  const mace = nativeEnemyPresentationPlan(enemy('SKELETON', ['FLAG_MACE']), 100)
  const maceHead = mace.layers.find(({ role }) => role === 'skeleton-mace-head')
  assert.deepEqual(
    maceHead && { entry: maceHead.entry, offset: maceHead.offset },
    { entry: 46, offset: { x: 30, y: -13.5 } },
  )

  const flail = nativeEnemyPresentationPlan({
    ...enemy('SKELETON', ['FLAG_FLAIL']),
    animation: nativeEnemyIdleAnimationSample({
      action: 'skeleton-weapon',
      actionProgress: 9,
      state: 'action',
    }),
  }, 100)
  assert.equal(flail.layers.find(({ role }) => role === 'skeleton-flail-head')?.entry, 46)
  assert.deepEqual(flail.segments, [{
    alpha: 1,
    end: { x: -11.5, y: -90 },
    role: 'skeleton-flail-chain',
    start: { x: -1, y: -76.5 },
    tint: 0x777777,
    width: 1.5,
  }])

  const pike = nativeEnemyPresentationPlan({
    ...enemy('SKELETON', ['FLAG_PIKE']),
    animation: nativeEnemyIdleAnimationSample({
      action: 'skeleton-pike',
      actionProgress: 1,
      state: 'action',
    }),
  }, 100)
  const shaft = pike.layers.find(({ role }) => role === 'skeleton-pike-shaft')
  assert.equal(shaft?.entry, 56)
  assert.equal(shaft?.rotationRadians, Math.PI / 2)
  assert.equal(shaft?.scaleX, 1)
  assert.equal(shaft?.scaleY, 64 / 136)
})

test('Archer action bodies attach only the configured native held elemental arrow', () => {
  const action = nativeEnemyIdleAnimationSample({
    action: 'archer-shot',
    actionProgress: 3,
    state: 'action',
  })
  const fire = nativeEnemyPresentationPlan({
    ...enemy('SKELETONARCHER', ['FLAG_FIREARROW']),
    animation: action,
  }, 130)
  const poison = nativeEnemyPresentationPlan({
    ...enemy('SKELETONARCHER', ['FLAG_POISONARROW']),
    animation: action,
  }, 130)
  const ordinary = nativeEnemyPresentationPlan({
    ...enemy('SKELETONARCHER'),
    animation: action,
  }, 130)

  assert.equal(fire.layers.find(({ role }) => role === 'archer-held-fire-arrow')?.entry, 261)
  assert.equal(poison.layers.find(({ role }) => role === 'archer-held-poison-arrow')?.entry, 276)
  assert.ok(ordinary.layers.every(({ role }) => !role.startsWith('archer-held-')))
})

test('Mage charge and cloak presentation enumerate every native recipe selector', () => {
  const action = nativeEnemyIdleAnimationSample({
    action: 'mage-cast-short',
    actionProgress: 25,
    state: 'action',
  })
  const expected = [
    ['FLAG_CASTFIRE', [261, 261, 261, 261]],
    ['FLAG_CASTLIGHTNING', [1838, 1838, 1838, 1838]],
    ['FLAG_CASTFROST', [381, 381]],
    ['FLAG_CASTPOISON', [382, 382]],
  ] as const
  for (const [flag, entries] of expected) {
    const plan = nativeEnemyPresentationPlan({
      ...enemy('SKELETONMAGE', [flag]),
      animation: action,
      lighting: { charge: 0.5, glow: 0, providerCopies: 1 },
    }, 130)
    const charge = plan.layers.filter(({ role }) => role.includes('-charge:'))
    assert.deepEqual(charge.map(({ entry }) => entry), entries, flag)
    assert.ok(charge.every(({ alpha }) => alpha <= 0.25), flag)
  }

  const cloak = nativeEnemyPresentationPlan({
    ...enemy('SKELETONMAGE'),
    mageCloak: true,
  }, 100)
  assert.equal(cloak.layers.find(({ role }) => role === 'mage-body')?.entry, 1459)
})

test('Rotten Zombie owns the exact two-cloud transform and private-seeded fly swarm', () => {
  const source = enemy('ZOMBIE', ['FLAG_ROTTEN'])
  const first = nativeEnemyPresentationPlan(source, 120)
  const repeated = nativeEnemyPresentationPlan(source, 120)
  const sameSeedBucket = nativeEnemyPresentationPlan(source, 129)
  const nextSeedBucket = nativeEnemyPresentationPlan(source, 130)
  const gas = first.layers.filter(({ role }) => role.startsWith('zombie-gas-cloud:'))
  const flies = first.layers.filter(({ role }) => role.startsWith('zombie-fly:'))

  assert.deepEqual(gas.map(({ alpha, entry, scaleX, scaleY, tint }) => ({
    alpha, entry, scaleX, scaleY, tint,
  })), [
    { alpha: 0.5, entry: 65, scaleX: 1.5, scaleY: 1.2, tint: 0x0d1a0d },
    { alpha: 0.5, entry: 65, scaleX: -1.5, scaleY: 1.2, tint: 0x0d1a0d },
  ])
  assert.ok(flies.length >= 5 && flies.length <= 20)
  assert.ok(flies.every(({ alpha, entry }) => entry === 26 && alpha >= 0.25 && alpha <= 0.75))
  assert.deepEqual(first.layers, repeated.layers)
  assert.deepEqual(
    first.layers.filter(({ role }) => role.startsWith('zombie-fly:')),
    sameSeedBucket.layers.filter(({ role }) => role.startsWith('zombie-fly:')),
  )
  assert.notDeepEqual(
    first.layers.filter(({ role }) => role.startsWith('zombie-fly:')),
    nextSeedBucket.layers.filter(({ role }) => role.startsWith('zombie-fly:')),
  )
})

test('Zombie and Mage retain their low-frequency native record-10/11 transient membership', () => {
  const zombieEntries = new Set<number>()
  const mageEntries = new Set<number>()
  for (let id = 1; id <= 24; id += 1) {
    const zombie = { ...enemy('ZOMBIE', ['FLAG_ROTTEN']), id }
    const mage = {
      ...enemy('SKELETONMAGE'),
      animation: nativeEnemyIdleAnimationSample({
        action: 'mage-cast-long',
        actionProgress: 5,
        state: 'action',
      }),
      id,
    }
    for (let tick = 100; tick <= 180; tick += 10) {
      for (const layer of nativeEnemyPresentationPlan(zombie, tick).layers) {
        if (layer.role.startsWith('zombie-fade-particle:')) {
          assert.equal(layer.blendMode, 'add')
          zombieEntries.add(layer.entry)
        }
      }
      for (const layer of nativeEnemyPresentationPlan(mage, tick).layers) {
        if (layer.role.startsWith('mage-cast-particle:')) {
          assert.equal(layer.blendMode, 'add')
          mageEntries.add(layer.entry)
        }
      }
    }
  }
  assert.deepEqual([...zombieEntries].sort(), [10, 11])
  assert.deepEqual([...mageEntries].sort(), [10, 11])
})

test('Wraith wisps and Demon flames remain independent ambient members around body redraws', () => {
  const wraith = nativeEnemyPresentationPlan({
    ...enemy('WRAITH', ['FLAG_BURNING']),
    animation: nativeEnemyIdleAnimationSample({
      action: 'wraith-drain',
      hitFlash: 0.75,
      state: 'action',
    }),
  }, 120)
  const wisps = wraith.layers.filter(({ role }) => role.startsWith('wraith-soul-wisp:'))
  assert.ok(wisps.length > 0)
  assert.ok(wisps.every(({ atlas, blendMode, entry }) => (
    atlas === 'BadGuys' && blendMode === 'add' && entry === 21
  )))
  assert.ok(wraith.layers.every(({ role }) => !role.startsWith('hit:wraith-soul-wisp:')))

  const demonStart = nativeEnemyPresentationPlan(enemy('DEMON'), 100)
  const demonNext = nativeEnemyPresentationPlan(enemy('DEMON'), 104)
  const startFlames = demonStart.layers.filter(({ role }) => role.startsWith('demon-flame:'))
  const nextFlames = demonNext.layers.filter(({ role }) => role.startsWith('demon-flame:'))
  assert.deepEqual(nextFlames.map(({ entry }) => entry), startFlames.map(({ entry }) => (
    46 + (entry - 46 + 1) % 32
  )))
  assert.ok(Array.from({ length: 18 }, (_, facing) => nativeEnemyPresentationPlan({
    ...enemy('DEMON'),
    headingDeg: facing * 20,
  }, 100)).some((plan) => {
    const bodyIndex = plan.layers.findIndex(({ role }) => role === 'demon-controller-body')
    const flameIndices = plan.layers.flatMap(({ role }, index) => (
      role.startsWith('demon-flame:') ? [index] : []
    ))
    return flameIndices.some((index) => index < bodyIndex)
      && flameIndices.some((index) => index > bodyIndex)
  }))
})

test('native hit redraw excludes Zombie gas, flies, and family ambient fire', () => {
  const zombie = nativeEnemyPresentationPlan({
    ...enemy('ZOMBIE', ['FLAG_ROTTEN']),
    animation: nativeEnemyIdleAnimationSample({ hitFlash: 0.5 }),
  }, 120)
  assert.equal(zombie.layers.filter(({ role }) => role.startsWith('hit:')).length, 5)
  assert.ok(zombie.layers.every(({ role }) => (
    !role.startsWith('hit:zombie-gas-cloud:') && !role.startsWith('hit:zombie-fly:')
  )))

  const skeleton = nativeEnemyPresentationPlan({
    ...enemy('SKELETON', ['FLAG_BURNING']),
    animation: nativeEnemyIdleAnimationSample({ hitFlash: 0.5 }),
  }, 120)
  assert.ok(skeleton.layers.some(({ role }) => role.startsWith('skeleton-burning-fire:')))
  assert.ok(skeleton.layers.every(({ role }) => !role.startsWith('hit:skeleton-burning-fire:')))
})

test('common native hit redraw covers every survival family body membership', () => {
  const expectedHitLayers = {
    COFFIN: 1,
    DEMON: 5,
    IMP: 2,
    SKELETON: 3,
    SKELETONARCHER: 3,
    SKELETONMAGE: 3,
    WRAITH: 1,
    ZOMBIE: 5,
  } as const
  for (const family of NATIVE_ENEMY_FAMILIES) {
    const plan = nativeEnemyPresentationPlan({
      ...enemy(family),
      animation: nativeEnemyIdleAnimationSample({
        coffinState: 'closed',
        hitFlash: 0.5,
        impEffectAlpha: 1,
        impEffectFrame: 0,
      }),
    }, 120)
    const hit = plan.layers.filter(({ role }) => role.startsWith('hit:'))
    assert.equal(hit.length, expectedHitLayers[family], family)
    assert.ok(hit.every(({ alpha, blendMode, tint }) => (
      alpha === 0.5 && blendMode === 'normal' && tint === 0xff0000
    )), family)
  }
})

test('armored Skeleton claw selector 9 preserves the native blank torso slot', () => {
  const plan = nativeEnemyPresentationPlan({
    ...enemy('SKELETON', ['FLAG_ARMOR']),
    animation: nativeEnemyIdleAnimationSample({
      action: 'skeleton-claw-b',
      actionProgress: 7,
      gaitPose: 2,
      state: 'action',
    }),
  }, 100)

  assert.deepEqual(plan.layers.map(({ entry, role }) => ({ entry, role })), [
    { entry: 1621, role: 'skeleton-limbs' },
    { entry: 1477, role: 'skeleton-headgear' },
  ])
})

test('hit presentation preserves body layers and appends native red redraws', () => {
  const plan = nativeEnemyPresentationPlan({
    ...enemy('SKELETON', ['FLAG_SWORD']),
    animation: nativeEnemyIdleAnimationSample({
      alpha: 0.8,
      hitFlash: 0.5,
    }),
  }, 100)
  const midpoint = plan.layers.length / 2
  const body = plan.layers.slice(0, midpoint)
  const flash = plan.layers.slice(midpoint)

  assert.deepEqual(flash.map((layer) => layer.entry), body.map((layer) => layer.entry))
  assert.ok(body.every((layer) => layer.blendMode === 'normal' && layer.alpha === 0.8))
  assert.ok(flash.every((layer) => (
    layer.blendMode === 'normal' && layer.alpha === 0.4 && layer.tint === 0xff0000
  )))
  assert.ok(flash.every((layer) => layer.role.startsWith('hit:')))
})

test('dying bodies render no fallback strip after handing off to effect actors', () => {
  const expected = {
    SKELETON: ['BadGuys:121', 'BadGuys:1822'],
    SKELETONARCHER: ['BadGuys:121', 'BadGuys:1822'],
    SKELETONMAGE: ['BadGuys:121', 'BadGuys:1822'],
    IMP: ['BadGuys:419'],
    ZOMBIE: ['DeadHawg:30', 'DeadHawg:77'],
    WRAITH: ['BadGuys:121', 'BadGuys:1822'],
    DEMON: ['Demon:61'],
    COFFIN: ['DeadHawg:144'],
  } as const
  for (const family of Object.keys(expected) as NativeEnemyVisualSnapshot['enemyToken'][]) {
    const plan = nativeEnemyPresentationPlan({
      ...enemy(family),
      animation: nativeEnemyIdleAnimationSample({
        deathTick: 10_000,
        state: 'death',
      }),
    }, 100)
    assert.equal(plan.deathProgram?.provenance, 'bounded-web')
    assert.deepEqual(plan.layers, [], family)
  }
})

test('authoritative effect identities replace bounded terminal fallback art', () => {
  const plan = nativeEnemyPresentationPlan({
    ...enemy('DEMON'),
    animation: nativeEnemyIdleAnimationSample({
      deathEpoch: 12,
      effects: [{
        alpha: 0.6,
        atlas: 'Demon',
        blendMode: 'add',
        entry: 55,
        id: 9001,
        offset: { x: 3, y: -7 },
        role: 'split-primary',
        rotationRadians: 0.2,
        scale: 1.5,
      }],
      state: 'death',
    }),
  }, 100)
  assert.equal(plan.deathProgram?.name, 'demon-split')
  assert.deepEqual(plan.layers, [{
    alpha: 0.6,
    atlas: 'Demon',
    blendMode: 'add',
    entry: 55,
    offset: { x: 3, y: -7 },
    role: 'effect:9001:split-primary',
    rotationRadians: 0.2,
    scale: 1.5,
    tint: 0xffffff,
  }])
})

test('Wraith opacity and Zombie articulation are sampled rather than wall-clock driven', () => {
  const wraith = nativeEnemyPresentationPlan({
    ...enemy('WRAITH'),
    animation: nativeEnemyIdleAnimationSample({
      action: 'wraith-drain',
      alpha: 1,
      state: 'action',
      verticalOffset: 0,
    }),
  }, 10_000)
  assert.equal(wraith.layers[0].alpha, 1)
  assert.deepEqual(wraith.layers[0].offset, { x: 0, y: 15 })
  assert.equal(wraith.actionFrame, null)

  const zombie = nativeEnemyPresentationPlan({
    ...enemy('ZOMBIE'),
    animation: nativeEnemyIdleAnimationSample({
      gaitPose: 4,
      state: 'locomotion',
      zombieAngularOffsetDeg: 20,
      zombieBodyRotationRadians: -0.15,
      zombieBodyType: 0,
      zombieFlyblownSide: 1,
      zombieFrontArmPose: 2,
      zombieFrontArmRotationRadians: -0.4,
      zombieRearArmPose: 1,
      zombieRearArmRotationRadians: 0.25,
      zombieHeadType: 0,
      zombieHeadRotationRadians: 0.35,
    }),
  }, 10_000)
  assert.equal(zombie.facing, 1)
  assert.equal(zombie.layers[0].entry, 2438)
  assert.equal(zombie.layers[1].rotationRadians, -0.15)
  assert.equal(zombie.layers[2].entry, 2114)
  assert.equal(zombie.layers[2].rotationRadians, 0.25)
  assert.deepEqual(zombie.layers[2].offset, { x: -13, y: -21 })
  assert.equal(zombie.layers[3].entry, 2186)
  assert.equal(zombie.layers[3].rotationRadians, -0.4)
  assert.deepEqual(zombie.layers[3].offset, { x: 8, y: -18 })
  assert.deepEqual(zombie.layers[4].offset, { x: -1, y: -8.5 })
  assert.equal(zombie.layers[4].rotationRadians, 0.35)
})

test('Demon joints and Coffin later states consume authoritative articulation samples', () => {
  const demon = nativeEnemyPresentationPlan({
    ...enemy('DEMON'),
    animation: nativeEnemyIdleAnimationSample({
      bodyPose: 1,
      demonFrontJointRotationRadians: 0.1,
      demonFrontLimbRotationRadians: 0.2,
      demonRearJointRotationRadians: -0.1,
      demonRearLimbRotationRadians: -0.2,
    }),
  }, 100)
  const demonBody = demon.layers.filter(({ role }) => !role.startsWith('demon-flame:'))
  assert.deepEqual(demonBody.map((layer) => layer.rotationRadians), [-0.2, -0.1, 0, 0.2, 0.1])
  assert.equal(demonBody[2].entry, 37)
  assert.deepEqual(demonBody.map((layer) => layer.offset), [
    { x: -14, y: -31 },
    { x: 10, y: -13 },
    { x: 0, y: 0 },
    { x: 15, y: -31 },
    { x: -8.5, y: -13 },
  ])

  const demonBomb = nativeEnemyPresentationPlan({
    ...enemy('DEMON'),
    animation: nativeEnemyIdleAnimationSample({
      action: 'demon-bomb',
      actionProgress: 4,
      state: 'action',
    }),
  }, 100)
  assert.equal(demonBomb.actionFrame?.selector, 1)
  assert.equal(
    demonBomb.layers.find(({ role }) => role === 'demon-controller-body')?.entry,
    37,
  )

  const coffin = nativeEnemyPresentationPlan({
    ...enemy('COFFIN'),
    animation: nativeEnemyIdleAnimationSample({
      coffinSecondaryPose: 9,
      coffinState: 'open',
      maggots: [
        {
          alpha: 0.75,
          headingDeg: 0,
          id: 41,
          offset: { x: 12, y: -3 },
          pose: 1,
          rotationRadians: 0.5,
          state: 'bite',
        },
        {
          alpha: 1,
          headingDeg: 0,
          id: 42,
          offset: { x: -8, y: 4 },
          pose: 0,
          rotationRadians: 0,
          state: 'death',
        },
      ],
    }),
  }, 100)
  assert.deepEqual(
    coffin.layers.map(({ atlas, entry, role }) => ({ atlas, entry, role })),
    [
      { atlas: 'BadGuys', entry: 187, role: 'coffin-open' },
      { atlas: 'BadGuys', entry: 392, role: 'coffin-secondary' },
      { atlas: 'BadGuys', entry: 220, role: 'maggot:41:bite' },
      { atlas: 'DeadHawg', entry: 28, role: 'maggot:42:death' },
    ],
  )
  assert.deepEqual(coffin.layers[2].offset, { x: 12, y: -3 })
})

test('death-effect presentation keeps airborne art and enhanced shadow on the ground plane', () => {
  const effect = {
    ageTicks: 7,
    alpha: 0.75,
    atlas: 'BadGuys' as const,
    blendMode: 'normal' as const,
    entry: 117,
    height: -12,
    id: 41,
    kind: 'bouncer' as const,
    ownerActorId: 7,
    position: { x: 125, y: 240 },
    rotationRadians: 0.5,
    scale: 1.2,
    shadow: true,
    spawnTick: 100,
    tint: 0xff8844,
  }
  const plan = nativeEnemyDeathEffectPlan(effect)
  assert.deepEqual(plan.position, effect.position)
  assert.deepEqual(plan.effect, {
    alpha: 0.75,
    atlas: 'BadGuys',
    blendMode: 'normal',
    entry: 117,
    offset: { x: 0, y: -12 },
    rotationRadians: 0.5,
    scale: { x: 1.2, y: 1.2 },
    tint: 0xff8844,
  })
  assert.deepEqual(plan.shadow && {
    ...plan.shadow,
    scale: { ...plan.shadow.scale, y: Number(plan.shadow.scale.y.toFixed(6)) },
  }, {
    alpha: 0.75,
    atlas: 'BadGuys',
    blendMode: 'normal',
    entry: 117,
    offset: { x: 0, y: 2 },
    rotationRadians: 0.5,
    scale: { x: 1.2, y: 0.9 },
    tint: 0,
  })
  assert.deepEqual(nativeEnemyDeathEffectPainterLayer(effect, 3), {
    id: 'enemy-death-effect:41',
    queueFamily: 'ordinary-dynamic',
    sortBias: 0,
    sourceOrder: 3,
    worldY: 240,
  })
})

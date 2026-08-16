import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import type { AtlasManifest } from '../../editor/manifest/index.ts'
import {
  NATIVE_ENEMY_ACTION_PROGRAMS,
  nativeEnemyActionFrame,
  nativeEnemyIdleAnimationSample,
} from './native-enemy-animation.ts'
import {
  nativeEnemyDeathEffectPainterLayer,
  nativeEnemyDeathEffectPlan,
} from './native-enemy-death-effect-presentation.ts'
import {
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
    animation: nativeEnemyIdleAnimationSample({ hitFlash: 0.65 }),
  }
  const plan = nativeEnemyPresentationPlan(source, 100)
  const midpoint = plan.layers.length / 2
  const body = plan.layers.slice(0, midpoint)
  const hit = plan.layers.slice(midpoint)

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

  assert.deepEqual(
    nativeEnemyPresentationPlan(enemy('DEMON'), 100).layers.map((layer) => layer.entry),
    [62, 98, 19, 1, 80],
  )
  assert.deepEqual(
    nativeEnemyPresentationPlan(enemy('DEMON'), 100).layers.map((layer) => layer.offset),
    [
      { x: -14, y: -28 },
      { x: 10, y: -13 },
      { x: 0, y: 0 },
      { x: 15, y: -28 },
      { x: -8.5, y: -13 },
    ],
  )
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
    1387,
    1099,
  ])

  const archerRelease = nativeEnemyPresentationPlan({
    ...enemy('SKELETONARCHER'),
    animation: nativeEnemyIdleAnimationSample({
      action: 'archer-shot',
      actionProgress: 13,
      state: 'action',
    }),
  }, 100)
  assert.deepEqual(archerRelease.layers.slice(0, 2).map((layer) => layer.entry), [1711, 595])
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
  assert.deepEqual(mageRelease.layers.slice(0, 2).map((layer) => layer.entry), [1657, 1801])
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
  assert.deepEqual(demon.layers.map((layer) => layer.rotationRadians), [-0.2, -0.1, 0, 0.2, 0.1])
  assert.equal(demon.layers[2].entry, 37)
  assert.deepEqual(demon.layers.map((layer) => layer.offset), [
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
  assert.equal(demonBomb.layers[2].entry, 37)

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

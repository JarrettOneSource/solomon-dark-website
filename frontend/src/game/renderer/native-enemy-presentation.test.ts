import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_ENEMY_ACTION_PROGRAMS,
  nativeEnemyActionFrame,
  nativeEnemyIdleAnimationSample,
} from './native-enemy-animation.ts'
import {
  nativeEnemyFacingBucket,
  nativeEnemyPainterLayer,
  nativeEnemyPresentationPlan,
  roundHalfToEven,
  type NativeEnemyVisualSnapshot,
} from './native-enemy-presentation.ts'
import {
  nativeMageLightningPlan,
  sampledMageLightningEventIds,
  shouldRenderSemanticMageLightning,
} from './native-mage-lightning-presentation.ts'

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

test('native enemy facing uses x87 round-to-nearest-even at half buckets', () => {
  assert.equal(roundHalfToEven(0.5), 0)
  assert.equal(roundHalfToEven(1.5), 2)
  assert.equal(roundHalfToEven(2.5), 2)
  assert.equal(roundHalfToEven(-0.5), -0)

  assert.equal(nativeEnemyFacingBucket('SKELETON', 0), 0)
  assert.equal(nativeEnemyFacingBucket('SKELETON', 20), 2)
  assert.equal(nativeEnemyFacingBucket('SKELETON', 40), 2)
  assert.equal(nativeEnemyFacingBucket('SKELETON', 340), 0)
  assert.equal(nativeEnemyFacingBucket('IMP', 0), 0)
  assert.equal(nativeEnemyFacingBucket('IMP', 30), 2)
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

test('authoritative shields append proportional additive body layers', () => {
  const plan = nativeEnemyPresentationPlan({
    ...enemy('SKELETONMAGE'),
    shieldHealth: 25,
    shieldMaximumHealth: 50,
  }, 100)

  const midpoint = plan.layers.length / 2
  assert.deepEqual(
    plan.layers.slice(midpoint).map((layer) => layer.role),
    plan.layers.slice(0, midpoint).map((layer) => `shield:${layer.role}`),
  )
  assert.ok(plan.layers.slice(midpoint).every((layer) => (
    layer.alpha === 0.5 && layer.blendMode === 'add' && layer.scale === 1.05
  )))
})

test('Mage lightning event covers every default cadence phase without doubling a caught sample', () => {
  for (let onsetPhase = 0; onsetPhase < 5; onsetPhase += 1) {
    const event = {
      actorId: 7,
      eventId: 40 + onsetPhase,
      runId: 'run-lightning',
      sourcePosition: { x: 125, y: 240 },
      targetPlayerId: 'local',
      targetPosition: { x: 300, y: 260 },
      tick: 100 + onsetPhase,
      type: 'mage-lightning' as const,
    }
    const localPlan = nativeMageLightningPlan(event, 0)
    assert.deepEqual(localPlan?.layers.map(({ entry, role }) => ({ entry, role })), [
      { entry: 381, role: 'mage-lightning-source' },
      { entry: 382, role: 'mage-lightning-target' },
    ])

    const nextSnapshotTick = Math.ceil(event.tick / 5) * 5
    const caughtBySnapshot = nextSnapshotTick - event.tick < 4
    const sampled = caughtBySnapshot
      ? [{
          ...enemy('SKELETONMAGE'),
          animation: nativeEnemyIdleAnimationSample({
            effects: [{
              alpha: 1,
              atlas: 'BadGuys',
              blendMode: 'add',
              entry: 381,
              id: event.eventId * 4 + 2,
              offset: { x: 0, y: 0 },
              role: 'mage-lightning-source',
              rotationRadians: 0,
              scale: 1,
            }, {
              alpha: 1,
              atlas: 'BadGuys',
              blendMode: 'add',
              entry: 382,
              id: event.eventId * 4 + 3,
              offset: { x: 175, y: 20 },
              role: 'mage-lightning-target',
              rotationRadians: 0,
              scale: 1,
            }],
          }),
        }]
      : []
    const sampledIds = sampledMageLightningEventIds(sampled)
    assert.equal(
      sampledIds.has(event.eventId),
      caughtBySnapshot,
      `onset phase ${onsetPhase}`,
    )
    assert.equal(
      shouldRenderSemanticMageLightning(event.eventId, sampledIds),
      !caughtBySnapshot,
      `local semantic pair visibility at onset phase ${onsetPhase}`,
    )
  }
  assert.equal(nativeMageLightningPlan({
    actorId: 7,
    eventId: 99,
    runId: 'run-lightning',
    sourcePosition: { x: 0, y: 0 },
    targetPlayerId: 'local',
    targetPosition: { x: 1, y: 1 },
    tick: 100,
    type: 'mage-lightning',
  }, 4), null)
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

test('Zombie keeps its native constructor selectors independent', () => {
  const entries = nativeEnemyPresentationPlan(enemy('ZOMBIE'), 100)
    .layers.map((layer) => layer.entry)
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

test('presentation-facing action sampling preserves exact strict ends and bounded labels', () => {
  for (const name of [
    'skeleton-claw-a',
    'skeleton-claw-b',
    'skeleton-weapon',
    'skeleton-pike',
    'archer-shot',
    'mage-cast-short',
    'mage-cast-long',
  ] as const) {
    const program = NATIVE_ENEMY_ACTION_PROGRAMS[name]
    assert.equal(program.provenance, 'native-exact')
    assert.equal(nativeEnemyActionFrame(name, program.strictEnd).complete, false)
    assert.equal(nativeEnemyActionFrame(name, program.strictEnd + 1).complete, true)
  }
  for (const name of [
    'imp-contact',
    'zombie-swipe',
    'wraith-drain',
    'demon-claw',
    'demon-bomb',
    'coffin-open',
  ] as const) {
    assert.equal(NATIVE_ENEMY_ACTION_PROGRAMS[name].provenance, 'bounded-web')
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

test('hit presentation preserves body layers and appends additive overlays', () => {
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
  assert.ok(flash.every((layer) => layer.blendMode === 'add' && layer.alpha === 0.4))
  assert.ok(flash.every((layer) => layer.role.endsWith('-hit-flash')))
})

test('all families retain a terminal death plan until authoritative retirement', () => {
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
    assert.deepEqual(
      plan.layers.map((layer) => `${layer.atlas}:${layer.entry}`),
      expected[family],
      family,
    )
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
  }])
})

test('Wraith fade and Zombie articulation are sampled rather than wall-clock driven', () => {
  const wraith = nativeEnemyPresentationPlan({
    ...enemy('WRAITH'),
    animation: nativeEnemyIdleAnimationSample({
      alpha: 0.25,
      verticalOffset: -6,
    }),
  }, 10_000)
  assert.equal(wraith.layers[0].alpha, 0.25)
  assert.deepEqual(wraith.layers[0].offset, { x: 0, y: 9 })

  const zombie = nativeEnemyPresentationPlan({
    ...enemy('ZOMBIE'),
    animation: nativeEnemyIdleAnimationSample({
      gaitPose: 4,
      state: 'locomotion',
      zombieAngularOffsetDeg: 20,
      zombieFrontArmPose: 2,
      zombieFrontArmRotationRadians: -0.4,
      zombieRearArmPose: 1,
      zombieRearArmRotationRadians: 0.25,
    }),
  }, 10_000)
  assert.equal(zombie.facing, 2)
  assert.equal(zombie.layers[0].entry, 2439)
  assert.equal(zombie.layers[2].entry, 2115)
  assert.equal(zombie.layers[2].rotationRadians, 0.25)
  assert.equal(zombie.layers[3].entry, 2187)
  assert.equal(zombie.layers[3].rotationRadians, -0.4)
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

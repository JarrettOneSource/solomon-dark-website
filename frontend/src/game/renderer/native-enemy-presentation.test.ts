import assert from 'node:assert/strict'
import test from 'node:test'

import {
  nativeEnemyFacingBucket,
  nativeEnemyPainterLayer,
  nativeEnemyPresentationPlan,
  roundHalfToEven,
  type NativeEnemyVisualSnapshot,
} from './native-enemy-presentation.ts'

function enemy(
  enemyToken: NativeEnemyVisualSnapshot['enemyToken'],
  flags: readonly string[] = [],
): NativeEnemyVisualSnapshot {
  return {
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

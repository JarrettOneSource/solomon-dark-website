import assert from 'node:assert/strict'
import test from 'node:test'
import { BONEYARD_SOLOMON_PHASES } from '../core-kernels/boneyard-encounter.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import type { NativeTreeActorPoses } from './boneyard-tree-actors.ts'
import { nativeTreeActorPositions, nativeTreeActorPositionsFromSnapshot } from './boneyard-tree-actors.ts'

type EnemyPose = NativeTreeActorPoses['enemies'][number]

const ENEMIES = [
  ['COFFIN', 1013], ['COCOON', 2058], ['DEMON', 1009], ['DEMONSKULL', 1008],
  ['DIREFACULTY', 1010], ['HEARTMONGER', 1011], ['IMP', 1004], ['PORTAL', 5021],
  ['SKELETON', 1001], ['SKELETONARCHER', 1002], ['SKELETONMAGE', 1003],
  ['SPIDER', 2057], ['WRAITH', 1007], ['ZOMBIE', 1006],
] as const satisfies readonly (readonly [EnemyPose['enemyToken'], number])[]

function poses(overrides: Partial<NativeTreeActorPoses> = {}): NativeTreeActorPoses {
  return { players: [], enemies: [], maggots: [], encounter: null, ...overrides }
}

function enemy(enemyToken: EnemyPose['enemyToken'], nativeTypeId: number,
  overrides: Partial<EnemyPose> = {}): EnemyPose {
  return { id: 1, position: { x: 30, y: -150 }, enemyToken, nativeTypeId,
    animationState: 'idle', coffinState: 'closed', ...overrides }
}

test('Tree actor census covers every authored enemy token and native type', () => {
  assert.deepEqual(Object.fromEntries(ENEMIES), BONEYARD_WAVE_ENEMY_TYPES)
})

for (const [token, typeId] of ENEMIES) {
  for (const animationState of ['idle', 'locomotion', 'action', 'death'] as const) {
    test(`${token} ${animationState} Tree membership follows category lifetime`, () => {
      const actor = enemy(token, typeId, { animationState })
      assert.deepEqual(nativeTreeActorPositions(poses({ enemies: [actor] }), 'local'),
        animationState === 'death' ? [] : [actor.position])
    })
  }
}

for (const coffinState of ['hidden', 'closed', 'opening', 'transition-delay', 'open'] as const) {
  test(`Coffin ${coffinState} Tree membership follows rise admission`, () => {
    const actor = enemy('COFFIN', 1013, { coffinState })
    assert.deepEqual(nativeTreeActorPositions(poses({ enemies: [actor] }), 'local'),
      coffinState === 'hidden' ? [] : [actor.position])
  })
}

test('unknown and mismatched native enemy types cannot inherit Badguy membership', () => {
  assert.deepEqual(nativeTreeActorPositions(poses({ enemies: [
    enemy('SKELETON', -1),
    enemy('COCOON', 1001),
    enemy('SKELETON', 1001, { enemyToken: 'UNKNOWN' as EnemyPose['enemyToken'] }),
  ] }), 'local'), [])
})

test('only the selected native primary player triggers, even when not first in player order', () => {
  const source = poses({ players: [
    { id: 'peer', position: { x: 5, y: 6 } },
    { id: 'local', position: { x: 7, y: 8 } },
    { id: 'other-peer', position: { x: 9, y: 10 } },
  ] })
  assert.deepEqual(nativeTreeActorPositions(source, 'local'), [{ x: 7, y: 8 }])
  assert.deepEqual(nativeTreeActorPositions(source, 'peer'), [{ x: 5, y: 6 }])
  assert.deepEqual(nativeTreeActorPositions(source, 'absent'), [])
})

for (const state of ['emerging', 'crawl', 'bite', 'death'] as const) {
  for (const nativeTreeQueryMember of [false, true]) {
    test(`Maggot ${state} uses explicit Tree-query membership=${nativeTreeQueryMember}`, () => {
      const maggot = { id: 1, position: { x: 11, y: 12 }, state, nativeTreeQueryMember }
      assert.deepEqual(nativeTreeActorPositions(poses({ maggots: [maggot] }), 'local'),
        nativeTreeQueryMember ? [maggot.position] : [])
    })
  }
}

test('adapter preserves exact roots and does not apply a distance or collision-body proxy', () => {
  const root = Object.freeze({ x: 1e8 + 0.125, y: -1e8 - 0.375 })
  const source = Object.freeze(poses({
    players: Object.freeze([Object.freeze({ id: 'local', position: root })]),
    enemies: Object.freeze([Object.freeze(enemy('WRAITH', 1007, { position: root }))]),
  }))
  const result = nativeTreeActorPositions(source, 'local')
  assert.deepEqual(result, [root, root])
  assert.equal(result[0], root)
  assert.equal(result[1], root)
})

for (const phase of BONEYARD_SOLOMON_PHASES) {
  test(`Solomon ${phase} uses the existing active versus renderer-absent lifetime`, () => {
    const encounter = { position: { x: 13, y: 14 }, phase }
    assert.deepEqual(nativeTreeActorPositions(poses({ encounter }), 'local'),
      phase === 'gone' ? [] : [encounter.position])
  })
}

test('current snapshot adapter preserves retained local corpse and excludes peer/UI state guesses', () => {
  const source = {
    players: {
      peer: { position: { x: 1, y: 2 }, lifeState: 'alive' },
      local: { position: { x: 3, y: 4 }, lifeState: 'spectating', currentHealth: 0 },
    },
    world: {
      enemies: [{ id: 10, position: { x: 5, y: 6 }, enemyToken: 'COCOON' as const,
        nativeTypeId: 2058, animation: { state: 'idle' as const, coffinState: 'hidden' as const } }],
      maggots: [{ id: 20, position: { x: 7, y: 8 }, state: 'bite' as const, nativeTreeQueryMember: true }],
      encounter: null,
    },
  }
  assert.deepEqual(nativeTreeActorPositionsFromSnapshot(source, 'local'),
    [{ x: 3, y: 4 }, { x: 5, y: 6 }, { x: 7, y: 8 }])
  delete (source.players as Partial<typeof source.players>).local
  assert.deepEqual(nativeTreeActorPositionsFromSnapshot(source, 'local'),
    [{ x: 5, y: 6 }, { x: 7, y: 8 }])
})

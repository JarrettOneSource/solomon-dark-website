import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  BoneyardEnemyActor,
  BoneyardEnemyStore,
  BoneyardMaggotActor,
} from '../boneyard-enemy-store.ts'
import {
  createMlBotPolicyEnemyMemory,
  observeMlBotPolicyEnemies,
} from './enemies.ts'

function enemy(id: number, x: number, health = 50): BoneyardEnemyActor {
  return {
    brain: { action: 'weapon', actionProgress: 0, contactTargetPlayerId: null, family: 'skeleton', markerEmitted: false, phase: 'approach' },
    config: { collisionRadius: 20, enemyToken: 'SKELETON', maximumHealth: 100 },
    currentHealth: health,
    headingDeg: 90,
    id,
    lifeState: 'alive',
    position: { x, y: 100 },
    shieldHealth: 0,
    shieldMaximumHealth: 0,
    targetPlayerId: null,
  } as BoneyardEnemyActor
}

function store(actors: readonly BoneyardEnemyActor[]): BoneyardEnemyStore {
  return { actors, maggots: [] } as unknown as BoneyardEnemyStore
}

test('enemy observation sorts by distance while target identity persists by actor id', () => {
  const first = observeMlBotPolicyEnemies({ enemies: store([
    enemy(2, 300),
    enemy(1, 200),
  ]) }, {
    memory: { ...createMlBotPolicyEnemyMemory(), targetId: 2 },
    ownMinionTargetIds: new Set(),
    primaryRange: 250,
    selfPosition: { x: 100, y: 100 },
    tick: 10,
  })
  assert.deepEqual(first.rows.map(({ id }) => id), [1, 2])
  assert.equal(first.blockD[9], 0)
  assert.equal(first.blockD[11 + 9], 1)
  assert.equal(first.blockE[0], 1)
  assert.ok(Math.abs(first.blockE[3]! - 0.2) < 1e-6)

  const second = observeMlBotPolicyEnemies({ enemies: store([
    enemy(2, 299.5),
    enemy(1, 400),
  ]) }, {
    ...first.next,
    ownMinionTargetIds: new Set([2]),
    primaryRange: 250,
    selfPosition: { x: 100, y: 100 },
    tick: 11,
  })
  assert.deepEqual(second.rows.map(({ id }) => id), [2, 1])
  assert.equal(second.blockD[9], 1)
  assert.equal(second.blockD[10], 1)
  assert.ok(Math.abs(second.blockD[6]! - -0.05) < 1e-6)
  assert.equal(second.blockE[0], 1)
})

test('alive maggots join the target pool while every dying actor is excluded', () => {
  const dying = { ...enemy(1, 150), lifeState: 'dying' } as BoneyardEnemyActor
  const maggot = {
    collisionRadius: 8,
    currentHealth: 5,
    headingDeg: 0,
    id: 4,
    lifeState: 'alive',
    maximumHealth: 10,
    position: { x: 200, y: 100 },
    targetPlayerId: 'agent',
  } as BoneyardMaggotActor
  const observed = observeMlBotPolicyEnemies({
    enemies: { actors: [dying], maggots: [maggot] } as unknown as BoneyardEnemyStore,
  }, {
    memory: createMlBotPolicyEnemyMemory(),
    ownMinionTargetIds: new Set(),
    primaryRange: 250,
    selfPosition: { x: 100, y: 100 },
    tick: 10,
  })
  assert.deepEqual(observed.rows.map(({ id, species }) => [id, species]), [[4, 'maggot']])
})

import assert from 'node:assert/strict'
import test from 'node:test'

import type { NativeSecondarySimulationState } from '../../core-kernels/native-secondary-abilities.ts'
import type { BoneyardEnemyActor, BoneyardMaggotActor } from '../boneyard-enemy-store.ts'
import type { MlBotPolicyEnemyRow } from './enemies.ts'
import { observeMlBotPolicyEnemyExtensions } from './enemy-extensions.ts'

function skeleton(): MlBotPolicyEnemyRow {
  const source = {
    brain: {
      action: 'weapon',
      actionProgress: 8,
      contactTargetPlayerId: 'agent',
      family: 'skeleton',
      markerEmitted: false,
      phase: 'attack',
    },
    config: {
      attackSpeed: 1,
      collisionRadius: 20,
      enemyToken: 'SKELETON',
      family: { armor: true, headgear: 0, weapon: 'sword' },
      maximumHealth: 100,
    },
    currentHealth: 75,
    headingDeg: 90,
    id: 7,
    lifeState: 'alive',
    position: { x: 200, y: 100 },
    shieldHealth: 5,
    shieldMaximumHealth: 10,
    staffActionFactor: 1,
    targetPlayerId: 'agent',
  } as BoneyardEnemyActor
  return {
    currentHealth: 75,
    headingDeg: 90,
    id: 7,
    maximumHealth: 100,
    position: source.position,
    radius: 20,
    source,
    species: 'skeleton',
    targetPlayerId: 'agent',
    velocity: { x: 0, y: 0 },
  }
}

test('enemy extension reports exact action-clock timing and joined statuses', () => {
  const secondaryAbilities = {
    actors: [],
    targetEffects: [{
      coldSlowFactor: 0.5,
      coldSlowTicks: 200,
      dazzleTicks: 0,
      disruptedTicks: 0,
      electricBurn: null,
      fleeTicks: 0,
      frostBurnTicks: 0,
      frozenTicks: 100,
      prismaticTicks: 0,
      steamed: null,
      stunTicks: 0,
      targetId: 7,
      timeScale: 0.5,
      weakenFactor: 0.75,
      worldKey: 'run',
    }],
  } as unknown as NativeSecondarySimulationState
  const block = observeMlBotPolicyEnemyExtensions([skeleton()], {
    secondaryAbilities,
    selfPlayerId: 'agent',
    tick: 100,
    worldKey: 'run',
  })
  assert.equal(block.length, 8 * 44)
  assert.equal(block[0], 1)
  assert.equal(block[14], 1)
  assert.ok(Math.abs(block[21]! - 0.02) < 1e-6)
  assert.equal(block[24], 0)
  assert.equal(block[25], 1)
  assert.equal(block[26], 1)
  assert.equal(block[28], 0.5)
  assert.equal(block[29], 1)
  assert.equal(block[30], 1)
  assert.equal(block[32], 1)
  assert.ok(Math.abs(block[33]! - 1 / 60) < 1e-6)
  assert.equal(block[42], 0.75)
  assert.equal(block[43], 0.5)
})

test('maggot rows expose species and bite countdown from the live attack clock', () => {
  const source = {
    collisionRadius: 8,
    currentHealth: 5,
    headingDeg: 0,
    id: 9,
    lastAttackTick: 90,
    lifeState: 'alive',
    maximumHealth: 10,
    movementPhase: 'crawl',
    nextAttackTick: 120,
    position: { x: 200, y: 100 },
    targetPlayerId: 'agent',
  } as BoneyardMaggotActor
  const row: MlBotPolicyEnemyRow = {
    currentHealth: 5,
    headingDeg: 0,
    id: 9,
    maximumHealth: 10,
    position: source.position,
    radius: 8,
    source,
    species: 'maggot',
    targetPlayerId: 'agent',
    velocity: { x: 0, y: 0 },
  }
  const block = observeMlBotPolicyEnemyExtensions([row], {
    secondaryAbilities: { actors: [], targetEffects: [] } as unknown as NativeSecondarySimulationState,
    selfPlayerId: 'agent',
    tick: 100,
    worldKey: 'run',
  })
  assert.equal(block[8], 1)
  assert.equal(block[16], 1)
  assert.ok(Math.abs(block[21]! - 0.1) < 1e-6)
  assert.equal(block[25], 1)
})

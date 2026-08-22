import assert from 'node:assert/strict'
import test from 'node:test'

import { createIdlePlayerCharacterInput } from '../../core-kernels/player-character.ts'
import { createGameSimulation, type GameSimulationState } from '../game-simulation.ts'
import type { MlBotPolicyEnemyRow } from './enemies.ts'
import {
  createMlBotPolicyWorldMemory,
  observeMlBotPolicyWorldState,
} from './world-state.ts'

test('world observation exposes pickups, allies, aggregates, and potion timers', () => {
  const base = createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
    ally: { discipline: 'body', displayName: 'Ally', element: 'water' },
  })
  const state = {
    ...base,
    run: { ...base.run, eligiblePlayerIds: ['agent', 'ally'], phase: 'active', runId: 'run' },
    world: {
      bounds: { h: 1_000, w: 1_000, x: 0, y: 0 },
      kind: 'boneyard',
      loot: { actors: [{
        amount: 1,
        id: 1,
        item: {
          id: 1,
          kind: 'health-potion',
          nativeTypeId: 7001,
          quantity: 2,
        },
        kind: 'sack',
        orbKind: null,
        position: { x: 150, y: 100 },
      }] },
      waves: { phase: 'spawning', waveOrdinal: 2 },
    },
  } as unknown as GameSimulationState
  const enemy = {
    currentHealth: 50,
    id: 3,
    maximumHealth: 100,
    position: { x: 200, y: 100 },
  } as MlBotPolicyEnemyRow
  const allyInput = createIdlePlayerCharacterInput()
  allyInput.movement.x = 1
  const observed = observeMlBotPolicyWorldState(state, 'agent', [enemy], {
    activeInputs: { ally: allyInput },
    controllers: { agent: 'bot', ally: 'human' },
    memory: createMlBotPolicyWorldMemory(),
    previousAction: null,
    targetId: 3,
  })
  assert.equal(observed.blockG.length, 4 * 21 + 1)
  assert.equal(observed.blockH.length, 43)
  assert.equal(observed.blockI.length, 4 * 10 + 1)
  assert.equal(observed.blockJ.length, 3)
  assert.equal(observed.blockG[0], 1)
  assert.equal(observed.blockG[7], 1)
  assert.equal(observed.blockG[10], 1)
  assert.ok(Math.abs(observed.blockH[0]! - 1 / 16) < 1e-6)
  assert.equal(observed.blockI[0], 1)
  assert.equal(observed.blockI[7], 1)
  assert.equal(observed.blockI[8], 1)
  assert.deepEqual([...observed.blockJ], [0, 0, 0])
})

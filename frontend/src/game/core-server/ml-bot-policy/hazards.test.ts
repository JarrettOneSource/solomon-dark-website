import assert from 'node:assert/strict'
import test from 'node:test'

import type { BoneyardEnemyStore } from '../boneyard-enemy-store.ts'
import { observeMlBotPolicyHazards } from './hazards.ts'

test('hostile hazard observation uses exact projectile motion and contact timing', () => {
  const enemies = {
    actors: [],
    mageLightningPulses: [],
    projectiles: [{
      ageTicks: 50,
      coldSlowTicks: 20,
      contactRadius: 10,
      damage: 25,
      headingDeg: 270,
      hitPlayerIds: [],
      homing: false,
      id: 9,
      kind: 'arrow',
      lifetimeTicks: 200,
      ownerActorId: 1,
      poisonDamage: 0,
      position: { x: 200, y: 100 },
      speed: 100,
      targetPlayerId: 'agent',
    }],
  } as unknown as BoneyardEnemyStore
  const block = observeMlBotPolicyHazards({ enemies }, {
    playerId: 'agent',
    position: { x: 100, y: 100 },
    radius: 25,
  })
  assert.equal(block.length, 12 * 24 + 1)
  assert.equal(block[0], 1)
  assert.equal(block[1], 1)
  assert.equal(block[7], 1)
  assert.ok(Math.abs(block[9]! - 0.09) < 1e-6)
  assert.ok(Math.abs(block[10]! - -0.1) < 1e-6)
  assert.ok(Math.abs(block[13]! - 0.065) < 1e-6)
  assert.ok(Math.abs(block[14]! - 0.025) < 1e-6)
  assert.equal(block[15], 1)
  assert.equal(block[19], 1)
  assert.ok(Math.abs(block[20]! - 0.05) < 1e-6)
  assert.equal(block[21], 1)
  assert.equal(block[23], 0)
  assert.ok(Math.abs(block[12 * 24]! - 1 / 12) < 1e-6)
})

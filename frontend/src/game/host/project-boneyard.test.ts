import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { parseBoneyard } from '../../editor/format/boneyard.ts'
import {
  createBoneyardEnemyStore,
  type BoneyardMaggotActor,
} from '../core-server/boneyard-enemy-store.ts'
import { projectBoneyard } from './project-boneyard.ts'
import { projectBoneyardMaggots } from './project-boneyard-enemies.ts'

const storyFixture = new URL('../../../public/samples/story0.boneyard', import.meta.url)

test('projects explicit Fencepost selectors and omits the native sentinel', () => {
  const document = parseBoneyard(readFileSync(storyFixture))
  assert.ok(document.fences[0])
  document.fences[0] = {
    ...document.fences[0],
    startPostVariant: 4,
    endPostVariant: 0xffffffff,
  }

  const projected = projectBoneyard(document).fences[0]
  assert.equal(projected.startPostVariant, 4)
  assert.equal('endPostVariant' in projected, false)
})

test('projects Maggot damage age as the authoritative five-tick hit flash', () => {
  const maggot: BoneyardMaggotActor = {
    collisionRadius: 8,
    currentHealth: 1,
    damage: 2,
    deathEpoch: null,
    deathStartedTick: null,
    deathTick: 0,
    gaitPose: 0,
    headingDeg: 90,
    id: 1,
    lastAttackTick: null,
    lastDamagedByPlayerId: 'player',
    lastDamageTick: 10,
    lastMovementTick: null,
    lifeState: 'alive',
    maximumHealth: 2,
    nextAttackTick: 20,
    nextMovementTick: 12,
    ownerCoffinActorId: 2,
    poisonDamage: 0,
    poisonDuration: 0,
    position: { x: 100, y: 200 },
    spawnTick: 0,
    targetPlayerId: 'player',
    terminalEmitted: false,
  }
  const store = {
    ...createBoneyardEnemyStore('maggot-hit-flash'),
    maggots: [maggot],
  }

  assert.equal(projectBoneyardMaggots(store, 10)[0]?.hitFlash, 1)
  assert.equal(projectBoneyardMaggots(store, 12)[0]?.hitFlash, 0.6)
  assert.equal(projectBoneyardMaggots(store, 15)[0]?.hitFlash, 0)
  assert.equal(projectBoneyardMaggots({
    ...store,
    maggots: [{ ...maggot, lastDamageTick: null }],
  }, 10)[0]?.hitFlash, 0)
})

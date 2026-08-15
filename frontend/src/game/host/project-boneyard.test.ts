import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { parseBoneyard } from '../../editor/format/boneyard.ts'
import {
  BOUNDED_MAGGOT_PROGRAM,
  createBoneyardEnemyStore,
  NATIVE_MAGE_ACTION_PROGRAMS,
  stepBoneyardEnemyStore,
  type BoneyardMaggotActor,
} from '../core-server/boneyard-enemy-store.ts'
import { BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS } from '../core-kernels/boneyard-enemy-modifiers.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import { projectBoneyard } from './project-boneyard.ts'
import {
  projectBoneyardEnemies,
  projectBoneyardMaggots,
} from './project-boneyard-enemies.ts'

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
    emergenceTick: 24,
    gaitPose: 0,
    headingDeg: 90,
    id: 1,
    launchTrajectory: 'lid',
    launchVelocity: { x: 0, y: 0 },
    lastAttackTick: null,
    lastDamagedByPlayerId: 'player',
    lastDamageTick: 10,
    lastMovementTick: null,
    lifeState: 'alive',
    maximumHealth: 2,
    movementPhase: 'crawl',
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

test('projects Maggot emergence trajectory and vertical launch height', () => {
  const source = projectedMaggot({
    emergenceTick: 12,
    launchTrajectory: 'lid',
    movementPhase: 'emerging',
  })

  assert.equal(source.emergenceTick, 12)
  assert.equal(source.launchTrajectory, 'lid')
  assert.equal(source.state, 'emerging')
  assert.equal(source.verticalOffset, -20)
})

test('projects a production Maggot bite before death at every default snapshot phase', () => {
  for (let onsetPhase = 0; onsetPhase < 5; onsetPhase += 1) {
    const attackTick = 100 + onsetPhase
    const states: string[] = []
    for (
      let snapshotTick = Math.ceil(attackTick / 5) * 5;
      snapshotTick < attackTick + BOUNDED_MAGGOT_PROGRAM.deathTicks;
      snapshotTick += 5
    ) {
      states.push(projectedMaggot({
        deathEpoch: 1,
        deathStartedTick: attackTick,
        deathTick: snapshotTick - attackTick,
        lastAttackTick: attackTick,
        lifeState: 'dying',
      }, snapshotTick).state)
    }
    assert.ok(states.includes('bite'), `phase ${onsetPhase} skipped bite: ${states}`)
    assert.ok(states.includes('death'), `phase ${onsetPhase} skipped death: ${states}`)
  }

  assert.equal(projectedMaggot({
    deathEpoch: 1,
    deathStartedTick: 100,
    lastAttackTick: 100,
    lifeState: 'dying',
  }, 100 + BOUNDED_MAGGOT_PROGRAM.bitePresentationTicks - 1).state, 'bite')
  assert.equal(projectedMaggot({
    deathEpoch: 1,
    deathStartedTick: 100,
    lastAttackTick: 100,
    lifeState: 'dying',
  }, 100 + BOUNDED_MAGGOT_PROGRAM.bitePresentationTicks).state, 'death')
})

test('projects armor, shields, burning, and the named four-tick lightning sample', () => {
  const players = {
    player: {
      alive: true,
      collisionRadius: 25,
      connected: true,
      eligible: true,
      position: { x: 150, y: 0 },
      velocityPerTick: { x: 0, y: 0 },
    },
  } as const
  const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore('projection-modifiers'), {
    firstProjectileWorldContact: () => null,
    players,
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'SKELETONMAGE',
      flags: ['FLAG_BURNING', 'FLAG_CASTLIGHTNING'],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETONMAGE,
      position: { x: 0, y: 0 },
      spawnTick: 0,
      waveOrdinal: 1,
    }, {
      enemyToken: 'SKELETON',
      flags: ['FLAG_ARMOR'],
      id: 2,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x: 300, y: 0 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  const actor = spawned.store.actors[0]!
  const brain = actor.brain
  assert.equal(brain.family, 'mage')
  if (brain.family !== 'mage') throw new Error('expected Mage brain')
  const startedTick = 10
  const attacked = stepBoneyardEnemyStore({
    ...spawned.store,
    actors: [{
      ...actor,
      brain: {
        ...brain,
        actionProgress: NATIVE_MAGE_ACTION_PROGRAMS.short.markerProgress,
        castProgram: 'short',
        castRoll: 0,
        markerEmitted: false,
        phase: 'cast',
      },
    }, spawned.store.actors[1]!],
  }, {
    firstProjectileWorldContact: () => null,
    players,
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [],
    tick: startedTick,
  })
  assert.equal(attacked.playerDamage[0]?.amount, 12)
  const store = {
    ...attacked.store,
    actors: [{
      ...attacked.store.actors[0]!,
      shieldHealth: 25,
      shieldMaximumHealth: 50,
    }, attacked.store.actors[1]!],
  }

  const projected = projectBoneyardEnemies(store, startedTick)
  const created = projected[0]!
  assert.equal(projected[1]?.armored, true)
  assert.equal(created.shieldHealth, 25)
  assert.equal(created.shieldMaximumHealth, 50)
  assert.deepEqual(created.animation.effects.map(({ alpha, role }) => ({ alpha, role })), [
    { alpha: 1, role: 'burning-fire' },
    { alpha: 1, role: 'mage-lightning-source' },
    { alpha: 1, role: 'mage-lightning-target' },
  ])
  assert.deepEqual(created.animation.effects[2]?.offset, { x: 150, y: 0 })

  const retained = projectBoneyardEnemies(
    store,
    startedTick + BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS - 1,
  )[0]!
  assert.equal(retained.animation.effects[1]?.alpha, 0.25)
  const expired = projectBoneyardEnemies(
    store,
    startedTick + BOUNDED_MAGE_LIGHTNING_EFFECT_TICKS,
  )[0]!
  assert.deepEqual(expired.animation.effects.map(({ role }) => role), ['burning-fire'])
})

function projectedMaggot(
  overrides: Partial<BoneyardMaggotActor>,
  tick = 12,
) {
  const maggot: BoneyardMaggotActor = {
    collisionRadius: 8,
    currentHealth: 2,
    damage: 2,
    deathEpoch: null,
    deathStartedTick: null,
    deathTick: 0,
    emergenceTick: 24,
    gaitPose: 0,
    headingDeg: 90,
    id: 1,
    launchTrajectory: 'edge',
    launchVelocity: { x: 0, y: 0 },
    lastAttackTick: null,
    lastDamagedByPlayerId: null,
    lastDamageTick: null,
    lastMovementTick: null,
    lifeState: 'alive',
    maximumHealth: 2,
    movementPhase: 'crawl',
    nextAttackTick: 20,
    nextMovementTick: 12,
    ownerCoffinActorId: 2,
    poisonDamage: 0,
    poisonDuration: 0,
    position: { x: 100, y: 200 },
    spawnTick: 0,
    targetPlayerId: 'player',
    terminalEmitted: false,
    ...overrides,
  }
  return projectBoneyardMaggots({
    ...createBoneyardEnemyStore('maggot-emergence'),
    maggots: [maggot],
  }, tick)[0]!
}

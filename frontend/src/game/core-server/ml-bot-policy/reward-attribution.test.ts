import assert from 'node:assert/strict'
import test from 'node:test'

import {
  damageBoneyardEnemy,
  type BoneyardEnemyActor,
  type BoneyardEnemyStore,
} from '../boneyard-enemy-store.ts'
import { createGameSimulation } from '../game-simulation.ts'
import { MlBotPolicyRewardAccumulator } from './reward.ts'

test('enemy damage observer reports source-attributed health damage and clamps overkill', () => {
  const events = []
  const first = damageBoneyardEnemy(store(50), {
    actorId: 7,
    amount: 20,
    attributionObserver: {
      onEnemyHealthDamage: event => events.push(event),
      onEnemyKillExperience: () => {},
    },
    sourcePlayerId: 'agent',
    suppressHurtSound: true,
    tick: 1,
  })
  assert.equal(first.healthDamage, 20)
  assert.deepEqual(events, [{
    actorId: 7,
    amount: 20,
    maximumHealth: 100,
    playerId: 'agent',
  }])
  const killed = damageBoneyardEnemy(store(10), {
    actorId: 7,
    amount: 999,
    attributionObserver: {
      onEnemyHealthDamage: event => events.push(event),
      onEnemyKillExperience: () => {},
    },
    sourcePlayerId: 'agent',
    suppressHurtSound: true,
    tick: 1,
  })
  assert.equal(killed.healthDamage, 10)
  assert.equal(events.at(-1)?.amount, 10)
})

test('frozen reward formula is zero when state and attributed counters do not change', () => {
  const state = createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  })
  const accumulator = new MlBotPolicyRewardAccumulator('agent')
  accumulator.begin(state)
  assert.deepEqual(accumulator.finish(state, false), {
    clamped: false,
    gameplay: {
      enemyKills: 0,
      enemyKillsByKind: {},
      goldCollected: 0,
      healthOrbsCollected: 0,
      itemKinds: {},
      itemsCollected: 0,
      manaOrbsCollected: 0,
      potionsUsed: 0,
      powerupsCollected: 0,
      skillPicks: 0,
      wavesCompleted: 0,
    },
    raw: 0,
    reward: 0,
    terms: { death: 0, ownDamage: 0, selfHp: 0, wave: 0, xp: 0 },
  })
})

test('frozen reward formula attributes only the owning player and clamps last', () => {
  const state = createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  })
  const accumulator = new MlBotPolicyRewardAccumulator('agent')
  accumulator.begin(state)
  const observer = accumulator.attributionObserver()
  observer.onEnemyHealthDamage({ actorId: 1, amount: 20, maximumHealth: 100, playerId: 'ally' })
  observer.onEnemyHealthDamage({ actorId: 1, amount: 20, maximumHealth: 100, playerId: 'agent' })
  observer.onEnemyKillExperience({
    actorId: 1,
    amount: 4,
    enemyToken: 'SKELETON',
    playerId: 'agent',
  })
  observer.onLootPickup?.({
    amount: 12,
    bonusKind: null,
    itemKind: null,
    itemName: null,
    itemQuantity: null,
    kind: 'gold',
    orbKind: null,
    playerId: 'agent',
  })
  observer.onLootPickup?.({
    amount: 1,
    bonusKind: null,
    itemKind: 'equipment',
    itemName: 'Test Robe',
    itemQuantity: 2,
    kind: 'sack',
    orbKind: null,
    playerId: 'agent',
  })
  observer.onLootPickup?.({
    amount: 1,
    bonusKind: null,
    itemKind: null,
    itemName: null,
    itemQuantity: null,
    kind: 'orb',
    orbKind: 'mana',
    playerId: 'agent',
  })
  observer.onLootPickup?.({
    amount: 1,
    bonusKind: 0,
    itemKind: null,
    itemName: null,
    itemQuantity: null,
    kind: 'bonus',
    orbKind: null,
    playerId: 'agent',
  })
  const result = accumulator.finish(state, false)
  assert.equal(result.terms.ownDamage, 0.13)
  assert.equal(result.terms.xp, 0.16)
  assert.equal(result.gameplay.enemyKills, 1)
  assert.deepEqual(result.gameplay.enemyKillsByKind, { SKELETON: 1 })
  assert.equal(result.gameplay.goldCollected, 12)
  assert.equal(result.gameplay.itemsCollected, 2)
  assert.deepEqual(result.gameplay.itemKinds, { equipment: 2 })
  assert.equal(result.gameplay.manaOrbsCollected, 1)
  assert.equal(result.gameplay.powerupsCollected, 1)
  assert.ok(Math.abs(result.reward - 0.29) < 1e-12)
  assert.equal(result.clamped, false)
})

function store(health: number): BoneyardEnemyStore {
  const actor = {
    bodyPose: 0,
    brain: {
      action: 'weapon',
      actionProgress: 0,
      contactTargetPlayerId: null,
      family: 'skeleton',
      markerEmitted: false,
      phase: 'approach',
    },
    config: {
      attackSpeed: 1,
      baseSpeed: 1,
      burning: false,
      chaseSpeed: 1,
      collisionRadius: 20,
      enemyToken: 'SKELETON',
      experience: 4,
      extraDamage: 0,
      family: { armor: false, headgear: 0, weapon: 'sword' },
      flags: [],
      ignoredSourceFlags: [],
      maximumHealth: 100,
      nativeTypeId: 1001,
      primaryDamage: 1,
      scale: 1,
      secondaryDamage: 1,
      skeletonPolicy: 'default',
      tertiaryDamage: 1,
    },
    currentHealth: health,
    deathEpoch: null,
    deathStartedTick: null,
    deathTick: 0,
    gaitPose: 0,
    headFacingOffset: 0,
    headingDeg: 0,
    blizzardPushAccumulator: 0,
    blizzardPushLastTick: null,
    hurricaneContactCooldown: 0,
    id: 7,
    lastDamagedByPlayerId: null,
    lastDamageTick: null,
    lastMovementTick: null,
    lifeState: 'alive',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 0 },
    lighting: { charge: 0, glow: 0, providerCopies: 0 },
    lootSeed: 1,
    nextMovementTick: 0,
    nextTargetRefreshTick: 0,
    position: { x: 100, y: 100 },
    rewardGranted: false,
    shieldHealth: 0,
    shieldMaximumHealth: 0,
    shieldPulse: 0,
    shieldSoundCooldownTicks: 0,
    sourceSpawnIntentId: 1,
    spawnTick: 0,
    staffActionFactor: 1,
    staffMovementFactor: 1,
    targetPlayerId: null,
    terminalEmitted: false,
    waveOrdinal: 1,
  } as BoneyardEnemyActor
  return {
    actors: [actor],
    deathEffects: [],
    headFacingRngState: { words: [1, 2, 3, 4] },
    lastStepTick: 0,
    mageLightningPulses: [],
    maggots: [],
    nextActorId: 8,
    nextDeathEpoch: 1,
    nextDeathEffectId: 1,
    nextEventId: 1,
    nextMageLightningPulseId: 1,
    nextProjectileEffectId: 1,
    nextProjectileId: 1,
    nextSyntheticSpawnIntentId: 1,
    projectileEffects: [],
    projectiles: [],
    rngState: 1,
  } as unknown as BoneyardEnemyStore
}

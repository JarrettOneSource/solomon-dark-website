import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { BONEYARD_GAME_OVER_INPUT_GATE_TICKS } from '../core-kernels/game-run.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import { playerCollisionEnabled } from '../core-kernels/player-combat.ts'
import {
  acknowledgeGameSimulationOver,
  addPlayerCharacter,
  BONEYARD_ENEMY_EVENT_LANE_CAPACITY,
  confirmGameSimulationLoadout,
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerCharacter,
  getPlayerProgression,
  grantGameSimulationPlayerExperience,
  removePlayerCharacter,
  selectGameSimulationPlayerSkill,
  stepGameSimulation,
  stepGameSimulationTick,
  type GameSimulationState,
} from './game-simulation.ts'
import {
  damageBoneyardEnemy,
  stepBoneyardEnemyStore,
  type BoneyardEnemySemanticEvent,
} from './boneyard-enemy-store.ts'
import {
  damagePlayerEntity,
  dazzlePlayerEntity,
  playerCharacterRecords,
  poisonPlayerEntity,
  replacePlayerCharacterRecords,
} from './player-entity-store.ts'

function gameplayInput(x: number, y: number) {
  return {
    aim: null,
    cast: { primary: false, secondary: false },
    movement: { x, y },
  }
}

test('game simulation owns player characters outside the active world', () => {
  const firstConfig = {
    discipline: 'arcane',
    displayName: 'Helvidius',
    element: 'ether',
  } as const
  const secondConfig = {
    discipline: 'mind',
    displayName: 'Vibia',
    element: 'water',
  } as const
  let state = createGameSimulation({ first: firstConfig })
  assert.equal(state.accumulatorSeconds, 0)
  assert.equal(state.world.kind, 'hub')
  assert.equal('players' in state.world, false)
  assert.deepEqual(Object.keys(state.world.participants), ['first'])

  state = addPlayerCharacter(state, 'second', secondConfig)
  state = stepGameSimulationTick(state, {
    first: gameplayInput(1, 0),
    second: gameplayInput(0, 1),
  })
  assert.equal(state.tick, 1)
  assert.equal(state.accumulatorSeconds, 0)
  if (state.world.kind !== 'hub') throw new Error('expected Hub world')
  assert.equal('players' in state, false)
  assert.deepEqual(getPlayerCharacter(state, 'first').config, firstConfig)
  assert.deepEqual(getPlayerCharacter(state, 'second').config, secondConfig)
  assert.deepEqual(Object.keys(state.world.participants).sort(), ['first', 'second'])
  assert.ok(getPlayerCharacter(state, 'first').position.x > getPlayerCharacter(state, 'second').position.x)
  assert.ok(getPlayerCharacter(state, 'second').position.y > getPlayerCharacter(state, 'first').position.y)

  state = removePlayerCharacter(state, 'first')
  if (state.world.kind !== 'hub') throw new Error('expected Hub world')
  assert.throws(() => getPlayerCharacter(state, 'first'), /no player character/)
  assert.deepEqual(getPlayerCharacter(state, 'second').config, secondConfig)
  assert.deepEqual(Object.keys(state.world.participants), ['second'])
})

test('game simulation owns fixed-step accumulation independently of its world', () => {
  let state = createGameSimulation()
  state = stepGameSimulation(state, {}, 0.005)
  assert.equal(state.tick, 0)
  assert.equal(state.accumulatorSeconds, 0.005)
  state = stepGameSimulation(state, {}, 0.005)
  assert.equal(state.tick, 1)
  assert.equal(state.accumulatorSeconds, 0)
})

test('a shared level milestone freezes every gameplay clock until the fixed cohort chooses', () => {
  const first = {
    discipline: 'arcane',
    displayName: 'First',
    element: 'ether',
  } as const
  const second = {
    discipline: 'mind',
    displayName: 'Second',
    element: 'water',
  } as const
  let state = createGameSimulation({ first, second })
  state = grantGameSimulationPlayerExperience(state, 'first', 89)

  const progressions = [...state.playerEntities.progressions]
  progressions[0] = { ...progressions[0]!, currentHealth: 10, currentMana: 20 }
  progressions[1] = { ...progressions[1]!, currentHealth: 30, currentMana: 40 }
  state = {
    ...state,
    playerEntities: { ...state.playerEntities, progressions: Object.freeze(progressions) },
  }
  state = grantGameSimulationPlayerExperience(state, 'first', 2)

  assert.deepEqual(state.levelUpBarrier, {
    barrierId: 1,
    milestoneExperience: 91,
    milestoneLevel: 2,
    participantIds: ['first', 'second'],
    pendingPlayerIds: ['first', 'second'],
    runId: null,
    sourcePlayerId: 'first',
  })
  assert.equal(getPlayerProgression(state, 'first').currentHealth, 50)
  assert.equal(getPlayerProgression(state, 'first').currentMana, 100)
  assert.equal(getPlayerProgression(state, 'second').currentHealth, 30)
  assert.equal(getPlayerProgression(state, 'second').currentMana, 40)
  assert.equal(getPlayerProgression(state, 'second').experience, 91)
  assert.equal(getPlayerProgression(state, 'second').level, 2)
  assert.ok(getPlayerProgression(state, 'first').pendingOffer)
  assert.ok(getPlayerProgression(state, 'second').pendingOffer)

  const frozenPlayer = getPlayerCharacter(state, 'first')
  const frozenWorld = state.world
  const frozenTick = state.tick
  state = stepGameSimulation(state, {
    first: gameplayInput(1, 0),
    second: gameplayInput(0, 1),
  }, 0.05)
  assert.equal(state.tick, frozenTick)
  assert.equal(state.world, frozenWorld)
  assert.deepEqual(getPlayerCharacter(state, 'first'), frozenPlayer)

  const firstOffer = getPlayerProgression(state, 'first').pendingOffer!
  const firstChoice = firstOffer.options[0]!
  state = selectGameSimulationPlayerSkill(state, 'first', {
    choiceIndex: 0,
    offerSequence: firstOffer.sequence,
    skillId: firstChoice.skillId,
  })!
  assert.deepEqual(state.levelUpBarrier?.pendingPlayerIds, ['second'])
  assert.equal(getPlayerProgression(state, 'first').pendingOffer, null)
  assert.ok(getPlayerProgression(state, 'second').pendingOffer)
  assert.equal(stepGameSimulationTick(state, {}).tick, frozenTick)

  const secondOffer = getPlayerProgression(state, 'second').pendingOffer!
  const secondChoice = secondOffer.options[0]!
  state = selectGameSimulationPlayerSkill(state, 'second', {
    choiceIndex: 0,
    offerSequence: secondOffer.sequence,
    skillId: secondChoice.skillId,
  })!
  assert.equal(state.levelUpBarrier, null)
  assert.equal(stepGameSimulationTick(state, {}).tick, frozenTick + 1)
})

test('shared picker cohort excludes late joiners and releases disconnected waiters', () => {
  const first = {
    discipline: 'arcane',
    displayName: 'First',
    element: 'ether',
  } as const
  const second = {
    discipline: 'mind',
    displayName: 'Second',
    element: 'water',
  } as const
  const late = {
    discipline: 'body',
    displayName: 'Late',
    element: 'fire',
  } as const
  let state = createGameSimulation({ first, second })
  state = grantGameSimulationPlayerExperience(state, 'first', 91)
  state = addPlayerCharacter(state, 'late', late)
  assert.deepEqual(state.levelUpBarrier?.participantIds, ['first', 'second'])
  assert.deepEqual(state.levelUpBarrier?.pendingPlayerIds, ['first', 'second'])
  assert.equal(getPlayerProgression(state, 'late').pendingOffer, null)

  const firstOffer = getPlayerProgression(state, 'first').pendingOffer!
  state = selectGameSimulationPlayerSkill(state, 'first', {
    choiceIndex: 0,
    offerSequence: firstOffer.sequence,
    skillId: firstOffer.options[0]!.skillId,
  })!
  state = removePlayerCharacter(state, 'second')
  assert.equal(state.levelUpBarrier, null)
})

test('the authoritative tick latches footsteps only while native movement is active', () => {
  let state = createGameSimulation()
  for (let tick = 1; tick <= 100; tick += 1) {
    state = stepGameSimulationTick(state, {
      'local-player': gameplayInput(1, 0),
    })
    if (tick % 25 === 0) {
      assert.equal(getPlayerCharacter(state).footstepTick, tick)
    }
  }

  for (let tick = 101; tick <= 200; tick += 1) {
    state = stepGameSimulationTick(state, {
      'local-player': gameplayInput(0, 0),
    })
  }

  assert.equal(getPlayerCharacter(state).footstepTick, 100)
})

test('Boneyard movement consumes the first fractional Dazzle ramp sample', () => {
  const initial = enterBoneyardWorld(createGameSimulation(), emptyBoneyard())
  const initialX = getPlayerCharacter(initial).position.x
  const normal = stepGameSimulationTick(initial, {
    'local-player': gameplayInput(1, 0),
  })
  const dazzled = stepGameSimulationTick({
    ...initial,
    playerEntities: dazzlePlayerEntity(
      initial.playerEntities,
      'local-player',
      50,
    ),
  }, {
    'local-player': gameplayInput(1, 0),
  })

  assert.ok(getPlayerCharacter(normal).position.x > initialX)
  assert.equal(getPlayerCharacter(dazzled).position.x, initialX)
  assert.equal(getPlayerProgression(dazzled).dazzleTicksRemaining, 49)
})

test('disconnect and world replacement clean spell actors and cast ownership', () => {
  const earth = {
    discipline: 'arcane',
    displayName: 'Earth Caster',
    element: 'earth',
  } as const
  let state = createGameSimulation({ caster: earth })
  const cast = (primary: boolean) => ({
    aim: {
      x: getPlayerCharacter(state, 'caster').position.x,
      y: getPlayerCharacter(state, 'caster').position.y - 200,
    },
    cast: { primary, secondary: false },
    movement: { x: 0, y: 0 },
  })
  state = stepGameSimulationTick(state, { caster: cast(true) })
  assert.equal(state.primarySpells.projectiles.length, 1)
  assert.equal(getPlayerCharacter(state, 'caster').primaryCast.channelActive, true)
  state = removePlayerCharacter(state, 'caster')
  assert.deepEqual(state.primarySpells.projectiles, [])

  state = createGameSimulation({ caster: { ...earth, element: 'fire' } })
  for (let tick = 0; tick < 20; tick += 1) {
    state = stepGameSimulationTick(state, { caster: cast(true) })
  }
  assert.equal(state.primarySpells.projectiles.length, 1)
  state = enterBoneyardWorld(state, emptyBoneyard())
  assert.deepEqual(state.primarySpells, { nextId: 1, projectiles: [], transients: [] })
  assert.equal(getPlayerCharacter(state, 'caster').primaryCast.actionTick, -1)
  assert.equal(getPlayerCharacter(state, 'caster').primaryCast.channelActive, false)
})

test('Boneyard Air falls back to a Gravestone and publishes the native curved segment', () => {
  let state = createGameSimulation({ caster: {
    discipline: 'arcane',
    displayName: 'Air Caster',
    element: 'air',
  } })
  const loaded = emptyBoneyard()
  loaded.scene.objects = [{
    eid: 'grave-target',
    overlayVariant: 8,
    pos: { x: 250, y: 100 },
    secondaryVariant: 0,
    secondaryVisible: false,
    typeId: 2029,
    variant: 0,
  }]
  state = enterBoneyardWorld(state, loaded)
  const player = getPlayerCharacter(state, 'caster')
  state = stepGameSimulationTick(state, { caster: {
    aim: { x: 250, y: 50 },
    cast: { primary: true, secondary: false },
    movement: { x: 0, y: 0 },
  } })

  const bolt = state.primarySpells.transients[0]
  assert.equal(bolt.kind, 'air')
  assert.equal(bolt.targetId, 'scenery:grave-target')
  assert.equal(getPlayerCharacter(state, 'caster').primaryCast.targetId, bolt.targetId)
  assert.deepEqual(bolt.endpoint, { x: 250, y: 80 })
  assert.equal(bolt.midpoint.x, bolt.origin.x)
  assert.notDeepEqual(bolt.midpoint, {
    x: (bolt.origin.x + bolt.endpoint.x) / 2,
    y: (bolt.origin.y + bolt.endpoint.y) / 2,
  })
  assert.deepEqual(player.position, getPlayerCharacter(state, 'caster').position)
})

test('simulation wires effective primary rank into debit and captured projectile damage', () => {
  const fire = {
    discipline: 'arcane',
    displayName: 'Fire Caster',
    element: 'fire',
  } as const
  let rankOne = createGameSimulation({ caster: fire })
  let rankTwo = withEffectivePrimaryRank(createGameSimulation({ caster: fire }), 'caster', 2)
  const cast = (state: GameSimulationState, primary: boolean) => {
    const player = getPlayerCharacter(state, 'caster')
    return {
      aim: { x: player.position.x, y: player.position.y - 200 },
      cast: { primary, secondary: false },
      movement: { x: 0, y: 0 },
    }
  }

  rankOne = stepGameSimulationTick(rankOne, { caster: cast(rankOne, true) })
  rankTwo = stepGameSimulationTick(rankTwo, { caster: cast(rankTwo, true) })
  assert.ok(Math.abs(
    getPlayerProgression(rankOne, 'caster').currentMana
      - getPlayerProgression(rankTwo, 'caster').currentMana
      - 3,
  ) < 1e-12)

  for (let tick = 0; tick < 19; tick += 1) {
    rankOne = stepGameSimulationTick(rankOne, { caster: cast(rankOne, true) })
    rankTwo = stepGameSimulationTick(rankTwo, { caster: cast(rankTwo, true) })
  }
  assert.equal(rankOne.primarySpells.projectiles[0]!.damage, 4)
  assert.equal(rankTwo.primarySpells.projectiles[0]!.damage, 7)

  rankOne = withEffectivePrimaryRank(rankOne, 'caster', 2)
  rankOne = stepGameSimulationTick(rankOne, { caster: cast(rankOne, false) })
  assert.equal(rankOne.primarySpells.projectiles[0]!.damage, 4)
})

test('Boneyard simulation debits mana, applies spell contact, and begins enemy death', () => {
  const fire = {
    discipline: 'arcane',
    displayName: 'Fire Caster',
    element: 'fire',
  } as const
  let state = enterBoneyardWorld(
    createGameSimulation({ caster: fire }),
    combatBoneyard('spell-combat-run'),
  )
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    arenaScalars: { experience: 0.425 },
    firstProjectileWorldContact: () => null,
    players: {
      caster: {
        alive: true,
        collisionRadius: 25,
        connected: true,
        eligible: true,
        position: getPlayerCharacter(state, 'caster').position,
        velocityPerTick: { x: 0, y: 0 },
      },
    },
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'SKELETON',
      flags: ['FLAG_HPDOWN'],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x: 250, y: 140 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  state = { ...state, world: { ...state.world, enemies: seeded.store } }

  const cast = (primary: boolean) => ({
    aim: { x: 250, y: 0 },
    cast: { primary, secondary: false },
    movement: { x: 0, y: 0 },
  })
  state = stepGameSimulationTick(state, { caster: cast(true) })
  assert.ok(getPlayerProgression(state, 'caster').currentMana < 89)
  for (let tick = 0; tick < 30; tick += 1) {
    state = stepGameSimulationTick(state, { caster: cast(true) })
    if (
      state.world.kind === 'boneyard'
      && state.world.enemies.actors[0]?.lifeState === 'dying'
    ) break
  }

  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const enemy = state.world.enemies.actors[0]
  assert.ok(enemy)
  assert.equal(enemy.lifeState, 'dying')
  assert.ok(enemy.currentHealth <= 0)
  assert.equal(enemy.lastDamagedByPlayerId, 'caster')
  assert.ok(enemy.lastDamageTick !== null)
  assert.deepEqual(state.primarySpells.projectiles, [])

  const experienceBeforeReward = getPlayerProgression(state, 'caster').experience
  state = stepGameSimulationTick(state, { caster: cast(false) })
  assert.equal(
    getPlayerProgression(state, 'caster').experience - experienceBeforeReward,
    4.25,
  )
})

test('Boneyard Fire uses kernel terrain lookahead then post-move point contact', () => {
  const loaded = combatBoneyard('spell-ordering-run')
  loaded.scene.fences = [{
    eid: 'ordering-wall',
    points: [{ x: 130, y: 0 }, { x: 130, y: 500 }],
    segmentCode: 0,
    typeId: 3005,
  }]
  let state = enterBoneyardWorld(createGameSimulation({ caster: {
    discipline: 'arcane',
    displayName: 'Fire Caster',
    element: 'fire',
  } }), loaded)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    firstProjectileWorldContact: () => null,
    players: {},
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'SKELETON',
      flags: ['FLAG_HPDOWN'],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x: 80, y: 250 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  const initialEnemyHealth = seeded.store.actors[0]!.currentHealth
  state = {
    ...state,
    primarySpells: {
      nextId: 2,
      projectiles: [{
        ageTicks: 5,
        charge: 1,
        damage: 4,
        direction: { x: 1, y: 0 },
        flightTicks: 5,
        id: 1,
        kind: 'fire',
        ownerId: 'caster',
        phase: 'flight',
        position: { x: 50, y: 250 },
        velocity: { x: 4.5, y: 0 },
        worldKey: `boneyard:${loaded.runId}`,
      }],
      transients: [],
    },
    world: { ...state.world, enemies: seeded.store },
  }

  state = stepGameSimulationTick(state, { caster: gameplayInput(0, 0) })

  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  assert.equal(state.world.enemies.actors[0]!.currentHealth, initialEnemyHealth - 4)
  assert.deepEqual(state.primarySpells.projectiles, [])
  assert.equal(
    state.primarySpells.transients.filter(({ kind }) => kind === 'fire-impact').length,
    1,
  )
})

test('Boneyard semantic events survive the slowest snapshot cadence and remain bounded', () => {
  let state = enterBoneyardWorld(
    createGameSimulation(),
    combatBoneyard('semantic-event-run'),
  )
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const player = getPlayerCharacter(state)
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    firstProjectileWorldContact: () => null,
    players: {
      'local-player': {
        alive: true,
        collisionRadius: 25,
        connected: true,
        eligible: true,
        position: player.position,
        velocityPerTick: { x: 0, y: 0 },
      },
    },
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'SKELETON',
      flags: [],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x: player.position.x + 200, y: player.position.y },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  const killed = damageBoneyardEnemy(seeded.store, {
    actorId: seeded.store.actors[0]!.id,
    amount: 1_000,
    sourcePlayerId: 'local-player',
    tick: 0,
  })
  state = { ...state, world: { ...state.world, enemies: killed.store } }

  state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const firstBatch = state.world.enemyEvents
  assert.deepEqual(firstBatch.map(({ eventId, type }) => ({ eventId, type })), [
    { eventId: 2, type: 'enemy-death' },
    { eventId: 3, type: 'enemy-terminal-output' },
    { eventId: 4, type: 'enemy-death-sound' },
    { eventId: 5, type: 'reward' },
    { eventId: 6, type: 'enemy-retired' },
  ])

  for (let tick = 0; tick < 99; tick += 1) state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  assert.ok(firstBatch.every(({ eventId }) => (
    state.world.kind === 'boneyard'
    && state.world.enemyEvents.some((event) => event.eventId === eventId)
  )))

  const overflow: BoneyardEnemySemanticEvent[] = Array.from(
    { length: BONEYARD_ENEMY_EVENT_LANE_CAPACITY + 1 },
    (_, index) => ({
      actorId: 1,
      eventId: index + 1,
      tick: state.tick,
      type: 'enemy-death',
    }),
  )
  state = { ...state, world: { ...state.world, enemyEvents: overflow } }
  state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  assert.equal(state.world.enemyEvents.length, BONEYARD_ENEMY_EVENT_LANE_CAPACITY)
  assert.equal(state.world.enemyEvents[0]!.eventId, 2)
})

test('Rotten Zombie contact applies direct damage and authoritative poison over time', () => {
  let state = enterBoneyardWorld(
    createGameSimulation(),
    combatBoneyard('poison-combat-run'),
  )
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const player = getPlayerCharacter(state)
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    firstProjectileWorldContact: () => null,
    players: {
      'local-player': {
        alive: true,
        collisionRadius: 25,
        connected: true,
        eligible: true,
        position: player.position,
        velocityPerTick: { x: 0, y: 0 },
      },
    },
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'ZOMBIE',
      flags: ['FLAG_ROTTEN'],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.ZOMBIE,
      position: { ...player.position },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  state = { ...state, world: { ...state.world, enemies: seeded.store } }

  for (let tick = 0; tick < 10; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (getPlayerProgression(state).poisonTicksRemaining > 0) break
  }

  const progression = getPlayerProgression(state)
  assert.ok(progression.currentHealth > 14 && progression.currentHealth < 15)
  assert.equal(progression.poisonDamagePerTick, 35 / 6 / 100)
  assert.equal(progression.poisonTicksRemaining, 999)
  const healthAfterContact = progression.currentHealth
  state = stepGameSimulationTick(state, {})
  assert.ok(getPlayerProgression(state).currentHealth < healthAfterContact)
  assert.equal(getPlayerProgression(state).poisonTicksRemaining, 998)
})

test('poison begins the native death epoch before all-dead Game Over', () => {
  let state = enterBoneyardWorld(
    createGameSimulation(),
    combatBoneyard('poison-lethal-run'),
  )
  state = {
    ...state,
    playerEntities: poisonPlayerEntity(
      damagePlayerEntity(state.playerEntities, 'local-player', 59.99),
      'local-player',
      2,
      1,
    ),
  }

  state = stepGameSimulationTick(state, {})
  assert.equal(getPlayerProgression(state).lifeState, 'lethal-pending')
  assert.equal(getPlayerProgression(state).deathEpoch, 0)
  assert.equal(state.run.phase, 'active')

  state = stepGameSimulationTick(state, {})
  assert.equal(getPlayerProgression(state).lifeState, 'dying')
  assert.equal(getPlayerProgression(state).deathEpoch, 1)
  assert.equal(state.run.phase, 'game-over')
})

test('the published tick-159 death frame leaves collision before Boneyard motion resolves', () => {
  const corpse = {
    discipline: 'arcane',
    displayName: 'Corpse',
    element: 'ether',
  } as const
  const living = {
    discipline: 'mind',
    displayName: 'Living',
    element: 'water',
  } as const
  let state = enterBoneyardWorld(
    createGameSimulation({ corpse, living }),
    combatBoneyard('death-collision-boundary-run'),
  )
  const players = playerCharacterRecords(state.playerEntities)
  state = {
    ...state,
    playerEntities: replacePlayerCharacterRecords(state.playerEntities, {
      ...players,
      corpse: {
        ...players.corpse!,
        position: { x: 250, y: 250 },
        velocity: { x: 0, y: 0 },
      },
      living: {
        ...players.living!,
        position: { x: 199.5, y: 250 },
        velocity: { x: 100, y: 0 },
      },
    }),
  }
  const corpseIndex = state.playerEntities.identities.findIndex(({ playerId }) => (
    playerId === 'corpse'
  ))
  assert.notEqual(corpseIndex, -1)
  const progressions = [...state.playerEntities.progressions]
  progressions[corpseIndex] = {
    ...progressions[corpseIndex]!,
    currentHealth: -10,
    deathEpoch: 1,
    deathTick: 158,
    lifeState: 'dying',
  }
  state = {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      progressions: Object.freeze(progressions),
    },
  }

  state = stepGameSimulationTick(state, {})

  const publishedCorpse = getPlayerProgression(state, 'corpse')
  assert.equal(publishedCorpse.deathEpoch, 1)
  assert.equal(publishedCorpse.deathTick, 159)
  assert.equal(publishedCorpse.lifeState, 'spectating')
  assert.equal(playerCollisionEnabled(publishedCorpse), false)
  assert.deepEqual(getPlayerCharacter(state, 'corpse').position, { x: 250, y: 250 })
  assert.deepEqual(getPlayerCharacter(state, 'living').position, { x: 200.5, y: 250 })
  assert.equal(getPlayerProgression(state, 'living').lifeState, 'alive')
  assert.equal(state.run.phase, 'active')
  assert.equal(state.run.gameOverEventId, 0)
})

test('one dead player spectates until all-dead Game Over returns the session through loadout', () => {
  const first = {
    discipline: 'arcane',
    displayName: 'First',
    element: 'ether',
  } as const
  const second = {
    discipline: 'mind',
    displayName: 'Second',
    element: 'water',
  } as const
  let state = enterBoneyardWorld(
    createGameSimulation({ first, second }),
    combatBoneyard('multiplayer-death-run'),
  )
  state = {
    ...state,
    playerEntities: damagePlayerEntity(state.playerEntities, 'first', 60),
  }
  state = stepGameSimulationTick(state, {
    first: gameplayInput(-1, 0),
    second: gameplayInput(1, 0),
  })
  assert.equal(getPlayerProgression(state, 'first').lifeState, 'dying')
  assert.equal(getPlayerProgression(state, 'first').deathTick, 0)
  assert.equal(getPlayerCharacter(state, 'first').velocity.x, 0)
  assert.ok(getPlayerCharacter(state, 'second').velocity.x > 0)
  assert.equal(state.run.phase, 'active')

  for (let tick = 0; tick < 159; tick += 1) {
    state = stepGameSimulationTick(state, {})
  }
  assert.equal(getPlayerProgression(state, 'first').lifeState, 'spectating')
  assert.equal(getPlayerProgression(state, 'first').deathTick, 159)
  assert.equal(getPlayerProgression(state, 'second').lifeState, 'alive')
  assert.equal(state.run.phase, 'active')

  state = {
    ...state,
    playerEntities: damagePlayerEntity(state.playerEntities, 'second', 60),
  }
  state = stepGameSimulationTick(state, {})
  assert.equal(getPlayerProgression(state, 'second').lifeState, 'dying')
  assert.equal(state.run.phase, 'game-over')
  assert.equal(state.run.gameOverEventId, 1)
  assert.equal(state.run.gameOverTicks, 0)

  for (let tick = 0; tick < BONEYARD_GAME_OVER_INPUT_GATE_TICKS; tick += 1) {
    state = stepGameSimulationTick(state, {
      first: gameplayInput(1, 0),
      second: gameplayInput(1, 0),
    })
  }
  assert.equal(state.run.gameOverTicks, BONEYARD_GAME_OVER_INPUT_GATE_TICKS)
  const loadout = acknowledgeGameSimulationOver(
    state,
    'multiplayer-death-run',
    state.run.gameOverEventId,
  )
  assert.ok(loadout)
  assert.equal(loadout.run.phase, 'loadout')
  assert.equal(loadout.world.kind, 'hub')
  assert.deepEqual(
    Object.keys(playerCharacterRecords(loadout.playerEntities)).sort(),
    ['first', 'second'],
  )

  const hub = confirmGameSimulationLoadout(loadout)
  assert.ok(hub)
  assert.equal(hub.run.phase, 'hub')
  const secondRun = enterBoneyardWorld(hub, combatBoneyard('clean-second-run'))
  assert.equal(secondRun.run.phase, 'active')
  assert.equal(secondRun.run.nextGameOverEventId, 2)
  for (const playerId of ['first', 'second']) {
    const progression = getPlayerProgression(secondRun, playerId)
    assert.equal(progression.lifeState, 'alive')
    assert.equal(progression.currentHealth, progression.maximumHealth)
    assert.equal(progression.currentMana, progression.maximumMana)
    assert.equal(progression.deathEpoch, 0)
    assert.equal(progression.deathTick, 0)
  }
})

function emptyBoneyard(): LoadedBoneyard {
  return {
    choice: { id: 'empty', name: 'Empty', source: 'default' },
    geometrySha256: 'b'.repeat(64),
    runId: 'spell-cleanup-run',
    scene: {
      bounds: { x: 0, y: 0, w: 500, h: 500 },
      environmentMode: 2,
      fences: [],
      name: 'Spell cleanup fixture',
      objects: [],
      roads: [],
      solomonDig: null,
      spawn: { facingDeg: 180, x: 250, y: 250 },
      sprites: [],
      terrain: [],
    },
    seed: 'spell-cleanup-seed',
    sourceSha256: 'a'.repeat(64),
  }
}

function combatBoneyard(runId: string): LoadedBoneyard {
  return {
    choice: {
      id: 'mod:combat-fixture',
      modId: 'combat-fixture',
      modName: 'Combat Fixture',
      name: 'Combat Fixture',
      source: 'mod',
    },
    geometrySha256: 'd'.repeat(64),
    runId,
    scene: {
      bounds: { x: 0, y: 0, w: 500, h: 500 },
      environmentMode: 2,
      fences: [],
      name: 'Combat fixture',
      objects: [],
      roads: [],
      solomonDig: null,
      spawn: { facingDeg: 180, x: 250, y: 250 },
      sprites: [],
      terrain: [],
    },
    seed: `${runId}-seed`,
    sourceSha256: 'c'.repeat(64),
  }
}

function withEffectivePrimaryRank(
  state: GameSimulationState,
  playerId: string,
  rank: number,
): GameSimulationState {
  const index = state.playerEntities.identities.findIndex((identity) => (
    identity.playerId === playerId
  ))
  if (index < 0) throw new Error(`missing player ${playerId}`)
  const skillBook = state.playerEntities.skillBooks[index]!
  const effectiveRanks = [...skillBook.effectiveRanks]
  effectiveRanks[skillBook.primarySkillId] = rank
  const skillBooks = [...state.playerEntities.skillBooks]
  skillBooks[index] = {
    ...skillBook,
    effectiveRanks: Object.freeze(effectiveRanks),
  }
  return {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      skillBooks: Object.freeze(skillBooks),
    },
  }
}

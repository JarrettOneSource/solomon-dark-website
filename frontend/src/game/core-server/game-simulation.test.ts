import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import {
  BONEYARD_GAME_OVER_AUTOMATIC_ACCEPT_TICK,
  BONEYARD_GAME_OVER_EXIT_FADE_TICKS,
} from '../core-kernels/game-run.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import { startBoneyardArenaTransition } from '../core-kernels/boneyard-arena-transition.ts'
import { startBoneyardWaveDirector } from '../core-kernels/boneyard-wave-director.ts'
import { playerCollisionEnabled, playerDeathFrame } from '../core-kernels/player-combat.ts'
import { PRIMARY_CAST_EMISSION_TICK } from '../core-kernels/primary-spells.ts'
import {
  NATIVE_PLAYER_LIGHT_OVERLAY_DECAY,
  NATIVE_PLAYER_STAFF_CONSTANT_OVERLAY,
} from '../core-kernels/player-lighting.ts'
import {
  createDeferredNativeLightProviderRegistrations,
  createNativeLightProviderOrder,
  mergeNativeLightProviderOwners,
} from '../core-kernels/native-light-provider-order.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import {
  addPlayerCharacter,
  applyGameSimulationHubAction,
  BONEYARD_ENEMY_EVENT_LANE_CAPACITY,
  confirmGameSimulationLoadout,
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerCharacter,
  getPlayerEconomy,
  getPlayerProgression,
  getPlayerSkillBook,
  grantGameSimulationPlayerExperience,
  removePlayerCharacter,
  rerollGameSimulationPlayerSkill,
  saveGameSimulationPlayerSkill,
  selectGameSimulationPlayerSkill,
  stepGameSimulation,
  stepGameSimulationTick,
  type GameSimulationState,
} from './game-simulation.ts'
import {
  damageBoneyardEnemy,
  NATIVE_MAGE_ACTION_PROGRAMS,
  stepBoneyardEnemyStore,
  type BoneyardEnemySemanticEvent,
} from './boneyard-enemy-store.ts'
import { spawnBoneyardLootSpecs } from './boneyard-loot-store.ts'
import {
  damagePlayerEntity,
  dazzlePlayerEntity,
  playerCharacterRecords,
  playerLightingAt,
  poisonPlayerEntity,
  replacePlayerCharacter,
  replacePlayerCharacterRecords,
  replacePlayerEconomy,
} from './player-entity-store.ts'

function gameplayInput(x: number, y: number) {
  return {
    aim: null,
    cast: { primary: false, secondary: null },
    movement: { x, y },
  }
}

test('native provider registration is lane-local and stable across grouped collectors', () => {
  const order = createNativeLightProviderOrder()
  assert.deepEqual(order.register('actor'), {
    managerLane: 'actor',
    registrationOrdinal: 0,
  })
  assert.deepEqual(order.register('transient'), {
    managerLane: 'transient',
    registrationOrdinal: 0,
  })
  assert.deepEqual(order.register('actor'), {
    managerLane: 'actor',
    registrationOrdinal: 1,
  })

  const deferred = createDeferredNativeLightProviderRegistrations()
  const enemyProjectile = deferred.register('actor')
  const playerProjectile = order.register('actor')
  deferred.commit(order)
  assert.equal(playerProjectile.registrationOrdinal, 2)
  assert.equal(enemyProjectile.registrationOrdinal, 3)
  assert.throws(() => deferred.register('actor'), /already committed/)

  const owner = (
    label: string,
    managerLane: 'actor' | 'transient',
    registrationOrdinal: number,
  ) => ({ label, lightRegistration: { managerLane, registrationOrdinal } })
  const merged = mergeNativeLightProviderOwners([
    [owner('player', 'actor', 2), owner('transient-a', 'transient', 0)],
    [
      owner('enemy-copy-0', 'actor', 0),
      owner('enemy-copy-1', 'actor', 0),
      owner('projectile', 'actor', 1),
    ],
    [owner('transient-b', 'transient', 0)],
  ], ({ lightRegistration }) => lightRegistration)
  assert.deepEqual(merged.map(({ label }) => label), [
    'enemy-copy-0',
    'enemy-copy-1',
    'projectile',
    'player',
    'transient-a',
    'transient-b',
  ])
})

test('Boneyard entry registers players before Lantern and reconnect appends a fresh actor ordinal', () => {
  let state = createGameSimulation({
    first: { discipline: 'arcane', displayName: 'First', element: 'fire' },
    second: { discipline: 'arcane', displayName: 'Second', element: 'ether' },
  })
  const loaded = emptyBoneyard()
  loaded.scene.solomonDig = {
    frameProgram: [0, 3, 1],
    gravePosition: { x: 240, y: 240 },
    lanternPosition: { x: 245, y: 245 },
    position: { x: 250, y: 250 },
    ticksPerFrame: 5,
  }
  state = enterBoneyardWorld(state, loaded)
  assert.deepEqual(playerLightingAt(state.playerEntities, 'first')?.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 0,
  })
  assert.deepEqual(playerLightingAt(state.playerEntities, 'second')?.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 1,
  })
  assert.equal(state.world.kind, 'boneyard')
  assert.deepEqual(state.world.lanternLightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 2,
  })

  state = removePlayerCharacter(state, 'first')
  state = addPlayerCharacter(state, 'first', {
    discipline: 'arcane',
    displayName: 'First',
    element: 'fire',
  })
  assert.deepEqual(playerLightingAt(state.playerEntities, 'first')?.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 3,
  })
})

test('same-tick player primary actors register before projectiles spawned by later enemy actors', () => {
  const loaded = emptyBoneyard()
  loaded.runId = 'provider-order-run'
  let state = enterBoneyardWorld(createGameSimulation({ caster: {
    discipline: 'arcane',
    displayName: 'Caster',
    element: 'fire',
  } }), loaded)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')

  const order = createNativeLightProviderOrder(state.lightProviderOrder)
  const player = getPlayerCharacter(state, 'caster')
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    firstProjectileWorldContact: () => null,
    players: {
      caster: {
        alive: true,
        collisionRadius: 25,
        connected: true,
        eligible: true,
        position: player.position,
        velocityPerTick: { x: 0, y: 0 },
      },
    },
    registerLightProvider: order.register,
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'SKELETONMAGE',
      flags: ['FLAG_CASTFROST'],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETONMAGE,
      position: { x: 100, y: 100 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  const mage = seeded.store.actors[0]!
  if (mage.brain.family !== 'mage') throw new Error('expected Mage brain')
  state = {
    ...state,
    lightProviderOrder: order.state(),
    playerEntities: {
      ...state.playerEntities,
      primaryCasts: [{
        ...state.playerEntities.primaryCasts[0]!,
        actionTick: PRIMARY_CAST_EMISSION_TICK - 1,
        aimDirection: { x: 0, y: -1 },
        castSequence: 1,
        held: true,
      }],
    },
    world: {
      ...state.world,
      enemies: {
        ...seeded.store,
        actors: [{
          ...mage,
          brain: {
            ...mage.brain,
            actionProgress: NATIVE_MAGE_ACTION_PROGRAMS.short.markerProgress,
            castProgram: 'short',
            castRoll: 0,
            markerEmitted: false,
            phase: 'cast',
          },
        }],
      },
    },
  }

  state = stepGameSimulationTick(state, {
    caster: {
      aim: { x: player.position.x, y: 0 },
      cast: { primary: true, secondary: null },
      movement: { x: 0, y: 0 },
    },
  })
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const primary = state.primarySpells.projectiles.find(({ kind }) => kind === 'fire')
  const guided = state.world.enemies.projectiles.find(({ kind }) => kind === 'guided-missile')
  assert.ok(primary)
  assert.ok(guided)
  assert.deepEqual(primary.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 2,
  })
  assert.deepEqual(guided.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 3,
  })
  assert.deepEqual(state.lightProviderOrder.nextRegistrationOrdinal, {
    actor: 4,
    transient: 0,
  })
})

test('same-tick wave actors register before player primary actors', () => {
  const loaded = emptyBoneyard()
  loaded.runId = 'wave-provider-order-run'
  loaded.scene.solomonDig = {
    frameProgram: [0, 3, 1],
    gravePosition: { x: 240, y: 240 },
    lanternPosition: { x: 245, y: 245 },
    position: { x: 250, y: 250 },
    ticksPerFrame: 5,
  }
  let state = enterBoneyardWorld(createGameSimulation({ caster: {
    discipline: 'arcane',
    displayName: 'Caster',
    element: 'fire',
  } }), loaded)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  if (state.world.waves === null) throw new Error('expected retail wave director')
  const player = getPlayerCharacter(state, 'caster')
  state = {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      primaryCasts: [{
        ...state.playerEntities.primaryCasts[0]!,
        actionTick: PRIMARY_CAST_EMISSION_TICK - 1,
        aimDirection: { x: 0, y: -1 },
        castSequence: 1,
        held: true,
      }],
    },
    world: {
      ...state.world,
      waves: startBoneyardWaveDirector(state.world.waves),
    },
  }

  state = stepGameSimulationTick(state, {
    caster: {
      aim: { x: player.position.x, y: 0 },
      cast: { primary: true, secondary: null },
      movement: { x: 0, y: 0 },
    },
  })
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const fire = state.primarySpells.projectiles.find(({ kind }) => kind === 'fire')
  assert.ok(fire)
  assert.equal(state.world.enemies.actors.length, 10)
  assert.deepEqual(
    state.world.enemies.actors.map(({ lightRegistration }) => lightRegistration),
    Array.from({ length: 10 }, (_, index) => ({
      managerLane: 'actor' as const,
      registrationOrdinal: index + 2,
    })),
  )
  assert.deepEqual(fire.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 12,
  })
  assert.deepEqual(state.lightProviderOrder.nextRegistrationOrdinal, {
    actor: 13,
    transient: 0,
  })
})

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

test('hub trader actions require the authenticated participant to be in native service range', () => {
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
  const firstStock = getPlayerEconomy(state, 'first').fomentiusStock[0]!
  const outOfRange = applyGameSimulationHubAction(state, 'first', {
    type: 'buy-fomentius',
    itemId: firstStock.id,
  })
  assert.equal(outOfRange.accepted, false)
  assert.equal(outOfRange.reason, 'service-unavailable')
  assert.strictEqual(outOfRange.state, state)

  state = {
    ...state,
    playerEntities: replacePlayerCharacter(
      state.playerEntities,
      'first',
      { ...getPlayerCharacter(state, 'first'), position: { x: 1397, y: 664 } },
    ),
  }
  const purchased = applyGameSimulationHubAction(state, 'first', {
    type: 'buy-fomentius',
    itemId: firstStock.id,
  })
  assert.equal(purchased.accepted, true)
  assert.equal(getPlayerEconomy(purchased.state, 'first').gold, 9_850)
  assert.deepEqual(getPlayerEconomy(purchased.state, 'first').actionFeedback, {
    accepted: true,
    action: 'buy-fomentius',
    dowsingPitch: null,
    reason: null,
    sequence: 1,
    transferDirection: null,
    transferGesture: null,
  })
  assert.equal(getPlayerEconomy(purchased.state, 'second').gold, 10_000)
  assert.strictEqual(
    getPlayerEconomy(purchased.state, 'second'),
    getPlayerEconomy(state, 'second'),
  )
  const rejected = applyGameSimulationHubAction(purchased.state, 'first', {
    type: 'buy-fomentius',
    itemId: firstStock.id,
  })
  assert.equal(rejected.accepted, false)
  assert.deepEqual(getPlayerEconomy(rejected.state, 'first').actionFeedback, {
    accepted: false,
    action: 'buy-fomentius',
    dowsingPitch: null,
    reason: 'invalid-offer',
    sequence: 2,
    transferDirection: null,
    transferGesture: null,
  })

  if (purchased.state.world.kind !== 'hub') throw new Error('expected Hub world')
  const transition = {
    alpha: 0.1,
    destination: 'library',
    phase: 'outgoing',
    scriptedSpeed: 0.45,
    scriptedTarget: { x: 2057.5, y: 460.5 },
    sourceRegion: 'courtyard',
  } as const
  const fading: GameSimulationState = {
    ...purchased.state,
    world: {
      ...purchased.state.world,
      participants: {
        ...purchased.state.world.participants,
        first: { region: 'courtyard', transition },
      },
    },
  }
  assert.equal(applyGameSimulationHubAction(fading, 'first', {
    type: 'buy-fomentius',
    itemId: getPlayerEconomy(fading, 'first').fomentiusStock[0]!.id,
  }).reason, 'service-unavailable')
})

test('inventory double activation consumes one potion and applies its participant-owned effect', () => {
  let state = createGameSimulation()
  const index = state.playerEntities.identities.findIndex(({ playerId }) => playerId === 'local-player')
  const progressions = [...state.playerEntities.progressions]
  progressions[index] = {
    ...progressions[index]!,
    currentHealth: 3,
  }
  state = {
    ...state,
    playerEntities: { ...state.playerEntities, progressions },
  }
  const health = getPlayerEconomy(state).backpack.find(({ kind }) => kind === 'health-potion')!
  const consumed = applyGameSimulationHubAction(state, 'local-player', {
    type: 'consume',
    itemId: health.id,
  })

  assert.equal(consumed.accepted, true)
  assert.equal(getPlayerEconomy(consumed.state).actionFeedback?.action, 'consume')
  assert.equal(getPlayerEconomy(consumed.state).backpack.some(({ id }) => id === health.id), false)
  assert.equal(
    getPlayerProgression(consumed.state).currentHealth,
    getPlayerProgression(consumed.state).maximumHealth,
  )
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
  state = stepGameSimulationTick(state, {})
  assert.equal(state.tick, frozenTick + 1)
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

test('Sorceror actions are authoritative, consume the active offer, and preserve saved choices', () => {
  let state = createGameSimulation({ first: {
    discipline: 'arcane',
    displayName: 'First',
    element: 'ether',
  } }, { playerOfferRngSeed: 73 })
  state = {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'first', {
      ...getPlayerEconomy(state, 'first'),
      ownedPerkSelectors: [17],
    }),
  }
  state = grantGameSimulationPlayerExperience(state, 'first', 300)
  const initial = state
  const firstOffer = getPlayerProgression(state, 'first').pendingOffer!
  assert.equal(getPlayerProgression(state, 'first').sorcerorsCharmAvailable, true)

  state = rerollGameSimulationPlayerSkill(state, 'first', firstOffer.sequence)!
  const rerolled = getPlayerProgression(state, 'first')
  assert.notEqual(rerolled.pendingOffer?.sequence, firstOffer.sequence)
  assert.equal(rerolled.sorcerorsCharmAvailable, false)
  assert.notDeepEqual(state.playerOfferRng, initial.playerOfferRng)
  assert.equal(
    rerollGameSimulationPlayerSkill(state, 'first', rerolled.pendingOffer!.sequence),
    null,
  )

  const saved = saveGameSimulationPlayerSkill(initial, 'first', firstOffer.sequence)!
  const savedProgression = getPlayerProgression(saved, 'first')
  assert.equal(savedProgression.deferredSkillChoices, 1)
  assert.deepEqual(savedProgression.pendingLevels, [4, 4])
  assert.equal(savedProgression.sorcerorsCharmAvailable, true)
  assert.ok(saved.levelUpBarrier)

  let single = createGameSimulation({ first: {
    discipline: 'arcane',
    displayName: 'First',
    element: 'ether',
  } })
  single = {
    ...single,
    playerEntities: replacePlayerEconomy(single.playerEntities, 'first', {
      ...getPlayerEconomy(single, 'first'),
      ownedPerkSelectors: [17],
    }),
  }
  single = grantGameSimulationPlayerExperience(single, 'first', 100)
  const singleOffer = getPlayerProgression(single, 'first').pendingOffer!
  single = saveGameSimulationPlayerSkill(single, 'first', singleOffer.sequence)!
  assert.equal(single.levelUpBarrier, null)
  assert.equal(getPlayerProgression(single, 'first').deferredSkillChoices, 1)
  single = grantGameSimulationPlayerExperience(single, 'first', 61)
  assert.deepEqual(getPlayerProgression(single, 'first').pendingLevels, [3, 3])
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
    cast: { primary, secondary: null },
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

test('authoritative player ticks reset and decay StaffConstant lighting before projection', () => {
  const water = {
    discipline: 'arcane',
    displayName: 'Water Caster',
    element: 'water',
  } as const
  let state = createGameSimulation({ caster: water })
  const cast = (primary: boolean) => {
    const player = getPlayerCharacter(state, 'caster')
    return {
      aim: { x: player.position.x, y: player.position.y - 200 },
      cast: { primary, secondary: null },
      movement: { x: 0, y: 0 },
    }
  }
  state = stepGameSimulationTick(state, { caster: cast(true) })
  const activePhase = Math.fround(
    NATIVE_PLAYER_STAFF_CONSTANT_OVERLAY * NATIVE_PLAYER_LIGHT_OVERLAY_DECAY,
  )
  assert.equal(playerLightingAt(state.playerEntities, 'caster')?.overlayEffectPhase, activePhase)

  state = stepGameSimulationTick(state, { caster: cast(false) })
  assert.equal(
    playerLightingAt(state.playerEntities, 'caster')?.overlayEffectPhase,
    Math.fround(activePhase * NATIVE_PLAYER_LIGHT_OVERLAY_DECAY),
  )
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
    cast: { primary: true, secondary: null },
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

test('sealed generated Arena clips player spell range at the retired entrance boundary', () => {
  const loaded = emptyBoneyard()
  loaded.scene.bounds = { x: 0, y: 0, w: 500, h: 900 }
  loaded.scene.spawn = { facingDeg: 180, x: 250, y: 150 }
  loaded.scene.solomonDig = {
    frameProgram: [0, 3, 1],
    gravePosition: { x: 240, y: 450 },
    lanternPosition: { x: 245, y: 450 },
    position: { x: 250, y: 450 },
    ticksPerFrame: 5,
  }
  let state = enterBoneyardWorld(createGameSimulation({ caster: {
    discipline: 'arcane',
    displayName: 'Air Caster',
    element: 'air',
  } }), loaded)
  if (state.world.kind !== 'boneyard' || state.world.arenaTransition === null) {
    throw new Error('expected generated Arena transition ownership')
  }
  const player = getPlayerCharacter(state, 'caster')
  state = {
    ...state,
    playerEntities: replacePlayerCharacter(state.playerEntities, 'caster', {
      ...player,
      position: { x: 250, y: 425 },
    }),
    world: {
      ...state.world,
      arenaTransition: startBoneyardArenaTransition(state.world.arenaTransition),
    },
  }

  state = stepGameSimulationTick(state, { caster: {
    aim: { x: 250, y: 0 },
    cast: { primary: true, secondary: null },
    movement: { x: 0, y: 0 },
  } })

  const bolt = state.primarySpells.transients[0]
  assert.equal(bolt.kind, 'air')
  assert.ok(bolt.endpoint.y >= 375, `Air escaped retired boundary: ${bolt.endpoint.y}`)
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
      cast: { primary, secondary: null },
      movement: { x: 0, y: 0 },
    }
  }

  rankOne = stepGameSimulationTick(rankOne, { caster: cast(rankOne, true) })
  rankTwo = stepGameSimulationTick(rankTwo, { caster: cast(rankTwo, true) })
  assert.equal(
    getPlayerProgression(rankOne, 'caster').currentMana,
    getPlayerProgression(rankTwo, 'caster').currentMana,
  )

  for (let tick = 0; tick < PRIMARY_CAST_EMISSION_TICK; tick += 1) {
    rankOne = stepGameSimulationTick(rankOne, { caster: cast(rankOne, true) })
    rankTwo = stepGameSimulationTick(rankTwo, { caster: cast(rankTwo, true) })
  }
  assert.ok(Math.abs(
    getPlayerProgression(rankOne, 'caster').currentMana
      - getPlayerProgression(rankTwo, 'caster').currentMana
      - 3,
  ) < 1e-12)
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
    cast: { primary, secondary: null },
    movement: { x: 0, y: 0 },
  })
  const initialMana = getPlayerProgression(state, 'caster').currentMana
  state = stepGameSimulationTick(state, { caster: cast(true) })
  assert.equal(getPlayerProgression(state, 'caster').currentMana, initialMana)
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
  assert.ok(getPlayerProgression(state, 'caster').currentMana < initialMana)
  assert.equal(enemy.lifeState, 'dying')
  assert.ok(enemy.currentHealth <= 0)
  assert.equal(enemy.lastDamagedByPlayerId, 'caster')
  assert.ok(enemy.lastDamageTick !== null)
  assert.ok(state.world.enemyEvents.some((event) => (
    event.type === 'enemy-damage-sound' && event.sound === 'bone-crack'
  )))
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
        lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
        ownerId: 'caster',
        phase: 'flight',
        position: { x: 50, y: 250 },
        underpowered: false,
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
  state = {
    ...state,
    world: {
      ...state.world,
      enemies: killed.store,
      enemyEvents: killed.events,
    },
  }

  state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const firstBatch = state.world.enemyEvents
  assert.deepEqual(firstBatch.map(({ eventId, type }) => ({ eventId, type })), [
    { eventId: 2, type: 'enemy-damage-sound' },
    { eventId: 3, type: 'enemy-death' },
    { eventId: 4, type: 'enemy-terminal-output' },
    { eventId: 5, type: 'enemy-death-sound' },
    { eventId: 6, type: 'reward' },
    { eventId: 7, type: 'enemy-retired' },
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

test('enemy retirement carries its death-time private seed into one authoritative ground drop', () => {
  for (const [actorSeed, expectedKind] of [
    [9_974_658, 'gold'],
    [6_778_989, 'orb'],
  ] as const) {
    let state = enterBoneyardWorld(
      createGameSimulation(),
      emptyBoneyard(),
    )
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
    const player = getPlayerCharacter(state)
    const spawned = stepBoneyardEnemyStore(state.world.enemies, {
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
      rollLootSeed: () => actorSeed,
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
    assert.equal(spawned.store.actors[0]?.lootSeed, actorSeed)
    const killed = damageBoneyardEnemy(spawned.store, {
      actorId: spawned.store.actors[0]!.id,
      amount: spawned.store.actors[0]!.currentHealth,
      sourcePlayerId: 'local-player',
      tick: 0,
    })
    state = {
      ...state,
      world: {
        ...state.world,
        enemies: killed.store,
        loot: { ...state.world.loot, sharedRng: createNativeRng(100) },
      },
    }

    state = stepGameSimulationTick(state, {})
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
    assert.deepEqual(state.world.loot.actors.map(({ kind, source }) => ({ kind, source })), [
      { kind: expectedKind, source: 'enemy' },
    ])
    assert.deepEqual(state.world.enemies.actors, [])
  }
})

test('all three Bonus pickups apply once through authoritative progression and feedback', () => {
  for (const bonusKind of [0, 1, 2] as const) {
    let state = enterBoneyardWorld(
      createGameSimulation(),
      emptyBoneyard(),
    )
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
    const position = getPlayerCharacter(state).position
    const spawned = spawnBoneyardLootSpecs(state.world.loot, [{
      activationDelayTicks: 0,
      bonusKind,
      id: 1,
      kind: 'bonus',
      nativeTypeId: 2038,
      phase: 0,
      position,
      source: 'script',
    }], state.tick)
    assert.equal(spawned.rejectedCount, 0)
    const ranksBefore = [...getPlayerSkillBook(state).permanentRanks]
    const lootRngBefore = spawned.store.sharedRng
    state = {
      ...state,
      world: { ...state.world, loot: spawned.store },
    }

    state = stepGameSimulationTick(state, {})
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
    assert.deepEqual(state.world.loot.actors, [])
    const pickup = state.world.lootEvents.find(({ type }) => type === 'loot-pickup')
    assert.equal(pickup?.playerId, 'local-player')
    if (bonusKind === 0) {
      assert.equal(pickup?.text, 'BONUS SKILL POINT')
      assert.ok(getPlayerProgression(state).pendingOffer)
      assert.ok(state.levelUpBarrier)
      assert.deepEqual(state.levelUpBarrier.pendingPlayerIds, ['local-player'])
    } else if (bonusKind === 1) {
      assert.match(pickup?.text ?? '', / \+1$/u)
      const ranksAfter = getPlayerSkillBook(state).permanentRanks
      assert.equal(ranksAfter.flatMap((rank, skillId) => (
        rank === ranksBefore[skillId] ? [] : [skillId]
      )).length, 1)
      assert.notStrictEqual(state.world.loot.sharedRng, lootRngBefore)
    } else {
      assert.equal(pickup?.text, 'DAMAGE x4')
      assert.ok(getPlayerProgression(state).damageX4TicksRemaining > 0)
    }
  }
})

test('Rotten Zombie contact applies direct damage and authoritative poison over time', () => {
  let state = enterBoneyardWorld(
    createGameSimulation(),
    combatBoneyard('poison-combat-run'),
  )
  state = withRottenZombieAtPlayer(state)

  for (let tick = 0; tick < 100; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (getPlayerProgression(state).poisonTicksRemaining > 0) break
  }

  const progression = getPlayerProgression(state)
  assert.ok(progression.poisonTicksRemaining > 0)
  assert.ok(progression.currentHealth > 14 && progression.currentHealth < 15)
  assert.equal(progression.poisonDamagePerTick, 35 / 6 / 100)
  assert.equal(progression.poisonTicksRemaining, 999)
  assert.notEqual(progression.lastDamageTick, null)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const ouchEvents = state.world.enemyEvents.filter((event) => (
    event.type === 'player-damage-sound'
  ))
  assert.equal(ouchEvents.length, 1)
  assert.equal(ouchEvents[0]!.gainScale, 1)
  assert.equal(ouchEvents[0]!.pitch, 1)
  assert.equal(ouchEvents[0]!.targetPlayerId, 'local-player')
  assert.match(ouchEvents[0]!.sound!, /^wizard-ouch-[123]$/)
  assert.ok(state.world.playerOuchDeadlineTick >= state.tick + 20)
  assert.ok(state.world.playerOuchDeadlineTick <= state.tick + 60)
  const lastDamageTick = progression.lastDamageTick
  const healthAfterContact = progression.currentHealth
  state = stepGameSimulationTick(state, {})
  assert.ok(getPlayerProgression(state).currentHealth < healthAfterContact)
  assert.equal(getPlayerProgression(state).poisonTicksRemaining, 998)
  assert.equal(getPlayerProgression(state).lastDamageTick, lastDamageTick)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  assert.equal(
    state.world.enemyEvents.filter((event) => event.type === 'player-damage-sound').length,
    1,
  )
})

test('terminal direct damage suppresses Wizard ouch and yields to death presentation', () => {
  let state = enterBoneyardWorld(
    createGameSimulation(),
    combatBoneyard('terminal-contact-run'),
  )
  state = withRottenZombieAtPlayer(state)
  state = {
    ...state,
    playerEntities: damagePlayerEntity(
      state.playerEntities,
      'local-player',
      30,
      state.tick,
    ),
  }

  for (let tick = 0; tick < 100; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (getPlayerProgression(state).lifeState !== 'alive') break
  }

  assert.equal(getPlayerProgression(state).lifeState, 'dying')
  assert.equal(getPlayerProgression(state).lastDamageTick, null)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  assert.equal(
    state.world.enemyEvents.some((event) => event.type === 'player-damage-sound'),
    false,
  )
})

test('poison begins the native death epoch before all-dead Game Over', () => {
  let state = enterBoneyardWorld(
    createGameSimulation(),
    combatBoneyard('poison-lethal-run'),
  )
  state = {
    ...state,
    playerEntities: poisonPlayerEntity(
      damagePlayerEntity(state.playerEntities, 'local-player', 59.99, state.tick),
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
  let state = createGameSimulation({ first, second })
  const initialStockIds = Object.fromEntries(['first', 'second'].map((playerId) => [
    playerId,
    getPlayerEconomy(state, playerId).fomentiusStock.map(({ id }) => id),
  ]))
  state = enterBoneyardWorld(state, combatBoneyard('multiplayer-death-run'))
  state = {
    ...state,
    playerEntities: damagePlayerEntity(state.playerEntities, 'first', 60, state.tick),
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
    playerEntities: damagePlayerEntity(state.playerEntities, 'second', 60, state.tick),
  }
  state = stepGameSimulationTick(state, {})
  assert.equal(getPlayerProgression(state, 'second').lifeState, 'dying')
  assert.equal(state.run.phase, 'game-over')
  assert.equal(state.run.gameOverEventId, 1)
  assert.equal(state.run.gameOverTicks, 0)

  const frozenWorld = state.world
  for (let deathTick = 1; deathTick <= 152; deathTick += 1) {
    state = stepGameSimulationTick(state, {
      first: gameplayInput(1, 0),
      second: gameplayInput(1, 0),
    })
    assert.equal(state.world, frozenWorld)
    assert.equal(getPlayerProgression(state, 'second').deathTick, deathTick)
  }
  assert.equal(playerDeathFrame(getPlayerProgression(state, 'second')), 0)
  state = stepGameSimulationTick(state, {})
  assert.equal(getPlayerProgression(state, 'second').deathTick, 153)
  assert.equal(playerDeathFrame(getPlayerProgression(state, 'second')), 1)
  for (let deathTick = 154; deathTick <= 156; deathTick += 1) {
    state = stepGameSimulationTick(state, {})
  }
  assert.equal(getPlayerProgression(state, 'second').deathTick, 156)
  assert.equal(playerDeathFrame(getPlayerProgression(state, 'second')), 2)
  for (let deathTick = 157; deathTick <= 159; deathTick += 1) {
    state = stepGameSimulationTick(state, {})
  }
  assert.equal(getPlayerProgression(state, 'second').deathTick, 159)
  assert.equal(getPlayerProgression(state, 'second').lifeState, 'spectating')
  assert.equal(playerDeathFrame(getPlayerProgression(state, 'second')), 3)

  while (state.run.gameOverTicks < BONEYARD_GAME_OVER_AUTOMATIC_ACCEPT_TICK - 1) {
    state = stepGameSimulationTick(state, {
      first: gameplayInput(1, 0),
      second: gameplayInput(1, 0),
    })
    assert.equal(state.world, frozenWorld)
  }
  assert.equal(state.run.gameOverExitTicks, null)
  state = stepGameSimulationTick(state, {})
  assert.equal(state.run.gameOverTicks, BONEYARD_GAME_OVER_AUTOMATIC_ACCEPT_TICK)
  assert.equal(state.run.gameOverExitTicks, 1)
  for (let exitTick = 2; exitTick <= BONEYARD_GAME_OVER_EXIT_FADE_TICKS; exitTick += 1) {
    state = stepGameSimulationTick(state, {})
    assert.equal(state.world, frozenWorld)
    assert.equal(state.run.gameOverExitTicks, exitTick)
  }
  assert.equal(state.run.phase, 'game-over')
  assert.equal(state.run.gameOverExitTicks, BONEYARD_GAME_OVER_EXIT_FADE_TICKS)
  const loadout = stepGameSimulationTick(state, {})
  assert.equal(loadout.run.phase, 'loadout')
  assert.equal(loadout.world.kind, 'hub')
  assert.deepEqual(
    Object.keys(playerCharacterRecords(loadout.playerEntities)).sort(),
    ['first', 'second'],
  )
  for (const playerId of ['first', 'second']) {
    const restocked = getPlayerEconomy(loadout, playerId).fomentiusStock
    assert.notDeepEqual(restocked.map(({ id }) => id), initialStockIds[playerId])
    assert.ok(restocked.every(({ id }) => id > Math.max(...initialStockIds[playerId]!)))
  }

  const hub = confirmGameSimulationLoadout(loadout)
  assert.ok(hub)
  assert.equal(hub.run.phase, 'hub')
  const secondRun = enterBoneyardWorld(hub, combatBoneyard('clean-second-run'))
  assert.equal(secondRun.run.phase, 'active')
  assert.equal(secondRun.run.nextGameOverEventId, 2)
  if (secondRun.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  assert.equal(secondRun.world.playerOuchDeadlineTick, 0)
  assert.deepEqual(secondRun.world.enemyEvents, [])
  assert.deepEqual(secondRun.world.loot.actors, [])
  assert.deepEqual(secondRun.world.loot.effects, [])
  assert.deepEqual(secondRun.world.lootEvents, [])
  assert.equal(secondRun.world.loot.nextActorId, 1)
  assert.equal(secondRun.world.loot.nextEventId, 1)
  for (const playerId of ['first', 'second']) {
    const progression = getPlayerProgression(secondRun, playerId)
    assert.equal(progression.lifeState, 'alive')
    assert.equal(progression.lastDamageTick, null)
    assert.equal(progression.currentHealth, progression.maximumHealth)
    assert.equal(progression.currentMana, progression.maximumMana)
    assert.equal(progression.deathEpoch, 0)
    assert.equal(progression.deathTick, 0)
  }
})

function withRottenZombieAtPlayer(state: GameSimulationState): GameSimulationState {
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
      spawnTick: state.tick,
      waveOrdinal: 1,
    }],
    tick: state.tick,
  })
  return { ...state, world: { ...state.world, enemies: seeded.store } }
}

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

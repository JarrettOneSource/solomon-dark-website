import assert from 'node:assert/strict'
import test from 'node:test'

import { actorHeadingFromVector, actorHeadingIndex } from '../core-kernels/actor-heading.ts'
import { NATIVE_ACTOR_SEPARATION_EPSILON } from '../core-kernels/actor-physics.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import {
  GAME_OVER_AUTOMATIC_ACCEPT_TICK,
  GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
} from '../core-kernels/game-run.ts'
import { NATIVE_HALL_OF_FAME_SCORE } from '../core-kernels/hall-of-fame-score.ts'
import { hubCollegeAdmissionPreLoadout } from '../core-kernels/college-admission-lifecycle.ts'
import { NATIVE_SECONDARY_ABILITY_IDS } from '../core-kernels/native-secondary-ability-contract.ts'
import {
  NATIVE_WELD_BUILDS,
  type NativeBeltSkillId,
} from '../core-kernels/player-progression.ts'
import { freezeNativeBelt } from '../core-kernels/native-belt.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import { startBoneyardArenaTransition } from '../core-kernels/boneyard-arena-transition.ts'
import { startBoneyardWaveDirector } from '../core-kernels/boneyard-wave-director.ts'
import {
  PLAYER_DEATH_PRESENTATION_DURATION_TICKS,
  PLAYER_DEATH_PRESENTATION_MAXIMUM_HELD_TICK,
  playerCollisionEnabled,
  playerDeathFrame,
} from '../core-kernels/player-combat.ts'
import { PRIMARY_CAST_EMISSION_TICK } from '../core-kernels/primary-spells.ts'
import {
  createEquipmentInventoryItem,
  DOWSING_EQUIPMENT_RECIPES,
  findInventoryItem,
  type HubInventoryItem,
} from '../core-kernels/hub-economy.ts'
import {
  NATIVE_PLAYER_LIGHT_OVERLAY_DECAY,
  NATIVE_PLAYER_STAFF_CONSTANT_OVERLAY,
} from '../core-kernels/player-lighting.ts'
import {
  createDeferredNativeLightProviderRegistrations,
  createNativeLightProviderOrder,
  mergeNativeLightProviderOwners,
} from '../core-kernels/native-light-provider-order.ts'
import {
  advanceNativeRngWords,
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
} from '../core-kernels/native-rng.ts'
import { rollNativeStarterEquipmentAppearance } from '../core-kernels/native-starter-equipment.ts'
import {
  createNativeSecondaryPlayerState,
  NATIVE_SECONDARY_CONSTRUCTOR_COOLDOWN_TICKS,
} from '../core-kernels/native-secondary-abilities.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import {
  addPlayerCharacter,
  applyGameSimulationHubAction,
  armGameSimulationCollegeIntro,
  bindGameSimulationPlayerSkillQuickbar,
  BONEYARD_ENEMY_EVENT_LANE_CAPACITY,
  confirmGameSimulationLoadout,
  createGameSimulation,
  declineGameSimulationTutorial,
  detachGameSimulationPlayer,
  DEFAULT_PLAYER_CHARACTER_CONFIG,
  enterBoneyardWorld,
  GAME_TICK_RATE,
  getPlayerBelt,
  getPlayerCharacter,
  getPlayerEconomy,
  getPlayerProgression,
  getPlayerSkillBook,
  gameSimulationDurableProfileEconomy,
  grantGameSimulationPlayerExperience,
  removePlayerCharacter,
  rejoinGameSimulationPlayer,
  selectDetachedGameSimulationPlayerSkill,
  returnGameSimulationToHub,
  rerollGameSimulationPlayerSkill,
  saveGameSimulationPlayerSkill,
  selectGameSimulationPlayerSkill,
  synchronizeDetachedGameSimulationPlayer,
  stepGameSimulation,
  stepGameSimulationTick,
  type GameSimulationExtensions,
  type GameSimulationState,
} from './game-simulation.ts'
import {
  damageBoneyardEnemy,
  NATIVE_MAGE_ACTION_PROGRAMS,
  stepBoneyardEnemyStore,
  type BoneyardEnemySemanticEvent,
} from './boneyard-enemy-store.ts'
import { createBoneyardLootStore, spawnBoneyardLootSpecs } from './boneyard-loot-store.ts'
import { sealPlayerCombatInput } from './player-combat-input.ts'
import {
  damagePlayerEntity,
  dazzlePlayerEntity,
  playerCharacterRecords,
  playerLightingAt,
  playerSkillDerivedStatsAt,
  playerSkillRuntimeAt,
  poisonPlayerEntity,
  replacePlayerCharacter,
  replacePlayerCharacterRecords,
  replacePlayerEconomy,
  selectPlayerEntityConcentration,
  setPlayerEntityMana,
} from './player-entity-store.ts'

function gameplayInput(x: number, y: number) {
  return {
    aim: null,
    cast: { primary: false, quickbar: null },
    movement: { x, y },
    viewportWidth: 1_600,
  }
}

function equipMindblowingRing(
  state: GameSimulationState,
  playerId: string,
): GameSimulationState {
  const recipe = DOWSING_EQUIPMENT_RECIPES.find(({ sourceIndex }) => sourceIndex === 38)
  if (!recipe) throw new Error('Mindblowing Ring recipe is missing')
  const economy = getPlayerEconomy(state, playerId)
  const ring = createEquipmentInventoryItem(recipe, economy.nextItemId)
  return {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, playerId, {
      ...economy,
      equipment: {
        ...economy.equipment,
        rings: [ring, economy.equipment.rings[1], economy.equipment.rings[2]],
      },
      nextItemId: economy.nextItemId + 1,
      revision: economy.revision + 1,
    }),
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

test('loadout confirmation consumes onboarding before the ordinary Courtyard return', () => {
  let state = createGameSimulation({ owner: DEFAULT_PLAYER_CHARACTER_CONFIG })
  const ownerParticipant = () => {
    if (state.world.kind !== 'hub') throw new Error('expected Hub world')
    return state.world.participants.owner
  }
  const initialRevision = getPlayerEconomy(state, 'owner').revision
  const initialStarterTint = getPlayerEconomy(state, 'owner').equipment.hat?.iconTints
  assert.ok(initialStarterTint)
  assert.deepEqual(getPlayerEconomy(state, 'owner').equipment.robe?.iconTints, initialStarterTint)
  assert.equal(hubCollegeAdmissionPreLoadout(
    ownerParticipant(),
    getPlayerEconomy(state, 'owner').collegeIntroPending,
  ), true)

  state = armGameSimulationCollegeIntro(state, 'owner')
  assert.equal(ownerParticipant()?.region, 'courtyard')
  assert.equal(ownerParticipant()?.collegeIntro?.phase, 'courtyard-walk')
  assert.deepEqual(getPlayerCharacter(state, 'owner').position, { x: 972, y: 1_044 })
  assert.equal(getPlayerCharacter(state, 'owner').headingIndex, 2)
  const collegeStarterTint = getPlayerEconomy(state, 'owner').equipment.hat?.iconTints
  assert.ok(collegeStarterTint)
  assert.notDeepEqual(collegeStarterTint, initialStarterTint)
  assert.deepEqual(getPlayerEconomy(state, 'owner').equipment.robe?.iconTints, collegeStarterTint)
  assert.equal(collegeStarterTint[1], 0xffffff)

  for (let tick = 0; tick < 5_000; tick += 1) {
    if (ownerParticipant()?.collegeIntro?.phase === 'arch-dialogue') break
    state = stepGameSimulationTick(state, {}, {
      collegeIntroReadyPlayerIds: new Set(['owner']),
    })
  }

  assert.equal(ownerParticipant()?.region, 'office')
  assert.equal(ownerParticipant()?.collegeIntro?.phase, 'arch-dialogue')
  assert.equal(getPlayerEconomy(state, 'owner').collegeIntroPending, true)
  assert.equal(getPlayerEconomy(state, 'owner').revision, initialRevision)
  assert.equal(hubCollegeAdmissionPreLoadout(
    ownerParticipant(),
    getPlayerEconomy(state, 'owner').collegeIntroPending,
  ), true)

  const acknowledged = applyGameSimulationHubAction(state, 'owner', {
    type: 'acknowledge-college-intro-dialogue',
  })
  assert.equal(acknowledged.accepted, true)
  state = acknowledged.state
  assert.equal(ownerParticipant()?.collegeIntro, null)
  assert.strictEqual(armGameSimulationCollegeIntro(state, 'owner'), state)
  assert.equal(hubCollegeAdmissionPreLoadout(
    ownerParticipant(),
    getPlayerEconomy(state, 'owner').collegeIntroPending,
  ), true)

  state = {
    ...state,
    playerEntities: replacePlayerCharacter(
      state.playerEntities,
      'owner',
      {
        ...getPlayerCharacter(state, 'owner'),
        position: { x: 512, y: 924 },
        velocity: { x: 0, y: 0 },
      },
    ),
  }
  state = stepGameSimulationTick(state, {})
  assert.equal(ownerParticipant()?.transition?.phase, 'outgoing')
  assert.equal(hubCollegeAdmissionPreLoadout(
    ownerParticipant(),
    getPlayerEconomy(state, 'owner').collegeIntroPending,
  ), true)
  for (let tick = 0; tick < 101; tick += 1) state = stepGameSimulationTick(state, {})
  assert.equal(ownerParticipant()?.region, 'courtyard')
  assert.equal(ownerParticipant()?.transition?.phase, 'college-loadout')
  assert.deepEqual(getPlayerCharacter(state, 'owner').position, { x: 952.5, y: 67.5 })
  assert.equal(getPlayerEconomy(state, 'owner').collegeIntroPending, true)
  assert.equal(hubCollegeAdmissionPreLoadout(
    ownerParticipant(),
    getPlayerEconomy(state, 'owner').collegeIntroPending,
  ), true)

  const confirmed = confirmGameSimulationLoadout(state, 'owner', {
    discipline: 'body',
    displayName: 'Reborn',
    element: 'air',
  })
  assert.ok(confirmed)
  state = confirmed
  assert.equal(ownerParticipant()?.transition?.phase, 'incoming')
  assert.equal(getPlayerCharacter(state, 'owner').config.displayName, 'Reborn')
  const selectedAppearance = rollNativeStarterEquipmentAppearance(
    createNativeRng(getPlayerProgression(state, 'owner').offerSeed),
    'air',
  )
  assert.deepEqual(getPlayerEconomy(state, 'owner').equipment.hat?.iconTints, [
    selectedAppearance.primaryTint,
    selectedAppearance.secondaryTint,
  ])
  assert.deepEqual(
    getPlayerEconomy(state, 'owner').equipment.robe?.iconTints,
    getPlayerEconomy(state, 'owner').equipment.hat?.iconTints,
  )
  assert.notDeepEqual(getPlayerEconomy(state, 'owner').equipment.hat?.iconTints, collegeStarterTint)
  assert.equal(getPlayerEconomy(state, 'owner').collegeIntroPending, false)
  assert.equal(getPlayerEconomy(state, 'owner').tutorialPending, false)
  assert.equal(getPlayerEconomy(state, 'owner').revision, initialRevision + 2)
  assert.strictEqual(armGameSimulationCollegeIntro(state, 'owner'), state)
  assert.equal(hubCollegeAdmissionPreLoadout(
    ownerParticipant(),
    getPlayerEconomy(state, 'owner').collegeIntroPending,
  ), false)

  for (let ticks = 0; ownerParticipant()?.transition && ticks < 200; ticks += 1) {
    state = stepGameSimulationTick(state, {})
  }
  assert.equal(ownerParticipant()?.transition, null)
  assert.deepEqual(getPlayerCharacter(state, 'owner').position, { x: 952.5, y: 157.5 })
  assert.equal(getPlayerEconomy(state, 'owner').collegeIntroPending, false)
  assert.equal(getPlayerEconomy(state, 'owner').revision, initialRevision + 2)
  assert.strictEqual(armGameSimulationCollegeIntro(state, 'owner'), state)
  assert.equal(hubCollegeAdmissionPreLoadout(
    ownerParticipant(),
    getPlayerEconomy(state, 'owner').collegeIntroPending,
  ), false)
})

test('declining the Tutorial atomically consumes both fresh onboarding obligations', () => {
  const initial = createGameSimulation({ owner: DEFAULT_PLAYER_CHARACTER_CONFIG })
  const initialEconomy = getPlayerEconomy(initial, 'owner')
  assert.equal(initialEconomy.tutorialPending, true)
  assert.equal(initialEconomy.collegeIntroPending, true)

  const declined = declineGameSimulationTutorial(initial, 'owner')
  const economy = getPlayerEconomy(declined, 'owner')
  assert.equal(economy.tutorialPending, false)
  assert.equal(economy.collegeIntroPending, false)
  assert.equal(economy.revision, initialEconomy.revision + 1)
  assert.equal(hubCollegeAdmissionPreLoadout(
    declined.world.kind === 'hub' ? declined.world.participants.owner : undefined,
    economy.collegeIntroPending,
  ), false)
  assert.strictEqual(armGameSimulationCollegeIntro(declined, 'owner'), declined)
  assert.strictEqual(declineGameSimulationTutorial(declined, 'owner'), declined)

  const armed = armGameSimulationCollegeIntro(initial, 'owner')
  assert.strictEqual(declineGameSimulationTutorial(armed, 'owner'), armed)
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
      cast: { primary: true, quickbar: null },
      movement: { x: 0, y: 0 },
      viewportWidth: 1_600,
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
  if (state.world.encounter === null) throw new Error('expected retail encounter')
  const openingCount = state.world.waves.openingBursts[0]!.count
  const player = getPlayerCharacter(state, 'caster')
  state = {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      primaryCasts: [{
        ...state.playerEntities.primaryCasts[0]!,
        actionTick: PRIMARY_CAST_EMISSION_TICK - 1,
        aimDirection: { x: 1, y: 0 },
        castSequence: 1,
        held: true,
      }],
    },
    world: {
      ...state.world,
      encounter: { ...state.world.encounter, phase: 'gone', runEventId: 1 },
      waves: startBoneyardWaveDirector(state.world.waves),
    },
  }

  state = stepGameSimulationTick(state, {
    caster: {
      aim: { x: player.position.x + 1_000, y: player.position.y },
      cast: { primary: true, quickbar: null },
      movement: { x: 0, y: 0 },
      viewportWidth: 1_600,
    },
  })
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const fire = state.primarySpells.projectiles.find(({ kind }) => kind === 'fire')
  assert.ok(fire)
  assert.equal(state.world.enemies.actors.length, openingCount)
  assert.deepEqual(
    state.world.enemies.actors.map(({ lightRegistration }) => lightRegistration),
    Array.from({ length: openingCount }, (_, index) => ({
      managerLane: 'actor' as const,
      registrationOrdinal: index + 2,
    })),
  )
  assert.deepEqual(fire.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: openingCount + 2,
  })
  assert.deepEqual(state.lightProviderOrder.nextRegistrationOrdinal, {
    actor: openingCount + 3,
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

test('Hub combat seal preserves movement and primary selection while rejecting every cast family', () => {
  const source = {
    aim: { x: 400, y: 300 },
    cast: { primary: true, quickbar: 0 },
    movement: { x: 1, y: -1 },
    viewportWidth: 1_600,
  }
  const weldIds = NATIVE_WELD_BUILDS.map(({ id }) => id)
  const belt = (skillId: NativeBeltSkillId) => freezeNativeBelt([
    { kind: 'skill', skillId }, null, null, null, null, null, null, null,
  ])
  assert.deepEqual(weldIds, [1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009])
  for (const skillId of [8, 16, 24, 32, 40, 52] as const) {
    assert.deepEqual(
      sealPlayerCombatInput(source, belt(skillId)),
      {
        aim: null,
        cast: { primary: false, quickbar: 0 },
        movement: { x: 1, y: -1 },
        viewportWidth: 1_600,
      },
      `primary ${skillId} crossed the Hub combat seal`,
    )
  }
  for (const buildId of weldIds) {
    assert.equal(
      sealPlayerCombatInput(source, belt(52)).cast.primary,
      false,
      `weld ${buildId} crossed the Hub combat seal`,
    )
  }
  for (const skillId of [57, 58, 59, 60, 61, 62, 63, 65, 66, 67, 68, 69, 70, 71] as const) {
    assert.deepEqual(
      sealPlayerCombatInput(source, belt(skillId)),
      {
        aim: null,
        cast: { primary: false, quickbar: 0 },
        movement: { x: 1, y: -1 },
        viewportWidth: 1_600,
      },
      `concentration ${skillId} did not cross the Hub selection seal`,
    )
  }
  for (const skillId of NATIVE_SECONDARY_ABILITY_IDS) {
    assert.deepEqual(
      sealPlayerCombatInput(source, belt(skillId)),
      {
        aim: null,
        cast: { primary: false, quickbar: null },
        movement: { x: 1, y: -1 },
        viewportWidth: 1_600,
      },
      `secondary ${skillId} crossed the Hub combat seal`,
    )
  }

  let state = createGameSimulation({ caster: {
    discipline: 'arcane',
    displayName: 'Hub Caster',
    element: 'fire',
  } })
  const before = getPlayerCharacter(state, 'caster')
  const manaBefore = getPlayerProgression(state, 'caster').currentMana
  state = stepGameSimulationTick(state, { caster: {
    aim: { x: before.position.x, y: before.position.y - 200 },
    cast: { primary: true, quickbar: null },
    movement: { x: 1, y: 0 },
    viewportWidth: 1_600,
  } })
  const after = getPlayerCharacter(state, 'caster')
  assert.ok(after.position.x > before.position.x)
  assert.equal(after.primaryCast.actionTick, -1)
  assert.equal(after.primaryCast.castSequence, 0)
  assert.equal(after.primaryCast.emissionSequence, 0)
  assert.equal(getPlayerProgression(state, 'caster').currentMana, manaBefore)
  assert.deepEqual(state.primarySpells, { nextId: 1, projectiles: [], transients: [] })
  assert.deepEqual(state.secondaryAbilities.actors, [])
  assert.deepEqual(state.secondaryAbilities.events, [])
})

test('the retail Solomon run edge admits primary and secondary combat on its own tick', () => {
  const loaded = emptyBoneyard()
  loaded.runId = 'solomon-combat-admission'
  loaded.scene.solomonDig = {
    frameProgram: [0, 3, 1],
    gravePosition: { x: 240, y: 390 },
    lanternPosition: { x: 245, y: 390 },
    position: { x: 250, y: 390 },
    ticksPerFrame: 5,
  }
  const entered = enterBoneyardWorld(createGameSimulation({ caster: {
    discipline: 'arcane',
    displayName: 'Combat Gate Caster',
    element: 'fire',
  } }), loaded)
  if (entered.world.kind !== 'boneyard' || entered.world.encounter === null) {
    throw new Error('expected the retail Solomon encounter')
  }
  const player = getPlayerCharacter(entered, 'caster')
  const prelude = {
    ...entered,
    world: {
      ...entered.world,
      encounter: {
        ...entered.world.encounter,
        acceleration: -1,
        motion: -1,
        phase: 'retreat-accelerating' as const,
      },
    },
  }
  const primaryInput = {
    caster: {
      aim: { x: player.position.x, y: player.position.y - 100 },
      cast: { primary: true, quickbar: null },
      movement: { x: 1, y: 0 },
      viewportWidth: 1_600,
    },
  }
  assert.equal(prelude.world.encounter.runEventId, 0)
  const blockedPrimary = stepGameSimulationTick(prelude, primaryInput)
  assert.equal(blockedPrimary.world.kind, 'boneyard')
  if (blockedPrimary.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(blockedPrimary.world.encounter?.runEventId, 0)
  assert.equal(blockedPrimary.world.encounter?.phase, 'retreat-accelerating')
  assert.equal(getPlayerCharacter(blockedPrimary, 'caster').primaryCast.castSequence, 0)
  assert.equal(blockedPrimary.primarySpells.projectiles.length, 0)
  assert.ok(getPlayerCharacter(blockedPrimary, 'caster').position.x > player.position.x)

  const blockedSecondary = stepGameSimulationTick(prelude, {
    caster: {
      aim: { x: player.position.x, y: player.position.y - 100 },
      cast: { primary: false, quickbar: 0 },
      movement: { x: 0, y: 0 },
      viewportWidth: 1_600,
    },
  })
  assert.equal(blockedSecondary.secondaryAbilities.players.caster?.castSequence, 0)
  assert.equal(blockedSecondary.secondaryAbilities.players.caster?.fizzleSequence, 0)
  assert.equal(getPlayerProgression(blockedSecondary, 'caster').currentMana, 100)

  const runEdge = {
    ...prelude,
    world: {
      ...prelude.world,
      encounter: {
        ...prelude.world.encounter,
        acceleration: 1,
        motion: 0,
      },
    },
  }
  const admittedPrimary = stepGameSimulationTick(runEdge, primaryInput)
  assert.equal(admittedPrimary.world.kind, 'boneyard')
  if (admittedPrimary.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(admittedPrimary.world.encounter?.runEventId, 1)
  assert.equal(getPlayerCharacter(admittedPrimary, 'caster').primaryCast.castSequence, 1)

  const admittedSecondary = stepGameSimulationTick(runEdge, {
    caster: {
      aim: { x: player.position.x, y: player.position.y - 100 },
      cast: { primary: false, quickbar: 0 },
      movement: { x: 0, y: 0 },
      viewportWidth: 1_600,
    },
  })
  assert.equal(admittedSecondary.world.kind, 'boneyard')
  if (admittedSecondary.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(admittedSecondary.world.encounter?.runEventId, 1)
  assert.equal(admittedSecondary.secondaryAbilities.players.caster?.castSequence, 1)
  assert.equal(admittedSecondary.secondaryAbilities.players.caster?.globalCooldownTicks, 150)
  assert.ok(getPlayerProgression(admittedSecondary, 'caster').currentMana < 100)
  const secondaryPulse = stepGameSimulationTick(admittedSecondary, {
    caster: gameplayInput(0, 0),
  })
  assert.equal(
    getPlayerCharacter(secondaryPulse, 'caster').primaryCast.weaponPulse,
    Math.fround(0.45),
  )
  assert.equal(
    createGameSnapshot(secondaryPulse, 'caster').players.caster!.lighting.overlayEffectPhase,
    Math.fround(0.45),
  )
})

test('Hub shortcut services are participant-private, global inside a settled Hub, and blocked in transition', () => {
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
  const firstEconomy = getPlayerEconomy(state, 'first')
  state = {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'first', {
      ...firstEconomy,
      gold: 10_000,
    }),
  }
  const firstStock = getPlayerEconomy(state, 'first').fomentiusStock[0]!
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
    unforgeOutcome: null,
  })
  assert.equal(getPlayerEconomy(purchased.state, 'second').gold, 500)
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
    unforgeOutcome: null,
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
        first: { collegeIntro: null, region: 'courtyard', transition },
      },
    },
  }
  assert.equal(applyGameSimulationHubAction(fading, 'first', {
    type: 'buy-fomentius',
    itemId: getPlayerEconomy(fading, 'first').fomentiusStock[0]!.id,
  }).reason, 'service-unavailable')
})

test('every stateful NPC and trader keeps authenticated player state isolated in the shared Hub', () => {
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
  const untouchedSecondEconomy = getPlayerEconomy(state, 'second')
  const untouchedSecondProgression = getPlayerProgression(state, 'second')
  const untouchedSecondSkillBook = getPlayerSkillBook(state, 'second')
  const firstEconomy = getPlayerEconomy(state, 'first')
  state = {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'first', {
      ...firstEconomy,
      gold: 100_000,
      revision: firstEconomy.revision + 1,
    }),
  }

  const applyFirst = (action: Parameters<typeof applyGameSimulationHubAction>[2]) => {
    const result = applyGameSimulationHubAction(state, 'first', action)
    assert.equal(result.accepted, true, `${action.type} was rejected`)
    state = result.state
    assert.strictEqual(getPlayerEconomy(state, 'second'), untouchedSecondEconomy)
    assert.strictEqual(getPlayerProgression(state, 'second'), untouchedSecondProgression)
    assert.strictEqual(getPlayerSkillBook(state, 'second'), untouchedSecondSkillBook)
  }

  applyFirst({ selector: 0, type: 'buy-hagatha' })
  applyFirst({
    itemId: getPlayerEconomy(state, 'first').fomentiusStock[0]!.id,
    type: 'buy-fomentius',
  })
  const storedItemId = getPlayerEconomy(state, 'first').backpack[0]!.id
  applyFirst({
    direction: 'to-storage',
    gesture: 'double-activation',
    itemId: storedItemId,
    type: 'transfer',
  })
  applyFirst({ boastId: 0, type: 'select-boast' })
  applyFirst({ bookId: 25, type: 'read-librarian-book' })
  applyFirst({ skillId: 72, type: 'buy-teacher-spell' })
  applyFirst({ type: 'dowse' })

  const mutatedFirst = getPlayerEconomy(state, 'first')
  assert.ok(mutatedFirst.ownedPerkSelectors.includes(0))
  assert.ok(mutatedFirst.storage.some(({ id }) => id === storedItemId))
  assert.equal(mutatedFirst.npc.boast.selected, 0)
  assert.equal(mutatedFirst.npc.librarianLaceRead, true)
  assert.ok(mutatedFirst.dowsingOffers.length >= 3)
  assert.deepEqual(
    getPlayerSkillBook(state, 'first').advancedUnlocks,
    [true, false, false, false, false, false, false, false],
  )

  assert.equal(untouchedSecondEconomy.gold, 500)
  assert.deepEqual(untouchedSecondEconomy.ownedPerkSelectors, [])
  assert.deepEqual(untouchedSecondEconomy.storage, [])
  assert.equal(untouchedSecondEconomy.npc.boast.selected, null)
  assert.equal(untouchedSecondEconomy.npc.librarianLaceRead, false)
  assert.deepEqual(untouchedSecondEconomy.dowsingOffers, [])
  assert.deepEqual(untouchedSecondSkillBook.advancedUnlocks, new Array<boolean>(8).fill(false))

  state = addPlayerCharacter(state, 'late', {
    discipline: 'body',
    displayName: 'Late',
    element: 'fire',
  })
  const lateEconomy = getPlayerEconomy(state, 'late')
  assert.equal(lateEconomy.gold, 500)
  assert.deepEqual(lateEconomy.ownedPerkSelectors, [])
  assert.deepEqual(lateEconomy.storage, [])
  assert.equal(lateEconomy.npc.boast.selected, null)
  assert.equal(lateEconomy.npc.librarianLaceRead, false)
  assert.deepEqual(lateEconomy.dowsingOffers, [])
  assert.deepEqual(
    getPlayerSkillBook(state, 'late').advancedUnlocks,
    new Array<boolean>(8).fill(false),
  )

  const firstSnapshot = createGameSnapshot(state, 'first')
  const secondSnapshot = createGameSnapshot(state, 'second')
  assert.equal(firstSnapshot.world.kind, 'hub')
  assert.equal(secondSnapshot.world.kind, 'hub')
  if (firstSnapshot.world.kind !== 'hub' || secondSnapshot.world.kind !== 'hub') {
    throw new Error('expected shared Hub snapshots')
  }
  assert.deepEqual(firstSnapshot.world.skorcha, secondSnapshot.world.skorcha)
  assert.deepEqual(
    firstSnapshot.players.first!.progression.advancedUnlocks,
    [true, false, false, false, false, false, false, false],
  )
  assert.deepEqual(
    secondSnapshot.players.second!.progression.advancedUnlocks,
    new Array<boolean>(8).fill(false),
  )
})

test('locked Goodies require an explicit nearest-facing interaction and consume one recursive Wizard Key', () => {
  let state = enterBoneyardWorld(createGameSimulation(), emptyBoneyard())
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  state = {
    ...state,
    playerEntities: replacePlayerCharacter(state.playerEntities, 'local-player', {
      ...getPlayerCharacter(state),
      headingIndex: 0,
      position: { x: 0, y: 0 },
    }),
    world: {
      ...state.world,
      loot: createBoneyardLootStore('explicit-goodie', [{
        eid: 'locked-goodie',
        position: { x: 0, y: -25 },
        rewardSeed: 0,
        subtype: 0,
      }]),
    },
  }

  const untouched = stepGameSimulationTick(state, {})
  assert.equal(untouched.world.kind, 'boneyard')
  if (untouched.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  assert.equal(untouched.world.loot.goodies[0]?.active, false)

  const missingKey = applyGameSimulationHubAction(untouched, 'local-player', {
    type: 'interact-goodie',
  })
  assert.equal(missingKey.accepted, false)
  assert.equal(missingKey.reason, 'item-not-found')
  assert.equal(
    missingKey.state.world.kind === 'boneyard'
      ? missingKey.state.world.lootEvents.at(-1)?.type
      : null,
    'goodie-key-needed',
  )

  const economy = getPlayerEconomy(missingKey.state)
  const key: HubInventoryItem = {
    ...economy.backpack[0]!,
    id: economy.nextItemId,
    iconRecords: [43],
    kind: 'key',
    name: 'Wizard Key',
    nativeSubtype: 1,
    nativeTypeId: 7012,
    quantity: 1,
  }
  state = {
    ...missingKey.state,
    playerEntities: replacePlayerEconomy(missingKey.state.playerEntities, 'local-player', {
      ...economy,
      backpack: [...economy.backpack, key],
      nextItemId: economy.nextItemId + 1,
      revision: economy.revision + 1,
    }),
  }
  const unlocked = applyGameSimulationHubAction(state, 'local-player', {
    type: 'interact-goodie',
  })
  assert.equal(unlocked.accepted, true)
  assert.equal(unlocked.reason, null)
  assert.equal(
    unlocked.state.world.kind === 'boneyard'
      ? unlocked.state.world.loot.goodies[0]?.active
      : false,
    true,
  )
  assert.equal(findInventoryItem(getPlayerEconomy(unlocked.state).backpack, key.id), null)
})

test('Hagatha purchase actions arm and consume their authoritative until-hurt effect', () => {
  let state = createGameSimulation({
    owner: {
      discipline: 'arcane',
      displayName: 'Hagatha Test',
      element: 'ether',
    },
  })
  const economy = getPlayerEconomy(state, 'owner')
  state = {
    ...state,
    playerEntities: replacePlayerCharacter(
      replacePlayerEconomy(state.playerEntities, 'owner', { ...economy, gold: 10_000 }),
      'owner',
      { ...getPlayerCharacter(state, 'owner'), position: { x: 1340, y: 280 } },
    ),
  }
  const purchased = applyGameSimulationHubAction(state, 'owner', {
    type: 'buy-hagatha',
    selector: 24,
  })
  assert.equal(purchased.accepted, true)
  assert.equal(
    playerSkillDerivedStatsAt(purchased.state.playerEntities, 'owner')?.offensiveDamageFactor,
    3,
  )
  const hurt = {
    ...purchased.state,
    playerEntities: damagePlayerEntity(purchased.state.playerEntities, 'owner', 1, 1),
  }
  assert.equal(playerSkillDerivedStatsAt(hurt.playerEntities, 'owner')?.offensiveDamageFactor, 1)
})

test('unforge is participant-owned and applies full rejuvenation plus Mind Dredge authoritatively', () => {
  const config = {
    discipline: 'arcane',
    displayName: 'Unforge',
    element: 'ether',
  } as const
  const buildState = (seed: number) => {
    let state = createGameSimulation({ player: config })
    const economy = getPlayerEconomy(state, 'player')
    const item = createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[0]!, 90_000)
    state = {
      ...state,
      playerEntities: replacePlayerEconomy(state.playerEntities, 'player', {
        ...economy,
        backpack: [item],
        rng: createNativeRng(seed),
        unforgeBonuses: { ...economy.unforgeBonuses, recipeAttemptCount: 8 },
      }),
    }
    return { item, state }
  }

  const rejuvenation = buildState(2)
  const playerIndex = rejuvenation.state.playerEntities.identities.findIndex(
    ({ playerId }) => playerId === 'player',
  )
  const progressions = [...rejuvenation.state.playerEntities.progressions]
  progressions[playerIndex] = {
    ...progressions[playerIndex]!,
    currentHealth: 1,
    currentMana: 2,
  }
  const secondaryPlayer = createNativeSecondaryPlayerState()
  const cooldowns = secondaryPlayer.cooldownTicksBySkill.map(() => 50)
  const armed: GameSimulationState = {
    ...rejuvenation.state,
    playerEntities: {
      ...rejuvenation.state.playerEntities,
      progressions: Object.freeze(progressions),
    },
    secondaryAbilities: {
      ...rejuvenation.state.secondaryAbilities,
      players: {
        ...rejuvenation.state.secondaryAbilities.players,
        player: {
          ...secondaryPlayer,
          cooldownTicksBySkill: Object.freeze(cooldowns),
          globalCooldownTicks: 25,
        },
      },
    },
  }
  const rejuvenated = applyGameSimulationHubAction(armed, 'player', {
    type: 'unforge',
    itemId: rejuvenation.item.id,
  })
  assert.equal(rejuvenated.accepted, true)
  assert.equal(getPlayerEconomy(rejuvenated.state, 'player').backpack.length, 0)
  assert.equal(getPlayerEconomy(rejuvenated.state, 'player').actionFeedback?.unforgeOutcome?.kind,
    'full-rejuvenation')
  assert.equal(getPlayerProgression(rejuvenated.state, 'player').currentHealth,
    getPlayerProgression(rejuvenated.state, 'player').maximumHealth)
  assert.equal(getPlayerProgression(rejuvenated.state, 'player').currentMana,
    getPlayerProgression(rejuvenated.state, 'player').maximumMana)
  assert.equal(rejuvenated.state.secondaryAbilities.players.player?.globalCooldownTicks, 0)
  assert.equal(rejuvenated.state.secondaryAbilities.players.player?.cooldownTicksBySkill[11], 0)
  assert.equal(rejuvenated.state.secondaryAbilities.players.player?.cooldownTicksBySkill[0], 50)

  const dredge = buildState(12)
  const deferredBefore = getPlayerProgression(dredge.state, 'player').deferredSkillChoices
  const granted = applyGameSimulationHubAction(dredge.state, 'player', {
    type: 'unforge',
    itemId: dredge.item.id,
  })
  assert.equal(getPlayerEconomy(granted.state, 'player').actionFeedback?.unforgeOutcome?.kind,
    'mind-dredge')
  assert.equal(getPlayerProgression(granted.state, 'player').deferredSkillChoices,
    deferredBefore + 1)
})

test('inventory double activation consumes one potion and applies its participant-owned effect', () => {
  let state = enterBoneyardWorld(createGameSimulation(), emptyBoneyard())
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const index = state.playerEntities.identities.findIndex(({ playerId }) => playerId === 'local-player')
  const progressions = [...state.playerEntities.progressions]
  progressions[index] = {
    ...progressions[index]!,
    currentHealth: 3,
  }
  state = {
    ...state,
    playerEntities: { ...state.playerEntities, progressions },
    world: {
      ...state.world,
      hallOfFameRuns: {
        'local-player': {
          ...state.world.hallOfFameRuns['local-player']!,
          killStreak: 203,
        },
      },
    },
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
  assert.equal(
    consumed.state.world.kind === 'boneyard'
      ? consumed.state.world.hallOfFameRuns['local-player']?.killStreak
      : null,
    0,
  )
})

test('native item belt binds shortcuts without moving ownership and activates exact item families', () => {
  let state = createGameSimulation()
  const economy = getPlayerEconomy(state)
  const ringRecipe = DOWSING_EQUIPMENT_RECIPES.find(({ type }) => type === 'ring')!
  const hatRecipe = DOWSING_EQUIPMENT_RECIPES.find(({ type }) => type === 'hat')!
  const ring = createEquipmentInventoryItem(ringRecipe, economy.nextItemId)
  const hat = createEquipmentInventoryItem(hatRecipe, economy.nextItemId + 1)
  const sack: HubInventoryItem = {
    contents: [ring, hat],
    equipmentType: null,
    iconRecords: [70],
    id: economy.nextItemId + 2,
    kind: 'sack',
    name: 'Belt action Sack',
    nativeSubtype: 0,
    nativeTypeId: 7008,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  const chug: HubInventoryItem = {
    ...economy.backpack[0]!,
    id: economy.nextItemId + 3,
    kind: 'wizard-chug',
    name: 'Wizard Chug',
    nativeSubtype: 2,
  }
  const misc: HubInventoryItem = {
    equipmentType: null,
    iconRecords: [43],
    id: economy.nextItemId + 4,
    kind: 'key',
    name: 'Wizard Key',
    nativeSubtype: 1,
    nativeTypeId: 7012,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  state = {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'local-player', {
      ...economy,
      backpack: [...economy.backpack, sack, chug, misc],
      nextItemId: economy.nextItemId + 5,
    }),
  }

  const boundRing = applyGameSimulationHubAction(state, 'local-player', {
    itemId: ring.id,
    slot: 2,
    type: 'bind-belt-item',
  })
  assert.equal(boundRing.accepted, true)
  assert.deepEqual(getPlayerBelt(boundRing.state)[2], {
    itemId: ring.id,
    kind: 'item',
    nativeTypeId: 7002,
  })
  assert.strictEqual(findInventoryItem(getPlayerEconomy(boundRing.state).backpack, ring.id), ring)
  const equippedRing = applyGameSimulationHubAction(boundRing.state, 'local-player', {
    slot: 2,
    type: 'activate-belt-slot',
  })
  assert.equal(equippedRing.accepted, true)
  assert.strictEqual(getPlayerEconomy(equippedRing.state).equipment.rings[0], ring)
  assert.deepEqual(getPlayerBelt(equippedRing.state)[2], {
    itemId: ring.id,
    kind: 'item',
    nativeTypeId: 7002,
  })

  const boundChug = applyGameSimulationHubAction(equippedRing.state, 'local-player', {
    itemId: chug.id,
    slot: 5,
    type: 'bind-belt-item',
  })
  assert.equal(boundChug.accepted, true)
  const consumed = applyGameSimulationHubAction(boundChug.state, 'local-player', {
    slot: 5,
    type: 'activate-belt-slot',
  })
  assert.equal(consumed.accepted, true)
  assert.equal(findInventoryItem(getPlayerEconomy(consumed.state).backpack, chug.id), null)
  assert.equal(getPlayerBelt(consumed.state)[5], null)

  const boundSack = applyGameSimulationHubAction(consumed.state, 'local-player', {
    itemId: sack.id,
    slot: 6,
    type: 'bind-belt-item',
  })
  assert.equal(boundSack.accepted, true)
  const activatedSack = applyGameSimulationHubAction(boundSack.state, 'local-player', {
    slot: 6,
    type: 'activate-belt-slot',
  })
  assert.equal(activatedSack.accepted, true)
  assert.strictEqual(getPlayerEconomy(activatedSack.state).equipment.hat, hat)
  assert.ok(findInventoryItem(getPlayerEconomy(activatedSack.state).backpack, sack.id))
  assert.deepEqual(getPlayerBelt(activatedSack.state)[6], {
    itemId: sack.id,
    kind: 'item',
    nativeTypeId: 7008,
  })

  const rejected = applyGameSimulationHubAction(activatedSack.state, 'local-player', {
    itemId: misc.id,
    slot: 7,
    type: 'bind-belt-item',
  })
  assert.equal(rejected.accepted, false)
  assert.equal(getPlayerBelt(rejected.state)[7], null)
})

test('simulation owns recursive sack moves, Fabric Dye commits, and nested potion effects', () => {
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
  const economy = getPlayerEconomy(state, 'first')
  const secondEconomy = getPlayerEconomy(state, 'second')
  const robeRecipe = DOWSING_EQUIPMENT_RECIPES.find(({ type }) => type === 'robe')!
  const target = createEquipmentInventoryItem(robeRecipe, economy.nextItemId)
  const dye: HubInventoryItem = {
    equipmentType: null,
    iconRecords: [42],
    id: economy.nextItemId + 1,
    kind: 'dye',
    name: 'Fabric Dye',
    nativeSubtype: 0,
    nativeTypeId: 7012,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  const health = {
    ...economy.backpack.find(({ kind }) => kind === 'health-potion')!,
    id: economy.nextItemId + 2,
  }
  const sourceSack: HubInventoryItem = {
    contents: [dye, health, target],
    equipmentType: null,
    iconRecords: [70],
    id: economy.nextItemId + 3,
    kind: 'sack',
    name: 'Source Sack',
    nativeSubtype: 0,
    nativeTypeId: 7008,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  const destinationSack: HubInventoryItem = {
    ...sourceSack,
    contents: [],
    id: economy.nextItemId + 4,
    name: 'Destination Sack',
  }
  const playerIndex = state.playerEntities.identities.findIndex(({ playerId }) => playerId === 'first')
  const progressions = [...state.playerEntities.progressions]
  progressions[playerIndex] = { ...progressions[playerIndex]!, currentHealth: 1 }
  state = {
    ...state,
    playerEntities: replacePlayerEconomy({
      ...state.playerEntities,
      progressions: Object.freeze(progressions),
    }, 'first', {
      ...economy,
      backpack: [sourceSack, destinationSack],
      nextItemId: economy.nextItemId + 5,
    }),
  }

  const moved = applyGameSimulationHubAction(state, 'first', {
    type: 'move-inventory-item',
    destinationSackId: destinationSack.id,
    itemId: target.id,
  })
  assert.equal(moved.accepted, true)
  assert.deepEqual(getPlayerEconomy(moved.state, 'first').actionFeedback, {
    accepted: true,
    action: 'move-inventory-item',
    dowsingPitch: null,
    reason: null,
    sequence: 1,
    transferDirection: null,
    transferGesture: null,
    unforgeOutcome: null,
  })
  assert.equal(
    findInventoryItem(getPlayerEconomy(moved.state, 'first').backpack, destinationSack.id)
      ?.contents?.some(({ id }) => id === target.id),
    true,
  )

  const dyed = applyGameSimulationHubAction(moved.state, 'first', {
    type: 'dye',
    dyeItemId: dye.id,
    layer: 'cloth',
    swatchRows: [1, 9],
    targetItemId: target.id,
  })
  assert.equal(dyed.accepted, true)
  const dyedEconomy = getPlayerEconomy(dyed.state, 'first')
  assert.equal(dyedEconomy.actionFeedback?.action, 'dye')
  assert.equal(dyedEconomy.actionFeedback?.sequence, 2)
  assert.equal(findInventoryItem(dyedEconomy.backpack, dye.id), null)
  assert.deepEqual(findInventoryItem(dyedEconomy.backpack, target.id)?.iconTints, [
    0x6d363e,
    robeRecipe.iconTints[1],
  ])

  const consumed = applyGameSimulationHubAction(dyed.state, 'first', {
    type: 'consume',
    itemId: health.id,
  })
  assert.equal(consumed.accepted, true)
  assert.equal(findInventoryItem(getPlayerEconomy(consumed.state, 'first').backpack, health.id), null)
  assert.equal(
    getPlayerProgression(consumed.state, 'first').currentHealth,
    getPlayerProgression(consumed.state, 'first').maximumHealth,
  )
  assert.strictEqual(getPlayerEconomy(consumed.state, 'second'), secondEconomy)
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

test('native Golem cooldown ticks map to 25 authoritative wall-clock seconds', () => {
  assert.equal(GAME_TICK_RATE, 100)
  assert.equal(NATIVE_SECONDARY_CONSTRUCTOR_COOLDOWN_TICKS[45], 2_500)
  assert.equal(NATIVE_SECONDARY_CONSTRUCTOR_COOLDOWN_TICKS[45] / GAME_TICK_RATE, 25)
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
  const beforeMilestoneRng = state.gameRng
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
  assert.deepEqual(state.gameRng, advanceNativeRngWords(beforeMilestoneRng, 6))

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

test('shared milestones keep More Missiles private to the participant who knows Magic Missile', () => {
  let state = createGameSimulation({
    air: { discipline: 'arcane', displayName: 'Air', element: 'air' },
    ether: { discipline: 'arcane', displayName: 'Ether', element: 'ether' },
  })
  const progressions = [...state.playerEntities.progressions]
  for (const playerId of ['air', 'ether']) {
    const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
    progressions[index] = {
      ...progressions[index]!,
      forcedOfferSkillIds: Object.freeze([10]),
    }
  }
  state = {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      progressions: Object.freeze(progressions),
    },
  }

  state = grantGameSimulationPlayerExperience(state, 'ether', 91)
  const airOffer = getPlayerProgression(state, 'air').pendingOffer
  const etherOffer = getPlayerProgression(state, 'ether').pendingOffer
  assert.ok(airOffer)
  assert.ok(etherOffer)
  assert.equal(airOffer.options.some(({ skillId }) => skillId === 10), false)
  const moreMissilesIndex = etherOffer.options.findIndex(({ skillId }) => skillId === 10)
  assert.notEqual(moreMissilesIndex, -1)

  assert.equal(selectGameSimulationPlayerSkill(state, 'air', {
    choiceIndex: moreMissilesIndex,
    offerSequence: etherOffer.sequence,
    skillId: 10,
  }), null)
  assert.equal(getPlayerSkillBook(state, 'air').permanentRanks[10], 0)
  assert.equal(getPlayerSkillBook(state, 'ether').permanentRanks[10], 0)

  const selected = selectGameSimulationPlayerSkill(state, 'ether', {
    choiceIndex: moreMissilesIndex,
    offerSequence: etherOffer.sequence,
    skillId: 10,
  })
  assert.ok(selected)
  assert.equal(getPlayerSkillBook(selected, 'air').permanentRanks[10], 0)
  assert.equal(getPlayerSkillBook(selected, 'ether').permanentRanks[10], 1)
  assert.deepEqual(selected.levelUpBarrier?.pendingPlayerIds, ['air'])
})

test('Mindblowing Ring triggers only for the credited source and retains its unstepped birth actors', () => {
  let state = createGameSimulation({
    first: { discipline: 'arcane', displayName: 'First', element: 'ether' },
    second: { discipline: 'mind', displayName: 'Second', element: 'fire' },
  })
  state = equipMindblowingRing(equipMindblowingRing(state, 'first'), 'second')
  const rng = state.secondaryAbilities.rng
  const actorLightOrdinal = state.lightProviderOrder.nextRegistrationOrdinal.actor
  state = grantGameSimulationPlayerExperience(state, 'first', 91)
  assert.equal(getPlayerProgression(state, 'first').level, 2)
  assert.equal(getPlayerProgression(state, 'second').level, 2)
  assert.deepEqual(state.secondaryAbilities.actors.map(({ ageTicks, kind, ownerId }) => ({
    ageTicks, kind, ownerId,
  })), [{
    ageTicks: 0,
    kind: 'mindblast-burst',
    ownerId: 'first',
  }, {
    ageTicks: 0,
    kind: 'mindblast-shockwave',
    ownerId: 'first',
  }])
  assert.equal(state.secondaryAbilities.actors[0]!.presentationRng, rng)
  assert.deepEqual(state.secondaryAbilities.rng, advanceNativeRngWords(rng, 502))
  assert.equal(
    state.lightProviderOrder.nextRegistrationOrdinal.actor,
    actorLightOrdinal + 1,
  )
})

test('Ether Mindblast applies strict radius-495 level damage before retaining Boneyard feedback', () => {
  const loaded = combatBoneyard('mindblast-run')
  let state = enterBoneyardWorld(createGameSimulation({ caster: {
    discipline: 'arcane',
    displayName: 'Mindblast Caster',
    element: 'ether',
  } }), loaded)
  state = equipMindblowingRing(state, 'caster')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const player = getPlayerCharacter(state, 'caster')
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    firstProjectileWorldContact: () => null,
    players: {},
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [1, 2].map((id) => ({
      enemyToken: 'SKELETON' as const,
      flags: [],
      id,
      locationPolicy: 'anywhere' as const,
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: player.position,
      spawnTick: 0,
      waveOrdinal: id,
    })),
    tick: 0,
  }).store
  const radius = seeded.actors[0]!.config.collisionRadius
  const strictBoundary = Math.sqrt(495 * 495 + radius * radius)
  const enemies = {
    ...seeded,
    actors: seeded.actors.map((actor, index) => ({
      ...actor,
      currentHealth: 100,
      nextMovementTick: Number.MAX_SAFE_INTEGER,
      position: {
        x: player.position.x + strictBoundary - (index === 0 ? 0.001 : 0),
        y: player.position.y,
      },
    })),
  }
  state = { ...state, world: { ...state.world, enemies } }
  state = grantGameSimulationPlayerExperience(state, 'caster', 91)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  assert.equal(state.world.enemies.actors[0]!.currentHealth, 99)
  assert.equal(state.world.enemies.actors[1]!.currentHealth, 100)
  assert.ok(state.world.enemyEvents.some(({ type }) => type === 'enemy-damage-sound'))
  assert.deepEqual(state.secondaryAbilities.actors.map(({ ageTicks, kind }) => ({
    ageTicks, kind,
  })), [{ ageTicks: 0, kind: 'mindblast-burst' }, {
    ageTicks: 0,
    kind: 'mindblast-shockwave',
  }])
})

test('a death reward consumes Mindblast RNG in reward order without advancing its newborn actors', () => {
  let state = enterBoneyardWorld(createGameSimulation({ caster: {
    discipline: 'arcane',
    displayName: 'Reward Caster',
    element: 'ether',
  } }), combatBoneyard('mindblast-reward-run'))
  state = equipMindblowingRing(state, 'caster')
  state = grantGameSimulationPlayerExperience(state, 'caster', 90)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const player = getPlayerCharacter(state, 'caster')
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    firstProjectileWorldContact: () => null,
    players: {},
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
  }).store
  const killed = damageBoneyardEnemy(seeded, {
    actorId: seeded.actors[0]!.id,
    amount: 1_000,
    sourcePlayerId: 'caster',
    tick: state.tick,
  })
  state = {
    ...state,
    world: { ...state.world, enemies: killed.store, enemyEvents: killed.events },
  }
  state = stepGameSimulationTick(state, { caster: gameplayInput(0, 0) })
  assert.equal(getPlayerProgression(state, 'caster').level, 2)
  assert.deepEqual(state.secondaryAbilities.actors.map(({ ageTicks, kind }) => ({
    ageTicks, kind,
  })), [{ ageTicks: 0, kind: 'mindblast-burst' }, {
    ageTicks: 0,
    kind: 'mindblast-shockwave',
  }])
})

test('same-tick world and reward-triggered damage events retain authoritative ID order', () => {
  let state = enterBoneyardWorld(createGameSimulation({ caster: {
    discipline: 'arcane',
    displayName: 'Ordered Event Caster',
    element: 'ether',
  } }), combatBoneyard('ordered-event-run'))
  state = equipMindblowingRing(state, 'caster')
  state = grantGameSimulationPlayerExperience(state, 'caster', 90)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const player = getPlayerCharacter(state, 'caster')
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    firstProjectileWorldContact: () => null,
    players: {},
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [1, 2].map((id) => ({
      enemyToken: 'SKELETON' as const,
      flags: [],
      id,
      locationPolicy: 'anywhere' as const,
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x: player.position.x + id * 100, y: player.position.y },
      spawnTick: 0,
      waveOrdinal: 1,
    })),
    tick: 0,
  }).store
  const killed = damageBoneyardEnemy({
    ...seeded,
    actors: seeded.actors.map((actor) => ({
      ...actor,
      currentHealth: actor.id === 1 ? actor.currentHealth : 100,
      nextMovementTick: Number.MAX_SAFE_INTEGER,
    })),
  }, {
    actorId: 1,
    amount: 1_000,
    sourcePlayerId: 'caster',
    tick: state.tick,
  })
  state = {
    ...state,
    world: { ...state.world, enemies: killed.store, enemyEvents: killed.events },
  }

  state = stepGameSimulationTick(state, { caster: gameplayInput(0, 0) })

  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const eventIds = state.world.enemyEvents.map(({ eventId }) => eventId)
  assert.ok(
    eventIds.every((eventId, index) => index === 0 || eventId > eventIds[index - 1]!),
    `enemy event IDs are not increasing: ${eventIds.join(',')}`,
  )
  assert.ok(state.world.enemyEvents.some(({ actorId, type }) => (
    actorId === 2 && type === 'enemy-damage-sound'
  )))
})

test('Boneyard enemy event retention rejects duplicate authoritative identity', () => {
  let state = enterBoneyardWorld(
    createGameSimulation(),
    combatBoneyard('duplicate-event-run'),
  )
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const duplicated = {
    actorId: 1,
    eventId: 1,
    tick: state.tick,
    type: 'enemy-death' as const,
  }
  state = {
    ...state,
    world: {
      ...state.world,
      enemies: { ...state.world.enemies, nextEventId: 2 },
      enemyEvents: [duplicated, { ...duplicated, actorId: 2 }],
    },
  }

  assert.throws(
    () => stepGameSimulationTick(state, {}),
    /duplicate Boneyard enemy event ID 1/,
  )
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

test('active-run rejoin imports one durable actor and queues every missed personal choice', () => {
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
  const loaded = combatBoneyard('rejoin-run')
  let together = enterBoneyardWorld(createGameSimulation({ first, second }), loaded)
  const retainedEconomy = getPlayerEconomy(together, 'second')
  const retainedBook = getPlayerSkillBook(together, 'second')
  const retainedHall = together.world.kind === 'boneyard'
    ? together.world.hallOfFameRuns.second
    : null
  const detached = detachGameSimulationPlayer(together, 'second')
  together = removePlayerCharacter(together, 'second')

  together = grantGameSimulationPlayerExperience(together, 'first', 300)
  const milestone = together.levelUpBarrier
  assert.ok(milestone)
  while (getPlayerProgression(together, 'first').pendingOffer) {
    const offer = getPlayerProgression(together, 'first').pendingOffer!
    together = selectGameSimulationPlayerSkill(together, 'first', {
      choiceIndex: 0,
      offerSequence: offer.sequence,
      skillId: offer.options[0]!.skillId,
    })!
  }
  assert.equal(together.levelUpBarrier, null)
  const worldBefore = together.world
  const tickBefore = together.tick
  const rngBeforeRejoin = together.gameRng

  together = rejoinGameSimulationPlayer(together, detached, 'second', {
    crossedLevels: milestone.participantIds.includes('second')
      ? []
      : [2, 3, 4],
    experience: milestone.milestoneExperience,
    level: milestone.milestoneLevel,
  })

  assert.equal(together.world.kind, 'boneyard')
  if (together.world.kind !== 'boneyard') assert.fail('expected Boneyard')
  assert.equal(together.world.enemies, worldBefore.kind === 'boneyard' ? worldBefore.enemies : null)
  assert.deepEqual(together.world.hallOfFameRuns.second, retainedHall)
  assert.deepEqual(getPlayerEconomy(together, 'second'), retainedEconomy)
  assert.deepEqual(getPlayerSkillBook(together, 'second'), retainedBook)
  assert.deepEqual(getPlayerCharacter(together, 'second').position, {
    x: loaded.scene.spawn.x,
    y: loaded.scene.spawn.y,
  })
  assert.deepEqual(getPlayerCharacter(together, 'second').velocity, { x: 0, y: 0 })
  assert.equal(
    getPlayerCharacter(together, 'second').primaryCast.selectedPrimaryId,
    retainedBook.primarySkillId,
  )
  assert.equal(getPlayerProgression(together, 'second').level, 4)
  assert.equal(getPlayerProgression(together, 'second').pendingLevels.length, 3)
  assert.deepEqual(together.gameRng, advanceNativeRngWords(rngBeforeRejoin, 3))
  assert.deepEqual(together.levelUpBarrier?.participantIds, ['first', 'second'])
  assert.deepEqual(together.levelUpBarrier?.pendingPlayerIds, ['second'])
  assert.equal(stepGameSimulationTick(together, {}).tick, tickBefore)

  let choices = 0
  while (getPlayerProgression(together, 'second').pendingOffer) {
    const offer = getPlayerProgression(together, 'second').pendingOffer!
    together = selectGameSimulationPlayerSkill(together, 'second', {
      choiceIndex: 0,
      offerSequence: offer.sequence,
      skillId: offer.options[0]!.skillId,
    })!
    choices += 1
  }
  assert.equal(choices, 3)
  assert.equal(together.levelUpBarrier, null)
  assert.equal(stepGameSimulationTick(together, {}).tick, tickBefore + 1)
})

test('detached catch-up stacks live milestones without joining or pausing the run', () => {
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
  let live = enterBoneyardWorld(
    createGameSimulation({ first, second }, { gameRngSeed: 73 }),
    combatBoneyard('detached-catch-up'),
  )
  let detached = detachGameSimulationPlayer(live, 'second')
  live = removePlayerCharacter(live, 'second')

  live = grantGameSimulationPlayerExperience(live, 'first', 300)
  const firstMilestone = live.levelUpBarrier
  assert.ok(firstMilestone)
  while (getPlayerProgression(live, 'first').pendingOffer) {
    const offer = getPlayerProgression(live, 'first').pendingOffer!
    live = selectGameSimulationPlayerSkill(live, 'first', {
      choiceIndex: 0,
      offerSequence: offer.sequence,
      skillId: offer.options[0]!.skillId,
    })!
  }
  assert.equal(live.levelUpBarrier, null)

  const staged = synchronizeDetachedGameSimulationPlayer(live, detached, {
    crossedLevels: [2, 3, 4],
    experience: firstMilestone.milestoneExperience,
    level: firstMilestone.milestoneLevel,
  })
  live = staged.state
  detached = staged.detached
  assert.equal(live.playerEntities.identities.some(({ playerId }) => playerId === 'second'), false)
  assert.equal(live.levelUpBarrier, null)
  assert.equal(detached.playerEntities.progressions[0]?.pendingLevels.length, 3)
  const tickBefore = live.tick
  live = stepGameSimulationTick(live, {})
  assert.equal(live.tick, tickBefore + 1)

  const firstOffer = detached.playerEntities.progressions[0]?.pendingOffer
  assert.ok(firstOffer)
  const selected = selectDetachedGameSimulationPlayerSkill(live, detached, {
    choiceIndex: 0,
    offerSequence: firstOffer.sequence,
    skillId: firstOffer.options[0]!.skillId,
  })
  assert.ok(selected)
  live = selected.state
  detached = selected.detached
  assert.equal(detached.playerEntities.progressions[0]?.pendingLevels.length, 2)
  assert.equal(live.levelUpBarrier, null)

  live = grantGameSimulationPlayerExperience(live, 'first', 1_000)
  const stackedMilestone = live.levelUpBarrier
  assert.ok(stackedMilestone)
  while (getPlayerProgression(live, 'first').pendingOffer) {
    const offer = getPlayerProgression(live, 'first').pendingOffer!
    live = selectGameSimulationPlayerSkill(live, 'first', {
      choiceIndex: 0,
      offerSequence: offer.sequence,
      skillId: offer.options[0]!.skillId,
    })!
  }
  const pendingBeforeStack = detached.playerEntities.progressions[0]!.pendingLevels.length
  const stacked = synchronizeDetachedGameSimulationPlayer(live, detached, {
    crossedLevels: Array.from(
      { length: stackedMilestone.milestoneLevel - 4 },
      (_, index) => index + 5,
    ),
    experience: stackedMilestone.milestoneExperience,
    level: stackedMilestone.milestoneLevel,
  })
  live = stacked.state
  detached = stacked.detached
  assert.equal(
    detached.playerEntities.progressions[0]!.pendingLevels.length,
    pendingBeforeStack + stackedMilestone.milestoneLevel - 4,
  )
  assert.equal(live.levelUpBarrier, null)
  assert.equal(stepGameSimulationTick(live, {}).tick, live.tick + 1)

  while (detached.playerEntities.progressions[0]?.pendingOffer) {
    const offer = detached.playerEntities.progressions[0]!.pendingOffer!
    const choice = selectDetachedGameSimulationPlayerSkill(live, detached, {
      choiceIndex: 0,
      offerSequence: offer.sequence,
      skillId: offer.options[0]!.skillId,
    })
    assert.ok(choice)
    live = choice.state
    detached = choice.detached
  }
  live = rejoinGameSimulationPlayer(live, detached, 'second', null)
  assert.equal(live.levelUpBarrier, null)
  assert.equal(live.playerEntities.identities.some(({ playerId }) => playerId === 'second'), true)
})

test('Sorceror actions are authoritative, consume the active offer, and preserve saved choices', () => {
  let state = createGameSimulation({ first: {
    discipline: 'arcane',
    displayName: 'First',
    element: 'ether',
  } }, { gameRngSeed: 73 })
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
  assert.deepEqual(state.gameRng, advanceNativeRngWords(initial.gameRng, 4))
  assert.equal(
    rerollGameSimulationPlayerSkill(state, 'first', rerolled.pendingOffer!.sequence),
    null,
  )

  const saved = saveGameSimulationPlayerSkill(initial, 'first', firstOffer.sequence)!
  const savedProgression = getPlayerProgression(saved, 'first')
  assert.deepEqual(saved.gameRng, advanceNativeRngWords(initial.gameRng, 3))
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
  let state = enterBoneyardWorld(createGameSimulation({ caster: earth }), emptyBoneyard())
  const cast = (primary: boolean) => ({
    aim: {
      x: getPlayerCharacter(state, 'caster').position.x,
      y: getPlayerCharacter(state, 'caster').position.y - 200,
    },
    cast: { primary, quickbar: null },
    movement: { x: 0, y: 0 },
    viewportWidth: 1_600,
  })
  state = stepGameSimulationTick(state, { caster: cast(true) })
  assert.equal(state.primarySpells.projectiles.length, 1)
  assert.equal(getPlayerCharacter(state, 'caster').primaryCast.channelActive, true)
  state = removePlayerCharacter(state, 'caster')
  assert.deepEqual(state.primarySpells.projectiles, [])

  state = enterBoneyardWorld(
    createGameSimulation({ caster: { ...earth, element: 'fire' } }),
    emptyBoneyard(),
  )
  for (let tick = 0; tick < 20; tick += 1) {
    state = stepGameSimulationTick(state, { caster: cast(true) })
  }
  assert.equal(state.primarySpells.projectiles.length, 1)
  state = returnGameSimulationToHub(state)
  assert.deepEqual(state.primarySpells, { nextId: 1, projectiles: [], transients: [] })
  assert.equal(getPlayerCharacter(state, 'caster').primaryCast.actionTick, -1)
  assert.equal(getPlayerCharacter(state, 'caster').primaryCast.channelActive, false)
})

test('Hub-to-Boneyard entry preserves both selected concentrations and replacement order', () => {
  let state = createGameSimulation()
  for (const skillId of [57, 58]) {
    state = withPlayerSkillRank(state, 'local-player', skillId, 1)
  }
  state = {
    ...state,
    playerEntities: replacePlayerEconomy(
      state.playerEntities,
      'local-player',
      {
        ...getPlayerEconomy(state),
        ownedPerkSelectors: [21],
      },
    ),
  }
  let playerEntities = selectPlayerEntityConcentration(
    state.playerEntities,
    'local-player',
    57,
  )
  playerEntities = selectPlayerEntityConcentration(playerEntities, 'local-player', 58)
  const selected = playerSkillRuntimeAt(playerEntities, 'local-player')!
  assert.deepEqual([
    selected.concentrationSkillIdA,
    selected.concentrationSkillIdB,
    selected.nextConcentrationReplacementSlot,
  ], [57, 58, 'a'])

  const entered = enterBoneyardWorld({ ...state, playerEntities }, emptyBoneyard())
  const carried = playerSkillRuntimeAt(entered.playerEntities, 'local-player')!
  assert.deepEqual([
    carried.concentrationSkillIdA,
    carried.concentrationSkillIdB,
    carried.nextConcentrationReplacementSlot,
  ], [57, 58, 'a'])
})

test('authoritative primary edges write one shared orb and light phase before decay', () => {
  const water = {
    discipline: 'arcane',
    displayName: 'Water Caster',
    element: 'water',
  } as const
  let state = enterBoneyardWorld(createGameSimulation({ caster: water }), emptyBoneyard())
  const cast = (primary: boolean) => {
    const player = getPlayerCharacter(state, 'caster')
    return {
      aim: { x: player.position.x, y: player.position.y - 200 },
      cast: { primary, quickbar: null },
      movement: { x: 0, y: 0 },
      viewportWidth: 1_600,
    }
  }
  state = stepGameSimulationTick(state, { caster: cast(true) })
  const activePhase = NATIVE_PLAYER_STAFF_CONSTANT_OVERLAY
  assert.equal(getPlayerCharacter(state, 'caster').primaryCast.weaponPulse, activePhase)
  assert.equal(playerLightingAt(state.playerEntities, 'caster')?.overlayEffectPhase, 0)
  assert.equal(
    createGameSnapshot(state, 'caster').players.caster!.lighting.overlayEffectPhase,
    activePhase,
  )

  state = stepGameSimulationTick(state, { caster: cast(false) })
  const decayedPhase = Math.fround(activePhase * NATIVE_PLAYER_LIGHT_OVERLAY_DECAY)
  assert.equal(
    getPlayerCharacter(state, 'caster').primaryCast.weaponPulse,
    decayedPhase,
  )
  assert.equal(
    createGameSnapshot(state, 'caster').players.caster!.lighting.overlayEffectPhase,
    decayedPhase,
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
    cast: { primary: true, quickbar: null },
    movement: { x: 0, y: 0 },
    viewportWidth: 1_600,
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
  if (
    state.world.kind !== 'boneyard'
    || state.world.arenaTransition === null
    || state.world.encounter === null
  ) {
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
      encounter: { ...state.world.encounter, phase: 'gone', runEventId: 1 },
    },
  }

  state = stepGameSimulationTick(state, { caster: {
    aim: { x: 250, y: 0 },
    cast: { primary: true, quickbar: null },
    movement: { x: 0, y: 0 },
    viewportWidth: 1_600,
  } })

  const bolt = state.primarySpells.transients[0]
  assert.equal(bolt.kind, 'air')
  assert.ok(bolt.endpoint.y >= 375, `Air escaped retired boundary: ${bolt.endpoint.y}`)
})

test('booked primary ranks feed new casts while existing projectile payloads stay immutable', () => {
  const fire = {
    discipline: 'arcane',
    displayName: 'Fire Caster',
    element: 'fire',
  } as const
  let rankOne = enterBoneyardWorld(createGameSimulation({ caster: fire }), emptyBoneyard())
  let rankTwo = withEffectivePrimaryRank(
    enterBoneyardWorld(createGameSimulation({ caster: fire }), emptyBoneyard()),
    'caster',
    2,
  )
  const cast = (state: GameSimulationState, primary: boolean) => {
    const player = getPlayerCharacter(state, 'caster')
    return {
      aim: { x: player.position.x, y: player.position.y - 200 },
      cast: { primary, quickbar: null },
      movement: { x: 0, y: 0 },
      viewportWidth: 1_600,
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

test('Battle and Siege factors reach the authoritative primary payment and birth once', () => {
  const fire = {
    discipline: 'mind',
    displayName: 'Mind Fire Caster',
    element: 'fire',
  } as const
  let baseline = enterBoneyardWorld(createGameSimulation({ caster: fire }), emptyBoneyard())
  let passive = enterBoneyardWorld(
    withPassiveRanks(createGameSimulation({ caster: fire }), 'caster', {
      59: 1,
      61: 1,
    }),
    emptyBoneyard(),
  )
  const input = (state: GameSimulationState) => {
    const player = getPlayerCharacter(state, 'caster')
    return {
      aim: { x: player.position.x, y: player.position.y - 200 },
      cast: { primary: true, quickbar: null },
      movement: { x: 0, y: 0 },
      viewportWidth: 1_600,
    }
  }
  for (let tick = 0; tick <= PRIMARY_CAST_EMISSION_TICK; tick += 1) {
    baseline = stepGameSimulationTick(baseline, { caster: input(baseline) })
    passive = stepGameSimulationTick(passive, { caster: input(passive) })
  }
  assert.ok(Math.abs(passive.primarySpells.projectiles[0]!.damage - 4.8) < 1e-12)
  assert.equal(Number((
    getPlayerProgression(passive, 'caster').currentMana
      - getPlayerProgression(baseline, 'caster').currentMana
  ).toFixed(6)), 1.2)
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
  state = {
    ...state,
    world: {
      ...state.world,
      enemies: seeded.store,
      enemyWorldFeedback: { accumulator: 0.6, magnitude: 0 },
    },
  }

  const cast = (primary: boolean) => ({
    aim: { x: 250, y: 0 },
    cast: { primary, quickbar: null },
    movement: { x: 0, y: 0 },
    viewportWidth: 1_600,
  })
  const initialMana = getPlayerProgression(state, 'caster').currentMana
  const initialExperience = getPlayerProgression(state, 'caster').experience
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
  const hallRun = state.world.hallOfFameRuns.caster!
  assert.equal(hallRun.monstersKilled, 1)
  assert.equal(hallRun.awesomestKill, 'Skeleton')
  assert.ok(hallRun.awesomeness >= 72 && hallRun.awesomeness <= 76)
  assert.equal(getPlayerProgression(state, 'caster').experience, initialExperience)
  assert.ok(state.world.enemyEvents.some((event) => (
    event.type === 'enemy-damage-sound' && event.sound === 'bone-crack'
  )))
  assert.deepEqual(state.primarySpells.projectiles, [])

  state = stepGameSimulationTick(state, { caster: cast(false) })
  assert.equal(getPlayerProgression(state, 'caster').experience - initialExperience, 4.25)
  const experienceAfterReward = getPlayerProgression(state, 'caster').experience
  state = stepGameSimulationTick(state, { caster: cast(false) })
  assert.equal(
    getPlayerProgression(state, 'caster').experience,
    experienceAfterReward,
  )
})

test('Boneyard simulation owns automatic Staff action, contact damage, and retained audio edge', () => {
  const loaded = combatBoneyard('staff-combat-run')
  loaded.scene.spawn.facingDeg = 0
  let state = enterBoneyardWorld(createGameSimulation({ caster: {
    discipline: 'body',
    displayName: 'Staff Caster',
    element: 'air',
  } }), loaded)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const player = getPlayerCharacter(state, 'caster')
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    firstProjectileWorldContact: () => null,
    players: {},
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'SKELETON',
      flags: [],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x: player.position.x, y: player.position.y - 45 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  const enemy = seeded.store.actors[0]!
  state = {
    ...state,
    world: {
      ...state.world,
      enemies: {
        ...seeded.store,
        actors: [{
          ...enemy,
          currentHealth: 1_000,
          nextMovementTick: Number.MAX_SAFE_INTEGER,
          position: {
            x: player.position.x,
            y: player.position.y - (25 + enemy.config.collisionRadius + 12),
          },
        }],
      },
    },
  }
  const initialMana = getPlayerProgression(state, 'caster').currentMana
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const initialHealth = state.world.enemies.actors[0]!.currentHealth
  for (let tick = 0; tick < 100; tick += 1) {
    state = stepGameSimulationTick(state, { caster: gameplayInput(0, -1) })
    if (state.primarySpells.transients.some(({ kind }) => kind === 'player-staff-melee')) break
  }
  const firstAction = state.primarySpells.transients.find(({ kind }) => (
    kind === 'player-staff-melee'
  ))
  assert.ok(firstAction && firstAction.kind === 'player-staff-melee')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const actionPosition = getPlayerCharacter(state, 'caster').position
  const settledEnemy = state.world.enemies.actors[0]!
  const actionDistance = Math.hypot(
    settledEnemy.position.x - actionPosition.x,
    settledEnemy.position.y - actionPosition.y,
  )
  const legalContactDistance = 25
    + settledEnemy.config.collisionRadius
    + NATIVE_ACTOR_SEPARATION_EPSILON
  assert.ok(
    actionDistance <= legalContactDistance + 0.0001,
    `Staff action began outside contact clearance (${actionDistance} > ${legalContactDistance})`,
  )
  for (let tick = 1; tick < 100; tick += 1) {
    state = stepGameSimulationTick(state, { caster: gameplayInput(0, -1) })
    if (state.primarySpells.transients.some(({ kind }) => kind === 'player-staff-contact')) {
      break
    }
  }
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const contact = state.primarySpells.transients.find(({ kind }) => (
    kind === 'player-staff-contact'
  ))
  assert.ok(contact && contact.kind === 'player-staff-contact')
  assert.equal(state.world.enemies.actors[0]!.currentHealth, initialHealth - 1)
  assert.equal(getPlayerProgression(state, 'caster').currentMana, initialMana)
  assert.ok(state.world.enemyEvents.some((event) => (
    event.type === 'enemy-damage-sound' && event.sound === 'bone-crack'
  )))

  for (let tick = 0; tick < 100; tick += 1) {
    state = stepGameSimulationTick(state, { caster: gameplayInput(0, 0) })
    if (!state.primarySpells.transients.some(({ id }) => id === firstAction.id)) break
  }
  state = stepGameSimulationTick(state, { caster: gameplayInput(0, 0) })
  assert.equal(state.primarySpells.transients.some((transient) => (
    transient.kind === 'player-staff-melee' && transient.id !== firstAction.id
  )), false)

  state = stepGameSimulationTick(state, { caster: gameplayInput(0, -1) })
  assert.equal(state.primarySpells.transients.some((transient) => (
    transient.kind === 'player-staff-melee' && transient.id !== firstAction.id
  )), true)
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
        burnDamage: 0,
        charge: 1,
        damage: 4,
        direction: { x: 1, y: 0 },
        emberDamage: 0,
        emberFragments: 0,
        explodeDamage: 0,
        explodeRadius: 0,
        flightTicks: 5,
        id: 1,
        kind: 'fire',
        lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
        ownerId: 'caster',
        phase: 'flight',
        position: { x: 50, y: 250 },
        privateSeed: 0,
        spentEmber: { kind: 'none' },
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

test('Deflect cancels the contact, faces and sounds once, and reflects concentrated physical damage', () => {
  const deflectSeed = seedForIntegerDraw(100, (value) => value < 10)
  const chance = drawNativeInteger(createNativeRng(deflectSeed), 100)
  const swipe = drawNativeFloat(chance.state, 1, true)
  let state = enterBoneyardWorld(
    createGameSimulation(),
    combatBoneyard('deflect-combat-run'),
  )
  state = withConcentratedDeflect(state, 'local-player')
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
      flags: [],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.ZOMBIE,
      position: { x: player.position.x + 40, y: player.position.y },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  state = {
    ...state,
    secondaryAbilities: { ...state.secondaryAbilities, rng: createNativeRng(deflectSeed) },
    world: { ...state.world, enemies: seeded.store },
  }

  let deflectEvent: BoneyardEnemySemanticEvent | undefined
  for (let tick = 0; tick < 300 && deflectEvent === undefined; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
    deflectEvent = state.world.enemyEvents.find((event) => event.deflectPitch !== undefined)
  }

  assert.ok(deflectEvent)
  assert.equal(deflectEvent.type, 'attack-marker')
  assert.equal(deflectEvent.targetPlayerId, 'local-player')
  assert.equal(deflectEvent.deflectPitch, Math.fround(1 + swipe.value))
  assert.equal(getPlayerProgression(state).currentHealth, 50)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const source = state.world.enemies.actors.find(({ id }) => id === 1)
  assert.ok(source)
  assert.equal(
    source.currentHealth,
    source.config.maximumHealth - source.config.primaryDamage! * 5,
  )
  const publishedPlayer = getPlayerCharacter(state)
  assert.equal(publishedPlayer.headingIndex, actorHeadingIndex(actorHeadingFromVector(
    source.position.x - publishedPlayer.position.x,
    source.position.y - publishedPlayer.position.y,
  )))
})

test('Flash responds before damage with area Dazzle, twelve children, feedback, and stock audio', () => {
  let state = enterBoneyardWorld(
    createGameSimulation(),
    combatBoneyard('flash-response-run'),
  )
  state = withPlayerSkillRank(state, 'local-player', 53, 1)
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
      flags: [],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.ZOMBIE,
      position: { x: player.position.x + 40, y: player.position.y },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  state = {
    ...state,
    secondaryAbilities: { ...state.secondaryAbilities, rng: createNativeRng(15) },
    world: { ...state.world, enemies: seeded.store },
  }

  let flashEvent = state.secondaryAbilities.events.find(({ skillId }) => skillId === 53)
  for (let tick = 0; tick < 300 && flashEvent === undefined; tick += 1) {
    state = stepGameSimulationTick(state, {})
    flashEvent = state.secondaryAbilities.events.find(({ skillId }) => skillId === 53)
  }
  assert.ok(flashEvent)
  assert.equal(flashEvent.cue, 'flash-spell')
  assert.equal(flashEvent.kind, 'impact')
  assert.ok(flashEvent.pitch >= 1 && flashEvent.pitch <= 1.2)
  assert.ok(flashEvent.cameraDisplacement)
  assert.ok(Math.abs(Math.hypot(
    flashEvent.cameraDisplacement.x,
    flashEvent.cameraDisplacement.y,
  ) - 3) < 1e-5)
  assert.deepEqual(flashEvent.screenFlash, {
    alpha: 1,
    blue: 1,
    decayPerTick: Math.fround(0.05),
    green: 1,
    pointAttenuated: true,
    red: 1,
  })
  assert.equal(
    state.secondaryAbilities.actors.filter(({ kind }) => kind === 'flash-response-grow').length,
    8,
  )
  assert.equal(
    state.secondaryAbilities.actors.filter(({ kind }) => kind === 'flash-response-fade').length,
    4,
  )
  const effect = state.secondaryAbilities.targetEffects.find(({ targetId }) => targetId === 1)
  assert.ok(effect)
  assert.ok(effect.dazzleTicks >= 399 && effect.dazzleTicks <= 400)
  assert.ok(getPlayerProgression(state).currentHealth < 50, 'Flash does not block the strike')
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

test('Telekinesis reaches the authoritative Orb pull consumer through dense player state', () => {
  const config = {
    discipline: 'body',
    displayName: 'Telekinetic',
    element: 'air',
  } as const
  const fixture = (rank: number) => {
    let state = enterBoneyardWorld(
      createGameSimulation({ caster: config }),
      combatBoneyard(`telekinesis-${rank}`),
    )
    state = withPlayerSkillRank(state, 'caster', 66, rank)
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
    const player = getPlayerCharacter(state, 'caster')
    const spawned = spawnBoneyardLootSpecs(state.world.loot, [{
      activationDelayTicks: 0,
      id: 1,
      kind: 'orb',
      nativeTypeId: 2011,
      orbKind: 'mana',
      phase: 0,
      position: { x: player.position.x + 250, y: player.position.y },
      source: 'script',
      value: 0.5,
    }], state.tick)
    return { ...state, world: { ...state.world, loot: spawned.store } }
  }
  const baseline = stepGameSimulationTick(fixture(0), { caster: gameplayInput(0, 0) })
  const learned = stepGameSimulationTick(fixture(1), { caster: gameplayInput(0, 0) })
  if (baseline.world.kind !== 'boneyard' || learned.world.kind !== 'boneyard') {
    throw new Error('expected Boneyard worlds')
  }
  assert.equal(baseline.world.loot.actors[0]!.position.x, 500)
  assert.equal(learned.world.loot.actors[0]!.position.x, 498.5)
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

test('Last Word explodes at death tick 200, triples Demon damage, and archives only final Gold and Sacks', () => {
  let state = enterBoneyardWorld(
    createGameSimulation(),
    combatBoneyard('last-word-run'),
  )
  state = withDemonAtPlayer(state)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const demon = state.world.enemies.actors[0]!
  const loot = spawnBoneyardLootSpecs(state.world.loot, [
    {
      activationDelayTicks: 0,
      amount: 7,
      id: 1,
      kind: 'gold',
      nativeTypeId: 2012,
      phase: 0,
      position: { x: 400, y: 400 },
      source: 'script',
      tier: 3,
    },
    {
      activationDelayTicks: 0,
      id: 2,
      item: {
        equipmentType: null,
        iconRecords: [46],
        id: 1,
        kind: 'health-potion',
        name: 'Final Potion',
        nativeSubtype: 0,
        nativeTypeId: 7001,
        quantity: 1,
        rarity: null,
        recipeIndex: null,
      },
      kind: 'sack',
      nativeTypeId: 2013,
      phase: 0,
      position: { x: 400, y: 400 },
      source: 'script',
    },
    {
      activationDelayTicks: 0,
      bonusKind: 0,
      id: 3,
      kind: 'bonus',
      nativeTypeId: 2038,
      phase: 0,
      position: { x: 400, y: 400 },
      source: 'script',
    },
  ], state.tick).store
  const index = state.playerEntities.identities.findIndex(({ playerId }) => (
    playerId === 'local-player'
  ))
  state = {
    ...state,
    playerEntities: replacePlayerEconomy({
      ...state.playerEntities,
      progressions: [{
        ...state.playerEntities.progressions[index]!,
        currentHealth: -10,
        deathAgeTicks: 333,
        deathTick: 199,
        lifeState: 'dying',
      }],
    }, 'local-player', {
      ...getPlayerEconomy(state),
      ownedPerkSelectors: [12, 22],
    }),
    run: {
      ...state.run,
      gameOverEventId: 1,
      gameOverTicks: 0,
      phase: 'game-over',
    },
    world: {
      ...state.world,
      enemies: {
        ...state.world.enemies,
        actors: [{
          ...demon,
          config: { ...demon.config, maximumHealth: 10_000 },
          currentHealth: 10_000,
        }],
      },
      loot,
    },
  }

  state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  assert.equal(state.world.enemies.actors[0]?.lifeState, 'dying')
  assert.deepEqual(state.secondaryAbilities.actors.filter(({ kind }) => (
    kind === 'mindblast-burst' || kind === 'mindblast-shockwave'
  )).map(({ kind }) => kind), ['mindblast-burst', 'mindblast-shockwave'])
  assert.equal(state.secondaryAbilities.actors.find(({ kind }) => (
    kind === 'mindblast-burst'
  ))?.scale, 15)

  state = {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      progressions: [{
        ...state.playerEntities.progressions[index]!,
        deathAgeTicks: PLAYER_DEATH_PRESENTATION_DURATION_TICKS - 1,
        deathTick: PLAYER_DEATH_PRESENTATION_MAXIMUM_HELD_TICK,
      }],
    },
  }
  const goldBefore = getPlayerEconomy(state).gold
  state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  assert.equal(getPlayerEconomy(state).gold, goldBefore + 7)
  assert.equal(getPlayerEconomy(state).storage.length, 1)
  assert.match(
    getPlayerEconomy(state).storage[0]!.name,
    /^Helvidius's (Earthly Possessions|Stuff|Dead Stuff|Bag|Loot)$/,
  )
  assert.deepEqual(state.world.loot.actors.map(({ kind }) => kind), ['bonus'])
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
    deathAgeTicks: 264,
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
  assert.equal(publishedCorpse.lifeState, 'dying')
  assert.equal(playerCollisionEnabled(publishedCorpse), false)
  assert.deepEqual(getPlayerCharacter(state, 'corpse').position, { x: 250, y: 250 })
  assert.deepEqual(getPlayerCharacter(state, 'living').position, { x: 200.5, y: 250 })
  assert.equal(getPlayerProgression(state, 'living').lifeState, 'alive')
  assert.equal(state.run.phase, 'active')
  assert.equal(state.run.gameOverEventId, 0)
})

test('completed wave respawns only dead run members at the authored spawn on the same entity', () => {
  const loaded = emptyBoneyard()
  loaded.runId = 'wave-respawn-run'
  loaded.scene.spawn = { facingDeg: 225, x: 321, y: 234 }
  loaded.scene.solomonDig = {
    frameProgram: [0, 3, 1],
    gravePosition: { x: 240, y: 240 },
    lanternPosition: { x: 245, y: 245 },
    position: { x: 250, y: 250 },
    ticksPerFrame: 5,
  }
  let state = enterBoneyardWorld(createGameSimulation({
    first: { discipline: 'arcane', displayName: 'First', element: 'ether' },
    second: { discipline: 'mind', displayName: 'Second', element: 'water' },
  }), loaded)
  if (state.world.kind !== 'boneyard' || state.world.waves === null) {
    throw new Error('expected retail Boneyard wave authority')
  }

  state = {
    ...state,
    playerEntities: replacePlayerCharacter(state.playerEntities, 'first', {
      ...getPlayerCharacter(state, 'first'),
      headingIndex: 7,
      position: { x: 111, y: 112 },
      velocity: { x: 0, y: 0 },
    }),
  }
  state = {
    ...state,
    playerEntities: damagePlayerEntity(state.playerEntities, 'first', 60, state.tick),
  }
  state = stepGameSimulationTick(state, {})
  assert.equal(getPlayerProgression(state, 'first').lifeState, 'dying')
  assert.equal(getPlayerProgression(state, 'first').deathAgeTicks, 0)
  assert.equal(state.run.phase, 'active')
  if (state.world.kind !== 'boneyard' || state.world.waves === null) {
    throw new Error('expected retail Boneyard wave authority')
  }

  const entityIds = state.playerEntities.entityIds
  const identities = state.playerEntities.identities
  const configs = state.playerEntities.configs
  const economies = state.playerEntities.economies
  const skillBooks = state.playerEntities.skillBooks
  const statBooks = state.playerEntities.statBooks
  const firstDeathEpoch = getPlayerProgression(state, 'first').deathEpoch
  const firstExperience = getPlayerProgression(state, 'first').experience
  const secondProgression = getPlayerProgression(state, 'second')
  const secondPosition = getPlayerCharacter(state, 'second').position
  state = {
    ...state,
    world: {
      ...state.world,
      encounter: state.world.encounter === null
        ? null
        : { ...state.world.encounter, phase: 'gone', runEventId: 1 },
      waves: {
        ...state.world.waves,
        phase: 'wave-threshold',
        populationThreshold: 1,
        waveOrdinal: 1,
      },
    },
  }

  state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard' || state.world.waves === null) {
    throw new Error('expected retail Boneyard wave authority')
  }
  assert.equal(state.world.waves.phase, 'wave-lull-delay')
  assert.equal(state.playerEntities.entityIds, entityIds)
  assert.equal(state.playerEntities.identities, identities)
  assert.equal(state.playerEntities.configs, configs)
  assert.deepEqual(state.playerEntities.economies, economies)
  assert.equal(state.playerEntities.skillBooks, skillBooks)
  assert.equal(state.playerEntities.statBooks, statBooks)
  assert.equal(getPlayerProgression(state, 'first').lifeState, 'alive')
  assert.equal(getPlayerProgression(state, 'first').deathAgeTicks, 0)
  assert.equal(getPlayerProgression(state, 'first').deathTick, 0)
  assert.equal(getPlayerProgression(state, 'first').deathEpoch, firstDeathEpoch)
  assert.equal(getPlayerProgression(state, 'first').experience, firstExperience)
  assert.equal(
    getPlayerProgression(state, 'first').currentHealth,
    getPlayerProgression(state, 'first').maximumHealth,
  )
  assert.equal(
    getPlayerProgression(state, 'first').currentMana,
    getPlayerProgression(state, 'first').maximumMana,
  )
  assert.deepEqual(getPlayerCharacter(state, 'first').position, {
    x: state.world.spawn.x,
    y: state.world.spawn.y,
  })
  assert.deepEqual(getPlayerCharacter(state, 'first').velocity, { x: 0, y: 0 })
  assert.equal(getPlayerCharacter(state, 'first').headingIndex, 7)
  assert.equal(getPlayerCharacter(state, 'first').primaryCast.actionTick, -1)
  assert.equal(getPlayerProgression(state, 'second'), secondProgression)
  assert.deepEqual(getPlayerCharacter(state, 'second').position, secondPosition)
  assert.equal(state.run.phase, 'active')

  state = {
    ...state,
    playerEntities: setPlayerEntityMana(state.playerEntities, 'first', 50),
  }
  state = stepGameSimulationTick(state, {})
  assert.ok(getPlayerProgression(state, 'first').currentMana < 51)
  assert.ok(getPlayerProgression(state, 'first').currentMana > 50)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  assert.deepEqual(getPlayerCharacter(state, 'first').position, {
    x: state.world.spawn.x,
    y: state.world.spawn.y,
  })
})

test('Last Word adds ground Gold and Sack contents to the durable terminal profile', () => {
  let state = enterBoneyardWorld(
    createGameSimulation({ owner: DEFAULT_PLAYER_CHARACTER_CONFIG }),
    combatBoneyard('last-word-profile'),
  )
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const economy = getPlayerEconomy(state, 'owner')
  const spawned = spawnBoneyardLootSpecs(state.world.loot, [
    {
      activationDelayTicks: 0,
      amount: 9,
      id: 1,
      kind: 'gold',
      nativeTypeId: 2012,
      phase: 0,
      position: { x: 500, y: 500 },
      source: 'script',
      tier: 3,
    },
    {
      activationDelayTicks: 0,
      id: 2,
      item: { ...economy.backpack[0]!, id: 90_000 },
      kind: 'sack',
      nativeTypeId: 2013,
      phase: 0,
      position: { x: 500, y: 500 },
      source: 'script',
    },
  ], state.tick)
  const preexistingStorageItem = {
    ...economy.backpack[1]!,
    id: economy.nextItemId,
    name: 'Previously Stored Mana Potion',
  }
  const persistentEconomy = {
    ...economy,
    nextItemId: economy.nextItemId + 1,
    ownedPerkSelectors: [12],
    revision: economy.revision + 1,
    storage: [preexistingStorageItem],
  }
  state = {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'owner', persistentEconomy),
    run: { ...state.run, phase: 'game-over' },
    world: { ...state.world, loot: spawned.store },
  }

  const profile = gameSimulationDurableProfileEconomy(state, 'owner')
  assert.equal(profile.gold, economy.gold + 9)
  assert.equal(profile.storage[0]?.name, 'Previously Stored Mana Potion')
  assert.equal(profile.storage.at(-1)?.kind, 'sack')
  assert.deepEqual(profile.storage.at(-1)?.contents?.map(item => item.name), [
    'Health Potion',
  ])

  const withoutLastWord = gameSimulationDurableProfileEconomy({
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'owner', {
      ...persistentEconomy,
      ownedPerkSelectors: [],
    }),
  }, 'owner')
  assert.equal(withoutLastWord.gold, economy.gold)
  assert.deepEqual(withoutLastWord.storage, [preexistingStorageItem])
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
  state = withPlayerSkillRank(state, 'first', 51, 1)
  state = withPlayerSkillRank(state, 'second', 63, 1)
  state = grantGameSimulationPlayerExperience(state, 'first', 89)
  const initialStockIds = Object.fromEntries(['first', 'second'].map((playerId) => [
    playerId,
    getPlayerEconomy(state, playerId).fomentiusStock.map(({ id }) => id),
  ]))
  state = enterBoneyardWorld(state, combatBoneyard('multiplayer-death-run'))
  const firstActiveEconomy = getPlayerEconomy(state, 'first')
  const firstActiveProgression = getPlayerProgression(state, 'first')
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

  for (let tick = 0; tick < 265; tick += 1) {
    state = stepGameSimulationTick(state, {})
  }
  assert.equal(getPlayerProgression(state, 'first').lifeState, 'dying')
  assert.equal(getPlayerProgression(state, 'first').deathTick, 159)
  assert.equal(getPlayerProgression(state, 'second').lifeState, 'alive')
  assert.equal(state.run.phase, 'active')

  for (let tick = 265; tick < PLAYER_DEATH_PRESENTATION_DURATION_TICKS - 1; tick += 1) {
    state = stepGameSimulationTick(state, {})
  }
  assert.equal(getPlayerProgression(state, 'first').lifeState, 'dying')
  assert.equal(
    getPlayerProgression(state, 'first').deathAgeTicks,
    PLAYER_DEATH_PRESENTATION_DURATION_TICKS - 1,
  )
  assert.equal(
    getPlayerProgression(state, 'first').deathTick,
    PLAYER_DEATH_PRESENTATION_MAXIMUM_HELD_TICK,
  )
  state = stepGameSimulationTick(state, {})
  assert.equal(getPlayerProgression(state, 'first').lifeState, 'spectating')
  assert.equal(
    getPlayerProgression(state, 'first').deathAgeTicks,
    PLAYER_DEATH_PRESENTATION_DURATION_TICKS,
  )
  assert.equal(
    getPlayerProgression(state, 'first').deathTick,
    PLAYER_DEATH_PRESENTATION_MAXIMUM_HELD_TICK,
  )
  assert.equal(
    getPlayerProgression(state, 'first').level,
    firstActiveProgression.level,
  )
  assert.equal(
    getPlayerProgression(state, 'first').experience,
    firstActiveProgression.experience,
  )
  assert.equal(getPlayerSkillBook(state, 'first').permanentRanks[51], 1)
  assert.deepEqual(getPlayerEconomy(state, 'first'), firstActiveEconomy)
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

  let frozenWorld = state.world
  let archiveObserved = false
  let expectedArchiveRng = state.gameRng
  const expectedArchivePoses = new Map<string, { headingIndex: number; scale: number }>()
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  for (const playerId of Object.keys(state.world.hallOfFameRuns).sort()) {
    const heading = drawNativeFloat(
      expectedArchiveRng,
      NATIVE_HALL_OF_FAME_SCORE.portraitHeadingJitterDegrees,
      true,
    )
    const scale = drawNativeFloat(
      heading.state,
      NATIVE_HALL_OF_FAME_SCORE.portraitScaleJitter,
    )
    expectedArchiveRng = scale.state
    expectedArchivePoses.set(playerId, {
      headingIndex: actorHeadingIndex(Math.fround(
        NATIVE_HALL_OF_FAME_SCORE.portraitHeadingCenterDegrees + heading.value,
      )),
      scale: Math.fround(NATIVE_HALL_OF_FAME_SCORE.portraitScaleBase + scale.value),
    })
  }
  const assertFrozenGameOverWorld = () => {
    if (state.run.gameOverTicks === NATIVE_HALL_OF_FAME_SCORE.archiveDeathTick) {
      assert.notEqual(state.world, frozenWorld)
      if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
      for (const [playerId, hallRun] of Object.entries(state.world.hallOfFameRuns)) {
        assert.equal(hallRun.elapsedTicks, state.tick - hallRun.startedAtTick)
        assert.equal(
          hallRun.portraitHeadingIndex,
          expectedArchivePoses.get(playerId)?.headingIndex,
        )
        assert.equal(hallRun.portraitScale, expectedArchivePoses.get(playerId)?.scale)
      }
      assert.deepEqual(state.gameRng, expectedArchiveRng)
      frozenWorld = state.world
      archiveObserved = true
      return
    }
    assert.equal(state.world, frozenWorld)
  }
  for (let age = 1; age <= 254; age += 1) {
    state = stepGameSimulationTick(state, {
      first: gameplayInput(1, 0),
      second: gameplayInput(1, 0),
    })
    assertFrozenGameOverWorld()
    assert.equal(getPlayerProgression(state, 'second').deathAgeTicks, age)
  }
  assert.equal(getPlayerProgression(state, 'second').deathTick, 152)
  assert.equal(playerDeathFrame(getPlayerProgression(state, 'second')), 0)
  state = stepGameSimulationTick(state, {})
  assert.equal(getPlayerProgression(state, 'second').deathAgeTicks, 255)
  assert.equal(getPlayerProgression(state, 'second').deathTick, 153)
  assert.equal(playerDeathFrame(getPlayerProgression(state, 'second')), 1)
  for (let age = 256; age <= 260; age += 1) {
    state = stepGameSimulationTick(state, {})
  }
  assert.equal(getPlayerProgression(state, 'second').deathTick, 156)
  assert.equal(playerDeathFrame(getPlayerProgression(state, 'second')), 2)
  for (let age = 261; age <= 265; age += 1) {
    state = stepGameSimulationTick(state, {})
  }
  assert.equal(getPlayerProgression(state, 'second').deathTick, 159)
  assert.equal(getPlayerProgression(state, 'second').lifeState, 'dying')
  assert.equal(playerDeathFrame(getPlayerProgression(state, 'second')), 3)

  while (state.run.gameOverTicks < GAME_OVER_AUTOMATIC_ACCEPT_TICK - 1) {
    state = stepGameSimulationTick(state, {
      first: gameplayInput(1, 0),
      second: gameplayInput(1, 0),
    })
    assertFrozenGameOverWorld()
  }
  assert.equal(archiveObserved, true)
  assert.equal(state.run.gameOverExitTicks, null)
  state = stepGameSimulationTick(state, {})
  assert.equal(state.run.gameOverTicks, GAME_OVER_AUTOMATIC_ACCEPT_TICK)
  assert.equal(state.run.gameOverExitTicks, 1)
  for (let exitTick = 2; exitTick <= GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS; exitTick += 1) {
    state = stepGameSimulationTick(state, {})
    assertFrozenGameOverWorld()
    assert.equal(state.run.gameOverExitTicks, exitTick)
  }
  assert.equal(state.run.phase, 'game-over')
  assert.equal(state.run.gameOverExitTicks, GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS)
  const loadout = stepGameSimulationTick(state, {})
  assert.equal(loadout.run.phase, 'loadout')
  assert.equal(loadout.world.kind, 'hub')
  assert.equal(loadout.hallOfFameClockStartedAtTick, loadout.tick)
  assert.deepEqual(
    Object.keys(playerCharacterRecords(loadout.playerEntities)).sort(),
    ['first', 'second'],
  )
  for (const playerId of ['first', 'second']) {
    const economy = getPlayerEconomy(loadout, playerId)
    const restocked = economy.fomentiusStock
    assert.notDeepEqual(restocked.map(({ id }) => id), initialStockIds[playerId])
    assert.ok(restocked.every(({ id }) => id > Math.max(...initialStockIds[playerId]!)))
    assert.deepEqual(economy.backpack.map(({ kind }) => kind), [
      'health-potion',
      'mana-potion',
    ])
    assert.deepEqual(economy.storage, [])
  }
  const loadoutEconomyRevisions = Object.fromEntries(['first', 'second'].map(playerId => [
    playerId,
    getPlayerEconomy(loadout, playerId).revision,
  ]))

  const firstReady = confirmGameSimulationLoadout(loadout, 'first', {
    discipline: 'body',
    displayName: 'First Reborn',
    element: 'air',
  })
  assert.ok(firstReady)
  assert.equal(firstReady.run.phase, 'loadout')
  const hub = confirmGameSimulationLoadout(firstReady, 'second', {
    discipline: 'mind',
    displayName: 'Second Reborn',
    element: 'water',
  })
  assert.ok(hub)
  assert.equal(hub.run.phase, 'hub')
  assert.equal(getPlayerCharacter(hub, 'first').config.element, 'air')
  assert.equal(getPlayerCharacter(hub, 'first').config.discipline, 'body')
  assert.equal(getPlayerCharacter(hub, 'second').config.element, 'water')
  assert.equal(getPlayerCharacter(hub, 'second').config.discipline, 'mind')
  assert.equal(getPlayerSkillBook(hub, 'first').primarySkillId, 24)
  assert.deepEqual(getPlayerBelt(hub, 'first')[0], { kind: 'skill', skillId: 27 })
  assert.equal(getPlayerSkillBook(hub, 'first').permanentRanks[51], 0)
  assert.equal(getPlayerSkillBook(hub, 'second').primarySkillId, 32)
  assert.deepEqual(getPlayerBelt(hub, 'second')[0], { kind: 'skill', skillId: 35 })
  assert.equal(getPlayerSkillBook(hub, 'second').permanentRanks[63], 0)
  assert.equal(getPlayerProgression(hub, 'first').level, 1)
  assert.equal(getPlayerProgression(hub, 'first').experience, 0)
  for (const [playerId, element] of [
    ['first', 'air'],
    ['second', 'water'],
  ] as const) {
    const economy = getPlayerEconomy(hub, playerId)
    const progression = getPlayerProgression(hub, playerId)
    const appearance = rollNativeStarterEquipmentAppearance(
      createNativeRng(progression.offerSeed),
      element,
    )
    assert.ok(economy.revision > loadoutEconomyRevisions[playerId]!)
    assert.deepEqual(economy.equipment.hat?.iconTints, [
      appearance.primaryTint,
      appearance.secondaryTint,
    ])
    assert.deepEqual(economy.equipment.robe?.iconTints, economy.equipment.hat?.iconTints)
  }
  assert.equal(getPlayerProgression(hub, 'second').level, 1)
  assert.equal(getPlayerProgression(hub, 'second').experience, 0)
  const secondRun = enterBoneyardWorld(hub, combatBoneyard('clean-second-run'))
  assert.equal(secondRun.run.phase, 'active')
  assert.equal(secondRun.run.nextGameOverEventId, 2)
  if (secondRun.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  assert.ok(Object.values(secondRun.world.hallOfFameRuns).every(
    ({ startedAtTick }) => startedAtTick === loadout.tick,
  ))
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

test('a primary quickbar edge selects the learned primary before cast authority is built', () => {
  let state = withPlayerSkillRank(createGameSimulation(), 'local-player', 16, 1)
  const bound = bindGameSimulationPlayerSkillQuickbar(state, 'local-player', 16, 7)
  assert.ok(bound)
  state = stepGameSimulationTick(bound, {
    'local-player': {
      aim: null,
      cast: { primary: false, quickbar: 7 },
      movement: { x: 0, y: 0 },
      viewportWidth: 1_600,
    },
  })
  assert.equal(getPlayerSkillBook(state).primarySkillId, 16)
  assert.deepEqual(getPlayerBelt(state)[7], { kind: 'skill', skillId: 16 })
  assert.equal(getPlayerCharacter(state).primaryCast.selectedPrimaryId, 16)
})

test('Teleport reaches the active-run kernel through a real belt slot and remains gated in College', () => {
  const input = {
    aim: { x: 400, y: 250 },
    cast: { primary: false, quickbar: 7 },
    movement: { x: 0, y: 0 },
    viewportWidth: 1_600,
  }
  let college = withPlayerSkillRank(createGameSimulation(), 'local-player', 48, 1)
  const bound = bindGameSimulationPlayerSkillQuickbar(college, 'local-player', 48, 7)
  assert.ok(bound)
  college = bound
  const collegePosition = getPlayerCharacter(college).position
  const collegeMana = getPlayerProgression(college).currentMana
  const collegeTick = stepGameSimulationTick(college, { 'local-player': input })
  assert.deepEqual(getPlayerCharacter(collegeTick).position, collegePosition)
  const collegeManaAfter = getPlayerProgression(collegeTick).currentMana
  assert.ok(collegeManaAfter >= collegeMana && collegeManaAfter <= collegeMana + 0.11)
  assert.equal(collegeTick.secondaryAbilities.actors.some(({ kind }) => kind === 'teleport-burst'), false)

  let active = enterBoneyardWorld(college, emptyBoneyard())
  const source = getPlayerCharacter(active).position
  const mana = getPlayerProgression(active).currentMana
  active = stepGameSimulationTick(active, { 'local-player': input })
  assert.notDeepEqual(getPlayerCharacter(active).position, source)
  const manaSpent = mana - getPlayerProgression(active).currentMana
  assert.ok(manaSpent >= 9.8 && manaSpent <= 10)
  assert.equal(active.secondaryAbilities.players['local-player']?.cooldownTicksBySkill[48], 6_000)
  assert.equal(active.secondaryAbilities.players['local-player']?.globalCooldownTicks, 150)
  assert.equal(
    active.secondaryAbilities.actors.filter(({ kind }) => kind === 'teleport-burst').length,
    2,
  )
  assert.deepEqual(
    active.secondaryAbilities.events.filter(({ cue }) => cue === 'teleport')
      .map(({ position }) => position),
    [source, getPlayerCharacter(active).position],
  )
})

test('concentration quickbar edges fill and alternate the authoritative A/B selection', () => {
  const input = (slot: number | null) => ({
    aim: null,
    cast: { primary: false, quickbar: slot },
    movement: { x: 0, y: 0 },
    viewportWidth: 1_600,
  })
  let state = createGameSimulation()
  for (const skillId of [57, 58, 59]) {
    state = withPlayerSkillRank(state, 'local-player', skillId, 1)
    const bound = bindGameSimulationPlayerSkillQuickbar(
      state,
      'local-player',
      skillId,
      skillId - 52,
    )
    assert.ok(bound)
    state = bound
  }

  state = stepGameSimulationTick(state, { 'local-player': input(5) })
  assert.deepEqual(selectedConcentrations(state), [57, null, 'a'])
  state = stepGameSimulationTick(state, { 'local-player': input(null) })
  state = stepGameSimulationTick(state, { 'local-player': input(6) })
  assert.deepEqual(selectedConcentrations(state), [58, null, 'a'])

  state = {
    ...state,
    playerEntities: replacePlayerEconomy(
      state.playerEntities,
      'local-player',
      {
        ...getPlayerEconomy(state),
        ownedPerkSelectors: [21],
      },
    ),
  }
  state = stepGameSimulationTick(state, { 'local-player': input(null) })
  state = stepGameSimulationTick(state, { 'local-player': input(5) })
  assert.deepEqual(selectedConcentrations(state), [58, 57, 'a'])
  state = stepGameSimulationTick(state, { 'local-player': input(null) })
  state = stepGameSimulationTick(state, { 'local-player': input(7) })
  assert.deepEqual(selectedConcentrations(state), [59, 57, 'b'])

  const index = state.playerEntities.identities.findIndex(({ playerId }) => (
    playerId === 'local-player'
  ))
  const progressions = [...state.playerEntities.progressions]
  progressions[index] = {
    ...progressions[index]!,
    mindChugTicksRemaining: 10,
  }
  state = {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      progressions: Object.freeze(progressions),
    },
  }
  state = stepGameSimulationTick(state, { 'local-player': input(null) })
  state = stepGameSimulationTick(state, { 'local-player': input(6) })
  assert.deepEqual(selectedConcentrations(state), [59, 57, 'b'])
})

function selectedConcentrations(state: GameSimulationState) {
  const runtime = playerSkillRuntimeAt(state.playerEntities, 'local-player')!
  return [
    runtime.concentrationSkillIdA,
    runtime.concentrationSkillIdB,
    runtime.nextConcentrationReplacementSlot,
  ] as const
}

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

function withDemonAtPlayer(state: GameSimulationState): GameSimulationState {
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
      enemyToken: 'DEMON',
      flags: [],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.DEMON,
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

function withPlayerSkillRank(
  state: GameSimulationState,
  playerId: string,
  skillId: number,
  rank: number,
): GameSimulationState {
  const index = state.playerEntities.identities.findIndex((identity) => (
    identity.playerId === playerId
  ))
  if (index < 0) throw new Error(`missing player ${playerId}`)
  const sourceBook = state.playerEntities.skillBooks[index]!
  const permanentRanks = [...sourceBook.permanentRanks]
  const effectiveRanks = [...sourceBook.effectiveRanks]
  permanentRanks[skillId] = rank
  effectiveRanks[skillId] = rank
  const skillBooks = [...state.playerEntities.skillBooks]
  skillBooks[index] = {
    ...sourceBook,
    effectiveRanks: Object.freeze(effectiveRanks),
    learnedSkillOrder: rank > 0 && !sourceBook.learnedSkillOrder.includes(skillId)
      ? Object.freeze([...sourceBook.learnedSkillOrder, skillId])
      : sourceBook.learnedSkillOrder,
    permanentRanks: Object.freeze(permanentRanks),
  }
  const playerEntities = replacePlayerEconomy({
    ...state.playerEntities,
    skillBooks: Object.freeze(skillBooks),
  }, playerId, state.playerEntities.economies[index]!)
  return { ...state, playerEntities }
}

function withConcentratedDeflect(
  state: GameSimulationState,
  playerId: string,
): GameSimulationState {
  const index = state.playerEntities.identities.findIndex((identity) => (
    identity.playerId === playerId
  ))
  if (index < 0) throw new Error(`missing player ${playerId}`)
  const sourceBook = state.playerEntities.skillBooks[index]!
  const permanentRanks = [...sourceBook.permanentRanks]
  const effectiveRanks = [...sourceBook.effectiveRanks]
  permanentRanks[68] = 1
  effectiveRanks[68] = 1
  const skillBooks = [...state.playerEntities.skillBooks]
  skillBooks[index] = {
    ...sourceBook,
    effectiveRanks: Object.freeze(effectiveRanks),
    permanentRanks: Object.freeze(permanentRanks),
  }
  let playerEntities = {
    ...state.playerEntities,
    skillBooks: Object.freeze(skillBooks),
  }
  playerEntities = replacePlayerEconomy(
    playerEntities,
    playerId,
    playerEntities.economies[index]!,
  )
  playerEntities = selectPlayerEntityConcentration(playerEntities, playerId, 68)
  return { ...state, playerEntities }
}

function withPassiveRanks(
  state: GameSimulationState,
  playerId: string,
  ranks: Readonly<Record<number, number>>,
): GameSimulationState {
  const index = state.playerEntities.identities.findIndex((identity) => (
    identity.playerId === playerId
  ))
  if (index < 0) throw new Error(`missing player ${playerId}`)
  const sourceBook = state.playerEntities.skillBooks[index]!
  const permanentRanks = [...sourceBook.permanentRanks]
  const effectiveRanks = [...sourceBook.effectiveRanks]
  for (const [skillId, rank] of Object.entries(ranks)) {
    permanentRanks[Number(skillId)] = rank
    effectiveRanks[Number(skillId)] = rank
  }
  const skillBooks = [...state.playerEntities.skillBooks]
  skillBooks[index] = {
    ...sourceBook,
    effectiveRanks: Object.freeze(effectiveRanks),
    permanentRanks: Object.freeze(permanentRanks),
  }
  const playerEntities = replacePlayerEconomy(
    { ...state.playerEntities, skillBooks: Object.freeze(skillBooks) },
    playerId,
    state.playerEntities.economies[index]!,
  )
  return { ...state, playerEntities }
}

function seedForIntegerDraw(
  bound: number,
  predicate: (value: number) => boolean,
): number {
  for (let seed = 0; seed < 100_000; seed += 1) {
    if (predicate(drawNativeInteger(createNativeRng(seed), bound).value)) return seed
  }
  throw new Error(`could not find native RNG seed for bound ${bound}`)
}

test('mod consumables retain identity, allocate one effect, and clear on run entry', () => {
  let state = createGameSimulation({ guest: DEFAULT_PLAYER_CHARACTER_CONFIG })
  const economy = getPlayerEconomy(state, 'guest')
  const content = {
    consumeVfx: {
      color: [0.15, 1, 0.25, 1] as const,
      kind: 'spell_glow' as const,
    },
    contentId: '8068156596081641415',
    description: 'Three minutes of invincibility and unlimited mana.',
    durationMs: 180_000,
    icon: {
      atlasId: 'canary.lua.invincibility_potion:invincibility_potion',
      frame: {
        centerOffsetX: 0,
        centerOffsetY: 0,
        contentHeight: 50,
        contentWidth: 53,
        height: 50,
        logicalHeight: 50,
        logicalWidth: 53,
        width: 53,
        x: 0,
        y: 0,
      },
      frameIndex: 0,
      imagePath: 'sprites/invincibility_potion.png',
    },
    key: 'invincibility_potion',
    modId: 'canary.lua.invincibility_potion',
  }
  state = {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'guest', {
      ...economy,
      backpack: [...economy.backpack, {
        equipmentType: null,
        iconRecords: [],
        id: economy.nextItemId,
        kind: 'mod-potion',
        modContent: content,
        name: 'Invincibility Potion',
        nativeSubtype: 6,
        nativeTypeId: 7001,
        quantity: 1,
        rarity: null,
        recipeIndex: null,
      }],
      nextItemId: economy.nextItemId + 1,
      revision: economy.revision + 1,
    }),
  }
  const extensions = inertModExtensions(content.contentId)
  const consumed = applyGameSimulationHubAction(
    state,
    'guest',
    { itemId: economy.nextItemId, type: 'consume' },
    extensions,
  )
  assert.equal(consumed.accepted, true)
  assert.equal(consumed.modConsumption?.content.contentId, content.contentId)
  assert.equal(consumed.modConsumption?.playerId, 'guest')
  assert.equal(consumed.state.modEffects.length, 1)
  assert.equal(getPlayerEconomy(consumed.state, 'guest').backpack.some(
    ({ modContent }) => modContent?.contentId === content.contentId,
  ), false)
  assert.equal(enterBoneyardWorld(consumed.state, emptyBoneyard()).modEffects.length, 0)
})

test('simulation extensions filter poison and passive mana at their authoritative writers', () => {
  let state = enterBoneyardWorld(
    createGameSimulation({ guest: DEFAULT_PLAYER_CHARACTER_CONFIG }),
    emptyBoneyard(),
  )
  state = {
    ...state,
    playerEntities: setPlayerEntityMana(
      poisonPlayerEntity(state.playerEntities, 'guest', 10, 1),
      'guest',
      50,
    ),
  }
  const damageKinds: string[] = []
  const manaSources: string[] = []
  const extensions: GameSimulationExtensions = {
    createLootItems: () => [],
    filterDamage: input => {
      damageKinds.push(input.damageKind)
      return input.damageKind === 'poison' ? 0 : input.amount
    },
    filterMana: input => {
      manaSources.push(input.source)
      return input.source === 'passive-recovery' ? 0 : input.delta
    },
    hasConsumable: () => false,
  }
  const before = getPlayerProgression(state, 'guest')
  state = stepGameSimulationTick(state, { guest: gameplayInput(0, 0) }, { extensions })
  const after = getPlayerProgression(state, 'guest')
  assert.ok(after.currentHealth >= before.currentHealth)
  assert.equal(after.currentMana, 50)
  assert.ok(damageKinds.includes('poison'))
  assert.ok(manaSources.includes('passive-recovery'))
})

function inertModExtensions(contentId: string): GameSimulationExtensions {
  return {
    createLootItems: () => [],
    filterDamage: input => input.amount,
    filterMana: input => input.delta,
    hasConsumable: candidate => candidate === contentId,
  }
}

import assert from 'node:assert/strict'
import test from 'node:test'
import { observeMlBotPolicyOwnEffects } from './ml-bot-policy/own-effects.ts'
import { createBoneyardPresentationTimeline, isBoneyardGameSnapshot } from '../client/boneyard-presentation-timeline.ts'
import { gameSnapshot, gameSnapshotFrame } from '../protocol/codecs/snapshot.ts'
import { actorHeadingFromVector, actorHeadingIndex } from '../core-kernels/actor-heading.ts'
import { NATIVE_ACTOR_SEPARATION_EPSILON } from '../core-kernels/actor-physics.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { GAME_OVER_AUTOMATIC_ACCEPT_TICK, GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS } from '../core-kernels/game-run.ts'
import { NATIVE_HALL_OF_FAME_SCORE } from '../core-kernels/hall-of-fame-score.ts'
import { hubCollegeAdmissionPreLoadout } from '../core-kernels/college-admission-lifecycle.ts'
import { createModBoastSelection, selectBoast } from '../core-kernels/boast.ts'
import type { BoastDefinition, BoastResolver } from '../core-kernels/boast.ts'
import { NATIVE_SECONDARY_ABILITY_IDS } from '../core-kernels/native-secondary-ability-contract.ts'
import type { NativeSecondaryAbilityId } from '../core-kernels/native-secondary-ability-contract.ts'
import { NATIVE_DAMAGE_X4_BONUS_TICKS, NATIVE_WELD_BUILDS, grantPlayerSkillRanks } from '../core-kernels/player-progression.ts'
import type { NativeBeltSkillId } from '../core-kernels/player-progression.ts'
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
import { EARTH_BOULDER_IDENTITY_ORIENTATION } from '../core-kernels/primary-spell-earth-orientation.ts'
import {
  createNativeWeldPersistentActor,
  releaseNativeWeldPersistentActor,
} from '../core-kernels/native-weld-primary-runtime.ts'
import {
  DOWSING_EQUIPMENT_RECIPES,
  HAGATHA_PERKS,
  NATIVE_EQUIPMENT_LEVEL_REDUCTION_SKILL_ID,
  createEquipmentInventoryItem,
  findInventoryItem,
  insertLootInventoryItem,
  projectInventoryItems,
} from '../core-kernels/hub-economy.ts'
import type { HubInventoryItem } from '../core-kernels/hub-economy.ts'
import {
  NATIVE_PLAYER_LIGHT_OVERLAY_DECAY,
  NATIVE_PLAYER_STAFF_CONSTANT_OVERLAY,
} from '../core-kernels/player-lighting.ts'
import type {
  NativePlayerStaffAction,
  NativePlayerStaffMeleeAction,
  NativePlayerStaffSpinAction,
} from '../core-kernels/native-player-staff-action.ts'
import {
  createDeferredNativeWorldManagerRegistrations,
  createNativeWorldManagerOrder,
  mergeNativeWorldManagerOwners,
} from '../core-kernels/native-world-manager-order.ts'
import {
  advanceNativeRngWords,
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
} from '../core-kernels/native-rng.ts'
import { rollNativeStarterEquipmentAppearance } from '../core-kernels/native-starter-equipment.ts'
import { createNativeWaterHailActor } from '../core-kernels/air-water-spell-actors.ts'
import {
  NATIVE_SECONDARY_CONSTRUCTOR_COOLDOWN_TICKS,
  applyNativeSecondaryGolemDamage,
  applyNativeSecondaryPlayerDamage,
  createNativeSecondaryPlayerState,
} from '../core-kernels/native-secondary-abilities.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { nativeCocoonPosition } from '../core-kernels/native-webbed.ts'
import { applyPlayerContacts } from './player-contact-system.ts'
import { nativeFacultyRecipe } from '../core-kernels/native-survival-faculty.ts'
import { NativeSecondaryScreenFeedbackPresentation } from '../renderer/native-screen-feedback.ts'
import { createGameProfileSaveDocument, createGameSaveDocument, hydrateGameSaveProfile, restoreGameSaveDocument, restoreGameSaveProfile } from '../save/game-save-document.ts'
import { decodeServerGameMessage, encodeGameMessage } from '../protocol/game-protocol.ts'
import { createGameSnapshotFrame, EntityReplicationReconstructor } from '../protocol/entity-replication.ts'
import { NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS } from '../hub-painter-order.ts'
import {
  BONEYARD_ENEMY_EVENT_LANE_CAPACITY,
  DEFAULT_PLAYER_CHARACTER_CONFIG,
  GAME_TICK_RATE,
  addPlayerCharacter,
  applyGameSimulationHubAction,
  armGameSimulationCollegeIntro,
  bindGameSimulationPlayerSkillQuickbar,
  confirmGameSimulationLoadout,
  createGameSimulation,
  damageGameSimulationPlayer,
  declineGameSimulationTutorial,
  detachGameSimulationPlayer,
  enterBoneyardWorld,
  gameSimulationDurableProfileEconomy,
  getPlayerBelt,
  getPlayerCharacter,
  getPlayerEconomy,
  getPlayerProgression,
  getPlayerSkillBook,
  grantGameSimulationPlayerExperience,
  projectDetachedGameSimulationPlayer,
  rejoinGameSimulationPlayer,
  removePlayerCharacter,
  replaceGameSimulationPlayerSkillWithMod,
  rerollGameSimulationPlayerSkill,
  returnGameSimulationToHub,
  saveGameSimulationPlayerSkill,
  selectDetachedGameSimulationPlayerSkill,
  selectGameSimulationPlayerPrimarySkill,
  selectGameSimulationPlayerSkill,
  stepGameSimulation,
  stepGameSimulationTick,
  synchronizeDetachedGameSimulationPlayer,
} from './game-simulation.ts'

import type { GameSimulationExtensions, GameSimulationState } from './game-simulation.ts'
import { damageBoneyardEnemy } from './enemies/damage.ts'
import { positionBoneyardEnemy, stepBoneyardEnemyStore } from './boneyard-enemy-store.ts'
import { NATIVE_MAGE_ACTION_PROGRAMS } from './enemies/programs.ts'
import type { BoneyardEnemySemanticEvent } from './enemies/model.ts'
import { createBoneyardLootStore, spawnBoneyardLootSpecs } from './boneyard-loot-store.ts'
import { createNativeLootItemIds, miscItem, potionItem } from '../core-kernels/native-loot-items.ts'
import { sealPlayerCombatInput } from './player-combat-input.ts'
import {
  damagePlayerEntity,
  dazzlePlayerEntity,
  grantPlayerEntitySkillRanks,
  grantPlayerEntityWeldBuild,
  playerCharacterRecords,
  playerLightingAt,
  playerSkillDerivedStatsAt,
  playerSkillRuntimeAt,
  poisonPlayerEntity,
  replacePlayerCharacter,
  replacePlayerCharacterRecords,
  replacePlayerEconomy,
  selectPlayerEntityConcentration,
  setPlayerDeathWeaponPainterRegistration,
  setPlayerEntityMana,
  setPlayerEntitySkillRuntime,
  unlockPlayerEntityAdvancedSkill,
} from './player-entity-store.ts'

function gameplayInput(x: number, y: number) {
  return {
    aim: null,
    cast: { primary: false, quickbar: null },
    movement: { x, y },
    viewportHeight: 900,
    viewportWidth: 1_600,
  }
}

test('a level-up barrier preserves the unchanged authority and flash owner for snapshot caching', () => {
  const state = createGameSimulation(undefined, { initialPlayerExperience: 1000 })
  assert.ok(state.levelUpBarrier)
  assert.equal(stepGameSimulationTick(state, {}), state)
})

for (const [skillId, toggle] of [[23, 'firewalker'], [78, 'mindstar'], [79, 'regenerate']] as const) {
  for (const party of [false, true]) {
    test(`${toggle} survives a real enemy-reward level-up and its ${party ? 'party' : 'solo'} picker`, () => {
      const heldInput = { ...gameplayInput(0, 0), cast: { primary: false, quickbar: 0 } }
      let state = createGameSimulation({ caster: { ...DEFAULT_PLAYER_CHARACTER_CONFIG, element: 'fire' },
        ...(party ? { peer: DEFAULT_PLAYER_CHARACTER_CONFIG } : {}),
      })
      const granted = grantPlayerEntitySkillRanks(state.playerEntities, 'caster', skillId, 1, state.gameRng)
      state = enterBoneyardWorld({ ...state, playerEntities: granted.store, gameRng: granted.rng },
        combatBoneyard(`level-toggle-${skillId}-${party}`))
      state = bindGameSimulationPlayerSkillQuickbar(state, 'caster', skillId, 0)!
      state = grantGameSimulationPlayerExperience(state, 'caster', 89)
      assert.equal(state.levelUpBarrier, null)
      const activated = applyGameSimulationHubAction(state, 'caster', { type: 'activate-belt-slot', slot: 0 })
      assert.equal(activated.accepted, true)
      state = activated.state
      assert.equal(state.secondaryAbilities.players.caster![toggle], true)
      const reservedMana = state.secondaryAbilities.players.caster!.reservedMana
      assert.ok(reservedMana > 0)
      if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
      const order = createNativeWorldManagerOrder(state.worldManagerOrder)
      const spawned = stepBoneyardEnemyStore(state.world.enemies, {
        projectileWorldBlocked: () => false, players: {},
        resolveMovement: ({ requestedPosition }) => requestedPosition,
        registerWorldPainter: order.register,
        resolveSpawnIntents: () => [{ enemyToken: 'SKELETON', flags: [], id: 1,
          locationPolicy: 'anywhere', nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
          position: { x: 300, y: 140 }, spawnTick: state.tick, waveOrdinal: 1 }], tick: state.tick,
      }).store
      const killed = damageBoneyardEnemy(spawned, { actorId: 1, amount: 10_000,
        sourcePlayerId: 'caster', tick: state.tick, registerWorldPainter: order.register })
      assert.equal(killed.killed, true)
      state = { ...state, worldManagerOrder: order.state(), world: { ...state.world, enemies: killed.store } }
      state = stepGameSimulationTick(state, { caster: heldInput })
      assert.equal(getPlayerProgression(state, 'caster').level, 2)
      assert.equal(getPlayerProgression(state, 'caster').experience, party ? 97.5 : 93.25)
      assert.ok(state.levelUpBarrier)
      assert.equal(state.secondaryAbilities.players.caster![toggle], true)
      assert.equal(state.secondaryAbilities.players.caster!.reservedMana, reservedMana)
      assert.equal(state.secondaryAbilities.players.caster!.heldSlot, 0)
      assert.equal(playerSkillRuntimeAt(state.playerEntities, 'caster')!.mindstarActive, toggle === 'mindstar')
      assert.equal(stepGameSimulationTick(state, { caster: heldInput }), state)
      const rejected = applyGameSimulationHubAction(state, 'caster', { type: 'activate-belt-slot', slot: 0 })
      assert.equal(rejected.accepted, false)
      assert.equal(rejected.state, state)
      for (const playerId of party ? ['caster', 'peer'] : ['caster']) {
        const offer = getPlayerProgression(state, playerId).pendingOffer!
        state = selectGameSimulationPlayerSkill(state, playerId, {
          choiceIndex: 0, offerSequence: offer.sequence, skillId: offer.options[0]!.skillId,
        })!
        assert.equal(state.secondaryAbilities.players.caster![toggle], true)
        if (party && playerId === 'caster') assert.equal(stepGameSimulationTick(state, {}), state)
      }
      assert.equal(state.levelUpBarrier, null)
      const castSequence = state.secondaryAbilities.players.caster!.castSequence
      state = stepGameSimulationTick(state, { caster: heldInput })
      assert.equal(state.secondaryAbilities.players.caster![toggle], true)
      assert.equal(state.secondaryAbilities.players.caster!.castSequence, castSequence)
      assert.equal(playerSkillRuntimeAt(state.playerEntities, 'caster')!.mindstarActive, toggle === 'mindstar')
    })
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
  const order = createNativeWorldManagerOrder()
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

  const deferred = createDeferredNativeWorldManagerRegistrations()
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
  const merged = mergeNativeWorldManagerOwners([
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

test('initial Hub registers every fixed actor, then players, then Students', () => {
  const state = createGameSimulation({
    first: { discipline: 'arcane', displayName: 'First', element: 'fire' },
    second: { discipline: 'mind', displayName: 'Second', element: 'air' },
  })
  assert.equal(state.world.kind, 'hub')
  if (state.world.kind !== 'hub') throw new Error('expected Hub world')
  const fixedCount = NATIVE_HUB_FIXED_ACTOR_PAINTER_IDS.length
  assert.deepEqual(
    state.playerEntities.lightings.map(({ lightRegistration }) => lightRegistration),
    [
      { managerLane: 'actor', registrationOrdinal: fixedCount },
      { managerLane: 'actor', registrationOrdinal: fixedCount + 1 },
    ],
  )
  const studentOrdinals = state.world.studentPopulation.students.map(
    ({ painterRegistration }) => painterRegistration.registrationOrdinal,
  )
  assert.ok(studentOrdinals.length > 0)
  assert.deepEqual(
    studentOrdinals,
    studentOrdinals.map((_, index) => fixedCount + 2 + index),
  )
})

test('shared Hub region reattachment appends the moving player after live Students', () => {
  let state = createGameSimulation({
    resident: { discipline: 'arcane', displayName: 'Resident', element: 'fire' },
    traveler: { discipline: 'mind', displayName: 'Traveler', element: 'air' },
  })
  const playerOrdinal = () => (
    playerLightingAt(state.playerEntities, 'traveler')!.lightRegistration.registrationOrdinal
  )
  const maximumStudentOrdinal = () => {
    if (state.world.kind !== 'hub') throw new Error('expected Hub world')
    return Math.max(...state.world.studentPopulation.students.map(
      ({ painterRegistration }) => painterRegistration.registrationOrdinal,
    ))
  }
  const coverTransition = (
    sourceRegion: 'courtyard' | 'mortuary',
    destination: 'courtyard' | 'mortuary',
  ) => {
    if (state.world.kind !== 'hub') throw new Error('expected Hub world')
    const participant = state.world.participants.traveler!
    state = {
      ...state,
      world: {
        ...state.world,
        participants: {
          ...state.world.participants,
          traveler: {
            ...participant,
            region: sourceRegion,
            transition: {
              alpha: 1,
              destination,
              phase: 'outgoing',
              scriptedSpeed: 1,
              scriptedTarget: { x: 0, y: 0 },
              sourceRegion,
            },
          },
        },
      },
    }
    state = stepGameSimulationTick(state, {})
  }

  assert.ok(playerOrdinal() < maximumStudentOrdinal())

  coverTransition('courtyard', 'mortuary')
  if (state.world.kind !== 'hub') throw new Error('expected Hub world')
  assert.equal(state.world.participants.traveler?.region, 'mortuary')
  assert.ok(playerOrdinal() > maximumStudentOrdinal())

  coverTransition('mortuary', 'courtyard')
  if (state.world.kind !== 'hub') throw new Error('expected Hub world')
  assert.equal(state.world.participants.traveler?.region, 'courtyard')
  assert.ok(playerOrdinal() > maximumStudentOrdinal())
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
  assert.notEqual(getPlayerCharacter(state, 'owner').headingDegrees, 30)
  assert.equal(actorHeadingIndex(getPlayerCharacter(state, 'owner').headingDegrees), 2)
  assert.equal(getPlayerCharacter(state, 'owner').primaryCast.selectedPrimaryId, -1)
  assert.equal(getPlayerCharacter(state, 'owner').primaryCast.actionTick, -1)
  const staleCollegeCharacter = getPlayerCharacter(state, 'owner')
  state = {
    ...state,
    playerEntities: replacePlayerCharacter(state.playerEntities, 'owner', {
      ...staleCollegeCharacter,
      primaryCast: {
        ...staleCollegeCharacter.primaryCast,
        actionTick: 0,
        selectedPrimaryId: 8,
      },
    }),
  }
  state = armGameSimulationCollegeIntro(state, 'owner')
  assert.equal(getPlayerCharacter(state, 'owner').primaryCast.selectedPrimaryId, -1)
  assert.equal(getPlayerCharacter(state, 'owner').primaryCast.actionTick, -1)
  const collegeStarterTint = getPlayerEconomy(state, 'owner').equipment.hat?.iconTints
  assert.ok(collegeStarterTint)
  assert.notDeepEqual(collegeStarterTint, initialStarterTint)
  assert.deepEqual(getPlayerEconomy(state, 'owner').equipment.robe?.iconTints, collegeStarterTint)
  assert.equal(collegeStarterTint[1], 0xffffff)

  state = withPlayerSkillRank(state, 'owner', 16, 1)
  const boundAlternatePrimary = bindGameSimulationPlayerSkillQuickbar(
    state,
    'owner',
    16,
    7,
  )
  assert.ok(boundAlternatePrimary)
  state = boundAlternatePrimary
  assert.equal(selectGameSimulationPlayerPrimarySkill(state, 'owner', 16), null)
  const alternatePrimaryInput = {
    ...gameplayInput(0, 0),
    cast: { primary: false, quickbar: 7 },
  }
  state = stepGameSimulationTick(state, { owner: alternatePrimaryInput })
  assert.equal(getPlayerSkillBook(state, 'owner').primarySkillId, 8)
  assert.equal(getPlayerCharacter(state, 'owner').primaryCast.selectedPrimaryId, -1)

  for (let tick = 0; tick < 5_000; tick += 1) {
    if (ownerParticipant()?.collegeIntro?.phase === 'arch-dialogue') break
    state = stepGameSimulationTick(state, {}, {
      collegeIntroReadyPlayerIds: new Set(['owner']),
    })
  }

  assert.equal(ownerParticipant()?.region, 'office')
  assert.equal(ownerParticipant()?.collegeIntro?.phase, 'arch-dialogue')
  assert.equal(getPlayerCharacter(state, 'owner').primaryCast.selectedPrimaryId, -1)
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
  assert.equal(getPlayerCharacter(state, 'owner').primaryCast.selectedPrimaryId, -1)
  assert.strictEqual(armGameSimulationCollegeIntro(state, 'owner'), state)
  assert.equal(hubCollegeAdmissionPreLoadout(
    ownerParticipant(),
    getPlayerEconomy(state, 'owner').collegeIntroPending,
  ), true)
  state = stepGameSimulationTick(state, { owner: alternatePrimaryInput })
  assert.equal(getPlayerSkillBook(state, 'owner').primarySkillId, 8)
  assert.equal(getPlayerCharacter(state, 'owner').primaryCast.selectedPrimaryId, -1)
  const staleOfficeCharacter = getPlayerCharacter(state, 'owner')
  state = {
    ...state,
    playerEntities: replacePlayerCharacter(state.playerEntities, 'owner', {
      ...staleOfficeCharacter,
      primaryCast: { ...staleOfficeCharacter.primaryCast, selectedPrimaryId: 8 },
    }),
  }
  state = armGameSimulationCollegeIntro(state, 'owner')
  assert.equal(getPlayerCharacter(state, 'owner').primaryCast.selectedPrimaryId, -1)
  assert.strictEqual(armGameSimulationCollegeIntro(state, 'owner'), state)

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
  state = stepGameSimulationTick(state, { owner: alternatePrimaryInput })
  assert.equal(getPlayerSkillBook(state, 'owner').primarySkillId, 8)
  assert.equal(getPlayerCharacter(state, 'owner').primaryCast.selectedPrimaryId, -1)
  const staleLoadoutCharacter = getPlayerCharacter(state, 'owner')
  state = {
    ...state,
    playerEntities: replacePlayerCharacter(state.playerEntities, 'owner', {
      ...staleLoadoutCharacter,
      primaryCast: { ...staleLoadoutCharacter.primaryCast, selectedPrimaryId: 8 },
    }),
  }
  state = armGameSimulationCollegeIntro(state, 'owner')
  assert.equal(getPlayerCharacter(state, 'owner').primaryCast.selectedPrimaryId, -1)

  const purchased = unlockPlayerEntityAdvancedSkill(state.playerEntities, 'owner', 78)
  assert.ok(purchased)
  state = withPlayerSkillRank({ ...state, playerEntities: purchased }, 'owner', 78, 1)
  const learned = bindGameSimulationPlayerSkillQuickbar(state, 'owner', 78, 7)
  assert.ok(learned)
  state = learned
  assert.equal(getPlayerSkillBook(state, 'owner').advancedUnlocks[6], true)
  assert.equal(getPlayerSkillBook(state, 'owner').permanentRanks[78], 1)
  state = { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, 'owner', {
    ...getPlayerEconomy(state, 'owner'), ownedPerkSelectors: [14],
  }) }
  const confirmed = confirmGameSimulationLoadout(state, 'owner', {
    discipline: 'body',
    displayName: 'Reborn',
    element: 'air',
  })
  assert.ok(confirmed)
  state = confirmed
  assert.equal(ownerParticipant()?.transition?.phase, 'incoming')
  assert.equal(getPlayerCharacter(state, 'owner').config.displayName, 'Reborn')
  assert.equal(NATIVE_SECONDARY_ABILITY_IDS.filter(id => getPlayerSkillBook(state, 'owner').permanentRanks[id]! > 0).length, 2)
  assert.equal(getPlayerSkillBook(state, 'owner').advancedUnlocks[6], true)
  assert.equal(getPlayerSkillBook(state, 'owner').permanentRanks[78], 0)
  assert.equal(getPlayerBelt(state, 'owner').some(slot => slot?.kind === 'skill' && slot.skillId === 78), false)
  assert.equal(getPlayerCharacter(state, 'owner').primaryCast.selectedPrimaryId, 24)
  assert.deepEqual(getPlayerEconomy(state, 'owner').equipment.hat?.iconTints, collegeStarterTint)
  assert.deepEqual(
    getPlayerEconomy(state, 'owner').equipment.robe?.iconTints,
    collegeStarterTint,
  )
  assert.equal(getPlayerEconomy(state, 'owner').collegeIntroPending, false)
  assert.equal(getPlayerEconomy(state, 'owner').tutorialPending, false)
  assert.equal(getPlayerEconomy(state, 'owner').revision, initialRevision + 1)
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
  assert.equal(getPlayerEconomy(state, 'owner').revision, initialRevision + 1)
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
  assert.deepEqual(state.world.solomonPainterRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 3,
  })

  state = removePlayerCharacter(state, 'first')
  state = addPlayerCharacter(state, 'first', {
    discipline: 'arcane',
    displayName: 'First',
    element: 'fire',
  })
  assert.deepEqual(playerLightingAt(state.playerEntities, 'first')?.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: 4,
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

  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const player = getPlayerCharacter(state, 'caster')
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    projectileWorldBlocked: () => false,
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
    registerWorldPainter: order.register,
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
    worldManagerOrder: order.state(),
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
      viewportHeight: 900,
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
    registrationOrdinal: 4,
  })
  assert.deepEqual(guided.painterRegistration, guided.lightRegistration)
  assert.deepEqual(state.worldManagerOrder.nextRegistrationOrdinal, {
    actor: 5,
    transient: 0,
  })
})

test('same-tick wave actors register before player primary actors', () => {
  const loaded = emptyBoneyard()
  loaded.runId = 'wave-provider-order-run'
  // Opening enemies need a full combat arena beyond the entrance and player light.
  loaded.scene.bounds = { x: 0, y: 0, w: 1_000, h: 1_000 }
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
      viewportHeight: 900,
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
      registrationOrdinal: index + 3,
    })),
  )
  assert.deepEqual(fire.lightRegistration, {
    managerLane: 'actor',
    registrationOrdinal: openingCount + 3,
  })
  assert.deepEqual(state.worldManagerOrder.nextRegistrationOrdinal, {
    actor: openingCount + 5,
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
    viewportHeight: 900,
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
        viewportHeight: 900,
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
        viewportHeight: 900,
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
        viewportHeight: 900,
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
    viewportHeight: 900,
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
  // Opening enemies need a full combat arena beyond the entrance and player light.
  loaded.scene.bounds = { x: 0, y: 0, w: 1_000, h: 1_000 }
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
      viewportHeight: 900,
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
      viewportHeight: 900,
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
      viewportHeight: 900,
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

test('a secondary edge is admitted while primary remains held, then the native action hands control back', () => {
  let state = enterBoneyardWorld(createGameSimulation({ caster: {
    discipline: 'arcane',
    displayName: 'Overlapping Caster',
    element: 'ether',
  } }), combatBoneyard('overlapping-primary-secondary'))
  const player = getPlayerCharacter(state, 'caster')
  const held = {
    aim: { x: player.position.x + 100, y: player.position.y },
    cast: { primary: true, quickbar: 0 },
    movement: { x: 0, y: 0 },
    viewportHeight: 900,
    viewportWidth: 1_600,
  }
  state = stepGameSimulationTick(state, { caster: held })
  assert.equal(state.secondaryAbilities.players.caster?.castSequence, 1)
  assert.ok(state.secondaryAbilities.players.caster?.castAction)
  assert.equal(getPlayerCharacter(state, 'caster').primaryCast.castSequence, 0)

  for (let tick = 0; tick < 80
    && getPlayerCharacter(state, 'caster').primaryCast.castSequence === 0; tick += 1) {
    state = stepGameSimulationTick(state, {
      caster: { ...held, cast: { primary: true, quickbar: null } },
    })
  }
  assert.equal(state.secondaryAbilities.players.caster?.castAction, null)
  assert.equal(getPlayerCharacter(state, 'caster').primaryCast.castSequence, 1)
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
    skillBookOutcome: null,
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
    skillBookOutcome: null,
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

test('Shlorio reference rolls resolve only the authenticated player inventory', () => {
  const character = { discipline: 'arcane', displayName: 'Dowsing', element: 'water' } as const
  let state = createGameSimulation({ first: character, second: character })
  const reference = createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[16]!, 90_039)
  state = { ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'first', {
      ...getPlayerEconomy(state, 'first'), backpack: [reference], gold: 20_000,
    }) }
  state = { ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'second', {
      ...getPlayerEconomy(state, 'second'), gold: 20_000,
    }) }
  const firstBefore = getPlayerEconomy(state, 'first')
  const secondBefore = getPlayerEconomy(state, 'second')
  const denied = applyGameSimulationHubAction(state, 'second', { type: 'dowse', referenceItemId: reference.id })
  assert.equal(denied.accepted, false)
  assert.equal(denied.reason, 'item-not-found')
  const secondAfter = getPlayerEconomy(denied.state, 'second')
  assert.equal(secondAfter.gold, secondBefore.gold)
  assert.deepEqual(secondAfter.rng, secondBefore.rng)
  assert.deepEqual(secondAfter.backpack, secondBefore.backpack)
  assert.equal(secondAfter.dowsingRolled, false)
  assert.strictEqual(getPlayerEconomy(denied.state, 'first'), firstBefore)
  const accepted = applyGameSimulationHubAction(denied.state, 'first', { type: 'dowse', referenceItemId: reference.id })
  assert.equal(accepted.accepted, true)
  const firstAfter = getPlayerEconomy(accepted.state, 'first')
  assert.equal(firstAfter.dowsingRolled, true)
  assert.equal(firstAfter.gold, 19_350)
  assert.ok(firstAfter.dowsingOffers.length >= 5)
  assert.ok(findInventoryItem(firstAfter.backpack, reference.id))
  assert.strictEqual(getPlayerEconomy(accepted.state, 'second'), secondAfter)
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
  applyFirst({ selector: 0, type: 'remove-hagatha' })
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
  assert.equal(mutatedFirst.ownedPerkSelectors.includes(0), false)
  assert.equal(mutatedFirst.firstMixedSelectors.includes(0), true)
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

test('Cosmofluxic Wand with Revelation equips, snapshots, saves, and unequips Dampen', () => {
  const owner = { discipline: 'arcane', displayName: 'Owner', element: 'ether' } as const
  const peer = { discipline: 'mind', displayName: 'Peer', element: 'water' } as const
  let state = createGameSimulation({ owner, peer })
  const initialEconomy = getPlayerEconomy(state, 'owner')
  state = {
    ...state,
    playerEntities: replacePlayerCharacter(
      replacePlayerEconomy(state.playerEntities, 'owner', {
        ...initialEconomy,
        gold: 100_000,
        revision: initialEconomy.revision + 1,
      }),
      'owner',
      { ...getPlayerCharacter(state, 'owner'), position: { x: 1340, y: 280 } },
    ),
  }
  const revelation = applyGameSimulationHubAction(state, 'owner', {
    type: 'buy-hagatha', selector: 6,
  })
  assert.equal(revelation.accepted, true)
  state = revelation.state
  const economy = getPlayerEconomy(state, 'owner')
  const wand = createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[2]!, economy.nextItemId)
  state = {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'owner', {
      ...economy,
      backpack: [...economy.backpack, wand],
      nextItemId: economy.nextItemId + 1,
      revision: economy.revision + 1,
    }),
  }
  const equipped = applyGameSimulationHubAction(state, 'owner', {
    itemId: wand.id, slot: 'weapon', type: 'equip',
  })
  assert.equal(equipped.accepted, true)
  state = equipped.state
  assert.equal(getPlayerEconomy(state, 'owner').equipment.weapon?.name, 'Cosmofluxic Wand')
  assert.equal(getPlayerSkillBook(state, 'owner').permanentRanks[51], 0)
  assert.equal(getPlayerSkillBook(state, 'owner').effectiveRanks[51], 2)
  assert.equal(getPlayerSkillBook(state, 'owner').effectiveRanks[49], 2)
  assert.equal(getPlayerSkillBook(state, 'peer').effectiveRanks[51], 0)

  const snapshot = createGameSnapshot(state, 'owner')
  assert.deepEqual(
    snapshot.players.owner!.progression.secondaryManaCosts.find(([id]) => id === 51),
    [51, 90],
  )
  const restored = restoreGameSaveDocument(createGameSaveDocument({
    integrity: 'local-only', loadedBoneyard: null, mods: [], modState: {},
    playerId: 'owner', state,
  })).state
  assert.equal(getPlayerSkillBook(restored, 'owner').effectiveRanks[51], 2)
  assert.deepEqual(
    createGameSnapshot(restored, 'owner').players.owner!.progression.secondaryManaCosts
      .find(([id]) => id === 51),
    [51, 90],
  )
  const unequipped = applyGameSimulationHubAction(state, 'owner', {
    slot: 'weapon', type: 'unequip',
  })
  assert.equal(unequipped.accepted, true)
  assert.equal(getPlayerSkillBook(unequipped.state, 'owner').effectiveRanks[51], 0)
})

test('addressed Ring unequip remains in its nested Sack through the host action and save', () => {
  const owner = { discipline: 'arcane', displayName: 'Owner', element: 'ether' } as const
  const base = createGameSimulation({ owner })
  const economy = getPlayerEconomy(base, 'owner')
  const recipe = DOWSING_EQUIPMENT_RECIPES.find((row) => row.type === 'ring' && row.level === 0)!
  const ring = createEquipmentInventoryItem(recipe, 41_001)
  const inner: HubInventoryItem = {
    ...economy.backpack[0]!, id: 41_002, kind: 'sack', nativeTypeId: 7008,
    name: 'Inner Sack', nativeSubtype: 0, iconRecords: [70], inventorySlot: 0, contents: [],
  }
  const outer: HubInventoryItem = {
    ...inner, id: 41_003, name: 'Outer Sack', inventorySlot: 2, contents: [inner],
  }
  const state = {
    ...base,
    playerEntities: replacePlayerEconomy(base.playerEntities, 'owner', {
      ...economy,
      backpack: [...economy.backpack, outer],
      equipment: { ...economy.equipment, rings: [ring, null, null] as const },
      nextItemId: 41_004,
    }),
  }
  const dropped = applyGameSimulationHubAction(state, 'owner', {
    type: 'unequip', slot: 'ring-0', destinationSackId: inner.id, destinationSlot: 12,
  })
  assert.equal(dropped.accepted, true)
  assert.deepEqual(
    projectInventoryItems(getPlayerEconomy(dropped.state, 'owner').backpack)
      .filter(({ item }) => item.id === ring.id)
      .map(({ depth, parentSackId, slot }) => [depth, parentSackId, slot]),
    [[2, inner.id, 12]],
  )
  const restored = restoreGameSaveDocument(createGameSaveDocument({
    integrity: 'local-only', loadedBoneyard: null, mods: [], modState: {},
    playerId: 'owner', state: dropped.state,
  })).state
  assert.deepEqual(
    projectInventoryItems(getPlayerEconomy(restored, 'owner').backpack)
      .filter(({ item }) => item.id === ring.id)
      .map(({ depth, parentSackId, slot }) => [depth, parentSackId, slot]),
    [[2, inner.id, 12]],
  )
})

test('locked Goodies require an explicit nearest-facing interaction and consume one recursive Wizard Key', () => {
  let state = enterBoneyardWorld(createGameSimulation(), emptyBoneyard())
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  state = {
    ...state,
    playerEntities: replacePlayerCharacter(state.playerEntities, 'local-player', {
      ...getPlayerCharacter(state),
      headingDegrees: 0,
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
  const closed = applyGameSimulationHubAction(purchased.state, 'owner', {
    type: 'close-hagatha',
  })
  assert.equal(closed.accepted, true)
  assert.deepEqual(getPlayerEconomy(closed.state, 'owner').hagathaBundleSelectors, [24])
  const hurt = {
    ...closed.state,
    playerEntities: damagePlayerEntity(closed.state.playerEntities, 'owner', 1, 1),
  }
  assert.equal(playerSkillDerivedStatsAt(hurt.playerEntities, 'owner')?.offensiveDamageFactor, 1)
})

test('a full two-Tonic mind rejects the eighth ordinary purchase without effects or peer mutation', () => {
  let state = createGameSimulation({
    owner: {
      discipline: 'arcane',
      displayName: 'Full Mind',
      element: 'ether',
    },
    peer: {
      discipline: 'body',
      displayName: 'Peer',
      element: 'water',
    },
  })
  const ownerEconomy = getPlayerEconomy(state, 'owner')
  const peerEconomy = getPlayerEconomy(state, 'peer')
  state = {
    ...state,
    playerEntities: replacePlayerCharacter(
      replacePlayerEconomy(state.playerEntities, 'owner', {
        ...ownerEconomy,
        charmCapacity: 9,
        firstMixedSelectors: [27, 0, 1, 2, 3, 4, 5, 6],
        gold: 1_000_000,
        ownedPerkSelectors: [27, 27, 0, 1, 2, 3, 4, 5, 6],
        tonicPurchases: 2,
      }),
      'owner',
      { ...getPlayerCharacter(state, 'owner'), position: { x: 1340, y: 280 } },
    ),
  }

  const result = applyGameSimulationHubAction(state, 'owner', {
    type: 'buy-hagatha',
    selector: 24,
  })
  assert.equal(result.accepted, false)
  assert.equal(result.reason, 'perk-capacity-full')
  const rejectedEconomy = getPlayerEconomy(result.state, 'owner')
  assert.equal(rejectedEconomy.gold, 1_000_000)
  assert.deepEqual(rejectedEconomy.ownedPerkSelectors, [27, 27, 0, 1, 2, 3, 4, 5, 6])
  assert.equal(getPlayerProgression(result.state, 'owner').hagathaRuntime.serendipityActive, false)
  assert.strictEqual(getPlayerEconomy(result.state, 'peer'), peerEconomy)
})

test('requested Hagatha removal deactivates runtime and reactivation does not repeat Weird Caster grants', () => {
  let state = createGameSimulation({
    owner: {
      discipline: 'arcane',
      displayName: 'Hagatha Removal',
      element: 'ether',
    },
  })
  const economy = getPlayerEconomy(state, 'owner')
  state = {
    ...state,
    playerEntities: replacePlayerCharacter(
      replacePlayerEconomy(state.playerEntities, 'owner', { ...economy, gold: 20_000 }),
      'owner',
      { ...getPlayerCharacter(state, 'owner'), position: { x: 1340, y: 280 } },
    ),
  }
  state = applyGameSimulationHubAction(state, 'owner', {
    type: 'buy-hagatha',
    selector: 24,
  }).state
  assert.equal(playerSkillDerivedStatsAt(state.playerEntities, 'owner')?.offensiveDamageFactor, 3)
  const goldBeforeRemoval = getPlayerEconomy(state, 'owner').gold
  state = applyGameSimulationHubAction(state, 'owner', {
    type: 'remove-hagatha',
    selector: 24,
  }).state
  assert.equal(getPlayerEconomy(state, 'owner').gold, goldBeforeRemoval)
  assert.equal(playerSkillDerivedStatsAt(state.playerEntities, 'owner')?.offensiveDamageFactor, 1)
  assert.equal(getPlayerProgression(state, 'owner').hagathaRuntime.serendipityActive, false)

  state = applyGameSimulationHubAction(state, 'owner', {
    type: 'buy-hagatha',
    selector: 14,
  }).state
  const secondaryCount = getPlayerSkillBook(state, 'owner').permanentRanks.filter(
    (rank, skillId) => rank > 0
      && NATIVE_SECONDARY_ABILITY_IDS.includes(skillId as NativeSecondaryAbilityId),
  ).length
  state = applyGameSimulationHubAction(state, 'owner', {
    type: 'remove-hagatha',
    selector: 14,
  }).state
  state = applyGameSimulationHubAction(state, 'owner', {
    type: 'buy-hagatha',
    selector: 14,
  }).state
  assert.equal(getPlayerSkillBook(state, 'owner').permanentRanks.filter(
    (rank, skillId) => rank > 0
      && NATIVE_SECONDARY_ABILITY_IDS.includes(skillId as NativeSecondaryAbilityId),
  ).length, secondaryCount)
  const combat = enterBoneyardWorld(state, emptyBoneyard())
  const denied = applyGameSimulationHubAction(combat, 'owner', { type: 'remove-hagatha', selector: 14 })
  assert.equal(denied.accepted, false)
  assert.equal(denied.reason, 'service-unavailable')
  assert.deepEqual(getPlayerEconomy(denied.state, 'owner').ownedPerkSelectors,
    getPlayerEconomy(combat, 'owner').ownedPerkSelectors)

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

test('authoritative equipment admission uses player level and permanent Creativity in both worlds', () => {
  const ringRecipe = DOWSING_EQUIPMENT_RECIPES.find(({ type }) => type === 'ring')!
  const initial = createGameSimulation()
  const economy = getPlayerEconomy(initial)
  const ring = {
    ...createEquipmentInventoryItem(ringRecipe, economy.nextItemId),
    generatedLevel: 8,
    inventorySlot: 2,
  }
  const seeded = {
    ...initial,
    playerEntities: replacePlayerEconomy(initial.playerEntities, 'local-player', {
      ...economy,
      backpack: [...economy.backpack, ring],
      nextItemId: economy.nextItemId + 1,
      revision: economy.revision + 1,
    }),
  }
  assert.equal(getPlayerProgression(seeded).level, 1)

  for (const [world, state] of [
    ['College', seeded],
    ['Boneyard', enterBoneyardWorld(seeded, emptyBoneyard())],
  ] as const) {
    const rejected = applyGameSimulationHubAction(state, 'local-player', {
      itemId: ring.id,
      slot: 'ring-0',
      type: 'equip',
    })
    assert.equal(rejected.accepted, false, world)
    assert.equal(rejected.reason, 'ineligible-item', world)
    assert.strictEqual(getPlayerEconomy(rejected.state).equipment.rings[0], null, world)
    assert.strictEqual(findInventoryItem(getPlayerEconomy(rejected.state).backpack, ring.id), ring)
  }

  const bound = applyGameSimulationHubAction(seeded, 'local-player', {
    itemId: ring.id,
    slot: 2,
    type: 'bind-belt-item',
  })
  assert.equal(bound.accepted, true)
  const beltRejected = applyGameSimulationHubAction(bound.state, 'local-player', {
    slot: 2,
    type: 'activate-belt-slot',
  })
  assert.equal(beltRejected.accepted, false)
  assert.equal(beltRejected.reason, 'ineligible-item')
  assert.strictEqual(getPlayerEconomy(beltRejected.state).equipment.rings[0], null)
  assert.strictEqual(findInventoryItem(getPlayerEconomy(beltRejected.state).backpack, ring.id), ring)

  const playerIndex = seeded.playerEntities.identities.findIndex(
    ({ playerId }) => playerId === 'local-player',
  )
  const skillBooks = [...seeded.playerEntities.skillBooks]
  const skillBook = skillBooks[playerIndex]!
  const permanentRanks = [...skillBook.permanentRanks]
  permanentRanks[NATIVE_EQUIPMENT_LEVEL_REDUCTION_SKILL_ID] = 1
  skillBooks[playerIndex] = { ...skillBook, permanentRanks: Object.freeze(permanentRanks) }
  const reducedRing = { ...ring, generatedLevel: 3 }
  const creativeEconomy = {
    ...getPlayerEconomy(seeded),
    backpack: getPlayerEconomy(seeded).backpack.map((item) => (
      item.id === reducedRing.id ? reducedRing : item
    )),
  }
  const creativeState = {
    ...seeded,
    playerEntities: replacePlayerEconomy(
      { ...seeded.playerEntities, skillBooks: Object.freeze(skillBooks) },
      'local-player',
      creativeEconomy,
    ),
  }
  const admitted = applyGameSimulationHubAction(creativeState, 'local-player', {
    itemId: reducedRing.id,
    slot: 'ring-0',
    type: 'equip',
  })
  assert.equal(admitted.accepted, true)
  assert.strictEqual(getPlayerEconomy(admitted.state).equipment.rings[0], reducedRing)
})

test('native item belt binds shortcuts without moving ownership and activates exact item families', () => {
  let state = createGameSimulation()
  const economy = getPlayerEconomy(state)
  const ringRecipe = DOWSING_EQUIPMENT_RECIPES.find(({ type }) => type === 'ring')!
  const hatRecipe = DOWSING_EQUIPMENT_RECIPES.find(({ type }) => type === 'hat')!
  const ring = {
    ...createEquipmentInventoryItem(ringRecipe, economy.nextItemId),
    inventorySlot: 0,
  }
  const hat = {
    ...createEquipmentInventoryItem(hatRecipe, economy.nextItemId + 1),
    inventorySlot: 1,
  }
  const sack: HubInventoryItem = {
    contents: [ring, hat],
    equipmentType: null,
    iconRecords: [70],
    id: economy.nextItemId + 2,
    inventorySlot: 2,
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
    inventorySlot: 3,
    kind: 'wizard-chug',
    name: 'Wizard Chug',
    nativeSubtype: 2,
  }
  const misc: HubInventoryItem = {
    equipmentType: null,
    iconRecords: [43],
    id: economy.nextItemId + 4,
    inventorySlot: 4,
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

for (const slot of [0, 7, 8, 15, 16, 23]) test(`Inventory belt slot ${slot} casts Ring of Ice while the Boneyard tick stays frozen`, () => {
  const learned = withPlayerSkillRank(createGameSimulation(), 'local-player', 35, 1)
  const bound = bindGameSimulationPlayerSkillQuickbar(learned, 'local-player', 35, slot)
  assert.ok(bound)
  const loaded = emptyBoneyard()
  const paused = enterBoneyardWorld(bound, loaded)
  const manaBefore = getPlayerProgression(paused).currentMana
  const result = applyGameSimulationHubAction(paused, 'local-player', {
    slot,
    type: 'activate-belt-slot',
  })

  assert.equal(result.accepted, true)
  assert.equal(result.state.tick, paused.tick)
  assert.strictEqual(result.state.world, paused.world)
  assert.equal(result.state.secondaryAbilities.players['local-player']?.castSequence, 1)
  assert.ok(result.state.secondaryAbilities.actors.some(({ kind }) => kind === 'freeze-wave'))
  assert.ok((result.state.secondaryAbilities.players['local-player']?.cooldownTicksBySkill[35] ?? 0) > 0)
  assert.ok(getPlayerProgression(result.state).currentMana < manaBefore)
  const restored = restoreGameSaveDocument(createGameSaveDocument({
    integrity: 'local-only', loadedBoneyard: loaded, mods: [], modState: {},
    playerId: 'local-player', state: result.state,
  })).state
  assert.equal(restored.secondaryAbilities.players['local-player']?.castSequence, 1)
  assert.equal(restored.secondaryAbilities.players['local-player']?.cooldownTicksBySkill[35],
    result.state.secondaryAbilities.players['local-player']?.cooldownTicksBySkill[35])
  assert.ok(restored.secondaryAbilities.actors.some(({ kind }) => kind === 'freeze-wave'))
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
    destinationSlot: null,
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
    skillBookOutcome: null,
  })
  assert.equal(
    findInventoryItem(getPlayerEconomy(moved.state, 'first').backpack, destinationSack.id)
      ?.contents?.some(({ id }) => id === target.id),
    true,
  )

  const dyeOpened = applyGameSimulationHubAction(moved.state, 'first', {
    type: 'open-dye', dyeItemId: dye.id, sessionId: 'recursive-dye',
  })
  assert.equal(dyeOpened.accepted, true)
  const dyed = applyGameSimulationHubAction(dyeOpened.state, 'first', {
    type: 'dye',
    sessionId: 'recursive-dye',
    layer: 'cloth',
    swatchRows: [1, 9],
    targetItemId: target.id,
  })
  assert.equal(dyed.accepted, true)
  const dyedEconomy = getPlayerEconomy(dyed.state, 'first')
  assert.equal(dyedEconomy.actionFeedback?.action, 'dye')
  assert.equal(dyedEconomy.actionFeedback?.sequence, 3)
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

test('a public Golem cast commits its continuous facing and body bank as one Player invariant', () => {
  let state = withPlayerSkillRank(etherDrainSimulation({ x: 400, y: 250 }), 'local-player', 45, 1)
  for (let tick = 0; tick < 150; tick++) state = stepGameSimulationTick(state, {})
  const initial = getPlayerCharacter(state)
  state = { ...state, playerEntities: replacePlayerCharacter(
    setPlayerEntityMana(state.playerEntities, 'local-player', 100), 'local-player', {
      ...initial, headingDegrees: 22.25, headingIndex: 1, velocity: { x: 0, y: 0 },
    },
  ) }
  state = stepGameSimulationTick(bindGameSimulationPlayerSkillQuickbar(state, 'local-player', 45, 1)!, {
    'local-player': { ...gameplayInput(0, 0), cast: { primary: false, quickbar: 1 } },
  })
  assert.ok(state.secondaryAbilities.actors.some(actor => actor.kind === 'golem'))
  const caster = getPlayerCharacter(state)
  assert.ok([67.25, -22.75].includes(caster.headingDegrees))
  assert.equal(caster.headingIndex, actorHeadingIndex(caster.headingDegrees))
  const snapshot = gameSnapshot(JSON.parse(JSON.stringify(createGameSnapshot(state, 'local-player'))))
  assert.equal(snapshot.players['local-player']!.headingDegrees, caster.headingDegrees)
  assert.equal(snapshot.players['local-player']!.headingIndex, caster.headingIndex)
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

test('concentrated Creativity rolls Insight on active gameplay RNG and applies its marked card twice', () => {
  const first = {
    discipline: 'mind',
    displayName: 'Creative',
    element: 'ether',
  } as const
  let state = withPlayerSkillRank(createGameSimulation({ first }), 'first', 63, 1)
  state = {
    ...state,
    gameRng: createNativeRng(1),
    playerEntities: selectPlayerEntityConcentration(state.playerEntities, 'first', 63),
  }
  const secondaryRng = state.secondaryAbilities.rng

  state = grantGameSimulationPlayerExperience(state, 'first', 91)
  const offer = getPlayerProgression(state, 'first').pendingOffer
  assert.ok(offer)
  assert.equal(offer.options.length, 4)
  const insightIndex = offer.options.findIndex(({ insight }) => insight === true)
  assert.notEqual(insightIndex, -1)
  assert.deepEqual(state.gameRng, advanceNativeRngWords(createNativeRng(1), 6))
  assert.strictEqual(state.secondaryAbilities.rng, secondaryRng)

  const option = offer.options[insightIndex]!
  const rankBefore = getPlayerSkillBook(state, 'first').permanentRanks[option.skillId]!
  const beforeChoiceRng = state.gameRng
  state = selectGameSimulationPlayerSkill(state, 'first', {
    choiceIndex: insightIndex,
    offerSequence: offer.sequence,
    skillId: option.skillId,
  })!
  assert.equal(
    getPlayerSkillBook(state, 'first').permanentRanks[option.skillId],
    rankBefore + 2,
  )
  assert.deepEqual(state.gameRng, advanceNativeRngWords(beforeChoiceRng, 2))
  assert.strictEqual(state.secondaryAbilities.rng, secondaryRng)
})

test('owned Split Mind produces identical Insight offers and selections in either concentration slot', () => {
  let hits = 0
  for (let seed = 0; seed < 32; seed += 1) {
    const states = ([0, 1] as const).map(slot => {
      let state = createGameSimulation({ first: { discipline: 'mind', displayName: 'Split Insight', element: 'ether' } })
      for (const skillId of [57, 63]) {
        const granted = grantPlayerEntitySkillRanks(state.playerEntities, 'first', skillId, 1, state.gameRng)
        state = { ...state, playerEntities: granted.store, gameRng: granted.rng }
      }
      state = selectGameSimulationPlayerPrimarySkill(state, 'first', 8)!
      const economy = getPlayerEconomy(state, 'first')
      state = { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, 'first', {
        ...economy, ownedPerkSelectors: [21],
      }) }
      const runtime = playerSkillRuntimeAt(state.playerEntities, 'first')!
      state = { ...state, gameRng: createNativeRng(seed),
        playerEntities: setPlayerEntitySkillRuntime(state.playerEntities, 'first', { ...runtime,
          concentrationSkillIdA: slot === 0 ? 63 : 57,
          concentrationSkillIdB: slot === 0 ? 57 : 63,
        }),
      }
      return grantGameSimulationPlayerExperience(state, 'first', 91)
    })
    const first = states[0]!
    const second = states[1]!
    const offer = getPlayerProgression(first, 'first').pendingOffer!
    assert.deepEqual(getPlayerProgression(second, 'first').pendingOffer, offer, `seed ${seed}`)
    assert.deepEqual(second.gameRng, first.gameRng, `seed ${seed} active RNG`)
    const choiceIndex = offer.options.findIndex(option => option.insight)
    if (choiceIndex < 0) continue
    hits += 1
    const skillId = offer.options[choiceIndex]!.skillId
    for (const current of states) {
      const state = hits === 1 ? restoreGameSaveDocument(createGameSaveDocument({
        integrity: 'local-only', loadedBoneyard: null, mods: [], modState: {}, playerId: 'first', state: current,
      })).state : current
      assert.deepEqual(getPlayerProgression(state, 'first').pendingOffer, offer)
      // Hub reconstruction owns one seed draw; a saved pending offer does not reroll Insight.
      assert.deepEqual(state.gameRng, hits === 1 ? advanceNativeRngWords(current.gameRng, 1) : current.gameRng)
      assert.equal(playerSkillRuntimeAt(state.playerEntities, 'first')!.concentrationSkillIdB,
        playerSkillRuntimeAt(current.playerEntities, 'first')!.concentrationSkillIdB)
      const before = getPlayerSkillBook(state, 'first').permanentRanks[skillId]!
      const selected = selectGameSimulationPlayerSkill(state, 'first', {
        choiceIndex, offerSequence: offer.sequence, skillId,
      })!
      assert.equal(getPlayerSkillBook(selected, 'first').permanentRanks[skillId], before + 2)
      assert.deepEqual(selected.gameRng, advanceNativeRngWords(state.gameRng, 2))
      assert.equal(selected.secondaryAbilities.rng, state.secondaryAbilities.rng)
    }
  }
  assert.ok(hits > 0)
})

test('mod skill replacement finalizes its queued native Insight offer on gameplay RNG', () => {
  const first = {
    discipline: 'mind',
    displayName: 'Creative Modder',
    element: 'ether',
  } as const
  let state = withPlayerSkillRank(createGameSimulation({ first }), 'first', 63, 1)
  state = {
    ...state,
    playerEntities: selectPlayerEntityConcentration(state.playerEntities, 'first', 63),
  }
  state = grantGameSimulationPlayerExperience(state, 'first', 300)
  const replacedOffer = getPlayerProgression(state, 'first').pendingOffer
  assert.ok(replacedOffer)
  const insightSeed = createNativeRng(1)
  const secondaryRng = state.secondaryAbilities.rng
  state = { ...state, gameRng: insightSeed }

  state = replaceGameSimulationPlayerSkillWithMod(
    state,
    'first',
    replacedOffer.sequence,
  )!
  const queuedOffer = getPlayerProgression(state, 'first').pendingOffer
  assert.ok(queuedOffer)
  assert.notEqual(queuedOffer.sequence, replacedOffer.sequence)
  assert.equal(queuedOffer.options.length, 4)
  assert.equal(queuedOffer.options.filter(({ insight }) => insight === true).length, 1)
  assert.deepEqual(state.gameRng, advanceNativeRngWords(insightSeed, 6))
  assert.strictEqual(state.secondaryAbilities.rng, secondaryRng)
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
  const actorLightOrdinal = state.worldManagerOrder.nextRegistrationOrdinal.actor
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
    state.worldManagerOrder.nextRegistrationOrdinal.actor,
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
    projectileWorldBlocked: () => false,
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
    projectileWorldBlocked: () => false,
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
    projectileWorldBlocked: () => false,
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

test('later-member rejoin checkpoints private skills on the current world clock', () => {
  const first = { discipline: 'arcane', displayName: 'First', element: 'ether' } as const
  const second = { discipline: 'mind', displayName: 'Second', element: 'water' } as const
  const loaded = combatBoneyard('rejoin-older-world-clock')
  let live = enterBoneyardWorld(createGameSimulation({ first, second }), loaded)
  const detached = detachGameSimulationPlayer(live, 'second')
  live = removePlayerCharacter(live, 'second')
  const laterTick = live.tick + 50
  const laterProgression = {
    ...detached.playerEntities.progressions[0]!,
    hitFeedback: { strength: 1, tick: laterTick, timer: 1 },
    lastDamageTick: laterTick,
  }
  const laterMember = {
    ...detached,
    playerEntities: {
      ...detached.playerEntities,
      progressions: [laterProgression],
      skillBooks: [grantPlayerSkillRanks(detached.playerEntities.skillBooks[0]!, 34, 1)],
    },
  }
  const retainedSkills = laterMember.playerEntities.skillBooks[0]
  assert.equal(retainedSkills.permanentRanks[34], 1)
  const rejoined = rejoinGameSimulationPlayer(live, laterMember, 'second', null)
  assert.deepEqual(getPlayerSkillBook(rejoined, 'second'), retainedSkills)
  assert.ok(getPlayerProgression(rejoined, 'second').hitFeedback.tick <= rejoined.tick)
  assert.ok((getPlayerProgression(rejoined, 'second').lastDamageTick ?? 0) <= rejoined.tick)
  const checkpoint = createGameSaveDocument({
    integrity: 'local-only', loadedBoneyard: loaded, mods: [], modState: {},
    playerId: 'second', state: rejoined,
  })
  const restored = restoreGameSaveDocument(checkpoint)
  assert.equal(restored.state.tick, live.tick)
  assert.deepEqual(getPlayerSkillBook(restored.state, 'second'), retainedSkills)
})

test('active-run rejoin re-registers a detached death weapon in destination painter order', () => {
  const first = { discipline: 'arcane', displayName: 'First', element: 'ether' } as const
  const second = { discipline: 'mind', displayName: 'Second', element: 'water' } as const
  let state = enterBoneyardWorld(
    createGameSimulation({ first, second }),
    combatBoneyard('dead-player-rejoin'),
  )
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const secondIndex = state.playerEntities.identities.findIndex(({ playerId }) => (
    playerId === 'second'
  ))
  assert.ok(secondIndex >= 0)
  const progressions = state.playerEntities.progressions.map((progression, index) => (
    index === secondIndex
      ? { ...progression, currentHealth: 0, lifeState: 'spectating' as const }
      : progression
  ))
  state = {
    ...state,
    playerEntities: setPlayerDeathWeaponPainterRegistration(
      { ...state.playerEntities, progressions },
      'second',
      order.register('actor'),
    ),
    worldManagerOrder: order.state(),
  }
  const sourceRegistration = playerLightingAt(
    state.playerEntities,
    'second',
  )?.deathWeaponPainterRegistration
  assert.ok(sourceRegistration)
  const detached = detachGameSimulationPlayer(state, 'second')
  state = removePlayerCharacter(state, 'second')
  const nextActorOrdinal = state.worldManagerOrder.nextRegistrationOrdinal.actor

  const rejoined = rejoinGameSimulationPlayer(state, detached, 'second', null)
  assert.deepEqual(
    playerLightingAt(rejoined.playerEntities, 'second')?.deathWeaponPainterRegistration,
    { managerLane: 'actor', registrationOrdinal: nextActorOrdinal + 1 },
  )
  assert.notDeepEqual(
    playerLightingAt(rejoined.playerEntities, 'second')?.deathWeaponPainterRegistration,
    sourceRegistration,
  )
  assert.equal(
    rejoined.worldManagerOrder.nextRegistrationOrdinal.actor,
    nextActorOrdinal + 2,
  )
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

test('detached catch-up resolves mod Boasts before assigning automatic skill choices', () => {
  const selection = createModBoastSelection('5000000000000000016', 'example.boasts')
  const definition: BoastDefinition = Object.freeze({
    failureProducers: Object.freeze([]),
    instruction: 'Accept the skill chosen for you.',
    label: 'FATE CHOOSES!',
    randomSkillChoices: true,
    scoreMultiplier: 1.25,
    selection,
    statement: '"I accept whatever knowledge fate provides!"',
    successWave: 25,
  })
  const resolve: BoastResolver = candidate => (
    typeof candidate !== 'number'
      && candidate.contentId === selection.contentId
      && candidate.modId === selection.modId
      ? definition
      : null
  )
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
  let live = createGameSimulation({ first, second }, { gameRngSeed: 91 })
  const secondEconomy = getPlayerEconomy(live, 'second')
  live = {
    ...live,
    playerEntities: replacePlayerEconomy(live.playerEntities, 'second', {
      ...secondEconomy,
      npc: Object.freeze({
        ...secondEconomy.npc,
        boast: selectBoast(secondEconomy.npc.boast, definition),
      }),
    }),
  }
  live = enterBoneyardWorld(live, combatBoneyard('detached-mod-boast'))
  let detached = detachGameSimulationPlayer(live, 'second')
  live = removePlayerCharacter(live, 'second')

  live = grantGameSimulationPlayerExperience(live, 'first', 300)
  const milestone = live.levelUpBarrier
  assert.ok(milestone)
  while (getPlayerProgression(live, 'first').pendingOffer) {
    const offer = getPlayerProgression(live, 'first').pendingOffer!
    live = selectGameSimulationPlayerSkill(live, 'first', {
      choiceIndex: 0,
      offerSequence: offer.sequence,
      skillId: offer.options[0]!.skillId,
    })!
  }

  const synchronized = synchronizeDetachedGameSimulationPlayer(live, detached, {
    crossedLevels: [2, 3, 4],
    experience: milestone.milestoneExperience,
    level: milestone.milestoneLevel,
  }, resolve)
  live = synchronized.state
  detached = synchronized.detached
  const automaticChoice = detached.playerEntities.progressions[0]?.pendingOffer?.automaticChoiceIndex
  assert.equal(Number.isSafeInteger(automaticChoice), true)
  assert.equal(
    getPlayerProgression(
      projectDetachedGameSimulationPlayer(live, detached, resolve),
      'second',
    ).pendingOffer?.automaticChoiceIndex,
    automaticChoice,
  )
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

test('Wraith contact damages immediately and drives the complete player Dazzle recovery', () => {
  let state = withWraithAtPlayer(enterBoneyardWorld(createGameSimulation(), emptyBoneyard()))
  const initialPosition = getPlayerCharacter(state).position
  const initialHealth = getPlayerProgression(state).currentHealth
  state = stepGameSimulationTick(state, {
    'local-player': gameplayInput(0, 0),
  })
  assert.ok(getPlayerProgression(state).currentHealth < initialHealth)
  assert.equal(getPlayerProgression(state).dazzleTicksRemaining, 50)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  state = {
    ...state,
    world: {
      ...state.world,
      enemies: positionBoneyardEnemy(
        state.world.enemies,
        state.world.enemies.actors[0]!.id,
        { x: 10_000, y: 10_000 },
      ).store,
    },
  }

  state = stepGameSimulationTick(state, {
    'local-player': gameplayInput(1, 0),
  })
  assert.deepEqual(getPlayerCharacter(state).position, initialPosition)
  assert.equal(getPlayerProgression(state).dazzleTicksRemaining, 49)

  for (let tick = 0; tick < 49; tick += 1) {
    state = stepGameSimulationTick(state, {
      'local-player': gameplayInput(0, 0),
    })
  }
  assert.equal(getPlayerProgression(state).dazzleTicksRemaining, 0)
  state = stepGameSimulationTick(state, {
    'local-player': gameplayInput(1, 0),
  })
  assert.ok(getPlayerCharacter(state).position.x > initialPosition.x)
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
    viewportHeight: 900,
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
      viewportHeight: 900,
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
    viewportHeight: 900,
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
    viewportHeight: 900,
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
      viewportHeight: 900,
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
      viewportHeight: 900,
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
    projectileWorldBlocked: () => false,
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
    viewportHeight: 900,
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
  assert.equal(getPlayerProgression(state, 'caster').experience - initialExperience, 2.125)
  const experienceAfterReward = getPlayerProgression(state, 'caster').experience
  state = stepGameSimulationTick(state, { caster: cast(false) })
  assert.equal(
    getPlayerProgression(state, 'caster').experience,
    experienceAfterReward,
  )
})

test('pure Fire Burn contact is painter-enrolled before its first replicated frame', () => {
  const fire = {
    discipline: 'arcane',
    displayName: 'Burn Caster',
    element: 'fire',
  } as const
  let state = enterBoneyardWorld(
    withPlayerSkillRank(createGameSimulation({ caster: fire }), 'caster', 22, 2),
    combatBoneyard('fire-burn-painter-run'),
  )
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const player = getPlayerCharacter(state, 'caster')
  const targetPosition = { x: player.position.x, y: player.position.y - 110 }
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    projectileWorldBlocked: () => false,
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
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'ZOMBIE',
      flags: [],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.ZOMBIE,
      position: targetPosition,
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  })
  state = { ...state, world: { ...state.world, enemies: seeded.store } }

  const input = {
    aim: targetPosition,
    cast: { primary: true, quickbar: null },
    movement: { x: 0, y: 0 },
    viewportHeight: 900,
    viewportWidth: 1_600,
  }
  for (let tick = 0; tick < 100 && !state.secondaryAbilities.actors.some(({ kind }) => (
    kind === 'fire-burn'
  )); tick += 1) {
    state = stepGameSimulationTick(state, { caster: input })
  }

  const burn = state.secondaryAbilities.actors.find(({ kind }) => kind === 'fire-burn')
  assert.ok(burn, 'real Fire primary contact did not materialize Burn')
  const message = {
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(createGameSnapshot(state, 'caster'), 0, undefined, true),
    sequence: 1,
    type: 'server-snapshot' as const,
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(message)), message)
  const [burnPainter] = burn.painterRegistrations ?? []
  assert.equal(burn.painterRegistrations?.length, 1)
  assert.equal(burnPainter?.managerLane, 'transient')
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
    projectileWorldBlocked: () => false,
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
  const preEscapePosition = getPlayerCharacter(state, 'caster').position
  state = stepGameSimulationTick(state, { caster: gameplayInput(1, 0) })
  const escapedDuringAction = getPlayerCharacter(state, 'caster')
  assert.ok(escapedDuringAction.position.x > preEscapePosition.x)
  assert.ok(state.primarySpells.transients.some(({ id }) => id === firstAction.id))
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

test('live Staff melee and spin keep native movement while retaining action ownership', () => {
  const cases = [
    {
      expectedHeadingDegrees: 180,
      label: 'melee',
      materialize: (
        origin: Readonly<{ x: number; y: number }>,
        worldKey: string,
      ): NativePlayerStaffMeleeAction => ({
        actionTimingFactor: 1,
        ageTicks: 0,
        baseProgressPerTick: 0.1,
        contactSequence: 0,
        headingDegrees: 180,
        id: 900,
        kind: 'player-staff-melee',
        lane: 'primary',
        origin,
        outcome: 'normal',
        ownerId: 'caster',
        progress: 0,
        swooshPitch: 1,
        worldKey,
      }),
    },
    {
      expectedHeadingDegrees: 200,
      label: 'spin',
      materialize: (
        origin: Readonly<{ x: number; y: number }>,
        worldKey: string,
      ): NativePlayerStaffSpinAction => ({
        ageTicks: 0,
        contactSequence: 0,
        countdown: 360,
        headingDegrees: 180,
        id: 901,
        kind: 'player-staff-spin',
        origin,
        outcome: 'whirl',
        ownerId: 'caster',
        swooshPitch: 1,
        turnSign: 1,
        worldKey,
      }),
    },
  ] as const

  for (const actionCase of cases) {
    let state = enterBoneyardWorld(createGameSimulation({ caster: {
      discipline: 'body',
      displayName: `Moving ${actionCase.label}`,
      element: 'air',
    } }), combatBoneyard(`moving-staff-${actionCase.label}`))
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
    const before = getPlayerCharacter(state, 'caster')
    const worldKey = `boneyard:${state.world.runId}`
    const action: NativePlayerStaffAction = actionCase.materialize(
      { ...before.position },
      worldKey,
    )
    state = {
      ...state,
      primarySpells: {
        ...state.primarySpells,
        nextId: action.id + 1,
        transients: [action],
      },
    }

    state = stepGameSimulationTick(state, { caster: {
      ...gameplayInput(1, 0),
      aim: { x: 1, y: 0 },
      cast: { primary: true, quickbar: null },
    } })

    const after = getPlayerCharacter(state, 'caster')
    assert.ok(
      after.position.x > before.position.x,
      `${actionCase.label} action suppressed PlayerWizard movement`,
    )
    assert.ok(after.velocity.x > 0, `${actionCase.label} action suppressed velocity input`)
    assert.ok(
      after.gaitDegrees > before.gaitDegrees,
      `${actionCase.label} action suppressed gait`,
    )
    assert.ok(
      after.walkCyclePrimary > before.walkCyclePrimary,
      `${actionCase.label} action suppressed the locomotion strip`,
    )
    assert.equal(
      after.headingIndex,
      actorHeadingIndex(actionCase.expectedHeadingDegrees),
      `${actionCase.label} movement replaced action-owned heading`,
    )
    assert.equal(after.primaryCast.castSequence, 0)
    assert.equal(after.primaryCast.actionTick, -1)
    assert.ok(state.primarySpells.transients.some((transient) => (
      transient.id === action.id && transient.kind === action.kind
    )), `${actionCase.label} movement cancelled the live Staff action`)
  }
})

test('every secondary reaches its native action branch during damaged Staff melee and Whirl', () => {
  for (const kind of ['player-staff-melee', 'player-staff-spin'] as const) {
    for (const skillId of NATIVE_SECONDARY_ABILITY_IDS) {
      const state = staffSecondaryState(skillId, kind)
      const next = stepGameSimulationTick(state, { caster: {
        ...gameplayInput(1, 0),
        aim: { x: 350, y: 250 },
        cast: { primary: true, quickbar: 0 },
      } })
      const secondary = next.secondaryAbilities.players.caster!
      const label = `${skillId} during ${kind}`
      assert.equal(secondary.castSequence, 1, label)
      assert.equal(secondary.lastSkillId, skillId, label)
      const actionless = skillId === 78 || skillId === 79
      assert.equal(next.primarySpells.transients.some(({ id }) => id === 900), true, label)
      assert.equal(secondary.castAction !== null, !actionless, label)
      assert.equal(secondary.castSpinTicksRemaining, skillId === 51 ? 73 : 0, label)
      assert.equal(secondary.globalCooldownTicks, actionless ? 0 : 150, label)
      assert.equal(getPlayerCharacter(next, 'caster').primaryCast.castSequence, 0, label)
      assert.equal(getPlayerProgression(next, 'caster').lastDamageTick, state.tick, label)
      const snapshot = createGameSnapshot(next, 'caster')
      // Both action owners must survive the normal observer transport.
      const frame = { acknowledgedInputSequence: 0,
        frame: createGameSnapshotFrame(snapshot, 0, undefined, true),
        sequence: 1, type: 'server-snapshot' as const }
      assert.deepEqual(decodeServerGameMessage(encodeGameMessage(frame)), frame, label)
    }
  }
})

test('every secondary Inventory belt action commits without stepping the frozen Boneyard', () => {
  for (const skillId of NATIVE_SECONDARY_ABILITY_IDS) {
    const paused = staffSecondaryState(skillId, 'player-staff-melee')
    const result = applyGameSimulationHubAction(paused, 'caster', {
      aim: { x: 350, y: 250 },
      slot: 0,
      type: 'activate-belt-slot',
    })
    assert.equal(result.accepted, true, `${skillId} accepted`)
    assert.equal(result.state.tick, paused.tick, `${skillId} tick`)
    assert.deepEqual(result.state.screenFlashes.writes.map(write => write.flash),
      result.state.secondaryAbilities.events.flatMap(event => event.screenFlash ? [event.screenFlash] : []),
      `${skillId} actual secondary flash writer membership`)

    assert.deepEqual(result.state.gameRng, paused.gameRng, `${skillId} world RNG`)
    assert.equal(result.state.secondaryAbilities.players.caster?.castSequence, 1, `${skillId} cast`)
    assert.equal(result.state.secondaryAbilities.players.caster?.lastSkillId, skillId, `${skillId} identity`)
    assert.equal(result.state.primarySpells.transients.some(({ id }) => id === 900), true, `${skillId} Staff action`)
    for (const actor of paused.secondaryAbilities.actors) {
      const retained = result.state.secondaryAbilities.actors.find(({ id }) => id === actor.id)
      assert.equal(retained?.ageTicks, actor.ageTicks, `${skillId} existing actor age`)
    }
  }
})

test('Turn Undead cast headings commit before motion and survive party save continuation', () => {
  const loadedBoneyard = combatBoneyard('turn-undead-party-save')
  const config = { discipline: 'body', displayName: 'Turn Undead caster', element: 'fire' } as const
  let state = enterBoneyardWorld(createGameSimulation({ caster: config, peer: config }), loadedBoneyard)
  state = withPlayerSkillRank(state, 'caster', 77, 1)
  state = bindGameSimulationPlayerSkillQuickbar(state, 'caster', 77, 0)!
  state = { ...state, playerEntities: replacePlayerCharacter(
    replacePlayerCharacter(state.playerEntities, 'caster', { ...getPlayerCharacter(state, 'caster'),
      position: { x: 100, y: 250 } }), 'peer', { ...getPlayerCharacter(state, 'peer'), position: { x: 375, y: 250 } }) }
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const managers = createNativeWorldManagerOrder(state.worldManagerOrder)
  const tokens = ['SKELETON', 'SKELETONARCHER', 'SKELETONMAGE', 'ZOMBIE'] as const
  const spawned = stepBoneyardEnemyStore(state.world.enemies, {
    players: {}, projectileWorldBlocked: () => false, resolveMovement: request => request.position,
    registerWorldPainter: managers.register, tick: state.tick,
    resolveSpawnIntents: () => tokens.map((enemyToken, index) => ({
      enemyToken, flags: [], id: index + 1, locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[enemyToken],
      position: { x: 300, y: 160 + index * 60 }, spawnTick: state.tick, waveOrdinal: 1,
    })),
  }).store
  state = { ...state, worldManagerOrder: managers.state(), world: { ...state.world,
    enemies: { ...spawned, actors: spawned.actors.map(actor => ({ ...actor,
      headingDeg: 180, nextMovementTick: Number.MAX_SAFE_INTEGER })) } } }
  const cast = applyGameSimulationHubAction(state, 'caster', { type: 'activate-belt-slot', slot: 0 })
  assert.equal(cast.accepted, true)
  assert.equal(cast.state.tick, state.tick)
  assert.equal(cast.state.secondaryAbilities.players.caster!.castSequence, 1)
  if (cast.state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  for (const actor of cast.state.world.enemies.actors) {
    const expectedHeading = Math.fround((Math.atan2(actor.position.x - 100, 250 - actor.position.y) * 180 / Math.PI + 360) % 360)
    assert.equal(actor.headingDeg, expectedHeading, `${actor.config.enemyToken} must immediately face away from the caster`)
    assert.equal(actor.path.wanderHeadingDeg, expectedHeading)
    assert.equal(actor.position.x, 300)
    assert.ok(cast.state.secondaryAbilities.targetEffects.find(effect => effect.targetId === actor.id)!.fleeTicks > 0)
  }
  let direct = cast.state
  for (let tick = 0; tick < 4; tick += 1) direct = stepGameSimulationTick(direct, {})
  if (direct.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  for (const actor of direct.world.enemies.actors) {
    assert.equal(actor.targetPlayerId, 'peer')
    assert.ok(actor.position.x < 300, `${actor.config.enemyToken} must flee its current party target`)
  }
  // A solo continuation removes other party members through this same public owner.
  direct = removePlayerCharacter(direct, 'peer')
  const restored = restoreGameSaveDocument(createGameSaveDocument({ integrity: 'local-only',
    loadedBoneyard, mods: [], modState: {}, playerId: 'caster', state: direct })).state
  if (restored.world.kind !== 'boneyard' || direct.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.deepEqual(restored.world.enemies.actors, direct.world.enemies.actors)
  assert.deepEqual(restored.secondaryAbilities.targetEffects, direct.secondaryAbilities.targetEffects)
  let resumed = restored
  for (let tick = 0; tick < 4; tick += 1) {
    direct = stepGameSimulationTick(direct, {})
    resumed = stepGameSimulationTick(resumed, {})
  }
  if (direct.world.kind !== 'boneyard' || resumed.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.deepEqual(resumed.world.enemies.actors, direct.world.enemies.actors)
  assert.deepEqual(resumed.secondaryAbilities.targetEffects, direct.secondaryAbilities.targetEffects)
  assert.ok(direct.world.enemies.actors.every(actor => actor.targetPlayerId === 'caster'))
})

test('Inventory belt preserves aimed placement and Teleport relocation without a world step', () => {
  const target = { x: 350, y: 250 }
  const circle = staffSecondaryState(49, 'player-staff-melee')
  const castCircle = applyGameSimulationHubAction(circle, 'caster', {
    aim: target, slot: 0, type: 'activate-belt-slot',
  })
  assert.equal(castCircle.accepted, true)
  assert.deepEqual(castCircle.state.secondaryAbilities.actors.find(({ kind }) => (
    kind === 'magic-circle'
  ))?.position, target)
  assert.equal(castCircle.state.tick, circle.tick)

  const teleport = staffSecondaryState(48, 'player-staff-melee')
  const position = getPlayerCharacter(teleport, 'caster').position
  const castTeleport = applyGameSimulationHubAction(teleport, 'caster', {
    aim: target, slot: 0, type: 'activate-belt-slot',
  })
  assert.equal(castTeleport.accepted, true)
  assert.notDeepEqual(getPlayerCharacter(castTeleport.state, 'caster').position, position)
  assert.equal(castTeleport.state.tick, teleport.tick)
})

test('Inventory belt rejection does not advance cooldowns or debit mana', () => {
  const ready = staffSecondaryState(35, 'player-staff-melee')
  const player = ready.secondaryAbilities.players.caster!
  const cooling = {
    ...ready,
    secondaryAbilities: { ...ready.secondaryAbilities, players: { caster: {
      ...player, globalCooldownTicks: 50,
    } } },
  }
  const ignored = applyGameSimulationHubAction(cooling, 'caster', {
    slot: 0, type: 'activate-belt-slot',
  })
  assert.equal(ignored.accepted, true)
  assert.equal(ignored.state.tick, cooling.tick)
  assert.equal(ignored.state.secondaryAbilities.players.caster?.castSequence, 0)
  assert.equal(ignored.state.secondaryAbilities.players.caster?.globalCooldownTicks, 50)
  assert.equal(getPlayerProgression(ignored.state, 'caster').currentMana,
    getPlayerProgression(cooling, 'caster').currentMana)
})

test('secondary toggle-off branches preserve Staff and only Planewalker adds a cast action', () => {
  for (const [skillId, active, replaces] of [
    [12, { planewalkerTicksRemaining: 500 }, true],
    [23, { firewalker: true }, false],
    [78, { mindstar: true }, false],
    [79, { regenerate: true }, false],
  ] as const) {
    const source = staffSecondaryState(skillId, 'player-staff-melee')
    const next = stepGameSimulationTick({ ...source,
      secondaryAbilities: { ...source.secondaryAbilities,
        players: { caster: { ...source.secondaryAbilities.players.caster!, ...active } } },
    }, { caster: { ...gameplayInput(0, 0), cast: { primary: false, quickbar: 0 } } })
    assert.equal(next.secondaryAbilities.players.caster!.castSequence, 1, `toggle ${skillId}`)
    assert.equal(next.primarySpells.transients.some(({ id }) => id === 900), true, `toggle ${skillId}`)
    assert.equal(next.secondaryAbilities.players.caster!.castAction !== null, replaces, `toggle ${skillId}`)
  }
})

test('rejected secondary presses leave the live Staff action and mana intact', () => {
  for (const rejection of ['mana', 'common-cooldown', 'private-cooldown'] as const) {
    let source = staffSecondaryState(48, 'player-staff-melee')
    const secondary = source.secondaryAbilities.players.caster!
    source = { ...source,
      playerEntities: rejection === 'mana'
        ? setPlayerEntityMana(source.playerEntities, 'caster', 0)
        : source.playerEntities,
      secondaryAbilities: { ...source.secondaryAbilities, players: { caster: {
        ...secondary,
        globalCooldownTicks: rejection === 'common-cooldown' ? 50 : 0,
        cooldownTicksBySkill: secondary.cooldownTicksBySkill.map((value, id) => (
          rejection === 'private-cooldown' && id === 48 ? 500 : value
        )),
      } } },
    }
    const next = stepGameSimulationTick(source, {
      caster: { ...gameplayInput(0, 0), cast: { primary: false, quickbar: 0 } },
    })
    assert.equal(next.secondaryAbilities.players.caster!.castSequence, 0, rejection)
    assert.ok(next.primarySpells.transients.some(({ id }) => id === 900), rejection)
    assert.ok(getPlayerProgression(next, 'caster').currentMana >= getPlayerProgression(source, 'caster').currentMana)
  }
})

test('host contact cannot start new Staff melee during Cast2 or CastSpin', () => {
  for (const spin of [false, true]) {
    let state = staffSecondaryState(spin ? 51 : 21, 'player-staff-melee')
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    const seeded = stepBoneyardEnemyStore(state.world.enemies, {
      projectileWorldBlocked: () => false, players: {},
      resolveMovement: ({ requestedPosition }) => requestedPosition,
      resolveSpawnIntents: () => [{ enemyToken: 'SKELETON', flags: [], id: 1,
        locationPolicy: 'anywhere', nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
        position: { x: 250, y: 200 }, spawnTick: 0, waveOrdinal: 1 }], tick: 0,
    }).store
    state = { ...state,
      world: { ...state.world, enemies: { ...seeded, actors: seeded.actors.map(actor => ({
        ...actor, currentHealth: 1_000, nextMovementTick: Number.MAX_SAFE_INTEGER,
      })) } },
      primarySpells: { ...state.primarySpells, transients: [] },
      secondaryAbilities: { ...state.secondaryAbilities, players: { caster: {
        ...state.secondaryAbilities.players.caster!,
        castAction: spin ? null : { weaponKind: 'staff', progress: 0 },
        castSpinTicksRemaining: spin ? 73 : 0,
      } } },
    }
    for (let tick = 0; tick < 20; tick += 1) {
      state = stepGameSimulationTick(state, { caster: gameplayInput(0, -1) })
      assert.equal(state.primarySpells.transients.some(({ kind }) => (
        kind === 'player-staff-melee' || kind === 'player-staff-spin'
      )), false, spin ? 'CastSpin' : 'Cast2')
    }
  }
})

test('continued hits preserve Ring of Fire and the original Staff marker and independent lifetimes', () => {
  let state = staffSecondaryState(21, 'player-staff-melee')
  state = stepGameSimulationTick(state, {
    caster: { ...gameplayInput(0, 0), cast: { primary: false, quickbar: 0 } },
  })
  assert.equal(state.secondaryAbilities.players.caster!.castSequence, 1)
  let sawStaffContact = false
  for (let tick = 0; tick < 90; tick += 1) {
    state = { ...state, playerEntities: damagePlayerEntity(state.playerEntities, 'caster', 1, state.tick) }
    state = stepGameSimulationTick(state, {})
    assert.equal(state.secondaryAbilities.players.caster!.castSequence, 1)
    sawStaffContact ||= state.primarySpells.transients.some(({ kind }) => kind === 'player-staff-contact')
    if (tick < 50) assert.ok(state.primarySpells.transients.some(({ id }) => id === 900))
  }
  assert.equal(state.secondaryAbilities.players.caster!.castAction, null)
  assert.equal(state.secondaryAbilities.players.caster!.globalCooldownTicks, 60)
  assert.equal(state.primarySpells.transients.some(({ id }) => id === 900), false)
  assert.equal(sawStaffContact, true)
})

function staffSecondaryState(
  skillId: NativeSecondaryAbilityId,
  kind: NativePlayerStaffAction['kind'],
): GameSimulationState {
  let state = enterBoneyardWorld(createGameSimulation({ caster: {
    discipline: 'body', displayName: 'Surrounded caster', element: 'fire',
  } }), combatBoneyard(`staff-secondary-${skillId}-${kind}`))
  state = withPlayerSkillRank(state, 'caster', skillId, 1)
  state = bindGameSimulationPlayerSkillQuickbar(state, 'caster', skillId, 0)!
  const base = { ageTicks: 0, contactSequence: 0, headingDegrees: 180, id: 900,
    origin: { x: 250, y: 250 }, ownerId: 'caster', swooshPitch: 1,
    worldKey: `boneyard:staff-secondary-${skillId}-${kind}` }
  const action: NativePlayerStaffAction = kind === 'player-staff-melee'
    ? { ...base, actionTimingFactor: 1, baseProgressPerTick: Math.fround(0.1), kind,
        lane: 'primary', outcome: 'normal', progress: 0 }
    : { ...base, countdown: 360, kind, outcome: 'whirl', turnSign: 1 }
  const playerEntities = { ...state.playerEntities,
    progressions: state.playerEntities.progressions.map(progression => ({
      ...progression, currentMana: 10_000, maximumMana: 10_000,
      currentHealth: 1_000, maximumHealth: 1_000,
    })),
  }
  return { ...state,
    playerEntities: damagePlayerEntity(playerEntities, 'caster', 1, state.tick),
    primarySpells: { ...state.primarySpells, nextId: 901, transients: [action] },
    secondaryAbilities: { ...state.secondaryAbilities, players: { caster: createNativeSecondaryPlayerState() } },
  }
}

test('actual same-tick Faculty death then Ring cast preserves authority order through replication', () => {
  let state = staffSecondaryState(35, 'player-staff-melee')
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard') throw new Error('Boneyard required')
  const managers = createNativeWorldManagerOrder(state.worldManagerOrder)
  const enemies = stepBoneyardEnemyStore(state.world.enemies, {
    players: {}, projectileWorldBlocked: () => false,
    registerWorldPainter: managers.register,
    resolveMovement: ({ position }) => position,
    resolveSpawnIntents: () => [{ enemyToken: 'DIREFACULTY', flags: [], id: 1,
      authoredRecipe: nativeFacultyRecipe('9e9e1bccd99babf99e190ae4acdae98d1fea2f782b60ba6d45a6b9eae6afe2d9', 'Dire Sirmin'),
      locationPolicy: 'anywhere', nativeTypeId: 1010, pathfindingMode: 2,
      position: { ...getPlayerCharacter(state, 'caster').position }, spawnTick: state.tick, waveOrdinal: 32 }],
    tick: state.tick,
  }).store
  state = { ...state, worldManagerOrder: managers.state(), world: { ...state.world,
    enemies: { ...enemies, featuredBossId: null, actors: enemies.actors.map(actor => ({ ...actor,
      currentHealth: 0, lifeState: 'dying', deathStartedTick: state.tick, deathTick: 0 })) } } }
  const before = state.screenFlashes
  const next = stepGameSimulationTick(state, { caster: {
    ...gameplayInput(0, 0), cast: { primary: false, quickbar: 0 },
  } })
  const writes = next.screenFlashes.writes
  assert.deepEqual(writes.map(write => [write.order, write.tick, write.flash.red]), [[1, 1, 0], [2, 1, Math.fround(.9)]])
  assert.deepEqual(state.screenFlashes, before, 'previous authoritative state stays immutable')
  const wire = gameSnapshot(JSON.parse(JSON.stringify(createGameSnapshot(next, 'caster'))))
  assert.deepEqual(wire.screenFlashes, next.screenFlashes)
  const frame = createGameSnapshotFrame(wire, 0, undefined, true)
  const decoded = decodeServerGameMessage(encodeGameMessage({ type: 'server-snapshot', sequence: 1,
    acknowledgedInputSequence: 0, frame }))
  assert.equal(decoded.type, 'server-snapshot')
  if (decoded.type !== 'server-snapshot') throw new Error('Snapshot required')
  const lane = new NativeSecondaryScreenFeedbackPresentation(0, writes[0]!.worldKey)
  lane.consumeScreenFlashes(decoded.frame.screenFlashes, { cameraCenter: writes[0]!.position,
    localPlayerAlternate: false, visibleWorldWidth: 1600 })
  assert.deepEqual(lane.sample(1), { alpha: 1, color: 15073279 })
  for (const invalidField of ['missing', 'duplicate', 'future', 'nextOrder']) {
    const invalid = JSON.parse(encodeGameMessage(decoded))
    const journal = invalid.frame.screenFlashes
    if (invalidField === 'missing') delete invalid.frame.screenFlashes
    if (invalidField === 'duplicate') journal.writes[1].order = journal.writes[0].order
    if (invalidField === 'future') journal.writes[1].tick = invalid.frame.tick + 1
    if (invalidField === 'nextOrder') journal.nextOrder = journal.writes[1].order
    assert.throws(() => decodeServerGameMessage(JSON.stringify(invalid)), /screenFlashes/)
  }
})

test('Ether Blast birth writes the same retained flash lane beyond the particle lifetime', () => {
  let state = enterBoneyardWorld(createGameSimulation({ caster: {
    discipline: 'arcane', displayName: 'Ether flash', element: 'ether',
  } }), combatBoneyard('ether-flash-order'))
  state = withPlayerSkillRank(state, 'caster', 14, 1)
  const character = getPlayerCharacter(state, 'caster')
  state = { ...state, playerEntities: replacePlayerCharacter(state.playerEntities, 'caster', {
    ...character, primaryCast: { ...character.primaryCast, etherBlastCharge: 4 },
  }) }
  for (let tick = 0; tick < 25 && state.screenFlashes.writes.length === 0; tick += 1) {
    state = stepGameSimulationTick(state, { caster: {
      ...gameplayInput(0, 0), cast: { primary: true, quickbar: null }, aim: { x: 500, y: 250 },
    } })
  }
  const write = state.screenFlashes.writes[0]
  assert.ok(write, 'Actual Ether Blast emission must write feedback')
  assert.deepEqual(write.flash, { alpha: 1, red: 1, green: Math.fround(.25), blue: 1,
    decayPerTick: Math.fround(.025), pointAttenuated: true })
  assert.equal(write.tick, state.primarySpells.transients.find(actor => actor.kind === 'ether-blast')?.birthTick)
  const lane = new NativeSecondaryScreenFeedbackPresentation(write.tick + 25, write.worldKey)
  lane.consumeScreenFlashes(state.screenFlashes, { cameraCenter: write.position,
    localPlayerAlternate: false, visibleWorldWidth: 1600 })
  assert.ok(lane.sample(write.tick + 25)!.alpha > .37)
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
    projectileWorldBlocked: () => false,
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

test('ordinary and Ethereal Boulders traverse Gravestone solid geometry', () => {
  for (const kind of ['earth', 'ethereal'] as const) {
    const loaded = combatBoneyard(`boulder-grave-${kind}`)
    loaded.scene.objects = [{
      eid: 'boulder-pass-grave',
      overlayVariant: 8,
      pos: { x: 120, y: 250 },
      typeId: 2029,
      variant: 0,
    }]
    let state = enterBoneyardWorld(createGameSimulation({ caster: {
      discipline: 'arcane',
      displayName: `${kind} caster`,
      element: 'earth',
    } }), loaded)
    const worldKey = `boneyard:${loaded.runId}`
    if (kind === 'earth') {
      state = {
        ...state,
        primarySpells: {
          nextId: 2,
          projectiles: [{
            ageTicks: 1,
            assemblyCharge: Math.fround(0.3),
            charge: Math.fround(0.3),
            damage: 10,
            direction: { x: 1, y: 0 },
            flightTicks: 1,
            hitTargetIds: [],
            id: 1,
            kind: 'earth',
            lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
            maximumCharge: Math.fround(0.3),
            orientation: [...EARTH_BOULDER_IDENTITY_ORIENTATION],
            ownerId: 'caster',
            phase: 'flight',
            position: { x: 80, y: 250 },
            remainingDamage: 10,
            shellCharge: Math.fround(0.3),
            toughness: 1,
            velocity: { x: 3, y: 0 },
            worldKey,
          }],
          transients: [],
        },
      }
    } else {
      const held = createNativeWeldPersistentActor({
        buildId: 1006,
        direction: { x: 1, y: 0 },
        id: 1,
        origin: { x: 80, y: 250 },
        ownerId: 'caster',
        tick: state.tick,
        vector: [10, 10, 4, 1, 1, 1],
        worldKey,
      })
      assert.equal(held.buildId, 1006)
      const released = releaseNativeWeldPersistentActor({
        actor: held,
        firstChildId: 2,
        rng: state.combatRng,
        tick: state.tick,
      })
      state = {
        ...state,
        combatRng: released.rng,
        primarySpells: {
          nextId: released.nextId,
          projectiles: [],
          transients: [...released.actors],
        },
      }
    }

    for (let tick = 0; tick < 50; tick += 1) {
      state = stepGameSimulationTick(state, { caster: gameplayInput(0, 0) })
    }

    if (kind === 'earth') {
      const boulder = state.primarySpells.projectiles.find((spell) => spell.kind === 'earth')
      assert.ok(boulder?.kind === 'earth')
      assert.ok(boulder.position.x > 150)
    } else {
      const boulders = state.primarySpells.transients.filter((effect) => (
        effect.kind === 'weld-persistent' && effect.buildId === 1006
      ))
      assert.equal(boulders.length, 4)
      assert.ok(boulders.every((boulder) => boulder.origin.x > 150))
    }
    assert.equal(state.primarySpells.transients.some((effect) => (
      effect.kind === 'earth-impact'
      || (effect.kind === 'weld-impact' && effect.boulderTerminalCharge !== null)
    )), false)
  }
})

test('Boneyard semantic events survive the slowest snapshot cadence and remain bounded', () => {
  let state = enterBoneyardWorld(
    createGameSimulation(),
    combatBoneyard('semantic-event-run'),
  )
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const player = getPlayerCharacter(state)
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    projectileWorldBlocked: () => false,
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
  const swipe = drawNativeFloat(chance.state, Math.fround(0.1), true)
  let state = enterBoneyardWorld(
    createGameSimulation(),
    combatBoneyard('deflect-combat-run'),
  )
  state = withConcentratedDeflect(state, 'local-player')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const player = getPlayerCharacter(state)
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    projectileWorldBlocked: () => false,
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
  assert.equal(publishedPlayer.headingDegrees, Math.fround(actorHeadingFromVector(
    source.position.x - publishedPlayer.position.x,
    source.position.y - publishedPlayer.position.y,
  )))
  assert.equal(publishedPlayer.headingIndex, actorHeadingIndex(actorHeadingFromVector(
    source.position.x - publishedPlayer.position.x,
    source.position.y - publishedPlayer.position.y,
  )))
})

test('Flash responds after damage with area Dazzle, twelve children, feedback, and stock audio', () => {
  let state = enterBoneyardWorld(
    createGameSimulation(),
    combatBoneyard('flash-response-run'),
  )
  state = withPlayerSkillRank(state, 'local-player', 53, 1)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const player = getPlayerCharacter(state)
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    projectileWorldBlocked: () => false,
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
      projectileWorldBlocked: () => false,
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

test('enemy loot charm modifiers belong only to the participant credited with the kill', () => {
  const materializedReward = (
    firstSelectors: readonly number[],
    killerSelectors: readonly number[],
    actorSeed: number,
    creditedPlayerId = 'killer',
  ) => {
    let state = enterBoneyardWorld(
      createGameSimulation({
        first: {
          discipline: 'arcane',
          displayName: 'First',
          element: 'ether',
        },
        killer: {
          discipline: 'body',
          displayName: 'Killer',
          element: 'fire',
        },
      }),
      emptyBoneyard(),
    )
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
    for (const [playerId, ownedPerkSelectors] of [
      ['first', firstSelectors],
      ['killer', killerSelectors],
    ] as const) {
      const economy = getPlayerEconomy(state, playerId)
      state = {
        ...state,
        playerEntities: replacePlayerEconomy(state.playerEntities, playerId, {
          ...economy,
          ownedPerkSelectors,
        }),
      }
    }
    state = {
      ...state,
      playerEntities: {
        ...state.playerEntities,
        progressions: state.playerEntities.progressions.map((progression) => ({
          ...progression,
          level: 12,
        })),
      },
    }
    const first = getPlayerCharacter(state, 'first')
    const killer = getPlayerCharacter(state, 'killer')
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
    const boneyardWorld = state.world
    const spawned = stepBoneyardEnemyStore(boneyardWorld.enemies, {
      projectileWorldBlocked: () => false,
      players: {
        first: {
          alive: true,
          collisionRadius: 25,
          connected: true,
          eligible: true,
          position: first.position,
          velocityPerTick: { x: 0, y: 0 },
        },
        killer: {
          alive: true,
          collisionRadius: 25,
          connected: true,
          eligible: true,
          position: killer.position,
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
        position: { x: first.position.x + 200, y: first.position.y },
        spawnTick: 0,
        waveOrdinal: 1,
      }],
      tick: 0,
    })
    const enemy = spawned.store.actors[0]!
    const killed = damageBoneyardEnemy(spawned.store, {
      actorId: enemy.id,
      amount: enemy.currentHealth,
      sourcePlayerId: creditedPlayerId,
      tick: 0,
    })
    state = {
      ...state,
      world: {
        ...boneyardWorld,
        enemies: killed.store,
        loot: { ...boneyardWorld.loot, sharedRng: createNativeRng(100) },
      },
    }

    state = stepGameSimulationTick(state, {})
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
    return state.world.loot.actors.map((actor) => ({
      amount: actor.amount,
      bonusKind: actor.bonusKind,
      itemKind: actor.item?.kind ?? null,
      kind: actor.kind,
      orbValue: actor.orbValue,
    }))
  }

  const goldSeed = 9_974_658
  const neutralGold = materializedReward([], [], goldSeed)
  assert.deepEqual(materializedReward([4], [], goldSeed), neutralGold)
  assert.equal(neutralGold.reduce((total, actor) => total + actor.amount, 0), 6)
  assert.equal(
    materializedReward([], [4], goldSeed).reduce((total, actor) => total + actor.amount, 0),
    7,
  )
  assert.deepEqual(materializedReward([4], [], goldSeed, 'disconnected'), neutralGold)

  const orbSeed = 6_778_989
  const neutralOrb = materializedReward([], [], orbSeed)
  assert.deepEqual(materializedReward([9], [], orbSeed), neutralOrb)
  assert.ok(materializedReward([], [9], orbSeed)[0]!.orbValue > neutralOrb[0]!.orbValue)

  const itemSeed = 247_445
  assert.deepEqual(materializedReward([3], [], itemSeed), materializedReward([], [], itemSeed))
  assert.equal(materializedReward([], [3], itemSeed)[0]?.itemKind, 'equipment')

  const powerupSeed = 143
  assert.deepEqual(
    materializedReward([23], [], powerupSeed),
    materializedReward([], [], powerupSeed),
  )
  assert.equal(materializedReward([], [23], powerupSeed)[0]?.kind, 'bonus')
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
      assert.equal(
        getPlayerProgression(state).damageX4TicksRemaining,
        NATIVE_DAMAGE_X4_BONUS_TICKS - 1,
      )
    }
  }
})

test('Ether Drain reaches a living caster through the authoritative field target path', () => {
  let state = etherDrainSimulation({ x: 400, y: 250 })
  const before = getPlayerCharacter(state).position
  for (let tick = 0; tick < 100; tick += 1) state = stepGameSimulationTick(state, {})
  const after = getPlayerCharacter(state).position
  assert.ok(after.x > before.x, 'the living caster must receive the inward native field force')
  assert.equal(after.y, before.y)
})

test('Ether Drain center contact can kill its living caster', () => {
  let state = etherDrainSimulation({ x: 250, y: 250 })
  for (let tick = 0; tick < 250; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (getPlayerProgression(state).lifeState !== 'alive') break
  }
  const progression = getPlayerProgression(state)
  assert.ok(progression.lifeState === 'lethal-pending' || progression.lifeState === 'dying')
  assert.ok(progression.currentHealth <= -10)
})

test('Ether Drain consumes eligible Gold and every item carried by a Sack without pickup credit', () => {
  for (const payload of ['gold', 'potion', 'key', 'element-book', 'random-book'] as const) {
    let state = etherDrainSimulation({ x: 400, y: 250 })
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
    const itemIds = createNativeLootItemIds(1)
    const item = payload === 'gold' ? null : payload === 'potion' ? potionItem(itemIds, 0)
      : miscItem(itemIds, payload === 'key' ? 1 : payload === 'element-book' ? 2 : 3)
    const specs = item === null
      ? [{ activationDelayTicks: 0, amount: 7, id: 1, kind: 'gold' as const,
          nativeTypeId: 2012 as const, phase: 0, position: { x: 400, y: 250 },
          source: 'script' as const, tier: 2 }]
      : [{ activationDelayTicks: 0, id: 1, item, kind: 'sack' as const,
          nativeTypeId: 2013 as const, phase: 0, position: { x: 400, y: 250 },
          source: 'script' as const }]
    const before = getPlayerEconomy(state)
    state = { ...state, world: { ...state.world,
      loot: spawnBoneyardLootSpecs(state.world.loot, specs, state.tick).store } }
    state = stepGameSimulationTick(state, {})
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
    assert.deepEqual(state.world.loot.actors, [], payload)
    assert.equal(getPlayerEconomy(state).gold, before.gold)
    assert.deepEqual(getPlayerEconomy(state).backpack, before.backpack)
    assert.equal(state.world.lootEvents.some(({ type }) => type === 'loot-pickup'), false)
  }
})

test('Ether Drain preserves delayed Gold and Sacks, then consumes them without needing a new query', () => {
  let state = etherDrainSimulation({ x: 400, y: 250 })
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const spawned = spawnBoneyardLootSpecs(state.world.loot, [
    { activationDelayTicks: 10, amount: 7, id: 1, kind: 'gold', nativeTypeId: 2012,
      phase: 0, position: { x: 400, y: 250 }, source: 'script', tier: 2 },
    { activationDelayTicks: 10, id: 2, item: miscItem(createNativeLootItemIds(1), 1),
      kind: 'sack', nativeTypeId: 2013, phase: 0, position: { x: 400, y: 250 }, source: 'script' },
  ], state.tick).store
  state = { ...state, world: { ...state.world, loot: spawned } }
  for (let tick = 0; tick < 9; tick += 1) state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  assert.deepEqual(state.world.loot.actors.map(({ kind }) => kind), ['gold', 'sack'])
  for (let tick = 0; tick < 4; tick += 1) state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  assert.deepEqual(state.world.loot.actors, [])
})

test('Ether Drain newly notified loot refreshes its ordinary target cache in the same tick', () => {
  let state = stepGameSimulationTick(etherDrainSimulation({ x: 400, y: 250 }), {})
  const initial = state.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!
  assert.equal(initial.quantity, 100)
  assert.equal(initial.etherDrain!.queried.some(ref => ref.kind === 'enemy'), false)
  state = withEtherDrainEnemy(state, 'SKELETON')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const loot = spawnBoneyardLootSpecs(state.world.loot, [{ activationDelayTicks: 10, amount: 7, id: 1,
    kind: 'gold', nativeTypeId: 2012, phase: 0, position: { x: 400, y: 300 }, source: 'script', tier: 2 }], state.tick).store
  state = stepGameSimulationTick({ ...state, world: { ...state.world, loot } }, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(state.world.enemies.actors[0]!.etherDrainCaptured, true,
    'the pickup notification must refresh ordinary members before field contact')
  assert.equal(state.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!.quantity, 100)
  assert.ok(state.world.loot.actors[0]!.activationDelayTicks > 0)
  assert.deepEqual(state.world.loot.actors[0]!.position, { x: 400, y: 300 })
})

test('Ether Drain pulls grounded world Bouncers and consumes them without a pickup or phase flare', () => {
  let state = withEtherDrainEnemy(etherDrainSimulation({ x: 400, y: 250 }), 'SKELETON')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const killed = damageBoneyardEnemy(state.world.enemies, { actorId: state.world.enemies.actors[0]!.id,
    amount: 1, sourcePlayerId: 'local-player', tick: state.tick })
  state = stepGameSimulationTick({ ...state, world: { ...state.world, enemies: killed.store } }, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const bouncers = state.world.enemies.deathEffects.filter(effect => effect.kind === 'bouncer')
  assert.ok(bouncers.length >= 3)
  const [grounded, airborne, consumed] = bouncers
  const prepared = bouncers.slice(0, 3).map((effect, index) => ({ ...effect,
    height: index === 1 ? -1 : 0, position: { x: [430, 450, 409][index]!, y: 250 },
    bounceVelocity: index === 1 ? -2 : 0, verticalVelocity: index === 1 ? -2 : 0,
    angularVelocityDeg: 0, velocity: { x: 0, y: 0 },
  }))
  state = { ...state, world: { ...state.world, loot: { ...state.world.loot, actors: [] },
    enemies: { ...state.world.enemies, deathEffects: prepared } } }
  state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const pulled = state.world.enemies.deathEffects.find(effect => effect.id === grounded!.id)!
  assert.ok(pulled.position.x < 430)
  assert.deepEqual(pulled.velocity, { x: 0, y: 0 })
  assert.deepEqual(state.world.enemies.deathEffects.find(effect => effect.id === airborne!.id)!.position, { x: 450, y: 250 })
  assert.equal(state.world.enemies.deathEffects.some(effect => effect.id === consumed!.id), false)
  assert.equal(state.world.lootEvents.some(event => event.type === 'loot-pickup'), false)
  assert.equal(state.secondaryAbilities.events.some(event => event.cue === 'phase'), false)
  assert.equal(state.secondaryAbilities.actors.some(actor => actor.kind === 'ether-drain-capture-flare'), false)
  assert.equal(state.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!.slowFactor,
    Math.fround(2 - Math.fround(.1)))
  const legacy = JSON.parse(createGameSaveDocument({ integrity: 'local-only',
    loadedBoneyard: combatBoneyard('ether-drain-targets'), mods: [], modState: {}, playerId: 'local-player', state }))
  legacy.schemaVersion = 47
  const simulation = legacy.continuation.simulation
  for (const progression of simulation.playerEntities.progressions) delete progression.corpseConsumed
  delete simulation.secondaryAbilities.actors.find((actor: { kind: string }) => actor.kind === 'ether-drain').etherDrain
  const stored = simulation.world.enemies.deathEffects.find((effect: { id: number }) => effect.id === grounded!.id)
  Object.assign(stored, { angularVelocityDeg: 0, bounceVelocity: -.5, height: 0, verticalVelocity: 0, velocity: { x: 0, y: 0 } })
  const restored = restoreGameSaveDocument(JSON.stringify(legacy)).state
  if (restored.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(restored.world.enemies.deathEffects.find(effect => effect.id === grounded!.id)!.bounceVelocity, 0)
})

test('Ether Drain routes grounded primary Hail and secondary chips through their saved animation owners', () => {
  let state = stepGameSimulationTick(etherDrainSimulation({ x: 400, y: 250 }), {})
  const managers = createNativeWorldManagerOrder(state.worldManagerOrder)
  const hail = createNativeWaterHailActor(state.primarySpells.nextId, 'local-player', 'boneyard:ether-drain-targets',
    state.tick, { x: 400, y: 250 }, { x: 1, y: 0 }, createNativeRng(37)).actor
  const shielded = { ...state.secondaryAbilities, players: { ...state.secondaryAbilities.players,
    'local-player': { ...state.secondaryAbilities.players['local-player']!, stoneskinTicksRemaining: 50 } } }
  const chipped = applyNativeSecondaryPlayerDamage(shielded, 'local-player', 1, state.tick,
    { x: 400, y: 250 }, 'boneyard:ether-drain-targets', { physical: true, enhancedEffects: true }).state
  const chip = chipped.actors.find(actor => actor.kind === 'stoneskin-chip')!
  assert.ok(chip)
  state = { ...state, primarySpells: { ...state.primarySpells, nextId: hail.id + 1,
    transients: [{ ...hail, height: 0, position: { x: 430, y: 250 }, horizontalVelocity: { x: 0, y: 0 },
      verticalVelocity: 0, savedBounceVelocity: 0, painterRegistrations: [managers.register('actor')] }] },
    secondaryAbilities: { ...chipped, actors: chipped.actors.map(actor => actor.id === chip.id ? { ...actor,
      phase: 0, position: { x: 409, y: 250 }, velocity: { x: 0, y: 0 }, endpoint: { x: 0, y: 0 } } : actor) },
    worldManagerOrder: managers.state() }
  state = stepGameSimulationTick(state, {})
  const pulled = state.primarySpells.transients.find(effect => effect.id === hail.id)!
  assert.equal(pulled.kind, 'water-hail')
  if (!('position' in pulled)) throw new Error('expected a positioned Water Hail actor')
  assert.ok(pulled.position.x < 430)
  assert.equal(state.secondaryAbilities.actors.some(actor => actor.id === chip.id), false)
  const field = state.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!
  assert.ok(field.etherDrain!.worldAnimationRefs.some(ref => ref.kind === 'primary-transient' && ref.id === hail.id))
  const restored = restoreGameSaveDocument(createGameSaveDocument({ integrity: 'local-only',
    loadedBoneyard: combatBoneyard('ether-drain-targets'), mods: [], modState: {}, playerId: 'local-player', state })).state
  const resumed = stepGameSimulationTick(restored, {})
  const next = stepGameSimulationTick(state, {})
  assert.deepEqual(resumed.primarySpells.transients, next.primarySpells.transients)
  assert.deepEqual(resumed.secondaryAbilities.actors.find(actor => actor.id === field.id)!.etherDrain,
    next.secondaryAbilities.actors.find(actor => actor.id === field.id)!.etherDrain)
  const wire = gameSnapshot(JSON.parse(JSON.stringify(createGameSnapshot(state, 'local-player'))))
  assert.deepEqual(wire.secondaryAbilities.actors.find(actor => actor.id === field.id)!.etherDrain, field.etherDrain)
})

test('Ether Drain mutates and consumes individual Golem death fragments with save and owner-removal continuation', () => {
  let state = withPlayerSkillRank(etherDrainSimulation({ x: 400, y: 250 }), 'local-player', 45, 1)
  state = addPlayerCharacter(state, 'observer', DEFAULT_PLAYER_CHARACTER_CONFIG)
  for (let tick = 0; tick < 150; tick++) state = stepGameSimulationTick(state, {})
  state = { ...state, playerEntities: setPlayerEntityMana(state.playerEntities, 'local-player', 100) }
  state = stepGameSimulationTick(bindGameSimulationPlayerSkillQuickbar(state, 'local-player', 45, 1)!, {
    'local-player': { ...gameplayInput(0, 0), cast: { primary: false, quickbar: 1 } },
  })
  const golem = state.secondaryAbilities.actors.find(actor => actor.kind === 'golem')!
  assert.ok(golem)
  const ready = { ...state.secondaryAbilities, actors: state.secondaryAbilities.actors.map(actor => actor.id === golem.id
    ? { ...actor, ageTicks: 400 } : actor) }
  const born = applyNativeSecondaryGolemDamage(ready, golem.id, { primaryDamage: 10_000,
    secondaryDamage: 0, reflectablePhysicalSourceInRange: false }, state.tick).state
  const death = born.actors.find(actor => actor.kind === 'golem-death')!
  assert.equal(death.golemDeath!.fragments.length, 30)
  state = { ...state, secondaryAbilities: { ...born, actors: born.actors.map(actor => actor.id === death.id ? { ...actor,
    golemDeath: { ...actor.golemDeath!, fragments: actor.golemDeath!.fragments.map((fragment, index) => {
      if (!fragment || index > 2) return fragment
      return { ...fragment, bounceVelocity: index === 1 ? -2 : 0, height: index === 1 ? -1 : 0,
        verticalVelocity: 0, velocity: { x: 0, y: 0 }, rotationStepDegrees: 0,
        position: { x: [430, 450, 409][index]!, y: 250 } }
    }) } } : actor) } }
  state = stepGameSimulationTick(state, {})
  const moved = state.secondaryAbilities.actors.find(actor => actor.id === death.id)!.golemDeath!
  assert.equal(state.secondaryAbilities.actors.find(actor => actor.id === death.id)!.painterRegistrations!.length, 31)
  assert.ok(moved.fragments[0]!.position.x < 430)
  assert.equal(moved.fragments[1]!.position.x, 450)
  assert.equal(moved.fragments[2], null)
  const restored = restoreGameSaveDocument(createGameSaveDocument({ integrity: 'local-only',
    loadedBoneyard: combatBoneyard('ether-drain-targets'), mods: [], modState: {}, playerId: 'local-player', state })).state
  const resumed = stepGameSimulationTick(restored, {})
  const next = stepGameSimulationTick(state, {})
  assert.deepEqual(resumed.secondaryAbilities.actors.find(actor => actor.id === death.id)!.golemDeath,
    next.secondaryAbilities.actors.find(actor => actor.id === death.id)!.golemDeath)
  const detached = removePlayerCharacter(state, 'local-player')
  assert.ok(detached.secondaryAbilities.actors.some(actor => actor.id === death.id))
  const continued = stepGameSimulationTick(detached, {})
  assert.ok(continued.secondaryAbilities.actors.some(actor => actor.id === death.id))
  const wire = gameSnapshot(JSON.parse(JSON.stringify(createGameSnapshot(continued, 'observer'))))
  assert.deepEqual(wire.secondaryAbilities.actors.find(actor => actor.id === death.id)!.golemDeath,
    continued.secondaryAbilities.actors.find(actor => actor.id === death.id)!.golemDeath)
  const saved = createGameSaveDocument({ integrity: 'local-only', loadedBoneyard: combatBoneyard('ether-drain-targets'),
    mods: [], modState: {}, playerId: 'local-player', state })
  for (const invalid of ['missing', 'seed', 'slots', 'quality', 'settled', 'index', 'painters']) {
    const document = JSON.parse(saved)
    const actor = document.continuation.simulation.secondaryAbilities.actors.find((candidate: { id: number }) => candidate.id === death.id)
    if (invalid === 'missing') delete actor.golemDeath
    if (invalid === 'seed') actor.presentationRng = ready.rng
    if (invalid === 'slots') actor.golemDeath.fragments.pop()
    if (invalid === 'quality') actor.golemDeath.fragments[0].life = 11
    if (invalid === 'settled') actor.golemDeath.fragments[1].bounceVelocity = 0
    if (invalid === 'painters') actor.painterRegistrations.pop()
    if (invalid === 'index') {
      const field = document.continuation.simulation.secondaryAbilities.actors.find((candidate: { kind: string }) => candidate.kind === 'ether-drain')
      field.etherDrain.worldAnimationRefs = [{ kind: 'golem-fragment', id: death.id, index: 30 }]
      field.etherDrain.lastWorldAnimationIds['golem-fragment'] = death.id
    }
    assert.throws(() => restoreGameSaveDocument(JSON.stringify(document)), /Golem|golemDeath|etherDrain|painterRegistrations/i, invalid)
  }
  const legacy = JSON.parse(saved)
  legacy.schemaVersion = 47
  const simulation = legacy.continuation.simulation
  for (const progression of simulation.playerEntities.progressions) delete progression.corpseConsumed
  delete simulation.world.deathWeapons
  delete simulation.world.nextDeathWeaponId
  const oldDeath = simulation.secondaryAbilities.actors.find((candidate: { id: number }) => candidate.id === death.id)
  delete oldDeath.golemDeath
  oldDeath.presentationRng = ready.rng
  oldDeath.lifetimeTicks = 134
  oldDeath.painterRegistrations = [oldDeath.painterRegistrations[0]]
  for (const actor of simulation.secondaryAbilities.actors) if (actor.kind === 'ether-drain') delete actor.etherDrain
  const migrated = restoreGameSaveDocument(JSON.stringify(legacy)).state
  const migratedDeath = migrated.secondaryAbilities.actors.find(actor => actor.id === death.id)!
  assert.equal(migratedDeath.presentationRng, null)
  assert.equal(migratedDeath.golemDeath!.fragments.length, 30)
  assert.equal(migratedDeath.painterRegistrations!.length, 31)
  assert.deepEqual(migrated.secondaryAbilities.rng, simulation.secondaryAbilities.rng)
  const checkpoint = createGameSaveDocument({ integrity: 'local-only', loadedBoneyard: combatBoneyard('ether-drain-targets'),
    mods: [], modState: {}, playerId: 'local-player', state: migrated })
  assert.deepEqual(stepGameSimulationTick(restoreGameSaveDocument(checkpoint).state, {}).secondaryAbilities,
    stepGameSimulationTick(migrated, {}).secondaryAbilities)
  oldDeath.ageTicks = 134
  assert.throws(() => restoreGameSaveDocument(JSON.stringify(legacy)), /saved Golem death age/,
    'reject the retired replay lifetime before reconstructing untrusted animation ages')
})

test('Ether Drain consumes an independently dropped weapon once and preserves an unconsumed drop after its owner leaves', () => {
  let state = addPlayerCharacter(etherDrainSimulation({ x: 400, y: 250 }), 'victim', DEFAULT_PLAYER_CHARACTER_CONFIG)
  const equipment = getPlayerEconomy(state, 'victim').equipment
  state = { ...state, playerEntities: damagePlayerEntity(state.playerEntities, 'victim', 10_000, state.tick) }
  for (let tick = 0; tick < 10; tick++) {
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    if (state.world.deathWeapons.some(actor => actor.ownerId === 'victim')) break
    state = stepGameSimulationTick(state, {})
  }
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const weapon = state.world.deathWeapons.find(actor => actor.ownerId === 'victim')!
  assert.ok(weapon)
  const index = state.playerEntities.identities.findIndex(identity => identity.playerId === 'victim')
  const prepared = { ...weapon, motion: { ...weapon.motion, bounceVelocity: 0, height: 0,
    rotationStepDegrees: 0, velocity: { x: 0, y: 0 }, verticalVelocity: 0, position: { x: 430, y: 250 } } }
  state = { ...state, playerEntities: { ...state.playerEntities,
    progressions: state.playerEntities.progressions.map((value, i) => i === index ? { ...value, corpseConsumed: true } : value) },
    world: { ...state.world, deathWeapons: state.world.deathWeapons.map(actor => actor.id === weapon.id ? prepared : actor) } }
  state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.ok(state.world.deathWeapons.find(actor => actor.id === weapon.id)!.motion.position.x < 430)
  const retained = removePlayerCharacter(state, 'victim')
  assert.equal(retained.world.kind, 'boneyard')
  if (retained.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.ok(retained.world.deathWeapons.some(actor => actor.id === weapon.id))
  const snapshot = createGameSnapshot(retained, 'local-player')
  const frame = gameSnapshotFrame(JSON.parse(JSON.stringify(createGameSnapshotFrame(snapshot, 0, undefined, true))))
  const reconstructed = new EntityReplicationReconstructor().apply(frame, 1)
  if (reconstructed.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.deepEqual(reconstructed.world.deathWeapons, retained.world.deathWeapons,
    'a nonempty independent weapon survives the actual frame codec and materializer after owner departure')
  state = { ...state, world: { ...state.world, deathWeapons: state.world.deathWeapons.map(actor => actor.id === weapon.id
    ? { ...actor, motion: { ...actor.motion, position: { x: 409, y: 250 } } } : actor) } }
  state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(state.world.deathWeapons.some(actor => actor.id === weapon.id), false)
  assert.deepEqual(getPlayerEconomy(state, 'victim').equipment, equipment)
  state = { ...state, playerEntities: { ...state.playerEntities, progressions: state.playerEntities.progressions.map(
    (value, i) => i === index ? { ...value, corpseConsumed: false } : value) } }
  const restored = restoreGameSaveDocument(createGameSaveDocument({ integrity: 'local-only',
    loadedBoneyard: combatBoneyard('ether-drain-targets'), mods: [], modState: {}, playerId: 'victim', state })).state
  const next = stepGameSimulationTick(restored, {})
  if (next.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(next.world.deathWeapons.length, 0)
})

function deathWeaponSimulation(): GameSimulationState {
  let state = addPlayerCharacter(enterBoneyardWorld(createGameSimulation(), combatBoneyard('death-animation-save')),
    'victim', DEFAULT_PLAYER_CHARACTER_CONFIG)
  state = { ...state, playerEntities: damagePlayerEntity(state.playerEntities, 'victim', 10_000, state.tick) }
  for (let tick = 0; tick < 10; tick++) {
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    if (state.world.deathWeapons.some(actor => actor.ownerId === 'victim')) return state
    state = stepGameSimulationTick(state, {})
  }
  throw new Error('expected the real death-weapon producer')
}

test('schema47 dropped weapons migrate once without advancing the saved gameplay random streams', () => {
  const state = deathWeaponSimulation()
  for (const deathTick of [0, 298]) {
    const document = JSON.parse(createGameSaveDocument({ integrity: 'local-only',
      loadedBoneyard: combatBoneyard('death-animation-save'), mods: [], modState: {}, playerId: 'victim', state }))
    document.schemaVersion = 47
    const simulation = document.continuation.simulation
    simulation.tick = 600
    document.continuation.summary.savedAtTick = 600
    delete simulation.world.deathWeapons
    delete simulation.world.nextDeathWeaponId
    for (const progression of simulation.playerEntities.progressions) delete progression.corpseConsumed
    const index = simulation.playerEntities.identities.findIndex((identity: { playerId: string }) => identity.playerId === 'victim')
    simulation.playerEntities.progressions[index].deathTick = deathTick
    simulation.playerEntities.progressions[index].deathAgeTicks = deathTick === 0 ? 0 : 498
    const restored = restoreGameSaveDocument(JSON.stringify(document)).state
    if (restored.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    assert.equal(restored.world.deathWeapons.length, 1)
    const drop = restored.world.deathWeapons[0]!
    assert.equal(drop.birthTick, 600)
    assert.equal(drop.ageTicks, 0)
    assert.equal(drop.ownerId, 'victim')
    assert.equal(drop.motion.bounceVelocity === 0, deathTick === 298)
    assert.deepEqual(restored.secondaryAbilities.rng, simulation.secondaryAbilities.rng)
    assert.deepEqual(restored.gameRng, simulation.gameRng)
    const saved = createGameSaveDocument({ integrity: 'local-only', loadedBoneyard: combatBoneyard('death-animation-save'),
      mods: [], modState: {}, playerId: 'victim', state: restored })
    const resumed = stepGameSimulationTick(restoreGameSaveDocument(saved).state, {})
    const next = stepGameSimulationTick(restored, {})
    if (resumed.world.kind !== 'boneyard' || next.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    assert.deepEqual(resumed.world.deathWeapons, next.world.deathWeapons)
    assert.equal(next.world.deathWeapons.length, 1, 'the retained death marker prevents a second birth')
  }
})

test('current saves require independent death weapons and an allocator ahead of their ids', () => {
  const state = deathWeaponSimulation()
  const saved = createGameSaveDocument({ integrity: 'local-only', loadedBoneyard: combatBoneyard('death-animation-save'),
    mods: [], modState: {}, playerId: 'local-player', state })
  for (const invalid of ['missing', 'allocator', 'duplicate', 'settled', 'clock', 'extra']) {
    const document = JSON.parse(saved)
    const world = document.continuation.simulation.world
    const drop = world.deathWeapons[0]
    if (invalid === 'missing') delete world.deathWeapons
    if (invalid === 'allocator') world.nextDeathWeaponId = drop.id
    if (invalid === 'duplicate') world.deathWeapons.push({ ...drop })
    if (invalid === 'settled') drop.motion.bounceVelocity = 0
    if (invalid === 'clock') drop.birthTick = document.continuation.simulation.tick + 1
    if (invalid === 'extra') drop.replaySeed = 37
    assert.throws(() => restoreGameSaveDocument(JSON.stringify(document)), /death.weapon|deathWeapons/i, invalid)
  }
})

test('an independent dropped weapon continues through Game Over and clears on world replacement', () => {
  let state = deathWeaponSimulation()
  state = { ...state, playerEntities: damagePlayerEntity(state.playerEntities, 'local-player', 10_000, state.tick) }
  for (let tick = 0; tick < 10 && state.run.phase !== 'game-over'; tick++) state = stepGameSimulationTick(state, {})
  assert.equal(state.run.phase, 'game-over')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const drop = state.world.deathWeapons.find(actor => actor.ownerId === 'victim')!
  assert.ok(drop)
  for (let tick = 0; tick < 3; tick++) state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const moved = state.world.deathWeapons.find(actor => actor.id === drop.id)!
  assert.ok(moved.ageTicks > drop.ageTicks)
  assert.notDeepEqual(moved.motion, drop.motion)
  const fresh = enterBoneyardWorld(returnGameSimulationToHub(state), combatBoneyard('replacement-death-animation-world'))
  if (fresh.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.deepEqual(fresh.world.deathWeapons, [])
  assert.equal(fresh.world.nextDeathWeaponId, 1)
})

function etherDrainSimulation(position: { x: number; y: number }): GameSimulationState {
  let state = enterBoneyardWorld(createGameSimulation(), combatBoneyard('ether-drain-targets'))
  state = withPlayerSkillRank(state, 'local-player', 74, 1)
  const bound = bindGameSimulationPlayerSkillQuickbar(state, 'local-player', 74, 0)
  assert.ok(bound)
  state = stepGameSimulationTick(bound, { 'local-player': {
    ...gameplayInput(0, 0), aim: position, cast: { primary: false, quickbar: 0 },
  } })
  assert.ok(state.secondaryAbilities.actors.some(({ kind }) => kind === 'ether-drain'))
  return state
}

test('Rush retains its movement drive while field depth determines escape', () => {
  const fixture = (distance: number) => {
    let state = withPlayerSkillRank(etherDrainSimulation({ x: 400, y: 250 }), 'local-player', 67, 1)
    for (let tick = 0; tick < 150; tick += 1) state = stepGameSimulationTick(state, {})
    const field = state.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!
    assert.equal(field.alpha, 1)
    state = { ...state, playerEntities: replacePlayerCharacter(state.playerEntities, 'local-player', {
      ...getPlayerCharacter(state), position: { x: field.position.x - distance, y: field.position.y }, velocity: { x: 0, y: 0 },
    }) }
    for (let tick = 0; tick < 80; tick += 1) state = stepGameSimulationTick(state, { 'local-player': gameplayInput(-1, 0) })
    assert.equal(getPlayerProgression(state).lifeState, 'alive')
    return { player: getPlayerCharacter(state), field }
  }
  const deep = fixture(1)
  const outer = fixture(350)
  assert.ok(Math.abs(deep.player.position.x - deep.field.position.x) < 10)
  assert.ok(outer.field.position.x - outer.player.position.x > 355)
  assert.deepEqual(deep.player.velocity, outer.player.velocity, 'field pressure must not alter the Rush velocity accumulator')
})

test('Ether Drain reaches party members and saves its typed target references', () => {
  const loadedBoneyard = combatBoneyard('ether-drain-party')
  const config = { discipline: 'arcane', displayName: 'Wizard', element: 'ether' } as const
  let state = enterBoneyardWorld(createGameSimulation({ caster: config, peer: config }), loadedBoneyard)
  state = withPlayerSkillRank(state, 'caster', 74, 1)
  state = { ...state, playerEntities: replacePlayerCharacter(state.playerEntities, 'peer', {
    ...getPlayerCharacter(state, 'peer'), position: { x: 250, y: 300 },
  }) }
  const bound = bindGameSimulationPlayerSkillQuickbar(state, 'caster', 74, 0)!
  state = stepGameSimulationTick(bound, { caster: { ...gameplayInput(0, 0), aim: { x: 400, y: 250 }, cast: { primary: false, quickbar: 0 } } })
  for (let tick = 0; tick < 40; tick += 1) state = stepGameSimulationTick(state, {})
  assert.ok(getPlayerCharacter(state, 'peer').position.x > 250)
  const field = state.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!
  assert.ok(field.etherDrain?.queried.some(ref => ref.kind === 'player' && ref.id === 'peer'))
  const restored = restoreGameSaveDocument(createGameSaveDocument({
    integrity: 'local-only', loadedBoneyard, mods: [], modState: {}, playerId: 'caster', state,
  })).state
  assert.deepEqual(restored.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!.etherDrain, field.etherDrain)
  const resumed = stepGameSimulationTick(restored, {})
  assert.ok(getPlayerCharacter(resumed, 'caster').position.x > getPlayerCharacter(restored, 'caster').position.x)
  assert.equal(resumed.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!.etherDrain!.queried
    .some(ref => ref.kind === 'player' && ref.id === 'peer'), false)
})

test('Ether Drain single-player continuation preserves field pressure and private animation state', () => {
  let state = etherDrainSimulation({ x: 400, y: 250 })
  for (let tick = 0; tick < 40; tick += 1) state = stepGameSimulationTick(state, {})
  const restored = restoreGameSaveDocument(createGameSaveDocument({ integrity: 'local-only',
    loadedBoneyard: combatBoneyard('ether-drain-targets'), mods: [], modState: {}, playerId: 'local-player', state })).state
  const resumed = stepGameSimulationTick(restored, {})
  const next = stepGameSimulationTick(state, {})
  assert.deepEqual(getPlayerCharacter(resumed).position, getPlayerCharacter(next).position)
  assert.deepEqual(resumed.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!.etherDrain,
    next.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!.etherDrain)
})

test('Ether Drain preserves world Orbs and Bonus books or Quad Damage at its center', () => {
  for (const bonusKind of [0, 1, 2] as const) {
    let state = etherDrainSimulation({ x: 400, y: 250 })
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    const position = { x: 400, y: 250 }
    const loot = spawnBoneyardLootSpecs(state.world.loot, [
      { activationDelayTicks: 0, id: 1, kind: 'orb', nativeTypeId: 2011, orbKind: 'mana', value: .5, phase: 0, position, source: 'script' },
      { activationDelayTicks: 0, bonusKind, id: 2, kind: 'bonus', nativeTypeId: 2038, phase: 0, position, source: 'script' },
    ], state.tick).store
    state = stepGameSimulationTick({ ...state, world: { ...state.world, loot } }, {})
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    assert.deepEqual(state.world.loot.actors.map(actor => [actor.kind, actor.position]), [['orb', position], ['bonus', position]])
    assert.equal(state.world.lootEvents.some(event => event.type === 'loot-pickup'), false)
  }
})

test('Ether Drain consumes a corpse at native death timer130 and persists that terminal disposition', () => {
  const loadedBoneyard = combatBoneyard('ether-drain-corpse')
  const config = { discipline: 'arcane', displayName: 'Wizard', element: 'ether' } as const
  let state = withPlayerSkillRank(enterBoneyardWorld(createGameSimulation({ caster: config, victim: config }), loadedBoneyard), 'caster', 74, 1)
  state = stepGameSimulationTick(bindGameSimulationPlayerSkillQuickbar(state, 'caster', 74, 0)!, {
    caster: { ...gameplayInput(0, 0), aim: { x: 400, y: 250 }, cast: { primary: false, quickbar: 0 } },
  })
  const economy = getPlayerEconomy(state, 'victim')
  const carried = { ...miscItem(createNativeLootItemIds(90_000), 1), name: 'Carried Drain Key' }
  const stored = { ...economy.backpack[1]!, id: 90_001, name: 'Previously Stored Drain Potion' }
  const packed = insertLootInventoryItem(economy, carried)
  assert.equal(packed.accepted, true)
  state = { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, 'victim', {
    ...packed.state, nextItemId: 90_002, ownedPerkSelectors: [12], storage: [stored],
  }) }
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  state = { ...state, world: { ...state.world, loot: spawnBoneyardLootSpecs(state.world.loot, [{
    activationDelayTicks: 0, amount: 9, id: state.world.loot.nextActorId, kind: 'gold', nativeTypeId: 2012,
    phase: 0, position: { x: 50, y: 50 }, source: 'script', tier: 3,
  }], state.tick).store } }
  const index = state.playerEntities.identities.findIndex(identity => identity.playerId === 'victim')
  state = { ...state, playerEntities: { ...replacePlayerCharacter(state.playerEntities, 'victim', {
    ...getPlayerCharacter(state, 'victim'), position: { x: 400, y: 250 }, velocity: { x: 0, y: 0 },
  }), progressions: state.playerEntities.progressions.map((progression, i) => i === index
    ? { ...progression, currentHealth: -10, deathAgeTicks: 215, deathEpoch: 1, deathTick: 129, lifeState: 'dying' as const } : progression) } }
  state = stepGameSimulationTick(state, {})
  assert.equal(getPlayerProgression(state, 'victim').corpseConsumed, false)
  const ordinaryArchive = gameSimulationDurableProfileEconomy({ ...state,
    run: { ...state.run, phase: 'game-over' } }, 'victim')
  assert.ok(ordinaryArchive.storage.some(item => item.contents?.some(child => child.name === carried.name)))
  assert.equal(ordinaryArchive.gold, economy.gold + 9)
  state = stepGameSimulationTick(state, {})
  assert.equal(getPlayerProgression(state, 'victim').deathTick, 130)
  assert.equal(getPlayerProgression(state, 'victim').corpseConsumed, true)
  const restored = restoreGameSaveDocument(createGameSaveDocument({ integrity: 'local-only', loadedBoneyard,
    mods: [], modState: {}, playerId: 'victim', state })).state
  assert.equal(getPlayerProgression(restored, 'victim').corpseConsumed, true)
  const complete = { ...state, run: { ...state.run, phase: 'game-over' as const } }
  const archived = gameSimulationDurableProfileEconomy(complete, 'victim')
  assert.deepEqual(archived.storage, [stored], 'field consumption suppresses the carried archive and preserves prior storage')
  assert.equal(archived.gold, economy.gold, 'a consumed corpse cannot regain ground Gold through the terminal Last Word projection')
})

test('terminal player maintenance consumes the corpse before Last Word and carried-item archive', () => {
  let state = etherDrainSimulation({ x: 400, y: 250 })
  const economy = getPlayerEconomy(state)
  const carried = { ...miscItem(createNativeLootItemIds(90000), 1), name: 'Terminal Drain Key' }
  const packed = insertLootInventoryItem(economy, carried)
  assert.equal(packed.accepted, true)
  state = { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, 'local-player', {
    ...packed.state, nextItemId: 90001, ownedPerkSelectors: [12],
  }) }
  state = { ...state, playerEntities: damagePlayerEntity(state.playerEntities, 'local-player', 10000, state.tick) }
  for (let tick = 0; tick < 10 && state.run.phase !== 'game-over'; tick++) state = stepGameSimulationTick(state, {})
  assert.equal(state.run.phase, 'game-over')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const field = state.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!
  assert.ok(field)
  state = { ...state, playerEntities: { ...replacePlayerCharacter(state.playerEntities, 'local-player', {
    ...getPlayerCharacter(state), position: field.position, velocity: { x: 0, y: 0 },
  }), progressions: state.playerEntities.progressions.map(progression => ({
    ...progression, corpseConsumed: false, deathAgeTicks: 215, deathTick: 129,
  })) } }
  const control = { ...state, secondaryAbilities: { ...state.secondaryAbilities,
    actors: state.secondaryAbilities.actors.filter(actor => actor.id !== field.id) } }
  const before = stepGameSimulationTick(state, {})
  assert.equal(getPlayerProgression(before).deathTick, 129)
  assert.equal(getPlayerProgression(before).corpseConsumed, false)
  const consumed = stepGameSimulationTick(before, {})
  const ordinary = stepGameSimulationTick(stepGameSimulationTick(control, {}), {})
  assert.equal(getPlayerProgression(consumed).deathTick, 130)
  assert.equal(getPlayerProgression(consumed).corpseConsumed, true)
  assert.equal(getPlayerProgression(ordinary).corpseConsumed, false)
  assert.equal(consumed.secondaryAbilities.actors.find(actor => actor.id === field.id)!.slowFactor, 1.899999976158142,
    'the callback pulse retains the native parent fade in this full-tick projection')
  assert.ok(gameSimulationDurableProfileEconomy(ordinary, 'local-player').storage
    .some(item => item.contents?.some(child => child.name === carried.name)))
  assert.equal(gameSimulationDurableProfileEconomy(consumed, 'local-player').storage
    .some(item => item.contents?.some(child => child.name === carried.name)), false)
  let continued = consumed
  let continuedControl = ordinary
  for (let tick = 0; tick < 160 && getPlayerProgression(continued).deathTick < 200; tick++) {
    continued = stepGameSimulationTick(continued, {})
    continuedControl = stepGameSimulationTick(continuedControl, {})
  }
  assert.equal(getPlayerProgression(continued).deathTick, 200)
  assert.equal(getPlayerProgression(continued).corpseConsumed, true)
  assert.equal(continued.secondaryAbilities.actors.some(actor => actor.kind === 'mindblast-burst'), false)
  assert.equal(continuedControl.secondaryAbilities.actors.some(actor => actor.kind === 'mindblast-burst'), true,
    'the unconsumed control proves that the actual Last Word producer was reached')
})

test('Ether Drain captures each supported enemy image through the public lethal and retirement path', () => {
  for (const enemyToken of ['SKELETON', 'SKELETONARCHER', 'SKELETONMAGE', 'ZOMBIE', 'DEMON'] as const) {
    let state = withEtherDrainEnemy(etherDrainSimulation({ x: 400, y: 250 }), enemyToken,
      enemyToken === 'ZOMBIE' ? ['FLAG_ROTTEN'] : [])
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    const victim = state.world.enemies.actors[0]!
    state = stepGameSimulationTick(state, {})
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    assert.equal(state.world.enemies.actors.find(actor => actor.id === victim.id)?.etherDrainCaptured, true, enemyToken)
    const field = state.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!
    const image = field.etherDrain!.animations.find(animation => animation.kind === 'captured')!
    assert.equal(image.kind, 'captured')
    if (image.kind !== 'captured') throw new Error('expected captured image')
    assert.equal(image.atlas, enemyToken === 'DEMON' ? 'Demon' : 'BadGuys')
    assert.ok(enemyToken === 'DEMON' ? image.entry >= 80 && image.entry <= 97
      : enemyToken === 'ZOMBIE' ? image.entry >= 2293 && image.entry <= 2346
      : image.entry >= 1477 && image.entry <= 1584, enemyToken)
    assert.equal(image.bodyYOffset, enemyToken.startsWith('SKELETON') ? 23 : 0)
    assert.equal(image.alpha, Math.fround(1.25 - Math.fround(.2)))
    assert.equal(state.secondaryAbilities.events.filter(event => event.cue === 'crunch-drain').length, 1)
    const restored = restoreGameSaveDocument(createGameSaveDocument({ integrity: 'local-only',
      loadedBoneyard: combatBoneyard('ether-drain-targets'), mods: [], modState: {}, playerId: 'local-player', state })).state
    const next = stepGameSimulationTick(state, {})
    const resumed = stepGameSimulationTick(restored, {})
    if (next.world.kind !== 'boneyard' || resumed.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    assert.equal(next.world.enemies.actors.some(actor => actor.id === victim.id), false)
    assert.equal(resumed.world.enemies.actors.some(actor => actor.id === victim.id), false)
    assert.deepEqual(next.world.enemies.deathEffects, [])
    assert.equal(next.world.enemies.projectiles.some(projectile => projectile.kind === 'poison-pool'), false)
    assert.equal(next.world.enemyEvents.some(event => event.actorId === victim.id && event.type === 'enemy-death-sound'), false)
    assert.deepEqual(resumed.secondaryAbilities.actors.find(actor => actor.id === field.id)!.etherDrain,
      next.secondaryAbilities.actors.find(actor => actor.id === field.id)!.etherDrain)
    state = next
    for (let update = 0; update < 5; update++) state = stepGameSimulationTick(state, {})
    assert.equal(state.secondaryAbilities.actors.find(actor => actor.id === field.id)!.etherDrain!.animations
      .some(animation => animation.kind === 'captured'), false)
    assert.ok(state.secondaryAbilities.actors.some(actor => actor.kind === 'ether-drain-capture-flare' && actor.scale === 1.5))
    assert.ok(state.secondaryAbilities.events.some(event => event.cue === 'phase' && event.pitch === 1.5))
  }
})

test('Ether Drain unsupported enemy images retire without ordinary effects, splits or crunch audio', () => {
  for (const enemyToken of ['IMP', 'SPIDER', 'WRAITH'] as const) {
    let state = withEtherDrainEnemy(etherDrainSimulation({ x: 400, y: 250 }), enemyToken,
      enemyToken === 'IMP' ? ['FLAG_SPLIT'] : [])
    state = stepGameSimulationTick(state, {})
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    assert.equal(state.world.enemies.actors[0]?.etherDrainCaptured, true, enemyToken)
    assert.equal(state.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!.etherDrain!.animations.length, 0)
    assert.equal(state.secondaryAbilities.events.some(event => event.cue === 'crunch-drain'), false)
    state = stepGameSimulationTick(state, {})
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    assert.deepEqual(state.world.enemies.actors, [], enemyToken)
    assert.deepEqual(state.world.enemies.deathEffects, [])
    assert.deepEqual(state.world.enemies.spiderRemains, [])
    assert.equal(state.world.enemyEvents.some(event => event.type === 'enemy-death-sound'), false)
  }
})

test('Ether Drain schema47 debris migrates into its parent and discards orphaned animation actors', () => {
  const state = etherDrainSimulation({ x: 400, y: 250 })
  const document = JSON.parse(createGameSaveDocument({ integrity: 'local-only',
    loadedBoneyard: combatBoneyard('ether-drain-targets'), mods: [], modState: {}, playerId: 'local-player', state }))
  document.schemaVersion = 47
  const simulation = document.continuation.simulation
  for (const progression of simulation.playerEntities.progressions) delete progression.corpseConsumed
  const parent = simulation.secondaryAbilities.actors.find((actor: { kind: string }) => actor.kind === 'ether-drain')
  delete parent.etherDrain
  const child = { ...parent, id: simulation.secondaryAbilities.nextActorId++, kind: 'ether-drain-debris',
    position: { x: 430, y: 250 }, velocity: { x: 1, y: 0 }, quantity: 30, slowFactor: 1,
    phase: 12, rotationRadians: Math.PI / 2, variant: 2, hitTargetIds: [parent.id] }
  simulation.secondaryAbilities.actors.push(child, { ...child, id: simulation.secondaryAbilities.nextActorId++, hitTargetIds: [999] })
  const restored = restoreGameSaveDocument(JSON.stringify(document)).state
  const field = restored.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!
  assert.deepEqual(field.etherDrain, { animations: [{ kind: 'debris', position: child.position,
    direction: child.velocity, remainingDistance: 30, speed: 1, oscillationDegrees: 12, rotationDegrees: 90, variant: 2 }],
    targetsInitialized: false, lastLootRegistrationOrdinal: -1, loose: [], queried: [], scenery: [], worldAnimationRefs: [],
    lastWorldAnimationIds: { 'enemy-death-effect': 0, 'primary-transient': 0, 'secondary-actor': 0, 'death-weapon': 0, 'golem-fragment': 0 } })
  assert.equal(restored.secondaryAbilities.actors.length, 1)
  assert.equal(getPlayerProgression(restored).corpseConsumed, false)
  const resumed = stepGameSimulationTick(restored, {})
  const continued = resumed.secondaryAbilities.actors.find(actor => actor.id === field.id)!
  assert.equal(continued.etherDrain!.targetsInitialized, true)
  assert.ok(continued.etherDrain!.queried.some(ref => ref.kind === 'player' && ref.id === 'local-player'))
  assert.equal(continued.etherDrain!.animations[0]?.kind, 'debris')
  if (continued.etherDrain!.animations[0]?.kind === 'debris') assert.equal(continued.etherDrain!.animations[0].remainingDistance, 29)
})

test('Ether Drain pulls a summoned Golem with its articulation and respects the400-tick damage grace', () => {
  let state = withPlayerSkillRank(etherDrainSimulation({ x: 400, y: 250 }), 'local-player', 45, 1)
  for (let tick = 0; tick < 150; tick++) state = stepGameSimulationTick(state, {})
  state = { ...state, playerEntities: setPlayerEntityMana(state.playerEntities, 'local-player', 100) }
  state = stepGameSimulationTick(bindGameSimulationPlayerSkillQuickbar(state, 'local-player', 45, 1)!, {
    'local-player': { ...gameplayInput(0, 0), aim: { x: 350, y: 250 }, cast: { primary: false, quickbar: 1 } },
  })
  const golem = state.secondaryAbilities.actors.find(actor => actor.kind === 'golem')!
  assert.ok(golem?.golem)
  const fieldPosition = { x: golem.position.x + (golem.position.x >= 250 ? -50 : 50), y: golem.position.y }
  state = { ...state, secondaryAbilities: { ...state.secondaryAbilities,
    actors: state.secondaryAbilities.actors.map(actor => actor.kind === 'ether-drain' ? { ...actor,
      alpha: 1, phase: 1, quantity: 0, position: fieldPosition } : actor) } }
  const control = stepGameSimulationTick({ ...state, secondaryAbilities: { ...state.secondaryAbilities,
    actors: state.secondaryAbilities.actors.filter(actor => actor.kind !== 'ether-drain') } }, {})
  const unpulled = control.secondaryAbilities.actors.find(actor => actor.id === golem.id)!
  const moved = stepGameSimulationTick(state, {})
  const pulled = moved.secondaryAbilities.actors.find(actor => actor.id === golem.id)!
  const dx = Math.fround(pulled.position.x - unpulled.position.x)
  assert.ok(dx * (fieldPosition.x - golem.position.x) > 0 && Math.abs(dx) < .3,
    'native Golem pressure is one quarter of the ordinary force')
  assert.equal(pulled.golem!.currentHealth, golem.golem!.currentHealth)
  for (const key of ['leftFoot', 'leftFootNext', 'leftFootPrevious', 'rightFoot', 'rightFootNext', 'rightFootPrevious'] as const) {
    assert.equal(pulled.golem![key].x, Math.fround(unpulled.golem![key].x + dx), key)
  }
  const field = moved.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!
  assert.ok(field.etherDrain!.queried.some(ref => ref.kind === 'golem' && ref.id === golem.id))
  state = { ...moved, secondaryAbilities: { ...moved.secondaryAbilities,
    actors: moved.secondaryAbilities.actors.map(actor => actor.id === golem.id ? { ...actor,
      ageTicks: 398, position: field.position } : actor) } }
  const grace = stepGameSimulationTick(state, {})
  const protectedGolem = grace.secondaryAbilities.actors.find(actor => actor.id === golem.id)!
  assert.equal(protectedGolem.ageTicks, 399)
  assert.equal(protectedGolem.golem!.currentHealth, golem.golem!.currentHealth)
  const admitted = stepGameSimulationTick(grace, {})
  const damaged = admitted.secondaryAbilities.actors.find(actor => actor.id === golem.id)!
  assert.equal(damaged.ageTicks, 400)
  assert.ok(damaged.golem!.currentHealth < protectedGolem.golem!.currentHealth)
})

test('Ether Drain admits inactive Maggots but excludes their hidden Coffin and retires capture without gore', () => {
  let state = withEtherDrainEnemy(etherDrainSimulation({ x: 400, y: 250 }), 'COFFIN')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const coffin = state.world.enemies.actors[0]!
  if (coffin.brain.family !== 'coffin') throw new Error('expected Coffin')
  state = { ...state, world: { ...state.world, enemies: { ...state.world.enemies,
    actors: [{ ...coffin, currentHealth: coffin.config.maximumHealth,
      brain: { ...coffin.brain, phase: 'open', maggotCharge: 0 } }] } } }
  state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.ok(state.world.enemies.maggots.length > 0)
  const source = state.world.enemies.maggots[0]!
  const hidden = state.world.enemies.actors[0]!
  if (hidden.brain.family !== 'coffin') throw new Error('expected Coffin')
  state = { ...state, world: { ...state.world, enemies: { ...state.world.enemies,
    actors: [{ ...hidden, brain: { ...hidden.brain, phase: 'hidden', phaseTicksRemaining: 100 } }],
    maggots: [{ ...source, combatActive: false, currentHealth: .001, movementPhase: 'crawl', position: { x: 400, y: 250 } }],
  } }, secondaryAbilities: { ...state.secondaryAbilities,
    actors: state.secondaryAbilities.actors.map(actor => actor.kind === 'ether-drain' ? { ...actor, quantity: 0 } : actor) } }
  state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const field = state.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!
  assert.ok(field.etherDrain!.queried.some(ref => ref.kind === 'enemy' && ref.id === source.id))
  assert.equal(field.etherDrain!.queried.some(ref => ref.kind === 'enemy' && ref.id === hidden.id), false)
  assert.equal(state.world.enemies.maggots[0]?.etherDrainCaptured, true)
  assert.equal(state.secondaryAbilities.events.some(event => event.cue === 'crunch-drain'), false)
  state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.deepEqual(state.world.enemies.maggots, [])
  assert.deepEqual(state.world.enemies.deathEffects, [])
})

test('Ether Drain current saves reject malformed target and private animation state', () => {
  const state = stepGameSimulationTick(etherDrainSimulation({ x: 400, y: 250 }), {})
  const saved = createGameSaveDocument({ integrity: 'local-only', loadedBoneyard: combatBoneyard('ether-drain-targets'),
    mods: [], modState: {}, playerId: 'local-player', state })
  for (const invalid of ['missing', 'wrong-lane', 'duplicate', 'future-loot', 'extra-key', 'art-bank', 'capture-pair', 'capture-offset', 'alive-corpse', 'animation-cursor', 'animation-duplicate'] as const) {
    const document = JSON.parse(saved)
    const simulation = document.continuation.simulation
    const field = simulation.secondaryAbilities.actors.find((actor: { kind: string }) => actor.kind === 'ether-drain')
    if (invalid === 'missing') delete field.etherDrain
    if (invalid === 'wrong-lane') field.etherDrain.queried = [{ kind: 'loot', id: 1, registrationOrdinal: 0 }]
    if (invalid === 'duplicate') field.etherDrain.queried = [{ kind: 'player', id: 'local-player' }, { kind: 'player', id: 'local-player' }]
    if (invalid === 'future-loot') field.etherDrain.loose = [{ kind: 'loot', id: 1, registrationOrdinal: 0 }]
    if (invalid === 'extra-key') field.etherDrain.fieldFlag = true
    if (invalid === 'art-bank' || invalid === 'capture-pair' || invalid === 'capture-offset') {
      field.etherDrain.animations = [{ kind: 'captured', alpha: 1, atlas: 'BadGuys', entry: invalid === 'art-bank' ? 80 : 1477,
        bodyYOffset: invalid === 'capture-offset' ? 0 : 23, tint: 0xffffff }]
      if (invalid === 'capture-pair') field.etherDrain.animations.push({ ...field.etherDrain.animations[0] })
    }
    if (invalid === 'alive-corpse') simulation.playerEntities.progressions[0].corpseConsumed = true
    if (invalid === 'animation-cursor' || invalid === 'animation-duplicate') {
      field.etherDrain.worldAnimationRefs = [{ kind: 'enemy-death-effect', id: 1 }]
      if (invalid === 'animation-duplicate') {
        field.etherDrain.lastWorldAnimationIds['enemy-death-effect'] = 1
        field.etherDrain.worldAnimationRefs.push({ kind: 'enemy-death-effect', id: 1 })
      }
    }
    assert.throws(() => restoreGameSaveDocument(JSON.stringify(document)), /etherDrain|corpseConsumed|loose target/, invalid)
  }
})

test('Ether Drain current saves reject capture markers on living or unsupported enemy bodies', () => {
  const state = withEtherDrainEnemy(etherDrainSimulation({ x: 400, y: 250 }), 'SKELETON')
  const saved = createGameSaveDocument({ integrity: 'local-only', loadedBoneyard: combatBoneyard('ether-drain-targets'),
    mods: [], modState: {}, playerId: 'local-player', state })
  for (const invalid of ['living', 'false', 'string', 'unsupported'] as const) {
    const document = JSON.parse(saved)
    const actor = document.continuation.simulation.world.enemies.actors[0]
    actor.etherDrainCaptured = invalid === 'false' ? false : invalid === 'string' ? 'true' : true
    if (invalid !== 'living') actor.lifeState = 'dying'
    if (invalid === 'unsupported') actor.config.enemyToken = 'COFFIN'
    assert.throws(() => restoreGameSaveDocument(JSON.stringify(document)), /capture|captured/i, invalid)
  }
})


for (const stacks of [1, 3]) {
  test(`Ether Drain field displacement preserves idle ${stacks}-stack Webbed while raw walking keeps its own lane`, () => {
    let state = withEtherDrainWebbed(etherDrainSimulation({ x: 400, y: 250 }), stacks)
    const initial = getPlayerCharacter(state)
    for (let tick = 0; tick < 40; tick++) state = stepGameSimulationTick(state, {})
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    const pulled = getPlayerCharacter(state)
    assert.ok(pulled.position.x > initial.position.x)
    assert.deepEqual(pulled.velocity, initial.velocity)
    assert.equal(pulled.gaitDegrees, initial.gaitDegrees)
    assert.equal(state.world.enemies.webbedPlayers['local-player']!.severity, stacks)
    if (stacks === 3) {
      assert.equal(state.world.enemies.webbedPlayers['local-player']!.cocoonHealth, 10)
      assert.equal(state.world.enemies.actors.filter(actor => actor.brain.family === 'cocoon').length, 1)
    }
    let walked = stepGameSimulationTick(state, { 'local-player': gameplayInput(1, 0) })
    if (walked.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    assert.ok(getPlayerCharacter(walked).velocity.x > 0)
    assert.ok(getPlayerCharacter(walked).gaitDegrees > pulled.gaitDegrees)
    if (stacks === 1) {
      // The native threshold reads squared raw velocity per tick, so initial
      // movement below0.5 need not remove a partial web on its first tick.
      for (let tick = 0; tick < 15; tick++) walked = stepGameSimulationTick(walked, { 'local-player': gameplayInput(1, 0) })
      if (walked.world.kind !== 'boneyard') throw new Error('expected Boneyard')
      assert.ok(walked.world.enemies.webbedPlayers['local-player']!.severity < stacks)
    } else assert.equal(walked.world.enemies.webbedPlayers['local-player']!.severity, 3)
  })
}

test('Ether Drain capture retires an applying Spider without clearing its healthy target-owned Cocoon', () => {
  let state = withEtherDrainEnemy(etherDrainSimulation({ x: 400, y: 250 }), 'SPIDER')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const spider = state.world.enemies.actors[0]!
  state = withEtherDrainWebbed(state, 3, spider.id)
  state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(state.world.enemies.actors.find(actor => actor.id === spider.id)?.etherDrainCaptured, true)
  for (let tick = 0; tick < 20; tick++) state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(state.world.enemies.actors.some(actor => actor.id === spider.id), false)
  assert.equal(state.world.enemies.webbedPlayers['local-player']!.severity, 3)
  assert.equal(state.world.enemies.webbedPlayers['local-player']!.cocoonHealth, 10)
  assert.equal(state.world.enemies.actors.filter(actor => actor.brain.family === 'cocoon').length, 1)
  assert.equal(state.world.enemies.spiderRemains.length, 0)
})

for (const health of [10, .1]) {
  test(`Ether Drain direct Cocoon damage commits the target-owned ${health}-HP web and release`, () => {
    let state = withEtherDrainWebbed(etherDrainSimulation({ x: 400, y: 250 }), 3)
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    const character = getPlayerCharacter(state)
    const center = nativeCocoonPosition(character.position, character.headingIndex * 15)
    const cocoon = state.world.enemies.actors.find(actor => actor.brain.family === 'cocoon')!
    state = { ...state, world: { ...state.world, enemies: { ...state.world.enemies,
      webbedPlayers: { 'local-player': { ...state.world.enemies.webbedPlayers['local-player']!, cocoonHealth: health } },
    } }, secondaryAbilities: { ...state.secondaryAbilities, actors: state.secondaryAbilities.actors.map(actor =>
      actor.kind === 'ether-drain' ? { ...actor, position: center, quantity: 0 } : actor) } }
    const hit = stepGameSimulationTick(state, {})
    if (hit.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    assert.equal(hit.world.enemies.actors.find(actor => actor.id === cocoon.id)?.etherDrainCaptured, undefined)
    if (health === 10) {
      assert.ok(hit.world.enemies.webbedPlayers['local-player']!.cocoonHealth < health)
      assert.ok(hit.world.enemies.webbedPlayers['local-player']!.cocoonHealth > 0)
      assert.ok(hit.world.enemies.webbedPlayers['local-player']!.hitPulse > 0)
    } else {
      assert.equal(hit.world.enemies.webbedPlayers['local-player'], undefined)
      assert.ok(hit.world.enemyEvents.some(event => event.actorId === cocoon.id && event.type === 'cocoon-released'))
      const retired = stepGameSimulationTick(hit, {})
      if (retired.world.kind !== 'boneyard') throw new Error('expected Boneyard')
      assert.equal(retired.world.enemies.actors.some(actor => actor.id === cocoon.id), false)
    }
  })
}

test('Ether Drain and Webbed retain field/Cocoon painter ownership through current48 and legacy47 continuation', () => {
  let state = withEtherDrainWebbed(etherDrainSimulation({ x: 400, y: 250 }), 3)
  for (let tick = 0; tick < 10; tick++) state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const field = state.secondaryAbilities.actors.find(actor => actor.kind === 'ether-drain')!
  const cocoon = state.world.enemies.actors.find(actor => actor.brain.family === 'cocoon')!
  const document = createGameSaveDocument({ integrity: 'local-only',
    loadedBoneyard: combatBoneyard('ether-drain-targets'), mods: [], modState: {}, playerId: 'local-player', state })
  for (const version of [47, 48]) {
    const saved = JSON.parse(document)
    if (version === 47) {
      saved.schemaVersion = 47
      const simulation = saved.continuation.simulation
      for (const progression of simulation.playerEntities.progressions) delete progression.corpseConsumed
      delete simulation.world.deathWeapons
      delete simulation.world.nextDeathWeaponId
      for (const actor of simulation.secondaryAbilities.actors) delete actor.etherDrain
    }
    const restored = restoreGameSaveDocument(JSON.stringify(saved)).state
    if (restored.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    assert.deepEqual(restored.world.enemies.webbedPlayers, state.world.enemies.webbedPlayers)
    assert.deepEqual(restored.world.enemies.actors.find(actor => actor.id === cocoon.id)!.lightRegistration, cocoon.lightRegistration)
    assert.deepEqual(restored.worldManagerOrder, state.worldManagerOrder)
    if (version === 48) assert.deepEqual(restored.secondaryAbilities.actors.find(actor => actor.id === field.id)!.etherDrain, field.etherDrain)
    const snapshot = gameSnapshot(createGameSnapshot(restored, 'local-player'))
    if (snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard snapshot')
    assert.deepEqual(snapshot.world.webbedPlayers, state.world.enemies.webbedPlayers)
    const next = stepGameSimulationTick(restored, {})
    if (next.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    assert.equal(next.world.enemies.webbedPlayers['local-player']!.severity, 3)
    assert.ok(next.secondaryAbilities.actors.find(actor => actor.id === field.id)!.etherDrain!.queried
      .some(ref => ref.kind === 'player' && ref.id === 'local-player'))
  }
  const invalid = JSON.parse(document)
  invalid.continuation.simulation.world.enemies.actors.find((actor: { id: number }) => actor.id === cocoon.id).etherDrainCaptured = true
  assert.throws(() => restoreGameSaveDocument(JSON.stringify(invalid)), /invalid Ether Drain capture/)
})

function withEtherDrainWebbed(state: GameSimulationState, stacks: number, sourceActorId = 0): GameSimulationState {
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  for (let index = 0; index < stacks; index++) {
    const contact = applyPlayerContacts(state, playerCharacterRecords(state.playerEntities), [{
      actorId: sourceActorId, playerId: 'local-player', eventId: index + 1, source: null,
      webbedStrength: 10, physicalDamage: 1, magicDamage: 0, coldSlowTicks: 0, dazzleTicks: 0,
      poisonDamage: 0, poisonDuration: 0,
    }], state.tick, undefined, order.register)
    state = { ...state, world: contact.world, playerEntities: contact.playerEntities,
      secondaryAbilities: contact.secondaryAbilities }
  }
  return { ...state, worldManagerOrder: order.state() }
}

function withEtherDrainEnemy(
  state: GameSimulationState,
  enemyToken: keyof typeof BONEYARD_WAVE_ENEMY_TYPES,
  flags: readonly string[] = [],
): GameSimulationState {
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const managers = createNativeWorldManagerOrder(state.worldManagerOrder)
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    players: {}, projectileWorldBlocked: () => false,
    registerWorldPainter: managers.register, resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{ enemyToken, flags: [...flags], id: 1, locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[enemyToken], position: { x: 400, y: 250 }, spawnTick: state.tick + 1, waveOrdinal: 1 }],
    tick: state.tick + 1,
  })
  return { ...state, tick: state.tick + 1, worldManagerOrder: managers.state(), world: { ...state.world,
    enemies: { ...seeded.store, actors: seeded.store.actors.map(actor => ({ ...actor, currentHealth: .001,
      config: { ...actor.config, experience: 0 } })) } } }
}

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
  assert.ok(Math.abs(progression.currentHealth - 15.001) < 1e-6)
  assert.equal(progression.poisonDamagePerTick, Math.fround(35 / 6 / 100))
  assert.equal(progression.poisonTicksRemaining, 1_000)
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
  assert.equal(state.world.playerOuchDeadlineTick, 0)
  const lastDamageTick = progression.lastDamageTick
  const healthAfterContact = progression.currentHealth
  state = stepGameSimulationTick(state, {})
  assert.ok(getPlayerProgression(state).currentHealth < healthAfterContact)
  assert.equal(getPlayerProgression(state).poisonTicksRemaining, 999)
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

test('poison cannot finish the player; a subsequent direct hit begins Game Over', () => {
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
  assert.equal(getPlayerProgression(state).lifeState, 'alive')
  assert.equal(getPlayerProgression(state).deathEpoch, 0)
  assert.equal(state.run.phase, 'active')

  state = { ...state, playerEntities: damagePlayerEntity(state.playerEntities, 'local-player', 1, state.tick) }
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
      headingDegrees: 103.25,
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
  assert.equal(getPlayerCharacter(state, 'first').headingDegrees, 103.25)
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
  assert.deepEqual(profile.storage.at(-1)?.contents?.map(item => item.name).sort(), [
    'Hat',
    'Health Potion',
    'Health Potion',
    'Mana Potion',
    'Robe',
    'Staff',
  ])

  const withoutLastWord = gameSimulationDurableProfileEconomy({
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, 'owner', {
      ...persistentEconomy,
      ownedPerkSelectors: [],
    }),
  }, 'owner')
  assert.equal(withoutLastWord.gold, economy.gold)
  assert.equal(withoutLastWord.storage[0], preexistingStorageItem)
  assert.deepEqual(withoutLastWord.storage.at(-1)?.contents?.map(item => item.name).sort(), [
    'Hat',
    'Health Potion',
    'Mana Potion',
    'Robe',
    'Staff',
  ])
})

test('Game Over keeps every live Mage pulse age valid through wire, late join, and terminal exit', () => {
  for (const contactKind of ['world', 'target-attached'] as const) {
    for (let age = 0; age < 5; age++) {
      let state = enterBoneyardWorld(createGameSimulation(), combatBoneyard('frozen-mage'))
      for (let tick = 0; tick < 10; tick++) state = stepGameSimulationTick(state, {})
      state = { ...state, playerEntities: damagePlayerEntity(
        state.playerEntities, 'local-player', 1000, state.tick,
      ) }
      state = stepGameSimulationTick(state, {})
      assert.equal(state.run.phase, 'game-over')
      if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
      const frozenTick = state.tick
      state = { ...state, world: { ...state.world, enemies: {
        ...state.world.enemies,
        nextMageLightningPulseId: 2,
        mageLightningPulses: [{
          id: 1, ownerActorId: 1, tick: frozenTick - age, seed: 42,
          enhancedEffects: false,
          source: { x: 200, y: 200 }, midpoint: { x: 250, y: 200 },
          endpoint: { x: 300, y: 200 },
          contact: contactKind === 'world'
            ? { kind: 'world', position: { x: 300, y: 200 } }
            : { kind: 'target-attached', localOffset: { x: 0, y: 0 }, targetPlayerId: 'local-player' },
          lightRegistration: { managerLane: 'actor', registrationOrdinal: 100 },
          painterRegistrations: Array.from({ length: contactKind === 'world' ? 3 : 2 }, (_, index) => ({
            managerLane: 'actor' as const, registrationOrdinal: 101 + index,
          })),
        }],
      } } }
      if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
      const frozenStore = state.world.enemies
      while (state.run.phase === 'game-over') {
        if ([0, 1, 5, 40, 300, GAME_OVER_AUTOMATIC_ACCEPT_TICK,
          GAME_OVER_AUTOMATIC_ACCEPT_TICK + GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS - 1,
        ].includes(state.run.gameOverTicks)) {
          const snapshot = createGameSnapshot(state, 'local-player')
          const message = { acknowledgedInputSequence: 0,
            frame: createGameSnapshotFrame(snapshot, 0, undefined, true),
            sequence: 1, type: 'server-snapshot' as const }
          assert.deepEqual(decodeServerGameMessage(encodeGameMessage(message)), message)
          assert.deepEqual(gameSnapshot(snapshot), snapshot)
          assert.ok(isBoneyardGameSnapshot(snapshot))
          for (const invalidBirth of [frozenTick - 5, frozenTick + 1]) {
            const invalid = { ...snapshot, world: { ...snapshot.world,
              mageLightningPulses: snapshot.world.mageLightningPulses.map(pulse => ({
                ...pulse, tick: invalidBirth,
              })),
            } }
            assert.throws(() => gameSnapshot(invalid), /live pulse age limit|exceeds its snapshot tick/)
            assert.throws(() => decodeServerGameMessage(encodeGameMessage({ ...message,
              frame: createGameSnapshotFrame(invalid, 0, undefined, true),
            })), /live pulse age limit|exceeds its snapshot tick/)
          }
          assert.throws(() => gameSnapshot({ ...snapshot, run: {
            ...snapshot.run, gameOverTicks: snapshot.tick + 1,
          } }), /gameOverTicks exceeds its snapshot tick/)
          const timeline = createBoneyardPresentationTimeline({ initialReceivedAtMs: 0,
            initialSnapshot: snapshot, serverTickRate: 100, snapshotRate: 20 })
          assert.deepEqual(timeline.sample(100).world.mageLightningPulses,
            snapshot.world.mageLightningPulses)
          assert.equal(state.world.kind === 'boneyard' && state.world.enemies, frozenStore)
        }
        state = stepGameSimulationTick(state, {})
      }
      assert.equal(state.run.phase, 'loadout')
      assert.equal(state.world.kind, 'hub')
    }
  }
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
    // Gameplay stays frozen; independently owned dropped Bouncers follow the
    // continuing death clock, just like the native maintenance lane.
    for (const [key, value] of Object.entries(frozenWorld)) {
      if (key !== 'deathWeapons') assert.equal(Reflect.get(state.world, key), value, key)
    }
    if (state.world.kind !== 'boneyard' || frozenWorld.kind !== 'boneyard') throw new Error('expected Boneyard')
    const frozenWeapons = frozenWorld.deathWeapons
    assert.ok(frozenWeapons.length > 0, 'the independent death-clock comparison needs actual drops')
    assert.equal(state.world.deathWeapons.length, frozenWeapons.length)
    assert.ok(state.world.deathWeapons.every((weapon, index) => weapon.ageTicks > frozenWeapons[index]!.ageTicks))
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
    assert.deepEqual(economy.storage.at(-1)?.contents?.map(({ name }) => name).sort(), [
      'Hat',
      'Health Potion',
      'Mana Potion',
      'Robe',
      'Staff',
    ])
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
  assert.equal(getPlayerCharacter(firstReady, 'first').config.displayName, 'First Reborn')
  assert.equal(getPlayerCharacter(firstReady, 'second').config.displayName,
    getPlayerCharacter(loadout, 'second').config.displayName)
  assert.equal(confirmGameSimulationLoadout(firstReady, 'first', {
    discipline: 'arcane', displayName: 'TooLate', element: 'fire',
  }), null, 'a confirmed peer cannot revise its submitted name while waiting')
  const hub = confirmGameSimulationLoadout(firstReady, 'second', {
    discipline: 'mind',
    displayName: 'Second Reborn',
    element: 'water',
  })
  assert.ok(hub)
  assert.equal(hub.run.phase, 'hub')
  assert.equal(getPlayerCharacter(hub, 'first').config.displayName, 'First Reborn')
  assert.equal(getPlayerCharacter(hub, 'second').config.displayName, 'Second Reborn')
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
    const appearance = rollNativeStarterEquipmentAppearance(
      createNativeRng(getPlayerProgression(hub, playerId).offerSeed),
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
      viewportHeight: 900,
      viewportWidth: 1_600,
    },
  })
  assert.equal(getPlayerSkillBook(state).primarySkillId, 16)
  assert.deepEqual(getPlayerBelt(state)[7], { kind: 'skill', skillId: 16 })
  assert.equal(getPlayerCharacter(state).primaryCast.selectedPrimaryId, 16)
})

test('Inventory belt selects primary and concentration bindings without advancing College', () => {
  let state = withPlayerSkillRank(createGameSimulation(), 'local-player', 16, 1)
  state = withPlayerSkillRank(state, 'local-player', 57, 1)
  const primary = bindGameSimulationPlayerSkillQuickbar(state, 'local-player', 16, 6)
  assert.ok(primary)
  const concentration = bindGameSimulationPlayerSkillQuickbar(primary, 'local-player', 57, 7)
  assert.ok(concentration)

  const selectedPrimary = applyGameSimulationHubAction(concentration, 'local-player', {
    slot: 6, type: 'activate-belt-slot',
  })
  assert.equal(selectedPrimary.accepted, true)
  assert.equal(selectedPrimary.state.tick, concentration.tick)
  assert.equal(getPlayerSkillBook(selectedPrimary.state).primarySkillId, 16)
  assert.equal(getPlayerCharacter(selectedPrimary.state).primaryCast.selectedPrimaryId, 16)

  const selectedConcentration = applyGameSimulationHubAction(selectedPrimary.state, 'local-player', {
    slot: 7, type: 'activate-belt-slot',
  })
  assert.equal(selectedConcentration.accepted, true)
  assert.equal(selectedConcentration.state.tick, concentration.tick)
  assert.deepEqual(selectedConcentrations(selectedConcentration.state), [57, null, 'a'])
})

test('a primary quickbar edge keeps the selection reset through the authoritative snapshot', () => {
  let state = createGameSimulation()
  const granted = grantPlayerEntityWeldBuild(
    state.playerEntities,
    'local-player',
    1002,
    createNativeRng(17),
  )
  state = withPlayerSkillRank(
    { ...state, playerEntities: granted.store },
    'local-player',
    16,
    1,
  )
  const welded = getPlayerCharacter(state)
  state = {
    ...state,
    playerEntities: replacePlayerCharacter(state.playerEntities, 'local-player', {
      ...welded,
      primaryCast: {
        ...welded.primaryCast,
        actionTick: 12,
        castSequence: 1,
        emissionSequence: 1,
        held: true,
        lastWeldPlaybackRate: 1.25,
        lastWeldSoundVariant: 1,
        oneShotAttackPoseHeld: true,
        selectedPrimaryAgeTicks: 19,
        selectedPrimaryId: 1002,
        underpowered: true,
      },
    }),
  }
  const bound = bindGameSimulationPlayerSkillQuickbar(state, 'local-player', 16, 7)
  assert.ok(bound)
  const before = getPlayerCharacter(bound)

  state = stepGameSimulationTick(bound, {
    'local-player': {
      aim: null,
      cast: { primary: false, quickbar: 7 },
      movement: { x: 1, y: 0 },
      viewportHeight: 900,
      viewportWidth: 1_600,
    },
  })

  const selected = getPlayerCharacter(state)
  assert.equal(getPlayerSkillBook(state).primarySkillId, 16)
  assert.ok(selected.position.x > before.position.x)
  assert.deepEqual({
    actionTick: selected.primaryCast.actionTick,
    channelActive: selected.primaryCast.channelActive,
    held: selected.primaryCast.held,
    lastWeldPlaybackRate: selected.primaryCast.lastWeldPlaybackRate,
    lastWeldSoundVariant: selected.primaryCast.lastWeldSoundVariant,
    oneShotAttackPoseHeld: selected.primaryCast.oneShotAttackPoseHeld,
    selectedPrimaryAgeTicks: selected.primaryCast.selectedPrimaryAgeTicks,
    selectedPrimaryId: selected.primaryCast.selectedPrimaryId,
    targetId: selected.primaryCast.targetId,
    underpowered: selected.primaryCast.underpowered,
  }, {
    actionTick: -1,
    channelActive: false,
    held: false,
    lastWeldPlaybackRate: null,
    lastWeldSoundVariant: null,
    oneShotAttackPoseHeld: false,
    selectedPrimaryAgeTicks: 1,
    selectedPrimaryId: 16,
    targetId: null,
    underpowered: false,
  })
  const message = {
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(createGameSnapshot(state, 'local-player'), 0, undefined, true),
    sequence: 1,
    type: 'server-snapshot' as const,
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(message)), message)
  const invalid = JSON.parse(encodeGameMessage(message))
  invalid.frame.players['local-player'].primaryCast.lastWeldPlaybackRate = 1.25
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(invalid)),
    /lastWeldPlaybackRate does not match the active build/,
  )
})

test('Teleport reaches the active-run kernel through a real belt slot and remains gated in College', () => {
  const input = {
    aim: { x: 400, y: 250 },
    cast: { primary: false, quickbar: 7 },
    movement: { x: 0, y: 0 },
    viewportHeight: 900,
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
    viewportHeight: 900,
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
    projectileWorldBlocked: () => false,
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

function withWraithAtPlayer(state: GameSimulationState): GameSimulationState {
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const player = getPlayerCharacter(state)
  const seeded = stepBoneyardEnemyStore(state.world.enemies, {
    projectileWorldBlocked: () => false,
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
      enemyToken: 'WRAITH',
      flags: [],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.WRAITH,
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
    projectileWorldBlocked: () => false,
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
    sourceSha256: '2118053783606f5ef9dc848671d6eecd8e87aa0a3610c8c2119f08452e15a22f',
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


for (const element of ['ether', 'fire', 'air', 'water', 'earth'] as const) {
  for (const discipline of ['arcane', 'body', 'mind'] as const) {
    test(`all native loadouts commit an independent next-wizard name: ${element}/${discipline}`, () => {
      const source = createGameSimulation({ owner: {
        discipline: 'arcane', displayName: 'PreviousMage', element: 'fire',
      } })
      const loadout = {
        ...source,
        run: { ...source.run, eligiblePlayerIds: ['owner'], phase: 'loadout' as const },
      }
      const confirmed = confirmGameSimulationLoadout(loadout, 'owner', {
        discipline, displayName: 'NextMage', element,
      })
      assert.ok(confirmed)
      assert.deepEqual(getPlayerCharacter(confirmed, 'owner').config, {
        discipline, displayName: 'NextMage', element,
      })
      assert.equal(getPlayerCharacter(loadout, 'owner').config.displayName, 'PreviousMage')
      const snapshot = createGameSnapshot(confirmed, 'owner')
      assert.equal(gameSnapshot(snapshot).players.owner!.config.displayName, 'NextMage')
      assert.equal(confirmGameSimulationLoadout(confirmed, 'owner', {
        discipline, displayName: 'TooLate', element,
      }), null, 'a completed Create is not an in-game rename action')
    })
  }
}

for (const [skillId, price] of [
  [72, 3000], [73, 3500], [74, 4200], [75, 5000],
  [79, 5100], [78, 5300], [77, 6100], [76, 10000],
] as const) {
  test(`Teacher purchase ${skillId} survives post-run Create without another debit or learned rank`, () => {
    let state = createGameSimulation({
      owner: DEFAULT_PLAYER_CHARACTER_CONFIG,
      peer: { discipline: 'mind', displayName: 'Peer', element: 'water' },
    })
    state = {
      ...state,
      playerEntities: replacePlayerEconomy(state.playerEntities, 'owner', {
        ...getPlayerEconomy(state, 'owner'),
        gold: 50_000,
      }),
    }
    const purchase = applyGameSimulationHubAction(state, 'owner', {
      skillId,
      type: 'buy-teacher-spell',
    })
    assert.equal(purchase.accepted, true)
    const expectedUnlocks = Array.from({ length: 8 }, (_, index) => index === skillId - 72)
    assert.deepEqual(getPlayerSkillBook(purchase.state, 'owner').advancedUnlocks, expectedUnlocks)
    const loadout: GameSimulationState = {
      ...purchase.state,
      run: { ...purchase.state.run, eligiblePlayerIds: ['owner', 'peer'], phase: 'loadout' },
    }
    const ready = confirmGameSimulationLoadout(loadout, 'owner', {
      discipline: 'body', displayName: 'Next Wizard', element: 'earth',
    })
    assert.ok(ready)
    assert.equal(ready.run.phase, 'loadout', 'a peer still owns its unconfirmed Create')
    assert.deepEqual(getPlayerSkillBook(ready, 'owner').advancedUnlocks, expectedUnlocks)
    assert.deepEqual(getPlayerSkillBook(ready, 'peer').advancedUnlocks, Array<boolean>(8).fill(false))
    assert.equal(getPlayerEconomy(ready, 'owner').gold, 50_000 - price)
    assert.equal(getPlayerSkillBook(ready, 'owner').permanentRanks[skillId], 0)
    assert.equal(getPlayerProgression(ready, 'owner').level, 1)
    assert.equal(getPlayerProgression(ready, 'owner').experience, 0)
    assert.equal(getPlayerBelt(ready, 'owner').some(slot => slot?.kind === 'skill' && slot.skillId === skillId), false)
    const complete = confirmGameSimulationLoadout(ready, 'peer', {
      discipline: 'arcane', displayName: 'Next Peer', element: 'fire',
    })
    assert.ok(complete)
    assert.equal(complete.run.phase, 'hub')
    assert.deepEqual(getPlayerSkillBook(complete, 'owner').advancedUnlocks, expectedUnlocks)
    assert.deepEqual(getPlayerSkillBook(complete, 'peer').advancedUnlocks, Array<boolean>(8).fill(false))
    const rejected = applyGameSimulationHubAction(complete, 'owner', {
      skillId,
      type: 'buy-teacher-spell',
    })
    assert.equal(rejected.reason, 'invalid-offer')
    assert.equal(getPlayerEconomy(rejected.state, 'owner').gold, 50_000 - price)
    assert.deepEqual(getPlayerSkillBook(loadout, 'owner').advancedUnlocks, expectedUnlocks,
      'confirmation must not mutate its previous generation')
  })
}

import './inventory-skill-book.test.ts'


for (const element of ['ether', 'fire', 'air', 'water', 'earth'] as const) {
  for (const discipline of ['arcane', 'body', 'mind'] as const) {
    for (const revelation of [false, true]) {
      test(`retained Hagatha skill effects initialize each new wizard: ${element}/${discipline}, Revelation=${revelation}`, () => {
        const config = { discipline, displayName: 'Charm Owner', element }
        let state = createGameSimulation({ owner: config, peer: { ...config, displayName: 'Peer' } })
        state = {
          ...state,
          playerEntities: replacePlayerCharacter(
            replacePlayerEconomy(state.playerEntities, 'owner', {
              ...getPlayerEconomy(state, 'owner'), gold: 50_000,
            }),
            'owner', { ...getPlayerCharacter(state, 'owner'), position: { x: 1340, y: 280 } },
          ),
        }
        for (const selector of revelation ? [6, 14] : [14]) {
          const purchase = applyGameSimulationHubAction(state, 'owner', { type: 'buy-hagatha', selector })
          assert.equal(purchase.accepted, true)
          state = purchase.state
        }
        const selectors = getPlayerEconomy(state, 'owner').ownedPerkSelectors
        const gold = getPlayerEconomy(state, 'owner').gold
        const peerBook = getPlayerSkillBook(state, 'peer')
        const assertGrant = (candidate: GameSimulationState) => {
          const book = getPlayerSkillBook(candidate, 'owner')
          const secondaries = NATIVE_SECONDARY_ABILITY_IDS.filter(id => book.permanentRanks[id]! > 0)
          assert.equal(secondaries.length, 2, 'retained Weird Caster grants a second secondary')
          for (const id of secondaries) {
            assert.equal(book.permanentRanks[id], Math.min(candidate.playerEntities.statBooks[0]!.entries[id]!.maximumLevel, revelation ? 2 : 1))
            assert.ok(getPlayerBelt(candidate, 'owner').some(slot => slot?.kind === 'skill' && slot.skillId === id))
          }
          assert.equal(book.permanentRanks[book.primarySkillId], revelation ? 2 : 1)
          assert.deepEqual(getPlayerEconomy(candidate, 'owner').ownedPerkSelectors, selectors)
          assert.equal(getPlayerEconomy(candidate, 'owner').gold, gold)
        }
        assertGrant(state)
        for (let generation = 0; generation < 2; generation += 1) {
          const loadout: GameSimulationState = {
            ...state, run: { ...state.run, eligiblePlayerIds: ['owner', 'peer'], loadoutReadyPlayerIds: [], phase: 'loadout' },
          }
          const ready = confirmGameSimulationLoadout(loadout, 'owner', { ...config, displayName: `Wizard ${generation}` })
          assert.ok(ready)
          assertGrant(ready)
          assert.strictEqual(getPlayerSkillBook(ready, 'peer'), peerBook)
          state = ready
        }
        const continuation = restoreGameSaveDocument(createGameSaveDocument({
          integrity: 'local-only', mods: [], modState: {}, loadedBoneyard: null, playerId: 'owner', state,
        }))
        assert.deepEqual(getPlayerSkillBook(continuation.state, 'owner'), getPlayerSkillBook(state, 'owner'))
        const profile = restoreGameSaveProfile(createGameProfileSaveDocument({
          integrity: 'local-only', mods: [], modState: {}, playerId: 'owner', state,
        }))
        const hydrated = hydrateGameSaveProfile(createGameSimulation({ owner: config }), 'owner', profile)
        assertGrant(hydrated)
        assert.deepEqual(getPlayerProgression(hydrated, 'owner').hagathaRuntime, profile.hagathaRuntime)
      })
    }
  }
}

test('every retained charm initializes its new wizard without replaying economic purchases', () => {
  const cases = [[], ...HAGATHA_PERKS.filter(row => row.selector !== 8).map(row => [row.selector]),
    [7, 24, 25], [27, 27, 7, 24, 25, 6, 14],
  ]
  for (const selectors of cases) {
    let state = createGameSimulation({ owner: DEFAULT_PLAYER_CHARACTER_CONFIG })
    state = { ...state, playerEntities: replacePlayerCharacter(
      replacePlayerEconomy(state.playerEntities, 'owner', { ...getPlayerEconomy(state, 'owner'), gold: 50_000 }),
      'owner', { ...getPlayerCharacter(state, 'owner'), position: { x: 1340, y: 280 } },
    ) }
    for (const selector of selectors) {
      const purchase = applyGameSimulationHubAction(state, 'owner', { type: 'buy-hagatha', selector })
      assert.equal(purchase.accepted, true, `purchase ${selectors}`)
      state = purchase.state
    }
    state = damageGameSimulationPlayer(state, 'owner', 1, state.tick)
    if (selectors.includes(7)) state = damageGameSimulationPlayer(state, 'owner', 10_000, state.tick)
    const spent = { cheatDeathCharges: 0, reverieActive: false, serendipityActive: false }
    assert.deepEqual(getPlayerProgression(state, 'owner').hagathaRuntime, spent)
    const restored = restoreGameSaveDocument(createGameSaveDocument({
      integrity: 'local-only', mods: [], modState: {}, loadedBoneyard: null, playerId: 'owner', state,
    })).state
    assert.deepEqual(getPlayerProgression(restored, 'owner').hagathaRuntime, spent, `same-run resume ${selectors}`)
    const profile = restoreGameSaveProfile(createGameProfileSaveDocument({
      integrity: 'local-only', mods: [], modState: {}, playerId: 'owner', state,
    }))
    const hydrated = hydrateGameSaveProfile(createGameSimulation({ owner: DEFAULT_PLAYER_CHARACTER_CONFIG }), 'owner', profile)
    assert.deepEqual(getPlayerProgression(hydrated, 'owner').hagathaRuntime, spent, `profile resume ${selectors}`)
    const economy = getPlayerEconomy(state, 'owner')
    for (let generation = 0; generation < 2; generation += 1) {
      const loadout: GameSimulationState = { ...state,
        run: { ...state.run, eligiblePlayerIds: ['owner'], loadoutReadyPlayerIds: [], phase: 'loadout' },
      }
      const fresh = confirmGameSimulationLoadout(loadout, 'owner', {
        discipline: 'body', displayName: `Fresh Charm Wizard ${generation}`, element: 'air',
      })!
      assert.deepEqual(getPlayerProgression(fresh, 'owner').hagathaRuntime, {
        cheatDeathCharges: selectors.includes(7) ? 1 : 0,
        reverieActive: selectors.includes(25),
        serendipityActive: selectors.includes(24),
      }, `fresh generation ${selectors}`)
      const freshEconomy = getPlayerEconomy(fresh, 'owner')
      for (const key of ['ownedPerkSelectors', 'firstMixedSelectors', 'gold', 'tonicPurchases', 'charmCapacity'] as const) {
        assert.deepEqual(freshEconomy[key], economy[key], `${selectors} ${key}`)
      }
      const book = getPlayerSkillBook(fresh, 'owner')
      assert.equal(NATIVE_SECONDARY_ABILITY_IDS.filter(id => book.permanentRanks[id]! > 0).length,
        selectors.includes(14) ? 2 : 1)
      assert.equal(book.permanentRanks[book.primarySkillId], selectors.includes(6) ? 2 : 1)
      state = damageGameSimulationPlayer(fresh, 'owner', 1, fresh.tick)
      if (selectors.includes(7)) state = damageGameSimulationPlayer(state, 'owner', 10_000, fresh.tick)
      assert.deepEqual(getPlayerProgression(state, 'owner').hagathaRuntime, spent)
    }
  }
})

test('the shared damage boundary births gameplay and participant feedback once per accepted rescue', () => {
  let state = enterBoneyardWorld(createGameSimulation({ owner: DEFAULT_PLAYER_CHARACTER_CONFIG }), emptyBoneyard())
  state = { ...state, playerEntities: { ...state.playerEntities,
    progressions: state.playerEntities.progressions.map(progression => ({ ...progression,
      hagathaRuntime: { ...progression.hagathaRuntime, cheatDeathCharges: 1 } })) } }
  const result = damageGameSimulationPlayer(state, 'owner', 60, 1)
  assert.equal(getPlayerProgression(result, 'owner').currentHealth, 25)
  assert.equal(getPlayerProgression(result, 'owner').rescueProtection.fraction, 1)
  assert.equal(result.secondaryAbilities.actors.filter(actor => actor.kind === 'rescue-shockwave').length, 1)
  if (result.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.deepEqual(result.world.enemyEvents.filter(event => event.type === 'player-cheat-death')
    .map(event => event.targetPlayerId), ['owner'])
  const repeat = damageGameSimulationPlayer(result, 'owner', 60, 1)
  assert.equal(repeat, result)
  assert.equal(result.playerEntities.progressions[0]!.hagathaRuntime.cheatDeathCharges, 0)
  const observed = observeMlBotPolicyOwnEffects(result, {
    playerId: 'owner', position: getPlayerCharacter(result, 'owner').position,
    quickbar: [45], worldKey: `boneyard:${result.world.runId}`,
  })
  assert.equal(observed.blockR[0], 1)
  assert.equal(observed.blockR[11], 1)
  assert.equal(observed.secondaryEffectActive.some(Boolean), false)
})

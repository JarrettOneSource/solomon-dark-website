import {
  PLAYER_CHARACTER_FOOTSTEP_TICK_INTERVAL,
  PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
  PLAYER_CHARACTER_RADIUS,
  NATIVE_GAMEPLAY_VIEWPORT_WIDTH,
  createIdlePlayerCharacterInput,
  createPlayerCharacter,
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { actorHeadingFromVector, actorHeadingIndex } from '../core-kernels/actor-heading.ts'
import { boneyardActiveBounds } from '../core-kernels/boneyard-arena-transition.ts'
import { isBoneyardPlayerCombatEnabled } from '../core-kernels/boneyard-encounter.ts'
import type { BoneyardEnemySpawnIntent } from '../core-kernels/boneyard-wave-director.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import { lineBoundsExitObstruction } from '../core-kernels/line-obstruction.ts'
import { HUB_CAMERA_SCALE } from '../core-kernels/hub-math.ts'
import {
  HUB_REGION_DEFINITIONS,
  firstHubRegionLineObstruction,
  isHubRegionPathTraversable,
  isHubRegionTraversable,
} from '../core-kernels/hub-regions.ts'
import {
  confirmPostRunLoadout,
  continueGameOver,
  createGameRunLifecycle,
  startGameRun,
  stepGameRunLifecycle,
  synchronizeGameRunParticipants,
  type GameRunLifecycleState,
} from '../core-kernels/game-run.ts'
import {
  archiveNativeHallOfFameRun,
  createNativeHallOfFameRun,
  NATIVE_HALL_OF_FAME_SCORE,
  recordNativeHallOfFameAwesomestKill,
  recordNativeHallOfFameOrdinaryKill,
  resetNativeHallOfFameKillStreak,
} from '../core-kernels/hall-of-fame-score.ts'
import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'
import {
  failNativeBoast,
  nativeBoastScore,
  NATIVE_BOAST_SUCCESS_WAVE,
  succeedNativeBoast,
  type NativeBoastFailureProducer,
} from '../core-kernels/native-hub-npc.ts'
import { nativeLootModifiers, type NativeLootItem } from '../core-kernels/native-loot.ts'
import {
  NATIVE_HAGATHA_LAST_WORD_DAMAGE,
  NATIVE_HAGATHA_LAST_WORD_PRESENTATION_SCALE,
  NATIVE_HAGATHA_LAST_WORD_SACK_SUFFIXES,
  nativeHagathaBossDamageFactor,
} from '../core-kernels/native-hagatha-effects.ts'
import {
  archiveHagathaLastWordItems,
  archiveCompletedRunEconomy,
  buyDowsingOffer,
  buyFomentiusItem,
  buyHagathaPerk,
  buyTeacherSpell,
  closeDowsingOffers,
  consumeInventoryItem,
  dyeInventoryClothing,
  dowse,
  equipInventoryItem,
  findInventoryItem,
  hagathaOffers,
  moveInventoryItem,
  readLibrarianBook,
  readInventorySkillBook,
  selectHubBoast,
  transferInventoryItem,
  unforgeInventoryItem,
  unequipInventorySlot,
  type HubEconomyRejection,
  type HubEconomyState,
  type HubInventoryItem,
  type HubInventoryAction,
  type ModConsumableContent,
  type HubTraderId,
} from '../core-kernels/hub-economy.ts'
import { nearestBoneyardGoodie } from '../core-kernels/boneyard-goodie-interaction.ts'
import {
  nativeEquipmentHasFeature,
  nativeEquipmentRecipeEffects,
} from '../core-kernels/native-equipment-effects.ts'
import {
  resolveNativeSkillDamageValue,
} from '../core-kernels/native-offensive-resolution.ts'
import { nativeHurricaneChargeTick } from '../core-kernels/native-hurricane.ts'
import {
  NATIVE_FLASH_RESPONSE_RADIUS,
  playerDeflectReflectionSourceInRange,
  playerPoisonDurationSeconds,
  resolvePlayerHarmfulContact,
} from '../core-kernels/player-skill-runtime.ts'
import {
  applyNativeUnforgeFullRejuvenation,
  boneyardEnemyExperienceAward,
  grantNativeUnforgeMindDredge,
  NATIVE_SKILL_CATALOG,
  nativeSkillCategory,
  type PlayerLevelUpBarrierState,
  type PlayerProgressionComponent,
  type PlayerSkillBookComponent,
  type PlayerStatBookComponent,
} from '../core-kernels/player-progression.ts'
import { nativePrimarySkillProfile } from '../core-kernels/native-primary-skill-profile.ts'
import { playerCollisionEnabledAfterCombatTick } from '../core-kernels/player-combat.ts'
import { NATIVE_PLAYER_STAFF_CAST_TWO_OVERLAY } from '../core-kernels/player-lighting.ts'
import {
  applyNativeSecondaryGolemDamage,
  applyNativeSecondaryDazzle,
  applyNativeSecondaryEtherBurn,
  applyNativeSecondaryFireBurn,
  applyNativeSecondaryPlayerDamage,
  applyNativeSecondaryTargetEffect,
  applyNativeUnforgeCooldownRejuvenation,
  createNativeSecondaryPlayerState,
  createNativeSecondarySimulation,
  emitNativePlayerScreenFlash,
  materializeNativePlayerFlashResponse,
  nativeSecondaryAvailableMana,
  nativeSecondaryTargetEffect,
  removeNativeSecondaryOwner,
  resetNativeSecondaryWorld,
  spawnNativeScriptFires,
  stepNativeMindblastPresentation,
  stepNativeSecondaryAbilities,
  triggerNativePlayerMindblast,
  type NativeSecondarySimulationState,
  type NativeSecondaryTargetEffectState,
} from '../core-kernels/native-secondary-abilities.ts'
import {
  NATIVE_GOLEM_PLACEMENT_RADIUS,
  NATIVE_GOLEM_RADIUS,
  NATIVE_GOLEM_REFLECT_DISTANCE_SQUARED,
} from '../core-kernels/native-secondary-golem.ts'
import {
  createDeferredNativeLightProviderRegistrations,
  createNativeLightProviderOrder,
  type DeferredNativeLightProviderRegistrations,
  type NativeLightProviderOrder,
  type NativeLightProviderOrderState,
} from '../core-kernels/native-light-provider-order.ts'
import {
  createPrimarySpellSimulation,
  removePrimarySpellOwner,
  stepPrimarySpells,
  type PrimarySpellSimulationState,
} from '../core-kernels/primary-spells.ts'
import {
  boneyardPrimarySpellTargets,
  applyBoneyardSecondaryEnemyKnockbacks,
  createBoneyardWorld,
  placePlayersInBoneyard,
  spawnPlayerCharacterInBoneyard,
  stepBoneyardWorldTick,
  type BoneyardWorldState,
} from './boneyard-world.ts'
import {
  canPlaceBoneyardBody,
  firstBoneyardLineObstruction,
  firstBoneyardPathBlockProgress,
  resolveBoneyardMovement,
  withBoneyardGateCollision,
} from './boneyard-collision.ts'
import { resolveBoneyardSpellCombat } from './boneyard-spell-combat.ts'
import { synchronizeAirWaterPlayerVisualActors } from './air-water-player-visual-system.ts'
import {
  boneyardNativeSecondaryDampenCandidates,
  boneyardNativeSecondaryTarget,
  boneyardNativeSecondaryTargets,
  resolveNativeCollisionAdjustedPosition,
  resolveBoneyardNativeTeleport,
  resolveBoneyardNativeSecondaryCombat,
} from './native-secondary-world.ts'
import {
  damageBoneyardEnemy,
  applyBoneyardStaffHeadingPerturbation,
  emitBoneyardPlayerDamageSound,
  nativeWizardOuchCooldownReady,
  type BoneyardEnemyAttributionObserver,
  type BoneyardEnemyLethalObserver,
  type BoneyardEnemyReward,
  type BoneyardEnemySemanticEvent,
} from './boneyard-enemy-store.ts'
import { stepPlayerStaffCombatSystem } from './player-staff-combat-system.ts'
import { sealPlayerCombatInput } from './player-combat-input.ts'
import {
  addHubParticipant,
  createHubWorld,
  hubSpawnPoint,
  removeHubParticipant,
  stepHubWorldTick,
  type HubWorldState,
} from './hub-world.ts'
import type { HubStudentPopulationState } from './hub-students.ts'
import {
  addPlayerEntity,
  applyPlayerEntityHagathaPurchaseEffects,
  applyPlayerEntityPotionEffect,
  applyPlayerEntitySkillChoice,
  bindPlayerEntitySkillQuickbar,
  coldSlowPlayerEntity,
  consumePlayerEntityWizardKey,
  createPlayerEntityStore,
  creditPlayerEntityLootGold,
  damagePlayerEntityWithResult,
  dazzlePlayerEntity,
  grantPlayerEntityExperience,
  grantPlayerEntityBonusSkillChoice,
  grantSharedPlayerEntityExperience,
  playerCharacterAt,
  playerEconomyAt,
  playerCharacterRecords,
  playerEntityCanAcceptInput,
  playerEntityCanCast,
  playerEntityIndex,
  playerEntityMovementScale,
  markPlayerEntityCreativityInsight,
  poisonPlayerEntity,
  playerProgressionAt,
  playerSkillBookAt,
  playerSkillDerivedStatsAt,
  playerSkillRuntimeAt,
  playerStatBookAt,
  increaseRandomPlayerEntitySkill,
  forcePlayerEntitySkillOfferIds,
  importPlayerEntity,
  insertPlayerEntityLootItem,
  removePlayerEntity,
  rerollPlayerEntitySkillOffer,
  resetPlayerEntitiesForNewRun,
  selectPlayerEntityPrimarySkill,
  deferPlayerEntitySkillChoice,
  restorePlayerEntityHealth,
  restorePlayerEntityMana,
  setPlayerEntityMana,
  setPlayerEntityMindstar,
  selectPlayerEntityConcentrationSkill,
  selectPlayerEntityConcentrationSlot,
  setPlayerEntitySpectating,
  stepPlayerEntityCombatTick,
  stepPlayerEntityOverlayLightingTick,
  tryDebitPlayerEntityMana,
  replacePlayerCharacter,
  replacePlayerLoadout,
  replacePlayerCharacterRecords,
  replacePlayerEconomy,
  respawnPlayerEntityAt,
  preparePlayerEntityTutorialLoadout,
  setPlayerEntityAutomaticSkillChoice,
  unlockPlayerEntityAdvancedSkill,
  type PlayerEntityStore,
} from './player-entity-store.ts'
import {
  applyNativeTutorialSurfaceAction,
  NATIVE_TUTORIAL_FIRES,
  nativeTutorialForcedVelocity,
  nativeTutorialHudAccess,
  stepNativeTutorial,
  type NativeTutorialSurfaceAction,
} from '../core-kernels/native-tutorial.ts'
import {
  activateBoneyardGoodie,
  boneyardGoodieKeyNeeded,
  NATIVE_LOOT_EVENT_RETENTION_TICKS,
  nativeHagathaLastWordLoot,
  removeBoneyardLootActors,
  type BoneyardLootEvent,
  type BoneyardLootPickup,
} from './boneyard-loot-store.ts'

export type PlayerId = string

export type GameWorldState = HubWorldState | BoneyardWorldState

export interface GameSimulationState {
  accumulatorSeconds: number
  combatRng: NativeRngState
  hallOfFameClockStartedAtTick: number
  levelUpBarrier: PlayerLevelUpBarrierState | null
  lightProviderOrder: NativeLightProviderOrderState
  modEffects: readonly GameSimulationModEffect[]
  nextLevelUpBarrierId: number
  nextModConsumableUseId: number
  playerEntities: PlayerEntityStore
  gameRng: NativeRngState
  primarySpells: PrimarySpellSimulationState
  secondaryAbilities: NativeSecondarySimulationState
  run: GameRunLifecycleState
  tick: number
  world: GameWorldState
}

export interface GameSimulationOptions {
  combatRngSeed?: number
  hubStudentPopulation?: HubStudentPopulationState
  hubTraderAnimationSeed?: number
  initialPlayerExperience?: number
  gameRngSeed?: number
}

export interface GameSimulationInventoryActionResult {
  readonly accepted: boolean
  readonly modConsumption: GameSimulationModConsumption | null
  readonly reason: HubEconomyRejection | 'service-unavailable' | null
  readonly state: GameSimulationState
}

export type PlayerCharacterInputs = Readonly<Record<PlayerId, PlayerCharacterInput>>

export interface GameSimulationTickOptions {
  readonly attributionObserver?: BoneyardEnemyAttributionObserver
  readonly enemySpawnIntents?: readonly BoneyardEnemySpawnIntent[]
  readonly extensions?: GameSimulationExtensions
}

export interface GameSimulationModEffect {
  readonly color: readonly [number, number, number, number]
  readonly contentId: string
  readonly expiresTick: number
  readonly playerId: string
  readonly startedTick: number
  readonly useId: number
}

export interface GameSimulationModConsumption {
  readonly content: ModConsumableContent
  readonly playerId: string
  readonly tick: number
  readonly useId: number
}

export interface GameSimulationDamageFilterInput {
  readonly amount: number
  readonly damageKind: 'magic' | 'physical' | 'poison'
  readonly sourceActorId: number | null
  readonly targetPlayerId: string
  readonly tick: number
}

export interface GameSimulationManaFilterInput {
  readonly currentMana: number
  readonly delta: number
  readonly maximumMana: number
  readonly playerId: string
  readonly source: 'overload' | 'passive-recovery' | 'primary-cast' | 'secondary-cast' | 'stock-orb' | 'stock-potion'
  readonly tick: number
}

export interface GameSimulationExtensions {
  createLootItems(input: Readonly<{
    actorSeed: number
    enemyToken: import('../core-kernels/boneyard-wave-schema.ts').BoneyardWaveEnemyToken
  }>): readonly HubInventoryItem[]
  filterDamage(input: GameSimulationDamageFilterInput): number
  filterMana(input: GameSimulationManaFilterInput): number
  hasConsumable(contentId: string): boolean
}

export const DEFAULT_PLAYER_ID = 'local-player'
export const GAME_FIXED_TICK_SECONDS = PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS
export const GAME_TICK_RATE = 1 / GAME_FIXED_TICK_SECONDS
export const BONEYARD_ENEMY_EVENT_LANE_CAPACITY = 512
export const BONEYARD_ENEMY_EVENT_RETENTION_TICKS = GAME_TICK_RATE
export const DEFAULT_PLAYER_CHARACTER_CONFIG: PlayerCharacterConfig = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
}

export function createGameSimulation(
  characters: Readonly<Record<PlayerId, PlayerCharacterConfig>> = {
    [DEFAULT_PLAYER_ID]: DEFAULT_PLAYER_CHARACTER_CONFIG,
  },
  options: GameSimulationOptions = {},
): GameSimulationState {
  const lightProviderOrder = createNativeLightProviderOrder()
  const world = createHubWorld(Object.keys(characters), {
    studentPopulation: options.hubStudentPopulation,
    traderAnimationSeed: options.hubTraderAnimationSeed,
  })
  let playerEntities = createPlayerEntityStore()
  let gameRng = createNativeRng(options.gameRngSeed ?? 0)
  for (const [playerId, config] of Object.entries(characters)) {
    const draw = drawNativeInteger(gameRng, 1_000_000)
    gameRng = draw.state
    playerEntities = addPlayerEntity(
      playerEntities,
      playerId,
      config,
      createPlayerCharacter(config, hubSpawnPoint()),
      draw.value,
      lightProviderOrder.register('actor'),
    )
  }
  if (options.initialPlayerExperience !== undefined) {
    for (const { playerId } of playerEntities.identities) {
      playerEntities = grantPlayerEntityExperience(
        playerEntities,
        playerId,
        options.initialPlayerExperience,
      )
    }
  }
  const participantIds = stableExistingPlayerIds(
    playerEntities,
    playerEntities.identities.map(({ playerId }) => playerId),
  )
  const pendingPlayerIds = pendingOfferPlayerIds(playerEntities, participantIds)
  const milestoneSourceId = pendingPlayerIds[0] ?? null
  const milestoneSource = milestoneSourceId === null
    ? null
    : playerProgressionAt(playerEntities, milestoneSourceId)
  const levelUpBarrier = milestoneSourceId === null || milestoneSource === null
    ? null
    : createLevelUpBarrier(
        1,
        milestoneSourceId,
        milestoneSource.experience,
        milestoneSource.level,
        participantIds,
        pendingPlayerIds,
        null,
      )
  return {
    accumulatorSeconds: 0,
    combatRng: createNativeRng(options.combatRngSeed ?? 0),
    hallOfFameClockStartedAtTick: 0,
    levelUpBarrier,
    lightProviderOrder: lightProviderOrder.state(),
    modEffects: Object.freeze([]),
    nextLevelUpBarrierId: levelUpBarrier === null ? 1 : 2,
    nextModConsumableUseId: 1,
    playerEntities,
    gameRng,
    primarySpells: createPrimarySpellSimulation(),
    secondaryAbilities: createNativeSecondarySimulation(),
    run: createGameRunLifecycle(),
    tick: 0,
    world,
  }
}

export function addPlayerCharacter(
  state: GameSimulationState,
  playerId: PlayerId,
  config: PlayerCharacterConfig,
): GameSimulationState {
  if (playerEntityIndex(state.playerEntities, playerId) >= 0) return state
  const world = state.world.kind === 'hub'
    ? addHubParticipant(state.world, playerId)
    : {
        ...state.world,
        hallOfFameRuns: {
          ...state.world.hallOfFameRuns,
          [playerId]: createNativeHallOfFameRun(state.hallOfFameClockStartedAtTick),
        },
      }
  const draw = drawNativeInteger(state.gameRng, 1_000_000)
  const lightProviderOrder = createNativeLightProviderOrder(state.lightProviderOrder)
  const playerEntities = addPlayerEntity(
    state.playerEntities,
    playerId,
    config,
    spawnPlayerForWorld(state.world, config),
    draw.value,
    lightProviderOrder.register('actor'),
  )
  return {
    ...state,
    lightProviderOrder: lightProviderOrder.state(),
    playerEntities,
    gameRng: draw.state,
    run: synchronizeGameRunParticipants(
      state.run,
      playerEntities.identities.map(({ playerId: id }) => id),
    ),
    world,
  }
}

export function removePlayerCharacter(
  state: GameSimulationState,
  playerId: PlayerId,
): GameSimulationState {
  if (playerEntityIndex(state.playerEntities, playerId) < 0) return state
  const playerEntities = removePlayerEntity(state.playerEntities, playerId)
  const levelUpBarrier = removeLevelUpBarrierParticipant(
    state.levelUpBarrier,
    playerId,
  )
  return {
    ...state,
    levelUpBarrier,
    playerEntities,
    primarySpells: removePrimarySpellOwner(state.primarySpells, playerId),
    secondaryAbilities: removeNativeSecondaryOwner(state.secondaryAbilities, playerId),
    run: synchronizeGameRunParticipants(
      state.run,
      playerEntities.identities.map(({ playerId: id }) => id),
    ),
    world: state.world.kind === 'hub'
      ? removeHubParticipant(state.world, playerId)
      : {
          ...state.world,
          hallOfFameRuns: Object.fromEntries(Object.entries(
            state.world.hallOfFameRuns,
          ).filter(([id]) => id !== playerId)),
        },
  }
}

export function partitionGameSimulationPlayers(
  state: GameSimulationState,
  selectedPlayerIds: readonly PlayerId[],
): Readonly<{ remaining: GameSimulationState; selected: GameSimulationState }> {
  const selectedSet = new Set(selectedPlayerIds)
  if (
    selectedSet.size !== selectedPlayerIds.length
    || selectedPlayerIds.some((playerId) => playerEntityIndex(state.playerEntities, playerId) < 0)
  ) throw new Error('game simulation partition requires unique existing players')
  let selected = state
  let remaining = state
  for (const { playerId } of state.playerEntities.identities) {
    if (selectedSet.has(playerId)) remaining = removePlayerCharacter(remaining, playerId)
    else selected = removePlayerCharacter(selected, playerId)
  }
  return { remaining, selected }
}

export function mergeGameSimulationPlayersIntoHub(
  target: GameSimulationState,
  source: GameSimulationState,
): GameSimulationState {
  if (target.world.kind !== 'hub' || source.world.kind !== 'hub') {
    throw new Error('game simulation merge requires two Hub worlds')
  }
  const lightProviderOrder = createNativeLightProviderOrder(target.lightProviderOrder)
  let playerEntities = target.playerEntities
  let world = target.world
  for (const { playerId } of source.playerEntities.identities) {
    if (playerEntityIndex(playerEntities, playerId) >= 0) {
      throw new Error(`Hub already contains player ${playerId}`)
    }
    const participant = source.world.participants[playerId]
    if (!participant) throw new Error(`source Hub participant ${playerId} is missing`)
    playerEntities = importPlayerEntity(
      playerEntities,
      source.playerEntities,
      playerId,
      playerId,
      lightProviderOrder.register('actor'),
    )
    world = addHubParticipant(world, playerId, participant)
  }
  return {
    ...target,
    lightProviderOrder: lightProviderOrder.state(),
    playerEntities,
    world,
  }
}

export function enterBoneyardWorld(
  state: GameSimulationState,
  loaded: LoadedBoneyard,
): GameSimulationState {
  if (state.levelUpBarrier !== null) {
    throw new Error('cannot enter a Boneyard during a level-up barrier')
  }
  const lightProviderOrder = createNativeLightProviderOrder()
  const playerLightRegistrations = Object.fromEntries(
    state.playerEntities.identities.map(({ playerId }) => [
      playerId,
      lightProviderOrder.register('actor'),
    ]),
  )
  const baseWorld = createBoneyardWorld(loaded)
  const world: BoneyardWorldState = {
    ...baseWorld,
    hallOfFameRuns: Object.fromEntries(state.playerEntities.identities.map(({ playerId }) => [
      playerId,
      createNativeHallOfFameRun(state.hallOfFameClockStartedAtTick),
    ])),
    lanternLightRegistration: loaded.scene.solomonDig === null
      ? null
      : lightProviderOrder.register('actor'),
    tutorialProfileEconomy: baseWorld.tutorial === null
      ? null
      : playerEconomyAt(
          state.playerEntities,
          state.playerEntities.identities[0]?.playerId ?? '',
        ),
  }
  const placements = placePlayersInBoneyard(playerCharacterRecords(state.playerEntities), world)
  let playerEntities = clearPlayerEntityMindstars(resetPlayerEntitiesForNewRun(
    state.playerEntities,
    placements,
    playerLightRegistrations,
    { preserveConcentrations: true },
  ))
  if (world.tutorial !== null) {
    if (playerEntities.identities.length !== 1) {
      throw new Error('the stock Tutorial requires exactly one authoritative player')
    }
    for (const { playerId } of playerEntities.identities) {
      playerEntities = preparePlayerEntityTutorialLoadout(playerEntities, playerId)
    }
  }
  let secondaryAbilities = resetNativeSecondaryWorld(state.secondaryAbilities)
  if (world.tutorial !== null) {
    secondaryAbilities = spawnNativeScriptFires(
      secondaryAbilities,
      playerEntities.identities[0]!.playerId,
      `boneyard:${world.runId}`,
      NATIVE_TUTORIAL_FIRES,
      lightProviderOrder.register,
    )
  }
  return {
    ...state,
    levelUpBarrier: null,
    lightProviderOrder: lightProviderOrder.state(),
    modEffects: Object.freeze([]),
    playerEntities,
    primarySpells: createPrimarySpellSimulation(),
    secondaryAbilities,
    run: startGameRun(
      state.run,
      loaded.runId,
      state.playerEntities.identities.map(({ playerId }) => playerId),
    ),
    world,
  }
}

export function returnGameSimulationToHub(state: GameSimulationState): GameSimulationState {
  const hubSeed = drawNativeInteger(state.gameRng, 0x40000000)
  const world = createHubWorld(
    state.playerEntities.identities.map(({ playerId }) => playerId),
    { traderAnimationSeed: hubSeed.value },
  )
  const lightProviderOrder = createNativeLightProviderOrder()
  const playerLightRegistrations = Object.fromEntries(
    state.playerEntities.identities.map(({ playerId }) => [
      playerId,
      lightProviderOrder.register('actor'),
    ]),
  )
  const placements = Object.fromEntries(state.playerEntities.identities.map(({ playerId }, index) => {
    const config = state.playerEntities.configs[index]!
    return [playerId, createPlayerCharacter(config, hubSpawnPoint())]
  }))
  return {
    ...state,
    gameRng: hubSeed.state,
    modEffects: Object.freeze([]),
    levelUpBarrier: null,
    lightProviderOrder: lightProviderOrder.state(),
    playerEntities: clearPlayerEntityMindstars(resetPlayerEntitiesForNewRun(
      state.playerEntities,
      placements,
      playerLightRegistrations,
    )),
    primarySpells: createPrimarySpellSimulation(),
    secondaryAbilities: resetNativeSecondaryWorld(state.secondaryAbilities),
    run: createGameRunLifecycle(),
    world,
  }
}

function enterPostRunLoadout(
  state: GameSimulationState,
  run: GameRunLifecycleState,
): GameSimulationState {
  if (run.phase !== 'loadout') {
    throw new Error('post-run loadout requires a completed Game Over fade')
  }
  const hubSeed = drawNativeInteger(state.gameRng, 0x40000000)
  const world = createHubWorld(
    state.playerEntities.identities.map(({ playerId }) => playerId),
    { traderAnimationSeed: hubSeed.value },
  )
  const lightProviderOrder = createNativeLightProviderOrder()
  const playerLightRegistrations = Object.fromEntries(
    state.playerEntities.identities.map(({ playerId }) => [
      playerId,
      lightProviderOrder.register('actor'),
    ]),
  )
  const placements = Object.fromEntries(state.playerEntities.identities.map(({ playerId }, index) => {
    const config = state.playerEntities.configs[index]!
    return [playerId, createPlayerCharacter(config, hubSpawnPoint())]
  }))
  let playerEntities = resetPlayerEntitiesForNewRun(
    state.playerEntities,
    placements,
    playerLightRegistrations,
  )
  playerEntities = clearPlayerEntityMindstars(playerEntities)
  for (const { playerId } of playerEntities.identities) {
    const economy = gameSimulationDurableProfileEconomy(state, playerId)
    playerEntities = replacePlayerEconomy(playerEntities, playerId, economy)
  }
  return {
    ...state,
    gameRng: hubSeed.state,
    hallOfFameClockStartedAtTick: state.tick,
    levelUpBarrier: null,
    lightProviderOrder: lightProviderOrder.state(),
    modEffects: Object.freeze([]),
    playerEntities,
    primarySpells: createPrimarySpellSimulation(),
    secondaryAbilities: resetNativeSecondaryWorld(state.secondaryAbilities),
    run,
    world,
  }
}

export function gameSimulationDurableProfileEconomy(
  state: GameSimulationState,
  playerId: PlayerId,
): HubEconomyState {
  const economy = playerEconomyAt(state.playerEntities, playerId)
  const player = playerCharacterAt(state.playerEntities, playerId)
  if (!economy || !player) throw new Error(`game simulation has no profile owner ${playerId}`)
  if (state.world.kind === 'boneyard' && state.world.tutorial !== null) {
    if (state.world.tutorialProfileEconomy === null) {
      throw new Error('Tutorial profile baseline is absent')
    }
    const tutorialCompleted = state.run.phase === 'game-over'
      || state.run.phase === 'loadout'
    return state.world.tutorialProfileEconomy.tutorialPending === !tutorialCompleted
      ? state.world.tutorialProfileEconomy
      : {
          ...state.world.tutorialProfileEconomy,
          tutorialPending: !tutorialCompleted,
        }
  }
  if (state.run.phase === 'loadout' && state.world.kind === 'hub') return economy
  const completedRun = state.world.kind === 'boneyard'
    && (state.run.phase === 'game-over' || state.run.phase === 'loadout')
  const lastWord = completedRun && economy.ownedPerkSelectors.includes(12)
  return archiveCompletedRunEconomy(economy, {
    displayName: player.config.displayName,
    groundGold: lastWord && state.world.kind === 'boneyard'
      ? state.world.loot.actors
          .filter(actor => actor.kind === 'gold')
          .reduce((total, actor) => total + actor.amount, 0)
      : 0,
    groundItems: lastWord && state.world.kind === 'boneyard'
      ? state.world.loot.actors.flatMap(actor => (
          actor.kind === 'sack' && actor.item ? [actor.item] : []
        ))
      : [],
    transferCarriedItems: completedRun,
  })
}

export function gameSimulationRetiredWizardEconomy(
  state: GameSimulationState,
  playerId: PlayerId,
): HubEconomyState {
  const economy = playerEconomyAt(state.playerEntities, playerId)
  const player = playerCharacterAt(state.playerEntities, playerId)
  if (!economy || !player) throw new Error(`game simulation has no profile owner ${playerId}`)
  if (state.world.kind === 'boneyard' && state.world.tutorial !== null) {
    if (state.world.tutorialProfileEconomy === null) {
      throw new Error('Tutorial profile baseline is absent')
    }
    return state.world.tutorialProfileEconomy
  }
  return archiveCompletedRunEconomy(economy, {
    displayName: player.config.displayName,
    groundGold: 0,
    groundItems: [],
    transferCarriedItems: true,
  })
}

export function confirmGameSimulationLoadout(
  state: GameSimulationState,
  playerId: PlayerId,
  selection: Pick<PlayerCharacterConfig, 'discipline' | 'element'>,
): GameSimulationState | null {
  const player = playerCharacterAt(state.playerEntities, playerId)
  if (!player) return null
  const run = confirmPostRunLoadout(state.run, playerId)
  if (!run) return null
  const config = {
    ...player.config,
    discipline: selection.discipline,
    element: selection.element,
  }
  return {
    ...state,
    playerEntities: replacePlayerLoadout(
      state.playerEntities,
      playerId,
      createPlayerCharacter(config, player.position),
    ),
    run,
  }
}

export function continueGameSimulationOver(
  state: GameSimulationState,
  runId: string,
  eventId: number,
): GameSimulationState | null {
  const run = continueGameOver(state.run, runId, eventId)
  return run ? { ...state, run } : null
}

export function applyGameSimulationTutorialAction(
  state: GameSimulationState,
  playerId: PlayerId,
  action: NativeTutorialSurfaceAction,
): GameSimulationState | null {
  if (state.world.kind !== 'boneyard' || state.world.tutorial === null) return null
  if (
    state.playerEntities.identities.length !== 1
    || state.playerEntities.identities[0]?.playerId !== playerId
  ) return null
  const tutorial = applyNativeTutorialSurfaceAction(state.world.tutorial, action)
  return tutorial === state.world.tutorial
    ? state
    : { ...state, world: { ...state.world, tutorial } }
}

export function getPlayerCharacter(
  state: GameSimulationState,
  playerId = DEFAULT_PLAYER_ID,
): PlayerCharacterState {
  const player = playerCharacterAt(state.playerEntities, playerId)
  if (!player) throw new Error(`game simulation has no player character ${playerId}`)
  return player
}

export function getPlayerProgression(
  state: GameSimulationState,
  playerId = DEFAULT_PLAYER_ID,
): PlayerProgressionComponent {
  const progression = playerProgressionAt(state.playerEntities, playerId)
  if (!progression) throw new Error(`game simulation has no player progression ${playerId}`)
  return progression
}

export function getPlayerEconomy(
  state: GameSimulationState,
  playerId = DEFAULT_PLAYER_ID,
): HubEconomyState {
  const economy = playerEconomyAt(state.playerEntities, playerId)
  if (!economy) throw new Error(`game simulation has no player economy ${playerId}`)
  return economy
}

export function applyGameSimulationHubAction(
  state: GameSimulationState,
  playerId: PlayerId,
  action: HubInventoryAction,
  extensions?: GameSimulationExtensions,
): GameSimulationInventoryActionResult {
  const economy = playerEconomyAt(state.playerEntities, playerId)
  const player = playerCharacterAt(state.playerEntities, playerId)
  const skillBook = playerSkillBookAt(state.playerEntities, playerId)
  if (!economy || !player || !skillBook || state.levelUpBarrier !== null) {
    return { accepted: false, modConsumption: null, reason: 'service-unavailable', state }
  }
  if (action.type === 'interact-goodie') {
    return interactWithBoneyardGoodie(state, playerId, player)
  }
  const trader = traderForAction(action)
  if ((trader || isHubNpcAction(action)) && !hubServiceAvailable(state, playerId)) {
    return { accepted: false, modConsumption: null, reason: 'service-unavailable', state }
  }

  const consumedPotion = action.type === 'consume'
    ? findInventoryItem(economy.backpack, action.itemId)
    : null
  const equippedItem = action.type === 'equip'
    ? findInventoryItem(economy.backpack, action.itemId)
    : null
  const skillBookItem = action.type === 'read-skill-book'
    ? findInventoryItem(economy.backpack, action.itemId)
    : null
  const purchasedHagathaSelectors = action.type === 'buy-hagatha'
    ? hagathaOffers(economy).find(({ selector }) => selector === action.selector)?.members ?? []
    : []
  if (consumedPotion?.modContent &&
      extensions?.hasConsumable(consumedPotion.modContent.contentId) !== true) {
    return { accepted: false, modConsumption: null, reason: 'service-unavailable', state }
  }
  const result = (() => {
    switch (action.type) {
      case 'buy-dowsing': return buyDowsingOffer(economy, action.offerId)
      case 'buy-fomentius': return buyFomentiusItem(economy, action.itemId)
      case 'buy-hagatha': return buyHagathaPerk(economy, action.selector)
      case 'buy-teacher-spell': return buyTeacherSpell(
        economy,
        action.skillId,
        skillBook.advancedUnlocks,
      )
      case 'close-dowsing': {
        const next = closeDowsingOffers(economy)
        return {
          accepted: true,
          dowsingPitch: null,
          reason: null,
          state: next,
          unforgeOutcome: null,
        }
      }
      case 'consume': return consumeInventoryItem(economy, action.itemId)
      case 'dye': return dyeInventoryClothing(
        economy,
        action.dyeItemId,
        action.targetItemId,
        action.layer,
        action.swatchRows,
      )
      case 'dowse': return dowse(economy, getPlayerProgression(state, playerId).level)
      case 'equip': return equipInventoryItem(economy, action.itemId, action.slot)
      case 'move-inventory-item': return moveInventoryItem(
        economy,
        action.itemId,
        action.destinationSackId,
      )
      case 'read-librarian-book': return readLibrarianBook(economy, action.bookId)
      case 'read-skill-book': return readInventorySkillBook(economy, action.itemId)
      case 'select-boast': return selectHubBoast(economy, action.boastId)
      case 'transfer': return transferInventoryItem(economy, action.itemId, action.direction)
      case 'unforge': return unforgeInventoryItem(
        economy,
        action.itemId,
        getPlayerProgression(state, playerId),
      )
      case 'unequip': return unequipInventorySlot(economy, action.slot)
    }
  })()
  const actionFeedback = {
    accepted: result.accepted,
    action: action.type,
    dowsingPitch: result.dowsingPitch,
    reason: result.reason,
    sequence: (economy.actionFeedback?.sequence ?? 0) + 1,
    transferDirection: action.type === 'transfer' ? action.direction : null,
    transferGesture: action.type === 'transfer' ? action.gesture : null,
    unforgeOutcome: result.unforgeOutcome,
  } as const
  const nextEconomy = {
    ...result.state,
    actionFeedback,
    revision: Math.max(result.state.revision, economy.revision + 1),
  }
  let playerEntities = replacePlayerEconomy(state.playerEntities, playerId, nextEconomy)
  let gameRng = state.gameRng
  let levelUpBarrier: PlayerLevelUpBarrierState | null = state.levelUpBarrier
  let nextLevelUpBarrierId = state.nextLevelUpBarrierId
  let secondaryAbilities = state.secondaryAbilities
  let world = state.world
  if (result.accepted && action.type === 'buy-hagatha') {
    const applied = applyPlayerEntityHagathaPurchaseEffects(
      playerEntities,
      playerId,
      purchasedHagathaSelectors,
      gameRng,
    )
    playerEntities = applied.store
    gameRng = applied.rng
  }
  if (result.accepted && action.type === 'buy-teacher-spell') {
    const unlocked = unlockPlayerEntityAdvancedSkill(playerEntities, playerId, action.skillId)
    if (unlocked === null) {
      throw new Error(`Teacher spell transaction diverged for skill ${action.skillId}`)
    }
    playerEntities = unlocked
  }
  if (result.accepted && action.type === 'consume' && consumedPotion?.nativeSubtype != null &&
      consumedPotion.modContent === undefined) {
    if (consumedPotion.nativeTypeId === 7001) {
      playerEntities = failPlayerEntityBoast(playerEntities, playerId, 'potion-use')
    }
    const beforeMana = getPlayerProgression(state, playerId).currentMana
    playerEntities = applyPlayerEntityPotionEffect(
      playerEntities,
      playerId,
      consumedPotion.nativeSubtype,
    )
    const afterPotion = playerProgressionAt(playerEntities, playerId)
    if (afterPotion && afterPotion.currentMana !== beforeMana && extensions) {
      const delta = filterManaDelta(
        extensions,
        state.tick,
        playerId,
        beforeMana,
        afterPotion.maximumMana,
        afterPotion.currentMana - beforeMana,
        'stock-potion',
      )
      playerEntities = setPlayerEntityMana(
        playerEntities,
        playerId,
        Math.max(0, Math.min(afterPotion.maximumMana, beforeMana + delta)),
      )
    }
    const hallRun = world.kind === 'boneyard'
      ? world.hallOfFameRuns[playerId]
      : undefined
    if (world.kind === 'boneyard' && hallRun !== undefined) {
      world = {
        ...world,
        hallOfFameRuns: {
          ...world.hallOfFameRuns,
          [playerId]: resetNativeHallOfFameKillStreak(hallRun),
        },
      }
    }
  }
  if (
    result.accepted
    && action.type === 'equip'
    && equippedItem !== null
    && inventoryItemHasMagicalEffects(equippedItem)
  ) {
    playerEntities = failPlayerEntityBoast(playerEntities, playerId, 'magical-equipment')
  }
  if (result.accepted && action.type === 'unforge' && result.unforgeOutcome) {
    const index = playerEntityIndex(playerEntities, playerId)
    const progressions = [...playerEntities.progressions]
    if (result.unforgeOutcome.kind === 'full-rejuvenation') {
      progressions[index] = applyNativeUnforgeFullRejuvenation(progressions[index]!)
      playerEntities = { ...playerEntities, progressions: Object.freeze(progressions) }
      secondaryAbilities = applyNativeUnforgeCooldownRejuvenation(secondaryAbilities, playerId)
    } else if (result.unforgeOutcome.kind === 'mind-dredge') {
      progressions[index] = grantNativeUnforgeMindDredge(progressions[index]!)
      playerEntities = { ...playerEntities, progressions: Object.freeze(progressions) }
    }
  }
  if (result.accepted && action.type === 'read-skill-book') {
    if (skillBookItem?.nativeSubtype === 2) {
      const beforeInsight = playerEntities
      playerEntities = grantPlayerEntityBonusSkillChoice(playerEntities, playerId)
      const insight = markNewCreativityInsights(
        beforeInsight,
        playerEntities,
        [playerId],
        secondaryAbilities.rng,
      )
      playerEntities = insight.store
      secondaryAbilities = { ...secondaryAbilities, rng: insight.rng }
      const automatic = assignAutomaticSkillChoices(playerEntities, [playerId], gameRng)
      playerEntities = automatic.store
      gameRng = automatic.rng
      const progression = playerProgressionAt(playerEntities, playerId)
      if (progression !== null) {
        const requested = state.run.phase === 'active'
          ? state.run.eligiblePlayerIds
          : playerEntities.identities.map(({ playerId: id }) => id)
        const participantIds = stableExistingPlayerIds(playerEntities, requested)
        levelUpBarrier = createLevelUpBarrier(
          nextLevelUpBarrierId,
          playerId,
          progression.experience,
          progression.level,
          participantIds,
          pendingOfferPlayerIds(playerEntities, participantIds),
          world.kind === 'boneyard' ? world.runId : null,
        )
        nextLevelUpBarrierId += 1
      }
    } else if (skillBookItem?.nativeSubtype === 3) {
      const increased = increaseRandomPlayerEntitySkill(playerEntities, playerId, gameRng)
      playerEntities = increased.store
      gameRng = increased.rng
    }
  }
  const modConsumption = result.accepted && action.type === 'consume' && consumedPotion?.modContent
    ? Object.freeze({
        content: consumedPotion.modContent,
        playerId,
        tick: state.tick,
        useId: state.nextModConsumableUseId,
      })
    : null
  const modEffects = modConsumption?.content.consumeVfx
    ? Object.freeze([
        ...state.modEffects.filter(effect => (
          effect.playerId !== playerId || effect.contentId !== modConsumption.content.contentId
        )),
        Object.freeze({
          color: modConsumption.content.consumeVfx.color,
          contentId: modConsumption.content.contentId,
          expiresTick: state.tick + Math.max(
            1,
            Math.ceil(modConsumption.content.durationMs / (GAME_FIXED_TICK_SECONDS * 1_000)),
          ),
          playerId,
          startedTick: state.tick,
          useId: modConsumption.useId,
        }),
       ])
     : state.modEffects
  return {
    accepted: result.accepted,
    modConsumption,
    reason: result.reason,
    state: {
      ...state,
      gameRng,
      levelUpBarrier,
      modEffects,
      nextLevelUpBarrierId,
      nextModConsumableUseId: modConsumption
        ? state.nextModConsumableUseId + 1
        : state.nextModConsumableUseId,
      playerEntities,
      secondaryAbilities,
      world,
    },
  }
}

export function getPlayerSkillBook(
  state: GameSimulationState,
  playerId = DEFAULT_PLAYER_ID,
): PlayerSkillBookComponent {
  const skillBook = playerSkillBookAt(state.playerEntities, playerId)
  if (!skillBook) throw new Error(`game simulation has no player skill book ${playerId}`)
  return skillBook
}

export function bindGameSimulationPlayerSkillQuickbar(
  state: GameSimulationState,
  playerId: PlayerId,
  skillId: number,
  slot: number,
): GameSimulationState | null {
  if (!gameSimulationPlayerCanEditBooks(state, playerId)) return null
  try {
    return {
      ...state,
      playerEntities: bindPlayerEntitySkillQuickbar(
        state.playerEntities,
        playerId,
        skillId,
        slot,
      ),
    }
  } catch {
    return null
  }
}

export function selectGameSimulationPlayerPrimarySkill(
  state: GameSimulationState,
  playerId: PlayerId,
  skillId: number,
): GameSimulationState | null {
  if (!gameSimulationPlayerCanEditBooks(state, playerId)) return null
  try {
    return {
      ...state,
      playerEntities: selectPlayerEntityPrimarySkill(state.playerEntities, playerId, skillId),
    }
  } catch {
    return null
  }
}

export function selectGameSimulationPlayerConcentration(
  state: GameSimulationState,
  playerId: PlayerId,
  skillId: number,
): GameSimulationState | null {
  if (!gameSimulationPlayerCanEditBooks(state, playerId)) return null
  try {
    return {
      ...state,
      playerEntities: selectPlayerEntityConcentrationSkill(
        state.playerEntities,
        playerId,
        skillId,
      ),
    }
  } catch {
    return null
  }
}

export function selectGameSimulationPlayerConcentrationSlot(
  state: GameSimulationState,
  playerId: PlayerId,
  skillId: number,
  slot: 0 | 1,
): GameSimulationState | null {
  if (!gameSimulationPlayerCanEditBooks(state, playerId)) return null
  try {
    return {
      ...state,
      playerEntities: selectPlayerEntityConcentrationSlot(
        state.playerEntities,
        playerId,
        skillId,
        slot,
      ),
    }
  } catch {
    return null
  }
}

function gameSimulationPlayerCanEditBooks(
  state: GameSimulationState,
  playerId: PlayerId,
): boolean {
  return (state.run.phase === 'hub' || state.run.phase === 'active')
    && state.levelUpBarrier === null
    && playerEntityCanAcceptInput(state.playerEntities, playerId)
}

export function getPlayerStatBook(
  state: GameSimulationState,
  playerId = DEFAULT_PLAYER_ID,
): PlayerStatBookComponent {
  const statBook = playerStatBookAt(state.playerEntities, playerId)
  if (!statBook) throw new Error(`game simulation has no player stat book ${playerId}`)
  return statBook
}

export function gameSimulationPlayerRecords(
  state: GameSimulationState,
): Readonly<Record<PlayerId, PlayerCharacterState>> {
  return playerCharacterRecords(state.playerEntities)
}

export function grantGameSimulationPlayerExperience(
  state: GameSimulationState,
  playerId: PlayerId,
  amount: number,
): GameSimulationState {
  const previousLevel = getPlayerProgression(state, playerId).level
  let next = grantSharedGameSimulationExperience(state, playerId, amount)
  const level = getPlayerProgression(next, playerId).level
  if (level <= previousLevel) return next
  const lightProviderOrder = createNativeLightProviderOrder(next.lightProviderOrder)
  const triggered = triggerMindblowingRing(
    next.playerEntities,
    next.secondaryAbilities,
    next.world,
    playerId,
    level,
    next.tick,
    lightProviderOrder,
  )
  next = {
    ...next,
    lightProviderOrder: lightProviderOrder.state(),
    secondaryAbilities: triggered.secondaryAbilities,
    world: triggered.world,
  }
  return next
}

export function selectGameSimulationPlayerSkill(
  state: GameSimulationState,
  playerId: PlayerId,
  selection: { choiceIndex: number; offerSequence: number; skillId: number },
): GameSimulationState | null {
  const playerEntities = applyPlayerEntitySkillChoice(state.playerEntities, playerId, selection)
  if (!playerEntities) return null
  const insights = markNewCreativityInsights(
    state.playerEntities,
    playerEntities,
    [playerId],
    state.secondaryAbilities.rng,
  )
  const barrier = state.levelUpBarrier
  if (barrier === null || !barrier.participantIds.includes(playerId)) {
    return {
      ...state,
      playerEntities: insights.store,
      secondaryAbilities: { ...state.secondaryAbilities, rng: insights.rng },
    }
  }
  const pendingPlayerIds = pendingOfferPlayerIds(insights.store, barrier.participantIds)
  return {
    ...state,
    levelUpBarrier: pendingPlayerIds.length === 0
      ? null
      : Object.freeze({ ...barrier, pendingPlayerIds }),
    playerEntities: insights.store,
    secondaryAbilities: { ...state.secondaryAbilities, rng: insights.rng },
  }
}

export function rerollGameSimulationPlayerSkill(
  state: GameSimulationState,
  playerId: PlayerId,
  offerSequence: number,
): GameSimulationState | null {
  const barrier = state.levelUpBarrier
  if (barrier === null || !barrier.pendingPlayerIds.includes(playerId)) return null
  const draw = drawNativeInteger(state.gameRng, 1_000_000)
  const playerEntities = rerollPlayerEntitySkillOffer(
    state.playerEntities,
    playerId,
    offerSequence,
    draw.value,
  )
  if (!playerEntities) return null
  const insights = markNewCreativityInsights(
    state.playerEntities,
    playerEntities,
    [playerId],
    state.secondaryAbilities.rng,
  )
  return {
    ...state,
    playerEntities: insights.store,
    gameRng: draw.state,
    secondaryAbilities: { ...state.secondaryAbilities, rng: insights.rng },
  }
}

export function saveGameSimulationPlayerSkill(
  state: GameSimulationState,
  playerId: PlayerId,
  offerSequence: number,
): GameSimulationState | null {
  const barrier = state.levelUpBarrier
  if (barrier === null || !barrier.pendingPlayerIds.includes(playerId)) return null
  const playerEntities = deferPlayerEntitySkillChoice(
    state.playerEntities,
    playerId,
    offerSequence,
  )
  if (!playerEntities) return null
  const insights = markNewCreativityInsights(
    state.playerEntities,
    playerEntities,
    [playerId],
    state.secondaryAbilities.rng,
  )
  const pendingPlayerIds = pendingOfferPlayerIds(insights.store, barrier.participantIds)
  return {
    ...state,
    levelUpBarrier: pendingPlayerIds.length === 0
      ? null
      : Object.freeze({ ...barrier, pendingPlayerIds }),
    playerEntities: insights.store,
    secondaryAbilities: { ...state.secondaryAbilities, rng: insights.rng },
  }
}

export function stepGameSimulationTick(
  state: GameSimulationState,
  inputs: PlayerCharacterInputs,
  options: GameSimulationTickOptions = {},
): GameSimulationState {
  const liveModEffects = state.modEffects.filter(effect => effect.expiresTick > state.tick)
  if (liveModEffects.length !== state.modEffects.length) {
    state = { ...state, modEffects: Object.freeze(liveModEffects) }
  }
  if (state.run.phase === 'game-over') {
    if (state.world.kind !== 'boneyard') {
      throw new Error('Game Over requires the terminal Boneyard world')
    }
    const lightProviderOrder = createNativeLightProviderOrder(state.lightProviderOrder)
    let playerEntities = stepPlayerEntityOverlayLightingTick(state.playerEntities)
    const combat = stepPlayerEntityCombatTick(
      playerEntities,
      new Set(),
      playerCombatMutations(options.extensions, state.tick),
    )
    playerEntities = combat.store
    let secondaryAbilities = stepNativeMindblastPresentation(state.secondaryAbilities)
    for (const playerId of combat.deathBurstPlayerIds) {
      playerEntities = setPlayerEntityMindstar(playerEntities, playerId, false)
      secondaryAbilities = removeNativeSecondaryOwner(secondaryAbilities, playerId)
    }
    const run = stepGameRunLifecycle(state.run, new Set())
    const tick = state.tick + 1
    let gameRng = state.gameRng
    let world = state.world
    for (const playerId of combat.lastWordBurstPlayerIds) {
      const triggered = triggerHagathaLastWord(
        playerEntities,
        secondaryAbilities,
        world,
        playerId,
        tick,
        lightProviderOrder,
      )
      secondaryAbilities = triggered.secondaryAbilities
      world = triggered.world
    }
    for (const playerId of combat.lastWordArchivePlayerIds) {
      const archived = archiveHagathaLastWordGroundLoot(
        playerEntities,
        world,
        playerId,
        gameRng,
      )
      playerEntities = archived.playerEntities
      gameRng = archived.rng
      world = archived.world
    }
    if (run.gameOverTicks === NATIVE_HALL_OF_FAME_SCORE.archiveDeathTick) {
      const hallOfFameRuns: Record<string, ReturnType<typeof archiveNativeHallOfFameRun>> = {}
      for (const [playerId, hallRun] of Object.entries(state.world.hallOfFameRuns).sort()) {
        const heading = drawNativeFloat(
          gameRng,
          NATIVE_HALL_OF_FAME_SCORE.portraitHeadingJitterDegrees,
          true,
        )
        const scale = drawNativeFloat(
          heading.state,
          NATIVE_HALL_OF_FAME_SCORE.portraitScaleJitter,
        )
        gameRng = scale.state
        const boast = playerEconomyAt(playerEntities, playerId)?.npc.boast
        const scoredRun = boast === undefined
          ? hallRun
          : { ...hallRun, awesomeness: nativeBoastScore(hallRun.awesomeness, boast) }
        hallOfFameRuns[playerId] = archiveNativeHallOfFameRun(
          scoredRun,
          tick,
          Math.fround(
            NATIVE_HALL_OF_FAME_SCORE.portraitHeadingCenterDegrees + heading.value,
          ),
          Math.fround(NATIVE_HALL_OF_FAME_SCORE.portraitScaleBase + scale.value),
        )
      }
      world = { ...world, hallOfFameRuns }
    }
    const frozen = {
      ...state,
      gameRng,
      lightProviderOrder: lightProviderOrder.state(),
      playerEntities,
      run,
      secondaryAbilities,
      tick,
      world,
    }
    return run.phase === 'loadout' ? enterPostRunLoadout(frozen, run) : frozen
  }
  if (state.levelUpBarrier !== null) return state
  const lightProviderOrder = createNativeLightProviderOrder(state.lightProviderOrder)
  if (state.world.kind === 'boneyard' && state.world.tutorial !== null) {
    const tutorialPlayerId = state.playerEntities.identities[0]?.playerId
    const forcedVelocity = nativeTutorialForcedVelocity(state.world.tutorial)
    const tutorialPlayer = tutorialPlayerId
      ? playerCharacterAt(state.playerEntities, tutorialPlayerId)
      : null
    if (tutorialPlayerId && tutorialPlayer && forcedVelocity) {
      state = {
        ...state,
        playerEntities: replacePlayerCharacter(
          state.playerEntities,
          tutorialPlayerId,
          { ...tutorialPlayer, velocity: forcedVelocity },
        ),
      }
    }
  }
  const players = playerCharacterRecords(state.playerEntities)
  const staffActionOwnerIds = new Set(state.primarySpells.transients.flatMap((transient) => (
    transient.kind === 'player-staff-melee' || transient.kind === 'player-staff-spin'
      ? [transient.ownerId]
      : []
  )))
  const activeInputs = Object.fromEntries(Object.keys(players).map((playerId) => {
    const admittedInput = getPlayerProgression(state, playerId).pendingOffer
      || !playerEntityCanAcceptInput(state.playerEntities, playerId)
      || (state.run.phase !== 'hub' && state.run.phase !== 'active')
      ? createIdlePlayerCharacterInput()
      : inputs[playerId] ?? createIdlePlayerCharacterInput()
    const input = state.world.kind === 'hub'
      ? sealPlayerCombatInput(
          admittedInput,
          playerSkillBookAt(state.playerEntities, playerId)?.skillQuickbar ?? [],
        )
      : admittedInput
    const tutorial = state.world.kind === 'boneyard' ? state.world.tutorial : null
    const tutorialAccess = tutorial ? nativeTutorialHudAccess(tutorial) : null
    const gatedInput = tutorial
      ? {
          ...input,
          cast: {
            primary: tutorial.stage >= 2 && input.cast.primary,
            quickbar: tutorialAccess!.quickbar ? input.cast.quickbar : null,
          },
        }
      : input
    return [playerId, staffActionOwnerIds.has(playerId)
      ? {
          ...gatedInput,
          cast: { primary: false, quickbar: null },
          movement: { x: 0, y: 0 },
        }
      : gatedInput]
  }))
  switch (state.world.kind) {
    case 'hub': {
      const result = stepHubWorldTick(
        state.world,
        players,
        activeInputs,
        Object.fromEntries(Object.keys(players).map((playerId) => [
          playerId,
          playerEntityMovementScale(state.playerEntities, playerId),
        ])),
      )
      return finishGameSimulationTick(
        state,
        result,
        activeInputs,
        lightProviderOrder,
        null,
        options.extensions,
        options.attributionObserver,
      )
    }
    case 'boneyard': {
      let boneyardWorld = state.world
      let tutorialSpawnIntents: readonly BoneyardEnemySpawnIntent[] = []
      if (boneyardWorld.tutorial !== null) {
        const tutorialPlayerId = state.playerEntities.identities[0]?.playerId
        if (!tutorialPlayerId || state.playerEntities.identities.length !== 1) {
          throw new Error('the stock Tutorial requires exactly one authoritative player')
        }
        const tutorialPlayer = getPlayerCharacter(state, tutorialPlayerId)
        const tutorialProgression = getPlayerProgression(state, tutorialPlayerId)
        const tutorialEconomy = getPlayerEconomy(state, tutorialPlayerId)
        const tutorialSecondary = state.secondaryAbilities.players[tutorialPlayerId]
        const tutorial = stepNativeTutorial(boneyardWorld.tutorial, {
          acidRainCastSequence: tutorialSecondary?.castSequence ?? 0,
          acidRainLastSkillId: tutorialSecondary?.lastSkillId ?? null,
          currentHealth: tutorialProgression.currentHealth,
          enemyCount: boneyardWorld.enemies.actors.length + boneyardWorld.enemies.maggots.length,
          groundSackCount: boneyardWorld.loot.actors.filter(({ nativeTypeId }) => (
            nativeTypeId === 2013
          )).length,
          hasTopLevelNonPotionItem: tutorialEconomy.backpack.some(({ nativeTypeId }) => (
            nativeTypeId !== 7001
          )),
          healthPotionCount: countTutorialHealthPotions(tutorialEconomy.backpack),
          level: tutorialProgression.level,
          levelUpPending: state.levelUpBarrier !== null,
          maximumHealth: tutorialProgression.maximumHealth,
          playerActionIdle: !tutorialPlayer.primaryCast.held
            && (tutorialSecondary?.staffCastTicksRemaining ?? 0) === 0,
          playerPosition: tutorialPlayer.position,
          primaryCastSequence: tutorialPlayer.primaryCast.castSequence,
          solomonPhase: boneyardWorld.encounter?.phase ?? null,
          solomonRunEventId: boneyardWorld.encounter?.runEventId ?? 0,
          tick: state.tick + 1,
        })
        boneyardWorld = { ...boneyardWorld, tutorial: tutorial.state }
        state = { ...state, world: boneyardWorld }
        if (tutorial.forceOfferSkillIds !== null) {
          state = {
            ...state,
            playerEntities: forcePlayerEntitySkillOfferIds(
              state.playerEntities,
              tutorialPlayerId,
              tutorial.forceOfferSkillIds,
            ),
          }
        }
        if (tutorial.grantExperience > 0) {
          state = grantGameSimulationPlayerExperience(
            state,
            tutorialPlayerId,
            tutorial.grantExperience,
          )
          if (state.world.kind !== 'boneyard') {
            throw new Error('Tutorial experience changed the active world')
          }
          boneyardWorld = state.world
        }
        tutorialSpawnIntents = tutorial.spawnIntents
      }
      const deferredEnemyProjectileRegistrations = createDeferredNativeLightProviderRegistrations()
      const result = stepBoneyardWorldTick(
        boneyardWorld,
        players,
        activeInputs,
        Object.fromEntries(Object.keys(players).map((playerId) => {
          const progression = getPlayerProgression(state, playerId)
          const economy = getPlayerEconomy(state, playerId)
          const skillBook = getPlayerSkillBook(state, playerId)
          const derived = playerSkillDerivedStatsAt(state.playerEntities, playerId)
          if (derived === null) throw new Error(`player ${playerId} has no native skill runtime`)
          return [playerId, {
            alive: progression.lifeState === 'alive',
            collisionEnabled: playerCollisionEnabledAfterCombatTick(progression),
            eligible: state.run.eligiblePlayerIds.includes(playerId),
            inventoryHasHealthPotion: economyContainsHealthPotion(economy),
            level: progression.level,
            lootModifiers: nativeLootModifiers(economy.ownedPerkSelectors, {
              goldAmount: derived.goldAmountMultiplier,
              orbPull: derived.orbPullMultiplier,
              pickupFactor: derived.pickupRangeScalar,
            }),
            movementScale: playerEntityMovementScale(state.playerEntities, playerId),
            ownedRecipeIndexes: economyOwnedRecipeIndexes(economy),
            advancedUnlocks: skillBook.advancedUnlocks,
          }]
        })),
        state.tick + 1,
        lightProviderOrder.register,
        deferredEnemyProjectileRegistrations.register,
        state.secondaryAbilities.targetEffects
          .filter(({ worldKey }) => worldKey === `boneyard:${boneyardWorld.runId}`)
          .reduce<Record<number, NativeSecondaryTargetEffectState>>(
            (effects, effect) => {
              effects[effect.targetId] = effect
              return effects
            },
            {},
          ),
        state.secondaryAbilities.actors
          .filter((actor) => (
            actor.kind === 'golem'
            && actor.worldKey === `boneyard:${boneyardWorld.runId}`
          ))
          .map((actor) => ({
            collisionRadius: NATIVE_GOLEM_RADIUS,
            id: `golem:${actor.id}`,
            position: actor.position,
          })),
        [...tutorialSpawnIntents, ...(options.enemySpawnIntents ?? [])],
        options.extensions?.createLootItems,
      )
      return finishGameSimulationTick(
        state,
        result,
        activeInputs,
        lightProviderOrder,
        deferredEnemyProjectileRegistrations,
        options.extensions,
        options.attributionObserver,
      )
    }
  }
}

function finishGameSimulationTick(
  previous: GameSimulationState,
  result: {
    enemyEvents?: readonly BoneyardEnemySemanticEvent[]
    lootEvents?: readonly BoneyardLootEvent[]
    lootPickups?: readonly BoneyardLootPickup[]
    playerDamage?: readonly Readonly<{
      actorId: number
      amount: number
      coldSlowTicks: number
      damageKind: 'magic' | 'physical'
      dazzleTicks: number
      deflectable: boolean
      eventId: number
      playerId: string
      poisonDamage: number
      poisonDuration: number
    }>[]
    players: Readonly<Record<PlayerId, PlayerCharacterState>>
    rewards?: readonly BoneyardEnemyReward[]
    world: GameWorldState
  },
  inputs: PlayerCharacterInputs,
  lightProviderOrder: NativeLightProviderOrder,
  deferredEnemyProjectileRegistrations: DeferredNativeLightProviderRegistrations | null,
  extensions?: GameSimulationExtensions,
  attributionObserver?: BoneyardEnemyAttributionObserver,
): GameSimulationState {
  const tick = previous.tick + 1
  let resolvedPlayers = result.players
  let playerEntities = replacePlayerCharacterRecords(previous.playerEntities, resolvedPlayers)
  playerEntities = stepPlayerEntityOverlayLightingTick(playerEntities)
  let world = result.world
  const combatAdmissionEnabled = world.kind !== 'boneyard'
    || isBoneyardPlayerCombatEnabled(world.encounter)
  const combatInputs = combatAdmissionEnabled
    ? inputs
    : Object.fromEntries(Object.entries(inputs).map(([playerId, input]) => [
        playerId,
        sealPlayerCombatInput(
          input,
          playerSkillBookAt(playerEntities, playerId)?.skillQuickbar ?? [],
        ),
      ]))
  let gameRng = previous.gameRng
  let secondaryAbilities = previous.secondaryAbilities
  let levelUpBarrier = previous.levelUpBarrier
  let nextLevelUpBarrierId = previous.nextLevelUpBarrierId
  const unsteppedSecondaryActorIds = new Set<number>()
  const lethalObserver: BoneyardEnemyLethalObserver = {
    attributionObserver,
    onReward: ({ enemy, playerId }) => {
      if (world.kind !== 'boneyard' || playerId === null) return
      const run = world.hallOfFameRuns[playerId]
      const before = playerProgressionAt(playerEntities, playerId)
      if (run === undefined || before === null) return
      world = {
        ...world,
        hallOfFameRuns: {
          ...world.hallOfFameRuns,
          [playerId]: recordNativeHallOfFameAwesomestKill(run, {
            enemy,
            player: {
              currentHealth: before.currentHealth,
              level: before.level,
              maximumHealth: before.maximumHealth,
              scoreHealthMultiplierEnabled: before.lifeState === 'alive',
            },
            regionPulseAccumulator: world.enemyWorldFeedback.accumulator,
          }, (count) => {
            const draw = drawNativeInteger(gameRng, count)
            gameRng = draw.state
            return draw.value
          }),
        },
      }

      const after = playerProgressionAt(playerEntities, playerId)
      const currentRun = world.kind === 'boneyard'
        ? world.hallOfFameRuns[playerId]
        : undefined
      if (world.kind === 'boneyard' && after !== null && currentRun !== undefined) {
        world = {
          ...world,
          hallOfFameRuns: {
            ...world.hallOfFameRuns,
            [playerId]: recordNativeHallOfFameOrdinaryKill(
              currentRun,
              {
                currentHealth: after.currentHealth,
                level: after.level,
                maximumHealth: after.maximumHealth,
                scoreHealthMultiplierEnabled: after.lifeState === 'alive',
              },
              world.enemyWorldFeedback.accumulator,
            ),
          },
        }
      }
    },
  }
  const playerDamage = result.playerDamage ?? []
  const playerDamageSoundEvents: BoneyardEnemySemanticEvent[] = []
  const appliedPlayerDamage: (typeof playerDamage)[number][] = []
  const reflectedEnemyDamage: Array<Readonly<{
    actorId: number
    amount: number
    playerId: string
  }>> = []
  const deflectPitchesByEventId = new Map<number, number>()
  for (const damage of playerDamage) {
    if (world.kind === 'boneyard' && world.tutorial?.damageProtection) continue
    const golemId = parseNativeSecondaryGolemTargetId(damage.playerId)
    if (golemId !== null && world.kind === 'boneyard') {
      const golem = secondaryAbilities.actors.find(({ id, kind }) => (
        id === golemId && kind === 'golem'
      ))
      if (!golem) continue
      const damageSource = world.enemies.actors.find(({ id }) => id === damage.actorId)
        ?? world.enemies.maggots.find(({ id }) => id === damage.actorId)
      const sourceInReflectRange = damageSource !== undefined
        && squaredVectorDistance(damageSource.position, golem.position)
          < NATIVE_GOLEM_REFLECT_DISTANCE_SQUARED
      const received = applyNativeSecondaryGolemDamage(
        secondaryAbilities,
        golemId,
        {
          primaryDamage: damage.damageKind === 'physical' ? damage.amount : 0,
          reflectablePhysicalSourceInRange: damage.damageKind === 'physical'
            && sourceInReflectRange,
          secondaryDamage: damage.damageKind === 'magic' ? damage.amount : 0,
        },
        tick,
      )
      secondaryAbilities = received.state
      if (received.reflectedDamage > 0 && received.ownerId !== null) {
        reflectedEnemyDamage.push(Object.freeze({
          actorId: damage.actorId,
          amount: received.reflectedDamage,
          playerId: received.ownerId,
        }))
      }
      continue
    }
    const character = resolvedPlayers[damage.playerId]
    const damageSource = world.kind === 'boneyard'
      ? world.enemies.actors.find(({ id }) => id === damage.actorId)
        ?? world.enemies.maggots.find(({ id }) => id === damage.actorId)
      : undefined
    const runtime = playerSkillRuntimeAt(playerEntities, damage.playerId)
    const derived = playerSkillDerivedStatsAt(playerEntities, damage.playerId)
    const progression = playerProgressionAt(playerEntities, damage.playerId)
    const contact = runtime === null || derived === null || progression === null
      ? null
      : resolvePlayerHarmfulContact(
          runtime,
          derived,
          progression,
          damage.amount * derived.incomingDamageFactor,
          damage.damageKind,
          damage.deflectable,
          character !== undefined
            && damageSource !== undefined
            && playerDeflectReflectionSourceInRange(
              character.position,
              PLAYER_CHARACTER_RADIUS,
              damageSource.position,
              'config' in damageSource
                ? damageSource.config.collisionRadius
                : damageSource.collisionRadius,
            ),
          secondaryAbilities.rng,
        )
    if (contact !== null) secondaryAbilities = { ...secondaryAbilities, rng: contact.rng }
    if (contact !== null && contact.flash !== null && character !== undefined) {
      const worldKey = gameWorldKey(world, damage.playerId)
      const targetIds = world.kind === 'boneyard'
        ? boneyardNativeSecondaryTargets(
            world.enemies,
            character.position,
            NATIVE_FLASH_RESPONSE_RADIUS,
          ).map(({ id }) => id)
        : []
      secondaryAbilities = materializeNativePlayerFlashResponse(
        secondaryAbilities,
        {
          ownerId: damage.playerId,
          position: character.position,
          response: contact.flash,
          targetIds,
          tick,
          worldKey,
        },
      )
    }
    if (contact?.deflected) {
      if (contact.deflectPitch === null) {
        throw new Error('successful Deflect did not produce its native swipe pitch')
      }
      deflectPitchesByEventId.set(damage.eventId, contact.deflectPitch)
      if (character !== undefined && damageSource !== undefined) {
        resolvedPlayers = {
          ...resolvedPlayers,
          [damage.playerId]: {
            ...character,
            headingIndex: actorHeadingIndex(actorHeadingFromVector(
              damageSource.position.x - character.position.x,
              damageSource.position.y - character.position.y,
            )),
          },
        }
      }
      if (contact.reflectedDamage > 0) {
        reflectedEnemyDamage.push(Object.freeze({
          actorId: damage.actorId,
          amount: contact.reflectedDamage,
          playerId: damage.playerId,
        }))
      }
      continue
    }
    const resistedDamage = contact?.damage ?? damage.amount
    const intercepted = character === undefined
      ? { healthDamage: resistedDamage, state: secondaryAbilities }
      : applyNativeSecondaryPlayerDamage(
          secondaryAbilities,
          damage.playerId,
          resistedDamage,
          tick,
          character.position,
          gameWorldKey(world, damage.playerId),
        )
    secondaryAbilities = intercepted.state
    const filteredHealthDamage = extensions
      ? extensions.filterDamage({
          amount: intercepted.healthDamage,
          damageKind: damage.damageKind,
          sourceActorId: damage.actorId,
          targetPlayerId: damage.playerId,
          tick,
        })
      : intercepted.healthDamage
    if (!Number.isFinite(filteredHealthDamage) || filteredHealthDamage <= 0) continue
    const before = playerProgressionAt(playerEntities, damage.playerId)
    playerEntities = damagePlayerEntityWithResult(
      playerEntities,
      damage.playerId,
      filteredHealthDamage,
      tick,
      true,
    ).store
    const after = playerProgressionAt(playerEntities, damage.playerId)
    if (
      world.kind === 'boneyard'
      && before !== null
      && after !== null
      && after.currentHealth < before.currentHealth
      && after.lifeState === 'alive'
      && nativeWizardOuchCooldownReady(tick, world.playerOuchDeadlineTick)
    ) {
      const player = playerCharacterAt(playerEntities, damage.playerId)
      if (player !== null) {
        const emitted = emitBoneyardPlayerDamageSound(world.enemies, {
          actorId: damage.actorId,
          currentHealth: after.currentHealth,
          playerId: damage.playerId,
          position: player.position,
          tick,
        })
        playerDamageSoundEvents.push(emitted.event)
        world = {
          ...world,
          enemies: emitted.store,
          playerOuchDeadlineTick: tick + emitted.delayTicks,
        }
      }
    }
    playerEntities = poisonPlayerEntity(
      playerEntities,
      damage.playerId,
      damage.poisonDamage,
      derived === null
        ? damage.poisonDuration
        : playerPoisonDurationSeconds(derived, damage.poisonDuration),
    )
    appliedPlayerDamage.push({ ...damage, amount: intercepted.healthDamage })
  }
  for (const reward of result.rewards ?? []) {
    if (reward.playerId === null || playerEntityIndex(playerEntities, reward.playerId) < 0) continue
    const previousLevel = playerProgressionAt(playerEntities, reward.playerId)?.level
    const progressionState: GameSimulationState = {
      ...previous,
      gameRng,
      levelUpBarrier,
      nextLevelUpBarrierId,
      playerEntities,
      secondaryAbilities,
    }
    const participantIds = levelUpParticipantIds(progressionState)
    if (!participantIds.includes(reward.playerId)) continue
    const rewardDerived = playerSkillDerivedStatsAt(playerEntities, reward.playerId)
    const creditedExperience = boneyardEnemyExperienceAward({
      arenaPlayerCount: participantIds.length,
      evaluatedActorReward: reward.experience,
      receiverLevel: getPlayerProgression(progressionState, reward.playerId).level,
      receiverXpBonus: rewardDerived?.experienceBonus ?? 0,
    })
    attributionObserver?.onEnemyKillExperience({
      actorId: reward.actorId,
      amount: creditedExperience,
      enemyToken: reward.lootSource.enemyToken,
      playerId: reward.playerId,
    })
    const awarded = grantSharedGameSimulationExperience(
      progressionState,
      reward.playerId,
      creditedExperience,
    )
    playerEntities = awarded.playerEntities
    levelUpBarrier = awarded.levelUpBarrier
    nextLevelUpBarrierId = awarded.nextLevelUpBarrierId
    secondaryAbilities = awarded.secondaryAbilities
    gameRng = awarded.gameRng
    const level = playerProgressionAt(playerEntities, reward.playerId)?.level
    if (previousLevel !== undefined && level !== undefined && level > previousLevel) {
      const triggered = triggerMindblowingRing(
        playerEntities,
        secondaryAbilities,
        world,
        reward.playerId,
        level,
        tick,
        lightProviderOrder,
        lethalObserver,
      )
      secondaryAbilities = triggered.secondaryAbilities
      world = triggered.world
      for (const actorId of triggered.actorIds) unsteppedSecondaryActorIds.add(actorId)
    }
  }
  const bonusSkillChoicePlayerIds: string[] = []
  const lootTextOverrides = new Map<number, string>()
  for (const pickup of result.lootPickups ?? []) {
    if (playerEntityIndex(playerEntities, pickup.playerId) < 0) continue
    attributionObserver?.onLootPickup?.({
      amount: pickup.amount,
      bonusKind: pickup.bonusKind,
      itemKind: pickup.item?.kind ?? null,
      itemName: pickup.item?.name ?? null,
      itemQuantity: pickup.item?.quantity ?? null,
      kind: pickup.kind,
      orbKind: pickup.orbKind,
      playerId: pickup.playerId,
    })
    switch (pickup.kind) {
      case 'gold':
        playerEntities = creditPlayerEntityLootGold(
          playerEntities,
          pickup.playerId,
          pickup.amount,
        )
        break
      case 'sack':
        if (pickup.item !== null) {
          playerEntities = insertPlayerEntityLootItem(
            playerEntities,
            pickup.playerId,
            pickup.item,
          ).store
        }
        break
      case 'orb':
        if (pickup.orbKind === 'health') {
          playerEntities = restorePlayerEntityHealth(
            playerEntities,
            pickup.playerId,
            Math.fround(pickup.orbValue * 25),
          )
        } else if (pickup.orbKind === 'mana') {
          playerEntities = applyFilteredManaDelta(
            playerEntities,
            pickup.playerId,
            Math.fround(pickup.orbValue * 40),
            'stock-orb',
            tick,
            extensions,
          )
        }
        break
      case 'bonus':
        if (pickup.bonusKind === 0) {
          const beforeInsight = playerEntities
          playerEntities = grantPlayerEntityBonusSkillChoice(playerEntities, pickup.playerId)
          const insight = markNewCreativityInsights(
            beforeInsight,
            playerEntities,
            [pickup.playerId],
            secondaryAbilities.rng,
          )
          playerEntities = insight.store
          secondaryAbilities = { ...secondaryAbilities, rng: insight.rng }
          const automatic = assignAutomaticSkillChoices(
            playerEntities,
            [pickup.playerId],
            gameRng,
          )
          playerEntities = automatic.store
          gameRng = automatic.rng
          bonusSkillChoicePlayerIds.push(pickup.playerId)
        } else if (pickup.bonusKind === 1 && world.kind === 'boneyard') {
          const increased = increaseRandomPlayerEntitySkill(
            playerEntities,
            pickup.playerId,
            world.loot.sharedRng,
          )
          playerEntities = increased.store
          world = { ...world, loot: { ...world.loot, sharedRng: increased.rng } }
          if (increased.skillId !== null) {
            lootTextOverrides.set(
              pickup.actorId,
              `${NATIVE_SKILL_CATALOG[increased.skillId]?.name ?? `Skill ${increased.skillId}`} +1`,
            )
          }
        } else if (pickup.bonusKind === 2) {
          playerEntities = applyPlayerEntityPotionEffect(playerEntities, pickup.playerId, 2)
        }
        break
    }
  }
  if (bonusSkillChoicePlayerIds.length > 0 && levelUpBarrier === null) {
    const sourcePlayerId = bonusSkillChoicePlayerIds[0]!
    const sourceProgression = playerProgressionAt(playerEntities, sourcePlayerId)
    if (sourceProgression !== null) {
      const participantIds = stableExistingPlayerIds(
        playerEntities,
        previous.run.eligiblePlayerIds,
      )
      const pendingPlayerIds = pendingOfferPlayerIds(playerEntities, participantIds)
      levelUpBarrier = createLevelUpBarrier(
        nextLevelUpBarrierId,
        sourcePlayerId,
        sourceProgression.experience,
        sourceProgression.level,
        participantIds,
        pendingPlayerIds,
        world.kind === 'boneyard' ? world.runId : null,
      )
      nextLevelUpBarrierId += 1
    }
  }
  const boneyardCollision = result.world.kind === 'boneyard'
    ? withBoneyardGateCollision(result.world.collision, result.world.gateLeaves)
    : null
  const boneyardSpellBounds = result.world.kind === 'boneyard'
    ? result.world.arenaTransition === null
      ? result.world.bounds
      : boneyardActiveBounds(result.world.arenaTransition)
    : null
  const spellObstructionPoint = (
    playerId: string,
    start: Vector2,
    end: Vector2,
    excludedSourceId?: string,
  ): Vector2 | null => {
    if (result.world.kind === 'boneyard') {
      return firstBoneyardLineObstruction(
        start,
        end,
        boneyardSpellBounds!,
        boneyardCollision!,
        excludedSourceId,
      )
    }
    const region = result.world.participants[playerId]?.region
    return region === undefined
      ? null
      : firstHubRegionLineObstruction(region, start, end)
  }
  let spellsBeforePrimary = previous.primarySpells
  let staffActingPlayerIds: ReadonlySet<string> = new Set()
  let postStaffInputs = combatInputs
  if (world.kind === 'boneyard') {
    const staff = stepPlayerStaffCombatSystem({
      combatAdmissionEnabled,
      enemies: world.enemies,
      inputs: combatInputs,
      lethalObserver,
      knockbackTargetVisible: (origin, target) => {
        const blocked = firstBoneyardPathBlockProgress(
          origin,
          target,
          boneyardSpellBounds!,
          boneyardCollision!,
          0,
        )
        return blocked === null || blocked >= 1
      },
      playerEntities,
      players: resolvedPlayers,
      rng: secondaryAbilities.rng,
      spells: spellsBeforePrimary,
      tick,
      worldKey: `boneyard:${world.runId}`,
    })
    playerEntities = staff.playerEntities
    resolvedPlayers = staff.players
    secondaryAbilities = { ...secondaryAbilities, rng: staff.rng }
    spellsBeforePrimary = staff.spells
    staffActingPlayerIds = staff.actingPlayerIds
    world = {
      ...world,
      enemies: staff.enemies,
      enemyEvents: retainBoneyardEnemyEvents(world.enemyEvents, staff.events, tick),
    }
    if (staff.displacements.length > 0) {
      world = applyBoneyardSecondaryEnemyKnockbacks(
        world,
        resolvedPlayers,
        staff.displacements.map(({ actorId, delta }) => ({
          delta,
          sourceActorId: 0,
          targetId: actorId,
        })),
        Object.fromEntries(playerEntities.identities.map(({ playerId }, index) => [
          playerId,
          {
            alive: playerEntities.progressions[index]!.lifeState === 'alive',
            collisionEnabled: playerCollisionEnabledAfterCombatTick(
              playerEntities.progressions[index]!,
            ),
            eligible: previous.run.eligiblePlayerIds.includes(playerId),
            movementScale: playerEntityMovementScale(playerEntities, playerId),
          },
        ])),
      )
    }
    for (const perturbation of staff.headingPerturbations) {
      world = {
        ...world,
        enemies: applyBoneyardStaffHeadingPerturbation(
          world.enemies,
          perturbation.actorId,
          perturbation.headingDegrees,
        ),
      }
    }
    for (const dazzle of staff.dazzleRequests) {
      secondaryAbilities = applyNativeSecondaryDazzle(
        secondaryAbilities,
        `boneyard:${world.runId}`,
        dazzle.targetId,
        dazzle.durationTicks,
      )
    }
    for (const feedback of staff.pikeBreakFeedback) {
      secondaryAbilities = emitNativePlayerScreenFlash(secondaryAbilities, {
        ...feedback,
        screenFlash: {
          alpha: 1,
          blue: 1,
          decayPerTick: Math.fround(0.1),
          green: 1,
          pointAttenuated: false,
          red: 1,
        },
        tick,
      })
    }
    postStaffInputs = Object.fromEntries(Object.entries(combatInputs).map(([playerId, input]) => [
      playerId,
      staff.actingPlayerIds.has(playerId)
        ? { ...input, cast: { primary: false, quickbar: null } }
        : input,
    ]))
  }
  const unsteppedSecondaryActors = secondaryAbilities.actors.filter(({ id }) => (
    unsteppedSecondaryActorIds.has(id)
  ))
  for (const [playerId, input] of Object.entries(postStaffInputs)) {
    const slot = input.cast.quickbar
    if (slot === null) continue
    const skillBook = playerSkillBookAt(playerEntities, playerId)
    const skillId = skillBook?.skillQuickbar[slot] ?? null
    if (skillId !== null && nativeSkillCategory(skillId) === 1) {
      playerEntities = selectPlayerEntityPrimarySkill(playerEntities, playerId, skillId)
    } else if (skillId !== null && nativeSkillCategory(skillId) === 2) {
      playerEntities = failPlayerEntityBoast(playerEntities, playerId, 'secondary-cast')
    }
  }
  const secondaryResult = stepNativeSecondaryAbilities({
    ...secondaryAbilities,
    actors: secondaryAbilities.actors.filter(({ id }) => !unsteppedSecondaryActorIds.has(id)),
  }, {
    dampenCandidates: (worldKey, origin) => (
      world.kind === 'boneyard'
      && worldKey === `boneyard:${world.runId}`
        ? boneyardNativeSecondaryDampenCandidates(world.enemies, origin)
        : { casterTargetIds: [], projectileIds: [], shieldTargetIds: [] }
    ),
    effectPositionBlocked: (worldKey, position) => {
      if (
        world.kind === 'boneyard'
        && worldKey === `boneyard:${world.runId}`
      ) {
        return !canPlaceBoneyardBody(
          position,
          world.bounds,
          boneyardCollision!,
          0,
        )
      }
      if (world.kind !== 'hub') return false
      const region = Object.values(world.participants)
        .find((participant) => `hub:${participant.region}` === worldKey)?.region
      return region === undefined || !isHubRegionTraversable(region, position, 0)
    },
    golemFootPlacement: (playerId, worldKey, currentPosition, requestedPosition) => {
      if (
        world.kind === 'boneyard'
        && worldKey === `boneyard:${world.runId}`
      ) {
        return resolveBoneyardMovement(
          currentPosition,
          requestedPosition,
          world.bounds,
          boneyardCollision!,
          0,
        )
      }
      if (world.kind !== 'hub') return currentPosition
      const region = world.participants[playerId]?.region
      return region !== undefined && isHubRegionTraversable(region, requestedPosition, 0)
        ? requestedPosition
        : currentPosition
    },
    golemMovement: (playerId, worldKey, origin, requestedPosition, radius) => {
      if (
        world.kind === 'boneyard'
        && worldKey === `boneyard:${world.runId}`
      ) {
        return resolveBoneyardMovement(
          origin,
          requestedPosition,
          world.bounds,
          boneyardCollision!,
          radius,
        )
      }
      if (world.kind !== 'hub') return origin
      const region = world.participants[playerId]?.region
      return region !== undefined && isHubRegionTraversable(
        region,
        requestedPosition,
        radius,
      ) ? requestedPosition : origin
    },
    golemPlacement: (playerId, worldKey, requestedPosition, rng) => {
      if (
        world.kind === 'boneyard'
        && worldKey === `boneyard:${world.runId}`
      ) {
        const boneyardWorld = world
        return resolveNativeCollisionAdjustedPosition(
          rng,
          requestedPosition,
          NATIVE_GOLEM_PLACEMENT_RADIUS,
          (position) => canPlaceBoneyardBody(
            position,
            boneyardWorld.bounds,
            boneyardCollision!,
            NATIVE_GOLEM_PLACEMENT_RADIUS,
          ),
        )
      }
      if (world.kind !== 'hub') {
        return { position: requestedPosition, rng }
      }
      const region = world.participants[playerId]?.region
      if (region === undefined || worldKey !== `hub:${region}`) {
        return { position: requestedPosition, rng }
      }
      return resolveNativeCollisionAdjustedPosition(
        rng,
        requestedPosition,
        NATIVE_GOLEM_PLACEMENT_RADIUS,
        (position) => isHubRegionTraversable(
          region,
          position,
          NATIVE_GOLEM_PLACEMENT_RADIUS,
        ),
      )
    },
    phasingDestination: (playerId, origin, direction) => {
      for (let distance = 80; distance <= 270; distance += 10) {
        const candidate = {
          x: origin.x + direction.x * distance,
          y: origin.y + direction.y * distance,
        }
        if (world.kind === 'boneyard') {
          if (canPlaceBoneyardBody(
            candidate,
            world.bounds,
            boneyardCollision!,
            PLAYER_CHARACTER_RADIUS,
          )) return candidate
          continue
        }
        const region = world.participants[playerId]?.region
        if (region !== undefined && isHubRegionTraversable(
          region,
          candidate,
          PLAYER_CHARACTER_RADIUS,
        )) return candidate
      }
      return null
    },
    lineObstruction: (worldKey, start, end) => (
      world.kind === 'boneyard'
      && worldKey === `boneyard:${world.runId}`
      && firstBoneyardLineObstruction(
        start,
        end,
        world.bounds,
        boneyardCollision!,
      ) !== null
    ),
    players: Object.fromEntries(playerEntities.identities.map(({ playerId }, index) => {
      const character = resolvedPlayers[playerId]
      const progression = playerEntities.progressions[index]!
      const skillBook = playerEntities.skillBooks[index]!
      const statBook = playerEntities.statBooks[index]!
      const runtime = playerEntities.skillRuntimes[index]!
      const derived = playerSkillDerivedStatsAt(playerEntities, playerId)
      if (!character) throw new Error(`secondary authority lost player ${playerId}`)
      if (derived === null) throw new Error(`secondary authority lost skill state ${playerId}`)
      const offensiveFactors = {
        damage: derived.offensiveDamageFactor,
        equipment: runtime.equipmentModifiers,
        globalFlatDamage: derived.offensiveDamageFlat,
        globalManaReduction: derived.offensiveManaCostReduction,
        manaCost: derived.offensiveManaCostFactor,
      }
      return [playerId, {
        character,
        coldSlowFactor: Math.fround(Math.max(0, 0.5 / (
          1 + effectiveSkillNumericValue(skillBook, statBook, 39, 'mSlowdown') / 100
        ))),
        currentMana: progression.currentMana,
        eligible: playerEntityCanCast(playerEntities, playerId)
          && progression.pendingOffer === null,
        enhancedEffects: true,
        explosiveShieldDamage: effectiveSkillNumericValue(
          skillBook,
          statBook,
          54,
          'mAbsorb',
        ) * effectiveSkillNumericValue(skillBook, statBook, 55, 'mDamage') / 100,
        explosiveShieldRawManaCost: rankedSkillNumericValue(
          skillBook,
          statBook,
          55,
          'mManaCost',
        ),
        fireBurnDamage: resolveNativeSkillDamageValue(
          22,
          effectiveSkillNumericValue(skillBook, statBook, 22, 'mDamage'),
          offensiveFactors,
        ),
        focusInstantRechargeChancePercent: derived.focusInstantRechargeChancePercent,
        freezeDurationMultiplier: 1 + effectiveSkillNumericValue(
          skillBook,
          statBook,
          39,
          'mSlowdown',
        ) / 100,
        golemIron: (skillBook.effectiveRanks[75] ?? 0) > 0,
        golemRawManaCost: rankedSkillNumericValue(
          skillBook,
          statBook,
          75,
          'mManaCost',
        ),
        golemReflectFactor: effectiveSkillNumericValue(skillBook, statBook, 75, 'mReflect') / 100,
        input: postStaffInputs[playerId] ?? createIdlePlayerCharacterInput(),
        maximumMana: progression.maximumMana,
        magicStormDurationBonusTicks: Math.trunc(effectiveSkillNumericValue(
          skillBook,
          statBook,
          28,
          'mDuration',
        ) * 100),
        magicStormFrequencyFactor: 1 + effectiveSkillNumericValue(
          skillBook,
          statBook,
          28,
          'mSpeed',
        ) / 100,
        magicStormRawManaCost: rankedSkillNumericValue(
          skillBook,
          statBook,
          28,
          'mManaCost',
        ),
        maximumGolem: nativeEquipmentHasFeature(runtime.equipmentModifiers, 'maximumGolem'),
        maximumLeviathan: nativeEquipmentHasFeature(
          runtime.equipmentModifiers,
          'maximumLeviathan',
        ),
        maximumMagicStorm: nativeEquipmentHasFeature(
          runtime.equipmentModifiers,
          'maximumMagicStorm',
        ),
        maximumRingOfFire: nativeEquipmentHasFeature(
          runtime.equipmentModifiers,
          'maximumRingOfFire',
        ),
        maximumRingOfIce: nativeEquipmentHasFeature(
          runtime.equipmentModifiers,
          'maximumRingOfIce',
        ),
        manaRecoveryPerTick: derived.manaRecoveryPerTick,
        offensiveFactors,
        secondaryRechargeFactor: derived.secondaryRechargeFactor,
        skillBook,
        worldKey: gameWorldKey(world, playerId),
      }]
    })),
    registerLightProvider: lightProviderOrder.register,
    sceneryTargets: (worldKey, center, radius) => (
      world.kind === 'boneyard'
      && worldKey === `boneyard:${world.runId}`
        ? world.earthquakeSceneryTargets.filter((target) => {
            const x = target.position.x - center.x
            const y = target.position.y - center.y
            return x * x + y * y < radius * radius
          })
        : []
    ),
    teleportDestination: (_playerId, rng) => {
      if (world.kind === 'boneyard') {
        const boneyardWorld = world
        const worldKey = `boneyard:${boneyardWorld.runId}`
        const bodies = [
          ...Object.values(resolvedPlayers).map(({ position }) => ({
            position,
            radius: PLAYER_CHARACTER_RADIUS,
          })),
          ...boneyardWorld.enemies.actors.flatMap((actor) => (
            actor.lifeState === 'alive'
              ? [{
                  position: actor.position,
                  radius: actor.config.collisionRadius,
                }]
              : []
          )),
          ...boneyardWorld.enemies.maggots.flatMap((actor) => (
            actor.lifeState === 'alive'
              ? [{ position: actor.position, radius: actor.collisionRadius }]
              : []
          )),
          ...secondaryAbilities.actors.flatMap((actor) => (
            actor.kind === 'golem'
            && actor.worldKey === worldKey
              ? [{ position: actor.position, radius: actor.radius }]
              : []
          )),
        ]
        return resolveBoneyardNativeTeleport(rng, {
          bodies,
          bounds: boneyardWorld.bounds,
          collision: boneyardCollision!,
        })
      }
      return { position: { x: 0, y: 0 }, rng }
    },
    target: (worldKey, targetId) => (
      world.kind === 'boneyard'
      && worldKey === `boneyard:${world.runId}`
        ? boneyardNativeSecondaryTarget(world.enemies, targetId)
        : null
    ),
    targets: (worldKey, center, radius) => (
      world.kind === 'boneyard'
      && worldKey === `boneyard:${world.runId}`
        ? boneyardNativeSecondaryTargets(world.enemies, center, radius)
        : []
    ),
    tick,
  })
  secondaryAbilities = unsteppedSecondaryActors.length === 0
    ? secondaryResult.state
    : {
        ...secondaryResult.state,
        actors: Object.freeze([
          ...secondaryResult.state.actors,
          ...unsteppedSecondaryActors,
        ].sort((left, right) => left.id - right.id)),
      }
  const secondaryPlayers: Record<PlayerId, PlayerCharacterState> = {
    ...resolvedPlayers,
  }
  for (const [playerId, position] of Object.entries(secondaryResult.relocatedPlayers)) {
    const character = secondaryPlayers[playerId]
    if (!character) continue
    secondaryPlayers[playerId] = { ...character, position: { ...position } }
    playerEntities = replacePlayerCharacter(
      playerEntities,
      playerId,
      secondaryPlayers[playerId],
    )
  }
  for (const [playerId, headingIndex] of Object.entries(
    secondaryResult.facingHeadingIndexes,
  )) {
    const character = secondaryPlayers[playerId]
    if (!character) continue
    secondaryPlayers[playerId] = { ...character, headingIndex }
    playerEntities = replacePlayerCharacter(
      playerEntities,
      playerId,
      secondaryPlayers[playerId],
    )
  }
  for (const [playerId, amount] of Object.entries(secondaryResult.manaRecovered)) {
    playerEntities = restorePlayerEntityMana(playerEntities, playerId, amount)
  }
  for (const [playerId, amount] of Object.entries(secondaryResult.healthRecovered)) {
    playerEntities = restorePlayerEntityHealth(playerEntities, playerId, amount)
  }
  for (const [playerId, cost] of Object.entries(secondaryResult.manaSpent)) {
    if (cost <= 0) continue
    playerEntities = applyFilteredManaDelta(
      playerEntities,
      playerId,
      -cost,
      'secondary-cast',
      tick,
      extensions,
      `secondary ability mana authority diverged for ${playerId}`,
    )
  }
  for (const playerId of secondaryResult.manaUnderflowPlayerIds) {
    playerEntities = failPlayerEntityBoast(playerEntities, playerId, 'mana-underflow')
  }
  for (const playerId of secondaryResult.overloadedPlayerIds) {
    const progression = playerProgressionAt(playerEntities, playerId)
    if (progression) {
      playerEntities = applyFilteredManaDelta(
        playerEntities,
        playerId,
        -progression.currentMana,
        'overload',
        tick,
        extensions,
      )
    }
  }
  for (const { playerId } of playerEntities.identities) {
    const wasActive = previous.secondaryAbilities.players[playerId]?.mindstar ?? false
    const isActive = secondaryAbilities.players[playerId]?.mindstar ?? false
    if (wasActive !== isActive) {
      playerEntities = setPlayerEntityMindstar(playerEntities, playerId, isActive)
    }
  }
  const primaryOverridePlayerIds = new Set(secondaryResult.primaryOverridePlayerIds)
  const primaryInputs = Object.fromEntries(Object.entries(postStaffInputs).map(([playerId, input]) => [
    playerId,
    primaryOverridePlayerIds.has(playerId)
      || (secondaryAbilities.players[playerId]?.staffCastTicksRemaining ?? 0) > 0
      || (secondaryAbilities.players[playerId]?.castSpinTicksRemaining ?? 0) > 0
      ? { ...input, cast: { ...input.cast, primary: false } }
      : input,
  ]))
  const cast = stepPrimarySpells({
    canPlaceProjectile: (spell, position, radius) => {
      if (result.world.kind === 'boneyard') {
        return canPlaceBoneyardBody(
          position,
          boneyardSpellBounds!,
          boneyardCollision!,
          radius,
        )
      }
      const region = result.world.participants[spell.ownerId]?.region
      return region !== undefined && isHubRegionTraversable(region, position, radius)
    },
    canTraverseProjectile: (spell, from, to, radius = 0, nativeExclusionMask = 0) => {
      if (result.world.kind === 'boneyard') {
        return radius > 0
          ? firstBoneyardPathBlockProgress(
              from,
              to,
              boneyardSpellBounds!,
              boneyardCollision!,
              radius,
            ) === null
          : firstBoneyardLineObstruction(
              from,
              to,
              boneyardSpellBounds!,
              boneyardCollision!,
              undefined,
              nativeExclusionMask,
            ) === null
      }
      const region = result.world.participants[spell.ownerId]?.region
      if (region === undefined) return false
      return radius > 0
        ? isHubRegionPathTraversable(region, from, to, radius)
        : firstHubRegionLineObstruction(region, from, to) === null
    },
    castAuthority: Object.fromEntries(playerEntities.identities.map(({ playerId }, index) => {
      const progression = playerEntities.progressions[index]!
      const derived = playerSkillDerivedStatsAt(playerEntities, playerId)
      const runtime = playerSkillRuntimeAt(playerEntities, playerId)
      if (derived === null || runtime === null) {
        throw new Error(`player ${playerId} has no native skill runtime`)
      }
      const primarySkill = nativePrimarySkillProfile(
        playerEntities.skillBooks[index]!,
        playerEntities.statBooks[index]!,
        {
          damage: derived.offensiveDamageFactor,
          equipment: runtime.equipmentModifiers,
          globalFlatDamage: derived.offensiveDamageFlat,
          globalManaReduction: derived.offensiveManaCostReduction,
          manaCost: derived.offensiveManaCostFactor,
        },
      )
      return [
        playerId,
        {
          alive: progression.lifeState === 'alive',
          availableMana: nativeSecondaryAvailableMana(
            progression.currentMana,
            secondaryAbilities.players[playerId]
              ?? createNativeSecondaryPlayerState(),
          ),
          castProgressFactor: derived.castProgressFactor,
          eligible: playerEntityCanCast(playerEntities, playerId)
            && progression.pendingOffer === null,
          planeActive: (
            secondaryAbilities.players[playerId]?.planewalkerTicksRemaining ?? 0
          ) > 0,
          primarySkill,
        },
      ]
    })),
    inputs: primaryInputs,
    players: secondaryPlayers,
    previousPlayers: playerCharacterRecords(previous.playerEntities),
    registerLightProvider: lightProviderOrder.register,
    rng: previous.combatRng,
    spells: spellsBeforePrimary,
    tick,
    viewScale: result.world.kind === 'hub' ? HUB_CAMERA_SCALE : 1.35,
    spellObstructionPoint,
    spellRangeEndpoint: (playerId, start, direction) => {
      const bounds = result.world.kind === 'boneyard'
        ? boneyardSpellBounds!
        : (() => {
            const region = result.world.participants[playerId]?.region
            if (region === undefined) return { x: start.x, y: start.y, w: 0, h: 0 }
            const definition = HUB_REGION_DEFINITIONS[region]
            return { x: 0, y: 0, w: definition.width, h: definition.height }
          })()
      const length = 2 * Math.hypot(bounds.w, bounds.h)
      const far = {
        x: start.x + direction.x * length,
        y: start.y + direction.y * length,
      }
      return lineBoundsExitObstruction(start, far, bounds)?.point ?? far
    },
    spellTargets: () => result.world.kind === 'boneyard'
      ? boneyardPrimarySpellTargets(result.world)
      : [],
    worldKeyForPlayer: (playerId) => result.world.kind === 'hub'
      ? `hub:${result.world.participants[playerId]?.region ?? 'courtyard'}`
      : `boneyard:${result.world.runId}`,
  })
  for (const playerId of cast.manaUnderflowPlayerIds) {
    playerEntities = failPlayerEntityBoast(playerEntities, playerId, 'mana-underflow')
  }
  for (const [playerId, cost] of Object.entries(cast.manaSpent)) {
    if (cost <= 0) continue
    playerEntities = applyFilteredManaDelta(
      playerEntities,
      playerId,
      -cost,
      'primary-cast',
      tick,
      extensions,
      `primary spell mana authority diverged for ${playerId}`,
    )
  }
  deferredEnemyProjectileRegistrations?.commit(lightProviderOrder)
  const hurricaneVisuals = synchronizeAirWaterPlayerVisualActors(
    cast.spells,
    playerEntities.identities.flatMap(({ playerId }, index) => {
      const player = cast.players[playerId]
      const runtime = playerEntities.skillRuntimes[index]
      const skillBook = playerEntities.skillBooks[index]
      const statBook = playerEntities.statBooks[index]
      const derived = playerSkillDerivedStatsAt(playerEntities, playerId)
      if (!player || !runtime || !skillBook || !statBook || !derived) return []
      const hurricane = nativeHurricaneChargeTick(
        runtime.hurricaneCharge,
        runtime.hurricaneRefreshed,
        runtime.hurricaneEnabled,
        player.primaryCast.channelActive
          && skillBook.primarySkillId === 24
          && !player.primaryCast.underpowered,
      )
      return [{
        hurricaneCharge: hurricane.nextCharge,
        hurricaneContactCharge: hurricane.contactCharge,
        hurricaneDamageMaximum: resolveNativeSkillDamageValue(
          29,
          effectiveSkillNumericValue(skillBook, statBook, 29, 'mDamage2'),
          {
            damage: derived.offensiveDamageFactor,
            equipment: runtime.equipmentModifiers,
            globalFlatDamage: derived.offensiveDamageFlat,
            globalManaReduction: derived.offensiveManaCostReduction,
            manaCost: derived.offensiveManaCostFactor,
          },
        ),
        hurricaneDamageMinimum: resolveNativeSkillDamageValue(
          29,
          effectiveSkillNumericValue(skillBook, statBook, 29, 'mDamage1'),
          {
            damage: derived.offensiveDamageFactor,
            equipment: runtime.equipmentModifiers,
            globalFlatDamage: derived.offensiveDamageFlat,
            globalManaReduction: derived.offensiveManaCostReduction,
            manaCost: derived.offensiveManaCostFactor,
          },
        ),
        ownerId: playerId,
        position: player.position,
        worldKey: result.world.kind === 'hub'
          ? `hub:${result.world.participants[playerId]?.region ?? 'courtyard'}`
          : `boneyard:${result.world.runId}`,
      }]
    }),
    tick,
    cast.rng,
  )
  let primarySpells = hurricaneVisuals.spells
  let combatRng = hurricaneVisuals.rng
  if (world.kind === 'boneyard') {
    const previousEvents = world.enemyEvents
    const previousLootEvents = previous.world.kind === 'boneyard'
      && previous.world.runId === world.runId
      ? previous.world.lootEvents
      : []
    const resolvedEnemyEvents = (result.enemyEvents ?? []).map((event) => {
      const deflectPitch = deflectPitchesByEventId.get(event.eventId)
      return deflectPitch === undefined
        ? event
        : Object.freeze({ ...event, deflectPitch })
    })
    world = {
      ...world,
      enemyEvents: retainBoneyardEnemyEvents(
        previousEvents,
        [...resolvedEnemyEvents, ...playerDamageSoundEvents],
        tick,
      ),
      lootEvents: retainBoneyardLootEvents(
        previousLootEvents,
        (result.lootEvents ?? []).map((event) => {
          const text = lootTextOverrides.get(event.actorId)
          return text === undefined || event.type !== 'loot-pickup'
            ? event
            : { ...event, text }
        }),
        tick,
      ),
    }
    for (const reflection of reflectedEnemyDamage) {
      const reflected = damageBoneyardEnemy(world.enemies, {
        actorId: reflection.actorId,
        amount: reflection.amount,
        lethalObserver,
        sourcePlayerId: reflection.playerId,
        tick,
      })
      if (reflected.accepted) {
        world = {
          ...world,
          enemies: reflected.store,
          enemyEvents: retainBoneyardEnemyEvents(
            world.enemyEvents,
            reflected.events,
            tick,
          ),
        }
      }
    }
    const secondaryCombat = resolveBoneyardNativeSecondaryCombat(
      world.enemies,
      secondaryResult,
      tick,
      lethalObserver,
      (targetId, ownerId) => {
        const nativeTypeId = world.kind === 'boneyard'
          ? world.enemies.actors.find(({ id }) => id === targetId)?.config.nativeTypeId
          : undefined
        const economy = playerEconomyAt(playerEntities, ownerId)
        return nativeTypeId === undefined || economy === null
          ? 1
          : nativeHagathaBossDamageFactor(economy.ownedPerkSelectors, nativeTypeId)
      },
    )
    world = {
      ...world,
      enemies: secondaryCombat.enemies,
      enemyEvents: retainBoneyardEnemyEvents(
        world.enemyEvents,
        secondaryCombat.events,
        tick,
      ),
    }
    world = applyBoneyardSecondaryEnemyKnockbacks(
      world,
      secondaryPlayers,
      secondaryResult.knockbacks.map((knockback) => {
        const ownerId = secondaryAbilities.actors.find(({ id }) => (
          id === knockback.sourceActorId
        ))?.ownerId ?? previous.secondaryAbilities.actors.find(({ id }) => (
          id === knockback.sourceActorId
        ))?.ownerId
        const pushStrengthFactor = ownerId === undefined
          ? 1
          : playerSkillDerivedStatsAt(playerEntities, ownerId)?.pushStrengthFactor ?? 1
        return pushStrengthFactor === 1
          ? knockback
          : {
              ...knockback,
              delta: {
                x: Math.fround(knockback.delta.x * pushStrengthFactor),
                y: Math.fround(knockback.delta.y * pushStrengthFactor),
              },
            }
      }),
      Object.fromEntries(playerEntities.identities.map(({ playerId }, index) => [
        playerId,
        {
          alive: playerEntities.progressions[index]!.lifeState === 'alive',
          collisionEnabled: playerCollisionEnabledAfterCombatTick(
            playerEntities.progressions[index]!,
          ),
          eligible: previous.run.eligiblePlayerIds.includes(playerId),
          movementScale: playerEntityMovementScale(playerEntities, playerId),
        },
      ])),
    )
    const boneyardWorld = world
    const collision = withBoneyardGateCollision(
      boneyardWorld.collision,
      boneyardWorld.gateLeaves,
    )
    const spellCombat = resolveBoneyardSpellCombat(
      boneyardWorld.enemies,
      primarySpells,
      cast.channelEmissions,
      tick,
      `boneyard:${boneyardWorld.runId}`,
      combatRng,
      (start, end, radius) => firstBoneyardPathBlockProgress(
        start,
        end,
        boneyardWorld.bounds,
        collision,
        radius,
      ),
      lightProviderOrder.register,
      (targetId, kind, ownerId) => {
        const prismatic = kind === 'air'
          && (nativeSecondaryTargetEffect(
            secondaryAbilities,
            `boneyard:${boneyardWorld.runId}`,
            targetId,
          )?.prismaticTicks ?? 0) > 0
          ? 2
          : 1
        const nativeTypeId = boneyardWorld.enemies.actors.find(({ id }) => (
          id === targetId
        ))?.config.nativeTypeId
        const economy = playerEconomyAt(playerEntities, ownerId)
        return prismatic * (nativeTypeId === undefined || economy === null
          ? 1
          : nativeHagathaBossDamageFactor(economy.ownedPerkSelectors, nativeTypeId))
      },
      boneyardWorld.primarySceneryTargets,
      lethalObserver,
      cast.fireActorContacts,
      (_actorId, start, requested, radius) => resolveBoneyardMovement(
        start,
        requested,
        boneyardWorld.bounds,
        collision,
        radius,
      ),
      secondaryResult.steamedPulses,
      (ownerId) => primaryInputs[ownerId]?.viewportWidth
        ?? NATIVE_GAMEPLAY_VIEWPORT_WIDTH,
      (ownerId) => playerSkillDerivedStatsAt(
        playerEntities,
        ownerId,
      )?.pushStrengthFactor ?? 1,
    )
    combatRng = spellCombat.rng
    primarySpells = spellCombat.spells
    world = {
      ...world,
      enemies: spellCombat.enemies,
      enemyEvents: retainBoneyardEnemyEvents(
        world.enemyEvents,
        spellCombat.events,
        tick,
      ),
    }
    for (const burn of spellCombat.burns) {
      const target = boneyardNativeSecondaryTarget(world.enemies, burn.targetId)
      const ownerIndex = playerEntityIndex(playerEntities, burn.ownerId)
      if (target === null || ownerIndex < 0) continue
      secondaryAbilities = applyNativeSecondaryFireBurn(secondaryAbilities, {
        damage: burn.damage,
        ownerId: burn.ownerId,
        rank: Math.max(1, playerEntities.skillBooks[ownerIndex]!.effectiveRanks[22] ?? 0),
        skillId: 22,
        target,
        worldKey: `boneyard:${boneyardWorld.runId}`,
      })
    }
    for (const burn of spellCombat.etherBurns) {
      const target = boneyardNativeSecondaryTarget(world.enemies, burn.targetId)
      const ownerIndex = playerEntityIndex(playerEntities, burn.ownerId)
      if (target === null || ownerIndex < 0) continue
      secondaryAbilities = applyNativeSecondaryEtherBurn(secondaryAbilities, {
        ownerId: burn.ownerId,
        rank: Math.max(1, playerEntities.skillBooks[ownerIndex]!.effectiveRanks[14] ?? 0),
        target,
        worldKey: `boneyard:${boneyardWorld.runId}`,
      })
    }
    for (const effect of spellCombat.targetEffects) {
      secondaryAbilities = applyNativeSecondaryTargetEffect(
        secondaryAbilities,
        effect.worldKey,
        effect.targetId,
        effect.patch,
      )
    }
  }
  const players: Record<PlayerId, PlayerCharacterState> = { ...cast.players }
  if (tick % PLAYER_CHARACTER_FOOTSTEP_TICK_INTERVAL === 0) {
    for (const [playerId, player] of Object.entries(cast.players)) {
      const priorPlayer = playerCharacterAt(previous.playerEntities, playerId)
      players[playerId] = priorPlayer
        && priorPlayer.walkCyclePrimary !== player.walkCyclePrimary
        ? { ...player, footstepTick: tick }
        : player
    }
  }
  for (const playerId of secondaryResult.staffCastPulsePlayerIds) {
    const player = players[playerId]
    if (!player) continue
    players[playerId] = {
      ...player,
      primaryCast: {
        ...player.primaryCast,
        weaponPulse: NATIVE_PLAYER_STAFF_CAST_TWO_OVERLAY,
      },
    }
  }
  playerEntities = replacePlayerCharacterRecords(playerEntities, players)
  const combat = stepPlayerEntityCombatTick(
    playerEntities,
    staffActingPlayerIds,
    playerCombatMutations(extensions, tick),
  )
  playerEntities = combat.store
  if (world.kind === 'boneyard') {
    for (const playerId of combat.lastWordBurstPlayerIds) {
      const triggered = triggerHagathaLastWord(
        playerEntities,
        secondaryAbilities,
        world,
        playerId,
        tick,
        lightProviderOrder,
        lethalObserver,
      )
      secondaryAbilities = triggered.secondaryAbilities
      world = triggered.world
    }
    for (const playerId of combat.lastWordArchivePlayerIds) {
      const archived = archiveHagathaLastWordGroundLoot(
        playerEntities,
        world,
        playerId,
        gameRng,
      )
      playerEntities = archived.playerEntities
      gameRng = archived.rng
      world = archived.world
    }
  }
  for (const playerId of combat.deathBurstPlayerIds) {
    secondaryAbilities = removeNativeSecondaryOwner(secondaryAbilities, playerId)
    playerEntities = setPlayerEntityMindstar(playerEntities, playerId, false)
  }
  for (const playerId of combat.completedDeathPresentationPlayerIds) {
    playerEntities = setPlayerEntitySpectating(playerEntities, playerId)
  }
  for (const damage of appliedPlayerDamage) {
    playerEntities = coldSlowPlayerEntity(
      playerEntities,
      damage.playerId,
      damage.coldSlowTicks,
    )
    playerEntities = dazzlePlayerEntity(
      playerEntities,
      damage.playerId,
      damage.dazzleTicks,
    )
  }
  if (
    previous.world.kind === 'boneyard'
    && world.kind === 'boneyard'
    && completedBoneyardWaveBoundary(previous.world, world)
  ) {
    if (world.waves !== null && world.waves.waveOrdinal >= NATIVE_BOAST_SUCCESS_WAVE) {
      for (const playerId of previous.run.eligiblePlayerIds) {
        if (playerProgressionAt(playerEntities, playerId)?.lifeState === 'alive') {
          playerEntities = succeedPlayerEntityBoast(playerEntities, playerId)
        }
      }
    }
    for (const playerId of previous.run.eligiblePlayerIds) {
      playerEntities = respawnPlayerEntityAt(
        playerEntities,
        playerId,
        world.spawn,
      ).store
    }
  }
  const alivePlayerIds = new Set(playerEntities.identities.flatMap(({ playerId }, index) => (
    playerEntities.progressions[index]!.lifeState === 'alive'
      || playerEntities.progressions[index]!.lifeState === 'lethal-pending'
      ? [playerId]
      : []
  )))
  return {
    accumulatorSeconds: previous.accumulatorSeconds,
    combatRng,
    hallOfFameClockStartedAtTick: previous.hallOfFameClockStartedAtTick,
    levelUpBarrier,
    lightProviderOrder: lightProviderOrder.state(),
    modEffects: previous.modEffects,
    nextLevelUpBarrierId,
    nextModConsumableUseId: previous.nextModConsumableUseId,
    playerEntities,
    gameRng,
    primarySpells,
    secondaryAbilities,
    run: stepGameRunLifecycle(previous.run, alivePlayerIds),
    tick,
    world,
  }
}

function gameWorldKey(world: GameWorldState, playerId: string): string {
  return world.kind === 'hub'
    ? `hub:${world.participants[playerId]?.region ?? 'courtyard'}`
    : `boneyard:${world.runId}`
}

function completedBoneyardWaveBoundary(
  previous: BoneyardWorldState,
  next: BoneyardWorldState,
): boolean {
  return previous.runId === next.runId
    && previous.waves !== null
    && next.waves !== null
    && next.waves.waveOrdinal > 0
    && previous.waves.phase === 'wave-threshold'
    && next.waves.phase === 'wave-lull-delay'
}

function playerCombatMutations(
  extensions: GameSimulationExtensions | undefined,
  tick: number,
): Readonly<{
  filterMana?: (playerId: string, delta: number, current: number, maximum: number) => number
  filterPoisonDamage?: (playerId: string, amount: number) => number
}> {
  if (!extensions) return {}
  return {
    filterMana: (playerId, delta, currentMana, maximumMana) => filterManaDelta(
      extensions,
      tick,
      playerId,
      currentMana,
      maximumMana,
      delta,
      'passive-recovery',
    ),
    filterPoisonDamage: (targetPlayerId, amount) => {
      const filtered = extensions.filterDamage({
        amount,
        damageKind: 'poison',
        sourceActorId: null,
        targetPlayerId,
        tick,
      })
      return finiteModMutation(filtered, 'filtered poison damage') <= 0 ? 0 : filtered
    },
  }
}

function filterManaDelta(
  extensions: GameSimulationExtensions,
  tick: number,
  playerId: string,
  currentMana: number,
  maximumMana: number,
  delta: number,
  source: GameSimulationManaFilterInput['source'],
): number {
  return finiteModMutation(extensions.filterMana({
    currentMana,
    delta,
    maximumMana,
    playerId,
    source,
    tick,
  }), 'filtered mana delta')
}

function applyFilteredManaDelta(
  source: PlayerEntityStore,
  playerId: string,
  requestedDelta: number,
  mutationSource: GameSimulationManaFilterInput['source'],
  tick: number,
  extensions?: GameSimulationExtensions,
  divergenceMessage?: string,
): PlayerEntityStore {
  const progression = playerProgressionAt(source, playerId)
  if (!progression) return source
  const delta = extensions
    ? filterManaDelta(
        extensions,
        tick,
        playerId,
        progression.currentMana,
        progression.maximumMana,
        requestedDelta,
        mutationSource,
      )
    : requestedDelta
  if (delta < 0) {
    const underflow = -delta > progression.currentMana
    const next = underflow
      ? failPlayerEntityBoast(source, playerId, 'mana-underflow')
      : source
    const debit = tryDebitPlayerEntityMana(next, playerId, -delta)
    if (debit.accepted) return debit.store
    if (!extensions && divergenceMessage) throw new Error(divergenceMessage)
    return next
  }
  return delta > 0 ? restorePlayerEntityMana(source, playerId, delta) : source
}

function finiteModMutation(value: number, field: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > 1_000_000) {
    throw new RangeError(`${field} must be finite and within +/-1000000`)
  }
  return value
}

function parseNativeSecondaryGolemTargetId(targetId: string): number | null {
  if (!targetId.startsWith('golem:')) return null
  const id = Number(targetId.slice('golem:'.length))
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function squaredVectorDistance(left: Readonly<Vector2>, right: Readonly<Vector2>): number {
  const dx = left.x - right.x
  const dy = left.y - right.y
  return dx * dx + dy * dy
}

function effectiveSkillNumericValue(
  skillBook: PlayerSkillBookComponent,
  statBook: PlayerStatBookComponent,
  skillId: number,
  property: string,
): number {
  const rank = skillBook.effectiveRanks[skillId] ?? 0
  if (rank < 1) return 0
  const configured = statBook.entries[skillId]?.numericProperties[property]
  if (configured === undefined) return 0
  const value = typeof configured === 'number'
    ? configured
    : configured[Math.min(rank, configured.length - 1)]
  if (value === undefined || !Number.isFinite(value)) {
    throw new RangeError(`skill ${skillId} has no finite ${property} value at rank ${rank}`)
  }
  return value
}

function rankedSkillNumericValue(
  skillBook: PlayerSkillBookComponent,
  statBook: PlayerStatBookComponent,
  skillId: number,
  property: string,
): number {
  const rank = Math.max(0, skillBook.effectiveRanks[skillId] ?? 0)
  const configured = statBook.entries[skillId]?.numericProperties[property]
  if (configured === undefined) return 0
  const value = typeof configured === 'number'
    ? configured
    : configured[Math.min(rank, configured.length - 1)]
  if (value === undefined || !Number.isFinite(value)) {
    throw new RangeError(`skill ${skillId} has no finite ${property} value at rank ${rank}`)
  }
  return value
}

function interactWithBoneyardGoodie(
  state: GameSimulationState,
  playerId: PlayerId,
  player: PlayerCharacterState,
): GameSimulationInventoryActionResult {
  if (
    state.run.phase !== 'active'
    || state.world.kind !== 'boneyard'
    || getPlayerProgression(state, playerId).lifeState !== 'alive'
  ) {
    return { accepted: false, modConsumption: null, reason: 'service-unavailable', state }
  }
  const goodie = nearestBoneyardGoodie(state.world.loot.goodies, player)
  if (!goodie) {
    return { accepted: false, modConsumption: null, reason: 'invalid-target', state }
  }
  const consumed = consumePlayerEntityWizardKey(state.playerEntities, playerId)
  if (!consumed.accepted) {
    const feedback = boneyardGoodieKeyNeeded(state.world.loot, goodie.id, playerId, state.tick)
    const world = feedback.store === state.world.loot && feedback.event === null
      ? state.world
      : {
          ...state.world,
          loot: feedback.store,
          lootEvents: feedback.event === null
            ? state.world.lootEvents
            : retainBoneyardLootEvents(state.world.lootEvents, [feedback.event], state.tick),
        }
    return {
      accepted: false,
      modConsumption: null,
      reason: 'item-not-found',
      state: world === state.world ? state : { ...state, world },
    }
  }
  return {
    accepted: true,
    modConsumption: null,
    reason: null,
    state: {
      ...state,
      playerEntities: consumed.store,
      world: {
        ...state.world,
        loot: activateBoneyardGoodie(state.world.loot, goodie.eid),
      },
    },
  }
}

function traderForAction(action: HubInventoryAction): HubTraderId | null {
  switch (action.type) {
    case 'buy-fomentius': return 'fomentius'
    case 'buy-hagatha': return 'hagatha'
    case 'transfer': return 'luthacus'
    case 'buy-dowsing':
    case 'dowse': return 'shlorio'
    case 'buy-teacher-spell':
    case 'close-dowsing':
    case 'consume':
    case 'dye':
    case 'equip':
    case 'interact-goodie':
    case 'move-inventory-item':
    case 'read-librarian-book':
    case 'read-skill-book':
    case 'select-boast':
    case 'unforge':
    case 'unequip': return null
  }
}

function failPlayerEntityBoast(
  source: PlayerEntityStore,
  playerId: string,
  producer: NativeBoastFailureProducer,
): PlayerEntityStore {
  const economy = playerEconomyAt(source, playerId)
  if (economy === null) return source
  const npc = failNativeBoast(economy.npc, producer)
  return npc === economy.npc
    ? source
    : replacePlayerEconomy(source, playerId, {
        ...economy,
        npc,
        revision: economy.revision + 1,
      })
}

function succeedPlayerEntityBoast(
  source: PlayerEntityStore,
  playerId: string,
): PlayerEntityStore {
  const economy = playerEconomyAt(source, playerId)
  if (economy === null) return source
  const npc = succeedNativeBoast(economy.npc)
  return npc === economy.npc
    ? source
    : replacePlayerEconomy(source, playerId, {
        ...economy,
        npc,
        revision: economy.revision + 1,
      })
}

function isHubNpcAction(action: HubInventoryAction): boolean {
  return action.type === 'buy-teacher-spell'
    || action.type === 'read-librarian-book'
    || action.type === 'select-boast'
}

function inventoryItemHasMagicalEffects(item: HubInventoryItem): boolean {
  return item.nativeEffects !== undefined
    ? item.nativeEffects.length > 0
    : item.recipeIndex !== null && nativeEquipmentRecipeEffects(item.recipeIndex).length > 0
}

function hubServiceAvailable(
  state: GameSimulationState,
  playerId: string,
): boolean {
  if (state.run.phase !== 'hub' || state.world.kind !== 'hub') return false
  const participant = state.world.participants[playerId]
  return participant !== undefined && participant.transition === null
}

function retainBoneyardEnemyEvents(
  previous: readonly BoneyardEnemySemanticEvent[],
  emitted: readonly BoneyardEnemySemanticEvent[],
  tick: number,
): readonly BoneyardEnemySemanticEvent[] {
  const minimumTick = tick - BONEYARD_ENEMY_EVENT_RETENTION_TICKS
  const retained = [...previous, ...emitted]
    .filter((event) => event.tick >= minimumTick)
    .sort((left, right) => left.eventId - right.eventId)
  for (let index = 1; index < retained.length; index += 1) {
    if (retained[index]!.eventId === retained[index - 1]!.eventId) {
      throw new Error(`duplicate Boneyard enemy event ID ${retained[index]!.eventId}`)
    }
  }
  return retained.length <= BONEYARD_ENEMY_EVENT_LANE_CAPACITY
    ? retained
    : retained.slice(-BONEYARD_ENEMY_EVENT_LANE_CAPACITY)
}

function retainBoneyardLootEvents(
  previous: readonly BoneyardLootEvent[],
  emitted: readonly BoneyardLootEvent[],
  tick: number,
): readonly BoneyardLootEvent[] {
  const minimumTick = tick - NATIVE_LOOT_EVENT_RETENTION_TICKS
  const retained = [...previous, ...emitted].filter((event) => event.tick >= minimumTick)
  return retained.length <= BONEYARD_ENEMY_EVENT_LANE_CAPACITY
    ? retained
    : retained.slice(-BONEYARD_ENEMY_EVENT_LANE_CAPACITY)
}

function economyOwnedRecipeIndexes(economy: HubEconomyState): readonly number[] {
  const equipment = [
    economy.equipment.amulet,
    economy.equipment.hat,
    ...economy.equipment.rings,
    economy.equipment.robe,
    economy.equipment.weapon,
  ]
  const flatten = (item: HubInventoryItem): readonly HubInventoryItem[] => [
    item,
    ...(item.contents ?? []).flatMap(flatten),
  ]
  return Object.freeze([...new Set([
    ...economy.backpack,
    ...economy.storage,
    ...equipment.filter((item): item is HubInventoryItem => item !== null),
  ].flatMap(flatten).flatMap(({ recipeIndex }) => recipeIndex === null ? [] : [recipeIndex]))])
}

function economyContainsHealthPotion(economy: HubEconomyState): boolean {
  const contains = (item: HubInventoryItem): boolean => item.nativeTypeId === 7001
    && item.nativeSubtype === 0
    || ((item as NativeLootItem).contents ?? []).some(contains)
  return economy.backpack.some(contains)
}

function countTutorialHealthPotions(items: readonly HubInventoryItem[]): number {
  return items.reduce((total, item) => (
    total
    + (item.nativeTypeId === 7001 && item.nativeSubtype === 0 ? item.quantity : 0)
    + countTutorialHealthPotions(item.contents ?? [])
  ), 0)
}

function triggerHagathaLastWord(
  playerEntities: PlayerEntityStore,
  secondaryAbilities: NativeSecondarySimulationState,
  sourceWorld: BoneyardWorldState,
  playerId: PlayerId,
  tick: number,
  lightProviderOrder: NativeLightProviderOrder,
  lethalObserver?: BoneyardEnemyLethalObserver,
): Readonly<{
  secondaryAbilities: NativeSecondarySimulationState
  world: BoneyardWorldState
}> {
  const character = playerCharacterAt(playerEntities, playerId)
  if (character === null) return { secondaryAbilities, world: sourceWorld }
  const triggered = triggerNativePlayerMindblast(secondaryAbilities, {
    directDamage: NATIVE_HAGATHA_LAST_WORD_DAMAGE,
    element: character.config.element,
    level: NATIVE_HAGATHA_LAST_WORD_DAMAGE * 2,
    lightRegistration: lightProviderOrder.register('actor'),
    ownerId: playerId,
    position: character.position,
    presentationScale: NATIVE_HAGATHA_LAST_WORD_PRESENTATION_SCALE,
    worldKey: `boneyard:${sourceWorld.runId}`,
  })
  let enemies = sourceWorld.enemies
  const events: BoneyardEnemySemanticEvent[] = []
  const targets = boneyardNativeSecondaryTargets(
    enemies,
    character.position,
    triggered.directRadius,
  ).filter((target) => {
    const x = target.position.x - character.position.x
    const y = target.position.y - character.position.y
    return x * x + y * y
      < triggered.directRadius * triggered.directRadius + target.radius * target.radius
  })
  for (const target of targets) {
    const nativeTypeId = enemies.actors.find(({ id }) => id === target.id)?.config.nativeTypeId
    const economy = playerEconomyAt(playerEntities, playerId)
    const amount = triggered.directDamage * (
      nativeTypeId === undefined || economy === null
        ? 1
        : nativeHagathaBossDamageFactor(economy.ownedPerkSelectors, nativeTypeId)
    )
    const damaged = damageBoneyardEnemy(enemies, {
      actorId: target.id,
      amount,
      lethalObserver,
      sourcePlayerId: playerId,
      tick,
    })
    if (damaged.accepted) {
      enemies = damaged.store
      events.push(...damaged.events)
    }
  }
  return Object.freeze({
    secondaryAbilities: triggered.state,
    world: enemies === sourceWorld.enemies
      ? sourceWorld
      : {
          ...sourceWorld,
          enemies,
          enemyEvents: retainBoneyardEnemyEvents(sourceWorld.enemyEvents, events, tick),
        },
  })
}

function archiveHagathaLastWordGroundLoot(
  playerEntities: PlayerEntityStore,
  sourceWorld: BoneyardWorldState,
  playerId: PlayerId,
  sourceRng: NativeRngState,
): Readonly<{
  playerEntities: PlayerEntityStore
  rng: NativeRngState
  world: BoneyardWorldState
}> {
  const retained = nativeHagathaLastWordLoot(sourceWorld.loot)
  if (retained.actorIds.length === 0) {
    return { playerEntities, rng: sourceRng, world: sourceWorld }
  }
  const goldActorIds = sourceWorld.loot.actors.filter(({ nativeTypeId }) => (
    nativeTypeId === 2012
  )).map(({ id }) => id)
  const sackActorIds = sourceWorld.loot.actors.filter(({ nativeTypeId }) => (
    nativeTypeId === 2013
  )).map(({ id }) => id)
  let removedActorIds = [...goldActorIds]
  if (retained.gold > 0) {
    playerEntities = creditPlayerEntityLootGold(playerEntities, playerId, retained.gold)
  }
  let rng = sourceRng
  if (retained.items.length > 0) {
    const suffix = drawNativeInteger(rng, NATIVE_HAGATHA_LAST_WORD_SACK_SUFFIXES.length)
    rng = suffix.state
    const character = playerCharacterAt(playerEntities, playerId)
    const economy = playerEconomyAt(playerEntities, playerId)
    if (character !== null && economy !== null) {
      const archived = archiveHagathaLastWordItems(
        economy,
        retained.items,
        `${character.config.displayName}'s ${NATIVE_HAGATHA_LAST_WORD_SACK_SUFFIXES[suffix.value]!}`,
      )
      if (archived.accepted) {
        playerEntities = replacePlayerEconomy(playerEntities, playerId, archived.state)
        removedActorIds = [...removedActorIds, ...sackActorIds]
      }
    }
  }
  return Object.freeze({
    playerEntities,
    rng,
    world: removedActorIds.length === 0
      ? sourceWorld
      : {
          ...sourceWorld,
          loot: removeBoneyardLootActors(sourceWorld.loot, removedActorIds),
        },
  })
}

function triggerMindblowingRing(
  playerEntities: PlayerEntityStore,
  secondaryAbilities: NativeSecondarySimulationState,
  sourceWorld: GameWorldState,
  playerId: PlayerId,
  level: number,
  tick: number,
  lightProviderOrder: NativeLightProviderOrder,
  lethalObserver?: BoneyardEnemyLethalObserver,
): Readonly<{
  actorIds: readonly number[]
  secondaryAbilities: NativeSecondarySimulationState
  world: GameWorldState
}> {
  const runtime = playerSkillRuntimeAt(playerEntities, playerId)
  const character = playerCharacterAt(playerEntities, playerId)
  if (
    runtime === null
    || character === null
    || !nativeEquipmentHasFeature(runtime.equipmentModifiers, 'mindblast')
  ) {
    return { actorIds: [], secondaryAbilities, world: sourceWorld }
  }
  const firstActorId = secondaryAbilities.nextActorId
  const triggered = triggerNativePlayerMindblast(secondaryAbilities, {
    element: character.config.element,
    level,
    lightRegistration: lightProviderOrder.register('actor'),
    ownerId: playerId,
    position: character.position,
    worldKey: gameWorldKey(sourceWorld, playerId),
  })
  let world = sourceWorld
  if (world.kind === 'boneyard' && triggered.directDamage > 0) {
    const targets = boneyardNativeSecondaryTargets(
      world.enemies,
      character.position,
      triggered.directRadius,
    ).filter((target) => {
      const x = target.position.x - character.position.x
      const y = target.position.y - character.position.y
      return x * x + y * y
        < triggered.directRadius * triggered.directRadius + target.radius * target.radius
    })
    for (const target of targets) {
      const damaged = damageBoneyardEnemy(world.enemies, {
        actorId: target.id,
        amount: triggered.directDamage,
        lethalObserver,
        sourcePlayerId: playerId,
        tick,
      })
      if (!damaged.accepted) continue
      world = {
        ...world,
        enemies: damaged.store,
        enemyEvents: retainBoneyardEnemyEvents(world.enemyEvents, damaged.events, tick),
      }
    }
  }
  return Object.freeze({
    actorIds: Object.freeze(Array.from(
      { length: triggered.state.nextActorId - firstActorId },
      (_, index) => firstActorId + index,
    )),
    secondaryAbilities: triggered.state,
    world,
  })
}

function grantSharedGameSimulationExperience(
  state: GameSimulationState,
  playerId: PlayerId,
  amount: number,
): GameSimulationState {
  const participantIds = state.levelUpBarrier?.participantIds
    ?? levelUpParticipantIds(state)
  const granted = grantSharedPlayerEntityExperience(
    state.playerEntities,
    playerId,
    amount,
    participantIds,
  )
  if (granted.milestone === null) {
    return { ...state, playerEntities: granted.store }
  }
  const insights = markNewCreativityInsights(
    state.playerEntities,
    granted.store,
    participantIds,
    state.secondaryAbilities.rng,
  )
  const automatic = assignAutomaticSkillChoices(
    insights.store,
    participantIds,
    state.gameRng,
  )
  const pendingPlayerIds = pendingOfferPlayerIds(insights.store, participantIds)
  if (pendingPlayerIds.length === 0) {
    throw new Error('shared level milestone did not create a player offer')
  }
  const existing = state.levelUpBarrier
  const levelUpBarrier = existing === null
    ? createLevelUpBarrier(
        state.nextLevelUpBarrierId,
        playerId,
        granted.milestone.experience,
        granted.milestone.level,
        participantIds,
        pendingPlayerIds,
        state.run.phase === 'active' ? state.run.runId : null,
      )
    : Object.freeze({
        ...existing,
        milestoneExperience: granted.milestone.experience,
        milestoneLevel: granted.milestone.level,
        pendingPlayerIds,
        sourcePlayerId: playerId,
      })
  return {
    ...state,
    levelUpBarrier,
    nextLevelUpBarrierId: existing === null
      ? state.nextLevelUpBarrierId + 1
      : state.nextLevelUpBarrierId,
    gameRng: automatic.rng,
    playerEntities: automatic.store,
    secondaryAbilities: {
      ...state.secondaryAbilities,
      rng: insights.rng,
    },
  }
}

function markNewCreativityInsights(
  previous: PlayerEntityStore,
  next: PlayerEntityStore,
  playerIds: readonly string[],
  sourceRng: NativeRngState,
): Readonly<{ rng: NativeRngState; store: PlayerEntityStore }> {
  let rng = sourceRng
  let store = next
  for (const playerId of playerIds) {
    const before = playerProgressionAt(previous, playerId)?.pendingOffer
    const after = playerProgressionAt(store, playerId)?.pendingOffer
    if (after === null || after === undefined || after.sequence === before?.sequence) continue
    const insight = markPlayerEntityCreativityInsight(store, playerId, rng)
    rng = insight.rng
    store = insight.store
  }
  return Object.freeze({ rng, store })
}

function assignAutomaticSkillChoices(
  source: PlayerEntityStore,
  playerIds: readonly string[],
  sourceRng: NativeRngState,
): Readonly<{ rng: NativeRngState; store: PlayerEntityStore }> {
  let rng = sourceRng
  let store = source
  for (const playerId of [...new Set(playerIds)].sort()) {
    const economy = playerEconomyAt(store, playerId)
    const offer = playerProgressionAt(store, playerId)?.pendingOffer
    if (
      economy?.npc.boast.selected !== 3
      || economy.npc.boast.failed
      || !offer
      || offer.automaticChoiceIndex !== undefined
    ) continue
    const choice = drawNativeInteger(rng, offer.options.length)
    rng = choice.state
    const selected = setPlayerEntityAutomaticSkillChoice(store, playerId, choice.value)
    if (selected === null) {
      throw new Error(`automatic native skill choice diverged for ${playerId}`)
    }
    store = selected
  }
  return Object.freeze({ rng, store })
}

function levelUpParticipantIds(state: GameSimulationState): readonly string[] {
  const requested = state.run.phase === 'active'
    ? state.run.eligiblePlayerIds
    : state.playerEntities.identities.map(({ playerId }) => playerId)
  return stableExistingPlayerIds(state.playerEntities, requested)
}

function stableExistingPlayerIds(
  playerEntities: PlayerEntityStore,
  requested: readonly string[],
): readonly string[] {
  return Object.freeze([...new Set(requested)]
    .filter((playerId) => playerEntityIndex(playerEntities, playerId) >= 0)
    .sort())
}

function pendingOfferPlayerIds(
  playerEntities: PlayerEntityStore,
  participantIds: readonly string[],
): readonly string[] {
  return Object.freeze(participantIds.filter((playerId) => {
    const progression = playerProgressionAt(playerEntities, playerId)
    return progression !== null
      && (progression.pendingOffer !== null || progression.pendingLevels.length > 0)
  }))
}

function createLevelUpBarrier(
  barrierId: number,
  sourcePlayerId: string,
  milestoneExperience: number,
  milestoneLevel: number,
  participantIds: readonly string[],
  pendingPlayerIds: readonly string[],
  runId: string | null,
): PlayerLevelUpBarrierState {
  return Object.freeze({
    barrierId,
    milestoneExperience,
    milestoneLevel,
    participantIds: Object.freeze([...participantIds]),
    pendingPlayerIds: Object.freeze([...pendingPlayerIds]),
    runId,
    sourcePlayerId,
  })
}

function removeLevelUpBarrierParticipant(
  barrier: PlayerLevelUpBarrierState | null,
  playerId: string,
): PlayerLevelUpBarrierState | null {
  if (barrier === null || !barrier.participantIds.includes(playerId)) return barrier
  const participantIds = Object.freeze(barrier.participantIds.filter((id) => id !== playerId))
  const pendingPlayerIds = Object.freeze(barrier.pendingPlayerIds.filter((id) => id !== playerId))
  if (participantIds.length === 0 || pendingPlayerIds.length === 0) return null
  return Object.freeze({
    ...barrier,
    participantIds,
    pendingPlayerIds,
    sourcePlayerId: barrier.sourcePlayerId === playerId
      ? participantIds[0]!
      : barrier.sourcePlayerId,
  })
}

function clearPlayerEntityMindstars(source: PlayerEntityStore): PlayerEntityStore {
  let playerEntities = source
  for (const { playerId } of source.identities) {
    playerEntities = setPlayerEntityMindstar(playerEntities, playerId, false)
  }
  return playerEntities
}

export function stepGameSimulation(
  source: GameSimulationState,
  inputs: PlayerCharacterInputs,
  elapsedSeconds: number,
): GameSimulationState {
  let state = {
    ...source,
    accumulatorSeconds: source.accumulatorSeconds + elapsedSeconds,
  }
  while (state.accumulatorSeconds >= GAME_FIXED_TICK_SECONDS) {
    state = stepGameSimulationTick({
      ...state,
      accumulatorSeconds: state.accumulatorSeconds - GAME_FIXED_TICK_SECONDS,
    }, inputs)
  }
  return state
}

export function stepSinglePlayerGameSimulation(
  source: GameSimulationState,
  movement: Vector2,
  elapsedSeconds: number,
  playerId = DEFAULT_PLAYER_ID,
): GameSimulationState {
  return stepGameSimulation(
    source,
    { [playerId]: { ...createIdlePlayerCharacterInput(), movement } },
    elapsedSeconds,
  )
}

function spawnPlayerForWorld(
  world: GameWorldState,
  config: PlayerCharacterConfig,
): PlayerCharacterState {
  switch (world.kind) {
    case 'hub': return createPlayerCharacter(config, hubSpawnPoint())
    case 'boneyard': return spawnPlayerCharacterInBoneyard(config, world)
  }
}

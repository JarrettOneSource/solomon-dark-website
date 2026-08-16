import {
  PLAYER_CHARACTER_FOOTSTEP_TICK_INTERVAL,
  PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
  PLAYER_CHARACTER_RADIUS,
  createIdlePlayerCharacterInput,
  createPlayerCharacter,
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { boneyardActiveBounds } from '../core-kernels/boneyard-arena-transition.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import { lineBoundsExitObstruction } from '../core-kernels/line-obstruction.ts'
import { HUB_CAMERA_SCALE } from '../core-kernels/hub-math.ts'
import {
  HUB_REGION_DEFINITIONS,
  firstHubRegionLineObstruction,
  isHubRegionTraversable,
} from '../core-kernels/hub-regions.ts'
import {
  acknowledgeGameOver,
  confirmPostRunLoadout,
  createGameRunLifecycle,
  startGameRun,
  stepGameRunLifecycle,
  synchronizeGameRunParticipants,
  type GameRunLifecycleState,
} from '../core-kernels/game-run.ts'
import { createNativeRng, drawNativeInteger, type NativeRngState } from '../core-kernels/native-rng.ts'
import {
  buyDowsingOffer,
  buyFomentiusItem,
  buyHagathaPerk,
  closeDowsingOffers,
  consumeInventoryItem,
  dowse,
  equipInventoryItem,
  hasPandimensionalBugMasterOutfit,
  restockFomentius,
  transferInventoryItem,
  unequipInventorySlot,
  type HubEconomyRejection,
  type HubEconomyState,
  type HubInventoryAction,
  type HubTraderId,
} from '../core-kernels/hub-economy.ts'
import {
  boneyardEnemyExperienceAward,
  effectivePrimarySkillRankStats,
  type PlayerLevelUpBarrierState,
  type PlayerProgressionComponent,
  type PlayerSkillBookComponent,
  type PlayerStatBookComponent,
} from '../core-kernels/player-progression.ts'
import {
  PLAYER_MANA_RECOVERY_PER_TICK,
  playerCollisionEnabledAfterCombatTick,
} from '../core-kernels/player-combat.ts'
import {
  applyNativeSecondaryGolemDamage,
  applyNativeSecondaryPlayerDamage,
  createNativeSecondaryPlayerState,
  createNativeSecondarySimulation,
  nativeSecondaryAvailableMana,
  nativeSecondaryTargetEffect,
  removeNativeSecondaryOwner,
  resetNativeSecondaryWorld,
  stepNativeSecondaryAbilities,
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
  emitBoneyardPlayerDamageSound,
  nativeWizardOuchCooldownReady,
  type BoneyardEnemySemanticEvent,
} from './boneyard-enemy-store.ts'
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
  applyPlayerEntityPotionEffect,
  applyPlayerEntitySkillChoice,
  coldSlowPlayerEntity,
  createPlayerEntityStore,
  damagePlayerEntity,
  dazzlePlayerEntity,
  grantPlayerEntityExperience,
  grantSharedPlayerEntityExperience,
  playerCharacterAt,
  playerEconomyAt,
  playerCharacterRecords,
  playerEntityCanAcceptInput,
  playerEntityCanCast,
  playerEntityIndex,
  playerEntityMovementScale,
  poisonPlayerEntity,
  playerProgressionAt,
  playerSkillBookAt,
  playerStatBookAt,
  removePlayerEntity,
  rerollPlayerEntitySkillOffer,
  resetPlayerEntitiesForNewRun,
  deferPlayerEntitySkillChoice,
  restorePlayerEntityHealth,
  restorePlayerEntityMana,
  setPlayerEntityMana,
  setPlayerEntityMindstar,
  setPlayerEntitySpectating,
  stepPlayerEntityCombatTick,
  stepPlayerEntityOverlayLightingTick,
  tryDebitPlayerEntityMana,
  replacePlayerCharacter,
  replacePlayerCharacterRecords,
  replacePlayerEconomy,
  type PlayerEntityStore,
} from './player-entity-store.ts'

export type PlayerId = string

export type GameWorldState = HubWorldState | BoneyardWorldState

export interface GameSimulationState {
  accumulatorSeconds: number
  levelUpBarrier: PlayerLevelUpBarrierState | null
  lightProviderOrder: NativeLightProviderOrderState
  nextLevelUpBarrierId: number
  playerEntities: PlayerEntityStore
  playerOfferRng: NativeRngState
  primarySpells: PrimarySpellSimulationState
  secondaryAbilities: NativeSecondarySimulationState
  run: GameRunLifecycleState
  tick: number
  world: GameWorldState
}

export interface GameSimulationOptions {
  hubStudentPopulation?: HubStudentPopulationState
  hubTraderAnimationSeed?: number
  initialPlayerExperience?: number
  playerOfferRngSeed?: number
}

export interface GameSimulationInventoryActionResult {
  readonly accepted: boolean
  readonly reason: HubEconomyRejection | 'service-unavailable' | null
  readonly state: GameSimulationState
}

export type PlayerCharacterInputs = Readonly<Record<PlayerId, PlayerCharacterInput>>

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
  let playerOfferRng = createNativeRng(options.playerOfferRngSeed ?? 0)
  for (const [playerId, config] of Object.entries(characters)) {
    const draw = drawNativeInteger(playerOfferRng, 1_000_000)
    playerOfferRng = draw.state
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
    levelUpBarrier,
    lightProviderOrder: lightProviderOrder.state(),
    nextLevelUpBarrierId: levelUpBarrier === null ? 1 : 2,
    playerEntities,
    playerOfferRng,
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
    : state.world
  const draw = drawNativeInteger(state.playerOfferRng, 1_000_000)
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
    playerOfferRng: draw.state,
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
      : state.world,
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
    lanternLightRegistration: loaded.scene.solomonDig === null
      ? null
      : lightProviderOrder.register('actor'),
  }
  const placements = placePlayersInBoneyard(playerCharacterRecords(state.playerEntities), world)
  const playerEntities = clearPlayerEntityMindstars(resetPlayerEntitiesForNewRun(
    state.playerEntities,
    placements,
    playerLightRegistrations,
  ))
  return {
    ...state,
    levelUpBarrier: null,
    lightProviderOrder: lightProviderOrder.state(),
    playerEntities,
    primarySpells: createPrimarySpellSimulation(),
    secondaryAbilities: resetNativeSecondaryWorld(state.secondaryAbilities),
    run: startGameRun(
      state.run,
      loaded.runId,
      state.playerEntities.identities.map(({ playerId }) => playerId),
    ),
    world,
  }
}

export function acknowledgeGameSimulationOver(
  state: GameSimulationState,
  runId: string,
  eventId: number,
): GameSimulationState | null {
  const run = acknowledgeGameOver(state.run, runId, eventId)
  return run ? { ...state, run } : null
}

function enterPostRunLoadout(
  state: GameSimulationState,
  run: GameRunLifecycleState,
): GameSimulationState {
  if (run.phase !== 'loadout') {
    throw new Error('post-run loadout requires a completed Game Over fade')
  }
  const world = createHubWorld(state.playerEntities.identities.map(({ playerId }) => playerId))
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
    const economy = playerEconomyAt(playerEntities, playerId)
    if (economy) playerEntities = replacePlayerEconomy(playerEntities, playerId, restockFomentius(economy))
  }
  return {
    ...state,
    levelUpBarrier: null,
    lightProviderOrder: lightProviderOrder.state(),
    playerEntities,
    primarySpells: createPrimarySpellSimulation(),
    secondaryAbilities: resetNativeSecondaryWorld(state.secondaryAbilities),
    run,
    world,
  }
}

export function confirmGameSimulationLoadout(
  state: GameSimulationState,
): GameSimulationState | null {
  const run = confirmPostRunLoadout(state.run)
  return run ? { ...state, run } : null
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
): GameSimulationInventoryActionResult {
  const economy = playerEconomyAt(state.playerEntities, playerId)
  const player = playerCharacterAt(state.playerEntities, playerId)
  if (!economy || !player || state.levelUpBarrier !== null) {
    return { accepted: false, reason: 'service-unavailable', state }
  }
  const trader = traderForAction(action)
  if (trader && !traderAvailable(state, playerId, player.position, trader)) {
    return { accepted: false, reason: 'service-unavailable', state }
  }

  const consumedPotion = action.type === 'consume'
    ? economy.backpack.find(({ id }) => id === action.itemId) ?? null
    : null
  const result = (() => {
    switch (action.type) {
      case 'buy-dowsing': return buyDowsingOffer(economy, action.offerId)
      case 'buy-fomentius': return buyFomentiusItem(economy, action.itemId)
      case 'buy-hagatha': return buyHagathaPerk(economy, action.selector)
      case 'close-dowsing': {
        const next = closeDowsingOffers(economy)
        return { accepted: true, dowsingPitch: null, reason: null, state: next }
      }
      case 'consume': return consumeInventoryItem(economy, action.itemId)
      case 'dowse': return dowse(economy, getPlayerProgression(state, playerId).level)
      case 'equip': return equipInventoryItem(economy, action.itemId, action.slot)
      case 'transfer': return transferInventoryItem(economy, action.itemId, action.direction)
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
  } as const
  const nextEconomy = {
    ...result.state,
    actionFeedback,
    revision: Math.max(result.state.revision, economy.revision + 1),
  }
  let playerEntities = replacePlayerEconomy(state.playerEntities, playerId, nextEconomy)
  if (result.accepted && action.type === 'consume' && consumedPotion?.nativeSubtype != null) {
    playerEntities = applyPlayerEntityPotionEffect(
      playerEntities,
      playerId,
      consumedPotion.nativeSubtype,
    )
  }
  return {
    accepted: result.accepted,
    reason: result.reason,
    state: {
      ...state,
      playerEntities,
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
  return grantSharedGameSimulationExperience(state, playerId, amount)
}

export function selectGameSimulationPlayerSkill(
  state: GameSimulationState,
  playerId: PlayerId,
  selection: { choiceIndex: number; offerSequence: number; skillId: number },
): GameSimulationState | null {
  const playerEntities = applyPlayerEntitySkillChoice(state.playerEntities, playerId, selection)
  if (!playerEntities) return null
  const barrier = state.levelUpBarrier
  if (barrier === null || !barrier.participantIds.includes(playerId)) {
    return { ...state, playerEntities }
  }
  const pendingPlayerIds = pendingOfferPlayerIds(playerEntities, barrier.participantIds)
  return {
    ...state,
    levelUpBarrier: pendingPlayerIds.length === 0
      ? null
      : Object.freeze({ ...barrier, pendingPlayerIds }),
    playerEntities,
  }
}

export function rerollGameSimulationPlayerSkill(
  state: GameSimulationState,
  playerId: PlayerId,
  offerSequence: number,
): GameSimulationState | null {
  const barrier = state.levelUpBarrier
  if (barrier === null || !barrier.pendingPlayerIds.includes(playerId)) return null
  const draw = drawNativeInteger(state.playerOfferRng, 1_000_000)
  const playerEntities = rerollPlayerEntitySkillOffer(
    state.playerEntities,
    playerId,
    offerSequence,
    draw.value,
  )
  if (!playerEntities) return null
  return {
    ...state,
    playerEntities,
    playerOfferRng: draw.state,
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
  const pendingPlayerIds = pendingOfferPlayerIds(playerEntities, barrier.participantIds)
  return {
    ...state,
    levelUpBarrier: pendingPlayerIds.length === 0
      ? null
      : Object.freeze({ ...barrier, pendingPlayerIds }),
    playerEntities,
  }
}

export function stepGameSimulationTick(
  state: GameSimulationState,
  inputs: PlayerCharacterInputs,
): GameSimulationState {
  if (state.run.phase === 'game-over') {
    if (state.world.kind !== 'boneyard') {
      throw new Error('Game Over requires the terminal Boneyard world')
    }
    const run = stepGameRunLifecycle(state.run, new Set())
    const frozen = { ...state, run, tick: state.tick + 1 }
    return run.phase === 'loadout' ? enterPostRunLoadout(frozen, run) : frozen
  }
  if (state.levelUpBarrier !== null) return state
  const lightProviderOrder = createNativeLightProviderOrder(state.lightProviderOrder)
  const players = playerCharacterRecords(state.playerEntities)
  const activeInputs = Object.fromEntries(Object.keys(players).map((playerId) => [
    playerId,
    getPlayerProgression(state, playerId).pendingOffer
      || !playerEntityCanAcceptInput(state.playerEntities, playerId)
      || (state.run.phase !== 'hub' && state.run.phase !== 'active')
      ? createIdlePlayerCharacterInput()
      : inputs[playerId] ?? createIdlePlayerCharacterInput(),
  ]))
  switch (state.world.kind) {
    case 'hub': {
      const result = stepHubWorldTick(state.world, players, activeInputs)
      return finishGameSimulationTick(state, result, activeInputs, lightProviderOrder, null)
    }
    case 'boneyard': {
      const boneyardWorld = state.world
      const deferredEnemyProjectileRegistrations = createDeferredNativeLightProviderRegistrations()
      const result = stepBoneyardWorldTick(
        boneyardWorld,
        players,
        activeInputs,
        Object.fromEntries(Object.keys(players).map((playerId) => {
          const progression = getPlayerProgression(state, playerId)
          return [playerId, {
            alive: progression.lifeState === 'alive',
            collisionEnabled: playerCollisionEnabledAfterCombatTick(progression),
            eligible: state.run.eligiblePlayerIds.includes(playerId),
            movementScale: playerEntityMovementScale(state.playerEntities, playerId),
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
      )
      return finishGameSimulationTick(
        state,
        result,
        activeInputs,
        lightProviderOrder,
        deferredEnemyProjectileRegistrations,
      )
    }
  }
}

function finishGameSimulationTick(
  previous: GameSimulationState,
  result: {
    enemyEvents?: readonly BoneyardEnemySemanticEvent[]
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
    rewards?: readonly Readonly<{
      experience: number
      playerId: string | null
    }>[]
    world: GameWorldState
  },
  inputs: PlayerCharacterInputs,
  lightProviderOrder: NativeLightProviderOrder,
  deferredEnemyProjectileRegistrations: DeferredNativeLightProviderRegistrations | null,
): GameSimulationState {
  const tick = previous.tick + 1
  let playerEntities = replacePlayerCharacterRecords(previous.playerEntities, result.players)
  let world = result.world
  let secondaryAbilities = previous.secondaryAbilities
  let levelUpBarrier = previous.levelUpBarrier
  let nextLevelUpBarrierId = previous.nextLevelUpBarrierId
  const playerDamage = result.playerDamage ?? []
  const playerDamageSoundEvents: BoneyardEnemySemanticEvent[] = []
  const appliedPlayerDamage: (typeof playerDamage)[number][] = []
  const reflectedEnemyDamage: Array<Readonly<{
    actorId: number
    amount: number
    playerId: string
  }>> = []
  for (const damage of playerDamage) {
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
    const character = result.players[damage.playerId]
    const intercepted = character === undefined
      ? { healthDamage: damage.amount, state: secondaryAbilities }
      : applyNativeSecondaryPlayerDamage(
          secondaryAbilities,
          damage.playerId,
          damage.amount,
          tick,
          character.position,
          gameWorldKey(world, damage.playerId),
        )
    secondaryAbilities = intercepted.state
    if (intercepted.healthDamage <= 0) continue
    const before = playerProgressionAt(playerEntities, damage.playerId)
    playerEntities = damagePlayerEntity(
      playerEntities,
      damage.playerId,
      intercepted.healthDamage,
      tick,
    )
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
      damage.poisonDuration,
    )
    appliedPlayerDamage.push({ ...damage, amount: intercepted.healthDamage })
  }
  for (const reward of result.rewards ?? []) {
    if (reward.playerId === null || playerEntityIndex(playerEntities, reward.playerId) < 0) continue
    const progressionState: GameSimulationState = {
      ...previous,
      levelUpBarrier,
      nextLevelUpBarrierId,
      playerEntities,
    }
    const participantIds = levelUpParticipantIds(progressionState)
    if (!participantIds.includes(reward.playerId)) continue
    const creditedExperience = boneyardEnemyExperienceAward({
      arenaPlayerCount: participantIds.length,
      evaluatedActorReward: reward.experience,
      receiverLevel: getPlayerProgression(progressionState, reward.playerId).level,
    })
    const awarded = grantSharedGameSimulationExperience(
      progressionState,
      reward.playerId,
      creditedExperience,
    )
    playerEntities = awarded.playerEntities
    levelUpBarrier = awarded.levelUpBarrier
    nextLevelUpBarrierId = awarded.nextLevelUpBarrierId
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
  const secondaryResult = stepNativeSecondaryAbilities(secondaryAbilities, {
    dampenCandidates: (worldKey, origin) => (
      result.world.kind === 'boneyard'
      && worldKey === `boneyard:${result.world.runId}`
        ? boneyardNativeSecondaryDampenCandidates(result.world.enemies, origin)
        : { casterTargetIds: [], projectileIds: [], shieldTargetIds: [] }
    ),
    effectPositionBlocked: (worldKey, position) => {
      if (
        result.world.kind === 'boneyard'
        && worldKey === `boneyard:${result.world.runId}`
      ) {
        return !canPlaceBoneyardBody(
          position,
          result.world.bounds,
          boneyardCollision!,
          0,
        )
      }
      if (result.world.kind !== 'hub') return false
      const region = Object.values(result.world.participants)
        .find((participant) => `hub:${participant.region}` === worldKey)?.region
      return region === undefined || !isHubRegionTraversable(region, position, 0)
    },
    golemMovement: (playerId, worldKey, origin, requestedPosition, radius) => {
      if (
        result.world.kind === 'boneyard'
        && worldKey === `boneyard:${result.world.runId}`
      ) {
        return resolveBoneyardMovement(
          origin,
          requestedPosition,
          result.world.bounds,
          boneyardCollision!,
          radius,
        )
      }
      if (result.world.kind !== 'hub') return origin
      const region = result.world.participants[playerId]?.region
      return region !== undefined && isHubRegionTraversable(
        region,
        requestedPosition,
        radius,
      ) ? requestedPosition : origin
    },
    golemPlacement: (playerId, worldKey, requestedPosition, rng) => {
      if (
        result.world.kind === 'boneyard'
        && worldKey === `boneyard:${result.world.runId}`
      ) {
        const world = result.world
        return resolveNativeCollisionAdjustedPosition(
          rng,
          requestedPosition,
          NATIVE_GOLEM_PLACEMENT_RADIUS,
          (position) => canPlaceBoneyardBody(
            position,
            world.bounds,
            boneyardCollision!,
            NATIVE_GOLEM_PLACEMENT_RADIUS,
          ),
        )
      }
      if (result.world.kind !== 'hub') {
        return { position: requestedPosition, rng }
      }
      const region = result.world.participants[playerId]?.region
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
        if (result.world.kind === 'boneyard') {
          if (canPlaceBoneyardBody(
            candidate,
            result.world.bounds,
            boneyardCollision!,
            PLAYER_CHARACTER_RADIUS,
          )) return candidate
          continue
        }
        const region = result.world.participants[playerId]?.region
        if (region !== undefined && isHubRegionTraversable(
          region,
          candidate,
          PLAYER_CHARACTER_RADIUS,
        )) return candidate
      }
      return null
    },
    lineObstruction: (worldKey, start, end) => (
      result.world.kind === 'boneyard'
      && worldKey === `boneyard:${result.world.runId}`
      && firstBoneyardLineObstruction(
        start,
        end,
        result.world.bounds,
        boneyardCollision!,
      ) !== null
    ),
    players: Object.fromEntries(playerEntities.identities.map(({ playerId }, index) => {
      const character = result.players[playerId]
      const economy = playerEntities.economies[index]!
      const progression = playerEntities.progressions[index]!
      const skillBook = playerEntities.skillBooks[index]!
      const statBook = playerEntities.statBooks[index]!
      if (!character) throw new Error(`secondary authority lost player ${playerId}`)
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
        explosiveShieldManaCost: effectiveSkillNumericValue(
          skillBook,
          statBook,
          55,
          'mManaCost',
        ),
        fireBurnDamage: effectiveSkillNumericValue(skillBook, statBook, 22, 'mDamage'),
        freezeDurationMultiplier: 1 + effectiveSkillNumericValue(
          skillBook,
          statBook,
          39,
          'mSlowdown',
        ) / 100,
        golemIron: (skillBook.effectiveRanks[75] ?? 0) > 0,
        golemManaCost: effectiveSkillNumericValue(skillBook, statBook, 75, 'mManaCost'),
        golemReflectFactor: effectiveSkillNumericValue(skillBook, statBook, 75, 'mReflect') / 100,
        input: inputs[playerId] ?? createIdlePlayerCharacterInput(),
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
        magicStormManaCost: effectiveSkillNumericValue(skillBook, statBook, 28, 'mManaCost'),
        maximumLeviathan: hasPandimensionalBugMasterOutfit(economy.equipment),
        manaRecoveryPerTick: PLAYER_MANA_RECOVERY_PER_TICK,
        skillBook,
        worldKey: gameWorldKey(result.world, playerId),
      }]
    })),
    sceneryTargets: (worldKey, center, radius) => (
      result.world.kind === 'boneyard'
      && worldKey === `boneyard:${result.world.runId}`
        ? result.world.earthquakeSceneryTargets.filter((target) => {
            const x = target.position.x - center.x
            const y = target.position.y - center.y
            return x * x + y * y < radius * radius
          })
        : []
    ),
    teleportDestination: (_playerId, rng) => {
      if (result.world.kind === 'boneyard') {
        const world = result.world
        const worldKey = `boneyard:${world.runId}`
        const bodies = [
          ...Object.values(result.players).map(({ position }) => ({
            position,
            radius: PLAYER_CHARACTER_RADIUS,
          })),
          ...world.enemies.actors.flatMap((actor) => (
            actor.lifeState === 'alive'
              ? [{
                  position: actor.position,
                  radius: actor.config.collisionRadius,
                }]
              : []
          )),
          ...world.enemies.maggots.flatMap((actor) => (
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
          bounds: world.bounds,
          collision: boneyardCollision!,
        })
      }
      return { position: { x: 0, y: 0 }, rng }
    },
    target: (worldKey, targetId) => (
      result.world.kind === 'boneyard'
      && worldKey === `boneyard:${result.world.runId}`
        ? boneyardNativeSecondaryTarget(result.world.enemies, targetId)
        : null
    ),
    targets: (worldKey, center, radius) => (
      result.world.kind === 'boneyard'
      && worldKey === `boneyard:${result.world.runId}`
        ? boneyardNativeSecondaryTargets(result.world.enemies, center, radius)
        : []
    ),
    tick,
  })
  secondaryAbilities = secondaryResult.state
  const secondaryPlayers: Record<PlayerId, PlayerCharacterState> = {
    ...result.players,
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
    const debit = tryDebitPlayerEntityMana(playerEntities, playerId, cost)
    if (!debit.accepted) {
      throw new Error(`secondary ability mana authority diverged for ${playerId}`)
    }
    playerEntities = debit.store
  }
  for (const playerId of secondaryResult.overloadedPlayerIds) {
    playerEntities = setPlayerEntityMana(playerEntities, playerId, 0)
  }
  for (const { playerId } of playerEntities.identities) {
    const wasActive = previous.secondaryAbilities.players[playerId]?.mindstar ?? false
    const isActive = secondaryAbilities.players[playerId]?.mindstar ?? false
    if (wasActive !== isActive) {
      playerEntities = setPlayerEntityMindstar(playerEntities, playerId, isActive)
    }
  }
  const primaryOverridePlayerIds = new Set(secondaryResult.primaryOverridePlayerIds)
  const primaryInputs = Object.fromEntries(Object.entries(inputs).map(([playerId, input]) => [
    playerId,
    primaryOverridePlayerIds.has(playerId)
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
    canTraverseProjectile: (spell, from, to) => {
      return spellObstructionPoint(spell.ownerId, from, to) === null
    },
    castAuthority: Object.fromEntries(playerEntities.identities.map(({ playerId }, index) => {
      const progression = playerEntities.progressions[index]!
      const primarySkill = effectivePrimarySkillRankStats(playerEntities.skillBooks[index]!)
      const damageMultiplier = progression.damageX4TicksRemaining > 0 ? 4 : 1
      return [
        playerId,
        {
          availableMana: nativeSecondaryAvailableMana(
            progression.currentMana,
            secondaryAbilities.players[playerId]
              ?? createNativeSecondaryPlayerState(),
          ),
          eligible: playerEntityCanCast(playerEntities, playerId)
            && progression.pendingOffer === null,
          primarySkill: damageMultiplier === 1 ? primarySkill : {
            ...primarySkill,
            damageMaximum: primarySkill.damageMaximum * damageMultiplier,
            damageMinimum: primarySkill.damageMinimum * damageMultiplier,
          },
        },
      ]
    })),
    inputs: primaryInputs,
    players: secondaryPlayers,
    previousPlayers: playerCharacterRecords(previous.playerEntities),
    registerLightProvider: lightProviderOrder.register,
    spells: previous.primarySpells,
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
  for (const [playerId, cost] of Object.entries(cast.manaSpent)) {
    if (cost <= 0) continue
    const debit = tryDebitPlayerEntityMana(playerEntities, playerId, cost)
    if (!debit.accepted) {
      throw new Error(`primary spell mana authority diverged for ${playerId}`)
    }
    playerEntities = debit.store
  }
  deferredEnemyProjectileRegistrations?.commit(lightProviderOrder)
  let primarySpells = cast.spells
  if (world.kind === 'boneyard') {
    const previousEvents = previous.world.kind === 'boneyard'
      && previous.world.runId === world.runId
      ? previous.world.enemyEvents
      : []
    world = {
      ...world,
      enemyEvents: retainBoneyardEnemyEvents(
        previousEvents,
        [...(result.enemyEvents ?? []), ...playerDamageSoundEvents],
        tick,
      ),
    }
    for (const reflection of reflectedEnemyDamage) {
      const reflected = damageBoneyardEnemy(world.enemies, {
        actorId: reflection.actorId,
        amount: reflection.amount,
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
      secondaryResult.knockbacks,
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
      (start, end, radius) => firstBoneyardPathBlockProgress(
        start,
        end,
        boneyardWorld.bounds,
        collision,
        radius,
      ),
      lightProviderOrder.register,
      (targetId, kind) => kind === 'air'
        && (nativeSecondaryTargetEffect(
          secondaryAbilities,
          `boneyard:${boneyardWorld.runId}`,
          targetId,
        )?.prismaticTicks ?? 0) > 0
        ? 2
        : 1,
    )
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
  playerEntities = replacePlayerCharacterRecords(playerEntities, players)
  playerEntities = stepPlayerEntityOverlayLightingTick(playerEntities)
  const combat = stepPlayerEntityCombatTick(playerEntities)
  playerEntities = combat.store
  for (const playerId of combat.deathBurstPlayerIds) {
    playerEntities = setPlayerEntitySpectating(playerEntities, playerId)
    secondaryAbilities = removeNativeSecondaryOwner(secondaryAbilities, playerId)
    playerEntities = setPlayerEntityMindstar(playerEntities, playerId, false)
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
  const alivePlayerIds = new Set(playerEntities.identities.flatMap(({ playerId }, index) => (
    playerEntities.progressions[index]!.lifeState === 'alive'
      || playerEntities.progressions[index]!.lifeState === 'lethal-pending'
      ? [playerId]
      : []
  )))
  return {
    accumulatorSeconds: previous.accumulatorSeconds,
    levelUpBarrier,
    lightProviderOrder: lightProviderOrder.state(),
    nextLevelUpBarrierId,
    playerEntities,
    playerOfferRng: previous.playerOfferRng,
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

const HUB_TRADER_GEOMETRY: Readonly<Record<HubTraderId, {
  readonly position: Vector2
  readonly radius: number
  readonly region: 'courtyard' | 'library'
}>> = {
  fomentius: { position: { x: 1397, y: 664 }, radius: 30, region: 'courtyard' },
  hagatha: { position: { x: 1340, y: 280 }, radius: 15, region: 'courtyard' },
  luthacus: { position: { x: 1700.5, y: 449.5 }, radius: 25, region: 'courtyard' },
  shlorio: { position: { x: 900, y: 642.5 }, radius: 25, region: 'library' },
}

function traderForAction(action: HubInventoryAction): HubTraderId | null {
  switch (action.type) {
    case 'buy-fomentius': return 'fomentius'
    case 'buy-hagatha': return 'hagatha'
    case 'transfer': return 'luthacus'
    case 'buy-dowsing':
    case 'dowse': return 'shlorio'
    case 'close-dowsing':
    case 'consume':
    case 'equip':
    case 'unequip': return null
  }
}

function traderAvailable(
  state: GameSimulationState,
  playerId: string,
  playerPosition: Vector2,
  trader: HubTraderId,
): boolean {
  if (state.run.phase !== 'hub' || state.world.kind !== 'hub') return false
  const participant = state.world.participants[playerId]
  const geometry = HUB_TRADER_GEOMETRY[trader]
  if (!participant || participant.transition !== null || participant.region !== geometry.region) {
    return false
  }
  const dx = playerPosition.x - geometry.position.x
  const dy = playerPosition.y - geometry.position.y
  return dx * dx + dy * dy <= 5 * geometry.radius * geometry.radius + 1500
}

function retainBoneyardEnemyEvents(
  previous: readonly BoneyardEnemySemanticEvent[],
  emitted: readonly BoneyardEnemySemanticEvent[],
  tick: number,
): readonly BoneyardEnemySemanticEvent[] {
  const minimumTick = tick - BONEYARD_ENEMY_EVENT_RETENTION_TICKS
  const retained = [...previous, ...emitted].filter((event) => event.tick >= minimumTick)
  return retained.length <= BONEYARD_ENEMY_EVENT_LANE_CAPACITY
    ? retained
    : retained.slice(-BONEYARD_ENEMY_EVENT_LANE_CAPACITY)
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
  const pendingPlayerIds = pendingOfferPlayerIds(granted.store, participantIds)
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
    playerEntities: granted.store,
  }
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

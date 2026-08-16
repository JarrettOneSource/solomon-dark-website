import {
  PLAYER_CHARACTER_FOOTSTEP_TICK_INTERVAL,
  PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
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
  dowse,
  equipInventoryItem,
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
import { playerCollisionEnabledAfterCombatTick } from '../core-kernels/player-combat.ts'
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
  withBoneyardGateCollision,
} from './boneyard-collision.ts'
import { resolveBoneyardSpellCombat } from './boneyard-spell-combat.ts'
import {
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
  setPlayerEntitySpectating,
  stepPlayerEntityCombatTick,
  stepPlayerEntityOverlayLightingTick,
  tryDebitPlayerEntityMana,
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
  return {
    ...state,
    levelUpBarrier: null,
    lightProviderOrder: lightProviderOrder.state(),
    playerEntities: resetPlayerEntitiesForNewRun(
      state.playerEntities,
      placements,
      playerLightRegistrations,
    ),
    primarySpells: createPrimarySpellSimulation(),
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
  if (!run) return null
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

  const result = (() => {
    switch (action.type) {
      case 'buy-dowsing': return buyDowsingOffer(economy, action.offerId)
      case 'buy-fomentius': return buyFomentiusItem(economy, action.itemId)
      case 'buy-hagatha': return buyHagathaPerk(economy, action.selector)
      case 'close-dowsing': {
        const next = closeDowsingOffers(economy)
        return { accepted: true, reason: null, state: next }
      }
      case 'dowse': return dowse(economy, getPlayerProgression(state, playerId).level)
      case 'equip': return equipInventoryItem(economy, action.itemId, action.slot)
      case 'transfer': return transferInventoryItem(economy, action.itemId, action.direction)
      case 'unequip': return unequipInventorySlot(economy, action.slot)
    }
  })()
  if (!result.accepted) return { ...result, state }
  return {
    accepted: true,
    reason: null,
    state: {
      ...state,
      playerEntities: replacePlayerEconomy(state.playerEntities, playerId, result.state),
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
      const deferredEnemyProjectileRegistrations = createDeferredNativeLightProviderRegistrations()
      const result = stepBoneyardWorldTick(
        state.world,
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
      dazzleTicks: number
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
  let levelUpBarrier = previous.levelUpBarrier
  let nextLevelUpBarrierId = previous.nextLevelUpBarrierId
  const playerDamage = result.playerDamage ?? []
  const playerDamageSoundEvents: BoneyardEnemySemanticEvent[] = []
  for (const damage of playerDamage) {
    const before = playerProgressionAt(playerEntities, damage.playerId)
    playerEntities = damagePlayerEntity(
      playerEntities,
      damage.playerId,
      damage.amount,
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
    castAuthority: Object.fromEntries(playerEntities.identities.map(({ playerId }, index) => [
      playerId,
      {
        availableMana: playerEntities.progressions[index]!.currentMana,
        eligible: playerEntityCanCast(playerEntities, playerId)
          && playerEntities.progressions[index]!.pendingOffer === null,
        primarySkill: effectivePrimarySkillRankStats(playerEntities.skillBooks[index]!),
      },
    ])),
    inputs,
    players: result.players,
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
  }
  for (const damage of playerDamage) {
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
    run: stepGameRunLifecycle(previous.run, alivePlayerIds),
    tick,
    world,
  }
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

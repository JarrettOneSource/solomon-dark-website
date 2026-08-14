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
import type { Vector2 } from '../core-kernels/vector.ts'
import { lineBoundsExitObstruction } from '../core-kernels/line-obstruction.ts'
import { HUB_CAMERA_SCALE } from '../core-kernels/hub-math.ts'
import {
  HUB_REGION_DEFINITIONS,
  firstHubRegionLineObstruction,
  isHubRegionTraversable,
} from '../core-kernels/hub-regions.ts'
import {
  canPlaceBoneyardBody,
  firstBoneyardLineObstruction,
  withBoneyardGateCollision,
} from './boneyard-collision.ts'
import { createNativeRng, drawNativeInteger, type NativeRngState } from '../core-kernels/native-rng.ts'
import type {
  PlayerProgressionComponent,
  PlayerSkillBookComponent,
  PlayerStatBookComponent,
} from '../core-kernels/player-progression.ts'
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
  createPlayerEntityStore,
  grantPlayerEntityExperience,
  playerCharacterAt,
  playerCharacterRecords,
  playerEntityIndex,
  playerProgressionAt,
  playerSkillBookAt,
  playerStatBookAt,
  removePlayerEntity,
  replacePlayerCharacterRecords,
  type PlayerEntityStore,
} from './player-entity-store.ts'

export type PlayerId = string

export type GameWorldState = HubWorldState | BoneyardWorldState

export interface GameSimulationState {
  accumulatorSeconds: number
  playerEntities: PlayerEntityStore
  playerOfferRng: NativeRngState
  primarySpells: PrimarySpellSimulationState
  tick: number
  world: GameWorldState
}

export interface GameSimulationOptions {
  hubStudentPopulation?: HubStudentPopulationState
  initialPlayerExperience?: number
  playerOfferRngSeed?: number
}

export type PlayerCharacterInputs = Readonly<Record<PlayerId, PlayerCharacterInput>>

export const DEFAULT_PLAYER_ID = 'local-player'
export const GAME_FIXED_TICK_SECONDS = PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS
export const GAME_TICK_RATE = 1 / GAME_FIXED_TICK_SECONDS
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
  const world = createHubWorld(Object.keys(characters), {
    studentPopulation: options.hubStudentPopulation,
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
    )
    if (options.initialPlayerExperience) {
      playerEntities = grantPlayerEntityExperience(
        playerEntities,
        playerId,
        options.initialPlayerExperience,
      )
    }
  }
  return {
    accumulatorSeconds: 0,
    playerEntities,
    playerOfferRng,
    primarySpells: createPrimarySpellSimulation(),
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
  return {
    ...state,
    playerEntities: addPlayerEntity(
      state.playerEntities,
      playerId,
      config,
      spawnPlayerForWorld(state.world, config),
      draw.value,
    ),
    playerOfferRng: draw.state,
    world,
  }
}

export function removePlayerCharacter(
  state: GameSimulationState,
  playerId: PlayerId,
): GameSimulationState {
  if (playerEntityIndex(state.playerEntities, playerId) < 0) return state
  return {
    ...state,
    playerEntities: removePlayerEntity(state.playerEntities, playerId),
    primarySpells: removePrimarySpellOwner(state.primarySpells, playerId),
    world: state.world.kind === 'hub'
      ? removeHubParticipant(state.world, playerId)
      : state.world,
  }
}

export function enterBoneyardWorld(
  state: GameSimulationState,
  loaded: LoadedBoneyard,
): GameSimulationState {
  const world = createBoneyardWorld(loaded)
  return {
    ...state,
    playerEntities: replacePlayerCharacterRecords(
      state.playerEntities,
      placePlayersInBoneyard(playerCharacterRecords(state.playerEntities), world),
    ),
    primarySpells: createPrimarySpellSimulation(),
    world,
  }
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
  return {
    ...state,
    playerEntities: grantPlayerEntityExperience(state.playerEntities, playerId, amount),
  }
}

export function selectGameSimulationPlayerSkill(
  state: GameSimulationState,
  playerId: PlayerId,
  selection: { choiceIndex: number; offerSequence: number; skillId: number },
): GameSimulationState | null {
  const playerEntities = applyPlayerEntitySkillChoice(state.playerEntities, playerId, selection)
  return playerEntities ? { ...state, playerEntities } : null
}

export function stepGameSimulationTick(
  state: GameSimulationState,
  inputs: PlayerCharacterInputs,
): GameSimulationState {
  const players = playerCharacterRecords(state.playerEntities)
  const activeInputs = Object.fromEntries(Object.keys(players).map((playerId) => [
    playerId,
    getPlayerProgression(state, playerId).pendingOffer
      ? createIdlePlayerCharacterInput()
      : inputs[playerId] ?? createIdlePlayerCharacterInput(),
  ]))
  switch (state.world.kind) {
    case 'hub': {
      const result = stepHubWorldTick(state.world, players, activeInputs)
      return finishGameSimulationTick(state, result, activeInputs)
    }
    case 'boneyard': {
      const result = stepBoneyardWorldTick(
        state.world,
        players,
        activeInputs,
        state.tick + 1,
      )
      return finishGameSimulationTick(state, result, activeInputs)
    }
  }
}

function finishGameSimulationTick(
  previous: GameSimulationState,
  result: { players: Readonly<Record<PlayerId, PlayerCharacterState>>, world: GameWorldState },
  inputs: PlayerCharacterInputs,
): GameSimulationState {
  const tick = previous.tick + 1
  const boneyardCollision = result.world.kind === 'boneyard'
    ? withBoneyardGateCollision(result.world.collision, result.world.gateLeaves)
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
        result.world.bounds,
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
          result.world.bounds,
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
    inputs,
    players: result.players,
    previousPlayers: playerCharacterRecords(previous.playerEntities),
    spells: previous.primarySpells,
    tick,
    viewScale: result.world.kind === 'hub' ? HUB_CAMERA_SCALE : 1.35,
    spellObstructionPoint,
    spellRangeEndpoint: (playerId, start, direction) => {
      const bounds = result.world.kind === 'boneyard'
        ? result.world.bounds
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
  if (tick % PLAYER_CHARACTER_FOOTSTEP_TICK_INTERVAL !== 0) {
    return {
      accumulatorSeconds: previous.accumulatorSeconds,
      playerEntities: replacePlayerCharacterRecords(previous.playerEntities, cast.players),
      playerOfferRng: previous.playerOfferRng,
      primarySpells: cast.spells,
      tick,
      world: result.world,
    }
  }

  const players: Record<PlayerId, PlayerCharacterState> = {}
  for (const [playerId, player] of Object.entries(cast.players)) {
    const priorPlayer = playerCharacterAt(previous.playerEntities, playerId)
    players[playerId] = priorPlayer
      && priorPlayer.walkCyclePrimary !== player.walkCyclePrimary
      ? { ...player, footstepTick: tick }
      : player
  }
  return {
    accumulatorSeconds: previous.accumulatorSeconds,
    playerEntities: replacePlayerCharacterRecords(previous.playerEntities, players),
    playerOfferRng: previous.playerOfferRng,
    primarySpells: cast.spells,
    tick,
    world: result.world,
  }
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

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
import {
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

export type PlayerId = string

export type GameWorldState = HubWorldState | BoneyardWorldState

export interface GameSimulationState {
  accumulatorSeconds: number
  players: Readonly<Record<PlayerId, PlayerCharacterState>>
  tick: number
  world: GameWorldState
}

export interface GameSimulationOptions {
  hubStudentPopulation?: HubStudentPopulationState
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
  const players: Record<PlayerId, PlayerCharacterState> = {}
  for (const [playerId, config] of Object.entries(characters)) {
    players[playerId] = createPlayerCharacter(config, hubSpawnPoint())
  }
  return { accumulatorSeconds: 0, players, tick: 0, world }
}

export function addPlayerCharacter(
  state: GameSimulationState,
  playerId: PlayerId,
  config: PlayerCharacterConfig,
): GameSimulationState {
  if (state.players[playerId]) return state
  const world = state.world.kind === 'hub'
    ? addHubParticipant(state.world, playerId)
    : state.world
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: spawnPlayerForWorld(state.world, config),
    },
    world,
  }
}

export function removePlayerCharacter(
  state: GameSimulationState,
  playerId: PlayerId,
): GameSimulationState {
  if (!state.players[playerId]) return state
  const players = { ...state.players }
  delete players[playerId]
  return {
    ...state,
    players,
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
    players: placePlayersInBoneyard(state.players, world),
    world,
  }
}

export function getPlayerCharacter(
  state: GameSimulationState,
  playerId = DEFAULT_PLAYER_ID,
): PlayerCharacterState {
  const player = state.players[playerId]
  if (!player) throw new Error(`game simulation has no player character ${playerId}`)
  return player
}

export function stepGameSimulationTick(
  state: GameSimulationState,
  inputs: PlayerCharacterInputs,
): GameSimulationState {
  switch (state.world.kind) {
    case 'hub': {
      const result = stepHubWorldTick(state.world, state.players, inputs)
      return finishGameSimulationTick(state, result)
    }
    case 'boneyard': {
      const result = stepBoneyardWorldTick(state.world, state.players, inputs)
      return finishGameSimulationTick(state, result)
    }
  }
}

function finishGameSimulationTick(
  previous: GameSimulationState,
  result: { players: Readonly<Record<PlayerId, PlayerCharacterState>>, world: GameWorldState },
): GameSimulationState {
  const tick = previous.tick + 1
  if (tick % PLAYER_CHARACTER_FOOTSTEP_TICK_INTERVAL !== 0) {
    return {
      accumulatorSeconds: previous.accumulatorSeconds,
      players: result.players,
      tick,
      world: result.world,
    }
  }

  const players: Record<PlayerId, PlayerCharacterState> = {}
  for (const [playerId, player] of Object.entries(result.players)) {
    const priorPlayer = previous.players[playerId]
    players[playerId] = priorPlayer
      && priorPlayer.walkCyclePrimary !== player.walkCyclePrimary
      ? { ...player, footstepTick: tick }
      : player
  }
  return {
    accumulatorSeconds: previous.accumulatorSeconds,
    players,
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

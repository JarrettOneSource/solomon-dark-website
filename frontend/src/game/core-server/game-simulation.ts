import {
  PLAYER_CHARACTER_MOVEMENT_TICK_SECONDS,
  createPlayerCharacter,
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import type { Vector2 } from '../core-kernels/vector.ts'
import {
  createHubWorld,
  hubSpawnPoint,
  stepHubWorldTick,
  type HubWorldState,
} from './hub-world.ts'

export type PlayerId = string

export interface GameSimulationState {
  accumulatorSeconds: number
  players: Readonly<Record<PlayerId, PlayerCharacterState>>
  tick: number
  world: HubWorldState
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
): GameSimulationState {
  const world = createHubWorld()
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
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: createPlayerCharacter(config, spawnPointForWorld(state.world)),
    },
  }
}

export function removePlayerCharacter(
  state: GameSimulationState,
  playerId: PlayerId,
): GameSimulationState {
  if (!state.players[playerId]) return state
  const players = { ...state.players }
  delete players[playerId]
  return { ...state, players }
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
      return {
        accumulatorSeconds: state.accumulatorSeconds,
        players: result.players,
        tick: state.tick + 1,
        world: result.world,
      }
    }
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
    { [playerId]: { movement } },
    elapsedSeconds,
  )
}

function spawnPointForWorld(world: HubWorldState): Vector2 {
  switch (world.kind) {
    case 'hub': return hubSpawnPoint()
  }
}

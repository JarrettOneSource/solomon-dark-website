import { actorHeadingIndex } from '../core-kernels/actor-heading.ts'
import type { BoneyardBounds, LoadedBoneyard } from '../core-kernels/boneyard.ts'
import {
  PLAYER_CHARACTER_RADIUS,
  commitPlayerCharacterTick,
  createPlayerCharacter,
  planPlayerCharacterTick,
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'
import type { Vector2 } from '../core-kernels/vector.ts'

export interface BoneyardWorldState {
  bounds: BoneyardBounds
  kind: 'boneyard'
  runId: string
  spawn: { x: number; y: number; facingDeg: number }
}

export interface BoneyardWorldTickResult {
  players: Readonly<Record<string, PlayerCharacterState>>
  world: BoneyardWorldState
}

export function createBoneyardWorld(loaded: LoadedBoneyard): BoneyardWorldState {
  return {
    bounds: { ...loaded.scene.bounds },
    kind: 'boneyard',
    runId: loaded.runId,
    spawn: { ...loaded.scene.spawn },
  }
}

export function spawnPlayerCharacterInBoneyard(
  config: PlayerCharacterConfig,
  world: BoneyardWorldState,
): PlayerCharacterState {
  return {
    ...createPlayerCharacter(config, { x: world.spawn.x, y: world.spawn.y }),
    headingIndex: actorHeadingIndex(world.spawn.facingDeg),
  }
}

export function placePlayersInBoneyard(
  players: Readonly<Record<string, PlayerCharacterState>>,
  world: BoneyardWorldState,
): Readonly<Record<string, PlayerCharacterState>> {
  return Object.fromEntries(Object.entries(players).map(([playerId, player]) => [
    playerId,
    spawnPlayerCharacterInBoneyard(player.config, world),
  ]))
}

export function stepBoneyardWorldTick(
  world: BoneyardWorldState,
  players: Readonly<Record<string, PlayerCharacterState>>,
  inputs: Readonly<Record<string, PlayerCharacterInput>>,
): BoneyardWorldTickResult {
  const nextPlayers = Object.fromEntries(Object.entries(players).map(([playerId, player]) => {
    const plan = planPlayerCharacterTick(
      player,
      inputs[playerId] ?? { movement: { x: 0, y: 0 } },
    )
    const requested = {
      x: player.position.x + plan.delta.x,
      y: player.position.y + plan.delta.y,
    }
    return [
      playerId,
      commitPlayerCharacterTick(
        player,
        plan,
        clampToBounds(requested, world.bounds, PLAYER_CHARACTER_RADIUS),
      ),
    ]
  }))
  return { players: nextPlayers, world }
}

function clampToBounds(
  point: Vector2,
  bounds: BoneyardBounds,
  radius: number,
): Vector2 {
  return {
    x: Math.min(bounds.x + bounds.w - radius, Math.max(bounds.x + radius, point.x)),
    y: Math.min(bounds.y + bounds.h - radius, Math.max(bounds.y + radius, point.y)),
  }
}

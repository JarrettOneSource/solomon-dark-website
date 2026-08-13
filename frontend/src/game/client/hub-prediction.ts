import { moveWithHubCollisionState } from '../core-kernels/hub-collision.ts'
import {
  PLAYER_CHARACTER_RADIUS,
  commitPlayerCharacterTick,
  planPlayerCharacterTick,
  type PlayerCharacterInput,
  type PlayerCharacterState,
} from '../core-kernels/player-character.ts'

export interface HubCharacterPrediction {
  collisionRngState: number
  player: PlayerCharacterState
}

/** Predict a player character against the Hub's authoritative static geometry. */
export function predictPlayerCharacterInHub(
  previous: PlayerCharacterState,
  input: PlayerCharacterInput,
  collisionRngState: number,
): HubCharacterPrediction {
  const plan = planPlayerCharacterTick(previous, input)
  const moved = moveWithHubCollisionState(
    previous.position,
    plan.delta,
    PLAYER_CHARACTER_RADIUS,
    collisionRngState,
  )
  return {
    collisionRngState: moved.rngState,
    player: commitPlayerCharacterTick(previous, plan, moved.position),
  }
}

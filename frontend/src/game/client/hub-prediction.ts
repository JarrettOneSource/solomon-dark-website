import {
  createHubParticipantState,
  moveWithHubRegionCollisionState,
  planHubScriptedMovement,
  type HubParticipantState,
} from '../core-kernels/hub-regions.ts'
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
  participant: HubParticipantState = createHubParticipantState(),
): HubCharacterPrediction {
  if (participant.transition) {
    const plan = planHubScriptedMovement(
      previous,
      participant.transition.scriptedTarget,
      participant.transition.scriptedSpeed,
    )
    return {
      collisionRngState,
      player: commitPlayerCharacterTick(previous, plan, {
        x: previous.position.x + plan.delta.x,
        y: previous.position.y + plan.delta.y,
      }),
    }
  }
  const plan = planPlayerCharacterTick(previous, input, 1)
  const moved = moveWithHubRegionCollisionState(
    participant.region,
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

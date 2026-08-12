import { moveWithHubCollisionState } from './hub-collision.ts'
import {
  HUB_GAIT_DEGREES_PER_UNIT,
  advanceHubPlayerWalkCycle,
  hubHeadingFromVector,
  hubHeadingIndex,
  hubMovementTick,
  type HubPoint,
} from './hub-math.ts'

export interface HubPlayerState {
  gaitDegrees: number
  headingIndex: number
  position: HubPoint
  velocity: HubPoint
  walkCyclePrimary: number
}

export interface HubPlayerPrediction {
  collisionRngState: number
  player: HubPlayerState
}

export function reconcileHubPlayer(
  previous: HubPlayerState,
  position: HubPoint,
  requestedVelocity: HubPoint,
  requestedDelta: HubPoint,
  retainedVelocity: HubPoint,
): HubPlayerState {
  const requestedSpeed = Math.hypot(requestedVelocity.x, requestedVelocity.y)
  const requestedDistance = Math.hypot(requestedDelta.x, requestedDelta.y)
  return {
    gaitDegrees: (
      previous.gaitDegrees
      + requestedDistance * HUB_GAIT_DEGREES_PER_UNIT
    ) % 360,
    headingIndex: requestedSpeed > 0.01
      ? hubHeadingIndex(hubHeadingFromVector(requestedVelocity.x, requestedVelocity.y))
      : previous.headingIndex,
    position,
    velocity: retainedVelocity,
    walkCyclePrimary: advanceHubPlayerWalkCycle(
      previous.walkCyclePrimary,
      requestedDistance,
    ),
  }
}

/**
 * Predict one local-player tick against the authoritative static Courtyard.
 * Dynamic actors remain snapshot ghosts and are corrected by reconciliation.
 */
export function predictHubPlayerTick(
  previous: HubPlayerState,
  input: HubPoint,
  radius: number,
  collisionRngState: number,
): HubPlayerPrediction {
  const movement = hubMovementTick(previous.velocity, input)
  const moved = moveWithHubCollisionState(
    previous.position,
    movement.delta,
    radius,
    collisionRngState,
  )
  return {
    collisionRngState: moved.rngState,
    player: reconcileHubPlayer(
      previous,
      moved.position,
      movement.requestedVelocity,
      movement.delta,
      movement.retainedVelocity,
    ),
  }
}

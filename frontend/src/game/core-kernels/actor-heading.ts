export function actorHeadingFromVector(x: number, y: number): number {
  const degrees = Math.atan2(x, -y) * 180 / Math.PI
  return (degrees + 360) % 360
}

export function actorHeadingIndex(heading: number): number {
  const normalized = ((heading % 360) + 360) % 360
  return Math.floor((normalized + 7.5) / 15) % 24
}

export function actorHeadingVector(headingIndex: number): { x: number; y: number } {
  const radians = headingIndex * 15 * Math.PI / 180
  return {
    x: Math.sin(radians),
    y: -Math.cos(radians),
  }
}

/**
 * Visible travel needed before a movement-facing sprite turns towards it.
 * Reconciliation corrections ripple a predicted sprite back and forth by a
 * fraction of a tick per frame; anchoring the facing to the last point it
 * turned at, and only turning again once the sprite has travelled this far
 * from that anchor, keeps those ripples from flipping the sprite around.
 */
export const ACTOR_MOVEMENT_FACING_DISTANCE = 4

/** Displacement treated as a placement (region teleport) rather than travel. */
export const ACTOR_MOVEMENT_FACING_TELEPORT_DISTANCE = 64

export interface ActorMovementFacingState {
  readonly anchorX: number
  readonly anchorY: number
  /** Heading of the last committed travel, or null before the first one. */
  readonly headingIndex: number | null
}

export function createActorMovementFacingState(x: number, y: number): ActorMovementFacingState {
  return { anchorX: x, anchorY: y, headingIndex: null }
}

export function advanceActorMovementFacing(
  state: ActorMovementFacingState,
  x: number,
  y: number,
  distance = ACTOR_MOVEMENT_FACING_DISTANCE,
): ActorMovementFacingState {
  const dx = x - state.anchorX
  const dy = y - state.anchorY
  const travelled = dx * dx + dy * dy
  if (travelled < distance * distance) return state
  if (travelled >= ACTOR_MOVEMENT_FACING_TELEPORT_DISTANCE ** 2) {
    return { anchorX: x, anchorY: y, headingIndex: state.headingIndex }
  }
  return {
    anchorX: x,
    anchorY: y,
    headingIndex: actorHeadingIndex(actorHeadingFromVector(dx, dy)),
  }
}
